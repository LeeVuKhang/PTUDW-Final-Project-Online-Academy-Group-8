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
  }
};
