import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

const MEDIA_DIR = '/app/data/media';

/**
 * Ensure media directory exists
 */
export const ensureMediaDir = (): void => {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
};

/**
 * Save media file from buffer
 */
export const saveMedia = (buffer: Buffer, originalName: string): string => {
  ensureMediaDir();
  
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(originalName) || '.bin';
  const fileName = `${timestamp}-${random}${ext}`;
  const filePath = path.join(MEDIA_DIR, fileName);
  
  fs.writeFileSync(filePath, buffer);
  
  return fileName;
};

/**
 * Get media file path
 */
export const getMediaPath = (fileName: string): string => {
  return path.join(MEDIA_DIR, fileName);
};

/**
 * Delete media file
 */
export const deleteMedia = (fileName: string): boolean => {
  try {
    const filePath = getMediaPath(fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Failed to delete media:', error);
    return false;
  }
};

/**
 * Get file size in bytes
 */
export const getFileSize = (fileName: string): number => {
  const filePath = getMediaPath(fileName);
  if (fs.existsSync(filePath)) {
    return fs.statSync(filePath).size;
  }
  return 0;
};

/**
 * Get MIME type from file extension
 */
export const getMimeType = (fileName: string): string => {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

/**
 * Download media from URL and save locally
 */
export const downloadMediaFromUrl = async (url: string): Promise<{ fileName: string; mimeType: string; size: number }> => {
  ensureMediaDir();
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to download media');
  }
  
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const buffer = Buffer.from(await response.arrayBuffer());
  
  // Determine extension from content type
  const extMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'video/mp4': '.mp4',
    'video/x-msvideo': '.avi',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'text/plain': '.txt',
  };
  
  const ext = extMap[contentType.split(';')[0]] || '.bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const fileName = `${timestamp}-${random}${ext}`;
  const filePath = path.join(MEDIA_DIR, fileName);
  
  fs.writeFileSync(filePath, buffer);
  
  return {
    fileName,
    mimeType: contentType,
    size: buffer.length,
  };
};
