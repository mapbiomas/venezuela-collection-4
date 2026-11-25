![MapBiomas Venezuela](../../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Volver al README](https://img.shields.io/badge/%E2%86%90%20Volver%20al%20README-gray?style=for-the-badge)](../../#readme)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[Ver script (`04-3-year-based-remaps.js`)](../04-3-year-based-remaps.js) · [English version](../#readme)

# Manual de usuario del remapeo por año de referencia

MapBiomas Venezuela · Colección 4 · Serie 1985–2025 · Manual 1.0

El script usa la clasificación de un año base para localizar píxeles elegibles y remapea clases específicas en un intervalo de años. Con la configuración incluida, los píxeles de clase 3 en 2025 pueden pasar de 33 o 12 a 3 en años históricos.

| Entrada de ejemplo | Salida de ejemplo |
| --- | --- |
| `classification-ft/92809-4` | `classification-ft/92809-5` |

## Contenido

- [1. Requisitos y entrada](#1-requisitos-y-entrada)
- [2. Parámetros](#2-parámetros)
- [3. Cómo se aplica el remapeo](#3-cómo-se-aplica-el-remapeo)
- [4. Ejecución y visualización](#4-ejecución-y-visualización)
- [5. Exportación](#5-exportación)
- [6. Control de calidad y problemas frecuentes](#6-control-de-calidad-y-problemas-frecuentes)
- [7. Referencias](#7-referencias)

## 1. Requisitos y entrada

- Acceso al [Code Editor de Google Earth Engine](https://code.earthengine.google.com/), al proyecto indicado en `user` y al asset regional de entrada. La carpeta de salida debe existir y admitir escritura.
- Una clasificación con bandas `classification_<año>`. Confirme la banda del año base, las de los años que desea corregir y las solicitadas para la vista previa.
- Acceso al módulo `users/mapbiomas/modules:Palettes.js`, que proporciona `classification8` para la visualización.

La carpeta de entrada y salida es `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft`. Para usar un resultado del [remapeo por variables](../../04-2-variable-based-remaps-1/es/#readme) u otro paso de filtrado, seleccione la región y la versión efectivamente exportadas. El script usa la huella y las máscaras de esa clasificación. La variable `regions_path` está declarada pero el procesamiento no consulta ese vector.

## 2. Parámetros

| Parámetro | Valor del script | Efecto |
| --- | --- | --- |
| `user` | `'sig5-provita'` | Proyecto de entrada y salida. |
| `region` | `92809` | Prefijo del nombre de los assets. |
| `input_version` | `4` | Versión del asset de entrada. |
| `output_version` | `5` | Versión del asset corregido. Use un nombre disponible. |
| `base_year` | `2025` | Año de cuya banda original se obtiene la máscara de cada regla. |
| `year_range` | `[1985, 2024]` | Primer y último año que pueden editarse, ambos inclusive. |
| `class_changes` | `[[3, 33], [3, 12]]` | Pares `[clase_base, clase_histórica_a_reemplazar]`. |
| `preview_years` | `[1985]` | Años que se agregan al mapa para revisión. |

> [!IMPORTANT]
> En `class_changes`, el primer valor es la clase requerida en el año base y el valor que se escribe en la banda histórica. El segundo es la clase histórica que se busca. `[3, 33]` significa que **33 pasa a 3** cuando el píxel era 3 en el año base.

## 3. Cómo se aplica el remapeo

1. El script ordena los nombres de las bandas con `bandNames().sort()` y trae esa lista al cliente con `getInfo()`. Extrae el año del segundo componente del nombre, separado por `_`. La convención `classification_AAAA` permite ordenar las bandas cronológicamente. Las bandas auxiliares del asset también se recorren, de modo que conviene verificar el esquema antes de exportar.
2. Para cada banda dentro del intervalo, recorre `class_changes` en el orden configurado. Cada regla crea una máscara a partir de la clase de `base_year` en `classified_image`.
3. `where()` escribe la clase base donde coinciden esa máscara y el valor histórico indicado. Cada regla lee la banda histórica tal como la dejó la anterior. La clasificación original sigue proporcionando la máscara de referencia de todas las reglas. Las observaciones enmascaradas permanecen enmascaradas. [Sustitución condicional con `where()`](https://developers.google.com/earth-engine/apidocs/ee-image-where)
4. El script conserva las bandas fuera del intervalo y ensambla el resultado con los nombres de banda originales. En el ejemplo, la banda de 2025 queda fuera del intervalo de remapeo.

| Clase original en 2025 | Clase histórica dentro del intervalo | Resultado |
| --- | --- | --- |
| 3 | 33 | 3 |
| 3 | 12 | 3 |
| 3 | 21 | 21 |
| 21 | 33 | 33 |
| 3 | 3 | 3 |
| Enmascarada | 33 | 33 |

Por ejemplo, para un píxel con clase 3 en 2025, una secuencia histórica `21, 33, 12` pasa a `21, 3, 3`. La clase 21 queda fuera de las dos reglas configuradas.

## 4. Ejecución y visualización

1. Confirme `user`, `region` y las versiones. Inspeccione los nombres de banda de la entrada, incluido el año base.
2. Revise que el intervalo esté ordenado y que cada regla tenga los dos IDs de clase en el orden indicado. Seleccione años de vista previa, como los extremos del intervalo y algún año intermedio.
3. Pulse **Run**. Active `ORIGINAL <año>` y `MODIFIED <año>` y use **Inspector** para comparar los valores. Las capas se agregan apagadas inicialmente.
4. Verifique los cambios contra la máscara de la clase base y compare la distribución de áreas por clase. Cuando pase la revisión, inicie la tarea en **Tasks**.
5. Abra el asset exportado y compruebe que contiene las bandas esperadas y cubre la región prevista.

## 5. Exportación

| Elemento | Valor |
| --- | --- |
| Destino | `classification-ft/<region>-<output_version>` |
| Imagen | `result_image`, con las bandas ensambladas en orden por nombre |
| Geometría | `classified_image.geometry()` |
| Escala | 30 m |
| Política de piramidación | `mode` para todas las bandas |
| Límite de exportación | `maxPixels: 1e13` |

Para la configuración incluida, la tarea se llama `92809-5`. El script no fuerza un tipo de dato ni añade propiedades de versión, paso o año base a la exportación. Registre estos parámetros junto al nombre del asset para fines de trazabilidad.

## 6. Control de calidad y problemas frecuentes

- Para la configuración de ejemplo, confirme que los cambios queden dentro de 1985–2024, que las transiciones sean 33 → 3 o 12 → 3 y que todas ocurran sobre píxeles de clase 3 en la banda original de 2025.
- Compare cada año con la entrada. Una máscara de diferencias ayuda a ubicar los cambios y un resumen por par de clases ayuda a medir su efecto en superficie.
- Compruebe que el año base y los años fuera del intervalo conserven sus valores. Revise el píxel frente a evidencia temática auxiliar si necesita justificar el remapeo.

| Síntoma | Qué revisar |
| --- | --- |
| Falta `classification_2025` o una banda de vista previa | Compruebe el esquema del asset y los valores de `base_year` y `preview_years`. |
| Un año esperado no cambia | Compruebe el intervalo, el nombre de la banda y dónde coinciden la máscara base y la clase histórica. |
| Se corrige una superficie demasiado grande | Compare la extensión de la clase base y el área afectada por cada par antes de ajustar las reglas. |
| Los colores no corresponden a la leyenda | Verifique si la paleta `classification8` representa los IDs que usa el asset. |
| La exportación tiene una extensión inesperada | Inspeccione la geometría del asset de entrada, que define la extensión solicitada. |

## 7. Referencias

- [Selección de bandas](https://developers.google.com/earth-engine/apidocs/ee-image-select) · [Sustitución condicional](https://developers.google.com/earth-engine/apidocs/ee-image-where)
- [Exportar imágenes a assets](https://developers.google.com/earth-engine/apidocs/export-image-toasset)
- [Guía del mapa de transiciones](../../05-0-transition-map/es/#readme)
