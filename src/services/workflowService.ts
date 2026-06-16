import { apiService } from './apiService';
import { whatsappService } from './whatsappService';
import { exchangeService } from './exchangeService';
import { WorkflowLog, Notification, ApprovalChain } from '../types';
import { logger } from '../utils/logger';

interface HandOffParticipant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

class WorkflowService {
  private logs: WorkflowLog[] = [];
  private notifications: Notification[] = [];

  // Approval Chain Methods — Faz 0: backend'deki kalıcı ApprovalChain'e bağlı
  // (eskiden sayfa yenilenince kaybolan in-memory dizi idi).
  async createApprovalChain(entityType: string, entityId: string, stages: { role: string; order?: number }[]) {
    return apiService.createApprovalChain({ entityType, entityId, stages }) as Promise<ApprovalChain>;
  }

  async getChainForEntity(entityType: string, entityId: string) {
    return apiService.getApprovalChain(entityType, entityId) as Promise<ApprovalChain | null>;
  }

  async approveStage(chainId: string, stageId: string, approverId: string, note?: string) {
    return apiService.approveApprovalStage(chainId, stageId, { approverId, note }) as Promise<ApprovalChain>;
  }

  async rejectStage(chainId: string, stageId: string, approverId: string, note?: string) {
    return apiService.rejectApprovalStage(chainId, stageId, { approverId, note }) as Promise<ApprovalChain>;
  }

  async triggerHandOff(params: {
    itemId: string;
    itemTitle: string;
    fromUnit: string;
    toUnit: string;
    fromUser: HandOffParticipant;
    toUser: HandOffParticipant;
    note: string;
  }) {
    const { itemId, itemTitle, fromUnit, toUnit, fromUser, toUser, note } = params;

    // 1. Create Workflow Log
    const newLog: WorkflowLog = {
      id: `wf-${Date.now()}`,
      itemId,
      fromUnitId: fromUnit,
      toUnitId: toUnit,
      assignedBy: fromUser.id,
      assignedTo: toUser.id,
      note,
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    };
    this.logs.push(newLog);

    // 2. Trigger WhatsApp Notification
    const waMessage = `🔔 *Yeni İş Ataması*\n\nProje: ${itemTitle}\nBirim: ${fromUnit} -> ${toUnit}\nAtayan: ${fromUser.name}\nNot: ${note}\n\nLütfen Enflow üzerinden detayları kontrol edin.`;
    await whatsappService.sendMessage(toUser.phone || '905550000000', waMessage);

    // 3. Trigger Email Notification
    const emailSubject = `Yeni İş Ataması: ${itemTitle}`;
    const emailBody = `
      <h3>Yeni İş Ataması Bildirimi</h3>
      <p><b>Proje/Fırsat:</b> ${itemTitle}</p>
      <p><b>Aktaran Birim:</b> ${fromUnit}</p>
      <p><b>Sorumlu:</b> ${fromUser.name}</p>
      <p><b>Not:</b> ${note}</p>
      <hr/>
      <p>Bu e-posta Enflow İş Akış Yönetimi tarafından otomatik olarak gönderilmiştir.</p>
    `;
    await exchangeService.sendEmail(toUser.email, emailSubject, emailBody);

    // 4. Create System Notification
    const sysNotification: Notification = {
      id: `ntf-${Date.now()}`,
      userId: toUser.id,
      title: 'Yeni İş Atandı',
      message: `${itemTitle} projesi için ${fromUnit} biriminden yeni bir görev geldi.`,
      type: 'SYSTEM',
      isRead: false,
      timestamp: new Date().toISOString()
    };
    this.notifications.push(sysNotification);

    logger.debug(`[Workflow] Hand-off completed for ${itemTitle} from ${fromUnit} to ${toUnit}`);
    return newLog;
  }

  getLogsForItem(itemId: string) {
    return this.logs.filter(l => l.itemId === itemId);
  }

  getNotificationsForUser(userId: string) {
    return this.notifications.filter(n => n.userId === userId);
  }
}

export const workflowService = new WorkflowService();
