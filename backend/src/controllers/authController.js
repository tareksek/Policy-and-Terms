
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailService');

/* ======================================================
   Auth Controller
====================================================== */
class AuthController {

  /* ===================== Register ===================== */
  async register(req, res) {
    try {
      const {
        username,
        firstName,
        lastName,
        email,
        password,
        dateOfBirth,
        gender
      } = req.body;

      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل'
        });
      }

      const user = await User.create({
        username,
        email,
        password,
        firstName,
        lastName,
        dateOfBirth,
        gender
      });

      /* Email verification token (optional) */
      const verificationToken = user.createVerificationToken();
      await user.save({ validateBeforeSave: false });

      /* Tokens */
      const token = user.generateAuthToken();
      const refreshToken = user.generateRefreshToken();

      /* Save session */
      user.security.activeSessions.push({
        token: refreshToken,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      await user.save();

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
            firstName: user.firstName,
            lastName: user.lastName,
            requires2FA: user.security.twoFactorEnabled
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /* ===================== Login ===================== */
  async login(req, res) {
    try {
      const { email, password, rememberMe } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'البريد الإلكتروني وكلمة المرور مطلوبان'
        });
      }

      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({
          success: false,
          error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
        });
      }

      if (!user.isActive()) {
        return res.status(403).json({
          success: false,
          error: 'الحساب غير نشط'
        });
      }

      user.updateLastSeen();
      await user.save({ validateBeforeSave: false });

      const token = user.generateAuthToken();
      const refreshToken = user.generateRefreshToken();

      user.security.activeSessions.push({
        token: refreshToken,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        lastActivity: new Date(),
        expiresAt: new Date(
          Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000
        )
      });

      await user.save();

      res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        data: {
          token,
          refreshToken,
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            requires2FA: user.security.twoFactorEnabled
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /* ===================== 2FA ===================== */
  async setup2FA(req, res) {
    try {
      const user = await User.findById(req.userId);

      if (user.security.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          error: 'المصادقة الثنائية مفعلة بالفعل'
        });
      }

      const secret = speakeasy.generateSecret({
        name: `Nexus:${user.email}`
      });

      user.security.twoFactorSecret = secret.base32;
      await user.save();

      const qrCode = await qrcode.toDataURL(secret.otpauth_url);

      res.json({
        success: true,
        data: {
          secret: secret.base32,
          qrCode
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async verify2FA(req, res) {
    try {
      const { token } = req.body;
      const user = await User.findById(req.userId);

      const verified = speakeasy.totp.verify({
        secret: user.security.twoFactorSecret,
        encoding: 'base32',
        token
      });

      if (!verified) {
        return res.status(401).json({
          success: false,
          error: 'رمز غير صحيح'
        });
      }

      user.security.twoFactorEnabled = true;
      await user.save();

      res.json({
        success: true,
        message: 'تم تفعيل المصادقة الثنائية'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /* ===================== Email Verification ===================== */
  async verifyEmail(req, res) {
    try {
      const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

      const user = await User.findOne({
        verificationToken: hashedToken,
        verificationTokenExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'رمز غير صالح'
        });
      }

      user.emailVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;
      await user.save();

      res.json({
        success: true,
        message: 'تم التحقق من البريد الإلكتروني'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /* ===================== Logout ===================== */
  async logout(req, res) {
    try {
      const user = await User.findById(req.userId);

      user.security.activeSessions = user.security.activeSessions.filter(
        s => s.token !== req.body.refreshToken
      );

      user.setOffline();
      await user.save({ validateBeforeSave: false });

      res.json({
        success: true,
        message: 'تم تسجيل الخروج بنجاح'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new AuthController();