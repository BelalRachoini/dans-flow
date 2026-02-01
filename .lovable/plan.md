

## Plan: Fix Week View Glitch on Current Week (Desktop)

### Problem Identified

The Schedule page "glitches and zooms in" on desktop when viewing the weekly view on the current week. This is caused by a **hydration mismatch / layout shift** due to how the `useIsMobile` hook initializes.

### Root Cause Analysis

1. **`useIsMobile` Hook Issue (Line 6-18 in use-mobile.tsx)**:
   - The hook initializes `isMobile` as `undefined`
   - The return statement uses `!!isMobile` which converts `undefined` → `false`
   - **Problem**: On first render, before the `useEffect` runs, `isMobile` is `undefined` (treated as `false`)
   - Once the effect runs and detects the actual width, the state updates and causes a re-render
   
2. **Schema.tsx Rendering (Line 965)**:
   ```typescript
   {viewMode === 'week' && (isMobile ? renderWeekViewMobile() : renderWeekView())}
   ```
   - On initial render: `isMobile` is `undefined` → `!!undefined` = `false` → renders desktop view
   - After effect: `isMobile` updates to actual value (still `false` on desktop) → potentially triggers layout recalculation

3. **Table Width Calculation Issue**:
   - The week view table in `renderWeekView()` (lines 549-647) uses a fixed `w-20` for the time column and auto-expanding columns for days
   - When the component re-renders after the `isMobile` state settles, the browser may recalculate the table layout
   - Combined with `overflow-x: hidden` on body/html (index.css), this can cause a visual "zoom" effect as content reflows

4. **Current Week Effect**:
   - The "isToday" highlighting (lines 566, 571-573, 577, 601, 611) adds extra styling
   - This could trigger additional layout calculations specific to the current week

### Solution

Fix the `useIsMobile` hook to prevent the flash/glitch by:
1. Initializing with a server-safe default based on window check
2. Adding a loading state that prevents rendering mismatched layouts

Additionally, add a stable width to the week view table to prevent layout shifts.

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/use-mobile.tsx` | Fix initial state to prevent layout shift |
| `src/pages/Schema.tsx` | Add stable layout styling to prevent glitch during initial render |

### Implementation Details

#### 1. Fix `useIsMobile` Hook

**Current code (problematic):**
```typescript
const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
// ...
return !!isMobile;
```

**Fixed code:**
```typescript
// Initialize with actual value if window is available (client-side)
const [isMobile, setIsMobile] = useState<boolean>(() => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < MOBILE_BREAKPOINT;
  }
  return false; // SSR fallback
});
```

This ensures:
- The initial value is correct from the first render on client
- No flash/glitch from `undefined` → actual value transition
- No unnecessary re-render that triggers layout recalculation

#### 2. Stabilize Week View Layout in Schema.tsx

Add `table-fixed` class to the week view table to prevent dynamic column width recalculation:

**Current (line 559):**
```typescript
<table className="w-full border-collapse">
```

**Fixed:**
```typescript
<table className="w-full border-collapse table-fixed">
```

And add explicit widths to ensure columns don't shift:

**Time column header (line 562-563):**
```typescript
<th className="sticky left-0 bg-muted/30 w-16 min-w-[64px] p-2 ...">
```

### Why This Fixes The Issue

1. **No Initial State Transition**: By initializing `isMobile` with the actual window width value, there's no `undefined → boolean` transition that causes re-renders

2. **Stable Table Layout**: Using `table-fixed` prevents the browser from recalculating column widths based on content, eliminating the "zoom" effect

3. **Explicit Widths**: Adding `min-w-[64px]` ensures the time column maintains consistent width across renders

### Visual Before/After

**Before (Glitchy):**
```text
Render 1: isMobile = undefined → false → renders week view (columns auto-sizing)
Render 2: isMobile = false (confirmed) → re-renders → columns recalculate → GLITCH!
```

**After (Fixed):**
```text
Render 1: isMobile = false (from initialization) → renders week view (fixed columns)
No re-render needed → stable layout → NO GLITCH
```

