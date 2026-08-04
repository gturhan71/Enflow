import { MessageSquare, Gavel } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ModeTabBar({
  activeMode, disabled, onSelectCanli, onSelectEksiltme,
}: {
  activeMode: 'canli' | 'eksiltme';
  disabled: boolean;
  onSelectCanli: () => void;
  onSelectEksiltme: () => void;
}) {
  return (
    <div className="flex bg-white/40 border border-slate-200/50 p-1.5 rounded-2xl max-w-md shadow-sm">
      <button
        disabled={disabled}
        onClick={onSelectCanli}
        className={cn(
          "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
          activeMode === 'canli' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-800 disabled:opacity-50"
        )}
      >
        <MessageSquare size={14} /> 1v1 Canlı Müzakere
      </button>
      <button
        disabled={disabled}
        onClick={onSelectEksiltme}
        className={cn(
          "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
          activeMode === 'eksiltme' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-800 disabled:opacity-50"
        )}
      >
        <Gavel size={14} /> Açık Eksiltme (Müzayede)
      </button>
    </div>
  );
}
