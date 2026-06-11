-- Script de Creación de Estructura de Datos para AutoParts WebHub
-- Motor recomendado: MariaDB / MySQL
-- Nivel de Normalización: 3FN

CREATE DATABASE IF NOT EXISTS autoparts_webhub_db;
USE autoparts_webhub_db;

-- 1. Tabla de Usuarios (Manejo de clientes y administradores)
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('cliente_particular', 'mecanico_independiente', 'administrador') NOT NULL DEFAULT 'cliente_particular',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Tabla de Vehículos (Taxonomía para la búsqueda)
CREATE TABLE vehiculos (
    id_vehiculo INT AUTO_INCREMENT PRIMARY KEY,
    marca VARCHAR(50) NOT NULL,
    modelo VARCHAR(50) NOT NULL,
    anio_fabricacion INT NOT NULL,
    motorizacion VARCHAR(50) NOT NULL,
    -- Índice para acelerar el filtrado en cascada del catálogo
    INDEX idx_vehiculo_busqueda (marca, modelo, anio_fabricacion)
) ENGINE=InnoDB;

-- 3. Tabla de Repuestos (Catálogo e Inventario Físico)
CREATE TABLE repuestos (
    id_repuesto INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    precio INT NOT NULL,
    stock_disponible INT NOT NULL DEFAULT 0,
    ubicacion_bodega VARCHAR(50) NOT NULL,
    -- Índice para agilizar la navegación por categorías
    INDEX idx_repuesto_categoria (categoria)
) ENGINE=InnoDB;

-- 4. Tabla Intermedia de Compatibilidad (Relación Muchos a Muchos)
-- Conecta qué repuesto sirve exactamente para qué vehículo(s)
CREATE TABLE compatibilidad_repuestos (
    id_repuesto INT NOT NULL,
    id_vehiculo INT NOT NULL,
    PRIMARY KEY (id_repuesto, id_vehiculo),
    FOREIGN KEY (id_repuesto) REFERENCES repuestos(id_repuesto) ON DELETE CASCADE,
    FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Tabla de Citas de Retiro (Logística y Agenda MCP)
CREATE TABLE citas_retiro (
    id_cita INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_repuesto INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    fecha_cita DATE NOT NULL,
    hora_cita TIME NOT NULL,
    estado ENUM('pendiente', 'completado', 'cancelado') NOT NULL DEFAULT 'pendiente',
    creado_por_ia TINYINT(1) NOT NULL DEFAULT 0, -- Bandera para saber si lo agendó el chatbot
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    FOREIGN KEY (id_repuesto) REFERENCES repuestos(id_repuesto) ON DELETE RESTRICT,
    -- Previene colisiones: nadie puede agendar en la misma fecha y hora exacta
    UNIQUE KEY idx_agenda_unica (fecha_cita, hora_cita) 
) ENGINE=InnoDB;
