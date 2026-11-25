![MapBiomas Venezuela](./mapbiomas-venezuela.png)

[![Back to Venezuela All Initiatives](https://img.shields.io/badge/←%20Venezuela%20All%20Initiatives-gray?style=for-the-badge)](https://github.com/mapbiomas/venezuela-all-initiatives)

# MapBiomas Venezuela

_**Land Use and Land Cover Classification Module — Collection 4**_

MapBiomas Venezuela monitors land use and land cover changes at a national scale through annual multitemporal mapping, enabling the analysis of ecosystem pressures and human expansion across all Venezuelan regions. To produce annual historical land use and land cover maps, the initiative uses Google Earth Engine and collaborates with a network of regional experts. Collection 4 covers the entire national territory across all administrative and classification regions, including Amazon, Andes, Central, Guayana Esequiba, Llanos (plains), Western, and Eastern regions.

## Repository Structure

```text
venezuela-collection-4/
    ├── 02-2-training-samples/
    ├── 03-0-classifier/
    ├── 03-2-gapfill/
    ├── 03-3-spatial-filter/
    ├── 03-4-temporal-filter/
    ├── 03-5-frequency-filter/
    ├── 04-2-variable-based-remaps-1/
    ├── 04-3-year-based-remaps/
    ├── 05-0-transition-map/
    ├── 05-1-user-integration/
    └── 05-2-download-images/
```

## General Features

MapBiomas Venezuela Collection 4 maps are generated using machine learning in Google Earth Engine through pixel-by-pixel classification of Landsat imagery at 30 m resolution. The time series covers **1985 to 2025** (41 annual bands), organized by classification regions across the national territory.

## Methodological Steps

| Script | Description | Documentation |
|--------|-------------|---------------|
| [`02-2-training-samples.js`](./02-2-training-samples/02-2-training-samples.js) | Generates, balances, and exports annual stratified training samples from Landsat mosaics and Collection 3 reference data | [English version](./02-2-training-samples/#readme) · [Spanish version](./02-2-training-samples/es/#readme) |
| [`03-0-classifier.js`](./03-0-classifier/03-0-classifier.js) | Supervised annual Random Forest classification in Google Earth Engine with optional sample filtering, resampling, and polygon remaps | [English version](./03-0-classifier/#readme) · [Spanish version](./03-0-classifier/es/#readme) |
| [`03-2-gapfill.js`](./03-2-gapfill/03-2-gapfill.js) | Fills masked observations, including NoData (`27`), by propagating valid classes backward and then forward through the series | [English version](./03-2-gapfill/#readme) · [Spanish version](./03-2-gapfill/es/#readme) |
| [`03-3-spatial-filter.js`](./03-3-spatial-filter/03-3-spatial-filter.js) | Applies the local 3 × 3 focal mode to components at or below the connectivity threshold | [English version](./03-3-spatial-filter/#readme) · [Spanish version](./03-3-spatial-filter/es/#readme) |
| [`03-4-temporal-filter.js`](./03-4-temporal-filter/03-4-temporal-filter.js) | Applies sequential 3-, 4-, and 5-year window rules and edge rules, then restores selected years and original classes | [English version](./03-4-temporal-filter/#readme) · [Spanish version](./03-4-temporal-filter/es/#readme) |
| [`03-5-frequency-filter.js`](./03-5-frequency-filter/03-5-frequency-filter.js) | Stabilizes dominant natural and anthropic classes, with safeguards for persistent transitions and NoData and controls for editable years and areas | [English version](./03-5-frequency-filter/#readme) · [Spanish version](./03-5-frequency-filter/es/#readme) |
| [`04-2-variable-based-remaps-1.js`](./04-2-variable-based-remaps-1/04-2-variable-based-remaps-1.js) | Remaps classes in selected years using thresholds for GEDI canopy height, NASADEM elevation, and annual mosaic NDVI | [English version](./04-2-variable-based-remaps-1/#readme) · [Spanish version](./04-2-variable-based-remaps-1/es/#readme) |
| [`04-3-year-based-remaps.js`](./04-3-year-based-remaps/04-3-year-based-remaps.js) | Remaps selected classes over a year range using the original classification of a reference year | [English version](./04-3-year-based-remaps/#readme) · [Spanish version](./04-3-year-based-remaps/es/#readme) |
| [`05-0-transition-map.js`](./05-0-transition-map/05-0-transition-map.js) | Computes annual transition codes, pixel-history summary metrics, last change year, and multi-interval QA transition diagnostics | [English version](./05-0-transition-map/#readme) · [Spanish version](./05-0-transition-map/es/#readme) |
| [`05-1-user-integration.js`](./05-1-user-integration/05-1-user-integration.js) | Combines regional post-classification assets into an integrated mosaic for visual inspection alongside Landsat mosaics | — |
| [`05-2-download-images.js`](./05-2-download-images/05-2-download-images.js) | Exports selected annual classification bands as 8-bit GeoTIFF rasters to Google Drive | [English version](./05-2-download-images/#readme) · [Spanish version](./05-2-download-images/es/#readme) |

## Results

The processed outputs are integrated into the MapBiomas Venezuela Collection 4 land use and land cover maps, enabling:

- Environmental monitoring and ecosystem accounting.
- Public policy development and territorial planning.
- Scientific research and biodiversity assessment.
- Historical analysis from 1985 to 2025.

If you are not familiar with MapBiomas workflows, check the [official methodology documentation](https://venezuela.mapbiomas.org/descripcion-general-de-la-metodologia/).

For more information about MapBiomas Venezuela, visit [venezuela.mapbiomas.org](https://venezuela.mapbiomas.org).

To explore the products from the available modules, visit [plataforma.venezuela.mapbiomas.org](https://plataforma.venezuela.mapbiomas.org).
