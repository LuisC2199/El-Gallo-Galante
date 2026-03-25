# Guía del editor — El Gallo Galante

Manual de uso del panel de administración para editores y colaboradores.

---

## Acceso al admin

1. Navega a `/admin` en el sitio (por ejemplo, `https://elgallogalante.com/admin`).
2. No se requiere inicio de sesión independiente — el acceso depende de las credenciales de GitHub configuradas en el servidor.
3. El admin se carga como una aplicación React de página única. Si ves una pantalla en blanco, verifica tu conexión y que el servidor esté activo.

> **Nota:** la ruta `/admin` está excluida de la indexación de buscadores (`noindex, nofollow`).

---

## Navegación general

El admin se divide en tres zonas:

- **Barra lateral izquierda** — selección de colección: Publicaciones, Autores, Números.
- **Panel de lista** — muestra los elementos de la colección activa con búsqueda, filtros y ordenamiento.
- **Panel principal** — editor del elemento seleccionado, o mensaje de selección vacía.

---

## Publicaciones

### Crear una publicación

1. En la lista de publicaciones, haz clic en **+ New**.
2. Llena los campos requeridos en el modal: Título, Fecha, Categoría, Autor.
3. Haz clic en **Create**.
4. La publicación se creará con estado **Draft** (borrador) automáticamente.
5. Se abrirá el editor para continuar editando el contenido.

### Editar una publicación

1. Selecciona la publicación en la lista.
2. Modifica los campos de frontmatter según sea necesario:
   - **Title** — título de la publicación.
   - **Date** — fecha de publicación.
   - **Category** — Poesía, Narrativa, Crítica, Ensayo o Epistolario.
   - **Status** — estado de publicación (ver sección más adelante).
   - **Issue** — número de la revista al que pertenece.
   - **Author** — autor principal (relación con la colección de autores).
   - **Traductor** — traductor, si aplica (opcional).
   - **Excerpt** — extracto breve para previews.
   - **Cover Image / Featured Image** — imágenes asociadas.
   - **Image Position** — posición de la imagen principal (top, center, bottom).
3. Edita el cuerpo Markdown usando el editor Milkdown.
4. Haz clic en **Save** en la barra superior.

### Estado de publicación (Status)

Cada publicación tiene uno de tres estados:

| Estado | Significado | Visible en sitio público |
|--------|-------------|--------------------------|
| **Draft** (borrador) | En proceso de escritura | No |
| **Review** (revisión) | Listo para revisión editorial | No |
| **Published** (publicado) | Aprobado y visible | Sí |

- Las publicaciones nuevas se crean como **Draft**.
- El badge de color junto al selector muestra el estado actual: ámbar (Draft), azul (Review), verde (Published).
- Solo las publicaciones con estado **Published** aparecen en el sitio público.
- Las publicaciones sin campo de status (contenido anterior) se tratan como **Published** por compatibilidad.

### Buscar y filtrar publicaciones

- **Búsqueda** — filtra por título o slug.
- **Ordenamiento** — Más recientes, Más antiguas, A→Z, Z→A.
- **Filtros** — por Categoría, Status, Autor, Número.
- El contador muestra `filtrados/total`.
- Haz clic en "Clear filters" para reiniciar todos los filtros.

---

## Editor Milkdown

El editor de cuerpo usa [Milkdown](https://milkdown.dev), un editor rico de Markdown.

### Uso básico

- Escribe Markdown normal: `# Título`, `**negrita**`, `*itálica**`, listas, etc.
- El editor renderiza el Markdown visualmente mientras escribes.
- Los atajos de teclado estándar funcionan: `Ctrl+B` (negrita), `Ctrl+I` (itálica), `Ctrl+Z` (deshacer).

### Barra de herramientas literarias

Encima del editor hay botones de formato especial para la revista:

| Botón | Uso | HTML generado |
|-------|-----|---------------|
| Epígrafe | Cita introductoria de un texto | `<blockquote class="epigrafe">` |
| Dedicatoria | Dedicatoria del autor | `<p class="dedicatoria">` |
| Nota al pie | Nota editorial o aclaratoria | `<span class="footnote">` |
| Separador | División entre secciones | `<hr class="section-break">` |
| Firma | Firma del autor al final | `<p class="poem-signature">` |
| Cita en bloque | Cita larga dentro del texto | `<blockquote>` |
| Texto centrado | Párrafo centrado | `<p class="text-center">` |
| Texto derecha | Alineación a la derecha | `<p class="text-right">` |
| Justificado | Texto justificado | `<p class="text-justify">` |
| Letra capitular | Letra inicial grande decorativa | `<span class="dropcap">` |
| Meta epistolar | Contexto de cartas (lugar, fecha) | `<p class="meta-epistolar">` |

Para usar: haz clic en el botón correspondiente. Se insertará un bloque HTML en la posición del cursor. Reemplaza el texto de ejemplo con tu contenido.

### Insertar imágenes en el cuerpo

1. Haz clic en el botón **Image** (ícono de imagen) en la barra de herramientas.
2. En el diálogo, selecciona o arrastra una imagen.
3. Opcionalmente agrega un pie de foto (caption) y alineación (izquierda, centro, derecha).
4. La imagen se sube automáticamente a GitHub y se inserta como HTML `<figure>`.

---

## Vista previa (Preview)

1. En la barra superior del editor, cambia de **Edit** a **Preview**.
2. La vista previa renderiza la publicación con los estilos del sitio real.
3. Incluye la presentación completa: epígrafes, dedicatorias, letra capitular, etc.
4. La vista previa funciona para publicaciones en cualquier estado (Draft, Review, Published).
5. Los cambios no guardados se muestran en la vista previa en tiempo real.

---

## Historial y restauración

1. Haz clic en **History** en la barra superior del editor.
2. Se muestra el historial de commits de Git para el archivo actual (hasta 30 entradas).
3. Cada entrada muestra: autor del commit, fecha, y mensaje.
4. Haz clic en un commit para ver el contenido en esa versión.
5. Si deseas restaurar, haz clic en **Restore** — esto reemplazará el contenido actual con la versión histórica y creará un nuevo commit.

> **Importante:** restaurar crea un nuevo commit; no se pierden versiones intermedias.

---

## Autores

### Crear un autor

1. Cambia a la colección **Authors** en la barra lateral.
2. Haz clic en **+ New**.
3. Llena: Nombre, Año de nacimiento, Lugar de nacimiento.
4. Haz clic en **Create**.

### Editar un autor

Campos disponibles:

- **Name** — nombre completo del autor.
- **Birth Year** — año de nacimiento (texto, ej. "1990").
- **Birth Place** — lugar de nacimiento.
- **Photo** — foto del autor (se sube a `/authors/`).
- **Gender** — para determinar "Sobre el autor" vs. "Sobre la autora".
- **Social** — enlaces a redes sociales (website, Instagram, X, Facebook, TikTok).
- **Biografía** — cuerpo Markdown con la biografía del autor.

### Buscar autores

- Búsqueda por nombre o slug.
- Ordenamiento A→Z / Z→A.

---

## Números (Issues)

### Crear un número

1. Cambia a la colección **Issues**.
2. Haz clic en **+ New**.
3. Llena: Título, Fecha, Número (ej. "No. 01").
4. Haz clic en **Create**.

### Editar un número

Campos disponibles:

- **Title** — título del número.
- **Date** — fecha de publicación.
- **Number** — identificador (ej. "No. 01").
- **Cover Image** — portada del número (se sube a `/covers/`).
- **Description** — descripción breve.
- **Featured Posts** — publicaciones destacadas para el carrusel de portada.
- **Cuerpo** — nota editorial (Markdown).

### Buscar números

- Búsqueda por título, número o slug.
- Ordenamiento: Más recientes, Más antiguas, A→Z, Z→A.

---

## Acciones sobre elementos

Disponibles en la barra superior de cada editor:

| Acción | Descripción |
|--------|-------------|
| **Save** | Guarda los cambios actuales en GitHub. |
| **Duplicate** | Crea una copia del elemento con slug `-2`, `-3`, etc. |
| **Delete** | Elimina el archivo de GitHub (requiere confirmación). |
| **History** | Abre el historial de versiones. |

---

## Convenciones de formato para la revista

### Poesía
- Usa saltos de línea para separar versos.
- Para estrofas, deja una línea en blanco entre ellas.
- Usa **Firma** al final si el poema requiere atribución especial.
- La letra capitular se aplica automáticamente (modo `auto` por defecto).

### Narrativa y ensayo
- Escribe en párrafos separados por líneas en blanco.
- Usa **Epígrafe** para citas iniciales.
- Usa **Dedicatoria** si el texto tiene una dedicatoria.

### Epistolario (cartas)
- Usa **Meta epistolar** para la fecha/lugar de la carta.
- Usa **Firma** para la despedida del autor.

### Imágenes
- Las imágenes de portada van en el campo **Cover Image**.
- Las imágenes dentro del cuerpo se insertan con el botón de imagen de la barra.
- Formatos aceptados: JPG, PNG, WebP.
- Tamaño máximo: 5 MB.
- Los nombres de archivo se normalizan automáticamente (minúsculas, sin acentos, guiones).

### Buenas prácticas
- Siempre llena el campo **Excerpt** — se usa en las previsualizaciones del sitio.
- Asigna la **Categoría** correcta desde el inicio.
- Vincula cada publicación a un **Número** de la revista.
- Cambia el estado a **Published** solo cuando el texto esté listo para el público.
- Usa **Review** para textos que necesitan revisión editorial antes de publicar.
