## What's happening in the screenshot

You're seeing two contradictory things at once:
- A red error toast at the top: *"Alla incheckningar för denna biljett har redan använts"*.
- A success dialog at the bottom: *"Incheckning lyckades!"* with *"Okänd medlem"*, *"Klippkort (flexibel biljett)"*, *"Klipp kvar: 0"*.

## Root cause

Two separate bugs in `src/pages/Scan.tsx`:

1. **Stale success dialog gets overwritten with error data.** When a scan errors, the code does `setLastResult(result)` (the error object), but does **not** close the success dialog if it's already open. The dialog keeps rendering, now reading the error result — which has no `member_name`, no `course_title`, no counters — so all the labels fall back to defaults: `'Okänd medlem'`, `'Klippkort (flexibel biljett)'`, `Klipp kvar: 0`. The success dialog isn't lying about a new success — it's a ghost dialog rendering empty error data with fallback strings.

2. **Same QR can be scanned twice through a small race window.** After a successful check-in:
   - `scanner.pause()` is async; the camera library can fire one more `onScan` before pause takes effect.
   - The `lastScannedCode` dedup catches identical codes, BUT after the user clicks OK the dedup is cleared and a 1.5s cooldown starts. If the QR is still pointed at the camera after that 1.5s, the *same* code is processed again — and now there are no check-ins left, so the DB returns `MAX_CHECKINS_REACHED`. The error toast fires, but the success dialog from the previous scan was never actually torn down cleanly (bug 1), producing the screenshot.

There's also a smaller "Okänd medlem" issue independent of the race:
- For course/standalone klippkort tickets, the DB function `check_in_with_qr` returns `member_name` from `profiles.full_name`. If that profile has no `full_name` set (legacy or admin-gifted account), it falls back to the literal string `'Okänd medlem'`. There's no email fallback.

## Fix

### 1. `src/pages/Scan.tsx` — one feedback at a time

- In `handleScan`, before doing anything, if `showSuccessDialog` is true, **ignore the new scan entirely** (the user hasn't dismissed the previous result yet). This is a hard guard against the camera race.
- On error path: always `setShowSuccessDialog(false)` and clear `lastResult` for the success Alert (or only render the Alert when the result is actually a success). This prevents the ghost dialog from ever showing error data.
- On success path: defensively reset state before opening the new dialog so nothing leaks between scans.
- Increase the post-confirm cooldown from 1500ms → 2500ms so the same QR can't be re-scanned in the same gesture, and during cooldown also block via the existing `scanCooldown` check (already in place).
- Reset `lastScannedCode` only after the cooldown ends, not at the start of `handleSuccessConfirm`. This stops "same QR scanned twice in a row" even if the user dismissed quickly.

### 2. `src/pages/Scan.tsx` — never render success dialog with non-success data

- Change the Dialog's `open` prop from `showSuccessDialog` to `showSuccessDialog && lastResult?.success === true`. Belt and suspenders: even if state gets weird, the dialog cannot render error data.

### 3. DB function `check_in_with_qr` — better name fallback

- For both the lesson branch and the course/ticket branch, change `COALESCE(v_member.full_name, 'Okänd medlem')` to `COALESCE(NULLIF(v_member.full_name, ''), NULLIF(v_member.email, ''), 'Okänd medlem')`.
- Event branch already does this via `attendee_names[0]`; keep as-is but also add email as the last fallback for consistency.

This is the only DB change. Done via a migration that `CREATE OR REPLACE`s the function — no schema change, no table touch.

## Out of scope

- No changes to the QR generation, ticket purchase, or RLS.
- No redesign of the success dialog beyond the guards above.
- No changes to admin/member ticket display.

## Verification

1. Scan a valid klippkort QR with 1 check-in left → success dialog shows correct name + title + "Klipp kvar: 0". No error toast.
2. Keep the QR in front of the camera, dismiss dialog → cooldown blocks; after cooldown, scanning the same QR again shows ONLY the red error ("Inga tillgängliga klipp" / "Alla incheckningar..."), no ghost success dialog.
3. Scan an event QR for an already-used booking → only the error appears, never a success dialog.
4. Check-in a member whose profile has no `full_name` set → name shows their email instead of "Okänd medlem".
5. Successful event check-in with `attendee_names` set → still shows attendee name + "Köpt av: ..." line as before.
