<?php
require_once __DIR__ . '/../vendor/autoload.php';

use Kreait\Firebase\Factory;
use Kreait\Firebase\ServiceAccount;

/**
 * Firebase Configuration and Helper Functions
 */

// Firebase configuration
$firebaseConfig = [
    'apiKey' => 'AIzaSyBCqI4oN_ikpKRxeRSaCaopCnCCmBImZqA',
    'authDomain' => 'animatesrfid.firebaseapp.com',
    'projectId' => 'animatesrfid',
    'storageBucket' => 'animatesrfid.firebasestorage.app',
    'messagingSenderId' => '1087214091541',
    'appId' => '1:1087214091541:web:00d41f7b01b1fdb40b3d1c',
    'measurementId' => 'G-6F0QRQQBTW'
];

/**
 * Get Firebase Database instance
 */
function getFirebaseDB() {
    static $database = null;

    if ($database === null) {
        try {
            $factory = (new Factory)
                ->withServiceAccount(__DIR__ . '/../config/firebase-service-account.json')
                ->withDatabaseUri('https://animatesrfid-default-rtdb.firebaseio.com/');

            $database = $factory->createDatabase();
        } catch (Exception $e) {
            error_log('Firebase initialization error: ' . $e->getMessage());
            throw new Exception('Failed to initialize Firebase: ' . $e->getMessage());
        }
    }

    return $database;
}

/**
 * Get Firebase Firestore instance
 */
function getFirebaseFirestore() {
    static $firestore = null;

    if ($firestore === null) {
        try {
            $factory = (new Factory)
                ->withServiceAccount(__DIR__ . '/../config/firebase-service-account.json');

            $firestore = $factory->createFirestore();
        } catch (Exception $e) {
            error_log('Firebase Firestore initialization error: ' . $e->getMessage());
            throw new Exception('Failed to initialize Firebase Firestore: ' . $e->getMessage());
        }
    }

    return $firestore;
}

/**
 * Get latest RFID tap from Firebase
 */
function getLatestRFIDFromFirebase() {
    try {
        $database = getFirebaseDB();

        // Get the latest RFID tap from Firebase Realtime Database
        $reference = $database->getReference('rfid_taps');
        $snapshot = $reference->orderByChild('timestamp')->limitToLast(1)->getSnapshot();

        if ($snapshot->exists()) {
            $data = $snapshot->getValue();
            if (is_array($data) && count($data) > 0) {
                // Get the first (and only) item
                $latestTap = reset($data);
                $tapKey = key($data);

                return [
                    'success' => true,
                    'rfid' => $latestTap['rfid'] ?? null,
                    'tap_count' => $latestTap['tap_count'] ?? 1,
                    'timestamp' => $latestTap['timestamp'] ?? null,
                    'card_uid' => $latestTap['card_uid'] ?? null,
                    'custom_uid' => $latestTap['custom_uid'] ?? null,
                    'tap_key' => $tapKey
                ];
            }
        }

        return [
            'success' => false,
            'message' => 'No RFID data found in Firebase'
        ];

    } catch (Exception $e) {
        error_log('Firebase RFID retrieval error: ' . $e->getMessage());
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Get RFID tap history from Firebase
 */
function getRFIDTapHistoryFromFirebase($limit = 50) {
    try {
        $database = getFirebaseDB();

        $reference = $database->getReference('rfid_taps');
        $snapshot = $reference->orderByChild('timestamp')->limitToLast($limit)->getSnapshot();

        $history = [];
        if ($snapshot->exists()) {
            $data = $snapshot->getValue();
            foreach ($data as $key => $tap) {
                $history[] = array_merge($tap, ['firebase_key' => $key]);
            }
        }

        return [
            'success' => true,
            'history' => array_reverse($history) // Most recent first
        ];

    } catch (Exception $e) {
        error_log('Firebase RFID history retrieval error: ' . $e->getMessage());
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Clear old RFID taps from Firebase (cleanup function)
 */
function clearOldRFIDTapsFromFirebase($hoursOld = 24) {
    try {
        $database = getFirebaseDB();
        $cutoffTime = time() - ($hoursOld * 3600);

        $reference = $database->getReference('rfid_taps');
        $snapshot = $reference->orderByChild('timestamp')->endAt($cutoffTime)->getSnapshot();

        $deletedCount = 0;
        if ($snapshot->exists()) {
            $data = $snapshot->getValue();
            foreach ($data as $key => $tap) {
                $reference->getChild($key)->remove();
                $deletedCount++;
            }
        }

        return [
            'success' => true,
            'deleted_count' => $deletedCount
        ];

    } catch (Exception $e) {
        error_log('Firebase RFID cleanup error: ' . $e->getMessage());
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Test Firebase connection
 */
function testFirebaseConnection() {
    try {
        $database = getFirebaseDB();
        $reference = $database->getReference('test_connection');
        $reference->set(['timestamp' => time(), 'status' => 'connected']);
        $reference->remove(); // Clean up test data

        return [
            'success' => true,
            'message' => 'Firebase connection successful'
        ];

    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}