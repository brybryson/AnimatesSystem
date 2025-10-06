-- Add RFID and completion tracking fields to appointments table
-- These ALTER TABLE statements will fail silently if columns already exist
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS custom_rfid VARCHAR(8) DEFAULT NULL AFTER total_amount;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS actual_completion TIMESTAMP NULL DEFAULT NULL AFTER estimated_duration;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMP NULL DEFAULT NULL AFTER actual_completion;

-- Add index for custom_rfid for faster lookups
-- This will also fail silently if index already exists
ALTER TABLE appointments ADD INDEX IF NOT EXISTS idx_custom_rfid (custom_rfid);

-- Create appointment_status_updates table for tracking status changes
CREATE TABLE IF NOT EXISTS appointment_status_updates (
    id INT(11) NOT NULL AUTO_INCREMENT,
    appointment_id INT(11) NOT NULL,
    status VARCHAR(20) NOT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_appointment_id (appointment_id),
    CONSTRAINT fk_appointment_status_updates_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;