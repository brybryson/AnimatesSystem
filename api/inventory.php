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
        case 'get_inventory':
            handleGetInventory();
            break;
        case 'get_inventory_item':
            handleGetInventoryItem();
            break;
        case 'get_categories':
            handleGetCategories();
            break;
        case 'get_vendors':
            handleGetVendors();
            break;
        case 'get_low_stock':
            handleGetLowStock();
            break;
        case 'export_inventory':
            handleExportInventory();
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
        case 'add_inventory':
            handleAddInventory($input);
            break;
        case 'update_inventory':
            handleUpdateInventory($input);
            break;
        case 'delete_inventory':
            handleDeleteInventory($input);
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

function handleGetInventory() {
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

        $category = isset($_GET['category']) && !empty($_GET['category']) ? $_GET['category'] : null;
        $search = isset($_GET['search']) && !empty($_GET['search']) ? $_GET['search'] : null;

        $query = "SELECT id, name, description, category, quantity, unit_price, vendor, min_stock_level, critical_stock_level,
                         created_at, updated_at FROM inventory WHERE 1=1";
        $params = [];

        if ($category) {
            $query .= " AND category = ?";
            $params[] = $category;
        }

        if ($search) {
            $query .= " AND (name LIKE ? OR description LIKE ? OR vendor LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $query .= " ORDER BY name ASC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $inventory = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $inventory
        ]);
    } catch(Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleGetInventoryItem() {
    $decoded = requireAuth();

    try {
        if (!isset($_GET['id']) || empty($_GET['id'])) {
            throw new Exception('Inventory ID is required');
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

        $stmt = $db->prepare("SELECT * FROM inventory WHERE id = ?");
        $stmt->execute([$id]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            throw new Exception('Inventory item not found');
        }

        echo json_encode([
            'success' => true,
            'data' => $item
        ]);
    } catch(Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleGetCategories() {
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

        $stmt = $db->prepare("SELECT DISTINCT category FROM inventory WHERE category IS NOT NULL AND category != '' ORDER BY category ASC");
        $stmt->execute();
        $categories = $stmt->fetchAll(PDO::FETCH_COLUMN);

        echo json_encode([
            'success' => true,
            'data' => $categories
        ]);
    } catch(Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
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

        $stmt = $db->prepare("SELECT name FROM vendors WHERE is_active = 1 ORDER BY name ASC");
        $stmt->execute();
        $vendors = $stmt->fetchAll(PDO::FETCH_COLUMN);

        echo json_encode([
            'success' => true,
            'data' => $vendors
        ]);
    } catch(Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleGetLowStock() {
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

        $stmt = $db->prepare("SELECT id, name, category, quantity, min_stock_level FROM inventory WHERE quantity <= min_stock_level ORDER BY quantity ASC");
        $stmt->execute();
        $lowStockItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $lowStockItems
        ]);
    } catch(Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleAddInventory($input) {
    $decoded = requireAuth();

    try {
        $db = getDB();

        // Get user role
        $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !in_array($user['role'], ['admin', 'manager'])) {
            throw new Exception('Access denied. Only admin and manager can add inventory.');
        }

        // Validate required fields
        $required = ['name', 'category', 'quantity', 'unit_price', 'vendor', 'min_stock_level', 'critical_stock_level'];
        foreach ($required as $field) {
            if (!isset($input[$field]) || $input[$field] === '') {
                throw new Exception(ucfirst(str_replace('_', ' ', $field)) . ' is required');
            }
        }

        // Validate name (not empty)
        if (trim($input['name']) === '') {
            throw new Exception('Name cannot be empty');
        }

        // Validate category (must be selected from dropdown, not empty)
        if (trim($input['category']) === '') {
            throw new Exception('Please select a category from the dropdown');
        }

        // Validate quantity (numeric, positive integer)
        if (!is_numeric($input['quantity']) || $input['quantity'] <= 0 || !is_int($input['quantity'] + 0)) {
            throw new Exception('Quantity must be a positive whole number');
        }

        // Validate unit_price (numeric, positive)
        if (!is_numeric($input['unit_price']) || $input['unit_price'] <= 0) {
            throw new Exception('Unit price must be a positive number');
        }

        // Validate vendor (not empty)
        if (trim($input['vendor']) === '') {
            throw new Exception('Please select a vendor');
        }

        // Validate min_stock_level (numeric, non-negative)
        if (!is_numeric($input['min_stock_level']) || $input['min_stock_level'] < 0) {
            throw new Exception('Minimum stock level must be a non-negative number');
        }

        // Validate critical_stock_level (numeric, non-negative)
        if (!is_numeric($input['critical_stock_level']) || $input['critical_stock_level'] < 0) {
            throw new Exception('Critical stock level must be a non-negative number');
        }

        // Validate description (at least 20 characters)
        if (!isset($input['description']) || strlen(trim($input['description'])) < 20) {
            throw new Exception('Description must be at least 20 characters long');
        }

        $db->beginTransaction();

        $stmt = $db->prepare("
            INSERT INTO inventory (name, description, category, quantity, unit_price, vendor, min_stock_level, critical_stock_level, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $input['name'],
            $input['description'] ?? null,
            $input['category'] ?? null,
            $input['quantity'],
            $input['unit_price'] ?? 0.00,
            $input['vendor'] ?? null,
            $input['min_stock_level'] ?? 0,
            $input['critical_stock_level'] ?? 0,
            $decoded->user_id
        ]);

        $inventoryId = $db->lastInsertId();

        $db->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Inventory item added successfully',
            'data' => ['id' => $inventoryId]
        ]);

    } catch(Exception $e) {
        if (isset($db) && $db->inTransaction()) {
            $db->rollback();
        }
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleUpdateInventory($input) {
    $decoded = requireAuth();

    try {
        if (!isset($input['id']) || empty($input['id'])) {
            throw new Exception('Inventory ID is required');
        }

        $id = intval($input['id']);
        $db = getDB();

        // Get user role
        $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !in_array($user['role'], ['admin', 'manager'])) {
            throw new Exception('Access denied. Only admin and manager can update inventory.');
        }

        // Check if item exists
        $stmt = $db->prepare("SELECT id FROM inventory WHERE id = ?");
        $stmt->execute([$id]);
        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
            throw new Exception('Inventory item not found');
        }

        // Validate fields if provided
        if (isset($input['name']) && trim($input['name']) === '') {
            throw new Exception('Name cannot be empty');
        }

        if (isset($input['category']) && trim($input['category']) === '') {
            throw new Exception('Please select a category from the dropdown');
        }

        if (isset($input['quantity']) && (!is_numeric($input['quantity']) || $input['quantity'] <= 0 || !is_int($input['quantity'] + 0))) {
            throw new Exception('Quantity must be a positive whole number');
        }

        if (isset($input['unit_price']) && (!is_numeric($input['unit_price']) || $input['unit_price'] <= 0)) {
            throw new Exception('Unit price must be a positive number');
        }

        if (isset($input['vendor']) && trim($input['vendor']) === '') {
            throw new Exception('Please select a vendor');
        }

        if (isset($input['min_stock_level']) && (!is_numeric($input['min_stock_level']) || $input['min_stock_level'] < 0)) {
            throw new Exception('Minimum stock level must be a non-negative number');
        }

        if (isset($input['critical_stock_level']) && (!is_numeric($input['critical_stock_level']) || $input['critical_stock_level'] < 0)) {
            throw new Exception('Critical stock level must be a non-negative number');
        }

        if (isset($input['description']) && strlen(trim($input['description'])) < 20) {
            throw new Exception('Description must be at least 20 characters long');
        }

        $db->beginTransaction();

        $updateFields = [];
        $params = [];

        if (isset($input['name'])) {
            $updateFields[] = "name = ?";
            $params[] = $input['name'];
        }

        if (isset($input['description'])) {
            $updateFields[] = "description = ?";
            $params[] = $input['description'];
        }

        if (isset($input['category'])) {
            $updateFields[] = "category = ?";
            $params[] = $input['category'];
        }

        if (isset($input['quantity'])) {
            $updateFields[] = "quantity = ?";
            $params[] = $input['quantity'];
        }

        if (isset($input['unit_price'])) {
            $updateFields[] = "unit_price = ?";
            $params[] = $input['unit_price'];
        }

        if (isset($input['vendor'])) {
            $updateFields[] = "vendor = ?";
            $params[] = $input['vendor'];
        }

        if (isset($input['min_stock_level'])) {
            $updateFields[] = "min_stock_level = ?";
            $params[] = $input['min_stock_level'];
        }

        if (isset($input['critical_stock_level'])) {
            $updateFields[] = "critical_stock_level = ?";
            $params[] = $input['critical_stock_level'];
        }

        if (empty($updateFields)) {
            throw new Exception('No fields to update');
        }

        $updateFields[] = "updated_by = ?";
        $params[] = $decoded->user_id;

        $params[] = $id;

        $stmt = $db->prepare("UPDATE inventory SET " . implode(", ", $updateFields) . " WHERE id = ?");
        $stmt->execute($params);

        $db->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Inventory item updated successfully'
        ]);

    } catch(Exception $e) {
        if (isset($db) && $db->inTransaction()) {
            $db->rollback();
        }
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleDeleteInventory($input) {
    $decoded = requireAuth();

    try {
        if (!isset($input['id']) || empty($input['id'])) {
            throw new Exception('Inventory ID is required');
        }

        $id = intval($input['id']);
        $db = getDB();

        // Get user role
        $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !in_array($user['role'], ['admin', 'manager'])) {
            throw new Exception('Access denied. Only admin and manager can delete inventory.');
        }

        // Check if item exists
        $stmt = $db->prepare("SELECT id FROM inventory WHERE id = ?");
        $stmt->execute([$id]);
        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
            throw new Exception('Inventory item not found');
        }

        $stmt = $db->prepare("DELETE FROM inventory WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode([
            'success' => true,
            'message' => 'Inventory item deleted successfully'
        ]);

    } catch(Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleExportInventory() {
    $decoded = requireAuth();

    try {
        // Include PhpSpreadsheet for XLSX export
        require_once '../vendor/autoload.php';
        $spreadsheetClass = 'PhpOffice\\PhpSpreadsheet\\Spreadsheet';
        $xlsxClass = 'PhpOffice\\PhpSpreadsheet\\Writer\\Xlsx';

        $db = getDB();

        // Get user role
        $stmt = $db->prepare("SELECT role, full_name FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !in_array($user['role'], ['admin', 'manager', 'staff', 'cashier'])) {
            throw new Exception('Access denied. Insufficient permissions.');
        }

        // Get all inventory data
        $stmt = $db->prepare("
            SELECT
                name,
                description,
                category,
                quantity,
                unit_price,
                vendor,
                min_stock_level,
                critical_stock_level,
                created_at,
                updated_at
            FROM inventory
            ORDER BY category ASC, name ASC
        ");
        $stmt->execute();
        $inventory = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Create new Spreadsheet
        $spreadsheet = new $spreadsheetClass();
        $sheet = $spreadsheet->getActiveSheet();

        // Set document properties
        $spreadsheet->getProperties()
            ->setCreator('Animates Pet Grooming System')
            ->setTitle('Inventory Export')
            ->setSubject('Inventory Report')
            ->setDescription('Complete inventory report exported from Animates system');

        // Add header information
        $sheet->setCellValue('A1', 'Animates Pet Boutique & Grooming Salon - Inventory Report');
        $sheet->setCellValue('A2', 'Export Date: ' . date('F j, Y \a\t g:i A T'));
        $sheet->setCellValue('A3', 'Exported By: ' . $user['full_name'] . ' (' . ucfirst($user['role']) . ')');
        $sheet->setCellValue('A4', 'Total Items: ' . count($inventory));

        // Style the header
        $headerStyle = [
            'font' => [
                'bold' => true,
                'size' => 14,
            ],
            'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'D4AF37'],
            ],
        ];
        $sheet->getStyle('A1')->applyFromArray($headerStyle);

        $subHeaderStyle = [
            'font' => [
                'bold' => true,
                'size' => 11,
            ],
        ];
        $sheet->getStyle('A2:A4')->applyFromArray($subHeaderStyle);

        // Add column headers starting from row 6
        $sheet->setCellValue('A6', 'Name');
        $sheet->setCellValue('B6', 'Description');
        $sheet->setCellValue('C6', 'Category');
        $sheet->setCellValue('D6', 'Quantity');
        $sheet->setCellValue('E6', 'Unit Price');
        $sheet->setCellValue('F6', 'Total Value');
        $sheet->setCellValue('G6', 'Vendor');
        $sheet->setCellValue('H6', 'Min Stock');
        $sheet->setCellValue('I6', 'Critical Stock');
        $sheet->setCellValue('J6', 'Status');
        $sheet->setCellValue('K6', 'Created Date');
        $sheet->setCellValue('L6', 'Last Updated');

        // Style column headers
        $columnHeaderStyle = [
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
            ],
            'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'startColor' => ['rgb' => '8B4513'],
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN,
                ],
            ],
        ];
        $sheet->getStyle('A6:L6')->applyFromArray($columnHeaderStyle);

        // Add data rows
        $row = 7;
        $totalValue = 0;

        foreach ($inventory as $item) {
            $itemTotalValue = $item['quantity'] * $item['unit_price'];
            $totalValue += $itemTotalValue;

            // Determine status
            $status = 'Normal';
            if ($item['quantity'] <= $item['critical_stock_level']) {
                $status = 'Critical';
            } elseif ($item['quantity'] <= $item['min_stock_level']) {
                $status = 'Low Stock';
            }

            $sheet->setCellValue('A' . $row, $item['name']);
            $sheet->setCellValue('B' . $row, $item['description']);
            $sheet->setCellValue('C' . $row, $item['category']);
            $sheet->setCellValue('D' . $row, $item['quantity']);
            $sheet->setCellValue('E' . $row, '₱' . number_format($item['unit_price'], 2));
            $sheet->setCellValue('F' . $row, '₱' . number_format($itemTotalValue, 2));
            $sheet->setCellValue('G' . $row, $item['vendor']);
            $sheet->setCellValue('H' . $row, $item['min_stock_level']);
            $sheet->setCellValue('I' . $row, $item['critical_stock_level']);
            $sheet->setCellValue('J' . $row, $status);
            $sheet->setCellValue('K' . $row, date('M j, Y', strtotime($item['created_at'])));
            $sheet->setCellValue('L' . $row, date('M j, Y H:i', strtotime($item['updated_at'])));

            $row++;
        }

        // Add summary row
        $summaryRow = $row + 1;
        $sheet->setCellValue('E' . $summaryRow, 'TOTAL VALUE:');
        $sheet->setCellValue('F' . $summaryRow, '₱' . number_format($totalValue, 2));

        $summaryStyle = [
            'font' => [
                'bold' => true,
                'size' => 12,
            ],
            'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'FFF8DC'],
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_MEDIUM,
                ],
            ],
        ];
        $sheet->getStyle('E' . $summaryRow . ':F' . $summaryRow)->applyFromArray($summaryStyle);

        // Auto-size columns
        foreach (range('A', 'L') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }

        // Set column widths for better readability
        $sheet->getColumnDimension('A')->setWidth(25); // Name
        $sheet->getColumnDimension('B')->setWidth(40); // Description
        $sheet->getColumnDimension('C')->setWidth(15); // Category
        $sheet->getColumnDimension('G')->setWidth(20); // Vendor

        // Create filename with date
        $filename = 'inventory_export_' . date('Y-m-d_H-i-s') . '.xlsx';

        // Set headers for download
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment;filename="' . $filename . '"');
        header('Cache-Control: max-age=0');

        // Create writer and output file
        $writer = new $xlsxClass($spreadsheet);
        $writer->save('php://output');
        exit;

    } catch(Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
?>