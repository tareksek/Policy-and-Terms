const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Role ${req.user.role} is not authorized to access this resource`
      });
    }

    next();
  };
};

// صلاحيات خاصة للتحقق من ملكية المحتوى
const isOwner = (model, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const Model = require(`../../models/${model}`);
      const document = await Model.findById(req.params[paramName]);

      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found'
        });
      }

      // التحقق إذا كان المستخدم هو المالك
      const isOwner = document.userId && 
                      document.userId.toString() === req.user._id.toString();
      
      const isAuthor = document.author && 
                       document.author.toString() === req.user._id.toString();

      if (!isOwner && !isAuthor && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You are not authorized to modify this resource'
        });
      }

      req.document = document;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  };
};

// للتحقق من صلاحيات المدير
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  next();
};

module.exports = { authorize, isOwner, isAdmin };