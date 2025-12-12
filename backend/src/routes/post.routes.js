const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authMiddleware = require('../middleware/auth');

// إنشاء منشور جديد
router.post('/', authMiddleware, postController.createPost);

// الحصول على جميع المنشورات (مع pagination)
router.get('/', authMiddleware, postController.getPosts);

// الحصول على منشور محدد
router.get('/:id', authMiddleware, postController.getPostById);

// تحديث منشور
router.put('/:id', authMiddleware, postController.updatePost);

// حذف منشور
router.delete('/:id', authMiddleware, postController.deletePost);

// الإعجاب بالمنشور
router.post('/:id/like', authMiddleware, postController.likePost);

// إزالة الإعجاب
router.delete('/:id/like', authMiddleware, postController.unlikePost);

// الحصول على الإعجابات
router.get('/:id/likes', authMiddleware, postController.getPostLikes);

// الحصول على تعليقات المنشور
router.get('/:id/comments', authMiddleware, postController.getPostComments);

// مشاركة المنشور
router.post('/:id/share', authMiddleware, postController.sharePost);

module.exports = router;