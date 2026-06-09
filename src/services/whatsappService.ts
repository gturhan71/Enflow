import { WhatsAppConfig } from '../types';
import { logger } from '../utils/logger';

class WhatsAppService {
  private config: WhatsAppConfig = {
    phoneNumberId: '',
    accessToken: '',
    businessAccountId: '',
    webhookVerifyToken: '',
    isEnabled: false
  };

  getConfig(): WhatsAppConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: WhatsAppConfig) {
    this.config = { ...newConfig, isEnabled: true };
    logger.debug('WhatsApp Config Updated:', this.config);
  }

  testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 1500);
    });
  }

  async sendMessage(to: string, text: string): Promise<boolean> {
    if (!this.config.isEnabled) {
      console.warn('WhatsApp service is not enabled.');
      return false;
    }
    logger.debug(`[WhatsApp] Sending message to ${to}: ${text}`);
    // Real Meta API call would happen here
    return new Promise((resolve) => setTimeout(() => resolve(true), 800));
  }
}

export const whatsappService = new WhatsAppService();
