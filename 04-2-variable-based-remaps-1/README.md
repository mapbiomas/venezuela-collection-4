![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Back to README](https://img.shields.io/badge/%E2%86%90%20Back%20to%20README-gray?style=for-the-badge)](../#readme)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[View script (`04-2-variable-based-remaps-1.js`)](./04-2-variable-based-remaps-1.js) · [Versión en español](./es/#readme)

# Variable-Based Remapping User Manual

MapBiomas Venezuela · Collection 4 · 1985–2025 series · Manual 1.0

The script remaps classes in selected years using thresholds for elevation, NDVI, and canopy height. Rules can be restricted to a specific area. The output contains the full annual series, and the Console displays area charts for selected classes.

| Example input | Example output | Product |
| --- | --- | --- |
| `classification/92420-1` | `classification-ft/92420-2` | Annual multiband image, `Byte`, 30 m |

## Contents

- [1. Requirements and sources](#1-requirements-and-sources)
- [2. Parameters](#2-parameters)
- [3. Rules and precedence](#3-rules-and-precedence)
- [4. Regions, missing bands, and NoData](#4-regions-missing-bands-and-nodata)
- [5. Execution and review](#5-execution-and-review)
- [6. Export](#6-export)
- [7. Examples and quality control](#7-examples-and-quality-control)
- [8. Troubleshooting](#8-troubleshooting)
- [9. References](#9-references)

## 1. Requirements and sources

In the [Google Earth Engine Code Editor](https://code.earthengine.google.com/), confirm read access to the inputs and write access to the output folder. The script uses `users/ejvalero/api:src/utils` to load mosaics and `users/mapbiomas/modules:Palettes.js` for the `classification9` palette, which it extends for display.

| Input | Path or use |
| --- | --- |
| Regional classification | `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification/<region_id>-<input_version>` |
| Regions | `projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion`. The script filters and rasterizes `id_regionc`. |
| Venezuela mosaics | `projects/mapbiomas-mosaics/assets/LANDSAT/LULC/VENEZUELA/mosaics-2` |
| Guyana mosaics | `projects/nexgenmap/MapBiomas2/LANDSAT/GUYANA/mosaics-2` |
| Canopy height | `users/potapovpeter/GEDI_V27`. The script mosaics the collection and names the band `canopy`. |
| Elevation | `NASA/NASADEM_HGT/001`, band `elevation`. |
| NDVI application area | `area_to_apply_ndvi`, a polygon defined in the script as an `ee.Feature` with `id: 1`. |

The script merges the two Landsat collections for the `full` season. It uses each year's mosaic for `ndvi_median` and context layers. Canopy height and elevation are shared across all years. Check that each selected year's mosaic contains the requested bands and that thresholds use the units stored in the assets.

## 2. Parameters

| Parameter | Script value | Effect |
| --- | --- | --- |
| `user` | `'mayerlings-488722'` | Project for the classification paths. |
| `region_ids` | `[92420]` | Regions to process. |
| `input_versions` / `output_versions` | `['1']` / `['2']` | Input and output versions for each region. |
| `processing_years` | 1985–2025 | Full series to assemble. |
| `remap_years` | `[2024, 2025]` | Years where rules run. An empty list selects all years. |
| `preview_years` | `[2015, 2025]` | Years displayed on the map. |
| `forest_ids` | `[3, 33]` | Classes used in the area charts. |
| `rules` | Three sequential rules | Sets classes, variables, thresholds, and restrictions. |

The region and version lists are read by position. Keep one input version and one output version per region because the script does not check list lengths. `preview_years` controls the map layers, and `remap_years` controls processing. With the current values, 2015 shows a year outside the remapping period, and 2025 shows an edited year.

## 3. Rules and precedence

| Order | Rule band | Condition on the stored value | Replacement | Application area |
| --- | --- | --- | --- | --- |
| 1 | `elevation` | ≤ 40 | 3 → 21 | Classification region |
| 2 | `ndvi_median` | ≤ 10,000 (`100 * 100`) | 3 → 21 | `area_to_apply_ndvi` polygon |
| 3 | `canopy` | ≤ 5 | 3 → 21 | Classification region |

`apply_rules()` reads the threshold from the property matching `band_name`. `create_condition()` accepts `gte`, `lte`, `gt`, `lt`, and `eq`. Each position in `from` must have a destination in the same position in `to`.

A rule can use a `years` array to narrow the global selection in `remap_years`. Omitting `years` applies the rule in every globally selected year. A rule with `years: []` runs in no years, while `remap_years: []` selects the full series. For spatial restrictions, `area_to_apply: null` uses the entire region. Given an area, the script rasterizes its numeric `id` property. Use features with a nonzero `id` that cover the intended area.

Each replacement uses `where()` on the band produced by the previous operation. With the current rules, a pixel already changed to 21 no longer matches source class 3. If you add rules with different sources or destinations, check their precedence with examples that trigger multiple rules. [Conditional replacement with `where()`](https://developers.google.com/earth-engine/apidocs/ee-image-where)

## 4. Regions, missing bands, and NoData

1. For each region, the script loads the classification and applies the mask rasterized from `id_regionc`.
2. Before selecting the annual bands, it adds fallback bands with value `27` and `overwrite: false`. An existing band keeps its name and takes precedence. Duplicate fallback bands get a suffix, and the annual selection uses the original names. [`addBands()` behavior](https://developers.google.com/earth-engine/apidocs/ee-image-addbands)
3. For eligible years, it combines the annual mosaic with `canopy` and `elevation` to evaluate the rules. For other years, it uses the prepared classification without remapping.
4. It assembles the full series and masks `27` in every band, including years outside `remap_years`. A missing band is present in the output schema but remains masked. Existing masks are also preserved.

> [!IMPORTANT]
> Code review found two geometry calls that need attention before running the script. While preparing a remap year, it calls `ee.Filter.bounds(region.vector)`, but `region` is the filtered collection and has no such property. Pass `region` or its geometry to the filter. The canopy mosaic also calls `.clip(regions)` with a feature collection. Earth Engine documents `clipToCollection(regions)` for that input type. [Spatial filter](https://developers.google.com/earth-engine/apidocs/ee-filter-bounds) · [Clipping to a collection](https://developers.google.com/earth-engine/apidocs/ee-image-cliptocollection)

For regions in `andean_region_ids`, the filter logic keeps mosaics with `ANDES` in `system:index` and other mosaics that intersect the region. The code reassigns the shared `mosaics` variable inside the loop. When configuring several regions in one run, check that a filter applied to an Andean region does not narrow the collection for subsequent regions.

## 5. Execution and review

1. Check the paths, the correspondence between the lists, the classification bands, and the mosaic bands. Review the geometry calls noted above and confirm the NDVI polygon matches the intended area.
2. Set `remap_years`, `rules`, and `preview_years`. Include an eligible year and, to check the scope, a year outside the selection.
3. Select **Run**. Compare `INPUT: <year> <region>` and `OUTPUT: <year> <region>`. Use `MOSAIC` for false-color context and `NDVI` to check the spatial rule. Both auxiliary layers start hidden.
4. Review one Console area chart for each class in `forest_ids`. The calculation multiplies each class mask by pixel area, divides by one million, and sums by region. The vertical axis is in km². The charts help identify jumps or area losses, and use the remapped output as input.
5. After review, start one task per region under **Tasks**. Check the asset name, band count, mask, and metadata.

## 6. Export

| Item | Value |
| --- | --- |
| Destination | `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft/<region_id>-<output_version>` |
| Image | `classification_1985` through `classification_2025`, `Byte` |
| Metadata | Region-specific `version` and `step = 'remaped-by-variables'` |
| Region | `region.geometry().bounds()` |
| Scale | 30 m |
| Pyramiding policy | `mode` |
| Export limit | `maxPixels: 1e13` |

## 7. Examples and quality control

All examples start with class 3. Unless specified, the year is eligible and the other criteria do not match.

| Case | Expected result |
| --- | --- |
| Elevation 40 | 21, because the threshold is inclusive. |
| NDVI 10,000 inside the polygon | 21. |
| NDVI 10,000 outside the polygon | 3. |
| Canopy height 5 | 21. |
| Elevation 20 in a year outside `remap_years` | 3. |
| The corresponding band is missing from the asset | The fallback band is masked in the output. |

- Compare the input bands and output mask to distinguish class replacements from NoData observations.
- Check that all valid changes fall in selected years and are 3 → 21 under the current rules. To isolate the NDVI effect, inspect pixels that meet neither the elevation nor the canopy condition and compare inside and outside the polygon.
- Quantify the 3 → 21 area by year and compare it against the area charts. Record thresholds, years, and the version by region.

## 8. Troubleshooting

| Symptom | What to check |
| --- | --- |
| Geometry error during **Run** | Check `ee.Filter.bounds(region.vector)` and the canopy clipping call described above. |
| Selecting an auxiliary band fails | Check that the annual mosaic includes `ndvi_median` and that preview mosaics include the required RGB bands. |
| Mosaic coverage is lost when processing several regions | Check the reassignment of `mosaics` in the Andean branch. |
| The NDVI rule produces no changes | Check the value on the asset's scale, the source class, the year, and the geometry's `id`. |
| An annual band appears empty | Check whether it was missing from the input or contained only masked values or `27`. |
| The expected task is missing | Check the region and version lists, permissions, and output folder. |

## 9. References

- [NASADEM in Earth Engine](https://developers.google.com/earth-engine/datasets/catalog/NASA_NASADEM_HGT_001) · [Rasterizing features](https://developers.google.com/earth-engine/apidocs/ee-featurecollection-reducetoimage)
- [Pixel area](https://developers.google.com/earth-engine/apidocs/ee-image-pixelarea) · [Exporting to assets](https://developers.google.com/earth-engine/apidocs/export-image-toasset)
- [Reference-Year Remapping guide](../04-3-year-based-remaps/#readme)
