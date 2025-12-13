const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const { cloudinary } = require('../utils/cloudinary');
const { clearUserCache } = require('../middleware/cache');

/* ======================================================
   User Controller
====================================================== */
class UserController {

  /* ===================== Profiles ===================== */
  async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.userId)
        .select('-password -security.twoFactorSecret -violations')
        .populate('friends', 'username profile isOnline lastSeen')
        .populate('blockedUsers', 'username profile');

      if (!user) {
        return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
      }

      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getUserById(req, res) {
    try {
      const targetUser = await User.findById(req.params.id)
        .select('username profile privacySettings friends blockedUsers')
        .populate('friends', 'username profile');

      if (!targetUser) {
        return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
      }

      const currentUser = await User.findById(req.userId);

      if (targetUser.blockedUsers.includes(req.userId)) {
        return res.status(403).json({ success: false, error: 'لا يمكنك عرض هذا الملف الشخصي' });
      }

      if (targetUser.privacySettings.profileVisibility === 'private' &&
          !targetUser._id.equals(req.userId) &&
          !targetUser.friends.includes(req.userId)) {
        return res.status(403).json({ success: false, error: 'الملف الشخصي خاص' });
      }

      const commonFriends = targetUser.friends.filter(f =>
        currentUser.friends.includes(f._id)
      ).length;

      res.json({
        success: true,
        data: {
          ...targetUser.toObject(),
          commonFriends,
          isFriend: targetUser.friends.includes(req.userId)
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /* ===================== Update Profile ===================== */
  async updateProfile(req, res) {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
      }

      const allowedFields = [
        'firstName', 'lastName', 'bio', 'city', 'country',
        'relationship', 'work', 'education'
      ];

      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          user.profile[field] = req.body[field];
        }
      });

      if (req.body.privacySettings) {
        user.privacySettings = { ...user.privacySettings, ...req.body.privacySettings };
      }

      /* Profile Picture */
      if (req.files?.profilePicture) {
        const file = req.files.profilePicture[0];
        const result = await cloudinary.uploader.upload(file.path, {
          folder: `nexus/users/${user._id}/profile`,
          transformation: [{ width: 500, height: 500, crop: 'fill' }]
        });
        user.profile.profilePicture = result.secure_url;
      }

      /* Cover Photo */
      if (req.files?.coverPhoto) {
        const file = req.files.coverPhoto[0];
        const result = await cloudinary.uploader.upload(file.path, {
          folder: `nexus/users/${user._id}/cover`,
          transformation: [{ width: 1500, height: 500, crop: 'fill' }]
        });
        user.profile.coverPhoto = result.secure_url;
      }

      await user.save();
      clearUserCache(user._id);

      res.json({ success: true, message: 'تم تحديث الملف الشخصي بنجاح', data: user });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /* ===================== Friends ===================== */
  async sendFriendRequest(req, res) {
    try {
      const sender = await User.findById(req.userId);
      const receiver = await User.findById(req.params.userId);

      if (!receiver) {
        return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
      }

      if (receiver.blockedUsers.includes(sender._id)) {
        return res.status(403).json({ success: false, error: 'لا يمكنك إرسال طلب صداقة' });
      }

      receiver.friendRequests.push({ user: sender._id, status: 'pending' });
      await receiver.save();

      await Notification.create({
        recipient: receiver._id,
        sender: sender._id,
        type: 'friend_request',
        title: 'طلب صداقة جديد'
      });

      res.json({ success: true, message: 'تم إرسال طلب الصداقة' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async respondToFriendRequest(req, res) {
    try {
      const user = await User.findById(req.userId);
      const request = user.friendRequests.id(req.params.requestId);

      if (!request) {
        return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
      }

      const sender = await User.findById(request.user);

      if (req.body.action === 'accept') {
        user.friends.push(sender._id);
        sender.friends.push(user._id);
        await sender.save();
      }

      user.friendRequests.pull(request._id);
      await user.save();

      res.json({ success: true, message: 'تم تحديث حالة الطلب' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /* ===================== Search ===================== */
  async searchUsers(req, res) {
    try {
      const q = req.query.q;
      if (!q || q.length < 2) {
        return res.status(400).json({ success: false, error: 'نص البحث قصير' });
      }

      const regex = new RegExp(q, 'i');

      const users = await User.find({
        $or: [
          { username: regex },
          { 'profile.firstName': regex },
          { 'profile.lastName': regex }
        ],
        accountStatus: 'active'
      })
      .select('username profile isOnline lastSeen')
      .limit(20);

      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /* ===================== Admin ===================== */
  async updateUserRole(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'غير مصرح' });
      }

      const user = await User.findById(req.params.userId);
      user.role = req.body.role;
      await user.save();

      res.json({ success: true, message: 'تم تحديث الدور' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async banUser(req, res) {
    try {
      if (!req.user.isModerator()) {
        return res.status(403).json({ success: false, error: 'غير مصرح' });
      }

      const user = await User.findById(req.params.userId);
      user.status = 'suspended';
      await user.save();

      res.json({ success: true, message: 'تم حظر المستخدم' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new UserController();