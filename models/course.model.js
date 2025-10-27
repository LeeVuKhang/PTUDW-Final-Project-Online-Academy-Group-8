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

// Admin functions
export async function findAllForAdmin() {
  return await db('courses as c')
    .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
    .leftJoin('users as u', 'c.instructor_id', 'u.user_id')
    .select(
      'c.course_id',
      'c.title',
      'c.tinydes',
      'c.price',
      'c.discount_price',
      'c.image_url',
      'c.views',
      'c.is_complete',
      'c.created_at',
      'c.last_update',
      'cat.cat_name as category_name',
      'u.name as instructor_name'
    )
    .orderBy('c.created_at', 'desc');
}

export async function findByIdForAdmin(courseId) {
  const result = await db('courses as c')
    .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
    .leftJoin('users as u', 'c.instructor_id', 'u.user_id')
    .select(
      'c.*',
      'cat.cat_name as category_name',
      'u.name as instructor_name'
    )
    .where('c.course_id', courseId)
    .first();
  
  return result;
}

export async function findByID(courseId) {
  return await db('courses')
    .where('course_id', courseId)
    .first();
}

export async function add(courseData) {
  const [courseId] = await db('courses').insert({
    ...courseData,
    created_at: new Date(),
    last_update: new Date()
  }).returning('course_id');
  
  return courseId;
}

export async function update(courseId, courseData) {
  return await db('courses')
    .where('course_id', courseId)
    .update({
      ...courseData,
      last_update: new Date()
    });
}

export async function removeCourse(courseId) {
  return await db('courses')
    .where('course_id', courseId)
    .del();
}

export async function updateStatus(courseId, isComplete) {
  return await db('courses')
    .where('course_id', courseId)
    .update({
      is_complete: isComplete,
      last_update: new Date()
    });
}