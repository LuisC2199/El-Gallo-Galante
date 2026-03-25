# Arquitectura del admin — El Gallo Galante

Documentación técnica del panel de administración personalizado.

---

## Visión general

El admin es una aplicación React de página única montada dentro de Astro vía `client:load`. Se sirve desde `/admin` como una ruta dinámica (SSR, `prerender = false`). Todo el almacenamiento de contenido se realiza a través de la API de GitHub Contents — no hay base de datos.

### Stack tecnológico

| Componente | Tecnología |
|-----------|------------|
| Framework | Astro 5.x con adaptador Cloudflare |
| UI del admin | React 19.x |
| Estilos | Tailwind CSS 4.x (paleta stone) |
| Editor Markdown | Milkdown 7.x (ProseMirror) |
| Almacenamiento | GitHub Contents API |
| Parseo frontmatter | gray-matter |
| Renderizado Markdown | marked |
| Hosting | Cloudflare Workers |

### Diagrama de flujo

```
Navegador                  Cloudflare Worker                GitHub API
    │                            │                              │
    │── GET /admin ──────────────│                              │
    │◄─ HTML + React app ────────│                              │
    │                            │                              │
    │── GET /api/admin/posts ────│── GET /repos/.../contents ──│
    │◄─ JSON summaries ─────────│◄─ file listing ──────────────│
    │                            │                              │
    │── PUT /api/admin/posts/x ──│── PUT /repos/.../contents ──│
    │◄─ { sha } ────────────────│◄─ commit response ──────────│
```

---

## Punto de entrada

**Archivo:** `src/pages/admin/index.astro`

- Ruta: `/admin`
- `prerender = false` — requiere SSR
- Carga `AdminShell` como componente React con `client:load`
- Importa `global.css` para que la vista previa tenga los estilos del sitio
- Meta `robots: noindex, nofollow`

---

## Estructura de archivos

```
src/
  components/admin/     # Componentes React del admin (22 archivos)
  lib/admin/            # Helpers, tipos, GitHub client, serializador
  pages/
    admin/index.astro   # Punto de entrada del admin
    api/admin/          # Rutas API (19 endpoints)
      posts/            # CRUD de publicaciones
      authors/          # CRUD de autores
      issues/           # CRUD de números
      media.ts          # Subida de imágenes
      history.ts        # Historial de commits
      history/          # Versiones y restauración
```

---

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `GITHUB_TOKEN` | Sí | Token de acceso personal de GitHub (scope: `repo`) |
| `GITHUB_OWNER` | Sí | Propietario del repositorio (usuario u organización) |
| `GITHUB_REPO` | Sí | Nombre del repositorio |
| `GITHUB_BRANCH` | No | Rama de trabajo (default: `main`) |

Las variables se acceden vía `(locals as any).runtime?.env ?? import.meta.env` para compatibilidad con Cloudflare Workers y desarrollo local.

En Cloudflare, se configuran como secrets del Worker. En desarrollo local, se ponen en `.dev.vars` o `.env`.

---

## Rutas API

### Publicaciones (`/api/admin/posts/`)

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/admin/posts` | GET | Lista todas las publicaciones (título, fecha, categoría, status, autor, número, SHA) |
| `/api/admin/posts/[slug]` | GET | Devuelve frontmatter + body + SHA de una publicación |
| `/api/admin/posts/[slug]` | PUT | Actualiza publicación (valida campos, serializa YAML, commit a GitHub) |
| `/api/admin/posts/[slug]` | DELETE | Elimina archivo (requiere SHA para concurrencia) |
| `/api/admin/posts/create` | POST | Crea publicación nueva (genera slug único, status inicial: draft) |
| `/api/admin/posts/duplicate` | POST | Duplica publicación (slug con sufijo `-2`, `-3`, etc.) |

### Autores (`/api/admin/authors/`)

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/admin/authors` | GET | Lista todos los autores |
| `/api/admin/authors/[slug]` | GET | Devuelve datos del autor |
| `/api/admin/authors/[slug]` | PUT | Actualiza autor |
| `/api/admin/authors/[slug]` | DELETE | Elimina autor |
| `/api/admin/authors/create` | POST | Crea autor nuevo |
| `/api/admin/authors/duplicate` | POST | Duplica autor |

### Números (`/api/admin/issues/`)

Misma estructura que autores, en `/api/admin/issues/`.

### Media y Historial

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/admin/media` | POST | Sube imagen a GitHub (valida tipo y tamaño) |
| `/api/admin/history` | GET | Lista commits del archivo (query: `collection`, `slug`, `limit`) |
| `/api/admin/history/version` | GET | Contenido del archivo en un commit específico |
| `/api/admin/history/restore` | POST | Restaura archivo a versión histórica |

---

## Modelo de almacenamiento en GitHub

### Contenido

Todo el contenido vive como archivos Markdown con frontmatter YAML en el repositorio:

```
src/content/
  posts/       # Publicaciones (*.md)
  authors/     # Autores (*.md)
  issues/      # Números de la revista (*.md)
```

### Imágenes

Las imágenes se suben al directorio `public/` del repositorio:

| Tipo | Ruta |
|------|------|
| Imágenes de publicaciones | `public/posts/` |
| Fotos de autores | `public/authors/` |
| Portadas de números | `public/covers/` |

Los nombres de archivo se normalizan: minúsculas, sin acentos, espacios reemplazados por guiones.

### Control de concurrencia

Cada operación de escritura usa el SHA del blob de GitHub para optimistic concurrency:

1. Al leer un archivo, la API devuelve su SHA.
2. Al guardar, se envía el SHA recibido.
3. Si otro proceso modificó el archivo, GitHub rechaza la actualización (409 Conflict).
4. El usuario debe recargar para obtener la versión actual.

---

## Serialización de frontmatter

**Archivo:** `src/lib/admin/serialize.ts`

El serializador produce YAML front matter con orden de claves predefinido por colección:

```
Post:    title → date → category → status → issue → author → traductor → excerpt → presentacion → coverImage → featuredImage → imagePosition
Author:  name → birthYear → birthPlace → photo → gender → social
Issue:   title → date → number → coverImage → description → featuredPostSlugs
```

Las claves no reconocidas se agregan alfabéticamente al final. Los valores vacíos (`undefined`, `null`, `""`) se omiten.

---

## Historial y restauración

### Diseño

- Usa la API de commits de GitHub (`/repos/{owner}/{repo}/commits?path=...`).
- Lista hasta 30 commits más recientes que tocaron el archivo.
- Para ver una versión histórica, obtiene el contenido del archivo en ese commit específico.
- Restaurar crea un nuevo commit con el contenido de la versión seleccionada, usando el mensaje `"admin: restore {collection}/{slug} from {sha corto}"`.

### Flujo

```
1. Usuario abre History panel
2. GET /api/admin/history?collection=posts&slug=mi-post
3. Se muestran commits con autor, fecha, mensaje
4. Usuario selecciona un commit
5. GET /api/admin/history/version?collection=posts&slug=mi-post&sha=abc123
6. Se muestra el contenido en esa versión
7. Usuario confirma restauración
8. POST /api/admin/history/restore → actualiza archivo en GitHub
9. Editor se actualiza con el nuevo contenido y SHA
```

---

## Sistema de estado (draft/review/published)

### Modelo

Campo `status` en el frontmatter de publicaciones:

| Valor | Descripción |
|-------|-------------|
| `draft` | Borrador — no visible en el sitio |
| `review` | En revisión — no visible en el sitio |
| `published` | Publicado — visible en el sitio |

### Compatibilidad hacia atrás

- El schema Zod usa `.default("published")` — publicaciones existentes sin campo `status` se tratan como publicadas.
- La API del admin devuelve `"published"` si el campo está ausente.
- Las páginas públicas filtran con `(p.data.status ?? "published") === "published"`.

### Páginas que filtran

- `src/pages/posts/[slug].astro` — `getStaticPaths()`
- `src/pages/index.astro` — carrusel y destacados
- `src/pages/categoria/[category].astro` — listas por categoría
- `src/pages/autor/[slug].astro` — publicaciones por autor
- `src/pages/numeros/[slug].astro` — publicaciones por número

---

## Componentes principales del admin

| Componente | Responsabilidad |
|------------|----------------|
| `AdminShell` | Orquestador principal — estado de colección, slug, modals, refresh |
| `PostEditor` | Editor completo de publicación — formulario + Milkdown + preview + acciones |
| `AuthorEditor` | Editor de autor — formulario + biografía Markdown |
| `IssueEditor` | Editor de número — formulario + posts destacados |
| `PostList` / `AuthorList` / `IssueList` | Paneles de lista con búsqueda, filtros, ordenamiento |
| `MilkdownEditor` | Wrapper del editor Milkdown con barra literaria e inserción de imágenes |
| `LiteraryToolbar` | Botones de formato literario (epígrafe, dedicatoria, firma, etc.) |
| `ImageInsertButton` | Botón para subir e insertar imágenes inline |
| `PostPreviewPanel` | Vista previa de la publicación con estilos del sitio |
| `HistoryPanel` | Panel de historial de commits y restauración |
| `CreateItemModal` | Modal genérico para crear nuevos elementos |
| `ConfirmDialog` | Diálogo de confirmación para acciones destructivas |
| `EditorFields` | Componentes de campo reutilizables (Field, EditorTopBar, etc.) |
| `useUnsavedChanges` | Hook para proteger contra navegación con cambios sin guardar |

---

## Limitaciones conocidas

### Funcionalidad

- **Sin autenticación propia** — el acceso al admin depende de proteger la ruta a nivel de infraestructura (ej. Cloudflare Access).
- **Sin operaciones masivas** — no hay multi-selección ni edición por lotes.
- **Sin publicación programada** — solo cambio manual de status.
- **Sin biblioteca de medios** — las imágenes se suben por campo, no hay explorador de archivos subidos.
- **Sin notificaciones** — los cambios no generan alertas.

### Técnicas

- **Concurrencia optimista** — si dos personas editan el mismo archivo, el segundo guardado fallará con error 409.
- **Límite de historial** — máximo 30 commits por archivo.
- **Tamaño de imágenes** — máximo 5 MB por archivo (limitación de GitHub Contents API para binary uploads).
- **Sin preview de URL real** — la vista previa es una renderización local, no la URL del sitio publicado.
- **GitHub API rate limits** — la API de GitHub tiene límites de tasa (5,000 requests/hora con token).
