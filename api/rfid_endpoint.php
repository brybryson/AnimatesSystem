<?php
require_once '../config/database.php';
require_once '../config/firebase.php';
require_once '../includes/email_functions.php';

// Set headers for API
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle GET requests for RFID polling and assignment
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? '';

    switch ($action) {
        case 'get_latest_rfid':
            handleGetLatestRFID();
            break;
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid action']);
            break;
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Handle POST requests
try {
    $db = getDB();
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        throw new Exception('Invalid JSON data');
    }

    $action = $input['action'] ?? '';

    if ($action === 'assign_rfid') {
        handleAssignRFID($input);
    } else {
        // Default: Handle RFID tap (original functionality)
        handleRFIDTap($input);
    }

} catch(Exception $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollback();
    }
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

// JWT Helper functions for authentication
function getBearerToken() {
    $headers = getAuthorizationHeader();
    if (!empty($headers) && trim($headers) !== 'Bearer') {
        if (preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
            return $matches[1];
        }
    }
    return null;
}

function getAuthorizationHeader() {
    $headers = null;
    if (isset($_SERVER['Authorization'])) {
        $headers = trim($_SERVER["Authorization"]);
    } else if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
    } elseif (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
        if (isset($requestHeaders['Authorization'])) {
            $headers = trim($requestHeaders['Authorization']);
        }
    }
    return $headers;
}

function verifyJWT($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        throw new Exception('Invalid token format');
    }

    $header = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[0])));
    $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1])));
    $signature = str_replace(['-', '_'], ['+', '/'], $parts[2]);

    $expectedSignature = hash_hmac('sha256', $parts[0] . "." . $parts[1], getJWTSecret(), true);

    if (!hash_equals($expectedSignature, base64_decode($signature))) {
        throw new Exception('Invalid signature');
    }

    if ($payload->exp < time()) {
        throw new Exception('Token expired');
    }

    return $payload;
}

function getJWTSecret() {
    return '8paws_jwt_secret_key_2025';
}

function requireAuth() {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No token provided']);
        exit;
    }

    try {
        $decoded = verifyJWT($token);
        return $decoded;
    } catch(Exception $e) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid token']);
        exit;
    }
}

function handleGetLatestRFID() {
    try {
        // Get latest RFID tap from Firebase
        $firebaseResult = getLatestRFIDFromFirebase();

        if ($firebaseResult['success'] && $firebaseResult['rfid']) {
            $customUID = $firebaseResult['rfid'];
            $tapCount = $firebaseResult['tap_count'] ?? 1;

            // Check if this RFID has tap_count = 1 (fresh card for check_in.html)
            $db = getDB();
            $stmt = $db->prepare("SELECT tap_count FROM rfid_cards WHERE custom_uid = ?");
            $stmt->execute([$customUID]);
            $cardInfo = $stmt->fetch(PDO::FETCH_ASSOC);

            // Only accept RFID if tap_count is 1 (fresh card) or if no local record exists
            if (!$cardInfo || $cardInfo['tap_count'] == 1) {
                echo json_encode([
                    'success' => true,
                    'rfid' => $customUID,
                    'tap_count' => $tapCount,
                    'card_uid' => $firebaseResult['card_uid'] ?? null,
                    'timestamp' => $firebaseResult['timestamp'] ?? null
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'RFID card has already been used. Please use a fresh card with tap count = 1.'
                ]);
            }
        } else {
            echo json_encode([
                'success' => false,
                'message' => $firebaseResult['message'] ?? 'No recent RFID tap found in Firebase'
            ]);
        }
    } catch(Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleAssignRFID($input) {
    try {
        $decoded = requireAuth();

        $db = getDB();

        // Get user role
        $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !in_array($user['role'], ['admin', 'manager', 'staff', 'cashier', 'stock_controller'])) {
            throw new Exception('Access denied. Insufficient permissions.');
        }

        // Validate required fields
        if (!isset($input['appointment_id']) || !isset($input['rfid_number'])) {
            throw new Exception('Appointment ID and RFID number are required');
        }

        $appointmentId = intval($input['appointment_id']);
        $rfidNumber = strtoupper(trim($input['rfid_number']));

        // Check if appointment exists and is in valid status
        $stmt = $db->prepare("
            SELECT id, status
            FROM appointments
            WHERE id = ?
        ");
        $stmt->execute([$appointmentId]);
        $appointment = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$appointment) {
            throw new Exception('Appointment not found');
        }

        if (!in_array($appointment['status'], ['scheduled', 'confirmed'])) {
            throw new Exception('RFID can only be assigned to scheduled or confirmed appointments');
        }

        // Check if RFID is already assigned to another active appointment
        $stmt = $db->prepare("
            SELECT r.id, r.appointment_id
            FROM rfid_cards r
            INNER JOIN appointments a ON r.appointment_id = a.id
            WHERE r.custom_uid = ? 
            AND r.is_currently_booked = 1
            AND a.status NOT IN ('completed', 'cancelled')
            AND a.id != ?
        ");
        $stmt->execute([$rfidNumber, $appointmentId]);
        if ($stmt->fetch(PDO::FETCH_ASSOC)) {
            throw new Exception('This RFID tag is already assigned to another active appointment');
        }

        // Update appointment with custom_rfid
        $stmt = $db->prepare("
            UPDATE appointments
            SET custom_rfid = ?, updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$rfidNumber, $appointmentId]);

        // Create or update RFID card record with appointment_id - reset tap count to 1 for new assignment
        $stmt = $db->prepare("
            INSERT INTO rfid_cards (card_uid, custom_uid, tap_count, max_taps, status, is_currently_booked, appointment_id)
            VALUES (?, ?, 1, 3, 'active', 1, ?)
            ON DUPLICATE KEY UPDATE
            tap_count = 1, is_currently_booked = 1, appointment_id = ?, updated_at = NOW()
        ");
        $stmt->execute([$rfidNumber, $rfidNumber, $appointmentId, $appointmentId]);

        echo json_encode([
            'success' => true,
            'message' => 'RFID tag assigned successfully'
        ]);

    } catch(Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleRFIDTap($input) {
    // Normalize and validate input
    $normalized = [];
    $normalized['card_uid'] = isset($input['card_uid']) ? trim((string)$input['card_uid']) : '';
    $normalized['custom_uid'] = isset($input['custom_uid']) ? strtoupper(trim((string)$input['custom_uid'])) : '';
    
    // Accept either tap_count or tap_number
    $tapCountIncoming = null;
    if (isset($input['tap_count'])) {
        $tapCountIncoming = (int)$input['tap_count'];
    } elseif (isset($input['tap_number'])) {
        $tapCountIncoming = (int)$input['tap_number'];
    }
    if (!is_int($tapCountIncoming) || $tapCountIncoming <= 0) {
        $tapCountIncoming = 1;
    }
    if ($tapCountIncoming > 3) {
        $tapCountIncoming = 3;
    }
    $normalized['tap_count'] = $tapCountIncoming;
    $normalized['tap_number'] = $tapCountIncoming;
    $normalized['max_taps'] = isset($input['max_taps']) ? (int)$input['max_taps'] : 3;
    if ($normalized['max_taps'] <= 0) { $normalized['max_taps'] = 3; }
    $normalized['device_info'] = isset($input['device_info']) ? trim((string)$input['device_info']) : null;
    $normalized['wifi_network'] = $input['wifi_network'] ?? null;
    $normalized['signal_strength'] = isset($input['signal_strength']) ? (int)$input['signal_strength'] : null;
    $normalized['validation_status'] = isset($input['validation_status']) ? (string)$input['validation_status'] : 'approved';
    $normalized['readable_time'] = isset($input['readable_time']) ? (string)$input['readable_time'] : null;
    $normalized['timestamp_value'] = isset($input['timestamp_value']) ? (string)$input['timestamp_value'] : null;
    $normalized['rfid_scanner_status'] = isset($input['rfid_scanner_status']) ? (string)$input['rfid_scanner_status'] : null;

    // Basic required fields check
    if ($normalized['card_uid'] === '' || $normalized['custom_uid'] === '') {
        throw new Exception('Missing required fields: card_uid/custom_uid');
    }

    // Start transaction
    $db = getDB();
    $db->beginTransaction();

    // 1. Insert/Update RFID card record
    $cardId = handleRFIDCard($db, $normalized);

    // 2. Insert tap history
    insertTapHistory($db, $cardId, $normalized);

    // 3. Update booking status based on tap count
    $bookingResult = updateBookingStatus($db, $cardId, $normalized);

    // Commit transaction before sending email
    $db->commit();

    // 4. Send email notification based on appointment status
    $emailSent = false;
    if ($bookingResult['updated'] && $bookingResult['booking_id']) {
        try {
            error_log("RFID: Attempting to send email for appointment ID: " . $bookingResult['booking_id']);
            error_log("RFID: Is completion? " . ($bookingResult['is_completion'] ? 'YES' : 'NO'));

            if ($bookingResult['is_completion']) {
                error_log("RFID: TAP COUNT IS 3 - Calling sendAppointmentCompletionEmail for appointment ID: " . $bookingResult['booking_id']);
                $emailSent = sendAppointmentCompletionEmail($bookingResult['booking_id']);
                error_log("RFID: sendAppointmentCompletionEmail result: " . ($emailSent ? 'SUCCESS' : 'FAILED'));
            } else {
                error_log("RFID: TAP COUNT IS NOT 3 - Calling sendAppointmentStatusEmail for appointment ID: " . $bookingResult['booking_id']);
                $emailSent = sendAppointmentStatusEmail($bookingResult['booking_id']);
                error_log("RFID: sendAppointmentStatusEmail result: " . ($emailSent ? 'SUCCESS' : 'FAILED'));
            }
        } catch (Exception $emailError) {
            error_log("RFID: Email sending failed for appointment {$bookingResult['booking_id']}: " . $emailError->getMessage());
            error_log("RFID: Email error trace: " . $emailError->getTraceAsString());
        }
    }

    // Determine if this is the first tap for this appointment
    $isFirstTap = ($normalized['tap_count'] === 1);

    echo json_encode([
        'success' => true,
        'card_id' => $cardId,
        'custom_uid' => $normalized['custom_uid'],
        'cardUID' => $normalized['custom_uid'], // For check_in.js compatibility
        'tap_count' => $normalized['tap_count'],
        'tapCount' => $normalized['tap_count'], // For check_in.js compatibility
        'isFirstTap' => $isFirstTap, // For check_in.js compatibility
        'booking_updated' => $bookingResult['updated'],
        'booking_id' => $bookingResult['booking_id'],
        'status_changed_to' => $bookingResult['new_status'],
        'is_completion' => $bookingResult['is_completion'],
        'email_sent' => $emailSent,
        'message' => 'RFID data saved successfully' .
                    ($bookingResult['updated'] ? ' and booking status updated' : '') .
                    ($emailSent ? ' and email notification sent' : '') .
                    ($bookingResult['is_completion'] ? ' - Service completed!' : '')
    ]);
}

function handleRFIDCard($db, $input) {
    // Check if card exists
    $stmt = $db->prepare("SELECT id, tap_count FROM rfid_cards WHERE card_uid = ?");
    $stmt->execute([$input['card_uid']]);
    $existingCard = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existingCard) {
        // Update existing card
        $stmt = $db->prepare("
            UPDATE rfid_cards 
            SET custom_uid = ?, tap_count = ?, updated_at = NOW(), 
                last_firebase_sync = NOW(), device_source = ?
            WHERE card_uid = ?
        ");
        $stmt->execute([
            $input['custom_uid'],
            $input['tap_count'],
            $input['device_info'],
            $input['card_uid']
        ]);
        
        return $existingCard['id'];
    } else {
        // Insert new card
        $stmt = $db->prepare("
            INSERT INTO rfid_cards 
            (card_uid, custom_uid, tap_count, max_taps, device_source, status) 
            VALUES (?, ?, ?, ?, ?, 'active')
        ");
        $stmt->execute([
            $input['card_uid'],
            $input['custom_uid'],
            $input['tap_count'],
            $input['max_taps'],
            $input['device_info']
        ]);
        
        return $db->lastInsertId();
    }
}

function insertTapHistory($db, $cardId, $input) {
    $stmt = $db->prepare("
        INSERT INTO rfid_tap_history 
        (rfid_card_id, card_uid, custom_uid, tap_number, tapped_at, 
         device_info, wifi_network, signal_strength, validation_status, 
         readable_time, timestamp_value, rfid_scanner_status) 
        VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmt->execute([
        $cardId,
        $input['card_uid'],
        $input['custom_uid'],
        $input['tap_number'],
        $input['device_info'],
        $input['wifi_network'] ?? null,
        $input['signal_strength'] ?? null,
        $input['validation_status'],
        $input['readable_time'],
        $input['timestamp_value'],
        $input['rfid_scanner_status']
    ]);
}

function updateBookingStatus($db, $cardId, $input) {
    $tapCount = $input['tap_count'];
    $customUID = $input['custom_uid'];
    
    error_log("RFID: updateBookingStatus called with cardId=$cardId, customUID=$customUID, tapCount=$tapCount");
    
    // Status mapping for 3 taps - different for appointments vs bookings
    $statusMap = [
        1 => 'confirmed',      // Tap 1: Confirmed (checked-in for appointments)
        2 => 'in_progress',    // Tap 2: Services in progress
        3 => 'completed'       // Tap 3: Completed
    ];
    
    $result = [
        'updated' => false,
        'booking_id' => null,
        'new_status' => null,
        'is_completion' => false
    ];
    
    if (!isset($statusMap[$tapCount])) {
        error_log("RFID: Invalid tap count: $tapCount");
        return $result;
    }
    
    $newStatus = $statusMap[$tapCount];
    $result['is_completion'] = ($tapCount === 3);
    
    // Find appointment using rfid_cards.appointment_id
    $stmt = $db->prepare("
        SELECT a.id, a.status, a.custom_rfid
        FROM appointments a
        INNER JOIN rfid_cards r ON r.appointment_id = a.id
        WHERE r.custom_uid = ?
        AND a.status NOT IN ('completed', 'cancelled')
        ORDER BY a.created_at DESC
        LIMIT 1
    ");
    $stmt->execute([$customUID]);
    $appointment = $stmt->fetch(PDO::FETCH_ASSOC);

    error_log("RFID: Looking for appointment with custom_uid=$customUID, found: " . json_encode($appointment));

    if (!$appointment) {
        error_log("RFID: No active appointment found for custom_uid: $customUID");
        return $result;
    }

    // Check if status actually needs updating
    if ($appointment['status'] === $newStatus) {
        error_log("RFID: Status already $newStatus, no update needed");
        $result['updated'] = true;
        $result['booking_id'] = $appointment['id'];
        $result['new_status'] = $newStatus;
        return $result;
    }

    error_log("RFID: Updating appointment ID {$appointment['id']} from status '{$appointment['status']}' to '$newStatus'");

    // Update appointment status
    $stmt = $db->prepare("
        UPDATE appointments
        SET status = ?, updated_at = NOW()
        WHERE id = ?
    ");
    $stmt->execute([$newStatus, $appointment['id']]);

    // Add status update record
    $stmt = $db->prepare("
        INSERT INTO appointment_status_updates (appointment_id, status, notes, created_at)
        VALUES (?, ?, ?, NOW())
    ");

    $notes = "Status automatically updated via RFID tap #" . $tapCount;
    if ($tapCount === 1) {
        $notes = "Appointment confirmed via RFID tap #" . $tapCount;
    } elseif ($tapCount === 2) {
        $notes = "Services in progress via RFID tap #" . $tapCount;
    } elseif ($tapCount === 3) {
        $notes = "Service completed! Ready for pickup via RFID tap #" . $tapCount;
    }

    $stmt->execute([
        $appointment['id'],
        $newStatus,
        $notes
    ]);

    // If status is 'completed', update completion time and reset RFID card
    if ($newStatus === 'completed') {
        $stmt = $db->prepare("
            UPDATE appointments
            SET actual_completion = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$appointment['id']]);

        // Reset RFID card is_currently_booked flag
        $stmt = $db->prepare("
            UPDATE rfid_cards
            SET is_currently_booked = 0, appointment_id = NULL
            WHERE custom_uid = ?
        ");
        $stmt->execute([$customUID]);

        error_log("RFID: Reset is_currently_booked to 0 for RFID card: $customUID");
    }

    $result['updated'] = true;
    $result['booking_id'] = $appointment['id'];
    $result['new_status'] = $newStatus;

    error_log("RFID: Successfully updated appointment ID {$appointment['id']} to status '$newStatus'");
    
    return $result;
}

?>