
const Notification = require('../models/Notification');
const User = require('../models/User');

class NotificationController {
    // Get notifications
    async getNotifications(req, res) {
        try {
            const userId = req.userId;
            const { page = 1, limit = 20, type, unread } = req.query;
            const skip = (page - 1) * limit;

            let query = { recipient: userId };

            if (type) {
                query.type = type;
            }

            if (unread === 'true') {
                query.read = false;
            }

            const notifications = await Notification.find(query)
                .populate('sender', 'username profile')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Notification.countDocuments(query);

            res.json({
                success: true,
                data: {
                    notifications,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get notifications error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب الإشعارات'
            });
        }
    }

    // Get unread count
    async getUnreadCount(req, res) {
        try {
            const userId = req.userId;

            const count = await Notification.countDocuments({
                recipient: userId,
                read: false
            });

            res.json({
                success: true,
                data: { count }
            });

        } catch (error) {
            console.error('Get unread count error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جبل عدد الإشعارات غير المقروءة'
            });
        }
    }

    // Mark as read
    async markAsRead(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const notification = await Notification.findById(id);

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'الإشعار غير موجود'
                });
            }

            // Check ownership
            if (!notification.recipient.equals(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لتعديل هذا الإشعار'
                });
            }

            notification.read = true;
            notification.readAt = new Date();
            await notification.save();

            res.json({
                success: true,
                message: 'تم تحديد الإشعار كمقروء'
            });

        } catch (error) {
            console.error('Mark as read error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تحديد الإشعار كمقروء'
            });
        }
    }

    // Mark all as read
    async markAllAsRead(req, res) {
        try {
            const userId = req.userId;

            await Notification.updateMany(
                {
                    recipient: userId,
                    read: false
                },
                {
                    read: true,
                    readAt: new Date()
                }
            );

            res.json({
                success: true,
                message: 'تم تحديد جميع الإشعارات كمقروءة'
            });

        } catch (error) {
            console.error('Mark all as read error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تحديد جميع الإشعارات كمقروءة'
            });
        }
    }

    // Delete notification
    async deleteNotification(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const notification = await Notification.findById(id);

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'الإشعار غير موجود'
                });
            }

            // Check ownership
            if (!notification.recipient.equals(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لحذف هذا الإشعار'
                });
            }

            await Notification.findByIdAndDelete(id);

            res.json({
                success: true,
                message: 'تم حذف الإشعار بنجاح'
            });

        } catch (error) {
            console.error('Delete notification error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء حذف الإشعار'
            });
        }
    }

    // Clear all notifications
    async clearAllNotifications(req, res) {
        try {
            const userId = req.userId;

            await Notification.deleteMany({ recipient: userId });

            res.json({
                success: true,
                message: 'تم حذف جميع الإشعارات'
            });

        } catch (error) {
            console.error('Clear all notifications error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء حذف جميع الإشعارات'
            });
        }
    }

    // Get notification settings
    async getNotificationSettings(req, res) {
        try {
            const userId = req.userId;

            const user = await User.findById(userId)
                .select('privacySettings security');

            const settings = {
                // Message notifications
                messageNotifications: user.privacySettings.allowMessages !== 'none',
                messageSound: true,
                messagePreview: true,

                // Post notifications
                postLikeNotifications: true,
                postCommentNotifications: true,
                postShareNotifications: true,
                postTagNotifications: true,

                // Friend notifications
                friendRequestNotifications: user.privacySettings.allowFriendRequests,
                friendAcceptNotifications: true,

                // Group notifications
                groupInviteNotifications: true,
                groupPostNotifications: true,
                groupRequestNotifications: true,

                // System notifications
                loginAlerts: user.security.loginAlerts,
                securityAlerts: true,
                updatesAndNews: true,

                // Email notifications
                emailNotifications: true,
                emailFrequency: 'immediate' // immediate, daily, weekly
            };

            res.json({
                success: true,
                data: settings
            });

        } catch (error) {
            console.error('Get notification settings error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب إعدادات الإشعارات'
            });
        }
    }

    // Update notification settings
    async updateNotificationSettings(req, res) {
        try {
            const userId = req.userId;
            const { settings } = req.body;

            const user = await User.findById(userId);

            // Update user settings based on notification preferences
            if (settings.friendRequestNotifications !== undefined) {
                user.privacySettings.allowFriendRequests = settings.friendRequestNotifications;
            }

            if (settings.loginAlerts !== undefined) {
                user.security.loginAlerts = settings.loginAlerts;
            }

            await user.save();

            res.json({
                success: true,
                message: 'تم تحديث إعدادات الإشعارات بنجاح'
            });

        } catch (error) {
            console.error('Update notification settings error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تحديث إعدادات الإشعارات'
            });
        }
    }

    // Create notification (internal use)
    async createNotification(data) {
        try {
            const notification = new Notification(data);
            await notification.save();
            return notification;
        } catch (error) {
            console.error('Create notification error:', error);
            throw error;
        }
    }

    // Bulk create notifications (internal use)
    async bulkCreateNotifications(notificationsData) {
        try {
            const notifications = await Notification.insertMany(notificationsData);
            return notifications;
        } catch (error) {
            console.error('Bulk create notifications error:', error);
            throw error;
        }
    }
}

module.exports = new NotificationController();
