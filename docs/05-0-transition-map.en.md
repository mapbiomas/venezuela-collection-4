![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Back to README](https://img.shields.io/badge/%E2%86%90%20Back%20to%20README-gray?style=for-the-badge)](../README.md)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[View script (`05-0-transition-map.js`)](../05-0-transition-map.js) · [Versión en español](./05-0-transition-map.md)

# Transition Map User Manual

MapBiomas Venezuela · Collection 4 · 1985–2025 series · Manual 1.0

The script summarizes land-cover changes at each pixel and evaluates transitions using a directional quality-assurance (QA) matrix. It produces trajectory metrics, annual change codes, and QA diagnostics for several intervals.

| Example input | Product destination |
| --- | --- |
| `classification-ft/92426-11` | `GENERAL/transitions`, region `92426`, output version `12` |

## Contents

- [1. Requirements and inputs](#1-requirements-and-inputs)
- [2. Parameters](#2-parameters)
- [3. General metrics and codes](#3-general-metrics-and-codes)
- [4. Transition quality assurance](#4-transition-quality-assurance)
- [5. Execution and visualization](#5-execution-and-visualization)
- [6. Exports](#6-exports)
- [7. Quality checks and troubleshooting](#7-quality-checks-and-troubleshooting)
- [8. Full QA matrix](#8-full-qa-matrix)
- [9. References](#9-references)

## 1. Requirements and inputs

- Access to the [Google Earth Engine Code Editor](https://code.earthengine.google.com/), the regional classification asset, and the project set in `user`. Create the `transitions` folder if needed and confirm write access.
- An annual classification with bands `classification_1985` through `classification_2025` for the supplied configuration. Keep `years` in chronological order with no gaps. QA exports iterate over consecutive years, and the QA preview also requires the band five years before the destination year.
- Access to `users/ejvalero/api:src/utils`, `users/mapbiomas/modules:Palettes.js`, and the `projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion` region collection. The script looks up the region by `gridcode`.
- Access to the Venezuela and Guyana Landsat mosaics used for the false-color preview. The script combines the `full` season mosaics and applies a special filter to the Venezuela collection for the configured Andean regions.

Paths share the prefix `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL`. The script reads the classification from `classification-ft/<region_id>-<input_version>`. It selects annual bands, assigns `no_data` to masked observations within the footprint, applies the region mask, and uses the resulting image as `original`.

## 2. Parameters

| Parameter | Script value | Effect |
| --- | --- | --- |
| `user` | `'sig3-provita'` | Project for the asset paths. |
| `region_id`, `country` | `92426`, `'VENEZUELA'` | Analysis region and country metadata. |
| `input_version` / `output_version` | `11` / `12` | Input version and product version. |
| `years` | 1985–2025 | Bands to evaluate and comparison order. |
| `no_data` | `27` | Class excluded from general change comparisons. |
| `preview_years` | 2015–2025 | Destination years for individual change layers. |
| `qa_preview_year` | `2025` | Destination year for the annual and five-year QA previews. |
| `native_preview` | `true` | Uses the native projection and mode aggregation for metric layers that pass through `get_preview()`. |
| `preview_max_pixels` | `65535` | Maximum input pixels per aggregated pixel in that preview. |
| `max_transition_count_vis` / `max_transition_classes_vis` | `10` / `8` | Upper display limits. Exported counts keep their actual values. |
| `qa_class_codes`, `qa_matrix` | 26 classes and 676 scores | Class order and matrix of origin-to-destination scores. |
| `include_qa_transition_code` | `true` | Adds `qa_transition_code` to each QA product. |

See [Exports](#6-exports) for the export switches and output names.

## 3. General metrics and codes

The script aligns the origin and destination bands of each consecutive pair. The 1985–2025 series yields 40 pairs, from 1985 → 1986 through 2024 → 2025. A pair is valid when both observations differ from `no_data`. A change additionally requires their classes to differ.

| Band or layer | Interpretation |
| --- | --- |
| `transition_count` | Number of valid changes. |
| `transition_class_count` | Number of distinct classes involved as the origin or destination of at least one valid change. Returns 0 when there are no changes. |
| `valid_comparisons` | Number of valid pairs, including stable pairs and changes. |
| `first_transition_year` | Destination year of the first valid change. Uses 0 when there are no changes. |
| `last_transition_year` | Destination year of the last valid change. Uses 0 when there are no changes. |
| `last_change_year` | Same last change year as a separate product. Pixels without valid changes are masked. |
| `change_<origin>_<destination>` | Binary change mask for each pair, used in preview layers. |
| `transition_<origin>_<destination>` | Code `origin × 100 + destination`, masked outside valid changes. |

The first five bands form `transition_summary`. For the distinct-class count, the script temporarily fills positions without a change with a class already involved in a change at that pixel. This prevents the filler from adding a class to the count.

The class order matters. A change from 3 to 21 has code `321`, while 21 to 3 has code `2103`.

## 4. Transition quality assurance

### Scores and supported classes

The matrix is directional. Each row represents the origin class and each column the destination class. The script looks up the score using the same `origin × 100 + destination` calculation. If either class is missing from the matrix, the score is masked. The `CLASES FUERA DE MATRIZ QA` layer highlights those positions for the annual preview pair. [Remapping values in Earth Engine](https://developers.google.com/earth-engine/apidocs/ee-image-remap)

| Score | Interpretation |
| --- | --- |
| 0 | No issues. |
| 1 | `Esperado` (expected) in the legend and annual metadata. The three- and five-year metadata call it `revisar` (review). |
| 2 | Suspicious. |
| 3 | Highly unlikely. |

QA includes stable pairs and recognizes NoData class `27`. In the supplied matrix, 27 → 27 scores 0, and pairs between 27 and another class in the matrix score 1 in either direction. The optional `qa_transition_code` is calculated before score lookup. It can have a code at a position where QA is masked because a class has no matrix entry.

### Diagnostics by interval

| Band | Calculation |
| --- | --- |
| Annual `qa_transition` | Direct score from the preceding year to the destination year. |
| Three- or five-year `qa_transition` | Direct score between the two endpoints using the same matrix. |
| Three- or five-year `qa_max_annual` | Highest score among the consecutive annual pairs in the window. Output is retained only where every pair can be scored using the matrix. |

A 1985 → 1988 window has three internal pairs. A 1985 → 1990 window has five. Endpoint QA and the maximum annual QA answer different questions. They can be compared even when the first and last years have the same class.

### Examples

| Sequence | Interpretation |
| --- | --- |
| `3, 3, 21, 21` | One valid change, two classes involved, and three valid comparisons. |
| `3, 3, 27, 21, 21` | Two valid general comparisons and zero valid changes. Annual QA scores 3 → 27 and 27 → 21 as 1. |
| `3, 21, 3, 3` | The direct score for 3 → 3 is 0. The maximum of the three internal scores is 2 because 3 → 21 scores 1, 21 → 3 scores 2, and 3 → 3 scores 0. |
| `3, 7, 3, 3` | Two internal pairs involve a class outside the matrix. The endpoint score is 0 and the maximum annual score is masked. |

## 5. Execution and visualization

1. Check the input asset, bands, legend IDs, and output folder. Select preview years and set the export switches for the required products.
2. Select **Run**. Check the Console, including `ORIGINAL`, `TRANSITION SUMMARY`, `TRANSITION CODES`, and `QA TRANSITIONS DEFINED`. With the supplied matrix the lookup contains 676 pairs.
3. In the map, check `NÚMERO DE TRANSICIONES` (change count), `NÚMERO DE CLASES` (classes involved), the first and last change years, and `REGIÓN`. For each destination year, compare `MOSAICO`, `CLASIFICACION ORIGINAL`, `CLASE ORIGEN`, `CLASE DESTINO`, and `CAMBIO`. The origin, destination, and change layers show pixels with valid changes.
4. Turn on the annual QA, `QA MÁXIMO ANUAL`, and `CLASES FUERA DE MATRIZ QA` layers. By default these show 2024 → 2025, the maximum for annual pairs between 2020 and 2025, and unknown classes for the last annual pair. The direct five-year QA is available in the product printed to the Console.
5. Review a trial task under **Tasks** and check its bands and metadata before starting the batch.

If the map reaches its aggregation pixel limit with `native_preview` enabled, zoom in. Legend limits control colors and can saturate high values. Use the **Inspector** or the asset to check the actual value.

## 6. Exports

All tasks export to `GENERAL/transitions` at 30 m, with `mode`, `maxPixels: 1e13`, and the bounds of the `region.vector` geometry. In the names, `<R>` is the region, `<V>` is the output version, and `<Y>` is the destination year.

| Switch | Enabled | Asset name | Tasks for 1985–2025 | Bands |
| --- | --- | --- | --- | --- |
| `export_summary` | Yes | `TRANSITIONS-SUMMARY-<R>-<V>` | 1 | 5, `Float` |
| `export_last_change_year` | Yes | `LAST-CHANGE-YEAR-<R>-<V>` | 1 | 1, `Int16` |
| `export_transition_codes` | Yes | `TRANSITIONS-CODES-<R>-<V>` | 1 | 40, `Int16` |
| `export_qa_1_year` | Yes | `R<R>-QA-TRANSITION-<Y>` | 40 | Direct score and optional code |
| `export_qa_3_years` | No | `R<R>-QA-TRANSITION-3Y-<Y>` | 38 | Direct score, annual maximum, and optional code |
| `export_qa_5_years` | No | `R<R>-QA-TRANSITION-5Y-<Y>` | 36 | Direct score, annual maximum, and optional code |

The default settings create 43 tasks. Enabling every family creates 117. QA scores are built as `Byte` bands and the optional code as `Int16`. The binary change masks and out-of-matrix layer are inspection diagnostics.

> [!IMPORTANT]
> QA names omit `output_version`, although the asset stores the `version` property. Check for an existing name and use a separate output folder when retaining multiple runs. QA products also record the years, interval length, source asset, region asset, and `system:time_start` on January 1 of the destination year.

## 7. Quality checks and troubleshooting

- Confirm that `transition_count` is no greater than `valid_comparisons`. Verify code direction using one or more pairs whose values you can inspect.
- For pixels without changes, check the zero values in the summary and the `last_change_year` mask. For changed pixels, check that the reported year is the pair's destination and that only classes involved in changes count.
- Review scores of 2 and 3, differences between endpoint QA and annual maximum, and classes outside the matrix. A score indicates inspection priority and does not establish a thematic error on its own.
- Confirm band and task counts before export. Check the source, date, and version properties on the resulting asset.

| Symptom | What to check |
| --- | --- |
| An annual band is missing | Check the band names and the interval required by the QA preview. |
| A transition involving 27 is missing from the general codes | Use the QA product to evaluate that pair. General metrics require two valid observations. |
| A pixel has no `qa_max_annual` | Check all internal pairs in the window for a class outside the matrix. |
| The first year has no preview layers | The first year in `years` has no preceding annual pair for this preview. |
| The map reports too many inputs per aggregated pixel | Zoom in for the native-resolution preview. |
| A QA export name is duplicated | Check the destination. Changing only `output_version` keeps the same QA name. |

## 8. Full QA matrix

The tables show the first and last 13 columns in `qa_class_codes` order. Both tables keep the source script's row order for origin classes.

### Destination classes 1–13

| From vs. to | 3 | 4 | 5 | 6 | 11 | 12 | 29 | 32 | 66 | 50 | 13 | 81 | 82 |
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

### Destination classes 14–26

| From vs. to | 15 | 18 | 21 | 9 | 23 | 24 | 30 | 68 | 25 | 33 | 34 | 31 | 27 |
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

## 9. References

- [Remapping values](https://developers.google.com/earth-engine/apidocs/ee-image-remap) · [Counting distinct values](https://developers.google.com/earth-engine/apidocs/ee-reducer-countdistinct) · [Counting observations in a collection](https://developers.google.com/earth-engine/apidocs/ee-imagecollection-count)
- [Exporting to assets](https://developers.google.com/earth-engine/apidocs/export-image-toasset)
- [Exporting annual classification bands](./05-2-download-images.en.md)
