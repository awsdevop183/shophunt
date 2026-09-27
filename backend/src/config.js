'use strict';
// Central config from environment (with lab-safe defaults).
module.exports = {
  port: parseInt(process.env.BACKEND_PORT || '4000', 10),
  db: {
    host: process.env.DB_HOST || 'db',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'shophunt',
    password: process.env.DB_PASSWORD || 'shophunt-lab-only',
    database: process.env.DB_NAME || 'shophunt',
  },
  // NOTE: weak/guessable default is intentional for the JWT lab (later phase).
  jwtSecret: process.env.JWT_SECRET || 'secret',
  instructor: {
    mode: (process.env.INSTRUCTOR_MODE || 'off').toLowerCase() === 'on',
    pathToken: process.env.INSTRUCTOR_PATH_TOKEN || 'change-me-instructor-2f9c',
  },
  metadata: {
    host: process.env.METADATA_MOCK_HOST || 'metadata',
    ip: process.env.METADATA_MOCK_IP || '169.254.169.254',
  },
  uploadDir: process.env.UPLOAD_DIR || require('path').join(__dirname, '..', 'uploads'),
};
