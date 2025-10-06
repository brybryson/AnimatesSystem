<?php
require_once '../config/database.php';
require_once '../vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Handle export action
$action = $_GET['action'] ?? '';
if ($action === 'export') {
    handleExport();
    exit;
}

try {
    $db = getDB();
    $period = $_GET['period'] ?? 'today';
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;

    // Build date condition based on period or custom range
    $dateCondition = '';
    $params = [];

    if ($startDate && $endDate) {
        // Custom date range
        $dateCondition = "DATE(a.check_in_time) BETWEEN ? AND ?";
        $params = [$startDate, $endDate];
    } else {
        // Predefined periods
        switch ($period) {
            case 'today':
                $dateCondition = "DATE(a.check_in_time) = CURDATE()";
                break;
            case 'week':
                $dateCondition = "YEARWEEK(a.check_in_time, 1) = YEARWEEK(CURDATE(), 1)";
                break;
            case 'month':
                $dateCondition = "YEAR(a.check_in_time) = YEAR(CURDATE()) AND MONTH(a.check_in_time) = MONTH(CURDATE())";
                break;
            default:
                $dateCondition = "DATE(a.check_in_time) = CURDATE()";
        }
    }

    // Total pets (count of appointments within the period that have been admitted)
    $stmt = $db->prepare("
        SELECT COUNT(*) as total
        FROM appointments a
        WHERE a.check_in_time IS NOT NULL
        AND $dateCondition
    ");
    if (!empty($params)) {
        $stmt->execute($params);
    } else {
        $stmt->execute();
    }
    $totalPets = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    // In progress (count of appointments where status = 'confirmed' and check_in_time matches period)
    $stmt = $db->prepare("
        SELECT COUNT(*) as total
        FROM appointments a
        WHERE a.status = 'confirmed'
        AND a.check_in_time IS NOT NULL
        AND $dateCondition
    ");
    if (!empty($params)) {
        $stmt->execute($params);
    } else {
        $stmt->execute();
    }
    $inProgress = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Completed (count of appointments where status = 'completed' and check_in_time matches period)
    $stmt = $db->prepare("
        SELECT COUNT(*) as total
        FROM appointments a
        WHERE a.status = 'completed'
        AND a.check_in_time IS NOT NULL
        AND $dateCondition
    ");
    if (!empty($params)) {
        $stmt->execute($params);
    } else {
        $stmt->execute();
    }
    $completed = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Revenue (sum of total_amount for completed appointments where check_in_time matches period)
    $stmt = $db->prepare("
        SELECT COALESCE(SUM(a.total_amount), 0) as revenue
        FROM appointments a
        WHERE a.status = 'completed'
        AND a.check_in_time IS NOT NULL
        AND $dateCondition
    ");
    if (!empty($params)) {
        $stmt->execute($params);
    } else {
        $stmt->execute();
    }
    $revenue = $stmt->fetch(PDO::FETCH_ASSOC)['revenue'];

    echo json_encode([
        'success' => true,
        'data' => [
            'total_pets' => (int)$totalPets,
            'in_progress' => (int)$inProgress,
            'completed' => (int)$completed,
            'revenue' => (float)$revenue
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function getCurrentStatusData($db, $dateCondition, $params) {
    $stmt = $db->prepare("
        SELECT
            a.id,
            p.name as pet_name,
            p.breed,
            a.custom_rfid as rfid,
            u.full_name as owner_name
        FROM appointments a
        LEFT JOIN pets p ON a.pet_id = p.id
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.status IN ('confirmed', 'checked-in', 'bathing', 'grooming')
        AND a.check_in_time IS NOT NULL
        AND $dateCondition
        ORDER BY a.check_in_time DESC
        LIMIT 10
    ");

    if (!empty($params)) {
        $stmt->execute($params);
    } else {
        $stmt->execute();
    }

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function getCompletedStatusData($db, $dateCondition, $params) {
    $stmt = $db->prepare("
        SELECT
            a.id,
            p.name as pet_name,
            p.breed,
            a.custom_rfid as rfid,
            u.full_name as owner_name
        FROM appointments a
        LEFT JOIN pets p ON a.pet_id = p.id
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.status = 'completed'
        AND a.check_in_time IS NOT NULL
        AND $dateCondition
        ORDER BY a.check_in_time DESC
        LIMIT 10
    ");

    if (!empty($params)) {
        $stmt->execute($params);
    } else {
        $stmt->execute();
    }

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function handleExport() {
    try {
        // Get JWT token for authentication
        $headers = getallheaders();
        $token = null;

        if (isset($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
            if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
                $token = $matches[1];
            }
        }

        if (!$token) {
            http_response_code(401);
            echo json_encode(['error' => 'No token provided']);
            exit;
        }

        // Verify JWT
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new Exception('Invalid token format');
        }

        $header = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[0])));
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1])));
        $signature = str_replace(['-', '_'], ['+', '/'], $parts[2]);

        $expectedSignature = hash_hmac('sha256', $parts[0] . "." . $parts[1], '8paws_jwt_secret_key_2025', true);

        if (!hash_equals($expectedSignature, base64_decode($signature))) {
            throw new Exception('Invalid signature');
        }

        if ($payload->exp < time()) {
            throw new Exception('Token expired');
        }

        // Get user info
        $db = getDB();
        $stmt = $db->prepare("SELECT full_name FROM users WHERE id = ?");
        $stmt->execute([$payload->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            throw new Exception('User not found');
        }

        $exportedBy = $user['full_name'];
        $exportDate = date('F j, Y g:i A'); // Format like "October 6, 2025 12:17 PM"

        // Get filter parameters
        $period = $_GET['period'] ?? 'today';
        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;

        // Build date condition (same logic as main function)
        $dateCondition = '';
        $params = [];

        if ($startDate && $endDate) {
            $dateCondition = "DATE(a.check_in_time) BETWEEN ? AND ?";
            $params = [$startDate, $endDate];
            $periodLabel = "Custom Range ($startDate to $endDate)";
        } else {
            switch ($period) {
                case 'today':
                    $dateCondition = "DATE(a.check_in_time) = CURDATE()";
                    $periodLabel = "Today";
                    break;
                case 'week':
                    $dateCondition = "YEARWEEK(a.check_in_time, 1) = YEARWEEK(CURDATE(), 1)";
                    $periodLabel = "This Week";
                    break;
                case 'month':
                    $dateCondition = "YEAR(a.check_in_time) = YEAR(CURDATE()) AND MONTH(a.check_in_time) = MONTH(CURDATE())";
                    $periodLabel = "This Month";
                    break;
                default:
                    $dateCondition = "DATE(a.check_in_time) = CURDATE()";
                    $periodLabel = "Today";
            }
        }

        // Get statistics
        $stmt = $db->prepare("
            SELECT COUNT(*) as total
            FROM appointments a
            WHERE a.check_in_time IS NOT NULL
            AND $dateCondition
        ");
        if (!empty($params)) {
            $stmt->execute($params);
        } else {
            $stmt->execute();
        }
        $totalPets = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

        $stmt = $db->prepare("
            SELECT COUNT(*) as total
            FROM appointments a
            WHERE a.status = 'confirmed'
            AND a.check_in_time IS NOT NULL
            AND $dateCondition
        ");
        if (!empty($params)) {
            $stmt->execute($params);
        } else {
            $stmt->execute();
        }
        $inProgress = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

        $stmt = $db->prepare("
            SELECT COUNT(*) as total
            FROM appointments a
            WHERE a.status = 'completed'
            AND a.check_in_time IS NOT NULL
            AND $dateCondition
        ");
        if (!empty($params)) {
            $stmt->execute($params);
        } else {
            $stmt->execute();
        }
        $completed = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

        $stmt = $db->prepare("
            SELECT COALESCE(SUM(a.total_amount), 0) as revenue
            FROM appointments a
            WHERE a.status = 'completed'
            AND a.check_in_time IS NOT NULL
            AND $dateCondition
        ");
        if (!empty($params)) {
            $stmt->execute($params);
        } else {
            $stmt->execute();
        }
        $revenue = $stmt->fetch(PDO::FETCH_ASSOC)['revenue'];

        // Get current status and completed data (using same date filtering as statistics)
        $currentStatusData = getCurrentStatusData($db, $dateCondition, $params);
        $completedStatusData = getCompletedStatusData($db, $dateCondition, $params);

        // Create CSV content
        $csvContent = "Dashboard Statistics Export\n";
        $csvContent .= "Exported By:,$exportedBy\n";
        $csvContent .= "Export Date:,$exportDate\n";
        $csvContent .= "Period:,$periodLabel\n";
        $csvContent .= "\n";
        // Create XLSX file using PhpSpreadsheet
        try {
            $spreadsheet = new Spreadsheet();
        } catch (Exception $e) {
            error_log('Spreadsheet creation error: ' . $e->getMessage());
            throw $e;
        }
        $sheet = $spreadsheet->getActiveSheet();

        // Define styles
        $headerStyle = [
            'font' => ['bold' => true, 'size' => 14],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'D4AF37']],
            'font' => ['color' => ['rgb' => 'FFFFFF'], 'bold' => true]
        ];

        $tableHeaderStyle = [
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E5E7EB']],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]]
        ];

        $tableRowStyle = [
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]]
        ];

        // Set document properties
        $spreadsheet->getProperties()
            ->setCreator($exportedBy)
            ->setTitle('Dashboard Statistics Export')
            ->setSubject('Dashboard Statistics')
            ->setDescription('Dashboard statistics export for ' . $periodLabel);

        // Header information
        $sheet->setCellValue('A1', 'Dashboard Statistics Export');
        $sheet->setCellValue('A2', 'Exported By:');
        $sheet->setCellValue('B2', $exportedBy);
        $sheet->setCellValue('A3', 'Export Date:');
        $sheet->setCellValue('B3', $exportDate);
        $sheet->setCellValue('A4', 'Period:');
        $sheet->setCellValue('B4', $periodLabel);

        // Style header
        $sheet->getStyle('A1')->applyFromArray($headerStyle);

        // Statistics section
        $sheet->setCellValue('A6', 'Statistics');
        $sheet->getStyle('A6')->getFont()->setBold(true)->setSize(12);

        $sheet->setCellValue('A7', 'Pets in Range');
        $sheet->setCellValue('B7', $totalPets);

        $sheet->setCellValue('A8', 'In Progress');
        $sheet->setCellValue('B8', $inProgress);

        $sheet->setCellValue('A9', 'Completed');
        $sheet->setCellValue('B9', $completed);

        $sheet->setCellValue('A10', 'Revenue in Range');
        $sheet->setCellValue('B10', '₱' . number_format($revenue, 2));

        // Current Status section
        $currentRow = 12;
        $sheet->setCellValue('A' . $currentRow, 'Current Status - Active grooming sessions');
        $sheet->getStyle('A' . $currentRow)->getFont()->setBold(true)->setSize(12);
        $currentRow++;

        if (empty($currentStatusData)) {
            $sheet->setCellValue('A' . $currentRow, 'No active bookings');
            $currentRow++;
        } else {
            // Table headers
            $sheet->setCellValue('A' . $currentRow, 'Pet Name');
            $sheet->setCellValue('B' . $currentRow, 'Breed');
            $sheet->setCellValue('C' . $currentRow, 'RFID Tag');
            $sheet->setCellValue('D' . $currentRow, 'Owner Name');

            // Style table headers
            $sheet->getStyle('A' . $currentRow . ':D' . $currentRow)->applyFromArray($tableHeaderStyle);
            $currentRow++;

            // Table data
            foreach ($currentStatusData as $booking) {
                $sheet->setCellValue('A' . $currentRow, $booking['pet_name']);
                $sheet->setCellValue('B' . $currentRow, $booking['breed']);
                $sheet->setCellValue('C' . $currentRow, $booking['rfid']);
                $sheet->setCellValue('D' . $currentRow, $booking['owner_name']);

                // Style table rows
                $sheet->getStyle('A' . $currentRow . ':D' . $currentRow)->applyFromArray($tableRowStyle);
                $currentRow++;
            }
        }

        // Completed Today section
        $currentRow += 2; // Add some space
        $sheet->setCellValue('A' . $currentRow, 'Completed Today - Finished grooming sessions');
        $sheet->getStyle('A' . $currentRow)->getFont()->setBold(true)->setSize(12);
        $currentRow++;

        if (empty($completedStatusData)) {
            $sheet->setCellValue('A' . $currentRow, 'No completed bookings');
        } else {
            // Table headers
            $sheet->setCellValue('A' . $currentRow, 'Pet Name');
            $sheet->setCellValue('B' . $currentRow, 'Breed');
            $sheet->setCellValue('C' . $currentRow, 'RFID Tag');
            $sheet->setCellValue('D' . $currentRow, 'Owner Name');

            // Style table headers
            $sheet->getStyle('A' . $currentRow . ':D' . $currentRow)->applyFromArray($tableHeaderStyle);
            $currentRow++;

            // Table data
            foreach ($completedStatusData as $booking) {
                $sheet->setCellValue('A' . $currentRow, $booking['pet_name']);
                $sheet->setCellValue('B' . $currentRow, $booking['breed']);
                $sheet->setCellValue('C' . $currentRow, $booking['rfid']);
                $sheet->setCellValue('D' . $currentRow, $booking['owner_name']);

                // Style table rows
                $sheet->getStyle('A' . $currentRow . ':D' . $currentRow)->applyFromArray($tableRowStyle);
                $currentRow++;
            }
        }

        // Auto-size columns
        foreach (range('A', 'D') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }

        // Set headers for file download
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="dashboard_stats_' . date('Y-m-d') . '.xlsx"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $writer = new Xlsx($spreadsheet);
        $writer->save('php://output');

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}
?>