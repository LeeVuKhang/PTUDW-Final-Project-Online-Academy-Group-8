import express from 'express';
import userModel from '../models/user.model.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

//Quản lý học viên - Xem danh sách
router.get('/students', async (req, res) => {
    try {
        const students = await userModel.findAllStudents();
        
        res.render('vwAdminUser/list-students', {
            layout: 'admin',
            students: students,
            title: 'Quản lý học viên'
        });
    } catch (error) {
        console.error('Error loading students:', error);
        res.status(500).send('Lỗi hệ thống');
    }
});

//Quản lý giảng viên - Xem danh sách
router.get('/instructors', async (req, res) => {
    try {
        const instructors = await userModel.findAllInstructors();
        
        res.render('vwAdminUser/list-instructors', {
            layout: 'admin',
            instructors: instructors,
            title: 'Quản lý giảng viên'
        });
    } catch (error) {
        console.error('Error loading instructors:', error);
        res.status(500).send('Lỗi hệ thống');
    }
});

// 4.3 Quản lý giảng viên - Hiển thị form thêm giảng viên
router.get('/add-instructor', (req, res) => {
    res.render('vwAdminUser/add-instructor', {
        layout: 'admin',
        title: 'Thêm giảng viên mới'
    });
});

// 4.3 Quản lý giảng viên - Tạo tài khoản giảng viên mới
router.post('/create-instructor', async (req, res) => {
    try {
        const {
            username, email, password, confirmPassword, name, phone, dob, gender,
            bio, specialization, experience_years, education, certificates
        } = req.body;

        // Validation
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

        // Check if username already exists
        const existingUser = await userModel.findByUsername(username);
        if (existingUser) {
            return res.render('vwAdminUser/add-instructor', {
                layout: 'admin',
                error: 'Tên đăng nhập đã tồn tại',
                oldData: req.body,
                title: 'Thêm giảng viên mới'
            });
        }

        // Check if email already exists
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

        // Create instructor account
        const newInstructor = {
            username,
            email,
            password: hashedPassword,
            name,
            phone: phone || null,
            dob: dob || null,
            gender: gender || null,
            bio: bio || null,
            specialization: specialization || null,
            experience_years: experience_years || null,
            education: education || null,
            certificates: certificates || null,
            role: 2, // 2 = Instructor role
            is_active: true,
            created_at: new Date()
        };

        await userModel.addInstructor(newInstructor);

        res.redirect('/admin/users/instructors?success=1');
    } catch (error) {
        console.error('Error creating instructor:', error);
        res.render('vwAdminUser/add-instructor', {
            layout: 'admin',
            error: 'Có lỗi xảy ra khi tạo tài khoản giảng viên',
            oldData: req.body,
            title: 'Thêm giảng viên mới'
        });
    }
});

// 4.3 Xem chi tiết user (cả học viên và giảng viên)
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
        console.error('Error loading user details:', error);
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

// Check email availability for instructor creation
router.get('/check-email', async (req, res) => {
    try {
        const email = req.query.email;
        const existingUser = await userModel.findByEmail(email);
        
        res.json(!existingUser); // Return true if available, false if taken
    } catch (error) {
        console.error('Error checking email:', error);
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