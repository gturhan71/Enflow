# CTO — [DISCOVERED]
- Ürün: çok kiracılı B2B satış→sözleşme→proje→satınalma→finans SaaS; Türk kamu ihalesi (İKN, İSAB, teminat) odaklı niş.
- Dağıtım modeli: bare-metal/on-prem kurulum sihirbazı (`install/wizard.mjs`) + SaaS iddiası; Docker/K8s yok.
- Yığın: React 19 + Vite 8 + TS 6 / Express 5 + Prisma; SQLite varsayılan, Postgres opsiyonel (provider regex ile çevriliyor).
- Tek geliştirici + YZ ajanları ile ~5 ayda 362 commit, ~63k satır (FE 39k, BE 24k). Kapsam genişliği kalite altyapısını aşıyor.
