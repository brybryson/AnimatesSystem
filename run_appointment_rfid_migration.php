<?php
// Run appointment RFID migration
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'config/database.php';

echo "<h2>Running Appointment RFID Migration</h2>";

try {
    $db = getDB();

    // Read the migration file
    $migrationSQL = file_get_contents('migrations/2025_10_06_0001_make_appointments_user_id_nullable.sql');

    if (!$migrationSQL) {
        throw new Exception('Could not read migration file');
    }

    // Split into individual statements and filter out comments and empty lines
    $statements = array_filter(array_map('trim', explode(';', $migrationSQL)), function($stmt) {
        $stmt = trim($stmt);
        return !empty($stmt) && !preg_match('/^--/', $stmt);
    });

    foreach ($statements as $statement) {
        if (!empty($statement)) {
            echo "<p>Executing: " . substr($statement, 0, 50) . "...</p>";
            try {
                $db->exec($statement);
                echo "<p style='color: green;'>✅ Executed successfully</p>";
            } catch (Exception $e) {
                // Check if it's just a "column already exists" error, which is okay
                if (strpos($e->getMessage(), 'Duplicate column name') !== false ||
                    strpos($e->getMessage(), 'already exists') !== false) {
                    echo "<p style='color: orange;'>⚠️ Column/index already exists, skipping</p>";
                } else {
                    throw $e; // Re-throw if it's a real error
                }
            }
        }
    }

    echo "<p style='color: green; font-weight: bold;'>✅ Appointment RFID migration completed successfully!</p>";

    // Verify columns were added
    $stmt = $db->prepare("DESCRIBE appointments");
    $stmt->execute();
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $hasCustomRfid = false;
    $hasActualCompletion = false;
    $hasCheckInTime = false;

    foreach ($columns as $column) {
        if ($column['Field'] === 'custom_rfid') $hasCustomRfid = true;
        if ($column['Field'] === 'actual_completion') $hasActualCompletion = true;
        if ($column['Field'] === 'check_in_time') $hasCheckInTime = true;
    }

    if ($hasCustomRfid) {
        echo "<p>✅ custom_rfid column added successfully</p>";
    } else {
        echo "<p style='color: red;'>❌ custom_rfid column was not added</p>";
    }

    if ($hasActualCompletion) {
        echo "<p>✅ actual_completion column added successfully</p>";
    } else {
        echo "<p style='color: red;'>❌ actual_completion column was not added</p>";
    }

    if ($hasCheckInTime) {
        echo "<p>✅ check_in_time column added successfully</p>";
    } else {
        echo "<p style='color: red;'>❌ check_in_time column was not added</p>";
    }

    // Check if appointment_status_updates table was created
    $stmt = $db->prepare("SHOW TABLES LIKE 'appointment_status_updates'");
    $stmt->execute();
    $tableExists = $stmt->fetch();

    if ($tableExists) {
        echo "<p>✅ appointment_status_updates table created successfully</p>";
    } else {
        echo "<p style='color: red;'>❌ appointment_status_updates table was not created</p>";
    }

} catch (Exception $e) {
    echo "<p style='color: red; font-weight: bold;'>❌ Migration failed: " . $e->getMessage() . "</p>";
}
?>