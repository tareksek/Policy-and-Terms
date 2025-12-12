const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const authenticate = async (req, res, next) => {
  try {
    // 1. الحصول على التوكن
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.token || 
                  req.query?.token;

    if (!token) {
      throw new Error();
    }

    // 2. التحقق من التوكن
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. البحث عن المستخدم
    const user = await User.findOne({
      _id: decoded._id,
      'tokens.token': token,
      isActive: true
    }).select('-password -tokens');

    if (!user) {
      throw new Error();
    }

    // 4. إضافة المستخدم والتوكن للطلب
    req.user = user;
    req.token = token;
    
    // 5. تحديث آخر نشاط
    user.lastActive = new Date();
    await user.save();

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Please authenticate'
    });
  }
};

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || 
                  socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id).select('-password');

    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    socket.userId = user._id;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
};

module.exports = { authenticate, authenticateSocket };