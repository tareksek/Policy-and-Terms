const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redisClient = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL)
  : new Redis();

// عام لجميع الطلبات
const generalLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:general:'
  }),
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100, // 100 طلب لكل IP
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

// للمصادقة
const authLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:'
  }),
  windowMs: 60 * 60 * 1000, // ساعة
  max: 5, // 5 محاولات تسجيل دخول
  message: {
    error: 'Too many login attempts, please try again after an hour.',
    retryAfter: 60 * 60
  }
});

// للتعليقات والمنشورات
const contentLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:content:'
  }),
  windowMs: 10 * 60 * 1000, // 10 دقائق
  max: 20, // 20 منشور/تعليق
  message: {
    error: 'You are posting too fast, please slow down.',
    retryAfter: 10 * 60
  }
});

// للرسائل
const messageLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:message:'
  }),
  windowMs: 1 * 60 * 1000, // دقيقة
  max: 15, // 15 رسالة
  message: {
    error: 'Too many messages, please wait a moment.',
    retryAfter: 60
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  contentLimiter,
  messageLimiter
};