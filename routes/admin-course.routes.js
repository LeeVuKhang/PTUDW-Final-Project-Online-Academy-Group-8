import express from 'express';
import courseModel from '../models/course.model.js';
import categoryModel from '../models/category.model.js';

const router = express.Router();

// 4.2 Quản lý khóa học - Xem danh sách
router.get('/', async (req, res) => {
    try {
        const courses = await courseModel.findAllForAdmin();
        const categories = await categoryModel.findAll();
        
        res.render('vwAdminCourse/list', {
            layout: 'admin',
            courses: courses,
            categories: categories,
            title: 'Quản lý khóa học',
            success: req.query.success
        });
    } catch (error) {
        console.error('Error loading courses:', error);
        res.status(500).send('Lỗi hệ thống');
    }
});

// 4.2 Quản lý khóa học - Hiển thị form thêm khóa học
router.get('/add', async (req, res) => {
    try {
        const categories = await categoryModel.findAll();
        
        res.render('vwAdminCourse/add', {
            layout: 'admin',
            categories: categories,
            title: 'Thêm khóa học mới'
        });
    } catch (error) {
        console.error('Error loading add course form:', error);
        res.status(500).send('Lỗi hệ thống');
    }
});

// 4.2 Quản lý khóa học - Xử lý thêm khóa học
router.post('/add', async (req, res) => {
    try {
        console.log('POST /add received, req.body:', req.body); // Debug log
        const categories = await categoryModel.findAll();
        
        // Kiểm tra req.body
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.render('vwAdminCourse/add', {
                layout: 'admin',
                categories: categories,
                title: 'Thêm khóa học mới',
                error: 'Không thể đọc dữ liệu form. Vui lòng thử lại.'
            });
        }
        
        // Validation dữ liệu đầu vào
        const { title, catid, tinydes, fulldes, price, discount_price, total_hours, level, image_url } = req.body;
        
        if (!title || !catid || !price) {
            return res.render('vwAdminCourse/add', {
                layout: 'admin',
                categories: categories,
                title: 'Thêm khóa học mới',
                error: 'Vui lòng điền đầy đủ thông tin bắt buộc (Tên khóa học, Danh mục, Giá)',
                formData: req.body
            });
        }
        
        // Validate giá
        const priceNum = parseInt(price) || 0;
        const discountPriceNum = discount_price ? parseInt(discount_price) : null;
        
        if (priceNum <= 0) {
            return res.render('vwAdminCourse/add', {
                layout: 'admin',
                categories: categories,
                title: 'Thêm khóa học mới',
                error: 'Giá khóa học phải lớn hơn 0',
                formData: req.body
            });
        }
        
        if (discountPriceNum && discountPriceNum >= priceNum) {
            return res.render('vwAdminCourse/add', {
                layout: 'admin',
                categories: categories,
                title: 'Thêm khóa học mới',
                error: 'Giá khuyến mãi phải nhỏ hơn giá gốc',
                formData: req.body
            });
        }
        
        // Tạo object course
        const newCourse = {
            title: title.trim(),
            tinydes: tinydes ? tinydes.trim() : null,
            fulldes: fulldes ? fulldes.trim() : null,
            price: priceNum,
            discount_price: discountPriceNum,
            catid: parseInt(catid),
            instructor_id: req.session.authUser.user_id, // Admin tạo khóa học
            total_hours: total_hours ? parseFloat(total_hours) : null,
            level: level || null,
            image_url: image_url || 'https://via.placeholder.com/400x300?text=Course+Image',
            views: 0,
            is_complete: false
        };
        
        // Thêm khóa học vào database
        await courseModel.add(newCourse);
        
        // Redirect về trang danh sách với thông báo thành công
        res.redirect('/admin/courses?success=added');
        
    } catch (error) {
        console.error('Error adding course:', error);
        const categories = await categoryModel.findAll();
        res.render('vwAdminCourse/add', {
            layout: 'admin',
            categories: categories,
            title: 'Thêm khóa học mới',
            error: 'Có lỗi xảy ra khi thêm khóa học: ' + error.message,
            formData: req.body
        });
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

// 4.2 Quản lý khóa học - Tạm dừng khóa học
router.post('/:id/disable', async (req, res) => {
    try {
        const courseId = req.params.id;
        
        await courseModel.updateStatus(courseId, false);
        
        res.json({ 
            success: true, 
            message: 'Đã tạm dừng khóa học' 
        });
    } catch (error) {
        console.error('Error disabling course:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Lỗi hệ thống' 
        });
    }
});

// 4.2 Quản lý khóa học - Kích hoạt khóa học
router.post('/:id/enable', async (req, res) => {
    try {
        const courseId = req.params.id;
        
        await courseModel.updateStatus(courseId, true);
        
        res.json({ 
            success: true, 
            message: 'Đã kích hoạt khóa học' 
        });
    } catch (error) {
        console.error('Error enabling course:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Lỗi hệ thống' 
        });
    }
});

// 4.2 Quản lý khóa học - Hiển thị form chỉnh sửa khóa học
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
        console.error('Error loading edit course form:', error);
        res.status(500).send('Lỗi hệ thống');
    }
});

// 4.2 Quản lý khóa học - Xử lý cập nhật khóa học
router.post('/:id/edit', async (req, res) => {
    try {
        const courseId = req.params.id;
        const { title, tinydes, fulldes, price, discount_price, catid, total_hours, level, image_url } = req.body;
        
        console.log('Updating course with data:', req.body);
        
        // Validation
        if (!title || !title.trim()) {
            const course = await courseModel.findByIdForAdmin(courseId);
            const categories = await categoryModel.findAll();
            return res.render('vwAdminCourse/edit', {
                layout: 'admin',
                course: course,
                categories: categories,
                title: `Chỉnh sửa - ${course.title}`,
                error: 'Tên khóa học không được để trống',
                formData: req.body
            });
        }
        
        if (!catid) {
            const course = await courseModel.findByIdForAdmin(courseId);
            const categories = await categoryModel.findAll();
            return res.render('vwAdminCourse/edit', {
                layout: 'admin',
                course: course,
                categories: categories,
                title: `Chỉnh sửa - ${course.title}`,
                error: 'Vui lòng chọn danh mục',
                formData: req.body
            });
        }
        
        const priceNum = parseFloat(price);
        const discountPriceNum = discount_price ? parseFloat(discount_price) : null;
        
        if (!priceNum || priceNum <= 0) {
            const course = await courseModel.findByIdForAdmin(courseId);
            const categories = await categoryModel.findAll();
            return res.render('vwAdminCourse/edit', {
                layout: 'admin',
                course: course,
                categories: categories,
                title: `Chỉnh sửa - ${course.title}`,
                error: 'Giá khóa học phải lớn hơn 0',
                formData: req.body
            });
        }
        
        if (discountPriceNum && discountPriceNum >= priceNum) {
            const course = await courseModel.findByIdForAdmin(courseId);
            const categories = await categoryModel.findAll();
            return res.render('vwAdminCourse/edit', {
                layout: 'admin',
                course: course,
                categories: categories,
                title: `Chỉnh sửa - ${course.title}`,
                error: 'Giá khuyến mãi phải nhỏ hơn giá gốc',
                formData: req.body
            });
        }
        
        // Tạo object course update
        const updateData = {
            title: title.trim(),
            tinydes: tinydes ? tinydes.trim() : null,
            fulldes: fulldes ? fulldes.trim() : null,
            price: priceNum,
            discount_price: discountPriceNum,
            catid: parseInt(catid),
            total_hours: total_hours ? parseFloat(total_hours) : null,
            level: level || null,
            image_url: image_url || null
        };
        
        // Cập nhật khóa học trong database
        await courseModel.update(courseId, updateData);
        
        // Redirect về trang chi tiết với thông báo thành công
        res.redirect(`/admin/courses/${courseId}?success=updated`);
        
    } catch (error) {
        console.error('Error updating course:', error);
        const course = await courseModel.findByIdForAdmin(courseId);
        const categories = await categoryModel.findAll();
        res.render('vwAdminCourse/edit', {
            layout: 'admin',
            course: course,
            categories: categories,
            title: `Chỉnh sửa - ${course.title}`,
            error: 'Có lỗi xảy ra khi cập nhật khóa học: ' + error.message,
            formData: req.body
        });
    }
});

export default router;