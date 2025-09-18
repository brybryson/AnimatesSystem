<?php
require_once 'config/database.php';

try {
    $db = getDB();
    
    // Check table structure
    echo "=== BOOKINGS TABLE STRUCTURE ===" . PHP_EOL;
    $stmt = $db->query("DESCRIBE bookings");
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo json_encode($row) . PHP_EOL;
    }
    
    // Check auto increment
    echo PHP_EOL . "=== AUTO INCREMENT STATUS ===" . PHP_EOL;
    $stmt = $db->query("SHOW TABLE STATUS LIKE 'bookings'");
    $status = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Auto increment: " . $status['Auto_increment'] . PHP_EOL;
    echo "Next ID will be: " . $status['Auto_increment'] . PHP_EOL;
    
    // Check current data
    echo PHP_EOL . "=== CURRENT BOOKINGS DATA ===" . PHP_EOL;
    $stmt = $db->query("SELECT * FROM bookings ORDER BY id");
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo json_encode($row) . PHP_EOL;
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . PHP_EOL;
}
?>
