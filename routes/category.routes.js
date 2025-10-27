import express from 'express';
import categoryModel from '../models/category.model.js';
const router = express.Router();

router.get('/', async (req, res) => {
    
    const list = await categoryModel.findAll();
    res.render('vwAdminCategory/list', { 
        layout: 'admin',
        categories: list,
        title: 'Quản lý danh mục'
    });
});

router.get('/add', async (req, res) => {
    res.render('vwAdminCategory/add', {
        layout: 'admin',
        title: 'Thêm danh mục mới'
    });
});

router.get('/edit', async (req, res) => {
    const id = req.query.id || 0 ;
    const category = await categoryModel.findById(id);
    if (category === null){
        return res.redirect('/admin/categories');
    } 
    res.render('vwAdminCategory/edit', { 
        layout: 'admin',
        category: category,
        title: 'Chỉnh sửa danh mục'
    });
});

router.post('/add', async (req, res) => {
    const category = {
        cat_name: req.body.catname
    };
    await categoryModel.add(category);
    res.render('vwAdminCategory/add', {
        layout: 'admin',
        title: 'Thêm danh mục mới'
    });
});

router.post('/patch', async (req, res) => { 
    const id = req.body.cat_id;
    const category = {
        cat_name: req.body.cat_name
    };

    await categoryModel.patch(id, category);
    res.redirect('/admin/categories');
});

router.post('/delete', async (req, res) => {
    const id = req.body.cat_id;
    await categoryModel.del(id);
    res.redirect('/admin/categories');
});

// router.post của TienCuong
// router.post('/delete', async (req, res) => {
//     const id = req.body.catid;
    
//     // Requirement ko đc xóa lĩnh vực đã có khóa học
//     const hasCourses = await categoryModel.hasCourses(id);
//     if (hasCourses) {
//         // Redirect back with error message
//         const category = await categoryModel.findById(id);
//         const list = await categoryModel.findAll();
        
//         return res.render('vwAdminCategory/list', { 
//             categories: list,
//             error: `Không thể xóa danh mục "${category.cat_name}" vì đã có khóa học thuộc danh mục này.`
//         });
//     }
//
//     await categoryModel.del(id);
//     res.redirect('/admin/categories');
// });

export default router;