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
  }
};
