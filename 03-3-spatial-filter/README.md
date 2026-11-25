![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Back to README](https://img.shields.io/badge/%E2%86%90%20Back%20to%20README-gray?style=for-the-badge)](../#readme)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[View script (`03-3-spatial-filter.js`)](./03-3-spatial-filter.js) · [Versión en español](./es/#readme)

# Spatial Filter User Manual

MapBiomas Venezuela · Collection 4 · 1985–2025 series · Manual 1.0

This filter reduces spatial noise in the annual classification. It selects pixels in small connected components and replaces them with the most frequent class in their immediate neighborhood. It processes each year independently.

| Example input | Example output | Product |
| --- | --- | --- |
| `classification-ft/92807-1` | `classification-ft/92807-2` | Annual multiband image, `Byte`, 30 m |

## Contents

- [1. Requirements and inputs](#1-requirements-and-inputs)
- [2. Parameters](#2-parameters)
- [3. How it works](#3-how-it-works)
- [4. Execution and review](#4-execution-and-review)
- [5. Export](#5-export)
- [6. Quality control](#6-quality-control)
- [7. Troubleshooting](#7-troubleshooting)
- [8. Examples and quick reference](#8-examples-and-quick-reference)
- [9. References](#9-references)

## 1. Requirements and inputs

- Access to the [Google Earth Engine Code Editor](https://code.earthengine.google.com/), the regional classification asset, and the project set in `user`. The output folder must exist and be writable.
- For the complete series, the input image must include the `classification_1985` through `classification_2025` bands. With the script defaults, it can be the output of [Gap Fill](../03-2-gapfill/#readme).
- Access to `users/ejvalero/api:src/utils` and `users/mapbiomas/modules:Palettes.js`, which provides the `classification9` palette.
- Access to the region asset `projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion` and the Landsat mosaics used for the preview.

The input and output paths share the folder `projects/<user>/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft`. Asset names follow the `<region_id>-<version>` pattern.

`functions.getRegion()` looks up the region by `gridcode`. For the preview, the script merges the Venezuela (`projects/mapbiomas-mosaics/assets/LANDSAT/LULC/VENEZUELA/mosaics-2`) and Guyana (`projects/nexgenmap/MapBiomas2/LANDSAT/GUYANA/mosaics-2`) Landsat collections and filters for `season = 'full'`. For the configured Andean regions, it keeps Venezuela tiles identified as `ANDES` and other Venezuela tiles that intersect the region. The region mask applies to the mosaic display. The filter operates on the input classification.

## 2. Parameters

| Parameter | Script value | Effect |
| --- | --- | --- |
| `user` | `'emanuel-valero'` | Project used to build the input and output paths. |
| `region_id` | `92807` | Classification region and asset name prefix. |
| `country` | `'GUYANA'` | Output metadata. The mosaic collections are loaded with their own country codes. |
| `years` | 1985–2025 | Annual bands to filter and include in the output. |
| `min_connected_pixels` | `5` | Inclusive threshold. A component with a connectivity count of five pixels is eligible. |
| `eight_connected` | `true` | Requests an eight-connected neighborhood from `connectPixels()`, including diagonals. |
| `preview` | `[1986, 2011, 2015]` | Years added to the map for review. |
| `input_version` | `'1'` | Input asset suffix. |
| `output_version` | `'2'` | Output asset suffix. Choose an available name. |

A higher threshold can affect larger components. When comparing thresholds, record the versions and quantify the changes by class and year.

## 3. How it works

1. The external `functions.connectPixels(input, eight_connected)` helper returns the image from which the script selects two bands per year. `classification_<year>` contains the classification and `classification_<year>_connected` reports the size of the connected component of the same class. The implementation of `connectPixels()` lives in the external module.
2. `apply_spatial_filter()` computes the mode of each annual band with `focal_mode(1, 'square', 'pixels')`. With a one-pixel radius, the square kernel covers a 3 × 3 window.
3. The script masks the focal mode with `connected.lte(minConnectedPixels)`. `blend()` overlays that mode on the input classification at the selected positions.
4. The filter assembles the annual bands in the order of `years`. The final selection by name drops the placeholder band used to initialize the image.

```javascript
var input_image = image.select('classification_' + year);
var connected = image.select('classification_' + year + '_connected');
var moda = input_image
    .focal_mode(1, 'square', 'pixels')
    .mask(connected.lte(min_connected_pixels));
var classification = input_image.blend(moda);
```

> [!IMPORTANT]
> The replacement condition applies to every class, including class 24. Inspect urban patches, small water bodies, rivers, coastlines, mines, and other narrow or fragmented land covers for systematic losses.

## 4. Execution and review

1. Open the script in the Code Editor. Check the project, region, versions, and asset permissions.
2. Confirm the annual bands, threshold, and connectivity. Choose representative preview years.
3. Select **Run**. Turn on `MOSAIC <year>` for the Landsat context in false color (SWIR1, NIR, and red).
4. Toggle between `ORIGINAL <year>` and `FILLED <year>`, and use the **Inspector** to compare values. `FILLED` is the spatially filtered result. All three layers start hidden.
5. Once the result passes review, start the `<region_id>-<output_version>` task in **Tasks**.
6. Open the exported asset and check its bands, scale, type, and metadata before using it in the next step.

## 5. Export

| Item | Value |
| --- | --- |
| Destination | `classification-ft/<region_id>-<output_version>` |
| Bands and type | One `classification_<year>` band per year in `years`, as `Byte` |
| Metadata | `version = output_version`, `country`, `step = 'spatial-filter'` |
| Region | `input.geometry().bounds()` |
| Scale | 30 m |
| Pyramiding policy | `sample` for all bands |
| Export limit | `maxPixels: 1e13` |

The export saves the classification. The connectivity bands serve as intermediate inputs. Inspect differences at the native 30 m scale as well, since the `sample` policy controls how coarser levels of the asset are built.

## 6. Quality control

- Compare `ORIGINAL` and `FILLED` by year. To quantify the effect, build a separate mask of positions where they differ and calculate the number or percentage of changed pixels.
- Check that changes cluster in the selected components. An unchanged pixel may belong to a large component or have a focal mode equal to its original value.
- Compare class areas before and after filtering. A source-to-destination replacement matrix can reveal systematic losses of small land-cover patches.
- Inspect narrow features and class boundaries against the Landsat mosaic. Review changed pixel trajectories for jumps introduced by processing each year independently.
- To assess a threshold change, compare settings such as 3, 5, and 8 pixels in representative regions and record the result associated with each version.

## 7. Troubleshooting

| Symptom | What to check |
| --- | --- |
| Selecting a `*_connected` band fails | Inspect `connected_image.bandNames()` and check the external module's output and permissions. |
| Many changes or loss of narrow features | Compare connectivity counts and focal modes in affected areas. Evaluate a lower threshold with the same checks. |
| A class 24 patch changes | Inspect the component size and focal mode. Class 24 is evaluated against the same threshold. |
| The mosaic is missing | Check the `preview` year, mosaic availability, season filter, and regional coverage. |
| The result looks different at another zoom level | Compare the data at 30 m and check the levels built with the `sample` policy. |
| Export fails or the name already exists | Check permissions, the destination folder, export extent, and whether the `output_version` suffix is available. |

## 8. Examples and quick reference

In this 3 × 3 window, the focal mode is 3. The center pixel changes from 21 to 3 if the connectivity band reports five pixels or fewer.

```text
3   3   3
3  21   3
3   3   3
```

| Case | Expected result |
| --- | --- |
| A component of size 5 with a different focal mode | The focal mode is applied. The threshold includes 5. |
| A component of size 6 with a different focal mode | The original value is retained. |
| A narrow segment of class 11 surrounded by class 3 | It may change wherever it meets the threshold and the focal mode is 3. |
| A small component whose focal mode matches its class | The before-and-after comparison shows the same value. |

| Identifier | Role |
| --- | --- |
| `connected_image` | Input with annual classification bands and their connectivity bands. |
| `apply_spatial_filter()` | Computes and overlays the annual focal mode and reconstructs the series. |
| `fully_filtered` | Filter result before type conversion and metadata attachment. |
| `filtered` | `Byte` image used for the preview and `Export.image.toAsset()`. |

## 9. References

- [Focal mode filter](https://developers.google.com/earth-engine/apidocs/ee-image-focalmode) · [Overlay with `blend()`](https://developers.google.com/earth-engine/apidocs/ee-image-blend) · [Image masks](https://developers.google.com/earth-engine/apidocs/ee-image-mask)
- [Exporting to assets](https://developers.google.com/earth-engine/apidocs/export-image-toasset) · [Pyramiding policy](https://developers.google.com/earth-engine/guides/image_upload)
- [Next workflow guide: Temporal Filter](../03-4-temporal-filter/#readme)
