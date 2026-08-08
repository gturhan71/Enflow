import React, { useEffect, useState } from 'react';
import { Plus, Tag, Layers, Edit3, Trash2, X, Save, Loader2, ChevronDown, ChevronUp, Building2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Brand, ProductCategory, BrandSource } from '../../types';
import { apiService } from '../../services/apiService';

// Ayarlar → Marka & Ürün Grubu (GM-only) — Presales BoM kalemi, DMO kataloğu ve
// (ileride) Satınalma/Servis'in ortak seçtiği yönetilebilir liste. Serbest metin
// DEĞİL: analitik (hangi marka/ürün grubu ile ne kadar iş alındığı) buna dayanır.

// ── Ürün Grupları — basit isim listesi (ekle/düzenle/soft-delete) ──────────
const ProductCategoryManager: React.FC<{ categories: ProductCategory[]; onChange: () => void }> = ({ categories, onChange }) => {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await apiService.createProductCategory({ name: newName.trim() });
      setNewName('');
      onChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ürün grubu eklenemedi.');
    } finally { setLoading(false); }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setLoading(true);
    try {
      await apiService.updateProductCategory(id, { name: editName.trim() });
      setEditingId(null);
      onChange();
    } finally { setLoading(false); }
  };

  const handleDelete = async (c: ProductCategory) => {
    if (!window.confirm(`"${c.name}" ürün grubunu silmek istediğinize emin misiniz?`)) return;
    setLoading(true);
    try {
      await apiService.deleteProductCategory(c.id);
      onChange();
    } finally { setLoading(false); }
  };

  return (
    <div className="glass-card p-6 rounded-2xl border border-slate-200/60">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Tag className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h5 className="text-lg font-bold text-slate-900">Ürün Grupları</h5>
          <p className="text-xs text-slate-500">BoM kalemi ve DMO kataloğunda seçilen ürün cinsi/grubu.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Yeni ürün grubu adı…"
          className="input-glass flex-1 text-sm"
        />
        <button onClick={handleCreate} disabled={!newName.trim() || loading} className="btn-primary px-4 text-sm rounded-xl disabled:opacity-50 flex items-center gap-1.5">
          <Plus size={14} /> Ekle
        </button>
      </div>

      <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
        {categories.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Henüz ürün grubu tanımlanmadı.</p>}
        {categories.map(c => (
          <div key={c.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            {editingId === c.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveEdit(c.id)}
                  className="input-glass flex-1 text-sm py-1.5" autoFocus />
                <button onClick={() => handleSaveEdit(c.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Save size={14} /></button>
                <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={14} /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-semibold text-slate-700">{c.name}</span>
                <button onClick={() => { setEditingId(c.id); setEditName(c.name); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit3 size={13} /></button>
                <button onClick={() => handleDelete(c)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Markalar + her markanın Kaynakları (distribütör/bayi) ───────────────────
const BrandManager: React.FC<{ brands: Brand[]; onChange: () => void }> = ({ brands, onChange }) => {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedBrandId, setExpandedBrandId] = useState<string | null>(null);
  const [sourcesByBrand, setSourcesByBrand] = useState<Record<string, BrandSource[]>>({});
  const [newSourceName, setNewSourceName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await apiService.createBrand({ name: newName.trim() });
      setNewName('');
      onChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Marka eklenemedi.');
    } finally { setLoading(false); }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setLoading(true);
    try {
      await apiService.updateBrand(id, { name: editName.trim() });
      setEditingId(null);
      onChange();
    } finally { setLoading(false); }
  };

  const handleDelete = async (b: Brand) => {
    if (!window.confirm(`"${b.name}" markasını silmek istediğinize emin misiniz? (Kayıtlı kaynaklar da kaldırılır.)`)) return;
    setLoading(true);
    try {
      await apiService.deleteBrand(b.id);
      onChange();
    } finally { setLoading(false); }
  };

  const toggleExpand = async (brandId: string) => {
    if (expandedBrandId === brandId) { setExpandedBrandId(null); return; }
    setExpandedBrandId(brandId);
    if (!sourcesByBrand[brandId]) {
      const sources = await apiService.getBrandSources(brandId).catch(() => []);
      setSourcesByBrand(prev => ({ ...prev, [brandId]: sources }));
    }
  };

  const refreshSources = async (brandId: string) => {
    const sources = await apiService.getBrandSources(brandId).catch(() => []);
    setSourcesByBrand(prev => ({ ...prev, [brandId]: sources }));
  };

  const handleAddSource = async (brandId: string) => {
    if (!newSourceName.trim()) return;
    setLoading(true);
    try {
      await apiService.createBrandSource(brandId, { name: newSourceName.trim() });
      setNewSourceName('');
      await refreshSources(brandId);
    } finally { setLoading(false); }
  };

  const handleDeleteSource = async (brandId: string, source: BrandSource) => {
    if (!window.confirm(`"${source.name}" kaynağını silmek istediğinize emin misiniz?`)) return;
    setLoading(true);
    try {
      await apiService.deleteBrandSource(source.id);
      await refreshSources(brandId);
    } finally { setLoading(false); }
  };

  return (
    <div className="glass-card p-6 rounded-2xl border border-slate-200/60">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h5 className="text-lg font-bold text-slate-900">Markalar</h5>
          <p className="text-xs text-slate-500">Her markanın altında kayıtlı kaynak/distribütör listesi tutulabilir.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Yeni marka adı…"
          className="input-glass flex-1 text-sm"
        />
        <button onClick={handleCreate} disabled={!newName.trim() || loading} className="btn-primary px-4 text-sm rounded-xl disabled:opacity-50 flex items-center gap-1.5">
          <Plus size={14} /> Ekle
        </button>
      </div>

      <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar">
        {brands.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Henüz marka tanımlanmadı.</p>}
        {brands.map(b => (
          <div key={b.id} className="rounded-xl bg-slate-50 border border-slate-100 overflow-hidden">
            <div className="flex items-center gap-2 p-2.5">
              <button onClick={() => toggleExpand(b.id)} className="p-1 text-slate-400 hover:text-slate-700 shrink-0">
                {expandedBrandId === b.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {editingId === b.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveEdit(b.id)}
                    className="input-glass flex-1 text-sm py-1.5" autoFocus />
                  <button onClick={() => handleSaveEdit(b.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Save size={14} /></button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-semibold text-slate-700">{b.name}</span>
                  <button onClick={() => { setEditingId(b.id); setEditName(b.name); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit3 size={13} /></button>
                  <button onClick={() => handleDelete(b)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                </>
              )}
            </div>

            {expandedBrandId === b.id && (
              <div className="px-4 pb-3 pt-1 space-y-2 border-t border-slate-200/60">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kaynaklar / Distribütörler</p>
                {(sourcesByBrand[b.id] || []).length === 0 && <p className="text-xs text-slate-400 italic">Henüz kaynak eklenmedi.</p>}
                {(sourcesByBrand[b.id] || []).map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-100">
                    <span className="text-xs font-medium text-slate-600">{s.name}</span>
                    <button onClick={() => handleDeleteSource(b.id, s)} className="p-1 text-slate-300 hover:text-red-600"><Trash2 size={12} /></button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <input
                    value={newSourceName}
                    onChange={e => setNewSourceName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSource(b.id)}
                    placeholder="Kaynak/distribütör adı…"
                    className="input-glass flex-1 text-xs py-1.5"
                  />
                  <button onClick={() => handleAddSource(b.id)} disabled={!newSourceName.trim() || loading} className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50">
                    Ekle
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ProductTaxonomyManagement: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([apiService.getBrands(), apiService.getProductCategories()])
      .then(([b, c]) => { setBrands(b); setCategories(c); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Layers className="w-5 h-5 text-primary" /> Marka & Ürün Grubu</h4>
        <p className="text-sm text-slate-500 mt-1">
          Presales'te BoM kalemine, DMO kataloğuna girilen marka ve ürün grubu buradan yönetilir — serbest metin değil,
          tüm modüller aynı listeden seçim yapar (analitiğin bozulmaması için).
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Yükleniyor…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BrandManager brands={brands} onChange={load} />
          <ProductCategoryManager categories={categories} onChange={load} />
        </div>
      )}
    </div>
  );
};

export default ProductTaxonomyManagement;
