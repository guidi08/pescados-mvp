import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000'),
  APP_BASE_URL: z.string().default('http://localhost:19006'),
  ADMIN_BASE_URL: z.string().default('http://localhost:3000'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),

  STRIPE_SECRET_KEY: z.string().min(10),
  STRIPE_PUBLISHABLE_KEY: z.string().min(10),
  STRIPE_WEBHOOK_SECRET: z.string().min(10),

  // Fees charged from seller (platform application fee)
  PLATFORM_COMMISSION_BPS: z.string().default('500'), // 5%
  PLATFORM_PROCESSING_BPS: z.string().default('399'), // 3.99% (não inclui taxa fixa por transação)

  // Business rules
  CANCEL_HOURS_BEFORE_CUTOFF_FROZEN: z.string().default('6'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('LotePro <no-reply@seudominio.com.br>'),

  // AI
  OPENAI_API_KEY: z.string().min(10).optional(),
  OPENAI_MODEL: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export const commissionBps = Number(env.PLATFORM_COMMISSION_BPS);
export const processingBps = Number(env.PLATFORM_PROCESSING_BPS);
export const cancelHoursBeforeCutoffFrozen = Number(env.CANCEL_HOURS_BEFORE_CUTOFF_FROZEN);
