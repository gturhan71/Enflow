// HTML kaçışlama — `window.open('') + document.write` ile üretilen yazdırma pencereleri için.
// Bu pencereler uygulamayla AYNI origin'de açılır (window.opener erişimi, aynı oturum çerezi): kullanıcı
// verisini (proje/müşteri/tedarikçi adı vb.) kaçışlamadan HTML'e koymak, düşük yetkili bir kullanıcının
// yazdığı `<img onerror=…>`'nin bir yöneticinin oturumunda çalışması demektir (saklı XSS).
const MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Metin/öznitelik bağlamı için güvenli; null/undefined → ''. */
export function escapeHtml(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, (c) => MAP[c]);
}
