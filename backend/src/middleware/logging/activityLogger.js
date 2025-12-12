const ActivityLog = require('../../models/ActivityLog');

// أنواع الأنشطة
const ACTIVITY_TYPES = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  POST_CREATE: 'post_create',
  POST_UPDATE: 'post_update',
  POST_DELETE: 'post_delete',
  COMMENT_CREATE: 'comment_create',
  LIKE: 'like',
  FRIEND_REQUEST: 'friend_request',
  FRIEND_ACCEPT: 'friend_accept',
  MESSAGE_SEND: 'message_send',
  PROFILE_UPDATE: 'profile_update',
  PASSWORD_CHANGE: 'password_change',
  SETTINGS_UPDATE: 'settings_update'
};

const activityLogger = (activityType, metadata = {}) => {
  return async (req, res, next) => {
    // حفظ المرجع الأصلي للدالة next
    const originalNext = next;
    
    // تغليف الدالة next لتسجيل النشاط بعد الانتهاء
    const wrappedNext = async (...args) => {
      try {
        if (req.user) {
          const activityData = {
            userId: req.user._id,
            activityType,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            metadata: {
              ...metadata,
              method: req.method,
              url: req.originalUrl,
              statusCode: res.statusCode,
              params: req.params,
              query: req.query
            },
            timestamp: new Date()
          };

          // تجنب تسجيل بيانات حساسة
          if (req.body) {
            const safeBody = { ...req.body };
            delete safeBody.password;
            delete safeBody.token;
            delete safeBody.confirmPassword;
            delete safeBody.newPassword;
            activityData.metadata.body = safeBody;
          }

          // حفظ في قاعدة البيانات (غير متزامن)
          ActivityLog.create(activityData).catch(err => {
            console.error('Failed to log activity:', err);
          });

          // أيضاً حفظ في ملف لوج
          logToFile(activityData);
        }
      } catch (error) {
        console.error('Activity logging error:', error);
      }
      
      // استدعاء الدالة الأصلية
      originalNext(...args);
    };

    // استبدال الدالة next
    req.next = wrappedNext;
    next = wrappedNext;

    wrappedNext();
  };
};

// تسجيل في ملف
const logToFile = (activityData) => {
  const fs = require('fs');
  const path = require('path');
  
  const logFile = path.join(__dirname, '../../logs/activities.log');
  const logEntry = {
    ...activityData,
    userId: activityData.userId.toString(),
    timestamp: activityData.timestamp.toISOString()
  };

  fs.appendFile(logFile, JSON.stringify(logEntry) + '\n', (err) => {
    if (err) console.error('Failed to write activity log:', err);
  });
};

// middleware لتسجيل أنشطة محددة
const loginLogger = activityLogger(ACTIVITY_TYPES.LOGIN);
const postCreateLogger = activityLogger(ACTIVITY_TYPES.POST_CREATE);
const messageLogger = activityLogger(ACTIVITY_TYPES.MESSAGE_SEND, {
  privacyNote: 'Message content not logged'
});

// تسجيل أنشطة مهمة للأمان
const securityLogger = (event, details) => {
  const fs = require('fs');
  const path = require('path');
  
  const securityLog = {
    timestamp: new Date().toISOString(),
    event,
    details,
    severity: details.severity || 'medium'
  };

  const logFile = path.join(__dirname, '../../logs/security.log');
  fs.appendFile(logFile, JSON.stringify(securityLog) + '\n', (err) => {
    if (err) console.error('Failed to write security log:', err);
  });

  // إشعار للفريق للأحداث الحرجة
  if (securityLog.severity === 'high') {
    notifySecurityTeam(securityLog);
  }
};

const notifySecurityTeam = (logEntry) => {
  // إرسال إشعار للفريق (بريد، Slack، إلخ)
  console.warn('SECURITY ALERT:', logEntry);
};

module.exports = {
  activityLogger,
  loginLogger,
  postCreateLogger,
  messageLogger,
  securityLogger,
  ACTIVITY_TYPES
};