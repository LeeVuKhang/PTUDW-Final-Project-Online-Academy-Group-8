import knex from 'knex';
const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASS,
  DB_NAME, 
} = process.env;
['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'].forEach((k) => {
  if (!process.env[k]) {
    throw new Error(`[db] Missing ${k}. Put it in your .env (see .env.example).`);
  }
});
const db = knex({
  client: 'pg',
  connection: {
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    ssl: { rejectUnauthorized: false },
  },
  pool: { min: 0, max: 15 },
});
export default db;
