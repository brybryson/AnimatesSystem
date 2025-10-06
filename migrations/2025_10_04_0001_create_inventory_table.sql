-- Create inventory table for managing pet grooming supplies and products
CREATE TABLE IF NOT EXISTS inventory (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    quantity INT NOT NULL DEFAULT 0,
    unit_price DECIMAL(10,2) DEFAULT 0.00,
    vendor VARCHAR(255),
    min_stock_level INT DEFAULT 0,
    critical_stock_level INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Insert realistic inventory items based on grooming services (only if table is empty)
INSERT IGNORE INTO inventory (name, description, category, quantity, unit_price, vendor, min_stock_level, critical_stock_level) VALUES
('Premium Shampoo', 'pH-balanced shampoo for all coat types', 'Grooming Supplies', 50, 150.00, 'Calacal Corporation', 10, 5),
('Detangling Conditioner', 'Reduces grooming time and prevents matting', 'Grooming Supplies', 45, 180.00, 'Delfin Corporation', 10, 5),
('Whitening Shampoo', 'Brightens white/light colored coats', 'Grooming Supplies', 30, 250.00, 'Miguel Corporation', 8, 4),
('Microfiber Drying Towels', 'Ultra-absorbent towels for quick drying', 'Grooming Supplies', 100, 50.00, 'Natal Corporation', 20, 10),
('Professional Nail Clippers', 'Stainless steel clippers for all sizes', 'Tools', 20, 250.00, 'Rivera Corporation', 5, 2),
('Nail Grinding File', 'Electric grinder with sanding attachments', 'Tools', 15, 350.00, 'Calacal Corporation', 3, 1),
('Nail Polish - Clear', 'Pet-safe clear polish for protection', 'Grooming Supplies', 25, 120.00, 'Delfin Corporation', 5, 2),
('Ear Cleaning Solution', 'Gentle enzymatic cleaner for wax removal', 'Grooming Supplies', 40, 85.00, 'Miguel Corporation', 10, 5),
('Cotton Swabs', 'Soft swabs for professional ear cleaning', 'Grooming Supplies', 200, 15.00, 'Natal Corporation', 50, 20),
('Professional Shears Set', 'Complete set of grooming shears', 'Tools', 12, 1200.00, 'Rivera Corporation', 2, 1),
('Clipper Machine', 'Heavy-duty clipper with adjustable blades', 'Tools', 8, 2500.00, 'Calacal Corporation', 2, 1),
('Slicker Brush', 'High-quality brush for detangling', 'Tools', 25, 180.00, 'Delfin Corporation', 5, 2),
('Undercoat Rake', 'Specialized rake for undercoat removal', 'Tools', 18, 220.00, 'Miguel Corporation', 4, 2),
('Dental Cleaning Solution', 'Enzymatic rinse for plaque reduction', 'Grooming Supplies', 35, 95.00, 'Natal Corporation', 8, 4),
('Pet Toothbrush Set', 'Soft-bristled toothbrushes for pets', 'Grooming Supplies', 60, 45.00, 'Rivera Corporation', 15, 7),
('De-shedding Shampoo', 'Reduces shedding up to 90%', 'Grooming Supplies', 28, 200.00, 'Calacal Corporation', 6, 3),
('De-shedding Brush', 'Professional brush for de-shedding', 'Tools', 20, 160.00, 'Delfin Corporation', 4, 2),
('Flea & Tick Spray', 'Natural treatment for fleas and ticks', 'Treatments', 45, 180.00, 'Miguel Corporation', 10, 5),
('Flea Comb', 'Fine-toothed comb for flea removal', 'Tools', 30, 65.00, 'Natal Corporation', 8, 4),
('Scented Cologne', 'Pet-safe lavender fragrance', 'Accessories', 40, 80.00, 'Rivera Corporation', 10, 5),
('Paw Balm', 'Moisturizing balm for dry paws', 'Grooming Supplies', 55, 70.00, 'Calacal Corporation', 12, 6),
('Decorative Bows Set', 'Assorted pet-safe bows', 'Accessories', 80, 25.00, 'Delfin Corporation', 20, 10),
('Bandana Set', 'Colorful cotton bandanas', 'Accessories', 65, 35.00, 'Miguel Corporation', 15, 7);
-- Bath & Dry supplies
('Premium Shampoo', 'pH-balanced shampoo for all coat types', 'Grooming Supplies', 50, 150.00, 'Calacal Corporation', 10, 5),
('Detangling Conditioner', 'Reduces grooming time and prevents matting', 'Grooming Supplies', 45, 180.00, 'Delfin Corporation', 10, 5),
('Whitening Shampoo', 'Brightens white/light colored coats', 'Grooming Supplies', 30, 250.00, 'Miguel Corporation', 8, 4),
('Microfiber Drying Towels', 'Ultra-absorbent towels for quick drying', 'Grooming Supplies', 100, 50.00, 'Natal Corporation', 20, 10),

-- Nail care supplies
('Professional Nail Clippers', 'Stainless steel clippers for all sizes', 'Tools', 20, 250.00, 'Rivera Corporation', 5, 2),
('Nail Grinding File', 'Electric grinder with sanding attachments', 'Tools', 15, 350.00, 'Calacal Corporation', 3, 1),
('Nail Polish - Clear', 'Pet-safe clear polish for protection', 'Grooming Supplies', 25, 120.00, 'Delfin Corporation', 5, 2),

-- Ear care supplies
('Ear Cleaning Solution', 'Gentle enzymatic cleaner for wax removal', 'Grooming Supplies', 40, 85.00, 'Miguel Corporation', 10, 5),
('Cotton Swabs', 'Soft swabs for professional ear cleaning', 'Grooming Supplies', 200, 15.00, 'Natal Corporation', 50, 20),

-- Haircut & styling tools
('Professional Shears Set', 'Complete set of grooming shears', 'Tools', 12, 1200.00, 'Rivera Corporation', 2, 1),
('Clipper Machine', 'Heavy-duty clipper with adjustable blades', 'Tools', 8, 2500.00, 'Calacal Corporation', 2, 1),
('Slicker Brush', 'High-quality brush for detangling', 'Tools', 25, 180.00, 'Delfin Corporation', 5, 2),
('Undercoat Rake', 'Specialized rake for undercoat removal', 'Tools', 18, 220.00, 'Miguel Corporation', 4, 2),

-- Dental care supplies
('Dental Cleaning Solution', 'Enzymatic rinse for plaque reduction', 'Grooming Supplies', 35, 95.00, 'Natal Corporation', 8, 4),
('Pet Toothbrush Set', 'Soft-bristled toothbrushes for pets', 'Grooming Supplies', 60, 45.00, 'Rivera Corporation', 15, 7),

-- De-shedding supplies
('De-shedding Shampoo', 'Reduces shedding up to 90%', 'Grooming Supplies', 28, 200.00, 'Calacal Corporation', 6, 3),
('De-shedding Brush', 'Professional brush for de-shedding', 'Tools', 20, 160.00, 'Delfin Corporation', 4, 2),

-- Flea & tick treatment
('Flea & Tick Spray', 'Natural treatment for fleas and ticks', 'Treatments', 45, 180.00, 'Miguel Corporation', 10, 5),
('Flea Comb', 'Fine-toothed comb for flea removal', 'Tools', 30, 65.00, 'Natal Corporation', 8, 4),

-- Add-on products
('Scented Cologne', 'Pet-safe lavender fragrance', 'Accessories', 40, 80.00, 'Rivera Corporation', 10, 5),
('Paw Balm', 'Moisturizing balm for dry paws', 'Grooming Supplies', 55, 70.00, 'Calacal Corporation', 12, 6),
('Decorative Bows Set', 'Assorted pet-safe bows', 'Accessories', 80, 25.00, 'Delfin Corporation', 20, 10),
('Bandana Set', 'Colorful cotton bandanas', 'Accessories', 65, 35.00, 'Miguel Corporation', 15, 7);