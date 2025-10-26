import db from '../utils/db.js';

export async function findNewestCourses(limit = 12) {
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

export async function findMostViewsCourses(limit = 12) {
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

export async function findImpressiveCoursesLastWeek(limit = 4) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

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
      'c.views',
      'c.last_update'
    )
    .where('c.last_update', '>=', sevenDaysAgo)   // chỉ lấy trong 7 ngày qua
    .orderBy('c.views', 'desc')                   // sắp xếp theo lượt xem giảm dần
    .limit(limit);
}

