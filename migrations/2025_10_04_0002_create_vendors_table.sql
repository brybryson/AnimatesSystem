-- Create vendors table for managing suppliers
CREATE TABLE IF NOT EXISTS vendors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Philippines',
    payment_terms VARCHAR(255),
    credit_limit DECIMAL(15,2) DEFAULT 0.00,
    tax_id VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Insert existing vendors with additional details
INSERT IGNORE INTO vendors (name, contact_person, email, phone, address, city, province, payment_terms, credit_limit, tax_id, notes) VALUES
('Calacal Corporation', 'Maria Calacal', 'maria.calacal@calacal.com', '+63 917 123 4567', '123 Industrial Ave', 'Makati', 'Metro Manila', 'Net 30 days', 500000.00, 'TIN-123-456-789', 'Primary supplier for grooming tools and equipment'),
('Delfin Corporation', 'Juan Delfin', 'juan.delfin@delfin.com', '+63 917 234 5678', '456 Commerce St', 'Quezon City', 'Metro Manila', 'Net 30 days', 300000.00, 'TIN-234-567-890', 'Specializes in grooming supplies and accessories'),
('Miguel Corporation', 'Ana Miguel', 'ana.miguel@miguel.com', '+63 917 345 6789', '789 Business Rd', 'Pasig', 'Metro Manila', 'Net 15 days', 400000.00, 'TIN-345-678-901', 'Reliable supplier for pet care products'),
('Natal Corporation', 'Pedro Natal', 'pedro.natal@natal.com', '+63 917 456 7890', '321 Enterprise Blvd', 'Taguig', 'Metro Manila', 'Net 30 days', 250000.00, 'TIN-456-789-012', 'Quality grooming supplies and cotton products'),
('Rivera Corporation', 'Carmen Rivera', 'carmen.rivera@rivera.com', '+63 917 567 8901', '654 Trade Center', 'Mandaluyong', 'Metro Manila', 'Net 30 days', 350000.00, 'TIN-567-890-123', 'Professional grooming tools and equipment supplier');