const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const authMiddleware = require('../middleware/auth');

// إضافة تعليق على منشور
router.post('/posts/:postId/comments', authMiddleware, commentController.createComment);

// تحديث تعليق
router.put('/:id', authMiddleware, commentController.updateComment);

// حذف تعليق
router.delete('/:id', authMiddleware, commentController.deleteComment);

// الإعجاب على تعليق
router.post('/:id/like', authMiddleware, commentController.likeComment);

// إزالة الإعجاب من تعليق
router.delete('/:id/like', authMiddleware, commentController.unlikeComment);

// الرد على تعليق
router.post('/:id/replies', authMiddleware, commentController.createReply);

module.exports = router;