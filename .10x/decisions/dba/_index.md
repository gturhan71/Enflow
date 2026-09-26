# DBA — [DISCOVERED]
- Migration geçmişi SQLite'a özgü; Postgres yolu `db push` + provider regex → Postgres'te migration geçmişi yok, şema drift riski.
- SQLite WAL + tek yazar: çok kiracılı SaaS için yazma eşzamanlılığı tavanı.
- Ölçek indeksleri eklenmiş (add_scale_indexes). Para: temiz-yuvarlama, BigInt göçü ertelenmiş.
- RLS: 64 doğrudan + 13 dolaylı politika, gerçek Postgres'te hiç koşulmadı.
