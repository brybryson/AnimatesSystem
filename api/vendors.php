<?php
// Always return JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
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

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    switch($action) {
        case 'get_vendors':
            handleGetVendors();
            break;
        case 'get_vendor':
            handleGetVendor();
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
        case 'add_vendor':
            handleAddVendor($input);
            break;
        case 'update_vendor':
            handleUpdateVendor($input);
            break;
        case 'delete_vendor':
            handleDeleteVendor($input);
            break;
        case 'archive_vendor':
            handleArchiveVendor($input);
            break;
        case 'restore_vendor':
            handleRestoreVendor($input);
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

function handleGetVendors() {
    $decoded = requireAuth();

    try {
        $db = getDB();

        // Get user role
        $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !in_array($user['role'], ['admin', 'manager', 'staff', 'cashier', 'stock_controller'])) {
            throw new Exception('Access denied. Insufficient permissions.');
        }

        $includeArchived = isset($_GET['include_archived']) && $_GET['include_archived'] === 'true';
        $archivedOnly = isset($_GET['archived_only']) && $_GET['archived_only'] === 'true';

        $query = "SELECT id, name, contact_person, email, phone, address, city, province, country, postal_code, payment_terms, credit_limit, tax_id, notes, is_active, created_at, updated_at FROM vendors";
        $params = [];

        if ($archivedOnly) {
            $query .= " WHERE is_active = 0";
        } elseif (!$includeArchived) {
            $query .= " WHERE is_active = 1";
        }

        $query .= " ORDER BY name ASC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $vendors = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $vendors
        ]);
    } catch(Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleGetVendor() {
    $decoded = requireAuth();

    try {
        if (!isset($_GET['id']) || empty($_GET['id'])) {
            throw new Exception('Vendor ID is required');
        }

        $id = intval($_GET['id']);
        $db = getDB();

        // Get user role
        $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !in_array($user['role'], ['admin', 'manager', 'staff', 'cashier', 'stock_controller'])) {
            throw new Exception('Access denied. Insufficient permissions.');
        }

        $stmt = $db->prepare("SELECT * FROM vendors WHERE id = ?");
        $stmt->execute([$id]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$vendor) {
            throw new Exception('Vendor not found');
        }

        echo json_encode([
            'success' => true,
            'data' => $vendor
        ]);
    } catch(Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleAddVendor($input) {
    $decoded = requireAuth();

    try {
        $db = getDB();

        // Get user role
        $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !in_array($user['role'], ['admin', 'manager'])) {
            throw new Exception('Access denied. Only admin and manager can add vendors.');
        }

        // Validate required fields
        $required = ['name', 'contact_person', 'email', 'phone', 'address', 'city', 'province', 'postal_code', 'country', 'tax_id'];
        foreach ($required as $field) {
            if (!isset($input[$field]) || trim($input[$field]) === '') {
                throw new Exception(ucfirst(str_replace('_', ' ', $field)) . ' is required');
            }
        }
    
        // Validate vendor name (alphabets only)
        if (!preg_match('/^[A-Za-z\s]+$/', trim($input['name']))) {
            throw new Exception('Vendor name can only contain alphabets and spaces');
        }
    
        // Validate contact person (alphabets only)
        if (!preg_match('/^[A-Za-z\s]+$/', trim($input['contact_person']))) {
            throw new Exception('Contact person can only contain alphabets and spaces');
        }
    
        // Validate email format
        if (!preg_match('/^[^\s@]+@[^\s@]+\.com$/', trim($input['email']))) {
            throw new Exception('Email must contain @ and end with .com');
        }
    
        // Validate phone number (11 digits, starts with 09)
        $phone = trim($input['phone']);
        if (!preg_match('/^09\d{9}$/', $phone) || strlen($phone) !== 11) {
            throw new Exception('Phone number must be 11 digits and start with 09');
        }
    
        // Validate postal code (4 digits only)
        if (!preg_match('/^\d{4}$/', trim($input['postal_code']))) {
            throw new Exception('Postal code must be exactly 4 digits');
        }

        // Validate name uniqueness
        $stmt = $db->prepare("SELECT id FROM vendors WHERE name = ?");
        $stmt->execute([trim($input['name'])]);
        if ($stmt->fetch(PDO::FETCH_ASSOC)) {
            throw new Exception('Vendor name already exists');
        }

        // Validate email if provided
        if (isset($input['email']) && !empty($input['email']) && !filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
            throw new Exception('Invalid email format');
        }


        $db->beginTransaction();

        $stmt = $db->prepare("
            INSERT INTO vendors (name, contact_person, email, phone, address, city, province, postal_code, country, tax_id, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            trim($input['name']),
            isset($input['contact_person']) ? trim($input['contact_person']) : null,
            isset($input['email']) ? trim($input['email']) : null,
            isset($input['phone']) ? trim($input['phone']) : null,
            isset($input['address']) ? trim($input['address']) : null,
            isset($input['city']) ? trim($input['city']) : null,
            isset($input['province']) ? trim($input['province']) : null,
            isset($input['postal_code']) ? trim($input['postal_code']) : null,
            isset($input['country']) ? trim($input['country']) : 'Philippines',
            isset($input['tax_id']) ? trim($input['tax_id']) : null,
            isset($input['notes']) ? trim($input['notes']) : null,
            $decoded->user_id
        ]);

        $vendorId = $db->lastInsertId();

        $db->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Vendor added successfully',
            'data' => ['id' => $vendorId]
        ]);

    } catch(Exception $e) {
        if (isset($db) && $db->inTransaction()) {
            $db->rollback();
        }
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleUpdateVendor($input) {
    $decoded = requireAuth();

    try {
        if (!isset($input['id']) || empty($input['id'])) {
            throw new Exception('Vendor ID is required');
        }

        $id = intval($input['id']);
        $db = getDB();

        // Get user role
        $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !in_array($user['role'], ['admin', 'manager'])) {
            throw new Exception('Access denied. Only admin and manager can update vendors.');
        }

        // Check if vendor exists
        $stmt = $db->prepare("SELECT id FROM vendors WHERE id = ?");
        $stmt->execute([$id]);
        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
            throw new Exception('Vendor not found');
        }

        // Validate required fields
        $required = ['name', 'contact_person', 'email', 'phone', 'address', 'city', 'province', 'postal_code', 'country', 'tax_id'];
        foreach ($required as $field) {
            if (!isset($input[$field]) || trim($input[$field]) === '') {
                throw new Exception(ucfirst(str_replace('_', ' ', $field)) . ' is required');
            }
        }

        // Validate vendor name (alphabets only)
        if (!preg_match('/^[A-Za-z\s]+$/', trim($input['name']))) {
            throw new Exception('Vendor name can only contain alphabets and spaces');
        }

        // Validate contact person (alphabets only)
        if (!preg_match('/^[A-Za-z\s]+$/', trim($input['contact_person']))) {
            throw new Exception('Contact person can only contain alphabets and spaces');
        }

        // Validate email format
        if (!preg_match('/^[^\s@]+@[^\s@]+\.com$/', trim($input['email']))) {
            throw new Exception('Email must contain @ and end with .com');
        }

        // Validate phone number (11 digits, starts with 09)
        $phone = trim($input['phone']);
        if (!preg_match('/^09\d{9}$/', $phone) || strlen($phone) !== 11) {
            throw new Exception('Phone number must be 11 digits and start with 09');
        }

        // Validate postal code (4 digits only)
        if (!preg_match('/^\d{4}$/', trim($input['postal_code']))) {
            throw new Exception('Postal code must be exactly 4 digits');
        }

        // Validate name uniqueness if changed
        if (isset($input['name'])) {
            $stmt = $db->prepare("SELECT id FROM vendors WHERE name = ? AND id != ?");
            $stmt->execute([trim($input['name']), $id]);
            if ($stmt->fetch(PDO::FETCH_ASSOC)) {
                throw new Exception('Vendor name already exists');
            }
        }


        $db->beginTransaction();

        $updateFields = [];
        $params = [];

        $fields = ['name', 'contact_person', 'email', 'phone', 'address', 'city', 'province', 'postal_code', 'country', 'tax_id', 'notes'];
        foreach ($fields as $field) {
            if (isset($input[$field])) {
                $updateFields[] = "$field = ?";
                $params[] = $field === 'credit_limit' ? $input[$field] : trim($input[$field]);
            }
        }

        if (empty($updateFields)) {
            throw new Exception('No fields to update');
        }

        $updateFields[] = "updated_by = ?";
        $params[] = $decoded->user_id;

        $params[] = $id;

        $stmt = $db->prepare("UPDATE vendors SET " . implode(", ", $updateFields) . " WHERE id = ?");
        $stmt->execute($params);

        $db->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Vendor updated successfully'
        ]);

    } catch(Exception $e) {
        if (isset($db) && $db->inTransaction()) {
            $db->rollback();
        }
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleDeleteVendor($input) {
    $decoded = requireAuth();

    try {
        if (!isset($input['id']) || empty($input['id'])) {
            throw new Exception('Vendor ID is required');
        }

        $id = intval($input['id']);
        $db = getDB();

        // Get user role
        $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || $user['role'] !== 'admin') {
            throw new Exception('Access denied. Only admin can delete vendors.');
        }

        // Check if vendor exists
        $stmt = $db->prepare("SELECT id FROM vendors WHERE id = ?");
        $stmt->execute([$id]);
        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
            throw new Exception('Vendor not found');
        }

        // Check if vendor is used in inventory
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM inventory WHERE vendor = (SELECT name FROM vendors WHERE id = ?)");
        $stmt->execute([$id]);
        $count = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        if ($count > 0) {
            throw new Exception('Cannot delete vendor that is referenced in inventory items. Use archive instead.');
        }

        $stmt = $db->prepare("DELETE FROM vendors WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode([
            'success' => true,
            'message' => 'Vendor deleted successfully'
        ]);

    } catch(Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleArchiveVendor($input) {
    $decoded = requireAuth();

    try {
        if (!isset($input['id']) || empty($input['id'])) {
            throw new Exception('Vendor ID is required');
        }

        $id = intval($input['id']);
        $db = getDB();

        // Get user role
        $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !in_array($user['role'], ['admin', 'manager'])) {
            throw new Exception('Access denied. Only admin and manager can archive vendors.');
        }

        // Check if vendor exists
        $stmt = $db->prepare("SELECT id FROM vendors WHERE id = ?");
        $stmt->execute([$id]);
        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
            throw new Exception('Vendor not found');
        }

        $stmt = $db->prepare("UPDATE vendors SET is_active = FALSE, updated_by = ? WHERE id = ?");
        $stmt->execute([$decoded->user_id, $id]);

        echo json_encode([
            'success' => true,
            'message' => 'Vendor archived successfully'
        ]);

    } catch(Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleRestoreVendor($input) {
    $decoded = requireAuth();

    try {
        if (!isset($input['id']) || empty($input['id'])) {
            throw new Exception('Vendor ID is required');
        }

        $id = intval($input['id']);
        $db = getDB();

        // Get user role
        $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !in_array($user['role'], ['admin', 'manager'])) {
            throw new Exception('Access denied. Only admin and manager can restore vendors.');
        }

        // Check if vendor exists
        $stmt = $db->prepare("SELECT id FROM vendors WHERE id = ?");
        $stmt->execute([$id]);
        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
            throw new Exception('Vendor not found');
        }

        $stmt = $db->prepare("UPDATE vendors SET is_active = TRUE, updated_by = ? WHERE id = ?");
        $stmt->execute([$decoded->user_id, $id]);

        echo json_encode([
            'success' => true,
            'message' => 'Vendor restored successfully'
        ]);

    } catch(Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

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
?>