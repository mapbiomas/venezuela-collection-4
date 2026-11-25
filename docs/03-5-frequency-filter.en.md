![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Back to README](https://img.shields.io/badge/%E2%86%90%20Back%20to%20README-gray?style=for-the-badge)](../README.md)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[View script (`03-5-frequency-filter.js`)](../03-5-frequency-filter.js) · [Versión en español](./03-5-frequency-filter.md)

# Advanced Temporal Frequency Filter User Manual

MapBiomas Venezuela · Collection 4 · 1985–2025 series · Manual 1.0

The filter identifies a candidate class for each pixel based on its frequency across the full classification series. It applies different rules to natural and anthropic classes, preserves runs of persistent opposition, and can restrict corrections to selected years and areas.

| Example input | Example output | Product |
| --- | --- | --- |
| `classification-ft/92101-8` | `classification-ft/92101-9` | Annual multiband image, `Byte`, 30 m |

## Contents

- [1. Requirements and inputs](#1-requirements-and-inputs)
- [2. Parameters and correction scope](#2-parameters-and-correction-scope)
- [3. Frequency candidate selection](#3-frequency-candidate-selection)
- [4. Natural and anthropic rules](#4-natural-and-anthropic-rules)
- [5. NoData handling](#5-nodata-handling)
- [6. Execution and diagnostics](#6-execution-and-diagnostics)
- [7. Export and metadata](#7-export-and-metadata)
- [8. Quality control and troubleshooting](#8-quality-control-and-troubleshooting)
- [9. Examples and quick reference](#9-examples-and-quick-reference)
- [10. References](#10-references)

## 1. Requirements and inputs

- Access to the [Google Earth Engine Code Editor](https://code.earthengine.google.com/), the regional asset, and the project set in `user`. The output folder must exist and be writable.
- The classification must contain one `classification_<year>` band for each year in `years`. Keep the list in chronological order with no gaps, since runs are evaluated by band position.
- Access to `users/ejvalero/api:src/utils`, `users/mapbiomas/modules:Palettes.js` with the `classification9` palette, and the `projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion` asset. The script looks up `region_id` by `gridcode`.
- Access to the Venezuela and Guyana Landsat mosaics for visual inspection. The script merges the `full` season collections and applies a special filter to the Venezuela collection for the configured Andean regions.

The input and output folder is `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft`. If the input comes from the [Temporal Filter](./03-4-temporal-filter.en.md), set the project, region, and version to match the asset produced at that step.

The script selects the annual bands, assigns `27` to masked observations within the image footprint, and applies the region mask. This normalized `Byte` image is `original` and serves as the reference for the rules and diagnostics.

## 2. Parameters and correction scope

| Parameter | Script value | Effect |
| --- | --- | --- |
| `user` | `'mayerlings-488722'` | Project for the input and output assets. |
| `region_id` | `92101` | Classification region. |
| `country` | `'VENEZUELA'` | Output metadata. |
| `input_version` / `output_version` | `'8'` / `'9'` | Asset suffixes. |
| `years` | 1985–2025 | Full series used to calculate the frequency, persistent onset, and opposition. |
| `apply_on_years` | `[]` | Years where changes may be written. An empty list enables the entire series. |
| `apply_on_region` | `[geometry]` | Geometries or features whose union limits changes within the region. An empty list enables the entire region. |
| `preview` | `[1985, 2000, 2010, 2020, 2025]` | Years for visual inspection. |
| `no_data` | `27` | Value excluded from the valid observation count. |
| `max_noise_run` | `2` | Maximum length of an internal gap for local correction. |
| `min_transition_run` | `3` | Minimum length of a run of persistent opposition. |
| `min_anthropic_persistence` | `3` | Consecutive years of an anthropic class required to establish its onset. |
| `protect_no_data` | `true` | Blocks broad stabilization when NoData occurs in the relevant interval. |
| `no_onset` | `9999` | Internal value indicating that no persistent onset was detected. |

The current configuration allows corrections in all years, inside the `geometry` polygon included in the script and where it intersects the region. To use the entire region, set `apply_on_region = []`. To limit which years can be edited, list them in `apply_on_years`.

> [!IMPORTANT]
> The correction scope restricts where and when changes are written. Candidate selection, onset, and opposition use the entire series. The output asset keeps all annual bands and preserves `original` values outside the editable scope. Export uses the classification region's bounds.

Before building the filter, the script checks that frequency thresholds are numeric and in `(0, 1]`, that each class ID appears only once, and that the editable years are unique and listed in `years`. Both scope settings must be arrays, and the spatial list must have no empty entries. `min_transition_run` must exceed `max_noise_run`. Both `min_transition_run` and `min_anthropic_persistence` must fit within the series.

## 3. Frequency candidate selection

For each pixel, the script divides the number of years in a class by the count of valid observations. For example, 28 years in a class out of 40 valid observations give a frequency of 0.70. NoData years are excluded from the denominator.

| List | Classes | Minimum frequency |
| --- | --- | --- |
| `natural_frequencies` | 3, 6, 66, 33, 50 | 0.70 each |
| `antropic_frequencies` | 24 | 0.60 |
| `antropic_frequencies` | 25 | 0.70 |
| `antropic_frequencies` | 30 | 0.90 |
| `antropic_frequencies` | 21 | 0.50 |

Only configured classes can become candidates. If a class meets its threshold, it competes with any other qualifying classes. The highest frequency wins. A tie keeps the first rule in list order, with natural rules evaluated first. If no class qualifies or the pixel has no valid observations, its internal candidate value is `-1`. The candidate identifies which rule can apply, even if the pixel ultimately stays unchanged.

## 4. Natural and anthropic rules

**Persistent opposition** is a run of at least `min_transition_run` consecutive valid years different from the candidate. The classes in that run can differ from one another. **Local correction** fills gaps of up to `max_noise_run` valid observations different from the candidate and bounded on both sides by the candidate class.

| Candidate | Conditions | Correction |
| --- | --- | --- |
| Natural | No persistent opposition and, with protection enabled, no NoData in the series. | Stabilizes all valid, editable years at the pixel. This can include the endpoints. |
| Natural | Persistent opposition is detected, or NoData is present with protection enabled. | Corrects only eligible local gaps. |
| Anthropic | There is a persistent onset, no persistent opposition starting at or after it, and, with protection enabled, no NoData from then onward. | Stabilizes valid, editable years from onset onward. |
| Anthropic | There is a persistent onset. Persistent opposition starts at or after onset, or there is NoData from onset onward with protection enabled. | Corrects only local gaps starting at or after onset. |
| Anthropic | No persistent onset is detected. | Retains the input values at the pixel. |

The **persistent onset** of an anthropic class is the first year of the first run of at least `min_anthropic_persistence` consecutive observations of that class. Years before onset keep their input class. The rules evaluate runs and gaps on `original` using multiband comparisons and masks.

## 5. NoData handling

- In the normalized classification, `27` remains an explicit value within the raster's covered area. It contributes neither to the frequency denominator nor to valid opposition. Keep the `no_data` value out of the candidate class lists.
- Local correction requires valid observations at every position inside the gap. A gap containing `27` is ineligible for local correction.
- With `protect_no_data = true`, any `27` blocks broad natural stabilization. For an anthropic candidate, the check looks for `27` from persistent onset onward.
- With `protect_no_data = false`, broad stabilization can correct other valid observations. The write masks still exclude `27`, so that value is preserved. See [Gap Fill](./03-2-gapfill.en.md) for propagating classes into missing observations.

## 6. Execution and diagnostics

1. Check the input asset, band schema, project, region, and versions. Review the application geometry and editable years. Choose an available output version.
2. Review the frequency lists and duration settings. Select **Run** and check the Console, especially `EDITABLE YEARS` and `APPLICATION MASK`.
3. On the map, review `REGIÓN` and, if geometries are configured, `ÁREA DE APLICACIÓN`. Turn on the diagnostic layers below and use the **Inspector** to review the frequency, class, and changes at pixels of interest.
4. Compare the full pixel trajectory in the original and corrected classifications. Inspect persistent transitions and the early years of anthropic classes.
5. In **Tasks**, start the `<region_id>-<output_version>` task after review. Verify the result and metadata in **Assets**.

| Layer | Use during review |
| --- | --- |
| `MOSAICO <year>` | False-color Landsat view from the median of that year's mosaics. The layer is blank if no mosaics are available. |
| `ORIGINAL <year>` / `CORREGIDA <year>` | Year-by-year comparison of the normalized input and corrected output. |
| `CAMBIOS <year>` | Highlights positions where the classifications differ. |
| `NÚMERO DE AÑOS CORREGIDOS` | Counts changed bands at each pixel. The layer masks zero values. |
| `CLASE DOMINANTE POR FRECUENCIA` | Candidate class. The layer masks pixels with no candidate. |
| `FRECUENCIA CLASE DOMINANTE` | Observed frequency of the candidate. It can be inspected outside the application polygon within the regional classification. |

## 7. Export and metadata

| Item | Value |
| --- | --- |
| Destination | `classification-ft/<region_id>-<output_version>` |
| Exported image | `corrected`, one `classification_<year>` band per year, as `Byte` |
| Region | `region.vector.geometry().bounds()` |
| Scale | 30 m |
| Pyramiding policy | `mode` for all bands |
| Export limit | `maxPixels: 1e13` |

The asset includes `code_region`, `country`, `version`, `step = 'advanced-temporal-frequency'`, `implementation = 'multiband-vectorized'`, and `descripcion = 'advanced temporal frequency filter'`. Metadata also records `max_noise_run`, `min_transition_run`, `min_anthropic_persistence`, `protect_no_data`, `apply_on_years`, `editable_years`, and `apply_on_region_count`. Diagnostic layers are available in the map and Console. The task saves the corrected classification.

## 8. Quality control and troubleshooting

- Check the 41 band names, the `Byte` type, the scope metadata, and access to the exported asset.
- Verify that changes are confined to the editable years and geometry. Compare against `original`, which already encodes masked observations within the footprint as `27`.
- Calculate changed area by year and class pair. Inspect pixels with many corrections, frequencies near the thresholds, and sustained natural and anthropic transitions.
- Verify the preservation of `27`, runs of persistent opposition, and trajectories before anthropic onset. Test parameter changes one at a time and record the configuration with the output version.

| Symptom | What to check |
| --- | --- |
| The Console rejects the rules | Check for duplicate IDs, out-of-range frequencies, and incompatible durations. |
| The Console rejects the scope | Check that the years are unique and listed in `years`. Confirm the geometries or features are defined. |
| An area shows no changes | Check whether it falls inside the application mask and has valid observations and a candidate that enables a correction. |
| A natural candidate only corrects gaps | Look for persistent opposition or NoData with protection enabled. |
| An anthropic candidate makes no corrections or only corrects gaps | Check the persistent onset, opposition starting from onset, and NoData from onset onward. |
| Too many years are corrected | Check which candidates triggered broad stabilization and compare trajectories before adjusting thresholds. |
| Export fails | Check permissions, folder, extent, quotas, and whether the version is available. |

## 9. Examples and quick reference

These examples use short series and the script's thresholds. Assume all years shown are editable. The value `27` denotes NoData.

| Case | Input series | Result |
| --- | --- | --- |
| Natural class 3, frequency 4/5 | `3, 3, 21, 3, 3` | Broad stabilization changes 21 to 3. |
| Natural class 3, three years of opposition | `3, 3, 3, 21, 6, 21, 3, 3, 3, 3` | The `21, 6, 21` run is preserved. Class 3 reaches 7/10 and the run meets the opposition minimum. |
| Natural class 3, NoData and valid gap | `3, 3, 21, 3, 27, 3, 3` | Protection blocks broad stabilization. The gap with 21 changes to 3, and 27 is preserved. |
| Gap containing NoData | `3, 3, 27, 21, 3, 3, 3` | The `27, 21` gap is preserved with protection enabled. |
| Anthropic class 24 with onset | `3, 3, 24, 24, 24, 21, 24, 24` | 21 changes to 24, and the two years before onset are preserved. |
| Anthropic class 24 with opposition after onset | `3, 24, 24, 24, 21, 6, 21, 24, 24, 24` | Class 24 reaches 6/10. The `21, 6, 21` run is preserved. |
| Anthropic class 24 with no onset | `24, 24, 3, 24, 24, 3, 24, 24` | Class 24 qualifies as a candidate. No run reaches three years, and the series is preserved. |

| Identifier | Role |
| --- | --- |
| `build_temporal_context()` | Prepares aligned bands, valid observations, and NoData masks. |
| `build_application_context()` | Combines spatial scope and editable years into a multiband mask. |
| `get_frequency_candidate()` | Selects the candidate and its relative frequency. |
| `apply_natural_frequency_rules()` / `apply_antropic_frequency_rules()` | Apply broad stabilization or local corrections. |
| `get_run_start_mask()`, `has_persistent_opposition()`, `get_persistent_onset()` | Identify consecutive runs, opposition, and persistent onset. |
| `get_bounded_gap_correction_mask()` | Finds short gaps of valid observations bounded by the candidate. |
| `corrected_years` | Counts changed bands per pixel. |

## 10. References

- [Band comparisons and reduction](https://developers.google.com/earth-engine/apidocs/ee-image-reduce) · [Mask normalization with `unmask()`](https://developers.google.com/earth-engine/apidocs/ee-image-unmask) · [Conditional replacement with `where()`](https://developers.google.com/earth-engine/apidocs/ee-image-where)
- [Exporting to assets](https://developers.google.com/earth-engine/apidocs/export-image-toasset) · [Pyramiding policy](https://developers.google.com/earth-engine/guides/image_upload)
