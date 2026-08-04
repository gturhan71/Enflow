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
