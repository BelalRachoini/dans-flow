

## Plan: All-in-One Course Bundle System

### Overview
Create a new "All-in-One" course type that allows admins to bundle multiple package tiers under one course. Members see a step-by-step wizard to choose their tier, then select their classes, and checkout.

### How It Works

**For Admins:**
- Create an "All-in-One" course with flexible custom-named tiers (e.g., "Basic - 1 class", "Standard - 2 classes", "Premium - 3 classes")
- Each tier has its own name, price, and max class selections
- Admin can choose whether each tier shares the same class pool OR has tier-specific classes

**For Members:**
- Step 1: View available tiers as cards, select one
- Step 2: Select classes (up to the tier's max)
- Step 3: Proceed to checkout

### Database Changes

**New table: `course_bundle_tiers`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| course_id | uuid | FK to courses |
| name | text | Tier name (e.g., "Gold", "1 klass") |
| price_cents | integer | Price for this tier |
| max_selections | integer | How many classes customer can pick |
| position | integer | Display order |
| class_filter_mode | text | "all" = shared pool, "specific" = tier-specific |
| created_at | timestamp | Created timestamp |

**New table: `course_bundle_tier_classes`** (for tier-specific class filtering)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tier_id | uuid | FK to course_bundle_tiers |
| class_id | uuid | FK to course_classes |

**Modify `courses` table:**
- Add `course_type` column: 'regular' | 'package' | 'bundle'
- This replaces the `is_package` boolean for cleaner logic

### Frontend Changes

**1. Admin: Course Form (Courses.tsx)**
- Add course type selector: "Standard", "Paket", "All-in-One"
- When "All-in-One" selected, show tier management section:
  - Add/remove tiers
  - For each tier: name, price, max selections
  - Option per tier: "Use all classes" or "Specific classes" with multi-select

**2. New Component: `BundleTierManager.tsx`**
Admin interface for managing tiers within a bundle course:
- List of tiers with drag-to-reorder
- Edit tier inline (name, price, max_selections)
- Delete tier with confirmation
- Toggle class filter mode per tier

**3. New Component: `BundlePurchaseWizard.tsx`**
Member-facing step wizard:
- **Step 1**: Display tiers as attractive cards with:
  - Tier name and price
  - "X classes included" badge
  - "Most popular" badge (optional, set by admin)
  - Select button
- **Step 2**: Class selection (reuses existing `PackageClassSelector`)
- **Step 3**: Summary and "Proceed to Payment" button

**4. Modify `CourseSectionRenderer.tsx`**
- Update booking section to detect bundle courses
- Render `BundlePurchaseWizard` instead of simple booking for bundle type

**5. Edge Function Updates**

**`create-course-payment/index.ts`:**
- Accept `tier_id` in request body for bundle purchases
- Fetch tier's price instead of course's base price
- Store `tier_id` in Stripe metadata

**`verify-course-payment/index.ts`:**
- Read `tier_id` from metadata
- Create class selections based on tier's max_selections
- Use tier-specific or shared classes based on tier config

### User Experience Flow

**Admin Creating a Bundle:**
```text
1. Create course → Select "All-in-One"
2. Add Tier: "Bronze" - 500kr - 1 class
3. Add Tier: "Silver" - 800kr - 2 classes  
4. Add Tier: "Gold" - 1000kr - 3 classes
5. For each tier, choose: All classes OR pick specific classes
6. Add classes to the course (as with regular packages)
7. Publish
```

**Member Purchasing:**
```text
Step 1: Välj ditt paket
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    Bronze       │ │    Silver       │ │     Gold        │
│    500 kr       │ │    800 kr       │ │   1 000 kr      │
│   1 klass       │ │   2 klasser     │ │   3 klasser     │
│  [ Välj ]       │ │ ⭐ Populär     │ │   [ Välj ]      │
└─────────────────┘ │  [ Välj ]       │ └─────────────────┘
                    └─────────────────┘

Step 2: Välj dina klasser
[Reuses PackageClassSelector with tier's max_selections]

Step 3: Sammanfattning
- Paket: Silver (2 klasser)
- Valda klasser: Salsa Måndag, Bachata Tisdag
- Totalt: 800 kr
[Fortsätt till betalning]
```

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Database migration | Create | Add `course_bundle_tiers` and `course_bundle_tier_classes` tables |
| `src/components/BundleTierManager.tsx` | Create | Admin tier management UI |
| `src/components/BundlePurchaseWizard.tsx` | Create | Member purchase wizard |
| `src/pages/Courses.tsx` | Modify | Add course type selector, tier management section |
| `src/components/CourseSectionRenderer.tsx` | Modify | Detect bundle and render wizard |
| `supabase/functions/create-course-payment/index.ts` | Modify | Handle tier selection and pricing |
| `supabase/functions/verify-course-payment/index.ts` | Modify | Handle tier-based class selections |
| `src/integrations/supabase/types.ts` | Auto-update | Will update automatically |

### Implementation Order

1. **Database**: Create tables and RLS policies
2. **Admin UI**: Course type selector + BundleTierManager
3. **Member UI**: BundlePurchaseWizard component
4. **Integration**: Update CourseSectionRenderer booking section
5. **Payment**: Modify edge functions for tier-based pricing
6. **Testing**: End-to-end flow verification

