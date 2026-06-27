// Enflow — Yedek hedefleri (lokasyon soyutlaması)
// ─────────────────────────────────────────────────────────────────────────────
// LOCAL (yerel dizin) · NEXTCLOUD (WebDAV) · S3 (uyumlu nesne deposu).
// Hepsi aynı arayüzü uygular: put/get/list. Kimlik bilgileri moduleSettings.backup'tan
// gelir (S3/Nextcloud); ASLA loglanmaz.

import fs from 'fs';
import path from 'path';
import { uploadToNextcloud } from '../utils/fileUpload';

export interface BackupTarget {
  /** localPath dosyasını remoteName olarak hedefe yazar; konum referansı döner. */
  put(localPath: string, remoteName: string): Promise<string>;
  /** remoteName'i localPath'e indirir. */
  get(remoteName: string, localPath: string): Promise<void>;
  list(): Promise<string[]>;
}

// Yedek kök dizini — web kökü (uploads) DIŞINDA.
export const BACKUPS_ROOT = path.join(__dirname, '../../backups');

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── LOCAL ───────────────────────────────────────────────────────────────────
export class LocalTarget implements BackupTarget {
  private baseDir: string;
  constructor(location?: string | null) {
    this.baseDir = location && location.trim() ? location.trim() : BACKUPS_ROOT;
  }
  async put(localPath: string, remoteName: string): Promise<string> {
    ensureDir(this.baseDir);
    const dest = path.join(this.baseDir, remoteName);
    ensureDir(path.dirname(dest));
    await fs.promises.copyFile(localPath, dest);
    return dest;
  }
  async get(remoteName: string, localPath: string): Promise<void> {
    const src = path.isAbsolute(remoteName) ? remoteName : path.join(this.baseDir, remoteName);
    await fs.promises.copyFile(src, localPath);
  }
  async list(): Promise<string[]> {
    ensureDir(this.baseDir);
    return fs.promises.readdir(this.baseDir);
  }
}

// ── NEXTCLOUD (WebDAV) ────────────────────────────────────────────────────────
export class NextcloudTarget implements BackupTarget {
  constructor(private cfg: { url: string; username: string; appPassword: string; folder?: string }) {}
  async put(localPath: string, remoteName: string): Promise<string> {
    const buffer = await fs.promises.readFile(localPath);
    const folder = '/' + (this.cfg.folder || 'enflow-backups').replace(/^\/+/, '');
    await uploadToNextcloud(buffer, remoteName, folder, this.cfg.url, this.cfg.username, this.cfg.appPassword);
    return `nextcloud:${folder}/${remoteName}`;
  }
  async get(): Promise<void> {
    throw new Error('Nextcloud get henüz desteklenmiyor (WebDAV GET).');
  }
  async list(): Promise<string[]> {
    return [];
  }
}

// ── S3 / uyumlu ───────────────────────────────────────────────────────────────
// @aws-sdk/client-s3 lazy require — bağımlılık yoksa anlamlı hata.
export class S3Target implements BackupTarget {
  constructor(
    private cfg: { endpoint?: string; region?: string; bucket: string; accessKeyId: string; secretAccessKey: string; prefix?: string },
  ) {}
  private client() {
    let S3: typeof import('@aws-sdk/client-s3');
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      S3 = require('@aws-sdk/client-s3');
    } catch {
      throw new Error('S3 desteği için @aws-sdk/client-s3 kurulmalı.');
    }
    const client = new S3.S3Client({
      region: this.cfg.region || 'us-east-1',
      endpoint: this.cfg.endpoint || undefined,
      forcePathStyle: Boolean(this.cfg.endpoint),
      credentials: { accessKeyId: this.cfg.accessKeyId, secretAccessKey: this.cfg.secretAccessKey },
    });
    return { client, S3 };
  }
  private key(name: string) {
    return (this.cfg.prefix ? this.cfg.prefix.replace(/\/+$/, '') + '/' : '') + name;
  }
  async put(localPath: string, remoteName: string): Promise<string> {
    const { client, S3 } = this.client();
    const Body = await fs.promises.readFile(localPath);
    const Key = this.key(remoteName);
    await client.send(new S3.PutObjectCommand({ Bucket: this.cfg.bucket, Key, Body }));
    return `s3://${this.cfg.bucket}/${Key}`;
  }
  async get(remoteName: string, localPath: string): Promise<void> {
    const { client, S3 } = this.client();
    const out = await client.send(new S3.GetObjectCommand({ Bucket: this.cfg.bucket, Key: this.key(remoteName) }));
    const bytes = await (out.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    await fs.promises.writeFile(localPath, Buffer.from(bytes));
  }
  async list(): Promise<string[]> {
    const { client, S3 } = this.client();
    const out = await client.send(new S3.ListObjectsV2Command({ Bucket: this.cfg.bucket, Prefix: this.cfg.prefix || undefined }));
    return (out.Contents || []).map(o => o.Key || '').filter(Boolean);
  }
}
