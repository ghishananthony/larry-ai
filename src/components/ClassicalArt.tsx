/** Subtle classical line art used as background decoration. Purely decorative. */

export function TempleLineArt({ className = "" }: { className?: string }) {
  const columns = [0, 1, 2, 3, 4, 5];
  return (
    <svg
      viewBox="0 0 520 440"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* Pediment */}
      <path d="M40 120 L260 40 L480 120 Z" />
      <path d="M72 114 L260 50 L448 114" opacity="0.6" />
      {/* Entablature */}
      <rect x="36" y="120" width="448" height="14" />
      <rect x="44" y="134" width="432" height="22" />
      {Array.from({ length: 18 }).map((_, i) => (
        <line key={i} x1={56 + i * 24} y1="138" x2={56 + i * 24} y2="152" opacity="0.5" />
      ))}
      <rect x="52" y="156" width="416" height="8" />
      {/* Columns */}
      {columns.map((i) => {
        const x = 70 + i * 76;
        return (
          <g key={i}>
            <rect x={x - 6} y="164" width="44" height="8" />
            <path d={`M${x - 2} 172 h36`} />
            <path d={`M${x} 176 L${x + 2} 356 M${x + 32} 176 L${x + 30} 356`} />
            <path d={`M${x + 11} 180 V352 M${x + 21} 180 V352`} opacity="0.45" />
            <rect x={x - 4} y="356" width="40" height="8" />
          </g>
        );
      })}
      {/* Steps */}
      <rect x="40" y="364" width="440" height="12" />
      <rect x="24" y="376" width="472" height="12" />
      <rect x="8" y="388" width="504" height="12" />
    </svg>
  );
}

/** Tiny stylized owl, meant to perch on the temple roof at low opacity. */
export function OwlLineArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 4 L8 8 M18 4 L16 8" />
      <path d="M12 7 C6 7 4 12 4 17 C4 23 8 27 12 27 C16 27 20 23 20 17 C20 12 18 7 12 7 Z" />
      <circle cx="9" cy="13" r="1.8" />
      <circle cx="15" cy="13" r="1.8" />
      <path d="M11.2 16 L12 17.4 L12.8 16" />
      <path d="M9 20 Q12 22 15 20 M9.5 23 Q12 24.5 14.5 23" opacity="0.6" />
      <path d="M8 28 H16" />
    </svg>
  );
}

export function LaurelLineArt({ className = "" }: { className?: string }) {
  const leaves = Array.from({ length: 9 });
  return (
    <svg
      viewBox="0 0 120 420"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M20 410 C40 320 50 220 80 20" />
      {leaves.map((_, i) => {
        const t = i / leaves.length;
        const y = 390 - t * 360;
        const x = 22 + t * 55 + Math.sin(t * 3) * 6;
        return (
          <g key={i}>
            <path d={`M${x} ${y} C${x + 18} ${y - 10} ${x + 34} ${y - 26} ${x + 36} ${y - 34} C${x + 22} ${y - 30} ${x + 6} ${y - 18} ${x} ${y} Z`} />
            <path d={`M${x} ${y} C${x - 16} ${y - 12} ${x - 26} ${y - 28} ${x - 26} ${y - 36} C${x - 14} ${y - 30} ${x - 4} ${y - 18} ${x} ${y} Z`} />
          </g>
        );
      })}
    </svg>
  );
}
