![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Back to README](https://img.shields.io/badge/%E2%86%90%20Back%20to%20README-gray?style=for-the-badge)](../README.md)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[View script (`04-3-year-based-remaps.js`)](../04-3-year-based-remaps.js) · [Versión en español](./04-3-year-based-remaps.md)

# Reference-Year Remapping User Manual

MapBiomas Venezuela · Collection 4 · 1985–2025 series · Manual 1.0

The script uses a base year's classification to identify eligible pixels and remaps selected classes over a range of years. With the supplied settings, pixels classified as 3 in 2025 can change from 33 or 12 to 3 in historical years.

| Example input | Example output |
| --- | --- |
| `classification-ft/92809-4` | `classification-ft/92809-5` |

## Contents

- [1. Requirements and input](#1-requirements-and-input)
- [2. Parameters](#2-parameters)
- [3. How remapping works](#3-how-remapping-works)
- [4. Execution and visualization](#4-execution-and-visualization)
- [5. Export](#5-export)
- [6. Quality control and troubleshooting](#6-quality-control-and-troubleshooting)
- [7. References](#7-references)

## 1. Requirements and input

- Access to the [Google Earth Engine Code Editor](https://code.earthengine.google.com/), the project set in `user`, and the regional input asset. The output folder must exist and be writable.
- A classification with `classification_<year>` bands. Check the base-year band, the years to be corrected, and the requested preview years.
- Access to `users/mapbiomas/modules:Palettes.js`, which provides the `classification8` display palette.

The input and output folder is `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft`. To use an output from [Variable-Based Remapping](./04-2-variable-based-remaps-1.en.md) or another filtering step, select the region and version actually exported. The script uses that classification's footprint and masks. It declares `regions_path` without loading the vector during processing.

## 2. Parameters

| Parameter | Script value | Effect |
| --- | --- | --- |
| `user` | `'sig5-provita'` | Input and output project. |
| `region` | `92809` | Asset name prefix. |
| `input_version` | `4` | Input asset version. |
| `output_version` | `5` | Remapped asset version. Choose an available name. |
| `base_year` | `2025` | Year whose original band supplies the mask for each rule. |
| `year_range` | `[1985, 2024]` | First and last editable years, both inclusive. |
| `class_changes` | `[[3, 33], [3, 12]]` | Pairs of `[base_class, historical_class_to_replace]`. |
| `preview_years` | `[1985]` | Years added to the map for review. |

> [!IMPORTANT]
> In `class_changes`, the first value is both the class required in the base year and the value written to the historical band. The second is the historical class to match. `[3, 33]` changes **33 to 3** wherever the base-year pixel was 3.

## 3. How remapping works

1. The script sorts band names with `bandNames().sort()` and fetches that list to the client with `getInfo()`. It reads the year from the second underscore-delimited part of the name. The `classification_YYYY` naming convention gives chronological order. The script also iterates over any auxiliary bands in the asset, so check the schema before export.
2. For each band within the range, it runs `class_changes` in the configured order. Each rule builds a mask from the class in `base_year` in `classified_image`.
3. `where()` writes the base class where the mask and the expected historical class both match. Each rule reads the historical band produced by the previous rule. The original classification supplies the base mask for every rule. Masked observations remain masked. [Conditional replacement with `where()`](https://developers.google.com/earth-engine/apidocs/ee-image-where)
4. The script retains bands outside the range and assembles the result with their original names. In the example, the 2025 band is outside the remapping range.

| Original class in 2025 | Historical class within the range | Result |
| --- | --- | --- |
| 3 | 33 | 3 |
| 3 | 12 | 3 |
| 3 | 21 | 21 |
| 21 | 33 | 33 |
| 3 | 3 | 3 |
| Masked | 33 | 33 |

For example, if a pixel is class 3 in 2025, the historical sequence `21, 33, 12` becomes `21, 3, 3`. Class 21 falls outside the two configured rules.

## 4. Execution and visualization

1. Confirm `user`, `region`, and the versions. Inspect the input band names, including the base year.
2. Check that the range is ordered and each rule contains the two class IDs in the specified order. Choose preview years, such as the endpoints and an intermediate year.
3. Select **Run**. Turn on `ORIGINAL <year>` and `MODIFIED <year>` and compare values with the **Inspector**. The layers start hidden.
4. Check the changes against the base-class mask and compare the area distribution by class. After review, start the task under **Tasks**.
5. Open the exported asset and confirm it contains the expected bands and covers the intended region.

## 5. Export

| Item | Value |
| --- | --- |
| Destination | `classification-ft/<region>-<output_version>` |
| Image | `result_image`, with bands assembled in name order |
| Geometry | `classified_image.geometry()` |
| Scale | 30 m |
| Pyramiding policy | `mode` for all bands |
| Export limit | `maxPixels: 1e13` |

The supplied configuration creates a task named `92809-5`. The script applies no explicit type cast and adds no version, step, or base-year properties to the export. Record those settings alongside the asset name for traceability.

## 6. Quality control and troubleshooting

- With the example settings, check that changes fall within 1985–2024, that replacements are 33 → 3 or 12 → 3, and that every change falls within class 3 in the original 2025 band.
- Compare each year with the input. A difference mask shows where changes occurred, and an area summary by class pair shows their extent.
- Check that the base year and years outside the range keep their values. Inspect the pixel against independent land-cover evidence when you need to justify a remap.

| Symptom | What to check |
| --- | --- |
| `classification_2025` or a preview band is missing | Check the asset schema and the values of `base_year` and `preview_years`. |
| An expected year shows no change | Check the range, band name, and where the base mask and historical class overlap. |
| The corrected area is too large | Compare the base-class extent and the area affected by each pair before adjusting the rules. |
| Colors do not match the legend | Check whether the `classification8` palette covers the IDs in the asset. |
| Export has an unexpected extent | Inspect the input asset geometry, which defines the requested extent. |

## 7. References

- [Selecting bands](https://developers.google.com/earth-engine/apidocs/ee-image-select) · [Conditional replacement](https://developers.google.com/earth-engine/apidocs/ee-image-where)
- [Exporting images to assets](https://developers.google.com/earth-engine/apidocs/export-image-toasset)
- [Transition Map guide](./05-0-transition-map.en.md)
