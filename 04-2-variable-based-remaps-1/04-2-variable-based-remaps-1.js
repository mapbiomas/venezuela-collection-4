/**
 * @fileoverview Variable-based post-classification remapping for MapBiomas Venezuela Collection 4.
 * Reclassifies target land cover classes based on auxiliary raster thresholds
 * (e.g., canopy height, NASADEM elevation, and spectral indices such as NDVI),
 * optionally constrained to specific years and spatial polygons, in Google Earth Engine.
 *
 * @author MapBiomas Venezuela Team
 * @version 1.0.0
 * @see {@link https://venezuela.mapbiomas.org|MapBiomas Venezuela}
 */

/**
 * Google Earth Engine geometry imports.
 */

/** @type {ee.Feature} Spatial polygon restricting where the NDVI remap rule is applied. */
var area_to_apply_ndvi = /* color: #d63000 */ ee.Feature(
  ee.Geometry.Polygon([
    [
      [-67.63650827807348, 8.915665885332574],
      [-67.60183267992895, 8.888191713207547],
      [-67.58054666918676, 8.91329165565251],
      [-67.58054666918676, 8.931267581945303],
      [-67.6100724260227, 8.958738511148647],
      [-67.6320450822727, 8.940763940042368],
    ],
  ]),
  {
    id: 1,
    "system:index": "0",
  },
);

/**
 * User configuration parameters.
 */

/** @type {string} Google Earth Engine username or project namespace for input/output assets. */
var user = "mayerlings-488722";

/** @type {number[]} Classification region IDs to process. */
var region_ids = [92420];

/** @type {string[]} Input asset version suffixes corresponding to `region_ids`. */
var input_versions = ["1"];

/** @type {string[]} Output asset version suffixes corresponding to `region_ids`. */
var output_versions = ["2"];

/** @type {number[]} Subset of years to display on the map for visual inspection. */
var preview_years = [2015, 2025];

/**
 * Years targeted for variable-based remapping.
 * When empty (`[]`), rules apply to the full `processing_years` series.
 * @type {number[]}
 */
var remap_years = [2024, 2025];

/** @type {number[]} Class IDs for which annual area summary charts are generated. */
var forest_ids = [3, 33];

/**
 * Variable-based remapping rule definition.
 * @typedef {Object} VariableRemapRule
 * @property {string} band_name - Auxiliary or mosaic band name evaluated by the rule (e.g., `elevation`, `canopy`, `ndvi_median`).
 * @property {string} operator - Comparison operator (`gte`, `lte`, `gt`, `lt`, `eq`).
 * @property {number[]} from - Source class IDs eligible for remapping.
 * @property {number[]} to - Target class IDs corresponding positionally to `from`.
 * @property {ee.Feature|ee.FeatureCollection|null} area_to_apply - Optional geometry restricting where the rule applies (`null` for entire region).
 * @property {number[]} [years] - Optional list of years to restrict this specific rule.
 */

/**
 * Sequential list of variable-based remapping rules.
 * Available variables: canopy height (Potapov GEDI v27), elevation (NASADEM), and mosaic spectral indices.
 * @type {VariableRemapRule[]}
 */
var rules = [
  {
    band_name: "elevation",
    elevation: 40,
    operator: "lte",
    from: [3],
    to: [21],
    area_to_apply: null,
  },

  {
    band_name: "ndvi_median", // Typical threshold range: 11400 - 19000
    ndvi_median: 100 * 100,
    operator: "lte",
    from: [3],
    to: [21],
    area_to_apply: area_to_apply_ndvi,
  },

  {
    band_name: "canopy",
    canopy: 5,
    operator: "lte",
    from: [3],
    to: [21],
    area_to_apply: null,
  },
];

/**
 * Asset paths, external modules, and processing constants.
 */

/** @type {number[]} Complete annual time series processed by the script. */
var processing_years = ee.List.sequence(1985, 2025).getInfo();

/** @type {string} Input Earth Engine folder path containing classification assets. */
var input_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification";

/** @type {string} Output Earth Engine folder path for remapped classification assets. */
var output_path =
  "projects/" +
  user +
  "/assets/MAPBIOMAS-VENEZUELA/LANDSAT/COLLECTION4/GENERAL/classification-ft";

/** @type {string} Earth Engine path to Potapov GEDI v27 forest canopy height asset. */
var canopy_path = "users/potapovpeter/GEDI_V27";

/** @type {string} Earth Engine path to NASADEM elevation asset. */
var elevation_path = "NASA/NASADEM_HGT/001";

/** @type {string} Earth Engine path to the classification region vector dataset. */
var regions_path =
  "projects/mapbiomas-venezuela/assets/DATOS-AUXILIARES/VECTORES/ve-gu-regiones-clasificacion";

/** @type {string} Earth Engine path to Guyana Landsat mosaics. */
var guyana_mosaics = "projects/nexgenmap/MapBiomas2/LANDSAT/GUYANA/mosaics-2";

/** @type {string} Earth Engine path to Venezuela Landsat mosaics. */
var venezuela_mosaics =
  "projects/mapbiomas-mosaics/assets/LANDSAT/LULC/VENEZUELA/mosaics-2";

/** @type {string[]} Official MapBiomas Collection 9 color palette. */
var palette = require("users/mapbiomas/modules:Palettes.js").get(
  "classification9",
);

/** @type {string[]} False-color RGB band combination for mosaic visualization. */
var rgb_combination = ["swir1_median", "nir_median", "red_median"];

/** @type {number[]} Region IDs belonging to the Andean classification zone. */
var andean_region_ids = [
  92001, 92002, 92003, 92004, 92005, 92006, 92007, 92008, 92009,
];

/**
 * Input data loading: region vectors, Landsat mosaics, canopy height, and elevation.
 */

/** @type {ee.FeatureCollection} Classification regions feature collection. */
var regions = ee.FeatureCollection(regions_path);

/** @type {Object} Shared MapBiomas Venezuela helper module. */
var functions = require("users/ejvalero/api:src/utils").functions;

/** @type {ee.Filter} Filter matching Andean mosaic tiles by system:index. */
var in_andean_filter = ee.Filter.stringContains("system:index", "ANDES");

/** @type {ee.Filter} Negated Andean mosaic filter. */
var out_andean_filter = in_andean_filter.not();

/** @type {ee.ImageCollection} Guyana Landsat mosaics. */
var gu_mosaics = functions.getMapBiomasMosaics({
  path: guyana_mosaics,
  country: "GUYANA",
  variables: [],
});

/** @type {ee.ImageCollection} Venezuela Landsat mosaics. */
var ve_mosaics = functions.getMapBiomasMosaics({
  path: venezuela_mosaics,
  country: "VENEZUELA",
  variables: [],
});

/** @type {ee.ImageCollection} Combined full-season mosaics for Venezuela and Guyana. */
var mosaics = ve_mosaics
  .merge(gu_mosaics)
  .filterMetadata("season", "equals", "full");

/** @type {ee.Image} Forest canopy height mosaic clipped to the classification regions. */
var canopy = ee
  .ImageCollection(canopy_path)
  .mosaic()
  .rename("canopy")
  .clip(regions);

/** @type {ee.Image} NASADEM elevation band. */
var elevation = ee.Image(elevation_path).select("elevation");

/**
 * Fallback NoData band array (value 27) used to backfill missing annual bands.
 * @type {ee.Image[]}
 */
var no_data = processing_years.map(function (year) {
  return ee.Image(27).rename("classification_" + year);
});

/**
 * Visualization parameters (extended palette for Venezuela-specific class IDs).
 */
palette = palette.concat([
  "#ff69b4",
  "#ebf8b5",
  "#b9158a",
  "#a89358",
  "#c8ffb4",
  "#e97a7a",
  "#be9e00",
  "#910046",
  "#6fc179",
  "#be83f7",
  "#c12100",
  "#2f7360",
  "#a89358",
  "#b45be0",
  "#69601e",
  "#7a6c00",
  "#dfeb62",
  "#6fc179",
]);

/** @type {Object} Map visualization parameters for RGB Landsat mosaics. */
var vis_mosaics_rgb = {
  min: 0,
  max: 4000,
  bands: "swir1_median,nir_median,red_median",
};

/** @type {Object} Map visualization parameters for NDVI mosaic layers. */
var vis_mosaics_ndvi = {
  min: 11000,
  max: 19000,
  bands: "ndvi_median",
  palette: "#FFFFFF,#F1B555,#66A000,#207401",
};

/** @type {Object} Map visualization parameters for land cover classification layers. */
var vis_covers = {
  min: 0,
  max: palette.length - 1,
  palette: palette,
};

/**
 * Region processing loop: apply variable-based rules, preview layers,
 * print area-time-series charts, and export updated assets.
 */
region_ids.forEach(function (region_id, i) {
  // 1. Prepare input classification and region mask.
  var input_name = region_id + "-" + input_versions[i];

  var output_name = region_id + "-" + output_versions[i];

  var input = ee.Image(input_path + "/" + input_name);

  var region = regions.filterMetadata("id_regionc", "equals", region_id);

  var region_mask = region.reduceToImage(["id_regionc"], ee.Reducer.first());

  input = input.addBands(no_data, null, false).updateMask(region_mask);

  // Resolve target years for remap execution.
  var years_to_process =
    remap_years.length > 0 ? remap_years : processing_years;

  // 2. Process annual bands using configured variable-based rules.
  var remaped_bands = processing_years.map(function (year) {
    var band = "classification_" + year.toString();

    // Apply remapping only if the current year is in the target list.
    if (years_to_process.indexOf(year) !== -1) {
      var bounds_filter = ee.Filter.bounds(region.vector);

      var andean_filter = ee.Filter.or(
        in_andean_filter,
        ee.Filter.and(out_andean_filter, bounds_filter),
      );

      mosaics =
        andean_region_ids.indexOf(region_id) !== -1
          ? mosaics.filter(andean_filter)
          : mosaics;

      var year_mosaic = mosaics.filterMetadata("year", "equals", year).mosaic();

      var remap_image = year_mosaic.addBands([canopy, elevation]);

      var remaped = apply_rules(input, band, remap_image);

      return remaped;
    } else {
      // Preserve original band when the year is excluded from remapping.
      return input.select(band);
    }
  });

  var output = ee
    .Image(remaped_bands)
    .updateMask(ee.Image(remaped_bands).neq(27));

  // 3. Add preview layers to the map.
  preview_years.forEach(function (year) {
    var str_year = year.toString();

    var band = "classification_" + str_year;

    var year_mosaic = mosaics.filterMetadata("year", "equals", year).mosaic();

    var mosaic = year_mosaic.updateMask(region_mask);

    var selected_input = input.select(band);

    var selected_output = output.select(band);

    Map.addLayer(
      mosaic,
      vis_mosaics_rgb,
      "MOSAIC: " + str_year + " " + region_id,
      false,
    );

    Map.addLayer(
      mosaic,
      vis_mosaics_ndvi,
      "NDVI: " + str_year + " " + region_id,
      false,
    );

    Map.addLayer(
      selected_input,
      vis_covers,
      "INPUT: " + str_year + " " + region_id,
    );

    Map.addLayer(
      selected_output,
      vis_covers,
      "OUTPUT: " + str_year + " " + region_id,
    );
  });

  // 4. Print annual area charts for selected target classes.
  forest_ids.forEach(function (classification) {
    var image = output
      .eq(classification)
      .multiply(ee.Image.pixelArea())
      .divide(1000000);

    var chart = ui.Chart.image
      .regions({
        image: image,
        regions: region,
        reducer: ee.Reducer.sum(),
        seriesProperty: "label",
      })
      .setChartType("AreaChart")
      .setOptions({
        title: "Result " + "ID" + classification + " " + region_id,
        hAxis: {
          title: "Años",
          titleTextStyle: {
            italic: false,
            bold: true,
          },
        },
        vAxis: {
          title: "Superficie km²",
          titleTextStyle: {
            italic: false,
            bold: true,
          },
        },
        colors: ["brown"],
      });

    print(chart);
  });

  // 5. Attach metadata and export remapped image to Earth Engine asset.
  output = output.byte().set({
    version: output_versions[i],
    step: "remaped-by-variables",
  });

  Export.image.toAsset({
    image: output,
    description: output_name,
    assetId: output_path + "/" + output_name,
    scale: 30,
    pyramidingPolicy: {
      ".default": "mode",
    },
    maxPixels: 1e13,
    region: region.geometry().bounds(),
  });
});

/**
 * Evaluates a threshold comparison against a single-band image.
 *
 * @param {ee.Image} image - Single-band predictor image.
 * @param {string} operator - Comparison operator (`gte`, `lte`, `gt`, `lt`, `eq`).
 * @param {number} threshold - Numeric threshold value.
 * @returns {ee.Image} Binary condition mask image.
 */
function create_condition(image, operator, threshold) {
  var conditions = {
    gte: image.gte(threshold),
    lte: image.lte(threshold),
    gt: image.gt(threshold),
    lt: image.lt(threshold),
    eq: image.eq(threshold),
  };

  return conditions[operator];
}

/**
 * Applies all configured variable-based remapping rules to a single annual band.
 *
 * @param {ee.Image} input - Multiband classification image.
 * @param {string} band_name - Target annual band name (`classification_<year>`).
 * @param {ee.Image} ramap_image - Auxiliary multiband image containing predictor variables.
 * @returns {ee.Image} Remapped single-band classification image.
 */
function apply_rules(input, band_name, ramap_image) {
  var band = input.select(band_name);

  var year_as_string = band_name.replace("classification_", "");

  var year = Number(year_as_string);

  rules.forEach(function (rule) {
    var apply_to_year = true;

    if (rule.years && rule.years.indexOf(year) === -1) apply_to_year = false;

    if (!apply_to_year) return;

    // 1. Evaluate base attribute condition (canopy, elevation, spectral index, etc.).
    var condition_band_1 = ramap_image.select(rule.band_name);

    var threshold_1 = rule[rule.band_name];

    var attribute_condition = create_condition(
      condition_band_1,
      rule.operator,
      threshold_1,
    );

    // 2. Build spatial mask when the rule is restricted to a geometry.
    var spatial_mask = ee.Image(1);

    if (rule.area_to_apply) {
      spatial_mask = ee
        .FeatureCollection(rule.area_to_apply)
        .reduceToImage(["id"], ee.Reducer.first())
        .clipToBoundsAndScale({
          geometry: rule.area_to_apply.geometry(),
          scale: 30,
        });
    }

    // 3. Apply remap where source class, attribute condition, and spatial mask all match.
    rule.from.forEach(function (from_value, i) {
      var mask = band.eq(from_value).and(attribute_condition).and(spatial_mask);

      band = band.where(mask, rule.to[i]);
    });
  });

  return band.rename(band_name);
}
