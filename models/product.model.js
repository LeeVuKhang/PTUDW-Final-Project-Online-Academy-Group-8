import db from '../utils/db.js';

export default {
    findByID(id){
        return db('courses').where('course_id', id).first();
    },
    findByCat(id){
        return db('courses').where('catid', id);
    },
    findPageByCat(catID, limit, offset){
        return db('courses').where('catid', catID).limit(limit).offset(offset);
    },
    countByCat(catID){
        return db('courses')
        .where('catid',catID)
        .count('catid as amount')
        .first();
    },
    add(course) {
        return db('courses').insert(course);
    },
    update(course_id, course) {
        return db('courses').where('course_id', course_id).update(course);
    },
    // findAll(){
    //     return db('courses')
    //         .join('categories', 'courses.catid', '=', 'categories.cat_id') 
    //         .select('courses.*', 'categories.cat_name as category_name'); 
    // },
    findAll(limit, offset, categoryId, searchTerm) {
        const query = db('courses')
            .join('categories', 'courses.catid', '=', 'categories.cat_id')
            .select('courses.*', 'categories.cat_name as category_name');

        if (categoryId && categoryId !== 'all') {
            query.where('courses.catid', categoryId);
        }
        if (searchTerm) {
            query.where(function() {
                this.where('courses.title', 'like', `%${searchTerm}%`)
                    .orWhere('courses.tinydes', 'like', `%${searchTerm}%`);
            });
        }
        if (limit) {
            query.limit(limit);
        }

        if (offset) {
            query.offset(offset);
        }
        return query; 
    },
    countAll(categoryId, searchTerm) {
        const query = db('courses').count('course_id as total');

        if (categoryId && categoryId !== 'all') {
            query.where('courses.catid', categoryId);
        }

        if (searchTerm) {
            query.where(function() {
                this.where('courses.title', 'like', `%${searchTerm}%`)
                    .orWhere('courses.tinydes', 'like', `%${searchTerm}%`);
            });
        }

        return query.first();
    },
    
}   