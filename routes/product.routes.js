import express from 'express';
import productModel from '../models/product.model.js';
import categoryModel from '../models/category.model.js';


const router = express.Router();

router.get('/byCat', async (req, res) => {
    const id = req.query.id || 0 ;
    const category = await categoryModel.findById(id);   
    let catname = "?";

    if (category) {
        catname = category.catname;
    }
    const page = req.query.page || 1;
    const limit = 4;
    const offset = (page - 1) *limit + ((page - 1) *limit == 0);
    const list = await productModel.findPageByCat(id, limit, offset);

    const total = await productModel.countByCat(id);
    const nPages = Math.ceil(total.amount /limit);
    const page_numbers = [];
    for (let i = 1; i <= nPages; i++){
        page_numbers.push({
            value: i,
            catid: id,
            isCurrent: i == parseInt(page),
        })
    }

    res.render('vwProducts/byCat', { 
        products: list,
        catname: catname,
        page_numbers: page_numbers,
    });
});

router.get('/details', async (req, res) => {
    const id = req.query.id || 0 ;
    const product = await productModel.findByID(id);   
    let proname = "?";
    let fulldes = "?";
    let quantity = "?";
    let price = "?";
    let catid = "?"
    if (product) {
        proname = product.proname;
        fulldes = product.fulldes;
        quantity = product.quantity;
        price = product.price;
        catid = product.catid
        res.render('vwProducts/details', { 
            proid: id,
            proname: proname,
            fulldes: fulldes,
            quantity: quantity,
            price: price,
            catid: catid,
        });
    }
    else res.render('vwProducts/byCat/?id="1"');
    
});

export default router; 