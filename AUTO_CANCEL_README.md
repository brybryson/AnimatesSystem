# Automatic Appointment Cancellation System

This system automatically cancels appointments that are still in "scheduled" status and have passed the business closing time (5:00 PM) without being admitted.

## How It Works

1. **Manual Admit**: Staff can still manually admit appointments even after the scheduled time
2. **Auto-Cancellation**: Appointments that reach 5:00 PM without being admitted are automatically cancelled
3. **System Tracking**: Auto-cancelled appointments are marked with:
   - `cancelled_by`: 0 (system user)
   - `cancelled_by_name`: "System"
   - `cancellation_remarks`: "Customer did not arrive"

## Files

- `api/appointments.php`: Contains the `handleAutoCancelOverdueAppointments()` function
- `api/auto_cancel_overdue.php`: Standalone script for cron job execution

## Setup Cron Job

To run the auto-cancellation every 15 minutes, add this to your crontab:

```bash
*/15 * * * * /usr/bin/php /path/to/your/project/api/auto_cancel_overdue.php
```

For XAMPP on macOS, the command would be:
```bash
*/15 * * * * /Applications/XAMPP/xamppfiles/bin/php /Applications/XAMPP/xamppfiles/htdocs/animates/api/auto_cancel_overdue.php
```

## Business Logic

### Admit Rules:
- **Future dates**: Cannot be admitted
- **Past dates**: Can be admitted anytime
- **Today**: Can only be admitted at or after the scheduled appointment time

### Auto-Cancel Rules:
- Appointments must be in "scheduled" status
- Appointment date must be today or earlier
- Current time must be 5:00 PM or later
- Only applies to appointments that haven't been admitted yet

## Testing

You can test the auto-cancellation by running:
```bash
php api/auto_cancel_overdue.php
```

## Logs

The system logs all auto-cancellation activities to `logs/auto_cancel.log`:
```
[2025-09-29 17:15:00] Auto-cancelled 2 overdue appointments
Cancelled appointment IDs: 123, 456
```

## API Endpoint

You can also trigger auto-cancellation manually via API:
```
POST /api/appointments.php
Content-Type: application/json
Authorization: Bearer <token>

{
  "action": "auto_cancel_overdue"
}
```

This requires staff/admin authentication.