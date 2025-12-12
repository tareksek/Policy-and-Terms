const path = require('path');
const fs = require('fs');
const Media = require('../models/Media');

// رفع صورة
exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'لم يتم رفع أي ملف'
            });
        }
        
        const userId = req.user.id;
        const { type = 'post', referenceId } = req.body;
        
        // التحقق من نوع الملف
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            // حذف الملف المرفوع
            fs.unlinkSync(req.file.path);
            
            return res.status(400).json({
                success: false,
                message: 'نوع الملف غير مدعوم. يرجى رفع صورة بصيغة JPEG, PNG, GIF, أو WebP'
            });
        }
        
        // التحقق من حجم الملف (5MB كحد أقصى)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (req.file.size > maxSize) {
            fs.unlinkSync(req.file.path);
            
            return res.status(400).json({
                success: false,
                message: 'حجم الملف كبير جدًا. الحد الأقصى 5MB'
            });
        }
        
        // حفظ بيانات الملف في قاعدة البيانات
        const media = await Media.create({
            user: userId,
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
            type,
            referenceId
        });
        
        res.status(201).json({
            success: true,
            message: 'تم رفع الصورة بنجاح',
            data: {
                id: media._id,
                url: `/uploads/${req.file.filename}`,
                filename: req.file.filename,
                type: req.file.mimetype,
                size: req.file.size
            }
        });
    } catch (error) {
        // حذف الملف في حالة حدوث خطأ
        if (req.file && req.file.path) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// رفع فيديو
exports.uploadVideo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'لم يتم رفع أي ملف'
            });
        }
        
        const userId = req.user.id;
        const { type = 'post', referenceId } = req.body;
        
        // التحقق من نوع الملف
        const allowedTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            fs.unlinkSync(req.file.path);
            
            return res.status(400).json({
                success: false,
                message: 'نوع الملف غير مدعوم. يرجى رفع فيديو بصيغة MP4, MPEG, MOV, أو WebM'
            });
        }
        
        // التحقق من حجم الملف (50MB كحد أقصى)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (req.file.size > maxSize) {
            fs.unlinkSync(req.file.path);
            
            return res.status(400).json({
                success: false,
                message: 'حجم الملف كبير جدًا. الحد الأقصى 50MB'
            });
        }
        
        // حفظ بيانات الملف في قاعدة البيانات
        const media = await Media.create({
            user: userId,
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
            type,
            referenceId
        });
        
        res.status(201).json({
            success: true,
            message: 'تم رفع الفيديو بنجاح',
            data: {
                id: media._id,
                url: `/uploads/${req.file.filename}`,
                filename: req.file.filename,
                type: req.file.mimetype,
                size: req.file.size
            }
        });
    } catch (error) {
        if (req.file && req.file.path) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// حذف وسائط
exports.deleteMedia = async (req, res) => {
    try {
        const mediaId = req.params.id;
        const userId = req.user.id;
        
        const media = await Media.findById(mediaId);
        
        if (!media) {
            return res.status(404).json({
                success: false,
                message: 'الملف غير موجود'
            });
        }
        
        // التحقق من ملكية الملف
        if (media.user.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'ليس لديك صلاحية لحذف هذا الملف'
            });
        }
        
        // حذف الملف من نظام الملفات
        if (fs.existsSync(media.path)) {
            fs.unlinkSync(media.path);
        }
        
        // حذف السجل من قاعدة البيانات
        await Media.findByIdAndDelete(mediaId);
        
        res.json({
            success: true,
            message: 'تم حذف الملف بنجاح'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// عرض الوسائط
exports.getMedia = async (req, res) => {
    try {
        const mediaId = req.params.id;
        
        const media = await Media.findById(mediaId);
        
        if (!media) {
            return res.status(404).json({
                success: false,
                message: 'الملف غير موجود'
            });
        }
        
        res.json({
            success: true,
            data: media
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// عرض وسائط المستخدم
exports.getUserMedia = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;
        const { type, page = 1, limit = 20 } = req.query;
        
        let query = { user: userId };
        
        if (type) {
            query.type = type;
        }
        
        const media = await Media.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await Media.countDocuments(query);
        
        // إضافة روابط URL للملفات
        const mediaWithUrls = media.map(item => ({
            ...item.toObject(),
            url: `/uploads/${item.filename}`
        }));
        
        res.json({
            success: true,
            data: {
                media: mediaWithUrls,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// رفع ملفات متعددة
exports.uploadMultiple = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'لم يتم رفع أي ملفات'
            });
        }
        
        const userId = req.user.id;
        const { type = 'post', referenceId } = req.body;
        const uploadedFiles = [];
        const errors = [];
        
        // تعريف الأنواع المسموحة
        const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'];
        const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
        
        for (const file of req.files) {
            try {
                // التحقق من نوع الملف
                if (!allowedTypes.includes(file.mimetype)) {
                    fs.unlinkSync(file.path);
                    errors.push(`نوع الملف ${file.originalname} غير مدعوم`);
                    continue;
                }
                
                // التحقق من حجم الملف
                const maxSize = file.mimetype.startsWith('image/') ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
                if (file.size > maxSize) {
                    fs.unlinkSync(file.path);
                    errors.push(`حجم الملف ${file.originalname} كبير جدًا`);
                    continue;
                }
                
                // حفظ بيانات الملف
                const media = await Media.create({
                    user: userId,
                    filename: file.filename,
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    path: file.path,
                    type,
                    referenceId
                });
                
                uploadedFiles.push({
                    id: media._id,
                    url: `/uploads/${file.filename}`,
                    filename: file.filename,
                    type: file.mimetype,
                    size: file.size
                });
            } catch (error) {
                if (file && file.path) {
                    fs.unlinkSync(file.path);
                }
                errors.push(`خطأ في رفع ${file.originalname}: ${error.message}`);
            }
        }
        
        if (uploadedFiles.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'فشل رفع جميع الملفات',
                errors
            });
        }
        
        res.status(201).json({
            success: true,
            message: `تم رفع ${uploadedFiles.length} ملف بنجاح`,
            data: uploadedFiles,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        // تنظيف الملفات المرفوعة في حالة حدوث خطأ
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};