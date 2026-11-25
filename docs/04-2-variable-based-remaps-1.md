![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Volver al README](https://img.shields.io/badge/%E2%86%90%20Volver%20al%20README-gray?style=for-the-badge)](../README.md)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[Ver script (`04-2-variable-based-remaps-1.js`)](../04-2-variable-based-remaps-1.js) · [English version](./04-2-variable-based-remaps-1.en.md)

# Manual de usuario del remapeo por variables auxiliares

MapBiomas Venezuela · Colección 4 · Serie 1985–2025 · Manual 1.0

El script remapea clases en años seleccionados según umbrales de elevación, NDVI y altura de dosel. Las reglas pueden limitarse a un área. El producto conserva la serie anual completa y la consola muestra gráficos de superficie de las clases seleccionadas.

| Entrada de ejemplo | Salida de ejemplo | Producto |
| --- | --- | --- |
| `classification/92420-1` | `classification-ft/92420-2` | Imagen anual multibanda, `Byte`, 30 m |

## Contenido

- [1. Requisitos y fuentes](#1-requisitos-y-fuentes)
- [2. Parámetros](#2-parámetros)
- [3. Reglas y precedencia](#3-reglas-y-precedencia)
- [4. Regiones, bandas faltantes y NoData](#4-regiones-bandas-faltantes-y-nodata)
- [5. Ejecución y revisión](#5-ejecución-y-revisión)
- [6. Exportación](#6-exportación)
- [7. Ejemplos y control de calidad](#7-ejemplos-y-control-de-calidad)
- [8. Problemas frecuentes](#8-problemas-frecuentes)
- [9. Referencias](#9-referencias)

## 1. Requisitos y fuentes

En el [Code Editor de Google Earth Engine](https://code.earthengine.google.com/), confirme acceso de lectura a los assets de entrada y permiso de escritura en la carpeta de destino. Se necesitan `users/ejvalero/api:src/utils` para los mosaicos y `users/mapbiomas/modules:Palettes.js` para la paleta `classification9`, que el script amplía para la visualización.

| Entrada | Ruta o uso |
| --- | --- |
| Clasificación regional | `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification/<region_id>-<input_version>` |
| Regiones | `projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion`. El script filtra y rasteriza `id_regionc`. |
| Mosaicos de Venezuela | `projects/mapbiomas-mosaics/assets/LANDSAT/LULC/VENEZUELA/mosaics-2` |
| Mosaicos de Guyana | `projects/nexgenmap/MapBiomas2/LANDSAT/GUYANA/mosaics-2` |
| Dosel | `users/potapovpeter/GEDI_V27`. Se arma un mosaico y se renombra la banda como `canopy`. |
| Elevación | `NASA/NASADEM_HGT/001`, banda `elevation`. |
| Área NDVI | `area_to_apply_ndvi`, polígono definido como `ee.Feature` en el propio script con `id: 1`. |

El script fusiona las dos colecciones Landsat de temporada `full`. Usa el mosaico de cada año para `ndvi_median` y las capas de contexto. El dosel y la elevación son capas compartidas por todos los años. Confirme que el mosaico de cada año seleccionado contiene las bandas solicitadas y que los umbrales usan las unidades almacenadas en los assets.

## 2. Parámetros

| Parámetro | Valor del script | Efecto |
| --- | --- | --- |
| `user` | `'mayerlings-488722'` | Proyecto de las rutas de clasificación. |
| `region_ids` | `[92420]` | Regiones a procesar. |
| `input_versions` / `output_versions` | `['1']` / `['2']` | Versiones de entrada y salida para cada región. |
| `processing_years` | 1985–2025 | Serie completa que se reconstruye. |
| `remap_years` | `[2024, 2025]` | Años donde se evalúan las reglas. Con `[]` se procesa toda la serie. |
| `preview_years` | `[2015, 2025]` | Años que se muestran en el mapa. |
| `forest_ids` | `[3, 33]` | Clases de los gráficos de superficie. |
| `rules` | Tres reglas en secuencia | Define clases, variables, umbrales y restricciones. |

Las listas de regiones y versiones se leen por posición. Mantenga una entrada y una salida por cada región, porque el script no valida la longitud de las listas. `preview_years` controla la vista previa y `remap_years` controla el procesamiento. Por eso, con los valores activos, 2015 sirve para comparar el resultado fuera del intervalo editado y 2025 muestra un año editado.

## 3. Reglas y precedencia

| Orden | Banda de la regla | Condición sobre el valor almacenado | Reemplazo | Área de aplicación |
| --- | --- | --- | --- | --- |
| 1 | `elevation` | ≤ 40 | 3 → 21 | Región de clasificación |
| 2 | `ndvi_median` | ≤ 10 000 (`100 * 100`) | 3 → 21 | Polígono `area_to_apply_ndvi` |
| 3 | `canopy` | ≤ 5 | 3 → 21 | Región de clasificación |

`apply_rules()` toma el umbral de la propiedad que coincide con `band_name`. `create_condition()` acepta `gte`, `lte`, `gt`, `lt` y `eq`. Cada posición de `from` debe tener su destino en la misma posición de `to`.

La regla puede tener un arreglo `years` para restringirla dentro de `remap_years`. Si se omite, la regla se evalúa en todos los años seleccionados globalmente. Un `years: []` en una regla la omite para todos los años, mientras que `remap_years: []` selecciona toda la serie. Para una regla espacial, `area_to_apply: null` usa la región entera. Con un área, el script rasteriza la propiedad numérica `id`. Use entidades que cubran el área prevista y que tengan un `id` distinto de cero.

Cada reemplazo usa `where()` sobre la banda que dejó el paso anterior. Con las reglas actuales, un píxel ya convertido a 21 deja de coincidir con la clase de origen 3. Si se agregan reglas con distintos orígenes o destinos, verifique su precedencia con ejemplos que activen varias reglas. [Sustitución condicional con `where()`](https://developers.google.com/earth-engine/apidocs/ee-image-where)

## 4. Regiones, bandas faltantes y NoData

1. Para cada región, el script carga la clasificación y aplica la máscara rasterizada de `id_regionc`.
2. Antes de seleccionar las bandas anuales, agrega bandas de respaldo con valor `27` y `overwrite: false`. Una banda existente conserva su nombre y tiene prioridad. Los respaldos con nombres duplicados reciben un sufijo y la selección anual usa los nombres originales. [Comportamiento de `addBands()`](https://developers.google.com/earth-engine/apidocs/ee-image-addbands)
3. En los años elegibles, combina el mosaico anual con `canopy` y `elevation` para evaluar las reglas. Para los demás años toma la clasificación preparada sin remapeo.
4. Ensambla la serie completa y enmascara el valor `27` en todas las bandas, incluso fuera de `remap_years`. Una banda que faltaba aparece estructuralmente en la salida, pero queda enmascarada. Las máscaras existentes tampoco se rellenan.

> [!IMPORTANT]
> La revisión del código identificó dos llamadas de geometría que requieren atención antes de ejecutar. Al preparar un año de remapeo se llama a `ee.Filter.bounds(region.vector)`, pero aquí `region` es la colección filtrada y no tiene esa propiedad. La llamada espera `region` o su geometría. Además, el mosaico de dosel usa `.clip(regions)` con una colección de entidades. Earth Engine documenta `clipToCollection(regions)` para ese tipo de entrada. [Filtro espacial](https://developers.google.com/earth-engine/apidocs/ee-filter-bounds) · [Recorte por colección](https://developers.google.com/earth-engine/apidocs/ee-image-cliptocollection)

Para las regiones de `andean_region_ids`, la lógica del filtro conserva mosaicos con `ANDES` en `system:index` y los demás que intersectan la región. El código reasigna la variable compartida `mosaics` dentro del bucle. Al configurar varias regiones en una sola corrida, compruebe que el filtro aplicado a una región andina no reduzca la colección de las regiones siguientes.

## 5. Ejecución y revisión

1. Verifique las rutas, la correspondencia de las listas, las bandas de clasificación y las bandas de los mosaicos. Revise las llamadas de geometría señaladas arriba y confirme que el polígono NDVI corresponda a la zona de análisis.
2. Configure `remap_years`, `rules` y `preview_years`. Incluya al menos un año elegible y, si quiere revisar el alcance, uno fuera de la selección.
3. Pulse **Run**. Compare `INPUT: <año> <región>` y `OUTPUT: <año> <región>`. Use `MOSAIC` para el contexto en falso color y `NDVI` para comprobar la regla espacial. Las dos capas auxiliares se agregan apagadas inicialmente.
4. Revise en la consola un gráfico de superficie para cada clase de `forest_ids`. El cálculo multiplica la máscara de clase por el área de píxel, divide entre un millón y suma por región. El eje vertical está en km². Los gráficos permiten detectar saltos o pérdidas de superficie y usan la salida del remapeo como insumo.
5. Cuando pase la revisión, inicie una tarea por región en **Tasks**. Compruebe el nombre, el número de bandas, la máscara y los metadatos del asset.

## 6. Exportación

| Elemento | Valor |
| --- | --- |
| Destino | `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft/<region_id>-<output_version>` |
| Imagen | Bandas `classification_1985` a `classification_2025`, tipo `Byte` |
| Metadatos | `version` de la región y `step = 'remaped-by-variables'` |
| Región | `region.geometry().bounds()` |
| Escala | 30 m |
| Política de piramidación | `mode` |
| Límite de exportación | `maxPixels: 1e13` |

## 7. Ejemplos y control de calidad

En todos los ejemplos la clase de entrada es 3. Salvo donde se indica, el año es elegible y los demás criterios no se cumplen.

| Caso | Resultado esperado |
| --- | --- |
| Elevación 40 | 21, porque el umbral es inclusivo. |
| NDVI 10 000 dentro del polígono | 21. |
| NDVI 10 000 fuera del polígono | 3. |
| Dosel 5 | 21. |
| Elevación 20 en un año fuera de `remap_years` | 3. |
| Falta la banda de ese año en el asset | La banda de respaldo queda enmascarada en la salida. |

- Compare las bandas de la entrada y la máscara de salida para distinguir cambios de clase de observaciones NoData.
- Confirme que todos los cambios válidos ocurran en años seleccionados y correspondan a 3 → 21 con las reglas actuales. Para aislar el efecto de NDVI, revise píxeles que no cumplan elevación ni dosel y compare dentro y fuera del polígono.
- Cuantifique por año el área 3 → 21 y confróntela con los gráficos de superficie. Registre umbrales, años y versión por región.

## 8. Problemas frecuentes

| Síntoma | Qué revisar |
| --- | --- |
| Error de geometría durante **Run** | Compruebe `ee.Filter.bounds(region.vector)` y el recorte del dosel descritos arriba. |
| Falla la selección de una banda auxiliar | Compruebe que el mosaico anual tenga `ndvi_median` y las bandas RGB requeridas para la vista previa. |
| Se pierde cobertura de mosaicos al procesar varias regiones | Revise la reasignación de `mosaics` en la rama andina. |
| La regla NDVI no produce cambios | Compruebe el valor en la escala del asset, la clase de origen, el año y el `id` de la geometría. |
| Una banda anual se muestra vacía | Compruebe si faltaba en el input o si contenía solo valores enmascarados o `27`. |
| No se crea la tarea esperada | Revise las listas de regiones y versiones, los permisos y la carpeta de salida. |

## 9. Referencias

- [NASADEM en Earth Engine](https://developers.google.com/earth-engine/datasets/catalog/NASA_NASADEM_HGT_001) · [Rasterización de entidades](https://developers.google.com/earth-engine/apidocs/ee-featurecollection-reducetoimage)
- [Área de píxel](https://developers.google.com/earth-engine/apidocs/ee-image-pixelarea) · [Exportación a assets](https://developers.google.com/earth-engine/apidocs/export-image-toasset)
- [Guía del remapeo por año de referencia](./04-3-year-based-remaps.md)
