import React, { useState, useEffect } from 'react';
import { MOCK_BOM_ITEMS } from '../constants';
import { apiService } from '../services/apiService';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';

export const useBoM = (
  selectedOppId: string,
  setOpportunities: React.Dispatch<React.SetStateAction<any[]>>
) => {
  const [bomItems, setBomItems] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setHasUnsavedChanges } = useUnsavedChanges();

  useEffect(() => {
    if (selectedOppId) {
      const items = MOCK_BOM_ITEMS
        .filter(item => item.opportunityId === selectedOppId)
        .map(item => ({
          pn: item.partNumber,
          desc: item.description,
          qty: item.quantity,
          cost: item.purchaseCost,
          margin: item.marginPercentage
        }));
      setBomItems(items.length > 0 ? items : []);
    } else {
      setBomItems([]);
    }
  }, [selectedOppId]);

  const addBoMItem = (item: { pn: string; desc: string; qty: number; cost: number; margin: number }) => {
    setBomItems(prev => [...prev, item]);
    setHasUnsavedChanges(true);
  };

  const handleFinalApproval = async () => {
    if (!selectedOppId) return;
    setIsSubmitting(true);
    try {
      // 1. Önce BoM kalemlerini veritabanına kaydet
      const savedBoM = await apiService.saveBoMItems(selectedOppId, bomItems);
      
      // 2. Onay sürecini başlat
      await apiService.requestProposalApproval(selectedOppId, {
        note: 'Teknik çalışma tamamlandı, fiyat teklifi onaya sunulmuştur.',
        managerId: 'cmp5lhehc000259w33zxhyy0p' // Gökhan Turhan (General Manager)
      });

      alert('Teklif başarıyla yönetici onayına sunuldu.');
      setHasUnsavedChanges(false);

      // Global state güncellemesi
      setOpportunities(prev => prev.map(o => 
        o.id === selectedOppId 
          ? { ...o, technicalStatus: 'WAITING_APPROVAL', bomItems: savedBoM } 
          : o
      ));
      
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Onay sürecinde hata oluştu.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCost = bomItems.reduce((acc, curr) => acc + (curr.cost * curr.qty), 0);

  return {
    bomItems,
    setBomItems,
    addBoMItem,
    isSubmitting,
    handleFinalApproval,
    totalCost
  };
};
