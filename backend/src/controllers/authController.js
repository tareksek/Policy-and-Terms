
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { sendEmail } = require('../utils/emailService');

class AuthController {
    // Register new user
    async register(req, res) {
        try {
            const { username, email, password, firstName, lastName } = req.body;

            // Check if user exists
            const existingUser = await User.findOne({ 
                $or: [{ email }, { username }] 
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    error: 'يوجد حساب بالفعل بهذا البريد الإلكتروني أو اسم المستخدم'
                });
            }

            // Create user
            const user = new User({
                username,
                email,
                password,
                profile: { firstName, lastName }
            });

            await user.save();

            // Generate tokens
            const token = user.generateAuthToken();
            const refreshToken = user.generateRefreshToken();

            // Save session
            user.security.activeSessions.push({
                token: refreshToken,
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip,
                location: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });

            await user.save();

            // Send welcome email
            await sendEmail({
                to: email,
                subject: 'مرحباً بك في Nexus!',
                html: `
                    <h1>مرحباً ${firstName}!</h1>
                    <p>تم إنشاء حسابك بنجاح في منصة Nexus.</p>
                    <p>يمكنك الآن تسجيل الدخول والاستمتاع بمميزات المنصة.</p>
                    <br>
                    <p>مع تحيات فريق Nexus</p>
                `
            });

            res.status(201).json({
                success: true,
                message: 'تم إنشاء الحساب بنجاح',
                data: {
                    token,
                    refreshToken,
                    user: {
                        id: user._id,
                        username: user.username,
                        email: user.email,
                        profile: user.profile,
                        requires2FA: user.security.twoFactorEnabled
                    }
                }
            });

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إنشاء الحساب'
            });
        }
    }

    // Login user
    async login(req, res) {
        try {
            const { email, password, rememberMe } = req.body;

            // Find user
            const user = await User.findOne({ email }).select('+password');
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
                });
            }

            // Check account status
            if (user.accountStatus !== 'active') {
                return res.status(403).json({
                    success: false,
                    error: `الحساب ${user.accountStatus === 'suspended' ? 'موقوف' : 'معطل'}`
                });
            }

            // Verify password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
                });
            }

            // Update last seen
            user.lastSeen = new Date();
            await user.save();

            // Generate tokens
            const token = user.generateAuthToken();
            const refreshToken = user.generateRefreshToken();

            // Save session
            const sessionData = {
                token: refreshToken,
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip,
                location: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000)
            };

            user.security.activeSessions.push(sessionData);
            await user.save();

            // Send login notification email
            if (user.security.loginAlerts) {
                await sendEmail({
                    to: user.email,
                    subject: 'تسجيل دخول جديد إلى حسابك',
                    html: `
                        <h3>تم تسجيل دخول جديد إلى حسابك</h3>
                        <p><strong>التاريخ:</strong> ${new Date().toLocaleString('ar-SA')}</p>
                        <p><strong>جهاز:</strong> ${req.headers['user-agent']}</p>
                        <p><strong>عنوان IP:</strong> ${req.ip}</p>
                        <br>
                        <p>إذا لم تكن أنت من قام بتسجيل الدخول، يرجى تغيير كلمة المرور فوراً.</p>
                    `
                });
            }

            res.json({
                success: true,
                message: 'تم تسجيل الدخول بنجاح',
                data: {
                    token,
                    refreshToken,
                    user: {
                        id: user._id,
                        username: user.username,
                        email: user.email,
                        profile: user.profile,
                        requires2FA: user.security.twoFactorEnabled
                    }
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تسجيل الدخول'
            });
        }
    }

    // Verify 2FA
    async verify2FA(req, res) {
        try {
            const { userId, token: twoFactorToken } = req.body;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'المستخدم غير موجود'
                });
            }

            // Verify 2FA token
            const verified = speakeasy.totp.verify({
                secret: user.security.twoFactorSecret,
                encoding: 'base32',
                token: twoFactorToken,
                window: 1
            });

            if (!verified) {
                return res.status(401).json({
                    success: false,
                    error: 'رمز التحقق غير صحيح'
                });
            }

            // Generate final token
            const finalToken = jwt.sign(
                { 
                    userId: user._id, 
                    email: user.email, 
                    twoFactorVerified: true 
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                message: 'تم التحقق بنجاح',
                data: {
                    token: finalToken,
                    user: {
                        id: user._id,
                        username: user.username,
                        email: user.email,
                        profile: user.profile
                    }
                }
            });

        } catch (error) {
            console.error('2FA verification error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء التحقق'
            });
        }
    }

    // Setup 2FA
    async setup2FA(req, res) {
        try {
            const userId = req.userId;
            const user = await User.findById(userId);

            if (user.security.twoFactorEnabled) {
                return res.status(400).json({
                    success: false,
                    error: 'المصادقة الثنائية مفعلة بالفعل'
                });
            }

            // Generate secret
            const secret = speakeasy.generateSecret({
                name: `Nexus:${user.email}`,
                length: 20
            });

            // Save secret
            user.security.twoFactorSecret = secret.base32;
            await user.save();

            // Generate QR code
            const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

            res.json({
                success: true,
                message: 'تم إنشاء سر المصادقة الثنائية',
                data: {
                    secret: secret.base32,
                    qrCode: qrCodeUrl,
                    otpauthUrl: secret.otpauth_url
                }
            });

        } catch (error) {
            console.error('2FA setup error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إعداد المصادقة الثنائية'
            });
        }
    }

    // Enable/Disable 2FA
    async toggle2FA(req, res) {
        try {
            const userId = req.userId;
            const { enabled, token } = req.body;

            const user = await User.findById(userId);

            if (enabled) {
                // Verify token before enabling
                const verified = speakeasy.totp.verify({
                    secret: user.security.twoFactorSecret,
                    encoding: 'base32',
                    token: token,
                    window: 1
                });

                if (!verified) {
                    return res.status(401).json({
                        success: false,
                        error: 'رمز التحقق غير صحيح'
                    });
                }

                user.security.twoFactorEnabled = true;
            } else {
                user.security.twoFactorEnabled = false;
            }

            await user.save();

            res.json({
                success: true,
                message: `تم ${enabled ? 'تفعيل' : 'تعطيل'} المصادقة الثنائية بنجاح`,
                data: {
                    twoFactorEnabled: user.security.twoFactorEnabled
                }
            });

        } catch (error) {
            console.error('Toggle 2FA error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تعديل إعدادات المصادقة الثنائية'
            });
        }
    }

    // Refresh token
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(401).json({
                    success: false,
                    error: 'رمز التحديث مطلوب'
                });
            }

            // Verify refresh token
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            const user = await User.findById(decoded.userId);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'رمز التحديث غير صالح'
                });
            }

            // Check if refresh token exists in active sessions
            const sessionExists = user.security.activeSessions.some(
                session => session.token === refreshToken && session.expiresAt > new Date()
            );

            if (!sessionExists) {
                return res.status(401).json({
                    success: false,
                    error: 'انتهت صلاحية رمز التحديث'
                });
            }

            // Generate new tokens
            const newToken = user.generateAuthToken();
            const newRefreshToken = user.generateRefreshToken();

            // Update session
            const sessionIndex = user.security.activeSessions.findIndex(
                session => session.token === refreshToken
            );

            if (sessionIndex !== -1) {
                user.security.activeSessions[sessionIndex].token = newRefreshToken;
                user.security.activeSessions[sessionIndex].lastActivity = new Date();
                await user.save();
            }

            res.json({
                success: true,
                message: 'تم تحديث الرموز بنجاح',
                data: {
                    token: newToken,
                    refreshToken: newRefreshToken
                }
            });

        } catch (error) {
            console.error('Refresh token error:', error);
            res.status(401).json({
                success: false,
                error: 'رمز التحديث غير صالح'
            });
        }
    }

    // Logout
    async logout(req, res) {
        try {
            const userId = req.userId;
            const { refreshToken } = req.body;

            const user = await User.findById(userId);

            // Remove specific session
            user.security.activeSessions = user.security.activeSessions.filter(
                session => session.token !== refreshToken
            );

            await user.save();

            res.json({
                success: true,
                message: 'تم تسجيل الخروج بنجاح'
            });

        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تسجيل الخروج'
            });
        }
    }

    // Logout all sessions
    async logoutAll(req, res) {
        try {
            const userId = req.userId;
            const user = await User.findById(userId);

            // Clear all sessions
            user.security.activeSessions = [];
            await user.save();

            res.json({
                success: true,
                message: 'تم تسجيل الخروج من جميع الجلسات'
            });

        } catch (error) {
            console.error('Logout all error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تسجيل الخروج'
            });
        }
    }

    // Forgot password
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'لا يوجد حساب مرتبط بهذا البريد الإلكتروني'
                });
            }

            // Generate reset token
            const resetToken = jwt.sign(
                { userId: user._id },
                process.env.JWT_SECRET + user.password,
                { expiresIn: '1h' }
            );

            const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

            // Send reset email
            await sendEmail({
                to: email,
                subject: 'إعادة تعيين كلمة المرور',
                html: `
                    <h3>إعادة تعيين كلمة المرور</h3>
                    <p>لقد تلقيت هذا البريد لأنك طلبت إعادة تعيين كلمة مرور حسابك.</p>
                    <p>اضغط على الرابط أدناه لإعادة تعيين كلمة المرور:</p>
                    <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #1877f2; color: white; text-decoration: none; border-radius: 5px;">
                        إعادة تعيين كلمة المرور
                    </a>
                    <p>ينتهي صلاحية هذا الرابط بعد ساعة واحدة.</p>
                    <p>إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد.</p>
                `
            });

            res.json({
                success: true,
                message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني'
            });

        } catch (error) {
            console.error('Forgot password error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إرسال رابط إعادة التعيين'
            });
        }
    }

    // Reset password
    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;

            // Decode token to get user ID
            const decoded = jwt.decode(token);
            const user = await User.findById(decoded.userId);

            if (!user) {
                return res.status(400).json({
                    success: false,
                    error: 'الرابط غير صالح'
                });
            }

            // Verify token with user's password as secret
            jwt.verify(token, process.env.JWT_SECRET + user.password);

            // Update password
            user.password = newPassword;
            
            // Invalidate all sessions
            user.security.activeSessions = [];
            
            await user.save();

            // Send confirmation email
            await sendEmail({
                to: user.email,
                subject: 'تم تغيير كلمة المرور',
                html: `
                    <h3>تم تغيير كلمة مرور حسابك</h3>
                    <p>تم تغيير كلمة مرور حسابك بنجاح.</p>
                    <p>إذا لم تقم بتغيير كلمة المرور، يرجى الاتصال بدعم Nexus فوراً.</p>
                `
            });

            res.json({
                success: true,
                message: 'تم إعادة تعيين كلمة المرور بنجاح'
            });

        } catch (error) {
            console.error('Reset password error:', error);
            res.status(400).json({
                success: false,
                error: 'الرابط غير صالح أو منتهي الصلاحية'
            });
        }
    }

    // Get active sessions
    async getSessions(req, res) {
        try {
            const userId = req.userId;
            const user = await User.findById(userId).select('security.activeSessions');

            const sessions = user.security.activeSessions.map(session => ({
                id: session._id,
                userAgent: session.userAgent,
                ipAddress: session.ipAddress,
                location: session.location,
                lastActivity: session.lastActivity,
                expiresAt: session.expiresAt,
                isCurrent: session.token === req.headers['x-refresh-token']
            }));

            res.json({
                success: true,
                data: sessions
            });

        } catch (error) {
            console.error('Get sessions error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب الجلسات'
            });
        }
    }

    // Revoke session
    async revokeSession(req, res) {
        try {
            const userId = req.userId;
            const { sessionId } = req.params;

            const user = await User.findById(userId);

            // Remove session
            user.security.activeSessions = user.security.activeSessions.filter(
                session => session._id.toString() !== sessionId
            );

            await user.save();

            res.json({
                success: true,
                message: 'تم إنهاء الجلسة بنجاح'
            });

        } catch (error) {
            console.error('Revoke session error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إنهاء الجلسة'
            });
        }
    }
}

module.exports = new AuthController();
