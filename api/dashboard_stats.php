<?php
require_once '../config/database.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    $db = getDB();
    $period = $_GET['period'] ?? 'today';

    // Build date condition based on period
    $dateCondition = '';
    switch ($period) {
        case 'today':
            $dateCondition = "DATE(b.check_in_time) = CURDATE()";
            break;
        case 'week':
            $dateCondition = "YEARWEEK(b.check_in_time, 1) = YEARWEEK(CURDATE(), 1)";
            break;
        case 'month':
            $dateCondition = "YEAR(b.check_in_time) = YEAR(CURDATE()) AND MONTH(b.check_in_time) = MONTH(CURDATE())";
            break;
        case 'year':
            $dateCondition = "YEAR(b.check_in_time) = YEAR(CURDATE())";
            break;
        default:
            $dateCondition = "DATE(b.check_in_time) = CURDATE()";
    }

    // Total pets (count of bookings within the period)
    $stmt = $db->prepare("
        SELECT COUNT(*) as total
        FROM bookings b
        WHERE $dateCondition
    ");
    $stmt->execute();
    $totalPets = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    // In progress (count of bookings where status = 'bathing' and check_in_time matches period)
    $stmt = $db->prepare("
        SELECT COUNT(*) as total
        FROM bookings b
        WHERE b.status = 'bathing'
        AND $dateCondition
    ");
    $stmt->execute();
    $inProgress = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Completed (count of bookings where status = 'completed' and check_in_time matches period)
    $stmt = $db->prepare("
        SELECT COUNT(*) as total
        FROM bookings b
        WHERE b.status = 'completed'
        AND $dateCondition
    ");
    $stmt->execute();
    $completed = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Revenue (sum of total_amount for completed bookings where check_in_time matches period)
    $stmt = $db->prepare("
        SELECT COALESCE(SUM(b.total_amount), 0) as revenue
        FROM bookings b
        WHERE b.status = 'completed'
        AND $dateCondition
    ");
    $stmt->execute();
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
?>