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
        return db('courses').insert(course).returning('course_id');
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
            .leftJoin('ratings', 'courses.course_id', 'ratings.course_id')
            .select(
                'courses.*',
                'categories.cat_name as category_name',
                db.raw('COALESCE(AVG(ratings.value), 0) as avg_rating'),
                db.raw('COUNT(ratings.rating_id) as rating_count')
            )
            .groupBy(
                'courses.course_id', 
                'categories.cat_name', 
                'categories.cat_id'
            );

        if (categoryId && categoryId !== 'all') {
            query.where('courses.catid', categoryId);
        }
        if (searchTerm) {
            query.where(function () {
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
    deleteCascade(course_id) {
        return db.transaction(async trx => {
            const chapterRows = await trx('chapters')
                .where('course_id', course_id)
                .select('chapter_id');

            const chapterIds = chapterRows.map(row => row.chapter_id); 
            if (chapterIds.length > 0) {
                await trx('lessons').whereIn('chapter_id', chapterIds).del();
            }

            await trx('chapters').where('course_id', course_id).del();
            await Promise.all([
                trx('ratings').where('course_id', course_id).del(),
                trx('enrollments').where('course_id', course_id).del(),
                trx('watchlists').where('course_id', course_id).del(),
                trx('cart_items').where('course_id', course_id).del()
            ]);
            const deletedCount = await trx('courses').where('course_id', course_id).del();
            
            if (deletedCount === 0) {
                throw new Error('Không tìm thấy khóa học để xóa.');
            }

            return deletedCount;
        });
    }
}   