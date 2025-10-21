import express from 'express';
import courseModels from '../models/product.model.js'

const router = express.Router();

router.get('/', (req, res) => {
    res.send('Instructor home page - to be implemented');
});

router.get('/courses', (req, res) => {
    res.render('vwInstructor/list-course')
});

router.get('/create-course', (req, res) => {
    console.log("go")
    res.render('vwInstructor/create-course')
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
    };
    // if(course) {
    //     await courseModels.add(course);
    //     console.log("added")
    //     res.redirect('/instructor/courses')
    // }
    // else {
    //     res.send("Error")
    // }
    res.json(course)
})


// router.post('/add', async function(req, res) {
//     const category = {
//         catname: req.body.catname
//     };
//     await categoryModels.add(category);
//     res.redirect('/admin/categories')
// })

export default router;