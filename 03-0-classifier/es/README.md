![MapBiomas Venezuela](../../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Volver al README](https://img.shields.io/badge/%E2%86%90%20Volver%20al%20README-gray?style=for-the-badge)](../../#readme)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[Ver script (`03-0-classifier.js`)](../03-0-classifier.js) · [English version](../#readme)

# Manual de usuario: Clasificación supervisada anual con Random Forest

**Script:** [`03-0-classifier.js`](../03-0-classifier.js) · **Serie:** 1985–2025 (41 años) · **Colección:** 4 · **Versión:** 1.0

> **Propósito:** Orientar la configuración, ejecución, control de calidad y exportación del script que clasifica anualmente cada región de MapBiomas Venezuela mediante Random Forest, utilizando mosaicos Landsat y las muestras de entrenamiento generadas en la etapa anterior.

| Campo | Información |
| :--- | :--- |
| **Versión del manual** | 1.0 |
| **Fecha** | 17 de agosto de 2026 |
| **Cobertura temporal** | 1985–2025 (41 años) |
| **Resolución de salida** | 30 m (`Int8`) |
| **Clasificador** | Random Forest (SMILE), `numberOfTrees = 100`, `variablesPerSplit = 1` |
| **Ámbito** | Regiones de clasificación de MapBiomas Venezuela |

---

## Control del documento

| Elemento | Descripción |
| :--- | :--- |
| **Título** | Manual de Usuario – Clasificación supervisada anual con Random Forest |
| **Script base** | [`03-0-classifier.js`](../03-0-classifier.js) |
| **Colección** | MapBiomas Venezuela – Colección 4 |
| **Región configurada en el script** | `region_id = 90222` |
| **Versión de muestras** | `samples_version = 1` |
| **Versión de salida** | `output_version = 1` |
| **Alcance** | Carga de mosaicos y muestras, remapeos, muestras complementarias, clasificación anual, controles de validez, visualización y exportación del producto multibanda. |

> [!NOTE]
> Este manual documenta el comportamiento observable de [`03-0-classifier.js`](../03-0-classifier.js). Las funciones `getRegion()`, `getMapBiomasMosaics()`, `identifyClasses()`, `remapWithPolygons()` y `addPointsToMap()` provienen del módulo externo `users/ejvalero/api:src/utils`; su implementación interna no está incluida en el archivo y no se reconstruye aquí.

---

## Contenido

- [1. Introducción y justificación](#1-introducción-y-justificación)
- [2. Objetivo, alcance y usuarios](#2-objetivo-alcance-y-usuarios)
- [3. Requisitos y datos de entrada](#3-requisitos-y-datos-de-entrada)
- [4. Conceptos fundamentales](#4-conceptos-fundamentales)
- [5. Arquitectura del script](#5-arquitectura-del-script)
- [6. Parámetros configurables](#6-parámetros-configurables)
- [7. Metodología de clasificación anual](#7-metodología-de-clasificación-anual)
- [8. Productos de salida](#8-productos-de-salida)
- [9. Visualización e inspección](#9-visualización-e-inspección)
- [10. Procedimiento de ejecución](#10-procedimiento-de-ejecución)
- [11. Interpretación y uso del producto](#11-interpretación-y-uso-del-producto)
- [12. Exportación y nomenclatura](#12-exportación-y-nomenclatura)
- [13. Control de calidad recomendado](#13-control-de-calidad-recomendado)
- [14. Problemas frecuentes y soluciones](#14-problemas-frecuentes-y-soluciones)
- [15. Buenas prácticas](#15-buenas-prácticas)
- [16. Referencias y recursos](#16-referencias-y-recursos)
- [Anexo A. Guía rápida de ejecución](#anexo-a-guía-rápida-de-ejecución)
- [Anexo B. Diccionario de variables y controles](#anexo-b-diccionario-de-variables-y-controles)
- [Anexo C. Remapeos y reglas especiales](#anexo-c-remapeos-y-reglas-especiales)

### Convenciones de lectura

- Los nombres de variables, funciones, propiedades y assets se conservan tal como aparecen en el script.
- **Muestras** se refiere a los Table Assets anuales generados por [`02-2-training-samples.js`](../../02-2-training-samples/02-2-training-samples.js).
- **Mosaico** se refiere al mosaico anual con las 34 variables de `feature_space`.
- El valor `27` es utilizado por el script como clase de ausencia de clasificación / NoData dentro de la región.

---

## 1. Introducción y justificación

Una vez generadas las muestras de entrenamiento, la clasificación supervisada relaciona las clases de referencia con las variables espectrales e índices de los mosaicos Landsat para asignar una clase a cada píxel de la región.

El script [`03-0-classifier.js`](../03-0-classifier.js) automatiza este proceso para los 41 años comprendidos entre 1985 y 2025. Para cada año carga el mosaico, localiza el asset de muestras, ajusta las clases mediante remapeos, permite excluir o reemplazar muestras en áreas específicas, entrena un clasificador Random Forest y acumula cada banda anual en una única imagen multibanda (`classification_1985` a `classification_2025`).

### 1.1 ¿Qué problema resuelve?

- Aplicar de manera homogénea un clasificador supervisado a toda la serie 1985–2025.
- Consumir automáticamente las muestras anuales identificadas por región, año y versión.
- Validar que existan variables de mosaico, muestras y más de una clase antes de entrenar.
- Permitir ajustes específicos de clases en muestras y en el resultado clasificado mediante remapeos.
- Permitir reemplazar muestras dentro de polígonos problemáticos por puntos complementarios tomados del mosaico.
- Producir una imagen multibanda consistente lista para las etapas de filtrado temporal y espacial.

---

## 2. Objetivo, alcance y usuarios

### Objetivo general

Proporcionar una guía técnica y operativa para configurar, ejecutar, revisar y exportar `03-0-classifier.js`, comprendiendo la relación entre mosaicos, muestras, remapeos, entrenamiento Random Forest y producto clasificado multitemporal.

### Objetivos específicos

- Documentar las rutas, módulos y parámetros necesarios.
- Explicar la carga y validación de los assets de muestras anuales.
- Describir la recodificación de clases de las muestras y los remapeos espaciales del resultado.
- Explicar el mecanismo de muestras complementarias (`apply_resampling`) y su efecto sobre las muestras originales.
- Describir las condiciones que determinan si un año puede entrenarse o recibe valor `27`.
- Documentar la configuración del Random Forest y la construcción de la serie multibanda.
- Establecer controles de QA antes de aceptar la exportación final.

### Usuarios previstos

Personal técnico de MapBiomas Venezuela que participe en la clasificación anual por regiones, con conocimientos básicos o intermedios de Google Earth Engine, imágenes Landsat, clasificación supervisada y manejo de assets.

---

## 3. Requisitos y datos de entrada

### 3.1 Requisitos operativos

- Acceso al Google Earth Engine Code Editor y al proyecto definido por `user`.
- Permiso de lectura sobre los assets de mosaicos de Venezuela y Guyana.
- Permiso de lectura sobre la colección de muestras `SAMPLES`.
- Permiso de escritura sobre la colección de salida `classification`.
- Acceso al asset de regiones de clasificación y a los módulos `users/ejvalero/api:src/utils` y `users/mapbiomas/modules:Palettes.js`.
- Definición previa de cualquier geometría o regla incluida en `remap.polygons` (en el archivo actual se define `remap_to_21` en el encabezado de geometrías).
- Si se activan muestras complementarias, cada polígono debe disponer de la propiedad `id` requerida por `apply_resampling()`.

> [!CAUTION]
> **Control crítico:** `remap_to_21` (y cualquier otra colección incluida en `remap.polygons`) debe estar definida antes de construir `remap.polygons`, o el script fallará antes de iniciar el procesamiento.

### 3.2 Región de clasificación

La región se obtiene mediante `functions.getRegion()` desde:

```text
projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion
```

Se utiliza `gridcode` (`regions_field`) y `region_id = 90222` en la configuración base. El flujo emplea `region.vector` para geometrías y `region.rasterMask` para limitar mosaicos y resultados.

### 3.3 Mosaicos

Los mosaicos de Venezuela y Guyana se cargan mediante `functions.getMapBiomasMosaics()` solicitando las 34 variables definidas en `feature_space`. Ambas colecciones se fusionan y se filtran por `season = "full"`. Para regiones incluidas en `andean_region_ids` (`92001`–`92009`), los mosaicos venezolanos reciben además `andean_filter` (conservando escenas `ANDES` y escenas no andinas que intersectan la región).

### 3.4 Muestras de entrenamiento

Las muestras se leen desde:

```text
projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/SAMPLES/<region_id>-<year>-<samples_version>
```

Al inicio, el script enumera los assets de `samples_path` con `ee.data.listAssets(samples_path).assets` para verificar cada año antes de cargarlo.

> [!NOTE]
> **Escalabilidad de `listAssets()`:** `ee.data.listAssets()` devuelve un arreglo de assets y puede paginar mediante `nextPageToken`. El script usa directamente la primera respuesta; si la colección `SAMPLES` crece mucho, verifique que todos los assets esperados aparezcan en `processed_samples`.

---

## 4. Conceptos fundamentales

### 4.1 Clasificación supervisada y Random Forest

El script entrena un clasificador `ee.Classifier.smileRandomForest` usando `samples` con propiedad `"reference"` como etiqueta y `bands` como variables predictoras (`numberOfTrees = 100`, `variablesPerSplit = 1`).

```javascript
var classifier = ee.Classifier.smileRandomForest({
  numberOfTrees: trees,
  variablesPerSplit: 1,
});
```

> [!NOTE]
> `trees = 100` y `variablesPerSplit = 1` son decisiones metodológicas explícitas de esta versión. Cualquier ajuste debe documentarse y compararse contra resultados de referencia.

### 4.2 Espacio de atributos

`feature_space` contiene 34 variables (6 bandas espectrales medianas, fracciones SMA, índices espectrales y componentes Tasseled Cap). El script verifica mediante `contained` que el mosaico anual incluya todas esas bandas antes de autorizar el entrenamiento.

### 4.3 NoData = 27

Cuando no se cumplen las condiciones de entrenamiento para un año, `apply_classification()` añade una banda constante con valor `27`. Posteriormente toda la serie aplica `.unmask(27).updateMask(raster_mask).toByte()` y antes de exportar se convierte a `Int8`.

### 4.4 Remapeo de clases

El script puede recodificar dos componentes distintos:
1. La propiedad `reference` de las muestras antes del entrenamiento (`FeatureCollection.remap()`).
2. La clasificación resultante dentro de polígonos específicos (`functions.remapWithPolygons()`).

---

## 5. Arquitectura del script

| Paso | Bloque | Función |
| :--- | :--- | :--- |
| 1 | Configuración | Usuario, región, años, versiones, remapeos, muestras adicionales y Random Forest. |
| 2 | Rutas y módulos | Mosaicos, muestras, salida, regiones, paleta (`classification9`) y utilidades. |
| 3 | Región y filtros | Carga región y prepara `andean_filter` para regiones andinas. |
| 4 | Mosaicos | Carga 34 variables, fusiona Venezuela/Guyana y conserva `season = "full"`. |
| 5 | Inventario de muestras | Enumera assets de `SAMPLES` y extrae `processed_samples`. |
| 6 | Bucle anual | Recorre `1985–2025`. |
| 7 | Mosaico anual | Filtra el año, construye el mosaico y obtiene sus bandas (`bands`, `contained`). |
| 8 | Muestras anuales | Verifica asset, remapea clases, filtra nulos y excluye `remove_samples`. |
| 9 | Muestras complementarias | Si `additional_samples.polygons.length > 0`, reemplaza muestras dentro de esos polígonos. |
| 10 | Entrenamiento y clasificación | Valida bandas/muestras/clases, entrena Random Forest y clasifica (`apply_classification`). |
| 11 | Remapeo y preview | Aplica `remap.polygons` al resultado y visualiza años de `preview`. |
| 12 | Salida | Elimina banda inicial (`slice(1)`), convierte a `Int8`, adjunta metadatos y exporta a Asset. |

---

## 6. Parámetros configurables

Revise estos parámetros antes de ejecutar cada región:

| Parámetro | Valor actual | Qué controla |
| :--- | :--- | :--- |
| `user` | `"emanuel-valero"` | Proyecto/usuario para `samples_path` y `output_path`. |
| `region_id` | `90222` | Región de clasificación procesada. |
| `country` | `"VENEZUELA"` | Metadato `pais` en la salida. |
| `collection_id` | `"classification"` | Carpeta/colección de salida bajo `GENERAL/`. |
| `years` | `[1985, ..., 2025]` | Años de clasificación. |
| `preview` | `[1990, 1995, 2018, 2020]` | Años mostrados en el mapa para QA. |
| `remap.samples` | listas `from`/`to` | Recodificación de `reference` en las muestras (`5 → 6`). |
| `remap.polygons` | `[remap_to_21]` | Correcciones espaciales aplicadas a la clasificación anual. |
| `remove_samples` | `[]` | Lista de clases de muestras a excluir del entrenamiento. |
| `additional_samples.polygons` | `[]` | Polígonos donde reemplazar muestras originales con nuevos puntos. |
| `additional_samples.classes` | `[3, 25]` | Clases asignadas a los puntos complementarios (inactivo si `polygons` está vacío). |
| `additional_samples.points` | `[3000, 3000]` | Puntos a muestrear por polígono (inactivo si `polygons` está vacío). |
| `feature_space` | 34 variables | Bandas requeridas en mosaico y muestras. |
| `samples_version` | `1` | Versión de los assets de muestras de entrada. |
| `output_version` | `1` | Versión del asset clasificado de salida. |
| `tile_scale` | `8` | Parámetro `tileScale` de `Image.sample()` en `resample_cover()`. |
| `trees` | `100` | Número de árboles del Random Forest (`variablesPerSplit` fijado en `1`). |

> [!NOTE]
> **Variables auxiliares sin efecto en la ejecución actual:** `drive_folder`, `map_type`, `table_name` y la función auxiliar `get_mosaics()` están definidos en [`03-0-classifier.js`](../03-0-classifier.js), pero esta versión no ejecuta exportaciones a Google Drive, no llama `Map.setOptions(map_type)` ni exporta tablas de importancia (`classifier.explain()` / `Export.table`).

---

## 7. Metodología de clasificación anual

### 7.1 Selección y construcción del mosaico anual

Para cada año, el script filtra `mosaics` por `year`, construye el mosaico con `mosaic()` y consulta `bandNames()` y `contained`:

```javascript
var bands = year_mosaic.bandNames();
var contained = bands.containsAll(ee.List(feature_space));
```

> [!WARNING]
> **Validación de años sin mosaico:** El script construye `year_mosaic` con `ee.Algorithms.If(year_collection.size().gt(0), ..., null)` y luego compara `if (year_mosaic === null)` en el lado cliente. Como `ee.Image(...)` siempre devuelve un objeto proxy server-side no nulo, esa comparación cliente no atrapa colecciones vacías. Verifique que existan mosaicos para todos los años objetivo antes de una corrida de producción.

### 7.2 Localización y remapeo de muestras

El nombre esperado del asset es `<region_id>-<year>-<samples_version>`. Si no figura en `processed_samples`, el año se omite e imprime un aviso en consola. Si existe, `FeatureCollection.remap(remap.samples.from, remap.samples.to, "reference")` recodifica `reference` (en la configuración actual, `5 → 6`) y `ee.Filter.notNull(bands)` descarta muestras con valores nulos en cualquier banda del mosaico.

### 7.3 Eliminación opcional de clases (`remove_samples`)

`remove_samples` filtra las muestras cuya propiedad `reference` pertenezca a la lista configurada. Aunque un arreglo vacío `[]` en JavaScript es *truthy*, `.filter(ee.Filter.inList("reference", []).not())` conserva todas las muestras.

### 7.4 Muestras complementarias y reemplazo espacial

Cuando `additional_samples.polygons.length > 0`, `apply_resampling()` excluye las muestras originales ubicadas dentro de esos polígonos, muestrea nuevos puntos desde `year_mosaic` mediante `resample_cover()` (usando `seed: 1`, `scale: 30`, `EPSG:4326`) y fusiona ambos conjuntos:

```javascript
samples = samples.filterBounds(outside_vector).merge(new_samples);
```

> [!IMPORTANT]
> - Este mecanismo **reemplaza** las muestras originales dentro de `additional_samples.polygons`, no simplemente suma puntos.
> - Cada polígono debe tener la propiedad `id` requerida por `reduceToImage(["id"], ee.Reducer.first())`.

### 7.5 Reglas de validación previas al entrenamiento

`apply_classification()` combina tres validaciones numéricas multiplicándolas (`should_train = check_bands * check_samples * check_classes`):

| Control | Condición | Si falla |
| :--- | :--- | :--- |
| Bandas | `condition_class_id` (`contained`) | No entrena; banda anual = `27` |
| Muestras | `samples.size().gt(0)` | No entrena; banda anual = `27` |
| Clases | `ee.Number(n_class_sample).gt(1)` | No entrena; banda anual = `27` |

```javascript
var should_train = ee
  .Number(check_bands)
  .multiply(check_samples)
  .multiply(check_classes);
```

### 7.6 Entrenamiento, clasificación y acumulación

Cuando `should_train` es `1`, se entrena `classifier.train(samples, "reference", bands)` y se clasifica `mosaic.classify(...)`, renombrando la banda a `classification_<year>`. Si `should_train` es `0`, se añade una banda constante `27`. Al finalizar el bucle, `classified.slice(1)` descarta la banda semilla inicial `0`.

### 7.7 Remapeos espaciales posteriores

Si `remap.polygons` tiene elementos, `apply_remaps()` aplica `functions.remapWithPolygons()` sobre la banda anual recién añadida (en la configuración actual, `remap_to_21`).

---

## 8. Productos de salida

El producto persistente es una **única imagen multibanda** por región y versión (41 bandas en condiciones ideales):

| Elemento | Nombre / patrón | Contenido |
| :--- | :--- | :--- |
| Clasificación multitemporal | `<region_id>-<output_version>` | Imagen multibanda `classification_1985` … `classification_2025` (`Int8`). |
| Ejemplo | `90222-1` | Clasificación de la región `90222`, versión `1`. |
| Bandas sin entrenamiento | `classification_<year> = 27` | Años que no superaron alguna regla de validación. |
| Metadatos adjuntos | `code_region`, `pais`, `version`, `RFtrees`, `samples_version`, `descripcion` | Trazabilidad básica incorporada al asset. |

---

## 9. Visualización e inspección

Solo los años incluidos en `preview` (`[1990, 1995, 2018, 2020]`) se añaden al mapa:

| Capa | Qué muestra | Uso de QA |
| :--- | :--- | :--- |
| `MOSAICO <año>` | Composición `SWIR1–NIR–Red` del mosaico anual. | Revisar nubes residuales, vacíos y continuidad espacial. |
| `CLASIFICACIÓN <año>` | Banda `classification_<año>` con paleta `classification9`. | Evaluar patrones, bordes, clases improbables y remapeos. |
| `SAMPLES <año>` | Puntos de entrenamiento remapeados/remuestreados. | Comprobar distribución espacial y correspondencia espectral. |

### Orden recomendado de inspección

1. Active `MOSAICO <año>` y verifique la calidad de la imagen base.
2. Active `SAMPLES <año>` y confirme que cubren las principales clases y coberturas.
3. Active `CLASIFICACIÓN <año>` para detectar errores evidentes o ruido de "sal y pimienta".
4. Compare años consecutivos o de interés e inspeccione específicamente las zonas cubiertas por `remap_to_21`.

---

## 10. Procedimiento de ejecución

1. Abra [`03-0-classifier.js`](../03-0-classifier.js) en el Code Editor y confirme que `user` apunta al proyecto correcto.
2. Configure `region_id` y verifique que la región exista en `gridcode`.
3. Confirme `samples_version` y que la colección `SAMPLES` contiene `<region_id>-<year>-<samples_version>` para todos los años requeridos.
4. Revise `remap.samples` y las geometrías de `remap.polygons` (`remap_to_21`).
5. Revise `remove_samples` (mantenga `[]` si no excluye clases).
6. Si activa muestras complementarias, defina polígonos con propiedad `id` y alinee `polygons`, `classes` y `points`.
7. Verifique que los 34 nombres de `feature_space` estén presentes en los mosaicos y en las muestras.
8. Revise `trees = 100`, `tile_scale = 8` y `output_version`.
9. Ejecute con **Run** y revise en **Console** posibles mensajes de muestras faltantes o errores.
10. Inspeccione las capas de `preview`.
11. Revise el objeto `RESULTADO` en consola (41 bandas, metadatos y ausencia de bandas llenas con `27`).
12. Inicie la tarea en **Tasks** solo tras validar los controles anteriores.
13. Abra el asset exportado para confirmar que la serie multibanda está íntegra.

---

## 11. Interpretación y uso del producto

- **Bandas anuales:** Cada banda `classification_<year>` representa la clase asignada por el Random Forest tras aplicar los remapeos espaciales configurados.
- **Valor `27`:** Indica ausencia de clasificación o NoData; no debe interpretarse como clase temática y debe revisarse antes de la etapa de gap-fill (`03-2-gapfill.js`).
- **Etapa posterior:** La imagen multibanda exportada sirve de entrada directa para el relleno de vacíos ([`03-2-gapfill.js`](../../03-2-gapfill/03-2-gapfill.js)) y el filtrado espacio-temporal.

---

## 12. Exportación y nomenclatura

| Elemento | Valor / patrón |
| :--- | :--- |
| **Función** | `Export.image.toAsset()` |
| **Ruta** | `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification` |
| **Asset** | `<region_id>-<output_version>` (p. ej., `90222-1`) |
| **Escala** | `30` m |
| **Pyramiding policy** | `{ ".default": "mode" }` |
| **maxPixels** | `1e13` |
| **Región de exportación** | `region.vector.geometry().bounds()` |
| **Tipo de dato** | `Int8` |

---

## 13. Control de calidad recomendado

- **Insumos:** Verificar `region_id`, cobertura anual de mosaicos, presencia de todos los assets en `SAMPLES` y coincidencia de las 34 variables de `feature_space`.
- **Entrenamiento:** Confirmar más de una clase por año, revisar distribución espacial de puntos y validar antes/después si se usa `additional_samples`.
- **Producto clasificado:** Confirmar orden de bandas `classification_1985`–`classification_2025`, vigilar proporción de píxeles `27` y revisar efectos de `remap.polygons`.

---

## 14. Problemas frecuentes y soluciones

| Síntoma | Causa probable / acción recomendada |
| :--- | :--- |
| `remap_to_21 is not defined` | La geometría/regla no fue definida o importada; defínala o retírela de `remap.polygons`. |
| `"No hay muestras disponibles para <año>"` | No existe el asset esperado o `listAssets()` no lo enumeró; revise ruta, `samples_version` y permisos. |
| Error en año sin mosaico en lugar del mensaje | La comparación `year_mosaic === null` no evalúa objetos server-side; verifique disponibilidad previa de mosaicos. |
| Banda anual completa con `27` | Falló una validación (`contained`, `samples.size() > 0` o `n_class_sample > 1`). |
| Muestras desaparecen tras `filter(notNull)` | Faltan propiedades de banda en el asset de muestras respecto al mosaico del mismo año. |
| Clase `5` desaparece del entrenamiento | `remap.samples` recodifica `5 → 6` en la configuración base. |
| `additional_samples` no surte efecto | `additional_samples.polygons` está vacío. |
| Error en `apply_resampling` (`reduceToImage`) | Los polígonos en `additional_samples.polygons` carecen de propiedad `id`. |
| Faltan muestras en `processed_samples` | `ee.data.listAssets()` puede paginar; revise si la carpeta `SAMPLES` supera el límite de página. |

---

## 15. Buenas prácticas

- Validar una región completa antes de procesar lotes de regiones.
- Mantener sincronizados `samples_version` y `output_version` en una bitácora metodológica.
- Ampliar `preview` temporalmente al inspeccionar una región o versión nueva.
- Mantener alineadas en longitud y orden las listas `polygons`, `classes` y `points` en `additional_samples`.
- Revisar la proporción de píxeles `27` por banda antes de pasar a la etapa de post-clasificación.

---

## 16. Referencias y recursos

- **Script fuente:** [`03-0-classifier.js`](../03-0-classifier.js)
- [Google Earth Engine – Code Editor](https://code.earthengine.google.com/)
- [Google Earth Engine – Supervised Classification](https://developers.google.com/earth-engine/guides/classification)
- [`ee.Classifier.smileRandomForest`](https://developers.google.com/earth-engine/apidocs/ee-classifier-smilerandomforest)
- [`ee.Classifier.train`](https://developers.google.com/earth-engine/apidocs/ee-classifier-train)
- [`ee.Image.classify`](https://developers.google.com/earth-engine/apidocs/ee-image-classify)
- [`ee.Image.sample`](https://developers.google.com/earth-engine/apidocs/ee-image-sample)
- [`ee.Image.reduceToVectors`](https://developers.google.com/earth-engine/apidocs/ee-image-reducetovectors)
- [`ee.Filter.notNull`](https://developers.google.com/earth-engine/apidocs/ee-filter-notnull)
- [`ee.data.listAssets`](https://developers.google.com/earth-engine/apidocs/ee-data-listassets)
- [`Export.image.toAsset`](https://developers.google.com/earth-engine/apidocs/export-image-toasset)
- [MapBiomas Venezuela](https://venezuela.mapbiomas.org/)
- Cardille, Crowley, Saah & Clinton (eds.), 2024. *Cloud-Based Remote Sensing with Google Earth Engine*. [DOI: 10.1007/978-3-031-26588-4](https://doi.org/10.1007/978-3-031-26588-4)

---

## Anexo A. Guía rápida de ejecución

| Paso | Acción | Verificación |
| :--- | :--- | :--- |
| 1 | Seleccione región | `region_id` y `gridcode` correctos. |
| 2 | Revise muestras | `samples_version` y assets anuales disponibles en `SAMPLES`. |
| 3 | Revise mosaicos | 34 bandas de `feature_space` y años `1985–2025`. |
| 4 | Revise remapeo de muestras | Regla `5 → 6` y resto de IDs en `remap.samples`. |
| 5 | Revise exclusiones | `remove_samples` vacío o lista deliberada. |
| 6 | Revise resampling | Polígonos con `id` y listas `polygons`/`classes`/`points` alineadas. |
| 7 | Revise remap espacial | `remap_to_21` definido y correcto. |
| 8 | Revise Random Forest | `trees = 100`; `variablesPerSplit = 1`. |
| 9 | Ejecute | Revise en Console avisos de muestras faltantes o errores. |
| 10 | Inspeccione `preview` | `MOSAICO` + `SAMPLES` + `CLASIFICACIÓN`. |
| 11 | Revise bandas `27` | Ningún año esperado debe quedar sin entrenar inadvertidamente. |
| 12 | Revise `RESULTADO` | 41 bandas, metadatos y tipo `Int8`. |
| 13 | Lance Task | `Export.image.toAsset` a `classification/<region_id>-<output_version>`. |
| 14 | Verifique asset | Abra la salida y compruebe la serie completa. |

---

## Anexo B. Diccionario de variables y controles

### B.1 Espacio de atributos (34 variables)

| # | Variable | # | Variable |
| :--- | :--- | :--- | :--- |
| 1 | `blue_median` | 2 | `green_median` |
| 3 | `red_median` | 4 | `nir_median` |
| 5 | `swir1_median` | 6 | `swir2_median` |
| 7 | `gv_median` | 8 | `npv_median` |
| 9 | `soil_median` | 10 | `cloud_median` |
| 11 | `shade_median` | 12 | `ndfi_median` |
| 13 | `ndvi_median` | 14 | `evi_median` |
| 15 | `savi_median` | 16 | `gndvi_median` |
| 17 | `ndmi_median` | 18 | `nbr_median` |
| 19 | `ndwi_median` | 20 | `mndwi_median` |
| 21 | `awei_median` | 22 | `wri_median` |
| 23 | `cmri_median` | 24 | `mvi_median` |
| 25 | `ndbi_median` | 26 | `ui_median` |
| 27 | `bsi_median` | 28 | `ndsi_median` |
| 29 | `iron_oxide_median` | 30 | `ndti_median` |
| 31 | `msavi2_median` | 32 | `tc_brightness_median` |
| 33 | `tc_greenness_median` | 34 | `tc_wetness_median` |

> [!NOTE]
> Este `feature_space` contiene 34 variables y excluye `tir_median` (que sí se extrae en [`02-2-training-samples.js`](../../02-2-training-samples/02-2-training-samples.js)). Al entrenar, Earth Engine utiliza únicamente las 34 bandas presentes en `bands`.

### B.2 Variables de control

| Variable / objeto | Significado |
| :--- | :--- |
| `region` | Región seleccionada mediante `getRegion()`. |
| `mosaics` | Colección fusionada Venezuela + Guyana, `season = "full"`. |
| `samples_list` | Resultado de `ee.data.listAssets(samples_path).assets`. |
| `processed_samples` | Lista cliente de IDs de muestras disponibles. |
| `classified` | Imagen acumulativa de clasificaciones anuales. |
| `year_collection` | Mosaicos filtrados para un año. |
| `year_mosaic` | Mosaico anual enmascarado a la región. |
| `bands` | Bandas presentes en el mosaico anual. |
| `contained` | Booleano server-side: `bands` contiene todo `feature_space`. |
| `year_training_samples` | `FeatureCollection` de muestras remapeadas y filtradas. |
| `n_class_sample` | Resultado de `identifyClasses()`, usado para exigir `> 1` clase. |
| `should_train` | Producto lógico de bandas × muestras × clases. |
| `trained_classifier` | Random Forest entrenado cuando `should_train = 1`. |
| `mask_band` | Banda constante `27` usada si el año no se entrena. |
| `filename` | `<region_id>-<output_version>`. |
| `image_id` | Ruta completa del asset final. |

---

## Anexo C. Remapeos y reglas especiales

### C.1 Remapeo de clases de las muestras (`remap.samples`)

| `from` | `to` | Efecto |
| :--- | :--- | :--- |
| `3`, `4` | `3`, `4` | Conservan ID |
| `5` | `6` | **Remapea (`5 → 6`)** |
| `6`, `7`, `9`, `11`, `12`, `13`, `14`, `15`, `18`, `19`, `20`, `21`, `22`, `23`, `24`, `25`, `26`, `29`, `30`, `31`, `32`, `33`, `34`, `35`, `50`, `66`, `68`, `81`, `82` | Mismo ID | Conservan ID |

### C.2 Regiones andinas (`andean_region_ids`)

Si `region_id` pertenece a `[92001, 92002, 92003, 92004, 92005, 92006, 92007, 92008, 92009]`, `ve_mosaics` se filtra con `andean_filter` (conserva mosaicos cuyo `system:index` contiene `"ANDES"` y mosaicos fuera de `"ANDES"` que intersectan `region.vector`).

### C.3 Muestras complementarias (`additional_samples`)

| Propiedad | Valor actual | Estado |
| :--- | :--- | :--- |
| `polygons` | `[]` | Inactivo |
| `classes` | `[3, 25]` | Sin efecto mientras `polygons` esté vacío |
| `points` | `[3000, 3000]` | Sin efecto mientras `polygons` esté vacío |
| `tile_scale` | `8` | Se usa en `mosaic.sample()` al activar `polygons` |
| `seed` | `1` | Fijado dentro de `resample_cover()` |

### C.4 Remapeo espacial posterior (`remap.polygons`)

`remap.polygons` contiene `[remap_to_21]`, aplicado mediante `functions.remapWithPolygons()` después de clasificar cada año. Verifique visualmente sus efectos sobre la capa `CLASIFICACIÓN`.
