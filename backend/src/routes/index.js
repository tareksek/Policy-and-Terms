const express = require('express');
const router = express.Router();

// استيراد جميع الـ routes
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const postRoutes = require('./post.routes');
const commentRoutes = require('./comment.routes');
const friendRoutes = require('./friend.routes');
const messageRoutes = require('./message.routes');
const notificationRoutes = require('./notification.routes');
const groupRoutes = require('./group.routes');
const storyRoutes = require('./story.routes');
const feedRoutes = require('./feed.routes');
const adminRoutes = require('./admin.routes');

// ربط الـ routes مع البادئة /api
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/posts', postRoutes);
router.use('/comments', commentRoutes);
router.use('/friends', friendRoutes);
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/groups', groupRoutes);
router.use('/stories', storyRoutes);
router.use('/feed', feedRoutes);
router.use('/admin', adminRoutes);

// صفحة هبوط API
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Social Media API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      posts: '/api/posts',
      comments: '/api/comments',
      friends: '/api/friends',
      messages: '/api/messages',
      notifications: '/api/notifications',
      groups: '/api/groups',
      stories: '/api/stories',
      feed: '/api/feed',
      admin: '/api/admin'
    }
  });
});

// التعامل مع 404
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

module.exports = router;