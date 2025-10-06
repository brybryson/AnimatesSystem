-- Migration: Make user_id nullable in appointments table for walk-in customers
-- Date: 2025-10-06
-- Description: Allows NULL user_id for walk-in customers who don't have accounts

ALTER TABLE `appointments`
MODIFY COLUMN `user_id` INT(11) NULL COMMENT 'User ID (NULL for walk-in customers)';