

## Plan: Fix Schedule Page Desktop Responsiveness

### Problem
The schedule page week view has a fixed minimum width (`min-w-[768px]`) and each day column has `min-w-32` (128px), causing horizontal overflow on desktop when the sidebar is present. The total width exceeds the available space.

### Solution
Remove the minimum width constraint and make the table fully responsive by using percentage-based widths instead of fixed minimum widths.

### Changes Required

**File: `src/pages/Schema.tsx`**

**1. Week View Container (lines 556-557)**
```typescript
// Before
<div className="overflow-x-auto">
  <div className="min-w-[768px]">

// After
<div className="overflow-hidden">
  <div className="w-full">
```

**2. Day Column Headers (line 570)**
```typescript
// Before
className={`p-2 text-center border-r last:border-r-0 min-w-32 ${...}`}

// After  
className={`p-2 text-center border-r last:border-r-0 ${...}`}
```

### Summary

| Location | Change |
|----------|--------|
| Line 556 | Change `overflow-x-auto` to `overflow-hidden` |
| Line 557 | Change `min-w-[768px]` to `w-full` |
| Line 570 | Remove `min-w-32` from day column headers |

This will make the week view table use 100% of the available width and distribute columns evenly, preventing horizontal overflow while maintaining the same visual layout.

