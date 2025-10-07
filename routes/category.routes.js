import express from 'express';
import categoryModel from '../models/category.model.js';
const router = express.Router();

router.get('/', async (req, res) => {
    
    const list = await categoryModel.findAll();
    res.render('vwAdminCategory/list', { categories: list });
});
router.get('/add', async (req, res) => {
    res.render('vwAdminCategory/add');
});

router.get('/edit', async (req, res) => {
    const id = req.query.id || 0 ;
    const category = await categoryModel.findById(id);
    if (category === null){
        return res.redirect('/admin/categories');
    } 
    res.render('vwAdminCategory/edit', { category: category  });
});
export default router;

router.post('/add', async (req, res) => {
    const category = {
        catname: req.body.catname
    };
    await categoryModel.add(category);
    res.render('vwAdminCategory/add');
});

router.post('/patch', async (req, res) => { 
    const id = req.body.catid;
    const category = {
        catname: req.body.catname
    };

    await categoryModel.patch(id, category);
    res.redirect('/admin/categories');
});

router.post('/delete', async (req, res) => {
    const id = req.body.catid;
    await categoryModel.del(id);
    res.redirect('/admin/categories');
});