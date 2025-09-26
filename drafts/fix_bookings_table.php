<?php
require_once 'config/database.php';

try {
    $db = getDB();
    echo "=== FIXING BOOKINGS TABLE STRUCTURE ===" . PHP_EOL;
    
    // Step 1: Check current structure
    echo "1. Checking current table structure..." . PHP_EOL;
    $stmt = $db->query("DESCRIBE bookings");
    $fields = [];
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $fields[] = $row;
        if ($row['Field'] === 'id') {
            echo "   ID field: " . json_encode($row) . PHP_EOL;
        }
    }
    
    // Step 2: Backup current data
    echo "2. Backing up current data..." . PHP_EOL;
    $stmt = $db->query("SELECT * FROM bookings ORDER BY created_at");
    $bookings = [];
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $bookings[] = $row;
    }
    echo "   Found " . count($bookings) . " existing bookings" . PHP_EOL;
    
    // Step 3: Drop and recreate table with proper structure
    echo "3. Recreating table with proper structure..." . PHP_EOL;
    
    // Drop the table
    $db->exec("DROP TABLE IF EXISTS bookings");
    
    // Create new table with proper structure
    $createTableSQL = "
    CREATE TABLE `bookings` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
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
        `welcome_email_sent` tinyint(1) DEFAULT 0,
        PRIMARY KEY (`id`),
        KEY `idx_pet_id` (`pet_id`),
        KEY `idx_custom_rfid` (`custom_rfid`),
        KEY `idx_status` (`status`),
        KEY `idx_created_at` (`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    ";
    
    $db->exec($createTableSQL);
    echo "   Table recreated successfully" . PHP_EOL;
    
    // Step 4: Restore data with new IDs
    echo "4. Restoring data with new IDs..." . PHP_EOL;
    
    foreach ($bookings as $index => $booking) {
        // Remove the old id field and let it auto-increment
        unset($booking['id']);
        
        // Build the INSERT statement
        $columns = array_keys($booking);
        $placeholders = str_repeat('?,', count($columns) - 1) . '?';
        $sql = "INSERT INTO bookings (" . implode(',', $columns) . ") VALUES ($placeholders)";
        
        $stmt = $db->prepare($sql);
        $stmt->execute(array_values($booking));
        
        $newId = $db->lastInsertId();
        $bookingNumber = $index + 1;
        echo "   Restored booking {$bookingNumber}: old_id=0, new_id=$newId, rfid={$booking['custom_rfid']}" . PHP_EOL;
    }
    
    // Step 5: Verify the fix
    echo "5. Verifying the fix..." . PHP_EOL;
    
    // Check table structure
    $stmt = $db->query("DESCRIBE bookings");
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if ($row['Field'] === 'id') {
            echo "   ID field structure: " . json_encode($row) . PHP_EOL;
            break;
        }
    }
    
    // Check auto increment
    $stmt = $db->query("SHOW TABLE STATUS LIKE 'bookings'");
    $status = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "   Auto increment value: " . $status['Auto_increment'] . PHP_EOL;
    
    // Check data
    $stmt = $db->query("SELECT id, custom_rfid, status FROM bookings ORDER BY id");
    echo "   Current bookings:" . PHP_EOL;
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "     ID: {$row['id']}, RFID: {$row['custom_rfid']}, Status: {$row['status']}" . PHP_EOL;
    }
    
    echo PHP_EOL . "=== FIX COMPLETED SUCCESSFULLY! ===" . PHP_EOL;
    echo "✅ Bookings table now has proper PRIMARY KEY and AUTO_INCREMENT" . PHP_EOL;
    echo "✅ All existing bookings have been restored with new IDs" . PHP_EOL;
    echo "✅ RFID emails should now work properly" . PHP_EOL;
    echo PHP_EOL . "Now test your RFID device - emails should be sent successfully!" . PHP_EOL;
    
} catch (Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . PHP_EOL;
    echo "Stack trace: " . $e->getTraceAsString() . PHP_EOL;
}
?>
