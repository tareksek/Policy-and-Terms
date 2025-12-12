const Post = require('../models/Post');
const User = require('../models/User');

// إنشاء منشور جديد
exports.createPost = async (req, res) => {
    try {
        const { content, privacy = 'public', media } = req.body;
        const userId = req.user.id;
        
        const post = await Post.create({
            content,
            privacy,
            media,
            user: userId
        });
        
        // Populate بيانات المستخدم
        await post.populate('user', 'username name avatar');
        
        res.status(201).json({
            success: true,
            message: 'تم إنشاء المنشور بنجاح',
            data: post
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// عرض جميع المنشورات (newsfeed)
exports.getAllPosts = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;
        
        // الحصول على أصدقاء المستخدم
        const user = await User.findById(userId).select('friends following');
        const friendsIds = [...user.friends, ...user.following, userId];
        
        const posts = await Post.find({
            $or: [
                { privacy: 'public' },
                { 
                    privacy: 'friends',
                    user: { $in: friendsIds }
                },
                { user: userId }
            ]
        })
        .populate('user', 'username name avatar')
        .populate('likes', 'username name')
        .populate({
            path: 'comments',
            populate: {
                path: 'user',
                select: 'username name avatar'
            },
            options: { limit: 3 }
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
        
        const total = await Post.countDocuments({
            $or: [
                { privacy: 'public' },
                { 
                    privacy: 'friends',
                    user: { $in: friendsIds }
                },
                { user: userId }
            ]
        });
        
        res.json({
            success: true,
            data: {
                posts,
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

// عرض منشورات مستخدم محدد
exports.getUserPosts = async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const currentUserId = req.user.id;
        const { page = 1, limit = 10 } = req.query;
        
        // التحقق من الصلاحية لعرض المنشورات
        const targetUser = await User.findById(targetUserId);
        const isFriend = targetUser.friends.includes(currentUserId);
        const isFollowing = targetUser.followers.includes(currentUserId);
        
        let query = { user: targetUserId };
        
        if (targetUserId !== currentUserId) {
            if (isFriend || isFollowing) {
                query.$or = [
                    { privacy: { $in: ['public', 'friends'] } },
                    { user: targetUserId }
                ];
            } else {
                query.privacy = 'public';
            }
        }
        
        const posts = await Post.find(query)
            .populate('user', 'username name avatar')
            .populate('likes', 'username name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await Post.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                posts,
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

// عرض منشور واحد
exports.getPost = async (req, res) => {
    try {
        const postId = req.params.id;
        
        const post = await Post.findById(postId)
            .populate('user', 'username name avatar')
            .populate('likes', 'username name avatar')
            .populate({
                path: 'comments',
                populate: {
                    path: 'user',
                    select: 'username name avatar'
                }
            });
        
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'المنشور غير موجود'
            });
        }
        
        res.json({
            success: true,
            data: post
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// تعديل منشور
exports.updatePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.id;
        const updates = req.body;
        
        // التحقق من ملكية المنشور
        const post = await Post.findById(postId);
        
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'المنشور غير موجود'
            });
        }
        
        if (post.user.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'ليس لديك صلاحية لتعديل هذا المنشور'
            });
        }
        
        const updatedPost = await Post.findByIdAndUpdate(
            postId,
            { $set: updates },
            { new: true, runValidators: true }
        ).populate('user', 'username name avatar');
        
        res.json({
            success: true,
            message: 'تم تحديث المنشور بنجاح',
            data: updatedPost
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// حذف منشور
exports.deletePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.id;
        
        // التحقق من ملكية المنشور
        const post = await Post.findById(postId);
        
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'المنشور غير موجود'
            });
        }
        
        if (post.user.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'ليس لديك صلاحية لحذف هذا المنشور'
            });
        }
        
        await Post.findByIdAndDelete(postId);
        
        res.json({
            success: true,
            message: 'تم حذف المنشور بنجاح'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// الإعجاب بالمنشور
exports.likePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.id;
        
        const post = await Post.findById(postId);
        
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'المنشور غير موجود'
            });
        }
        
        // التحقق إذا كان المستخدم معجب بالفعل
        if (post.likes.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: 'لقد أعجبت بهذا المنشور بالفعل'
            });
        }
        
        post.likes.push(userId);
        await post.save();
        
        res.json({
            success: true,
            message: 'تم الإعجاب بالمنشور',
            data: {
                likesCount: post.likes.length
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

// إزالة الإعجاب
exports.unlikePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.id;
        
        const post = await Post.findById(postId);
        
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'المنشور غير موجود'
            });
        }
        
        // التحقق إذا كان المستخدم معجب بالفعل
        if (!post.likes.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: 'لم تعجب بهذا المنشور من قبل'
            });
        }
        
        post.likes = post.likes.filter(id => id.toString() !== userId);
        await post.save();
        
        res.json({
            success: true,
            message: 'تم إزالة الإعجاب',
            data: {
                likesCount: post.likes.length
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