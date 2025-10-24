import db from '../utils/db.js';

export default {
    findByID(id){
        return db('courses').where('course_id', id).first();
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
    },
    add(course) {
        return db('courses').insert(course);
    },
    update(course_id, course) {
        return db('courses').where('course_id', course_id).update(course);
    },
    findAll(){
        return db('courses');
    },
    
     findParents() {
        return db('categories').whereNull('parent_id');
    },
    findChildren(parentId) {
        return db('categories').where('parent_id', parentId);
    },
    
}   