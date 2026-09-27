'use strict';
const mysql = require('mysql2/promise');
const config = require('./config');

// Shared connection pool. multipleStatements is left at its default (false) for
// the clean baseline; a later lab phase may vary query construction per feature.
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Parameterized query helper (safe by default). Returns rows.
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

module.exports = { pool, query };
