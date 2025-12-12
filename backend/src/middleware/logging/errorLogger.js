const fs = require('fs');
const path = require('path');

const errorLogFile = path.join(__dirname, '../../logs/errors.log');

const errorLogger = (err, req, res, next) => {
  const errorEntry = {
    timestamp: new Date().toISOString(),
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name
    },
    request: {
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
      params: req.params,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
      headers: {
        'user-agent': req.get('user-agent'),
        referer: req.get('referer'),
        ip: req.ip
      }
    },
    user: req.user ? {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role
    } : null
  };

  // إزالة البيانات الحساسة
  if (errorEntry.request.body) {
    delete errorEntry.request.body.password;
    delete errorEntry.request.body.token;
    delete errorEntry.request.body.confirmPassword;
  }

  // تسجيل في الكونسول
  console.error('Error occurred:', errorEntry);

  // حفظ في ملف
  fs.appendFile(errorLogFile, JSON.stringify(errorEntry) + '\n', (fsErr) => {
    if (fsErr) {
      console.error('Failed to write error log:', fsErr);
    }
  });

  // إرسال للإدارة إذا كان خطأ حرجاً
  if (err.statusCode >= 500) {
    sendErrorToMonitoring(errorEntry);
  }

  next(err);
};

// دالة مساعدة لإرسال الأخطاء لنظام المراقبة
const sendErrorToMonitoring = (errorEntry) => {
  // يمكن إضافة تكامل مع: Sentry, LogRocket, Datadog, etc.
  if (process.env.SENTRY_DSN) {
    // تكامل مع Sentry
    // Sentry.captureException(new Error(errorEntry.error.message), {
    //   extra: errorEntry
    // });
  }
  
  // إرسال بريد إلكتروني للفريق للخطوطاء الحرجة
  if (process.env.ALERT_EMAIL) {
    // sendEmailAlert(errorEntry);
  }
};

// لوجر لأخطاء قاعدة البيانات
const dbErrorLogger = (err, operation, model, query) => {
  const dbErrorEntry = {
    timestamp: new Date().toISOString(),
    type: 'DATABASE_ERROR',
    operation,
    model,
    error: err.message,
    query: query || {},
    stack: err.stack
  };

  fs.appendFile(
    path.join(__dirname, '../../logs/db-errors.log'),
    JSON.stringify(dbErrorEntry) + '\n',
    (fsErr) => {
      if (fsErr) console.error('Failed to write DB error log:', fsErr);
    }
  );
};

module.exports = {
  errorLogger,
  dbErrorLogger,
  sendErrorToMonitoring
};