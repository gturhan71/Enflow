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
  Percent,
  Users,
  Award,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Opportunity, Proposal } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { cn } from '../lib/utils';

// Types for Auction Simulation
interface Competitor {
  id: string;
  name: string;
  lastBid: number;
  isActive: boolean;
  floorPrice: number; // Invisible to user, determines when they drop out
  avatarColor: string;
}

interface Message {
  sender: 'customer' | 'manager' | 'system' | 'competitor';
  text: string;
  time: string;
  price?: number;
}

const NegotiationModule = ({
  opportunities = [],
  setOpportunities,
  proposals = [],
  setActiveTab
}: {
  opportunities: Opportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  proposals?: Proposal[];
  setActiveTab?: (tab: string) => void;
}) => {
  const { currentUser } = useAuth();
  
  // Tab control: 'canli' (1v1 Chat) or 'eksiltme' (Reverse Auction)
  const [activeMode, setActiveMode] = useState<'canli' | 'eksiltme'>('canli');

  // Rule: Only Satış Birim Yöneticisi (GENERAL_MANAGER) can access
  const isAuthorized = useMemo(() => {
    return currentUser?.role === 'GENERAL_MANAGER';
  }, [currentUser]);

  // Filter proposals marked as "Pazarlığa Açık"
  const openProposals = useMemo(() => {
    return proposals.filter(p => {
      if (p.openForNegotiation === true) return true;
      if (p.content) {
        try {
          const content = typeof p.content === 'string' ? JSON.parse(p.content) : p.content;
          return content && content.openForNegotiation === true;
        } catch (e) {
          return false;
        }
      }
      return false;
    });
  }, [proposals]);

  const [selectedProposalId, setSelectedProposalId] = useState('');
  const [selectedOppId, setSelectedOppId] = useState('');
  
  // Get currently selected proposal
  const selectedProposal = useMemo(() => {
    return openProposals.find(p => p.id === selectedProposalId);
  }, [openProposals, selectedProposalId]);

  // Auto-sync Opportunity ID when proposal is selected
  useEffect(() => {
    if (selectedProposal) {
      setSelectedOppId(selectedProposal.opportunityId);
    } else {
      setSelectedOppId('');
    }
  }, [selectedProposal]);

  // Find selected opportunity
  const selectedOpp = useMemo(() => {
    return opportunities.find(o => o.id === selectedOppId);
  }, [opportunities, selectedOppId]);

  // Calculate absolute floor cost (En Dip Maliyet)
  const floorCost = useMemo(() => {
    if (!selectedOpp) return 0;
    const bomCost = (selectedOpp.bomItems || []).reduce((sum, item) => sum + (item.purchaseCost * item.quantity), 0);
    const otherCost = (selectedOpp.costItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const total = bomCost + otherCost;
    return total > 0 ? total : Math.round(selectedOpp.value * 0.7);
  }, [selectedOpp]);

  // Determine initialValue from selectedProposal total price or fallback to opportunity value
  const initialValue = useMemo(() => {
    if (selectedProposal) {
      if (selectedProposal.totalPrice) return selectedProposal.totalPrice;
      if (selectedProposal.content) {
        try {
          const content = typeof selectedProposal.content === 'string' 
            ? JSON.parse(selectedProposal.content) 
            : selectedProposal.content;
          return content.totalPrice || selectedOpp?.value || 0;
        } catch (e) {}
      }
    }
    return selectedOpp?.value || 0;
  }, [selectedProposal, selectedOpp]);
  const initialMargin = useMemo(() => {
    if (initialValue === 0) return 0;
    return ((initialValue - floorCost) / initialValue) * 100;
  }, [initialValue, floorCost]);

  // --- STATE FOR 1v1 LIVE CHAT NEGOTIATION ---
  const [chatState, setChatState] = useState<'IDLE' | 'INTRO' | 'NEGOTIATING' | 'AGREED' | 'FAILED'>('IDLE');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatOffer, setChatOffer] = useState<number>(0);
  const [chatCustomerTarget, setChatCustomerTarget] = useState<number>(0);
  const [chatCustomCounter, setChatCustomCounter] = useState<string>('');
  const [chatIsTyping, setChatIsTyping] = useState(false);
  const [chatConcessions, setChatConcessions] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- STATE FOR MULTI-COMPETITOR REVERSE AUCTION ---
  const [auctionState, setAuctionState] = useState<'IDLE' | 'SETUP' | 'BIDDING' | 'FINISHED'>('IDLE');
  const [numCompetitors, setNumCompetitors] = useState<number>(3);
  const [initialDecrement, setInitialDecrement] = useState<number>(5000);
  const [decrementReductionPct, setDecrementReductionPct] = useState<number>(20); // Decrement shrinks by 20% each round
  
  const [auctionRound, setAuctionRound] = useState<number>(1);
  const [currentMinDecrement, setCurrentMinDecrement] = useState<number>(5000);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [ourLastBid, setOurLastBid] = useState<number>(0);
  const [ourStatus, setOurStatus] = useState<'ACTIVE' | 'WITHDRAWN' | 'ELIMINATED'>('ACTIVE');
  const [auctionLog, setAuctionLog] = useState<{ round: number; text: string; type: 'info' | 'bid' | 'alert' | 'success' }[]>([]);
  const [manualBidInput, setManualBidInput] = useState<string>('');
  const [auctionWinner, setAuctionWinner] = useState<{ name: string; price: number; isUs: boolean } | null>(null);
  const [roundCalculated, setRoundCalculated] = useState<boolean>(false);

  // States for manual reverse auction inputs
  const [manualBids, setManualBids] = useState<Record<string, string>>({});
  const [withdrawals, setWithdrawals] = useState<Record<string, boolean>>({});

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatIsTyping]);

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

  // --- 1v1 CHAT SIMULATION HANDLERS ---
  const addChatMessage = (sender: 'customer' | 'manager' | 'system', text: string, price?: number) => {
    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setChatMessages(prev => [...prev, { sender, text, time, price }]);
  };

  const startChatSim = () => {
    if (!selectedOpp) return;
    setChatState('INTRO');
    setChatConcessions(0);
    setChatOffer(initialValue);
    
    const idealTarget = Math.round(initialValue * 0.78);
    const startingCustomerOffer = Math.max(idealTarget, Math.round(floorCost * 0.95));
    setChatCustomerTarget(startingCustomerOffer);

    setChatMessages([]);
    setChatIsTyping(true);

    setTimeout(() => {
      setChatIsTyping(false);
      addChatMessage('system', `Pazarlık simülasyonu başlatıldı. Fırsat: ${selectedOpp.title} | En Dip Maliyet Sınırı: $${floorCost.toLocaleString()}`);
      
      setChatIsTyping(true);
      setTimeout(() => {
        setChatIsTyping(false);
        addChatMessage('customer', `Merhaba Sayın Yetkili. ${selectedOpp.title} projeniz için hazırladığınız teklifi aldık. Teknik detaylar gayet iyi ancak fiyat bütçemizi epey zorluyor. Bizim bütçemiz en fazla $${startingCustomerOffer.toLocaleString()} seviyesinde. Bu rakama anlaşabilir miyiz?`);
        setChatState('NEGOTIATING');
      }, 2000);
    }, 1000);
  };

  const handleChatCounter = (offerPrice: number) => {
    if (offerPrice <= 0 || isNaN(offerPrice)) return;
    
    addChatMessage('manager', `Bizim teklifimiz: $${offerPrice.toLocaleString()}`, offerPrice);
    setChatOffer(offerPrice);
    setChatIsTyping(true);

    const marginPercentage = ((offerPrice - floorCost) / offerPrice) * 100;
    
    setTimeout(() => {
      setChatIsTyping(false);

      if (offerPrice < floorCost) {
        addChatMessage('system', `KRİTİK UYARI: Girilen teklif ($${offerPrice.toLocaleString()}) en dip maliyetin ($${floorCost.toLocaleString()}) altındadır! Şirket bu fiyata zarar edeceği için onay vermemektedir.`);
        addChatMessage('customer', `Teklifiniz bütçemize çok uygun ancak şirketinizin bu fiyatla zarar edeceğini düşünüyoruz. İş birliğimizin sağlıklı yürümesi için adil bir fiyatta mutabık kalmalıyız.`);
        return;
      }

      const newConcession = chatConcessions + 1;
      setChatConcessions(newConcession);

      const priceDiffPct = ((offerPrice - chatCustomerTarget) / chatCustomerTarget) * 100;

      if (priceDiffPct <= 3 || (offerPrice === floorCost && Math.random() > 0.4)) {
        addChatMessage('customer', `Harika! $${offerPrice.toLocaleString()} fiyatı bizim için kabul edilebilir bir seviyedir. Bu şartlar altında anlaşmayı sağlamaktan memnuniyet duyuyoruz. Evrak işlerini başlatabiliriz!`);
        addChatMessage('system', `MUTABAKAT SAĞLANDI! Anlaşma Fiyatı: $${offerPrice.toLocaleString()} | Brüt Kar: $${(offerPrice - floorCost).toLocaleString()} (%${marginPercentage.toFixed(1)} marj).`);
        setChatState('AGREED');
      } else if (newConcession >= 5) {
        addChatMessage('customer', `Üzgünüm, müzakerede ortak bir noktada buluşamadık. Bizim bütçe sınırımız çok net. Masadan kalkmak durumundayız. İyi çalışmalar dileriz.`);
        addChatMessage('system', `Pazarlık başarısızlıkla sonuçlandı. Müşteri masadan kalktı.`);
        setChatState('FAILED');
      } else {
        let increment = 0;
        if (offerPrice < chatOffer) {
          const managerConcession = chatOffer - offerPrice;
          increment = Math.round(managerConcession * 0.45);
        } else {
          increment = Math.round(chatCustomerTarget * 0.02);
        }

        const nextCustomerOffer = Math.min(Math.round(chatCustomerTarget + increment), offerPrice - 100);
        setChatCustomerTarget(nextCustomerOffer);

        const responseTexts = [
          `Fiyatı biraz daha esnettik fakat $${offerPrice.toLocaleString()} hala yüksek. Biz teklifimizi $${nextCustomerOffer.toLocaleString()} seviyesine çıkartabiliriz. Ne dersiniz?`,
          `Adım attığınız için teşekkürler ancak bütçemiz tam olarak buna elvermiyor. $${nextCustomerOffer.toLocaleString()} seviyesine inebilirseniz yönetimden hızlıca onay alabilirim.`,
          `Bize biraz daha destek olmanız gerekiyor. $${nextCustomerOffer.toLocaleString()} olarak güncellersek el sıkışmaya hazırız.`
        ];
        
        const randomText = responseTexts[Math.floor(Math.random() * responseTexts.length)];
        addChatMessage('customer', randomText);
      }
    }, 2000);
  };

  const handleChatCustomCounterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(chatCustomCounter.replace(/\D/g, ''));
    if (!val) return;
    handleChatCounter(val);
    setChatCustomCounter('');
  };

  const handleFinalizeChatDeal = async () => {
    if (!selectedOpp) return;
    try {
      await apiService.updateOpportunity(selectedOpp.id, {
        status: 'WON',
        value: chatOffer
      });
      setOpportunities(prev => prev.map(o => o.id === selectedOpp.id ? { ...o, status: 'WON', value: chatOffer } : o));
      alert(`Pazarlık başarıyla tescillendi! Fırsat KAZANILDI durumuna getirildi ve revize edilmiş bedel $${chatOffer.toLocaleString()} olarak sisteme işlendi.`);
      if (setActiveTab) setActiveTab('contracts');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Hata oluştu.');
    }
  };

  // --- REVERSE AUCTION SIMULATION HANDLERS ---
  const startAuctionSetup = () => {
    if (!selectedOpp) return;
    setAuctionState('SETUP');
    // Set default initial decrement to 5% of opportunity value
    const defaultDec = Math.round(initialValue * 0.05);
    setInitialDecrement(defaultDec);
    setCurrentMinDecrement(defaultDec);
  };

  const launchAuction = () => {
    if (!selectedOpp) return;
    
    // Create competitors with realistic mock floor costs
    const colorPalettes = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    const mockCompetitors: Competitor[] = Array.from({ length: numCompetitors }).map((_, idx) => {
      const name = `Rakip Firma ${String.fromCharCode(65 + idx)}`;
      // Competitor floor is randomly set around our floor cost (between 85% to 115% of our floor)
      const floorMultiplier = 0.85 + (Math.random() * 0.3);
      const compFloor = Math.round(floorCost * floorMultiplier);
      
      return {
        id: `comp-${idx + 1}`,
        name,
        lastBid: initialValue,
        isActive: true,
        floorPrice: compFloor,
        avatarColor: colorPalettes[idx % colorPalettes.length]
      };
    });

    setCompetitors(mockCompetitors);
    setOurLastBid(initialValue);
    setOurStatus('ACTIVE');
    setAuctionRound(1);
    setCurrentMinDecrement(initialDecrement);
    setAuctionState('BIDDING');
    setRoundCalculated(false);
    setAuctionWinner(null);
    setManualBids({});
    setWithdrawals({});
    setAuctionLog([
      { round: 0, text: `Açık Eksiltme İhalesi Başlatıldı! Toplam ${numCompetitors} Rakip Firma İştirak Ediyor.`, type: 'info' },
      { round: 0, text: `Başlangıç Teklifi: $${initialValue.toLocaleString()} | İlk Tur Minimum Düşüş Şartı: $${initialDecrement.toLocaleString()}`, type: 'info' }
    ]);
  };

  // Helper values for current lowest bid in auction
  const currentLowestBidVal = useMemo(() => {
    if (competitors.length === 0) return initialValue;
    const activeBids = competitors.filter(c => c.isActive).map(c => c.lastBid);
    if (ourStatus === 'ACTIVE') activeBids.push(ourLastBid);
    return Math.min(...activeBids);
  }, [competitors, ourLastBid, ourStatus, initialValue]);

  // Memoized list of active participants in the round
  const activeParticipants = useMemo(() => {
    const list: { id: string; name: string; lastBid: number; isUs: boolean; avatarColor?: string }[] = [];
    if (ourStatus === 'ACTIVE') {
      list.push({ id: 'us', name: 'Biz (Enflow)', lastBid: ourLastBid, isUs: true });
    }
    competitors.forEach(c => {
      if (c.isActive) {
        list.push({ id: c.id, name: c.name, lastBid: c.lastBid, isUs: false, avatarColor: c.avatarColor });
      }
    });
    return list;
  }, [ourStatus, ourLastBid, competitors]);

  // Real-time calculation of dynamic decrement caps based on preceding sequential bids
  const dynamicRequiredMaxes = useMemo(() => {
    const maxes: Record<string, number> = {};
    let tracker = currentLowestBidVal;

    activeParticipants.forEach(part => {
      const isWithdrawn = withdrawals[part.id] === true;
      if (isWithdrawn) {
        maxes[part.id] = 0;
      } else {
        maxes[part.id] = tracker - currentMinDecrement;
        const enteredVal = parseInt((manualBids[part.id] || '').replace(/\D/g, ''));
        if (enteredVal && !isNaN(enteredVal) && enteredVal <= tracker - currentMinDecrement) {
          tracker = enteredVal;
        } else {
          tracker = tracker - currentMinDecrement;
        }
      }
    });

    return maxes;
  }, [activeParticipants, withdrawals, manualBids, currentLowestBidVal, currentMinDecrement]);

  // Process all manual round bids and withdrawals sequentially
  const submitRoundBids = () => {
    if (auctionState !== 'BIDDING') return;

    const logs: typeof auctionLog = [];
    let precedingBid = currentLowestBidVal;
    
    const validatedBids: Record<string, number> = {};
    const newlyWithdrawn: Record<string, boolean> = {};

    for (let i = 0; i < activeParticipants.length; i++) {
      const part = activeParticipants[i];
      const isWithdrawn = withdrawals[part.id] === true;

      if (isWithdrawn) {
        newlyWithdrawn[part.id] = true;
        logs.push({ 
          round: auctionRound, 
          text: `🚨 ${part.name} ihaleden çekildi! (Son geçerli teklifi: $${part.lastBid.toLocaleString()})`, 
          type: 'alert' 
        });
      } else {
        const bidStr = manualBids[part.id] || '';
        const bidVal = parseInt(bidStr.replace(/\D/g, ''));

        if (!bidVal || isNaN(bidVal)) {
          alert(`Hata: ${part.name} için geçerli bir teklif girilmeli veya "İhaleden Çekildi" olarak işaretlenmelidir.`);
          return;
        }

        const requiredMax = precedingBid - currentMinDecrement;
        if (bidVal > requiredMax) {
          alert(`Hata: ${part.name} için girilen teklif ($${bidVal.toLocaleString()}) kurallara aykırı!\nBir önceki tekliften ($${precedingBid.toLocaleString()}) en az minimum eksiltme miktarı ($${currentMinDecrement.toLocaleString()}) kadar düşmelidir.\nGirebileceğiniz maksimum teklif: $${requiredMax.toLocaleString()}`);
          return;
        }

        if (part.isUs && bidVal < floorCost) {
          const confirmGoBelow = window.confirm(`KRİTİK UYARI: Bizim (Enflow) için girdiğiniz teklif ($${bidVal.toLocaleString()}) en dip maliyetimizin ($${floorCost.toLocaleString()}) altındadır! Zarar etmeyi kabul ediyor musunuz?`);
          if (!confirmGoBelow) return;
        }

        validatedBids[part.id] = bidVal;
        precedingBid = bidVal; // Set the new tracker for sequential order
        logs.push({
          round: auctionRound,
          text: `💸 ${part.name} teklifini bir önceki en düşük tekliften ($${(precedingBid + (precedingBid === bidVal ? 0 : currentMinDecrement)).toLocaleString()}) düşerek $${bidVal.toLocaleString()} yaptı.`,
          type: 'bid'
        });
      }
    }

    // Apply state changes
    if (newlyWithdrawn['us']) {
      setOurStatus('WITHDRAWN');
    }
    if (validatedBids['us']) {
      setOurLastBid(validatedBids['us']);
    }

    const updatedCompetitors = competitors.map(c => {
      if (newlyWithdrawn[c.id]) {
        return { ...c, isActive: false };
      }
      if (validatedBids[c.id]) {
        return { ...c, lastBid: validatedBids[c.id] };
      }
      return c;
    });

    setCompetitors(updatedCompetitors);
    setAuctionLog(prev => [...prev, ...logs]);

    // Check end condition
    const activeCompetitors = updatedCompetitors.filter(c => c.isActive);
    const totalActiveNow = activeCompetitors.length + (newlyWithdrawn['us'] || ourStatus === 'WITHDRAWN' ? 0 : 1);

    if (totalActiveNow <= 1) {
      setAuctionState('FINISHED');
      
      let winnerName = '';
      let winnerPrice = 0;
      let isUsWinner = false;

      // Compile final bids to find the lowest price (winner)
      const allParticipants = [
        { name: 'Biz (Enflow)', price: validatedBids['us'] || ourLastBid, active: !newlyWithdrawn['us'] && ourStatus === 'ACTIVE', isUs: true },
        ...updatedCompetitors.map(c => ({ name: c.name, price: c.lastBid, active: c.isActive, isUs: false }))
      ];

      // Sort by price ascending (lowest wins)
      const sortedParticipants = allParticipants.sort((a, b) => a.price - b.price);
      const winner = sortedParticipants[0];
      
      winnerName = winner.name;
      winnerPrice = winner.price;
      isUsWinner = winner.isUs;

      setAuctionWinner({ name: winnerName, price: winnerPrice, isUs: isUsWinner });
      setAuctionLog(prev => [
        ...prev,
        {
          round: auctionRound,
          text: `🏆 AÇIK EKSİLTME TAMAMLANDI! Kazanan: ${winnerName} | Kazanan Fiyat: $${winnerPrice.toLocaleString()}`,
          type: isUsWinner ? 'success' : 'alert'
        }
      ]);
    } else {
      // Clear inputs for the next round
      setManualBids({});
      setWithdrawals({});

      const nextRound = auctionRound + 1;
      const reduction = 1 - (decrementReductionPct / 100);
      const nextDecrement = Math.max(500, Math.round(currentMinDecrement * reduction));
      
      setAuctionRound(nextRound);
      setCurrentMinDecrement(nextDecrement);
      setAuctionLog(prev => [
        ...prev,
        { round: nextRound, text: `--- Tur ${nextRound} Başladı! Bu tur için gereken Minimum Düşüş: $${nextDecrement.toLocaleString()} ---`, type: 'info' }
      ]);
    }
  };

  const handleFinalizeAuctionDeal = async () => {
    if (!selectedOpp || !auctionWinner) return;
    try {
      await apiService.updateOpportunity(selectedOpp.id, {
        status: 'WON',
        value: auctionWinner.price
      });
      setOpportunities(prev => prev.map(o => o.id === selectedOpp.id ? { ...o, status: 'WON', value: auctionWinner.price } : o));
      alert(`Açık eksiltme zaferi tescillendi! Fırsat KAZANILDI durumuna getirildi ve revize edilmiş bedel $${auctionWinner.price.toLocaleString()} olarak sisteme işlendi.`);
      if (setActiveTab) setActiveTab('contracts');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Hata oluştu.');
    }
  };



  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-sans bg-slate-50/30 custom-scrollbar">
      
      {/* Title & Description Group */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span className="p-3 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/5">
            <Gavel size={26} />
          </span>
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Canlı Pazarlık Kokpiti</h3>
            <p className="text-slate-500 font-medium text-xs mt-2">Müşteri fırsatları ve teknik maliyetler üzerinden akıllı, dip maliyet korumalı yapay pazarlık ve açık eksiltme simülatörü.</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select 
            value={selectedProposalId}
            disabled={chatState === 'NEGOTIATING' || auctionState === 'BIDDING'}
            onChange={(e) => {
              setSelectedProposalId(e.target.value);
              setChatState('IDLE');
              setChatMessages([]);
              setAuctionState('IDLE');
              setAuctionLog([]);
            }}
            className="bg-white border border-slate-100 px-6 py-3.5 rounded-[20px] text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/5 outline-none min-w-[320px] transition-all cursor-pointer disabled:opacity-50"
          >
            <option value="">Pazarlığa Açık Tekliflerden Seçin</option>
            {openProposals.map(p => {
              const opp = opportunities.find(o => o.id === p.opportunityId);
              const oppTitle = opp ? opp.title : 'Bilinmeyen Fırsat';
              let priceVal = opp ? opp.value : 0;
              if (p.totalPrice) priceVal = p.totalPrice;
              else if (p.content) {
                try {
                  const content = typeof p.content === 'string' ? JSON.parse(p.content) : p.content;
                  priceVal = content.totalPrice || priceVal;
                } catch (e) {}
              }
              return (
                <option key={p.id} value={p.id}>
                  {oppTitle} (V{p.version} - ${priceVal?.toLocaleString()})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {selectedOppId && (
        /* PREMIUM TAB BAR */
        <div className="flex bg-white/40 border border-slate-200/50 p-1.5 rounded-2xl max-w-md shadow-sm">
          <button 
            disabled={chatState === 'NEGOTIATING' || auctionState === 'BIDDING'}
            onClick={() => setActiveMode('canli')}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
              activeMode === 'canli' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-800 disabled:opacity-50"
            )}
          >
            <MessageSquare size={14} /> 1v1 Canlı Müzakere
          </button>
          <button 
            disabled={chatState === 'NEGOTIATING' || auctionState === 'BIDDING'}
            onClick={() => {
              setActiveMode('eksiltme');
              if (auctionState === 'IDLE') startAuctionSetup();
            }}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
              activeMode === 'eksiltme' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-800 disabled:opacity-50"
            )}
          >
            <Gavel size={14} /> Açık Eksiltme (Müzayede)
          </button>
        </div>
      )}

      {!selectedOppId ? (
        <div className="glass-panel p-20 rounded-[40px] border-dashed flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-[32px] flex items-center justify-center mb-6">
            <Gavel size={48} />
          </div>
          <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">İşlem Yapılacak Fırsatı Seçin</h4>
          <p className="text-sm text-slate-400 font-bold max-w-sm mt-2">Pazarlık odasına girmek ve simülasyonu başlatmak için yukarıdaki listeden aktif bir fırsat seçerek devam edin.</p>
        </div>
      ) : activeMode === 'canli' ? (
        
        // ==================== MODE 1: 1v1 LIVE CHAT NEGOTIATION ====================
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
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-bold">Mevcut Teklifiniz</span>
                        <span className="text-xl font-black italic text-emerald-400">${chatOffer.toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 block uppercase font-bold">Müşteri Hedefi</span>
                        <span className="text-xl font-black italic text-slate-300">${chatCustomerTarget.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {chatState === 'IDLE' && (
                <button 
                  onClick={startChatSim}
                  className="w-full bg-primary text-white py-4 rounded-2xl text-xs font-black shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] active:scale-95"
                >
                  <Zap size={16} /> Simülasyonu Başlat
                </button>
              )}

              {chatState === 'AGREED' && (
                <button 
                  onClick={handleFinalizeChatDeal}
                  className="w-full bg-emerald-500 text-white py-4 rounded-2xl text-xs font-black shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] active:scale-95"
                >
                  <CheckCircle2 size={18} /> Anlaşmayı Tescil Et (Won)
                </button>
              )}

              {(chatState === 'FAILED' || chatState === 'AGREED') && (
                <button 
                  onClick={startChatSim}
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
                    onClick={() => handleChatCounter(Math.round(chatOffer * 0.97))}
                    className="px-4 py-2 border border-slate-200 hover:border-slate-800 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Percent size={12} /> %3 İndirim
                  </button>
                  <button 
                    onClick={() => handleChatCounter(Math.round(chatOffer * 0.95))}
                    className="px-4 py-2 border border-slate-200 hover:border-slate-800 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Percent size={12} /> %5 İndirim
                  </button>
                  <button 
                    onClick={() => handleChatCounter(Math.round(chatOffer * 0.90))}
                    className="px-4 py-2 border border-slate-200 hover:border-slate-800 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Percent size={12} /> %10 İndirim
                  </button>
                  <button 
                    onClick={() => handleChatCounter(floorCost)}
                    className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95 ml-auto"
                    title="Maksimum indirim sınırı"
                  >
                    <ShieldAlert size={12} /> EN DİP FİYATI VER (${floorCost.toLocaleString()})
                  </button>
                </div>

                <form onSubmit={handleChatCustomCounterSubmit} className="flex gap-4">
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
                  onClick={handleFinalizeChatDeal}
                  className="bg-emerald-500 text-white px-8 py-4 rounded-2xl text-xs font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest"
                >
                  KAZANILDI OLARAK KAYDET <ArrowRight size={14} />
                </button>
              </div>
            )}

            {chatState === 'FAILED' && (
              <div className="p-8 border-t border-slate-100 bg-red-500/5 flex items-center justify-between">
                <div>
                  <h6 className="font-black text-red-600 text-md uppercase italic tracking-tighter">Masa Dağıldı</h6>
                  <p className="text-xs font-medium text-slate-500">Müşteri teklifi reddetti ve müzakereyi sonlandırdı.</p>
                </div>
                <button 
                  onClick={startChatSim}
                  className="bg-red-500 text-white px-8 py-4 rounded-2xl text-xs font-black shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest"
                >
                  MÜZAKEREYİ YENİDEN BAŞLAT
                </button>
              </div>
            )}

          </div>

        </div>
      ) : (
        
        // ==================== MODE 2: MULTI-COMPETITOR REVERSE AUCTION ====================
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
          
          {/* Auction Settings & Info Panel */}
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
                    onClick={launchAuction}
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
                          onClick={handleFinalizeAuctionDeal}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest mt-4 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                        >
                          Anlaşmayı Kazanıldı Olarak Tescil Et
                        </button>
                      )}
                    </div>
                  )}

                  {auctionState === 'FINISHED' && (
                    <button 
                      onClick={startAuctionSetup}
                      className="w-full bg-white text-slate-700 border border-slate-200 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <RefreshCw size={12} /> Yeni İhale Kur
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Auction Simulator Main Board */}
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
                    <span className="text-lg font-black text-slate-900">${ourLastBid.toLocaleString()}</span>
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
                      <span className="text-lg font-black text-slate-900">${comp.lastBid.toLocaleString()}</span>
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
                              Önceki Teklifi: <span className="text-slate-700 font-black">${part.lastBid.toLocaleString()}</span>
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
                                placeholder={`En Fazla: $${maxBid.toLocaleString()}`}
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
                    * Her turlu teklifte, sıradaki firma bir öncekinden en az <span className="text-amber-500 font-black">${currentMinDecrement.toLocaleString()}</span> düşmek zorundadır.
                  </div>
                  <button 
                    onClick={submitRoundBids}
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

        </div>
      )}

    </div>
  );
};

export default NegotiationModule;
