![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Volver al README](https://img.shields.io/badge/%E2%86%90%20Volver%20al%20README-gray?style=for-the-badge)](../README.md)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[Ver script (`05-2-download-images.js`)](../05-2-download-images.js) · [English version](./05-2-download-images.en.md)

# Manual de usuario de exportación de imágenes

MapBiomas Venezuela · Colección 4 · Manual 1.0

El script exporta bandas anuales de un asset de clasificación de Google Earth Engine a Google Drive. Cada año solicitado genera una tarea con una sola banda de IDs de clase en formato GeoTIFF.

## Contenido

- [1. Requisitos y entrada](#1-requisitos-y-entrada)
- [2. Parámetros](#2-parámetros)
- [3. Cómo se crean las tareas](#3-cómo-se-crean-las-tareas)
- [4. Extensión, cuadrícula y NoData](#4-extensión-cuadrícula-y-nodata)
- [5. Ejecución y revisión](#5-ejecución-y-revisión)
- [6. Problemas frecuentes](#6-problemas-frecuentes)
- [7. Referencias](#7-referencias)

## 1. Requisitos y entrada

- Acceso al [Code Editor de Google Earth Engine](https://code.earthengine.google.com/) y permisos de lectura sobre el asset.
- Una imagen multibanda que contenga `classification_<año>` para cada año solicitado.
- Acceso a Google Drive desde la cuenta que ejecuta las tareas y espacio para los archivos.

El ejemplo usa `projects/emanuel-valero/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft/92807-1`. Indique el ID completo de la clasificación y compruebe la región y la versión antes de crear las tareas.

## 2. Parámetros

| Parámetro | Valor del script | Efecto |
| --- | --- | --- |
| `asset_id` | Asset regional `classification-ft/92807-1` | Imagen de origen. |
| `years` | `[2000, 2005, 2020]` | Años que se exportan. Use años distintos si necesita tareas con nombres únicos. |
| `folder` | `'RAISG-EXPORT'` | Nombre de la carpeta en Google Drive, definido dentro de `Export.image.toDrive()`. |
| `scale` | `30` | Resolución solicitada en metros por píxel. |
| `crs` | `'EPSG:4326'` | Sistema de referencia de salida. |
| `maxPixels` | `1e13` | Límite de píxeles permitido por tarea. |
| `fileFormat` | `'GeoTIFF'` | Formato de salida. |

## 3. Cómo se crean las tareas

1. El script carga `image` y lee su propiedad `system:index` en `imagename`. Esta lectura usa `getInfo()` antes del bucle de exportación.
2. Para cada entrada en `years`, construye `bandname` con el prefijo `classification_` y selecciona esa banda. `byte()` convierte los IDs a enteros sin signo de 8 bits.
3. `Export.image.toDrive()` registra una tarea con la descripción `<system:index>-<año>`. Como el script omite `fileNamePrefix`, la descripción sirve de prefijo de archivo. [Referencia de exportación a Drive](https://developers.google.com/earth-engine/apidocs/export-image-todrive)

| Año | Banda | Descripción y prefijo si el índice es `92807-1` |
| --- | --- | --- |
| 2000 | `classification_2000` | `92807-1-2000` |
| 2005 | `classification_2005` | `92807-1-2005` |
| 2020 | `classification_2020` | `92807-1-2020` |

## 4. Extensión, cuadrícula y NoData

- La región solicitada es el rectángulo envolvente de la huella de la imagen, `image.geometry().bounds()`.
- `scale: 30` y `crs: 'EPSG:4326'` especifican una salida a escala nominal de 30 m sobre una cuadrícula geográfica. Verifique el CRS, el tamaño de celda y la alineación en el SIG si va a combinarla con otro raster. La alineación exacta con una grilla de referencia requiere configurar su CRS y su transformación afín en lugar de usar solo `scale`. [Guía de exportación y cuadrículas](https://developers.google.com/earth-engine/guides/exporting_images)
- El script exporta valores de clase y conserva la distinción entre una celda enmascarada y una celda válida con un valor como `27`. El código no define un valor NoData explícito para el GeoTIFF. Revise cómo interpreta la máscara el SIG de destino.
- `maxPixels` amplía el límite permitido de la tarea. La extensión y la escala determinan el tamaño del raster.

## 5. Ejecución y revisión

1. Abra el script y ajuste `asset_id` y `years`. Confirme los nombres de las bandas y el valor de `system:index`. Compruebe la carpeta de destino y el espacio disponible.
2. Pulse **Run**. Con el ejemplo deben aparecer tres tareas en **Tasks**. Revise la consola si la carga del asset o la creación de una tarea falla.
3. Inicie cada tarea por separado y compruebe su estado. Los fallos de procesamiento que ocurren después de iniciarla se consultan en **Tasks**.
4. Abra los archivos en Google Drive y revise en el SIG una banda por año, tipo `UInt8`, CRS, extensión, cuadrícula, máscara y valores de clase. Para una comprobación cuantitativa, compare histogramas o áreas por clase sobre una zona común y con una cuadrícula comparable.

## 6. Problemas frecuentes

| Síntoma | Qué revisar |
| --- | --- |
| Falla la carga de la imagen o de `system:index` | Revise ID, versión y permisos. La lectura del índice se ejecuta antes de crear las tareas. |
| Falta una banda anual | Compare `years` con los nombres de banda reales. |
| El nombre difiere del ID esperado | Inspeccione `system:index` y revise el prefijo de archivo mostrado en la tarea. |
| No encuentra el archivo en Drive | Compruebe que la tarea terminó y que está viendo la cuenta y carpeta correctas. Con carpetas homónimas, Earth Engine elige la modificada más recientemente. |
| El raster no coincide con la grilla de origen | Compruebe proyección, transformación y extensión. La salida se solicita en EPSG:4326. |
| Las áreas enmascaradas se muestran con un color inesperado | Revise la interpretación de la máscara y NoData en el SIG antes de reasignar valores. |

## 7. Referencias

- [Exportar imágenes](https://developers.google.com/earth-engine/guides/exporting_images)
- [`Export.image.toDrive()`](https://developers.google.com/earth-engine/apidocs/export-image-todrive)
