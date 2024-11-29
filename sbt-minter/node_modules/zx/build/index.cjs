"use strict";
const {
  __export,
  __reExport,
  __toCommonJS
} = require('./esblib.cjs');


// src/index.ts
var src_exports = {};
__export(src_exports, {
  YAML: () => import_vendor.YAML,
  chalk: () => import_vendor.chalk,
  fs: () => import_vendor.fs,
  glob: () => import_vendor.glob,
  globby: () => import_vendor.glob,
  minimist: () => import_vendor.minimist,
  nothrow: () => nothrow,
  ps: () => import_vendor.ps,
  quiet: () => quiet,
  quote: () => import_util.quote,
  quotePowerShell: () => import_util.quotePowerShell,
  tempdir: () => import_util.tempdir,
  tempfile: () => import_util.tempfile,
  tmpdir: () => import_util.tempdir,
  tmpfile: () => import_util.tempfile,
  which: () => import_vendor.which
});
module.exports = __toCommonJS(src_exports);
__reExport(src_exports, require("./core.cjs"), module.exports);
__reExport(src_exports, require("./goods.cjs"), module.exports);
var import_vendor = require("./vendor.cjs");
var import_util = require("./util.cjs");
function nothrow(promise) {
  return promise.nothrow();
}
function quiet(promise) {
  return promise.quiet();
}
/* c8 ignore next 100 */
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  YAML,
  chalk,
  fs,
  glob,
  globby,
  minimist,
  nothrow,
  ps,
  quiet,
  quote,
  quotePowerShell,
  tempdir,
  tempfile,
  tmpdir,
  tmpfile,
  which,
  ...require("./core.cjs"),
  ...require("./goods.cjs")
});