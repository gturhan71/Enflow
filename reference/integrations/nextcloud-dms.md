# Nextcloud DMS Entegrasyon Rehberi

Enflow dökümanlarının (Sözleşmeler, BoM listeleri, Şartnameler) güvenli bir şekilde depolanması ve versiyonlanması için Nextcloud WebDAV ve OCS API entegrasyon sürecidir.

## 1. Teknik Mimari
Nextcloud entegrasyonu iki ana koldan yürütülür:
1. **WebDAV:** Dosya yükleme, indirme ve klasör yönetimi.
2. **OCS API:** Paylaşım linkleri oluşturma ve kullanıcı yönetimi.

- **WebDAV URL:** `https://cloud.sirketiniz.com/remote.php/dav/files/{admin_user}/`
- **OCS API URL:** `https://cloud.sirketiniz.com/ocs/v2.php/apps/files_sharing/api/v1/shares`

## 2. Canlıya Geçiş Adımları

### A. Nextcloud Tarafı
1. Bir **"Service Account"** (örn: `enflow_bot`) oluşturun.
2. Bu kullanıcıya dökümanların saklanacağı ana klasörde (`/ERP_Documents`) tam yetki verin.
3. Brute-force korumasını devre dışı bırakmak için Nextcloud `config.php` içinde sunucu IP'nizi beyaz listeye (Allowlist) ekleyin.

### B. Dosya Yükleme Scripti (WebDAV)

```typescript
import { createClient } from "webdav";

const client = createClient("https://cloud.sirketiniz.com/remote.php/dav/files/enflow_bot/", {
  username: "enflow_bot",
  password: "YOUR_APP_PASSWORD"
});

async function uploadProjectDocument(projectId: string, fileName: string, fileBuffer: Buffer) {
  const path = `/Projects/${projectId}/${fileName}`;
  
  // Klasör yoksa oluştur
  if (!(await client.exists(`/Projects/${projectId}`))) {
    await client.createDirectory(`/Projects/${projectId}`);
  }

  await client.putFileContents(path, fileBuffer);
  return path;
}
```

## 3. Akıllı Paylaşım (Sharing)
Müşterilere veya dış paydaşlara döküman linki göndermek için OCS API kullanılır:
- `POST /shares` endpoint'ini kullanarak süreli ve şifreli paylaşım linkleri üretin.
- Linkleri Enflow arayüzünde "Dökümanı Görüntüle" butonuna bağlayın.

## 4. Güvenlik ve Depolama
- **App Passwords:** Asıl yönetici şifresini değil, Nextcloud ayarlarından üretilen "App Password" değerini kullanın.
- **Quota:** Service account için yeterli disk kotası ayrıldığından emin olun.
- **SSL:** Tüm bağlantıların HTTPS üzerinden zorunlu olduğundan emin olun.
