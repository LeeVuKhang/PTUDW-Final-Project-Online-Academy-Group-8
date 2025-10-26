import db from '../utils/db.js';

export async function findNewestCourses(limit = 10) {
  return await db('courses as c')
    .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
    .leftJoin('users as u', 'c.instructor_id', 'u.user_id')
    .select(
      'c.course_id',
      'c.title',
      'c.price',
      'c.discount_price',
      'c.image_url',
      'cat.cat_name as category_name',
      'u.name as instructor_name',
      'c.last_update',
      'c.views'
    )
    .orderBy('c.last_update', 'desc')
    .limit(limit);
}

export async function findMostViewsCourses(limit = 10) {
  return await db('courses as c')
    .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
    .leftJoin('users as u', 'c.instructor_id', 'u.user_id')
    .select(
      'c.course_id',
      'c.title',
      'c.price',
      'c.discount_price',
      'c.image_url',
      'cat.cat_name as category_name',
      'u.name as instructor_name',
      'c.views'
    )
    .orderBy('c.views', 'desc')
    .limit(limit);
}

export async function findCoursesByFilter(categoryId, studentId, limit, offset) {
  let query = db("courses as c")
    .join("categories as cat", "c.catid", "cat.cat_id")
    .leftJoin("users as u", "c.instructor_id", "u.user_id")
    .leftJoin("ratings as r", "c.course_id", "r.course_id")
    .select(
      "c.course_id", "c.title", "c.price", "c.discount_price", "c.image_url",
      "cat.cat_name",
      "u.name as instructor_name", "u.user_id as instructor_id",
      db.raw("COALESCE(AVG(r.value), 0) as avg_rating"),
      db.raw("COUNT(DISTINCT r.rating_id) as rating_count")
    )
    .groupBy("c.course_id", "cat.cat_name", "u.name", "u.user_id");

  if (categoryId && categoryId !== 0 && categoryId !== 'all') {
    query.where("c.catid", categoryId);
  }

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

  return query.limit(limit).offset(offset);
}

export async function countCoursesByFilter(categoryId) {
  let countQuery = db("courses");

  if (categoryId && categoryId !== 0 && categoryId !== 'all') {
    countQuery.where("catid", categoryId);
  }
  
  return countQuery.count("* as amount").first();
}