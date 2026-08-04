// ── Yedekleme / Geri Yükleme ─────────────────────────────────────────────────
export interface BackupJob {
  id: string;
  tenantId: string;
  scope: 'PLATFORM' | 'TENANT';
  kind: 'FULL' | 'STATE' | 'DATA';
  dbProvider: 'SQLITE' | 'POSTGRES';
  trigger: 'MANUAL' | 'SCHEDULED';
  targetType: 'LOCAL' | 'NEXTCLOUD' | 'S3';
  location?: string | null;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  sizeBytes: number;
  checksum?: string | null;
  stateRef?: string | null;
  dataRef?: string | null;
  modelCounts?: string | null;
  verifyStatus: 'PENDING' | 'PASSED' | 'FAILED';
  verifyReport?: string | null;
  verifiedAt?: string | null;
  startedByName?: string | null;
  error?: string | null;
  startedAt: string;
  completedAt?: string | null;
}
export interface RestoreJob {
  id: string;
  tenantId: string;
  backupId: string;
  mode: 'LOGICAL' | 'STATE';
  status: 'ANALYZING' | 'AWAITING_CONFIRM' | 'RESTORING' | 'COMPLETED' | 'FAILED';
  diffReport?: string | null;
  preRestoreBackupId?: string | null;
  startedByName?: string | null;
  error?: string | null;
  startedAt: string;
  completedAt?: string | null;
}
export interface BackupSettings {
  enabled: boolean;
  intervalHours: number;
  scope: 'PLATFORM' | 'TENANT';
  kind: 'FULL' | 'STATE' | 'DATA';
  targetType: 'LOCAL' | 'NEXTCLOUD' | 'S3';
  location: string;
  nextcloud: { url: string; username: string; folder: string; hasPassword: boolean };
  s3: { endpoint: string; region: string; bucket: string; prefix: string; accessKeyId: string; hasSecret: boolean };
}
