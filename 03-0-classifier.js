/**
 * @fileoverview Supervised land use and land cover classifier for MapBiomas Venezuela Collection 4.
 * Trains a yearly Random Forest classifier on Landsat mosaics and exported training samples,
 * applies optional sample remapping, filtering, and complementary resampling, and exports
 * the resulting multiband annual classification image to a Google Earth Engine asset.
 *
 * @author MapBiomas Venezuela Team
 * @version 1.0.0
 * @see {@link https://venezuela.mapbiomas.org|MapBiomas Venezuela}
 */

/**
 * Geometry imports.
 * These example polygons can be converted to Google Earth Engine Geometry
 * imports when pasting the script into the GEE Code Editor.
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
var region_id = 90222;

/** @type {string} Country name used to filter mosaics and tag output metadata. */
var country = "VENEZUELA";

/** @type {string} Output collection folder name under Collection 4 general assets. */
var collection_id = "classification";

/** @type {number[]} Target years for classification and visualization. */
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
 * Remapping rules for training samples and classification outputs.
 * @typedef {Object} ClassificationRemapConfig
 * @property {Object} samples - Global class remapping applied to training samples.
 * @property {number[]} samples.from - Source class IDs.
 * @property {number[]} samples.to - Target class IDs.
 * @property {Array<ee.FeatureCollection>} polygons - Polygon collections for localized post-classification remapping.
 */

/** @type {ClassificationRemapConfig} */
var remap = {
  samples: {
    from: [
      3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 23, 24, 25, 26,
      29, 30, 31, 32, 33, 34, 35, 50, 66, 68, 81, 82,
    ],
    to: [
      3, 4, 6, 6, 7, 9, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 23, 24, 25, 26,
      29, 30, 31, 32, 33, 34, 35, 50, 66, 68, 81, 82,
    ],
  },

  polygons: [
    // remap_to_6,
    // remap_to_11,
    remap_to_21,
  ],
};

/** @type {number[]} Class IDs to exclude (mask out) from the training sample set. */
var remove_samples = [];

/**
 * Complementary sample generation configuration using user-drawn polygons.
 * @typedef {Object} AdditionalSamplesConfig
 * @property {Array<ee.Feature>} polygons - Polygons used to draw complementary training samples.
 * @property {number[]} classes - Class ID assigned to each polygon in `polygons`.
 * @property {number[]} points - Number of sample points to extract per polygon.
 */

/** @type {AdditionalSamplesConfig} */
var additional_samples = {
  polygons: [],
  classes: [3, 25],
  points: [3000, 3000],
};

/** @type {string[]} Spectral bands and indices used as predictor variables in the classifier. */
var feature_space = [
  "blue_median",
  "green_median",
  "red_median",
  "nir_median",
  "swir1_median",
  "swir2_median",
  "gv_median",
  "npv_median",
  "soil_median",
  "cloud_median",
  "shade_median",
  "ndfi_median",
  "ndvi_median",
  "evi_median",
  "savi_median",
  "gndvi_median",
  "ndmi_median",
  "nbr_median",
  "ndwi_median",
  "mndwi_median",
  "awei_median",
  "wri_median",
  "cmri_median",
  "mvi_median",
  "ndbi_median",
  "ui_median",
  "bsi_median",
  "ndsi_median",
  "iron_oxide_median",
  "ndti_median",
  "msavi2_median",
  "tc_brightness_median",
  "tc_greenness_median",
  "tc_wetness_median",
];

/** @type {string} Google Drive folder name for optional auxiliary exports. */
var drive_folder = "RF-PRELIMINAR-CLASSIFICATION";

/** @type {number} Input training samples version number. */
var samples_version = 1;

/** @type {number} Output classification asset version number. */
var output_version = 1;

/**
 * Asset paths and external module dependencies.
 */

/** @type {string} Earth Engine path to Guyana Landsat mosaics. */
var guyana_mosaics = "projects/nexgenmap/MapBiomas2/LANDSAT/GUYANA/mosaics-2";

/** @type {string} Earth Engine path to Venezuela Landsat mosaics. */
var venezuela_mosaics =
  "projects/mapbiomas-mosaics/assets/LANDSAT/LULC/VENEZUELA/mosaics-2";

/** @type {string} Output Earth Engine folder path for classified multiband assets. */
var output_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/" +
  collection_id;

/** @type {string} Input Earth Engine folder path containing yearly training sample assets. */
var samples_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/SAMPLES";

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

/** @type {number} Earth Engine `tileScale` factor for sampling operations. */
var tile_scale = 8;

/** @type {number} Number of decision trees in the Random Forest classifier. */
var trees = 100;

/**
 * Input data loading: region boundaries, mosaics (with Andean filtering when applicable),
 * and existing training sample assets.
 */

/** @type {Object} Region geometry, vector feature collection, and raster mask. */
var region = functions.getRegion(regions, regions_field, region_id);

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

/** @type {ee.ImageCollection} Guyana Landsat mosaics filtered to the feature space. */
var gu_mosaics = functions.getMapBiomasMosaics({
  path: guyana_mosaics,
  country: "GUYANA",
  variables: feature_space,
});

/** @type {ee.ImageCollection} Venezuela Landsat mosaics filtered to the feature space. */
var ve_mosaics = functions.getMapBiomasMosaics({
  path: venezuela_mosaics,
  country: "VENEZUELA",
  variables: feature_space,
});

ve_mosaics =
  andean_region_ids.indexOf(region_id) !== -1
    ? ve_mosaics.filter(andean_filter)
    : ve_mosaics;

/** @type {ee.ImageCollection} Combined full-season mosaics for Venezuela and Guyana. */
var mosaics = ve_mosaics
  .merge(gu_mosaics)
  .filterMetadata("season", "equals", "full");

/** @type {Array<Object>} Metadata list of assets currently stored in `samples_path`. */
var samples_list = ee.data.listAssets(samples_path).assets;

/** @type {string[]} Full Earth Engine asset IDs for available training sample tables. */
var processed_samples = samples_list.map(function (item) {
  return item.id;
});

/** @type {ee.Image} Base image accumulator onto which annual classification bands are appended. */
var classified = ee.Image(0).updateMask(region.rasterMask);

/**
 * Annual classification loop: load mosaic and samples, apply optional resampling,
 * train Random Forest, classify, apply polygon remaps, and add preview layers.
 */
years.forEach(function (year, error) {
  try {
    // Load yearly mosaic if available.
    var year_collection = mosaics.filterMetadata("year", "equals", year);

    var year_mosaic = ee.Image(
      ee.Algorithms.If(
        year_collection.size().gt(0),
        year_collection
          .mosaic()
          .updateMask(region.rasterMask)
          .set("year", year),
        null,
      ),
    );

    if (year_mosaic === null) {
      print("No hay datos satelitales disponibles para " + year);
      return;
    }

    var bands = year_mosaic.bandNames();

    var contained = bands.containsAll(ee.List(feature_space));

    // Load yearly training samples and remove excluded classes.
    var samples_names = region_id + "-" + year + "-" + samples_version;

    var full_samples_path = samples_path + "/" + samples_names;

    if (processed_samples.indexOf(full_samples_path) === -1) {
      print("No hay muestras disponibles para " + year);
      return;
    }

    var year_training_samples = ee
      .FeatureCollection(full_samples_path)
      .remap(remap.samples.from, remap.samples.to, "reference")
      .filter(ee.Filter.notNull(bands));

    year_training_samples = remove_samples
      ? year_training_samples.filter(
          ee.Filter.inList("reference", remove_samples).not(),
        )
      : year_training_samples;

    // Add complementary training samples from user polygons if configured.
    if (additional_samples.polygons.length > 0) {
      year_training_samples = apply_resampling({
        region: region.vector,
        mosaic: year_mosaic,
        additional_samples: additional_samples,
        tile_scale: tile_scale,
        samples: year_training_samples,
      });
    }

    // Train and run supervised Random Forest classification.
    var n_class_sample = functions.identifyClasses(
      contained,
      year_training_samples,
      ["reference"],
    );

    classified = apply_classification({
      trees: trees,
      condition_class_id: contained,
      n_class_sample: n_class_sample,
      samples: year_training_samples,
      mosaic: year_mosaic,
      classified: classified,
      raster_mask: region.rasterMask,
      bands: bands,
      year: year,
    });

    // Apply post-classification polygon remaps.
    if (remap.polygons && remap.polygons.length > 0) {
      classified = apply_remaps({
        year: year,
        image: classified,
        polygons: remap.polygons,
        algorithm: functions.remapWithPolygons,
      });
    }

    // Display mosaic, classification, and samples on the map for preview years.
    if (preview.indexOf(year) > -1) {
      var samples_name = "SAMPLES " + year;

      add_mosaic(mosaics, year, region.rasterMask);

      add_classification(classified, year, palette, "CLASIFICACIÓN");

      functions.addPointsToMap({
        points: year_training_samples,
        region: region.vector,
        palette: palette,
        layerName: samples_name,
      });
    }
  } catch (error) {
    print(error.message);
  }
});

/**
 * Output preparation and asset export: strip the initial placeholder band,
 * cast to Int8, attach metadata properties, and export to Earth Engine asset.
 */
classified = classified.slice(1).toInt8().set({
  code_region: region_id,
  pais: country,
  version: output_version,
  RFtrees: trees,
  samples_version: samples_version,
  descripcion: "clasificacion-1",
});

/** @type {string} Output filename and task description. */
var filename = region_id + "-" + output_version;

/** @type {string} Full Earth Engine asset ID for the exported classification image. */
var image_id = output_path + "/" + filename;

/** @type {string} Name prefix for optional variable-importance export table. */
var table_name = "IMPORTANCE-TABLE-" + country + "-";

table_name = table_name + region_id + "-" + output_version;

Export.image.toAsset({
  image: classified,
  description: filename,
  assetId: image_id,
  scale: 30,
  pyramidingPolicy: { ".default": "mode" },
  maxPixels: 1e13,
  region: region.vector.geometry().bounds(),
});

print("RESULTADO ", classified);

/**
 * Retrieves and filters a country's MapBiomas mosaic ImageCollection.
 *
 * @param {Object} param - Mosaic query configuration.
 * @param {string} param.path - Earth Engine path to the mosaic ImageCollection.
 * @param {string} param.country - Country metadata value to filter by.
 * @param {string[]} param.variables - Band names to select; returns all bands when empty.
 * @returns {ee.ImageCollection} Filtered mosaic ImageCollection.
 */
function get_mosaics(param) {
  var path = param.path;

  var country = param.country;

  var variables = param.variables;

  var mosaics = ee
    .ImageCollection(path)
    .filter(ee.Filter.eq("country", country));

  return variables.length > 0 ? mosaics.select(variables) : mosaics;
}

/**
 * Extracts complementary training samples from a mosaic inside specified polygons.
 *
 * @param {ee.Image} mosaic - Yearly Landsat mosaic image.
 * @param {AdditionalSamplesConfig} additional_samples - Polygons, target class IDs, and sample counts.
 * @param {number} tile_scale - Earth Engine `tileScale` parameter for `sample()`.
 * @returns {ee.FeatureCollection} Flattened collection of newly sampled training points.
 */
function resample_cover(mosaic, additional_samples, tile_scale) {
  var polygons = additional_samples.polygons,
    classIds = additional_samples.classes,
    points = additional_samples.points,
    new_samples = [];

  polygons.forEach(function (polygon, i) {
    var new_sample = mosaic
      .sample({
        numPixels: points[i],
        region: polygon.geometry(),
        scale: 30,
        projection: "EPSG:4326",
        seed: 1,
        geometries: true,
        tileScale: tile_scale,
      })
      .map(function (item) {
        return item.set("reference", classIds[i]);
      });

    new_samples.push(new_sample);
  });

  return ee.FeatureCollection(new_samples).flatten();
}

/**
 * Trains a Random Forest classifier and appends the classified annual band to the accumulator image.
 * Falls back to a nodata placeholder band (value 27) if validation checks fail.
 *
 * @param {Object} param - Classification parameters.
 * @param {number} param.trees - Number of trees in the Random Forest model.
 * @param {ee.Boolean} param.condition_class_id - Whether all feature-space bands exist in the mosaic.
 * @param {ee.Number} param.n_class_sample - Number of distinct classes present in the training samples.
 * @param {ee.FeatureCollection} param.samples - Training sample feature collection.
 * @param {string[]} param.bands - Predictor band names.
 * @param {ee.Image} param.mosaic - Yearly Landsat mosaic image.
 * @param {ee.Image} param.classified - Multiband classification accumulator image.
 * @param {number} param.year - Target classification year.
 * @param {ee.Image} param.raster_mask - Binary mask for the classification region.
 * @returns {ee.Image} Updated multiband classification image including `classification_<year>`.
 */
function apply_classification(param) {
  var trees = param.trees;

  var condition_class_id = param.condition_class_id;

  var n_class_sample = param.n_class_sample;

  var samples = param.samples;

  var bands = param.bands;

  var mosaic = param.mosaic;

  var classified = param.classified;

  var year = param.year;

  var raster_mask = param.raster_mask;

  // Validation rules:
  // 1. All required bands exist in the mosaic.
  // 2. At least one training sample is available.
  // 3. More than one class is present (cast with ee.Number for safety).
  var check_bands = ee.Algorithms.If(condition_class_id, 1, 0);

  var check_samples = ee.Algorithms.If(samples.size().gt(0), 1, 0);

  var check_classes = ee.Algorithms.If(ee.Number(n_class_sample).gt(1), 1, 0);

  // Combine validation flags via multiplication (1 * 1 * 1 = 1 means all checks pass).
  var should_train = ee
    .Number(check_bands)
    .multiply(check_samples)
    .multiply(check_classes);

  // Define and conditionally train the Random Forest classifier.
  var classifier = ee.Classifier.smileRandomForest({
    numberOfTrees: trees,
    variablesPerSplit: 1,
  });

  var trained_classifier = ee.Algorithms.If(
    should_train,
    classifier.train(samples, "reference", bands),
    null,
  );

  // Classify only when all validation rules pass; otherwise create a placeholder band (27).
  var img = ee.Image(
    ee.Algorithms.If(
      should_train,
      mosaic.classify(ee.Classifier(trained_classifier)),
      ee.Image(27).rename("classification"),
    ),
  );

  // Rename output band to `classification_<year>` and append it to the multiband image.
  img = img.select(["classification"], ["classification_" + year]);

  var mask_band = ee.Image(27).rename("classification_" + year);

  classified = ee
    .Image(
      ee.Algorithms.If(
        should_train,
        classified.addBands(img),
        classified.addBands(mask_band),
      ),
    )
    .unmask(27)
    .updateMask(raster_mask)
    .toByte();

  return classified;
}

/**
 * Replaces existing training samples inside complementary polygons with newly sampled points.
 *
 * @param {Object} param - Resampling parameters.
 * @param {ee.FeatureCollection} param.region - Region boundary feature collection.
 * @param {ee.Image} param.mosaic - Yearly Landsat mosaic image.
 * @param {AdditionalSamplesConfig} param.additional_samples - Complementary sample polygon config.
 * @param {number} param.tile_scale - Earth Engine `tileScale` parameter.
 * @param {ee.FeatureCollection} param.samples - Existing training sample collection.
 * @returns {ee.FeatureCollection} Merged training sample collection.
 */
function apply_resampling(param) {
  var region = param.region;

  var mosaic = param.mosaic;

  var additional_samples = param.additional_samples;

  var tile_scale = param.tile_scale;

  var samples = param.samples;

  var geom = ee
    .FeatureCollection(region.geometry().bounds())
    .map(function (item) {
      return item.set("version", 1);
    })
    .reduceToImage(["version"], ee.Reducer.first());

  var inside_polygons = ee
    .FeatureCollection(additional_samples.polygons)
    .reduceToImage(["id"], ee.Reducer.first());

  var outside_polygons = inside_polygons.mask().eq(0).selfMask();

  outside_polygons = geom.updateMask(outside_polygons);

  var outside_vector = outside_polygons.reduceToVectors({
    reducer: ee.Reducer.countEvery(),
    geometry: region.geometry().bounds(),
    scale: 30,
    maxPixels: 1e13,
  });

  var new_samples = resample_cover(mosaic, additional_samples, tile_scale);

  samples = samples.filterBounds(outside_vector).merge(new_samples);

  return samples;
}

/**
 * Applies polygon-based class remapping to a specific year's classification band.
 *
 * @param {Object} param - Remapping parameters.
 * @param {ee.Image} param.image - Multiband classification image.
 * @param {Array<ee.FeatureCollection>} param.polygons - Polygon feature collections defining remap rules.
 * @param {number} param.year - Target year whose band will be remapped.
 * @param {Function} param.algorithm - Remapping function accepting `(image, polygons)`.
 * @returns {ee.Image} Classification image with the updated annual band.
 */
function apply_remaps(param) {
  var image = param.image;

  var polygons = param.polygons;

  var year = param.year;

  var algorithm = param.algorithm;

  var band = "classification_" + year;

  var selected = image.select(band);

  var remaped = algorithm(selected, polygons).rename(band);

  return image.addBands(remaped, ee.List([band]), true);
}

/**
 * Adds a yearly false-color mosaic layer to the map if data exists for the given year.
 *
 * @param {ee.ImageCollection} mosaics - Combined mosaic ImageCollection.
 * @param {number} year - Target year to display.
 * @param {ee.Image} region_mask - Binary mask for the classification region.
 */
function add_mosaic(mosaics, year, region_mask) {
  var year_mosaic = mosaics.filterMetadata("year", "equals", year);

  year_mosaic.size().evaluate(function (number) {
    if (number > 0) {
      year_mosaic = year_mosaic.median().updateMask(region_mask);

      Map.addLayer(
        year_mosaic,
        {
          bands: ["swir1_median", "nir_median", "red_median"],
          gain: [0.08, 0.06, 0.2],
        },
        "MOSAICO " + year.toString(),
        false,
      );
    }
  });
}

/**
 * Adds a classified annual band layer to the Earth Engine map.
 *
 * @param {ee.Image} image - Multiband classification image.
 * @param {number} year - Target year to display.
 * @param {string[]} palette - Color palette array indexed by class ID.
 * @param {string} title - Layer title prefix.
 */
function add_classification(image, year, palette, title) {
  ee.Number(year).evaluate(function (year) {
    Map.addLayer(
      image,
      {
        bands: ["classification_" + year],
        min: 0,
        max: palette.length - 1,
        palette: palette,
      },
      title + " " + year,
      false,
    );
  });
}
