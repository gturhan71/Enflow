#!/bin/bash

echo "🚀 Enflow Sistemi Başlatılıyor..."

# 1. Eski süreçleri temizle
echo "🧹 Portlar temizleniyor..."
lsof -ti :3002 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
pkill -f "vite" || true
pkill -f "ts-node" || true

# 2. Backend'i başlat
echo "📂 Backend başlatılıyor..."
cd backend
nohup pnpm ts-node src/index.ts > ../backend_log.txt 2>&1 &
cd ..

# 3. Bekle ve Devam Et (Loop'a girmeden)
echo "⏳ Backend ayağa kalkıyor..."
sleep 5

# 4. Frontend'i başlat
echo "🖥️ Frontend başlatılıyor..."
nohup pnpm vite --port 3000 --host > frontend_log.txt 2>&1 &

echo "✨ Sistem Tetiklendi!"
