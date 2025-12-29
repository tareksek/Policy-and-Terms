const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.FRONTEND_PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// Middleware
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", BACKEND_URL]
    }
  } : false
}));
app.use(cors());
app.use(compression());
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(express.json());

// Proxy API requests to backend in development
if (!isProduction) {
  app.use('/api', createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    logLevel: 'debug'
  }));
}

// Serve static files from React build in production
if (isProduction) {
  app.use(express.static(path.join(__dirname, 'build')));
}

// API Routes for frontend server
app.get('/api/frontend/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'frontend-server',
    frontendUrl: `http://localhost:${PORT}`,
    backendUrl: BACKEND_URL,
    timestamp: new Date().toISOString(),
    mode: isProduction ? 'production' : 'development'
  });
});

// Serve React app for all routes in production
if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 FRONTEND SERVER IS RUNNING
  ==============================
  📁 Local:    http://localhost:${PORT}
  🔗 Backend:  ${BACKEND_URL}
  ⚙️  Mode:     ${isProduction ? 'Production' : 'Development'}
  ⏰ Started:  ${new Date().toLocaleString()}
  
  📊 Endpoints:
  - Frontend: http://localhost:${PORT}
  - Health:   http://localhost:${PORT}/api/frontend/health
  - Backend:  ${BACKEND_URL}
  `);
});
