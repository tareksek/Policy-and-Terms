
const User = require('../models/User');
const Post = require('../models/Post');
const { cloudinary } = require('../utils/cloudinary');
const Notification = require('../models/Notification');

class UserController {
    // Get current user profile
    async getCurrentUser(req, res) {
        try {
            const userId = req.userId;

            const user = await User.findById(userId)
                .select('-password -security.twoFactorSecret')
                .populate('friends', 'username profile')
                .populate('blockedUsers', 'username profile');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'المستخدم غير موجود'
                });
            }

            res.json({
                success: true,
                data: user
            });

        } catch (error) {
            console.error('Get current user error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب بيانات المستخدم'
            });
        }
    }

    // Get user by ID
    async getUserById(req, res) {
        try {
            const { id } = req.params;
            const currentUserId = req.userId;

            const user = await User.findById(id)
                .select('username profile privacySettings friends')
                .populate('friends', 'username profile');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'المستخدم غير موجود'
                });
            }

            // Check privacy settings
            const currentUser = await User.findById(currentUserId);
            
            if (user.privacySettings.profileVisibility === 'private' && 
                !user.friends.some(friend => friend.equals(currentUser._id)) &&
                !user._id.equals(currentUser._id)) {
                return res.status(403).json({
                    success: false,
                    error: 'الملف الشخصي خاص'
                });
            }

            // Check if current user is blocked
            if (user.blockedUsers && user.blockedUsers.includes(currentUserId)) {
                return res.status(403).json({
                    success: false,
                    error: 'لا يمكنك عرض هذا الملف الشخصي'
                });
            }

            // Get common friends count
            const commonFriends = user.friends.filter(friend => 
                currentUser.friends.includes(friend._id)
            ).length;

            res.json({
                success: true,
                data: {
                    ...user.toObject(),
                    commonFriends,
                    isFriend: user.friends.some(friend => friend.equals(currentUserId)),
                    isBlocked: currentUser.blockedUsers.includes(user._id)
                }
            });

        } catch (error) {
            console.error('Get user by ID error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب بيانات المستخدم'
            });
        }
    }

    // Update user profile
    async updateProfile(req, res) {
        try {
            const userId = req.userId;
            const updates = req.body;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'المستخدم غير موجود'
                });
            }

            // Handle profile picture upload
            if (req.files && req.files.profilePicture) {
                const file = req.files.profilePicture[0];
                const result = await cloudinary.uploader.upload(file.path, {
                    folder: `nexus/users/${userId}/profile`,
                    transformation: [
                        { width: 500, height: 500, crop: 'fill' }
                    ]
                });

                // Delete old profile picture if not default
                if (user.profile.profilePicture && 
                    !user.profile.profilePicture.includes('default_avatar')) {
                    const oldPublicId = user.profile.profilePicture
                        .split('/')
                        .slice(-2)
                        .join('/')
                        .split('.')[0];
                    
                    await cloudinary.uploader.destroy(oldPublicId);
                }

                updates.profilePicture = result.secure_url;
            }

            // Handle cover photo upload
            if (req.files && req.files.coverPhoto) {
                const file = req.files.coverPhoto[0];
                const result = await cloudinary.uploader.upload(file.path, {
                    folder: `nexus/users/${userId}/covers`,
                    transformation: [
                        { width: 1500, height: 500, crop: 'fill' }
                    ]
                });

                // Delete old cover photo if not default
                if (user.profile.coverPhoto && 
                    !user.profile.coverPhoto.includes('default_cover')) {
                    const oldPublicId = user.profile.coverPhoto
                        .split('/')
                        .slice(-2)
                        .join('/')
                        .split('.')[0];
                    
                    await cloudinary.uploader.destroy(oldPublicId);
                }

                updates.coverPhoto = result.secure_url;
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

            // Get updated user without sensitive data
            const updatedUser = await User.findById(userId)
                .select('-password -security.twoFactorSecret');

            res.json({
                success: true,
                message: 'تم تحديث الملف الشخصي بنجاح',
                data: updatedUser
            });

        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تحديث الملف الشخصي'
            });
        }
    }

    // Get user posts
    async getUserPosts(req, res) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const skip = (page - 1) * limit;

            // Check if user exists
            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'المستخدم غير موجود'
                });
            }

            // Check privacy
            const currentUser = await User.findById(req.userId);
            if (user.privacySettings.profileVisibility === 'private' && 
                !user._id.equals(currentUser._id) &&
                !user.friends.includes(currentUser._id)) {
                return res.status(403).json({
                    success: false,
                    error: 'لا يمكنك عرض منشورات هذا المستخدم'
                });
            }

            // Get posts
            const posts = await Post.find({ 
                author: id,
                isStory: false 
            })
            .populate('author', 'username profile')
            .populate('likes.user', 'username profile')
            .populate('tags', 'username profile')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

            const total = await Post.countDocuments({ 
                author: id,
                isStory: false 
            });

            res.json({
                success: true,
                data: {
                    posts,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get user posts error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب المنشورات'
            });
        }
    }

    // Send friend request
    async sendFriendRequest(req, res) {
        try {
            const senderId = req.userId;
            const { userId } = req.params;

            // Can't send request to yourself
            if (senderId === userId) {
                return res.status(400).json({
                    success: false,
                    error: 'لا يمكنك إرسال طلب صداقة لنفسك'
                });
            }

            const sender = await User.findById(senderId);
            const receiver = await User.findById(userId);

            if (!receiver) {
                return res.status(404).json({
                    success: false,
                    error: 'المستخدم غير موجود'
                });
            }

            // Check if already friends
            if (sender.friends.includes(receiver._id)) {
                return res.status(400).json({
                    success: false,
                    error: 'أنتم أصدقاء بالفعل'
                });
            }

            // Check if blocked
            if (receiver.blockedUsers.includes(senderId)) {
                return res.status(403).json({
                    success: false,
                    error: 'لا يمكنك إرسال طلب صداقة لهذا المستخدم'
                });
            }

            // Check if request already sent
            const existingRequest = receiver.friendRequests.find(
                request => request.user.equals(senderId) && request.status === 'pending'
            );

            if (existingRequest) {
                return res.status(400).json({
                    success: false,
                    error: 'تم إرسال طلب الصداقة بالفعل'
                });
            }

            // Check if receiver allows friend requests
            if (!receiver.privacySettings.allowFriendRequests) {
                return res.status(403).json({
                    success: false,
                    error: 'هذا المستخدم لا يقبل طلبات الصداقة'
                });
            }

            // Add friend request
            receiver.friendRequests.push({
                user: senderId,
                status: 'pending'
            });

            await receiver.save();

            // Create notification
            await Notification.create({
                recipient: receiver._id,
                sender: senderId,
                type: 'friend_request',
                title: 'طلب صداقة جديد',
                message: `${sender.profile.firstName} أرسل لك طلب صداقة`,
                data: { 
                    senderId: sender._id,
                    requestId: receiver.friendRequests[receiver.friendRequests.length - 1]._id
                }
            });

            res.json({
                success: true,
                message: 'تم إرسال طلب الصداقة بنجاح'
            });

        } catch (error) {
            console.error('Send friend request error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إرسال طلب الصداقة'
            });
        }
    }

    // Respond to friend request
    async respondToFriendRequest(req, res) {
        try {
            const userId = req.userId;
            const { requestId } = req.params;
            const { action } = req.body; // 'accept' or 'reject'

            const user = await User.findById(userId);

            const requestIndex = user.friendRequests.findIndex(
                request => request._id.toString() === requestId
            );

            if (requestIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: 'طلب الصداقة غير موجود'
                });
            }

            const request = user.friendRequests[requestIndex];
            const sender = await User.findById(request.user);

            if (action === 'accept') {
                // Add to friends list
                user.friends.push(sender._id);
                sender.friends.push(user._id);

                // Update request status
                request.status = 'accepted';

                // Remove any pending requests between them
                sender.friendRequests = sender.friendRequests.filter(
                    req => !req.user.equals(user._id)
                );

                await sender.save();

                // Create notification for sender
                await Notification.create({
                    recipient: sender._id,
                    sender: user._id,
                    type: 'friend_request_accepted',
                    title: 'تم قبول طلب الصداقة',
                    message: `${user.profile.firstName} قبل طلب صداقتك`,
                    data: { userId: user._id }
                });
            } else {
                request.status = 'rejected';

                // Create notification for sender
                await Notification.create({
                    recipient: sender._id,
                    sender: user._id,
                    type: 'friend_request_rejected',
                    title: 'تم رفض طلب الصداقة',
                    message: `${user.profile.firstName} رفض طلب صداقتك`,
                    data: { userId: user._id }
                });
            }

            // Remove request from user's list
            user.friendRequests.splice(requestIndex, 1);

            await user.save();

            res.json({
                success: true,
                message: `تم ${action === 'accept' ? 'قبول' : 'رفض'} طلب الصداقة`
            });

        } catch (error) {
            console.error('Respond to friend request error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء الرد على طلب الصداقة'
            });
        }
    }

    // Remove friend
    async removeFriend(req, res) {
        try {
            const userId = req.userId;
            const { friendId } = req.params;

            const user = await User.findById(userId);
            const friend = await User.findById(friendId);

            if (!friend) {
                return res.status(404).json({
                    success: false,
                    error: 'المستخدم غير موجود'
                });
            }

            // Check if they are friends
            if (!user.friends.includes(friendId)) {
                return res.status(400).json({
                    success: false,
                    error: 'أنتم لستم أصدقاء'
                });
            }

            // Remove from friends lists
            user.friends = user.friends.filter(id => !id.equals(friendId));
            friend.friends = friend.friends.filter(id => !id.equals(userId));

            await Promise.all([user.save(), friend.save()]);

            res.json({
                success: true,
                message: 'تم إزالة الصديق بنجاح'
            });

        } catch (error) {
            console.error('Remove friend error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إزالة الصديق'
            });
        }
    }

    // Block user
    async blockUser(req, res) {
        try {
            const userId = req.userId;
            const { userId: userToBlockId } = req.params;

            const user = await User.findById(userId);
            const userToBlock = await User.findById(userToBlockId);

            if (!userToBlock) {
                return res.status(404).json({
                    success: false,
                    error: 'المستخدم غير موجود'
                });
            }

            if (userId === userToBlockId) {
                return res.status(400).json({
                    success: false,
                    error: 'لا يمكنك حظر نفسك'
                });
            }

            // Check if already blocked
            if (user.blockedUsers.includes(userToBlockId)) {
                return res.status(400).json({
                    success: false,
                    error: 'المستخدم محظور بالفعل'
                });
            }

            // Add to blocked list
            user.blockedUsers.push(userToBlockId);
            
            // Remove from friends if they were friends
            user.friends = user.friends.filter(id => !id.equals(userToBlockId));
            userToBlock.friends = userToBlock.friends.filter(id => !id.equals(userId));

            // Remove friend requests
            user.friendRequests = user.friendRequests.filter(
                req => !req.user.equals(userToBlockId)
            );
            userToBlock.friendRequests = userToBlock.friendRequests.filter(
                req => !req.user.equals(userId)
            );

            await Promise.all([user.save(), userToBlock.save()]);

            res.json({
                success: true,
                message: 'تم حظر المستخدم بنجاح'
            });

        } catch (error) {
            console.error('Block user error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء حظر المستخدم'
            });
        }
    }

    // Unblock user
    async unblockUser(req, res) {
        try {
            const userId = req.userId;
            const { userId: userToUnblockId } = req.params;

            const user = await User.findById(userId);

            if (!user.blockedUsers.includes(userToUnblockId)) {
                return res.status(400).json({
                    success: false,
                    error: 'المستخدم غير محظور'
                });
            }

            user.blockedUsers = user.blockedUsers.filter(
                id => !id.equals(userToUnblockId)
            );

            await user.save();

            res.json({
                success: true,
                message: 'تم إلغاء حظر المستخدم بنجاح'
            });

        } catch (error) {
            console.error('Unblock user error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إلغاء حظر المستخدم'
            });
        }
    }

    // Get user suggestions
    async getUserSuggestions(req, res) {
        try {
            const userId = req.userId;
            const { limit = 10 } = req.query;

            const user = await User.findById(userId);

            // Get friends of friends
            const friendIds = user.friends;
            const friendsOfFriends = await User.find({
                _id: { 
                    $ne: userId,
                    $nin: [...friendIds, ...user.blockedUsers]
                },
                friends: { $in: friendIds },
                accountStatus: 'active'
            })
            .select('username profile')
            .limit(parseInt(limit));

            // If not enough suggestions, get random users
            if (friendsOfFriends.length < limit) {
                const randomUsers = await User.find({
                    _id: { 
                        $ne: userId,
                        $nin: [...friendIds, ...user.blockedUsers, ...friendsOfFriends.map(u => u._id)]
                    },
                    accountStatus: 'active'
                })
                .select('username profile')
                .limit(parseInt(limit) - friendsOfFriends.length);

                suggestions = [...friendsOfFriends, ...randomUsers];
            } else {
                suggestions = friendsOfFriends;
            }

            // Add mutual friends count
            const suggestionsWithMutual = await Promise.all(
                suggestions.map(async (suggestion) => {
                    const mutualFriends = await User.countDocuments({
                        _id: { $in: user.friends },
                        friends: suggestion._id
                    });

                    return {
                        ...suggestion.toObject(),
                        mutualFriends
                    };
                })
            );

            res.json({
                success: true,
                data: suggestionsWithMutual
            });

        } catch (error) {
            console.error('Get user suggestions error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب الاقتراحات'
            });
        }
    }

    // Search users
    async searchUsers(req, res) {
        try {
            const userId = req.userId;
            const { q, page = 1, limit = 20 } = req.query;
            const skip = (page - 1) * limit;

            if (!q || q.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'يجب أن يكون نص البحث على الأقل حرفين'
                });
            }

            const searchRegex = new RegExp(q, 'i');

            const user = await User.findById(userId);
            const blockedUsers = user.blockedUsers;

            const query = {
                $or: [
                    { username: searchRegex },
                    { 'profile.firstName': searchRegex },
                    { 'profile.lastName': searchRegex },
                    { email: searchRegex }
                ],
                _id: { 
                    $ne: userId,
                    $nin: blockedUsers 
                },
                accountStatus: 'active'
            };

            const users = await User.find(query)
                .select('username profile')
                .skip(skip)
                .limit(parseInt(limit));

            const total = await User.countDocuments(query);

            // Add relationship info
            const usersWithRelationship = await Promise.all(
                users.map(async (userResult) => {
                    const isFriend = user.friends.includes(userResult._id);
                    const hasSentRequest = userResult.friendRequests.some(
                        req => req.user.equals(userId) && req.status === 'pending'
                    );
                    const hasReceivedRequest = user.friendRequests.some(
                        req => req.user.equals(userResult._id) && req.status === 'pending'
                    );

                    return {
                        ...userResult.toObject(),
                        isFriend,
                        hasSentRequest,
                        hasReceivedRequest,
                        isBlocked: false
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    users: usersWithRelationship,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Search users error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء البحث'
            });
        }
    }

    // Update privacy settings
    async updatePrivacySettings(req, res) {
        try {
            const userId = req.userId;
            const { settings } = req.body;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'المستخدم غير موجود'
                });
            }

            Object.assign(user.privacySettings, settings);
            await user.save();

            res.json({
                success: true,
                message: 'تم تحديث إعدادات الخصوصية',
                data: user.privacySettings
            });

        } catch (error) {
            console.error('Update privacy settings error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تحديث إعدادات الخصوصية'
            });
        }
    }

    // Update security settings
    async updateSecuritySettings(req, res) {
        try {
            const userId = req.userId;
            const { settings } = req.body;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'المستخدم غير موجود'
                });
            }

            Object.assign(user.security, settings);
            await user.save();

            res.json({
                success: true,
                message: 'تم تحديث إعدادات الأمان',
                data: {
                    twoFactorEnabled: user.security.twoFactorEnabled,
                    loginAlerts: user.security.loginAlerts
                }
            });

        } catch (error) {
            console.error('Update security settings error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تحديث إعدادات الأمان'
            });
        }
    }

    // Deactivate account
    async deactivateAccount(req, res) {
        try {
            const userId = req.userId;
            const { reason } = req.body;

            const user = await User.findById(userId);

            user.accountStatus = 'deactivated';
            user.security.activeSessions = [];
            await user.save();

            // Send deactivation email
            const { sendEmail } = require('../utils/emailService');
            await sendEmail({
                to: user.email,
                subject: 'تم تعطيل حسابك',
                html: `
                    <h3>تم تعطيل حسابك</h3>
                    <p>تم تعطيل حسابك بناءً على طلبك.</p>
                    <p>يمكنك إعادة تفعيل حسابك في أي وقت عن طريق تسجيل الدخول مرة أخرى.</p>
                    <p><strong>سبب التعطيل:</strong> ${reason || 'غير محدد'}</p>
                `
            });

            res.json({
                success: true,
                message: 'تم تعطيل الحساب بنجاح'
            });

        } catch (error) {
            console.error('Deactivate account error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تعطيل الحساب'
            });
        }
    }

    // Delete account
    async deleteAccount(req, res) {
        try {
            const userId = req.userId;
            const { password } = req.body;

            const user = await User.findById(userId).select('+password');

            // Verify password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    error: 'كلمة المرور غير صحيحة'
                });
            }

            // Mark as deleted but keep data for 30 days
            user.accountStatus = 'deactivated';
            user.email = `deleted_${user._id}@nexus.com`;
            user.username = `deleted_${user._id}`;
            user.profile.firstName = 'Deleted';
            user.profile.lastName = 'User';
            user.profile.profilePicture = '';
            user.profile.coverPhoto = '';
            user.profile.bio = '';
            user.password = 'deleted_' + Date.now();
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

            res.json({
                success: true,
                message: 'تم حذف الحساب بنجاح'
            });

        } catch (error) {
            console.error('Delete account error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء حذف الحساب'
            });
        }
    }

    // Get user statistics
    async getUserStats(req, res) {
        try {
            const userId = req.userId;

            const [
                postCount,
                friendCount,
                groupCount,
                storyCount
            ] = await Promise.all([
                Post.countDocuments({ author: userId, isStory: false }),
                User.findById(userId).select('friends').then(user => user.friends.length),
                require('../models/Group').countDocuments({ 'members.user': userId }),
                Post.countDocuments({ author: userId, isStory: true, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
            ]);

            res.json({
                success: true,
                data: {
                    posts: postCount,
                    friends: friendCount,
                    groups: groupCount,
                    stories: storyCount
                }
            });

        } catch (error) {
            console.error('Get user stats error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب الإحصائيات'
            });
        }
    }
}

module.exports = new UserController();
