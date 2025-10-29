import db from '../utils/db.js';
import categoryModel from "./category.model.js";

export function addWatchlistSubquery(query, studentId) {
  if (studentId) {
    query.select(
      db.raw(
        `EXISTS (
          SELECT 1 FROM watchlists w 
          WHERE w.course_id = c.course_id AND w.student_id = ?
        ) as "isInWatchlist"`,
        [studentId]
      )
    );
  } else {
    query.select(db.raw('false as "isInWatchlist"'));
  }
  return query;
}

export function addEnrollmentSubquery(query, studentId) {
  if (studentId) {
    query.select(
      db.raw(
        `EXISTS (
          SELECT 1 FROM enrollments e 
          WHERE e.course_id = c.course_id AND e.student_id = ?
        ) as "isEnrolled"`,
        [studentId]
      )
    );
  } else {
    query.select(db.raw('false as "isEnrolled"'));
  }
  return query;
}


export default {
   async  findNewestCourses(limit = 12, studentId = null) {
    let query = db('courses as c')
      .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
      .leftJoin('users as u', 'c.instructor_id', 'u.user_id')
      .leftJoin("ratings as r", "c.course_id", "r.course_id")
      .select(
        'c.course_id', 'c.title', 'c.price', 'c.discount_price', 'c.image_url', 'c.views',
        'cat.cat_name',
        'u.name as instructor_name', 'u.user_id as instructor_id',
        'c.last_update',
        db.raw("COALESCE(AVG(r.value), 0) as avg_rating"),
        db.raw("COUNT(DISTINCT r.rating_id) as rating_count")
      )
      .orderBy('c.last_update', 'desc')
      .groupBy('c.course_id', 'c.title', 'c.price', 'c.discount_price', 'c.image_url', 'c.views', 'cat.cat_name', 'u.name', 'u.user_id', 'c.last_update') // THÊM GROUP BY
      .limit(limit);

    query = addWatchlistSubquery(query, studentId);
    query = addEnrollmentSubquery(query, studentId);
    return await query;
  },

   async  findMostViewsCourses(limit = 12, studentId = null) {
    let query = db('courses as c')
      .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
      .leftJoin('users as u', 'c.instructor_id', 'u.user_id')
      .leftJoin("ratings as r", "c.course_id", "r.course_id")
      .select(
        'c.course_id', 'c.title', 'c.price', 'c.discount_price', 'c.image_url', 'c.views',
        'cat.cat_name',
        'u.name as instructor_name', 'u.user_id as instructor_id',
        db.raw("COALESCE(AVG(r.value), 0) as avg_rating"),
        db.raw("COUNT(DISTINCT r.rating_id) as rating_count")
      )
      .orderBy('c.views', 'desc')
      .groupBy('c.course_id', 'c.title', 'c.price', 'c.discount_price', 'c.image_url', 'c.views', 'cat.cat_name', 'u.name', 'u.user_id') // THÊM GROUP BY
      .limit(limit);

    query = addWatchlistSubquery(query, studentId);
    query = addEnrollmentSubquery(query, studentId);
    return await query;
  },

   async  findImpressiveCoursesLastWeek(limit = 4, studentId = null) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let query = db('courses as c')
      .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
      .leftJoin('users as u', 'c.instructor_id', 'u.user_id')
      .leftJoin("ratings as r", "c.course_id", "r.course_id")
      .select(
        'c.course_id', 'c.title', 'c.price', 'c.discount_price', 'c.image_url', 'c.views',
        'cat.cat_name',
        'u.name as instructor_name', 'u.user_id as instructor_id',
        'c.last_update',
        db.raw("COALESCE(AVG(r.value), 0) as avg_rating"),
        db.raw("COUNT(DISTINCT r.rating_id) as rating_count")
      )
      .where('c.last_update', '>=', sevenDaysAgo)
      .orderBy('c.views', 'desc')
      .groupBy('c.course_id', 'c.title', 'c.price', 'c.discount_price', 'c.image_url', 'c.views', 'cat.cat_name', 'u.name', 'u.user_id', 'c.last_update') // THÊM GROUP BY
      .limit(limit);

    query = addWatchlistSubquery(query, studentId);
    query = addEnrollmentSubquery(query, studentId);
    return await query;
  },

   async  findCoursesByFilter(categoryId, studentId, limit, offset, sort = 'newest') {
    // Lấy toàn bộ ID danh mục con (bao gồm cả chính nó)
    let categoryIds = [];
    if (categoryId && categoryId !== 0 && categoryId !== 'all') {
      categoryIds = await categoryModel.findAllDescendants(categoryId);
      categoryIds.push(categoryId); // thêm chính nó
    }

    let query = db("courses as c")
      .join("categories as cat", "c.catid", "cat.cat_id")
      .leftJoin("users as u", "c.instructor_id", "u.user_id")
      .leftJoin("ratings as r", "c.course_id", "r.course_id")
      .select(
        "c.course_id", "c.title", "c.price", "c.discount_price", "c.image_url", "c.views",
        "cat.cat_name",
        "u.name as instructor_name",
        "u.user_id as instructor_id",
        db.raw("COALESCE(AVG(r.value), 0) as avg_rating"),
        db.raw("COUNT(DISTINCT r.rating_id) as rating_count")
      )
      .groupBy("c.course_id", "c.title", "c.price", "c.discount_price", "c.image_url", "c.views", "cat.cat_name", "u.name", "u.user_id"); // Đã SỬA LẠI GROUP BY cho chính xác

    if (categoryIds.length > 0) {
      query.whereIn("c.catid", categoryIds);
    }

    switch (sort) {
      case 'price_asc':
        query.orderBy('c.discount_price', 'asc');
        break;
      case 'price_desc':
        query.orderBy('c.discount_price', 'desc');
        break;
      case 'views':
        query.orderBy('c.views', 'desc');
        break;
      case 'rating':
        query.orderBy(db.raw('avg_rating'), 'desc');
        break;
      case 'newest':
      default:
        query.orderBy('c.course_id', 'desc'); // hoặc c.created_at nếu có
        break;
    }

    query = addWatchlistSubquery(query, studentId);
    query = addEnrollmentSubquery(query, studentId);
    return query.limit(limit).offset(offset);
  },

   async  countCoursesByFilter(categoryId) {
    let countQuery = db("courses");

    if (categoryId && categoryId !== 0 && categoryId !== 'all') {
      countQuery.where("catid", categoryId);
    }

    return countQuery.count("* as amount").first();
  },

    search(keyword, limit, offset) {
    return db('courses as c')
      .join('categories as cat', 'c.catid', 'cat.cat_id')
      .leftJoin('users as u', 'c.instructor_id', 'u.user_id')
      .leftJoin('ratings as r', 'c.course_id', 'r.course_id')
      .select(
        'c.course_id',
        'c.title',
        'c.image_url',
        'c.price',
        'c.discount_price',
        'c.views',
        'u.user_id as instructor_id',
        'u.name as instructor_name',
        'cat.cat_name'
      )
      .count('r.rating_id as rating_count')
      .avg('r.value as avg_rating')
      .whereRaw(`fts @@ to_tsquery(remove_accents(?))`, [keyword])
      .groupBy('c.course_id', 'u.user_id', 'u.name', 'cat.cat_name')
      .limit(limit)
      .offset(offset);
  },

    countSearch(keyword) {
    return db('courses')
      .whereRaw(`fts @@ to_tsquery(remove_accents(?))`, [keyword])
      .count('* as amount')
      .first();
  },
  async findRelatedCourses(categoryId, currentCourseId, limit = 4, studentId = null) {
        let relatedQuery = db("courses as c")
            .leftJoin("categories as cat", "c.catid", "cat.cat_id")
            .leftJoin("users as u", "c.instructor_id", "u.user_id")
            .leftJoin("ratings as r", "c.course_id", "r.course_id")
            .where("c.catid", categoryId)
            .andWhereNot("c.course_id", currentCourseId)
            .select(
                "c.course_id", "c.title", "c.image_url", "c.price", "c.discount_price", "c.views",
                "cat.cat_name",
                "u.user_id as instructor_id", "u.name as instructor_name",
                db.raw("COALESCE(AVG(r.value), 0) as avg_rating"),
                db.raw("COUNT(DISTINCT r.rating_id) as rating_count")
            )
            .groupBy("c.course_id", "cat.cat_name", "u.user_id", "u.name")
            .orderByRaw("RANDOM()")
            .limit(limit);

        relatedQuery = addWatchlistSubquery(relatedQuery, studentId);
        relatedQuery = addEnrollmentSubquery(relatedQuery, studentId);

        return await relatedQuery;
    },
  findByID(id) {
    return db('courses').where('course_id', id).first();
  },
  findByCat(id) {
    return db('courses').where('catid', id);
  },
  findPageByCat(catID, limit, offset) {
    return db('courses').where('catid', catID).limit(limit).offset(offset);
  },
  countByCat(catID) {
    return db('courses')
      .where('catid', catID)
      .count('catid as amount')
      .first();
  },
  add(course, instrucID) {
    return db('courses').insert(course).returning('course_id');
  },
  update(course_id, course) {
    return db('courses').where('course_id', course_id).update(course);
  },
  // findAll(){
  //     return db('courses')
  //         .join('categories', 'courses.catid', '=', 'categories.cat_id') 
  //         .select('courses.*', 'categories.cat_name as category_name'); 
  // },
  async findAllByInstructorId(instructor_id, limit, offset, categoryId = 'all', searchTerm = '') {
    let categoryIds = [];
    if (categoryId && categoryId !== 'all') {
      categoryIds = await categoryModel.findAllDescendants(categoryId);
      categoryIds.push(parseInt(categoryId, 10));
    }

    const query = db('courses as c')
      .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
      .leftJoin('ratings as r', 'c.course_id', 'r.course_id')
      .leftJoin('enrollments as e', 'c.course_id', 'e.course_id')
      .where('c.instructor_id', instructor_id)
      .select(
        'c.course_id', 'c.title', 'c.tinydes as short_description', 'c.image_url', 'c.is_complete', 'c.views',
        'cat.cat_name as category_name',
        db.raw('COALESCE(AVG(r.value), 0) as avg_rating'),
        db.raw('COUNT(DISTINCT r.rating_id) as rating_count'),
        db.raw('COUNT(DISTINCT e.erm_id) as student_count')
      )
      .groupBy('c.course_id', 'c.title', 'c.tinydes', 'c.image_url', 'c.is_complete', 'c.views', 'cat.cat_name')
      .orderBy('c.course_id', 'desc');

    if (categoryIds.length > 0) {
      query.whereIn('c.catid', categoryIds);
    }


    if (searchTerm) {
    query.whereRaw(`c.fts @@ to_tsquery('simple', remove_accents(?))`, [searchTerm.replace(/\s+/g, ' & ')]);
  }

    return query.limit(limit).offset(offset);
  },

  async countAllByInstructorId(instructor_id, categoryId = 'all', searchTerm = '') {
    let categoryIds = [];
    if (categoryId && categoryId !== 'all') {
      categoryIds = await categoryModel.findAllDescendants(categoryId);
      categoryIds.push(parseInt(categoryId, 10));
    }

    const query = db('courses')
      .where('instructor_id', instructor_id)
      .count('course_id as total')
      .first();

    if (categoryIds.length > 0) {
      query.whereIn('catid', categoryIds);
    }

    if (searchTerm) {
    query.whereRaw(`fts @@ to_tsquery('simple', remove_accents(?))`, [searchTerm.replace(/\s+/g, ' & ')]);
  }

    return query;
  },
  deleteCascade(course_id) {
    return db.transaction(async trx => {
      const chapterRows = await trx('chapters').where('course_id', course_id).select('chapter_id');
      const chapterIds = chapterRows.map(row => row.chapter_id);
      if (chapterIds.length > 0) {
        await trx('lessons').whereIn('chapter_id', chapterIds).del();
      }
      await trx('chapters').where('course_id', course_id).del();
      await Promise.all([
        trx('ratings').where('course_id', course_id).del(),
        trx('enrollments').where('course_id', course_id).del(),
        trx('watchlists').where('course_id', course_id).del(),
        trx('cart_items').where('course_id', course_id).del()
      ]);
      const deletedCount = await trx('courses').where('course_id', course_id).del();
      if (deletedCount === 0) {
        throw new Error('Không tìm thấy khóa học để xóa.');
      }
      return deletedCount;
    });
  },

  findAllForAdmin() {
    return db('courses')
      .leftJoin('categories', 'courses.catid', 'categories.cat_id')
      .leftJoin('users', 'courses.instructor_id', 'users.user_id')
      .leftJoin(
        db('enrollments')
          .select('course_id')
          .count('* as student_count')
          .groupBy('course_id')
          .as('course_stats'),
        'courses.course_id', 'course_stats.course_id'
      )
      .select(
        'courses.*',
        'categories.cat_name as category_name',
        'users.name as instructor_name',
        db.raw('COALESCE(course_stats.student_count, 0) as student_count')
      )
      .orderBy('courses.last_update', 'desc');
  },

  findByIdForAdmin(id) {
    return db('courses')
      .leftJoin('categories', 'courses.catid', 'categories.cat_id')
      .leftJoin('users', 'courses.instructor_id', 'users.user_id')
      .leftJoin(
        db('enrollments')
          .select('course_id')
          .count('* as student_count')
          .groupBy('course_id')
          .as('course_stats'),
        'courses.course_id', 'course_stats.course_id'
      )
      .select(
        'courses.*',
        'categories.cat_name as category_name',
        'users.name as instructor_name',
        db.raw('COALESCE(course_stats.student_count, 0) as student_count')
      )
      .where('courses.course_id', id)
      .first();
  },

  removeCourse(id) {
    return db('courses').where('course_id', id).del();
  },

  count() {
    return db('courses').count('* as count').first();
  },

  findRecentCourses(limit = 5) {
    return db('courses')
      .leftJoin('categories', 'courses.catid', 'categories.cat_id')
      .leftJoin('users', 'courses.instructor_id', 'users.user_id')
      .select(
        'courses.*',
        'categories.cat_name as category_name',
        'users.name as instructor_name'
      )
      .orderBy('courses.last_update', 'desc')
      .limit(limit);
  },

  getTopCategories(limit = 5) {
    return db('courses')
      .leftJoin('categories', 'courses.catid', 'categories.cat_id')
      .select('categories.cat_name', 'categories.cat_id')
      .count('courses.course_id as course_count')
      .groupBy('categories.cat_id', 'categories.cat_name')
      .orderBy('course_count', 'desc')
      .limit(limit);
  }
};
