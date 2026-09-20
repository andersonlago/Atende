import { config } from 'dotenv';
config();

// Environment variables with defaults
export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://atend:supersecret@localhost:5432/atendimento',
  
  // Redis
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || 'redissecret',
  REDIS_URL: process.env.REDIS_URL || 'redis://:redissecret@localhost:6379',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-32-chars-minimum-length',
  JWT_EXPIRES_IN: '12h',
  
  // App
  PORT: parseInt(process.env.PORT || '4000', 10),
  APP_URL: process.env.APP_URL || 'http://localhost',
  
  // WAHA
  WAHA_URL: process.env.WAHA_URL || 'http://localhost:3000',
  WAHA_API_KEY: process.env.WAHA_API_KEY || 'waha-api-key',
  WAHA_SESSION_NAME: process.env.WAHA_SESSION_NAME || 'main',
  
  // AnythingLLM
  ALLM_URL: process.env.ALLM_URL || 'http://localhost:3002/api/v1',
  ALLM_WORKSPACE_SLUG: process.env.ALLM_WORKSPACE_SLUG || 'atendimento',
  ALLM_API_KEY: process.env.ALLM_API_KEY || 'allm-api-key',
  
  // SMTP
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '"Atendimento <noreply@empresa.com>"',
};
