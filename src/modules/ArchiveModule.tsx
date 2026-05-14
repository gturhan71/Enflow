import React, { useState } from 'react';
import { 
  Archive, 
  Search, 
  Plus, 
  Filter, 
  ChevronRight, 
  Package, 
  MapPin, 
  Calendar,
  FileText,
  History,
  MoreVertical,
  QrCode,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

import { ArchiveItem } from '../types';

const MOCK_ARCHIVE: ArchiveItem[] = [
  { id: 'arc-1', boxNo: 'K-2026-001', shelfNo: 'A-12-04', category: 'Sözleşmeler', description: 'Global Bank 2026 Çerçeve Sözleşmesi', owner: 'Hukuk Birimi', date: '2026-01-10', status: 'IN_ARCHIVE', tags: ['Islak İmza', 'Kritik'] },
  { id: 'arc-2', boxNo: 'K-2025-045', shelfNo: 'B-03-01', category: 'İnsan Kaynakları', description: '2025 Personel Özlük Dosyaları (A-L)', owner: 'İK', date: '2025-12-20', status: 'IN_ARCHIVE', tags: ['KVKK', 'Özlük'] },
  { id: 'arc-3', boxNo: 'K-2026-005', shelfNo: 'C-01-10', category: 'Finans', description: '2026 Q1 KDV Beyannameleri ve Faturalar', owner: 'Muhasebe', date: '2026-04-05', status: 'BORROWED', tags: ['Mali', 'Denetim'] },
  { id: 'arc-4', boxNo: 'K-2024-112', shelfNo: 'D-05-22', category: 'Projeler', description: 'Kamu Hastaneleri Veri Merkezi Proje Dosyası', owner: 'Teknik Birim', date: '2024-11-15', status: 'IN_ARCHIVE', tags: ['Proje', 'Teknik'] },
];

const ArchiveModule = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<ArchiveItem[]>(MOCK_ARCHIVE);

  const filteredItems = items.filter(item => 
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.boxNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.shelfNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IN_ARCHIVE': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'BORROWED': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'DISPOSED': return 'bg-slate-50 text-slate-400 border-slate-100';
      default: return 'bg-slate-50 text-slate-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'IN_ARCHIVE': return 'Arşivde';
      case 'BORROWED': return 'Ödünç Verildi';
      case 'DISPOSED': return 'İmha Edildi';
      default: return status;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="p-8 border-b border-slate-100 bg-white shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Archive size={28} />
          </div>
          <div>
            <h4 className="text-2xl font-bold text-slate-900">Fiziksel Arşiv Yönetimi</h4>
            <p className="text-sm text-slate-500">Şirket içi fiziksel evrak, kutu ve raf takibi sistemi.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2">
            <Plus size={18} />
            Yeni Arşiv Kaydı
          </button>
        </div>
      </div>

      <div className="p-8 flex-1 overflow-hidden flex flex-col gap-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Toplam Kutu', value: '142', icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Aktif Dosya', value: '1,280', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Ödünçte', value: '12', icon: History, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Doluluk Oranı', value: '%64', icon: MapPin, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map((stat, i) => (
            <div key={i} className="glass-panel p-6 rounded-3xl bg-white border border-slate-100 flex items-center gap-4 shadow-sm">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", stat.bg, stat.color)}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-black text-slate-900">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Dosya adı, kutu no veya raf kodu ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 shadow-sm transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2">
              <Filter size={18} /> Filtrele
            </button>
            <button className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2">
              <Download size={18} /> Dışa Aktar
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="glass-panel rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-sm flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Kutu / Raf</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Dosya Açıklaması</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Sorumlu Birim</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Kayıt Tarihi</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] text-center">Durum</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-bold text-indigo-600">{item.boxNo}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                          <MapPin size={10} /> {item.shelfNo}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{item.description}</span>
                        <div className="flex gap-1 mt-1">
                          {item.tags.map((tag, i) => (
                            <span key={i} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{item.owner}</td>
                    <td className="px-6 py-4 text-slate-500">{new Date(item.date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold border uppercase", getStatusColor(item.status))}>
                          {getStatusText(item.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                          <QrCode size={18} />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                          <MoreVertical size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchiveModule;
