import express from 'express';
import courseModel from '../models/course.model.js';
import categoryModel from '../models/category.model.js';

import userModel from '../models/user.model.js';

const router = express.Router();

// 4.2 Quản lý khóa học - Xem danh sách
router.get('/', async (req, res) => {
    try {
        const LIMIT = 10;
        let page = +req.query.page || 1;
        if (page < 1) page = 1;

        const filters = {
            categoryId: req.query.category || 'all',
            instructorId: req.query.instructor || 'all',
            searchTerm: req.query.search || ''
        };

        const totalResult = await courseModel.countAllForAdmin(filters);
        const totalCourses = totalResult.total || 0;
        const totalPages = Math.ceil(totalCourses / LIMIT);

        if (page > totalPages && totalPages > 0) {
            page = totalPages;
        }
        const offset = (page - 1) * LIMIT;

        const pageNumbers = [];
        for (let i = 1; i <= totalPages; i++) {
            pageNumbers.push({
                value: i,
                isCurrent: i === page
            });
        }

        const [courses, categories, instructors] = await Promise.all([
            courseModel.findAllForAdmin(LIMIT, offset, filters),
            categoryModel.findAll(),
            userModel.findAllInstructors()
        ]);

        res.render('vwAdminCourse/list', {
            layout: 'admin',
            courses: courses,
            categories: categories,
            instructors: instructors,
            pagination: {
                page: page,
                totalPages: totalPages,
                pageNumbers: pageNumbers,
                hasPrevPage: page > 1,
                hasNextPage: page < totalPages,
                prevPage: page - 1,
                nextPage: page + 1
            },
            totalItems: totalCourses,
            currentItemsCount: courses.length,
            itemType: 'khóa học',
            queryParams: req.query,
            currentFilters: filters,
            title: 'Quản lý khóa học'
        });
    } catch (error) {
        console.error('Error loading courses:', error);
        res.status(500).send('Lỗi hệ thống');
    }
});

// 4.2 Quản lý khóa học - Xem chi tiết
router.get('/:id', async (req, res) => {
    try {
        const courseId = req.params.id;
        const course = await courseModel.findByIdForAdmin(courseId);
        
        if (!course) {
            return res.status(404).send('Không tìm thấy khóa học');
        }
        
        res.render('vwAdminCourse/details', {
            layout: 'admin',
            course: course,
            title: `Chi tiết - ${course.title}`
        });
    } catch (error) {
        console.error('Error loading course details:', error);
        res.status(500).send('Lỗi hệ thống');
    }
});

// 4.2 Quản lý khóa học - Trang chỉnh sửa
router.get('/:id/edit', async (req, res) => {
    try {
        const courseId = req.params.id;
        const course = await courseModel.findByIdForAdmin(courseId);
        const categories = await categoryModel.findAll();
        
        if (!course) {
            return res.status(404).send('Không tìm thấy khóa học');
        }
        
        res.render('vwAdminCourse/edit', {
            layout: 'admin',
            course: course,
            categories: categories,
            title: `Chỉnh sửa - ${course.title}`
        });
    } catch (error) {
        console.error('Error loading course edit page:', error);
        res.status(500).send('Lỗi hệ thống');
    }
});

// 4.2 Quản lý khóa học - Gỡ bỏ khóa học
router.post('/:id/remove', async (req, res) => {
    try {
        const courseId = req.params.id;
        
        // Kiểm tra khóa học có tồn tại không
        const course = await courseModel.findByID(courseId);
        if (!course) {
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy khóa học' 
            });
        }
        
        // Thực hiện gỡ bỏ khóa học
        await courseModel.removeCourse(courseId);
        
        res.redirect('/admin/courses');
    } catch (error) {
        console.error('Error removing course:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Lỗi hệ thống khi gỡ bỏ khóa học' 
        });
    }
});

router.post('/:id/disable', async (req, res) => {
  try {
    const courseId = req.params.id;
    await courseModel.update(courseId, { is_disabled: true });
    res.redirect('/admin/courses'); // or res.redirect('back')
  } catch (e) {
    console.error('[admin-course] disable failed:', e);
    res.status(500).send('Disable failed');
  }
});

// Re-enable a course
router.post('/:id/enable', async (req, res) => {
  try {
    const courseId = req.params.id;
    await courseModel.update(courseId, { is_disabled: false });
    res.redirect('/admin/courses');
  } catch (e) {
    console.error('[admin-course] enable failed:', e);
    res.status(500).send('Enable failed');
  }
});

export default router;