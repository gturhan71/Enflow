export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  permissions: string[];
  unitId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  tenantId?: string;
  delegateToUserId?: string | null;
  delegateUntil?: string | null;
  dashboardLayout?: string | null;
}
export interface Permission {
  id: string;
  name: string;
  code: string;
  description: string;
}
export interface Unit {
  id: string;
  name: string;
  description?: string;
  managerId?: string | null;
  parentId?: string | null;
}

export interface OwnedCategory {
  key: string;
  label: string;
  count: number;
  sample: { id: string; label: string }[];
}

export interface OwnedItemsResult {
  userId: string;
  userName: string;
  role: string;
  status: string;
  categories: OwnedCategory[];
  totalActive: number;
  inboundDelegationCount: number;
  createdOpportunityCount: number;
  hardDeleteBlocked: boolean;
}

export interface TransferResult {
  transferred: Record<string, number>;
  clearedInboundDelegations: number;
}
