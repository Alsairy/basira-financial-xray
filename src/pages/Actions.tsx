import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpLeft,
  CalendarDays,
  CheckCircle2,
  LayoutGrid,
  List,
  Paperclip,
  Plus,
  ShieldCheck,
  Target,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, fileBase64, post } from '../api';
import {
  Badge,
  Button,
  Empty,
  ErrorBox,
  Field,
  Modal,
  Notice,
  PageTitle,
  Panel,
} from '../components/ui';
import { format, statusLabels, useApp } from '../context';
import type { Action, User } from '../types';
const transitions: Record<string, string[]> = {
  draft: ['approved'],
  approved: ['in_progress', 'blocked'],
  in_progress: ['blocked', 'pending_verification'],
  blocked: ['in_progress'],
  pending_verification: ['closed', 'in_progress'],
  closed: ['reopened'],
  benefit_verified: ['reopened'],
  reopened: ['in_progress'],
};
export default function Actions() {
  const { tr, entityId, session, refresh } = useApp();
  const [newAction, setNewAction] = useState(false),
    [selected, setSelected] = useState(''),
    [view, setView] = useState('board'),
    [filter, setFilter] = useState('all');
  const query = useQuery({
    queryKey: ['actions', entityId],
    queryFn: () => api<Action[]>(`/actions?entity_id=${entityId}`),
    enabled: !!entityId,
  });
  const members = useQuery({ queryKey: ['members'], queryFn: () => api<User[]>('/members') });
  const params = new URLSearchParams(location.hash.split('?')[1]);
  const findingId = params.get('finding') || '';
  useEffect(() => {
    if (findingId) setNewAction(true);
    if (params.get('id')) setSelected(params.get('id')!);
  }, [findingId, location.hash]);
  const reload = async () => {
    await query.refetch();
    await refresh();
  };
  const actions = (query.data || []).filter(
    (a) =>
      filter === 'all' ||
      (filter === 'mine'
        ? a.owner_id === session.user.id
        : !['closed', 'benefit_verified'].includes(a.status) &&
          a.due_date < new Date().toISOString().slice(0, 10)),
  );
  return (
    <>
      <PageTitle
        eyebrow={tr('الأثر مسؤولية، لا مجرد توصية', 'BENEFIT HAS AN OWNER')}
        title={tr('مساحة الإجراءات', 'Action workspace')}
        description={tr(
          'من ملاحظة موثّقة إلى تنفيذ، ثم تحقق مستقل من النتيجة.',
          'From a supported finding to execution, then independent verification.',
        )}
        action={
          ['cfo', 'analyst'].includes(session.user.role) && (
            <Button onClick={() => setNewAction(true)}>
              <Plus size={18} />
              {tr('إجراء جديد', 'New action')}
            </Button>
          )
        }
      />
      <div className="action-summary">
        <Panel>
          <Target size={21} />
          <strong>
            {
              (query.data || []).filter((a) => !['closed', 'benefit_verified'].includes(a.status))
                .length
            }
          </strong>
          <span>{tr('مفتوح', 'Open')}</span>
        </Panel>
        <Panel>
          <ShieldCheck size={21} />
          <strong>
            {(query.data || []).filter((a) => a.status === 'pending_verification').length}
          </strong>
          <span>{tr('بانتظار التحقق', 'Awaiting verification')}</span>
        </Panel>
        <Panel>
          <CheckCircle2 size={21} />
          <strong>
            {(query.data || []).filter((a) => a.status === 'benefit_verified').length}
          </strong>
          <span>{tr('أثر معتمد', 'Verified benefits')}</span>
        </Panel>
      </div>
      <div className="filter-bar standalone">
        <div className="segmented">
          {[
            ['all', tr('الكل', 'All')],
            ['mine', tr('مسندة إليّ', 'Assigned to me')],
            ['overdue', tr('متأخرة', 'Overdue')],
          ].map(([k, l]) => (
            <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="segmented">
          <button
            aria-label={tr('لوحة', 'Board')}
            className={view === 'board' ? 'active' : ''}
            onClick={() => setView('board')}
          >
            <LayoutGrid size={17} />
          </button>
          <button
            aria-label={tr('قائمة', 'List')}
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
          >
            <List size={17} />
          </button>
        </div>
      </div>
      {query.error && <ErrorBox error={query.error} />}
      {!actions.length ? (
        <Panel>
          <Empty
            icon={<Target size={32} />}
            title={tr('امنح القرار مسارًا للتنفيذ', 'Give the decision a path to execution')}
            description={tr(
              'أضف إجراءً يوضح المسؤول والموعد وخط الأساس والهدف. لا يظهر أثر محقق دون دليل ومراجع مستقل.',
              'Add an owner, due date, baseline and target. Realized benefits require evidence and independent review.',
            )}
            action={
              ['cfo', 'analyst'].includes(session.user.role) && (
                <Button onClick={() => setNewAction(true)}>
                  <Plus size={17} />
                  {tr('إنشاء أول إجراء', 'Create first action')}
                </Button>
              )
            }
          />
        </Panel>
      ) : view === 'board' ? (
        <div className="kanban">
          {[
            { title: tr('للمراجعة', 'To approve'), s: ['draft'] },
            {
              title: tr('قيد التنفيذ', 'In progress'),
              s: ['approved', 'in_progress', 'blocked', 'reopened'],
            },
            { title: tr('للتحقق', 'To verify'), s: ['pending_verification'] },
            { title: tr('مقفل', 'Closed'), s: ['closed', 'benefit_verified'] },
          ].map((col) => (
            <section className="kanban-column" key={col.title}>
              <header>
                <h2>{col.title}</h2>
                <span>{actions.filter((a) => col.s.includes(a.status)).length}</span>
              </header>
              {actions
                .filter((a) => col.s.includes(a.status))
                .map((a) => (
                  <button className="action-card" key={a.id} onClick={() => setSelected(a.id)}>
                    <div className="row between">
                      <Badge status={a.status} />
                      <ArrowUpLeft size={15} />
                    </div>
                    <h3>{a.title}</h3>
                    <p>{a.description}</p>
                    <div className="action-card-target">
                      <Target size={14} />
                      <span>
                        {format(a.baseline)} ← {format(a.target)} {a.unit}
                      </span>
                    </div>
                    <footer>
                      <span>
                        <UserRound size={14} />
                        {members.data?.find((m) => m.id === a.owner_id)?.name ||
                          tr('مسؤول الإجراء', 'Action owner')}
                      </span>
                      <span
                        className={
                          a.due_date < new Date().toISOString().slice(0, 10) &&
                          !['closed', 'benefit_verified'].includes(a.status)
                            ? 'overdue'
                            : ''
                        }
                      >
                        <CalendarDays size={14} />
                        {a.due_date}
                      </span>
                    </footer>
                  </button>
                ))}
              {!actions.some((a) => col.s.includes(a.status)) && (
                <p className="kanban-empty">
                  {tr('لا إجراءات في هذه المرحلة', 'No actions in this stage')}
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <Panel>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{tr('الإجراء', 'Action')}</th>
                  <th>{tr('المسؤول', 'Owner')}</th>
                  <th>{tr('الموعد', 'Due date')}</th>
                  <th>{tr('الحالة', 'Status')}</th>
                  <th>{tr('نوع الأثر', 'Effect type')}</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <button className="cell-link" onClick={() => setSelected(a.id)}>
                        {a.title}
                      </button>
                    </td>
                    <td>{members.data?.find((m) => m.id === a.owner_id)?.name}</td>
                    <td dir="ltr">{a.due_date}</td>
                    <td>
                      <Badge status={a.status} />
                    </td>
                    <td>
                      <Badge status={a.effect_type} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <CreateAction
        open={newAction}
        onClose={() => setNewAction(false)}
        members={members.data || []}
        findingId={findingId}
        onDone={reload}
      />
      {selected && (
        <ActionDetail
          id={selected}
          members={members.data || []}
          onClose={() => setSelected('')}
          onDone={reload}
        />
      )}
    </>
  );
}
function CreateAction({
  open,
  onClose,
  members,
  findingId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  members: User[];
  findingId: string;
  onDone: () => Promise<unknown>;
}) {
  const { tr, entityId, dashboard, session } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const finding = dashboard?.analysis?.findings.find((f) => f.id === findingId);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr('إجراء له مسؤول ونتيجة', 'An action with an owner and outcome')}
      description={tr(
        'افصل إنجاز العمل عن تحقق الأثر المالي. كلاهما يحتاج دليلًا.',
        'Separate completing the work from realizing a financial benefit. Both require evidence.',
      )}
      wide
    >
      <form
        key={findingId}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          try {
            await post('/actions', {
              entity_id: entityId,
              ...(finding ? { analysis_id: dashboard?.analysis?.id, finding_id: finding.id } : {}),
              title: f.get('title'),
              description: f.get('description'),
              owner_id: f.get('owner_id'),
              due_date: f.get('due_date'),
              baseline: Number(f.get('baseline')),
              target: Number(f.get('target')),
              unit: f.get('unit'),
              effect_type: f.get('effect_type'),
              dependency_group: f.get('dependency_group') || undefined,
            });
            await onDone();
            onClose();
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={tr('عنوان الإجراء', 'Action title')}>
          <input
            name="title"
            required
            defaultValue={finding ? tr(finding.title_ar, finding.title_en) : ''}
            maxLength={200}
          />
        </Field>
        <Field
          label={tr(
            'ما الذي سينفّذ، وكيف نعرف أنه اكتمل؟',
            'What will be done, and how will completion be evidenced?',
          )}
        >
          <textarea
            name="description"
            required
            defaultValue={finding ? tr(finding.action_ar, finding.action_en) : ''}
          />
        </Field>
        <div className="form-grid">
          <Field label={tr('المسؤول', 'Owner')}>
            <select
              name="owner_id"
              required
              defaultValue={members.find((m) => m.role === 'operator')?.id || session.user.id}
            >
              {members
                .filter((m) => m.role !== 'board')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={tr('الموعد المستهدف', 'Due date')}>
            <input name="due_date" type="date" required />
          </Field>
          <Field label={tr('خط الأساس', 'Baseline')}>
            <input name="baseline" type="number" step="any" required dir="ltr" />
          </Field>
          <Field label={tr('الهدف', 'Target')}>
            <input name="target" type="number" step="any" required dir="ltr" />
          </Field>
          <Field label={tr('الوحدة', 'Unit')}>
            <select name="unit">
              <option value="days">{tr('أيام', 'Days')}</option>
              <option value="SAR">{tr('ريال', 'SAR')}</option>
              <option value="percent">{tr('نسبة مئوية', 'Percent')}</option>
              <option value="number">{tr('عدد', 'Count')}</option>
            </select>
          </Field>
          <Field label={tr('نوع الأثر', 'Effect type')}>
            <select name="effect_type">
              <option value="cash_release">{tr('تحرير نقد', 'Cash release')}</option>
              <option value="annual_profit">{tr('ربح سنوي', 'Annual profit')}</option>
              <option value="financing_saving">{tr('وفر تمويل', 'Financing saving')}</option>
              <option value="risk_exposure">{tr('تعرض للمخاطر', 'Risk exposure')}</option>
            </select>
          </Field>
        </div>
        <Field
          label={tr('مجموعة التداخل', 'Overlap / dependency group')}
          hint={tr(
            'استخدم نفس المجموعة للمبادرات التي تتناول النقد أو الأثر نفسه.',
            'Use the same group for initiatives addressing the same cash or benefit.',
          )}
        >
          <input name="dependency_group" placeholder="receivables-collection" dir="ltr" />
        </Field>
        {!!error && <ErrorBox error={error} />}
        <div className="modal-footer">
          <Button variant="secondary" type="button" onClick={onClose}>
            {tr('إلغاء', 'Cancel')}
          </Button>
          <Button type="submit" busy={busy}>
            {tr('إنشاء مسودة الإجراء', 'Create draft action')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function ActionDetail({
  id,
  members,
  onClose,
  onDone,
}: {
  id: string;
  members: User[];
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const { tr, locale, session, notify } = useApp();
  const query = useQuery({
    queryKey: ['action', id],
    queryFn: () => api<Action>(`/actions/${id}`),
  });
  const [tab, setTab] = useState('details'),
    [reason, setReason] = useState(''),
    [next, setNext] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState<unknown>(null);
  const a = query.data;
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await query.refetch();
      await onDone();
      notify(tr('حُفظ التحديث', 'Update saved'));
    } catch (e) {
      setError(e);
    } finally {
      setBusy('');
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={a?.title || tr('الإجراء', 'Action')}
      description={tr(
        'تنفيذ موثّق · تحقق مستقل · أثر قابل للقياس',
        'Documented execution · independent verification · measurable impact',
      )}
      wide
    >
      {a && (
        <>
          <div className="row gap wrap">
            <Badge status={a.status} />
            <Badge status={a.effect_type} />
            <span className="muted">v{a.version}</span>
          </div>
          <div className="tab-bar" role="tablist">
            {[
              ['details', tr('التفاصيل', 'Details')],
              ['evidence', tr('الأدلة', 'Evidence')],
              ['benefit', tr('إثبات الأثر', 'Verify benefit')],
              ['history', tr('السجل', 'History')],
            ].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>
          {!!error && <ErrorBox error={error} />}{' '}
          {tab === 'details' && (
            <>
              <p className="lead">{a.description}</p>
              <dl className="detail-grid">
                <div>
                  <dt>{tr('المسؤول', 'Owner')}</dt>
                  <dd>{members.find((m) => m.id === a.owner_id)?.name}</dd>
                </div>
                <div>
                  <dt>{tr('الموعد', 'Due')}</dt>
                  <dd dir="ltr">{a.due_date}</dd>
                </div>
                <div>
                  <dt>{tr('خط الأساس', 'Baseline')}</dt>
                  <dd>
                    {format(a.baseline)} {a.unit}
                  </dd>
                </div>
                <div>
                  <dt>{tr('الهدف', 'Target')}</dt>
                  <dd>
                    {format(a.target)} {a.unit}
                  </dd>
                </div>
              </dl>
              <Notice>
                {tr(
                  'الإقفال يتطلب دليل تنفيذ ومراجعًا مستقلًا. اعتماد الأثر المالي مرحلة لاحقة.',
                  'Closure requires execution evidence and an independent reviewer. Financial benefit approval is a separate step.',
                )}
              </Notice>
              {session.user.role !== 'board' && (
                <>
                  <Field label={tr('الانتقال إلى', 'Move to')}>
                    <select value={next} onChange={(e) => setNext(e.target.value)}>
                      <option value="">{tr('اختر الحالة التالية', 'Select next status')}</option>
                      {(transitions[a.status] || [])
                        .filter(
                          (s) =>
                            session.user.role === 'cfo' ||
                            !['approved', 'closed', 'reopened'].includes(s),
                        )
                        .map((s) => (
                          <option key={s} value={s}>
                            {statusLabels[s]?.[locale === 'ar' ? 0 : 1] || s}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field
                    label={tr(
                      'سبب الانتقال أو نتيجة التحقق',
                      'Transition reason / verification conclusion',
                    )}
                  >
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                  </Field>
                  <Button
                    disabled={!next || !reason.trim()}
                    busy={busy === 'transition'}
                    onClick={() =>
                      run('transition', () =>
                        post(`/actions/${id}/transition`, {
                          version: a.version,
                          status: next,
                          reason,
                        }),
                      )
                    }
                  >
                    {tr('تسجيل الانتقال', 'Record transition')}
                  </Button>
                </>
              )}
            </>
          )}
          {tab === 'evidence' && (
            <>
              {a.evidence?.map((e) => (
                <div className="evidence-card" key={e.id}>
                  <Paperclip size={20} />
                  <div>
                    <strong>{e.title}</strong>
                    <p>{e.note}</p>
                    {e.filename && (
                      <a
                        className="text-link"
                        href={`/api/actions/${id}/evidence/${e.id}/content`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {e.filename}
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {!a.evidence?.length && <Empty title={tr('لم يرفق دليل بعد', 'No evidence yet')} />}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget),
                    file = f.get('file') as File;
                  void run('evidence', async () =>
                    post(`/actions/${id}/evidence`, {
                      title: f.get('title'),
                      note: f.get('note'),
                      ...(file?.size
                        ? { filename: file.name, content_base64: await fileBase64(file) }
                        : {}),
                    }),
                  );
                }}
              >
                <Field label={tr('عنوان الدليل', 'Evidence title')}>
                  <input name="title" required />
                </Field>
                <Field
                  label={tr('ما الذي يثبته هذا الدليل؟', 'What does this evidence establish?')}
                >
                  <textarea name="note" required />
                </Field>
                <Field label={tr('مرفق اختياري', 'Optional attachment')}>
                  <input name="file" type="file" accept=".pdf,.csv,.xlsx,.png,.jpg,.txt" />
                </Field>
                <Button type="submit" busy={busy === 'evidence'}>
                  <Paperclip size={16} />
                  {tr('حفظ الدليل', 'Save evidence')}
                </Button>
              </form>
            </>
          )}
          {tab === 'benefit' && (
            <>
              <Notice>
                {tr(
                  'لا يكفي إنجاز العمل لإثبات الأثر. يلزم مبلغ وفترة وطريقة قياس وعوامل أخرى، واعتماد مستقل عن المنفذ.',
                  'Completing work does not prove a benefit. An amount, period, method, confounders and independent approval are required.',
                )}
              </Notice>
              {!['currency', 'SAR', 'sar'].includes(a.unit) && (
                <Notice type="warning">
                  {tr(
                    'وحدة هذا الإجراء غير نقدية. يمكن إقفاله تشغيليًا؛ اعتماد مبلغ مالي يتطلب إجراءً نقديًا مرتبطًا وخط أساس بالعملة ودليل قياس.',
                    'This action has a non-monetary unit. It can close operationally; a monetary benefit requires a linked currency-baseline action and measurement evidence.',
                  )}
                </Notice>
              )}
              {a.benefits?.map((benefit) => (
                <div className="approved-benefit" key={benefit.id}>
                  <CheckCircle2 size={22} />
                  <strong>{format(Number(benefit.amount), 'currency', true, locale)}</strong>
                  <Badge status="benefit_verified" />
                  <small>
                    {benefit.period_start} — {benefit.period_end}
                  </small>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run('benefit', () =>
                    post(`/actions/${id}/benefit`, {
                      baseline: Number(f.get('baseline')),
                      actual: Number(f.get('actual')),
                      amount: Number(f.get('amount')),
                      effect_type: a.effect_type,
                      period_start: f.get('period_start'),
                      period_end: f.get('period_end'),
                      method: f.get('method'),
                      confounders: f.get('confounders'),
                    }),
                  );
                }}
              >
                <div className="form-grid">
                  <Field label={tr('خط الأساس', 'Baseline')}>
                    <input
                      name="baseline"
                      type="number"
                      step="any"
                      defaultValue={a.baseline}
                      required
                    />
                  </Field>
                  <Field label={tr('النتيجة الفعلية', 'Actual result')}>
                    <input name="actual" type="number" step="any" required />
                  </Field>
                  <Field label={tr('الأثر المقاس · ريال', 'Measured benefit · SAR')}>
                    <input name="amount" type="number" step="any" required />
                  </Field>
                  <Field label={tr('بداية القياس', 'Measurement start')}>
                    <input name="period_start" type="date" required />
                  </Field>
                  <Field label={tr('نهاية القياس', 'Measurement end')}>
                    <input name="period_end" type="date" required />
                  </Field>
                </div>
                <Field
                  label={tr('طريقة القياس ومصدر المبلغ', 'Measurement method and amount source')}
                >
                  <textarea name="method" required />
                </Field>
                <Field
                  label={tr(
                    'العوامل الأخرى والتداخل مع المبادرات',
                    'Confounders and overlap with other initiatives',
                  )}
                >
                  <textarea name="confounders" required />
                </Field>
                <Button
                  type="submit"
                  busy={busy === 'benefit'}
                  disabled={
                    session.user.role !== 'cfo' ||
                    a.status !== 'closed' ||
                    [a.owner_id, a.created_by].includes(session.user.id)
                  }
                >
                  <ShieldCheck size={17} />
                  {tr('التحقق واعتماد الأثر', 'Verify & approve benefit')}
                </Button>
              </form>
            </>
          )}
          {tab === 'history' && (
            <div className="timeline">
              {a.history?.map((h, i) => (
                <div key={i}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>
                      {h.status
                        ? statusLabels[h.status]?.[locale === 'ar' ? 0 : 1] || h.status
                        : h.event || h.action}
                    </strong>
                    <p>{h.reason}</p>
                    <small>
                      {h.actor_name || members.find((m) => m.id === h.by)?.name} ·{' '}
                      {h.created_at || h.at
                        ? new Date(h.created_at || h.at!).toLocaleString(locale)
                        : '—'}
                    </small>
                  </div>
                </div>
              ))}
              {!a.history?.length && (
                <Empty title={tr('لا انتقالات مسجلة بعد', 'No transitions yet')} />
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
