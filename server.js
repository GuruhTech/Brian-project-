
'use strict';

const dotenv = require('dotenv');
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const https   = require('https');
const path    = require('path');
const fs      = require('fs');

const envPath = path.join(__dirname, '.env');
const hEnvPath = path.join(__dirname, 'h.env');
let envLoaded = null;
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  envLoaded = '.env';
} else if (fs.existsSync(hEnvPath)) {
  dotenv.config({ path: hEnvPath });
  envLoaded = 'h.env';
} else {
  dotenv.config();
}

if (envLoaded) {
  console.log(`✅ Loaded environment from ${envLoaded}`);
} else {
  console.log('⚠️  No env file found; using system environment variables only.');
}

const PORT          = parseInt(process.env.PORT || '5000', 10);
const JWT_SECRET    = process.env.JWT_SECRET || 'brisa_motors_secret_v3';
const DATA_FILE     = path.join(__dirname, 'brisa-data.json');
const MPESA_ENV     = process.env.MPESA_ENV || 'sandbox';
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const MPESA_PASSKEY = process.env.MPESA_PASSKEY || '';
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || '';
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || '';
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL || null;
const MPESA_BASE = MPESA_ENV === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
const MPESA_OAUTH_PATH = '/oauth/v1/generate?grant_type=client_credentials';
const MPESA_STK_PUSH_PATH = '/mpesa/stkpush/v1/processrequest';

let mpesaTokenCache = { token: null, expiresAt: 0 };

const mpesaPlaceholders = [
  'your_mpesa_passkey_here',
  'your_mpesa_consumer_key_here',
  'your_mpesa_consumer_secret_here'
];

const invalidMpesaConfig = mpesaPlaceholders.some(value =>
  [MPESA_PASSKEY, MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET].includes(value)
);

if (!MPESA_PASSKEY || !MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || invalidMpesaConfig) {
  console.warn('⚠️  M-Pesa config is incomplete or still using placeholder values.');
  console.warn('   Please set MPESA_PASSKEY, MPESA_CONSUMER_KEY, and MPESA_CONSUMER_SECRET in your .env or h.env file.');
}

function darajaRequest(method, path, body = null, authHeader = null) {
  return new Promise((resolve, reject) => {
    const baseUrl = new URL(MPESA_BASE);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: baseUrl.hostname,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };

    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const parsed = raw ? JSON.parse(raw) : {};
          resolve(parsed);
        } catch (err) {
          reject(new Error(`Daraja response parse error: ${err.message} | ${raw}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getMpesaAccessToken() {
  if (mpesaTokenCache.token && Date.now() < mpesaTokenCache.expiresAt - 60000) {
    return mpesaTokenCache.token;
  }
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
    throw new Error('M-Pesa credentials are not configured. Set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.');
  }
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const result = await darajaRequest('GET', MPESA_OAUTH_PATH, null, `Basic ${auth}`);
  if (!result.access_token) {
    console.error('[Daraja Auth] failure', result);
    throw new Error(`M-Pesa auth failed: ${JSON.stringify(result)}`);
  }
  mpesaTokenCache.token = result.access_token;
  mpesaTokenCache.expiresAt = Date.now() + ((result.expires_in || 3600) * 1000);
  return result.access_token;
}

function formatMpesaPhone(phone) {
  let raw = String(phone || '').trim();
  raw = raw.replace(/[\s\-\(\)]/g, '');
  if (raw.startsWith('+')) raw = raw.slice(1);
  if (raw.startsWith('0')) raw = '254' + raw.slice(1);
  if (!raw.startsWith('254')) raw = '254' + raw;
  return raw;
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));


let DB = {
  clients: [], cars: [], parts: [],
  appointments: [], repairs: [],
  payments: [], invoices: [], resets: [],
  seq: { clients:0, cars:0, parts:0, appointments:0, repairs:0, payments:0, invoices:0, resets:0, invNo:0 }
};

function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      DB = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      console.log('✅  Database loaded from brisa-data.json');
    } else {
      seedDB();
      saveDB();
      console.log('✅  Fresh database created and seeded');
    }
  } catch (e) {
    console.error('DB load error:', e.message, '— starting fresh');
    seedDB(); saveDB();
  }
}

function saveDB() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2)); }
  catch (e) { console.error('DB save error:', e.message); }
}

function nextId(table) { DB.seq[table]++; saveDB(); return DB.seq[table]; }

function seedDB() {
  // Admin account (password: Admin@1234)
  DB.seq.clients = 1;
  DB.clients = [{
    id:1, name:'Brisa Admin', email:'admin@brisamotors.co.ke',
    password: bcrypt.hashSync('Admin@1234', 10),
    phone:null, role:'admin', created_at: new Date().toISOString()
  }];

  DB.seq.cars = 12;
  DB.cars = [
    {id:1,  make:'Toyota',     model:'Corolla',   year:2020, price:1850000, mileage:52000,  color:'Pearl White',    engine:'1.8L VVT-i 4-cyl',          hp:140, turbo:false, drive:'FWD', body:'Sedan',  transmission:'automatic', fuel_type:'Petrol', seats:5, doors:4, cylinders:4, description:'Well maintained, full service history. One careful owner from new.',      images:['IMGS/car22.jpg'],  quantity:2, status:'available'},
    {id:2,  make:'Toyota',     model:'Hilux',     year:2019, price:3200000, mileage:74000,  color:'Silver',         engine:'2.4L Diesel Turbo 4-cyl',   hp:150, turbo:true,  drive:'4WD', body:'Pickup', transmission:'manual',    fuel_type:'Diesel', seats:5, doors:4, cylinders:4, description:'4x4 Double Cab with tow bar. Serviced every 5,000km at Toyota Kenya.',   images:['IMGS/hilux.jpg'],  quantity:1, status:'available'},
    {id:3,  make:'Mazda',      model:'CX-5',      year:2021, price:2700000, mileage:38000,  color:'Machine Grey',   engine:'2.0L SKYACTIV-G 4-cyl',     hp:165, turbo:false, drive:'FWD', body:'SUV',    transmission:'automatic', fuel_type:'Petrol', seats:5, doors:5, cylinders:4, description:'Bose audio, heated seats, i-ACTIVSENSE safety suite.',                    images:['IMGS/mazda.jpg'],  quantity:1, status:'available'},
    {id:4,  make:'BMW',        model:'3 Series',  year:2018, price:3500000, mileage:88000,  color:'Black Sapphire', engine:'2.0L TwinPower Turbo 4-cyl', hp:184, turbo:true,  drive:'RWD', body:'Sedan',  transmission:'automatic', fuel_type:'Petrol', seats:5, doors:4, cylinders:4, description:'Navigation panel, leather seats, HUD. Full  kawasaki service history.',  images:['IMGS/kawasaki.jpg'],  quantity:1, status:'available'},
    {id:5,  make:'Subaru',     model:'Forester',  year:2020, price:2100000, mileage:61000,  color:'Crystal White',  engine:'2.5L BOXER 4-cyl',           hp:182, turbo:false, drive:'AWD', body:'SUV',    transmission:'automatic', fuel_type:'Petrol', seats:5, doors:5, cylinders:4, description:'EyeSight, Symmetrical AWD, panoramic sunroof.',                           images:['IMGS/subaru.jpg'],  quantity:0, status:'sold_out'},
    {id:6,  make:'Mercedes',   model:'C-Class',   year:2019, price:4200000, mileage:55000,  color:'Obsidian Black', engine:'2.0L EQ Boost Turbo 4-cyl',  hp:204, turbo:true,  drive:'RWD', body:'Sedan',  transmission:'automatic', fuel_type:'Petrol', seats:5, doors:4, cylinders:4, description:'AMG Line, Burmester sound, panoramic roof. Full MBSL service history.',   images:['IMGS/sclass.jpg'],  quantity:1, status:'available'},
    {id:7,  make:'Honda',      model:'CR-V',      year:2022, price:3100000, mileage:22000,  color:'Lunar Silver',   engine:'1.5L VTEC Turbo 4-cyl',     hp:190, turbo:true,  drive:'FWD', body:'SUV',    transmission:'automatic', fuel_type:'Petrol', seats:5, doors:5, cylinders:4, description:'Honda Sensing, hands-free tailgate, wireless CarPlay. Like new.',          images:['IMGS/car7.jpg'],  quantity:2, status:'available'},
    {id:8,  make:'Nissan',     model:'X-Trail',   year:2021, price:2650000, mileage:41000,  color:'Pearl White',    engine:'2.5L DOHC 4-cyl',           hp:169, turbo:false, drive:'4WD', body:'SUV',    transmission:'automatic', fuel_type:'Petrol', seats:7, doors:5, cylinders:4, description:'7-seater 4x4. ProPILOT assist, Around View Monitor.',                    images:['IMGS/car8.jpg'],  quantity:1, status:'available'},
    {id:9,  make:'Land Rover', model:'Discovery', year:2020, price:5800000, mileage:67000,  color:'Indus Silver',   engine:'3.0L Td6 Diesel V6',        hp:258, turbo:true,  drive:'4WD', body:'SUV',    transmission:'automatic', fuel_type:'Diesel', seats:7, doors:5, cylinders:6, description:'Full spec Discovery, Terrain Response 2, dual panoramic sunroofs.',       images:['IMGS/rover.jpg'],  quantity:1, status:'available'},
    {id:10, make:'kawasaki',       model:'ninja',        year:2021, price:4500000, mileage:33000,  color:'green',   engine:'2.0L TFSI Turbo 4-cyl',     hp:249, turbo:true,  drive:'AWD', body:'sport',    transmission:'manual', fuel_type:'Petrol', seats:2, doors:0, cylinders:4, description:'Quattro AWD, Bang & Olufsen 3D Sound, Matrix LED headlights.',            images:['IMGS/car4.jpg'], quantity:1, status:'available'},
    {id:11, make:'Kia',        model:'Sportage',  year:2022, price:2400000, mileage:18000,  color:'Snow White',     engine:'1.6L T-GDi Turbo 4-cyl',   hp:177, turbo:true,  drive:'FWD', body:'SUV',    transmission:'automatic', fuel_type:'Petrol', seats:5, doors:5, cylinders:4, description:'Smart Sense safety, 10.25" panoramic display. Low mileage, like new.',   images:['IMGS/kia.jpg'], quantity:2, status:'available'},
    {id:12, make:'Volkswagen', model:'Tiguan',    year:2021, price:3800000, mileage:45000,  color:'Reflex Silver',  engine:'1.4L TSI EVO Turbo 4-cyl', hp:150, turbo:true,  drive:'4WD', body:'SUV',    transmission:'automatic', fuel_type:'Petrol', seats:5, doors:5, cylinders:4, description:'4Motion AWD, Digital Cockpit Pro, IQ.DRIVE, panoramic roof.',             images:['IMGS/tiguan.jpg'], quantity:1, status:'available'},
  ];

  DB.seq.parts = 6;
  DB.parts = [
    {id:1, name:'Oil Filter',           part_number:'OF-001', category:'Engine',     price:1500,  stock:50, compatible_makes:'Toyota,Honda,Mazda',   description:'Standard spin-on oil filter, OEM quality.'},
    {id:2, name:'Brake Pads (Front)',   part_number:'BP-F02', category:'Brakes',     price:4500,  stock:30, compatible_makes:'Toyota,Subaru',         description:'Ceramic compound, low dust, OEM spec.'},
    {id:3, name:'Air Filter',           part_number:'AF-003', category:'Engine',     price:2200,  stock:40, compatible_makes:'Toyota,Honda,Nissan',   description:'High-flow OEM equivalent air filter.'},
    {id:4, name:'Alternator Belt',      part_number:'AB-004', category:'Electrical', price:3800,  stock:20, compatible_makes:'Toyota,Mazda',          description:'Reinforced V-belt, genuine quality.'},
    {id:5, name:'Shock Absorber (Front)',part_number:'SA-005',category:'Suspension', price:12000, stock:15, compatible_makes:'Toyota,Honda',          description:'Gas-charged front shock absorber.'},
    {id:6, name:'Radiator',             part_number:'RD-006', category:'Cooling',    price:15000, stock:0,  compatible_makes:'Toyota,Mazda',          description:'Aluminium core 3-row radiator. OUT OF STOCK.'},
  ];
}


const fmtKsh = n => 'Ksh ' + Number(n).toLocaleString('en-KE', {minimumFractionDigits:0});

function makeToken(u) {
  return jwt.sign({id:u.id, email:u.email, role:u.role, name:u.name}, JWT_SECRET, {expiresIn:'7d'});
}

function nextInvNo() {
  DB.seq.invNo++;
  const prefix = `INV-${new Date().toISOString().slice(0,7).replace('-','')}-`;
  return `${prefix}${String(DB.seq.invNo).padStart(6,'0')}`;
}

function getUserSummary(clientId) {
  const appointments = DB.appointments.filter(a => a.client_id === clientId)
    .sort((a,b) => b.appointment_date.localeCompare(a.appointment_date))
    .map(a => {
      const report = DB.repairs.find(r => r.appointment_id === a.id);
      return {...a, report_id: report?.id||null, diagnosis: report?.diagnosis||null, total_cost: report?.total_cost||null, payment_status: report?.payment_status||null};
    });
  const repairs   = DB.repairs.filter(r => r.client_id === clientId).sort((a,b)=>b.resolved_at.localeCompare(a.resolved_at));
  const payments  = DB.payments.filter(p => p.client_id === clientId).sort((a,b)=>b.paid_at.localeCompare(a.paid_at));
  const invoices  = DB.invoices.filter(i => i.client_id === clientId).sort((a,b)=>b.issued_at.localeCompare(a.issued_at));
  const today     = new Date().toISOString().slice(0,10);
  const upcoming  = appointments.filter(a => a.status==='scheduled' && a.appointment_date>=today);
  const totalSpent = payments.reduce((s,p) => s+parseFloat(p.amount||0), 0);
  return {
    stats: {
      total_visits: appointments.length, upcoming_appts: upcoming.length,
      total_spent: totalSpent, total_spent_fmt: fmtKsh(totalSpent),
      cars_bought:  payments.filter(p=>p.payment_type==='car_sale').length,
      parts_bought: payments.filter(p=>p.payment_type==='part_order').length,
      repairs_done: repairs.length, invoices_count: invoices.length,
    },
    appointments, repairs, payments, invoices, upcoming,
  };
}


const auth = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({error:'Please sign in to continue.'});
  try { req.user = jwt.verify(h.split(' ')[1], JWT_SECRET); next(); }
  catch(e) { res.status(401).json({error: e.name==='TokenExpiredError'?'Session expired. Please sign in again.':'Invalid session.'}); }
};
const adminOnly = (req,res,next) => req.user?.role==='admin' ? next() : res.status(403).json({error:'Admin only.'});
const go = fn => async(req,res,next) => {
  try { await fn(req,res,next); }
  catch(e) { console.error(`[${req.method} ${req.path}]`, e.message); if(!res.headersSent) res.status(500).json({error:e.message||'Server error.'}); }
};



app.get('/api/status', (req,res) => res.json({server:'online', db:'json-file', version:'3.0.0', clients: DB.clients.length}));


app.post('/api/auth/check-email', go(async(req,res) => {
  const email = (req.body?.email||'').toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({error:'Please enter a valid email address.'});
  const client = DB.clients.find(c => c.email===email);
  if (client) return res.json({exists:true, name:client.name, message:`Welcome back, ${client.name.split(' ')[0]}!`});
  res.json({exists:false, message:'No account found. Create one to get started.'});
}));


app.post('/api/auth/register', go(async(req,res) => {
  const {name, email:rawEmail, password, phone} = req.body||{};
  const email = (rawEmail||'').toLowerCase().trim();
  if (!name?.trim())   return res.status(400).json({error:'Full name is required.'});
  if (!email)          return res.status(400).json({error:'Email is required.'});
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:'Invalid email address.'});
  if (!password || password.length<6) return res.status(400).json({error:'Password must be at least 6 characters.'});
  if (DB.clients.find(c=>c.email===email)) return res.status(409).json({error:'An account with that email already exists.', exists:true});

  const id     = nextId('clients');
  const client = {id, name:name.trim(), email, password:await bcrypt.hash(password,10), phone:phone||null, role:'client', created_at:new Date().toISOString()};
  DB.clients.push(client); saveDB();
  res.status(201).json({token:makeToken(client), user:{id,name:client.name,email,phone:client.phone,role:'client',created_at:client.created_at}, summary:getUserSummary(id)});
}));


app.post('/api/auth/login', go(async(req,res) => {
  const email = (req.body?.email||'').toLowerCase().trim();
  const pass  = req.body?.password||'';
  if (!email||!pass) return res.status(400).json({error:'Email and password are required.'});
  const client = DB.clients.find(c=>c.email===email);
  if (!client)   return res.status(401).json({error:'No account found with that email.', no_account:true});
  if (!await bcrypt.compare(pass, client.password)) return res.status(401).json({error:'Incorrect password. Please try again.'});
  res.json({token:makeToken(client), user:{id:client.id,name:client.name,email:client.email,phone:client.phone,role:client.role,created_at:client.created_at}, summary:getUserSummary(client.id)});
}));


app.get('/api/dashboard', auth, go(async(req,res) => {
  const client = DB.clients.find(c=>c.id===req.user.id);
  if (!client) return res.status(404).json({error:'Account not found.'});
  res.json({user:{id:client.id,name:client.name,email:client.email,phone:client.phone,role:client.role,created_at:client.created_at}, summary:getUserSummary(client.id)});
}));

app.put('/api/dashboard/profile', auth, go(async(req,res) => {
  const {name,phone} = req.body||{};
  if (!name?.trim()) return res.status(400).json({error:'Name is required.'});
  const c = DB.clients.find(c=>c.id===req.user.id);
  if (c) { c.name=name.trim(); c.phone=phone||null; saveDB(); }
  res.json({message:'Profile updated.', name:name.trim(), phone:phone||null});
}));

app.put('/api/dashboard/change-password', auth, go(async(req,res) => {
  const {current_password, new_password} = req.body||{};
  if (!current_password||!new_password) return res.status(400).json({error:'Both passwords required.'});
  if (new_password.length<6) return res.status(400).json({error:'New password must be at least 6 characters.'});
  const c = DB.clients.find(c=>c.id===req.user.id);
  if (!await bcrypt.compare(current_password, c.password)) return res.status(401).json({error:'Current password is incorrect.'});
  c.password = await bcrypt.hash(new_password, 10); saveDB();
  res.json({message:'Password changed successfully.'});
}));


app.post('/api/auth/forgot-password', go(async(req,res) => {
  const email = (req.body?.email||'').toLowerCase().trim();
  if (!email) return res.status(400).json({error:'Email is required.'});
  const client = DB.clients.find(c=>c.email===email);
  if (!client) return res.json({message:'If that email is registered, a reset link has been sent.'});
  const token   = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now()+3600000).toISOString();
  DB.resets = DB.resets.filter(r=>r.email!==email);
  DB.resets.push({email, token, expires, used:false}); saveDB();
  const resetUrl = `http://localhost:${PORT}/reset-password.html?token=${token}`;
  console.log(`\n📧  Password reset for ${email}:\n   ${resetUrl}\n`);
  res.json({message:'Reset link sent (check server console).', dev_reset_url:resetUrl});
}));

app.post('/api/auth/reset-password', go(async(req,res) => {
  const {token, password} = req.body||{};
  if (!token||!password) return res.status(400).json({error:'Token and new password are required.'});
  if (password.length<6) return res.status(400).json({error:'Password must be at least 6 characters.'});
  const reset = DB.resets.find(r=>r.token===token && !r.used && new Date(r.expires)>new Date());
  if (!reset) return res.status(400).json({error:'Reset link is invalid or has expired.'});
  const c = DB.clients.find(c=>c.email===reset.email);
  if (c) { c.password = await bcrypt.hash(password,10); }
  reset.used = true; saveDB();
  res.json({message:'Password updated. You can now sign in.'});
}));

app.get('/api/auth/verify-reset-token', go(async(req,res) => {
  const reset = DB.resets.find(r=>r.token===req.query.token&&!r.used&&new Date(r.expires)>new Date());
  if (!reset) return res.status(400).json({valid:false, error:'Token is invalid or expired.'});
  res.json({valid:true, email:reset.email});
}));


app.get('/api/cars', go(async(req,res) => {
  let cars = [...DB.cars];
  const {make,model,min_price,max_price,year,fuel,body,drive} = req.query;
  if (make)      cars = cars.filter(c=>c.make.toLowerCase().includes(make.toLowerCase()));
  if (model)     cars = cars.filter(c=>c.model.toLowerCase().includes(model.toLowerCase()));
  if (min_price) cars = cars.filter(c=>c.price>=parseFloat(min_price));
  if (max_price) cars = cars.filter(c=>c.price<=parseFloat(max_price));
  if (year)      cars = cars.filter(c=>c.year==year);
  if (fuel)      cars = cars.filter(c=>(c.fuel_type||'').toLowerCase().includes(fuel.toLowerCase()));
  if (body)      cars = cars.filter(c=>(c.body||c.body_type||'').toLowerCase().includes(body.toLowerCase()));
  if (drive)     cars = cars.filter(c=>(c.drive||c.drive_type||'').toLowerCase().includes(drive.toLowerCase()));
  cars.sort((a,b)=>a.status.localeCompare(b.status)||a.id-b.id);
  res.json(cars);
}));


app.get('/api/parts', go(async(req,res) => {
  res.json([...DB.parts].sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name)));
}));


app.get('/api/appointments/slots', go(async(req,res) => {
  const {date} = req.query;
  if (!date) return res.status(400).json({error:'Date is required.'});
  const all   = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];
  const taken = DB.appointments.filter(a=>a.appointment_date===date&&a.status!=='cancelled').map(a=>a.time_slot);
  res.json(all.map(s=>({slot:s, available:!taken.includes(s)})));
}));

app.post('/api/appointments', auth, go(async(req,res) => {
  const {appointment_date,time_slot,service_type,car_make,car_model,car_year,car_plate,notes} = req.body||{};
  if (!appointment_date||!time_slot||!service_type) return res.status(400).json({error:'Date, time and service type are required.'});
  const plate = (car_plate||'').trim().toUpperCase();
  const conflict = DB.appointments.find(a=>a.appointment_date===appointment_date&&a.time_slot===time_slot&&a.status!=='cancelled');
  if (conflict) return res.status(409).json({error:'That time slot is already booked. Choose another.'});
  const priorRepairs = plate ? DB.repairs.filter(r=>r.car_plate===plate) : [];
  const id = nextId('appointments');
  DB.appointments.push({id, client_id:req.user.id, appointment_date, time_slot, service_type, car_make:car_make||null, car_model:car_model||null, car_year:car_year||null, car_plate:plate||null, notes:notes||null, status:'scheduled', created_at:new Date().toISOString()});
  saveDB();
  res.status(201).json({id, message:'Appointment booked.', prior_visits:priorRepairs.length, repair_history:priorRepairs});
}));

app.get('/api/appointments/my', auth, go(async(req,res) => {
  const appts = DB.appointments.filter(a=>a.client_id===req.user.id)
    .sort((a,b)=>b.appointment_date.localeCompare(a.appointment_date))
    .map(a=>{
      const r = DB.repairs.find(r=>r.appointment_id===a.id);
      return {...a, report_id:r?.id||null, diagnosis:r?.diagnosis||null, total_cost:r?.total_cost||null, payment_status:r?.payment_status||null};
    });
  res.json(appts);
}));


app.get('/api/repairs/history', auth, go(async(req,res) => {
  const repairs = DB.repairs.filter(r=>r.client_id===req.user.id)
    .sort((a,b)=>b.resolved_at.localeCompare(a.resolved_at))
    .map(r=>{
      const a = DB.appointments.find(a=>a.id===r.appointment_id);
      return {...r, appointment_date:a?.appointment_date||null, service_type:a?.service_type||null, car_make:a?.car_make||null, car_model:a?.car_model||null, car_plate:a?.car_plate||null};
    });
  res.json(repairs);
}));

app.get('/api/repairs/plate/:plate', auth, go(async(req,res) => {
  const plate = req.params.plate.toUpperCase();
  const history = DB.repairs.filter(r=>r.car_plate===plate).sort((a,b)=>b.resolved_at.localeCompare(a.resolved_at));
  res.json({plate, count:history.length, history});
}));

app.post('/api/repairs/report', auth, adminOnly, go(async(req,res) => {
  const {appointment_id,diagnosis,parts_used,labor_hours,total_cost,mechanic_notes} = req.body||{};
  if (!diagnosis||!total_cost) return res.status(400).json({error:'Diagnosis and cost are required.'});
  let client_id=req.user.id, car_plate=null;
  if (appointment_id) {
    const a = DB.appointments.find(a=>a.id==appointment_id);
    if (a) { client_id=a.client_id; car_plate=a.car_plate; a.status='completed'; }
  }
  const id = nextId('repairs');
  DB.repairs.push({id, appointment_id:appointment_id||null, client_id, car_plate:car_plate||null, diagnosis, parts_used:parts_used||[], labor_hours:labor_hours||0, total_cost, mechanic_notes:mechanic_notes||null, payment_status:'unpaid', resolved_at:new Date().toISOString()});
  saveDB();
  res.status(201).json({id, message:'Report created.'});
}));

/*Payments  */
function createInvoice(clientId, paymentId, type, refId, lineItems, amount) {
  const invNo    = nextInvNo();
  const sub      = amount/1.16, tax = amount-sub;
  const client   = DB.clients.find(c=>c.id===clientId)||{};
  const id       = nextId('invoices');
  DB.invoices.push({id, invoice_number:invNo, client_id:clientId, payment_id:paymentId, invoice_type:type, reference_id:refId, line_items:lineItems, subtotal:sub.toFixed(2), tax_rate:16, tax_amount:tax.toFixed(2), total_amount:amount.toFixed(2), status:'paid', issued_at:new Date().toISOString()});
  saveDB();
  return {id, invoice_number:invNo, client:{name:client.name,email:client.email,phone:client.phone}, line_items:lineItems, subtotal:sub.toFixed(2), tax_amount:tax.toFixed(2), total_amount:amount.toFixed(2), issued_at:new Date().toISOString()};
}

app.post('/api/payments/car', auth, go(async(req,res) => {
  const {car_id,method,mpesa_code} = req.body||{};
  if (!car_id||!method) return res.status(400).json({error:'Car ID and payment method are required.'});
  if (method==='mpesa'&&!mpesa_code) return res.status(400).json({error:'M-Pesa code is required.'});
  const car = DB.cars.find(c=>c.id==car_id);
  if (!car)                               return res.status(404).json({error:'Car not found.'});
  if (car.quantity<1||car.status==='sold_out') return res.status(400).json({error:'This car is no longer available.'});
  const amount = parseFloat(car.price);
  const payId  = nextId('payments');
  DB.payments.push({id:payId, client_id:req.user.id, payment_type:'car_sale', reference_id:car.id, amount, method, mpesa_code:mpesa_code||null, status:'completed', paid_at:new Date().toISOString()});
  car.quantity--; if(car.quantity<=0) car.status='sold_out'; saveDB();
  const items  = [{description:`${car.make} ${car.model} ${car.year}${car.color?` (${car.color})`:''}`, qty:1, unit_price:(amount/1.16).toFixed(2), total:(amount/1.16).toFixed(2)}];
  const invoice= createInvoice(req.user.id, payId, 'car_sale', car.id, items, amount);
  res.status(201).json({payment_id:payId, amount, method, invoice, inventory:{remaining:car.quantity}});
}));

app.post('/api/payments/mpesa/initiate', auth, go(async(req,res) => {
  const { payment_type, reference_id, quantity, phone } = req.body||{};
  if (!payment_type||!reference_id) return res.status(400).json({error:'Payment type and reference ID are required.'});
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_PASSKEY) {
    return res.status(500).json({error:'M-Pesa credentials are not configured. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, and MPESA_PASSKEY.'});
  }
  const client = DB.clients.find(c=>c.id===req.user.id);
  if (!client) return res.status(404).json({error:'Client not found.'});
  const customerPhone = formatMpesaPhone(phone || client.phone || '');
  if (!/^2547\d{8}$/.test(customerPhone)) return res.status(400).json({error:'A valid Kenyan phone number is required for M-Pesa.'});

  let amount, description, accountReference, itemCount = 1;
  if (payment_type === 'car_sale') {
    const car = DB.cars.find(c=>c.id==reference_id);
    if (!car) return res.status(404).json({error:'Car not found.'});
    if (car.quantity<1||car.status==='sold_out') return res.status(400).json({error:'This car is no longer available.'});
    amount = parseFloat(car.price);
    description = `Car purchase: ${car.make} ${car.model}`;
    accountReference = `CAR${car.id}`;
  } else if (payment_type === 'part_order') {
    const part = DB.parts.find(p=>p.id==reference_id);
    if (!part) return res.status(404).json({error:'Part not found.'});
    const qty = parseInt(quantity) || 1;
    if (part.stock < qty) return res.status(400).json({error:`Only ${part.stock} units are available.`});
    amount = Number(part.price) * qty;
    description = `Part purchase: ${part.name} ×${qty}`;
    accountReference = `PART${part.id}`;
    itemCount = qty;
  } else if (payment_type === 'repair') {
    const report = DB.repairs.find(r=>r.id==reference_id && r.client_id===req.user.id);
    if (!report) return res.status(404).json({error:'Repair report not found.'});
    if (report.payment_status==='paid') return res.status(400).json({error:'Repair is already paid.'});
    amount = parseFloat(report.total_cost);
    description = `Repair payment: ${report.diagnosis}`;
    accountReference = `REPAIR${report.id}`;
  } else {
    return res.status(400).json({error:'Invalid payment type.'});
  }

  const timestamp = new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
  const token = await getMpesaAccessToken();
  const callbackUrl = MPESA_CALLBACK_URL || `${req.protocol}://${req.get('host')}/api/payments/mpesa/callback`;

  const payload = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: customerPhone,
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: customerPhone,
    CallBackURL: callbackUrl,
    AccountReference: accountReference,
    TransactionDesc: description,
  };

  const result = await darajaRequest('POST', MPESA_STK_PUSH_PATH, payload, `Bearer ${token}`);
  if (!result.CheckoutRequestID || result.ResponseCode !== '0') {
    const errorMsg = result?.errorMessage || result?.error || result?.ResponseDescription || result?.message || 'M-Pesa STK Push failed.';
    console.error('[Daraja STK Push] failure', errorMsg, result);
    return res.status(500).json({error:`M-Pesa STK Push failed: ${errorMsg}`, details: result});
  }

  const payId = nextId('payments');
  DB.payments.push({
    id: payId,
    client_id: req.user.id,
    payment_type,
    reference_id,
    quantity: itemCount,
    amount,
    method: 'mpesa',
    status: 'pending',
    mpesa_phone: customerPhone,
    merchant_request_id: result.MerchantRequestID,
    checkout_request_id: result.CheckoutRequestID,
    created_at: new Date().toISOString(),
    stk_message: result.CustomerMessage || null,
  });
  saveDB();

  res.json({message:'STK Push sent. Complete payment on your phone.', checkout_request_id: result.CheckoutRequestID, merchant_request_id: result.MerchantRequestID, customer_message: result.CustomerMessage, payment_id: payId});
}));

app.post('/api/payments/mpesa/callback', go(async(req,res) => {
  const callback = req.body || {};
  const stk = callback.Body?.stkCallback;
  if (!stk) return res.status(400).json({error:'Invalid M-Pesa callback payload.'});

  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stk;
  const record = DB.payments.find(p => p.checkout_request_id === CheckoutRequestID || p.merchant_request_id === MerchantRequestID);
  if (!record) {
    return res.status(404).json({error:'Pending M-Pesa payment not found.'});
  }

  record.result_code = ResultCode;
  record.result_desc = ResultDesc;
  record.callback_payload = callback;

  if (ResultCode !== 0) {
    record.status = 'failed';
    saveDB();
    return res.json({status:'failed', detail:ResultDesc});
  }

  const metadata = Array.isArray(CallbackMetadata?.Item) ? CallbackMetadata.Item : [];
  const receipt = metadata.find(i => i.Name === 'MpesaReceiptNumber')?.Value || null;
  const amount = parseFloat(metadata.find(i => i.Name === 'Amount')?.Value || record.amount || 0);
  const phone = metadata.find(i => i.Name === 'PhoneNumber')?.Value || record.mpesa_phone;

  record.status = 'completed';
  record.paid_at = new Date().toISOString();
  record.mpesa_code = receipt;
  record.mpesa_phone = phone;

  if (record.payment_type === 'car_sale') {
    const car = DB.cars.find(c => c.id == record.reference_id);
    if (car) {
      car.quantity = Math.max(0, (car.quantity - 1));
      if (car.quantity === 0) car.status = 'sold_out';
    }
  }

  if (record.payment_type === 'part_order') {
    const part = DB.parts.find(p => p.id == record.reference_id);
    if (part) {
      part.stock = Math.max(0, part.stock - (record.quantity || 1));
    }
  }

  if (record.payment_type === 'repair') {
    const report = DB.repairs.find(r => r.id == record.reference_id);
    if (report) report.payment_status = 'paid';
  }

  const invoiceItems = [];
  if (record.payment_type === 'car_sale') {
    const car = DB.cars.find(c => c.id == record.reference_id) || {};
    invoiceItems.push({description:`${car.make||'Vehicle'} ${car.model||''} ${car.year||''}`.trim(), qty:1, unit_price:(amount/1.16).toFixed(2), total:(amount/1.16).toFixed(2)});
  } else if (record.payment_type === 'part_order') {
    const part = DB.parts.find(p => p.id == record.reference_id) || {};
    const qty = record.quantity || 1;
    invoiceItems.push({description:`${part.name||'Part'} ×${qty}`.trim(), qty, unit_price:(parseFloat(part.price)||0).toFixed(2), total:((parseFloat(part.price)||0)*qty).toFixed(2)});
  } else if (record.payment_type === 'repair') {
    const report = DB.repairs.find(r => r.id == record.reference_id) || {};
    invoiceItems.push({description:`Repair — ${report.diagnosis||'Service'}`, qty:1, unit_price:(amount/1.16).toFixed(2), total:(amount/1.16).toFixed(2)});
  }

  const invoice = createInvoice(record.client_id, record.id, record.payment_type, record.reference_id, invoiceItems, amount);
  record.invoice_id = invoice.id;
  record.invoice_number = invoice.invoice_number;
  saveDB();

  res.json({status:'completed', invoice_number: invoice.invoice_number});
}));

app.get('/api/payments/mpesa/status/:checkout_request_id', auth, go(async(req,res) => {
  const payment = DB.payments.find(p => p.checkout_request_id === req.params.checkout_request_id || String(p.id) === req.params.checkout_request_id);
  if (!payment) return res.status(404).json({error:'Payment request not found.'});
  const invoice = payment.invoice_id ? DB.invoices.find(i => i.id === payment.invoice_id) : null;
  res.json({
    status: payment.status,
    checkout_request_id: payment.checkout_request_id,
    merchant_request_id: payment.merchant_request_id,
    mpesa_code: payment.mpesa_code,
    paid_at: payment.paid_at,
    result_desc: payment.result_desc,
    invoice: invoice ? formatInvoice(invoice) : null,
  });
}));

app.post('/api/payments/parts', auth, go(async(req,res) => {
  const {part_id,quantity,method,mpesa_code} = req.body||{};
  if (!part_id||!method) return res.status(400).json({error:'Part ID and payment method are required.'});
  if (method==='mpesa'&&!mpesa_code) return res.status(400).json({error:'M-Pesa code is required.'});
  const qty  = parseInt(quantity)||1;
  const part = DB.parts.find(p=>p.id==part_id);
  if (!part)          return res.status(404).json({error:'Part not found.'});
  if (part.stock<qty) return res.status(400).json({error:`Only ${part.stock} in stock.`});
  const amount = parseFloat(part.price)*qty;
  const payId  = nextId('payments');
  DB.payments.push({id:payId, client_id:req.user.id, payment_type:'part_order', reference_id:part.id, amount, method, mpesa_code:mpesa_code||null, status:'completed', paid_at:new Date().toISOString()});
  part.stock-=qty; saveDB();
  const items  = [{description:`${part.name} ×${qty}`, qty, unit_price:part.price, total:amount}];
  const invoice= createInvoice(req.user.id, payId, 'part_order', part.id, items, amount);
  res.status(201).json({payment_id:payId, amount, method, invoice, inventory:{remaining:part.stock}});
}));

app.post('/api/payments/repair', auth, go(async(req,res) => {
  const {repair_report_id,method,mpesa_code} = req.body||{};
  if (!repair_report_id||!method) return res.status(400).json({error:'Repair ID and method are required.'});
  if (method==='mpesa'&&!mpesa_code) return res.status(400).json({error:'M-Pesa code is required.'});
  const report = DB.repairs.find(r=>r.id==repair_report_id&&r.client_id===req.user.id);
  if (!report)                     return res.status(404).json({error:'Repair report not found.'});
  if (report.payment_status==='paid') return res.status(400).json({error:'Already paid.'});
  const amount = parseFloat(report.total_cost);
  const payId  = nextId('payments');
  DB.payments.push({id:payId, client_id:req.user.id, payment_type:'repair', reference_id:report.id, amount, method, mpesa_code:mpesa_code||null, status:'completed', paid_at:new Date().toISOString()});
  report.payment_status='paid'; saveDB();
  const items  = [{description:`Repair — ${report.diagnosis}`, qty:1, unit_price:(amount/1.16).toFixed(2), total:(amount/1.16).toFixed(2)}];
  const invoice= createInvoice(req.user.id, payId, 'repair', report.id, items, amount);
  res.status(201).json({payment_id:payId, amount, method, invoice});
}));


function formatInvoice(invoice) {
  const payment = DB.payments.find(p => p.id === invoice.payment_id) || {};
  const client  = DB.clients.find(c => c.id === invoice.client_id) || {};
  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    invoice_type: invoice.invoice_type,
    reference_id: invoice.reference_id,
    line_items: invoice.line_items,
    subtotal: invoice.subtotal,
    tax_rate: invoice.tax_rate,
    tax_amount: invoice.tax_amount,
    total_amount: invoice.total_amount,
    status: invoice.status,
    issued_at: invoice.issued_at,
    method: payment.method || null,
    payment_status: payment.status || null,
    mpesa_code: payment.mpesa_code || null,
    client_name: client.name || null,
    client_email: client.email || null,
    client_phone: client.phone || null,
  };
}

app.get('/api/invoices/my', auth, go(async(req,res) => {
  const invoices = DB.invoices.filter(i => i.client_id === req.user.id)
    .sort((a,b) => b.issued_at.localeCompare(a.issued_at))
    .map(formatInvoice);
  res.json(invoices);
}));

app.get('/api/invoices/:id', auth, go(async(req,res) => {
  const invoice = DB.invoices.find(i => i.id == req.params.id);
  if (!invoice || invoice.client_id !== req.user.id) return res.status(404).json({error:'Invoice not found.'});
  res.json(formatInvoice(invoice));
}));

app.get('/api/repairs/report/:id', auth, go(async(req,res) => {
  const report = DB.repairs.find(r => r.id == req.params.id);
  if (!report) return res.status(404).json({error:'Report not found.'});
  if (report.client_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({error:'Access denied.'});
  const appointment = DB.appointments.find(a => a.id === report.appointment_id) || {};
  res.json({
    ...report,
    appointment_date: appointment.appointment_date || null,
    service_type: appointment.service_type || null,
    car_make: appointment.car_make || null,
    car_model: appointment.car_model || null,
  });
}));

app.get('/api/admin/stats', auth, adminOnly, go(async(req,res) => {
  res.json({
    clients:      DB.clients.filter(c=>c.role==='client').length,
    cars:         DB.cars.length,
    cars_sold:    DB.cars.filter(c=>c.status==='sold_out').length,
    appointments: DB.appointments.length,
    revenue:      DB.payments.reduce((s,p)=>s+parseFloat(p.amount||0),0),
    unpaid:       DB.repairs.filter(r=>r.payment_status==='unpaid').length,
  });
}));

app.get('/api/admin/reports/summary', auth, adminOnly, go(async(req,res) => {
  const invoices = DB.invoices.map(formatInvoice).sort((a,b)=>b.issued_at.localeCompare(a.issued_at));
  const repairs  = DB.repairs.sort((a,b)=>b.resolved_at.localeCompare(a.resolved_at)).map(r => {
    const appointment = DB.appointments.find(a => a.id === r.appointment_id) || {};
    const client      = DB.clients.find(c => c.id === r.client_id) || {};
    return {
      id: r.id,
      appointment_id: r.appointment_id,
      appointment_date: appointment.appointment_date || null,
      service_type: appointment.service_type || null,
      car_plate: r.car_plate || appointment.car_plate || null,
      car_make: appointment.car_make || null,
      car_model: appointment.car_model || null,
      diagnosis: r.diagnosis,
      total_cost: r.total_cost,
      payment_status: r.payment_status,
      client_name: client.name || null,
      client_email: client.email || null,
      client_phone: client.phone || null,
      resolved_at: r.resolved_at,
    };
  });
  const monthlyRevenue = Object.entries(DB.payments.reduce((acc,p) => {
    const month = p.paid_at ? p.paid_at.slice(0,7) : 'unknown';
    acc[month] = (acc[month] || 0) + parseFloat(p.amount || 0);
    return acc;
  }, {})).sort(([a],[b]) => b.localeCompare(a)).map(([month, value]) => ({ month, revenue: value }));

  res.json({
    clients_count: DB.clients.filter(c=>c.role==='client').length,
    cars_count: DB.cars.length,
    cars_sold: DB.cars.filter(c=>c.status==='sold_out').length,
    appointments_count: DB.appointments.length,
    revenue: DB.payments.reduce((s,p)=>s+parseFloat(p.amount||0),0),
    unpaid_repairs: DB.repairs.filter(r=>r.payment_status==='unpaid').length,
    paid_repairs: DB.repairs.filter(r=>r.payment_status==='paid').length,
    invoices_count: DB.invoices.length,
    recent_invoices: invoices.slice(0, 12),
    recent_repairs: repairs.slice(0, 12),
    monthly_revenue: monthlyRevenue.slice(0, 6),
  });
}));

app.get('/api/admin/clients', auth, adminOnly, go(async(req,res) => {
  res.json(DB.clients.map(c=>({id:c.id,name:c.name,email:c.email,phone:c.phone,role:c.role,created_at:c.created_at})));
}));

/* 404 & SPA fallback  */
app.use('/api/*', (req,res) => res.status(404).json({error:`Not found: ${req.method} ${req.path}`}));
app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.use((err,req,res,_n) => { if(!res.headersSent) res.status(500).json({error:err.message}); });

/* Start  */
loadDB();
app.listen(PORT, () => {
  console.log(`\n🚗  Brisa Motors v3`);
  console.log(`   URL:    http://localhost:${PORT}`);
  console.log(`   DB:     ${DATA_FILE}`);
  console.log(`   Admin:  admin@brisamotors.co.ke  /  Admin@1234\n`);
});