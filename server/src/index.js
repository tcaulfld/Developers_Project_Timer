import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { createRepository } from './repository.js';
import { createRouter } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');

const db = openDatabase(DATA_DIR);
const repo = createRepository(db);
const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', createRouter(repo));

const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Developer's Project Timer API on http://localhost:${PORT}`);
  console.log(`SQLite data dir: ${DATA_DIR}`);
});
