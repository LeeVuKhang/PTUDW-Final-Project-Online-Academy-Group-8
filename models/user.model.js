import db from '../utils/db.js';
export default{
    add(user){
        return db('users').insert(user);
    },
    findByUsername(username){
        return db('users').where('username', username).first();
    },
    patch(id, user){
        return db('users').where('id', id).update(user);
    }
}