
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { cloudinary } = require('../utils/cloudinary');

class PostController {
    // Create post
    async createPost(req, res) {
        try {
            const userId = req.userId;
            const { content, privacy, groupId, isStory, tags, location } = req.body;

            const user = await User.findById(userId);

            // Check if user is blocked from posting in group
            if (groupId) {
                const Group = require('../models/Group');
                const group = await Group.findById(groupId);
                
                if (group && group.members.some(m => m.user.equals(user._id) && m.status === 'banned')) {
                    return res.status(403).json({
                        success: false,
                        error: 'أنت محظور من النشر في هذه المجموعة'
                    });
                }
            }

            // Process media files
            const media = [];
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const result = await cloudinary.uploader.upload(file.path, {
                        folder: `nexus/posts/${userId}`,
                        resource_type: 'auto'
                    });

                    media.push({
                        type: file.mimetype.startsWith('image') ? 'image' : 
                              file.mimetype.startsWith('video') ? 'video' : 'document',
                        url: result.secure_url,
                        thumbnail: result.mimetype.startsWith('image') ? result.secure_url : null,
                        filename: file.originalname,
                        size: file.size,
                        dimensions: result.width && result.height ? {
                            width: result.width,
                            height: result.height
                        } : undefined
                    });
                }
            }

            // Process tags
            let tagUsers = [];
            if (tags) {
                const tagUsernames = tags.split(',').map(tag => tag.trim().replace('@', ''));
                tagUsers = await User.find({ username: { $in: tagUsernames } })
                    .select('_id');
            }

            // Process location
            let locationData = null;
            if (location) {
                const loc = JSON.parse(location);
                locationData = {
                    type: 'Point',
                    coordinates: [loc.lng, loc.lat],
                    name: loc.name
                };
            }

            const post = new Post({
                author: userId,
                content,
                media,
                tags: tagUsers.map(user => user._id),
                location: locationData,
                privacy: privacy || 'public',
                group: groupId || null,
                isStory: isStory === 'true',
                storyDuration: isStory ? 24 : null
            });

            await post.save();

            // Create notifications for tagged users
            for (const taggedUser of tagUsers) {
                if (!taggedUser._id.equals(userId)) {
                    await Notification.create({
                        recipient: taggedUser._id,
                        sender: userId,
                        type: 'tagged',
                        title: 'تم الإشارة إليك في منشور',
                        message: `${user.profile.firstName} أشار إليك في منشور`,
                        data: { 
                            postId: post._id,
                            postType: isStory ? 'story' : 'post'
                        }
                    });
                }
            }

            // Populate post with author info
            const populatedPost = await Post.findById(post._id)
                .populate('author', 'username profile')
                .populate('tags', 'username profile');

            res.status(201).json({
                success: true,
                message: isStory ? 'تم نشر القصة بنجاح' : 'تم نشر المنشور بنجاح',
                data: populatedPost
            });

        } catch (error) {
            console.error('Create post error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إنشاء المنشور'
            });
        }
    }

    // Get feed
    async getFeed(req, res) {
        try {
            const userId = req.userId;
            const { page = 1, limit = 20, type = 'for-you' } = req.query;
            const skip = (page - 1) * limit;

            const user = await User.findById(userId);
            const friendIds = user.friends;

            let query = { isStory: false };

            if (type === 'following') {
                // Chronological feed from friends
                query.author = { $in: [...friendIds, userId] };
                query.group = null;
            } else if (type === 'discover') {
                // Discover new content (not from friends)
                query.author = { 
                    $nin: [...friendIds, userId, ...user.blockedUsers] 
                };
                query.privacy = 'public';
                query.group = null;
            } else {
                // For You - mixed algorithm
                query.$or = [
                    { author: { $in: [...friendIds, userId] } },
                    { 
                        author: { $nin: [...user.blockedUsers, userId] },
                        privacy: 'public'
                    }
                ];
                query.group = null;
            }

            // Don't show posts from blocked users
            query.author = { $nin: user.blockedUsers };

            // Get posts with pagination
            const posts = await Post.find(query)
                .populate('author', 'username profile')
                .populate('likes.user', 'username profile')
                .populate('tags', 'username profile')
                .populate({
                    path: 'comments',
                    options: { 
                        limit: 3, 
                        sort: { createdAt: -1 } 
                    },
                    populate: {
                        path: 'author',
                        select: 'username profile'
                    }
                })
                .sort(type === 'following' ? { createdAt: -1 } : { 
                    likes: -1, 
                    comments: -1, 
                    createdAt: -1 
                })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Post.countDocuments(query);

            // Add user-specific data (liked, saved, etc.)
            const postsWithUserData = await Promise.all(
                posts.map(async (post) => {
                    const userLiked = post.likes.some(like => 
                        like.user && like.user._id.equals(userId)
                    );
                    
                    const userReaction = userLiked ? 
                        post.likes.find(like => like.user._id.equals(userId)).reaction : 
                        null;

                    return {
                        ...post.toObject(),
                        userLiked,
                        userReaction,
                        likeCount: post.likes.length,
                        commentCount: post.comments.length,
                        shareCount: post.shares.length
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    posts: postsWithUserData,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get feed error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب التغذية'
            });
        }
    }

    // Get single post
    async getPost(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const post = await Post.findById(id)
                .populate('author', 'username profile')
                .populate('likes.user', 'username profile')
                .populate('tags', 'username profile')
                .populate({
                    path: 'comments',
                    populate: {
                        path: 'author',
                        select: 'username profile'
                    },
                    options: { sort: { createdAt: -1 } }
                });

            if (!post) {
                return res.status(404).json({
                    success: false,
                    error: 'المنشور غير موجود'
                });
            }

            // Check privacy
            const user = await User.findById(userId);
            if (post.privacy === 'private' && !post.author._id.equals(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'هذا المنشور خاص'
                });
            }

            if (post.privacy === 'friends' && 
                !post.author.friends.includes(userId) &&
                !post.author._id.equals(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'هذا المنشور للأصدقاء فقط'
                });
            }

            // Check if author blocked the viewer
            if (post.author.blockedUsers && post.author.blockedUsers.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'لا يمكنك عرض هذا المنشور'
                });
            }

            // Add user-specific data
            const userLiked = post.likes.some(like => 
                like.user && like.user._id.equals(userId)
            );
            
            const userReaction = userLiked ? 
                post.likes.find(like => like.user._id.equals(userId)).reaction : 
                null;

            res.json({
                success: true,
                data: {
                    ...post.toObject(),
                    userLiked,
                    userReaction,
                    likeCount: post.likes.length,
                    commentCount: post.comments.length,
                    shareCount: post.shares.length
                }
            });

        } catch (error) {
            console.error('Get post error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب المنشور'
            });
        }
    }

    // Update post
    async updatePost(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { content, privacy } = req.body;

            const post = await Post.findById(id);

            if (!post) {
                return res.status(404).json({
                    success: false,
                    error: 'المنشور غير موجود'
                });
            }

            // Check ownership
            if (!post.author.equals(userId)) {
                // Check if user is group admin
                if (post.group) {
                    const Group = require('../models/Group');
                    const group = await Group.findById(post.group);
                    
                    if (!group || 
                        (!group.admin.equals(userId) && 
                         !group.moderators.some(m => m.user.equals(userId)))) {
                        return res.status(403).json({
                            success: false,
                            error: 'ليس لديك صلاحية لتعديل هذا المنشور'
                        });
                    }
                } else {
                    return res.status(403).json({
                        success: false,
                        error: 'ليس لديك صلاحية لتعديل هذا المنشور'
                    });
                }
            }

            // Save edit history
            post.editHistory.push({
                content: post.content,
                editedAt: new Date()
            });

            post.content = content || post.content;
            post.privacy = privacy || post.privacy;
            post.edited = true;

            await post.save();

            const updatedPost = await Post.findById(post._id)
                .populate('author', 'username profile');

            res.json({
                success: true,
                message: 'تم تحديث المنشور بنجاح',
                data: updatedPost
            });

        } catch (error) {
            console.error('Update post error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تحديث المنشور'
            });
        }
    }

    // Delete post
    async deletePost(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const post = await Post.findById(id);

            if (!post) {
                return res.status(404).json({
                    success: false,
                    error: 'المنشور غير موجود'
                });
            }

            // Check ownership
            if (!post.author.equals(userId)) {
                // Check if user is group admin
                if (post.group) {
                    const Group = require('../models/Group');
                    const group = await Group.findById(post.group);
                    
                    if (!group || 
                        (!group.admin.equals(userId) && 
                         !group.moderators.some(m => m.user.equals(userId)))) {
                        return res.status(403).json({
                            success: false,
                            error: 'ليس لديك صلاحية لحذف هذا المنشور'
                        });
                    }
                } else {
                    return res.status(403).json({
                        success: false,
                        error: 'ليس لديك صلاحية لحذف هذا المنشور'
                    });
                }
            }

            // Delete media from Cloudinary
            for (const mediaItem of post.media) {
                if (mediaItem.url.includes('cloudinary')) {
                    const publicId = mediaItem.url
                        .split('/')
                        .slice(-2)
                        .join('/')
                        .split('.')[0];
                    
                    await cloudinary.uploader.destroy(publicId);
                }
            }

            // Delete associated comments
            await Comment.deleteMany({ post: id });

            // Delete associated notifications
            await Notification.deleteMany({ 'data.postId': id });

            await Post.findByIdAndDelete(id);

            res.json({
                success: true,
                message: 'تم حذف المنشور بنجاح'
            });

        } catch (error) {
            console.error('Delete post error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء حذف المنشور'
            });
        }
    }

    // Like/unlike post
    async likePost(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { reaction = 'like' } = req.body;

            const post = await Post.findById(id)
                .populate('author', 'username profile');

            if (!post) {
                return res.status(404).json({
                    success: false,
                    error: 'المنشور غير موجود'
                });
            }

            // Check if author blocked the user
            const author = await User.findById(post.author);
            if (author.blockedUsers.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'لا يمكنك التفاعل مع هذا المنشور'
                });
            }

            const likeIndex = post.likes.findIndex(
                like => like.user.equals(userId)
            );

            if (likeIndex > -1) {
                // Unlike if same reaction, otherwise update reaction
                if (post.likes[likeIndex].reaction === reaction) {
                    post.likes.splice(likeIndex, 1);
                } else {
                    post.likes[likeIndex].reaction = reaction;
                }
            } else {
                // Add like
                post.likes.push({
                    user: userId,
                    reaction
                });

                // Create notification for post author
                if (!post.author.equals(userId)) {
                    const user = await User.findById(userId);
                    
                    await Notification.create({
                        recipient: post.author,
                        sender: userId,
                        type: post.isStory ? 'story_like' : 'post_like',
                        title: post.isStory ? 'إعجاب جديد بقصتك' : 'إعجاب جديد بمنشورك',
                        message: `${user.profile.firstName} أعجب ${post.isStory ? 'بقصتك' : 'بمنشورك'}`,
                        data: { 
                            postId: post._id, 
                            reaction,
                            postType: post.isStory ? 'story' : 'post'
                        }
                    });
                }
            }

            await post.save();

            // Get updated likes with user info
            const updatedPost = await Post.findById(post._id)
                .populate('likes.user', 'username profile');

            res.json({
                success: true,
                message: likeIndex > -1 ? 
                    (post.likes[likeIndex] ? 'تم تغيير رد الفعل' : 'تم إلغاء الإعجاب') : 
                    'تم الإعجاب بالمنشور',
                data: {
                    likes: updatedPost.likes,
                    likeCount: updatedPost.likes.length,
                    userLiked: likeIndex === -1 || post.likes[likeIndex],
                    userReaction: likeIndex === -1 ? null : (post.likes[likeIndex] ? reaction : null)
                }
            });

        } catch (error) {
            console.error('Like post error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء التفاعل مع المنشور'
            });
        }
    }

    // Comment on post
    async commentOnPost(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { content, parentCommentId } = req.body;

            const post = await Post.findById(id);

            if (!post) {
                return res.status(404).json({
                    success: false,
                    error: 'المنشور غير موجود'
                });
            }

            // Check if author blocked the user
            const author = await User.findById(post.author);
            if (author.blockedUsers.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'لا يمكنك التعليق على هذا المنشور'
                });
            }

            const comment = new Comment({
                author: userId,
                post: post._id,
                content,
                parentComment: parentCommentId || null
            });

            await comment.save();

            // Add comment to post
            post.comments.push(comment._id);
            await post.save();

            // Populate comment with author info
            const populatedComment = await Comment.findById(comment._id)
                .populate('author', 'username profile')
                .populate({
                    path: 'replies',
                    populate: {
                        path: 'author',
                        select: 'username profile'
                    }
                });

            // Create notification for post author
            if (!post.author.equals(userId)) {
                const user = await User.findById(userId);
                
                await Notification.create({
                    recipient: post.author,
                    sender: userId,
                    type: parentCommentId ? 'comment_reply' : 'post_comment',
                    title: parentCommentId ? 'رد جديد على تعليقك' : 'تعليق جديد على منشورك',
                    message: `${user.profile.firstName} ${parentCommentId ? 'رد على تعليقك' : 'علق على منشورك'}`,
                    data: { 
                        postId: post._id, 
                        commentId: comment._id,
                        parentCommentId: parentCommentId || null,
                        postType: post.isStory ? 'story' : 'post'
                    }
                });
            }

            // Also notify parent comment author if this is a reply
            if (parentCommentId) {
                const parentComment = await Comment.findById(parentCommentId);
                if (parentComment && !parentComment.author.equals(userId)) {
                    const user = await User.findById(userId);
                    
                    await Notification.create({
                        recipient: parentComment.author,
                        sender: userId,
                        type: 'comment_reply',
                        title: 'رد جديد على تعليقك',
                        message: `${user.profile.firstName} رد على تعليقك`,
                        data: { 
                            postId: post._id, 
                            commentId: comment._id,
                            parentCommentId 
                        }
                    });
                }
            }

            res.status(201).json({
                success: true,
                message: 'تم إضافة التعليق بنجاح',
                data: populatedComment
            });

        } catch (error) {
            console.error('Comment on post error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إضافة التعليق'
            });
        }
    }

    // Share post
    async sharePost(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { content } = req.body;

            const originalPost = await Post.findById(id);

            if (!originalPost) {
                return res.status(404).json({
                    success: false,
                    error: 'المنشور غير موجود'
                });
            }

            // Check if post can be shared
            if (originalPost.privacy === 'private' && 
                !originalPost.author.equals(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'لا يمكنك مشاركة هذا المنشور'
                });
            }

            // Check if author blocked the user
            const author = await User.findById(originalPost.author);
            if (author.blockedUsers.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'لا يمكنك مشاركة هذا المنشور'
                });
            }

            const sharedPost = new Post({
                author: userId,
                content: content || `مشاركة: ${originalPost.content.substring(0, 100)}...`,
                privacy: 'public',
                shares: [{
                    user: userId,
                    sharedAt: new Date()
                }],
                metadata: {
                    isShared: true,
                    originalPost: originalPost._id,
                    sharedFrom: originalPost.author
                }
            });

            await sharedPost.save();

            // Add share to original post
            originalPost.shares.push({
                user: userId,
                sharedAt: new Date()
            });
            await originalPost.save();

            // Create notification for original post author
            if (!originalPost.author.equals(userId)) {
                const user = await User.findById(userId);
                
                await Notification.create({
                    recipient: originalPost.author,
                    sender: userId,
                    type: 'post_share',
                    title: 'تم مشاركة منشورك',
                    message: `${user.profile.firstName} شارك منشورك`,
                    data: { 
                        postId: originalPost._id, 
                        sharedPostId: sharedPost._id 
                    }
                });
            }

            const populatedPost = await Post.findById(sharedPost._id)
                .populate('author', 'username profile');

            res.status(201).json({
                success: true,
                message: 'تم مشاركة المنشور بنجاح',
                data: populatedPost
            });

        } catch (error) {
            console.error('Share post error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء مشاركة المنشور'
            });
        }
    }

    // Get stories
    async getStories(req, res) {
        try {
            const userId = req.userId;
            const user = await User.findById(userId);
            const friendIds = user.friends;

            // Get stories from friends in last 24 hours
            const stories = await Post.find({
                isStory: true,
                author: { $in: friendIds },
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            })
            .populate('author', 'username profile')
            .sort({ createdAt: -1 });

            // Group stories by author
            const groupedStories = stories.reduce((acc, story) => {
                const authorId = story.author._id.toString();
                if (!acc[authorId]) {
                    acc[authorId] = {
                        author: story.author,
                        stories: []
                    };
                }
                acc[authorId].stories.push(story);
                return acc;
            }, {});

            // Add viewer info
            const storiesWithViewerInfo = Object.values(groupedStories).map(group => ({
                ...group,
                stories: group.stories.map(story => ({
                    ...story.toObject(),
                    viewed: story.storyViews.some(view => view.user.equals(userId))
                }))
            }));

            res.json({
                success: true,
                data: storiesWithViewerInfo
            });

        } catch (error) {
            console.error('Get stories error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب القصص'
            });
        }
    }

    // View story
    async viewStory(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const story = await Post.findById(id);

            if (!story || !story.isStory) {
                return res.status(404).json({
                    success: false,
                    error: 'القصة غير موجودة'
                });
            }

            // Check if already viewed
            const alreadyViewed = story.storyViews.some(
                view => view.user.equals(userId)
            );

            if (!alreadyViewed) {
                story.storyViews.push({
                    user: userId,
                    viewedAt: new Date()
                });

                await story.save();

                // Create notification for story author
                if (!story.author.equals(userId)) {
                    const user = await User.findById(userId);
                    
                    await Notification.create({
                        recipient: story.author,
                        sender: userId,
                        type: 'story_view',
                        title: 'مشاهدة جديدة لقصتك',
                        message: `${user.profile.firstName} شاهد قصتك`,
                        data: { storyId: story._id }
                    });
                }
            }

            res.json({
                success: true,
                message: 'تم تسجيل المشاهدة'
            });

        } catch (error) {
            console.error('View story error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تسجيل المشاهدة'
            });
        }
    }

    // Pin/unpin post
    async pinPost(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const post = await Post.findById(id);

            if (!post) {
                return res.status(404).json({
                    success: false,
                    error: 'المنشور غير موجود'
                });
            }

            // Check ownership
            if (!post.author.equals(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لتثبيت هذا المنشور'
                });
            }

            let message;
            if (post.pinned) {
                post.pinned = false;
                message = 'تم إلغاء تثبيت المنشور';
            } else {
                // Unpin all other posts
                await Post.updateMany(
                    { author: userId, pinned: true },
                    { pinned: false }
                );
                post.pinned = true;
                message = 'تم تثبيت المنشور';
            }

            await post.save();

            res.json({
                success: true,
                message,
                data: { pinned: post.pinned }
            });

        } catch (error) {
            console.error('Pin post error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تثبيت المنشور'
            });
        }
    }

    // Get post analytics
    async getPostAnalytics(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const post = await Post.findById(id);

            if (!post) {
                return res.status(404).json({
                    success: false,
                    error: 'المنشور غير موجود'
                });
            }

            // Check ownership
            if (!post.author.equals(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لعرض إحصائيات هذا المنشور'
                });
            }

            // Get detailed analytics
            const analytics = {
                views: post.storyViews ? post.storyViews.length : 0,
                likes: post.likes.length,
                comments: post.comments.length,
                shares: post.shares.length,
                reach: post.likes.length + post.comments.length + post.shares.length,
                engagementRate: ((post.likes.length + post.comments.length + post.shares.length) / 
                                (post.storyViews ? post.storyViews.length : 1) * 100).toFixed(2)
            };

            // Get top engagers
            const topEngagers = [...post.likes, ...post.shares]
                .slice(0, 10)
                .map(engagement => ({
                    userId: engagement.user,
                    type: engagement.reaction ? 'like' : 'share',
                    timestamp: engagement.createdAt || engagement.sharedAt
                }));

            res.json({
                success: true,
                data: {
                    analytics,
                    topEngagers
                }
            });

        } catch (error) {
            console.error('Get post analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب إحصائيات المنشور'
            });
        }
    }
}

module.exports = new PostController();
