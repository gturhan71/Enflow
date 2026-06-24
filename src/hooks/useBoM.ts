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

  // Presales BoM'u hazırlayıp Satış'a devreder (maliyet analizi Satış'ın işi).
  // Burada teklif oluşturulmaz / yönetici onayı istenmez / technicalStatus APPROVED yapılmaz —
  // sadece BoM kaydedilir ve handoff sinyali gönderilir (revizyon ise backend cost durumunu sıfırlar).
  const saveAndHandoff = async () => {
    if (!selectedOppId) return false;
    setIsSubmitting(true);
    try {
      const properItems: BoMItem[] = bomItems.map((item, idx) => ({
        id: item.id ?? item.pn ?? String(idx),
        partNumber: item.pn,
        description: item.desc,
        quantity: item.qty,
        purchaseCost: item.cost,
        marginPercentage: item.margin,
      }));

      await apiService.saveBoMItems(selectedOppId, properItems, { handoff: true });

      setHasUnsavedChanges(false);
      // Backend revizyonda (maliyet zaten yapılmışsa) technicalStatus'u PENDING'e sıfırlar — yereli de yansıt
      setOpportunities(prev => prev.map(o => {
        if (o.id !== selectedOppId) return o;
        const wasCosted = o.technicalStatus === 'APPROVED' || o.technicalStatus === 'PENDING_APPROVAL';
        return { ...o, bomItems: properItems, ...(wasCosted ? { technicalStatus: 'PENDING' as const } : {}) };
      }));

      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'BoM kaydedilirken hata oluştu.');
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
    saveAndHandoff,
    totalCost
  };
};
