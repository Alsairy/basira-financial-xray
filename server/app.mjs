import express from 'express';
import {
  randomUUID,
  randomBytes,
  createHash,
  scrypt as scryptCb,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';
import { invokeEngine } from './engine.mjs';
import {
  audienceConfig,
  buildSections,
  renderReport,
  completeEvidenceReferences,
} from './reports.mjs';
import { authorizedCatalog, renderSelection } from './ai-contract.mjs';
import { getAiSelection } from './ai-transport-anthropic.mjs';
// Free, zero-cost global sector average reference (Phase 1 of the sector-benchmarking
// upgrade) — read once at module load since it is static reference data bundled with the
// app, not per-tenant runtime state like the rest of the store. Separate on purpose from
// the user-curated named-peer cohort in /api/benchmarks: Damodaran publishes an industry
// AVERAGE only (no distribution), so it can never carry a median/quartile/rank the way a
// real peer cohort can.
const globalSectorBenchmarks = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'research', 'global_sector_benchmarks.json'),
    'utf8',
  ),
).sectors;
const scrypt = promisify(scryptCb),
  now = () => new Date().toISOString(),
  id = () => randomUUID();
const roles = ['cfo', 'analyst', 'operator', 'board'],
  financial = ['cfo', 'analyst'];
// A controlled vocabulary for peer/entity comparability, separate from the free-text
// `sector` description. Raw sector strings ("IT services / systems integration (Tadawul:
// Software & Services)" vs "technology") almost never match exactly even when the
// business model genuinely is comparable, which made every real peer set silently
// ineligible. sector_code is optional and additive: when both an entity and a peer carry
// one, it is authoritative for the sector_mismatch check; when either lacks it, the
// original exact-string sector comparison still applies unchanged.
const SECTOR_CODES = ['it_services', 'commercial_services', 'transport_logistics', 'other'];
const METRICS = new Set(
  'revenue_growth ebit_growth gross_margin ebit_margin net_margin sga_ratio ebitda ebitda_margin cfo_to_net_income operating_cash_margin free_cash_flow current_ratio quick_ratio cash_ratio operating_working_capital receivables_days dso dio dpo ccc contract_assets_ratio net_debt net_debt_to_ebitda interest_coverage roa roe roic organic_growth customer_concentration allowance_coverage overdue_receivables_ratio dscr covenant_headroom customer_profit liquidity_forecast'.split(
    ' ',
  ),
);
const EFFECTS = [
  'cash_release',
  'annual_profit',
  'financing_saving',
  'risk_exposure',
  'implementation_cost',
];
const AR_ERRORS = {
  AUTH_REQUIRED: 'يرجى تسجيل الدخول للمتابعة.',
  FORBIDDEN: 'صلاحيتك الحالية لا تسمح بتنفيذ هذا الإجراء.',
  CSRF_REQUIRED: 'انتهت صلاحية حماية الطلب. حدّث الصفحة ثم أعد المحاولة.',
  ORIGIN_REJECTED: 'رُفض الطلب لأنه صادر من موقع غير مصرح به.',
  NOT_FOUND: 'العنصر غير موجود أو غير مصرح لك بالوصول إليه.',
  VERSION_CONFLICT: 'تغير إصدار البيانات أثناء العمل. حدّث الصفحة وراجع التغييرات قبل الحفظ.',
  INDEPENDENT_REVIEW_REQUIRED:
    'يلزم اعتماد مدير مالي مستقل عن الشخص الذي أعد البيانات أو نفذ الإجراء. استخدم عضوًا آخر مخولًا بالمراجعة.',
  REVIEW_INCOMPLETE: 'راجع كل البنود المستخرجة وحدد حالتها صراحة قبل طلب الاعتماد.',
  CHECKS_FAILED:
    'تعذر الاعتماد لوجود فحوص مصالحة أو صيغ غير محسومة. عالج الفحوص الفاشلة ثم أعد التحليل.',
  DATASET_APPROVAL_REQUIRED:
    'اعتمد إصدار البيانات الحالي بمراجعة مستقلة وفق السياسة الحالية قبل اعتماد التقرير.',
  STALE_ANALYSIS:
    'التحليل لا يطابق إصدار البيانات أو السياسة الحالي. أعد التحليل ثم أنشئ تقريرًا جديدًا.',
  STALE_REPORT:
    'تغيرت البيانات أو السياسة أو مراجعة الملاحظات منذ إعداد المسودة. أنشئ تقريرًا جديدًا للاعتماد.',
  IMMUTABLE: 'هذه النسخة معتمدة وثابتة ولا يمكن تعديلها مباشرة.',
  EVIDENCE_REQUIRED: 'أرفق دليل تنفيذ واضح قبل طلب الإغلاق أو إثبات الأثر.',
  INVALID_TRANSITION: 'هذا الانتقال غير متاح من حالة الإجراء الحالية.',
  REOPEN_REQUIRED: 'أعد فتح الإجراء أو أعده إلى التنفيذ قبل تعديل بياناته.',
  BASELINE_LOCKED: 'ثبت خط الأساس وتصنيف الأثر عند اعتماد الإجراء، ولا يمكن تغييرهما بعده.',
  INVALID_OWNER: 'اختر عضوًا من مساحة العمل يملك صلاحية تنفيذ الإجراء.',
  CLOSURE_REQUIRED: 'أغلق الإجراء بمراجعة مستقلة قبل إثبات أثره المالي.',
  EFFECT_MISMATCH: 'يجب أن يطابق نوع الأثر التصنيف المعتمد للإجراء.',
  BASELINE_MISMATCH: 'استخدم خط الأساس المعتمد عند قياس الأثر.',
  BENEFIT_OVERLAP:
    'يوجد أثر مثبت لنفس مجموعة الاعتماد والنوع خلال فترة متداخلة. راجع احتمال احتساب الأثر مرتين.',
  MONETARY_BASELINE_REQUIRED:
    'إثبات الأثر المالي في هذه النسخة يتطلب خط أساس بوحدة نقدية. أنشئ إجراءً نقديًا مرتبطًا مع دليل القياس.',
  BENEFIT_DIRECTION: 'التغير المقاس لا يحقق اتجاه التحسن المطلوب لنوع الأثر.',
  BENEFIT_EXCEEDS_CHANGE: 'الأثر المطالب به أكبر من التغير المقاس في خط الأساس.',
  INVALID_PERIOD: 'بداية فترة القياس يجب ألا تأتي بعد نهايتها.',
  RIGHTS_REQUIRED: 'أكد امتلاكك حق معالجة هذا المستند قبل رفعه.',
  DUPLICATE_DOCUMENT:
    'هذا المستند نفسه محفوظ لهذه المنشأة بالفعل. افتح النسخة الموجودة بدل تكرار الرفع.',
  UNSUPPORTED_FILE: 'صيغة الملف غير مدعومة. استخدم XLSX أو CSV بترميز UTF-8 أو PDF نصيًا.',
  INVALID_FILE: 'محتوى الملف أو ترميزه لا يطابق الصيغة المطلوبة. راجع الملف وأعد رفعه.',
  FILE_TOO_LARGE: 'حجم الملف يجب أن يكون أكبر من صفر وألا يتجاوز 10 ميجابايت.',
  SOURCE_REQUIRED: 'حدد صفحة أو ورقة وخلية أو ملاحظة مصدر واضحة للبند اليدوي.',
  DUPLICATE_FACT: 'يوجد بند بالمفهوم والفترة نفسيهما. عدّل البند الموجود.',
  INVALID_RANGE:
    'ترتيب الفرضيات يجب أن يكون: المنخفضة ثم الأساسية ثم العالية، ضمن الحدود المسموح بها.',
  UNKNOWN_METRIC: 'المؤشر المطلوب غير موجود في قاموس المؤشرات.',
  METRIC_UNAVAILABLE: 'المؤشر غير متاح بأدلة كافية لإجراء هذه المقارنة.',
  ANALYSIS_REQUIRED: 'أنشئ تحليلًا حديثًا للبيانات قبل المتابعة.',
  THIRTEEN_WEEKS_REQUIRED: 'أدخل فرضيات التدفقات لثلاثة عشر أسبوعًا بالضبط.',
  UNKNOWN_SETTING: 'يتضمن الطلب حقل سياسة غير مدعوم.',
  VALIDATION_ERROR:
    'راجع الحقول المطلوبة وصيغ التواريخ والوحدات. يجب إدخال الأرقام كقيم عددية ضمن الحدود المسموح بها.',
  INVALID_CREDENTIALS: 'البريد الإلكتروني أو كلمة المرور غير صحيحين.',
  EMAIL_EXISTS: 'هذا البريد الإلكتروني مسجل بالفعل.',
  WEAK_PASSWORD: 'يجب ألا تقل كلمة المرور عن 12 حرفًا.',
  RATE_LIMIT: 'تجاوزت عدد الطلبات المسموح به مؤقتًا. حاول مجددًا لاحقًا.',
  DEMO_ONLY: 'هذه العملية متاحة لمساحة العرض التجريبي فقط.',
  DEMO_DISABLED: 'الدخول التجريبي غير مفعل في هذه البيئة.',
  INVALID_JSON: 'تعذر قراءة بيانات الطلب. أعد المحاولة من النموذج.',
  BODY_TOO_LARGE: 'حجم الطلب أكبر من الحد المسموح به.',
};
const hash = (x) => createHash('sha256').update(x).digest('hex');
const clone = (x) => structuredClone(x);
class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
const fail = (status, code, message, details) => {
  throw new ApiError(status, code, message, details);
};
const str = (v, key, max = 300, optional = false) => {
  if (optional && (v === undefined || v === null || v === '')) return '';
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    fail(422, 'VALIDATION_ERROR', `Invalid ${key}`);
  return v.trim();
};
const num = (v, key, min = -1e16, max = 1e16) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    fail(422, 'VALIDATION_ERROR', `Invalid ${key}`);
  return v;
};
const enumOf = (v, values, key) => {
  if (!values.includes(v)) fail(422, 'VALIDATION_ERROR', `Invalid ${key}`);
  return v;
};
const currency = (v) => {
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v))
    fail(422, 'VALIDATION_ERROR', 'Invalid currency');
  return v;
};
const date = (v) => {
  if (
    typeof v !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    fail(422, 'VALIDATION_ERROR', 'Invalid date');
  return v;
};
const escapeHtml = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
async function passwordHash(password) {
  str(password, 'password', 256);
  if (password.length < 12)
    fail(422, 'WEAK_PASSWORD', 'Password must contain at least 12 characters');
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
async function passwordMatches(password, stored) {
  if (typeof password !== 'string' || password.length > 256 || !stored) return false;
  const [salt, key] = stored.split(':');
  const value = await scrypt(password, salt, 64),
    expected = Buffer.from(key, 'hex');
  return value.length === expected.length && timingSafeEqual(value, expected);
}
const email = (v) => {
  const x = str(v, 'email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) fail(422, 'VALIDATION_ERROR', 'Invalid email');
  return x;
};

export function createApp(options = {}) {
  const root = resolve(options.root || join(dirname(fileURLToPath(import.meta.url)), '..'));
  const dataDir = resolve(options.dataDir || process.env.BASIRA_DATA_DIR || join(root, 'data'));
  const store = openStore(dataDir),
    db = store.db,
    app = express();
  // Real, primary-source-verified peer companies (docs/research/06_Peer_Benchmark_Dataset_AR.md)
  // — used to auto-seed the demo tenant's peer cohort (see /api/auth/demo) so the demo
  // benchmark chart shows real named peers, not an empty state. Loaded once per app instance,
  // same pattern as globalSectorBenchmarks above; absent in the unlikely case the seed file
  // is ever removed, in which case demo peer-seeding is silently skipped rather than failing.
  const peerSeedPath = join(root, 'docs', 'research', 'peer_benchmarks_seed.json');
  const peerSeed = existsSync(peerSeedPath) ? JSON.parse(readFileSync(peerSeedPath, 'utf8')) : null;
  const engine = async (request, context = {}) => {
    const started = performance.now(),
      started_at = now();
    let status = 'failed';
    try {
      const result = await (options.engine ? options.engine(request) : invokeEngine(root, request));
      status = 'completed';
      return result;
    } finally {
      if (context.req?.auth)
        store.put('usage_event', context.req.auth.tenant_id, {
          id: id(),
          entity_id: context.entity_id,
          dataset_id: context.dataset_id || null,
          job_id: context.job_id || null,
          operation: request.op,
          status,
          duration_ms: Math.round((performance.now() - started) * 1000) / 1000,
          started_at,
          completed_at: now(),
          provider: 'local_python',
          created_by: context.req.auth.id,
          version: 1,
        });
    }
  };
  const prod = process.env.NODE_ENV === 'production',
    demoEnabled = !prod || process.env.ENABLE_DEMO === 'true';
  const capabilities = {
    database: {
      status: 'available',
      provider: 'SQLite',
      persistent: true,
      path_disclosed: false,
      postgresql: 'not_implemented',
    },
    storage: { status: 'available', provider: 'local_filesystem', encrypted_at_rest: false },
    extraction: {
      xlsx: 'available',
      csv: 'available',
      csv_encoding: 'UTF-8',
      text_pdf: 'available',
      ocr: 'not_configured',
      max_bytes: 10485760,
    },
    ai: { mode: 'evidence', provider: 'none', external_requests: false },
    integrations: {
      erp: 'not_configured',
      banking: 'not_configured',
      benchmark_vendor: 'not_configured',
      email: 'not_configured',
    },
    authentication: { provider: 'local_scrypt', sso: 'not_configured', mfa: 'not_implemented' },
    deployment: { mode: 'local_pilot', production_certified: false },
    demo_enabled: demoEnabled,
  };
  const uploadDir = join(dataDir, 'documents');
  mkdirSync(uploadDir, { recursive: true, mode: 0o700 });
  // A process restart fails unfinished local jobs explicitly; there is no external durable queue.
  for (const row of db.prepare("SELECT body,tenant_id FROM resources WHERE kind='job'").all()) {
    const j = JSON.parse(row.body);
    if (['queued', 'running'].includes(j.status)) {
      j.status = 'failed';
      j.error = 'Processing interrupted; upload again';
      store.put('job', row.tenant_id, j);
    }
  }
  const limits = new Map();
  const rate = (key, max) => {
    const t = Date.now();
    let v = limits.get(key);
    if (!v || v.until < t) {
      v = { n: 0, until: t + 900000 };
      limits.set(key, v);
    }
    if (++v.n > max) fail(429, 'RATE_LIMIT', 'Too many requests; try again later');
    if (limits.size > 10000) for (const [k, r] of limits) if (r.until < t) limits.delete(k);
  };
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'SAMEORIGIN',
      'Cache-Control': 'no-store',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
    });
    next();
  });
  app.get('/healthz', (req, res) => res.type('text').send('ok'));
  // Optional shared-password gate for a shared/public deployment (e.g. a demo link handed
  // out for review). Distinct from the app's own per-tenant user auth below: this just
  // keeps the whole app off the open internet when BASIRA_ACCESS_PASSWORD is set. No-op
  // (unset) for local/dev use and for any deployment that doesn't opt in.
  const gatePassword = process.env.BASIRA_ACCESS_PASSWORD || '';
  if (gatePassword) {
    const gateCookie = 'basira_gate',
      gateToken = createHash('sha256').update(gatePassword).digest('hex'),
      gateTokenBuf = Buffer.from(gateToken);
    const gatePage = (failed) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>بصيرة</title>
<style>body{font-family:system-ui,sans-serif;background:#0b1b2b;color:#eef4f6;display:grid;place-items:center;
min-height:100vh;margin:0}form{background:#12283d;padding:2rem 2.5rem;border-radius:12px;max-width:320px;width:90%}
h1{font-size:1.1rem;margin:0 0 1rem}input{width:100%;box-sizing:border-box;padding:.6rem;border-radius:6px;
border:1px solid #2a4459;background:#0b1b2b;color:#eef4f6;margin-bottom:.75rem}button{width:100%;padding:.6rem;
border-radius:6px;border:none;background:#0f9a8f;color:#fff;font-weight:600;cursor:pointer}
.err{color:#f0a2a2;font-size:.85rem;margin:-0.4rem 0 .75rem}</style></head><body>
<form method="post" action="/gate"><h1>بصيرة | Financial X-ray</h1>
${failed ? '<div class="err">كلمة المرور غير صحيحة / Incorrect password</div>' : ''}
<input type="password" name="password" autofocus placeholder="Password" required/>
<button type="submit">Enter</button></form></body></html>`;
    app.get('/gate', (req, res) => res.type('html').send(gatePage(false)));
    app.post('/gate', express.urlencoded({ extended: false }), (req, res) => {
      const ok =
        Buffer.byteLength(String(req.body?.password || '')) === Buffer.byteLength(gatePassword) &&
        timingSafeEqual(Buffer.from(String(req.body?.password || '')), Buffer.from(gatePassword));
      if (!ok) return res.status(401).type('html').send(gatePage(true));
      res.cookie(gateCookie, gateToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: prod,
        maxAge: 90 * 24 * 3600000,
        path: '/',
      });
      res.redirect(302, '/');
    });
    app.use((req, res, next) => {
      if (req.path === '/gate' || req.path === '/healthz') return next();
      const cookie = (req.headers.cookie || '')
        .split(';')
        .map((s) => s.trim())
        .find((x) => x.startsWith(gateCookie + '='));
      const value = cookie ? cookie.slice(gateCookie.length + 1) : '';
      if (
        value.length === gateTokenBuf.length &&
        timingSafeEqual(Buffer.from(value), gateTokenBuf)
      )
        return next();
      if (req.method === 'GET' && !req.path.startsWith('/api'))
        return res.redirect(302, '/gate');
      res.status(401).json({ error: 'GATE_REQUIRED', message: 'Shared access password required' });
    });
  }
  app.use('/api', express.json({ limit: '15mb', strict: true }));
  const wrap = (fn) => (req, res, next) =>
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  app.use(
    '/api',
    wrap(async (req, res, next) => {
      rate(`all:${req.ip}`, 1200);
      const cookie = req.headers.cookie
        ?.split(';')
        .map((x) => x.trim())
        .find((x) => x.startsWith('basira_session='))
        ?.slice(15);
      if (cookie && /^[a-f0-9]{64}$/.test(cookie)) {
        const row = db
          .prepare(
            'SELECT s.csrf,s.expires,u.*,t.name AS tenant_name,t.demo FROM sessions s JOIN users u ON u.id=s.user_id JOIN tenants t ON t.id=u.tenant_id WHERE s.token_hash=?',
          )
          .get(hash(cookie));
        if (row && row.expires > Date.now()) {
          req.auth = row;
          req.sessionHash = hash(cookie);
        }
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const origin = req.headers.origin;
        if (origin) {
          let o;
          try {
            o = new URL(origin);
          } catch {
            fail(403, 'ORIGIN_REJECTED', 'Invalid origin');
          }
          const hostname = req.hostname;
          if (
            o.host !== req.get('host') &&
            !(
              !prod &&
              ['127.0.0.1', 'localhost', '[::1]'].includes(o.hostname) &&
              ['127.0.0.1', 'localhost', '::1'].includes(hostname)
            )
          )
            fail(403, 'ORIGIN_REJECTED', 'Cross-origin request rejected');
        }
        if (
          req.auth &&
          !['/auth/login', '/auth/register'].includes(req.path) &&
          req.get('X-CSRF-Token') !== req.auth.csrf
        )
          fail(403, 'CSRF_REQUIRED', 'Valid CSRF token required');
      }
      next();
    }),
  );
  const audit = (req, action, resource, details = {}) =>
    db
      .prepare('INSERT INTO audit VALUES(?,?,?,?,?,?,?)')
      .run(
        id(),
        req.auth.tenant_id,
        req.auth.id,
        action,
        resource || null,
        now(),
        JSON.stringify(details),
      );
  const requireAuth = (req) => {
    if (!req.auth) fail(401, 'AUTH_REQUIRED', 'Please sign in');
    return req.auth;
  };
  const allow = (req, allowed = financial) => {
    const a = requireAuth(req);
    if (!allowed.includes(a.role))
      fail(403, 'FORBIDDEN', 'This role cannot perform this operation');
    return a;
  };
  const get = (req, kind, key) => {
    requireAuth(req);
    if (typeof key !== 'string' || !key) fail(404, 'NOT_FOUND', 'Resource not found');
    const r = store.get(kind, key, req.auth.tenant_id);
    if (!r) fail(404, 'NOT_FOUND', 'Resource not found');
    return r;
  };
  const list = (req, kind, entity) => {
    requireAuth(req);
    if (entity) get(req, 'entity', entity);
    return store.list(kind, req.auth.tenant_id, entity);
  };
  const put = (req, kind, obj) => store.put(kind, req.auth.tenant_id, obj);
  const revision = (obj, v) => {
    if (!Number.isInteger(v) || v !== obj.version)
      fail(409, 'VERSION_CONFLICT', 'This record changed. Reload before editing.', {
        current_version: obj.version,
      });
  };
  const settings = (req) =>
    store.get('settings', req.auth.tenant_id, req.auth.tenant_id) || {
      id: req.auth.tenant_id,
      version: 1,
      days: 365,
      include_leases: true,
      materiality_pct: 1,
      retention_days: 365,
      locale: 'ar',
    };
  const sessionPayload = (req) => ({
    user: { id: req.auth.id, name: req.auth.name, email: req.auth.email, role: req.auth.role },
    tenant: { id: req.auth.tenant_id, name: req.auth.tenant_name, demo: !!req.auth.demo },
    csrfToken: req.auth.csrf,
    capabilities,
  });
  const session = (req, res, user) => {
    if (req.sessionHash) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.sessionHash);
    const token = randomBytes(32).toString('hex'),
      csrf = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(
      hash(token),
      user.id,
      csrf,
      Date.now() + 12 * 3600000,
    );
    const tenant = db.prepare('SELECT * FROM tenants WHERE id=?').get(user.tenant_id);
    req.auth = { ...user, csrf, tenant_name: tenant.name, demo: tenant.demo };
    res.cookie('basira_session', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: prod,
      maxAge: 12 * 3600000,
      path: '/',
    });
    return sessionPayload(req);
  };
  const addEntity = (tenant, name, sector = 'technology', curr = 'SAR', sectorCode = '') =>
    store.put('entity', tenant, {
      id: id(),
      name,
      sector,
      sector_code: sectorCode,
      currency: curr,
      version: 1,
      created_at: now(),
    });
  // Server-side insert for a peer_benchmarks_seed.json entry, bypassing the /api/peers
  // request-shaped validation (source_url/metrics etc. are already known-good in the seed
  // file — see docs/research/06_Peer_Benchmark_Dataset_AR.md for verification trail) since
  // this runs outside an HTTP request context (inside tenant-creation transactions).
  const addPeer = (tenant, entityId, createdBy, peer) =>
    store.put('peer', tenant, {
      id: id(),
      entity_id: entityId,
      name: peer.name,
      sector: peer.sector,
      sector_code: peer.sector_code || '',
      country: peer.country,
      currency: peer.currency,
      period: peer.period,
      source_url: peer.source_url,
      rights_basis: peer.rights_basis,
      definition_notes: peer.definition_notes,
      metrics: { ...peer.metrics },
      created_by: createdBy,
      created_at: now(),
      version: 1,
    });
  const notify = (req, userId, title, resourceId) =>
    put(req, 'notification', {
      id: id(),
      user_id: userId,
      title,
      resource_id: resourceId,
      read: false,
      created_at: now(),
      version: 1,
    });
  const evaluateOverdue = (req) => {
    requireAuth(req);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const existing = new Set(
      list(req, 'notification')
        .filter((n) => n.dedupe_key)
        .map((n) => n.dedupe_key),
    );
    const cfos = db
      .prepare("SELECT id FROM users WHERE tenant_id=? AND role='cfo'")
      .all(req.auth.tenant_id)
      .map((u) => u.id);
    for (const a of list(req, 'action')) {
      if (!a.due_date || a.due_date >= today || ['closed', 'benefit_verified'].includes(a.status))
        continue;
      for (const userId of new Set([a.owner_id, ...cfos])) {
        const key = `action_overdue:${a.id}:${today}:${userId}`;
        if (existing.has(key)) continue;
        const title_ar = `إجراء متأخر: ${a.title}`,
          title_en = `Overdue action: ${a.title}`;
        put(req, 'notification', {
          id: id(),
          entity_id: a.entity_id,
          user_id: userId,
          kind: 'action_overdue',
          dedupe_key: key,
          business_date: today,
          time_zone: 'Asia/Riyadh',
          action_id: a.id,
          resource_id: a.id,
          due_date: a.due_date,
          title: title_ar,
          title_ar,
          title_en,
          read: false,
          created_at: now(),
          generated_by: 'system',
          version: 1,
        });
        existing.add(key);
      }
    }
  };
  const notifications = (req) => {
    evaluateOverdue(req);
    return list(req, 'notification').filter((n) => !n.user_id || n.user_id === req.auth.id);
  };
  const actionAccess = (req, a, write = false) => {
    allow(req, ['cfo', 'analyst', 'operator']);
    if (req.auth.role === 'operator' && a.owner_id !== req.auth.id)
      fail(404, 'NOT_FOUND', 'Action not found');
    if (write && a.status === 'benefit_verified')
      fail(422, 'IMMUTABLE', 'Verified action must be reopened before editing');
    return a;
  };
  const actionsFor = (req, entity) =>
    list(req, 'action', entity).filter(
      (a) => req.auth.role !== 'operator' || a.owner_id === req.auth.id,
    );
  const fileData = (body, allowed = ['.xlsx', '.pdf', '.csv']) => {
    const filename = str(body.filename, 'filename', 200);
    const ext = extname(filename).toLowerCase();
    if (!allowed.includes(ext)) fail(422, 'UNSUPPORTED_FILE', 'Unsupported file type');
    const content = str(body.content_base64, 'content_base64', 15 * 1024 * 1024);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(content) || content.length % 4 !== 0)
      fail(422, 'INVALID_FILE', 'Invalid base64 file');
    const bytes = Buffer.from(content, 'base64');
    if (!bytes.length || bytes.length > 10485760)
      fail(413, 'FILE_TOO_LARGE', 'File must be between 1 byte and 10 MB');
    if (ext === '.pdf' && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-')))
      fail(422, 'INVALID_FILE', 'PDF signature does not match');
    if (ext === '.xlsx' && (bytes.length < 4 || bytes.readUInt16LE(0) !== 0x4b50))
      fail(422, 'INVALID_FILE', 'XLSX signature does not match');
    if (ext === '.csv') {
      let text;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        fail(422, 'INVALID_FILE', 'CSV must use UTF-8 encoding');
      }
      if (
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text) ||
        text.trim().split(/\r?\n/).filter(Boolean).length < 2 ||
        !/[;,\t]/.test(text)
      )
        fail(422, 'INVALID_FILE', 'CSV must contain a header and at least one delimited data row');
      let quoted = false;
      for (let i = 0; i < text.length; i++)
        if (text[i] === '\"') {
          if (quoted && text[i + 1] === '\"') i++;
          else quoted = !quoted;
        }
      if (quoted) fail(422, 'INVALID_FILE', 'CSV contains an unterminated quoted field');
    }
    return { filename, bytes, ext };
  };
  const safeDoc = (d) => {
    const { storage_path, ...safe } = d;
    return safe;
  };
  const fileReply = (res, obj) => {
    if (!existsSync(obj.storage_path)) fail(404, 'FILE_MISSING', 'Original file is unavailable');
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(obj.filename)}`,
      'Cache-Control': 'no-store',
    });
    res.sendFile(obj.storage_path);
  };
  app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', service: 'basira', version: '0.1.0', database: 'sqlite' }),
  );
  app.get(
    '/api/session',
    wrap((req, res) => {
      requireAuth(req);
      res.json(sessionPayload(req));
    }),
  );
  app.post(
    '/api/auth/register',
    wrap(async (req, res) => {
      rate(`auth:${req.ip}`, 40);
      const b = req.body,
        name = str(b.name, 'name'),
        mail = email(b.email),
        company = str(b.company, 'company'),
        ph = await passwordHash(b.password);
      if (db.prepare('SELECT id FROM users WHERE email=?').get(mail))
        fail(409, 'EMAIL_EXISTS', 'Email already registered');
      const tenant = id(),
        user = {
          id: id(),
          tenant_id: tenant,
          name,
          email: mail,
          password_hash: ph,
          role: 'cfo',
          created_at: now(),
        };
      store.transaction(() => {
        db.prepare('INSERT INTO tenants VALUES(?,?,?,?)').run(tenant, company, 0, now());
        db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(
          user.id,
          tenant,
          name,
          mail,
          ph,
          'cfo',
          user.created_at,
        );
        addEntity(tenant, company);
      });
      res.status(201).json(session(req, res, user));
      audit(req, 'auth.register', user.id);
    }),
  );
  app.post(
    '/api/auth/login',
    wrap(async (req, res) => {
      rate(`auth:${req.ip}`, 40);
      const mail = email(req.body.email),
        user = db.prepare('SELECT * FROM users WHERE email=?').get(mail);
      if (!(await passwordMatches(req.body.password, user?.password_hash)))
        fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      res.json(session(req, res, user));
      audit(req, 'auth.login', user.id);
    }),
  );
  app.post(
    '/api/auth/logout',
    wrap((req, res) => {
      requireAuth(req);
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.sessionHash);
      res.clearCookie('basira_session', { path: '/' }).json({ ok: true });
    }),
  );
  app.post(
    '/api/auth/demo',
    wrap((req, res) => {
      rate(`auth:${req.ip}`, 40);
      if (!demoEnabled) fail(403, 'DEMO_DISABLED', 'Demo is disabled');
      const role = enumOf(req.body.role || 'cfo', roles, 'role');
      let tenant = req.auth?.demo ? req.auth.tenant_id : null;
      if (!tenant) {
        tenant = id();
        store.transaction(() => {
          db.prepare('INSERT INTO tenants VALUES(?,?,?,?)').run(
            tenant,
            'Elm reference - demonstration',
            1,
            now(),
          );
          for (const r of roles)
            db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(
              id(),
              tenant,
              `Demo ${r}`,
              `${r}.${tenant}@demo.basira.local`,
              null,
              r,
              now(),
            );
          const entity = addEntity(
            tenant,
            'Elm reference - demonstration',
            'technology',
            'SAR',
            'it_services',
          );
          // Seed the demo tenant's real, primary-source-verified peer cohort (same
          // sector_code as the demo entity only — mixing sectors would show incomparable
          // companies as if they were peers) so the benchmark chart has real named peers
          // out of the box instead of an empty state.
          if (peerSeed) {
            const cfoUser = db
              .prepare("SELECT id FROM users WHERE tenant_id=? AND role='cfo'")
              .get(tenant);
            for (const peer of peerSeed.peers)
              if (peer.sector_code === entity.sector_code) addPeer(tenant, entity.id, cfoUser.id, peer);
          }
        });
      }
      const user = db.prepare('SELECT * FROM users WHERE tenant_id=? AND role=?').get(tenant, role);
      res.json(session(req, res, user));
      audit(req, 'auth.demo_role', user.id, { role });
    }),
  );
  app.get(
    '/api/capabilities',
    wrap((req, res) => {
      requireAuth(req);
      res.json(capabilities);
    }),
  );
  app.get(
    '/api/entities',
    wrap((req, res) => res.json(list(req, 'entity'))),
  );
  app.post(
    '/api/entities',
    wrap((req, res) => {
      allow(req, ['cfo']);
      const b = req.body,
        e = addEntity(
          req.auth.tenant_id,
          str(b.name, 'name'),
          str(b.sector, 'sector'),
          currency(b.currency || 'SAR'),
          b.sector_code ? enumOf(b.sector_code, SECTOR_CODES, 'sector_code') : '',
        );
      audit(req, 'entity.create', e.id);
      res.status(201).json(e);
    }),
  );
  app.get(
    '/api/members',
    wrap((req, res) => {
      requireAuth(req);
      res.json(
        db
          .prepare(
            'SELECT id,name,email,role,created_at FROM users WHERE tenant_id=? ORDER BY name',
          )
          .all(req.auth.tenant_id),
      );
    }),
  );
  app.post(
    '/api/members',
    wrap(async (req, res) => {
      allow(req, ['cfo']);
      const b = req.body,
        mail = email(b.email),
        name = str(b.name, 'name'),
        role = enumOf(b.role, roles, 'role'),
        ph = await passwordHash(b.password);
      if (db.prepare('SELECT id FROM users WHERE email=?').get(mail))
        fail(409, 'EMAIL_EXISTS', 'Email already registered');
      const user = { id: id(), name, email: mail, role, created_at: now() };
      db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(
        user.id,
        req.auth.tenant_id,
        name,
        mail,
        ph,
        role,
        user.created_at,
      );
      audit(req, 'member.provision', user.id, { role });
      res.status(201).json(user);
    }),
  );
  const saveAnalysis = async (req, dataset) => {
    const policy = settings(req);
    const result = await engine(
      { op: 'analyze', facts: dataset.facts, settings: policy },
      { req, entity_id: dataset.entity_id, dataset_id: dataset.id },
    );
    if (settings(req).version !== policy.version)
      fail(409, 'VERSION_CONFLICT', 'Settings changed during analysis');
    const current = get(req, 'dataset', dataset.id);
    if (current.version !== dataset.version)
      fail(409, 'VERSION_CONFLICT', 'Dataset changed during analysis');
    const a = {
      ...result,
      id: id(),
      entity_id: dataset.entity_id,
      dataset_id: dataset.id,
      dataset_version: dataset.version,
      dataset_status: dataset.status,
      settings_version: policy.version,
      created_by: req.auth.id,
      created_at: now(),
      version: 1,
      finding_reviews: {},
    };
    put(req, 'analysis', a);
    return a;
  };
  let activeJobs = 0;
  const jobQueue = [];
  const drain = () => {
    while (activeJobs < 2 && jobQueue.length) {
      const task = jobQueue.shift();
      activeJobs++;
      task()
        .catch(() => {})
        .finally(() => {
          activeJobs--;
          drain();
        });
    }
  };
  const queueDocument = (req, document, creator = req.auth.id) => {
    const job = {
      id: id(),
      entity_id: document.entity_id,
      document_id: document.id,
      status: 'queued',
      created_at: now(),
      version: 1,
    };
    put(req, 'job', job);
    const context = { auth: { ...req.auth } };
    jobQueue.push(async () => {
      job.status = 'running';
      job.started_at = now();
      put(context, 'job', job);
      try {
        const result = await engine(
          {
            op: 'extract',
            path: document.storage_path,
            filename: document.filename,
            currency: document.currency,
            scale: document.scale,
          },
          { req: context, entity_id: document.entity_id, job_id: job.id },
        );
        const facts = (result.facts || []).map((f) => ({
          ...f,
          id: f.id || id(),
          review_status: 'needs_review',
        }));
        const dataset = {
          id: id(),
          entity_id: document.entity_id,
          document_id: document.id,
          status: 'needs_review',
          version: 1,
          facts,
          periods: result.periods || [],
          warnings: result.warnings || [],
          source_preview: result.source_preview || [],
          requires_manual_mapping: !!result.requires_manual_mapping,
          checks: [],
          created_by: creator,
          last_modified_by: creator,
          created_at: now(),
          updated_at: now(),
        };
        put(context, 'dataset', dataset);
        const analysis = await saveAnalysis(context, dataset);
        dataset.checks = analysis.checks || [];
        put(context, 'dataset', dataset);
        job.dataset_id = dataset.id;
        job.analysis_id = analysis.id;
        job.status = 'completed';
        document.status = 'extracted';
        document.dataset_id = dataset.id;
        put(context, 'document', document);
        notify(context, creator, 'Document ready for review', dataset.id);
        audit(context, 'document.extract', document.id, { dataset_id: dataset.id });
      } catch (e) {
        job.status = 'failed';
        job.error = ['ENGINE_TIMEOUT', 'ENGINE_UNAVAILABLE'].includes(e.message)
          ? e.message
          : 'Document could not be processed. Check the format and try again.';
        document.status = 'failed';
        put(context, 'document', document);
      }
      job.completed_at = now();
      job.duration_ms = Math.max(0, Date.parse(job.completed_at) - Date.parse(job.started_at));
      put(context, 'job', job);
    });
    setImmediate(drain);
    return job;
  };
  const createDocument = (req, b, { bytes, filename, ext }, creator) => {
    const e = get(req, 'entity', b.entity_id),
      docId = id(),
      path = join(uploadDir, docId + ext),
      curr = currency(b.currency || e.currency),
      scale = b.scale === undefined ? undefined : num(b.scale, 'scale', 0.000001, 1e12);
    writeFileSync(path, bytes, { mode: 0o600, flag: 'wx' });
    const d = {
      id: docId,
      entity_id: e.id,
      filename,
      storage_path: path,
      size: bytes.length,
      sha256: hash(bytes),
      currency: curr,
      scale,
      rights_confirmed: true,
      status: 'queued',
      created_by: creator || req.auth.id,
      created_at: now(),
      version: 1,
    };
    put(req, 'document', d);
    return d;
  };
  app.get(
    '/api/documents',
    wrap((req, res) => {
      allow(req);
      res.json(list(req, 'document', req.query.entity_id).map(safeDoc));
    }),
  );
  app.post(
    '/api/documents',
    wrap((req, res) => {
      allow(req);
      if (req.body.rights_confirmed !== true)
        fail(422, 'RIGHTS_REQUIRED', 'Confirm your right to process this document');
      get(req, 'entity', req.body.entity_id);
      const file = fileData(req.body);
      if (
        list(req, 'document', req.body.entity_id).some(
          (d) => d.sha256 === hash(file.bytes) && d.status !== 'failed',
        )
      )
        fail(409, 'DUPLICATE_DOCUMENT', 'This exact document is already stored for the entity');
      const d = createDocument(req, req.body, file),
        job = queueDocument(req, d);
      audit(req, 'document.upload', d.id, { sha256: d.sha256 });
      res.status(202).json({ document: safeDoc(d), job_id: job.id });
    }),
  );
  app.get(
    '/api/jobs/:id',
    wrap((req, res) => {
      allow(req);
      res.json(get(req, 'job', req.params.id));
    }),
  );
  app.get(
    '/api/documents/:id/content',
    wrap((req, res) => {
      allow(req);
      const d = get(req, 'document', req.params.id);
      audit(req, 'document.download', d.id);
      fileReply(res, d);
    }),
  );
  app.delete(
    '/api/documents/:id',
    wrap((req, res) => {
      allow(req, ['cfo']);
      const d = get(req, 'document', req.params.id);
      d.status = 'archived';
      d.archived_at = now();
      d.version++;
      put(req, 'document', d);
      audit(req, 'document.archive', d.id, {
        retained: true,
        retention_days: settings(req).retention_days,
      });
      res.json(safeDoc(d));
    }),
  );
  app.post(
    '/api/demo/seed',
    wrap((req, res) => {
      allow(req);
      if (!req.auth.demo) fail(403, 'DEMO_ONLY', 'Seed is available only in a demo workspace');
      const old = list(req, 'document').find((d) => d.demo_reference);
      if (old) {
        const j = list(req, 'job').find((j) => j.document_id === old.id);
        return res.json({ document: safeDoc(old), job_id: j?.id, dataset_id: old.dataset_id });
      }
      const path = join(root, 'fixtures', 'elm.xlsx');
      if (!existsSync(path)) fail(503, 'FIXTURE_UNAVAILABLE', 'Reference fixture is not installed');
      const entity = list(req, 'entity')[0],
        analyst = db
          .prepare("SELECT id FROM users WHERE tenant_id=? AND role='analyst'")
          .get(req.auth.tenant_id),
        d = createDocument(
          req,
          { entity_id: entity.id, currency: 'SAR' },
          { bytes: readFileSync(path), filename: 'Elm reference.xlsx', ext: '.xlsx' },
          analyst.id,
        );
      d.demo_reference = true;
      put(req, 'document', d);
      const job = queueDocument(req, d, analyst.id);
      res.status(202).json({ document: safeDoc(d), job_id: job.id });
    }),
  );
  app.get(
    '/api/datasets',
    wrap((req, res) => {
      allow(req);
      res.json(list(req, 'dataset', req.query.entity_id));
    }),
  );
  app.get(
    '/api/datasets/:id',
    wrap((req, res) => {
      allow(req);
      res.json(get(req, 'dataset', req.params.id));
    }),
  );
  const factUpdates = (req, d, updates, reason) => {
    if (!Array.isArray(updates) || !updates.length || updates.length > 5000)
      fail(422, 'VALIDATION_ERROR', 'Select at least one fact to review');
    const seen = new Set();
    for (const update of updates) {
      if (seen.has(update.id)) fail(422, 'VALIDATION_ERROR', 'Duplicate fact update');
      seen.add(update.id);
      const f = d.facts.find((f) => f.id === update.id);
      if (!f) fail(404, 'NOT_FOUND', 'Fact not found');
      if (update.value !== undefined) {
        f.value = update.value === null ? null : num(update.value, 'value');
        if (f.formula) {
          if (f.value === null) delete f.manual_override;
          else f.manual_override = { reason, by: req.auth.id, at: now() };
        }
        f.review_status = 'needs_review';
      }
      if (update.concept !== undefined) {
        const c = str(update.concept, 'concept', 100);
        if (!/^[a-z][a-z0-9_]*$/.test(c)) fail(422, 'VALIDATION_ERROR', 'Invalid concept');
        f.concept = c;
        f.review_status = 'needs_review';
      }
      if (update.review_status !== undefined)
        f.review_status = enumOf(
          update.review_status,
          ['needs_review', 'reviewed'],
          'review_status',
        );
      f.reviewed_by = f.review_status === 'reviewed' ? req.auth.id : null;
      f.reviewed_at = f.review_status === 'reviewed' ? now() : null;
    }
    d.status = 'needs_review';
    delete d.approved_by;
    delete d.approved_at;
    d.version++;
    d.last_modified_by = req.auth.id;
    d.updated_at = now();
    d.checks = [];
    put(req, 'dataset', d);
    audit(req, 'dataset.facts_edit', d.id, { reason, count: updates.length, version: d.version });
    return d;
  };
  const editFacts = (req, res, updates) => {
    allow(req);
    const d = get(req, 'dataset', req.params.id);
    revision(d, req.body.version);
    const reason = str(req.body.reason, 'reason', 2000);
    store.transaction(() => {
      put(req, 'dataset_revision', {
        ...d,
        id: id(),
        dataset_id: d.id,
        change_reason: reason,
        changed_by: req.auth.id,
        changed_at: now(),
        next_version: d.version + 1,
      });
      factUpdates(req, d, updates, reason);
    });
    res.json(d);
  };
  app.patch(
    '/api/datasets/:id/facts/:factId',
    wrap((req, res) => editFacts(req, res, [{ ...req.body, id: req.params.factId }])),
  );
  app.patch(
    '/api/datasets/:id/facts',
    wrap((req, res) => editFacts(req, res, req.body.updates)),
  );
  app.post(
    '/api/datasets/:id/facts',
    wrap((req, res) => {
      allow(req);
      const d = get(req, 'dataset', req.params.id),
        b = req.body;
      revision(d, b.version);
      const reason = str(b.reason, 'reason', 2000),
        concept = str(b.concept, 'concept', 100);
      if (!/^[a-z][a-z0-9_]*$/.test(concept)) fail(422, 'VALIDATION_ERROR', 'Invalid concept');
      const period = str(b.period, 'period', 20);
      if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(period))
        fail(422, 'VALIDATION_ERROR', 'Invalid period');
      if (
        !b.source ||
        typeof b.source !== 'object' ||
        Array.isArray(b.source) ||
        (!b.source.page && !b.source.sheet && !b.source.note)
      )
        fail(422, 'SOURCE_REQUIRED', 'Provide page, sheet/cell or manual source note');
      if (d.facts.some((f) => f.concept === concept && f.period === period))
        fail(409, 'DUPLICATE_FACT', 'Edit the existing concept and period');
      const f = {
        id: id(),
        concept,
        label_ar: str(b.label_ar || concept, 'label_ar'),
        label_en: str(b.label_en || concept, 'label_en'),
        period,
        value: b.value === null ? null : num(b.value, 'value'),
        currency: currency(b.currency || get(req, 'entity', d.entity_id).currency),
        unit: 'currency',
        scale: 1,
        original_value: null,
        source: { ...b.source, manual: true },
        scope: 'consolidated',
        review_status: 'needs_review',
        created_by: req.auth.id,
      };
      store.transaction(() => {
        put(req, 'dataset_revision', {
          ...d,
          id: id(),
          dataset_id: d.id,
          change_reason: reason,
          changed_by: req.auth.id,
          changed_at: now(),
          next_version: d.version + 1,
        });
        d.facts.push(f);
        d.periods = [...new Set(d.facts.map((f) => f.period))].sort();
        factUpdates(req, d, [{ id: f.id, review_status: 'needs_review' }], reason);
      });
      res.status(201).json(d);
    }),
  );
  app.post(
    '/api/datasets/:id/approve',
    wrap(async (req, res) => {
      allow(req, ['cfo']);
      const d = get(req, 'dataset', req.params.id);
      revision(d, req.body.version);
      if ([d.created_by, d.last_modified_by].includes(req.auth.id))
        fail(
          422,
          'INDEPENDENT_REVIEW_REQUIRED',
          "A different CFO must approve the preparer's dataset",
        );
      if (!d.facts.length || d.facts.some((f) => f.review_status !== 'reviewed'))
        fail(422, 'REVIEW_INCOMPLETE', 'Every extracted fact requires an explicit review');
      const policy = settings(req);
      const result = await engine(
        { op: 'analyze', facts: d.facts, settings: policy },
        { req, entity_id: d.entity_id, dataset_id: d.id },
      );
      if (settings(req).version !== policy.version)
        fail(409, 'VERSION_CONFLICT', 'Settings changed during approval');
      const current = get(req, 'dataset', d.id);
      revision(current, d.version);
      if (result.checks?.some((c) => c.status === 'fail'))
        fail(422, 'CHECKS_FAILED', 'Resolve failed reconciliation checks before approval', {
          checks: result.checks,
        });
      d.checks = result.checks || [];
      d.status = 'approved';
      d.approved_by = req.auth.id;
      d.approved_at = now();
      d.approved_version = d.version;
      d.approved_settings_version = policy.version;
      put(req, 'dataset', d);
      audit(req, 'dataset.approve', d.id, { version: d.version });
      res.json(d);
    }),
  );
  app.post(
    '/api/datasets/:id/analyze',
    wrap(async (req, res) => {
      allow(req);
      const d = get(req, 'dataset', req.params.id);
      const a = await saveAnalysis(req, d);
      const current = get(req, 'dataset', d.id);
      revision(current, d.version);
      current.checks = a.checks || [];
      put(req, 'dataset', current);
      audit(req, 'analysis.create', a.id, { dataset_version: d.version });
      res.status(201).json(a);
    }),
  );
  app.get(
    '/api/analyses/:id',
    wrap((req, res) => {
      allow(req);
      res.json(get(req, 'analysis', req.params.id));
    }),
  );
  app.post(
    '/api/findings/:analysisId/:findingId/review',
    wrap((req, res) => {
      allow(req);
      const a = get(req, 'analysis', req.params.analysisId);
      if (!a.findings.some((f) => f.id === req.params.findingId))
        fail(404, 'NOT_FOUND', 'Finding not found');
      a.finding_reviews[req.params.findingId] = {
        status: enumOf(req.body.status, ['accepted', 'rejected', 'needs_data'], 'status'),
        reason: str(req.body.reason, 'reason', 2000),
        reviewed_by: req.auth.id,
        reviewed_at: now(),
      };
      a.version++;
      put(req, 'analysis', a);
      audit(req, 'finding.review', a.id, { finding_id: req.params.findingId });
      res.json(a);
    }),
  );
  app.get(
    '/api/dashboard',
    wrap((req, res) => {
      requireAuth(req);
      const entities = list(req, 'entity'),
        e = req.query.entity_id ? get(req, 'entity', req.query.entity_id) : entities[0];
      if (!e)
        return res.json({
          entities,
          entity: null,
          dataset: null,
          analysis: null,
          actions: [],
          documents: [],
          notifications: [],
        });
      if (req.auth.role === 'board') {
        const report = list(req, 'report', e.id).find((r) => r.status === 'approved');
        return res.json({
          entities,
          entity: e,
          dataset: report
            ? {
                id: report.snapshot.dataset.id,
                version: report.snapshot.dataset.version,
                status: 'approved',
                periods: report.snapshot.dataset.periods,
              }
            : null,
          analysis: report?.snapshot.analysis || null,
          report: report ? { id: report.id, title: report.title, status: report.status } : null,
          actions: report?.snapshot.actions || [],
          documents: [],
          notifications: notifications(req),
        });
      }
      if (req.auth.role === 'operator')
        return res.json({
          entities,
          entity: e,
          dataset: null,
          analysis: null,
          actions: actionsFor(req, e.id).map(safeAction),
          documents: [],
          notifications: notifications(req),
        });
      const dataset = list(req, 'dataset', e.id)[0] || null,
        analysis = dataset
          ? list(req, 'analysis', e.id).find(
              (a) => a.dataset_id === dataset.id && a.dataset_version === dataset.version,
            ) || null
          : null;
      res.json({
        entities,
        entity: e,
        dataset,
        analysis,
        actions: actionsFor(req, e.id).map(safeAction),
        documents: list(req, 'document', e.id).map(safeDoc),
        notifications: notifications(req),
      });
    }),
  );
  const scenarioInput = (b) => {
    const type = enumOf(
      b.type,
      ['collection_days', 'gross_margin', 'opex_reduction', 'financing_rate', 'contract_assets'],
      'type',
    );
    const ceiling = type === 'collection_days' ? 365 : type === 'financing_rate' ? 10000 : 100;
    const out = {
      type,
      low: num(b.low, 'low', 0, ceiling),
      base: num(b.base, 'base', 0, ceiling),
      high: num(b.high, 'high', 0, ceiling),
    };
    if (out.low > out.base || out.base > out.high)
      fail(422, 'INVALID_RANGE', 'Require low <= base <= high');
    if (b.financing_rate !== undefined)
      out.financing_rate = num(b.financing_rate, 'financing_rate', 0, 100);
    if (b.implementation_cost !== undefined)
      out.implementation_cost = num(b.implementation_cost, 'implementation_cost', 0);
    return out;
  };
  const runScenario = async (req, save) => {
    allow(req);
    const d = get(req, 'dataset', req.body.dataset_id),
      input = scenarioInput(req.body),
      result = await engine(
        { op: 'scenario', facts: d.facts, scenario: input },
        { req, entity_id: d.entity_id, dataset_id: d.id },
      );
    revision(get(req, 'dataset', d.id), d.version);
    const s = {
      ...result,
      id: id(),
      entity_id: d.entity_id,
      dataset_id: d.id,
      dataset_version: d.version,
      input,
      created_by: req.auth.id,
      created_at: now(),
      version: 1,
    };
    if (save) {
      s.title = str(req.body.title, 'title');
      put(req, 'scenario', s);
      audit(req, 'scenario.save', s.id);
    }
    return s;
  };
  app.post(
    '/api/scenarios/evaluate',
    wrap(async (req, res) => res.json(await runScenario(req, false))),
  );
  app.post(
    '/api/scenarios/save',
    wrap(async (req, res) => res.status(201).json(await runScenario(req, true))),
  );
  app.get(
    '/api/scenarios',
    wrap((req, res) => {
      allow(req);
      res.json(list(req, 'scenario', req.query.entity_id));
    }),
  );
  app.get(
    '/api/peers',
    wrap((req, res) => {
      allow(req);
      res.json(list(req, 'peer', req.query.entity_id));
    }),
  );
  app.post(
    '/api/peers',
    wrap((req, res) => {
      allow(req);
      const b = req.body,
        e = get(req, 'entity', b.entity_id),
        source = str(b.source_url, 'source_url', 2000);
      let url;
      try {
        url = new URL(source);
      } catch {
        fail(422, 'VALIDATION_ERROR', 'A source URL is required');
      }
      if (!['https:', 'http:'].includes(url.protocol))
        fail(422, 'VALIDATION_ERROR', 'Source must use HTTP or HTTPS');
      if (
        !b.metrics ||
        typeof b.metrics !== 'object' ||
        Array.isArray(b.metrics) ||
        !Object.keys(b.metrics).length
      )
        fail(422, 'VALIDATION_ERROR', 'Provide at least one peer metric');
      for (const [k, v] of Object.entries(b.metrics)) {
        if (!METRICS.has(k)) fail(422, 'UNKNOWN_METRIC', `Unknown metric: ${k}`);
        num(v, k);
      }
      const p = {
        id: id(),
        entity_id: e.id,
        name: str(b.name, 'name'),
        sector: str(b.sector, 'sector'),
        sector_code: b.sector_code ? enumOf(b.sector_code, SECTOR_CODES, 'sector_code') : '',
        country: str(b.country, 'country'),
        currency: currency(b.currency),
        period: str(b.period, 'period', 20),
        source_url: source,
        rights_basis: str(b.rights_basis, 'rights_basis', 2000),
        definition_notes: str(b.definition_notes, 'definition_notes', 4000),
        metrics: { ...b.metrics },
        created_by: req.auth.id,
        created_at: now(),
        version: 1,
      };
      put(req, 'peer', p);
      audit(req, 'peer.create', p.id);
      res.status(201).json(p);
    }),
  );
  const quantile = (values, q) => {
    if (!values.length) return null;
    const at = (values.length - 1) * q,
      low = Math.floor(at);
    return values[low] + (values[Math.min(low + 1, values.length - 1)] - values[low]) * (at - low);
  };
  app.post(
    '/api/benchmarks',
    wrap((req, res) => {
      allow(req);
      const b = req.body,
        e = get(req, 'entity', b.entity_id);
      if (!METRICS.has(b.metric_key)) fail(422, 'UNKNOWN_METRIC', 'Unknown metric');
      if (
        !Array.isArray(b.peer_ids) ||
        !b.peer_ids.length ||
        b.peer_ids.length > 200 ||
        new Set(b.peer_ids).size !== b.peer_ids.length
      )
        fail(422, 'VALIDATION_ERROR', 'Select unique peers');
      const d = list(req, 'dataset', e.id)[0],
        a =
          d &&
          list(req, 'analysis', e.id).find(
            (x) => x.dataset_id === d.id && x.dataset_version === d.version,
          );
      if (!a) fail(422, 'ANALYSIS_REQUIRED', 'A current analysis is required');
      const latestPeriod = [...a.periods].sort().at(-1),
        // Real peer filings routinely lag a company's own latest analyzed period by up to a
        // year (most FY data is published well after fiscal year end). Defaulting to
        // latest-only made every real-world peer set unconditionally ineligible on period
        // alone. An explicit, validated `period` request lets the caller deliberately
        // compare against an older period the entity itself was also analyzed for; it is
        // never inferred silently, and using anything but the latest is disclosed in
        // `warnings` on the resulting snapshot so it can never be mistaken for a same-year
        // comparison.
        period = b.period ? enumOf(b.period, a.periods, 'period') : latestPeriod,
        metric = a.metrics.find((m) => m.key === b.metric_key && m.period === period);
      if (!metric || !Number.isFinite(metric.value))
        fail(422, 'METRIC_UNAVAILABLE', 'Company metric is not available');
      const peers = [],
        exclusions = [];
      for (const pid of b.peer_ids) {
        const p = get(req, 'peer', pid);
        if (p.entity_id !== e.id) fail(404, 'NOT_FOUND', 'Peer not found for entity');
        const reasons = [];
        // sector_code (a controlled vocabulary) is authoritative when both sides carry one;
        // free-text sector descriptions almost never match verbatim even for a genuinely
        // comparable business, so falling back to that alone made real peer data
        // unconditionally ineligible. Absent a code on either side, behavior is unchanged.
        const sectorEligible =
          p.sector_code && e.sector_code ? p.sector_code === e.sector_code : p.sector === e.sector;
        if (!sectorEligible) reasons.push('sector_mismatch');
        if (p.currency !== e.currency) reasons.push('currency_mismatch');
        if (p.period !== period) reasons.push('period_mismatch');
        if (!Number.isFinite(p.metrics[b.metric_key])) reasons.push('metric_missing');
        if (!p.source_url || !p.rights_basis || !p.definition_notes)
          reasons.push('provenance_incomplete');
        if (reasons.length) exclusions.push({ id: pid, name: p.name, reasons });
        else peers.push({ ...p, value: p.metrics[b.metric_key] });
      }
      const values = peers.map((p) => p.value).sort((a, b) => a - b),
        n = values.length,
        warnings = [
          'Peer definitions and rights are supplied by the user and require independent review. Percentile ordering does not indicate investment quality.',
        ];
      if (period !== latestPeriod)
        warnings.push(
          `Comparison uses period ${period}, not the entity's latest analyzed period ${latestPeriod} — chosen deliberately, likely because peer filings for the latest period are not yet available. Do not present this as a same-year comparison.`,
        );
      if (n < 5)
        warnings.push(
          'Insufficient cohort: fewer than 5 peers. No comparison or ranking is approved.',
        );
      else if (n < 10) warnings.push('Small cohort: descriptive statistics only; no ranking.');
      const snapshot = {
        id: id(),
        entity_id: e.id,
        metric_key: b.metric_key,
        period,
        company_value: metric.value,
        unit: metric.unit,
        n,
        median: quantile(values, 0.5),
        q1: quantile(values, 0.25),
        q3: quantile(values, 0.75),
        eligible: n >= 5,
        exclusions,
        warnings,
        peers,
        dataset_id: d.id,
        dataset_version: d.version,
        analysis_id: a.id,
        created_by: req.auth.id,
        created_at: now(),
        version: 1,
      };
      if (n >= 10) snapshot.rank = 1 + values.filter((v) => v > metric.value).length;
      put(req, 'benchmark', snapshot);
      audit(req, 'benchmark.create', snapshot.id, { n });
      res.status(201).json(snapshot);
    }),
  );
  app.get(
    '/api/benchmarks',
    wrap((req, res) => {
      allow(req);
      res.json(list(req, 'benchmark', req.query.entity_id));
    }),
  );
  app.get(
    '/api/global-benchmark',
    wrap((req, res) => {
      allow(req);
      const sectorCode = req.query.sector_code ? enumOf(req.query.sector_code, SECTOR_CODES, 'sector_code') : '';
      const entry = sectorCode ? globalSectorBenchmarks[sectorCode] : null;
      res.json(entry ? { available: true, ...entry } : { available: false, sector_code: sectorCode || null });
    }),
  );
  const validateOwner = (req, owner) => {
    if (typeof owner !== 'string' || !owner) fail(422, 'INVALID_OWNER', 'Select an action owner');
    const user = db
      .prepare('SELECT id,role FROM users WHERE id=? AND tenant_id=?')
      .get(owner, req.auth.tenant_id);
    if (!user || user.role === 'board')
      fail(422, 'INVALID_OWNER', 'Select a member who can operate an action');
    return owner;
  };
  const safeEvidence = (e) => {
    const { storage_path, ...publicE } = e;
    return publicE;
  };
  const safeAction = (a) => ({ ...a, evidence: (a.evidence || []).map(safeEvidence) });
  app.get(
    '/api/actions',
    wrap((req, res) => {
      allow(req, ['cfo', 'analyst', 'operator']);
      res.json(actionsFor(req, req.query.entity_id).map(safeAction));
    }),
  );
  app.get(
    '/api/actions/:id',
    wrap((req, res) => res.json(safeAction(actionAccess(req, get(req, 'action', req.params.id))))),
  );
  app.post(
    '/api/actions',
    wrap((req, res) => {
      allow(req);
      const b = req.body,
        e = get(req, 'entity', b.entity_id);
      let a;
      if (b.analysis_id) {
        a = get(req, 'analysis', b.analysis_id);
        if (a.entity_id !== e.id) fail(404, 'NOT_FOUND', 'Analysis not found for entity');
        if (b.finding_id && !a.findings.some((f) => f.id === b.finding_id))
          fail(422, 'INVALID_FINDING', 'Finding not found');
      } else if (b.finding_id) fail(422, 'INVALID_FINDING', 'A finding requires its analysis');
      const action = {
        id: id(),
        entity_id: e.id,
        analysis_id: b.analysis_id || null,
        finding_id: b.finding_id || null,
        title: str(b.title, 'title'),
        description: str(b.description, 'description', 4000, true),
        owner_id: validateOwner(req, b.owner_id),
        due_date: date(b.due_date),
        baseline: num(b.baseline, 'baseline'),
        target: num(b.target, 'target'),
        unit: str(b.unit, 'unit', 50),
        effect_type: enumOf(b.effect_type, EFFECTS, 'effect_type'),
        dependency_group: str(b.dependency_group, 'dependency_group', 200, true) || null,
        status: 'draft',
        version: 1,
        created_by: req.auth.id,
        created_at: now(),
        updated_at: now(),
        evidence: [],
        history: [{ at: now(), by: req.auth.id, status: 'draft', reason: 'Created' }],
        benefits: [],
      };
      put(req, 'action', action);
      notify(req, action.owner_id, 'New assigned action', action.id);
      audit(req, 'action.create', action.id);
      res.status(201).json(safeAction(action));
    }),
  );
  app.patch(
    '/api/actions/:id',
    wrap((req, res) => {
      const a = actionAccess(req, get(req, 'action', req.params.id), true),
        b = req.body;
      revision(a, b.version);
      const reason = str(b.reason, 'reason', 2000);
      if (['closed', 'pending_verification'].includes(a.status))
        fail(422, 'REOPEN_REQUIRED', 'Reopen or return the action to progress before editing');
      if (b.title !== undefined) a.title = str(b.title, 'title');
      if (b.description !== undefined)
        a.description = str(b.description, 'description', 4000, true);
      if (b.due_date !== undefined) a.due_date = date(b.due_date);
      if (b.owner_id !== undefined) {
        allow(req);
        a.owner_id = validateOwner(req, b.owner_id);
      }
      if (
        b.baseline !== undefined ||
        b.target !== undefined ||
        b.effect_type !== undefined ||
        b.dependency_group !== undefined
      ) {
        allow(req);
        if (a.status !== 'draft')
          fail(422, 'BASELINE_LOCKED', 'Baseline and benefit classification lock after approval');
        if (b.baseline !== undefined) a.baseline = num(b.baseline, 'baseline');
        if (b.target !== undefined) a.target = num(b.target, 'target');
        if (b.effect_type !== undefined)
          a.effect_type = enumOf(b.effect_type, EFFECTS, 'effect_type');
        if (b.dependency_group !== undefined)
          a.dependency_group = str(b.dependency_group, 'dependency_group', 200, true) || null;
      }
      a.version++;
      a.updated_at = now();
      a.history.push({ at: now(), by: req.auth.id, event: 'edit', reason });
      put(req, 'action', a);
      audit(req, 'action.edit', a.id, { reason, version: a.version });
      res.json(safeAction(a));
    }),
  );
  const transitions = {
    draft: ['approved'],
    approved: ['in_progress', 'blocked'],
    in_progress: ['blocked', 'pending_verification'],
    blocked: ['in_progress'],
    pending_verification: ['closed', 'in_progress'],
    closed: ['reopened'],
    benefit_verified: ['reopened'],
    reopened: ['in_progress'],
  };
  app.post(
    '/api/actions/:id/transition',
    wrap((req, res) => {
      const a = actionAccess(req, get(req, 'action', req.params.id)),
        b = req.body;
      revision(a, b.version);
      const reason = str(b.reason, 'reason', 2000),
        next = str(b.status, 'status', 50);
      if (!(transitions[a.status] || []).includes(next))
        fail(422, 'INVALID_TRANSITION', 'This action transition is not allowed');
      if (['approved', 'closed', 'reopened'].includes(next)) allow(req, ['cfo']);
      if (next === 'pending_verification') {
        if (!a.evidence.length)
          fail(422, 'EVIDENCE_REQUIRED', 'Attach evidence before verification');
        a.verification_submitted_by = req.auth.id;
      }
      if (next === 'closed') {
        if (!a.evidence.length) fail(422, 'EVIDENCE_REQUIRED', 'Closure requires evidence');
        if ([a.owner_id, a.verification_submitted_by].includes(req.auth.id))
          fail(422, 'INDEPENDENT_REVIEW_REQUIRED', 'Closure requires an independent CFO');
        a.closed_by = req.auth.id;
        a.closed_at = now();
      }
      if (next === 'reopened') a.reopened_at = now();
      a.status = next;
      a.version++;
      a.updated_at = now();
      a.history.push({ at: now(), by: req.auth.id, status: next, reason });
      put(req, 'action', a);
      audit(req, 'action.transition', a.id, { status: next, reason, version: a.version });
      res.json(safeAction(a));
    }),
  );
  app.post(
    '/api/actions/:id/evidence',
    wrap((req, res) => {
      const a = actionAccess(req, get(req, 'action', req.params.id), true),
        b = req.body;
      if (['closed'].includes(a.status))
        fail(422, 'REOPEN_REQUIRED', 'Reopen the action before adding evidence');
      const e = {
        id: id(),
        title: str(b.title, 'title'),
        note: str(b.note, 'note', 5000),
        created_by: req.auth.id,
        created_at: now(),
      };
      if (b.filename || b.content_base64) {
        const f = fileData(b, ['.pdf', '.xlsx', '.txt', '.csv', '.png', '.jpg', '.jpeg']);
        e.filename = f.filename;
        e.storage_path = join(uploadDir, e.id + f.ext);
        e.sha256 = hash(f.bytes);
        e.size = f.bytes.length;
        writeFileSync(e.storage_path, f.bytes, { mode: 0o600, flag: 'wx' });
      }
      a.evidence.push(e);
      a.version++;
      a.updated_at = now();
      put(req, 'action', a);
      audit(req, 'action.evidence', a.id, { evidence_id: e.id });
      res.status(201).json(safeAction(a));
    }),
  );
  app.get(
    '/api/actions/:id/evidence/:evidenceId/content',
    wrap((req, res) => {
      const a = actionAccess(req, get(req, 'action', req.params.id)),
        e = a.evidence.find((e) => e.id === req.params.evidenceId);
      if (!e?.storage_path) fail(404, 'NOT_FOUND', 'Evidence attachment not found');
      audit(req, 'evidence.download', a.id, { evidence_id: e.id });
      fileReply(res, e);
    }),
  );
  app.post(
    '/api/actions/:id/benefit',
    wrap((req, res) => {
      allow(req, ['cfo']);
      const a = get(req, 'action', req.params.id),
        b = req.body;
      if (a.status !== 'closed')
        fail(422, 'CLOSURE_REQUIRED', 'Close and independently verify the action first');
      if ([a.owner_id, a.verification_submitted_by, a.created_by].includes(req.auth.id))
        fail(
          422,
          'INDEPENDENT_REVIEW_REQUIRED',
          'Benefit verification requires an independent CFO',
        );
      if (!a.evidence.length) fail(422, 'EVIDENCE_REQUIRED', 'Evidence is required');
      const effect = enumOf(b.effect_type, EFFECTS, 'effect_type');
      if (effect !== a.effect_type)
        fail(422, 'EFFECT_MISMATCH', 'Benefit type must match the approved action');
      const start = date(b.period_start),
        end = date(b.period_end);
      if (start > end) fail(422, 'INVALID_PERIOD', 'Invalid benefit period');
      const baseline = num(b.baseline, 'baseline'),
        actual = num(b.actual, 'actual'),
        amount = num(b.amount, 'amount', 0);
      if (baseline !== a.baseline) fail(422, 'BASELINE_MISMATCH', 'Use the approved baseline');
      if (!['currency', 'SAR', 'sar', get(req, 'entity', a.entity_id).currency].includes(a.unit))
        fail(
          422,
          'MONETARY_BASELINE_REQUIRED',
          'This pilot verifies monetary benefits only against a currency baseline; create a linked monetary action with supporting evidence',
        );
      if (
        ['cash_release', 'financing_saving', 'risk_exposure'].includes(effect) &&
        actual > baseline
      )
        fail(
          422,
          'BENEFIT_DIRECTION',
          'The observed change does not reduce the approved cash, cost or risk baseline',
        );
      if (effect === 'annual_profit' && actual < baseline)
        fail(
          422,
          'BENEFIT_DIRECTION',
          'Annual profit benefit requires improvement against the approved baseline',
        );
      if (amount > Math.abs(actual - baseline) + 1e-6)
        fail(
          422,
          'BENEFIT_EXCEEDS_CHANGE',
          'Verified benefit cannot exceed the observed baseline change',
        );
      const group = a.dependency_group || a.finding_id || a.id;
      for (const other of list(req, 'action', a.entity_id))
        for (const old of other.benefits || [])
          if (
            old.effect_type === effect &&
            old.dependency_group === group &&
            old.period_start <= end &&
            old.period_end >= start
          )
            fail(
              409,
              'BENEFIT_OVERLAP',
              'This period and dependency group already has a verified benefit',
            );
      const benefit = {
        id: id(),
        baseline,
        actual,
        amount,
        effect_type: effect,
        period_start: start,
        period_end: end,
        method: str(b.method, 'method', 4000),
        confounders: str(b.confounders, 'confounders', 4000),
        dependency_group: group,
        verified_by: req.auth.id,
        verified_at: now(),
      };
      a.benefits.push(benefit);
      a.status = 'benefit_verified';
      a.version++;
      a.history.push({
        at: now(),
        by: req.auth.id,
        status: 'benefit_verified',
        reason: benefit.method,
      });
      put(req, 'action', a);
      audit(req, 'action.benefit_verify', a.id, {
        benefit_id: benefit.id,
        amount,
        effect_type: effect,
      });
      res.json(safeAction(a));
    }),
  );
  const reportAccess = (req, r) => {
    allow(req, ['cfo', 'analyst', 'board']);
    if (req.auth.role === 'board' && r.status !== 'approved')
      fail(404, 'NOT_FOUND', 'Report not found');
    return r;
  };
  const safeReport = (req, r) => {
    const out = clone(r);
    if (req.auth.role === 'board') {
      out.snapshot.sections = completeEvidenceReferences(
        out.snapshot,
        out.snapshot.sections,
        out.language,
      );
      delete out.snapshot.dataset.facts;
      delete out.snapshot.dataset.source_preview;
      for (const s of out.snapshot.sections)
        for (const item of s.items) {
          delete item.source;
          delete item.source_refs;
          delete item.missing_references;
        }
      for (const m of out.snapshot.analysis.metrics || []) delete m.source_refs;
      for (const f of out.snapshot.analysis.findings || []) delete f.source_refs;
      for (const action of out.snapshot.actions) {
        action.evidence = (action.evidence || []).map((e) => ({
          id: e.id,
          title: e.title,
          created_at: e.created_at,
        }));
      }
    }
    return out;
  };
  app.get(
    '/api/reports',
    wrap((req, res) => {
      allow(req, ['cfo', 'analyst', 'board']);
      res.json(
        list(req, 'report', req.query.entity_id)
          .filter((r) => req.auth.role !== 'board' || r.status === 'approved')
          .map((r) => safeReport(req, r)),
      );
    }),
  );
  app.post(
    '/api/reports',
    wrap((req, res) => {
      allow(req);
      const b = req.body,
        e = get(req, 'entity', b.entity_id),
        a = get(req, 'analysis', b.analysis_id),
        d = get(req, 'dataset', a.dataset_id);
      if (a.entity_id !== e.id) fail(404, 'NOT_FOUND', 'Analysis not found for entity');
      if (a.dataset_version !== d.version || a.settings_version !== settings(req).version)
        fail(409, 'STALE_ANALYSIS', 'Generate a current analysis before creating a report');
      const config = audienceConfig(root),
        audience = enumOf(
          b.audience || 'ceo',
          config.audiences.map((a) => a.id),
          'audience',
        ),
        purpose = str(b.purpose, 'purpose', 2000, true) || 'Evidence-based financial reading',
        detail = enumOf(
          b.detail_level || 'standard',
          ['brief', 'standard', 'detailed'],
          'detail_level',
        );
      if (
        b.focus_questions !== undefined &&
        (!Array.isArray(b.focus_questions) ||
          b.focus_questions.length > 12 ||
          b.focus_questions.some((q) => typeof q !== 'string' || q.length > 500))
      )
        fail(422, 'VALIDATION_ERROR', 'Invalid focus questions');
      const language = enumOf(b.language || 'ar', ['ar', 'en'], 'language'),
        snapshot = {
          entity: clone(e),
          dataset: clone(d),
          analysis: clone(a),
          actions: actionsFor(req, e.id).map(safeAction),
          scenarios: list(req, 'scenario', e.id).filter(
            (s) => s.dataset_id === d.id && s.dataset_version === d.version,
          ),
          benchmarks: list(req, 'benchmark', e.id).filter(
            (s) => s.dataset_id === d.id && s.dataset_version === d.version,
          ),
          settings: clone(settings(req)),
          audience,
          purpose,
          template_version: config.version,
          detail_level: detail,
          focus_questions: b.focus_questions || [],
        };
      snapshot.sections = buildSections(
        snapshot,
        config,
        language,
        detail,
        snapshot.focus_questions,
      );
      const r = {
        id: id(),
        entity_id: e.id,
        analysis_id: a.id,
        dataset_id: d.id,
        dataset_version: d.version,
        settings_version: settings(req).version,
        title: str(b.title, 'title'),
        language,
        audience,
        purpose,
        detail_level: detail,
        focus_questions: snapshot.focus_questions,
        template_version: config.version,
        status: 'draft',
        snapshot,
        created_by: req.auth.id,
        created_at: now(),
        version: 1,
      };
      r.snapshot_sha256 = hash(JSON.stringify(snapshot));
      put(req, 'report', r);
      audit(req, 'report.create', r.id, { audience, template_version: r.template_version });
      res.status(201).json(r);
    }),
  );
  app.get(
    '/api/reports/:id',
    wrap((req, res) =>
      res.json(safeReport(req, reportAccess(req, get(req, 'report', req.params.id)))),
    ),
  );
  app.post(
    '/api/reports/:id/approve',
    wrap((req, res) => {
      allow(req, ['cfo']);
      const r = get(req, 'report', req.params.id);
      if (req.body.version !== undefined) revision(r, req.body.version);
      if (r.status === 'approved') fail(422, 'IMMUTABLE', 'Approved reports are immutable');
      if (r.created_by === req.auth.id)
        fail(422, 'INDEPENDENT_REVIEW_REQUIRED', 'A different CFO must approve the report');
      const d = get(req, 'dataset', r.dataset_id);
      if (d.version !== r.dataset_version || r.settings_version !== settings(req).version)
        fail(409, 'STALE_REPORT', 'Source or policy version changed; generate a new report');
      if (get(req, 'analysis', r.analysis_id).version !== r.snapshot.analysis.version)
        fail(409, 'STALE_REPORT', 'Finding review changed; generate a new report');
      if (
        d.status !== 'approved' ||
        d.approved_version !== d.version ||
        d.approved_settings_version !== settings(req).version
      )
        fail(
          422,
          'DATASET_APPROVAL_REQUIRED',
          'The current dataset must be independently approved',
        );
      r.status = 'approved';
      r.approved_by = req.auth.id;
      r.approved_at = now();
      r.source_approval = {
        dataset_id: d.id,
        dataset_version: d.version,
        approved_by: d.approved_by,
        approved_at: d.approved_at,
        settings_version: d.approved_settings_version,
      };
      r.version++;
      put(req, 'report', r);
      audit(req, 'report.approve', r.id, { snapshot_sha256: r.snapshot_sha256 });
      res.json(r);
    }),
  );
  app.get(
    '/api/reports/:id/export',
    wrap((req, res) => {
      const r = safeReport(req, reportAccess(req, get(req, 'report', req.params.id))),
        format = req.query.format || 'html';
      enumOf(format, ['html', 'json'], 'format');
      audit(req, 'report.export', r.id, { format, audience: r.audience });
      res.set(
        'Content-Disposition',
        `${format === 'html' ? 'inline' : 'attachment'}; filename="basira-${r.id}.${format}"`,
      );
      if (format === 'json') return res.json(r);
      res.type('html').send(renderReport(r));
    }),
  );
  app.post(
    '/api/assistant',
    wrap(async (req, res) => {
      allow(req, ['cfo', 'analyst', 'board']);
      const b = req.body,
        e = get(req, 'entity', b.entity_id),
        question = str(b.question, 'question', 2000);
      let analysis, dataset, report;
      if (b.report_id) {
        report = reportAccess(req, get(req, 'report', b.report_id));
        if (report.entity_id !== e.id) fail(404, 'NOT_FOUND', 'Report not found for entity');
        analysis = report.snapshot.analysis;
        dataset = report.snapshot.dataset;
      } else if (req.auth.role === 'board') {
        report = list(req, 'report', e.id).find((r) => r.status === 'approved');
        analysis = report?.snapshot.analysis;
        dataset = report?.snapshot.dataset;
      } else {
        dataset = list(req, 'dataset', e.id)[0];
        analysis =
          dataset &&
          list(req, 'analysis', e.id).find(
            (a) => a.dataset_id === dataset.id && a.dataset_version === dataset.version,
          );
      }
      const ar = /[\u0600-\u06ff]/.test(question),
        limitations = ar
          ? [
              'إجابة من الأدلة المحفوظة، دون اتصال بنموذج لغوي خارجي.',
              'النسب الإجمالية لا تثبت السبب أو أداء عميل أو قطاع.',
            ]
          : [
              'Response from stored evidence; no external language model is connected.',
              'Aggregate ratios do not establish causes or customer/segment performance.',
            ];
      if (!analysis)
        return res.json({
          answer: ar
            ? 'لا يتوفر تحليل مصرح لك بالاطلاع عليه. أضف مصدرًا وراجعه أولًا.'
            : 'No authorized analysis is available. Upload and review a source first.',
          mode: 'evidence',
          citations: [],
          limitations,
        });
      // Optional bounded AI evidence selection (disabled unless BASIRA_AI_ENABLED,
      // ANTHROPIC_API_KEY and ANTHROPIC_MODEL are all set). Purely additive: it only
      // overrides the response below when it returns a validated, non-empty selection;
      // any absence, disablement, timeout, refusal or invalid output falls through
      // unchanged to the existing local keyword-evidence mode.
      // authorizedCatalog caps at 80 entries; analysis.metrics holds every period (up to
      // 35 metrics × 3+ periods), and periods appear in the array in chronological order,
      // so an unfiltered pass silently drops the *latest*, most relevant period first once
      // the cap is hit. Restrict to the latest period, matching the existing local
      // keyword-evidence fallback below, which already does the same thing.
      const latestPeriod = [...analysis.periods].sort().at(-1);
      const authCatalog = authorizedCatalog({
        userRole: req.auth.role,
        allowedMetrics: analysis.metrics.filter((m) => m.period === latestPeriod),
        allowedFacts: dataset?.facts || [],
        approvedReport: report?.status === 'approved',
        reportId: report?.id ?? null,
      });
      const ai = await getAiSelection({
        catalog: authCatalog,
        question,
        language: ar ? 'ar' : 'en',
      });
      if (ai?.usage) audit(req, 'assistant.ai_attempt', analysis.id, ai.usage);
      if (ai?.selected?.length) {
        audit(req, 'assistant.llm', analysis.id, {
          report_id: report?.id || null,
          citation_ids: ai.selected.map((r) => r.citation_id),
        });
        // renderSelection() hardcodes mode:'evidence' (it only describes the answer text as
        // deterministic, never having been wired to a live model before); this path was
        // reached specifically because the model chose the evidence, so the response must
        // say so per the documented {mode:"evidence"|"llm"} contract, and the limitations
        // text must not claim no external model was used when one just was.
        return res.json({
          ...renderSelection(ai.selected, ar ? 'ar' : 'en'),
          mode: 'llm',
          limitations: ar
            ? [
                'اختار نموذج لغوي خارجي الأدلة ذات الصلة من فهرس معتمد مسبقًا فقط؛ لم يُرسل له أي قيمة مالية أو مستند أصلي، والقيمة المعروضة مخزّنة محليًا لا مولّدة.',
                'النسب الإجمالية لا تثبت السبب أو أداء عميل أو قطاع.',
              ]
            : [
                'An external language model selected the relevant evidence from a pre-authorized catalog only; no financial value or source document was ever sent to it, and the displayed value is stored locally, not model-generated.',
                'Aggregate ratios do not establish causes or customer/segment performance.',
              ],
        });
      }
      const query = question.toLowerCase(),
        words = query.split(/\s+/).filter((w) => w.length > 2),
        latest = [...analysis.periods].sort().at(-1);
      let found = analysis.metrics
        .filter(
          (m) =>
            m.period === latest &&
            [m.key, m.label_ar, m.label_en].some(
              (label) =>
                label &&
                (query.includes(label.toLowerCase()) ||
                  words.some((w) => label.toLowerCase().includes(w))),
            ),
        )
        .slice(0, 5);
      if (/customer|segment|fraud|عميل|عملاء|قطاع|احتيال/.test(query)) found = [];
      const citations = found.map((m) => ({
        label: m[ar ? 'label_ar' : 'label_en'] || m.key,
        metric_id: m.id,
        report_id: report?.id,
      }));
      const answer = found.length
        ? found
            .map(
              (m) =>
                `${m[ar ? 'label_ar' : 'label_en'] || m.key} (${m.period}): ${m.value === null ? (ar ? 'غير متاح' : 'unavailable') : m.value} ${m.unit}. ${m[ar ? 'explanation_ar' : 'explanation_en'] || m.formula}`,
            )
            .join('\n')
        : ar
          ? 'لا تتوفر أدلة كافية للإجابة عن هذا السؤال بدقة. اسأل عن مؤشر مسمى أو أضف البيانات التفصيلية المطلوبة.'
          : 'The available evidence does not support a precise answer. Ask about a named metric or provide the required detailed data.';
      audit(req, 'assistant.evidence', analysis.id, {
        report_id: report?.id || null,
        metric_ids: found.map((m) => m.id),
      });
      res.json({ answer, mode: 'evidence', citations, limitations });
    }),
  );
  app.get(
    '/api/audit',
    wrap((req, res) => {
      allow(req, ['cfo']);
      res.json(
        db
          .prepare(
            'SELECT id,user_id,action,resource_id,created_at,details FROM audit WHERE tenant_id=? ORDER BY rowid DESC LIMIT 1000',
          )
          .all(req.auth.tenant_id)
          .map((a) => ({ ...a, details: JSON.parse(a.details) })),
      );
    }),
  );
  app.get(
    '/api/notifications',
    wrap((req, res) => res.json(notifications(req))),
  );
  app.post(
    '/api/notifications/:id/read',
    wrap((req, res) => {
      const n = get(req, 'notification', req.params.id);
      if (n.user_id && n.user_id !== req.auth.id) fail(404, 'NOT_FOUND', 'Notification not found');
      n.read = true;
      n.read_at = now();
      n.version++;
      put(req, 'notification', n);
      res.json(n);
    }),
  );
  app.get(
    '/api/settings',
    wrap((req, res) => {
      requireAuth(req);
      res.json(settings(req));
    }),
  );
  app.patch(
    '/api/settings',
    wrap((req, res) => {
      allow(req, ['cfo']);
      const s = settings(req),
        b = req.body;
      revision(s, b.version);
      const allowed = [
        'version',
        'days',
        'include_leases',
        'materiality_pct',
        'retention_days',
        'locale',
      ];
      if (Object.keys(b).some((k) => !allowed.includes(k)))
        fail(422, 'UNKNOWN_SETTING', 'Unknown policy field');
      if (b.days !== undefined) s.days = enumOf(b.days, [360, 365, 366], 'days');
      if (b.include_leases !== undefined) {
        if (typeof b.include_leases !== 'boolean')
          fail(422, 'VALIDATION_ERROR', 'include_leases must be boolean');
        s.include_leases = b.include_leases;
      }
      if (b.materiality_pct !== undefined)
        s.materiality_pct = num(b.materiality_pct, 'materiality_pct', 0, 10);
      if (b.retention_days !== undefined) {
        s.retention_days = num(b.retention_days, 'retention_days', 30, 3650);
        if (!Number.isInteger(s.retention_days))
          fail(422, 'VALIDATION_ERROR', 'retention_days must be an integer');
      }
      if (b.locale !== undefined) s.locale = enumOf(b.locale, ['ar', 'en'], 'locale');
      s.version++;
      s.updated_at = now();
      s.updated_by = req.auth.id;
      put(req, 'settings', s);
      for (const d of list(req, 'dataset'))
        if (d.status === 'approved') {
          d.status = 'needs_review';
          d.approval_invalidated_at = now();
          d.approval_invalidated_reason = 'settings_changed';
          put(req, 'dataset', d);
        }
      audit(req, 'settings.update', s.id, { version: s.version });
      res.json(s);
    }),
  );
  app.get(
    '/api/forecasts',
    wrap((req, res) => {
      allow(req);
      res.json(list(req, 'forecast', req.query.entity_id));
    }),
  );
  app.post(
    '/api/forecasts',
    wrap((req, res) => {
      allow(req);
      const b = req.body,
        e = get(req, 'entity', b.entity_id),
        opening = num(b.opening_cash, 'opening_cash');
      if (!Array.isArray(b.weeks) || b.weeks.length !== 13)
        fail(422, 'THIRTEEN_WEEKS_REQUIRED', 'Provide exactly 13 weekly assumptions');
      let balance = opening;
      const weeks = b.weeks.map((w, index) => {
        const inflows = num(w.inflows, 'inflows', 0),
          outflows = num(w.outflows, 'outflows', 0),
          beginning = balance;
        balance += inflows - outflows;
        return {
          week: index + 1,
          opening_cash: beginning,
          inflows,
          outflows,
          closing_cash: balance,
          note: str(w.note, 'note', 1000, true),
        };
      });
      const f = {
        id: id(),
        entity_id: e.id,
        title: str(b.title, 'title'),
        currency: e.currency,
        opening_cash: opening,
        weeks,
        assumptions: str(b.assumptions, 'assumptions', 5000),
        source_basis: 'manual_operating_assumptions',
        not_derived_from_annual_statements: true,
        created_by: req.auth.id,
        created_at: now(),
        version: 1,
      };
      put(req, 'forecast', f);
      audit(req, 'forecast.create', f.id);
      res.status(201).json(f);
    }),
  );

  app.get(
    '/api/datasets/:id/revisions',
    wrap((req, res) => {
      allow(req);
      const d = get(req, 'dataset', req.params.id),
        events = db
          .prepare(
            "SELECT user_id,created_at,details FROM audit WHERE tenant_id=? AND resource_id=? AND action='dataset.facts_edit' ORDER BY rowid DESC",
          )
          .all(req.auth.tenant_id, d.id)
          .map((a) => ({ ...a, details: JSON.parse(a.details) }));
      const revisions = list(req, 'dataset_revision', d.entity_id)
        .filter((r) => r.dataset_id === d.id)
        .sort((a, b) => b.version - a.version)
        .map((r) => {
          const event = events.find((a) => a.details.version === r.version + 1);
          return {
            ...r,
            reason: r.change_reason || event?.details.reason || null,
            changed_by: r.changed_by || event?.user_id || null,
            changed_at: r.changed_at || event?.created_at || null,
            next_version: r.next_version || r.version + 1,
          };
        });
      res.json(revisions);
    }),
  );
  app.get(
    '/api/usage',
    wrap((req, res) => {
      allow(req);
      const entity = req.query.entity_id ? get(req, 'entity', req.query.entity_id) : null,
        entityId = entity?.id,
        events = list(req, 'usage_event', entityId),
        jobs = list(req, 'job', entityId).map((j) => ({
          id: j.id,
          entity_id: j.entity_id,
          document_id: j.document_id,
          dataset_id: j.dataset_id || null,
          status: j.status,
          started_at: j.started_at || null,
          completed_at: j.completed_at || null,
          duration_ms:
            j.duration_ms ??
            (j.started_at && j.completed_at
              ? Math.max(0, Date.parse(j.completed_at) - Date.parse(j.started_at))
              : null),
        })),
        records = list(req, 'review_cost', entityId),
        by_operation = {};
      for (const event of events) {
        const group = by_operation[event.operation] || {
          calls: 0,
          failed_calls: 0,
          duration_ms: 0,
        };
        group.calls++;
        if (event.status === 'failed') group.failed_calls++;
        group.duration_ms += event.duration_ms;
        by_operation[event.operation] = group;
      }
      const durations = jobs.filter((j) => j.duration_ms !== null).map((j) => j.duration_ms),
        totalDuration = durations.reduce((a, b) => a + b, 0),
        totals = {};
      for (const r of records) {
        const t = totals[r.currency] || { currency: r.currency, minutes: 0, amount: 0 };
        t.minutes += r.minutes;
        t.amount = Math.round((t.amount + r.amount) * 100) / 100;
        totals[r.currency] = t;
      }
      res.json({
        entity_id: entityId || null,
        as_of: now(),
        jobs: {
          total: jobs.length,
          queued: jobs.filter((j) => j.status === 'queued').length,
          running: jobs.filter((j) => j.status === 'running').length,
          completed: jobs.filter((j) => j.status === 'completed').length,
          failed: jobs.filter((j) => j.status === 'failed').length,
          total_duration_ms: totalDuration,
          average_duration_ms: durations.length ? totalDuration / durations.length : null,
          items: jobs,
        },
        engine: {
          total_calls: events.length,
          completed_calls: events.filter((e) => e.status === 'completed').length,
          failed_calls: events.filter((e) => e.status === 'failed').length,
          total_duration_ms: events.reduce((n, e) => n + e.duration_ms, 0),
          by_operation,
          events,
          metering_note:
            'Counts include engine calls recorded since usage metering was enabled; older calls are not reconstructed.',
        },
        costs: {
          external_ai: {
            amount: 0,
            currency: entity?.currency || 'SAR',
            provider: 'none',
            status: 'not_configured',
          },
          ocr: {
            amount: 0,
            currency: entity?.currency || 'SAR',
            provider: 'none',
            status: 'not_configured',
          },
          local_compute: { amount: null, status: 'not_metered' },
          review: { source: 'self_reported', totals: Object.values(totals), records },
        },
      });
    }),
  );
  app.post(
    '/api/usage/review',
    wrap((req, res) => {
      allow(req);
      const b = req.body,
        e = get(req, 'entity', b.entity_id),
        d = get(req, 'dataset', b.dataset_id);
      if (d.entity_id !== e.id) fail(404, 'NOT_FOUND', 'Dataset not found for entity');
      const minutes = num(b.minutes, 'minutes', 0.01, 1440),
        hourly_rate = num(b.hourly_rate, 'hourly_rate', 0, 1000000),
        curr = currency(b.currency || e.currency),
        r = {
          id: id(),
          entity_id: e.id,
          dataset_id: d.id,
          dataset_version: d.version,
          minutes,
          hourly_rate,
          currency: curr,
          amount: Math.round((minutes / 60) * hourly_rate * 100) / 100,
          source: 'self_reported',
          measurement_status: 'user_declared_not_automatically_tracked',
          created_by: req.auth.id,
          created_at: now(),
          version: 1,
        };
      put(req, 'review_cost', r);
      audit(req, 'usage.review_cost', r.id, {
        dataset_id: d.id,
        minutes,
        hourly_rate,
        currency: curr,
        amount: r.amount,
        self_reported: true,
      });
      res.status(201).json(r);
    }),
  );
  app.use('/api', (req, res, next) =>
    next(new ApiError(404, 'NOT_FOUND', 'API endpoint not found')),
  );
  const dist = join(root, 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: 0 }));
    app.get('*', (req, res) => res.sendFile(join(dist, 'index.html')));
  }
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    let status = err.status || 500,
      code = err.code || 'INTERNAL_ERROR',
      message = err.message || 'Request failed';
    if (err.type === 'entity.too.large') {
      status = 413;
      code = 'BODY_TOO_LARGE';
      message = 'Request is too large';
    } else if (err instanceof SyntaxError && err.status === 400) {
      code = 'INVALID_JSON';
      message = 'Invalid JSON body';
    } else if (status >= 500) {
      message = 'The request could not be completed. Please retry.';
      code = 'INTERNAL_ERROR';
    }
    res
      .status(status)
      .json({
        error: {
          code,
          message,
          message_ar: AR_ERRORS[code] || 'تعذر إكمال الطلب. راجع التفاصيل وحاول مجددًا.',
          ...(err.details ? { details: err.details } : {}),
        },
      });
  });
  return { app, close: () => store.close(), store, root };
}
