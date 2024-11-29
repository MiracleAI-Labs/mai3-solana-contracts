import { ProcessPromise } from './core.js';
export * from './core.js';
export * from './goods.js';
export { minimist, chalk, fs, which, YAML, ps, glob, glob as globby, } from './vendor.js';
export { type Duration, quote, quotePowerShell, tempdir, tempdir as tmpdir, tempfile, tempfile as tmpfile, } from './util.js';
/**
 *  @deprecated Use $`cmd`.nothrow() instead.
 */
export declare function nothrow(promise: ProcessPromise): ProcessPromise;
/**
 * @deprecated Use $`cmd`.quiet() instead.
 */
export declare function quiet(promise: ProcessPromise): ProcessPromise;
