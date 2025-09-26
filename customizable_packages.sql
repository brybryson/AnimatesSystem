-- Customizable Package-Based Grooming System
-- Basic Services → Package Templates → Add-ons
-- Packages can be customized by adding/removing components

-- Clear existing services and pricing
DELETE FROM service_pricing;
DELETE FROM services2;

-- Reset auto increment
ALTER TABLE services2 AUTO_INCREMENT = 1;
ALTER TABLE service_pricing AUTO_INCREMENT = 1;

-- Insert Basic Services (individual services)
INSERT INTO services2 (name, description, category, base_price, is_size_based, status) VALUES
('Bath & Dry', 'Complete bath with shampoo, rinse, and professional drying', 'basic', 300.00, 1, 'active'),
('Nail Trimming & Grinding', 'Professional nail care including trimming and grinding', 'basic', 150.00, 1, 'active'),
('Ear Cleaning & Inspection', 'Safe ear cleaning and inspection for infections', 'basic', 200.00, 0, 'active'),
('Haircut & Styling', 'Professional haircut and styling tailored to your pet', 'basic', 420.00, 1, 'active'),
('Teeth Cleaning', 'Professional teeth cleaning and oral health check', 'basic', 250.00, 1, 'active'),
('De-shedding Treatment', 'Special bath & brushing to reduce shedding up to 90%', 'basic', 400.00, 1, 'active');

-- Insert Package Templates (customizable starting points)
INSERT INTO services2 (name, description, category, base_price, is_size_based, status) VALUES
('Essential Grooming Package', 'Basic grooming: bath, blow-dry, nail trim, ear cleaning (customizable)', 'package', 450.00, 1, 'active'),
('Full Grooming Package', 'Complete service: bath, haircut, nail trim, ear cleaning, teeth (customizable)', 'package', 800.00, 1, 'active'),
('Bath & Brush Package', 'Bath with specialized brushing treatment (customizable)', 'package', 500.00, 1, 'active'),
('Spa Relaxation Package', 'Aromatherapy bath with massage and premium care (customizable)', 'package', 700.00, 1, 'active');

-- Insert Add-ons (enhance any service)
INSERT INTO services2 (name, description, category, base_price, is_size_based, status) VALUES
('Extra Nail Polish', 'Pet-safe nail colors', 'addon', 100.00, 0, 'active'),
('Scented Cologne', 'Pet-safe fragrance application', 'addon', 50.00, 0, 'active'),
('Bow or Bandana', 'Stylish accessory for finished look', 'addon', 75.00, 0, 'active'),
('Paw Balm', 'Moisturizing treatment for dry pads', 'addon', 80.00, 0, 'active'),
('Whitening Shampoo', 'Brightens white/light colored coats', 'addon', 120.00, 1, 'active'),
('Flea & Tick Treatment', 'Anti-parasitic treatment', 'addon', 200.00, 1, 'active');

-- Add pricing for all services
-- Basic Services pricing (realistic Philippine pet grooming prices)
INSERT INTO service_pricing (service_id, pet_size, price) VALUES
-- Bath & Dry
(1, 'small', 350.00), (1, 'medium', 400.00), (1, 'large', 450.00), (1, 'extra_large', 500.00),
-- Nail Trimming & Grinding
(2, 'small', 180.00), (2, 'medium', 220.00), (2, 'large', 260.00), (2, 'extra_large', 300.00),
-- Ear Cleaning & Inspection (fixed)
(3, 'small', 250.00), (3, 'medium', 250.00), (3, 'large', 250.00), (3, 'extra_large', 250.00),
-- Haircut & Styling
(4, 'small', 500.00), (4, 'medium', 650.00), (4, 'large', 800.00), (4, 'extra_large', 1000.00),
-- Teeth Cleaning
(5, 'small', 350.00), (5, 'medium', 400.00), (5, 'large', 450.00), (5, 'extra_large', 500.00),
-- De-shedding Treatment
(6, 'small', 500.00), (6, 'medium', 600.00), (6, 'large', 700.00), (6, 'extra_large', 800.00);

-- Package Templates pricing (comprehensive packages at competitive rates)
INSERT INTO service_pricing (service_id, pet_size, price) VALUES
-- Essential Grooming Package
(7, 'small', 650.00), (7, 'medium', 750.00), (7, 'large', 850.00), (7, 'extra_large', 950.00),
-- Full Grooming Package
(8, 'small', 1200.00), (8, 'medium', 1400.00), (8, 'large', 1600.00), (8, 'extra_large', 1800.00),
-- Bath & Brush Package
(9, 'small', 700.00), (9, 'medium', 850.00), (9, 'large', 1000.00), (9, 'extra_large', 1150.00),
-- Spa Relaxation Package
(10, 'small', 900.00), (10, 'medium', 1100.00), (10, 'large', 1300.00), (10, 'extra_large', 1500.00);

-- Add-on pricing (premium add-on services)
INSERT INTO service_pricing (service_id, pet_size, price) VALUES
-- Extra Nail Polish (fixed)
(11, 'small', 150.00), (11, 'medium', 150.00), (11, 'large', 150.00), (11, 'extra_large', 150.00),
-- Scented Cologne (fixed)
(12, 'small', 80.00), (12, 'medium', 80.00), (12, 'large', 80.00), (12, 'extra_large', 80.00),
-- Bow or Bandana (fixed)
(13, 'small', 120.00), (13, 'medium', 120.00), (13, 'large', 120.00), (13, 'extra_large', 120.00),
-- Paw Balm (fixed)
(14, 'small', 100.00), (14, 'medium', 100.00), (14, 'large', 100.00), (14, 'extra_large', 100.00),
-- Whitening Shampoo
(15, 'small', 200.00), (15, 'medium', 250.00), (15, 'large', 300.00), (15, 'extra_large', 350.00),
-- Flea & Tick Treatment
(16, 'small', 300.00), (16, 'medium', 350.00), (16, 'large', 400.00), (16, 'extra_large', 450.00);

-- Verify the customizable system
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
ORDER BY FIELD(s.category, 'basic', 'package', 'addon'), s.id;