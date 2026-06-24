const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const sheetdb = require('../lib/sheetdb');
const { rowToTrabajo, trabajoToRow } = require('../utils/transform');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const rows = await sheetdb.read('trabajos');
    res.json(rows.map(rowToTrabajo));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const rows = await sheetdb.read('trabajos', {
      search: { id: req.params.id },
      limit: 1,
    });
    if (rows.length === 0) return res.status(404).json({ error: 'Trabajo no encontrado' });
    res.json(rowToTrabajo(rows[0]));
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { title, description, image, category, quantity } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title es requerido' });
    }

    const allRows = await sheetdb.read('trabajos');
    const maxId = allRows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
    const newId = String(maxId + 1);

    const trabajo = {
      id: newId,
      title,
      description: description || '',
      image: image || '',
      category: category || 'Particular',
      quantity: quantity || '',
    };

    await sheetdb.create('trabajos', trabajo);
    const created = await sheetdb.read('trabajos', { search: { id: newId }, limit: 1 });
    res.status(201).json(rowToTrabajo(created[0]));
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const updateData = {};
    const fields = ['title', 'description', 'image', 'category', 'quantity'];

    fields.forEach(f => {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    });

    await sheetdb.update('trabajos', 'id', req.params.id, updateData);
    const updated = await sheetdb.read('trabajos', { search: { id: req.params.id }, limit: 1 });
    if (updated.length === 0) return res.status(404).json({ error: 'Trabajo no encontrado' });
    res.json(rowToTrabajo(updated[0]));
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await sheetdb.remove('trabajos', 'id', req.params.id);
    res.json({ message: 'Trabajo eliminado', id: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
