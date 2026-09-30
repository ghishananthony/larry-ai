/** Subtle classical line art used as background decoration. Purely decorative. */

export function TempleLineArt({ className = "" }: { className?: string }) {
  const columns = [0, 1, 2, 3, 4, 5];
  return (
    <svg
      viewBox="0 0 520 440"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* Pediment with inner tympanum and relief hints */}
      <path d="M36 120 L260 38 L484 120 Z" strokeWidth="1.3" />
      <path d="M64 114 L260 48 L456 114 Z" opacity="0.7" />
      <path d="M150 110 C170 92 190 96 205 86 C222 76 238 84 250 72 M270 72 C282 84 298 76 315 86 C330 96 350 92 370 110" opacity="0.45" />
      <path d="M200 110 C210 100 225 102 232 94 M288 94 C295 102 310 100 320 110" opacity="0.35" />
      {/* Cornice, frieze with triglyphs, architrave */}
      <rect x="30" y="120" width="460" height="10" />
      <rect x="38" y="130" width="444" height="24" />
      {Array.from({ length: 19 }).map((_, i) => (
        <path key={i} d={`M${50 + i * 23} 134 v16 M${54 + i * 23} 134 v16`} opacity="0.45" />
      ))}
      <rect x="44" y="154" width="432" height="10" />
      <path d="M44 159 H476" opacity="0.4" />
      {/* Ionic columns */}
      {columns.map((i) => {
        const x = 66 + i * 76;
        return (
          <g key={i}>
            <path d={`M${x - 8} 164 h52 v6 h-52 z`} />
            <path d={`M${x - 6} 176 a5 5 0 1 1 8 -4 M${x + 42} 176 a5 5 0 1 0 -8 -4`} opacity="0.7" />
            <path d={`M${x} 178 L${x + 2} 350 M${x + 36} 178 L${x + 34} 350`} />
            <path d={`M${x + 9} 180 V348 M${x + 18} 180 V348 M${x + 27} 180 V348`} opacity="0.35" />
            <path d={`M${x - 3} 350 h42 v5 h-42 z M${x - 6} 355 h48 v6 h-48 z`} />
          </g>
        );
      })}
      {/* Stylobate and steps */}
      <rect x="30" y="361" width="460" height="10" />
      <rect x="18" y="371" width="484" height="11" />
      <rect x="6" y="382" width="508" height="11" />
      <rect x="-8" y="393" width="536" height="12" />
      <path d="M-40 420 C20 414 120 418 200 412 C300 406 420 416 560 410" opacity="0.35" />
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
  const leaves = Array.from({ length: 12 });
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
