import { useState, useEffect, useCallback } from 'react';
import {
  MailOpen, Plus, Trash2, Pause, Play, RefreshCw, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Wifi, WifiOff,
  Server, X, Eye, EyeOff, Clock, Mail, Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/common';
import { mailboxService, Mailbox, MailboxCreatePayload } from '@/services/mailboxService';
import { formatDate } from '@/utils';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// ─── Status badge ─────────────────────────────────────────────────────────────
const MailboxStatus = ({ mailbox }: { mailbox: Mailbox }) => {
  if (!mailbox.is_active) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-100 text-surface-600"><XCircle size={11} /> Inactive</span>;
  if (mailbox.is_paused) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700"><Pause size={11} /> Paused</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700"><Play size={11} /> Active</span>;
};

// ─── Add Mailbox Modal ────────────────────────────────────────────────────────
const PROVIDERS = [
  { label: 'Gmail', imap: 'imap.gmail.com', smtp: 'smtp.gmail.com', port: 993, smtpPort: 587, ssl: true, tls: true },
  { label: 'Outlook', imap: 'outlook.office365.com', smtp: 'smtp.office365.com', port: 993, smtpPort: 587, ssl: true, tls: true },
  { label: 'Zoho IN', imap: 'imap.zoho.in', smtp: 'smtp.zoho.in', port: 993, smtpPort: 587, ssl: true, tls: true },
  { label: 'Yahoo', imap: 'imap.mail.yahoo.com', smtp: 'smtp.mail.yahoo.com', port: 993, smtpPort: 587, ssl: true, tls: true },
  { label: 'Custom', imap: '', smtp: '', port: 993, smtpPort: 587, ssl: true, tls: true },
];

// ─── Autodiscovery ────────────────────────────────────────────────────────────
interface DiscoveredSettings {
  imap_host: string; imap_port: number; use_ssl: boolean;
  smtp_host: string; smtp_port: number; smtp_use_tls: boolean;
  source: 'ispdb' | 'static' | 'default';
}

// Known domains → static fallback (used when ISPDB is unreachable)
const STATIC_DOMAIN_MAP: Record<string, DiscoveredSettings> = {
  'gmail.com':      { imap_host: 'imap.gmail.com',         imap_port: 993, use_ssl: true,  smtp_host: 'smtp.gmail.com',         smtp_port: 587, smtp_use_tls: true,  source: 'static' },
  'googlemail.com': { imap_host: 'imap.gmail.com',         imap_port: 993, use_ssl: true,  smtp_host: 'smtp.gmail.com',         smtp_port: 587, smtp_use_tls: true,  source: 'static' },
  'outlook.com':    { imap_host: 'outlook.office365.com',  imap_port: 993, use_ssl: true,  smtp_host: 'smtp.office365.com',     smtp_port: 587, smtp_use_tls: true,  source: 'static' },
  'hotmail.com':    { imap_host: 'outlook.office365.com',  imap_port: 993, use_ssl: true,  smtp_host: 'smtp.office365.com',     smtp_port: 587, smtp_use_tls: true,  source: 'static' },
  'live.com':       { imap_host: 'outlook.office365.com',  imap_port: 993, use_ssl: true,  smtp_host: 'smtp.office365.com',     smtp_port: 587, smtp_use_tls: true,  source: 'static' },
  'yahoo.com':      { imap_host: 'imap.mail.yahoo.com',    imap_port: 993, use_ssl: true,  smtp_host: 'smtp.mail.yahoo.com',    smtp_port: 587, smtp_use_tls: true,  source: 'static' },
  'yahoo.co.in':    { imap_host: 'imap.mail.yahoo.com',    imap_port: 993, use_ssl: true,  smtp_host: 'smtp.mail.yahoo.com',    smtp_port: 587, smtp_use_tls: true,  source: 'static' },
  'zoho.com':       { imap_host: 'imap.zoho.com',          imap_port: 993, use_ssl: true,  smtp_host: 'smtp.zoho.com',          smtp_port: 587, smtp_use_tls: true,  source: 'static' },
  'zoho.in':        { imap_host: 'imap.zoho.in',           imap_port: 993, use_ssl: true,  smtp_host: 'smtp.zoho.in',           smtp_port: 587, smtp_use_tls: true,  source: 'static' },
};

const DEFAULT_SETTINGS: Omit<DiscoveredSettings, 'source'> = {
  imap_host: 'imap.gmail.com', imap_port: 993, use_ssl: true,
  smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_use_tls: true,
};

/**
/**
 * Parse a Thunderbird autoconfig XML response.
 * Returns null if the XML is malformed or missing required fields.
 */
function parseAutoconfigXml(xml: string): Omit<DiscoveredSettings, 'source'> | null {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const imap = doc.querySelector('incomingServer[type="imap"]');
    const smtp = doc.querySelector('outgoingServer[type="smtp"]');
    if (!imap || !smtp) return null;
    const imapSocket = (imap.querySelector('socketType')?.textContent ?? '').toUpperCase();
    const smtpSocket = (smtp.querySelector('socketType')?.textContent ?? '').toUpperCase();
    return {
      imap_host: imap.querySelector('hostname')?.textContent ?? '',
      imap_port: parseInt(imap.querySelector('port')?.textContent ?? '993') || 993,
      use_ssl:   imapSocket === 'SSL',
      smtp_host: smtp.querySelector('hostname')?.textContent ?? '',
      smtp_port: parseInt(smtp.querySelector('port')?.textContent ?? '587') || 587,
      smtp_use_tls: smtpSocket === 'STARTTLS',
    };
  } catch { return null; }
}

/**
 * Tries (in order):
 *  1. Mozilla Thunderbird ISPDB  — covers major providers + Google Workspace etc.
 *  2. Domain's own autoconfig endpoint — many orgs/universities self-host this
 *  3. Static provider map         — instant fallback for known domains
 *  4. Safe defaults               — never leaves the form blank
 * Always resolves; never throws.
 */
async function discoverSettings(email: string): Promise<DiscoveredSettings> {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return { ...DEFAULT_SETTINGS, source: 'default' };

  const abort = (ms: number) => {
    const c = new AbortController();
    setTimeout(() => c.abort(), ms);
    return c.signal;
  };

  // ── Tier 1: Mozilla ISPDB (JSON) ──────────────────────────────────────────
  try {
    const res = await fetch(
      `https://autoconfig.thunderbird.net/v1.1/${encodeURIComponent(domain)}`,
      { signal: abort(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      const imap = data?.incomingServers?.find((s: any) => s.type === 'imap');
      const smtp = data?.outgoingServers?.find((s: any) => s.type === 'smtp');
      if (imap?.hostname && smtp?.hostname) {
        return {
          imap_host:    imap.hostname,
          imap_port:    imap.port ?? 993,
          use_ssl:      (imap.socketType ?? '').toUpperCase() === 'SSL',
          smtp_host:    smtp.hostname,
          smtp_port:    smtp.port ?? 587,
          smtp_use_tls: (smtp.socketType ?? '').toUpperCase() === 'STARTTLS',
          source: 'ispdb',
        };
      }
    }
  } catch { /* 404 or network — expected for private domains, fall through */ }

  // ── Tier 2: Domain's own autoconfig endpoint (XML) ────────────────────────
  // Many universities and businesses self-host Thunderbird-compatible autoconfig.
  const autoconfigUrls = [
    `https://autoconfig.${domain}/mail/config-v1.1.xml?emailaddress=${encodeURIComponent(email)}`,
    `https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml`,
  ];
  for (const url of autoconfigUrls) {
    try {
      const res = await fetch(url, { signal: abort(4000) });
      if (res.ok) {
        const xml = await res.text();
        const parsed = parseAutoconfigXml(xml);
        if (parsed?.imap_host && parsed?.smtp_host) {
          return { ...parsed, source: 'ispdb' }; // treat domain autoconfig as authoritative
        }
      }
    } catch { /* CORS / timeout — expected, keep trying */ }
  }

  // ── Tier 3: Static provider map ───────────────────────────────────────────
  if (STATIC_DOMAIN_MAP[domain]) return STATIC_DOMAIN_MAP[domain];

  // ── Tier 4: Safe defaults ─────────────────────────────────────────────────
  return { ...DEFAULT_SETTINGS, source: 'default' };
}

const AddMailboxModal = ({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) => {
  const [provider, setProvider]         = useState(0);
  const [showPw, setShowPw]             = useState(false);
  const [saving, setSaving]             = useState(false);
  const [discovering, setDiscovering]   = useState(false);
  const [discoveryBadge, setDiscoveryBadge] = useState<{ source: DiscoveredSettings['source']; domain: string } | null>(null);
  const [form, setForm] = useState<MailboxCreatePayload>({
    label: '', email_address: '', imap_host: 'imap.gmail.com', imap_port: 993,
    use_ssl: true, password: '', smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_use_tls: true,
  });

  const selectProvider = (idx: number) => {
    const p = PROVIDERS[idx];
    setProvider(idx);
    setForm(f => ({ ...f, imap_host: p.imap, imap_port: p.port, smtp_host: p.smtp || null, smtp_port: p.smtpPort, use_ssl: p.ssl, smtp_use_tls: p.tls }));
  };

  const f = (k: keyof MailboxCreatePayload, v: string | number | boolean | null) => setForm(prev => ({ ...prev, [k]: v }));

  const handleEmailBlur = async (email: string) => {
    if (!email || !email.includes('@')) return;
    setDiscovering(true);
    setDiscoveryBadge(null);
    try {
      const settings = await discoverSettings(email);
      setForm(prev => ({
        ...prev,
        imap_host:    settings.imap_host,
        imap_port:    settings.imap_port,
        use_ssl:      settings.use_ssl,
        smtp_host:    settings.smtp_host,
        smtp_port:    settings.smtp_port,
        smtp_use_tls: settings.smtp_use_tls,
      }));
      const providerIdx = PROVIDERS.findIndex(p => p.imap === settings.imap_host);
      setProvider(providerIdx >= 0 ? providerIdx : 4);
      setDiscoveryBadge({ source: settings.source, domain: email.split('@')[1] ?? '' });
    } finally {
      setDiscovering(false);
    }
  };

  const handleSave = async () => {
    if (!form.label || !form.email_address || !form.imap_host || !form.password) { toast.error('Fill in all required fields'); return; }
    try {
      setSaving(true);
      await mailboxService.create(form);
      toast.success('Mailbox added successfully');
      onAdded(); onClose();
    } catch { toast.error('Failed to add mailbox'); } finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-modal w-full max-w-xl animate-scale-in flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-surface-100">
            <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center"><MailOpen size={15} className="text-brand-600" /></div><h2 className="font-display font-bold text-surface-900">Add Mailbox</h2></div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-100 text-gray-400 hover:text-surface-700 transition-colors"><X size={18} /></button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {/* Provider picker */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Email Provider</label>
              <div className="grid grid-cols-5 gap-2">
                {PROVIDERS.map((p, i) => (
                  <button key={p.label} onClick={() => selectProvider(i)} className={clsx('py-2 px-1 rounded-xl text-xs font-semibold border transition-all', i === provider ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-surface-200 text-gray-600 hover:border-surface-300 hover:bg-surface-50')}>{p.label}</button>
                ))}
              </div>
            </div>

            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Label <span className="text-brand-400">*</span></label>
                <input className="input-base text-sm py-2" placeholder="e.g. AR Mailbox – Mumbai" value={form.label} onChange={e => f('label', e.target.value)} />
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Email Address <span className="text-brand-400">*</span></label>
                  {/* Discovery badge */}
                  {discovering && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600 animate-pulse">
                      <Loader2 size={10} className="animate-spin" /> Detecting settings…
                    </span>
                  )}
                  {!discovering && discoveryBadge && (
                    <span className={clsx(
                      'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      discoveryBadge.source === 'ispdb'   ? 'bg-green-100 text-green-700'  :
                      discoveryBadge.source === 'static'  ? 'bg-brand-100 text-brand-700'  :
                      'bg-surface-100 text-surface-600'
                    )}>
                      <Zap size={9} />
                      {discoveryBadge.source === 'ispdb'  ? `Auto-configured (${discoveryBadge.domain})` :
                       discoveryBadge.source === 'static' ? 'Known provider' : 'Default settings'}
                    </span>
                  )}
                </div>
                <input
                  className="input-base text-sm py-2"
                  type="email"
                  placeholder="ar@yourcompany.com"
                  value={form.email_address}
                  onChange={e => f('email_address', e.target.value)}
                  onBlur={e => handleEmailBlur(e.target.value.trim())}
                />
              </div>
              <div className="col-span-2 relative">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Password / App Password <span className="text-brand-400">*</span></label>
                <input className="input-base text-sm py-2 pr-10" type={showPw ? 'text' : 'password'} placeholder="App password recommended" value={form.password} onChange={e => f('password', e.target.value)} />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600">{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
            </div>

            {/* IMAP */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Server size={11} /> IMAP Settings</p>
              <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Host</label>
                  <input className="input-base text-sm py-2" placeholder="imap.example.com" value={form.imap_host} onChange={e => f('imap_host', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Port</label>
                  <input className="input-base text-sm py-2" type="number" value={form.imap_port} onChange={e => f('imap_port', parseInt(e.target.value))} />
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <input type="checkbox" id="use_ssl" checked={form.use_ssl} onChange={e => f('use_ssl', e.target.checked)} className="w-4 h-4 accent-brand-500 accent-brand-500" />
                  <label htmlFor="use_ssl" className="text-sm text-surface-700 font-medium">Use SSL/TLS</label>
                </div>
              </div>
            </div>

            {/* SMTP */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Mail size={11} /> SMTP Settings</p>
              <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Host <span className="text-gray-400 normal-case font-normal">(auto-derived if blank)</span></label>
                  <input className="input-base text-sm py-2" placeholder="smtp.example.com" value={form.smtp_host ?? ''} onChange={e => f('smtp_host', e.target.value || null)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Port</label>
                  <input className="input-base text-sm py-2" type="number" value={form.smtp_port} onChange={e => f('smtp_port', parseInt(e.target.value))} />
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <input type="checkbox" id="smtp_tls" checked={form.smtp_use_tls} onChange={e => f('smtp_use_tls', e.target.checked)} className="w-4 h-4 accent-brand-500 accent-brand-500" />
                  <label htmlFor="smtp_tls" className="text-sm text-surface-700 font-medium">Use STARTTLS</label>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
              💡 For Gmail, create an <strong className="text-brand-700">App Password</strong> at myaccount.google.com → Security → 2FA → App passwords. Never use your regular Google password.
            </p>
          </div>

          <div className="px-6 pb-5 pt-4 border-t border-surface-100 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 bg-brand-500 hover:bg-brand-600 active:bg-brand-700">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Add Mailbox'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Mailbox Card ─────────────────────────────────────────────────────────────
const MailboxCard = ({ mailbox, onRefresh }: { mailbox: Mailbox; onRefresh: () => void }) => {
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testResult, setTestResult] = useState<{ imap_ok: boolean; smtp_ok: boolean; message: string } | null>(null);

  const handleTest = async () => {
    try {
      setTesting(true); setTestResult(null);
      const result = await mailboxService.test(mailbox.mailbox_id);
      setTestResult(result);
      if (result.imap_ok && result.smtp_ok) toast.success('Connection successful');
      else toast.error('Connection test failed');
    } catch { toast.error('Test failed'); } finally { setTesting(false); }
  };

  const handleTogglePause = async () => {
    try {
      setToggling(true);
      if (mailbox.is_paused) { await mailboxService.unpause(mailbox.mailbox_id); toast.success('Mailbox resumed'); }
      else { await mailboxService.pause(mailbox.mailbox_id); toast.success('Mailbox paused'); }
      onRefresh();
    } catch { toast.error('Failed to update mailbox'); } finally { setToggling(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete mailbox "${mailbox.label}"? This cannot be undone.`)) return;
    try {
      setDeleting(true);
      await mailboxService.delete(mailbox.mailbox_id);
      toast.success('Mailbox deleted');
      onRefresh();
    } catch { toast.error('Failed to delete mailbox'); } finally { setDeleting(false); }
  };

  return (
    <div className={clsx('card p-0 overflow-hidden transition-all', mailbox.is_paused && 'opacity-80')}>
      {/* Top accent */}
      <div className={clsx('h-1', !mailbox.is_active ? 'bg-surface-200' : mailbox.is_paused ? 'bg-amber-400' : 'bg-green-500')} />

      <div className="p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', !mailbox.is_active ? 'bg-surface-50' : mailbox.is_paused ? 'bg-amber-50' : 'bg-green-50')}>
            <MailOpen size={18} className={!mailbox.is_active ? 'text-surface-400' : mailbox.is_paused ? 'text-amber-600' : 'text-green-600'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h3 className="font-display font-bold text-surface-900 text-sm">{mailbox.label}</h3>
              <MailboxStatus mailbox={mailbox} />
            </div>
            <p className="text-sm text-gray-500 truncate">{mailbox.email_address}</p>
          </div>
        </div>

        {/* Server info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-surface-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">IMAP</p>
            <p className="text-xs text-surface-700 font-medium truncate">{mailbox.imap_host}</p>
            <p className="text-[10px] text-gray-400">Port {mailbox.imap_port} · {mailbox.use_ssl ? 'SSL' : 'Plain'}</p>
          </div>
          <div className="bg-surface-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">SMTP</p>
            <p className="text-xs text-surface-700 font-medium truncate">{mailbox.smtp_host ?? 'Auto'}</p>
            <p className="text-[10px] text-gray-400">Port {mailbox.smtp_port} · {mailbox.smtp_use_tls ? 'STARTTLS' : 'Plain'}</p>
          </div>
        </div>

        {/* Last polled */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
          <Clock size={11} />
          {mailbox.last_polled_at ? `Last polled ${formatDate(mailbox.last_polled_at)}` : 'Never polled'}
          {mailbox.last_uid_seen != null && <span className="ml-auto text-[10px] bg-surface-100 text-surface-600 px-2 py-0.5 rounded-full font-mono">UID {mailbox.last_uid_seen}</span>}
        </div>

        {/* Test result */}
        {testResult && (
          <div className="mb-4 rounded-xl border overflow-hidden text-xs">
            <div className={clsx('px-3 py-2 font-semibold', testResult.imap_ok && testResult.smtp_ok ? 'bg-brand-50 text-brand-700 border-brand-100' : 'bg-surface-50 text-surface-700 border-surface-100')}>
              {testResult.message}
            </div>
            <div className="flex divide-x border-t border-surface-100">
              <div className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2', testResult.imap_ok ? 'text-brand-600' : 'text-surface-600')}>
                {testResult.imap_ok ? <Wifi size={12} /> : <WifiOff size={12} />} IMAP {testResult.imap_ok ? 'OK' : 'FAIL'}
              </div>
              <div className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2', testResult.smtp_ok ? 'text-brand-700' : 'text-brand-500')}>
                {testResult.smtp_ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />} SMTP {testResult.smtp_ok ? 'OK' : 'FAIL'}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={handleTest} disabled={testing} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-surface-200 hover:border-surface-300 hover:bg-surface-50 px-3 py-2 rounded-xl transition-all disabled:opacity-50">
            {testing ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />} Test
          </button>
          <button onClick={handleTogglePause} disabled={toggling || !mailbox.is_active} className={clsx('flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all disabled:opacity-50', mailbox.is_paused ? 'border-brand-200 text-brand-700 hover:bg-brand-50' : 'border-brand-200 text-brand-700 hover:bg-brand-50')}>
            {toggling ? <Loader2 size={12} className="animate-spin" /> : mailbox.is_paused ? <Play size={12} /> : <Pause size={12} />}
            {mailbox.is_paused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={handleDelete} disabled={deleting} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-brand-500 hover:text-brand-800 border border-brand-100 hover:border-brand-300 hover:bg-brand-50 px-3 py-2 rounded-xl transition-all disabled:opacity-50">
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const MailboxesPage = () => {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setMailboxes(await mailboxService.list()); }
    catch { toast.error('Failed to load mailboxes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = mailboxes.filter(m => m.is_active && !m.is_paused).length;
  const paused = mailboxes.filter(m => m.is_paused).length;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <PageHeader
        title="Mailboxes"
        subtitle="Manage IMAP/SMTP mailboxes for inbound email polling and outbound replies."
        action={
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-xl hover:bg-surface-100 text-gray-500 transition-colors" title="Refresh"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm">
              <Plus size={15} /> Add Mailbox
            </button>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total', value: mailboxes.length, color: 'bg-brand-500', icon: MailOpen },
          { label: 'Active', value: active, color: 'bg-green-500', icon: CheckCircle2 },
          { label: 'Paused', value: paused, color: 'bg-amber-400', icon: Pause },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="card p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0 shadow-sm`}><Icon size={18} className="text-white" /></div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</p>
              <p className="font-display text-3xl font-bold text-surface-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={22} className="animate-spin text-brand-500" />
          <span className="text-sm text-gray-500">Loading mailboxes…</span>
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="card p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mb-4"><MailOpen size={28} className="text-brand-500" /></div>
          <h3 className="font-display font-bold text-surface-900 mb-1">No mailboxes configured</h3>
          <p className="text-sm text-gray-500 max-w-xs mb-5">Add a mailbox to start polling for customer emails and enable outbound replies from disputes.</p>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all"><Plus size={15} /> Add Your First Mailbox</button>
        </div>
      ) : (
        <>
          {paused > 0 && (
            <div className="mb-4 flex items-center gap-3 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-brand-500 shrink-0" />
              <p className="text-sm text-brand-800"><strong>{paused} mailbox{paused !== 1 ? 'es are' : ' is'} paused</strong> — email polling is suspended for those.</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {mailboxes.map(m => <MailboxCard key={m.mailbox_id} mailbox={m} onRefresh={load} />)}
          </div>
        </>
      )}

      {showAdd && <AddMailboxModal onClose={() => setShowAdd(false)} onAdded={load} />}
    </div>
  );
};

export default MailboxesPage;
