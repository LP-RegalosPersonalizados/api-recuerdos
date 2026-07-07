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
│   ├── lib/
│   │   └── sheetdb.js          # Cliente SheetDB con caché stale-while-revalidate
│   ├── middleware/
│   │   └── auth.js             # Middleware de autenticación JWT
│   ├── routes/
│   │   ├── auth.js             # Login y verificación de token
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
