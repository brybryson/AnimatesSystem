-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Sep 26, 2025 at 04:43 PM
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
  `package_customizations` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`package_customizations`)),
  `staff_notes` text DEFAULT NULL,
  `reminder_sent` tinyint(1) DEFAULT 0,
  `confirmation_sent` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `appointments`
--

INSERT INTO `appointments` (`id`, `user_id`, `pet_id`, `appointment_date`, `appointment_time`, `estimated_duration`, `status`, `total_amount`, `special_instructions`, `package_customizations`, `staff_notes`, `reminder_sent`, `confirmation_sent`, `created_at`, `updated_at`) VALUES
(27, 17, 67, '2025-10-09', '10:00:00', 120, 'cancelled', 580.00, '', '{\"Essential Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Full Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Bath & Brush Package\":{\"selected\":false,\"excludedServices\":[]},\"Spa Relaxation Package\":{\"selected\":true,\"excludedServices\":[]}}', NULL, 0, 0, '2025-09-25 18:57:32', '2025-09-25 19:31:50'),
(28, 17, 68, '2025-10-03', '09:00:00', 150, 'cancelled', 930.00, '', '{\"Essential Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Full Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Bath & Brush Package\":{\"selected\":false,\"excludedServices\":[]},\"Spa Relaxation Package\":{\"selected\":true,\"excludedServices\":[]}}', NULL, 0, 0, '2025-09-25 19:10:28', '2025-09-25 19:31:52'),
(29, 17, 69, '2025-10-08', '10:00:00', 150, 'cancelled', 1150.00, '', '{\"Essential Grooming Package\":{\"selected\":true,\"excludedServices\":[]},\"Full Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Bath & Brush Package\":{\"selected\":false,\"excludedServices\":[]},\"Spa Relaxation Package\":{\"selected\":false,\"excludedServices\":[]}}', NULL, 0, 0, '2025-09-25 19:40:14', '2025-09-26 08:15:46'),
(30, 17, 70, '2025-10-04', '13:00:00', 150, 'cancelled', 680.00, '', '{\"Essential Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Full Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Bath & Brush Package\":{\"selected\":false,\"excludedServices\":[]},\"Spa Relaxation Package\":{\"selected\":true,\"excludedServices\":[]}}', NULL, 0, 0, '2025-09-25 20:08:32', '2025-09-26 08:15:44'),
(31, 17, 71, '2025-10-02', '11:00:00', 120, 'scheduled', 950.00, '', '{\"Essential Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Full Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Bath & Brush Package\":{\"selected\":true,\"excludedServices\":[]},\"Spa Relaxation Package\":{\"selected\":false,\"excludedServices\":[]}}', NULL, 0, 0, '2025-09-26 08:21:03', '2025-09-26 08:21:03'),
(32, 19, 74, '2025-10-02', '14:00:00', 120, 'cancelled', 1100.00, '', '{\"Essential Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Full Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Bath & Brush Package\":{\"selected\":true,\"excludedServices\":[]},\"Spa Relaxation Package\":{\"selected\":false,\"excludedServices\":[]}}', NULL, 0, 0, '2025-09-26 10:46:23', '2025-09-26 12:02:31'),
(33, 19, 75, '2025-10-02', '13:00:00', 180, 'cancelled', 1470.00, '', '{\"Essential Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Full Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Bath & Brush Package\":{\"selected\":true,\"excludedServices\":[]},\"Spa Relaxation Package\":{\"selected\":false,\"excludedServices\":[]}}', NULL, 0, 0, '2025-09-26 12:05:09', '2025-09-26 13:00:44'),
(34, 19, 76, '2025-10-04', '11:00:00', 150, 'cancelled', 970.00, '', '{\"Essential Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Full Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Bath & Brush Package\":{\"selected\":false,\"excludedServices\":[]},\"Spa Relaxation Package\":{\"selected\":true,\"excludedServices\":[]}}', NULL, 0, 0, '2025-09-26 12:22:55', '2025-09-26 12:32:25'),
(35, 19, 75, '2025-10-02', '10:00:00', 150, 'cancelled', 3100.00, '', '{\"Essential Grooming Package\":{\"selected\":true,\"excludedServices\":[]},\"Full Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Bath & Brush Package\":{\"selected\":false,\"excludedServices\":[]},\"Spa Relaxation Package\":{\"selected\":false,\"excludedServices\":[]}}', NULL, 0, 0, '2025-09-26 12:37:37', '2025-09-26 13:00:46'),
(36, 19, 78, '2025-10-03', '11:00:00', 90, 'cancelled', 1550.00, '', '{\"Essential Grooming Package\":{\"selected\":true,\"excludedServices\":[]},\"Full Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Bath & Brush Package\":{\"selected\":false,\"excludedServices\":[]},\"Spa Relaxation Package\":{\"selected\":false,\"excludedServices\":[]}}', NULL, 0, 0, '2025-09-26 13:01:35', '2025-09-26 13:09:01'),
(37, 19, 79, '2025-10-03', '16:00:00', 90, 'scheduled', 1550.00, '', '{\"Essential Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Full Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Bath & Brush Package\":{\"selected\":true,\"excludedServices\":[]},\"Spa Relaxation Package\":{\"selected\":false,\"excludedServices\":[]}}', NULL, 0, 0, '2025-09-26 13:09:54', '2025-09-26 13:09:54'),
(38, 19, 80, '2025-10-10', '15:00:00', 90, 'cancelled', 1030.00, '', '{\"Essential Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Full Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Bath & Brush Package\":{\"selected\":true,\"excludedServices\":[]},\"Spa Relaxation Package\":{\"selected\":false,\"excludedServices\":[]}}', NULL, 0, 0, '2025-09-26 13:22:59', '2025-09-26 14:04:22'),
(39, 19, 81, '2025-10-02', '13:00:00', 150, 'scheduled', 2637.50, '', '{\"Essential Grooming Package\":{\"selected\":true,\"excludedServices\":[\"Nail Trimming & Grinding\"]},\"Full Grooming Package\":{\"selected\":false,\"excludedServices\":[]},\"Bath & Brush Package\":{\"selected\":false,\"excludedServices\":[]},\"Spa Relaxation Package\":{\"selected\":false,\"excludedServices\":[]}}', NULL, 0, 0, '2025-09-26 13:23:52', '2025-09-26 13:23:52');

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

--
-- Dumping data for table `appointment_services`
--

INSERT INTO `appointment_services` (`id`, `appointment_id`, `service_id`, `price`, `created_at`) VALUES
(1, 1, 6, 100.00, '2025-09-24 07:15:47'),
(2, 1, 7, 150.00, '2025-09-24 07:15:47'),
(3, 1, 11, 500.00, '2025-09-24 07:15:47'),
(4, 1, 12, 50.00, '2025-09-24 07:15:47'),
(5, 2, 8, 250.00, '2025-09-24 07:19:40'),
(6, 2, 11, 500.00, '2025-09-24 07:19:40'),
(7, 3, 6, 100.00, '2025-09-24 07:24:57'),
(8, 3, 7, 150.00, '2025-09-24 07:24:57'),
(9, 3, 11, 500.00, '2025-09-24 07:24:57'),
(10, 4, 7, 150.00, '2025-09-24 07:39:11'),
(11, 5, 3, 450.00, '2025-09-24 08:10:24'),
(12, 5, 4, 150.00, '2025-09-24 08:10:24'),
(13, 5, 10, 250.00, '2025-09-24 08:10:24'),
(14, 5, 11, 500.00, '2025-09-24 08:10:24'),
(15, 6, 2, 150.00, '2025-09-24 16:38:15'),
(16, 6, 9, 500.00, '2025-09-24 16:38:15'),
(17, 6, 11, 100.00, '2025-09-24 16:38:15'),
(18, 6, 15, 120.00, '2025-09-24 16:38:15'),
(19, 7, 2, 150.00, '2025-09-24 18:57:57'),
(20, 7, 3, 200.00, '2025-09-24 18:57:57'),
(21, 7, 9, 500.00, '2025-09-24 18:57:57'),
(22, 7, 12, 50.00, '2025-09-24 18:57:57'),
(23, 8, 6, 400.00, '2025-09-25 07:36:54'),
(24, 8, 7, 450.00, '2025-09-25 07:36:54'),
(25, 8, 11, 100.00, '2025-09-25 07:36:54'),
(26, 9, 2, 150.00, '2025-09-25 07:38:33'),
(27, 9, 10, 700.00, '2025-09-25 07:38:33'),
(28, 9, 12, 50.00, '2025-09-25 07:38:33'),
(29, 10, 2, 150.00, '2025-09-25 07:39:38'),
(30, 10, 3, 200.00, '2025-09-25 07:39:38'),
(31, 10, 4, 420.00, '2025-09-25 07:39:38'),
(32, 10, 5, 250.00, '2025-09-25 07:39:38'),
(33, 10, 12, 50.00, '2025-09-25 07:39:38'),
(34, 10, 13, 75.00, '2025-09-25 07:39:38'),
(35, 11, 1, 300.00, '2025-09-25 07:44:33'),
(36, 11, 2, 150.00, '2025-09-25 07:44:33'),
(37, 11, 3, 200.00, '2025-09-25 07:44:33'),
(38, 11, 5, 250.00, '2025-09-25 07:44:33'),
(39, 11, 6, 400.00, '2025-09-25 07:44:33'),
(40, 11, 11, 100.00, '2025-09-25 07:44:33'),
(41, 12, 1, 300.00, '2025-09-25 07:51:44'),
(42, 12, 2, 150.00, '2025-09-25 07:51:44'),
(43, 12, 3, 200.00, '2025-09-25 07:51:44'),
(44, 12, 5, 250.00, '2025-09-25 07:51:44'),
(45, 12, 6, 400.00, '2025-09-25 07:51:44'),
(46, 12, 11, 100.00, '2025-09-25 07:51:44'),
(47, 13, 1, 300.00, '2025-09-25 08:02:13'),
(48, 13, 3, 200.00, '2025-09-25 08:02:13'),
(49, 13, 4, 420.00, '2025-09-25 08:02:13'),
(50, 13, 6, 400.00, '2025-09-25 08:02:13'),
(51, 13, 12, 50.00, '2025-09-25 08:02:13'),
(52, 14, 1, 300.00, '2025-09-25 08:21:04'),
(53, 14, 2, 150.00, '2025-09-25 08:21:04'),
(54, 14, 6, 400.00, '2025-09-25 08:21:04'),
(55, 14, 13, 75.00, '2025-09-25 08:21:04'),
(56, 15, 1, 300.00, '2025-09-25 08:28:19'),
(57, 15, 2, 150.00, '2025-09-25 08:28:19'),
(58, 15, 5, 250.00, '2025-09-25 08:28:19'),
(59, 15, 6, 400.00, '2025-09-25 08:28:19'),
(60, 15, 13, 75.00, '2025-09-25 08:28:19'),
(61, 16, 1, 300.00, '2025-09-25 08:37:18'),
(62, 16, 2, 150.00, '2025-09-25 08:37:18'),
(63, 16, 3, 200.00, '2025-09-25 08:37:18'),
(64, 16, 4, 420.00, '2025-09-25 08:37:18'),
(65, 16, 6, 400.00, '2025-09-25 08:37:18'),
(66, 16, 11, 100.00, '2025-09-25 08:37:18'),
(67, 16, 15, 120.00, '2025-09-25 08:37:18'),
(68, 17, 1, 300.00, '2025-09-25 08:41:16'),
(69, 17, 2, 150.00, '2025-09-25 08:41:16'),
(70, 17, 3, 200.00, '2025-09-25 08:41:16'),
(71, 17, 4, 420.00, '2025-09-25 08:41:16'),
(72, 17, 5, 250.00, '2025-09-25 08:41:16'),
(73, 17, 6, 400.00, '2025-09-25 08:41:16'),
(74, 17, 16, 200.00, '2025-09-25 08:41:16'),
(75, 18, 1, 300.00, '2025-09-25 08:50:36'),
(76, 18, 2, 150.00, '2025-09-25 08:50:36'),
(77, 18, 3, 200.00, '2025-09-25 08:50:36'),
(78, 18, 4, 420.00, '2025-09-25 08:50:36'),
(79, 18, 5, 250.00, '2025-09-25 08:50:36'),
(80, 18, 6, 400.00, '2025-09-25 08:50:36'),
(81, 18, 11, 100.00, '2025-09-25 08:50:36'),
(82, 19, 1, 300.00, '2025-09-25 08:59:36'),
(83, 19, 2, 150.00, '2025-09-25 08:59:36'),
(84, 19, 3, 200.00, '2025-09-25 08:59:36'),
(85, 19, 4, 420.00, '2025-09-25 08:59:36'),
(86, 19, 5, 250.00, '2025-09-25 08:59:36'),
(87, 19, 6, 400.00, '2025-09-25 08:59:36'),
(88, 19, 11, 100.00, '2025-09-25 08:59:36'),
(89, 20, 1, 300.00, '2025-09-25 09:10:52'),
(90, 20, 2, 150.00, '2025-09-25 09:10:52'),
(91, 20, 3, 200.00, '2025-09-25 09:10:52'),
(92, 20, 4, 420.00, '2025-09-25 09:10:52'),
(93, 20, 5, 250.00, '2025-09-25 09:10:52'),
(94, 20, 6, 400.00, '2025-09-25 09:10:52'),
(95, 20, 11, 100.00, '2025-09-25 09:10:52'),
(96, 21, 1, 300.00, '2025-09-25 09:20:52'),
(97, 21, 2, 150.00, '2025-09-25 09:20:52'),
(98, 21, 3, 200.00, '2025-09-25 09:20:52'),
(99, 21, 4, 420.00, '2025-09-25 09:20:52'),
(100, 21, 5, 250.00, '2025-09-25 09:20:52'),
(101, 21, 6, 400.00, '2025-09-25 09:20:52'),
(102, 21, 11, 100.00, '2025-09-25 09:20:52'),
(118, 23, 1, 300.00, '2025-09-25 12:25:25'),
(119, 24, 1, 300.00, '2025-09-25 12:42:52'),
(120, 24, 2, 150.00, '2025-09-25 12:42:52'),
(121, 24, 5, 250.00, '2025-09-25 12:42:52'),
(122, 24, 6, 400.00, '2025-09-25 12:42:52'),
(123, 24, 11, 100.00, '2025-09-25 12:42:52'),
(124, 24, 12, 50.00, '2025-09-25 12:42:52'),
(125, 25, 1, 300.00, '2025-09-25 12:46:06'),
(126, 25, 3, 200.00, '2025-09-25 12:46:06'),
(127, 25, 5, 250.00, '2025-09-25 12:46:06'),
(128, 25, 6, 400.00, '2025-09-25 12:46:06'),
(129, 25, 12, 50.00, '2025-09-25 12:46:06'),
(130, 25, 13, 75.00, '2025-09-25 12:46:06'),
(131, 26, 1, 300.00, '2025-09-25 13:43:16'),
(132, 26, 4, 420.00, '2025-09-25 13:43:16'),
(133, 26, 5, 250.00, '2025-09-25 13:43:16'),
(134, 26, 6, 400.00, '2025-09-25 13:43:16'),
(135, 26, 11, 100.00, '2025-09-25 13:43:16'),
(136, 26, 12, 50.00, '2025-09-25 13:43:16'),
(137, 27, 1, 300.00, '2025-09-25 18:57:32'),
(138, 27, 2, 150.00, '2025-09-25 18:57:32'),
(139, 27, 12, 50.00, '2025-09-25 18:57:32'),
(140, 27, 14, 80.00, '2025-09-25 18:57:32'),
(141, 28, 1, 300.00, '2025-09-25 19:10:28'),
(142, 28, 6, 400.00, '2025-09-25 19:10:28'),
(143, 28, 11, 100.00, '2025-09-25 19:10:28'),
(144, 28, 12, 50.00, '2025-09-25 19:10:28'),
(145, 28, 14, 80.00, '2025-09-25 19:10:28'),
(146, 29, 1, 300.00, '2025-09-25 19:40:14'),
(147, 29, 2, 150.00, '2025-09-25 19:40:14'),
(148, 29, 3, 200.00, '2025-09-25 19:40:14'),
(149, 29, 6, 400.00, '2025-09-25 19:40:14'),
(150, 29, 11, 100.00, '2025-09-25 19:40:14'),
(151, 30, 1, 300.00, '2025-09-25 20:08:32'),
(152, 30, 2, 150.00, '2025-09-25 20:08:32'),
(153, 30, 11, 100.00, '2025-09-25 20:08:32'),
(154, 30, 12, 50.00, '2025-09-25 20:08:32'),
(155, 30, 14, 80.00, '2025-09-25 20:08:32'),
(156, 31, 1, 300.00, '2025-09-26 08:21:03'),
(157, 31, 2, 150.00, '2025-09-26 08:21:03'),
(158, 31, 6, 400.00, '2025-09-26 08:21:03'),
(159, 31, 11, 100.00, '2025-09-26 08:21:03'),
(160, 32, 1, 300.00, '2025-09-26 10:46:23'),
(161, 32, 3, 200.00, '2025-09-26 10:46:23'),
(162, 32, 6, 400.00, '2025-09-26 10:46:23'),
(163, 32, 16, 200.00, '2025-09-26 10:46:23'),
(164, 33, 1, 300.00, '2025-09-26 12:05:09'),
(165, 33, 3, 200.00, '2025-09-26 12:05:09'),
(166, 33, 4, 420.00, '2025-09-26 12:05:09'),
(167, 33, 6, 400.00, '2025-09-26 12:05:09'),
(168, 33, 11, 100.00, '2025-09-26 12:05:09'),
(169, 33, 12, 50.00, '2025-09-26 12:05:09'),
(170, 34, 1, 300.00, '2025-09-26 12:22:55'),
(171, 34, 4, 420.00, '2025-09-26 12:22:55'),
(172, 34, 12, 50.00, '2025-09-26 12:22:55'),
(173, 34, 14, 80.00, '2025-09-26 12:22:55'),
(174, 34, 15, 120.00, '2025-09-26 12:22:55'),
(175, 35, 4, 800.00, '2025-09-26 12:37:37'),
(176, 35, 5, 450.00, '2025-09-26 12:37:37'),
(177, 35, 6, 700.00, '2025-09-26 12:37:37'),
(178, 35, 15, 300.00, '2025-09-26 12:37:37'),
(179, 35, 7, 850.00, '2025-09-26 12:37:37'),
(180, 36, 4, 650.00, '2025-09-26 13:01:35'),
(181, 36, 11, 150.00, '2025-09-26 13:01:35'),
(182, 36, 7, 750.00, '2025-09-26 13:01:35'),
(183, 37, 2, 300.00, '2025-09-26 13:09:54'),
(184, 37, 14, 100.00, '2025-09-26 13:09:54'),
(185, 37, 9, 1150.00, '2025-09-26 13:09:54'),
(186, 38, 2, 180.00, '2025-09-26 13:22:59'),
(187, 38, 11, 150.00, '2025-09-26 13:22:59'),
(188, 38, 9, 700.00, '2025-09-26 13:22:59'),
(189, 39, 4, 650.00, '2025-09-26 13:23:52'),
(190, 39, 5, 400.00, '2025-09-26 13:23:52'),
(191, 39, 6, 600.00, '2025-09-26 13:23:52'),
(192, 39, 16, 350.00, '2025-09-26 13:23:52'),
(193, 39, 7, 637.50, '2025-09-26 13:23:52');

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
  `package_customizations` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`package_customizations`)),
  `total_amount` decimal(10,2) NOT NULL,
  `status` enum('checked-in','bathing','grooming','ready','completed','cancelled') DEFAULT 'checked-in',
  `payment_status` enum('paid','refunded') NOT NULL DEFAULT 'paid',
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

INSERT INTO `bookings` (`id`, `pet_id`, `rfid_card_id`, `rfid_tag_id`, `custom_rfid`, `package_customizations`, `total_amount`, `status`, `payment_status`, `payment_method`, `payment_reference`, `payment_platform`, `amount_tendered`, `change_amount`, `payment_date`, `check_in_time`, `estimated_completion`, `actual_completion`, `pickup_time`, `staff_notes`, `updated_by`, `created_at`, `updated_at`, `user_id`, `booking_type`, `welcome_email_sent`) VALUES
(1, 0, 0, NULL, '3T4TO70Z', NULL, 200.00, 'grooming', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 04:25:50', '2025-08-28 06:25:50', '2025-08-28 04:31:08', NULL, NULL, NULL, '2025-08-28 04:25:50', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(2, 0, 0, NULL, 'TVTPIV8O', NULL, 650.00, 'completed', 'paid', 'cash', '', '', 600.00, 48.00, '2025-08-28 12:01:02', '2025-08-28 04:34:08', '2025-08-28 06:34:08', '2025-08-28 12:01:02', NULL, NULL, NULL, '2025-08-28 04:34:08', '2025-08-28 12:01:02', NULL, 'walk_in', 1),
(3, 0, NULL, NULL, 'TVTPIV8O', NULL, 0.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 14:37:37', NULL, '2025-08-28 14:49:12', NULL, NULL, NULL, '2025-08-28 14:37:37', '2025-09-25 19:13:44', NULL, 'walk_in', 0),
(7, 6, 1, NULL, 'TVTPIV8O', NULL, 200.00, 'checked-in', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 17:36:31', '2025-08-28 19:36:31', NULL, NULL, NULL, NULL, '2025-08-28 17:36:31', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(10, 9, 3, NULL, 'YRTIHQ38', NULL, 950.00, 'completed', 'paid', 'cash', '', '', 900.00, 93.00, '2025-08-28 17:57:13', '2025-08-28 17:51:13', '2025-08-28 19:51:13', '2025-08-28 17:57:13', NULL, NULL, NULL, '2025-08-28 17:51:13', '2025-08-28 17:57:13', NULL, 'walk_in', 1),
(11, 10, 4, NULL, 'P2DRPMI2', NULL, 1730.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 18:17:47', '2025-08-28 20:17:47', NULL, NULL, NULL, NULL, '2025-08-28 18:17:47', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(12, 11, 3, NULL, 'S3IG1JS2', NULL, 150.00, 'completed', 'paid', 'cash', '', '', 127.00, 0.00, '2025-08-28 23:44:44', '2025-08-28 20:57:50', '2025-08-28 22:57:50', '2025-08-28 23:44:44', NULL, NULL, NULL, '2025-08-28 20:57:50', '2025-08-28 23:44:44', NULL, 'walk_in', 1),
(13, 12, 3, NULL, 'IVW48KZN', NULL, 200.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 22:10:53', '2025-08-29 00:10:53', NULL, NULL, NULL, NULL, '2025-08-28 22:10:53', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(15, 14, 4, NULL, 'VCFGCGLX', NULL, 600.00, 'completed', 'paid', 'cash', '', '', 550.00, 40.00, '2025-08-29 00:59:41', '2025-08-29 00:53:34', '2025-08-29 02:53:34', '2025-08-29 00:59:41', NULL, NULL, NULL, '2025-08-29 00:53:34', '2025-08-29 00:59:41', NULL, 'walk_in', 1),
(20, 19, 7, NULL, 'KLHNUIT1', NULL, 1450.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-23 04:25:07', '2025-09-23 06:25:07', NULL, NULL, NULL, NULL, '2025-09-23 04:25:07', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(21, 20, 8, NULL, 'CQBPCU8R', NULL, 1380.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-23 05:03:39', '2025-09-23 07:03:39', NULL, NULL, NULL, NULL, '2025-09-23 05:03:39', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(22, 21, 8, NULL, 'KEH368EC', NULL, 1500.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-23 05:28:13', '2025-09-23 07:28:13', NULL, NULL, NULL, NULL, '2025-09-23 05:28:13', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(23, 22, 7, NULL, 'J10X0C9P', NULL, 1450.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-23 13:24:04', '2025-09-23 15:24:04', '2025-09-23 14:45:49', NULL, NULL, NULL, '2025-09-23 13:24:04', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(24, 23, 8, NULL, 'CQBPCU8R', NULL, 1180.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-23 14:05:30', '2025-09-23 16:05:30', '2025-09-23 14:06:55', NULL, NULL, NULL, '2025-09-23 14:05:30', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(25, 24, 7, NULL, 'PAAAMTFB', NULL, 1850.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-23 14:56:35', '2025-09-23 16:56:35', '2025-09-23 14:59:33', NULL, NULL, NULL, '2025-09-23 14:56:35', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(26, 25, 8, NULL, 'OHGHI4FV', NULL, 1580.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-23 15:43:48', '2025-09-23 17:43:48', '2025-09-23 15:51:00', NULL, NULL, NULL, '2025-09-23 15:43:48', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(28, 27, 9, NULL, '2CSXNB4B', NULL, 1405.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-23 16:34:53', '2025-09-23 18:34:53', '2025-09-23 17:32:53', NULL, NULL, NULL, '2025-09-23 16:34:53', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(29, 28, 9, NULL, '6C30BPY5', NULL, 1565.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-23 17:35:24', '2025-09-23 19:35:24', '2025-09-23 17:37:43', NULL, NULL, NULL, '2025-09-23 17:35:24', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(30, 29, 9, NULL, '4HVRF3UC', NULL, 2250.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-23 17:39:12', '2025-09-23 19:39:12', '2025-09-23 18:44:03', NULL, NULL, NULL, '2025-09-23 17:39:12', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(31, 58, 9, NULL, 'CQBPCU8R', NULL, 650.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-25 15:20:12', '2025-09-25 17:20:12', '2025-09-25 15:44:46', NULL, NULL, NULL, '2025-09-25 15:20:12', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(32, 59, 9, NULL, 'KEH368EC', NULL, 2000.00, 'checked-in', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-25 15:48:19', '2025-09-25 17:48:19', NULL, NULL, NULL, NULL, '2025-09-25 15:48:19', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(33, 60, 10, NULL, 'UAA83NON', NULL, 1300.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-25 15:55:14', '2025-09-25 17:55:14', '2025-09-25 15:57:14', NULL, NULL, NULL, '2025-09-25 15:55:14', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(34, 61, 10, NULL, 'OBUEKQND', NULL, 830.00, 'checked-in', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-25 16:03:57', '2025-09-25 18:03:57', NULL, NULL, NULL, NULL, '2025-09-25 16:03:57', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(35, 62, 11, NULL, '3STGX4D1', NULL, 1150.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-25 16:42:50', '2025-09-25 18:42:50', '2025-09-25 16:48:48', NULL, NULL, NULL, '2025-09-25 16:42:50', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(36, 63, 11, NULL, '3STGX4D1', NULL, 1830.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-25 16:56:51', '2025-09-25 18:56:51', '2025-09-25 16:57:49', NULL, NULL, NULL, '2025-09-25 16:56:51', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(37, 64, 11, NULL, 'YKNALF3O', NULL, 1500.00, 'checked-in', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-25 17:04:42', '2025-09-25 19:04:42', NULL, NULL, NULL, NULL, '2025-09-25 17:04:42', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(38, 65, 7, NULL, 'L4SB9VVF', NULL, 1300.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-25 17:27:43', '2025-09-25 19:27:43', '2025-09-25 17:28:58', NULL, NULL, NULL, '2025-09-25 17:27:43', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(39, 66, 7, NULL, 'KLHNUIT1', NULL, 1250.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-25 17:49:29', '2025-09-25 19:49:29', '2025-09-25 17:50:14', NULL, NULL, NULL, '2025-09-25 17:49:29', '2025-09-25 19:13:44', NULL, 'walk_in', 1),
(40, 72, 7, NULL, 'KLHNUIT1', NULL, 1370.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-26 09:21:23', '2025-09-26 11:21:23', '2025-09-26 09:29:48', NULL, NULL, NULL, '2025-09-26 09:21:23', '2025-09-26 09:29:48', NULL, 'walk_in', 1),
(41, 73, 7, NULL, '7ETUTNW7', NULL, 1420.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-26 10:06:45', '2025-09-26 12:06:45', '2025-09-26 10:16:25', NULL, NULL, NULL, '2025-09-26 10:06:45', '2025-09-26 10:16:25', NULL, 'walk_in', 1),
(42, 82, 7, NULL, 'KLHNUIT1', NULL, 2550.00, 'completed', 'paid', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-26 13:50:06', '2025-09-26 15:50:06', '2025-09-26 14:10:54', NULL, NULL, NULL, '2025-09-26 13:50:06', '2025-09-26 14:10:54', NULL, 'walk_in', 1);

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
(19, 15, 2, 200.00, NULL),
(20, 15, 5, 300.00, NULL),
(21, 15, 6, 100.00, NULL),
(36, 20, 18, 250.00, NULL),
(37, 20, 19, 350.00, NULL),
(38, 20, 20, 850.00, NULL),
(39, 21, 12, 80.00, NULL),
(40, 21, 17, 1300.00, NULL),
(41, 22, 3, 600.00, NULL),
(42, 22, 21, 150.00, NULL),
(43, 22, 22, 750.00, NULL),
(44, 23, 23, 100.00, NULL),
(45, 23, 18, 250.00, NULL),
(46, 23, 17, 1100.00, NULL),
(47, 24, 12, 80.00, NULL),
(48, 24, 19, 350.00, NULL),
(49, 24, 22, 750.00, NULL),
(50, 25, 10, 400.00, NULL),
(51, 25, 3, 600.00, NULL),
(52, 25, 23, 100.00, NULL),
(53, 25, 22, 750.00, NULL),
(54, 26, 21, 150.00, NULL),
(55, 26, 12, 80.00, NULL),
(56, 26, 18, 250.00, NULL),
(57, 26, 17, 1100.00, NULL),
(62, 28, 18, 300.00, NULL),
(63, 28, 17, 1105.00, NULL),
(64, 29, 24, 350.00, NULL),
(65, 29, 25, 250.00, NULL),
(66, 29, 12, 80.00, NULL),
(67, 29, 26, 120.00, NULL),
(68, 29, 17, 765.00, NULL),
(69, 30, 27, 650.00, NULL),
(70, 30, 10, 400.00, NULL),
(71, 30, 21, 150.00, NULL),
(72, 30, 12, 80.00, NULL),
(73, 30, 26, 120.00, NULL),
(74, 30, 23, 100.00, NULL),
(75, 30, 22, 750.00, NULL),
(76, 31, 24, 350.00, NULL),
(77, 31, 19, 300.00, NULL),
(78, 32, 10, 450.00, NULL),
(79, 32, 21, 150.00, NULL),
(80, 32, 19, 400.00, NULL),
(81, 32, 20, 1000.00, NULL),
(82, 33, 23, 100.00, NULL),
(83, 33, 18, 200.00, NULL),
(84, 33, 19, 300.00, NULL),
(85, 33, 20, 700.00, NULL),
(86, 34, 12, 80.00, NULL),
(87, 34, 22, 750.00, NULL),
(88, 35, 21, 150.00, NULL),
(89, 35, 20, 1000.00, NULL),
(90, 36, 25, 250.00, NULL),
(91, 36, 27, 650.00, NULL),
(92, 36, 12, 80.00, NULL),
(93, 36, 20, 850.00, NULL),
(94, 37, 3, 600.00, NULL),
(95, 37, 21, 150.00, NULL),
(96, 37, 22, 750.00, NULL),
(97, 38, 25, 250.00, NULL),
(98, 38, 21, 150.00, NULL),
(99, 38, 17, 900.00, NULL),
(100, 39, 25, 250.00, NULL),
(101, 39, 21, 150.00, NULL),
(102, 39, 20, 850.00, NULL),
(103, 40, 10, 400.00, NULL),
(104, 40, 26, 120.00, NULL),
(105, 40, 20, 850.00, NULL),
(106, 41, 16, 220.00, NULL),
(107, 41, 23, 100.00, NULL),
(108, 41, 17, 1100.00, NULL),
(109, 42, 25, 250.00, NULL),
(110, 42, 27, 1000.00, NULL),
(111, 42, 21, 150.00, NULL),
(112, 42, 20, 1150.00, NULL);

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
(11, 'Bryant Iverson Cervantes Melliza', '0943-135-9316', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-18 17:10:43', '2025-09-18 17:10:43', NULL, 'walk_in'),
(12, 'Bryant Iverson C. Melliza', '0939-817-0375', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-22 08:58:42', '2025-09-22 08:58:42', NULL, 'walk_in'),
(14, 'Bryant Iverson C. Melliza', '0943-135-9316', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-22 15:44:12', '2025-09-22 15:44:12', NULL, 'walk_in'),
(15, 'Bryant Iverson C. Melliza', '0943-135-9316', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-23 04:25:07', '2025-09-23 04:25:07', NULL, 'walk_in'),
(16, 'Bryant Iverson C. Melliza', '0943-135-9316', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-23 05:03:39', '2025-09-23 05:03:39', NULL, 'walk_in'),
(17, 'Bryant Iverson C. Melliza', '0939-817-0375', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-23 05:28:13', '2025-09-23 05:28:13', NULL, 'walk_in'),
(18, 'Bryant Iverson C. Melliza', '0939-817-0375', 'bryantiversonmelliza@gmail.com', NULL, NULL, '2025-09-23 13:24:04', '2025-09-23 13:24:04', NULL, 'walk_in'),
(19, 'Iverson melliza', '0939-817-0375', 'bryantiversonmelliza@gmail.com', NULL, NULL, '2025-09-23 14:05:30', '2025-09-23 14:05:30', NULL, 'walk_in'),
(20, 'Bryant Iverson C. Melliza', '0943-135-9316', 'brybry.melliza@gmail.com', NULL, NULL, '2025-09-23 14:56:35', '2025-09-23 14:56:35', NULL, 'walk_in'),
(21, 'Spongebob Squarepants', '0939-817-0375', 'brybry.melliza@gmail.com', NULL, NULL, '2025-09-23 15:43:48', '2025-09-23 15:43:48', NULL, 'walk_in'),
(22, 'Spongebob Squarepants', '0939-817-0375', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-23 15:56:51', '2025-09-23 15:56:51', NULL, 'walk_in'),
(23, 'Bryant Iverson C. Melliza', '0943-135-9316', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-23 16:34:53', '2025-09-23 16:34:53', NULL, 'walk_in'),
(24, 'Bryant Iverson C. Melliza', '0943-135-9316', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-23 17:35:24', '2025-09-23 17:35:24', NULL, 'walk_in'),
(25, 'test', '0939-817-0375', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-23 17:39:12', '2025-09-23 17:39:12', NULL, 'walk_in'),
(28, 'Bryant Iverson Melliza', '09398170375', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-24 07:15:47', '2025-09-24 07:15:47', 17, 'online'),
(29, 'brybry', '0939-817-0375', 'brybry@gmail.com', NULL, NULL, '2025-09-25 15:20:12', '2025-09-25 15:20:12', NULL, 'walk_in'),
(30, 'Bryant Iverson Melliza', '0939-817-0375', 'brybry.melliza@gmail.com', NULL, NULL, '2025-09-25 15:48:19', '2025-09-25 15:48:19', NULL, 'walk_in'),
(31, 'bryantiversonmelliza03@gmail.com', '0939-817-0375', 'brybry.melliza@gmail.com', NULL, NULL, '2025-09-25 15:55:14', '2025-09-25 15:55:14', NULL, 'walk_in'),
(32, 'Bryant Iverson C. Melliza', '0939-817-0375', 'brybry.melliza@gmail.com', NULL, NULL, '2025-09-25 16:03:57', '2025-09-25 16:03:57', NULL, 'walk_in'),
(33, 'Bryant Iverson Melliza', '0939-817-0375', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-25 16:42:50', '2025-09-25 16:42:50', NULL, 'walk_in'),
(34, 'bry', '0939-817-0375', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-25 16:56:51', '2025-09-25 16:56:51', NULL, 'walk_in'),
(35, 'test', '0939-817-0375', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-25 17:04:42', '2025-09-25 17:04:42', NULL, 'walk_in'),
(37, 'test', '0931-425-6346', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-25 17:27:43', '2025-09-25 17:27:43', NULL, 'walk_in'),
(38, 'bryantiversonmelliza03@gmail.com', '0939-817-0375', 'bryantiversonmelliza03@gmail.com', NULL, NULL, '2025-09-25 17:49:29', '2025-09-25 17:49:29', NULL, 'walk_in'),
(39, 'Juan Dela Cruz', '0943-131-2312', '8pawspetboutique2@gmail.com', NULL, NULL, '2025-09-26 09:21:23', '2025-09-26 09:21:23', NULL, 'walk_in'),
(40, 'Juan Dela Cruz', '0943-135-9316', '8pawspetboutique2@gmail.com', NULL, NULL, '2025-09-26 10:06:45', '2025-09-26 10:06:45', NULL, 'walk_in'),
(41, 'Juan Dela Cruz', '09398170375', '8pawspetboutique2@gmail.com', NULL, NULL, '2025-09-26 10:46:23', '2025-09-26 10:46:23', 19, 'online'),
(42, 'Juan Dela Cruz', '0943-135-9316', '8pawspetboutique2@gmail.com', NULL, NULL, '2025-09-26 13:50:06', '2025-09-26 13:50:06', NULL, 'walk_in');

-- --------------------------------------------------------

--
-- Table structure for table `package_customizations`
--

CREATE TABLE `package_customizations` (
  `id` int(11) NOT NULL,
  `booking_id` int(11) NOT NULL,
  `package_name` varchar(100) NOT NULL,
  `service_name` varchar(100) NOT NULL,
  `included` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `package_customizations`
--

INSERT INTO `package_customizations` (`id`, `booking_id`, `package_name`, `service_name`, `included`, `created_at`) VALUES
(1, 1, 'Full Grooming Package', 'Bath & Dry', 1, '2025-09-22 15:42:55'),
(2, 1, 'Full Grooming Package', 'Haircut & Styling', 1, '2025-09-22 15:42:55'),
(3, 1, 'Full Grooming Package', 'Nail Trimming & Grinding', 0, '2025-09-22 15:42:55'),
(4, 1, 'Full Grooming Package', 'Ear Cleaning & Inspection', 1, '2025-09-22 15:42:55'),
(5, 1, 'Full Grooming Package', 'Teeth Cleaning', 1, '2025-09-22 15:42:55'),
(6, 1, 'Full Grooming Package', 'De-shedding Treatment', 0, '2025-09-22 15:42:55'),
(10, 20, 'Bath & Brush Package', 'Bath & Dry', 1, '2025-09-23 04:25:07'),
(11, 20, 'Bath & Brush Package', 'De-shedding Treatment', 1, '2025-09-23 04:25:07'),
(12, 21, 'Spa Relaxation Package', 'Bath & Dry', 1, '2025-09-23 05:03:39'),
(13, 21, 'Spa Relaxation Package', 'Paw Balm', 1, '2025-09-23 05:03:39'),
(14, 21, 'Spa Relaxation Package', 'Scented Cologne', 1, '2025-09-23 05:03:39'),
(15, 22, 'Essential Grooming Package', 'Bath & Dry', 1, '2025-09-23 05:28:13'),
(16, 22, 'Essential Grooming Package', 'Nail Trimming & Grinding', 1, '2025-09-23 05:28:13'),
(17, 22, 'Essential Grooming Package', 'Ear Cleaning & Inspection', 1, '2025-09-23 05:28:13'),
(18, 23, 'Spa Relaxation Package', 'Bath & Dry', 1, '2025-09-23 13:24:04'),
(19, 23, 'Spa Relaxation Package', 'Paw Balm', 1, '2025-09-23 13:24:04'),
(20, 23, 'Spa Relaxation Package', 'Scented Cologne', 1, '2025-09-23 13:24:04'),
(21, 24, 'Essential Grooming Package', 'Bath & Dry', 1, '2025-09-23 14:05:30'),
(22, 24, 'Essential Grooming Package', 'Nail Trimming & Grinding', 1, '2025-09-23 14:05:30'),
(23, 24, 'Essential Grooming Package', 'Ear Cleaning & Inspection', 1, '2025-09-23 14:05:30'),
(24, 25, 'Essential Grooming Package', 'Bath & Dry', 1, '2025-09-23 14:56:35'),
(25, 25, 'Essential Grooming Package', 'Nail Trimming & Grinding', 1, '2025-09-23 14:56:35'),
(26, 25, 'Essential Grooming Package', 'Ear Cleaning & Inspection', 1, '2025-09-23 14:56:35'),
(27, 26, 'Spa Relaxation Package', 'Bath & Dry', 1, '2025-09-23 15:43:48'),
(28, 26, 'Spa Relaxation Package', 'Paw Balm', 1, '2025-09-23 15:43:48'),
(29, 26, 'Spa Relaxation Package', 'Scented Cologne', 1, '2025-09-23 15:43:48'),
(33, 28, 'Spa Relaxation Package', 'Bath & Dry', 1, '2025-09-23 16:34:53'),
(34, 28, 'Spa Relaxation Package', 'Paw Balm', 1, '2025-09-23 16:34:53'),
(35, 28, 'Spa Relaxation Package', 'Scented Cologne', 0, '2025-09-23 16:34:53'),
(36, 29, 'Spa Relaxation Package', 'Bath & Dry', 1, '2025-09-23 17:35:24'),
(37, 29, 'Spa Relaxation Package', 'Paw Balm', 1, '2025-09-23 17:35:24'),
(38, 29, 'Spa Relaxation Package', 'Scented Cologne', 0, '2025-09-23 17:35:24'),
(39, 30, 'Essential Grooming Package', 'Bath & Dry', 1, '2025-09-23 17:39:12'),
(40, 30, 'Essential Grooming Package', 'Nail Trimming & Grinding', 1, '2025-09-23 17:39:12'),
(41, 30, 'Essential Grooming Package', 'Ear Cleaning & Inspection', 1, '2025-09-23 17:39:12'),
(42, 32, 'Bath & Brush Package', 'Bath & Dry', 1, '2025-09-25 15:48:19'),
(43, 32, 'Bath & Brush Package', 'De-shedding Treatment', 1, '2025-09-25 15:48:19'),
(44, 33, 'Bath & Brush Package', 'Bath & Dry', 1, '2025-09-25 15:55:14'),
(45, 33, 'Bath & Brush Package', 'De-shedding Treatment', 1, '2025-09-25 15:55:14'),
(46, 34, 'Essential Grooming Package', 'Bath & Dry', 1, '2025-09-25 16:03:57'),
(47, 34, 'Essential Grooming Package', 'Nail Trimming & Grinding', 1, '2025-09-25 16:03:57'),
(48, 34, 'Essential Grooming Package', 'Ear Cleaning & Inspection', 1, '2025-09-25 16:03:57'),
(49, 35, 'Bath & Brush Package', 'Bath & Dry', 1, '2025-09-25 16:42:50'),
(50, 35, 'Bath & Brush Package', 'De-shedding Treatment', 1, '2025-09-25 16:42:50'),
(51, 36, 'Bath & Brush Package', 'Bath & Dry', 1, '2025-09-25 16:56:51'),
(52, 36, 'Bath & Brush Package', 'De-shedding Treatment', 1, '2025-09-25 16:56:51'),
(53, 37, 'Essential Grooming Package', 'Bath & Dry', 1, '2025-09-25 17:04:42'),
(54, 37, 'Essential Grooming Package', 'Nail Trimming & Grinding', 1, '2025-09-25 17:04:42'),
(55, 37, 'Essential Grooming Package', 'Ear Cleaning & Inspection', 1, '2025-09-25 17:04:42'),
(56, 38, 'Spa Relaxation Package', 'Bath & Dry', 1, '2025-09-25 17:27:43'),
(57, 38, 'Spa Relaxation Package', 'Paw Balm', 1, '2025-09-25 17:27:43'),
(58, 38, 'Spa Relaxation Package', 'Scented Cologne', 1, '2025-09-25 17:27:43'),
(59, 39, 'Bath & Brush Package', 'Bath & Dry', 1, '2025-09-25 17:49:29'),
(60, 39, 'Bath & Brush Package', 'De-shedding Treatment', 1, '2025-09-25 17:49:29'),
(61, 40, 'Bath & Brush Package', 'Bath & Dry', 1, '2025-09-26 09:21:23'),
(62, 40, 'Bath & Brush Package', 'De-shedding Treatment', 1, '2025-09-26 09:21:23'),
(63, 41, 'Spa Relaxation Package', 'Bath & Dry', 1, '2025-09-26 10:06:45'),
(64, 41, 'Spa Relaxation Package', 'Paw Balm', 1, '2025-09-26 10:06:45'),
(65, 41, 'Spa Relaxation Package', 'Scented Cologne', 1, '2025-09-26 10:06:45'),
(66, 42, 'Bath & Brush Package', 'Bath & Dry', 1, '2025-09-26 13:50:06'),
(67, 42, 'Bath & Brush Package', 'De-shedding Treatment', 1, '2025-09-26 13:50:06');

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
  `last_vaccine_date` date DEFAULT NULL,
  `vaccine_types` varchar(255) DEFAULT NULL,
  `custom_vaccine` varchar(255) DEFAULT NULL,
  `vaccination_proof` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Pet information including vaccination records';

--
-- Dumping data for table `pets`
--

INSERT INTO `pets` (`id`, `customer_id`, `name`, `type`, `pet_type`, `breed`, `age_range`, `size`, `special_notes`, `last_vaccine_date`, `vaccine_types`, `custom_vaccine`, `vaccination_proof`, `created_at`, `updated_at`) VALUES
(1, 0, 'Buddy', 'dog', 'dog', 'boxer', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-08-28 04:22:04', '2025-08-28 04:22:04'),
(2, 0, 'Buddy', 'dog', 'dog', 'bluetick', NULL, NULL, '', NULL, NULL, NULL, NULL, '2025-08-28 04:25:50', '2025-08-28 04:25:50'),
(3, 0, 'Buddy', 'dog', 'dog', 'brabancon', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-08-28 04:34:08', '2025-08-28 04:34:08'),
(4, 1, 'Test Pet', 'dog', NULL, 'mixed', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 14:37:37', '2025-08-28 14:37:37'),
(6, 4, 'Test', 'dog', 'dog', 'boxer', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-08-28 17:36:31', '2025-08-28 17:36:31'),
(9, 5, 'Buddy', 'dog', 'dog', 'african', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-08-28 17:51:13', '2025-08-28 17:51:13'),
(10, 6, 'Buddy', 'dog', 'dog', 'brabancon', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-08-28 18:17:47', '2025-08-28 18:17:47'),
(11, 7, 'Buddy', 'dog', 'dog', 'bulldog', 'senior', NULL, '', NULL, NULL, NULL, NULL, '2025-08-28 20:57:50', '2025-08-28 20:57:50'),
(12, 8, 'Buddy', 'dog', 'dog', 'cavapoo', 'senior', NULL, '', NULL, NULL, NULL, NULL, '2025-08-28 22:10:53', '2025-08-28 22:10:53'),
(13, 9, 'Buddy', 'dog', 'dog', 'basenji', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-08-28 23:34:22', '2025-08-28 23:34:22'),
(14, 10, 'Buddy', 'dog', 'dog', 'doberman', 'adult', NULL, '', NULL, NULL, NULL, NULL, '2025-08-29 00:53:34', '2025-08-29 00:53:34'),
(15, 11, 'owley', 'cat', 'cat', 'American Bobtail', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-18 17:10:43', '2025-09-18 17:10:43'),
(16, 12, 'owley', 'dog', 'dog', 'airedale', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-22 08:58:42', '2025-09-22 08:58:42'),
(18, 14, 'owley', 'dog', 'dog', 'african', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-22 15:44:12', '2025-09-22 15:44:12'),
(19, 15, 'owley', 'cat', 'cat', 'American Bobtail', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-23 04:25:07', '2025-09-23 04:25:07'),
(20, 16, 'tanggol', 'cat', 'cat', 'Aegean', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-23 05:03:39', '2025-09-23 05:03:39'),
(21, 17, 'tanggol', 'dog', 'dog', 'african', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-23 05:28:13', '2025-09-23 05:28:13'),
(22, 18, 'owley', 'dog', 'dog', 'appenzeller', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-23 13:24:04', '2025-09-23 13:24:04'),
(23, 19, 'ollie', 'cat', 'cat', 'Singapura', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-23 14:05:30', '2025-09-23 14:05:30'),
(24, 20, 'test 2', 'cat', 'cat', 'Aegean', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-23 14:56:35', '2025-09-23 14:56:35'),
(25, 21, 'tanggol', 'dog', 'dog', 'african', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-23 15:43:48', '2025-09-23 15:43:48'),
(26, 22, 'owley', 'cat', 'cat', 'Aegean', 'adult', NULL, 'test', NULL, NULL, NULL, NULL, '2025-09-23 15:56:51', '2025-09-23 15:56:51'),
(27, 23, 'owley', 'dog', 'dog', 'african', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-23 16:34:53', '2025-09-23 16:34:53'),
(28, 24, 'tanggol', 'cat', 'cat', 'Aegean', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-23 17:35:24', '2025-09-23 17:35:24'),
(29, 25, 'tracking 1', 'dog', 'dog', 'australian', 'senior', NULL, '', NULL, NULL, NULL, NULL, '2025-09-23 17:39:12', '2025-09-23 17:39:12'),
(32, 28, 'tanggol', 'cat', 'cat', 'American Bobtail', NULL, 'large', '', NULL, NULL, NULL, NULL, '2025-09-24 07:15:47', '2025-09-25 07:38:33'),
(33, 28, 'owley', 'cat', 'cat', 'American Bobtail', 'puppy', NULL, '', NULL, NULL, NULL, NULL, '2025-09-24 07:19:40', '2025-09-24 07:19:40'),
(34, 28, 'tanggol', 'cat', 'cat', 'Kurilian', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-24 07:24:57', '2025-09-24 07:24:57'),
(35, 28, 'tanggoltesti', 'cat', 'cat', 'American Shorthair', 'young', NULL, '', NULL, NULL, NULL, NULL, '2025-09-24 07:39:11', '2025-09-24 07:39:11'),
(36, 28, 'testing ulit', 'dog', 'dog', 'airedale', 'adult', NULL, '', NULL, NULL, NULL, NULL, '2025-09-24 08:10:24', '2025-09-24 08:10:24'),
(40, 28, 'tadzu', 'dog', 'dog', 'shihtzu', NULL, 'medium', '', NULL, NULL, NULL, NULL, '2025-09-24 16:38:15', '2025-09-24 16:38:15'),
(41, 28, 'testing 3', 'dog', 'dog', 'akita', NULL, 'medium', '', NULL, NULL, NULL, NULL, '2025-09-24 18:57:57', '2025-09-24 18:57:57'),
(42, 28, 'testing #6', 'cat', 'cat', 'American Curl', NULL, 'medium', '', NULL, NULL, NULL, NULL, '2025-09-25 07:36:54', '2025-09-25 07:36:54'),
(43, 28, 'owley', 'cat', 'cat', 'American Curl', NULL, 'large', '', NULL, NULL, NULL, NULL, '2025-09-25 07:39:38', '2025-09-25 07:39:38'),
(44, 28, 'test #7', 'cat', 'cat', 'American Wirehair', NULL, 'medium', '', NULL, NULL, NULL, NULL, '2025-09-25 07:44:33', '2025-09-25 07:44:33'),
(45, 28, 'tanggol', 'cat', 'cat', 'Aegean', NULL, 'small', '', NULL, NULL, NULL, NULL, '2025-09-25 07:51:44', '2025-09-25 12:46:06'),
(46, 28, 'tanggol', 'dog', 'dog', 'akita', NULL, 'large', '', NULL, NULL, NULL, NULL, '2025-09-25 08:02:13', '2025-09-25 08:02:13'),
(48, 28, 'owley', 'cat', 'cat', 'American Wirehair', NULL, 'large', '', NULL, NULL, NULL, NULL, '2025-09-25 08:21:04', '2025-09-25 08:21:04'),
(49, 28, 'tanggoltesti', 'dog', 'dog', 'affenpinscher', NULL, 'large', '', NULL, NULL, NULL, NULL, '2025-09-25 08:37:18', '2025-09-25 08:37:18'),
(50, 28, 'owley', 'dog', 'dog', 'akita', NULL, 'small', '', NULL, NULL, NULL, NULL, '2025-09-25 08:41:16', '2025-09-25 08:41:16'),
(51, 28, 'tanggol', 'cat', 'cat', 'American Shorthair', NULL, 'large', '', NULL, NULL, NULL, NULL, '2025-09-25 08:50:36', '2025-09-25 08:50:36'),
(52, 28, 'tadzu', 'dog', 'dog', 'chippiparai', NULL, 'xlarge', '', NULL, NULL, NULL, NULL, '2025-09-25 08:59:36', '2025-09-25 08:59:36'),
(53, 28, 'owley', 'dog', 'dog', 'african', NULL, 'xlarge', '', NULL, NULL, NULL, NULL, '2025-09-25 09:20:52', '2025-09-25 09:20:52'),
(54, 28, 'tadzu', 'cat', 'cat', 'American Wirehair', NULL, 'xlarge', '', NULL, NULL, NULL, NULL, '2025-09-25 09:28:01', '2025-09-25 09:28:01'),
(55, 28, 'hay nako', 'dog', 'dog', 'airedale', NULL, 'xlarge', 'sq', NULL, NULL, NULL, NULL, '2025-09-25 12:19:31', '2025-09-25 12:19:31'),
(56, 28, 'test', 'cat', 'cat', 'Abyssinian', NULL, 'medium', '', NULL, NULL, NULL, NULL, '2025-09-25 12:42:52', '2025-09-25 12:42:52'),
(57, 28, 'tadzu', 'cat', 'cat', 'American Shorthair', NULL, 'medium', '', NULL, NULL, NULL, NULL, '2025-09-25 13:43:16', '2025-09-25 13:43:16'),
(58, 29, 'tadzu', 'cat', 'cat', 'Aegean', 'young', NULL, '', '2025-09-03', 'others', 'secret', NULL, '2025-09-25 15:20:12', '2025-09-25 15:20:12'),
(59, 30, 'tadzu', 'dog', 'dog', 'akita', 'young', NULL, 'none', '2025-07-14', 'parvo', '', NULL, '2025-09-25 15:48:19', '2025-09-25 15:48:19'),
(60, 31, 'tadzu', 'dog', 'dog', 'affenpinscher', 'adult', NULL, 'none', '2025-09-10', 'distemper', '', NULL, '2025-09-25 15:55:14', '2025-09-25 15:55:14'),
(61, 32, 'tadzu', 'dog', 'dog', 'airedale', 'young', NULL, '', '2024-02-14', 'parvo', '', NULL, '2025-09-25 16:03:57', '2025-09-25 16:03:57'),
(62, 33, 'test', 'dog', 'dog', 'airedale', 'young', NULL, '', '2025-09-03', 'parvo', '', NULL, '2025-09-25 16:42:50', '2025-09-25 16:42:50'),
(63, 34, 'tanggol', 'dog', 'dog', 'akita', 'young', 'medium', '', '2025-09-05', 'distemper', '', NULL, '2025-09-25 16:56:51', '2025-09-25 16:56:51'),
(64, 35, 'tanggol', 'cat', 'cat', 'Aegean', 'young', 'medium', '', '2025-09-03', 'parvo', '', NULL, '2025-09-25 17:04:42', '2025-09-25 17:04:42'),
(65, 37, 'tanggol', 'cat', 'cat', 'Aegean', 'young', 'small', '', '2025-09-03', 'parvo', '', 'uploads/vaccines/vaccine_1758821238_68d57b765da64.png', '2025-09-25 17:27:43', '2025-09-25 17:27:43'),
(66, 38, 'tadzu', 'dog', 'dog', 'appenzeller', 'young', 'medium', '', '2025-09-10', 'rabies', '', 'uploads/vaccines/vaccine_1758822540_68d5808c0e8a6.png', '2025-09-25 17:49:29', '2025-09-25 17:49:29'),
(67, 28, 'testing ulit', 'dog', 'dog', 'affenpinscher', NULL, 'small', '', NULL, NULL, NULL, NULL, '2025-09-25 18:57:32', '2025-09-25 18:57:32'),
(68, 28, 'hay nako', 'dog', 'dog', 'african', NULL, 'large', '', NULL, NULL, NULL, NULL, '2025-09-25 19:10:28', '2025-09-25 19:10:28'),
(69, 28, 'testing #5', 'dog', 'dog', 'australian', NULL, 'medium', '', '2025-09-03', '[\"rabies\"]', '', 'uploads/vaccines/vaccine_1758829214_68d59a9e7219a.png', '2025-09-25 19:40:14', '2025-09-25 19:40:14'),
(70, 28, 'tanggol', 'dog', 'dog', 'appenzeller', NULL, 'medium', '', '2025-09-18', '[\"parvo\"]', '', 'uploads/vaccines/vaccine_1758830912_68d5a14077e52.png', '2025-09-25 20:08:32', '2025-09-25 20:08:32'),
(71, 28, 'test #7', 'cat', 'cat', 'American Curl', NULL, 'large', '', '2025-09-11', '[\"parvo\"]', '', 'uploads/vaccines/vaccine_1758874863_68d64cef733f7.png', '2025-09-26 08:21:03', '2025-09-26 08:21:03'),
(72, 39, 'tadzu', 'dog', 'dog', 'african', 'young', 'medium', 'None', '2025-09-03', 'distemper', '', 'uploads/vaccines/vaccine_1758878244_68d65a24d2156.png', '2025-09-26 09:21:23', '2025-09-26 09:21:23'),
(73, 40, 'owley', 'cat', 'cat', 'Himalayan', 'adult', 'medium', '', '2025-09-10', 'parvo', '', 'uploads/vaccines/vaccine_1758881183_68d6659f052a7.png', '2025-09-26 10:06:45', '2025-09-26 10:06:45'),
(74, 41, 'tadzu', 'cat', 'cat', 'American Bobtail', NULL, 'large', '', '2025-09-11', '[\"rabies\"]', '', 'uploads/vaccines/vaccine_1758883583_68d66eff25962.png', '2025-09-26 10:46:23', '2025-09-26 10:46:23'),
(75, 41, 'tadzu', 'dog', 'dog', 'airedale', NULL, 'large', '', '2025-09-10', '[\"rabies\"]', '', 'uploads/vaccines/vaccine_1758890257_68d68911659a6.png', '2025-09-26 12:05:09', '2025-09-26 12:37:37'),
(76, 41, 'testing #1', 'dog', 'dog', 'akita', NULL, 'small', '', '2025-09-10', '[\"distemper\"]', '', 'uploads/vaccines/vaccine_1758889375_68d6859f2cb92.png', '2025-09-26 12:22:55', '2025-09-26 12:22:55'),
(78, 41, 'test #2', 'dog', 'dog', 'akita', NULL, 'medium', '', '2025-09-01', '[\"parvo\"]', '', 'uploads/vaccines/vaccine_1758891695_68d68eaf3ce59.png', '2025-09-26 13:01:35', '2025-09-26 13:01:35'),
(79, 41, 'testing 3', 'dog', 'dog', 'danish', NULL, 'xlarge', '', '2025-09-09', '[\"distemper\"]', '', 'uploads/vaccines/vaccine_1758892194_68d690a2959bd.png', '2025-09-26 13:09:54', '2025-09-26 13:09:54'),
(80, 41, 'owley', 'cat', 'cat', 'American Bobtail', NULL, 'small', '', '2025-09-10', '[\"rabies\"]', '', 'uploads/vaccines/vaccine_1758892979_68d693b39b927.png', '2025-09-26 13:22:59', '2025-09-26 13:22:59'),
(81, 41, 'test 5', 'cat', 'cat', 'American Bobtail', NULL, 'medium', '', '2025-09-05', '[\"parvo\"]', '', 'uploads/vaccines/vaccine_1758893032_68d693e8e46fd.png', '2025-09-26 13:23:52', '2025-09-26 13:23:52'),
(82, 42, 'owley', 'dog', 'dog', 'akita', 'adult', NULL, '', '2025-09-10', 'parvo', '', 'uploads/vaccines/vaccine_1758894531_68d699c333e32.png', '2025-09-26 13:50:06', '2025-09-26 13:50:06');

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
(5, '73:77:f8:39', 'SQWP8B3E', NULL, 2, 3, '2025-09-18 17:29:17', '2025-09-23 15:42:50', 1, '2025-09-23 15:42:50', 3000, 'ESP32-RFID-Scanner', 'active', 1),
(7, '11:7b:b0:01', 'KLHNUIT1', NULL, 3, 3, '2025-09-23 04:23:13', '2025-09-26 14:10:54', 1, '2025-09-26 14:10:54', 3000, 'ESP32-RFID-Scanner', 'active', 0),
(9, '53:89:08:02', 'CQBPCU8R', NULL, 1, 3, '2025-09-23 16:34:09', '2025-09-25 17:11:47', 1, '2025-09-25 17:11:47', 3000, 'ESP32-RFID-Scanner', 'active', 1),
(10, '69:33:b2:01', '5OJNU7ON', NULL, 1, 3, '2025-09-25 15:55:08', '2025-09-26 09:20:32', 1, '2025-09-26 09:20:32', 3000, 'ESP32-RFID-Scanner', 'active', 1),
(11, 'c2:48:94:ab', '3STGX4D1', NULL, 2, 3, '2025-09-25 16:42:40', '2025-09-25 17:55:37', 1, '2025-09-25 17:55:37', 3000, 'ESP32-RFID-Scanner', 'active', 1);

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
(96, 5, '73:77:f8:39', '23S8BY3D', 1, NULL, '2025-09-22 06:58:02', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -58, 'approved', '2025-09-22 14:58:02', '2025-09-22 06:58:02', 'OK', NULL),
(736, 7, '11:7b:b0:01', 'KLHNUIT1', 1, NULL, '2025-09-23 04:23:13', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -63, 'approved', '2025-09-23 12:23:13', '2025-09-23 04:23:13', 'OK', NULL),
(837, 7, '11:7b:b0:01', 'KLHNUIT1', 1, NULL, '2025-09-23 13:22:24', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -64, 'approved', '2025-09-23 21:22:24', '2025-09-23 13:22:24', 'OK', NULL),
(838, 7, '11:7b:b0:01', 'KLHNUIT1', 2, NULL, '2025-09-23 13:22:53', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -63, 'approved', '2025-09-23 21:22:53', '2025-09-23 13:22:53', 'OK', NULL),
(839, 7, '11:7b:b0:01', 'KLHNUIT1', 3, NULL, '2025-09-23 13:23:11', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -65, 'approved', '2025-09-23 21:23:11', '2025-09-23 13:23:11', 'OK', NULL),
(840, 7, '11:7b:b0:01', 'J10X0C9P', 1, NULL, '2025-09-23 13:23:26', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -65, 'approved', '2025-09-23 21:23:26', '2025-09-23 13:23:26', 'OK', NULL),
(841, 7, '11:7b:b0:01', 'J10X0C9P', 2, NULL, '2025-09-23 13:25:01', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -68, 'approved', '2025-09-23 21:25:01', '2025-09-23 13:25:01', 'OK', NULL),
(845, 7, '11:7b:b0:01', 'J10X0C9P', 3, NULL, '2025-09-23 14:45:49', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -71, 'approved', '2025-09-23 22:45:48', '2025-09-23 14:45:48', 'OK', NULL),
(846, 7, '11:7b:b0:01', 'PAAAMTFB', 1, NULL, '2025-09-23 14:46:08', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -58, 'approved', '2025-09-23 22:46:08', '2025-09-23 14:46:08', 'OK', NULL),
(848, 7, '11:7b:b0:01', 'PAAAMTFB', 2, NULL, '2025-09-23 14:58:38', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -70, 'approved', '2025-09-23 22:58:38', '2025-09-23 14:58:38', 'OK', NULL),
(849, 7, '11:7b:b0:01', 'PAAAMTFB', 3, NULL, '2025-09-23 14:59:33', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -67, 'approved', '2025-09-23 22:59:33', '2025-09-23 14:59:33', 'OK', NULL),
(850, 5, '73:77:f8:39', 'V7J8G6RG', 1, NULL, '2025-09-23 15:41:05', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -63, 'approved', '2025-09-23 23:41:05', '2025-09-23 15:41:05', 'OK', NULL),
(851, 5, '73:77:f8:39', 'V7J8G6RG', 2, NULL, '2025-09-23 15:41:20', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -63, 'approved', '2025-09-23 23:41:20', '2025-09-23 15:41:20', 'OK', NULL),
(852, 5, '73:77:f8:39', 'V7J8G6RG', 3, NULL, '2025-09-23 15:41:35', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -62, 'approved', '2025-09-23 23:41:36', '2025-09-23 15:41:36', 'OK', NULL),
(853, 5, '73:77:f8:39', 'T2ZXE688', 1, NULL, '2025-09-23 15:41:50', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -58, 'approved', '2025-09-23 23:41:50', '2025-09-23 15:41:50', 'OK', NULL),
(854, 5, '73:77:f8:39', 'T2ZXE688', 2, NULL, '2025-09-23 15:42:07', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -60, 'approved', '2025-09-23 23:42:07', '2025-09-23 15:42:07', 'OK', NULL),
(855, 5, '73:77:f8:39', 'T2ZXE688', 3, NULL, '2025-09-23 15:42:21', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -59, 'approved', '2025-09-23 23:42:21', '2025-09-23 15:42:21', 'OK', NULL),
(856, 5, '73:77:f8:39', 'SQWP8B3E', 1, NULL, '2025-09-23 15:42:36', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -61, 'approved', '2025-09-23 23:42:36', '2025-09-23 15:42:36', 'OK', NULL),
(857, 5, '73:77:f8:39', 'SQWP8B3E', 2, NULL, '2025-09-23 15:42:50', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -69, 'approved', '2025-09-23 23:42:50', '2025-09-23 15:42:50', 'OK', NULL),
(864, 9, '53:89:08:02', 'T5XPV6IR', 2, NULL, '2025-09-23 16:34:09', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -61, 'approved', '2025-09-24 00:34:09', '2025-09-23 16:34:09', 'OK', NULL),
(865, 9, '53:89:08:02', 'T5XPV6IR', 3, NULL, '2025-09-23 16:34:24', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -60, 'approved', '2025-09-24 00:34:24', '2025-09-23 16:34:24', 'OK', NULL),
(866, 9, '53:89:08:02', '2CSXNB4B', 1, NULL, '2025-09-23 16:34:39', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -62, 'approved', '2025-09-24 00:34:39', '2025-09-23 16:34:39', 'OK', NULL),
(867, 9, '53:89:08:02', '2CSXNB4B', 2, NULL, '2025-09-23 17:32:32', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -73, 'approved', '2025-09-24 01:32:32', '2025-09-23 17:32:32', 'OK', NULL),
(868, 9, '53:89:08:02', '2CSXNB4B', 3, NULL, '2025-09-23 17:32:53', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -69, 'approved', '2025-09-24 01:32:54', '2025-09-23 17:32:54', 'OK', NULL),
(869, 9, '53:89:08:02', '6C30BPY5', 1, NULL, '2025-09-23 17:34:59', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -73, 'approved', '2025-09-24 01:34:59', '2025-09-23 17:34:59', 'OK', NULL),
(870, 9, '53:89:08:02', '6C30BPY5', 2, NULL, '2025-09-23 17:37:24', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -80, 'approved', '2025-09-24 01:37:24', '2025-09-23 17:37:24', 'OK', NULL),
(871, 9, '53:89:08:02', '6C30BPY5', 3, NULL, '2025-09-23 17:37:43', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -66, 'approved', '2025-09-24 01:37:43', '2025-09-23 17:37:43', 'OK', NULL),
(872, 9, '53:89:08:02', '4HVRF3UC', 1, NULL, '2025-09-23 17:39:07', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -70, 'approved', '2025-09-24 01:39:07', '2025-09-23 17:39:07', 'OK', NULL),
(873, 9, '53:89:08:02', '4HVRF3UC', 2, NULL, '2025-09-23 18:15:26', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -73, 'approved', '2025-09-24 02:15:26', '2025-09-23 18:15:26', 'OK', NULL),
(874, 9, '53:89:08:02', '4HVRF3UC', 3, NULL, '2025-09-23 18:44:03', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -81, 'approved', '2025-09-24 02:44:04', '2025-09-23 18:44:04', 'OK', NULL),
(875, 9, '53:89:08:02', 'CQBPCU8R', 1, NULL, '2025-09-25 15:20:08', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -65, 'approved', '2025-09-25 23:20:07', '2025-09-25 15:20:07', 'OK', NULL),
(876, 9, '53:89:08:02', 'CQBPCU8R', 2, NULL, '2025-09-25 15:29:54', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -60, 'approved', '2025-09-25 23:29:54', '2025-09-25 15:29:54', 'OK', NULL),
(877, 9, '53:89:08:02', 'CQBPCU8R', 1, NULL, '2025-09-25 15:44:07', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -59, 'approved', '2025-09-25 23:44:06', '2025-09-25 15:44:06', 'OK', NULL),
(878, 9, '53:89:08:02', 'CQBPCU8R', 2, NULL, '2025-09-25 15:44:27', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-25 23:44:27', '2025-09-25 15:44:27', 'OK', NULL),
(879, 9, '53:89:08:02', 'CQBPCU8R', 3, NULL, '2025-09-25 15:44:46', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -69, 'approved', '2025-09-25 23:44:43', '2025-09-25 15:44:43', 'OK', NULL),
(880, 9, '53:89:08:02', 'KEH368EC', 1, NULL, '2025-09-25 15:48:02', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-25 23:48:02', '2025-09-25 15:48:02', 'OK', NULL),
(881, 9, '53:89:08:02', 'CQBPCU8R', 1, NULL, '2025-09-25 15:50:05', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -54, 'approved', '2025-09-25 23:50:05', '2025-09-25 15:50:05', 'OK', NULL),
(882, 9, '53:89:08:02', 'CQBPCU8R', 2, NULL, '2025-09-25 15:50:20', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-25 23:50:20', '2025-09-25 15:50:20', 'OK', NULL),
(883, 9, '53:89:08:02', 'CQBPCU8R', 3, NULL, '2025-09-25 15:50:43', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-25 23:50:43', '2025-09-25 15:50:43', 'OK', NULL),
(884, 9, '53:89:08:02', 'RUFD7UUD', 1, NULL, '2025-09-25 15:52:07', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -53, 'approved', '2025-09-25 23:52:07', '2025-09-25 15:52:07', 'OK', NULL),
(885, 9, '53:89:08:02', 'RUFD7UUD', 2, NULL, '2025-09-25 15:52:23', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -60, 'approved', '2025-09-25 23:52:23', '2025-09-25 15:52:23', 'OK', NULL),
(886, 9, '53:89:08:02', 'CQBPCU8R', 1, NULL, '2025-09-25 15:54:00', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-25 23:54:00', '2025-09-25 15:54:00', 'OK', NULL),
(887, 9, '53:89:08:02', 'CQBPCU8R', 2, NULL, '2025-09-25 15:54:15', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -53, 'approved', '2025-09-25 23:54:15', '2025-09-25 15:54:15', 'OK', NULL),
(888, 9, '53:89:08:02', 'CQBPCU8R', 3, NULL, '2025-09-25 15:54:30', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -54, 'approved', '2025-09-25 23:54:30', '2025-09-25 15:54:30', 'OK', NULL),
(889, 9, '53:89:08:02', 'U2ORQDKT', 1, NULL, '2025-09-25 15:54:45', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -54, 'approved', '2025-09-25 23:54:45', '2025-09-25 15:54:45', 'OK', NULL),
(890, 10, '69:33:b2:01', 'UAA83NON', 1, NULL, '2025-09-25 15:55:08', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-25 23:55:08', '2025-09-25 15:55:08', 'OK', NULL),
(891, 10, '69:33:b2:01', 'UAA83NON', 2, NULL, '2025-09-25 15:56:56', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -57, 'approved', '2025-09-25 23:56:56', '2025-09-25 15:56:56', 'OK', NULL),
(892, 10, '69:33:b2:01', 'UAA83NON', 3, NULL, '2025-09-25 15:57:14', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-25 23:57:14', '2025-09-25 15:57:14', 'OK', NULL),
(893, 10, '69:33:b2:01', 'OBUEKQND', 1, NULL, '2025-09-25 16:03:25', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -53, 'approved', '2025-09-26 00:03:25', '2025-09-25 16:03:25', 'OK', NULL),
(894, 10, '69:33:b2:01', 'UAA83NON', 1, NULL, '2025-09-25 16:39:59', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -56, 'approved', '2025-09-26 00:39:59', '2025-09-25 16:39:59', 'OK', NULL),
(895, 10, '69:33:b2:01', 'UAA83NON', 2, NULL, '2025-09-25 16:40:16', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-26 00:40:16', '2025-09-25 16:40:16', 'OK', NULL),
(896, 10, '69:33:b2:01', 'UAA83NON', 3, NULL, '2025-09-25 16:40:31', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -57, 'approved', '2025-09-26 00:40:31', '2025-09-25 16:40:31', 'OK', NULL),
(897, 10, '69:33:b2:01', 'ZQRRU3L8', 1, NULL, '2025-09-25 16:40:46', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-26 00:40:46', '2025-09-25 16:40:46', 'OK', NULL),
(898, 10, '69:33:b2:01', 'ZQRRU3L8', 2, NULL, '2025-09-25 16:41:00', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-26 00:41:00', '2025-09-25 16:41:00', 'OK', NULL),
(899, 10, '69:33:b2:01', 'ZQRRU3L8', 3, NULL, '2025-09-25 16:41:15', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -56, 'approved', '2025-09-26 00:41:15', '2025-09-25 16:41:15', 'OK', NULL),
(900, 10, '69:33:b2:01', 'WI2DCKVR', 1, NULL, '2025-09-25 16:41:30', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-26 00:41:30', '2025-09-25 16:41:30', 'OK', NULL),
(901, 9, '53:89:08:02', 'CQBPCU8R', 1, NULL, '2025-09-25 16:41:44', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-26 00:41:44', '2025-09-25 16:41:44', 'OK', NULL),
(902, 9, '53:89:08:02', 'CQBPCU8R', 2, NULL, '2025-09-25 16:41:59', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -56, 'approved', '2025-09-26 00:41:59', '2025-09-25 16:41:59', 'OK', NULL),
(903, 9, '53:89:08:02', 'CQBPCU8R', 3, NULL, '2025-09-25 16:42:14', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-26 00:42:14', '2025-09-25 16:42:14', 'OK', NULL),
(904, 11, 'c2:48:94:ab', '3STGX4D1', 1, NULL, '2025-09-25 16:42:40', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -56, 'approved', '2025-09-26 00:42:40', '2025-09-25 16:42:40', 'OK', NULL),
(905, 11, 'c2:48:94:ab', '3STGX4D1', 2, NULL, '2025-09-25 16:48:31', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -53, 'approved', '2025-09-26 00:48:31', '2025-09-25 16:48:31', 'OK', NULL),
(906, 11, 'c2:48:94:ab', '3STGX4D1', 3, NULL, '2025-09-25 16:48:48', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -56, 'approved', '2025-09-26 00:48:48', '2025-09-25 16:48:48', 'OK', NULL),
(907, 11, 'c2:48:94:ab', '3STGX4D1', 1, NULL, '2025-09-25 16:56:42', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -63, 'approved', '2025-09-26 00:56:42', '2025-09-25 16:56:42', 'OK', NULL),
(908, 11, 'c2:48:94:ab', '3STGX4D1', 2, NULL, '2025-09-25 16:57:31', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -61, 'approved', '2025-09-26 00:57:31', '2025-09-25 16:57:31', 'OK', NULL),
(909, 11, 'c2:48:94:ab', '3STGX4D1', 3, NULL, '2025-09-25 16:57:49', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -61, 'approved', '2025-09-26 00:57:49', '2025-09-25 16:57:49', 'OK', NULL),
(910, 11, 'c2:48:94:ab', 'YKNALF3O', 1, NULL, '2025-09-25 17:04:35', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -70, 'approved', '2025-09-26 01:04:35', '2025-09-25 17:04:35', 'OK', NULL),
(911, 11, 'c2:48:94:ab', '3STGX4D1', 1, NULL, '2025-09-25 17:09:07', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -60, 'approved', '2025-09-26 01:09:07', '2025-09-25 17:09:07', 'OK', NULL),
(912, 11, 'c2:48:94:ab', '3STGX4D1', 2, NULL, '2025-09-25 17:09:21', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -57, 'approved', '2025-09-26 01:09:21', '2025-09-25 17:09:21', 'OK', NULL),
(913, 11, 'c2:48:94:ab', '3STGX4D1', 3, NULL, '2025-09-25 17:09:35', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -60, 'approved', '2025-09-26 01:09:35', '2025-09-25 17:09:35', 'OK', NULL),
(914, 11, 'c2:48:94:ab', 'L35YBN9N', 1, NULL, '2025-09-25 17:10:34', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -59, 'approved', '2025-09-26 01:10:34', '2025-09-25 17:10:34', 'OK', NULL),
(915, 11, 'c2:48:94:ab', 'L35YBN9N', 2, NULL, '2025-09-25 17:10:49', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -61, 'approved', '2025-09-26 01:10:49', '2025-09-25 17:10:49', 'OK', NULL),
(916, 11, 'c2:48:94:ab', 'L35YBN9N', 3, NULL, '2025-09-25 17:11:04', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -57, 'approved', '2025-09-26 01:11:04', '2025-09-25 17:11:04', 'OK', NULL),
(917, 10, '69:33:b2:01', 'UAA83NON', 1, NULL, '2025-09-25 17:11:18', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -58, 'approved', '2025-09-26 01:11:18', '2025-09-25 17:11:18', 'OK', NULL),
(918, 10, '69:33:b2:01', 'UAA83NON', 2, NULL, '2025-09-25 17:11:33', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-26 01:11:33', '2025-09-25 17:11:33', 'OK', NULL),
(919, 9, '53:89:08:02', 'CQBPCU8R', 1, NULL, '2025-09-25 17:11:47', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-26 01:11:47', '2025-09-25 17:11:47', 'OK', NULL),
(920, 7, '11:7b:b0:01', 'KLHNUIT1', 1, NULL, '2025-09-25 17:12:19', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -62, 'approved', '2025-09-26 01:12:19', '2025-09-25 17:12:19', 'OK', NULL),
(921, 7, '11:7b:b0:01', 'KLHNUIT1', 2, NULL, '2025-09-25 17:13:33', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -65, 'approved', '2025-09-26 01:13:33', '2025-09-25 17:13:33', 'OK', NULL),
(922, 7, '11:7b:b0:01', 'KLHNUIT1', 3, NULL, '2025-09-25 17:13:47', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -62, 'approved', '2025-09-26 01:13:47', '2025-09-25 17:13:47', 'OK', NULL),
(923, 7, '11:7b:b0:01', 'L4SB9VVF', 1, NULL, '2025-09-25 17:27:38', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -61, 'approved', '2025-09-26 01:27:38', '2025-09-25 17:27:38', 'OK', NULL),
(924, 7, '11:7b:b0:01', 'L4SB9VVF', 2, NULL, '2025-09-25 17:28:39', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -59, 'approved', '2025-09-26 01:28:39', '2025-09-25 17:28:39', 'OK', NULL),
(925, 7, '11:7b:b0:01', 'L4SB9VVF', 3, NULL, '2025-09-25 17:28:58', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -55, 'approved', '2025-09-26 01:28:58', '2025-09-25 17:28:58', 'OK', NULL),
(926, 7, '11:7b:b0:01', 'KLHNUIT1', 1, NULL, '2025-09-25 17:49:19', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -57, 'approved', '2025-09-26 01:49:19', '2025-09-25 17:49:19', 'OK', NULL),
(927, 7, '11:7b:b0:01', 'KLHNUIT1', 2, NULL, '2025-09-25 17:49:56', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -58, 'approved', '2025-09-26 01:49:56', '2025-09-25 17:49:56', 'OK', NULL),
(928, 7, '11:7b:b0:01', 'KLHNUIT1', 3, NULL, '2025-09-25 17:50:14', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -58, 'approved', '2025-09-26 01:50:14', '2025-09-25 17:50:14', 'OK', NULL),
(929, 7, '11:7b:b0:01', 'VEQNL2SL', 1, NULL, '2025-09-25 17:54:40', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -59, 'approved', '2025-09-26 01:54:40', '2025-09-25 17:54:40', 'OK', NULL),
(930, 11, 'c2:48:94:ab', '3STGX4D1', 1, NULL, '2025-09-25 17:55:22', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -59, 'approved', '2025-09-26 01:55:22', '2025-09-25 17:55:22', 'OK', NULL),
(931, 11, 'c2:48:94:ab', '3STGX4D1', 2, NULL, '2025-09-25 17:55:37', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -57, 'approved', '2025-09-26 01:55:37', '2025-09-25 17:55:37', 'OK', NULL),
(932, 10, '69:33:b2:01', 'UAA83NON', 1, NULL, '2025-09-25 17:55:51', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -58, 'approved', '2025-09-26 01:55:51', '2025-09-25 17:55:51', 'OK', NULL),
(933, 10, '69:33:b2:01', 'UAA83NON', 2, NULL, '2025-09-25 17:56:06', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -61, 'approved', '2025-09-26 01:56:06', '2025-09-25 17:56:06', 'OK', NULL),
(934, 10, '69:33:b2:01', 'UAA83NON', 3, NULL, '2025-09-25 17:56:21', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -60, 'approved', '2025-09-26 01:56:21', '2025-09-25 17:56:21', 'OK', NULL),
(935, 10, '69:33:b2:01', 'CMNRH61Q', 1, NULL, '2025-09-25 17:56:36', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -60, 'approved', '2025-09-26 01:56:36', '2025-09-25 17:56:36', 'OK', NULL),
(936, 10, '69:33:b2:01', 'CMNRH61Q', 2, NULL, '2025-09-25 17:56:51', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -60, 'approved', '2025-09-26 01:56:51', '2025-09-25 17:56:51', 'OK', NULL),
(937, 10, '69:33:b2:01', 'CMNRH61Q', 3, NULL, '2025-09-25 17:57:06', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -58, 'approved', '2025-09-26 01:57:06', '2025-09-25 17:57:06', 'OK', NULL),
(938, 10, '69:33:b2:01', '9EEWEOBP', 1, NULL, '2025-09-25 17:57:21', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -62, 'approved', '2025-09-26 01:57:21', '2025-09-25 17:57:21', 'OK', NULL),
(939, 10, '69:33:b2:01', '9EEWEOBP', 2, NULL, '2025-09-25 17:57:36', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -58, 'approved', '2025-09-26 01:57:36', '2025-09-25 17:57:36', 'OK', NULL),
(940, 10, '69:33:b2:01', '9EEWEOBP', 3, NULL, '2025-09-25 17:57:51', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -61, 'approved', '2025-09-26 01:57:51', '2025-09-25 17:57:51', 'OK', NULL),
(941, 10, '69:33:b2:01', '56PHV5L9', 1, NULL, '2025-09-25 17:58:06', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -60, 'approved', '2025-09-26 01:58:06', '2025-09-25 17:58:06', 'OK', NULL),
(942, 10, '69:33:b2:01', 'UAA83NON', 1, NULL, '2025-09-26 09:19:48', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -63, 'approved', '2025-09-26 17:19:48', '2025-09-26 09:19:48', 'OK', NULL),
(943, 10, '69:33:b2:01', 'UAA83NON', 2, NULL, '2025-09-26 09:20:02', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -59, 'approved', '2025-09-26 17:20:02', '2025-09-26 09:20:02', 'OK', NULL),
(944, 10, '69:33:b2:01', 'UAA83NON', 3, NULL, '2025-09-26 09:20:17', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -61, 'approved', '2025-09-26 17:20:17', '2025-09-26 09:20:17', 'OK', NULL),
(945, 10, '69:33:b2:01', '5OJNU7ON', 1, NULL, '2025-09-26 09:20:32', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -61, 'approved', '2025-09-26 17:20:32', '2025-09-26 09:20:32', 'OK', NULL),
(946, 7, '11:7b:b0:01', 'KLHNUIT1', 1, NULL, '2025-09-26 09:20:46', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -61, 'approved', '2025-09-26 17:20:46', '2025-09-26 09:20:46', 'OK', NULL),
(947, 7, '11:7b:b0:01', 'KLHNUIT1', 2, NULL, '2025-09-26 09:28:48', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -70, 'approved', '2025-09-26 17:28:47', '2025-09-26 09:28:47', 'OK', NULL),
(948, 7, '11:7b:b0:01', 'KLHNUIT1', 3, NULL, '2025-09-26 09:29:48', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -60, 'approved', '2025-09-26 17:29:48', '2025-09-26 09:29:48', 'OK', NULL),
(949, 7, '11:7b:b0:01', '7ETUTNW7', 1, NULL, '2025-09-26 10:06:38', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -64, 'approved', '2025-09-26 18:06:38', '2025-09-26 10:06:38', 'OK', NULL),
(950, 7, '11:7b:b0:01', '7ETUTNW7', 2, NULL, '2025-09-26 10:11:15', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -68, 'approved', '2025-09-26 18:11:15', '2025-09-26 10:11:15', 'OK', NULL),
(951, 7, '11:7b:b0:01', '7ETUTNW7', 3, NULL, '2025-09-26 10:16:25', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -63, 'approved', '2025-09-26 18:16:25', '2025-09-26 10:16:25', 'OK', NULL),
(952, 7, '11:7b:b0:01', 'KLHNUIT1', 1, NULL, '2025-09-26 13:50:01', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -72, 'approved', '2025-09-26 21:50:00', '2025-09-26 13:50:00', 'OK', NULL),
(953, 7, '11:7b:b0:01', 'KLHNUIT1', 2, NULL, '2025-09-26 13:50:44', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -74, 'approved', '2025-09-26 21:50:43', '2025-09-26 13:50:43', 'OK', NULL),
(954, 7, '11:7b:b0:01', 'KLHNUIT1', 3, NULL, '2025-09-26 14:10:54', 'ESP32-RFID-Scanner', 'PLDTHOMEFIBRc11f8', -67, 'approved', '2025-09-26 22:10:54', '2025-09-26 14:10:54', 'OK', NULL);

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
(8, 'Basic Bath', 250.00, 60, 'basic', 'Basic Bath', 1),
(9, 'Basic Bath & Dry', 300.00, 60, 'basic', 'Basic Bath & Dry', 1),
(10, 'Teeth Cleaning', 250.00, 60, 'basic', 'Teeth Cleaning', 1),
(11, 'Creative Grooming', 500.00, 60, 'basic', 'Creative Grooming', 1),
(12, 'Scented Cologne', 50.00, 60, 'basic', 'Scented Cologne', 1),
(16, 'Nail Trimming & Grinding', 260.00, 60, 'basic', 'Nail Trimming & Grinding', 1),
(17, 'Spa Relaxation Package (Customized)', 1300.00, 60, 'basic', 'Spa Relaxation Package (Customized)', 1),
(18, 'Whitening Shampoo', 250.00, 60, 'basic', 'Whitening Shampoo', 1),
(19, 'Flea & Tick Treatment', 350.00, 60, 'basic', 'Flea & Tick Treatment', 1),
(20, 'Bath & Brush Package (Customized)', 850.00, 60, 'basic', 'Bath & Brush Package (Customized)', 1),
(21, 'Extra Nail Polish', 150.00, 60, 'basic', 'Extra Nail Polish', 1),
(22, 'Essential Grooming Package (Customized)', 750.00, 60, 'basic', 'Essential Grooming Package (Customized)', 1),
(23, 'Paw Balm', 100.00, 60, 'basic', 'Paw Balm', 1),
(24, 'Bath & Dry', 350.00, 60, 'basic', 'Bath & Dry', 1),
(25, 'Ear Cleaning & Inspection', 250.00, 60, 'basic', 'Ear Cleaning & Inspection', 1),
(26, 'Bow or Bandana', 120.00, 60, 'basic', 'Bow or Bandana', 1),
(27, 'Haircut & Styling', 650.00, 60, 'basic', 'Haircut & Styling', 1);

-- --------------------------------------------------------

--
-- Table structure for table `services2`
--

CREATE TABLE `services2` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `category` enum('basic','package','addon') NOT NULL DEFAULT 'basic',
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
(1, 'Bath & Dry', 'Complete bath with shampoo, rinse, and professional drying', 'basic', 300.00, 1, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(2, 'Nail Trimming & Grinding', 'Professional nail care including trimming and grinding', 'basic', 150.00, 1, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(3, 'Ear Cleaning & Inspection', 'Safe ear cleaning and inspection for infections', 'basic', 200.00, 0, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(4, 'Haircut & Styling', 'Professional haircut and styling tailored to your pet', 'basic', 420.00, 1, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(5, 'Teeth Cleaning', 'Professional teeth cleaning and oral health check', 'basic', 250.00, 1, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(6, 'De-shedding Treatment', 'Special bath & brushing to reduce shedding up to 90%', 'basic', 400.00, 1, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(7, 'Essential Grooming Package', 'Basic grooming: bath, blow-dry, nail trim, ear cleaning', 'package', 450.00, 1, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(8, 'Full Grooming Package', 'Complete service: bath, haircut, nail trim, ear cleaning, teeth', 'package', 800.00, 1, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(9, 'Bath & Brush Package', 'Bath with specialized brushing treatment', 'package', 500.00, 1, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(10, 'Spa Relaxation Package', 'Aromatherapy bath with massage and premium care', 'package', 700.00, 1, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(11, 'Extra Nail Polish', 'Pet-safe nail colors', 'addon', 100.00, 0, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(12, 'Scented Cologne', 'Pet-safe fragrance application', 'addon', 50.00, 0, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(13, 'Bow or Bandana', 'Stylish accessory for finished look', 'addon', 75.00, 0, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(14, 'Paw Balm', 'Moisturizing treatment for dry pads', 'addon', 80.00, 0, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(15, 'Whitening Shampoo', 'Brightens white/light colored coats', 'addon', 120.00, 1, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(16, 'Flea & Tick Treatment', 'Anti-parasitic treatment', 'addon', 200.00, 1, 'active', '2025-09-22 13:49:37', '2025-09-22 13:49:37');

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
(1, 1, 'small', 350.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(2, 1, 'medium', 400.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(3, 1, 'large', 450.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(4, 1, 'extra_large', 500.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(5, 2, 'small', 180.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(6, 2, 'medium', 220.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(7, 2, 'large', 260.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(8, 2, 'extra_large', 300.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(9, 3, 'small', 250.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(10, 3, 'medium', 250.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(11, 3, 'large', 250.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(12, 3, 'extra_large', 250.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(13, 4, 'small', 500.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(14, 4, 'medium', 650.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(15, 4, 'large', 800.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(16, 4, 'extra_large', 1000.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(17, 5, 'small', 350.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(18, 5, 'medium', 400.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(19, 5, 'large', 450.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(20, 5, 'extra_large', 500.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(21, 6, 'small', 500.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(22, 6, 'medium', 600.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(23, 6, 'large', 700.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(24, 6, 'extra_large', 800.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(25, 7, 'small', 650.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(26, 7, 'medium', 750.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(27, 7, 'large', 850.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(28, 7, 'extra_large', 950.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(29, 8, 'small', 1200.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(30, 8, 'medium', 1400.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(31, 8, 'large', 1600.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(32, 8, 'extra_large', 1800.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(33, 9, 'small', 700.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(34, 9, 'medium', 850.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(35, 9, 'large', 1000.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(36, 9, 'extra_large', 1150.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(37, 10, 'small', 900.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(38, 10, 'medium', 1100.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(39, 10, 'large', 1300.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(40, 10, 'extra_large', 1500.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(41, 11, 'small', 150.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(42, 11, 'medium', 150.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(43, 11, 'large', 150.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(44, 11, 'extra_large', 150.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(45, 12, 'small', 80.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(46, 12, 'medium', 80.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(47, 12, 'large', 80.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(48, 12, 'extra_large', 80.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(49, 13, 'small', 120.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(50, 13, 'medium', 120.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(51, 13, 'large', 120.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(52, 13, 'extra_large', 120.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(53, 14, 'small', 100.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(54, 14, 'medium', 100.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(55, 14, 'large', 100.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(56, 14, 'extra_large', 100.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(57, 15, 'small', 200.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(58, 15, 'medium', 250.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(59, 15, 'large', 300.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(60, 15, 'extra_large', 350.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(61, 16, 'small', 300.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(62, 16, 'medium', 350.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(63, 16, 'large', 400.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37'),
(64, 16, 'extra_large', 450.00, '2025-09-22 13:49:37', '2025-09-22 13:49:37');

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
(38, 11, 'bathing', 'Status automatically updated via RFID tap #2', '2025-08-28 23:50:14'),
(39, 11, 'grooming', 'Status updated via RFID tap', '2025-08-28 23:50:44'),
(40, 11, 'ready', 'Status updated via RFID tap', '2025-08-28 23:50:46'),
(41, 11, 'completed', 'Status updated via RFID tap', '2025-08-28 23:50:48'),
(42, 15, 'checked-in', 'Initial check-in completed', '2025-08-29 00:53:34'),
(43, 15, 'bathing', 'Status automatically updated via RFID tap #2', '2025-08-29 00:55:07'),
(44, 15, 'grooming', 'Status automatically updated via RFID tap #3', '2025-08-29 00:55:29'),
(45, 15, 'ready', 'Status automatically updated via RFID tap #4', '2025-08-29 00:56:06'),
(46, 15, 'completed', 'Service completed! Pet picked up via RFID tap #5', '2025-08-29 00:56:29'),
(50, 20, 'checked-in', 'Initial check-in completed', '2025-09-23 04:25:07'),
(51, 21, 'checked-in', 'Initial check-in completed', '2025-09-23 05:03:39'),
(52, 21, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-23 05:26:47'),
(53, 21, 'grooming', 'Status updated via RFID tap', '2025-09-23 05:26:48'),
(54, 21, 'ready', 'Status updated via RFID tap', '2025-09-23 05:26:50'),
(55, 21, 'completed', 'Status updated via RFID tap', '2025-09-23 05:26:52'),
(56, 22, 'checked-in', 'Initial check-in completed', '2025-09-23 05:28:13'),
(57, 22, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-23 05:32:26'),
(58, 22, 'grooming', 'Status updated via RFID tap', '2025-09-23 13:22:16'),
(59, 22, 'ready', 'Status updated via RFID tap', '2025-09-23 13:22:18'),
(60, 22, 'completed', 'Status updated via RFID tap', '2025-09-23 13:22:20'),
(61, 20, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-23 13:22:53'),
(62, 20, 'grooming', 'Status updated via RFID tap', '2025-09-23 13:22:54'),
(63, 20, 'ready', 'Status updated via RFID tap', '2025-09-23 13:22:56'),
(64, 20, 'completed', 'Status updated via RFID tap', '2025-09-23 13:22:58'),
(65, 23, 'checked-in', 'Initial check-in completed', '2025-09-23 13:24:04'),
(66, 23, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-23 13:25:01'),
(67, 24, 'checked-in', 'Initial check-in completed', '2025-09-23 14:05:30'),
(68, 24, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-23 14:06:30'),
(69, 24, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-23 14:06:55'),
(70, 23, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-23 14:45:49'),
(71, 25, 'checked-in', 'Initial check-in completed', '2025-09-23 14:56:35'),
(72, 25, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-23 14:58:38'),
(73, 25, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-23 14:59:33'),
(74, 26, 'checked-in', 'Initial check-in completed', '2025-09-23 15:43:48'),
(75, 26, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-23 15:50:42'),
(76, 26, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-23 15:51:00'),
(78, 28, 'checked-in', 'Initial check-in completed', '2025-09-23 16:34:53'),
(79, 28, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-23 17:32:32'),
(80, 28, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-23 17:32:53'),
(81, 29, 'checked-in', 'Initial check-in completed', '2025-09-23 17:35:24'),
(82, 29, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-23 17:37:24'),
(83, 29, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-23 17:37:43'),
(84, 30, 'checked-in', 'Initial check-in completed', '2025-09-23 17:39:12'),
(85, 30, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-23 18:15:26'),
(86, 30, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-23 18:44:03'),
(87, 31, 'checked-in', 'Initial check-in completed', '2025-09-25 15:20:12'),
(88, 31, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-25 15:29:54'),
(89, 31, 'checked-in', 'Pet checked in via RFID tap #1', '2025-09-25 15:44:07'),
(90, 31, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-25 15:44:27'),
(91, 31, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-25 15:44:46'),
(92, 32, 'checked-in', 'Initial check-in completed', '2025-09-25 15:48:19'),
(93, 33, 'checked-in', 'Initial check-in completed', '2025-09-25 15:55:14'),
(94, 33, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-25 15:56:56'),
(95, 33, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-25 15:57:14'),
(96, 34, 'checked-in', 'Initial check-in completed', '2025-09-25 16:03:57'),
(97, 35, 'checked-in', 'Initial check-in completed', '2025-09-25 16:42:50'),
(98, 35, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-25 16:48:31'),
(99, 35, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-25 16:48:48'),
(100, 36, 'checked-in', 'Initial check-in completed', '2025-09-25 16:56:51'),
(101, 36, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-25 16:57:31'),
(102, 36, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-25 16:57:49'),
(103, 37, 'checked-in', 'Initial check-in completed', '2025-09-25 17:04:42'),
(104, 38, 'checked-in', 'Initial check-in completed', '2025-09-25 17:27:43'),
(105, 38, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-25 17:28:39'),
(106, 38, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-25 17:28:58'),
(107, 39, 'checked-in', 'Initial check-in completed', '2025-09-25 17:49:29'),
(108, 39, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-25 17:49:56'),
(109, 39, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-25 17:50:14'),
(110, 40, 'checked-in', 'Initial check-in completed', '2025-09-26 09:21:23'),
(111, 40, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-26 09:28:48'),
(112, 40, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-26 09:29:48'),
(113, 41, 'checked-in', 'Initial check-in completed', '2025-09-26 10:06:45'),
(114, 41, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-26 10:11:15'),
(115, 41, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-26 10:16:25'),
(116, 42, 'checked-in', 'Initial check-in completed', '2025-09-26 13:50:06'),
(117, 42, 'bathing', 'Pet bathing in progress via RFID tap #2', '2025-09-26 13:50:44'),
(118, 42, 'completed', 'Service completed! Pet ready for pickup via RFID tap #3', '2025-09-26 14:10:54');

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
(5, 'cashier4', '$2y$10$DCkL93xiqQBq.qg4lljde.z3QyQjF1sjxxgwW2Tw6CfXKsAqovhO2', 'cashier4@animates.ph', NULL, 'Cashier4 Cashier4', 'staff', 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 12:19:00', '2025-09-26 14:20:09'),
(6, 'cashier6', '$2y$10$yxpNL2gsMtCSJhYVfbDcAuEwv/gOPV.bcQg25B1htRMHg7LPp5PCy', 'cashier6@animates.ph', NULL, 'Cashier6 Staff', 'cashier', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 12:33:44', '2025-08-28 12:44:09'),
(7, 'cashier7', '$2y$10$F8qgmtj5bDleneWRVTyCt.T7XSR8CDc8zc7GbyGAkhHF17fA6F0h2', 'cashier7@animates.ph', NULL, 'cashier7 Cashier7', 'cashier', 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-28 12:46:39', '2025-08-28 12:46:39'),
(17, 'Bryant IversonMelliza', '$2y$10$Bggpc1A/GQSbf5mkhYG6A.78qiiqPMpLemaQKITtRvWXNlFLz96l6', 'bryantiversonmelliza03@gmail.com', '09398170375', 'Bryant Iverson Melliza', 'customer', 1, 1, NULL, NULL, '2025-09-18 10:56:21', '2025-09-18 16:26:49', NULL, NULL, NULL, '2025-09-18 16:26:21', '2025-09-18 16:26:49'),
(19, 'Juan DelaCruz', '$2y$10$7NUHEu3/FDZ/8ENTRRzICuFMpPfchewSn4f8G9jafYPo9QyRqTCMq', '8pawspetboutique2@gmail.com', '09398170375', 'Juan Dela Cruz', 'customer', 1, 1, NULL, NULL, '2025-09-26 04:11:59', '2025-09-26 09:43:51', NULL, NULL, NULL, '2025-09-26 09:41:59', '2025-09-26 09:54:50'),
(20, 'johndoe', '$2y$10$ut93lF/wa2pX1xhDIPPs8OyRBt4GamHXEzkuVEQCF3TT41Jb4GM2a', 'hanzokiller2003@gmail.com', NULL, 'John Doe', 'admin', 1, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-26 14:20:09', '2025-09-26 14:20:09');

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
-- Indexes for table `package_customizations`
--
ALTER TABLE `package_customizations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `booking_id` (`booking_id`),
  ADD KEY `package_name` (`package_name`),
  ADD KEY `service_name` (`service_name`);

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- AUTO_INCREMENT for table `appointment_services`
--
ALTER TABLE `appointment_services`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=194;

--
-- AUTO_INCREMENT for table `app_config`
--
ALTER TABLE `app_config`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT for table `booking_services`
--
ALTER TABLE `booking_services`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=113;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT for table `package_customizations`
--
ALTER TABLE `package_customizations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=68;

--
-- AUTO_INCREMENT for table `pets`
--
ALTER TABLE `pets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=83;

--
-- AUTO_INCREMENT for table `pet_sizes`
--
ALTER TABLE `pet_sizes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `rfid_cards`
--
ALTER TABLE `rfid_cards`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `rfid_tags`
--
ALTER TABLE `rfid_tags`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rfid_tap_history`
--
ALTER TABLE `rfid_tap_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=955;

--
-- AUTO_INCREMENT for table `sales_transactions`
--
ALTER TABLE `sales_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `services`
--
ALTER TABLE `services`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `services2`
--
ALTER TABLE `services2`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `service_pricing`
--
ALTER TABLE `service_pricing`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;

--
-- AUTO_INCREMENT for table `status_updates`
--
ALTER TABLE `status_updates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=119;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

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

--
-- Constraints for dumped tables
--

--
-- Constraints for table `package_customizations`
--
ALTER TABLE `package_customizations`
  ADD CONSTRAINT `fk_package_customizations_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
