<?php
// Auto-cancel overdue appointments script
// This script should be called by a cron job every few minutes/hours
// Example cron job: */15 * * * * php /path/to/auto_cancel_overdue.php

require_once __DIR__ . '/../config/database.php';

// Function to auto-cancel overdue appointments
function autoCancelOverdueAppointments() {
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

        // Log the results
        $logMessage = "[" . date('Y-m-d H:i:s') . "] Auto-cancelled {$cancelledCount} overdue appointments\n";
        if ($cancelledCount > 0) {
            $logMessage .= "Cancelled appointment IDs: " . implode(', ', array_column($overdueAppointments, 'id')) . "\n";
        }

        // Log to file (optional)
        file_put_contents('../logs/auto_cancel.log', $logMessage, FILE_APPEND);

        echo "Success: Auto-cancelled {$cancelledCount} overdue appointments\n";

    } catch(Exception $e) {
        $errorMessage = "[" . date('Y-m-d H:i:s') . "] Error auto-cancelling appointments: " . $e->getMessage() . "\n";
        file_put_contents('../logs/auto_cancel.log', $errorMessage, FILE_APPEND);
        echo "Error: " . $e->getMessage() . "\n";
    }
}

// Create logs directory if it doesn't exist
if (!file_exists('../logs')) {
    mkdir('../logs', 0755, true);
}

// Run the auto-cancellation
autoCancelOverdueAppointments();
?>