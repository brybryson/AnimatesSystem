-- =====================================================
-- ADD DISCOUNT COLUMN TO EXISTING DATABASE
-- =====================================================
-- This script adds the discount_amount column to your existing sales_transactions table
-- Run this on your current 8paws_db database before importing the full structure
-- =====================================================

-- Add the discount_amount column to sales_transactions table
ALTER TABLE `sales_transactions` 
ADD COLUMN `discount_amount` decimal(10,2) DEFAULT 0.00 AFTER `amount`;

-- Update existing records to have 0 discount (optional)
UPDATE `sales_transactions` 
SET `discount_amount` = 0.00 
WHERE `discount_amount` IS NULL;

-- Verify the column was added
DESCRIBE `sales_transactions`;

-- =====================================================
-- NOTES:
-- 1. This script is safe to run on your existing database
-- 2. It only adds a new column, doesn't delete any data
-- 3. All existing transactions will have 0.00 discount by default
-- 4. New transactions can now properly track discount amounts
-- =====================================================
