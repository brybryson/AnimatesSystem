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
        AND b.status = 'completed'
    ");
    $countStmt->execute();
    $totalCount = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Get today's completed bookings with pet and customer information
    $stmt = $db->prepare("
        SELECT
            b.id,
            b.pet_id,
            b.custom_rfid,
            b.status,
            b.check_in_time,
            b.actual_completion,
            p.name as pet_name,
            p.breed,
            c.name as owner_name
        FROM bookings b
        JOIN pets p ON b.pet_id = p.id
        JOIN customers c ON p.customer_id = c.id
        WHERE DATE(b.check_in_time) = CURDATE()
        AND b.status = 'completed'
        ORDER BY b.actual_completion DESC
        LIMIT :limit OFFSET :offset
    ");
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

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