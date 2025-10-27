import db from '../utils/db.js';
import categoryModel from "./category.model.js";

function addWatchlistSubquery(query, studentId) {
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

function addEnrollmentSubquery(query, studentId) {
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

export async function findNewestCourses(limit = 12, studentId = null) {
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
}

export async function findMostViewsCourses(limit = 12, studentId = null) {
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
}

export async function findImpressiveCoursesLastWeek(limit = 4, studentId = null) {
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
}

export async function findCoursesByFilter(categoryId, studentId, limit, offset) {
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

  query = addWatchlistSubquery(query, studentId);
  query = addEnrollmentSubquery(query, studentId);
  return query.limit(limit).offset(offset);
}

export async function countCoursesByFilter(categoryId) {
  let countQuery = db("courses");

  if (categoryId && categoryId !== 0 && categoryId !== 'all') {
    countQuery.where("catid", categoryId);
  }

  return countQuery.count("* as amount").first();
}

export function search(keyword, limit, offset) {
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
}

export function countSearch(keyword) {
  return db('courses')
    .whereRaw(`fts @@ to_tsquery(remove_accents(?))`, [keyword])
    .count('* as amount')
    .first();
}
