![MapBiomas Venezuela](../../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Volver al README](https://img.shields.io/badge/%E2%86%90%20Volver%20al%20README-gray?style=for-the-badge)](../../#readme)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[Ver script (`03-4-temporal-filter.js`)](../03-4-temporal-filter.js) · [English version](../#readme)

# Manual de usuario del filtro temporal

MapBiomas Venezuela · Colección 4 · Serie 1985–2025 · Manual 1.0

El filtro corrige interrupciones de uno a tres años dentro de una trayectoria por píxel. También corrige el primer y el último año cuando los dos años contiguos coinciden en una clase objetivo. Las reglas se ejecutan en secuencia y permiten restaurar años o coberturas de la clasificación original antes de exportar.

| Entrada de ejemplo | Salida de ejemplo | Producto |
| --- | --- | --- |
| `classification-ft/92807-1` | `classification-ft/92807-2` | Imagen anual multibanda, `Byte`, 30 m |

## Contenido

- [1. Requisitos y entradas](#1-requisitos-y-entradas)
- [2. Parámetros](#2-parámetros)
- [3. Reglas temporales y orden de ejecución](#3-reglas-temporales-y-orden-de-ejecución)
- [4. Restauración de años y clases](#4-restauración-de-años-y-clases)
- [5. Ejecución y visualización](#5-ejecución-y-visualización)
- [6. Exportación](#6-exportación)
- [7. Control de calidad y problemas frecuentes](#7-control-de-calidad-y-problemas-frecuentes)
- [8. Ejemplos y referencia rápida](#8-ejemplos-y-referencia-rápida)
- [9. Referencias](#9-referencias)

## 1. Requisitos y entradas

- Acceso al [Code Editor de Google Earth Engine](https://code.earthengine.google.com/), al asset regional de entrada y a la carpeta de salida con permisos de escritura.
- Una imagen con una banda `classification_<año>` por año. La configuración utiliza las 41 bandas de `classification_1985` a `classification_2025`. Mantenga `years` en orden cronológico, sin saltos, con al menos tres años.
- Acceso a `users/ejvalero/api:src/utils`, al módulo `users/mapbiomas/modules:Palettes.js` con la paleta `classification9` y al asset `projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion`, que identifica las regiones por `gridcode`.
- Acceso a los mosaicos Landsat de Venezuela y Guyana. Para la vista previa, el script combina la temporada `full` y muestra `swir1_median`, `nir_median` y `red_median` con la máscara regional. En las regiones andinas configuradas aplica el filtro especial a la colección venezolana. Las reglas temporales se calculan a partir de la clasificación.

La entrada y la salida están en `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft`. Si quiere usar el resultado del [filtro espacial](../../03-3-spatial-filter/es/#readme), configure `input_version` según la versión que realmente exportó y elija un `output_version` distinto y disponible. Los valores de ejemplo de ambos scripts apuntan al mismo nombre de salida.

## 2. Parámetros

| Parámetro | Valor del script | Efecto |
| --- | --- | --- |
| `user` | `'emanuel-valero'` | Proyecto usado para las rutas de assets. |
| `region_id` | `92807` | Región y prefijo del nombre de los assets. |
| `country` | `'GUYANA'` | Metadato del producto. |
| `years` | 1985–2025 | Serie anual evaluada por las reglas. |
| `preview` | `[1986, 2011, 2015, 2025]` | Años que aparecen en el mapa. Deben tener una banda en la serie. |
| `years_to_exclude` | `[2014]` | Años que se restauran desde la entrada al terminar las reglas. |
| `classes_to_exclude` | `[24]` | Posiciones que se restauran según su clase original. |
| `input_version` | `'1'` | Sufijo de la clasificación de entrada. |
| `output_version` | `'2'` | Sufijo de la clasificación filtrada. |
| `filter_execution` | Cinco reglas, en el orden indicado abajo | Orden de las ventanas y de las clases objetivo dentro de cada ventana. |

Use una lista vacía en `years_to_exclude` o `classes_to_exclude` para omitir la restauración correspondiente.

## 3. Reglas temporales y orden de ejecución

En los patrones, `A` es la clase objetivo de la regla y cada `X` es una observación distinta de `A`. Cuando hay varios `X`, estos pueden tener clases diferentes entre sí. Los ejemplos representan una sola regla y una sola clase objetivo.

| Orden | Regla | Patrón | Posiciones que pueden cambiar |
| --- | --- | --- | --- |
| 1 | `last3` | `… A A X → … A A A` | Último año de toda la serie. |
| 2 | `first3` | `X A A … → A A A …` | Primer año de toda la serie. |
| 3 | `middle3` | `A X A → A A A` | Interrupción interna de un año. |
| 4 | `middle4` | `A X X A → A A A A` | Interrupción interna de dos años. |
| 5 | `middle5` | `A X X X A → A A A A A` | Interrupción interna de tres años. |

Cada regla recorre las clases `[6, 9, 11, 13, 21, 24, 30, 3, 12, 33]` en ese orden. Cada clase opera sobre el resultado que dejó la anterior. Una corrección puede habilitar o impedir un patrón que se evalúa después. El orden no equivale a una prioridad fija de una clase sobre otra en todos los píxeles.

Para una clase y una regla interna dadas, los años se evalúan en paralelo sobre la misma imagen de entrada de esa pasada. `pad_image()` agrega tres bandas auxiliares con valor `9999` antes y después de la serie para resolver las selecciones fuera de rango. Las bandas auxiliares quedan fuera de la salida. Las reglas de los extremos modifican directamente la primera o la última banda.

> [!NOTE]
> Las ventanas sustituyen valores de clase que cumplen un patrón. El código no aplica la máscara NoData de [Gap Fill](../../03-2-gapfill/es/#readme) ni llama a `unmask()`. Un valor válido de banda igual a `27` puede coincidir con una posición `X`. Un píxel ya enmascarado no se rellena mediante `where()`.

## 4. Restauración de años y clases

1. `exclude_years()` sobrescribe las bandas indicadas con las bandas originales mediante `addBands()`. Con la configuración actual, el producto recupera `classification_2014` de la entrada.
2. Después, `exclude_covers()` enmascara la entrada según sus clases originales y la superpone sobre el resultado. Con `[24]`, se restaura el valor 24 en cada píxel-año originalmente de esa clase. Las asignaciones nuevas a 24 creadas por las ventanas pueden mantenerse.

> [!IMPORTANT]
> Ambas restauraciones se aplican después de todas las reglas. Las bandas de los años listados y los píxeles de las clases listadas participan en las ventanas y pueden influir en años vecinos antes de restaurarse.

## 5. Ejecución y visualización

1. Abra el script y configure `user`, `region_id`, `country` y las versiones. Compruebe el esquema de bandas del asset de entrada y la disponibilidad de la salida.
2. Revise `filter_execution`, las dos listas de restauración y los años de `preview`. Incluya los extremos de la serie si va a comprobar `first3` y `last3`.
3. Pulse **Run**. La consola imprime las listas de exclusión cuando se aplican. En el mapa, active `MOSAIC <año>`, `INPUT <año>` y `OUTPUT <año>` para comparar la señal Landsat y las dos clasificaciones. Las capas se agregan apagadas inicialmente.
4. Use **Inspector** para revisar antes y después. Compruebe la trayectoria completa en píxeles modificados y revise especialmente la banda excluida y las posiciones de la clase restaurada.
5. En **Tasks**, inicie la tarea con el nombre `<region_id>-<output_version>` y compruebe bandas, escala y metadatos del asset resultante.

## 6. Exportación

| Elemento | Valor |
| --- | --- |
| Destino | `classification-ft/<region_id>-<output_version>` |
| Bandas y tipo | Serie anual de clasificación, `Byte` |
| Metadatos | `version = output_version`, `country`, `step = 'temporal-filter'` |
| Región | `input.geometry().bounds()` |
| Escala | 30 m |
| Política de piramidación | `sample` para todas las bandas |
| Límite de exportación | `maxPixels: 1e13` |

La tarea exporta la clasificación final. Para auditar diferencias o áreas por clase y año, genere esos diagnósticos a partir de los assets de entrada y salida. Compare píxeles a 30 m cuando una diferencia de zoom pueda deberse a los niveles de pirámide.

## 7. Control de calidad y problemas frecuentes

- Confirme que la salida contiene las 41 bandas con la configuración completa. Compare `INPUT` y `OUTPUT` en 1985 y 2025 para revisar las reglas de extremo.
- Cuantifique los cambios por año y los reemplazos por par de clases. Revise si eventos reales de corta duración se están eliminando sistemáticamente.
- Compare la banda de salida de 2014 con la original y compruebe las posiciones originalmente de clase 24. Inspeccione también años vecinos, donde sí puede haber cambios.
- Pruebe el orden de las reglas con trayectorias sintéticas antes de cambiarlo. Registre el orden y las exclusiones junto a cada versión.

| Síntoma | Qué revisar |
| --- | --- |
| Falta una banda o falla una ventana | Compruebe `bandNames()`, el prefijo `classification_` y la continuidad de `years`. Revise también los años de vista previa y restauración. |
| Un año vecino a 2014 cambia | Busque el patrón en las ventanas. La restauración de 2014 se produce al final. |
| Aparece clase 24 en una posición nueva | Compruebe la regla que la asignó y la clase original de esa posición. |
| Cambia el resultado al reordenar clases | Compare las pasadas secuenciales y las trayectorias sintéticas. |
| La salida parece demasiado estable | Revise los patrones de dos y tres años, las clases afectadas y las transiciones visibles en los mosaicos. |
| Falta un mosaico o falla la exportación | Compruebe disponibilidad de mosaicos, permisos y versiones. La vista previa y la tarea de exportación se configuran por separado. |

## 8. Ejemplos y referencia rápida

| Caso | Entrada | Resultado de la regla |
| --- | --- | --- |
| `middle3` para 21 | `21, 3, 21` | `21, 21, 21` |
| `middle4` para 21, con clases intermedias distintas | `21, 3, 6, 21` | `21, 21, 21, 21` |
| `middle5` para 3 | `3, 21, 21, 21, 3` | `3, 3, 3, 3, 3` |
| `first3` para 3 | `6, 3, 3, …` | `3, 3, 3, …` |
| `last3` para 11 | `…, 11, 11, 6` | `…, 11, 11, 11` |
| Restauración de año | 2014 cambia durante una ventana | 2014 vuelve al valor de entrada después de las reglas. |
| Restauración de clase | Un píxel de 2010 era 24 y cambió durante una ventana | El píxel vuelve a 24 en 2010 después de las reglas. |

| Identificador | Función |
| --- | --- |
| `apply_filter()` | Ejecuta una ventana para cada clase de la lista ordenada. |
| `time_windows()` | Devuelve las cinco funciones de ventana. |
| `get_band()` y `pad_image()` | Seleccionan bandas por nombre y preparan el contexto de los extremos. |
| `exclude_years()` y `exclude_covers()` | Restauran bandas completas y valores de clases originales. |

## 9. Referencias

- [Sustitución condicional con `where()`](https://developers.google.com/earth-engine/apidocs/ee-image-where) · [Sobrescritura de bandas con `addBands()`](https://developers.google.com/earth-engine/apidocs/ee-image-addbands) · [Superposición con `blend()`](https://developers.google.com/earth-engine/apidocs/ee-image-blend)
- [Exportación a assets](https://developers.google.com/earth-engine/apidocs/export-image-toasset) · [Política de piramidación](https://developers.google.com/earth-engine/guides/image_upload)
- [Siguiente guía del flujo: filtro de frecuencia](../../03-5-frequency-filter/es/#readme)
