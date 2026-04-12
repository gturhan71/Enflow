# ENFLOW - Kurumsal Yönetim Sistemi

<div align="center">
  <img width="1200" height="475" alt="ENFLOW Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

ENFLOW, sistem entegratörleri için tasarlanmış kapsamlı bir kurumsal yönetim platformudur. Fiziksel arşiv takibi, noter onay yönetimi, satın alma süreçleri (BoM, ETA, Depo), CRM, proje yönetimi ve sözleşme yönetimi gibi kritik iş süreçlerini uçtan uca yönetir.

## Ozellikler

- **Dashboard**: Proje özetleri, pipeline görünümü, kritik uyarılar
- **CRM & Müşteri**: Fırsat takibi, müşteri yönetimi, satış boru hattı
- **Presales & Dizayn**: Teknik teklif hazırlama, BoM yönetimi
- **Satış Destek**: Teklif onay süreçleri, müşteri ilişkileri
- **Satın Alma**: BoM bazlı siparişler, tedarikçi yönetimi, ETA takibi
- **Fiziksel Arşiv**: Evrak takibi, klasör yönetimi, arama
- **Şirket Evrakları**: ISO sertifikaları, yasal belgeler, vergi belgeleri
- **Maliyet Analizi**: Proje maliyetleri, kar analizi, bütçe takibi
- **Sözleşme Yönetimi**: Sözleşme takibi, garanti süreleri, belge gereksinimleri
- **Proje Yönetimi**: Görev yönetimi, proje takvimi, ilerleme takibi
- **Görevler & Takip**: Birim görevleri, öncelik yönetimi, takip
- **Şirket Ayarları**: Profil, birimler, kullanıcılar, yetkiler, entegrasyonlar

## Teknoloji Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4
- **Animasyon**: Motion (Framer Motion)
- **Icons**: Lucide React
- **Charts**: Recharts, D3
- **Build**: Vite 6
- **Backend**: Express.js (isteğe bağlı)

## Kurulum

### Gereksinimler

- Node.js 18+
- npm veya yarn

### Adımlar

```bash
# Dependencies yükle
npm install

# Geliştirme sunucusu başlat
npm run dev

# Production build
npm run build
```

## Proje Yapısı

```
src/
├── modules/          # UI modülleri
│   ├── Dashboard.tsx
│   ├── CRMModule.tsx
│   ├── ProcurementModule.tsx
│   └── ...
├── services/         # API servisleri
│   ├── nextcloudService.ts
│   ├── exchangeService.ts
│   └── whatsappService.ts
├── layout/           # Layout bileşenleri
│   ├── Sidebar.tsx
│   └── Header.tsx
├── contexts/         # React Context
├── lib/              # Utility fonksiyonlar
├── types.ts          # TypeScript tip tanımları
├── constants.ts      # Sabitler ve mock veriler
├── App.tsx           # Ana uygulama
└── main.tsx          # Entry point
```

## Entegrasyonlar

- **Nextcloud**: Dosya depolama ve paylaşım
- **Microsoft Exchange**: E-posta ve takvim senkronizasyonu
- **WhatsApp Business**: Müşteri iletişimi

## Lisans

MIT License