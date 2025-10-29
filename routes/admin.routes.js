import express from 'express';
import userModel from '../models/user.model.js';
import courseModel from '../models/course.model.js';
import categoryModel from '../models/category.model.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const [
            totalCourses,
            totalStudents,
            totalInstructors,
            totalCategories,
            recentCourses,
            recentUsers
        ] = await Promise.all([
            courseModel.count(),
            userModel.countByRole(1), // Students (role = 1) 
            userModel.countByRole(2), // Instructors (role = 2)
            categoryModel.count(),
            courseModel.findRecentCourses(5),
            userModel.findRecentUsers(5)
        ]);

        // Biến chứa thống kê trong dashboard
        const stats = {
            totalCourses: totalCourses.count || 0,
            totalStudents: totalStudents.count || 0,
            totalInstructors: totalInstructors.count || 0,
            totalCategories: totalCategories.count || 0
        };

        res.render('vwAdmin/dashboard', {
            layout: 'admin',
            stats: stats,
            recentCourses: recentCourses,
            recentUsers: recentUsers,
            title: 'Dashboard Quản trị'
        });
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        console.error('Chi tiết lỗi:', error);
        res.status(500).send('Lỗi hệ thống: ' + error.message);
    }
});

// Route để refresh dữ liệu dashboard
router.get('/refresh', async (req, res) => {
    try {
        const [
            totalCourses,
            totalStudents,
            totalInstructors,
            totalCategories,
            recentCourses,
            recentUsers
        ] = await Promise.all([
            courseModel.count(),
            userModel.countByRole(1), // Students (role = 1) 
            userModel.countByRole(2), // Instructors (role = 2)
            categoryModel.count(),
            courseModel.findRecentCourses(5),
            userModel.findRecentUsers(5)
        ]);

        // Trả về dữ liệu JSON để AJAX xử lý
        res.json({
            success: true,
            stats: {
                totalCourses: totalCourses.count || 0,
                totalStudents: totalStudents.count || 0,
                totalInstructors: totalInstructors.count || 0,
                totalCategories: totalCategories.count || 0
            },
            recentCourses: recentCourses,
            recentUsers: recentUsers
        });
    } catch (error) {
        console.error('Error refreshing dashboard data:', error);
        res.json({ success: false, error: error.message });
    }
});

export default router;