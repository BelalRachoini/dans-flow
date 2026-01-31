

## Plan: Fix Course Level Validation Error

### Problem Identified
When saving an All-in-One course (or any course), you get "Kunde inte spara kurs" because the database has a check constraint on the `level` column that only accepts these exact values:
- `beginner`
- `intermediate`  
- `advanced`

The current form uses a free-text input field where users can type anything, but the database rejects any value that doesn't match the allowed options.

### Solution
Replace the free-text input with a dropdown selector that only shows the valid options. This ensures users can only select valid values.

### Changes Required

**File: `src/pages/Courses.tsx`**

1. **Update Zod schema** (line 43):
   - Change from open string validation to enum validation

2. **Update default value** (line 111):
   - Change from empty string `''` to a valid default like `'beginner'`

3. **Replace Input with Select** (lines 494-502):
   - Change the free-text input to a dropdown selector with the three valid options

### Technical Details

| Current Code | Issue |
|--------------|-------|
| `level: z.string().min(1)...` | Allows any text |
| `defaultValues: { level: '' }` | Empty string fails DB constraint |
| `<Input id="level" ...>` | Users can type invalid values |

| New Code | Fix |
|----------|-----|
| `level: z.enum(['beginner', 'intermediate', 'advanced'])` | Only valid values |
| `defaultValues: { level: 'beginner' }` | Valid default |
| `<Select>` with 3 options | Users pick from valid options only |

### UI Change

```text
Before:
┌──────────────────────────────────┐
│ Nivå                             │
│ [___________________________]    │  ← Free text input
│ e.g., Beginner, Intermediate...  │
└──────────────────────────────────┘

After:
┌──────────────────────────────────┐
│ Nivå                             │
│ [ Nybörjare              ▼ ]     │  ← Dropdown selector
│   ├─ Nybörjare                   │
│   ├─ Medel                       │
│   └─ Avancerad                   │
└──────────────────────────────────┘
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Courses.tsx` | Update Zod schema, default value, and replace Input with Select |

