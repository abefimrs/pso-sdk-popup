-- Database Schema for Payment System
-- MySQL/MariaDB

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    transaction_id VARCHAR(100) DEFAULT NULL,
    
    -- Customer Information
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    
    -- Order Details
    product_name VARCHAR(255) DEFAULT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'BDT',
    
    -- Status
    status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    
    -- Payment Gateway Response
    payment_data TEXT DEFAULT NULL, -- JSON data from gateway
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_order_id (order_id),
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_customer_email (customer_email),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment Logs Table (Optional - for tracking all payment attempts)
CREATE TABLE IF NOT EXISTS payment_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'initiated', 'success', 'failed', 'cancelled'
    gateway_response TEXT DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_order_id (order_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample Queries

-- Insert new order
-- INSERT INTO orders (order_id, customer_name, customer_email, customer_phone, product_name, amount, status)
-- VALUES ('ORD-123456', 'John Doe', 'john@example.com', '+8801712345678', 'Premium Plan', 99.99, 'pending');

-- Update order status after payment
-- UPDATE orders 
-- SET status = 'completed', 
--     transaction_id = 'TXN-789',
--     payment_data = '{"gateway": "sslcommerz", "card_type": "VISA"}',
--     updated_at = NOW()
-- WHERE order_id = 'ORD-123456';

-- Get order details
-- SELECT * FROM orders WHERE order_id = 'ORD-123456';

-- Get all completed orders
-- SELECT * FROM orders WHERE status = 'completed' ORDER BY created_at DESC;

-- Get total revenue
-- SELECT SUM(amount) as total_revenue FROM orders WHERE status = 'completed';
