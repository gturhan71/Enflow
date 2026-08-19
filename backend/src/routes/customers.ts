import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { encryptForTenant, decryptForTenant } from '../services/tenantEncryption';
import { normalizeCompanyName, similarityRatio } from '../utils/textSimilarity';

const DUPLICATE_SIMILARITY_THRESHOLD = 0.82;

// B-06 — mükerrer kurum kaydı uyarısı: kayıt reddedilmez (Faz 1/2'deki "uyar,
// engelleme" felsefesiyle aynı), yalnız görünür + denetlenebilir hale gelir.
// excludeId: parentId verilmişse üst müşteri karşılaştırmadan hariç tutulur —
// şube adının üst müşteri adına benzemesi (ör. "ABC — İstanbul Şubesi" vs "ABC") beklenendir.
async function findPossibleDuplicates(tenantId: string, name: string, excludeId?: string) {
  if (!name) return [] as { id: string; name: string; similarity: number }[];
  const normalizedNew = normalizeCompanyName(name);
  const existing = await prisma.customer.findMany({
    where: { tenantId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, name: true },
  });
  return existing
    .map((c) => ({ id: c.id, name: c.name, similarity: Math.round(similarityRatio(normalizedNew, normalizeCompanyName(c.name)) * 100) / 100 }))
    .filter((m) => m.similarity >= DUPLICATE_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

// Alt birim (şube) ilişkisi — tek seviye hiyerarşi (bkz. Unit.parentId deseni).
// Tenant-scope doğrulaması burada yapılır: parentId'nin var olduğunu VE aynı
// tenant'a ait olduğunu kontrol etmeden kabul etmek, FK'nın satırın varlığını
// kontrol edip tenant'ını kontrol etmemesi nedeniyle cross-tenant bağlantıya yol açar.
async function validateParent(tenantId: string, parentId: string, selfId?: string): Promise<string | null> {
  if (selfId && parentId === selfId) return 'Bir müşteri kendi üst müşterisi olamaz.';
  const parent = await prisma.customer.findFirst({ where: { id: parentId, tenantId }, select: { id: true, parentId: true } });
  if (!parent) return 'Üst müşteri bulunamadı.';
  if (parent.parentId) return 'Üst müşteri olarak yalnızca en üst seviye müşteri seçilebilir.';
  return null;
}

const GM = requireRole(['GENERAL_MANAGER']);
const GM_OR_SALES = requireRole(['GENERAL_MANAGER', 'SALES_REP']);
const router: Router = Router();

// taxNumber/taxOffice DB'de şifreli saklanır (bkz. tenantEncryption.ts) — listede çözülüp dönülür.
async function decryptCustomer<T extends { taxNumber: string | null; taxOffice: string | null }>(tenantId: string, customer: T): Promise<T> {
  const [taxNumber, taxOffice] = await Promise.all([
    decryptForTenant(tenantId, customer.taxNumber),
    decryptForTenant(tenantId, customer.taxOffice),
  ]);
  return { ...customer, taxNumber, taxOffice };
}

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const customers = await prisma.customer.findMany({
    where: { tenantId: req.tenantId },
    orderBy: { name: 'asc' },
    include: { contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] } },
  });
  res.json(await Promise.all(customers.map((c) => decryptCustomer(req.tenantId, c))));
}));

router.post('/', tenantMiddleware, GM_OR_SALES, asyncHandler(async (req: Request, res: Response) => {
  const body = { ...req.body };
  if (body.parentId) {
    const parentError = await validateParent(req.tenantId, body.parentId);
    if (parentError) return res.status(400).json({ error: parentError });
  }
  const duplicateWarning = await findPossibleDuplicates(req.tenantId, body.name, body.parentId || undefined);
  if (body.taxNumber) body.taxNumber = await encryptForTenant(req.tenantId, body.taxNumber);
  if (body.taxOffice) body.taxOffice = await encryptForTenant(req.tenantId, body.taxOffice);
  const customer = await prisma.customer.create({
    data: { ...body, tenantId: req.tenantId }
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'CUSTOMER', entityId: customer.id, details: { name: customer.name, duplicateWarning: duplicateWarning.length ? duplicateWarning : undefined } });
  res.json({ ...(await decryptCustomer(req.tenantId, customer)), duplicateWarning: duplicateWarning.length ? duplicateWarning : null });
}));

router.put('/:id', tenantMiddleware, GM_OR_SALES, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const body = { ...req.body };
  if (body.parentId) {
    const parentError = await validateParent(tenantId, body.parentId, id);
    if (parentError) return res.status(400).json({ error: parentError });
    const childCount = await prisma.customer.count({ where: { parentId: id, tenantId } });
    if (childCount > 0) return res.status(400).json({ error: 'Alt birimi olan bir müşteri başka bir müşterinin altına taşınamaz.' });
  }
  if (body.taxNumber) body.taxNumber = await encryptForTenant(tenantId, body.taxNumber);
  if (body.taxOffice) body.taxOffice = await encryptForTenant(tenantId, body.taxOffice);
  const customer = await prisma.customer.update({ where: { id }, data: body });
  await logActivity({ tenantId, userId: req.userId, action: 'UPDATE', entityType: 'CUSTOMER', entityId: id, details: { name: customer.name } });
  res.json(await decryptCustomer(tenantId, customer));
}));

router.delete('/:id', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const childCount = await prisma.customer.count({ where: { parentId: id, tenantId } });
  if (childCount > 0) return res.status(400).json({ error: `Bu müşterinin ${childCount} alt birimi var, önce onları silin veya taşıyın.` });

  await prisma.customer.delete({ where: { id } });
  await logActivity({ tenantId, userId: req.userId, action: 'DELETE', entityType: 'CUSTOMER', entityId: id });
  res.json({ message: 'Müşteri silindi.' });
}));

// ── Kişiler (Contact) — kurumsal müşteride birden çok kişi ─────────────────────
router.get('/:id/contacts', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const customerId = String(req.params.id);
  const owns = await prisma.customer.findFirst({ where: { id: customerId, tenantId: req.tenantId }, select: { id: true } });
  if (!owns) return res.status(404).json({ error: 'Müşteri bulunamadı.' });
  const contacts = await prisma.contact.findMany({ where: { customerId, tenantId: req.tenantId }, orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] });
  res.json(contacts);
}));

router.post('/:id/contacts', tenantMiddleware, GM_OR_SALES, asyncHandler(async (req: Request, res: Response) => {
  const customerId = String(req.params.id);
  const tenantId = req.tenantId;
  const owns = await prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } });
  if (!owns) return res.status(404).json({ error: 'Müşteri bulunamadı.' });

  const { name, role, title, email, phone, isPrimary, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Kişi adı zorunludur.' });

  if (isPrimary) {
    await prisma.contact.updateMany({ where: { customerId, tenantId }, data: { isPrimary: false } });
  }
  const contact = await prisma.contact.create({
    data: { tenantId, customerId, name, role: role || 'OTHER', title: title || null, email: email || null, phone: phone || null, isPrimary: !!isPrimary, notes: notes || null },
  });
  await logActivity({ tenantId, userId: req.userId, action: 'CREATE', entityType: 'CONTACT', entityId: contact.id, details: { customerId, name: contact.name } });
  res.json(contact);
}));

router.put('/:id/contacts/:contactId', tenantMiddleware, GM_OR_SALES, asyncHandler(async (req: Request, res: Response) => {
  const customerId = String(req.params.id);
  const contactId = String(req.params.contactId);
  const tenantId = req.tenantId;
  const record = await prisma.contact.findFirst({ where: { id: contactId, customerId, tenantId } });
  if (!record) return res.status(404).json({ error: 'Kişi bulunamadı.' });

  const { name, role, title, email, phone, isPrimary, notes } = req.body;
  if (isPrimary) {
    await prisma.contact.updateMany({ where: { customerId, tenantId, id: { not: contactId } }, data: { isPrimary: false } });
  }
  const contact = await prisma.contact.update({
    where: { id: contactId },
    data: {
      ...(name !== undefined && { name }),
      ...(role !== undefined && { role }),
      ...(title !== undefined && { title }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(isPrimary !== undefined && { isPrimary: !!isPrimary }),
      ...(notes !== undefined && { notes }),
    },
  });
  await logActivity({ tenantId, userId: req.userId, action: 'UPDATE', entityType: 'CONTACT', entityId: contactId, details: { customerId, name: contact.name } });
  res.json(contact);
}));

router.delete('/:id/contacts/:contactId', tenantMiddleware, GM_OR_SALES, asyncHandler(async (req: Request, res: Response) => {
  const customerId = String(req.params.id);
  const contactId = String(req.params.contactId);
  const tenantId = req.tenantId;
  const record = await prisma.contact.findFirst({ where: { id: contactId, customerId, tenantId } });
  if (!record) return res.status(404).json({ error: 'Kişi bulunamadı.' });

  await prisma.contact.delete({ where: { id: contactId } });
  await logActivity({ tenantId, userId: req.userId, action: 'DELETE', entityType: 'CONTACT', entityId: contactId, details: { customerId, name: record.name } });
  res.json({ message: 'Kişi silindi.' });
}));

export default router;
