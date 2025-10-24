import db from '../utils/db.js';
export default{
    async add(user){
        const rows = await db('users').insert(user).returning(['user_id']);
        return rows[0].user_id;
    },
    findByUsername(username){
        return db('users').where('username', username).first();
    },
    patch(id, user){
        return db('users').where('user_id', id).update(user);
    },
    findByEmail(email) {
        return db('users').where('email', email).first();
    },
}