import db from '../utils/db.js';

const instructorModel = {
    
    // 1. Lấy thông tin cơ bản của Giảng viên
   async findProfileById(userId) {
        const profile = await db('users')
            .select('user_id', 'name', 'email','image_url', 'self_introduction', 'role') 
            .where('user_id', userId)
            .first(); 

        if (profile) {
            profile.bio = profile.self_introduction || ''; 
            delete profile.self_introduction;
        }

        return profile;
    },

    async getInstructorStats(instructorId) {
        
        console.log(`[DEBUG] Đang tìm kiếm khóa học cho instructor_id: ${instructorId}`);

        const coursesData = await db('courses')
            .select('course_id')
            .where('instructor_id', instructorId);

        const courseIds = coursesData ? coursesData.map(c => c.course_id) : [];
        const totalCourses = courseIds.length;

        console.log(`[DEBUG] Số khóa học tìm thấy: ${totalCourses}`);
        
        let totalReviews = 0;
        let avgRating = '0.0';
        let totalStudents = 0;

        if (totalCourses > 0) {
            console.log("[DEBUG] Đang tính toán Ratings và Students...");
            
            // Tính Rating và Reviews
            const ratingsResult = await db('ratings')
                .whereIn('course_id', courseIds)
                .select(
                    db.raw('COUNT(??) AS total_reviews', ['rating_id']),
                    db.raw('AVG(??) AS avg_rating', ['value'])
                )
                .first();

            if (ratingsResult) {
                totalReviews = parseInt(ratingsResult.total_reviews) || 0; 
                avgRating = ratingsResult.avg_rating ? parseFloat(ratingsResult.avg_rating).toFixed(1) : '0.0';
            }
            
            // Tính Tổng số Học viên
            const uniqueStudentsResult = await db('enrollments')
                .whereIn('course_id', courseIds)
                .countDistinct('student_id as total_students')
                .first();
            
            if (uniqueStudentsResult) {
                totalStudents = parseInt(uniqueStudentsResult.total_students) || 0;
            }
            
            console.log(`[DEBUG] Stats cuối cùng: Avg: ${avgRating}, Reviews: ${totalReviews}, Students: ${totalStudents}`);

        } else {
            console.log("[DEBUG] KHÔNG CÓ KHÓA HỌC nào được gán cho Giảng viên này.");
        }

        return {
            avg_rating: avgRating,
            total_reviews: totalReviews,
            total_students: totalStudents,
            total_courses: totalCourses
        };
    }, 

    async findCoursesByInstructor(instructorId) {
        const courses = await db('courses')
            .select('course_id', 'title', 'tinydes', 'image_url', 'discount_price', 'price')
            .where('instructor_id', instructorId);
        
        return courses || [];
    }
};

export default instructorModel;