import React, { useState, useEffect } from 'react';
import { 
  Archive, 
  Search, 
  Plus, 
  Box, 
  Layers, 
  Tag, 
  User, 
  Calendar,
  X,
  Save,
  Loader2,
  Trash2,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { ArchiveItem } from '../types';
import { apiService } from '../services/apiService';
import { PermissionGate } from '../components/PermissionGate';

const ArchiveModule = () => {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newItem, setNewItem] = useState<Partial<ArchiveItem>>({
    category: 'Sözleşme',
    status: 'IN_ARCHIVE',
    tags: []
  });

  useEffect(() => {
    fetchArchive();
  }, []);

  const fetchArchive = async () => {
    setLoading(true);
    try {
      const data = await apiService.getArchive();
      setItems(data);
    } catch (err) {
      console.error('Arşiv yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const saved = await apiService.createArchiveItem(newItem);
      setItems([saved, ...items]);
      setShowNewModal(false);
      setNewItem({ category: 'Sözleşme', status: 'IN_ARCHIVE', tags: [] });
    } catch (err) {
      alert('Kaydedilemedi');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.boxNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-geist">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Fiziksel Arşiv Sistemi</h3>
          <p className="text-slate-500 font-medium">Sözleşme, fatura ve resmi evrakların lokasyon bazlı takibi.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Kutu, raf veya etiket ara..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-14 pr-8 py-4 bg-white border border-slate-100 rounded-[24px] text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-500/10 outline-none w-72 transition-all"
            />
          </div>
          <PermissionGate permission="ARCHIVE_EDIT">
            <button onClick={() => setShowNewModal(true)} className="bg-indigo-600 text-white px-8 py-4 rounded-[28px] text-sm font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest">
              <Plus size={20} /> Yeni Arşiv Kaydı
            </button>
          </PermissionGate>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <Loader2 size={48} className="text-indigo-600 animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Arşiv Taranıyor...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredItems.map(item => (
            <motion.div 
              layout
              key={item.id} 
              className="glass-panel p-8 rounded-[40px] bg-white border border-slate-100 group hover:border-indigo-400 transition-all relative overflow-hidden flex flex-col"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-2xl flex items-center justify-center transition-colors">
                  <Archive size={28} />
                </div>
                <div className="text-right">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                    item.status === 'BORROWED' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                  )}>
                    {item.status === 'BORROWED' ? 'Ödünç Verildi' : 'Arşivde'}
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">{item.category}</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-4">
                   <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs font-black text-slate-900 uppercase">
                      Kutu: {item.boxNo}
                   </div>
                   <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs font-black text-slate-900 uppercase">
                      Raf: {item.shelfNo}
                   </div>
                </div>
                <h5 className="font-black text-slate-900 text-lg leading-tight line-clamp-2">{item.description}</h5>
              </div>

              <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase">
                  <User size={14} /> {item.owner}
                </div>
                <div className="flex gap-1">
                  {Array.isArray(item.tags) && item.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[8px] font-black uppercase tracking-tighter">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* NEW ARCHIVE MODAL */}
      <AnimatePresence>
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-panel w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden bg-white flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Yeni Arşiv Kaydı</h4>
                <button onClick={() => setShowNewModal(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Kutu No</label>
                    <input type="text" required value={newItem.boxNo} onChange={(e) => setNewItem({...newItem, boxNo: e.target.value})} placeholder="Örn: B-102" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Raf No</label>
                    <input type="text" required value={newItem.shelfNo} onChange={(e) => setNewItem({...newItem, shelfNo: e.target.value})} placeholder="Örn: R-12" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Kategori</label>
                    <select value={newItem.category} onChange={(e) => setNewItem({...newItem, category: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none">
                      <option value="Sözleşme">Sözleşme</option>
                      <option value="Fatura">Fatura</option>
                      <option value="Personel">Personel</option>
                      <option value="Resmi Evrak">Resmi Evrak</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Evrak Sahibi / Birim</label>
                    <input type="text" required value={newItem.owner} onChange={(e) => setNewItem({...newItem, owner: e.target.value})} placeholder="Örn: Finans" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">İçerik Açıklaması</label>
                  <textarea rows={3} required value={newItem.description} onChange={(e) => setNewItem({...newItem, description: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none resize-none focus:ring-4 focus:ring-indigo-500/10" />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowNewModal(false)} className="px-8 py-3 text-sm font-black text-slate-500 uppercase tracking-widest">İPTAL</button>
                  <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-10 py-4 rounded-3xl text-sm font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all uppercase tracking-widest flex items-center gap-2">
                    {loading ? <Loader2 size={20} className="animate-spin" /> : <><Save size={20} /> KAYDET</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ArchiveModule;
