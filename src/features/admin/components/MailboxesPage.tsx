import { useState, useEffect, useCallback } from 'react';
import {
  MailOpen, Plus, Trash2, Pause, Play, RefreshCw, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Wifi, WifiOff,
  Server, X, Eye, EyeOff, Clock, Mail,
} from 'lucide-react';
import { PageHeader } from '@/components/common';
import { mailboxService, Mailbox, MailboxCreatePayload } from '@/services/mailboxService';
import { formatDate } from '@/utils';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// ─── Status badge ─────────────────────────────────────────────────────────────
const MailboxStatus = ({ mailbox }: { mailbox: Mailbox }) => {
  if (!mailbox.is_active) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-100 text-surface-600"><XCircle size={11} /> Inactive</span>;
  if (mailbox.is_paused)  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><Pause size={11} /> Paused</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"><Play size={11} /> Active</span>;
};

// ─── Add Mailbox Modal ────────────────────────────────────────────────────────
const PROVIDERS = [
  { label: 'Gmail',   imap: 'imap.gmail.com',            smtp: 'smtp.gmail.com',            port: 993, smtpPort: 587, ssl: true,  tls: true  },
  { label: 'Outlook', imap: 'outlook.office365.com',     smtp: 'smtp.office365.com',        port: 993, smtpPort: 587, ssl: true,  tls: true  },
  { label: 'Zoho IN', imap: 'imap.zoho.in',              smtp: 'smtp.zoho.in',              port: 993, smtpPort: 587, ssl: true,  tls: true  },
  { label: 'Yahoo',   imap: 'imap.mail.yahoo.com',       smtp: 'smtp.mail.yahoo.com',       port: 993, smtpPort: 587, ssl: true,  tls: true  },
  { label: 'Custom',  imap: '',                           smtp: '',                          port: 993, smtpPort: 587, ssl: true,  tls: true  },
];

const AddMailboxModal = ({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) => {
  const [provider, setProvider] = useState(0);
  const [showPw, setShowPw]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState<MailboxCreatePayload>({
    label: '', email_address: '', imap_host: 'imap.gmail.com', imap_port: 993,
    use_ssl: true, password: '', smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_use_tls: true,
  });

  const selectProvider = (idx: number) => {
    const p = PROVIDERS[idx];
    setProvider(idx);
    setForm(f => ({ ...f, imap_host: p.imap, imap_port: p.port, smtp_host: p.smtp || null, smtp_port: p.smtpPort, use_ssl: p.ssl, smtp_use_tls: p.tls }));
  };

  const f = (k: keyof MailboxCreatePayload, v: string | number | boolean | null) => setForm(prev => ({ ...prev, [k]: v }));

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
            <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center"><MailOpen size={15} className="text-amber-600" /></div><h2 className="font-display font-bold text-surface-900">Add Mailbox</h2></div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-100 text-gray-400 hover:text-surface-700 transition-colors"><X size={18} /></button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {/* Provider picker */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Email Provider</label>
              <div className="grid grid-cols-5 gap-2">
                {PROVIDERS.map((p, i) => (
                  <button key={p.label} onClick={() => selectProvider(i)} className={clsx('py-2 px-1 rounded-xl text-xs font-semibold border transition-all', i === provider ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-surface-200 text-gray-600 hover:border-surface-300 hover:bg-surface-50')}>{p.label}</button>
                ))}
              </div>
            </div>

            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Label <span className="text-red-400">*</span></label>
                <input className="input-base text-sm py-2" placeholder="e.g. AR Mailbox – Mumbai" value={form.label} onChange={e => f('label', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Email Address <span className="text-red-400">*</span></label>
                <input className="input-base text-sm py-2" type="email" placeholder="ar@yourcompany.com" value={form.email_address} onChange={e => f('email_address', e.target.value)} />
              </div>
              <div className="col-span-2 relative">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Password / App Password <span className="text-red-400">*</span></label>
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
                  <input type="checkbox" id="use_ssl" checked={form.use_ssl} onChange={e => f('use_ssl', e.target.checked)} className="w-4 h-4 accent-amber-500" />
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
                  <input type="checkbox" id="smtp_tls" checked={form.smtp_use_tls} onChange={e => f('smtp_use_tls', e.target.checked)} className="w-4 h-4 accent-amber-500" />
                  <label htmlFor="smtp_tls" className="text-sm text-surface-700 font-medium">Use STARTTLS</label>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              💡 For Gmail, create an <strong className="text-amber-700">App Password</strong> at myaccount.google.com → Security → 2FA → App passwords. Never use your regular Google password.
            </p>
          </div>

          <div className="px-6 pb-5 pt-4 border-t border-surface-100 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 bg-amber-500 hover:bg-amber-600 active:bg-amber-700">
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
  const [testing, setTesting]   = useState(false);
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
          <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', !mailbox.is_active ? 'bg-surface-100' : mailbox.is_paused ? 'bg-amber-100' : 'bg-green-100')}>
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
            <div className={clsx('px-3 py-2 font-semibold', testResult.imap_ok && testResult.smtp_ok ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100')}>
              {testResult.message}
            </div>
            <div className="flex divide-x border-t border-surface-100">
              <div className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2', testResult.imap_ok ? 'text-green-600' : 'text-red-500')}>
                {testResult.imap_ok ? <Wifi size={12} /> : <WifiOff size={12} />} IMAP {testResult.imap_ok ? 'OK' : 'FAIL'}
              </div>
              <div className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2', testResult.smtp_ok ? 'text-green-600' : 'text-red-500')}>
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
          <button onClick={handleTogglePause} disabled={toggling || !mailbox.is_active} className={clsx('flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all disabled:opacity-50', mailbox.is_paused ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-amber-200 text-amber-700 hover:bg-amber-50')}>
            {toggling ? <Loader2 size={12} className="animate-spin" /> : mailbox.is_paused ? <Play size={12} /> : <Pause size={12} />}
            {mailbox.is_paused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={handleDelete} disabled={deleting} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-700 border border-red-100 hover:border-red-300 hover:bg-red-50 px-3 py-2 rounded-xl transition-all disabled:opacity-50">
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
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setMailboxes(await mailboxService.list()); }
    catch { toast.error('Failed to load mailboxes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active  = mailboxes.filter(m => m.is_active && !m.is_paused).length;
  const paused  = mailboxes.filter(m => m.is_paused).length;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <PageHeader
        title="Mailboxes"
        subtitle="Manage IMAP/SMTP mailboxes for inbound email polling and outbound replies."
        action={
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-xl hover:bg-surface-100 text-gray-500 transition-colors" title="Refresh"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm">
              <Plus size={15} /> Add Mailbox
            </button>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total',   value: mailboxes.length, color: 'bg-amber-500',  icon: MailOpen     },
          { label: 'Active',  value: active,           color: 'bg-green-500',  icon: CheckCircle2 },
          { label: 'Paused',  value: paused,           color: 'bg-amber-400',  icon: Pause        },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="card p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}><Icon size={18} className="text-white" /></div>
            <div><p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</p><p className="font-display text-3xl font-bold text-surface-900">{value}</p></div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={22} className="animate-spin text-amber-500" />
          <span className="text-sm text-gray-500">Loading mailboxes…</span>
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="card p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4"><MailOpen size={28} className="text-amber-500" /></div>
          <h3 className="font-display font-bold text-surface-900 mb-1">No mailboxes configured</h3>
          <p className="text-sm text-gray-500 max-w-xs mb-5">Add a mailbox to start polling for customer emails and enable outbound replies from disputes.</p>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all"><Plus size={15} /> Add Your First Mailbox</button>
        </div>
      ) : (
        <>
          {paused > 0 && (
            <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-amber-500 shrink-0" />
              <p className="text-sm text-amber-800"><strong>{paused} mailbox{paused !== 1 ? 'es are' : ' is'} paused</strong> — email polling is suspended for those.</p>
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
