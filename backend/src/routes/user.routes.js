const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

// الحصول على معلومات المستخدم الحالي
router.get('/me', authMiddleware, userController.getCurrentUser);

// تحديث المستخدم الحالي
router.put('/me', authMiddleware, userController.updateCurrentUser);

// حذف المستخدم الحالي
router.delete('/me', authMiddleware, userController.deleteCurrentUser);

// الحصول على مستخدم بواسطة المعرف
router.get('/:id', authMiddleware, userController.getUserById);

// البحث عن مستخدمين
router.get('/', authMiddleware, userController.searchUsers);

// الحصول على أصدقاء المستخدم
router.get('/:id/friends', authMiddleware, userController.getUserFriends);

// الحصول على منشورات المستخدم
router.get('/:id/posts', authMiddleware, userController.getUserPosts);

// تحديث الصورة الشخصية
router.put('/me/avatar', authMiddleware, upload.single('avatar'), userController.updateAvatar);

// تحديث صورة الغلاف
router.put('/me/cover', authMiddleware, upload.single('cover'), userController.updateCover);

module.exports = router;