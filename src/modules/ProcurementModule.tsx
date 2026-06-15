import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Package, Truck, FileText, Plus, Search, X,
  ChevronDown, ChevronUp, Star, Building2, Phone, Mail,
  Tag, Edit2, Trash2, Check, AlertCircle, Clock, CheckCircle2,
  DollarSign, BarChart3, Filter, RefreshCw, Printer, Ban,
  ArrowRight, TrendingUp, Users, FileCheck, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import {
  Vendor, PurchaseRequest, PurchaseStatus, PurchaseUrgency,
  PurchaseItem, PurchaseQuote, DeliveryRecord, Project, Unit
} from '../types';

// ── Sabitler ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PurchaseStatus, { label: string; textColor: string; bg: string; icon: React.ReactNode }> = {
  DRAFT:               { label: 'Taslak',           textColor: 'text-slate-600',  bg: 'bg-slate-100',  icon: <FileText size={12} /> },
  PENDING_UNIT:        { label: 'Birim Onayı',       textColor: 'text-amber-700',  bg: 'bg-amber-100',  icon: <Clock size={12} /> },
  PENDING_PROCUREMENT: { label: 'Sat.Alma Onayı',    textColor: 'text-blue-700',   bg: 'bg-blue-100',   icon: <Clock size={12} /> },
  PENDING_GM:          { label: 'GM Onayı',          textColor: 'text-purple-700', bg: 'bg-purple-100', icon: <Clock size={12} /> },
  PO_ISSUED:           { label: 'PO Kesildi',        textColor: 'text-indigo-700', bg: 'bg-indigo-100', icon: <FileCheck size={12} /> },
  IN_DELIVERY:         { label: 'Teslimat Sürecinde',textColor: 'text-cyan-700',   bg: 'bg-cyan-100',   icon: <Truck size={12} /> },
  INVOICED:            { label: 'Faturalandı',       textColor: 'text-orange-700', bg: 'bg-orange-100', icon: <DollarSign size={12} /> },
  CLOSED:              { label: 'Kapalı',            textColor: 'text-green-700',  bg: 'bg-green-100',  icon: <CheckCircle2 size={12} /> },
  REJECTED:            { label: 'Reddedildi',        textColor: 'text-red-700',    bg: 'bg-red-100',    icon: <Ban size={12} /> },
};

const URGENCY_CONFIG: Record<PurchaseUrgency, { label: string; color: string }> = {
  LOW:    { label: 'Düşük',  color: 'text-slate-500' },
  NORMAL: { label: 'Normal', color: 'text-blue-600'  },
  HIGH:   { label: 'Yüksek', color: 'text-orange-600' },
  URGENT: { label: 'Acil',   color: 'text-red-600'   },
};

const SOURCE_LABEL: Record<string, string> = {
  MANUAL:  'Manuel',
  BOM:     'BoM',
  PROJECT: 'Proje',
  UNIT:    'Birim',
};

const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'];

const formatCurrency = (amount: number | null | undefined, currency = 'TRY') => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
};

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ── StatusBadge ───────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: PurchaseStatus }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.textColor}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
};

// ── VendorForm ────────────────────────────────────────────────────────────────

interface VendorFormProps {
  initial?: Partial<Vendor>;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

const VendorForm: React.FC<VendorFormProps> = ({ initial, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    taxNo: initial?.taxNo ?? '',
    address: initial?.address ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    contactName: initial?.contactName ?? '',
    iban: initial?.iban ?? '',
    bankName: initial?.bankName ?? '',
    notes: initial?.notes ?? '',
    categories: (initial?.categories ? (typeof initial.categories === 'string' ? JSON.parse(initial.categories) : initial.categories) : []) as string[],
  });
  const [catInput, setCatInput] = useState('');

  const addCat = () => {
    const t = catInput.trim();
    if (t && !form.categories.includes(t)) {
      setForm(f => ({ ...f, categories: [...f.categories, t] }));
    }
    setCatInput('');
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <h4 className="text-lg font-bold">{initial?.id ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi'}</h4>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            {[['name','Firma Adı *'],['taxNo','Vergi No'],['contactName','İlgili Kişi'],['phone','Telefon'],['email','E-posta'],['bankName','Banka Adı'],['iban','IBAN'],['taxNo','Vergi No']].filter((v,i,a)=>a.findIndex(x=>x[0]===v[0])===i).map(([key, lbl]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{lbl}</label>
                <input value={(form as Record<string,string>)[key] ?? ''} onChange={f(key)}
                  className="input-glass w-full px-3 py-2 text-sm rounded-xl" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Adres</label>
            <textarea value={form.address} onChange={f('address')} rows={2}
              className="input-glass w-full px-3 py-2 text-sm rounded-xl resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Kategoriler</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {form.categories.map(c => (
                <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                  {c}
                  <button onClick={() => setForm(f => ({ ...f, categories: f.categories.filter(x => x !== c) }))} className="hover:text-indigo-900"><X size={10} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={catInput} onChange={e => setCatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCat())}
                placeholder="Kategori ekle (Enter)"
                className="input-glass flex-1 px-3 py-2 text-sm rounded-xl" />
              <button onClick={addCat} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Notlar</label>
            <textarea value={form.notes} onChange={f('notes')} rows={2}
              className="input-glass w-full px-3 py-2 text-sm rounded-xl resize-none" />
          </div>
        </div>
        <div className="p-5 border-t border-white/10 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary px-5 py-2 text-sm rounded-xl">İptal</button>
          <button onClick={() => onSave({ ...form, categories: form.categories })}
            disabled={!form.name.trim()}
            className="btn-primary px-5 py-2 text-sm rounded-xl disabled:opacity-50">
            Kaydet
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── PRDetailDrawer ────────────────────────────────────────────────────────────

interface PRDetailDrawerProps {
  pr: PurchaseRequest;
  vendors: Vendor[];
  currentUserRole?: string;
  currentUserId?: string;
  onClose: () => void;
  onRefresh: () => void;
}

const PRDetailDrawer: React.FC<PRDetailDrawerProps> = ({ pr, vendors, currentUserRole, currentUserId, onClose, onRefresh }) => {
  const [tab, setTab] = useState<'info' | 'quotes' | 'delivery' | 'invoice'>('info');
  const [loading, setLoading] = useState(false);
  const [rejNote, setRejNote] = useState('');
  const [showReject, setShowReject] = useState(false);

  const [quoteForm, setQuoteForm] = useState({ vendorId: '', vendorName: '', totalAmount: '', currency: 'TRY', totalAmountTRY: '', deliveryDays: '', validUntil: '', notes: '' });
  const [deliveryForm, setDeliveryForm] = useState({ deliveredAt: new Date().toISOString().split('T')[0], receivedBy: '', quantityOrdered: '', quantityReceived: '', quantityDamaged: '', status: 'RECEIVED', notes: '' });
  const [invoiceForm, setInvoiceForm] = useState({ invoiceNo: pr.invoiceNo ?? '', invoiceAmount: pr.invoiceAmount?.toString() ?? '', invoiceDate: pr.invoiceDate?.split('T')[0] ?? '', invoicePaidAt: pr.invoicePaidAt?.split('T')[0] ?? '' });

  const canApprove = () => {
    if (pr.status === 'PENDING_UNIT' && (currentUserRole === 'SALES_MANAGER' || currentUserRole === 'GENERAL_MANAGER')) return true;
    if (pr.status === 'PENDING_PROCUREMENT' && (currentUserRole === 'PROCUREMENT' || currentUserRole === 'GENERAL_MANAGER')) return true;
    if (pr.status === 'PENDING_GM' && currentUserRole === 'GENERAL_MANAGER') return true;
    return false;
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await apiService.approvePurchaseRequest(pr.id, { approverId: currentUserId, approverRole: currentUserRole });
      onRefresh();
    } finally { setLoading(false); }
  };

  const handleReject = async () => {
    if (!rejNote.trim()) return;
    setLoading(true);
    try {
      await apiService.rejectPurchaseRequest(pr.id, { rejectionNote: rejNote });
      onRefresh();
    } finally { setLoading(false); setShowReject(false); }
  };

  const handleAddQuote = async () => {
    setLoading(true);
    try {
      await apiService.addPurchaseQuote(pr.id, {
        ...quoteForm,
        totalAmount: Number(quoteForm.totalAmount),
        totalAmountTRY: quoteForm.totalAmountTRY ? Number(quoteForm.totalAmountTRY) : Number(quoteForm.totalAmount),
        deliveryDays: quoteForm.deliveryDays ? Number(quoteForm.deliveryDays) : undefined,
      });
      setQuoteForm({ vendorId: '', vendorName: '', totalAmount: '', currency: 'TRY', totalAmountTRY: '', deliveryDays: '', validUntil: '', notes: '' });
      onRefresh();
    } finally { setLoading(false); }
  };

  const handleSelectQuote = async (qid: string) => {
    setLoading(true);
    try {
      await apiService.selectPurchaseQuote(pr.id, qid);
      onRefresh();
    } finally { setLoading(false); }
  };

  const handleAddDelivery = async () => {
    setLoading(true);
    try {
      await apiService.addDeliveryRecord(pr.id, {
        ...deliveryForm,
        quantityOrdered: deliveryForm.quantityOrdered ? Number(deliveryForm.quantityOrdered) : undefined,
        quantityReceived: deliveryForm.quantityReceived ? Number(deliveryForm.quantityReceived) : undefined,
        quantityDamaged: deliveryForm.quantityDamaged ? Number(deliveryForm.quantityDamaged) : undefined,
      });
      onRefresh();
    } finally { setLoading(false); }
  };

  const handleSaveInvoice = async () => {
    setLoading(true);
    try {
      await apiService.updatePurchaseInvoice(pr.id, {
        ...invoiceForm,
        invoiceAmount: invoiceForm.invoiceAmount ? Number(invoiceForm.invoiceAmount) : undefined,
      });
      onRefresh();
    } finally { setLoading(false); }
  };

  const handleClose = async () => {
    setLoading(true);
    try {
      await apiService.closePurchaseRequest(pr.id);
      onRefresh();
    } finally { setLoading(false); }
  };

  const printPO = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const selected = pr.quotes.find(q => q.isSelected);
    w.document.write(`<!DOCTYPE html><html><head><title>Satın Alma Emri — ${pr.poNumber}</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;color:#1e293b}h1{font-size:24px}table{width:100%;border-collapse:collapse}td,th{padding:8px 12px;border:1px solid #e2e8f0;text-align:left}th{background:#f8fafc;font-weight:600}.label{color:#64748b;font-size:12px}</style>
    </head><body>
    <h1>Satın Alma Emri (PO)</h1>
    <p class="label">PO No</p><p><strong>${pr.poNumber ?? '—'}</strong></p>
    <p class="label">Tarih</p><p>${formatDate(pr.poIssuedAt)}</p>
    <p class="label">Tedarikçi</p><p>${pr.selectedVendorName ?? selected?.vendorName ?? '—'}</p>
    <p class="label">Başlık</p><p>${pr.title}</p>
    <h3 style="margin-top:24px">Kalemler</h3>
    <table><tr><th>Ürün/Hizmet</th><th>Miktar</th><th>Birim</th><th>Tahmini Fiyat</th></tr>
    ${pr.items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.unit}</td><td>${formatCurrency(i.estimatedUnitPrice, i.currency)}</td></tr>`).join('')}
    </table>
    ${selected ? `<h3 style="margin-top:24px">Seçilen Teklif</h3><p>${selected.vendorName} — ${formatCurrency(selected.totalAmountTRY, 'TRY')} (${selected.deliveryDays} gün teslimat)</p>` : ''}
    <div style="margin-top:48px;border-top:1px solid #e2e8f0;padding-top:16px">
    <p>Onaylayan GM: ${pr.approvedByGM ?? '—'}</p>
    </div></body></html>`);
    w.document.close();
    w.print();
  };

  const TABS = [
    { key: 'info',     label: 'Bilgi' },
    { key: 'quotes',   label: `Teklifler (${pr.quotes.length})` },
    { key: 'delivery', label: `Teslimat (${pr.deliveries.length})` },
    { key: 'invoice',  label: 'Fatura' },
  ] as const;

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl glass-card border-l border-white/10 shadow-2xl flex flex-col"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-start justify-between shrink-0">
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={pr.status} />
            <span className="text-xs text-slate-400 font-medium">{SOURCE_LABEL[pr.sourceType]}</span>
            {pr.poNumber && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">{pr.poNumber}</span>}
          </div>
          <h3 className="font-bold text-lg leading-tight">{pr.title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{pr.unitName ?? ''} · {formatDate(pr.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pr.poNumber && (
            <button onClick={printPO} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-slate-200" title="PO Yazdır">
              <Printer size={18} />
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={18} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 shrink-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm font-semibold transition-colors ${tab === t.key ? 'border-b-2 border-indigo-400 text-indigo-300' : 'text-slate-400 hover:text-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {tab === 'info' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Aciliyet', <span className={`font-semibold ${URGENCY_CONFIG[pr.urgency].color}`}>{URGENCY_CONFIG[pr.urgency].label}</span>],
                ['Gereksinim Tarihi', formatDate(pr.neededBy)],
                ['Bütçe', formatCurrency(pr.budgetAmountTRY, 'TRY')],
                ['Döviz', pr.currency],
                ['Talep Eden', pr.requestedByName ?? pr.requestedBy],
                ['Tedarikçi', pr.selectedVendorName ?? '—'],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">{label}</p>
                  <p className="text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>
            {pr.description && (
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-1">Açıklama</p>
                <p className="text-sm">{pr.description}</p>
              </div>
            )}
            {pr.items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Kalemler</p>
                <div className="space-y-2">
                  {pr.items.map((item: PurchaseItem) => (
                    <div key={item.id} className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{item.name}</p>
                        {item.description && <p className="text-xs text-slate-400">{item.description}</p>}
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-sm font-bold">{item.quantity} {item.unit}</p>
                        {item.estimatedUnitPrice && <p className="text-xs text-slate-400">{formatCurrency(item.estimatedUnitPrice, item.currency)}/birim</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {pr.rejectionNote && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3">
                <p className="text-xs text-red-400 mb-1 font-semibold">Red Notu</p>
                <p className="text-sm text-red-300">{pr.rejectionNote}</p>
              </div>
            )}
          </>
        )}

        {tab === 'quotes' && (
          <div className="space-y-4">
            {pr.quotes.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Henüz teklif eklenmedi.</p>}
            {pr.quotes.map((q: PurchaseQuote) => (
              <div key={q.id} className={`rounded-xl p-4 border ${q.isSelected ? 'border-green-500/50 bg-green-900/10' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{q.vendorName}</p>
                    <p className="text-lg font-bold text-indigo-300 mt-1">{formatCurrency(q.totalAmountTRY, 'TRY')}</p>
                    {q.deliveryDays && <p className="text-xs text-slate-400 mt-0.5">{q.deliveryDays} gün teslimat</p>}
                    {q.validUntil && <p className="text-xs text-slate-400">Geçerlilik: {formatDate(q.validUntil)}</p>}
                    {q.notes && <p className="text-xs text-slate-400 mt-1 italic">{q.notes}</p>}
                  </div>
                  {!q.isSelected && ['PENDING_PROCUREMENT','PENDING_GM','PO_ISSUED'].includes(pr.status) && (
                    <button onClick={() => handleSelectQuote(q.id)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors shrink-0">
                      Seç
                    </button>
                  )}
                  {q.isSelected && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-green-700/40 text-green-300 text-xs font-semibold rounded-lg shrink-0">
                      <Check size={12} /> Seçildi
                    </span>
                  )}
                </div>
              </div>
            ))}

            {['PENDING_PROCUREMENT','PENDING_GM','PO_ISSUED'].includes(pr.status) && (
              <div className="border border-white/10 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-300">Yeni Teklif Ekle</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Tedarikçi</label>
                    <select value={quoteForm.vendorId}
                      onChange={e => {
                        const v = vendors.find(v => v.id === e.target.value);
                        setQuoteForm(f => ({ ...f, vendorId: e.target.value, vendorName: v?.name ?? f.vendorName }));
                      }}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1">
                      <option value="">Listeden seç…</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">ya da Firma Adı</label>
                    <input value={quoteForm.vendorName} onChange={e => setQuoteForm(f => ({ ...f, vendorName: e.target.value }))}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" placeholder="Manuel giriş" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Toplam Tutar</label>
                    <input type="number" value={quoteForm.totalAmount} onChange={e => setQuoteForm(f => ({ ...f, totalAmount: e.target.value }))}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Döviz</label>
                    <select value={quoteForm.currency} onChange={e => setQuoteForm(f => ({ ...f, currency: e.target.value }))}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1">
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">TRY Karşılığı</label>
                    <input type="number" value={quoteForm.totalAmountTRY} onChange={e => setQuoteForm(f => ({ ...f, totalAmountTRY: e.target.value }))}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Teslimat (gün)</label>
                    <input type="number" value={quoteForm.deliveryDays} onChange={e => setQuoteForm(f => ({ ...f, deliveryDays: e.target.value }))}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Geçerlilik Tarihi</label>
                    <input type="date" value={quoteForm.validUntil} onChange={e => setQuoteForm(f => ({ ...f, validUntil: e.target.value }))}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Not</label>
                    <input value={quoteForm.notes} onChange={e => setQuoteForm(f => ({ ...f, notes: e.target.value }))}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
                  </div>
                </div>
                <button onClick={handleAddQuote} disabled={!quoteForm.totalAmount || loading}
                  className="btn-primary px-4 py-2 text-sm rounded-xl disabled:opacity-50">
                  Teklif Ekle
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'delivery' && (
          <div className="space-y-4">
            {pr.deliveries.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Teslimat kaydı yok.</p>}
            {pr.deliveries.map((d: DeliveryRecord) => (
              <div key={d.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.status === 'RECEIVED' ? 'bg-green-100 text-green-700' : d.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {d.status === 'RECEIVED' ? 'Teslim Alındı' : d.status === 'PARTIAL' ? 'Kısmi Teslimat' : d.status}
                  </span>
                  <span className="text-xs text-slate-400">{formatDate(d.deliveredAt)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                  <span>Sipariş: <strong className="text-slate-200">{d.quantityOrdered ?? '—'}</strong></span>
                  <span>Teslim: <strong className="text-slate-200">{d.quantityReceived ?? '—'}</strong></span>
                  <span>Hasarlı: <strong className="text-slate-200">{d.quantityDamaged ?? '0'}</strong></span>
                </div>
                {d.notes && <p className="text-xs text-slate-400 mt-2 italic">{d.notes}</p>}
              </div>
            ))}

            {pr.status === 'PO_ISSUED' || pr.status === 'IN_DELIVERY' ? (
              <div className="border border-white/10 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-300">Teslimat Kaydı Ekle</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Teslim Tarihi</label>
                    <input type="date" value={deliveryForm.deliveredAt} onChange={e => setDeliveryForm(f => ({ ...f, deliveredAt: e.target.value }))}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Teslim Alan</label>
                    <input value={deliveryForm.receivedBy} onChange={e => setDeliveryForm(f => ({ ...f, receivedBy: e.target.value }))}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Sipariş Miktar</label>
                    <input type="number" value={deliveryForm.quantityOrdered} onChange={e => setDeliveryForm(f => ({ ...f, quantityOrdered: e.target.value }))}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Teslim Miktar</label>
                    <input type="number" value={deliveryForm.quantityReceived} onChange={e => setDeliveryForm(f => ({ ...f, quantityReceived: e.target.value }))}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Durum</label>
                    <select value={deliveryForm.status} onChange={e => setDeliveryForm(f => ({ ...f, status: e.target.value }))}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1">
                      <option value="RECEIVED">Teslim Alındı</option>
                      <option value="PARTIAL">Kısmi Teslimat</option>
                      <option value="PENDING">Beklemede</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Not</label>
                    <input value={deliveryForm.notes} onChange={e => setDeliveryForm(f => ({ ...f, notes: e.target.value }))}
                      className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
                  </div>
                </div>
                <button onClick={handleAddDelivery} disabled={loading}
                  className="btn-primary px-4 py-2 text-sm rounded-xl disabled:opacity-50">
                  Teslimat Kaydet
                </button>
              </div>
            ) : null}
          </div>
        )}

        {tab === 'invoice' && (
          <div className="space-y-4">
            {pr.status === 'INVOICED' || pr.status === 'CLOSED' ? (
              <div className="bg-white/5 rounded-xl p-4 space-y-2 border border-white/10">
                <p className="text-xs text-slate-400">Fatura No</p>
                <p className="font-semibold">{pr.invoiceNo ?? '—'}</p>
                <p className="text-xs text-slate-400">Tutar</p>
                <p className="font-semibold">{formatCurrency(pr.invoiceAmount, 'TRY')}</p>
                <p className="text-xs text-slate-400">Fatura Tarihi</p>
                <p className="font-semibold">{formatDate(pr.invoiceDate)}</p>
                <p className="text-xs text-slate-400">Ödeme Tarihi</p>
                <p className="font-semibold">{formatDate(pr.invoicePaidAt)}</p>
              </div>
            ) : null}

            {pr.status === 'INVOICED' && (
              <div className="border border-white/10 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-300">Fatura Bilgilerini Güncelle</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['invoiceNo', 'Fatura No', 'text'],
                    ['invoiceAmount', 'Tutar (TRY)', 'number'],
                    ['invoiceDate', 'Fatura Tarihi', 'date'],
                    ['invoicePaidAt', 'Ödeme Tarihi', 'date'],
                  ].map(([k, lbl, type]) => (
                    <div key={k}>
                      <label className="text-xs text-slate-400">{lbl}</label>
                      <input type={type} value={(invoiceForm as Record<string,string>)[k]}
                        onChange={e => setInvoiceForm(f => ({ ...f, [k]: e.target.value }))}
                        className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={handleSaveInvoice} disabled={loading}
                    className="btn-primary px-4 py-2 text-sm rounded-xl disabled:opacity-50">
                    Kaydet
                  </button>
                  {invoiceForm.invoicePaidAt && (
                    <button onClick={handleClose} disabled={loading}
                      className="px-4 py-2 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50">
                      Talebi Kapat
                    </button>
                  )}
                </div>
              </div>
            )}

            {pr.status !== 'INVOICED' && pr.status !== 'CLOSED' && (
              <p className="text-sm text-slate-400 text-center py-6">Fatura, teslimat tamamlandıktan sonra kaydedilebilir.</p>
            )}
          </div>
        )}
      </div>

      {/* Footer: Approval */}
      {(canApprove() || pr.status === 'DRAFT') && (
        <div className="p-4 border-t border-white/10 shrink-0 space-y-3">
          {showReject ? (
            <div className="space-y-2">
              <textarea value={rejNote} onChange={e => setRejNote(e.target.value)} rows={2}
                placeholder="Red gerekçesi…"
                className="input-glass w-full px-3 py-2 text-sm rounded-xl resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setShowReject(false)} className="btn-secondary flex-1 py-2 text-sm rounded-xl">İptal</button>
                <button onClick={handleReject} disabled={!rejNote.trim() || loading}
                  className="flex-1 py-2 bg-red-700 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">
                  Reddet
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {pr.status !== 'REJECTED' && pr.status !== 'CLOSED' && (
                <button onClick={() => setShowReject(true)}
                  className="flex-1 py-2 border border-red-500/50 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-900/20 transition-colors">
                  Reddet
                </button>
              )}
              {canApprove() && (
                <button onClick={handleApprove} disabled={loading}
                  className="flex-1 py-2 btn-primary text-sm rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  Onayla → {STATUS_CONFIG[{
                    PENDING_UNIT: 'PENDING_PROCUREMENT',
                    PENDING_PROCUREMENT: 'PENDING_GM',
                    PENDING_GM: 'PO_ISSUED',
                  }[pr.status as string] as PurchaseStatus ?? pr.status]?.label ?? ''}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ── PRForm (Yeni Talep Modalı) ────────────────────────────────────────────────

interface PRFormProps {
  projects: Project[];
  units: Unit[];
  currentUserId?: string;
  currentUserName?: string;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

const PRForm: React.FC<PRFormProps> = ({ projects, units, currentUserId, currentUserName, onSave, onClose }) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    sourceType: 'MANUAL' as string,
    projectId: '',
    unitId: '',
    unitName: '',
    urgency: 'NORMAL' as PurchaseUrgency,
    neededBy: '',
    budgetAmount: '',
    currency: 'TRY',
    notes: '',
  });
  const [items, setItems] = useState([{ name: '', quantity: '1', unit: 'adet', estimatedUnitPrice: '', currency: 'TRY' }]);

  const addItem = () => setItems(is => [...is, { name: '', quantity: '1', unit: 'adet', estimatedUnitPrice: '', currency: 'TRY' }]);
  const removeItem = (i: number) => setItems(is => is.filter((_, idx) => idx !== i));
  const updateItem = (i: number, k: string, v: string) => setItems(is => is.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const handleUnitChange = (id: string) => {
    const u = units.find(u => u.id === id);
    setForm(f => ({ ...f, unitId: id, unitName: u?.name ?? '' }));
  };

  const handleSubmit = () => {
    onSave({
      ...form,
      budgetAmount: form.budgetAmount ? Number(form.budgetAmount) : undefined,
      requestedBy: currentUserId,
      requestedByName: currentUserName,
      items: items.filter(i => i.name.trim()).map(i => ({
        ...i,
        quantity: Number(i.quantity),
        estimatedUnitPrice: i.estimatedUnitPrice ? Number(i.estimatedUnitPrice) : undefined,
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <h4 className="text-lg font-bold">Yeni Satınalma Talebi</h4>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Başlık *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Kısa, açıklayıcı başlık"
              className="input-glass w-full px-3 py-2 text-sm rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Kaynak</label>
              <select value={form.sourceType} onChange={e => setForm(f => ({ ...f, sourceType: e.target.value }))}
                className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Aciliyet</label>
              <select value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value as PurchaseUrgency }))}
                className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                {Object.entries(URGENCY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Birim</label>
              <select value={form.unitId} onChange={e => handleUnitChange(e.target.value)}
                className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                <option value="">Birim seçin…</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">İlgili Proje</label>
              <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                <option value="">Proje seçin…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Gereksinim Tarihi</label>
              <input type="date" value={form.neededBy} onChange={e => setForm(f => ({ ...f, neededBy: e.target.value }))}
                className="input-glass w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Bütçe</label>
              <div className="flex gap-1">
                <input type="number" value={form.budgetAmount} onChange={e => setForm(f => ({ ...f, budgetAmount: e.target.value }))}
                  className="input-glass flex-1 px-3 py-2 text-sm rounded-l-xl" placeholder="0" />
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="input-glass px-2 py-2 text-sm rounded-r-xl">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Açıklama</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="input-glass w-full px-3 py-2 text-sm rounded-xl resize-none" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Kalemler</label>
              <button onClick={addItem} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold">
                <Plus size={12} /> Ekle
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input value={item.name} onChange={e => updateItem(i, 'name', e.target.value)}
                    placeholder="Ürün/Hizmet adı" className="input-glass col-span-4 px-3 py-2 text-sm rounded-xl" />
                  <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                    className="input-glass col-span-2 px-3 py-2 text-sm rounded-xl" placeholder="Miktar" />
                  <input value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}
                    className="input-glass col-span-2 px-3 py-2 text-sm rounded-xl" placeholder="Birim" />
                  <input type="number" value={item.estimatedUnitPrice} onChange={e => updateItem(i, 'estimatedUnitPrice', e.target.value)}
                    className="input-glass col-span-3 px-3 py-2 text-sm rounded-xl" placeholder="Birim fiyat" />
                  <button onClick={() => removeItem(i)} className="col-span-1 p-2 text-slate-400 hover:text-red-400 flex justify-center">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-white/10 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary px-5 py-2 text-sm rounded-xl">İptal</button>
          <button onClick={handleSubmit} disabled={!form.title.trim()}
            className="btn-primary px-5 py-2 text-sm rounded-xl disabled:opacity-50">
            Talebi Oluştur
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── ProcurementModule (Ana Bileşen) ───────────────────────────────────────────

interface ProcurementModuleProps {
  projects?: Project[];
  units?: Unit[];
}

export const ProcurementModule: React.FC<ProcurementModuleProps> = ({ projects = [], units = [] }) => {
  const { currentUser } = useAuth();
  const [mainTab, setMainTab] = useState<'requests' | 'vendors' | 'summary'>('requests');
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedPR, setSelectedPR] = useState<PurchaseRequest | null>(null);
  const [showPRForm, setShowPRForm] = useState(false);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, vends] = await Promise.all([
        apiService.getPurchaseRequests(filterStatus ? { status: filterStatus } : undefined),
        apiService.getVendors(),
      ]);
      setRequests(reqs as PurchaseRequest[]);
      setVendors(vends as Vendor[]);
      if (selectedPR) {
        const updated = (reqs as PurchaseRequest[]).find(r => r.id === selectedPR.id);
        if (updated) setSelectedPR(updated);
      }
    } finally { setLoading(false); }
  }, [filterStatus, selectedPR?.id]);

  useEffect(() => { loadData(); }, [filterStatus]);

  const handleCreatePR = async (data: Record<string, unknown>) => {
    await apiService.createPurchaseRequest(data);
    setShowPRForm(false);
    loadData();
  };

  const handleDeletePR = async (id: string) => {
    if (!confirm('Bu talep silinsin mi?')) return;
    await apiService.deletePurchaseRequest(id);
    if (selectedPR?.id === id) setSelectedPR(null);
    loadData();
  };

  const handleSaveVendor = async (data: Record<string, unknown>) => {
    if (editVendor) {
      await apiService.updateVendor(editVendor.id, data);
    } else {
      await apiService.createVendor(data);
    }
    setShowVendorForm(false);
    setEditVendor(null);
    loadData();
  };

  const handleDeleteVendor = async (id: string) => {
    if (!confirm('Tedarikçi silinsin mi?')) return;
    await apiService.deleteVendor(id);
    loadData();
  };

  const filtered = requests.filter(r => {
    const q = search.toLowerCase();
    return !q || r.title.toLowerCase().includes(q) || r.selectedVendorName?.toLowerCase().includes(q) || r.unitName?.toLowerCase().includes(q);
  });

  // Özet hesaplamalar
  const totalBudget = requests.reduce((s, r) => s + (r.budgetAmountTRY ?? 0), 0);
  const pendingCount = requests.filter(r => ['PENDING_UNIT','PENDING_PROCUREMENT','PENDING_GM'].includes(r.status)).length;
  const activeCount = requests.filter(r => ['PO_ISSUED','IN_DELIVERY'].includes(r.status)).length;

  const statusDist = Object.keys(STATUS_CONFIG).map(s => ({
    status: s as PurchaseStatus,
    count: requests.filter(r => r.status === s).length,
  })).filter(x => x.count > 0);

  const urgencyDist = (['URGENT','HIGH','NORMAL','LOW'] as PurchaseUrgency[]).map(u => ({
    urgency: u,
    count: requests.filter(r => r.urgency === u && r.status !== 'CLOSED' && r.status !== 'REJECTED').length,
  })).filter(x => x.count > 0);

  const maxCount = Math.max(...statusDist.map(x => x.count), 1);

  return (
    <div className="flex h-full">
      {/* Main area */}
      <div className={`flex-1 p-6 overflow-y-auto transition-all ${selectedPR ? 'mr-[640px]' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Satınalma</h2>
            <p className="text-sm text-slate-400 mt-0.5">Talep, teklif, teslimat ve fatura takibi</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {mainTab === 'requests' && (
              <button onClick={() => setShowPRForm(true)} className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2">
                <Plus size={16} /> Yeni Talep
              </button>
            )}
            {mainTab === 'vendors' && (
              <button onClick={() => { setEditVendor(null); setShowVendorForm(true); }} className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2">
                <Plus size={16} /> Yeni Tedarikçi
              </button>
            )}
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Toplam Talep', value: requests.length, icon: <ShoppingCart size={20} />, color: 'text-indigo-400' },
            { label: 'Onay Bekleyen', value: pendingCount, icon: <Clock size={20} />, color: 'text-amber-400' },
            { label: 'Aktif / Teslimat', value: activeCount, icon: <Truck size={20} />, color: 'text-cyan-400' },
            { label: 'Toplam Bütçe', value: formatCurrency(totalBudget, 'TRY'), icon: <TrendingUp size={20} />, color: 'text-green-400' },
          ].map(c => (
            <div key={c.label} className="glass-card rounded-2xl p-4">
              <div className={`${c.color} mb-2`}>{c.icon}</div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1 w-fit">
          {[
            { key: 'requests', label: 'Talepler', icon: <ShoppingCart size={14} /> },
            { key: 'vendors',  label: 'Tedarikçiler', icon: <Building2 size={14} /> },
            { key: 'summary',  label: 'Özet', icon: <BarChart3 size={14} /> },
          ].map(t => (
            <button key={t.key} onClick={() => setMainTab(t.key as typeof mainTab)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${mainTab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Requests tab */}
        {mainTab === 'requests' && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Talep ara…"
                  className="input-glass w-full pl-9 pr-3 py-2 text-sm rounded-xl" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="input-glass px-3 py-2 text-sm rounded-xl">
                <option value="">Tüm Durumlar</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="flex justify-center py-12 text-slate-400"><RefreshCw size={20} className="animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Talep bulunamadı</p>
              </div>
            ) : (
              filtered.map(pr => (
                <div key={pr.id}
                  onClick={() => setSelectedPR(prev => prev?.id === pr.id ? null : pr)}
                  className={`glass-card rounded-2xl p-4 cursor-pointer transition-all hover:border-indigo-500/40 ${selectedPR?.id === pr.id ? 'border-indigo-500/60 ring-1 ring-indigo-500/30' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <StatusBadge status={pr.status} />
                        <span className={`text-xs font-semibold ${URGENCY_CONFIG[pr.urgency].color}`}>{URGENCY_CONFIG[pr.urgency].label}</span>
                        <span className="text-xs text-slate-500">{SOURCE_LABEL[pr.sourceType]}</span>
                        {pr.poNumber && <span className="text-xs bg-indigo-900/40 text-indigo-300 px-2 py-0.5 rounded-full font-medium">{pr.poNumber}</span>}
                      </div>
                      <h4 className="font-semibold text-sm truncate">{pr.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {pr.unitName && <span>{pr.unitName} · </span>}
                        {pr.selectedVendorName && <span>Tedarikçi: {pr.selectedVendorName} · </span>}
                        {formatDate(pr.createdAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {pr.budgetAmountTRY && <p className="font-bold text-sm">{formatCurrency(pr.budgetAmountTRY, 'TRY')}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">{pr.items.length} kalem</p>
                    </div>
                  </div>
                  {pr.status !== 'CLOSED' && pr.status !== 'REJECTED' && (
                    <div className="mt-2 flex justify-end">
                      <button onClick={e => { e.stopPropagation(); handleDeletePR(pr.id); }}
                        className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
                        <Trash2 size={12} /> Sil
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Vendors tab */}
        {mainTab === 'vendors' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vendors.length === 0 && !loading && (
              <div className="col-span-2 text-center py-12 text-slate-400">
                <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Henüz tedarikçi eklenmedi.</p>
              </div>
            )}
            {vendors.map(v => {
              const cats: string[] = v.categories ? (typeof v.categories === 'string' ? JSON.parse(v.categories) : v.categories) : [];
              return (
                <div key={v.id} className="glass-card rounded-2xl p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold">{v.name}</h4>
                      {v.contactName && <p className="text-xs text-slate-400 mt-0.5">{v.contactName}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditVendor(v); setShowVendorForm(true); }}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-slate-200">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDeleteVendor(v.id)}
                        className="p-1.5 hover:bg-red-900/20 rounded-lg transition-colors text-slate-400 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-slate-400">
                    {v.phone && <div className="flex items-center gap-1.5"><Phone size={11} />{v.phone}</div>}
                    {v.email && <div className="flex items-center gap-1.5"><Mail size={11} />{v.email}</div>}
                  </div>
                  {cats.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {cats.map(c => (
                        <span key={c} className="text-[11px] px-2 py-0.5 bg-indigo-900/30 text-indigo-300 rounded-full font-medium">{c}</span>
                      ))}
                    </div>
                  )}
                  {v.rating && (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} size={12} className={i < v.rating! ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Summary tab */}
        {mainTab === 'summary' && (
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-5">
              <h4 className="font-semibold mb-4 text-sm text-slate-300">Durum Dağılımı</h4>
              <div className="space-y-2">
                {statusDist.map(({ status, count }) => {
                  const cfg = STATUS_CONFIG[status];
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className={`text-xs w-36 shrink-0 font-semibold ${cfg.textColor}`}>{cfg.label}</span>
                      <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full ${cfg.bg.replace('bg-', 'bg-').replace('-100', '-500')}`}
                          style={{ width: `${(count / maxCount) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <h4 className="font-semibold mb-4 text-sm text-slate-300">Açık Taleplerde Aciliyet</h4>
              <div className="flex gap-4 items-end h-24">
                {urgencyDist.map(({ urgency, count }) => (
                  <div key={urgency} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-slate-300">{count}</span>
                    <div className="w-full rounded-t-lg bg-indigo-600/60" style={{ height: `${(count / Math.max(...urgencyDist.map(x => x.count), 1)) * 64}px` }} />
                    <span className={`text-[10px] font-semibold ${URGENCY_CONFIG[urgency].color}`}>{URGENCY_CONFIG[urgency].label}</span>
                  </div>
                ))}
                {urgencyDist.length === 0 && <p className="text-sm text-slate-400">Aktif talep yok.</p>}
              </div>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <h4 className="font-semibold mb-3 text-sm text-slate-300">Tedarikçi Sayısı</h4>
              <p className="text-3xl font-bold">{vendors.length}</p>
              <p className="text-xs text-slate-400 mt-1">aktif tedarikçi</p>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedPR && (
          <>
            <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px]" onClick={() => setSelectedPR(null)} />
            <PRDetailDrawer
              pr={selectedPR}
              vendors={vendors}
              currentUserRole={currentUser?.role}
              currentUserId={currentUser?.id}
              onClose={() => setSelectedPR(null)}
              onRefresh={loadData}
            />
          </>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showPRForm && (
          <PRForm
            projects={projects}
            units={units}
            currentUserId={currentUser?.id}
            currentUserName={currentUser?.name}
            onSave={handleCreatePR}
            onClose={() => setShowPRForm(false)}
          />
        )}
        {showVendorForm && (
          <VendorForm
            initial={editVendor ?? undefined}
            onSave={handleSaveVendor}
            onClose={() => { setShowVendorForm(false); setEditVendor(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProcurementModule;
