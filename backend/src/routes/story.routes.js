const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

// إنشاء قصة (صورة/فيديو)
router.post('/', authMiddleware, upload.single('media'), storyController.createStory);

// الحصول على قصص الأصدقاء
router.get('/friends', authMiddleware, storyController.getFriendsStories);

// الحصول على قصصي
router.get('/me', authMiddleware, storyController.getMyStories);

// الحصول على قصة محددة
router.get('/:id', authMiddleware, storyController.getStory);

// حذف قصة
router.delete('/:id', authMiddleware, storyController.deleteStory);

// إضافة مشاهدة للقصة
router.post('/:id/view', authMiddleware, storyController.addView);

// الحصول على مشاهدي القصة
router.get('/:id/views', authMiddleware, storyController.getStoryViews);

// الرد على قصة
router.post('/:id/reply', authMiddleware, storyController.replyToStory);

module.exports = router;