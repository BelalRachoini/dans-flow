
## Plan: Fix White Blank Page Issue on Biljetter Page

### Problem Identified

After reviewing the code, I found that the Biljetter (Tickets) page can show a white blank screen because several async functions lack proper error handling. When an unhandled error occurs in an async function, React cannot catch it with error boundaries, causing the entire application to crash and show a blank white screen.

### Root Causes

1. **Multiple async functions without try...catch blocks:**
   - `loadAdminCourses()` - No error handling
   - `loadAdminEvents()` - No error handling  
   - `loadCourseAttendees()` - Errors logged but not caught at top level
   - `loadPackageClassesAttendance()` - Same issue
   - `loadEventAttendees()` - Same issue
   - `setupRealtimeSubscription()` - No try...catch around `supabase.auth.getUser()`

2. **useEffect hooks calling async functions without catching errors** - If any of these fail, the error is unhandled

3. **No global unhandled rejection handler** - Nothing catches async errors that slip through

### Solution

#### 1. Add Try...Catch to All Async Functions in Biljetter.tsx

Wrap all async functions with proper error handling:

```typescript
const loadAdminCourses = async () => {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('...')
      .order('starts_at', { ascending: false });
    
    if (error) throw error;
    setCourses(data || []);
  } catch (error) {
    console.error('Error loading courses:', error);
    // Don't crash - just show empty state
    setCourses([]);
  }
};
```

Apply this pattern to:
- `loadAdminCourses()`
- `loadAdminEvents()`
- `loadCourseAttendees()`
- `loadPackageClassesAttendance()`
- `loadEventAttendees()`
- `setupRealtimeSubscription()`

#### 2. Add Global Unhandled Rejection Handler in App.tsx

Add a safety net to catch any async errors that slip through:

```typescript
useEffect(() => {
  const handleRejection = (event: PromiseRejectionEvent) => {
    console.error("Unhandled rejection:", event.reason);
    toast.error("An error occurred. Please try again.");
    event.preventDefault();
  };

  window.addEventListener("unhandledrejection", handleRejection);
  return () => window.removeEventListener("unhandledrejection", handleRejection);
}, []);
```

#### 3. Fix Realtime Subscription Cleanup

The current code has a subtle bug where the cleanup function isn't properly returned:

```typescript
// Current (buggy)
useEffect(() => {
  const setupRealtimeSubscription = async () => {
    // ...
    return () => { supabase.removeChannel(channel); };
  };
  setupRealtimeSubscription(); // Return value ignored!
}, []);

// Fixed
useEffect(() => {
  let channel: any;
  
  const setup = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;
      
      channel = supabase.channel('tickets_updates')
        // ...subscriptions
        .subscribe();
    } catch (error) {
      console.error('Error setting up realtime:', error);
    }
  };
  
  setup();
  
  return () => {
    if (channel) supabase.removeChannel(channel);
  };
}, []);
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Biljetter.tsx` | Add try...catch to all async functions, fix realtime cleanup |
| `src/App.tsx` | Add global unhandled rejection handler |

### Technical Details

**Affected Functions in Biljetter.tsx:**

| Function | Line | Issue | Fix |
|----------|------|-------|-----|
| `loadAdminCourses` | 543 | No error handling | Add try...catch |
| `loadAdminEvents` | 554 | No error handling | Add try...catch |
| `loadCourseAttendees` | 565 | Partial error handling | Wrap entire function |
| `loadPackageClassesAttendance` | 642 | Partial error handling | Wrap entire function |
| `loadEventAttendees` | 831 | Partial error handling | Wrap entire function |
| `setupRealtimeSubscription` | 171 | No try...catch, bad cleanup | Full rewrite |

### Expected Result

After these changes:
- Errors in data fetching will be caught and logged
- The page will show empty states instead of crashing
- Users will see helpful error messages via toast notifications
- The global handler prevents any remaining async errors from causing white screens
