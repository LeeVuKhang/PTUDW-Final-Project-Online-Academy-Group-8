import db from '../utils/db.js';

export default {
    findAll() {
        return db('categories').orderBy('cat_id', 'asc');
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
    return db('categories')
        .whereNull('parent_id')
        .orderBy('cat_id', 'asc'); // sắp theo ID tăng dần
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
    },

    // Top categories of week
    async findTopCategoriesOfWeek(limit = 5) {
    return db('enrollments as e')
        .join('courses as c', 'e.course_id', 'c.course_id')
        .join('categories as cat', 'c.catid', 'cat.cat_id') // chú ý alias đúng với DB của em
        .where('e.erm_date', '>=', db.raw("NOW() - INTERVAL '7 DAYS'"))
        .groupBy('cat.cat_id', 'cat.cat_name')
        .select('cat.cat_id', 'cat.cat_name')
        .count('e.erm_id as total_enrollments')
        .orderBy('total_enrollments', 'desc')
        .limit(limit);
    },
    // lấy id của cả cate cha và con
    async findAllDescendants(catId) {
    const rows = await db.raw(`
      WITH RECURSIVE subcategories AS (
        SELECT cat_id, parent_id
        FROM categories
        WHERE cat_id = ?
        UNION ALL
        SELECT c.cat_id, c.parent_id
        FROM categories c
        INNER JOIN subcategories s ON c.parent_id = s.cat_id
      )
      SELECT cat_id FROM subcategories;
    `, [catId]);
    return rows.rows.map(r => r.cat_id);
  },
};

