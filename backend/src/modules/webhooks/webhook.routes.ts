import { Router } from 'express';
import { prisma } from '../../database/prisma';
import * as wahaService from '../../services/waha.service';
import * as mediaService from '../../services/media.service';
import { sendMessageToAI, getAIStatus } from '../../services/ai.service';
import { enqueueChat } from '../queue/queue.service';
import { emitToAll, emitToAttendant } from '../../socket';

const router = Router();

/**
 * POST /waha - WAHA webhook handler
 */
router.post('/waha', async (req, res) => {
  try {
    const payload = req.body;
    
    // Validate payload structure
    if (!payload.phoneId || !payload.payload) {
      res.status(400).json({ error: 'Payload inválido' });
      return;
    }

    const phone = payload.phoneId;
    const messagePayload = payload.payload;

    // Only process incoming messages
    if (messagePayload.type !== 'message' || messagePayload.message?.conversation === undefined) {
      res.json({ received: true });
      return;
    }

    // Check if contact is blocked
    const blocked = await prisma.blockedContact.findUnique({
      where: { phone: phone.replace(/\D/g, '') },
    });

    if (blocked) {
      console.log(`🚫 Blocked contact ${phone} tried to send message`);
      res.json({ received: true });
      return;
    }

    // Upsert contact
    const contact = await prisma.contact.upsert({
      where: { phone },
      update: {},
      create: { phone, name: messagePayload.pushName || null },
    });

    // Find or create chat
    let chat = await prisma.chat.findFirst({
      where: {
        contactId: contact.id,
        status: { in: ['WAITING', 'IN_SERVICE'] },
      },
      include: { attendant: true },
    });

    if (!chat) {
      // Create new chat
      chat = await prisma.chat.create({
        data: {
          waChatId: phone,
          contactId: contact.id,
          status: 'WAITING',
        },
        include: { attendant: true },
      });

      // Add to queue
      await enqueueChat(chat.id);
    }

    // Save message
    const content = messagePayload.message.conversation || 
                   messagePayload.message.extendedTextMessage?.text || '';
    
    const message = await prisma.message.create({
      data: {
        chatId: chat.id,
        direction: 'IN',
        type: 'text',
        content,
        waMessageId: messagePayload.key?.id || null,
      },
    });

    // Handle AUTO mode response
    if (chat.attendant && chat.attendant.mode === 'AUTO' && chat.status === 'IN_SERVICE') {
      const aiOnline = await getAIStatus();
      
      if (aiOnline) {
        try {
          const response = await sendMessageToAI(content);
          
          // Send response via WAHA
          await wahaService.sendTextMessage(phone, response);
          
          // Save outgoing message
          await prisma.message.create({
            data: {
              chatId: chat.id,
              direction: 'OUT',
              type: 'text',
              content: response,
            },
          });
        } catch (error) {
          console.error('Auto AI response failed:', error);
          // Send fallback message
          const fallback = 'Desculpe, transferindo para atendente humano.';
          await wahaService.sendTextMessage(phone, fallback);
          
          await prisma.message.create({
            data: {
              chatId: chat.id,
              direction: 'OUT',
              type: 'text',
              content: fallback,
            },
          });
        }
      }
    }

    // Emit events
    if (chat.attendantId) {
      emitToAttendant(chat.attendantId, 'new:message', {
        chatId: chat.id,
        message,
      });
      
      emitToAttendant(chat.attendantId, 'notify:new-message', {
        chatId: chat.id,
        contactName: contact.name || phone,
      });
    } else {
      emitToAll('queue:updated', {
        action: 'new',
        chatId: chat.id,
        contactName: contact.name || phone,
        phone,
      });
      
      emitToAll('notify:queue', {
        message: 'Novo chat na fila',
      });
    }

    res.json({ received: true, chatId: chat.id });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
});

export default router;
