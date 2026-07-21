const { Pool } = require("pg");
require("dotenv").config();

let pool;

if (process.env.DATABASE_URL) {
  // Used by the deployed website and any local setup
  // that provides a complete PostgreSQL connection URL.
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
} else {
  // Optional fallback for your existing local PostgreSQL setup.
  pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
}

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});

module.exports = pool;