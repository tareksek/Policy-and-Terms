
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { cloudinary } = require('../utils/cloudinary');

class MessageController {
    // Get conversations
    async getConversations(req, res) {
        try {
            const userId = req.userId;
            const { page = 1, limit = 20 } = req.query;
            const skip = (page - 1) * limit;

            const conversations = await Conversation.find({
                participants: userId,
                isActive: true
            })
            .populate('participants', 'username profile')
            .populate('lastMessage')
            .populate('groupInfo.admin', 'username profile')
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

            // Add unread count for each conversation
            const conversationsWithUnread = conversations.map(conv => {
                const unreadEntry = conv.unreadCount.find(entry => 
                    entry.user.equals(userId)
                );
                return {
                    ...conv.toObject(),
                    unreadCount: unreadEntry ? unreadEntry.count : 0,
                    isPinned: conv.pinnedBy.includes(userId),
                    isArchived: conv.archivedBy.includes(userId)
                };
            });

            const total = await Conversation.countDocuments({
                participants: userId,
                isActive: true
            });

            res.json({
                success: true,
                data: {
                    conversations: conversationsWithUnread,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get conversations error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب المحادثات'
            });
        }
    }

    // Get conversation
    async getConversation(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const conversation = await Conversation.findById(id)
                .populate('participants', 'username profile')
                .populate('lastMessage')
                .populate('groupInfo.admin', 'username profile');

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: 'المحادثة غير موجودة'
                });
            }

            // Check if user is participant
            if (!conversation.participants.some(p => p._id.equals(userId))) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لعرض هذه المحادثة'
                });
            }

            // Reset unread count for this user
            const unreadIndex = conversation.unreadCount.findIndex(
                entry => entry.user.equals(userId)
            );
            
            if (unreadIndex !== -1) {
                conversation.unreadCount[unreadIndex].count = 0;
                await conversation.save();
            }

            res.json({
                success: true,
                data: conversation
            });

        } catch (error) {
            console.error('Get conversation error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب المحادثة'
            });
        }
    }

    // Get messages
    async getMessages(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { page = 1, limit = 50, before } = req.query;
            const skip = (page - 1) * limit;

            // Check if user is participant
            const conversation = await Conversation.findById(id);
            if (!conversation || !conversation.participants.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لعرض هذه الرسائل'
                });
            }

            let query = { 
                conversation: id,
                isDeleted: false,
                'deletedFor.user': { $ne: userId }
            };

            if (before) {
                query.createdAt = { $lt: new Date(before) };
            }

            const messages = await Message.find(query)
                .populate('sender', 'username profile')
                .populate('replyTo')
                .populate('attachments')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Message.countDocuments(query);

            // Mark messages as read
            const unreadMessages = messages.filter(msg => 
                !msg.readBy.some(read => read.user.equals(userId))
            );

            if (unreadMessages.length > 0) {
                const messageIds = unreadMessages.map(msg => msg._id);
                
                await Message.updateMany(
                    { _id: { $in: messageIds } },
                    {
                        $push: {
                            readBy: {
                                user: userId,
                                readAt: new Date()
                            }
                        }
                    }
                );
            }

            res.json({
                success: true,
                data: {
                    messages: messages.reverse(), // Reverse to get chronological order
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get messages error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب الرسائل'
            });
        }
    }

    // Create conversation
    async createConversation(req, res) {
        try {
            const userId = req.userId;
            const { participants, type, groupInfo } = req.body;

            // Validate participants
            const uniqueParticipants = [...new Set([userId, ...participants])];
            
            if (uniqueParticipants.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'يجب اختيار مستخدم واحد على الأقل'
                });
            }

            // Check for existing conversation
            let conversation;
            if (type === 'direct' && participants.length === 1) {
                conversation = await Conversation.findOne({
                    type: 'direct',
                    participants: { $all: uniqueParticipants, $size: uniqueParticipants.length }
                });
            }

            if (conversation) {
                return res.json({
                    success: true,
                    message: 'المحادثة موجودة بالفعل',
                    data: conversation
                });
            }

            // Create new conversation
            conversation = new Conversation({
                participants: uniqueParticipants,
                type: type || 'direct',
                groupInfo: type === 'group' ? groupInfo : null,
                unreadCount: uniqueParticipants.map(participant => ({
                    user: participant,
                    count: participant.equals(userId) ? 0 : 1
                }))
            });

            await conversation.save();

            // Populate conversation data
            const populatedConversation = await Conversation.findById(conversation._id)
                .populate('participants', 'username profile')
                .populate('groupInfo.admin', 'username profile');

            res.status(201).json({
                success: true,
                message: 'تم إنشاء المحادثة بنجاح',
                data: populatedConversation
            });

        } catch (error) {
            console.error('Create conversation error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إنشاء المحادثة'
            });
        }
    }

    // Send message
    async sendMessage(req, res) {
        try {
            const userId = req.userId;
            const { conversationId } = req.params;
            const { content, messageType, replyTo, attachments } = req.body;

            // Check if conversation exists and user is participant
            const conversation = await Conversation.findById(conversationId);
            if (!conversation || !conversation.participants.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لإرسال رسالة في هذه المحادثة'
                });
            }

            // Process file attachments
            let processedAttachments = [];
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const result = await cloudinary.uploader.upload(file.path, {
                        folder: `nexus/messages/${conversationId}`,
                        resource_type: 'auto'
                    });

                    processedAttachments.push({
                        type: file.mimetype.startsWith('image') ? 'image' : 
                              file.mimetype.startsWith('video') ? 'video' : 
                              file.mimetype.startsWith('audio') ? 'voice' : 'file',
                        url: result.secure_url,
                        filename: file.originalname,
                        size: file.size,
                        dimensions: result.width && result.height ? {
                            width: result.width,
                            height: result.height
                        } : undefined
                    });
                }
            }

            // Add uploaded attachments from request body
            if (attachments && Array.isArray(attachments)) {
                processedAttachments = [...processedAttachments, ...attachments];
            }

            const message = new Message({
                conversation: conversationId,
                sender: userId,
                messageType: messageType || (processedAttachments.length > 0 ? 'file' : 'text'),
                content,
                attachments: processedAttachments,
                replyTo: replyTo || null
            });

            await message.save();

            // Update conversation
            conversation.lastMessage = message._id;
            conversation.updatedAt = new Date();

            // Update unread counts for other participants
            conversation.unreadCount.forEach(entry => {
                if (!entry.user.equals(userId)) {
                    entry.count += 1;
                }
            });

            await conversation.save();

            // Create notifications for other participants
            const sender = await User.findById(userId);
            const otherParticipants = conversation.participants.filter(
                participant => !participant.equals(userId)
            );

            for (const participant of otherParticipants) {
                await Notification.create({
                    recipient: participant,
                    sender: userId,
                    type: 'message',
                    title: 'رسالة جديدة',
                    message: `${sender.profile.firstName} أرسل لك رسالة`,
                    data: { 
                        conversationId,
                        messageId: message._id 
                    }
                });
            }

            // Populate message data
            const populatedMessage = await Message.findById(message._id)
                .populate('sender', 'username profile')
                .populate('replyTo')
                .populate('attachments');

            res.status(201).json({
                success: true,
                message: 'تم إرسال الرسالة بنجاح',
                data: populatedMessage
            });

        } catch (error) {
            console.error('Send message error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إرسال الرسالة'
            });
        }
    }

    // Delete message
    async deleteMessage(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { deleteForEveryone } = req.body;

            const message = await Message.findById(id);

            if (!message) {
                return res.status(404).json({
                    success: false,
                    error: 'الرسالة غير موجودة'
                });
            }

            // Check if user is sender
            if (!message.sender.equals(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لحذف هذه الرسالة'
                });
            }

            if (deleteForEveryone) {
                // Delete for everyone
                message.isDeleted = true;
                await message.save();
            } else {
                // Delete for user only
                if (!message.deletedFor.includes(userId)) {
                    message.deletedFor.push(userId);
                    await message.save();
                }
            }

            res.json({
                success: true,
                message: deleteForEveryone ? 
                    'تم حذف الرسالة للجميع' : 
                    'تم حذف الرسالة لك فقط'
            });

        } catch (error) {
            console.error('Delete message error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء حذف الرسالة'
            });
        }
    }

    // Edit message
    async editMessage(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { content } = req.body;

            const message = await Message.findById(id);

            if (!message) {
                return res.status(404).json({
                    success: false,
                    error: 'الرسالة غير موجودة'
                });
            }

            // Check if user is sender
            if (!message.sender.equals(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لتعديل هذه الرسالة'
                });
            }

            // Check if message can be edited (within 15 minutes)
            const timeDiff = Date.now() - message.createdAt.getTime();
            if (timeDiff > 15 * 60 * 1000) {
                return res.status(400).json({
                    success: false,
                    error: 'لا يمكن تعديل الرسالة بعد مرور 15 دقيقة'
                });
            }

            // Save edit history
            message.editHistory.push({
                content: message.content,
                editedAt: new Date()
            });

            message.content = content;
            message.edited = true;

            await message.save();

            const populatedMessage = await Message.findById(message._id)
                .populate('sender', 'username profile');

            res.json({
                success: true,
                message: 'تم تعديل الرسالة بنجاح',
                data: populatedMessage
            });

        } catch (error) {
            console.error('Edit message error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تعديل الرسالة'
            });
        }
    }

    // React to message
    async reactToMessage(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { emoji } = req.body;

            const message = await Message.findById(id);

            if (!message) {
                return res.status(404).json({
                    success: false,
                    error: 'الرسالة غير موجودة'
                });
            }

            // Check if user is in conversation
            const conversation = await Conversation.findById(message.conversation);
            if (!conversation || !conversation.participants.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية للتفاعل مع هذه الرسالة'
                });
            }

            const reactionIndex = message.reactions.findIndex(
                reaction => reaction.user.equals(userId)
            );

            if (reactionIndex > -1) {
                // Remove reaction if same emoji, otherwise update
                if (message.reactions[reactionIndex].emoji === emoji) {
                    message.reactions.splice(reactionIndex, 1);
                } else {
                    message.reactions[reactionIndex].emoji = emoji;
                }
            } else {
                // Add reaction
                message.reactions.push({
                    user: userId,
                    emoji,
                    reactedAt: new Date()
                });

                // Create notification for message sender
                if (!message.sender.equals(userId)) {
                    const user = await User.findById(userId);
                    
                    await Notification.create({
                        recipient: message.sender,
                        sender: userId,
                        type: 'message_reaction',
                        title: 'تفاعل جديد',
                        message: `${user.profile.firstName} تفاعل مع رسالتك`,
                        data: { 
                            messageId: message._id,
                            emoji,
                            conversationId: message.conversation
                        }
                    });
                }
            }

            await message.save();

            // Get updated reactions
            const updatedMessage = await Message.findById(message._id)
                .populate('reactions.user', 'username profile');

            res.json({
                success: true,
                message: reactionIndex > -1 ? 
                    (message.reactions[reactionIndex] ? 'تم تغيير التفاعل' : 'تم إلغاء التفاعل') : 
                    'تم التفاعل مع الرسالة',
                data: {
                    reactions: updatedMessage.reactions,
                    userReaction: message.reactions.find(r => r.user.equals(userId))
                }
            });

        } catch (error) {
            console.error('React to message error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء التفاعل مع الرسالة'
            });
        }
    }

    // Mark messages as read
    async markMessagesAsRead(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { messageIds } = req.body;

            // Check if conversation exists and user is participant
            const conversation = await Conversation.findById(id);
            if (!conversation || !conversation.participants.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لهذه العملية'
                });
            }

            // Mark messages as read
            await Message.updateMany(
                { 
                    _id: { $in: messageIds },
                    'readBy.user': { $ne: userId }
                },
                {
                    $push: {
                        readBy: {
                            user: userId,
                            readAt: new Date()
                        }
                    }
                }
            );

            // Reset unread count for this conversation
            const unreadIndex = conversation.unreadCount.findIndex(
                entry => entry.user.equals(userId)
            );
            
            if (unreadIndex !== -1) {
                conversation.unreadCount[unreadIndex].count = 0;
                await conversation.save();
            }

            res.json({
                success: true,
                message: 'تم تحديد الرسائل كمقروءة'
            });

        } catch (error) {
            console.error('Mark messages as read error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تحديد الرسائل كمقروءة'
            });
        }
    }

    // Delete conversation
    async deleteConversation(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const conversation = await Conversation.findById(id);

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: 'المحادثة غير موجودة'
                });
            }

            // Check if user is participant
            if (!conversation.participants.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لحذف هذه المحادثة'
                });
            }

            // If group admin is deleting, delete for everyone
            if (conversation.type === 'group' && 
                conversation.groupInfo.admin.equals(userId)) {
                conversation.isActive = false;
                await conversation.save();
            } else {
                // Archive conversation for user
                if (!conversation.archivedBy.includes(userId)) {
                    conversation.archivedBy.push(userId);
                    await conversation.save();
                }
            }

            res.json({
                success: true,
                message: conversation.type === 'group' && 
                        conversation.groupInfo.admin.equals(userId) ?
                        'تم حذف المحادثة للجميع' :
                        'تم أرشفة المحادثة'
            });

        } catch (error) {
            console.error('Delete conversation error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء حذف المحادثة'
            });
        }
    }

    // Pin/unpin conversation
    async pinConversation(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const conversation = await Conversation.findById(id);

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: 'المحادثة غير موجودة'
                });
            }

            // Check if user is participant
            if (!conversation.participants.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لتثبيت هذه المحادثة'
                });
            }

            const isPinned = conversation.pinnedBy.includes(userId);
            let message;

            if (isPinned) {
                conversation.pinnedBy = conversation.pinnedBy.filter(
                    user => !user.equals(userId)
                );
                message = 'تم إلغاء تثبيت المحادثة';
            } else {
                conversation.pinnedBy.push(userId);
                message = 'تم تثبيت المحادثة';
            }

            await conversation.save();

            res.json({
                success: true,
                message,
                data: { pinned: !isPinned }
            });

        } catch (error) {
            console.error('Pin conversation error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تثبيت المحادثة'
            });
        }
    }

    // Mute/unmute conversation
    async muteConversation(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { muteUntil } = req.body;

            const conversation = await Conversation.findById(id);

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: 'المحادثة غير موجودة'
                });
            }

            // Check if user is participant
            if (!conversation.participants.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لكتم هذه المحادثة'
                });
            }

            const muteEntry = conversation.settings.customNotifications.find(
                entry => entry.user.equals(userId)
            );

            if (muteUntil) {
                if (muteEntry) {
                    muteEntry.muteUntil = new Date(muteUntil);
                } else {
                    conversation.settings.customNotifications.push({
                        user: userId,
                        muteUntil: new Date(muteUntil)
                    });
                }
                message = `تم كتم المحادثة حتى ${new Date(muteUntil).toLocaleDateString('ar-SA')}`;
            } else {
                if (muteEntry) {
                    conversation.settings.customNotifications = 
                        conversation.settings.customNotifications.filter(
                            entry => !entry.user.equals(userId)
                        );
                }
                message = 'تم إلغاء كتم المحادثة';
            }

            await conversation.save();

            res.json({
                success: true,
                message
            });

        } catch (error) {
            console.error('Mute conversation error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء كتم المحادثة'
            });
        }
    }

    // Get unread message count
    async getUnreadCount(req, res) {
        try {
            const userId = req.userId;

            const conversations = await Conversation.find({
                participants: userId,
                isActive: true
            });

            const totalUnread = conversations.reduce((total, conv) => {
                const unreadEntry = conv.unreadCount.find(entry => 
                    entry.user.equals(userId)
                );
                return total + (unreadEntry ? unreadEntry.count : 0);
            }, 0);

            res.json({
                success: true,
                data: { count: totalUnread }
            });

        } catch (error) {
            console.error('Get unread count error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جبل عدد الرسائل غير المقروءة'
            });
        }
    }

    // Search messages
    async searchMessages(req, res) {
        try {
            const userId = req.userId;
            const { q, conversationId } = req.query;

            if (!q || q.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'يجب أن يكون نص البحث على الأقل حرفين'
                });
            }

            const searchRegex = new RegExp(q, 'i');

            let query = {
                content: searchRegex,
                isDeleted: false,
                'deletedFor.user': { $ne: userId }
            };

            if (conversationId) {
                // Check if user is in conversation
                const conversation = await Conversation.findById(conversationId);
                if (!conversation || !conversation.participants.includes(userId)) {
                    return res.status(403).json({
                        success: false,
                        error: 'ليس لديك صلاحية للبحث في هذه المحادثة'
                    });
                }
                query.conversation = conversationId;
            } else {
                // Search in all user's conversations
                const conversations = await Conversation.find({
                    participants: userId,
                    isActive: true
                });
                query.conversation = { $in: conversations.map(c => c._id) };
            }

            const messages = await Message.find(query)
                .populate('sender', 'username profile')
                .populate('conversation')
                .sort({ createdAt: -1 })
                .limit(50);

            res.json({
                success: true,
                data: messages
            });

        } catch (error) {
            console.error('Search messages error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء البحث في الرسائل'
            });
        }
    }
}

module.exports = new MessageController();
