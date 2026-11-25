![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Volver al README](https://img.shields.io/badge/%E2%86%90%20Volver%20al%20README-gray?style=for-the-badge)](../README.md)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[Ver script (`03-2-gapfill.js`)](../03-2-gapfill.js) · [English version](./03-2-gapfill.en.md)

# Manual de usuario: Relleno temporal de vacíos (Gap Fill)

**Script:** [`03-2-gapfill.js`](../03-2-gapfill.js) · **Serie:** 1985–2025 (41 años) · **Colección:** 4 · **Versión:** 1.0

> **Propósito:** Orientar la configuración, ejecución, inspección, control de calidad y exportación del filtro temporal que sustituye el valor 27 por clases válidas provenientes de años vecinos, mediante un relleno hacia atrás seguido de un relleno hacia adelante.

| Campo | Información |
| :--- | :--- |
| **Versión del manual** | 1.0 |
| **Fecha** | 17 de agosto de 2026 |
| **Cobertura temporal** | 1985–2025 (41 años) |
| **Proceso** | Gap Fill temporal de clasificación LULC |
| **Resolución de exportación** | 30 m (`Byte`) |
| **Configuración revisada** | `region_id = 92807`, `country = 'GUYANA'`, `input_version = '1'`, `output_version = '1'` |

---

## Control del documento

| Elemento | Descripción |
| :--- | :--- |
| **Título** | Manual de Usuario – Relleno temporal de vacíos (Gap Fill) |
| **Script base** | [`03-2-gapfill.js`](../03-2-gapfill.js) |
| **Colección** | MapBiomas Venezuela – Colección 4 |
| **Entrada** | `classification-single/<region_id>-<input_version>` |
| **Salida** | `classification-ft/<region_id>-<output_version>` |
| **Observaciones tratadas como vacíos** | Valores `27` y píxeles ya enmascarados |
| **Método** | Backward fill + forward fill con `ee.Image.unmask()` |
| **Producto** | Imagen multibanda anual con metadatos `version`, `country` y `step` |

> [!NOTE]
> Este manual documenta el comportamiento observable de [`03-2-gapfill.js`](../03-2-gapfill.js). Las funciones `getRegion()` y `getMapBiomasMosaics()` provienen del módulo externo `users/ejvalero/api:src/utils`; su implementación interna no está incluida en el archivo y no se reconstruye aquí.

---

## Contenido

- [1. Introducción y justificación](#1-introducción-y-justificación)
- [2. Objetivo, alcance y usuarios](#2-objetivo-alcance-y-usuarios)
- [3. Requisitos y datos de entrada](#3-requisitos-y-datos-de-entrada)
- [4. Conceptos fundamentales](#4-conceptos-fundamentales)
- [5. Arquitectura del script](#5-arquitectura-del-script)
- [6. Parámetros configurables](#6-parámetros-configurables)
- [7. Metodología del Gap Fill temporal](#7-metodología-del-gap-fill-temporal)
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
- [Anexo B. Diccionario de variables y funciones](#anexo-b-diccionario-de-variables-y-funciones)
- [Anexo C. Ejemplos de comportamiento temporal](#anexo-c-ejemplos-de-comportamiento-temporal)

### Convenciones de lectura

- Los nombres de variables, funciones, bandas, propiedades y assets se conservan tal como aparecen en el script.
- Un **vacío** es una observación enmascarada en la entrada o enmascarada antes del relleno por tener valor `27`.
- **Relleno hacia atrás** significa propagar una observación válida de un año posterior hacia años anteriores que estén vacíos.
- **Relleno hacia adelante** significa propagar una observación válida de un año anterior hacia años posteriores que sigan vacíos.
- El manual describe el comportamiento observable del código suministrado y separa claramente los controles recomendados de cualquier modificación futura del algoritmo.

---

## 1. Introducción y justificación

Las series anuales de cobertura y uso del suelo pueden contener años sin clasificación válida en determinados píxeles. En el script revisado, estos casos están codificados con el valor `27`. Si esos vacíos permanecen en la serie, pueden afectar filtros temporales posteriores, análisis de transiciones, cálculos de permanencia y la interpretación visual de la trayectoria de un píxel.

El script de Gap Fill transforma temporalmente el valor `27` en píxeles enmascarados y utiliza la información disponible en otros años para completar la serie. El procesamiento se realiza sobre una imagen multibanda anual de 1985 a 2025. Primero se ejecuta un relleno hacia atrás, de modo que un vacío pueda adoptar el valor válido del siguiente año disponible. Después se ejecuta un relleno hacia adelante para completar los vacíos que no pudieron resolverse desde el futuro, principalmente los situados al final de la serie.

Este procedimiento no evalúa la plausibilidad temática de un cambio ni aplica una regla ecológica entre clases. Su función es estrictamente completar ausencias temporales utilizando valores observados en la misma ubicación espacial en otros años. Por ello, el Gap Fill debe interpretarse como una etapa de continuidad de datos y no como un filtro de estabilidad o corrección temática.

### 1.1 ¿Qué problema resuelve?

- Eliminar discontinuidades de la serie causadas por el valor `27` cuando existe al menos una observación válida en otro año del mismo píxel.
- Propagar hacia el pasado una clase válida futura para resolver vacíos iniciales o internos.
- Propagar hacia el futuro una clase válida previa para resolver vacíos finales que permanecen después del primer paso.
- Mantener el orden anual de las 41 bandas y conservar las clases válidas originales sin sustituirlas.
- Generar una serie más completa para las etapas posteriores de filtrado temporal y análisis multitemporal.

> [!IMPORTANT]
> **Alcance metodológico:** El algoritmo rellena ausencia de información; no decide si una transición entre dos clases es correcta o incorrecta. Un cambio real presente en los datos válidos se conserva.

---

## 2. Objetivo, alcance y usuarios

### Objetivo general

Proporcionar una guía técnica y operativa para configurar, ejecutar, revisar y exportar el script de Gap Fill, comprendiendo cómo se enmascara el valor `27`, cómo actúan los recorridos temporal inverso y directo y qué controles deben aplicarse antes de utilizar el producto en etapas posteriores.

### Objetivos específicos

- Documentar los assets, años, versiones y parámetros empleados por el script.
- Explicar el uso de la máscara para convertir el valor `27` en ausencia temporal de datos.
- Describir la función `gap_fill()` y su uso dentro de `backward_fill()` y `forward_fill()`.
- Explicar la prioridad temporal implícita del algoritmo: futuro para vacíos resolubles en el primer paso y pasado para los vacíos restantes.
- Documentar la visualización comparativa ORIGINAL/FILLED y el mosaico Landsat de apoyo.
- Establecer controles de QA para cuantificar vacíos antes y después del procesamiento.
- Documentar la salida a Earth Engine Asset y la política de piramidación configurada.

### Usuarios previstos

Personal técnico de MapBiomas Venezuela que participe en la producción, filtrado temporal, revisión y control de calidad de las clasificaciones anuales, con conocimientos básicos o intermedios de Google Earth Engine y de series temporales raster.

---

## 3. Requisitos y datos de entrada

### 3.1 Requisitos operativos

- Acceso al Google Earth Engine Code Editor y al proyecto definido en `user`.
- Permiso de lectura sobre `classification-single` y sobre el asset de regiones de clasificación.
- Permiso de escritura sobre la colección `classification-ft`.
- Acceso a los mosaicos Landsat de Venezuela y Guyana utilizados únicamente para inspección visual.
- Acceso al módulo `users/ejvalero/api:src/utils` y a la paleta `users/mapbiomas/modules:Palettes.js`.
- La imagen de entrada debe contener las bandas `classification_1985` a `classification_2025` en orden cronológico para el flujo completo. El relleno usa posiciones de banda, mientras que la vista previa y los filtros posteriores usan sus nombres.

### 3.2 Imagen de clasificación de entrada

El asset de entrada se construye como `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-single/<region_id>-<input_version>`. En la configuración revisada, el nombre esperado es `92807-1`.

> [!IMPORTANT]
> El [clasificador](./03-0-classifier.md) exporta a `classification` por defecto y Gap Fill lee de `classification-single`. Si usa directamente la salida del clasificador, ajuste `input_path` a la carpeta que la contiene y haga coincidir `user`, `region_id` e `input_version` con el asset exportado.

```javascript
var input_name = region_id + '-' + input_version;
var input = ee.Image(input_path + '/' + input_name);
```

### 3.3 Región de clasificación

La región se obtiene con `functions.getRegion()` a partir del asset `ve-gu-regiones-clasificacion`, utilizando `gridcode` y `region_id`. Esta región controla la carga de mosaicos de apoyo y el contexto visual. La exportación, sin embargo, utiliza `input.geometry().bounds()` como región de salida.

### 3.4 Mosaicos de apoyo

Los mosaicos Landsat de Venezuela y Guyana se cargan únicamente con `swir1_median`, `nir_median` y `red_median`. Ambas colecciones se fusionan y se filtran por `season = "full"`. En regiones andinas de Venezuela se aplica un filtro especial; la región `92807` no pertenece a la lista `andean_region_ids` incluida en el script.

> [!NOTE]
> El Gap Fill se calcula exclusivamente a partir de la clasificación multibanda de entrada. Los mosaicos Landsat no participan en el cálculo del relleno; se emplean para la inspección visual de los años incluidos en `preview`.

---

## 4. Conceptos fundamentales

### 4.1 Máscara y valor 27

La instrucción `input.updateMask(input.neq(27))` enmascara el valor `27` en cada banda y conserva las máscaras existentes. Los valores sin máscara distintos de `27` permanecen disponibles. La operación `unmask()` de cada pasada puede rellenar ambos tipos de observación enmascarada.

```javascript
var masked_input = input.updateMask(input.neq(27));
```

### 4.2 `unmask()` como operador de relleno

La función `gap_fill()` utiliza `current_image.unmask(previous_image_filled)`. En posiciones donde `current_image` es válido, conserva su valor. Donde `current_image` está enmascarado, toma el valor y la máscara de `previous_image_filled`. Esta propiedad permite encadenar el relleno año a año.

### 4.3 Iteración acumulativa

El script utiliza `ee.List.iterate()` sobre índices de bandas. La función de iteración recibe el índice temporal actual y un diccionario que acumula `image_filled`. Después de cada paso, se añade la banda recién completada, que queda disponible como referencia para la iteración siguiente. Este diseño permite propagar un valor válido a través de varios años consecutivos de vacío.

### 4.4 Selección por índice de banda

Las funciones de relleno usan `select([0])`, `select([previous_year_index])` y listas de índices en vez de nombres de banda. Por tanto, el orden físico de las bandas de la imagen de entrada es una condición crítica: la posición 0 se interpreta como 1985, la posición 1 como 1986 y así sucesivamente hasta la posición 40 como 2025.

> [!CAUTION]
> **Compruebe el orden de las bandas.** El script procesa las primeras `years.length` posiciones. Si faltan bandas, la selección puede fallar. Las bandas desordenadas o adicionales entre las primeras 41 pueden provocar rellenos entre años incorrectos. Con la configuración por defecto, se omiten las bandas que siguen a la posición 40.

### 4.5 Diferencia entre Gap Fill y filtro temporal

Gap Fill conserva cada observación válida, aunque su clase difiera de las de ambos años vecinos. La propagación temporal solo se aplica a las observaciones enmascaradas.

---

## 5. Arquitectura del script

El flujo puede resumirse en diez bloques funcionales:

| Paso | Bloque | Función |
| :--- | :--- | :--- |
| 1 | Configuración | Define usuario, región, país, versiones, años y años de previsualización. |
| 2 | Rutas y módulos | Configura `classification-single`, `classification-ft`, regiones, mosaicos, paleta y utilidades. |
| 3 | Región y mosaicos | Carga la región y prepara los mosaicos de apoyo visual. |
| 4 | Entrada | Carga la imagen multibanda de clasificación. |
| 5 | Enmascaramiento | Convierte valor `27` en máscara mediante `updateMask(input.neq(27))`. |
| 6 | Backward fill | Invierte el orden de bandas y propaga valores válidos desde años posteriores hacia el pasado. |
| 7 | Forward fill | Recorre la serie normal y propaga valores previos para completar vacíos restantes. |
| 8 | Producto | Convierte a `Byte` y añade metadatos `version`, `country` y `step`. |
| 9 | QA visual | Compara mosaico, ORIGINAL y FILLED para años seleccionados. |
| 10 | Exportación | Exporta la imagen multibanda a `classification-ft` a 30 m. |

---

## 6. Parámetros configurables

Los valores siguientes corresponden al script suministrado y deben revisarse antes de procesar una nueva región o versión.

| Parámetro | Valor actual | Qué controla |
| :--- | :--- | :--- |
| `user` | `"emanuel-valero"` | Proyecto/usuario utilizado para las rutas de entrada y salida. |
| `region_id` | `92807` | Código de la región de clasificación. |
| `country` | `"GUYANA"` | Metadato `country` asignado al producto final. |
| `input_version` | `"1"` | Versión del asset en `classification-single`. |
| `output_version` | `"1"` | Versión del asset resultante en `classification-ft`. |
| `years` | `1985–2025` | Define la secuencia temporal esperada de 41 bandas. |
| `preview` | `1990, 1995, 2018, 2020` | Años mostrados en el mapa para inspección. |
| `regions_field` | `"gridcode"` | Campo usado para localizar `region_id`. |
| `input_path` | `.../classification-single` | Colección de imágenes de entrada. |
| `output_path` | `.../classification-ft` | Colección de salida del Gap Fill. |
| `rgb_combination` | `SWIR1, NIR, Red` | Combinación falsa color para mosaicos de apoyo. |
| `pyramidingPolicy` | `".default": "sample"` | Regla usada al construir niveles de menor resolución del asset. |
| `scale` | `30` | Resolución de exportación en metros. |
| `maxPixels` | `1e13` | Límite máximo permitido por la tarea de exportación. |

> [!NOTE]
> **Configuración territorial:** En el archivo revisado `country = "GUYANA"` y `region_id = 92807`. El valor `country` se incorpora como metadato; el procesamiento del Gap Fill depende de la imagen de entrada y no usa `country` para decidir qué píxeles rellenar.

---

## 7. Metodología del Gap Fill temporal

### 7.1 Construcción de la máscara de vacíos

El proceso comienza con `input.neq(27)`, que crea una imagen booleana por banda: `1` donde la clasificación es distinta de `27` y `0` donde es `27`. `updateMask()` aplica esta condición a `input`. El resultado `masked_input` conserva las clases válidas y deja los `27` como píxeles enmascarados.

### 7.2 Función genérica `gap_fill()`

`gap_fill()` recibe un índice temporal y un diccionario acumulador. Extrae la banda actual desde `image_base` y la banda previa ya rellenada desde `image_filled`. Después ejecuta `unmask()` para reemplazar los píxeles faltantes de la banda actual con la banda anterior del recorrido y agrega el resultado a `image_filled`.

```javascript
var current_image = image_base.select([ee.Number(current_year_index)]);
var previous_image_filled = image_filled.select([previous_year_index]);
var current_filled = current_image.unmask(previous_image_filled);
obj = obj.set('image_filled', image_filled.addBands(current_filled));
```

### 7.3 Primer paso: `backward_fill()`

`backward_fill()` invierte el orden de las bandas antes de iterar. En consecuencia, la primera banda del recorrido es 2025, la siguiente es 2024 y así sucesivamente hasta 1985. Para un año vacío, la "banda previa" dentro de este recorrido corresponde cronológicamente a un año posterior. Así, una clase válida futura puede propagarse hacia atrás a través de uno o varios años con valor `27`.

Al finalizar la iteración, el resultado se selecciona nuevamente en orden inverso para devolver las bandas a su secuencia cronológica original.

```javascript
image = image.select(years_index.reverse());
var last = image.select([0]);
var result = years_index.slice(1).iterate(gap_fill, {
    image_filled: last,
    image_base: image
});
return ee.Image(ee.Dictionary(result).get('image_filled'))
    .select(years_index.reverse());
```

> [!IMPORTANT]
> **Prioridad temporal:** Los vacíos internos y los vacíos al comienzo de la serie que tienen una observación válida en un año posterior se completan en este primer paso con la primera clase válida disponible hacia el futuro.

### 7.4 Segundo paso: `forward_fill()`

El resultado de `backward_fill()` pasa a `forward_fill()` sin invertir el orden. La iteración comienza en 1985 y avanza hasta 2025. Los píxeles que todavía estén enmascarados se completan con el último valor válido previamente acumulado.

Después del backward fill, los vacíos que normalmente permanecen son aquellos situados después de la última observación válida de un píxel. Por ello, el forward fill actúa principalmente sobre el extremo final de la serie.

```javascript
var backward_filled = backward_fill(masked_input);
var fully_filled = forward_fill(backward_filled);
```

### 7.5 ¿Qué ocurre con un píxel sin datos en los 41 años?

Si un píxel tiene valor `27` en todas las bandas, `masked_input` queda enmascarado en toda su trayectoria. `backward_fill()` no encuentra una clase válida que propagar y `forward_fill()` tampoco. El resultado continúa enmascarado. El script no aplica `fully_filled.unmask(27)` al final, por lo que ese caso no vuelve automáticamente al valor `27` en el producto exportado.

> [!WARNING]
> **NoData final:** No debe asumirse que todos los `27` originales terminarán convertidos en una clase. Un píxel sin ninguna observación válida permanece enmascarado en el producto final. Si la metodología exige conservar `27` como NoData explícito, esa decisión debe verificarse o implementarse de manera separada.

### 7.6 Conversión del resultado y metadatos

`fully_filled` se convierte a `Byte` y recibe tres propiedades: `version = output_version`, `country = country` y `step = "gap-fill"`. La conversión es adecuada para los IDs de clase de la leyenda utilizada, siempre que permanezcan dentro del rango de un byte sin signo.

---

## 8. Productos de salida

### 8.1 Imagen multibanda filtrada

El producto principal es una imagen multibanda que conserva la estructura anual de la entrada y reemplaza los gaps resolubles. En una entrada correctamente estructurada se esperan 41 bandas, correspondientes a 1985–2025.

| Componente | Descripción |
| :--- | :--- |
| **Bandas** | Serie anual esperada: `classification_1985` … `classification_2025`. |
| **Valores válidos** | Clases originales o clases propagadas temporalmente desde otro año. |
| **Vacíos persistentes** | Permanecen enmascarados si el píxel no presenta ninguna clase válida en toda la serie. |
| **Tipo** | `Byte`. |
| **Metadatos** | `version`, `country`, `step = "gap-fill"`. |
| **Destino** | `classification-ft/<region_id>-<output_version>`. |

### 8.2 Qué no produce el script

- No genera una banda indicando qué píxeles fueron modificados.
- No registra para cada píxel el año fuente utilizado para el relleno.
- No calcula estadísticas de cuántos gaps fueron completados por año.
- No aplica reglas de transición, permanencia o estabilidad temática.
- No exporta los mosaicos de apoyo ni las capas ORIGINAL/FILLED mostradas en el mapa.

> [!TIP]
> **Recomendación de trazabilidad:** Para QA avanzado puede ser útil producir, en un script complementario, una máscara por año de píxeles modificados y un resumen del número o porcentaje de gaps antes y después del filtro.

---

## 9. Visualización e inspección

La variable `preview` controla los años añadidos al mapa. En la configuración revisada se visualizan `1990`, `1995`, `2018` y `2020`. Para cada año se agregan tres capas: MOSAIC, ORIGINAL y FILLED.

| Capa | Contenido | Uso recomendado |
| :--- | :--- | :--- |
| `MOSAIC <año>` | Mosaico Landsat `SWIR1–NIR–Red`. | Contexto espectral y visual del año. |
| `ORIGINAL <año>` | `masked_input` para `classification_<año>`. | Identificar vacíos `27`, que aparecen enmascarados. |
| `FILLED <año>` | `filtered` para la misma banda. | Verificar qué vacíos fueron sustituidos y con qué clase. |

### 9.1 Orden recomendado de inspección

1. Active `ORIGINAL` y localice áreas transparentes que correspondían a valor `27`.
2. Active `FILLED` y confirme que esas áreas reciben una clase coherente con la trayectoria temporal y el paisaje circundante.
3. Use `MOSAIC` como apoyo, recordando que la clase rellenada puede provenir de un año posterior o anterior y no necesariamente del mosaico del año mostrado.
4. Compare varios años consecutivos alrededor de un gap para identificar qué observación fue propagada.
5. Revise por separado los extremos 1985 y 2025, donde la dirección de relleno es especialmente importante.

> [!NOTE]
> **Limitación del control `preview`:** La condición `all_bands.indexOf(selector)` verifica únicamente que el año pertenece a la lista `years`; no comprueba que la banda exista realmente en el asset de entrada. La existencia y el orden de las bandas deben verificarse en Console antes de ejecutar la exportación.

---

## 10. Procedimiento de ejecución

1. Abrir el script en el Earth Engine Code Editor y confirmar que `user` apunta al proyecto correcto.
2. Configurar `region_id` y `country` para la región que se procesará.
3. Confirmar `input_version` y verificar que existe `classification-single/<region_id>-<input_version>`.
4. Imprimir o inspeccionar `input.bandNames()` y confirmar 41 bandas en orden 1985–2025.
5. Revisar que el valor utilizado como ausencia de clasificación sea efectivamente `27` para este producto.
6. Confirmar `output_version` y que el asset de destino no produzca una colisión no deseada.
7. Revisar `preview` e incluir, si es necesario, años con gaps conocidos y ambos extremos de la serie.
8. Ejecutar el script y revisar `OUTPUT` en Console.
9. Inspeccionar las capas ORIGINAL y FILLED en los años de `preview`, utilizando el mosaico como contexto.
10. Aplicar controles cuantitativos de gaps antes/después cuando la región sea crítica o presente muchos NoData.
11. Revisar la Task creada por `Export.image.toAsset()`.
12. Iniciar la exportación solo después de completar el QA visual y lógico.
13. Al finalizar, abrir el asset `classification-ft` y confirmar bandas, metadatos, máscara y cobertura espacial.

---

## 11. Interpretación y uso del producto

### 11.1 Interpretación de una clase rellenada

Una clase presente en FILLED puede tener dos orígenes: ser el valor válido original de ese año o ser un valor heredado temporalmente. El script no añade una bandera que permita distinguir ambos casos en el producto final. Por ello, cuando se requiera trazabilidad píxel a píxel, debe conservarse también el asset original o generar una máscara de diferencias.

### 11.2 Vacíos internos

Cuando existe una observación válida después del gap, el backward fill la propaga hacia atrás. Por ejemplo, una trayectoria `3, 27, 27, 21` se transforma en `3, 21, 21, 21`. Los dos años vacíos adoptan la clase `21` porque es la primera clase válida encontrada al recorrer desde el futuro.

### 11.3 Vacíos iniciales

Una trayectoria `27, 27, 3, 3` se convierte en `3, 3, 3, 3`. El valor válido de 1987, en este ejemplo conceptual, se propaga hacia 1986 y 1985 durante `backward_fill()`.

### 11.4 Vacíos finales

Una trayectoria `3, 3, 27, 27` no puede resolver los últimos vacíos durante `backward_fill()`, ya que no existe información válida posterior. `forward_fill()` completa esos años utilizando la clase `3` del último año válido anterior.

### 11.5 Implicación metodológica de la prioridad hacia el futuro

En un gap situado entre dos clases diferentes, el algoritmo favorece la clase posterior. Por ejemplo, `3, 27, 21` se convierte en `3, 21, 21` y no en `3, 3, 21`. Esta regla es consecuencia del orden de ejecución `backward_fill()` → `forward_fill()`; no implica que la clase futura sea temáticamente más probable. Debe ser conocida por quienes interpreten el producto.

> [!IMPORTANT]
> **Interpretación clave:** Gap Fill no reconstruye el momento real del cambio dentro de un intervalo sin datos. Si dos observaciones válidas distintas rodean uno o varios años `27`, el código asigna esos años a la clase posterior.

---

## 12. Exportación y nomenclatura

La salida se exporta mediante `Export.image.toAsset()` como una tarea batch de Earth Engine. El nombre y el `assetId` se construyen a partir de `region_id` y `output_version`.

```javascript
var output_name = region_id + '-' + output_version;

Export.image.toAsset({
    image: filtered,
    description: output_name,
    assetId: output_path + '/' + output_name,
    pyramidingPolicy: { '.default': 'sample' },
    region: input.geometry().bounds(),
    scale: 30,
    maxPixels: 1e13
});
```

| Elemento | Valor en la configuración revisada |
| :--- | :--- |
| **Nombre de Task** | `92807-1` |
| **Destino** | `.../classification-ft/92807-1` |
| **Escala** | 30 m |
| **Región de exportación** | Bounds de la geometría de `input` |
| **Pyramiding policy** | `sample` |
| **maxPixels** | `1e13` |

### 12.1 Política de piramidación

El script utiliza `sample` para todas las bandas. En Earth Engine, `sample` y `mode` son opciones válidas para datos categóricos. `sample` toma un píxel de referencia al construir niveles de menor resolución, mientras que `mode` representa la clase más frecuente cuando existe una moda. La política afecta principalmente la representación y consulta a escalas más gruesas, no la clasificación a 30 m que se exporta como resolución base.

> [!NOTE]
> **Control de consistencia:** Mantenga la misma política entre regiones y versiones si el objetivo es que el comportamiento de visualización a escalas reducidas sea comparable. Si el estándar del flujo de MapBiomas Venezuela cambia a `mode`, documente explícitamente el cambio de versión.

---

## 13. Control de calidad recomendado

### 13.1 QA de la estructura de entrada

- Confirmar que `input` contiene exactamente las bandas anuales esperadas o, como mínimo, que sus primeras 41 posiciones corresponden inequívocamente a 1985–2025.
- Confirmar que las bandas están en orden cronológico ascendente.
- Confirmar que el NoData temático a rellenar es `27` y que `27` no representa una clase válida que deba conservarse.
- Comprobar que la geometría y máscara de `input` corresponden a la región correcta.
- Confirmar que `input_version` identifica la clasificación previa que debe filtrarse.

### 13.2 QA cuantitativo de gaps

- Calcular por año el número o superficie de píxeles con valor `27` antes del filtro.
- Calcular por año el número o superficie de píxeles que permanecen enmascarados después del filtro.
- Para localizar rellenos, compare las máscaras de banda de `masked_input` y `filtered` y cuente los píxeles que pasan de enmascarados a válidos. Compare los valores de clase donde ambas imágenes son válidas para comprobar que se conservaron las observaciones originales.
- Identificar píxeles sin ninguna observación válida en los 41 años, considerando las máscaras existentes y el valor `27`. Esos píxeles deberían permanecer enmascarados.
- Revisar si los gaps se concentran en bordes, escenas, zonas nubosas históricas o clases particulares.

### 13.3 QA temporal

- Seleccionar píxeles de prueba con vacíos internos, iniciales y finales y verificar manualmente el resultado esperado.
- En gaps rodeados por clases diferentes, confirmar que se entiende y acepta la prioridad de la clase futura.
- Revisar secuencias largas de `27`, porque una sola observación futura puede propagarse hacia varios años anteriores.
- Comparar la serie Gap Fill con la clasificación original antes de aplicar filtros temporales adicionales.
- No utilizar la ausencia de `27` como evidencia de mayor exactitud temática: el Gap Fill mejora completitud, no necesariamente exactitud.

### 13.4 QA del asset exportado

- Confirmar que el asset está almacenado en `classification-ft` y que su nombre corresponde a `<region_id>-<output_version>`.
- Confirmar tipo `Byte`, resolución de 30 m y metadatos `version`, `country` y `step`.
- Comprobar que no haya desplazamientos espaciales respecto al `input`.
- Inspeccionar el comportamiento de píxeles totalmente sin datos y verificar si la máscara final es la esperada.
- Revisar visualmente varios años no incluidos originalmente en `preview`.

---

## 14. Problemas frecuentes y soluciones

| Problema / síntoma | Causa probable | Acción recomendada |
| :--- | :--- | :--- |
| `Image.select: band pattern/index out of range` | La imagen tiene menos bandas de las esperadas o el orden no coincide con `years_index`. | Revisar `input.bandNames()`, número de bandas y orden temporal antes de procesar. |
| Años visualizados con error de banda inexistente | `preview` pertenece a `years`, pero el asset no contiene `classification_<año>`. | Verificar la existencia real de la banda; la condición `all_bands` no valida el asset. |
| Persisten zonas transparentes después del Gap Fill | El píxel no tiene ninguna observación válida en toda la serie o existe una máscara espacial previa. | Inspeccionar la trayectoria original y la máscara; decidir si debe permanecer enmascarado o volver explícitamente a `27`. |
| Un gap interno adopta la clase "posterior" y no la anterior | Es el comportamiento esperado del backward fill ejecutado primero. | Revisar la regla metodológica; cambiar el orden de filtros solo si la metodología lo exige y creando una nueva versión. |
| FILLED parece igual a ORIGINAL | Puede haber pocos vacíos elegibles en el año revisado. | Compare las máscaras de banda o revise años con más vacíos. |
| MOSAIC aparece vacío | No hay mosaicos para el año y la región seleccionados. | Verificar `mosaics.filterMetadata('year', 'equals', year)` y los assets de mosaicos. El relleno usa la imagen de clasificación. |
| Exportación excede límites o falla | Extensión grande, cuota o recursos insuficientes. | Revisar región, `maxPixels`, estado del proyecto y cuotas; ejecutar como batch y evitar cálculos de QA pesados simultáneos. |
| El asset de salida ya existe | `output_version` coincide con una salida previa y overwrite no está habilitado. | Incrementar `output_version` o gestionar explícitamente el asset anterior. |
| `country` no coincide con la región | `country` es un parámetro manual y no se deriva de `region_id`. | Corregir `country` antes de exportar para mantener metadatos confiables. |
| Resultado temporalmente extraño tras el filtro | Puede existir una secuencia larga de `27` entre dos clases distintas. | Inspeccionar la trayectoria original y recordar que el Gap Fill asigna la clase futura a los gaps internos. |

---

## 15. Buenas prácticas

- No modificar simultáneamente `input_version` y `output_version` sin registrar qué insumo produjo cada salida.
- Conservar siempre el asset `classification-single` original para trazabilidad y comparación.
- Validar `bandNames()` antes de ejecutar cualquier filtro basado en índices de banda.
- Mantener el valor `27` documentado como código de ausencia y verificar que no haya cambiado entre colecciones.
- Incluir en `preview` al menos un año temprano, uno medio y uno reciente, y añadir 1985/2025 cuando se investiguen problemas en los extremos.
- Cuantificar la reducción de gaps antes de aceptar la salida, especialmente en regiones con cobertura Landsat compleja.
- Registrar cualquier cambio en el orden backward → forward como una modificación metodológica mayor, porque cambia la asignación de gaps internos.
- Mantener las funciones `gap_fill()`, `backward_fill()` y `forward_fill()` separadas y documentadas para facilitar auditoría.
- Usar versiones nuevas en lugar de sobrescribir resultados validados.
- Aplicar después del Gap Fill los filtros temporales de estabilidad o plausibilidad que correspondan al flujo metodológico; no atribuir esas funciones al Gap Fill.

---

## 16. Referencias y recursos

- **Script fuente:** [`03-2-gapfill.js`](../03-2-gapfill.js)
- [Google Earth Engine – Code Editor](https://code.earthengine.google.com/)
- [`ee.Image.unmask`](https://developers.google.com/earth-engine/apidocs/ee-image-unmask)
- [`ee.Image.updateMask`](https://developers.google.com/earth-engine/apidocs/ee-image-updatemask)
- [`ee.List.iterate`](https://developers.google.com/earth-engine/apidocs/ee-list-iterate)
- [`ee.Image.select`](https://developers.google.com/earth-engine/apidocs/ee-image-select)
- [`Export.image.toAsset`](https://developers.google.com/earth-engine/apidocs/export-image-toasset)
- [Pyramiding policies / raster assets](https://developers.google.com/earth-engine/guides/image_upload)
- [MapBiomas Venezuela](https://venezuela.mapbiomas.org/)
- [Guía del filtro espacial](./03-3-spatial-filter.md)
- Cardille, Crowley, Saah & Clinton (eds.), 2024. *Cloud-Based Remote Sensing with Google Earth Engine*. [DOI: 10.1007/978-3-031-26588-4](https://doi.org/10.1007/978-3-031-26588-4)

---

## Anexo A. Guía rápida de ejecución

| Paso | Acción | Control |
| :--- | :--- | :--- |
| 1 | Entrada | Confirmar `classification-single/<region>-<input_version>`. |
| 2 | Estructura | Verificar 41 bandas y orden 1985→2025. |
| 3 | NoData | Confirmar que `27` es el código que debe rellenarse. |
| 4 | Configuración | Revisar `region_id`, `country` y `output_version`. |
| 5 | Preview | Seleccionar años con gaps conocidos y extremos temporales. |
| 6 | Ejecutar | Revisar `OUTPUT` y detectar errores de bandas. |
| 7 | Inspeccionar | Comparar ORIGINAL vs FILLED y usar MOSAIC como contexto. |
| 8 | QA | Cuantificar gaps antes/después y revisar píxeles totalmente enmascarados. |
| 9 | Exportar | Iniciar la Task a `classification-ft` a 30 m. |
| 10 | Validar | Abrir el asset final, revisar bandas, metadatos y cobertura. |

> [!CAUTION]
> **Regla de decisión rápida:** Si el asset no tiene exactamente el orden temporal esperado, no ejecute el Gap Fill hasta corregir o seleccionar explícitamente las bandas. Este script depende de índices posicionales.

---

## Anexo B. Diccionario de variables y funciones

### B.1 Variables principales

| Variable | Función |
| :--- | :--- |
| `user` | Proyecto/usuario que forma las rutas de assets. |
| `region_id` | Código de región usado por `functions.getRegion()`. |
| `country` | Texto incorporado como metadato del resultado. |
| `input_version` | Versión del producto `classification-single`. |
| `output_version` | Versión del producto `classification-ft`. |
| `years` | Lista JavaScript de 41 años, 1985–2025. |
| `preview` | Años mostrados para inspección. |
| `all_bands` | Nombres `classification_<año>` construidos desde `years`. |
| `years_index` | `ee.List` 0…40 utilizado para seleccionar bandas por posición. |
| `input` | Imagen multibanda original. |
| `masked_input` | Entrada con valor `27` convertido en máscara. |
| `backward_filled` | Resultado tras propagar valores desde años futuros hacia atrás. |
| `fully_filled` | Resultado después del segundo recorrido hacia adelante. |
| `filtered` | Producto `Byte` con metadatos, utilizado para visualizar y exportar. |
| `mosaics` | Colección fusionada de mosaicos Venezuela/Guyana para apoyo visual. |

### B.2 Funciones

| Función | Propósito |
| :--- | :--- |
| `gap_fill(current_year_index, obj)` | Operación elemental: completa la banda actual con la banda previamente rellenada y actualiza el acumulador. |
| `forward_fill(image)` | Recorre las bandas de 1985 a 2025 y completa vacíos con el último valor válido anterior. |
| `backward_fill(image)` | Invierte las bandas, recorre 2025 a 1985 y completa vacíos con el primer valor válido posterior; luego restaura el orden. |
| `functions.getRegion(...)` | Función externa del módulo `utils` que devuelve la región vectorial y su máscara raster. |
| `functions.getMapBiomasMosaics(...)` | Función externa que obtiene los mosaicos requeridos para visualización. |

### B.3 Metadatos de salida

| Propiedad | Valor | Interpretación |
| :--- | :--- | :--- |
| `version` | `output_version` | Versión del producto Gap Fill. |
| `country` | `country` | País declarado manualmente para el producto. |
| `step` | `"gap-fill"` | Identifica la etapa metodológica. |

---

## Anexo C. Ejemplos de comportamiento temporal

Los ejemplos siguientes utilizan series simplificadas para mostrar la lógica. El símbolo `27` representa el valor que el script enmascara antes de aplicar el Gap Fill.

| Serie original | Después de backward fill | Resultado final | Interpretación |
| :--- | :--- | :--- | :--- |
| `3, 27, 27, 21` | `3, 21, 21, 21` | `3, 21, 21, 21` | Los gaps internos reciben la primera clase válida futura. |
| `27, 27, 3, 3` | `3, 3, 3, 3` | `3, 3, 3, 3` | Los gaps iniciales se rellenan desde el futuro. |
| `3, 3, 27, 27` | `3, 3, gap, gap` | `3, 3, 3, 3` | Sin futuro válido, el forward fill completa el extremo final. |
| `3, 27, 21` | `3, 21, 21` | `3, 21, 21` | En un gap entre clases distintas, se prioriza la clase posterior. |
| `27, 27, 27, 27` | `gap, gap, gap, gap` | `gap, gap, gap, gap` | Sin ninguna observación válida, el píxel permanece enmascarado. |
| `3, 27, 27, 21, 27, 30` | `3, 21, 21, 21, 30, 30` | `3, 21, 21, 21, 30, 30` | Cada bloque interno adopta la próxima clase válida hacia el futuro. |

### C.1 Esquema conceptual

```text
ENTRADA (27 → máscara)
        |
        v
BACKWARD FILL: 2025 → 1985
  gap = siguiente valor válido en el tiempo
        |
        v
FORWARD FILL: 1985 → 2025
  gaps restantes = último valor válido previo
        |
        v
SALIDA classification-ft
```

### C.2 Preguntas de QA para una trayectoria

- ¿Cuántos años tenían valor `27` antes del filtro?
- ¿Existe una observación válida posterior al gap? Si sí, esa clase debería dominar el backward fill.
- ¿El gap está después de la última observación válida? Si sí, debería completarse en `forward_fill()`.
- ¿El píxel está vacío los 41 años? Si sí, debería permanecer enmascarado.
- ¿La clase rellenada crea una transición aparentemente extraña? Si ocurre, recordar que Gap Fill no evalúa plausibilidad temática y revisar el filtro temporal posterior.
