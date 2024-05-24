# shacl-2-viziquer

## About
This tool can read RDF knowledge graph SHACL files written in Turtle syntax and write the metadata into ViziQuer database. This is an alternative approach to tool https://github.com/LUMII-Syslab/OBIS-SchemaExtractor/tree/master.

## Requirements
* Local data shape server + PostgreSQL instance. Setup guide: https://github.com/LUMII-Syslab/data-shape-server/tree/main
    * After that: There must be available PostgreSQL schema to be filled, which is based on `empty` schema. `parameters` table need to have values in rows `schema_name`, `endpoint_url`, `endpoint_type`, `schema_kind`, `schema_extracting_details`, `schema_import_datetime`, `display_name_default`
* Local ViziQuer instance. Setup guide: https://github.com/LUMII-Syslab/viziquer

## Setup Guide
1. Fill .env file with parameters. Parameter descriptions are included in the file.
2. `npm run install`
3. `npm run start`

## Notes
* Some sample SHACL input files are located in `shacl-samples` folder. They are retrieved from the research https://zenodo.org/records/6798849.
* `database/dbpedia_shacl_dump.sql` contains a sample DB schema, that is already filled with metadata retrieved from `shacl-samples/DBpedia_SHACL_2023_processed.ttl`
* `shacl-samples/DBpedia_SHACL_2023_processed.ttl` file was made by removing unwanted artifacts from `shacl-samples/DBpedia_SHACL_2023.ttl` file, e.g. `%3E` symbols