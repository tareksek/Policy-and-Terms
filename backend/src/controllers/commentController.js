const Comment = require('../models/Comment');
const Post = require('../models/Post');

// إضافة تعليق
exports.addComment = async (req, res) => {
    try {
        const postId = req.params.postId;
        const { content } = req.body;
        const userId = req.user.id;
        
        // التحقق من وجود المنشور
        const post = await Post.findById(postId);
        
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'المنشور غير موجود'
            });
        }
        
        // إنشاء التعليق
        const comment = await Comment.create({
            content,
            user: userId,
            post: postId
        });
        
        // إضافة التعليق للمنشور
        post.comments.push(comment._id);
        await post.save();
        
        // Populate بيانات المستخدم
        await comment.populate('user', 'username name avatar');
        
        res.status(201).json({
            success: true,
            message: 'تم إضافة التعليق بنجاح',
            data: comment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// عرض تعليقات المنشور
exports.getComments = async (req, res) => {
    try {
        const postId = req.params.postId;
        const { page = 1, limit = 20 } = req.query;
        
        const comments = await Comment.find({ post: postId })
            .populate('user', 'username name avatar')
            .populate('likes', 'username name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await Comment.countDocuments({ post: postId });
        
        res.json({
            success: true,
            data: {
                comments,
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

// تعديل تعليق
exports.updateComment = async (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.user.id;
        const { content } = req.body;
        
        const comment = await Comment.findById(commentId);
        
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'التعليق غير موجود'
            });
        }
        
        // التحقق من ملكية التعليق
        if (comment.user.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'ليس لديك صلاحية لتعديل هذا التعليق'
            });
        }
        
        comment.content = content;
        comment.edited = true;
        await comment.save();
        
        await comment.populate('user', 'username name avatar');
        
        res.json({
            success: true,
            message: 'تم تعديل التعليق بنجاح',
            data: comment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// حذف تعليق
exports.deleteComment = async (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.user.id;
        
        const comment = await Comment.findById(commentId);
        
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'التعليق غير موجود'
            });
        }
        
        // التحقق من ملكية التعليق أو ملكية المنشور
        const post = await Post.findById(comment.post);
        const isPostOwner = post.user.toString() === userId;
        const isCommentOwner = comment.user.toString() === userId;
        
        if (!isCommentOwner && !isPostOwner) {
            return res.status(403).json({
                success: false,
                message: 'ليس لديك صلاحية لحذف هذا التعليق'
            });
        }
        
        // إزالة التعليق من المنشور
        await Post.findByIdAndUpdate(comment.post, {
            $pull: { comments: commentId }
        });
        
        await Comment.findByIdAndDelete(commentId);
        
        res.json({
            success: true,
            message: 'تم حذف التعليق بنجاح'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// الإعجاب بالتعليق
exports.likeComment = async (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.user.id;
        
        const comment = await Comment.findById(commentId);
        
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'التعليق غير موجود'
            });
        }
        
        if (comment.likes.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: 'لقد أعجبت بهذا التعليق بالفعل'
            });
        }
        
        comment.likes.push(userId);
        await comment.save();
        
        res.json({
            success: true,
            message: 'تم الإعجاب بالتعليق',
            data: {
                likesCount: comment.likes.length
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

// إزالة الإعجاب عن التعليق
exports.unlikeComment = async (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.user.id;
        
        const comment = await Comment.findById(commentId);
        
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'التعليق غير موجود'
            });
        }
        
        if (!comment.likes.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: 'لم تعجب بهذا التعليق من قبل'
            });
        }
        
        comment.likes = comment.likes.filter(id => id.toString() !== userId);
        await comment.save();
        
        res.json({
            success: true,
            message: 'تم إزالة الإعجاب',
            data: {
                likesCount: comment.likes.length
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