# PM — prod-runtime-pg-pipeline (2026-09-26)
**Kullanıcı:** kurulumu yapan/güncelleyen operatör (müşteri BT'si veya Enflow ekibi); dolaylı olarak tüm son kullanıcılar (kesintisizlik).
## User stories
1. Operatör olarak kurulumdan sonra sunucu yeniden başladığında Enflow'un kendiliğinden açılmasını isterim.
2. Operatör olarak Enflow çökerse otomatik yeniden başlamasını isterim.
3. Operatör olarak Postgres kurulumunu SQLite kadar güvenle güncelleyebilmek isterim (ön-yedek, geri alma).
4. Operatör olarak başarısız bir güncellemenin sistemi çalışmaz bırakmamasını isterim.
5. Geliştirici olarak şema değişikliğini tek komutla iki veritabanı için üretmek isterim.
6. Ekip olarak Postgres + RLS'in her PR'da doğrulanmasını isterim.
## Kabul ölçütleri
Spec "Başarı ölçütleri" bölümü (6 madde) aynen kabul ölçütüdür.
## Kapsam dışı
Docker, çoklu replika, eski db-push kurulumlarını benimsetme, PG otomatik geri yükleme.
