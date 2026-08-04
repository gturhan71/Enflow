import { useState, type FC } from 'react';
import {
  X, Check, RefreshCw, Printer,
} from 'lucide-react';
import { motion } from 'motion/react';
import { apiService } from '../../services/apiService';
import { fmtCurrencyOrDash as formatCurrency } from '../../lib/format';
import {
  Vendor, PurchaseRequest, PurchaseStatus, PurchaseItem, PurchaseQuote, DeliveryRecord,
} from '../../types';
import { STATUS_CONFIG, URGENCY_CONFIG, SOURCE_LABEL, CURRENCIES, formatDate } from './constants';
import StatusBadge from './StatusBadge';

interface PRDetailDrawerProps {
  pr: PurchaseRequest;
  vendors: Vendor[];
  currentUserRole?: string;
  currentUserId?: string;
  onClose: () => void;
  onRefresh: () => void;
}

const PRDetailDrawer: FC<PRDetailDrawerProps> = ({ pr, vendors, currentUserRole, currentUserId, onClose, onRefresh }) => {
  const [tab, setTab] = useState<'info' | 'quotes' | 'delivery' | 'invoice'>('info');
  const [loading, setLoading] = useState(false);
  const [rejNote, setRejNote] = useState('');
  const [showReject, setShowReject] = useState(false);

  const [quoteForm, setQuoteForm] = useState({ vendorId: '', vendorName: '', totalAmount: '', currency: 'TRY', totalAmountTRY: '', deliveryDays: '', validUntil: '', notes: '' });
  const [deliveryForm, setDeliveryForm] = useState({ deliveredAt: new Date().toISOString().split('T')[0], receivedBy: '', quantityOrdered: '', quantityReceived: '', quantityDamaged: '', status: 'RECEIVED', notes: '' });
  const [invoiceForm, setInvoiceForm] = useState({ invoiceNo: pr.invoiceNo ?? '', invoiceAmount: pr.invoiceAmount?.toString() ?? '', invoiceDate: pr.invoiceDate?.split('T')[0] ?? '', invoicePaidAt: pr.invoicePaidAt?.split('T')[0] ?? '' });

  const canApprove = () => {
    if (pr.status === 'PENDING_UNIT' && (currentUserRole === 'SALES_MGR' || currentUserRole === 'GENERAL_MANAGER')) return true;
    if (pr.status === 'PENDING_PROCUREMENT' && (currentUserRole === 'PROCUREMENT_MGR' || currentUserRole === 'GENERAL_MANAGER')) return true;
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

  const handleResubmit = async () => {
    setLoading(true);
    try {
      await apiService.resubmitPurchaseRequest(pr.id);
      onRefresh();
    } finally { setLoading(false); }
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
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{item.name}</p>
                        {item.description && <p className="text-xs text-slate-400">{item.description}</p>}
                        {item.refVendor && (
                          <p className="text-[11px] text-emerald-400 mt-0.5">Referans kaynak: {item.refVendor}{item.refSource ? ` (${item.refSource})` : ''}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-sm font-bold">{item.quantity} {item.unit}</p>
                        {item.estimatedUnitPrice != null && (
                          <p className="text-xs text-amber-300" title="BoM'dan gelen üretici/distribütör referans alış fiyatı">
                            Ref. alış: {formatCurrency(item.estimatedUnitPrice, item.currency)}/birim
                          </p>
                        )}
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
            {(() => {
              const topScoreId = pr.quotes.length
                ? pr.quotes.reduce((best, q) => (q.score ?? -1) > (best.score ?? -1) ? q : best, pr.quotes[0]).id
                : null;
              return pr.quotes.map((q: PurchaseQuote) => (
              <div key={q.id} className={`rounded-xl p-4 border ${q.isSelected ? 'border-green-500/50 bg-green-900/10' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{q.vendorName}</p>
                      {q.score != null && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${q.id === topScoreId ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-slate-300'}`} title="Fiyat %60 + tedarikçi puanı %25 + teslim süresi %15 ağırlıklı uygunluk skoru">
                        {q.id === topScoreId ? '★ ' : ''}Uygunluk: %{Math.round(q.score * 100)}
                        </span>
                      )}
                    </div>
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
              ));
            })()}

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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-400">
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
      {(canApprove() || pr.status === 'DRAFT' || pr.status === 'REJECTED') && (
        <div className="p-4 border-t border-white/10 shrink-0 space-y-3">
          {pr.status === 'REJECTED' ? (
            <div className="space-y-2">
              {pr.rejectionNote && (
                <p className="text-xs text-red-400">Red gerekçesi: {pr.rejectionNote}</p>
              )}
              <button onClick={handleResubmit} disabled={loading}
                className="w-full py-2 btn-primary text-sm rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : null}
                Revize Et &amp; Yeniden Gönder
              </button>
            </div>
          ) : showReject ? (
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
              {pr.status !== 'CLOSED' && (
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

export default PRDetailDrawer;
