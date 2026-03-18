

# Replace Swish Icon with Uploaded Image

## Changes

1. **Copy uploaded image** to `src/assets/swish-logo.png`

2. **Rewrite `src/components/icons/SwishIcon.tsx`** to use the new image instead of the inline SVG:
   ```tsx
   import swishLogo from '@/assets/swish-logo.png';
   
   interface SwishIconProps {
     className?: string;
   }
   
   export const SwishIcon = ({ className }: SwishIconProps) => (
     <img src={swishLogo} alt="Swish" className={className} />
   );
   ```

This replaces the hand-drawn SVG path with the official Swish logo image across all 4 purchase dialogs automatically (they all import `SwishIcon`).

