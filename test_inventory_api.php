<?php
// Test script for inventory API - checks syntax and basic structure
echo "<h2>Testing Inventory API Structure</h2>";

// Test 1: Check if file exists and is readable
if (file_exists('api/inventory.php')) {
    echo "<p>✅ API file exists</p>";

    // Test 2: Check syntax by including the file
    try {
        ob_start();
        include 'api/inventory.php';
        ob_end_clean();
        echo "<p>✅ API file syntax is valid</p>";
    } catch (Exception $e) {
        echo "<p>❌ API file has syntax errors: " . $e->getMessage() . "</p>";
    }

    // Test 3: Check if required functions exist
    $required_functions = [
        'handleGetInventory',
        'handleGetCategories',
        'handleAddInventory',
        'handleUpdateInventory',
        'handleDeleteInventory'
    ];

    foreach ($required_functions as $function) {
        if (function_exists($function)) {
            echo "<p>✅ Function $function exists</p>";
        } else {
            echo "<p>❌ Function $function is missing</p>";
        }
    }

} else {
    echo "<p>❌ API file does not exist</p>";
}

echo "<h3>Next Steps:</h3>";
echo "<ol>";
echo "<li>Start XAMPP MySQL service</li>";
echo "<li>Run the migration: <code>php run_inventory_migration.php</code></li>";
echo "<li>Test the inventory management page: <code>html/inventory_management.html</code></li>";
echo "</ol>";
?>