export const SIMULATION_STEPS = [
  {
    id: 'step-1',
    title: 'CRM & Fırsat Oluşturma',
    unit: 'Satış & Pazarlama',
    role: 'Satış Temsilcisi',
    assignee: 'Ali Veli',
    description: 'Müşteri ile ilk görüşme yapılır. Müşteri veri tabanına "Global Bank A.Ş." eklenir ve $250,000 değerinde "Veri Merkezi Genişletme" fırsatı (CRM Fırsatı) açılır.',
    entityCreated: {
      model: 'Opportunity (Prisma)',
      data: { id: 'opp-250k', title: 'Veri Merkezi Genişletme', customerId: 'c1', value: 250000, status: 'QUALIFIED' }
    },
    whatsapp: 'Sistem: [Enflow CRM] "Veri Merkezi Genişletme" isimli yeni bir fırsat başarıyla CRM sistemine tanımlandı.',
    email: {
      to: 'sales-mgr@t-ecosystem.com',
      subject: 'Yeni Fırsat Tanımlandı',
      body: `Merhaba,

Global Bank A.Ş. için yeni bir fırsat tanımlanmıştır.`
    },
    taskCreated: 'Presales birimi için teknik analiz hazırlama işi otomatik oluşturuldu.'
  },
  {
    id: 'step-2',
    title: 'Presales & Yapay Zeka Analizi',
    unit: 'Teknik Çözümler (Presales)',
    role: 'Presales Mühendisi',
    assignee: 'Göktuğ Turhan',
    description: 'Müşteri şartnamesi sisteme yüklenir. AI analizi sonrası BoM listesi çıkarılır.',
    entityCreated: {
      model: 'BoMItem[] (Prisma)',
      data: [{ id: 'bom-1', partNumber: 'DELL-R750-01', description: 'PowerEdge R750 Server', quantity: 4, purchaseCost: 4500, status: 'MATCHED' }]
    },
    whatsapp: 'Sistem: [Enflow Presales] Şartname analizi tamamlandı.',
    email: {
      to: 'goktugturhan74@gmail.com',
      subject: 'AI Şartname Analizi Tamamlandı',
      body: `Merhaba,

Şartname analizi tamamlanmıştır.`
    },
    taskCreated: 'BoM onay bekliyor durumuna getirildi.'
  },
  {
    id: 'step-3',
    title: 'Maliyet Analizi & Kâr Marjı',
    unit: 'Satış Destek & Maliyet',
    role: 'Satış Destek Yöneticisi',
    assignee: 'Ali Veli',
    description: 'Ürünlerin alış maliyetleri üzerinden hedef kâr marjları belirlenir.',
    entityCreated: {
      model: 'CostRequirement & Proposal',
      data: { proposalValue: 250000, margin: 15, status: 'AWAITING_APPROVAL' }
    },
    whatsapp: 'Sistem: [Enflow Onay] Fiyatlandırma onayınıza sunulmuştur.',
    email: {
      to: 'gokhan@t-ecosystem.com',
      subject: 'ACİL ONAY: Satış Teklifi',
      body: `Sayın Gökhan Turhan,

Teklif onay süreci başlamıştır.`
    },
    taskCreated: 'Genel Müdür için onay görevi oluşturuldu.'
  },
  {
    id: 'step-4',
    title: 'Müşteri Teklifi & Kazanım (Won)',
    unit: 'Satış & Pazarlama',
    role: 'Satış Temsilcisi',
    assignee: 'Ali Veli',
    description: 'Teklif PDF üretilir ve müşteri kabulü ile fırsat WON statüsüne geçer.',
    entityCreated: {
      model: 'Opportunity (Updated)',
      data: { id: 'opp-250k', status: 'WON' }
    },
    whatsapp: 'Sistem: [Tebrikler 🎉] Proje kazanıldı!',
    email: {
      to: 'sales-all@t-ecosystem.com',
      subject: 'TEBRİKLER: Proje Kazanıldı!',
      body: `Merhaba Enflow Ailesi,

Proje resmi olarak kazanılmıştır.`
    },
    taskCreated: 'Sözleşme taslağı oluşturuldu.'
  },
  {
    id: 'step-5',
    title: 'Sözleşme & Evrak Doğrulama',
    unit: 'Satış Destek Birimi',
    role: 'Satış Destek Sorumlusu',
    assignee: 'Ali Veli',
    description: 'Gerekli tüm idari evraklar toplanır ve doğrulanır.',
    entityCreated: {
      model: 'Contract Documents',
      data: { status: 'ALL_APPROVED' }
    },
    whatsapp: 'Sistem: [Enflow Sözleşme] Evraklar doğrulandı.',
    email: {
      to: 'legal@t-ecosystem.com',
      subject: 'Sözleşme Evrakları Doğrulandı',
      body: `Merhaba,

İdari evrak doğrulama süreci tamamlanmıştır.`
    },
    taskCreated: 'Sözleşme "İmzalandı" durumuna hazır.'
  },
  {
    id: 'step-6',
    title: 'Sözleşme İmzalama & Paralel Devir',
    unit: 'Genel Müdürlük & Operasyon',
    role: 'Genel Müdür',
    assignee: 'Gökhan Turhan',
    description: 'Sözleşme imzalanır, PM ve Satınalma süreçleri başlar.',
    entityCreated: {
      model: 'Project & Parallel Tasks',
      data: { projectId: 'proj-101', status: 'IN_PROGRESS' }
    },
    whatsapp: 'Sistem: [Paralel İş Akışı ⚡] Sözleşme imzalandı!',
    email: {
      to: 'pm@t-ecosystem.com',
      subject: 'PROJE BAŞLATILDI',
      body: `Sayın Yöneticiler,

Sözleşme imzalanmıştır.`
    },
    taskCreated: 'İş emirleri oluşturuldu.'
  },
  {
    id: 'step-7',
    title: 'Satın Alma & Proje Uygulama',
    unit: 'Satın Alma & Operasyon',
    role: 'Operasyon Sorumlusu',
    assignee: 'Göktuğ Turhan',
    description: 'Tedarik ve kabul testleri (UAT) tamamlanır.',
    entityCreated: {
      model: 'Procurement & KanbanTasks',
      data: { deliveryStatus: 'DELIVERED', uatTest: 'SUCCESSFUL' }
    },
    whatsapp: 'Sistem: [Enflow Saha] Teslimat ve UAT tamamlandı.',
    email: {
      to: 'proc@t-ecosystem.com',
      subject: 'Tedarik ve Kabul Testleri Tamamlandı',
      body: `Merhaba,

UAT kabul testleri başarıyla verilmiştir.`
    },
    taskCreated: 'Proje görevleri tamamlandı.'
  },
  {
    id: 'step-8',
    title: 'Proje Kapanış & Arşivleme',
    unit: 'Operasyon & Fiziksel Arşiv',
    role: 'Arşiv Sorumlusu',
    assignee: 'Gökhan Turhan',
    description: 'Müşteri kabul tutanağı yüklenir ve arşivlenir.',
    entityCreated: {
      model: 'Project & PhysicalArchive',
      data: { projectStatus: 'COMPLETED', archiveLocation: 'Oda A, Raf 3, Kutu 12' }
    },
    whatsapp: 'Sistem: [Başarı! 🎓] Proje kapandı ve arşivlendi.',
    email: {
      to: 'gokhan@t-ecosystem.com',
      subject: 'PROJE TAMAMLANDI',
      body: `Sayın Gökhan Turhan,

Proje başarıyla tamamlanmıştır.`
    },
    taskCreated: 'Proje sonlandırıldı.'
  }
];
