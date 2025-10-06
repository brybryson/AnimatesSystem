<?php
require_once 'config/database.php';
require_once 'config/firebase.php';

echo "Testing Firebase Integration\n";
echo "============================\n\n";

// Test Firebase connection
echo "1. Testing Firebase connection...\n";
$firebaseTest = testFirebaseConnection();
if ($firebaseTest['success']) {
    echo "✅ Firebase connection successful\n\n";
} else {
    echo "❌ Firebase connection failed: " . $firebaseTest['error'] . "\n\n";
    exit(1);
}

// Test getting latest RFID from Firebase
echo "2. Testing RFID data retrieval from Firebase...\n";
$rfidData = getLatestRFIDFromFirebase();
if ($rfidData['success']) {
    echo "✅ Successfully retrieved RFID data from Firebase\n";
    if ($rfidData['rfid']) {
        echo "   RFID: {$rfidData['rfid']}\n";
        echo "   Tap Count: {$rfidData['tap_count']}\n";
        echo "   Timestamp: {$rfidData['timestamp']}\n";
        echo "   Card UID: {$rfidData['card_uid']}\n";
    } else {
        echo "   No RFID data found (this is normal if no ESP32 has sent data)\n";
    }
    echo "\n";
} else {
    echo "❌ Failed to retrieve RFID data: " . $rfidData['error'] . "\n\n";
}

// Test RFID tap history
echo "3. Testing RFID tap history retrieval...\n";
$historyData = getRFIDTapHistoryFromFirebase(5);
if ($historyData['success']) {
    echo "✅ Successfully retrieved RFID history\n";
    if (count($historyData['history']) > 0) {
        echo "   Found " . count($historyData['history']) . " recent taps:\n";
        foreach ($historyData['history'] as $tap) {
            echo "   - RFID: {$tap['custom_uid']}, Tap: {$tap['tap_count']}, Time: {$tap['timestamp']}\n";
        }
    } else {
        echo "   No tap history found (this is normal if no ESP32 has sent data)\n";
    }
    echo "\n";
} else {
    echo "❌ Failed to retrieve RFID history: " . $historyData['error'] . "\n\n";
}

// Test cleanup function
echo "4. Testing RFID cleanup function...\n";
$cleanupResult = clearOldRFIDTapsFromFirebase(1); // Clear taps older than 1 hour
if ($cleanupResult['success']) {
    echo "✅ Cleanup completed successfully\n";
    echo "   Deleted {$cleanupResult['deleted_count']} old RFID taps\n\n";
} else {
    echo "❌ Cleanup failed: " . $cleanupResult['error'] . "\n\n";
}

echo "Firebase Integration Test Complete!\n";
echo "===================================\n\n";

echo "Next Steps:\n";
echo "1. Update your ESP32 Arduino code to send data to Firebase instead of the API endpoint\n";
echo "2. Use the Firebase configuration provided:\n";
echo "   - Project ID: animatesrfid\n";
echo "   - Database URL: https://animatesrfid-default-rtdb.firebaseio.com/\n";
echo "3. Send RFID data to Firebase path: /rfid_taps/\n";
echo "4. The system will automatically read from Firebase\n\n";

echo "ESP32 Firebase Integration Code Structure:\n";
echo "-----------------------------------------\n";
echo "#include <WiFi.h>\n";
echo "#include <FirebaseESP32.h>\n";
echo "\n";
echo "// Firebase configuration\n";
echo "FirebaseData fbdo;\n";
echo "FirebaseAuth auth;\n";
echo "FirebaseConfig config;\n";
echo "\n";
echo "// Set Firebase project credentials\n";
echo "config.api_key = \"AIzaSyBCqI4oN_ikpKRxeRSaCaopCnCCmBImZqA\";\n";
echo "config.database_url = \"https://animatesrfid-default-rtdb.firebaseio.com/\";\n";
echo "\n";
echo "// Send RFID data to Firebase\n";
echo "String path = \"/rfid_taps/\" + String(millis());\n";
echo "String jsonData = \"{\\\"rfid\\\":\\\"\" + rfidTag + \"\\\",\\\"tap_count\\\":\" + String(tapCount) + \",\\\"timestamp\\\":\" + String(millis()) + \"}\";\n";
echo "Firebase.setJSON(fbdo, path, jsonData);\n";
echo "\n";
?>