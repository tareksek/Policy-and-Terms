const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminMiddleware = require('../middleware/admin');

// إحصائيات النظام
router.get('/stats', adminMiddleware, adminController.getSystemStats);

// إدارة المستخدمين
router.get('/users', adminMiddleware, adminController.getUsers);
router.put('/users/:userId/block', adminMiddleware, adminController.blockUser);
router.put('/users/:userId/unblock', adminMiddleware, adminController.unblockUser);
router.delete('/users/:userId', adminMiddleware, adminController.deleteUser);

// إدارة المنشورات
router.get('/posts', adminMiddleware, adminController.getReportedPosts);
router.delete('/posts/:postId', adminMiddleware, adminController.deletePost);
router.put('/posts/:postId/hide', adminMiddleware, adminController.hidePost);

// إدارة التعليقات
router.get('/comments', adminMiddleware, adminController.getReportedComments);
router.delete('/comments/:commentId', adminMiddleware, adminController.deleteComment);

// إدارة المجموعات
router.get('/groups', adminMiddleware, adminController.getGroups);
router.delete('/groups/:groupId', adminMiddleware, adminController.deleteGroup);

// البلاغات
router.get('/reports', adminMiddleware, adminController.getReports);
router.put('/reports/:reportId/resolve', adminMiddleware, adminController.resolveReport);

// إعدادات النظام
router.get('/settings', adminMiddleware, adminController.getSettings);
router.put('/settings', adminMiddleware, adminController.updateSettings);

module.exports = router;