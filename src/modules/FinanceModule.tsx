import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Wallet, ShieldCheck, ClipboardCheck, BarChart3, Plus, Trash2,
  X, AlertTriangle, CheckCircle2, XCircle, Hash, CreditCard, CalendarClock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { Invoice, Payment, GuaranteeLetter, FinanceSummary } from '../types';

const GUARANTEE_STATUS_TR: Record<string, string> = { REQUESTED: 'Talep Edildi', ACTIVE: 'Aktif', RELEASED: 'İade', EXPIRED: 'Süresi Doldu', CALLED: 'Nakde Çevrildi' };
const GTYPE_TR: Record<string, string> = { BID_BOND: 'Geçici Teminat', PERFORMANCE: 'Kesin Teminat', ADVANCE: 'Avans Teminatı', WARRANTY: 'Garanti Teminatı' };

interface CostApproval {
  id: string; description: string; category: string; plannedAmount: number; actualAmount: number;
  currency: string; amountTRY: number; approvalStatus: string; notes?: string | null;
  project?: { id: string; name: string; code?: string | null } | null;
}

type TabKey = 'invoices' | 'collection' | 'guarantees' | 'cost-approval' | 'summary';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'invoices', label: 'Faturalar', icon: <FileText size={16} /> },
  { key: 'collection', label: 'Tahsilat', icon: <Wallet size={16} /> },
  { key: 'guarantees', label: 'Teminat Mektupları', icon: <ShieldCheck size={16} /> },
  { key: 'cost-approval', label: 'Maliyet Onayı', icon: <ClipboardCheck size={16} /> },
  { key: 'summary', label: 'Özet', icon: <BarChart3 size={16} /> },
];

const fmt = (n: number, c = 'TRY') =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';

const INVOICE_STATUS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600', ISSUED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-indigo-100 text-indigo-700', PARTIAL: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700', OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-200 text-slate-400',
};
const GUARANTEE_STATUS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700', RELEASED: 'bg-slate-100 text-slate-500',
  EXPIRED: 'bg-red-100 text-red-700', CALLED: 'bg-amber-100 text-amber-700',
};

const FinanceModule = () => {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<TabKey>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [guarantees, setGuarantees] = useState<GuaranteeLetter[]>([]);
  const [costApprovals, setCostApprovals] = useState<CostApproval[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showGuaranteeForm, setShowGuaranteeForm] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, g, ca, s] = await Promise.all([
        apiService.getInvoices(), apiService.getGuarantees(),
        apiService.getCostApprovals(), apiService.getFinanceSummary(),
      ]);
      setInvoices(inv as Invoice[]); setGuarantees(g as GuaranteeLetter[]);
      setCostApprovals(ca as CostApproval[]); setSummary(s as FinanceSummary);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Finans</h2>
          <p className="text-slate-500 italic">Faturalama, tahsilat, teminat ve maliyet onay katmanı</p>
        </div>
        {tab === 'invoices' && (
          <button onClick={() => setShowInvoiceForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Yeni Fatura
          </button>
        )}
        {tab === 'guarantees' && (
          <button onClick={() => setShowGuaranteeForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Yeni Teminat
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
              tab === t.key ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-400 italic px-2">Yükleniyor...</p>}

      {tab === 'invoices' && (
        <InvoicesTab items={invoices}
          onPay={(inv) => setPayInvoice(inv)}
          onDelete={async (id) => { await apiService.deleteInvoice(id); load(); }} />
      )}
      {tab === 'collection' && (
        <CollectionTab items={invoices} onPay={(inv) => setPayInvoice(inv)} />
      )}
      {tab === 'guarantees' && (
        <GuaranteesTab items={guarantees} onChanged={load}
          onDelete={async (id) => { await apiService.deleteGuarantee(id); load(); }} />
      )}
      {tab === 'cost-approval' && (
        <CostApprovalTab items={costApprovals}
          onDecide={async (id, decision) => {
            await apiService.approveCostItem(id, { decision, approvedById: currentUser?.id });
            load();
          }} />
      )}
      {tab === 'summary' && <SummaryTab s={summary} />}

      <AnimatePresence>
        {showInvoiceForm && (
          <InvoiceForm userId={currentUser?.id} onClose={() => setShowInvoiceForm(false)}
            onSaved={() => { setShowInvoiceForm(false); load(); }} />
        )}
        {showGuaranteeForm && (
          <GuaranteeForm onClose={() => setShowGuaranteeForm(false)}
            onSaved={() => { setShowGuaranteeForm(false); load(); }} />
        )}
        {payInvoice && (
          <PaymentForm invoice={payInvoice} onClose={() => setPayInvoice(null)}
            onSaved={() => { setPayInvoice(null); load(); }} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Sekme içerikleri ──────────────────────────────────────────────────────────

const EmptyState = ({ text }: { text: string }) => (
  <div className="glass-card p-16 text-center"><p className="text-slate-400 italic">{text}</p></div>
);

const DocBadge = ({ n }: { n?: string | null }) => n ? (
  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
    <Hash size={10} /> {n}
  </span>
) : null;

const InvoicesTab = ({ items, onPay, onDelete }: {
  items: Invoice[]; onPay: (inv: Invoice) => void; onDelete: (id: string) => void;
}) => {
  if (items.length === 0) return <EmptyState text="Henüz fatura yok. Satış/satınalma faturalarını ekleyin." />;
  return (
    <div className="grid gap-3">
      {items.map(inv => {
        const remaining = inv.amount - inv.paidAmount;
        return (
          <div key={inv.id} className="glass-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${inv.type === 'SALES' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                    {inv.type === 'SALES' ? 'Satış' : 'Alış'}
                  </span>
                  <h4 className="font-black text-slate-900">{inv.invoiceNo || '(no yok)'}</h4>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${INVOICE_STATUS[inv.status] || 'bg-slate-100 text-slate-600'}`}>{inv.status}</span>
                  <DocBadge n={inv.docNumber} />
                </div>
                <p className="text-sm text-slate-600">{inv.customerName || inv.vendorName || '—'}</p>
                <p className="text-xs text-slate-500">
                  Düzenleme: {fmtDate(inv.issueDate)} · Vade: {fmtDate(inv.dueDate)}
                  {remaining > 0 && <span className="text-amber-600 font-bold"> · Kalan: {fmt(remaining, inv.currency)}</span>}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-lg font-black text-slate-900">{fmt(inv.amount, inv.currency)}</span>
                <div className="flex items-center gap-2">
                  {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                    <button onClick={() => onPay(inv)} className="text-[10px] font-black uppercase text-primary hover:underline flex items-center gap-1">
                      <CreditCard size={12} /> Tahsilat
                    </button>
                  )}
                  <button onClick={() => onDelete(inv.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CollectionTab = ({ items, onPay }: { items: Invoice[]; onPay: (inv: Invoice) => void }) => {
  const open = items.filter(i => i.type === 'SALES' && i.status !== 'PAID' && i.status !== 'CANCELLED');
  if (open.length === 0) return <EmptyState text="Açık (tahsil edilecek) satış faturası yok." />;
  const now = Date.now();
  return (
    <div className="grid gap-3">
      {open.map(inv => {
        const remaining = inv.amount - inv.paidAmount;
        const overdue = inv.dueDate && new Date(inv.dueDate).getTime() < now;
        return (
          <div key={inv.id} className={`glass-card p-5 border-l-4 ${overdue ? 'border-red-400' : 'border-amber-300'}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-slate-900">{inv.invoiceNo || '(no yok)'}</h4>
                  <span className="text-sm text-slate-600">{inv.customerName || '—'}</span>
                  {overdue && <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-600"><CalendarClock size={12} /> Vadesi Geçti</span>}
                </div>
                <p className="text-xs text-slate-500">
                  Vade: {fmtDate(inv.dueDate)} · Tahsil: {fmt(inv.paidAmount, inv.currency)} / {fmt(inv.amount, inv.currency)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-lg font-black text-amber-600">{fmt(remaining, inv.currency)}</span>
                <button onClick={() => onPay(inv)} className="btn-secondary text-[10px] flex items-center gap-1 px-3 py-1.5">
                  <CreditCard size={12} /> Tahsilat Gir
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const GuaranteesTab = ({ items, onDelete, onChanged }: { items: GuaranteeLetter[]; onDelete: (id: string) => void; onChanged: () => void }) => {
  const [fulfill, setFulfill] = useState<GuaranteeLetter | null>(null);
  const [sampleView, setSampleView] = useState<GuaranteeLetter | null>(null);
  const now = Date.now();
  const soon = now + 30 * 24 * 60 * 60 * 1000;
  const requested = items.filter(g => g.status === 'REQUESTED');

  const exportExcel = () => {
    const rows = items.map(g => ({
      İş: g.tenderId || g.projectId || '—',
      Tür: GTYPE_TR[g.type] || g.type,
      Tutar: g.amount, Döviz: g.currency,
      Vade: g.isIndefinite ? 'Süresiz' : (g.expiryDate ? new Date(g.expiryDate).toLocaleDateString('tr-TR') : '—'),
      Banka: g.bankName || '—', Ref: g.refNo || '—',
      Durum: GUARANTEE_STATUS_TR[g.status] || g.status,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Teminatlar');
    XLSX.writeFile(wb, `Teminat_Mektuplari_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (items.length === 0) return <EmptyState text="Henüz teminat mektubu yok." />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{items.length} teminat{requested.length > 0 ? ` · ${requested.length} talep bekliyor` : ''}</span>
        <button onClick={exportExcel} className="btn-secondary text-xs"><FileText size={14} /> Excel İndir</button>
      </div>
      {items.map(g => {
        const exp = g.expiryDate ? new Date(g.expiryDate).getTime() : null;
        const expired = !g.isIndefinite && exp != null && exp < now;
        const expiring = !g.isIndefinite && exp != null && exp >= now && exp <= soon;
        return (
          <div key={g.id} className={`glass-card p-5 ${g.status === 'REQUESTED' ? 'border-l-4 border-amber-400' : expired ? 'border-l-4 border-red-400' : expiring ? 'border-l-4 border-amber-300' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600">{GTYPE_TR[g.type] || g.type}</span>
                  <h4 className="font-black text-slate-900">{g.bankName || (g.status === 'REQUESTED' ? 'Talep (banka atanmadı)' : 'Banka belirtilmedi')}</h4>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${g.status === 'REQUESTED' ? 'bg-amber-100 text-amber-700' : GUARANTEE_STATUS[g.status] || 'bg-slate-100 text-slate-600'}`}>{GUARANTEE_STATUS_TR[g.status] || g.status}</span>
                  {g.isIndefinite && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg bg-violet-100 text-violet-700">Süresiz</span>}
                  <DocBadge n={g.docNumber} />
                </div>
                <p className="text-xs text-slate-500">
                  {g.refNo ? `Ref: ${g.refNo} · ` : ''}{g.isIndefinite ? 'Süresiz' : `Sona erme: ${fmtDate(g.expiryDate)}`}
                  {expired && <span className="text-red-600 font-bold"> · Süresi doldu</span>}
                  {expiring && <span className="text-amber-600 font-bold"> · Yakında doluyor</span>}
                </p>
                {g.sampleText && <button onClick={() => setSampleView(g)} className="text-[11px] font-bold text-indigo-600 hover:underline">Örnek metni gör</button>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-lg font-black text-slate-900">{fmt(g.amount, g.currency)}</span>
                <div className="flex items-center gap-2">
                  {g.status === 'REQUESTED' && <button onClick={() => setFulfill(g)} className="btn-primary text-xs">Karşıla</button>}
                  <button onClick={() => onDelete(g.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <AnimatePresence>
        {fulfill && <FulfillGuaranteeForm g={fulfill} onClose={() => setFulfill(null)} onSaved={() => { setFulfill(null); onChanged(); }} />}
        {sampleView && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50" onClick={() => setSampleView(null)}>
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h4 className="font-black text-slate-900 mb-3">Örnek Teminat Metni</h4>
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">{sampleView.sampleText}</pre>
              <button onClick={() => setSampleView(null)} className="btn-secondary text-sm mt-4">Kapat</button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Finans teminat talebini karşılar: banka/ref/tarih → ACTIVE (örnek metinden düzenler)
const FulfillGuaranteeForm = ({ g, onClose, onSaved }: { g: GuaranteeLetter; onClose: () => void; onSaved: () => void }) => {
  const [f, setF] = useState({ bankName: '', refNo: '', issueDate: new Date().toISOString().slice(0, 10), text: g.sampleText || '' });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await apiService.updateGuarantee(g.id, {
        status: 'ACTIVE', bankName: f.bankName || null, refNo: f.refNo || null,
        issueDate: f.issueDate || null, sampleText: f.text || null,
      });
      onSaved();
    } catch (e) { alert('Hata: ' + (e instanceof Error ? e.message : '')); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[88vh] overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}>
        <h4 className="font-black text-slate-900">Teminat Talebini Karşıla</h4>
        <p className="text-xs text-slate-500">{GTYPE_TR[g.type] || g.type} · {fmt(g.amount, g.currency)} · {g.isIndefinite ? 'Süresiz' : `Vade ${fmtDate(g.expiryDate)}`}</p>
        <input className="input-glass w-full text-sm" placeholder="Banka adı" value={f.bankName} onChange={e => setF({ ...f, bankName: e.target.value })} />
        <input className="input-glass w-full text-sm" placeholder="Referans No" value={f.refNo} onChange={e => setF({ ...f, refNo: e.target.value })} />
        <label className="text-xs text-slate-500">Düzenleme tarihi</label>
        <input className="input-glass w-full text-sm" type="date" value={f.issueDate} onChange={e => setF({ ...f, issueDate: e.target.value })} />
        <label className="text-xs text-slate-500">Teminat metni (örnek metinden düzenle)</label>
        <textarea className="input-glass w-full text-xs" rows={6} value={f.text} onChange={e => setF({ ...f, text: e.target.value })} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Vazgeç</button>
          <button onClick={submit} disabled={!f.bankName || saving} className="btn-primary text-sm disabled:opacity-50">Düzenlendi — Aktif Yap</button>
        </div>
      </div>
    </div>
  );
};

const CostApprovalTab = ({ items, onDecide }: {
  items: CostApproval[]; onDecide: (id: string, decision: 'APPROVE' | 'REJECT') => void;
}) => {
  if (items.length === 0) return <EmptyState text="Onay bekleyen proje maliyet kalemi yok." />;
  return (
    <div className="grid gap-3">
      {items.map(c => (
        <div key={c.id} className="glass-card p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-slate-900">{c.description}</h4>
              <span className="text-[10px] font-bold uppercase text-slate-400">{c.category}</span>
              {c.project && <span className="text-[10px] font-mono text-slate-500">{c.project.code || c.project.name}</span>}
            </div>
            <p className="text-xs text-slate-500">
              Planlanan: {fmt(c.plannedAmount, c.currency)} · Gerçekleşen: {fmt(c.actualAmount, c.currency)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onDecide(c.id, 'APPROVE')} className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 hover:bg-emerald-50 px-3 py-2 rounded-xl transition-colors">
              <CheckCircle2 size={14} /> Onayla
            </button>
            <button onClick={() => onDecide(c.id, 'REJECT')} className="flex items-center gap-1 text-[10px] font-black uppercase text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors">
              <XCircle size={14} /> Reddet
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const SummaryTab = ({ s }: { s: FinanceSummary | null }) => {
  if (!s) return <EmptyState text="Özet yükleniyor..." />;
  const cards = [
    { label: 'Toplam Alacak', value: fmt(s.totalReceivable), accent: 'text-amber-600' },
    { label: 'Tahsil Edilen', value: fmt(s.totalCollected), accent: 'text-emerald-600' },
    { label: 'Vadesi Geçen', value: fmt(s.overdue), accent: 'text-red-600' },
    { label: 'Aktif Teminat', value: String(s.activeGuarantees), accent: 'text-indigo-600' },
    { label: 'Yaklaşan Teminat (30g)', value: String(s.expiringGuarantees), accent: 'text-amber-600' },
    { label: 'Bekleyen Maliyet Onayı', value: String(s.pendingCostApprovals), accent: 'text-slate-900' },
  ];
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map(c => (
        <div key={c.label} className="glass-card p-6 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{c.label}</p>
          <p className={`text-3xl font-black ${c.accent}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
};

// ── Formlar ───────────────────────────────────────────────────────────────────

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
    <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
      className="bg-white rounded-[2rem] p-8 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
      onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-slate-900">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
      </div>
      {children}
    </motion.div>
  </motion.div>
);

const InvoiceForm = ({ userId, onClose, onSaved }: { userId?: string; onClose: () => void; onSaved: () => void }) => {
  const [f, setF] = useState<Record<string, string>>({ type: 'SALES', status: 'ISSUED', currency: 'TRY' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      if (!f.amount) throw new Error('Tutar zorunlu.');
      await apiService.createInvoice({ ...f, amount: Number(f.amount), createdById: userId });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Kaydetme hatası.'); setSaving(false); }
  };

  return (
    <Modal title="Yeni Fatura" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Tip" v={f.type} on={(v) => set('type', v)} opts={['SALES', 'PURCHASE']} />
        <Select label="Durum" v={f.status} on={(v) => set('status', v)} opts={['DRAFT', 'ISSUED', 'SENT', 'CANCELLED']} />
      </div>
      <Input label="Fatura No" v={f.invoiceNo} on={(v) => set('invoiceNo', v)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Tutar" v={f.amount} on={(v) => set('amount', v)} type="number" />
        <Select label="Para Birimi" v={f.currency} on={(v) => set('currency', v)} opts={['TRY', 'USD', 'EUR']} />
      </div>
      <Input label={f.type === 'SALES' ? 'Müşteri' : 'Tedarikçi'} v={f.type === 'SALES' ? f.customerName : f.vendorName}
        on={(v) => set(f.type === 'SALES' ? 'customerName' : 'vendorName', v)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Düzenleme Tarihi" v={f.issueDate} on={(v) => set('issueDate', v)} type="date" />
        <Input label="Vade" v={f.dueDate} on={(v) => set('dueDate', v)} type="date" />
      </div>
      <Input label="Proje ID (opsiyonel)" v={f.projectId} on={(v) => set('projectId', v)} />
      <Input label="Doküman Kategori Kodu (opsiyonel)" v={f.categoryCode} on={(v) => set('categoryCode', v.toUpperCase())} placeholder="örn. FAT" />
      {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
      <button onClick={save} disabled={saving} className="btn-primary w-full disabled:opacity-50">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
    </Modal>
  );
};

const GuaranteeForm = ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => {
  const [f, setF] = useState<Record<string, string>>({ type: 'PERFORMANCE', status: 'ACTIVE', currency: 'TRY' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      if (!f.amount) throw new Error('Tutar zorunlu.');
      await apiService.createGuarantee({ ...f, amount: Number(f.amount) });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Kaydetme hatası.'); setSaving(false); }
  };

  return (
    <Modal title="Yeni Teminat Mektubu" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Tip" v={f.type} on={(v) => set('type', v)} opts={['BID_BOND', 'PERFORMANCE', 'ADVANCE', 'WARRANTY']} />
        <Select label="Durum" v={f.status} on={(v) => set('status', v)} opts={['ACTIVE', 'RELEASED', 'EXPIRED', 'CALLED']} />
      </div>
      <Input label="Banka" v={f.bankName} on={(v) => set('bankName', v)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Tutar" v={f.amount} on={(v) => set('amount', v)} type="number" />
        <Select label="Para Birimi" v={f.currency} on={(v) => set('currency', v)} opts={['TRY', 'USD', 'EUR']} />
      </div>
      <Input label="Referans No" v={f.refNo} on={(v) => set('refNo', v)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Düzenleme" v={f.issueDate} on={(v) => set('issueDate', v)} type="date" />
        <Input label="Sona Erme" v={f.expiryDate} on={(v) => set('expiryDate', v)} type="date" />
      </div>
      <Input label="Doküman Kategori Kodu (opsiyonel)" v={f.categoryCode} on={(v) => set('categoryCode', v.toUpperCase())} placeholder="örn. TEM" />
      {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
      <button onClick={save} disabled={saving} className="btn-primary w-full disabled:opacity-50">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
    </Modal>
  );
};

const PaymentForm = ({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) => {
  const remaining = invoice.amount - invoice.paidAmount;
  const [f, setF] = useState<Record<string, string>>({ amount: String(remaining), method: 'BANK_TRANSFER' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      if (!f.amount) throw new Error('Tutar zorunlu.');
      await apiService.addInvoicePayment(invoice.id, { ...f, amount: Number(f.amount) });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Kaydetme hatası.'); setSaving(false); }
  };

  return (
    <Modal title={`Tahsilat — ${invoice.invoiceNo || ''}`} onClose={onClose}>
      <div className="glass-card p-4 flex items-center gap-2 bg-amber-50/60">
        <AlertTriangle size={16} className="text-amber-500" />
        <p className="text-xs text-slate-600">Kalan bakiye: <b>{fmt(remaining, invoice.currency)}</b></p>
      </div>
      <Input label="Tahsilat Tutarı" v={f.amount} on={(v) => set('amount', v)} type="number" />
      <Select label="Yöntem" v={f.method} on={(v) => set('method', v)} opts={['BANK_TRANSFER', 'CHEQUE', 'CASH', 'OTHER']} />
      <Input label="Tarih (boşsa bugün)" v={f.paidAt} on={(v) => set('paidAt', v)} type="date" />
      <Input label="Referans" v={f.reference} on={(v) => set('reference', v)} />
      {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
      <button onClick={save} disabled={saving} className="btn-primary w-full disabled:opacity-50">{saving ? 'Kaydediliyor...' : 'Tahsilatı Kaydet'}</button>
    </Modal>
  );
};

// ── Küçük form yardımcıları (CorporateGovernance konvansiyonu) ───────────────────
const Input = ({ label, v, on, type = 'text', placeholder }: { label: string; v?: string; on: (v: string) => void; type?: string; placeholder?: string }) => (
  <div>
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <input type={type} value={v || ''} placeholder={placeholder} onChange={(e) => on(e.target.value)} className="input-glass w-full mt-1" />
  </div>
);
const Select = ({ label, v, on, opts }: { label: string; v: string; on: (v: string) => void; opts: string[] }) => (
  <div>
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <select value={v} onChange={(e) => on(e.target.value)} className="input-glass w-full mt-1">
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

export default FinanceModule;
