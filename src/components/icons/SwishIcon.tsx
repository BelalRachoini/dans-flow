interface SwishIconProps {
  className?: string;
}

export const SwishIcon = ({ className }: SwishIconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20.8 3.2c-2.1-2.1-5.2-2.6-7.8-1.3l-1.2.6c-1.8.9-3.9.7-5.5-.5L4.5.5c-.4-.3-.9-.1-1 .4L2 7.3c-.1.4.2.8.6.8h2.8c.5 0 .8-.4.7-.8l-.3-1.1c1.2.6 2.6.8 3.9.4l1.5-.5c1.6-.5 3.4-.1 4.6 1.1 1.8 1.8 1.8 4.7 0 6.5l-3.3 3.3c-1.2 1.2-2.9 1.6-4.5 1.1l-1.5-.5c-1.3-.4-2.7-.2-3.9.4l.3-1.1c.1-.4-.2-.8-.7-.8H2.6c-.4 0-.7.4-.6.8l1.5 6.4c.1.5.6.7 1 .4l1.8-1.5c1.6-1.2 3.7-1.4 5.5-.5l1.2.6c2.6 1.3 5.7.8 7.8-1.3 3-3 3-7.8 0-10.8z"
      fill="currentColor"
    />
  </svg>
);
