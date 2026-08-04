import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Package, FileSignature, Coins, ShoppingCart, Scale, Plus, Trash2, X, Pencil,
  RefreshCw, AlertTriangle, CheckCircle2, Settings2, Ban,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { fmtCurrency as fmt } from '../lib/format';
import type {
  DmoCatalogItem, DmoFrameworkAgreement, DmoExchangeRate, DmoOrder, DmoOrderItem,
  DmoCostParams, DmoReconciliation,
} from '../types';

const pct = (n: number) => `%${Math.round((n || 0) * 100)}`;

type TabKey = 'orders' | 'catalog' | 'agreements' | 'rates' | 'reconciliation';
const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'orders', label: 'Siparişler', icon: <ShoppingCart size={16} /> },
  { key: 'catalog', label: 'Katalog', icon: <Package size={16} /> },
  { key: 'agreements', label: 'Çerçeve Anlaşmalar', icon: <FileSignature size={16} /> },
  { key: 'rates', label: 'Döviz Kurları', icon: <Coins size={16} /> },
  { key: 'reconciliation', label: 'Risturn Mutabakatı', icon: <Scale size={16} /> },
];

const ORDER_STATUS: Record<string, { label: string; badge: string }> = {
  EVALUATION: { label: 'Değerlendirme', badge: 'bg-slate-100 text-slate-600' },
  CONFIRMED: { label: 'Onaylandı', badge: 'bg-indigo-100 text-indigo-700' },
  IN_DELIVERY: { label: 'Sevkiyatta', badge: 'bg-sky-100 text-sky-700' },
  DELIVERED: { label: 'Teslim Edildi', badge: 'bg-emerald-100 text-emerald-700' },
  INVOICED: { label: 'Faturalandı', badge: 'bg-teal-100 text-teal-700' },
  CLOSED: { label: 'Kapandı', badge: 'bg-slate-200 text-slate-500' },
  REJECTED: { label: 'Reddedildi', badge: 'bg-red-100 text-red-600' },
  CANCELLED: { label: 'İptal', badge: 'bg-red-100 text-red-500' },
};
const NEXT_STATUS: Record<string, string> = {
  EVALUATION: 'CONFIRMED', CONFIRMED: 'IN_DELIVERY', IN_DELIVERY: 'DELIVERED', DELIVERED: 'INVOICED', INVOICED: 'CLOSED',
};

export function DmoModule() {
  const { currentUser } = useAuth();
  const canEdit = currentUser?.role === 'GENERAL_MANAGER' || (currentUser?.permissions?.includes('DMO_EDIT') ?? false);
  const [tab, setTab] = useState<TabKey>('orders');
  const [catalog, setCatalog] = useState<DmoCatalogItem[]>([]);
  const [agreements, setAgreements] = useState<DmoFrameworkAgreement[]>([]);
  const [rates, setRates] = useState<DmoExchangeRate[]>([]);
  const [orders, setOrders] = useState<DmoOrder[]>([]);
  const [alarms, setAlarms] = useState<DmoOrder[]>([]);
  const [recon, setRecon] = useState<DmoReconciliation | null>(null);
  const [params, setParams] = useState<DmoCostParams | null>(null);
  const [selected, setSelected] = useState<DmoOrder | null>(null);
  const [showParams, setShowParams] = useState(false);
  const [form, setForm] = useState<{ kind: 'catalog' | 'agreement' | 'rate' | 'order'; data?: unknown } | null>(null);

  const load = useCallback(async () => {
    const [c, a, r, o, al, rc] = await Promise.all([
      apiService.getDmoCatalog(), apiService.getDmoAgreements(), apiService.getDmoRates(),
      apiService.getDmoOrders(), apiService.getDmoAlarms(), apiService.getDmoReconciliation(),
    ]);
    setCatalog(c); setAgreements(a); setRates(r); setOrders(o); setAlarms(al); setRecon(rc);
    if (!params) apiService.getDmoSettings().then(setParams).catch(() => {});
  }, [params]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshOrder = async (id: string) => {
    const o = await apiService.getDmoOrders();
    setOrders(o); setSelected(o.find(x => x.id === id) || null);
    apiService.getDmoAlarms().then(setAlarms); apiService.getDmoReconciliation().then(setRecon);
  };

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">DMO Kataloğu</h2>
          <p className="text-sm text-slate-400 mt-0.5">Devlet Malzeme Ofisi satıcı kanalı — katalog, sipariş ve kârlılık</p>
        </div>
        <div className="flex items-center gap-2">
          {alarms.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-black text-red-600 bg-red-50 px-3 py-1.5 rounded-xl">
              <AlertTriangle size={14} /> {alarms.length} kârsız sipariş
            </span>
          )}
          {canEdit && <button onClick={() => setShowParams(true)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500" title="Maliyet parametreleri"><Settings2 size={18} /></button>}
          <button onClick={load} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><RefreshCw size={16} /></button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors ${tab === t.key ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'orders' && <OrdersTab orders={orders} canEdit={canEdit} onNew={() => setForm({ kind: 'order' })} onSelect={setSelected} />}
      {tab === 'catalog' && <CatalogTab items={catalog} canEdit={canEdit} onNew={() => setForm({ kind: 'catalog' })} onEdit={d => setForm({ kind: 'catalog', data: d })} onDelete={async id => { await apiService.deleteDmoCatalog(id); load(); }} />}
      {tab === 'agreements' && <AgreementsTab items={agreements} canEdit={canEdit} onNew={() => setForm({ kind: 'agreement' })} onEdit={d => setForm({ kind: 'agreement', data: d })} onDelete={async id => { await apiService.deleteDmoAgreement(id); load(); }} />}
      {tab === 'rates' && <RatesTab items={rates} canEdit={canEdit} onNew={() => setForm({ kind: 'rate' })} onEdit={d => setForm({ kind: 'rate', data: d })} onDelete={async id => { await apiService.deleteDmoRate(id); load(); }} />}
      {tab === 'reconciliation' && <ReconciliationTab recon={recon} />}

      {selected && <OrderDrawer order={selected} canEdit={canEdit} onClose={() => setSelected(null)} onChanged={() => refreshOrder(selected.id)} />}
      {form?.kind === 'order' && <OrderForm agreements={agreements} catalog={catalog} rates={rates} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      {form?.kind === 'catalog' && <CatalogForm agreements={agreements} rates={rates} initial={form.data as DmoCatalogItem | undefined} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      {form?.kind === 'agreement' && <AgreementForm initial={form.data as DmoFrameworkAgreement | undefined} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      {form?.kind === 'rate' && <RateForm initial={form.data as DmoExchangeRate | undefined} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      {showParams && params && <ParamsModal params={params} onClose={() => setShowParams(false)} onSaved={p => { setParams(p); setShowParams(false); load(); }} />}
    </div>
  );
}

// ── Siparişler ───────────────────────────────────────────────────────────────
function OrdersTab({ orders, canEdit, onNew, onSelect }: { orders: DmoOrder[]; canEdit: boolean; onNew: () => void; onSelect: (o: DmoOrder) => void }) {
  return (
    <div className="space-y-3">
      {canEdit && <button onClick={onNew} className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2"><Plus size={16} /> Yeni Sipariş / Fırsat</button>}
      {orders.length === 0 ? <p className="text-slate-400 italic text-sm">Sipariş yok.</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {orders.map(o => {
            const st = ORDER_STATUS[o.status] || { label: o.status, badge: 'bg-slate-100' };
            return (
              <button key={o.id} onClick={() => onSelect(o)} className="glass-card p-4 text-left hover:ring-2 hover:ring-primary/20 transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800 text-sm truncate">{o.orderNo} · {o.institutionName}</span>
                  <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded ${st.badge}`}>{st.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">Ciro: <b className="text-slate-700">{fmt(o.revenueTotal)}</b></span>
                  <span className={o.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>Net: <b>{fmt(o.netProfit)}</b> ({pct(o.netMarginPct)})</span>
                  {!o.isProfitable && <span className="flex items-center gap-1 text-red-600 font-bold"><AlertTriangle size={12} /> KÂRSIZ</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sipariş Detayı + Maliyetlendirme paneli ──────────────────────────────────
function OrderDrawer({ order, canEdit, onClose, onChanged }: { order: DmoOrder; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const st = ORDER_STATUS[order.status] || { label: order.status, badge: 'bg-slate-100' };
  const next = NEXT_STATUS[order.status];
  const recost = async () => { setBusy(true); try { await apiService.recostDmoOrder(order.id); onChanged(); } finally { setBusy(false); } };
  const advance = async (status: string) => { setBusy(true); try { await apiService.advanceDmoOrderStatus(order.id, status); onChanged(); } finally { setBusy(false); } };
  const Row = ({ label, value, cls = '' }: { label: string; value: string; cls?: string }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span><span className={`text-sm font-bold ${cls}`}>{value}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose}>
      <div className="w-[540px] max-w-full h-full bg-white shadow-2xl overflow-y-auto p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900">{order.orderNo}</h3>
            <p className="text-sm text-slate-500">{order.institutionName}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>
        <span className={`inline-block text-[10px] font-black uppercase px-2 py-1 rounded ${st.badge}`}>{st.label}</span>

        {order.alarmReason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div><p className="text-xs font-black text-red-700 uppercase">Kârlılık Alarmı</p><p className="text-xs text-red-600 mt-0.5">{order.alarmReason}</p></div>
          </div>
        )}

        {/* Maliyetlendirme dökümü */}
        <div className="glass-card p-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Maliyetlendirme (o anki koşullar)</h4>
          <Row label="Ciro (satış)" value={fmt(order.revenueTotal)} />
          <Row label="Maliyet (piyasa kuru)" value={`− ${fmt(order.costTotal)}`} />
          <Row label="Brüt Kâr" value={fmt(order.grossProfit)} cls={order.grossProfit >= 0 ? 'text-slate-800' : 'text-red-600'} />
          <Row label={`Risturn (${pct(order.risturnRateApplied)})`} value={`− ${fmt(order.risturnDeduction)}`} cls="text-amber-600" />
          <Row label={`Komisyon (${order.commissionType === 'PERCENT' ? `%${order.commissionValue} ${order.commissionBasis === 'PROFIT' ? 'kâr' : 'ciro'}` : 'sabit'})`} value={`− ${fmt(order.commissionDeduction)}`} cls="text-amber-600" />
          <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-slate-200">
            <span className="text-sm font-black text-slate-700">NET KÂR</span>
            <span className={`text-lg font-black ${order.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(order.netProfit)} · {pct(order.netMarginPct)}</span>
          </div>
          {order.rateCurrency && (
            <p className="text-[10px] text-slate-400 mt-2 italic">
              DMO kuru: 1 {order.rateCurrency} = {order.dmoRateSnapshot} TRY
              {order.rateValidTo ? ` · geçerlilik ${new Date(order.rateValidTo).toLocaleDateString('tr-TR')}` : ' · süre belirsiz'}
            </p>
          )}
        </div>

        {/* Kalemler */}
        <div className="glass-card p-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Kalemler</h4>
          {order.items.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
              <span className="text-slate-600 truncate">{it.name} × {it.qty}</span>
              <span className="text-slate-500">satış {it.unitPrice} {it.sellCurrency} · maliyet {it.unitCost} {it.costCurrency}</span>
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button onClick={recost} disabled={busy} className="btn-secondary px-3 py-2 text-xs rounded-xl flex items-center gap-1"><RefreshCw size={13} /> Yeniden Hesapla</button>
            {order.status === 'EVALUATION' && <button onClick={() => advance('REJECTED')} disabled={busy} className="px-3 py-2 text-xs rounded-xl flex items-center gap-1 bg-red-50 text-red-600 font-bold hover:bg-red-100"><Ban size={13} /> Reddet</button>}
            {next && order.status !== 'REJECTED' && (
              <button onClick={() => advance(next)} disabled={busy} className="btn-primary px-3 py-2 text-xs rounded-xl flex items-center gap-1">
                <CheckCircle2 size={13} /> {ORDER_STATUS[next].label}'e ilerlet
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Katalog ──────────────────────────────────────────────────────────────────
function CatalogTab({ items, canEdit, onNew, onEdit, onDelete }: { items: DmoCatalogItem[]; canEdit: boolean; onNew: () => void; onEdit: (d: DmoCatalogItem) => void; onDelete: (id: string) => void }) {
  return (
    <div className="space-y-3">
      {canEdit && <button onClick={onNew} className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2"><Plus size={16} /> Yeni Kalem</button>}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400"><tr>
            <th className="text-left p-3">Kod / Ad</th><th className="text-right p-3">Liste Fiyatı</th><th className="text-right p-3">Maliyet</th><th className="p-3">Durum</th>{canEdit && <th></th>}
          </tr></thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} className="border-t border-slate-100">
                <td className="p-3"><b className="text-slate-700">{it.dmoCode}</b> · {it.name}</td>
                <td className="p-3 text-right">{fmt(it.listPrice, it.currency)}</td>
                <td className="p-3 text-right text-slate-500">{fmt(it.unitCost, it.costCurrency)}</td>
                <td className="p-3 text-center"><span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">{it.status}</span></td>
                {canEdit && <td className="p-3 text-right whitespace-nowrap"><button onClick={() => onEdit(it)} className="p-1 text-slate-400 hover:text-primary"><Pencil size={14} /></button><button onClick={() => onDelete(it.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button></td>}
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400 italic">Katalog boş.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Çerçeve Anlaşmalar ───────────────────────────────────────────────────────
function AgreementsTab({ items, canEdit, onNew, onEdit, onDelete }: { items: DmoFrameworkAgreement[]; canEdit: boolean; onNew: () => void; onEdit: (d: DmoFrameworkAgreement) => void; onDelete: (id: string) => void }) {
  return (
    <div className="space-y-3">
      {canEdit && <button onClick={onNew} className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2"><Plus size={16} /> Yeni Anlaşma</button>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map(a => {
          const usedPct = a.quotaTotal ? Math.min(1, a.quotaUsed / a.quotaTotal) : 0;
          return (
            <div key={a.id} className="glass-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">{a.agreementNo} · {a.title}</span>
                {canEdit && <span className="flex gap-1"><button onClick={() => onEdit(a)} className="p-1 text-slate-400 hover:text-primary"><Pencil size={14} /></button><button onClick={() => onDelete(a.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button></span>}
              </div>
              {a.quotaTotal != null && (
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-slate-400"><span>Kota</span><span>{fmt(a.quotaUsed)} / {fmt(a.quotaTotal)}</span></div>
                  <div className="bg-slate-100 rounded h-2 mt-1 overflow-hidden"><div className={`h-full ${usedPct > 0.9 ? 'bg-red-500' : 'bg-primary/70'}`} style={{ width: `${usedPct * 100}%` }} /></div>
                </div>
              )}
              <span className="inline-block mt-2 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">{a.status}</span>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-slate-400 italic text-sm">Anlaşma yok.</p>}
      </div>
    </div>
  );
}

// ── Döviz Kurları ────────────────────────────────────────────────────────────
function RatesTab({ items, canEdit, onNew, onEdit, onDelete }: { items: DmoExchangeRate[]; canEdit: boolean; onNew: () => void; onEdit: (d: DmoExchangeRate) => void; onDelete: (id: string) => void }) {
  const now = Date.now();
  return (
    <div className="space-y-3">
      {canEdit && <button onClick={onNew} className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2"><Plus size={16} /> Yeni Kur</button>}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400"><tr>
            <th className="text-left p-3">Para Birimi</th><th className="text-right p-3">DMO Kuru (TRY)</th><th className="p-3">Geçerlilik</th>{canEdit && <th></th>}
          </tr></thead>
          <tbody>
            {items.map(r => {
              const expired = r.validTo && new Date(r.validTo).getTime() < now;
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-3 font-bold text-slate-700">{r.currency}</td>
                  <td className="p-3 text-right">{r.rate}</td>
                  <td className="p-3 text-center text-xs">
                    {new Date(r.validFrom).toLocaleDateString('tr-TR')} → {r.validTo ? new Date(r.validTo).toLocaleDateString('tr-TR') : 'belirsiz'}
                    {expired && <span className="ml-1 text-[9px] font-black text-red-600">SÜRESİ DOLMUŞ</span>}
                  </td>
                  {canEdit && <td className="p-3 text-right whitespace-nowrap"><button onClick={() => onEdit(r)} className="p-1 text-slate-400 hover:text-primary"><Pencil size={14} /></button><button onClick={() => onDelete(r.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button></td>}
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400 italic">Kur kaydı yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Risturn Mutabakatı ───────────────────────────────────────────────────────
function ReconciliationTab({ recon }: { recon: DmoReconciliation | null }) {
  if (!recon) return <p className="text-slate-400 italic text-sm">Yükleniyor…</p>;
  return (
    <div className="glass-card p-6 space-y-4 max-w-2xl">
      <h4 className="font-black text-slate-900 uppercase italic tracking-tighter">Risturn Dönem Mutabakatı</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sipariş</p><p className="text-2xl font-black text-slate-800">{recon.orderCount}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Toplam Ciro</p><p className="text-lg font-black text-slate-800">{fmt(recon.totalTurnover)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Gerçek Oran</p><p className="text-2xl font-black text-primary">{pct(recon.actualRate)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Fark</p><p className={`text-lg font-black ${Math.abs(recon.difference) < 1 ? 'text-emerald-600' : 'text-amber-600'}`}>{fmt(recon.difference)}</p></div>
      </div>
      <div className="text-sm space-y-1 pt-2 border-t border-slate-100">
        <div className="flex justify-between"><span className="text-slate-500">Gerçek risturn (dönem cirosu × kademe)</span><b>{fmt(recon.actualRisturn)}</b></div>
        <div className="flex justify-between"><span className="text-slate-500">Tahakkuk eden (siparişlere yansıyan)</span><b>{fmt(recon.accruedRisturn)}</b></div>
        <div className="flex justify-between"><span className="text-slate-500">Dönem sonu düzeltmesi</span><b className={Math.abs(recon.difference) < 1 ? 'text-emerald-600' : 'text-amber-600'}>{fmt(recon.difference)}</b></div>
      </div>
      <p className="text-[10px] text-slate-400 italic">{recon.note}</p>
    </div>
  );
}

// ── Formlar ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, size = 'lg' }: { title: string; onClose: () => void; children: React.ReactNode; size?: 'lg' | 'xl' | '4xl' }) {
  const w = size === '4xl' ? 'max-w-4xl' : size === 'xl' ? 'max-w-xl' : 'max-w-lg';
  // Portal → body: modülün transform'lu üst-kapsayıcısı fixed'i hapsetmesin (tam viewport ortalama).
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${w} max-h-[90vh] overflow-y-auto p-6 space-y-4`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-black text-slate-900">{title}</h3><button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X size={18} /></button></div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>{children}</label>
);
const inp = 'input-glass w-full mt-1 text-sm';

function CatalogForm({ initial, agreements, rates, onClose, onSaved }: { initial?: DmoCatalogItem; agreements: DmoFrameworkAgreement[]; rates: DmoExchangeRate[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ dmoCode: initial?.dmoCode || '', name: initial?.name || '', unit: initial?.unit || 'ADET', listPrice: initial?.listPrice ?? 0, currency: initial?.currency || 'TRY', unitCost: initial?.unitCost ?? 0, costCurrency: initial?.costCurrency || 'TRY', category: initial?.category || '', frameworkAgreementId: initial?.frameworkAgreementId || '' });
  // Satış (DMO kuru) + alış maliyeti için döviz seçenekleri: TRY + tanımlı DMO kurları
  const currencyOpts = [...new Set(['TRY', ...rates.map(r => r.currency), f.currency, f.costCurrency])].filter(Boolean);
  const save = async () => { const d = { ...f, frameworkAgreementId: f.frameworkAgreementId || null }; if (initial) await apiService.updateDmoCatalog(initial.id, d); else await apiService.createDmoCatalog(d); onSaved(); };
  return (
    <Modal title={initial ? 'Katalog Kalemi Düzenle' : 'Yeni Katalog Kalemi'} onClose={onClose}>
      <Field label="DMO Kodu"><input className={inp} value={f.dmoCode} onChange={e => setF({ ...f, dmoCode: e.target.value })} /></Field>
      <Field label="Ad"><input className={inp} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Satış Fiyatı (DMO)"><input type="number" className={inp} value={f.listPrice} onChange={e => setF({ ...f, listPrice: Number(e.target.value) })} /></Field>
        <Field label="Satış Dövizi"><select className={inp} value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })}>{currencyOpts.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Alış Maliyeti"><input type="number" className={inp} value={f.unitCost} onChange={e => setF({ ...f, unitCost: Number(e.target.value) })} /></Field>
        <Field label="Alış Dövizi"><select className={inp} value={f.costCurrency} onChange={e => setF({ ...f, costCurrency: e.target.value })}>{currencyOpts.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
      </div>
      <Field label="Çerçeve Anlaşma"><select className={inp} value={f.frameworkAgreementId} onChange={e => setF({ ...f, frameworkAgreementId: e.target.value })}><option value="">—</option>{agreements.map(a => <option key={a.id} value={a.id}>{a.agreementNo}</option>)}</select></Field>
      <p className="text-[10px] text-slate-400 italic">Döviz seçenekleri Döviz Kurları sekmesinden gelir; yeni bir para birimi için önce oradan DMO kurunu ekleyin.</p>
      <button onClick={save} className="btn-primary w-full py-2 rounded-xl text-sm">Kaydet</button>
    </Modal>
  );
}

function AgreementForm({ initial, onClose, onSaved }: { initial?: DmoFrameworkAgreement; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ agreementNo: initial?.agreementNo || '', title: initial?.title || '', quotaTotal: initial?.quotaTotal ?? 0, status: initial?.status || 'ACTIVE' });
  const save = async () => { if (initial) await apiService.updateDmoAgreement(initial.id, f); else await apiService.createDmoAgreement(f); onSaved(); };
  return (
    <Modal title={initial ? 'Anlaşma Düzenle' : 'Yeni Çerçeve Anlaşma'} onClose={onClose}>
      <Field label="Anlaşma No"><input className={inp} value={f.agreementNo} onChange={e => setF({ ...f, agreementNo: e.target.value })} /></Field>
      <Field label="Başlık"><input className={inp} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Kota (TRY)"><input type="number" className={inp} value={f.quotaTotal} onChange={e => setF({ ...f, quotaTotal: Number(e.target.value) })} /></Field>
      <Field label="Durum"><select className={inp} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'].map(s => <option key={s}>{s}</option>)}</select></Field>
      <button onClick={save} className="btn-primary w-full py-2 rounded-xl text-sm">Kaydet</button>
    </Modal>
  );
}

function RateForm({ initial, onClose, onSaved }: { initial?: DmoExchangeRate; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ currency: initial?.currency || 'USD', rate: initial?.rate ?? 0, validFrom: initial?.validFrom?.slice(0, 10) || new Date().toISOString().slice(0, 10), validTo: initial?.validTo?.slice(0, 10) || '', source: initial?.source || '' });
  const save = async () => { const d = { ...f, validTo: f.validTo || null }; if (initial) await apiService.updateDmoRate(initial.id, d); else await apiService.createDmoRate(d); onSaved(); };
  return (
    <Modal title={initial ? 'Kur Düzenle' : 'Yeni DMO Kuru'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Para Birimi"><input className={inp} value={f.currency} onChange={e => setF({ ...f, currency: e.target.value.toUpperCase() })} /></Field>
        <Field label="Kur (1 birim = ? TRY)"><input type="number" className={inp} value={f.rate} onChange={e => setF({ ...f, rate: Number(e.target.value) })} /></Field>
        <Field label="Geçerli (başlangıç)"><input type="date" className={inp} value={f.validFrom} onChange={e => setF({ ...f, validFrom: e.target.value })} /></Field>
        <Field label="Geçerli (bitiş, opsiyonel)"><input type="date" className={inp} value={f.validTo} onChange={e => setF({ ...f, validTo: e.target.value })} /></Field>
      </div>
      <p className="text-[10px] text-slate-400 italic">Bitiş boş bırakılırsa geçerlilik "belirsiz" kabul edilir.</p>
      <button onClick={save} className="btn-primary w-full py-2 rounded-xl text-sm">Kaydet</button>
    </Modal>
  );
}

const emptyItem = (): DmoOrderItem => ({ catalogItemId: null, name: '', qty: 1, unitPrice: 0, sellCurrency: 'TRY', unitCost: 0, costCurrency: 'TRY', vatRate: 20 });

function OrderForm({ agreements, catalog, rates, onClose, onSaved }: { agreements: DmoFrameworkAgreement[]; catalog: DmoCatalogItem[]; rates: DmoExchangeRate[]; onClose: () => void; onSaved: () => void }) {
  const [head, setHead] = useState({ orderNo: '', institutionName: '', frameworkAgreementId: '' });
  const [items, setItems] = useState<DmoOrderItem[]>([emptyItem()]);
  const setItem = (i: number, patch: Partial<DmoOrderItem>) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  // Seçili çerçeve anlaşmanın ürünleri (yoksa tüm katalog)
  const options = catalog.filter(c => !head.frameworkAgreementId || c.frameworkAgreementId === head.frameworkAgreementId);
  const currencyOpts = [...new Set(['TRY', ...rates.map(r => r.currency)])];
  const pickProduct = (i: number, catId: string) => {
    const c = options.find(x => x.id === catId);
    if (!c) { setItem(i, { catalogItemId: null, name: '' }); return; }
    setItem(i, { catalogItemId: c.id, name: c.name, unitPrice: c.listPrice, sellCurrency: c.currency, unitCost: c.unitCost, costCurrency: c.costCurrency });
  };
  const save = async () => {
    await apiService.createDmoOrder({ ...head, currency: items[0]?.sellCurrency || 'TRY', frameworkAgreementId: head.frameworkAgreementId || null, items });
    onSaved();
  };
  const costTotal = items.reduce((s, it) => s + it.qty * it.unitCost, 0);
  const cell = 'w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none';
  const th = 'text-[10px] font-black uppercase tracking-wider text-slate-500 px-1 pb-1';
  const noAgreement = !head.frameworkAgreementId;
  return (
    <Modal title="Yeni Sipariş / Fırsat" onClose={onClose} size="4xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Field label="Sipariş No"><input className={inp} value={head.orderNo} onChange={e => setHead({ ...head, orderNo: e.target.value })} /></Field>
        <Field label="Alıcı Kurum"><input className={inp} value={head.institutionName} onChange={e => setHead({ ...head, institutionName: e.target.value })} /></Field>
        <Field label="Çerçeve Anlaşma (ürünler buradan gelir)"><select className={inp} value={head.frameworkAgreementId} onChange={e => { setHead({ ...head, frameworkAgreementId: e.target.value }); setItems([emptyItem()]); }}><option value="">— Tüm katalog —</option>{agreements.map(a => <option key={a.id} value={a.id}>{a.agreementNo} · {a.title}</option>)}</select></Field>
      </div>

      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kalemler {head.frameworkAgreementId ? `(seçili anlaşma: ${options.length} ürün)` : '(tüm katalog)'}</span>
        <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-1.5 bg-slate-50 px-3 pt-2 pb-1 border-b border-slate-200 items-end">
            <div className={`${th} col-span-4`}>Ürün (katalogdan)</div>
            <div className={`${th} col-span-1 text-right`}>Adet</div>
            <div className={`${th} col-span-2 text-right`}>Birim Satış <span className="text-[8px] normal-case text-slate-400">(sabit)</span></div>
            <div className={`${th} col-span-1`}>Satış Dövizi</div>
            <div className={`${th} col-span-2 text-right`}>Birim Maliyet <span className="text-[8px] normal-case text-slate-400">(değişken)</span></div>
            <div className={`${th} col-span-1 text-right`}>Satır Satış</div>
            <div className={`${th} col-span-1`}></div>
          </div>
          {items.map((it, i) => {
            const locked = !!it.catalogItemId; // katalog ürünü → satış fiyatı/dövizi çerçeve anlaşmayla SABİT
            const lockedCell = 'w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-slate-100 text-slate-500 cursor-not-allowed';
            return (
            <div key={i} className="grid grid-cols-12 gap-1.5 px-3 py-1.5 items-center border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
              <select className={`${cell} col-span-4`} value={it.catalogItemId || ''} onChange={e => pickProduct(i, e.target.value)}>
                <option value="">{options.length ? '— ürün seçin —' : '— katalog boş —'}</option>
                {options.map(c => <option key={c.id} value={c.id}>{c.dmoCode} · {c.name}</option>)}
              </select>
              <input type="number" className={`${cell} col-span-1 text-right`} value={it.qty} onChange={e => setItem(i, { qty: Number(e.target.value) })} />
              <input type="number" title={locked ? 'Satış fiyatı çerçeve anlaşmayla sabittir' : ''} disabled={locked} className={`${locked ? lockedCell : cell} col-span-2 text-right`} value={it.unitPrice} onChange={e => setItem(i, { unitPrice: Number(e.target.value) })} />
              {locked
                ? <div className="col-span-1 text-xs font-bold text-slate-500 text-center">{it.sellCurrency} <span className="text-[8px]">🔒</span></div>
                : <select className={`${cell} col-span-1`} value={it.sellCurrency} onChange={e => setItem(i, { sellCurrency: e.target.value })}>{currencyOpts.map(c => <option key={c} value={c}>{c}</option>)}</select>}
              <input type="number" title="Alış maliyeti değişkendir — sipariş anındaki güncel maliyeti girin" className={`${cell} col-span-2 text-right`} value={it.unitCost} onChange={e => setItem(i, { unitCost: Number(e.target.value) })} />
              <div className="col-span-1 text-right text-xs font-bold text-slate-600 tabular-nums truncate">{fmt(it.qty * it.unitPrice, it.sellCurrency)}</div>
              <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="col-span-1 flex justify-center text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
            );
          })}
          <div className="grid grid-cols-12 gap-1.5 px-3 py-2 bg-slate-50 border-t border-slate-200 items-center">
            <div className="col-span-7 font-black text-slate-500 uppercase text-[10px] tracking-widest">Toplam ({items.length} kalem)</div>
            <div className="col-span-3 text-right text-[10px] text-slate-400">maliyet (nominal) <b className="text-slate-600 text-xs block">{fmt(costTotal)}</b></div>
            <div className="col-span-2"></div>
          </div>
        </div>
        <button onClick={() => setItems([...items, emptyItem()])} className="mt-2 text-xs text-primary font-bold flex items-center gap-1"><Plus size={13} /> Satır ekle</button>
      </div>

      <p className="text-[10px] text-slate-400 italic">
        Ürünler {noAgreement ? 'katalogdan' : 'seçili çerçeve anlaşmanın kataloğundan'} seçilir. <b>Satış fiyatı ve dövizi çerçeve anlaşmayla sabittir</b> (katalogdan gelir, kilitli 🔒); değiştirmek için katalog kalemini düzenleyin. <b>Alış maliyeti değişkendir</b> — sipariş anındaki güncel maliyeti girin. Kaydedince DMO satış kuru + maliyet piyasa kuru uygulanıp kârlılık hesaplanır, kârsızsa alarm üretilir.
      </p>
      <button onClick={save} className="btn-primary w-full py-2.5 rounded-xl text-sm font-bold">Oluştur & Maliyetlendir</button>
    </Modal>
  );
}

function ParamsModal({ params, onClose, onSaved }: { params: DmoCostParams; onClose: () => void; onSaved: (p: DmoCostParams) => void }) {
  const [minMargin, setMinMargin] = useState(Math.round(params.minMarginPct * 100));
  const [tiers, setTiers] = useState(params.risturnTiers.map(t => ({ thresholdMin: t.thresholdMin, rate: Math.round(t.rate * 100) })));
  const [comm, setComm] = useState(params.defaultCommission);
  const [fx, setFx] = useState(Object.entries(params.costFxRates).filter(([k]) => k !== 'TRY').map(([currency, rate]) => ({ currency, rate })));
  const save = async () => {
    const p = await apiService.updateDmoSettings({
      minMarginPct: minMargin / 100,
      risturnTiers: tiers.map(t => ({ thresholdMin: Number(t.thresholdMin), rate: Number(t.rate) / 100 })),
      defaultCommission: { ...comm, value: Number(comm.value) },
      costFxRates: Object.fromEntries(fx.map(r => [r.currency.toUpperCase(), Number(r.rate)])),
    });
    onSaved(p);
  };
  return (
    <Modal title="DMO Maliyet Parametreleri" onClose={onClose}>
      <Field label="Minimum Marj Eşiği (%) — altında alarm"><input type="number" className={inp} value={minMargin} onChange={e => setMinMargin(Number(e.target.value))} /></Field>
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Risturn Kademeleri (ciro eşiği → oran %)</span>
        {tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-12 gap-1 items-center mt-1">
            <input type="number" placeholder="Ciro eşiği" className={`${inp} col-span-6`} value={t.thresholdMin} onChange={e => setTiers(tiers.map((x, idx) => idx === i ? { ...x, thresholdMin: Number(e.target.value) } : x))} />
            <input type="number" placeholder="Oran %" className={`${inp} col-span-4`} value={t.rate} onChange={e => setTiers(tiers.map((x, idx) => idx === i ? { ...x, rate: Number(e.target.value) } : x))} />
            <button onClick={() => setTiers(tiers.filter((_, idx) => idx !== i))} className="col-span-2 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}
        <button onClick={() => setTiers([...tiers, { thresholdMin: 0, rate: 0 }])} className="text-xs text-primary font-bold flex items-center gap-1 mt-1"><Plus size={13} /> Kademe</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Komisyon Tipi"><select className={inp} value={comm.type} onChange={e => setComm({ ...comm, type: e.target.value as 'PERCENT' | 'FIXED' })}><option value="PERCENT">Oran %</option><option value="FIXED">Sabit</option></select></Field>
        <Field label="Değer"><input type="number" className={inp} value={comm.value} onChange={e => setComm({ ...comm, value: Number(e.target.value) })} /></Field>
        <Field label="Taban"><select className={inp} value={comm.basis} onChange={e => setComm({ ...comm, basis: e.target.value as 'REVENUE' | 'PROFIT' })}><option value="REVENUE">Ciro</option><option value="PROFIT">Kâr</option></select></Field>
      </div>
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Maliyet Kurları (piyasa, birim → TRY)</span>
        {fx.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-1 items-center mt-1">
            <input placeholder="USD" className={`${inp} col-span-5`} value={r.currency} onChange={e => setFx(fx.map((x, idx) => idx === i ? { ...x, currency: e.target.value } : x))} />
            <input type="number" placeholder="TRY" className={`${inp} col-span-5`} value={r.rate} onChange={e => setFx(fx.map((x, idx) => idx === i ? { ...x, rate: Number(e.target.value) } : x))} />
            <button onClick={() => setFx(fx.filter((_, idx) => idx !== i))} className="col-span-2 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}
        <button onClick={() => setFx([...fx, { currency: '', rate: 0 }])} className="text-xs text-primary font-bold flex items-center gap-1 mt-1"><Plus size={13} /> Kur</button>
      </div>
      <button onClick={save} className="btn-primary w-full py-2 rounded-xl text-sm">Kaydet</button>
    </Modal>
  );
}

export default DmoModule;
