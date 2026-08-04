export interface CorporateDocument {
  id: string;
  name: string;
  category: 'LEGAL' | 'ISO' | 'CERTIFICATE' | 'FINANCIAL' | 'WORK_EXPERIENCE';
  expiryDate: string;
  fileUrl: string;
  tags: string[];
}
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'SYSTEM' | 'URGENT' | 'SUCCESS' | 'WARNING';
  isRead: boolean;
  timestamp: string;
  scheduledAt?: string;
  relatedModule?: string;
  relatedItemId?: string;
}
export interface ArchiveItem {
  id: string;
  boxNo: string;
  shelfNo: string;
  category: string;
  description?: string;
  owner: string;
  date: string;
  status: string;
  tags?: string[];
  tenantId: string;
  createdAt?: string;
  updatedAt?: string;
}
