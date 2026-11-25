![MapBiomas Venezuela](../../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Volver al README](https://img.shields.io/badge/%E2%86%90%20Volver%20al%20README-gray?style=for-the-badge)](../../#readme)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[Ver script (`05-0-transition-map.js`)](../05-0-transition-map.js) · [English version](../#readme)

# Manual de usuario del mapa de transiciones

MapBiomas Venezuela · Colección 4 · Serie 1985–2025 · Manual 1.0

El script resume los cambios de cobertura por píxel y evalúa sus transiciones con una matriz direccional de control de calidad (QA). Produce indicadores de la trayectoria, códigos de cambio año a año y diagnósticos QA para distintos intervalos.

| Entrada de ejemplo | Destino de los productos |
| --- | --- |
| `classification-ft/92426-11` | `GENERAL/transitions`, región `92426`, versión de salida `12` |

## Contenido

- [1. Requisitos y entradas](#1-requisitos-y-entradas)
- [2. Parámetros](#2-parámetros)
- [3. Indicadores generales y códigos](#3-indicadores-generales-y-códigos)
- [4. Control de calidad de transiciones](#4-control-de-calidad-de-transiciones)
- [5. Ejecución y visualización](#5-ejecución-y-visualización)
- [6. Exportaciones](#6-exportaciones)
- [7. Control de calidad y problemas frecuentes](#7-control-de-calidad-y-problemas-frecuentes)
- [8. Matriz QA completa](#8-matriz-qa-completa)
- [9. Referencias](#9-referencias)

## 1. Requisitos y entradas

- Acceso al [Code Editor de Google Earth Engine](https://code.earthengine.google.com/), al asset de clasificación regional y al proyecto indicado en `user`. Cree la carpeta `transitions` si hace falta y confirme permisos de escritura.
- Una clasificación anual con bandas `classification_1985` a `classification_2025` para la configuración incluida. Mantenga `years` en orden cronológico y sin saltos. Las exportaciones QA recorren años consecutivos y la vista previa de QA requiere también la banda de cinco años antes del año destino.
- Acceso a `users/ejvalero/api:src/utils`, a `users/mapbiomas/modules:Palettes.js` y a la colección de regiones `projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion`. La región se busca por `gridcode`.
- Acceso a los mosaicos Landsat de Venezuela y Guyana, que se cargan para la vista previa en falso color. El script combina los mosaicos de temporada `full` y aplica un filtro especial a la colección venezolana para las regiones andinas configuradas.

Las rutas comparten el prefijo `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL`. La clasificación se lee de `classification-ft/<region_id>-<input_version>`. El script selecciona las bandas anuales, convierte las observaciones enmascaradas dentro de la huella en `no_data`, aplica la máscara regional y usa la imagen resultante como `original`.

## 2. Parámetros

| Parámetro | Valor del script | Efecto |
| --- | --- | --- |
| `user` | `'sig3-provita'` | Proyecto para las rutas de assets. |
| `region_id`, `country` | `92426`, `'VENEZUELA'` | Región de análisis y metadato de país. |
| `input_version` / `output_version` | `11` / `12` | Versión leída y versión de los productos. |
| `years` | 1985–2025 | Bandas evaluadas y orden de comparación. |
| `no_data` | `27` | Clase que se excluye de las comparaciones de cambio generales. |
| `preview_years` | 2015–2025 | Años destino para capas individuales de cambio. |
| `qa_preview_year` | `2025` | Año destino de las vistas QA anual y de cinco años. |
| `native_preview` | `true` | Usa la proyección nativa y una agregación por moda para las capas de métricas que pasan por `get_preview()`. |
| `preview_max_pixels` | `65535` | Máximo de píxeles de entrada por píxel agregado en esa previsualización. |
| `max_transition_count_vis` / `max_transition_classes_vis` | `10` / `8` | Límites superiores de visualización. Los conteos exportados mantienen sus valores. |
| `qa_class_codes`, `qa_matrix` | 26 clases y 676 puntuaciones | Orden de los IDs y matriz de puntuaciones de origen a destino. |
| `include_qa_transition_code` | `true` | Agrega `qa_transition_code` a cada producto QA. |

Los interruptores de exportación y los nombres de salida figuran en [Exportaciones](#6-exportaciones).

## 3. Indicadores generales y códigos

El script alinea las bandas de origen y destino de cada par consecutivo. Para 1985–2025 hay 40 pares, desde 1985 → 1986 hasta 2024 → 2025. Un par es válido cuando ambas observaciones son distintas de `no_data`. Un cambio requiere además que sus clases sean distintas.

| Banda o capa | Interpretación |
| --- | --- |
| `transition_count` | Número de cambios válidos. |
| `transition_class_count` | Número de clases distintas presentes como origen o destino de al menos un cambio válido. Devuelve 0 cuando no hay cambios. |
| `valid_comparisons` | Número de pares válidos, tanto estables como con cambios. |
| `first_transition_year` | Año destino del primer cambio válido. Usa 0 cuando no hay cambios. |
| `last_transition_year` | Año destino del último cambio válido. Usa 0 cuando no hay cambios. |
| `last_change_year` | Mismo último año de cambio en un producto separado. Los píxeles sin cambios válidos quedan enmascarados. |
| `change_<origen>_<destino>` | Máscara de cambio binaria por par, utilizada en la vista previa. |
| `transition_<origen>_<destino>` | Código `origen × 100 + destino`, enmascarado fuera de los cambios válidos. |

Las primeras cinco bandas forman `transition_summary`. Para contar clases distintas, el script rellena temporalmente las posiciones sin cambio con una clase que ya participa en un cambio del mismo píxel. Esto evita que el relleno sume una clase al conteo.

El orden de los IDs importa. Un cambio 3 → 21 tiene código `321`, mientras que 21 → 3 tiene código `2103`.

## 4. Control de calidad de transiciones

### Puntuaciones y clases admitidas

La matriz es direccional. Cada fila representa la clase de origen y cada columna la de destino. El script busca la puntuación mediante el mismo cálculo `origen × 100 + destino`. Un par con una clase fuera de la matriz queda enmascarado en el resultado de la evaluación. La capa `CLASES FUERA DE MATRIZ QA` destaca esas posiciones para el par anual de vista previa. [Remapeo de valores en Earth Engine](https://developers.google.com/earth-engine/apidocs/ee-image-remap)

| Puntuación | Lectura |
| --- | --- |
| 0 | Sin problemas. |
| 1 | Esperado en la leyenda y el metadato anual. El metadato de 3 y 5 años lo etiqueta como `revisar`. |
| 2 | Sospechoso. |
| 3 | Altamente improbable. |

El QA contempla estabilidad y reconoce la clase NoData `27`. En la matriz incluida, 27 → 27 recibe 0 y los pares entre 27 y otra clase de la matriz reciben 1 en ambas direcciones. El código opcional `qa_transition_code` se calcula antes de buscar la puntuación. Puede mostrar un código en una posición donde el QA queda enmascarado por una clase sin entrada en la matriz.

### Diagnósticos por intervalo

| Banda | Cálculo |
| --- | --- |
| `qa_transition`, anual | Puntuación directa del año previo al año destino. |
| `qa_transition`, de 3 o 5 años | Puntuación directa entre los dos extremos con la misma matriz. |
| `qa_max_annual`, de 3 o 5 años | Mayor puntuación entre los pares anuales internos. Solo se conserva donde todos los pares pueden evaluarse con la matriz. |

Una ventana 1985 → 1988 incluye tres pares internos. Una ventana 1985 → 1990 incluye cinco. El QA entre extremos y el máximo anual responden preguntas distintas. Ambos pueden compararse aunque la clase del primer y último año coincida.

### Ejemplos

| Secuencia | Lectura |
| --- | --- |
| `3, 3, 21, 21` | Un cambio válido, dos clases involucradas y tres comparaciones válidas. |
| `3, 3, 27, 21, 21` | Dos comparaciones generales válidas y cero cambios válidos. El QA anual asigna 1 a los pares 3 → 27 y 27 → 21. |
| `3, 21, 3, 3` | La puntuación directa 3 → 3 es 0. El máximo de los tres pares internos es 2 porque 3 → 21 recibe 1, 21 → 3 recibe 2 y 3 → 3 recibe 0. |
| `3, 7, 3, 3` | Dos pares internos tienen una clase fuera de la matriz. La evaluación entre extremos da 0 y el máximo anual queda enmascarado. |

## 5. Ejecución y visualización

1. Confirme el asset de entrada, sus bandas, los IDs de la leyenda y la carpeta de salida. Seleccione años de vista previa y configure los interruptores según el producto requerido.
2. Pulse **Run**. Revise la consola, incluidos `ORIGINAL`, `TRANSITION SUMMARY`, `TRANSITION CODES` y `QA TRANSITIONS DEFINED`. Con la matriz incluida, la búsqueda contiene 676 pares.
3. En el mapa, revise `NÚMERO DE TRANSICIONES`, `NÚMERO DE CLASES`, el primer y el último año de cambio y la capa `REGIÓN`. Por año destino, compare `MOSAICO`, `CLASIFICACION ORIGINAL`, `CLASE ORIGEN`, `CLASE DESTINO` y `CAMBIO`. Las capas de origen, destino y cambio muestran los píxeles con transiciones válidas.
4. Active las capas de QA anual, `QA MÁXIMO ANUAL` y `CLASES FUERA DE MATRIZ QA`. Con los valores por defecto muestran, respectivamente, 2024 → 2025, el máximo de los pares entre 2020 y 2025 y las clases desconocidas del último par anual. El QA directo de cinco años se puede consultar en el producto que imprime la consola.
5. Revise una tarea de prueba en **Tasks** y compruebe sus bandas y metadatos antes de iniciar el lote.

Si el mapa alcanza el límite de píxeles de agregación con `native_preview` habilitado, acerque el zoom. Los límites de la leyenda controlan los colores y pueden saturar valores altos. Use **Inspector** o el asset para consultar el valor real.

## 6. Exportaciones

Todas las tareas escriben en `GENERAL/transitions` a 30 m, con `mode`, `maxPixels: 1e13` y los límites de la geometría de `region.vector`. En los nombres, `<R>` es la región, `<V>` la versión de salida y `<Y>` el año destino.

| Interruptor | Activo | Nombre del asset | Tareas para 1985–2025 | Bandas |
| --- | --- | --- | --- | --- |
| `export_summary` | Sí | `TRANSITIONS-SUMMARY-<R>-<V>` | 1 | 5, tipo `Float` |
| `export_last_change_year` | Sí | `LAST-CHANGE-YEAR-<R>-<V>` | 1 | 1, tipo `Int16` |
| `export_transition_codes` | Sí | `TRANSITIONS-CODES-<R>-<V>` | 1 | 40, tipo `Int16` |
| `export_qa_1_year` | Sí | `R<R>-QA-TRANSITION-<Y>` | 40 | Puntuación directa y código opcional |
| `export_qa_3_years` | No | `R<R>-QA-TRANSITION-3Y-<Y>` | 38 | Puntuación directa, máximo anual y código opcional |
| `export_qa_5_years` | No | `R<R>-QA-TRANSITION-5Y-<Y>` | 36 | Puntuación directa, máximo anual y código opcional |

Con los valores por defecto se crean 43 tareas. Si activa todas las familias se crean 117. Las puntuaciones QA se construyen en `Byte` y su código opcional en `Int16`. Las máscaras binarias de cambio y la capa de clases fuera de matriz son diagnósticos de inspección.

> [!IMPORTANT]
> Los nombres QA omiten `output_version`, aunque la propiedad `version` queda en el asset. Revise si el nombre ya existe y use una carpeta de salida distinta al conservar varias corridas. Los productos QA registran también los años, la duración del intervalo, el asset fuente, el de regiones y `system:time_start` al 1 de enero del año destino.

## 7. Control de calidad y problemas frecuentes

- Compruebe que `transition_count` no exceda `valid_comparisons`. Verifique la dirección de los códigos con uno o más pares cuyos valores pueda inspeccionar.
- En píxeles sin cambios, revise los ceros del resumen y la máscara de `last_change_year`. En los que cambian, confirme que el año corresponde al destino del par y que se cuentan solo las clases que participaron en cambios.
- Revise primero las puntuaciones 2 y 3, las discrepancias entre QA directo y máximo anual y las clases fuera de matriz. Una puntuación indica prioridad de revisión, no confirma por sí sola un error temático.
- Confirme los recuentos de bandas y tareas antes de exportar. Compare las propiedades de origen, fecha y versión del asset creado.

| Síntoma | Qué revisar |
| --- | --- |
| Falta una banda anual | Compruebe los nombres de banda y el intervalo requerido por la vista previa QA. |
| Una transición con 27 falta en los códigos generales | Use el producto QA si quiere evaluar ese par. Los indicadores generales requieren dos observaciones válidas. |
| Falta `qa_max_annual` en un píxel | Revise todos los pares internos de la ventana y compruebe si alguna clase queda fuera de la matriz. |
| Faltan capas para el primer año | El primer año de `years` carece de par anual previo para esta vista. |
| El mapa indica demasiados píxeles por píxel agregado | Acerque el zoom para la previsualización nativa. |
| Se repite un nombre de exportación QA | Revise el destino. Cambiar solo `output_version` conserva el mismo nombre QA. |

## 8. Matriz QA completa

Las tablas presentan las primeras y las últimas 13 columnas del orden `qa_class_codes`. Las filas de ambas tablas conservan el orden de origen del script.

### Clases destino 1–13

| Origen / destino | 3 | 4 | 5 | 6 | 11 | 12 | 29 | 32 | 66 | 50 | 13 | 81 | 82 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 3 | 0 | 1 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 4 | 1 | 0 | 2 | 2 | 1 | 1 | 2 | 2 | 1 | 2 | 2 | 2 | 2 |
| 5 | 2 | 2 | 0 | 1 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 |
| 6 | 1 | 2 | 1 | 0 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 11 | 2 | 1 | 2 | 1 | 0 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 1 |
| 12 | 2 | 1 | 2 | 2 | 1 | 0 | 2 | 2 | 1 | 1 | 1 | 2 | 2 |
| 29 | 2 | 2 | 2 | 2 | 2 | 2 | 0 | 2 | 2 | 2 | 1 | 1 | 2 |
| 32 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 0 | 2 | 2 | 3 | 2 | 2 |
| 66 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 2 | 0 | 1 | 3 | 2 | 2 |
| 50 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 1 | 0 | 3 | 2 | 2 |
| 13 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 3 | 3 | 3 | 0 | 3 | 3 |
| 81 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 3 | 0 | 1 |
| 82 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 3 | 1 | 0 |
| 15 | 2 | 1 | 2 | 2 | 1 | 1 | 2 | 3 | 3 | 3 | 1 | 3 | 3 |
| 18 | 2 | 1 | 2 | 2 | 1 | 1 | 2 | 3 | 3 | 3 | 1 | 3 | 3 |
| 21 | 2 | 1 | 2 | 2 | 1 | 1 | 2 | 2 | 1 | 1 | 1 | 1 | 1 |
| 9 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 23 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 3 | 2 | 2 |
| 24 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 30 | 3 | 2 | 3 | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 68 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 2 | 2 | 2 | 2 |
| 25 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 33 | 2 | 2 | 1 | 1 | 1 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 1 |
| 34 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 3 | 1 | 1 |
| 31 | 3 | 2 | 3 | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 2 |
| 27 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |

### Clases destino 14–26

| Origen / destino | 15 | 18 | 21 | 9 | 23 | 24 | 30 | 68 | 25 | 33 | 34 | 31 | 27 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 3 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 2 | 1 | 2 | 3 | 1 | 1 |
| 4 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 2 | 1 | 2 | 3 | 1 | 1 |
| 5 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 2 | 1 | 1 | 3 | 1 | 1 |
| 6 | 1 | 1 | 1 | 2 | 2 | 1 | 1 | 2 | 1 | 1 | 3 | 1 | 1 |
| 11 | 1 | 1 | 1 | 2 | 2 | 1 | 1 | 2 | 1 | 1 | 3 | 1 | 1 |
| 12 | 1 | 1 | 1 | 2 | 2 | 1 | 1 | 2 | 1 | 2 | 3 | 1 | 1 |
| 29 | 1 | 1 | 1 | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 3 | 1 | 1 |
| 32 | 3 | 3 | 1 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 3 | 1 | 1 |
| 66 | 3 | 3 | 1 | 2 | 2 | 1 | 1 | 2 | 1 | 2 | 3 | 1 | 1 |
| 50 | 3 | 3 | 1 | 2 | 2 | 1 | 1 | 2 | 1 | 2 | 3 | 1 | 1 |
| 13 | 1 | 1 | 1 | 2 | 3 | 1 | 1 | 2 | 1 | 2 | 3 | 3 | 1 |
| 81 | 3 | 3 | 1 | 2 | 2 | 1 | 1 | 2 | 1 | 2 | 3 | 1 | 1 |
| 82 | 3 | 3 | 1 | 2 | 2 | 1 | 1 | 2 | 1 | 1 | 3 | 1 | 1 |
| 15 | 0 | 0 | 0 | 1 | 3 | 1 | 1 | 2 | 1 | 2 | 3 | 3 | 1 |
| 18 | 0 | 0 | 0 | 1 | 3 | 1 | 1 | 2 | 1 | 2 | 3 | 3 | 1 |
| 21 | 0 | 0 | 0 | 1 | 2 | 1 | 1 | 2 | 1 | 2 | 3 | 1 | 1 |
| 9 | 1 | 1 | 1 | 0 | 2 | 1 | 1 | 2 | 1 | 2 | 3 | 2 | 1 |
| 23 | 3 | 3 | 1 | 2 | 0 | 1 | 1 | 1 | 1 | 1 | 3 | 1 | 1 |
| 24 | 2 | 2 | 2 | 2 | 3 | 0 | 1 | 3 | 1 | 2 | 3 | 2 | 1 |
| 30 | 2 | 2 | 2 | 2 | 2 | 1 | 0 | 1 | 1 | 1 | 3 | 2 | 1 |
| 68 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 0 | 1 | 1 | 3 | 1 | 1 |
| 25 | 1 | 1 | 1 | 2 | 2 | 1 | 1 | 2 | 0 | 1 | 3 | 1 | 1 |
| 33 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 1 | 1 | 0 | 3 | 1 | 1 |
| 34 | 3 | 3 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 0 | 2 | 1 |
| 31 | 3 | 3 | 1 | 2 | 2 | 1 | 1 | 2 | 1 | 1 | 3 | 0 | 1 |
| 27 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 |

## 9. Referencias

- [Remapear valores](https://developers.google.com/earth-engine/apidocs/ee-image-remap) · [Conteo de valores distintos](https://developers.google.com/earth-engine/apidocs/ee-reducer-countdistinct) · [Contar observaciones en una colección](https://developers.google.com/earth-engine/apidocs/ee-imagecollection-count)
- [Exportación a assets](https://developers.google.com/earth-engine/apidocs/export-image-toasset)
- [Exportación de bandas anuales de clasificación](../../05-2-download-images/es/#readme)
