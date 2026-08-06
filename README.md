# Recuerdos Compartidos API

API REST para el panel de administración de **Recuerdos Compartidos**, un negocio de recuerdos y productos personalizados. Construida con **Express 5**, desplegada en **Vercel** y utilizando **SheetDB.io** como capa de persistencia sobre Google Sheets.

---

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
npm install
cp .env.example .env
```

Completa las variables en `.env` (ver sección [Variables de Entorno](#variables-de-entorno)).

## Ejecución

```bash
# Desarrollo (con nodemon)
npm run dev

# Producción
npm start
```

El servidor arranca en `http://localhost:3001` por defecto.

## Despliegue en Vercel

```bash
npm i -g vercel
vercel --prod
```

El `vercel.json` enruta todo el tráfico a `api/index.js` como función serverless.

---

## Variables de Entorno

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (por defecto `3001`) |
| `SHEETDB_URL` | URL de la API de SheetDB (`https://sheetdb.io/api/v1/<API_KEY>`) |
| `SHEETDB_AUTH_LOGIN` | Usuario para Basic Auth de SheetDB (opcional) |
| `SHEETDB_AUTH_PASSWORD` | Contraseña para Basic Auth de SheetDB (opcional) |
| `JWT_SECRET` | Clave secreta para firmar los tokens JWT |
| `ADMIN_EMAIL` | Email del administrador para login |
| `ADMIN_PASSWORD` | Contraseña del administrador para login |
| `CORS_ORIGINS` | Orígenes permitidos separados por coma (ej. `http://localhost:4321,https://admin.vercel.app`) |
| `NODE_ENV` | Entorno: `development`, `production` o `staging` |

---

## Arquitectura

```
api-recuerdos/
├── api/
│   └── index.js                # Entry point serverless para Vercel
├── src/
│   ├── app.js                  # Configuración de Express (middleware, rutas)
│   ├── config.js               # Carga de variables de entorno
│   ├── data/
│   │   └── categories.js       # Metadata de categorías (seed map + builders)
│   ├── lib/
│   │   └── sheetdb.js          # Cliente SheetDB con caché stale-while-revalidate
│   ├── middleware/
│   │   └── auth.js             # Middleware de autenticación JWT
│   ├── routes/
│   │   ├── auth.js             # Login y verificación de token
│   │   ├── categorias.js       # Listado, agrupación y CRUD de categorías
│   │   ├── productos.js        # CRUD individual de productos
│   │   ├── trabajos.js         # CRUD individual de trabajos
│   │   ├── batchProductos.js   # Operaciones batch sobre productos
│   │   └── batchTrabajos.js    # Operaciones batch sobre trabajos
│   └── utils/
│       ├── slugify.js          # Generación de slugs URL-friendly
│       └── transform.js        # Transformación entre formato API y SheetDB
├── dev.js                      # Servidor de desarrollo local
├── vercel.json                 # Configuración de despliegue Vercel
├── .env.example                # Plantilla de variables de entorno
└── package.json
```

---

## Autenticación

La API usa **JWT (JSON Web Tokens)** para proteger los endpoints de escritura.

### Obtener token

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@tudominio.com",
  "password": "tu-contraseña"
}
```

Respuesta exitosa:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "email": "admin@tudominio.com"
}
```

### Usar token

Incluir el token en el header `Authorization` de las peticiones protegidas:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

El token expira a las **24 horas**.

### Verificar token

```
GET /api/auth/verify
Authorization: Bearer <token>
```

---

## API

### Endpoints Públicos

No requieren autenticación.

#### `GET /` — Información de la API

```json
{
  "name": "Recuerdos Compartidos API",
  "version": "2.0.0",
  "endpoints": {
    "auth": "/api/auth/login",
    "categorias": "/api/categorias",
    "productos": "/api/productos",
    "trabajos": "/api/trabajos"
  }
}
```

#### `GET /api/productos` — Listar productos

```json
[
  {
    "id": "1712345678901",
    "name": "Taza Personalizada",
    "slug": "taza-personalizada",
    "category": "tazas",
    "price": 15.99,
    "image": "https://...",
    "gallery": ["https://...", "https://..."],
    "description": "Taza de cerámica personalizable",
    "audience": {
      "general": { "available": true, "customizable": true },
      "business": { "available": false, "customizable": false }
    },
    "tags": ["taza", "personalizado"],
    "featured": true
  }
]
```

#### `GET /api/productos/:id` — Obtener producto por ID

#### `GET /api/productos?categoria=tazas` — Filtrar productos por categoría

Filtra en memoria sobre la lectura cacheada, sin llamadas extra a SheetDB. El valor se normaliza a slug (`Tazas` → `tazas`).

```
GET /api/productos?categoria=tazas
```

#### `GET /api/categorias` — Listar categorías

Las categorías **se derivan automáticamente de los productos**: cada valor distinto de la columna `category` se normaliza a slug, se cuenta y se enriquece con metadata (label + SEO) desde el seed map de la API (o con valores generados por defecto si es una categoría nueva).

```json
[
  {
    "slug": "tazas",
    "name": "Tazas",
    "count": 12,
    "image": "https://res.cloudinary.com/.../taza.jpg",
    "seo": {
      "title": "Tazas Personalizadas en Santa Cruz de la Sierra",
      "description": "Tazas cerámicas y metálicas personalizadas con fotos, nombres o logos en Santa Cruz de la Sierra...",
      "intro": "Las tazas personalizadas son el regalo ideal para cualquier ocasión..."
    }
  }
]
```

- `count`: total de productos en la categoría.
- `image`: imagen del primer producto que tiene una.
- Respuesta cacheada por el edge (`Cache-Control`), sin consumo extra de SheetDB.

#### `GET /api/categorias/:slug` — Obtener una categoría

```
GET /api/categorias/tazas
```

Devuelve un solo objeto de categoría o `404` si no existe.

#### `GET /api/categorias/:slug/productos` — Productos agrupados por categoría

```
GET /api/categorias/tazas/productos
```

Devuelve el array de productos de esa categoría (misma forma que `GET /api/productos`).

#### `GET /api/trabajos` — Listar trabajos

```json
[
  {
    "id": "1712345678902",
    "title": "Decoración Bodas",
    "description": "Servicio de decoración para bodas",
    "image": "https://...",
    "category": "Particular",
    "quantity": "50"
  }
]
```

#### `GET /api/trabajos/:id` — Obtener trabajo por ID

---

### Endpoints Protegidos (requieren JWT)

Requieren header `Authorization: Bearer <token>`.

#### `POST /api/productos` — Crear producto

| Campo | Tipo | Requerido |
|---|---|---|
| `name` | string | Sí |
| `category` | string | Sí |
| `price` | number | No |
| `image` | string | No |
| `gallery` | string[] | No |
| `description` | string | No |
| `general_available` | boolean | No |
| `general_customizable` | boolean | No |
| `business_available` | boolean | No |
| `business_customizable` | boolean | No |
| `tags` | string[] | No |
| `featured` | boolean | No |
| `slug` | string | No (se genera automáticamente) |

Límite: **5 peticiones por minuto**.

#### `PUT /api/productos/:id` — Actualizar producto

Mismos campos que creación. Solo se actualizan los campos incluidos en el body.

#### `DELETE /api/productos/:id` — Eliminar producto

#### `PATCH /api/categorias/:slug` — Renombrar una categoría

Cambia el slug de la categoría y **actualiza la columna `category` de todos sus productos**.

```
PATCH /api/categorias/tazas
Authorization: Bearer <token>
Content-Type: application/json

{ "category": "tazas-personalizadas" }
```

Respuesta:

```json
{
  "message": "Categoría renombrada de 'tazas' a 'tazas-personalizadas'",
  "slug": "tazas-personalizadas",
  "moved": 12,
  "updatedProducts": ["1", "2", "3"]
}
```

Si el slug de destino ya existe, los productos se **fusionan** en esa categoría.

Límite: **5 peticiones por minuto**.

#### `DELETE /api/categorias/:slug` — Eliminar una categoría

No borra los productos: los **mueve** a la categoría destino indicada por `?destino=` (por defecto `otros`).

```
DELETE /api/categorias/fotos?destino=otros
Authorization: Bearer <token>
```

Respuesta:

```json
{
  "message": "Categoría 'fotos' eliminada, sus productos se movieron a 'otros'",
  "slug": "fotos",
  "destino": "otros",
  "moved": 8,
  "updatedProducts": ["10", "11"]
}
```

Límite: **5 peticiones por minuto**.

#### `POST /api/trabajos` — Crear trabajo

| Campo | Tipo | Requerido |
|---|---|---|
| `title` | string | Sí |
| `description` | string | No |
| `image` | string | No |
| `category` | string | No (default `Particular`) |
| `quantity` | string | No |

Límite: **5 peticiones por minuto**.

#### `PUT /api/trabajos/:id` — Actualizar trabajo

#### `DELETE /api/trabajos/:id` — Eliminar trabajo

---

### Endpoints Batch (requieren JWT)

Operaciones masivas sobre múltiples registros en una sola petición.

Límite: **10 peticiones por minuto**.

#### `POST /api/productos/batch` — Crear y actualizar múltiples productos

```json
{
  "creates": [
    { "name": "Producto 1", "category": "categoria" },
    { "name": "Producto 2", "category": "categoria" }
  ],
  "updates": [
    { "id": "1712345678901", "name": "Nombre actualizado" }
  ]
}
```

Respuesta:

```json
{
  "created": [{ "id": "1712345678...", "name": "Producto 1" }],
  "updated": [{ "id": "1712345678901" }],
  "failed": []
}
```

#### `POST /api/productos/batch/delete` — Eliminar múltiples productos

```json
{
  "ids": ["1712345678901", "1712345678902"]
}
```

#### `POST /api/trabajos/batch` — Crear y actualizar múltiples trabajos

#### `POST /api/trabajos/batch/delete` — Eliminar múltiples trabajos

---

## Rate Limiting

| Ámbito | Límite | Ventana |
|---|---|---|
| Global | 30 peticiones | 1 minuto |
| Login (`/api/auth`) | 10 peticiones | 1 minuto |
| Escritura (POST/PUT/DELETE individual) | 5 peticiones | 1 minuto |
| Batch | 10 peticiones | 1 minuto |

---

## Caché

El cliente de SheetDB implementa un patrón **stale-while-revalidate**:

- **Fresh**: 1 hora — se sirve desde caché sin llamar a SheetDB.
- **Stale**: hasta 72 horas — se sirve desde caché y se revalida en segundo plano.
- **Escrituras**: invalidan la caché del sheet afectado.
- **Lecturas con filtro** (por ID): no se cachean, siempre consultan a SheetDB.
- Si SheetDB falla y hay datos en caché, se sirve la caché como fallback.

---

## Categorías: modelo y ciclo de vida

Las categorías **no tienen una hoja propia**: viven dentro de la columna `category` de la hoja de productos. La API las deriva en tiempo real agrupando los productos por su categoría normalizada a slug. Esto garantiza:

- **Cero llamadas extra a SheetDB**: todos los endpoints públicos de categorías reusan la misma lectura cacheada de `productos`.
- **Siempre consistente**: el listado refleja exactamente lo que hay en la hoja, sin sincronización manual.

### Crear una categoría

Para añadir una categoría nueva alcanza con **crear un producto con esa categoría** (`POST /api/productos` con `category: "marcos"`, o editando la hoja en Google Sheets). La categoría aparece sola en `GET /api/categorias`, con nombre legible y SEO generados por defecto:

```json
{
  "slug": "marcos",
  "name": "Marcos",
  "count": 1,
  "image": "...",
  "seo": {
    "title": "Marcos Personalizados en Santa Cruz de la Sierra",
    "description": "Descubrí marcos personalizados en Santa Cruz de la Sierra. Recuerdos únicos hechos a tu medida. Cotizá por WhatsApp.",
    "intro": "En Recuerdos Compartidos creamos marcos personalizados a tu medida..."
  }
}
```

### Curar nombre y SEO de una categoría

La metadata curada vive en `src/data/categories.js` (seed map `CATEGORY_METADATA`). Para personalizar el nombre legible o los textos SEO de una categoría nueva, agregala ahí siguiendo el formato de las existentes y desplegá la API. Si una categoría **no está** en el seed map, se usa la generación por defecto (nunca falla).

### Renombrar y eliminar

- `PATCH /api/categorias/:slug` actualiza la columna `category` de todos los productos de esa categoría (fusión si el destino ya existe).
- `DELETE /api/categorias/:slug?destino=otros` mueve sus productos a otra categoría; **nunca borra productos** (los productos se eliminan con `DELETE /api/productos/:id`).
- Una categoría sin productos desaparece del listado automáticamente.

---

## Migración de los proyectos

Esta API ya sirve categorías dinámicas. Los consumidores deben dejar de depender de constantes estáticas. Documentación de referencia para cada frontend:

### LandingAstro (sitio público)

El problema a resolver está documentado en `RIESGOS-DEPLOY.md` (R1: categoría desconocida rompe el build por constantes estáticas). Pasos recomendados:

1. **Crear `src/data/categories.ts`** con `fetchCategories()` vía `safeFetch('/api/categorias')` (reusa `src/data/api.ts`).
2. **Reemplazar las constantes**: eliminar `categoryLabels` y `categorySEO` de `src/data/constants.ts` y usar el objeto de la API (`name` y `seo`). Como fallback por si la API está caída, mantener un mapa mínimo (p. ej. solo labels) o construir el SEO por defecto en el frontend.
3. **`src/pages/categoria/[slug].astro`**:
   - `getStaticPaths`: derivar slugs de `fetchCategories()` (no de los productos) o mantener la derivación por productos pero buscar el SEO con `categorySEO[category] ?? categorySEO.otros`.
   - Eliminar el `return new Response(...)` de una página prerendered (R2): validar en `getStaticPaths` y devolver `[]`/`Astro.redirect()`.
   - Mantener `safeFetch` que ya devuelve `[]` en fallo (R3): si la API está caída en build, se generan menos páginas en vez de romper.
4. **`src/components/productos/ProductGrid.tsx`** y **`ProductDetail.tsx`**: usar `categories.find(c => c.slug === cat)?.name ?? cat`.
5. Después de desplegar la API y agregar datos nuevos, **redesplegar** el sitio para regenerar las páginas estáticas con las categorías nuevas.

### admin-recuerdos (panel de administración)

1. **`src/utils/constants.js`**: `PRODUCT_CATEGORIES` puede reemplazarse por el resultado de `GET /api/categorias` (`slug` como value y `name` como label). Mantener `TRABAJO_CATEGORIES` como está (las categorías de trabajos no cambian).
2. **`src/features/productos/ProductForm.jsx`**: cargar el `<select>` de categorías desde la API al montar el formulario.
3. **Dashboard** (`DashboardContainer.jsx`): `PRODUCT_CATEGORIES` dinámico para los gráficos de distribución.

---

## Middleware

| Middleware | Descripción |
|---|---|
| `compression` | Comprime respuestas con gzip |
| `cors` | Control de orígenes permitidos |
| `morgan` | Logging de peticiones (solo en desarrollo) |
| `express-rate-limit` | Rate limiting por IP |
| `auth.authenticate` | Verifica JWT en endpoints protegidos |

---

## Licencia

ISC
