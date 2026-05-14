import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileSearch, 
  FileText, 
  Plus, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  MoreVertical,
  X,
  ShoppingCart,
  Loader2,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { 
  MOCK_BOM_ITEMS,
} from '../constants';
import { 
  Opportunity,
  Unit,
  User
} from '../types';
import SpecAnalysis from './SpecAnalysis';
import { workflowService } from '../services/workflowService';
import { useAuth } from '../contexts/AuthContext';
import { PermissionGate } from '../components/PermissionGate';

interface PresalesModuleProps {
  opportunities: Opportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  units: Unit[];
  users: User[];
}

const PresalesModule = ({ opportunities, setOpportunities, units, users }: PresalesModuleProps) => {
  const { currentUser } = useAuth();
  const [moduleView, setModuleView] = useState<'BOM' | 'ANALYSIS'>('BOM');
  const [step, setStep] = useState(1);
  const [selectedOppId, setSelectedOppId] = useState<string>('');
  const [inputMode, setInputMode] = useState<'MANUAL' | 'IMPORT'>('IMPORT');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showHandOffModal, setShowHandOffModal] = useState(false);
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [bomItems, setBomItems] = useState<any[]>([]);

  // Workflow Hand-off state
  const [targetUnitId, setTargetUnitId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [handOffNote, setHandOffNote] = useState('');

  useEffect(() => {
    if (selectedOppId) {
      const items = MOCK_BOM_ITEMS
        .filter(item => item.opportunityId === selectedOppId)
        .map(item => ({
          pn: item.partNumber,
          desc: item.description,
          qty: item.quantity,
          cost: item.purchaseCost,
          margin: item.marginPercentage
        }));
      setBomItems(items.length > 0 ? items : []);
    } else {
      setBomItems([]);
    }
  }, [selectedOppId]);

  const handleHandOff = async () => {
    if (!selectedOppId || !targetUnitId || !targetUserId) return;
    const opp = opportunities.find(o => o.id === selectedOppId);
    if (!opp) return;

    setIsHandingOff(true);
    const targetUnit = units.find(u => u.id === targetUnitId);
    const targetUser = users.find(u => u.id === targetUserId);

    await workflowService.triggerHandOff({
      itemId: opp.id,
      itemTitle: opp.title,
      fromUnit: 'PRESALES',
      toUnit: targetUnit?.name || 'UNKNOWN',
      fromUser: currentUser,
      toUser: targetUser || currentUser,
      note: handOffNote || 'Teknik analiz tamamlandı, iş devredildi.'
    });
    
    setOpportunities(prev => prev.map(o => 
      o.id === selectedOppId ? { ...o, technicalStatus: 'COMPLETED' } : o
    ));
    
    setIsHandingOff(false);
    setShowHandOffModal(false);
    alert(`İş başarıyla ${targetUnit?.name} birimine (${targetUser?.name}) aktarıldı.`);
  };

  const [newItem, setNewItem] = useState({
    pn: '',
    desc: '',
    qty: 1,
    cost: 0,
    margin: 15
  });

  const handleAddItem = () => {
    if (!newItem.pn || !newItem.desc) return;
    setBomItems([newItem, ...bomItems]);
    setNewItem({ pn: '', desc: '', qty: 1, cost: 0, margin: 15 });
  };

  return (
    <div className="p-8 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Presales & Dizayn</h3>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-500 whitespace-nowrap">BoM listesini fırsata bağlayın:</p>
            <select 
              value={selectedOppId}
              onChange={(e) => setSelectedOppId(e.target.value)}
              className="bg-white/50 border border-slate-200 rounded-lg px-3 py-1 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Fırsat Seçin</option>
              {opportunities.filter(o => o.status !== 'WON' && o.status !== 'LOST').map(opp => (
                <option key={opp.id} value={opp.id}>{opp.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <PermissionGate permission="PRESALES_EDIT">
            <button 
              onClick={() => setShowHandOffModal(true)}
              disabled={!selectedOppId}
              className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <ArrowUpRight size={18} /> İşi Devret
            </button>
          </PermissionGate>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex bg-slate-200/50 p-1 rounded-2xl">
            <button onClick={() => setModuleView('BOM')} className={cn("px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2", moduleView === 'BOM' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}><LayoutDashboard size={16} />BoM Oluşturma</button>
            <button onClick={() => setModuleView('ANALYSIS')} className={cn("px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2", moduleView === 'ANALYSIS' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}><FileSearch size={16} />Şartname Analizi</button>
          </div>
        </div>
      </div>

      {moduleView === 'BOM' ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden">
          {/* Left Side: Requirements */}
          <div className="glass-panel rounded-3xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h4 className="font-bold text-slate-900 flex items-center gap-2"><FileSearch size={20} className="text-indigo-600" />Şartname Maddeleri</h4>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="p-4 rounded-2xl border border-slate-200 bg-white"><p className="text-sm font-medium text-slate-700">Analiz tamamlandığında maddeler burada listelenir.</p></div>
            </div>
          </div>

          {/* Right Side: BoM Table */}
          <div className="glass-panel rounded-3xl flex flex-col overflow-hidden bg-white">
             <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-900">BoM Listesi</h4>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Toplam Maliyet</p>
                    <p className="text-sm font-mono font-bold text-slate-900">${bomItems.reduce((acc, curr) => acc + (curr.cost * curr.qty), 0).toLocaleString()}</p>
                  </div>
                  <button className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-100">Kaydet</button>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
               {bomItems.map((item, i) => (
                 <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs font-bold text-indigo-600">{item.pn}</span>
                      <span className="text-sm font-bold">${item.cost} x {item.qty}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{item.desc}</p>
                 </div>
               ))}
             </div>
          </div>
        </div>
      ) : (
        <SpecAnalysis opportunityId={selectedOppId} onTransferToBoM={(prods) => { setBomItems([...prods.map(p => ({pn: p.pn, desc: p.description, qty: p.quantity, cost: 0, margin: 15})), ...bomItems]); setModuleView('BOM'); }} />
      )}

      {/* Hand-off Modal */}
      <AnimatePresence>
        {showHandOffModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white p-8">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-xl font-bold text-slate-900">İşi Devret</h4>
                <button onClick={() => setShowHandOffModal(false)}><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Hedef Birim</label>
                  <select value={targetUnitId} onChange={(e) => setTargetUnitId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500">
                    <option value="">Birim Seçin</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Sorumlu Personel</label>
                  <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500">
                    <option value="">Personel Seçin</option>
                    {users.filter(u => !targetUnitId || u.unitId === targetUnitId).map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Not / Talimat</label>
                  <textarea value={handOffNote} onChange={(e) => setHandOffNote(e.target.value)} rows={3} placeholder="İşi devralacak kişiye notunuz..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6">
                <button onClick={() => setShowHandOffModal(false)} className="px-6 py-2 text-sm font-bold text-slate-500">İptal</button>
                <button 
                  onClick={handleHandOff}
                  disabled={!targetUserId || isHandingOff}
                  className="bg-indigo-600 text-white px-8 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {isHandingOff ? <Loader2 size={18} className="animate-spin" /> : 'Devret ve Bildir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PresalesModule;
