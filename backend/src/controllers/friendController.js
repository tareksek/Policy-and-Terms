const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

// إرسال طلب صداقة
exports.sendRequest = async (req, res) => {
    try {
        const receiverId = req.params.userId;
        const senderId = req.user.id;
        
        // التحقق من عدم إرسال طلب لنفسك
        if (senderId === receiverId) {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن إرسال طلب صداقة لنفسك'
            });
        }
        
        // التحقق من وجود المستخدم
        const receiver = await User.findById(receiverId);
        
        if (!receiver) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }
        
        // التحقق من وجود طلب مسبق
        const existingRequest = await FriendRequest.findOne({
            $or: [
                { sender: senderId, receiver: receiverId },
                { sender: receiverId, receiver: senderId }
            ]
        });
        
        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: existingRequest.status === 'pending' 
                    ? 'هناك طلب صداقة قيد الانتظار بالفعل'
                    : 'أنتم أصدقاء بالفعل'
            });
        }
        
        // التحقق إذا كانا صديقين بالفعل
        const sender = await User.findById(senderId);
        if (sender.friends.includes(receiverId)) {
            return res.status(400).json({
                success: false,
                message: 'أنتم أصدقاء بالفعل'
            });
        }
        
        // إنشاء طلب الصداقة
        const friendRequest = await FriendRequest.create({
            sender: senderId,
            receiver: receiverId,
            status: 'pending'
        });
        
        // إرسال إشعار للمستقبل (يمكن تنفيذه لاحقًا)
        
        res.status(201).json({
            success: true,
            message: 'تم إرسال طلب الصداقة',
            data: friendRequest
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// قبول طلب الصداقة
exports.acceptRequest = async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const userId = req.user.id;
        
        const friendRequest = await FriendRequest.findById(requestId);
        
        if (!friendRequest) {
            return res.status(404).json({
                success: false,
                message: 'طلب الصداقة غير موجود'
            });
        }
        
        // التحقق من أن المستخدم هو المستقبل
        if (friendRequest.receiver.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'ليس لديك صلاحية لقبول هذا الطلب'
            });
        }
        
        // التحقق من حالة الطلب
        if (friendRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `طلب الصداقة ${friendRequest.status === 'accepted' ? 'مقبول' : 'مرفوض'} بالفعل`
            });
        }
        
        // تحديث حالة الطلب
        friendRequest.status = 'accepted';
        friendRequest.acceptedAt = Date.now();
        await friendRequest.save();
        
        // إضافة الأصدقاء لكلا المستخدمين
        await User.findByIdAndUpdate(friendRequest.sender, {
            $addToSet: { 
                friends: friendRequest.receiver,
                following: friendRequest.receiver,
                followers: friendRequest.receiver
            }
        });
        
        await User.findByIdAndUpdate(friendRequest.receiver, {
            $addToSet: { 
                friends: friendRequest.sender,
                following: friendRequest.sender,
                followers: friendRequest.sender
            }
        });
        
        res.json({
            success: true,
            message: 'تم قبول طلب الصداقة',
            data: friendRequest
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// رفض طلب الصداقة
exports.rejectRequest = async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const userId = req.user.id;
        
        const friendRequest = await FriendRequest.findById(requestId);
        
        if (!friendRequest) {
            return res.status(404).json({
                success: false,
                message: 'طلب الصداقة غير موجود'
            });
        }
        
        // التحقق من أن المستخدم هو المستقبل
        if (friendRequest.receiver.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'ليس لديك صلاحية لرفض هذا الطلب'
            });
        }
        
        // تحديث حالة الطلب
        friendRequest.status = 'rejected';
        await friendRequest.save();
        
        res.json({
            success: true,
            message: 'تم رفض طلب الصداقة',
            data: friendRequest
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// إلغاء المتابعة
exports.unfollow = async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const userId = req.user.id;
        
        // التحقق من عدم إلغاء متابعة النفس
        if (userId === targetUserId) {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن إلغاء متابعة نفسك'
            });
        }
        
        // إزالة من قائمة المتابَعة
        await User.findByIdAndUpdate(userId, {
            $pull: { following: targetUserId }
        });
        
        // إزالة من قائمة المتابعين للطرف الآخر
        await User.findByIdAndUpdate(targetUserId, {
            $pull: { followers: userId }
        });
        
        // إزالة من قائمة الأصدقاء إذا كانوا أصدقاء
        await User.findByIdAndUpdate(userId, {
            $pull: { friends: targetUserId }
        });
        
        await User.findByIdAndUpdate(targetUserId, {
            $pull: { friends: userId }
        });
        
        res.json({
            success: true,
            message: 'تم إلغاء المتابعة'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// عرض قائمة الأصدقاء
exports.getFriends = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;
        const { page = 1, limit = 20 } = req.query;
        
        const user = await User.findById(userId)
            .select('friends')
            .populate('friends', 'username name avatar bio');
        
        const friends = user.friends;
        const total = friends.length;
        
        // تطبيق التقسيم للصفحات
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedFriends = friends.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            data: {
                friends: paginatedFriends,
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

// عرض المتابعين
exports.getFollowers = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;
        const { page = 1, limit = 20 } = req.query;
        
        const user = await User.findById(userId)
            .select('followers')
            .populate('followers', 'username name avatar bio');
        
        const followers = user.followers;
        const total = followers.length;
        
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedFollowers = followers.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            data: {
                followers: paginatedFollowers,
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

// عرض المتابَعين
exports.getFollowing = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;
        const { page = 1, limit = 20 } = req.query;
        
        const user = await User.findById(userId)
            .select('following')
            .populate('following', 'username name avatar bio');
        
        const following = user.following;
        const total = following.length;
        
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedFollowing = following.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            data: {
                following: paginatedFollowing,
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