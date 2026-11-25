/**
 * @fileoverview GeoTIFF export utility for MapBiomas Venezuela Collection 4.
 * Exports selected annual classification bands from a multiband Google Earth Engine
 * asset as 8-bit GeoTIFF rasters to Google Drive.
 *
 * @author MapBiomas Venezuela Team
 * @version 1.0.0
 * @see {@link https://venezuela.mapbiomas.org|MapBiomas Venezuela}
 */

/** @type {string} Full Earth Engine asset ID of the multiband classification image. */
var asset_id =
  "projects/emanuel-valero/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft/92807-1";

/** @type {number[]} Target years to export as individual GeoTIFF files. */
var years = [2000, 2005, 2020];

// Load input image and resolve its base asset name.
/** @type {ee.Image} Multiband classification image. */
var image = ee.Image(asset_id);

/** @type {string} Base asset index name used to build export filenames. */
var imagename = image.get("system:index").getInfo();

// Iterate over target years and schedule Google Drive GeoTIFF export tasks.
years.forEach(function (year) {
  try {
    var bandname = "classification_" + year;

    Export.image.toDrive({
      image: image.select(bandname).byte(),
      description: imagename + "-" + year,
      folder: "RAISG-EXPORT",
      region: image.geometry().bounds(),
      scale: 30,
      crs: "EPSG:4326",
      maxPixels: 1e13,
      fileFormat: "GeoTIFF",
    });
  } catch (error) {
    print(error.message);
  }
});
