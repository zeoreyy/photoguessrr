type LogoProps = { size?: number; className?: string };

/**
 * Minimal explorer mascot — geometric, sharp shapes only.
 * Square body, round head, yellow hard hat with brim and lamp.
 */
export function Logo({ size = 40, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="PhotoGuessr mascot"
    >
      {/* Hard hat brim */}
      <rect x="10" y="20" width="44" height="4" fill="#FACC15" />
      {/* Hard hat dome */}
      <path d="M14 20 H50 V14 Q50 6 32 6 Q14 6 14 14 Z" fill="#FACC15" />
      {/* Hat ridge */}
      <rect x="30" y="6" width="4" height="14" fill="#000" />
      {/* Hat lamp */}
      <rect x="29" y="10" width="6" height="4" fill="#000" />
      {/* Face */}
      <rect x="18" y="24" width="28" height="22" fill="#E5E5E5" />
      {/* Eyes */}
      <rect x="24" y="32" width="4" height="4" fill="#000" />
      <rect x="36" y="32" width="4" height="4" fill="#000" />
      {/* Mouth */}
      <rect x="26" y="40" width="12" height="2" fill="#000" />
      {/* Shoulders */}
      <rect x="12" y="46" width="40" height="12" fill="#000" />
      {/* Yellow chest stripe */}
      <rect x="12" y="50" width="40" height="3" fill="#FACC15" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      PHOTO<span className="text-yellow-400">·</span>GUESSR
    </span>
  );
}
