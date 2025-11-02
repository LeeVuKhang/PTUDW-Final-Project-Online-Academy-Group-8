import express from 'express';
import categoryModel from '../models/category.model.js';
const router = express.Router();

router.get('/', async (req, res) => {
    const searchKeyword = req.query.search || '';
    let categories;
    
    if (searchKeyword) {
        // Tìm kiếm theo tên
        const searchResults = await categoryModel.searchByName(searchKeyword);
        // Nhóm theo parent-child để hiển thị
        const parents = searchResults.filter(cat => cat.parent_id === null);
        for (const parent of parents) {
            parent.children = searchResults.filter(cat => cat.parent_id === parent.cat_id);
        }
        categories = parents;
    } else {
        // Lấy danh mục cha kèm theo danh mục con
        categories = await categoryModel.findParentsWithChildren();
    }
    
    res.render('vwAdminCategory/list', { 
        layout: 'admin',
        categories: categories,
        searchKeyword: searchKeyword,
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
    
    // Lấy danh mục con
    const children = await categoryModel.findChildren(id);
    
    res.render('vwAdminCategory/edit', { 
        layout: 'admin',
        category: category,
        children: children,
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

// Route thêm danh mục con - sử dụng hàm add() có sẵn
router.post('/add-child', async (req, res) => {
    try {
        const { cat_name, parent_id } = req.body;
        await categoryModel.add({
            cat_name: cat_name,
            parent_id: parseInt(parent_id) // Convert string to integer
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding child category:', error);
        res.json({ success: false, error: error.message });
    }
});

// Route cập nhật danh mục con - sử dụng hàm patch() có sẵn
router.post('/update-child', async (req, res) => {
    try {
        const { cat_id, cat_name } = req.body;
        await categoryModel.patch(cat_id, {
            cat_name: cat_name
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating child category:', error);
        res.json({ success: false });
    }
});

// Route xóa danh mục con - sử dụng hàm del() có sẵn
router.post('/delete-child', async (req, res) => {
    try {
        const { cat_id } = req.body;
        await categoryModel.del(cat_id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting child category:', error);
        res.json({ success: false });
    }
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