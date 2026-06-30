const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const sheetdb = require('../lib/sheetdb');
const { productToRow } = require('../utils/transform');
const { slugify } = require('../utils/slugify');

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
      const rows = creates.map((p, i) => productToRow({
        ...p,
        id: String(Date.now() + i),
        slug: p.slug || slugify(p.name),
      }));
      await sheetdb.create('productos', rows);
      results.created = rows.map(r => ({ id: r.id, name: r.name }));
    }

    for (const item of updates) {
      try {
        const row = productToRow(item);
        await sheetdb.update('productos', 'id', item.id, row);
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
        await sheetdb.remove('productos', 'id', id);
        results.deleted.push(id);
      } catch (err) {
        results.failed.push({ id, error: err.message });
      }
    }

    res.json(results);
  } catch (err) { next(err); }
});

module.exports = router;
