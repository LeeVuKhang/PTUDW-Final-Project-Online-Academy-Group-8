import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    res.send('Instructor home page - to be implemented');
});

router.get('/courses', (req, res) => {
    res.render('vwInstructor/list-course')
});

router.get('/create-course', (req, res) => {
    res.render('vwInstructor/create-course')
})

router.post('/create-course', (req, res) => {
    const course = {
        title: req.body.title,
        short_description: req.body.shortdes,
        long_description: req.body.longdes,
        price: req.body.price,
        syllabus: req.body.syllabus
    };
    res.send(course)
})

// router.post('/add', async function(req, res) {
//     const category = {
//         catname: req.body.catname
//     };
//     await categoryModels.add(category);
//     res.redirect('/admin/categories')
// })

export default router;