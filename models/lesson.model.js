// models/lesson.model.js
import db from '../utils/db.js';

export default {
  async findByCourse(course_id) {
    return db('lessons')
      .where('course_id', course_id)
      .orderBy('order_index');
  }
};
