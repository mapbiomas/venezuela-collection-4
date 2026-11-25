/**
 * @fileoverview Temporal gap-filling filter for MapBiomas Venezuela Collection 4.
 * Fills NoData pixels (class ID 27) across the annual classification time series
 * by propagating valid values backward from newer years and then forward from
 * older years in Google Earth Engine.
 *
 * @author MapBiomas Venezuela Team
 * @version 1.0.0
 * @see {@link https://venezuela.mapbiomas.org|MapBiomas Venezuela}
 */

/**
 * Google Earth Engine geometry imports.
 */

/** @type {ee.Feature} Example training polygon for forest class (ID 3). */
var samples_03 = /* color: #29a33a */ ee.Feature(
    ee.Geometry.MultiPolygon([
      [
        [
          [-58.43828645095365, 6.765911132832761],
          [-58.4599018300925, 6.753645391832254],
          [-58.443432994820206, 6.729794323394846],
          [-58.41804346849748, 6.741720005195024],
          [-58.41032345183912, 6.756541452012881],
        ],
      ],
      [
        [
          [-58.087063854327454, 6.479473277826202],
          [-58.0733484404161, 6.49684847650052],
          [-58.088092508655926, 6.511156937536764],
          [-58.100436365287, 6.504343447961189],
        ],
      ],
      [
        [
          [-58.372707006192485, 6.592023085853235],
          [-58.35280607284392, 6.59815837248766],
          [-58.35658040315898, 6.618949568133145],
          [-58.37922624483443, 6.620312898659606],
        ],
      ],
      [
        [
          [-58.180470387924736, 6.578104721587394],
          [-58.16828575866072, 6.575121230966636],
          [-58.16270829174083, 6.583815927523929],
          [-58.177810361748165, 6.593703819307003],
          [-58.186905925566, 6.589527063325322],
        ],
      ],
    ]),
    {
      id: 3,
      "system:index": "0",
    },
  ),
  /** @type {ee.FeatureCollection} Example polygon collection to remap classes to ID 21. */
  remap_to_21 = /* color: #d63000 */ ee.FeatureCollection([
    ee.Feature(
      ee.Geometry.Polygon([
        [
          [-57.86866466323354, 6.6604093165189875],
          [-57.874501150049944, 6.650008533129753],
          [-57.86814967910268, 6.64318822778016],
          [-57.86145488540151, 6.636538339022137],
          [-57.85716335097768, 6.636538339022137],
          [-57.85493175307729, 6.650179039551153],
          [-57.86059657851674, 6.655976222668799],
        ],
      ]),
      {
        original: "24,25,30,",
        new: "21,21,21,",
        "system:index": "0",
      },
    ),
  ]);

/**
 * User configuration parameters.
 */

/** @type {string} Google Earth Engine username or project namespace for input/output assets. */
var user = "emanuel-valero";

/** @type {number} Classification region identifier. */
var region_id = 92807;

/** @type {string} Country name used for mosaic filtering and output metadata. */
var country = "GUYANA";

/** @type {string} Input classification asset version suffix. */
var input_version = "1";

/** @type {string} Output gap-filled asset version suffix. */
var output_version = "1";

/** @type {number[]} Complete annual time series processed by the gap-fill filter. */
var years = [
  1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997,
  1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010,
  2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023,
  2024, 2025,
];

/** @type {number[]} Subset of years to display on the map for visual inspection. */
var preview = [
  // 2024,
  1990, 1995, 2018, 2020,
];

/**
 * Asset paths, visualization settings, and band definitions.
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

/** @type {string} Input Earth Engine folder path containing raw classifications. */
var input_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-single";

/** @type {string} Output Earth Engine folder path for post-classification filtered assets. */
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

/** @type {Object} Map visualization parameters for land cover classification bands. */
var lulc_vis = { min: 0, max: palette.length - 1, palette: palette };

/** @type {string[]} False-color RGB band combination for mosaic visualization. */
var rgb_combination = ["swir1_median", "nir_median", "red_median"];

/** @type {number[]} Region IDs belonging to the Andean classification zone. */
var andean_region_ids = [
  92001, 92002, 92003, 92004, 92005, 92006, 92007, 92008, 92009,
];

/** @type {Object} Map visualization parameters for Landsat mosaics. */
var mosaic_vis = { min: 0, max: 4000, bands: rgb_combination };

/** @type {string[]} Ordered list of annual classification band names. */
var all_bands = years.map(function (year) {
  return "classification_" + year;
});

/** @type {ee.List} Zero-based sequence of year indices used to iterate over bands. */
var years_index = ee.List.sequence(0, years.length - 1);

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

/** @type {ee.Image} Raw multiband classification input image. */
var input = ee.Image(input_path + "/" + input_name);

/** @type {ee.Image} Input classification with NoData class (27) masked out. */
var masked_input = input.updateMask(input.neq(27));

/**
 * Gap-fill execution: backward fill followed by forward fill.
 */

/** @type {ee.Image} Classification image after backward temporal gap filling. */
var backward_filled = backward_fill(masked_input);

/** @type {ee.Image} Classification image after both backward and forward gap filling. */
var fully_filled = forward_fill(backward_filled);

/** @type {ee.Image} Final Byte-cast gap-filled image with output metadata attached. */
var filtered = fully_filled
  .byte()
  .set({ version: output_version, country: country, step: "gap-fill" });

/**
 * Map preview and Earth Engine asset export.
 */
print("OUTPUT", fully_filled);

preview.forEach(function (year) {
  // Add yearly mosaic layer to map.
  var filtered_mosaic = mosaics.filterMetadata("year", "equals", year);

  var year_mosaic = filtered_mosaic.mosaic().updateMask(region.rasterMask);

  Map.addLayer(year_mosaic, mosaic_vis, "MOSAIC " + year, false);

  // Add original and gap-filled classification layers for the current year.
  var selector = "classification_" + year;

  if (all_bands.indexOf(selector) !== -1) {
    lulc_vis.bands = selector;

    Map.addLayer(masked_input, lulc_vis, "ORIGINAL " + year, false);

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
 * Accumulator step that fills missing pixels in the current band using the
 * previously filled band in the iteration sequence.
 *
 * @param {ee.Number} current_year_index - Zero-based band index for the current iteration step.
 * @param {ee.Dictionary} obj - State dictionary containing `image_filled` and `image_base`.
 * @returns {ee.Dictionary} Updated state dictionary with the newly filled band appended.
 */
function gap_fill(current_year_index, obj) {
  obj = ee.Dictionary(obj);

  // Resolve the previous band index and extract working images from state.
  var previous_year_index = ee.Number(current_year_index).subtract(1);

  var image_filled = ee.Image(obj.get("image_filled"));

  var image_base = ee.Image(obj.get("image_base"));

  // Select the current target band and the already-filled previous band.
  var current_image = image_base.select([ee.Number(current_year_index)]);

  var previous_image_filled = image_filled.select([previous_year_index]);

  // Fill masked pixels in the current band and append it to the accumulated image.
  var current_filled = current_image.unmask(previous_image_filled);

  obj = obj.set("image_filled", image_filled.addBands(current_filled));

  return obj;
}

/**
 * Forward-fills missing values across the classification time series.
 * Propagates valid values chronologically from earlier years to later years.
 *
 * @param {ee.Image} image - Multiband classification image with missing values masked.
 * @returns {ee.Image} Forward-filled multiband classification image.
 */
function forward_fill(image) {
  // Start with the earliest year band as the initial filled reference.
  var first = image.select([0]);

  // Iteratively fill each subsequent band from the previous filled band.
  var result = years_index.slice(1).iterate(gap_fill, {
    image_filled: first,
    image_base: image,
  });

  // Return the accumulated multiband image.
  return ee.Image(ee.Dictionary(result).get("image_filled"));
}

/**
 * Backward-fills missing values across the classification time series.
 * Propagates valid values reverse-chronologically from later years to earlier years.
 *
 * @param {ee.Image} image - Multiband classification image with missing values masked.
 * @returns {ee.Image} Backward-filled multiband classification image in original band order.
 */
function backward_fill(image) {
  // Reverse band order so iteration proceeds from the latest year to the earliest.
  image = image.select(years_index.reverse());

  // Start with the latest year band as the initial filled reference.
  var last = image.select([0]);

  // Iteratively fill each earlier band using the subsequent filled band.
  var result = years_index.slice(1).iterate(gap_fill, {
    image_filled: last,
    image_base: image,
  });

  // Restore original chronological band order before returning.
  return ee
    .Image(ee.Dictionary(result).get("image_filled"))
    .select(years_index.reverse());
}
