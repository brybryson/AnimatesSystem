-- Add 'customer' role to the users table enum and email verification columns
-- Run this SQL command on your existing database to add the customer role and verification columns

-- Add customer role to enum
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','staff','cashier','customer') NOT NULL DEFAULT 'staff';

-- Add phone column
ALTER TABLE `users` ADD COLUMN `phone` varchar(20) DEFAULT NULL AFTER `email`;

-- Add email verification columns
ALTER TABLE `users` ADD COLUMN `email_verified` tinyint(1) NOT NULL DEFAULT 0 AFTER `is_active`;
ALTER TABLE `users` ADD COLUMN `verification_code` varchar(10) DEFAULT NULL AFTER `email_verified`;
ALTER TABLE `users` ADD COLUMN `verification_token` varchar(100) DEFAULT NULL AFTER `verification_code`;
ALTER TABLE `users` ADD COLUMN `verification_code_expires` timestamp NULL DEFAULT NULL AFTER `verification_token`;
ALTER TABLE `users` ADD COLUMN `email_verified_at` timestamp NULL DEFAULT NULL AFTER `verification_code_expires`;

-- Add password reset columns
ALTER TABLE `users` ADD COLUMN `password_reset_token` varchar(100) DEFAULT NULL AFTER `email_verified_at`;
ALTER TABLE `users` ADD COLUMN `password_reset_code` varchar(10) DEFAULT NULL AFTER `password_reset_token`;
ALTER TABLE `users` ADD COLUMN `password_reset_code_expires` timestamp NULL DEFAULT NULL AFTER `password_reset_code`;

-- Optional: Update any existing users who should be customers
-- UPDATE `users` SET `role` = 'customer' WHERE `role` = 'staff' AND `email` NOT LIKE '%@animates.ph';