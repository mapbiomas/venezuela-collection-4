/**
 * @fileoverview Land-cover temporal transitions and QA diagnostics for MapBiomas Venezuela Collection 4.
 *
 * Generates temporal transition products from a 41-band annual land-cover
 * classification (1985-2025) in Google Earth Engine.
 *
 * Products:
 * - `transition_count`: Number of valid year-to-year class transitions.
 * - `transition_class_count`: Number of distinct classes effectively involved as
 *   origin or destination of at least one valid transition.
 * - `valid_comparisons`: Number of valid consecutive-year comparisons.
 * - `first_transition_year`: First year where a valid class transition occurs.
 * - `last_transition_year`: Last year where a valid class transition occurs.
 * - `transition codes`: One band for every consecutive-year interval
 *   (`code = from_class * 100 + to_class`, e.g. `3 -> 21 = 321`, `21 -> 3 = 2103`).
 * - `qa_transition`: QA score assigned by the transition matrix
 *   (`0 = no issues`, `1 = review`, `2 = suspicious`, `3 = highly unlikely`).
 * - `qa_max_annual`: Maximum annual QA score inside 3-year or 5-year windows.
 * - `unknown_class`: Identifies transitions containing classes outside the QA matrix.
 *
 * General temporal indicators ignore NoData (27). The QA matrix keeps
 * class 27 explicitly, preserving the QA behavior of the original script.
 *
 * The temporal calculations are vectorized over the complete multiband series
 * to keep the Earth Engine computation graph compact.
 *
 * Map preview notes:
 * Pixel-history metrics (number of transitions, number of classes, first/last
 * change year) are not scale invariant. The Code Editor computes layers at the
 * zoom-level scale using image pyramids, which mixes several 30 m histories in
 * coarse pixels. Preview layers force computation at the native 30 m resolution
 * and summarize with the mode for display. Exports already run at 30 m.
 *
 * @author MapBiomas Venezuela Team
 * @version 1.0.0
 * @see {@link https://venezuela.mapbiomas.org|MapBiomas Venezuela}
 */

/**
 * User configuration parameters.
 */

/** @type {string} Google Earth Engine username or project namespace for input/output assets. */
var user = "sig3-provita";

/** @type {number} Classification region identifier. */
var region_id = 92426;

/** @type {string} Country name used for mosaic filtering and output metadata. */
var country = "VENEZUELA";

/** @type {number} Input classification asset version number. */
var input_version = 11;

/** @type {number} Output transition asset version number. */
var output_version = 12;

/** @type {number[]} Complete annual time series evaluated for transitions. */
var years = [
  1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997,
  1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010,
  2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023,
  2024, 2025,
];

/** @type {number[]} Subset of years displayed as individual transition preview layers. */
var preview_years = [
  2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
];

/** @type {number} Destination year used for QA map preview layers. */
var qa_preview_year = 2025;

/** @type {number} Pixel class value representing NoData. */
var no_data = 27;

/**
 * Native-resolution preview settings.
 * `preview_max_pixels` limits how many 30 m pixels are aggregated into one screen
 * pixel (65535 is the Earth Engine maximum). If the map reports "Too many input
 * pixels per output pixel", zoom in.
 */

/** @type {boolean} Whether to compute preview metrics at native 30 m resolution via `reduceResolution`. */
var native_preview = true;

/** @type {number} Maximum input pixels aggregated per output screen pixel during preview. */
var preview_max_pixels = 65535;

/**
 * Visualization parameters
 */
var max_transition_count_vis = 10;

var max_transition_classes_vis = 8;

var map_type = "SATELLITE";

var transition_count_palette = [
  "fff5f0",
  "fee0d2",
  "fcbba1",
  "fc9272",
  "fb6a4a",
  "ef3b2c",
  "cb181d",
  "99000d",
];

var transition_class_count_palette = [
  "1b4c70",
  "8c78dc",
  "1fcc64",
  "8debd5",
  "ffff8c",
  "f29e2e",
  "d7191c",
];

var transition_year_palette = [
  "313695",
  "4575b4",
  "74add1",
  "abd9e9",
  "e0f3f8",
  "ffffbf",
  "fee090",
  "fdae61",
  "f46d43",
  "d73027",
  "a50026",
];

/**
 * Export configuration
 */
var export_summary = true;

var export_transition_codes = true;

var export_last_change_year = true;

var export_qa_1_year = true;

var export_qa_3_years = false;

var export_qa_5_years = false;

var include_qa_transition_code = true;

/**
 * Assets paths
 */
var guyana_mosaics = "projects/nexgenmap/MapBiomas2/LANDSAT/GUYANA/mosaics-2";

var venezuela_mosaics =
  "projects/mapbiomas-mosaics/assets/LANDSAT/LULC/VENEZUELA/mosaics-2";

var input_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft";

/**
 * Create this folder/collection before export if necessary.
 */
var output_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/transitions";

var regions =
  "projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion";

var functions = require("users/ejvalero/api:src/utils").functions;

var palette = require("users/mapbiomas/modules:Palettes.js").get(
  "classification9",
);

var rgb_bands = ["swir1_median", "nir_median", "red_median"];

var andean_region_ids = [
  92001, 92002, 92003, 92004, 92005, 92006, 92007, 92008, 92009,
];

var regions_field = "gridcode";

/**
 * Load region
 */
var region = functions.getRegion(regions, regions_field, region_id);

/**
 * Set up mosaic filters
 */
var in_andean_filter = ee.Filter.stringContains("system:index", "ANDES");

var out_andean_filter = in_andean_filter.not();

var bounds_filter = ee.Filter.bounds(region.vector);

var andean_filter = ee.Filter.or(
  in_andean_filter,
  ee.Filter.and(out_andean_filter, bounds_filter),
);

/**
 * Load mosaics
 */
var gu_mosaics = functions.getMapBiomasMosaics({
  path: guyana_mosaics,
  country: "GUYANA",
  variables: rgb_bands,
});

var ve_mosaics = functions.getMapBiomasMosaics({
  path: venezuela_mosaics,
  country: "VENEZUELA",
  variables: rgb_bands,
});

ve_mosaics =
  andean_region_ids.indexOf(region_id) !== -1
    ? ve_mosaics.filter(andean_filter)
    : ve_mosaics;

var mosaics = ve_mosaics
  .merge(gu_mosaics)
  .filterMetadata("season", "equals", "full");

/**
 * Build classification band names
 */
var band_names = years.map(function (year) {
  return "classification_" + year;
});

/**
 * Load original classification
 */
var input_filename = region_id + "-" + input_version;

var input_asset = input_path + "/" + input_filename;

var original = ee
  .Image(input_asset)
  .select(band_names)
  .unmask(no_data)
  .updateMask(region.rasterMask)
  .toByte();

/**
 * Native projection
 *
 * Projection of the input classification (30 m). Used to force the
 * temporal metrics to be computed at the original resolution in the
 * map preview.
 */
var native_projection = ee
  .Image(input_asset)
  .select(band_names[0])
  .projection();

/**
 * Prepare consecutive temporal pairs
 *
 * FROM: 1985 1986 ... 2024
 *
 * TO: 1986 1987 ... 2025
 *
 * Both images are renamed with identical temporary band names,
 * allowing Earth Engine to perform all 40 comparisons at once.
 */
var from_band_names = band_names.slice(0, band_names.length - 1);

var to_band_names = band_names.slice(1);

var from_years = years.slice(0, years.length - 1);

var to_years = years.slice(1);

var pair_band_names = to_years.map(function (year, index) {
  return "pair_" + from_years[index] + "_" + year;
});

var change_band_names = to_years.map(function (year, index) {
  return "change_" + from_years[index] + "_" + year;
});

var transition_band_names = to_years.map(function (year, index) {
  return "transition_" + from_years[index] + "_" + year;
});

var transition_from_band_names = to_years.map(function (year, index) {
  return "from_" + from_years[index] + "_" + year;
});

var transition_to_band_names = to_years.map(function (year, index) {
  return "to_" + from_years[index] + "_" + year;
});

/**
 * Align previous and following observations
 */
var from = original.select(from_band_names, pair_band_names);

var to = original.select(to_band_names, pair_band_names);

/**
 * Valid consecutive observations
 *
 * A transition can only be evaluated when both years
 * contain a valid class.
 */
var valid_pairs = from.neq(no_data).and(to.neq(no_data));

/**
 * Detect temporal transitions
 *
 * 1 = class changed
 * 0 = class remained stable
 *
 * NoData comparisons are always zero.
 */
var change_pairs = from.neq(to).and(valid_pairs).toByte();

/**
 * Transition mask
 *
 * 40 bands:
 *
 *   change_1985_1986
 *   change_1986_1987
 *   ...
 *   change_2024_2025
 */
var transition_masks = change_pairs.rename(change_band_names).toByte();

/**
 * Number of transitions per pixel
 */
var transition_count = change_pairs
  .reduce(ee.Reducer.sum())
  .rename("transition_count")
  .updateMask(region.rasterMask)
  .toByte();

/**
 * Number of classes involved in transitions
 *
 * Counts only classes that effectively participate as the origin or
 * destination of at least one valid year-to-year transition.
 *
 * Stable observations that never participate in a transition are not
 * considered. NoData (27) is already excluded by change_pairs.
 *
 * Examples:
 *
 *   3 3 3 21 21      -> 2 classes
 *   3 21 3 21        -> 2 classes
 *   3 21 24 24       -> 3 classes
 *   3 3 27 21 21     -> 0 classes, because no valid transition occurs
 *
 * ee.Reducer.countDistinct() must not receive masked bands: the masked
 * positions (stable years) are counted as an extra distinct value, so
 * a 3 -> 21 pixel returns 3 instead of 2.
 *
 * To avoid it, every position without a transition is filled with a
 * reference class that is already involved in a transition of the same
 * pixel. The stack has no masked bands and the filler never adds a new
 * distinct value.
 *
 *   series      3   3   3   21  21
 *   change          0   0   1   0
 *   from            ref ref 3   ref
 *   to              ref ref 21  ref
 *   ref = 3                          -> distinct {3, 21} = 2
 */
var transition_from_classes = from
  .updateMask(change_pairs)
  .rename(transition_from_band_names);

var reference_class = transition_from_classes
  .reduce(ee.Reducer.max())
  .rename("reference_class");

var stable_pairs = change_pairs.not();

var involved_from_classes = from
  .multiply(change_pairs)
  .add(stable_pairs.multiply(reference_class))
  .rename(transition_from_band_names);

var involved_to_classes = to
  .multiply(change_pairs)
  .add(stable_pairs.multiply(reference_class))
  .rename(transition_to_band_names);

var transition_class_count = ee.Image.cat([
  involved_from_classes,
  involved_to_classes,
])
  .reduce(ee.Reducer.countDistinct())
  .rename("transition_class_count")
  .unmask(0)
  .updateMask(region.rasterMask)
  .toByte();

/**
 * Number of valid temporal comparisons
 */
var valid_comparisons = valid_pairs
  .reduce(ee.Reducer.sum())
  .rename("valid_comparisons")
  .updateMask(region.rasterMask)
  .toByte();

/**
 * Build year stack
 *
 * Each transition band contains the destination year:
 *
 *   1985 -> 1986 = 1986
 *   1986 -> 1987 = 1987
 *   ...
 */
var transition_year_stack = ee.Image.constant(to_years)
  .rename(pair_band_names)
  .updateMask(change_pairs);

/**
 * First transition year
 *
 * 0 means that no transition was detected.
 */
var first_transition_year = transition_year_stack
  .reduce(ee.Reducer.min())
  .rename("first_transition_year")
  .unmask(0)
  .updateMask(region.rasterMask)
  .toInt16();

/**
 * Last transition year
 *
 * 0 means that no transition was detected.
 */
var last_transition_year = transition_year_stack
  .reduce(ee.Reducer.max())
  .rename("last_transition_year")
  .unmask(0)
  .updateMask(region.rasterMask)
  .toInt16();

/**
 * Last change year map
 *
 * Stores the destination year of the most recent valid transition.
 * Pixels without valid transitions are masked.
 *
 * Example:
 *
 *   2020 -> 2021 is the most recent class change
 *   last_change_year = 2021
 */
var last_change_year = last_transition_year
  .updateMask(transition_count.gt(0))
  .rename("last_change_year")
  .toInt16()
  .set({
    code_region: region_id,
    pais: country,
    version: output_version,
    input_version: input_version,
    no_data: no_data,
    stable_pixels: "masked",
    descripcion: "last valid land-cover change year",
  });

/**
 * Encode every transition
 *
 * code = FROM * 100 + TO
 *
 * Examples:
 *
 *   forest 3 -> agriculture 21
 *   3 * 100 + 21 = 321
 *
 *   agriculture 21 -> forest 3
 *   21 * 100 + 3 = 2103
 *
 * Bands are masked where no transition occurred.
 */
var transition_codes = from
  .multiply(100)
  .add(to)
  .updateMask(change_pairs)
  .rename(transition_band_names)
  .updateMask(region.rasterMask)
  .toInt16();

/**
 * Summary product
 *
 * Float is used so all bands have a common type for export.
 */
var transition_summary = ee.Image.cat([
  transition_count,
  transition_class_count,
  valid_comparisons,
  first_transition_year,
  last_transition_year,
])
  .toFloat()
  .set({
    code_region: region_id,
    pais: country,
    version: output_version,
    input_version: input_version,
    no_data: no_data,
    descripcion: "land-cover temporal transitions 1985-2025",
  });

/**
 * Set transition-code metadata
 */
transition_codes = transition_codes.set({
  code_region: region_id,
  pais: country,
  version: output_version,
  input_version: input_version,
  no_data: no_data,
  transition_formula: "from_class * 100 + to_class",
  descripcion: "annual land-cover transition codes 1985-2025",
});

/**
 * QA transition matrix.
 *
 * Rows and columns follow `qa_class_codes`. Each origin/destination pair is
 * assigned one QA score:
 * - `0` = no issues
 * - `1` = review
 * - `2` = suspicious
 * - `3` = highly unlikely
 *
 * @type {number[]}
 */
var qa_class_codes = [
  3, 4, 5, 6, 11, 12, 29, 32, 66, 50, 13, 81, 82, 15, 18, 21, 9, 23, 24, 30, 68,
  25, 33, 34, 31, 27,
];

var qa_matrix = [
  // 3
  [
    0, 1, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1, 2, 3, 1,
    1,
  ],

  // 4
  [
    1, 0, 2, 2, 1, 1, 2, 2, 1, 2, 2, 2, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1, 2, 3, 1,
    1,
  ],

  // 5
  [
    2, 2, 0, 1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 3, 1,
    1,
  ],

  // 6
  [
    1, 2, 1, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 2, 2, 1, 1, 2, 1, 1, 3, 1,
    1,
  ],

  // 11
  [
    2, 1, 2, 1, 0, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1, 2, 1, 1, 3, 1,
    1,
  ],

  // 12
  [
    2, 1, 2, 2, 1, 0, 2, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 1, 1, 2, 1, 2, 3, 1,
    1,
  ],

  // 29
  [
    2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 1, 1, 2, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 3, 1,
    1,
  ],

  // 32
  [
    2, 2, 1, 2, 2, 2, 2, 0, 2, 2, 3, 2, 2, 3, 3, 1, 2, 1, 1, 1, 1, 1, 1, 3, 1,
    1,
  ],

  // 66
  [
    2, 1, 2, 2, 2, 1, 2, 2, 0, 1, 3, 2, 2, 3, 3, 1, 2, 2, 1, 1, 2, 1, 2, 3, 1,
    1,
  ],

  // 50
  [
    2, 2, 2, 2, 2, 1, 2, 2, 1, 0, 3, 2, 2, 3, 3, 1, 2, 2, 1, 1, 2, 1, 2, 3, 1,
    1,
  ],

  // 13
  [
    2, 2, 2, 2, 2, 1, 1, 3, 3, 3, 0, 3, 3, 1, 1, 1, 2, 3, 1, 1, 2, 1, 2, 3, 3,
    1,
  ],

  // 81
  [
    2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 3, 0, 1, 3, 3, 1, 2, 2, 1, 1, 2, 1, 2, 3, 1,
    1,
  ],

  // 82
  [
    2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 3, 1, 0, 3, 3, 1, 2, 2, 1, 1, 2, 1, 1, 3, 1,
    1,
  ],

  // 15
  [
    2, 1, 2, 2, 1, 1, 2, 3, 3, 3, 1, 3, 3, 0, 0, 0, 1, 3, 1, 1, 2, 1, 2, 3, 3,
    1,
  ],

  // 18
  [
    2, 1, 2, 2, 1, 1, 2, 3, 3, 3, 1, 3, 3, 0, 0, 0, 1, 3, 1, 1, 2, 1, 2, 3, 3,
    1,
  ],

  // 21
  [
    2, 1, 2, 2, 1, 1, 2, 2, 1, 1, 1, 1, 1, 0, 0, 0, 1, 2, 1, 1, 2, 1, 2, 3, 1,
    1,
  ],

  // 9
  [
    1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0, 2, 1, 1, 2, 1, 2, 3, 2,
    1,
  ],

  // 23
  [
    2, 2, 1, 2, 2, 2, 2, 1, 2, 2, 3, 2, 2, 3, 3, 1, 2, 0, 1, 1, 1, 1, 1, 3, 1,
    1,
  ],

  // 24
  [
    3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 3, 0, 1, 3, 1, 2, 3, 2,
    1,
  ],

  // 30
  [
    3, 2, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 1, 1, 1, 3, 2,
    1,
  ],

  // 68
  [
    2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1, 2, 1, 1, 1, 0, 1, 1, 3, 1,
    1,
  ],

  // 25
  [
    2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 2, 2, 1, 1, 2, 0, 1, 3, 1,
    1,
  ],

  // 33
  [
    2, 2, 1, 1, 1, 2, 2, 1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1, 1, 1, 0, 3, 1,
    1,
  ],

  // 34
  [
    2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 3, 1, 1, 3, 3, 2, 2, 2, 2, 2, 1, 2, 1, 0, 2,
    1,
  ],

  // 31
  [
    3, 2, 3, 3, 2, 2, 2, 2, 2, 2, 3, 2, 2, 3, 3, 1, 2, 2, 1, 1, 2, 1, 1, 3, 0,
    1,
  ],

  // 27
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    0,
  ],
];

/**
 * Build client-side lookup arrays used by ee.Image.remap().
 *
 * qa_transition_code = from_class * 100 + to_class
 */
var qa_transition_codes = [];

var qa_scores = [];

qa_class_codes.forEach(function (from_class, from_index) {
  qa_class_codes.forEach(function (to_class, to_index) {
    qa_transition_codes.push(from_class * 100 + to_class);

    qa_scores.push(qa_matrix[from_index][to_index]);
  });
});

var qa_valid_values = qa_class_codes.map(function () {
  return 1;
});

var qa_vis = {
  min: 0,
  max: 3,
  palette: ["2E8B57", "FFD966", "F4A261", "D73027"],
};

/**
 * QA preview products
 */
var qa_preview_annual = get_annual_qa_product(qa_preview_year);

var qa_preview_5_years = get_multi_year_qa_product(
  qa_preview_year - 5,
  qa_preview_year,
);

var qa_unknown_preview = get_unknown_qa_classes(
  qa_preview_year - 1,
  qa_preview_year,
);

/**
 * Map setup
 */
Map.setOptions(map_type);

/**
 * Preview individual yearly transitions
 *
 * preview_years defines the years displayed on the map.
 *
 * For each selected year:
 *
 *   Mosaic: selected year
 *   Original classification: selected year
 *   Origin class: previous year, only where transition occurs
 *   Destination class: selected year, only where transition occurs
 *   Change mask: previous year -> selected year
 */
preview_years.forEach(function (year) {
  var year_index = years.indexOf(year);

  if (year_index <= 0) {
    return;
  }

  var previous_year = years[year_index - 1];

  var pair_name = "change_" + previous_year + "_" + year;

  var change = transition_masks.select(pair_name);

  /**
   * Mosaic for selected preview year
   */
  add_mosaic(mosaics, year, region.rasterMask);

  /**
   * Original classification for selected preview year
   */
  add_classification(
    original.select("classification_" + year),
    year,
    palette,
    "CLASIFICACION ORIGINAL",
  );

  /**
   * Origin class
   *
   * Previous year, only where a transition occurs.
   */
  add_classification(
    original.select("classification_" + previous_year).updateMask(change),
    previous_year,
    palette,
    "CLASE ORIGEN",
  );

  /**
   * Destination class
   *
   * Selected year, only where a transition occurs.
   */
  add_classification(
    original.select("classification_" + year).updateMask(change),
    year,
    palette,
    "CLASE DESTINO",
  );

  /**
   * Binary transition mask
   */
  Map.addLayer(
    change.selfMask(),
    {
      min: 1,
      max: 1,
      palette: ["FF00FF"],
    },
    "CAMBIO " + previous_year + " - " + year,
    false,
  );
});

Map.addLayer(
  get_preview(transition_count),
  {
    min: 1,
    max: max_transition_count_vis,
    palette: ["000000"].concat(transition_count_palette),
  },
  "NÚMERO DE TRANSICIONES",
  true,
);

Map.addLayer(
  get_preview(transition_class_count.updateMask(transition_count.gt(0))),
  {
    min: 2,
    max: max_transition_classes_vis,
    palette: transition_class_count_palette,
  },
  "NÚMERO DE CLASES",
  false,
);

Map.addLayer(
  get_preview(first_transition_year.updateMask(first_transition_year.gt(0))),
  {
    min: years[1],
    max: years[years.length - 1],
    palette: transition_year_palette,
  },
  "PRIMER AÑO DE CAMBIO",
  false,
);

Map.addLayer(
  get_preview(last_change_year),
  {
    min: years[1],
    max: years[years.length - 1],
    palette: transition_year_palette,
  },
  "ÚLTIMO AÑO DE CAMBIO",
  false,
);

Map.addLayer(
  qa_preview_annual.select("qa_transition"),
  qa_vis,
  "QA " + (qa_preview_year - 1) + " - " + qa_preview_year,
  false,
);

Map.addLayer(
  qa_preview_5_years.select("qa_max_annual"),
  qa_vis,
  "QA MÁXIMO ANUAL " + (qa_preview_year - 5) + " - " + qa_preview_year,
  false,
);

Map.addLayer(
  qa_unknown_preview,
  {
    min: 1,
    max: 1,
    palette: ["FF00FF"],
  },
  "CLASES FUERA DE MATRIZ QA",
  false,
);

Map.addLayer(
  region.vector.style({
    color: "FFFFFF",
    fillColor: "00000000",
    width: 1,
  }),
  {},
  "REGIÓN",
  true,
);

/**
 * Map legends
 *
 * UI components are declared through widgets arrays.
 * No panel.add() or Map.add() calls are used.
 */
var legends_panel = ui.Panel({
  widgets: [
    create_qa_legend({
      title: "QA de transiciones",
      palette: qa_vis.palette,
    }),
    create_transition_class_count_legend({
      title: "Número de clases en la serie",
      max: max_transition_classes_vis,
      palette: transition_class_count_palette,
    }),
    create_last_change_year_legend({
      title: "Primer/Último año de cambio",
      min: years[1],
      max: years[years.length - 1],
      palette: transition_year_palette,
    }),
    create_transition_count_legend({
      title: "Número de transiciones",
      min: 1,
      max: max_transition_count_vis,
      palette: transition_count_palette,
    }),
  ],
  layout: ui.Panel.Layout.flow("vertical"),
  style: {
    position: "bottom-left",
    margin: "0 0 20px 10px",
    backgroundColor: "rgba(255, 255, 255, 0)",
  },
});

Map.widgets().set(0, legends_panel);

/**
 * Export summary
 */
if (export_summary) {
  var summary_filename =
    "TRANSITIONS-SUMMARY-" + region_id + "-" + output_version;

  Export.image.toAsset({
    image: transition_summary,
    description: summary_filename,
    assetId: output_path + "/" + summary_filename,
    scale: 30,
    pyramidingPolicy: {
      ".default": "mode",
    },
    maxPixels: 1e13,
    region: region.vector.geometry().bounds(),
  });
}

/**
 * Export last change year
 */
if (export_last_change_year) {
  var last_change_filename =
    "LAST-CHANGE-YEAR-" + region_id + "-" + output_version;

  Export.image.toAsset({
    image: last_change_year,
    description: last_change_filename,
    assetId: output_path + "/" + last_change_filename,
    scale: 30,
    pyramidingPolicy: {
      ".default": "mode",
    },
    maxPixels: 1e13,
    region: region.vector.geometry().bounds(),
  });
}

/**
 * Export yearly transition codes
 */
if (export_transition_codes) {
  var codes_filename = "TRANSITIONS-CODES-" + region_id + "-" + output_version;

  Export.image.toAsset({
    image: transition_codes,
    description: codes_filename,
    assetId: output_path + "/" + codes_filename,
    scale: 30,
    pyramidingPolicy: {
      ".default": "mode",
    },
    maxPixels: 1e13,
    region: region.vector.geometry().bounds(),
  });
}

/**
 * Run QA exports
 */
if (export_qa_1_year) export_annual_qa_transitions();

if (export_qa_3_years) export_3_year_qa_transitions();

if (export_qa_5_years) export_5_year_qa_transitions();

/**
 * Logs
 */
print("ORIGINAL", original);

print("TRANSITION SUMMARY", transition_summary);

print("TRANSITION MASKS", transition_masks);

print("TRANSITION CODES", transition_codes);

print("TRANSITION CLASS COUNT", transition_class_count);

print("LAST CHANGE YEAR", last_change_year);

print("QA ANNUAL PREVIEW", qa_preview_annual);

print("QA 5Y PREVIEW", qa_preview_5_years);

print("QA UNKNOWN CLASSES", qa_unknown_preview);

print("QA TRANSITIONS DEFINED", qa_transition_codes.length);

/**
 * Prepares a pixel-history metric for map preview.
 *
 * Without this step, the Code Editor computes the metric at the
 * zoom-level scale from downsampled classification pyramids. A coarse
 * pixel then mixes several 30 m histories (e.g., forest -> agriculture
 * fronts advancing in different years) and can report 3 or more classes
 * where every 30 m pixel only has 2.
 *
 * The metric is computed at the native 30 m projection and each screen
 * pixel shows the mode of the underlying 30 m values.
 *
 * @param {ee.Image} image - Temporal metric computed from `original`.
 * @returns {ee.Image} Image ready for `Map.addLayer()`.
 */
function get_preview(image) {
  if (!native_preview) {
    return image;
  }

  return image.setDefaultProjection(native_projection).reduceResolution({
    reducer: ee.Reducer.mode(),
    maxPixels: preview_max_pixels,
  });
}

/**
 * Builds the transition code between two classification years.
 *
 * @param {number} year_from - Origin year.
 * @param {number} year_to - Destination year.
 * @returns {ee.Image} Single-band transition-code image.
 */
function get_qa_transition_code(year_from, year_to) {
  var image_from = original.select("classification_" + year_from);

  var image_to = original.select("classification_" + year_to);

  return image_from
    .multiply(100)
    .add(image_to)
    .rename("qa_transition_code")
    .toInt16();
}

/**
 * Evaluates the QA matrix between two classification years.
 *
 * Transitions containing classes not represented by `qa_class_codes` are
 * masked by `remap()`. Class 27 is explicitly represented by the matrix.
 *
 * @param {number} year_from - Origin year.
 * @param {number} year_to - Destination year.
 * @returns {ee.Image} QA score image with values from 0 to 3.
 */
function get_qa(year_from, year_to) {
  var transition_code = get_qa_transition_code(year_from, year_to);

  return transition_code
    .remap(qa_transition_codes, qa_scores)
    .rename("qa_transition")
    .toByte();
}

/**
 * Calculates the maximum annual QA score inside a temporal interval.
 *
 * A pixel is returned only when every consecutive annual comparison in the
 * interval can be evaluated by the QA matrix.
 *
 * @param {number} year_from - First year of the interval.
 * @param {number} year_to - Last year of the interval.
 * @returns {ee.Image} Maximum consecutive-year QA score.
 */
function get_max_annual_qa(year_from, year_to) {
  var qa_images = [];

  for (var year = year_from; year < year_to; year++) {
    qa_images.push(get_qa(year, year + 1).rename("qa"));
  }

  var qa_collection = ee.ImageCollection.fromImages(qa_images);

  var expected_count = year_to - year_from;

  var qa_max = qa_collection.max().rename("qa_max_annual").toByte();

  var valid_count = qa_collection.count();

  return qa_max.updateMask(valid_count.eq(expected_count));
}

/**
 * Builds the annual QA product for `year_to - 1 -> year_to`.
 *
 * @param {number} year_to - Destination year.
 * @returns {ee.Image} Annual QA product.
 */
function get_annual_qa_product(year_to) {
  var year_from = year_to - 1;

  var transition_code = get_qa_transition_code(year_from, year_to);

  var qa = get_qa(year_from, year_to);

  var product = include_qa_transition_code ? transition_code.addBands(qa) : qa;

  return product.set({
    code_region: region_id,
    pais: country,
    version: output_version,
    input_version: input_version,
    year: year_to,
    year_from: year_from,
    year_to: year_to,
    interval_years: 1,
    source_asset: input_asset,
    region_asset: regions,
    transition_formula: "class_from * 100 + class_to",
    qa_0: "sin problemas",
    qa_1: "esperado",
    qa_2: "sospechoso",
    qa_3: "altamente improbable",
    "system:time_start": ee.Date.fromYMD(year_to, 1, 1).millis(),
  });
}

/**
 * Builds a QA product for a multi-year interval.
 *
 * `qa_transition` evaluates the direct transition from the first to the last
 * year. `qa_max_annual` reports the worst consecutive annual QA inside it.
 *
 * @param {number} year_from - First year.
 * @param {number} year_to - Last year.
 * @returns {ee.Image} Multi-year QA product.
 */
function get_multi_year_qa_product(year_from, year_to) {
  var interval_years = year_to - year_from;

  var transition_code = get_qa_transition_code(year_from, year_to);

  var qa_direct = get_qa(year_from, year_to);

  var qa_max_annual = get_max_annual_qa(year_from, year_to);

  var product = include_qa_transition_code
    ? transition_code.addBands(qa_direct).addBands(qa_max_annual)
    : qa_direct.addBands(qa_max_annual);

  return product.set({
    code_region: region_id,
    pais: country,
    version: output_version,
    input_version: input_version,
    year: year_to,
    year_from: year_from,
    year_to: year_to,
    interval_years: interval_years,
    source_asset: input_asset,
    region_asset: regions,
    transition_formula: "class_from * 100 + class_to",
    qa_transition_definition: "QA matrix between start and end year",
    qa_max_annual_definition: "maximum QA among consecutive annual transitions",
    qa_0: "sin problemas",
    qa_1: "revisar",
    qa_2: "sospechoso",
    qa_3: "altamente improbable",
    "system:time_start": ee.Date.fromYMD(year_to, 1, 1).millis(),
  });
}

/**
 * Detects pixels where either side of a transition contains a class outside
 * the QA matrix.
 *
 * @param {number} year_from - Origin year.
 * @param {number} year_to - Destination year.
 * @returns {ee.Image} Masked binary image of unknown QA classes.
 */
function get_unknown_qa_classes(year_from, year_to) {
  var image_from = original.select("classification_" + year_from);

  var image_to = original.select("classification_" + year_to);

  var known_from = image_from.remap(qa_class_codes, qa_valid_values, 0);

  var known_to = image_to.remap(qa_class_codes, qa_valid_values, 0);

  return known_from
    .and(known_to)
    .not()
    .selfMask()
    .rename("unknown_class")
    .toByte();
}

/**
 * Exports one QA image to the configured asset folder.
 *
 * @param {ee.Image} image - QA product image.
 * @param {string} asset_name - Output asset name and task description.
 * @returns {void}
 */
function export_qa_image(image, asset_name) {
  Export.image.toAsset({
    image: image,
    description: asset_name,
    assetId: output_path + "/" + asset_name,
    scale: 30,
    pyramidingPolicy: {
      ".default": "mode",
    },
    maxPixels: 1e13,
    region: region.vector.geometry().bounds(),
  });
}

/**
 * Creates annual QA export tasks across all consecutive year pairs.
 *
 * @returns {void}
 */
function export_annual_qa_transitions() {
  for (var year_to = years[1]; year_to <= years[years.length - 1]; year_to++) {
    var product = get_annual_qa_product(year_to);

    var asset_name = "R" + region_id + "-QA-TRANSITION-" + year_to;

    export_qa_image(product, asset_name);
  }
}

/**
 * Creates 3-year QA export tasks across the time series.
 *
 * @returns {void}
 */
function export_3_year_qa_transitions() {
  var lag = 3;

  for (
    var year_to = years[0] + lag;
    year_to <= years[years.length - 1];
    year_to++
  ) {
    var year_from = year_to - lag;

    var product = get_multi_year_qa_product(year_from, year_to);

    var asset_name = "R" + region_id + "-QA-TRANSITION-3Y-" + year_to;

    export_qa_image(product, asset_name);
  }
}

/**
 * Creates 5-year QA export tasks across the time series.
 *
 * @returns {void}
 */
function export_5_year_qa_transitions() {
  var lag = 5;

  for (
    var year_to = years[0] + lag;
    year_to <= years[years.length - 1];
    year_to++
  ) {
    var year_from = year_to - lag;

    var product = get_multi_year_qa_product(year_from, year_to);

    var asset_name = "R" + region_id + "-QA-TRANSITION-5Y-" + year_to;

    export_qa_image(product, asset_name);
  }
}

/**
 * Adds a yearly Landsat mosaic layer synchronously to preserve map layer order.
 *
 * @param {ee.ImageCollection} mosaics - Combined mosaic collection.
 * @param {number} year - Visualization year.
 * @param {ee.Image} region_mask - Binary mask for the classification region.
 * @returns {void}
 */
function add_mosaic(mosaics, year, region_mask) {
  var year_collection = mosaics.filterMetadata("year", "equals", year);

  // Empty fallback image preserving expected RGB bands when no mosaic exists,
  // avoiding asynchronous evaluate() calls.
  var empty_mosaic = ee.Image.constant([0, 0, 0])
    .rename(rgb_bands)
    .updateMask(ee.Image.constant(0));

  // Resolve mosaic selection entirely server-side.
  var year_mosaic = ee.Image(
    ee.Algorithms.If(
      year_collection.size().gt(0),
      year_collection.median().select(rgb_bands),
      empty_mosaic,
    ),
  );

  year_mosaic = year_mosaic.updateMask(region_mask);

  Map.addLayer(
    year_mosaic,
    {
      bands: ["swir1_median", "nir_median", "red_median"],
      gain: [0.08, 0.06, 0.2],
    },
    "MOSAICO " + year,
    false,
  );
}

/**
 * Adds a classification layer to the Earth Engine map.
 * Accepts both a complete multiband classification and an already-selected
 * single-band image.
 *
 * @param {ee.Image} image - Classification image.
 * @param {number} year - Visualization year.
 * @param {string[]} palette - MapBiomas classification palette.
 * @param {string} title - Layer title prefix.
 * @returns {void}
 */
function add_classification(image, year, palette, title) {
  Map.addLayer(
    image,
    {
      min: 0,
      max: palette.length - 1,
      palette: palette,
    },
    title + " " + year,
    false,
  );
}

/**
 * Creates a discrete legend panel for transition QA scores.
 *
 * @param {Object} param - Legend parameters.
 * @param {string} param.title - Legend header title.
 * @param {string[]} param.palette - Four-color hex palette for QA scores 0-3.
 * @returns {ui.Panel} QA legend UI panel.
 */
function create_qa_legend(param) {
  var labels = [
    "0 · Sin problemas",
    "1 · Esperado",
    "2 · Sospechoso",
    "3 · Altamente improbable",
  ];

  var rows = labels.map(function (label, index) {
    var color_box = ui.Label({
      value: "",
      style: {
        backgroundColor: "#" + param.palette[index],
        padding: "7px",
        margin: "3px 6px 3px 0",
      },
    });

    var description = ui.Label({
      value: label,
      style: {
        fontSize: "14px",
        margin: "2px 0 3px 0",
      },
    });

    return ui.Panel({
      widgets: [color_box, description],
      layout: ui.Panel.Layout.flow("horizontal"),
    });
  });

  return ui.Panel({
    widgets: [
      ui.Label({
        value: param.title,
        style: {
          fontSize: "13px",
          fontWeight: "bold",
          margin: "0 0 6px 0",
        },
      }),
    ].concat(rows),
    style: {
      padding: "8px 12px",
      margin: "0 0 6px 0",
      backgroundColor: "rgba(255, 255, 255, 1)",
      width: "245px",
    },
  });
}

/**
 * Creates a discrete legend panel for the number of distinct classes
 * involved in valid temporal transitions.
 *
 * @param {Object} param - Legend parameters.
 * @param {string} param.title - Legend header title.
 * @param {number} param.max - Maximum displayed class count.
 * @param {string[]} param.palette - Hex color palette for class counts `2..max`.
 * @returns {ui.Panel} Legend UI panel.
 */
function create_transition_class_count_legend(param) {
  var title = param.title;

  var max = param.max;

  var palette = param.palette;

  var rows = [];

  for (var class_count = 2; class_count <= max; class_count++) {
    var palette_index = class_count - 2;

    var label =
      class_count === max
        ? class_count + " ó más clases"
        : class_count + " clases";

    var color_box = ui.Label({
      value: "",
      style: {
        backgroundColor: "#" + palette[palette_index],
        padding: "7px",
        margin: "3px 6px 3px 0",
      },
    });

    var description = ui.Label({
      value: label,
      style: {
        fontSize: "14px",
        margin: "2px 0 3px 0",
      },
    });

    rows.push(
      ui.Panel({
        widgets: [color_box, description],
        layout: ui.Panel.Layout.flow("horizontal"),
      }),
    );
  }

  return ui.Panel({
    widgets: [
      ui.Label({
        value: title,
        style: {
          fontSize: "13px",
          fontWeight: "bold",
          margin: "0 0 6px 0",
        },
      }),
    ].concat(rows),
    style: {
      padding: "8px 12px",
      margin: "0 0 6px 0",
      backgroundColor: "rgba(255, 255, 255, 1)",
      width: "245px",
    },
  });
}

/**
 * Creates a horizontal continuous legend panel for the number
 * of valid temporal transitions.
 *
 * @param {Object} param - Legend parameters.
 * @param {string} param.title - Legend header title.
 * @param {number} param.min - Minimum transition count value.
 * @param {number} param.max - Maximum transition count value.
 * @param {string[]} param.palette - Hex color palette for the gradient bar.
 * @returns {ui.Panel} Legend UI panel.
 */
function create_transition_count_legend(param) {
  var title = param.title;

  var min = param.min;

  var max = param.max;

  var palette = param.palette;

  var gradient = ee.Image.pixelLonLat()
    .select("longitude")
    .multiply((max - min) / 100)
    .add(min);

  var thumbnail = ui.Thumbnail({
    image: gradient,
    params: {
      bbox: [0, 0, 100, 10],
      dimensions: "220x14",
      format: "png",
      min: min,
      max: max,
      palette: palette,
    },
    style: {
      stretch: "horizontal",
      margin: "0",
      maxHeight: "14px",
    },
  });

  var labels = ui.Panel({
    widgets: [
      ui.Label({
        value: min.toString(),
        style: {
          fontSize: "11px",
          margin: "0",
          width: "70px",
          textAlign: "left",
        },
      }),
      ui.Label({
        value: Math.round((min + max) / 2).toString(),
        style: {
          fontSize: "11px",
          margin: "0",
          width: "80px",
          textAlign: "center",
        },
      }),
      ui.Label({
        value: max.toString() + "+",
        style: {
          fontSize: "11px",
          margin: "0",
          width: "70px",
          textAlign: "right",
        },
      }),
    ],
    layout: ui.Panel.Layout.flow("horizontal"),
    style: {
      stretch: "horizontal",
      margin: "2px 0 0 0",
    },
  });

  return ui.Panel({
    widgets: [
      ui.Label({
        value: title,
        style: {
          fontSize: "13px",
          fontWeight: "bold",
          margin: "0 0 6px 0",
        },
      }),
      thumbnail,
      labels,
    ],
    style: {
      padding: "8px 12px",
      backgroundColor: "rgba(255, 255, 255, 1)",
      width: "245px",
    },
  });
}

/**
 * Creates a horizontal temporal gradient legend panel for the most recent
 * valid land-cover transition year at each pixel.
 *
 * @param {Object} param - Legend parameters.
 * @param {string} param.title - Legend header title.
 * @param {number} param.min - Earliest year in the gradient range.
 * @param {number} param.max - Latest year in the gradient range.
 * @param {string[]} param.palette - Hex color palette for the gradient bar.
 * @returns {ui.Panel} Legend UI panel.
 */
function create_last_change_year_legend(param) {
  var title = param.title;

  var min = param.min;

  var max = param.max;

  var palette = param.palette;

  var gradient = ee.Image.pixelLonLat()
    .select("longitude")
    .multiply((max - min) / 100)
    .add(min);

  var thumbnail = ui.Thumbnail({
    image: gradient,
    params: {
      bbox: [0, 0, 100, 10],
      dimensions: "220x14",
      format: "png",
      min: min,
      max: max,
      palette: palette,
    },
    style: {
      stretch: "horizontal",
      margin: "0",
      maxHeight: "14px",
    },
  });

  var labels = ui.Panel({
    widgets: [
      ui.Label({
        value: min.toString(),
        style: {
          fontSize: "11px",
          margin: "0",
          width: "70px",
          textAlign: "left",
        },
      }),
      ui.Label({
        value: Math.round((min + max) / 2).toString(),
        style: {
          fontSize: "11px",
          margin: "0",
          width: "80px",
          textAlign: "center",
        },
      }),
      ui.Label({
        value: max.toString(),
        style: {
          fontSize: "11px",
          margin: "0",
          width: "70px",
          textAlign: "right",
        },
      }),
    ],
    layout: ui.Panel.Layout.flow("horizontal"),
    style: {
      stretch: "horizontal",
      margin: "2px 0 0 0",
    },
  });

  return ui.Panel({
    widgets: [
      ui.Label({
        value: title,
        style: {
          fontSize: "13px",
          fontWeight: "bold",
          margin: "0 0 6px 0",
        },
      }),
      thumbnail,
      labels,
    ],
    style: {
      padding: "8px 12px",
      margin: "0 0 6px 0",
      backgroundColor: "rgba(255, 255, 255, 1)",
      width: "245px",
    },
  });
}
