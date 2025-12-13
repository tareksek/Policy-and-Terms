
const User = require('../models/User');
const Post = require('../models/Post');
const Group = require('../models/Group');
const Report = require('../models/Report');
const Notification = require('../models/Notification');

class AdminController {
    // Middleware to check admin role
    async isAdmin(req, res, next) {
        try {
            const userId = req.userId;
            const user = await User.findById(userId);

            // In a real application, you would have a proper admin role system
            // For now, we'll check if email contains admin
            const isAdmin = user.email.includes('admin') || 
                           user.username.includes('admin') ||
                           user._id.toString() === process.env.ADMIN_ID;

            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية الدخول إلى لوحة التحكم'
                });
            }

            next();
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء التحقق من الصلاحيات'
            });
        }
    }

    // Get dashboard statistics
    async getDashboardStats(req, res) {
        try {
            const [
                totalUsers,
                activeUsers,
                newUsersToday,
                totalPosts,
                totalGroups,
                pendingReports,
                totalStorage
            ] = await Promise.all([
                User.countDocuments(),
                User.countDocuments({ lastSeen: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
                User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
                Post.countDocuments({ isStory: false }),
                Group.countDocuments(),
                Report.countDocuments({ status: 'pending' }),
                // This would require storage calculation from Cloudinary
                0
            ]);

            const stats = {
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    newToday: newUsersToday,
                    growth: ((newUsersToday / totalUsers) * 100).toFixed(2)
                },
                content: {
                    posts: totalPosts,
                    groups: totalGroups,
                    storage: totalStorage
                },
                moderation: {
                    pendingReports
                }
            };

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Get dashboard stats error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب إحصائيات لوحة التحكم'
            });
        }
    }

    // Get users for admin
    async getUsers(req, res) {
        try {
            const { page = 1, limit = 50, search, status } = req.query;
            const skip = (page - 1) * limit;

            let query = {};

            if (search) {
                const searchRegex = new RegExp(search, 'i');
                query.$or = [
                    { username: searchRegex },
                    { email: searchRegex },
                    { 'profile.firstName': searchRegex },
                    { 'profile.lastName': searchRegex }
                ];
            }

            if (status) {
                query.accountStatus = status;
            }

            const users = await User.find(query)
                .select('-password -security.twoFactorSecret')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await User.countDocuments(query);

            res.json({
                success: true,
                data: {
                    users,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب المستخدمين'
            });
        }
    }

    // Update user status
    async updateUserStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, reason } = req.body;

            const user = await User.findById(id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'المستخدم غير موجود'
                });
            }

            const oldStatus = user.accountStatus;
            user.accountStatus = status;

            // Clear sessions if suspending or deactivating
            if (status !== 'active') {
                user.security.activeSessions = [];
            }

            await user.save();

            // Create notification for user
            if (oldStatus !== status) {
                await Notification.create({
                    recipient: user._id,
                    sender: req.userId,
                    type: 'system',
                    title: `تغيير حالة الحساب إلى ${status === 'active' ? 'نشط' : status === 'suspended' ? 'موقوف' : 'معطل'}`,
                    message: reason || `تم تغيير حالة حسابك إلى ${status === 'active' ? 'نشط' : status === 'suspended' ? 'موقوف' : 'معطل'}`,
                    data: { 
                        oldStatus,
                        newStatus: status,
                        reason: reason || ''
                    }
                });
            }

            res.json({
                success: true,
                message: `تم تحديث حالة المستخدم إلى ${status === 'active' ? 'نشط' : status === 'suspended' ? 'موقوف' : 'معطل'}`
            });

        } catch (error) {
            console.error('Update user status error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تحديث حالة المستخدم'
            });
        }
    }

    // Get posts for admin
    async getPosts(req, res) {
        try {
            const { page = 1, limit = 50, search, type } = req.query;
            const skip = (page - 1) * limit;

            let query = {};

            if (search) {
                const searchRegex = new RegExp(search, 'i');
                query.content = searchRegex;
            }

            if (type === 'story') {
                query.isStory = true;
            } else if (type === 'post') {
                query.isStory = false;
            }

            const posts = await Post.find(query)
                .populate('author', 'username profile')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Post.countDocuments(query);

            res.json({
                success: true,
                data: {
                    posts,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get posts error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب المنشورات'
            });
        }
    }

    // Delete post as admin
    async deletePostAsAdmin(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const post = await Post.findById(id)
                .populate('author', 'username profile');

            if (!post) {
                return res.status(404).json({
                    success: false,
                    error: 'المنشور غير موجود'
                });
            }

            // Create notification for post author
            await Notification.create({
                recipient: post.author._id,
                sender: req.userId,
                type: 'system',
                title: 'حذف منشور',
                message: `تم حذف منشورك ${reason ? `للسبب: ${reason}` : 'لمخالفة شروط الاستخدام'}`,
                data: { 
                    postId: post._id,
                    reason: reason || '',
                    deletedByAdmin: true
                }
            });

            // Delete the post (actual deletion logic would be in postController)
            await require('./postController').deletePost(req, res);

        } catch (error) {
            console.error('Delete post as admin error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء حذف المنشور'
            });
        }
    }

    // Get groups for admin
    async getGroups(req, res) {
        try {
            const { page = 1, limit = 50, search } = req.query;
            const skip = (page - 1) * limit;

            let query = {};

            if (search) {
                const searchRegex = new RegExp(search, 'i');
                query.$or = [
                    { name: searchRegex },
                    { description: searchRegex }
                ];
            }

            const groups = await Group.find(query)
                .populate('admin', 'username profile')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Group.countDocuments(query);

            res.json({
                success: true,
                data: {
                    groups,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get groups error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب المجموعات'
            });
        }
    }

    // Get reports
    async getReports(req, res) {
        try {
            const { page = 1, limit = 50, status } = req.query;
            const skip = (page - 1) * limit;

            let query = {};

            if (status) {
                query.status = status;
            }

            const reports = await Report.find(query)
                .populate('reporter', 'username profile')
                .populate('reportedUser', 'username profile')
                .populate('reportedPost')
                .populate('reportedGroup')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Report.countDocuments(query);

            res.json({
                success: true,
                data: {
                    reports,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get reports error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب البلاغات'
            });
        }
    }

    // Update report status
    async updateReportStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, actionTaken, notes } = req.body;

            const report = await Report.findById(id);

            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: 'البلاغ غير موجود'
                });
            }

            report.status = status;
            report.actionTaken = actionTaken;
            report.adminNotes = notes;
            report.resolvedAt = new Date();
            report.resolvedBy = req.userId;

            await report.save();

            // Create notification for reporter
            await Notification.create({
                recipient: report.reporter,
                sender: req.userId,
                type: 'system',
                title: 'تحديث حالة البلاغ',
                message: `تم ${status === 'resolved' ? 'حل' : 'رفض'} البلاغ الذي قدمته${actionTaken ? `. الإجراء المتخذ: ${actionTaken}` : ''}`,
                data: { 
                    reportId: report._id,
                    status,
                    actionTaken: actionTaken || ''
                }
            });

            res.json({
                success: true,
                message: `تم تحديث حالة البلاغ إلى ${status === 'pending' ? 'معلق' : status === 'resolved' ? 'تم الحل' : 'مرفوض'}`
            });

        } catch (error) {
            console.error('Update report status error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تحديث حالة البلاغ'
            });
        }
    }

    // Get system logs
    async getSystemLogs(req, res) {
        try {
            const { page = 1, limit = 100, type, startDate, endDate } = req.query;
            const skip = (page - 1) * limit;

            let query = {};

            if (type) {
                query.type = type;
            }

            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // In a real application, you would have a SystemLog model
            // For now, we'll return empty array
            const logs = [];
            const total = 0;

            res.json({
                success: true,
                data: {
                    logs,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get system logs error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جبل سجلات النظام'
            });
        }
    }

    // Send system notification
    async sendSystemNotification(req, res) {
        try {
            const { title, message, recipients, type } = req.body;

            let recipientUsers = [];

            if (recipients === 'all') {
                recipientUsers = await User.find({ accountStatus: 'active' })
                    .select('_id');
            } else if (recipients === 'admins') {
                recipientUsers = await User.find({ 
                    email: /admin/,
                    accountStatus: 'active'
                }).select('_id');
            } else if (Array.isArray(recipients)) {
                recipientUsers = await User.find({
                    _id: { $in: recipients },
                    accountStatus: 'active'
                }).select('_id');
            }

            // Create notifications in batches
            const batchSize = 100;
            const notificationController = require('./notificationController');

            for (let i = 0; i < recipientUsers.length; i += batchSize) {
                const batch = recipientUsers.slice(i, i + batchSize);
                const notifications = batch.map(user => ({
                    recipient: user._id,
                    sender: req.userId,
                    type: type || 'system',
                    title,
                    message,
                    priority: 'high',
                    data: { systemNotification: true }
                }));

                await notificationController.bulkCreateNotifications(notifications);
            }

            res.json({
                success: true,
                message: `تم إرسال الإشعار إلى ${recipientUsers.length} مستخدم`
            });

        } catch (error) {
            console.error('Send system notification error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إرسال الإشعار النظامي'
            });
        }
    }

    // Get analytics
    async getAnalytics(req, res) {
        try {
            const { period = 'week' } = req.query; // day, week, month, year
            
            let startDate;
            const endDate = new Date();
            
            switch (period) {
                case 'day':
                    startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    break;
                case 'week':
                    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'year':
                    startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            }

            // User growth
            const userGrowth = await User.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' },
                            day: { $dayOfMonth: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
            ]);

            // Post activity
            const postActivity = await Post.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate },
                        isStory: false
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' },
                            day: { $dayOfMonth: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
            ]);

            // Active users
            const activeUsers = await User.countDocuments({
                lastSeen: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });

            const analytics = {
                userGrowth,
                postActivity,
                activeUsers,
                period
            };

            res.json({
                success: true,
                data: analytics
            });

        } catch (error) {
            console.error('Get analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب التحليلات'
            });
        }
    }
}

module.exports = new AdminController();
