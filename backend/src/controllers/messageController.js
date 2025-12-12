const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// إرسال رسالة
exports.sendMessage = async (req, res) => {
    try {
        const { receiverId, content, type = 'text' } = req.body;
        const senderId = req.user.id;
        
        // التحقق من عدم إرسال رسالة للنفس
        if (senderId === receiverId) {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن إرسال رسالة لنفسك'
            });
        }
        
        // البحث عن محادثة موجودة أو إنشاء جديدة
        let conversation = await Conversation.findOne({
            participants: { $all: [senderId, receiverId] }
        });
        
        if (!conversation) {
            conversation = await Conversation.create({
                participants: [senderId, receiverId],
                lastMessage: content
            });
        }
        
        // إنشاء الرسالة
        const message = await Message.create({
            conversation: conversation._id,
            sender: senderId,
            receiver: receiverId,
            content,
            type
        });
        
        // تحديث المحادثة
        conversation.lastMessage = content;
        conversation.lastMessageAt = Date.now();
        await conversation.save();
        
        await message.populate('sender', 'username name avatar');
        await message.populate('receiver', 'username name avatar');
        
        res.status(201).json({
            success: true,
            message: 'تم إرسال الرسالة',
            data: message
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// عرض محادثة
exports.getConversation = async (req, res) => {
    try {
        const otherUserId = req.params.userId;
        const currentUserId = req.user.id;
        const { page = 1, limit = 50 } = req.query;
        
        // البحث عن المحادثة
        const conversation = await Conversation.findOne({
            participants: { $all: [currentUserId, otherUserId] }
        });
        
        if (!conversation) {
            return res.json({
                success: true,
                data: {
                    messages: [],
                    conversation: null
                }
            });
        }
        
        // الحصول على الرسائل
        const messages = await Message.find({
            conversation: conversation._id
        })
        .populate('sender', 'username name avatar')
        .populate('receiver', 'username name avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
        
        // تحديد الرسائل كمقروءة
        await Message.updateMany(
            {
                conversation: conversation._id,
                receiver: currentUserId,
                read: false
            },
            { $set: { read: true, readAt: Date.now() } }
        );
        
        res.json({
            success: true,
            data: {
                messages: messages.reverse(), // الأقدم أولاً
                conversation
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// عرض قائمة المحادثات
exports.getConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        
        const conversations = await Conversation.find({
            participants: userId
        })
        .populate('participants', 'username name avatar')
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
        
        // الحصول على عدد الرسائل غير المقروءة لكل محادثة
        const conversationsWithUnread = await Promise.all(
            conversations.map(async (conversation) => {
                const unreadCount = await Message.countDocuments({
                    conversation: conversation._id,
                    receiver: userId,
                    read: false
                });
                
                // الحصول على آخر رسالة
                const lastMessage = await Message.findOne({
                    conversation: conversation._id
                })
                .sort({ createdAt: -1 })
                .populate('sender', 'username name avatar');
                
                return {
                    ...conversation.toObject(),
                    unreadCount,
                    lastMessage
                };
            })
        );
        
        const total = await Conversation.countDocuments({
            participants: userId
        });
        
        res.json({
            success: true,
            data: {
                conversations: conversationsWithUnread,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// حذف رسالة
exports.deleteMessage = async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.user.id;
        
        const message = await Message.findById(messageId);
        
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'الرسالة غير موجودة'
            });
        }
        
        // التحقق من ملكية الرسالة
        if (message.sender.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'ليس لديك صلاحية لحذف هذه الرسالة'
            });
        }
        
        await Message.findByIdAndUpdate(messageId, {
            $set: { deleted: true, content: 'تم حذف هذه الرسالة' }
        });
        
        res.json({
            success: true,
            message: 'تم حذف الرسالة'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// تحديد الرسائل كمقروءة
exports.markAsRead = async (req, res) => {
    try {
        const conversationId = req.params.conversationId;
        const userId = req.user.id;
        
        await Message.updateMany(
            {
                conversation: conversationId,
                receiver: userId,
                read: false
            },
            { $set: { read: true, readAt: Date.now() } }
        );
        
        res.json({
            success: true,
            message: 'تم تحديد الرسائل كمقروءة'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};