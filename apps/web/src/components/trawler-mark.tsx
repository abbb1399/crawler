import type { SVGProps } from 'react';

/**
 * Trawler mark: hull + wheelhouse + gantry towing a dashed net, on a wave line.
 * Stroke-only in currentColor so it follows the text colour in light and dark mode.
 * Keep in sync with src/app/icon.svg (the favicon version on a solid tile).
 */
export function TrawlerMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 18h19l-3 6H6z" fill="currentColor" fillOpacity=".15" />
      <path d="M8 18v-6h7v6" />
      <path d="M18 18V7" />
      <path d="M18 9l6 4" />
      <path d="M24 13c1 5 3 9 6 13" strokeDasharray="2 2.5" />
      <path d="M2 28c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0 4 1.5 6 0 3-1.2 4 0" />
    </svg>
  );
}
