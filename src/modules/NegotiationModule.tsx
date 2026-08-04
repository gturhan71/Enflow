import { useState, useMemo, useEffect, useRef, type Dispatch, type SetStateAction, type FormEvent } from 'react';
import { Gavel } from 'lucide-react';
import { Opportunity, Proposal } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { Competitor, Message } from './negotiation/types';
import AccessDeniedPanel from './negotiation/AccessDeniedPanel';
import ProposalSelectorHeader from './negotiation/ProposalSelectorHeader';
import ModeTabBar from './negotiation/ModeTabBar';
import ChatInfoPanel from './negotiation/ChatInfoPanel';
import ChatWindow from './negotiation/ChatWindow';
import AuctionSidePanel from './negotiation/AuctionSidePanel';
import AuctionBoard from './negotiation/AuctionBoard';

const NegotiationModule = ({
  opportunities = [],
  setOpportunities,
  proposals = [],
  setActiveTab,
  initialOppId,
}: {
  opportunities: Opportunity[];
  setOpportunities: Dispatch<SetStateAction<Opportunity[]>>;
  proposals?: Proposal[];
  setActiveTab?: (tab: string) => void;
  initialOppId?: string | null;
}) => {
  const { currentUser } = useAuth();

  // Tab control: 'canli' (1v1 Chat) or 'eksiltme' (Reverse Auction)
  const [activeMode, setActiveMode] = useState<'canli' | 'eksiltme'>('canli');

  // Rule: Only Satış Birim Yöneticisi (GENERAL_MANAGER) can access
  const isAuthorized = useMemo(() => {
    return currentUser?.role === 'GENERAL_MANAGER';
  }, [currentUser]);

  // Filter proposals marked as "Pazarlığa Açık" — exclude if linked opportunity is WON or LOST
  const openProposals = useMemo(() => {
    return proposals.filter(p => {
      const opp = opportunities.find(o => o.id === p.opportunityId);
      if (opp && (opp.status === 'WON' || opp.status === 'LOST')) return false;

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
  }, [proposals, opportunities]);

  const [selectedProposalId, setSelectedProposalId] = useState('');
  const [selectedOppId, setSelectedOppId] = useState('');

  // Deep-link: bildirim/görev "Git" ile gelen fırsatın pazarlığa açık teklifini otomatik seç.
  useEffect(() => {
    if (!initialOppId) return;
    const p = openProposals.find(x => x.opportunityId === initialOppId);
    if (p) setSelectedProposalId(p.id);
  }, [initialOppId, openProposals]);

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
      <AccessDeniedPanel
        role={currentUser?.role}
        onBackToDashboard={setActiveTab ? () => setActiveTab('dashboard') : undefined}
      />
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

  const handleChatCustomCounterSubmit = (e: FormEvent) => {
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
      if (setActiveTab) setActiveTab('contract-workflow');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Hata oluştu.');
    }
  };

  const markChatOpportunityLost = async () => {
    if (!selectedOpp) return;
    try {
      await apiService.updateOpportunity(selectedOpp.id, { status: 'LOST' });
      setOpportunities(prev => prev.map(o => o.id === selectedOpp.id ? { ...o, status: 'LOST' } : o));
      alert('Fırsat KAYBEDİLDİ olarak işaretlendi.');
    } catch { alert('Durum güncellenemedi.'); }
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
      if (setActiveTab) setActiveTab('contract-workflow');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Hata oluştu.');
    }
  };

  const modeDisabled = chatState === 'NEGOTIATING' || auctionState === 'BIDDING';

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-sans bg-slate-50/30 custom-scrollbar">

      <ProposalSelectorHeader
        openProposals={openProposals}
        opportunities={opportunities}
        selectedProposalId={selectedProposalId}
        disabled={modeDisabled}
        onSelect={(id) => {
          setSelectedProposalId(id);
          setChatState('IDLE');
          setChatMessages([]);
          setAuctionState('IDLE');
          setAuctionLog([]);
        }}
      />

      {selectedOppId && (
        <ModeTabBar
          activeMode={activeMode}
          disabled={modeDisabled}
          onSelectCanli={() => setActiveMode('canli')}
          onSelectEksiltme={() => {
            setActiveMode('eksiltme');
            if (auctionState === 'IDLE') startAuctionSetup();
          }}
        />
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
          <ChatInfoPanel
            selectedOpp={selectedOpp}
            chatIsTyping={chatIsTyping}
            chatState={chatState}
            chatOffer={chatOffer}
            floorCost={floorCost}
            initialValue={initialValue}
            initialMargin={initialMargin}
            onStart={startChatSim}
            onFinalize={handleFinalizeChatDeal}
          />
          <ChatWindow
            chatConcessions={chatConcessions}
            chatMessages={chatMessages}
            chatIsTyping={chatIsTyping}
            chatEndRef={chatEndRef}
            chatState={chatState}
            chatOffer={chatOffer}
            floorCost={floorCost}
            chatCustomCounter={chatCustomCounter}
            setChatCustomCounter={setChatCustomCounter}
            onCustomCounterSubmit={handleChatCustomCounterSubmit}
            onQuickCounter={handleChatCounter}
            onFinalize={handleFinalizeChatDeal}
            onRestart={startChatSim}
            onMarkLost={markChatOpportunityLost}
          />
        </div>
      ) : (
        // ==================== MODE 2: MULTI-COMPETITOR REVERSE AUCTION ====================
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
          <AuctionSidePanel
            auctionState={auctionState}
            numCompetitors={numCompetitors}
            setNumCompetitors={setNumCompetitors}
            initialDecrement={initialDecrement}
            setInitialDecrement={setInitialDecrement}
            decrementReductionPct={decrementReductionPct}
            setDecrementReductionPct={setDecrementReductionPct}
            floorCost={floorCost}
            onLaunch={launchAuction}
            currentLowestBidVal={currentLowestBidVal}
            auctionRound={auctionRound}
            currentMinDecrement={currentMinDecrement}
            ourStatus={ourStatus}
            ourLastBid={ourLastBid}
            initialValue={initialValue}
            auctionWinner={auctionWinner}
            onFinalize={handleFinalizeAuctionDeal}
            onNewAuction={startAuctionSetup}
          />
          <AuctionBoard
            ourStatus={ourStatus}
            ourLastBid={ourLastBid}
            competitors={competitors}
            auctionState={auctionState}
            activeParticipants={activeParticipants}
            withdrawals={withdrawals}
            setWithdrawals={setWithdrawals}
            manualBids={manualBids}
            setManualBids={setManualBids}
            dynamicRequiredMaxes={dynamicRequiredMaxes}
            currentMinDecrement={currentMinDecrement}
            auctionRound={auctionRound}
            onSubmitRound={submitRoundBids}
            auctionLog={auctionLog}
          />
        </div>
      )}

    </div>
  );
};

export default NegotiationModule;
