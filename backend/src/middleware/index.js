
// Security
const helmetMiddleware = require('./security/helmet');
const corsMiddleware = require('./security/cors');
const {
  generalLimiter,
  authLimiter,
  contentLimiter,
  messageLimiter
} = require('./security/rateLimit');

// Auth
const { authenticate, authenticateSocket } = require('./auth/authenticate');
const { authorize, isOwner, isAdmin } = require('./auth/authorize');
const optionalAuth = require('./auth/optionalAuth');

// Content
const { 
  upload, 
  validateFileUpload, 
  cleanupUploads 
} = require('./content/upload');
const { 
  contentFilter, 
  imageMetadataFilter 
} = require('./content/contentFilter');
const { 
  spamDetection, 
  newUserRestrictions 
} = require('./content/spamDetection');

// Relationships
const { 
  checkFriendship, 
  requireFriendship, 
  checkPendingRequest 
} = require('./relationships/friendshipCheck');
const { 
  privacyCheck, 
  checkFieldVisibility 
} = require('./relationships/privacyCheck');
const { 
  checkBlockStatus, 
  preventBlockedInteraction, 
  checkMessageBlock 
} = require('./relationships/blockCheck');

// Logging
const { 
  devLogger, 
  prodLogger, 
  apiLogger 
} = require('./logging/requestLogger');
const { 
  errorLogger, 
  dbErrorLogger 
} = require('./logging/errorLogger');
const { 
  activityLogger,
  loginLogger,
  postCreateLogger,
  messageLogger,
  securityLogger
} = require('./logging/activityLogger');

// Errors
const { 
  AppError,
  errorHandler,
  validationErrorHandler,
  tokenErrorHandler,
  databaseErrorHandler,
  fileErrorHandler,
  catchAsync
} = require('./errors/errorHandler');
const { 
  notFoundHandler,
  deprecatedHandler,
  maintenanceHandler,
  apiVersionHandler
} = require('./errors/notFound');

// Utils
const { 
  paginate, 
  cursorPaginate 
} = require('./utils/pagination');
const { 
  cacheMiddleware,
  invalidateCache,
  cacheUserData,
  getUserFromCache
} = require('./utils/cache');
const { 
  compressionMiddleware,
  jsonCompression,
  staticCompression,
  compressionHeaders
} = require('./utils/compression');

// Export كل شيء
module.exports = {
  // Security
  helmetMiddleware,
  corsMiddleware,
  generalLimiter,
  authLimiter,
  contentLimiter,
  messageLimiter,
  
  // Auth
  authenticate,
  authenticateSocket,
  authorize,
  isOwner,
  isAdmin,
  optionalAuth,
  
  // Content
  upload,
  validateFileUpload,
  cleanupUploads,
  contentFilter,
  imageMetadataFilter,
  spamDetection,
  newUserRestrictions,
  
  // Relationships
  checkFriendship,
  requireFriendship,
  checkPendingRequest,
  privacyCheck,
  checkFieldVisibility,
  checkBlockStatus,
  preventBlockedInteraction,
  checkMessageBlock,
  
  // Logging
  devLogger,
  prodLogger,
  apiLogger,
  errorLogger,
  dbErrorLogger,
  activityLogger,
  loginLogger,
  postCreateLogger,
  messageLogger,
  securityLogger,
  
  // Errors
  AppError,
  errorHandler,
  validationErrorHandler,
  tokenErrorHandler,
  databaseErrorHandler,
  fileErrorHandler,
  catchAsync,
  notFoundHandler,
  deprecatedHandler,
  maintenanceHandler,
  apiVersionHandler,
  
  // Utils
  paginate,
  cursorPaginate,
  cacheMiddleware,
  invalidateCache,
  cacheUserData,
  getUserFromCache,
  compressionMiddleware,
  jsonCompression,
  staticCompression,
  compressionHeaders
};