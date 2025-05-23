C# Model & JSON Schema Generator for Newman

This Node.js script is a Newman reporter designed to automatically generate and update C# data models and JSON schemas from your API responses during Postman collection runs. It helps you keep your C# Data Transfer Objects (DTOs) synchronized with your API's evolving response structures.

Functions Overview

The script works by analyzing the JSON structure of your API responses and then performing several key tasks:

toPascalCase(str) & toSingular(word)

These utility functions help convert string formats. toPascalCase changes strings like user_name to UserName, ensuring C# naming conventions. toSingular attempts to convert plural words (e.g., categories to category) for better class naming when dealing with arrays.

jsTypeToCSharp(type, value)

This function maps JavaScript data types (like string, number, boolean) to their equivalent C# types (string, int, double, bool).

mergeSchemas(existing, incoming) & getComprehensiveRepresentativeObject(arr)

These functions are crucial for schema evolution. As your API responses might change or include new fields, mergeSchemas intelligently combines existing and new JSON schema information. getComprehensiveRepresentativeObject helps by creating a single, comprehensive object representation when dealing with arrays of diverse objects. This ensures your generated C# models capture all potential fields.

generateCSharpModel(modelName, obj, ...)

This is the core C# class generator. It takes a model name and a JSON schema object, then recursively builds the C# class definition, including properties with their correct C# types (required List<T>, required ClassName, etc.).

updateSchemaAndModel(modelName, obj)

This function orchestrates the saving process. It reads any existing .schema.json file, merges it with the latest response data, writes the updated schema, and then generates/overwrites the corresponding C# .cs file for the given modelName. It also recursively handles nested models.

buildFullModelFilesUniversal(rootObj)

This function is called for each API response body. It iterates through the top-level properties of the response and initiates the updateSchemaAndModel process for each, ensuring all relevant parts of your API response are modeled.

NewmanSaveResponsesReporter(emitter, reporterOptions, collectionRunOptions)

This is the main entry point for Newman. It sets up the output directory for your generated files and, most importantly, listens for the request event during your Newman run. When a request completes and a JSON response is received, it processes the response body by calling buildFullModelFilesUniversal, triggering the entire model and schema generation pipeline.

Setup and Usage

Follow these steps to use the generator with your Postman collections:

1. Install Dependencies
1. 
First, navigate to the directory where this script and your package.json file are located. Then, install the necessary packages globally:

Bash

npm install -g

Important: You must run npm install -g each time you want to use this specific API CDM generator, especially if you switch between projects with different reporter configurations.

2. Prepare Your Postman Collection
1. 
Export your Postman API collection (e.g., my_collection.json) to the same directory where you'll run this script.

Ensure your API key (if required) is correctly configured within your Postman collection for usage.

3. Execute Newman

Once your collection is ready, run Newman using the following command. This will execute your Postman collection and trigger the dal-gen reporter:

Bash

newman run postman_collection.json -r cli,dal-gen --reporter-dal-gen

newman run postman_collection.json: Runs your specified Postman collection.

-r cli,dal-gen: Enables the default command-line interface reporter (cli) and our custom reporter (dal-gen).

--reporter-dal-gen: This flag ensures Newman recognizes and initializes our custom reporter.

4. Enjoy Your Models!

After execution, you'll find your generated C# models (.cs files) along with their corresponding JSON schemas (.schema.json files) in your current working directory.