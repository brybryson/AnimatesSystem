-- Migration: Add cancellation tracking columns to appointments table
-- Date: 2025-09-28
-- Description: Adds columns to track who cancelled appointments and why

ALTER TABLE `appointments`
ADD COLUMN `cancelled_by` INT(11) DEFAULT NULL COMMENT 'User ID of who cancelled the appointment',
ADD COLUMN `cancelled_by_name` VARCHAR(255) DEFAULT NULL COMMENT 'Name of who cancelled the appointment',
ADD COLUMN `cancellation_remarks` TEXT DEFAULT NULL COMMENT 'Remarks explaining why the appointment was cancelled';

-- Add index for performance
ALTER TABLE `appointments`
ADD KEY `idx_cancelled_by` (`cancelled_by`);