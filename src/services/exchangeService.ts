import { ExchangeConfig } from '../types';

class ExchangeService {
  private config: ExchangeConfig = {
    serverUrl: '',
    domain: '',
    adminEmail: '',
    adminPass: '',
    syncEmails: true,
    syncCalendar: true,
    isEnabled: false
  };

  getConfig(): ExchangeConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: ExchangeConfig) {
    this.config = { ...newConfig, isEnabled: true };
    console.log('Exchange Config Updated:', this.config);
    // Actual integration logic would go here (e.g., EWS or Microsoft Graph API)
  }

  testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 1500);
    });
  }
}

export const exchangeService = new ExchangeService();
