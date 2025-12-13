const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { cloudinary } = require('../utils/cloudinary');

// Create post
router.post('/', auth, upload.array('media', 10), async (req, res) => {
  try {
    const { content, privacy, groupId, isStory, tags } = req.body;
    const user = await User.findById(req.userId);

    // Check if user is blocked from posting in group
    if (groupId) {
      const Group = require('../models/Group');
      const group = await Group.findById(groupId);
      
      if (group && group.members.some(m => m.user.equals(user._id) && m.status === 'banned')) {
        return res.status(403).json({ error: 'You are banned from this group' });
      }
    }

    // Process media files
    const media = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: `nexus/posts/${req.userId}`,
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

    const post = new Post({
      author: req.userId,
      content,
      media,
      tags: tagUsers.map(user => user._id),
      privacy: privacy || 'public',
      group: groupId || null,
      isStory: isStory === 'true'
    });

    await post.save();

    // Create notifications for tagged users
    for (const taggedUser of tagUsers) {
      if (!taggedUser._id.equals(req.userId)) {
        await Notification.create({
          recipient: taggedUser._id,
          sender: req.userId,
          type: 'tagged',
          title: 'You were tagged in a post',
          message: `${user.profile.firstName} tagged you in a post`,
          data: { postId: post._id }
        });
      }
    }

    // Populate post with author info
    const populatedPost = await Post.findById(post._id)
      .populate('author', 'username profile')
      .populate('tags', 'username profile');

    res.status(201).json(populatedPost);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get feed
router.get('/feed', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, type = 'for-you' } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.userId);

    // Get friend IDs
    const friendIds = user.friends;

    let query = {};

    if (type === 'following') {
      // Chronological feed from friends
      query = {
        $or: [
          { author: { $in: friendIds } },
          { author: req.userId }
        ],
        group: null,
        isStory: false
      };
    } else if (type === 'discover') {
      // Discover new content (not from friends)
      query = {
        author: { $nin: [...friendIds, req.userId] },
        privacy: 'public',
        group: null,
        isStory: false
      };
    } else {
      // For You - mixed algorithm
      query = {
        $or: [
          { author: { $in: friendIds } },
          { author: req.userId },
          { privacy: 'public' }
        ],
        group: null,
        isStory: false
      };
    }

    // Don't show posts from blocked users
    if (user.blockedUsers.length > 0) {
      query.author = { $nin: user.blockedUsers };
    }

    const posts = await Post.find(query)
      .populate('author', 'username profile')
      .populate('likes.user', 'username profile')
      .populate({
        path: 'comments',
        options: { limit: 3, sort: { createdAt: -1 } },
        populate: {
          path: 'author',
          select: 'username profile'
        }
      })
      .sort(type === 'following' ? { createdAt: -1 } : { likes: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments(query);

    res.json({
      posts,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      type
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single post
router.get('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username profile')
      .populate('likes.user', 'username profile')
      .populate({
        path: 'comments',
        populate: {
          path: 'author',
          select: 'username profile'
        }
      })
      .populate('tags', 'username profile');

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check privacy
    const user = await User.findById(req.userId);
    if (post.privacy === 'private' && !post.author._id.equals(user._id)) {
      return res.status(403).json({ error: 'This post is private' });
    }

    if (post.privacy === 'friends' && 
        !post.author.friends.includes(user._id) &&
        !post.author._id.equals(user._id)) {
      return res.status(403).json({ error: 'This post is for friends only' });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update post
router.put('/:id', auth, async (req, res) => {
  try {
    const { content, privacy } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check ownership
    if (!post.author.equals(req.userId)) {
      return res.status(403).json({ error: 'Not authorized' });
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

    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete post
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check ownership
    if (!post.author.equals(req.userId)) {
      // Check if user is group admin
      if (post.group) {
        const Group = require('../models/Group');
        const group = await Group.findById(post.group);
        
        if (!group || 
            (!group.admin.equals(req.userId) && 
             !group.moderators.some(m => m.user.equals(req.userId)))) {
          return res.status(403).json({ error: 'Not authorized' });
        }
      } else {
        return res.status(403).json({ error: 'Not authorized' });
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

    await Post.findByIdAndDelete(req.params.id);

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Like/unlike post
router.post('/:id/like', auth, async (req, res) => {
  try {
    const { reaction = 'like' } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const likeIndex = post.likes.findIndex(
      like => like.user.equals(req.userId)
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
        user: req.userId,
        reaction
      });

      // Create notification for post author
      if (!post.author.equals(req.userId)) {
        const user = await User.findById(req.userId);
        
        await Notification.create({
          recipient: post.author,
          sender: req.userId,
          type: 'post_like',
          title: 'New Like',
          message: `${user.profile.firstName} reacted to your post`,
          data: { postId: post._id, reaction }
        });
      }
    }

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate('likes.user', 'username profile');

    res.json(updatedPost.likes);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Comment on post
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { content, parentCommentId } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const Comment = require('../models/Comment');
    const comment = new Comment({
      author: req.userId,
      post: post._id,
      content,
      parentComment: parentCommentId || null
    });

    await comment.save();

    // Add comment to post
    post.comments.push(comment._id);
    await post.save();

    // Create notification for post author
    if (!post.author.equals(req.userId)) {
      const user = await User.findById(req.userId);
      
      await Notification.create({
        recipient: post.author,
        sender: req.userId,
        type: parentCommentId ? 'comment_reply' : 'post_comment',
        title: parentCommentId ? 'New Reply' : 'New Comment',
        message: `${user.profile.firstName} ${parentCommentId ? 'replied to your comment' : 'commented on your post'}`,
        data: { 
          postId: post._id, 
          commentId: comment._id,
          parentCommentId: parentCommentId || null
        }
      });
    }

    // Also notify parent comment author if this is a reply
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (parentComment && !parentComment.author.equals(req.userId)) {
        const user = await User.findById(req.userId);
        
        await Notification.create({
          recipient: parentComment.author,
          sender: req.userId,
          type: 'comment_reply',
          title: 'New Reply',
          message: `${user.profile.firstName} replied to your comment`,
          data: { 
            postId: post._id, 
            commentId: comment._id,
            parentCommentId 
          }
        });
      }
    }

    const populatedComment = await Comment.findById(comment._id)
      .populate('author', 'username profile')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: 'username profile'
        }
      });

    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Share post
router.post('/:id/share', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const originalPost = await Post.findById(req.params.id);

    if (!originalPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if post can be shared
    if (originalPost.privacy === 'private' && 
        !originalPost.author.equals(req.userId)) {
      return res.status(403).json({ error: 'This post cannot be shared' });
    }

    const sharedPost = new Post({
      author: req.userId,
      content: content || `Shared: ${originalPost.content.substring(0, 100)}...`,
      privacy: 'public',
      shares: [{
        user: req.userId,
        sharedAt: new Date()
      }],
      metadata: {
        isShared: true,
        originalPost: originalPost._id
      }
    });

    await sharedPost.save();

    // Add share to original post
    originalPost.shares.push({
      user: req.userId,
      sharedAt: new Date()
    });
    await originalPost.save();

    // Create notification for original post author
    if (!originalPost.author.equals(req.userId)) {
      const user = await User.findById(req.userId);
      
      await Notification.create({
        recipient: originalPost.author,
        sender: req.userId,
        type: 'post_share',
        title: 'Post Shared',
        message: `${user.profile.firstName} shared your post`,
        data: { postId: originalPost._id, sharedPostId: sharedPost._id }
      });
    }

    const populatedPost = await Post.findById(sharedPost._id)
      .populate('author', 'username profile');

    res.status(201).json(populatedPost);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get stories
router.get('/stories/feed', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
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

    res.json(Object.values(groupedStories));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// View story
router.post('/stories/:id/view', auth, async (req, res) => {
  try {
    const story = await Post.findById(req.params.id);

    if (!story || !story.isStory) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Check if already viewed
    const alreadyViewed = story.storyViews.some(
      view => view.user.equals(req.userId)
    );

    if (!alreadyViewed) {
      story.storyViews.push({
        user: req.userId,
        viewedAt: new Date()
      });

      await story.save();

      // Create notification for story author
      if (!story.author.equals(req.userId)) {
        const user = await User.findById(req.userId);
        
        await Notification.create({
          recipient: story.author,
          sender: req.userId,
          type: 'story_view',
          title: 'Story View',
          message: `${user.profile.firstName} viewed your story`,
          data: { storyId: story._id }
        });
      }
    }

    res.json({ message: 'Story viewed' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Pin/unpin post
router.post('/:id/pin', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check ownership
    if (!post.author.equals(req.userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Unpin any currently pinned post
    if (post.pinned) {
      post.pinned = false;
    } else {
      // Unpin all other posts
      await Post.updateMany(
        { author: req.userId, pinned: true },
        { pinned: false }
      );
      post.pinned = true;
    }

    await post.save();

    res.json({ 
      message: post.pinned ? 'Post pinned' : 'Post unpinned',
      pinned: post.pinned 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;