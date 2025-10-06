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

    // Get pagination parameters
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 6;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

    // Get filter parameters
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

    // Get total count for pagination
    $countStmt = $db->prepare("
        SELECT COUNT(*) as total
        FROM appointments a
        JOIN pets p ON a.pet_id = p.id
        LEFT JOIN users u ON a.user_id = u.id
        WHERE $dateCondition
        AND a.status = 'completed'
        AND a.check_in_time IS NOT NULL
    ");
    if (!empty($params)) {
        $countStmt->execute($params);
    } else {
        $countStmt->execute();
    }
    $totalCount = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Get completed appointments with pet and owner information
    $stmt = $db->prepare("
        SELECT
            a.id,
            a.pet_id,
            a.custom_rfid,
            a.status,
            a.check_in_time,
            a.updated_at as completion_time,
            p.name as pet_name,
            p.breed,
            u.full_name as owner_name
        FROM appointments a
        JOIN pets p ON a.pet_id = p.id
        LEFT JOIN users u ON a.user_id = u.id
        WHERE $dateCondition
        AND a.status = 'completed'
        AND a.check_in_time IS NOT NULL
        ORDER BY a.updated_at DESC
        LIMIT :limit OFFSET :offset
    ");
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    if (!empty($params)) {
        $stmt->execute(array_merge($params, [$limit, $offset]));
    } else {
        $stmt->execute();
    }

    $stmt->execute();
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Format the data for frontend
    $formattedBookings = array_map(function($booking) {
        return [
            'id' => $booking['id'],
            'pet_name' => ucfirst($booking['pet_name']),
            'breed' => ucfirst($booking['breed']),
            'rfid' => $booking['custom_rfid'],
            'owner_name' => $booking['owner_name'],
            'status' => 'Completed',
            'check_in_time' => $booking['check_in_time'],
            'completion_time' => $booking['actual_completion']
        ];
    }, $bookings);

    echo json_encode([
        'success' => true,
        'data' => $formattedBookings,
        'pagination' => [
            'total' => (int)$totalCount,
            'limit' => $limit,
            'offset' => $offset,
            'has_more' => ($offset + $limit) < $totalCount
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