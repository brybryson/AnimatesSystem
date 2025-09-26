<?php
require_once 'config/database.php';

try {
    $db = getDB();

    // Start transaction for safety
    $db->beginTransaction();

    echo "Starting deletion of test transactions...\n";

    // Custom UIDs to delete
    $customUids = ['T5XPV6IR', '23S8BY3D', 'VZM5IJU7', 'BGJU7IJ6'];

    // Delete from package_customizations
    $stmt = $db->prepare("DELETE FROM package_customizations WHERE booking_id IN (SELECT id FROM bookings WHERE custom_rfid IN (?, ?, ?, ?))");
    $stmt->execute($customUids);
    echo "Deleted from package_customizations: " . $stmt->rowCount() . " records\n";

    // Delete from status_updates
    $stmt = $db->prepare("DELETE FROM status_updates WHERE booking_id IN (SELECT id FROM bookings WHERE custom_rfid IN (?, ?, ?, ?))");
    $stmt->execute($customUids);
    echo "Deleted from status_updates: " . $stmt->rowCount() . " records\n";

    // Delete from booking_services
    $stmt = $db->prepare("DELETE FROM booking_services WHERE booking_id IN (SELECT id FROM bookings WHERE custom_rfid IN (?, ?, ?, ?))");
    $stmt->execute($customUids);
    echo "Deleted from booking_services: " . $stmt->rowCount() . " records\n";

    // Delete from rfid_tap_history
    $stmt = $db->prepare("DELETE FROM rfid_tap_history WHERE card_uid IN (SELECT card_uid FROM rfid_cards WHERE custom_uid IN (?, ?, ?, ?))");
    $stmt->execute($customUids);
    echo "Deleted from rfid_tap_history: " . $stmt->rowCount() . " records\n";

    // Delete from bookings
    $stmt = $db->prepare("DELETE FROM bookings WHERE custom_rfid IN (?, ?, ?, ?)");
    $stmt->execute($customUids);
    echo "Deleted from bookings: " . $stmt->rowCount() . " records\n";

    // Delete from rfid_cards
    $stmt = $db->prepare("DELETE FROM rfid_cards WHERE custom_uid IN (?, ?, ?, ?)");
    $stmt->execute($customUids);
    echo "Deleted from rfid_cards: " . $stmt->rowCount() . " records\n";

    // Commit transaction
    $db->commit();

    echo "\n✅ All test transactions deleted successfully!\n";
    echo "Custom UIDs deleted: " . implode(', ', $customUids) . "\n";

} catch (Exception $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollback();
    }
    echo "❌ Error deleting test transactions: " . $e->getMessage() . "\n";
}
?>