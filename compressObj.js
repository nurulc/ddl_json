


/**
 * Recursively compresses objects and arrays by removing falsey values.
 * Falsey values are defined as: "", null, undefined, [], and {}.
 * 
 * - For arrays: Removes falsey elements. Returns `undefined` if the array becomes empty.
 * - For objects: Removes key-value pairs where the value is falsey.
 *   If all keys are removed, the object becomes `undefined`.
 * - The function is pure: it does not modify the input directly.
 * 
 * @param {any} input - The input value to compress. Can be an object, array, or primitive.
 * @returns {any} - Returns the compressed version of the input:
 *   - If no changes are made, the input is returned as is.
 *   - If all elements/keys are removed, returns `undefined`.
 *   - Otherwise, returns the compressed object or array.
 * 
 * @example
 * const data = {
 *     a: "",
 *     b: null,
 *     c: [0, "", null, { d: undefined, e: "value", f: {} }, []],
 *     g: { h: {}, i: { j: null, k: [0, 2, {}, false] } },
 *     l: [false, {}, 0],
 *     m: [],
 *     n: undefined
 * };
 * 
 * const result = compressObj(data);
 * console.log(result);
 * // Output:
 * // {
 * //   c: [0, { e: "value" }],
 * //   g: { i: { k: [0, 2, false] } },
 * //   l: [false, 0]
 * // }
 */
function compressObj(input) {
    // If input is an array
    if (Array.isArray(input)) {
    	if(input.length === 0) return undefined;
        let modified = false; // Flag to track if changes are made
        const compressed = input.reduce((result, element) => {
            if (typeof element === 'object' && element !== null) {
                const reduced = compressObj(element); // Recursively apply compressObj
                if (reduced !== undefined) {
                    result.push(reduced); // Only add if reduced is not undefined
                    if(reduced !== element) modified = true;
                } else {
                    modified = true; // Mark as modified if an element is removed
                }
            } else if (
                element !== "" && 
                element !== null && 
                element !== undefined
            ) {
                result.push(element); // Include primitives except explicitly falsey ones
            } else {
                modified = true; // Mark as modified if a falsey element is removed
            }
            return result;
        }, []);
        // Return the original array if unchanged, otherwise the compressed one
        return compressed.length === input.length && !modified
            ? input
            : (compressed.length > 0 ? compressed : undefined);
    }

    // If input is an object
    else if (typeof input === 'object' && input !== null) {
        let modified = false; // Flag to track if changes are made
        const compressed = {};
        const _keys = Object.keys(input);
        if(_keys.length === 0) return undefined;
        for (const key of _keys) {
            const value = input[key];
            if (typeof value === 'object' && value !== null) {
                const reduced = compressObj(value); // Recursively apply compressObj
                if (reduced !== undefined) {
                    compressed[key] = reduced; // Add reduced value
                    if(reduced !== value) modified = true;
                } else {
                    modified = true; // Mark as modified if a key is removed
                }
            } else if (
                value !== "" && 
                value !== null && 
                value !== undefined
            ) {
                compressed[key] = value; // Include primitives except explicitly falsey ones
            } else {
                modified = true; // Mark as modified if a falsey value is removed
            }
        }
        // Return the original object if unchanged, otherwise the compressed one
        return Object.keys(compressed).length === Object.keys(input).length && !modified
            ? input
            : (Object.keys(compressed).length > 0 ? compressed : undefined);
    }

    // For primitives, return the input as-is
    return input;
}


module.exports = compressObj;

/*
// Example usage
const data = {
    a: "",
    b: null,
    c: [0, false, "", null, { d: undefined, e: "value", f: {} }, []],
    g: { h: {}, i: { j: null, k: [0, 2, {}, false] } },
    l: [false, {}, 0],
    m: [],
    n: undefined,
};

const compressedData = compressObj(data);
console.log(JSON.stringify(compressedData, null, 2));
*/