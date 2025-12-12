const User = require('../models/User');
const Post = require('../models/Post');

// تسجيل مستخدم جديد
exports.register = async (req, res) => {
    try {
        const { username, email, password, name } = req.body;
        
        // التحقق من وجود المستخدم
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'البريد الإلكتروني أو اسم المستخدم موجود بالفعل'
            });
        }
        
        // إنشاء مستخدم جديد
        const user = await User.create({
            username,
            email,
            password,
            name
        });
        
        // إنشاء توكن
        const token = user.generateAuthToken();
        
        res.status(201).json({
            success: true,
            message: 'تم التسجيل بنجاح',
            data: { user, token }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// تسجيل الدخول
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // البحث عن المستخدم
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'بيانات الدخول غير صحيحة'
            });
        }
        
        // التحقق من كلمة المرور
        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'بيانات الدخول غير صحيحة'
            });
        }
        
        // إنشاء توكن
        const token = user.generateAuthToken();
        
        res.json({
            success: true,
            message: 'تم تسجيل الدخول بنجاح',
            data: { user, token }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// عرض الملف الشخصي
exports.getProfile = async (req, res) => {
    try {
        const userId = req.params.id || req.user.id;
        
        const user = await User.findById(userId)
            .select('-password')
            .populate('friends', 'username name avatar');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }
        
        // الحصول على عدد المنشورات
        const postCount = await Post.countDocuments({ user: userId });
        
        res.json({
            success: true,
            data: {
                user,
                stats: {
                    posts: postCount,
                    friends: user.friends.length,
                    followers: user.followers.length,
                    following: user.following.length
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

// تحديث الملف الشخصي
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const updates = req.body;
        
        // إزالة الحقول المحمية من التحديث
        delete updates.password;
        delete updates.email;
        delete updates.role;
        
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');
        
        res.json({
            success: true,
            message: 'تم تحديث الملف الشخصي بنجاح',
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// البحث عن مستخدمين
exports.searchUsers = async (req, res) => {
    try {
        const { q, page = 1, limit = 10 } = req.query;
        
        const searchQuery = {
            $or: [
                { username: { $regex: q, $options: 'i' } },
                { name: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } }
            ]
        };
        
        const users = await User.find(searchQuery)
            .select('username name avatar bio')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await User.countDocuments(searchQuery);
        
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

// حذف الحساب
exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        
        await User.findByIdAndDelete(userId);
        
        // حذف جميع بيانات المستخدم (منشورات، تعليقات، إلخ)
        await Post.deleteMany({ user: userId });
        
        res.json({
            success: true,
            message: 'تم حذف الحساب بنجاح'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};