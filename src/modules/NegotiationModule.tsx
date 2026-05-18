import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Gavel, 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  MessageSquare, 
  User as UserIcon, 
  Bot, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Sparkles, 
  ArrowRight,
  RefreshCw,
  Zap,
  Percent
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Opportunity, TodoTask } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { cn } from '../lib/utils';

interface Message {
  sender: 'customer' | 'manager' | 'system';
  text: string;
  time: string;
  price?: number;
}

const NegotiationModule = ({
  opportunities = [],
  setOpportunities,
  setActiveTab
}: {
  opportunities: Opportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  setActiveTab?: (tab: string) => void;
}) => {
  const { currentUser } = useAuth();
  
  // Rule: Only Satış Birim Yöneticisi (GENERAL_MANAGER / or specified permissions) can access
  const isAuthorized = useMemo(() => {
    return currentUser?.role === 'GENERAL_MANAGER';
  }, [currentUser]);

  const [selectedOppId, setSelectedOppId] = useState('');
  const [negotiationState, setNegotiationState] = useState<'IDLE' | 'INTRO' | 'NEGOTIATING' | 'AGREED' | 'FAILED'>('IDLE');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentOffer, setCurrentOffer] = useState<number>(0);
  const [customerOffer, setCustomerOffer] = useState<number>(0);
  const [customCounter, setCustomCounter] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [concessionCounter, setConcessionCounter] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Find selected opportunity
  const selectedOpp = useMemo(() => {
    return opportunities.find(o => o.id === selectedOppId);
  }, [opportunities, selectedOppId]);

  // Calculate absolute floor cost (En Dip Maliyet) from CostAnalysis logic
  const floorCost = useMemo(() => {
    if (!selectedOpp) return 0;
    const bomCost = (selectedOpp.bomItems || []).reduce((sum, item) => sum + (item.purchaseCost * item.quantity), 0);
    const otherCost = (selectedOpp.costItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const total = bomCost + otherCost;
    // Fallback: If no costs analysis exists, assume floor price is 70% of opportunity value
    return total > 0 ? total : Math.round(selectedOpp.value * 0.7);
  }, [selectedOpp]);

  // Initial pricing targets
  const initialValue = selectedOpp?.value || 0;
  const initialMargin = useMemo(() => {
    if (initialValue === 0) return 0;
    return ((initialValue - floorCost) / initialValue) * 100;
  }, [initialValue, floorCost]);

  // Handle auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Access Denied Screen
  if (!isAuthorized) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center bg-slate-50/50">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-panel p-12 max-w-md w-full rounded-[40px] text-center border border-red-200/40 bg-white/60 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-2 bg-red-500" />
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/10">
            <Lock size={40} className="animate-pulse" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Erişim Engellendi</h3>
          <p className="text-sm text-slate-500 font-bold mt-4 leading-relaxed">
            Pazarlık Modülü ve Canlı Simülasyon paneli sadece **Satış Birim Yöneticisine (Genel Müdür)** yetkilendirilmiştir.
          </p>
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-2">
            <p className="text-xs text-slate-400 font-medium">Mevcut Rolünüz: <span className="font-bold text-slate-600">{currentUser?.role || 'Bilinmiyor'}</span></p>
            {setActiveTab && (
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className="mt-4 bg-slate-900 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all active:scale-95"
              >
                KOKPİTE GERİ DÖN
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  const addMessage = (sender: 'customer' | 'manager' | 'system', text: string, price?: number) => {
    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setMessages(prev => [...prev, { sender, text, time, price }]);
  };

  const startNegotiationSim = () => {
    if (!selectedOpp) return;
    setNegotiationState('INTRO');
    setConcessionCounter(0);
    setCurrentOffer(initialValue);
    
    // Generates starting customer offer (usually 15-25% below current proposal price but above or close to cost)
    const idealCustomerOffer = Math.round(initialValue * 0.78);
    // Make sure customer offer isn't below floorCost immediately, if possible
    const startingCustomerOffer = Math.max(idealCustomerOffer, Math.round(floorCost * 0.95));
    setCustomerOffer(startingCustomerOffer);

    setMessages([]);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      addMessage('system', `Pazarlık simülasyonu başlatıldı. Fırsat: ${selectedOpp.title} | En Dip Maliyet Sınırı: $${floorCost.toLocaleString()}`);
      
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addMessage('customer', `Merhaba Sayın Yetkili. ${selectedOpp.title} projeniz için hazırladığınız teklifi aldık. Teknik detaylar gayet iyi ancak fiyat bütçemizi epey zorluyor. Bizim bütçemiz en fazla $${startingCustomerOffer.toLocaleString()} seviyesinde. Bu rakama anlaşabilir miyiz?`);
        setNegotiationState('NEGOTIATING');
      }, 2000);
    }, 1000);
  };

  // Negotiation Logic AI Core
  const handleManagerCounter = (offerPrice: number) => {
    if (offerPrice <= 0 || isNaN(offerPrice)) return;
    
    // 1. Log manager counter offer
    addMessage('manager', `Bizim teklifimiz: $${offerPrice.toLocaleString()}`, offerPrice);
    setCurrentOffer(offerPrice);
    setIsTyping(true);

    const marginPercentage = ((offerPrice - floorCost) / offerPrice) * 100;
    
    setTimeout(() => {
      setIsTyping(false);

      // Edge Case: Offer is BELOW floor cost!
      if (offerPrice < floorCost) {
        addMessage('system', `KRİTİK UYARI: Girilen teklif ($${offerPrice.toLocaleString()}) en dip maliyetin ($${floorCost.toLocaleString()}) altındadır! Şirket bu fiyata zarar edeceği için onay vermemektedir.`);
        addMessage('customer', `Teklifiniz bütçemize çok uygun ancak şirketinizin bu fiyatla zarar edeceğini düşünüyoruz. İş birliğimizin sağlıklı yürümesi için adil bir fiyatta mutabık kalmalıyız.`);
        return;
      }

      // Concession counter check
      const newConcession = concessionCounter + 1;
      setConcessionCounter(newConcession);

      // Customer Decision Algorithm
      // Accept condition: offerPrice is within 5% of customer's target budget OR if margin is extremely low and we are at the bottom.
      const priceDiffPct = ((offerPrice - customerOffer) / customerOffer) * 100;

      if (priceDiffPct <= 3 || (offerPrice === floorCost && Math.random() > 0.4)) {
        // ACCEPT DEAL
        addMessage('customer', `Harika! $${offerPrice.toLocaleString()} fiyatı bizim için kabul edilebilir bir seviyedir. Bu şartlar altında anlaşmayı sağlamaktan memnuniyet duyuyoruz. Evrak işlerini başlatabiliriz!`);
        addMessage('system', `MUTABAKAT SAĞLANDI! Anlaşma Fiyatı: $${offerPrice.toLocaleString()} | Brüt Kar: $${(offerPrice - floorCost).toLocaleString()} (%${marginPercentage.toFixed(1)} marj).`);
        setNegotiationState('AGREED');
      } else if (newConcession >= 5) {
        // Customer walks away if negotiation drags too long without progress
        addMessage('customer', `Üzgünüm, müzakerede ortak bir noktada buluşamadık. Bizim bütçe sınırımız çok net. Masadan kalkmak durumundayız. İyi çalışmalar dileriz.`);
        addMessage('system', `Pazarlık başarısızlıkla sonuçlandı. Müşteri masadan kalktı.`);
        setNegotiationState('FAILED');
      } else {
        // COUNTER-OFFER BY CUSTOMER
        // Increment customer's budget slightly based on how cooperative the manager is
        let increment = 0;
        if (offerPrice < currentOffer) {
          // Manager made a discount concession, customer responds cooperatively
          const managerConcession = currentOffer - offerPrice;
          increment = Math.round(managerConcession * 0.45);
        } else {
          // Manager didn't budge
          increment = Math.round(customerOffer * 0.02);
        }

        const nextCustomerOffer = Math.min(Math.round(customerOffer + increment), offerPrice - 100);
        setCustomerOffer(nextCustomerOffer);

        const responseTexts = [
          `Fiyatı biraz daha esnettik fakat $${offerPrice.toLocaleString()} hala yüksek. Biz teklifimizi $${nextCustomerOffer.toLocaleString()} seviyesine çıkartabiliriz. Ne dersiniz?`,
          `Adım attığınız için teşekkürler ancak bütçemiz tam olarak buna elvermiyor. $${nextCustomerOffer.toLocaleString()} seviyesine inebilirseniz yönetimden hızlıca onay alabilirim.`,
          `Bize biraz daha destek olmanız gerekiyor. $${nextCustomerOffer.toLocaleString()} olarak güncellersek el sıkışmaya hazırız.`
        ];
        
        const randomText = responseTexts[Math.floor(Math.random() * responseTexts.length)];
        addMessage('customer', randomText);
      }
    }, 2000);
  };

  const handleCustomCounterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customCounter.replace(/\D/g, ''));
    if (!val) return;
    handleManagerCounter(val);
    setCustomCounter('');
  };

  // Finish Negotiation and Lock in Database
  const handleFinalizeDeal = async () => {
    if (!selectedOpp) return;
    
    try {
      // 1. Update opportunity status to WON, value to negotiated price
      const updatedOpp = await apiService.updateOpportunity(selectedOpp.id, {
        status: 'WON',
        value: currentOffer
      });

      // 2. Refresh local state
      setOpportunities(prev => prev.map(o => o.id === selectedOpp.id ? { ...o, status: 'WON', value: currentOffer } : o));

      alert(`Pazarlık başarıyla tescillendi! Fırsat KAZANILDI durumuna getirildi ve revize edilmiş bedel $${currentOffer.toLocaleString()} olarak sisteme işlendi.`);
      
      if (setActiveTab) {
        // Redirect to contract page
        setActiveTab('contracts');
      } else {
        setNegotiationState('IDLE');
        setSelectedOppId('');
      }
    } catch (err: any) {
      alert(err.message || 'Pazarlık tescil edilirken hata oluştu.');
    }
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-sans bg-slate-50/30 custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-3 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/5">
              <Gavel size={26} />
            </span>
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Canlı Pazarlık Kokpiti</h3>
              <p className="text-slate-500 font-medium text-xs mt-2">Müşteri fırsatları ve teknik maliyetler üzerinden akıllı, dip maliyet korumalı yapay pazarlık simülatörü.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select 
            value={selectedOppId}
            disabled={negotiationState === 'NEGOTIATING'}
            onChange={(e) => {
              setSelectedOppId(e.target.value);
              setNegotiationState('IDLE');
              setMessages([]);
            }}
            className="bg-white border border-slate-100 px-6 py-3.5 rounded-[20px] text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/5 outline-none min-w-[320px] transition-all cursor-pointer disabled:opacity-50"
          >
            <option value="">Pazarlık Edilecek Fırsatı Seçin</option>
            {opportunities
              .filter(o => o.status === 'NEGOTIATION' || o.status === 'PROPOSAL')
              .map(opp => (
                <option key={opp.id} value={opp.id}>{opp.title} (${opp.value?.toLocaleString()})</option>
              ))
            }
          </select>
        </div>
      </div>

      {!selectedOppId ? (
        <div className="glass-panel p-20 rounded-[40px] border-dashed flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-[32px] flex items-center justify-center mb-6">
            <Gavel size={48} />
          </div>
          <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">İşlem Yapılacak Fırsatı Seçin</h4>
          <p className="text-sm text-slate-400 font-bold max-w-sm mt-2">Pazarlık odasına girmek ve simülasyonu başlatmak için yukarıdaki listeden aktif bir fırsat seçerek devam edin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Müşteri ve Maliyet Analiz Paneli */}
          <div className="space-y-6">
            <div className="glass-panel p-8 rounded-[40px] border border-white/60 bg-white/40 shadow-sm space-y-6">
              
              {/* Negotiator Avatar Section */}
              <div className="flex flex-col items-center text-center p-6 bg-slate-900 text-white rounded-[32px] relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 p-4">
                  <Sparkles size={16} className="text-emerald-400 animate-pulse" />
                </div>
                <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mb-4 shadow-lg">
                  <Bot size={40} className={cn(isTyping && "animate-bounce")} />
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

                {negotiationState !== 'IDLE' && (
                  <div className="p-6 rounded-[28px] bg-slate-950 text-white space-y-4 shadow-xl">
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                      <span>Pazarlık Süreci</span>
                      <span>Marj: %{(((currentOffer - floorCost) / currentOffer) * 100).toFixed(1)}</span>
                    </div>
                    {/* Live negotiation dynamic bar */}
                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700/50">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          (((currentOffer - floorCost) / currentOffer) * 100) >= 15 ? "bg-emerald-500" :
                          (((currentOffer - floorCost) / currentOffer) * 100) >= 8 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${Math.max(5, Math.min(100, (((currentOffer - floorCost) / (initialValue - floorCost)) * 100)))}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-bold">Mevcut Teklifiniz</span>
                        <span className="text-xl font-black italic text-emerald-400">${currentOffer.toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 block uppercase font-bold">Müşteri Hedefi</span>
                        <span className="text-xl font-black italic text-slate-300">${customerOffer.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {negotiationState === 'IDLE' && (
                <button 
                  onClick={startNegotiationSim}
                  className="w-full bg-primary text-white py-4 rounded-2xl text-xs font-black shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] active:scale-95"
                >
                  <Zap size={16} /> Simülasyonu Başlat
                </button>
              )}

              {negotiationState === 'AGREED' && (
                <button 
                  onClick={handleFinalizeDeal}
                  className="w-full bg-emerald-500 text-white py-4 rounded-2xl text-xs font-black shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] active:scale-95 animate-pulse"
                >
                  <CheckCircle2 size={18} /> Anlaşmayı Tescil Et (Won)
                </button>
              )}

              {(negotiationState === 'FAILED' || negotiationState === 'AGREED') && (
                <button 
                  onClick={startNegotiationSim}
                  className="w-full bg-white text-slate-700 border border-slate-200 py-4 rounded-2xl text-xs font-black hover:bg-slate-50 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] active:scale-95"
                >
                  <RefreshCw size={14} /> Tekrar Dene
                </button>
              )}

            </div>
          </div>

          {/* Canlı Chat Simülatör Alanı */}
          <div className="lg:col-span-2 flex flex-col h-[650px] glass-panel rounded-[40px] overflow-hidden border border-white/60 bg-white/40 shadow-sm">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest italic">Müzakere Odası (Canlı)</span>
              </div>
              <div className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                Adım: {concessionCounter} / 5
              </div>
            </div>

            {/* Chat Messages Panel */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50/20">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center space-y-4">
                  <MessageSquare size={36} className="text-slate-300" />
                  <p className="font-bold text-xs uppercase tracking-widest italic">Simülasyon başlatılmayı bekliyor.</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
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

              {/* Typing indicator */}
              {isTyping && (
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
            {negotiationState === 'NEGOTIATING' && (
              <div className="p-6 border-t border-slate-100 bg-white/80 backdrop-blur-md space-y-4">
                
                {/* Quick actions row */}
                <div className="flex flex-wrap gap-2.5">
                  <button 
                    onClick={() => handleManagerCounter(Math.round(currentOffer * 0.97))}
                    className="px-4 py-2 border border-slate-200 hover:border-slate-800 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Percent size={12} /> %3 İndirim
                  </button>
                  <button 
                    onClick={() => handleManagerCounter(Math.round(currentOffer * 0.95))}
                    className="px-4 py-2 border border-slate-200 hover:border-slate-800 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Percent size={12} /> %5 İndirim
                  </button>
                  <button 
                    onClick={() => handleManagerCounter(Math.round(currentOffer * 0.90))}
                    className="px-4 py-2 border border-slate-200 hover:border-slate-800 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Percent size={12} /> %10 İndirim
                  </button>
                  <button 
                    onClick={() => handleManagerCounter(floorCost)}
                    className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95 ml-auto"
                    title="Maksimum indirim sınırı"
                  >
                    <ShieldAlert size={12} /> EN DİP FİYATI VER (${floorCost.toLocaleString()})
                  </button>
                </div>

                {/* Counter-offer inputs form */}
                <form onSubmit={handleCustomCounterSubmit} className="flex gap-4">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      value={customCounter}
                      onChange={(e) => setCustomCounter(e.target.value)}
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
            {negotiationState === 'AGREED' && (
              <div className="p-8 border-t border-slate-100 bg-emerald-500/5 flex items-center justify-between">
                <div>
                  <h6 className="font-black text-slate-900 text-md uppercase italic tracking-tighter">Müzakere Tamamlandı</h6>
                  <p className="text-xs font-medium text-slate-500">Mutabık kalınan bedel ile anlaşma imzalanmaya hazır.</p>
                </div>
                <button 
                  onClick={handleFinalizeDeal}
                  className="bg-emerald-500 text-white px-8 py-4 rounded-2xl text-xs font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest"
                >
                  KAZANILDI OLARAK KAYDET <ArrowRight size={14} />
                </button>
              </div>
            )}

            {/* Failed Finished Panel */}
            {negotiationState === 'FAILED' && (
              <div className="p-8 border-t border-slate-100 bg-red-500/5 flex items-center justify-between">
                <div>
                  <h6 className="font-black text-red-600 text-md uppercase italic tracking-tighter">Masa Dağıldı</h6>
                  <p className="text-xs font-medium text-slate-500">Müşteri teklifi reddetti ve müzakereyi sonlandırdı.</p>
                </div>
                <button 
                  onClick={startNegotiationSim}
                  className="bg-red-500 text-white px-8 py-4 rounded-2xl text-xs font-black shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest"
                >
                  MÜZAKEREYİ YENİDEN BAŞLAT
                </button>
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
};

export default NegotiationModule;
