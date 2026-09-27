export type Locale = 'ar' | 'en';
export type Role = 'cfo' | 'analyst' | 'operator' | 'board';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export interface Session {
  user: User;
  tenant: { id: string; name: string; demo: boolean };
  csrfToken: string;
  capabilities: Record<string, unknown>;
}
export interface Entity {
  id: string;
  name: string;
  sector: string;
  currency: string;
}
export interface Fact {
  id: string;
  concept: string;
  label_ar: string;
  label_en: string;
  period: string;
  value: number | null;
  original_value: number | null;
  currency: string;
  unit: string;
  scale: number;
  source: { sheet?: string; cell?: string; page?: number; bbox?: number[] };
  formula?: string;
  cache_status?: string;
  review_status: string;
  scope: string;
}
export interface Check {
  id: string;
  label_ar: string;
  label_en: string;
  status: string;
  difference?: number;
  tolerance?: number;
  details_ar: string;
  details_en: string;
}
export interface Metric {
  id: string;
  key: string;
  period: string;
  label_ar: string;
  label_en: string;
  value: number | null;
  unit: string;
  status: string;
  formula: string;
  inputs: string[];
  explanation_ar: string;
  explanation_en: string;
  group: string;
  prior_value?: number;
  delta?: number;
}
export interface Finding {
  id: string;
  rule_id: string;
  title_ar: string;
  title_en: string;
  summary_ar: string;
  summary_en: string;
  severity: string;
  kind: string;
  evidence_status: string;
  metric_ids: string[];
  source_refs: string[];
  questions_ar: string[];
  questions_en: string[];
  action_ar: string;
  action_en: string;
}
export interface Dataset {
  id: string;
  entity_id: string;
  document_id: string;
  status: string;
  version: number;
  facts: Fact[];
  periods: string[];
  warnings: string[];
  source_preview: { sheet?: string; page?: number; text: string }[];
  checks: Check[];
  created_by: string;
  created_at?: string;
}
export interface Analysis {
  id: string;
  entity_id: string;
  dataset_id: string;
  dataset_version?: number;
  engine_version: string;
  periods: string[];
  metrics: Metric[];
  findings: Finding[];
  checks: Check[];
  created_at?: string;
  finding_reviews?: Record<string, { status: string; reason: string }>;
}
export interface Document {
  id: string;
  entity_id: string;
  filename: string;
  status: string;
  created_at: string;
  sha256?: string;
  size?: number;
}
export interface Action {
  id: string;
  entity_id: string;
  analysis_id?: string;
  finding_id?: string;
  title: string;
  description: string;
  owner_id: string;
  owner_name?: string;
  due_date: string;
  status: string;
  baseline: number;
  target: number;
  unit: string;
  effect_type: string;
  dependency_group?: string;
  version: number;
  created_by: string;
  evidence?: Evidence[];
  history?: {
    created_at?: string;
    at?: string;
    by?: string;
    event?: string;
    action?: string;
    status?: string;
    reason?: string;
    actor_name?: string;
  }[];
  benefits?: {
    id: string;
    amount: number;
    effect_type: string;
    period_start: string;
    period_end: string;
    verified_at: string;
    verified_by: string;
  }[];
}
export interface Evidence {
  id: string;
  title: string;
  note: string;
  filename?: string;
  created_by?: string;
  created_at?: string;
}
export interface Report {
  audience?: string;
  purpose?: string;
  detail_level?: string;
  id: string;
  title: string;
  status: string;
  language: Locale;
  created_at: string;
  approved_at?: string;
  created_by: string;
  analysis_id: string;
  version?: number;
  snapshot?: {
    entity?: Entity;
    analysis?: Analysis;
    dataset?: Dataset;
    actions?: Action[];
    [key: string]: unknown;
  };
}
export interface Notification {
  id: string;
  title?: string;
  message?: string;
  read_at?: string;
  created_at: string;
  [key: string]: unknown;
}
export interface Dashboard {
  entity: Entity;
  entities: Entity[];
  dataset: Dataset | null;
  analysis: Analysis | null;
  actions: Action[];
  documents: Document[];
  notifications: Notification[];
}
export interface Scenario {
  id?: string;
  title?: string;
  type: string;
  effect_type: string;
  low: number;
  base: number;
  high: number;
  currency: string;
  unit: string;
  formula: string;
  source_refs: string[];
  assumptions_ar: string[];
  assumptions_en: string[];
  dependency_group: string;
  [key: string]: unknown;
}
