interface LogoProps {
  className?: string;
  variant?: "light" | "dark";
  showWordmark?: boolean;
}
export default function Logo({ className = "", variant = "dark", showWordmark = true }: LogoProps) {
  const ink = variant === "light" ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))";
  const bronze = "hsl(var(--secondary))";
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect x="6" y="3" width="20" height="1.6" rx="0.4" fill={ink} />
        <rect x="6" y="27.4" width="20" height="1.6" rx="0.4" fill={ink} />
        <path d="M8 5 L24 5 L17.6 15.5 Q16 16.4 14.4 15.5 Z" fill={ink} fillOpacity="0.92" />
        <path d="M8 27 L24 27 L17.6 16.5 Q16 15.6 14.4 16.5 Z" fill={ink} fillOpacity="0.92" />
        <circle cx="16" cy="16" r="0.9" fill={bronze} />
        <path d="M15.4 17.2 L16.6 17.2 L17.6 27 L14.4 27 Z" fill={bronze} fillOpacity="0.85" />
      </svg>
      {showWordmark && (
        <span className="font-display text-[20px] font-medium tracking-tight" style={{ color: ink }}>
          Chronos
        </span>
      )}
    </div>
  );
}
