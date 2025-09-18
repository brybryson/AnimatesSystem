# Discount Receipt Fix - Animates PH

## Problem Description
The receipt email system was not properly displaying discounts applied to payments. Even when discounts were applied, the receipt showed:
- Discount: ₱0
- No visual indication of the applied discount
- Incorrect total calculations

## Root Cause
1. **Database Query Issue**: The email receipt query was not properly joining with the `sales_transactions` table to get the discount amount
2. **Missing Column**: The `sales_transactions` table might be missing the `discount_amount` column
3. **Display Logic**: The receipt HTML was not properly formatting and highlighting discount information

## Files Fixed

### 1. `includes/send_receipt.php`
- Fixed database query to properly join with `sales_transactions` table
- Added `COALESCE()` to handle NULL discount values
- Improved discount display with visual highlighting
- Added discount summary box at the top of the receipt
- Fixed total calculation to properly subtract discount before adding tax

### 2. `api/billing.php`
- Fixed print receipt section to properly display discounts
- Added proper discount calculation for print receipts
- Improved HTML formatting for discount display

### 3. Database Structure
- Created migration script to ensure `sales_transactions` table has proper structure
- Added `discount_amount` column if missing
- Created proper indexes for performance

## How to Test

### Step 1: Check Database Structure
Run the database check script:
```bash
# Navigate to your project directory
cd /c/xampp/htdocs/animates

# Run the database check
php tests/check_sales_transactions.php
```

### Step 2: Test Discount Receipt Generation
Run the discount test script:
```bash
php tests/test_discount_receipt.php
```

This will:
- Verify the database structure
- Create a test transaction with discount if none exist
- Test receipt generation
- Verify discount calculations

### Step 3: Check Email Receipt
After running the test, check your email for a receipt that should now show:
- 🎉 Discount Applied! box at the top
- Proper discount amount in the payment details
- Correct total calculation
- Visual highlighting of the discount

## Expected Results

### Before Fix
```
Subtotal: ₱750
Discount: ₱0
Tax (12%): ₱90
Total: ₱840
```

### After Fix
```
🎉 Discount Applied!
You saved ₱100 on this transaction!

Subtotal: ₱750
Discount Applied: -₱100
Tax (12%): ₱90
Total: ₱740
```

## Database Schema

The `sales_transactions` table should have this structure:
```sql
CREATE TABLE sales_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    transaction_reference VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_platform VARCHAR(50),
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
);
```

## Troubleshooting

### If discounts still show as ₱0:
1. Check if the `sales_transactions` table has the `discount_amount` column
2. Verify that payments are being processed with the correct discount amount
3. Check the billing API logs for any errors

### If receipts are not being sent:
1. Verify SMTP configuration in `send_receipt.php`
2. Check email server logs
3. Ensure the customer has a valid email address

### If calculations are wrong:
1. Verify the discount amount is being stored correctly in the database
2. Check the tax calculation (currently set to 12%)
3. Ensure the total calculation follows: `subtotal - discount + tax`

## Files Created/Modified

### New Files:
- `tests/check_sales_transactions.php` - Database structure verification
- `tests/test_discount_receipt.php` - Discount receipt testing
- `migrations/fix_sales_transactions_discount.sql` - Database migration
- `DISCOUNT_RECEIPT_FIX_README.md` - This documentation

### Modified Files:
- `includes/send_receipt.php` - Fixed discount display and calculations
- `api/billing.php` - Fixed print receipt discount display

## Next Steps

1. **Test the system** with the provided test scripts
2. **Verify email receipts** are being sent with proper discount display
3. **Check print receipts** show discounts correctly
4. **Monitor production** to ensure discounts are working for real payments

## Support

If you encounter any issues:
1. Check the test scripts output for error messages
2. Verify database connectivity and table structure
3. Check PHP error logs for any runtime errors
4. Ensure all required dependencies are installed (PHPMailer, etc.)

