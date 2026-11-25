/**
 * @fileoverview Temporal consistency filter for MapBiomas Venezuela Collection 4.
 * Applies sequential 3-, 4-, and 5-year rolling temporal window rules (plus edge
 * rules for the first and last years) to suppress spurious annual transitions
 * while supporting year and class exclusions in Google Earth Engine.
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

/** @type {number[]} Annual time series to filter temporally. */
var years = [
  1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997,
  1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010,
  2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023,
  2024, 2025,
];

/** @type {number[]} Subset of years to display on the map for visual inspection. */
var preview = [1986, 2011, 2015, 2025];

/** @type {number[]} Years whose original classification values are preserved unchanged. */
var years_to_exclude = [2014];

/** @type {number[]} Class IDs whose original pixels are restored after temporal filtering. */
var classes_to_exclude = [24];

/** @type {string} Input classification asset version suffix. */
var input_version = "1";

/** @type {string} Output temporally filtered asset version suffix. */
var output_version = "2";

/**
 * Temporal filter execution rule.
 * @typedef {Object} TemporalFilterRule
 * @property {string} name - Window filter identifier (`first3`, `last3`, `middle3`, `middle4`, `middle5`).
 * @property {number[]} order - Ordered list of class IDs processed sequentially by the window.
 */

/**
 * Temporal filter sequence and class priority rules.
 *
 * - First year filter (`first3`): `X 3 3 => 3 3 3`
 * - Last year filter (`last3`): `3 3 X => 3 3 3`
 * - Middle years 3-year window (`middle3`): `21 X 21 => 21 21 21`
 * - Middle years 4-year window (`middle4`): `21 X X 21 => 21 21 21 21`
 * - Middle years 5-year window (`middle5`): `21 X X X 21 => 21 21 21 21 21`
 *
 * @type {TemporalFilterRule[]}
 */
var filter_execution = [
  { name: "last3", order: [6, 9, 11, 13, 21, 24, 30, 3, 12, 33] },
  { name: "first3", order: [6, 9, 11, 13, 21, 24, 30, 3, 12, 33] },
  { name: "middle3", order: [6, 9, 11, 13, 21, 24, 30, 3, 12, 33] },
  { name: "middle4", order: [6, 9, 11, 13, 21, 24, 30, 3, 12, 33] },
  { name: "middle5", order: [6, 9, 11, 13, 21, 24, 30, 3, 12, 33] },
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

/** @type {string} Input Earth Engine folder path containing classification assets. */
var input_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft";

/** @type {string} Output Earth Engine folder path for temporally filtered assets. */
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

/** @type {ee.Image} Input multiband classification image. */
var input = ee.Image(input_path + "/" + input_name);

/** @type {ee.Image} Working multiband classification image updated by each temporal filter pass. */
var filtered = input;

/**
 * Sequential temporal filter execution (edge and middle-year windows).
 */
filter_execution.forEach(function (filter) {
  var filter_params = {
    image: filtered,
    years: years,
    _order: filter.order,
    _filter: filter.name,
  };

  filtered = apply_filter(filter_params);
});

/**
 * Apply configured year and class exclusions, then attach output metadata.
 */
filtered =
  years_to_exclude && years_to_exclude.length > 0
    ? exclude_years(input, filtered, years_to_exclude, "classification")
    : filtered;

filtered =
  classes_to_exclude && classes_to_exclude.length > 0
    ? exclude_covers(input, filtered, classes_to_exclude)
    : filtered;

filtered = filtered
  .byte()
  .set({ version: output_version, country: country, step: "temporal-filter" });

/**
 * Map preview and Earth Engine asset export.
 */
preview.forEach(function (year) {
  var filtered_mosaic = mosaics.filterMetadata("year", "equals", year);

  var year_mosaic = filtered_mosaic.mosaic().updateMask(region.rasterMask);

  lulc_vis.bands = ["classification_" + year];

  Map.addLayer(year_mosaic, mosaic_vis, "MOSAIC " + year, false);

  Map.addLayer(input, lulc_vis, "INPUT " + year, false);

  Map.addLayer(filtered, lulc_vis, "OUTPUT " + year, false);
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
 * Applies a named temporal window filter sequentially across an ordered list of class IDs.
 *
 * @param {Object} param - Filter execution parameters.
 * @param {ee.Image} param.image - Multiband classification image.
 * @param {number[]} param._order - Ordered class IDs to filter.
 * @param {string} param._filter - Window method name (`first3`, `last3`, `middle3`, `middle4`, `middle5`).
 * @param {number[]} param.years - Chronological list of classification years.
 * @param {string} [param.bands_prefix="classification"] - Band name prefix.
 * @returns {ee.Image} Filtered multiband classification image.
 */
function apply_filter(param) {
  var windows = time_windows();

  var image = param.image;

  var ids_order = param._order;

  var filter_name = param._filter;

  var years = param.years;

  var prefix = param.bands_prefix || "classification";

  ids_order.forEach(function (class_id) {
    image = windows[filter_name](image, class_id, years, prefix);
  });

  return image;
}

/**
 * Dynamically selects a single annual band by prefix and year.
 *
 * @param {ee.Image} img - Multiband classification image.
 * @param {string} prefix - Band name prefix.
 * @param {ee.Number|number} yearStr - Target year.
 * @returns {ee.Image} Single-band image for the requested year.
 */
function get_band(img, prefix, yearStr) {
  return img.select(ee.String(prefix).cat("_").cat(ee.Number(yearStr)));
}

/**
 * Pads the start and end of an annual image with dummy bands to prevent
 * out-of-range band selection in rolling temporal windows.
 *
 * @param {ee.Image} img - Annual multiband classification image.
 * @param {string} prefix - Band name prefix.
 * @param {number[]} years - Chronological list of years in `img`.
 * @returns {ee.Image} Padded multiband image with 3 dummy bands (value 9999) on each end.
 */
function pad_image(img, prefix, years) {
  var padded = img;

  var start = years[0];

  var finish = years[years.length - 1];

  var dummyVal = 9999;

  for (var i = 1; i <= 3; i++) {
    padded = padded.addBands(
      ee.Image(dummyVal).rename(prefix + "_" + (start - i)),
      null,
      true,
    );
    padded = padded.addBands(
      ee.Image(dummyVal).rename(prefix + "_" + (finish + i)),
      null,
      true,
    );
  }

  return padded;
}

/**
 * Builds the collection of optimized temporal window filter functions
 * (`middle3`, `middle4`, `middle5`, `first3`, `last3`).
 *
 * @returns {Object.<string, Function>} Dictionary of temporal window filter implementations.
 */
function time_windows() {
  return {
    /**
     * Replaces isolated 1-year gaps (`A X A => A A A`) across all years in a single map pass.
     *
     * @param {ee.Image} image - Multiband classification image.
     * @param {number} value - Target class ID.
     * @param {number[]} years - Ordered classification years.
     * @param {string} prefix - Band name prefix.
     * @returns {ee.Image} Filtered multiband image.
     */
    middle3: function (image, value, years, prefix) {
      var paddedImg = pad_image(image, prefix, years);

      // Map simultaneously across all years (computation graph depth = 1).
      var mapped = ee.List(years).map(function (y) {
        var yNum = ee.Number(y);

        var prev = get_band(paddedImg, prefix, yNum.subtract(1));

        var curr = get_band(paddedImg, prefix, yNum);

        var next = get_band(paddedImg, prefix, yNum.add(1));

        var mask = prev.eq(value).and(curr.neq(value)).and(next.eq(value));

        return curr.where(mask, value);
      });

      var originalNames = years.map(function (y) {
        return prefix + "_" + y;
      });

      return ee.ImageCollection.fromImages(mapped)
        .toBands()
        .rename(originalNames);
    },

    /**
     * Replaces 2-year gaps (`A X X A => A A A A`) across all years.
     *
     * @param {ee.Image} image - Multiband classification image.
     * @param {number} value - Target class ID.
     * @param {number[]} years - Ordered classification years.
     * @param {string} prefix - Band name prefix.
     * @returns {ee.Image} Filtered multiband image.
     */
    middle4: function (image, value, years, prefix) {
      var paddedImg = pad_image(image, prefix, years);

      var mapped = ee.List(years).map(function (y) {
        var yNum = ee.Number(y);

        var y_m2 = get_band(paddedImg, prefix, yNum.subtract(2));

        var y_m1 = get_band(paddedImg, prefix, yNum.subtract(1));

        var y_c = get_band(paddedImg, prefix, yNum);

        var y_p1 = get_band(paddedImg, prefix, yNum.add(1));

        var y_p2 = get_band(paddedImg, prefix, yNum.add(2));

        // Current year is the FIRST position of a 2-year gap.
        var left_gap = y_m1
          .eq(value)
          .and(y_c.neq(value))
          .and(y_p1.neq(value))
          .and(y_p2.eq(value));

        // Current year is the SECOND position of a 2-year gap.
        var right_gap = y_m2
          .eq(value)
          .and(y_m1.neq(value))
          .and(y_c.neq(value))
          .and(y_p1.eq(value));

        var mask = left_gap.or(right_gap);

        return y_c.where(mask, value);
      });

      var originalNames = years.map(function (y) {
        return prefix + "_" + y;
      });

      return ee.ImageCollection.fromImages(mapped)
        .toBands()
        .rename(originalNames);
    },

    /**
     * Replaces 3-year gaps (`A X X X A => A A A A A`) across all years.
     *
     * @param {ee.Image} image - Multiband classification image.
     * @param {number} value - Target class ID.
     * @param {number[]} years - Ordered classification years.
     * @param {string} prefix - Band name prefix.
     * @returns {ee.Image} Filtered multiband image.
     */
    middle5: function (image, value, years, prefix) {
      var paddedImg = pad_image(image, prefix, years);

      var mapped = ee.List(years).map(function (y) {
        var yNum = ee.Number(y);

        var y_m3 = get_band(paddedImg, prefix, yNum.subtract(3));

        var y_m2 = get_band(paddedImg, prefix, yNum.subtract(2));

        var y_m1 = get_band(paddedImg, prefix, yNum.subtract(1));

        var y_c = get_band(paddedImg, prefix, yNum);

        var y_p1 = get_band(paddedImg, prefix, yNum.add(1));

        var y_p2 = get_band(paddedImg, prefix, yNum.add(2));

        var y_p3 = get_band(paddedImg, prefix, yNum.add(3));

        var p1_gap = y_m1
          .eq(value)
          .and(y_c.neq(value))
          .and(y_p1.neq(value))
          .and(y_p2.neq(value))
          .and(y_p3.eq(value));

        var p2_gap = y_m2
          .eq(value)
          .and(y_m1.neq(value))
          .and(y_c.neq(value))
          .and(y_p1.neq(value))
          .and(y_p2.eq(value));

        var p3_gap = y_m3
          .eq(value)
          .and(y_m2.neq(value))
          .and(y_m1.neq(value))
          .and(y_c.neq(value))
          .and(y_p1.eq(value));

        var mask = p1_gap.or(p2_gap).or(p3_gap);

        return y_c.where(mask, value);
      });

      var originalNames = years.map(function (y) {
        return prefix + "_" + y;
      });

      return ee.ImageCollection.fromImages(mapped)
        .toBands()
        .rename(originalNames);
    },

    /**
     * Corrects the first year of the series when the next two years share the target class (`X A A => A A A`).
     *
     * @param {ee.Image} image - Multiband classification image.
     * @param {number} value - Target class ID.
     * @param {number[]} years - Ordered classification years.
     * @param {string} prefix - Band name prefix.
     * @returns {ee.Image} Multiband image with the first band updated.
     */
    first3: function (image, value, years, prefix) {
      var y0 = image.select(prefix + "_" + years[0]);

      var y1 = image.select(prefix + "_" + years[1]);

      var y2 = image.select(prefix + "_" + years[2]);

      var mask = y0.neq(value).and(y1.eq(value)).and(y2.eq(value));

      var corrected = y0.where(mask, value);

      // Overwrite only the first year band.
      return image.addBands(corrected, null, true);
    },

    /**
     * Corrects the last year of the series when the preceding two years share the target class (`A A X => A A A`).
     *
     * @param {ee.Image} image - Multiband classification image.
     * @param {number} value - Target class ID.
     * @param {number[]} years - Ordered classification years.
     * @param {string} prefix - Band name prefix.
     * @returns {ee.Image} Multiband image with the final band updated.
     */
    last3: function (image, value, years, prefix) {
      var yn = image.select(prefix + "_" + years[years.length - 1]);

      var yn_1 = image.select(prefix + "_" + years[years.length - 2]);

      var yn_2 = image.select(prefix + "_" + years[years.length - 3]);

      var mask = yn.neq(value).and(yn_1.eq(value)).and(yn_2.eq(value));

      var corrected = yn.where(mask, value);

      // Overwrite only the last year band.
      return image.addBands(corrected, null, true);
    },
  };
}

/**
 * Restores original classification bands for specified excluded years.
 *
 * @param {ee.Image} original - Unfiltered original classification image.
 * @param {ee.Image} output - Temporally filtered classification image.
 * @param {number[]} yearsToExclude - Years whose original bands should be restored.
 * @param {string} bandsPrefix - Band name prefix.
 * @returns {ee.Image} Classification image with excluded years restored.
 */
function exclude_years(original, output, yearsToExclude, bandsPrefix) {
  var bandsToExclude = ee.List(
    yearsToExclude.map(function (year) {
      return bandsPrefix + "_" + year;
    }),
  );

  var excluded = original.select(bandsToExclude);

  // Passing `true` overwrites existing bands rather than duplicating them.
  output = output.addBands(excluded, null, true);

  print("Excluded years: ", yearsToExclude);

  return output;
}

/**
 * Restores original pixel classifications for excluded land cover classes
 * without an iterative `blend` loop.
 *
 * @param {ee.Image} input - Unfiltered original classification image.
 * @param {ee.Image} output - Temporally filtered classification image.
 * @param {number[]} classes - Class IDs to restore from `input`.
 * @returns {ee.Image} Classification image with excluded classes restored.
 */
function exclude_covers(input, output, classes) {
  var classesList = ee.List(classes);

  var masks = classesList.map(function (classId) {
    return input.eq(ee.Number(classId));
  });

  var combinedMask = ee.ImageCollection.fromImages(masks).max();

  var classified = input.updateMask(combinedMask);

  print("Excluded covers: ", classes);

  return output.blend(classified);
}
