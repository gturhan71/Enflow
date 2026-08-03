// Enflow — Tek seferlik: parolası olmayan (legacy) kullanıcılara varsayılan parola ata.
// add_user_password migration'ından SONRA çalıştırılır. Mevcut dev/test kullanıcıları
// (RBAC süiti dahil) böylece giriş yapabilir. Üretimde her kullanıcı KENDİ parolasını
// belirlemeli — bu yalnız dev/test verisi içindir.
//
// Çalıştırma:  npx ts-node src/scripts/backfill-passwords.ts
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config({ quiet: true });

const DEFAULT_PASSWORD = process.env.DEFAULT_SEED_PASSWORD || '123456';
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({ where: { password: null }, select: { id: true, email: true } });
  if (users.length === 0) {
    console.log('Tüm kullanıcıların parolası zaten var. Yapılacak işlem yok.');
    return;
  }
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  for (const u of users) {
    await prisma.user.update({ where: { id: u.id }, data: { password: hash } });
    console.log(`  ✔ ${u.email} → varsayılan parola atandı`);
  }
  console.log(`\n${users.length} kullanıcıya varsayılan parola ("${DEFAULT_PASSWORD}") atandı. Üretimde değiştirin.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
