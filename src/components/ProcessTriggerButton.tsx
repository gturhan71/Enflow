import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { GitBranch, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { apiService } from '../services/apiService';
import { PROCESS_KEYS, EntityType } from '../types/workflow';

// Jenerik "Süreç Başlat" — İş Akışı Tasarımcısı'nda "+ Yeni Süreç" ile
// eklenen, sabit taksonomi dışındaki (custom) süreçler için TEK tetikleme
// noktası. Sabit süreçler (Fırsat Onayı, Sözleşme İmza, ...) burada ASLA
// listelenmez — onların kendi özel butonları/route'ları var (durum
// ön-koşulları burada bypass edilmemeli).
export default function ProcessTriggerButton({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const [processes, setProcesses] = useState<{ key: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    const known = new Set<string>(PROCESS_KEYS as readonly string[]);
    apiService.getWorkflows().then((wfs) => {
      const matches = (wfs || [])
        .filter((w) => w.processKey && !known.has(w.processKey) && w.entityType === entityType && (w.steps?.length ?? 0) > 0)
        .map((w) => ({ key: w.processKey as string, name: w.name }));
      setProcesses(matches);
    }).catch(() => {});
  }, [entityType]);

  if (processes.length === 0) return null;

  const handleTrigger = async (processKey: string, name: string) => {
    setTriggering(processKey);
    setOpen(false);
    try {
      const result = await apiService.triggerProcess(processKey, entityId) as { pending?: boolean; success?: boolean };
      if (result?.pending) {
        toast.info(`"${name}" onay bekliyor — ilgili kişiye görev iletildi.`);
      } else {
        toast.success(`"${name}" başlatıldı.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `"${name}" başlatılamadı.`);
    } finally {
      setTriggering(null);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-primary/40 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
      >
        <GitBranch size={14} /> Süreç Başlat <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden">
          {processes.map((p) => (
            <button
              key={p.key}
              onClick={() => handleTrigger(p.key, p.name)}
              disabled={triggering === p.key}
              className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              {triggering === p.key ? 'Başlatılıyor…' : p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
