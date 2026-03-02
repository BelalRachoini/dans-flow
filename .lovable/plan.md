

# Fix Swish Button Orange Background

The orange background may not be applying correctly because `tailwind-merge` could be handling the class conflict between the outline variant's `bg-background` and the dynamic `bg-orange-500` unpredictably.

## Root Cause

The Button component uses `cn(buttonVariants({ variant, size, className }))` where `tailwind-merge` resolves conflicting utility classes. While it *should* let `bg-orange-500` override `bg-background`, there may be edge cases or the preview may need a refresh.

## Fix (4 files)

In all 4 dialogs, instead of relying on className to override variant styles, conditionally set `variant="default"` vs `variant="outline"` **and** apply orange classes using inline `style` or use the `!important` modifier:

- `src/components/EventTicketPurchaseDialog.tsx`
- `src/components/StandaloneTicketPurchaseDialog.tsx`
- `src/components/LessonBookingDialog.tsx`
- `src/components/BundlePurchaseWizard.tsx`

Change the Swish button from:
```tsx
<Button variant="outline" className={`gap-2 ${paymentMethod === 'swish' ? 'bg-orange-500 ...' : ''}`}>
```
To:
```tsx
<Button variant="outline" className="gap-2" style={paymentMethod === 'swish' ? { backgroundColor: '#f97316', color: 'white', borderColor: '#f97316' } : {}} >
```

Using inline `style` guarantees it overrides any Tailwind class specificity issues.

