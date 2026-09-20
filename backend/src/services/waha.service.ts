import axios from 'axios';
import FormData from 'form-data';
import { env } from '../config/env';

/**
 * Send text message via WAHA
 */
export const sendTextMessage = async (phone: string, message: string): Promise<void> => {
  try {
    await axios.post(
      `${env.WAHA_URL}/api/${env.WAHA_SESSION_NAME}/send/text`,
      {
        chatId: phone,
        text: message,
      },
      {
        headers: {
          'X-Api-Key': env.WAHA_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    console.log(`📤 Text message sent to ${phone}`);
  } catch (error) {
    console.error('❌ Failed to send text message:', error);
    throw new Error('Falha ao enviar mensagem');
  }
};

/**
 * Send image via WAHA
 */
export const sendImageMessage = async (phone: string, mediaUrl: string, caption?: string): Promise<void> => {
  try {
    await axios.post(
      `${env.WAHA_URL}/api/${env.WAHA_SESSION_NAME}/send/image`,
      {
        chatId: phone,
        file: mediaUrl, // Can be URL or base64
        caption: caption || '',
      },
      {
        headers: {
          'X-Api-Key': env.WAHA_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    console.log(`📤 Image sent to ${phone}`);
  } catch (error) {
    console.error('❌ Failed to send image:', error);
    throw new Error('Falha ao enviar imagem');
  }
};

/**
 * Send audio via WAHA
 */
export const sendAudioMessage = async (phone: string, mediaUrl: string): Promise<void> => {
  try {
    await axios.post(
      `${env.WAHA_URL}/api/${env.WAHA_SESSION_NAME}/send/audio`,
      {
        chatId: phone,
        file: mediaUrl,
      },
      {
        headers: {
          'X-Api-Key': env.WAHA_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    console.log(`📤 Audio sent to ${phone}`);
  } catch (error) {
    console.error('❌ Failed to send audio:', error);
    throw new Error('Falha ao enviar áudio');
  }
};

/**
 * Send video via WAHA
 */
export const sendVideoMessage = async (phone: string, mediaUrl: string, caption?: string): Promise<void> => {
  try {
    await axios.post(
      `${env.WAHA_URL}/api/${env.WAHA_SESSION_NAME}/send/video`,
      {
        chatId: phone,
        file: mediaUrl,
        caption: caption || '',
      },
      {
        headers: {
          'X-Api-Key': env.WAHA_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    console.log(`📤 Video sent to ${phone}`);
  } catch (error) {
    console.error('❌ Failed to send video:', error);
    throw new Error('Falha ao enviar vídeo');
  }
};

/**
 * Send document via WAHA
 */
export const sendDocumentMessage = async (phone: string, mediaUrl: string, filename: string, caption?: string): Promise<void> => {
  try {
    await axios.post(
      `${env.WAHA_URL}/api/${env.WAHA_SESSION_NAME}/send/file`,
      {
        chatId: phone,
        file: mediaUrl,
        filename,
        caption: caption || '',
      },
      {
        headers: {
          'X-Api-Key': env.WAHA_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    console.log(`📤 Document sent to ${phone}`);
  } catch (error) {
    console.error('❌ Failed to send document:', error);
    throw new Error('Falha ao enviar documento');
  }
};

/**
 * Send message with media based on type
 */
export const sendMediaByType = async (
  phone: string,
  mediaUrl: string,
  type: string,
  filename?: string,
  caption?: string
): Promise<void> => {
  switch (type) {
    case 'image':
      return sendImageMessage(phone, mediaUrl, caption);
    case 'audio':
      return sendAudioMessage(phone, mediaUrl);
    case 'video':
      return sendVideoMessage(phone, mediaUrl, caption);
    case 'document':
      return sendDocumentMessage(phone, mediaUrl, filename || 'arquivo', caption);
    default:
      throw new Error('Tipo de mídia não suportado');
  }
};
