import db from '../utils/db.js';

/**
 * Model for managing temporary data (replaces session temporary storage)
 * Used for: OTP codes, pending email changes, pending signups, etc.
 */
export default {
    /**
     * Save temporary data
     * @param {number|string} userId - User ID (can be 'anonymous' for pre-signup data)
     * @param {string} key - Data key/identifier
     * @param {Object} value - Data to store (will be stored as JSONB)
     * @param {Date} expiresAt - Expiration timestamp
     */
    async saveTempData(userId, key, value, expiresAt) {
        // Delete existing data with same userId + key first
        await db('temp_data')
            .where({ user_id: userId, data_key: key })
            .delete();

        // PostgreSQL JSONB: Pass object directly, don't stringify
        // Knex/PostgreSQL will handle JSONB conversion automatically
        const [result] = await db('temp_data')
            .insert({
                user_id: userId,
                data_key: key,
                data_value: value,  // Pass raw object for JSONB column
                expires_at: expiresAt,
            })
            .returning('temp_id');

        return result?.temp_id;
    },

    /**
     * Get temporary data
     * @param {number|string} userId - User ID
     * @param {string} key - Data key
     * @returns {Object|null} Stored data or null if not found/expired
     */
    async getTempData(userId, key) {
        const row = await db('temp_data')
            .where({ user_id: userId, data_key: key })
            .andWhere('expires_at', '>', new Date())
            .first();

        if (!row) return null;

        // PostgreSQL JSONB: data_value is already a JavaScript object
        // No need to JSON.parse - Knex/pg driver handles this automatically
        return row.data_value;
    },

    /**
     * Delete temporary data
     * @param {number|string} userId - User ID
     * @param {string} key - Data key
     */
    async deleteTempData(userId, key) {
        return db('temp_data')
            .where({ user_id: userId, data_key: key })
            .delete();
    },

    /**
     * Delete all temporary data for a user
     * @param {number|string} userId - User ID
     */
    async deleteAllUserTempData(userId) {
        return db('temp_data')
            .where({ user_id: userId })
            .delete();
    },

    /**
     * Clean up expired temporary data (should be run periodically)
     */
    async cleanupExpired() {
        const deleted = await db('temp_data')
            .where('expires_at', '<=', new Date())
            .delete();

        if (deleted > 0) {
            console.log(`[TempData] Cleaned up ${deleted} expired records`);
        }

        return deleted;
    },

    /**
     * Save temporary data with session-like identifier (for anonymous users)
     * Uses a unique session ID instead of user_id
     * @param {string} sessionId - Unique session identifier
     * @param {string} key - Data key
     * @param {Object} value - Data to store
     * @param {Date} expiresAt - Expiration timestamp
     */
    async saveSessionData(sessionId, key, value, expiresAt) {
        return this.saveTempData(`session_${sessionId}`, key, value, expiresAt);
    },

    /**
     * Get temporary data by session ID
     * @param {string} sessionId - Session identifier
     * @param {string} key - Data key
     */
    async getSessionData(sessionId, key) {
        return this.getTempData(`session_${sessionId}`, key);
    },

    /**
     * Delete temporary data by session ID
     * @param {string} sessionId - Session identifier
     * @param {string} key - Data key
     */
    async deleteSessionData(sessionId, key) {
        return this.deleteTempData(`session_${sessionId}`, key);
    },
};
