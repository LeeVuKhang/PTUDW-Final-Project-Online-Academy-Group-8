// models/progress.model.js
import db from '../utils/db.js';

export default {
  async upsertWatched(user_id, course_id, lesson_id) {
    // idempotent record of "user watched this lesson"
    await db('user_lesson_progress')
      .insert({ user_id, course_id, lesson_id })
      .onConflict(['user_id', 'course_id', 'lesson_id'])
      .ignore();
  },

  // percentage for ONE course
  async courseProgressPercent(user_id, course_id) {
    // total lessons in course = lessons JOIN chapters
    const totalRow = await db('lessons as l')
      .join('chapters as ch', 'l.chapter_id', 'ch.chapter_id')
      .where('ch.course_id', course_id)
      .count('* as total')
      .first();

    const total = Number(totalRow?.total || 0);
    if (!total) return 0;

    const watchedRow = await db('user_lesson_progress')
      .where({ user_id, course_id })
      .countDistinct('lesson_id as watched')
      .first();

    const watched = Number(watchedRow?.watched || 0);
    return Math.max(0, Math.min(100, Math.floor((watched / total) * 100)));
  },

  // percentages for MANY courses (for “My Courses” list)
  async courseProgressMap(user_id, course_ids = []) {
    if (!course_ids.length) return {};

    const totals = await db('lessons as l')
      .join('chapters as ch', 'l.chapter_id', 'ch.chapter_id')
      .whereIn('ch.course_id', course_ids)
      .select('ch.course_id')
      .count('* as total')
      .groupBy('ch.course_id');

    const watchedRows = await db('user_lesson_progress')
      .where({ user_id })
      .whereIn('course_id', course_ids)
      .select('course_id')
      .countDistinct('lesson_id as watched')
      .groupBy('course_id');

    const totalByCourse = Object.fromEntries(totals.map(r => [r.course_id, Number(r.total)]));
    const watchedByCourse = Object.fromEntries(watchedRows.map(r => [r.course_id, Number(r.watched)]));

    const out = {};
    for (const cid of course_ids) {
      const t = totalByCourse[cid] || 0;
      const w = watchedByCourse[cid] || 0;
      out[cid] = t ? Math.floor((w / t) * 100) : 0;
    }
    return out;
  },
};
