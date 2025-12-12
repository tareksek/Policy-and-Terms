const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');

// الحصول على جميع الإشعارات
router.get('/', authMiddleware, notificationController.getNotifications);

// الحصول على الإشعارات غير المقروءة
router.get('/unread', authMiddleware, notificationController.getUnreadNotifications);

// تعليم إشعار كمقروء
router.put('/:id/read', authMiddleware, notificationController.markAsRead);

// تعليم جميع الإشعارات كمقروءة
router.put('/read-all', authMiddleware, notificationController.markAllAsRead);

// حذف إشعار
router.delete('/:id', authMiddleware, notificationController.deleteNotification);

// حذف جميع الإشعارات
router.delete('/', authMiddleware, notificationController.deleteAllNotifications);

module.exports = router;