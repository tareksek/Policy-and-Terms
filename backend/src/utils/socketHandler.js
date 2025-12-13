const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');

const initializeSocket = (io) => {
  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id;
      socket.username = user.username;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.username}`);

    // Join user's personal room
    socket.join(`user_${socket.userId}`);

    // Update user's online status
    socket.broadcast.emit('user-online', { userId: socket.userId });

    // Handle messaging
    socket.on('send-message', async (data) => {
      try {
        const { conversationId, content, messageType, attachments, replyTo } = data;

        // Create message
        const message = new Message({
          conversation: conversationId,
          sender: socket.userId,
          messageType: messageType || 'text',
          content,
          attachments: attachments || [],
          replyTo: replyTo || null
        });

        await message.save();

        // Update conversation last message
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt: new Date()
        });

        // Populate message with sender info
        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'username profile')
          .populate('replyTo');

        // Get conversation participants
        const conversation = await Conversation.findById(conversationId);
        
        // Send to all participants
        conversation.participants.forEach(participant => {
          if (!participant.equals(socket.userId)) {
            // Update unread count
            const unreadEntry = conversation.unreadCount.find(
              entry => entry.user.equals(participant)
            );
            
            if (unreadEntry) {
              unreadEntry.count += 1;
            } else {
              conversation.unreadCount.push({
                user: participant,
                count: 1
              });
            }

            // Create notification
            Notification.create({
              recipient: participant,
              sender: socket.userId,
              type: 'message',
              title: 'New Message',
              message: `New message from ${socket.username}`,
              data: { 
                conversationId, 
                messageId: message._id 
              }
            });
          }
        });

        await conversation.save();

        // Emit message to all participants
        conversation.participants.forEach(participant => {
          io.to(`user_${participant}`).emit('new-message', populatedMessage);
        });

        // Also emit to conversation room
        io.to(`conversation_${conversationId}`).emit('new-message', populatedMessage);

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', async (data) => {
      const { conversationId, isTyping } = data;
      
      socket.broadcast.to(`conversation_${conversationId}`).emit('user-typing', {
        userId: socket.userId,
        isTyping
      });
    });

    // Handle read receipts
    socket.on('mark-as-read', async (data) => {
      try {
        const { conversationId, messageIds } = data;

        const conversation = await Conversation.findById(conversationId);
        
        // Reset unread count for this user
        const unreadEntry = conversation.unreadCount.find(
          entry => entry.user.equals(socket.userId)
        );
        
        if (unreadEntry) {
          unreadEntry.count = 0;
          await conversation.save();
        }

        // Mark messages as read
        await Message.updateMany(
          { 
            _id: { $in: messageIds },
            'readBy.user': { $ne: socket.userId }
          },
          {
            $push: {
              readBy: {
                user: socket.userId,
                readAt: new Date()
              }
            }
          }
        );

        // Notify other participants
        conversation.participants.forEach(participant => {
          if (!participant.equals(socket.userId)) {
            io.to(`user_${participant}`).emit('messages-read', {
              conversationId,
              userId: socket.userId
            });
          }
        });

      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // Join conversation room
    socket.on('join-conversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
    });

    // Leave conversation room
    socket.on('leave-conversation', (conversationId) => {
      socket.leave(`conversation_${conversationId}`);
    });

    // Handle video call
    socket.on('call-user', (data) => {
      const { userId, offer } = data;
      io.to(`user_${userId}`).emit('incoming-call', {
        from: socket.userId,
        offer
      });
    });

    socket.on('call-accepted', (data) => {
      const { userId, answer } = data;
      io.to(`user_${userId}`).emit('call-accepted', {
        from: socket.userId,
        answer
      });
    });

    socket.on('call-rejected', (data) => {
      const { userId } = data;
      io.to(`user_${userId}`).emit('call-rejected', {
        from: socket.userId
      });
    });

    socket.on('ice-candidate', (data) => {
      const { userId, candidate } = data;
      io.to(`user_${userId}`).emit('ice-candidate', {
        from: socket.userId,
        candidate
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.username}`);
      
      // Update user's offline status
      socket.broadcast.emit('user-offline', { userId: socket.userId });
    });
  });
};

module.exports = { initializeSocket };