# ddl-json

A very simple tool to convert a Prostgres DDL file to JSON format. It is not very robust yet.

## Running the Script:
If the Node.js version is sufficient (≥ 14), the script runs as expected.
If the version is insufficient: you will get an error message.

```bash
		Error: This script requires Node.js version 14 or higher. Current version: 12.22.1
```


# DDL Parser

`DDL Parser` is a Node.js command-line utility that reads a SQL DDL (Data Definition Language) file and converts its schema structure into a JSON representation. The JSON output includes metadata for schemas, sequences, tables, columns, constraints, indexes, and column comments, making it easier to work with database schemas programmatically.

## Features

- **Schema Parsing**: Extracts schema definitions (e.g., `CREATE SCHEMA`).
- **Sequence Parsing**: Handles SQL sequence definitions (e.g., `CREATE SEQUENCE`).
- **Table Parsing**: Processes table definitions, including columns, constraints, and indexes.
- **Comment Parsing**: Associates column comments (`COMMENT ON COLUMN`) with the correct table and column.
- **JSON Output**: Outputs a clean, hierarchical JSON representation of the DDL file.

## Usage

### Installation
You can install the script globally as an npm package:

```bash
npm install -g ddl-parser
```

Alternatively, you can clone the repository and run it directly using Node.js.

### Running the Parser

#### Globally Installed
Run the parser with the path to your DDL file:
```bash
ddl-parser path/to/ddl.sql
```

#### Local Script
Clone the repository, then run:
```bash
node ddl_parser.js path/to/ddl.sql
```

### Output
The JSON representation of the DDL will be printed to the terminal (stdout). You can redirect the output to a file if needed:
```bash
ddl-parser path/to/ddl.sql > output.json
```

## JSON Output Structure

The resulting JSON structure contains the following fields:
- **schema**: The name of the database schema.
- **type**: The type of the object (e.g., `sequence`, `table`).
- **name**: The name of the object.
- **columns**: A list of column definitions, including types and constraints.
- **constraints**: Primary key definitions and other table-level constraints.
- **indexes**: Index definitions for the table.
- **comments**: Column-level comments associated with the table.

### Example Output

For the following DDL:
```sql
CREATE TABLE new_ops.person (
    person_id int8 NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL
);

COMMENT ON COLUMN new_ops.person.first_name IS 'Person''s first name';
COMMENT ON COLUMN new_ops.person.last_name IS 'Person''s last name';
```

The output will be:
```json
[
  {
    "schema": "new_ops",
    "type": "table",
    "name": "person",
    "columns": [
      { "name": "person_id", "type": "int8", "constraints": ["NOT NULL"] },
      { "name": "first_name", "type": "text", "constraints": ["NOT NULL"] },
      { "name": "last_name", "type": "text", "constraints": ["NOT NULL"] }
    ],
    "indexes": [],
    "constraints": [],
    "comments": {
      "first_name": "Person's first name",
      "last_name": "Person's last name"
    }
  }
]
```

## Expressions Handled

The parser supports the following DDL constructs:
1. **CREATE SCHEMA**:
   - Extracts schema names.
2. **CREATE SEQUENCE**:
   - Extracts sequence definitions and metadata.
3. **CREATE TABLE**:
   - Parses table definitions, including column names, types, and constraints (e.g., `NOT NULL`).
4. **CONSTRAINTS**:
   - Extracts primary key definitions.
5. **INDEXES**:
   - Captures index definitions.
6. **COMMENT ON COLUMN**:
   - Associates comments with the correct table and column.

### Example SQL Expressions
- `CREATE SCHEMA my_schema;`
- `CREATE SEQUENCE my_schema.my_sequence;`
- `CREATE TABLE my_schema.my_table (...);`
- `COMMENT ON COLUMN my_schema.my_table.column_name IS 'Column description';`

## Assumptions and Formatting

The parser assumes specific formatting for the DDL file. If the file deviates from these assumptions, the parser may not work correctly. The key assumptions are:

1. **Table Definitions**:
   - `CREATE TABLE` must be on a single line, followed by the table name.
   - Column definitions must each be on their own line, with the column name followed by its type and optional constraints (e.g., `NOT NULL`).
   - The table definition must end with `);` on a single line.

   **Example:**
   ```sql
   CREATE TABLE schema_name.table_name (
       column1 type NOT NULL,
       column2 type
   );
   ```

2. **Sequence Definitions**:
   - `CREATE SEQUENCE` must be on a single line, followed by the sequence name.
   - Any sequence options (e.g., `INCREMENT BY`, `START`, `CACHE`) must be on separate lines if included.

   **Example:**
   ```sql
   CREATE SEQUENCE schema_name.sequence_name
       INCREMENT BY 1
       START 1
       CACHE 1;
   ```

3. **Constraints**:
   - Primary key constraints must be included as a single line within the table definition using the `CONSTRAINT` keyword.

   **Example:**
   ```sql
   CONSTRAINT table_name_pkey PRIMARY KEY (column1, column2)
   ```

4. **Column Comments**:
   - Comments must use `COMMENT ON COLUMN` syntax, and the column must be specified in the format `schema_name.table_name.column_name`.

   **Example:**
   ```sql
   COMMENT ON COLUMN schema_name.table_name.column_name IS 'Description of the column';
   ```

## Limitations

1. **Line-by-Line Parsing**:
   - The parser processes the DDL file line by line and does not handle multiline constructs like:
     ```sql
     CREATE TABLE schema_name.table_name (column1 type, column2 type, ...);
     ```
   - Each column definition and constraints must be on their own lines.

2. **Parentheses Handling**:
   - The parser does not explicitly track the opening and closing parentheses of table definitions. It relies on the assumption that:
     - Columns start immediately after `(`.
     - The table definition ends with `);` on its own line.

3. **Sequences**:
   - The parser assumes that `CREATE SEQUENCE` statements are on a single line and any options follow in subsequent lines.
   - Unexpected formatting (e.g., multiline `CREATE SEQUENCE` statements) may cause parsing errors.

4. **Non-Standard SQL**:
   - The script assumes PostgreSQL DDL syntax and may not handle vendor-specific SQL features (e.g., MySQL, Oracle).

5. **Partial Error Handling**:
   - The parser logs warnings for unexpected constructs but may fail for certain edge cases without recovering.

## Development

If you'd like to extend or modify the parser:
1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/ddl-parser.git
   cd ddl-parser
   ```
2. Install dependencies (if any).
3. Make modifications to the script, which uses a state machine approach for parsing.

### Testing Locally
To test your changes:
```bash
node ddl_parser.js path/to/test.sql
```



### Additional Notes for Users and Developers

#### Common Issues and Troubleshooting

1. **Misaligned Formatting:**
   - If the DDL file does not follow the expected formatting (e.g., multiline `CREATE TABLE` or inline comments mixed with code), the parser might fail or produce incorrect JSON output.
   - Ensure the file follows the documented assumptions for formatting.

2. **Unexpected Syntax:**
   - Non-standard SQL or advanced PostgreSQL-specific features (e.g., inheritance, custom types) might not be parsed correctly.
   - If you encounter an issue, consider manually editing the DDL file to simplify complex constructs before parsing.

3. **Handling Warnings:**
   - Warnings are printed to the console when:
     - A comment references an unknown table or column.
     - The script encounters unrecognized or malformed lines.

4. **Performance:**
   - The parser processes the DDL line by line, which is efficient for moderately sized files. However, extremely large DDL files might slow down parsing.

---

### Future Enhancements

While the current version handles most common PostgreSQL DDL constructs, future improvements could include:
1. **Support for Multiline Constructs:**
   - Add support for parsing multiline `CREATE TABLE` and other definitions by tracking opening and closing parentheses.

2. **Improved Error Handling:**
   - Provide more detailed error messages for unrecognized syntax or misaligned formatting.

3. **Extended Features:**
   - Parse additional PostgreSQL constructs, such as:
     - Views (`CREATE VIEW`).
     - Index definitions with specific column mappings.
     - Triggers (`CREATE TRIGGER`).
     - Foreign key constraints.

4. **Cross-Database Compatibility:**
   - Extend support for other SQL dialects, such as MySQL, Oracle, or SQL Server.

5. **Enhanced JSON Output:**
   - Include richer metadata, such as column defaults, check constraints, and extended attributes like storage options.

6. **Configurable Options:**
   - Allow users to customize parsing behavior (e.g., enabling or disabling certain features) via command-line arguments.

---
## License
This project is licensed under the MIT License.

## Author
Nurul Choudhury


