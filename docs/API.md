# Contrato G3i — portal inmobiliario

Repos: `/Users/yeyodev/projects/work/bakano/clients/inmobiliaria/g3i-backapp` (Express 5 + Mongoose, :8100)
y `/Users/yeyodev/projects/work/bakano/clients/inmobiliaria/g3i-frontapp` (Vue 3 + Vite, :5173).

G3i es una inmobiliaria de Cumbayá/Tumbaco (Quito, Ecuador). SOLO venta, nunca arriendo.
Dos ejes distintos: **Propiedades** (unidades individuales, reventas) y **Proyectos** (desarrollos
completos con inventario de unidades). Todo el copy en español de Ecuador, en oraciones normales
(nunca TODO EN MAYÚSCULAS en títulos de propiedades).

## Catálogos (backend `src/config/catalogs.ts`, servidos en `GET /api/catalogs`)

- `PROPERTY_TYPES`: `casa`, `departamento`, `terreno`, `suite`, `local`, `oficina`
  (labels: Casa, Departamento, Terreno, Suite, Local comercial, Oficina)
- `PROPERTY_CONDITIONS` (etapa): `en-planos`, `en-construccion`, `a-estrenar`, `usada`
  (labels: En planos, En construcción, A estrenar / entrega inmediata, Usada)
- `PROJECT_STAGES`: `en-planos`, `en-construccion`, `por-estrenar`
- `SECTORS` (semilla): cumbaya, tumbaco, nayon, miravalle, puembo, pifo, san-patricio, lumbisi (label "Lumbisí"),
  ruta-viva — con label bonito ("Cumbayá", "Nayón", "San Patricio", "Ruta Viva"…). Ciudad siempre "Quito".
- `AMENITIES` (key → label). Propiedad: sala-estar, urbanizacion-privada, area-eventos, area-deportiva,
  ingreso-independiente, parqueadero-interno, sala-comunal, sauna, turco, piscina, areas-verdes, guardiania
  ("Guardianía y seguridad privada"), iluminacion, parqueadero-visitas, aire-acondicionado, cortinas, cisterna,
  extractor-olores, gimnasio, generador-electrico, puertas-electricas, parrilla, areas-infantiles, area-bbq,
  jacuzzi, frente-parque, jardin, vista, ascensor, balcon, terraza, bodega.
  Extra de proyectos: cancha-padel, zonas-humedas, parque-interno, coworking, pet-friendly, rooftop,
  ubicacion-estrategica, lobby, salon-comunal.
  Cada amenity: `{ key, label, icon }` (icon = clase Font Awesome, ej. `fa-solid fa-person-swimming`) y
  `scope: "property" | "project" | "both"`.

## Modelos

Todos con `timestamps`. `Image = { url: string; publicId: string; alt?: string }`.
`Location = { lat: number | null; lng: number | null; exact: boolean; radiusMeters: number }`
(si `exact=false` el público ve un círculo de `radiusMeters` (default 400) y el API público **desplaza** las
coordenadas de forma determinista unos cientos de metros para no revelar la ubicación real).

### Property
```
code: string (código interno alfanumérico, único, opcional al migrar -> generar "G3I-0001")
title, slug (único), summary (descripción corta ≤ 220), description (texto largo, párrafos separados por \n\n)
type: PropertyType; transaction: "venta" (fijo)
condition: PropertyCondition; ageYears: number | null
sector: string (slug de SECTORS); city: "Quito"; address: string (referencial)
location: Location
price: number (USD enteros); hoa: { enabled: boolean; amount: number }   // alícuota
totalM2, builtM2, gardenM2 (jardín / área exterior): number | null
bedrooms, bathrooms, halfBathrooms, parking, storageRooms (bodegas), elevators, floors (número de pisos): number | null
serviceBathroom: boolean
frontMeters, depthMeters, buildableFloors: number | null   // SOLO terrenos
amenities: string[] (keys)
images: Image[]  // images[0] ES la foto principal. Máx 25.
videos: { url: string; publicId: string }[]   // Cloudinary video o URL de YouTube
floorPlans: Image[]
status: "draft" | "published" | "sold" | "hidden"   // el público solo ve "published"
isFeatured: boolean; featuredOrder: number
project: ObjectId | null  (opcional: propiedad que pertenece a un proyecto)
source: { wpUrl: string }   // idempotencia de la migración
views: number
```
Regla de UI: si un número es 0/null su ícono NO se muestra. Terrenos muestran `totalM2` y `frontMeters`
en lugar de dormitorios/baños/parqueaderos.

### Project
```
code, title, slug, summary, description
stage: ProjectStage; propertyTypes: PropertyType[]  // qué vende
developer: string (constructora, opcional)
sector, city, address, location: Location
priceFrom: number | null   // si hay unidades disponibles se recalcula como el mínimo de sus precios
deliveryDate: string ("Febrero 2027")
totalUnits: number | null
amenities: string[]; highlights: string[] (beneficios: "Ubicación estratégica", ...)
images: Image[] (renders; [0] principal); videos; brochure: { url, publicId, name } | null
status: "draft" | "published" | "sold-out" | "hidden"
isFeatured, featuredOrder, source.wpUrl, views
```

### Unit (inventario de un proyecto)
```
project: ObjectId (required, index)
name ("Unidad 402"), type: PropertyType, floor: string
bedrooms, bathrooms, parking, storageRooms: number | null
builtM2, balconyM2, terraceM2, gardenM2: number | null
price: number; description: string
floorPlan: Image | null; images: Image[]
status: "available" | "reserved" | "sold"   // el público ve available + reserved; sold se oculta
order: number
```

### Lead
```
kind: "property" | "project" | "unit" | "sell" | "general" | "work-with-us" | "interested"
name, email, phone, message
sellSector, sellPropertyType     // solo kind="sell" (vender mi propiedad)
property, project, unit: ObjectId | null; refCode: string (código del inmueble), sourceUrl
status: "new" | "contacted" | "closed"
crm: { status: "pending" | "sent" | "failed" | "skipped"; error: string; externalId: string; sentAt: Date | null }
```
Al crear: guardar → notificar por correo a `NOTIFY_EMAIL` (Resend, nunca rompe) → enviar al CRM
(`crm.service.ts`: si `CRM_PROVIDER=kommo` usa la API v4 de Kommo `POST /api/v4/leads/complex` con
`KOMMO_SUBDOMAIN` + `KOMMO_ACCESS_TOKEN` (+ `KOMMO_PIPELINE_ID` opcional); si `CRM_WEBHOOK_URL` existe hace
POST JSON del lead; si nada está configurado `crm.status="skipped"`). El fallo del CRM nunca rompe la respuesta.
Rate limit simple en memoria por IP (máx 10 leads / 10 min) y honeypot `website` (si viene lleno → 200 falso).

### Post (blog)
`title, slug, excerpt, cover: Image | null, content (markdown simple: párrafos, "## " subtítulos, "- " listas, **negrita**, [link](url)), status: "draft"|"published", publishedAt`
### Faq
`question, answer, order, isPublished`
### Advisor
`name, role, photo: Image | null, bio, phone, email, order, isActive`
### Testimonial
`name, text, photo: Image | null, rating (1-5), context ("Compró en Cumbayá"), order, isActive`
### Partner (socios comerciales / clientes que confían)
`name, logo: Image | null, url, order, isActive`
### Settings (singleton, se crea con defaults si no existe)
```
hero: { title, subtitle, image: Image | null, ctaLabel, ctaLink }
popularSearches: { label: string; query: Record<string,string> }[]   // "Más buscadas", elegidas por el admin
                 ej. { label: "Casas en Cumbayá", query: { type: "casa", sector: "cumbaya" } }
about: { title, text, image: Image | null }      // Conócenos
stats: { label: string; value: string }[]        // opcional; si vacío el front usa conteos reales
contact: { whatsapp: "593995806119", phone: "0995806119", email, instagram, facebook, address }
sellCta: { title, text }
```

## API pública (sin auth). Respuestas con cuerpo desnudo. Paginado = `{ items, total, page, pages }`.

| Método | Ruta | Notas |
|---|---|---|
| GET | `/api/catalogs` | `{ propertyTypes, conditions, projectStages, sectors, amenities }` (cada uno `{key,label,...}`) |
| GET | `/api/sectors?active=true` | `[{ key, label, count }]`. Con `active=true` SOLO sectores con ≥1 propiedad o proyecto publicado |
| GET | `/api/site` | `{ settings, advisors, testimonials, partners, counts: { properties, projects, sectors } }` (solo activos) |
| GET | `/api/properties` | query: `type, sector, condition, minPrice, maxPrice, bedrooms (mínimo), q, featured=true, page=1, limit=12, sort=recent|price-asc|price-desc`. Items = PropertyCard |
| GET | `/api/properties/:slug` | Property completa (published) + incrementa views. 404 si no |
| GET | `/api/properties/:slug/related` | hasta 6 PropertyCard (mismo tipo o sector) |
| GET | `/api/projects` | query: `stage, sector, type, featured, q, page, limit`. Items = ProjectCard |
| GET | `/api/projects/:slug` | `{ project, units }` (units available+reserved, orden `order`) |
| GET | `/api/projects/:slug/related` | hasta 4 ProjectCard |
| GET | `/api/projects/:slug/units/:unitId` | `{ project: ProjectCard, unit }` |
| GET | `/api/map` | `{ properties: MapPin[], projects: MapPin[] }` solo con coords. `MapPin = { id, kind: "property"|"project", slug, title, type, price (o priceFrom), sector, cover, lat, lng, exact, radiusMeters, bedrooms, builtM2, totalM2 }`. Acepta los mismos filtros `type, sector, condition, stage` |
| GET | `/api/posts?page&limit` | PostCard `{ _id, title, slug, excerpt, cover }` (published). |
| GET | `/api/posts/:slug` | Post |
| GET | `/api/faqs` | Faq[] publicados |
| POST | `/api/leads` | body Lead parcial (`kind, name, email, phone, message, sellSector, sellPropertyType, property, project, unit, refCode, sourceUrl, website`) → `201 { ok: true }`. Validación: name y phone obligatorios; email válido si viene; en kind "sell" sector y tipo obligatorios |

`PropertyCard = { _id, code, title, slug, summary, type, condition, sector, price, cover (url), imagesCount,
bedrooms, bathrooms, parking, builtM2, totalM2, frontMeters, isFeatured }`
`ProjectCard = { _id, code, title, slug, summary, stage, propertyTypes, sector, priceFrom, deliveryDate, cover, unitsAvailable }`

## API admin (`authMiddleware` + `adminMiddleware`), prefijo `/api/admin`

| Recurso | Rutas |
|---|---|
| Dashboard | `GET /dashboard` → `{ properties: {published, draft, sold, hidden}, projects: {...}, units: {available, reserved, sold}, leads: { new, total, last7d }, recentLeads: Lead[5] }` |
| Propiedades | `GET /properties?q&status&type&page&limit` (todas), `GET /properties/:id`, `POST /properties`, `PUT /properties/:id`, `PATCH /properties/:id/status {status}`, `PATCH /properties/:id/featured {isFeatured, featuredOrder}`, `DELETE /properties/:id` (borra también sus archivos de Cloudinary) |
| Proyectos | igual que propiedades bajo `/projects` |
| Unidades | `GET /projects/:id/units`, `POST /projects/:id/units`, `PUT /units/:unitId`, `PATCH /units/:unitId/status {status}`, `DELETE /units/:unitId` (recalcula `priceFrom` del proyecto) |
| Blog | `GET/POST /posts`, `GET/PUT/DELETE /posts/:id` |
| FAQs | `GET/POST /faqs`, `PUT/DELETE /faqs/:id` |
| Asesores | `GET/POST /advisors`, `PUT/DELETE /advisors/:id` |
| Testimonios | `GET/POST /testimonials`, `PUT/DELETE /testimonials/:id` |
| Socios | `GET/POST /partners`, `PUT/DELETE /partners/:id` |
| Ajustes | `GET /settings`, `PUT /settings` |
| Leads | `GET /leads?kind&status&page`, `PATCH /leads/:id {status}`, `POST /leads/:id/crm-retry`, `DELETE /leads/:id` |
| Archivos | `POST /uploads` multipart campo `file` + query `folder` (properties/projects/posts/team/...) y `kind=image|video|raw` → `{ url, publicId, resourceType }`. Límite imagen 10 MB, video 100 MB (cortos), pdf 20 MB. `DELETE /uploads` body `{ publicId, resourceType }` |

Slugs: se generan desde el título con `utils/slugify.ts` y se desambiguan con sufijo si chocan.
Validación con `CustomError` en español (400/404/409).
