

# Add Password Reset Flow for Students

## Problem
There is no way for students to reset their password. The Auth page has no "Forgot Password" option, and there is no `/reset-password` route to handle the recovery link.

The backend already has a recovery email template (`auth-send-email` edge function handles `recovery` type), so we only need frontend changes.

## Changes

### 1. Add "Forgot Password" to Auth page (`src/pages/Auth.tsx`)
- Add a "Forgot password?" link below the login form
- When clicked, show an email input and call `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Show success message telling the user to check their email

### 2. Create Reset Password page (`src/pages/ResetPassword.tsx`)
- New page at `/reset-password`
- On load, detect `type=recovery` in the URL hash/params
- Show a form with "New Password" and "Confirm Password" fields
- Call `supabase.auth.updateUser({ password })` to set the new password
- Redirect to `/auth` on success

### 3. Add route in `src/App.tsx`
- Add `<Route path="/reset-password" element={<ResetPassword />} />` as a public route (outside auth guards, alongside `/auth`)

### 4. Add translations (`src/locales/en.ts`, `sv.ts`, `es.ts`)
- Add keys for: "Forgot password?", "Reset password", "Enter your email to receive a reset link", "Password reset successfully", "Back to login", etc.

## Flow
```text
Login page → "Forgot password?" → Enter email → Recovery email sent
→ User clicks link in email → /reset-password page → Enter new password → Redirected to login
```

