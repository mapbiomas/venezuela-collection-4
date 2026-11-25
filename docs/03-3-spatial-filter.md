![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Volver al README](https://img.shields.io/badge/%E2%86%90%20Volver%20al%20README-gray?style=for-the-badge)](../README.md)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[Ver script (`03-3-spatial-filter.js`)](../03-3-spatial-filter.js) · [English version](./03-3-spatial-filter.en.md)

# Manual de usuario del filtro espacial

MapBiomas Venezuela · Colección 4 · Serie 1985–2025 · Manual 1.0

El filtro reduce el ruido espacial de la clasificación anual. Selecciona píxeles en componentes pequeños y los sustituye por la clase más frecuente en su vecindad inmediata. Cada año se procesa de forma independiente.

| Entrada de ejemplo | Salida de ejemplo | Producto |
| --- | --- | --- |
| `classification-ft/92807-1` | `classification-ft/92807-2` | Imagen anual multibanda, `Byte`, 30 m |

## Contenido

- [1. Requisitos y entradas](#1-requisitos-y-entradas)
- [2. Parámetros](#2-parámetros)
- [3. Cómo funciona](#3-cómo-funciona)
- [4. Ejecución y revisión](#4-ejecución-y-revisión)
- [5. Exportación](#5-exportación)
- [6. Control de calidad](#6-control-de-calidad)
- [7. Problemas frecuentes](#7-problemas-frecuentes)
- [8. Ejemplos y referencia rápida](#8-ejemplos-y-referencia-rápida)
- [9. Referencias](#9-referencias)

## 1. Requisitos y entradas

- Acceso al [Code Editor de Google Earth Engine](https://code.earthengine.google.com/), al asset de clasificación regional y al proyecto definido en `user`. La carpeta de salida debe existir y admitir escritura.
- La imagen de entrada debe incluir las bandas `classification_1985` a `classification_2025` para la serie completa. Con los valores del script puede corresponder a la salida del [Gap Fill](./03-2-gapfill.md).
- Acceso al módulo `users/ejvalero/api:src/utils` y a `users/mapbiomas/modules:Palettes.js`, con la paleta `classification9`.
- Acceso al asset de regiones `projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion` y a los mosaicos Landsat usados en la vista previa.

Las rutas de entrada y salida comparten la carpeta `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft`. El nombre de cada asset sigue el patrón `<region_id>-<version>`.

`functions.getRegion()` busca la región por `gridcode`. Para la vista previa, el script fusiona las colecciones Landsat de Venezuela (`projects/mapbiomas-mosaics/assets/LANDSAT/LULC/VENEZUELA/mosaics-2`) y Guyana (`projects/nexgenmap/MapBiomas2/LANDSAT/GUYANA/mosaics-2`) y filtra por `season = 'full'`. En las regiones andinas configuradas conserva las teselas venezolanas identificadas como `ANDES` y las demás teselas venezolanas que intersectan la región. La máscara regional se aplica a los mosaicos para visualización. El filtro trabaja sobre la clasificación de entrada.

## 2. Parámetros

| Parámetro | Valor del script | Efecto |
| --- | --- | --- |
| `user` | `'emanuel-valero'` | Proyecto para construir las rutas de entrada y salida. |
| `region_id` | `92807` | Región de clasificación y prefijo de los nombres de asset. |
| `country` | `'GUYANA'` | Metadato del producto. Las colecciones de mosaicos se cargan con sus propios códigos de país. |
| `years` | 1985–2025 | Bandas anuales que se filtran y se incluyen en la salida. |
| `min_connected_pixels` | `5` | Umbral inclusivo. Un componente con valor de conectividad de cinco píxeles **sí** es elegible. |
| `eight_connected` | `true` | Solicita a `connectPixels()` vecindad de ocho conexiones, incluidas las diagonales. |
| `preview` | `[1986, 2011, 2015]` | Años que se agregan al mapa para revisión. |
| `input_version` | `'1'` | Sufijo del asset de entrada. |
| `output_version` | `'2'` | Sufijo del asset de salida. Elija un nombre disponible. |

Un umbral mayor puede intervenir componentes más grandes. Al comparar umbrales, registre las versiones y cuantifique los cambios por clase y año.

## 3. Cómo funciona

1. El módulo externo `functions.connectPixels(input, eight_connected)` devuelve la imagen que el script usa para seleccionar dos bandas por año. `classification_<año>` contiene la clasificación y `classification_<año>_connected` contiene el indicador de tamaño del componente conectado de la misma clase. La implementación de `connectPixels()` reside en el módulo externo.
2. `apply_spatial_filter()` calcula la moda de cada banda anual con `focal_mode(1, 'square', 'pixels')`. Con radio de un píxel, el kernel cuadrado abarca una ventana de 3 × 3.
3. El script enmascara la moda mediante `connected.lte(minConnectedPixels)`. `blend()` superpone esa moda sobre la clasificación original en las posiciones seleccionadas.
4. El filtro reúne las bandas anuales en el orden de `years`. La selección final de nombres elimina la banda auxiliar con la que se inicializa la imagen.

```javascript
var input_image = image.select('classification_' + year);
var connected = image.select('classification_' + year + '_connected');
var moda = input_image
    .focal_mode(1, 'square', 'pixels')
    .mask(connected.lte(min_connected_pixels));
var classification = input_image.blend(moda);
```

> [!IMPORTANT]
> La condición de reemplazo se aplica a todas las clases, incluida la 24. Revise los parches urbanos, cuerpos de agua pequeños, ríos, costas, minería y otras coberturas estrechas o fragmentadas para detectar pérdidas sistemáticas.

## 4. Ejecución y revisión

1. Abra el script en el Code Editor. Revise el proyecto, la región, las versiones y los permisos de los assets.
2. Confirme las bandas anuales, el umbral y la conectividad. Elija años de vista previa representativos.
3. Pulse **Run**. En el mapa, active `MOSAIC <año>` para ver el contexto Landsat en falso color (SWIR1, NIR y rojo).
4. Alterne `ORIGINAL <año>` y `FILLED <año>`, y use **Inspector** para comparar valores. `FILLED` es el resultado del filtro espacial. Las tres capas se agregan apagadas inicialmente.
5. Cuando el resultado pase los controles, inicie en **Tasks** la tarea `<region_id>-<output_version>`.
6. Abra el asset exportado y compruebe bandas, escala, tipo y metadatos antes de usarlo en el siguiente paso.

## 5. Exportación

| Elemento | Valor |
| --- | --- |
| Destino | `classification-ft/<region_id>-<output_version>` |
| Bandas y tipo | Una banda `classification_<año>` por año en `years`, en `Byte` |
| Metadatos | `version = output_version`, `country`, `step = 'spatial-filter'` |
| Región | `input.geometry().bounds()` |
| Escala | 30 m |
| Política de piramidación | `sample` para todas las bandas |
| Límite de exportación | `maxPixels: 1e13` |

La exportación guarda la clasificación. Las bandas de conectividad sirven como insumo interno. Examine también diferencias a escala nativa de 30 m, ya que la política `sample` determina cómo se construyen los niveles más gruesos del asset.

## 6. Control de calidad

- Compare `ORIGINAL` y `FILLED` por año. Para cuantificar el efecto, construya una máscara auxiliar con las posiciones en que difieren y calcule el número o porcentaje de píxeles modificados.
- Verifique que los cambios se concentren en los componentes seleccionados. Un píxel sin cambio puede pertenecer a un componente grande o tener una moda igual al valor original.
- Compare áreas antes y después por clase. Una matriz de reemplazos origen → destino permite identificar pérdidas sistemáticas de coberturas pequeñas.
- Inspeccione elementos lineales y límites entre clases con el mosaico Landsat. Revise la trayectoria de píxeles modificados para detectar saltos introducidos por el procesamiento independiente de cada año.
- Para evaluar un cambio de umbral, compare configuraciones como 3, 5 y 8 píxeles en regiones representativas y registre el resultado asociado a cada versión.

## 7. Problemas frecuentes

| Síntoma | Qué revisar |
| --- | --- |
| Error al seleccionar una banda `*_connected` | Inspeccione `connected_image.bandNames()` y confirme el contrato y los permisos del módulo externo. |
| Demasiados cambios o pérdida de elementos lineales | Compare la conectividad y la moda local en zonas afectadas. Evalúe un umbral menor con los mismos controles. |
| Cambia un parche de clase 24 | Compruebe el tamaño del componente y la moda. La clase 24 se evalúa con el mismo umbral. |
| El mosaico no aparece | Revise el año de `preview`, la disponibilidad de mosaicos, el filtro de temporada y la cobertura regional. |
| Hay diferencias al cambiar el zoom | Compare los datos a 30 m y revise los niveles construidos con la política `sample`. |
| Falla la exportación o ya existe el nombre | Revise permisos, carpeta de destino, extensión y disponibilidad del sufijo `output_version`. |

## 8. Ejemplos y referencia rápida

En esta ventana 3 × 3, la moda local es 3. El píxel central pasa de 21 a 3 si su banda de conectividad indica cinco píxeles o menos.

```text
3   3   3
3  21   3
3   3   3
```

| Caso | Resultado esperado |
| --- | --- |
| Un componente de tamaño 5, con moda local distinta | Se aplica la moda. El umbral incluye el valor 5. |
| Un componente de tamaño 6, con moda local distinta | Se conserva el valor original. |
| Un tramo estrecho de clase 11 rodeado por clase 3 | Puede cambiar allí donde cumpla el umbral y la moda sea 3. |
| Un componente pequeño cuya moda coincide con su clase | La comparación antes/después muestra el mismo valor. |

| Identificador | Función |
| --- | --- |
| `connected_image` | Entrada con bandas anuales de clasificación y sus bandas de conectividad. |
| `apply_spatial_filter()` | Calcula y superpone la moda por año, y reconstruye la serie. |
| `fully_filtered` | Resultado del filtro antes de la conversión y los metadatos. |
| `filtered` | Imagen `Byte` usada en la vista previa y en `Export.image.toAsset()`. |

## 9. Referencias

- [Filtro de moda focal](https://developers.google.com/earth-engine/apidocs/ee-image-focalmode) · [Superposición con `blend()`](https://developers.google.com/earth-engine/apidocs/ee-image-blend) · [Máscaras de imagen](https://developers.google.com/earth-engine/apidocs/ee-image-mask)
- [Exportación a assets](https://developers.google.com/earth-engine/apidocs/export-image-toasset) · [Política de piramidación](https://developers.google.com/earth-engine/guides/image_upload)
- [Siguiente guía del flujo: filtro temporal](./03-4-temporal-filter.md)
