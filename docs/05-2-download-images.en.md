![MapBiomas Venezuela](../mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives) [![Back to README](https://img.shields.io/badge/%E2%86%90%20Back%20to%20README-gray?style=for-the-badge)](../README.md)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

[View script (`05-2-download-images.js`)](../05-2-download-images.js) · [Versión en español](./05-2-download-images.md)

# Image Export User Manual

MapBiomas Venezuela · Collection 4 · Manual 1.0

The script exports annual bands from a Google Earth Engine classification asset to Google Drive. Each requested year creates one task for a single-band GeoTIFF containing class IDs.

## Contents

- [1. Requirements and input](#1-requirements-and-input)
- [2. Parameters](#2-parameters)
- [3. How tasks are created](#3-how-tasks-are-created)
- [4. Extent, grid, and NoData](#4-extent-grid-and-nodata)
- [5. Execution and review](#5-execution-and-review)
- [6. Troubleshooting](#6-troubleshooting)
- [7. References](#7-references)

## 1. Requirements and input

- Access to the [Google Earth Engine Code Editor](https://code.earthengine.google.com/) and read access to the asset.
- A multiband image containing `classification_<year>` for each requested year.
- Google Drive access from the account running the tasks and enough storage for the files.

The example uses `projects/emanuel-valero/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft/92807-1`. Enter the full classification asset ID and check its region and version before creating the tasks.

## 2. Parameters

| Parameter | Script value | Effect |
| --- | --- | --- |
| `asset_id` | Regional asset `classification-ft/92807-1` | Source image. |
| `years` | `[2000, 2005, 2020]` | Years to export. Use distinct years for tasks with unique names. |
| `folder` | `'RAISG-EXPORT'` | Google Drive folder name, set inside `Export.image.toDrive()`. |
| `scale` | `30` | Requested resolution in meters per pixel. |
| `crs` | `'EPSG:4326'` | Output coordinate reference system. |
| `maxPixels` | `1e13` | Pixel limit for each task. |
| `fileFormat` | `'GeoTIFF'` | Output format. |

## 3. How tasks are created

1. The script loads `image` and reads its `system:index` property into `imagename`. This read uses `getInfo()` before the export loop.
2. For each entry in `years`, it builds `bandname` with the `classification_` prefix and selects that band. `byte()` casts the class IDs to unsigned 8-bit integers.
3. `Export.image.toDrive()` creates a task with the description `<system:index>-<year>`. Since the script omits `fileNamePrefix`, the description also serves as the file prefix. [Drive export reference](https://developers.google.com/earth-engine/apidocs/export-image-todrive)

| Year | Band | Description and file prefix if the index is `92807-1` |
| --- | --- | --- |
| 2000 | `classification_2000` | `92807-1-2000` |
| 2005 | `classification_2005` | `92807-1-2005` |
| 2020 | `classification_2020` | `92807-1-2020` |

## 4. Extent, grid, and NoData

- The requested region is the bounding rectangle of the image footprint, `image.geometry().bounds()`.
- `scale: 30` and `crs: 'EPSG:4326'` request nominal 30 m output on a geographic grid. Check the CRS, cell size, and alignment in your GIS when combining the output with another raster. Exact alignment to a reference grid requires its CRS and affine transform in place of setting only `scale`. [Exporting images and grids](https://developers.google.com/earth-engine/guides/exporting_images)
- The script exports class IDs and preserves the distinction between a masked cell and a valid cell with a value such as `27`. It sets no explicit GeoTIFF NoData value. Check how the receiving GIS interprets the mask.
- `maxPixels` raises the task's allowed limit. The extent and scale determine the raster's size.

## 5. Execution and review

1. Open the script and set `asset_id` and `years`. Confirm the band names and `system:index`. Check the destination folder and available storage.
2. Select **Run**. The example creates three tasks under **Tasks**. Check the Console if asset loading or task creation fails.
3. Start the tasks individually and monitor their status. Processing errors after a task starts appear under **Tasks**.
4. Open the files from Google Drive and use your GIS to verify one band per year, `UInt8` type, CRS, extent, grid, mask, and class IDs. For a quantitative check, compare class histograms or areas over a common area and comparable grid.

## 6. Troubleshooting

| Symptom | What to check |
| --- | --- |
| Loading the image or `system:index` fails | Check the ID, version, and permissions. The index is read before tasks are created. |
| An annual band is missing | Compare `years` with the actual band names. |
| The name differs from the expected ID | Inspect `system:index` and check the file prefix shown in the task. |
| The file cannot be found in Drive | Check that the task finished and that you are in the correct account and folder. If several folders share the name, Earth Engine chooses the most recently modified one. |
| The raster does not align with the source grid | Check its projection, transform, and extent. The output is requested in EPSG:4326. |
| Masked areas appear in an unexpected color | Check the GIS interpretation of the mask and NoData before reassigning values. |

## 7. References

- [Exporting images](https://developers.google.com/earth-engine/guides/exporting_images)
- [`Export.image.toDrive()`](https://developers.google.com/earth-engine/apidocs/export-image-todrive)
