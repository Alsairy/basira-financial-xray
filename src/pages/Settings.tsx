import { useQuery } from '@tanstack/react-query';
import { Database, LockKeyhole, Plus, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { api, patch, post } from '../api';
import { Badge, Button, ErrorBox, Field, Modal, Notice, PageTitle, Panel } from '../components/ui';
import Usage from '../components/Usage';
import { useApp } from '../context';
import type { User } from '../types';
interface Policies {
  id: string;
  version: number;
  days: number;
  include_leases: boolean;
  materiality_pct: number;
  retention_days: number;
  locale: string;
}
interface Audit {
  id: string;
  action: string;
  created_at: string;
  actor_name?: string;
  user_id?: string;
  resource_type?: string;
  resource_id?: string;
  details?: unknown;
}
export default function SettingsPage() {
  const { tr, locale, session, refresh, notify } = useApp();
  const [tab, setTab] = useState('policies'),
    [member, setMember] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Policies>('/settings') });
  const members = useQuery({ queryKey: ['members'], queryFn: () => api<User[]>('/members') });
  const caps = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => api<Record<string, Record<string, unknown>>>('/capabilities'),
  });
  const audit = useQuery({
    queryKey: ['audit'],
    queryFn: () => api<Audit[]>('/audit'),
    enabled: tab === 'audit',
  });
  const cfo = session.user.role === 'cfo';
  return (
    <>
      <PageTitle
        eyebrow={tr('ثقة يمكن التحقق منها', 'VERIFIABLE TRUST')}
        title={tr('الإعدادات والحوكمة', 'Settings & governance')}
        description={tr(
          'سياسات التحليل، الأدوار، سجل التغيير، وحالة الخدمات الفعلية.',
          'Analysis policies, roles, change history and actual service capabilities.',
        )}
      />
      <div className="tab-bar" role="tablist">
        {[
          ['policies', tr('السياسات', 'Policies')],
          ['team', tr('الفريق والصلاحيات', 'Team & access')],
          ['audit', tr('سجل التدقيق', 'Audit trail')],
          ['usage', tr('الاستخدام والتكلفة', 'Usage & cost')],
          ['capabilities', tr('الخدمات والتكامل', 'Capabilities & integrations')],
        ].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {!!error && <ErrorBox error={error} />} {tab === 'usage' && <Usage />}
      {tab === 'policies' && (
        <div className="settings-layout">
          <Panel
            title={tr('سياسة الحساب والمادية', 'Calculation & materiality policy')}
            subtitle={tr(
              'تغيير السياسة يستلزم إعادة تحليل واعتماد البيانات قبل تقرير جديد.',
              'Policy changes require recalculation and data reapproval before a new report.',
            )}
          >
            {settings.data && (
              <form
                key={settings.data.version}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setBusy(true);
                  setError(null);
                  try {
                    await patch('/settings', {
                      version: settings.data!.version,
                      days: Number(f.get('days')),
                      include_leases: f.get('leases') === 'on',
                      materiality_pct: Number(f.get('materiality')),
                      retention_days: Number(f.get('retention')),
                      locale,
                    });
                    await settings.refetch();
                    await refresh();
                    notify(tr('حُفظ إصدار جديد من السياسة', 'New policy version saved'));
                  } catch (e) {
                    setError(e);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div className="form-grid">
                  <Field label={tr('الأيام المستخدمة في النسب', 'Ratio day convention')}>
                    <select name="days" defaultValue={settings.data.days} disabled={!cfo}>
                      <option value="365">365</option>
                      <option value="360">360</option>
                      <option value="366">366</option>
                    </select>
                  </Field>
                  <Field
                    label={tr('حد المادية · % / نقطة', 'Materiality threshold · % / points')}
                    hint={tr(
                      'يطبق وفق تعريف كل قاعدة، وليس درجة مخاطر موحدة.',
                      'Applied according to each rule, not as a universal risk score.',
                    )}
                  >
                    <input
                      name="materiality"
                      type="number"
                      min="0.1"
                      max="10"
                      step="0.1"
                      defaultValue={settings.data.materiality_pct}
                      disabled={!cfo}
                    />
                  </Field>
                  <Field label={tr('مدة الاحتفاظ · أيام', 'Retention period · days')}>
                    <input
                      name="retention"
                      type="number"
                      min="30"
                      max="3650"
                      defaultValue={settings.data.retention_days}
                      disabled={!cfo}
                    />
                  </Field>
                </div>
                <label className="checkbox-label">
                  <input
                    name="leases"
                    type="checkbox"
                    defaultChecked={settings.data.include_leases}
                    disabled={!cfo}
                  />
                  {tr(
                    'إدراج التزامات الإيجار ضمن تعريف صافي الدين',
                    'Include lease liabilities in the net debt definition',
                  )}
                </label>
                <div className="modal-footer">
                  <span className="muted">
                    {tr('نسخة السياسة', 'Policy version')} {settings.data.version}
                  </span>
                  <Button type="submit" disabled={!cfo} busy={busy}>
                    {tr('حفظ السياسة', 'Save policy')}
                  </Button>
                </div>
              </form>
            )}
          </Panel>
          <Panel title={tr('قواعد لا تتغير مع المنظور', 'Rules that survive every perspective')}>
            <div className="policy-point">
              <ShieldCheck size={22} />
              <div>
                <h3>{tr('فصل الإعداد عن الاعتماد', 'Separate preparation and approval')}</h3>
                <p>
                  {tr(
                    'المجهّز لا يعتمد عمله منفردًا.',
                    'A preparer cannot independently approve their own work.',
                  )}
                </p>
              </div>
            </div>
            <div className="policy-point">
              <Database size={22} />
              <div>
                <h3>{tr('الأصل محفوظ', 'Originals preserved')}</h3>
                <p>
                  {tr(
                    'تعديلات الحقائق تحفظ القيمة الأصلية والسبب والنسخة.',
                    'Fact adjustments retain original values, reasons and revisions.',
                  )}
                </p>
              </div>
            </div>
            <div className="policy-point">
              <LockKeyhole size={22} />
              <div>
                <h3>{tr('الصلاحية تسبق رابط التفاصيل', 'Access precedes drill-down')}</h3>
                <p>
                  {tr(
                    'اختيار متلقي التقرير لا يمنح وصولًا إضافيًا.',
                    'Choosing a report audience does not grant additional access.',
                  )}
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}
      {tab === 'team' && (
        <Panel
          title={tr('أعضاء مساحة العمل', 'Workspace members')}
          action={
            cfo && (
              <Button onClick={() => setMember(true)}>
                <Plus size={17} />
                {tr('إضافة عضو', 'Add member')}
              </Button>
            )
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{tr('العضو', 'Member')}</th>
                  <th>{tr('البريد', 'Email')}</th>
                  <th>{tr('الصلاحية', 'Role')}</th>
                </tr>
              </thead>
              <tbody>
                {members.data?.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="row gap">
                        <span className="avatar">{m.name[0]}</span>
                        <strong>{m.name}</strong>
                        {m.id === session.user.id && <Badge>{tr('أنت', 'You')}</Badge>}
                      </div>
                    </td>
                    <td dir="ltr">{m.email}</td>
                    <td>
                      {
                        (
                          {
                            cfo: tr('مدير مالي: مراجعة واعتماد', 'CFO: review & approve'),
                            analyst: tr(
                              'محلل: إعداد ومراجعة البيانات',
                              'Analyst: prepare & review',
                            ),
                            operator: tr('تنفيذ: إجراءات وأدلة', 'Operator: actions & evidence'),
                            board: tr('المجلس: تقارير معتمدة', 'Board: approved reports'),
                          } as Record<string, string>
                        )[m.role]
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Notice>
            {tr(
              'إضافة العضو محلية ولا ترسل دعوة بريدية. يجب تسليم بيانات الدخول للمستخدم عبر قناة مناسبة، ثم تفعيل إدارة هوية مؤسسية قبل الإطلاق العام.',
              'Member provisioning is local and sends no email invitation. Provide credentials through an appropriate channel and configure enterprise identity before broad deployment.',
            )}
          </Notice>
        </Panel>
      )}
      {tab === 'audit' && (
        <Panel
          title={tr('تسلسل الأحداث المسجلة', 'Recorded event history')}
          subtitle={tr(
            'تعديلات واعتمادات وتنزيلات حساسة ضمن مساحة العمل الحالية.',
            'Changes, approvals and sensitive downloads within the current workspace.',
          )}
        >
          {audit.error ? (
            <ErrorBox error={audit.error} />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{tr('الوقت', 'Time')}</th>
                    <th>{tr('الحدث', 'Event')}</th>
                    <th>{tr('المستخدم', 'User')}</th>
                    <th>{tr('المورد', 'Resource')}</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.data?.map((e, i) => (
                    <tr key={e.id || i}>
                      <td className="nowrap">{new Date(e.created_at).toLocaleString(locale)}</td>
                      <td>
                        <code>{e.action}</code>
                      </td>
                      <td>
                        {e.actor_name ||
                          members.data?.find((m) => m.id === e.user_id)?.name ||
                          e.user_id?.slice(0, 8)}
                      </td>
                      <td className="mono">
                        {e.resource_type} {e.resource_id?.slice(0, 8)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      {tab === 'capabilities' && (
        <>
          <Notice type="warning">
            {tr(
              'هذه حالة التنفيذ الحالية، وليست شهادة جاهزية إنتاجية. مساحة التشغيل المحلية لا تتضمن مزود بيانات عالميًا أو ERP أو إرسال بريد أو SSO أو تشفير تخزين تطبيقي.',
              'This is the actual implementation state, not production certification. The local workspace does not include a global data provider, ERP connector, email delivery, SSO or application-level storage encryption.',
            )}
          </Notice>
          <div className="capability-grid">
            {caps.data &&
              Object.entries(caps.data)
                .filter(([, v]) => typeof v === 'object' && v !== null)
                .map(([key, value]) => (
                  <Panel
                    key={key}
                    title={
                      (
                        {
                          database: tr('قاعدة البيانات', 'Database'),
                          storage: tr('المستندات والتخزين', 'Document storage'),
                          extraction: tr('قراءة الملفات', 'Extraction'),
                          ai: tr('المساعد المالي', 'Financial assistant'),
                          integrations: tr('التكاملات', 'Integrations'),
                          authentication: tr('الهوية والوصول', 'Identity & access'),
                          deployment: tr('بيئة التشغيل', 'Deployment'),
                        } as Record<string, string>
                      )[key] || key
                    }
                  >
                    <dl className="capability-list">
                      {Object.entries(value).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k.replaceAll('_', ' ')}</dt>
                          <dd>
                            <span
                              className={`cap-status ${v === false || String(v).includes('not_') ? 'not-ready' : ''}`}
                            >
                              {typeof v === 'boolean'
                                ? v
                                  ? tr('نعم', 'Yes')
                                  : tr('لا', 'No')
                                : String(v)}
                            </span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </Panel>
                ))}
          </div>
          <Panel title={tr('الربط يبدأ بعقد بيانات', 'Integration starts with a data contract')}>
            <p>
              {tr(
                'يمكن استيراد الملفات يدويًا الآن. ربط ERP أو بيانات النظراء يتطلب مصدرًا مصرحًا، وحساب وصول للقراءة فقط، وخريطة بنود واختبارات مصالحة. الخدمات غير المهيأة لا تعرض نجاحًا وهميًا.',
                'Manual file import works today. ERP or peer-data connections require an authorized source, read-only credentials, a mapping contract and reconciliation tests. Unconfigured services do not report simulated success.',
              )}
            </p>
          </Panel>
        </>
      )}
      <Modal
        open={member}
        onClose={() => setMember(false)}
        title={tr('إضافة مستخدم بصلاحية محددة', 'Provision a user with a defined role')}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const f = new FormData(e.currentTarget);
            try {
              await post('/members', Object.fromEntries(f));
              await members.refetch();
              setMember(false);
              notify(tr('أُضيف العضو دون إرسال بريد', 'Member added; no email sent'));
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={tr('الاسم', 'Name')}>
            <input name="name" required />
          </Field>
          <Field label={tr('البريد', 'Email')}>
            <input name="email" type="email" required dir="ltr" autoComplete="off" />
          </Field>
          <Field
            label={tr(
              'كلمة مرور أولية · 12 حرفًا على الأقل',
              'Initial password · at least 12 characters',
            )}
          >
            <input
              name="password"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </Field>
          <Field label={tr('الصلاحية', 'Role')}>
            <select name="role">
              <option value="analyst">{tr('محلل مالي', 'Financial analyst')}</option>
              <option value="operator">{tr('مسؤول تنفيذ', 'Action operator')}</option>
              <option value="cfo">{tr('مدير مالي / معتمد', 'CFO / approver')}</option>
              <option value="board">{tr('قارئ مجلس', 'Board reader')}</option>
            </select>
          </Field>
          {!!error && <ErrorBox error={error} />}
          <div className="modal-footer">
            <Button type="submit" busy={busy}>
              {tr('إضافة العضو', 'Add member')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
