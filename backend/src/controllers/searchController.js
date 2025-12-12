const User = require('../models/User');
const Post = require('../models/Post');
const Group = require('../models/Group');

// بحث عام
exports.globalSearch = async (req, res) => {
    try {
        const { q, type = 'all', page = 1, limit = 10 } = req.query;
        
        if (!q || q.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'يرجى إدخال مصطلح البحث'
            });
        }
        
        const searchTerm = q.trim();
        let results = {};
        let total = 0;
        
        // البحث في المستخدمين
        if (type === 'all' || type === 'users') {
            const users = await User.find({
                $or: [
                    { username: { $regex: searchTerm, $options: 'i' } },
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { bio: { $regex: searchTerm, $options: 'i' } }
                ]
            })
            .select('username name avatar bio followers following')
            .skip(type === 'all' ? 0 : (page - 1) * limit)
            .limit(type === 'all' ? 5 : parseInt(limit));
            
            const usersCount = await User.countDocuments({
                $or: [
                    { username: { $regex: searchTerm, $options: 'i' } },
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { bio: { $regex: searchTerm, $options: 'i' } }
                ]
            });
            
            results.users = users;
            if (type === 'users') total = usersCount;
        }
        
        // البحث في المنشورات
        if (type === 'all' || type === 'posts') {
            const posts = await Post.find({
                content: { $regex: searchTerm, $options: 'i' },
                privacy: 'public'
            })
            .populate('user', 'username name avatar')
            .sort({ createdAt: -1 })
            .skip(type === 'all' ? 0 : (page - 1) * limit)
            .limit(type === 'all' ? 5 : parseInt(limit));
            
            const postsCount = await Post.countDocuments({
                content: { $regex: searchTerm, $options: 'i' },
                privacy: 'public'
            });
            
            results.posts = posts;
            if (type === 'posts') total = postsCount;
        }
        
        // البحث في المجموعات
        if (type === 'all' || type === 'groups') {
            const groups = await Group.find({
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { description: { $regex: searchTerm, $options: 'i' } }
                ],
                privacy: 'public'
            })
            .populate('creator', 'username name avatar')
            .populate('members', 'username name avatar')
            .skip(type === 'all' ? 0 : (page - 1) * limit)
            .limit(type === 'all' ? 5 : parseInt(limit));
            
            const groupsCount = await Group.countDocuments({
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { description: { $regex: searchTerm, $options: 'i' } }
                ],
                privacy: 'public'
            });
            
            results.groups = groups;
            if (type === 'groups') total = groupsCount;
        }
        
        // البحث باستخدام الهاشتاجات
        if (type === 'all' || type === 'hashtags') {
            const hashtag = searchTerm.startsWith('#') ? searchTerm : `#${searchTerm}`;
            
            const hashtagPosts = await Post.find({
                content: { $regex: hashtag, $options: 'i' },
                privacy: 'public'
            })
            .populate('user', 'username name avatar')
            .sort({ createdAt: -1 })
            .skip(type === 'all' ? 0 : (page - 1) * limit)
            .limit(type === 'all' ? 5 : parseInt(limit));
            
            const hashtagCount = await Post.countDocuments({
                content: { $regex: hashtag, $options: 'i' },
                privacy: 'public'
            });
            
            results.hashtags = hashtagPosts;
            if (type === 'hashtags') total = hashtagCount;
        }
        
        if (type === 'all') {
            res.json({
                success: true,
                data: results
            });
        } else {
            res.json({
                success: true,
                data: {
                    results: results[type],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// بحث في المستخدمين
exports.searchUsers = async (req, res) => {
    try {
        const { q, page = 1, limit = 20 } = req.query;
        
        if (!q || q.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'يرجى إدخال مصطلح البحث'
            });
        }
        
        const searchTerm = q.trim();
        
        const users = await User.find({
            $or: [
                { username: { $regex: searchTerm, $options: 'i' } },
                { name: { $regex: searchTerm, $options: 'i' } },
                { email: { $regex: searchTerm, $options: 'i' } },
                { bio: { $regex: searchTerm, $options: 'i' } }
            ]
        })
        .select('username name avatar bio followers following')
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
        
        const total = await User.countDocuments({
            $or: [
                { username: { $regex: searchTerm, $options: 'i' } },
                { name: { $regex: searchTerm, $options: 'i' } },
                { email: { $regex: searchTerm, $options: 'i' } },
                { bio: { $regex: searchTerm, $options: 'i' } }
            ]
        });
        
        res.json({
            success: true,
            data: {
                users,
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

// بحث في المنشورات
exports.searchPosts = async (req, res) => {
    try {
        const { q, page = 1, limit = 20 } = req.query;
        const userId = req.user.id;
        
        if (!q || q.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'يرجى إدخال مصطلح البحث'
            });
        }
        
        const searchTerm = q.trim();
        
        // الحصول على أصدقاء المستخدم
        const user = await User.findById(userId).select('friends following');
        const friendsIds = [...user.friends, ...user.following, userId];
        
        const posts = await Post.find({
            content: { $regex: searchTerm, $options: 'i' },
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
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
        
        const total = await Post.countDocuments({
            content: { $regex: searchTerm, $options: 'i' },
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

// البحث باستخدام الهاشتاجات
exports.searchHashtags = async (req, res) => {
    try {
        const { hashtag, page = 1, limit = 20 } = req.query;
        const userId = req.user.id;
        
        if (!hashtag || hashtag.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'يرجى إدخال هاشتاج للبحث'
            });
        }
        
        const searchHashtag = hashtag.trim().startsWith('#') ? hashtag.trim() : `#${hashtag.trim()}`;
        
        // الحصول على أصدقاء المستخدم
        const user = await User.findById(userId).select('friends following');
        const friendsIds = [...user.friends, ...user.following, userId];
        
        const posts = await Post.find({
            content: { $regex: searchHashtag, $options: 'i' },
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
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
        
        const total = await Post.countDocuments({
            content: { $regex: searchHashtag, $options: 'i' },
            $or: [
                { privacy: 'public' },
                { 
                    privacy: 'friends',
                    user: { $in: friendsIds }
                },
                { user: userId }
            ]
        });
        
        // استخراج الهاشتاجات الشائعة
        const allPosts = await Post.find({ privacy: 'public' });
        const hashtagCounts = {};
        
        allPosts.forEach(post => {
            const hashtags = post.content.match(/#\w+/g) || [];
            hashtags.forEach(tag => {
                const cleanTag = tag.toLowerCase();
                hashtagCounts[cleanTag] = (hashtagCounts[cleanTag] || 0) + 1;
            });
        });
        
        // ترتيب الهاشتاجات حسب الشعبية
        const trendingHashtags = Object.entries(hashtagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag, count]) => ({ tag, count }));
        
        res.json({
            success: true,
            data: {
                posts,
                hashtag: searchHashtag,
                trendingHashtags,
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