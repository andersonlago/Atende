import { Queue, Worker } from 'bullmq';
import { env } from '../config/env';
import { prisma } from '../database/prisma';
import { emitToAll, emitToAttendant } from './index';

// Redis connection config
const connection = {
  host: new URL(env.REDIS_URL).hostname,
  port: parseInt(new URL(env.REDIS_URL).port, 10),
  password: env.REDIS_PASSWORD || undefined,
};

// Queue for incoming chats
export const chatQueue = new Queue('chat-queue', { connection });

// Worker to process queue events
export const chatWorker = new Worker(
  'chat-queue',
  async (job) => {
    const { chatId } = job.data;
    
    // Get chat details
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        contact: true,
        attendant: true,
      },
    });

    if (!chat) return;

    // Emit event to all attendants about new chat in queue
    emitToAll('queue:updated', {
      chatId: chat.id,
      contactName: chat.contact.name || chat.contact.phone,
      phone: chat.contact.phone,
      createdAt: chat.createdAt,
    });

    console.log(`📥 Chat ${chat.id} added to queue`);
  },
  { connection }
);

// Function to add chat to queue
export const addToQueue = async (chatId: string): Promise<void> => {
  await chatQueue.add('new-chat', { chatId }, {
    removeOnComplete: true,
    removeOnFail: false,
  });
};

// Function to get queue count
export const getQueueCount = async (): Promise<number> => {
  return await chatQueue.getWaitingCount();
};

// Function to get all waiting chats
export const getWaitingChats = async () => {
  const jobs = await chatQueue.getJobs(['waiting']);
  return jobs.map(job => job.data);
};
