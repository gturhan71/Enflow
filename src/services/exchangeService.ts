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

  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    if (!this.config.isEnabled) return false;
    console.log(`[Exchange] Sending email to ${to} | Subject: ${subject}`);
    return new Promise((resolve) => setTimeout(() => resolve(true), 1000));
  }

  async syncCalendar(userId: string): Promise<boolean> {
    if (!this.config.isEnabled || !this.config.syncCalendar) return false;
    console.log(`[Exchange] Syncing calendar for user: ${userId}`);
    return new Promise((resolve) => setTimeout(() => resolve(true), 2000));
  }
}

export const exchangeService = new ExchangeService();
