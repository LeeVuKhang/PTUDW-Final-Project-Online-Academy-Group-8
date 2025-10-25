import db from '../utils/db.js';

/**
 * Lấy thông tin khóa học VÀ toàn bộ syllabus (chapters -> lessons)
 */
async function findByCourseId(course_id) {
    const course = await db('courses').where({ course_id }).first();
    if (!course) return null;

    // Lấy các chapter
    const chapters = await db('chapters')
        .where({ course_id })
        .orderBy('order_index');

    // Với mỗi chapter, lấy các lesson
    for (const chapter of chapters) {
        chapter.lessons = await db('lessons')
            .where({ chapter_id: chapter.chapter_id })
            .orderBy('order_index');
    }
    
    course.chapters = chapters;
    return course; // Trả về khóa học đã được lồng ghép syllabus
}

/**
 * Lưu toàn bộ syllabus cho một khóa học (dùng transaction)
 * @param {number} course_id ID của khóa học
 * @param {Array} chaptersData Mảng dữ liệu chapters (từ req.body)
 * @param {boolean} is_complete Trạng thái hoàn thành (đã tính toán ở route)
 */
async function saveSyllabus(course_id, chaptersData, is_complete) {
    return db.transaction(async trx => {
        const oldChapters = await trx('chapters').where({ course_id }).select('chapter_id');
        if (oldChapters.length > 0) {
            const oldChapterIds = oldChapters.map(c => c.chapter_id);
            await trx('lessons').whereIn('chapter_id', oldChapterIds).del();
            await trx('chapters').where({ course_id }).del();
        }
        if (chaptersData && chaptersData.length > 0) {
            for (let i = 0; i < chaptersData.length; i++) {
                const chap = chaptersData[i];
                if (!chap.title || chap.title.trim() === '') continue; 
                const [newChapter] = await trx('chapters').insert({
                    course_id: course_id,
                    title: chap.title,
                    order_index: i
                }).returning('chapter_id');

                const newChapterId = newChapter.chapter_id || newChapter; 

                if (chap.lessons && chap.lessons.length > 0) {
                    const lessonsToInsert = chap.lessons
                    .filter(les => les.title && les.title.trim() !== '')
                    .map((les, j) => ({
                        chapter_id: newChapterId,
                        title: les.title,
                        video_url: les.video_url || null,
                        duration: les.duration || 0,
                        is_preview: !!les.is_preview,
                        order_index: j
                    }));
                    
                    if (lessonsToInsert.length > 0) {
                        await trx('lessons').insert(lessonsToInsert);
                    }
                }
            }
        }
        await trx('courses').where({ course_id }).update({ is_complete });
    });
}

export default {
    findByCourseId,
    saveSyllabus
};