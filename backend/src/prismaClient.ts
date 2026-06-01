import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'file:./dev.db';
const adapter = new PrismaLibSql({ url: connectionString });
export const prisma = new PrismaClient({ adapter });
