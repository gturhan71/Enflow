// Yönetici-ayarlı marj eşiği (backend salesCosting.ts) — DMO'nun minMarginPct'i ile aynı desen.
export interface SalesSettings {
  marginFloorPct: number;
}
export type SubscriptionPlanType = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface Subscription {
  id: string;
  plan: SubscriptionPlanType;
  tenantId: string;
  licenseModel?: string | null;
  licenseExpiryDate?: string | null;
  licensedUserLimit?: number | null;
  licensedStorageLimit?: number | null;
  createdAt?: string;
  updatedAt?: string;
}
export interface ProcurementNote {
  id: string;
  date: string;
  note: string;
  author: string;
}
export interface Tenant {
  id: string;
  name: string;
}
export interface NextcloudConfig {
  url: string;
  adminUser?: string;
  adminPass?: string;
  username?: string;
  appPassword?: string;
  basePath?: string;
  isEnabled?: boolean;
}
export interface ExchangeConfig {
  serverUrl?: string;
  server?: string;
  domain?: string;
  email?: string;
  adminEmail?: string;
  password?: string;
  adminPass?: string;
  isEnabled?: boolean;
  syncEmails?: boolean;
  syncCalendar?: boolean;
}
export interface WhatsAppConfig {
  phoneNumberId?: string;
  apiKey?: string;
  phoneNumber?: string;
  accessToken?: string;
  businessAccountId?: string;
  webhookVerifyToken?: string;
  isEnabled?: boolean;
}
export type LicenseModel = 'KOBI' | 'PAY_AS_YOU_GO' | 'ON_PREMISE';

export interface SubscriptionPlan {
  id: string;
  name: string;
  model: LicenseModel;
  price: number;
  features: string[];
  limits: {
    users: number;
    storage: number;
  };
  isActive: boolean;
}
export interface UsageMetric {
  id: string;
  type: string;
  count: number;
  costPerUnit: number;
  totalCost: number;
}
export interface LicenseData {
  companyName: string;
  model: LicenseModel;
  expiryDate: string;
  issuedAt: string;
  isTrial?: boolean;
  limits: {
    users: number;
    storage: number;
  };
  signature: string;
}
