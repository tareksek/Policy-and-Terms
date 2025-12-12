
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// استيراد middleware المخصصة
const middleware = require('./middleware');

const app = express();
const server = http.createServer(app);

// ===== 1. Middleware الأساسية =====
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ===== 2. CORS مخصص =====
app.use(middleware.corsMiddleware);

// ===== 3. الأمن والسلامة =====
app.use(middleware.helmetMiddleware);
app.use(mongoSanitize());
app.use(xss());

// ===== 4. الضغط =====
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));
app.use(middleware.compressionHeaders);

// ===== 5. التسجيل والمراقبة =====
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  app.use(middleware.devLogger);
} else {
  app.use(morgan('combined', {
    skip: (req, res) => req.url === '/api/health'
  }));
  app.use(middleware.prodLogger);
}
app.use(middleware.apiLogger);

// ===== 6. Rate Limiting المتقدم =====
app.use('/api/', middleware.generalLimiter);
app.use('/api/auth/', middleware.authLimiter);
app.use('/api/posts/', middleware.contentLimiter);
app.use('/api/messages/', middleware.messageLimiter);

// ===== 7. الصيانة ونسخة API =====
app.use(middleware.maintenanceHandler);
app.use('/api/', middleware.apiVersionHandler);

// ===== 8. Middleware المخصصة للتحقق =====
// (سيتم تطبيقها على مسارات محددة لاحقاً)

// ===== 9. ملفات الـ Frontend =====
const FRONTEND_PATH = path.join(__dirname, '../frontend');
console.log('📁 Frontend path:', FRONTEND_PATH);

if (fs.existsSync(FRONTEND_PATH)) {
  app.use(express.static(FRONTEND_PATH));
  
  // جميع مسارات الـ Frontend
  app.get(['/', '/login', '/register', '/home', '/profile', '/friends', '/messages', '/notifications', '/videos'], (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
  });
}

// ===== 10. اتصال قاعدة البيانات =====
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  w: 'majority'
}).then(() => {
  console.log('✅ Connected to MongoDB');
  
  // تسجيل حالة الاتصال
  middleware.securityLogger('DB_CONNECTION_SUCCESS', {
    severity: 'low',
    message: 'Database connection established successfully'
  });
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  
  // تسجيل خطأ الاتصال
  middleware.securityLogger('DB_CONNECTION_FAILED', {
    severity: 'high',
    message: 'Failed to connect to database',
    error: err.message
  });
});

// ===== 11. Socket.io =====
const io = socketIo(server, {
  cors: {
    origin: "*",
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware للمصادقة في Socket.io
io.use(middleware.authenticateSocket);

// استيراد Socket.io handlers
require('./src/utils/socket')(io);

// ===== 12. مسارات الـ API مع Middleware المخصصة =====

// --- Auth Routes ---
app.use('/api/auth', 
  middleware.spamDetection,
  middleware.contentFilter,
  require('./src/routes/authRoutes')
);

// --- User Routes ---
app.use('/api/users', 
  middleware.authenticate,
  middleware.checkBlockStatus,
  middleware.privacyCheck,
  middleware.upload.single('profilePicture'),
  middleware.validateFileUpload,
  middleware.cleanupUploads,
  require('./src/routes/userRoutes')
);

// --- Post Routes ---
app.use('/api/posts', 
  middleware.authenticate,
  middleware.checkBlockStatus,
  middleware.contentFilter,
  middleware.spamDetection,
  middleware.newUserRestrictions,
  middleware.upload.array('media', 10),
  middleware.validateFileUpload,
  middleware.cleanupUploads,
  middleware.invalidateCache(['posts', 'feed']),
  require('./src/routes/postRoutes')
);

// --- Comment Routes ---
app.use('/api/comments', 
  middleware.authenticate,
  middleware.checkBlockStatus,
  middleware.contentFilter,
  middleware.spamDetection,
  middleware.invalidateCache(['comments']),
  require('./src/routes/commentRoutes')
);

// --- Friend Routes ---
app.use('/api/friends', 
  middleware.authenticate,
  middleware.checkBlockStatus,
  middleware.checkFriendship,
  middleware.checkPendingRequest,
  middleware.invalidateCache(['friends', 'profile']),
  require('./src/routes/friendRoutes')
);

// --- Notification Routes ---
app.use('/api/notifications', 
  middleware.authenticate,
  middleware.cacheMiddleware(300), // تخزين مؤقت لمدة 5 دقائق
  require('./src/routes/notificationRoutes')
);

// --- Message Routes ---
app.use('/api/messages', 
  middleware.authenticate,
  middleware.checkBlockStatus,
  middleware.checkMessageBlock,
  middleware.contentFilter,
  middleware.upload.array('attachments', 5),
  middleware.validateFileUpload,
  middleware.cleanupUploads,
  middleware.messageLogger,
  require('./src/routes/messageRoutes')
);

// --- Video Routes ---
app.use('/api/videos', 
  middleware.authenticate,
  middleware.checkBlockStatus,
  middleware.upload.array('videos', 3),
  middleware.validateFileUpload,
  middleware.cleanupUploads,
  middleware.invalidateCache(['videos']),
  require('./src/routes/videoRoutes')
);

// ===== 13. نقطة الصحة =====
app.get('/api/health', 
  middleware.optionalAuth,
  (req, res) => {
    const healthStatus = {
      status: 'ok',
      service: 'SocialSphere',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      authenticated: req.isAuthenticated || false
    };
    
    // تسجيل طلب الصحة (غير مهم)
    middleware.activityLogger('HEALTH_CHECK', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      authenticated: req.isAuthenticated
    })(req, res, () => {
      res.status(200).json(healthStatus);
    });
});

// ===== 14. مسار للتحقق من الإصدار =====
app.get('/api/version', 
  middleware.apiVersionHandler,
  (req, res) => {
    res.json({
      version: '1.0.0',
      apiVersion: req.apiVersion,
      status: 'active',
      documentation: 'https://api.socialsphere.com/docs'
    });
});

// ===== 15. معالجة الأخطاء =====

// 1. أخطاء التحقق
app.use(middleware.validationErrorHandler);

// 2. أخطاء التوكن
app.use(middleware.tokenErrorHandler);

// 3. أخطاء قاعدة البيانات
app.use(middleware.databaseErrorHandler);

// 4. أخطاء الملفات
app.use(middleware.fileErrorHandler);

// 5. معالج الأخطاء العام
app.use(middleware.errorHandler);

// 6. المسارات غير موجودة
app.use(middleware.notFoundHandler);

// ===== 16. Middleware لتعطيل المسارات القديمة =====
app.use('/api/v1/*', middleware.deprecatedHandler);

// ===== 17. معالجة الأخطاء غير المتوقعة =====
process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error);
  middleware.securityLogger('UNCAUGHT_EXCEPTION', {
    severity: 'critical',
    error: error.message,
    stack: error.stack
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
  middleware.securityLogger('UNHANDLED_REJECTION', {
    severity: 'high',
    reason: reason.message || reason,
    promise: promise.toString()
  });
});

// ===== 18. إغلاق نظيف للتطبيق =====
const gracefulShutdown = () => {
  console.log('🔄 Shutting down gracefully...');
  
  // إغلاق الخادم
  server.close(() => {
    console.log('✅ Server closed');
    
    // إغلاق اتصال MongoDB
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
  
  // إذا لم يتم الإغلاق خلال 10 ثوانٍ
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// معالجة إشارات الإغلاق
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// ===== 19. بدء الخادم =====
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`
    🚀 SocialSphere Server is running
    =================================
    Port: ${PORT}
    Host: ${HOST}
    Environment: ${process.env.NODE_ENV || 'development'}
    URL: http://${HOST}:${PORT}
    API URL: http://${HOST}:${PORT}/api
    Health Check: http://${HOST}:${PORT}/api/health
    
    📊 Middleware Loaded:
    - Security: ✅ Helmet, CORS, Rate Limiting, XSS, Mongo Sanitize
    - Auth: ✅ JWT Authentication, Authorization
    - Content: ✅ File Upload, Content Filtering, Spam Detection
    - Relationships: ✅ Friendship, Privacy, Block Checks
    - Performance: ✅ Compression, Caching, Pagination
    - Monitoring: ✅ Request Logging, Error Logging, Activity Tracking
    =================================
  `);
  
  // تسجيل بدء التشغيل
  middleware.securityLogger('SERVER_START', {
    severity: 'low',
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = { app, server, io };
