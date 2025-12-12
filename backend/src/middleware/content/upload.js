const multer = require('multer');
const path = require('path');
const fs = require('fs');

// إنشاء مجلد التخزين إذا لم يكن موجوداً
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// إعدادات التخزين
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'general/';
    
    if (req.baseUrl.includes('posts')) folder = 'posts/';
    if (req.baseUrl.includes('profile')) folder = 'profile/';
    if (req.baseUrl.includes('messages')) folder = 'messages/';
    
    const fullPath = path.join(uploadDir, folder);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// تصفية الملفات
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true,
    'video/mp4': true,
    'video/quicktime': true,
    'video/x-msvideo': true,
    'application/pdf': true
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

// إنشاء upload middleware
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB للملفات الكبيرة
    files: 10 // 10 ملفات كحد أقصى
  }
});

// middleware مخصص للتحقق من الملفات
const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return next(); // السماح بالطلبات بدون ملفات
  }

  const files = req.file ? [req.file] : req.files;
  
  for (const file of files) {
    // التحقق من الحجم بناءً على نوع الملف
    if (file.mimetype.startsWith('image/') && file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        error: 'Image size should not exceed 10MB'
      });
    }
    
    if (file.mimetype.startsWith('video/') && file.size > 50 * 1024 * 1024) {
      return res.status(400).json({
        error: 'Video size should not exceed 50MB'
      });
    }
  }

  next();
};

// حذف الملفات في حالة الخطأ
const cleanupUploads = (req, res, next) => {
  const cleanup = () => {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, () => {});
      });
    }
  };

  // تنظيف عند الانتهاء من الاستجابة
  res.on('finish', cleanup);
  res.on('close', cleanup);
  
  next();
};

module.exports = {
  upload,
  validateFileUpload,
  cleanupUploads
};