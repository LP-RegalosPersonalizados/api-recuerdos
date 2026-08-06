const { slugify } = require('../utils/slugify');

const BRAND_NAME = 'Santa Cruz de la Sierra';

const CATEGORY_METADATA = {
  tazas: {
    name: 'Tazas',
    seo: {
      title: 'Tazas Personalizadas en Santa Cruz de la Sierra',
      description: 'Tazas cerámicas y metálicas personalizadas con fotos, nombres o logos en Santa Cruz de la Sierra. Ideales para regalar o para tu empresa. Cotizá por WhatsApp.',
      intro: 'Las tazas personalizadas son el regalo ideal para cualquier ocasión: cumpleaños, aniversarios, empresas y eventos. En Recuerdos Compartidos las personalizamos con fotos, nombres, frases o tu logo, en versiones cerámicas y metálicas con excelente calidad de impresión.',
    },
  },
  fotos: {
    name: 'Fotos',
    seo: {
      title: 'Fotos Polaroid Personalizadas en Santa Cruz de la Sierra',
      description: 'Fotos estilo Polaroid con acabado mate personalizadas con tus recuerdos en Santa Cruz de la Sierra. Distintos tamaños y formatos. Cotizá por WhatsApp.',
      intro: 'Convierte tus recuerdos en fotos estilo Polaroid con acabado mate y alta definición. En Recuerdos Compartidos manejamos distintos tamaños y formatos para que tu momento especial quede plasmado con la mejor calidad.',
    },
  },
  cuadros: {
    name: 'Cuadros',
    seo: {
      title: 'Cuadros Personalizados en Santa Cruz de la Sierra',
      description: 'Cuadros decorativos personalizados con tus fotos y diseños en Santa Cruz de la Sierra. Perfectos para regalar o decorar tu hogar. Cotizá por WhatsApp.',
      intro: 'Cuadros personalizados con tus fotos y recuerdos más especiales. Diseños únicos que combinan funcionalidad y estética para decorar tu hogar, oficina o regalar en ocasiones especiales.',
    },
  },
  festivos: {
    name: 'Regalos Festivos',
    seo: {
      title: 'Packs y Regalos Festivos Personalizados en Santa Cruz de la Sierra',
      description: 'Packs de regalo y obsequios festivos personalizados en Santa Cruz de la Sierra: Día del Padre, de la Madre, San Valentín y más. Cotizá por WhatsApp.',
      intro: 'Packs temáticos y regalos festivos coordinados para cada celebración: Día del Padre, de la Madre, San Valentín, Navidad y más. Combinamos múltiples productos personalizados en presentaciones listas para regalar.',
    },
  },
  alcancia: {
    name: 'Alcancias',
    seo: {
      title: 'Alcancias Personalizadas en Santa Cruz de la Sierra',
      description: 'Alcancias de madera personalizadas con diseños únicos en Santa Cruz de la Sierra. Perfectas como regalo para niños, adultos o decoración. Cotizá por WhatsApp.',
      intro: 'Alcancias decorativas de madera con diseño personalizado. Combinan funcionalidad y estética, perfectas como regalo para niños, adultos o como elemento decorativo único en tu hogar.',
    },
  },
  llaveros: {
    name: 'Llaveros',
    seo: {
      title: 'Llaveros Personalizados en Santa Cruz de la Sierra',
      description: 'Llaveros personalizados a pedido con cualquier tipo de diseño en Santa Cruz de la Sierra. Ideales para empresas y regalos. Cotizá por WhatsApp.',
      intro: 'Llaveros personalizados a pedido con cualquier tipo de diseño: fotos, logos, nombres y más. El detalle perfecto para regalar o para tu empresa, con impresión de alta calidad.',
    },
  },
  otros: {
    name: 'Otros',
    seo: {
      title: 'Regalos Personalizados en Santa Cruz de la Sierra',
      description: 'Descubrí todos nuestros regalos personalizados en Santa Cruz de la Sierra: tazas, fotos, cuadros, alcancias, llaveros y más. Cotizá por WhatsApp.',
      intro: 'En Recuerdos Compartidos creamos regalos únicos y memorables. Explorá todos nuestros productos personalizados hechos a tu medida en Santa Cruz de la Sierra, Bolivia.',
    },
  },
};

function humanizeCategory(slug) {
  const curated = CATEGORY_METADATA[slug]?.name;
  if (curated) return curated;
  return slug
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function defaultCategorySEO(name) {
  return {
    title: `${name} Personalizados en ${BRAND_NAME}`,
    description: `Descubrí ${name.toLowerCase()} personalizados en Santa Cruz de la Sierra. Recuerdos únicos hechos a tu medida. Cotizá por WhatsApp.`,
    intro: `En Recuerdos Compartidos creamos ${name.toLowerCase()} personalizados a tu medida. Productos únicos y memorables hechos en Santa Cruz de la Sierra, Bolivia.`,
  };
}

function getCategoryMeta(slug) {
  const curated = CATEGORY_METADATA[slug];
  if (curated) {
    return { name: curated.name, seo: curated.seo };
  }
  const name = humanizeCategory(slug);
  return { name, seo: defaultCategorySEO(name) };
}

function buildCategories(products) {
  const map = new Map();

  for (const product of products || []) {
    const raw = String(product.category || 'otros').trim();
    const slug = raw ? slugify(raw) : 'otros';
    if (!map.has(slug)) map.set(slug, { slug, count: 0, image: '' });
    const entry = map.get(slug);
    entry.count += 1;
    if (!entry.image && product.image) entry.image = product.image;
  }

  const categories = [...map.values()].map(({ slug, count, image }) => {
    const { name, seo } = getCategoryMeta(slug);
    return { slug, name, count, image, seo };
  });

  const order = Object.keys(CATEGORY_METADATA);
  categories.sort((a, b) => {
    const ia = order.indexOf(a.slug);
    const ib = order.indexOf(b.slug);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  return categories;
}

module.exports = {
  CATEGORY_METADATA,
  buildCategories,
  getCategoryMeta,
  humanizeCategory,
  defaultCategorySEO,
};
