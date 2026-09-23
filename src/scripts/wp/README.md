# Migración desde el WordPress de g3i.ec

El sitio actual es WordPress + Elementor + JetEngine con la REST API bloqueada (Solid Security),
así que el contenido se extrae del HTML público a partir de los sitemaps de Yoast.

## Cómo correrlo

```bash
pnpm scrape:wp                  # sitemaps → data/wp-export.json (~4 min, pausa de 400 ms por request)
pnpm scrape:wp --renormalize    # sin red: recalcula los campos normalizados desde `raw` tras tocar mapping.ts
pnpm migrate:wp --dry-run       # muestra qué crearía / actualizaría
pnpm migrate:wp                 # upsert en Mongo (--only=properties|projects|content)
pnpm migrate:images             # sube a Cloudinary las imágenes que siguen en g3i.ec
```

- `data/wp-export.json` está commiteado: es el respaldo aunque el WordPress desaparezca. Cada ítem trae
  un bloque `raw` con los textos tal cual del sitio y `report` lista avisos, sectores y características
  que no se pudieron mapear.
- El import es idempotente: busca por `source.wpUrl` (propiedades/proyectos) o por nombre/título
  (unidades, testimonios, asesores, posts). Al re-correrlo conserva código, slug, visitas, destacados,
  un estado `sold`/`hidden` puesto desde el admin y las imágenes ya subidas a Cloudinary.
- Códigos `G3I-0001…` compartidos entre propiedades y proyectos, por fecha de publicación en WordPress.
- `published` si tiene precio e imágenes; si no, `draft`.

## Cómo se interpretó el sitio

- Los números de la ficha no tienen etiqueta, solo ícono: `ruler-combined` = área de construcción
  (lote en terrenos), `tree` = jardín (`gardenM2`), `ruler-horizontal` = frente del terreno.
  Verificado contra las descripciones.
- Baños "4.5" → `bathrooms: 4`, `halfBathrooms: 1`.
- Títulos pasados a oración, sin precio ni emojis; el original queda en `originalTitle`.
- Coordenadas del iframe de Google Maps (decimales, grados-minutos-segundos o plus code).
- Los testimonios se leen del listado de la home (el detalle viene vacío).

## Pendiente

- **Cloudinary**: las credenciales están vacías en `.env`, así que las 321 imágenes siguen apuntando a
  `g3i.ec`. Hay que configurarlas y correr `pnpm migrate:images` **antes de apagar el WordPress**.
- **Sin coordenadas** (8): las 5 fichas de Puembo (Taya), la casa de $255.874, el terreno de
  $285.000 y el proyecto Onze (Pacho Salas). Hay que ubicarlas desde el admin.
- **Sector "Checa"** (casa en Pakakuna Gardens) no existe en el catálogo: quedó `sector: "checa"`
  y en borrador porque su única foto da 404 en WordPress.
- El asesor David Gonzalez no tiene foto válida (404) ni bio en WordPress.
- Ningún proyecto tiene brochure PDF ni video, y solo "Casas independientes de lujo" publica inventario
  (2 casas). El resto lista tipologías "desde", que no se convirtieron en unidades.
