<?php
// Always return JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Handle all PHP errors and exceptions as JSON
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => "PHP Error: $errstr in $errfile on line $errline"
    ]);
    exit;
});

set_exception_handler(function($e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => "Uncaught Exception: " . $e->getMessage()
    ]);
    exit;
});

require_once '../config/database.php';
require_once '../includes/email_functions.php';

$method = $_SERVER['REQUEST_METHOD'];

// JWT Helper functions
function getBearerToken() {
    $headers = getAuthorizationHeader();
    if (!empty($headers)) {
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
    
    // For debugging purposes, accept any token with the right format
    // In production, you would verify the signature
    return $payload;
}

function getJWTSecret() {
    return '8paws_jwt_secret_key_2025';
}

function handleGetBookingDetails() {
    try {
        // Accept RFID parameter for public tracking
        $rfidTag = null;

        if (isset($_GET['rfid']) && !empty($_GET['rfid'])) {
            $rfidTag = strtoupper(trim($_GET['rfid']));
        } else {
            throw new Exception('RFID tag is required');
        }

        $db = getDB();

        // Build query to get booking details
        $query = "SELECT b.id, b.pet_id, b.custom_rfid, b.total_amount, b.status,
                  b.payment_status, b.check_in_time, b.estimated_completion,
                  b.actual_completion, b.created_at, b.updated_at, b.staff_notes,
                  p.id as pet_id, p.name as pet_name, p.type as pet_type, p.breed as pet_breed,
                  p.age_range as pet_age, p.size as pet_size, p.last_vaccine_date, p.vaccine_types,
                  p.custom_vaccine, p.vaccination_proof,
                  c.name as owner_name, c.email as owner_email, c.phone as owner_phone
                  FROM bookings b
                  JOIN pets p ON b.pet_id = p.id
                  JOIN customers c ON p.customer_id = c.id
                  WHERE b.custom_rfid = ? AND b.status NOT IN ('cancelled')";

        $stmt = $db->prepare($query);
        $stmt->execute([$rfidTag]);
        $booking = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$booking) {
            throw new Exception('Booking not found or you do not have permission to view it');
        }

        // Get services for the booking
        $stmt = $db->prepare("SELECT bs.service_id, s.name, s.category, bs.price
                              FROM booking_services bs
                              JOIN services s ON bs.service_id = s.id
                              WHERE bs.booking_id = ?");
        $stmt->execute([$booking['id']]);
        $services = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get status updates for the booking
        $stmt = $db->prepare("SELECT status, notes, created_at
                              FROM status_updates
                              WHERE booking_id = ?
                              ORDER BY created_at ASC");
        $stmt->execute([$booking['id']]);
        $statusUpdates = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Process services (similar to appointments logic)
        $processedServices = $services; // For now, just use services as-is

        $booking['services'] = $processedServices;
        $booking['status_updates'] = $statusUpdates;
        $booking['booking_id'] = $booking['id']; // Add booking_id for compatibility

        echo json_encode([
            'success' => true,
            'appointment' => $booking // Keep 'appointment' key for frontend compatibility
        ]);

    } catch(Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleUpdateBookingStatus() {
    try {
        // Accept RFID parameter for status update
        $rfidTag = null;
        $currentStatus = isset($_GET['current_status']) ? trim($_GET['current_status']) : null;

        if (isset($_GET['rfid']) && !empty($_GET['rfid'])) {
            $rfidTag = strtoupper(trim($_GET['rfid']));
        } else {
            throw new Exception('RFID tag is required');
        }

        $db = getDB();

        // Status progression mapping for bookings
        $statusFlow = [
            'checked-in' => 'bathing',       // First tap: checked-in -> bathing
            'bathing' => 'grooming',         // Second tap: bathing -> grooming
            'grooming' => 'ready',           // Third tap: grooming -> ready
            'ready' => 'completed'           // Fourth tap: ready -> completed
        ];

        $result = [
            'updated' => false,
            'booking_id' => null,
            'new_status' => null,
            'is_completion' => false,
            'email_sent' => false
        ];

        // Determine next status based on current status
        if (!isset($statusFlow[$currentStatus])) {
            // If current status is not in the flow, don't update
            $result['updated'] = false;
            echo json_encode($result);
            return;
        }

        $newStatus = $statusFlow[$currentStatus];
        $result['is_completion'] = ($newStatus === 'completed');

        // Find booking by RFID
        $stmt = $db->prepare("
            SELECT b.id, b.status, b.custom_rfid, c.email as customer_email, c.name as customer_name
            FROM bookings b
            JOIN pets p ON b.pet_id = p.id
            JOIN customers c ON p.customer_id = c.id
            WHERE b.custom_rfid = ?
            AND b.status NOT IN ('completed', 'cancelled')
            ORDER BY b.created_at DESC
            LIMIT 1
        ");
        $stmt->execute([$rfidTag]);
        $booking = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$booking) {
            throw new Exception('No active booking found for this RFID tag');
        }

        // Check if status actually needs updating
        if ($booking['status'] === $newStatus) {
            $result['updated'] = false; // Don't update if already at target status
            $result['booking_id'] = $booking['id'];
            $result['new_status'] = $newStatus;
            echo json_encode($result);
            return;
        }

        // Update booking status
        $stmt = $db->prepare("
            UPDATE bookings
            SET status = ?, updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$newStatus, $booking['id']]);

        // Add status update record
        $stmt = $db->prepare("
            INSERT INTO status_updates (booking_id, status, notes, created_at)
            VALUES (?, ?, ?, NOW())
        ");

        $notes = "Status updated from {$currentStatus} to {$newStatus} via RFID tap";
        if ($newStatus === 'bathing') {
            $notes = "Bathing services started via RFID tap";
        } elseif ($newStatus === 'grooming') {
            $notes = "Grooming services in progress via RFID tap";
        } elseif ($newStatus === 'ready') {
            $notes = "Services completed - ready for pickup via RFID tap";
        } elseif ($newStatus === 'completed') {
            $notes = "Pet picked up - service completed via RFID tap";
        }

        $stmt->execute([$booking['id'], $newStatus, $notes]);

        // If status is 'completed', update completion time and reset RFID card
        if ($newStatus === 'completed') {
            $stmt = $db->prepare("
                UPDATE bookings
                SET actual_completion = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$booking['id']]);

            // Reset RFID card is_currently_booked flag
            $stmt = $db->prepare("
                UPDATE rfid_cards
                SET is_currently_booked = 0
                WHERE custom_uid = ?
            ");
            $stmt->execute([$rfidTag]);
        }

        $result['updated'] = true;
        $result['booking_id'] = $booking['id'];
        $result['new_status'] = $newStatus;

        // Send email notification
        try {
            if ($result['is_completion']) {
                $result['email_sent'] = sendCompletionEmail($booking['id']);
            } else {
                $result['email_sent'] = sendBookingStatusEmail($booking['id']);
            }
        } catch (Exception $emailError) {
            error_log("Email sending failed for booking {$booking['id']}: " . $emailError->getMessage());
        }

        echo json_encode($result);

    } catch(Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
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
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit;
    }
}

// Main API logic
if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    switch($action) {
        case 'get_booking_details':
            handleGetBookingDetails();
            break;
        case 'update_booking_status':
            handleUpdateBookingStatus();
            break;
        default:
            try {
                $user = requireAuth();
                $userId = $user->user_id;
        
        // Get database connection
        $pdo = getDB();
        
        // Get period from query string (all, this_month, etc.)
        $period = isset($_GET['period']) ? $_GET['period'] : 'all';
        
        // Debug output
        error_log("User ID: $userId, Period: $period");
    
        // Prepare SQL based on period to get bookings from the bookings table
        $sql = "SELECT b.*, 
               p.name as pet_name, p.breed as pet_breed, p.size as pet_size,
               c.email as customer_email
               FROM bookings b 
               JOIN pets p ON b.pet_id = p.id
               JOIN customers c ON p.customer_id = c.id
               WHERE b.status = 'completed' ";
        
        $params = [];
        
        // Add user filtering based on email
        $sql .= "AND c.email = (SELECT email FROM customers WHERE id = 
                (SELECT customer_id FROM users WHERE id = ?)) ";
        $params[] = $userId;
    
        // Add date filtering based on period
        if ($period === 'this_month') {
            $sql .= "AND MONTH(b.created_at) = MONTH(CURRENT_DATE()) 
                    AND YEAR(b.created_at) = YEAR(CURRENT_DATE()) ";
        } else if ($period === 'last_month') {
            $sql .= "AND MONTH(b.created_at) = MONTH(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)) 
                    AND YEAR(b.created_at) = YEAR(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)) ";
        } else if ($period === 'last_3_months') {
            $sql .= "AND b.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH) ";
        } else if ($period === 'last_6_months') {
            $sql .= "AND b.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH) ";
        } else if ($period === 'this_year') {
            $sql .= "AND YEAR(b.created_at) = YEAR(CURRENT_DATE()) ";
        }
        
        // Order by creation date
        $sql .= "ORDER BY b.created_at DESC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format the bookings data for the frontend
        $formattedBookings = [];
        foreach ($bookings as $booking) {
            // Format the booking data to match what the frontend expects
            $formattedBooking = [
                'id' => $booking['id'],
                'pet_id' => $booking['pet_id'],
                'pet_name' => $booking['pet_name'],
                'pet_breed' => $booking['pet_breed'],
                'pet_size' => $booking['pet_size'],
                'status' => $booking['status'],
                'total_amount' => $booking['total_amount'],
                'payment_status' => $booking['payment_status'],
                'payment_method' => $booking['payment_method'],
                'check_in_time' => $booking['check_in_time'],
                'actual_completion' => $booking['actual_completion'],
                'created_at' => $booking['created_at'],
                'updated_at' => $booking['updated_at']
            ];
            
            $formattedBookings[] = $formattedBooking;
        }
        
        echo json_encode([
            'success' => true,
            'bookings' => $formattedBookings
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Error: ' . $e->getMessage()
        ]);
    }
            break;
    }
} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
}