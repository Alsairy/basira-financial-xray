import { createContext, useContext } from 'react';
import type { Dashboard, Fact, Finding, Locale, Metric, Session } from './types';
export interface AppState {
  locale: Locale;
  tr: (ar: string, en: string) => string;
  session: Session;
  dashboard: Dashboard | null;
  entityId: string;
  audience: string;
  setAudience: (a: string) => void;
  period: string;
  setPeriod: (p: string) => void;
  refresh: () => Promise<unknown>;
  navigate: (path: string) => void;
  inspect: (item: Fact | Metric | Finding) => void;
  notify: (message: string) => void;
}
export const AppContext = createContext<AppState>(null as unknown as AppState);
export const useApp = () => useContext(AppContext);
export function format(
  value: number | null | undefined,
  unit = 'number',
  compact = false,
  locale: Locale = 'ar',
) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  let suffix = '',
    v = value;
  if (compact && unit === 'currency') {
    if (Math.abs(v) >= 1e9) {
      v /= 1e9;
      suffix = locale === 'ar' ? ' مليار' : ' B';
    } else if (Math.abs(v) >= 1e6) {
      v /= 1e6;
      suffix = locale === 'ar' ? ' مليون' : ' M';
    } else if (Math.abs(v) >= 1e3) {
      v /= 1e3;
      suffix = locale === 'ar' ? ' ألف' : ' K';
    }
  }
  const n = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: unit === 'currency' && !compact ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(v);
  return (
    n +
    (unit === 'percent'
      ? '%'
      : unit === 'days'
        ? locale === 'ar'
          ? ' يوم'
          : ' days'
        : unit === 'multiple'
          ? '×'
          : suffix)
  );
}
export const statusLabels: Record<string, [string, string]> = {
  draft: ['مسودة', 'Draft'],
  approved: ['معتمد', 'Approved'],
  in_progress: ['قيد التنفيذ', 'In progress'],
  blocked: ['متعثر', 'Blocked'],
  pending_verification: ['بانتظار التحقق', 'Verify'],
  closed: ['مقفل', 'Closed'],
  benefit_verified: ['أثر معتمد', 'Benefit verified'],
  reopened: ['أعيد فتحه', 'Reopened'],
  reviewed: ['تمت المراجعة', 'Reviewed'],
  needs_review: ['يحتاج مراجعة', 'Needs review'],
  ok: ['مؤهل', 'Eligible'],
  proxy: ['مؤشر تقريبي', 'Proxy'],
  insufficient_data: ['بيانات غير كافية', 'Insufficient data'],
  not_applicable: ['غير منطبق', 'Not applicable'],
  invalid_denominator: ['مقام غير صالح', 'Invalid denominator'],
  high: ['أولوية عالية', 'High priority'],
  medium: ['أولوية متوسطة', 'Medium priority'],
  low: ['متابعة', 'Monitor'],
  info: ['للعلم', 'Information'],
  supported: ['مدعوم بالبيانات', 'Supported'],
  hypothesis: ['فرضية للمراجعة', 'Hypothesis'],
  needs_data: ['يتطلب بيانات', 'Needs data'],
  accepted: ['مقبول', 'Accepted'],
  rejected: ['مستبعد', 'Rejected'],
  cash_release: ['تحرير نقد', 'Cash release'],
  annual_profit: ['ربح سنوي', 'Annual profit'],
  financing_saving: ['وفر تمويل', 'Financing saving'],
  risk_exposure: ['تعرض للمخاطر', 'Risk exposure'],
  ready: ['جاهز', 'Ready'],
  processing: ['قيد القراءة', 'Processing'],
  failed: ['تعذر التنفيذ', 'Failed'],
  archived: ['مؤرشف', 'Archived'],
};
