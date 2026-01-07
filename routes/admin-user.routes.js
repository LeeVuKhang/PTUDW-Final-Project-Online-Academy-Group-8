import express from 'express';
import userModel from '../models/user.model.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Xem danh sách học viên 
router.get('/students', async (req, res) => {
    try {
        const LIMIT = 10;
        const page = +req.query.page || 1;
        const offset = (page - 1) * LIMIT;

        // Get filters
        const filters = {
            searchTerm: req.query.search || ''
        };

        // Fetch data in parallel
        const [students, totalStudents] = await Promise.all([
            userModel.findAllStudentsPaginated(LIMIT, offset, filters),
            userModel.countAllStudents(filters)
        ]);

        const totalPages = Math.ceil(totalStudents / LIMIT);
        const currentPage = Math.min(Math.max(1, page), totalPages || 1);

        // Generate page numbers
        const pageNumbers = [];
        for (let i = 1; i <= totalPages; i++) {
            pageNumbers.push({
                value: i,
                isCurrent: i === currentPage
            });
        }

        res.render('vwAdminUser/list-students', {
            layout: 'admin',
            students: students,
            title: 'Quản lý học viên',
            pagination: {
                page: currentPage,
                totalPages: totalPages,
                pageNumbers: pageNumbers,
                hasPrevPage: currentPage > 1,
                hasNextPage: currentPage < totalPages,
                prevPage: currentPage - 1,
                nextPage: currentPage + 1
            },
            totalItems: totalStudents,
            currentItemsCount: students.length,
            itemType: 'học viên',
            queryParams: req.query,
            currentFilters: filters
        });
    } catch (error) {
        console.error('Lỗi khi tải danh sách học viên:', error);
        res.status(500).send('Lỗi hệ thống');
    }
});

// Xem danh sách giảng viên
router.get('/instructors', async (req, res) => {
    try {
        const LIMIT = 10;
        const page = +req.query.page || 1;
        const offset = (page - 1) * LIMIT;

        // Get filters
        const filters = {
            searchTerm: req.query.search || ''
        };

        // Fetch data in parallel
        const [instructors, totalInstructors] = await Promise.all([
            userModel.findAllInstructorsPaginated(LIMIT, offset, filters),
            userModel.countAllInstructors(filters)
        ]);

        const totalPages = Math.ceil(totalInstructors / LIMIT);
        const currentPage = Math.min(Math.max(1, page), totalPages || 1);

        // Generate page numbers
        const pageNumbers = [];
        for (let i = 1; i <= totalPages; i++) {
            pageNumbers.push({
                value: i,
                isCurrent: i === currentPage
            });
        }

        res.render('vwAdminUser/list-instructors', {
            layout: 'admin',
            instructors: instructors,
            title: 'Quản lý giảng viên',
            pagination: {
                page: currentPage,
                totalPages: totalPages,
                pageNumbers: pageNumbers,
                hasPrevPage: currentPage > 1,
                hasNextPage: currentPage < totalPages,
                prevPage: currentPage - 1,
                nextPage: currentPage + 1
            },
            totalItems: totalInstructors,
            currentItemsCount: instructors.length,
            itemType: 'giảng viên',
            queryParams: req.query,
            currentFilters: filters
        });
    } catch (error) {
        console.error('Lỗi khi tải danh sách giảng viên:', error);
        res.status(500).send('Lỗi hệ thống');
    }
});

// Hiển thị trang thêm giảng viên mới
router.get('/add-instructor', (req, res) => {
    res.render('vwAdminUser/add-instructor', {
        layout: 'admin',
        title: 'Thêm giảng viên mới'
    });
});

// Xử lý tạo tài khoản giảng viên
router.post('/create-instructor', async (req, res) => {
    try {
        const {
            username, email, password, confirmPassword, name, dob, bio, image_url
        } = req.body;

        // Kiểm tra dữ liệu nhập vào 
        if (password !== confirmPassword) {
            return res.render('vwAdminUser/add-instructor', {
                layout: 'admin',
                error: 'Mật khẩu xác nhận không khớp',
                oldData: req.body,
                title: 'Thêm giảng viên mới'
            });
        }

        if (password.length < 6) {
            return res.render('vwAdminUser/add-instructor', {
                layout: 'admin',
                error: 'Mật khẩu phải có ít nhất 6 ký tự',
                oldData: req.body,
                title: 'Thêm giảng viên mới'
            });
        }

        // Kiểm tra username đã có chưa
        const existingUser = await userModel.findByUsername(username);
        if (existingUser) {
            return res.render('vwAdminUser/add-instructor', {
                layout: 'admin',
                error: 'Tên đăng nhập đã tồn tại',
                oldData: req.body,
                title: 'Thêm giảng viên mới'
            });
        }

        // Kiểm tra email đã có chưa
        const existingEmail = await userModel.findByEmail(email);
        if (existingEmail) {
            return res.render('vwAdminUser/add-instructor', {
                layout: 'admin',
                error: 'Email đã được sử dụng',
                oldData: req.body,
                title: 'Thêm giảng viên mới'
            });
        }

        // Hash password
        const hashedPassword = bcrypt.hashSync(password, 10);

        // Tạo object để lưu vào database
        const newInstructor = {
            username,
            email,
            password: hashedPassword,
            name,
            role: 2, // 2 = Instructor role
            dob: dob || null,
            self_introduction: bio || null,
            image_url: image_url || null
        };

        console.log('Đang tạo tài khoản giảng viên với dữ liệu:', newInstructor);
        await userModel.addInstructor(newInstructor);

        res.redirect('/admin/users/instructors?success=1');
    } catch (error) {
        console.error('Lỗi khi tạo tài khoản giảng viên:', error);
        console.error('Dữ liệu gửi lên:', req.body);
        res.render('vwAdminUser/add-instructor', {
            layout: 'admin',
            error: 'Có lỗi xảy ra khi tạo tài khoản giảng viên: ' + error.message,
            oldData: req.body,
            title: 'Thêm giảng viên mới'
        });
    }
});

// Xem thông tin chi tiết của user
router.get('/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await userModel.findByIdDetailed(userId);
        
        if (!user) {
            return res.status(404).send('Không tìm thấy người dùng');
        }
        
        res.render('vwAdminUser/user-details', {
            layout: 'admin',
            user: user,
            title: `Chi tiết - ${user.name}`
        });
    } catch (error) {
        console.error('Lỗi khi tải thông tin user:', error);
        res.status(500).send('Lỗi hệ thống');
    }
});




router.post('/:userId/promote', async (req, res) => {
  try {
    const { userId } = req.params;
    await userModel.updateRole(userId, 2);
    return res.redirect('back');
  } catch (e) {
    console.error(e);
    return res.status(500).send('Promote failed');
  }
});

// Xóa người dùng
router.post('/:id/delete', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        // Kiểm tra user có tồn tại không
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).send('Không tìm thấy người dùng');
        }

        // Không cho phép xóa admin
        if (user.role === 0) {
            return res.status(403).send('Không thể xóa tài khoản admin');
        }

        // Xóa user
        await userModel.delete(userId);
        
        // Redirect về trang phù hợp
        if (user.role === 1) {
            res.redirect('/admin/users/students?deleted=1');
        } else if (user.role === 2) {
            res.redirect('/admin/users/instructors?deleted=1');
        } else {
            res.redirect('/admin/users/students');
        }
    } catch (error) {
        console.error('Lỗi khi xóa user:', error);
        res.status(500).send('Lỗi hệ thống: ' + error.message);
    }
});

// API kiểm tra email có trùng không khi tạo giảng viên
router.get('/check-email', async (req, res) => {
    try {
        const email = req.query.email;
        const existingUser = await userModel.findByEmail(email);
        
        res.json(!existingUser); // trả về true nếu email chưa dùng, false nếu đã có
    } catch (error) {
        console.error('Lỗi khi check email:', error);
        res.status(500).json(false);
    }
});

router.post('/:userId/activate', async (req, res) => {
  try {
    const { userId } = req.params;
    await userModel.patch(userId, { is_locked: false });
    return res.json({ success: true });
  } catch (e) {
    console.error('[admin-user] activate failed:', e);
    return res.status(500).json({ success: false, message: 'Activate failed' });
  }
});

router.post('/:userId/deactivate', async (req, res) => {
  try {
    const { userId } = req.params;
    await userModel.patch(userId, { is_locked: true });
    return res.json({ success: true });
  } catch (e) {
    console.error('[admin-user] deactivate failed:', e);
    return res.status(500).json({ success: false, message: 'Deactivate failed' });
  }
});


export default router;
