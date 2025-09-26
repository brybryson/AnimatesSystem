<?php
require_once 'config/database.php';

try {
    $db = getDB();

    // Check appointment_services table
    $stmt = $db->prepare("SELECT appointment_id, service_id, price FROM appointment_services LIMIT 10");
    $stmt->execute();
    $services = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Appointment services:\n";
    foreach ($services as $service) {
        echo "Appointment ID: {$service['appointment_id']}, Service ID: {$service['service_id']}, Price: {$service['price']}\n";
    }

    // Check if services2 table has these service IDs
    if (!empty($services)) {
        $serviceIds = array_column($services, 'service_id');
        $placeholders = str_repeat('?,', count($serviceIds) - 1) . '?';

        $stmt = $db->prepare("SELECT id, name FROM services2 WHERE id IN ($placeholders)");
        $stmt->execute($serviceIds);
        $foundServices = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo "\nFound services in services2:\n";
        foreach ($foundServices as $service) {
            echo "ID: {$service['id']}, Name: {$service['name']}\n";
        }

        $missing = array_diff($serviceIds, array_column($foundServices, 'id'));
        if (!empty($missing)) {
            echo "\nMissing service IDs: " . implode(', ', $missing) . "\n";
        }
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>