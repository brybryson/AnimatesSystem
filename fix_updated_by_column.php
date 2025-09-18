<?php
/**
 * Fix Missing updated_by Column in Bookings Table
 * 
 * This script adds the missing updated_by column to your existing bookings table
 * to fix the device update error.
 */

require_once __DIR__ . '/config/database.php';

try {
    $db = getDB();
    
    echo "🔧 Adding missing 'updated_by' column to bookings table...\n\n";
    
    // Check if column already exists
    $stmt = $db->prepare("SHOW COLUMNS FROM bookings LIKE 'updated_by'");
    $stmt->execute();
    $columnExists = $stmt->fetch() !== false;
    
    if ($columnExists) {
        echo "✅ Column 'updated_by' already exists in bookings table.\n";
        echo "No action needed.\n";
    } else {
        // Add the updated_by column
        $sql = "ALTER TABLE `bookings` 
                ADD COLUMN `updated_by` int(11) DEFAULT NULL 
                COMMENT 'User ID who last updated the booking' 
                AFTER `staff_notes`";
        
        $db->exec($sql);
        echo "✅ Successfully added 'updated_by' column to bookings table.\n";
        
        // Verify the column was added
        $stmt = $db->prepare("SHOW COLUMNS FROM bookings LIKE 'updated_by'");
        $stmt->execute();
        $column = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($column) {
            echo "✅ Column verification successful:\n";
            echo "   - Column: {$column['Field']}\n";
            echo "   - Type: {$column['Type']}\n";
            echo "   - Null: {$column['Null']}\n";
            echo "   - Default: {$column['Default']}\n";
            echo "   - Comment: {$column['Comment']}\n";
        }
    }
    
    // Show current table structure
    echo "\n📋 Current bookings table structure:\n";
    $stmt = $db->prepare("DESCRIBE bookings");
    $stmt->execute();
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($columns as $column) {
        $default = $column['Default'] ?? 'NULL';
        echo "   - {$column['Field']} ({$column['Type']}) {$column['Null']} DEFAULT {$default}\n";
    }
    
    echo "\n🎯 Device should now be able to update bookings without errors!\n";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "\n🔧 Manual SQL command to run in phpMyAdmin:\n";
    echo "ALTER TABLE `bookings` ADD COLUMN `updated_by` int(11) DEFAULT NULL COMMENT 'User ID who last updated the booking' AFTER `staff_notes`;\n";
}
?>
