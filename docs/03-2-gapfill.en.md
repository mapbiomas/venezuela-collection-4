![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Back to README](https://img.shields.io/badge/%E2%86%90%20Back%20to%20README-gray?style=for-the-badge)](../README.md)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[View script (`03-2-gapfill.js`)](../03-2-gapfill.js) · [Versión en español](./03-2-gapfill.md)

# User Manual: Temporal Gap Filling (Gap Fill)

**Script:** [`03-2-gapfill.js`](../03-2-gapfill.js) · **Series:** 1985–2025 (41 years) · **Collection:** 4 · **Version:** 1.0

> **Purpose:** Guide the configuration, execution, inspection, quality control, and export of the temporal filter that replaces value 27 with valid classes from neighboring years, using a backward fill followed by a forward fill.

| Field | Details |
| :--- | :--- |
| **Manual version** | 1.0 |
| **Date** | August 17, 2026 |
| **Temporal coverage** | 1985–2025 (41 years) |
| **Process** | Temporal gap filling of LULC classification |
| **Export resolution** | 30 m (`Byte`) |
| **Reviewed configuration** | `region_id = 92807`, `country = 'GUYANA'`, `input_version = '1'`, `output_version = '1'` |

---

## Document Control

| Item | Description |
| :--- | :--- |
| **Title** | User Manual – Temporal Gap Filling (Gap Fill) |
| **Base script** | [`03-2-gapfill.js`](../03-2-gapfill.js) |
| **Collection** | MapBiomas Venezuela – Collection 4 |
| **Input** | `classification-single/<region_id>-<input_version>` |
| **Output** | `classification-ft/<region_id>-<output_version>` |
| **Observations treated as gaps** | Values of `27` and already masked pixels |
| **Method** | Backward fill + forward fill using `ee.Image.unmask()` |
| **Product** | Annual multiband image with `version`, `country`, and `step` metadata |

> [!NOTE]
> This manual documents the observable behavior of [`03-2-gapfill.js`](../03-2-gapfill.js). The functions `getRegion()` and `getMapBiomasMosaics()` belong to the external module `users/ejvalero/api:src/utils`; their internal implementation is not included in the script and is not reconstructed here.

---

## Contents

- [1. Introduction and Rationale](#1-introduction-and-rationale)
- [2. Objectives, Scope, and Audience](#2-objectives-scope-and-audience)
- [3. Requirements and Input Data](#3-requirements-and-input-data)
- [4. Core Concepts](#4-core-concepts)
- [5. Script Architecture](#5-script-architecture)
- [6. Configurable Parameters](#6-configurable-parameters)
- [7. Temporal Gap Fill Methodology](#7-temporal-gap-fill-methodology)
- [8. Output Products](#8-output-products)
- [9. Visualization and Inspection](#9-visualization-and-inspection)
- [10. Execution Procedure](#10-execution-procedure)
- [11. Product Interpretation and Usage](#11-product-interpretation-and-usage)
- [12. Export and Naming Convention](#12-export-and-naming-convention)
- [13. Recommended Quality Control](#13-recommended-quality-control)
- [14. Troubleshooting](#14-troubleshooting)
- [15. Best Practices](#15-best-practices)
- [16. References and Resources](#16-references-and-resources)
- [Appendix A. Quick Execution Checklist](#appendix-a-quick-execution-checklist)
- [Appendix B. Variables and Functions Dictionary](#appendix-b-variables-and-functions-dictionary)
- [Appendix C. Temporal Behavior Examples](#appendix-c-temporal-behavior-examples)

### Reading Conventions

- Variable, function, band, property, and asset names appear exactly as written in the script.
- A **gap** is an observation masked in the input or masked before filling because its value is `27`.
- **Backward fill** means propagating a valid observation from a later year into earlier years that are empty.
- **Forward fill** means propagating a valid observation from an earlier year into later years that remain empty.
- This manual describes the observable behavior of the supplied code and clearly separates recommended checks from any future algorithm modification.

---

## 1. Introduction and Rationale

Annual land use and land cover series may contain years without a valid classification for certain pixels. In the reviewed script, these cases are encoded with value `27`. If these gaps persist in the series, they can affect subsequent temporal filters, transition analyses, persistence calculations, and the visual interpretation of a pixel's trajectory.

The Gap Fill script temporally transforms value `27` into masked pixels and uses information available from other years to complete the series. Processing is performed on a multiband annual image from 1985 to 2025. First a backward fill is executed, allowing a gap to adopt the valid value from the next available year. Then a forward fill is executed to complete gaps that could not be resolved from the future, primarily those at the end of the series.

This procedure does not evaluate the thematic plausibility of a change nor apply ecological rules between classes. Its function is strictly to complete temporal absences using values observed at the same spatial location in other years. Therefore, the Gap Fill should be interpreted as a data-continuity stage, not as a stability or thematic-correction filter.

### 1.1 What Problem Does It Solve?

- Eliminates series discontinuities caused by value `27` when at least one valid observation exists in another year for the same pixel.
- Propagates a valid future class backward to resolve initial or internal gaps.
- Propagates a valid previous class forward to resolve trailing gaps remaining after the first pass.
- Maintains the annual ordering of all 41 bands and preserves original valid classes without overwriting them.
- Produces a more complete series for downstream temporal filtering and multitemporal analysis.

> [!IMPORTANT]
> **Methodological scope:** The algorithm fills absence of information; it does not decide whether a transition between two classes is correct or incorrect. A real change present in valid data is preserved.

---

## 2. Objectives, Scope, and Audience

### General Objective

Provide a technical and operational guide to configure, run, inspect, and export the Gap Fill script, understanding how value `27` is masked, how the reverse and forward temporal traversals operate, and what checks should be applied before using the product in subsequent stages.

### Specific Objectives

- Document the assets, years, versions, and parameters used by the script.
- Explain how the mask converts value `27` into temporal data absence.
- Describe the `gap_fill()` function and its use within `backward_fill()` and `forward_fill()`.
- Explain the implicit temporal priority: future values for gaps resolvable in the first pass, past values for remaining gaps.
- Document the ORIGINAL/FILLED comparative visualization and the supporting Landsat mosaic.
- Establish QA controls to quantify gaps before and after processing.
- Document the Earth Engine Asset export and the configured pyramiding policy.

### Target Audience

MapBiomas Venezuela technical personnel involved in production, temporal filtering, review, and quality control of annual classifications, with basic to intermediate knowledge of Google Earth Engine and raster time series.

---

## 3. Requirements and Input Data

### 3.1 Operational Requirements

- Access to the Google Earth Engine Code Editor and the project defined in `user`.
- Read access to `classification-single` and the classification regions asset.
- Write access to the `classification-ft` collection.
- Access to Venezuela and Guyana Landsat mosaics used exclusively for visual inspection.
- Access to the `users/ejvalero/api:src/utils` module and the `users/mapbiomas/modules:Palettes.js` palette.
- The input image must have `classification_1985` through `classification_2025` in chronological order for the complete workflow. Filling uses band positions, while the preview and downstream filters use band names.

### 3.2 Input Classification Image

The input asset path is built as `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-single/<region_id>-<input_version>`. In the reviewed configuration, the expected name is `92807-1`.

> [!IMPORTANT]
> The [classifier](./03-0-classifier.en.md) exports to `classification` by default, while Gap Fill reads from `classification-single`. If you use the classifier output directly, point `input_path` to the folder that contains it and match `user`, `region_id`, and `input_version` to the asset you exported.

```javascript
var input_name = region_id + '-' + input_version;
var input = ee.Image(input_path + '/' + input_name);
```

### 3.3 Classification Region

The region is obtained via `functions.getRegion()` from the `ve-gu-regiones-clasificacion` asset, using `gridcode` and `region_id`. This region controls mosaic loading for visual support. The export, however, uses `input.geometry().bounds()` as the output region.

### 3.4 Supporting Mosaics

Venezuela and Guyana Landsat mosaics are loaded with `swir1_median`, `nir_median`, and `red_median` only. Both collections are merged and filtered by `season = "full"`. A special filter applies to Andean regions in Venezuela; region `92807` does not belong to the `andean_region_ids` list in the script.

> [!NOTE]
> The Gap Fill is computed exclusively from the multiband classification input. Landsat mosaics do not participate in the fill calculation; they are used only for visual inspection of the years included in `preview`.

---

## 4. Core Concepts

### 4.1 Mask and Value 27

The instruction `input.updateMask(input.neq(27))` masks the value `27` in every band and preserves existing masks. Unmasked values other than `27` remain available. The `unmask()` operation in each pass can fill either kind of masked observation.

```javascript
var masked_input = input.updateMask(input.neq(27));
```

### 4.2 `unmask()` as a Fill Operator

The `gap_fill()` function uses `current_image.unmask(previous_image_filled)`. Where `current_image` is valid, its value is preserved. Where `current_image` is masked, it adopts the value and mask from `previous_image_filled`. This property allows chaining the fill year by year.

### 4.3 Cumulative Iteration

The script uses `ee.List.iterate()` over band indices. The iteration function receives the current temporal index and a dictionary accumulating `image_filled`. After each step, the newly completed band is appended, becoming the reference for the next iteration. This design propagates a valid value across multiple consecutive gap years.

### 4.4 Band Index Selection

The fill functions use `select([0])`, `select([previous_year_index])`, and index lists rather than band names. Therefore, the physical order of bands in the input image is a critical requirement: position 0 is interpreted as 1985, position 1 as 1986, and so on through position 40 as 2025.

> [!CAUTION]
> **Check band order.** The script processes the first `years.length` band positions. A short input can cause a band-selection error. Reordered bands or extra bands among the first 41 can cause propagation between unintended years, and bands after position 40 are omitted with the default settings.

### 4.5 Difference Between Gap Fill and Temporal Filter

Gap Fill preserves every valid observation, including a class that differs from both neighboring years. The temporal propagation applies only where the observation is masked.

---

## 5. Script Architecture

The workflow can be summarized in ten functional blocks:

| Step | Block | Purpose |
| :--- | :--- | :--- |
| 1 | Configuration | Defines user, region, country, versions, years, and preview years. |
| 2 | Paths & Modules | Configures `classification-single`, `classification-ft`, regions, mosaics, palette, and utilities. |
| 3 | Region & Mosaics | Loads the region and prepares visual support mosaics. |
| 4 | Input | Loads the multiband classification image. |
| 5 | Masking | Converts value `27` to mask via `updateMask(input.neq(27))`. |
| 6 | Backward fill | Reverses band order and propagates valid values from later years into the past. |
| 7 | Forward fill | Traverses the normal series and propagates previous values to fill remaining gaps. |
| 8 | Product | Casts to `Byte` and attaches `version`, `country`, and `step` metadata. |
| 9 | Visual QA | Compares mosaic, ORIGINAL, and FILLED for selected years. |
| 10 | Export | Exports the multiband image to `classification-ft` at 30 m. |

---

## 6. Configurable Parameters

The following values correspond to the supplied script and should be reviewed before processing a new region or version.

| Parameter | Current value | Controls |
| :--- | :--- | :--- |
| `user` | `"emanuel-valero"` | Earth Engine user/project namespace for input and output paths. |
| `region_id` | `92807` | Classification region identifier. |
| `country` | `"GUYANA"` | `country` metadata property assigned to the final product. |
| `input_version` | `"1"` | Input asset version in `classification-single`. |
| `output_version` | `"1"` | Output asset version in `classification-ft`. |
| `years` | `1985–2025` | Expected temporal sequence of 41 bands. |
| `preview` | `1990, 1995, 2018, 2020` | Years displayed on the map for inspection. |
| `regions_field` | `"gridcode"` | Field used to locate `region_id`. |
| `input_path` | `.../classification-single` | Input image collection. |
| `output_path` | `.../classification-ft` | Gap Fill output collection. |
| `rgb_combination` | `SWIR1, NIR, Red` | False-color combination for support mosaics. |
| `pyramidingPolicy` | `".default": "sample"` | Rule used when building coarser-resolution asset levels. |
| `scale` | `30` | Export resolution in meters. |
| `maxPixels` | `1e13` | Maximum pixel limit for the export task. |

> [!NOTE]
> **Territorial configuration:** In the reviewed script `country = "GUYANA"` and `region_id = 92807`. The `country` value is incorporated as metadata; the Gap Fill processing depends on the input image and does not use `country` to decide which pixels to fill.

---

## 7. Temporal Gap Fill Methodology

### 7.1 Gap Mask Construction

The process begins with `input.neq(27)`, which creates a per-band boolean image: `1` where the classification differs from `27` and `0` where it equals `27`. `updateMask()` applies this condition to `input`. The resulting `masked_input` retains valid classes and leaves `27` values as masked pixels.

### 7.2 Generic `gap_fill()` Function

`gap_fill()` receives a temporal index and an accumulator dictionary. It extracts the current band from `image_base` and the previously filled band from `image_filled`. It then executes `unmask()` to replace missing pixels in the current band with the previous band in the traversal order and appends the result to `image_filled`.

```javascript
var current_image = image_base.select([ee.Number(current_year_index)]);
var previous_image_filled = image_filled.select([previous_year_index]);
var current_filled = current_image.unmask(previous_image_filled);
obj = obj.set('image_filled', image_filled.addBands(current_filled));
```

### 7.3 First Pass: `backward_fill()`

`backward_fill()` reverses band order before iterating. Consequently, the first band in the traversal is 2025, the next is 2024, and so on down to 1985. For a gap year, the "previous band" in this traversal corresponds chronologically to a later year. Thus, a valid future class can propagate backward through one or more consecutive years with value `27`.

After iteration completes, the result is selected again in reverse order to restore the original chronological band sequence.

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
> **Temporal priority:** Internal gaps and gaps at the beginning of the series that have a valid observation in a later year are filled in this first pass with the nearest valid future class.

### 7.4 Second Pass: `forward_fill()`

The output of `backward_fill()` passes to `forward_fill()` without reversing the order. The iteration starts at 1985 and advances to 2025. Pixels that remain masked are filled with the most recently accumulated valid value.

After backward fill, the gaps that typically remain are those situated after the last valid observation for a pixel. Therefore, forward fill acts primarily on the trailing end of the series.

```javascript
var backward_filled = backward_fill(masked_input);
var fully_filled = forward_fill(backward_filled);
```

### 7.5 What Happens to a Pixel with No Data in All 41 Years?

If a pixel has value `27` in every band, `masked_input` remains masked across its entire trajectory. `backward_fill()` finds no valid class to propagate and `forward_fill()` does not either. The result stays masked. The script does not apply `fully_filled.unmask(27)` at the end, so this case does not automatically revert to value `27` in the exported product.

> [!WARNING]
> **Final NoData:** Do not assume that all original `27` values will end up converted to a class. A pixel with no valid observation across the entire series remains masked in the final product. If the methodology requires preserving `27` as explicit NoData, that decision must be verified or implemented separately.

### 7.6 Output Conversion and Metadata

`fully_filled` is cast to `Byte` and receives three properties: `version = output_version`, `country = country`, and `step = "gap-fill"`. The conversion is appropriate for the legend's class IDs as long as they remain within the unsigned byte range.

---

## 8. Output Products

### 8.1 Filtered Multiband Image

The main product is a multiband image that preserves the annual structure of the input and replaces resolvable gaps. With a correctly structured input, 41 bands are expected, corresponding to 1985–2025.

| Component | Description |
| :--- | :--- |
| **Bands** | Expected annual series: `classification_1985` … `classification_2025`. |
| **Valid values** | Original classes or classes propagated temporally from another year. |
| **Persistent gaps** | Remain masked if the pixel has no valid class across the entire series. |
| **Type** | `Byte`. |
| **Metadata** | `version`, `country`, `step = "gap-fill"`. |
| **Destination** | `classification-ft/<region_id>-<output_version>`. |

### 8.2 What the Script Does Not Produce

- Does not generate a band indicating which pixels were modified.
- Does not record, for each pixel, the source year used for filling.
- Does not compute statistics of how many gaps were filled per year.
- Does not apply transition, persistence, or thematic stability rules.
- Does not export the support mosaics or the ORIGINAL/FILLED layers displayed on the map.

> [!TIP]
> **Traceability recommendation:** For advanced QA it may be useful to produce, in a companion script, a per-year mask of modified pixels and a summary of gap count or percentage before and after the filter.

---

## 9. Visualization and Inspection

The `preview` variable controls which years are added to the map. In the reviewed configuration, `1990`, `1995`, `2018`, and `2020` are displayed. For each year, three layers are added: MOSAIC, ORIGINAL, and FILLED.

| Layer | Contents | Recommended use |
| :--- | :--- | :--- |
| `MOSAIC <year>` | Landsat `SWIR1–NIR–Red` mosaic. | Spectral and visual context for the year. |
| `ORIGINAL <year>` | `masked_input` for `classification_<year>`. | Identify `27` gaps, which appear as masked areas. |
| `FILLED <year>` | `filtered` for the same band. | Verify which gaps were replaced and with which class. |

### 9.1 Recommended Inspection Order

1. Turn on `ORIGINAL` and locate transparent areas that corresponded to value `27`.
2. Turn on `FILLED` and confirm that those areas receive a class consistent with the temporal trajectory and surrounding landscape.
3. Use `MOSAIC` as support, remembering that the filled class may come from a later or earlier year and not necessarily from the mosaic of the displayed year.
4. Compare several consecutive years around a gap to identify which observation was propagated.
5. Review the extremes 1985 and 2025 separately, where fill direction is especially important.

> [!NOTE]
> **Limitation of `preview` check:** The `all_bands.indexOf(selector)` condition only verifies that the year belongs to the `years` list; it does not confirm that the band actually exists in the input asset. Band existence and order should be verified in Console before running the export.

---

## 10. Execution Procedure

1. Open the script in the Earth Engine Code Editor and confirm that `user` points to the correct project.
2. Set `region_id` and `country` for the region to be processed.
3. Confirm `input_version` and verify that `classification-single/<region_id>-<input_version>` exists.
4. Print or inspect `input.bandNames()` and confirm 41 bands in 1985–2025 order.
5. Verify that the value used as classification absence is indeed `27` for this product.
6. Confirm `output_version` and ensure the destination asset will not cause an unintended collision.
7. Review `preview` and include, if necessary, years with known gaps and both series extremes.
8. Run the script and review `OUTPUT` in Console.
9. Inspect the ORIGINAL and FILLED layers for the `preview` years, using the mosaic as context.
10. Apply quantitative gap controls (before/after) when the region is critical or has many NoData pixels.
11. Review the Task created by `Export.image.toAsset()`.
12. Start the export only after completing visual and logical QA.
13. After completion, open the `classification-ft` asset and confirm bands, metadata, mask, and spatial coverage.

---

## 11. Product Interpretation and Usage

### 11.1 Interpreting a Filled Class

A class present in FILLED may have two origins: it may be the original valid value for that year, or a temporally inherited value. The script does not add a flag to distinguish between both cases in the final product. Therefore, when pixel-level traceability is required, the original asset should also be retained, or a difference mask should be generated.

### 11.2 Internal Gaps

When a valid observation exists after the gap, backward fill propagates it backward. For example, a trajectory `3, 27, 27, 21` becomes `3, 21, 21, 21`. The two gap years adopt class `21` because it is the first valid class found when traversing from the future.

### 11.3 Leading Gaps

A trajectory `27, 27, 3, 3` becomes `3, 3, 3, 3`. The valid value from 1987, in this conceptual example, propagates to 1986 and 1985 during `backward_fill()`.

### 11.4 Trailing Gaps

A trajectory `3, 3, 27, 27` cannot resolve the trailing gaps during `backward_fill()` because no valid future information exists. `forward_fill()` completes those years using class `3` from the last valid previous year.

### 11.5 Methodological Implication of Future-Priority

In a gap situated between two different classes, the algorithm favors the later class. For example, `3, 27, 21` becomes `3, 21, 21` rather than `3, 3, 21`. This rule is a consequence of the `backward_fill()` → `forward_fill()` execution order; it does not imply that the future class is thematically more probable. Users interpreting the product should be aware of this behavior.

> [!IMPORTANT]
> **Key interpretation:** Gap Fill does not reconstruct the actual moment of change within a data-free interval. If two different valid observations surround one or more `27` years, the code assigns those years to the later class.

---

## 12. Export and Naming Convention

The output is exported via `Export.image.toAsset()` as an Earth Engine batch task. The name and `assetId` are built from `region_id` and `output_version`.

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

| Item | Value in reviewed configuration |
| :--- | :--- |
| **Task name** | `92807-1` |
| **Destination** | `.../classification-ft/92807-1` |
| **Scale** | 30 m |
| **Export region** | Bounds of `input` geometry |
| **Pyramiding policy** | `sample` |
| **maxPixels** | `1e13` |

### 12.1 Pyramiding Policy

The script uses `sample` for all bands. In Earth Engine, `sample` and `mode` are both valid options for categorical data. `sample` takes a reference pixel when building coarser resolution levels, while `mode` selects the most frequent class when a mode exists. The policy mainly affects representation and queries at coarser scales, not the 30 m classification exported as the base resolution.

> [!NOTE]
> **Consistency check:** Maintain the same policy across regions and versions if the goal is comparable visualization behavior at reduced scales. If the MapBiomas Venezuela workflow standard changes to `mode`, explicitly document the version change.

---

## 13. Recommended Quality Control

### 13.1 Input Structure QA

- Confirm that `input` contains exactly the expected annual bands or, at minimum, that its first 41 positions unambiguously correspond to 1985–2025.
- Confirm that bands are in ascending chronological order.
- Confirm that the thematic NoData to be filled is `27` and that `27` does not represent a valid class that should be preserved.
- Verify that the geometry and mask of `input` correspond to the correct region.
- Confirm that `input_version` identifies the prior classification to be filtered.

### 13.2 Quantitative Gap QA

- Calculate per year the number or area of pixels with value `27` before the filter.
- Calculate per year the number or area of pixels remaining masked after the filter.
- To locate fills, compare the band masks of `masked_input` and `filtered` and count pixels that go from masked to valid. Compare class values separately where both images are valid to confirm that the filter preserved the original observations.
- Identify pixels with no valid observation in any of the 41 years, including existing masks and the value `27`. These pixels should remain masked.
- Check whether gaps concentrate along edges, scenes, historically cloudy zones, or specific classes.

### 13.3 Temporal QA

- Select test pixels with internal, leading, and trailing gaps and manually verify the expected result.
- In gaps surrounded by different classes, confirm that the future-class priority is understood and accepted.
- Review long sequences of `27`, because a single future observation can propagate backward across many previous years.
- Compare the Gap Fill series with the original classification before applying additional temporal filters.
- Do not use the absence of `27` as evidence of greater thematic accuracy: Gap Fill improves completeness, not necessarily accuracy.

### 13.4 Exported Asset QA

- Confirm the asset is stored in `classification-ft` and its name matches `<region_id>-<output_version>`.
- Confirm `Byte` data type, 30 m resolution, and `version`, `country`, `step` metadata.
- Verify no spatial shifts relative to `input`.
- Inspect the behavior of fully NoData pixels and check whether the final mask is as expected.
- Visually review several years not originally included in `preview`.

---

## 14. Troubleshooting

| Problem / symptom | Likely cause | Recommended action |
| :--- | :--- | :--- |
| `Image.select: band pattern/index out of range` | The image has fewer bands than expected or the order doesn't match `years_index`. | Review `input.bandNames()`, band count, and temporal order before processing. |
| Visualized years show band-not-found error | `preview` year belongs to `years`, but the asset lacks `classification_<year>`. | Verify actual band existence; the `all_bands` check does not validate the asset. |
| Transparent zones persist after Gap Fill | The pixel has no valid observation across the entire series, or a prior spatial mask exists. | Inspect the original trajectory and mask; decide whether to leave masked or revert explicitly to `27`. |
| An internal gap adopts the "later" class instead of the earlier one | This is the expected behavior of backward fill running first. | Review the methodological rule; change filter order only if methodology requires it and create a new version. |
| FILLED looks identical to ORIGINAL | There may be few eligible gaps in the reviewed year. | Compare the band masks or review years with more gap candidates. |
| MOSAIC appears empty | No mosaics are available for the selected year and region. | Check `mosaics.filterMetadata('year', 'equals', year)` and the mosaic assets. The fill itself uses the classification image. |
| Export exceeds limits or fails | Large extent, quota, or insufficient resources. | Review region, `maxPixels`, project status and quotas; run as batch and avoid heavy simultaneous QA computations. |
| Output asset already exists | `output_version` matches a prior output and overwrite is not enabled. | Increment `output_version` or explicitly manage the previous asset. |
| `country` does not match the region | `country` is a manual parameter and is not derived from `region_id`. | Correct `country` before exporting to maintain reliable metadata. |
| Temporally odd result after the filter | There may be a long `27` sequence between two different classes. | Inspect the original trajectory and remember that Gap Fill assigns the future class to internal gaps. |

---

## 15. Best Practices

- Do not change `input_version` and `output_version` simultaneously without recording which input produced each output.
- Always preserve the original `classification-single` asset for traceability and comparison.
- Validate `bandNames()` before running any band-index-based filter.
- Keep value `27` documented as the absence code and verify it has not changed between collections.
- Include in `preview` at least one early, one mid-series, and one recent year, and add 1985/2025 when investigating edge-of-series issues.
- Quantify gap reduction before accepting the output, especially in regions with complex Landsat coverage.
- Record any change in backward → forward order as a major methodological modification, because it changes internal gap assignments.
- Keep the functions `gap_fill()`, `backward_fill()`, and `forward_fill()` separate and documented for auditability.
- Use new versions instead of overwriting validated results.
- Apply post-Gap Fill temporal stability or plausibility filters as prescribed by the methodological workflow; do not attribute those functions to the Gap Fill.

---

## 16. References and Resources

- **Source script:** [`03-2-gapfill.js`](../03-2-gapfill.js)
- [Google Earth Engine – Code Editor](https://code.earthengine.google.com/)
- [`ee.Image.unmask`](https://developers.google.com/earth-engine/apidocs/ee-image-unmask)
- [`ee.Image.updateMask`](https://developers.google.com/earth-engine/apidocs/ee-image-updatemask)
- [`ee.List.iterate`](https://developers.google.com/earth-engine/apidocs/ee-list-iterate)
- [`ee.Image.select`](https://developers.google.com/earth-engine/apidocs/ee-image-select)
- [`Export.image.toAsset`](https://developers.google.com/earth-engine/apidocs/export-image-toasset)
- [Pyramiding policies / raster assets](https://developers.google.com/earth-engine/guides/image_upload)
- [MapBiomas Venezuela](https://venezuela.mapbiomas.org/)
- [Spatial Filter guide](./03-3-spatial-filter.en.md)
- Cardille, Crowley, Saah & Clinton (eds.), 2024. *Cloud-Based Remote Sensing with Google Earth Engine*. [DOI: 10.1007/978-3-031-26588-4](https://doi.org/10.1007/978-3-031-26588-4)

---

## Appendix A. Quick Execution Checklist

| Step | Action | Verification |
| :--- | :--- | :--- |
| 1 | Input | Confirm `classification-single/<region>-<input_version>`. |
| 2 | Structure | Verify 41 bands in 1985→2025 order. |
| 3 | NoData | Confirm `27` is the code to be filled. |
| 4 | Configuration | Review `region_id`, `country`, and `output_version`. |
| 5 | Preview | Select years with known gaps and temporal extremes. |
| 6 | Run | Review `OUTPUT` and check for band errors. |
| 7 | Inspect | Compare ORIGINAL vs FILLED and use MOSAIC as context. |
| 8 | QA | Quantify gaps before/after and review fully masked pixels. |
| 9 | Export | Start Task to `classification-ft` at 30 m. |
| 10 | Validate | Open final asset, review bands, metadata, and coverage. |

> [!CAUTION]
> **Quick decision rule:** If the asset does not have exactly the expected temporal order, do not run the Gap Fill until bands are corrected or explicitly selected. This script depends on positional indices.

---

## Appendix B. Variables and Functions Dictionary

### B.1 Main Variables

| Variable | Purpose |
| :--- | :--- |
| `user` | Earth Engine user/project namespace for asset paths. |
| `region_id` | Region code used by `functions.getRegion()`. |
| `country` | Text incorporated as output metadata. |
| `input_version` | Version of the `classification-single` product. |
| `output_version` | Version of the `classification-ft` product. |
| `years` | JavaScript array of 41 years, 1985–2025. |
| `preview` | Years displayed for visual inspection. |
| `all_bands` | `classification_<year>` names built from `years`. |
| `years_index` | `ee.List` 0…40 used to select bands by position. |
| `input` | Original multiband image. |
| `masked_input` | Input with value `27` converted to mask. |
| `backward_filled` | Result after propagating values from future years backward. |
| `fully_filled` | Result after the second (forward) traversal. |
| `filtered` | `Byte` product with metadata, used for visualization and export. |
| `mosaics` | Merged Venezuela/Guyana mosaic collection for visual support. |

### B.2 Functions

| Function | Purpose |
| :--- | :--- |
| `gap_fill(current_year_index, obj)` | Elemental operation: fills the current band with the previously filled band and updates the accumulator. |
| `forward_fill(image)` | Traverses bands from 1985 to 2025 and fills gaps with the last valid previous value. |
| `backward_fill(image)` | Reverses bands, traverses 2025 to 1985 and fills gaps with the first valid future value; then restores order. |
| `functions.getRegion(...)` | External function from the `utils` module returning the vector region and its raster mask. |
| `functions.getMapBiomasMosaics(...)` | External function retrieving mosaics for visualization. |

### B.3 Output Metadata

| Property | Value | Interpretation |
| :--- | :--- | :--- |
| `version` | `output_version` | Gap Fill product version. |
| `country` | `country` | Country manually declared for the product. |
| `step` | `"gap-fill"` | Identifies the methodological stage. |

---

## Appendix C. Temporal Behavior Examples

The following examples use simplified series to illustrate the logic. The symbol `27` represents the value that the script masks before applying the Gap Fill.

| Original series | After backward fill | Final result | Interpretation |
| :--- | :--- | :--- | :--- |
| `3, 27, 27, 21` | `3, 21, 21, 21` | `3, 21, 21, 21` | Internal gaps receive the nearest valid future class. |
| `27, 27, 3, 3` | `3, 3, 3, 3` | `3, 3, 3, 3` | Leading gaps are filled from the future. |
| `3, 3, 27, 27` | `3, 3, gap, gap` | `3, 3, 3, 3` | With no valid future, forward fill completes the trailing end. |
| `3, 27, 21` | `3, 21, 21` | `3, 21, 21` | In a gap between different classes, the later class takes priority. |
| `27, 27, 27, 27` | `gap, gap, gap, gap` | `gap, gap, gap, gap` | With no valid observation, the pixel remains masked. |
| `3, 27, 27, 21, 27, 30` | `3, 21, 21, 21, 30, 30` | `3, 21, 21, 21, 30, 30` | Each internal block adopts the next valid future class. |

### C.1 Conceptual Diagram

```text
INPUT (27 → mask)
        |
        v
BACKWARD FILL: 2025 → 1985
  gap = next valid value in time
        |
        v
FORWARD FILL: 1985 → 2025
  remaining gaps = last valid previous value
        |
        v
OUTPUT classification-ft
```

### C.2 QA Questions for a Trajectory

- How many years had value `27` before the filter?
- Is there a valid observation after the gap? If so, that class should dominate the backward fill.
- Is the gap after the last valid observation? If so, it should be filled by `forward_fill()`.
- Is the pixel empty for all 41 years? If so, it should remain masked.
- Does the filled class create an apparently odd transition? If so, remember that Gap Fill does not evaluate thematic plausibility and review the subsequent temporal filter.
