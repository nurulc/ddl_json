#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function parseDDL(ddlContent) {
    const ddlLines = ddlContent.split("\n");
    const schemaRegex = /CREATE SCHEMA (\w+)/i;
    const sequenceRegex = /CREATE SEQUENCE (\w+\.\w+)/i;
    const tableRegex = /CREATE TABLE (\w+\.\w+)/i;
    const columnRegex = /^\s+(\w+)\s+([\w\(\),\.\'\:]+)( NOT NULL)?/i;
    const primaryKeyRegex = /CONSTRAINT \w+ PRIMARY KEY \(([\w, ]+)\)/i;
    const indexRegex = /CREATE (UNIQUE )?INDEX (\w+) ON (\w+\.\w+)/i;
    const commentRegex = /COMMENT ON COLUMN (\w+\.\w+\.\w+) IS '(.+)'/i;

    const states = {
        NONE: "NONE",
        TABLE: "TABLE",
    };

    let state = states.NONE;
    let schemaName = "";
    let currentTable = null;
    const jsonResult = [];
    const tableLookup = {}; // Lookup for tables and columns

    ddlLines.forEach((line) => {
        // Strip comments and trim whitespace
        line = line.split("--")[0].trim();
        if (!line) return; // Ignore blank lines

        switch (state) {
            case states.NONE:
                if (line.match(schemaRegex)) {
                    schemaName = line.match(schemaRegex)[1];
                } else if (line.match(sequenceRegex)) {
                    const sequenceName = line.match(sequenceRegex)[1];
                    jsonResult.push({
                        schema: schemaName,
                        type: "sequence",
                        name: sequenceName.split(".")[1],
                    });
                } else if (line.match(tableRegex)) {
                    const tableName = line.match(tableRegex)[1];
                    currentTable = {
                        schema: schemaName,
                        type: "table",
                        name: tableName.split(".")[1],
                        columns: [],
                        indexes: [],
                        constraints: [],
                        comments: {},
                    };
                    tableLookup[currentTable.name] = currentTable; // Add to lookup
                    state = states.TABLE;
                } else if (line.match(commentRegex)) { // comment outside a table definition
                    const [, fullColumnName, comment] = line.match(commentRegex);
                    const [tableSchema, tableName, columnName] = fullColumnName.split(".");
                    const table = tableLookup[tableName];
                    if (table) {
                        table.comments[columnName] = comment;
                    } else {
                        console.warn(`Warning: Comment references unknown table '${tableName}'`);
                    }
                }
                break;

            case states.TABLE:
                if (line.match(columnRegex)) {
                    const [_, name, type, notNull] = line.match(columnRegex);
                    currentTable.columns.push({
                        name,
                        type: type.replace(/,$/, ""), // Remove trailing comma
                        constraints: notNull ? ["NOT NULL"] : [],
                    });
                } else if (line.match(primaryKeyRegex)) {
                    const columns = line.match(primaryKeyRegex)[1].split(",").map((col) => col.trim());
                    currentTable.constraints.push({
                        type: "primary_key",
                        columns,
                    });
                } else if (line.match(indexRegex)) {
                    const [, unique, indexName] = line.match(indexRegex);
                    currentTable.indexes.push({
                        name: indexName,
                        type: unique ? "unique" : "btree",
                        columns: [], // Columns would need additional parsing if explicitly defined
                    });
                } else if (line.match(commentRegex)) {
                    const [, fullColumnName, comment] = line.match(commentRegex);
                    const [tableSchema, tableName, columnName] = fullColumnName.split(".");
                    const table = tableLookup[tableName];
                    if (table) {
                        table.comments[columnName] = comment;
                    } else {
                        console.warn(`Warning: Comment references unknown table '${tableName}'`);
                    }
                } else if (line.startsWith(");")) {
                    // End of table definition
                    jsonResult.push(currentTable);
                    currentTable = null;
                    state = states.NONE;
                }
                break;

            default:
                throw new Error(`Unknown state: ${state}`);
        }
    });

    return jsonResult;
}

function readDDLFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File '${filePath}' does not exist.`);
        process.exit(1);
    }

    const ddlContent = fs.readFileSync(filePath, "utf-8");
    return parseDDL(ddlContent);
}

function main() {
    const ddlFilePath = process.argv[2];

    if (!ddlFilePath) {
        console.error("Usage: node ddl_parser.js <ddl-file-path>");
        process.exit(1);
    }

    try {
        const parsedDDL = readDDLFile(ddlFilePath);
        console.log(JSON.stringify(parsedDDL, null, 2)); // Output JSON to stdout
    } catch (err) {
        console.error("Error parsing DDL:", err.message);
        process.exit(1);
    }
}

main();
