/** Backend'in kendi hashPassword'unu kullanir — test kullanicilari GERCEK login akisindan gecer. */
export async function hashTestPassword(password: string): Promise<string> {
  const mod = await import('../../../backend/src/services/auth');
  return mod.hashPassword(password);
}
