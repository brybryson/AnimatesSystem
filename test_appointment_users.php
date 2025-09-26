<?php
require_once 'config/database.php';

try {
    $db = getDB();

    // Check which users have appointments
    $stmt = $db->prepare("SELECT a.id, a.user_id, a.pet_id, a.status, u.email, u.role FROM appointments a JOIN users u ON a.user_id = u.id LIMIT 10");
    $stmt->execute();
    $appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Appointments and their users:\n";
    foreach ($appointments as $apt) {
        echo "Appointment ID: {$apt['id']}, User ID: {$apt['user_id']}, Email: {$apt['email']}, Role: {$apt['role']}, Status: {$apt['status']}\n";
    }

    // Check customer users
    $stmt = $db->prepare("SELECT id, email, role FROM users WHERE role = 'customer' LIMIT 5");
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "\nCustomer users:\n";
    foreach ($customers as $customer) {
        echo "ID: {$customer['id']}, Email: {$customer['email']}, Role: {$customer['role']}\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>