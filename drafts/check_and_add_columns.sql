-- Check existing columns and add only missing ones
-- Run this to safely add missing columns without duplicates

-- First, let's see what columns currently exist
DESCRIBE `users`;

-- Add customer role to enum (this should work even if columns exist)
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','staff','cashier','customer') NOT NULL DEFAULT 'staff';

-- Check and add phone column
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'phone'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `phone` varchar(20) DEFAULT NULL AFTER `email`',
    'SELECT "phone column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add email_verified column
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'email_verified'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `email_verified` tinyint(1) NOT NULL DEFAULT 0 AFTER `is_active`',
    'SELECT "email_verified column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add verification_code column
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'verification_code'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `verification_code` varchar(10) DEFAULT NULL AFTER `email_verified`',
    'SELECT "verification_code column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add verification_token column
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'verification_token'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `verification_token` varchar(100) DEFAULT NULL AFTER `verification_code`',
    'SELECT "verification_token column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add verification_code_expires column
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'verification_code_expires'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `verification_code_expires` timestamp NULL DEFAULT NULL AFTER `verification_token`',
    'SELECT "verification_code_expires column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add email_verified_at column
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'email_verified_at'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `email_verified_at` timestamp NULL DEFAULT NULL AFTER `verification_code_expires`',
    'SELECT "email_verified_at column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add password_reset_token column
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'password_reset_token'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `password_reset_token` varchar(100) DEFAULT NULL AFTER `email_verified_at`',
    'SELECT "password_reset_token column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add password_reset_code column
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'password_reset_code'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `password_reset_code` varchar(10) DEFAULT NULL AFTER `password_reset_token`',
    'SELECT "password_reset_code column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add password_reset_code_expires column
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'password_reset_code_expires'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `password_reset_code_expires` timestamp NULL DEFAULT NULL AFTER `password_reset_code`',
    'SELECT "password_reset_code_expires column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Final check - show all columns
DESCRIBE `users`;