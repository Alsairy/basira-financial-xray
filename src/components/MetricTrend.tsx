import { format } from '../context';
import type { Locale } from '../types';

interface Point {
  period: string;
  value: number | null;
  status?: string;
}
interface Props {
  points: Point[];
  unit: string;
  locale: Locale;
  tr: (ar: string, en: string) => string;
  size?: 'sparkline' | 'detailed';
}

/**
 * A per-metric trend across the periods the company was actually analyzed for. Missing or
 * ineligible periods are drawn as a faded, unconnected marker — never interpolated or
 * treated as zero — so a gap in the underlying source stays visible as a gap in the chart.
 * Hand-rolled SVG (same rationale as BenchmarkDistribution): a short multi-point line is a
 * static diagram, not a case for a charting library. This is the company's own metric over
 * time, so it uses the official series-company token (navy — "always the strongest mark"
 * per the Basira brand spec), not series-peer/scan, which is reserved for a named peer,
 * prior period or forecast series (see BenchmarkDistribution for that usage).
 */
export function MetricTrend({ points, unit, locale, tr, size = 'sparkline' }: Props) {
  if (points.length < 2) return null;
  const known = points
    .map((p) => p.value)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (!known.length) return null;
  const detailed = size === 'detailed';
  const width = detailed ? 320 : 120;
  const height = detailed ? 108 : 32;
  const padX = detailed ? 28 : 6;
  const padTop = detailed ? 22 : 5;
  const padBottom = detailed ? 26 : 5;
  const min = Math.min(...known),
    max = Math.max(...known),
    span = max - min || Math.abs(max) || 1;
  const stepX = (width - padX * 2) / (points.length - 1);
  const x = (i: number) => padX + i * stepX;
  const y = (v: number) => height - padBottom - ((v - min) / span) * (height - padTop - padBottom);
  const fmt = (v: number | null) => format(v, unit, detailed, locale);
  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i].value,
      b = points[i + 1].value;
    if (a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b))
      segments.push({ x1: x(i), y1: y(a), x2: x(i + 1), y2: y(b) });
  }
  const last = [...points].reverse().find((p) => p.value !== null && Number.isFinite(p.value));
  return (
    <div className={`metric-trend metric-trend-${size}`} dir="ltr">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={detailed ? '100%' : width}
        height={height}
        role="img"
        aria-label={tr(
          `اتجاه عبر ${points.length} فترة: ${points.map((p) => `${p.period} ${p.value === null ? 'غير متاح' : fmt(p.value)}`).join('، ')}.`,
          `Trend across ${points.length} periods: ${points.map((p) => `${p.period} ${p.value === null ? 'unavailable' : fmt(p.value)}`).join(', ')}.`,
        )}
      >
        {segments.map((s, i) => (
          <line
            key={i}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke="var(--basira-series-company)"
            strokeWidth={detailed ? 2 : 1.6}
          />
        ))}
        {points.map((p, i) =>
          p.value !== null && Number.isFinite(p.value) ? (
            <g key={p.period}>
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r={p === last ? (detailed ? 4.5 : 2.6) : detailed ? 3.2 : 1.8}
                fill="var(--basira-series-company)"
              >
                <title>{`${p.period}: ${fmt(p.value)}`}</title>
              </circle>
              {detailed && (
                <>
                  <text
                    x={x(i)}
                    y={y(p.value) - 10}
                    textAnchor="middle"
                    className="metric-trend-label"
                  >
                    {fmt(p.value)}
                  </text>
                  <text x={x(i)} y={height - 8} textAnchor="middle" className="metric-trend-axis">
                    {p.period}
                  </text>
                </>
              )}
            </g>
          ) : (
            <g key={p.period}>
              <circle
                cx={x(i)}
                cy={height - padBottom - (height - padTop - padBottom) / 2}
                r={detailed ? 3.2 : 1.8}
                fill="none"
                stroke="var(--basira-line-strong)"
                strokeDasharray="2 2"
              >
                <title>{tr(`${p.period}: غير متاح`, `${p.period}: unavailable`)}</title>
              </circle>
              {detailed && (
                <text x={x(i)} y={height - 8} textAnchor="middle" className="metric-trend-axis">
                  {p.period}
                </text>
              )}
            </g>
          ),
        )}
      </svg>
    </div>
  );
}
