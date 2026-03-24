# Decap CMS — El Gallo Galante

## Resumen

El proyecto utiliza [Decap CMS](https://decapcms.org/) (antes Netlify CMS) como
interfaz editorial para que los editores puedan crear y modificar contenido sin
necesidad de editar archivos directamente en el repositorio.

Todo el contenido se almacena como archivos Markdown con frontmatter YAML en Git.
No hay base de datos. Decap CMS simplemente genera commits contra el repositorio
de GitHub.

---

## Qué se implementó

### Fase 1 — Fundación

- `public/admin/index.html` — carga Decap CMS desde CDN.
- `public/admin/config.yml` — configuración completa con tres colecciones:
  - **Números** (issues)
  - **Autores** (authors)
  - **Publicaciones** (posts)
- Backend de GitHub con placeholders.
- Rutas de media por colección (`/covers/`, `/authors/`, `/posts/`).
- Interfaz en español (`locale: "es"`).

### Fase 2 — Endurecimiento y UX editorial

- Auditoría completa de compatibilidad entre los campos del CMS y los esquemas
  Zod de Astro en `src/content/config.ts`.
- Verificación de que los widgets de relación (`author`, `traductor`, `issue`,
  `featuredPostSlugs`) producen valores compatibles con `getEntry()` y las
  comparaciones `===` en los templates.
- Verificación de que los valores de categoría incluyen acentos exactos
  (`Poesía`, `Crítica`) tal como los espera el esquema y los templates.
- Hints editoriales en español para guiar a los editores en cada campo.
- Descripciones de colección visibles en el panel de administración.
- Documentación interna en los comentarios del YAML explicando decisiones
  de diseño y resultados de auditoría.

---

## Cómo funciona `/admin`

### Acceso

Navegar a `https://tu-dominio.pages.dev/admin/` abre la interfaz de Decap CMS.

Los archivos son estáticos:
- `public/admin/index.html` — carga el SPA de Decap desde CDN.
- `public/admin/config.yml` — Decap lo lee automáticamente desde `/admin/config.yml`.

No se requiere ningún plugin de Astro. Los archivos están en `public/` y se
sirven tal cual por Cloudflare Pages.

### Autenticación

Decap CMS necesita autenticar al usuario contra GitHub para poder hacer commits.
En Netlify esto es automático, pero en **Cloudflare Pages se necesita un proxy
OAuth externo**. Ver la sección [Configuración externa](#configuración-externa-pendiente).

---

## Colecciones

### Números (`src/content/issues/`)

| Campo | Widget | Requerido | Notas |
|-------|--------|-----------|-------|
| `title` | string | Sí | Nombre completo del número |
| `date` | datetime | Sí | Fecha de publicación |
| `number` | string | No | Formato breve, ej. "No. 01" |
| `coverImage` | image | No | Se sube a `/covers/` |
| `description` | text | No | Breve descripción |
| `featuredPostSlugs` | list/relation | No | Posts destacados en la página de inicio |
| body | markdown | No | Nota editorial (puede quedar vacía) |

### Autores (`src/content/authors/`)

| Campo | Widget | Requerido | Notas |
|-------|--------|-----------|-------|
| `name` | string | Sí | Nombre completo |
| `birthYear` | string | Sí | Texto libre: "1990" o "1986 - 2025" |
| `birthPlace` | string | Sí | Ciudad o estado |
| `photo` | image | No | Se sube a `/authors/` |
| `gender` | boolean | No | Activado = masculino, desactivado = femenino |
| `social` | object | No | Redes sociales (colapsable) |
| body | markdown | No | **Biografía — vive en el body, NO en frontmatter** |

> **Importante:** La biografía del autor es el contenido Markdown del archivo,
> no un campo del frontmatter. Astro lo renderiza con `author.render()`. El
> widget "Biografía" en el CMS edita ese body.

### Publicaciones (`src/content/posts/`)

| Campo | Widget | Requerido | Notas |
|-------|--------|-----------|-------|
| `title` | string | Sí | Título del texto |
| `date` | datetime | Sí | Fecha de publicación |
| `category` | select | Sí | Poesía, Narrativa, Crítica, Ensayo, Epistolario |
| `issue` | relation → issues | Sí | Slug del número |
| `author` | relation → authors | Sí | Slug del autor |
| `traductor` | relation → authors | No | Solo para traducciones |
| `excerpt` | text | No | Resumen para vistas previas |
| `coverImage` | image | No | Imagen de tarjeta, se sube a `/posts/` |
| `featuredImage` | image | No | Imagen hero del artículo |
| `imagePosition` | select | No | top / center / bottom |
| body | markdown | — | Contenido del texto |

---

## Imágenes y rutas de media

Cada colección tiene su propia carpeta de destino para uploads:

| Colección | Carpeta de upload | Ruta en frontmatter | Directorio en disco |
|-----------|-------------------|---------------------|---------------------|
| Números | `/public/covers` | `/covers/...` | `public/covers/` |
| Autores | `/public/authors` | `/authors/...` | `public/authors/` |
| Publicaciones | `/public/posts` | `/posts/...` | `public/posts/` |
| Fallback global | `/public/assets` | `/assets/...` | `public/assets/` |

### ¿Por qué `/covers/` y no `/issues/`?

Todo el contenido existente de números almacena sus portadas con rutas como
`/covers/ano-1-numero-0.jpg`. La carpeta `public/covers/` ya existe con las
imágenes. Cambiar a `/issues/` requeriría migrar todas las referencias
existentes sin beneficio funcional.

---

## Prácticas editoriales

### Poesía

- Usar saltos de línea simples (Enter) entre versos de una misma estrofa.
- Usar una línea vacía para separar estrofas.
- Para firmas o dedicatorias, usar HTML:
  ```html
  <p class="poem-signature">Ciudad, fecha</p>
  ```
- El CMS preserva el Markdown tal cual — los templates aplican
  `whitespace-pre-line` para poesía.

### Narrativa y ensayo

- El texto se renderiza con `text-justify` y drop cap automático.
- Se pueden usar negritas, cursivas, títulos y citas de Markdown normalmente.

### Traducciones

- Crear al traductor como autor en la colección de Autores antes de asignarlo.
- El campo `traductor` es opcional; solo aparece si se selecciona un valor.

### Imágenes

- `coverImage` aparece en las tarjetas de vista previa y en el carrusel de la
  página de inicio.
- `featuredImage` aparece como imagen hero al inicio del artículo completo.
- Ambas pueden ser la misma imagen.
- `imagePosition` controla el punto focal cuando la imagen se recorta (CSS
  `object-position`): "Arriba" para retratos, "Centro" por defecto.

---

## Compatibilidad con Astro

### Esquemas Zod (`src/content/config.ts`)

No se requirió ningún cambio en los esquemas de Astro. La configuración del CMS
fue construida para producir valores idénticos a los que los esquemas esperan:

| Campo CMS | Tipo Astro | Compatibilidad |
|-----------|-----------|----------------|
| `category` (select) | `z.enum(["Poesía", ...])` | Valores exactos con acentos ✓ |
| `author` (relation) | `reference("authors")` | `value_field: "{{slug}}"` produce el slug esperado ✓ |
| `traductor` (relation) | `reference("authors").optional()` | Mismo mecanismo, campo opcional ✓ |
| `issue` (relation) | `z.string()` | Slug del número, comparado con `===` en templates ✓ |
| `featuredPostSlugs` (list/relation) | `z.array(z.string())` | Slugs de posts, buscados con `.find()` ✓ |
| `gender` (boolean) | `z.boolean().optional()` | `true`/`false`, usado en ternario ✓ |
| `imagePosition` (select) | `z.enum(["top","center","bottom"])` | Valores exactos ✓ |

### Templates que consumen los datos

Los templates dereferencia autores con `getEntry()`:
```javascript
const author = await getEntry(post.data.author);
const traductor = post.data.traductor ? await getEntry(post.data.traductor) : null;
```

Los issues se comparan por slug string:
```javascript
const issueSlug = issue.id.replace(/\.md$/, '');
posts.filter(p => p.data.issue === issueSlug);
```

Categorías se comparan con el valor acentuado:
```javascript
post.data.category === "Poesía"
```

Y se normalizan para URLs:
```javascript
category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
// "Poesía" → "poesia"
```

---

## Configuración externa pendiente

Para que Decap CMS funcione en producción sobre Cloudflare Pages, se necesitan
estos pasos **fuera del repositorio**:

### 1. Crear una GitHub OAuth App

1. Ir a GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
2. Configurar:
   - **Application name:** El Gallo Galante CMS
   - **Homepage URL:** `https://tu-dominio.pages.dev`
   - **Authorization callback URL:** `https://tu-oauth-proxy.workers.dev/callback`
3. Anotar el **Client ID** y generar un **Client Secret**.

### 2. Desplegar un proxy OAuth

Decap CMS en Cloudflare Pages no tiene autenticación integrada como en Netlify.
Se necesita un servicio externo que maneje el flujo OAuth con GitHub.

Opciones:

- **[Sveltia CMS Auth](https://github.com/sveltia/sveltia-cms-auth)** —
  Cloudflare Worker listo para desplegar. Recomendado.
- **[netlify-cms-oauth-provider-go](https://github.com/igk1972/netlify-cms-oauth-provider-go)** —
  Alternativa desplegable en cualquier servidor.
- **Worker personalizado** — implementar el flujo OAuth de GitHub en un
  Cloudflare Worker propio.

### 3. Actualizar `config.yml`

Una vez que el proxy OAuth esté funcionando, editar `public/admin/config.yml`:

```yaml
backend:
  name: github
  repo: tu-org/el-gallo-galante          # ← repo real
  branch: main
  base_url: https://tu-oauth-proxy.workers.dev  # ← URL del proxy
  # site_url: https://tu-dominio.pages.dev      # ← opcional
  # display_url: https://tu-dominio.pages.dev   # ← opcional
```

### 4. Valores que faltan por configurar

| Campo | En | Valor actual | Acción requerida |
|-------|----|-------------|-----------------|
| `repo` | config.yml | `OWNER/el-gallo-galante` | Reemplazar OWNER |
| `base_url` | config.yml | Comentado | Descomentar y poner URL del proxy OAuth |
| `site_url` | config.yml | Comentado | Opcional, descomentar con URL de producción |
| `display_url` | config.yml | Comentado | Opcional, descomentar con URL de producción |

---

## Limitaciones conocidas

1. **Sin preview en vivo** — Decap muestra un preview genérico de Markdown, no
   el diseño final de la revista. Se podría configurar en una fase futura.

2. **Sin validación de referencias cruzadas** — el CMS no verifica que un autor
   seleccionado tenga textos, o que los `featuredPostSlugs` existan realmente.
   Astro lanzará un error de build si hay referencias rotas.

3. **Slugs generados por Decap** — el slug del archivo se genera a partir del
   título con `clean_accents: true`. Esto puede diferir ligeramente del slug
   que un humano escribiría manualmente. Los slugs existentes no se ven
   afectados al editar — solo aplica a archivos nuevos.

4. **Media library global** — aunque las carpetas de upload están separadas por
   colección, la media library de Decap muestra todos los archivos del
   `media_folder` de la colección activa, no una vista unificada.

5. **Sin Editorial Workflow** — no se configuró el flujo de borradores/revisión
   de Decap (editorial_workflow). Cada guardado genera un commit directo a
   `main`. Esto se podría agregar en una fase futura si se necesita revisión
   antes de publicar.

---

## Estructura de archivos

```
public/admin/
├── index.html      ← SPA de Decap CMS (carga desde CDN)
└── config.yml      ← Configuración de colecciones, backend, media
```

No se agregaron dependencias npm, plugins de Astro, ni archivos de build
adicionales. Todo es estático.
