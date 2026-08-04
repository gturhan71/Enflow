import type { RefObject, FormEvent } from 'react';
import { MessageSquare, User as UserIcon, Bot, Zap, Percent, ShieldAlert, DollarSign, ArrowRight, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { Message } from './types';

export default function ChatWindow({
  chatConcessions, chatMessages, chatIsTyping, chatEndRef, chatState, chatOffer, floorCost,
  chatCustomCounter, setChatCustomCounter, onCustomCounterSubmit, onQuickCounter,
  onFinalize, onRestart, onMarkLost,
}: {
  chatConcessions: number;
  chatMessages: Message[];
  chatIsTyping: boolean;
  chatEndRef: RefObject<HTMLDivElement | null>;
  chatState: 'IDLE' | 'INTRO' | 'NEGOTIATING' | 'AGREED' | 'FAILED';
  chatOffer: number;
  floorCost: number;
  chatCustomCounter: string;
  setChatCustomCounter: (v: string) => void;
  onCustomCounterSubmit: (e: FormEvent) => void;
  onQuickCounter: (price: number) => void;
  onFinalize: () => void;
  onRestart: () => void;
  onMarkLost: () => void;
}) {
  return (
    <div className="lg:col-span-2 flex flex-col h-[650px] glass-panel rounded-[40px] overflow-hidden border border-white/60 bg-white/40 shadow-sm">

      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-black text-slate-800 uppercase tracking-widest italic">Müzakere Odası (Canlı)</span>
        </div>
        <div className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
          Adım: {chatConcessions} / 5
        </div>
      </div>

      {/* Chat Messages Panel */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50/20">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center space-y-4">
            <MessageSquare size={36} className="text-slate-300" />
            <p className="font-bold text-xs uppercase tracking-widest italic">Simülasyon başlatılmayı bekliyor.</p>
          </div>
        ) : (
          chatMessages.map((msg, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={idx}
              className={cn(
                "flex items-start gap-4 max-w-[80%]",
                msg.sender === 'manager' ? "ml-auto flex-row-reverse" :
                msg.sender === 'system' ? "mx-auto max-w-[95%] w-full" : ""
              )}
            >
              {msg.sender !== 'system' && (
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md",
                  msg.sender === 'manager' ? "bg-slate-900 text-white" : "bg-emerald-500 text-white"
                )}>
                  {msg.sender === 'manager' ? <UserIcon size={18} /> : <Bot size={18} />}
                </div>
              )}

              {msg.sender === 'system' ? (
                <div className="w-full bg-slate-100 border border-slate-200 p-4 rounded-2xl text-[10px] font-bold text-slate-500 text-center tracking-tight flex items-center justify-center gap-2">
                  <Zap size={12} className="text-primary" /> {msg.text}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className={cn(
                    "p-5 rounded-[24px] text-sm shadow-sm leading-relaxed",
                    msg.sender === 'manager'
                      ? "bg-slate-900 text-white rounded-tr-none"
                      : "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                  <span className={cn(
                    "text-[9px] text-slate-400 font-bold block px-2",
                    msg.sender === 'manager' && "text-right"
                  )}>{msg.time}</span>
                </div>
              )}
            </motion.div>
          ))
        )}

        {chatIsTyping && (
          <div className="flex items-start gap-4 max-w-[80%]">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Bot size={18} />
            </div>
            <div className="bg-white border border-slate-100 p-4 rounded-[24px] rounded-tl-none text-slate-400 text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Manager Inputs Panel */}
      {chatState === 'NEGOTIATING' && (
        <div className="p-6 border-t border-slate-100 bg-white/80 backdrop-blur-md space-y-4">

          {/* Quick actions row */}
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => onQuickCounter(Math.round(chatOffer * 0.97))}
              className="px-4 py-2 border border-slate-200 hover:border-slate-800 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Percent size={12} /> %3 İndirim
            </button>
            <button
              onClick={() => onQuickCounter(Math.round(chatOffer * 0.95))}
              className="px-4 py-2 border border-slate-200 hover:border-slate-800 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Percent size={12} /> %5 İndirim
            </button>
            <button
              onClick={() => onQuickCounter(Math.round(chatOffer * 0.90))}
              className="px-4 py-2 border border-slate-200 hover:border-slate-800 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Percent size={12} /> %10 İndirim
            </button>
            <button
              onClick={() => onQuickCounter(floorCost)}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95 ml-auto"
              title="Maksimum indirim sınırı"
            >
              <ShieldAlert size={12} /> EN DİP FİYATI VER (${floorCost.toLocaleString()})
            </button>
          </div>

          <form onSubmit={onCustomCounterSubmit} className="flex gap-4">
            <div className="relative flex-1">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={chatCustomCounter}
                onChange={(e) => setChatCustomCounter(e.target.value)}
                placeholder="Karşı teklif fiyatı girin... (Örn: 220000)"
                className="w-full pl-10 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-slate-900/5 outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              className="bg-slate-900 text-white px-8 rounded-2xl text-xs font-black shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest"
            >
              Teklifi İlet <ArrowRight size={14} />
            </button>
          </form>

        </div>
      )}

      {/* Agreed Finished Panel */}
      {chatState === 'AGREED' && (
        <div className="p-8 border-t border-slate-100 bg-emerald-500/5 flex items-center justify-between">
          <div>
            <h6 className="font-black text-slate-900 text-md uppercase italic tracking-tighter">Müzakere Tamamlandı</h6>
            <p className="text-xs font-medium text-slate-500">Mutabık kalınan bedel ile anlaşma imzalanmaya hazır.</p>
          </div>
          <button
            onClick={onFinalize}
            className="bg-emerald-500 text-white px-8 py-4 rounded-2xl text-xs font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest"
          >
            KAZANILDI OLARAK KAYDET <ArrowRight size={14} />
          </button>
        </div>
      )}

      {chatState === 'FAILED' && (
        <div className="p-8 border-t border-slate-100 bg-red-500/5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h6 className="font-black text-red-600 text-md uppercase italic tracking-tighter">Masa Dağıldı</h6>
            <p className="text-xs font-medium text-slate-500">Müşteri teklifi reddetti ve müzakereyi sonlandırdı.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={onMarkLost}
              className="bg-slate-700 text-white px-6 py-3 rounded-2xl text-xs font-black hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest"
            >
              <XCircle size={13} /> Kaybedildi Olarak İşaretle
            </button>
            <button
              onClick={onRestart}
              className="bg-red-500 text-white px-8 py-4 rounded-2xl text-xs font-black shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest"
            >
              MÜZAKEREYİ YENİDEN BAŞLAT
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
