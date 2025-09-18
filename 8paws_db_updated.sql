-- =====================================================
-- 8PAWS_DB UPDATED VERSION WITH DISCOUNT SUPPORT
-- =====================================================
-- This file is an updated version of 8paws_db (CURRENT).sql
-- Added discount_amount column to sales_transactions table
-- Updated for billing management system
-- Generated on: 2025-01-28
-- =====================================================

-- First, let's add the missing discount_amount column to existing sales_transactions table
-- This should be run on your existing database before importing the full structure

-- ALTER TABLE `sales_transactions` ADD COLUMN `discount_amount` decimal(10,2) DEFAULT 0.00 AFTER `amount`;

-- =====================================================
-- COMPLETE DATABASE STRUCTURE (Updated)
-- =====================================================

-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Aug 27, 2025 at 11:10 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `8paws_db`
--

DELIMITER $$
--
-- Procedures
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `LinkCustomerToUser` (IN `p_user_id` INT, IN `p_phone` VARCHAR(20))   BEGIN
    DECLARE customer_exists INT DEFAULT 0;
    
    -- Check if customer exists with this phone
    SELECT COUNT(*) INTO customer_exists 
    FROM customers 
    WHERE phone = p_phone AND user_id IS NULL;
    
    IF customer_exists > 0 THEN
        -- Update customer record to link with user
        UPDATE customers 
        SET user_id = p_user_id, 
            created_via = 'online',
            updated_at = NOW()
        WHERE phone = p_phone AND user_id IS NULL;
        
        -- Link all pets of this customer to the user
        INSERT INTO user_pets (user_id, pet_id, is_primary_owner)
        SELECT p_user_id, p.id, TRUE
        FROM pets p
        JOIN customers c ON p.customer_id = c.id
        WHERE c.phone = p_phone AND c.user_id = p_user_id;
        
        -- Link all bookings to the user
        UPDATE bookings b
        JOIN pets p ON b.pet_id = p.id
        JOIN customers c ON p.customer_id = c.id
        SET b.user_id = p_user_id, 
            b.booking_type = 'online',
            b.updated_at = NOW()
        WHERE c.user_id = p_user_id AND b.user_id IS NULL;
    END IF;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `UpdatePetStatusByRFID` (IN `p_custom_uid` VARCHAR(8), IN `p_tap_count` INT)   BEGIN
    DECLARE v_booking_id INT;
    DECLARE v_current_status VARCHAR(20);
    DECLARE v_new_status VARCHAR(20);
    
    
    SELECT id, status INTO v_booking_id, v_current_status
    FROM bookings 
    WHERE custom_rfid = p_custom_uid 
    AND status NOT IN ('completed', 'cancelled')
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF v_booking_id IS NOT NULL THEN
        
        SET v_new_status = CASE p_tap_count
            WHEN 2 THEN 'bathing'
            WHEN 3 THEN 'grooming'
            WHEN 4 THEN 'ready'
            ELSE v_current_status
        END;
        
        
        IF v_new_status != v_current_status THEN
            UPDATE bookings 
            SET status = v_new_status,
                actual_completion = CASE WHEN v_new_status = 'completed' THEN NOW() ELSE actual_completion END,
                updated_at = NOW()
            WHERE id = v_booking_id;
            
            
            INSERT INTO status_updates (booking_id, status, notes)
            VALUES (v_booking_id, v_new_status, CONCAT('Status updated via RFID tap #', p_tap_count));
        END IF;
    END IF;
END$$

DELIMITER ;

-- =====================================================
-- TABLES WITH UPDATED STRUCTURE
-- =====================================================

-- Updated sales_transactions table with discount_amount column
CREATE TABLE `sales_transactions` (
  `id` int(11) NOT NULL,
  `booking_id` int(11) NOT NULL,
  `transaction_reference` varchar(50) DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `payment_method` varchar(20) DEFAULT NULL,
  `payment_platform` varchar(50) DEFAULT NULL,
  `status` enum('completed','voided','refunded') DEFAULT 'completed',
  `void_reason` text DEFAULT NULL,
  `voided_by` int(11) DEFAULT NULL,
  `voided_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insert sample data with discount_amount
INSERT INTO `sales_transactions` (`id`, `booking_id`, `transaction_reference`, `amount`, `discount_amount`, `payment_method`, `payment_platform`, `status`, `void_reason`, `voided_by`, `voided_at`, `created_at`) VALUES
(2, 34, 'TXN-20250101-TEST001', 600.00, 0.00, 'cash', NULL, 'completed', NULL, NULL, NULL, '2025-08-27 20:30:57'),
(3, 35, 'TXN-20250101-TEST002', 400.00, 0.00, 'online', 'gcash', 'voided', 'customer_request', NULL, NULL, '2025-08-27 21:00:11', '2025-08-27 20:31:04'),
(4, 36, 'TXN-20250101-TEST003', 350.00, 0.00, 'cash', NULL, 'completed', NULL, NULL, NULL, '2025-08-27 20:31:04'),
(5, 37, 'TXN-20250827-B8CB8E97', 600.00, 0.00, 'cash', NULL, 'completed', NULL, NULL, NULL, '2025-08-26 20:41:46'),
(6, 102, 'TXN-20250827-090E869C', 1050.00, 0.00, 'cash', '', 'completed', NULL, NULL, NULL, '2025-08-26 20:45:26'),
(7, 103, 'TXN-20250827-262AC1ED', 500.00, 0.00, 'cash', '', 'completed', NULL, NULL, NULL, '2025-08-26 20:24:38'),
(8, 105, 'TXN-20250828-04608780', 200.00, 0.00, 'cash', '', 'completed', NULL, NULL, NULL, '2025-08-27 20:09:50');

-- =====================================================
-- IMPORTANT: Copy the rest of your original tables here
-- =====================================================
-- You need to copy all the remaining CREATE TABLE statements from your original
-- 8paws_db (CURRENT).sql file, starting from line 1124 onwards
-- This includes: services, services2, service_pricing, and all other tables

-- =====================================================
-- UPDATES FOR BILLING SYSTEM
-- =====================================================

-- Update payment_status enum to remove 'pending' if it exists
-- ALTER TABLE `bookings` MODIFY COLUMN `payment_status` enum('paid','unpaid','overdue') DEFAULT 'unpaid';

-- Update billing table payment_status enum if it exists
-- ALTER TABLE `billing` MODIFY COLUMN `payment_status` enum('paid','unpaid','overdue') DEFAULT 'unpaid';

-- =====================================================
-- NOTES FOR IMPLEMENTATION
-- =====================================================
-- 1. This file adds the discount_amount column to sales_transactions
-- 2. The discount_amount column defaults to 0.00 for existing records
-- 3. New transactions will properly track discounts
-- 4. The billing system can now calculate proper totals with discounts
-- 5. Email receipts will show correct discount amounts
-- =====================================================

