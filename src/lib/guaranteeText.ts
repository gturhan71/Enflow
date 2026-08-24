// Teminat mektubu için örnek metin şablonu — İhale (SalesSupport) ve Sözleşme
// Yönetimi (ContractWorkflow) modüllerinin ikisi de Finans'a teminat talep ederken
// aynı şablonu kullanır.
export function sampleGuaranteeText(
  workName: string,
  refNo: string | null | undefined,
  type: string,
  amount: string,
  currency: string,
  expiry: string,
  indefinite: boolean,
): string {
  const tur = type === 'BID_BOND' ? 'GEÇİCİ' : 'KESİN';
  const vade = indefinite ? 'SÜRESİZ' : (expiry ? new Date(expiry).toLocaleDateString('tr-TR') : '[VADE]');
  return `${tur} TEMİNAT MEKTUBU\n\nİş: ${workName}${refNo ? ` (İKN: ${refNo})` : ''}\nTutar: ${amount || '[TUTAR]'} ${currency}\nVade: ${vade}\n\nİdaremize/işverene hitaben, yukarıda belirtilen iş için ${amount || '[TUTAR]'} ${currency} tutarında ${tur.toLowerCase()} teminat olarak işbu teminat mektubu düzenlenmiştir. Banka, ilk yazılı talepte protesto çekmeye gerek olmaksızın bedeli ödemeyi kabul ve taahhüt eder.`;
}

/**
 * Talep aşamasında eklenen örnek teminat mektubu dosyasını GuaranteeLetter.sampleFileUrl'e
 * yükler — record önce (JSON, sampleText ile) oluşturulur, dosya varsa hemen ardından bu
 * fonksiyonla eklenir (target=sample; backend aynı upload uç noktasını fileUrl yerine
 * sampleFileUrl'e yazacak şekilde ayırt eder — bkz. backend/src/routes/finance.ts).
 * SalesSupport (İhale) ve ContractWorkflow (Sözleşme Yönetimi) ikisi de kullanır.
 */
export async function uploadGuaranteeSampleFile(guaranteeId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('target', 'sample');
  const effectiveTenantId = localStorage.getItem('enflow_active_tenant_id') || '';
  const effectiveToken = localStorage.getItem('enflow_auth_token') || 'mock-token';
  const res = await fetch(`/api/finance/guarantees/${guaranteeId}/upload`, {
    method: 'POST',
    headers: { 'x-tenant-id': effectiveTenantId, Authorization: `Bearer ${effectiveToken}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
}
