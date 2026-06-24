const { slugify } = require('./slugify');

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
        available: row.general_available === 'TRUE' || row.general_available === true,
        customizable: row.general_customizable === 'TRUE' || row.general_customizable === true,
      },
      business: {
        available: row.business_available === 'TRUE' || row.business_available === true,
        customizable: row.business_customizable === 'TRUE' || row.business_customizable === true,
      },
    },
    tags,
    featured: row.featured === 'true' || row.featured === true,
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
