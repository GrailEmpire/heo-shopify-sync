import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { syncProducts } from '../utils/heo.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o histórico
const historyPath = path.join(__dirname, '..', 'sync-history.json');

// GET / → página com botão + histórico
router.get('/', (req, res) => {
  let history = [];
  if (fs.existsSync(historyPath)) {
    history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  }
  res.render('index', { history });
});

// POST /importar → executa a sincronização manual
router.post('/importar', async (req, res) => {
  const result = await syncProducts();

  let history = [];
  if (fs.existsSync(historyPath)) {
    history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  }

  history.unshift({
    date: new Date().toISOString(),
    ...result,
  });

  fs.writeFileSync(historyPath, JSON.stringify(history.slice(0, 20), null, 2));
  res.redirect('/');
});

export default router;
