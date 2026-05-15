## Findings
- The Swish booking itself was created successfully and a QR payload exists.
- The custom DanceVida email was sent once by the backend, but the screenshot shows WooCommerce also sends its own order email, which does not include the DanceVida QR.
- Swish payments are not being recorded in the unified payments table because the code inserts `status: "paid"`, while the database only allows `succeeded`, `refunded`, `failed`, and `pending`. This can also break admin/payment-history visibility.
- If Swish verification is called again for the same event, the current idempotency branch returns early and skips sending the DanceVida account/QR email again.

## Plan
1. **Make Swish payment recording valid and visible**
   - Update `verify-swish-payment` to store Swish rows with a database-valid status (`succeeded`).
   - Update `get-stripe-payments` mapping so both `succeeded` and any older `paid` rows display as paid in the admin payment view.

2. **Make the QR/account email reliable**
   - In `verify-swish-payment`, change the “already exists” event/course/ticket logic so it still sends the DanceVida confirmation email with QR/account link using the existing booking/ticket instead of returning silently.
   - Keep idempotency for ticket/booking creation, so duplicate backend calls do not create duplicate tickets.

3. **Improve email delivery diagnostics**
   - Make the Swish verifier log/send-email failures clearly instead of swallowing them silently.
   - Keep the purchase successful even if email sending fails, but return enough backend logs to debug immediately.

4. **Ensure QR renders in common email clients**
   - Keep the inline QR image in the custom DanceVida confirmation email.
   - Use the existing QR payload from the created/existing booking or ticket.
   - Keep the “Visa mina biljetter” / account link in the same email so it replaces the missing third email behavior.

5. **Deploy and verify**
   - Deploy the updated backend functions.
   - Check function logs after deployment and confirm the latest Swish booking has a QR payload and can trigger the DanceVida confirmation email path.