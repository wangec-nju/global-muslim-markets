# Country profile sources

These files power the four-mode country dossier. Raw downloads are not
committed; filtered extracts live under `data/source/geo/` and
`data/source/hs2-imports.csv`. `public/data/profiles.json` pins each filtered
file with SHA-256.

| File | Source | License | Notes |
| --- | --- | --- | --- |
| `profiles-factbook.csv` | [CIA World Factbook JSON](https://github.com/factbook/factbook.json) | Public domain | `People and Society > Languages` text, used as “常用语言” |
| `geo/admin1.csv` | [GeoNames admin1CodesASCII](https://download.geonames.org/export/dump/) | CC BY 4.0 | First-level division names; Wikidata Chinese labels; no boundary geometry |
| `geo/cities.csv` | [GeoNames cities15000](https://download.geonames.org/export/dump/) | CC BY 4.0 | Major cities: capital/first-level seats first, then population; Chinese names 338/338; English/local/coordinates |
| `geo/city-labels.csv` | [Wikidata](https://query.wikidata.org/) | CC0 | Chinese city labels via GeoNames id (P1566) |
| `geo/airports.csv` | [OurAirports](https://ourairports.com/data/) | Public domain | Large/medium scheduled airports with IATA |
| `geo/ports.csv` | [NGA World Port Index](https://msi.nga.mil/Publications) / [FAO mirror](https://data.apps.fao.org/catalog/dataset/158a8b96-6924-48a2-8ae2-d5cc1626915e) | Public domain | Large/medium/small WPI ports with coordinates |
| `geo/logistics.csv` | [UN/LOCODE](https://github.com/datasets/un-locode) | Public domain / UNECE | Rail/road terminals (function 2/3) selected near capital/major cities |
| `hs2-imports.csv` | [UN Comtrade](https://comtradeplus.un.org/) | Public data | 2023 imports (Algeria 2024), HS2 chapter totals; 57 OIC markets + China; 11 countries use mirror data |
| `china-divisions.csv` | Project curation | CC BY 4.0 | 34 province-level divisions |
| `china-cities.csv` | Project curation / GeoNames | CC BY 4.0 / CC BY 4.0 | China, Hong Kong and Macau cities |
| `china-hubs.csv` | Project curation / OurAirports / WPI | CC BY 4.0 / public domain | Selected Chinese airports and ports |

## Caveats

- **Routes**: UN Comtrade provides trade values, not route geometry. The globe
  draws great-circle arcs weighted by 2025 China trade to indicate trade links;
  they are explicitly labelled as schematic, not actual shipping lanes.
- **Administrative divisions** are names only; no admin-1 polygons are rendered.
- **Hubs** are a screened sample, not a complete airport/port/logistics list.
- **Logistics centres** are represented by UN/LOCODE rail/road terminals,
  not warehouse polygons; the UI labels them “物流枢纽（铁路/公路）”.
- **HS2** is a 2-digit chapter aggregate. Eleven OIC markets had no direct 2023/2024 HS2 response; their HS2 structure is a mirror of partner-reported exports to them, labelled “镜像”.
- **Common languages** is the Factbook free-text field; it may mix official,
  minority and trade languages. It is not a statistical ranking.
- The 4K night texture is from the three-globe example assets (NASA imagery).

## Geographic overlays

- `public/data/admin1-paths.json`: [Natural Earth 10m admin-1 states/provinces](https://www.naturalearthdata.com/) (public domain), simplified at 0.03° and filtered to the 57 markets + China.
- `public/data/sea-routes.json`: [searoute-py](https://github.com/genthalili/searoute-py) 1.6.0 over the Eurostat searoute graph; Eight Chinese ports to each market's main port (nearest port for landlocked countries). It is a shortest navigable path, **not** AIS tracking or a navigation product.
