import { Users, DollarSign, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fmtCurrency } from '../../lib/format';
import type { Competitor } from './types';

interface Participant { id: string; name: string; lastBid: number; isUs: boolean; avatarColor?: string }
interface LogEntry { round: number; text: string; type: 'info' | 'bid' | 'alert' | 'success' }

export default function AuctionBoard({
  currency, ourStatus, ourLastBid, competitors, auctionState, activeParticipants,
  withdrawals, setWithdrawals, manualBids, setManualBids, dynamicRequiredMaxes,
  currentMinDecrement, auctionRound, onSubmitRound, auctionLog,
}: {
  currency: string;
  ourStatus: 'ACTIVE' | 'WITHDRAWN' | 'ELIMINATED';
  ourLastBid: number;
  competitors: Competitor[];
  auctionState: 'IDLE' | 'SETUP' | 'BIDDING' | 'FINISHED';
  activeParticipants: Participant[];
  withdrawals: Record<string, boolean>;
  setWithdrawals: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  manualBids: Record<string, string>;
  setManualBids: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  dynamicRequiredMaxes: Record<string, number>;
  currentMinDecrement: number;
  auctionRound: number;
  onSubmitRound: () => void;
  auctionLog: LogEntry[];
}) {
  return (
    <div className="lg:col-span-2 space-y-6">

      {/* Competitors List Panel */}
      <div className="glass-panel p-8 rounded-[40px] border border-white/60 bg-white/40 shadow-sm">
        <h4 className="font-black text-slate-900 uppercase italic tracking-widest text-sm mb-6 flex items-center gap-2">
          <Users size={18} className="text-primary" /> Katılımcı Teklif Tablosu
        </h4>

        <div className="space-y-4">
          {/* US row */}
          <div className={cn(
            "flex items-center justify-between p-5 rounded-3xl border transition-all duration-300",
            ourStatus === 'ACTIVE' ? "bg-white border-primary/20 shadow-sm" : "bg-slate-100/50 border-slate-200 opacity-60"
          )}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black">
                Biz
              </div>
              <div>
                <h5 className="font-black text-slate-900">Biz (Enflow)</h5>
                <span className={cn(
                  "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest",
                  ourStatus === 'ACTIVE' ? "bg-primary/10 text-primary" : "bg-slate-300 text-slate-600"
                )}>
                  {ourStatus === 'ACTIVE' ? 'AKTİF' : 'ÇEKİLDİ'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Verilen Teklif</span>
              <span className="text-lg font-black text-slate-900">{fmtCurrency(ourLastBid, currency)}</span>
            </div>
          </div>

          {/* Competitors rows */}
          {competitors.map(comp => (
            <div
              key={comp.id}
              className={cn(
                "flex items-center justify-between p-5 rounded-3xl border transition-all duration-300 bg-white/60",
                comp.isActive ? "border-slate-100 shadow-sm" : "bg-slate-100/50 border-slate-200 opacity-60"
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 text-white rounded-2xl flex items-center justify-center font-black"
                  style={{ backgroundColor: comp.avatarColor }}
                >
                  {comp.name.replace('Rakip Firma ', '')}
                </div>
                <div>
                  <h5 className="font-black text-slate-900">{comp.name}</h5>
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest",
                    comp.isActive ? "bg-amber-500/10 text-amber-600" : "bg-slate-300 text-slate-600"
                  )}>
                    {comp.isActive ? 'AKTİF' : 'ÇEKİLDİ (ELENDİ)'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Verilen Teklif</span>
                <span className="text-lg font-black text-slate-900">{fmtCurrency(comp.lastBid, currency)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Auction Bidding Panel (Controls) */}
      {auctionState === 'BIDDING' && (
        <div className="glass-panel p-8 rounded-[40px] border border-white/60 bg-white/80 backdrop-blur-md space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h5 className="font-black text-slate-900 uppercase italic tracking-tighter text-sm">Tur Teklif Kontrol Paneli</h5>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Katılımcı firmaların bu turdaki tekliflerini manuel girin veya çekilenleri işaretleyin.</p>
            </div>
            <div className="text-xs font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
              Tur: <span className="text-primary font-black">{auctionRound}</span>
            </div>
          </div>

          <div className="space-y-4">
            {activeParticipants.map(part => {
              const isWithdrawn = withdrawals[part.id] === true;
              const maxBid = dynamicRequiredMaxes[part.id];

              return (
                <div
                  key={part.id}
                  className={cn(
                    "p-4 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4",
                    isWithdrawn
                      ? "bg-red-500/5 border-red-200/50 opacity-80"
                      : "bg-white border-slate-100 hover:border-slate-300 shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-sm"
                      style={{ backgroundColor: part.avatarColor || '#0f172a' }}
                    >
                      {part.isUs ? 'Biz' : part.name.replace('Rakip Firma ', '')}
                    </div>
                    <div>
                      <h6 className="font-black text-slate-900 text-xs">{part.name}</h6>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                        Önceki Teklifi: <span className="text-slate-700 font-black">{fmtCurrency(part.lastBid, currency)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isWithdrawn ? (
                      <div className="flex-1 md:flex-none">
                        <span className="px-4 py-3 bg-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest block text-center border border-red-200">
                          🚫 İHALEDEN ÇEKİLDİ
                        </span>
                      </div>
                    ) : (
                      <div className="relative flex-1 md:flex-none md:w-48">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          value={manualBids[part.id] || ''}
                          onChange={(e) => setManualBids(prev => ({ ...prev, [part.id]: e.target.value }))}
                          placeholder={`En Fazla: ${fmtCurrency(maxBid, currency)}`}
                          className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black shadow-inner focus:ring-4 focus:ring-slate-900/5 outline-none transition-all text-slate-800"
                        />
                      </div>
                    )}

                    {isWithdrawn ? (
                      <button
                        onClick={() => setWithdrawals(prev => ({ ...prev, [part.id]: false }))}
                        className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black hover:bg-slate-50 uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                      >
                        Dahil Et
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setWithdrawals(prev => ({ ...prev, [part.id]: true }));
                          setManualBids(prev => {
                            const copy = { ...prev };
                            delete copy[part.id];
                            return copy;
                          });
                        }}
                        className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                      >
                        Çekildi
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-[10px] text-slate-400 font-bold max-w-[320px] leading-tight">
              * Her turlu teklifte, sıradaki firma bir öncekinden en az <span className="text-amber-500 font-black">{fmtCurrency(currentMinDecrement, currency)}</span> düşmek zorundadır.
            </div>
            <button
              onClick={onSubmitRound}
              className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-[0.1em]"
            >
              <CheckCircle2 size={14} /> Tur Hamlelerini Kaydet & İlerlet
            </button>
          </div>
        </div>
      )}

      {/* Auction Bidding Live Logs */}
      {auctionLog.length > 0 && (
        <div className="glass-panel p-8 rounded-[40px] border border-white/60 bg-white/40 shadow-sm max-h-[300px] flex flex-col">
          <h5 className="font-black text-slate-800 uppercase italic tracking-widest text-xs mb-4 border-b border-slate-200 pb-2">Canlı Tur Gelişmeleri Logu</h5>
          <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar text-xs font-mono font-bold">
            {auctionLog.map((log, idx) => (
              <div
                key={idx}
                className={cn(
                  "p-2 rounded-xl flex items-center gap-2",
                  log.type === 'info' ? "bg-slate-100/50 text-slate-500" :
                  log.type === 'bid' ? "bg-blue-500/5 text-blue-600 border border-blue-500/10" :
                  log.type === 'alert' ? "bg-red-500/5 text-red-500 border border-red-500/10" :
                  "bg-emerald-500/5 text-emerald-600 border border-emerald-500/10 animate-bounce"
                )}
              >
                <span className="opacity-50 shrink-0 font-bold">[{log.round > 0 ? `Tur ${log.round}` : 'Sistem'}]</span>
                <span className="truncate">{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
