<?php
/**
 * Verify Bookings Table Structure
 * 
 * This script checks the current structure of the bookings table
 * to confirm all required columns exist.
 */

require_once __DIR__ . '/config/database.php';

try {
    $db = getDB();
    
    echo "🔍 Checking bookings table structure...\n\n";
    
    // Get table structure
    $stmt = $db->prepare("DESCRIBE bookings");
    $stmt->execute();
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "📋 Current bookings table structure:\n";
    echo str_repeat("-", 80) . "\n";
    
    $hasUpdatedBy = false;
    $hasDiscountAmount = false;
    
    foreach ($columns as $column) {
        $default = $column['Default'] ?? 'NULL';
        $null = $column['Null'] === 'YES' ? 'NULL' : 'NOT NULL';
        $comment = $column['Comment'] ? " COMMENT '{$column['Comment']}'" : '';
        
        echo sprintf("  %-20s %-20s %-10s DEFAULT %-15s%s\n", 
            $column['Field'], 
            $column['Type'], 
            $null,
            $default,
            $comment
        );
        
        // Check for specific columns
        if ($column['Field'] === 'updated_by') {
            $hasUpdatedBy = true;
        }
        if ($column['Field'] === 'discount_amount') {
            $hasDiscountAmount = true;
        }
    }
    
    echo str_repeat("-", 80) . "\n";
    
    // Summary
    echo "\n📊 Column Status Summary:\n";
    echo "  ✅ updated_by column: " . ($hasUpdatedBy ? "EXISTS" : "MISSING") . "\n";
    echo "  ✅ discount_amount column: " . ($hasDiscountAmount ? "EXISTS" : "MISSING") . "\n";
    
    if ($hasUpdatedBy) {
        echo "\n🎯 The 'updated_by' column exists! Your device should work without errors.\n";
        echo "   If you're still getting 'Column not found' errors, the issue might be:\n";
        echo "   1. Wrong database connection\n";
        echo "   2. Wrong table name\n";
        echo "   3. Case sensitivity issues\n";
    } else {
        echo "\n❌ The 'updated_by' column is missing. You need to add it.\n";
    }
    
    // Check for any potential issues
    echo "\n🔍 Additional Checks:\n";
    
    // Check table name case
    $stmt = $db->prepare("SHOW TABLES LIKE 'bookings'");
    $stmt->execute();
    $tableExists = $stmt->fetch() !== false;
    echo "  ✅ Table 'bookings' exists: " . ($tableExists ? "YES" : "NO") . "\n";
    
    // Check database name
    $dbName = $db->query("SELECT DATABASE()")->fetchColumn();
    echo "  ✅ Current database: " . $dbName . "\n";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
?>
