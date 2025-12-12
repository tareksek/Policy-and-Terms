const Block = require('../../models/Block');

// التحقق من حالة الحظر
const checkBlockStatus = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId || req.body.targetUserId;
    
    if (!targetUserId || !req.user) {
      return next();
    }

    // التحقق إذا قام المستخدم بحظر الطرف الآخر
    const hasBlocked = await Block.findOne({
      blocker: req.user._id,
      blocked: targetUserId
    });

    // التحقق إذا تم حظر المستخدم
    const isBlocked = await Block.findOne({
      blocker: targetUserId,
      blocked: req.user._id
    });

    req.hasBlocked = !!hasBlocked;
    req.isBlocked = !!isBlocked;
    req.blockStatus = {
      hasBlocked,
      isBlocked
    };

    next();
  } catch (error) {
    console.error('Block check error:', error);
    next();
  }
};

// منع التفاعل إذا كان هناك حظر
const preventBlockedInteraction = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId || req.body.targetUserId;
    
    if (!targetUserId) {
      return next();
    }

    // التحقق من الحظر في كلا الاتجاهين
    const blockExists = await Block.findOne({
      $or: [
        { blocker: req.user._id, blocked: targetUserId },
        { blocker: targetUserId, blocked: req.user._id }
      ]
    });

    if (blockExists) {
      return res.status(403).json({
        error: 'Cannot interact with this user due to block restrictions'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      error: 'Server error while checking block status'
    });
  }
};

// للتحقق قبل إرسال رسالة
const checkMessageBlock = async (req, res, next) => {
  try {
    const recipientId = req.body.recipientId || req.params.recipientId;
    
    if (!recipientId) {
      return res.status(400).json({
        error: 'Recipient ID is required'
      });
    }

    // التحقق إذا قام المستلم بحظر المرسل
    const isBlocked = await Block.findOne({
      blocker: recipientId,
      blocked: req.user._id
    });

    if (isBlocked) {
      return res.status(403).json({
        error: 'You cannot message this user'
      });
    }

    // التحقق إذا قام المرسل بحظر المستلم
    const hasBlocked = await Block.findOne({
      blocker: req.user._id,
      blocked: recipientId
    });

    if (hasBlocked) {
      return res.status(403).json({
        error: 'You have blocked this user. Unblock them to send messages.'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      error: 'Server error'
    });
  }
};

module.exports = {
  checkBlockStatus,
  preventBlockedInteraction,
  checkMessageBlock
};