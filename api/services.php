<?php
require_once '../config/database.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    $db = getDB();
    
    switch($method) {
        case 'GET':
            if ($action === 'get_services') {
                getServicesWithPricing($db);
            } elseif ($action === 'get_pet_sizes') {
                getPetSizes($db);
            } else {
                throw new Exception('Invalid action');
            }
            break;
        default:
            throw new Exception('Method not allowed');
    }
    
} catch(Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function getServicesWithPricing($db) {
    try {
        // Use services2 table directly since we know it has the correct structure
        $query = "
            SELECT
                s.id,
                s.name,
                s.description,
                s.category,
                s.is_size_based,
                s.base_price,
                sp.pet_size,
                sp.price
            FROM services2 s
            LEFT JOIN service_pricing sp ON s.id = sp.service_id
            WHERE s.status = 'active'
            ORDER BY
                FIELD(s.category, 'basic', 'premium', 'addon'),
                s.id,
                FIELD(sp.pet_size, 'small', 'medium', 'large', 'extra_large')
        ";

        $stmt = $db->prepare($query);
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Group services and their pricing
        $services = [];
        foreach ($results as $row) {
            $serviceId = $row['id'];

            if (!isset($services[$serviceId])) {
                $services[$serviceId] = [
                    'id' => $row['id'],
                    'name' => $row['name'],
                    'description' => $row['description'],
                    'category' => $row['category'],
                    'is_size_based' => (bool)$row['is_size_based'],
                    'base_price' => isset($row['base_price']) ? floatval($row['base_price']) : 0,
                    'pricing' => []
                ];
            }

            if ($row['pet_size'] && $row['price']) {
                $services[$serviceId]['pricing'][$row['pet_size']] = floatval($row['price']);
            }
        }

        // Check inventory availability for each service
        $servicesWithInventory = checkServiceInventoryAvailability($db, $services);

        // Convert to indexed array grouped by category
        $groupedServices = [
            'basic' => [],
            'package' => [],
            'addon' => []
        ];

        foreach ($servicesWithInventory as $service) {
            $groupedServices[$service['category']][] = $service;
        }

        echo json_encode([
            'success' => true,
            'services' => $groupedServices
        ]);

    } catch(Exception $e) {
        throw new Exception('Failed to fetch services: ' . $e->getMessage());
    }
}

function getPetSizes($db) {
    try {
        $query = "SELECT * FROM pet_sizes ORDER BY sort_order, id";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $petSizes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'pet_sizes' => $petSizes
        ]);

    } catch(Exception $e) {
        throw new Exception('Failed to fetch pet sizes: ' . $e->getMessage());
    }
}

function checkServiceInventoryAvailability($db, $services) {
    // Define service-to-inventory mappings
    $serviceInventoryMap = [
        // Basic Services
        'Bath & Dry' => ['Premium Shampoo'],
        'Nail Trimming & Grinding' => ['Professional Nail Clippers', 'Nail Grinding File'],
        'Ear Cleaning & Inspection' => ['Cotton Swabs', 'Ear Cleaning Solution'],
        'Haircut & Styling' => ['Clipper Machine', 'Professional Shears Set'],
        'Teeth Cleaning' => ['Dental Cleaning Solution', 'Pet Toothbrush Set'],
        'De-shedding Treatment' => ['De-shedding Shampoo'],

        // Add-Ons
        'Extra Nail Polish' => ['Nail Polish - Clear'],
        'Scented Cologne' => ['Scented Cologne'],
        'Bow or Bandana' => ['Decorative Bows Set', 'Bandana Set'],
        'Paw Balm' => ['Paw Balm'],
        'Whitening Shampoo' => ['Whitening Shampoo'],
        'Flea & Tick Treatment' => ['Flea & Tick Spray'],

        // Packages (will be checked based on their included services)
        'Essential Grooming Package' => ['Premium Shampoo', 'Professional Nail Clippers', 'Cotton Swabs', 'Ear Cleaning Solution'],
        'Full Grooming Package' => ['Premium Shampoo', 'Clipper Machine', 'Professional Shears Set', 'Professional Nail Clippers', 'Cotton Swabs', 'Ear Cleaning Solution', 'Dental Cleaning Solution', 'Pet Toothbrush Set', 'De-shedding Shampoo'],
        'Bath & Brush Package' => ['Premium Shampoo', 'De-shedding Shampoo'],
        'Spa Relaxation Package' => ['Premium Shampoo', 'Paw Balm', 'Scented Cologne']
    ];

    // Get all inventory items
    $stmt = $db->prepare("SELECT name, quantity FROM inventory");
    $stmt->execute();
    $inventoryItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Create inventory lookup array
    $inventoryLookup = [];
    foreach ($inventoryItems as $item) {
        $inventoryLookup[$item['name']] = $item['quantity'];
    }

    // Check each service
    foreach ($services as &$service) {
        $serviceName = $service['name'];
        $requiredItems = $serviceInventoryMap[$serviceName] ?? [];

        $service['available'] = true;
        $service['unavailable_reason'] = '';
        $service['out_of_stock_items'] = [];

        if (!empty($requiredItems)) {
            foreach ($requiredItems as $itemName) {
                if (!isset($inventoryLookup[$itemName]) || $inventoryLookup[$itemName] <= 0) {
                    $service['available'] = false;
                    $service['out_of_stock_items'][] = $itemName;
                }
            }

            if (!$service['available']) {
                $outOfStockList = implode(', ', $service['out_of_stock_items']);
                $service['unavailable_reason'] = "Out of stock: {$outOfStockList}";
            }
        }
    }

    return $services;
}
?>