<?php
require_once 'config/database.php';

try {
    $db = getDB();

    // Check services2 table
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM services2 WHERE status = 'active'");
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    echo "Total active services in services2: " . $result['count'] . "\n";

    if ($result['count'] > 0) {
        // Get sample services
        $stmt = $db->prepare("SELECT id, name, category, is_size_based FROM services2 WHERE status = 'active' LIMIT 5");
        $stmt->execute();
        $services = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo "\nSample services:\n";
        foreach ($services as $service) {
            echo "ID: {$service['id']}, Name: {$service['name']}, Category: {$service['category']}, Size-based: {$service['is_size_based']}\n";
        }
    }

    // Check service_pricing table
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM service_pricing");
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "\nTotal service pricing entries: " . $result['count'] . "\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>