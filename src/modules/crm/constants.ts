import { Opportunity } from '../../types';

export const PIPELINE_STAGES: Opportunity['status'][] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'];

export const STATUS_LABEL: Record<string, string> = {
  NEW: 'Yeni', CONTACTED: 'İletişimde', QUALIFIED: 'Nitelikli',
  PROPOSAL: 'Teklif Aşaması', NEGOTIATION: 'Pazarlıkta',
  WON: 'Kazanıldı', LOST: 'Kaybedildi',
};

// Teklif (Proposal) durum etiketi — fırsat kartı + geçmiş panelinde ortak kullanılır.
export const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Taslak', PENDING_APPROVAL: 'Onay Bekliyor', APPROVED: 'Onaylandı',
  SENT: 'Gönderildi', ACCEPTED: 'Kabul Edildi', REJECTED: 'Reddedildi',
};
export const proposalStatusTone = (status: string) =>
  status === 'APPROVED' || status === 'ACCEPTED' ? 'text-emerald-600'
    : status === 'REJECTED' ? 'text-red-500'
    : 'text-slate-500';

export const getStatusStyle = (status: string) => {
  const styles: Record<string, string> = {
    'NEW': 'bg-blue-50 text-blue-600 border-blue-100',
    'CONTACTED': 'bg-sky-50 text-sky-600 border-sky-100',
    'QUALIFIED': 'bg-primary/10 text-primary border-primary/20',
    'PROPOSAL': 'bg-amber-50 text-amber-600 border-amber-100',
    'NEGOTIATION': 'bg-purple-50 text-purple-600 border-purple-100',
    'WON': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'LOST': 'bg-red-50 text-red-600 border-red-100',
  };
  return styles[status] || 'bg-slate-50 text-slate-600 border-slate-100';
};

// Kaybedilen fırsat — neden seçimi modalı (Faz 1).
export const LOST_REASON_OPTIONS = [
  'Fiyat rekabeti',
  'Bütçe iptal edildi',
  'Rakip firma seçildi',
  'Teknik uygunsuzluk',
  'Zamanlama / termin uyuşmazlığı',
  'Müşteri vazgeçti',
  'Diğer',
];
