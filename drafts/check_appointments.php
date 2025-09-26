<?php
require_once 'config/database.php';

try {
    $db = getDB();

    // Check total appointments
    $stmt = $db->query('SELECT COUNT(*) as count FROM appointments');
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo 'Total appointments: ' . $result['count'] . PHP_EOL;

    if ($result['count'] > 0) {
        // Get sample appointments
        $stmt = $db->query('SELECT a.id, a.user_id, a.pet_id, a.appointment_date, a.status, u.email FROM appointments a LEFT JOIN users u ON a.user_id = u.id LIMIT 5');
        $appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo 'Sample appointments:' . PHP_EOL;
        foreach ($appointments as $apt) {
            echo 'ID: ' . $apt['id'] . ', User ID: ' . $apt['user_id'] . ', Email: ' . ($apt['email'] ?: 'NULL') . ', Date: ' . $apt['appointment_date'] . ', Status: ' . $apt['status'] . PHP_EOL;
        }
    }

    // Check if there are any users
    $stmt = $db->query('SELECT COUNT(*) as count FROM users');
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo 'Total users: ' . $result['count'] . PHP_EOL;

} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage() . PHP_EOL;
}