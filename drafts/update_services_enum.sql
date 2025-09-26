-- Update services2 table to use package-based categories
ALTER TABLE services2 MODIFY COLUMN category ENUM('package', 'modifier') NOT NULL DEFAULT 'package';

-- Verify the change
DESCRIBE services2;