/**
 * @fileoverview Training samples generator for MapBiomas Venezuela Collection 4.
 * Generates, balances, and exports annual training sample FeatureCollections
 * from Landsat mosaics and Collection 3 reference data in Google Earth Engine.
 *
 * @author MapBiomas Venezuela Team
 * @version 1.0.0
 * @see {@link https://venezuela.mapbiomas.org|MapBiomas Venezuela}
 */

/**
 * Configuration parameters and global settings.
 */

/**
 * Google Earth Engine username or project namespace for output assets.
 * @type {string}
 */
var user = "sig2-provita";

/**
 * Classification region identifier.
 * @type {number}
 */
var region_id = 92531;

/**
 * Target years for training sample generation.
 * @type {number[]}
 */
var years = [
  1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997,
  1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010,
  2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023,
  2024, 2025,
];

/**
 * Subset of years to display on the map for visual inspection.
 * @type {number[]}
 */
var preview = [1985, 2000, 2025];

/**
 * Spectral bands and indices extracted from the mosaics as the classifier feature space.
 * @type {string[]}
 */
var feature_space = [
  "blue_median",
  "green_median",
  "red_median",
  "nir_median",
  "swir1_median",
  "swir2_median",
  "tir_median",
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

/**
 * Total target number of training samples per year.
 * @type {number}
 */
var samples = 10000;

/**
 * Minimum number of training samples allocated per class.
 * @type {number}
 */
var min_samples = 1000;

/**
 * Reference class remapping dictionary.
 * @typedef {Object} RemapConfig
 * @property {number[]} from - Source class IDs to remap.
 * @property {number[]} to - Target class IDs after remapping.
 */

/**
 * Global remapping rules applied to the reference classification image.
 * @type {RemapConfig}
 */
var remap_all_reference = {
  from: [
    3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 23, 24, 25, 26,
    29, 30, 31, 32, 33, 34, 35, 50, 66, 68, 81, 82,
  ],
  to: [
    3, 4, 5, 5, 7, 9, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 23, 24, 24, 26,
    29, 30, 31, 32, 33, 34, 35, 50, 66, 68, 81, 82,
  ],
};

/**
 * Polygon geometries used to apply localized class remapping.
 * @type {Array<ee.FeatureCollection>}
 */
var remap_polygons = [reference_to_30];

/**
 * Output asset version identifier.
 * @type {number}
 */
var version = 1;

Map.setOptions("SATELLITE");

/**
 * Asset paths and external module dependencies.
 */

/** @type {string} Output Earth Engine asset folder for exported training samples. */
var output =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/SAMPLES";

/** @type {string} Earth Engine path to the Collection 3 integrated reference image. */
var reference_path =
  "projects/mapbiomas-venezuela/assets/LANDSAT/VENEZUELA-3/integracion/VENEZUELA-GUYANA-9";

/** @type {string} Earth Engine path to the classification region polygons. */
var regions =
  "projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion";

/** @type {string} Earth Engine path to Guyana Landsat mosaics. */
var guyana_mosaics = "projects/nexgenmap/MapBiomas2/LANDSAT/GUYANA/mosaics-2";

/** @type {string} Earth Engine path to Venezuela Landsat mosaics. */
var venezuela_mosaics =
  "projects/mapbiomas-mosaics/assets/LANDSAT/LULC/VENEZUELA/mosaics-2";

/** @type {Object} Shared MapBiomas Venezuela helper module. */
var functions = require("users/ejvalero/api:src/utils").functions;

/** @type {string[]} False-color RGB band combination for mosaic visualization. */
var rgb_combination = ["swir1_median", "nir_median", "red_median"];

/** @type {string} Attribute field name identifying the region ID in the vector asset. */
var regions_field = "gridcode";

/** @type {string} Band name prefix used in the reference classification image. */
var reference_prefix = "classification";

/** @type {number} Final year of the series; reuses the prior year's reference band when missing. */
var last_year = 2025;

/**
 * Visualization palette setup.
 *
 * The base `classification8` palette only contains indices 0-62.
 * Classes 66, 68, 81, and 82 are used by the Venezuela reference, so the
 * palette is extended up to ID 82.
 *
 * Official MapBiomas Venezuela Collection 3 colors:
 * - 66: Shrubland
 * - 68: Other non-vegetated natural areas
 * - 81: Andean herbaceous/shrubby vegetation
 * - 82: Flooded Andean herbaceous/shrubby vegetation
 *
 * @type {string[]}
 */
var palette = require("users/mapbiomas/modules:Palettes.js").get(
  "classification8",
);

palette = extend_palette(palette, 82, {
  66: "a89358",
  68: "e97a7a",
  81: "dfeb62",
  82: "6fc179",
});

/** @type {Object} Map visualization parameters for the reference classification layer. */
var vis_params = {
  min: 0,
  max: palette.length - 1,
  palette: palette,
};

/**
 * Input data loading: region boundary, country mosaics, and reference multiband image.
 */

/** @type {Object} Region geometry, vector feature collection, and raster mask. */
var region = functions.getRegion(regions, regions_field, region_id);

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

/** @type {ee.ImageCollection} Combined full-season mosaics for Venezuela and Guyana. */
var mosaics = ve_mosaics
  .merge(gu_mosaics)
  .filterMetadata("season", "equals", "full");

/** @type {ee.Image} Multiband reference classification image. */
var reference = ee.Image(reference_path);

/**
 * Preload available mosaic years and reference band names.
 *
 * These two lightweight `getInfo()` calls run once so the client-side
 * `forEach()` loop can skip years without mosaics or reference bands instead
 * of passing null images to `ee.Algorithms.If()`.
 */

/** @type {number[]} Years present in the merged mosaic collection. */
var available_mosaic_years = mosaics
  .aggregate_array("year")
  .distinct()
  .getInfo()
  .map(function (year) {
    return Number(year);
  });

/** @type {string[]} Band names present in the reference image. */
var available_reference_bands = reference.bandNames().getInfo();

print("AVAILABLE MOSAIC YEARS", available_mosaic_years);

print("PALETTE SIZE", palette.length);

/**
 * Annual processing loop: extract yearly reference, compute class areas,
 * build yearly mosaic, generate stratified training samples, and export assets.
 */
years.forEach(function (year) {
  try {
    // Validate that a mosaic exists for the current year.
    if (available_mosaic_years.indexOf(year) === -1) {
      print("No hay mosaicos disponibles para " + year.toString());

      return;
    }

    // Resolve the reference band selector (reuse previous year for last_year).
    var str_year = year.toString();

    var str_penultimate_year = (year - 1).toString();

    var selector =
      year === last_year
        ? reference_prefix + "_" + str_penultimate_year
        : reference_prefix + "_" + str_year;

    // Validate that the reference band exists for the current year.
    if (available_reference_bands.indexOf(selector) === -1) {
      print(
        "No existe la banda de referencia " + selector + " para el año " + year,
      );

      return;
    }

    var selected_reference = reference
      .select(selector)
      .updateMask(region.rasterMask)
      .remap(remap_all_reference.from, remap_all_reference.to)
      .rename("reference");

    var year_reference = functions
      .remapWithPolygons(selected_reference, remap_polygons)
      .reproject({
        crs: "EPSG:4326",
        scale: 30,
      });

    // Compute per-class areas and assemble the yearly mosaic.
    var year_areas = apply_areas(year_reference, region.vector);

    var areas_first = year_areas.first();

    var year_collection = mosaics.filterMetadata("year", "equals", year);

    var year_mosaic = year_collection
      .mosaic()
      .updateMask(region.rasterMask)
      .set("year", year);

    // Compute sample allocation per class and extract training samples.
    var points_count = functions.getPointsPerClass(
      year_areas,
      samples,
      min_samples,
    );

    var training = functions.getTrainingSamples({
      years: [year],
      mosaics: ee.ImageCollection([year_mosaic]),
      reference: year_reference,
      classIds: points_count.ids,
      pointsPerClass: points_count.points,
      region: region.vector,
    });

    // Prepare the sample FeatureCollection and export it as an Earth Engine asset.
    var collection = ee
      .FeatureCollection(training.data.get("samples-" + year))
      .map(function (feature) {
        return feature.set("year", year);
      });

    var filename = region_id + "-" + year + "-" + version;

    Export.table.toAsset({
      collection: collection,
      description: filename,
      assetId: output + "/" + filename,
      overwrite: true,
    });

    // Add preview layers and summary statistics for selected inspection years.
    if (preview.indexOf(year) !== -1) {
      var mosaic_name = "MOSAIC " + year;

      var samples_name = "SAMPLES " + year;

      var reference_name = "REFERENCE " + year;

      Map.addLayer(
        year_mosaic,
        {
          min: 0,
          max: 4000,
          bands: rgb_combination,
        },
        mosaic_name,
        false,
      );

      Map.addLayer(year_reference, vis_params, reference_name, false);

      // The extended palette supports classes 66, 68, 81, and 82.
      functions.addPointsToMap({
        points: training.points,
        region: region.vector,
        palette: palette,
        layerName: samples_name,
      });

      var props = areas_first
        .propertyNames()
        .filter(ee.Filter.stringStartsWith("item", "ID"));

      print("SAMPLING INFO " + year, points_count);

      print("ÁREAS POR CLASE " + year, areas_first.toDictionary(props));
    }
  } catch (error) {
    print("ERROR " + year, error.message);
  }
});

/**
 * Calculates the area (in square kilometers) per land cover class within a region.
 *
 * @param {ee.Image} image - Single-band classified reference image.
 * @param {ee.FeatureCollection} region_vector - Region boundary feature collection.
 * @returns {ee.FeatureCollection} Input feature collection enriched with `ID<classId>` area properties.
 */
function apply_areas(image, region_vector) {
  var area_image = ee.Image.pixelArea().divide(1e6).addBands(image);

  var stats = area_image.reduceRegion({
    reducer: ee.Reducer.sum().group({
      groupField: 1,
      groupName: "classId",
    }),

    geometry: region_vector.geometry(),

    scale: 30,

    maxPixels: 1e13,
  });

  // Guard against regions that contain no valid pixels.
  var groups = ee.List(
    ee.Algorithms.If(
      stats.contains("groups"),
      stats.get("groups"),
      ee.List([]),
    ),
  );

  var area_dict = ee.Dictionary.fromLists(
    groups.map(function (item) {
      var class_id = ee.Number(ee.Dictionary(item).get("classId"));

      return ee.String("ID").cat(class_id.format());
    }),

    groups.map(function (item) {
      return ee.Number(ee.Dictionary(item).get("sum")).round();
    }),
  );

  return region_vector.map(function (feature) {
    return feature.set(area_dict);
  });
}

/**
 * Extends a color palette array to support class IDs beyond its original length.
 * Missing intermediate indices are filled with a neutral gray fallback (`"808080"`).
 *
 * @param {string[]} base_palette - Base array of hex color strings indexed by class ID.
 * @param {number} max_class_id - Highest class ID that the returned palette must cover.
 * @param {Object.<string, string>} custom_colors - Map of class ID keys to hex color values.
 * @returns {string[]} Extended color palette array.
 */
function extend_palette(base_palette, max_class_id, custom_colors) {
  var extended_palette = base_palette.slice();

  // Fill missing intermediate indices with neutral gray.
  while (extended_palette.length <= max_class_id) {
    extended_palette.push("808080");
  }

  // Assign custom colors for specific class IDs.
  Object.keys(custom_colors).forEach(function (class_id) {
    extended_palette[Number(class_id)] = custom_colors[class_id];
  });

  return extended_palette;
}
