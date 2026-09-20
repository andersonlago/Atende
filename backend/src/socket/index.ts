import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

// Singleton pattern for Socket.IO
let io: SocketIOServer | null = null;

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initIO first.');
  }
  return io;
};

export const initIO = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Join room based on attendant ID
    socket.on('join-attendant', (attendantId: string) => {
      socket.join(`attendant:${attendantId}`);
      console.log(`Client ${socket.id} joined attendant:${attendantId}`);
    });

    // Join admin room
    socket.on('join-admin', () => {
      socket.join('admin');
      console.log(`Client ${socket.id} joined admin room`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  return io;
};

// Emit events helper functions
export const emitToAttendant = (attendantId: string, event: string, data: unknown): void => {
  if (io) {
    io.to(`attendant:${attendantId}`).emit(event, data);
  }
};

export const emitToAdmin = (event: string, data: unknown): void => {
  if (io) {
    io.to('admin').emit(event, data);
  }
};

export const emitToAll = (event: string, data: unknown): void => {
  if (io) {
    io.emit(event, data);
  }
};
