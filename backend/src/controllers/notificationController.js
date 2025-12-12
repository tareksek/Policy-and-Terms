const Notification = require('../models/Notification');

// عرض إشعارات المستخدم
exports.getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        
        let query = { recipient: userId };
        
        if (unreadOnly === 'true') {
            query.read = false;
        }
        
        const notifications = await Notification.find(query)
            .populate('sender', 'username name avatar')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({
            recipient: userId,
            read: false
        });
        
        res.json({
            success: true,
            data: {
                notifications,
                stats: {
                    total,
                    unread: unreadCount
                },
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

// تحديد الإشعار كمقروء
exports.markAsRead = async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.user.id;
        
        const notification = await Notification.findOne({
            _id: notificationId,
            recipient: userId
        });
        
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'الإشعار غير موجود'
            });
        }
        
        notification.read = true;
        notification.readAt = Date.now();
        await notification.save();
        
        res.json({
            success: true,
            message: 'تم تحديد الإشعار كمقروء'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// تحديد جميع الإشعارات كمقروءة
exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        
        await Notification.updateMany(
            { recipient: userId, read: false },
            { $set: { read: true, readAt: Date.now() } }
        );
        
        const unreadCount = await Notification.countDocuments({
            recipient: userId,
            read: false
        });
        
        res.json({
            success: true,
            message: 'تم تحديد جميع الإشعارات كمقروءة',
            data: {
                unreadCount
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

// حذف إشعار
exports.deleteNotification = async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.user.id;
        
        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            recipient: userId
        });
        
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'الإشعار غير موجود'
            });
        }
        
        res.json({
            success: true,
            message: 'تم حذف الإشعار'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// حذف جميع الإشعارات
exports.deleteAllNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        
        await Notification.deleteMany({ recipient: userId });
        
        res.json({
            success: true,
            message: 'تم حذف جميع الإشعارات'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// عد الإشعارات غير المقروءة
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const unreadCount = await Notification.countDocuments({
            recipient: userId,
            read: false
        });
        
        res.json({
            success: true,
            data: {
                unreadCount
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