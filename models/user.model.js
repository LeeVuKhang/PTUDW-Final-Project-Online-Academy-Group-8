import db from '../utils/db.js';
export default{
    async add(user){
        const rows = await db('users').insert(user).returning(['user_id']);
        return rows[0].user_id;
    },
    findByUsername(username){
        return db('users').where('username', username).first();
    },
    patch(id, user){
        return db('users').where('user_id', id).update(user);
    },
    findByEmail(email) {
        return db('users').where('email', email).first();
    },
        
    // Admin functions 4.3 
    findAllStudents(){
        return db('users')
            .where('role', 1) // 1 = Student
            .leftJoin(
                db('enrollments')
                    .select('student_id')
                    .count('* as enrolled_courses_count')
                    .groupBy('student_id')
                    .as('course_counts'),
                'users.user_id', 'course_counts.student_id'
            )
            .select(
                'users.*',
                db.raw('COALESCE(course_counts.enrolled_courses_count, 0) as enrolled_courses_count')
            )
            .orderBy('users.user_id', 'desc');
    },
    
    findAllInstructors(){
        return db('users')
            .where('role', 2) // 2 = Instructor
            .leftJoin(
                db('courses')
                    .select('instructor_id')
                    .count('* as courses_count')
                    .groupBy('instructor_id')
                    .as('instructor_stats'),
                'users.user_id', 'instructor_stats.instructor_id'
            )
            .leftJoin(
                db('enrollments')
                    .join('courses', 'enrollments.course_id', 'courses.course_id')
                    .select('courses.instructor_id')
                    .count('* as total_students')
                    .groupBy('courses.instructor_id')
                    .as('student_stats'),
                'users.user_id', 'student_stats.instructor_id'
            )
            .select(
                'users.*',
                db.raw('COALESCE(instructor_stats.courses_count, 0) as courses_count'),
                db.raw('COALESCE(student_stats.total_students, 0) as total_students')
            )
            .orderBy('users.user_id', 'desc');
    },
    
    findById(id){
        return db('users').where('user_id', id).first();
    },
    
    async findByIdDetailed(id){
        const user = await db('users')
            .where('users.user_id', id)
            .first();
            
        if (!user) return null;
        
        // Nếu là học viên (role = 1)
        if (user.role === 1) {
            // Đếm số khóa học đã đăng ký
            const enrollmentStats = await db('enrollments')
                .where('student_id', id)
                .count('* as enrolled_courses_count')
                .first();
            
            // Đếm số khóa học trong wishlist
            const wishlistStats = await db('watchlists')
                .where('student_id', id)
                .count('* as watchlist_count')
                .first();
                
            // Đếm số đánh giá đã đưa
            const ratingStats = await db('ratings')
                .where('student_id', id)
                .count('* as ratings_count')
                .first();
                
            // Lấy danh sách khóa học đã đăng ký
            const enrolledCourses = await db('enrollments')
                .join('courses', 'enrollments.course_id', 'courses.course_id')
                .join('users', 'courses.instructor_id', 'users.user_id')
                .where('enrollments.student_id', id)
                .select(
                    'courses.title',
                    'courses.course_id',
                    'enrollments.progress',
                    'enrollments.erm_date',
                    'enrollments.status',
                    'users.name as instructor_name'
                )
                .orderBy('enrollments.erm_date', 'desc')
                .limit(10);
                
            user.enrolled_courses_count = enrollmentStats.enrolled_courses_count || 0;
            user.watchlist_count = wishlistStats.watchlist_count || 0;
            user.ratings_count = ratingStats.ratings_count || 0;
            user.enrolled_courses = enrolledCourses;
        }
        
        // Nếu là giảng viên (role = 2)
        if (user.role === 2) {
            // Đếm số khóa học đã tạo
            const courseStats = await db('courses')
                .where('instructor_id', id)
                .count('* as courses_count')
                .first();
                
            // Đếm tổng số học viên
            const studentStats = await db('enrollments')
                .join('courses', 'enrollments.course_id', 'courses.course_id')
                .where('courses.instructor_id', id)
                .count('* as total_students')
                .first();
                
            // Tính điểm trung bình
            const ratingStats = await db('ratings')
                .join('courses', 'ratings.course_id', 'courses.course_id')
                .where('courses.instructor_id', id)
                .avg('ratings.value as avg_rating')
                .first();
                
            // Lấy danh sách khóa học đã tạo
            const instructorCourses = await db('courses')
                .join('categories', 'courses.catid', 'categories.cat_id')
                .leftJoin(
                    db('enrollments')
                        .select('course_id')
                        .count('* as student_count')
                        .groupBy('course_id')
                        .as('course_students'),
                    'courses.course_id', 'course_students.course_id'
                )
                .where('courses.instructor_id', id)
                .select(
                    'courses.*',
                    'categories.cat_name as category_name',
                    db.raw('COALESCE(course_students.student_count, 0) as student_count')
                )
                .orderBy('courses.last_update', 'desc')
                .limit(10);
                
            user.courses_count = courseStats.courses_count || 0;
            user.total_students = studentStats.total_students || 0;
            user.avg_rating = ratingStats.avg_rating || 0;
            user.instructor_courses = instructorCourses;
        }
        
        return user;
    },
    
    addInstructor(instructor){
        return db('users').insert(instructor);
    },
    
    updateRole(id, role){
        return db('users')
            .where('user_id', id)
            .update({ role: role });
    },
    
    // Dashboard functions
    count(){
        return db('users').count('* as count').first();
    },
    
    countByRole(role){
        return db('users')
            .where('role', role)
            .count('* as count')
            .first();
    },
    
    findRecentUsers(limit = 5){
        return db('users')
            .where('role', '!=', 0) // Loại bỏ admin (role = 0)
            .orderBy('user_id', 'desc') // Sắp xếp theo user_id (user mới có ID cao hơn)
            .limit(limit);
    },

    // Delete user function
    delete(userId) {
        return db('users').where('user_id', userId).del();
    }
}