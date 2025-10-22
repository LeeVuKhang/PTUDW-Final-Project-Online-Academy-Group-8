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
      'c.last_update'
    )
    .orderBy('c.last_update', 'desc')
    .limit(limit);
}
