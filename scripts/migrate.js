const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is required. Copy .env.example to .env first.');
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query(schemaSql);
    console.log('Database migration completed successfully.');
  } catch (error) {
    console.error('Database migration failed.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
