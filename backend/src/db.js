'use strict';
const mysql = require('mysql2/promise');
const config = require('./config');

// ⚠️ LAB NOTE: multipleStatements is enabled so the SQL-injection labs can teach
// stacked queries and error-based extraction. In a real product this would be OFF.
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
});

// Parameterized query helper (safe). Used by clean endpoints.
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// Raw query helper (NO parameterization). Used ONLY by the intentionally
// vulnerable SQL-injection labs, so the concatenation is visible and local.
async function raw(sql) {
  const [rows] = await pool.query(sql);
  return rows;
}

module.exports = { pool, query, raw };
