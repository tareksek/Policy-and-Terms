const Group = require('../models/Group');
const User = require('../models/User');

// إنشاء مجموعة
exports.createGroup = async (req, res) => {
    try {
        const { name, description, privacy = 'public', members } = req.body;
        const creatorId = req.user.id;
        
        // التحقق من الاسم
        const existingGroup = await Group.findOne({ name });
        
        if (existingGroup) {
            return res.status(400).json({
                success: false,
                message: 'اسم المجموعة موجود بالفعل'
            });
        }
        
        // إنشاء المجموعة
        const group = await Group.create({
            name,
            description,
            privacy,
            creator: creatorId,
            admins: [creatorId],
            members: [creatorId, ...(members || [])]
        });
        
        await group.populate('creator', 'username name avatar');
        await group.populate('members', 'username name avatar');
        await group.populate('admins', 'username name avatar');
        
        res.status(201).json({
            success: true,
            message: 'تم إنشاء المجموعة بنجاح',
            data: group
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// الانضمام لمجموعة
exports.joinGroup = async (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.user.id;
        
        const group = await Group.findById(groupId);
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'المجموعة غير موجودة'
            });
        }
        
        // التحقق إذا كان المستخدم عضو بالفعل
        if (group.members.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: 'أنت عضو في هذه المجموعة بالفعل'
            });
        }
        
        // التحقق من خصوصية المجموعة
        if (group.privacy === 'private') {
            // إرسال طلب انضمام بدلاً من الانضمام مباشرة
            group.joinRequests.push(userId);
            await group.save();
            
            return res.json({
                success: true,
                message: 'تم إرسال طلب الانضمام للمجموعة'
            });
        }
        
        // الانضمام للمجموعة العامة
        group.members.push(userId);
        await group.save();
        
        await group.populate('members', 'username name avatar');
        
        res.json({
            success: true,
            message: 'تم الانضمام للمجموعة بنجاح',
            data: group
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// مغادرة مجموعة
exports.leaveGroup = async (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.user.id;
        
        const group = await Group.findById(groupId);
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'المجموعة غير موجودة'
            });
        }
        
        // التحقق إذا كان المستخدم عضو
        if (!group.members.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: 'أنت لست عضوًا في هذه المجموعة'
            });
        }
        
        // التحقق إذا كان المالك يحاول المغادرة
        if (group.creator.toString() === userId) {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن لمالك المجموعة مغادرتها'
            });
        }
        
        // إزالة المستخدم من الأعضاء والإداريين
        group.members = group.members.filter(id => id.toString() !== userId);
        group.admins = group.admins.filter(id => id.toString() !== userId);
        
        await group.save();
        
        res.json({
            success: true,
            message: 'تم مغادرة المجموعة'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// عرض منشورات المجموعة
exports.getGroupPosts = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { page = 1, limit = 20 } = req.query;
        
        const group = await Group.findById(groupId)
            .populate({
                path: 'posts',
                populate: {
                    path: 'user',
                    select: 'username name avatar'
                },
                options: {
                    sort: { createdAt: -1 },
                    skip: (page - 1) * limit,
                    limit: parseInt(limit)
                }
            });
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'المجموعة غير موجودة'
            });
        }
        
        const total = group.posts.length;
        
        res.json({
            success: true,
            data: {
                posts: group.posts,
                group: {
                    name: group.name,
                    description: group.description
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

// إدارة الأعضاء (إضافة/حذف/ترقية/تنزيل)
exports.manageMembers = async (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.user.id;
        const { action, targetUserId, role } = req.body;
        
        const group = await Group.findById(groupId);
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'المجموعة غير موجودة'
            });
        }
        
        // التحقق من صلاحية المستخدم
        const isAdmin = group.admins.includes(userId);
        const isCreator = group.creator.toString() === userId;
        
        if (!isAdmin && !isCreator) {
            return res.status(403).json({
                success: false,
                message: 'ليس لديك صلاحية لإدارة الأعضاء'
            });
        }
        
        // التحقق من وجود المستخدم المستهدف
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم المستهدف غير موجود'
            });
        }
        
        switch (action) {
            case 'add':
                if (group.members.includes(targetUserId)) {
                    return res.status(400).json({
                        success: false,
                        message: 'المستخدم عضو بالفعل في المجموعة'
                    });
                }
                group.members.push(targetUserId);
                break;
                
            case 'remove':
                // منع حذف المالك
                if (group.creator.toString() === targetUserId) {
                    return res.status(400).json({
                        success: false,
                        message: 'لا يمكن إزالة مالك المجموعة'
                    });
                }
                
                // منع الإداريين من حذف بعضهم البعض إلا المالك
                if (group.admins.includes(targetUserId) && !isCreator) {
                    return res.status(403).json({
                        success: false,
                        message: 'لا يمكن للإداريين إزالة إداريين آخرين'
                    });
                }
                
                group.members = group.members.filter(id => id.toString() !== targetUserId);
                group.admins = group.admins.filter(id => id.toString() !== targetUserId);
                break;
                
            case 'promote':
                if (!group.members.includes(targetUserId)) {
                    return res.status(400).json({
                        success: false,
                        message: 'المستخدم ليس عضوًا في المجموعة'
                    });
                }
                
                if (group.admins.includes(targetUserId)) {
                    return res.status(400).json({
                        success: false,
                        message: 'المستخدم مسؤول بالفعل'
                    });
                }
                
                group.admins.push(targetUserId);
                break;
                
            case 'demote':
                if (!group.admins.includes(targetUserId)) {
                    return res.status(400).json({
                        success: false,
                        message: 'المستخدم ليس مسؤولاً'
                    });
                }
                
                // منع تنزيل المالك
                if (group.creator.toString() === targetUserId) {
                    return res.status(400).json({
                        success: false,
                        message: 'لا يمكن تنزيل مالك المجموعة'
                    });
                }
                
                group.admins = group.admins.filter(id => id.toString() !== targetUserId);
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    message: 'إجراء غير صالح'
                });
        }
        
        await group.save();
        
        await group.populate('members', 'username name avatar');
        await group.populate('admins', 'username name avatar');
        
        res.json({
            success: true,
            message: `تم ${action === 'add' ? 'إضافة' : action === 'remove' ? 'إزالة' : action === 'promote' ? 'ترقية' : 'تنزيل'} العضو بنجاح`,
            data: group
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// البحث عن مجموعات
exports.searchGroups = async (req, res) => {
    try {
        const { q, page = 1, limit = 10 } = req.query;
        
        const searchQuery = {
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } }
            ]
        };
        
        const groups = await Group.find(searchQuery)
            .populate('creator', 'username name avatar')
            .populate('members', 'username name avatar')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await Group.countDocuments(searchQuery);
        
        res.json({
            success: true,
            data: {
                groups,
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