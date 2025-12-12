
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const rfs = require('rotating-file-stream');

// إنشاء مجلد اللوجات
const logDirectory = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// إنشاء تيار دوار للوجات
const accessLogStream = rfs.createStream('access.log', {
  interval: '1d', // تدوير يومي
  path: logDirectory,
  size: '10M', // حجم أقصى 10MB
  compress: 'gzip' // ضغط الملفات القديمة
});

// تنسيق مخصص للوج
const customFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms';

// مورجان للاستخدام في التطوير
const devLogger = morgan('dev');

// مورجان للإنتاج
const prodLogger = morgan(customFormat, {
  stream: accessLogStream,
  skip: (req, res) => req.baseUrl === '/health' // تخطي طلبات الصحة
});

// لوجر مخصص لطلبات API
const apiLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?._id || 'anonymous',
      body: req.method !== 'GET' ? req.body : undefined,
      query: req.query
    };

    // تسجيل حسب حالة الاستجابة
    if (res.statusCode >= 500) {
      console.error('API Error:', logEntry);
    } else if (res.statusCode >= 400) {
      console.warn('API Warning:', logEntry);
    } else {
      console.log('API Request:', logEntry);
    }

    // حفظ في ملف (بدون بيانات حساسة)
    const safeLogEntry = { ...logEntry };
    delete safeLogEntry.body?.password;
    delete safeLogEntry.body?.token;
    
    fs.appendFile(
      path.join(logDirectory, 'api-requests.log'),
      JSON.stringify(safeLogEntry) + '\n',
      (err) => {
        if (err) console.error('Failed to write log:', err);
      }
    );
  });

  next();
};

module.exports = {
  devLogger,
  prodLogger,
  apiLogger
};