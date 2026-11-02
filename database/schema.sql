-- Fresh installation only. Does not modify the uploaded project's unknown existing schema.
CREATE DATABASE IF NOT EXISTS cabnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cabnect;
CREATE TABLE IF NOT EXISTS owners (
 owner_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL, company_name VARCHAR(120) NOT NULL,
 mobile_no VARCHAR(10), email VARCHAR(254) UNIQUE, password VARCHAR(255) NOT NULL,
 is_deleted BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS drivers (
 driver_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL, age INT NOT NULL, gender VARCHAR(30) NOT NULL,
 license_no VARCHAR(40) UNIQUE, mobile_no VARCHAR(10), email VARCHAR(254) UNIQUE,
 password VARCHAR(255) NOT NULL, availability ENUM('available','unavailable') NOT NULL DEFAULT 'available',
 is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
 CHECK(age BETWEEN 18 AND 100)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS vehicles (
 vehicle_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, owner_id INT UNSIGNED NOT NULL,
 vehicle_no VARCHAR(30) NOT NULL UNIQUE, car_model VARCHAR(80) NOT NULL,
 car_type VARCHAR(40) NOT NULL, fuel_type VARCHAR(40) NOT NULL,
 FOREIGN KEY(owner_id) REFERENCES owners(owner_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS trips (
 trip_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, owner_id INT UNSIGNED NOT NULL,
 customer_name VARCHAR(120) NOT NULL, pickup_location VARCHAR(255) NOT NULL,
 drop_point VARCHAR(255) NOT NULL, mobile_no VARCHAR(10) NOT NULL,
 distance_km DECIMAL(7,2) NOT NULL, fare DECIMAL(10,2) NOT NULL,
 vehicle_id INT UNSIGNED NOT NULL, trip_datetime DATETIME NOT NULL,
 status ENUM('pending','assigned','completed','cancelled') NOT NULL DEFAULT 'pending',
 FOREIGN KEY(owner_id) REFERENCES owners(owner_id), FOREIGN KEY(vehicle_id) REFERENCES vehicles(vehicle_id),
 CHECK(distance_km > 0), CHECK(fare > 0), INDEX(owner_id,status)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS assignments (
 assignment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, trip_id INT UNSIGNED NOT NULL UNIQUE,
 driver_id INT UNSIGNED NOT NULL, driver_payment DECIMAL(10,2) NOT NULL,
 status ENUM('assigned','completed','cancelled') NOT NULL DEFAULT 'assigned', completed_at DATETIME NULL,
 active_driver_id INT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'assigned' THEN driver_id ELSE NULL END) STORED,
 UNIQUE KEY one_active_trip_per_driver(active_driver_id),
 FOREIGN KEY(trip_id) REFERENCES trips(trip_id), FOREIGN KEY(driver_id) REFERENCES drivers(driver_id),
 CHECK(driver_payment >= 0), INDEX(driver_id,status)
) ENGINE=InnoDB;
