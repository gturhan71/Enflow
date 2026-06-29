#!/usr/bin/env node
// Enflow Upgrade Tool — CLI (cron / otomasyon / "otomatik" mod için).
//   node upgrade-tool/cli.mjs check     → uzak sürümü kontrol et + update-status.json yaz
//   node upgrade-tool/cli.mjs status    → mevcut durum dosyasını göster
//   node upgrade-tool/cli.mjs upgrade   → güvenli yükseltme (ön-yedek + rollback)
// Çevre: ENFLOW_HOME (varsayılan: aracın üst dizini), ENFLOW_CHANNEL (auto|tag|commit),
//        ENFLOW_RESTART_CMD (yükseltme sonrası restart komutu).
import { resolveHome, checkAndWrite, readStatus, runUpgrade, currentVersion } from './core.mjs';

const cmd = process.argv[2] || 'check';
const home = resolveHome();
const channel = process.env.ENFLOW_CHANNEL || 'auto';

async function main() {
  if (cmd === 'status') {
    const s = readStatus(home);
    if (!s) { console.log('Durum dosyası yok. Önce `cli.mjs check` çalıştırın.'); process.exit(0); }
    console.log(JSON.stringify(s, null, 2));
    return;
  }

  if (cmd === 'check') {
    const s = await checkAndWrite(home, channel);
    const u = s.update;
    console.log(`Yerel : ${s.current.tag || s.current.shortSha || '?'} (${s.current.date || ''})`);
    console.log(`Uzak  : ${u.kind}:${u.target || '?'} ${u.publishedAt ? '(' + u.publishedAt + ')' : ''}`);
    console.log(u.available ? `⬆ GÜNCELLEME VAR → ${u.target}${u.notes ? '  — ' + u.notes : ''}` : '✓ Güncel.');
    process.exit(u.available ? 10 : 0); // 10 = güncelleme var (cron'da yakalanabilir)
  }

  if (cmd === 'upgrade') {
    console.log(`Yükseltme başlıyor (home=${home}, channel=${channel})...`);
    const res = await runUpgrade(home, {
      channel,
      log: (m) => console.log(m),
      allowDirty: process.env.ENFLOW_ALLOW_DIRTY === '1',
      restartCommand: process.env.ENFLOW_RESTART_CMD || null,
    });
    if (res.noop) { console.log('Zaten güncel.'); process.exit(0); }
    if (res.ok) { console.log(`✓ Yükseltildi: ${res.from.shortSha} → ${res.to.shortSha}`); process.exit(0); }
    console.error(`✗ Yükseltme başarısız (rollback yapıldı): ${res.error}`);
    process.exit(1);
  }

  console.log('Kullanım: cli.mjs [check|status|upgrade]');
  console.log('Mevcut sürüm:', JSON.stringify(currentVersion(home)));
}

main().catch((e) => { console.error(e); process.exit(1); });
