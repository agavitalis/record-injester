## 🧩 JSON Data Ingestion & Unified Query Service

A scalable, schema-adaptive backend built with **NestJS** and
**MongoDB** for ingesting, versioning, and querying large external JSON
datasets from multiple sources.

------------------------------------------------------------------------

## 🚀 Overview

This service ingests multiple external datasets stored in **AWS S3**,
normalizes them into a unified schema, and exposes a single query API
with full attribute-based filtering.

It's designed for **dynamic JSON sources** whose structures may evolve
over time --- automatically tracking schema changes and adjusting
indexes without manual migrations.

------------------------------------------------------------------------

## 🧱 Core Architecture

### **1. Data Ingestion & Schema Evolution**

-   **Dynamic ingestion pipeline** that streams large S3 JSON files (1
    KB -- 1 GB) using `@nestjs/axios` and `stream-json`.
-   **Schema evolution tracking** via a `JsonCatalog` collection that
    stores each source's:
    -   JSON schema (AJV-compatible)
    -   Field-to-path mappings (`jsonMap`)
    -   Index policy for optimized querying
-   **Auto-versioning:** New catalog versions are created automatically
    when new fields or type changes are detected.

### **2. Unified Record Storage**

-   All data from different sources are stored in a single `records`
    collection (`JsonData` model).
-   Each record includes:
    -   `source` → dataset origin\
    -   `catalogVersion` → schema version reference\
    -   `originalPayload` → full unaltered JSON\
    -   `normalizedPayload` → flattened, query-ready projection

### **3. Query & Filtering API**

-   A single endpoint returns data from **all ingested sources** with
    support for:
    -   Attribute filtering (city, country, price, etc.)
    -   Partial text search
    -   Numeric range filtering
-   Built on indexed `normalizedPayload` fields for fast lookups.

------------------------------------------------------------------------

## 🧩 Data Model Summary

### **JsonCatalog**

  Field           Description
  --------------- -----------------------------------------------------------
  `source`        Unique name of dataset (e.g. `structured_generated_data`)
  `version`       Auto-incremented schema version
  `jsonSchema`    AJV-compatible schema describing payload shape
  `jsonMap`       Map of normalized names → JSONPaths
  `indexPolicy`   Declarative index specs applied to `records`

### **JsonData**

  Field                 Description
  --------------------- -----------------------------------------------
  `source`              Source name
  `catalogVersion`      Version of schema used for ingestion
  `originalPayload`     Full JSON object as received
  `normalizedPayload`   Flat projection used for filtering & indexing

------------------------------------------------------------------------

## 🧠 Intelligent Schema Management

-   **Type drift detection:** If a field changes from `number` →
    `string`, the system widens the schema (`["number", "string"]`) and
    publishes a new version automatically.\
-   **Field addition:** Unknown fields trigger creation of new schema
    versions with updated `jsonMap` and sparse indexes.
-   **Backward compatibility:** Older data remain queryable under their
    recorded schema version.

------------------------------------------------------------------------

## 🌐 S3 Sources

The system automatically consumes the provided datasets:

``` ts
[
  "https://buenro-tech-assessment-materials.s3.eu-north-1.amazonaws.com/structured_generated_data.json",
  "https://buenro-tech-assessment-materials.s3.eu-north-1.amazonaws.com/large_generated_data.json"
]
```

Each file is streamed sequentially and ingested via the `syncRecords()`
function, ensuring constant memory usage.

------------------------------------------------------------------------

## 🧩 Technologies

  Layer              Tech Stack
  ------------------ -----------------------------------
  Framework          **NestJS (TypeScript)**
  Database           **MongoDB**
  HTTP Client        **@nestjs/axios** (Axios wrapper)
  JSON Streaming     **stream-json**
  Validation         **AJV**
  Containerization   Docker-ready
  Testing            Jest (optional)

------------------------------------------------------------------------

## 🔍 Example API

### **Sync JSON Sources**

``` bash
POST /records/sync
```

Triggers ingestion of all configured source URLs.

### **Query Records**

``` bash
GET /records?city=Paris&priceForNight[gte]=500&availability=true
```

Fetches normalized data from all datasets with attribute filters.

------------------------------------------------------------------------

## ⚙️ Running Locally

## Installation

```bash
$ npm install --legacy-peer-deps  
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

------------------------------------------------------------------------

## 📈 Scalability & Extensibility

  -----------------------------------------------------------------------
  Concern                           Approach
  --------------------------------- -------------------------------------
  **Large files (up to 1 GB)**      Streamed ingestion avoids loading
                                    into memory

  **New data sources**              Add URL → system detects and versions
                                    schema automatically

  **Schema changes**                Auto-versioning keeps track of
                                    differences

  **Filtering performance**         Declarative `indexPolicy` ensures
                                    indexed queries

  **Type drift**                    Automatically widens schema (`number`
                                    ↔ `string`)
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 🧩 How to Extend

To support a new JSON dataset: 1. Add the new S3 URL to the
`SOURCE_URLS` array. 2. Run `syncRecords()` (or hit `/records/sync`). 3.
The service automatically: - Creates an initial catalog for the new
source, - Detects structure and generates indexes, - Begins ingesting
data under the correct schema version.

------------------------------------------------------------------------

## 🧭 Key Evaluation Goals

✅ **Architecture:** Modular NestJS design with schema registry and
streaming ingestion\
✅ **Data Modeling:** Versioned catalogs and unified records\
✅ **Performance:** Streamed ingestion + sparse indexes\
✅ **Code Quality:** Clean, documented, and extensible\
✅ **Filtering Logic:** Attribute-based, type-safe querying

------------------------------------------------------------------------

## 📦 Directory Structure

    src/
    ├── core/
    │   └── catalog-engine.service.ts
    ├── modules/
    │   └── records/
    │       ├── entities/
    │       │   ├── json-catalog.entity.ts
    │       │   └── json-data.entity.ts
    │       ├── record.service.ts
    │       └── record.controller.ts
    └── main.ts

------------------------------------------------------------------------

## 🧑‍💻 Author

**Vitalis Ogbonna**\
Senior Software & DevOps Engineer\
*Tech Assessment --- Senior Backend Role*
