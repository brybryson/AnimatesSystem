-- =====================================================
-- ADD UPDATED_BY COLUMN TO BOOKINGS TABLE
-- =====================================================
-- This script adds the missing updated_by column to your existing bookings table
-- Run this on your current 8paws_db database to fix the device update issue
-- =====================================================

-- Add the updated_by column to bookings table
ALTER TABLE `bookings` 
ADD COLUMN `updated_by` int(11) DEFAULT NULL COMMENT 'User ID who last updated the booking' 
AFTER `staff_notes`;

-- Verify the column was added
DESCRIBE `bookings`;

-- =====================================================
-- IMPORTANT NOTES:
-- =====================================================
-- 1. This column tracks which user/staff member last updated a booking
-- 2. It's used by the RFID device to track who made status changes
-- 3. The column allows NULL values for existing records
-- 4. After adding this column, the device should be able to update bookings
-- =====================================================
