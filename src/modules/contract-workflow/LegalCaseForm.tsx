import { useState } from 'react';
import { XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { apiService } from '../../services/apiService';
import { LEGAL_TYPE_LABELS } from './constants';
import { ContractWorkflow } from './types';

export default function LegalCaseForm({ workflows, onClose, onSaved }: { workflows: ContractWorkflow[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ type: 'CONTRACT_REVIEW', priority: 'MEDIUM' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      if (!f.title) throw new Error('Başlık zorunlu.');
      const relation = f.contractWorkflowId
        ? { relatedEntityType: 'CONTRACT_WORKFLOW', relatedEntityId: f.contractWorkflowId }
        : {};
      await apiService.createLegalCase({ ...f, ...relation, categoryCode: f.categoryCode || 'HUK' });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Kaydetme hatası.'); setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="glass-card p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Yeni Hukuki Vaka</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><XCircle className="w-5 h-5" /></button>
        </div>
        <input className="input-glass w-full text-sm" placeholder="Başlık" value={f.title || ''} onChange={e => set('title', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <select className="input-glass w-full text-sm" value={f.type} onChange={e => set('type', e.target.value)}>
            {Object.entries(LEGAL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input-glass w-full text-sm" value={f.priority} onChange={e => set('priority', e.target.value)}>
            {['LOW', 'MEDIUM', 'HIGH'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        {f.type === 'CONTRACT_REVIEW' && (
          <div>
            <select className="input-glass w-full text-sm" value={f.contractWorkflowId || ''} onChange={e => set('contractWorkflowId', e.target.value)}>
              <option value="">Bağlı sözleşme süreci yok (opsiyonel)</option>
              {workflows.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">Bağlanırsa: bu vaka, sözleşmenin zorunlu evrakları tamamlanmadan kapatılamaz.</p>
          </div>
        )}
        <textarea className="input-glass w-full text-sm resize-none" rows={2} placeholder="Özet / durum" value={f.summary || ''} onChange={e => set('summary', e.target.value)} />
        <textarea className="input-glass w-full text-sm resize-none" rows={2} placeholder="Hukuki görüş (opsiyonel)" value={f.opinion || ''} onChange={e => set('opinion', e.target.value)} />
        <input className="input-glass w-full text-sm" placeholder="Doküman Kategori Kodu (vars. HUK)" value={f.categoryCode || ''} onChange={e => set('categoryCode', e.target.value.toUpperCase())} />
        {err && <p className="text-xs text-red-400 font-bold">{err}</p>}
        <button onClick={save} disabled={saving} className="btn-primary w-full text-sm disabled:opacity-50">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
      </motion.div>
    </motion.div>
  );
}
