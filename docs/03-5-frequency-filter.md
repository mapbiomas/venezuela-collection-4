![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Volver al README](https://img.shields.io/badge/%E2%86%90%20Volver%20al%20README-gray?style=for-the-badge)](../README.md)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[Ver script (`03-5-frequency-filter.js`)](../03-5-frequency-filter.js) · [English version](./03-5-frequency-filter.en.md)

# Manual de usuario del filtro temporal avanzado por frecuencia

MapBiomas Venezuela · Colección 4 · Serie 1985–2025 · Manual 1.0

El filtro identifica una clase candidata por píxel a partir de su frecuencia en toda la serie de clasificación. Aplica reglas distintas para clases naturales y antrópicas, conserva secuencias de oposición persistente y permite limitar las correcciones a años y áreas concretos.

| Entrada de ejemplo | Salida de ejemplo | Producto |
| --- | --- | --- |
| `classification-ft/92101-8` | `classification-ft/92101-9` | Imagen anual multibanda, `Byte`, 30 m |

## Contenido

- [1. Requisitos y entradas](#1-requisitos-y-entradas)
- [2. Parámetros y ámbito de aplicación](#2-parámetros-y-ámbito-de-aplicación)
- [3. Candidatura por frecuencia](#3-candidatura-por-frecuencia)
- [4. Reglas naturales y antrópicas](#4-reglas-naturales-y-antrópicas)
- [5. Tratamiento de NoData](#5-tratamiento-de-nodata)
- [6. Ejecución y diagnósticos](#6-ejecución-y-diagnósticos)
- [7. Exportación y metadatos](#7-exportación-y-metadatos)
- [8. Control de calidad y problemas frecuentes](#8-control-de-calidad-y-problemas-frecuentes)
- [9. Ejemplos y referencia rápida](#9-ejemplos-y-referencia-rápida)
- [10. Referencias](#10-referencias)

## 1. Requisitos y entradas

- Acceso al [Code Editor de Google Earth Engine](https://code.earthengine.google.com/), al asset regional y al proyecto indicado en `user`. La carpeta de salida debe existir y admitir escritura.
- La clasificación debe incluir una banda `classification_<año>` por cada año de `years`. Mantenga la lista en orden cronológico y sin saltos: las corridas se evalúan por posición de banda.
- Acceso a `users/ejvalero/api:src/utils`, a `users/mapbiomas/modules:Palettes.js` con la paleta `classification9` y al asset `projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion`. El script busca `region_id` por `gridcode`.
- Acceso a los mosaicos Landsat de Venezuela y Guyana para inspección visual. Se fusionan las colecciones de temporada `full` y, para regiones andinas configuradas, se aplica el filtro especial a la colección venezolana.

La carpeta de entrada y salida es `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft`. Si la entrada proviene del [filtro temporal](./03-4-temporal-filter.md), configure el proyecto, la región y la versión según el asset producido en ese paso.

El script selecciona las bandas anuales, asigna `27` a ausencias enmascaradas dentro de la huella de la imagen y aplica la máscara de la región. Esta clasificación normalizada, convertida a `Byte`, es `original` y sirve de referencia para las reglas y diagnósticos.

## 2. Parámetros y ámbito de aplicación

| Parámetro | Valor del script | Efecto |
| --- | --- | --- |
| `user` | `'mayerlings-488722'` | Proyecto para los assets de entrada y salida. |
| `region_id` | `92101` | Región de clasificación. |
| `country` | `'VENEZUELA'` | Metadato del producto. |
| `input_version` / `output_version` | `'8'` / `'9'` | Sufijos de los assets. |
| `years` | 1985–2025 | Serie completa usada para calcular la frecuencia, el inicio persistente y la oposición. |
| `apply_on_years` | `[]` | Años donde se permite escribir cambios. Una lista vacía habilita toda la serie. |
| `apply_on_region` | `[geometry]` | Geometrías o entidades que limitan los cambios a su unión dentro de la región. Una lista vacía habilita toda la región. |
| `preview` | `[1985, 2000, 2010, 2020, 2025]` | Años para inspección visual. |
| `no_data` | `27` | Valor excluido del recuento de observaciones válidas. |
| `max_noise_run` | `2` | Longitud máxima de un hueco interno en la corrección local. |
| `min_transition_run` | `3` | Longitud mínima de una corrida de oposición persistente. |
| `min_anthropic_persistence` | `3` | Años consecutivos de clase antrópica necesarios para establecer su inicio. |
| `protect_no_data` | `true` | Bloquea la estabilización amplia cuando hay NoData en el intervalo pertinente. |
| `no_onset` | `9999` | Valor interno para indicar que no se detectó un inicio persistente. |

La configuración actual permite correcciones en todos los años, dentro del polígono `geometry` incluido en el script y donde intersecte la región. Para usar toda la región, configure `apply_on_region = []`. Para elegir un intervalo de escritura, enumere sus años en `apply_on_years`.

> [!IMPORTANT]
> El ámbito de aplicación restringe dónde y cuándo se escribe la corrección. La candidatura, el inicio y la oposición se calculan sobre la serie completa. El asset sigue incluyendo todas las bandas y conserva los valores de `original` fuera del ámbito editable. La exportación utiliza los límites de la región de clasificación.

Antes de construir las reglas, el script valida que los umbrales de frecuencia sean numéricos y estén en `(0, 1]`, que cada ID de clase aparezca una sola vez y que los años de aplicación sean únicos y estén en `years`. Ambas listas de aplicación deben ser arreglos y la lista espacial no admite elementos vacíos. `min_transition_run` debe superar `max_noise_run`. Tanto `min_transition_run` como `min_anthropic_persistence` deben caber en la serie.

## 3. Candidatura por frecuencia

Para cada píxel, el script divide el número de años en que aparece una clase por el número de observaciones válidas. Por ejemplo, 28 años de una clase entre 40 observaciones válidas dan una frecuencia de 0,70. Los años NoData quedan fuera del denominador.

| Lista | Clases | Frecuencia mínima |
| --- | --- | --- |
| `natural_frequencies` | 3, 6, 66, 33, 50 | 0,70 para cada clase |
| `antropic_frequencies` | 24 | 0,60 |
| `antropic_frequencies` | 25 | 0,70 |
| `antropic_frequencies` | 30 | 0,90 |
| `antropic_frequencies` | 21 | 0,50 |

Solo pueden ser candidatas las clases configuradas. Si la frecuencia alcanza el umbral, la clase compite con las demás candidatas. Gana la frecuencia más alta. En un empate se conserva la primera regla en el orden de las listas, naturales primero. Si ninguna clase califica o el píxel carece de observaciones válidas, el candidato interno queda en `-1`. La candidatura indica qué regla puede aplicarse, incluso cuando el píxel termina sin cambios.

## 4. Reglas naturales y antrópicas

La **oposición persistente** es una corrida de al menos `min_transition_run` años válidos consecutivos distintos de la candidata. Esos años pueden tener clases diferentes entre sí. **Corrección local** significa rellenar un hueco de hasta `max_noise_run` observaciones válidas distintas de la candidata, delimitado a ambos lados por la propia candidata.

| Candidata | Condiciones | Corrección |
| --- | --- | --- |
| Natural | Sin oposición persistente y, si la protección está activa, sin NoData en la serie. | Estabiliza todos los años válidos y editables del píxel. Puede alcanzar años de los extremos. |
| Natural | Se detecta oposición persistente o NoData con protección activa. | Corrige únicamente huecos locales elegibles. |
| Antrópica | Hay inicio persistente, sin corridas de oposición iniciadas desde ese año y, si la protección está activa, sin NoData desde ese año. | Estabiliza los años válidos y editables desde el inicio. |
| Antrópica | Hay inicio persistente y se detecta oposición posterior o NoData posterior con protección activa. | Corrige únicamente huecos locales que empiezan en o después del inicio. |
| Antrópica | No hay inicio persistente. | Los valores del píxel se conservan. |

El **inicio persistente** de una clase antrópica es el primer año de la primera corrida de al menos `min_anthropic_persistence` observaciones consecutivas de esa clase. Los años anteriores a ese inicio conservan su clase de entrada. Las reglas evalúan las corridas y los huecos sobre `original`, usando comparaciones y máscaras multibanda.

## 5. Tratamiento de NoData

- En la clasificación normalizada, `27` se conserva como valor explícito dentro de la cobertura válida del raster. No aporta al denominador de frecuencia ni cuenta como oposición válida. Mantenga el valor de `no_data` fuera de las listas de clases candidatas.
- La corrección local exige que todas las posiciones del hueco sean válidas. Un hueco que contenga `27` queda fuera de esa corrección.
- Con `protect_no_data = true`, cualquier `27` impide la estabilización natural amplia. Para una candidata antrópica, se comprueba si hay `27` desde el inicio persistente en adelante.
- Con `protect_no_data = false`, la estabilización amplia puede corregir otras observaciones válidas. Las máscaras de escritura siguen excluyendo `27`, por lo que ese valor se conserva. Para propagar clases hacia ausencias temporales, consulte la guía de [Gap Fill](./03-2-gapfill.md).

## 6. Ejecución y diagnósticos

1. Compruebe el asset de entrada, el esquema de bandas, el proyecto, la región y las versiones. Revise la geometría y los años editables. Elija una versión de salida disponible.
2. Revise las listas de frecuencias y los parámetros de duración. Pulse **Run** y compruebe la consola, en particular `EDITABLE YEARS` y `APPLICATION MASK`.
3. En el mapa, revise `REGIÓN` y, si hay geometrías configuradas, `ÁREA DE APLICACIÓN`. Active los diagnósticos indicados abajo y use **Inspector** para revisar frecuencia, clase y cambios en píxeles de interés.
4. Compare la trayectoria completa del píxel en la clasificación original y la corregida. Revise las transiciones persistentes y los primeros años de clases antrópicas.
5. En **Tasks**, inicie la tarea `<region_id>-<output_version>` tras la revisión. Verifique el resultado y sus metadatos en **Assets**.

| Capa | Uso durante la revisión |
| --- | --- |
| `MOSAICO <año>` | Vista Landsat en falso color a partir de la mediana de los mosaicos de ese año. Si no hay mosaicos, la capa queda en blanco. |
| `ORIGINAL <año>` / `CORREGIDA <año>` | Comparación por año de la entrada normalizada y la salida. |
| `CAMBIOS <año>` | Resalta posiciones donde difieren ambas clasificaciones. |
| `NÚMERO DE AÑOS CORREGIDOS` | Cuenta, por píxel, las bandas modificadas. La capa enmascara el valor cero. |
| `CLASE DOMINANTE POR FRECUENCIA` | Clase candidata. La capa enmascara los píxeles sin candidata. |
| `FRECUENCIA CLASE DOMINANTE` | Frecuencia observada de la candidata. Puede consultarse fuera del polígono de aplicación, dentro de la clasificación regional. |

## 7. Exportación y metadatos

| Elemento | Valor |
| --- | --- |
| Destino | `classification-ft/<region_id>-<output_version>` |
| Imagen exportada | `corrected`, una banda `classification_<año>` por año, en `Byte` |
| Región | `region.vector.geometry().bounds()` |
| Escala | 30 m |
| Política de piramidación | `mode` para todas las bandas |
| Límite de exportación | `maxPixels: 1e13` |

El asset incluye `code_region`, `country`, `version`, `step = 'advanced-temporal-frequency'`, `implementation = 'multiband-vectorized'` y `descripcion = 'advanced temporal frequency filter'`. Los metadatos también registran `max_noise_run`, `min_transition_run`, `min_anthropic_persistence`, `protect_no_data`, `apply_on_years`, `editable_years` y `apply_on_region_count`. Las capas diagnósticas se revisan en el mapa y la consola. La tarea guarda la clasificación corregida.

## 8. Control de calidad y problemas frecuentes

- Compruebe las 41 bandas y sus nombres, el tipo `Byte`, los metadatos de alcance y los permisos del asset final.
- Verifique que los cambios se limiten a los años y la geometría editables. Compare contra `original`, que ya codifica ausencias enmascaradas como `27` dentro de la huella.
- Calcule el área modificada por año y por par de clases. Revise los píxeles con mayor número de correcciones, las frecuencias cercanas al umbral y las transiciones naturales y antrópicas sostenidas.
- Verifique la conservación de los valores `27`, las corridas de oposición persistente y las trayectorias previas al inicio antrópico. Pruebe cambios de parámetros de uno en uno y registre la configuración con la versión de salida.

| Síntoma | Qué revisar |
| --- | --- |
| La consola rechaza las reglas | Busque IDs duplicados, frecuencias fuera de rango y duraciones incompatibles. |
| La consola rechaza el ámbito | Compruebe que los años sean únicos y pertenezcan a `years`. Revise que las geometrías o entidades estén definidas. |
| No hay cambios dentro de una zona | Revise si coincide con la máscara de aplicación y si hay observaciones válidas y una clase candidata que habilite una corrección. |
| La candidata natural solo corrige huecos | Busque oposición persistente o NoData con protección activa. |
| La candidata antrópica no corrige o solo corrige huecos | Compruebe el inicio persistente, la oposición iniciada desde ese año y cualquier NoData posterior. |
| Se corrigen demasiados años | Revise qué candidatas activaron la estabilización amplia y compare trayectorias antes de ajustar umbrales. |
| Falla la exportación | Compruebe permisos, carpeta, extensión, cuotas y disponibilidad de la versión. |

## 9. Ejemplos y referencia rápida

Los ejemplos usan series abreviadas con los umbrales del script. Suponga que todos los años mostrados pueden editarse. El valor `27` representa NoData.

| Caso | Serie de entrada | Resultado |
| --- | --- | --- |
| Clase natural 3, frecuencia 4/5 | `3, 3, 21, 3, 3` | La estabilización amplia cambia 21 a 3. |
| Clase natural 3, oposición de tres años | `3, 3, 3, 21, 6, 21, 3, 3, 3, 3` | Se conserva la corrida `21, 6, 21`. La clase 3 alcanza 7/10 y la corrida cumple el mínimo de oposición. |
| Clase natural 3, NoData y hueco válido | `3, 3, 21, 3, 27, 3, 3` | La protección bloquea la estabilización amplia. El hueco con 21 cambia a 3 y se conserva 27. |
| Hueco que contiene NoData | `3, 3, 27, 21, 3, 3, 3` | Se conserva el hueco `27, 21` con la protección activa. |
| Clase antrópica 24 con inicio | `3, 3, 24, 24, 24, 21, 24, 24` | Se cambia 21 a 24 y se conservan los dos años anteriores al inicio. |
| Clase antrópica 24 con oposición posterior | `3, 24, 24, 24, 21, 6, 21, 24, 24, 24` | La clase 24 alcanza 6/10. Se conserva la corrida `21, 6, 21`. |
| Clase antrópica 24 sin inicio | `24, 24, 3, 24, 24, 3, 24, 24` | La clase 24 es candidata. Ninguna corrida llega a tres años y la serie se conserva. |

| Identificador | Función |
| --- | --- |
| `build_temporal_context()` | Prepara bandas alineadas, observaciones válidas y máscaras de NoData. |
| `build_application_context()` | Combina el ámbito espacial y los años editables en una máscara multibanda. |
| `get_frequency_candidate()` | Selecciona la candidata y su frecuencia relativa. |
| `apply_natural_frequency_rules()` / `apply_antropic_frequency_rules()` | Aplican la estabilización amplia o las correcciones locales. |
| `get_run_start_mask()`, `has_persistent_opposition()`, `get_persistent_onset()` | Detectan corridas consecutivas, oposición e inicio persistente. |
| `get_bounded_gap_correction_mask()` | Localiza huecos cortos de observaciones válidas delimitados por la candidata. |
| `corrected_years` | Resume el número de bandas modificadas por píxel. |

## 10. Referencias

- [Comparaciones y reducción de bandas](https://developers.google.com/earth-engine/apidocs/ee-image-reduce) · [Normalización de máscaras con `unmask()`](https://developers.google.com/earth-engine/apidocs/ee-image-unmask) · [Sustitución condicional con `where()`](https://developers.google.com/earth-engine/apidocs/ee-image-where)
- [Exportación a assets](https://developers.google.com/earth-engine/apidocs/export-image-toasset) · [Política de piramidación](https://developers.google.com/earth-engine/guides/image_upload)
