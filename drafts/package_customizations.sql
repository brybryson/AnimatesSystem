-- Package Customizations Table
-- Stores which services were included/excluded in customized packages

CREATE TABLE IF NOT EXISTS package_customizations (
    id int(11) NOT NULL AUTO_INCREMENT,
    booking_id int(11) NOT NULL,
    package_name varchar(100) NOT NULL,
    service_name varchar(100) NOT NULL,
    included tinyint(1) NOT NULL DEFAULT 1,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    KEY booking_id (booking_id),
    KEY package_name (package_name),
    KEY service_name (service_name),
    CONSTRAINT fk_package_customizations_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Add package_customizations column to bookings table to store JSON data
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_customizations JSON NULL AFTER custom_rfid;

-- Insert sample data for testing
INSERT INTO package_customizations (booking_id, package_name, service_name, included) VALUES
(1, 'Full Grooming Package', 'Bath & Dry', 1),
(1, 'Full Grooming Package', 'Haircut & Styling', 1),
(1, 'Full Grooming Package', 'Nail Trimming & Grinding', 0),
(1, 'Full Grooming Package', 'Ear Cleaning & Inspection', 1),
(1, 'Full Grooming Package', 'Teeth Cleaning', 1),
(1, 'Full Grooming Package', 'De-shedding Treatment', 0);