import express from 'express';
import courseModel from '../models/course.model.js';
import categoryModel from '../models/category.model.js';
import syllabusModel from '../models/syllabus.model.js';
import { checkInstructor, checkAuthenticated } from '../models/auth.model.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const __dirname = import.meta.dirname;
const router = express.Router();

const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const courseId = req.params.course_id;
        const dir = path.join(__dirname, '..', 'static', 'course_video', courseId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const newFilename = `${uniqueSuffix}${ext}`;
        cb(null, newFilename);
    }
});

const uploadVideo = multer({ 
    storage: videoStorage,
    fileFilter: (req, file, cb) => {
        const filetypes = /mp4|mov|avi|mkv|webm/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype || extname) {
            return cb(null, true);
        }
        cb(new Error("Error: Chỉ chấp nhận file video (mp4, mov, avi, mkv, webm)!"));
    }
}).single('videoFile');

const courseImageDir = path.join(__dirname, '..', 'static', 'course_img');
fs.mkdirSync(courseImageDir, { recursive: true });

const courseImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, courseImageDir);
    },
    filename: (req, file, cb) => {
        const courseId = req.params.course_id;
        const ext = path.extname(file.originalname);
        const newFilename = `${courseId}${ext}`;

        try {
            const filesInDir = fs.readdirSync(courseImageDir);
            const oldFile = filesInDir.find(f => f.startsWith(`${courseId}.`));
            if (oldFile) {
                fs.unlinkSync(path.join(courseImageDir, oldFile));
                console.log(`[Course Image Upload] Đã xóa ảnh cũ: ${oldFile}`);
            }
        } catch (err) {
            console.error("[Course Image Upload] Lỗi khi xóa ảnh cũ:", err);
        }
        cb(null, newFilename);
    }
});

const uploadCourseImage = multer({
    storage: courseImageStorage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Error: Chỉ chấp nhận file ảnh!"));
    }
}).single('courseImage');

const uploadIntroVideo = multer({ 
    storage: videoStorage, 
    fileFilter: (req, file, cb) => {
        const filetypes = /mp4|mov|avi|mkv|webm/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype || extname) {
            return cb(null, true);
        }
        cb(new Error("Error: Chỉ chấp nhận file video!"));
    }
}).single('introVideo');

router.use(checkAuthenticated, checkInstructor);

router.get('/', (req, res) => {
    res.redirect('/instructor/courses');
});

router.get('/courses', async (req, res) => {
    try {
        const instructor_id = req.session.authUser.user_id;
        const LIMIT = 5;
        let page = +req.query.page || 1;
        if (page < 1) page = 1;

        const categoryId = req.query.category || 'all';
        const searchTerm = req.query.search || '';
        const offset = (page - 1) * LIMIT;

        const totalResult = await courseModel.countAllByInstructorId(instructor_id, categoryId, searchTerm);
        const totalCourses = totalResult.total || 0;
        const totalPages = Math.ceil(totalCourses / LIMIT);

        if (page > totalPages && totalPages > 0) {
            page = totalPages;
        } else if (totalPages === 0) {
             page = 1;
        }

        const pageNumbers = [];
        for (let i = 1; i <= totalPages; i++) {
            pageNumbers.push({
                value: i,
                isCurrent: i === page
            });
        }

        const list = await courseModel.findAllByInstructorId(instructor_id, LIMIT, offset, categoryId, searchTerm);
        const categories = await categoryModel.findParentsWithChildren();

        res.render('vwInstructor/list-course', {
            courses: list,
            categories: categories,
            pagination: {
                page: page,
                totalPages: totalPages,
                pageNumbers: pageNumbers,
                hasPrevPage: page > 1,
                hasNextPage: page < totalPages,
                prevPage: page - 1,
                nextPage: page + 1
            },
            totalCourses: totalCourses,
            currentCategoryId: categoryId,
            currentSearchTerm: searchTerm,
            queryParams: req.query,
            instructor_id,
        });
    } catch (error) {
        console.error("Error fetching instructor courses:", error);
        res.status(500).send("Error loading courses");
    }
});


router.get('/create-course', async (req, res) => {
    try {
        const categories = await categoryModel.findParentsWithChildren();
        res.render('vwInstructor/create-course', {
            categories: categories
        });
    } catch (error) {
         console.error("Error loading create course page:", error);
         res.status(500).send("Error loading page");
    }
});

router.post('/create-course', async (req, res) => {
    const instructor_id = req.session.authUser.user_id;

    const course = {
        title: req.body.title,
        tinydes: req.body.tinydes,
        fulldes: req.body.fulldes,
        total_hours: req.body.total_hours || 0,
        // total_lectures: req.body.total_lectures || 0,
        price: req.body.price,
        discount_price: req.body.discount_price,
        catid: req.body.catid,
        level: req.body.level,
        image_url: req.body.image_url,
        is_complete: false,
        instructor_id: instructor_id,
        is_disabled: false
    };

    try {
        const result = await courseModel.add(course);
        const newCourseId = (result && result.length > 0) ? (result[0].course_id || result[0]) : null;

        if (newCourseId) {
            console.log("Course created with ID:", newCourseId);
            res.redirect(`/instructor/upload-media/${newCourseId}`);
        } else {
            throw new Error("Could not retrieve new course ID after creation.");
        }
    } catch (error) {
        console.error("Error creating course:", error);
        const categories = await categoryModel.findParentsWithChildren();
        res.render('vwInstructor/create-course', {
            categories: categories,
            error: "An error occurred while creating the course. Please check your input."
        });
    }
});

router.get('/upload-media/:course_id', async (req, res) => {
    try {
        const course_id = req.params.course_id;
        const instructor_id = req.session.authUser.user_id;

        // Dùng hàm findByIdForAdmin (như chúng ta đã sửa) để lấy khóa học
        const course = await courseModel.findByIdForAdmin(course_id);

        if (!course) {
            return res.status(404).send('Không tìm thấy khóa học.');
        }
        // Kiểm tra quyền sở hữu
        if (course.instructor_id !== instructor_id && req.session.authUser.role != 0) {
            return res.status(403).send('Bạn không có quyền chỉnh sửa khóa học này.');
        }

        // Render file handlebars mới
        res.render('vwInstructor/upload-media', {
            course: course
        });
    } catch (error) {
        console.error("Error loading upload media page:", error);
        res.status(500).send("Error loading page");
    }
});

router.post('/update-field/:course_id', async (req, res) => {
    const course_id = req.params.course_id;
    const instructor_id = req.session.authUser.user_id;

    // Chỉ cho phép cập nhật 2 trường này
    const allowedFields = ['image_url', 'intro_url'];
    let fieldToUpdate = {};
    
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            fieldToUpdate[field] = req.body[field];
            fieldToUpdate['last_update'] = new Date(); // Cập nhật thời gian
        }
    }

    if (Object.keys(fieldToUpdate).length === 0) {
        return res.status(400).json({ success: false, message: 'No valid field to update.' });
    }

    try {
        const existingCourse = await courseModel.findByIdForAdmin(course_id);
        if (!existingCourse || (existingCourse.instructor_id !== instructor_id && req.session.authUser.role != 0)) {
            return res.status(403).json({ success: false, message: 'Permission denied.'});
        }

        await courseModel.update(course_id, fieldToUpdate);
        res.status(200).json({ success: true, message: 'Field updated.' });

    } catch (error) {
        console.error("Error updating course field:", error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});


router.post('/upload-course-image/:course_id', (req, res) => {
    uploadCourseImage(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Không có file ảnh.' });
        }

        try {
            const course = await courseModel.findByID(req.params.course_id);
            if (!course || (course.instructor_id !== req.session.authUser.user_id && req.session.authUser.role !== 0)) {
                fs.unlinkSync(req.file.path);
                return res.status(403).json({ success: false, message: 'Không có quyền.' });
            }
        } catch (e) {
             fs.unlinkSync(req.file.path);
             return res.status(500).json({ success: false, message: 'Lỗi server.' });
        }

        const imageUrl = `/static/course_img/${req.file.filename}`;
        res.json({
            success: true,
            message: 'Tải ảnh bìa lên thành công!',
            imageUrl: imageUrl
        });
    });
});

router.post('/upload-intro-video/:course_id', (req, res) => {
    uploadIntroVideo(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Không có file video.' });
        }

        const oldVideoUrl = req.body.oldIntroUrl;
        if (oldVideoUrl && oldVideoUrl.startsWith('/static/course_video/')) {
            try {
                const relativePath = oldVideoUrl.substring('/static'.length);
                const oldFilePath = path.join(__dirname, '..', 'static', relativePath);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                    console.log(`[Intro Video Upload] Đã xóa video cũ: ${oldFilePath}`);
                }
            } catch (unlinkErr) {
                console.error(`[Intro Video Upload] Lỗi khi xóa video cũ:`, unlinkErr);
            }
        }

        try {
            const course = await courseModel.findByID(req.params.course_id);
            if (!course || (course.instructor_id !== req.session.authUser.user_id && req.session.authUser.role !== 0)) {
                fs.unlinkSync(req.file.path);
                return res.status(403).json({ success: false, message: 'Không có quyền.' });
            }
        } catch (e) {
             fs.unlinkSync(req.file.path);
             return res.status(500).json({ success: false, message: 'Lỗi server.' });
        }

        const videoUrl = `/static/course_video/${req.params.course_id}/${req.file.filename}`;
        res.json({
            success: true,
            message: 'Tải video giới thiệu lên thành công!',
            videoUrl: videoUrl
        });
    });
});

router.post('/upload-video/:course_id', (req, res) => {
    uploadVideo(req, res, async (err) => {
        if (err) {
            console.error("Lỗi Multer khi upload video:", err.message);
            return res.status(400).json({ success: false, message: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Không có file nào được tải lên.' });
        }

        const oldVideoUrl = req.body.oldVideoUrl;
        
        if (oldVideoUrl && oldVideoUrl.startsWith('/static/course_video/')) {
            try {
                const relativePath = oldVideoUrl.substring('/static'.length);
                const oldFilePath = path.join(__dirname, '..', 'static', relativePath);

                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                    console.log(`[Video Upload] Đã xóa file video cũ: ${oldFilePath}`);
                } else {
                    console.warn(`[Video Upload] Muốn xóa file cũ nhưng không tìm thấy: ${oldFilePath}`);
                }
            } catch (unlinkErr) {
                console.error(`[Video Upload] Lỗi khi xóa file video cũ: ${unlinkErr.message}`);
            }
        }

        try {
             const course_id = req.params.course_id;
             const instructor_id = req.session.authUser.user_id;
             const course = await courseModel.findByID(course_id);
             
             if (!course || (course.instructor_id !== instructor_id && req.session.authUser.role !== 0)) {
                 fs.unlinkSync(req.file.path);
                 return res.status(403).json({ success: false, message: 'Không có quyền tải lên cho khóa học này.' });
             }
        } catch(e) {
             console.error("Lỗi kiểm tra quyền sở hữu video:", e);
             return res.status(500).json({ success: false, message: 'Lỗi server khi kiểm tra tệp.' });
        }

        const videoUrl = `/static/course_video/${req.params.course_id}/${req.file.filename}`;
        res.json({
            success: true,
            message: 'Tải file lên thành công!',
            videoUrl: videoUrl 
        });
    });
});

router.get('/courses/edit-syllabus/:course_id', async (req, res) => {
    try {
        const course_id = req.params.course_id;
        const instructor_id = req.session.authUser.user_id;

        const courseWithSyllabus = await syllabusModel.findByCourseId(course_id);

        if (!courseWithSyllabus) {
            return res.status(404).send('Không tìm thấy khóa học');
        }
        if (courseWithSyllabus.instructor_id !== instructor_id && req.session.authUser.role != 0) {
             return res.status(403).send('Bạn không có quyền chỉnh sửa khóa học này.');
        }

        res.render('vwInstructor/edit-syllabus', {
            course: courseWithSyllabus,
            chapters: courseWithSyllabus.chapters || [],
            layout: 'main'
        });
    } catch (error) {
        console.error("Error loading syllabus page:", error);
        res.status(500).send("Error loading page");
    }
});

router.post('/courses/edit-syllabus/:course_id', async (req, res) => {
    const course_id = req.params.course_id;
    const instructor_id = req.session.authUser.user_id;
    const chapters = req.body.chapters || [];

     try {
        const course = await courseModel.findByID(course_id);
        if (!course || (course.instructor_id !== instructor_id && req.session.authUser.role != 0)) {
            return res.status(403).send('Bạn không có quyền lưu syllabus cho khóa học này.');
        }

        let is_complete = true; 

        if (!chapters || chapters.length === 0) {
            is_complete = false;
        } else {
            for (const chap of chapters) {
                if (!chap.title || chap.title.trim() === '') {
                    is_complete = false;
                    break; 
                }

                if (!chap.lessons || chap.lessons.length === 0) {
                    is_complete = false;
                    break;
                }

                for (const les of chap.lessons) {
                    const titleValid = les.title && les.title.trim() !== '';
                    const durationValid = les.duration && parseInt(les.duration, 10) > 0;
                    const videoValid = les.video_url && les.video_url.trim() !== '';

                    if (!titleValid || !durationValid || !videoValid) {
                        is_complete = false;
                        break; 
                    }
                }

                if (!is_complete) {
                    break; 
                }
            }
        }
        let hasAtLeastOneChapter = false;
        let allLessonsAreValid = true;

        if (chapters.length > 0) {
            for (const chap of chapters) {
                if (chap.title && chap.title.trim() !== '') {
                    hasAtLeastOneChapter = true;

                    if (chap.lessons && chap.lessons.length > 0) {
                        let hasAtLeastOneLesson = false;
                        for (const les of chap.lessons) {
                            if (les.title && les.title.trim() !== '') {
                                hasAtLeastOneLesson = true;
                            }
                        }
                        if (!hasAtLeastOneLesson) {
                           allLessonsAreValid = false;
                        }
                    } else {
                        allLessonsAreValid = false;
                    }
                }
                if (!allLessonsAreValid) break;
            }
        } else {
            allLessonsAreValid = false;
        }

        is_complete = hasAtLeastOneChapter && allLessonsAreValid;

        await syllabusModel.saveSyllabus(course_id, chapters, is_complete);
        console.log(`Syllabus updated for course ${course_id}, is_complete: ${is_complete}`);
        if (req.session.authUser.role === 0){
            return res.redirect('/admin');
        }
        res.redirect('/instructor/courses');
    } catch (error) {
        console.error('Error saving syllabus:', error);
        res.status(500).send('Error saving syllabus. Please try again.');
    }
});

router.get('/update/:course_id', async function(req, res) {
    try {
        const categories = await categoryModel.findParentsWithChildren();
        const course_id = req.params.course_id;
        const instructor_id = req.session.authUser.user_id;

        const course = await courseModel.findByIdForAdmin(course_id);

        if (!course) {
            return res.status(404).send('Không tìm thấy khóa học.');
        }
        if (course.instructor_id !== instructor_id && req.session.authUser.role != 0) {
            return res.status(403).send('Bạn không có quyền chỉnh sửa khóa học này.');
        }

        res.render('vwInstructor/update-course', {
            course: course,
            categories: categories
        });
    } catch(error) {
        console.error("Error loading update course page:", error);
        res.status(500).send("Error loading page");
    }
});

router.post('/update/:course_id', async (req, res) => {
    const course_id = req.params.course_id;
    const instructor_id = req.session.authUser.user_id;

    try {
        const existingCourse = await courseModel.findByID(course_id);
        if (!existingCourse || (existingCourse.instructor_id !== instructor_id && req.session.authUser.role != 0)) {
            return res.status(403).send("Không có quyền cập nhật khóa học này.");
        }

        const courseUpdateData = {
            title: req.body.title,
            tinydes: req.body.tinydes,
            fulldes: req.body.fulldes,
            total_hours: req.body.total_hours || 0,
            price: req.body.price,
            discount_price: req.body.discount_price,
            catid: req.body.catid,
            level: req.body.level,
            image_url: req.body.image_url,
            intro_url: req.body.intro_url, 
            last_update: new Date()
        };

        await courseModel.update(course_id, courseUpdateData);
        console.log(`Updated course id=${course_id}`);
        res.redirect(`/instructor/courses/edit-syllabus/${course_id}`);

    } catch (error) {
         console.error("Error updating course:", error);
         const categories = await categoryModel.findParentsWithChildren();
         const course = await courseModel.findByID(course_id);
         res.render('vwInstructor/update-course', {
             course: course,
             categories: categories,
             error: "An error occurred while updating."
         });
    }
});


router.post('/delete-course', async (req, res) => {
    const { course_id } = req.body;
    const instructor_id = req.session.authUser.user_id;

    if (!course_id) {
        return res.status(400).json({ message: 'Thiếu ID khóa học.' });
    }

    try {
        const course = await courseModel.findByID(course_id);
        if (!course || (course.instructor_id !== instructor_id && req.session.authUser.role !== 0)) {
            return res.status(403).json({ message: 'Không có quyền xóa khóa học này.' });
        }

        const staticDir = path.join(__dirname, '..', 'static');

        if (course.image_url && course.image_url.startsWith('/static/course_img/')) {
            const imagePath = path.join(staticDir, course.image_url.substring('/static'.length));
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
                console.log(`[Delete Course] Đã xóa ảnh bìa: ${imagePath}`);
            }
        }

        const courseVideoDir = path.join(staticDir, 'course_video', course_id.toString());
        if (fs.existsSync(courseVideoDir)) {
            fs.rmSync(courseVideoDir, { recursive: true, force: true });
            console.log(`[Delete Course] Đã xóa thư mục video bài giảng: ${courseVideoDir}`);
        }

        if (course.intro_url && course.intro_url.startsWith('/static/course_video/')) {
            const videoPath = path.join(staticDir, course.intro_url.substring('/static'.length));
            if (fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
                console.log(`[Delete Course] Đã xóa video giới thiệu: ${videoPath}`);
            }
        }

        
        await courseModel.deleteCascade(course_id);
        console.log(`Course ${course_id} and all related data deleted by instructor ${instructor_id}.`);
        res.status(200).json({ message: 'Complete Delete Course!' });

    } catch (error) {
        console.error(`Error deleting course ${course_id}:`, error);
        res.status(500).json({ message: 'Lỗi server khi xóa khóa học.' });
    }
});

export default router;