![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Volver al README](https://img.shields.io/badge/%E2%86%90%20Volver%20al%20README-gray?style=for-the-badge)](../README.md)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[Ver script (`02-2-training-samples.js`)](../02-2-training-samples.js) · [English version](./02-2-training-samples.en.md)

# Manual de usuario: Generación de muestras de entrenamiento anuales

**Script:** [`02-2-training-samples.js`](../02-2-training-samples.js) · **Serie:** 1985–2025 (41 años) · **Colección:** 4 · **Versión:** 1.0

> **Propósito:** Orientar la configuración, ejecución, revisión y exportación del script que genera muestras de entrenamiento anuales a partir de mosaicos Landsat, una referencia temática y las regiones de clasificación de MapBiomas Venezuela.

| Campo | Información |
| :--- | :--- |
| **Versión del manual** | 1.0 |
| **Fecha** | 17 de agosto de 2026 |
| **Cobertura temporal** | 1985–2025 (41 años) |
| **Resolución de referencia** | 30 m (`EPSG:4326` a escala 30 m) |
| **Ámbito** | Regiones de clasificación de MapBiomas Venezuela |

---

## Control del documento

| Elemento | Descripción |
| :--- | :--- |
| **Título** | Manual de Usuario – Generación de muestras de entrenamiento anuales |
| **Script base** | [`02-2-training-samples.js`](../02-2-training-samples.js) |
| **Colección** | MapBiomas Venezuela – Colección 4 |
| **Región configurada en el script** | `region_id = 92531` |
| **Versión de salida** | `version = 1` |
| **Alcance** | Configuración, generación de referencias anuales, cálculo de áreas, asignación de muestras, visualización, exportación y control de calidad. |

> [!NOTE]
> Este manual documenta el comportamiento visible de [`02-2-training-samples.js`](../02-2-training-samples.js). Las funciones `getRegion()`, `getMapBiomasMosaics()`, `remapWithPolygons()`, `getPointsPerClass()`, `getTrainingSamples()` y `addPointsToMap()` pertenecen al módulo externo `users/ejvalero/api:src/utils`; su implementación interna no está contenida en el script y no se reconstruye aquí.

---

## Contenido

- [1. Introducción y justificación](#1-introducción-y-justificación)
- [2. Objetivo, alcance y usuarios](#2-objetivo-alcance-y-usuarios)
- [3. Requisitos y datos de entrada](#3-requisitos-y-datos-de-entrada)
- [4. Conceptos fundamentales](#4-conceptos-fundamentales)
- [5. Arquitectura del script](#5-arquitectura-del-script)
- [6. Parámetros configurables](#6-parámetros-configurables)
- [7. Metodología de generación de muestras](#7-metodología-de-generación-de-muestras)
- [8. Productos de salida](#8-productos-de-salida)
- [9. Visualización e inspección](#9-visualización-e-inspección)
- [10. Procedimiento de ejecución](#10-procedimiento-de-ejecución)
- [11. Interpretación y uso de las muestras](#11-interpretación-y-uso-de-las-muestras)
- [12. Exportación y nomenclatura](#12-exportación-y-nomenclatura)
- [13. Control de calidad recomendado](#13-control-de-calidad-recomendado)
- [14. Problemas frecuentes y soluciones](#14-problemas-frecuentes-y-soluciones)
- [15. Buenas prácticas](#15-buenas-prácticas)
- [16. Referencias y recursos](#16-referencias-y-recursos)
- [Anexo A. Guía rápida de ejecución](#anexo-a-guía-rápida-de-ejecución)
- [Anexo B. Diccionario de variables y controles](#anexo-b-diccionario-de-variables-y-controles)

### Convenciones de lectura

- Los nombres de variables, funciones, propiedades y assets se muestran tal como aparecen en el script.
- **Referencia** designa la imagen temática utilizada para identificar la clase de cada muestra.
- **Mosaico** designa la imagen anual con las variables del espacio de atributos (`feature_space`).
- Cuando una función proviene del módulo externo, el manual describe sus entradas y el uso que hace el script.

---

## 1. Introducción y justificación

La clasificación supervisada requiere un conjunto de observaciones de entrenamiento que relacione clases de referencia con variables espectrales y derivadas del mosaico. En una serie anual de larga duración, la calidad y consistencia de esas muestras condicionan la capacidad del clasificador para representar adecuadamente la variabilidad espacial y temporal de cada región.

El script [`02-2-training-samples.js`](../02-2-training-samples.js) automatiza la preparación de muestras de entrenamiento para cada año entre 1985 y 2025. El flujo combina una región de clasificación, mosaicos Landsat de Venezuela y Guyana, una imagen multibanda de referencia, reglas de remapeo y funciones auxiliares para calcular áreas por clase, determinar cantidades de puntos y construir la colección de muestras que se exporta como un `Table Asset` de Earth Engine.

### 1.1 ¿Qué problema resuelve?

- Generar de forma repetible muestras de entrenamiento para 41 años de la serie.
- Adaptar la referencia temática mediante remapeos globales y remapeos espaciales por polígonos.
- Calcular la superficie por clase dentro de la región como insumo para la asignación de muestras.
- Evitar procesar años sin mosaico o sin banda de referencia disponible.
- Conservar una colección de muestras independiente por región, año y versión.
- Facilitar la inspección visual de mosaico, referencia y puntos antes de usar las muestras en la clasificación.

---

## 2. Objetivo, alcance y usuarios

### Objetivo general

Proporcionar una guía reproducible para configurar, ejecutar y verificar el script `02-2-training-samples.js`, comprendiendo cómo se construye la referencia anual, cómo se distribuyen y generan las muestras y qué controles deben realizarse antes de utilizarlas en la clasificación.

### Objetivos específicos

- Documentar los assets, parámetros y módulos requeridos.
- Explicar la selección anual de la banda de referencia, incluida la regla especial aplicada a 2025.
- Describir el remapeo de clases y su efecto sobre valores no contemplados.
- Describir el cálculo de áreas por clase y la llamada a la asignación de puntos.
- Documentar las 35 variables solicitadas a los mosaicos.
- Establecer un procedimiento de QA para referencia, distribución de clases, puntos y exportaciones.

### Usuarios previstos

Personal técnico de MapBiomas Venezuela con experiencia básica o intermedia en Google Earth Engine, clasificación supervisada, interpretación de mosaicos Landsat y manejo de assets, encargado de preparar insumos de entrenamiento por región.

---

## 3. Requisitos y datos de entrada

### 3.1 Requisitos operativos

- Acceso al Google Earth Engine Code Editor y al proyecto correspondiente.
- Permiso de lectura sobre los assets de regiones, referencia y mosaicos.
- Permiso de escritura sobre la colección `SAMPLES` definida en `output`.
- Acceso a los módulos `users/ejvalero/api:src/utils` y `users/mapbiomas/modules:Palettes.js`.
- Disponibilidad del objeto `reference_to_30` en el entorno del script, ya que se incluye en `remap_polygons`.
- Existencia de la región indicada por `region_id` en el campo `gridcode` del asset de regiones.

> [!CAUTION]
> **Control crítico:** Si `reference_to_30` no está importado o definido en el Code Editor antes de ejecutar el script, la línea `var remap_polygons = [reference_to_30];` provocará un error de JavaScript y el procesamiento no podrá comenzar.

### 3.2 Región de clasificación

La región se obtiene con `functions.getRegion()` a partir del asset:

```text
projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion
```

Se utiliza `gridcode` como campo identificador (`regions_field`) y `region_id = 92531` en la configuración base. El objeto retornado expone `region.vector` y `region.rasterMask`.

### 3.3 Mosaicos anuales

El script carga mosaicos de Venezuela y Guyana mediante `functions.getMapBiomasMosaics()`, solicita las 35 variables de `feature_space`, fusiona ambas colecciones y conserva únicamente `season = "full"`. Para cada año disponible construye un mosaico anual (`mosaic()`) recortado con `region.rasterMask`.

### 3.4 Imagen de referencia

La referencia es una imagen multibanda cargada desde:

```text
projects/mapbiomas-venezuela/assets/LANDSAT/VENEZUELA-3/integracion/VENEZUELA-GUYANA-9
```

Para cada año se selecciona una banda con prefijo `classification`. El año `2025` constituye una excepción explícita: utiliza `classification_2024` como referencia.

```javascript
var selector =
  year === last_year
    ? reference_prefix + "_" + str_penultimate_year
    : reference_prefix + "_" + str_year;
```

> [!IMPORTANT]
> **Regla de 2025:** Con `last_year = 2025`, las muestras de 2025 se generan usando la referencia temática `classification_2024`. Si en el futuro existe una referencia 2025 y se desea utilizarla, esta regla debe revisarse deliberadamente.

---

## 4. Conceptos fundamentales

### 4.1 Muestra de entrenamiento

En este flujo, una muestra de entrenamiento es una entidad espacial generada a partir de una clase de referencia y un mosaico anual. El script exporta una `FeatureCollection` por año. El esquema exacto de propiedades que añade `getTrainingSamples()` depende del módulo externo; por ello conviene inspeccionar un asset exportado antes de usarlo como entrada del clasificador.

### 4.2 Espacio de atributos

`feature_space` define las 35 variables solicitadas al construir los mosaicos, combinando bandas espectrales medianas, fracciones SMA, índices espectrales y componentes Tasseled Cap. Su presencia en los mosaicos es requisito para la consistencia del muestreo y de la clasificación posterior.

### 4.3 Referencia temática y remapeo

Antes de generar muestras, la banda anual de referencia se recorta a la región y se remapea mediante `remap_all_reference.from` y `remap_all_reference.to`. La mayoría de los IDs listados conservan su valor; las fusiones explícitas configuradas son `6 → 5` y `25 → 24`.

| Clase original | Clase usada después del remapeo | Observación |
| :--- | :--- | :--- |
| `6` | `5` | Fusión explícita definida en `remap_all_reference`. |
| `25` | `24` | Fusión explícita definida en `remap_all_reference`. |
| Resto de IDs listados | Mismo ID | Se conservan según las listas `from`/`to`. |
| Valor no incluido en `from` | Enmascarado | `ee.Image.remap()` sin `defaultValue` enmascara valores no coincidentes. |

> [!IMPORTANT]
> La lista `from` debe cubrir todos los valores de referencia que se quieran conservar. Al no especificarse `defaultValue` en `ee.Image.remap()`, cualquier clase fuera de `from` queda enmascarada y no generará muestras.

### 4.4 Remapeo espacial por polígonos

Después del remapeo global, el script ejecuta `functions.remapWithPolygons(selected_reference, remap_polygons)`. En la configuración actual `remap_polygons` contiene `[reference_to_30]`. Como la lógica interna pertenece al módulo externo, el control operativo debe centrarse en inspeccionar visualmente la capa `REFERENCE <year>`.

---

## 5. Arquitectura del script

| Paso | Bloque | Función |
| :--- | :--- | :--- |
| 1 | Configuración | Usuario, región, años, espacio de atributos, número de muestras, remapeos y versión. |
| 2 | Rutas y módulos | Define salida, referencia, regiones, mosaicos y librerías. |
| 3 | Paleta | Carga `classification8` y la extiende hasta el ID `82`. |
| 4 | Datos de entrada | Carga región, mosaicos de Venezuela/Guyana y referencia multibanda. |
| 5 | Disponibilidad | Obtiene una sola vez los años con mosaicos y las bandas de referencia mediante `getInfo()`. |
| 6 | Bucle anual | Recorre `1985–2025` y omite años que no tienen datos requeridos. |
| 7 | Referencia anual | Selecciona banda, aplica máscara regional, remapeo global, remapeo espacial y reproyección. |
| 8 | Áreas y asignación | Calcula superficie por clase (`apply_areas`) y llama a `getPointsPerClass()`. |
| 9 | Muestreo | Llama a `getTrainingSamples()` con mosaico, referencia, clases y puntos por clase. |
| 10 | Salida y QA | Añade propiedad `year`, crea `Export.table.toAsset()` y visualiza años de `preview`. |

---

## 6. Parámetros configurables

Revise estos parámetros al inicio del script antes de ejecutarlo para una nueva región o versión:

| Parámetro | Valor actual | Qué controla |
| :--- | :--- | :--- |
| `user` | `"sig2-provita"` | Proyecto/usuario usado para construir la ruta de salida `output`. |
| `region_id` | `92531` | Región de clasificación a procesar. |
| `years` | `[1985, ..., 2025]` | Lista de años a recorrer. |
| `preview` | `[1985, 2000, 2025]` | Años para visualización en mapa y reportes en consola. |
| `feature_space` | 35 variables | Bandas e índices solicitados a los mosaicos. |
| `samples` | `10000` | Cantidad objetivo de muestras entregada a `getPointsPerClass()`. |
| `min_samples` | `1000` | Mínimo de muestras por clase entregado a `getPointsPerClass()`. |
| `remap_all_reference` | listas `from`/`to` | Reglas globales de recodificación de la referencia. |
| `remap_polygons` | `[reference_to_30]` | Polígonos/reglas espaciales entregados a `remapWithPolygons()`. |
| `version` | `1` | Versión incorporada al nombre de cada asset exportado. |
| `output` | `.../GENERAL/SAMPLES` | Colección de Table Assets de salida. |
| `reference_path` | `.../VENEZUELA-GUYANA-9` | Imagen multibanda de referencia temática. |
| `regions` | `.../ve-gu-regiones-clasificacion` | Asset vectorial con las regiones de clasificación. |
| `regions_field` | `"gridcode"` | Campo identificador de la región en `regions`. |
| `reference_prefix` | `"classification"` | Prefijo usado para construir el selector anual de referencia. |
| `last_year` | `2025` | Activa la regla que usa la referencia del año anterior (`2024`). |
| `rgb_combination` | `["swir1_median", "nir_median", "red_median"]` | Combinación RGB falsa color para visualizar mosaicos en `preview`. |

> [!NOTE]
> **No asumir la fórmula de distribución:** Los nombres `samples` y `min_samples` sugieren un total objetivo y un mínimo por clase, pero la fórmula exacta usada por `getPointsPerClass()` reside en `users/ejvalero/api:src/utils`.

---

## 7. Metodología de generación de muestras

### 7.1 Verificación previa de disponibilidad

Antes del bucle anual, el script consulta una sola vez los años disponibles en `mosaics` y las bandas disponibles en `reference` mediante `getInfo()`, evitando llamadas repetitivas dentro del bucle `forEach()`:

```javascript
var available_mosaic_years = mosaics
  .aggregate_array("year")
  .distinct()
  .getInfo()
  .map(function (year) {
    return Number(year);
  });

var available_reference_bands = reference.bandNames().getInfo();
```

### 7.2 Selección de referencia por año

Para 1985–2024, `selector = "classification_<year>"`. Para 2025, `selector = "classification_2024"`. Si la banda requerida no existe en `available_reference_bands` (o el año no está en `available_mosaic_years`), el año se omite e imprime un aviso en consola.

| Año de proceso | Banda de referencia esperada |
| :--- | :--- |
| `1985` | `classification_1985` |
| `2000` | `classification_2000` |
| `2024` | `classification_2024` |
| `2025` | `classification_2024` |

### 7.3 Preparación de la referencia

La banda seleccionada se enmascara con `region.rasterMask`, se remapea con `remap_all_reference`, se renombra `"reference"`, pasa por `functions.remapWithPolygons()` y se reproyecta explícitamente a `EPSG:4326` a escala 30 m:

```javascript
var selected_reference = reference
  .select(selector)
  .updateMask(region.rasterMask)
  .remap(remap_all_reference.from, remap_all_reference.to)
  .rename("reference");

var year_reference = functions
  .remapWithPolygons(selected_reference, remap_polygons)
  .reproject({
    crs: "EPSG:4326",
    scale: 30,
  });
```

> [!WARNING]
> **Consideración de proyección:** El script fuerza `reproject({ crs: "EPSG:4326", scale: 30 })`. No modifique esta línea de forma aislada; cualquier ajuste debe validarse contra el flujo completo de muestreo y clasificación.

### 7.4 Cálculo de áreas por clase

`apply_areas()` combina `ee.Image.pixelArea().divide(1e6)` con la referencia preparada y aplica `reduceRegion()` con `ee.Reducer.sum().group()` sobre `region_vector.geometry()`. Incluye resguardo para regiones sin píxeles válidos (`stats.contains("groups")`) y asigna las áreas redondeadas (en km²) como propiedades `ID<clase>` (p. ej., `ID3`, `ID21`, `ID81`).

```javascript
var area_image = ee.Image.pixelArea().divide(1e6).addBands(image);

var stats = area_image.reduceRegion({
  reducer: ee.Reducer.sum().group({
    groupField: 1,
    groupName: "classId",
  }),
  geometry: region_vector.geometry(),
  scale: 30,
  maxPixels: 1e13,
});
```

> [!NOTE]
> Las superficies se redondean con `round()`. En clases muy pequeñas, la propiedad almacenada puede quedar en `0` km²; verifique el impacto real en `SAMPLING INFO <year>`.

### 7.5 Construcción del mosaico anual

El script filtra `mosaics` por `year`, aplica `mosaic()`, recorta con `region.rasterMask` y vuelve a establecer la propiedad `year`.

### 7.6 Asignación de puntos por clase

`functions.getPointsPerClass(year_areas, samples, min_samples)` calcula `points_count.ids` (clases) y `points_count.points` (número de puntos por clase).

### 7.7 Generación de las muestras

`functions.getTrainingSamples()` recibe el año, el mosaico anual como `ImageCollection`, la referencia preparada, los IDs de clase, los puntos por clase y `region.vector`. Devuelve `training.data` (para exportación) y `training.points` (para visualización).

### 7.8 Preparación de la colección final

El script extrae `training.data.get("samples-" + year)`, lo convierte a `ee.FeatureCollection`, añade a cada entidad la propiedad `"year"` y crea una tarea `Export.table.toAsset()` con `overwrite: true`.

---

## 8. Productos de salida

El producto persistente generado es una colección de **Table Assets anuales** (hasta 41 tareas, una por cada año válido):

| Producto | Patrón de nombre | Contenido |
| :--- | :--- | :--- |
| Muestras anuales | `<region_id>-<year>-<version>` | `FeatureCollection` generada por `getTrainingSamples()` con propiedad `year`. |
| Ejemplo 1985 | `92531-1985-1` | Muestras de la región `92531` para 1985, versión `1`. |
| Ejemplo 2025 | `92531-2025-1` | Muestras para 2025 usando `classification_2024` como referencia. |

### Información no exportada como producto independiente

Las áreas por clase (`year_areas`), `points_count` y `training.points` se utilizan durante la ejecución y se muestran en el mapa o consola solo para los años definidos en `preview`.

### Esquema de atributos

Cada feature incluye la propiedad `year` añadida explícitamente por el script, además de los atributos de referencia y bandas extraídas por `getTrainingSamples()`. Inspeccione uno de los assets exportados antes de conectarlo al clasificador.

---

## 9. Visualización e inspección

Para cada año incluido en `preview` (`[1985, 2000, 2025]`), el script añade capas al mapa e imprime estadísticas en consola:

| Elemento | Nombre de capa / salida | Uso |
| :--- | :--- | :--- |
| Mosaico anual | `MOSAIC <year>` | Inspección espectral en falsa color `SWIR1–NIR–Red`. |
| Referencia | `REFERENCE <year>` | Verifica la referencia temática tras máscara y remapeos. |
| Puntos | `SAMPLES <year>` | Visualiza la distribución espacial de puntos con la paleta extendida. |
| Consola | `SAMPLING INFO <year>` | Muestra la asignación calculada por `getPointsPerClass()`. |
| Consola | `ÁREAS POR CLASE <year>` | Muestra las propiedades `ID*` de superficie (km²) en la región. |

### 9.1 Paleta extendida

La paleta base `classification8` (índices 0–62) se extiende mediante `extend_palette()` hasta el índice `82` (rellenando posiciones intermedias con gris `808080`) para dar soporte a cuatro clases adicionales de Venezuela:

| ID | Cobertura | Color hexadecimal |
| :--- | :--- | :--- |
| `66` | Shrubland | `#a89358` |
| `68` | Other non-vegetated natural areas | `#e97a7a` |
| `81` | Andean herbaceous/shrubby vegetation | `#dfeb62` |
| `82` | Flooded Andean herbaceous/shrubby vegetation | `#6fc179` |

---

## 10. Procedimiento de ejecución

### 10.1 Preparación

1. Abra [`02-2-training-samples.js`](../02-2-training-samples.js) en el Google Earth Engine Code Editor.
2. Verifique que `reference_to_30` esté importado o definido.
3. Confirme `user`, `region_id` y `version`.
4. Compruebe las rutas `output`, `reference_path`, `regions`, `guyana_mosaics` y `venezuela_mosaics`.
5. Revise `years` y confirme que la regla especial `last_year = 2025` sea la deseada.
6. Verifique `remap_all_reference` y `remap_polygons` para la región a procesar.
7. Revise `samples` y `min_samples`.
8. Confirme que los 35 nombres de `feature_space` existen en los mosaicos del módulo.
9. Seleccione en `preview` años representativos (p. ej., inicio, medio y fin de serie).

### 10.2 Ejecución en el Code Editor

1. Pulse **Run**.
2. Revise en **Console** `AVAILABLE MOSAIC YEARS` y `PALETTE SIZE`.
3. Verifique si aparecen avisos `"No hay mosaicos disponibles para ..."` o `"No existe la banda de referencia ..."`.
4. Para cada año de `preview`, revise `SAMPLING INFO` y `ÁREAS POR CLASE`.
5. Active `MOSAIC`, `REFERENCE` y `SAMPLES` para inspeccionar varias zonas de la región.
6. Abra **Tasks** y confirme que se hayan generado las tareas esperadas.

### 10.3 Inicio de exportaciones

`Export.table.toAsset()` crea tareas batch en la pestaña **Tasks**.

> [!WARNING]
> **Sobrescritura activa:** La exportación configura `overwrite: true`. Reutilizar la misma combinación `<region_id>-<year>-<version>` reemplazará el asset existente. Incremente `version` si necesita conservar corridas anteriores.

---

## 11. Interpretación y uso de las muestras

| Señal observada | Interpretación / acción recomendada |
| :--- | :--- |
| Clase presente en `REFERENCE` pero sin puntos | Revisar `SAMPLING INFO`, área calculada, remapeo y cobertura real en la región. |
| Puntos concentrados en una zona pequeña | Evaluar si responde a la geometría real de la clase o al muestreo del módulo. |
| Muestras sobre píxeles visualmente incoherentes | Revisar referencia, `remap_polygons`, año del mosaico y posible desalineación temporal. |
| 2025 replica patrones de 2024 | Comportamiento esperado: el script usa `classification_2024` como referencia de 2025. |
| Una clase desaparece tras el remapeo | Verificar que su ID figure en `remap_all_reference.from` y revisar `from → to`. |
| Área = `0` para una clase pequeña visible | `apply_areas()` redondea a km² enteros; revisar efecto en `getPointsPerClass()`. |

### Coherencia temporal y con el clasificador

- El mosaico corresponde al año procesado; la referencia también, salvo en 2025 (que toma 2024).
- Confirme que las propiedades exportadas coinciden con el `feature_space` esperado por [`03-0-classifier.js`](../03-0-classifier.js) (note que `02-2-training-samples.js` incluye `tir_median` y `03-0-classifier.js` usa 34 bandas sin `tir_median`, lo cual es compatible mientras las muestras contengan todas las bandas del clasificador).

---

## 12. Exportación y nomenclatura

- **Ruta de salida:** `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/SAMPLES`
- **Nombre del asset:** `<region_id>-<year>-<version>` (ejemplo: `92531-2000-1`)
- **Tipo:** `Table Asset` vía `Export.table.toAsset()` con `overwrite: true` (no exporta archivos a Google Drive).

---

## 13. Control de calidad recomendado

### Antes de lanzar las Tasks

- Confirmar `region_id` y la definición correcta de `reference_to_30`.
- Comprobar que `AVAILABLE MOSAIC YEARS` incluye los años previstos y que `reference` contiene `classification_2024` para procesar 2025.
- Verificar que `remap_all_reference.from` cubra todos los IDs a conservar.
- Comparar `ÁREAS POR CLASE` y `SAMPLING INFO` frente a `REFERENCE`, `MOSAIC` y `SAMPLES` en los años de `preview`.
- Confirmar nombres y número total de tareas en **Tasks**.

### Después de exportar

- Inspeccionar al menos un asset inicial, uno intermedio y `2025`.
- Verificar que todas las features incluyen la propiedad `year` y los 35 atributos esperados.
- Conservar registro de región, año, `version`, fecha de ejecución y referencia utilizada.

---

## 14. Problemas frecuentes y soluciones

| Situación | Qué revisar / solución |
| :--- | :--- |
| `reference_to_30 is not defined` | Importe o defina el objeto antes de `remap_polygons` (o ajústelo según la región). |
| `No hay mosaicos disponibles para <year>` | El año no está en `available_mosaic_years`. Revise colecciones de mosaicos, `year` y `season = "full"`. |
| `No existe la banda de referencia classification_YYYY` | Revise `reference_path` y `bandNames()`. Para 2025 el script solicita `classification_2024`. |
| Una clase no aparece en la referencia preparada | Compruebe `remap_all_reference.from`. Los valores omitidos quedan enmascarados. |
| `SAMPLING INFO` parece desbalanceado | Revise `year_areas`, `samples`, `min_samples` y `getPointsPerClass()` en el módulo externo. |
| `ÁREA POR CLASE = 0` para una clase pequeña | `apply_areas()` redondea a km² enteros; revise su área real y asignación de puntos. |
| Puntos fuera de zonas esperadas | Compare `REFERENCE`, `remap_polygons`, `region.rasterMask` y el año del mosaico. |
| Exportación reemplaza un asset existente | La exportación usa `overwrite: true`. Cambie `version` si desea conservar el activo previo. |
| Task falla durante la exportación | Revise permisos de escritura sobre `output`, `assetId`, cuota y el error en **Tasks**. |
| Faltan variables en las muestras | Compruebe `feature_space` y las bandas presentes en el mosaico anual. |

---

## 15. Buenas prácticas

- Validar una región completa antes de lanzar exportaciones masivas.
- Incrementar `version` cuando cambien referencia, remapeos, `feature_space` o parámetros de muestreo.
- No modificar simultáneamente `samples`, `min_samples` y `remap_all_reference` sin registrar cambios.
- Mantener en `preview` un año inicial (`1985`), uno intermedio (`2000`) y el último año (`2025`).
- Evitar introducir llamadas `getInfo()` adicionales dentro del bucle anual.
- Mantener documentada la excepción `2025 → referencia 2024` en la bitácora del proyecto.

---

## 16. Referencias y recursos

- **Script fuente:** [`02-2-training-samples.js`](../02-2-training-samples.js)
- [Google Earth Engine – Code Editor](https://code.earthengine.google.com/)
- [Google Earth Engine – Client vs. Server](https://developers.google.com/earth-engine/guides/client_server)
- [Google Earth Engine – `ee.Image.remap`](https://developers.google.com/earth-engine/apidocs/ee-image-remap)
- [Google Earth Engine – `ee.Image.reproject`](https://developers.google.com/earth-engine/apidocs/ee-image-reproject)
- [Google Earth Engine – `ee.Image.reduceRegion`](https://developers.google.com/earth-engine/apidocs/ee-image-reduceregion)
- [Google Earth Engine – Grouped reductions](https://developers.google.com/earth-engine/guides/reducers_grouping)
- [Google Earth Engine – `Export.table.toAsset`](https://developers.google.com/earth-engine/apidocs/export-table-toasset)
- [MapBiomas Venezuela](https://venezuela.mapbiomas.org/)
- Cardille, Crowley, Saah & Clinton (eds.), 2024. *Cloud-Based Remote Sensing with Google Earth Engine*. [DOI: 10.1007/978-3-031-26588-4](https://doi.org/10.1007/978-3-031-26588-4)

---

## Anexo A. Guía rápida de ejecución

| Paso | Acción | Verificación |
| :--- | :--- | :--- |
| 1 | Seleccione región | Ajuste `region_id` y confirme `gridcode`. |
| 2 | Revise referencia espacial | Confirme que `reference_to_30` esté definido. |
| 3 | Revise rutas | Mosaicos, `reference_path`, `regions` y `output` accesibles. |
| 4 | Revise años | `1985–2025`; confirme que `2025` usa `classification_2024`. |
| 5 | Revise remapeos | Listas `from`/`to` y `remap_polygons` correctos. |
| 6 | Revise parámetros | `samples`, `min_samples` y `version`. |
| 7 | Ejecute | Pulse **Run**; revise `AVAILABLE MOSAIC YEARS` y mensajes en consola. |
| 8 | Inspeccione | Capas `MOSAIC`, `REFERENCE` y `SAMPLES` para `1985`, `2000` y `2025`. |
| 9 | Revise asignación | `SAMPLING INFO` y `ÁREAS POR CLASE`. |
| 10 | Lance Tasks | Confirme nombres y recuerde `overwrite: true`. |
| 11 | Verifique salida | Abra assets exportados y revise esquema, `year`, clases y variables. |

---

## Anexo B. Diccionario de variables y controles

### B.1 Espacio de atributos (35 variables)

| # | Variable | # | Variable |
| :--- | :--- | :--- | :--- |
| 1 | `blue_median` | 2 | `green_median` |
| 3 | `red_median` | 4 | `nir_median` |
| 5 | `swir1_median` | 6 | `swir2_median` |
| 7 | `tir_median` | 8 | `gv_median` |
| 9 | `npv_median` | 10 | `soil_median` |
| 11 | `cloud_median` | 12 | `shade_median` |
| 13 | `ndfi_median` | 14 | `ndvi_median` |
| 15 | `evi_median` | 16 | `savi_median` |
| 17 | `gndvi_median` | 18 | `ndmi_median` |
| 19 | `nbr_median` | 20 | `ndwi_median` |
| 21 | `mndwi_median` | 22 | `awei_median` |
| 23 | `wri_median` | 24 | `cmri_median` |
| 25 | `mvi_median` | 26 | `ndbi_median` |
| 27 | `ui_median` | 28 | `bsi_median` |
| 29 | `ndsi_median` | 30 | `iron_oxide_median` |
| 31 | `ndti_median` | 32 | `msavi2_median` |
| 33 | `tc_brightness_median` | 34 | `tc_greenness_median` |
| 35 | `tc_wetness_median` | | |

### B.2 Remapeo global de la referencia (`remap_all_reference`)

| `from` | `to` | Efecto |
| :--- | :--- | :--- |
| `3`, `4`, `5` | `3`, `4`, `5` | Conservan ID |
| `6` | `5` | **Remapea (`6 → 5`)** |
| `7`, `9`, `11`, `12`, `13`, `14`, `15`, `18`, `19`, `20`, `21`, `22`, `23`, `24` | Mismo ID | Conservan ID |
| `25` | `24` | **Remapea (`25 → 24`)** |
| `26`, `29`, `30`, `31`, `32`, `33`, `34`, `35`, `50`, `66`, `68`, `81`, `82` | Mismo ID | Conservan ID |

### B.3 Variables de disponibilidad y control

| Variable / salida | Significado |
| :--- | :--- |
| `available_mosaic_years` | Lista cliente de años presentes en la colección de mosaicos fusionada. |
| `available_reference_bands` | Lista cliente con nombres de bandas de la imagen `reference`. |
| `selector` | Nombre de la banda de referencia elegida para el año. |
| `year_reference` | Referencia anual después de máscara, remapeos y reproyección. |
| `year_areas` | `FeatureCollection` de la región con propiedades `ID*` de superficie (km²) por clase. |
| `points_count.ids` | IDs de clase entregados al muestreador. |
| `points_count.points` | Cantidad de puntos por clase calculada por `getPointsPerClass()`. |
| `training.data` | Diccionario del que se recupera la colección `samples-<year>`. |
| `training.points` | Puntos utilizados por `addPointsToMap()` para la inspección visual. |
| `collection` | `FeatureCollection` final a exportar con propiedad `year`. |
| `filename` | `<region_id>-<year>-<version>`. |

### B.4 Preguntas operativas rápidas

| Pregunta | Variable / capa / salida a revisar |
| :--- | :--- |
| ¿Existe mosaico para el año? | `AVAILABLE MOSAIC YEARS` / `available_mosaic_years` |
| ¿Existe la banda de referencia? | `available_reference_bands` y mensajes en Console |
| ¿Qué referencia usa 2025? | `selector` → `classification_2024` |
| ¿Qué clases quedan después del remapeo? | `REFERENCE <year>` y `remap_all_reference` |
| ¿Cuánta superficie tiene cada clase? | `ÁREAS POR CLASE <year>` |
| ¿Cuántos puntos se asignaron? | `SAMPLING INFO <year>` |
| ¿Dónde están las muestras? | `SAMPLES <year>` |
| ¿Qué variables alimentan el mosaico? | `feature_space` |
| ¿Dónde se guarda el resultado? | `output + "/" + filename` |
| ¿Puede reemplazar un asset existente? | Sí, `Export.table.toAsset()` usa `overwrite: true` |
