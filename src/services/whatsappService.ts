import { WhatsAppConfig } from '../types';

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
    console.log('WhatsApp Config Updated:', this.config);
  }

  testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 1500);
    });
  }
}

export const whatsappService = new WhatsAppService();
