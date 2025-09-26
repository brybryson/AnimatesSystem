<?php
require_once 'config/database.php';

try {
    $db = getDB();
    
    // Check for the specific RFID tag
    $stmt = $db->prepare("SELECT id, custom_rfid, status, pet_id FROM bookings WHERE custom_rfid = ?");
    $stmt->execute(['TVTPIV8O']);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo "Booking found for TVTPIV8O: " . json_encode($result) . PHP_EOL;
    
    // Check all bookings
    $stmt = $db->query("SELECT id, custom_rfid, status FROM bookings ORDER BY id DESC LIMIT 10");
    echo "Recent bookings:" . PHP_EOL;
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo json_encode($row) . PHP_EOL;
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . PHP_EOL;
}
?>
