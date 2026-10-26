import { SOURCE_LABEL, type JobSource } from '@trawler/shared';
import { cn } from 'cn';

/**
 * Monogram badge for a job source: a rounded tile with one letter, coloured far apart per source
 * so rows can be scanned without reading. Deliberately not the sites' logos (trademark, and they
 * do not survive 16px). The label stays available to tooltips and screen readers.
 */
const STYLE: Record<JobSource, { letter: string; tile: string }> = {
  WANTED: { letter: 'W', tile: 'fill-sky-600 dark:fill-sky-500' },
  SARAMIN: { letter: 'S', tile: 'fill-orange-500 dark:fill-orange-400' },
};

export function SourceIcon({ source, className }: { source: JobSource; className?: string }) {
  const { letter, tile } = STYLE[source];
  const label = SOURCE_LABEL[source];
  return (
    <svg viewBox="0 0 16 16" role="img" aria-label={label} className={cn('inline-block size-4 shrink-0', className)}>
      <title>{label}</title>
      <rect width="16" height="16" rx="4" className={tile} />
      <text
        x="8"
        y="11.6"
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        className="fill-white"
      >
        {letter}
      </text>
    </svg>
  );
}
