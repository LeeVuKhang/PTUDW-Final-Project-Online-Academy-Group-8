import express from 'express';
import courseModels from '../models/product.model.js'
import categoryModel from '../models/category.model.js';

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
    const categories = await categoryModel.findAll();

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
        image_url: req.body.image_url
    };
    console.log(course.title)
    if(course) {
        await courseModels.add(course);
        console.log("added")
        res.redirect('/instructor/courses')
    }
    else {
        res.send("Error")
    }
})

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
        res.redirect(`/instructor/update/${course_id}`)
    }
    else {
        res.send("Error")
    }
})

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