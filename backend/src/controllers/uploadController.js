
const { cloudinary } = require('../utils/cloudinary');

class UploadController {
    // Upload file
    async uploadFile(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'لم يتم اختيار ملف'
                });
            }

            const file = req.file;
            const userId = req.userId;
            const { folder = 'general' } = req.body;

            // Determine resource type
            let resourceType = 'auto';
            if (file.mimetype.startsWith('image')) {
                resourceType = 'image';
            } else if (file.mimetype.startsWith('video')) {
                resourceType = 'video';
            } else if (file.mimetype.startsWith('audio')) {
                resourceType = 'video'; // Cloudinary treats audio as video
            }

            // Upload to Cloudinary
            const result = await cloudinary.uploader.upload(file.path, {
                folder: `nexus/${folder}/${userId}`,
                resource_type: resourceType,
                use_filename: true,
                unique_filename: false
            });

            // Construct response
            const fileData = {
                url: result.secure_url,
                publicId: result.public_id,
                format: result.format,
                resourceType: result.resource_type,
                size: result.bytes,
                width: result.width,
                height: result.height,
                duration: result.duration,
                originalFilename: file.originalname,
                mimeType: file.mimetype
            };

            res.json({
                success: true,
                message: 'تم رفع الملف بنجاح',
                data: fileData
            });

        } catch (error) {
            console.error('Upload file error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء رفع الملف'
            });
        }
    }

    // Upload multiple files
    async uploadMultipleFiles(req, res) {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'لم يتم اختيار ملفات'
                });
            }

            const userId = req.userId;
            const { folder = 'general' } = req.body;
            const files = req.files;

            const uploadPromises = files.map(file => {
                // Determine resource type
                let resourceType = 'auto';
                if (file.mimetype.startsWith('image')) {
                    resourceType = 'image';
                } else if (file.mimetype.startsWith('video')) {
                    resourceType = 'video';
                }

                return cloudinary.uploader.upload(file.path, {
                    folder: `nexus/${folder}/${userId}`,
                    resource_type: resourceType,
                    use_filename: true,
                    unique_filename: false
                });
            });

            const results = await Promise.all(uploadPromises);

            const filesData = results.map((result, index) => ({
                url: result.secure_url,
                publicId: result.public_id,
                format: result.format,
                resourceType: result.resource_type,
                size: result.bytes,
                width: result.width,
                height: result.height,
                duration: result.duration,
                originalFilename: files[index].originalname,
                mimeType: files[index].mimetype
            }));

            res.json({
                success: true,
                message: `تم رفع ${files.length} ملف بنجاح`,
                data: filesData
            });

        } catch (error) {
            console.error('Upload multiple files error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء رفع الملفات'
            });
        }
    }

    // Delete file
    async deleteFile(req, res) {
        try {
            const { publicId } = req.params;

            if (!publicId) {
                return res.status(400).json({
                    success: false,
                    error: 'معرف الملف مطلوب'
                });
            }

            const result = await cloudinary.uploader.destroy(publicId);

            if (result.result === 'ok') {
                res.json({
                    success: true,
                    message: 'تم حذف الملف بنجاح'
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'الملف غير موجود'
                });
            }

        } catch (error) {
            console.error('Delete file error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء حذف الملف'
            });
        }
    }

    // Get upload limits
    async getUploadLimits(req, res) {
        try {
            const limits = {
                maxFileSize: 50 * 1024 * 1024, // 50MB
                allowedImageTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
                allowedVideoTypes: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'mkv'],
                allowedDocumentTypes: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
                maxFilesPerUpload: 10,
                maxTotalSizePerUpload: 100 * 1024 * 1024 // 100MB
            };

            res.json({
                success: true,
                data: limits
            });

        } catch (error) {
            console.error('Get upload limits error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب حدود الرفع'
            });
        }
    }
}

module.exports = new UploadController();
