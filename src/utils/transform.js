const { slugify } = require('./slugify');

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

function rowToProduct(row) {
  let gallery = [];
  try { gallery = JSON.parse(row.gallery || '[]'); } catch {}
  let tags = [];
  try { tags = JSON.parse(row.tags || '[]'); } catch {}

  return {
    id: String(row.id || ''),
    name: row.name || '',
    slug: row.slug || '',
    category: row.category || 'otros',
    price: row.price ? Number(row.price) : undefined,
    image: row.image || '',
    gallery,
    description: row.description || '',
    audience: {
      general: {
        available: parseBoolean(row.general_available),
        customizable: parseBoolean(row.general_customizable),
      },
      business: {
        available: parseBoolean(row.business_available),
        customizable: parseBoolean(row.business_customizable),
      },
    },
    tags,
    featured: parseBoolean(row.featured),
  };
}

function productToRow(product) {
  return {
    id: String(product.id),
    name: product.name,
    slug: product.slug || slugify(product.name),
    category: product.category,
    price: product.price != null ? String(product.price) : '',
    image: product.image,
    gallery: JSON.stringify(product.gallery || []),
    description: product.description,
    general_available: product.audience?.general?.available ? 'TRUE' : 'FALSE',
    general_customizable: product.audience?.general?.customizable ? 'TRUE' : 'FALSE',
    business_available: product.audience?.business?.available ? 'TRUE' : 'FALSE',
    business_customizable: product.audience?.business?.customizable ? 'TRUE' : 'FALSE',
    tags: JSON.stringify(product.tags || []),
    featured: product.featured ? 'true' : 'false',
  };
}

function rowToTrabajo(row) {
  return {
    id: String(row.id || ''),
    title: row.title || '',
    description: row.description || '',
    image: row.image || '',
    category: row.category || 'Particular',
    quantity: row.quantity || '',
  };
}

function trabajoToRow(trabajo) {
  return {
    id: String(trabajo.id),
    title: trabajo.title,
    description: trabajo.description,
    image: trabajo.image,
    category: trabajo.category,
    quantity: trabajo.quantity,
  };
}

module.exports = { rowToProduct, productToRow, rowToTrabajo, trabajoToRow };
