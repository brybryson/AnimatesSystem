-- Package-Based Grooming Services System
-- This implements a package + modifier system instead of individual services

-- Clear existing services and pricing
DELETE FROM service_pricing;
DELETE FROM services2;

-- Reset auto increment
ALTER TABLE services2 AUTO_INCREMENT = 1;
ALTER TABLE service_pricing AUTO_INCREMENT = 1;

-- Insert Base Packages (main services customers choose from)
INSERT INTO services2 (name, description, category, base_price, is_size_based, status) VALUES
-- Basic Packages
('Basic Grooming Package', 'Essential grooming: bath, blow-dry, nail trim, ear cleaning', 'package', 450.00, 1, 'active'),
('Bath Only Package', 'Complete bath and blow-dry service', 'package', 250.00, 1, 'active'),

-- Premium Packages
('Premium Grooming Package', 'Full service: bath, haircut, nail trim, ear cleaning, teeth brushing', 'package', 750.00, 1, 'active'),
('Haircut Only Package', 'Professional haircut and styling', 'package', 400.00, 1, 'active'),

-- Specialty Packages
('Medicated Grooming Package', 'Specialized care for sensitive skin or allergies', 'package', 600.00, 1, 'active'),
('Spa Grooming Package', 'Relaxing aromatherapy bath with premium grooming', 'package', 650.00, 1, 'active');

-- Insert Modifiers/Add-ons (enhance the base packages)
INSERT INTO services2 (name, description, category, base_price, is_size_based, status) VALUES
-- Additional Services (can be added to any package)
('Extra Nail Grinding', 'Detailed nail finishing and smoothing', 'modifier', 50.00, 0, 'active'),
('Teeth Brushing', 'Professional teeth cleaning and oral care', 'modifier', 100.00, 0, 'active'),
('Scented Cologne', 'Pet-safe fragrance application', 'modifier', 30.00, 0, 'active'),
('Bow or Bandana', 'Stylish accessory for finished look', 'modifier', 50.00, 0, 'active'),

-- Premium Add-ons
('De-shedding Treatment', 'Special brush-out for heavy shedders', 'modifier', 150.00, 1, 'active'),
('Paw Massage', 'Relaxing paw and pad care', 'modifier', 80.00, 0, 'active'),
('Whitening Treatment', 'Brightens white/light colored coats', 'modifier', 120.00, 1, 'active'),
('Flea Treatment', 'Anti-parasitic treatment during bath', 'modifier', 200.00, 1, 'active');

-- Add pricing for size-based services
-- Package pricing
INSERT INTO service_pricing (service_id, pet_size, price) VALUES
-- Basic Grooming Package
(1, 'small', 450.00), (1, 'medium', 500.00), (1, 'large', 550.00), (1, 'extra_large', 600.00),
-- Bath Only Package
(2, 'small', 250.00), (2, 'medium', 280.00), (2, 'large', 310.00), (2, 'extra_large', 340.00),
-- Premium Grooming Package
(3, 'small', 750.00), (3, 'medium', 850.00), (3, 'large', 950.00), (3, 'extra_large', 1050.00),
-- Haircut Only Package
(4, 'small', 400.00), (4, 'medium', 450.00), (4, 'large', 500.00), (4, 'extra_large', 550.00),
-- Medicated Grooming Package
(5, 'small', 600.00), (5, 'medium', 650.00), (5, 'large', 700.00), (5, 'extra_large', 750.00),
-- Spa Grooming Package
(6, 'small', 650.00), (6, 'medium', 700.00), (6, 'large', 750.00), (6, 'extra_large', 800.00);

-- Modifier pricing (fixed or size-based)
INSERT INTO service_pricing (service_id, pet_size, price) VALUES
-- Fixed price modifiers
(7, 'small', 50.00), (7, 'medium', 50.00), (7, 'large', 50.00), (7, 'extra_large', 50.00), -- Extra Nail Grinding
(8, 'small', 100.00), (8, 'medium', 100.00), (8, 'large', 100.00), (8, 'extra_large', 100.00), -- Teeth Brushing
(9, 'small', 30.00), (9, 'medium', 30.00), (9, 'large', 30.00), (9, 'extra_large', 30.00), -- Scented Cologne
(10, 'small', 50.00), (10, 'medium', 50.00), (10, 'large', 50.00), (10, 'extra_large', 50.00), -- Bow or Bandana
(12, 'small', 80.00), (12, 'medium', 80.00), (12, 'large', 80.00), (12, 'extra_large', 80.00), -- Paw Massage

-- Size-based modifiers
(11, 'small', 120.00), (11, 'medium', 150.00), (11, 'large', 180.00), (11, 'extra_large', 200.00), -- De-shedding Treatment
(13, 'small', 100.00), (13, 'medium', 120.00), (13, 'large', 140.00), (13, 'extra_large', 160.00), -- Whitening Treatment
(14, 'small', 180.00), (14, 'medium', 200.00), (14, 'large', 220.00), (14, 'extra_large', 250.00); -- Flea Treatment

-- Verify the package-based system
SELECT
    s.id,
    s.name,
    s.description,
    s.category,
    s.is_size_based,
    GROUP_CONCAT(CONCAT(sp.pet_size, ': ₱', sp.price) SEPARATOR ', ') as pricing
FROM services2 s
LEFT JOIN service_pricing sp ON s.id = sp.service_id
WHERE s.status = 'active'
GROUP BY s.id, s.name, s.description, s.category, s.is_size_based
ORDER BY FIELD(s.category, 'package', 'modifier'), s.id;