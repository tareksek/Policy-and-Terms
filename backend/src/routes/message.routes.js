const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

// الحصول على جميع المحادثات
router.get('/conversations', authMiddleware, messageController.getConversations);

// بدء محادثة جديدة
router.post('/conversations', authMiddleware, messageController.createConversation);

// الحصول على محادثة محددة
router.get('/conversations/:conversationId', authMiddleware, messageController.getConversation);

// حذف محادثة
router.delete('/conversations/:conversationId', authMiddleware, messageController.deleteConversation);

// الحصول على رسائل المحادثة
router.get('/conversations/:conversationId/messages', authMiddleware, messageController.getMessages);

// إرسال رسالة نصية
router.post('/conversations/:conversationId/messages', authMiddleware, messageController.sendMessage);

// إرسال صورة
router.post('/conversations/:conversationId/images', authMiddleware, upload.single('image'), messageController.sendImage);

// حذف رسالة
router.delete('/messages/:messageId', authMiddleware, messageController.deleteMessage);

// تعليم الرسائل كمقروءة
router.put('/conversations/:conversationId/read', authMiddleware, messageController.markAsRead);

module.exports = router;