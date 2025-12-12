const paginate = (model, populateOptions = []) => {
  return async (req, res, next) => {
    try {
      // إعدادات التقسيم من query parameters
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;
      
      // الفرز
      let sort = {};
      if (req.query.sort) {
        const sortBy = req.query.sort.split(':');
        sort[sortBy[0]] = sortBy[1] === 'desc' ? -1 : 1;
      } else {
        sort = { createdAt: -1 }; // ترتيب افتراضي
      }
      
      // الفلترة
      let filter = { ...req.filter }; // يمكن تمرير filter من middleware سابق
      if (req.query.filter) {
        try {
          const queryFilter = JSON.parse(req.query.filter);
          filter = { ...filter, ...queryFilter };
        } catch (err) {
          // تجاهل إذا كان filter غير صالح
        }
      }
      
      // البحث
      if (req.query.search) {
        const searchRegex = new RegExp(req.query.search, 'i');
        // ضع هنا حقول البحث الخاصة بالنموذج
        filter.$or = [
          { title: searchRegex },
          { content: searchRegex },
          { 'author.name': searchRegex }
        ];
      }
      
      // تنفيذ الاستعلام
      let query = model.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);
      
      // إضافة populate إذا كان مطلوباً
      if (populateOptions && populateOptions.length > 0) {
        populateOptions.forEach(populate => {
          query = query.populate(populate);
        });
      }
      
      const results = await query;
      
      // الحصول على العدد الإجمالي
      const total = await model.countDocuments(filter);
      
      // حساب المعلومات
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;
      
      // إضافة البيانات للطلب
      req.pagination = {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
        results
      };
      
      // إعداد الاستجابة
      res.paginatedResults = {
        success: true,
        count: results.length,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage
        },
        data: results
      };
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

// لمعالجة cursor-based pagination (للتحديثات الفورية)
const cursorPaginate = (model, cursorField = '_id') => {
  return async (req, res, next) => {
    try {
      const cursor = req.query.cursor;
      const limit = parseInt(req.query.limit, 10) || 20;
      
      let filter = {};
      if (cursor) {
        filter[cursorField] = { $lt: cursor };
      }
      
      const results = await model.find(filter)
        .sort({ [cursorField]: -1 })
        .limit(limit + 1); // جلب واحد إضافي للتحقق
      
      const hasNextPage = results.length > limit;
      const items = hasNextPage ? results.slice(0, -1) : results;
      const nextCursor = hasNextPage ? items[items.length - 1][cursorField] : null;
      
      req.cursorPagination = {
        items,
        nextCursor,
        hasNextPage
      };
      
      res.cursorPaginatedResults = {
        success: true,
        data: items,
        pagination: {
          nextCursor,
          hasNextPage
        }
      };
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  paginate,
  cursorPaginate
};