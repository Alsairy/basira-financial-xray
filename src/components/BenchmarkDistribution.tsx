import { format } from '../context';
import type { Locale } from '../types';

interface PeerPoint {
  id: string;
  name: string;
  value: number;
}
interface Props {
  companyLabel: string;
  companyValue: number | null;
  peers: PeerPoint[];
  median: number | null;
  q1: number | null;
  q3: number | null;
  unit: string;
  locale: Locale;
  tr: (ar: string, en: string) => string;
}
const WIDTH = 640;
const HEIGHT = 120;
const PAD = 44;
const TRACK_Y = 58;

/**
 * A single-axis distribution strip: the eligible peer cohort as individual points around a
 * shaded interquartile band and median tick, with the company's own value marked distinctly.
 * Hand-rolled SVG rather than a charting library — this is a static geometric diagram (one
 * line, one band, a handful of points), and the app's own historical-comparison bars follow
 * the same "plain SVG/DOM for simple cases, Recharts for real multi-series charts" split.
 * Numbers stay LTR regardless of UI language, matching the existing Overview revenue chart.
 */
export function BenchmarkDistribution({
  companyLabel,
  companyValue,
  peers,
  median,
  q1,
  q3,
  unit,
  locale,
  tr,
}: Props) {
  const values = peers.map((p) => p.value).filter(Number.isFinite);
  const known = [...values, median, q1, q3, companyValue].filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (!known.length) return null;
  const min = Math.min(...known),
    max = Math.max(...known),
    span = max - min || 1,
    margin = span * 0.12,
    domainMin = min - margin,
    domainMax = max + margin,
    x = (v: number) => PAD + ((v - domainMin) / (domainMax - domainMin)) * (WIDTH - PAD * 2);
  const fmt = (v: number | null) => format(v, unit, false, locale);
  return (
    <div className="benchmark-distribution">
      <div dir="ltr">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          role="img"
          aria-label={tr(
            `توزيع ${peers.length} نظيرًا مقابل قيمة الشركة ${companyValue !== null ? fmt(companyValue) : 'غير متاحة'}؛ الوسيط ${fmt(median)}، نطاق الربيعين من ${fmt(q1)} إلى ${fmt(q3)}.`,
            `Distribution of ${peers.length} peers against the company's value of ${companyValue !== null ? fmt(companyValue) : 'unavailable'}; median ${fmt(median)}, interquartile range ${fmt(q1)} to ${fmt(q3)}.`,
          )}
        >
          <line
            x1={PAD}
            y1={TRACK_Y}
            x2={WIDTH - PAD}
            y2={TRACK_Y}
            stroke="var(--basira-line)"
            strokeWidth={2}
          />
          {q1 !== null && q3 !== null && (
            <rect
              x={x(q1)}
              y={TRACK_Y - 13}
              width={Math.max(1, x(q3) - x(q1))}
              height={26}
              rx={6}
              fill="var(--basira-band)"
              stroke="var(--basira-series-benchmark)"
              strokeOpacity={0.45}
            />
          )}
          {median !== null && (
            <line
              x1={x(median)}
              y1={TRACK_Y - 17}
              x2={x(median)}
              y2={TRACK_Y + 17}
              stroke="var(--basira-series-benchmark)"
              strokeWidth={2}
            />
          )}
          {peers.map((p) => (
            <circle
              key={p.id}
              cx={x(p.value)}
              cy={TRACK_Y}
              r={5}
              fill="var(--basira-series-peer)"
              fillOpacity={0.75}
            >
              <title>{`${p.name}: ${fmt(p.value)}`}</title>
            </circle>
          ))}
          {companyValue !== null && (
            <g>
              <circle
                cx={x(companyValue)}
                cy={TRACK_Y}
                r={7.5}
                fill="var(--basira-series-company)"
                stroke="var(--basira-navy)"
                strokeWidth={1.5}
              >
                <title>{`${companyLabel}: ${fmt(companyValue)}`}</title>
              </circle>
              <text
                x={x(companyValue)}
                y={TRACK_Y - 24}
                textAnchor="middle"
                className="benchmark-distribution-label"
              >
                {fmt(companyValue)}
              </text>
            </g>
          )}
          <text x={PAD} y={HEIGHT - 10} textAnchor="start" className="benchmark-distribution-axis">
            {fmt(domainMin)}
          </text>
          <text
            x={WIDTH - PAD}
            y={HEIGHT - 10}
            textAnchor="end"
            className="benchmark-distribution-axis"
          >
            {fmt(domainMax)}
          </text>
          {median !== null && (
            <text
              x={x(median)}
              y={HEIGHT - 10}
              textAnchor="middle"
              className="benchmark-distribution-axis"
            >
              {tr('الوسيط', 'Median')} {fmt(median)}
            </text>
          )}
        </svg>
      </div>
      <div className="benchmark-distribution-legend">
        <span>
          <i style={{ background: 'var(--basira-series-company)', borderColor: 'var(--basira-navy)' }} />
          {companyLabel}
        </span>
        <span>
          <i style={{ background: 'var(--basira-series-peer)' }} />
          {tr('كل نظير مؤهل', 'Each eligible peer')}
        </span>
        <span>
          <i className="swatch-band" />
          {tr('نطاق الربيعين', 'Interquartile range')}
        </span>
      </div>
    </div>
  );
}
