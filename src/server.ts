import 'dotenv/config';
import { createApp } from './app';
import { pool } from './db';

const port = Number(process.env.PORT || 3000);
const app = createApp();

const server = app.listen(port, () => {
  console.log(`Payment webhook service listening on port ${port}`);
});

process.on('SIGTERM', async () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});
