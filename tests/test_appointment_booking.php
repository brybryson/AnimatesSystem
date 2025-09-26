<?php
require_once '../config/database.php';

try {
    $db = getDB();

    // Simulate the data from the user's booking attempt
    $testData = [
        'action' => 'book_appointment',
        'petName' => 'owley',
        'petType' => 'Dog',
        'petBreed' => 'Appenzeller',
        'petSize' => 'medium', // mapped from 'medium'
        'preferredDate' => '2025-09-27',
        'preferredTime' => '1:00 PM',
        'services' => [
            'Teeth Cleaning',
            'De-shedding Treatment',
            'Scented Cologne',
            'Bath & Dry',
            'Ear Cleaning & Inspection'
        ],
        'packageCustomizations' => [],
        'specialInstructions' => '',
        'totalAmount' => 1717.50
    ];

    // We need to simulate authentication. Let's get a test user
    $stmt = $db->prepare("SELECT id, full_name, phone, email FROM users WHERE role = 'customer' LIMIT 1");
    $stmt->execute();
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        throw new Exception('No test customer user found');
    }

    echo "Testing appointment booking with user: " . $user['full_name'] . "\n";
    echo "Services: " . implode(', ', $testData['services']) . "\n\n";

    // First, check if services exist
    $serviceNames = $testData['services'];
    $placeholders = str_repeat('?,', count($serviceNames) - 1) . '?';

    $stmt = $db->prepare("SELECT id, name, base_price as price FROM services2 WHERE name IN ($placeholders) AND status = 'active'");
    $stmt->execute($serviceNames);
    $services = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($services) . " services out of " . count($serviceNames) . " requested:\n";
    foreach ($services as $service) {
        echo "  - {$service['name']} (ID: {$service['id']}, Price: ₱{$service['price']})\n";
    }

    if (count($services) !== count($serviceNames)) {
        $foundNames = array_column($services, 'name');
        $missing = array_diff($serviceNames, $foundNames);
        echo "\nMissing services: " . implode(', ', $missing) . "\n";
    } else {
        echo "\n✓ All services found!\n";
    }

    // Now test the booking logic (without actually creating the booking)
    $totalAmount = array_sum(array_column($services, 'price'));
    echo "\nCalculated total: ₱" . number_format($totalAmount, 2) . "\n";
    echo "Expected total: ₱" . number_format($testData['totalAmount'], 2) . "\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>