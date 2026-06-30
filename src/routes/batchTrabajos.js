const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const sheetdb = require('../lib/sheetdb');
const { trabajoToRow } = require('../utils/transform');

const router = Router();

const batchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas operaciones batch. Intenta de nuevo en un minuto.' },
});

router.post('/', authenticate, batchLimiter, async (req, res, next) => {
  try {
    const { creates = [], updates = [] } = req.body;
    const results = { created: [], updated: [], failed: [] };

    if (creates.length > 0) {
      const rows = creates.map((t, i) => trabajoToRow({
        ...t,
        id: String(Date.now() + i),
      }));
      await sheetdb.create('trabajos', rows);
      results.created = rows.map(r => ({ id: r.id, title: r.title }));
    }

    for (const item of updates) {
      try {
        const row = trabajoToRow(item);
        await sheetdb.update('trabajos', 'id', item.id, row);
        results.updated.push({ id: item.id });
      } catch (err) {
        results.failed.push({ id: item.id, error: err.message });
      }
    }

    res.json(results);
  } catch (err) { next(err); }
});

router.post('/delete', authenticate, batchLimiter, async (req, res, next) => {
  try {
    const { ids = [] } = req.body;
    const results = { deleted: [], failed: [] };

    for (const id of ids) {
      try {
        await sheetdb.remove('trabajos', 'id', id);
        results.deleted.push(id);
      } catch (err) {
        results.failed.push({ id, error: err.message });
      }
    }

    res.json(results);
  } catch (err) { next(err); }
});

module.exports = router;
