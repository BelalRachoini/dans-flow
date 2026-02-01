import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  // Initialize with actual value if window is available (client-side)
  // This prevents layout shift from undefined → actual value transition
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < MOBILE_BREAKPOINT;
    }
    return false; // SSR fallback
  });

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    // Only update if different from initial (prevents unnecessary re-render)
    const currentIsMobile = window.innerWidth < MOBILE_BREAKPOINT;
    if (currentIsMobile !== isMobile) {
      setIsMobile(currentIsMobile);
    }
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
