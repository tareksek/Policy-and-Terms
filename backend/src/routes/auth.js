const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { sendEmail } = require('../utils/emailService');

// Register
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists with this email or username'
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

    // Send welcome email
    await sendEmail({
      to: email,
      subject: 'Welcome to Nexus!',
      html: `<h1>Welcome ${firstName}!</h1>
             <p>Your account has been successfully created.</p>`
    });

    res.status(201).json({
      message: 'Registration successful',
      token,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check account status
    if (user.accountStatus !== 'active') {
      return res.status(403).json({ 
        error: 'Account is ' + user.accountStatus 
      });
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    // Generate tokens
    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    // Log session
    const sessionData = {
      token: refreshToken,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };

    user.security.activeSessions.push(sessionData);
    await user.save();

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        requires2FA: user.security.twoFactorEnabled
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify 2FA
router.post('/verify-2fa', async (req, res) => {
  try {
    const { token, userId, twoFactorToken } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.security.twoFactorSecret,
      encoding: 'base32',
      token: twoFactorToken
    });

    if (!verified) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    // Generate final tokens
    const finalToken = jwt.sign(
      { userId: user._id, email: user.email, twoFactorVerified: true },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: '2FA verified successfully',
      token: finalToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Setup 2FA
router.post('/setup-2fa', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    const secret = speakeasy.generateSecret({
      name: `Nexus:${user.email}`
    });

    user.security.twoFactorSecret = secret.base32;
    await user.save();

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      otpauthUrl: secret.otpauth_url
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Enable/Disable 2FA
router.post('/toggle-2fa', auth, async (req, res) => {
  try {
    const { enabled, token } = req.body;
    const user = await User.findById(req.userId);

    if (enabled) {
      const verified = speakeasy.totp.verify({
        secret: user.security.twoFactorSecret,
        encoding: 'base32',
        token
      });

      if (!verified) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }

      user.security.twoFactorEnabled = true;
    } else {
      user.security.twoFactorEnabled = false;
    }

    await user.save();

    res.json({
      message: `2FA ${enabled ? 'enabled' : 'disabled'} successfully`,
      twoFactorEnabled: user.security.twoFactorEnabled
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Refresh Token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if refresh token exists in active sessions
    const sessionExists = user.security.activeSessions.some(
      session => session.token === refreshToken
    );

    if (!sessionExists) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const newToken = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();

    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
router.post('/logout', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const { refreshToken } = req.body;

    // Remove specific session
    user.security.activeSessions = user.security.activeSessions.filter(
      session => session.token !== refreshToken
    );

    await user.save();

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout All Sessions
router.post('/logout-all', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    user.security.activeSessions = [];
    await user.save();

    res.json({ message: 'All sessions logged out' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET + user.password,
      { expiresIn: '1h' }
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
             <p>This link expires in 1 hour.</p>`
    });

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const decoded = jwt.decode(token);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    jwt.verify(token, process.env.JWT_SECRET + user.password);

    user.password = newPassword;
    await user.save();

    // Invalidate all sessions
    user.security.activeSessions = [];
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;