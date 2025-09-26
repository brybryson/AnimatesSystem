-- Comprehensive Pet Grooming Services Menu - Complete Replacement
-- This script replaces all existing services with the new detailed menu

-- Clear existing services and pricing
DELETE FROM service_pricing;
DELETE FROM services2;

-- Reset auto increment
ALTER TABLE services2 AUTO_INCREMENT = 1;
ALTER TABLE service_pricing AUTO_INCREMENT = 1;

-- Insert Basic Services
INSERT INTO services2 (name, description, category, base_price, is_size_based, status) VALUES
('Basic Bath & Dry', 'Shampoo, rinse, blow-dry (includes light brushing)', 'basic', 300.00, 1, 'active'),
('Nail Trimming & Grinding', 'Safe trimming and smoothing of nails', 'basic', 150.00, 1, 'active'),
('Ear Cleaning & Inspection', 'Gentle ear cleaning + infection check', 'basic', 200.00, 0, 'active'),
('Sanitary Trim', 'Trimming around hygiene areas (face, paws, belly, rear)', 'basic', 200.00, 1, 'active'),
('Anal Gland Expression', 'Helps prevent odor & discomfort', 'basic', 200.00, 0, 'active');

-- Insert Premium Services
INSERT INTO services2 (name, description, category, base_price, is_size_based, status) VALUES
('Haircut & Styling', 'Professional, breed-specific, or custom styling', 'premium', 420.00, 1, 'active'),
('Full Grooming Package', 'Bath, haircut, blow-dry, nail trim, ear cleaning, sanitary trim, anal glands', 'premium', 800.00, 1, 'active'),
('De-shedding Treatment', 'Special bath & brushing to reduce shedding up to 90%', 'premium', 400.00, 1, 'active'),
('Teeth Cleaning', 'Brushing & tartar prevention (non-vet)', 'premium', 250.00, 1, 'active'),
('Coat Conditioning Treatment', 'Moisturizing mask & coat shine', 'premium', 350.00, 1, 'active'),
('Medicated Bath', 'For sensitive skin or allergies (vet shampoo required)', 'premium', 400.00, 1, 'active');

-- Insert Specialty & Spa Services
INSERT INTO services2 (name, description, category, base_price, is_size_based, status) VALUES
('Aromatherapy Bath', 'Relaxing, pet-safe essential oils for stress relief', 'specialty', 400.00, 1, 'active'),
('Pawdicure (Massage + Balm)', 'Paw massage + moisturizing balm for cracked pads', 'specialty', 150.00, 1, 'active'),
('Flea & Tick Treatment', 'Anti-parasitic bath + comb-out', 'specialty', 500.00, 1, 'active'),
('Whitening Shampoo Service', 'Brightens white/light-colored coats', 'specialty', 300.00, 1, 'active'),
('Creative Grooming', 'Pet-safe dye, stencil designs, or themed styling', 'specialty', 500.00, 1, 'active');

-- Insert Add-ons
INSERT INTO services2 (name, description, category, base_price, is_size_based, status) VALUES
('Nail Polish (Pet-safe)', 'Pet-safe nail colors', 'addon', 100.00, 0, 'active'),
('Perfume & Bow', 'Finishing touches for a perfect look', 'addon', 150.00, 0, 'active'),
('Scented Cologne', 'Pet-safe cologne application', 'addon', 50.00, 0, 'active'),
('Bow / Bandana / Seasonal Costume', 'Stylish accessories and seasonal costumes', 'addon', 75.00, 1, 'active');

-- Add pricing for size-based services
-- Basic Services pricing
INSERT INTO service_pricing (service_id, pet_size, price) VALUES
-- Basic Bath & Dry
(1, 'small', 300.00), (1, 'medium', 350.00), (1, 'large', 400.00), (1, 'extra_large', 450.00),
-- Nail Trimming & Grinding
(2, 'small', 150.00), (2, 'medium', 175.00), (2, 'large', 200.00), (2, 'extra_large', 225.00),
-- Ear Cleaning & Inspection (fixed price)
(3, 'small', 200.00), (3, 'medium', 200.00), (3, 'large', 200.00), (3, 'extra_large', 200.00),
-- Sanitary Trim
(4, 'small', 200.00), (4, 'medium', 225.00), (4, 'large', 250.00), (4, 'extra_large', 300.00),
-- Anal Gland Expression (fixed price)
(5, 'small', 200.00), (5, 'medium', 200.00), (5, 'large', 200.00), (5, 'extra_large', 200.00);

-- Premium Services pricing
INSERT INTO service_pricing (service_id, pet_size, price) VALUES
-- Haircut & Styling
(6, 'small', 420.00), (6, 'medium', 500.00), (6, 'large', 600.00), (6, 'extra_large', 700.00),
-- Full Grooming Package
(7, 'small', 800.00), (7, 'medium', 1000.00), (7, 'large', 1200.00), (7, 'extra_large', 1500.00),
-- De-shedding Treatment
(8, 'small', 400.00), (8, 'medium', 450.00), (8, 'large', 500.00), (8, 'extra_large', 550.00),
-- Teeth Cleaning
(9, 'small', 250.00), (9, 'medium', 275.00), (9, 'large', 300.00), (9, 'extra_large', 325.00),
-- Coat Conditioning Treatment
(10, 'small', 350.00), (10, 'medium', 400.00), (10, 'large', 450.00), (10, 'extra_large', 500.00),
-- Medicated Bath
(11, 'small', 400.00), (11, 'medium', 450.00), (11, 'large', 500.00), (11, 'extra_large', 550.00);

-- Specialty & Spa Services pricing
INSERT INTO service_pricing (service_id, pet_size, price) VALUES
-- Aromatherapy Bath
(12, 'small', 400.00), (12, 'medium', 450.00), (12, 'large', 500.00), (12, 'extra_large', 550.00),
-- Pawdicure
(13, 'small', 150.00), (13, 'medium', 175.00), (13, 'large', 200.00), (13, 'extra_large', 250.00),
-- Flea & Tick Treatment
(14, 'small', 500.00), (14, 'medium', 550.00), (14, 'large', 600.00), (14, 'extra_large', 650.00),
-- Whitening Shampoo Service
(15, 'small', 300.00), (15, 'medium', 350.00), (15, 'large', 400.00), (15, 'extra_large', 450.00),
-- Creative Grooming
(16, 'small', 500.00), (16, 'medium', 600.00), (16, 'large', 700.00), (16, 'extra_large', 800.00);

-- Add-ons pricing
INSERT INTO service_pricing (service_id, pet_size, price) VALUES
-- Nail Polish (fixed price)
(17, 'small', 100.00), (17, 'medium', 100.00), (17, 'large', 100.00), (17, 'extra_large', 100.00),
-- Perfume & Bow (fixed price)
(18, 'small', 150.00), (18, 'medium', 150.00), (18, 'large', 150.00), (18, 'extra_large', 150.00),
-- Scented Cologne (fixed price)
(19, 'small', 50.00), (19, 'medium', 50.00), (19, 'large', 50.00), (19, 'extra_large', 50.00),
-- Bow/Bandana/Seasonal Costume (variable pricing)
(20, 'small', 75.00), (20, 'medium', 100.00), (20, 'large', 150.00), (20, 'extra_large', 200.00);

-- Verify the changes
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
ORDER BY FIELD(s.category, 'basic', 'premium', 'specialty', 'addon'), s.id;