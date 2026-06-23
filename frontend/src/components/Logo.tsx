import { logoSvgMarkup } from '../lib/logo';

/** Drifters brand mark rendered inline as SVG. */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: logoSvgMarkup(size) }}
    />
  );
}
