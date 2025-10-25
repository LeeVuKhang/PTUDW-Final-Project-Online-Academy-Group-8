import express from 'express';
import courseModels from '../models/product.model.js'
import categoryModel from '../models/category.model.js';
import syllabusModel from '../models/syllabus.model.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.send('Instructor home page - to be implemented');
});

router.get('/courses', async (req, res) => {
    const LIMIT = 5;
    let page = +req.query.page || 1;
    if (page < 1) page = 1;

    const categoryId = req.query.category || 'all';
    const searchTerm = req.query.search || '';

    const offset = (page - 1) * LIMIT;
    const totalResult = await courseModels.countAll(categoryId, searchTerm);
    const totalCourses = totalResult.total;
    const totalPages = Math.ceil(totalCourses / LIMIT);

    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push({
            value: i,
            isCurrent: i === page
        });
    }

    const list = await courseModels.findAll(LIMIT, offset, categoryId, searchTerm);
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
        
        queryParams: req.query 
    });
});

router.get('/create-course', async (req, res) => {
    const categories = await categoryModel.findAll();
    res.render('vwInstructor/create-course', {
        categories: categories
    })
})

router.post('/create-course', async (req, res) => {
    const course = {
        title: req.body.title,
        tinydes: req.body.tinydes,
        fulldes: req.body.fulldes,
        total_hours: req.body.total_hours,
        price: req.body.price,
        discount_price: req.body.discount_price,
        catid: req.body.catid,
        level: req.body.level,
        image_url: req.body.image_url,
        is_complete: false 
    };

    try {
        const result = await courseModels.add(course);
        
        const newCourseId = (result && result.length > 0) ? (result[0].course_id || result[0]) : null;

        if (newCourseId) {
            console.log("Course created with ID:", newCourseId);
            res.redirect(`/instructor/courses/edit-syllabus/${newCourseId}`);
        } else {
            throw new Error("Could not retrieve new course ID after creation.");
        }
    } catch (error) {
        console.error("Error creating course:", error);
        res.status(500).send("Error creating course");
    }
});


router.get('/courses/edit-syllabus/:course_id', async (req, res) => {
    try {
        const course_id = req.params.course_id;
        const courseWithSyllabus = await syllabusModel.findByCourseId(course_id); 
        
        if (!courseWithSyllabus) {
            return res.status(404).send('Không tìm thấy khóa học');
        }

        res.render('vwInstructor/edit-syllabus', {
            course: courseWithSyllabus,
            chapters: courseWithSyllabus.chapters, 
            layout: 'main' 
        });
    } catch (error) {
        console.error("Error loading syllabus page:", error);
        res.status(500).send("Error loading page");
    }
});

router.post('/courses/edit-syllabus/:course_id', async (req, res) => {
    const course_id = req.params.course_id;
    const chapters = req.body.chapters || []; 
    let is_complete = false;
    let hasAtLeastOneChapter = false;
    let allLessonsAreValid = true; 

    if (chapters && chapters.length > 0) {
        for (const chap of chapters) {
            if (chap.title && chap.title.trim() !== '') {
                hasAtLeastOneChapter = true; 
                
                if (chap.lessons && chap.lessons.length > 0) {
                    let hasAtLeastOneLesson = false; 
                    for (const les of chap.lessons) {
                        if (les.title && les.title.trim() !== '') {
                            hasAtLeastOneLesson = true;
                            if (!les.video_url || les.video_url.trim() === '') {
                                allLessonsAreValid = false;
                                break; 
                            }
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

    try {
        await syllabusModel.saveSyllabus(course_id, chapters, is_complete);
        console.log(`Syllabus updated for course ${course_id}, is_complete: ${is_complete}`);
        res.redirect('/instructor/courses'); 
    } catch (error) {
        console.error('Error saving syllabus:', error);
        res.status(500).send('Error saving syllabus. Please try again.');
    }
});

router.get('/update/:course_id', async function(req, res) {
    const categories = await categoryModel.findAll();
    const course_id = req.params.course_id
    const course = await courseModels.findByID(course_id)
    if (!course) {
        return res.status(404).send('Không tìm thấy khóa học');
    }
    res.render('vwInstructor/update-course', {
        course: course,
        categories: categories
    })
})

router.post('/update/:course_id', async (req, res) => {
    const course_id = req.params.course_id
    const course = {
        title: req.body.title,
        tinydes: req.body.tinydes,
        fulldes: req.body.fulldes,
        total_hours: req.body.total_hours,
        price: req.body.price,
        discount_price: req.body.discount_price,
        catid: req.body.catid,
        level: req.body.level,
        image_url: req.body.image_url
    };
    if(course) {
        await courseModels.update(course_id, course);
        console.log(`updated id=${course_id}`)
        res.redirect(`/instructor/courses/edit-syllabus/${course_id}`);
    }
    else {
        res.send("Error")
    }
})

router.post('/delete-course', async (req, res) => {
    const { course_id } = req.body;

    if (!course_id) {
        return res.status(400).json({ message: 'Thiếu ID khóa học.' });
    }

    try {
        await courseModels.deleteCascade(course_id); 
        
        console.log(`Course ${course_id} and all related data deleted.`);
        res.status(200).json({ message: 'Complete Delete Course!' });

    } catch (error) {
        console.error(`Error deleting course ${course_id}:`, error);
        res.status(500).json({ message: 'Lỗi server khi xóa khóa học.' });
    }
});

// router.post('/add', async function(req, res) {
//     const category = {
//         catname: req.body.catname
//     };
//     await categoryModels.add(category);
//     res.redirect('/admin/categories')
// })

router.get('/courses/:course_id', async function (req, res) {
    const course_id = req.params.course_id
    const course = await courseModels.findByID(course_id)
    if (!course) {
        return res.status(404).send('Không tìm thấy khóa học');
    }
    res.render('vwProducts/course_detail', {
        course: course,
        title: course.title
    })
})


export default router;