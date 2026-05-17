const http = require('http');
const { exec } = require('child_process');

let isRestarting = false;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.url === '/restart') {
    if (isRestarting) {
      console.log('⏳ Zaten bir restart işlemi devam ediyor, istek yoksayıldı.');
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Restart in progress' }));
    }

    isRestarting = true;
    console.log('🔄 Restart işlemi başlatıldı...');
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Sistem yeniden başlatılıyor...' }));
    
    // Script'i çalıştır
    exec('./start.sh', (err, stdout, stderr) => {
      // 30 saniye sonra kilidi aç (Sistemin oturması için süre tanı)
      setTimeout(() => {
        isRestarting = false;
        console.log('🔓 Restart kilidi açıldı.');
      }, 30000);

      if (err) {
        console.error('Restart hatası:', err);
        return;
      }
      console.log('✅ Sistem başarıyla tetiklendi.');
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Restarter Active');
  }
});

server.listen(3005, () => {
  console.log('🚀 Enflow Otonom Restarter Port 3005 üzerinde aktif (Kilit Korumalı)');
});
