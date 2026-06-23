/**
 * Drifters brand mark: a gradient badge with two offset layers that represent
 * intended vs. actual architecture drifting apart. Returned as a standalone,
 * self-contained SVG string so the exact same mark can be reused for the
 * favicon, the sidebar logo, and report exports.
 */
export function logoSvgMarkup(size = 32): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    'viewBox="0 0 32 32" fill="none" role="img" aria-label="Drifters logo">' +
    '<defs><linearGradient id="drifters-grad" x1="0" y1="0" x2="32" y2="32" ' +
    'gradientUnits="userSpaceOnUse"><stop stop-color="#2563eb"/>' +
    '<stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs>' +
    '<rect width="32" height="32" rx="8" fill="url(#drifters-grad)"/>' +
    '<rect x="6.5" y="7.5" width="12" height="12" rx="3.2" fill="#ffffff" fill-opacity="0.5"/>' +
    '<rect x="13.5" y="12.5" width="12" height="12" rx="3.2" fill="#ffffff"/>' +
    '</svg>'
  );
}
