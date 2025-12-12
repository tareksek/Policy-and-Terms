const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController');
const authMiddleware = require('../middleware/auth');

// الصفحة الرئيسية (News Feed)
router.get('/', authMiddleware, feedController.getNewsFeed);

// المنشورات الرائجة
router.get('/trending', authMiddleware, feedController.getTrendingPosts);

// الاقتراحات (مستخدمين، صفحات، مجموعات)
router.get('/suggestions', authMiddleware, feedController.getSuggestions);

// الحصول على إحصائيات
router.get('/stats', authMiddleware, feedController.getFeedStats);

module.exports = router;