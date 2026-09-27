import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  CheckCheck,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, fileBase64, patch, post } from '../api';
import {
  Badge,
  Button,
  Confirm,
  Empty,
  ErrorBox,
  Field,
  Modal,
  Notice,
  PageTitle,
  Panel,
} from '../components/ui';
import VersionHistory from '../components/VersionHistory';
import { format, useApp } from '../context';
import type { Dataset, Document, Fact } from '../types';
export default function Data() {
  const { tr, locale, entityId, dashboard, refresh, inspect, notify, session } = useApp();
  const [upload, setUpload] = useState(false),
    [selectedId, setSelectedId] = useState(''),
    [search, setSearch] = useState(''),
    [period, setPeriod] = useState('all'),
    [reviewFilter, setReviewFilter] = useState('all'),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [edit, setEdit] = useState<Fact | null>(null),
    [busy, setBusy] = useState(''),
    [error, setError] = useState<unknown>(null),
    [tab, setTab] = useState('facts'),
    [manual, setManual] = useState(false);
  const list = useQuery({
    queryKey: ['datasets', entityId],
    queryFn: () => api<Dataset[]>(`/datasets?entity_id=${entityId}`),
    enabled: !!entityId,
  });
  const docs = useQuery({
    queryKey: ['documents', entityId],
    queryFn: () => api<Document[]>(`/documents?entity_id=${entityId}`),
    enabled: !!entityId,
  });
  const id = selectedId || dashboard?.dataset?.id || list.data?.[0]?.id;
  const query = useQuery({
    queryKey: ['dataset', id],
    queryFn: () => api<Dataset>(`/datasets/${id}`),
    enabled: !!id,
  });
  const dataset = query.data;
  const reload = async () => {
    await Promise.all([query.refetch(), list.refetch(), docs.refetch(), refresh()]);
    setSelected(new Set());
  };
  useEffect(() => {
    setSelectedId('');
    setPage(0);
  }, [entityId]);
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy('');
    }
  };
  const filtered = (dataset?.facts || []).filter(
    (f) =>
      (period === 'all' || f.period === period) &&
      (reviewFilter === 'all' || f.review_status === reviewFilter) &&
      `${f.label_ar} ${f.label_en} ${f.concept} ${f.source.cell || ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const visible = filtered.slice(page * 30, (page + 1) * 30),
    canEdit = ['cfo', 'analyst'].includes(session.user.role);
  const allReviewed =
    dataset?.facts.length && dataset.facts.every((f) => f.review_status === 'reviewed');
  return (
    <>
      <PageTitle
        eyebrow={tr('المصدر أولًا', 'SOURCE FIRST')}
        title={tr('مركز البيانات والمراجعة', 'Data & review center')}
        description={tr(
          'احتفظ بالأصل، راجع ربط البنود، وصالح المجاميع قبل اعتماد التحليل.',
          'Preserve the original, review mappings, and reconcile before approval.',
        )}
        action={
          canEdit && (
            <Button onClick={() => setUpload(true)}>
              <Upload size={17} />
              {tr('رفع قوائم', 'Upload statements')}
            </Button>
          )
        }
      />
      {!!error && <ErrorBox error={error} />}
      <div className="journey-steps">
        {[
          [tr('استيراد المستند', 'Import document'), !!dataset],
          [tr('مراجعة الحقائق', 'Review facts'), !!allReviewed],
          [tr('اعتماد مستقل', 'Independent approval'), dataset?.status === 'approved'],
        ].map(([label, done], i) => (
          <div key={i} className={done ? 'complete' : ''}>
            <span>{done ? <Check size={16} /> : i + 1}</span>
            <b>{label}</b>
          </div>
        ))}
      </div>
      {!dataset ? (
        <Panel>
          <Empty
            title={tr('أول خطوة: مستند موثوق', 'First step: a reliable source')}
            description={tr(
              'Excel وCSV وPDF نصي. الملفات الممسوحة تحتاج مراجعة واستخراجًا يدويًا عند غياب OCR.',
              'Excel, CSV and text PDF. Scanned documents require manual mapping when OCR is unavailable.',
            )}
            action={
              canEdit && (
                <Button onClick={() => setUpload(true)}>
                  <Upload size={17} />
                  {tr('اختيار ملف', 'Choose a file')}
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <>
          <div className="data-toolbar">
            <label className="inline-field">
              <span>{tr('نسخة البيانات', 'Dataset')}</span>
              <select
                value={id || ''}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setPage(0);
                }}
              >
                {list.data?.map((d, i) => (
                  <option key={d.id} value={d.id}>
                    {docs.data?.find((f) => f.id === d.document_id)?.filename ||
                      tr('نسخة', 'Dataset')}{' '}
                    · {d.version || i + 1}
                  </option>
                ))}
              </select>
            </label>
            <Badge status={dataset.status} />
            <span className="muted">
              {dataset.facts.length} {tr('حقيقة مالية', 'financial facts')} · v{dataset.version}
            </span>
            <a
              href={`/api/documents/${dataset.document_id}/content`}
              className="text-link"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={15} />
              {tr('المستند الأصلي', 'Original file')}
            </a>
          </div>
          {!!dataset.warnings?.length && (
            <Notice type="warning">
              <details>
                <summary>
                  {tr('ملاحظات على جودة المدخلات', 'Input quality notes')} (
                  {dataset.warnings.length})
                </summary>
                <ul>
                  {dataset.warnings.map((w, i) => (
                    <li key={i}>{typeof w === 'string' ? w : JSON.stringify(w)}</li>
                  ))}
                </ul>
              </details>
            </Notice>
          )}
          <div className="tab-bar" role="tablist" aria-label={tr('مراجعة البيانات', 'Data review')}>
            {[
              ['facts', tr('الحقائق والربط', 'Facts & mapping')],
              ['checks', tr('المصالحة', 'Reconciliation')],
              ['source', tr('معاينة المصدر', 'Source preview')],
              ['files', tr('المستندات', 'Documents')],
              ['versions', tr('النسخ والتعديلات', 'Versions & adjustments')],
            ].map(([key, label]) => (
              <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'facts' && (
            <Panel>
              <div className="filter-bar">
                <div className="search-field">
                  <Search size={17} />
                  <input
                    aria-label={tr('البحث في البنود', 'Search facts')}
                    placeholder={tr(
                      'ابحث عن بند، مفهوم، أو خلية…',
                      'Search a label, concept, or cell…',
                    )}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                <select
                  aria-label={tr('الفترة', 'Period')}
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">{tr('كل الفترات', 'All periods')}</option>
                  {dataset.periods.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <select
                  aria-label={tr('حالة المراجعة', 'Review status')}
                  value={reviewFilter}
                  onChange={(e) => {
                    setReviewFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">{tr('كل الحالات', 'All statuses')}</option>
                  <option value="needs_review">{tr('يحتاج مراجعة', 'Needs review')}</option>
                  <option value="reviewed">{tr('تمت المراجعة', 'Reviewed')}</option>
                </select>
                {canEdit && (
                  <Button variant="ghost" onClick={() => setManual(true)}>
                    <Plus size={16} />
                    {tr('إضافة بند', 'Add fact')}
                  </Button>
                )}
              </div>
              {selected.size > 0 && (
                <div className="selection-bar">
                  <span>
                    {selected.size} {tr('بند محدد', 'facts selected')}
                  </span>
                  <Button
                    variant="secondary"
                    busy={busy === 'batch'}
                    onClick={() =>
                      run('batch', async () => {
                        await patch(`/datasets/${id}/facts`, {
                          version: dataset.version,
                          updates: [...selected].map((id) => ({ id, review_status: 'reviewed' })),
                          reason: tr(
                            'راجعت البنود المحددة ومراجعها في المستند الأصلي',
                            'Reviewed selected facts against the original source',
                          ),
                        });
                        notify(tr('سُجلت المراجعة', 'Review recorded'));
                      })
                    }
                  >
                    <CheckCheck size={16} />
                    {tr('تأكيد مراجعة المحدد ومصادره', 'Confirm selected facts & sources reviewed')}
                  </Button>
                </div>
              )}
              <div className="table-scroll">
                <table className="facts-table">
                  <thead>
                    <tr>
                      {canEdit && (
                        <th>
                          <input
                            type="checkbox"
                            aria-label={tr('تحديد الصفحة الحالية', 'Select current page')}
                            checked={visible.length > 0 && visible.every((f) => selected.has(f.id))}
                            onChange={(e) =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                visible.forEach((f) =>
                                  e.target.checked ? next.add(f.id) : next.delete(f.id),
                                );
                                return next;
                              })
                            }
                          />
                        </th>
                      )}
                      <th>{tr('البند المالي', 'Financial fact')}</th>
                      <th>{tr('الفترة', 'Period')}</th>
                      <th>{tr('القيمة الموحّدة · ريال', 'Normalized value · SAR')}</th>
                      <th>{tr('المصدر', 'Source')}</th>
                      <th>{tr('الحالة', 'Status')}</th>
                      {canEdit && <th>{tr('مراجعة', 'Review')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((f) => (
                      <tr key={f.id}>
                        {canEdit && (
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`${tr('تحديد', 'Select')} ${f.label_ar} ${f.period}`}
                              checked={selected.has(f.id)}
                              onChange={(e) =>
                                setSelected((prev) => {
                                  const n = new Set(prev);
                                  e.target.checked ? n.add(f.id) : n.delete(f.id);
                                  return n;
                                })
                              }
                            />
                          </td>
                        )}
                        <td>
                          <button className="cell-link" onClick={() => inspect(f)}>
                            {tr(f.label_ar, f.label_en)}
                          </button>
                          <small className="block muted" dir="ltr">
                            {f.concept}
                          </small>
                        </td>
                        <td>{f.period}</td>
                        <td className="number">{format(f.value, f.unit)}</td>
                        <td>
                          <button className="source-chip" onClick={() => inspect(f)} dir="ltr">
                            {f.source.cell || `p.${f.source.page || '—'}`}
                          </button>
                        </td>
                        <td>
                          <Badge status={f.review_status} />
                        </td>
                        {canEdit && (
                          <td>
                            <Button variant="ghost" onClick={() => setEdit(f)}>
                              {tr('مراجعة', 'Review')}
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filtered.length && <Empty title={tr('لا توجد بنود مطابقة', 'No matching facts')} />}
              <div className="pagination">
                <span>
                  {tr('عرض', 'Showing')}{' '}
                  {filtered.length ? Math.min(page * 30 + 1, filtered.length) : 0}–
                  {Math.min((page + 1) * 30, filtered.length)} / {filtered.length}
                </span>
                <div className="row gap">
                  <Button
                    variant="ghost"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {tr('السابق', 'Previous')}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={(page + 1) * 30 >= filtered.length}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {tr('التالي', 'Next')}
                  </Button>
                </div>
              </div>
            </Panel>
          )}
          {tab === 'checks' && (
            <Panel
              title={tr('بوابات سلامة البيانات', 'Data integrity gates')}
              subtitle={tr(
                'الفروق المادية تمنع الاعتماد. كل نتيجة تحمل تفسيرًا وتسامحًا معلنًا.',
                'Material differences block approval. Each result has an explicit explanation and tolerance.',
              )}
            >
              {(dataset.checks || []).map((c) => (
                <div className="check-row" key={c.id}>
                  <span className={`check-icon ${c.status === 'pass' ? 'good' : 'warn'}`}>
                    {c.status === 'pass' ? <ShieldCheck size={21} /> : <AlertTriangle size={21} />}
                  </span>
                  <div>
                    <h3>{tr(c.label_ar, c.label_en)}</h3>
                    <p>{tr(c.details_ar, c.details_en)}</p>
                    {c.difference !== undefined && (
                      <small>
                        {tr('الفرق', 'Difference')}: <b dir="ltr">{format(c.difference)}</b> ·{' '}
                        {tr('التسامح', 'Tolerance')}: {format(c.tolerance)}
                      </small>
                    )}
                  </div>
                  <Badge>
                    {c.status === 'pass'
                      ? tr('متصالح', 'Reconciled')
                      : c.status === 'fail'
                        ? tr('يمنع الاعتماد', 'Blocks approval')
                        : tr('يتطلب مراجعة', 'Review needed')}
                  </Badge>
                </div>
              ))}
            </Panel>
          )}
          {tab === 'source' && (
            <Panel title={tr('النص والخلايا المستخرجة', 'Extracted source content')}>
              <div className="source-previews">
                {dataset.source_preview?.map((s, i) => (
                  <details key={i} open={i === 0}>
                    <summary>{s.sheet || `${tr('صفحة', 'Page')} ${s.page}`}</summary>
                    <pre dir="auto">{s.text}</pre>
                  </details>
                ))}
              </div>
            </Panel>
          )}
          {tab === 'versions' && <VersionHistory dataset={dataset} />}
          {tab === 'files' && (
            <Panel title={tr('سجل المستندات', 'Document register')}>
              {docs.data?.map((doc) => (
                <div className="file-row" key={doc.id}>
                  <FileSpreadsheet size={26} />
                  <div>
                    <strong>{doc.filename}</strong>
                    <small className="block muted">
                      {new Date(doc.created_at).toLocaleDateString(locale)} ·{' '}
                      {doc.sha256?.slice(0, 16)}
                    </small>
                  </div>
                  <Badge status={doc.status} />
                  <a
                    className="icon-button"
                    title={tr('تنزيل', 'Download')}
                    href={`/api/documents/${doc.id}/content`}
                  >
                    <Download size={18} />
                  </a>
                  {session.user.role === 'cfo' && (
                    <Confirm
                      title={tr('أرشفة المستند', 'Archive document')}
                      description={tr(
                        'تُطبق سياسة الاحتفاظ وروابط التقارير المعتمدة قبل السماح بالحذف.',
                        'Retention policy and approved report dependencies are checked before deletion.',
                      )}
                      onConfirm={() =>
                        run('archive', () => api(`/documents/${doc.id}`, { method: 'DELETE' }))
                      }
                    >
                      {(open) => (
                        <button
                          className="icon-button"
                          aria-label={tr('أرشفة المستند', 'Archive document')}
                          onClick={open}
                        >
                          <Trash2 size={17} />
                        </button>
                      )}
                    </Confirm>
                  )}
                </div>
              ))}
            </Panel>
          )}
          <div className="approval-bar">
            <div>
              <ShieldCheck size={23} />
              <span>
                <strong>
                  {tr('اعتماد يتطلب مراجعة مستقلة', 'Approval requires independent review')}
                </strong>
                <small>
                  {tr(
                    'أي تعديل لاحق يلغي اعتماد البيانات وينشئ نسخة جديدة.',
                    'Subsequent changes invalidate data approval and create a new revision.',
                  )}
                </small>
              </span>
            </div>
            <div className="row gap">
              <Button
                variant="secondary"
                busy={busy === 'analyze'}
                onClick={() => run('analyze', () => post(`/datasets/${id}/analyze`))}
              >
                <RefreshCw size={16} />
                {tr('إعادة التحليل', 'Recalculate')}
              </Button>
              {session.user.role === 'cfo' && (
                <Button
                  busy={busy === 'approve'}
                  disabled={dataset.status === 'approved'}
                  onClick={() =>
                    run('approve', async () => {
                      await post(`/datasets/${id}/approve`, { version: dataset.version });
                      notify(tr('اعتمدت نسخة البيانات', 'Dataset approved'));
                    })
                  }
                >
                  <ShieldCheck size={16} />
                  {tr('اعتماد البيانات', 'Approve data')}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
      <UploadDialog
        open={upload}
        onClose={() => setUpload(false)}
        onDone={async () => {
          setSelectedId('');
          await reload();
        }}
      />
      {edit && dataset && (
        <FactEditor fact={edit} dataset={dataset} onClose={() => setEdit(null)} onDone={reload} />
      )}
      {dataset && (
        <ManualFact
          open={manual}
          dataset={dataset}
          onClose={() => setManual(false)}
          onDone={reload}
        />
      )}
    </>
  );
}
function UploadDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const { tr, entityId, notify } = useApp();
  const [file, setFile] = useState<File | null>(null),
    [rights, setRights] = useState(false),
    [scale, setScale] = useState('1000'),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [error, setError] = useState<unknown>(null);
  const input = useRef<HTMLInputElement>(null);
  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error(tr('الحد الأعلى 10 ميغابايت', 'Maximum file size is 10 MB'));
      setProgress(tr('جارٍ حفظ المستند وقراءة البيانات…', 'Saving document and extracting data…'));
      const response = await post<{ job_id: string }>('/documents', {
        entity_id: entityId,
        filename: file.name,
        content_base64: await fileBase64(file),
        rights_confirmed: rights,
        currency: 'SAR',
        scale: Number(scale),
      });
      let complete = false;
      for (let i = 0; i < 90; i++) {
        const job = await api<{ status: string; error?: string; progress?: number }>(
          `/jobs/${response.job_id}`,
        );
        if (['completed', 'complete', 'succeeded', 'ready'].includes(job.status)) {
          complete = true;
          break;
        }
        if (['failed', 'error'].includes(job.status))
          throw new Error(
            typeof job.error === 'string'
              ? job.error
              : tr('تعذر استخراج الملف', 'File extraction failed'),
          );
        await new Promise((r) => setTimeout(r, 700));
      }
      if (!complete)
        throw new Error(
          tr(
            'تستمر المعالجة في الخلفية؛ حدّث الصفحة لاحقًا.',
            'Processing continues in the background; refresh shortly.',
          ),
        );
      await onDone();
      notify(
        tr('تم الاستيراد. البيانات جاهزة للمراجعة.', 'Imported. Your data is ready for review.'),
      );
      setFile(null);
      setRights(false);
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={tr('ارفع القوائم المالية', 'Upload financial statements')}
      description={tr(
        'يُحفظ المستند الأصلي مع بصمته ومراجع الأرقام المستخرجة.',
        'The original document is retained with its fingerprint and source references.',
      )}
    >
      <div
        className="drop-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) setFile(e.dataTransfer.files[0]);
        }}
      >
        <Upload size={32} />
        <h3>{file ? file.name : tr('اسحب ملفك هنا', 'Drop your file here')}</h3>
        <p>Excel (.xlsx) · CSV · PDF · {tr('حتى 10 ميغابايت', 'up to 10 MB')}</p>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.csv,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
          {tr(file ? 'تغيير الملف' : 'تصفح الملفات', file ? 'Change file' : 'Browse files')}
        </Button>
      </div>
      <Field
        label={tr('وحدة عرض القيم في المصدر', 'Source display units')}
        hint={tr(
          'اختيار الوحدة الخاطئة يغيّر كل الأرقام. راجع عنوان القوائم.',
          'Wrong units change every figure. Check the statement heading.',
        )}
      >
        <select value={scale} onChange={(e) => setScale(e.target.value)}>
          <option value="1">{tr('ريال', 'Riyals')}</option>
          <option value="1000">{tr('ألف ريال', 'SAR thousands')}</option>
          <option value="1000000">{tr('مليون ريال', 'SAR millions')}</option>
        </select>
      </Field>
      <label className="checkbox-label">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
        <span>
          {tr(
            'لدي صلاحية استخدام هذه البيانات وتحليلها داخل مساحة العمل.',
            'I am authorized to use and analyze this data in this workspace.',
          )}
        </span>
      </label>
      {!!error && <ErrorBox error={error} />}
      <p className="muted" role="status">
        {progress}
      </p>
      <div className="modal-footer">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {tr('إلغاء', 'Cancel')}
        </Button>
        <Button disabled={!file || !rights} busy={busy} onClick={submit}>
          {tr('بدء الاستيراد', 'Import statements')}
        </Button>
      </div>
    </Modal>
  );
}
function FactEditor({
  fact,
  dataset,
  onClose,
  onDone,
}: {
  fact: Fact;
  dataset: Dataset;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const { tr, inspect } = useApp();
  const [value, setValue] = useState(fact.value === null ? '' : String(fact.value)),
    [concept, setConcept] = useState(fact.concept),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title={tr('مراجعة البند المالي', 'Review financial fact')}
      description={`${tr(fact.label_ar, fact.label_en)} · ${fact.period} · ${fact.source.sheet || ''} ${fact.source.cell || ''}`}
    >
      <Notice>
        {tr(
          'القيمة أدناه بالريال الكامل بعد تحويل وحدة المصدر. الأصل يبقى محفوظًا.',
          'The value below is in full currency units after normalization. The original remains preserved.',
        )}
      </Notice>
      <div className="form-grid">
        <Field
          label={tr('القيمة الموحّدة · ريال', 'Normalized value · SAR')}
          hint={tr(
            'اتركه فارغًا إذا كانت القيمة مفقودة؛ لا تستبدل المفقود بصفر.',
            'Leave blank for missing data; do not replace it with zero.',
          )}
        >
          <input type="number" value={value} onChange={(e) => setValue(e.target.value)} dir="ltr" />
        </Field>
        <Field label={tr('المفهوم المالي', 'Financial concept')}>
          <input
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            dir="ltr"
            list="concepts"
          />
          <Concepts />
        </Field>
      </div>
      <Field label={tr('سبب التعديل أو نتيجة المراجعة', 'Adjustment reason or review conclusion')}>
        <textarea
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={tr(
            'مثال: طابقت القيمة مع المصدر وأكدت وحدة الألف',
            'For example: matched against source and verified units',
          )}
        />
      </Field>
      {!!error && <ErrorBox error={error} />}
      <div className="modal-footer">
        <Button variant="secondary" onClick={() => inspect(fact)}>
          {tr('فحص المصدر', 'Inspect source')}
        </Button>
        <Button
          busy={busy}
          disabled={!reason.trim() || !concept.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await patch(`/datasets/${dataset.id}/facts/${fact.id}`, {
                version: dataset.version,
                value: value === '' ? null : Number(value),
                concept,
                review_status: 'reviewed',
                reason,
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
          {tr('حفظ واعتماد المراجعة', 'Save review')}
        </Button>
      </div>
    </Modal>
  );
}
function Concepts() {
  return (
    <datalist id="concepts">
      {[
        'revenue',
        'cogs',
        'gross_profit',
        'ebit',
        'net_income',
        'cfo',
        'cash',
        'deposits',
        'receivables',
        'contract_assets',
        'current_assets',
        'current_liabilities',
        'total_assets',
        'total_liabilities',
        'equity',
        'borrowing_current',
        'borrowing_noncurrent',
        'lease_current',
        'lease_noncurrent',
        'finance_cost',
        'depreciation_amortization',
        'sga',
        'gna',
        'capex',
        'inventory',
        'trade_payables',
        'credit_sales',
        'purchases',
        'ar_allowance',
        'gross_receivables',
      ].map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
  );
}
function ManualFact({
  open,
  dataset,
  onClose,
  onDone,
}: {
  open: boolean;
  dataset: Dataset;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const { tr } = useApp();
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr('إضافة بند موثّق', 'Add a sourced fact')}
      description={tr(
        'للبيانات الإضافية أو الملفات التي تحتاج ربطًا يدويًا.',
        'For supplementary data or documents that need manual mapping.',
      )}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await post(`/datasets/${dataset.id}/facts`, {
              version: dataset.version,
              concept: d.get('concept'),
              label_ar: d.get('label'),
              label_en: d.get('concept'),
              period: d.get('period'),
              value: Number(d.get('value')),
              currency: 'SAR',
              source: { page: Number(d.get('page')), cell: d.get('cell') || undefined },
              reason: d.get('reason'),
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
        <div className="form-grid">
          <Field label={tr('الاسم', 'Label')}>
            <input name="label" required />
          </Field>
          <Field label={tr('المفهوم', 'Concept')}>
            <input name="concept" required list="concepts" dir="ltr" />
            <Concepts />
          </Field>
          <Field label={tr('السنة', 'Year')}>
            <input
              name="period"
              pattern="[0-9]{4}"
              defaultValue={dataset.periods.at(-1)}
              required
              dir="ltr"
            />
          </Field>
          <Field label={tr('القيمة · ريال', 'Value · SAR')}>
            <input name="value" type="number" step="any" required dir="ltr" />
          </Field>
          <Field label={tr('صفحة المصدر', 'Source page')}>
            <input name="page" type="number" min="1" defaultValue="1" required />
          </Field>
          <Field label={tr('الخلية أو المرجع', 'Cell / reference')}>
            <input name="cell" />
          </Field>
        </div>
        <Field label={tr('سبب الإضافة والدليل', 'Reason and evidence')}>
          <textarea name="reason" required />
        </Field>
        {!!error && <ErrorBox error={error} />}
        <div className="modal-footer">
          <Button type="submit" busy={busy}>
            {tr('إضافة مع حفظ المصدر', 'Add with source')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
