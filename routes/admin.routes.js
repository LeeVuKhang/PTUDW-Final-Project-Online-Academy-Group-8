import express from 'express';
import userModel from '../models/user.model.js';
import courseModel from '../models/product.model.js';
import categoryModel from '../models/category.model.js';

const router = express.Router();

// Admin Dashboard - Trang chủ quản trị - VERSION ĐƠN GIẢN CHO TEST
router.get('/', async (req, res) => {
    try {
        // Get basic statistics 
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
            totalCourses: totalCourses.count || 0, // Tổng số courses
            totalStudents: totalStudents.count || 0, // Tổng số học viên
            totalInstructors: totalInstructors.count || 0, // Tổng số giảng viên
            totalCategories: totalCategories.count || 0 // Tổng số lĩnh vực
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

export default router;