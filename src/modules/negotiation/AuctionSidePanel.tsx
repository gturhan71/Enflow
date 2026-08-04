import { Gavel, Users, ShieldAlert, ArrowRight, RefreshCw, Award } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AuctionWinner { name: string; price: number; isUs: boolean }

export default function AuctionSidePanel({
  auctionState, numCompetitors, setNumCompetitors, initialDecrement, setInitialDecrement,
  decrementReductionPct, setDecrementReductionPct, floorCost, onLaunch,
  currentLowestBidVal, auctionRound, currentMinDecrement, ourStatus, ourLastBid, initialValue,
  auctionWinner, onFinalize, onNewAuction,
}: {
  auctionState: 'IDLE' | 'SETUP' | 'BIDDING' | 'FINISHED';
  numCompetitors: number;
  setNumCompetitors: (n: number) => void;
  initialDecrement: number;
  setInitialDecrement: (n: number) => void;
  decrementReductionPct: number;
  setDecrementReductionPct: (n: number) => void;
  floorCost: number;
  onLaunch: () => void;
  currentLowestBidVal: number;
  auctionRound: number;
  currentMinDecrement: number;
  ourStatus: 'ACTIVE' | 'WITHDRAWN' | 'ELIMINATED';
  ourLastBid: number;
  initialValue: number;
  auctionWinner: AuctionWinner | null;
  onFinalize: () => void;
  onNewAuction: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-8 rounded-[40px] border border-white/60 bg-white/40 shadow-sm space-y-6">

        {/* Live Info Banner */}
        <div className="flex flex-col items-center text-center p-6 bg-slate-900 text-white rounded-[32px] relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-4">
            <Gavel size={16} className="text-amber-400 animate-spin" />
          </div>
          <div className="w-16 h-16 bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center mb-3">
            <Users size={32} />
          </div>
          <h5 className="font-black text-md tracking-tight leading-none">Açık Eksiltme İhalesi</h5>
          <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mt-1">Çoklu Rakip Platformu</p>
        </div>

        {auctionState === 'SETUP' ? (
          // Setup Form
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Katılımcı Rakip Firma Sayısı</label>
              <input
                type="number"
                min={2}
                max={5}
                value={numCompetitors}
                onChange={(e) => setNumCompetitors(parseInt(e.target.value) || 2)}
                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">İlk Tur Min Eksiltme Adımı ($)</label>
              <input
                type="text"
                value={initialDecrement}
                onChange={(e) => setInitialDecrement(parseInt(e.target.value.replace(/\D/g, '')) || 1000)}
                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tur Başı Eksiltme Azalma Oranı (%)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={decrementReductionPct}
                  onChange={(e) => setDecrementReductionPct(parseInt(e.target.value) || 0)}
                  className="flex-1 accent-slate-900"
                />
                <span className="text-sm font-black text-slate-900 shrink-0">%{decrementReductionPct}</span>
              </div>
              <p className="text-[9px] text-slate-400 mt-1.5 leading-normal">Her turda minimum zorunlu teklif düşüş miktarı bu oranda azaltılarak pazarlık sıkılaştırılır.</p>
            </div>

            <div className="p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
              <span className="text-[9px] font-black text-red-500/70 uppercase tracking-widest block">En Dip Maliyet Sınırımız</span>
              <span className="text-lg font-black text-red-600">${floorCost.toLocaleString()}</span>
            </div>

            <button
              onClick={onLaunch}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl text-xs font-black shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] active:scale-95 mt-4"
            >
              İhaleyi Canlı Başlat <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          // Active Game Stats
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Mevcut En Düşük Teklif</span>
                <span className="text-xl font-black text-slate-900">${currentLowestBidVal.toLocaleString()}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Aktif Tur</span>
                <span className="text-lg font-black text-primary">Tur {auctionRound}</span>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
              <div>
                <span className="text-[9px] font-black text-amber-500/70 uppercase tracking-widest block">Zorunlu Eksiltme Limiti</span>
                <span className="text-lg font-black text-amber-600">-$${currentMinDecrement.toLocaleString()}</span>
              </div>
              <p className="text-[9px] text-amber-500/80 font-bold uppercase tracking-tighter mt-1 max-w-[120px] text-right leading-none">Bu tur için geçerli en az indirim adımı.</p>
            </div>

            <div className="flex justify-between items-center p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
              <div>
                <span className="text-[9px] font-black text-red-500/70 uppercase tracking-widest block">En Dip Maliyet Sınırımız</span>
                <span className="text-lg font-black text-red-600">${floorCost.toLocaleString()}</span>
              </div>
              <div className="text-right bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                <ShieldAlert size={10} /> ZIRHLI LİMİT
              </div>
            </div>

            {ourStatus === 'ACTIVE' && (
              <div className="p-6 rounded-[28px] bg-slate-950 text-white space-y-4 shadow-xl">
                <div className="flex justify-between text-xs font-bold text-slate-400">
                  <span>Zarar Eşiğimiz</span>
                  <span>Marjımız: %{(((ourLastBid - floorCost) / ourLastBid) * 100).toFixed(1)}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700/50">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      (((ourLastBid - floorCost) / ourLastBid) * 100) >= 15 ? "bg-emerald-500" :
                      (((ourLastBid - floorCost) / ourLastBid) * 100) >= 8 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${Math.max(5, Math.min(100, (((ourLastBid - floorCost) / (initialValue - floorCost)) * 100)))}%` }}
                  />
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase font-bold">Bizim Son Teklifimiz</span>
                    <span className="text-xl font-black italic text-emerald-400">${ourLastBid.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {auctionWinner && (
              <div className={cn(
                "p-6 rounded-[32px] border-2 flex flex-col items-center justify-center text-center gap-2 shadow-md",
                auctionWinner.isUs ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
              )}>
                <Award className={cn("w-10 h-10 mb-1", auctionWinner.isUs ? "text-emerald-500 animate-bounce" : "text-red-500")} />
                <h6 className="font-black uppercase tracking-widest text-slate-900 text-sm">{auctionWinner.isUs ? 'İHALEYİ KAZANDIK!' : 'İHALE KAYBEDİLDİ'}</h6>
                <p className="text-xs text-slate-500 font-bold max-w-[200px] leading-tight">
                  {auctionWinner.name} firması **$${auctionWinner.price.toLocaleString()}** teklifi ile işi aldı.
                </p>

                {auctionWinner.isUs && (
                  <button
                    onClick={onFinalize}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest mt-4 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    Anlaşmayı Kazanıldı Olarak Tescil Et
                  </button>
                )}
              </div>
            )}

            {auctionState === 'FINISHED' && (
              <button
                onClick={onNewAuction}
                className="w-full bg-white text-slate-700 border border-slate-200 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <RefreshCw size={12} /> Yeni İhale Kur
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
