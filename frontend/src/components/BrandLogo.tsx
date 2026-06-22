/**
 * Architecture Drift Copilot brand mark. A rounded gradient tile with a solid
 * "delta" (change) triangle and an offset ghost triangle representing drift
 * between intended and actual architecture.
 */
export function BrandLogo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Architecture Drift Copilot"
    >
      <defs>
        <linearGradient id="adcGrad" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0" stopColor="#5b8def" />
          <stop offset="1" stopColor="#3f6fd6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#adcGrad)" />
      {/* drift ghost (intended) */}
      <path
        d="M18 8 L27 25 L9 25 Z"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.5"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* actual */}
      <path
        d="M15 7 L24.5 25 L5.5 25 Z"
        fill="#ffffff"
        strokeLinejoin="round"
      />
      <circle cx="15" cy="7" r="1.8" fill="#3f6fd6" stroke="#ffffff" strokeWidth="1.2" />
    </svg>
  );
}

/** Raw SVG markup of the brand mark, for embedding in exported HTML reports. */
export function brandLogoSvg(size = 28): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="adcGrad" x1="0" y1="0" x2="32" y2="32">
    <stop offset="0" stop-color="#5b8def"/><stop offset="1" stop-color="#3f6fd6"/>
  </linearGradient></defs>
  <rect width="32" height="32" rx="8" fill="url(#adcGrad)"/>
  <path d="M18 8 L27 25 L9 25 Z" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M15 7 L24.5 25 L5.5 25 Z" fill="#ffffff" stroke-linejoin="round"/>
  <circle cx="15" cy="7" r="1.8" fill="#3f6fd6" stroke="#ffffff" stroke-width="1.2"/>
</svg>`;
}
