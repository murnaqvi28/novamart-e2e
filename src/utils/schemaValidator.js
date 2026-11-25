const Ajv = require('ajv');
const addFormats = require('ajv-formats');

/**
 * Validates API responses against the app's own OpenAPI spec (/api-docs/openapi.json).
 * OpenAPI 3.0 uses `nullable: true`; it is converted to JSON-Schema `type: [x, "null"]` for Ajv.
 */
function convertNullable(node) {
  if (Array.isArray(node)) return node.map(convertNullable);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k !== 'nullable' && k !== 'example') out[k] = convertNullable(v);
  }
  if (node.nullable === true) {
    if (out.type) out.type = [].concat(out.type, 'null');
    else if (out.$ref || out.allOf || out.properties) return { anyOf: [out, { type: 'null' }] };
  }
  return out;
}

let cached;

async function getValidator(request) {
  if (cached) return cached;
  const res = await request.get('/api-docs/openapi.json');
  if (!res.ok()) throw new Error(`Could not load OpenAPI spec: HTTP ${res.status()}`);
  const spec = await res.json();
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  ajv.addSchema({ $id: 'openapi', components: convertNullable(spec.components) });
  const compiled = new Map();
  cached = {
    spec,
    /** Returns a list of human-readable errors (empty when valid). */
    validate(schemaName, data) {
      if (!compiled.has(schemaName)) {
        compiled.set(schemaName, ajv.compile({ $ref: `openapi#/components/schemas/${schemaName}` }));
      }
      const fn = compiled.get(schemaName);
      return fn(data) ? [] : fn.errors.map((e) => `${e.instancePath || '(root)'} ${e.message}`);
    },
  };
  return cached;
}

module.exports = { getValidator, convertNullable };
