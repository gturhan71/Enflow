import { Sparkles, Bot, ShieldAlert, Zap, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Opportunity } from '../../types';

export default function ChatInfoPanel({
  selectedOpp, chatIsTyping, chatState, chatOffer, floorCost, initialValue, initialMargin,
  onStart, onFinalize,
}: {
  selectedOpp?: Opportunity;
  chatIsTyping: boolean;
  chatState: 'IDLE' | 'INTRO' | 'NEGOTIATING' | 'AGREED' | 'FAILED';
  chatOffer: number;
  floorCost: number;
  initialValue: number;
  initialMargin: number;
  onStart: () => void;
  onFinalize: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-8 rounded-[40px] border border-white/60 bg-white/40 shadow-sm space-y-6">

        {/* Negotiator Avatar Section */}
        <div className="flex flex-col items-center text-center p-6 bg-slate-900 text-white rounded-[32px] relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-4">
            <Sparkles size={16} className="text-emerald-400 animate-pulse" />
          </div>
          <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mb-4 shadow-lg">
            <Bot size={40} className={cn(chatIsTyping && "animate-bounce")} />
          </div>
          <h5 className="font-black text-lg tracking-tight leading-none">Müşteri Temsilcisi AI</h5>
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">Canlı Müzakereci</p>
          <div className="mt-4 px-4 py-1.5 bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest">
            {selectedOpp?.customer?.name || 'Müşteri'}
          </div>
        </div>

        {/* Fiyatlama & Dip Maliyet Göstergesi */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Başlangıç Fiyatı</span>
              <span className="text-lg font-black text-slate-900">${initialValue.toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">İlk Kar Marjı</span>
              <span className="text-sm font-black text-emerald-600">%{initialMargin.toFixed(1)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
            <div>
              <span className="text-[9px] font-black text-red-500/70 uppercase tracking-widest block">En Dip Maliyet Sınırı</span>
              <span className="text-lg font-black text-red-600">${floorCost.toLocaleString()}</span>
            </div>
            <div className="text-right bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
              <ShieldAlert size={10} /> ZIRHLI LİMİT
            </div>
          </div>

          {chatState !== 'IDLE' && (
            <div className="p-6 rounded-[28px] bg-slate-950 text-white space-y-4 shadow-xl">
              <div className="flex justify-between text-xs font-bold text-slate-400">
                <span>Pazarlık Süreci</span>
                <span>Marj: %{(((chatOffer - floorCost) / chatOffer) * 100).toFixed(1)}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700/50">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    (((chatOffer - floorCost) / chatOffer) * 100) >= 15 ? "bg-emerald-500" :
                    (((chatOffer - floorCost) / chatOffer) * 100) >= 8 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${Math.max(5, Math.min(100, (((chatOffer - floorCost) / (initialValue - floorCost)) * 100)))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {chatState === 'IDLE' && (
          <button
            onClick={onStart}
            className="w-full bg-primary text-white py-4 rounded-2xl text-xs font-black shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] active:scale-95"
          >
            <Zap size={16} /> Simülasyonu Başlat
          </button>
        )}

        {chatState === 'AGREED' && (
          <button
            onClick={onFinalize}
            className="w-full bg-emerald-500 text-white py-4 rounded-2xl text-xs font-black shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] active:scale-95"
          >
            <CheckCircle2 size={18} /> Anlaşmayı Tescil Et (Won)
          </button>
        )}

        {(chatState === 'FAILED' || chatState === 'AGREED') && (
          <button
            onClick={onStart}
            className="w-full bg-white text-slate-700 border border-slate-200 py-4 rounded-2xl text-xs font-black hover:bg-slate-50 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] active:scale-95"
          >
            <RefreshCw size={14} /> Tekrar Dene
          </button>
        )}

      </div>
    </div>
  );
}
