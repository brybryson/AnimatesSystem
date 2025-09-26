-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Sep 22, 2025 at 09:19 AM
-- Server version: 10.4.28-MariaDB
-- PHP Version: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `animates`
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

--
-- Functions
--
CREATE DEFINER=`root`@`localhost` FUNCTION `GetUserActiveBookingsCount` (`p_user_id` INT) RETURNS INT(11) DETERMINISTIC READS SQL DATA BEGIN
    DECLARE booking_count INT DEFAULT 0;
    
    SELECT COUNT(*) INTO booking_count
    FROM bookings b
    WHERE b.user_id = p_user_id 
    AND b.status NOT IN ('completed', 'cancelled');
    
    RETURN booking_count;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `appointments`
--

CREATE TABLE `appointments` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `pet_id` int(11) NOT NULL,
  `appointment_date` date NOT NULL,
  `appointment_time` time NOT NULL,
  `estimated_duration` int(11) DEFAULT 120,
  `status` enum('scheduled','confirmed','in_progress','completed','cancelled','no_show') DEFAULT 'scheduled',
  `total_amount` decimal(10,2) DEFAULT 0.00,
  `special_instructions` text DEFAULT NULL,
  `staff_notes` text DEFAULT NULL,
  `reminder_sent` tinyint(1) DEFAULT 0,
  `confirmation_sent` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `appointment_services`
--

CREATE TABLE `appointment_services` (
  `id` int(11) NOT NULL,
  `appointment_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `price` decimal(8,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `app_config`
--

CREATE TABLE `app_config` (
  `id` int(11) NOT NULL,
  `config_key` varchar(100) NOT NULL,
  `config_value` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `app_config`
--

INSERT INTO `app_config` (`id`, `config_key`, `config_value`, `created_at`, `updated_at`) VALUES
(1, 'last_firebase_sync', '1970-01-01 00:00:00', '2025-08-16 18:41:01', '2025-08-16 18:41:01');

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `id` int(11) NOT NULL,
  `pet_id` int(11) NOT NULL,
  `rfid_card_id` int(11) DEFAULT NULL,
  `rfid_tag_id` int(11) DEFAULT NULL,
  `custom_rfid` varchar(8) DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `status` enum('checked-in','bathing','grooming','ready','completed','cancelled') DEFAULT 'checked-in',
  `payment_status` enum('pending','paid','cancelled') DEFAULT 'pending',
  `payment_method` varchar(50) DEFAULT NULL,
  `payment_reference` varchar(100) DEFAULT NULL,
  `payment_platform` varchar(50) DEFAULT NULL,
  `amount_tendered` decimal(10,2) DEFAULT NULL,
  `change_amount` decimal(10,2) DEFAULT NULL,
  `payment_date` timestamp NULL DEFAULT NULL,
  `check_in_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `estimated_completion` timestamp NULL DEFAULT NULL,
  `actual_completion` timestamp NULL DEFAULT NULL,
  `pickup_time` timestamp NULL DEFAULT NULL,
  `staff_notes` text DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `user_id` int(11) DEFAULT NULL,
  `booking_type` enum('walk_in','online') DEFAULT 'walk_in',
  `welcome_email_sent` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bookings`
--

INSERT INTO `bookings` (`id`, `pet_id`, `rfid_card_id`, `rfid_tag_id`, `custom_rfid`, `total_amount`, `status`, `payment_status`, `payment_method`, `payment_reference`, `payment_platform`, `amount_tendered`, `change_amount`, `payment_date`, `check_in_time`, `estimated_completion`, `actual_completion`, `pickup_time`, `staff_notes`, `updated_by`, `created_at`, `updated_at`, `user_id`, `booking_type`, `welcome_email_sent`) VALUES
(1, 0, 0, NULL, '3T4TO70Z', 200.00, 'grooming', 'pending', NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 04:25:50', '2025-08-28 06:25:50', '2025-08-28 04:31:08', NULL, NULL, NULL, '2025-08-28 04:25:50', '2025-08-28 04:43:12', NULL, 'walk_in', 1),
(2, 0, 0, NULL, 'TVTPIV8O', 650.00, 'completed', 'paid', 'cash', '', '', 600.00, 48.00, '2025-08-28 12:01:02', '2025-08-28 04:34:08', '2025-08-28 06:34:08', '2025-08-28 12:01:02', NULL, NULL, NULL, '2025-08-28 04:34:08', '2025-08-28 12:01:02', NULL, 'walk_in', 1),
(3, 0, NULL, NULL, 'TVTPIV8O', 0.00, 'completed', 'pending', NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 14:37:37', NULL, '2025-08-28 14:49:12', NULL, NULL, NULL, '2025-08-28 14:37:37', '2025-08-28 14:49:12', NULL, 'walk_in', 0),
(7, 6, 1, NULL, 'TVTPIV8O', 200.00, 'checked-in', 'pending', NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 17:36:31', '2025-08-28 19:36:31', NULL, NULL, NULL, NULL, '2025-08-28 17:36:31', '2025-08-28 17:36:40', NULL, 'walk_in', 1),
(10, 9, 3, NULL, 'YRTIHQ38', 950.00, 'completed', 'paid', 'cash', '', '', 900.00, 93.00, '2025-08-28 17:57:13', '2025-08-28 17:51:13', '2025-08-28 19:51:13', '2025-08-28 17:57:13', NULL, NULL, NULL, '2025-08-28 17:51:13', '2025-08-28 17:57:13', NULL, 'walk_in', 1),
(11, 10, 4, NULL, 'P2DRPMI2', 1730.00, 'completed', 'pending', NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 18:17:47', '2025-08-28 20:17:47', NULL, NULL, NULL, NULL, '2025-08-28 18:17:47', '2025-08-28 23:50:48', NULL, 'walk_in', 1),
(12, 11, 3, NULL, 'S3IG1JS2', 150.00, 'completed', 'paid', 'cash', '', '', 127.00, 0.00, '2025-08-28 23:44:44', '2025-08-28 20:57:50', '2025-08-28 22:57:50', '2025-08-28 23:44:44', NULL, NULL, NULL, '2025-08-28 20:57:50', '2025-08-28 23:44:44', NULL, 'walk_in', 1),
(13, 12, 3, NULL, 'IVW48KZN', 200.00, 'completed', 'pending', NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 22:10:53', '2025-08-29 00:10:53', NULL, NULL, NULL, NULL, '2025-08-28 22:10:53', '2025-08-28 23:31:58', NULL, 'walk_in', 1),
(14, 13, 3, NULL, 'BGJU7IJ6', 750.00, 'completed', 'pending', NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 23:34:22', '2025-08-29 01:34:22', '2025-08-28 23:39:11', NULL, NULL, NULL, '2025-08-28 23:34:22', '2025-08-28 23:39:11', NULL, 'walk_in', 1),
(15, 14, 4, NULL, 'VCFGCGLX', 600.00, 'completed', 'paid', 'cash', '', '', 550.00, 40.00, '2025-08-29 00:59:41', '2025-08-29 00:53:34', '2025-08-29 02:53:34', '2025-08-29 00:59:41', NULL, NULL, NULL, '2025-08-29 00:53:34', '2025-08-29 00:59:41', NULL, 'walk_in', 1),
(16, 15, 3, NULL, 'BGJU7IJ6', 920.00, 'checked-in', 'pending', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-18 17:10:43', '2025-09-18 19:10:43', NULL, NULL, NULL, NULL, '2025-09-18 17:10:43', '2025-09-18 17:10:49', NULL, 'walk_in', 1);

-- --------------------------------------------------------

--
-- Table structure for table `booking_services`
--

CREATE TABLE `booking_services` (
  `id` int(11) NOT NULL,
  `booking_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `pet_size` enum('small','medium','large','extra_large') DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `booking_services`
--

INSERT INTO `booking_services` (`id`, `booking_id`, `service_id`, `price`, `pet_size`) VALUES
(1, 0, 0, 500.00, NULL),
(2, 0, 0, 200.00, NULL),
(3, 0, 0, 200.00, NULL),
(4, 0, 0, 450.00, NULL),
(5, 7, 2, 200.00, NULL),
(8, 10, 2, 200.00, NULL),
(9, 10, 1, 600.00, NULL),
(10, 10, 4, 150.00, NULL),
(11, 11, 1, 750.00, NULL),
(12, 11, 5, 280.00, NULL),
(13, 11, 3, 450.00, NULL),
(14, 11, 6, 100.00, NULL),
(15, 11, 4, 150.00, NULL),
(16, 12, 7, 150.00, NULL),
(17, 13, 2, 200.00, NULL),
(18, 14, 1, 750.00, NULL),
(19, 15, 2, 200.00, NULL),
(20, 15, 5, 300.00, NULL),
(21, 15, 6, 100.00, NULL),
(22, 16, 8, 250.00, NULL),
(23, 16, 7, 120.00, NULL),
(24, 16, 2, 200.00, NULL),
(25, 16, 5, 200.00, NULL),
(26, 16, 4, 150.00, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `emergency_contact` varchar(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `user_id` int(11) DEFAULT NULL,
  `created_via` enum('walk_in','online') DEFAULT 'walk_in'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `name`, `phone`, `email`, `address`, `emergency_contact`, `created_at`, `updated_at`, `user_id`, `created_via`) VALUES
(1, 'Shiva Natal', '0934-782-3472', 'shivs.natal@gmail.com', NULL, NULL, '2025-08-28 04:22:04', '2025-08-28 21:58:43', NULL, 'walk_in'),
(2, 'Shiva Natal', '0934-782-3472', 'shivs.natal@gmail.com', NULL, NULL, '2025-08-28 04:25:50', '2025-08-28 21:58:33', NULL, 'walk_in'),
(3, 'Shiva Natal', '0934-782-3472', 'shivs.natal@gmail.com', NULL, NULL, '2025-08-28 04:34:08', '2025-08-28 21:58:12', NULL, 'walk_in'),
(4, 'Shiva Natal', '0384-923-8493', 'shivs.natal@gmail.com', NULL, NULL, '2025-08-28 17:36:31', '2025-08-28 21:59:10', NULL, 'walk_in'),
(5, 'shiva', '0976-544-4665', 'shivs.natal@gmail.com', NULL, NULL, '2025-08-28 17:51:13', '2025-08-28 17:51:13', NULL, 'walk_in'),
(6, 'shiva', '0976-544-4665', 'shivs.natal@gmail.com', NULL, NULL, '2025-08-28 18:17:47', '2025-08-28 18:17:47', NULL, 'walk_in'),
(7, 'Shiva Natal', '0976-544-4665', 'shivs.natal@gmail.com', NULL, NULL, '2025-08-28 20:57:50', '2025-08-28 20:57:50', NULL, 'walk_in'),
(8, 'shiva', '0976-544-4665', 'shivs.natal@gmail.com', NULL, NULL, '2025-08-28 22:10:53', '2025-08-28 22:10:53', NULL, 'walk_in'),
(9, 'Shiva Natal', '0976-544-4665', 'shivs.natal@gmail.com', NULL, NULL, '2025-08-28 23:34:22', '2025-08-28 23:34:22', NULL, 'walk_in'),
(10, 'Loyd Rivera', '0998-312-3123', 'shivs.natal@gmail.com', NULL, NULL, '2025-08-29 00:53:34', '2025-08-29 00:53:34', NULL, 'walk_in'),
(11, 'Bryant Iverson Cervantes Melliza', '0943-135-9316', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-18 17:10:43', '2025-09-18 17:10:43', NULL, 'walk_in');

-- --------------------------------------------------------

--
-- Table structure for table `pets`
--

CREATE TABLE `pets` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(50) NOT NULL,
  `pet_type` varchar(50) DEFAULT NULL,
  `breed` varchar(255) NOT NULL,
  `age_range` enum('puppy','young','adult','senior') DEFAULT NULL,
  `size` enum('small','medium','large','xlarge') DEFAULT NULL,
  `special_notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pets`
--

INSERT INTO `pets` (`id`, `customer_id`, `name`, `type`, `pet_type`, `breed`, `age_range`, `size`, `special_notes`, `created_at`, `updated_at`) VALUES
(1, 0, 'Buddy', 'dog', 'dog', 'boxer', 'young', NULL, '', '2025-08-28 04:22:04', '2025-08-28 04:22:04'),
(2, 0, 'Buddy', 'dog', 'dog', 'bluetick', NULL, NULL, '', '2025-08-28 04:25:50', '2025-08-28 04:25:50'),
(3, 0, 'Buddy', 'dog', 'dog', 'brabancon', 'young', NULL, '', '2025-08-28 04:34:08', '2025-08-28 04:34:08'),
(4, 1, 'Test Pet', 'dog', NULL, 'mixed', NULL, NULL, NULL, '2025-08-28 14:37:37', '2025-08-28 14:37:37'),
(6, 4, 'Test', 'dog', 'dog', 'boxer', 'young', NULL, '', '2025-08-28 17:36:31', '2025-08-28 17:36:31'),
(9, 5, 'Buddy', 'dog', 'dog', 'african', 'young', NULL, '', '2025-08-28 17:51:13', '2025-08-28 17:51:13'),
(10, 6, 'Buddy', 'dog', 'dog', 'brabancon', 'young', NULL, '', '2025-08-28 18:17:47', '2025-08-28 18:17:47'),
(11, 7, 'Buddy', 'dog', 'dog', 'bulldog', 'senior', NULL, '', '2025-08-28 20:57:50', '2025-08-28 20:57:50'),
(12, 8, 'Buddy', 'dog', 'dog', 'cavapoo', 'senior', NULL, '', '2025-08-28 22:10:53', '2025-08-28 22:10:53'),
(13, 9, 'Buddy', 'dog', 'dog', 'basenji', 'young', NULL, '', '2025-08-28 23:34:22', '2025-08-28 23:34:22'),
(14, 10, 'Buddy', 'dog', 'dog', 'doberman', 'adult', NULL, '', '2025-08-29 00:53:34', '2025-08-29 00:53:34'),
(15, 11, 'owley', 'cat', 'cat', 'American Bobtail', 'young', NULL, '', '2025-09-18 17:10:43', '2025-09-18 17:10:43');

-- --------------------------------------------------------

--
-- Table structure for table `pets_backup`
--

CREATE TABLE `pets_backup` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(50) NOT NULL,
  `pet_type` varchar(50) DEFAULT NULL,
  `breed` varchar(255) NOT NULL,
  `age_range` enum('puppy','young','adult','senior') DEFAULT NULL,
  `size` enum('small','medium','large','xlarge') DEFAULT NULL,
  `special_notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pets_backup`
--

INSERT INTO `pets_backup` (`id`, `customer_id`, `name`, `type`, `pet_type`, `breed`, `age_range`, `size`, `special_notes`, `created_at`, `updated_at`) VALUES
(0, 1, 'Test Pet', 'dog', NULL, 'mixed', NULL, NULL, NULL, '2025-08-28 14:37:37', '2025-08-28 14:37:37'),
(1, 0, 'Buddy', 'dog', 'dog', 'boxer', 'young', NULL, '', '2025-08-28 04:22:04', '2025-08-28 04:22:04'),
(2, 0, 'Buddy', 'dog', 'dog', 'bluetick', NULL, NULL, '', '2025-08-28 04:25:50', '2025-08-28 04:25:50'),
(3, 0, 'Buddy', 'dog', 'dog', 'brabancon', 'young', NULL, '', '2025-08-28 04:34:08', '2025-08-28 04:34:08');

-- --------------------------------------------------------

--
-- Table structure for table `pet_sizes`
--

CREATE TABLE `pet_sizes` (
  `id` int(11) NOT NULL,
  `size_code` enum('small','medium','large','extra_large') NOT NULL,
  `display_name` varchar(50) NOT NULL,
  `weight_range` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `sort_order` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pet_sizes`
--

INSERT INTO `pet_sizes` (`id`, `size_code`, `display_name`, `weight_range`, `description`, `sort_order`) VALUES
(1, 'small', 'Small', '0-15 lbs', 'Small pets (e.g., Chihuahua, Cat)', 1),
(2, 'medium', 'Medium', '16-40 lbs', 'Medium pets (e.g., Beagle, Cocker Spaniel)', 2),
(3, 'large', 'Large', '41-70 lbs', 'Large pets (e.g., Golden Retriever, German Shepherd)', 3),
(4, 'extra_large', 'Extra Large', '71+ lbs', 'Extra large pets (e.g., Great Dane, St. Bernard)', 4);

-- --------------------------------------------------------

--
-- Table structure for table `rfid_cards`
--

CREATE TABLE `rfid_cards` (
  `id` int(11) NOT NULL,
  `card_uid` varchar(50) NOT NULL,
  `custom_uid` varchar(8) NOT NULL,
  `firebase_doc_id` varchar(100) DEFAULT NULL,
  `tap_count` int(11) DEFAULT 1,
  `max_taps` int(11) DEFAULT 5,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_active` tinyint(1) DEFAULT 1,
  `last_firebase_sync` timestamp NULL DEFAULT NULL,
  `validation_time_ms` int(11) DEFAULT 3000,
  `device_source` varchar(50) DEFAULT 'ESP32-RFID-Scanner',
  `status` enum('active','expired','disabled') DEFAULT 'active',
  `is_currently_booked` tinyint(1) DEFAULT 0 COMMENT 'Indicates if the card is currently assigned to an active booking'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `rfid_cards`
--

INSERT INTO `rfid_cards` (`id`, `card_uid`, `custom_uid`, `firebase_doc_id`, `tap_count`, `max_taps`, `created_at`, `updated_at`, `is_active`, `last_firebase_sync`, `validation_time_ms`, `device_source`, `status`, `is_currently_booked`) VALUES
(5, '73:77:f8:39', '23S8BY3D', NULL, 1, 3, '2025-09-18 17:29:17', '2025-09-22 06:58:02', 1, '2025-09-22 06:58:02', 3000, 'ESP32-RFID-Scanner', 'active', 0);

-- --------------------------------------------------------

--
-- Table structure for table `rfid_tags`
--

CREATE TABLE `rfid_tags` (
  `id` int(11) NOT NULL,
  `tag_id` varchar(20) NOT NULL,
  `pet_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `assigned_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rfid_tap_history`
--

CREATE TABLE `rfid_tap_history` (
  `id` int(11) NOT NULL,
  `rfid_card_id` int(11) DEFAULT NULL,
  `card_uid` varchar(50) NOT NULL,
  `custom_uid` varchar(8) NOT NULL,
  `tap_number` int(11) NOT NULL,
  `firebase_doc_id` varchar(100) DEFAULT NULL,
  `tapped_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `device_info` varchar(100) DEFAULT NULL,
  `wifi_network` varchar(100) DEFAULT NULL,
  `signal_strength` int(11) DEFAULT NULL,
  `validation_status` enum('approved','pending','failed') DEFAULT 'approved',
  `readable_time` varchar(50) DEFAULT NULL,
  `timestamp_value` timestamp NULL DEFAULT NULL,
  `rfid_scanner_status` varchar(20) DEFAULT 'OK',
  `project_id` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `rfid_tap_history`
--

INSERT INTO `rfid_tap_history` (`id`, `rfid_card_id`, `card_uid`, `custom_uid`, `tap_number`, `firebase_doc_id`, `tapped_at`, `device_info`, `wifi_network`, `signal_strength`, `validation_status`, `readable_time`, `timestamp_value`, `rfid_scanner_status`, `project_id`) VALUES
(1, 1, '73:77:f8:39', 'TVTPIV8O', 2, NULL, '2025-08-28 14:38:46', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -53, 'approved', '2025-08-28 12:28:47', '2025-08-28 04:28:47', 'OK', NULL),
(2, 0, '73:77:f8:39', 'WRFXVJTV', 2, NULL, '2025-08-28 04:19:37', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -51, 'approved', '2025-08-28 12:19:38', '2025-08-28 04:19:38', 'OK', NULL),
(3, 0, '73:77:f8:39', 'WRFXVJTV', 3, NULL, '2025-08-28 04:19:53', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -53, 'approved', '2025-08-28 12:19:54', '2025-08-28 04:19:54', 'OK', NULL),
(4, 0, '73:77:f8:39', 'WRFXVJTV', 4, NULL, '2025-08-28 04:20:12', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -51, 'approved', '2025-08-28 12:20:10', '2025-08-28 04:20:10', 'OK', NULL),
(5, 0, '73:77:f8:39', 'WRFXVJTV', 5, NULL, '2025-08-28 04:21:06', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -52, 'approved', '2025-08-28 12:21:07', '2025-08-28 04:21:07', 'OK', NULL),
(6, 0, '73:77:f8:39', 'UWRE2YQ4', 1, NULL, '2025-08-28 04:21:21', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -50, 'approved', '2025-08-28 12:21:22', '2025-08-28 04:21:22', 'OK', NULL),
(7, 0, '73:77:f8:39', 'UWRE2YQ4', 2, NULL, '2025-08-28 04:21:36', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -53, 'approved', '2025-08-28 12:21:37', '2025-08-28 04:21:37', 'OK', NULL),
(8, 0, '73:77:f8:39', 'UWRE2YQ4', 3, NULL, '2025-08-28 04:24:01', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -53, 'approved', '2025-08-28 12:24:02', '2025-08-28 04:24:02', 'OK', NULL),
(9, 0, '73:77:f8:39', 'UWRE2YQ4', 3, NULL, '2025-08-28 04:24:04', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -53, 'approved', '2025-08-28 12:24:05', '2025-08-28 04:24:05', 'OK', NULL),
(10, 0, '73:77:f8:39', 'UWRE2YQ4', 3, NULL, '2025-08-28 04:24:17', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -50, 'approved', '2025-08-28 12:24:19', '2025-08-28 04:24:19', 'OK', NULL),
(11, 0, '73:77:f8:39', 'UWRE2YQ4', 4, NULL, '2025-08-28 04:24:42', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -50, 'approved', '2025-08-28 12:24:43', '2025-08-28 04:24:43', 'OK', NULL),
(12, 0, '73:77:f8:39', 'UWRE2YQ4', 5, NULL, '2025-08-28 04:25:28', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -52, 'approved', '2025-08-28 12:25:30', '2025-08-28 04:25:30', 'OK', NULL),
(13, 0, '73:77:f8:39', '3T4TO70Z', 1, NULL, '2025-08-28 04:25:43', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -53, 'approved', '2025-08-28 12:25:44', '2025-08-28 04:25:44', 'OK', NULL),
(14, 0, '73:77:f8:39', '3T4TO70Z', 2, NULL, '2025-08-28 04:29:37', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -59, 'approved', '2025-08-28 12:29:36', '2025-08-28 04:29:36', 'OK', NULL),
(15, 0, '73:77:f8:39', '3T4TO70Z', 2, NULL, '2025-08-28 04:29:40', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -56, 'approved', '2025-08-28 12:29:41', '2025-08-28 04:29:41', 'OK', NULL),
(16, 0, '73:77:f8:39', '3T4TO70Z', 2, NULL, '2025-08-28 04:30:00', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -49, 'approved', '2025-08-28 12:30:01', '2025-08-28 04:30:01', 'OK', NULL),
(17, 0, '73:77:f8:39', '3T4TO70Z', 3, NULL, '2025-08-28 04:30:32', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -50, 'approved', '2025-08-28 12:30:33', '2025-08-28 04:30:33', 'OK', NULL),
(18, 0, '73:77:f8:39', '3T4TO70Z', 4, NULL, '2025-08-28 04:30:46', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -52, 'approved', '2025-08-28 12:30:47', '2025-08-28 04:30:47', 'OK', NULL),
(19, 0, '73:77:f8:39', '3T4TO70Z', 5, NULL, '2025-08-28 04:31:08', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -53, 'approved', '2025-08-28 12:31:09', '2025-08-28 04:31:09', 'OK', NULL),
(20, 0, '73:77:f8:39', 'TVTPIV8O', 1, NULL, '2025-08-28 04:34:04', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -53, 'approved', '2025-08-28 12:34:05', '2025-08-28 04:34:05', 'OK', NULL),
(21, 0, '73:77:f8:39', 'TVTPIV8O', 2, NULL, '2025-08-28 04:34:30', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -55, 'approved', '2025-08-28 12:34:31', '2025-08-28 04:34:31', 'OK', NULL),
(22, 0, '73:77:f8:39', 'TVTPIV8O', 3, NULL, '2025-08-28 04:43:12', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -52, 'approved', '2025-08-28 12:43:13', '2025-08-28 04:43:13', 'OK', NULL),
(23, 0, '73:77:f8:39', 'TVTPIV8O', 4, NULL, '2025-08-28 04:46:14', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -49, 'approved', '2025-08-28 12:46:16', '2025-08-28 04:46:16', 'OK', NULL),
(24, 0, '73:77:f8:39', 'TVTPIV8O', 5, NULL, '2025-08-28 04:46:51', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -50, 'approved', '2025-08-28 12:46:52', '2025-08-28 04:46:52', 'OK', NULL),
(25, 0, '73:77:f8:39', 'TVTPIV8O', 2, NULL, '2025-08-28 14:32:04', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -53, 'approved', '2025-08-28 12:28:47', '2025-08-28 04:28:47', 'OK', NULL),
(26, 0, '73:77:f8:39', 'TVTPIV8O', 2, NULL, '2025-08-28 14:32:35', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -53, 'approved', '2025-08-28 12:28:47', '2025-08-28 04:28:47', 'OK', NULL),
(27, 1, '73:77:f8:39', 'TVTPIV8O', 3, NULL, '2025-08-28 14:45:49', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -53, 'approved', '2025-08-28 12:28:47', '2025-08-28 04:28:47', 'OK', NULL),
(28, 1, '73:77:f8:39', 'TVTPIV8O', 4, NULL, '2025-08-28 14:47:36', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -53, 'approved', '2025-08-28 12:28:47', '2025-08-28 04:28:47', 'OK', NULL),
(29, 1, '73:77:f8:39', 'TVTPIV8O', 1, NULL, '2025-08-28 14:49:12', 'ESP32-RFID-Scanner', 'HUAWEI-2.4G-x6Nj', -53, 'approved', '2025-08-28 12:28:47', '2025-08-28 04:28:47', 'OK', NULL),
(31, 1, '73:77:f8:39', '0BQFJXO5', 2, NULL, '2025-08-28 17:48:12', 'ESP32-RFID-Scanner', 'Shiva', -55, 'approved', '2025-08-29 01:48:11', '2025-08-28 17:48:11', 'OK', NULL),
(32, 1, '73:77:f8:39', '0BQFJXO5', 3, NULL, '2025-08-28 17:48:29', 'ESP32-RFID-Scanner', 'Shiva', -54, 'approved', '2025-08-29 01:48:28', '2025-08-28 17:48:28', 'OK', NULL),
(33, 1, '73:77:f8:39', '0BQFJXO5', 4, NULL, '2025-08-28 17:48:44', 'ESP32-RFID-Scanner', 'Shiva', -54, 'approved', '2025-08-29 01:48:43', '2025-08-28 17:48:43', 'OK', NULL),
(34, 1, '73:77:f8:39', '0BQFJXO5', 5, NULL, '2025-08-28 17:49:01', 'ESP32-RFID-Scanner', 'Shiva', -53, 'approved', '2025-08-29 01:49:01', '2025-08-28 17:49:01', 'OK', NULL),
(35, 1, '73:77:f8:39', 'U7GDOQDY', 1, NULL, '2025-08-28 17:49:28', 'ESP32-RFID-Scanner', 'Shiva', -54, 'approved', '2025-08-29 01:49:27', '2025-08-28 17:49:27', 'OK', NULL),
(36, 3, 'c2:48:94:ab', 'VCYG2WDO', 3, NULL, '2025-08-28 17:50:18', 'ESP32-RFID-Scanner', 'Shiva', -54, 'approved', '2025-08-29 01:50:17', '2025-08-28 17:50:17', 'OK', NULL),
(37, 3, 'c2:48:94:ab', 'VCYG2WDO', 4, NULL, '2025-08-28 17:50:33', 'ESP32-RFID-Scanner', 'Shiva', -51, 'approved', '2025-08-29 01:50:32', '2025-08-28 17:50:32', 'OK', NULL),
(38, 3, 'c2:48:94:ab', 'VCYG2WDO', 5, NULL, '2025-08-28 17:50:47', 'ESP32-RFID-Scanner', 'Shiva', -52, 'approved', '2025-08-29 01:50:47', '2025-08-28 17:50:47', 'OK', NULL),
(39, 3, 'c2:48:94:ab', 'YRTIHQ38', 1, NULL, '2025-08-28 17:51:05', 'ESP32-RFID-Scanner', 'Shiva', -53, 'approved', '2025-08-29 01:51:04', '2025-08-28 17:51:04', 'OK', NULL),
(40, 3, 'c2:48:94:ab', 'YRTIHQ38', 2, NULL, '2025-08-28 17:52:12', 'ESP32-RFID-Scanner', 'Shiva', -54, 'approved', '2025-08-29 01:52:11', '2025-08-28 17:52:11', 'OK', NULL),
(41, 3, 'c2:48:94:ab', 'YRTIHQ38', 3, NULL, '2025-08-28 17:52:44', 'ESP32-RFID-Scanner', 'Shiva', -56, 'approved', '2025-08-29 01:52:43', '2025-08-28 17:52:43', 'OK', NULL),
(42, 3, 'c2:48:94:ab', 'YRTIHQ38', 4, NULL, '2025-08-28 17:53:12', 'ESP32-RFID-Scanner', 'Shiva', -58, 'approved', '2025-08-29 01:53:11', '2025-08-28 17:53:11', 'OK', NULL),
(43, 3, 'c2:48:94:ab', 'YRTIHQ38', 5, NULL, '2025-08-28 17:53:38', 'ESP32-RFID-Scanner', 'Shiva', -56, 'approved', '2025-08-29 01:53:37', '2025-08-28 17:53:37', 'OK', NULL),
(44, 4, '53:89:08:02', 'KDAIOEJQ', 2, NULL, '2025-08-28 18:15:30', 'ESP32-RFID-Scanner', 'Shiva', -55, 'approved', '2025-08-29 02:15:30', '2025-08-28 18:15:30', 'OK', NULL),
(45, 4, '53:89:08:02', 'KDAIOEJQ', 3, NULL, '2025-08-28 18:15:46', 'ESP32-RFID-Scanner', 'Shiva', -54, 'approved', '2025-08-29 02:15:45', '2025-08-28 18:15:45', 'OK', NULL),
(46, 4, '53:89:08:02', 'KDAIOEJQ', 4, NULL, '2025-08-28 18:16:00', 'ESP32-RFID-Scanner', 'Shiva', -54, 'approved', '2025-08-29 02:15:59', '2025-08-28 18:15:59', 'OK', NULL),
(47, 4, '53:89:08:02', 'KDAIOEJQ', 5, NULL, '2025-08-28 18:16:14', 'ESP32-RFID-Scanner', 'Shiva', -53, 'approved', '2025-08-29 02:16:14', '2025-08-28 18:16:14', 'OK', NULL),
(48, 4, '53:89:08:02', 'P2DRPMI2', 1, NULL, '2025-08-28 18:16:59', 'ESP32-RFID-Scanner', 'Shiva', -54, 'approved', '2025-08-29 02:16:58', '2025-08-28 18:16:58', 'OK', NULL),
(49, 3, 'c2:48:94:ab', 'S3IG1JS2', 1, NULL, '2025-08-28 18:19:22', 'ESP32-RFID-Scanner', 'Shiva', -54, 'approved', '2025-08-29 02:19:21', '2025-08-28 18:19:21', 'OK', NULL),
(50, 3, 'c2:48:94:ab', 'S3IG1JS2', 4, NULL, '2025-08-28 21:01:27', 'ESP32-RFID-Scanner', 'Shiva', -56, 'approved', '2025-08-29 05:01:26', '2025-08-28 21:01:26', 'OK', NULL),
(51, 3, 'c2:48:94:ab', 'S3IG1JS2', 4, NULL, '2025-08-28 21:01:40', 'ESP32-RFID-Scanner', 'Shiva', -56, 'approved', '2025-08-29 05:01:26', '2025-08-28 21:01:26', 'OK', NULL),
(52, 3, 'c2:48:94:ab', 'S3IG1JS2', 4, NULL, '2025-08-28 21:01:53', 'ESP32-RFID-Scanner', 'Shiva', -56, 'approved', '2025-08-29 05:01:26', '2025-08-28 21:01:26', 'OK', NULL),
(53, 3, 'c2:48:94:ab', 'S3IG1JS2', 4, NULL, '2025-08-28 22:10:09', 'ESP32-RFID-Scanner', 'Spider-Man Home WiFi', -69, 'approved', '2025-08-29 06:10:08', '2025-08-28 22:10:08', 'OK', NULL),
(54, 3, 'c2:48:94:ab', 'S3IG1JS2', 5, NULL, '2025-08-28 22:10:25', 'ESP32-RFID-Scanner', 'Spider-Man Home WiFi', -71, 'approved', '2025-08-29 06:10:24', '2025-08-28 22:10:24', 'OK', NULL),
(55, 3, 'c2:48:94:ab', 'IVW48KZN', 1, NULL, '2025-08-28 22:10:43', 'ESP32-RFID-Scanner', 'Spider-Man Home WiFi', -68, 'approved', '2025-08-29 06:10:42', '2025-08-28 22:10:42', 'OK', NULL),
(56, 3, 'c2:48:94:ab', 'IVW48KZN', 2, NULL, '2025-08-28 23:31:52', 'ESP32-RFID-Scanner', 'Shiva', -27, 'approved', '2025-08-29 07:31:48', '2025-08-28 23:31:48', 'OK', NULL),
(57, 3, 'c2:48:94:ab', 'IVW48KZN', 3, NULL, '2025-08-28 23:32:20', 'ESP32-RFID-Scanner', 'Shiva', -22, 'approved', '2025-08-29 07:32:19', '2025-08-28 23:32:19', 'OK', NULL),
(58, 3, 'c2:48:94:ab', 'IVW48KZN', 4, NULL, '2025-08-28 23:32:56', 'ESP32-RFID-Scanner', 'Shiva', -26, 'approved', '2025-08-29 07:32:55', '2025-08-28 23:32:55', 'OK', NULL),
(59, 3, 'c2:48:94:ab', 'IVW48KZN', 5, NULL, '2025-08-28 23:33:11', 'ESP32-RFID-Scanner', 'Shiva', -27, 'approved', '2025-08-29 07:33:11', '2025-08-28 23:33:11', 'OK', NULL),
(60, 3, 'c2:48:94:ab', 'BGJU7IJ6', 1, NULL, '2025-08-28 23:33:43', 'ESP32-RFID-Scanner', 'Shiva', -24, 'approved', '2025-08-29 07:33:42', '2025-08-28 23:33:42', 'OK', NULL),
(61, 3, 'c2:48:94:ab', 'BGJU7IJ6', 2, NULL, '2025-08-28 23:36:32', 'ESP32-RFID-Scanner', 'Shiva', -19, 'approved', '2025-08-29 07:36:30', '2025-08-28 23:36:30', 'OK', NULL),
(62, 3, 'c2:48:94:ab', 'BGJU7IJ6', 2, NULL, '2025-08-28 23:36:44', 'ESP32-RFID-Scanner', 'Shiva', -19, 'approved', '2025-08-29 07:36:30', '2025-08-28 23:36:30', 'OK', NULL),
(63, 3, 'c2:48:94:ab', 'BGJU7IJ6', 3, NULL, '2025-08-28 23:37:30', 'ESP32-RFID-Scanner', 'Shiva', -27, 'approved', '2025-08-29 07:37:29', '2025-08-28 23:37:29', 'OK', NULL),
(64, 3, 'c2:48:94:ab', 'BGJU7IJ6', 3, NULL, '2025-08-28 23:37:43', 'ESP32-RFID-Scanner', 'Shiva', -27, 'approved', '2025-08-29 07:37:29', '2025-08-28 23:37:29', 'OK', NULL),
(65, 3, 'c2:48:94:ab', 'BGJU7IJ6', 3, NULL, '2025-08-28 23:37:56', 'ESP32-RFID-Scanner', 'Shiva', -27, 'approved', '2025-08-29 07:37:29', '2025-08-28 23:37:29', 'OK', NULL),
(66, 3, 'c2:48:94:ab', 'BGJU7IJ6', 3, NULL, '2025-08-28 23:38:15', 'ESP32-RFID-Scanner', 'Shiva', -28, 'approved', '2025-08-29 07:38:14', '2025-08-28 23:38:14', 'OK', NULL),
(67, 3, 'c2:48:94:ab', 'BGJU7IJ6', 3, NULL, '2025-08-28 23:38:28', 'ESP32-RFID-Scanner', 'Shiva', -28, 'approved', '2025-08-29 07:38:14', '2025-08-28 23:38:14', 'OK', NULL),
(68, 3, 'c2:48:94:ab', 'BGJU7IJ6', 4, NULL, '2025-08-28 23:38:49', 'ESP32-RFID-Scanner', 'Shiva', -36, 'approved', '2025-08-29 07:38:48', '2025-08-28 23:38:48', 'OK', NULL),
(69, 3, 'c2:48:94:ab', 'BGJU7IJ6', 5, NULL, '2025-08-28 23:39:11', 'ESP32-RFID-Scanner', 'Shiva', -32, 'approved', '2025-08-29 07:39:10', '2025-08-28 23:39:10', 'OK', NULL),
(70, 4, '53:89:08:02', 'P2DRPMI2', 2, NULL, '2025-08-28 23:50:14', 'ESP32-RFID-Scanner', 'Shiva', -44, 'approved', '2025-08-29 07:50:13', '2025-08-28 23:50:13', 'OK', NULL),
(71, 4, '53:89:08:02', 'P2DRPMI2', 2, NULL, '2025-08-28 23:50:56', 'ESP32-RFID-Scanner', 'Shiva', -34, 'approved', '2025-08-29 07:50:55', '2025-08-28 23:50:55', 'OK', NULL),
(72, 4, '53:89:08:02', 'P2DRPMI2', 3, NULL, '2025-08-28 23:51:32', 'ESP32-RFID-Scanner', 'Shiva', -43, 'approved', '2025-08-29 07:51:31', '2025-08-28 23:51:31', 'OK', NULL),
(73, 4, '53:89:08:02', 'P2DRPMI2', 4, NULL, '2025-08-29 00:52:24', 'ESP32-RFID-Scanner', 'Shiva', -50, 'approved', '2025-08-29 08:52:23', '2025-08-29 00:52:23', 'OK', NULL),
(74, 4, '53:89:08:02', 'P2DRPMI2', 5, NULL, '2025-08-29 00:52:39', 'ESP32-RFID-Scanner', 'Shiva', -52, 'approved', '2025-08-29 08:52:38', '2025-08-29 00:52:38', 'OK', NULL),
(75, 4, '53:89:08:02', 'VCFGCGLX', 1, NULL, '2025-08-29 00:52:57', 'ESP32-RFID-Scanner', 'Shiva', -53, 'approved', '2025-08-29 08:52:56', '2025-08-29 00:52:56', 'OK', NULL),
(76, 4, '53:89:08:02', 'VCFGCGLX', 2, NULL, '2025-08-29 00:55:07', 'ESP32-RFID-Scanner', 'Shiva', -55, 'approved', '2025-08-29 08:55:06', '2025-08-29 00:55:06', 'OK', NULL),
(77, 4, '53:89:08:02', 'VCFGCGLX', 3, NULL, '2025-08-29 00:55:29', 'ESP32-RFID-Scanner', 'Shiva', -50, 'approved', '2025-08-29 08:55:28', '2025-08-29 00:55:28', 'OK', NULL),
(78, 4, '53:89:08:02', 'VCFGCGLX', 4, NULL, '2025-08-29 00:56:06', 'ESP32-RFID-Scanner', 'Shiva', -55, 'approved', '2025-08-29 08:56:04', '2025-08-29 00:56:04', 'OK', NULL),
(79, 4, '53:89:08:02', 'VCFGCGLX', 5, NULL, '2025-08-29 00:56:29', 'ESP32-RFID-Scanner', 'Shiva', -50, 'approved', '2025-08-29 08:56:28', '2025-08-29 00:56:28', 'OK', NULL),
(80, 4, '53:89:08:02', 'VCFGCGLX', 5, NULL, '2025-08-29 00:56:42', 'ESP32-RFID-Scanner', 'Shiva', -50, 'approved', '2025-08-29 08:56:28', '2025-08-29 00:56:28', 'OK', NULL),
(81, 1, '73:77:f8:39', '6C30BPY5', 2, NULL, '2025-09-18 13:43:28', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -70, 'approved', '2025-09-18 21:43:28', '2025-09-18 13:43:28', 'OK', NULL),
(82, 1, '73:77:f8:39', '6C30BPY5', 3, NULL, '2025-09-18 17:08:22', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -80, 'approved', '2025-09-19 01:08:22', '2025-09-18 17:08:22', 'OK', NULL),
(83, 1, '73:77:f8:39', '6C30BPY5', 4, NULL, '2025-09-18 17:08:37', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -84, 'approved', '2025-09-19 01:08:37', '2025-09-18 17:08:37', 'OK', NULL),
(84, 1, '73:77:f8:39', '6C30BPY5', 5, NULL, '2025-09-18 17:08:53', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -82, 'approved', '2025-09-19 01:08:52', '2025-09-18 17:08:52', 'OK', NULL),
(85, 1, '73:77:f8:39', '3B9NQ4XL', 1, NULL, '2025-09-18 17:09:07', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -65, 'approved', '2025-09-19 01:09:07', '2025-09-18 17:09:07', 'OK', NULL),
(86, 1, '73:77:f8:39', '3B9NQ4XL', 2, NULL, '2025-09-18 17:09:22', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -67, 'approved', '2025-09-19 01:09:22', '2025-09-18 17:09:22', 'OK', NULL),
(87, 3, 'c2:48:94:ab', 'BGJU7IJ6', 1, NULL, '2025-09-18 17:09:36', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -64, 'approved', '2025-09-19 01:09:36', '2025-09-18 17:09:36', 'OK', NULL),
(88, 3, 'c2:48:94:ab', 'BGJU7IJ6', 2, NULL, '2025-09-18 17:09:51', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -69, 'approved', '2025-09-19 01:09:51', '2025-09-18 17:09:51', 'OK', NULL),
(89, 3, 'c2:48:94:ab', 'BGJU7IJ6', 3, NULL, '2025-09-18 17:10:06', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -78, 'approved', '2025-09-19 01:10:06', '2025-09-18 17:10:06', 'OK', NULL),
(90, 3, 'c2:48:94:ab', 'BGJU7IJ6', 4, NULL, '2025-09-18 17:10:21', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -70, 'approved', '2025-09-19 01:10:21', '2025-09-18 17:10:21', 'OK', NULL),
(91, 3, 'c2:48:94:ab', 'BGJU7IJ6', 5, NULL, '2025-09-18 17:10:36', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -66, 'approved', '2025-09-19 01:10:36', '2025-09-18 17:10:36', 'OK', NULL),
(92, 5, '73:77:f8:39', 'V7J8G6RG', 1, NULL, '2025-09-18 17:29:17', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -70, 'approved', '2025-09-19 01:29:17', '2025-09-18 17:29:17', 'OK', NULL),
(93, 5, '73:77:f8:39', 'V7J8G6RG', 1, NULL, '2025-09-22 06:09:28', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -80, 'approved', '2025-09-22 14:09:28', '2025-09-22 06:09:28', 'OK', NULL),
(94, 5, '73:77:f8:39', 'V7J8G6RG', 2, NULL, '2025-09-22 06:09:59', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -72, 'approved', '2025-09-22 14:09:59', '2025-09-22 06:09:59', 'OK', NULL),
(95, 5, '73:77:f8:39', 'V7J8G6RG', 3, NULL, '2025-09-22 06:57:47', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -68, 'approved', '2025-09-22 14:57:47', '2025-09-22 06:57:47', 'OK', NULL),
(96, 5, '73:77:f8:39', '23S8BY3D', 1, NULL, '2025-09-22 06:58:02', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -58, 'approved', '2025-09-22 14:58:02', '2025-09-22 06:58:02', 'OK', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `sales_transactions`
--

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

--
-- Dumping data for table `sales_transactions`
--

INSERT INTO `sales_transactions` (`id`, `booking_id`, `transaction_reference`, `amount`, `discount_amount`, `payment_method`, `payment_platform`, `status`, `void_reason`, `voided_by`, `voided_at`, `created_at`) VALUES
(1, 2, 'TXN-20250828-F2A1BA79', 585.00, 65.00, 'cash', '', 'completed', NULL, NULL, NULL, '2025-08-28 11:43:42'),
(2, 2, 'TXN-20250828-18A39626', 585.00, 65.00, 'cash', '', 'completed', NULL, NULL, NULL, '2025-08-28 11:43:48'),
(3, 2, 'TXN-20250828-97C7086B', 650.00, 0.00, 'cash', '', 'completed', NULL, NULL, NULL, '2025-08-28 11:44:11'),
(4, 2, 'TXN-20250828-C352FFB9', 552.00, 98.00, 'cash', '', 'voided', 'service_issue', NULL, '2025-08-28 16:00:01', '2025-08-28 12:01:02'),
(5, 10, 'TXN-20250828-712A0A69', 807.00, 143.00, 'cash', '', 'completed', NULL, NULL, NULL, '2025-08-28 17:57:13'),
(6, 12, 'TXN-20250829-04935035', 127.00, 23.00, 'cash', '', 'completed', NULL, NULL, NULL, '2025-08-28 23:44:40'),
(7, 12, 'TXN-20250829-43278B46', 127.00, 23.00, 'cash', '', 'completed', NULL, NULL, NULL, '2025-08-28 23:44:44'),
(8, 15, 'TXN-20250829-4454F3CF', 510.00, 90.00, 'cash', '', 'completed', NULL, NULL, NULL, '2025-08-29 00:59:29'),
(9, 15, 'TXN-20250829-59D81157', 510.00, 90.00, 'cash', '', 'completed', NULL, NULL, NULL, '2025-08-29 00:59:41');

-- --------------------------------------------------------

--
-- Table structure for table `services`
--

CREATE TABLE `services` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `duration_minutes` int(11) DEFAULT 60,
  `category` enum('basic','premium','addon') NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `services`
--

INSERT INTO `services` (`id`, `name`, `price`, `duration_minutes`, `category`, `description`, `is_active`) VALUES
(1, 'Full Grooming Package', 500.00, 60, 'basic', 'Full Grooming Package', 1),
(2, 'Ear Cleaning', 200.00, 60, 'basic', 'Ear Cleaning', 1),
(3, 'De-shedding Treatment', 450.00, 60, 'basic', 'De-shedding Treatment', 1),
(4, 'Perfume & Bow', 150.00, 60, 'basic', 'Perfume & Bow', 1),
(5, 'Dental Care', 280.00, 60, 'basic', 'Dental Care', 1),
(6, 'Nail Polish', 100.00, 60, 'basic', 'Nail Polish', 1),
(7, 'Nail Trimming', 150.00, 60, 'basic', 'Nail Trimming', 1),
(8, 'Basic Bath', 250.00, 60, 'basic', 'Basic Bath', 1);

-- --------------------------------------------------------

--
-- Table structure for table `services2`
--

CREATE TABLE `services2` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `category` enum('basic','premium','addon') DEFAULT 'basic',
  `base_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `is_size_based` tinyint(1) DEFAULT 1,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `services2`
--

INSERT INTO `services2` (`id`, `name`, `description`, `category`, `base_price`, `is_size_based`, `status`, `created_at`, `updated_at`) VALUES
(1, 'Basic Bath', 'Shampoo, rinse, and basic dry', 'basic', 300.00, 1, 'active', '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(2, 'Nail Trimming', 'Professional nail care', 'basic', 150.00, 1, 'active', '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(3, 'Ear Cleaning', 'Safe ear cleaning and inspection', 'basic', 200.00, 0, 'active', '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(4, 'Full Grooming Package', 'Bath, cut, style, nails, ears, and teeth', 'premium', 650.00, 1, 'active', '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(5, 'Dental Care', 'Teeth cleaning and oral health check', 'premium', 250.00, 1, 'active', '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(6, 'De-shedding Treatment', 'Reduces shedding up to 90%', 'premium', 425.00, 1, 'active', '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(7, 'Nail Polish', 'Pet-safe nail colors', 'addon', 100.00, 0, 'active', '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(8, 'Perfume & Bow', 'Finishing touches for a perfect look', 'addon', 150.00, 0, 'active', '2025-08-24 10:20:33', '2025-08-24 10:20:33');

-- --------------------------------------------------------

--
-- Table structure for table `service_pricing`
--

CREATE TABLE `service_pricing` (
  `id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `pet_size` enum('small','medium','large','extra_large') NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `service_pricing`
--

INSERT INTO `service_pricing` (`id`, `service_id`, `pet_size`, `price`, `created_at`, `updated_at`) VALUES
(1, 1, 'small', 250.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(2, 1, 'medium', 300.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(3, 1, 'large', 350.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(4, 1, 'extra_large', 400.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(5, 2, 'small', 120.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(6, 2, 'medium', 150.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(7, 2, 'large', 180.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(8, 2, 'extra_large', 200.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(9, 3, 'small', 200.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(10, 3, 'medium', 200.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(11, 3, 'large', 200.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(12, 3, 'extra_large', 200.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(13, 4, 'small', 500.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(14, 4, 'medium', 600.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(15, 4, 'large', 750.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(16, 4, 'extra_large', 900.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(17, 5, 'small', 200.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(18, 5, 'medium', 250.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(19, 5, 'large', 280.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(20, 5, 'extra_large', 300.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(21, 6, 'small', 350.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(22, 6, 'medium', 400.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(23, 6, 'large', 450.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(24, 6, 'extra_large', 500.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(25, 7, 'small', 100.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(26, 7, 'medium', 100.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(27, 7, 'large', 100.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(28, 7, 'extra_large', 100.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(29, 8, 'small', 150.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(30, 8, 'medium', 150.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(31, 8, 'large', 150.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33'),
(32, 8, 'extra_large', 150.00, '2025-08-24 10:20:33', '2025-08-24 10:20:33');

-- --------------------------------------------------------

--
-- Table structure for table `status_updates`
--

CREATE TABLE `status_updates` (
  `id` int(11) NOT NULL,
  `booking_id` int(11) NOT NULL,
  `status` varchar(20) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `status_updates`
--

INSERT INTO `status_updates` (`id`, `booking_id`, `status`, `notes`, `created_at`) VALUES
(1, 3, 'bathing', 'Status automatically updated via RFID tap #2', '2025-08-28 14:38:46'),
(2, 0, 'checked-in', 'Initial check-in completed', '2025-08-28 04:22:04'),
(3, 0, 'checked-in', 'Initial check-in completed', '2025-08-28 04:25:50'),
(4, 0, 'bathing', 'Status automatically updated via RFID tap #2', '2025-08-28 04:29:37'),
(5, 0, 'grooming', 'Status automatically updated via RFID tap #3', '2025-08-28 04:30:32'),
(6, 0, 'ready', 'Status automatically updated via RFID tap #4', '2025-08-28 04:30:46'),
(7, 0, 'completed', 'Service completed! Pet picked up via RFID tap #5', '2025-08-28 04:31:08'),
(8, 0, 'checked-in', 'Initial check-in completed', '2025-08-28 04:34:08'),
(9, 0, 'bathing', 'Status automatically updated via RFID tap #2', '2025-08-28 04:34:30'),
(10, 0, 'grooming', 'Status automatically updated via RFID tap #3', '2025-08-28 04:43:12'),
(11, 2, 'ready', 'Status automatically updated via RFID tap #4', '2025-08-28 04:46:14'),
(12, 2, 'completed', 'Service completed! Pet picked up via RFID tap #5', '2025-08-28 04:46:51'),
(13, 3, 'grooming', 'Status automatically updated via RFID tap #3', '2025-08-28 14:45:49'),
(14, 3, 'ready', 'Status automatically updated via RFID tap #4', '2025-08-28 14:47:36'),
(15, 3, 'completed', 'Service completed! Pet picked up via RFID tap #5', '2025-08-28 14:49:12'),
(16, 7, 'checked-in', 'Initial check-in completed', '2025-08-28 17:36:32'),
(19, 10, 'checked-in', 'Initial check-in completed', '2025-08-28 17:51:13'),
(20, 10, 'bathing', 'Status automatically updated via RFID tap #2', '2025-08-28 17:52:12'),
(21, 10, 'grooming', 'Status automatically updated via RFID tap #3', '2025-08-28 17:52:44'),
(22, 10, 'ready', 'Status automatically updated via RFID tap #4', '2025-08-28 17:53:12'),
(23, 10, 'completed', 'Service completed! Pet picked up via RFID tap #5', '2025-08-28 17:53:38'),
(24, 11, 'checked-in', 'Initial check-in completed', '2025-08-28 18:17:47'),
(25, 12, 'checked-in', 'Initial check-in completed', '2025-08-28 20:57:50'),
(26, 12, 'ready', 'Status automatically updated via RFID tap #4', '2025-08-28 21:01:27'),
(27, 12, 'completed', 'Status updated via RFID tap', '2025-08-28 21:10:07'),
(28, 13, 'checked-in', 'Initial check-in completed', '2025-08-28 22:10:53'),
(29, 13, 'bathing', 'Status automatically updated via RFID tap #2', '2025-08-28 23:31:52'),
(30, 13, 'grooming', 'Status updated via RFID tap', '2025-08-28 23:31:54'),
(31, 13, 'ready', 'Status updated via RFID tap', '2025-08-28 23:31:56'),
(32, 13, 'completed', 'Status updated via RFID tap', '2025-08-28 23:31:58'),
(33, 14, 'checked-in', 'Initial check-in completed', '2025-08-28 23:34:22'),
(34, 14, 'bathing', 'Status automatically updated via RFID tap #2', '2025-08-28 23:36:32'),
(35, 14, 'grooming', 'Status automatically updated via RFID tap #3', '2025-08-28 23:37:30'),
(36, 14, 'ready', 'Status automatically updated via RFID tap #4', '2025-08-28 23:38:49'),
(37, 14, 'completed', 'Service completed! Pet picked up via RFID tap #5', '2025-08-28 23:39:11'),
(38, 11, 'bathing', 'Status automatically updated via RFID tap #2', '2025-08-28 23:50:14'),
(39, 11, 'grooming', 'Status updated via RFID tap', '2025-08-28 23:50:44'),
(40, 11, 'ready', 'Status updated via RFID tap', '2025-08-28 23:50:46'),
(41, 11, 'completed', 'Status updated via RFID tap', '2025-08-28 23:50:48'),
(42, 15, 'checked-in', 'Initial check-in completed', '2025-08-29 00:53:34'),
(43, 15, 'bathing', 'Status automatically updated via RFID tap #2', '2025-08-29 00:55:07'),
(44, 15, 'grooming', 'Status automatically updated via RFID tap #3', '2025-08-29 00:55:29'),
(45, 15, 'ready', 'Status automatically updated via RFID tap #4', '2025-08-29 00:56:06'),
(46, 15, 'completed', 'Service completed! Pet picked up via RFID tap #5', '2025-08-29 00:56:29'),
(47, 16, 'checked-in', 'Initial check-in completed', '2025-09-18 17:10:43');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `full_name` varchar(100) NOT NULL,
  `role` enum('admin','staff','cashier','customer') NOT NULL DEFAULT 'staff',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `email_verified` tinyint(1) NOT NULL DEFAULT 0,
  `verification_code` varchar(10) DEFAULT NULL,
  `verification_token` varchar(100) DEFAULT NULL,
  `verification_code_expires` timestamp NULL DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password_reset_token` varchar(100) DEFAULT NULL,
  `password_reset_code` varchar(10) DEFAULT NULL,
  `password_reset_code_expires` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `email`, `phone`, `full_name`, `role`, `is_active`, `email_verified`, `verification_code`, `verification_token`, `verification_code_expires`, `email_verified_at`, `password_reset_token`, `password_reset_code`, `password_reset_code_expires`, `created_at`, `updated_at`) VALUES
(1, 'admin', '$2y$10$h40sViPWyPY88qxdStAR/.4aVn0jQPdPdK3qa06arP1kCWxI7vhvm', 'admin@animates.ph', NULL, 'System Administrator', 'admin', 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-01-28 00:00:00', '2025-08-28 04:49:29'),
(2, 'cashier1', '$2y$10$/mtkwNTqWT8lj9/ErO6Haeye.Y6LrI05PanGFFqCbYnYc.SfARQu2', 'cashier@animates.ph', NULL, 'Cashier 1', 'cashier', 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-01-28 00:00:00', '2025-08-28 04:49:29'),
(3, 'staff1', '$2y$10$sW29vRwY/8V1.KOLyhfp1eugbVH3s5Rts0miH9fbjsJV6rkyHOdQG', 'staff@animates.ph', NULL, 'Staff Member 1', 'staff', 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-01-28 00:00:00', '2025-08-28 04:49:29'),
(4, 'loyd rivera', '$2y$10$wnwyqR6qpg9m.5kN.0khu.ZSWIpFQY11RF9pJrHrXgz8bes2Du/L.', 'loydrivera@gmail.com', NULL, 'loyd rivera', 'staff', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 11:35:30', '2025-08-28 23:42:46'),
(5, 'cashier4', '$2y$10$DCkL93xiqQBq.qg4lljde.z3QyQjF1sjxxgwW2Tw6CfXKsAqovhO2', 'cashier4@animates.ph', NULL, 'Cashier4 Cashier4', 'staff', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 12:19:00', '2025-08-28 12:45:27'),
(6, 'cashier6', '$2y$10$yxpNL2gsMtCSJhYVfbDcAuEwv/gOPV.bcQg25B1htRMHg7LPp5PCy', 'cashier6@animates.ph', NULL, 'Cashier6 Staff', 'cashier', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 12:33:44', '2025-08-28 12:44:09'),
(7, 'cashier7', '$2y$10$F8qgmtj5bDleneWRVTyCt.T7XSR8CDc8zc7GbyGAkhHF17fA6F0h2', 'cashier7@animates.ph', NULL, 'cashier7 Cashier7', 'cashier', 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 12:46:39', '2025-08-28 12:46:39'),
(17, 'Bryant IversonMelliza', '$2y$10$Bggpc1A/GQSbf5mkhYG6A.78qiiqPMpLemaQKITtRvWXNlFLz96l6', 'bryantiversonmelliza03@gmail.com', '09398170375', 'Bryant Iverson Melliza', 'customer', 1, 1, NULL, NULL, '2025-09-18 10:56:21', '2025-09-18 16:26:49', NULL, NULL, NULL, '2025-09-18 16:26:21', '2025-09-18 16:26:49');

-- --------------------------------------------------------

--
-- Table structure for table `user_pets`
--

CREATE TABLE `user_pets` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `pet_id` int(11) NOT NULL,
  `is_primary_owner` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `void_audit_log`
--

CREATE TABLE `void_audit_log` (
  `id` int(11) NOT NULL,
  `transaction_id` int(11) NOT NULL,
  `void_reason` varchar(255) NOT NULL,
  `voided_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `void_audit_log`
--

INSERT INTO `void_audit_log` (`id`, `transaction_id`, `void_reason`, `voided_by`, `created_at`) VALUES
(1, 4, 'service_issue', 1, '2025-08-28 16:00:01');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `appointments`
--
ALTER TABLE `appointments`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `appointment_services`
--
ALTER TABLE `appointment_services`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `app_config`
--
ALTER TABLE `app_config`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pet_id` (`pet_id`),
  ADD KEY `idx_custom_rfid` (`custom_rfid`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `booking_services`
--
ALTER TABLE `booking_services`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `pets`
--
ALTER TABLE `pets`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `pet_sizes`
--
ALTER TABLE `pet_sizes`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `rfid_cards`
--
ALTER TABLE `rfid_cards`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `rfid_tags`
--
ALTER TABLE `rfid_tags`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `rfid_tap_history`
--
ALTER TABLE `rfid_tap_history`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `sales_transactions`
--
ALTER TABLE `sales_transactions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `services2`
--
ALTER TABLE `services2`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `service_pricing`
--
ALTER TABLE `service_pricing`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `status_updates`
--
ALTER TABLE `status_updates`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `user_pets`
--
ALTER TABLE `user_pets`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `void_audit_log`
--
ALTER TABLE `void_audit_log`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `appointments`
--
ALTER TABLE `appointments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `appointment_services`
--
ALTER TABLE `appointment_services`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `app_config`
--
ALTER TABLE `app_config`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `booking_services`
--
ALTER TABLE `booking_services`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `pets`
--
ALTER TABLE `pets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `pet_sizes`
--
ALTER TABLE `pet_sizes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `rfid_cards`
--
ALTER TABLE `rfid_cards`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `rfid_tags`
--
ALTER TABLE `rfid_tags`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rfid_tap_history`
--
ALTER TABLE `rfid_tap_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=97;

--
-- AUTO_INCREMENT for table `sales_transactions`
--
ALTER TABLE `sales_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `services`
--
ALTER TABLE `services`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `services2`
--
ALTER TABLE `services2`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `service_pricing`
--
ALTER TABLE `service_pricing`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `status_updates`
--
ALTER TABLE `status_updates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `user_pets`
--
ALTER TABLE `user_pets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `void_audit_log`
--
ALTER TABLE `void_audit_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
