![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Back to README](https://img.shields.io/badge/%E2%86%90%20Back%20to%20README-gray?style=for-the-badge)](../README.md)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[View script (`03-4-temporal-filter.js`)](../03-4-temporal-filter.js) · [Versión en español](./03-4-temporal-filter.md)

# Temporal Filter User Manual

MapBiomas Venezuela · Collection 4 · 1985–2025 series · Manual 1.0

This filter corrects one- to three-year interruptions in a pixel's classification history. It also corrects the first and last years when the two adjacent years share a target class. Rules run in sequence, and selected years or land covers can be restored from the original classification before export.

| Example input | Example output | Product |
| --- | --- | --- |
| `classification-ft/92807-1` | `classification-ft/92807-2` | Annual multiband image, `Byte`, 30 m |

## Contents

- [1. Requirements and inputs](#1-requirements-and-inputs)
- [2. Parameters](#2-parameters)
- [3. Temporal rules and execution order](#3-temporal-rules-and-execution-order)
- [4. Restoring years and classes](#4-restoring-years-and-classes)
- [5. Execution and visualization](#5-execution-and-visualization)
- [6. Export](#6-export)
- [7. Quality control and troubleshooting](#7-quality-control-and-troubleshooting)
- [8. Examples and quick reference](#8-examples-and-quick-reference)
- [9. References](#9-references)

## 1. Requirements and inputs

- Access to the [Google Earth Engine Code Editor](https://code.earthengine.google.com/), the regional input asset, and a writable output folder.
- An image with one `classification_<year>` band per year. The configuration uses all 41 bands from `classification_1985` through `classification_2025`. Keep `years` in chronological order with no gaps and at least three years.
- Access to `users/ejvalero/api:src/utils`, the `users/mapbiomas/modules:Palettes.js` module with the `classification9` palette, and the `projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion` asset, which identifies regions by `gridcode`.
- Access to the Venezuela and Guyana Landsat mosaics. For the preview, the script combines the `full` season mosaics and shows `swir1_median`, `nir_median`, and `red_median` with the region mask. It applies a special filter to the Venezuela collection for the configured Andean regions. The temporal rules operate on the classification.

Input and output share `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft`. To use the [Spatial Filter](./03-3-spatial-filter.en.md) result, set `input_version` to the version actually exported and choose a different, available `output_version`. Both scripts' example settings point to the same output name.

## 2. Parameters

| Parameter | Script value | Effect |
| --- | --- | --- |
| `user` | `'emanuel-valero'` | Project used for asset paths. |
| `region_id` | `92807` | Region and asset name prefix. |
| `country` | `'GUYANA'` | Output metadata. |
| `years` | 1985–2025 | Annual series evaluated by the rules. |
| `preview` | `[1986, 2011, 2015, 2025]` | Years displayed on the map. Each needs a band in the series. |
| `years_to_exclude` | `[2014]` | Years restored from the input after the rules run. |
| `classes_to_exclude` | `[24]` | Positions restored according to their original class. |
| `input_version` | `'1'` | Input classification suffix. |
| `output_version` | `'2'` | Filtered classification suffix. |
| `filter_execution` | Five rules, in the order shown below | Order of the windows and of the target classes within each window. |

Use an empty list in `years_to_exclude` or `classes_to_exclude` to skip the corresponding restoration.

## 3. Temporal rules and execution order

In the patterns, `A` is the rule's target class, and each `X` is an observation different from `A`. Multiple `X` positions may hold different classes. Each example represents one rule for one target class.

| Order | Rule | Pattern | Positions that can change |
| --- | --- | --- | --- |
| 1 | `last3` | `… A A X → … A A A` | Last year of the entire series. |
| 2 | `first3` | `X A A … → A A A …` | First year of the entire series. |
| 3 | `middle3` | `A X A → A A A` | One-year internal interruption. |
| 4 | `middle4` | `A X X A → A A A A` | Two-year internal interruption. |
| 5 | `middle5` | `A X X X A → A A A A A` | Three-year internal interruption. |

Each rule processes `[6, 9, 11, 13, 21, 24, 30, 3, 12, 33]` in that order. Each class operates on the preceding class's result. A correction can create or remove a pattern evaluated by a later pass. The order does not give a class a fixed priority over another class at every pixel.

For a given class and interior rule, the years are evaluated in parallel against the same input for that pass. `pad_image()` adds three temporary bands of value `9999` before and after the series so the windows can select bands beyond the endpoints. The output omits the temporary bands. The edge rules update the first or last band directly.

> [!NOTE]
> The windows replace class values that match a pattern. The code does not apply the [Gap Fill](./03-2-gapfill.en.md) NoData mask or call `unmask()`. An unmasked band value of `27` can match an `X` position. `where()` leaves an already masked input pixel masked.

## 4. Restoring years and classes

1. `exclude_years()` overwrites the selected bands with their original values using `addBands()`. With the current configuration, the product restores `classification_2014` from the input.
2. Next, `exclude_covers()` masks the input according to its original classes and overlays those values on the result. With `[24]`, each pixel-year originally in class 24 is restored to 24. New assignments to class 24 produced by the windows can remain.

> [!IMPORTANT]
> Both restorations run after all rules. Bands from listed years and pixels from listed classes participate in the windows and can influence neighboring years before being restored.

## 5. Execution and visualization

1. Open the script and configure `user`, `region_id`, `country`, and the versions. Check the input asset's band schema and the availability of the output destination.
2. Review `filter_execution`, both restoration lists, and the `preview` years. Include the series endpoints to check `first3` and `last3`.
3. Select **Run**. The Console prints exclusion lists when they are applied. In the map, turn on `MOSAIC <year>`, `INPUT <year>`, and `OUTPUT <year>` to compare the Landsat image and both classifications. These layers start hidden.
4. Use the **Inspector** to compare values. Review complete trajectories at changed pixels, giving particular attention to the excluded band and the positions of the restored class.
5. In **Tasks**, start the task named `<region_id>-<output_version>` and check the resulting asset's bands, scale, and metadata.

## 6. Export

| Item | Value |
| --- | --- |
| Destination | `classification-ft/<region_id>-<output_version>` |
| Bands and type | Annual classification series, `Byte` |
| Metadata | `version = output_version`, `country`, `step = 'temporal-filter'` |
| Region | `input.geometry().bounds()` |
| Scale | 30 m |
| Pyramiding policy | `sample` for all bands |
| Export limit | `maxPixels: 1e13` |

The task exports the final classification. To audit differences or class areas by year, derive those diagnostics from the input and output assets. Compare pixels at 30 m when changes in zoom may reflect pyramid levels.

## 7. Quality control and troubleshooting

- Check that the full configuration produces 41 bands. Compare `INPUT` and `OUTPUT` in 1985 and 2025 to review the edge rules.
- Quantify changes by year and replacements by class pair. Check whether genuine short-duration events are being removed systematically.
- Compare the output band for 2014 against the original and check positions originally in class 24. Inspect adjacent years, where changes can remain.
- Test rule order with synthetic trajectories before changing it. Record the order and exclusions for each version.

| Symptom | What to check |
| --- | --- |
| A band is missing or a window fails | Check `bandNames()`, the `classification_` prefix, and whether `years` is consecutive. Check the preview and restoration years as well. |
| A year next to 2014 changes | Find the pattern in the windows. The 2014 band is restored at the end. |
| Class 24 appears at a new position | Check the rule that assigned it and the original class at that position. |
| Reordering classes changes the result | Compare the sequential passes and synthetic trajectories. |
| The output appears too stable | Review two- and three-year patterns, affected classes, and transitions visible in the mosaics. |
| A mosaic is missing or export fails | Check mosaic availability, permissions, and versions. Preview and export are configured separately. |

## 8. Examples and quick reference

| Case | Input | Rule result |
| --- | --- | --- |
| `middle3` for 21 | `21, 3, 21` | `21, 21, 21` |
| `middle4` for 21, with different interior classes | `21, 3, 6, 21` | `21, 21, 21, 21` |
| `middle5` for 3 | `3, 21, 21, 21, 3` | `3, 3, 3, 3, 3` |
| `first3` for 3 | `6, 3, 3, …` | `3, 3, 3, …` |
| `last3` for 11 | `…, 11, 11, 6` | `…, 11, 11, 11` |
| Year restoration | A window changes 2014 | 2014 returns to the input value after the rules. |
| Class restoration | A pixel was class 24 in 2010 and a window changed it | The pixel returns to class 24 in 2010 after the rules. |

| Identifier | Role |
| --- | --- |
| `apply_filter()` | Runs a window for each class in the ordered list. |
| `time_windows()` | Provides the five window functions. |
| `get_band()` and `pad_image()` | Select bands by name and prepare the context at the edges. |
| `exclude_years()` and `exclude_covers()` | Restore entire bands and values from original classes. |

## 9. References

- [Conditional replacement with `where()`](https://developers.google.com/earth-engine/apidocs/ee-image-where) · [Overwriting bands with `addBands()`](https://developers.google.com/earth-engine/apidocs/ee-image-addbands) · [Overlay with `blend()`](https://developers.google.com/earth-engine/apidocs/ee-image-blend)
- [Exporting to assets](https://developers.google.com/earth-engine/apidocs/export-image-toasset) · [Pyramiding policy](https://developers.google.com/earth-engine/guides/image_upload)
- [Next workflow guide: Frequency Filter](./03-5-frequency-filter.en.md)
