const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.token || 
                  req.query?.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({
        _id: decoded._id,
        'tokens.token': token,
        isActive: true
      }).select('-password -tokens');

      if (user) {
        req.user = user;
        req.token = token;
        req.isAuthenticated = true;
      }
    }

    req.isAuthenticated = req.isAuthenticated || false;
    next();
  } catch (error) {
    // في حالة الخطأ، نمرر بدون مصادقة
    req.isAuthenticated = false;
    next();
  }
};

module.exports = optionalAuth;