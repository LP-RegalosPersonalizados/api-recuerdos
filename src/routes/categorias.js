const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const sheetdb = require('../lib/sheetdb');
const { rowToProduct } = require('../utils/transform');
const { slugify } = require('../utils/slugify');
const { buildCategories } = require('../data/categories');

const router = Router();

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Demasiadas operaciones de escritura. Intenta de nuevo en un minuto.' },
});

function setPublicCache(res) {
  res.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=259200');
}

function normalizeSlug(value) {
  return slugify(String(value || '').trim());
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await sheetdb.read('productos');
    setPublicCache(res);
    res.json(buildCategories(rows.map(rowToProduct)));
  } catch (err) { next(err); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const rows = await sheetdb.read('productos');
    const category = buildCategories(rows.map(rowToProduct))
      .find(c => c.slug === req.params.slug);
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });
    setPublicCache(res);
    res.json(category);
  } catch (err) { next(err); }
});

router.get('/:slug/productos', async (req, res, next) => {
  try {
    const rows = await sheetdb.read('productos');
    const products = rows.map(rowToProduct);
    const exists = products.some(p => p.category === req.params.slug);
    if (!exists) return res.status(404).json({ error: 'Categoría no encontrada' });
    setPublicCache(res);
    res.json(products.filter(p => p.category === req.params.slug));
  } catch (err) { next(err); }
});

router.patch('/:slug', authenticate, writeLimiter, async (req, res, next) => {
  try {
    const oldSlug = normalizeSlug(req.params.slug);
    const newSlug = normalizeSlug(req.body.category);

    if (!newSlug) {
      return res.status(400).json({ error: 'category es requerido (nuevo slug de categoría)' });
    }
    if (newSlug === oldSlug) {
      return res.status(400).json({ error: 'El nuevo slug debe ser diferente al actual' });
    }

    const rows = await sheetdb.read('productos');
    const targets = rows.filter(r => normalizeSlug(r.category) === oldSlug);
    if (targets.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    for (const row of targets) {
      await sheetdb.update('productos', 'id', row.id, { category: newSlug });
    }

    res.json({
      message: `Categoría renombrada de '${oldSlug}' a '${newSlug}'`,
      slug: newSlug,
      moved: targets.length,
      updatedProducts: targets.map(r => String(r.id)),
    });
  } catch (err) { next(err); }
});

router.delete('/:slug', authenticate, writeLimiter, async (req, res, next) => {
  try {
    const oldSlug = normalizeSlug(req.params.slug);
    const destino = normalizeSlug(req.query.destino) || 'otros';

    if (destino === oldSlug) {
      return res.status(400).json({ error: 'El destino debe ser diferente de la categoría a eliminar' });
    }

    const rows = await sheetdb.read('productos');
    const targets = rows.filter(r => normalizeSlug(r.category) === oldSlug);
    if (targets.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    for (const row of targets) {
      await sheetdb.update('productos', 'id', row.id, { category: destino });
    }

    res.json({
      message: `Categoría '${oldSlug}' eliminada, sus productos se movieron a '${destino}'`,
      slug: oldSlug,
      destino,
      moved: targets.length,
      updatedProducts: targets.map(r => String(r.id)),
    });
  } catch (err) { next(err); }
});

module.exports = router;
