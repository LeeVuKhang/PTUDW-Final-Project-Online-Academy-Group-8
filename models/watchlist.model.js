import db from '../utils/db.js';

export default {
  findCoursesByStudentID(student_id) {
    return db('watchlists as w')
      .join('courses as c', 'w.course_id', 'c.course_id') 
      .where('w.student_id', student_id)
      .select(
        'c.course_id',
        'c.title',
        'c.tinydes',
        'c.image_url',
        'c.price',
        'c.discount_price'
      );
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