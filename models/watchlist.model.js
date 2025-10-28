import db from '../utils/db.js';

export default {
  async findCoursesByStudentID(student_id) {
    const ratingSubquery = db('ratings as r_sub')
      .select('r_sub.course_id')
      .avg('r_sub.value as avg_rating')
      .count('r_sub.rating_id as rating_count')
      .groupBy('r_sub.course_id')
      .as('rating_stats');

    const studentSubquery = db('enrollments as e_sub')
      .select('e_sub.course_id')
      .countDistinct('e_sub.student_id as student_count') 
      .groupBy('e_sub.course_id')
      .as('student_stats');

    const courses = await db('watchlists as w')
      .join('courses as c', 'w.course_id', 'c.course_id')
      .join('users as u', 'c.instructor_id', 'u.user_id') 
      .leftJoin(ratingSubquery, 'c.course_id', 'rating_stats.course_id') 
      .leftJoin(studentSubquery, 'c.course_id', 'student_stats.course_id') 
      .where('w.student_id', student_id)
      .select(
        'c.course_id',
        'c.title',
        'c.tinydes',
        'c.image_url', 
        'c.price',
        'c.discount_price',
        'u.name as instructor_name', 
        db.raw('COALESCE(rating_stats.avg_rating, 0) as avg_rating'),
        db.raw('COALESCE(rating_stats.rating_count, 0) as rating_count'),
        db.raw('COALESCE(student_stats.student_count, 0) as student_count')
      );
      
      return courses;
  },

  async add(student_id, course_id) {
    const item = await db('watchlists').where({
        student_id: student_id,
        course_id: course_id
    }).first();

    if (!item) {
        return db('watchlists').insert({
            student_id: student_id,
            course_id: course_id
        });
    }
    return null;
  },
  
  remove(student_id, course_id) {
    return db('watchlists')
      .where({
        student_id: student_id,
        course_id: course_id
      })
      .del();
  }
};