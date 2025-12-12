const User = require('../../models/User');
const { checkFriendship } = require('./friendshipCheck');

const privacyCheck = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId || req.body.userId;
    
    if (!targetUserId) {
      return next();
    }

    // الحصول على إعدادات الخصوصية للمستخدم المستهدف
    const targetUser = await User.findById(targetUserId)
      .select('privacySettings isActive');

    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({
        error: 'User not found or account is inactive'
      });
    }

    // إذا كان المستخدم يرى ملفه الشخصي
    if (targetUserId.toString() === req.user?._id?.toString()) {
      req.canView = true;
      return next();
    }

    const privacy = targetUser.privacySettings || {};
    let canView = false;

    switch (privacy.profileVisibility) {
      case 'public':
        canView = true;
        break;
      
      case 'friends':
        if (req.user) {
          // التحقق من الصداقة
          await checkFriendship(req, res, () => {});
          canView = req.isFriend || false;
        }
        break;
      
      case 'private':
        canView = false;
        break;
      
      default:
        canView = true;
    }

    req.canViewProfile = canView;
    req.targetUser = targetUser;
    
    if (!canView) {
      return res.status(403).json({
        error: 'This profile is private'
      });
    }

    next();
  } catch (error) {
    console.error('Privacy check error:', error);
    res.status(500).json({
      error: 'Server error while checking privacy'
    });
  }
};

// للتحقق من خصائص محددة
const checkFieldVisibility = (field) => {
  return async (req, res, next) => {
    try {
      const targetUserId = req.params.userId;
      const targetUser = await User.findById(targetUserId)
        .select(`privacySettings.${field} privacySettings.profileVisibility`);

      if (!targetUser) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      const visibility = targetUser.privacySettings?.[field] || 
                        targetUser.privacySettings?.profileVisibility || 
                        'public';

      let canView = false;

      switch (visibility) {
        case 'public':
          canView = true;
          break;
        
        case 'friends':
          if (req.user) {
            await checkFriendship(req, res, () => {});
            canView = req.isFriend || false;
          }
          break;
        
        case 'private':
          canView = false;
          break;
        
        default:
          canView = true;
      }

      if (!canView) {
        return res.status(403).json({
          error: `This user's ${field} is private`
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Server error'
      });
    }
  };
};

module.exports = {
  privacyCheck,
  checkFieldVisibility
};