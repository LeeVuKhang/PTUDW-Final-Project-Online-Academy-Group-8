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
    
    findByIdDetailed(id){
        return db('users')
            .where('users.user_id', id)
            .first();
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
            .orderBy('user_id', 'desc')
            .limit(limit);
    }
}