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
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
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
