<?php
// Always return JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

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

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';
    
    switch($action) {
        case 'get_staff':
            handleGetStaff();
            break;
        case 'get_services':
            handleGetServices();
            break;
        case 'get_user_appointments':
            handleGetUserAppointments();
            break;
        case 'get_appointment_details':
            handleGetAppointmentDetails();
            break;
        case 'get_all_appointments':
            handleGetAllAppointments();
            break;
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid action']);
            break;
    }
} elseif ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
        exit;
    }
    
    $action = $input['action'] ?? '';
    
    switch($action) {
        case 'book_appointment':
            handleBookAppointment($input);
            break;
        case 'cancel_appointment':
            handleCancelAppointment($input);
            break;
        case 'update_appointment':
            handleUpdateAppointment($input);
            break;
        case 'admit_appointment':
            handleAdmitAppointment($input);
            break;
        case 'auto_cancel_overdue':
            handleAutoCancelOverdueAppointments();
            break;
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid action']);
            break;
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}

function handleGetStaff() {
    requireAuth();
    
    try {
        $db = getDB();
        $stmt = $db->prepare("SELECT id, first_name, last_name FROM users WHERE role = 'staff' AND is_active = 1 ORDER BY first_name, last_name");
        $stmt->execute();
        $staff = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $staff
        ]);
    } catch(Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleGetServices() {
    requireAuth();
    
    try {
        $db = getDB();
        $stmt = $db->prepare("SELECT id, name, price, category, description FROM services WHERE is_active = 1 ORDER BY category, name");
        $stmt->execute();
        $services = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $services
        ]);
    } catch(Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleGetUserAppointments() {
    $decoded = requireAuth();

    try {
        $db = getDB();
        $status = isset($_GET['status']) && $_GET['status'] !== 'all' ? $_GET['status'] : null;

        $query = "SELECT a.id, a.appointment_date, a.appointment_time, a.estimated_duration,
                  a.total_amount, a.status, a.special_instructions, a.package_customizations,
                  a.cancelled_by, a.cancelled_by_name, a.cancellation_remarks,
                  p.name as pet_name, p.type as pet_type, p.breed as pet_breed, p.size as pet_size,
                  p.last_vaccine_date, p.vaccine_types, p.custom_vaccine, p.vaccination_proof
                  FROM appointments a
                  JOIN pets p ON a.pet_id = p.id
                  WHERE a.user_id = ?";

        $params = [$decoded->user_id];

        if ($status) {
            $query .= " AND a.status = ?";
            $params[] = $status;
        }

        $query .= " ORDER BY a.id DESC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get services for each appointment
        foreach ($appointments as &$appointment) {
            $stmt = $db->prepare("SELECT s.name, s.category, aps.price
                                FROM appointment_services aps
                                JOIN services2 s ON aps.service_id = s.id
                                WHERE aps.appointment_id = ?");
            $stmt->execute([$appointment['id']]);
            $appointment['services'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        echo json_encode([
            'success' => true,
            'appointments' => $appointments
        ]);
    } catch(Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleBookAppointment($input) {
    $decoded = requireAuth();
    
    try {
        $db = getDB();
        
        // Validate required fields
        $required = ['petName', 'petType', 'petBreed', 'preferredDate', 'preferredTime', 'services'];
        foreach ($required as $field) {
            if (!isset($input[$field]) || empty($input[$field])) {
                throw new Exception(ucfirst($field) . ' is required');
            }
        }
        
        // Validate services array
        if (!is_array($input['services']) || empty($input['services'])) {
            throw new Exception('At least one service must be selected');
        }
        
        // Validate date is not in the past
        $appointmentDate = $input['preferredDate'];
        if (strtotime($appointmentDate) < strtotime(date('Y-m-d'))) {
            throw new Exception('Appointment date cannot be in the past');
        }
        
        $db->beginTransaction();
        
        // Get or create customer record
        $stmt = $db->prepare("SELECT id FROM customers WHERE user_id = ?");
        $stmt->execute([$decoded->user_id]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$customer) {
            // Get user info to create customer record
            $stmt = $db->prepare("SELECT full_name, phone, email FROM users WHERE id = ?");
            $stmt->execute([$decoded->user_id]);
            $userInfo = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$userInfo) {
                throw new Exception('User not found');
            }
            
            // Create customer record
            $stmt = $db->prepare("
                INSERT INTO customers (name, phone, email, user_id, created_via)
                VALUES (?, ?, ?, ?, 'online')
            ");
            $stmt->execute([
                $userInfo['full_name'],
                $userInfo['phone'],
                $userInfo['email'],
                $decoded->user_id
            ]);
            
            $customerId = $db->lastInsertId();
        } else {
            $customerId = $customer['id'];
        }
        
        // Create or get pet record
        $stmt = $db->prepare("
            SELECT id FROM pets 
            WHERE customer_id = ? AND name = ? AND type = ? AND breed = ?
        ");
        $stmt->execute([$customerId, $input['petName'], $input['petType'], $input['petBreed']]);
        $pet = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$pet) {
            // Create new pet record
            $stmt = $db->prepare("
                INSERT INTO pets (customer_id, name, type, pet_type, breed, age_range, size, special_notes, last_vaccine_date, vaccine_types, custom_vaccine, vaccination_proof)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $customerId,
                $input['petName'],
                $input['petType'],
                $input['petType'], // pet_type same as type
                $input['petBreed'],
                $input['petAge'] ?? null,
                $input['petSize'] ?? null,
                $input['specialInstructions'] ?? null,
                $input['lastVaccineDate'] ?? null,
                isset($input['vaccineType']) ? json_encode([$input['vaccineType']]) : null,
                $input['customVaccine'] ?? null,
                $input['vaccinationProofPath'] ?? null
            ]);

            $petId = $db->lastInsertId();
        } else {
            $petId = $pet['id'];

            // Update pet info if needed
            $stmt = $db->prepare("
                UPDATE pets
                SET age_range = ?, size = ?, special_notes = ?, last_vaccine_date = ?, vaccine_types = ?, custom_vaccine = ?, vaccination_proof = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $input['petAge'] ?? null,
                $input['petSize'] ?? null,
                $input['specialInstructions'] ?? null,
                $input['lastVaccineDate'] ?? null,
                isset($input['vaccineType']) ? json_encode([$input['vaccineType']]) : null,
                $input['customVaccine'] ?? null,
                $input['vaccinationProofPath'] ?? null,
                $petId
            ]);
        }
        
        // Process services with their prices (new format: array of {id, price})
        $services = [];
        $serviceIds = [];
        $totalAmount = 0;
        $totalDuration = 0;

        foreach ($input['services'] as $serviceData) {
            if (!isset($serviceData['id']) || !isset($serviceData['price'])) {
                throw new Exception('Invalid service data format');
            }

            // Get service details from database
            $stmt = $db->prepare("SELECT id, name, 30 as duration_minutes FROM services2 WHERE id = ? AND status = 'active'");
            $stmt->execute([$serviceData['id']]);
            $serviceInfo = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$serviceInfo) {
                throw new Exception('Service not found: ' . $serviceData['id']);
            }

            $services[] = [
                'id' => $serviceInfo['id'],
                'name' => $serviceInfo['name'],
                'price' => $serviceData['price'],
                'duration_minutes' => $serviceInfo['duration_minutes']
            ];

            $serviceIds[] = $serviceInfo['id'];
            $totalAmount += $serviceData['price'];
            $totalDuration += $serviceInfo['duration_minutes'];
        }
        
        // Create appointment
        $stmt = $db->prepare("
            INSERT INTO appointments (user_id, pet_id, appointment_date, appointment_time, estimated_duration, total_amount, special_instructions, status, package_customizations)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)
        ");
        $stmt->execute([
            $decoded->user_id,
            $petId,
            $appointmentDate,
            $input['preferredTime'],
            $totalDuration,
            $totalAmount,
            $input['specialInstructions'] ?? null,
            isset($input['packageCustomizations']) ? json_encode($input['packageCustomizations']) : null
        ]);

        $appointmentId = $db->lastInsertId();

        // Add appointment services
        $stmt = $db->prepare("INSERT INTO appointment_services (appointment_id, service_id, price) VALUES (?, ?, ?)");
        foreach ($services as $service) {
            $stmt->execute([$appointmentId, $service['id'], $service['price']]);
        }
        
        $db->commit();
        
        echo json_encode([
            'success' => true,
            'appointment_id' => $appointmentId,
            'message' => 'Appointment booked successfully!',
            'data' => [
                'appointment_id' => $appointmentId,
                'date' => $appointmentDate,
                'time' => $input['preferredTime'],
                'pet_name' => $input['petName'],
                'total_amount' => $totalAmount
            ]
        ]);
        
    } catch(Exception $e) {
        if (isset($db) && $db->inTransaction()) {
            $db->rollback();
        }
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
function handleCancelAppointment($input) {
    $decoded = requireAuth();

    try {
        if (!isset($input['appointment_id']) || empty($input['appointment_id'])) {
            throw new Exception('Appointment ID is required');
        }

        $appointmentId = intval($input['appointment_id']);
        $db = getDB();

        // Get user role from database
        $stmt = $db->prepare("SELECT role, full_name FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            throw new Exception('User not found or inactive');
        }

        // Split full_name into first and last name for compatibility
        $nameParts = explode(' ', $user['full_name'], 2);
        $user['first_name'] = $nameParts[0] ?? '';
        $user['last_name'] = $nameParts[1] ?? '';

        // Check if user is staff/admin (can cancel any appointment) or customer (can only cancel their own)
        $isStaff = in_array($user['role'], ['admin', 'manager', 'staff', 'cashier']);

        if ($isStaff) {
            // Staff can cancel any appointment
            $stmt = $db->prepare("SELECT id FROM appointments WHERE id = ?");
            $stmt->execute([$appointmentId]);
        } else {
            // Customers can only cancel their own appointments
            $stmt = $db->prepare("SELECT id FROM appointments WHERE id = ? AND user_id = ?");
            $stmt->execute([$appointmentId, $decoded->user_id]);
        }

        $appointment = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$appointment) {
            throw new Exception('Appointment not found or you do not have permission to cancel it');
        }

        // For staff cancellations, remarks are required
        if ($isStaff) {
            if (!isset($input['cancellation_remarks']) || empty(trim($input['cancellation_remarks']))) {
                throw new Exception('Cancellation remarks are required for staff cancellations');
            }
        }

        // Prepare cancellation data
        $cancelledBy = $decoded->user_id;
        $cancelledByName = trim($user['first_name'] . ' ' . $user['last_name']);
        $cancellationRemarks = isset($input['cancellation_remarks']) ? trim($input['cancellation_remarks']) : null;

        // Update appointment status to cancelled with tracking information
        $stmt = $db->prepare("
            UPDATE appointments
            SET status = 'cancelled',
                cancelled_by = ?,
                cancelled_by_name = ?,
                cancellation_remarks = ?
            WHERE id = ?
        ");
        $stmt->execute([$cancelledBy, $cancelledByName, $cancellationRemarks, $appointmentId]);

        echo json_encode([
            'success' => true,
            'message' => 'Appointment cancelled successfully'
        ]);

    } catch(Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleUpdateAppointment($input) {
    $decoded = requireAuth();
    
    try {
        if (!isset($input['appointment_id']) || empty($input['appointment_id'])) {
            throw new Exception('Appointment ID is required');
        }
        
        $appointmentId = intval($input['appointment_id']);
        $db = getDB();
        
        // Verify the appointment belongs to the user
        $stmt = $db->prepare("SELECT id, status FROM appointments WHERE id = ? AND user_id = ?");
        $stmt->execute([$appointmentId, $decoded->user_id]);
        $appointment = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$appointment) {
            throw new Exception('Appointment not found or you do not have permission to update it');
        }
        
        if ($appointment['status'] === 'cancelled' || $appointment['status'] === 'completed') {
            throw new Exception('Cannot update a cancelled or completed appointment');
        }
        
        // Update appointment details
        $updateFields = [];
        $params = [];
        
        if (isset($input['appointment_date']) && !empty($input['appointment_date'])) {
            $updateFields[] = "appointment_date = ?";
            $params[] = $input['appointment_date'];
        }
        
        if (isset($input['appointment_time']) && !empty($input['appointment_time'])) {
            $updateFields[] = "appointment_time = ?";
            $params[] = $input['appointment_time'];
        }
        
        if (isset($input['special_instructions'])) {
            $updateFields[] = "special_instructions = ?";
            $params[] = $input['special_instructions'];
        }
        
        if (empty($updateFields)) {
            throw new Exception('No fields to update');
        }
        
        $params[] = $appointmentId;
        
        $stmt = $db->prepare("UPDATE appointments SET " . implode(", ", $updateFields) . " WHERE id = ?");
        $stmt->execute($params);
        
        // Update services if provided
        if (isset($input['services']) && is_array($input['services']) && !empty($input['services'])) {
            // First, delete existing services
            $stmt = $db->prepare("DELETE FROM appointment_services WHERE appointment_id = ?");
            $stmt->execute([$appointmentId]);
            
            // Get service prices and calculate total
            $serviceNames = $input['services'];
            $placeholders = str_repeat('?,', count($serviceNames) - 1) . '?';

            $stmt = $db->prepare("SELECT id, name, base_price as price, 30 as duration_minutes FROM services2 WHERE name IN ($placeholders) AND status = 'active'");
            $stmt->execute($serviceNames);
            $services = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (count($services) !== count($serviceNames)) {
                throw new Exception('Some selected services are not available');
            }
            
            $totalAmount = array_sum(array_column($services, 'price'));
            $totalDuration = array_sum(array_column($services, 'duration_minutes'));
            
            // Update appointment with new totals and package customizations
            $stmt = $db->prepare("UPDATE appointments SET total_amount = ?, estimated_duration = ?, package_customizations = ? WHERE id = ?");
            $stmt->execute([$totalAmount, $totalDuration, isset($input['packageCustomizations']) ? json_encode($input['packageCustomizations']) : null, $appointmentId]);
            
            // Add new appointment services
            $stmt = $db->prepare("INSERT INTO appointment_services (appointment_id, service_id, price) VALUES (?, ?, ?)");
            foreach ($services as $service) {
                $stmt->execute([$appointmentId, $service['id'], $service['price']]);
            }
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Appointment updated successfully'
        ]);
        
    } catch(Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleGetAppointmentDetails() {
    $decoded = requireAuth();

    try {
        if (!isset($_GET['appointment_id']) || empty($_GET['appointment_id'])) {
            throw new Exception('Appointment ID is required');
        }

        $appointmentId = intval($_GET['appointment_id']);
        $db = getDB();

        // Get user role from database
        $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            throw new Exception('User not found or inactive');
        }

        // Build query based on user role
        $query = "SELECT a.id, a.appointment_date, a.appointment_time, a.estimated_duration,
                  a.total_amount, a.status, a.special_instructions, a.package_customizations,
                  p.id as pet_id, p.name as pet_name, p.type as pet_type, p.breed as pet_breed,
                  p.age_range as pet_age, p.size as pet_size, p.last_vaccine_date, p.vaccine_types,
                  p.custom_vaccine, p.vaccination_proof
                  FROM appointments a
                  JOIN pets p ON a.pet_id = p.id
                  WHERE a.id = ?";

        $params = [$appointmentId];

        // If not admin/manager/staff/cashier, restrict to user's own appointments
        if (!in_array($user['role'], ['admin', 'manager', 'staff', 'cashier'])) {
            $query .= " AND a.user_id = ?";
            $params[] = $decoded->user_id;
        }

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $appointment = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$appointment) {
            throw new Exception('Appointment not found or you do not have permission to view it');
        }

        // Get services for the appointment
        $stmt = $db->prepare("SELECT s.id, s.name, s.category, aps.price
                             FROM appointment_services aps
                             JOIN services2 s ON aps.service_id = s.id
                             WHERE aps.appointment_id = ?");
        $stmt->execute([$appointmentId]);
        $services = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Process package customizations if they exist
        $processedServices = [];
        $packageCustomizations = json_decode($appointment['package_customizations'], true);

        if ($packageCustomizations && is_array($packageCustomizations)) {
            // Group services by packages
            $packageServices = [];
            $individualServices = [];

            foreach ($services as $service) {
                $isPartOfPackage = false;

                // Check if this service belongs to any package
                foreach ($packageCustomizations as $packageId => $customization) {
                    if (isset($customization['includedServices']) &&
                        in_array($service['name'], $customization['includedServices'])) {
                        // Use packageName if available, otherwise use packageId
                        $packageName = $customization['packageName'] ?? $packageId;
                        if (!isset($packageServices[$packageName])) {
                            $packageServices[$packageName] = [
                                'name' => $packageName . (isset($customization['excludedServices']) && !empty($customization['excludedServices']) ? ' (Customized)' : ''),
                                'services' => [],
                                'price' => 0,
                                'isPackage' => true
                            ];
                        }
                        $packageServices[$packageName]['services'][] = [
                            'name' => $service['name'],
                            'price' => $service['price'],
                            'included' => !isset($customization['excludedServices']) ||
                                        !in_array($service['name'], $customization['excludedServices'])
                        ];
                        $packageServices[$packageName]['price'] += $service['price'];
                        $isPartOfPackage = true;
                        break;
                    }
                }

                if (!$isPartOfPackage) {
                    $individualServices[] = $service;
                }
            }

            // Add packages first, then individual services
            foreach ($packageServices as $package) {
                $processedServices[] = $package;
            }
            $processedServices = array_merge($processedServices, $individualServices);
        } else {
            // No package customizations, return services as-is
            $processedServices = $services;
        }

        $appointment['services'] = $processedServices;

        echo json_encode([
            'success' => true,
            'appointment' => $appointment
        ]);

    } catch(Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleGetAllAppointments() {
    $decoded = requireAuth();

    // Get user role from database
    $db = getDB();
    $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
    $stmt->execute([$decoded->user_id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'User not found or inactive']);
        exit;
    }

    // Allow all authenticated users to view all appointments (customers can see all appointments)
    // No role restriction needed

    try {
        $db = getDB();
        $status = isset($_GET['status']) && $_GET['status'] !== 'all' ? $_GET['status'] : null;
        $month = isset($_GET['month']) && !empty($_GET['month']) ? $_GET['month'] : null;
        $year = isset($_GET['year']) && !empty($_GET['year']) ? $_GET['year'] : null;

        $query = "SELECT a.id, a.appointment_date, a.appointment_time, a.estimated_duration,
                  a.total_amount, a.status, a.special_instructions, a.package_customizations,
                  a.cancelled_by, a.cancelled_by_name, a.cancellation_remarks,
                  p.name as pet_name, p.type as pet_type, p.breed as pet_breed, p.size as pet_size,
                  p.last_vaccine_date, p.vaccine_types, p.custom_vaccine, p.vaccination_proof,
                  u.full_name as owner_name, u.email as owner_email
                  FROM appointments a
                  LEFT JOIN pets p ON a.pet_id = p.id
                  LEFT JOIN users u ON a.user_id = u.id";

        $params = [];
        $conditions = [];

        if ($status) {
            $conditions[] = "a.status = ?";
            $params[] = $status;
        }

        if ($month && $year) {
            $conditions[] = "MONTH(a.appointment_date) = ? AND YEAR(a.appointment_date) = ?";
            $params[] = $month;
            $params[] = $year;
        } elseif ($month) {
            $conditions[] = "MONTH(a.appointment_date) = ?";
            $params[] = $month;
        } elseif ($year) {
            $conditions[] = "YEAR(a.appointment_date) = ?";
            $params[] = $year;
        }

        if (!empty($conditions)) {
            $query .= " WHERE " . implode(" AND ", $conditions);
        }

        $query .= " ORDER BY a.appointment_date DESC, a.appointment_time DESC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get services for each appointment
        foreach ($appointments as &$appointment) {
            $stmt = $db->prepare("SELECT s.name, s.category, aps.price
                                FROM appointment_services aps
                                JOIN services2 s ON aps.service_id = s.id
                                WHERE aps.appointment_id = ?");
            $stmt->execute([$appointment['id']]);
            $appointment['services'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        echo json_encode([
            'success' => true,
            'appointments' => $appointments
        ]);
    } catch(Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleAdmitAppointment($input) {
    $decoded = requireAuth();

    try {
        // Validate required fields
        if (!isset($input['appointment_id']) || empty($input['appointment_id'])) {
            throw new Exception('Appointment ID is required');
        }

        $appointmentId = intval($input['appointment_id']);
        $db = getDB();

        // Get user role
        $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !in_array($user['role'], ['admin', 'manager', 'staff', 'cashier'])) {
            throw new Exception('Access denied. Insufficient permissions.');
        }

        // Get appointment details
        $stmt = $db->prepare("SELECT id, appointment_date, appointment_time, status FROM appointments WHERE id = ?");
        $stmt->execute([$appointmentId]);
        $appointment = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$appointment) {
            throw new Exception('Appointment not found');
        }

        // Check if appointment is already admitted/confirmed
        if ($appointment['status'] !== 'scheduled') {
            throw new Exception('Appointment is not in scheduled status and cannot be admitted');
        }

        // Check if appointment date is today or in the past (allow admitting on the day of appointment)
        $appointmentDateTime = new DateTime($appointment['appointment_date'] . ' ' . $appointment['appointment_time']);
        $now = new DateTime(); // Current date and time

        // Allow admitting if the appointment date/time is in the past OR if it's today
        $appointmentDate = new DateTime($appointment['appointment_date']);
        $appointmentDate->setTime(0, 0, 0); // Set to start of appointment date
        $today = new DateTime();
        $today->setTime(0, 0, 0); // Set to start of today

        // If appointment is in the future (not today), don't allow admitting
        if ($appointmentDate > $today) {
            throw new Exception('Cannot admit appointment before the scheduled date. Appointment can only be admitted on or after ' . $appointmentDate->format('M j, Y'));
        }

        // If appointment is today, check if the time has passed or is current
        if ($appointmentDate == $today && $appointmentDateTime > $now) {
            throw new Exception('Cannot admit appointment before the scheduled time. Please wait until ' . $appointmentDateTime->format('g:i A') . ' or later.');
        }

        // Update appointment status to confirmed (admitted)
        $stmt = $db->prepare("UPDATE appointments SET status = 'confirmed' WHERE id = ?");
        $stmt->execute([$appointmentId]);

        echo json_encode([
            'success' => true,
            'message' => 'Appointment admitted successfully'
        ]);

    } catch(Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleAutoCancelOverdueAppointments() {
    try {
        $db = getDB();

        // Get current date and time
        $now = new DateTime();
        $currentDate = $now->format('Y-m-d');
        $currentTime = $now->format('H:i:s');

        // Find appointments that are:
        // 1. Still in "scheduled" status
        // 2. On today's date or earlier
        // 3. Current time is past 5:00 PM (17:00:00)
        $stmt = $db->prepare("
            SELECT id, appointment_date, appointment_time
            FROM appointments
            WHERE status = 'scheduled'
            AND appointment_date <= ?
            AND (
                appointment_date < ? OR
                (appointment_date = ? AND ? >= '17:00:00')
            )
        ");
        $stmt->execute([$currentDate, $currentDate, $currentDate, $currentTime]);
        $overdueAppointments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $cancelledCount = 0;

        foreach ($overdueAppointments as $appointment) {
            // Auto-cancel the appointment
            $cancelStmt = $db->prepare("
                UPDATE appointments
                SET status = 'cancelled',
                    cancelled_by = 0,
                    cancelled_by_name = 'System',
                    cancellation_remarks = 'Customer did not arrive'
                WHERE id = ?
            ");
            $cancelStmt->execute([$appointment['id']]);
            $cancelledCount++;
        }

        echo json_encode([
            'success' => true,
            'message' => "Auto-cancelled {$cancelledCount} overdue appointments",
            'cancelled_count' => $cancelledCount,
            'appointments_cancelled' => array_column($overdueAppointments, 'id')
        ]);

    } catch(Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
?>