import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Activity, ArrowRight, ArrowUpRight, Check, ChevronRight, Clock3, Code2, FilePlus2, GitBranch, GitCommitHorizontal, Layers3, ListTodo, LockKeyhole, RefreshCw, Server, ShieldCheck, Terminal, Unplug, AlertCircle } from 'lucide-react';

type Metric = string | number | null;
type Integration = { id?: string; name: string; env?: string; successRate?: Metric; latencyMs?: Metric; status?: string };
type Deployment = { id?: string; repo: string; status?: string; commit?: string; duration?: string; time?: string };
type Task = { id: string; title: string; status?: string; assignee?: { fullName?: string } };
type Audit = { id: string; action: string; entity: string; createdAt: string; ipAddress?: string };
type Overview = { kpis: Record<string, Metric>; integrations: Integration[]; deployments: Deployment[]; tasks: Task[]; auditLogs: Audit[] };
const empty: Overview = { kpis: {}, integrations: [], deployments: [], tasks: [], auditLogs: [] };
function metric(value: Metric | undefined, suffix = '') {
  if (value == null || value === '' || (typeof value === 'number' && !Number.isFinite(value))) return '—';
  return typeof value === 'number' ? `${value.toLocaleString()}${suffix}` : value;
}
function Status({ value }: { value?: string }) {
  const label = value?.trim() || 'Unknown';
  const tone = /^(healthy|operational|connected|success|successful|active|up|done|completed|passed|online)$/i.test(label) ? 'positive' : /fail|down|error|incident|offline/i.test(label) ? 'negative' : /progress|pending|queue|deploying|degraded|warning|todo/i.test(label) ? 'pending' : 'neutral';
  return <span className={`eng-status eng-status-${tone}`}><span />{label.replaceAll('_', ' ')}</span>;
}
function EmptyState({ kind, title, body }: { kind: 'services' | 'deployments' | 'tasks' | 'audit'; title: string; body: string }) {
  const Icon = { services: Unplug, deployments: GitBranch, tasks: ListTodo, audit: ShieldCheck }[kind];
  return <div className="eng-empty"><span><Icon size={21} strokeWidth={1.5} /></span><h3>{title}</h3><p>{body}</p></div>;
}
function LoadingRows() { return <div className="eng-loading-rows" role="status" aria-label="Loading engineering data"><i /><i /><i /></div>; }

export function EngineeringDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<Overview>(empty);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const loadData = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const overview = await api.engineeringOverview();
      setData({ kpis: overview?.kpis ?? {}, integrations: Array.isArray(overview?.integrations) ? overview.integrations : [], deployments: Array.isArray(overview?.deployments) ? overview.deployments : [], tasks: Array.isArray(overview?.tasks) ? overview.tasks.slice(0, 6) : [], auditLogs: Array.isArray(overview?.auditLogs) ? overview.auditLogs.slice(0, 5) : [] });
      setUpdatedAt(new Date()); setError(null);
    } catch { setError('Engineering data could not be refreshed. Please try again.'); }
    finally { setLoading(false); setRefreshing(false); inFlight.current = false; }
  }, []);
  useEffect(() => {
    void loadData(); const timer = window.setInterval(loadData, 15000); window.addEventListener('focus', loadData);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', loadData); };
  }, [loadData]);
  const { kpis, integrations, deployments, tasks, auditLogs } = data;
  const done = tasks.filter(task => task.status === 'DONE').length;
  const active = tasks.filter(task => task.status === 'IN_PROGRESS').length;
  const queued = tasks.length - done - active;
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || 'team';
  const metrics = [
    { label: 'System uptime', value: metric(kpis.uptime, '%'), icon: Server, note: kpis.uptime == null ? 'Awaiting uptime telemetry' : 'Reported system availability' },
    { label: 'API latency', value: metric(kpis.apiPerformance, ' ms'), icon: Activity, note: kpis.apiPerformance == null ? 'Awaiting performance telemetry' : 'Reported API response time' },
    { label: 'Deployment success', value: metric(kpis.deploymentSuccessRate, '%'), icon: GitBranch, note: kpis.deploymentSuccessRate == null ? 'Awaiting deployment telemetry' : 'Reported deployment success rate' },
    { label: 'Security incidents', value: metric(kpis.securityIncidents), icon: ShieldCheck, note: kpis.securityIncidents == null ? 'Awaiting security telemetry' : 'Reported security incident count' },
  ];
  return <div className="engineering-dashboard" aria-busy={loading}>
    <div className="eng-breadcrumb"><Code2 size={13} /><span>Engineering</span><ChevronRight size={12} /><span>Overview</span></div>
    <header className="eng-heading"><div><p className="eng-eyebrow">YOUR ENGINEERING WORKSPACE</p><h1>A clearer view of what’s running.</h1><p>Welcome back, {firstName}. Here’s your infrastructure and team activity.</p></div><div className="eng-header-actions"><button type="button" onClick={loadData} disabled={refreshing} aria-label="Refresh engineering data" className="eng-refresh"><RefreshCw size={15} className={refreshing ? 'eng-spinning' : ''} />{refreshing ? 'Refreshing' : 'Refresh'}</button><Link to="/app/reports?new=1" className="eng-primary-action"><FilePlus2 size={15} />Work report</Link></div></header>
    <div className="eng-sync"><i className={error ? 'eng-sync-error' : loading ? 'eng-sync-loading' : ''} /><span role="status">{error ? (updatedAt ? 'Showing last available data' : 'Data unavailable') : loading ? 'Loading your workspace…' : `Last synced at ${updatedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</span><span className="eng-sync-divider" /><span>Refreshes every 15 seconds</span></div>
    {error && <div className="eng-error" role="alert"><AlertCircle size={17} /><span>{error}</span><button type="button" onClick={loadData} disabled={refreshing}>Try again<ArrowRight size={13} /></button></div>}
    <section className="eng-metrics" aria-label="Infrastructure metrics">{metrics.map(item => <article className="eng-metric" key={item.label}><div className="eng-metric-top"><span>{item.label}</span><item.icon size={16} strokeWidth={1.6} /></div><p className={loading ? 'eng-skeleton eng-metric-value' : 'eng-metric-value'}>{loading ? '\u00a0' : item.value}</p><span className="eng-metric-note">{loading ? 'Loading metric' : item.note}</span></article>)}</section>
    <div className="eng-main-grid">
      <section className="eng-panel eng-services"><div className="eng-panel-heading"><div><Server size={16} /><h2>Services & integrations</h2></div><span className="eng-count">{integrations.length} services</span></div><p className="eng-panel-description">Your gateways and core infrastructure, at a glance.</p>{loading ? <LoadingRows /> : integrations.length ? <div className="eng-services-list">{integrations.map((item, index) => <div className="eng-service" key={item.id || `${item.name}-${index}`}><span className="eng-service-icon"><Layers3 size={17} strokeWidth={1.5} /></span><div className="eng-service-name"><h3>{item.name}</h3><p>{item.env || 'Environment not provided'}<span>·</span>{item.successRate == null ? 'Success rate unavailable' : `${item.successRate} success`}</p></div><div className="eng-latency"><strong>{metric(item.latencyMs, ' ms')}</strong><span>RESPONSE TIME</span></div><Status value={item.status} /></div>)}</div> : <EmptyState kind="services" title="No service telemetry yet" body="Service health and response times will appear here when they’re available." />}<div className="eng-panel-footnote"><Activity size={13} /><span>Health reflects the latest available service data.</span></div></section>
      <section className="eng-panel eng-delivery"><div className="eng-panel-heading"><div><GitBranch size={16} /><h2>Recent deployments</h2></div><span className="eng-count">{deployments.length}</span></div><p className="eng-panel-description">A clear record of what shipped.</p>{loading ? <LoadingRows /> : deployments.length ? <div className="eng-deployments">{deployments.map((deployment, index) => <div className="eng-deployment" key={deployment.id || `${deployment.repo}-${index}`}><div><h3><GitCommitHorizontal size={15} />{deployment.repo}</h3><Status value={deployment.status} /></div><p><code>{deployment.commit || 'No commit reference'}</code><span>{deployment.duration || 'Duration unavailable'}</span></p>{deployment.time && <span className="eng-deployment-time"><Clock3 size={11} />{deployment.time}</span>}</div>)}</div> : <EmptyState kind="deployments" title="Your next release starts here" body="Deployment results will appear when your release telemetry is connected." />}<div className="eng-delivery-summary"><span>Recorded deployments<strong>{metric(kpis.totalDeployments)}</strong></span><span>Features in progress<strong>{metric(kpis.featuresInProgress)}</strong></span></div></section>
      <section className="eng-panel eng-tasks"><div className="eng-panel-heading"><div><ListTodo size={16} /><h2>Your engineering tasks</h2></div><Link to="/app/tasks">View all<ArrowUpRight size={14} /></Link></div><p className="eng-panel-description">The next things to move forward.</p>{loading ? <LoadingRows /> : tasks.length ? <><div className="eng-task-mix" aria-label={`Of ${tasks.length} shown tasks, ${done} complete, ${active} in progress and ${queued} queued`}><div>{done > 0 && <i className="eng-mix-done" style={{ flex: done }} />}{active > 0 && <i className="eng-mix-active" style={{ flex: active }} />}{queued > 0 && <i className="eng-mix-queued" style={{ flex: queued }} />}</div><p><span><i className="eng-mix-active" />In progress {active}</span><span><i className="eng-mix-queued" />Queued {queued}</span><span><i className="eng-mix-done" />Done {done}</span></p></div><div className="eng-task-list">{tasks.map(task => <div className="eng-task" key={task.id}><span className={`eng-task-marker${task.status === 'DONE' ? ' eng-task-complete' : ''}`}>{task.status === 'DONE' ? <Check size={12} /> : <i />}</span><div><h3>{task.title}</h3><p>{task.assignee?.fullName || 'Unassigned'}</p></div><Status value={task.status || 'TODO'} /></div>)}</div><div className="eng-panel-footnote"><ListTodo size={13} /><span>Showing {tasks.length} recent tasks · {metric(kpis.openBugs)} open tasks in total</span></div></> : <EmptyState kind="tasks" title="A clear task queue" body="Engineering tasks assigned to your workspace will appear here." />}</section>
      <div className="eng-side-stack"><section className="eng-vault"><div className="eng-vault-icon"><LockKeyhole size={20} strokeWidth={1.6} /></div><p>YOUR PROTECTED WORKSPACE</p><h2>Passwords and Keys</h2><span>Platform credentials and environment settings. Email authentication required to unlock.</span><Link to="/app/passwords-and-keys">Open credential vault<ArrowUpRight size={16} /></Link><div className="eng-vault-decoration" aria-hidden="true"><LockKeyhole size={83} strokeWidth={.7} /></div></section>
      <section className="eng-panel eng-audit"><div className="eng-panel-heading"><div><ShieldCheck size={16} /><h2>Activity & audit trail</h2></div><span className="eng-audit-label">RECENT</span></div>{loading ? <LoadingRows /> : auditLogs.length ? <ol className="eng-audit-list">{auditLogs.map(log => { const date = new Date(log.createdAt); return <li key={log.id}><i className="eng-audit-dot" /><div><h3>{log.action.replaceAll('_', ' ')}</h3><p>{log.entity}{log.ipAddress ? ` · ${log.ipAddress}` : ''}</p></div><time dateTime={log.createdAt} title={Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString()}>{Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></li>; })}</ol> : <EmptyState kind="audit" title="No activity recorded yet" body="Your recent workspace audit events will appear here." />}</section></div>
    </div><footer className="eng-footer"><span><Terminal size={12} />ENAKO OS<span>/</span>Engineering workspace</span><span>Build thoughtfully. Operate confidently.</span></footer>
  </div>;
}
