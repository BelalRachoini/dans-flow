

## Plan: Make Course Level Optional

### Current State
- The `level` column in the database is `NOT NULL` with a default value of `'beginner'`
- The Zod schema requires one of the three enum values
- The form defaults to `'beginner'`

### Solution Options

**Option A (Recommended): Keep database constraint, make UI optional**
Since the database has a sensible default (`beginner`), we can:
1. Make the Zod field optional with a fallback
2. Allow the user to leave it unselected (will use default)
3. Add a "No level specified" option in the dropdown

**Option B: Full optional (requires database change)**
Remove the NOT NULL constraint from the database and allow null values

### Recommended Approach (Option A)
This is simpler and maintains data integrity - every course will have a level, but admins don't need to think about it if they don't want to.

### Changes Required

**File: `src/pages/Courses.tsx`**

1. **Update Zod schema** (line 43):
```typescript
// Change from required to optional with nullable
level: z.enum(['beginner', 'intermediate', 'advanced']).optional().nullable(),
```

2. **Update default value** (line 111):
```typescript
// Change from 'beginner' to undefined
level: undefined,
```

3. **Update Select component** (~line 493-511):
Add a "None/Not specified" option that clears the selection:
```typescript
<Select
  value={watch('level') || ''}
  onValueChange={(value) => setValue('level', value === '' ? undefined : value as any)}
>
  <SelectTrigger id="level">
    <SelectValue placeholder="Välj nivå (valfritt)" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">Ingen nivå angiven</SelectItem>
    <SelectItem value="beginner">{t.course.levelBeginner}</SelectItem>
    <SelectItem value="intermediate">{t.course.levelIntermediate}</SelectItem>
    <SelectItem value="advanced">{t.course.levelAdvanced}</SelectItem>
  </SelectContent>
</Select>
```

4. **Update form submission** (where data is sent to database):
When `level` is undefined/null, either:
- Don't include it in the insert (database will use default 'beginner')
- Or explicitly set it to 'beginner'

### UI Result

```text
┌──────────────────────────────────┐
│ Nivå (valfritt)                  │
│ [ Välj nivå (valfritt)     ▼ ]   │
│   ├─ Ingen nivå angiven          │  ← New option
│   ├─ Nybörjare                   │
│   ├─ Medel                       │
│   └─ Avancerad                   │
└──────────────────────────────────┘
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Courses.tsx` | Update schema to optional, update default, add empty option to Select |

