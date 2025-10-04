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

    // Get total count for pagination
    $countStmt = $db->prepare("
        SELECT COUNT(*) as total
        FROM bookings b
        JOIN pets p ON b.pet_id = p.id
        JOIN customers c ON p.customer_id = c.id
        WHERE DATE(b.check_in_time) = CURDATE()
        AND b.status IN ('checked-in', 'bathing')
    ");
    $countStmt->execute();
    $totalCount = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Get today's active bookings (check-in and bathing status) with pet and customer information
    $stmt = $db->prepare("
        SELECT
            b.id,
            b.pet_id,
            b.custom_rfid,
            b.status,
            b.check_in_time,
            p.name as pet_name,
            p.breed,
            c.name as owner_name
        FROM bookings b
        JOIN pets p ON b.pet_id = p.id
        JOIN customers c ON p.customer_id = c.id
        WHERE DATE(b.check_in_time) = CURDATE()
        AND b.status IN ('checked-in', 'bathing')
        ORDER BY b.check_in_time DESC
        LIMIT :limit OFFSET :offset
    ");
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $stmt->execute();
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Map status values for display
    $statusMapping = [
        'checked-in' => 'Waiting',
        'bathing' => 'In Progress',
        'grooming' => 'Grooming',
        'completed' => 'Ready'
    ];

    // Format the data for frontend
    $formattedBookings = array_map(function($booking) use ($statusMapping) {
        return [
            'id' => $booking['id'],
            'pet_name' => ucfirst($booking['pet_name']),
            'breed' => ucfirst($booking['breed']),
            'rfid' => $booking['custom_rfid'],
            'owner_name' => $booking['owner_name'],
            'status' => $statusMapping[$booking['status']] ?? $booking['status'],
            'check_in_time' => $booking['check_in_time']
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