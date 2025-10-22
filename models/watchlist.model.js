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
    // 1. Kiểm tra xem item đã tồn tại chưa
    const item = await db('watchlists').where({
        student_id: student_id,
        course_id: course_id
    }).first();

    // 2. Nếu chưa tồn tại, thêm mới
    if (!item) {
        return db('watchlists').insert({
            student_id: student_id,
            course_id: course_id
        });
    }
    // 3. Nếu đã tồn tại, không làm gì cả
    return null;
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