# MS Exchange & Outlook Entegrasyon Rehberi

Enflow'un kurumsal takvim ve e-posta senkronizasyonu için Microsoft Graph API üzerinden yürütülmesi gereken süreçleri içerir.

## 1. Teknik Mimari
Sistem, Azure Active Directory (yeni adıyla Microsoft Entra ID) üzerinden **App-Only Permissions** (Daemon Application) mimarisini kullanır. Kullanıcıların tek tek onay vermesine gerek kalmadan, yönetici onayı ile tüm organizasyon e-postaları ve takvimleri yönetilebilir.

- **API Base URL:** `https://graph.microsoft.com/v1.0/`
- **Auth:** OAuth 2.0 Client Credentials Flow
- **Scopes:** `Mail.Send`, `Calendars.ReadWrite`, `User.Read.All`

## 2. Canlıya Geçiş Adımları

### A. Azure Portalı Yapılandırması
1. [Azure Portal](https://portal.azure.com/) -> App Registrations sekmesine gidin.
2. "Enflow-ERP" adında yeni bir uygulama kaydedin.
3. **Client ID** ve **Tenant ID** bilgilerini not edin.
4. "Certificates & Secrets" kısmından yeni bir **Client Secret** oluşturun.
5. "API Permissions" kısmına gidin ve yukarıdaki scope'ları "Application" tipinde ekleyip **"Grant Admin Consent"** butonuna basın.

### B. E-posta Gönderim Scripti (Örnek)

```typescript
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";

const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
const client = Client.initWithMiddleware({ authProvider: credential });

async function sendEmail(userId: string, subject: string, content: string) {
  const message = {
    subject: subject,
    body: { contentType: "HTML", content: content },
    toRecipients: [{ emailAddress: { address: "musteri@firma.com" } }]
  };

  await client.api(`/users/${userId}/sendMail`).post({ message });
}
```

## 3. Takvim Senkronizasyonu
Proje deadline'larını ve müşteri toplantılarını Outlook takvimine işlemek için:
- `POST /users/{id}/calendar/events` endpoint'ini kullanın.
- Toplantı davetlerine otomatik **Teams Linki** eklemek için `isOnlineMeeting: true` parametresini set edin.

## 4. Güvenlik ve Limitler
- **Secret Expiry:** Client Secret süresinin (genelde 1-2 yıl) takibini yapın.
- **Throttling:** Microsoft Graph'ın saniye bazlı istek limitlerine (429 Too Many Requests) karşı "Exponential Backoff" algoritması uygulayın.
