import db from '../utils/db.js';

export default {
    findAll() {
        return db('categories');
    },
    findById(id) {
        return db('categories').where('catid', id).first();
    },
    add(category) {
        return db('categories').insert(category);
    }, 
    del(id) {
        return db('categories').where('catid', id).del();
    },
    patch(id, category) {
        return db('categories').where('catid', id).update(category);
    }
};

