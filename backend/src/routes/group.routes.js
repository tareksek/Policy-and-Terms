const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

// إنشاء مجموعة
router.post('/', authMiddleware, groupController.createGroup);

// الحصول على جميع المجموعات
router.get('/', authMiddleware, groupController.getGroups);

// الحصول على مجموعة محددة
router.get('/:groupId', authMiddleware, groupController.getGroup);

// تحديث مجموعة
router.put('/:groupId', authMiddleware, groupController.updateGroup);

// حذف مجموعة
router.delete('/:groupId', authMiddleware, groupController.deleteGroup);

// تحديث صورة المجموعة
router.put('/:groupId/cover', authMiddleware, upload.single('cover'), groupController.updateGroupCover);

// الأعضاء
router.get('/:groupId/members', authMiddleware, groupController.getGroupMembers);

// إضافة عضو
router.post('/:groupId/members', authMiddleware, groupController.addMember);

// إزالة عضو
router.delete('/:groupId/members/:userId', authMiddleware, groupController.removeMember);

// تحديث دور العضو
router.put('/:groupId/members/:userId/role', authMiddleware, groupController.updateMemberRole);

// المنشورات
router.get('/:groupId/posts', authMiddleware, groupController.getGroupPosts);

// إنشاء منشور في المجموعة
router.post('/:groupId/posts', authMiddleware, groupController.createGroupPost);

module.exports = router;