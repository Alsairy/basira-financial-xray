import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpLeft,
  Bell,
  BriefcaseBusiness,
  CalendarRange,
  ChevronDown,
  Eye,
  EyeOff,
  Files,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Scale,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { api, ApiError, post, setCsrf } from './api';
import { audiences, AudienceSelector } from './components/AudienceSelector';
import { Inspector } from './components/Inspector';
import { Button, Field, Loading, Modal, Notice } from './components/ui';
import { AppContext } from './context';
import type { Dashboard, Entity, Fact, Finding, Locale, Metric, Session } from './types';
const Overview = lazy(() => import('./pages/Overview'));
const Data = lazy(() => import('./pages/Data'));
const Analysis = lazy(() => import('./pages/Analysis'));
const Benchmarks = lazy(() => import('./pages/Benchmarks'));
const Scenarios = lazy(() => import('./pages/Scenarios'));
const Actions = lazy(() => import('./pages/Actions'));
const Reports = lazy(() => import('./pages/Reports'));
const Assistant = lazy(() => import('./pages/Assistant'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Forecast = lazy(() => import('./pages/Forecast'));
const nav = [
  { id: 'overview', ar: 'الصورة المالية', en: 'Overview', icon: LayoutDashboard },
  { id: 'data', ar: 'البيانات والمراجعة', en: 'Data & review', icon: Files },
  { id: 'analysis', ar: 'التشخيص والمؤشرات', en: 'Diagnosis & metrics', icon: ScanLine },
  { id: 'benchmarks', ar: 'المقارنات المرجعية', en: 'Benchmarks', icon: Scale },
  { id: 'scenarios', ar: 'مختبر الأثر', en: 'Impact lab', icon: SlidersHorizontal },
  { id: 'forecast', ar: 'توقعات السيولة', en: 'Cash forecast', icon: CalendarRange },
  { id: 'actions', ar: 'مساحة الإجراءات', en: 'Action workspace', icon: Target },
  { id: 'reports', ar: 'التقارير والمجلس', en: 'Reports & boardroom', icon: FileText },
  { id: 'assistant', ar: 'المساعد المالي', en: 'Financial assistant', icon: Sparkles },
  { id: 'settings', ar: 'الإعدادات والحوكمة', en: 'Settings & governance', icon: Settings },
];
const roles: Record<string, [string, string]> = {
  cfo: ['المدير المالي', 'CFO'],
  analyst: ['المحلل المالي', 'Analyst'],
  operator: ['مسؤول التنفيذ', 'Action owner'],
  board: ['قارئ المجلس', 'Board reader'],
};
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal-error">
        <h1>تعذر عرض هذه الصفحة / Unable to display this page</h1>
        <p>بياناتك محفوظة. أعد تحميل الصفحة والمحاولة. / Your saved data is retained.</p>
        <button onClick={() => location.reload()}>إعادة التحميل / Reload</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const qc = useQueryClient();
  const [locale, setLocale] = useState<Locale>(
      (localStorage.getItem('basira-locale') as Locale) || 'ar',
    ),
    [entityId, setEntityId] = useState(''),
    [period, setPeriod] = useState('2025'),
    [route, setRoute] = useState(location.hash.slice(1) || 'overview'),
    [audience, setAudienceState] = useState(
      audiences.some((a) => a.id === localStorage.getItem('basira-audience'))
        ? localStorage.getItem('basira-audience')!
        : 'ceo',
    ),
    [chooseAudience, setChooseAudience] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false),
    [inspectItem, setInspectItem] = useState<Fact | Metric | Finding | null>(null),
    [searchOpen, setSearchOpen] = useState(false),
    [search, setSearch] = useState(''),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [newEntity, setNewEntity] = useState(false),
    [busy, setBusy] = useState(false);
  const tr = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const sessionQuery = useQuery({
    queryKey: ['session'],
    retry: false,
    queryFn: async () => {
      try {
        const s = await api<Session>('/session');
        setCsrf(s.csrfToken);
        return s;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
  });
  const session = sessionQuery.data;
  const entitiesQuery = useQuery({
    queryKey: ['entities', session?.tenant.id],
    queryFn: () => api<Entity[]>('/entities'),
    enabled: !!session,
  });
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', session?.tenant.id, entityId],
    refetchInterval: 60000,
    queryFn: () => api<Dashboard>(`/dashboard?entity_id=${entityId}`),
    enabled: !!session && !!entityId,
  });
  const dashboard = dashboardQuery.data || null;
  const refresh = async () => {
    await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
    return dashboardQuery.refetch();
  };
  const navigate = (path: string) => {
    location.hash = path;
    setRoute(path);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    setTimeout(() => document.getElementById('main')?.focus(), 0);
  };
  const setAudience = (a: string) => {
    setAudienceState(a);
    localStorage.setItem('basira-audience', a);
  };
  const notify = (message: string) => toast.success(message);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('basira-locale', locale);
  }, [locale]);
  useEffect(() => {
    const f = () => {
      setRoute(location.hash.slice(1) || 'overview');
      setMobileMenu(false);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  useEffect(() => {
    if (entitiesQuery.data?.length && !entitiesQuery.data.some((e) => e.id === entityId))
      setEntityId(entitiesQuery.data[0].id);
  }, [entitiesQuery.data, entityId]);
  useEffect(() => {
    const ps = dashboard?.analysis?.periods || dashboard?.dataset?.periods;
    if (ps?.length && !ps.includes(period)) setPeriod(ps.at(-1)!);
  }, [dashboard, period]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);
  const authDone = async (s: Session, demo = false) => {
    setCsrf(s.csrfToken);
    if (demo) {
      const seed = await post<{ job_id?: string }>('/demo/seed');
      if (seed.job_id) {
        for (let i = 0; i < 90; i++) {
          const job = await api<{ status: string }>(`/jobs/${seed.job_id}`);
          if (job.status === 'completed') break;
          if (job.status === 'failed')
            throw new Error(
              tr(
                'تعذر تجهيز المثال. أعد المحاولة.',
                'The example could not be prepared. Please retry.',
              ),
            );
          if (i === 89)
            throw new Error(
              tr(
                'استغرقت المعالجة وقتًا أطول من المتوقع.',
                'Processing took longer than expected.',
              ),
            );
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }
    // Sets 'session' before touching anything else in the cache, and never clears/invalidates
    // it below. qc.clear() (the previous approach here) removes a query's cache entry even
    // for the actively-mounted `session` useQuery observer, and TanStack Query responds to an
    // observed-but-cacheless query by auto-refetching it — a redundant GET /session that runs
    // concurrently with the setQueryData call below. That refetch can resolve *after* ours
    // (especially over real network latency, e.g. Render's free tier) and silently overwrite
    // the session we just set with a failed/stale result, bouncing back to the login screen
    // even though the server session is genuinely valid (a manual reload then works, since
    // the race has already resolved by then). Scoping every cache reset below to exclude
    // 'session' — same principle `refresh()` already applies — removes the race entirely.
    qc.setQueryData(['session'], s);
    setEntityId('');
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
    // Only prompt for the reading audience when there's no remembered choice yet — a repeat
    // presenter re-logging in for the same audience shouldn't have to dismiss this every time.
    // Still reachable any time via the workspace-card or audience-trigger buttons.
    if (!localStorage.getItem('basira-audience')) setChooseAudience(true);
    navigate('overview');
  };
  if (sessionQuery.isPending) return <Loading />;
  if (!session) return <Auth locale={locale} setLocale={setLocale} onDone={authDone} />;
  const currentRoute = route.split('?')[0];
  const allowedNav = nav.filter((n) =>
    session.user.role === 'board'
      ? ['overview', 'reports', 'assistant'].includes(n.id)
      : session.user.role === 'operator'
        ? ['overview', 'actions'].includes(n.id)
        : true,
  );
  const active = allowedNav.find((n) => n.id === currentRoute) || allowedNav[0];
  const RoutePage = (
    {
      overview: Overview,
      data: Data,
      analysis: Analysis,
      benchmarks: Benchmarks,
      scenarios: Scenarios,
      actions: Actions,
      reports: Reports,
      assistant: Assistant,
      settings: SettingsPage,
      forecast: Forecast,
    } as Record<string, React.ComponentType>
  )[active.id];
  const selectedAudience = audiences.find((a) => a.id === audience) || audiences[1];
  const notifications = dashboard?.notifications || [];
  return (
    <AppContext.Provider
      value={{
        locale,
        tr,
        session,
        dashboard,
        entityId,
        period,
        setPeriod,
        refresh,
        navigate,
        inspect: setInspectItem,
        notify,
        audience,
        setAudience,
      }}
    >
      <ErrorBoundary>
        <a
          className="skip-link"
          href="#main"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('main')?.focus();
          }}
        >
          {tr('تجاوز إلى المحتوى', 'Skip to content')}
        </a>
        <div className={`app-shell ${mobileMenu ? 'mobile-menu-open' : ''}`}>
          {mobileMenu && (
            <button
              className="sidebar-backdrop"
              aria-label={tr('إغلاق القائمة', 'Close menu')}
              onClick={() => setMobileMenu(false)}
            />
          )}
          <aside
            className="sidebar"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setMobileMenu(false);
                document.querySelector<HTMLButtonElement>('.mobile-toggle')?.focus();
              }
              if (e.key === 'Tab' && mobileMenu) {
                const nodes = Array.from(
                  e.currentTarget.querySelectorAll<HTMLElement>('a,button,select'),
                ).filter((n) => !n.hasAttribute('disabled'));
                if (e.shiftKey && document.activeElement === nodes[0]) {
                  e.preventDefault();
                  nodes.at(-1)?.focus();
                } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
                  e.preventDefault();
                  nodes[0]?.focus();
                }
              }
            }}
          >
            <button
              className="icon-button mobile-sidebar-close"
              aria-label={tr('إغلاق القائمة', 'Close navigation')}
              onClick={() => {
                setMobileMenu(false);
                document.querySelector<HTMLButtonElement>('.mobile-toggle')?.focus();
              }}
            >
              <X size={19} />
            </button>
            <div className="sidebar-scroll">
              <a
                className="brand"
                href="#overview"
                aria-label={tr('بصيرة الرئيسية', 'Basira home')}
              >
                <span className="brand-symbol">
                  <img src="/brand/basira-mark-reversed.svg" alt="" width={41} height={41} />
                </span>
                <span>
                  <strong>بصيرة</strong>
                  <small>BASIRA · FINANCIAL X-RAY</small>
                </span>
              </a>
              <button className="workspace-card" onClick={() => setChooseAudience(true)}>
                <span className="workspace-avatar">
                  <BriefcaseBusiness size={20} />
                </span>
                <span>
                  <strong>
                    {session.tenant.demo
                      ? tr('مساحة علم المرجعية', 'Elm reference workspace')
                      : session.tenant.name}
                  </strong>
                  <small>{tr(selectedAudience.short_ar, selectedAudience.short_en)}</small>
                </span>
                <ChevronDown size={15} />
              </button>
              <div className="nav-label">{tr('مساحة القرار', 'DECISION WORKSPACE')}</div>
              <nav aria-label={tr('التنقل الرئيسي', 'Main navigation')}>
                {allowedNav
                  .filter((n) => n.id !== 'settings')
                  .map((n) => (
                    <a
                      href={`#${n.id}`}
                      key={n.id}
                      onClick={() => setMobileMenu(false)}
                      className={active.id === n.id ? 'active' : ''}
                      aria-current={active.id === n.id ? 'page' : undefined}
                    >
                      <n.icon size={19} />
                      <span>{tr(n.ar, n.en)}</span>
                      {n.id === 'actions' &&
                        !!dashboard?.actions.filter(
                          (a) => !['closed', 'benefit_verified'].includes(a.status),
                        ).length && (
                          <span className="nav-count">
                            {
                              dashboard.actions.filter(
                                (a) => !['closed', 'benefit_verified'].includes(a.status),
                              ).length
                            }
                          </span>
                        )}
                    </a>
                  ))}
              </nav>
            </div>
            <div className="sidebar-bottom">
              <div className="trust-note">
                <ShieldCheck size={19} />
                <div>
                  <strong>{tr('القرار يبدأ بالدليل', 'Decisions start with evidence')}</strong>
                  <p>{tr('مصدر واضح. مراجعة مستقلة.', 'Clear sources. Independent review.')}</p>
                </div>
              </div>
              {allowedNav.some((n) => n.id === 'settings') && (
                <a
                  href="#settings"
                  className={`settings-nav ${active.id === 'settings' ? 'active' : ''}`}
                >
                  <Settings size={18} />
                  {tr('الإعدادات والحوكمة', 'Settings & governance')}
                </a>
              )}
              <div className="user-card">
                <span className="avatar">{session.user.name.slice(0, 1)}</span>
                <div>
                  <strong>
                    {session.tenant.demo ? tr(...roles[session.user.role]) : session.user.name}
                  </strong>
                  <small>{tr(...roles[session.user.role])}</small>
                </div>
                <button
                  className="icon-button"
                  aria-label={tr('تسجيل الخروج', 'Sign out')}
                  onClick={async () => {
                    await post('/auth/logout');
                    qc.clear();
                    setEntityId('');
                    qc.setQueryData(['session'], null);
                  }}
                >
                  <LogOut size={17} />
                </button>
              </div>
            </div>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <button
                className="icon-button mobile-toggle"
                onClick={() => {
                  setMobileMenu(true);
                  setTimeout(
                    () =>
                      document.querySelector<HTMLButtonElement>('.mobile-sidebar-close')?.focus(),
                    30,
                  );
                }}
                aria-label={tr('فتح القائمة', 'Open menu')}
              >
                <Menu size={21} />
              </button>
              <div className="breadcrumb">
                <span>{tr('مساحة العمل', 'Workspace')}</span>
                <span>/</span>
                <strong>{tr(active.ar, active.en)}</strong>
              </div>
              <div className="topbar-controls">
                <button className="search-trigger" onClick={() => setSearchOpen(true)}>
                  <Search size={17} />
                  <span>{tr('ابحث عن مؤشر أو قرار', 'Find a metric or decision')}</span>
                  <kbd>⌘ K</kbd>
                </button>
                <button
                  className="locale-button"
                  onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
                >
                  {locale === 'ar' ? 'EN' : 'عربي'}
                </button>
                <button
                  className="icon-button notification-button"
                  onClick={() => setNotificationsOpen(true)}
                  aria-label={tr('الإشعارات', 'Notifications')}
                >
                  <Bell size={20} />
                  {notifications.some((n) => !n.read_at && !n.read) && <i />}
                </button>
              </div>
            </header>
            <div className="workspace-controls">
              <div className="row gap wrap">
                <label className="entity-select">
                  <span className="entity-icon">{dashboard?.entity?.name.slice(0, 1) || 'ب'}</span>
                  <select
                    value={entityId}
                    onChange={(e) => {
                      setEntityId(e.target.value);
                      setInspectItem(null);
                    }}
                    aria-label={tr('الشركة', 'Entity')}
                  >
                    {entitiesQuery.data?.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name === 'Elm reference - demonstration'
                          ? tr('شركة علم · مرجعية', 'Elm · reference')
                          : e.name}
                      </option>
                    ))}
                  </select>
                </label>
                {session.user.role === 'cfo' && (
                  <button
                    className="icon-button"
                    aria-label={tr('إضافة شركة', 'Add entity')}
                    onClick={() => setNewEntity(true)}
                  >
                    <Plus size={17} />
                  </button>
                )}
                <span className="control-divider" />
                <button className="audience-trigger" onClick={() => setChooseAudience(true)}>
                  <span>{tr('منظور', 'View for')}</span>
                  <strong>{tr(selectedAudience.short_ar, selectedAudience.short_en)}</strong>
                  <ChevronDown size={14} />
                </button>
              </div>
              <label className="period-select">
                <CalendarRange size={16} />
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  aria-label={tr('السنة المالية', 'Financial year')}
                >
                  {(dashboard?.analysis?.periods || dashboard?.dataset?.periods || ['2025']).map(
                    (p) => (
                      <option key={p} value={p}>
                        {tr('السنة المالية', 'FY')} {p}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
            {session.tenant.demo && (
              <div className="demo-strip">
                <span>
                  <span className="demo-dot" />
                  {tr(
                    'مساحة تجربة معزولة · بيانات علم المرجعية',
                    'Isolated demo · Elm reference data',
                  )}
                </span>
                <label>
                  <span>{tr('جرّب صلاحية', 'Demo role')}</span>
                  <select
                    value={session.user.role}
                    onChange={async (e) => {
                      setBusy(true);
                      try {
                        const s = await post<Session>('/auth/demo', { role: e.target.value });
                        setCsrf(s.csrfToken);
                        qc.clear();
                        qc.setQueryData(['session'], s);
                        setInspectItem(null);
                        navigate(s.user.role === 'board' ? 'reports' : 'overview');
                      } catch (err) {
                        toast.error((err as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                  >
                    {Object.entries(roles).map(([r, l]) => (
                      <option key={r} value={r}>
                        {tr(...l)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <main id="main" tabIndex={-1} className="content">
              {dashboardQuery.isPending && entityId ? (
                <Loading />
              ) : dashboardQuery.error ? (
                <Notice type="error">
                  {tr('تعذر تحميل مساحة الشركة.', 'Could not load company workspace.')}{' '}
                  <Button variant="ghost" onClick={() => dashboardQuery.refetch()}>
                    {tr('إعادة المحاولة', 'Retry')}
                  </Button>
                </Notice>
              ) : (
                <Suspense fallback={<Loading />}>
                  <RoutePage />
                </Suspense>
              )}
            </main>
            <footer className="app-footer">
              <span>
                بصيرة <span className="footer-separator">/</span>{' '}
                {tr('وضوح يقود إلى أثر', 'Clarity that leads to impact')}
              </span>
              <span>{tr('نسخة تطوير محلية', 'Local development build')} · v0.1</span>
            </footer>
          </div>
        </div>
        <Inspector item={inspectItem} onClose={() => setInspectItem(null)} />
        <Modal
          open={chooseAudience}
          onClose={() => setChooseAudience(false)}
          title={tr('لمن تُعد هذه القراءة؟', 'Who is this financial reading for?')}
          description={tr(
            'اختر المتلقي الأساسي. يمكنك إعداد نسخ مختلفة من نفس الحقائق لاحقًا.',
            'Choose the primary recipient. You can create different reports from the same facts later.',
          )}
          wide
        >
          <AudienceSelector value={audience} onChange={setAudience} />
          <Notice>
            {tr(
              'المنظور يغيّر أولويات العرض، ولا يغيّر صلاحياتك أو أرقام الشركة.',
              'The perspective changes presentation priorities, not your permissions or the company’s figures.',
            )}
          </Notice>
          <div className="modal-footer">
            <Button
              onClick={() => {
                // The toast below claims the choice was saved — persist it even when the
                // pre-selected default was accepted without touching a radio (AudienceSelector's
                // onChange, which normally calls setAudience, never fires in that case).
                setAudience(audience);
                setChooseAudience(false);
                notify(tr('حُفظ منظور القراءة', 'Reading perspective saved'));
              }}
            >
              {tr('متابعة بهذا المنظور', 'Continue with this perspective')}
              <ArrowUpLeft size={17} />
            </Button>
          </div>
        </Modal>
        <Modal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          title={tr('بحث سريع', 'Quick search')}
        >
          <div className="search-field large">
            <Search size={19} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('اسم مؤشر، ملاحظة، أو صفحة…', 'Metric, finding, or page…')}
            />
          </div>
          <div className="search-results">
            {allowedNav
              .filter((n) => `${n.ar} ${n.en}`.toLowerCase().includes(search.toLowerCase()))
              .map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    navigate(n.id);
                    setSearchOpen(false);
                  }}
                >
                  <n.icon size={17} />
                  <span>{tr(n.ar, n.en)}</span>
                  <ArrowUpLeft size={15} />
                </button>
              ))}
            {search &&
              dashboard?.analysis?.metrics
                .filter(
                  (m) =>
                    m.period === period &&
                    `${m.label_ar} ${m.label_en}`.toLowerCase().includes(search.toLowerCase()),
                )
                .slice(0, 8)
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSearchOpen(false);
                      setInspectItem(m);
                    }}
                  >
                    <ScanLine size={17} />
                    {tr(m.label_ar, m.label_en)}
                  </button>
                ))}
          </div>
        </Modal>
        <Modal
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          title={tr('الإشعارات', 'Notifications')}
        >
          <div className="notification-list">
            {notifications.length ? (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={async () => {
                    await post(`/notifications/${n.id}/read`);
                    await refresh();
                  }}
                >
                  <Bell size={18} />
                  <span>
                    <strong>
                      {String(
                        n.title || n.message || tr('تحديث في مساحة العمل', 'Workspace update'),
                      )}
                    </strong>
                    <small>
                      {n.created_at ? new Date(n.created_at).toLocaleString(locale) : ''}
                    </small>
                  </span>
                  {!n.read_at && !n.read && <i />}
                </button>
              ))
            ) : (
              <div className="empty">
                <Bell size={28} />
                <h3>{tr('أنت مطّلع على كل جديد', 'You’re all caught up')}</h3>
                <p>
                  {tr(
                    'تظهر هنا التنبيهات المرتبطة بمسؤولياتك.',
                    'Alerts relevant to your responsibilities appear here.',
                  )}
                </p>
              </div>
            )}
          </div>
        </Modal>
        <Modal
          open={newEntity}
          onClose={() => setNewEntity(false)}
          title={tr('إضافة شركة لمساحة العمل', 'Add an entity to the workspace')}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                const entity = await post<Entity>('/entities', {
                  name: f.get('name'),
                  sector: f.get('sector'),
                  currency: 'SAR',
                });
                await entitiesQuery.refetch();
                setEntityId(entity.id);
                setNewEntity(false);
                navigate('data');
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label={tr('اسم الشركة', 'Company name')}>
              <input name="name" required />
            </Field>
            <Field label={tr('القطاع', 'Sector')}>
              <input name="sector" required defaultValue="IT Services" />
            </Field>
            <div className="modal-footer">
              <Button type="submit" busy={busy}>
                {tr('إنشاء الشركة', 'Create entity')}
              </Button>
            </div>
          </form>
        </Modal>
      </ErrorBoundary>
    </AppContext.Provider>
  );
}
/**
 * A static, hand-rolled illustration for the auth page's marketing side — a financial trend
 * line with a scan line sweeping across it, literalizing the product name (بصيرة/X-ray) rather
 * than using a generic stock illustration. Pure SVG (same rationale as BenchmarkDistribution
 * and MetricTrend): a small static diagram doesn't need a charting library.
 */
function AuthScanVisual({ tr }: { tr: (ar: string, en: string) => string }) {
  const points = [
    [10, 132],
    [55, 108],
    [100, 118],
    [145, 78],
    [190, 92],
    [235, 52],
    [280, 64],
    [325, 30],
  ];
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const area = `${line} L325,168 L10,168 Z`;
  return (
    <svg
      className="auth-visual"
      viewBox="0 0 336 180"
      role="img"
      aria-label={tr(
        'رسم توضيحي لخط بياني مالي متصاعد يمر عبره خط مسح',
        'Illustration of a rising financial trend line swept by a scan line',
      )}
    >
      {[36, 72, 108, 144].map((y) => (
        <line key={y} x1={0} y1={y} x2={336} y2={y} className="auth-visual-grid" />
      ))}
      <path d={area} className="auth-visual-area" />
      <path d={line} className="auth-visual-line" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 4.5 : 3} className="auth-visual-dot" />
      ))}
      <g className="auth-visual-scan">
        <line x1={235} y1={4} x2={235} y2={176} />
        <circle cx={235} cy={52} r={7} />
      </g>
    </svg>
  );
}
function Auth({
  locale,
  setLocale,
  onDone,
}: {
  locale: Locale;
  setLocale: (l: Locale) => void;
  onDone: (s: Session, demo?: boolean) => Promise<unknown>;
}) {
  const tr = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [mode, setMode] = useState('welcome'),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [showPassword, setShowPassword] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy('auth');
    setError('');
    try {
      const s = await post<Session>(
        mode === 'register' ? '/auth/register' : '/auth/login',
        Object.fromEntries(f),
      );
      await onDone(s);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? locale === 'ar'
            ? err.messageAr
            : err.message
          : (err as Error).message,
      );
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="auth-page">
      <div className="auth-top">
        <a className="brand" href="#">
          <span className="brand-symbol">
            <img src="/brand/basira-mark.svg" alt="" width={41} height={41} />
          </span>
          <span>
            <strong>بصيرة</strong>
            <small>BASIRA · FINANCIAL X-RAY</small>
          </span>
        </a>
        <button className="locale-button" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>
          {locale === 'ar' ? 'English' : 'العربية'}
        </button>
      </div>
      <div className="auth-layout">
        <div className="auth-story">
          <span className="eyebrow">
            {tr('من القوائم إلى القرار', 'FROM STATEMENTS TO DECISIONS')}
          </span>
          <h1>
            {tr(
              'افهم ما وراء الأرقام.\nوتابع ما يصنع الأثر.',
              'See beyond the numbers.\nFollow through on impact.',
            )}
          </h1>
          <p>
            {tr(
              'قراءة مالية تناسب من يتخذ القرار، تربط كل ملاحظة بمصدرها، وكل مبادرة بنتيجتها.',
              'A financial reading for each decision-maker, connecting every finding to its source and every initiative to its outcome.',
            )}
          </p>
          <AuthScanVisual tr={tr} />
          <div className="auth-proof">
            <span>
              <ShieldCheck size={18} />
              {tr('حسابات يمكن فحصها', 'Inspectable calculations')}
            </span>
            <span>
              <FileText size={18} />
              {tr('تقارير حسب المتلقي', 'Audience-aware reports')}
            </span>
            <span>
              <Target size={18} />
              {tr('أثر يتحقق منه مستقلًا', 'Independently verified benefits')}
            </span>
          </div>
          <div className="auth-journey">
            <span>
              01<b>{tr('مصدر', 'Source')}</b>
            </span>
            <i />
            <span>
              02<b>{tr('بصيرة', 'Insight')}</b>
            </span>
            <i />
            <span>
              03<b>{tr('قرار', 'Decision')}</b>
            </span>
            <i />
            <span>
              04<b>{tr('أثر', 'Impact')}</b>
            </span>
          </div>
        </div>
        <div className="auth-card">
          {mode === 'welcome' ? (
            <>
              <span className="auth-card-icon">
                <ScanLine size={30} />
              </span>
              <h2>{tr('ابدأ برؤية الصورة كاملة', 'Start with the full picture')}</h2>
              <p>
                {tr(
                  'استكشف تجربة حقيقية مبنية على ملف قوائم علم، أو أنشئ مساحة لبيانات شركتك.',
                  'Explore a real workflow using Elm’s statement workbook, or create a workspace for your company.',
                )}
              </p>
              <div className="auth-cta-group">
                <Button
                  busy={busy === 'demo'}
                  onClick={async () => {
                    setBusy('demo');
                    setError('');
                    try {
                      await onDone(await post<Session>('/auth/demo', {}), true);
                    } catch (err) {
                      setError(err instanceof ApiError ? err.messageAr : (err as Error).message);
                    } finally {
                      setBusy('');
                    }
                  }}
                >
                  <Eye size={18} />
                  {tr('استكشف تجربة علم', 'Explore the Elm workspace')}
                  <ArrowUpLeft size={17} />
                </Button>
                <small className="auth-cta-hint">
                  {tr(
                    'بدون تسجيل · بيانات تجريبية معزولة يمكن حذفها لاحقًا',
                    'No sign-up needed · isolated demo data, disposable anytime',
                  )}
                </small>
              </div>
              <div className="auth-divider">
                <span>{tr('أو لبيانات شركتك الحقيقية', 'Or for your own company data')}</span>
              </div>
              <div className="auth-cta-group">
                <Button variant="secondary" onClick={() => setMode('register')}>
                  {tr('إنشاء مساحة خاصة', 'Create a private workspace')}
                </Button>
                <small className="auth-cta-hint">
                  {tr(
                    'صلاحيات مستخدمين ومراجعة مستقلة كاملة من اليوم الأول',
                    'Full user roles and independent review from day one',
                  )}
                </small>
              </div>
              <Button variant="ghost" onClick={() => setMode('login')}>
                {tr('لديك حساب؟ تسجيل الدخول', 'Already have an account? Sign in')}
              </Button>
            </>
          ) : (
            <>
              <button className="text-link" onClick={() => setMode('welcome')}>
                {tr('العودة', 'Back')}
              </button>
              <h2>
                {mode === 'register'
                  ? tr('مساحتك المالية', 'Your financial workspace')
                  : tr('أهلًا بعودتك', 'Welcome back')}
              </h2>
              <form onSubmit={submit}>
                {mode === 'register' && (
                  <>
                    <Field label={tr('الاسم', 'Name')}>
                      <input name="name" autoComplete="name" required />
                    </Field>
                    <Field label={tr('الشركة', 'Company')}>
                      <input name="company" autoComplete="organization" required />
                    </Field>
                  </>
                )}
                <Field label={tr('البريد الإلكتروني', 'Email')}>
                  <input name="email" type="email" autoComplete="email" required dir="ltr" />
                </Field>
                <Field
                  label={tr('كلمة المرور', 'Password')}
                  hint={
                    mode === 'register'
                      ? tr('12 حرفًا على الأقل.', 'At least 12 characters.')
                      : undefined
                  }
                >
                  <div className="password-field">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      minLength={mode === 'register' ? 12 : 1}
                      required
                      dir="ltr"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={tr(
                        showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور',
                        showPassword ? 'Hide password' : 'Show password',
                      )}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>
                <Button busy={busy === 'auth'} type="submit">
                  {mode === 'register'
                    ? tr('إنشاء مساحة العمل', 'Create workspace')
                    : tr('دخول', 'Sign in')}
                </Button>
              </form>
            </>
          )}
          {!!error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>
      <footer>
        {tr(
          'نسخة تطوير محلية · لا تُرسل ملفاتك إلى مزود ذكاء اصطناعي تلقائيًا',
          'Local development build · files are not automatically sent to an AI provider',
        )}
      </footer>
    </div>
  );
}
