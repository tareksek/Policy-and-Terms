const compression = require('compression');
const zlib = require('zlib');

// تهيئة middleware الضغط مع إعدادات مخصصة
const compressionMiddleware = compression({
  // مستوى الضغط (1 = أسرع، 9 = أفضل ضغط)
  level: process.env.NODE_ENV === 'production' ? 6 : 1,
  
  // عتبة الحجم للبدء بالضغط (بايت)
  threshold: 1024,
  
  // فلترة أنواع المحتوى للضغط
  filter: (req, res) => {
    const contentType = res.getHeader('Content-Type') || '';
    
    // أنواع المحتوى التي نريد ضغطها
    const compressibleTypes = [
      'application/json',
      'application/javascript',
      'text/html',
      'text/css',
      'text/plain',
      'text/xml',
      'application/xml'
    ];
    
    // لا تضغط إذا كان نوع المحتوى غير مدعوم
    if (!compressibleTypes.some(type => contentType.includes(type))) {
      return false;
    }
    
    // لا تضغط إذا كان هناك header مخصص يمنع الضغط
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // استخدم الضغط الافتراضي
    return compression.filter(req, res);
  }
});

// ضغط مخصص للـ JSON responses
const jsonCompression = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // التحقق إذا كان العميل يدعم الضغط
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const supportsGzip = acceptEncoding.includes('gzip');
    const supportsBrotli = acceptEncoding.includes('br');
    
    // إذا كان العميل يدعم Brotli (أفضل ضغط)
    if (supportsBrotli && process.env.NODE_ENV === 'production') {
      res.setHeader('Content-Encoding', 'br');
      res.setHeader('Vary', 'Accept-Encoding');
      
      const jsonString = JSON.stringify(data);
      const compressed = zlib.brotliCompressSync(jsonString, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 11 // أقصى ضغط
        }
      });
      
      res.setHeader('Content-Length', compressed.length);
      return res.send(compressed);
    }
    
    // إذا كان العميل يدعم Gzip
    if (supportsGzip) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      
      const jsonString = JSON.stringify(data);
      const compressed = zlib.gzipSync(jsonString, {
        level: zlib.constants.Z_BEST_COMPRESSION
      });
      
      res.setHeader('Content-Length', compressed.length);
      return res.send(compressed);
    }
    
    // إذا لم يدعم الضغط، استخدم الدالة الأصلية
    return originalJson.call(this, data);
  };
  
  next();
};

// middleware لضغط الملفات الثابتة
const staticCompression = (req, res, next) => {
  if (req.url.match(/\.(js|css|html|json|xml)$/)) {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    if (acceptEncoding.includes('br')) {
      req.url = req.url + '.br';
      res.setHeader('Content-Encoding', 'br');
      res.setHeader('Content-Type', getContentType(req.url));
    } else if (acceptEncoding.includes('gzip')) {
      req.url = req.url + '.gz';
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Type', getContentType(req.url));
    }
  }
  
  next();
};

// دالة مساعدة للحصول على نوع المحتوى
const getContentType = (filename) => {
  const ext = filename.split('.').pop();
  const types = {
    'js': 'application/javascript',
    'css': 'text/css',
    'html': 'text/html',
    'json': 'application/json',
    'xml': 'application/xml'
  };
  
  return types[ext] || 'text/plain';
};

// middleware لضبط headers للضغط
const compressionHeaders = (req, res, next) => {
  // إضافة header للتحكم في الذاكرة المؤقتة للضغط
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  
  // إضافة header للتحقق من التعديلات
  res.setHeader('ETag', `W/"${Date.now()}"`);
  
  next();
};

module.exports = {
  compressionMiddleware,
  jsonCompression,
  staticCompression,
  compressionHeaders
};