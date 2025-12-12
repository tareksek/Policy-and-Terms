class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// معالج الأخطاء المركزي
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // بيئة التطوير: إرجاع تفاصيل الخطأ
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  }

  // بيئة الإنتاج: إرجاع رسائل ودية
  const errorResponse = {
    status: err.status,
    message: err.message || 'Something went wrong!'
  };

  // أخطاء عملية (متعمد)
  if (err.isOperational) {
    return res.status(err.statusCode).json(errorResponse);
  }

  // أخطاء غير متوقعة أو برمجية
  console.error('ERROR 💥', err);

  // رسالة عامة للعميل
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong!'
  });
};

// معالج لأخطاء التحقق
const validationErrorHandler = (err, req, res, next) => {
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(el => el.message);
    return res.status(400).json({
      status: 'fail',
      message: 'Invalid input data',
      errors
    });
  }
  next(err);
};

// معالج لأخطاء التوكن
const tokenErrorHandler = (err, req, res, next) => {
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid token. Please log in again!'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Your token has expired! Please log in again.'
    });
  }
  
  next(err);
};

// معالج لأخطاء قاعدة البيانات
const databaseErrorHandler = (err, req, res, next) => {
  // أخطاء فريدة (Duplicate key)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    return res.status(400).json({
      status: 'fail',
      message: `Duplicate field value: ${field} = ${value}. Please use another value!`
    });
  }
  
  // أخطاء Cast (مثل ID غير صالح)
  if (err.name === 'CastError') {
    return res.status(400).json({
      status: 'fail',
      message: `Invalid ${err.path}: ${err.value}`
    });
  }
  
  next(err);
};

// معالج لأخطاء الملفات
const fileErrorHandler = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      status: 'fail',
      message: 'File too large. Maximum size is 10MB for images and 50MB for videos.'
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      status: 'fail',
      message: 'Too many files uploaded. Maximum is 10 files.'
    });
  }
  
  if (err.message.includes('File type not allowed')) {
    return res.status(400).json({
      status: 'fail',
      message: 'File type not allowed. Allowed types: images (jpeg, png, gif, webp) and videos (mp4, mov, avi).'
    });
  }
  
  next(err);
};

// wrapper للتعامل مع ال async/await
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = {
  AppError,
  errorHandler,
  validationErrorHandler,
  tokenErrorHandler,
  databaseErrorHandler,
  fileErrorHandler,
  catchAsync
};