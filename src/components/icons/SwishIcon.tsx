import swishLogo from '@/assets/swish-logo.png';

interface SwishIconProps {
  className?: string;
}

export const SwishIcon = ({ className }: SwishIconProps) => (
  <img src={swishLogo} alt="Swish" className={className} />
);
