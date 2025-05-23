const fs = require('fs');
const path = require('path');

let outputDir = process.cwd(); // Default to current working directory

function toPascalCase(str) {
    return str
        .replace(/(^\w|_\w)/g, m => m.replace('_', '').toUpperCase())
        .replace(/[^a-zA-Z0-9]/g, '');
}

function toSingular(word) {
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('ses')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
}

function jsTypeToCSharp(type, value) {
    if (type === 'string') return 'string';
    if (type === 'number') return Number.isInteger(value) ? 'int' : 'double';
    if (type === 'boolean') return 'bool';
    if (type === 'object') return Array.isArray(value) ? 'List<object>' : 'object';
    return 'object';
}

function mergeSchemas(existing, incoming) {
    // Recursively merge two schema objects, unioning all keys
    const merged = { ...existing };
    for (const key of Object.keys(incoming)) {
        if (merged[key] === undefined) {
            merged[key] = incoming[key];
        } else if (
            typeof merged[key] === 'object' &&
            merged[key] !== null &&
            typeof incoming[key] === 'object' &&
            incoming[key] !== null &&
            !Array.isArray(merged[key]) &&
            !Array.isArray(incoming[key])
        ) {
            merged[key] = mergeSchemas(merged[key], incoming[key]);
        } else if (Array.isArray(merged[key]) && Array.isArray(incoming[key])) {
            // Merge array schemas by merging representative objects
            const repA = getComprehensiveRepresentativeObject(merged[key]);
            const repB = getComprehensiveRepresentativeObject(incoming[key]);
            merged[key] = [mergeSchemas(repA, repB)];
        } else if (merged[key] === null && incoming[key] !== null) {
            merged[key] = incoming[key];
        }
        // else: keep existing
    }
    return merged;
}

function mergeObjectKeys(arr) {
    return arr.reduce((acc, obj) => {
        if (typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach(k => acc.add(k));
        }
        return acc;
    }, new Set());
}

function getComprehensiveRepresentativeObject(arr) {
    const keys = mergeObjectKeys(arr);
    const rep = {};
    keys.forEach(k => {
        let valueSample = undefined;
        for (const obj of arr) {
            if (obj && typeof obj === 'object' && obj.hasOwnProperty(k)) {
                valueSample = obj[k];
                break;
            }
        }
        rep[k] = valueSample === undefined ? null : valueSample;
    });
    return rep;
}

// Recursively collect nested class definitions, one per property name
function generateCSharpModel(modelName, obj, nestedClasses = {}, parentNames = new Set()) {
    let props = '';
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (Array.isArray(value)) {
            let elemType = 'object';
            if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
                const singular = toPascalCase(toSingular(key));
                const nestedModelName = singular;
                const repObj = getComprehensiveRepresentativeObject(value);
                // Always update nested schema/model
                updateSchemaAndModel(nestedModelName, repObj);
                elemType = nestedModelName;
            } else if (value.length > 0) {
                elemType = jsTypeToCSharp(typeof value[0], value[0]);
            }
            props += `    public required List<${elemType}> ${toPascalCase(key)} { get; set; }\n`;
        } else if (typeof value === 'object' && value !== null) {
            const nestedModelName = toPascalCase(key);
            // Always update nested schema/model
            updateSchemaAndModel(nestedModelName, value);
            props += `    public required ${nestedModelName} ${toPascalCase(key)} { get; set; }\n`;
        } else {
            props += `    public required ${jsTypeToCSharp(typeof value, value)} ${toPascalCase(key)} { get; set; }\n`;
        }
    }
    return `public class ${modelName} {\n${props}}\n`;
}

// Update schema and model for a given model name and object
function updateSchemaAndModel(modelName, obj) {
    const schemaFilePath = path.join(outputDir, `${modelName}.schema.json`);
    let schemaObj = obj;
    if (fs.existsSync(schemaFilePath)) {
        try {
            const existingSchema = JSON.parse(fs.readFileSync(schemaFilePath, 'utf8'));
            schemaObj = mergeSchemas(existingSchema, obj);
        } catch {
            // fallback: use new schema
        }
    }
    fs.writeFileSync(schemaFilePath, JSON.stringify(schemaObj, null, 2), 'utf8');

    // Generate C# model
    const nestedClasses = {};
    const parentNames = new Set();
    const classCode = generateCSharpModel(modelName, schemaObj, nestedClasses, parentNames);

    const fileContent = `using MongoDB.Bson;\nusing MongoDB.Bson.Serialization.Attributes;\nusing System.Collections.Generic;\n\n${classCode}\n`;
    fs.writeFileSync(
        path.join(outputDir, `${modelName}.cs`),
        fileContent,
        'utf8'
    );
    // Recursively update nested models
    for (const [nestedName, nestedClass] of Object.entries(nestedClasses)) {
        // The nestedClass is already generated, but we want to ensure the schema is up-to-date
        // So we call updateSchemaAndModel recursively
        // (This will also regenerate the .cs file for the nested model)
        // We need the schema object for the nested model
        const nestedSchemaObj = schemaObj[nestedName] || {};
        updateSchemaAndModel(nestedName, nestedSchemaObj);
    }
}

function buildFullModelFilesUniversal(rootObj) {
    // For each top-level property, update its schema/model
    if (
        typeof rootObj === 'object' &&
        rootObj !== null &&
        !Array.isArray(rootObj)
    ) {
        for (const key of Object.keys(rootObj)) {
            const modelName = toPascalCase(key);
            let obj = rootObj[key];
            if (Array.isArray(obj)) {
                // Use representative object for array
                obj = getComprehensiveRepresentativeObject(obj);
            }
            updateSchemaAndModel(modelName, obj);
        }
    }
}

function NewmanSaveResponsesReporter(emitter, reporterOptions, collectionRunOptions) {
    // Try to get outputDir from various possible places
    outputDir =
        reporterOptions.outputDir ||
        reporterOptions['reporter.Mongo_DAL.js'] ||
        (Array.isArray(reporterOptions) && reporterOptions.length > 0 ? reporterOptions[0] : undefined) ||
        process.cwd();

    // Ensure outputDir exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    emitter.on('request', function (err, args) {
        if (err) return;
        const response = args.response;
        let body;
        try {
            body = response.stream ? response.stream.toString() : '';
            if (response.headers.get('content-type')?.includes('application/json')) {
                body = JSON.parse(body);
            }
        } catch (e) {
            body = response.stream?.toString() || '';
        }
        if (typeof body === 'object' && body !== null) {
            buildFullModelFilesUniversal(body);
        }
    });
}

module.exports = NewmanSaveResponsesReporter;


