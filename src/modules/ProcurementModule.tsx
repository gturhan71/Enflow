import { useState, useEffect, useCallback, type FC } from 'react';
import {
  ShoppingCart, Building2, BarChart3, Plus, RefreshCw, Truck, Clock, TrendingUp,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { fmtCurrencyOrDash as formatCurrency } from '../lib/format';
import {
  Vendor, PurchaseRequest, PurchaseStatus, PurchaseUrgency, Project, Unit,
} from '../types';
import { STATUS_CONFIG } from './procurement/constants';
import RequestsTab from './procurement/RequestsTab';
import VendorsTab from './procurement/VendorsTab';
import SummaryTab from './procurement/SummaryTab';
import PRDetailDrawer from './procurement/PRDetailDrawer';
import PRForm from './procurement/PRForm';
import VendorForm from './procurement/VendorForm';

interface ProcurementModuleProps {
  projects?: Project[];
  units?: Unit[];
  initialItemId?: string | null;
}

export const ProcurementModule: FC<ProcurementModuleProps> = ({ projects = [], units = [], initialItemId }) => {
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

  // Deep-link: bildirim/görev "Git" ile gelen satınalma talebini otomatik aç.
  useEffect(() => {
    if (!initialItemId) return;
    const pr = requests.find(r => r.id === initialItemId);
    if (pr) { setMainTab('requests'); setSelectedPR(pr); }
  }, [initialItemId, requests]);

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

        {mainTab === 'requests' && (
          <RequestsTab
            search={search}
            setSearch={setSearch}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            loading={loading}
            filtered={filtered}
            selectedPR={selectedPR}
            setSelectedPR={setSelectedPR}
            onDelete={handleDeletePR}
          />
        )}

        {mainTab === 'vendors' && (
          <VendorsTab
            vendors={vendors}
            loading={loading}
            onEdit={(v) => { setEditVendor(v); setShowVendorForm(true); }}
            onDelete={handleDeleteVendor}
          />
        )}

        {mainTab === 'summary' && (
          <SummaryTab
            statusDist={statusDist}
            urgencyDist={urgencyDist}
            maxCount={maxCount}
            vendorsCount={vendors.length}
          />
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
