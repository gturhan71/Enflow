# WhatsApp Business API Entegrasyon Rehberi

Bu döküman, Enflow sisteminin Meta Graph API üzerinden gerçek zamanlı WhatsApp mesaj gönderimi ve Webhook dinleme süreçlerini nasıl canlıya alacağını açıklar.

## 1. Teknik Mimari
Enflow, Meta'nın **Cloud API** mimarisini kullanır. Mesajlar doğrudan Meta sunucularına iletilir.

- **API Base URL:** `https://graph.facebook.com/v21.0/`
- **Auth:** Bearer Token (Permanent Access Token)
- **Mime Type:** `application/json`

## 2. Canlıya Geçiş Adımları

### A. Meta for Developers Kurulumu
1. [Meta for Developers](https://developers.facebook.com/) panelinde bir uygulama oluşturun.
2. "WhatsApp" ürününü ekleyin.
3. Bir **Permanent Access Token** oluşturun (System User üzerinden).
4. **Phone Number ID** ve **WhatsApp Business Account ID** bilgilerini Enflow Ayarlar modülüne girin.

### B. Webhook Yapılandırması
Gelen mesajları (Müşteri cevapları) yakalamak için:
1. Enflow backend'inde bir endpoint açın: `https://api.enflow.com/webhooks/whatsapp`
2. Meta panelinde "Webhook" sekmesine gidin.
3. `messages` ve `message_deliveries` olaylarına abone olun.

## 3. Üretim Seviyesi Kod Örneği (Node.js/TypeScript)

```typescript
async function sendWhatsAppMessage(to: string, message: string) {
  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to, // Format: 905551234567
      type: "text",
      text: { body: message }
    })
  });

  return await response.json();
}
```

## 4. Güvenlik Notları
- **Rate Limiting:** Meta'nın Tier limitlerine (Tier 1: 1K mesaj/gün) dikkat edin.
- **Sanitization:** Telefon numaralarını `+` ve boşluklardan temizleyen bir helper kullanın: `phone.replace(/\D/g, '')`.
- **Verify Token:** Webhook endpoint'inizde Meta'dan gelen `hub.verify_token` değerini mutlaka kontrol edin.
