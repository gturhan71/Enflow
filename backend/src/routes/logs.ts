import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { asyncHandler, tenantMiddleware } from '../middleware';

const router: Router = Router();

router.post('/', (req: Request, res: Response) => {
  const { userId, timestamp, action } = req.body;
  const logMessage = `[${timestamp}] User ${userId} ${action}\n`;
  const logPath = path.join(process.cwd(), 'notifications_access.log');

  fs.appendFile(logPath, logMessage, (err) => {
    if (err) {
      logger.error('Logging failed:', err);
      return res.status(500).json({ error: 'Logging failed' });
    }
    res.json({ success: true });
  });
});

router.get('/', tenantMiddleware, asyncHandler(async (_req: Request, res: Response) => {
  const logPath = path.join(process.cwd(), 'notifications_access.log');

  if (!fs.existsSync(logPath)) {
    return res.json({ logs: [] });
  }

  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Read failed' });
    const logs = data.split('\n').filter(Boolean).map(line => {
      const match = line.match(/\[(.*?)\] User (.*?) (.*)/);
      return match ? { timestamp: match[1], userId: match[2], action: match[3] } : null;
    }).filter(Boolean);
    res.json({ logs: logs.reverse() });
  });
}));

export default router;
