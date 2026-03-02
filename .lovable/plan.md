

# Make Swish Button Orange When Selected

Update the Swish payment method button to use an orange background (`bg-orange-500`) when selected, across all 4 purchase dialogs.

## Changes (4 files)

In each dialog, change the Swish button's selected variant from `variant="default"` to explicit orange styling:

- `src/components/EventTicketPurchaseDialog.tsx`
- `src/components/StandaloneTicketPurchaseDialog.tsx`
- `src/components/LessonBookingDialog.tsx`
- `src/components/BundlePurchaseWizard.tsx`

Replace the Swish `<Button>` so that when `paymentMethod === 'swish'`, it uses `className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"` with `variant="outline"` base, instead of `variant="default"`.

