/**
 * @fileoverview Year-based post-classification remapping for MapBiomas Venezuela Collection 4.
 * Reclassifies selected classes within a target year range wherever a pixel matches
 * a reference class in a designated base year, in Google Earth Engine.
 *
 * @author MapBiomas Venezuela Team
 * @version 1.0.0
 * @see {@link https://venezuela.mapbiomas.org|MapBiomas Venezuela}
 */

/**
 * User configuration parameters.
 */

/** @type {string} Google Earth Engine username or project namespace for input/output assets. */
var user = "sig5-provita";

/** @type {number} Classification region identifier. */
var region = 92809;

/** @type {number} Input classification asset version number. */
var input_version = 4;

/** @type {number} Output remapped asset version number. */
var output_version = 5;

/** @type {number} Reference year whose spatial mask drives historical class corrections. */
var base_year = 2025;

/** @type {number[]} Inclusive `[startYear, endYear]` range over which remapping is applied. */
var year_range = [1985, 2024];

/** @type {number[]} Subset of years to display on the map for visual inspection. */
var preview_years = [1985];

/**
 * List of `[targetBaseClass, classToReplace]` pairs.
 * Where `base_year` equals `targetBaseClass` and a year in `year_range` equals
 * `classToReplace`, that pixel is reclassified to `targetBaseClass`.
 * @type {Array<number[]>}
 */
var class_changes = [
  [3, 33],
  [3, 12],
];

/**
 * Asset paths and visualization configuration.
 */

/** @type {string} Input Earth Engine folder path containing filtered classifications. */
var input_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft";

/** @type {string} Output Earth Engine folder path for remapped assets. */
var output_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft";

/** @type {string} Earth Engine path to the classification region vector dataset. */
var regions_path =
  "projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion";

/** @type {string} Input asset name constructed from region ID and input version. */
var input_name = region + "-" + input_version;

/** @type {string} Output asset name constructed from region ID and output version. */
var output_name = region + "-" + output_version;

/** @type {string[]} Official MapBiomas Collection 8 color palette. */
var palette = require("users/mapbiomas/modules:Palettes.js").get(
  "classification8",
);

/** @type {Object} Map visualization parameters for land cover classification layers. */
var classification_vis = { min: 0, max: palette.length - 1, palette: palette };

/**
 * Input image loading and year-based remapping across sorted classification bands.
 */

/** @type {ee.Image} Multiband input classification image. */
var classified_image = ee.Image(input_path + "/" + input_name);

/** @type {ee.List} Sorted list of classification band names. */
var bands = classified_image.bandNames().sort();

/** @type {ee.Image[]} List of processed single-band classification images. */
var modified_bands = [];

bands.getInfo().forEach(function (band_name) {
  var year = parseInt(band_name.split("_")[1], 10);

  var current_band = classified_image.select([band_name]);

  if (year >= year_range[0] && year <= year_range[1]) {
    class_changes.forEach(function (change) {
      var original_class = change[0];
      var modified_class = change[1];

      var mask = classified_image
        .select(["classification_" + base_year])
        .eq(original_class);

      current_band = current_band.where(
        mask.and(current_band.eq(modified_class)),
        original_class,
      );
    });
  }

  modified_bands.push(current_band.rename([band_name]));
});

/** @type {ee.Image} Final multiband classification image with year-based remaps applied. */
var result_image = ee.Image(modified_bands);

/**
 * Map preview and Earth Engine asset export.
 */
visualize_years(classified_image, preview_years, "ORIGINAL");

visualize_years(result_image, preview_years, "MODIFIED");

Export.image.toAsset({
  image: result_image,
  description: output_name,
  assetId: output_path + "/" + output_name,
  region: classified_image.geometry(),
  scale: 30,
  pyramidingPolicy: { ".default": "mode" },
  maxPixels: 1e13,
});

/**
 * Adds classification bands for specific preview years to the Earth Engine map.
 *
 * @param {ee.Image} image - Multiband classification image.
 * @param {number[]} years - Years to display on the map.
 * @param {string} name - Layer name prefix.
 * @returns {void}
 */
function visualize_years(image, years, name) {
  years.forEach(function (year) {
    var band_name = "classification_" + year;
    var year_band = image.select([band_name]);

    Map.addLayer(year_band, classification_vis, name + " " + year, false);
  });
}
