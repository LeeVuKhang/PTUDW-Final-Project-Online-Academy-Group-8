import db from '../utils/db.js';

export default {
    findAll() {
        return db('categories');
    },
    findById(id) {
        return db('categories').where('cat_id', id).first();
    },
    add(category) {
        return db('categories').insert(category);
    },
    del(id) {
        return db('categories').where('cat_id', id).del();
    },
    patch(id, category) {
        return db('categories').where('cat_id', id).update(category);
    },
    findParents() {
        return db('categories').whereNull('parent_id');
    },
    findChildren(parentId) {
        return db('categories').where('parent_id', parentId);
    },
    findParentsWithChildren: async function () {
        const parents = await db('categories').whereNull('parent_id');
        for (const parent of parents) {
            const children = await db('categories').where('parent_id', parent.cat_id);
            parent.children = children;
        }
        return parents;
    },
    // Check if category has courses before deletion
    hasCourses(id) {
        return db('courses')
            .where('cat_id', id)
            .count('* as count')
            .first()
            .then(result => result.count > 0);
    },

    // Dashboard function
    count() {
        return db('categories').count('* as count').first();
    }
};

