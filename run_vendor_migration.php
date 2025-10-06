<?php
// Run vendor migration
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'config/database.php';

echo "<h2>Running Vendor Migration</h2>";

try {
    $db = getDB();

    // Read the migration file
    $migrationSQL = file_get_contents('migrations/2025_10_04_0002_create_vendors_table.sql');

    if (!$migrationSQL) {
        throw new Exception('Could not read migration file');
    }

    // Split into individual statements
    $statements = array_filter(array_map('trim', explode(';', $migrationSQL)));

    foreach ($statements as $statement) {
        if (!empty($statement)) {
            echo "<p>Executing: " . substr($statement, 0, 50) . "...</p>";
            $db->exec($statement);
        }
    }

    echo "<p style='color: green; font-weight: bold;'>✅ Vendor migration completed successfully!</p>";

    // Verify table was created
    $stmt = $db->prepare("SHOW TABLES LIKE 'vendors'");
    $stmt->execute();
    $tableExists = $stmt->fetch();

    if ($tableExists) {
        echo "<p>✅ Vendors table created successfully</p>";

        // Check sample data
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM vendors");
        $stmt->execute();
        $count = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
        echo "<p>✅ Inserted {$count} sample vendors</p>";
    } else {
        echo "<p style='color: red;'>❌ Vendors table was not created</p>";
    }

} catch (Exception $e) {
    echo "<p style='color: red; font-weight: bold;'>❌ Migration failed: " . $e->getMessage() . "</p>";
}
?>