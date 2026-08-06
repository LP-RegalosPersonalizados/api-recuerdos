# Recuerdos Compartidos API

API REST para el ecosistema de **Recuerdos Compartidos** (sitio público, panel de administración y futuros consumidores). Construida con **Express 5**, desplegada en **Vercel** y utilizando **SheetDB.io** como capa de persistencia sobre Google Sheets.

Esta documentación describe el funcionamiento **real** de la API: endpoints, formas exactas de request/response, autenticación, errores, caché, rate limiting y el modelo de categorías dinámicas. Si estás construyendo sobre ella, leela completa antes de asumir comportamiento.

## Base URL

| Entorno | URL |
|---|---|
| Producción | `https://api-recuerdos.vercel.app` |
| Desarrollo local | `http://localhost:3001` |

Todos los ejemplos usan la URL de producción; reemplazala por la local cuando pruebes en desarrollo.

---

## Índice

- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Ejecución](#ejecución)
- [Despliegue en Vercel](#despliegue-en-vercel)
- [Variables de Entorno](#variables-de-entorno)
- [Arquitectura](#arquitectura)
- [Autenticación](#autenticación)
- [API: Convenciones](#api-convenciones)
- [API: Resumen de endpoints](#api-resumen-de-endpoints)
- [API: Endpoints Públicos](#api-endpoints-públicos)
- [API: Endpoints Protegidos](#api-endpoints-protegidos-requieren-jwt)
- [API: Endpoints Batch](#api-endpoints-batch-requieren-jwt)
- [Rate Limiting](#rate-limiting)
- [Caché](#caché)
- [Categorías: modelo y ciclo de vida](#categorías-modelo-y-ciclo-de-vida)
- [Errores](#errores)
- [Migración de los proyectos](#migración-de-los-proyectos)
- [Middleware](#middleware)
- [Changelog](#changelog)
- [Licencia](#licencia)

---

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
npm install
cp .env.example .env
```

Completa las variables en `.env` (ver [Variables de Entorno](#variables-de-entorno)).

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

> **Nota sobre builds estáticos:** los consumidores que prerenderizan páginas en build (como Astro) leen esta API en tiempo de build. Si esta API está caída durante el build, las lecturas fallan silenciosamente y se generan menos páginas. Ver [Migración de los proyectos](#migración-de-los-proyectos).

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

La API usa **JWT (JSON Web Tokens)** para proteger los endpoints de escritura (POST, PUT, PATCH, DELETE y batch). Los endpoints de lectura (GET) son públicos.

### Obtener token

```
POST /api/auth/login
```

```bash
curl -X POST https://api-recuerdos.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tudominio.com","password":"tu-contraseña"}'
```

Respuesta exitosa (`200`):

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "email": "admin@tudominio.com"
}
```

Errores:

| Código | Body |
|---|---|
| `400` | `{ "error": "Email y password requeridos" }` (faltan campos) |
| `401` | `{ "error": "Credenciales inválidas" }` |

El token expira a las **24 horas**.

### Usar token

Incluir el token en el header `Authorization` de todas las peticiones protegidas:

```
Authorization: Bearer <token>
```

### Verificar token

```
GET /api/auth/verify
```

```bash
curl https://api-recuerdos.vercel.app/api/auth/verify \
  -H "Authorization: Bearer <token>"
```

Respuesta (`200`):

```json
{
  "valid": true,
  "email": "admin@tudominio.com"
}
```

`401` con `{ "error": "Token requerido" }` o `{ "error": "Token inválido o expirado" }` si falta o es inválido.

---

## API: Convenciones

### Formato de respuestas

- Todas las respuestas son `application/json; charset=utf-8`.
- Los recursos se devuelven como objetos o arrays de objetos (nunca envueltos en un `{ data: ... }`).
- Los campos de tipo `undefined` se **omiten** del JSON (ej. `price` no aparece si el producto no tiene precio).
- Solo los GET de `/api/categorias*` llevan header `Cache-Control` para que el edge cachee la respuesta. `GET /api/productos` y `GET /api/trabajos` **no** se cachean en el edge: reflejan las escrituras al instante. Ver [Caché](#caché).

### Normalización de categorías

Toda categoría se normaliza a un **slug** con `slugify`:

- minúsculas,
- sin tildes/acentos,
- espacios y guiones bajos → guiones,
- caracteres especiales removidos,
- valor vacío o ausente → `otros`.

Por eso `product.category` siempre se devuelve como slug: una celda con `"Tazas"` se sirve como `"tazas"`. Y los filtros por categoría aceptan cualquier variante (`?categoria=Tazas` equivale a `tazas`).

### Orden y paginación

- **No existen** parámetros de orden ni paginación (`?sort=`, `?page=`, `?limit=` no están soportados).
- Las listas devuelven la hoja completa, en el orden de fila que devuelve SheetDB (orden de inserción en Google Sheets; no es un orden garantizado).
- Los únicos filtros disponibles son `?categoria=` en `GET /api/productos` y `?destino=` en `DELETE /api/categorias/:slug`.
- Los IDs de productos y trabajos son **enteros secuenciales autoincrementales** (se calculan como `máximo existente + 1` sobre el sheet). Al eliminar un registro su ID **no se reutiliza**.

### Hoja de datos

El backend usa **dos hojas** en Google Sheets (vía SheetDB): `productos` y `trabajos`. Las categorías de productos **no tienen hoja propia**: se derivan de la columna `category` de la hoja `productos`. Las categorías de trabajos son texto libre (ver `GET /api/trabajos`). Ver [Categorías: modelo y ciclo de vida](#categorías-modelo-y-ciclo-de-vida).

---

## API: Resumen de endpoints

| Método | Ruta | Auth | Límite |
|---|---|---|---|
| GET | `/` | No | global |
| POST | `/api/auth/login` | No | `/api/*` |
| GET | `/api/auth/verify` | Sí | `/api/*` |
| GET | `/api/productos` | No | `/api/*` |
| GET | `/api/productos/:id` | No | `/api/*` |
| POST | `/api/productos` | Sí | 5/min |
| PUT | `/api/productos/:id` | Sí | 5/min |
| DELETE | `/api/productos/:id` | Sí | 5/min |
| GET | `/api/categorias` | No | `/api/*` |
| GET | `/api/categorias/:slug` | No | `/api/*` |
| GET | `/api/categorias/:slug/productos` | No | `/api/*` |
| PATCH | `/api/categorias/:slug` | Sí | 5/min |
| DELETE | `/api/categorias/:slug` | Sí | 5/min |
| GET | `/api/trabajos` | No | `/api/*` |
| GET | `/api/trabajos/:id` | No | `/api/*` |
| POST | `/api/trabajos` | Sí | 5/min |
| PUT | `/api/trabajos/:id` | Sí | 5/min |
| DELETE | `/api/trabajos/:id` | Sí | 5/min |
| POST | `/api/productos/batch` | Sí | 10/min |
| POST | `/api/productos/batch/delete` | Sí | 10/min |
| POST | `/api/trabajos/batch` | Sí | 10/min |
| POST | `/api/trabajos/batch/delete` | Sí | 10/min |

El límite `/api/*` (10/min) aplica a **todos** los endpoints bajo `/api`, incluidos los públicos. Ver [Rate Limiting](#rate-limiting).

---

## API: Endpoints Públicos

No requieren autenticación. Están sujetos al límite global (30/min) y al de `/api/*` (10/min).

### `GET /` — Información de la API

```bash
curl https://api-recuerdos.vercel.app/
```

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

### `GET /api/productos` — Listar productos

```bash
curl https://api-recuerdos.vercel.app/api/productos
```

```json
[
  {
    "id": "1712345678901",
    "name": "Taza Personalizada",
    "slug": "taza-personalizada",
    "category": "tazas",
    "price": 15.99,
    "image": "https://res.cloudinary.com/.../taza.jpg",
    "gallery": ["https://res.cloudinary.com/.../taza-1.jpg"],
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

Campos:

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | ID único del producto |
| `name` | string | Nombre |
| `slug` | string | Slug para URLs (`/producto/:slug`) |
| `category` | string | Categoría **normalizada a slug** (nunca `null`) |
| `price` | number \| omitido | Precio numérico; se omite si la celda está vacía |
| `image` | string | URL de imagen principal (puede ser `""`) |
| `gallery` | string[] | Array de imágenes extra |
| `description` | string | Descripción (puede ser `""`) |
| `audience.general.available` | boolean | Visible en catálogo general |
| `audience.general.customizable` | boolean | Personalizable para público general |
| `audience.business.available` | boolean | Disponible para empresas |
| `audience.business.customizable` | boolean | Personalizable para empresas |
| `tags` | string[] | Etiquetas |
| `featured` | boolean | Destacado |

> **Nota:** la lista incluye **todos** los productos, también los de solo audiencia business. El sitio público filtra por `audience.general.available`.

### `GET /api/productos/:id` — Obtener producto por ID

```bash
curl https://api-recuerdos.vercel.app/api/productos/1712345678901
```

`200` con el objeto producto (misma forma que arriba). `404` con `{ "error": "Producto no encontrado" }` si el ID no existe.

### `GET /api/productos?categoria=:slug` — Filtrar productos por categoría

```bash
curl "https://api-recuerdos.vercel.app/api/productos?categoria=tazas"
```

Filtra en memoria sobre la lectura cacheada (sin llamadas extra a SheetDB). El valor se normaliza a slug, así que `?categoria=Tazas` y `?categoria=tazas` dan el mismo resultado. Devuelve un array (puede ser `[]` si no hay productos, sin error).

### `GET /api/categorias` — Listar categorías

```bash
curl https://api-recuerdos.vercel.app/api/categorias
```

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

Campos:

| Campo | Tipo | Descripción |
|---|---|---|
| `slug` | string | Slug normalizado (idem `product.category`) |
| `name` | string | Nombre legible (label) |
| `count` | number | Total de productos en la categoría (**sin filtro de audiencia**) |
| `image` | string | Imagen del primer producto que tiene una; `""` si ninguno |
| `seo.title` | string | Título SEO |
| `seo.description` | string | Meta descripción |
| `seo.intro` | string | Texto introductorio para la página |

Reglas:

- Orden: categorías curadas (del seed map) en su orden definido, luego el resto alfabéticamente por `name`.
- **`count` cuenta todos los productos**, incluidos los de solo audiencia business. Si el sitio público filtra por `general_available`, los conteos que muestra el frontend pueden ser menores que `count`.
- Las categorías **sin productos no aparecen** (el listado es derivado).
- Respuesta cacheada por el edge, sin consumo extra de SheetDB.

### `GET /api/categorias/:slug` — Obtener una categoría

```bash
curl https://api-recuerdos.vercel.app/api/categorias/tazas
```

`200` con el objeto de una categoría (misma forma que en la lista). `404` con `{ "error": "Categoría no encontrada" }` si el slug no tiene productos.

### `GET /api/categorias/:slug/productos` — Productos agrupados por categoría

```bash
curl https://api-recuerdos.vercel.app/api/categorias/tazas/productos
```

Devuelve el array de productos de esa categoría (misma forma que `GET /api/productos`). `404` si el slug no existe.

### `GET /api/trabajos` — Listar trabajos

```bash
curl https://api-recuerdos.vercel.app/api/trabajos
```

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

> **Nota:** las categorías de trabajos son texto libre (ej. `Particular`, `Corporativo`) y **no se normalizan ni se derivan** como las de productos.

### `GET /api/trabajos/:id` — Obtener trabajo por ID

```bash
curl https://api-recuerdos.vercel.app/api/trabajos/1712345678902
```

`200` con el objeto trabajo:

```json
{
  "id": "1712345678902",
  "title": "Decoración Bodas",
  "description": "Servicio de decoración para bodas",
  "image": "https://...",
  "category": "Particular",
  "quantity": "50"
}
```

`404` con `{ "error": "Trabajo no encontrado" }` si el ID no existe.

---

## API: Endpoints Protegidos (requieren JWT)

Requieren header `Authorization: Bearer <token>`. Límite individual de **5 peticiones por minuto**.

### `POST /api/productos` — Crear producto

```bash
curl -X POST https://api-recuerdos.vercel.app/api/productos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Taza Personalizada",
    "category": "tazas",
    "price": 15.99,
    "image": "https://...",
    "gallery": ["https://..."],
    "description": "Taza de cerámica personalizable",
    "general_available": true,
    "general_customizable": true,
    "business_available": false,
    "business_customizable": false,
    "tags": ["taza"],
    "featured": true
  }'
```

| Campo | Tipo | Requerido |
|---|---|---|
| `name` | string | Sí |
| `category` | string | Sí (se normaliza a slug al guardar) |
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
| `slug` | string | No (se genera automáticamente del nombre) |

`201` con el objeto producto creado. `400` con `{ "error": "name y category son requeridos" }` si faltan campos obligatorios.

> **Crear una categoría nueva:** si `category` no existe todavía, el producto la crea implícitamente — aparecerá en `GET /api/categorias` con metadata por defecto. Ver [Crear una categoría](#crear-una-categoría).

### `PUT /api/productos/:id` — Actualizar producto

```bash
curl -X PUT https://api-recuerdos.vercel.app/api/productos/1712345678901 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Nuevo Nombre", "price": 18}'
```

Acepta los mismos campos que la creación. Solo se actualizan los campos presentes en el body (actualización parcial). Si cambias `name` y no mandás `slug`, el slug se regenera del nombre. `200` con el producto actualizado; `404` si el ID no existe.

### `DELETE /api/productos/:id` — Eliminar producto

```bash
curl -X DELETE https://api-recuerdos.vercel.app/api/productos/1712345678901 \
  -H "Authorization: Bearer <token>"
```

`200` con `{ "message": "Producto eliminado", "id": "1712345678901" }`.

### `PATCH /api/categorias/:slug` — Renombrar una categoría

Cambia el slug de la categoría y **actualiza la columna `category` de todos sus productos**.

```bash
curl -X PATCH https://api-recuerdos.vercel.app/api/categorias/tazas \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"category": "tazas-personalizadas"}'
```

Respuesta (`200`):

```json
{
  "message": "Categoría renombrada de 'tazas' a 'tazas-personalizadas'",
  "slug": "tazas-personalizadas",
  "moved": 12,
  "updatedProducts": ["1", "2", "3"]
}
```

Comportamiento:

- El valor se normaliza a slug antes de aplicarlo.
- Si el slug de destino ya existe, los productos se **fusionan** en esa categoría.
- `400` si falta `category` o si el destino es igual al actual.
- `404` si el slug origen no tiene productos.

### `DELETE /api/categorias/:slug` — Eliminar una categoría

No borra productos: los **mueve** a la categoría destino indicada por `?destino=` (por defecto `otros`).

```bash
curl -X DELETE "https://api-recuerdos.vercel.app/api/categorias/fotos?destino=otros" \
  -H "Authorization: Bearer <token>"
```

Respuesta (`200`):

```json
{
  "message": "Categoría 'fotos' eliminada, sus productos se movieron a 'otros'",
  "slug": "fotos",
  "destino": "otros",
  "moved": 8,
  "updatedProducts": ["10", "11"]
}
```

Comportamiento:

- El `destino` se normaliza a slug; vacío → `otros`.
- `400` si `destino` es igual a la categoría a eliminar.
- `404` si el slug origen no tiene productos.

### `POST /api/trabajos` — Crear trabajo

```bash
curl -X POST https://api-recuerdos.vercel.app/api/trabajos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Decoración Bodas", "category": "Particular", "quantity": "50"}'
```

| Campo | Tipo | Requerido |
|---|---|---|
| `title` | string | Sí |
| `description` | string | No |
| `image` | string | No |
| `category` | string | No (default `Particular`) |
| `quantity` | string | No |

`201` con el objeto trabajo creado:

```json
{
  "id": "7",
  "title": "Decoración Bodas",
  "description": "",
  "image": "",
  "category": "Particular",
  "quantity": "50"
}
```

`400` con `{ "error": "title es requerido" }` si falta el título.

### `PUT /api/trabajos/:id` — Actualizar trabajo

```bash
curl -X PUT https://api-recuerdos.vercel.app/api/trabajos/1712345678902 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Decoración Bodas 2026", "category": "Corporativo"}'
```

Acepta los mismos campos que la creación. Solo se actualizan los campos presentes en el body. `200` con el trabajo actualizado:

```json
{
  "id": "1712345678902",
  "title": "Decoración Bodas 2026",
  "description": "Servicio de decoración para bodas",
  "image": "https://...",
  "category": "Corporativo",
  "quantity": "50"
}
```

`404` con `{ "error": "Trabajo no encontrado" }` si el ID no existe.

### `DELETE /api/trabajos/:id` — Eliminar trabajo

```bash
curl -X DELETE https://api-recuerdos.vercel.app/api/trabajos/1712345678902 \
  -H "Authorization: Bearer <token>"
```

`200`:

```json
{
  "message": "Trabajo eliminado",
  "id": "1712345678902"
}
```

---

## API: Endpoints Batch (requieren JWT)

Operaciones masivas sobre múltiples registros en una sola petición. Límite de **10 peticiones por minuto**.

### `POST /api/productos/batch` — Crear y actualizar múltiples productos

```bash
curl -X POST https://api-recuerdos.vercel.app/api/productos/batch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "creates": [
      { "name": "Producto 1", "category": "tazas" },
      { "name": "Producto 2", "category": "marcos" }
    ],
    "updates": [
      { "id": "1712345678901", "name": "Nombre actualizado" }
    ]
  }'
```

- `creates`: array de productos (sin `id`; los IDs se asignan secuencialmente). El slug se genera del nombre salvo que se provea `slug`.
- `updates`: array con `id` + campos a actualizar. Los fallos individuales no abortan el resto.

Respuesta:

```json
{
  "created": [{ "id": "7", "name": "Producto 1" }],
  "updated": [{ "id": "1712345678901" }],
  "failed": []
}
```

### `POST /api/productos/batch/delete` — Eliminar múltiples productos

```bash
curl -X POST https://api-recuerdos.vercel.app/api/productos/batch/delete \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["1712345678901", "1712345678902"]}'
```

Respuesta:

```json
{
  "deleted": ["1712345678901", "1712345678902"],
  "failed": []
}
```

### `POST /api/trabajos/batch` — Crear y actualizar múltiples trabajos

```bash
curl -X POST https://api-recuerdos.vercel.app/api/trabajos/batch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "creates": [
      { "title": "Decoración Cumpleaños", "category": "Particular" },
      { "title": "Stand Corporativo", "category": "Corporativo" }
    ],
    "updates": [
      { "id": "1712345678902", "quantity": "60" }
    ]
  }'
```

- `creates`: array de trabajos (sin `id`; los IDs se asignan secuencialmente).
- `updates`: array con `id` + campos a actualizar. Los fallos individuales no abortan el resto.

Respuesta:

```json
{
  "created": [
    { "id": "8", "title": "Decoración Cumpleaños" },
    { "id": "9", "title": "Stand Corporativo" }
  ],
  "updated": [{ "id": "1712345678902" }],
  "failed": []
}
```

### `POST /api/trabajos/batch/delete` — Eliminar múltiples trabajos

```bash
curl -X POST https://api-recuerdos.vercel.app/api/trabajos/batch/delete \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["1712345678902", "1712345678903"]}'
```

Respuesta:

```json
{
  "deleted": ["1712345678902", "1712345678903"],
  "failed": []
}
```

---

## Rate Limiting

| Ámbito | Límite | Ventana |
|---|---|---|
| Global (todos los endpoints) | 30 peticiones | 1 minuto |
| Namespace `/api/*` (todos, públicos y privados) | 10 peticiones | 1 minuto |
| Escritura individual (POST/PUT/PATCH/DELETE de productos, trabajos y categorías) | 5 peticiones | 1 minuto |
| Batch (`/api/*/batch`) | 10 peticiones | 1 minuto |

Cuando se excede un límite, la API responde `429` con un `{ "error": "..." }`; el mensaje depende del limiter que lo dispare (global, `/api/*`, escritura o batch). El límite más restrictivo que se alcance primero es el que se aplica.

---

## Caché

El cliente de SheetDB implementa un patrón **stale-while-revalidate** en memoria:

- **Fresh**: 1 hora — se sirve desde caché sin llamar a SheetDB.
- **Stale**: hasta 72 horas — se sirve desde caché y se revalida en segundo plano.
- **Escrituras**: invalidan la caché del sheet afectado (la próxima lectura vuelve a SheetDB).
- **Lecturas con filtro por ID** (búsqueda `search`, opción interna del cliente `sheetdb.js` usada solo por los endpoints `GET /:id`): no se cachean, siempre consultan a SheetDB. `search`/`limit`/`offset` **no** son query params públicos.
- Si SheetDB falla y hay datos en caché, se sirve la caché como fallback.

Capas adicionales:

- Solo los GET de `/api/categorias*` devuelven `Cache-Control: public, s-maxage=3600, stale-while-revalidate=259200`, permitiendo que Vercel cachee la respuesta en el edge por 1 hora con revalidación hasta 72 horas.
- `GET /api/productos` y `GET /api/categorias` comparten la **misma** lectura cacheada de la hoja `productos`: consultar categorías **no** suma llamadas a SheetDB.
- **Latencia de categorías nuevas:** por la caché de edge, una categoría recién creada puede tardar **hasta 1 hora** en aparecer en `GET /api/categorias`. En cambio `GET /api/productos` (sin edge cache) la refleja de inmediato tras la escritura. Planificá esto si el sitio necesita mostrar el cambio como inmediato.

---

## Categorías: modelo y ciclo de vida

Las categorías **no tienen una hoja propia**: viven dentro de la columna `category` de la hoja de productos. La API las deriva en tiempo real agrupando los productos por su categoría normalizada a slug. Esto garantiza:

- **Cero llamadas extra a SheetDB**: todos los endpoints públicos de categorías reusan la misma lectura cacheada de `productos`.
- **Siempre consistente**: el listado refleja exactamente lo que hay en la hoja, sin sincronización manual.
- **Resiliente a categorías nuevas**: si aparece una categoría que la API no conoce, se sirve con nombre y SEO generados por defecto (nunca falla).

### Crear una categoría

Para añadir una categoría nueva alcanza con **crear un producto con esa categoría**:

```bash
curl -X POST https://api-recuerdos.vercel.app/api/productos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Marco de Foto", "category": "marcos", "price": 12}'
```

La categoría aparece sola en `GET /api/categorias` con nombre legible y SEO generados por defecto:

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

También podés editarla directo en Google Sheets (la celda `category` de cualquier fila de `productos`).

> **Nota de latencia:** por la caché de edge, la categoría nueva puede tardar **hasta 1 hora** en aparecer en `GET /api/categorias`; `GET /api/productos` la refleja de inmediato. Ver [Caché](#caché).

### Curar nombre y SEO de una categoría

La metadata curada vive en `src/data/categories.js` (seed map `CATEGORY_METADATA`). Para personalizar el nombre legible o los textos SEO de una categoría, agregala ahí siguiendo el formato de las existentes y desplegá la API. Si una categoría **no está** en el seed map, se usa la generación por defecto (nunca rompe).

### Renombrar y eliminar

- `PATCH /api/categorias/:slug` actualiza la columna `category` de todos los productos de esa categoría (fusión si el destino ya existe).
- `DELETE /api/categorias/:slug?destino=otros` mueve sus productos a otra categoría; **nunca borra productos** (los productos se eliminan con `DELETE /api/productos/:id`).
- Una categoría sin productos desaparece del listado automáticamente.

### Aviso para builds estáticos

La API sirve una categoría nueva **en runtime, sin redeploy**. Pero los consumidores que prerenderizan (como LandingAstro en Astro) necesitan **redesplegar** después de agregar datos nuevos para que sus páginas estáticas (`/categoria/:slug`) se regeneren. Ver [Migración de los proyectos](#migración-de-los-proyectos).

---

## Errores

Todas las respuestas de error son JSON. Formato general:

| Código | Cuándo | Body |
|---|---|---|
| `400` | Validación o body inválido | `{ "error": "..." }` |
| `401` | Token faltante o inválido | `{ "error": "Token requerido" }` / `{ "error": "Token inválido o expirado" }` |
| `404` | Recurso no encontrado | `{ "error": "..." }` |
| `429` | Rate limit excedido | `{ "error": "<mensaje del limiter>" }` |
| `500` | Error interno | `{ "error": "Error interno", "message": "<detalle>" }` |

Mensajes de validación más comunes:

- `"name y category son requeridos"` — `POST /api/productos`.
- `"title es requerido"` — `POST /api/trabajos`.
- `"Email y password requeridos"` — `POST /api/auth/login`.
- `"Credenciales inválidas"` — `POST /api/auth/login`.
- `"Producto no encontrado"` / `"Trabajo no encontrado"` / `"Categoría no encontrada"` — búsquedas por ID/slug.
- `"category es requerido (nuevo slug de categoría)"` y `"El nuevo slug debe ser diferente al actual"` — `PATCH /api/categorias/:slug`.
- `"El destino debe ser diferente de la categoría a eliminar"` — `DELETE /api/categorias/:slug`.

---

## Migración de los proyectos

Esta API ya sirve categorías dinámicas. Los consumidores deben dejar de depender de constantes estáticas. Documentación de referencia para cada frontend:

### LandingAstro (sitio público)

El problema a resolver está documentado en `RIESGOS-DEPLOY.md` (R1: una categoría desconocida rompe el build por constantes estáticas). Pasos recomendados:

1. **Crear `src/data/categories.ts`** con `fetchCategories()` vía `safeFetch('/api/categorias')` (reusa `src/data/api.ts`).
2. **Reemplazar las constantes**: eliminar `categoryLabels` y `categorySEO` de `src/data/constants.ts` y usar el objeto de la API (`name` y `seo`). Como fallback por si la API está caída, mantener un mapa mínimo o construir el SEO por defecto en el frontend.
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

## Changelog

### v2.0.0 — Categorías dinámicas

- Nuevo endpoint `GET /api/categorias` (listado derivado de productos con metadata curada).
- `GET /api/categorias/:slug` y `GET /api/categorias/:slug/productos` (agrupación de productos por categoría).
- CRUD de categorías: `PATCH /api/categorias/:slug` (renombrar) y `DELETE /api/categorias/:slug` (mover productos a otro destino).
- Filtro `GET /api/productos?categoria=:slug`.
- Normalización de `category` a slug en toda la API (leer y escribir).
- Seed map `CATEGORY_METADATA` en `src/data/categories.js` con generación por defecto para categorías nuevas (resuelve R1 de `RIESGOS-DEPLOY.md`).
- Header `Cache-Control` en GETs públicos de categorías.

### v1.0.0 — Versión inicial

- CRUD de productos, trabajos y operaciones batch.
- Autenticación JWT.
- Caché stale-while-revalidate sobre SheetDB.

---

## Licencia

ISC
