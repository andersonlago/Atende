import { prisma } from '../../database/prisma';
import { chatQueue, addToQueue, getQueueCount, getWaitingChats } from '../../socket/singleton';
import { emitToAll, emitToAttendant } from '../../socket';

/**
 * Get all waiting chats from queue
 */
export const getQueueChats = async () => {
  const jobs = await chatQueue.getJobs(['waiting']);
  
  const chats = await prisma.chat.findMany({
    where: {
      id: { in: jobs.map(job => job.data.chatId) },
    },
    include: {
      contact: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return chats.map(chat => ({
    ...chat,
    lastMessage: chat.messages[0] || null,
    waitingTime: Date.now() - chat.createdAt.getTime(),
  }));
};

/**
 * Assign chat to attendant
 */
export const assignChat = async (chatId: string, attendantId: string) => {
  // Get attendant
  const attendant = await prisma.attendant.findUnique({
    where: { id: attendantId },
  });

  if (!attendant) {
    throw new Error('Atendente não encontrado');
  }

  if (attendant.status !== 'ONLINE') {
    throw new Error('Atendente offline');
  }

  if (attendant.activeChats >= attendant.maxChats) {
    throw new Error('Atendente com capacidade máxima atingida');
  }

  // Get chat
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { contact: true },
  });

  if (!chat) {
    throw new Error('Chat não encontrado');
  }

  if (chat.status !== 'WAITING') {
    throw new Error('Chat não está na fila de espera');
  }

  // Update chat
  const updatedChat = await prisma.chat.update({
    where: { id: chatId },
    data: {
      attendantId,
      status: 'IN_SERVICE',
      startedAt: new Date(),
    },
    include: {
      contact: true,
      attendant: true,
    },
  });

  // Update attendant active chats
  await prisma.attendant.update({
    where: { id: attendantId },
    data: { activeChats: attendant.activeChats + 1 },
  });

  // Remove from queue
  const jobs = await chatQueue.getJobs(['waiting']);
  const jobToRemove = jobs.find(job => job.data.chatId === chatId);
  if (jobToRemove) {
    await jobToRemove.remove();
  }

  // Emit events
  emitToAll('queue:updated', { action: 'removed', chatId });
  emitToAttendant(attendantId, 'chat:assigned', {
    chatId: updatedChat.id,
    contactName: updatedChat.contact.name || updatedChat.contact.phone,
  });

  return updatedChat;
};

/**
 * Add new chat to queue
 */
export const enqueueChat = async (chatId: string): Promise<void> => {
  await addToQueue(chatId);
};

/**
 * Get queue count
 */
export const getQueueMetrics = async (): Promise<number> => {
  return await getQueueCount();
};
