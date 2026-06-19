import React, { useState, useEffect } from 'react';
import { MOCK_BOM_ITEMS } from '../constants';
import { apiService } from '../services/apiService';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import type { BoMItem, Opportunity } from '../types';

// BoM kalemlerinin UI'da kullanılan kısaltılmış biçimi (API'ye gönderilmeden önce BoMItem'a dönüştürülür)
export interface AbbreviatedBoMItem {
  id?: string;
  pn: string;
  desc: string;
  qty: number;
  cost: number;
  margin: number;
}

export const useBoM = (
  selectedOppId: string,
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>
) => {
  const [bomItems, setBomItems] = useState<AbbreviatedBoMItem[]>([]);
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

  const addBoMItem = (item: AbbreviatedBoMItem) => {
    setBomItems(prev => [...prev, item]);
    setHasUnsavedChanges(true);
  };

  const handleFinalApproval = async () => {
    if (!selectedOppId) return;
    setIsSubmitting(true);
    try {
      // Abbreviated format → proper BoMItem for API and opportunity state
      const properItems: BoMItem[] = bomItems.map((item, idx) => ({
        id: item.id ?? item.pn ?? String(idx),
        partNumber: item.pn,
        description: item.desc,
        quantity: item.qty,
        purchaseCost: item.cost,
        marginPercentage: item.margin,
        unitSalePrice: item.cost * (1 + item.margin / 100),
        totalSalePrice: item.cost * (1 + item.margin / 100) * item.qty,
      }));

      // 1. BoM kalemlerini veritabanına kaydet
      await apiService.saveBoMItems(selectedOppId, properItems);

      // 2. Onay sürecini başlat
      await apiService.requestProposalApproval(selectedOppId, {
        note: 'Teknik çalışma tamamlandı, fiyat teklifi onaya sunulmuştur.',
        managerId: 'cmp5lhehc000259w33zxhyy0p'
      });

      alert('Teklif başarıyla yönetici onayına sunuldu.');
      setHasUnsavedChanges(false);

      setOpportunities(prev => prev.map(o =>
        o.id === selectedOppId
          ? { ...o, technicalStatus: 'APPROVED', bomItems: properItems }
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

  const totalCost = bomItems.reduce((acc: number, curr) => acc + (curr.cost * curr.qty), 0);

  return {
    bomItems,
    setBomItems,
    addBoMItem,
    isSubmitting,
    handleFinalApproval,
    totalCost
  };
};
