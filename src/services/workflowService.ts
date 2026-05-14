import { whatsappService } from './whatsappService';
import { exchangeService } from './exchangeService';
import { WorkflowLog, Notification } from '../types';

class WorkflowService {
  private logs: WorkflowLog[] = [];
  private notifications: Notification[] = [];

  async triggerHandOff(params: {
    itemId: string;
    itemTitle: string;
    fromUnit: string;
    toUnit: string;
    fromUser: any;
    toUser: any;
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

    console.log(`[Workflow] Hand-off completed for ${itemTitle} from ${fromUnit} to ${toUnit}`);
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
