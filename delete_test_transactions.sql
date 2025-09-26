-- Delete test transactions with specified custom_uid values
-- Custom UIDs to delete: T5XPV6IR, 23S8BY3D, VZM5IJU7, BGJU7IJ6

-- First, get the booking IDs for these custom_rfids
SET @booking_ids = (
    SELECT GROUP_CONCAT(id) FROM bookings
    WHERE custom_rfid IN ('T5XPV6IR', '23S8BY3D', 'VZM5IJU7', 'BGJU7IJ6')
);

-- Delete from package_customizations
DELETE FROM package_customizations
WHERE booking_id IN (
    SELECT id FROM bookings
    WHERE custom_rfid IN ('T5XPV6IR', '23S8BY3D', 'VZM5IJU7', 'BGJU7IJ6')
);

-- Delete from status_updates
DELETE FROM status_updates
WHERE booking_id IN (
    SELECT id FROM bookings
    WHERE custom_rfid IN ('T5XPV6IR', '23S8BY3D', 'VZM5IJU7', 'BGJU7IJ6')
);

-- Delete from booking_services
DELETE FROM booking_services
WHERE booking_id IN (
    SELECT id FROM bookings
    WHERE custom_rfid IN ('T5XPV6IR', '23S8BY3D', 'VZM5IJU7', 'BGJU7IJ6')
);

-- Delete from rfid_tap_history
DELETE FROM rfid_tap_history
WHERE card_uid IN (
    SELECT card_uid FROM rfid_cards
    WHERE custom_uid IN ('T5XPV6IR', '23S8BY3D', 'VZM5IJU7', 'BGJU7IJ6')
);

-- Delete from bookings
DELETE FROM bookings
WHERE custom_rfid IN ('T5XPV6IR', '23S8BY3D', 'VZM5IJU7', 'BGJU7IJ6');

-- Delete from rfid_cards
DELETE FROM rfid_cards
WHERE custom_uid IN ('T5XPV6IR', '23S8BY3D', 'VZM5IJU7', 'BGJU7IJ6');

-- Reset auto-increment if needed (optional)
-- ALTER TABLE bookings AUTO_INCREMENT = 1;
-- ALTER TABLE rfid_cards AUTO_INCREMENT = 1;

SELECT 'Test transactions deleted successfully' as result;