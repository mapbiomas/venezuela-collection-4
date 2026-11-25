/**
 * @fileoverview User-level classification mosaic integration preview for MapBiomas Venezuela Collection 4.
 * Combines regional post-classification assets into a single mosaic and displays
 * annual Landsat mosaics alongside integrated classification layers in Google Earth Engine.
 *
 * @author MapBiomas Venezuela Team
 * @version 1.0.0
 * @see {@link https://venezuela.mapbiomas.org|MapBiomas Venezuela}
 */

/**
 * General configuration parameters.
 */

/** @type {string} Google Earth Engine username or project namespace for input assets. */
var user = "mayerlings-488722";

/** @type {boolean} When `true`, uses only Andean mosaics for Venezuela; otherwise excludes Andean tiles. */
var andean = false;

/** @type {number[]} Target years to display on the map. */
var years = [2015, 2020, 2025];

/** @type {string[]} Landsat mosaic bands used for false-color RGB visualization. */
var feature_space = ["swir1_median", "nir_median", "red_median"];

/**
 * Classification asset names (`<regionId>-<version>`) combined into the regional mosaic.
 * @type {string[]}
 */
var assets = [
  "92101-8",
  "92102-8",
  "92103-7",
  "92104-6",
  "92106-8",
  "92107-8",
  "92108-7",
  "92415-8",
  "92420-8",
  "92421-7",
  "92430-7",
  "92431-6",
];

/**
 * Input asset paths, helper modules, and visualization palette.
 */

/** @type {string} Input Earth Engine folder path containing filtered regional classifications. */
var input_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft";

/** @type {string} Earth Engine path to Guyana Landsat mosaics. */
var guyana_mosaics = "projects/nexgenmap/MapBiomas2/LANDSAT/GUYANA/mosaics-2";

/** @type {string} Earth Engine path to Venezuela Landsat mosaics. */
var venezuela_mosaics =
  "projects/mapbiomas-mosaics/assets/LANDSAT/LULC/VENEZUELA/mosaics-2";

/** @type {Object} Shared MapBiomas Venezuela helper module. */
var functions = require("users/ejvalero/api:src/utils").functions;

/** @type {string[]} Official MapBiomas Collection 9 color palette extended for class 66. */
var palette = require("users/mapbiomas/modules:Palettes.js").get(
  "classification9",
);

palette[66] = "#a89358";

/**
 * Load and prepare Landsat mosaics for Venezuela and Guyana.
 *
 * Venezuela mosaics are filtered according to the `andean` flag, then merged
 * with Guyana mosaics and restricted to the `full` season.
 */

/** @type {ee.Filter} Filter matching Andean mosaic tiles by system:index. */
var in_andean_filter = ee.Filter.stringContains("system:index", "ANDES");

/** @type {ee.Filter} Negated Andean mosaic filter. */
var out_andean_filter = in_andean_filter.not();

/** @type {ee.Filter} Filter retaining Andean mosaic tiles. */
var andean_filter = ee.Filter.or(in_andean_filter);

/** @type {ee.ImageCollection} Venezuela Landsat mosaics filtered to `feature_space`. */
var ve_mosaics = functions.getMapBiomasMosaics({
  path: venezuela_mosaics,
  country: "VENEZUELA",
  variables: feature_space,
});

/** @type {ee.ImageCollection} Guyana Landsat mosaics filtered to `feature_space`. */
var gu_mosaics = functions.getMapBiomasMosaics({
  path: guyana_mosaics,
  country: "GUYANA",
  variables: feature_space,
});

ve_mosaics = andean
  ? ve_mosaics.filter(andean_filter)
  : ve_mosaics.filter(out_andean_filter);

/** @type {ee.ImageCollection} Merged full-season mosaics for Venezuela and Guyana. */
var mosaics = ve_mosaics
  .merge(gu_mosaics)
  .filterMetadata("season", "equals", "full");

/**
 * Build the integrated classification mosaic from the configured regional assets.
 * Input images are expected to contain annual bands named `classification_YYYY`.
 */

/** @type {ee.Image[]} List of loaded regional classification images. */
var collection_list = assets.map(function (asset) {
  return ee.Image(input_path + "/" + asset);
});

/** @type {ee.Image} Integrated multiband classification mosaic. */
var collection = ee.ImageCollection(collection_list).mosaic();

/**
 * Map configuration and visualization parameters.
 */
Map.setOptions("SATELLITE");

/** @type {Object} Map visualization parameters for integrated classification layers. */
var vis = {
  min: 0,
  max: palette.length - 1,
  palette: palette,
};

/**
 * Adds the yearly Landsat mosaic and corresponding integrated classification band
 * to the Earth Engine map for each configured year.
 *
 * @param {number} year - Target year to display.
 * @returns {void}
 */
years.forEach(function (year) {
  try {
    var selector = "classification_" + year.toString();

    vis.bands = [selector];

    var selected = collection.select(selector);

    var year_mosaics = mosaics.filterMetadata("year", "equals", year);

    var year_mosaic = ee.Algorithms.If(
      year_mosaics.size().gt(0),
      year_mosaics.mosaic().updateMask(selected),
      null,
    );

    year_mosaic = ee.Image(year_mosaic);

    if (year_mosaic === null) {
      print("No hay datos satelitales disponibles para " + year);
      return;
    }

    var bands = year_mosaic.bandNames();

    var contained = bands.containsAll(ee.List(feature_space));

    Map.addLayer(
      year_mosaic,
      {
        bands: feature_space,
        gain: [0.08, 0.06, 0.2],
      },
      "MOSAICO " + year.toString(),
      false,
    );

    Map.addLayer(collection, vis, selector);
  } catch (error) {
    print(error.message);
  }
});
