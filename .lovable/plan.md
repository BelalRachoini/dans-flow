

## Plan: Hide Ticket Availability from Members on Events Page

### Overview
Hide the number of available tickets/capacity from regular members on the Events page and Event Detail page. This information will only be visible to admins.

### Current Behavior
Members currently see:
- On event cards: "Tickets available" + "X/Y capacity" text
- On event detail hero section: "X spots left"
- On event detail booking section: "X / Y spots available"

### Proposed Changes

The ticket availability information will be hidden from non-admin users while keeping the "Sold Out" indicator visible (so members know when events are full).

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Events.tsx` | Hide capacity numbers from members on event cards |
| `src/components/EventSectionRenderer.tsx` | Hide spots info in hero and booking sections for members |

### Technical Details

**1. Events.tsx (Event Card Display)**

Lines 998-1009 currently show:
```text
Tickets available
12/50 capacity
```

Will be changed to only show this for admins:
```text
[Admin view:]     [Member view:]
Tickets available  Tickets available (or "Sold Out")
12/50 capacity     (hidden)
```

**2. EventSectionRenderer.tsx**

This component needs to receive the user's role to conditionally hide capacity. Two sections affected:

- **Hero section** (line 55-58): The "X spots left" text will be hidden for non-admins
- **Booking section** (lines 188-192): The "X / Y spots available" line will be hidden for non-admins

### Implementation Approach

**Option 1 (Simple):** Use the `useAuthStore` hook directly in `EventSectionRenderer.tsx` to check user role

**Option 2:** Pass `isAdmin` as a prop from the parent components

I recommend **Option 1** since the component is already importing from other stores and this keeps the interface simpler.

### Visual Comparison

**Event Card - Before (Member View):**
```text
┌─────────────────────────────────┐
│ [Event Image]                   │
│ Salsa Night                     │
│ 📅 March 15, 2025               │
│ 🕐 19:00                        │
│ 📍 Dance Studio                 │
├─────────────────────────────────┤
│ 150 kr    Tickets available ✓  │
│           12/50 capacity        │  ← Hidden for members
└─────────────────────────────────┘
```

**Event Card - After (Member View):**
```text
┌─────────────────────────────────┐
│ [Event Image]                   │
│ Salsa Night                     │
│ 📅 March 15, 2025               │
│ 🕐 19:00                        │
│ 📍 Dance Studio                 │
├─────────────────────────────────┤
│ 150 kr    Tickets available ✓  │
│                                 │  ← Numbers hidden
└─────────────────────────────────┘
```

**Event Detail Hero - Before:**
```text
Salsa Night Party
📅 March 15, 2025 • 📍 Dance Studio • 👥 38 spots left
```

**Event Detail Hero - After (Member View):**
```text
Salsa Night Party
📅 March 15, 2025 • 📍 Dance Studio
```

### Summary of Changes

1. **`src/pages/Events.tsx`** (~line 1006-1008)
   - Wrap the capacity display (`{availableSeats}/{event.capacity}`) in an `isAdmin` conditional

2. **`src/components/EventSectionRenderer.tsx`**
   - Import `useAuthStore` hook
   - Add `isAdmin` check at component level
   - **Hero section** (~line 55-58): Hide "X spots left" for non-admins
   - **Booking section** (~line 188-192): Hide "X / Y spots available" for non-admins

