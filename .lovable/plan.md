

## Plan: Allow Admins to Remove Tickets from Members

### Overview
Add the ability for admins to deduct/remove tickets from a member's ticket balance. This will be the counterpart to the existing "Give Tickets" feature in the member detail drawer.

### How It Will Work

**For Admins:**
- In the Quick Actions section of the member drawer, a new "Remove Tickets" section will appear next to "Give Tickets"
- Admin enters the number of tickets to remove and optionally a reason/note
- The system deducts tickets using FIFO logic (from the package expiring soonest first)
- A confirmation message shows how many tickets were removed

### Implementation Details

#### 1. Database Function: `admin_remove_tickets`

Create a new RPC function that:
- Validates the caller is an admin
- Validates the ticket count (1-50)
- Finds available ticket packages for the member (ordered by expiry date)
- Deducts tickets using FIFO logic across multiple packages if needed
- Records a note about the removal (optional)
- Returns summary of removed tickets

```sql
CREATE OR REPLACE FUNCTION public.admin_remove_tickets(
  p_member_id uuid,
  p_ticket_count integer,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
```

The function will:
1. Loop through ticket packages ordered by `expires_at ASC`
2. Increment `tickets_used` on each package until the requested amount is removed
3. Mark packages as 'used' when fully consumed
4. Return error if member doesn't have enough available tickets

#### 2. Frontend Changes: `MemberDetailDrawer.tsx`

Add a new "Remove Tickets" section in the Quick Actions area:

```text
┌─────────────────────────────────────────────────────────────┐
│ Quick Actions                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Give Tickets]              [Remove Tickets]               │
│  ┌────────────┐              ┌────────────┐                │
│  │ Count: [5] │              │ Count: [3] │                │
│  │ [Give]     │              │ [Remove]   │                │
│  └────────────┘              └────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**State additions:**
- `removeTicketCount: string` - Number of tickets to remove
- `removeTicketReason: string` - Optional reason

**New mutation:**
- `removeTicketsMutation` - Calls the `admin_remove_tickets` RPC

#### 3. Translation Updates

Add new keys for the remove tickets feature:

| Key | Swedish | English | Spanish |
|-----|---------|---------|---------|
| `removeTickets` | Ta bort klipp | Remove tickets | Eliminar entradas |
| `ticketsRemoved` | {count} klipp har tagits bort! | {count} tickets removed! | ¡{count} entradas eliminadas! |
| `removeReason` | Anledning (valfritt) | Reason (optional) | Razón (opcional) |
| `notEnoughTickets` | Medlemmen har inte tillräckligt med klipp | Member doesn't have enough tickets | El miembro no tiene suficientes entradas |

### Technical Flow

```text
Admin clicks "Remove"
       ↓
Frontend calls supabase.rpc('admin_remove_tickets', {...})
       ↓
Database function checks:
  - Is caller admin? (via is_admin())
  - Is count valid? (1-50)
  - Does member have enough available tickets?
       ↓
FIFO ticket deduction:
  - Find packages with remaining tickets (ordered by expires_at)
  - Loop and increment tickets_used until count is reached
  - Update status to 'used' when package is exhausted
       ↓
Return success with count removed
       ↓
Frontend shows toast and refreshes ticket list
```

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Database migration | Create | Add `admin_remove_tickets` RPC function |
| `src/components/MemberDetailDrawer.tsx` | Modify | Add remove tickets UI and mutation |
| `src/locales/sv.ts` | Modify | Add Swedish translations |
| `src/locales/en.ts` | Modify | Add English translations |
| `src/locales/es.ts` | Modify | Add Spanish translations |

### Security Considerations

- The function uses `SECURITY DEFINER` to ensure only admins can execute it
- Validates admin status using the existing `is_admin()` helper
- Validates input parameters to prevent abuse
- Returns clear error messages for validation failures

