-- Migration: Add vaccination fields to appointments table
-- Date: 2025-09-25
-- Description: Add fields for vaccination tracking in appointments

ALTER TABLE `appointments`
ADD COLUMN `last_vaccine_date` DATE NULL AFTER `special_instructions`,
ADD COLUMN `vaccine_type` VARCHAR(100) NULL AFTER `last_vaccine_date`,
ADD COLUMN `custom_vaccine` VARCHAR(255) NULL AFTER `vaccine_type`,
ADD COLUMN `vaccination_proof_path` VARCHAR(500) NULL AFTER `custom_vaccine`;