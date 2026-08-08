import { Info } from 'lucide-react';

// Kural: her dashboard/analitik öğesi (kart, sekme, bölüm başlığı) bu ⓘ ile
// "ne gösteriyor, neye göre düzenli" açıklamasını taşır — RoleCockpit
// widget'larındaki felsefe ikonuyla aynı görsel dil (bkz. modules/dashboard/widgetCatalog.ts).
export default function InfoTooltip({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span title={text} className={`inline-flex shrink-0 cursor-help ${className}`}>
      <Info size={12} className="text-slate-300 hover:text-slate-500 transition-colors" />
    </span>
  );
}
