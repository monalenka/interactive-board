import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Room, WhiteboardData } from './types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// поменять на Redis!!
const rooms = new Map<string, Room>();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId: string) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                users: new Set(),
                whiteboardData: null
            });
        }

        const room = rooms.get(roomId);
        if (room) {
            room.users.add(socket.id);

            if (room.whiteboardData) {
                socket.emit('whiteboard-state', room.whiteboardData);
            }
        }

        socket.to(roomId).emit('user-joined', socket.id);
    });

    socket.on('leave-room', (roomId: string) => {
        socket.leave(roomId);
        console.log(`User ${socket.id} left room ${roomId}`);

        const room = rooms.get(roomId);
        if (room) {
            room.users.delete(socket.id);
            socket.to(roomId).emit('user-left', socket.id);

            if (room.users.size === 0) {
                rooms.delete(roomId);
            }
        }
    });

    socket.on('whiteboard-change', (data: WhiteboardData) => {
        const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            if (room) {
                room.whiteboardData = data;

                socket.to(roomId).emit('whiteboard-change', data);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        rooms.forEach((room, roomId) => {
            if (room.users.has(socket.id)) {
                room.users.delete(socket.id);
                socket.to(roomId).emit('user-left', socket.id);

                if (room.users.size === 0) {
                    rooms.delete(roomId);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});