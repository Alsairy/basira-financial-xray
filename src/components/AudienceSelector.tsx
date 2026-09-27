import {
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  SearchCheck,
  Settings2,
  Users,
  Wallet,
} from 'lucide-react';
import config from '../../shared/audiences.json';
import { useApp } from '../context';
export const audiences = config.audiences;
const icons: Record<string, typeof Users> = {
  board: Users,
  ceo: BriefcaseBusiness,
  cfo: Wallet,
  sales: ChartNoAxesCombined,
  analyst: SearchCheck,
  sector: Building2,
  operations: Settings2,
};
export function AudienceSelector({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  const { tr } = useApp();
  if (compact)
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={tr('متلقي التقرير', 'Report audience')}
      >
        {audiences.map((a) => (
          <option key={a.id} value={a.id}>
            {tr(a.label_ar, a.label_en)}
          </option>
        ))}
      </select>
    );
  return (
    <div className="audience-grid">
      {audiences.map((a) => {
        const Icon = icons[a.id];
        return (
          <button
            type="button"
            className={`audience-option ${value === a.id ? 'selected' : ''}`}
            key={a.id}
            onClick={() => onChange(a.id)}
            aria-pressed={value === a.id}
          >
            <span className="audience-icon">
              <Icon size={23} />
            </span>
            <div>
              <strong>{tr(a.label_ar, a.label_en)}</strong>
              <p>{tr(a.description_ar, a.description_en)}</p>
            </div>
            <span className="radio-indicator" />
          </button>
        );
      })}
    </div>
  );
}
