import db from '../utils/db.js';

export default {
    findByID(id){
        return db('products').where('proid', id).first();
    },
    findByCat(id){
        return db('products').where('catid', id);
    },
    findPageByCat(catID, limit, offset){
        return db('products').where('catid', catID).limit(limit).offset(offset);
    },
    countByCat(catID){
        return db('products')
        .where('catid',catID)
        .count('catid as amount')
        .first();
    }
}   