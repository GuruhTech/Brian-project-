-- ══════════════════════════════════════════════════════════════════
--  BRISA MOTORS v3 — Full MySQL Schema  (updated)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS clients (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  phone      VARCHAR(20)  DEFAULT NULL,
  role       ENUM('client','admin') NOT NULL DEFAULT 'client',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Admin password: Admin@1234
INSERT IGNORE INTO clients (name, email, password, role) VALUES
('Admin','admin@carplatform.com','$2a$10$xk3.yjP1KREBtaVYSZm/rOfQv6pDHa.cG3vE3YPRdH0pNEVB0Pj4O','admin');

CREATE TABLE IF NOT EXISTS password_resets (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(150) NOT NULL,
  token      VARCHAR(100) NOT NULL UNIQUE,
  expires_at TIMESTAMP    NOT NULL,
  used       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cars (
  id            INT            AUTO_INCREMENT PRIMARY KEY,
  make          VARCHAR(80)    NOT NULL,
  model         VARCHAR(80)    NOT NULL,
  year          YEAR           NOT NULL,
  price         DECIMAL(12,2)  NOT NULL,
  mileage       INT            DEFAULT 0,
  color         VARCHAR(50)    DEFAULT NULL,
  engine        VARCHAR(100)   DEFAULT NULL,
  transmission  ENUM('manual','automatic','cvt') DEFAULT 'manual',
  description   TEXT,
  images        JSON,
  quantity      INT            NOT NULL DEFAULT 1,
  status        ENUM('available','reserved','sold_out') NOT NULL DEFAULT 'available',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO cars (id,make,model,year,price,mileage,color,engine,transmission,quantity,status,description,images) VALUES
(1, 'Toyota','Corolla',    2020,1850000, 42000,'White',       '1.8L VVT-i',            'automatic',2,'available','Well maintained, full service history. One owner.','["IMGS/car22.jpg"]'),
(2, 'Toyota','Hilux',      2019,3200000, 65000,'Silver',      '2.4L Diesel Turbo',     'manual',   1,'available','4x4 Double cab, tow bar fitted, excellent condition.','["IMGS/hilux.jpg"]'),
(3, 'Mazda','CX-5',        2021,2700000, 28000,'Deep Blue',   '2.5L Skyactiv-G',       'automatic',1,'available','Excellent condition. Sunroof, leather interior.','["IMGS/mazda.jpg"]'),
(4, 'Kawasaki','ninja sport',      2018,3500000, 55000,'green',       '2.0L TwinPower Turbo',  'manual',1,'available','navigation panel, leather seats, head-up display, well serviced.','["IMGS/kawasaki.jpg"]'),
(5, 'Subaru','Forester',   2020,2100000, 38000,'White',       '2.0L DOHC AWD',         'automatic',0,'sold_out', 'AWD, very clean — SOLD.','["IMGS/subaru.jpg"]'),
(6, 'Mercedes','C-Class',  2019,4200000, 48000,'Obsidian Black','2.0L EQ Boost',       'automatic',1,'available','AMG line, panoramic roof, Burmester sound system.','["IMGS/sclass.jpg"]'),
(7, 'Honda','CR-V',        2022,3100000, 18000,'Lunar Silver', '1.5L VTEC Turbo',      'automatic',2,'available','Latest model. Honda Sensing safety suite. Like new.','["IMGS/car7.jpg"]'),
(8, 'Nissan','X-Trail',    2021,2650000, 32000,'Pearl White',  '2.5L Naturally Aspirated','automatic',1,'available','7-seater, 4x4, ProPILOT assist. Low mileage.','["IMGS/car8.jpg"]'),
(9, 'Land Rover','Discovery',2020,5800000,44000,'Corris Grey', '3.0L SD6 Diesel',      'automatic',1,'available','Full spec, 7-seater, adaptive dynamics, very capable.','["IMGS/rover.jpg"]'),
(10,'Audi','Q5',           2021,4500000, 26000,'Glacier White','2.0L TFSI Quattro',    'automatic',1,'available','Quattro AWD, virtual cockpit, B&O sound. Immaculate.','["IMGS/car4.jpg"]'),
(11,'Kia','Sportage',      2022,2400000, 15000,'Runway Red',   '1.6L T-GDi',           'automatic',2,'available','Smart sense safety, wireless carplay. Nearly new.','["IMGS/kia.jpg"]'),
(12,'Volkswagen','Tiguan', 2021,3800000, 34000,'Deep Black',   '2.0L TSI 4MOTION',     'automatic',1,'available','4Motion AWD, panoramic sunroof, digital cockpit.','["IMGS/tiguan.jpg"]');

CREATE TABLE IF NOT EXISTS car_inquiries (
  id         INT  AUTO_INCREMENT PRIMARY KEY,
  car_id     INT  NOT NULL,
  client_id  INT  NOT NULL,
  message    TEXT,
  status     ENUM('new','contacted','closed') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (car_id)    REFERENCES cars(id)    ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS spare_parts (
  id               INT           AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(150)  NOT NULL,
  part_number      VARCHAR(80)   UNIQUE,
  category         VARCHAR(80),
  price            DECIMAL(10,2) NOT NULL,
  stock            INT           NOT NULL DEFAULT 0,
  compatible_makes TEXT,
  description      TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO spare_parts (id,name,part_number,category,price,stock,compatible_makes,description) VALUES
(1,'Oil Filter',        'OF-001','Engine',     1500, 50,'Toyota,Honda,Mazda',           'Standard spin-on oil filter, fits most Japanese models.'),
(2,'Brake Pads (Front)','BP-F02','Brakes',     4500, 30,'Toyota,Subaru',                'Ceramic compound, low dust, quiet operation.'),
(3,'Air Filter',        'AF-003','Engine',     2200, 40,'Toyota,Honda,Nissan',           'Paper element filter. OEM equivalent quality.'),
(4,'Alternator Belt',   'AB-004','Electrical', 3800, 20,'Toyota,Mazda',                 'Reinforced V-belt, 100,000 km life.'),
(5,'Shock Absorber',    'SA-005','Suspension', 12000,15,'Toyota,Honda',                 'Gas-charged front absorber. Sold individually.'),
(6,'Radiator',          'RD-006','Cooling',    15000, 0,'Toyota,Mazda',                 'Aluminium core 3-row. Currently out of stock.');

CREATE TABLE IF NOT EXISTS part_orders (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  part_id          INT NOT NULL,
  client_id        INT NOT NULL,
  quantity         INT NOT NULL DEFAULT 1,
  unit_price       DECIMAL(10,2) NOT NULL,
  total_price      DECIMAL(10,2) NOT NULL,
  delivery_address TEXT,
  status           ENUM('pending','confirmed','shipped','delivered','cancelled') DEFAULT 'pending',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (part_id)   REFERENCES spare_parts(id) ON DELETE RESTRICT,
  FOREIGN KEY (client_id) REFERENCES clients(id)     ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointments (
  id               INT  AUTO_INCREMENT PRIMARY KEY,
  client_id        INT  NOT NULL,
  appointment_date DATE NOT NULL,
  time_slot        TIME NOT NULL,
  service_type     ENUM('repair','maintenance','inspection','diagnostic','other') NOT NULL,
  car_make         VARCHAR(80),
  car_model        VARCHAR(80),
  car_year         YEAR,
  car_plate        VARCHAR(20),
  notes            TEXT,
  status           ENUM('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS repair_reports (
  id             INT           AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT           NOT NULL UNIQUE,
  client_id      INT           NOT NULL,
  car_plate      VARCHAR(20)   NOT NULL,
  diagnosis      TEXT          NOT NULL,
  parts_used     JSON,
  labor_hours    DECIMAL(5,2)  DEFAULT 0,
  total_cost     DECIMAL(10,2) NOT NULL,
  mechanic_notes TEXT,
  payment_status ENUM('unpaid','paid') DEFAULT 'unpaid',
  resolved_at    TIMESTAMP,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id)      REFERENCES clients(id)      ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id              INT           AUTO_INCREMENT PRIMARY KEY,
  client_id       INT           NOT NULL,
  payment_type    ENUM('repair','car_sale','part_order') NOT NULL,
  reference_id    INT           NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  method          ENUM('mpesa','cash','bank_transfer','card') NOT NULL,
  mpesa_code      VARCHAR(20),
  status          ENUM('pending','completed','failed','refunded') DEFAULT 'pending',
  paid_at         TIMESTAMP,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoices (
  id              INT           AUTO_INCREMENT PRIMARY KEY,
  invoice_number  VARCHAR(30)   NOT NULL UNIQUE,
  client_id       INT           NOT NULL,
  payment_id      INT           NOT NULL UNIQUE,
  invoice_type    ENUM('repair','car_sale','part_order') NOT NULL,
  reference_id    INT           NOT NULL,
  line_items      JSON          NOT NULL,
  subtotal        DECIMAL(12,2) NOT NULL,
  tax_rate        DECIMAL(5,2)  DEFAULT 16.00,
  tax_amount      DECIMAL(12,2) NOT NULL,
  total_amount    DECIMAL(12,2) NOT NULL,
  status          ENUM('draft','issued','paid','cancelled') DEFAULT 'issued',
  issued_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id)  REFERENCES clients(id)  ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_log (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  item_type    ENUM('car','part') NOT NULL,
  item_id      INT NOT NULL,
  item_name    VARCHAR(200),
  change_type  ENUM('sale','purchase','restock','adjustment') NOT NULL,
  qty_before   INT NOT NULL,
  qty_change   INT NOT NULL,
  qty_after    INT NOT NULL,
  reference    VARCHAR(100),
  changed_by   INT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (changed_by) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX IF NOT EXISTS idx_cars_status      ON cars(status);
CREATE INDEX IF NOT EXISTS idx_appt_date        ON appointments(appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_appt_plate       ON appointments(car_plate);
CREATE INDEX IF NOT EXISTS idx_reports_plate    ON repair_reports(car_plate);
CREATE INDEX IF NOT EXISTS idx_reports_client   ON repair_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_client  ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client  ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_resets_token     ON password_resets(token);