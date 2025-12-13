
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');

class CommentController {
    // Get comment
    async getComment(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const comment = await Comment.findById(id)
                .populate('author', 'username profile')
                .populate({
                    path: 'replies',
                    populate: {
                        path: 'author',
                        select: 'username profile'
                    },
                    options: { sort: { createdAt: -1 } }
                });

            if (!comment) {
                return res.status(404).json({
                    success: false,
                    error: 'التعليق غير موجود'
                });
            }

            // Check if post is accessible
            const post = await Post.findById(comment.post);
            const author = await User.findById(post.author);

            // Check if author blocked the user
            if (author.blockedUsers.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'لا يمكنك عرض هذا التعليق'
                });
            }

            // Add user-specific data
            const userLiked = comment.likes.some(like => 
                like.user && like.user.equals(userId)
            );

            res.json({
                success: true,
                data: {
                    ...comment.toObject(),
                    userLiked,
                    likeCount: comment.likes.length,
                    replyCount: comment.replies.length
                }
            });

        } catch (error) {
            console.error('Get comment error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب التعليق'
            });
        }
    }

    // Update comment
    async updateComment(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { content } = req.body;

            const comment = await Comment.findById(id);

            if (!comment) {
                return res.status(404).json({
                    success: false,
                    error: 'التعليق غير موجود'
                });
            }

            // Check ownership
            if (!comment.author.equals(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لتعديل هذا التعليق'
                });
            }

            // Save edit history
            comment.editHistory.push({
                content: comment.content,
                editedAt: new Date()
            });

            comment.content = content;
            comment.edited = true;

            await comment.save();

            const updatedComment = await Comment.findById(comment._id)
                .populate('author', 'username profile');

            res.json({
                success: true,
                message: 'تم تعديل التعليق بنجاح',
                data: updatedComment
            });

        } catch (error) {
            console.error('Update comment error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تعديل التعليق'
            });
        }
    }

    // Delete comment
    async deleteComment(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const comment = await Comment.findById(id);

            if (!comment) {
                return res.status(404).json({
                    success: false,
                    error: 'التعليق غير موجود'
                });
            }

            // Check permissions
            const post = await Post.findById(comment.post);
            const isCommentAuthor = comment.author.equals(userId);
            const isPostAuthor = post.author.equals(userId);
            
            if (!isCommentAuthor && !isPostAuthor) {
                // Check if user is group admin/moderator
                if (post.group) {
                    const Group = require('../models/Group');
                    const group = await Group.findById(post.group);
                    
                    if (!group || 
                        (!group.admin.equals(userId) && 
                         !group.moderators.some(m => m.user.equals(userId)))) {
                        return res.status(403).json({
                            success: false,
                            error: 'ليس لديك صلاحية لحذف هذا التعليق'
                        });
                    }
                } else {
                    return res.status(403).json({
                        success: false,
                        error: 'ليس لديك صلاحية لحذف هذا التعليق'
                    });
                }
            }

            // Soft delete
            comment.isDeleted = true;
            await comment.save();

            // Remove from post's comments array
            await Post.findByIdAndUpdate(comment.post, {
                $pull: { comments: comment._id }
            });

            // Delete associated notifications
            await Notification.deleteMany({ 'data.commentId': comment._id });

            res.json({
                success: true,
                message: 'تم حذف التعليق بنجاح'
            });

        } catch (error) {
            console.error('Delete comment error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء حذف التعليق'
            });
        }
    }

    // Like comment
    async likeComment(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const comment = await Comment.findById(id)
                .populate('author', 'username profile');

            if (!comment) {
                return res.status(404).json({
                    success: false,
                    error: 'التعليق غير موجود'
                });
            }

            // Check if post author blocked the user
            const post = await Post.findById(comment.post);
            const postAuthor = await User.findById(post.author);
            if (postAuthor.blockedUsers.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'لا يمكنك التفاعل مع هذا التعليق'
                });
            }

            const likeIndex = comment.likes.findIndex(
                like => like.user.equals(userId)
            );

            if (likeIndex > -1) {
                // Unlike
                comment.likes.splice(likeIndex, 1);
            } else {
                // Add like
                comment.likes.push({
                    user: userId,
                    createdAt: new Date()
                });

                // Create notification for comment author
                if (!comment.author.equals(userId)) {
                    const user = await User.findById(userId);
                    
                    await Notification.create({
                        recipient: comment.author,
                        sender: userId,
                        type: 'comment_like',
                        title: 'إعجاب جديد بتعليقك',
                        message: `${user.profile.firstName} أعجب بتعليقك`,
                        data: { 
                            commentId: comment._id,
                            postId: comment.post
                        }
                    });
                }
            }

            await comment.save();

            // Get updated likes
            const updatedComment = await Comment.findById(comment._id)
                .populate('likes.user', 'username profile');

            res.json({
                success: true,
                message: likeIndex > -1 ? 'تم إلغاء الإعجاب' : 'تم الإعجاب بالتعليق',
                data: {
                    likes: updatedComment.likes,
                    likeCount: updatedComment.likes.length,
                    userLiked: likeIndex === -1
                }
            });

        } catch (error) {
            console.error('Like comment error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء التفاعل مع التعليق'
            });
        }
    }

    // Get comment replies
    async getCommentReplies(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const skip = (page - 1) * limit;

            const comment = await Comment.findById(id);

            if (!comment) {
                return res.status(404).json({
                    success: false,
                    error: 'التعليق غير موجود'
                });
            }

            // Check if post is accessible
            const post = await Post.findById(comment.post);
            const author = await User.findById(post.author);

            // Check if author blocked the user
            if (author.blockedUsers.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'لا يمكنك عرض ردود هذا التعليق'
                });
            }

            const replies = await Comment.find({
                parentComment: id,
                isDeleted: false
            })
            .populate('author', 'username profile')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

            const total = await Comment.countDocuments({
                parentComment: id,
                isDeleted: false
            });

            // Add user-specific data
            const repliesWithUserData = await Promise.all(
                replies.map(async (reply) => {
                    const userLiked = reply.likes.some(like => 
                        like.user && like.user.equals(userId)
                    );

                    return {
                        ...reply.toObject(),
                        userLiked,
                        likeCount: reply.likes.length
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    replies: repliesWithUserData,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get comment replies error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب ردود التعليق'
            });
        }
    }
}

module.exports = new CommentController();
