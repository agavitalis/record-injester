##  JSON Data Ingestion & Unified Query Service

A scalable, schema-adaptive backend built with **NestJS** and
**MongoDB** for ingesting, versioning, and querying large external JSON
datasets from multiple sources.

------------------------------------------------------------------------

##  Overview

This service ingests multiple external datasets stored in **AWS S3**,
normalizes them into a unified schema, and exposes a single query API
with full attribute-based filtering.

It's designed for **dynamic JSON sources** whose structures may evolve
over time --- automatically tracking schema changes and adjusting
indexes without manual migrations.

------------------------------------------------------------------------

##  Core Architecture

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

##  Data Model Summary

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

## Intelligent Schema Management

-   **Type drift detection:** If a field changes from `number` →
    `string`, the system widens the schema (`["number", "string"]`) and
    publishes a new version automatically.\
-   **Field addition:** Unknown fields trigger creation of new schema
    versions with updated `jsonMap` and sparse indexes.
-   **Backward compatibility:** Older data remain queryable under their
    recorded schema version.

------------------------------------------------------------------------

## S3 Sources

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

## Technologies

  Layer              Tech Stack
  ------------------ -----------------------------------
  Framework          **NestJS (TypeScript)**
  Database           **MongoDB**
  HTTP Client        **@nestjs/axios** (Axios wrapper)
  JSON Streaming     **stream-json**
  Validation         **AJV**
  Containerization   Docker-ready

------------------------------------------------------------------------

##  Documentation

### **Swagger Docs**

``` bash
http://localhost:7100/docs
```

Triggers ingestion of all configured source URLs.

### **Queue Dashboard**

``` bash
http://localhost:7100/queues
```

------------------------------------------------------------------------

## Running the Application

You can run the app in 3 ways:

1. Without Docker
2. Using Docker as an image
3. Using Docker Compose (Recommended)


## 1. Running Locally without Docker
Ensure you configure the application ENV variables correctly, then install the application dependencies using the command:

### Installation

```bash
$ npm install --legacy-peer-deps  
```

### Start the application using the commands below:

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## 2. Running the app (Using Docker as an image)

Build the application docker image using the command:

### Build for staging linux/amd64 platform
```bash
docker build --build-arg BUILD_ENV=staging --platform linux/amd64 -f Dockerfile.staging -t vivvaa/injester-service-service:staging .
```

### Build for production linux/amd64 platform
```bash
docker build --build-arg BUILD_ENV=production --platform linux/amd64 -f Dockerfile.production -t vivvaa/injester-service-service:production .
```

### Start the application using:
```bash
docker run -p 7100:7100 --platform linux/amd64 vivvaa/injester-service:staging
```
or
```bash
docker run -p 7100:7100 --platform linux/amd64 vivvaa/injester-service:production
```


### 3. Running the app (Using Docker Compose -- Recommended)

This is the default configuration of this application. The only thing you need to do is to ensure you copied the contents of `.env.example` file to `.env` file. Then proceed to build the application docker image using the command:

```bash
docker compose build
```

Run the app using:

```bash
docker compose up 
```

You can also run in detached mode using:

```bash
docker compose up -d
```

To quit and delete use the command:

```bash
docker compose down
```

You can access the app while running via docker use the following URLs:
- Swagger Docs http://localhost:7100/docs
- Queue UI http://localhost:7100/queues
- Health Checks http://localhost:7100/api/v1/health

## Pushing to Dockerhub 
Build the application docker image using the command if you have not done so:

### Build for staging linux/amd64 platform
docker build --build-arg BUILD_ENV=staging --platform linux/amd64 -f Dockerfile.staging -t vivvaa/injester-service:staging .

### Build for production linux/amd64 platform
docker build --build-arg BUILD_ENV=production --platform linux/amd64 -f Dockerfile.production -t vivvaa/injester-service:production .


### Push the image
docker push vivvaa/injester-service:staging
docker push vivvaa/injester-service:production


## Docker Basic Debugging
Verify that your docker container is running using the command:

```bash
docker container ps
```

To view docker container logs use the command:

```bash
docker logs <container_id>
```

To delete a docker container use the command:

```bash
docker stop <container_id>
```

To delete a docker container use the command:

```bash
docker rm <container_id>
```

------------------------------------------------------------------------

## Scalability & Extensibility

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

##  How to Extend

To support a new JSON dataset: 1. Add the new S3 URL to the
`SOURCE_URLS` array in the env file. 2. Run `initiateSyncProcess()` (or hit `/records/injestManual`). 3.
The service automatically: - Creates an initial catalog for the new
source, - Detects structure and generates indexes, - Begins ingesting
data under the correct schema version.

------------------------------------------------------------------------

##  Key Evaluation Goals

✅ **Architecture:** Modular NestJS design with schema registry and
streaming ingestion\
✅ **Data Modeling:** Versioned catalogs and unified records\
✅ **Performance:** Streamed ingestion + sparse indexes\
✅ **Code Quality:** Clean, documented, and extensible\
✅ **Filtering Logic:** Attribute-based, type-safe querying

------------------------------------------------------------------------

##  Directory Structure

    src/
    ├── common/
    ├── infra/
    ├── modules/
    │   └── record/
    │       ├── entities/
    │       ├── dto/
    │       ├── helpers/
    └── main.ts

------------------------------------------------------------------------

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Support

For issues and questions:
- Create an issue in the repository
- Email: agavitalisogbonna@gmail.com

## License

This project is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/).
You may **use, share, and adapt** this software for **non-commercial purposes** only. For commercial use, please contact the author for permission.

---

**Author**: [Ogbonna Vitalis](mailto:agavitalisogbonna@gmail.com)  
**Version**: 1.0.0
