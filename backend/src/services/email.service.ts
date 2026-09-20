import nodemailer from 'nodemailer';
import { env } from '../config/env';

// Create transporter
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send email using SMTP
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    console.log(`✅ Email sent to ${options.to}`);
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw new Error('Falha ao enviar email');
  }
};

/**
 * Generate password reset email template
 */
export const getPasswordResetTemplate = (token: string, appUrl: string): string => {
  const resetLink = `${appUrl}/reset-password?token=${token}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #059669; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Recuperação de Senha</h2>
        <p>Você solicitou a recuperação de senha. Clique no botão abaixo para redefinir:</p>
        <a href="${resetLink}" class="button">Redefinir Senha</a>
        <p>Ou copie e cole este link no seu navegador:</p>
        <p style="word-break: break-all; color: #059669;">${resetLink}</p>
        <p>Este link expira em 1 hora.</p>
        <p>Se você não solicitou esta alteração, ignore este email.</p>
        <div class="footer">
          <p>Sistema de Atendimento WhatsApp</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate invitation email template
 */
export const getInvitationTemplate = (name: string, token: string, appUrl: string): string => {
  const inviteLink = `${appUrl}/complete-cadastro?token=${token}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #059669; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Convite para Sistema de Atendimento</h2>
        <p>Olá ${name}!</p>
        <p>Você foi convidado(a) para fazer parte do nosso sistema de atendimento WhatsApp.</p>
        <p>Clique no botão abaixo para completar seu cadastro:</p>
        <a href="${inviteLink}" class="button">Completar Cadastro</a>
        <p>Ou copie e cole este link no seu navegador:</p>
        <p style="word-break: break-all; color: #059669;">${inviteLink}</p>
        <p>Este link expira em 7 dias.</p>
        <div class="footer">
          <p>Sistema de Atendimento WhatsApp</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate welcome email template
 */
export const getWelcomeTemplate = (name: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Bem-vindo(a)!</h2>
        <p>Olá ${name}!</p>
        <p>Seu cadastro foi realizado com sucesso no Sistema de Atendimento WhatsApp.</p>
        <p>Agora você já pode acessar o sistema e começar a atender clientes.</p>
        <div class="footer">
          <p>Sistema de Atendimento WhatsApp</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
