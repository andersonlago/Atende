import axios from 'axios';
import { env } from '../config/env';

// Cache for AI status
let aiOnline = true;
let lastCheck = 0;

/**
 * Check if AnythingLLM is online
 */
export const checkAIStatus = async (): Promise<boolean> => {
  try {
    // Try to get workspace info as health check
    await axios.get(`${env.ALLM_URL}/workspace/${env.ALLM_WORKSPACE_SLUG}`, {
      headers: {
        'Authorization': `Bearer ${env.ALLM_API_KEY}`,
      },
      timeout: 5000,
    });
    aiOnline = true;
    lastCheck = Date.now();
    return true;
  } catch (error) {
    console.error('❌ AI service offline:', error);
    aiOnline = false;
    lastCheck = Date.now();
    return false;
  }
};

/**
 * Get cached AI status (checks every 30 seconds)
 */
export const getAIStatus = async (): Promise<boolean> => {
  const now = Date.now();
  if (now - lastCheck > 30000) {
    await checkAIStatus();
  }
  return aiOnline;
};

/**
 * Send message to AnythingLLM workspace and get response with RAG
 */
export const sendMessageToAI = async (message: string, chatHistory?: Array<{ role: string; content: string }>): Promise<string> => {
  try {
    const response = await axios.post(
      `${env.ALLM_URL}/workspace/${env.ALLM_WORKSPACE_SLUG}/chat`,
      {
        message,
        mode: 'query', // Use RAG mode
        sessionId: `chat-${Date.now()}`, // Session per conversation
      },
      {
        headers: {
          'Authorization': `Bearer ${env.ALLM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    // Extract response from AnythingLLM format
    const aiResponse = response.data?.response || response.data?.text || 'Desculpe, não consegui processar sua mensagem.';
    
    return aiResponse;
  } catch (error) {
    console.error('❌ AI request failed:', error);
    throw new Error('Falha na comunicação com IA');
  }
};

/**
 * Get list of documents in AnythingLLM workspace
 */
export const getWorkspaceDocuments = async (): Promise<Array<{ name: string; type: string; uploadedAt: string }>> => {
  try {
    const response = await axios.get(
      `${env.ALLM_URL}/workspace/${env.ALLM_WORKSPACE_SLUG}/documents`,
      {
        headers: {
          'Authorization': `Bearer ${env.ALLM_API_KEY}`,
        },
        timeout: 10000,
      }
    );

    return response.data?.documents || [];
  } catch (error) {
    console.error('❌ Failed to get documents:', error);
    return [];
  }
};

/**
 * Upload document to AnythingLLM
 */
export const uploadDocument = async (filePath: string, fileName: string): Promise<boolean> => {
  try {
    const formData = new FormData();
    formData.append('file', filePath as unknown as Blob, fileName);

    await axios.post(
      `${env.ALLM_URL}/system/vectors/upload`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${env.ALLM_API_KEY}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000,
      }
    );

    // Update embeddings after upload
    await axios.post(
      `${env.ALLM_URL}/workspace/${env.ALLM_WORKSPACE_SLUG}/update-embeddings`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${env.ALLM_API_KEY}`,
        },
        timeout: 60000,
      }
    );

    return true;
  } catch (error) {
    console.error('❌ Failed to upload document:', error);
    return false;
  }
};

/**
 * Delete document from AnythingLLM
 */
export const deleteDocument = async (fileName: string): Promise<boolean> => {
  try {
    await axios.delete(
      `${env.ALLM_URL}/workspace/${env.ALLM_WORKSPACE_SLUG}/documents/${encodeURIComponent(fileName)}`,
      {
        headers: {
          'Authorization': `Bearer ${env.ALLM_API_KEY}`,
        },
        timeout: 10000,
      }
    );

    // Update embeddings after deletion
    await axios.post(
      `${env.ALLM_URL}/workspace/${env.ALLM_WORKSPACE_SLUG}/update-embeddings`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${env.ALLM_API_KEY}`,
        },
        timeout: 60000,
      }
    );

    return true;
  } catch (error) {
    console.error('❌ Failed to delete document:', error);
    return false;
  }
};
