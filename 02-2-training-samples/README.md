![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Back to README](https://img.shields.io/badge/%E2%86%90%20Back%20to%20README-gray?style=for-the-badge)](../#readme)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[View script (`02-2-training-samples.js`)](./02-2-training-samples.js) · [Versión en español](./es/#readme)

# User Manual: Annual Training Sample Generation

**Script:** [`02-2-training-samples.js`](./02-2-training-samples.js) · **Series:** 1985–2025 (41 years) · **Collection:** 4 · **Version:** 1.0

> **Purpose:** Guide the configuration, execution, quality review, and export of the script that generates annual training samples from Landsat mosaics, a thematic reference image, and MapBiomas Venezuela classification regions.

| Field | Details |
| :--- | :--- |
| **Manual version** | 1.0 |
| **Date** | August 17, 2026 |
| **Temporal coverage** | 1985–2025 (41 years) |
| **Reference resolution** | 30 m (`EPSG:4326` at 30 m scale) |
| **Scope** | MapBiomas Venezuela classification regions |

---

## Document Control

| Item | Description |
| :--- | :--- |
| **Title** | User Manual – Annual Training Sample Generation |
| **Base script** | [`02-2-training-samples.js`](./02-2-training-samples.js) |
| **Collection** | MapBiomas Venezuela – Collection 4 |
| **Configured region in script** | `region_id = 92531` |
| **Output version** | `version = 1` |
| **Scope** | Configuration, annual reference preparation, area calculation, sample allocation, visualization, export, and quality control. |

> [!NOTE]
> This manual documents the visible behavior of [`02-2-training-samples.js`](./02-2-training-samples.js). The functions `getRegion()`, `getMapBiomasMosaics()`, `remapWithPolygons()`, `getPointsPerClass()`, `getTrainingSamples()`, and `addPointsToMap()` belong to the external module `users/ejvalero/api:src/utils`; their internal implementation is not part of this file and is not reconstructed here.

---

## Contents

- [1. Introduction and Rationale](#1-introduction-and-rationale)
- [2. Objectives, Scope, and Audience](#2-objectives-scope-and-audience)
- [3. Requirements and Input Data](#3-requirements-and-input-data)
- [4. Core Concepts](#4-core-concepts)
- [5. Script Architecture](#5-script-architecture)
- [6. Configurable Parameters](#6-configurable-parameters)
- [7. Sample Generation Methodology](#7-sample-generation-methodology)
- [8. Output Products](#8-output-products)
- [9. Visualization and Inspection](#9-visualization-and-inspection)
- [10. Execution Procedure](#10-execution-procedure)
- [11. Sample Interpretation and Usage](#11-sample-interpretation-and-usage)
- [12. Export and Naming Convention](#12-export-and-naming-convention)
- [13. Recommended Quality Control](#13-recommended-quality-control)
- [14. Troubleshooting](#14-troubleshooting)
- [15. Best Practices](#15-best-practices)
- [16. References and Resources](#16-references-and-resources)
- [Appendix A. Quick Execution Checklist](#appendix-a-quick-execution-checklist)
- [Appendix B. Variables and Controls Dictionary](#appendix-b-variables-and-controls-dictionary)

### Reading Conventions

- Variable, function, property, and asset names appear exactly as written in the script.
- **Reference** refers to the thematic classification image used to assign a class label to each sample.
- **Mosaic** refers to the annual image containing the predictor bands defined in `feature_space`.
- For functions imported from the external utility module, this manual documents their inputs and how the script consumes their outputs.

---

## 1. Introduction and Rationale

Supervised classification requires a training dataset that pairs thematic reference labels with spectral bands and derived indices from Landsat mosaics. Across a multi-decade annual time series, sample quality and consistency directly govern the classifier's ability to capture spatial and temporal landscape variability in each region.

The script [`02-2-training-samples.js`](./02-2-training-samples.js) automates annual training sample preparation for 1985–2025. It combines a classification region, Venezuela and Guyana Landsat mosaics, a multiband reference image, remapping rules, and helper functions to compute per-class areas, allocate sample counts, and export one Earth Engine `Table Asset` (`FeatureCollection`) per year.

### 1.1 What Problem Does It Solve?

- Produces repeatable training samples across 41 years of the time series.
- Adapts the thematic reference through global class remapping and localized polygon remaps.
- Computes per-class area inside the region as input for stratified sample allocation.
- Skips years missing either a mosaic or a reference band cleanly before running Earth Engine exports.
- Maintains independent sample collections indexed by region, year, and version.
- Supports visual inspection of mosaics, reference layers, and sample points prior to classification.

---

## 2. Objectives, Scope, and Audience

### General Objective

Provide a reproducible guide to configure, run, and verify `02-2-training-samples.js`, explaining how annual reference layers are built, how samples are allocated and extracted, and which quality checks should precede supervised classification.

### Specific Objectives

- Document required Earth Engine assets, parameters, and external modules.
- Explain annual reference band selection, including the special 2025 rule.
- Describe class remapping and its masking behavior on unlisted values.
- Explain per-class area calculation and sample allocation calls.
- Document all 35 predictor variables requested from the mosaics.
- Establish a QA workflow covering reference layers, class distribution, points, and exported tables.

### Target Audience

MapBiomas Venezuela technical staff with basic or intermediate experience in Google Earth Engine, supervised classification, Landsat mosaic interpretation, and asset management.

---

## 3. Requirements and Input Data

### 3.1 Operational Requirements

- Access to the Google Earth Engine Code Editor and the target project.
- Read permissions on region, reference, and mosaic assets.
- Write permissions on the `SAMPLES` destination collection defined by `output`.
- Access to `users/ejvalero/api:src/utils` and `users/mapbiomas/modules:Palettes.js`.
- Availability of `reference_to_30` in the script environment, as it is referenced by `remap_polygons`.
- Presence of the target `region_id` in the `gridcode` attribute of the regions vector asset.

> [!CAUTION]
> **Critical check:** If `reference_to_30` is not imported or defined in the Code Editor before running the script, `var remap_polygons = [reference_to_30];` will throw a JavaScript `ReferenceError` and execution will stop immediately.

### 3.2 Classification Region

The region is loaded via `functions.getRegion()` from:

```text
projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion
```

It queries `gridcode` (`regions_field`) using `region_id = 92531` in the default configuration, exposing `region.vector` and `region.rasterMask`.

### 3.3 Annual Mosaics

The script loads Venezuela and Guyana mosaics via `functions.getMapBiomasMosaics()`, selects the 35 bands in `feature_space`, merges both collections, and filters to `season = "full"`. For each available year, it builds a yearly mosaic masked by `region.rasterMask`.

### 3.4 Reference Image

The thematic reference is a multiband image loaded from:

```text
projects/mapbiomas-venezuela/assets/LANDSAT/VENEZUELA-3/integracion/VENEZUELA-GUYANA-9
```

Each year selects a band prefixed with `classification`. The year `2025` is an explicit exception: it reuses `classification_2024` as its reference band.

```javascript
var selector =
  year === last_year
    ? reference_prefix + "_" + str_penultimate_year
    : reference_prefix + "_" + str_year;
```

> [!IMPORTANT]
> **2025 Rule:** With `last_year = 2025`, 2025 training samples are generated using `classification_2024` as reference. If a dedicated 2025 reference band becomes available in the future, review and update this rule accordingly.

---

## 4. Core Concepts

### 4.1 Training Sample

In this workflow, a training sample is a point feature pairing a reference class label with spectral attributes extracted from the yearly mosaic. One `FeatureCollection` is exported per year. Exact attribute names added by `getTrainingSamples()` depend on the external utility module, so inspect an exported asset before wiring it into a classifier.

### 4.2 Feature Space

`feature_space` specifies 35 predictor variables requested from the mosaics, combining median spectral bands, SMA fractions, spectral indices, and Tasseled Cap components. Maintaining consistency across mosaics, samples, and classifier inputs is mandatory.

### 4.3 Thematic Reference and Remapping

Before sampling, the yearly reference band is masked to the region and remapped via `remap_all_reference.from` and `remap_all_reference.to`. Most class IDs map to themselves, while explicit merges are `6 → 5` and `25 → 24`.

| Original class | Class after remap | Notes |
| :--- | :--- | :--- |
| `6` | `5` | Explicit merge defined in `remap_all_reference`. |
| `25` | `24` | Explicit merge defined in `remap_all_reference`. |
| Other listed IDs | Same ID | Preserved according to `from`/`to` arrays. |
| Value not in `from` | Masked out | `ee.Image.remap()` without `defaultValue` masks unmatched values. |

> [!IMPORTANT]
> The `from` array must list every reference class ID that should be retained. Because `ee.Image.remap()` is called without a `defaultValue`, any unlisted class value is masked out and will yield zero samples.

### 4.4 Spatial Polygon Remapping

After global remapping, the script calls `functions.remapWithPolygons(selected_reference, remap_polygons)`. Currently `remap_polygons` contains `[reference_to_30]`. Since polygon remap logic lives in the external module, verify its effect visually using the `REFERENCE <year>` map layer.

---

## 5. Script Architecture

| Step | Block | Purpose |
| :--- | :--- | :--- |
| 1 | Configuration | User namespace, region ID, years, feature space, sample targets, remaps, and version. |
| 2 | Paths & Modules | Output path, reference path, regions vector, mosaics, and helper libraries. |
| 3 | Palette | Loads `classification8` and extends indices up to `82`. |
| 4 | Input Data | Loads region boundary, Venezuela/Guyana mosaics, and multiband reference. |
| 5 | Availability Check | Fetches available mosaic years and reference band names once via `getInfo()`. |
| 6 | Annual Loop | Iterates over `1985–2025` and skips years missing required inputs. |
| 7 | Annual Reference | Selects reference band, applies region mask, global remap, polygon remap, and reprojection. |
| 8 | Areas & Allocation | Computes per-class area (`apply_areas`) and calls `getPointsPerClass()`. |
| 9 | Sampling | Calls `getTrainingSamples()` with yearly mosaic, reference, class IDs, and point counts. |
| 10 | Output & QA | Adds `year` property, creates `Export.table.toAsset()`, and displays `preview` layers. |

---

## 6. Configurable Parameters

Review these parameters at the top of the script before running a new region or version:

| Parameter | Current value | Controls |
| :--- | :--- | :--- |
| `user` | `"sig2-provita"` | Earth Engine user/project namespace used to build `output`. |
| `region_id` | `92531` | Target classification region identifier. |
| `years` | `[1985, ..., 2025]` | List of years to process. |
| `preview` | `[1985, 2000, 2025]` | Subset of years displayed on the map and printed to Console. |
| `feature_space` | 35 variables | Predictor bands and indices requested from the mosaics. |
| `samples` | `10000` | Target total sample count passed to `getPointsPerClass()`. |
| `min_samples` | `1000` | Minimum sample count per class passed to `getPointsPerClass()`. |
| `remap_all_reference` | `from`/`to` arrays | Global class remapping applied to the reference band. |
| `remap_polygons` | `[reference_to_30]` | Polygon collections passed to `remapWithPolygons()`. |
| `version` | `1` | Version suffix appended to each exported asset name. |
| `output` | `.../GENERAL/SAMPLES` | Destination Earth Engine folder for sample Table Assets. |
| `reference_path` | `.../VENEZUELA-GUYANA-9` | Multiband thematic reference image. |
| `regions` | `.../ve-gu-regiones-clasificacion` | Vector asset containing classification region polygons. |
| `regions_field` | `"gridcode"` | Attribute field identifying region IDs in `regions`. |
| `reference_prefix` | `"classification"` | Band name prefix in the reference image. |
| `last_year` | `2025` | Triggers the rule that reuses the previous year's (`2024`) reference band. |
| `rgb_combination` | `["swir1_median", "nir_median", "red_median"]` | False-color RGB band combination for mosaic preview layers. |

> [!NOTE]
> **Do not assume the allocation formula:** While `samples` and `min_samples` suggest a total target and per-class floor, the exact allocation math resides inside `getPointsPerClass()` in `users/ejvalero/api:src/utils`.

---

## 7. Sample Generation Methodology

### 7.1 Pre-Loop Availability Check

Before iterating over `years`, the script executes two lightweight `getInfo()` calls to retrieve available mosaic years and reference band names once, allowing the client-side `forEach()` loop to skip missing years cleanly:

```javascript
var available_mosaic_years = mosaics
  .aggregate_array("year")
  .distinct()
  .getInfo()
  .map(function (year) {
    return Number(year);
  });

var available_reference_bands = reference.bandNames().getInfo();
```

### 7.2 Annual Reference Selection

For 1985–2024, `selector = "classification_<year>"`. For 2025, `selector = "classification_2024"`. If the expected band is absent from `available_reference_bands` (or the year is missing from `available_mosaic_years`), the script prints a message and skips that year.

| Process year | Expected reference band |
| :--- | :--- |
| `1985` | `classification_1985` |
| `2000` | `classification_2000` |
| `2024` | `classification_2024` |
| `2025` | `classification_2024` |

### 7.3 Reference Preparation

The selected band is masked to `region.rasterMask`, remapped with `remap_all_reference`, renamed to `"reference"`, passed through `functions.remapWithPolygons()`, and explicitly reprojected to `EPSG:4326` at 30 m:

```javascript
var selected_reference = reference
  .select(selector)
  .updateMask(region.rasterMask)
  .remap(remap_all_reference.from, remap_all_reference.to)
  .rename("reference");

var year_reference = functions
  .remapWithPolygons(selected_reference, remap_polygons)
  .reproject({
    crs: "EPSG:4326",
    scale: 30,
  });
```

> [!WARNING]
> **Reprojection note:** The script explicitly enforces `reproject({ crs: "EPSG:4326", scale: 30 })`. Do not alter this step in isolation; validate any change across the entire sampling and classification pipeline.

### 7.4 Area Calculation per Class

`apply_areas()` combines `ee.Image.pixelArea().divide(1e6)` with the prepared reference and runs `reduceRegion()` using `ee.Reducer.sum().group()` over `region_vector.geometry()`. It safely handles regions with zero valid pixels (`stats.contains("groups")`) and stores rounded areas (km²) as `ID<classId>` properties (e.g., `ID3`, `ID21`, `ID81`).

```javascript
var area_image = ee.Image.pixelArea().divide(1e6).addBands(image);

var stats = area_image.reduceRegion({
  reducer: ee.Reducer.sum().group({
    groupField: 1,
    groupName: "classId",
  }),
  geometry: region_vector.geometry(),
  scale: 30,
  maxPixels: 1e13,
});
```

> [!NOTE]
> Areas are rounded with `round()`. Very small classes may record `0` km²; inspect `SAMPLING INFO <year>` to verify how `getPointsPerClass()` handles them.

### 7.5 Yearly Mosaic Assembly

The script filters `mosaics` by `year`, applies `mosaic()`, masks to `region.rasterMask`, and re-attaches the `year` metadata property.

### 7.6 Point Allocation per Class

`functions.getPointsPerClass(year_areas, samples, min_samples)` computes `points_count.ids` (class IDs) and `points_count.points` (requested sample count per class).

### 7.7 Sample Extraction

`functions.getTrainingSamples()` takes `[year]`, `ee.ImageCollection([year_mosaic])`, `year_reference`, `points_count.ids`, `points_count.points`, and `region.vector`, returning `training.data` (exportable collection) and `training.points` (for map display).

### 7.8 Final Collection & Export Setup

The script retrieves `training.data.get("samples-" + year)`, casts it to `ee.FeatureCollection`, sets `"year"` on each feature, and registers an `Export.table.toAsset()` task with `overwrite: true`.

---

## 8. Output Products

The persistent output consists of **annual Table Assets** (up to 41 export tasks, one per valid year):

| Product | Naming pattern | Contents |
| :--- | :--- | :--- |
| Annual samples | `<region_id>-<year>-<version>` | `FeatureCollection` generated by `getTrainingSamples()` with `year` property. |
| Example (1985) | `92531-1985-1` | Samples for region `92531`, year `1985`, version `1`. |
| Example (2025) | `92531-2025-1` | Samples for `2025` using `classification_2024` as reference. |

### Non-Exported Intermediate Outputs

Per-class areas (`year_areas`), `points_count`, and `training.points` are computed in memory and printed/displayed only for years listed in `preview`.

### Attribute Schema

Each exported feature explicitly receives the `year` property alongside reference labels and mosaic variables extracted by `getTrainingSamples()`. Inspect an exported asset before running the classifier.

---

## 9. Visualization and Inspection

For each year in `preview` (`[1985, 2000, 2025]`), the script adds map layers and prints summary statistics:

| Item | Layer / Console title | Purpose |
| :--- | :--- | :--- |
| Yearly mosaic | `MOSAIC <year>` | Spectral inspection in false-color `SWIR1–NIR–Red`. |
| Reference | `REFERENCE <year>` | Verifies thematic classes after masking and remaps. |
| Sample points | `SAMPLES <year>` | Visualizes spatial point distribution with the extended palette. |
| Console | `SAMPLING INFO <year>` | Displays per-class sample counts computed by `getPointsPerClass()`. |
| Console | `ÁREAS POR CLASE <year>` | Displays `ID*` area properties (km²) for the region. |

### 9.1 Extended Palette

The base `classification8` palette (indices 0–62) is extended via `extend_palette()` up to index `82` (filling intermediate gaps with gray `808080`) to support four Venezuela-specific classes:

| ID | Land cover class | Hex color |
| :--- | :--- | :--- |
| `66` | Shrubland | `#a89358` |
| `68` | Other non-vegetated natural areas | `#e97a7a` |
| `81` | Andean herbaceous/shrubby vegetation | `#dfeb62` |
| `82` | Flooded Andean herbaceous/shrubby vegetation | `#6fc179` |

---

## 10. Execution Procedure

### 10.1 Preparation

1. Open [`02-2-training-samples.js`](./02-2-training-samples.js) in the Google Earth Engine Code Editor.
2. Ensure `reference_to_30` is imported or defined.
3. Verify `user`, `region_id`, and `version`.
4. Confirm read/write access to `output`, `reference_path`, `regions`, `guyana_mosaics`, and `venezuela_mosaics`.
5. Check `years` and confirm the `last_year = 2025` exception is intended.
6. Review `remap_all_reference` and `remap_polygons` for the target region.
7. Review `samples` and `min_samples`.
8. Confirm all 35 `feature_space` bands exist in the mosaics.
9. Choose representative inspection years in `preview`.

### 10.2 Running in the Code Editor

1. Click **Run**.
2. Inspect `AVAILABLE MOSAIC YEARS` and `PALETTE SIZE` in **Console**.
3. Check for `"No hay mosaicos disponibles para ..."` or `"No existe la banda de referencia ..."` notices.
4. For each `preview` year, review `SAMPLING INFO` and `ÁREAS POR CLASE`.
5. Toggle `MOSAIC`, `REFERENCE`, and `SAMPLES` layers across multiple zones of the region.
6. Open **Tasks** and verify all expected export tasks are listed.

### 10.3 Launching Exports

`Export.table.toAsset()` queues batch tasks in the **Tasks** tab.

> [!WARNING]
> **Overwrite enabled:** Exports set `overwrite: true`. Reusing `<region_id>-<year>-<version>` will overwrite any existing asset at that path. Increment `version` to preserve earlier runs.

---

## 11. Sample Interpretation and Usage

| Observed signal | Interpretation / recommended action |
| :--- | :--- |
| Class visible in `REFERENCE` but zero points | Check `SAMPLING INFO`, computed area, remapping, and actual class extent. |
| Points clustered in a small zone | Verify whether clustering reflects true class geometry or module sampling behavior. |
| Points on visually mismatched pixels | Check reference layer, `remap_polygons`, mosaic year, and temporal alignment. |
| 2025 mirrors 2024 spatial patterns | Expected behavior: 2025 uses `classification_2024` as reference. |
| A class disappears after remapping | Ensure its ID is included in `remap_all_reference.from` and verify `from → to`. |
| Area = `0` for a small visible class | `apply_areas()` rounds to integer km²; verify effect on `getPointsPerClass()`. |

### Temporal & Classifier Consistency

- The mosaic always matches the target year; the reference matches the target year except in 2025 (which uses 2024).
- Ensure exported sample attributes cover the `feature_space` required by [`03-0-classifier.js`](../03-0-classifier/03-0-classifier.js) (note that `02-2-training-samples.js` includes `tir_median`, whereas `03-0-classifier.js` uses 34 bands without `tir_median`, which remains fully compatible).

---

## 12. Export and Naming Convention

- **Output path:** `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/SAMPLES`
- **Asset name:** `<region_id>-<year>-<version>` (e.g., `92531-2000-1`)
- **Asset type:** `Table Asset` via `Export.table.toAsset()` with `overwrite: true` (no Google Drive export).

---

## 13. Recommended Quality Control

### Before Running Tasks

- Confirm `region_id` and valid definition of `reference_to_30`.
- Verify `AVAILABLE MOSAIC YEARS` covers target years and `reference` includes `classification_2024` for 2025.
- Confirm `remap_all_reference.from` includes all class IDs to retain.
- Cross-check `ÁREAS POR CLASE` and `SAMPLING INFO` against `REFERENCE`, `MOSAIC`, and `SAMPLES` for `preview` years.
- Confirm task count and naming in **Tasks**.

### After Exporting

- Open at least an early year, a mid-series year, and `2025`.
- Verify all features contain the `year` property and all 35 predictor attributes.
- Record region, year, `version`, execution date, and reference asset in the project log.

---

## 14. Troubleshooting

| Issue | What to check / solution |
| :--- | :--- |
| `reference_to_30 is not defined` | Import or define `reference_to_30` before `remap_polygons` (or adjust for your region). |
| `No hay mosaicos disponibles para <year>` | Year missing from `available_mosaic_years`; check mosaic collections, `year`, and `season = "full"`. |
| `No existe la banda de referencia classification_YYYY` | Check `reference_path` and `bandNames()`; 2025 expects `classification_2024`. |
| Class missing from prepared reference | Check `remap_all_reference.from`; unlisted values are masked out. |
| `SAMPLING INFO` looks unbalanced | Check `year_areas`, `samples`, `min_samples`, and `getPointsPerClass()` in the external module. |
| `ÁREA POR CLASE = 0` for small class | `apply_areas()` rounds to integer km²; inspect actual area and sample allocation. |
| Points outside expected zones | Compare `REFERENCE`, `remap_polygons`, `region.rasterMask`, and mosaic year. |
| Export overwrites existing asset | `overwrite: true` is active; increment `version` to keep prior runs. |
| Export task fails | Verify write permissions on `output`, `assetId`, project quota, and **Tasks** error message. |
| Missing bands in exported samples | Verify `feature_space` and bands present in the yearly mosaic. |

---

## 15. Best Practices

- Validate one region end-to-end before launching batch runs for multiple regions.
- Increment `version` whenever reference data, remaps, `feature_space`, or sampling parameters change.
- Avoid changing `samples`, `min_samples`, and `remap_all_reference` simultaneously without logging each change.
- Keep `preview` covering an early year (`1985`), a mid-series year (`2000`), and the final year (`2025`).
- Avoid adding extra `getInfo()` calls inside the annual loop.
- Document the `2025 → 2024 reference` exception in project metadata/logs.

---

## 16. References and Resources

- **Source script:** [`02-2-training-samples.js`](./02-2-training-samples.js)
- [Google Earth Engine – Code Editor](https://code.earthengine.google.com/)
- [Google Earth Engine – Client vs. Server](https://developers.google.com/earth-engine/guides/client_server)
- [Google Earth Engine – `ee.Image.remap`](https://developers.google.com/earth-engine/apidocs/ee-image-remap)
- [Google Earth Engine – `ee.Image.reproject`](https://developers.google.com/earth-engine/apidocs/ee-image-reproject)
- [Google Earth Engine – `ee.Image.reduceRegion`](https://developers.google.com/earth-engine/apidocs/ee-image-reduceregion)
- [Google Earth Engine – Grouped reductions](https://developers.google.com/earth-engine/guides/reducers_grouping)
- [Google Earth Engine – `Export.table.toAsset`](https://developers.google.com/earth-engine/apidocs/export-table-toasset)
- [MapBiomas Venezuela](https://venezuela.mapbiomas.org/)
- Cardille, Crowley, Saah & Clinton (eds.), 2024. *Cloud-Based Remote Sensing with Google Earth Engine*. [DOI: 10.1007/978-3-031-26588-4](https://doi.org/10.1007/978-3-031-26588-4)

---

## Appendix A. Quick Execution Checklist

| Step | Action | Verification |
| :--- | :--- | :--- |
| 1 | Select region | Set `region_id` and verify `gridcode`. |
| 2 | Check spatial reference | Confirm `reference_to_30` is defined. |
| 3 | Check asset paths | Confirm mosaics, `reference_path`, `regions`, and `output` access. |
| 4 | Review years | `1985–2025`; confirm `2025` uses `classification_2024`. |
| 5 | Review remaps | Verify `from`/`to` lists and `remap_polygons`. |
| 6 | Review parameters | Verify `samples`, `min_samples`, and `version`. |
| 7 | Run script | Click **Run**; inspect `AVAILABLE MOSAIC YEARS` and Console messages. |
| 8 | Inspect layers | Review `MOSAIC`, `REFERENCE`, and `SAMPLES` for `1985`, `2000`, and `2025`. |
| 9 | Check allocation | Review `SAMPLING INFO` and `ÁREAS POR CLASE`. |
| 10 | Launch Tasks | Confirm task names and `overwrite: true`. |
| 11 | Verify outputs | Open exported assets and check schema, `year`, classes, and bands. |

---

## Appendix B. Variables and Controls Dictionary

### B.1 Feature Space (35 Variables)

| # | Variable | # | Variable |
| :--- | :--- | :--- | :--- |
| 1 | `blue_median` | 2 | `green_median` |
| 3 | `red_median` | 4 | `nir_median` |
| 5 | `swir1_median` | 6 | `swir2_median` |
| 7 | `tir_median` | 8 | `gv_median` |
| 9 | `npv_median` | 10 | `soil_median` |
| 11 | `cloud_median` | 12 | `shade_median` |
| 13 | `ndfi_median` | 14 | `ndvi_median` |
| 15 | `evi_median` | 16 | `savi_median` |
| 17 | `gndvi_median` | 18 | `ndmi_median` |
| 19 | `nbr_median` | 20 | `ndwi_median` |
| 21 | `mndwi_median` | 22 | `awei_median` |
| 23 | `wri_median` | 24 | `cmri_median` |
| 25 | `mvi_median` | 26 | `ndbi_median` |
| 27 | `ui_median` | 28 | `bsi_median` |
| 29 | `ndsi_median` | 30 | `iron_oxide_median` |
| 31 | `ndti_median` | 32 | `msavi2_median` |
| 33 | `tc_brightness_median` | 34 | `tc_greenness_median` |
| 35 | `tc_wetness_median` | | |

### B.2 Global Reference Remap (`remap_all_reference`)

| `from` | `to` | Effect |
| :--- | :--- | :--- |
| `3`, `4`, `5` | `3`, `4`, `5` | Keep ID |
| `6` | `5` | **Remap (`6 → 5`)** |
| `7`, `9`, `11`, `12`, `13`, `14`, `15`, `18`, `19`, `20`, `21`, `22`, `23`, `24` | Same ID | Keep ID |
| `25` | `24` | **Remap (`25 → 24`)** |
| `26`, `29`, `30`, `31`, `32`, `33`, `34`, `35`, `50`, `66`, `68`, `81`, `82` | Same ID | Keep ID |

### B.3 Availability and Control Variables

| Variable / output | Meaning |
| :--- | :--- |
| `available_mosaic_years` | Client-side list of years present in the merged mosaic collection. |
| `available_reference_bands` | Client-side list of band names in `reference`. |
| `selector` | Selected reference band name for the current year. |
| `year_reference` | Annual reference after masking, remaps, and reprojection. |
| `year_areas` | Region `FeatureCollection` with `ID*` per-class area properties (km²). |
| `points_count.ids` | Class IDs passed to the sampler. |
| `points_count.points` | Sample count per class computed by `getPointsPerClass()`. |
| `training.data` | Dictionary holding the `samples-<year>` collection. |
| `training.points` | Sample points passed to `addPointsToMap()` for visual inspection. |
| `collection` | Final `FeatureCollection` exported with the `year` property. |
| `filename` | `<region_id>-<year>-<version>`. |

### B.4 Quick Diagnostic Lookup

| Question | Where to check |
| :--- | :--- |
| Is a mosaic available for the year? | `AVAILABLE MOSAIC YEARS` / `available_mosaic_years` |
| Does the reference band exist? | `available_reference_bands` and Console messages |
| Which reference does 2025 use? | `selector` → `classification_2024` |
| Which classes remain after remapping? | `REFERENCE <year>` and `remap_all_reference` |
| How much area does each class cover? | `ÁREAS POR CLASE <year>` |
| How many points were allocated? | `SAMPLING INFO <year>` |
| Where are the sample points located? | `SAMPLES <year>` |
| Which variables feed the mosaic? | `feature_space` |
| Where is the result saved? | `output + "/" + filename` |
| Can it overwrite an existing asset? | Yes, `Export.table.toAsset()` sets `overwrite: true` |
