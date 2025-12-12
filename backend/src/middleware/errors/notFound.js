const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// معالج للمسارات التي انتهت صلاحيتها (deprecated)
const deprecatedHandler = (req, res, next) => {
  res.status(410).json({
    status: 'fail',
    message: 'This API endpoint is deprecated. Please use the new version.',
    documentation: 'https://api.yoursite.com/docs/v2'
  });
};

// للتحقق من الصيانة
const maintenanceHandler = (req, res, next) => {
  if (process.env.MAINTENANCE_MODE === 'true') {
    return res.status(503).json({
      status: 'fail',
      message: 'The server is under maintenance. Please try again later.',
      estimatedRestoration: process.env.MAINTENANCE_UNTIL || 'Soon'
    });
  }
  next();
};

// للتحقق من نسخة API
const apiVersionHandler = (req, res, next) => {
  const requestedVersion = req.header('X-API-Version') || 'v1';
  const supportedVersions = ['v1', 'v2'];
  
  if (!supportedVersions.includes(requestedVersion)) {
    return res.status(400).json({
      status: 'fail',
      message: `Unsupported API version. Supported versions: ${supportedVersions.join(', ')}`,
      requestedVersion
    });
  }
  
  req.apiVersion = requestedVersion;
  next();
};

module.exports = {
  notFoundHandler,
  deprecatedHandler,
  maintenanceHandler,
  apiVersionHandler
};