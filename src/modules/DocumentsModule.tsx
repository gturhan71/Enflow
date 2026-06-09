import React, { useState, useMemo } from 'react';
import { 
  Search,
  Plus,
  X,
  FileText,
  Calendar,
  Tag,
  Download,
  Trash2,
  Loader2,
  FileCheck2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { CorporateDocument } from '../types';
import { apiService } from '../services/apiService';

interface DocumentsModuleProps {
  documents: CorporateDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<CorporateDocument[]>>;
}

const DocumentsModule = ({ documents, setDocuments }: DocumentsModuleProps) => {
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDoc, setNewDoc] = useState<Partial<CorporateDocument>>({
    name: '',
    category: 'LEGAL',
    expiryDate: '',
    tags: []
  });

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      const matchesFilter = filter === 'ALL' || doc.category === filter;
      const docTags = Array.isArray(doc.tags) ? doc.tags : [];
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          docTags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesFilter && matchesSearch;
    });
  }, [documents, filter, searchQuery]);

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const saved = await apiService.createDocument({
        ...newDoc,
        tags: newDoc.tags?.join(', ')
      });
      const docWithTagsArray = {
        ...saved,
        tags: saved.tags ? saved.tags.split(',').map((t: string) => t.trim()) : []
      };
      setDocuments(prev => [docWithTagsArray, ...prev]);
      setShowNewDocModal(false);
      setNewDoc({ name: '', category: 'LEGAL', expiryDate: '', tags: [] });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Belge kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Bu belgeyi silmek istediğinize emin misiniz?')) return;
    try {
      await apiService.deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Belge silinemedi.');
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'LEGAL': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'ISO': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'CERTIFICATE': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'WORK_EXPERIENCE': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-sans bg-slate-50/30 custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Şirket Evrakları</h3>
          <p className="text-slate-500 font-medium text-sm mt-2">Yasal belgeler, sertifikalar ve kurumsal döküman yönetimi.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors duration-300" size={18} />
            <input 
              type="text" 
              placeholder="Belge ara..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-14 pr-6 py-3.5 bg-white/40 border border-white/40 rounded-[20px] text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/5 outline-none w-64 transition-all backdrop-blur-md"
            />
          </div>
          <button 
            onClick={() => setShowNewDocModal(true)}
            className="bg-primary text-white px-8 py-3.5 rounded-[20px] text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest"
          >
            <Plus size={18} /> Yeni Belge
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {['ALL', 'LEGAL', 'ISO', 'CERTIFICATE', 'WORK_EXPERIENCE'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-md border whitespace-nowrap",
              filter === cat 
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                : "bg-white/40 text-slate-500 border-white/40 hover:bg-white/60 hover:text-slate-900"
            )}
          >
            {cat === 'ALL' ? 'Tüm Belgeler' : 
             cat === 'LEGAL' ? 'Yasal' : 
             cat === 'ISO' ? 'ISO' : 
             cat === 'CERTIFICATE' ? 'Sertifika' : 'İş Bitirme'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredDocs.map((doc) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={doc.id}
              className="glass-panel p-6 rounded-[32px] group hover:border-primary/40 transition-all relative overflow-hidden flex flex-col shadow-sm hover:shadow-xl"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", getCategoryColor(doc.category))}>
                  <FileText size={24} />
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-white/60 rounded-xl text-slate-400 hover:text-primary transition-all active:scale-90">
                    <Download size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteDoc(doc.id)}
                    className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-600 transition-all active:scale-90"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h4 className="font-black text-slate-900 text-lg mb-2 leading-tight uppercase italic tracking-tighter line-clamp-2">
                {doc.name}
              </h4>

              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                <Calendar size={12} />
                Son Geçerlilik: {new Date(doc.expiryDate).toLocaleDateString('tr-TR')}
              </div>

              <div className="mt-auto pt-4 flex flex-wrap gap-2 border-t border-slate-100/50">
                {(Array.isArray(doc.tags) ? doc.tags : []).map((tag, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-100/50 text-slate-500 rounded-lg text-[8px] font-black uppercase tracking-widest">
                    #{tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showNewDocModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-panel w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden bg-white/90 flex flex-col"
            >
              <div className="p-8 border-b border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                    <FileCheck2 size={24} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Belge Yükle</h4>
                  </div>
                </div>
                <button onClick={() => setShowNewDocModal(false)} className="p-3 hover:bg-white/60 rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveDoc} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Belge Adı</label>
                  <input 
                    type="text" 
                    required 
                    value={newDoc.name} 
                    onChange={e => setNewDoc({...newDoc, name: e.target.value})}
                    placeholder="Örn: Kapasite Raporu 2026" 
                    className="w-full px-6 py-4 bg-white/40 border border-white/40 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Kategori</label>
                    <select 
                      value={newDoc.category}
                      onChange={e => setNewDoc({...newDoc, category: e.target.value as any})}
                      className="w-full px-6 py-4 bg-white/40 border border-white/40 rounded-2xl outline-none appearance-none"
                    >
                      <option value="LEGAL">Yasal</option>
                      <option value="ISO">ISO</option>
                      <option value="CERTIFICATE">Sertifika</option>
                      <option value="WORK_EXPERIENCE">İş Bitirme</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Geçerlilik Tarihi</label>
                    <input 
                      type="date" 
                      required
                      value={newDoc.expiryDate}
                      onChange={e => setNewDoc({...newDoc, expiryDate: e.target.value})}
                      className="w-full px-6 py-4 bg-white/40 border border-white/40 rounded-2xl outline-none" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Etiketler (Virgülle ayırın)</label>
                  <input 
                    type="text" 
                    placeholder="Yasal, 2026, Sertifika..." 
                    onChange={e => setNewDoc({...newDoc, tags: e.target.value.split(',').map(t => t.trim())})}
                    className="w-full px-6 py-4 bg-white/40 border border-white/40 rounded-2xl outline-none" 
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowNewDocModal(false)} 
                    className="px-8 py-3 text-xs font-black text-slate-500 uppercase tracking-widest hover:text-slate-800 transition-colors"
                  >
                    İPTAL
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-primary text-white px-10 py-4 rounded-2xl text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all uppercase tracking-widest flex items-center gap-2"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'BELGEYİ KAYDET'}
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

export default DocumentsModule;
