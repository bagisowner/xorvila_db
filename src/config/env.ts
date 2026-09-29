import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.preprocess((val) => {
    if (val === '8080' || val === 8080) return 3000;
    return val;
  }, z.coerce.number().default(3000)),
  HOST: z.string().default('0.0.0.0'),
  APP_URL: z.string().default('http://localhost:3000'),

  // PostgreSQL Database
  DATABASE_URL: z.string().optional(),
  DATABASE_HOST: z.string().default('127.0.0.1'),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_NAME: z.string().default('mcpanel_db'),
  DATABASE_USER: z.string().default('mcpanel'),
  DATABASE_PASSWORD: z.string().default('mcpanel_password'),
  DATABASE_SSL: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(20),

  // Secrets
  SESSION_SECRET: z.string().default('mcpanel_development_session_secret_change_in_production_min32'),
  API_KEY_SECRET: z.string().default('mcpanel_development_api_key_secret_change_in_production_min32'),
  TOKEN_SECRET: z.string().default('mcpanel_development_token_secret_change_in_production_min32'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),

  // OAuth
  OAUTH_GOOGLE_ENABLED: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().optional().default('http://localhost:3000/api/v1/auth/oauth/google/callback'),

  OAUTH_DISCORD_ENABLED: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  DISCORD_CLIENT_ID: z.string().optional().default(''),
  DISCORD_CLIENT_SECRET: z.string().optional().default(''),
  DISCORD_CALLBACK_URL: z.string().optional().default('http://localhost:3000/api/v1/auth/oauth/discord/callback'),

  // Email / SMTP
  EMAIL_ENABLED: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().default('MCPANEL System <noreply@mcpanel.local>'),

  // Rate Limiting
  RATE_LIMIT_ENABLED: z.preprocess((val) => val !== 'false' && val !== false, z.boolean().default(true)),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(30),
  RATE_LIMIT_API_WINDOW_MS: z.coerce.number().default(60 * 1000),
  RATE_LIMIT_API_MAX: z.coerce.number().default(300),

  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().default(90),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.format());
  // In development, fall back with default safe configuration rather than crashing
}

export const env = parsed.success ? parsed.data : envSchema.parse({});

export const parsedCorsOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
