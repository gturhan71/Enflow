import type { ReactNode } from 'react';
import {
  FileText, Clock, FileCheck, Truck, DollarSign, CheckCircle2, Ban,
} from 'lucide-react';
import { PurchaseStatus, PurchaseUrgency } from '../../types';

export const STATUS_CONFIG: Record<PurchaseStatus, { label: string; textColor: string; bg: string; icon: ReactNode }> = {
  DRAFT:               { label: 'Taslak',           textColor: 'text-slate-600',  bg: 'bg-slate-100',  icon: <FileText size={12} /> },
  PENDING_UNIT:        { label: 'Birim Onayı',       textColor: 'text-amber-700',  bg: 'bg-amber-100',  icon: <Clock size={12} /> },
  PENDING_PROCUREMENT: { label: 'Sat.Alma Onayı',    textColor: 'text-blue-700',   bg: 'bg-blue-100',   icon: <Clock size={12} /> },
  PENDING_GM:          { label: 'GM Onayı',          textColor: 'text-purple-700', bg: 'bg-purple-100', icon: <Clock size={12} /> },
  PO_ISSUED:           { label: 'PO Kesildi',        textColor: 'text-indigo-700', bg: 'bg-indigo-100', icon: <FileCheck size={12} /> },
  IN_DELIVERY:         { label: 'Teslimat Sürecinde',textColor: 'text-cyan-700',   bg: 'bg-cyan-100',   icon: <Truck size={12} /> },
  INVOICED:            { label: 'Faturalandı',       textColor: 'text-orange-700', bg: 'bg-orange-100', icon: <DollarSign size={12} /> },
  CLOSED:              { label: 'Kapalı',            textColor: 'text-green-700',  bg: 'bg-green-100',  icon: <CheckCircle2 size={12} /> },
  REJECTED:            { label: 'Reddedildi',        textColor: 'text-red-700',    bg: 'bg-red-100',    icon: <Ban size={12} /> },
};

export const URGENCY_CONFIG: Record<PurchaseUrgency, { label: string; color: string }> = {
  LOW:    { label: 'Düşük',  color: 'text-slate-500' },
  NORMAL: { label: 'Normal', color: 'text-blue-600'  },
  HIGH:   { label: 'Yüksek', color: 'text-orange-600' },
  URGENT: { label: 'Acil',   color: 'text-red-600'   },
};

export const SOURCE_LABEL: Record<string, string> = {
  MANUAL:  'Manuel',
  BOM:     'BoM',
  PROJECT: 'Proje',
  UNIT:    'Birim',
};

export const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'];

export const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
