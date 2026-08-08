import { useEffect, useRef } from 'react';
import { apiClient } from '../../services/apiClient';

// Sunucudan gelen "bir şey değişti" sinyaliyle Dashboard'ı anlık yeniler.
// Bağlantı koparsa (ağ, sunucu yeniden başlatma) birkaç saniye sonra otomatik
// yeniden dener; Dashboard.tsx'teki periyodik polling zaten güvenlik ağı olarak
// paralelde çalışmaya devam eder — bu hook sadece polling'i hızlandıran bir katman.
export function useDashboardStream(onRefresh: () => void): void {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;

    const connect = async () => {
      while (!stopped) {
        try {
          await apiClient.streamDashboard(() => onRefreshRef.current(), controller.signal);
        } catch {
          /* bağlantı koptu — aşağıda yeniden denenecek */
        }
        if (stopped) break;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    };
    connect();

    return () => { stopped = true; controller.abort(); };
  }, []);
}
