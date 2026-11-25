/**
 * @fileoverview Advanced temporal frequency filter for MapBiomas Venezuela Collection 4.
 *
 * Applies class-specific temporal frequency rules to an annual multiband
 * classification while preserving persistent transitions, protecting NoData,
 * and correcting short bounded temporal gaps in Google Earth Engine.
 *
 * Frequency, persistence, onset, and transition diagnostics are evaluated
 * over the complete series defined in `years`. The `apply_on_years` and
 * `apply_on_region` parameters restrict only where corrections may be written.
 *
 * @author MapBiomas Venezuela Team
 * @version 1.0.0
 * @see {@link https://venezuela.mapbiomas.org|MapBiomas Venezuela}
 */

/**
 * General configuration notes on the processing scope:
 *
 * - `apply_on_years` limits the years where corrections may be written.
 *   An empty array enables corrections for the complete temporal series.
 * - `apply_on_region` limits corrections to the supplied geometries or features.
 *   An empty array enables corrections across the complete processing region.
 */

/**
 * Google Earth Engine geometry imports.
 */

/** @type {ee.Geometry} Optional spatial polygon restricting where frequency corrections apply. */
var geometry =
  /* color: #d63000 */
  /* shown: false */
  ee.Geometry.Polygon([
    [
      [-70.2024764992972, 9.997548939360428],
      [-70.16539764187533, 10.034738849488173],
      [-70.20041656277377, 10.07665689911999],
      [-70.23406219265658, 10.044204690713611],
    ],
  ]);

/**
 * User configuration parameters.
 */

/** @type {string} Google Earth Engine username or project namespace for input/output assets. */
var user = "mayerlings-488722";

/** @type {number} Classification region identifier. */
var region_id = 92101;

/** @type {string} Country name used for mosaic filtering and output metadata. */
var country = "VENEZUELA";

/** @type {string} Input classification asset version suffix. */
var input_version = "8";

/** @type {string} Output frequency-filtered asset version suffix. */
var output_version = "9";

/** @type {number[]} Complete annual time series evaluated by the frequency filter. */
var years = [
  1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997,
  1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010,
  2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023,
  2024, 2025,
];

/** @type {number[]} Subset of years where corrections may be written (empty enables all years). */
var apply_on_years = [];

/** @type {Array<ee.Geometry|ee.Feature>} Spatial geometries restricting corrections (empty enables full region). */
var apply_on_region = [
  geometry,
  // geometry_2,
];

/** @type {number[]} Subset of years to display on the map for visual inspection. */
var preview = [1985, 2000, 2010, 2020, 2025];

/**
 * Frequency threshold rule for a land cover class.
 * @typedef {Object} FrequencyRule
 * @property {number} class_id - Land cover class identifier.
 * @property {number} frequency - Minimum temporal frequency in `(0, 1]` required to qualify.
 */

/** @type {FrequencyRule[]} Frequency rules applied to natural land cover classes. */
var natural_frequencies = [
  { class_id: 3, frequency: 0.7 },
  { class_id: 6, frequency: 0.7 },
  { class_id: 66, frequency: 0.7 },
  { class_id: 33, frequency: 0.7 },
  { class_id: 50, frequency: 0.7 },
];

/** @type {FrequencyRule[]} Frequency rules applied to anthropic land cover classes. */
var antropic_frequencies = [
  { class_id: 24, frequency: 0.6 },
  { class_id: 25, frequency: 0.7 },
  { class_id: 30, frequency: 0.9 },
  { class_id: 21, frequency: 0.5 },
];

/**
 * Temporal filter parameters.
 */

/** @type {number} Pixel class value representing NoData. */
var no_data = 27;

/** @type {number} Maximum consecutive non-target years treated as a bounded noise gap. */
var max_noise_run = 2;

/** @type {number} Minimum consecutive years of another class to qualify as persistent opposition. */
var min_transition_run = 3;

/** @type {number} Minimum consecutive years required to establish an anthropic class onset. */
var min_anthropic_persistence = 3;

/** @type {boolean} Whether presence of NoData disables full-series stabilization. */
var protect_no_data = true;

/** @type {number} Sentinel value indicating no persistent onset was detected. */
var no_onset = 9999;

/**
 * Asset paths, visualization settings, and module dependencies.
 */

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

/** @type {string} Output Earth Engine folder path for frequency-filtered assets. */
var output_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft";

/** @type {string} Earth Engine path to the classification region vector dataset. */
var regions =
  "projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion";

/** @type {Object} Shared MapBiomas Venezuela helper module. */
var functions = require("users/ejvalero/api:src/utils").functions;

/** @type {string[]} Official MapBiomas Collection 9 color palette. */
var palette = require("users/mapbiomas/modules:Palettes.js").get(
  "classification9",
);

/** @type {string[]} False-color RGB band combination for mosaic visualization. */
var rgb_bands = ["swir1_median", "nir_median", "red_median"];

/** @type {number[]} Region IDs belonging to the Andean classification zone. */
var andean_region_ids = [
  92001, 92002, 92003, 92004, 92005, 92006, 92007, 92008, 92009,
];

/** @type {string} Attribute field name identifying the region ID in the vector asset. */
var regions_field = "gridcode";

/** @type {string} Basemap type for the Earth Engine Code Editor map. */
var map_type = "SATELLITE";

/**
 * Configuration validation.
 */
validate_frequency_rules(natural_frequencies, antropic_frequencies);

validate_processing_scope({
  years: years,
  apply_on_years: apply_on_years,
  apply_on_region: apply_on_region,
});

if (min_transition_run <= max_noise_run) {
  throw new Error("min_transition_run debe ser mayor que max_noise_run.");
}

if (min_transition_run > years.length) {
  throw new Error(
    "min_transition_run no puede ser mayor que el número de años.",
  );
}

if (min_anthropic_persistence > years.length) {
  throw new Error(
    "min_anthropic_persistence no puede ser mayor que el número de años.",
  );
}

/**
 * Processing region setup.
 */

/** @type {Object} Region geometry, vector feature collection, and raster mask. */
var region = functions.getRegion(regions, regions_field, region_id);

/**
 * Mosaic spatial filters.
 */
var in_andean_filter = ee.Filter.stringContains("system:index", "ANDES");

var out_andean_filter = in_andean_filter.not();

var bounds_filter = ee.Filter.bounds(region.vector);

var andean_filter = ee.Filter.or(
  in_andean_filter,
  ee.Filter.and(out_andean_filter, bounds_filter),
);

/**
 * Mosaic collections.
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
 * Classification input loading.
 */
var band_names = years.map(function (year) {
  return "classification_" + year;
});

var input_filename = region_id + "-" + input_version;

var input_asset = input_path + "/" + input_filename;

/** @type {ee.Image} Input multiband classification image aligned and masked to the region. */
var original = ee
  .Image(input_asset)
  .select(band_names)
  .unmask(no_data)
  .updateMask(region.rasterMask)
  .toByte();

/**
 * Shared temporal context and correction scope masks.
 */

/** @type {Object} Precomputed temporal masks and reference images shared across rules. */
var temporal = build_temporal_context({
  image: original,
  years: years,
  band_names: band_names,
  no_data: no_data,
});

/** @type {Object} Temporal-spatial mask restricting where corrections are applied. */
var application = build_application_context({
  years: years,
  band_names: band_names,
  apply_on_years: apply_on_years,
  apply_on_region: apply_on_region,
  region_mask: region.rasterMask,
});

/**
 * Frequency candidate selection and rule application.
 */

/** @type {Object} Dominant class and frequency images per pixel. */
var frequency_candidate = get_frequency_candidate({
  image: original,
  natural_rules: natural_frequencies,
  antropic_rules: antropic_frequencies,
  temporal: temporal,
});

/** @type {ee.Image} Filtered multiband classification image. */
var corrected = original;

corrected = apply_natural_frequency_rules({
  original: original,
  result: corrected,
  candidate_class: frequency_candidate.class_image,
  rules: natural_frequencies,
  temporal: temporal,
  max_noise_run: max_noise_run,
  min_transition_run: min_transition_run,
  protect_no_data: protect_no_data,
  application_mask: application.mask,
});

corrected = apply_antropic_frequency_rules({
  original: original,
  result: corrected,
  candidate_class: frequency_candidate.class_image,
  rules: antropic_frequencies,
  temporal: temporal,
  max_noise_run: max_noise_run,
  min_transition_run: min_transition_run,
  min_persistence: min_anthropic_persistence,
  protect_no_data: protect_no_data,
  application_mask: application.mask,
});

// Enforce processing scope safeguard across all bands.
corrected = original.where(application.mask, corrected);

/**
 * Diagnostic layers.
 */
var corrected_years = original
  .neq(corrected)
  .reduce(ee.Reducer.sum())
  .rename("corrected_years")
  .toByte();

var candidate_class = frequency_candidate.class_image.updateMask(
  frequency_candidate.class_image.gte(0),
);

var candidate_frequency = frequency_candidate.frequency_image.updateMask(
  frequency_candidate.class_image.gte(0),
);

/**
 * Output metadata attachment.
 */
corrected = corrected.toByte().set({
  code_region: region_id,
  country: country,
  version: output_version,
  step: "advanced-temporal-frequency",
  implementation: "multiband-vectorized",
  max_noise_run: max_noise_run,
  min_transition_run: min_transition_run,
  min_anthropic_persistence: min_anthropic_persistence,
  protect_no_data: protect_no_data,
  apply_on_years: apply_on_years,
  editable_years: application.editable_years,
  apply_on_region_count: apply_on_region.length,
  descripcion: "advanced temporal frequency filter",
});

/**
 * Map visualization.
 */
Map.setOptions(map_type);

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

if (application.region_collection !== null) {
  Map.addLayer(
    application.region_collection.style({
      color: "00FFFF",
      fillColor: "00000000",
      width: 2,
    }),
    {},
    "ÁREA DE APLICACIÓN",
    true,
  );
}

preview.forEach(function (year) {
  add_mosaic(mosaics, year, region.rasterMask);

  add_classification(original, year, palette, "ORIGINAL");

  add_classification(corrected, year, palette, "CORREGIDA");

  add_temporal_change(original, corrected, year);
});

Map.addLayer(
  corrected_years.selfMask(),
  {
    min: 1,
    max: 10,
    palette: ["fff7bc", "fec44f", "fe9929", "ec7014", "cc4c02", "993404"],
  },
  "NÚMERO DE AÑOS CORREGIDOS",
  false,
);

Map.addLayer(
  candidate_class,
  {
    min: 0,
    max: palette.length - 1,
    palette: palette,
  },
  "CLASE DOMINANTE POR FRECUENCIA",
  false,
);

Map.addLayer(
  candidate_frequency,
  {
    min: 0,
    max: 1,
    palette: ["FFFFFF", "FFE082", "FF9800", "B71C1C"],
  },
  "FRECUENCIA CLASE DOMINANTE",
  false,
);

/**
 * Asset export and console diagnostics.
 */
var filename = region_id + "-" + output_version;

var image_id = output_path + "/" + filename;

Export.image.toAsset({
  image: corrected,
  description: filename,
  assetId: image_id,
  scale: 30,
  pyramidingPolicy: { ".default": "mode" },
  maxPixels: 1e13,
  region: region.vector.geometry().bounds(),
});

print("INPUT", original);

print("OUTPUT", corrected);

print("EDITABLE YEARS", application.editable_years);

print("APPLICATION MASK", application.mask);

print("CORRECTED YEARS", corrected_years);

print("FREQUENCY CANDIDATE CLASS", frequency_candidate.class_image);

print("FREQUENCY CANDIDATE VALUE", frequency_candidate.frequency_image);

/**
 * Validates natural and anthropic frequency rules.
 *
 * Ensures that every rule defines numeric `class_id` and `frequency`
 * properties, that frequency thresholds are within `(0, 1]`, and that
 * a class is configured only once across both rule groups.
 *
 * @param {Array<Object>} natural_rules Natural-class frequency rules.
 * @param {number} natural_rules[].class_id Class identifier.
 * @param {number} natural_rules[].frequency Minimum temporal frequency.
 * @param {Array<Object>} antropic_rules Anthropic-class frequency rules.
 * @param {number} antropic_rules[].class_id Class identifier.
 * @param {number} antropic_rules[].frequency Minimum temporal frequency.
 * @returns {void}
 */
function validate_frequency_rules(natural_rules, antropic_rules) {
  var rules = natural_rules.concat(antropic_rules);

  var registered = {};

  rules.forEach(function (rule) {
    if (
      typeof rule.class_id !== "number" ||
      typeof rule.frequency !== "number"
    ) {
      throw new Error(
        "Cada regla debe contener class_id y frequency numéricos.",
      );
    }

    if (rule.frequency <= 0 || rule.frequency > 1) {
      throw new Error(
        "La frecuencia de la clase " +
          rule.class_id +
          " debe estar entre 0 y 1.",
      );
    }

    if (Object.prototype.hasOwnProperty.call(registered, rule.class_id)) {
      throw new Error(
        "La clase " + rule.class_id + " está definida más de una vez.",
      );
    }

    registered[rule.class_id] = true;
  });
}

/**
 * Validates the temporal and spatial correction scope.
 *
 * @param {Object} param Configuration parameters.
 * @param {Array<number>} param.years Available classification years.
 * @param {Array<number>} param.apply_on_years Years where corrections may be written.
 * @param {Array<ee.Geometry|ee.Feature>} param.apply_on_region Spatial correction areas.
 * @returns {void}
 */
function validate_processing_scope(param) {
  var years = param.years;

  var apply_on_years = param.apply_on_years;

  var apply_on_region = param.apply_on_region;

  if (!Array.isArray(apply_on_years)) {
    throw new Error("apply_on_years debe ser un array.");
  }

  if (!Array.isArray(apply_on_region)) {
    throw new Error("apply_on_region debe ser un array.");
  }

  validate_year_list(apply_on_years, years, "apply_on_years");

  apply_on_region.forEach(function (item, index) {
    if (item === null || item === undefined) {
      throw new Error(
        "apply_on_region contiene un elemento vacío en la posición " +
          index +
          ".",
      );
    }
  });
}

/**
 * Validates a configured list of years against the available series.
 *
 * @param {Array<number>} configured_years Years to validate.
 * @param {Array<number>} available_years Available classification years.
 * @param {string} name Configuration variable name used in error messages.
 * @returns {void}
 */
function validate_year_list(configured_years, available_years, name) {
  var registered = {};

  configured_years.forEach(function (year) {
    if (typeof year !== "number" || available_years.indexOf(year) === -1) {
      throw new Error(
        name + " contiene un año inválido o fuera de la serie: " + year + ".",
      );
    }

    if (Object.prototype.hasOwnProperty.call(registered, year)) {
      throw new Error(name + " contiene el año duplicado: " + year + ".");
    }

    registered[year] = true;
  });
}

/**
 * Resolves the years where output corrections are allowed.
 *
 * An empty `apply_on_years` array returns the complete temporal series.
 *
 * @param {Object} param Parameters.
 * @param {Array<number>} param.years Available classification years.
 * @param {Array<number>} param.apply_on_years Requested editable years.
 * @returns {Array<number>} Years where corrections may be written.
 */
function get_editable_years(param) {
  var years = param.years;

  var apply_on_years = param.apply_on_years;

  if (apply_on_years.length === 0) {
    return years.slice();
  }

  return years.filter(function (year) {
    return apply_on_years.indexOf(year) !== -1;
  });
}

/**
 * Builds the multiband temporal-spatial mask that restricts corrections.
 *
 * The mask contains one band per classification year. A value of `1`
 * identifies pixels where the filtered result may replace the original
 * classification. Frequency and temporal diagnostics are not restricted
 * by this mask.
 *
 * @param {Object} param Parameters.
 * @param {Array<number>} param.years Classification years.
 * @param {Array<string>} param.band_names Classification band names.
 * @param {Array<number>} param.apply_on_years Years where corrections may be written.
 * @param {Array<ee.Geometry|ee.Feature>} param.apply_on_region Spatial correction areas.
 * @param {ee.Image} param.region_mask Raster mask of the processing region.
 * @returns {Object} Application context.
 */
function build_application_context(param) {
  var years = param.years;

  var band_names = param.band_names;

  var apply_on_years = param.apply_on_years;

  var apply_on_region = param.apply_on_region;

  var region_mask = param.region_mask;

  var editable_years = get_editable_years({
    years: years,
    apply_on_years: apply_on_years,
  });

  var editable_flags = years.map(function (year) {
    return editable_years.indexOf(year) !== -1 ? 1 : 0;
  });

  var temporal_mask = ee.Image.constant(editable_flags)
    .rename(band_names)
    .updateMask(region_mask)
    .toByte();

  var spatial_mask = ee.Image.constant(1).updateMask(region_mask).toByte();

  var region_collection = null;

  if (apply_on_region.length > 0) {
    var features = apply_on_region.map(function (item) {
      return ee.Feature(item);
    });

    region_collection = ee.FeatureCollection(features);

    var application_geometry = region_collection.geometry();

    spatial_mask = ee.Image.constant(1)
      .clip(application_geometry)
      .unmask(0)
      .updateMask(region_mask)
      .toByte();
  }

  var application_mask = temporal_mask
    .and(spatial_mask)
    .rename(band_names)
    .toByte();

  return {
    mask: application_mask,
    temporal_mask: temporal_mask,
    spatial_mask: spatial_mask,
    editable_years: editable_years,
    region_collection: region_collection,
  };
}

/**
 * Builds temporal masks and reference images shared by all class rules.
 *
 * NoData observations are excluded from valid-observation counts. All
 * structures preserve the original annual band alignment.
 *
 * @param {Object} param Parameters.
 * @param {ee.Image} param.image Annual multiband classification.
 * @param {Array<number>} param.years Classification years.
 * @param {Array<string>} param.band_names Classification band names.
 * @param {number} param.no_data NoData class value.
 * @returns {Object} Shared temporal context.
 */
function build_temporal_context(param) {
  var image = param.image;

  var years = param.years;

  var band_names = param.band_names;

  var no_data = param.no_data;

  var base_mask = image.select(0).mask();

  var valid = image.neq(no_data);

  var no_data_mask = image.eq(no_data);

  var valid_count = valid.reduce(ee.Reducer.sum()).rename("valid_count");

  var has_no_data = no_data_mask
    .reduce(ee.Reducer.max())
    .gt(0)
    .rename("has_no_data");

  var year_image = ee.Image.constant(years)
    .rename(band_names)
    .updateMask(base_mask)
    .toInt16();

  var zero_series = ee.Image.constant(repeat_value(0, years.length))
    .rename(band_names)
    .updateMask(base_mask)
    .toByte();

  return {
    years: years,
    band_names: band_names,
    no_data: no_data,
    base_mask: base_mask,
    valid: valid,
    no_data_mask: no_data_mask,
    valid_count: valid_count,
    has_no_data: has_no_data,
    year_image: year_image,
    zero_series: zero_series,
  };
}

/**
 * Selects the dominant class candidate that satisfies a frequency rule.
 *
 * Temporal frequency is calculated with all valid observations in the
 * complete series. NoData observations are excluded from the denominator.
 * If multiple classes qualify, the class with the highest frequency is
 * selected; ties preserve the first configured rule.
 *
 * @param {Object} param Parameters.
 * @param {ee.Image} param.image Annual multiband classification.
 * @param {Array<Object>} param.natural_rules Natural-class frequency rules.
 * @param {Array<Object>} param.antropic_rules Anthropic-class frequency rules.
 * @param {Object} param.temporal Shared temporal context.
 * @returns {Object} Candidate class, frequency, and valid-observation count.
 */
function get_frequency_candidate(param) {
  var image = param.image;

  var temporal = param.temporal;

  var rules = param.natural_rules.concat(param.antropic_rules);

  var best_class = ee.Image.constant(-1)
    .rename("candidate_class")
    .updateMask(temporal.base_mask)
    .toInt16();

  var best_frequency = ee.Image.constant(-1)
    .rename("candidate_frequency")
    .updateMask(temporal.base_mask);

  rules.forEach(function (rule) {
    var class_frequency = image
      .eq(rule.class_id)
      .reduce(ee.Reducer.sum())
      .divide(temporal.valid_count.max(1))
      .where(temporal.valid_count.eq(0), 0);

    var qualifies = class_frequency
      .gte(rule.frequency)
      .and(temporal.valid_count.gt(0));

    var replace = qualifies.and(class_frequency.gt(best_frequency));

    best_class = best_class.where(replace, rule.class_id);

    best_frequency = best_frequency.where(replace, class_frequency);
  });

  return {
    class_image: best_class,
    frequency_image: best_frequency,
    valid_count: temporal.valid_count,
  };
}

/**
 * Applies temporal frequency corrections for natural classes.
 *
 * A dominant natural class is stabilized across valid years when no
 * persistent opposition is detected. Otherwise, only short bounded gaps
 * are corrected. All writes are restricted by `application_mask`.
 *
 * @param {Object} param Parameters.
 * @param {ee.Image} param.original Original annual classification.
 * @param {ee.Image} param.result Current filtered result.
 * @param {ee.Image} param.candidate_class Dominant frequency candidate.
 * @param {Array<Object>} param.rules Natural-class rules.
 * @param {Object} param.temporal Shared temporal context.
 * @param {number} param.max_noise_run Maximum bounded-gap length to correct.
 * @param {number} param.min_transition_run Minimum persistent opposition length.
 * @param {boolean} param.protect_no_data Whether NoData prevents full stabilization.
 * @param {ee.Image} param.application_mask Temporal-spatial correction mask.
 * @returns {ee.Image} Corrected annual classification.
 */
function apply_natural_frequency_rules(param) {
  var original = param.original;

  var result = param.result;

  var candidate_class = param.candidate_class;

  var rules = param.rules;

  var temporal = param.temporal;

  var max_noise_run = param.max_noise_run;

  var min_transition_run = param.min_transition_run;

  var protect_no_data = param.protect_no_data;

  var application_mask = param.application_mask;

  rules.forEach(function (rule) {
    var class_id = rule.class_id;

    var class_candidate = candidate_class.eq(class_id);

    var persistent_opposition = has_persistent_opposition({
      image: original,
      class_id: class_id,
      temporal: temporal,
      min_run: min_transition_run,
      onset: null,
    });

    var full_stabilization = class_candidate.and(persistent_opposition.not());

    if (protect_no_data) {
      full_stabilization = full_stabilization.and(temporal.has_no_data.not());
    }

    var local_correction = class_candidate.and(full_stabilization.not());

    var correction_mask = temporal.valid.and(full_stabilization);

    var bounded_gaps = get_bounded_gap_correction_mask({
      image: original,
      class_id: class_id,
      temporal: temporal,
      max_noise_run: max_noise_run,
      onset: null,
    });

    correction_mask = correction_mask.or(bounded_gaps.and(local_correction));

    correction_mask = correction_mask.and(application_mask);

    result = result.where(correction_mask, class_id);
  });

  return result;
}

/**
 * Applies temporal frequency corrections for anthropic classes.
 *
 * Corrections begin only after the first persistent onset of the target
 * class. Anthropic classes are never propagated backward before that onset.
 * Persistent opposition is preserved, while short bounded gaps may be
 * corrected after onset. All writes are restricted by `application_mask`.
 *
 * @param {Object} param Parameters.
 * @param {ee.Image} param.original Original annual classification.
 * @param {ee.Image} param.result Current filtered result.
 * @param {ee.Image} param.candidate_class Dominant frequency candidate.
 * @param {Array<Object>} param.rules Anthropic-class rules.
 * @param {Object} param.temporal Shared temporal context.
 * @param {number} param.max_noise_run Maximum bounded-gap length to correct.
 * @param {number} param.min_transition_run Minimum persistent opposition length.
 * @param {number} param.min_persistence Minimum consecutive years defining onset.
 * @param {boolean} param.protect_no_data Whether NoData prevents stabilization.
 * @param {ee.Image} param.application_mask Temporal-spatial correction mask.
 * @returns {ee.Image} Corrected annual classification.
 */
function apply_antropic_frequency_rules(param) {
  var original = param.original;

  var result = param.result;

  var candidate_class = param.candidate_class;

  var rules = param.rules;

  var temporal = param.temporal;

  var max_noise_run = param.max_noise_run;

  var min_transition_run = param.min_transition_run;

  var min_persistence = param.min_persistence;

  var protect_no_data = param.protect_no_data;

  var application_mask = param.application_mask;

  rules.forEach(function (rule) {
    var class_id = rule.class_id;

    var class_candidate = candidate_class.eq(class_id);

    var onset = get_persistent_onset({
      image: original,
      class_id: class_id,
      temporal: temporal,
      min_persistence: min_persistence,
    });

    var has_onset = onset.lt(no_onset);

    var persistent_after_onset = has_persistent_opposition({
      image: original,
      class_id: class_id,
      temporal: temporal,
      min_run: min_transition_run,
      onset: onset,
    });

    var no_data_after_onset = has_no_data_after_onset({
      temporal: temporal,
      onset: onset,
    });

    var forward_stabilization = class_candidate
      .and(has_onset)
      .and(persistent_after_onset.not());

    if (protect_no_data) {
      forward_stabilization = forward_stabilization.and(
        no_data_after_onset.not(),
      );
    }

    var local_correction = class_candidate
      .and(has_onset)
      .and(forward_stabilization.not());

    var correction_mask = temporal.valid
      .and(forward_stabilization)
      .and(temporal.year_image.gte(onset));

    var bounded_gaps = get_bounded_gap_correction_mask({
      image: original,
      class_id: class_id,
      temporal: temporal,
      max_noise_run: max_noise_run,
      onset: onset,
    });

    correction_mask = correction_mask.or(bounded_gaps.and(local_correction));

    correction_mask = correction_mask.and(application_mask);

    result = result.where(correction_mask, class_id);
  });

  return result;
}

/**
 * Detects persistent runs of valid observations different from a target class.
 *
 * Temporal bands are aligned and evaluated as multiband images. When an
 * onset image is supplied, only opposition runs starting at or after onset
 * are considered.
 *
 * @param {Object} param Parameters.
 * @param {ee.Image} param.image Annual multiband classification.
 * @param {number} param.class_id Target class identifier.
 * @param {Object} param.temporal Shared temporal context.
 * @param {number} param.min_run Minimum consecutive opposition length.
 * @param {ee.Image|null} param.onset Per-pixel onset year or `null`.
 * @returns {ee.Image} Single-band persistent-opposition mask.
 */
function has_persistent_opposition(param) {
  var image = param.image;

  var class_id = param.class_id;

  var temporal = param.temporal;

  var min_run = param.min_run;

  var onset = param.onset;

  var opposition = image.neq(class_id).and(temporal.valid);

  var run_start = get_run_start_mask({
    condition: opposition,
    run_length: min_run,
    band_names: temporal.band_names,
  });

  if (onset !== null) {
    var start_years = temporal.years.slice(0, run_start.band_count);

    var start_year_image = ee.Image.constant(start_years)
      .rename(run_start.band_names)
      .updateMask(temporal.base_mask)
      .toInt16();

    run_start.image = run_start.image.and(start_year_image.gte(onset));
  }

  return run_start.image
    .reduce(ee.Reducer.max())
    .gt(0)
    .rename("persistent_opposition");
}

/**
 * Returns the first year of a persistent run for an anthropic class.
 *
 * Pixels without a qualifying run receive `no_onset`.
 *
 * @param {Object} param Parameters.
 * @param {ee.Image} param.image Annual multiband classification.
 * @param {number} param.class_id Target anthropic class.
 * @param {Object} param.temporal Shared temporal context.
 * @param {number} param.min_persistence Required consecutive class observations.
 * @returns {ee.Image} Per-pixel first persistent onset year.
 */
function get_persistent_onset(param) {
  var image = param.image;

  var class_id = param.class_id;

  var temporal = param.temporal;

  var min_persistence = param.min_persistence;

  var class_condition = image.eq(class_id);

  var run_start = get_run_start_mask({
    condition: class_condition,
    run_length: min_persistence,
    band_names: temporal.band_names,
  });

  var start_years = temporal.years.slice(0, run_start.band_count);

  var start_year_image = ee.Image.constant(start_years)
    .rename(run_start.band_names)
    .updateMask(temporal.base_mask)
    .toInt16();

  var onset = start_year_image
    .updateMask(run_start.image)
    .reduce(ee.Reducer.min())
    .unmask(no_onset)
    .updateMask(temporal.base_mask)
    .toInt16();

  return onset.rename("onset_" + class_id);
}

/**
 * Detects whether NoData occurs at or after a per-pixel temporal onset.
 *
 * @param {Object} param Parameters.
 * @param {Object} param.temporal Shared temporal context.
 * @param {ee.Image} param.onset Per-pixel onset year.
 * @returns {ee.Image} Single-band binary mask.
 */
function has_no_data_after_onset(param) {
  var temporal = param.temporal;

  var onset = param.onset;

  return temporal.no_data_mask
    .and(temporal.year_image.gte(onset))
    .reduce(ee.Reducer.max())
    .gt(0)
    .rename("no_data_after_onset");
}

/**
 * Detects start positions of consecutive true runs in a temporal series.
 *
 * The output is an aligned multiband image whose bands identify whether a
 * run of at least `run_length` begins at each valid temporal position.
 *
 * @param {Object} param Parameters.
 * @param {ee.Image} param.condition Multiband binary temporal condition.
 * @param {number} param.run_length Required consecutive run length.
 * @param {Array<string>} param.band_names Ordered temporal band names.
 * @returns {Object} Run-start image and temporal metadata.
 */
function get_run_start_mask(param) {
  var condition = param.condition;

  var run_length = param.run_length;

  var band_names = param.band_names;

  var band_count = band_names.length - run_length + 1;

  var output_names = band_names.slice(0, band_count);

  var run = condition.select(band_names.slice(0, band_count), output_names);

  for (var offset = 1; offset < run_length; offset++) {
    var shifted = condition.select(
      band_names.slice(offset, offset + band_count),
      output_names,
    );

    run = run.and(shifted);
  }

  return {
    image: run,
    band_names: output_names,
    band_count: band_count,
  };
}

/**
 * Builds a correction mask for short temporal gaps bounded by a target class.
 *
 * For each gap length from `1` to `max_noise_run`, the function detects
 * patterns equivalent to `A-X-A`, `A-X-X-A`, and longer configured variants.
 * Every value inside the gap must be valid and different from `class_id`.
 * When `onset` is supplied, only gaps beginning at or after onset qualify.
 *
 * @param {Object} param Parameters.
 * @param {ee.Image} param.image Annual multiband classification.
 * @param {number} param.class_id Target class identifier.
 * @param {Object} param.temporal Shared temporal context.
 * @param {number} param.max_noise_run Maximum bounded-gap length.
 * @param {ee.Image|null} param.onset Per-pixel onset year or `null`.
 * @returns {ee.Image} Multiband correction mask aligned to the annual series.
 */
function get_bounded_gap_correction_mask(param) {
  var image = param.image;

  var class_id = param.class_id;

  var temporal = param.temporal;

  var max_noise_run = param.max_noise_run;

  var onset = param.onset;

  var correction = temporal.zero_series;

  for (var gap_length = 1; gap_length <= max_noise_run; gap_length++) {
    var start_count = temporal.years.length - gap_length - 1;

    if (start_count <= 0) {
      continue;
    }

    var gap_start_names = temporal.band_names.slice(1, 1 + start_count);

    var previous = image
      .select(temporal.band_names.slice(0, start_count), gap_start_names)
      .eq(class_id);

    var next = image
      .select(
        temporal.band_names.slice(gap_length + 1, gap_length + 1 + start_count),
        gap_start_names,
      )
      .eq(class_id);

    var gap_start = previous.and(next);

    for (var offset = 0; offset < gap_length; offset++) {
      var current = image.select(
        temporal.band_names.slice(1 + offset, 1 + offset + start_count),
        gap_start_names,
      );

      gap_start = gap_start
        .and(current.neq(class_id))
        .and(current.neq(temporal.no_data));
    }

    if (onset !== null) {
      var gap_start_years = temporal.years.slice(1, 1 + start_count);

      var gap_year_image = ee.Image.constant(gap_start_years)
        .rename(gap_start_names)
        .updateMask(temporal.base_mask)
        .toInt16();

      gap_start = gap_start.and(gap_year_image.gte(onset));
    }

    for (var gap_offset = 0; gap_offset < gap_length; gap_offset++) {
      var target_names = temporal.band_names.slice(
        1 + gap_offset,
        1 + gap_offset + start_count,
      );

      var shifted_gap = gap_start.select(gap_start_names, target_names);

      var full_gap = temporal.zero_series.addBands(shifted_gap, null, true);

      correction = correction.or(full_gap);
    }
  }

  return correction.gt(0).rename(temporal.band_names);
}

/**
 * Creates a client-side array containing a repeated value.
 *
 * @param {*} value Value to repeat.
 * @param {number} count Number of repetitions.
 * @returns {Array<*>} Repeated-value array.
 */
function repeat_value(value, count) {
  var output = [];

  for (var i = 0; i < count; i++) {
    output.push(value);
  }

  return output;
}

/**
 * Adds an annual Landsat mosaic to the map while preserving layer order.
 *
 * An empty masked image is used when the requested year has no mosaic.
 * Mosaic selection remains server-side to avoid asynchronous layer ordering.
 *
 * @param {ee.ImageCollection} mosaics Mosaic collection.
 * @param {number} year Visualization year.
 * @param {ee.Image} region_mask Raster mask of the processing region.
 * @returns {void}
 */
function add_mosaic(mosaics, year, region_mask) {
  var year_collection = mosaics.filterMetadata("year", "equals", year);

  var empty_mosaic = ee.Image.constant([0, 0, 0])
    .rename(rgb_bands)
    .updateMask(ee.Image.constant(0));

  var year_mosaic = ee.Algorithms.If(
    year_collection.size().gt(0),
    year_collection.median().select(rgb_bands),
    empty_mosaic,
  );

  year_mosaic = ee.Image(year_mosaic).updateMask(region_mask);

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
 * Adds one annual classification band to the map.
 *
 * @param {ee.Image} image Annual multiband classification.
 * @param {number} year Visualization year.
 * @param {Array<string>} palette MapBiomas classification palette.
 * @param {string} title Layer-name prefix.
 * @returns {void}
 */
function add_classification(image, year, palette, title) {
  Map.addLayer(
    image.select("classification_" + year),
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
 * Adds a binary layer showing pixels changed by the temporal filter.
 *
 * @param {ee.Image} original Original annual classification.
 * @param {ee.Image} corrected Corrected annual classification.
 * @param {number} year Visualization year.
 * @returns {void}
 */
function add_temporal_change(original, corrected, year) {
  var band_name = "classification_" + year;

  var change = original
    .select(band_name)
    .neq(corrected.select(band_name))
    .selfMask();

  Map.addLayer(
    change,
    {
      min: 1,
      max: 1,
      palette: ["FF00FF"],
    },
    "CAMBIOS " + year,
    false,
  );
}
