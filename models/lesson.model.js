import db from '../utils/db.js';

export default {
  async findByCourse(course_id) {
    return db('lessons')
      .join('chapters', 'lessons.chapter_id', 'chapters.chapter_id')
      .where('chapters.course_id', course_id)
      .select('lessons.*')
      .orderBy('lessons.order_index');
  }
};
