const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegistration, validateLogin } = require('../middleware/validation');

// تسجيل مستخدم جديد
router.post('/register', validateRegistration, authController.register);

// تسجيل الدخول
router.post('/login', validateLogin, authController.login);

// تسجيل الخروج
router.post('/logout', authController.logout);

// تحديث token
router.post('/refresh-token', authController.refreshToken);

// التحقق من البريد الإلكتروني
router.get('/verify-email/:token', authController.verifyEmail);

// طلب إعادة تعيين كلمة المرور
router.post('/forgot-password', authController.forgotPassword);

// إعادة تعيين كلمة المرور
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;