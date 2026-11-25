/**
 * @fileoverview Spatial connectivity filter for MapBiomas Venezuela Collection 4.
 * Removes isolated pixels and small patches below a minimum connected-pixel
 * threshold by replacing them with the local focal mode in Google Earth Engine.
 *
 * @author MapBiomas Venezuela Team
 * @version 1.0.0
 * @see {@link https://venezuela.mapbiomas.org|MapBiomas Venezuela}
 */

/**
 * User configuration parameters.
 */

/** @type {string} Google Earth Engine username or project namespace for input/output assets. */
var user = "emanuel-valero";

/** @type {number} Classification region identifier. */
var region_id = 92807;

/** @type {string} Country name used for mosaic filtering and output metadata. */
var country = "GUYANA";

/** @type {number[]} Annual time series to filter spatially. */
var years = [
  1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997,
  1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010,
  2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023,
  2024, 2025,
];

/** @type {number} Maximum connected-component pixel count replaced by the focal mode. */
var min_connected_pixels = 5;

/** @type {number[]} Subset of years to display on the map for visual inspection. */
var preview = [1986, 2011, 2015];

/** @type {string} Input classification asset version suffix. */
var input_version = "1";

/** @type {string} Output spatially filtered asset version suffix. */
var output_version = "2";

/**
 * Asset paths, visualization settings, and filter configuration.
 */

/** @type {string} Attribute field name identifying the region ID in the vector asset. */
var regions_field = "gridcode";

/** @type {string} Input asset name constructed from region ID and input version. */
var input_name = region_id + "-" + input_version;

/** @type {string} Output asset name constructed from region ID and output version. */
var output_name = region_id + "-" + output_version;

/** @type {string} Earth Engine path to Guyana Landsat mosaics. */
var guyana_mosaics = "projects/nexgenmap/MapBiomas2/LANDSAT/GUYANA/mosaics-2";

/** @type {string} Earth Engine path to Venezuela Landsat mosaics. */
var venezuela_mosaics =
  "projects/mapbiomas-mosaics/assets/LANDSAT/LULC/VENEZUELA/mosaics-2";

/** @type {string} Input Earth Engine folder path containing filtered classifications. */
var input_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft";

/** @type {string} Output Earth Engine folder path for spatially filtered assets. */
var output_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft";

/** @type {string} Earth Engine path to the classification region vector dataset. */
var regions_path =
  "projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion";

/** @type {string[]} Official MapBiomas Collection 9 color palette. */
var palette = require("users/mapbiomas/modules:Palettes.js").get(
  "classification9",
);

/** @type {Object} Shared MapBiomas Venezuela helper module. */
var functions = require("users/ejvalero/api:src/utils").functions;

/** @type {string[]} False-color RGB band combination for mosaic visualization. */
var rgb_combination = ["swir1_median", "nir_median", "red_median"];

/** @type {number[]} Region IDs belonging to the Andean classification zone. */
var andean_region_ids = [
  92001, 92002, 92003, 92004, 92005, 92006, 92007, 92008, 92009,
];

/** @type {Object} Map visualization parameters for land cover classification bands. */
var lulc_vis = { min: 0, max: palette.length - 1, palette: palette };

/** @type {Object} Map visualization parameters for Landsat mosaics. */
var mosaic_vis = { min: 0, max: 4000, bands: rgb_combination };

/** @type {string[]} Ordered list of annual classification band names. */
var all_bands = years.map(function (year) {
  return "classification_" + year;
});

/** @type {boolean} Whether to use 8-connected (diagonal + orthogonal) neighborhood connectivity. */
var eight_connected = true;

/**
 * Input data loading: region boundary, mosaics, and classification image.
 */

/** @type {Object} Region geometry, vector feature collection, and raster mask. */
var region = functions.getRegion(regions_path, regions_field, region_id);

/** @type {ee.Filter} Filter matching Andean mosaic tiles by system:index. */
var in_andean_filter = ee.Filter.stringContains("system:index", "ANDES");

/** @type {ee.Filter} Negated Andean mosaic filter. */
var out_andean_filter = in_andean_filter.not();

/** @type {ee.Filter} Spatial bounds filter for the current region. */
var bounds_filter = ee.Filter.bounds(region.vector);

/** @type {ee.Filter} Combined filter retaining Andean tiles plus intersecting non-Andean tiles. */
var andean_filter = ee.Filter.or(
  in_andean_filter,
  ee.Filter.and(out_andean_filter, bounds_filter),
);

/** @type {ee.ImageCollection} Guyana Landsat mosaics filtered to RGB bands. */
var gu_mosaics = functions.getMapBiomasMosaics({
  path: guyana_mosaics,
  country: "GUYANA",
  variables: rgb_combination,
});

/** @type {ee.ImageCollection} Venezuela Landsat mosaics filtered to RGB bands. */
var ve_mosaics = functions.getMapBiomasMosaics({
  path: venezuela_mosaics,
  country: "VENEZUELA",
  variables: rgb_combination,
});

ve_mosaics =
  andean_region_ids.indexOf(region_id) !== -1
    ? ve_mosaics.filter(andean_filter)
    : ve_mosaics;

/** @type {ee.ImageCollection} Combined full-season mosaics for Venezuela and Guyana. */
var mosaics = ve_mosaics
  .merge(gu_mosaics)
  .filterMetadata("season", "equals", "full");

/** @type {ee.Image} Multiband input classification image. */
var input = ee.Image(input_path + "/" + input_name);

/**
 * Spatial filtering: compute per-band connected pixel counts and replace
 * components up to `min_connected_pixels` with the 3x3 focal mode.
 */

/** @type {ee.Image} Input image augmented with `<band>_connected` pixel-count bands. */
var connected_image = functions.connectPixels(input, eight_connected);

/** @type {ee.Image} Spatially filtered multiband classification image. */
var fully_filtered = apply_spatial_filter(
  connected_image,
  years,
  min_connected_pixels,
);

/** @type {ee.Image} Final Byte-cast spatially filtered image with output metadata attached. */
var filtered = fully_filtered
  .byte()
  .set({ version: output_version, country: country, step: "spatial-filter" });

/**
 * Map preview and Earth Engine asset export.
 */
preview.forEach(function (year) {
  // Add yearly mosaic layer to map.
  var filtered_mosaic = mosaics.filterMetadata("year", "equals", year);

  var year_mosaic = filtered_mosaic.mosaic().updateMask(region.rasterMask);

  Map.addLayer(year_mosaic, mosaic_vis, "MOSAIC " + year, false);

  // Add original and spatially filtered classification layers for the current year.
  var selector = "classification_" + year;

  if (all_bands.indexOf(selector) !== -1) {
    lulc_vis.bands = selector;

    Map.addLayer(input, lulc_vis, "ORIGINAL " + year, false);

    Map.addLayer(filtered, lulc_vis, "FILLED " + year, false);
  }
});

Export.image.toAsset({
  image: filtered,
  description: output_name,
  assetId: output_path + "/" + output_name,
  pyramidingPolicy: { ".default": "sample" },
  region: input.geometry().bounds(),
  scale: 30,
  maxPixels: 1e13,
});

/**
 * Applies a 3x3 square focal-mode filter to pixels whose connected-component
 * size is less than or equal to `minConnectedPixels`.
 *
 * @param {ee.Image} image - Multiband image containing `classification_<year>` and `classification_<year>_connected` bands.
 * @param {number[]} years - Target years to process.
 * @param {number} minConnectedPixels - Connected-component threshold for replacement.
 * @returns {ee.Image} Spatially filtered multiband classification image.
 */
function apply_spatial_filter(image, years, minConnectedPixels) {
  var output = ee.Image(0);

  var bands = [];

  years.forEach(function (year) {
    var inputImage = image.select("classification_" + year);
    var connected = image.select("classification_" + year + "_connected");

    var moda = inputImage
      .focal_mode(1, "square", "pixels")
      .mask(connected.lte(minConnectedPixels));

    var classification = inputImage.blend(moda);

    output = output.addBands(classification);
    bands.push("classification_" + year);
  });

  return output.select(bands);
}
