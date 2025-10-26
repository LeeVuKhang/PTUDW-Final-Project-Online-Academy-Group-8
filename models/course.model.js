import db from '../utils/db.js';

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

export async function findNewestCourses(limit = 12, studentId = null) {
  let query = db('courses as c')
    .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
    .leftJoin('users as u', 'c.instructor_id', 'u.user_id')
    .select(
      'c.course_id', 'c.title', 'c.price', 'c.discount_price', 'c.image_url', 'c.views',
      'cat.cat_name',
      'u.name as instructor_name', 'u.user_id as instructor_id',
      'c.last_update'
    )
    .orderBy('c.last_update', 'desc')
    .limit(limit);

  query = addWatchlistSubquery(query, studentId);
  return await query;
}

export async function findMostViewsCourses(limit = 12, studentId = null) {
  let query = db('courses as c')
    .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
    .leftJoin('users as u', 'c.instructor_id', 'u.user_id')
    .select(
      'c.course_id', 'c.title', 'c.price', 'c.discount_price', 'c.image_url', 'c.views',
      'cat.cat_name',
      'u.name as instructor_name', 'u.user_id as instructor_id'
    )
    .orderBy('c.views', 'desc')
    .limit(limit);

  query = addWatchlistSubquery(query, studentId);
  return await query;
}

export async function findImpressiveCoursesLastWeek(limit = 4, studentId = null) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let query = db('courses as c')
    .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
    .leftJoin('users as u', 'c.instructor_id', 'u.user_id')
    .select(
      'c.course_id', 'c.title', 'c.price', 'c.discount_price', 'c.image_url', 'c.views',
      'cat.cat_name',
      'u.name as instructor_name', 'u.user_id as instructor_id',
      'c.last_update'
    )
    .where('c.last_update', '>=', sevenDaysAgo)
    .orderBy('c.views', 'desc')
    .limit(limit);

  query = addWatchlistSubquery(query, studentId);
  return await query;
}

export async function findCoursesByFilter(categoryId, studentId, limit, offset) {
  let query = db("courses as c")
    .join("categories as cat", "c.catid", "cat.cat_id")
    .leftJoin("users as u", "c.instructor_id", "u.user_id")
    .leftJoin("ratings as r", "c.course_id", "r.course_id")
    .select(
      "c.course_id", "c.title", "c.price", "c.discount_price", "c.image_url", "c.views", // Added c.views here
      "cat.cat_name",
      "u.name as instructor_name", "u.user_id as instructor_id",
      db.raw("COALESCE(AVG(r.value), 0) as avg_rating"),
      db.raw("COUNT(DISTINCT r.rating_id) as rating_count")
    )
    .groupBy("c.course_id", "cat.cat_name", "u.name", "u.user_id");

  if (categoryId && categoryId !== 0 && categoryId !== 'all') {
    query.where("c.catid", categoryId);
  }

  query = addWatchlistSubquery(query, studentId);

  return query.limit(limit).offset(offset);
}

export async function countCoursesByFilter(categoryId) {
  let countQuery = db("courses");

  if (categoryId && categoryId !== 0 && categoryId !== 'all') {
    countQuery.where("catid", categoryId);
  }

  return countQuery.count("* as amount").first();
}