import db from '../utils/db.js';

export default {
  // Thêm học viên vào khóa học
  async enroll(student_id, course_id) {
    return db('enrollments').insert({
      student_id,
      course_id,
      status: 'enrolled',
      progress: 0,
    });
  },

  // Kiểm tra học viên đã ghi danh chưa
  async checkEnrollment(student_id, course_id) {
    return db('enrollments')
      .where({ student_id, course_id })
      .first();
  },

  // Lấy danh sách khóa học đã ghi danh
  async findByStudent(student_id) {
    return db('enrollments')
      .join('courses', 'enrollments.course_id', 'courses.course_id')
      .where('enrollments.student_id', student_id)
      .select('courses.*', 'enrollments.progress', 'enrollments.status');
  },

  // Cập nhật tiến độ học
  async updateProgress(student_id, course_id, progress, lastLesson) {
    return db('enrollments')
      .where({ student_id, course_id })
      .update({
        progress,
        last_watched_lesson: lastLesson,
      });
  },
  async findCoursesByStudent(user_id) {
    return db('enrollments as e')
      .join('courses as c', 'e.course_id', 'c.course_id')
      .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
      .where('e.student_id', user_id)
      .select(
        'c.course_id',
        'c.title',
        'c.image_url',
        'c.price',
        'c.discount_price',
        'cat.cat_name',
        'e.erm_date as enrolled_at',
        db.raw('COALESCE(e.progress, 0) as progress')
      )
      .orderBy('e.erm_date', 'desc');
  },

  //back up if need pagination
  async findCoursesByStudentPaged(user_id, { limit = 12, offset = 0 } = {}) {
    return db('enrollments as e')
      .join('courses as c', 'e.course_id', 'c.course_id')
      .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
      .where('e.student_id', user_id)
      .select(
        'c.course_id',
        'c.title',
        'c.image_url',
        'c.price',
        'c.discount_price',
        'cat.cat_name',
        'e.erm_date as enrolled_at',
        db.raw('COALESCE(e.progress, 0) as progress')
      )
      .orderBy('e.erm_date', 'desc')
      .limit(limit)
      .offset(offset);
  },
};
