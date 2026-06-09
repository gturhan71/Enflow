import { ExchangeConfig } from '../types';
import { logger } from '../utils/logger';

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
    logger.debug('Exchange Config Updated:', this.config);
    // Actual integration logic would go here (e.g., EWS or Microsoft Graph API)
  }

  testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 1500);
    });
  }

  async sendEmail(to: string, subject: string, _body: string): Promise<boolean> {
    if (!this.config.isEnabled) return false;
    logger.debug(`[Exchange] Sending email to ${to} | Subject: ${subject}`);
    return new Promise((resolve) => setTimeout(() => resolve(true), 1000));
  }

  async syncCalendar(userId: string): Promise<boolean> {
    if (!this.config.isEnabled || !this.config.syncCalendar) return false;
    logger.debug(`[Exchange] Syncing calendar for user: ${userId}`);
    return new Promise((resolve) => setTimeout(() => resolve(true), 2000));
  }
}

export const exchangeService = new ExchangeService();
