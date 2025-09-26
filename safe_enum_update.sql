-- Safe enum update for customizable package system
-- Basic → Packages → Add-ons structure

-- First, temporarily allow all categories
ALTER TABLE services2 MODIFY COLUMN category ENUM('basic', 'premium', 'addon', 'package', 'modifier') NOT NULL DEFAULT 'basic';

-- Clear existing services (since we're replacing them anyway)
DELETE FROM service_pricing;
DELETE FROM services2;

-- Reset auto increment
ALTER TABLE services2 AUTO_INCREMENT = 1;
ALTER TABLE service_pricing AUTO_INCREMENT = 1;

-- Now set the final enum for customizable system
ALTER TABLE services2 MODIFY COLUMN category ENUM('basic', 'package', 'addon') NOT NULL DEFAULT 'basic';

-- Verify the change
DESCRIBE services2;