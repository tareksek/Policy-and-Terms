const Friendship = require('../../models/Friendship');
const User = require('../../models/User');

// التحقق من وجود صداقة
const checkFriendship = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId || req.body.targetUserId;
    
    if (!targetUserId) {
      return next();
    }

    const friendship = await Friendship.findOne({
      $or: [
        { user1: req.user._id, user2: targetUserId, status: 'accepted' },
        { user1: targetUserId, user2: req.user._id, status: 'accepted' }
      ]
    });

    req.isFriend = !!friendship;
    req.friendship = friendship;
    next();
  } catch (error) {
    console.error('Friendship check error:', error);
    next();
  }
};

// للتحقق من أن المستخدمين أصدقاء للوصول للمحتوى الخاص
const requireFriendship = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId || req.body.userId;
    
    if (!targetUserId) {
      return res.status(400).json({
        error: 'Target user ID is required'
      });
    }

    // التحقق إذا كان المستخدم يحاول الوصول لملفه الشخصي
    if (targetUserId.toString() === req.user._id.toString()) {
      return next();
    }

    // البحث عن الصداقة
    const friendship = await Friendship.findOne({
      $or: [
        { user1: req.user._id, user2: targetUserId, status: 'accepted' },
        { user1: targetUserId, user2: req.user._id, status: 'accepted' }
      ]
    });

    if (!friendship) {
      return res.status(403).json({
        error: 'You must be friends to access this content'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      error: 'Server error while checking friendship'
    });
  }
};

// التحقق من طلبات الصداقة المعلقة
const checkPendingRequest = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId || req.body.targetUserId;

    if (targetUserId) {
      const pendingRequest = await Friendship.findOne({
        user1: req.user._id,
        user2: targetUserId,
        status: 'pending'
      });

      req.hasPendingRequest = !!pendingRequest;
      req.pendingRequest = pendingRequest;
    }

    next();
  } catch (error) {
    console.error('Pending request check error:', error);
    next();
  }
};

module.exports = {
  checkFriendship,
  requireFriendship,
  checkPendingRequest
};
