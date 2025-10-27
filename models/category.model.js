import db from '../utils/db.js';

export default {
    findAll() {
        return db('categories')
            .select('cat_id as catid', 'cat_name as catname', 'des', 'parent_id')
            .orderBy('cat_id', 'asc');
    },
    
    findById(id) {
        return db('categories')
            .select('cat_id as catid', 'cat_name as catname', 'des', 'parent_id')
            .where('cat_id', id)
            .first();
    },
    
    async add(category) {
        // Fix sequence if needed
        await db.raw(`SELECT setval('categories_cat_id_seq', (SELECT MAX(cat_id) FROM categories))`);
        
        return db('categories').insert({
            cat_name: category.catname
        }).returning('cat_id');
    },

    del(id) {
        return db('categories').where('cat_id', id).del();
    },

    patch(id, category) {
        const dbCategory = {
            cat_name: category.catname,
            des: category.des,
            parent_id: category.parent_id
        };
        return db('categories').where('cat_id', id).update(dbCategory);
    },

    // Check if category has courses before deletion
    hasCourses(id) {
        return db('courses')
            .where('catid', id)
            .count('* as count')
            .first()
            .then(result => result.count > 0);
    },

    // Dashboard function
    count() {
        return db('categories').count('* as count').first();
    }
};

