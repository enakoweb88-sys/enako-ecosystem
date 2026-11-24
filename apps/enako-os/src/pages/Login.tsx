import React, { useState } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Mail, LockKeyhole, Eye, EyeOff, ShieldCheck, AlertCircle, Users, Layers3, ChartNoAxesCombined, BriefcaseBusiness, LoaderCircle, CircleHelp, Code2 } from 'lucide-react';
import './Login.css';
import { useAuth } from '../lib/auth';

type Role = 'CEO' | 'CTO' | 'MANAGER' | 'EMPLOYEE' | 'OUTREACH_MANAGER';

const ROLE_LABELS: Record<Role, string> = {
  CEO: 'Chief Executive Officer',
  CTO: 'Chief Technology Officer',
  MANAGER: 'Department Manager',
  EMPLOYEE: 'Staff Member',
  OUTREACH_MANAGER: 'Outreach Manager'
};

const ROLE_OPTIONS: { role: Role; label: string; short: string }[] = [
  { role: 'EMPLOYEE', label: 'Staff Member', short: 'Staff' },
  { role: 'MANAGER', label: 'Department Manager', short: 'Manager' },
  { role: 'OUTREACH_MANAGER', label: 'Outreach Manager', short: 'Outreach' },
  { role: 'CTO', label: 'Chief Technology Officer', short: 'CTO' },
  { role: 'CEO', label: 'Chief Executive Officer', short: 'CEO' },
];

const isLocalDevelopment = import.meta.env.DEV && typeof window !== 'undefined'
  && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

function isValidRole(r: string | null): r is Role {
  return r === 'CEO' || r === 'CTO' || r === 'MANAGER' || r === 'EMPLOYEE' || r === 'OUTREACH_MANAGER';
}

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryRole = searchParams.get('role')?.toUpperCase();
  const sessionRole = sessionStorage.getItem('enako_selected_role')?.toUpperCase();
  const localRole = localStorage.getItem('enako_last_role')?.toUpperCase();

  // Pick previous active role: query > session > local storage > fallback to EMPLOYEE
  const initialRole = [queryRole, sessionRole, localRole].find(isValidRole);
  const [selectedRole, setSelectedRole] = useState<Role>(initialRole || 'EMPLOYEE');

  const [email, setEmail] = useState(() => localStorage.getItem('enako_last_email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAccessHelp, setShowAccessHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const handleRoleChange = (role: Role) => {
    if (loading) return;
    setError(null);
    setSelectedRole(role);
    sessionStorage.setItem('enako_selected_role', role);
    localStorage.setItem('enako_last_role', role);
    setSearchParams({ role });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      localStorage.setItem('enako_last_role', selectedRole);
      localStorage.setItem('enako_last_email', email.trim());
      await login(email.trim(), password, selectedRole);
      const destination = location.state?.from;
      const next = destination?.pathname?.startsWith('/app/')
        ? `${destination.pathname}${destination.search || ''}${destination.hash || ''}`
        : '/app/dashboard';
      navigate(next, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.';
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
        setError('Cannot reach the server. Check your connection or try again later.');
      } else if (isLocalDevelopment && msg.toLowerCase().includes('invalid credentials')) {
        setError('These credentials were not recognised by the local test database. Use the local development account and its saved password.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="os-login">
      <section className="os-login-story" aria-label="About your ENAKO workspace">
        <Link to="/" className="os-login-brand" aria-label="ENAKO OS home">ENAKO<span>OS</span></Link>

        <div className="os-login-story-copy">
          <p className="os-login-eyebrow"><span /> THE BUSINESS OPERATING SYSTEM</p>
          <h1>Great work starts<br />with a connected<br /><em>workspace.</em></h1>
          <p>Your people, operations and decisions.<br />Together in one place, working as one.</p>
        </div>

        <div className="os-login-blueprint" aria-hidden="true">
          <div className="os-login-blueprint-grid" />
          <svg className="os-login-connections" viewBox="0 0 480 280" fill="none" preserveAspectRatio="none"><path d="M108 80H180Q200 80 200 100V125H240M372 80H300Q280 80 280 100V125H240M108 220H180Q200 220 200 200V155H240M372 220H300Q280 220 280 200V155H240" stroke="currentColor" strokeWidth="1" /><circle cx="240" cy="140" r="91" stroke="currentColor" strokeDasharray="3 7" /></svg>
          <div className="os-login-node os-login-node-people"><Users size={17} /><span>People & teams</span></div>
          <div className="os-login-node os-login-node-finance"><BriefcaseBusiness size={17} /><span>Finance & operations</span></div>
          <div className="os-login-core"><Layers3 size={29} /><span>ENAKO OS</span></div>
          <div className="os-login-node os-login-node-projects"><Layers3 size={17} /><span>Tasks & projects</span></div>
          <div className="os-login-node os-login-node-reports"><ChartNoAxesCombined size={17} /><span>Reports & insights</span></div>
          <div className="os-login-blueprint-caption">ONE WORKSPACE. EVERY PART OF YOUR BUSINESS.</div>
        </div>

        <div className="os-login-story-footer"><span>Built for your team. Designed for focus.</span><span>ENAKO CLOUD SYSTEM</span></div>
      </section>

      <section className="os-login-entry" aria-labelledby="os-login-title">
        <header className="os-login-entry-header"><Link to="/" className="os-login-home"><ArrowLeft size={15} />Back to home</Link><span className="os-login-entry-label">WORKSPACE ACCESS</span><Link to="/" className="os-login-mobile-brand">ENAKO<span>OS</span></Link></header>

        <div className="os-login-form-wrap">
          <div className="os-login-welcome"><div className="os-login-welcome-icon"><LockKeyhole size={22} strokeWidth={1.7} /></div><p className="os-login-eyebrow">YOUR WORKSPACE AWAITS</p><h2 id="os-login-title">Welcome back.</h2><p>Sign in to pick up where you left off.</p></div>

          <form onSubmit={handleLogin} aria-busy={loading} className="os-login-form">
            <fieldset className="os-login-workspaces" disabled={loading}><legend>Choose your workspace</legend><div className="os-login-role-grid">{ROLE_OPTIONS.map(option => <label className="os-login-role" key={option.role}><input type="radio" name="workspace" value={option.role} checked={selectedRole === option.role} onChange={() => handleRoleChange(option.role)} /><span>{option.short}<span className="os-login-radio-dot" /></span></label>)}</div><div className="os-login-role-caption"><span className="os-login-caption-dot" />{ROLE_LABELS[selectedRole]} workspace<Link to="/select-role" aria-label="View all workspace portals">All portals<ArrowRight size={12} /></Link></div></fieldset>

            {error && <div className="os-login-error" id="os-login-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><p>{error}</p></div>}

            <div className="os-login-field"><label htmlFor="email">Work email</label><div className="os-login-input-wrap"><Mail size={18} aria-hidden="true" /><input type="email" id="email" name="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="username" spellCheck={false} autoCapitalize="none" required disabled={loading} aria-describedby={error ? 'os-login-error' : undefined} /></div></div>

            <div className="os-login-field"><div className="os-login-field-heading"><label htmlFor="password">Password</label><button className="os-login-help-toggle" type="button" onClick={() => setShowAccessHelp(value => !value)} aria-expanded={showAccessHelp} aria-controls="os-login-access-help">Forgot password?</button></div><div className="os-login-input-wrap"><LockKeyhole size={18} aria-hidden="true" /><input type={showPassword ? 'text' : 'password'} id="password" name="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required disabled={loading} aria-describedby={error ? 'os-login-error' : undefined} /><button type="button" className="os-login-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={loading}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>

            {showAccessHelp && <div className="os-login-access-help" id="os-login-access-help"><CircleHelp size={18} aria-hidden="true" /><p>Contact your workspace administrator to reset your password or request access. They can help you find the right workspace for your account.</p></div>}

            <button className="os-login-submit" type="submit" disabled={loading}>{loading ? <><LoaderCircle size={18} className="os-login-spinner" />Signing you in…</> : <>Sign in to workspace<ArrowRight size={18} /></>}</button>
            <p className="os-login-access-note"><ShieldCheck size={15} aria-hidden="true" />Access is limited to your assigned role.</p>
          </form>

          {isLocalDevelopment && <aside className="os-login-local" aria-label="Local development login"><Code2 size={17} /><div><strong>Local development · Cloudflare bypassed</strong><p>This site uses a separate test database. Use developer@enako.local in the Staff workspace, with the password saved in apps/backend/.local-dev/login.txt.</p><button type="button" disabled={loading} onClick={() => { handleRoleChange('EMPLOYEE'); setEmail('developer@enako.local'); setPassword(''); }}>Use local test account</button></div></aside>}
          <div className="os-login-support"><span>New to this workspace?</span><button type="button" onClick={() => setShowAccessHelp(value => !value)} aria-expanded={showAccessHelp} aria-controls="os-login-access-help">Get access help<ArrowRight size={13} /></button></div>
        </div>

        <footer className="os-login-entry-footer"><span>© {new Date().getFullYear()} ENAKO</span><span>One organization. One workspace.</span></footer>
      </section>
    </main>
  );
}

