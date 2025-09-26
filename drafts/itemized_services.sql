-- Itemize pet grooming services - split packages into detailed line items
-- This script updates the services2 table to have more detailed, individual services

-- First, let's see current services
SELECT id, name, description, category FROM services2 WHERE status = 'active' ORDER BY category, id;

-- Update existing services to be more specific
UPDATE services2 SET
    name = 'Basic Bath & Dry',
    description = 'Complete bath with shampoo, rinse, and professional drying'
WHERE id = 1 AND name = 'Basic Bath';

UPDATE services2 SET
    name = 'Nail Trimming & Grinding',
    description = 'Professional nail care including trimming and grinding'
WHERE id = 2 AND name = 'Nail Trimming';

UPDATE services2 SET
    name = 'Ear Cleaning & Inspection',
    description = 'Safe ear cleaning and inspection for infections'
WHERE id = 3 AND name = 'Ear Cleaning';

-- Update premium services to be more itemized
UPDATE services2 SET
    name = 'Haircut & Styling',
    description = 'Professional haircut and styling tailored to your pet'
WHERE id = 4 AND name = 'Full Grooming Package';

UPDATE services2 SET
    name = 'Teeth Cleaning',
    description = 'Professional teeth cleaning and oral health check'
WHERE id = 5 AND name = 'Dental Care';

-- De-shedding Treatment stays the same (ID: 6)

-- Add new itemized services
INSERT INTO services2 (name, description, category, base_price, is_size_based, status) VALUES
('Full Body Brushing', 'Complete brushing service for all coat types', 'premium', 150.00, 1, 'active'),
('Paw Massage', 'Relaxing paw massage and pad care', 'premium', 100.00, 0, 'active'),
('Scented Cologne', 'Pet-safe cologne application', 'addon', 50.00, 0, 'active'),
('Bow & Bandana', 'Stylish bow or bandana accessory', 'addon', 75.00, 0, 'active');

-- Update pricing for the new services
-- First, get the new service IDs
SET @brushing_id = (SELECT id FROM services2 WHERE name = 'Full Body Brushing');
SET @massage_id = (SELECT id FROM services2 WHERE name = 'Paw Massage');
SET @cologne_id = (SELECT id FROM services2 WHERE name = 'Scented Cologne');
SET @bow_id = (SELECT id FROM services2 WHERE name = 'Bow & Bandana');

-- Add pricing for size-based services
INSERT INTO service_pricing (service_id, pet_size, price) VALUES
-- Full Body Brushing pricing
(@brushing_id, 'small', 120.00),
(@brushing_id, 'medium', 150.00),
(@brushing_id, 'large', 180.00),
(@brushing_id, 'extra_large', 200.00),

-- Paw Massage pricing (fixed price, but we still need entries for each size)
(@massage_id, 'small', 100.00),
(@massage_id, 'medium', 100.00),
(@massage_id, 'large', 100.00),
(@massage_id, 'extra_large', 100.00),

-- Scented Cologne pricing (fixed price)
(@cologne_id, 'small', 50.00),
(@cologne_id, 'medium', 50.00),
(@cologne_id, 'large', 50.00),
(@cologne_id, 'extra_large', 50.00),

-- Bow & Bandana pricing (fixed price)
(@bow_id, 'small', 75.00),
(@bow_id, 'medium', 75.00),
(@bow_id, 'large', 75.00),
(@bow_id, 'extra_large', 75.00);

-- Update existing pricing for the renamed services
-- Haircut & Styling (was Full Grooming Package)
UPDATE service_pricing SET price = price * 0.7 WHERE service_id = 4; -- Reduce price since it's now just haircut

-- Teeth Cleaning (was Dental Care) - keep similar pricing

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
ORDER BY FIELD(s.category, 'basic', 'premium', 'addon'), s.id;