const Filter = require('bad-words');
const arabicBadWords = require('./arabicBadWords.json');

// توسيع القائمة العربية
const customFilter = new Filter();
customFilter.addWords(...arabicBadWords);

// كلمات إضافية للتصفية
const additionalFilters = [
  // إعلانات وسبام
  /\bbuy followers\b/i,
  /\bfree money\b/i,
  /\bclick here\b/i,
  /http[s]?:\/\/\S+/gi, // روابط
  // معلومات شخصية
  /\b\d{10,}\b/g, // أرقام طويلة (مثل بطاقات ائتمان)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g // إيميلات
];

const contentFilter = (req, res, next) => {
  if (req.body.content || req.body.message || req.body.comment) {
    const fieldsToCheck = ['content', 'message', 'comment', 'title', 'description'];
    
    fieldsToCheck.forEach(field => {
      if (req.body[field]) {
        let text = req.body[field];
        
        // 1. تصفية الكلمات السيئة
        text = customFilter.clean(text);
        
        // 2. تطبيق الفلاتر الإضافية
        additionalFilters.forEach(filter => {
          text = text.replace(filter, '[FILTERED]');
        });
        
        // 3. منع المحتوى الفارغ بعد التصفية
        if (text.trim().length < 2 && req.body[field].trim().length > 2) {
          return res.status(400).json({
            error: 'Content contains inappropriate language'
          });
        }
        
        req.body[field] = text;
      }
    });
  }
  
  next();
};

// للصور (التحقق من الميتاداتا)
const imageMetadataFilter = async (req, res, next) => {
  if (req.file && req.file.mimetype.startsWith('image/')) {
    // يمكن إضافة تحقق من EXIF data هنا
    // للتحقق من الصور المناسبة
  }
  next();
};

module.exports = {
  contentFilter,
  imageMetadataFilter
};