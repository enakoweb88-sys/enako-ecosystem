import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Copy, Eye, EyeOff, KeyRound, LockKeyhole, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, apiRequest } from '../lib/api/core';

type Platform = { id: string; name: string };
type Row = { key: string; value: string };
const button = 'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';
const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100';

export default function PasswordsAndKeys() {
  const [token, setToken] = useState('');
  const tokenRef = useRef('');
  const generation = useRef(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configReady, setConfigReady] = useState(false);
  const [error, setError] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [rows, setRows] = useState<Row[]>([]);
  const [version, setVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  function clearVault() {
    generation.current++;
    tokenRef.current = '';
    setToken(''); setExpiresAt(0); setPlatforms([]); setPlatform(null); setRows([]);
    setRevealed({}); setDirty(false); setName(''); setSearch(''); setCode(''); setCodeSent(false); setLoading(false); setConfigReady(false);
  }
  function lock() {
    clearVault();
    void apiRequest('/vault/lock', { method: 'POST' }).catch(() => {});
  }
  useEffect(() => {
    const tick = window.setInterval(() => {
      setCooldown(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
      setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
      if (tokenRef.current && expiresAt && Date.now() >= expiresAt) lock();
    }, 1000);
    const onVisible = () => { if (tokenRef.current && Date.now() >= expiresAt) lock(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(tick); document.removeEventListener('visibilitychange', onVisible); };
  }, [expiresAt, retryAt]);
  useEffect(() => () => {
    generation.current++;
    if (tokenRef.current) { tokenRef.current = ''; void apiRequest('/vault/lock', { method: 'POST' }).catch(() => {}); }
  }, []);

  async function request<T>(path: string, options: RequestInit = {}, access = tokenRef.current) {
    try { return await apiRequest<T>('/vault' + path, { ...options, headers: { 'X-Vault-Token': access } }); }
    catch (e) { if (e instanceof ApiError && e.status === 403 && access) clearVault(); throw e; }
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to complete this request'); }
    finally { setBusy(false); }
  }
  async function sendCode() {
    await action(async () => {
      await request('/request-code', { method: 'POST' });
      setCodeSent(true); setCode(''); setRetryAt(Date.now() + 60000); setCooldown(60);
    });
  }
  async function unlock() {
    await action(async () => {
      const started = generation.current;
      const access = await request<{ token: string; expiresAt: string }>('/verify', { method: 'POST', body: JSON.stringify({ code }) });
      if (started !== generation.current) return;
      tokenRef.current = access.token; setToken(access.token); setExpiresAt(Date.parse(access.expiresAt)); setRemaining(600); setCode('');
      const current = generation.current;
      const items = await request<Platform[]>('/platforms');
      if (current === generation.current && tokenRef.current) setPlatforms(items);
    });
  }
  async function open(next: Platform, env = environment) {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    const current = ++generation.current;
    setPlatform(next); setEnvironment(env); setRows([]); setRevealed({}); setDirty(false); setLoading(true); setConfigReady(false); setError('');
    try {
      const config = await request<{ rows: Row[]; version: number }>(`/platforms/${next.id}/config?environment=${env}`);
      if (generation.current === current && tokenRef.current) { setRows(config.rows); setVersion(config.version); setConfigReady(true); }
    } catch (e) { if (generation.current === current) setError(e instanceof Error ? e.message : 'Could not load credentials'); }
    finally { if (generation.current === current) setLoading(false); }
  }
  const update = (index: number, field: keyof Row, value: string) => { setRows(old => old.map((row, i) => i === index ? { ...row, [field]: value } : row)); setDirty(true); };

  return <div className="mx-auto max-w-6xl space-y-6 pb-16">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Developer dashboard</p><h1 className="text-2xl font-bold text-slate-900">Passwords and Keys</h1><p className="mt-2 text-sm text-slate-500">Keep platform accounts, passwords, API keys, and configuration together.</p></div>
      {token && <button className={button} onClick={lock}><LockKeyhole size={16} />Lock vault</button>}
    </header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {!token ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 p-6"><span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"><LockKeyhole size={14} />Vault locked</span></div>
      <div className="mx-auto max-w-lg space-y-5 px-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><ShieldCheck size={30} /></div>
        <h2 className="text-xl font-semibold text-slate-900">Authenticate before continuing</h2>
        <p className="text-sm leading-6 text-slate-500">Platform names and credentials remain private until you enter the single-use code sent to the owner's email. Codes expire after five minutes; access locks after ten minutes.</p>
        {codeSent && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void unlock(); }}>
          <p role="status" className="text-sm text-emerald-700">Code sent to the vault owner.</p>
          <label htmlFor="vault-code" className="block text-sm font-medium text-slate-700">Six-digit authentication code</label>
          <input id="vault-code" className={input + ' text-center font-mono text-xl tracking-[0.4em]'} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} />
          <button className={button + ' w-full'} disabled={busy || code.length !== 6}>Verify and unlock</button>
        </form>}
        <button className={codeSent ? 'text-sm font-semibold text-slate-600 disabled:opacity-50' : button} disabled={busy || cooldown > 0} onClick={() => void sendCode()}>{busy ? 'Please wait…' : cooldown > 0 ? `Resend available in ${cooldown}s` : codeSent ? 'Resend code' : 'Authenticate to unlock'}</button>
        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-5 text-xs text-slate-500"><span>Encrypted storage</span><span>Email verification</span><span>Automatic locking</span></div>
      </div>
    </section> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><span className="flex items-center gap-2"><ShieldCheck size={17} />Vault unlocked · Values are masked by default</span><span>Locks in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span></div>
      {!platform ? <>
        <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">Your platforms</h2><button className="text-sm font-semibold text-slate-500 disabled:opacity-50" disabled={busy} onClick={() => void action(async () => { const current = generation.current; const items = await request<Platform[]>('/platforms'); if (current === generation.current && tokenRef.current) setPlatforms(items); })}>Refresh platforms</button></div><p className="mt-1 text-sm text-slate-500">Create a platform before adding its credentials. Use a separate platform for each account if needed.</p>
          <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={e => { e.preventDefault(); void action(async () => {
            const current = generation.current;
            const created = await request<Platform>('/platforms', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
            if (generation.current !== current || !tokenRef.current) return;
            setPlatforms(old => [...old, created].sort((a, b) => a.name.localeCompare(b.name))); setName(''); void open(created);
          }); }}><input aria-label="New platform name" placeholder="Platform name, e.g. Render or GitHub" className={input} maxLength={100} value={name} onChange={e => setName(e.target.value)} required /><button className={button + ' shrink-0'} disabled={busy || !name.trim()}><Plus size={16} />Add platform</button></form>
        </section>
        <input aria-label="Search platforms" placeholder="Search platforms…" className={input} value={search} onChange={e => setSearch(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{platforms.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => <button key={p.id} onClick={() => void open(p)} className="rounded-xl border border-slate-200 bg-white p-6 text-left transition hover:border-slate-400 hover:shadow-sm"><KeyRound className="mb-5 text-slate-500" size={24} /><h3 className="font-semibold text-slate-900">{p.name}</h3><p className="mt-2 text-sm text-slate-500">View credentials and configuration →</p></button>)}</div>
        {!platforms.length && <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">No platforms yet. Add your first platform above to start saving credentials.</p>}
        {!!platforms.length && !platforms.some(p => p.name.toLowerCase().includes(search.toLowerCase())) && <p className="text-sm text-slate-500">No matching platforms.</p>}
      </> : <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="space-y-5 border-b border-slate-200 p-5"><button disabled={busy} className="flex items-center gap-2 text-sm font-medium text-slate-500" onClick={() => { if (dirty && !window.confirm('Discard your unsaved changes?')) return; generation.current++; setPlatform(null); setRows([]); setDirty(false); setRevealed({}); setError(''); }}><ArrowLeft size={16} />All platforms</button>
          <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-900">{platform.name}</h2><p className="mt-1 text-sm text-slate-500">Passwords, account details, and environment variables</p></div><select aria-label="Environment" className={input + ' sm:!w-44'} value={environment} disabled={busy} onChange={e => void open(platform, e.target.value)}><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></div>
        </div>
        {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500">Loading credentials…</p> : <>
          {!configReady && <div className="p-6 text-center"><button className={button} disabled={busy} onClick={() => void open(platform)}>Retry loading credentials</button></div>}
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="w-1/3 px-5 py-3">Key</th><th className="px-5 py-3">Value</th><th className="w-36 px-5 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t border-slate-100"><td className="p-3"><input aria-label={`Key ${i + 1}`} className={input + ' font-mono'} value={row.key} disabled={busy} maxLength={128} placeholder="API_KEY" onChange={e => update(i, 'key', e.target.value)} autoComplete="off" spellCheck={false} /></td><td className="p-3"><input aria-label={`Value ${i + 1}`} className={input + ' font-mono'} value={row.value} disabled={busy} type={revealed[i] ? 'text' : 'password'} maxLength={16384} placeholder="Enter value" onChange={e => update(i, 'value', e.target.value)} autoComplete="new-password" spellCheck={false} data-private="true" data-sentry-mask="true" /></td><td className="px-3"><div className="flex items-center gap-1">
            <button className="rounded p-2 text-slate-500 hover:bg-slate-100" aria-label={revealed[i] ? `Hide value ${i + 1}` : `Reveal value ${i + 1}`} onClick={() => setRevealed(old => ({ ...old, [i]: !old[i] }))}>{revealed[i] ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            <button className="rounded p-2 text-slate-500 hover:bg-slate-100" aria-label={`Copy value ${i + 1}`} onClick={() => { if (!navigator.clipboard) { toast.error('Clipboard access is unavailable'); return; } void navigator.clipboard.writeText(row.value).then(() => toast.success('Value copied')).catch(() => toast.error('Clipboard access is unavailable')); }}><Copy size={17} /></button>
            <button className="rounded p-2 text-red-500 hover:bg-red-50" disabled={busy} aria-label={`Delete row ${i + 1}`} onClick={() => { setRows(old => old.filter((_, n) => n !== i)); setRevealed({}); setDirty(true); }}><Trash2 size={17} /></button>
          </div></td></tr>)}</tbody></table></div>
          {!rows.length && <p className="p-8 text-center text-sm text-slate-500">No entries for this environment. Add a row to enter your first key and value.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-5"><button className="flex items-center gap-2 text-sm font-semibold text-slate-700" disabled={busy || rows.length >= 100 || !configReady} onClick={() => { setRows(old => [...old, { key: '', value: '' }]); setDirty(true); }}><Plus size={16} />Add row</button><div className="flex items-center gap-3"><span role="status" className="text-xs text-slate-500">{dirty ? 'Unsaved changes' : 'Up to date'}</span><button className={button} disabled={busy || !dirty || !configReady} onClick={() => void action(async () => {
            if (rows.some(row => !/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(row.key))) throw new Error('Keys must start with a letter or underscore and contain only letters, numbers, underscores, dots, or hyphens.');
            if (new Set(rows.map(row => row.key)).size !== rows.length) throw new Error('Each key must be unique.');
            const current = generation.current;
            const result = await request<{ version: number }>(`/platforms/${platform.id}/config`, { method: 'PUT', body: JSON.stringify({ environment, rows, version }) });
            if (current === generation.current && tokenRef.current) { setVersion(result.version); setDirty(false); toast.success('Credentials saved'); }
          })}>{busy ? 'Saving…' : 'Save changes'}</button></div></div>
        </>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4"><p className="text-xs text-slate-500">Deleting a row takes effect when you save changes.</p><button className="text-xs font-semibold text-red-600 disabled:opacity-50" disabled={busy || loading} onClick={() => { if (!window.confirm(`Permanently delete ${platform.name} and all its credentials in every environment?`)) return; void action(async () => { const current = generation.current; await request(`/platforms/${platform.id}`, { method: 'DELETE' }); if (generation.current === current && tokenRef.current) { setPlatforms(old => old.filter(p => p.id !== platform.id)); setPlatform(null); setRows([]); setDirty(false); } }); }}>Delete platform</button></div>
      </section>}
    </>}
  </div>;
}
