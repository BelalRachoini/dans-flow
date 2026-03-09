

# QR Codes for Event Tickets — Current State & Improvement

## What Already Works
The system **already generates individual QR codes** per attendee per event date when tickets are purchased (both Stripe and Swish). Each `event_booking` row has a unique `qr_payload`, and both the **Biljetter** page and **Member Dashboard** show QR buttons for each booking.

## What's Missing
When a member buys **2 or 3 tickets**, each booking is created with an attendee name in `attendee_names`, but the dashboard and Biljetter page **don't clearly show which QR belongs to which person**. The member sees multiple identical-looking cards with the same event title and no attendee label.

## Plan

### 1. Show attendee name on each event booking card (`MemberDashboard.tsx`)
- Parse `attendee_names` (JSON array) from each booking
- Display the attendee's name prominently on the card (e.g., "For: Maria Garcia")
- This helps the buyer identify which QR to show for each person at check-in

### 2. Show attendee name in the QR modal (`MemberDashboard.tsx`)
- When the QR modal opens for an event booking, display the attendee name below the event title
- Makes it unmistakable whose QR is being displayed

### 3. Show attendee name on event booking cards in Biljetter page (`Biljetter.tsx`)
- Same improvement: parse and display attendee name on each event ticket card
- The Biljetter page already renders event bookings with QR — just needs the attendee label

### Files Changed
- `src/pages/MemberDashboard.tsx` — add attendee name to event booking cards and QR modal
- `src/pages/Biljetter.tsx` — add attendee name to event ticket cards

