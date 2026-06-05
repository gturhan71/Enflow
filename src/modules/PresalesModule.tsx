import React, { useState, useEffect, useRef } from 'react';
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
  Users,
  FileDown,
  Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { CostAnalysisModule } from '../components/CostAnalysisModule';
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
import { apiService } from '../services/apiService';

interface PresalesModuleProps {
  opportunities: Opportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  units: Unit[];
  users: User[];
}

const PresalesModule = ({ opportunities, setOpportunities, units, users }: PresalesModuleProps) => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApprovalPreview, setShowApprovalPreview] = useState(false);

  const handleRequestApproval = () => {
    if (!selectedOppId) return;
    if (bomItems.length === 0) {
      alert('BoM listesi boş. Lütfen önce kalem ekleyin.');
      return;
    }
    setShowApprovalPreview(true);
  };

  const handleFinalApproval = async () => {
    setIsSubmitting(true);
    try {
      // 1. Önce BoM kalemlerini veritabanına kaydet
      const savedBoM = await apiService.saveBoMItems(selectedOppId, bomItems);
      
      // 2. Onay sürecini başlat
      await apiService.requestProposalApproval(selectedOppId, {
        note: 'Teknik çalışma tamamlandı, fiyat teklifi onaya sunulmuştur.',
        managerId: 'cmp5lhehc000259w33zxhyy0p' // Gökhan Turhan (General Manager)
      });

      alert('Teklif başarıyla yönetici onayına sunuldu.');
      
      // UPDATE GLOBAL STATE WITH NEW BoM ITEMS AND STATUS
      setOpportunities(prev => prev.map(o => 
        o.id === selectedOppId 
          ? { ...o, technicalStatus: 'WAITING_APPROVAL', bomItems: savedBoM } 
          : o
      ));
      
      setShowApprovalPreview(false);
    } catch (err: any) {
      alert(err.message || 'Onay sürecinde hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isXML = file.name.toLowerCase().endsWith('.xml');

    reader.onload = (evt) => {
      const content = evt.target?.result;
      let mappedItems: any[] = [];

      if (isXML) {
        // XML Parsing Logic
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(content as string, "text/xml");
          const items = xmlDoc.querySelectorAll("Item, product, row, item"); // Common tags
          
          mappedItems = Array.from(items).map(item => {
            const getVal = (selectors: string[]) => {
              for (const s of selectors) {
                const el = item.querySelector(s);
                if (el) return el.textContent;
              }
              return '';
            };

            const pn = getVal(['PN', 'PartNumber', 'Part_Number', 'product_code', 'id']);
            const desc = getVal(['Description', 'Desc', 'product_name', 'name', 'aciklama']);
            const qty = parseInt(getVal(['Quantity', 'Qty', 'amount', 'adet', 'miktar']) || '1');
            const cost = parseFloat(getVal(['Cost', 'Price', 'unit_price', 'maliyet', 'fiyat']) || '0');

            return {
              pn: String(pn || ''),
              desc: String(desc || ''),
              qty: isNaN(qty) ? 1 : qty,
              cost: isNaN(cost) ? 0 : cost,
              margin: 15
            };
          }).filter(item => item.pn || item.desc);
        } catch (err) {
          console.error('XML parse error:', err);
          alert('XML dosyası ayrıştırılamadı.');
          return;
        }
      } else {
        // Excel/CSV Parsing Logic (using xlsx)
        const bstr = content;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        mappedItems = data.map((row: any) => {
          const pn = row['PN'] || row['Part Number'] || row['Ürün Kodu'] || row['Model'] || '';
          const desc = row['Description'] || row['Açıklama'] || row['Ürün Adı'] || '';
          const qty = parseInt(row['Quantity'] || row['Adet'] || row['Miktar'] || '1');
          const cost = parseFloat(row['Cost'] || row['Maliyet'] || row['Birim Fiyat'] || '0');
          
          return {
            pn: String(pn),
            desc: String(desc),
            qty: isNaN(qty) ? 1 : qty,
            cost: isNaN(cost) ? 0 : cost,
            margin: 15
          };
        }).filter(item => item.pn || item.desc);
      }

      if (mappedItems.length > 0) {
        setBomItems(prev => [...mappedItems, ...prev]);
        alert(`${mappedItems.length} kalem başarıyla içe aktarıldı.`);
      } else {
        alert('Dosyada uygun veri bulunamadı. Lütfen formatı kontrol edin.');
      }
    };

    if (isXML) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
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
            <div className="flex items-center gap-2">
              <button 
                onClick={handleRequestApproval}
                disabled={!selectedOppId || isSubmitting}
                className="bg-primary text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 uppercase tracking-widest"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Yönetici Onayına Sun
              </button>
              <button 
                onClick={() => setShowHandOffModal(true)}
                disabled={!selectedOppId}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50 uppercase tracking-widest"
              >
                <ArrowUpRight size={16} /> İşi Devret
              </button>
            </div>
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
                <div className="flex items-center gap-4">
                  <h4 className="font-bold text-slate-900">BoM Listesi</h4>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".xlsx, .xls, .csv, .xml" 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                  >
                    <Upload size={14} />
                    Excel / XML Yükle
                  </button>
                </div>
import { SaveButton } from '../components/SaveButton';
// ... mevcut importlar ...
// ...

// ... render içerisinde ...
              <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Toplam Maliyet</p>
                    <p className="text-sm font-mono font-bold text-slate-900">${bomItems.reduce((acc, curr) => acc + (curr.cost * curr.qty), 0).toLocaleString()}</p>
                  </div>
                  <SaveButton onClick={handleRequestApproval} loading={loading} />
                </div>
             </div>
             
             {/* Manual BoM Item Form */}
             <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-12 gap-2">
                <input type="text" placeholder="P/N" className="col-span-3 p-2 text-xs border rounded-lg" value={newItem.pn} onChange={(e) => setNewItem({...newItem, pn: e.target.value})} />
                <input type="text" placeholder="Açıklama" className="col-span-5 p-2 text-xs border rounded-lg" value={newItem.desc} onChange={(e) => setNewItem({...newItem, desc: e.target.value})} />
                <input type="number" placeholder="Adet" className="col-span-1 p-2 text-xs border rounded-lg" value={newItem.qty} onChange={(e) => setNewItem({...newItem, qty: parseInt(e.target.value) || 1})} />
                <input type="number" placeholder="Maliyet" className="col-span-2 p-2 text-xs border rounded-lg" value={newItem.cost} onChange={(e) => setNewItem({...newItem, cost: parseFloat(e.target.value) || 0})} />
                <button 
                  className="col-span-1 bg-primary text-white rounded-lg"
                  onClick={() => {
                    setBomItems([...bomItems, newItem]);
                    setNewItem({ pn: '', desc: '', qty: 1, cost: 0, margin: 15 });
                  }}
                >
                  <Plus size={16} />
                </button>
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
             
             <div className="border-t border-slate-100">
               <CostAnalysisModule />
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

      {/* BoM Approval Preview Modal */}
      <AnimatePresence>
        {showApprovalPreview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-panel w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden bg-white/80 flex flex-col border border-white/50"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white/40 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">BoM Onay Önizleme</h4>
                    <p className="text-sm text-slate-500 font-medium">Lütfen listeyi son kez kontrol edin.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowApprovalPreview(false)}
                  className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">P/N (Parça No)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Açıklama</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Adet</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Maliyet</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Toplam</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {bomItems.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-xs font-mono font-bold text-indigo-600">{item.pn}</td>
                          <td className="px-6 py-4 text-xs text-slate-600 font-medium">{item.desc}</td>
                          <td className="px-6 py-4 text-xs text-slate-900 font-bold text-center">{item.qty}</td>
                          <td className="px-6 py-4 text-xs text-slate-900 font-bold text-right">${item.cost.toLocaleString()}</td>
                          <td className="px-6 py-4 text-xs text-primary font-black text-right">${(item.cost * item.qty).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white">
                        <td colSpan={4} className="px-6 py-4 text-xs font-black uppercase tracking-widest">Genel Toplam</td>
                        <td className="px-6 py-4 text-lg font-black text-right">
                          ${bomItems.reduce((acc, curr) => acc + (curr.cost * curr.qty), 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="mt-6 p-6 rounded-3xl bg-amber-50 border border-amber-100 flex items-start gap-4">
                  <div className="mt-1 text-amber-500">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900">Önemli Not</p>
                    <p className="text-xs text-amber-700 leading-relaxed mt-1">
                      Onay sürecine gönderilen BoM listesi üzerinde yönetici incelemesi tamamlanana kadar değişiklik yapılamaz. 
                      Lütfen tüm kalemlerin ve maliyetlerin doğru olduğundan emin olun.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-4">
                <button 
                  onClick={() => setShowApprovalPreview(false)}
                  className="px-8 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Vazgeç
                </button>
                <button 
                  onClick={handleFinalApproval}
                  disabled={isSubmitting}
                  className="bg-primary text-white px-10 py-3 rounded-2xl text-xs font-black shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-3 disabled:opacity-50 uppercase tracking-[0.2em]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Gönderiliyor...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Yönetici Onayına Gönder
                    </>
                  )}
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
