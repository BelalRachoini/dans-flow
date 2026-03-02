interface SwishIconProps {
  className?: string;
}

export const SwishIcon = ({ className }: SwishIconProps) => (
  <svg viewBox="0 0 256 256" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="swishGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF2131" />
        <stop offset="25%" stopColor="#F26F21" />
        <stop offset="50%" stopColor="#F8C620" />
        <stop offset="75%" stopColor="#6BC248" />
        <stop offset="90%" stopColor="#009DDC" />
        <stop offset="100%" stopColor="#522B90" />
      </linearGradient>
      <linearGradient id="swishGrad2" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#EF2131" />
        <stop offset="25%" stopColor="#F26F21" />
        <stop offset="50%" stopColor="#F8C620" />
        <stop offset="75%" stopColor="#6BC248" />
        <stop offset="90%" stopColor="#009DDC" />
        <stop offset="100%" stopColor="#522B90" />
      </linearGradient>
    </defs>
    <path
      d="M208.3 47.7c-29.5-29.5-72.5-36.3-108.8-18.2l-16.8 8.4c-25.1 12.6-54.4 9.8-76.7-7L1.2 27c-2.3-1.8-5.6-.3-6.1 2.8L-13 89.4c-.5 2.8 1.6 5.3 4.4 5.3h39c3.4 0 5.6-3.4 4.5-6.5l-4.2-11.8c16.8 8.4 36.3 11.2 54.4 5.6l20.9-7c22.3-7 47.4-1.4 64.2 15.4 25.1 25.1 25.1 65.6 0 90.7l-46 46c-16.8 16.8-40.5 22.3-62.8 15.4l-20.9-7c-18.1-5.6-37.7-2.8-54.4 5.6l4.2-11.8c1.1-3.1-1.1-6.5-4.5-6.5h-39c-2.8 0-4.9 2.5-4.4 5.3l8.3 59.6c.5 3.1 3.8 4.6 6.1 2.8l4.8-3.9c22.3-16.8 51.6-19.6 76.7-7l16.8 8.4c36.3 18.1 79.3 11.3 108.8-18.2 41.8-41.8 41.8-109.5 0-151.3z"
      fill="url(#swishGrad1)"
      transform="translate(28, 12) scale(0.88)"
    />
  </svg>
);
