const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { cloudinary } = require('../utils/cloudinary');

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-password -security.twoFactorSecret')
      .populate('friends', 'username profile')
      .populate('blockedUsers', 'username profile');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username profile privacySettings friends')
      .populate('friends', 'username profile');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check privacy settings
    const currentUser = await User.findById(req.userId);
    
    if (user.privacySettings.profileVisibility === 'private' && 
        !user.friends.some(friend => friend.equals(currentUser._id)) &&
        !user._id.equals(currentUser._id)) {
      return res.status(403).json({ error: 'Profile is private' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile
router.put('/profile', auth, upload.single('image'), async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Handle profile picture upload
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: `nexus/users/${user._id}/profile`,
        transformation: [
          { width: 500, height: 500, crop: 'fill' }
        ]
      });

      if (updates.profilePicture && updates.profilePicture !== 'default') {
        // Delete old profile picture from Cloudinary
        const oldPublicId = user.profile.profilePicture
          .split('/')
          .slice(-2)
          .join('/')
          .split('.')[0];
        
        await cloudinary.uploader.destroy(oldPublicId);
      }

      updates.profilePicture = result.secure_url;
    }

    // Update user fields
    Object.keys(updates).forEach(key => {
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        if (user[parent]) {
          user[parent][child] = updates[key];
        }
      } else {
        user[key] = updates[key];
      }
    });

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user posts
router.get('/:id/posts', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ author: req.params.id })
      .populate('author', 'username profile')
      .populate('likes.user', 'username profile')
      .populate('comments')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments({ author: req.params.id });

    res.json({
      posts,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Friend requests
router.post('/friend-request/:userId', auth, async (req, res) => {
  try {
    const sender = await User.findById(req.userId);
    const receiver = await User.findById(req.params.userId);

    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (sender._id.equals(receiver._id)) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check if already friends
    if (sender.friends.includes(receiver._id)) {
      return res.status(400).json({ error: 'Already friends' });
    }

    // Check if request already sent
    const existingRequest = receiver.friendRequests.find(
      request => request.user.equals(sender._id) && request.status === 'pending'
    );

    if (existingRequest) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    // Add friend request
    receiver.friendRequests.push({
      user: sender._id,
      status: 'pending'
    });

    await receiver.save();

    // Create notification
    const Notification = require('../models/Notification');
    await Notification.create({
      recipient: receiver._id,
      sender: sender._id,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${sender.profile.firstName} sent you a friend request`,
      data: { senderId: sender._id }
    });

    res.json({ message: 'Friend request sent' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Respond to friend request
router.post('/friend-request/:requestId/respond', auth, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    const user = await User.findById(req.userId);

    const requestIndex = user.friendRequests.findIndex(
      request => request._id.toString() === req.params.requestId
    );

    if (requestIndex === -1) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const request = user.friendRequests[requestIndex];
    const sender = await User.findById(request.user);

    if (action === 'accept') {
      // Add to friends list
      user.friends.push(sender._id);
      sender.friends.push(user._id);

      request.status = 'accepted';
      sender.friendRequests = sender.friendRequests.filter(
        req => !req.user.equals(user._id)
      );

      await sender.save();

      // Create notification for sender
      const Notification = require('../models/Notification');
      await Notification.create({
        recipient: sender._id,
        sender: user._id,
        type: 'friend_request_accepted',
        title: 'Friend Request Accepted',
        message: `${user.profile.firstName} accepted your friend request`,
        data: { userId: user._id }
      });
    } else {
      request.status = 'rejected';
    }

    // Remove from friend requests
    user.friendRequests.splice(requestIndex, 1);

    await user.save();

    res.json({
      message: `Friend request ${action}ed`,
      status: action
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove friend
router.delete('/friends/:friendId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const friend = await User.findById(req.params.friendId);

    if (!friend) {
      return res.status(404).json({ error: 'Friend not found' });
    }

    // Remove from both friends lists
    user.friends = user.friends.filter(id => !id.equals(friend._id));
    friend.friends = friend.friends.filter(id => !id.equals(user._id));

    await Promise.all([user.save(), friend.save()]);

    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Block user
router.post('/block/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const userToBlock = await User.findById(req.params.userId);

    if (!userToBlock) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user._id.equals(userToBlock._id)) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Add to blocked list
    if (!user.blockedUsers.includes(userToBlock._id)) {
      user.blockedUsers.push(userToBlock._id);
      
      // Remove from friends if they were friends
      user.friends = user.friends.filter(id => !id.equals(userToBlock._id));
      userToBlock.friends = userToBlock.friends.filter(id => !id.equals(user._id));

      // Remove friend requests
      user.friendRequests = user.friendRequests.filter(
        req => !req.user.equals(userToBlock._id)
      );
      userToBlock.friendRequests = userToBlock.friendRequests.filter(
        req => !req.user.equals(user._id)
      );

      await Promise.all([user.save(), userToBlock.save()]);
    }

    res.json({ message: 'User blocked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Unblock user
router.post('/unblock/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    user.blockedUsers = user.blockedUsers.filter(
      id => !id.equals(req.params.userId)
    );

    await user.save();

    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user suggestions
router.get('/suggestions', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    // Find users who are not friends and not blocked
    const suggestions = await User.find({
      _id: {
        $ne: user._id,
        $nin: [...user.friends, ...user.blockedUsers]
      },
      accountStatus: 'active'
    })
      .select('username profile')
      .limit(10)
      .sort({ createdAt: -1 });

    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Search users
router.get('/search', auth, async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const searchRegex = new RegExp(q, 'i');

    const users = await User.find({
      $or: [
        { username: searchRegex },
        { 'profile.firstName': searchRegex },
        { 'profile.lastName': searchRegex },
        { email: searchRegex }
      ],
      _id: { $ne: req.userId },
      accountStatus: 'active'
    })
      .select('username profile')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments({
      $or: [
        { username: searchRegex },
        { 'profile.firstName': searchRegex },
        { 'profile.lastName': searchRegex },
        { email: searchRegex }
      ],
      _id: { $ne: req.userId },
      accountStatus: 'active'
    });

    res.json({
      users,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update privacy settings
router.put('/privacy', auth, async (req, res) => {
  try {
    const { settings } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    Object.assign(user.privacySettings, settings);
    await user.save();

    res.json({
      message: 'Privacy settings updated',
      privacySettings: user.privacySettings
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update security settings
router.put('/security', auth, async (req, res) => {
  try {
    const { settings } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    Object.assign(user.security, settings);
    await user.save();

    res.json({
      message: 'Security settings updated',
      security: {
        twoFactorEnabled: user.security.twoFactorEnabled,
        loginAlerts: user.security.loginAlerts
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get active sessions
router.get('/sessions', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('security.activeSessions');

    res.json(user.security.activeSessions);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Revoke session
router.delete('/sessions/:sessionToken', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    user.security.activeSessions = user.security.activeSessions.filter(
      session => session.token !== req.params.sessionToken
    );

    await user.save();

    res.json({ message: 'Session revoked' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Deactivate account
router.post('/deactivate', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    user.accountStatus = 'deactivated';
    user.security.activeSessions = [];
    await user.save();

    res.json({ message: 'Account deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete account
router.delete('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    // Mark account as deleted but keep data for 30 days
    user.accountStatus = 'deactivated';
    user.email = `deleted_${user._id}@nexus.com`;
    user.username = `deleted_${user._id}`;
    user.profile.firstName = 'Deleted';
    user.profile.lastName = 'User';
    user.profile.profilePicture = '';
    user.profile.coverPhoto = '';
    user.profile.bio = '';
    user.password = 'deleted';
    user.security.twoFactorSecret = '';
    user.security.activeSessions = [];
    user.friends = [];
    user.friendRequests = [];
    user.blockedUsers = [];

    await user.save();

    // Schedule permanent deletion after 30 days
    setTimeout(async () => {
      await User.findByIdAndDelete(user._id);
    }, 30 * 24 * 60 * 60 * 1000);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;