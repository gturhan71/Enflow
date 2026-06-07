import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      tenantId: string;
      userId: string;
    }
  }
}
