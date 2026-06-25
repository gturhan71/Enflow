import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import type { BoMItem, Opportunity } from '../types';

// BoM kalemlerinin UI'da kullanılan kısaltılmış biçimi (API'ye gönderilmeden önce BoMItem'a dönüştürülür)
export interface AbbreviatedBoMItem {
  id?: string;
  lineKey?: string;
  pn: string;
  desc: string;
  qty: number;
  cost: number;
  margin: number;
  vendor?: string;
  currency?: string; // BoM kaleminin hazırlandığı döviz — maliyetlendirmeye değişmeden taşınmalı (kritik)
}

const newLineKey = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `lk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

export const useBoM = (
  selectedOppId: string,
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>,
  opportunities?: Opportunity[]
) => {
  const [bomItems, setBomItems] = useState<AbbreviatedBoMItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setHasUnsavedChanges } = useUnsavedChanges();

  useEffect(() => {
    if (!selectedOppId) { setBomItems([]); return; }
    // Gerçek (kaydedilmiş) BoM'u fırsattan yükle; her kaleme stabil lineKey ata
    const opp = opportunities?.find(o => o.id === selectedOppId);
    const real = (opp?.bomItems || []).map(item => ({
      id: item.id,
      lineKey: item.lineKey || newLineKey(),
      pn: item.partNumber,
      desc: item.description,
      qty: item.quantity,
      cost: item.purchaseCost,
      margin: item.marginPercentage,
      vendor: item.vendor || undefined,
      currency: item.currency || undefined,
    }));
    setBomItems(real);
  }, [selectedOppId, opportunities]);

  const addBoMItem = (item: AbbreviatedBoMItem) => {
    setBomItems(prev => [...prev, { ...item, lineKey: item.lineKey || newLineKey() }]);
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
        lineKey: item.lineKey,
        partNumber: item.pn,
        description: item.desc,
        quantity: item.qty,
        purchaseCost: item.cost,
        marginPercentage: item.margin,
        vendor: item.vendor,
        currency: item.currency,
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
