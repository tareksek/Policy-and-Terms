const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // المعلومات الأساسية
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  
  // الصور والمظهر
  profilePicture: {
    type: String,
    default: 'default-profile.jpg'
  },
  coverPhoto: {
    type: String,
    default: 'default-cover.jpg'
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  
  // المعلومات الشخصية
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say']
  },
  city: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  relationship: {
    type: String,
    enum: ['single', 'in-a-relationship', 'engaged', 'married', 'divorced', 'widowed']
  },
  work: {
    type: String,
    trim: true
  },
  education: {
    type: String,
    trim: true
  },
  
  // النظام الاجتماعي
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  friendRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FriendRequest'
  }],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // الأدوار والصلاحيات
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'deactivated', 'banned'],
    default: 'active'
  },
  
  // إعدادات الخصوصية الموسعة
  privacySettings: {
    profileVisibility: {
      type: String,
      enum: ['public', 'friends', 'friends-of-friends', 'private'],
      default: 'friends'
    },
    postVisibility: {
      type: String,
      enum: ['public', 'friends', 'friends-of-friends', 'private', 'custom'],
      default: 'friends'
    },
    friendRequests: {
      type: String,
      enum: ['everyone', 'friends-of-friends', 'no-one'],
      default: 'everyone'
    },
    messages: {
      type: String,
      enum: ['everyone', 'friends', 'friends-of-friends', 'no-one'],
      default: 'friends'
    },
    searchVisibility: {
      type: Boolean,
      default: true
    },
    emailVisibility: {
      type: Boolean,
      default: false
    },
    onlineStatus: {
      type: Boolean,
      default: true
    }
  },
  
  // النظام الأمني والمخالفات
  violations: [{
    type: {
      type: String,
      enum: ['bad-language', 'spam', 'harassment', 'copyright', 'fake-account', 'other']
    },
    content: String,
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    date: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    }
  }],
  
  // نظام الحظر والقيود
  postBanUntil: {
    type: Date
  },
  commentBanUntil: {
    type: Date
  },
  reportBanUntil: {
    type: Date
  },
  messageBanUntil: {
    type: Date
  },
  
  // نظام المتابعة اليومية
  postsToday: {
    type: Number,
    default: 0
  },
  lastPostDate: {
    type: Date
  },
  
  commentsToday: {
    type: Number,
    default: 0
  },
  lastCommentDate: {
    type: Date
  },
  
  reportsToday: {
    type: Number,
    default: 0
  },
  lastReportDate: {
    type: Date
  },
  
  messagesToday: {
    type: Number,
    default: 0
  },
  lastMessageDate: {
    type: Date
  },
  
  // الإحصائيات
  postCount: {
    type: Number,
    default: 0
  },
  commentCount: {
    type: Number,
    default: 0
  },
  videoCount: {
    type: Number,
    default: 0
  },
  friendCount: {
    type: Number,
    default: 0
  },
  followerCount: {
    type: Number,
    default: 0
  },
  followingCount: {
    type: Number,
    default: 0
  },
  
  // الحالة
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  
  // الإعدادات
  emailNotifications: {
    type: Boolean,
    default: true
  },
  pushNotifications: {
    type: Boolean,
    default: true
  },
  theme: {
    type: String,
    enum: ['light', 'dark', 'auto'],
    default: 'light'
  },
  language: {
    type: String,
    default: 'en'
  },
  
  // التحقق
  emailVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // الطابع الزمني
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// إضافة الحقول الافتراضية
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// إضافة virtual للحصول على الاسم الكامل
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// إضافة virtual للعمر
userSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user is admin
userSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

// Check if user is moderator
userSchema.methods.isModerator = function() {
  return this.role === 'moderator' || this.role === 'admin';
};

// Check if user is active
userSchema.methods.isActive = function() {
  return this.status === 'active';
};

// Check if user can post
userSchema.methods.canPost = function() {
  if (!this.isActive()) return false;
  if (this.postBanUntil && this.postBanUntil > new Date()) return false;
  return true;
};

// Check if user can comment
userSchema.methods.canComment = function() {
  if (!this.isActive()) return false;
  if (this.commentBanUntil && this.commentBanUntil > new Date()) return false;
  return true;
};

// Check if user can message
userSchema.methods.canMessage = function() {
  if (!this.isActive()) return false;
  if (this.messageBanUntil && this.messageBanUntil > new Date()) return false;
  return true;
};

// Check if user can report
userSchema.methods.canReport = function() {
  if (!this.isActive()) return false;
  if (this.reportBanUntil && this.reportBanUntil > new Date()) return false;
  return true;
};

// Reset daily counters
userSchema.methods.resetDailyCounters = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (!this.lastPostDate || this.lastPostDate < today) {
    this.postsToday = 0;
  }
  
  if (!this.lastCommentDate || this.lastCommentDate < today) {
    this.commentsToday = 0;
  }
  
  if (!this.lastReportDate || this.lastReportDate < today) {
    this.reportsToday = 0;
  }
  
  if (!this.lastMessageDate || this.lastMessageDate < today) {
    this.messagesToday = 0;
  }
};

// Increment post counter
userSchema.methods.incrementPostCount = function() {
  this.postCount++;
  this.postsToday++;
  this.lastPostDate = new Date();
  this.lastActive = new Date();
};

// Increment comment counter
userSchema.methods.incrementCommentCount = function() {
  this.commentCount++;
  this.commentsToday++;
  this.lastCommentDate = new Date();
  this.lastActive = new Date();
};

// Increment report counter
userSchema.methods.incrementReportCount = function() {
  this.reportsToday++;
  this.lastReportDate = new Date();
};

// Increment message counter
userSchema.methods.incrementMessageCount = function() {
  this.messagesToday++;
  this.lastMessageDate = new Date();
  this.lastActive = new Date();
};

// Add violation
userSchema.methods.addViolation = function(type, content, reportedBy) {
  this.violations.push({
    type,
    content: content ? content.substring(0, 200) : '',
    reportedBy,
    date: new Date()
  });
  
  // Auto-ban after 3 violations
  if (this.violations.length >= 3) {
    const banUntil = new Date();
    banUntil.setDate(banUntil.getDate() + 7); // 7-day ban
    this.postBanUntil = banUntil;
    this.commentBanUntil = banUntil;
  }
};

// Check if user is friends with another user
userSchema.methods.isFriendsWith = function(userId) {
  return this.friends.some(friendId => friendId.toString() === userId.toString());
};

// Check if user is following another user
userSchema.methods.isFollowing = function(userId) {
  return this.following.some(followId => followId.toString() === userId.toString());
};

// Get user's privacy setting
userSchema.methods.getPrivacySetting = function(setting) {
  return this.privacySettings[setting];
};

// Update last seen
userSchema.methods.updateLastSeen = function() {
  this.lastSeen = new Date();
  this.isOnline = true;
};

// Set offline
userSchema.methods.setOffline = function() {
  this.isOnline = false;
  this.lastSeen = new Date();
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

// Create verification token
userSchema.methods.createVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  this.verificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return verificationToken;
};

// Indexes for better performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ firstName: 1, lastName: 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastSeen: -1 });
userSchema.index({ 'privacySettings.profileVisibility': 1 });
userSchema.index({ friends: 1 });
userSchema.index({ followers: 1 });
userSchema.index({ following: 1 });

module.exports = mongoose.model('User', userSchema);