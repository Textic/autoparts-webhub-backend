-- AutoParts WebHub Database Schema (3NF)
-- Recommended Engine: MariaDB / MySQL

CREATE DATABASE IF NOT EXISTS autoparts_webhub_db;
USE autoparts_webhub_db;

-- 1. Roles Table
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- 2. Users Table (handles clients and administrators)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    role_id INT NOT NULL,
    auth_provider VARCHAR(50) NOT NULL DEFAULT 'credentials',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 3. Vehicles Table (search taxonomy)
CREATE TABLE vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    brand VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    manufacturing_year INT NOT NULL,
    engine_type VARCHAR(50) NOT NULL,
    -- Index to speed up cascaded catalog filtering
    INDEX idx_vehicle_search (brand, model, manufacturing_year)
) ENGINE=InnoDB;

-- 4. Parts Table (catalog & physical inventory)
CREATE TABLE parts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price INT NOT NULL,
    available_stock INT NOT NULL DEFAULT 0,
    warehouse_location VARCHAR(50) NOT NULL,
    -- Index to improve category navigation speed
    INDEX idx_part_category (category)
) ENGINE=InnoDB;

-- 5. Part Compatibilities Table (N:M Relationship)
-- Connects which part fits which vehicle(s)
CREATE TABLE part_compatibilities (
    part_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    PRIMARY KEY (part_id, vehicle_id),
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Appointments Table (logistics & pickup schedule)
CREATE TABLE appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    part_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    created_by_ia TINYINT(1) NOT NULL DEFAULT 0, -- Flag indicating if scheduled by chatbot
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE RESTRICT,
    -- Prevents schedule collisions
    UNIQUE KEY idx_unique_schedule (appointment_date, appointment_time)
) ENGINE=InnoDB;

-- Seed default roles
INSERT INTO roles (name) VALUES ('client'), ('mechanic'), ('administrator');

-- Seed default vehicles
INSERT INTO vehicles (brand, model, manufacturing_year, engine_type) VALUES
('Toyota', 'Corolla', 2020, '1.8L Híbrido'),
('Toyota', 'RAV4', 2021, '2.5L 4-Cilindros'),
('Toyota', 'Hilux', 2019, '2.8L Diésel'),
('Honda', 'Civic', 2019, '1.5L Turbo'),
('Honda', 'CR-V', 2020, '1.5L Turbo'),
('Ford', 'F-150', 2021, '3.5L V6'),
('Ford', 'Ranger', 2020, '2.3L EcoBoost'),
('Chevrolet', 'Sail', 2018, '1.5L'),
('Chevrolet', 'Silverado', 2022, '5.3L V8'),
('Chevrolet', 'Tracker', 2021, '1.2L Turbo'),
('Hyundai', 'Tucson', 2022, '2.0L'),
('Hyundai', 'Elantra', 2020, '2.0L'),
('Hyundai', 'Santa Fe', 2021, '2.5L Turbo'),
('Nissan', 'Sentra', 2020, '2.0L'),
('Nissan', 'Navara', 2019, '2.3L Diésel'),
('Subaru', 'Forester', 2021, '2.5L Bóxer'),
('Mazda', 'CX-5', 2021, '2.5L 4-Cilindros'),
('Volkswagen', 'Golf', 2019, '1.4L TSI'),
('Kia', 'Sportage', 2022, '2.0L'),
('Jeep', 'Grand Cherokee', 2021, '3.6L V6');

-- Seed default parts
INSERT INTO parts (sku, name, category, price, available_stock, warehouse_location) VALUES
('BRK-TY-001', 'Pastillas de Freno Premium (Delanteras)', 'Frenos', 25000, 15, 'A-12'),
('BRK-HD-002', 'Pastillas de Freno Cerámicas (Traseras)', 'Frenos', 22000, 10, 'A-13'),
('FIL-HD-002', 'Filtro de Aceite de Motor Sintético', 'Filtros', 8000, 50, 'B-04'),
('FIL-AIR-005', 'Filtro de Aire de Alto Flujo', 'Filtros', 10000, 40, 'B-05'),
('FIL-CAB-006', 'Filtro de Cabina de Carbón Activado', 'Filtros', 12000, 35, 'B-06'),
('SPK-NGK-003', 'Juego de Bujías de Iridium (x4)', 'Motor', 12000, 30, 'C-08'),
('SPK-DEN-007', 'Bujía de Doble Platino', 'Motor', 3500, 120, 'C-09'),
('ALT-FD-004', 'Alternador de Servicio Pesado', 'Eléctrico', 95000, 5, 'A-03'),
('BAT-BOS-008', 'Batería Bosch S4 Plata 12V', 'Eléctrico', 85000, 8, 'D-01'),
('WPR-BOS-009', 'Plumillas Limpiaparabrisas Aerotwin', 'Carrocería', 15000, 25, 'E-02'),
('RAD-VAL-010', 'Radiador de Refrigeración de Motor', 'Refrigeración', 75000, 4, 'F-03'),
('SHK-MON-011', 'Amortiguador Monroe', 'Suspensión', 45000, 12, 'G-05'),
('BEL-CON-012', 'Correa de Accesorios Continental', 'Motor', 18000, 20, 'C-04'),
('PMP-WAT-013', 'Bomba de Agua de Motor', 'Refrigeración', 38000, 7, 'F-07'),
('PMP-FUL-014', 'Bomba de Combustible de Alta Presión', 'Motor', 110000, 3, 'C-15');

-- Seed part compatibilities
INSERT INTO part_compatibilities (part_id, vehicle_id) VALUES
-- Front Brake Pads compatible with Toyota Corolla (1), RAV4 (2), Hilux (3)
(1, 1),
(1, 2),
(1, 3),
-- Rear Brake Pads compatible with Civic (4), CR-V (5)
(2, 4),
(2, 5),
-- Oil Filter compatible with Corolla (1), Civic (4), Tucson (11), Elantra (12), Sentra (14)
(3, 1),
(3, 4),
(3, 11),
(3, 12),
(3, 14),
-- Air Filter compatible with Corolla (1), RAV4 (2), Civic (4), Forester (16)
(4, 1),
(4, 2),
(4, 4),
(4, 16),
-- Cabin Filter compatible with Corolla (1), RAV4 (2), Civic (4), Tucson (11), CX-5 (17)
(5, 1),
(5, 2),
(5, 4),
(5, 11),
(5, 17),
-- NGK Spark Plugs compatible with Corolla (1), Civic (4), Sail (8), Elantra (12), CX-5 (17)
(6, 1),
(6, 4),
(6, 8),
(6, 12),
(6, 17),
-- Denso Spark Plugs compatible with Sentra (14), Golf (18), Sportage (19)
(7, 14),
(7, 18),
(7, 19),
-- Alternator compatible with F-150 (6), Ranger (7)
(8, 6),
(8, 7),
-- Bosch Battery compatible with F-150 (6), Silverado (9), Grand Cherokee (20)
(9, 6),
(9, 9),
(9, 20),
-- Wiper Blades compatible with Corolla (1), Civic (4), Sentra (14), Golf (18)
(10, 1),
(10, 4),
(10, 14),
(10, 18),
-- Radiator compatible with Hilux (3), Silverado (9), Grand Cherokee (20)
(11, 3),
(11, 9),
(11, 20),
-- Shock Absorbers compatible with Ranger (7), Navara (15), Forester (16)
(12, 7),
(12, 15),
(12, 16),
-- Serpentine Belt compatible with Corolla (1), RAV4 (2), Sail (8), Sentra (14)
(13, 1),
(13, 2),
(13, 8),
(13, 14),
-- Water Pump compatible with Civic (4), CR-V (5), Golf (18)
(14, 4),
(14, 5),
(14, 18),
-- Fuel Pump compatible with Silverado (9), Santa Fe (13), Grand Cherokee (20)
(15, 9),
(15, 13),
(15, 20);

