interface GhostMascotProps {
  src?: string;
  className?: string;
  style?: React.CSSProperties;
  animate?: boolean;
}

export default function GhostMascot({ 
  src = '/images/ghost-mascot.png', 
  className = '', 
  style,
  animate = true 
}: GhostMascotProps) {
  return (
    <img
      src={src}
      alt="GhostPay mascot"
      className={`pointer-events-none select-none ${animate ? 'animate-float' : ''} ${className}`}
      style={style}
      loading="lazy"
    />
  );
}
