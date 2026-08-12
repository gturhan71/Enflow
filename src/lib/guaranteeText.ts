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
