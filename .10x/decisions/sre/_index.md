# SRE — [DISCOVERED]
- `/api/health` var; metrik/trace/alert yok. Prod'da JSON log, toplayıcı yok.
- Yedek + doğrulama zamanlayıcısı var (iyi). Restore akışı var.
- Tek process: zamanlayıcı çökerse API de etkilenir; SLO tanımı yok.
