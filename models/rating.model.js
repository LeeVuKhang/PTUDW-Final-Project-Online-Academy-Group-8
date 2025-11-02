// models/rating.model.js
import db from '../utils/db.js';

export default {
  async add(student_id, course_id, value, comment) {
    return db('ratings').insert({
      student_id,
      course_id,
      value,
      comment,
    });
  },

  async findByCourse(course_id) {
    return db('ratings')
      .join('users', 'users.user_id', 'ratings.student_id')
      .where('ratings.course_id', course_id)
      .select('users.username', 'ratings.value', 'ratings.comment', 'ratings.create_time');
  },

   async findTop3RecentFiveStarCourses() {
    return db('ratings as r')
      .join('courses as c', 'c.course_id', 'r.course_id')
      .join('users as u', 'u.user_id', 'r.student_id')
      .where('r.value', 5)
      .select(
        'r.course_id',
        'c.title',
        'u.name as student_name',
        'r.comment',
        'r.value',
        'u.image_url'
      )
      .orderBy('r.create_time', 'desc')
      
      .limit(3);
  }
};
