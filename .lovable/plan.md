

# Replace Payment Method Icons with Actual Brand Icons

All 4 purchase dialogs currently use generic lucide icons (`CreditCard` for Kort, `Smartphone` for Swish). The plan is to replace these with actual brand-recognizable icons.

## Changes

1. **Create a Swish SVG icon component** (`src/components/icons/SwishIcon.tsx`) using the official Swish logo mark as an inline SVG.

2. **Create a card/Visa-style icon component** (`src/components/icons/CardIcon.tsx`) — or keep the existing `CreditCard` lucide icon since it already looks like a card. Will use a more recognizable card brand icon if preferred.

3. **Update 4 files** to import and use the new icons:
   - `EventTicketPurchaseDialog.tsx`
   - `StandaloneTicketPurchaseDialog.tsx`
   - `LessonBookingDialog.tsx`
   - `BundlePurchaseWizard.tsx`

Each file: replace `<Smartphone className="h-4 w-4" />` with `<SwishIcon className="h-4 w-4" />` and optionally replace `<CreditCard>` with a better card icon.

**Scope**: 1 new icon component + 4 modified dialogs (single-line changes each).

