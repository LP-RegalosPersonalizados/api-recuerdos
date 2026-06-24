const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const sheetdb = require('../lib/sheetdb');
const { rowToProduct } = require('../utils/transform');
const { slugify } = require('../utils/slugify');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const rows = await sheetdb.read('productos');
    res.json(rows.map(rowToProduct));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const rows = await sheetdb.read('productos', {
      search: { id: req.params.id },
      limit: 1,
    });
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rowToProduct(rows[0]));
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, category, price, image, gallery, description,
            general_available, general_customizable,
            business_available, business_customizable,
            tags, featured } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'name y category son requeridos' });
    }

    const slug = req.body.slug || slugify(name);

    const allRows = await sheetdb.read('productos');
    const maxId = allRows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
    const newId = String(maxId + 1);

    const product = {
      id: newId, name, slug, category,
      price: price != null ? String(price) : '',
      image: image || '',
      gallery: JSON.stringify(gallery || []),
      description: description || '',
      general_available: general_available ? 'TRUE' : 'FALSE',
      general_customizable: general_customizable ? 'TRUE' : 'FALSE',
      business_available: business_available ? 'TRUE' : 'FALSE',
      business_customizable: business_customizable ? 'TRUE' : 'FALSE',
      tags: JSON.stringify(tags || []),
      featured: featured ? 'true' : 'false',
    };

    await sheetdb.create('productos', product);
    const created = await sheetdb.read('productos', { search: { id: newId }, limit: 1 });
    res.status(201).json(rowToProduct(created[0]));
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const updateData = {};
    const fields = ['name', 'category', 'price', 'image', 'gallery', 'description',
                    'general_available', 'general_customizable',
                    'business_available', 'business_customizable', 'tags', 'featured'];

    fields.forEach(f => {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    });

    if (req.body.name !== undefined && req.body.slug === undefined) {
      updateData.slug = slugify(req.body.name);
    }
    if (req.body.slug !== undefined) updateData.slug = req.body.slug;
    if (req.body.price !== undefined) updateData.price = String(req.body.price);
    if (req.body.gallery !== undefined) updateData.gallery = JSON.stringify(req.body.gallery);
    if (req.body.tags !== undefined) updateData.tags = JSON.stringify(req.body.tags);
    if (req.body.featured !== undefined) updateData.featured = req.body.featured ? 'true' : 'false';
    if (req.body.general_available !== undefined) updateData.general_available = req.body.general_available ? 'TRUE' : 'FALSE';
    if (req.body.general_customizable !== undefined) updateData.general_customizable = req.body.general_customizable ? 'TRUE' : 'FALSE';
    if (req.body.business_available !== undefined) updateData.business_available = req.body.business_available ? 'TRUE' : 'FALSE';
    if (req.body.business_customizable !== undefined) updateData.business_customizable = req.body.business_customizable ? 'TRUE' : 'FALSE';

    await sheetdb.update('productos', 'id', req.params.id, updateData);
    const updated = await sheetdb.read('productos', { search: { id: req.params.id }, limit: 1 });
    if (updated.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rowToProduct(updated[0]));
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await sheetdb.remove('productos', 'id', req.params.id);
    res.json({ message: 'Producto eliminado', id: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
