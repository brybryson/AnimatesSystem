-- Create appointment_status_updates table for tracking appointment status changes
CREATE TABLE IF NOT EXISTS `appointment_status_updates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `appointment_id` int(11) NOT NULL,
  `status` enum('scheduled','confirmed','in_progress','completed','cancelled') NOT NULL,
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `appointment_id` (`appointment_id`),
  KEY `status` (`status`),
  KEY `created_at` (`created_at`),
  CONSTRAINT `appointment_status_updates_ibfk_1` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add check_in_time and actual_completion columns to appointments table if they don't exist
ALTER TABLE `appointments`
ADD COLUMN IF NOT EXISTS `check_in_time` timestamp NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `actual_completion` timestamp NULL DEFAULT NULL;

-- Add appointment_id column to rfid_cards table if it doesn't exist
ALTER TABLE `rfid_cards`
ADD COLUMN IF NOT EXISTS `appointment_id` int(11) NULL DEFAULT NULL,
ADD KEY IF NOT EXISTS `appointment_id` (`appointment_id`),
ADD CONSTRAINT `rfid_cards_ibfk_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE SET NULL;