import {getStr} from '../dist/wasm.js';
// import * as fse from '../node_modules/fs-ext/fs-ext.js';
import fs from 'node:fs';
import os from 'node:os';
import _path from 'node:path';
import process from 'node:process';
import zeptoid from 'zeptoid';

//TODO: Use another kind of lock, and check manually if the file is locked

// Closure to return an environment that links
// the current wasm context
export default function env(inst) {
  // Exported environment
  const env = {
    // Print a string pointer to console
    js_print: (str_ptr) => {
      const text = getStr(inst.exports, str_ptr);
      console.log(text[text.length - 1] === "\n" ? text.slice(0, -1) : text);
    },
    // Open the file at path, mode = 0 is open RW, mode = 1 is open TEMP
    js_open: (path_ptr, mode, flags) => {
      let path;
      switch (mode) {
        case 0:
          path = getStr(inst.exports, path_ptr);
          break;
        case 1:
          const tempPath = _path.join(os.tmpdir(), zeptoid ());
          fs.writeFileSync(tempPath, '');
          path = tempPath;
          break;
      }

      const write = !!(flags & 0x00000002);
      const create = !!(flags & 0x00000004);
      const openFlags = write ? 'r+' : 'r';
      if ( create && !fs.existsSync(path) ) {
        fs.writeFileSync(path, '');
      }
      return fs.openSync(path, openFlags);
    },
    // Close a file
    js_close: (rid) => {
      fs.closeSync(rid);
    },
    // Delete file at path
    js_delete: (path_ptr) => {
      const path = getStr(inst.exports, path_ptr);
      fs.unlinkSync(path);
    },
    // Read from a file to a buffer in the module
    js_read: (rid, buffer_ptr, offset, amount) => {
      const buffer = new Uint8Array(
        inst.exports.memory.buffer,
        buffer_ptr,
        amount,
      );
      return fs.readSync(rid, buffer, 0, amount, offset);
    },
    // Write to a file from a buffer in the module
    js_write: (rid, buffer_ptr, offset, amount) => {
      const buffer = new Uint8Array(
        inst.exports.memory.buffer,
        buffer_ptr,
        amount,
      );
      return fs.writeSync(rid, buffer, 0, amount, offset);
    },
    // Truncate the given file
    js_truncate: (rid, size) => {
      fs.ftruncateSync(rid, size);
    },
    // Sync file data to disk
    js_sync: (rid) => {
      fs.fdatasyncSync(rid);
    },
    // Retrieve the size of the given file
    js_size: (rid) => {
      return fs.fstatSync(rid).size;
    },
    // Acquire a SHARED or EXCLUSIVE file lock
    js_lock: (rid, exclusive) => { //TODO
      // this is unstable and has issues on Windows ...
      // if (Deno.flockSync && !isWindows) Deno.flockSync(rid, exclusive !== 0);
    },
    // Release a file lock
    js_unlock: (rid) => { //TODO
      // this is unstable and has issues on Windows ...
      // if (Deno.funlockSync && !isWindows) Deno.funlockSync(rid);
    },
    // Return current time in ms since UNIX epoch
    js_time: () => {
      return Date.now();
    },
    // Return the timezone offset in minutes for
    // the current locale
    js_timezone: () => {
      return (new Date()).getTimezoneOffset();
    },
    // Determine if a path exists
    js_exists: (path_ptr) => {
      const path = getStr(inst.exports, path_ptr);
      const exists = fs.existsSync(path);
      return exists ? 1 : 0;
    },
    // Determine if a path is accessible i.e. if it has read/write permissions
    // TODO(dyedgreen): Properly determine if there are read permissions
    js_access: (path_ptr) => {
      const path = getStr(inst.exports, path_ptr);
      try {
        fs.accessSync(path, fs.constants.R_OK | fs.constants.W_OK);
        return 1;
      } catch {
        return 0;
      }
    },
    // Call a user defined SQL function
    js_call_user_func: (func_idx, arg_count) => {
      inst.functions[func_idx](arg_count);
    },
  };

  return { env };
}
