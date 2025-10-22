// File: models/wishlist.model.js
import db from '../utils/db.js';

export default {
  /**
   * Lấy tất cả các khóa học trong watchlist của một sinh viên.
   * Chúng ta cần JOIN với nhiều bảng để lấy thông tin đầy đủ
   * như template watchlist.handlebars yêu cầu.
   */
  findCoursesByStudentID(student_id) {
    return db('watchlists as w')
      .join('courses as c', 'w.course_id', 'c.course_id')
      .join('users as u', 'c.instructor_id', 'u.user_id') // Lấy tên giảng viên
      .leftJoin('ratings as r', 'c.course_id', 'r.course_id') // Lấy thông tin đánh giá
      .leftJoin('enrollments as e', 'c.course_id', 'e.course_id') // Lấy số lượng học viên
      .where('w.student_id', student_id)
      .select(
        'c.course_id',
        'c.title',
        'c.tinydes',
        'c.image_url',
        'c.price',
        'c.discount_price',
        'u.name as instructor_name', // Tên giảng viên
        // Dùng COALESCE để trả về 0 nếu chưa có đánh giá
        db.raw('COALESCE(AVG(r.value), 0) as avg_rating'),
        db.raw('COUNT(DISTINCT r.rating_id) as rating_count'),
        db.raw('COUNT(DISTINCT e.erm_id) as student_count')
      )
      .groupBy('c.course_id', 'u.name'); // Nhóm theo course_id và tên giảng viên
  },

  /**
   * Xóa một khóa học khỏi wishlist của sinh viên
   */
  remove(student_id, course_id) {
    return db('watchlists')
      .where({
        student_id: student_id,
        course_id: course_id
      })
      .del();
  }
};