const NodeCache = require('node-cache');
const redis = require('redis');

// Cache محلي (للتطوير)
const localCache = new NodeCache({
  stdTTL: 600, // 10 دقائق افتراضياً
  checkperiod: 120,
  useClones: false
});

// Redis cache (للإنتاج)
let redisClient;
if (process.env.REDIS_URL) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL
  });
  
  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });
  
  redisClient.connect();
}

// Middleware للتخزين المؤقت
const cacheMiddleware = (duration = 600) => {
  return async (req, res, next) => {
    // تجاهل طلبات غير GET
    if (req.method !== 'GET') {
      return next();
    }
    
    const key = `cache:${req.originalUrl}`;
    let cachedData;
    
    try {
      // محاولة جلب البيانات من Redis أولاً
      if (redisClient) {
        cachedData = await redisClient.get(key);
      }
      
      // إذا لم توجد في Redis، جرب Cache المحلي
      if (!cachedData) {
        cachedData = localCache.get(key);
      }
      
      // إذا كانت البيانات موجودة في cache
      if (cachedData) {
        const data = JSON.parse(cachedData);
        return res.json(data);
      }
      
      // إذا لم تكن في cache، احفظ response الأصلي
      const originalSend = res.send;
      res.send = function(data) {
        // تخزين في cache
        if (res.statusCode === 200) {
          const cacheData = JSON.stringify({
            data: JSON.parse(data),
            timestamp: Date.now()
          });
          
          if (redisClient) {
            redisClient.setEx(key, duration, cacheData);
          } else {
            localCache.set(key, cacheData, duration);
          }
        }
        
        originalSend.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

// لحذف cache بناءً على النمط
const clearCacheByPattern = async (pattern) => {
  try {
    if (redisClient) {
      const keys = await redisClient.keys(`cache:${pattern}`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }
    
    // لحذف من cache المحلي
    const localKeys = localCache.keys();
    const matchingKeys = localKeys.filter(key => key.includes(pattern));
    matchingKeys.forEach(key => localCache.del(key));
    
    console.log(`Cleared cache for pattern: ${pattern}`);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

// Middleware لحذف cache بعد عمليات التعديل
const invalidateCache = (patterns = []) => {
  return async (req, res, next) => {
    // حفظ الدالة الأصلية
    const originalSend = res.send;
    
    res.send = async function(data) {
      // إذا كانت العملية ناجحة (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          // حذف cache للأنماط المحددة
          for (const pattern of patterns) {
            await clearCacheByPattern(pattern);
          }
          
          // حذف cache عام إذا لزم
          if (req.user) {
            await clearCacheByPattern(`*user:${req.user._id}*`);
          }
        } catch (error) {
          console.error('Error invalidating cache:', error);
        }
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// لحفظ بيانات المستخدم في cache
const cacheUserData = (userId, data, ttl = 3600) => {
  const key = `user:${userId}:data`;
  const cacheData = JSON.stringify(data);
  
  if (redisClient) {
    redisClient.setEx(key, ttl, cacheData);
  } else {
    localCache.set(key, cacheData, ttl);
  }
};

// لجلب بيانات المستخدم من cache
const getUserFromCache = async (userId) => {
  const key = `user:${userId}:data`;
  
  try {
    let cachedData;
    
    if (redisClient) {
      cachedData = await redisClient.get(key);
    } else {
      cachedData = localCache.get(key);
    }
    
    return cachedData ? JSON.parse(cachedData) : null;
  } catch (error) {
    console.error('Error getting user from cache:', error);
    return null;
  }
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  cacheUserData,
  getUserFromCache,
  clearCacheByPattern
};