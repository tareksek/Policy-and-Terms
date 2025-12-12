const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const authMiddleware = require('../middleware/auth');

// طلبات الصداقة الواردة
router.get('/requests', authMiddleware, friendController.getFriendRequests);

// إرسال طلب صداقة
router.post('/:userId/request', authMiddleware, friendController.sendFriendRequest);

// قبول طلب صداقة
router.put('/:requestId/accept', authMiddleware, friendController.acceptFriendRequest);

// رفض طلب صداقة
router.put('/:requestId/reject', authMiddleware, friendController.rejectFriendRequest);

// إلغاء طلب صداقة
router.delete('/:requestId/cancel', authMiddleware, friendController.cancelFriendRequest);

// إلغاء صداقة
router.delete('/:friendId', authMiddleware, friendController.removeFriend);

// الحصول على قائمة الأصدقاء
router.get('/', authMiddleware, friendController.getFriends);

// الحصول على اقتراحات أصدقاء
router.get('/suggestions', authMiddleware, friendController.getFriendSuggestions);

// البحث عن أصدقاء
router.get('/search', authMiddleware, friendController.searchFriends);

module.exports = router;