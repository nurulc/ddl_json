#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const objCompress = require('./compressObj');
const debug = false;

if(typeof objCompress !== 'function') throw new Error("objCompress is not a function");

function X(v) { return debug?v:''; }
function S(v) { return (v===undefined || v===null)?v:''; } // undefined and null converted to empty string

const SCHEMA = 0, TABLE=1, COLUMN = 2;

/**
 * Parses a database object name into schema, table, and column components.
 * The function supports different expected formats:
 * - "S.T": Schema and Table
 * - "T.C": Table and Column
 * 
 * @param {string} name - The fully qualified name to parse (e.g., "schema.table", "table.column").
 * @param {string} [expected="S.T"] - The expected format of the name.
 *   - "S.T": Expects the input to represent Schema and Table.
 *   - "T.C": Expects the input to represent Table and Column.
 * @returns {string[]} An array of three strings representing the schema, table, and column.
 *   - If the schema is not provided, the first element will be an empty string.
 *   - If the table or column is not provided, their positions in the array will also be empty strings.
 * 
 * @example
 * // Parse Schema and Table
 * schemaTableColumn("public.users", "S.T"); // Returns ["public", "users", ""]
 * schemaTableColumn("users", "S.T");       // Returns ["", "users", ""]
 * 
 * // Parse Table and Column
 * schemaTableColumn("users.id", "T.C");    // Returns ["", "users", "id"]
 * schemaTableColumn("id", "T.C");          // Returns ["", "", "id"]
 * 
 * // Handle fully qualified names
 * schemaTableColumn("public.users.id", "T.C"); // Returns ["public", "users", "id"]
 */
function schemaTableColumn(name, expected = "S.T") {
	const sn = name.split('.');
	const len = sn.length;

	if (len === 0) return ['', '', ''];
	// If expecting "Schema.Table" and the input has one component, treat it as table
	if (expected === 'S.T' && len === 1) return ['', ...sn];
	// If expecting "Schema.Table" and the input has two components, return them
	if (expected === 'S.T' && len === 2) return sn;
	// If expecting "Table.Column" and the input has one component, treat it as column
	if (expected === 'T.C' && len === 1) return ['', '', ...sn];
	// If expecting "Table.Column" and the input has two components, treat the first as table and the second as column
	if (expected === 'T.C' && len === 2) return ['', ...sn];
	// For inputs with three components, return as-is (e.g., "schema.table.column")
	return sn;
}


// Check Node.js version
const requiredVersion = 14;
const currentVersion = process.versions.node.split('.').map(Number)[0];

if (currentVersion < requiredVersion) {
    console.error(
        `Error: This script requires Node.js version ${requiredVersion} or higher. Current version: ${process.versions.node}`
    );
    process.exit(1);
}

function parseDDL(ddlContent) {
    const ddlLines = ddlContent.split("\n");
    const schemaRegex = /^\s*CREATE\s+SCHEMA\s+(\w+)/i;
    const sequenceRegex = /^\s*CREATE\s+SEQUENCE\s+(\w+\.\w+)/i;
    const tableRegex = /^\s*CREATE\s+TABLE\s+(\w+\.\w+)/i;
    const columnRegex = /^\s*(\w+)\s+([\w\(\),\.\'\:]+)(.*?)(\s+NOT NULL|\s+NULL)?,/i;
    const primaryKeyRegex = /^\s*CONSTRAINT\s+(\w+)\s+PRIMARY\s+KEY\s+\(([\w, ]+)\)/i;
    const foreignKeyRegex = /^\s*CONSTRAINT\s+(\w+)\s+FOREIGN\s+KEY\s*\(([\w, ]+)\)(.*)/i;
    const indexRegex = /^\s*CREATE\s+(UNIQUE )?INDEX\s+(\w+)\s+ON\s+(\w+\.\w+)/i;
    const commentRegex = /^\s*COMMENT\s+ON\s+COLUMN\s+(\w+\.\w+\.\w+)\s+IS\s+'(.+)'/i;

    const states = {
        NONE: "NONE",
        TABLE: "TABLE",
    };

    let state = states.NONE;
    let schemaName = "";
    let currentTable = null;
    const jsonResult = [];
    const tableLookup = {}; // Lookup for tables and columns

    ddlLines.forEach((rawLine) => {
    	const [mainPart, altComment] = rawLine.split("--").map((part) => part?.trim());

        // Ignore lines with no main content
        if (!mainPart || mainPart.trim() === "") return;
        // Strip comments and trim whitespace
        line = mainPart
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
                        name: schemaTableColumn(sequenceName,'S.T')[TABLE],
                        altComment
                    });
                } else if (line.match(tableRegex)) {
                    const fullTableName = line.match(tableRegex)[1];
                    const name = schemaTableColumn(fullTableName,'S.T')[TABLE];
                    currentTable = {
                        schema: schemaName,
                        type: "table",
                        name,
                        columns: [],
                        indexes: [],
                        constraints: [],
                        comments: {},
                        altComment
                    };
                    tableLookup[currentTable.name] = currentTable; // Add to lookup
                    state = states.TABLE;
                } else if (line.match(commentRegex)) { // comment outside a table definition
                    const [, fullColumnName, comment] = line.match(commentRegex);
                    const [tableSchema, tableName, columnName] = schemaTableColumn(fullColumnName,'S.T.C');
                    const table = tableLookup[tableName];
                    if (table) {
                        table.comments[columnName] = comment.trim();
                    } else {
                        console.warn(`Warning: Comment references unknown table '${tableName}'`);
                    }
                }
                break;

            case states.TABLE:
            	// console.warn('IN TABLE', currentTable.name, line, 
            	// 	     'primaryKey:', !!line.match(primaryKeyRegex),X(primaryKeyRegex),
            	// 	      'indexKey:', !!line.match(indexRegex),X(indexRegex),
            	// 	      'columnRegex:', !!line.match(columnRegex),X(columnRegex),
            	// 	      );
                if (line.match(primaryKeyRegex)) {
                	const pk = line.match(primaryKeyRegex);
                    const columns = pk[2].split(",").map((col) => col.trim());
                    currentTable.constraints.push({
                        type: "primary_key",
                        index_name: pk[1],
                        columns,
                    });
                } else if (line.match(foreignKeyRegex)) {
                	const fk = line.match(foreignKeyRegex);
                    const columns = fk[2].split(",").map((col) => col.trim());
                    const rule = fk[3];
                    currentTable.constraints.push({
                        type: "foreign_key",
                        index_name: fk[1],
                        columns,
                        rule
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
                    const [tableSchema, tableName, columnName] = schemaTableColumn(fullColumnName,'S.T.C');
                    const table = tableLookup[tableName];
                    if (table) {
                        table.comments[columnName] = comment;
                    } else {
                        console.warn(`Warning: Comment references unknown table '${tableName}'`);
                    }
                } else if (line.trim().startsWith(");")) {
                    // End of table definition
                    jsonResult.push(currentTable);
                    currentTable = null;
                    state = states.NONE;
                } else if (line.match(columnRegex)) {
                    const [_, name, type,_dflt,notNull] = line.match(columnRegex);
                    const isNotNull = !!(notNull || _dflt || '').trim().match(/NOT\s+NULL/);
                    const defaultVal = (!isNotNull? (_dflt||'').replace('DEFAULT','').trim():undefined)
                    currentTable.columns.push({
                        name,
                        type: type.replace(/,$/, ""), // Remove trailing comma
                        constraints: isNotNull ? ["NOT NULL"] : [],
                        defaultVal,
                        altComment
                    });
                } 
                break;

            default:
                throw new Error(`Unknown state: ${state}`);
        }
    });

    return objCompress(jsonResult);
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
