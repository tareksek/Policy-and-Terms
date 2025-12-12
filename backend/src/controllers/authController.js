const User = require('../models/User');
const crypto = require('crypto');
const sendEmail = require('../utils/email');

// التحقق من البريد الإلكتروني
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;
        
        // البحث عن المستخدم بالتوكن
        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'توكن التحقق غير صالح أو منتهي الصلاحية'
            });
        }
        
        // تحديث حالة المستخدم
        user.emailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();
        
        res.json({
            success: true,
            message: 'تم التحقق من البريد الإلكتروني بنجاح'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// إرسال رابط التحقق من البريد الإلكتروني
exports.sendVerificationEmail = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const user = await User.findById(userId);
        
        if (user.emailVerified) {
            return res.status(400).json({
                success: false,
                message: 'البريد الإلكتروني مفعل بالفعل'
            });
        }
        
        // إنشاء توكن تحقق
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        // حفظ التوكن في قاعدة البيانات
        user.emailVerificationToken = verificationToken;
        user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 ساعة
        await user.save();
        
        // إنشاء رابط التحقق
        const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;
        
        // إرسال البريد الإلكتروني
        const message = `
            <h1>التحقق من البريد الإلكتروني</h1>
            <p>مرحباً ${user.name},</p>
            <p>يرجى النقر على الرابط أدناه للتحقق من بريدك الإلكتروني:</p>
            <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
                التحقق من البريد الإلكتروني
            </a>
            <p>إذا لم تطلب هذا التحقق، يمكنك تجاهل هذه الرسالة.</p>
            <p>ينتهي صلاحية هذا الرابط خلال 24 ساعة.</p>
        `;
        
        await sendEmail({
            email: user.email,
            subject: 'التحقق من البريد الإلكتروني',
            message
        });
        
        res.json({
            success: true,
            message: 'تم إرسال رابط التحقق إلى بريدك الإلكتروني'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// طلب إعادة تعيين كلمة المرور
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'لا يوجد حساب بهذا البريد الإلكتروني'
            });
        }
        
        // إنشاء توكن إعادة تعيين
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // حفظ التوكن في قاعدة البيانات
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // ساعة واحدة
        await user.save();
        
        // إنشاء رابط إعادة التعيين
        const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
        
        // إرسال البريد الإلكتروني
        const message = `
            <h1>إعادة تعيين كلمة المرور</h1>
            <p>مرحباً ${user.name},</p>
            <p>لقد تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك.</p>
            <p>يرجى النقر على الرابط أدناه لإعادة تعيين كلمة المرور:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
                إعادة تعيين كلمة المرور
            </a>
            <p>إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة.</p>
            <p>ينتهي صلاحية هذا الرابط خلال ساعة واحدة.</p>
        `;
        
        await sendEmail({
            email: user.email,
            subject: 'إعادة تعيين كلمة المرور',
            message
        });
        
        res.json({
            success: true,
            message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// إعادة تعيين كلمة المرور
exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;
        
        // البحث عن المستخدم بالتوكن
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'توكن إعادة التعيين غير صالح أو منتهي الصلاحية'
            });
        }
        
        // تحديث كلمة المرور
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        
        // إرسال تأكيد بالبريد الإلكتروني
        const message = `
            <h1>تم تغيير كلمة المرور</h1>
            <p>مرحباً ${user.name},</p>
            <p>تم تغيير كلمة المرور لحسابك بنجاح.</p>
            <p>إذا لم تقم بهذا التغيير، يرجى التواصل مع الدعم الفوري.</p>
        `;
        
        await sendEmail({
            email: user.email,
            subject: 'تم تغيير كلمة المرور',
            message
        });
        
        res.json({
            success: true,
            message: 'تم إعادة تعيين كلمة المرور بنجاح'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// تغيير كلمة المرور (للمستخدم المسجل دخوله)
exports.changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        
        const user = await User.findById(userId);
        
        // التحقق من كلمة المرور الحالية
        const isMatch = await user.comparePassword(currentPassword);
        
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'كلمة المرور الحالية غير صحيحة'
            });
        }
        
        // تحديث كلمة المرور
        user.password = newPassword;
        await user.save();
        
        // إرسال تأكيد بالبريد الإلكتروني
        const message = `
            <h1>تم تغيير كلمة المرور</h1>
            <p>مرحباً ${user.name},</p>
            <p>تم تغيير كلمة المرور لحسابك بنجاح.</p>
            <p>إذا لم تقم بهذا التغيير، يرجى التواصل مع الدعم الفوري.</p>
        `;
        
        await sendEmail({
            email: user.email,
            subject: 'تم تغيير كلمة المرور',
            message
        });
        
        res.json({
            success: true,
            message: 'تم تغيير كلمة المرور بنجاح'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// تجديد التوكن
exports.refreshToken = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }
        
        // إنشاء توكن جديد
        const token = user.generateAuthToken();
        
        res.json({
            success: true,
            message: 'تم تجديد التوكن بنجاح',
            data: { token }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// تسجيل الخروج
exports.logout = async (req, res) => {
    try {
        // في حالة استخدام التوكنات المخزنة، يمكن حذف التوكن هنا
        
        res.json({
            success: true,
            message: 'تم تسجيل الخروج بنجاح'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم',
            error: error.message
        });
    }
};

// تسجيل الدخول عبر Google (مثال)
exports.googleLogin = async (req, res) => {
    try {
        const { idToken } = req.body;
        
        // هنا يجب التحقق من idToken مع Google
        // هذا مثال مبسط
        
        // محاكاة بيانات المستخدم من Google
        const googleUser = {
            email: 'user@gmail.com',
            name: 'Google User',
            picture: 'https://example.com/avatar.jpg'
        };
        
        // البحث عن مستخدم موجود أو إنشاء جديد
        let user = await User.findOne({ email: googleUser.email });
        
        if (!user) {
            user = await User.create({
                email: googleUser.email,
                name: googleUser.name,
                avatar: googleUser.picture,
                password: crypto.randomBytes(16).toString('hex'), // كلمة مرور عشوائية
                emailVerified: true,
                authProvider: 'google'
            });
        }
        
        // إنشاء توكن
        const token = user.generateAuthToken();
        
        res.json({
            success: true,
            message: 'تم تسجيل الدخول عبر Google بنجاح',
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

// تسجيل الدخول عبر Facebook (مثال)
exports.facebookLogin = async (req, res) => {
    try {
        const { accessToken } = req.body;
        
        // هنا يجب التحقق من accessToken مع Facebook
        // هذا مثال مبسط
        
        // محاكاة بيانات المستخدم من Facebook
        const facebookUser = {
            email: 'user@facebook.com',
            name: 'Facebook User',
            picture: 'https://example.com/avatar.jpg'
        };
        
        // البحث عن مستخدم موجود أو إنشاء جديد
        let user = await User.findOne({ email: facebookUser.email });
        
        if (!user) {
            user = await User.create({
                email: facebookUser.email,
                name: facebookUser.name,
                avatar: facebookUser.picture,
                password: crypto.randomBytes(16).toString('hex'),
                emailVerified: true,
                authProvider: 'facebook'
            });
        }
        
        // إنشاء توكن
        const token = user.generateAuthToken();
        
        res.json({
            success: true,
            message: 'تم تسجيل الدخول عبر Facebook بنجاح',
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