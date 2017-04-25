// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function shell_read() { throw 'no read() available' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status, toThrow) {
      quit(status);
    }
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function shell_read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return xhr.response;
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function shell_print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function shell_printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}
if (!Module['quit']) {
  Module['quit'] = function(status, toThrow) {
    throw toThrow;
  }
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
    return value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      assert(args.length == sig.length-1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
    } else {
      assert(sig.length == 1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      // optimize away arguments usage in common cases
      if (sig.length === 1) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func);
        };
      } else if (sig.length === 2) {
        sigCache[func] = function dynCall_wrapper(arg) {
          return Runtime.dynCall(sig, func, [arg]);
        };
      } else {
        // general case
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
        };
      }
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16);(assert((((STACKTOP|0) < (STACK_MAX|0))|0))|0); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + (assert(!staticSealed),size))|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { assert(DYNAMICTOP_PTR);var ret = HEAP32[DYNAMICTOP_PTR>>2];var end = (((ret + size + 15)|0) & -16);HEAP32[DYNAMICTOP_PTR>>2] = end;if (end >= TOTAL_MEMORY) {var success = enlargeMemory();if (!success) {HEAP32[DYNAMICTOP_PTR>>2] = ret;return 0;}}return ret;},
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = Runtime.stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface.
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    assert(returnType !== 'array', 'Return type should not be "array".');
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if ((!opts || !opts.async) && typeof EmterpreterAsync === 'object') {
      assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling ccall');
    }
    if (opts && opts.async) assert(!returnType, 'async ccalls cannot return values');
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }

  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    funcstr += "if (typeof EmterpreterAsync === 'object') { assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling cwrap') }";
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if (!runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var __cxa_demangle_func = Module['___cxa_demangle'] || Module['__cxa_demangle'];
  if (__cxa_demangle_func) {
    try {
      var s =
        func.substr(1);
      var len = lengthBytesUTF8(s)+1;
      var buf = _malloc(len);
      stringToUTF8(s, buf, len);
      var status = _malloc(4);
      var ret = __cxa_demangle_func(buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed
    } catch(e) {
      // ignore problems here
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
    // failure when using libcxxabi, don't demangle
    return func;
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - Module['asm'].stackSave() + allocSize) + ' bytes available!');
}

function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  Runtime.warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

if (!Math['trunc']) Math['trunc'] = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};
Math.trunc = Math['trunc'];

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = Runtime.GLOBAL_BASE;

STATICTOP = STATIC_BASE + 652496;
/* global initializers */  __ATINIT__.push();


/* memory initializer */ allocate([0,0,0,0,0,0,240,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,172,238,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,1,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,3,0,0,0,200,240,9,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,0,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,10,0,37,115,32,0,85,110,114,111,108,108,101,100,0,68,111,117,98,108,101,0,80,114,101,99,105,115,105,111,110,32,76,105,110,112,97,99,107,32,66,101,110,99,104,109,97,114,107,32,45,32,80,67,32,86,101,114,115,105,111,110,32,105,110,32,39,67,47,67,43,43,39,10,10,0,79,112,116,105,109,105,115,97,116,105,111,110,32,37,115,10,10,0,79,112,116,32,51,32,54,52,32,66,105,116,0,110,111,114,109,32,114,101,115,105,100,32,32,32,32,32,32,114,101,115,105,100,32,32,32,32,32,32,32,32,32,32,32,109,97,99,104,101,112,0,32,32,32,32,32,32,32,32,32,120,91,48,93,45,49,32,32,32,32,32,32,32,32,32,32,120,91,110,45,49,93,45,49,10,0,37,54,46,49,102,32,37,49,55,46,56,101,37,49,55,46,56,101,37,49,55,46,56,101,37,49,55,46,56,101,10,10,0,84,105,109,101,115,32,97,114,101,32,114,101,112,111,114,116,101,100,32,102,111,114,32,109,97,116,114,105,99,101,115,32,111,102,32,111,114,100,101,114,32,32,32,32,32,32,32,32,37,53,100,10,0,49,32,112,97,115,115,32,116,105,109,101,115,32,102,111,114,32,97,114,114,97,121,32,119,105,116,104,32,108,101,97,100,105,110,103,32,100,105,109,101,110,115,105,111,110,32,111,102,37,53,100,10,10,0,32,32,32,32,32,32,100,103,101,102,97,32,32,32,32,32,32,100,103,101,115,108,32,32,32,32,32,32,116,111,116,97,108,32,32,32,32,32,77,102,108,111,112,115,32,32,32,32,32,32,32,117,110,105,116,0,32,32,32,32,32,32,114,97,116,105,111,10,0,10,67,97,108,99,117,108,97,116,105,110,103,32,109,97,116,103,101,110,32,111,118,101,114,104,101,97,100,10,0,37,49,48,100,32,116,105,109,101,115,32,37,54,46,50,102,32,115,101,99,111,110,100,115,10,0,79,118,101,114,104,101,97,100,32,102,111,114,32,49,32,109,97,116,103,101,110,32,37,49,50,46,53,102,32,115,101,99,111,110,100,115,10,10,0,67,97,108,99,117,108,97,116,105,110,103,32,109,97,116,103,101,110,47,100,103,101,102,97,32,112,97,115,115,101,115,32,102,111,114,32,37,100,32,115,101,99,111,110,100,115,10,0,80,97,115,115,101,115,32,117,115,101,100,32,37,49,48,100,32,10,10,0,84,105,109,101,115,32,102,111,114,32,97,114,114,97,121,32,119,105,116,104,32,108,101,97,100,105,110,103,32,100,105,109,101,110,115,105,111,110,32,111,102,37,52,100,10,10,0,65,118,101,114,97,103,101,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,37,49,49,46,50,102,10,0,10,67,97,108,99,117,108,97,116,105,110,103,32,109,97,116,103,101,110,50,32,111,118,101,114,104,101,97,100,10,0,32,80,114,101,99,105,115,105,111,110,32,37,49,49,46,50,102,32,77,102,108,111,112,115,32,10,10,0,37,49,54,46,49,102,0,37,49,54,46,56,101,0,32,32,32,32,32,32,32,32,32,32,32,32,32,49,46,55,0,32,32,55,46,52,49,54,50,56,57,56,48,101,45,49,52,0,32,32,50,46,50,50,48,52,52,54,48,53,101,45,49,54,0,32,45,49,46,52,57,56,56,48,49,48,56,101,45,49,52,0,32,45,49,46,56,57,56,52,56,49,51,55,101,45,49,52,0,110,111,114,109,46,32,114,101,115,105,100,0,114,101,115,105,100,32,32,32,32,32,32,0,109,97,99,104,101,112,32,32,32,32,32,0,120,91,48,93,45,49,32,32,32,32,32,0,120,91,110,45,49,93,45,49,32,32,32,0,49,0,32,56,46,56,56,49,55,56,52,50,48,101,45,48,49,54,0,37,49,49,46,53,102,37,49,49,46,53,102,37,49,49,46,53,102,37,49,49,46,50,102,37,49,49,46,52,102,37,49,49,46,52,102,10,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,0,1,2,3,4,5,6,7,8,9,255,255,255,255,255,255,255,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,255,255,255,255,255,255,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,0,1,2,4,7,3,6,5,0,17,0,10,0,17,17,17,0,0,0,0,5,0,0,0,0,0,0,9,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,15,10,17,17,17,3,10,7,0,1,19,9,11,11,0,0,9,6,11,0,0,11,0,6,17,0,0,0,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,10,10,17,17,17,0,10,0,0,2,0,9,11,0,0,0,9,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,13,0,0,0,0,9,14,0,0,0,0,0,14,0,0,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,15,0,0,0,0,9,16,0,0,0,0,0,16,0,0,16,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,10,0,0,0,0,9,11,0,0,0,0,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,45,43,32,32,32,48,88,48,120,0,40,110,117,108,108,41,0,45,48,88,43,48,88,32,48,88,45,48,120,43,48,120,32,48,120,0,105,110,102,0,73,78,70,0,110,97,110,0,78,65,78,0,48,49,50,51,52,53,54,55,56,57,65,66,67,68,69,70,46,0,84,33,34,25,13,1,2,3,17,75,28,12,16,4,11,29,18,30,39,104,110,111,112,113,98,32,5,6,15,19,20,21,26,8,22,7,40,36,23,24,9,10,14,27,31,37,35,131,130,125,38,42,43,60,61,62,63,67,71,74,77,88,89,90,91,92,93,94,95,96,97,99,100,101,102,103,105,106,107,108,114,115,116,121,122,123,124,0,73,108,108,101,103,97,108,32,98,121,116,101,32,115,101,113,117,101,110,99,101,0,68,111,109,97,105,110,32,101,114,114,111,114,0,82,101,115,117,108,116,32,110,111,116,32,114,101,112,114,101,115,101,110,116,97,98,108,101,0,78,111,116,32,97,32,116,116,121,0,80,101,114,109,105,115,115,105,111,110,32,100,101,110,105,101,100,0,79,112,101,114,97,116,105,111,110,32,110,111,116,32,112,101,114,109,105,116,116,101,100,0,78,111,32,115,117,99,104,32,102,105,108,101,32,111,114,32,100,105,114,101,99,116,111,114,121,0,78,111,32,115,117,99,104,32,112,114,111,99,101,115,115,0,70,105,108,101,32,101,120,105,115,116,115,0,86,97,108,117,101,32,116,111,111,32,108,97,114,103,101,32,102,111,114,32,100,97,116,97,32,116,121,112,101,0,78,111,32,115,112,97,99,101,32,108,101,102,116,32,111,110,32,100,101,118,105,99,101,0,79,117,116,32,111,102,32,109,101,109,111,114,121,0,82,101,115,111,117,114,99,101,32,98,117,115,121,0,73,110,116,101,114,114,117,112,116,101,100,32,115,121,115,116,101,109,32,99,97,108,108,0,82,101,115,111,117,114,99,101,32,116,101,109,112,111,114,97,114,105,108,121,32,117,110,97,118,97,105,108,97,98,108,101,0,73,110,118,97,108,105,100,32,115,101,101,107,0,67,114,111,115,115,45,100,101,118,105,99,101,32,108,105,110,107,0,82,101,97,100,45,111,110,108,121,32,102,105,108,101,32,115,121,115,116,101,109,0,68,105,114,101,99,116,111,114,121,32,110,111,116,32,101,109,112,116,121,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,112,101,101,114,0,79,112,101,114,97,116,105,111,110,32,116,105,109,101,100,32,111,117,116,0,67,111,110,110,101,99,116,105,111,110,32,114,101,102,117,115,101,100,0,72,111,115,116,32,105,115,32,100,111,119,110,0,72,111,115,116,32,105,115,32,117,110,114,101,97,99,104,97,98,108,101,0,65,100,100,114,101,115,115,32,105,110,32,117,115,101,0,66,114,111,107,101,110,32,112,105,112,101,0,73,47,79,32,101,114,114,111,114,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,32,111,114,32,97,100,100,114,101,115,115,0,66,108,111,99,107,32,100,101,118,105,99,101,32,114,101,113,117,105,114,101,100,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,0,78,111,116,32,97,32,100,105,114,101,99,116,111,114,121,0,73,115,32,97,32,100,105,114,101,99,116,111,114,121,0,84,101,120,116,32,102,105,108,101,32,98,117,115,121,0,69,120,101,99,32,102,111,114,109,97,116,32,101,114,114,111,114,0,73,110,118,97,108,105,100,32,97,114,103,117,109,101,110,116,0,65,114,103,117,109,101,110,116,32,108,105,115,116,32,116,111,111,32,108,111,110,103,0,83,121,109,98,111,108,105,99,32,108,105,110,107,32,108,111,111,112,0,70,105,108,101,110,97,109,101,32,116,111,111,32,108,111,110,103,0,84,111,111,32,109,97,110,121,32,111,112,101,110,32,102,105,108,101,115,32,105,110,32,115,121,115,116,101,109,0,78,111,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,115,32,97,118,97,105,108,97,98,108,101,0,66,97,100,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,0,78,111,32,99,104,105,108,100,32,112,114,111,99,101,115,115,0,66,97,100,32,97,100,100,114,101,115,115,0,70,105,108,101,32,116,111,111,32,108,97,114,103,101,0,84,111,111,32,109,97,110,121,32,108,105,110,107,115,0,78,111,32,108,111,99,107,115,32,97,118,97,105,108,97,98,108,101,0,82,101,115,111,117,114,99,101,32,100,101,97,100,108,111,99,107,32,119,111,117,108,100,32,111,99,99,117,114,0,83,116,97,116,101,32,110,111,116,32,114,101,99,111,118,101,114,97,98,108,101,0,80,114,101,118,105,111,117,115,32,111,119,110,101,114,32,100,105,101,100,0,79,112,101,114,97,116,105,111,110,32,99,97,110,99,101,108,101,100,0,70,117,110,99,116,105,111,110,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,0,78,111,32,109,101,115,115,97,103,101,32,111,102,32,100,101,115,105,114,101,100,32,116,121,112,101,0,73,100,101,110,116,105,102,105,101,114,32,114,101,109,111,118,101,100,0,68,101,118,105,99,101,32,110,111,116,32,97,32,115,116,114,101,97,109,0,78,111,32,100,97,116,97,32,97,118,97,105,108,97,98,108,101,0,68,101,118,105,99,101,32,116,105,109,101,111,117,116,0,79,117,116,32,111,102,32,115,116,114,101,97,109,115,32,114,101,115,111,117,114,99,101,115,0,76,105,110,107,32,104,97,115,32,98,101,101,110,32,115,101,118,101,114,101,100,0,80,114,111,116,111,99,111,108,32,101,114,114,111,114,0,66,97,100,32,109,101,115,115,97,103,101,0,70,105,108,101,32,100,101,115,99,114,105,112,116,111,114,32,105,110,32,98,97,100,32,115,116,97,116,101,0,78,111,116,32,97,32,115,111,99,107,101,116,0,68,101,115,116,105,110,97,116,105,111,110,32,97,100,100,114,101,115,115,32,114,101,113,117,105,114,101,100,0,77,101,115,115,97,103,101,32,116,111,111,32,108,97,114,103,101,0,80,114,111,116,111,99,111,108,32,119,114,111,110,103,32,116,121,112,101,32,102,111,114,32,115,111,99,107,101,116,0,80,114,111,116,111,99,111,108,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,80,114,111,116,111,99,111,108,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,83,111,99,107,101,116,32,116,121,112,101,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,78,111,116,32,115,117,112,112,111,114,116,101,100,0,80,114,111,116,111,99,111,108,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,65,100,100,114,101,115,115,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,32,98,121,32,112,114,111,116,111,99,111,108,0,65,100,100,114,101,115,115,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,78,101,116,119,111,114,107,32,105,115,32,100,111,119,110,0,78,101,116,119,111,114,107,32,117,110,114,101,97,99,104,97,98,108,101,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,110,101,116,119,111,114,107,0,67,111,110,110,101,99,116,105,111,110,32,97,98,111,114,116,101,100,0,78,111,32,98,117,102,102,101,114,32,115,112,97,99,101,32,97,118,97,105,108,97,98,108,101,0,83,111,99,107,101,116,32,105,115,32,99,111,110,110,101,99,116,101,100,0,83,111,99,107,101,116,32,110,111,116,32,99,111,110,110,101,99,116,101,100,0,67,97,110,110,111,116,32,115,101,110,100,32,97,102,116,101,114,32,115,111,99,107,101,116,32,115,104,117,116,100,111,119,110,0,79,112,101,114,97,116,105,111,110,32,97,108,114,101,97,100,121,32,105,110,32,112,114,111,103,114,101,115,115,0,79,112,101,114,97,116,105,111,110,32,105,110,32,112,114,111,103,114,101,115,115,0,83,116,97,108,101,32,102,105,108,101,32,104,97,110,100,108,101,0,82,101,109,111,116,101,32,73,47,79,32,101,114,114,111,114,0,81,117,111,116,97,32,101,120,99,101,101,100,101,100,0,78,111,32,109,101,100,105,117,109,32,102,111,117,110,100,0,87,114,111,110,103,32,109,101,100,105,117,109,32,116,121,112,101,0,78,111,32,101,114,114,111,114,32,105,110,102,111,114,109,97,116,105,111,110,0,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


   
  Module["_i64Subtract"] = _i64Subtract;

   
  Module["_i64Add"] = _i64Add;

   
  Module["_memset"] = _memset;

   
  Module["_bitshift64Lshr"] = _bitshift64Lshr;

   
  Module["_bitshift64Shl"] = _bitshift64Shl;

  function _gettimeofday(ptr) {
      var now = Date.now();
      HEAP32[((ptr)>>2)]=(now/1000)|0; // seconds
      HEAP32[(((ptr)+(4))>>2)]=((now % 1000)*1000)|0; // microseconds
      return 0;
    }

  function _abort() {
      Module['abort']();
    }

  function ___lock() {}

  function ___unlock() {}

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  
  var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_STATIC); 
  Module["_llvm_cttz_i32"] = _llvm_cttz_i32; 
  Module["___udivmoddi4"] = ___udivmoddi4; 
  Module["___udivdi3"] = ___udivdi3;

  
   
  Module["___muldsi3"] = ___muldsi3; 
  Module["___muldi3"] = ___muldi3;

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else Module.printErr('failed to set errno from JS');
      return value;
    } 
  Module["_sbrk"] = _sbrk;

   
  Module["___uremdi3"] = ___uremdi3;

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;

   
  Module["_llvm_bswap_i32"] = _llvm_bswap_i32;

  function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      var offset = offset_low;
      assert(offset_high === 0);
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffer) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
/* flush anything remaining in the buffer during shutdown */ __ATEXIT__.push(function() { var fflush = Module["_fflush"]; if (fflush) fflush(0); var printChar = ___syscall146.printChar; if (!printChar) return; var buffers = ___syscall146.buffers; if (buffers[1].length) printChar(1, 10); if (buffers[2].length) printChar(2, 10); });;
DYNAMICTOP_PTR = allocate(1, "i32", ALLOC_STATIC);

STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = Runtime.alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");



function nullFunc_ii(x) { Module["printErr"]("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_ii": nullFunc_ii, "nullFunc_iiii": nullFunc_iiii, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "___lock": ___lock, "_abort": _abort, "___setErrNo": ___setErrNo, "___syscall6": ___syscall6, "___syscall140": ___syscall140, "_gettimeofday": _gettimeofday, "_emscripten_memcpy_big": _emscripten_memcpy_big, "___syscall54": ___syscall54, "___unlock": ___unlock, "___syscall146": ___syscall146, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "cttz_i8": cttz_i8 };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'almost asm';
  
  
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);


  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var abortStackOverflow=env.abortStackOverflow;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_iiii=env.nullFunc_iiii;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var ___lock=env.___lock;
  var _abort=env._abort;
  var ___setErrNo=env.___setErrNo;
  var ___syscall6=env.___syscall6;
  var ___syscall140=env.___syscall140;
  var _gettimeofday=env._gettimeofday;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var ___syscall54=env.___syscall54;
  var ___unlock=env.___unlock;
  var ___syscall146=env.___syscall146;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
  if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(size|0);

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _mysecond() {
 var $0 = 0, $1 = 0, $add = 0.0, $call = 0, $conv = 0.0, $conv1 = 0.0, $i = 0, $mul = 0.0, $tp = 0, $tv_usec = 0, $tzp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $tp = sp + 16|0;
 $tzp = sp + 8|0;
 $call = (_gettimeofday(($tp|0),($tzp|0))|0);
 $i = $call;
 $0 = HEAP32[$tp>>2]|0;
 $conv = (+($0|0));
 $tv_usec = ((($tp)) + 4|0);
 $1 = HEAP32[$tv_usec>>2]|0;
 $conv1 = (+($1|0));
 $mul = $conv1 * 9.9999999999999995E-7;
 $add = $conv + $mul;
 STACKTOP = sp;return (+$add);
}
function _start_time() {
 var $call = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $call = (+_mysecond());
 HEAPF64[521] = $call;
 return;
}
function _end_time() {
 var $0 = 0.0, $call = 0.0, $sub = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $call = (+_mysecond());
 $0 = +HEAPF64[521];
 $sub = $call - $0;
 HEAPF64[521] = $sub;
 return;
}
function _main($argc,$argv) {
 $argc = $argc|0;
 $argv = $argv|0;
 var $$conv133 = 0, $$sink = 0.0, $$sink1 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0.0, $102 = 0, $103 = 0.0, $104 = 0.0, $105 = 0.0, $106 = 0, $107 = 0.0, $108 = 0, $109 = 0, $11 = 0, $110 = 0.0, $111 = 0, $112 = 0.0;
 var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0.0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0.0, $127 = 0.0, $128 = 0, $129 = 0, $13 = 0.0, $130 = 0;
 var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0.0, $136 = 0, $137 = 0, $138 = 0, $139 = 0.0, $14 = 0, $140 = 0, $141 = 0.0, $142 = 0.0, $143 = 0, $144 = 0.0, $145 = 0.0, $146 = 0, $147 = 0, $148 = 0.0, $149 = 0;
 var $15 = 0, $150 = 0.0, $151 = 0.0, $152 = 0, $153 = 0.0, $154 = 0, $155 = 0.0, $156 = 0, $157 = 0, $158 = 0.0, $159 = 0.0, $16 = 0.0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0.0, $166 = 0.0, $167 = 0;
 var $168 = 0.0, $169 = 0, $17 = 0.0, $170 = 0, $171 = 0.0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0.0, $180 = 0.0, $181 = 0.0, $182 = 0, $183 = 0, $184 = 0, $185 = 0;
 var $186 = 0, $187 = 0, $188 = 0, $189 = 0.0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0.0, $194 = 0, $195 = 0.0, $196 = 0.0, $197 = 0, $198 = 0.0, $199 = 0.0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0.0;
 var $203 = 0, $204 = 0.0, $205 = 0.0, $206 = 0, $207 = 0.0, $208 = 0, $209 = 0.0, $21 = 0, $210 = 0, $211 = 0, $212 = 0.0, $213 = 0.0, $214 = 0.0, $215 = 0.0, $216 = 0.0, $217 = 0.0, $218 = 0.0, $219 = 0, $22 = 0.0, $220 = 0;
 var $221 = 0.0, $222 = 0.0, $223 = 0, $224 = 0.0, $225 = 0, $226 = 0, $227 = 0, $228 = 0.0, $229 = 0.0, $23 = 0, $230 = 0, $231 = 0.0, $232 = 0, $233 = 0.0, $234 = 0.0, $235 = 0.0, $236 = 0.0, $237 = 0.0, $238 = 0.0, $239 = 0.0;
 var $24 = 0, $240 = 0.0, $241 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0.0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0.0, $39 = 0, $4 = 0;
 var $40 = 0.0, $41 = 0.0, $42 = 0, $43 = 0.0, $44 = 0.0, $45 = 0, $46 = 0.0, $47 = 0.0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0, $51 = 0.0, $52 = 0, $53 = 0.0, $54 = 0.0, $55 = 0.0, $56 = 0.0, $57 = 0.0, $58 = 0;
 var $59 = 0.0, $6 = 0, $60 = 0.0, $61 = 0.0, $62 = 0.0, $63 = 0.0, $64 = 0.0, $65 = 0, $66 = 0, $67 = 0.0, $68 = 0.0, $69 = 0.0, $7 = 0, $70 = 0.0, $71 = 0.0, $72 = 0.0, $73 = 0.0, $74 = 0, $75 = 0, $76 = 0;
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0.0, $81 = 0, $82 = 0.0, $83 = 0.0, $84 = 0.0, $85 = 0, $86 = 0.0, $87 = 0, $88 = 0, $89 = 0.0, $9 = 0, $90 = 0, $91 = 0.0, $92 = 0.0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $add = 0.0, $add102 = 0, $add11 = 0.0, $add171 = 0.0, $add182 = 0.0, $add231 = 0.0, $add242 = 0.0, $add70 = 0, $argc$addr = 0, $argv$addr = 0, $arrayidx = 0, $arrayidx13 = 0, $arrayidx158 = 0, $arrayidx168 = 0, $arrayidx169 = 0;
 var $arrayidx170 = 0, $arrayidx172 = 0, $arrayidx175 = 0, $arrayidx176 = 0, $arrayidx178 = 0, $arrayidx18 = 0, $arrayidx180 = 0, $arrayidx181 = 0, $arrayidx19 = 0, $arrayidx218 = 0, $arrayidx228 = 0, $arrayidx229 = 0, $arrayidx230 = 0, $arrayidx232 = 0, $arrayidx235 = 0, $arrayidx236 = 0, $arrayidx238 = 0, $arrayidx240 = 0, $arrayidx241 = 0, $arrayidx260 = 0;
 var $arrayidx264 = 0, $arrayidx27 = 0, $arrayidx273 = 0, $arrayidx277 = 0, $arrayidx288 = 0, $arrayidx291 = 0, $arrayidx294 = 0, $arrayidx297 = 0, $arrayidx303 = 0, $arrayidx306 = 0, $arrayidx309 = 0, $arrayidx31 = 0, $arrayidx312 = 0, $arrayidx318 = 0, $arrayidx321 = 0, $arrayidx324 = 0, $arrayidx327 = 0, $arrayidx33 = 0, $arrayidx334 = 0, $arrayidx39 = 0;
 var $arrayidx54 = 0, $call28 = 0.0, $call32 = 0.0, $call330 = 0, $call34 = 0.0, $call40 = 0.0, $call46 = 0.0, $cmp = 0, $cmp104 = 0, $cmp111 = 0, $cmp115 = 0, $cmp118 = 0, $cmp127 = 0, $cmp134 = 0, $cmp145 = 0, $cmp149 = 0, $cmp15 = 0, $cmp160 = 0, $cmp190 = 0, $cmp205 = 0;
 var $cmp209 = 0, $cmp220 = 0, $cmp24 = 0, $cmp248 = 0, $cmp257 = 0, $cmp261 = 0, $cmp270 = 0, $cmp274 = 0, $cmp282 = 0, $cmp29 = 0, $cmp331 = 0, $cmp35 = 0, $cmp63 = 0, $cmp72 = 0, $cmp79 = 0, $cmp83 = 0, $cmp86 = 0, $cmp94 = 0, $cond = 0.0, $cond42 = 0.0;
 var $conv = 0.0, $conv130 = 0.0, $conv133 = 0, $conv142 = 0.0, $conv156 = 0.0, $conv166 = 0.0, $conv196 = 0.0, $conv202 = 0.0, $conv216 = 0.0, $conv226 = 0.0, $conv47 = 0.0, $conv9 = 0.0, $conv96 = 0.0, $conv99 = 0, $cray = 0.0, $div = 0.0, $div132 = 0.0, $div157 = 0.0, $div167 = 0.0, $div174 = 0.0;
 var $div177 = 0.0, $div179 = 0.0, $div186 = 0.0, $div197 = 0.0, $div217 = 0.0, $div227 = 0.0, $div234 = 0.0, $div237 = 0.0, $div239 = 0.0, $div246 = 0.0, $div51 = 0.0, $div66 = 0.0, $div67 = 0.0, $div68 = 0.0, $div97 = 0.0, $eps = 0.0, $epsn = 0.0, $errors = 0, $expect = 0, $inc = 0;
 var $inc$sink = 0, $inc108 = 0, $inc108$sink = 0, $inc153 = 0, $inc153$sink = 0, $inc164 = 0, $inc164$sink = 0, $inc184 = 0, $inc184$sink = 0, $inc194 = 0, $inc194$sink = 0, $inc21 = 0, $inc21$sink = 0, $inc213 = 0, $inc213$sink = 0, $inc224 = 0, $inc224$sink = 0, $inc244 = 0, $inc244$sink = 0, $inc267 = 0;
 var $inc267$sink = 0, $inc280 = 0, $inc280$sink = 0, $inc44 = 0, $inc44$sink = 0, $inc76 = 0, $inc76$sink = 0, $loop = 0, $max1 = 0.0, $max2 = 0.0, $mflops = 0.0, $mul = 0, $mul10 = 0.0, $mul123 = 0, $mul131 = 0.0, $mul143 = 0.0, $mul173 = 0.0, $mul203 = 0.0, $mul233 = 0.0, $mul48 = 0.0;
 var $mul49 = 0.0, $mul50 = 0.0, $mul6 = 0, $mul65 = 0.0, $mul7 = 0.0, $mul8 = 0, $mul89 = 0, $mul91 = 0, $norma = 0, $normx = 0.0, $ops = 0.0, $overhead1 = 0.0, $overhead2 = 0.0, $pass = 0, $resid = 0.0, $residn = 0.0, $retval = 0, $sub = 0.0, $sub155 = 0.0, $sub215 = 0.0;
 var $sub52 = 0.0, $sub53 = 0, $sub55 = 0.0, $time2 = 0.0, $title = 0, $tm2 = 0.0, $total = 0.0, $vararg_buffer = 0, $vararg_buffer102 = 0, $vararg_buffer105 = 0, $vararg_buffer107 = 0, $vararg_buffer109 = 0, $vararg_buffer11 = 0, $vararg_buffer111 = 0, $vararg_buffer113 = 0, $vararg_buffer115 = 0, $vararg_buffer117 = 0, $vararg_buffer119 = 0, $vararg_buffer121 = 0, $vararg_buffer123 = 0;
 var $vararg_buffer125 = 0, $vararg_buffer127 = 0, $vararg_buffer14 = 0, $vararg_buffer16 = 0, $vararg_buffer18 = 0, $vararg_buffer2 = 0, $vararg_buffer25 = 0, $vararg_buffer28 = 0, $vararg_buffer31 = 0, $vararg_buffer33 = 0, $vararg_buffer35 = 0, $vararg_buffer37 = 0, $vararg_buffer4 = 0, $vararg_buffer41 = 0, $vararg_buffer44 = 0, $vararg_buffer47 = 0, $vararg_buffer51 = 0, $vararg_buffer54 = 0, $vararg_buffer57 = 0, $vararg_buffer59 = 0;
 var $vararg_buffer6 = 0, $vararg_buffer61 = 0, $vararg_buffer64 = 0, $vararg_buffer66 = 0, $vararg_buffer69 = 0, $vararg_buffer72 = 0, $vararg_buffer74 = 0, $vararg_buffer76 = 0, $vararg_buffer79 = 0, $vararg_buffer81 = 0, $vararg_buffer84 = 0, $vararg_buffer87 = 0, $vararg_buffer9 = 0, $vararg_buffer90 = 0, $vararg_buffer93 = 0, $vararg_buffer96 = 0, $vararg_buffer99 = 0, $vararg_ptr21 = 0, $vararg_ptr22 = 0, $vararg_ptr23 = 0;
 var $vararg_ptr24 = 0, $vararg_ptr40 = 0, $vararg_ptr50 = 0, $was = 0, $x1 = 0.0, $x2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 912|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(912|0);
 $vararg_buffer127 = sp + 584|0;
 $vararg_buffer125 = sp + 576|0;
 $vararg_buffer123 = sp + 568|0;
 $vararg_buffer121 = sp + 560|0;
 $vararg_buffer119 = sp + 552|0;
 $vararg_buffer117 = sp + 544|0;
 $vararg_buffer115 = sp + 536|0;
 $vararg_buffer113 = sp + 528|0;
 $vararg_buffer111 = sp + 520|0;
 $vararg_buffer109 = sp + 512|0;
 $vararg_buffer107 = sp + 504|0;
 $vararg_buffer105 = sp + 496|0;
 $vararg_buffer102 = sp + 488|0;
 $vararg_buffer99 = sp + 480|0;
 $vararg_buffer96 = sp + 472|0;
 $vararg_buffer93 = sp + 464|0;
 $vararg_buffer90 = sp + 456|0;
 $vararg_buffer87 = sp + 448|0;
 $vararg_buffer84 = sp + 440|0;
 $vararg_buffer81 = sp + 432|0;
 $vararg_buffer79 = sp + 424|0;
 $vararg_buffer76 = sp + 416|0;
 $vararg_buffer74 = sp + 408|0;
 $vararg_buffer72 = sp + 400|0;
 $vararg_buffer69 = sp + 392|0;
 $vararg_buffer66 = sp + 384|0;
 $vararg_buffer64 = sp + 376|0;
 $vararg_buffer61 = sp + 368|0;
 $vararg_buffer59 = sp + 360|0;
 $vararg_buffer57 = sp + 352|0;
 $vararg_buffer54 = sp + 344|0;
 $vararg_buffer51 = sp + 336|0;
 $vararg_buffer47 = sp + 320|0;
 $vararg_buffer44 = sp + 312|0;
 $vararg_buffer41 = sp + 304|0;
 $vararg_buffer37 = sp + 288|0;
 $vararg_buffer35 = sp + 280|0;
 $vararg_buffer33 = sp + 272|0;
 $vararg_buffer31 = sp + 264|0;
 $vararg_buffer28 = sp + 256|0;
 $vararg_buffer25 = sp + 248|0;
 $vararg_buffer18 = sp + 208|0;
 $vararg_buffer16 = sp + 200|0;
 $vararg_buffer14 = sp + 192|0;
 $vararg_buffer11 = sp + 184|0;
 $vararg_buffer9 = sp + 176|0;
 $vararg_buffer6 = sp + 168|0;
 $vararg_buffer4 = sp + 160|0;
 $vararg_buffer2 = sp + 152|0;
 $vararg_buffer = sp + 144|0;
 $norma = sp + 112|0;
 $was = sp + 812|0;
 $expect = sp + 712|0;
 $title = sp + 612|0;
 $retval = 0;
 $argc$addr = $argc;
 $argv$addr = $argv;
 (_printf(516,$vararg_buffer)|0);
 (_printf(518,$vararg_buffer2)|0);
 HEAP32[162719] = 201;
 HEAP32[162720] = 200;
 $cray = 0.056000000000000001;
 HEAP32[162714] = 100;
 $0 = HEAP32[65]|0;
 HEAP32[$vararg_buffer4>>2] = 566;
 (_fprintf($0,562,$vararg_buffer4)|0);
 $1 = HEAP32[65]|0;
 HEAP32[$vararg_buffer6>>2] = 575;
 (_fprintf($1,562,$vararg_buffer6)|0);
 $2 = HEAP32[65]|0;
 (_fprintf($2,582,$vararg_buffer9)|0);
 $3 = HEAP32[65]|0;
 HEAP32[$vararg_buffer11>>2] = 654;
 (_fprintf($3,636,$vararg_buffer11)|0);
 $4 = HEAP32[162714]|0;
 $5 = HEAP32[162714]|0;
 $mul = Math_imul($4, $5)|0;
 $6 = HEAP32[162714]|0;
 $mul6 = Math_imul($mul, $6)|0;
 $conv = (+($mul6|0));
 $mul7 = 2.0 * $conv;
 $div = $mul7 / 3.0;
 $7 = HEAP32[162714]|0;
 $8 = HEAP32[162714]|0;
 $mul8 = Math_imul($7, $8)|0;
 $conv9 = (+($mul8|0));
 $mul10 = 2.0 * $conv9;
 $add = $div + $mul10;
 $ops = $add;
 $9 = HEAP32[162719]|0;
 $10 = HEAP32[162714]|0;
 _matgen(324176,$9,$10,645776,$norma);
 _start_time();
 $11 = HEAP32[162719]|0;
 $12 = HEAP32[162714]|0;
 _dgefa(324176,$11,$12,650056,650872);
 _end_time();
 $13 = +HEAPF64[521];
 HEAPF64[81122] = $13;
 _start_time();
 $14 = HEAP32[162719]|0;
 $15 = HEAP32[162714]|0;
 _dgesl(324176,$14,$15,650056,645776,0);
 _end_time();
 $16 = +HEAPF64[521];
 HEAPF64[(649096)>>3] = $16;
 $17 = +HEAPF64[81122];
 $18 = +HEAPF64[(649096)>>3];
 $add11 = $17 + $18;
 $total = $add11;
 $inc$sink = 0;
 while(1) {
  HEAP32[162715] = $inc$sink;
  $19 = HEAP32[162715]|0;
  $20 = HEAP32[162714]|0;
  $cmp = ($19|0)<($20|0);
  if (!($cmp)) {
   break;
  }
  $21 = HEAP32[162715]|0;
  $arrayidx = (645776 + ($21<<3)|0);
  $22 = +HEAPF64[$arrayidx>>3];
  $23 = HEAP32[162715]|0;
  $arrayidx13 = (647376 + ($23<<3)|0);
  HEAPF64[$arrayidx13>>3] = $22;
  $24 = HEAP32[162715]|0;
  $inc = (($24) + 1)|0;
  $inc$sink = $inc;
 }
 $25 = HEAP32[162719]|0;
 $26 = HEAP32[162714]|0;
 _matgen(324176,$25,$26,645776,$norma);
 $inc21$sink = 0;
 while(1) {
  HEAP32[162715] = $inc21$sink;
  $27 = HEAP32[162715]|0;
  $28 = HEAP32[162714]|0;
  $cmp15 = ($27|0)<($28|0);
  if (!($cmp15)) {
   break;
  }
  $29 = HEAP32[162715]|0;
  $arrayidx18 = (645776 + ($29<<3)|0);
  $30 = +HEAPF64[$arrayidx18>>3];
  $sub = -$30;
  $31 = HEAP32[162715]|0;
  $arrayidx19 = (645776 + ($31<<3)|0);
  HEAPF64[$arrayidx19>>3] = $sub;
  $32 = HEAP32[162715]|0;
  $inc21 = (($32) + 1)|0;
  $inc21$sink = $inc21;
 }
 $33 = HEAP32[162714]|0;
 $34 = HEAP32[162714]|0;
 $35 = HEAP32[162719]|0;
 _dmxpy($33,645776,$34,$35,647376,324176);
 $resid = 0.0;
 $normx = 0.0;
 $inc44$sink = 0;
 while(1) {
  HEAP32[162715] = $inc44$sink;
  $36 = HEAP32[162715]|0;
  $37 = HEAP32[162714]|0;
  $cmp24 = ($36|0)<($37|0);
  if (!($cmp24)) {
   break;
  }
  $38 = $resid;
  $39 = HEAP32[162715]|0;
  $arrayidx27 = (645776 + ($39<<3)|0);
  $40 = +HEAPF64[$arrayidx27>>3];
  $call28 = (+Math_abs((+$40)));
  $cmp29 = $38 > $call28;
  if ($cmp29) {
   $41 = $resid;
   $cond = $41;
  } else {
   $42 = HEAP32[162715]|0;
   $arrayidx31 = (645776 + ($42<<3)|0);
   $43 = +HEAPF64[$arrayidx31>>3];
   $call32 = (+Math_abs((+$43)));
   $cond = $call32;
  }
  $resid = $cond;
  $44 = $normx;
  $45 = HEAP32[162715]|0;
  $arrayidx33 = (647376 + ($45<<3)|0);
  $46 = +HEAPF64[$arrayidx33>>3];
  $call34 = (+Math_abs((+$46)));
  $cmp35 = $44 > $call34;
  if ($cmp35) {
   $47 = $normx;
   $cond42 = $47;
  } else {
   $48 = HEAP32[162715]|0;
   $arrayidx39 = (647376 + ($48<<3)|0);
   $49 = +HEAPF64[$arrayidx39>>3];
   $call40 = (+Math_abs((+$49)));
   $cond42 = $call40;
  }
  $normx = $cond42;
  $50 = HEAP32[162715]|0;
  $inc44 = (($50) + 1)|0;
  $inc44$sink = $inc44;
 }
 $call46 = (+_epslon(1.0));
 $eps = $call46;
 $51 = $resid;
 $52 = HEAP32[162714]|0;
 $conv47 = (+($52|0));
 $53 = +HEAPF64[$norma>>3];
 $mul48 = $conv47 * $53;
 $54 = $normx;
 $mul49 = $mul48 * $54;
 $55 = $eps;
 $mul50 = $mul49 * $55;
 $div51 = $51 / $mul50;
 $residn = $div51;
 $56 = $eps;
 $epsn = $56;
 $57 = +HEAPF64[80922];
 $sub52 = $57 - 1.0;
 $x1 = $sub52;
 $58 = HEAP32[162714]|0;
 $sub53 = (($58) - 1)|0;
 $arrayidx54 = (647376 + ($sub53<<3)|0);
 $59 = +HEAPF64[$arrayidx54>>3];
 $sub55 = $59 - 1.0;
 $x2 = $sub55;
 (_printf(667,$vararg_buffer14)|0);
 (_printf(706,$vararg_buffer16)|0);
 $60 = $residn;
 $61 = $resid;
 $62 = $epsn;
 $63 = $x1;
 $64 = $x2;
 HEAPF64[$vararg_buffer18>>3] = $60;
 $vararg_ptr21 = ((($vararg_buffer18)) + 8|0);
 HEAPF64[$vararg_ptr21>>3] = $61;
 $vararg_ptr22 = ((($vararg_buffer18)) + 16|0);
 HEAPF64[$vararg_ptr22>>3] = $62;
 $vararg_ptr23 = ((($vararg_buffer18)) + 24|0);
 HEAPF64[$vararg_ptr23>>3] = $63;
 $vararg_ptr24 = ((($vararg_buffer18)) + 32|0);
 HEAPF64[$vararg_ptr24>>3] = $64;
 (_printf(741,$vararg_buffer18)|0);
 $65 = HEAP32[162714]|0;
 HEAP32[$vararg_buffer25>>2] = $65;
 (_printf(774,$vararg_buffer25)|0);
 $66 = HEAP32[162719]|0;
 HEAP32[$vararg_buffer28>>2] = $66;
 (_printf(827,$vararg_buffer28)|0);
 (_printf(881,$vararg_buffer31)|0);
 (_printf(937,$vararg_buffer33)|0);
 $67 = $total;
 HEAPF64[(649216)>>3] = $67;
 $68 = $total;
 $cmp63 = $68 > 0.0;
 if ($cmp63) {
  $69 = $ops;
  $70 = $total;
  $mul65 = 1.0E+6 * $70;
  $div66 = $69 / $mul65;
  HEAPF64[(649336)>>3] = $div66;
  $71 = +HEAPF64[(649336)>>3];
  $div67 = 2.0 / $71;
  $$sink = $div67;
 } else {
  HEAPF64[(649336)>>3] = 0.0;
  $$sink = 0.0;
 }
 HEAPF64[(649456)>>3] = $$sink;
 $72 = $total;
 $73 = $cray;
 $div68 = $72 / $73;
 HEAPF64[(649576)>>3] = $div68;
 _print_time(0);
 (_printf(950,$vararg_buffer35)|0);
 $pass = -20;
 $loop = 10;
 while(1) {
  _start_time();
  $74 = $pass;
  $add70 = (($74) + 1)|0;
  $pass = $add70;
  $inc76$sink = 0;
  while(1) {
   HEAP32[162715] = $inc76$sink;
   $75 = HEAP32[162715]|0;
   $76 = $loop;
   $cmp72 = ($75|0)<($76|0);
   if (!($cmp72)) {
    break;
   }
   $77 = HEAP32[162719]|0;
   $78 = HEAP32[162714]|0;
   _matgen(324176,$77,$78,645776,$norma);
   $79 = HEAP32[162715]|0;
   $inc76 = (($79) + 1)|0;
   $inc76$sink = $inc76;
  }
  _end_time();
  $80 = +HEAPF64[521];
  $overhead1 = $80;
  $81 = $loop;
  $82 = $overhead1;
  HEAP32[$vararg_buffer37>>2] = $81;
  $vararg_ptr40 = ((($vararg_buffer37)) + 8|0);
  HEAPF64[$vararg_ptr40>>3] = $82;
  (_printf(980,$vararg_buffer37)|0);
  $83 = $overhead1;
  $84 = +HEAPF64[1];
  $cmp79 = $83 > $84;
  if ($cmp79) {
   $pass = 0;
  }
  $85 = $pass;
  $cmp83 = ($85|0)<(0);
  do {
   if ($cmp83) {
    $86 = $overhead1;
    $cmp86 = $86 < 0.10000000000000001;
    $87 = $loop;
    if ($cmp86) {
     $mul89 = ($87*10)|0;
     $loop = $mul89;
     break;
    } else {
     $mul91 = $87<<1;
     $loop = $mul91;
     break;
    }
   }
  } while(0);
  $88 = $pass;
  $cmp94 = ($88|0)<(0);
  if (!($cmp94)) {
   break;
  }
 }
 $89 = $overhead1;
 $90 = $loop;
 $conv96 = (+($90|0));
 $div97 = $89 / $conv96;
 $overhead1 = $div97;
 $91 = $overhead1;
 HEAPF64[$vararg_buffer41>>3] = $91;
 (_printf(1006,$vararg_buffer41)|0);
 $92 = +HEAPF64[1];
 $conv99 = (~~(($92)));
 HEAP32[$vararg_buffer44>>2] = $conv99;
 (_printf(1045,$vararg_buffer44)|0);
 $pass = -20;
 HEAP32[162717] = 10;
 while(1) {
  _start_time();
  $93 = $pass;
  $add102 = (($93) + 1)|0;
  $pass = $add102;
  $inc108$sink = 0;
  while(1) {
   HEAP32[162715] = $inc108$sink;
   $94 = HEAP32[162715]|0;
   $95 = HEAP32[162717]|0;
   $cmp104 = ($94|0)<($95|0);
   if (!($cmp104)) {
    break;
   }
   $96 = HEAP32[162719]|0;
   $97 = HEAP32[162714]|0;
   _matgen(324176,$96,$97,645776,$norma);
   $98 = HEAP32[162719]|0;
   $99 = HEAP32[162714]|0;
   _dgefa(324176,$98,$99,650056,650872);
   $100 = HEAP32[162715]|0;
   $inc108 = (($100) + 1)|0;
   $inc108$sink = $inc108;
  }
  _end_time();
  $101 = +HEAPF64[521];
  $time2 = $101;
  $102 = HEAP32[162717]|0;
  $103 = $time2;
  HEAP32[$vararg_buffer47>>2] = $102;
  $vararg_ptr50 = ((($vararg_buffer47)) + 8|0);
  HEAPF64[$vararg_ptr50>>3] = $103;
  (_printf(980,$vararg_buffer47)|0);
  $104 = $time2;
  $105 = +HEAPF64[1];
  $cmp111 = $104 > $105;
  if ($cmp111) {
   $pass = 0;
  }
  $106 = $pass;
  $cmp115 = ($106|0)<(0);
  if ($cmp115) {
   $107 = $time2;
   $cmp118 = $107 < 0.10000000000000001;
   $108 = HEAP32[162717]|0;
   $$sink1 = $cmp118 ? 10 : 2;
   $mul123 = Math_imul($108, $$sink1)|0;
   HEAP32[162717] = $mul123;
  }
  $109 = $pass;
  $cmp127 = ($109|0)<(0);
  if (!($cmp127)) {
   break;
  }
 }
 $110 = +HEAPF64[1];
 $111 = HEAP32[162717]|0;
 $conv130 = (+($111|0));
 $mul131 = $110 * $conv130;
 $112 = $time2;
 $div132 = $mul131 / $112;
 $conv133 = (~~(($div132)));
 HEAP32[162717] = $conv133;
 $113 = HEAP32[162717]|0;
 $cmp134 = ($113|0)==(0);
 $$conv133 = $cmp134 ? 1 : $conv133;
 HEAP32[162717] = $$conv133;
 $114 = HEAP32[162717]|0;
 HEAP32[$vararg_buffer51>>2] = $114;
 (_printf(1093,$vararg_buffer51)|0);
 $115 = HEAP32[162719]|0;
 HEAP32[$vararg_buffer54>>2] = $115;
 (_printf(1113,$vararg_buffer54)|0);
 (_printf(881,$vararg_buffer57)|0);
 (_printf(937,$vararg_buffer59)|0);
 $116 = HEAP32[162717]|0;
 $conv142 = (+($116|0));
 $117 = $overhead1;
 $mul143 = $conv142 * $117;
 $tm2 = $mul143;
 HEAPF64[(649384)>>3] = 0.0;
 $inc184$sink = 1;
 while(1) {
  HEAP32[162716] = $inc184$sink;
  $118 = HEAP32[162716]|0;
  $cmp145 = ($118|0)<(6);
  if (!($cmp145)) {
   break;
  }
  _start_time();
  $inc153$sink = 0;
  while(1) {
   HEAP32[162715] = $inc153$sink;
   $119 = HEAP32[162715]|0;
   $120 = HEAP32[162717]|0;
   $cmp149 = ($119|0)<($120|0);
   if (!($cmp149)) {
    break;
   }
   $121 = HEAP32[162719]|0;
   $122 = HEAP32[162714]|0;
   _matgen(324176,$121,$122,645776,$norma);
   $123 = HEAP32[162719]|0;
   $124 = HEAP32[162714]|0;
   _dgefa(324176,$123,$124,650056,650872);
   $125 = HEAP32[162715]|0;
   $inc153 = (($125) + 1)|0;
   $inc153$sink = $inc153;
  }
  _end_time();
  $126 = +HEAPF64[521];
  $127 = $tm2;
  $sub155 = $126 - $127;
  $128 = HEAP32[162717]|0;
  $conv156 = (+($128|0));
  $div157 = $sub155 / $conv156;
  $129 = HEAP32[162716]|0;
  $arrayidx158 = (648976 + ($129<<3)|0);
  HEAPF64[$arrayidx158>>3] = $div157;
  _start_time();
  $inc164$sink = 0;
  while(1) {
   HEAP32[162715] = $inc164$sink;
   $130 = HEAP32[162715]|0;
   $131 = HEAP32[162717]|0;
   $cmp160 = ($130|0)<($131|0);
   if (!($cmp160)) {
    break;
   }
   $132 = HEAP32[162719]|0;
   $133 = HEAP32[162714]|0;
   _dgesl(324176,$132,$133,650056,645776,0);
   $134 = HEAP32[162715]|0;
   $inc164 = (($134) + 1)|0;
   $inc164$sink = $inc164;
  }
  _end_time();
  $135 = +HEAPF64[521];
  $136 = HEAP32[162717]|0;
  $conv166 = (+($136|0));
  $div167 = $135 / $conv166;
  $137 = HEAP32[162716]|0;
  $arrayidx168 = ((649096) + ($137<<3)|0);
  HEAPF64[$arrayidx168>>3] = $div167;
  $138 = HEAP32[162716]|0;
  $arrayidx169 = (648976 + ($138<<3)|0);
  $139 = +HEAPF64[$arrayidx169>>3];
  $140 = HEAP32[162716]|0;
  $arrayidx170 = ((649096) + ($140<<3)|0);
  $141 = +HEAPF64[$arrayidx170>>3];
  $add171 = $139 + $141;
  $total = $add171;
  $142 = $total;
  $143 = HEAP32[162716]|0;
  $arrayidx172 = ((649216) + ($143<<3)|0);
  HEAPF64[$arrayidx172>>3] = $142;
  $144 = $ops;
  $145 = $total;
  $mul173 = 1.0E+6 * $145;
  $div174 = $144 / $mul173;
  $146 = HEAP32[162716]|0;
  $arrayidx175 = ((649336) + ($146<<3)|0);
  HEAPF64[$arrayidx175>>3] = $div174;
  $147 = HEAP32[162716]|0;
  $arrayidx176 = ((649336) + ($147<<3)|0);
  $148 = +HEAPF64[$arrayidx176>>3];
  $div177 = 2.0 / $148;
  $149 = HEAP32[162716]|0;
  $arrayidx178 = ((649456) + ($149<<3)|0);
  HEAPF64[$arrayidx178>>3] = $div177;
  $150 = $total;
  $151 = $cray;
  $div179 = $150 / $151;
  $152 = HEAP32[162716]|0;
  $arrayidx180 = ((649576) + ($152<<3)|0);
  HEAPF64[$arrayidx180>>3] = $div179;
  $153 = +HEAPF64[(649384)>>3];
  $154 = HEAP32[162716]|0;
  $arrayidx181 = ((649336) + ($154<<3)|0);
  $155 = +HEAPF64[$arrayidx181>>3];
  $add182 = $153 + $155;
  HEAPF64[(649384)>>3] = $add182;
  $156 = HEAP32[162716]|0;
  _print_time($156);
  $157 = HEAP32[162716]|0;
  $inc184 = (($157) + 1)|0;
  $inc184$sink = $inc184;
 }
 $158 = +HEAPF64[(649384)>>3];
 $div186 = $158 / 5.0;
 HEAPF64[(649384)>>3] = $div186;
 $159 = +HEAPF64[(649384)>>3];
 HEAPF64[$vararg_buffer61>>3] = $159;
 (_printf(1160,$vararg_buffer61)|0);
 (_printf(1201,$vararg_buffer64)|0);
 _start_time();
 $inc194$sink = 0;
 while(1) {
  HEAP32[162715] = $inc194$sink;
  $160 = HEAP32[162715]|0;
  $161 = $loop;
  $cmp190 = ($160|0)<($161|0);
  if (!($cmp190)) {
   break;
  }
  $162 = HEAP32[162720]|0;
  $163 = HEAP32[162714]|0;
  _matgen(4176,$162,$163,645776,$norma);
  $164 = HEAP32[162715]|0;
  $inc194 = (($164) + 1)|0;
  $inc194$sink = $inc194;
 }
 _end_time();
 $165 = +HEAPF64[521];
 $overhead2 = $165;
 $166 = $overhead2;
 $167 = $loop;
 $conv196 = (+($167|0));
 $div197 = $166 / $conv196;
 $overhead2 = $div197;
 $168 = $overhead2;
 HEAPF64[$vararg_buffer66>>3] = $168;
 (_printf(1006,$vararg_buffer66)|0);
 $169 = HEAP32[162720]|0;
 HEAP32[$vararg_buffer69>>2] = $169;
 (_printf(1113,$vararg_buffer69)|0);
 (_printf(881,$vararg_buffer72)|0);
 (_printf(937,$vararg_buffer74)|0);
 $170 = HEAP32[162717]|0;
 $conv202 = (+($170|0));
 $171 = $overhead2;
 $mul203 = $conv202 * $171;
 $tm2 = $mul203;
 HEAPF64[(649432)>>3] = 0.0;
 $inc244$sink = 7;
 while(1) {
  HEAP32[162716] = $inc244$sink;
  $172 = HEAP32[162716]|0;
  $cmp205 = ($172|0)<(12);
  if (!($cmp205)) {
   break;
  }
  _start_time();
  $inc213$sink = 0;
  while(1) {
   HEAP32[162715] = $inc213$sink;
   $173 = HEAP32[162715]|0;
   $174 = HEAP32[162717]|0;
   $cmp209 = ($173|0)<($174|0);
   if (!($cmp209)) {
    break;
   }
   $175 = HEAP32[162720]|0;
   $176 = HEAP32[162714]|0;
   _matgen(4176,$175,$176,645776,$norma);
   $177 = HEAP32[162720]|0;
   $178 = HEAP32[162714]|0;
   _dgefa(4176,$177,$178,650056,650872);
   $179 = HEAP32[162715]|0;
   $inc213 = (($179) + 1)|0;
   $inc213$sink = $inc213;
  }
  _end_time();
  $180 = +HEAPF64[521];
  $181 = $tm2;
  $sub215 = $180 - $181;
  $182 = HEAP32[162717]|0;
  $conv216 = (+($182|0));
  $div217 = $sub215 / $conv216;
  $183 = HEAP32[162716]|0;
  $arrayidx218 = (648976 + ($183<<3)|0);
  HEAPF64[$arrayidx218>>3] = $div217;
  _start_time();
  $inc224$sink = 0;
  while(1) {
   HEAP32[162715] = $inc224$sink;
   $184 = HEAP32[162715]|0;
   $185 = HEAP32[162717]|0;
   $cmp220 = ($184|0)<($185|0);
   if (!($cmp220)) {
    break;
   }
   $186 = HEAP32[162720]|0;
   $187 = HEAP32[162714]|0;
   _dgesl(4176,$186,$187,650056,645776,0);
   $188 = HEAP32[162715]|0;
   $inc224 = (($188) + 1)|0;
   $inc224$sink = $inc224;
  }
  _end_time();
  $189 = +HEAPF64[521];
  $190 = HEAP32[162717]|0;
  $conv226 = (+($190|0));
  $div227 = $189 / $conv226;
  $191 = HEAP32[162716]|0;
  $arrayidx228 = ((649096) + ($191<<3)|0);
  HEAPF64[$arrayidx228>>3] = $div227;
  $192 = HEAP32[162716]|0;
  $arrayidx229 = (648976 + ($192<<3)|0);
  $193 = +HEAPF64[$arrayidx229>>3];
  $194 = HEAP32[162716]|0;
  $arrayidx230 = ((649096) + ($194<<3)|0);
  $195 = +HEAPF64[$arrayidx230>>3];
  $add231 = $193 + $195;
  $total = $add231;
  $196 = $total;
  $197 = HEAP32[162716]|0;
  $arrayidx232 = ((649216) + ($197<<3)|0);
  HEAPF64[$arrayidx232>>3] = $196;
  $198 = $ops;
  $199 = $total;
  $mul233 = 1.0E+6 * $199;
  $div234 = $198 / $mul233;
  $200 = HEAP32[162716]|0;
  $arrayidx235 = ((649336) + ($200<<3)|0);
  HEAPF64[$arrayidx235>>3] = $div234;
  $201 = HEAP32[162716]|0;
  $arrayidx236 = ((649336) + ($201<<3)|0);
  $202 = +HEAPF64[$arrayidx236>>3];
  $div237 = 2.0 / $202;
  $203 = HEAP32[162716]|0;
  $arrayidx238 = ((649456) + ($203<<3)|0);
  HEAPF64[$arrayidx238>>3] = $div237;
  $204 = $total;
  $205 = $cray;
  $div239 = $204 / $205;
  $206 = HEAP32[162716]|0;
  $arrayidx240 = ((649576) + ($206<<3)|0);
  HEAPF64[$arrayidx240>>3] = $div239;
  $207 = +HEAPF64[(649432)>>3];
  $208 = HEAP32[162716]|0;
  $arrayidx241 = ((649336) + ($208<<3)|0);
  $209 = +HEAPF64[$arrayidx241>>3];
  $add242 = $207 + $209;
  HEAPF64[(649432)>>3] = $add242;
  $210 = HEAP32[162716]|0;
  _print_time($210);
  $211 = HEAP32[162716]|0;
  $inc244 = (($211) + 1)|0;
  $inc244$sink = $inc244;
 }
 $212 = +HEAPF64[(649432)>>3];
 $div246 = $212 / 5.0;
 HEAPF64[(649432)>>3] = $div246;
 $213 = +HEAPF64[(649432)>>3];
 HEAPF64[$vararg_buffer76>>3] = $213;
 (_printf(1160,$vararg_buffer76)|0);
 $214 = +HEAPF64[(649384)>>3];
 $mflops = $214;
 $215 = +HEAPF64[(649432)>>3];
 $216 = $mflops;
 $cmp248 = $215 < $216;
 if ($cmp248) {
  $217 = +HEAPF64[(649432)>>3];
  $mflops = $217;
 }
 (_printf(516,$vararg_buffer79)|0);
 HEAP32[$vararg_buffer81>>2] = 566;
 (_printf(562,$vararg_buffer81)|0);
 HEAP32[$vararg_buffer84>>2] = 575;
 (_printf(562,$vararg_buffer84)|0);
 $218 = $mflops;
 HEAPF64[$vararg_buffer87>>3] = $218;
 (_printf(1232,$vararg_buffer87)|0);
 $max1 = 0.0;
 $inc267$sink = 1;
 while(1) {
  HEAP32[162715] = $inc267$sink;
  $219 = HEAP32[162715]|0;
  $cmp257 = ($219|0)<(6);
  if (!($cmp257)) {
   break;
  }
  $220 = HEAP32[162715]|0;
  $arrayidx260 = ((649336) + ($220<<3)|0);
  $221 = +HEAPF64[$arrayidx260>>3];
  $222 = $max1;
  $cmp261 = $221 > $222;
  if ($cmp261) {
   $223 = HEAP32[162715]|0;
   $arrayidx264 = ((649336) + ($223<<3)|0);
   $224 = +HEAPF64[$arrayidx264>>3];
   $max1 = $224;
  }
  $225 = HEAP32[162715]|0;
  $inc267 = (($225) + 1)|0;
  $inc267$sink = $inc267;
 }
 $max2 = 0.0;
 $inc280$sink = 7;
 while(1) {
  HEAP32[162715] = $inc280$sink;
  $226 = HEAP32[162715]|0;
  $cmp270 = ($226|0)<(12);
  if (!($cmp270)) {
   break;
  }
  $227 = HEAP32[162715]|0;
  $arrayidx273 = ((649336) + ($227<<3)|0);
  $228 = +HEAPF64[$arrayidx273>>3];
  $229 = $max2;
  $cmp274 = $228 > $229;
  if ($cmp274) {
   $230 = HEAP32[162715]|0;
   $arrayidx277 = ((649336) + ($230<<3)|0);
   $231 = +HEAPF64[$arrayidx277>>3];
   $max2 = $231;
  }
  $232 = HEAP32[162715]|0;
  $inc280 = (($232) + 1)|0;
  $inc280$sink = $inc280;
 }
 $233 = $max1;
 $234 = $max2;
 $cmp282 = $233 < $234;
 if ($cmp282) {
  $235 = $max1;
  $max2 = $235;
 }
 $236 = $residn;
 HEAPF64[$vararg_buffer90>>3] = $236;
 (_sprintf($was,1260,$vararg_buffer90)|0);
 $arrayidx288 = ((($was)) + 20|0);
 $237 = $resid;
 HEAPF64[$vararg_buffer93>>3] = $237;
 (_sprintf($arrayidx288,1267,$vararg_buffer93)|0);
 $arrayidx291 = ((($was)) + 40|0);
 $238 = $epsn;
 HEAPF64[$vararg_buffer96>>3] = $238;
 (_sprintf($arrayidx291,1267,$vararg_buffer96)|0);
 $arrayidx294 = ((($was)) + 60|0);
 $239 = $x1;
 HEAPF64[$vararg_buffer99>>3] = $239;
 (_sprintf($arrayidx294,1267,$vararg_buffer99)|0);
 $arrayidx297 = ((($was)) + 80|0);
 $240 = $x2;
 HEAPF64[$vararg_buffer102>>3] = $240;
 (_sprintf($arrayidx297,1267,$vararg_buffer102)|0);
 (_sprintf($expect,1274,$vararg_buffer105)|0);
 $arrayidx303 = ((($expect)) + 20|0);
 (_sprintf($arrayidx303,1291,$vararg_buffer107)|0);
 $arrayidx306 = ((($expect)) + 40|0);
 (_sprintf($arrayidx306,1308,$vararg_buffer109)|0);
 $arrayidx309 = ((($expect)) + 60|0);
 (_sprintf($arrayidx309,1325,$vararg_buffer111)|0);
 $arrayidx312 = ((($expect)) + 80|0);
 (_sprintf($arrayidx312,1342,$vararg_buffer113)|0);
 (_sprintf($title,1359,$vararg_buffer115)|0);
 $arrayidx318 = ((($title)) + 20|0);
 (_sprintf($arrayidx318,1371,$vararg_buffer117)|0);
 $arrayidx321 = ((($title)) + 40|0);
 (_sprintf($arrayidx321,1383,$vararg_buffer119)|0);
 $arrayidx324 = ((($title)) + 60|0);
 (_sprintf($arrayidx324,1395,$vararg_buffer121)|0);
 $arrayidx327 = ((($title)) + 80|0);
 (_sprintf($arrayidx327,1407,$vararg_buffer123)|0);
 $call330 = (_strtol(1419,0,10)|0);
 $cmp331 = ($call330|0)==(0);
 if (!($cmp331)) {
  $errors = 0;
  (_printf(516,$vararg_buffer127)|0);
  $241 = $retval;
  STACKTOP = sp;return ($241|0);
 }
 $arrayidx334 = ((($expect)) + 40|0);
 (_sprintf($arrayidx334,1421,$vararg_buffer125)|0);
 $errors = 0;
 (_printf(516,$vararg_buffer127)|0);
 $241 = $retval;
 STACKTOP = sp;return ($241|0);
}
function _matgen($a,$lda,$n,$b,$norma) {
 $a = $a|0;
 $lda = $lda|0;
 $n = $n|0;
 $b = $b|0;
 $norma = $norma|0;
 var $$sink = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0, $17 = 0.0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0.0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0.0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0.0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $a$addr = 0, $add = 0, $add11 = 0, $add34 = 0, $add36 = 0.0, $add6 = 0, $arrayidx = 0, $arrayidx12 = 0, $arrayidx20 = 0, $arrayidx32 = 0, $arrayidx35 = 0;
 var $arrayidx37 = 0, $arrayidx7 = 0, $b$addr = 0, $cmp = 0, $cmp17 = 0, $cmp2 = 0, $cmp25 = 0, $cmp29 = 0, $cmp8 = 0, $conv = 0.0, $div = 0.0, $i = 0, $inc = 0, $inc14 = 0, $inc22 = 0, $inc39 = 0, $inc42 = 0, $init = 0, $j = 0, $lda$addr = 0;
 var $mul = 0, $mul10 = 0, $mul33 = 0, $mul4 = 0, $mul5 = 0, $n$addr = 0, $norma$addr = 0, $rem = 0, $sub = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $a$addr = $a;
 $lda$addr = $lda;
 $n$addr = $n;
 $b$addr = $b;
 $norma$addr = $norma;
 $init = 1325;
 $0 = $norma$addr;
 HEAPF64[$0>>3] = 0.0;
 $j = 0;
 while(1) {
  $1 = $j;
  $2 = $n$addr;
  $cmp = ($1|0)<($2|0);
  $i = 0;
  if (!($cmp)) {
   break;
  }
  while(1) {
   $3 = $i;
   $4 = $n$addr;
   $cmp2 = ($3|0)<($4|0);
   if (!($cmp2)) {
    break;
   }
   $5 = $init;
   $mul = ($5*3125)|0;
   $rem = (($mul|0) % 65536)&-1;
   $init = $rem;
   $6 = $init;
   $conv = (+($6|0));
   $sub = $conv - 32768.0;
   $div = $sub / 16384.0;
   $7 = $a$addr;
   $8 = $lda$addr;
   $9 = $j;
   $mul4 = Math_imul($8, $9)|0;
   $10 = $i;
   $add = (($mul4) + ($10))|0;
   $arrayidx = (($7) + ($add<<3)|0);
   HEAPF64[$arrayidx>>3] = $div;
   $11 = $a$addr;
   $12 = $lda$addr;
   $13 = $j;
   $mul5 = Math_imul($12, $13)|0;
   $14 = $i;
   $add6 = (($mul5) + ($14))|0;
   $arrayidx7 = (($11) + ($add6<<3)|0);
   $15 = +HEAPF64[$arrayidx7>>3];
   $16 = $norma$addr;
   $17 = +HEAPF64[$16>>3];
   $cmp8 = $15 > $17;
   if ($cmp8) {
    $18 = $a$addr;
    $19 = $lda$addr;
    $20 = $j;
    $mul10 = Math_imul($19, $20)|0;
    $21 = $i;
    $add11 = (($mul10) + ($21))|0;
    $arrayidx12 = (($18) + ($add11<<3)|0);
    $$sink = $arrayidx12;
   } else {
    $22 = $norma$addr;
    $$sink = $22;
   }
   $23 = +HEAPF64[$$sink>>3];
   $24 = $norma$addr;
   HEAPF64[$24>>3] = $23;
   $25 = $i;
   $inc = (($25) + 1)|0;
   $i = $inc;
  }
  $26 = $j;
  $inc14 = (($26) + 1)|0;
  $j = $inc14;
 }
 while(1) {
  $27 = $i;
  $28 = $n$addr;
  $cmp17 = ($27|0)<($28|0);
  if (!($cmp17)) {
   break;
  }
  $29 = $b$addr;
  $30 = $i;
  $arrayidx20 = (($29) + ($30<<3)|0);
  HEAPF64[$arrayidx20>>3] = 0.0;
  $31 = $i;
  $inc22 = (($31) + 1)|0;
  $i = $inc22;
 }
 $j = 0;
 while(1) {
  $32 = $j;
  $33 = $n$addr;
  $cmp25 = ($32|0)<($33|0);
  if (!($cmp25)) {
   break;
  }
  $i = 0;
  while(1) {
   $34 = $i;
   $35 = $n$addr;
   $cmp29 = ($34|0)<($35|0);
   if (!($cmp29)) {
    break;
   }
   $36 = $b$addr;
   $37 = $i;
   $arrayidx32 = (($36) + ($37<<3)|0);
   $38 = +HEAPF64[$arrayidx32>>3];
   $39 = $a$addr;
   $40 = $lda$addr;
   $41 = $j;
   $mul33 = Math_imul($40, $41)|0;
   $42 = $i;
   $add34 = (($mul33) + ($42))|0;
   $arrayidx35 = (($39) + ($add34<<3)|0);
   $43 = +HEAPF64[$arrayidx35>>3];
   $add36 = $38 + $43;
   $44 = $b$addr;
   $45 = $i;
   $arrayidx37 = (($44) + ($45<<3)|0);
   HEAPF64[$arrayidx37>>3] = $add36;
   $46 = $i;
   $inc39 = (($46) + 1)|0;
   $i = $inc39;
  }
  $47 = $j;
  $inc42 = (($47) + 1)|0;
  $j = $inc42;
 }
 STACKTOP = sp;return;
}
function _dgefa($a,$lda,$n,$ipvt,$info) {
 $a = $a|0;
 $lda = $lda|0;
 $n = $n|0;
 $ipvt = $ipvt|0;
 $info = $info|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0.0, $101 = 0, $102 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0.0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0.0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0.0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0.0, $47 = 0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $61 = 0.0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0.0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0.0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0;
 var $79 = 0, $8 = 0, $80 = 0.0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0;
 var $97 = 0, $98 = 0, $99 = 0, $a$addr = 0, $add = 0, $add14 = 0, $add17 = 0, $add20 = 0, $add23 = 0, $add26 = 0, $add28 = 0, $add3 = 0, $add31 = 0, $add32 = 0, $add38 = 0, $add4 = 0, $add43 = 0, $add46 = 0, $add49 = 0, $add52 = 0;
 var $add55 = 0, $add56 = 0, $add59 = 0, $add60 = 0, $add7 = 0, $add73 = 0, $arrayidx = 0, $arrayidx15 = 0, $arrayidx18 = 0, $arrayidx21 = 0, $arrayidx24 = 0, $arrayidx27 = 0, $arrayidx33 = 0, $arrayidx39 = 0, $arrayidx44 = 0, $arrayidx47 = 0, $arrayidx5 = 0, $arrayidx50 = 0, $arrayidx57 = 0, $arrayidx61 = 0;
 var $arrayidx69 = 0, $arrayidx74 = 0, $arrayidx8 = 0, $call = 0, $cmp = 0, $cmp1 = 0, $cmp11 = 0, $cmp35 = 0, $cmp40 = 0, $cmp75 = 0, $cmp9 = 0, $div = 0.0, $inc = 0, $inc64 = 0, $info$addr = 0, $ipvt$addr = 0, $j = 0, $k = 0, $kp1 = 0, $l = 0;
 var $lda$addr = 0, $mul = 0, $mul13 = 0, $mul16 = 0, $mul19 = 0, $mul22 = 0, $mul25 = 0, $mul30 = 0, $mul37 = 0, $mul42 = 0, $mul45 = 0, $mul48 = 0, $mul54 = 0, $mul58 = 0, $mul6 = 0, $mul71 = 0, $n$addr = 0, $nm1 = 0, $sub = 0, $sub2 = 0;
 var $sub29 = 0, $sub53 = 0, $sub67 = 0, $sub68 = 0, $sub70 = 0, $sub72 = 0, $sub77 = 0, $t = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $a$addr = $a;
 $lda$addr = $lda;
 $n$addr = $n;
 $ipvt$addr = $ipvt;
 $info$addr = $info;
 $0 = $info$addr;
 HEAP32[$0>>2] = 0;
 $1 = $n$addr;
 $sub = (($1) - 1)|0;
 $nm1 = $sub;
 $2 = $nm1;
 $cmp = ($2|0)>=(0);
 L1: do {
  if ($cmp) {
   $k = 0;
   while(1) {
    $3 = $k;
    $4 = $nm1;
    $cmp1 = ($3|0)<($4|0);
    if (!($cmp1)) {
     break L1;
    }
    $5 = $k;
    $add = (($5) + 1)|0;
    $kp1 = $add;
    $6 = $n$addr;
    $7 = $k;
    $sub2 = (($6) - ($7))|0;
    $8 = $a$addr;
    $9 = $lda$addr;
    $10 = $k;
    $mul = Math_imul($9, $10)|0;
    $11 = $k;
    $add3 = (($mul) + ($11))|0;
    $arrayidx = (($8) + ($add3<<3)|0);
    $call = (_idamax($sub2,$arrayidx,1)|0);
    $12 = $k;
    $add4 = (($call) + ($12))|0;
    $l = $add4;
    $13 = $l;
    $14 = $ipvt$addr;
    $15 = $k;
    $arrayidx5 = (($14) + ($15<<2)|0);
    HEAP32[$arrayidx5>>2] = $13;
    $16 = $a$addr;
    $17 = $lda$addr;
    $18 = $k;
    $mul6 = Math_imul($17, $18)|0;
    $19 = $l;
    $add7 = (($mul6) + ($19))|0;
    $arrayidx8 = (($16) + ($add7<<3)|0);
    $20 = +HEAPF64[$arrayidx8>>3];
    $cmp9 = $20 != 0.0;
    L6: do {
     if ($cmp9) {
      $21 = $l;
      $22 = $k;
      $cmp11 = ($21|0)!=($22|0);
      if ($cmp11) {
       $23 = $a$addr;
       $24 = $lda$addr;
       $25 = $k;
       $mul13 = Math_imul($24, $25)|0;
       $26 = $l;
       $add14 = (($mul13) + ($26))|0;
       $arrayidx15 = (($23) + ($add14<<3)|0);
       $27 = +HEAPF64[$arrayidx15>>3];
       $t = $27;
       $28 = $a$addr;
       $29 = $lda$addr;
       $30 = $k;
       $mul16 = Math_imul($29, $30)|0;
       $31 = $k;
       $add17 = (($mul16) + ($31))|0;
       $arrayidx18 = (($28) + ($add17<<3)|0);
       $32 = +HEAPF64[$arrayidx18>>3];
       $33 = $a$addr;
       $34 = $lda$addr;
       $35 = $k;
       $mul19 = Math_imul($34, $35)|0;
       $36 = $l;
       $add20 = (($mul19) + ($36))|0;
       $arrayidx21 = (($33) + ($add20<<3)|0);
       HEAPF64[$arrayidx21>>3] = $32;
       $37 = $t;
       $38 = $a$addr;
       $39 = $lda$addr;
       $40 = $k;
       $mul22 = Math_imul($39, $40)|0;
       $41 = $k;
       $add23 = (($mul22) + ($41))|0;
       $arrayidx24 = (($38) + ($add23<<3)|0);
       HEAPF64[$arrayidx24>>3] = $37;
      }
      $42 = $a$addr;
      $43 = $lda$addr;
      $44 = $k;
      $mul25 = Math_imul($43, $44)|0;
      $45 = $k;
      $add26 = (($mul25) + ($45))|0;
      $arrayidx27 = (($42) + ($add26<<3)|0);
      $46 = +HEAPF64[$arrayidx27>>3];
      $div = -1.0 / $46;
      $t = $div;
      $47 = $n$addr;
      $48 = $k;
      $add28 = (($48) + 1)|0;
      $sub29 = (($47) - ($add28))|0;
      $49 = $t;
      $50 = $a$addr;
      $51 = $lda$addr;
      $52 = $k;
      $mul30 = Math_imul($51, $52)|0;
      $53 = $k;
      $add31 = (($mul30) + ($53))|0;
      $add32 = (($add31) + 1)|0;
      $arrayidx33 = (($50) + ($add32<<3)|0);
      _dscal($sub29,$49,$arrayidx33,1);
      $54 = $kp1;
      $j = $54;
      while(1) {
       $55 = $j;
       $56 = $n$addr;
       $cmp35 = ($55|0)<($56|0);
       if (!($cmp35)) {
        break L6;
       }
       $57 = $a$addr;
       $58 = $lda$addr;
       $59 = $j;
       $mul37 = Math_imul($58, $59)|0;
       $60 = $l;
       $add38 = (($mul37) + ($60))|0;
       $arrayidx39 = (($57) + ($add38<<3)|0);
       $61 = +HEAPF64[$arrayidx39>>3];
       $t = $61;
       $62 = $l;
       $63 = $k;
       $cmp40 = ($62|0)!=($63|0);
       if ($cmp40) {
        $64 = $a$addr;
        $65 = $lda$addr;
        $66 = $j;
        $mul42 = Math_imul($65, $66)|0;
        $67 = $k;
        $add43 = (($mul42) + ($67))|0;
        $arrayidx44 = (($64) + ($add43<<3)|0);
        $68 = +HEAPF64[$arrayidx44>>3];
        $69 = $a$addr;
        $70 = $lda$addr;
        $71 = $j;
        $mul45 = Math_imul($70, $71)|0;
        $72 = $l;
        $add46 = (($mul45) + ($72))|0;
        $arrayidx47 = (($69) + ($add46<<3)|0);
        HEAPF64[$arrayidx47>>3] = $68;
        $73 = $t;
        $74 = $a$addr;
        $75 = $lda$addr;
        $76 = $j;
        $mul48 = Math_imul($75, $76)|0;
        $77 = $k;
        $add49 = (($mul48) + ($77))|0;
        $arrayidx50 = (($74) + ($add49<<3)|0);
        HEAPF64[$arrayidx50>>3] = $73;
       }
       $78 = $n$addr;
       $79 = $k;
       $add52 = (($79) + 1)|0;
       $sub53 = (($78) - ($add52))|0;
       $80 = $t;
       $81 = $a$addr;
       $82 = $lda$addr;
       $83 = $k;
       $mul54 = Math_imul($82, $83)|0;
       $84 = $k;
       $add55 = (($mul54) + ($84))|0;
       $add56 = (($add55) + 1)|0;
       $arrayidx57 = (($81) + ($add56<<3)|0);
       $85 = $a$addr;
       $86 = $lda$addr;
       $87 = $j;
       $mul58 = Math_imul($86, $87)|0;
       $88 = $k;
       $add59 = (($mul58) + ($88))|0;
       $add60 = (($add59) + 1)|0;
       $arrayidx61 = (($85) + ($add60<<3)|0);
       _daxpy($sub53,$80,$arrayidx57,1,$arrayidx61,1);
       $89 = $j;
       $inc = (($89) + 1)|0;
       $j = $inc;
      }
     } else {
      $90 = $k;
      $91 = $info$addr;
      HEAP32[$91>>2] = $90;
     }
    } while(0);
    $92 = $k;
    $inc64 = (($92) + 1)|0;
    $k = $inc64;
   }
  }
 } while(0);
 $93 = $n$addr;
 $sub67 = (($93) - 1)|0;
 $94 = $ipvt$addr;
 $95 = $n$addr;
 $sub68 = (($95) - 1)|0;
 $arrayidx69 = (($94) + ($sub68<<2)|0);
 HEAP32[$arrayidx69>>2] = $sub67;
 $96 = $a$addr;
 $97 = $lda$addr;
 $98 = $n$addr;
 $sub70 = (($98) - 1)|0;
 $mul71 = Math_imul($97, $sub70)|0;
 $99 = $n$addr;
 $sub72 = (($99) - 1)|0;
 $add73 = (($mul71) + ($sub72))|0;
 $arrayidx74 = (($96) + ($add73<<3)|0);
 $100 = +HEAPF64[$arrayidx74>>3];
 $cmp75 = $100 == 0.0;
 if (!($cmp75)) {
  STACKTOP = sp;return;
 }
 $101 = $n$addr;
 $sub77 = (($101) - 1)|0;
 $102 = $info$addr;
 HEAP32[$102>>2] = $sub77;
 STACKTOP = sp;return;
}
function _dgesl($a,$lda,$n,$ipvt,$b,$job) {
 $a = $a|0;
 $lda = $lda|0;
 $n = $n|0;
 $ipvt = $ipvt|0;
 $b = $b|0;
 $job = $job|0;
 var $0 = 0, $1 = 0, $10 = 0.0, $100 = 0, $101 = 0, $102 = 0.0, $103 = 0, $104 = 0, $105 = 0.0, $106 = 0, $107 = 0, $108 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0, $17 = 0, $18 = 0.0;
 var $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0.0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0;
 var $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0.0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0.0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0;
 var $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0.0, $65 = 0.0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0.0, $71 = 0, $72 = 0;
 var $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0.0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0;
 var $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0.0, $a$addr = 0, $add = 0, $add11 = 0, $add12 = 0, $add14 = 0, $add20 = 0, $add24 = 0, $add30 = 0, $add40 = 0, $add46 = 0, $add58 = 0;
 var $add61 = 0, $add64 = 0, $add65 = 0, $add67 = 0, $add70 = 0.0, $arrayidx = 0, $arrayidx13 = 0, $arrayidx15 = 0, $arrayidx22 = 0, $arrayidx25 = 0, $arrayidx26 = 0, $arrayidx27 = 0, $arrayidx31 = 0, $arrayidx4 = 0, $arrayidx41 = 0, $arrayidx43 = 0, $arrayidx47 = 0, $arrayidx49 = 0, $arrayidx60 = 0, $arrayidx66 = 0;
 var $arrayidx68 = 0, $arrayidx7 = 0, $arrayidx71 = 0, $arrayidx72 = 0, $arrayidx75 = 0, $arrayidx76 = 0, $arrayidx77 = 0, $arrayidx78 = 0, $arrayidx8 = 0, $arrayidx9 = 0, $b$addr = 0, $call = 0.0, $call69 = 0.0, $cmp = 0, $cmp1 = 0, $cmp18 = 0, $cmp3 = 0, $cmp37 = 0, $cmp5 = 0, $cmp53 = 0;
 var $cmp56 = 0, $cmp73 = 0, $div = 0.0, $div48 = 0.0, $inc = 0, $inc34 = 0, $inc51 = 0, $inc81 = 0, $ipvt$addr = 0, $job$addr = 0, $k = 0, $kb = 0, $l = 0, $lda$addr = 0, $mul = 0, $mul23 = 0, $mul29 = 0, $mul39 = 0, $mul45 = 0, $mul63 = 0;
 var $n$addr = 0, $nm1 = 0, $sub = 0, $sub10 = 0, $sub21 = 0, $sub28 = 0.0, $sub44 = 0.0, $sub59 = 0, $sub62 = 0, $t = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $a$addr = $a;
 $lda$addr = $lda;
 $n$addr = $n;
 $ipvt$addr = $ipvt;
 $b$addr = $b;
 $job$addr = $job;
 $0 = $n$addr;
 $sub = (($0) - 1)|0;
 $nm1 = $sub;
 $1 = $job$addr;
 $cmp = ($1|0)==(0);
 if ($cmp) {
  $2 = $nm1;
  $cmp1 = ($2|0)>=(1);
  L3: do {
   if ($cmp1) {
    $k = 0;
    while(1) {
     $3 = $k;
     $4 = $nm1;
     $cmp3 = ($3|0)<($4|0);
     if (!($cmp3)) {
      break L3;
     }
     $5 = $ipvt$addr;
     $6 = $k;
     $arrayidx = (($5) + ($6<<2)|0);
     $7 = HEAP32[$arrayidx>>2]|0;
     $l = $7;
     $8 = $b$addr;
     $9 = $l;
     $arrayidx4 = (($8) + ($9<<3)|0);
     $10 = +HEAPF64[$arrayidx4>>3];
     $t = $10;
     $11 = $l;
     $12 = $k;
     $cmp5 = ($11|0)!=($12|0);
     if ($cmp5) {
      $13 = $b$addr;
      $14 = $k;
      $arrayidx7 = (($13) + ($14<<3)|0);
      $15 = +HEAPF64[$arrayidx7>>3];
      $16 = $b$addr;
      $17 = $l;
      $arrayidx8 = (($16) + ($17<<3)|0);
      HEAPF64[$arrayidx8>>3] = $15;
      $18 = $t;
      $19 = $b$addr;
      $20 = $k;
      $arrayidx9 = (($19) + ($20<<3)|0);
      HEAPF64[$arrayidx9>>3] = $18;
     }
     $21 = $n$addr;
     $22 = $k;
     $add = (($22) + 1)|0;
     $sub10 = (($21) - ($add))|0;
     $23 = $t;
     $24 = $a$addr;
     $25 = $lda$addr;
     $26 = $k;
     $mul = Math_imul($25, $26)|0;
     $27 = $k;
     $add11 = (($mul) + ($27))|0;
     $add12 = (($add11) + 1)|0;
     $arrayidx13 = (($24) + ($add12<<3)|0);
     $28 = $b$addr;
     $29 = $k;
     $add14 = (($29) + 1)|0;
     $arrayidx15 = (($28) + ($add14<<3)|0);
     _daxpy($sub10,$23,$arrayidx13,1,$arrayidx15,1);
     $30 = $k;
     $inc = (($30) + 1)|0;
     $k = $inc;
    }
   }
  } while(0);
  $kb = 0;
  while(1) {
   $31 = $kb;
   $32 = $n$addr;
   $cmp18 = ($31|0)<($32|0);
   if (!($cmp18)) {
    break;
   }
   $33 = $n$addr;
   $34 = $kb;
   $add20 = (($34) + 1)|0;
   $sub21 = (($33) - ($add20))|0;
   $k = $sub21;
   $35 = $b$addr;
   $36 = $k;
   $arrayidx22 = (($35) + ($36<<3)|0);
   $37 = +HEAPF64[$arrayidx22>>3];
   $38 = $a$addr;
   $39 = $lda$addr;
   $40 = $k;
   $mul23 = Math_imul($39, $40)|0;
   $41 = $k;
   $add24 = (($mul23) + ($41))|0;
   $arrayidx25 = (($38) + ($add24<<3)|0);
   $42 = +HEAPF64[$arrayidx25>>3];
   $div = $37 / $42;
   $43 = $b$addr;
   $44 = $k;
   $arrayidx26 = (($43) + ($44<<3)|0);
   HEAPF64[$arrayidx26>>3] = $div;
   $45 = $b$addr;
   $46 = $k;
   $arrayidx27 = (($45) + ($46<<3)|0);
   $47 = +HEAPF64[$arrayidx27>>3];
   $sub28 = -$47;
   $t = $sub28;
   $48 = $k;
   $49 = $t;
   $50 = $a$addr;
   $51 = $lda$addr;
   $52 = $k;
   $mul29 = Math_imul($51, $52)|0;
   $add30 = (($mul29) + 0)|0;
   $arrayidx31 = (($50) + ($add30<<3)|0);
   $53 = $b$addr;
   _daxpy($48,$49,$arrayidx31,1,$53,1);
   $54 = $kb;
   $inc34 = (($54) + 1)|0;
   $kb = $inc34;
  }
  STACKTOP = sp;return;
 }
 $k = 0;
 while(1) {
  $55 = $k;
  $56 = $n$addr;
  $cmp37 = ($55|0)<($56|0);
  if (!($cmp37)) {
   break;
  }
  $57 = $k;
  $58 = $a$addr;
  $59 = $lda$addr;
  $60 = $k;
  $mul39 = Math_imul($59, $60)|0;
  $add40 = (($mul39) + 0)|0;
  $arrayidx41 = (($58) + ($add40<<3)|0);
  $61 = $b$addr;
  $call = (+_ddot($57,$arrayidx41,1,$61,1));
  $t = $call;
  $62 = $b$addr;
  $63 = $k;
  $arrayidx43 = (($62) + ($63<<3)|0);
  $64 = +HEAPF64[$arrayidx43>>3];
  $65 = $t;
  $sub44 = $64 - $65;
  $66 = $a$addr;
  $67 = $lda$addr;
  $68 = $k;
  $mul45 = Math_imul($67, $68)|0;
  $69 = $k;
  $add46 = (($mul45) + ($69))|0;
  $arrayidx47 = (($66) + ($add46<<3)|0);
  $70 = +HEAPF64[$arrayidx47>>3];
  $div48 = $sub44 / $70;
  $71 = $b$addr;
  $72 = $k;
  $arrayidx49 = (($71) + ($72<<3)|0);
  HEAPF64[$arrayidx49>>3] = $div48;
  $73 = $k;
  $inc51 = (($73) + 1)|0;
  $k = $inc51;
 }
 $74 = $nm1;
 $cmp53 = ($74|0)>=(1);
 if (!($cmp53)) {
  STACKTOP = sp;return;
 }
 $kb = 1;
 while(1) {
  $75 = $kb;
  $76 = $nm1;
  $cmp56 = ($75|0)<($76|0);
  if (!($cmp56)) {
   break;
  }
  $77 = $n$addr;
  $78 = $kb;
  $add58 = (($78) + 1)|0;
  $sub59 = (($77) - ($add58))|0;
  $k = $sub59;
  $79 = $b$addr;
  $80 = $k;
  $arrayidx60 = (($79) + ($80<<3)|0);
  $81 = +HEAPF64[$arrayidx60>>3];
  $82 = $n$addr;
  $83 = $k;
  $add61 = (($83) + 1)|0;
  $sub62 = (($82) - ($add61))|0;
  $84 = $a$addr;
  $85 = $lda$addr;
  $86 = $k;
  $mul63 = Math_imul($85, $86)|0;
  $87 = $k;
  $add64 = (($mul63) + ($87))|0;
  $add65 = (($add64) + 1)|0;
  $arrayidx66 = (($84) + ($add65<<3)|0);
  $88 = $b$addr;
  $89 = $k;
  $add67 = (($89) + 1)|0;
  $arrayidx68 = (($88) + ($add67<<3)|0);
  $call69 = (+_ddot($sub62,$arrayidx66,1,$arrayidx68,1));
  $add70 = $81 + $call69;
  $90 = $b$addr;
  $91 = $k;
  $arrayidx71 = (($90) + ($91<<3)|0);
  HEAPF64[$arrayidx71>>3] = $add70;
  $92 = $ipvt$addr;
  $93 = $k;
  $arrayidx72 = (($92) + ($93<<2)|0);
  $94 = HEAP32[$arrayidx72>>2]|0;
  $l = $94;
  $95 = $l;
  $96 = $k;
  $cmp73 = ($95|0)!=($96|0);
  if ($cmp73) {
   $97 = $b$addr;
   $98 = $l;
   $arrayidx75 = (($97) + ($98<<3)|0);
   $99 = +HEAPF64[$arrayidx75>>3];
   $t = $99;
   $100 = $b$addr;
   $101 = $k;
   $arrayidx76 = (($100) + ($101<<3)|0);
   $102 = +HEAPF64[$arrayidx76>>3];
   $103 = $b$addr;
   $104 = $l;
   $arrayidx77 = (($103) + ($104<<3)|0);
   HEAPF64[$arrayidx77>>3] = $102;
   $105 = $t;
   $106 = $b$addr;
   $107 = $k;
   $arrayidx78 = (($106) + ($107<<3)|0);
   HEAPF64[$arrayidx78>>3] = $105;
  }
  $108 = $kb;
  $inc81 = (($108) + 1)|0;
  $kb = $inc81;
 }
 STACKTOP = sp;return;
}
function _dmxpy($n1,$y,$n2,$ldm,$x,$m) {
 $n1 = $n1|0;
 $y = $y|0;
 $n2 = $n2|0;
 $ldm = $ldm|0;
 $x = $x|0;
 $m = $m|0;
 var $0 = 0, $1 = 0, $10 = 0.0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0.0, $105 = 0, $106 = 0, $107 = 0.0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0.0, $113 = 0, $114 = 0, $115 = 0.0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0.0, $121 = 0, $122 = 0, $123 = 0.0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0.0, $129 = 0, $13 = 0, $130 = 0, $131 = 0.0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0.0, $137 = 0, $138 = 0, $139 = 0.0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0.0, $145 = 0, $146 = 0, $147 = 0.0, $148 = 0, $149 = 0, $15 = 0.0, $150 = 0, $151 = 0;
 var $152 = 0.0, $153 = 0, $154 = 0, $155 = 0.0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0.0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0.0, $173 = 0, $174 = 0, $175 = 0.0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0.0, $181 = 0, $182 = 0, $183 = 0.0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0.0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0.0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0.0, $197 = 0, $198 = 0, $199 = 0.0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0.0, $205 = 0;
 var $206 = 0, $207 = 0.0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0.0, $213 = 0, $214 = 0, $215 = 0.0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0.0, $221 = 0, $222 = 0, $223 = 0.0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0.0, $229 = 0, $23 = 0, $230 = 0, $231 = 0.0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0.0, $237 = 0, $238 = 0, $239 = 0.0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0.0, $245 = 0, $246 = 0, $247 = 0.0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0.0, $253 = 0, $254 = 0, $255 = 0.0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0.0;
 var $260 = 0.0, $261 = 0, $262 = 0, $263 = 0.0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0.0, $269 = 0, $27 = 0, $270 = 0, $271 = 0.0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0.0, $277 = 0, $278 = 0;
 var $279 = 0.0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0.0, $285 = 0, $286 = 0, $287 = 0.0, $288 = 0, $289 = 0, $29 = 0.0, $290 = 0, $291 = 0, $292 = 0.0, $293 = 0, $294 = 0, $295 = 0.0, $296 = 0;
 var $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0.0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $42 = 0.0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0.0, $54 = 0, $55 = 0, $56 = 0.0, $57 = 0, $58 = 0;
 var $59 = 0, $6 = 0, $60 = 0, $61 = 0.0, $62 = 0, $63 = 0, $64 = 0.0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0.0, $7 = 0.0, $70 = 0, $71 = 0, $72 = 0.0, $73 = 0, $74 = 0, $75 = 0, $76 = 0;
 var $77 = 0.0, $78 = 0, $79 = 0, $8 = 0, $80 = 0.0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0.0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0.0, $97 = 0, $98 = 0, $99 = 0.0, $add = 0, $add100 = 0.0, $add105 = 0, $add108 = 0.0, $add113 = 0, $add116 = 0.0, $add121 = 0, $add124 = 0.0, $add129 = 0, $add132 = 0.0, $add137 = 0, $add140 = 0.0, $add143 = 0, $add146 = 0.0, $add153 = 0;
 var $add166 = 0, $add169 = 0.0, $add174 = 0, $add177 = 0.0, $add182 = 0, $add185 = 0.0, $add19 = 0, $add190 = 0, $add193 = 0.0, $add198 = 0, $add201 = 0.0, $add206 = 0, $add209 = 0.0, $add214 = 0, $add217 = 0.0, $add22 = 0.0, $add222 = 0, $add225 = 0.0, $add230 = 0, $add233 = 0.0;
 var $add238 = 0, $add241 = 0.0, $add246 = 0, $add249 = 0.0, $add25 = 0, $add254 = 0, $add257 = 0.0, $add262 = 0, $add265 = 0.0, $add270 = 0, $add273 = 0.0, $add278 = 0, $add28 = 0.0, $add281 = 0.0, $add284 = 0, $add287 = 0.0, $add293 = 0, $add46 = 0, $add49 = 0.0, $add5 = 0.0;
 var $add54 = 0, $add57 = 0.0, $add62 = 0, $add65 = 0.0, $add68 = 0, $add71 = 0.0, $add89 = 0, $add92 = 0.0, $add97 = 0, $arrayidx = 0, $arrayidx102 = 0, $arrayidx106 = 0, $arrayidx110 = 0, $arrayidx114 = 0, $arrayidx118 = 0, $arrayidx122 = 0, $arrayidx126 = 0, $arrayidx130 = 0, $arrayidx134 = 0, $arrayidx138 = 0;
 var $arrayidx14 = 0, $arrayidx141 = 0, $arrayidx144 = 0, $arrayidx147 = 0, $arrayidx16 = 0, $arrayidx161 = 0, $arrayidx163 = 0, $arrayidx167 = 0, $arrayidx171 = 0, $arrayidx175 = 0, $arrayidx179 = 0, $arrayidx183 = 0, $arrayidx187 = 0, $arrayidx191 = 0, $arrayidx195 = 0, $arrayidx199 = 0, $arrayidx2 = 0, $arrayidx20 = 0, $arrayidx203 = 0, $arrayidx207 = 0;
 var $arrayidx211 = 0, $arrayidx215 = 0, $arrayidx219 = 0, $arrayidx223 = 0, $arrayidx227 = 0, $arrayidx23 = 0, $arrayidx231 = 0, $arrayidx235 = 0, $arrayidx239 = 0, $arrayidx243 = 0, $arrayidx247 = 0, $arrayidx251 = 0, $arrayidx255 = 0, $arrayidx259 = 0, $arrayidx26 = 0, $arrayidx263 = 0, $arrayidx267 = 0, $arrayidx271 = 0, $arrayidx275 = 0, $arrayidx279 = 0;
 var $arrayidx282 = 0, $arrayidx285 = 0, $arrayidx288 = 0, $arrayidx29 = 0, $arrayidx3 = 0, $arrayidx41 = 0, $arrayidx43 = 0, $arrayidx47 = 0, $arrayidx51 = 0, $arrayidx55 = 0, $arrayidx59 = 0, $arrayidx6 = 0, $arrayidx63 = 0, $arrayidx66 = 0, $arrayidx69 = 0, $arrayidx72 = 0, $arrayidx84 = 0, $arrayidx86 = 0, $arrayidx90 = 0, $arrayidx94 = 0;
 var $arrayidx98 = 0, $cmp = 0, $cmp1 = 0, $cmp12 = 0, $cmp156 = 0, $cmp159 = 0, $cmp35 = 0, $cmp39 = 0, $cmp78 = 0, $cmp8 = 0, $cmp82 = 0, $i = 0, $inc = 0, $inc149 = 0, $inc290 = 0, $inc31 = 0, $inc74 = 0, $j = 0, $jmin = 0, $ldm$addr = 0;
 var $m$addr = 0, $mul = 0, $mul104 = 0, $mul107 = 0.0, $mul112 = 0, $mul115 = 0.0, $mul120 = 0, $mul123 = 0.0, $mul128 = 0, $mul131 = 0.0, $mul136 = 0, $mul139 = 0.0, $mul142 = 0, $mul145 = 0.0, $mul165 = 0, $mul168 = 0.0, $mul173 = 0, $mul176 = 0.0, $mul18 = 0, $mul181 = 0;
 var $mul184 = 0.0, $mul189 = 0, $mul192 = 0.0, $mul197 = 0, $mul200 = 0.0, $mul205 = 0, $mul208 = 0.0, $mul21 = 0.0, $mul213 = 0, $mul216 = 0.0, $mul221 = 0, $mul224 = 0.0, $mul229 = 0, $mul232 = 0.0, $mul237 = 0, $mul24 = 0, $mul240 = 0.0, $mul245 = 0, $mul248 = 0.0, $mul253 = 0;
 var $mul256 = 0.0, $mul261 = 0, $mul264 = 0.0, $mul269 = 0, $mul27 = 0.0, $mul272 = 0.0, $mul277 = 0, $mul280 = 0.0, $mul283 = 0, $mul286 = 0.0, $mul4 = 0.0, $mul45 = 0, $mul48 = 0.0, $mul53 = 0, $mul56 = 0.0, $mul61 = 0, $mul64 = 0.0, $mul67 = 0, $mul70 = 0.0, $mul88 = 0;
 var $mul91 = 0.0, $mul96 = 0, $mul99 = 0.0, $n1$addr = 0, $n2$addr = 0, $rem = 0, $rem152 = 0, $rem34 = 0, $rem7 = 0, $rem77 = 0, $sub = 0, $sub10 = 0, $sub101 = 0, $sub103 = 0, $sub109 = 0, $sub111 = 0, $sub117 = 0, $sub119 = 0, $sub125 = 0, $sub127 = 0;
 var $sub133 = 0, $sub135 = 0, $sub15 = 0, $sub154 = 0, $sub162 = 0, $sub164 = 0, $sub17 = 0, $sub170 = 0, $sub172 = 0, $sub178 = 0, $sub180 = 0, $sub186 = 0, $sub188 = 0, $sub194 = 0, $sub196 = 0, $sub202 = 0, $sub204 = 0, $sub210 = 0, $sub212 = 0, $sub218 = 0;
 var $sub220 = 0, $sub226 = 0, $sub228 = 0, $sub234 = 0, $sub236 = 0, $sub242 = 0, $sub244 = 0, $sub250 = 0, $sub252 = 0, $sub258 = 0, $sub260 = 0, $sub266 = 0, $sub268 = 0, $sub274 = 0, $sub276 = 0, $sub37 = 0, $sub42 = 0, $sub44 = 0, $sub50 = 0, $sub52 = 0;
 var $sub58 = 0, $sub60 = 0, $sub80 = 0, $sub85 = 0, $sub87 = 0, $sub93 = 0, $sub95 = 0, $x$addr = 0, $y$addr = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $n1$addr = $n1;
 $y$addr = $y;
 $n2$addr = $n2;
 $ldm$addr = $ldm;
 $x$addr = $x;
 $m$addr = $m;
 $0 = $n2$addr;
 $rem = (($0|0) % 2)&-1;
 $j = $rem;
 $1 = $j;
 $cmp = ($1|0)>=(1);
 L1: do {
  if ($cmp) {
   $2 = $j;
   $sub = (($2) - 1)|0;
   $j = $sub;
   $i = 0;
   while(1) {
    $3 = $i;
    $4 = $n1$addr;
    $cmp1 = ($3|0)<($4|0);
    if (!($cmp1)) {
     break L1;
    }
    $5 = $y$addr;
    $6 = $i;
    $arrayidx = (($5) + ($6<<3)|0);
    $7 = +HEAPF64[$arrayidx>>3];
    $8 = $x$addr;
    $9 = $j;
    $arrayidx2 = (($8) + ($9<<3)|0);
    $10 = +HEAPF64[$arrayidx2>>3];
    $11 = $m$addr;
    $12 = $ldm$addr;
    $13 = $j;
    $mul = Math_imul($12, $13)|0;
    $14 = $i;
    $add = (($mul) + ($14))|0;
    $arrayidx3 = (($11) + ($add<<3)|0);
    $15 = +HEAPF64[$arrayidx3>>3];
    $mul4 = $10 * $15;
    $add5 = $7 + $mul4;
    $16 = $y$addr;
    $17 = $i;
    $arrayidx6 = (($16) + ($17<<3)|0);
    HEAPF64[$arrayidx6>>3] = $add5;
    $18 = $i;
    $inc = (($18) + 1)|0;
    $i = $inc;
   }
  }
 } while(0);
 $19 = $n2$addr;
 $rem7 = (($19|0) % 4)&-1;
 $j = $rem7;
 $20 = $j;
 $cmp8 = ($20|0)>=(2);
 L7: do {
  if ($cmp8) {
   $21 = $j;
   $sub10 = (($21) - 1)|0;
   $j = $sub10;
   $i = 0;
   while(1) {
    $22 = $i;
    $23 = $n1$addr;
    $cmp12 = ($22|0)<($23|0);
    if (!($cmp12)) {
     break L7;
    }
    $24 = $y$addr;
    $25 = $i;
    $arrayidx14 = (($24) + ($25<<3)|0);
    $26 = +HEAPF64[$arrayidx14>>3];
    $27 = $x$addr;
    $28 = $j;
    $sub15 = (($28) - 1)|0;
    $arrayidx16 = (($27) + ($sub15<<3)|0);
    $29 = +HEAPF64[$arrayidx16>>3];
    $30 = $m$addr;
    $31 = $ldm$addr;
    $32 = $j;
    $sub17 = (($32) - 1)|0;
    $mul18 = Math_imul($31, $sub17)|0;
    $33 = $i;
    $add19 = (($mul18) + ($33))|0;
    $arrayidx20 = (($30) + ($add19<<3)|0);
    $34 = +HEAPF64[$arrayidx20>>3];
    $mul21 = $29 * $34;
    $add22 = $26 + $mul21;
    $35 = $x$addr;
    $36 = $j;
    $arrayidx23 = (($35) + ($36<<3)|0);
    $37 = +HEAPF64[$arrayidx23>>3];
    $38 = $m$addr;
    $39 = $ldm$addr;
    $40 = $j;
    $mul24 = Math_imul($39, $40)|0;
    $41 = $i;
    $add25 = (($mul24) + ($41))|0;
    $arrayidx26 = (($38) + ($add25<<3)|0);
    $42 = +HEAPF64[$arrayidx26>>3];
    $mul27 = $37 * $42;
    $add28 = $add22 + $mul27;
    $43 = $y$addr;
    $44 = $i;
    $arrayidx29 = (($43) + ($44<<3)|0);
    HEAPF64[$arrayidx29>>3] = $add28;
    $45 = $i;
    $inc31 = (($45) + 1)|0;
    $i = $inc31;
   }
  }
 } while(0);
 $46 = $n2$addr;
 $rem34 = (($46|0) % 8)&-1;
 $j = $rem34;
 $47 = $j;
 $cmp35 = ($47|0)>=(4);
 L13: do {
  if ($cmp35) {
   $48 = $j;
   $sub37 = (($48) - 1)|0;
   $j = $sub37;
   $i = 0;
   while(1) {
    $49 = $i;
    $50 = $n1$addr;
    $cmp39 = ($49|0)<($50|0);
    if (!($cmp39)) {
     break L13;
    }
    $51 = $y$addr;
    $52 = $i;
    $arrayidx41 = (($51) + ($52<<3)|0);
    $53 = +HEAPF64[$arrayidx41>>3];
    $54 = $x$addr;
    $55 = $j;
    $sub42 = (($55) - 3)|0;
    $arrayidx43 = (($54) + ($sub42<<3)|0);
    $56 = +HEAPF64[$arrayidx43>>3];
    $57 = $m$addr;
    $58 = $ldm$addr;
    $59 = $j;
    $sub44 = (($59) - 3)|0;
    $mul45 = Math_imul($58, $sub44)|0;
    $60 = $i;
    $add46 = (($mul45) + ($60))|0;
    $arrayidx47 = (($57) + ($add46<<3)|0);
    $61 = +HEAPF64[$arrayidx47>>3];
    $mul48 = $56 * $61;
    $add49 = $53 + $mul48;
    $62 = $x$addr;
    $63 = $j;
    $sub50 = (($63) - 2)|0;
    $arrayidx51 = (($62) + ($sub50<<3)|0);
    $64 = +HEAPF64[$arrayidx51>>3];
    $65 = $m$addr;
    $66 = $ldm$addr;
    $67 = $j;
    $sub52 = (($67) - 2)|0;
    $mul53 = Math_imul($66, $sub52)|0;
    $68 = $i;
    $add54 = (($mul53) + ($68))|0;
    $arrayidx55 = (($65) + ($add54<<3)|0);
    $69 = +HEAPF64[$arrayidx55>>3];
    $mul56 = $64 * $69;
    $add57 = $add49 + $mul56;
    $70 = $x$addr;
    $71 = $j;
    $sub58 = (($71) - 1)|0;
    $arrayidx59 = (($70) + ($sub58<<3)|0);
    $72 = +HEAPF64[$arrayidx59>>3];
    $73 = $m$addr;
    $74 = $ldm$addr;
    $75 = $j;
    $sub60 = (($75) - 1)|0;
    $mul61 = Math_imul($74, $sub60)|0;
    $76 = $i;
    $add62 = (($mul61) + ($76))|0;
    $arrayidx63 = (($73) + ($add62<<3)|0);
    $77 = +HEAPF64[$arrayidx63>>3];
    $mul64 = $72 * $77;
    $add65 = $add57 + $mul64;
    $78 = $x$addr;
    $79 = $j;
    $arrayidx66 = (($78) + ($79<<3)|0);
    $80 = +HEAPF64[$arrayidx66>>3];
    $81 = $m$addr;
    $82 = $ldm$addr;
    $83 = $j;
    $mul67 = Math_imul($82, $83)|0;
    $84 = $i;
    $add68 = (($mul67) + ($84))|0;
    $arrayidx69 = (($81) + ($add68<<3)|0);
    $85 = +HEAPF64[$arrayidx69>>3];
    $mul70 = $80 * $85;
    $add71 = $add65 + $mul70;
    $86 = $y$addr;
    $87 = $i;
    $arrayidx72 = (($86) + ($87<<3)|0);
    HEAPF64[$arrayidx72>>3] = $add71;
    $88 = $i;
    $inc74 = (($88) + 1)|0;
    $i = $inc74;
   }
  }
 } while(0);
 $89 = $n2$addr;
 $rem77 = (($89|0) % 16)&-1;
 $j = $rem77;
 $90 = $j;
 $cmp78 = ($90|0)>=(8);
 L19: do {
  if ($cmp78) {
   $91 = $j;
   $sub80 = (($91) - 1)|0;
   $j = $sub80;
   $i = 0;
   while(1) {
    $92 = $i;
    $93 = $n1$addr;
    $cmp82 = ($92|0)<($93|0);
    if (!($cmp82)) {
     break L19;
    }
    $94 = $y$addr;
    $95 = $i;
    $arrayidx84 = (($94) + ($95<<3)|0);
    $96 = +HEAPF64[$arrayidx84>>3];
    $97 = $x$addr;
    $98 = $j;
    $sub85 = (($98) - 7)|0;
    $arrayidx86 = (($97) + ($sub85<<3)|0);
    $99 = +HEAPF64[$arrayidx86>>3];
    $100 = $m$addr;
    $101 = $ldm$addr;
    $102 = $j;
    $sub87 = (($102) - 7)|0;
    $mul88 = Math_imul($101, $sub87)|0;
    $103 = $i;
    $add89 = (($mul88) + ($103))|0;
    $arrayidx90 = (($100) + ($add89<<3)|0);
    $104 = +HEAPF64[$arrayidx90>>3];
    $mul91 = $99 * $104;
    $add92 = $96 + $mul91;
    $105 = $x$addr;
    $106 = $j;
    $sub93 = (($106) - 6)|0;
    $arrayidx94 = (($105) + ($sub93<<3)|0);
    $107 = +HEAPF64[$arrayidx94>>3];
    $108 = $m$addr;
    $109 = $ldm$addr;
    $110 = $j;
    $sub95 = (($110) - 6)|0;
    $mul96 = Math_imul($109, $sub95)|0;
    $111 = $i;
    $add97 = (($mul96) + ($111))|0;
    $arrayidx98 = (($108) + ($add97<<3)|0);
    $112 = +HEAPF64[$arrayidx98>>3];
    $mul99 = $107 * $112;
    $add100 = $add92 + $mul99;
    $113 = $x$addr;
    $114 = $j;
    $sub101 = (($114) - 5)|0;
    $arrayidx102 = (($113) + ($sub101<<3)|0);
    $115 = +HEAPF64[$arrayidx102>>3];
    $116 = $m$addr;
    $117 = $ldm$addr;
    $118 = $j;
    $sub103 = (($118) - 5)|0;
    $mul104 = Math_imul($117, $sub103)|0;
    $119 = $i;
    $add105 = (($mul104) + ($119))|0;
    $arrayidx106 = (($116) + ($add105<<3)|0);
    $120 = +HEAPF64[$arrayidx106>>3];
    $mul107 = $115 * $120;
    $add108 = $add100 + $mul107;
    $121 = $x$addr;
    $122 = $j;
    $sub109 = (($122) - 4)|0;
    $arrayidx110 = (($121) + ($sub109<<3)|0);
    $123 = +HEAPF64[$arrayidx110>>3];
    $124 = $m$addr;
    $125 = $ldm$addr;
    $126 = $j;
    $sub111 = (($126) - 4)|0;
    $mul112 = Math_imul($125, $sub111)|0;
    $127 = $i;
    $add113 = (($mul112) + ($127))|0;
    $arrayidx114 = (($124) + ($add113<<3)|0);
    $128 = +HEAPF64[$arrayidx114>>3];
    $mul115 = $123 * $128;
    $add116 = $add108 + $mul115;
    $129 = $x$addr;
    $130 = $j;
    $sub117 = (($130) - 3)|0;
    $arrayidx118 = (($129) + ($sub117<<3)|0);
    $131 = +HEAPF64[$arrayidx118>>3];
    $132 = $m$addr;
    $133 = $ldm$addr;
    $134 = $j;
    $sub119 = (($134) - 3)|0;
    $mul120 = Math_imul($133, $sub119)|0;
    $135 = $i;
    $add121 = (($mul120) + ($135))|0;
    $arrayidx122 = (($132) + ($add121<<3)|0);
    $136 = +HEAPF64[$arrayidx122>>3];
    $mul123 = $131 * $136;
    $add124 = $add116 + $mul123;
    $137 = $x$addr;
    $138 = $j;
    $sub125 = (($138) - 2)|0;
    $arrayidx126 = (($137) + ($sub125<<3)|0);
    $139 = +HEAPF64[$arrayidx126>>3];
    $140 = $m$addr;
    $141 = $ldm$addr;
    $142 = $j;
    $sub127 = (($142) - 2)|0;
    $mul128 = Math_imul($141, $sub127)|0;
    $143 = $i;
    $add129 = (($mul128) + ($143))|0;
    $arrayidx130 = (($140) + ($add129<<3)|0);
    $144 = +HEAPF64[$arrayidx130>>3];
    $mul131 = $139 * $144;
    $add132 = $add124 + $mul131;
    $145 = $x$addr;
    $146 = $j;
    $sub133 = (($146) - 1)|0;
    $arrayidx134 = (($145) + ($sub133<<3)|0);
    $147 = +HEAPF64[$arrayidx134>>3];
    $148 = $m$addr;
    $149 = $ldm$addr;
    $150 = $j;
    $sub135 = (($150) - 1)|0;
    $mul136 = Math_imul($149, $sub135)|0;
    $151 = $i;
    $add137 = (($mul136) + ($151))|0;
    $arrayidx138 = (($148) + ($add137<<3)|0);
    $152 = +HEAPF64[$arrayidx138>>3];
    $mul139 = $147 * $152;
    $add140 = $add132 + $mul139;
    $153 = $x$addr;
    $154 = $j;
    $arrayidx141 = (($153) + ($154<<3)|0);
    $155 = +HEAPF64[$arrayidx141>>3];
    $156 = $m$addr;
    $157 = $ldm$addr;
    $158 = $j;
    $mul142 = Math_imul($157, $158)|0;
    $159 = $i;
    $add143 = (($mul142) + ($159))|0;
    $arrayidx144 = (($156) + ($add143<<3)|0);
    $160 = +HEAPF64[$arrayidx144>>3];
    $mul145 = $155 * $160;
    $add146 = $add140 + $mul145;
    $161 = $y$addr;
    $162 = $i;
    $arrayidx147 = (($161) + ($162<<3)|0);
    HEAPF64[$arrayidx147>>3] = $add146;
    $163 = $i;
    $inc149 = (($163) + 1)|0;
    $i = $inc149;
   }
  }
 } while(0);
 $164 = $n2$addr;
 $rem152 = (($164|0) % 16)&-1;
 $add153 = (($rem152) + 16)|0;
 $jmin = $add153;
 $165 = $jmin;
 $sub154 = (($165) - 1)|0;
 $j = $sub154;
 while(1) {
  $166 = $j;
  $167 = $n2$addr;
  $cmp156 = ($166|0)<($167|0);
  if (!($cmp156)) {
   break;
  }
  $i = 0;
  while(1) {
   $168 = $i;
   $169 = $n1$addr;
   $cmp159 = ($168|0)<($169|0);
   if (!($cmp159)) {
    break;
   }
   $170 = $y$addr;
   $171 = $i;
   $arrayidx161 = (($170) + ($171<<3)|0);
   $172 = +HEAPF64[$arrayidx161>>3];
   $173 = $x$addr;
   $174 = $j;
   $sub162 = (($174) - 15)|0;
   $arrayidx163 = (($173) + ($sub162<<3)|0);
   $175 = +HEAPF64[$arrayidx163>>3];
   $176 = $m$addr;
   $177 = $ldm$addr;
   $178 = $j;
   $sub164 = (($178) - 15)|0;
   $mul165 = Math_imul($177, $sub164)|0;
   $179 = $i;
   $add166 = (($mul165) + ($179))|0;
   $arrayidx167 = (($176) + ($add166<<3)|0);
   $180 = +HEAPF64[$arrayidx167>>3];
   $mul168 = $175 * $180;
   $add169 = $172 + $mul168;
   $181 = $x$addr;
   $182 = $j;
   $sub170 = (($182) - 14)|0;
   $arrayidx171 = (($181) + ($sub170<<3)|0);
   $183 = +HEAPF64[$arrayidx171>>3];
   $184 = $m$addr;
   $185 = $ldm$addr;
   $186 = $j;
   $sub172 = (($186) - 14)|0;
   $mul173 = Math_imul($185, $sub172)|0;
   $187 = $i;
   $add174 = (($mul173) + ($187))|0;
   $arrayidx175 = (($184) + ($add174<<3)|0);
   $188 = +HEAPF64[$arrayidx175>>3];
   $mul176 = $183 * $188;
   $add177 = $add169 + $mul176;
   $189 = $x$addr;
   $190 = $j;
   $sub178 = (($190) - 13)|0;
   $arrayidx179 = (($189) + ($sub178<<3)|0);
   $191 = +HEAPF64[$arrayidx179>>3];
   $192 = $m$addr;
   $193 = $ldm$addr;
   $194 = $j;
   $sub180 = (($194) - 13)|0;
   $mul181 = Math_imul($193, $sub180)|0;
   $195 = $i;
   $add182 = (($mul181) + ($195))|0;
   $arrayidx183 = (($192) + ($add182<<3)|0);
   $196 = +HEAPF64[$arrayidx183>>3];
   $mul184 = $191 * $196;
   $add185 = $add177 + $mul184;
   $197 = $x$addr;
   $198 = $j;
   $sub186 = (($198) - 12)|0;
   $arrayidx187 = (($197) + ($sub186<<3)|0);
   $199 = +HEAPF64[$arrayidx187>>3];
   $200 = $m$addr;
   $201 = $ldm$addr;
   $202 = $j;
   $sub188 = (($202) - 12)|0;
   $mul189 = Math_imul($201, $sub188)|0;
   $203 = $i;
   $add190 = (($mul189) + ($203))|0;
   $arrayidx191 = (($200) + ($add190<<3)|0);
   $204 = +HEAPF64[$arrayidx191>>3];
   $mul192 = $199 * $204;
   $add193 = $add185 + $mul192;
   $205 = $x$addr;
   $206 = $j;
   $sub194 = (($206) - 11)|0;
   $arrayidx195 = (($205) + ($sub194<<3)|0);
   $207 = +HEAPF64[$arrayidx195>>3];
   $208 = $m$addr;
   $209 = $ldm$addr;
   $210 = $j;
   $sub196 = (($210) - 11)|0;
   $mul197 = Math_imul($209, $sub196)|0;
   $211 = $i;
   $add198 = (($mul197) + ($211))|0;
   $arrayidx199 = (($208) + ($add198<<3)|0);
   $212 = +HEAPF64[$arrayidx199>>3];
   $mul200 = $207 * $212;
   $add201 = $add193 + $mul200;
   $213 = $x$addr;
   $214 = $j;
   $sub202 = (($214) - 10)|0;
   $arrayidx203 = (($213) + ($sub202<<3)|0);
   $215 = +HEAPF64[$arrayidx203>>3];
   $216 = $m$addr;
   $217 = $ldm$addr;
   $218 = $j;
   $sub204 = (($218) - 10)|0;
   $mul205 = Math_imul($217, $sub204)|0;
   $219 = $i;
   $add206 = (($mul205) + ($219))|0;
   $arrayidx207 = (($216) + ($add206<<3)|0);
   $220 = +HEAPF64[$arrayidx207>>3];
   $mul208 = $215 * $220;
   $add209 = $add201 + $mul208;
   $221 = $x$addr;
   $222 = $j;
   $sub210 = (($222) - 9)|0;
   $arrayidx211 = (($221) + ($sub210<<3)|0);
   $223 = +HEAPF64[$arrayidx211>>3];
   $224 = $m$addr;
   $225 = $ldm$addr;
   $226 = $j;
   $sub212 = (($226) - 9)|0;
   $mul213 = Math_imul($225, $sub212)|0;
   $227 = $i;
   $add214 = (($mul213) + ($227))|0;
   $arrayidx215 = (($224) + ($add214<<3)|0);
   $228 = +HEAPF64[$arrayidx215>>3];
   $mul216 = $223 * $228;
   $add217 = $add209 + $mul216;
   $229 = $x$addr;
   $230 = $j;
   $sub218 = (($230) - 8)|0;
   $arrayidx219 = (($229) + ($sub218<<3)|0);
   $231 = +HEAPF64[$arrayidx219>>3];
   $232 = $m$addr;
   $233 = $ldm$addr;
   $234 = $j;
   $sub220 = (($234) - 8)|0;
   $mul221 = Math_imul($233, $sub220)|0;
   $235 = $i;
   $add222 = (($mul221) + ($235))|0;
   $arrayidx223 = (($232) + ($add222<<3)|0);
   $236 = +HEAPF64[$arrayidx223>>3];
   $mul224 = $231 * $236;
   $add225 = $add217 + $mul224;
   $237 = $x$addr;
   $238 = $j;
   $sub226 = (($238) - 7)|0;
   $arrayidx227 = (($237) + ($sub226<<3)|0);
   $239 = +HEAPF64[$arrayidx227>>3];
   $240 = $m$addr;
   $241 = $ldm$addr;
   $242 = $j;
   $sub228 = (($242) - 7)|0;
   $mul229 = Math_imul($241, $sub228)|0;
   $243 = $i;
   $add230 = (($mul229) + ($243))|0;
   $arrayidx231 = (($240) + ($add230<<3)|0);
   $244 = +HEAPF64[$arrayidx231>>3];
   $mul232 = $239 * $244;
   $add233 = $add225 + $mul232;
   $245 = $x$addr;
   $246 = $j;
   $sub234 = (($246) - 6)|0;
   $arrayidx235 = (($245) + ($sub234<<3)|0);
   $247 = +HEAPF64[$arrayidx235>>3];
   $248 = $m$addr;
   $249 = $ldm$addr;
   $250 = $j;
   $sub236 = (($250) - 6)|0;
   $mul237 = Math_imul($249, $sub236)|0;
   $251 = $i;
   $add238 = (($mul237) + ($251))|0;
   $arrayidx239 = (($248) + ($add238<<3)|0);
   $252 = +HEAPF64[$arrayidx239>>3];
   $mul240 = $247 * $252;
   $add241 = $add233 + $mul240;
   $253 = $x$addr;
   $254 = $j;
   $sub242 = (($254) - 5)|0;
   $arrayidx243 = (($253) + ($sub242<<3)|0);
   $255 = +HEAPF64[$arrayidx243>>3];
   $256 = $m$addr;
   $257 = $ldm$addr;
   $258 = $j;
   $sub244 = (($258) - 5)|0;
   $mul245 = Math_imul($257, $sub244)|0;
   $259 = $i;
   $add246 = (($mul245) + ($259))|0;
   $arrayidx247 = (($256) + ($add246<<3)|0);
   $260 = +HEAPF64[$arrayidx247>>3];
   $mul248 = $255 * $260;
   $add249 = $add241 + $mul248;
   $261 = $x$addr;
   $262 = $j;
   $sub250 = (($262) - 4)|0;
   $arrayidx251 = (($261) + ($sub250<<3)|0);
   $263 = +HEAPF64[$arrayidx251>>3];
   $264 = $m$addr;
   $265 = $ldm$addr;
   $266 = $j;
   $sub252 = (($266) - 4)|0;
   $mul253 = Math_imul($265, $sub252)|0;
   $267 = $i;
   $add254 = (($mul253) + ($267))|0;
   $arrayidx255 = (($264) + ($add254<<3)|0);
   $268 = +HEAPF64[$arrayidx255>>3];
   $mul256 = $263 * $268;
   $add257 = $add249 + $mul256;
   $269 = $x$addr;
   $270 = $j;
   $sub258 = (($270) - 3)|0;
   $arrayidx259 = (($269) + ($sub258<<3)|0);
   $271 = +HEAPF64[$arrayidx259>>3];
   $272 = $m$addr;
   $273 = $ldm$addr;
   $274 = $j;
   $sub260 = (($274) - 3)|0;
   $mul261 = Math_imul($273, $sub260)|0;
   $275 = $i;
   $add262 = (($mul261) + ($275))|0;
   $arrayidx263 = (($272) + ($add262<<3)|0);
   $276 = +HEAPF64[$arrayidx263>>3];
   $mul264 = $271 * $276;
   $add265 = $add257 + $mul264;
   $277 = $x$addr;
   $278 = $j;
   $sub266 = (($278) - 2)|0;
   $arrayidx267 = (($277) + ($sub266<<3)|0);
   $279 = +HEAPF64[$arrayidx267>>3];
   $280 = $m$addr;
   $281 = $ldm$addr;
   $282 = $j;
   $sub268 = (($282) - 2)|0;
   $mul269 = Math_imul($281, $sub268)|0;
   $283 = $i;
   $add270 = (($mul269) + ($283))|0;
   $arrayidx271 = (($280) + ($add270<<3)|0);
   $284 = +HEAPF64[$arrayidx271>>3];
   $mul272 = $279 * $284;
   $add273 = $add265 + $mul272;
   $285 = $x$addr;
   $286 = $j;
   $sub274 = (($286) - 1)|0;
   $arrayidx275 = (($285) + ($sub274<<3)|0);
   $287 = +HEAPF64[$arrayidx275>>3];
   $288 = $m$addr;
   $289 = $ldm$addr;
   $290 = $j;
   $sub276 = (($290) - 1)|0;
   $mul277 = Math_imul($289, $sub276)|0;
   $291 = $i;
   $add278 = (($mul277) + ($291))|0;
   $arrayidx279 = (($288) + ($add278<<3)|0);
   $292 = +HEAPF64[$arrayidx279>>3];
   $mul280 = $287 * $292;
   $add281 = $add273 + $mul280;
   $293 = $x$addr;
   $294 = $j;
   $arrayidx282 = (($293) + ($294<<3)|0);
   $295 = +HEAPF64[$arrayidx282>>3];
   $296 = $m$addr;
   $297 = $ldm$addr;
   $298 = $j;
   $mul283 = Math_imul($297, $298)|0;
   $299 = $i;
   $add284 = (($mul283) + ($299))|0;
   $arrayidx285 = (($296) + ($add284<<3)|0);
   $300 = +HEAPF64[$arrayidx285>>3];
   $mul286 = $295 * $300;
   $add287 = $add281 + $mul286;
   $301 = $y$addr;
   $302 = $i;
   $arrayidx288 = (($301) + ($302<<3)|0);
   HEAPF64[$arrayidx288>>3] = $add287;
   $303 = $i;
   $inc290 = (($303) + 1)|0;
   $i = $inc290;
  }
  $304 = $j;
  $add293 = (($304) + 16)|0;
  $j = $add293;
 }
 STACKTOP = sp;return;
}
function _epslon($x) {
 $x = +$x;
 var $0 = 0.0, $1 = 0.0, $2 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0.0, $a = 0.0, $add = 0.0, $add1 = 0.0, $b = 0.0, $c = 0.0, $call = 0.0, $call3 = 0.0, $cmp = 0, $eps = 0.0, $mul = 0.0, $sub = 0.0, $sub2 = 0.0;
 var $x$addr = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $x$addr = $x;
 $a = 1.3333333333333333;
 $eps = 0.0;
 while(1) {
  $0 = $eps;
  $cmp = $0 == 0.0;
  if (!($cmp)) {
   break;
  }
  $1 = $a;
  $sub = $1 - 1.0;
  $b = $sub;
  $2 = $b;
  $3 = $b;
  $add = $2 + $3;
  $4 = $b;
  $add1 = $add + $4;
  $c = $add1;
  $5 = $c;
  $sub2 = $5 - 1.0;
  $call = (+Math_abs((+$sub2)));
  $eps = $call;
 }
 $6 = $eps;
 $7 = $x$addr;
 $call3 = (+Math_abs((+$7)));
 $mul = $6 * $call3;
 STACKTOP = sp;return (+$mul);
}
function _print_time($row) {
 $row = $row|0;
 var $0 = 0, $1 = 0.0, $10 = 0, $11 = 0.0, $2 = 0, $3 = 0.0, $4 = 0, $5 = 0.0, $6 = 0, $7 = 0.0, $8 = 0, $9 = 0.0, $arrayidx = 0, $arrayidx1 = 0, $arrayidx2 = 0, $arrayidx3 = 0, $arrayidx4 = 0, $arrayidx5 = 0, $row$addr = 0, $vararg_buffer = 0;
 var $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, $vararg_ptr5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $vararg_buffer = sp;
 $row$addr = $row;
 $0 = $row$addr;
 $arrayidx = (648976 + ($0<<3)|0);
 $1 = +HEAPF64[$arrayidx>>3];
 $2 = $row$addr;
 $arrayidx1 = ((649096) + ($2<<3)|0);
 $3 = +HEAPF64[$arrayidx1>>3];
 $4 = $row$addr;
 $arrayidx2 = ((649216) + ($4<<3)|0);
 $5 = +HEAPF64[$arrayidx2>>3];
 $6 = $row$addr;
 $arrayidx3 = ((649336) + ($6<<3)|0);
 $7 = +HEAPF64[$arrayidx3>>3];
 $8 = $row$addr;
 $arrayidx4 = ((649456) + ($8<<3)|0);
 $9 = +HEAPF64[$arrayidx4>>3];
 $10 = $row$addr;
 $arrayidx5 = ((649576) + ($10<<3)|0);
 $11 = +HEAPF64[$arrayidx5>>3];
 HEAPF64[$vararg_buffer>>3] = $1;
 $vararg_ptr1 = ((($vararg_buffer)) + 8|0);
 HEAPF64[$vararg_ptr1>>3] = $3;
 $vararg_ptr2 = ((($vararg_buffer)) + 16|0);
 HEAPF64[$vararg_ptr2>>3] = $5;
 $vararg_ptr3 = ((($vararg_buffer)) + 24|0);
 HEAPF64[$vararg_ptr3>>3] = $7;
 $vararg_ptr4 = ((($vararg_buffer)) + 32|0);
 HEAPF64[$vararg_ptr4>>3] = $9;
 $vararg_ptr5 = ((($vararg_buffer)) + 40|0);
 HEAPF64[$vararg_ptr5>>3] = $11;
 (_printf(1438,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _idamax($n,$dx,$incx) {
 $n = $n|0;
 $dx = $dx|0;
 $incx = $incx|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0.0, $12 = 0.0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0.0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0.0;
 var $27 = 0.0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0.0, $32 = 0, $33 = 0, $34 = 0, $4 = 0.0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $add = 0, $add14 = 0, $arrayidx11 = 0, $arrayidx20 = 0, $arrayidx24 = 0;
 var $arrayidx7 = 0, $call = 0.0, $call12 = 0.0, $call16 = 0.0, $call21 = 0.0, $call25 = 0.0, $call8 = 0.0, $cmp = 0, $cmp1 = 0, $cmp18 = 0, $cmp22 = 0, $cmp4 = 0, $cmp6 = 0, $cmp9 = 0, $dmax = 0.0, $dx$addr = 0, $i = 0, $inc = 0, $inc28 = 0, $incx$addr = 0;
 var $itemp = 0, $ix = 0, $n$addr = 0, $retval = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $n$addr = $n;
 $dx$addr = $dx;
 $incx$addr = $incx;
 $0 = $n$addr;
 $cmp = ($0|0)<(1);
 if ($cmp) {
  $retval = -1;
  $34 = $retval;
  STACKTOP = sp;return ($34|0);
 }
 $1 = $n$addr;
 $cmp1 = ($1|0)==(1);
 if ($cmp1) {
  $retval = 0;
  $34 = $retval;
  STACKTOP = sp;return ($34|0);
 }
 $2 = $incx$addr;
 $cmp4 = ($2|0)!=(1);
 L9: do {
  if ($cmp4) {
   $ix = 1;
   $3 = $dx$addr;
   $4 = +HEAPF64[$3>>3];
   $call = (+Math_abs((+$4)));
   $dmax = $call;
   $5 = $ix;
   $6 = $incx$addr;
   $add = (($5) + ($6))|0;
   $ix = $add;
   $i = 1;
   while(1) {
    $7 = $i;
    $8 = $n$addr;
    $cmp6 = ($7|0)<($8|0);
    if (!($cmp6)) {
     break L9;
    }
    $9 = $dx$addr;
    $10 = $ix;
    $arrayidx7 = (($9) + ($10<<3)|0);
    $11 = +HEAPF64[$arrayidx7>>3];
    $call8 = (+Math_abs((+$11)));
    $12 = $dmax;
    $cmp9 = $call8 > $12;
    if ($cmp9) {
     $13 = $i;
     $itemp = $13;
     $14 = $dx$addr;
     $15 = $ix;
     $arrayidx11 = (($14) + ($15<<3)|0);
     $16 = +HEAPF64[$arrayidx11>>3];
     $call12 = (+Math_abs((+$16)));
     $dmax = $call12;
    }
    $17 = $ix;
    $18 = $incx$addr;
    $add14 = (($17) + ($18))|0;
    $ix = $add14;
    $19 = $i;
    $inc = (($19) + 1)|0;
    $i = $inc;
   }
  } else {
   $itemp = 0;
   $20 = $dx$addr;
   $21 = +HEAPF64[$20>>3];
   $call16 = (+Math_abs((+$21)));
   $dmax = $call16;
   $i = 1;
   while(1) {
    $22 = $i;
    $23 = $n$addr;
    $cmp18 = ($22|0)<($23|0);
    if (!($cmp18)) {
     break L9;
    }
    $24 = $dx$addr;
    $25 = $i;
    $arrayidx20 = (($24) + ($25<<3)|0);
    $26 = +HEAPF64[$arrayidx20>>3];
    $call21 = (+Math_abs((+$26)));
    $27 = $dmax;
    $cmp22 = $call21 > $27;
    if ($cmp22) {
     $28 = $i;
     $itemp = $28;
     $29 = $dx$addr;
     $30 = $i;
     $arrayidx24 = (($29) + ($30<<3)|0);
     $31 = +HEAPF64[$arrayidx24>>3];
     $call25 = (+Math_abs((+$31)));
     $dmax = $call25;
    }
    $32 = $i;
    $inc28 = (($32) + 1)|0;
    $i = $inc28;
   }
  }
 } while(0);
 $33 = $itemp;
 $retval = $33;
 $34 = $retval;
 STACKTOP = sp;return ($34|0);
}
function _dscal($n,$da,$dx,$incx) {
 $n = $n|0;
 $da = +$da;
 $dx = $dx|0;
 $incx = $incx|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0.0, $18 = 0, $19 = 0, $2 = 0, $20 = 0.0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0.0, $29 = 0, $3 = 0, $30 = 0, $31 = 0.0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0.0, $41 = 0, $42 = 0, $43 = 0.0, $44 = 0;
 var $45 = 0, $46 = 0.0, $47 = 0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0, $51 = 0, $52 = 0.0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0, $57 = 0, $58 = 0, $6 = 0.0, $7 = 0, $8 = 0, $9 = 0.0, $add = 0;
 var $add27 = 0, $add30 = 0, $add32 = 0, $add35 = 0, $add37 = 0, $add40 = 0, $add42 = 0, $add45 = 0, $add48 = 0, $arrayidx = 0, $arrayidx12 = 0, $arrayidx14 = 0, $arrayidx24 = 0, $arrayidx26 = 0, $arrayidx28 = 0, $arrayidx31 = 0, $arrayidx33 = 0, $arrayidx36 = 0, $arrayidx38 = 0, $arrayidx41 = 0;
 var $arrayidx43 = 0, $arrayidx46 = 0, $arrayidx5 = 0, $cmp = 0, $cmp1 = 0, $cmp10 = 0, $cmp17 = 0, $cmp22 = 0, $cmp3 = 0, $cmp7 = 0, $da$addr = 0.0, $dx$addr = 0, $i = 0, $inc = 0, $incx$addr = 0, $m = 0, $mp1 = 0, $mul = 0, $mul13 = 0.0, $mul25 = 0.0;
 var $mul29 = 0.0, $mul34 = 0.0, $mul39 = 0.0, $mul4 = 0.0, $mul44 = 0.0, $n$addr = 0, $nincx = 0, $rem = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $n$addr = $n;
 $da$addr = $da;
 $dx$addr = $dx;
 $incx$addr = $incx;
 $mp1 = 0;
 $m = 0;
 $0 = $n$addr;
 $cmp = ($0|0)<=(0);
 if ($cmp) {
  STACKTOP = sp;return;
 }
 $1 = $incx$addr;
 $cmp1 = ($1|0)!=(1);
 $2 = $n$addr;
 if ($cmp1) {
  $3 = $incx$addr;
  $mul = Math_imul($2, $3)|0;
  $nincx = $mul;
  $i = 0;
  while(1) {
   $4 = $i;
   $5 = $nincx;
   $cmp3 = ($4|0)<($5|0);
   if (!($cmp3)) {
    break;
   }
   $6 = $da$addr;
   $7 = $dx$addr;
   $8 = $i;
   $arrayidx = (($7) + ($8<<3)|0);
   $9 = +HEAPF64[$arrayidx>>3];
   $mul4 = $6 * $9;
   $10 = $dx$addr;
   $11 = $i;
   $arrayidx5 = (($10) + ($11<<3)|0);
   HEAPF64[$arrayidx5>>3] = $mul4;
   $12 = $i;
   $13 = $incx$addr;
   $add = (($12) + ($13))|0;
   $i = $add;
  }
  STACKTOP = sp;return;
 }
 $rem = (($2|0) % 5)&-1;
 $m = $rem;
 $14 = $m;
 $cmp7 = ($14|0)!=(0);
 if ($cmp7) {
  $i = 0;
  while(1) {
   $15 = $i;
   $16 = $m;
   $cmp10 = ($15|0)<($16|0);
   if (!($cmp10)) {
    break;
   }
   $17 = $da$addr;
   $18 = $dx$addr;
   $19 = $i;
   $arrayidx12 = (($18) + ($19<<3)|0);
   $20 = +HEAPF64[$arrayidx12>>3];
   $mul13 = $17 * $20;
   $21 = $dx$addr;
   $22 = $i;
   $arrayidx14 = (($21) + ($22<<3)|0);
   HEAPF64[$arrayidx14>>3] = $mul13;
   $23 = $i;
   $inc = (($23) + 1)|0;
   $i = $inc;
  }
  $24 = $n$addr;
  $cmp17 = ($24|0)<(5);
  if ($cmp17) {
   STACKTOP = sp;return;
  }
 }
 $25 = $m;
 $i = $25;
 while(1) {
  $26 = $i;
  $27 = $n$addr;
  $cmp22 = ($26|0)<($27|0);
  if (!($cmp22)) {
   break;
  }
  $28 = $da$addr;
  $29 = $dx$addr;
  $30 = $i;
  $arrayidx24 = (($29) + ($30<<3)|0);
  $31 = +HEAPF64[$arrayidx24>>3];
  $mul25 = $28 * $31;
  $32 = $dx$addr;
  $33 = $i;
  $arrayidx26 = (($32) + ($33<<3)|0);
  HEAPF64[$arrayidx26>>3] = $mul25;
  $34 = $da$addr;
  $35 = $dx$addr;
  $36 = $i;
  $add27 = (($36) + 1)|0;
  $arrayidx28 = (($35) + ($add27<<3)|0);
  $37 = +HEAPF64[$arrayidx28>>3];
  $mul29 = $34 * $37;
  $38 = $dx$addr;
  $39 = $i;
  $add30 = (($39) + 1)|0;
  $arrayidx31 = (($38) + ($add30<<3)|0);
  HEAPF64[$arrayidx31>>3] = $mul29;
  $40 = $da$addr;
  $41 = $dx$addr;
  $42 = $i;
  $add32 = (($42) + 2)|0;
  $arrayidx33 = (($41) + ($add32<<3)|0);
  $43 = +HEAPF64[$arrayidx33>>3];
  $mul34 = $40 * $43;
  $44 = $dx$addr;
  $45 = $i;
  $add35 = (($45) + 2)|0;
  $arrayidx36 = (($44) + ($add35<<3)|0);
  HEAPF64[$arrayidx36>>3] = $mul34;
  $46 = $da$addr;
  $47 = $dx$addr;
  $48 = $i;
  $add37 = (($48) + 3)|0;
  $arrayidx38 = (($47) + ($add37<<3)|0);
  $49 = +HEAPF64[$arrayidx38>>3];
  $mul39 = $46 * $49;
  $50 = $dx$addr;
  $51 = $i;
  $add40 = (($51) + 3)|0;
  $arrayidx41 = (($50) + ($add40<<3)|0);
  HEAPF64[$arrayidx41>>3] = $mul39;
  $52 = $da$addr;
  $53 = $dx$addr;
  $54 = $i;
  $add42 = (($54) + 4)|0;
  $arrayidx43 = (($53) + ($add42<<3)|0);
  $55 = +HEAPF64[$arrayidx43>>3];
  $mul44 = $52 * $55;
  $56 = $dx$addr;
  $57 = $i;
  $add45 = (($57) + 4)|0;
  $arrayidx46 = (($56) + ($add45<<3)|0);
  HEAPF64[$arrayidx46>>3] = $mul44;
  $58 = $i;
  $add48 = (($58) + 5)|0;
  $i = $add48;
 }
 STACKTOP = sp;return;
}
function _daxpy($n,$da,$dx,$incx,$dy,$incy) {
 $n = $n|0;
 $da = +$da;
 $dx = $dx|0;
 $incx = $incx|0;
 $dy = $dy|0;
 $incy = $incy|0;
 var $0 = 0, $1 = 0.0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0.0, $15 = 0.0, $16 = 0, $17 = 0, $18 = 0.0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0.0, $33 = 0.0, $34 = 0, $35 = 0, $36 = 0.0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0.0, $47 = 0.0, $48 = 0, $49 = 0, $5 = 0, $50 = 0.0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0.0, $57 = 0, $58 = 0, $59 = 0.0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0.0, $65 = 0.0, $66 = 0, $67 = 0, $68 = 0.0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0.0, $74 = 0.0, $75 = 0, $76 = 0, $77 = 0.0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $9 = 0, $add = 0, $add13 = 0, $add19 = 0.0, $add21 = 0, $add22 = 0, $add32 = 0.0, $add47 = 0.0, $add49 = 0, $add51 = 0, $add54 = 0.0, $add55 = 0, $add57 = 0, $add59 = 0, $add62 = 0.0, $add63 = 0, $add65 = 0, $add67 = 0, $add70 = 0.0, $add71 = 0;
 var $add74 = 0, $arrayidx = 0, $arrayidx17 = 0, $arrayidx20 = 0, $arrayidx29 = 0, $arrayidx30 = 0, $arrayidx33 = 0, $arrayidx44 = 0, $arrayidx45 = 0, $arrayidx48 = 0, $arrayidx50 = 0, $arrayidx52 = 0, $arrayidx56 = 0, $arrayidx58 = 0, $arrayidx60 = 0, $arrayidx64 = 0, $arrayidx66 = 0, $arrayidx68 = 0, $arrayidx72 = 0, $cmp = 0;
 var $cmp1 = 0, $cmp10 = 0, $cmp16 = 0, $cmp24 = 0, $cmp27 = 0, $cmp37 = 0, $cmp4 = 0, $cmp42 = 0, $cmp5 = 0, $cmp7 = 0, $da$addr = 0.0, $dx$addr = 0, $dy$addr = 0, $i = 0, $inc = 0, $inc35 = 0, $incx$addr = 0, $incy$addr = 0, $ix = 0, $iy = 0;
 var $m = 0, $mp1 = 0, $mul = 0, $mul14 = 0, $mul18 = 0.0, $mul31 = 0.0, $mul46 = 0.0, $mul53 = 0.0, $mul61 = 0.0, $mul69 = 0.0, $n$addr = 0, $or$cond = 0, $or$cond1 = 0, $rem = 0, $sub = 0, $sub12 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $n$addr = $n;
 $da$addr = $da;
 $dx$addr = $dx;
 $incx$addr = $incx;
 $dy$addr = $dy;
 $incy$addr = $incy;
 $mp1 = 0;
 $m = 0;
 $0 = $n$addr;
 $cmp = ($0|0)<=(0);
 $1 = $da$addr;
 $cmp1 = $1 == 0.0;
 $or$cond1 = $cmp | $cmp1;
 if ($or$cond1) {
  STACKTOP = sp;return;
 }
 $2 = $incx$addr;
 $cmp4 = ($2|0)!=(1);
 $3 = $incy$addr;
 $cmp5 = ($3|0)!=(1);
 $or$cond = $cmp4 | $cmp5;
 if ($or$cond) {
  $ix = 0;
  $iy = 0;
  $4 = $incx$addr;
  $cmp7 = ($4|0)<(0);
  if ($cmp7) {
   $5 = $n$addr;
   $sub = (0 - ($5))|0;
   $add = (($sub) + 1)|0;
   $6 = $incx$addr;
   $mul = Math_imul($add, $6)|0;
   $ix = $mul;
  }
  $7 = $incy$addr;
  $cmp10 = ($7|0)<(0);
  if ($cmp10) {
   $8 = $n$addr;
   $sub12 = (0 - ($8))|0;
   $add13 = (($sub12) + 1)|0;
   $9 = $incy$addr;
   $mul14 = Math_imul($add13, $9)|0;
   $iy = $mul14;
  }
  $i = 0;
  while(1) {
   $10 = $i;
   $11 = $n$addr;
   $cmp16 = ($10|0)<($11|0);
   if (!($cmp16)) {
    break;
   }
   $12 = $dy$addr;
   $13 = $iy;
   $arrayidx = (($12) + ($13<<3)|0);
   $14 = +HEAPF64[$arrayidx>>3];
   $15 = $da$addr;
   $16 = $dx$addr;
   $17 = $ix;
   $arrayidx17 = (($16) + ($17<<3)|0);
   $18 = +HEAPF64[$arrayidx17>>3];
   $mul18 = $15 * $18;
   $add19 = $14 + $mul18;
   $19 = $dy$addr;
   $20 = $iy;
   $arrayidx20 = (($19) + ($20<<3)|0);
   HEAPF64[$arrayidx20>>3] = $add19;
   $21 = $ix;
   $22 = $incx$addr;
   $add21 = (($21) + ($22))|0;
   $ix = $add21;
   $23 = $iy;
   $24 = $incy$addr;
   $add22 = (($23) + ($24))|0;
   $iy = $add22;
   $25 = $i;
   $inc = (($25) + 1)|0;
   $i = $inc;
  }
  STACKTOP = sp;return;
 }
 $26 = $n$addr;
 $rem = (($26|0) % 4)&-1;
 $m = $rem;
 $27 = $m;
 $cmp24 = ($27|0)!=(0);
 if ($cmp24) {
  $i = 0;
  while(1) {
   $28 = $i;
   $29 = $m;
   $cmp27 = ($28|0)<($29|0);
   if (!($cmp27)) {
    break;
   }
   $30 = $dy$addr;
   $31 = $i;
   $arrayidx29 = (($30) + ($31<<3)|0);
   $32 = +HEAPF64[$arrayidx29>>3];
   $33 = $da$addr;
   $34 = $dx$addr;
   $35 = $i;
   $arrayidx30 = (($34) + ($35<<3)|0);
   $36 = +HEAPF64[$arrayidx30>>3];
   $mul31 = $33 * $36;
   $add32 = $32 + $mul31;
   $37 = $dy$addr;
   $38 = $i;
   $arrayidx33 = (($37) + ($38<<3)|0);
   HEAPF64[$arrayidx33>>3] = $add32;
   $39 = $i;
   $inc35 = (($39) + 1)|0;
   $i = $inc35;
  }
  $40 = $n$addr;
  $cmp37 = ($40|0)<(4);
  if ($cmp37) {
   STACKTOP = sp;return;
  }
 }
 $41 = $m;
 $i = $41;
 while(1) {
  $42 = $i;
  $43 = $n$addr;
  $cmp42 = ($42|0)<($43|0);
  if (!($cmp42)) {
   break;
  }
  $44 = $dy$addr;
  $45 = $i;
  $arrayidx44 = (($44) + ($45<<3)|0);
  $46 = +HEAPF64[$arrayidx44>>3];
  $47 = $da$addr;
  $48 = $dx$addr;
  $49 = $i;
  $arrayidx45 = (($48) + ($49<<3)|0);
  $50 = +HEAPF64[$arrayidx45>>3];
  $mul46 = $47 * $50;
  $add47 = $46 + $mul46;
  $51 = $dy$addr;
  $52 = $i;
  $arrayidx48 = (($51) + ($52<<3)|0);
  HEAPF64[$arrayidx48>>3] = $add47;
  $53 = $dy$addr;
  $54 = $i;
  $add49 = (($54) + 1)|0;
  $arrayidx50 = (($53) + ($add49<<3)|0);
  $55 = +HEAPF64[$arrayidx50>>3];
  $56 = $da$addr;
  $57 = $dx$addr;
  $58 = $i;
  $add51 = (($58) + 1)|0;
  $arrayidx52 = (($57) + ($add51<<3)|0);
  $59 = +HEAPF64[$arrayidx52>>3];
  $mul53 = $56 * $59;
  $add54 = $55 + $mul53;
  $60 = $dy$addr;
  $61 = $i;
  $add55 = (($61) + 1)|0;
  $arrayidx56 = (($60) + ($add55<<3)|0);
  HEAPF64[$arrayidx56>>3] = $add54;
  $62 = $dy$addr;
  $63 = $i;
  $add57 = (($63) + 2)|0;
  $arrayidx58 = (($62) + ($add57<<3)|0);
  $64 = +HEAPF64[$arrayidx58>>3];
  $65 = $da$addr;
  $66 = $dx$addr;
  $67 = $i;
  $add59 = (($67) + 2)|0;
  $arrayidx60 = (($66) + ($add59<<3)|0);
  $68 = +HEAPF64[$arrayidx60>>3];
  $mul61 = $65 * $68;
  $add62 = $64 + $mul61;
  $69 = $dy$addr;
  $70 = $i;
  $add63 = (($70) + 2)|0;
  $arrayidx64 = (($69) + ($add63<<3)|0);
  HEAPF64[$arrayidx64>>3] = $add62;
  $71 = $dy$addr;
  $72 = $i;
  $add65 = (($72) + 3)|0;
  $arrayidx66 = (($71) + ($add65<<3)|0);
  $73 = +HEAPF64[$arrayidx66>>3];
  $74 = $da$addr;
  $75 = $dx$addr;
  $76 = $i;
  $add67 = (($76) + 3)|0;
  $arrayidx68 = (($75) + ($add67<<3)|0);
  $77 = +HEAPF64[$arrayidx68>>3];
  $mul69 = $74 * $77;
  $add70 = $73 + $mul69;
  $78 = $dy$addr;
  $79 = $i;
  $add71 = (($79) + 3)|0;
  $arrayidx72 = (($78) + ($add71<<3)|0);
  HEAPF64[$arrayidx72>>3] = $add70;
  $80 = $i;
  $add74 = (($80) + 4)|0;
  $i = $add74;
 }
 STACKTOP = sp;return;
}
function _ddot($n,$dx,$incx,$dy,$incy) {
 $n = $n|0;
 $dx = $dx|0;
 $incx = $incx|0;
 $dy = $dy|0;
 $incy = $incy|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0.0, $15 = 0, $16 = 0, $17 = 0.0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0.0, $28 = 0, $29 = 0, $3 = 0, $30 = 0.0, $31 = 0, $32 = 0, $33 = 0.0, $34 = 0, $35 = 0, $36 = 0.0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0.0, $41 = 0, $42 = 0, $43 = 0.0, $44 = 0;
 var $45 = 0, $46 = 0.0, $47 = 0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0, $51 = 0, $52 = 0.0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0, $57 = 0, $58 = 0.0, $59 = 0, $6 = 0, $60 = 0, $61 = 0.0, $62 = 0;
 var $63 = 0, $64 = 0.0, $65 = 0, $66 = 0, $67 = 0.0, $68 = 0, $69 = 0, $7 = 0, $70 = 0.0, $71 = 0, $72 = 0.0, $8 = 0, $9 = 0, $add = 0, $add10 = 0, $add16 = 0.0, $add17 = 0, $add18 = 0, $add28 = 0.0, $add42 = 0.0;
 var $add43 = 0, $add45 = 0, $add48 = 0.0, $add49 = 0, $add51 = 0, $add54 = 0.0, $add55 = 0, $add57 = 0, $add60 = 0.0, $add61 = 0, $add63 = 0, $add66 = 0.0, $add68 = 0, $arrayidx = 0, $arrayidx14 = 0, $arrayidx25 = 0, $arrayidx26 = 0, $arrayidx39 = 0, $arrayidx40 = 0, $arrayidx44 = 0;
 var $arrayidx46 = 0, $arrayidx50 = 0, $arrayidx52 = 0, $arrayidx56 = 0, $arrayidx58 = 0, $arrayidx62 = 0, $arrayidx64 = 0, $cmp = 0, $cmp1 = 0, $cmp13 = 0, $cmp2 = 0, $cmp20 = 0, $cmp23 = 0, $cmp32 = 0, $cmp37 = 0, $cmp4 = 0, $cmp7 = 0, $dtemp = 0.0, $dx$addr = 0, $dy$addr = 0;
 var $i = 0, $inc = 0, $inc30 = 0, $incx$addr = 0, $incy$addr = 0, $ix = 0, $iy = 0, $m = 0, $mp1 = 0, $mul = 0, $mul11 = 0, $mul15 = 0.0, $mul27 = 0.0, $mul41 = 0.0, $mul47 = 0.0, $mul53 = 0.0, $mul59 = 0.0, $mul65 = 0.0, $n$addr = 0, $or$cond = 0;
 var $rem = 0, $retval = 0.0, $sub = 0, $sub9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $n$addr = $n;
 $dx$addr = $dx;
 $incx$addr = $incx;
 $dy$addr = $dy;
 $incy$addr = $incy;
 $mp1 = 0;
 $m = 0;
 $dtemp = 0.0;
 $0 = $n$addr;
 $cmp = ($0|0)<=(0);
 if ($cmp) {
  $retval = 0.0;
  $72 = $retval;
  STACKTOP = sp;return (+$72);
 }
 $1 = $incx$addr;
 $cmp1 = ($1|0)!=(1);
 $2 = $incy$addr;
 $cmp2 = ($2|0)!=(1);
 $or$cond = $cmp1 | $cmp2;
 if ($or$cond) {
  $ix = 0;
  $iy = 0;
  $3 = $incx$addr;
  $cmp4 = ($3|0)<(0);
  if ($cmp4) {
   $4 = $n$addr;
   $sub = (0 - ($4))|0;
   $add = (($sub) + 1)|0;
   $5 = $incx$addr;
   $mul = Math_imul($add, $5)|0;
   $ix = $mul;
  }
  $6 = $incy$addr;
  $cmp7 = ($6|0)<(0);
  if ($cmp7) {
   $7 = $n$addr;
   $sub9 = (0 - ($7))|0;
   $add10 = (($sub9) + 1)|0;
   $8 = $incy$addr;
   $mul11 = Math_imul($add10, $8)|0;
   $iy = $mul11;
  }
  $i = 0;
  while(1) {
   $9 = $i;
   $10 = $n$addr;
   $cmp13 = ($9|0)<($10|0);
   $11 = $dtemp;
   if (!($cmp13)) {
    break;
   }
   $12 = $dx$addr;
   $13 = $ix;
   $arrayidx = (($12) + ($13<<3)|0);
   $14 = +HEAPF64[$arrayidx>>3];
   $15 = $dy$addr;
   $16 = $iy;
   $arrayidx14 = (($15) + ($16<<3)|0);
   $17 = +HEAPF64[$arrayidx14>>3];
   $mul15 = $14 * $17;
   $add16 = $11 + $mul15;
   $dtemp = $add16;
   $18 = $ix;
   $19 = $incx$addr;
   $add17 = (($18) + ($19))|0;
   $ix = $add17;
   $20 = $iy;
   $21 = $incy$addr;
   $add18 = (($20) + ($21))|0;
   $iy = $add18;
   $22 = $i;
   $inc = (($22) + 1)|0;
   $i = $inc;
  }
  $retval = $11;
  $72 = $retval;
  STACKTOP = sp;return (+$72);
 }
 $23 = $n$addr;
 $rem = (($23|0) % 5)&-1;
 $m = $rem;
 $24 = $m;
 $cmp20 = ($24|0)!=(0);
 if ($cmp20) {
  $i = 0;
  while(1) {
   $25 = $i;
   $26 = $m;
   $cmp23 = ($25|0)<($26|0);
   if (!($cmp23)) {
    break;
   }
   $27 = $dtemp;
   $28 = $dx$addr;
   $29 = $i;
   $arrayidx25 = (($28) + ($29<<3)|0);
   $30 = +HEAPF64[$arrayidx25>>3];
   $31 = $dy$addr;
   $32 = $i;
   $arrayidx26 = (($31) + ($32<<3)|0);
   $33 = +HEAPF64[$arrayidx26>>3];
   $mul27 = $30 * $33;
   $add28 = $27 + $mul27;
   $dtemp = $add28;
   $34 = $i;
   $inc30 = (($34) + 1)|0;
   $i = $inc30;
  }
  $35 = $n$addr;
  $cmp32 = ($35|0)<(5);
  if ($cmp32) {
   $36 = $dtemp;
   $retval = $36;
   $72 = $retval;
   STACKTOP = sp;return (+$72);
  }
 }
 $37 = $m;
 $i = $37;
 while(1) {
  $38 = $i;
  $39 = $n$addr;
  $cmp37 = ($38|0)<($39|0);
  $40 = $dtemp;
  if (!($cmp37)) {
   break;
  }
  $41 = $dx$addr;
  $42 = $i;
  $arrayidx39 = (($41) + ($42<<3)|0);
  $43 = +HEAPF64[$arrayidx39>>3];
  $44 = $dy$addr;
  $45 = $i;
  $arrayidx40 = (($44) + ($45<<3)|0);
  $46 = +HEAPF64[$arrayidx40>>3];
  $mul41 = $43 * $46;
  $add42 = $40 + $mul41;
  $47 = $dx$addr;
  $48 = $i;
  $add43 = (($48) + 1)|0;
  $arrayidx44 = (($47) + ($add43<<3)|0);
  $49 = +HEAPF64[$arrayidx44>>3];
  $50 = $dy$addr;
  $51 = $i;
  $add45 = (($51) + 1)|0;
  $arrayidx46 = (($50) + ($add45<<3)|0);
  $52 = +HEAPF64[$arrayidx46>>3];
  $mul47 = $49 * $52;
  $add48 = $add42 + $mul47;
  $53 = $dx$addr;
  $54 = $i;
  $add49 = (($54) + 2)|0;
  $arrayidx50 = (($53) + ($add49<<3)|0);
  $55 = +HEAPF64[$arrayidx50>>3];
  $56 = $dy$addr;
  $57 = $i;
  $add51 = (($57) + 2)|0;
  $arrayidx52 = (($56) + ($add51<<3)|0);
  $58 = +HEAPF64[$arrayidx52>>3];
  $mul53 = $55 * $58;
  $add54 = $add48 + $mul53;
  $59 = $dx$addr;
  $60 = $i;
  $add55 = (($60) + 3)|0;
  $arrayidx56 = (($59) + ($add55<<3)|0);
  $61 = +HEAPF64[$arrayidx56>>3];
  $62 = $dy$addr;
  $63 = $i;
  $add57 = (($63) + 3)|0;
  $arrayidx58 = (($62) + ($add57<<3)|0);
  $64 = +HEAPF64[$arrayidx58>>3];
  $mul59 = $61 * $64;
  $add60 = $add54 + $mul59;
  $65 = $dx$addr;
  $66 = $i;
  $add61 = (($66) + 4)|0;
  $arrayidx62 = (($65) + ($add61<<3)|0);
  $67 = +HEAPF64[$arrayidx62>>3];
  $68 = $dy$addr;
  $69 = $i;
  $add63 = (($69) + 4)|0;
  $arrayidx64 = (($68) + ($add63<<3)|0);
  $70 = +HEAPF64[$arrayidx64>>3];
  $mul65 = $67 * $70;
  $add66 = $add60 + $mul65;
  $dtemp = $add66;
  $71 = $i;
  $add68 = (($71) + 5)|0;
  $i = $add68;
 }
 $retval = $40;
 $72 = $retval;
 STACKTOP = sp;return (+$72);
}
function _emscripten_get_global_libc() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (650884|0);
}
function ___stdio_close($f) {
 $f = $f|0;
 var $0 = 0, $call = 0, $call1 = 0, $call2 = 0, $fd = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $fd = ((($f)) + 60|0);
 $0 = HEAP32[$fd>>2]|0;
 $call = (_dummy_570($0)|0);
 HEAP32[$vararg_buffer>>2] = $call;
 $call1 = (___syscall6(6,($vararg_buffer|0))|0);
 $call2 = (___syscall_ret($call1)|0);
 STACKTOP = sp;return ($call2|0);
}
function ___stdio_write($f,$buf,$len) {
 $f = $f|0;
 $buf = $buf|0;
 $len = $len|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $add = 0, $add$ptr = 0, $add$ptr32 = 0, $buf8 = 0, $buf_size = 0, $call = 0, $call40 = 0;
 var $call7 = 0, $call741 = 0, $call746 = 0, $cmp = 0, $cmp12 = 0, $cmp17 = 0, $cmp24 = 0, $cmp42 = 0, $cnt$0 = 0, $dec = 0, $fd = 0, $incdec$ptr = 0, $iov$043 = 0, $iov$1 = 0, $iov_base2 = 0, $iov_len = 0, $iov_len19 = 0, $iov_len23 = 0, $iov_len3 = 0, $iov_len36 = 0;
 var $iovcnt$045 = 0, $iovcnt$1 = 0, $iovs = 0, $or = 0, $rem$044 = 0, $retval$0 = 0, $sub = 0, $sub$ptr$sub = 0, $sub21 = 0, $sub28 = 0, $sub37 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, $wbase = 0, $wend = 0, $wend14 = 0;
 var $wpos = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $iovs = sp + 32|0;
 $wbase = ((($f)) + 28|0);
 $0 = HEAP32[$wbase>>2]|0;
 HEAP32[$iovs>>2] = $0;
 $iov_len = ((($iovs)) + 4|0);
 $wpos = ((($f)) + 20|0);
 $1 = HEAP32[$wpos>>2]|0;
 $sub$ptr$sub = (($1) - ($0))|0;
 HEAP32[$iov_len>>2] = $sub$ptr$sub;
 $iov_base2 = ((($iovs)) + 8|0);
 HEAP32[$iov_base2>>2] = $buf;
 $iov_len3 = ((($iovs)) + 12|0);
 HEAP32[$iov_len3>>2] = $len;
 $add = (($sub$ptr$sub) + ($len))|0;
 $fd = ((($f)) + 60|0);
 $2 = HEAP32[$fd>>2]|0;
 $3 = $iovs;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = 2;
 $call40 = (___syscall146(146,($vararg_buffer|0))|0);
 $call741 = (___syscall_ret($call40)|0);
 $cmp42 = ($add|0)==($call741|0);
 L1: do {
  if ($cmp42) {
   label = 3;
  } else {
   $call746 = $call741;$iov$043 = $iovs;$iovcnt$045 = 2;$rem$044 = $add;
   while(1) {
    $cmp12 = ($call746|0)<(0);
    if ($cmp12) {
     break;
    }
    $sub21 = (($rem$044) - ($call746))|0;
    $iov_len23 = ((($iov$043)) + 4|0);
    $8 = HEAP32[$iov_len23>>2]|0;
    $cmp24 = ($call746>>>0)>($8>>>0);
    $incdec$ptr = ((($iov$043)) + 8|0);
    $iov$1 = $cmp24 ? $incdec$ptr : $iov$043;
    $dec = $cmp24 << 31 >> 31;
    $iovcnt$1 = (($dec) + ($iovcnt$045))|0;
    $sub28 = $cmp24 ? $8 : 0;
    $cnt$0 = (($call746) - ($sub28))|0;
    $9 = HEAP32[$iov$1>>2]|0;
    $add$ptr32 = (($9) + ($cnt$0)|0);
    HEAP32[$iov$1>>2] = $add$ptr32;
    $iov_len36 = ((($iov$1)) + 4|0);
    $10 = HEAP32[$iov_len36>>2]|0;
    $sub37 = (($10) - ($cnt$0))|0;
    HEAP32[$iov_len36>>2] = $sub37;
    $11 = HEAP32[$fd>>2]|0;
    $12 = $iov$1;
    HEAP32[$vararg_buffer3>>2] = $11;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $12;
    $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
    HEAP32[$vararg_ptr7>>2] = $iovcnt$1;
    $call = (___syscall146(146,($vararg_buffer3|0))|0);
    $call7 = (___syscall_ret($call)|0);
    $cmp = ($sub21|0)==($call7|0);
    if ($cmp) {
     label = 3;
     break L1;
    } else {
     $call746 = $call7;$iov$043 = $iov$1;$iovcnt$045 = $iovcnt$1;$rem$044 = $sub21;
    }
   }
   $wend14 = ((($f)) + 16|0);
   HEAP32[$wend14>>2] = 0;
   HEAP32[$wbase>>2] = 0;
   HEAP32[$wpos>>2] = 0;
   $6 = HEAP32[$f>>2]|0;
   $or = $6 | 32;
   HEAP32[$f>>2] = $or;
   $cmp17 = ($iovcnt$045|0)==(2);
   if ($cmp17) {
    $retval$0 = 0;
   } else {
    $iov_len19 = ((($iov$043)) + 4|0);
    $7 = HEAP32[$iov_len19>>2]|0;
    $sub = (($len) - ($7))|0;
    $retval$0 = $sub;
   }
  }
 } while(0);
 if ((label|0) == 3) {
  $buf8 = ((($f)) + 44|0);
  $4 = HEAP32[$buf8>>2]|0;
  $buf_size = ((($f)) + 48|0);
  $5 = HEAP32[$buf_size>>2]|0;
  $add$ptr = (($4) + ($5)|0);
  $wend = ((($f)) + 16|0);
  HEAP32[$wend>>2] = $add$ptr;
  HEAP32[$wbase>>2] = $4;
  HEAP32[$wpos>>2] = $4;
  $retval$0 = $len;
 }
 STACKTOP = sp;return ($retval$0|0);
}
function ___stdio_seek($f,$off,$whence) {
 $f = $f|0;
 $off = $off|0;
 $whence = $whence|0;
 var $$pre = 0, $0 = 0, $1 = 0, $2 = 0, $call = 0, $call1 = 0, $cmp = 0, $fd = 0, $ret = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $ret = sp + 20|0;
 $fd = ((($f)) + 60|0);
 $0 = HEAP32[$fd>>2]|0;
 $1 = $ret;
 HEAP32[$vararg_buffer>>2] = $0;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $off;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $1;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $whence;
 $call = (___syscall140(140,($vararg_buffer|0))|0);
 $call1 = (___syscall_ret($call)|0);
 $cmp = ($call1|0)<(0);
 if ($cmp) {
  HEAP32[$ret>>2] = -1;
  $2 = -1;
 } else {
  $$pre = HEAP32[$ret>>2]|0;
  $2 = $$pre;
 }
 STACKTOP = sp;return ($2|0);
}
function ___syscall_ret($r) {
 $r = $r|0;
 var $call = 0, $cmp = 0, $retval$0 = 0, $sub = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $cmp = ($r>>>0)>(4294963200);
 if ($cmp) {
  $sub = (0 - ($r))|0;
  $call = (___errno_location()|0);
  HEAP32[$call>>2] = $sub;
  $retval$0 = -1;
 } else {
  $retval$0 = $r;
 }
 return ($retval$0|0);
}
function ___errno_location() {
 var $call = 0, $errno_val = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $call = (___pthread_self_103()|0);
 $errno_val = ((($call)) + 64|0);
 return ($errno_val|0);
}
function ___pthread_self_103() {
 var $call = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $call = (_pthread_self()|0);
 return ($call|0);
}
function _pthread_self() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (16|0);
}
function _dummy_570($fd) {
 $fd = $fd|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($fd|0);
}
function ___stdout_write($f,$buf,$len) {
 $f = $f|0;
 $buf = $buf|0;
 $len = $len|0;
 var $0 = 0, $1 = 0, $2 = 0, $and = 0, $call = 0, $call3 = 0, $fd = 0, $lbf = 0, $tobool = 0, $tobool2 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $write = 0, $wsz = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $wsz = sp + 16|0;
 $write = ((($f)) + 36|0);
 HEAP32[$write>>2] = 5;
 $0 = HEAP32[$f>>2]|0;
 $and = $0 & 64;
 $tobool = ($and|0)==(0);
 if ($tobool) {
  $fd = ((($f)) + 60|0);
  $1 = HEAP32[$fd>>2]|0;
  $2 = $wsz;
  HEAP32[$vararg_buffer>>2] = $1;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21523;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $2;
  $call = (___syscall54(54,($vararg_buffer|0))|0);
  $tobool2 = ($call|0)==(0);
  if (!($tobool2)) {
   $lbf = ((($f)) + 75|0);
   HEAP8[$lbf>>0] = -1;
  }
 }
 $call3 = (___stdio_write($f,$buf,$len)|0);
 STACKTOP = sp;return ($call3|0);
}
function _strtox_742($s,$p,$base,$0,$1) {
 $s = $s|0;
 $p = $p|0;
 $base = $base|0;
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $add = 0, $add$ptr = 0, $add$ptr$sink = 0, $add$ptr5 = 0, $buf = 0, $cmp = 0, $f = 0, $lock = 0, $rend1 = 0, $rpos = 0, $shcnt = 0, $sub$ptr$sub = 0, $tobool = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $f = sp;
 HEAP32[$f>>2] = 0;
 $rpos = ((($f)) + 4|0);
 HEAP32[$rpos>>2] = $s;
 $buf = ((($f)) + 44|0);
 HEAP32[$buf>>2] = $s;
 $cmp = ($s|0)<(0|0);
 $add$ptr = ((($s)) + 2147483647|0);
 $add$ptr$sink = $cmp ? (-1) : $add$ptr;
 $rend1 = ((($f)) + 8|0);
 HEAP32[$rend1>>2] = $add$ptr$sink;
 $lock = ((($f)) + 76|0);
 HEAP32[$lock>>2] = -1;
 ___shlim($f,0);
 $2 = (___intscan($f,$base,1,$0,$1)|0);
 $3 = tempRet0;
 $tobool = ($p|0)==(0|0);
 if (!($tobool)) {
  $shcnt = ((($f)) + 108|0);
  $4 = HEAP32[$shcnt>>2]|0;
  $5 = HEAP32[$rpos>>2]|0;
  $6 = HEAP32[$rend1>>2]|0;
  $sub$ptr$sub = (($5) + ($4))|0;
  $add = (($sub$ptr$sub) - ($6))|0;
  $add$ptr5 = (($s) + ($add)|0);
  HEAP32[$p>>2] = $add$ptr5;
 }
 tempRet0 = ($3);
 STACKTOP = sp;return ($2|0);
}
function ___shlim($f,$lim) {
 $f = $f|0;
 $lim = $lim|0;
 var $$sink = 0, $0 = 0, $1 = 0, $add$ptr = 0, $cmp = 0, $or$cond = 0, $rend = 0, $rpos = 0, $shcnt = 0, $shend4 = 0, $shlim = 0, $sub$ptr$lhs$cast = 0, $sub$ptr$rhs$cast = 0, $sub$ptr$sub = 0, $tobool = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $shlim = ((($f)) + 104|0);
 HEAP32[$shlim>>2] = $lim;
 $rend = ((($f)) + 8|0);
 $0 = HEAP32[$rend>>2]|0;
 $rpos = ((($f)) + 4|0);
 $1 = HEAP32[$rpos>>2]|0;
 $sub$ptr$lhs$cast = $0;
 $sub$ptr$rhs$cast = $1;
 $sub$ptr$sub = (($sub$ptr$lhs$cast) - ($sub$ptr$rhs$cast))|0;
 $shcnt = ((($f)) + 108|0);
 HEAP32[$shcnt>>2] = $sub$ptr$sub;
 $tobool = ($lim|0)!=(0);
 $cmp = ($sub$ptr$sub|0)>($lim|0);
 $or$cond = $tobool & $cmp;
 $add$ptr = (($1) + ($lim)|0);
 $$sink = $or$cond ? $add$ptr : $0;
 $shend4 = ((($f)) + 100|0);
 HEAP32[$shend4>>2] = $$sink;
 return;
}
function ___intscan($f,$base,$pok,$0,$1) {
 $f = $f|0;
 $base = $base|0;
 $pok = $pok|0;
 $0 = $0|0;
 $1 = $1|0;
 var $$base132 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0;
 var $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0;
 var $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0;
 var $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0;
 var $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0;
 var $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $add = 0, $add249 = 0, $and = 0;
 var $and174 = 0, $arrayidx = 0, $arrayidx175 = 0, $arrayidx178 = 0, $arrayidx178157 = 0, $arrayidx206 = 0, $arrayidx237 = 0, $arrayidx237175 = 0, $arrayidx266 = 0, $arrayidx305 = 0, $arrayidx311 = 0, $arrayidx93 = 0, $base$addr$1 = 0, $base$addr$1134 = 0, $base$addr$1135 = 0, $c$0 = 0, $c$1 = 0, $c$1136 = 0, $c$2$be = 0, $c$2$lcssa = 0;
 var $c$3$be = 0, $c$3184 = 0, $c$4$be = 0, $c$4$lcssa = 0, $c$5$be = 0, $c$6$be = 0, $c$6$lcssa = 0, $c$7$be = 0, $c$7167 = 0, $c$8 = 0, $c$9$be = 0, $call = 0, $call105 = 0, $call126 = 0, $call160 = 0, $call200 = 0, $call21 = 0, $call231 = 0, $call260 = 0, $call299 = 0;
 var $call3 = 0, $call326 = 0, $call330 = 0, $call351 = 0, $call357 = 0, $call4 = 0, $call42 = 0, $call57 = 0, $cmp = 0, $cmp1 = 0, $cmp108 = 0, $cmp112 = 0, $cmp112191 = 0, $cmp114 = 0, $cmp119 = 0, $cmp132 = 0, $cmp132183 = 0, $cmp14 = 0, $cmp153 = 0, $cmp165 = 0;
 var $cmp180 = 0, $cmp180159 = 0, $cmp183 = 0, $cmp193 = 0, $cmp208 = 0, $cmp208152 = 0, $cmp224 = 0, $cmp239 = 0, $cmp239177 = 0, $cmp242 = 0, $cmp25 = 0, $cmp253 = 0, $cmp268 = 0, $cmp268166 = 0, $cmp292 = 0, $cmp30 = 0, $cmp307 = 0, $cmp313 = 0, $cmp319 = 0, $cmp35 = 0;
 var $cmp45 = 0, $cmp50 = 0, $cmp61 = 0, $cmp7 = 0, $cmp95 = 0, $cond = 0, $cond44 = 0, $cond59 = 0, $conv = 0, $conv124 = 0, $conv158 = 0, $conv176 = 0, $conv179 = 0, $conv179158 = 0, $conv179161 = 0, $conv19 = 0, $conv198 = 0, $conv207 = 0, $conv207151 = 0, $conv229 = 0;
 var $conv238 = 0, $conv238176 = 0, $conv238179 = 0, $conv258 = 0, $conv267 = 0, $conv267165 = 0, $conv297 = 0, $conv306 = 0, $conv312 = 0, $conv324 = 0, $conv40 = 0, $conv55 = 0, $conv94 = 0, $incdec$ptr = 0, $incdec$ptr102 = 0, $incdec$ptr123 = 0, $incdec$ptr157 = 0, $incdec$ptr18 = 0, $incdec$ptr197 = 0, $incdec$ptr228 = 0;
 var $incdec$ptr257 = 0, $incdec$ptr296 = 0, $incdec$ptr323 = 0, $incdec$ptr340 = 0, $incdec$ptr39 = 0, $incdec$ptr54 = 0, $incdec$ptr68 = 0, $incdec$ptr77 = 0, $mul = 0, $mul173 = 0, $mul246 = 0, $neg$0 = 0, $neg$0$ = 0, $neg$1 = 0, $or = 0, $or$cond = 0, $or$cond154 = 0, $or$cond2 = 0, $or$cond3 = 0, $or$cond5 = 0;
 var $or189 = 0, $rpos = 0, $shend = 0, $shl = 0, $shr = 0, $sub = 0, $sub111 = 0, $sub111190 = 0, $sub111193 = 0, $sub131 = 0, $sub131182 = 0, $sub131186 = 0, $sub170 = 0, $tobool = 0, $tobool171 = 0, $tobool337 = 0, $tobool349 = 0, $tobool65 = 0, $tobool71 = 0, $tobool99 = 0;
 var $x$0192 = 0, $x$1160 = 0, $x$2178 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $cmp = ($base>>>0)>(36);
 L1: do {
  if ($cmp) {
   $call = (___errno_location()|0);
   HEAP32[$call>>2] = 22;
   $150 = 0;$151 = 0;
  } else {
   $rpos = ((($f)) + 4|0);
   $shend = ((($f)) + 100|0);
   while(1) {
    $2 = HEAP32[$rpos>>2]|0;
    $3 = HEAP32[$shend>>2]|0;
    $cmp1 = ($2>>>0)<($3>>>0);
    if ($cmp1) {
     $incdec$ptr = ((($2)) + 1|0);
     HEAP32[$rpos>>2] = $incdec$ptr;
     $4 = HEAP8[$2>>0]|0;
     $conv = $4&255;
     $cond = $conv;
    } else {
     $call3 = (___shgetc($f)|0);
     $cond = $call3;
    }
    $call4 = (_isspace($cond)|0);
    $tobool = ($call4|0)==(0);
    if ($tobool) {
     break;
    }
   }
   L11: do {
    switch ($cond|0) {
    case 43: case 45:  {
     $cmp7 = ($cond|0)==(45);
     $sub = $cmp7 << 31 >> 31;
     $5 = HEAP32[$rpos>>2]|0;
     $6 = HEAP32[$shend>>2]|0;
     $cmp14 = ($5>>>0)<($6>>>0);
     if ($cmp14) {
      $incdec$ptr18 = ((($5)) + 1|0);
      HEAP32[$rpos>>2] = $incdec$ptr18;
      $7 = HEAP8[$5>>0]|0;
      $conv19 = $7&255;
      $c$0 = $conv19;$neg$0 = $sub;
      break L11;
     } else {
      $call21 = (___shgetc($f)|0);
      $c$0 = $call21;$neg$0 = $sub;
      break L11;
     }
     break;
    }
    default: {
     $c$0 = $cond;$neg$0 = 0;
    }
    }
   } while(0);
   $cmp25 = ($base|0)==(0);
   $8 = $base | 16;
   $9 = ($8|0)==(16);
   $cmp30 = ($c$0|0)==(48);
   $or$cond2 = $9 & $cmp30;
   do {
    if ($or$cond2) {
     $10 = HEAP32[$rpos>>2]|0;
     $11 = HEAP32[$shend>>2]|0;
     $cmp35 = ($10>>>0)<($11>>>0);
     if ($cmp35) {
      $incdec$ptr39 = ((($10)) + 1|0);
      HEAP32[$rpos>>2] = $incdec$ptr39;
      $12 = HEAP8[$10>>0]|0;
      $conv40 = $12&255;
      $cond44 = $conv40;
     } else {
      $call42 = (___shgetc($f)|0);
      $cond44 = $call42;
     }
     $or = $cond44 | 32;
     $cmp45 = ($or|0)==(120);
     if (!($cmp45)) {
      if ($cmp25) {
       $base$addr$1135 = 8;$c$1136 = $cond44;
       label = 46;
       break;
      } else {
       $base$addr$1 = $base;$c$1 = $cond44;
       label = 32;
       break;
      }
     }
     $13 = HEAP32[$rpos>>2]|0;
     $14 = HEAP32[$shend>>2]|0;
     $cmp50 = ($13>>>0)<($14>>>0);
     if ($cmp50) {
      $incdec$ptr54 = ((($13)) + 1|0);
      HEAP32[$rpos>>2] = $incdec$ptr54;
      $15 = HEAP8[$13>>0]|0;
      $conv55 = $15&255;
      $cond59 = $conv55;
     } else {
      $call57 = (___shgetc($f)|0);
      $cond59 = $call57;
     }
     $arrayidx = ((1477) + ($cond59)|0);
     $16 = HEAP8[$arrayidx>>0]|0;
     $cmp61 = ($16&255)>(15);
     if ($cmp61) {
      $17 = HEAP32[$shend>>2]|0;
      $tobool65 = ($17|0)!=(0|0);
      if ($tobool65) {
       $18 = HEAP32[$rpos>>2]|0;
       $incdec$ptr68 = ((($18)) + -1|0);
       HEAP32[$rpos>>2] = $incdec$ptr68;
      }
      $tobool71 = ($pok|0)==(0);
      if ($tobool71) {
       ___shlim($f,0);
       $150 = 0;$151 = 0;
       break L1;
      }
      if (!($tobool65)) {
       $150 = 0;$151 = 0;
       break L1;
      }
      $19 = HEAP32[$rpos>>2]|0;
      $incdec$ptr77 = ((($19)) + -1|0);
      HEAP32[$rpos>>2] = $incdec$ptr77;
      $150 = 0;$151 = 0;
      break L1;
     } else {
      $base$addr$1135 = 16;$c$1136 = $cond59;
      label = 46;
     }
    } else {
     $$base132 = $cmp25 ? 10 : $base;
     $arrayidx93 = ((1477) + ($c$0)|0);
     $20 = HEAP8[$arrayidx93>>0]|0;
     $conv94 = $20&255;
     $cmp95 = ($conv94>>>0)<($$base132>>>0);
     if ($cmp95) {
      $base$addr$1 = $$base132;$c$1 = $c$0;
      label = 32;
     } else {
      $21 = HEAP32[$shend>>2]|0;
      $tobool99 = ($21|0)==(0|0);
      if (!($tobool99)) {
       $22 = HEAP32[$rpos>>2]|0;
       $incdec$ptr102 = ((($22)) + -1|0);
       HEAP32[$rpos>>2] = $incdec$ptr102;
      }
      ___shlim($f,0);
      $call105 = (___errno_location()|0);
      HEAP32[$call105>>2] = 22;
      $150 = 0;$151 = 0;
      break L1;
     }
    }
   } while(0);
   L43: do {
    if ((label|0) == 32) {
     $cmp108 = ($base$addr$1|0)==(10);
     if ($cmp108) {
      $sub111190 = (($c$1) + -48)|0;
      $cmp112191 = ($sub111190>>>0)<(10);
      if ($cmp112191) {
       $sub111193 = $sub111190;$x$0192 = 0;
       while(1) {
        $mul = ($x$0192*10)|0;
        $add = (($mul) + ($sub111193))|0;
        $23 = HEAP32[$rpos>>2]|0;
        $24 = HEAP32[$shend>>2]|0;
        $cmp119 = ($23>>>0)<($24>>>0);
        if ($cmp119) {
         $incdec$ptr123 = ((($23)) + 1|0);
         HEAP32[$rpos>>2] = $incdec$ptr123;
         $25 = HEAP8[$23>>0]|0;
         $conv124 = $25&255;
         $c$2$be = $conv124;
        } else {
         $call126 = (___shgetc($f)|0);
         $c$2$be = $call126;
        }
        $sub111 = (($c$2$be) + -48)|0;
        $cmp112 = ($sub111>>>0)<(10);
        $cmp114 = ($add>>>0)<(429496729);
        $26 = $cmp112 & $cmp114;
        if ($26) {
         $sub111193 = $sub111;$x$0192 = $add;
        } else {
         break;
        }
       }
       $152 = $add;$153 = 0;$c$2$lcssa = $c$2$be;
      } else {
       $152 = 0;$153 = 0;$c$2$lcssa = $c$1;
      }
      $sub131182 = (($c$2$lcssa) + -48)|0;
      $cmp132183 = ($sub131182>>>0)<(10);
      if ($cmp132183) {
       $27 = $152;$28 = $153;$c$3184 = $c$2$lcssa;$sub131186 = $sub131182;
       while(1) {
        $29 = (___muldi3(($27|0),($28|0),10,0)|0);
        $30 = tempRet0;
        $31 = ($sub131186|0)<(0);
        $32 = $31 << 31 >> 31;
        $33 = $sub131186 ^ -1;
        $34 = $32 ^ -1;
        $35 = ($30>>>0)>($34>>>0);
        $36 = ($29>>>0)>($33>>>0);
        $37 = ($30|0)==($34|0);
        $38 = $37 & $36;
        $39 = $35 | $38;
        if ($39) {
         $154 = $27;$155 = $28;$base$addr$1134 = 10;$c$8 = $c$3184;
         label = 72;
         break L43;
        }
        $40 = (_i64Add(($29|0),($30|0),($sub131186|0),($32|0))|0);
        $41 = tempRet0;
        $42 = HEAP32[$rpos>>2]|0;
        $43 = HEAP32[$shend>>2]|0;
        $cmp153 = ($42>>>0)<($43>>>0);
        if ($cmp153) {
         $incdec$ptr157 = ((($42)) + 1|0);
         HEAP32[$rpos>>2] = $incdec$ptr157;
         $44 = HEAP8[$42>>0]|0;
         $conv158 = $44&255;
         $c$3$be = $conv158;
        } else {
         $call160 = (___shgetc($f)|0);
         $c$3$be = $call160;
        }
        $sub131 = (($c$3$be) + -48)|0;
        $cmp132 = ($sub131>>>0)<(10);
        $45 = ($41>>>0)<(429496729);
        $46 = ($40>>>0)<(2576980378);
        $47 = ($41|0)==(429496729);
        $48 = $47 & $46;
        $49 = $45 | $48;
        $or$cond3 = $cmp132 & $49;
        if ($or$cond3) {
         $27 = $40;$28 = $41;$c$3184 = $c$3$be;$sub131186 = $sub131;
        } else {
         break;
        }
       }
       $cmp165 = ($sub131>>>0)>(9);
       if ($cmp165) {
        $127 = $41;$129 = $40;$neg$1 = $neg$0;
       } else {
        $154 = $40;$155 = $41;$base$addr$1134 = 10;$c$8 = $c$3$be;
        label = 72;
       }
      } else {
       $127 = $153;$129 = $152;$neg$1 = $neg$0;
      }
     } else {
      $base$addr$1135 = $base$addr$1;$c$1136 = $c$1;
      label = 46;
     }
    }
   } while(0);
   L63: do {
    if ((label|0) == 46) {
     $sub170 = (($base$addr$1135) + -1)|0;
     $and = $sub170 & $base$addr$1135;
     $tobool171 = ($and|0)==(0);
     if ($tobool171) {
      $mul173 = ($base$addr$1135*23)|0;
      $shr = $mul173 >>> 5;
      $and174 = $shr & 7;
      $arrayidx175 = (1733 + ($and174)|0);
      $51 = HEAP8[$arrayidx175>>0]|0;
      $conv176 = $51 << 24 >> 24;
      $arrayidx178157 = ((1477) + ($c$1136)|0);
      $52 = HEAP8[$arrayidx178157>>0]|0;
      $conv179158 = $52&255;
      $cmp180159 = ($conv179158>>>0)<($base$addr$1135>>>0);
      if ($cmp180159) {
       $conv179161 = $conv179158;$x$1160 = 0;
       while(1) {
        $shl = $x$1160 << $conv176;
        $or189 = $conv179161 | $shl;
        $53 = HEAP32[$rpos>>2]|0;
        $54 = HEAP32[$shend>>2]|0;
        $cmp193 = ($53>>>0)<($54>>>0);
        if ($cmp193) {
         $incdec$ptr197 = ((($53)) + 1|0);
         HEAP32[$rpos>>2] = $incdec$ptr197;
         $55 = HEAP8[$53>>0]|0;
         $conv198 = $55&255;
         $c$4$be = $conv198;
        } else {
         $call200 = (___shgetc($f)|0);
         $c$4$be = $call200;
        }
        $arrayidx178 = ((1477) + ($c$4$be)|0);
        $56 = HEAP8[$arrayidx178>>0]|0;
        $conv179 = $56&255;
        $cmp180 = ($conv179>>>0)<($base$addr$1135>>>0);
        $cmp183 = ($or189>>>0)<(134217728);
        $57 = $cmp183 & $cmp180;
        if ($57) {
         $conv179161 = $conv179;$x$1160 = $or189;
        } else {
         break;
        }
       }
       $60 = $56;$62 = 0;$64 = $or189;$c$4$lcssa = $c$4$be;
      } else {
       $60 = $52;$62 = 0;$64 = 0;$c$4$lcssa = $c$1136;
      }
      $58 = (_bitshift64Lshr(-1,-1,($conv176|0))|0);
      $59 = tempRet0;
      $conv207151 = $60&255;
      $cmp208152 = ($conv207151>>>0)>=($base$addr$1135>>>0);
      $61 = ($62>>>0)>($59>>>0);
      $63 = ($64>>>0)>($58>>>0);
      $65 = ($62|0)==($59|0);
      $66 = $65 & $63;
      $67 = $61 | $66;
      $or$cond154 = $cmp208152 | $67;
      if ($or$cond154) {
       $154 = $64;$155 = $62;$base$addr$1134 = $base$addr$1135;$c$8 = $c$4$lcssa;
       label = 72;
       break;
      } else {
       $68 = $64;$69 = $62;$73 = $60;
      }
      while(1) {
       $70 = (_bitshift64Shl(($68|0),($69|0),($conv176|0))|0);
       $71 = tempRet0;
       $72 = $73&255;
       $74 = $72 | $70;
       $75 = HEAP32[$rpos>>2]|0;
       $76 = HEAP32[$shend>>2]|0;
       $cmp224 = ($75>>>0)<($76>>>0);
       if ($cmp224) {
        $incdec$ptr228 = ((($75)) + 1|0);
        HEAP32[$rpos>>2] = $incdec$ptr228;
        $77 = HEAP8[$75>>0]|0;
        $conv229 = $77&255;
        $c$5$be = $conv229;
       } else {
        $call231 = (___shgetc($f)|0);
        $c$5$be = $call231;
       }
       $arrayidx206 = ((1477) + ($c$5$be)|0);
       $78 = HEAP8[$arrayidx206>>0]|0;
       $conv207 = $78&255;
       $cmp208 = ($conv207>>>0)>=($base$addr$1135>>>0);
       $79 = ($71>>>0)>($59>>>0);
       $80 = ($74>>>0)>($58>>>0);
       $81 = ($71|0)==($59|0);
       $82 = $81 & $80;
       $83 = $79 | $82;
       $or$cond = $cmp208 | $83;
       if ($or$cond) {
        $154 = $74;$155 = $71;$base$addr$1134 = $base$addr$1135;$c$8 = $c$5$be;
        label = 72;
        break L63;
       } else {
        $68 = $74;$69 = $71;$73 = $78;
       }
      }
     }
     $arrayidx237175 = ((1477) + ($c$1136)|0);
     $50 = HEAP8[$arrayidx237175>>0]|0;
     $conv238176 = $50&255;
     $cmp239177 = ($conv238176>>>0)<($base$addr$1135>>>0);
     if ($cmp239177) {
      $conv238179 = $conv238176;$x$2178 = 0;
      while(1) {
       $mul246 = Math_imul($x$2178, $base$addr$1135)|0;
       $add249 = (($conv238179) + ($mul246))|0;
       $84 = HEAP32[$rpos>>2]|0;
       $85 = HEAP32[$shend>>2]|0;
       $cmp253 = ($84>>>0)<($85>>>0);
       if ($cmp253) {
        $incdec$ptr257 = ((($84)) + 1|0);
        HEAP32[$rpos>>2] = $incdec$ptr257;
        $86 = HEAP8[$84>>0]|0;
        $conv258 = $86&255;
        $c$6$be = $conv258;
       } else {
        $call260 = (___shgetc($f)|0);
        $c$6$be = $call260;
       }
       $arrayidx237 = ((1477) + ($c$6$be)|0);
       $87 = HEAP8[$arrayidx237>>0]|0;
       $conv238 = $87&255;
       $cmp239 = ($conv238>>>0)<($base$addr$1135>>>0);
       $cmp242 = ($add249>>>0)<(119304647);
       $88 = $cmp242 & $cmp239;
       if ($88) {
        $conv238179 = $conv238;$x$2178 = $add249;
       } else {
        break;
       }
      }
      $156 = $add249;$157 = 0;$89 = $87;$c$6$lcssa = $c$6$be;
     } else {
      $156 = 0;$157 = 0;$89 = $50;$c$6$lcssa = $c$1136;
     }
     $conv267165 = $89&255;
     $cmp268166 = ($conv267165>>>0)<($base$addr$1135>>>0);
     if ($cmp268166) {
      $90 = (___udivdi3(-1,-1,($base$addr$1135|0),0)|0);
      $91 = tempRet0;
      $102 = $89;$93 = $157;$95 = $156;$c$7167 = $c$6$lcssa;
      while(1) {
       $92 = ($93>>>0)>($91>>>0);
       $94 = ($95>>>0)>($90>>>0);
       $96 = ($93|0)==($91|0);
       $97 = $96 & $94;
       $98 = $92 | $97;
       if ($98) {
        $154 = $95;$155 = $93;$base$addr$1134 = $base$addr$1135;$c$8 = $c$7167;
        label = 72;
        break L63;
       }
       $99 = (___muldi3(($95|0),($93|0),($base$addr$1135|0),0)|0);
       $100 = tempRet0;
       $101 = $102&255;
       $103 = $101 ^ -1;
       $104 = ($100>>>0)>(4294967295);
       $105 = ($99>>>0)>($103>>>0);
       $106 = ($100|0)==(-1);
       $107 = $106 & $105;
       $108 = $104 | $107;
       if ($108) {
        $154 = $95;$155 = $93;$base$addr$1134 = $base$addr$1135;$c$8 = $c$7167;
        label = 72;
        break L63;
       }
       $109 = (_i64Add(($101|0),0,($99|0),($100|0))|0);
       $110 = tempRet0;
       $111 = HEAP32[$rpos>>2]|0;
       $112 = HEAP32[$shend>>2]|0;
       $cmp292 = ($111>>>0)<($112>>>0);
       if ($cmp292) {
        $incdec$ptr296 = ((($111)) + 1|0);
        HEAP32[$rpos>>2] = $incdec$ptr296;
        $113 = HEAP8[$111>>0]|0;
        $conv297 = $113&255;
        $c$7$be = $conv297;
       } else {
        $call299 = (___shgetc($f)|0);
        $c$7$be = $call299;
       }
       $arrayidx266 = ((1477) + ($c$7$be)|0);
       $114 = HEAP8[$arrayidx266>>0]|0;
       $conv267 = $114&255;
       $cmp268 = ($conv267>>>0)<($base$addr$1135>>>0);
       if ($cmp268) {
        $102 = $114;$93 = $110;$95 = $109;$c$7167 = $c$7$be;
       } else {
        $154 = $109;$155 = $110;$base$addr$1134 = $base$addr$1135;$c$8 = $c$7$be;
        label = 72;
        break;
       }
      }
     } else {
      $154 = $156;$155 = $157;$base$addr$1134 = $base$addr$1135;$c$8 = $c$6$lcssa;
      label = 72;
     }
    }
   } while(0);
   if ((label|0) == 72) {
    $arrayidx305 = ((1477) + ($c$8)|0);
    $115 = HEAP8[$arrayidx305>>0]|0;
    $conv306 = $115&255;
    $cmp307 = ($conv306>>>0)<($base$addr$1134>>>0);
    if ($cmp307) {
     while(1) {
      $116 = HEAP32[$rpos>>2]|0;
      $117 = HEAP32[$shend>>2]|0;
      $cmp319 = ($116>>>0)<($117>>>0);
      if ($cmp319) {
       $incdec$ptr323 = ((($116)) + 1|0);
       HEAP32[$rpos>>2] = $incdec$ptr323;
       $118 = HEAP8[$116>>0]|0;
       $conv324 = $118&255;
       $c$9$be = $conv324;
      } else {
       $call326 = (___shgetc($f)|0);
       $c$9$be = $call326;
      }
      $arrayidx311 = ((1477) + ($c$9$be)|0);
      $119 = HEAP8[$arrayidx311>>0]|0;
      $conv312 = $119&255;
      $cmp313 = ($conv312>>>0)<($base$addr$1134>>>0);
      if (!($cmp313)) {
       break;
      }
     }
     $call330 = (___errno_location()|0);
     HEAP32[$call330>>2] = 34;
     $120 = $0 & 1;
     $121 = ($120|0)==(0);
     $122 = (0)==(0);
     $123 = $121 & $122;
     $neg$0$ = $123 ? $neg$0 : 0;
     $127 = $1;$129 = $0;$neg$1 = $neg$0$;
    } else {
     $127 = $155;$129 = $154;$neg$1 = $neg$0;
    }
   }
   $124 = HEAP32[$shend>>2]|0;
   $tobool337 = ($124|0)==(0|0);
   if (!($tobool337)) {
    $125 = HEAP32[$rpos>>2]|0;
    $incdec$ptr340 = ((($125)) + -1|0);
    HEAP32[$rpos>>2] = $incdec$ptr340;
   }
   $126 = ($127>>>0)<($1>>>0);
   $128 = ($129>>>0)<($0>>>0);
   $130 = ($127|0)==($1|0);
   $131 = $130 & $128;
   $132 = $126 | $131;
   if (!($132)) {
    $133 = $0 & 1;
    $134 = ($133|0)!=(0);
    $135 = (0)!=(0);
    $136 = $134 | $135;
    $tobool349 = ($neg$1|0)!=(0);
    $or$cond5 = $136 | $tobool349;
    if (!($or$cond5)) {
     $call351 = (___errno_location()|0);
     HEAP32[$call351>>2] = 34;
     $137 = (_i64Add(($0|0),($1|0),-1,-1)|0);
     $138 = tempRet0;
     $150 = $138;$151 = $137;
     break;
    }
    $139 = ($127>>>0)>($1>>>0);
    $140 = ($129>>>0)>($0>>>0);
    $141 = ($127|0)==($1|0);
    $142 = $141 & $140;
    $143 = $139 | $142;
    if ($143) {
     $call357 = (___errno_location()|0);
     HEAP32[$call357>>2] = 34;
     $150 = $1;$151 = $0;
     break;
    }
   }
   $144 = ($neg$1|0)<(0);
   $145 = $144 << 31 >> 31;
   $146 = $129 ^ $neg$1;
   $147 = $127 ^ $145;
   $148 = (_i64Subtract(($146|0),($147|0),($neg$1|0),($145|0))|0);
   $149 = tempRet0;
   $150 = $149;$151 = $148;
  }
 } while(0);
 tempRet0 = ($150);
 return ($151|0);
}
function ___shgetc($f) {
 $f = $f|0;
 var $$phi$trans$insert$phi$trans$insert = 0, $$pre = 0, $$pre26$pre = 0, $$pre29 = 0, $$sink = 0, $0 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $add = 0, $add$ptr = 0, $add29 = 0, $arrayidx = 0;
 var $call = 0, $cmp = 0, $cmp2 = 0, $cmp32 = 0, $cmp9 = 0, $conv = 0, $conv35 = 0, $rend17$phi$trans$insert = 0, $retval$0 = 0, $rpos = 0, $shcnt = 0, $shcnt28$pre$phiZ2D = 0, $shcnt7 = 0, $shend = 0, $shend18 = 0, $shlim = 0, $sub = 0, $sub$ptr$lhs$cast25 = 0, $sub$ptr$rhs$cast = 0, $sub$ptr$rhs$cast26 = 0;
 var $sub$ptr$sub = 0, $sub$ptr$sub27 = 0, $sub8 = 0, $tobool = 0, $tobool21 = 0, $tobool4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $shlim = ((($f)) + 104|0);
 $0 = HEAP32[$shlim>>2]|0;
 $tobool = ($0|0)==(0);
 if ($tobool) {
  label = 3;
 } else {
  $shcnt = ((($f)) + 108|0);
  $1 = HEAP32[$shcnt>>2]|0;
  $cmp = ($1|0)<($0|0);
  if ($cmp) {
   label = 3;
  } else {
   label = 4;
  }
 }
 if ((label|0) == 3) {
  $call = (___uflow($f)|0);
  $cmp2 = ($call|0)<(0);
  if ($cmp2) {
   label = 4;
  } else {
   $2 = HEAP32[$shlim>>2]|0;
   $tobool4 = ($2|0)==(0);
   $rend17$phi$trans$insert = ((($f)) + 8|0);
   if ($tobool4) {
    $$pre = HEAP32[$rend17$phi$trans$insert>>2]|0;
    $$phi$trans$insert$phi$trans$insert = ((($f)) + 4|0);
    $$pre26$pre = HEAP32[$$phi$trans$insert$phi$trans$insert>>2]|0;
    $$pre29 = ((($f)) + 108|0);
    $$sink = $$pre;$7 = $$pre;$8 = $$pre26$pre;$shcnt28$pre$phiZ2D = $$pre29;
   } else {
    $3 = HEAP32[$rend17$phi$trans$insert>>2]|0;
    $rpos = ((($f)) + 4|0);
    $4 = HEAP32[$rpos>>2]|0;
    $sub$ptr$rhs$cast = $4;
    $sub$ptr$sub = (($3) - ($sub$ptr$rhs$cast))|0;
    $shcnt7 = ((($f)) + 108|0);
    $5 = HEAP32[$shcnt7>>2]|0;
    $sub = (($2) - ($5))|0;
    $cmp9 = ($sub$ptr$sub|0)<($sub|0);
    $6 = $3;
    if ($cmp9) {
     $$sink = $6;$7 = $6;$8 = $4;$shcnt28$pre$phiZ2D = $shcnt7;
    } else {
     $sub8 = (($sub) + -1)|0;
     $add$ptr = (($4) + ($sub8)|0);
     $$sink = $add$ptr;$7 = $6;$8 = $4;$shcnt28$pre$phiZ2D = $shcnt7;
    }
   }
   $shend18 = ((($f)) + 100|0);
   HEAP32[$shend18>>2] = $$sink;
   $tobool21 = ($7|0)==(0|0);
   if (!($tobool21)) {
    $sub$ptr$lhs$cast25 = $7;
    $sub$ptr$rhs$cast26 = $8;
    $9 = HEAP32[$shcnt28$pre$phiZ2D>>2]|0;
    $sub$ptr$sub27 = (($sub$ptr$lhs$cast25) + 1)|0;
    $add = (($sub$ptr$sub27) - ($sub$ptr$rhs$cast26))|0;
    $add29 = (($add) + ($9))|0;
    HEAP32[$shcnt28$pre$phiZ2D>>2] = $add29;
   }
   $arrayidx = ((($8)) + -1|0);
   $10 = HEAP8[$arrayidx>>0]|0;
   $conv = $10&255;
   $cmp32 = ($conv|0)==($call|0);
   if ($cmp32) {
    $retval$0 = $call;
   } else {
    $conv35 = $call&255;
    HEAP8[$arrayidx>>0] = $conv35;
    $retval$0 = $call;
   }
  }
 }
 if ((label|0) == 4) {
  $shend = ((($f)) + 100|0);
  HEAP32[$shend>>2] = 0;
  $retval$0 = -1;
 }
 return ($retval$0|0);
}
function _isspace($c) {
 $c = $c|0;
 var $0 = 0, $cmp = 0, $cmp1 = 0, $lor$ext = 0, $sub = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $cmp = ($c|0)==(32);
 $sub = (($c) + -9)|0;
 $cmp1 = ($sub>>>0)<(5);
 $0 = $cmp | $cmp1;
 $lor$ext = $0&1;
 return ($lor$ext|0);
}
function ___uflow($f) {
 $f = $f|0;
 var $0 = 0, $1 = 0, $c = 0, $call = 0, $call1 = 0, $cmp = 0, $conv = 0, $read = 0, $retval$0 = 0, $tobool = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $c = sp;
 $call = (___toread($f)|0);
 $tobool = ($call|0)==(0);
 if ($tobool) {
  $read = ((($f)) + 32|0);
  $0 = HEAP32[$read>>2]|0;
  $call1 = (FUNCTION_TABLE_iiii[$0 & 7]($f,$c,1)|0);
  $cmp = ($call1|0)==(1);
  if ($cmp) {
   $1 = HEAP8[$c>>0]|0;
   $conv = $1&255;
   $retval$0 = $conv;
  } else {
   $retval$0 = -1;
  }
 } else {
  $retval$0 = -1;
 }
 STACKTOP = sp;return ($retval$0|0);
}
function ___toread($f) {
 $f = $f|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $add$ptr = 0, $and = 0, $buf = 0, $buf_size = 0, $cmp = 0, $conv = 0, $conv3 = 0, $mode = 0, $or = 0, $or9 = 0, $rend = 0, $retval$0 = 0;
 var $rpos = 0, $sext = 0, $sub = 0, $tobool = 0, $wbase = 0, $wend = 0, $wpos = 0, $write = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $mode = ((($f)) + 74|0);
 $0 = HEAP8[$mode>>0]|0;
 $conv = $0 << 24 >> 24;
 $sub = (($conv) + 255)|0;
 $or = $sub | $conv;
 $conv3 = $or&255;
 HEAP8[$mode>>0] = $conv3;
 $wpos = ((($f)) + 20|0);
 $1 = HEAP32[$wpos>>2]|0;
 $wbase = ((($f)) + 28|0);
 $2 = HEAP32[$wbase>>2]|0;
 $cmp = ($1>>>0)>($2>>>0);
 if ($cmp) {
  $write = ((($f)) + 36|0);
  $3 = HEAP32[$write>>2]|0;
  (FUNCTION_TABLE_iiii[$3 & 7]($f,0,0)|0);
 }
 $wend = ((($f)) + 16|0);
 HEAP32[$wend>>2] = 0;
 HEAP32[$wbase>>2] = 0;
 HEAP32[$wpos>>2] = 0;
 $4 = HEAP32[$f>>2]|0;
 $and = $4 & 4;
 $tobool = ($and|0)==(0);
 if ($tobool) {
  $buf = ((($f)) + 44|0);
  $5 = HEAP32[$buf>>2]|0;
  $buf_size = ((($f)) + 48|0);
  $6 = HEAP32[$buf_size>>2]|0;
  $add$ptr = (($5) + ($6)|0);
  $rend = ((($f)) + 8|0);
  HEAP32[$rend>>2] = $add$ptr;
  $rpos = ((($f)) + 4|0);
  HEAP32[$rpos>>2] = $add$ptr;
  $7 = $4 << 27;
  $sext = $7 >> 31;
  $retval$0 = $sext;
 } else {
  $or9 = $4 | 32;
  HEAP32[$f>>2] = $or9;
  $retval$0 = -1;
 }
 return ($retval$0|0);
}
function _strtol($s,$p,$base) {
 $s = $s|0;
 $p = $p|0;
 $base = $base|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_strtox_742($s,$p,$base,-2147483648,0)|0);
 $1 = tempRet0;
 return ($0|0);
}
function _strcmp($l,$r) {
 $l = $l|0;
 $r = $r|0;
 var $$lcssa = 0, $$lcssa6 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $cmp = 0, $cmp7 = 0, $conv5 = 0, $conv6 = 0, $incdec$ptr = 0, $incdec$ptr4 = 0, $l$addr$010 = 0, $or$cond = 0, $or$cond9 = 0, $r$addr$011 = 0, $sub = 0, $tobool = 0, $tobool8 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $0 = HEAP8[$l>>0]|0;
 $1 = HEAP8[$r>>0]|0;
 $cmp7 = ($0<<24>>24)!=($1<<24>>24);
 $tobool8 = ($0<<24>>24)==(0);
 $or$cond9 = $tobool8 | $cmp7;
 if ($or$cond9) {
  $$lcssa = $1;$$lcssa6 = $0;
 } else {
  $l$addr$010 = $l;$r$addr$011 = $r;
  while(1) {
   $incdec$ptr = ((($l$addr$010)) + 1|0);
   $incdec$ptr4 = ((($r$addr$011)) + 1|0);
   $2 = HEAP8[$incdec$ptr>>0]|0;
   $3 = HEAP8[$incdec$ptr4>>0]|0;
   $cmp = ($2<<24>>24)!=($3<<24>>24);
   $tobool = ($2<<24>>24)==(0);
   $or$cond = $tobool | $cmp;
   if ($or$cond) {
    $$lcssa = $3;$$lcssa6 = $2;
    break;
   } else {
    $l$addr$010 = $incdec$ptr;$r$addr$011 = $incdec$ptr4;
   }
  }
 }
 $conv5 = $$lcssa6&255;
 $conv6 = $$lcssa&255;
 $sub = (($conv5) - ($conv6))|0;
 return ($sub|0);
}
function _sprintf($s,$fmt,$varargs) {
 $s = $s|0;
 $fmt = $fmt|0;
 $varargs = $varargs|0;
 var $ap = 0, $call = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $ap = sp;
 HEAP32[$ap>>2] = $varargs;
 $call = (_vsprintf($s,$fmt,$ap)|0);
 STACKTOP = sp;return ($call|0);
}
function _vsprintf($s,$fmt,$ap) {
 $s = $s|0;
 $fmt = $fmt|0;
 $ap = $ap|0;
 var $call = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $call = (_vsnprintf($s,2147483647,$fmt,$ap)|0);
 return ($call|0);
}
function _vsnprintf($s,$n,$fmt,$ap) {
 $s = $s|0;
 $n = $n|0;
 $fmt = $fmt|0;
 $ap = $ap|0;
 var $0 = 0, $1 = 0, $add$ptr = 0, $arrayidx = 0, $b = 0, $buf = 0, $buf_size = 0, $call = 0, $call10 = 0, $cmp = 0, $cmp16 = 0, $cmp4 = 0, $f = 0, $n$addr$0 = 0, $retval$0 = 0, $s$addr$0 = 0, $sub = 0, $sub$ptr$rhs$cast = 0, $sub17 = 0, $sub3 = 0;
 var $sub3$n$addr$0 = 0, $tobool = 0, $tobool11 = 0, $wbase = 0, $wend = 0, $wpos = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $b = sp + 124|0;
 $f = sp;
 dest=$f; src=392; stop=dest+124|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 $sub = (($n) + -1)|0;
 $cmp = ($sub>>>0)>(2147483646);
 if ($cmp) {
  $tobool = ($n|0)==(0);
  if ($tobool) {
   $n$addr$0 = 1;$s$addr$0 = $b;
   label = 4;
  } else {
   $call = (___errno_location()|0);
   HEAP32[$call>>2] = 75;
   $retval$0 = -1;
  }
 } else {
  $n$addr$0 = $n;$s$addr$0 = $s;
  label = 4;
 }
 if ((label|0) == 4) {
  $sub$ptr$rhs$cast = $s$addr$0;
  $sub3 = (-2 - ($sub$ptr$rhs$cast))|0;
  $cmp4 = ($n$addr$0>>>0)>($sub3>>>0);
  $sub3$n$addr$0 = $cmp4 ? $sub3 : $n$addr$0;
  $buf_size = ((($f)) + 48|0);
  HEAP32[$buf_size>>2] = $sub3$n$addr$0;
  $wpos = ((($f)) + 20|0);
  HEAP32[$wpos>>2] = $s$addr$0;
  $buf = ((($f)) + 44|0);
  HEAP32[$buf>>2] = $s$addr$0;
  $add$ptr = (($s$addr$0) + ($sub3$n$addr$0)|0);
  $wend = ((($f)) + 16|0);
  HEAP32[$wend>>2] = $add$ptr;
  $wbase = ((($f)) + 28|0);
  HEAP32[$wbase>>2] = $add$ptr;
  $call10 = (_vfprintf($f,$fmt,$ap)|0);
  $tobool11 = ($sub3$n$addr$0|0)==(0);
  if ($tobool11) {
   $retval$0 = $call10;
  } else {
   $0 = HEAP32[$wpos>>2]|0;
   $1 = HEAP32[$wend>>2]|0;
   $cmp16 = ($0|0)==($1|0);
   $sub17 = $cmp16 << 31 >> 31;
   $arrayidx = (($0) + ($sub17)|0);
   HEAP8[$arrayidx>>0] = 0;
   $retval$0 = $call10;
  }
 }
 STACKTOP = sp;return ($retval$0|0);
}
function _vfprintf($f,$fmt,$ap) {
 $f = $f|0;
 $fmt = $fmt|0;
 $ap = $ap|0;
 var $$call21 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $add$ptr = 0, $and = 0, $and11 = 0, $and36 = 0, $ap2 = 0, $buf = 0, $buf_size = 0, $call = 0, $call21 = 0, $call2130 = 0, $call6 = 0;
 var $cmp = 0, $cmp5 = 0, $cmp7 = 0, $cond = 0, $internal_buf = 0, $lock = 0, $mode = 0, $nl_arg = 0, $nl_type = 0, $or = 0, $ret$1 = 0, $ret$1$ = 0, $retval$0 = 0, $tobool = 0, $tobool22 = 0, $tobool26 = 0, $tobool37 = 0, $tobool41 = 0, $vacopy_currentptr = 0, $wbase = 0;
 var $wend = 0, $wpos = 0, $write = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(224|0);
 $ap2 = sp + 120|0;
 $nl_type = sp + 80|0;
 $nl_arg = sp;
 $internal_buf = sp + 136|0;
 dest=$nl_type; stop=dest+40|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 $vacopy_currentptr = HEAP32[$ap>>2]|0;
 HEAP32[$ap2>>2] = $vacopy_currentptr;
 $call = (_printf_core(0,$fmt,$ap2,$nl_arg,$nl_type)|0);
 $cmp = ($call|0)<(0);
 if ($cmp) {
  $retval$0 = -1;
 } else {
  $lock = ((($f)) + 76|0);
  $0 = HEAP32[$lock>>2]|0;
  $cmp5 = ($0|0)>(-1);
  if ($cmp5) {
   $call6 = (___lockfile($f)|0);
   $cond = $call6;
  } else {
   $cond = 0;
  }
  $1 = HEAP32[$f>>2]|0;
  $and = $1 & 32;
  $mode = ((($f)) + 74|0);
  $2 = HEAP8[$mode>>0]|0;
  $cmp7 = ($2<<24>>24)<(1);
  if ($cmp7) {
   $and11 = $1 & -33;
   HEAP32[$f>>2] = $and11;
  }
  $buf_size = ((($f)) + 48|0);
  $3 = HEAP32[$buf_size>>2]|0;
  $tobool = ($3|0)==(0);
  if ($tobool) {
   $buf = ((($f)) + 44|0);
   $4 = HEAP32[$buf>>2]|0;
   HEAP32[$buf>>2] = $internal_buf;
   $wbase = ((($f)) + 28|0);
   HEAP32[$wbase>>2] = $internal_buf;
   $wpos = ((($f)) + 20|0);
   HEAP32[$wpos>>2] = $internal_buf;
   HEAP32[$buf_size>>2] = 80;
   $add$ptr = ((($internal_buf)) + 80|0);
   $wend = ((($f)) + 16|0);
   HEAP32[$wend>>2] = $add$ptr;
   $call21 = (_printf_core($f,$fmt,$ap2,$nl_arg,$nl_type)|0);
   $tobool22 = ($4|0)==(0|0);
   if ($tobool22) {
    $ret$1 = $call21;
   } else {
    $write = ((($f)) + 36|0);
    $5 = HEAP32[$write>>2]|0;
    (FUNCTION_TABLE_iiii[$5 & 7]($f,0,0)|0);
    $6 = HEAP32[$wpos>>2]|0;
    $tobool26 = ($6|0)==(0|0);
    $$call21 = $tobool26 ? -1 : $call21;
    HEAP32[$buf>>2] = $4;
    HEAP32[$buf_size>>2] = 0;
    HEAP32[$wend>>2] = 0;
    HEAP32[$wbase>>2] = 0;
    HEAP32[$wpos>>2] = 0;
    $ret$1 = $$call21;
   }
  } else {
   $call2130 = (_printf_core($f,$fmt,$ap2,$nl_arg,$nl_type)|0);
   $ret$1 = $call2130;
  }
  $7 = HEAP32[$f>>2]|0;
  $and36 = $7 & 32;
  $tobool37 = ($and36|0)==(0);
  $ret$1$ = $tobool37 ? $ret$1 : -1;
  $or = $7 | $and;
  HEAP32[$f>>2] = $or;
  $tobool41 = ($cond|0)==(0);
  if (!($tobool41)) {
   ___unlockfile($f);
  }
  $retval$0 = $ret$1$;
 }
 STACKTOP = sp;return ($retval$0|0);
}
function _printf_core($f,$fmt,$ap,$nl_arg,$nl_type) {
 $f = $f|0;
 $fmt = $fmt|0;
 $ap = $ap|0;
 $nl_arg = $nl_arg|0;
 $nl_type = $nl_type|0;
 var $$ = 0, $$$ = 0, $$194$ = 0, $$197 = 0, $$add$ptr258 = 0, $$l10n$0 = 0, $$lcssa199 = 0, $$pre = 0, $$pre247 = 0, $$pre248 = 0, $$pre248$pre = 0, $$pre249 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0;
 var $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0;
 var $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0;
 var $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0.0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0;
 var $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0;
 var $97 = 0, $98 = 0, $99 = 0, $a$0 = 0, $a$0$add$ptr206 = 0, $a$1 = 0, $a$2 = 0, $add = 0, $add$ptr = 0, $add$ptr139 = 0, $add$ptr206 = 0, $add$ptr258 = 0, $add$ptr341 = 0, $add$ptr360 = 0, $add$ptr43 = 0, $add$ptr43$arrayidx31 = 0, $add$ptr474 = 0, $add$ptr88 = 0, $add270 = 0, $add323 = 0;
 var $add396 = 0, $add413 = 0, $add442 = 0, $and = 0, $and211 = 0, $and215 = 0, $and217 = 0, $and220 = 0, $and250 = 0, $and255 = 0, $and264 = 0, $and290 = 0, $and295 = 0, $and310 = 0, $and310$fl$4 = 0, $arg = 0, $arglist_current = 0, $arglist_current2 = 0, $arglist_next = 0, $arglist_next3 = 0;
 var $argpos$0 = 0, $arrayidx114 = 0, $arrayidx119 = 0, $arrayidx124 = 0, $arrayidx132 = 0, $arrayidx16 = 0, $arrayidx174 = 0, $arrayidx193 = 0, $arrayidx31 = 0, $arrayidx35 = 0, $arrayidx371 = 0, $arrayidx470 = 0, $arrayidx482 = 0, $arrayidx68 = 0, $arrayidx73 = 0, $arrayidx81 = 0, $buf = 0, $call = 0, $call104 = 0, $call160 = 0;
 var $call345 = 0, $call346 = 0, $call357 = 0, $call385 = 0, $call412 = 0, $call430 = 0, $cmp = 0, $cmp1 = 0, $cmp105 = 0, $cmp111 = 0, $cmp116 = 0, $cmp126 = 0, $cmp13 = 0, $cmp166 = 0, $cmp177 = 0, $cmp18 = 0, $cmp182 = 0, $cmp185 = 0, $cmp212 = 0, $cmp241 = 0;
 var $cmp271 = 0, $cmp307 = 0, $cmp324 = 0, $cmp37 = 0, $cmp378 = 0, $cmp378227 = 0, $cmp386 = 0, $cmp391 = 0, $cmp398 = 0, $cmp405 = 0, $cmp405237 = 0, $cmp414 = 0, $cmp422 = 0, $cmp435 = 0, $cmp443 = 0, $cmp467 = 0, $cmp479 = 0, $cmp50 = 0, $cmp50217 = 0, $cmp65 = 0;
 var $cmp75 = 0, $cmp97 = 0, $cnt$0 = 0, $cnt$1 = 0, $cond149 = 0, $cond246 = 0, $cond355 = 0, $cond427 = 0, $conv120 = 0, $conv134 = 0, $conv164 = 0, $conv172 = 0, $conv175 = 0, $conv208 = 0, $conv230 = 0, $conv233 = 0, $conv32 = 0, $conv48 = 0, $conv48215 = 0, $conv69 = 0;
 var $conv83 = 0, $expanded = 0, $expanded10 = 0, $expanded11 = 0, $expanded13 = 0, $expanded14 = 0, $expanded15 = 0, $expanded4 = 0, $expanded6 = 0, $expanded7 = 0, $expanded8 = 0, $fl$0$lcssa = 0, $fl$0219 = 0, $fl$1 = 0, $fl$1$and220 = 0, $fl$3 = 0, $fl$4 = 0, $fl$6 = 0, $i$0$lcssa = 0, $i$0$lcssa256 = 0;
 var $i$0229 = 0, $i$1238 = 0, $i$2210 = 0, $i$3207 = 0, $i137 = 0, $i86 = 0, $inc = 0, $inc489 = 0, $incdec$ptr = 0, $incdec$ptr159 = 0, $incdec$ptr171 = 0, $incdec$ptr23 = 0, $incdec$ptr384 = 0, $incdec$ptr411 = 0, $incdec$ptr62 = 0, $isdigit = 0, $isdigit188 = 0, $isdigit190 = 0, $isdigittmp = 0, $isdigittmp$ = 0;
 var $isdigittmp187 = 0, $isdigittmp189 = 0, $l$0 = 0, $l$1228 = 0, $l$2 = 0, $l10n$0 = 0, $l10n$0$phi = 0, $l10n$1 = 0, $l10n$2 = 0, $l10n$3 = 0, $lnot = 0, $lnot$ext = 0, $lnot484 = 0, $mb = 0, $narrow = 0, $or = 0, $or$cond = 0, $or$cond192 = 0, $or$cond193 = 0, $or$cond195 = 0;
 var $or100 = 0, $or100$fl$0 = 0, $or247 = 0, $p$0 = 0, $p$0$p$0$add270 = 0, $p$1 = 0, $p$2 = 0, $p$2$add323 = 0, $p$2$add323$p$2 = 0, $p$3 = 0, $p$4253 = 0, $p$5 = 0, $pl$0 = 0, $pl$1 = 0, $pl$2 = 0, $prefix$0 = 0, $prefix$1 = 0, $prefix$2 = 0, $retval$0 = 0, $s = 0;
 var $shl = 0, $shr = 0, $st$0 = 0, $storemerge = 0, $storemerge186218 = 0, $storemerge191 = 0, $sub = 0, $sub$ptr$lhs$cast = 0, $sub$ptr$lhs$cast318 = 0, $sub$ptr$lhs$cast362 = 0, $sub$ptr$lhs$cast432 = 0, $sub$ptr$rhs$cast = 0, $sub$ptr$rhs$cast268 = 0, $sub$ptr$rhs$cast319 = 0, $sub$ptr$rhs$cast363 = 0, $sub$ptr$rhs$cast433 = 0, $sub$ptr$sub = 0, $sub$ptr$sub269 = 0, $sub$ptr$sub320 = 0, $sub$ptr$sub364 = 0;
 var $sub$ptr$sub434 = 0, $sub$ptr$sub434$p$5 = 0, $sub101 = 0, $sub101$w$0 = 0, $sub135 = 0, $sub165 = 0, $sub173 = 0, $sub176 = 0, $sub390 = 0, $sub49 = 0, $sub49216 = 0, $sub49220 = 0, $sub84 = 0, $t$0 = 0, $t$1 = 0, $tobool = 0, $tobool141 = 0, $tobool179 = 0, $tobool209 = 0, $tobool218 = 0;
 var $tobool25 = 0, $tobool256 = 0, $tobool265 = 0, $tobool28 = 0, $tobool291 = 0, $tobool296 = 0, $tobool315 = 0, $tobool350 = 0, $tobool358 = 0, $tobool381 = 0, $tobool408 = 0, $tobool460 = 0, $tobool463 = 0, $tobool471 = 0, $tobool55 = 0, $tobool90 = 0, $trunc = 0, $w$0 = 0, $w$1 = 0, $w$2 = 0;
 var $wc = 0, $ws$0230 = 0, $ws$1239 = 0, $xor = 0, $xor450 = 0, $xor458 = 0, $z$0$lcssa = 0, $z$0212 = 0, $z$1 = 0, $z$2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $s = sp + 16|0;
 $arg = sp;
 $buf = sp + 24|0;
 $wc = sp + 8|0;
 $mb = sp + 20|0;
 HEAP32[$s>>2] = $fmt;
 $tobool25 = ($f|0)!=(0|0);
 $add$ptr206 = ((($buf)) + 40|0);
 $sub$ptr$lhs$cast318 = $add$ptr206;
 $add$ptr341 = ((($buf)) + 39|0);
 $arrayidx371 = ((($wc)) + 4|0);
 $1 = $fmt;$cnt$0 = 0;$l$0 = 0;$l10n$0 = 0;
 L1: while(1) {
  $cmp = ($cnt$0|0)>(-1);
  do {
   if ($cmp) {
    $sub = (2147483647 - ($cnt$0))|0;
    $cmp1 = ($l$0|0)>($sub|0);
    if ($cmp1) {
     $call = (___errno_location()|0);
     HEAP32[$call>>2] = 75;
     $cnt$1 = -1;
     break;
    } else {
     $add = (($l$0) + ($cnt$0))|0;
     $cnt$1 = $add;
     break;
    }
   } else {
    $cnt$1 = $cnt$0;
   }
  } while(0);
  $0 = HEAP8[$1>>0]|0;
  $tobool = ($0<<24>>24)==(0);
  if ($tobool) {
   label = 87;
   break;
  } else {
   $2 = $0;$3 = $1;
  }
  L9: while(1) {
   switch ($2<<24>>24) {
   case 37:  {
    $4 = $3;$z$0212 = $3;
    label = 9;
    break L9;
    break;
   }
   case 0:  {
    $7 = $3;$z$0$lcssa = $3;
    break L9;
    break;
   }
   default: {
   }
   }
   $incdec$ptr = ((($3)) + 1|0);
   HEAP32[$s>>2] = $incdec$ptr;
   $$pre = HEAP8[$incdec$ptr>>0]|0;
   $2 = $$pre;$3 = $incdec$ptr;
  }
  L12: do {
   if ((label|0) == 9) {
    while(1) {
     label = 0;
     $arrayidx16 = ((($4)) + 1|0);
     $5 = HEAP8[$arrayidx16>>0]|0;
     $cmp18 = ($5<<24>>24)==(37);
     if (!($cmp18)) {
      $7 = $4;$z$0$lcssa = $z$0212;
      break L12;
     }
     $incdec$ptr23 = ((($z$0212)) + 1|0);
     $add$ptr = ((($4)) + 2|0);
     HEAP32[$s>>2] = $add$ptr;
     $6 = HEAP8[$add$ptr>>0]|0;
     $cmp13 = ($6<<24>>24)==(37);
     if ($cmp13) {
      $4 = $add$ptr;$z$0212 = $incdec$ptr23;
      label = 9;
     } else {
      $7 = $add$ptr;$z$0$lcssa = $incdec$ptr23;
      break;
     }
    }
   }
  } while(0);
  $sub$ptr$lhs$cast = $z$0$lcssa;
  $sub$ptr$rhs$cast = $1;
  $sub$ptr$sub = (($sub$ptr$lhs$cast) - ($sub$ptr$rhs$cast))|0;
  if ($tobool25) {
   _out($f,$1,$sub$ptr$sub);
  }
  $tobool28 = ($sub$ptr$sub|0)==(0);
  if (!($tobool28)) {
   $l10n$0$phi = $l10n$0;$1 = $7;$cnt$0 = $cnt$1;$l$0 = $sub$ptr$sub;$l10n$0 = $l10n$0$phi;
   continue;
  }
  $arrayidx31 = ((($7)) + 1|0);
  $8 = HEAP8[$arrayidx31>>0]|0;
  $conv32 = $8 << 24 >> 24;
  $isdigittmp = (($conv32) + -48)|0;
  $isdigit = ($isdigittmp>>>0)<(10);
  if ($isdigit) {
   $arrayidx35 = ((($7)) + 2|0);
   $9 = HEAP8[$arrayidx35>>0]|0;
   $cmp37 = ($9<<24>>24)==(36);
   $add$ptr43 = ((($7)) + 3|0);
   $add$ptr43$arrayidx31 = $cmp37 ? $add$ptr43 : $arrayidx31;
   $$l10n$0 = $cmp37 ? 1 : $l10n$0;
   $isdigittmp$ = $cmp37 ? $isdigittmp : -1;
   $argpos$0 = $isdigittmp$;$l10n$1 = $$l10n$0;$storemerge = $add$ptr43$arrayidx31;
  } else {
   $argpos$0 = -1;$l10n$1 = $l10n$0;$storemerge = $arrayidx31;
  }
  HEAP32[$s>>2] = $storemerge;
  $10 = HEAP8[$storemerge>>0]|0;
  $conv48215 = $10 << 24 >> 24;
  $sub49216 = (($conv48215) + -32)|0;
  $cmp50217 = ($sub49216>>>0)<(32);
  L24: do {
   if ($cmp50217) {
    $149 = $10;$fl$0219 = 0;$storemerge186218 = $storemerge;$sub49220 = $sub49216;
    while(1) {
     $shl = 1 << $sub49220;
     $and = $shl & 75913;
     $tobool55 = ($and|0)==(0);
     if ($tobool55) {
      $$lcssa199 = $149;$12 = $storemerge186218;$fl$0$lcssa = $fl$0219;
      break L24;
     }
     $or = $shl | $fl$0219;
     $incdec$ptr62 = ((($storemerge186218)) + 1|0);
     HEAP32[$s>>2] = $incdec$ptr62;
     $11 = HEAP8[$incdec$ptr62>>0]|0;
     $conv48 = $11 << 24 >> 24;
     $sub49 = (($conv48) + -32)|0;
     $cmp50 = ($sub49>>>0)<(32);
     if ($cmp50) {
      $149 = $11;$fl$0219 = $or;$storemerge186218 = $incdec$ptr62;$sub49220 = $sub49;
     } else {
      $$lcssa199 = $11;$12 = $incdec$ptr62;$fl$0$lcssa = $or;
      break;
     }
    }
   } else {
    $$lcssa199 = $10;$12 = $storemerge;$fl$0$lcssa = 0;
   }
  } while(0);
  $cmp65 = ($$lcssa199<<24>>24)==(42);
  if ($cmp65) {
   $arrayidx68 = ((($12)) + 1|0);
   $13 = HEAP8[$arrayidx68>>0]|0;
   $conv69 = $13 << 24 >> 24;
   $isdigittmp189 = (($conv69) + -48)|0;
   $isdigit190 = ($isdigittmp189>>>0)<(10);
   if ($isdigit190) {
    $arrayidx73 = ((($12)) + 2|0);
    $14 = HEAP8[$arrayidx73>>0]|0;
    $cmp75 = ($14<<24>>24)==(36);
    if ($cmp75) {
     $arrayidx81 = (($nl_type) + ($isdigittmp189<<2)|0);
     HEAP32[$arrayidx81>>2] = 10;
     $15 = HEAP8[$arrayidx68>>0]|0;
     $conv83 = $15 << 24 >> 24;
     $sub84 = (($conv83) + -48)|0;
     $i86 = (($nl_arg) + ($sub84<<3)|0);
     $16 = $i86;
     $17 = $16;
     $18 = HEAP32[$17>>2]|0;
     $19 = (($16) + 4)|0;
     $20 = $19;
     $21 = HEAP32[$20>>2]|0;
     $add$ptr88 = ((($12)) + 3|0);
     $l10n$2 = 1;$storemerge191 = $add$ptr88;$w$0 = $18;
    } else {
     label = 23;
    }
   } else {
    label = 23;
   }
   if ((label|0) == 23) {
    label = 0;
    $tobool90 = ($l10n$1|0)==(0);
    if (!($tobool90)) {
     $retval$0 = -1;
     break;
    }
    if ($tobool25) {
     $arglist_current = HEAP32[$ap>>2]|0;
     $22 = $arglist_current;
     $23 = ((0) + 4|0);
     $expanded4 = $23;
     $expanded = (($expanded4) - 1)|0;
     $24 = (($22) + ($expanded))|0;
     $25 = ((0) + 4|0);
     $expanded8 = $25;
     $expanded7 = (($expanded8) - 1)|0;
     $expanded6 = $expanded7 ^ -1;
     $26 = $24 & $expanded6;
     $27 = $26;
     $28 = HEAP32[$27>>2]|0;
     $arglist_next = ((($27)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next;
     $l10n$2 = 0;$storemerge191 = $arrayidx68;$w$0 = $28;
    } else {
     $l10n$2 = 0;$storemerge191 = $arrayidx68;$w$0 = 0;
    }
   }
   HEAP32[$s>>2] = $storemerge191;
   $cmp97 = ($w$0|0)<(0);
   $or100 = $fl$0$lcssa | 8192;
   $sub101 = (0 - ($w$0))|0;
   $or100$fl$0 = $cmp97 ? $or100 : $fl$0$lcssa;
   $sub101$w$0 = $cmp97 ? $sub101 : $w$0;
   $30 = $storemerge191;$fl$1 = $or100$fl$0;$l10n$3 = $l10n$2;$w$1 = $sub101$w$0;
  } else {
   $call104 = (_getint($s)|0);
   $cmp105 = ($call104|0)<(0);
   if ($cmp105) {
    $retval$0 = -1;
    break;
   }
   $$pre247 = HEAP32[$s>>2]|0;
   $30 = $$pre247;$fl$1 = $fl$0$lcssa;$l10n$3 = $l10n$1;$w$1 = $call104;
  }
  $29 = HEAP8[$30>>0]|0;
  $cmp111 = ($29<<24>>24)==(46);
  do {
   if ($cmp111) {
    $arrayidx114 = ((($30)) + 1|0);
    $31 = HEAP8[$arrayidx114>>0]|0;
    $cmp116 = ($31<<24>>24)==(42);
    if (!($cmp116)) {
     $incdec$ptr159 = ((($30)) + 1|0);
     HEAP32[$s>>2] = $incdec$ptr159;
     $call160 = (_getint($s)|0);
     $$pre248$pre = HEAP32[$s>>2]|0;
     $$pre248 = $$pre248$pre;$p$0 = $call160;
     break;
    }
    $arrayidx119 = ((($30)) + 2|0);
    $32 = HEAP8[$arrayidx119>>0]|0;
    $conv120 = $32 << 24 >> 24;
    $isdigittmp187 = (($conv120) + -48)|0;
    $isdigit188 = ($isdigittmp187>>>0)<(10);
    if ($isdigit188) {
     $arrayidx124 = ((($30)) + 3|0);
     $33 = HEAP8[$arrayidx124>>0]|0;
     $cmp126 = ($33<<24>>24)==(36);
     if ($cmp126) {
      $arrayidx132 = (($nl_type) + ($isdigittmp187<<2)|0);
      HEAP32[$arrayidx132>>2] = 10;
      $34 = HEAP8[$arrayidx119>>0]|0;
      $conv134 = $34 << 24 >> 24;
      $sub135 = (($conv134) + -48)|0;
      $i137 = (($nl_arg) + ($sub135<<3)|0);
      $35 = $i137;
      $36 = $35;
      $37 = HEAP32[$36>>2]|0;
      $38 = (($35) + 4)|0;
      $39 = $38;
      $40 = HEAP32[$39>>2]|0;
      $add$ptr139 = ((($30)) + 4|0);
      HEAP32[$s>>2] = $add$ptr139;
      $$pre248 = $add$ptr139;$p$0 = $37;
      break;
     }
    }
    $tobool141 = ($l10n$3|0)==(0);
    if (!($tobool141)) {
     $retval$0 = -1;
     break L1;
    }
    if ($tobool25) {
     $arglist_current2 = HEAP32[$ap>>2]|0;
     $41 = $arglist_current2;
     $42 = ((0) + 4|0);
     $expanded11 = $42;
     $expanded10 = (($expanded11) - 1)|0;
     $43 = (($41) + ($expanded10))|0;
     $44 = ((0) + 4|0);
     $expanded15 = $44;
     $expanded14 = (($expanded15) - 1)|0;
     $expanded13 = $expanded14 ^ -1;
     $45 = $43 & $expanded13;
     $46 = $45;
     $47 = HEAP32[$46>>2]|0;
     $arglist_next3 = ((($46)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next3;
     $cond149 = $47;
    } else {
     $cond149 = 0;
    }
    HEAP32[$s>>2] = $arrayidx119;
    $$pre248 = $arrayidx119;$p$0 = $cond149;
   } else {
    $$pre248 = $30;$p$0 = -1;
   }
  } while(0);
  $49 = $$pre248;$st$0 = 0;
  while(1) {
   $48 = HEAP8[$49>>0]|0;
   $conv164 = $48 << 24 >> 24;
   $sub165 = (($conv164) + -65)|0;
   $cmp166 = ($sub165>>>0)>(57);
   if ($cmp166) {
    $retval$0 = -1;
    break L1;
   }
   $incdec$ptr171 = ((($49)) + 1|0);
   HEAP32[$s>>2] = $incdec$ptr171;
   $50 = HEAP8[$49>>0]|0;
   $conv172 = $50 << 24 >> 24;
   $sub173 = (($conv172) + -65)|0;
   $arrayidx174 = ((1742 + (($st$0*58)|0)|0) + ($sub173)|0);
   $51 = HEAP8[$arrayidx174>>0]|0;
   $conv175 = $51&255;
   $sub176 = (($conv175) + -1)|0;
   $cmp177 = ($sub176>>>0)<(8);
   if ($cmp177) {
    $49 = $incdec$ptr171;$st$0 = $conv175;
   } else {
    break;
   }
  }
  $tobool179 = ($51<<24>>24)==(0);
  if ($tobool179) {
   $retval$0 = -1;
   break;
  }
  $cmp182 = ($51<<24>>24)==(19);
  $cmp185 = ($argpos$0|0)>(-1);
  do {
   if ($cmp182) {
    if ($cmp185) {
     $retval$0 = -1;
     break L1;
    } else {
     label = 49;
    }
   } else {
    if ($cmp185) {
     $arrayidx193 = (($nl_type) + ($argpos$0<<2)|0);
     HEAP32[$arrayidx193>>2] = $conv175;
     $52 = (($nl_arg) + ($argpos$0<<3)|0);
     $53 = $52;
     $54 = $53;
     $55 = HEAP32[$54>>2]|0;
     $56 = (($53) + 4)|0;
     $57 = $56;
     $58 = HEAP32[$57>>2]|0;
     $59 = $arg;
     $60 = $59;
     HEAP32[$60>>2] = $55;
     $61 = (($59) + 4)|0;
     $62 = $61;
     HEAP32[$62>>2] = $58;
     label = 49;
     break;
    }
    if (!($tobool25)) {
     $retval$0 = 0;
     break L1;
    }
    _pop_arg($arg,$conv175,$ap);
   }
  } while(0);
  if ((label|0) == 49) {
   label = 0;
   if (!($tobool25)) {
    $1 = $incdec$ptr171;$cnt$0 = $cnt$1;$l$0 = 0;$l10n$0 = $l10n$3;
    continue;
   }
  }
  $63 = HEAP8[$49>>0]|0;
  $conv208 = $63 << 24 >> 24;
  $tobool209 = ($st$0|0)!=(0);
  $and211 = $conv208 & 15;
  $cmp212 = ($and211|0)==(3);
  $or$cond192 = $tobool209 & $cmp212;
  $and215 = $conv208 & -33;
  $t$0 = $or$cond192 ? $and215 : $conv208;
  $and217 = $fl$1 & 8192;
  $tobool218 = ($and217|0)==(0);
  $and220 = $fl$1 & -65537;
  $fl$1$and220 = $tobool218 ? $fl$1 : $and220;
  L71: do {
   switch ($t$0|0) {
   case 110:  {
    $trunc = $st$0&255;
    switch ($trunc<<24>>24) {
    case 0:  {
     $70 = HEAP32[$arg>>2]|0;
     HEAP32[$70>>2] = $cnt$1;
     $1 = $incdec$ptr171;$cnt$0 = $cnt$1;$l$0 = 0;$l10n$0 = $l10n$3;
     continue L1;
     break;
    }
    case 1:  {
     $71 = HEAP32[$arg>>2]|0;
     HEAP32[$71>>2] = $cnt$1;
     $1 = $incdec$ptr171;$cnt$0 = $cnt$1;$l$0 = 0;$l10n$0 = $l10n$3;
     continue L1;
     break;
    }
    case 2:  {
     $72 = ($cnt$1|0)<(0);
     $73 = $72 << 31 >> 31;
     $74 = HEAP32[$arg>>2]|0;
     $75 = $74;
     $76 = $75;
     HEAP32[$76>>2] = $cnt$1;
     $77 = (($75) + 4)|0;
     $78 = $77;
     HEAP32[$78>>2] = $73;
     $1 = $incdec$ptr171;$cnt$0 = $cnt$1;$l$0 = 0;$l10n$0 = $l10n$3;
     continue L1;
     break;
    }
    case 3:  {
     $conv230 = $cnt$1&65535;
     $79 = HEAP32[$arg>>2]|0;
     HEAP16[$79>>1] = $conv230;
     $1 = $incdec$ptr171;$cnt$0 = $cnt$1;$l$0 = 0;$l10n$0 = $l10n$3;
     continue L1;
     break;
    }
    case 4:  {
     $conv233 = $cnt$1&255;
     $80 = HEAP32[$arg>>2]|0;
     HEAP8[$80>>0] = $conv233;
     $1 = $incdec$ptr171;$cnt$0 = $cnt$1;$l$0 = 0;$l10n$0 = $l10n$3;
     continue L1;
     break;
    }
    case 6:  {
     $81 = HEAP32[$arg>>2]|0;
     HEAP32[$81>>2] = $cnt$1;
     $1 = $incdec$ptr171;$cnt$0 = $cnt$1;$l$0 = 0;$l10n$0 = $l10n$3;
     continue L1;
     break;
    }
    case 7:  {
     $82 = ($cnt$1|0)<(0);
     $83 = $82 << 31 >> 31;
     $84 = HEAP32[$arg>>2]|0;
     $85 = $84;
     $86 = $85;
     HEAP32[$86>>2] = $cnt$1;
     $87 = (($85) + 4)|0;
     $88 = $87;
     HEAP32[$88>>2] = $83;
     $1 = $incdec$ptr171;$cnt$0 = $cnt$1;$l$0 = 0;$l10n$0 = $l10n$3;
     continue L1;
     break;
    }
    default: {
     $1 = $incdec$ptr171;$cnt$0 = $cnt$1;$l$0 = 0;$l10n$0 = $l10n$3;
     continue L1;
    }
    }
    break;
   }
   case 112:  {
    $cmp241 = ($p$0>>>0)>(8);
    $cond246 = $cmp241 ? $p$0 : 8;
    $or247 = $fl$1$and220 | 8;
    $fl$3 = $or247;$p$1 = $cond246;$t$1 = 120;
    label = 61;
    break;
   }
   case 88: case 120:  {
    $fl$3 = $fl$1$and220;$p$1 = $p$0;$t$1 = $t$0;
    label = 61;
    break;
   }
   case 111:  {
    $99 = $arg;
    $100 = $99;
    $101 = HEAP32[$100>>2]|0;
    $102 = (($99) + 4)|0;
    $103 = $102;
    $104 = HEAP32[$103>>2]|0;
    $105 = (_fmt_o($101,$104,$add$ptr206)|0);
    $and264 = $fl$1$and220 & 8;
    $tobool265 = ($and264|0)==(0);
    $sub$ptr$rhs$cast268 = $105;
    $sub$ptr$sub269 = (($sub$ptr$lhs$cast318) - ($sub$ptr$rhs$cast268))|0;
    $cmp271 = ($p$0|0)>($sub$ptr$sub269|0);
    $add270 = (($sub$ptr$sub269) + 1)|0;
    $106 = $tobool265 | $cmp271;
    $p$0$p$0$add270 = $106 ? $p$0 : $add270;
    $125 = $101;$127 = $104;$a$0 = $105;$fl$4 = $fl$1$and220;$p$2 = $p$0$p$0$add270;$pl$1 = 0;$prefix$1 = 2206;
    label = 67;
    break;
   }
   case 105: case 100:  {
    $107 = $arg;
    $108 = $107;
    $109 = HEAP32[$108>>2]|0;
    $110 = (($107) + 4)|0;
    $111 = $110;
    $112 = HEAP32[$111>>2]|0;
    $113 = ($112|0)<(0);
    if ($113) {
     $114 = (_i64Subtract(0,0,($109|0),($112|0))|0);
     $115 = tempRet0;
     $116 = $arg;
     $117 = $116;
     HEAP32[$117>>2] = $114;
     $118 = (($116) + 4)|0;
     $119 = $118;
     HEAP32[$119>>2] = $115;
     $121 = $114;$122 = $115;$pl$0 = 1;$prefix$0 = 2206;
     label = 66;
     break L71;
    } else {
     $and290 = $fl$1$and220 & 2048;
     $tobool291 = ($and290|0)==(0);
     $and295 = $fl$1$and220 & 1;
     $tobool296 = ($and295|0)==(0);
     $$ = $tobool296 ? 2206 : (2208);
     $$$ = $tobool291 ? $$ : (2207);
     $120 = $fl$1$and220 & 2049;
     $narrow = ($120|0)!=(0);
     $$194$ = $narrow&1;
     $121 = $109;$122 = $112;$pl$0 = $$194$;$prefix$0 = $$$;
     label = 66;
     break L71;
    }
    break;
   }
   case 117:  {
    $64 = $arg;
    $65 = $64;
    $66 = HEAP32[$65>>2]|0;
    $67 = (($64) + 4)|0;
    $68 = $67;
    $69 = HEAP32[$68>>2]|0;
    $121 = $66;$122 = $69;$pl$0 = 0;$prefix$0 = 2206;
    label = 66;
    break;
   }
   case 99:  {
    $129 = $arg;
    $130 = $129;
    $131 = HEAP32[$130>>2]|0;
    $132 = (($129) + 4)|0;
    $133 = $132;
    $134 = HEAP32[$133>>2]|0;
    $135 = $131&255;
    HEAP8[$add$ptr341>>0] = $135;
    $a$2 = $add$ptr341;$fl$6 = $and220;$p$5 = 1;$pl$2 = 0;$prefix$2 = 2206;$z$2 = $add$ptr206;
    break;
   }
   case 109:  {
    $call345 = (___errno_location()|0);
    $136 = HEAP32[$call345>>2]|0;
    $call346 = (_strerror($136)|0);
    $a$1 = $call346;
    label = 71;
    break;
   }
   case 115:  {
    $137 = HEAP32[$arg>>2]|0;
    $tobool350 = ($137|0)!=(0|0);
    $cond355 = $tobool350 ? $137 : 2216;
    $a$1 = $cond355;
    label = 71;
    break;
   }
   case 67:  {
    $138 = $arg;
    $139 = $138;
    $140 = HEAP32[$139>>2]|0;
    $141 = (($138) + 4)|0;
    $142 = $141;
    $143 = HEAP32[$142>>2]|0;
    HEAP32[$wc>>2] = $140;
    HEAP32[$arrayidx371>>2] = 0;
    HEAP32[$arg>>2] = $wc;
    $150 = $wc;$p$4253 = -1;
    label = 75;
    break;
   }
   case 83:  {
    $$pre249 = HEAP32[$arg>>2]|0;
    $cmp378227 = ($p$0|0)==(0);
    if ($cmp378227) {
     _pad_684($f,32,$w$1,0,$fl$1$and220);
     $i$0$lcssa256 = 0;
     label = 84;
    } else {
     $150 = $$pre249;$p$4253 = $p$0;
     label = 75;
    }
    break;
   }
   case 65: case 71: case 70: case 69: case 97: case 103: case 102: case 101:  {
    $146 = +HEAPF64[$arg>>3];
    $call430 = (_fmt_fp($f,$146,$w$1,$p$0,$fl$1$and220,$t$0)|0);
    $1 = $incdec$ptr171;$cnt$0 = $cnt$1;$l$0 = $call430;$l10n$0 = $l10n$3;
    continue L1;
    break;
   }
   default: {
    $a$2 = $1;$fl$6 = $fl$1$and220;$p$5 = $p$0;$pl$2 = 0;$prefix$2 = 2206;$z$2 = $add$ptr206;
   }
   }
  } while(0);
  L95: do {
   if ((label|0) == 61) {
    label = 0;
    $89 = $arg;
    $90 = $89;
    $91 = HEAP32[$90>>2]|0;
    $92 = (($89) + 4)|0;
    $93 = $92;
    $94 = HEAP32[$93>>2]|0;
    $and250 = $t$1 & 32;
    $95 = (_fmt_x($91,$94,$add$ptr206,$and250)|0);
    $96 = ($91|0)==(0);
    $97 = ($94|0)==(0);
    $98 = $96 & $97;
    $and255 = $fl$3 & 8;
    $tobool256 = ($and255|0)==(0);
    $or$cond193 = $tobool256 | $98;
    $shr = $t$1 >> 4;
    $add$ptr258 = (2206 + ($shr)|0);
    $$add$ptr258 = $or$cond193 ? 2206 : $add$ptr258;
    $$197 = $or$cond193 ? 0 : 2;
    $125 = $91;$127 = $94;$a$0 = $95;$fl$4 = $fl$3;$p$2 = $p$1;$pl$1 = $$197;$prefix$1 = $$add$ptr258;
    label = 67;
   }
   else if ((label|0) == 66) {
    label = 0;
    $123 = (_fmt_u($121,$122,$add$ptr206)|0);
    $125 = $121;$127 = $122;$a$0 = $123;$fl$4 = $fl$1$and220;$p$2 = $p$0;$pl$1 = $pl$0;$prefix$1 = $prefix$0;
    label = 67;
   }
   else if ((label|0) == 71) {
    label = 0;
    $call357 = (_memchr($a$1,0,$p$0)|0);
    $tobool358 = ($call357|0)==(0|0);
    $sub$ptr$lhs$cast362 = $call357;
    $sub$ptr$rhs$cast363 = $a$1;
    $sub$ptr$sub364 = (($sub$ptr$lhs$cast362) - ($sub$ptr$rhs$cast363))|0;
    $add$ptr360 = (($a$1) + ($p$0)|0);
    $p$3 = $tobool358 ? $p$0 : $sub$ptr$sub364;
    $z$1 = $tobool358 ? $add$ptr360 : $call357;
    $a$2 = $a$1;$fl$6 = $and220;$p$5 = $p$3;$pl$2 = 0;$prefix$2 = 2206;$z$2 = $z$1;
   }
   else if ((label|0) == 75) {
    label = 0;
    $i$0229 = 0;$l$1228 = 0;$ws$0230 = $150;
    while(1) {
     $144 = HEAP32[$ws$0230>>2]|0;
     $tobool381 = ($144|0)==(0);
     if ($tobool381) {
      $i$0$lcssa = $i$0229;$l$2 = $l$1228;
      break;
     }
     $call385 = (_wctomb($mb,$144)|0);
     $cmp386 = ($call385|0)<(0);
     $sub390 = (($p$4253) - ($i$0229))|0;
     $cmp391 = ($call385>>>0)>($sub390>>>0);
     $or$cond195 = $cmp386 | $cmp391;
     if ($or$cond195) {
      $i$0$lcssa = $i$0229;$l$2 = $call385;
      break;
     }
     $incdec$ptr384 = ((($ws$0230)) + 4|0);
     $add396 = (($call385) + ($i$0229))|0;
     $cmp378 = ($p$4253>>>0)>($add396>>>0);
     if ($cmp378) {
      $i$0229 = $add396;$l$1228 = $call385;$ws$0230 = $incdec$ptr384;
     } else {
      $i$0$lcssa = $add396;$l$2 = $call385;
      break;
     }
    }
    $cmp398 = ($l$2|0)<(0);
    if ($cmp398) {
     $retval$0 = -1;
     break L1;
    }
    _pad_684($f,32,$w$1,$i$0$lcssa,$fl$1$and220);
    $cmp405237 = ($i$0$lcssa|0)==(0);
    if ($cmp405237) {
     $i$0$lcssa256 = 0;
     label = 84;
    } else {
     $i$1238 = 0;$ws$1239 = $150;
     while(1) {
      $145 = HEAP32[$ws$1239>>2]|0;
      $tobool408 = ($145|0)==(0);
      if ($tobool408) {
       $i$0$lcssa256 = $i$0$lcssa;
       label = 84;
       break L95;
      }
      $call412 = (_wctomb($mb,$145)|0);
      $add413 = (($call412) + ($i$1238))|0;
      $cmp414 = ($add413|0)>($i$0$lcssa|0);
      if ($cmp414) {
       $i$0$lcssa256 = $i$0$lcssa;
       label = 84;
       break L95;
      }
      $incdec$ptr411 = ((($ws$1239)) + 4|0);
      _out($f,$mb,$call412);
      $cmp405 = ($add413>>>0)<($i$0$lcssa>>>0);
      if ($cmp405) {
       $i$1238 = $add413;$ws$1239 = $incdec$ptr411;
      } else {
       $i$0$lcssa256 = $i$0$lcssa;
       label = 84;
       break;
      }
     }
    }
   }
  } while(0);
  if ((label|0) == 67) {
   label = 0;
   $cmp307 = ($p$2|0)>(-1);
   $and310 = $fl$4 & -65537;
   $and310$fl$4 = $cmp307 ? $and310 : $fl$4;
   $124 = ($125|0)!=(0);
   $126 = ($127|0)!=(0);
   $128 = $124 | $126;
   $tobool315 = ($p$2|0)!=(0);
   $or$cond = $tobool315 | $128;
   $sub$ptr$rhs$cast319 = $a$0;
   $sub$ptr$sub320 = (($sub$ptr$lhs$cast318) - ($sub$ptr$rhs$cast319))|0;
   $lnot = $128 ^ 1;
   $lnot$ext = $lnot&1;
   $add323 = (($lnot$ext) + ($sub$ptr$sub320))|0;
   $cmp324 = ($p$2|0)>($add323|0);
   $p$2$add323 = $cmp324 ? $p$2 : $add323;
   $p$2$add323$p$2 = $or$cond ? $p$2$add323 : $p$2;
   $a$0$add$ptr206 = $or$cond ? $a$0 : $add$ptr206;
   $a$2 = $a$0$add$ptr206;$fl$6 = $and310$fl$4;$p$5 = $p$2$add323$p$2;$pl$2 = $pl$1;$prefix$2 = $prefix$1;$z$2 = $add$ptr206;
  }
  else if ((label|0) == 84) {
   label = 0;
   $xor = $fl$1$and220 ^ 8192;
   _pad_684($f,32,$w$1,$i$0$lcssa256,$xor);
   $cmp422 = ($w$1|0)>($i$0$lcssa256|0);
   $cond427 = $cmp422 ? $w$1 : $i$0$lcssa256;
   $1 = $incdec$ptr171;$cnt$0 = $cnt$1;$l$0 = $cond427;$l10n$0 = $l10n$3;
   continue;
  }
  $sub$ptr$lhs$cast432 = $z$2;
  $sub$ptr$rhs$cast433 = $a$2;
  $sub$ptr$sub434 = (($sub$ptr$lhs$cast432) - ($sub$ptr$rhs$cast433))|0;
  $cmp435 = ($p$5|0)<($sub$ptr$sub434|0);
  $sub$ptr$sub434$p$5 = $cmp435 ? $sub$ptr$sub434 : $p$5;
  $add442 = (($sub$ptr$sub434$p$5) + ($pl$2))|0;
  $cmp443 = ($w$1|0)<($add442|0);
  $w$2 = $cmp443 ? $add442 : $w$1;
  _pad_684($f,32,$w$2,$add442,$fl$6);
  _out($f,$prefix$2,$pl$2);
  $xor450 = $fl$6 ^ 65536;
  _pad_684($f,48,$w$2,$add442,$xor450);
  _pad_684($f,48,$sub$ptr$sub434$p$5,$sub$ptr$sub434,0);
  _out($f,$a$2,$sub$ptr$sub434);
  $xor458 = $fl$6 ^ 8192;
  _pad_684($f,32,$w$2,$add442,$xor458);
  $1 = $incdec$ptr171;$cnt$0 = $cnt$1;$l$0 = $w$2;$l10n$0 = $l10n$3;
 }
 L114: do {
  if ((label|0) == 87) {
   $tobool460 = ($f|0)==(0|0);
   if ($tobool460) {
    $tobool463 = ($l10n$0|0)==(0);
    if ($tobool463) {
     $retval$0 = 0;
    } else {
     $i$2210 = 1;
     while(1) {
      $arrayidx470 = (($nl_type) + ($i$2210<<2)|0);
      $147 = HEAP32[$arrayidx470>>2]|0;
      $tobool471 = ($147|0)==(0);
      if ($tobool471) {
       $i$3207 = $i$2210;
       break;
      }
      $add$ptr474 = (($nl_arg) + ($i$2210<<3)|0);
      _pop_arg($add$ptr474,$147,$ap);
      $inc = (($i$2210) + 1)|0;
      $cmp467 = ($inc|0)<(10);
      if ($cmp467) {
       $i$2210 = $inc;
      } else {
       $retval$0 = 1;
       break L114;
      }
     }
     while(1) {
      $arrayidx482 = (($nl_type) + ($i$3207<<2)|0);
      $148 = HEAP32[$arrayidx482>>2]|0;
      $lnot484 = ($148|0)==(0);
      $inc489 = (($i$3207) + 1)|0;
      if (!($lnot484)) {
       $retval$0 = -1;
       break L114;
      }
      $cmp479 = ($inc489|0)<(10);
      if ($cmp479) {
       $i$3207 = $inc489;
      } else {
       $retval$0 = 1;
       break;
      }
     }
    }
   } else {
    $retval$0 = $cnt$1;
   }
  }
 } while(0);
 STACKTOP = sp;return ($retval$0|0);
}
function ___lockfile($f) {
 $f = $f|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function ___unlockfile($f) {
 $f = $f|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function _out($f,$s,$l) {
 $f = $f|0;
 $s = $s|0;
 $l = $l|0;
 var $0 = 0, $and = 0, $tobool = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[$f>>2]|0;
 $and = $0 & 32;
 $tobool = ($and|0)==(0);
 if ($tobool) {
  (___fwritex($s,$l,$f)|0);
 }
 return;
}
function _getint($s) {
 $s = $s|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $add = 0, $conv = 0, $conv4 = 0, $i$0$lcssa = 0, $i$07 = 0, $incdec$ptr = 0, $isdigit = 0, $isdigit6 = 0, $isdigittmp = 0, $isdigittmp5 = 0, $isdigittmp8 = 0, $mul = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[$s>>2]|0;
 $1 = HEAP8[$0>>0]|0;
 $conv4 = $1 << 24 >> 24;
 $isdigittmp5 = (($conv4) + -48)|0;
 $isdigit6 = ($isdigittmp5>>>0)<(10);
 if ($isdigit6) {
  $2 = $0;$i$07 = 0;$isdigittmp8 = $isdigittmp5;
  while(1) {
   $mul = ($i$07*10)|0;
   $add = (($isdigittmp8) + ($mul))|0;
   $incdec$ptr = ((($2)) + 1|0);
   HEAP32[$s>>2] = $incdec$ptr;
   $3 = HEAP8[$incdec$ptr>>0]|0;
   $conv = $3 << 24 >> 24;
   $isdigittmp = (($conv) + -48)|0;
   $isdigit = ($isdigittmp>>>0)<(10);
   if ($isdigit) {
    $2 = $incdec$ptr;$i$07 = $add;$isdigittmp8 = $isdigittmp;
   } else {
    $i$0$lcssa = $add;
    break;
   }
  }
 } else {
  $i$0$lcssa = 0;
 }
 return ($i$0$lcssa|0);
}
function _pop_arg($arg,$type,$ap) {
 $arg = $arg|0;
 $type = $type|0;
 $ap = $ap|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0.0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0;
 var $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0;
 var $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0;
 var $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0;
 var $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0;
 var $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $arglist_current = 0, $arglist_current11 = 0, $arglist_current14 = 0, $arglist_current17 = 0, $arglist_current2 = 0, $arglist_current20 = 0, $arglist_current23 = 0, $arglist_current26 = 0, $arglist_current5 = 0;
 var $arglist_current8 = 0, $arglist_next = 0, $arglist_next12 = 0, $arglist_next15 = 0, $arglist_next18 = 0, $arglist_next21 = 0, $arglist_next24 = 0, $arglist_next27 = 0, $arglist_next3 = 0, $arglist_next6 = 0, $arglist_next9 = 0, $cmp = 0, $conv16 = 0, $conv22$mask = 0, $conv28 = 0, $conv34$mask = 0, $expanded = 0, $expanded28 = 0, $expanded30 = 0, $expanded31 = 0;
 var $expanded32 = 0, $expanded34 = 0, $expanded35 = 0, $expanded37 = 0, $expanded38 = 0, $expanded39 = 0, $expanded41 = 0, $expanded42 = 0, $expanded44 = 0, $expanded45 = 0, $expanded46 = 0, $expanded48 = 0, $expanded49 = 0, $expanded51 = 0, $expanded52 = 0, $expanded53 = 0, $expanded55 = 0, $expanded56 = 0, $expanded58 = 0, $expanded59 = 0;
 var $expanded60 = 0, $expanded62 = 0, $expanded63 = 0, $expanded65 = 0, $expanded66 = 0, $expanded67 = 0, $expanded69 = 0, $expanded70 = 0, $expanded72 = 0, $expanded73 = 0, $expanded74 = 0, $expanded76 = 0, $expanded77 = 0, $expanded79 = 0, $expanded80 = 0, $expanded81 = 0, $expanded83 = 0, $expanded84 = 0, $expanded86 = 0, $expanded87 = 0;
 var $expanded88 = 0, $expanded90 = 0, $expanded91 = 0, $expanded93 = 0, $expanded94 = 0, $expanded95 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $cmp = ($type>>>0)>(20);
 L1: do {
  if (!($cmp)) {
   do {
    switch ($type|0) {
    case 9:  {
     $arglist_current = HEAP32[$ap>>2]|0;
     $0 = $arglist_current;
     $1 = ((0) + 4|0);
     $expanded28 = $1;
     $expanded = (($expanded28) - 1)|0;
     $2 = (($0) + ($expanded))|0;
     $3 = ((0) + 4|0);
     $expanded32 = $3;
     $expanded31 = (($expanded32) - 1)|0;
     $expanded30 = $expanded31 ^ -1;
     $4 = $2 & $expanded30;
     $5 = $4;
     $6 = HEAP32[$5>>2]|0;
     $arglist_next = ((($5)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next;
     HEAP32[$arg>>2] = $6;
     break L1;
     break;
    }
    case 10:  {
     $arglist_current2 = HEAP32[$ap>>2]|0;
     $7 = $arglist_current2;
     $8 = ((0) + 4|0);
     $expanded35 = $8;
     $expanded34 = (($expanded35) - 1)|0;
     $9 = (($7) + ($expanded34))|0;
     $10 = ((0) + 4|0);
     $expanded39 = $10;
     $expanded38 = (($expanded39) - 1)|0;
     $expanded37 = $expanded38 ^ -1;
     $11 = $9 & $expanded37;
     $12 = $11;
     $13 = HEAP32[$12>>2]|0;
     $arglist_next3 = ((($12)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next3;
     $14 = ($13|0)<(0);
     $15 = $14 << 31 >> 31;
     $16 = $arg;
     $17 = $16;
     HEAP32[$17>>2] = $13;
     $18 = (($16) + 4)|0;
     $19 = $18;
     HEAP32[$19>>2] = $15;
     break L1;
     break;
    }
    case 11:  {
     $arglist_current5 = HEAP32[$ap>>2]|0;
     $20 = $arglist_current5;
     $21 = ((0) + 4|0);
     $expanded42 = $21;
     $expanded41 = (($expanded42) - 1)|0;
     $22 = (($20) + ($expanded41))|0;
     $23 = ((0) + 4|0);
     $expanded46 = $23;
     $expanded45 = (($expanded46) - 1)|0;
     $expanded44 = $expanded45 ^ -1;
     $24 = $22 & $expanded44;
     $25 = $24;
     $26 = HEAP32[$25>>2]|0;
     $arglist_next6 = ((($25)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next6;
     $27 = $arg;
     $28 = $27;
     HEAP32[$28>>2] = $26;
     $29 = (($27) + 4)|0;
     $30 = $29;
     HEAP32[$30>>2] = 0;
     break L1;
     break;
    }
    case 12:  {
     $arglist_current8 = HEAP32[$ap>>2]|0;
     $31 = $arglist_current8;
     $32 = ((0) + 8|0);
     $expanded49 = $32;
     $expanded48 = (($expanded49) - 1)|0;
     $33 = (($31) + ($expanded48))|0;
     $34 = ((0) + 8|0);
     $expanded53 = $34;
     $expanded52 = (($expanded53) - 1)|0;
     $expanded51 = $expanded52 ^ -1;
     $35 = $33 & $expanded51;
     $36 = $35;
     $37 = $36;
     $38 = $37;
     $39 = HEAP32[$38>>2]|0;
     $40 = (($37) + 4)|0;
     $41 = $40;
     $42 = HEAP32[$41>>2]|0;
     $arglist_next9 = ((($36)) + 8|0);
     HEAP32[$ap>>2] = $arglist_next9;
     $43 = $arg;
     $44 = $43;
     HEAP32[$44>>2] = $39;
     $45 = (($43) + 4)|0;
     $46 = $45;
     HEAP32[$46>>2] = $42;
     break L1;
     break;
    }
    case 13:  {
     $arglist_current11 = HEAP32[$ap>>2]|0;
     $47 = $arglist_current11;
     $48 = ((0) + 4|0);
     $expanded56 = $48;
     $expanded55 = (($expanded56) - 1)|0;
     $49 = (($47) + ($expanded55))|0;
     $50 = ((0) + 4|0);
     $expanded60 = $50;
     $expanded59 = (($expanded60) - 1)|0;
     $expanded58 = $expanded59 ^ -1;
     $51 = $49 & $expanded58;
     $52 = $51;
     $53 = HEAP32[$52>>2]|0;
     $arglist_next12 = ((($52)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next12;
     $conv16 = $53&65535;
     $54 = $conv16 << 16 >> 16;
     $55 = ($54|0)<(0);
     $56 = $55 << 31 >> 31;
     $57 = $arg;
     $58 = $57;
     HEAP32[$58>>2] = $54;
     $59 = (($57) + 4)|0;
     $60 = $59;
     HEAP32[$60>>2] = $56;
     break L1;
     break;
    }
    case 14:  {
     $arglist_current14 = HEAP32[$ap>>2]|0;
     $61 = $arglist_current14;
     $62 = ((0) + 4|0);
     $expanded63 = $62;
     $expanded62 = (($expanded63) - 1)|0;
     $63 = (($61) + ($expanded62))|0;
     $64 = ((0) + 4|0);
     $expanded67 = $64;
     $expanded66 = (($expanded67) - 1)|0;
     $expanded65 = $expanded66 ^ -1;
     $65 = $63 & $expanded65;
     $66 = $65;
     $67 = HEAP32[$66>>2]|0;
     $arglist_next15 = ((($66)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next15;
     $conv22$mask = $67 & 65535;
     $68 = $arg;
     $69 = $68;
     HEAP32[$69>>2] = $conv22$mask;
     $70 = (($68) + 4)|0;
     $71 = $70;
     HEAP32[$71>>2] = 0;
     break L1;
     break;
    }
    case 15:  {
     $arglist_current17 = HEAP32[$ap>>2]|0;
     $72 = $arglist_current17;
     $73 = ((0) + 4|0);
     $expanded70 = $73;
     $expanded69 = (($expanded70) - 1)|0;
     $74 = (($72) + ($expanded69))|0;
     $75 = ((0) + 4|0);
     $expanded74 = $75;
     $expanded73 = (($expanded74) - 1)|0;
     $expanded72 = $expanded73 ^ -1;
     $76 = $74 & $expanded72;
     $77 = $76;
     $78 = HEAP32[$77>>2]|0;
     $arglist_next18 = ((($77)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next18;
     $conv28 = $78&255;
     $79 = $conv28 << 24 >> 24;
     $80 = ($79|0)<(0);
     $81 = $80 << 31 >> 31;
     $82 = $arg;
     $83 = $82;
     HEAP32[$83>>2] = $79;
     $84 = (($82) + 4)|0;
     $85 = $84;
     HEAP32[$85>>2] = $81;
     break L1;
     break;
    }
    case 16:  {
     $arglist_current20 = HEAP32[$ap>>2]|0;
     $86 = $arglist_current20;
     $87 = ((0) + 4|0);
     $expanded77 = $87;
     $expanded76 = (($expanded77) - 1)|0;
     $88 = (($86) + ($expanded76))|0;
     $89 = ((0) + 4|0);
     $expanded81 = $89;
     $expanded80 = (($expanded81) - 1)|0;
     $expanded79 = $expanded80 ^ -1;
     $90 = $88 & $expanded79;
     $91 = $90;
     $92 = HEAP32[$91>>2]|0;
     $arglist_next21 = ((($91)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next21;
     $conv34$mask = $92 & 255;
     $93 = $arg;
     $94 = $93;
     HEAP32[$94>>2] = $conv34$mask;
     $95 = (($93) + 4)|0;
     $96 = $95;
     HEAP32[$96>>2] = 0;
     break L1;
     break;
    }
    case 17:  {
     $arglist_current23 = HEAP32[$ap>>2]|0;
     $97 = $arglist_current23;
     $98 = ((0) + 8|0);
     $expanded84 = $98;
     $expanded83 = (($expanded84) - 1)|0;
     $99 = (($97) + ($expanded83))|0;
     $100 = ((0) + 8|0);
     $expanded88 = $100;
     $expanded87 = (($expanded88) - 1)|0;
     $expanded86 = $expanded87 ^ -1;
     $101 = $99 & $expanded86;
     $102 = $101;
     $103 = +HEAPF64[$102>>3];
     $arglist_next24 = ((($102)) + 8|0);
     HEAP32[$ap>>2] = $arglist_next24;
     HEAPF64[$arg>>3] = $103;
     break L1;
     break;
    }
    case 18:  {
     $arglist_current26 = HEAP32[$ap>>2]|0;
     $104 = $arglist_current26;
     $105 = ((0) + 8|0);
     $expanded91 = $105;
     $expanded90 = (($expanded91) - 1)|0;
     $106 = (($104) + ($expanded90))|0;
     $107 = ((0) + 8|0);
     $expanded95 = $107;
     $expanded94 = (($expanded95) - 1)|0;
     $expanded93 = $expanded94 ^ -1;
     $108 = $106 & $expanded93;
     $109 = $108;
     $110 = +HEAPF64[$109>>3];
     $arglist_next27 = ((($109)) + 8|0);
     HEAP32[$ap>>2] = $arglist_next27;
     HEAPF64[$arg>>3] = $110;
     break L1;
     break;
    }
    default: {
     break L1;
    }
    }
   } while(0);
  }
 } while(0);
 return;
}
function _fmt_x($0,$1,$s,$lower) {
 $0 = $0|0;
 $1 = $1|0;
 $s = $s|0;
 $lower = $lower|0;
 var $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $arrayidx = 0, $conv1 = 0, $conv4 = 0, $idxprom = 0, $incdec$ptr = 0, $or = 0, $s$addr$0$lcssa = 0, $s$addr$06 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0);
 $3 = ($1|0)==(0);
 $4 = $2 & $3;
 if ($4) {
  $s$addr$0$lcssa = $s;
 } else {
  $5 = $0;$7 = $1;$s$addr$06 = $s;
  while(1) {
   $idxprom = $5 & 15;
   $arrayidx = (2258 + ($idxprom)|0);
   $6 = HEAP8[$arrayidx>>0]|0;
   $conv4 = $6&255;
   $or = $conv4 | $lower;
   $conv1 = $or&255;
   $incdec$ptr = ((($s$addr$06)) + -1|0);
   HEAP8[$incdec$ptr>>0] = $conv1;
   $8 = (_bitshift64Lshr(($5|0),($7|0),4)|0);
   $9 = tempRet0;
   $10 = ($8|0)==(0);
   $11 = ($9|0)==(0);
   $12 = $10 & $11;
   if ($12) {
    $s$addr$0$lcssa = $incdec$ptr;
    break;
   } else {
    $5 = $8;$7 = $9;$s$addr$06 = $incdec$ptr;
   }
  }
 }
 return ($s$addr$0$lcssa|0);
}
function _fmt_o($0,$1,$s) {
 $0 = $0|0;
 $1 = $1|0;
 $s = $s|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $conv = 0, $incdec$ptr = 0, $s$addr$0$lcssa = 0, $s$addr$06 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0);
 $3 = ($1|0)==(0);
 $4 = $2 & $3;
 if ($4) {
  $s$addr$0$lcssa = $s;
 } else {
  $6 = $0;$8 = $1;$s$addr$06 = $s;
  while(1) {
   $5 = $6&255;
   $7 = $5 & 7;
   $conv = $7 | 48;
   $incdec$ptr = ((($s$addr$06)) + -1|0);
   HEAP8[$incdec$ptr>>0] = $conv;
   $9 = (_bitshift64Lshr(($6|0),($8|0),3)|0);
   $10 = tempRet0;
   $11 = ($9|0)==(0);
   $12 = ($10|0)==(0);
   $13 = $11 & $12;
   if ($13) {
    $s$addr$0$lcssa = $incdec$ptr;
    break;
   } else {
    $6 = $9;$8 = $10;$s$addr$06 = $incdec$ptr;
   }
  }
 }
 return ($s$addr$0$lcssa|0);
}
function _fmt_u($0,$1,$s) {
 $0 = $0|0;
 $1 = $1|0;
 $s = $s|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $add5 = 0, $conv = 0;
 var $conv6 = 0, $div9 = 0, $incdec$ptr = 0, $incdec$ptr7 = 0, $rem4 = 0, $s$addr$0$lcssa = 0, $s$addr$013 = 0, $s$addr$1$lcssa = 0, $s$addr$19 = 0, $tobool8 = 0, $x$addr$0$lcssa$off0 = 0, $y$010 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1>>>0)>(0);
 $3 = ($0>>>0)>(4294967295);
 $4 = ($1|0)==(0);
 $5 = $4 & $3;
 $6 = $2 | $5;
 if ($6) {
  $7 = $0;$8 = $1;$s$addr$013 = $s;
  while(1) {
   $9 = (___uremdi3(($7|0),($8|0),10,0)|0);
   $10 = tempRet0;
   $11 = $9&255;
   $conv = $11 | 48;
   $incdec$ptr = ((($s$addr$013)) + -1|0);
   HEAP8[$incdec$ptr>>0] = $conv;
   $12 = (___udivdi3(($7|0),($8|0),10,0)|0);
   $13 = tempRet0;
   $14 = ($8>>>0)>(9);
   $15 = ($7>>>0)>(4294967295);
   $16 = ($8|0)==(9);
   $17 = $16 & $15;
   $18 = $14 | $17;
   if ($18) {
    $7 = $12;$8 = $13;$s$addr$013 = $incdec$ptr;
   } else {
    break;
   }
  }
  $s$addr$0$lcssa = $incdec$ptr;$x$addr$0$lcssa$off0 = $12;
 } else {
  $s$addr$0$lcssa = $s;$x$addr$0$lcssa$off0 = $0;
 }
 $tobool8 = ($x$addr$0$lcssa$off0|0)==(0);
 if ($tobool8) {
  $s$addr$1$lcssa = $s$addr$0$lcssa;
 } else {
  $s$addr$19 = $s$addr$0$lcssa;$y$010 = $x$addr$0$lcssa$off0;
  while(1) {
   $rem4 = (($y$010>>>0) % 10)&-1;
   $add5 = $rem4 | 48;
   $conv6 = $add5&255;
   $incdec$ptr7 = ((($s$addr$19)) + -1|0);
   HEAP8[$incdec$ptr7>>0] = $conv6;
   $div9 = (($y$010>>>0) / 10)&-1;
   $19 = ($y$010>>>0)<(10);
   if ($19) {
    $s$addr$1$lcssa = $incdec$ptr7;
    break;
   } else {
    $s$addr$19 = $incdec$ptr7;$y$010 = $div9;
   }
  }
 }
 return ($s$addr$1$lcssa|0);
}
function _strerror($e) {
 $e = $e|0;
 var $0 = 0, $call = 0, $call1 = 0, $locale = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $call = (___pthread_self_104()|0);
 $locale = ((($call)) + 188|0);
 $0 = HEAP32[$locale>>2]|0;
 $call1 = (___strerror_l($e,$0)|0);
 return ($call1|0);
}
function _memchr($src,$c,$n) {
 $src = $src|0;
 $c = $c|0;
 $n = $n|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $and = 0, $and15 = 0, $and16 = 0, $and39 = 0, $cmp = 0, $cmp11 = 0, $cmp1132 = 0, $cmp28 = 0, $cmp8 = 0, $cond = 0, $conv1 = 0, $dec = 0;
 var $dec34 = 0, $incdec$ptr = 0, $incdec$ptr21 = 0, $incdec$ptr33 = 0, $lnot = 0, $mul = 0, $n$addr$0$lcssa = 0, $n$addr$0$lcssa52 = 0, $n$addr$043 = 0, $n$addr$1$lcssa = 0, $n$addr$133 = 0, $n$addr$227 = 0, $n$addr$3 = 0, $neg = 0, $or$cond = 0, $or$cond42 = 0, $s$0$lcssa = 0, $s$0$lcssa53 = 0, $s$044 = 0, $s$128 = 0;
 var $s$2 = 0, $sub = 0, $sub22 = 0, $tobool = 0, $tobool2 = 0, $tobool2$lcssa = 0, $tobool241 = 0, $tobool25 = 0, $tobool2526 = 0, $tobool36 = 0, $tobool40 = 0, $w$0$lcssa = 0, $w$034 = 0, $xor = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $conv1 = $c & 255;
 $0 = $src;
 $and39 = $0 & 3;
 $tobool40 = ($and39|0)!=(0);
 $tobool241 = ($n|0)!=(0);
 $or$cond42 = $tobool241 & $tobool40;
 L1: do {
  if ($or$cond42) {
   $1 = $c&255;
   $n$addr$043 = $n;$s$044 = $src;
   while(1) {
    $2 = HEAP8[$s$044>>0]|0;
    $cmp = ($2<<24>>24)==($1<<24>>24);
    if ($cmp) {
     $n$addr$0$lcssa52 = $n$addr$043;$s$0$lcssa53 = $s$044;
     label = 6;
     break L1;
    }
    $incdec$ptr = ((($s$044)) + 1|0);
    $dec = (($n$addr$043) + -1)|0;
    $3 = $incdec$ptr;
    $and = $3 & 3;
    $tobool = ($and|0)!=(0);
    $tobool2 = ($dec|0)!=(0);
    $or$cond = $tobool2 & $tobool;
    if ($or$cond) {
     $n$addr$043 = $dec;$s$044 = $incdec$ptr;
    } else {
     $n$addr$0$lcssa = $dec;$s$0$lcssa = $incdec$ptr;$tobool2$lcssa = $tobool2;
     label = 5;
     break;
    }
   }
  } else {
   $n$addr$0$lcssa = $n;$s$0$lcssa = $src;$tobool2$lcssa = $tobool241;
   label = 5;
  }
 } while(0);
 if ((label|0) == 5) {
  if ($tobool2$lcssa) {
   $n$addr$0$lcssa52 = $n$addr$0$lcssa;$s$0$lcssa53 = $s$0$lcssa;
   label = 6;
  } else {
   $n$addr$3 = 0;$s$2 = $s$0$lcssa;
  }
 }
 L8: do {
  if ((label|0) == 6) {
   $4 = HEAP8[$s$0$lcssa53>>0]|0;
   $5 = $c&255;
   $cmp8 = ($4<<24>>24)==($5<<24>>24);
   if ($cmp8) {
    $n$addr$3 = $n$addr$0$lcssa52;$s$2 = $s$0$lcssa53;
   } else {
    $mul = Math_imul($conv1, 16843009)|0;
    $cmp1132 = ($n$addr$0$lcssa52>>>0)>(3);
    L11: do {
     if ($cmp1132) {
      $n$addr$133 = $n$addr$0$lcssa52;$w$034 = $s$0$lcssa53;
      while(1) {
       $6 = HEAP32[$w$034>>2]|0;
       $xor = $6 ^ $mul;
       $sub = (($xor) + -16843009)|0;
       $neg = $xor & -2139062144;
       $and15 = $neg ^ -2139062144;
       $and16 = $and15 & $sub;
       $lnot = ($and16|0)==(0);
       if (!($lnot)) {
        break;
       }
       $incdec$ptr21 = ((($w$034)) + 4|0);
       $sub22 = (($n$addr$133) + -4)|0;
       $cmp11 = ($sub22>>>0)>(3);
       if ($cmp11) {
        $n$addr$133 = $sub22;$w$034 = $incdec$ptr21;
       } else {
        $n$addr$1$lcssa = $sub22;$w$0$lcssa = $incdec$ptr21;
        label = 11;
        break L11;
       }
      }
      $n$addr$227 = $n$addr$133;$s$128 = $w$034;
     } else {
      $n$addr$1$lcssa = $n$addr$0$lcssa52;$w$0$lcssa = $s$0$lcssa53;
      label = 11;
     }
    } while(0);
    if ((label|0) == 11) {
     $tobool2526 = ($n$addr$1$lcssa|0)==(0);
     if ($tobool2526) {
      $n$addr$3 = 0;$s$2 = $w$0$lcssa;
      break;
     } else {
      $n$addr$227 = $n$addr$1$lcssa;$s$128 = $w$0$lcssa;
     }
    }
    while(1) {
     $7 = HEAP8[$s$128>>0]|0;
     $cmp28 = ($7<<24>>24)==($5<<24>>24);
     if ($cmp28) {
      $n$addr$3 = $n$addr$227;$s$2 = $s$128;
      break L8;
     }
     $incdec$ptr33 = ((($s$128)) + 1|0);
     $dec34 = (($n$addr$227) + -1)|0;
     $tobool25 = ($dec34|0)==(0);
     if ($tobool25) {
      $n$addr$3 = 0;$s$2 = $incdec$ptr33;
      break;
     } else {
      $n$addr$227 = $dec34;$s$128 = $incdec$ptr33;
     }
    }
   }
  }
 } while(0);
 $tobool36 = ($n$addr$3|0)!=(0);
 $cond = $tobool36 ? $s$2 : 0;
 return ($cond|0);
}
function _pad_684($f,$c,$w,$l,$fl) {
 $f = $f|0;
 $c = $c|0;
 $w = $w|0;
 $l = $l|0;
 $fl = $fl|0;
 var $0 = 0, $1 = 0, $2 = 0, $and = 0, $cmp = 0, $cmp3 = 0, $cmp38 = 0, $cond = 0, $l$addr$0$lcssa = 0, $l$addr$09 = 0, $or$cond = 0, $pad = 0, $sub = 0, $sub6 = 0, $tobool = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(256|0);
 $pad = sp;
 $and = $fl & 73728;
 $tobool = ($and|0)==(0);
 $cmp = ($w|0)>($l|0);
 $or$cond = $cmp & $tobool;
 if ($or$cond) {
  $sub = (($w) - ($l))|0;
  $0 = ($sub>>>0)<(256);
  $cond = $0 ? $sub : 256;
  _memset(($pad|0),($c|0),($cond|0))|0;
  $cmp38 = ($sub>>>0)>(255);
  if ($cmp38) {
   $1 = (($w) - ($l))|0;
   $l$addr$09 = $sub;
   while(1) {
    _out($f,$pad,256);
    $sub6 = (($l$addr$09) + -256)|0;
    $cmp3 = ($sub6>>>0)>(255);
    if ($cmp3) {
     $l$addr$09 = $sub6;
    } else {
     break;
    }
   }
   $2 = $1 & 255;
   $l$addr$0$lcssa = $2;
  } else {
   $l$addr$0$lcssa = $sub;
  }
  _out($f,$pad,$l$addr$0$lcssa);
 }
 STACKTOP = sp;return;
}
function _wctomb($s,$wc) {
 $s = $s|0;
 $wc = $wc|0;
 var $call = 0, $retval$0 = 0, $tobool = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $tobool = ($s|0)==(0|0);
 if ($tobool) {
  $retval$0 = 0;
 } else {
  $call = (_wcrtomb($s,$wc,0)|0);
  $retval$0 = $call;
 }
 return ($retval$0|0);
}
function _fmt_fp($f,$y,$w,$p,$fl,$t) {
 $f = $f|0;
 $y = +$y;
 $w = $w|0;
 $p = $p|0;
 $fl = $fl|0;
 $t = $t|0;
 var $$ = 0, $$$ = 0, $$$405 = 0.0, $$394$ = 0, $$397 = 0.0, $$405 = 0.0, $$p = 0, $$p$inc468 = 0, $$pr = 0, $$pr407 = 0, $$pre = 0, $$pre487 = 0, $$sub514 = 0, $$sub562 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0;
 var $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0;
 var $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $8 = 0, $9 = 0, $a$1$lcssa = 0, $a$1476 = 0, $a$2$ph = 0, $a$3$lcssa = 0, $a$3466 = 0, $a$5$lcssa = 0, $a$5448 = 0, $a$6 = 0, $a$8 = 0;
 var $a$9$ph = 0, $add = 0, $add$ptr213 = 0, $add$ptr311 = 0, $add$ptr311$z$4 = 0, $add$ptr354 = 0, $add$ptr358 = 0, $add$ptr373 = 0, $add$ptr442 = 0, $add$ptr442$z$3 = 0, $add$ptr65 = 0, $add$ptr671 = 0, $add$ptr742 = 0, $add$ptr756 = 0, $add113 = 0, $add150 = 0, $add150$pn = 0, $add165 = 0, $add273 = 0, $add275 = 0;
 var $add284 = 0, $add313 = 0, $add355 = 0, $add410 = 0.0, $add414 = 0, $add477$neg = 0, $add561 = 0, $add608 = 0, $add612 = 0, $add620 = 0, $add653 = 0, $add653$sink406 = 0, $add67 = 0, $add737 = 0, $add810 = 0, $add87 = 0.0, $add90 = 0.0, $and = 0, $and12 = 0, $and134 = 0;
 var $and282 = 0, $and36 = 0, $and379 = 0, $and45 = 0, $and483 = 0, $and610$pre$phiZ2D = 0, $and62 = 0, $arraydecay208$add$ptr213 = 0, $arrayidx = 0, $arrayidx117 = 0, $arrayidx251 = 0, $arrayidx453 = 0, $arrayidx489 = 0, $big = 0, $buf = 0, $call55 = 0.0, $carry$0471 = 0, $carry262$0462 = 0, $cmp103 = 0, $cmp127 = 0;
 var $cmp147 = 0, $cmp205 = 0, $cmp225 = 0, $cmp225474 = 0, $cmp235 = 0, $cmp235470 = 0, $cmp249 = 0, $cmp259 = 0, $cmp259464 = 0, $cmp277 = 0, $cmp277460 = 0, $cmp299 = 0, $cmp308 = 0, $cmp315 = 0, $cmp324 = 0, $cmp324456 = 0, $cmp333 = 0, $cmp338 = 0, $cmp350 = 0, $cmp363452 = 0;
 var $cmp374 = 0, $cmp38 = 0, $cmp385 = 0, $cmp390 = 0, $cmp403 = 0, $cmp411 = 0, $cmp416 = 0, $cmp416446 = 0, $cmp420 = 0, $cmp433 = 0, $cmp433442 = 0, $cmp443 = 0, $cmp450 = 0, $cmp450$lcssa = 0, $cmp470 = 0, $cmp473 = 0, $cmp495 = 0, $cmp495438 = 0, $cmp505 = 0, $cmp528 = 0;
 var $cmp577 = 0, $cmp59 = 0, $cmp614 = 0, $cmp617 = 0, $cmp623 = 0, $cmp636 = 0, $cmp636433 = 0, $cmp660 = 0, $cmp665 = 0, $cmp673 = 0, $cmp678 = 0, $cmp678419 = 0, $cmp68 = 0, $cmp686 = 0, $cmp707 = 0, $cmp707414 = 0, $cmp710 = 0, $cmp710415 = 0, $cmp722 = 0, $cmp722411 = 0;
 var $cmp745 = 0, $cmp748 = 0, $cmp748427 = 0, $cmp760 = 0, $cmp765 = 0, $cmp770 = 0, $cmp770423 = 0, $cmp777 = 0, $cmp790 = 0, $cmp818 = 0, $cmp82 = 0, $cmp94 = 0, $cond = 0, $cond100 = 0, $cond233 = 0, $cond271 = 0, $cond304 = 0, $cond43 = 0, $cond629 = 0, $cond732 = 0;
 var $cond800 = 0, $conv111 = 0, $conv114 = 0, $conv116 = 0, $conv118393 = 0, $conv121 = 0, $conv123 = 0.0, $conv216 = 0, $conv218 = 0.0, $conv644 = 0, $conv646 = 0, $d$0 = 0, $d$0469 = 0, $d$0472 = 0, $d$1461 = 0, $d$4 = 0, $d$5422 = 0, $d$6416 = 0, $d$7428 = 0, $dec = 0;
 var $dec476 = 0, $dec481 = 0, $dec78 = 0, $div274 = 0, $div356 = 0, $div378 = 0, $div384 = 0, $e$0458 = 0, $e$1 = 0, $e$2444 = 0, $e$4 = 0, $e$5$ph = 0, $e2 = 0, $ebuf0 = 0, $estr$0 = 0, $estr$1$lcssa = 0, $estr$1434 = 0, $estr$2 = 0, $exitcond = 0, $i$0457 = 0;
 var $i$1$lcssa = 0, $i$1453 = 0, $i$2443 = 0, $i$3439 = 0, $inc = 0, $inc425 = 0, $inc438 = 0, $inc468 = 0, $inc500 = 0, $incdec$ptr106 = 0, $incdec$ptr112 = 0, $incdec$ptr115 = 0, $incdec$ptr122 = 0, $incdec$ptr137 = 0, $incdec$ptr217 = 0, $incdec$ptr246 = 0, $incdec$ptr288 = 0, $incdec$ptr292 = 0, $incdec$ptr292$a$3 = 0, $incdec$ptr292$a$3492 = 0;
 var $incdec$ptr292$a$3494 = 0, $incdec$ptr292491 = 0, $incdec$ptr296 = 0, $incdec$ptr419 = 0, $incdec$ptr419$sink$lcssa = 0, $incdec$ptr419$sink447 = 0, $incdec$ptr423 = 0, $incdec$ptr639 = 0, $incdec$ptr645 = 0, $incdec$ptr647 = 0, $incdec$ptr681 = 0, $incdec$ptr689 = 0, $incdec$ptr698 = 0, $incdec$ptr725 = 0, $incdec$ptr734 = 0, $incdec$ptr763 = 0, $incdec$ptr773 = 0, $incdec$ptr776 = 0, $incdec$ptr808 = 0, $j$0 = 0;
 var $j$0451 = 0, $j$0454 = 0, $j$1440 = 0, $j$2 = 0, $l$0 = 0, $l$1 = 0, $land$ext$neg = 0, $lnot = 0, $lnot455 = 0, $lor$ext = 0, $mul = 0.0, $mul125 = 0.0, $mul202 = 0.0, $mul220 = 0.0, $mul286 = 0, $mul322 = 0, $mul328 = 0, $mul335 = 0, $mul349 = 0, $mul367 = 0;
 var $mul406 = 0.0, $mul406$$397 = 0.0, $mul407 = 0.0, $mul407$$$405 = 0.0, $mul431 = 0, $mul437 = 0, $mul499 = 0, $mul513 = 0, $mul80 = 0.0, $narrow = 0, $not$tobool341 = 0, $notlhs = 0, $notrhs = 0, $or = 0, $or$cond = 0, $or$cond1$not = 0, $or$cond2 = 0, $or$cond395 = 0, $or$cond396 = 0, $or$cond398 = 0;
 var $or$cond402 = 0, $or120 = 0, $or504 = 0, $or613 = 0, $p$addr$2 = 0, $p$addr$2$$sub514399 = 0, $p$addr$2$$sub562400 = 0, $p$addr$3 = 0, $p$addr$4$lcssa = 0, $p$addr$4417 = 0, $p$addr$5$lcssa = 0, $p$addr$5429 = 0, $pl$0 = 0, $prefix$0 = 0, $prefix$0$add$ptr65 = 0, $r$0$a$9 = 0, $re$1410 = 0, $rem360 = 0, $rem370 = 0, $rem494 = 0;
 var $rem494437 = 0, $round$0409 = 0.0, $round377$1 = 0.0, $s$0 = 0, $s$1 = 0, $s35$0 = 0, $s668$0420 = 0, $s668$1 = 0, $s715$0$lcssa = 0, $s715$0412 = 0, $s753$0 = 0, $s753$1424 = 0, $s753$2 = 0, $scevgep483 = 0, $scevgep483484 = 0, $shl280 = 0, $shr283 = 0, $shr285 = 0, $small$1 = 0.0, $sub = 0.0;
 var $sub$ptr$div = 0, $sub$ptr$div321 = 0, $sub$ptr$div347 = 0, $sub$ptr$div430 = 0, $sub$ptr$div511 = 0, $sub$ptr$lhs$cast = 0, $sub$ptr$lhs$cast143 = 0, $sub$ptr$lhs$cast151 = 0, $sub$ptr$lhs$cast305 = 0, $sub$ptr$lhs$cast318 = 0, $sub$ptr$lhs$cast344 = 0, $sub$ptr$lhs$cast508 = 0, $sub$ptr$lhs$cast633 = 0, $sub$ptr$lhs$cast694 = 0, $sub$ptr$lhs$cast787 = 0, $sub$ptr$lhs$cast811 = 0, $sub$ptr$rhs$cast = 0, $sub$ptr$rhs$cast152 = 0, $sub$ptr$rhs$cast306 = 0, $sub$ptr$rhs$cast319 = 0;
 var $sub$ptr$rhs$cast428 = 0, $sub$ptr$rhs$cast634 = 0, $sub$ptr$rhs$cast634431 = 0, $sub$ptr$rhs$cast649 = 0, $sub$ptr$rhs$cast695 = 0, $sub$ptr$rhs$cast788 = 0, $sub$ptr$rhs$cast812 = 0, $sub$ptr$sub = 0, $sub$ptr$sub145 = 0, $sub$ptr$sub153 = 0, $sub$ptr$sub307 = 0, $sub$ptr$sub320 = 0, $sub$ptr$sub346 = 0, $sub$ptr$sub429 = 0, $sub$ptr$sub510 = 0, $sub$ptr$sub635 = 0, $sub$ptr$sub635432 = 0, $sub$ptr$sub650 = 0, $sub$ptr$sub650$pn = 0, $sub$ptr$sub696 = 0;
 var $sub$ptr$sub789 = 0, $sub$ptr$sub813 = 0, $sub124 = 0.0, $sub146 = 0, $sub181 = 0, $sub203 = 0, $sub219 = 0.0, $sub256 = 0, $sub264 = 0, $sub281 = 0, $sub336 = 0, $sub343 = 0, $sub357 = 0, $sub409 = 0, $sub478 = 0, $sub480 = 0, $sub514 = 0, $sub562 = 0, $sub626$le = 0, $sub735 = 0;
 var $sub74 = 0, $sub806 = 0, $sub85 = 0.0, $sub86 = 0.0, $sub88 = 0.0, $sub91 = 0.0, $sub97 = 0, $t$addr$0 = 0, $t$addr$1 = 0, $tobool13 = 0, $tobool135 = 0, $tobool139 = 0, $tobool140 = 0, $tobool222 = 0, $tobool244 = 0, $tobool290 = 0, $tobool290490 = 0, $tobool294 = 0, $tobool341 = 0, $tobool37 = 0;
 var $tobool371 = 0, $tobool380 = 0, $tobool400 = 0, $tobool484 = 0, $tobool490 = 0, $tobool56 = 0, $tobool63 = 0, $tobool76 = 0, $tobool76488 = 0, $tobool781 = 0, $tobool79 = 0, $tobool9 = 0, $w$add653 = 0, $xor = 0, $xor167 = 0, $xor186 = 0, $xor655 = 0, $xor816 = 0, $y$addr$0 = 0.0, $y$addr$1 = 0.0;
 var $y$addr$2 = 0.0, $y$addr$3 = 0.0, $y$addr$4 = 0.0, $z$0 = 0, $z$1$lcssa = 0, $z$1475 = 0, $z$2 = 0, $z$3$lcssa = 0, $z$3465 = 0, $z$4 = 0, $z$7 = 0, $z$7$add$ptr742 = 0, $z$7$ph = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 560|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(560|0);
 $big = sp + 8|0;
 $e2 = sp;
 $buf = sp + 524|0;
 $sub$ptr$rhs$cast = $buf;
 $ebuf0 = sp + 512|0;
 HEAP32[$e2>>2] = 0;
 $arrayidx = ((($ebuf0)) + 12|0);
 (___DOUBLE_BITS_685($y)|0);
 $0 = tempRet0;
 $1 = ($0|0)<(0);
 if ($1) {
  $sub = -$y;
  $pl$0 = 1;$prefix$0 = 2223;$y$addr$0 = $sub;
 } else {
  $and = $fl & 2048;
  $tobool9 = ($and|0)==(0);
  $and12 = $fl & 1;
  $tobool13 = ($and12|0)==(0);
  $$ = $tobool13 ? (2224) : (2229);
  $$$ = $tobool9 ? $$ : (2226);
  $2 = $fl & 2049;
  $narrow = ($2|0)!=(0);
  $$394$ = $narrow&1;
  $pl$0 = $$394$;$prefix$0 = $$$;$y$addr$0 = $y;
 }
 (___DOUBLE_BITS_685($y$addr$0)|0);
 $3 = tempRet0;
 $4 = $3 & 2146435072;
 $5 = ($4>>>0)<(2146435072);
 $6 = (0)<(0);
 $7 = ($4|0)==(2146435072);
 $8 = $7 & $6;
 $9 = $5 | $8;
 do {
  if ($9) {
   $call55 = (+_frexpl($y$addr$0,$e2));
   $mul = $call55 * 2.0;
   $tobool56 = $mul != 0.0;
   if ($tobool56) {
    $10 = HEAP32[$e2>>2]|0;
    $dec = (($10) + -1)|0;
    HEAP32[$e2>>2] = $dec;
   }
   $or = $t | 32;
   $cmp59 = ($or|0)==(97);
   if ($cmp59) {
    $and62 = $t & 32;
    $tobool63 = ($and62|0)==(0);
    $add$ptr65 = ((($prefix$0)) + 9|0);
    $prefix$0$add$ptr65 = $tobool63 ? $prefix$0 : $add$ptr65;
    $add67 = $pl$0 | 2;
    $11 = ($p>>>0)>(11);
    $sub74 = (12 - ($p))|0;
    $tobool76488 = ($sub74|0)==(0);
    $tobool76 = $11 | $tobool76488;
    do {
     if ($tobool76) {
      $y$addr$1 = $mul;
     } else {
      $re$1410 = $sub74;$round$0409 = 8.0;
      while(1) {
       $dec78 = (($re$1410) + -1)|0;
       $mul80 = $round$0409 * 16.0;
       $tobool79 = ($dec78|0)==(0);
       if ($tobool79) {
        break;
       } else {
        $re$1410 = $dec78;$round$0409 = $mul80;
       }
      }
      $12 = HEAP8[$prefix$0$add$ptr65>>0]|0;
      $cmp82 = ($12<<24>>24)==(45);
      if ($cmp82) {
       $sub85 = -$mul;
       $sub86 = $sub85 - $mul80;
       $add87 = $mul80 + $sub86;
       $sub88 = -$add87;
       $y$addr$1 = $sub88;
       break;
      } else {
       $add90 = $mul + $mul80;
       $sub91 = $add90 - $mul80;
       $y$addr$1 = $sub91;
       break;
      }
     }
    } while(0);
    $13 = HEAP32[$e2>>2]|0;
    $cmp94 = ($13|0)<(0);
    $sub97 = (0 - ($13))|0;
    $cond100 = $cmp94 ? $sub97 : $13;
    $14 = ($cond100|0)<(0);
    $15 = $14 << 31 >> 31;
    $16 = (_fmt_u($cond100,$15,$arrayidx)|0);
    $cmp103 = ($16|0)==($arrayidx|0);
    if ($cmp103) {
     $incdec$ptr106 = ((($ebuf0)) + 11|0);
     HEAP8[$incdec$ptr106>>0] = 48;
     $estr$0 = $incdec$ptr106;
    } else {
     $estr$0 = $16;
    }
    $17 = $13 >> 31;
    $18 = $17 & 2;
    $19 = (($18) + 43)|0;
    $conv111 = $19&255;
    $incdec$ptr112 = ((($estr$0)) + -1|0);
    HEAP8[$incdec$ptr112>>0] = $conv111;
    $add113 = (($t) + 15)|0;
    $conv114 = $add113&255;
    $incdec$ptr115 = ((($estr$0)) + -2|0);
    HEAP8[$incdec$ptr115>>0] = $conv114;
    $notrhs = ($p|0)<(1);
    $and134 = $fl & 8;
    $tobool135 = ($and134|0)==(0);
    $s$0 = $buf;$y$addr$2 = $y$addr$1;
    while(1) {
     $conv116 = (~~(($y$addr$2)));
     $arrayidx117 = (2258 + ($conv116)|0);
     $20 = HEAP8[$arrayidx117>>0]|0;
     $conv118393 = $20&255;
     $or120 = $conv118393 | $and62;
     $conv121 = $or120&255;
     $incdec$ptr122 = ((($s$0)) + 1|0);
     HEAP8[$s$0>>0] = $conv121;
     $conv123 = (+($conv116|0));
     $sub124 = $y$addr$2 - $conv123;
     $mul125 = $sub124 * 16.0;
     $sub$ptr$lhs$cast = $incdec$ptr122;
     $sub$ptr$sub = (($sub$ptr$lhs$cast) - ($sub$ptr$rhs$cast))|0;
     $cmp127 = ($sub$ptr$sub|0)==(1);
     if ($cmp127) {
      $notlhs = $mul125 == 0.0;
      $or$cond1$not = $notrhs & $notlhs;
      $or$cond = $tobool135 & $or$cond1$not;
      if ($or$cond) {
       $s$1 = $incdec$ptr122;
      } else {
       $incdec$ptr137 = ((($s$0)) + 2|0);
       HEAP8[$incdec$ptr122>>0] = 46;
       $s$1 = $incdec$ptr137;
      }
     } else {
      $s$1 = $incdec$ptr122;
     }
     $tobool139 = $mul125 != 0.0;
     if ($tobool139) {
      $s$0 = $s$1;$y$addr$2 = $mul125;
     } else {
      break;
     }
    }
    $tobool140 = ($p|0)!=(0);
    $sub$ptr$rhs$cast152 = $incdec$ptr115;
    $sub$ptr$lhs$cast151 = $arrayidx;
    $sub$ptr$lhs$cast143 = $s$1;
    $sub$ptr$sub145 = (($sub$ptr$lhs$cast143) - ($sub$ptr$rhs$cast))|0;
    $sub$ptr$sub153 = (($sub$ptr$lhs$cast151) - ($sub$ptr$rhs$cast152))|0;
    $sub146 = (($sub$ptr$sub145) + -2)|0;
    $cmp147 = ($sub146|0)<($p|0);
    $or$cond395 = $tobool140 & $cmp147;
    $add150 = (($p) + 2)|0;
    $add150$pn = $or$cond395 ? $add150 : $sub$ptr$sub145;
    $l$0 = (($sub$ptr$sub153) + ($add67))|0;
    $add165 = (($l$0) + ($add150$pn))|0;
    _pad_684($f,32,$w,$add165,$fl);
    _out($f,$prefix$0$add$ptr65,$add67);
    $xor167 = $fl ^ 65536;
    _pad_684($f,48,$w,$add165,$xor167);
    _out($f,$buf,$sub$ptr$sub145);
    $sub181 = (($add150$pn) - ($sub$ptr$sub145))|0;
    _pad_684($f,48,$sub181,0,0);
    _out($f,$incdec$ptr115,$sub$ptr$sub153);
    $xor186 = $fl ^ 8192;
    _pad_684($f,32,$w,$add165,$xor186);
    $add653$sink406 = $add165;
    break;
   }
   $cmp68 = ($p|0)<(0);
   $$p = $cmp68 ? 6 : $p;
   if ($tobool56) {
    $mul202 = $mul * 268435456.0;
    $21 = HEAP32[$e2>>2]|0;
    $sub203 = (($21) + -28)|0;
    HEAP32[$e2>>2] = $sub203;
    $$pr = $sub203;$y$addr$3 = $mul202;
   } else {
    $$pre = HEAP32[$e2>>2]|0;
    $$pr = $$pre;$y$addr$3 = $mul;
   }
   $cmp205 = ($$pr|0)<(0);
   $add$ptr213 = ((($big)) + 288|0);
   $arraydecay208$add$ptr213 = $cmp205 ? $big : $add$ptr213;
   $y$addr$4 = $y$addr$3;$z$0 = $arraydecay208$add$ptr213;
   while(1) {
    $conv216 = (~~(($y$addr$4))>>>0);
    HEAP32[$z$0>>2] = $conv216;
    $incdec$ptr217 = ((($z$0)) + 4|0);
    $conv218 = (+($conv216>>>0));
    $sub219 = $y$addr$4 - $conv218;
    $mul220 = $sub219 * 1.0E+9;
    $tobool222 = $mul220 != 0.0;
    if ($tobool222) {
     $y$addr$4 = $mul220;$z$0 = $incdec$ptr217;
    } else {
     break;
    }
   }
   $cmp225474 = ($$pr|0)>(0);
   if ($cmp225474) {
    $23 = $$pr;$a$1476 = $arraydecay208$add$ptr213;$z$1475 = $incdec$ptr217;
    while(1) {
     $22 = ($23|0)<(29);
     $cond233 = $22 ? $23 : 29;
     $d$0469 = ((($z$1475)) + -4|0);
     $cmp235470 = ($d$0469>>>0)<($a$1476>>>0);
     if ($cmp235470) {
      $a$2$ph = $a$1476;
     } else {
      $carry$0471 = 0;$d$0472 = $d$0469;
      while(1) {
       $24 = HEAP32[$d$0472>>2]|0;
       $25 = (_bitshift64Shl(($24|0),0,($cond233|0))|0);
       $26 = tempRet0;
       $27 = (_i64Add(($25|0),($26|0),($carry$0471|0),0)|0);
       $28 = tempRet0;
       $29 = (___uremdi3(($27|0),($28|0),1000000000,0)|0);
       $30 = tempRet0;
       HEAP32[$d$0472>>2] = $29;
       $31 = (___udivdi3(($27|0),($28|0),1000000000,0)|0);
       $32 = tempRet0;
       $d$0 = ((($d$0472)) + -4|0);
       $cmp235 = ($d$0>>>0)<($a$1476>>>0);
       if ($cmp235) {
        break;
       } else {
        $carry$0471 = $31;$d$0472 = $d$0;
       }
      }
      $tobool244 = ($31|0)==(0);
      if ($tobool244) {
       $a$2$ph = $a$1476;
      } else {
       $incdec$ptr246 = ((($a$1476)) + -4|0);
       HEAP32[$incdec$ptr246>>2] = $31;
       $a$2$ph = $incdec$ptr246;
      }
     }
     $z$2 = $z$1475;
     while(1) {
      $cmp249 = ($z$2>>>0)>($a$2$ph>>>0);
      if (!($cmp249)) {
       break;
      }
      $arrayidx251 = ((($z$2)) + -4|0);
      $33 = HEAP32[$arrayidx251>>2]|0;
      $lnot = ($33|0)==(0);
      if ($lnot) {
       $z$2 = $arrayidx251;
      } else {
       break;
      }
     }
     $34 = HEAP32[$e2>>2]|0;
     $sub256 = (($34) - ($cond233))|0;
     HEAP32[$e2>>2] = $sub256;
     $cmp225 = ($sub256|0)>(0);
     if ($cmp225) {
      $23 = $sub256;$a$1476 = $a$2$ph;$z$1475 = $z$2;
     } else {
      $$pr407 = $sub256;$a$1$lcssa = $a$2$ph;$z$1$lcssa = $z$2;
      break;
     }
    }
   } else {
    $$pr407 = $$pr;$a$1$lcssa = $arraydecay208$add$ptr213;$z$1$lcssa = $incdec$ptr217;
   }
   $cmp259464 = ($$pr407|0)<(0);
   if ($cmp259464) {
    $add273 = (($$p) + 25)|0;
    $div274 = (($add273|0) / 9)&-1;
    $add275 = (($div274) + 1)|0;
    $cmp299 = ($or|0)==(102);
    $35 = $$pr407;$a$3466 = $a$1$lcssa;$z$3465 = $z$1$lcssa;
    while(1) {
     $sub264 = (0 - ($35))|0;
     $36 = ($sub264|0)<(9);
     $cond271 = $36 ? $sub264 : 9;
     $cmp277460 = ($a$3466>>>0)<($z$3465>>>0);
     if ($cmp277460) {
      $shl280 = 1 << $cond271;
      $sub281 = (($shl280) + -1)|0;
      $shr285 = 1000000000 >>> $cond271;
      $carry262$0462 = 0;$d$1461 = $a$3466;
      while(1) {
       $38 = HEAP32[$d$1461>>2]|0;
       $and282 = $38 & $sub281;
       $shr283 = $38 >>> $cond271;
       $add284 = (($shr283) + ($carry262$0462))|0;
       HEAP32[$d$1461>>2] = $add284;
       $mul286 = Math_imul($and282, $shr285)|0;
       $incdec$ptr288 = ((($d$1461)) + 4|0);
       $cmp277 = ($incdec$ptr288>>>0)<($z$3465>>>0);
       if ($cmp277) {
        $carry262$0462 = $mul286;$d$1461 = $incdec$ptr288;
       } else {
        break;
       }
      }
      $39 = HEAP32[$a$3466>>2]|0;
      $tobool290 = ($39|0)==(0);
      $incdec$ptr292 = ((($a$3466)) + 4|0);
      $incdec$ptr292$a$3 = $tobool290 ? $incdec$ptr292 : $a$3466;
      $tobool294 = ($mul286|0)==(0);
      if ($tobool294) {
       $incdec$ptr292$a$3494 = $incdec$ptr292$a$3;$z$4 = $z$3465;
      } else {
       $incdec$ptr296 = ((($z$3465)) + 4|0);
       HEAP32[$z$3465>>2] = $mul286;
       $incdec$ptr292$a$3494 = $incdec$ptr292$a$3;$z$4 = $incdec$ptr296;
      }
     } else {
      $37 = HEAP32[$a$3466>>2]|0;
      $tobool290490 = ($37|0)==(0);
      $incdec$ptr292491 = ((($a$3466)) + 4|0);
      $incdec$ptr292$a$3492 = $tobool290490 ? $incdec$ptr292491 : $a$3466;
      $incdec$ptr292$a$3494 = $incdec$ptr292$a$3492;$z$4 = $z$3465;
     }
     $cond304 = $cmp299 ? $arraydecay208$add$ptr213 : $incdec$ptr292$a$3494;
     $sub$ptr$lhs$cast305 = $z$4;
     $sub$ptr$rhs$cast306 = $cond304;
     $sub$ptr$sub307 = (($sub$ptr$lhs$cast305) - ($sub$ptr$rhs$cast306))|0;
     $sub$ptr$div = $sub$ptr$sub307 >> 2;
     $cmp308 = ($sub$ptr$div|0)>($add275|0);
     $add$ptr311 = (($cond304) + ($add275<<2)|0);
     $add$ptr311$z$4 = $cmp308 ? $add$ptr311 : $z$4;
     $40 = HEAP32[$e2>>2]|0;
     $add313 = (($40) + ($cond271))|0;
     HEAP32[$e2>>2] = $add313;
     $cmp259 = ($add313|0)<(0);
     if ($cmp259) {
      $35 = $add313;$a$3466 = $incdec$ptr292$a$3494;$z$3465 = $add$ptr311$z$4;
     } else {
      $a$3$lcssa = $incdec$ptr292$a$3494;$z$3$lcssa = $add$ptr311$z$4;
      break;
     }
    }
   } else {
    $a$3$lcssa = $a$1$lcssa;$z$3$lcssa = $z$1$lcssa;
   }
   $cmp315 = ($a$3$lcssa>>>0)<($z$3$lcssa>>>0);
   $sub$ptr$lhs$cast318 = $arraydecay208$add$ptr213;
   if ($cmp315) {
    $sub$ptr$rhs$cast319 = $a$3$lcssa;
    $sub$ptr$sub320 = (($sub$ptr$lhs$cast318) - ($sub$ptr$rhs$cast319))|0;
    $sub$ptr$div321 = $sub$ptr$sub320 >> 2;
    $mul322 = ($sub$ptr$div321*9)|0;
    $41 = HEAP32[$a$3$lcssa>>2]|0;
    $cmp324456 = ($41>>>0)<(10);
    if ($cmp324456) {
     $e$1 = $mul322;
    } else {
     $e$0458 = $mul322;$i$0457 = 10;
     while(1) {
      $mul328 = ($i$0457*10)|0;
      $inc = (($e$0458) + 1)|0;
      $cmp324 = ($41>>>0)<($mul328>>>0);
      if ($cmp324) {
       $e$1 = $inc;
       break;
      } else {
       $e$0458 = $inc;$i$0457 = $mul328;
      }
     }
    }
   } else {
    $e$1 = 0;
   }
   $cmp333 = ($or|0)!=(102);
   $mul335 = $cmp333 ? $e$1 : 0;
   $sub336 = (($$p) - ($mul335))|0;
   $cmp338 = ($or|0)==(103);
   $tobool341 = ($$p|0)!=(0);
   $42 = $tobool341 & $cmp338;
   $land$ext$neg = $42 << 31 >> 31;
   $sub343 = (($sub336) + ($land$ext$neg))|0;
   $sub$ptr$lhs$cast344 = $z$3$lcssa;
   $sub$ptr$sub346 = (($sub$ptr$lhs$cast344) - ($sub$ptr$lhs$cast318))|0;
   $sub$ptr$div347 = $sub$ptr$sub346 >> 2;
   $43 = ($sub$ptr$div347*9)|0;
   $mul349 = (($43) + -9)|0;
   $cmp350 = ($sub343|0)<($mul349|0);
   if ($cmp350) {
    $add$ptr354 = ((($arraydecay208$add$ptr213)) + 4|0);
    $add355 = (($sub343) + 9216)|0;
    $div356 = (($add355|0) / 9)&-1;
    $sub357 = (($div356) + -1024)|0;
    $add$ptr358 = (($add$ptr354) + ($sub357<<2)|0);
    $rem360 = (($add355|0) % 9)&-1;
    $j$0451 = (($rem360) + 1)|0;
    $cmp363452 = ($j$0451|0)<(9);
    if ($cmp363452) {
     $i$1453 = 10;$j$0454 = $j$0451;
     while(1) {
      $mul367 = ($i$1453*10)|0;
      $j$0 = (($j$0454) + 1)|0;
      $exitcond = ($j$0|0)==(9);
      if ($exitcond) {
       $i$1$lcssa = $mul367;
       break;
      } else {
       $i$1453 = $mul367;$j$0454 = $j$0;
      }
     }
    } else {
     $i$1$lcssa = 10;
    }
    $44 = HEAP32[$add$ptr358>>2]|0;
    $rem370 = (($44>>>0) % ($i$1$lcssa>>>0))&-1;
    $tobool371 = ($rem370|0)==(0);
    $add$ptr373 = ((($add$ptr358)) + 4|0);
    $cmp374 = ($add$ptr373|0)==($z$3$lcssa|0);
    $or$cond396 = $cmp374 & $tobool371;
    if ($or$cond396) {
     $a$8 = $a$3$lcssa;$d$4 = $add$ptr358;$e$4 = $e$1;
    } else {
     $div378 = (($44>>>0) / ($i$1$lcssa>>>0))&-1;
     $and379 = $div378 & 1;
     $tobool380 = ($and379|0)==(0);
     $$397 = $tobool380 ? 9007199254740992.0 : 9007199254740994.0;
     $div384 = (($i$1$lcssa|0) / 2)&-1;
     $cmp385 = ($rem370>>>0)<($div384>>>0);
     $cmp390 = ($rem370|0)==($div384|0);
     $or$cond398 = $cmp374 & $cmp390;
     $$405 = $or$cond398 ? 1.0 : 1.5;
     $$$405 = $cmp385 ? 0.5 : $$405;
     $tobool400 = ($pl$0|0)==(0);
     if ($tobool400) {
      $round377$1 = $$397;$small$1 = $$$405;
     } else {
      $45 = HEAP8[$prefix$0>>0]|0;
      $cmp403 = ($45<<24>>24)==(45);
      $mul406 = -$$397;
      $mul407 = -$$$405;
      $mul406$$397 = $cmp403 ? $mul406 : $$397;
      $mul407$$$405 = $cmp403 ? $mul407 : $$$405;
      $round377$1 = $mul406$$397;$small$1 = $mul407$$$405;
     }
     $sub409 = (($44) - ($rem370))|0;
     HEAP32[$add$ptr358>>2] = $sub409;
     $add410 = $round377$1 + $small$1;
     $cmp411 = $add410 != $round377$1;
     if ($cmp411) {
      $add414 = (($sub409) + ($i$1$lcssa))|0;
      HEAP32[$add$ptr358>>2] = $add414;
      $cmp416446 = ($add414>>>0)>(999999999);
      if ($cmp416446) {
       $a$5448 = $a$3$lcssa;$incdec$ptr419$sink447 = $add$ptr358;
       while(1) {
        $incdec$ptr419 = ((($incdec$ptr419$sink447)) + -4|0);
        HEAP32[$incdec$ptr419$sink447>>2] = 0;
        $cmp420 = ($incdec$ptr419>>>0)<($a$5448>>>0);
        if ($cmp420) {
         $incdec$ptr423 = ((($a$5448)) + -4|0);
         HEAP32[$incdec$ptr423>>2] = 0;
         $a$6 = $incdec$ptr423;
        } else {
         $a$6 = $a$5448;
        }
        $46 = HEAP32[$incdec$ptr419>>2]|0;
        $inc425 = (($46) + 1)|0;
        HEAP32[$incdec$ptr419>>2] = $inc425;
        $cmp416 = ($inc425>>>0)>(999999999);
        if ($cmp416) {
         $a$5448 = $a$6;$incdec$ptr419$sink447 = $incdec$ptr419;
        } else {
         $a$5$lcssa = $a$6;$incdec$ptr419$sink$lcssa = $incdec$ptr419;
         break;
        }
       }
      } else {
       $a$5$lcssa = $a$3$lcssa;$incdec$ptr419$sink$lcssa = $add$ptr358;
      }
      $sub$ptr$rhs$cast428 = $a$5$lcssa;
      $sub$ptr$sub429 = (($sub$ptr$lhs$cast318) - ($sub$ptr$rhs$cast428))|0;
      $sub$ptr$div430 = $sub$ptr$sub429 >> 2;
      $mul431 = ($sub$ptr$div430*9)|0;
      $47 = HEAP32[$a$5$lcssa>>2]|0;
      $cmp433442 = ($47>>>0)<(10);
      if ($cmp433442) {
       $a$8 = $a$5$lcssa;$d$4 = $incdec$ptr419$sink$lcssa;$e$4 = $mul431;
      } else {
       $e$2444 = $mul431;$i$2443 = 10;
       while(1) {
        $mul437 = ($i$2443*10)|0;
        $inc438 = (($e$2444) + 1)|0;
        $cmp433 = ($47>>>0)<($mul437>>>0);
        if ($cmp433) {
         $a$8 = $a$5$lcssa;$d$4 = $incdec$ptr419$sink$lcssa;$e$4 = $inc438;
         break;
        } else {
         $e$2444 = $inc438;$i$2443 = $mul437;
        }
       }
      }
     } else {
      $a$8 = $a$3$lcssa;$d$4 = $add$ptr358;$e$4 = $e$1;
     }
    }
    $add$ptr442 = ((($d$4)) + 4|0);
    $cmp443 = ($z$3$lcssa>>>0)>($add$ptr442>>>0);
    $add$ptr442$z$3 = $cmp443 ? $add$ptr442 : $z$3$lcssa;
    $a$9$ph = $a$8;$e$5$ph = $e$4;$z$7$ph = $add$ptr442$z$3;
   } else {
    $a$9$ph = $a$3$lcssa;$e$5$ph = $e$1;$z$7$ph = $z$3$lcssa;
   }
   $z$7 = $z$7$ph;
   while(1) {
    $cmp450 = ($z$7>>>0)>($a$9$ph>>>0);
    if (!($cmp450)) {
     $cmp450$lcssa = 0;
     break;
    }
    $arrayidx453 = ((($z$7)) + -4|0);
    $48 = HEAP32[$arrayidx453>>2]|0;
    $lnot455 = ($48|0)==(0);
    if ($lnot455) {
     $z$7 = $arrayidx453;
    } else {
     $cmp450$lcssa = 1;
     break;
    }
   }
   $sub626$le = (0 - ($e$5$ph))|0;
   do {
    if ($cmp338) {
     $not$tobool341 = $tobool341 ^ 1;
     $inc468 = $not$tobool341&1;
     $$p$inc468 = (($inc468) + ($$p))|0;
     $cmp470 = ($$p$inc468|0)>($e$5$ph|0);
     $cmp473 = ($e$5$ph|0)>(-5);
     $or$cond2 = $cmp470 & $cmp473;
     if ($or$cond2) {
      $dec476 = (($t) + -1)|0;
      $add477$neg = (($$p$inc468) + -1)|0;
      $sub478 = (($add477$neg) - ($e$5$ph))|0;
      $p$addr$2 = $sub478;$t$addr$0 = $dec476;
     } else {
      $sub480 = (($t) + -2)|0;
      $dec481 = (($$p$inc468) + -1)|0;
      $p$addr$2 = $dec481;$t$addr$0 = $sub480;
     }
     $and483 = $fl & 8;
     $tobool484 = ($and483|0)==(0);
     if ($tobool484) {
      if ($cmp450$lcssa) {
       $arrayidx489 = ((($z$7)) + -4|0);
       $49 = HEAP32[$arrayidx489>>2]|0;
       $tobool490 = ($49|0)==(0);
       if ($tobool490) {
        $j$2 = 9;
       } else {
        $rem494437 = (($49>>>0) % 10)&-1;
        $cmp495438 = ($rem494437|0)==(0);
        if ($cmp495438) {
         $i$3439 = 10;$j$1440 = 0;
         while(1) {
          $mul499 = ($i$3439*10)|0;
          $inc500 = (($j$1440) + 1)|0;
          $rem494 = (($49>>>0) % ($mul499>>>0))&-1;
          $cmp495 = ($rem494|0)==(0);
          if ($cmp495) {
           $i$3439 = $mul499;$j$1440 = $inc500;
          } else {
           $j$2 = $inc500;
           break;
          }
         }
        } else {
         $j$2 = 0;
        }
       }
      } else {
       $j$2 = 9;
      }
      $or504 = $t$addr$0 | 32;
      $cmp505 = ($or504|0)==(102);
      $sub$ptr$lhs$cast508 = $z$7;
      $sub$ptr$sub510 = (($sub$ptr$lhs$cast508) - ($sub$ptr$lhs$cast318))|0;
      $sub$ptr$div511 = $sub$ptr$sub510 >> 2;
      $50 = ($sub$ptr$div511*9)|0;
      $mul513 = (($50) + -9)|0;
      if ($cmp505) {
       $sub514 = (($mul513) - ($j$2))|0;
       $51 = ($sub514|0)>(0);
       $$sub514 = $51 ? $sub514 : 0;
       $cmp528 = ($p$addr$2|0)<($$sub514|0);
       $p$addr$2$$sub514399 = $cmp528 ? $p$addr$2 : $$sub514;
       $and610$pre$phiZ2D = 0;$p$addr$3 = $p$addr$2$$sub514399;$t$addr$1 = $t$addr$0;
       break;
      } else {
       $add561 = (($mul513) + ($e$5$ph))|0;
       $sub562 = (($add561) - ($j$2))|0;
       $52 = ($sub562|0)>(0);
       $$sub562 = $52 ? $sub562 : 0;
       $cmp577 = ($p$addr$2|0)<($$sub562|0);
       $p$addr$2$$sub562400 = $cmp577 ? $p$addr$2 : $$sub562;
       $and610$pre$phiZ2D = 0;$p$addr$3 = $p$addr$2$$sub562400;$t$addr$1 = $t$addr$0;
       break;
      }
     } else {
      $and610$pre$phiZ2D = $and483;$p$addr$3 = $p$addr$2;$t$addr$1 = $t$addr$0;
     }
    } else {
     $$pre487 = $fl & 8;
     $and610$pre$phiZ2D = $$pre487;$p$addr$3 = $$p;$t$addr$1 = $t;
    }
   } while(0);
   $53 = $p$addr$3 | $and610$pre$phiZ2D;
   $54 = ($53|0)!=(0);
   $lor$ext = $54&1;
   $or613 = $t$addr$1 | 32;
   $cmp614 = ($or613|0)==(102);
   if ($cmp614) {
    $cmp617 = ($e$5$ph|0)>(0);
    $add620 = $cmp617 ? $e$5$ph : 0;
    $estr$2 = 0;$sub$ptr$sub650$pn = $add620;
   } else {
    $cmp623 = ($e$5$ph|0)<(0);
    $cond629 = $cmp623 ? $sub626$le : $e$5$ph;
    $55 = ($cond629|0)<(0);
    $56 = $55 << 31 >> 31;
    $57 = (_fmt_u($cond629,$56,$arrayidx)|0);
    $sub$ptr$lhs$cast633 = $arrayidx;
    $sub$ptr$rhs$cast634431 = $57;
    $sub$ptr$sub635432 = (($sub$ptr$lhs$cast633) - ($sub$ptr$rhs$cast634431))|0;
    $cmp636433 = ($sub$ptr$sub635432|0)<(2);
    if ($cmp636433) {
     $estr$1434 = $57;
     while(1) {
      $incdec$ptr639 = ((($estr$1434)) + -1|0);
      HEAP8[$incdec$ptr639>>0] = 48;
      $sub$ptr$rhs$cast634 = $incdec$ptr639;
      $sub$ptr$sub635 = (($sub$ptr$lhs$cast633) - ($sub$ptr$rhs$cast634))|0;
      $cmp636 = ($sub$ptr$sub635|0)<(2);
      if ($cmp636) {
       $estr$1434 = $incdec$ptr639;
      } else {
       $estr$1$lcssa = $incdec$ptr639;
       break;
      }
     }
    } else {
     $estr$1$lcssa = $57;
    }
    $58 = $e$5$ph >> 31;
    $59 = $58 & 2;
    $60 = (($59) + 43)|0;
    $conv644 = $60&255;
    $incdec$ptr645 = ((($estr$1$lcssa)) + -1|0);
    HEAP8[$incdec$ptr645>>0] = $conv644;
    $conv646 = $t$addr$1&255;
    $incdec$ptr647 = ((($estr$1$lcssa)) + -2|0);
    HEAP8[$incdec$ptr647>>0] = $conv646;
    $sub$ptr$rhs$cast649 = $incdec$ptr647;
    $sub$ptr$sub650 = (($sub$ptr$lhs$cast633) - ($sub$ptr$rhs$cast649))|0;
    $estr$2 = $incdec$ptr647;$sub$ptr$sub650$pn = $sub$ptr$sub650;
   }
   $add608 = (($pl$0) + 1)|0;
   $add612 = (($add608) + ($p$addr$3))|0;
   $l$1 = (($add612) + ($lor$ext))|0;
   $add653 = (($l$1) + ($sub$ptr$sub650$pn))|0;
   _pad_684($f,32,$w,$add653,$fl);
   _out($f,$prefix$0,$pl$0);
   $xor655 = $fl ^ 65536;
   _pad_684($f,48,$w,$add653,$xor655);
   if ($cmp614) {
    $cmp660 = ($a$9$ph>>>0)>($arraydecay208$add$ptr213>>>0);
    $r$0$a$9 = $cmp660 ? $arraydecay208$add$ptr213 : $a$9$ph;
    $add$ptr671 = ((($buf)) + 9|0);
    $sub$ptr$lhs$cast694 = $add$ptr671;
    $incdec$ptr689 = ((($buf)) + 8|0);
    $d$5422 = $r$0$a$9;
    while(1) {
     $61 = HEAP32[$d$5422>>2]|0;
     $62 = (_fmt_u($61,0,$add$ptr671)|0);
     $cmp673 = ($d$5422|0)==($r$0$a$9|0);
     if ($cmp673) {
      $cmp686 = ($62|0)==($add$ptr671|0);
      if ($cmp686) {
       HEAP8[$incdec$ptr689>>0] = 48;
       $s668$1 = $incdec$ptr689;
      } else {
       $s668$1 = $62;
      }
     } else {
      $cmp678419 = ($62>>>0)>($buf>>>0);
      if ($cmp678419) {
       $63 = $62;
       $64 = (($63) - ($sub$ptr$rhs$cast))|0;
       _memset(($buf|0),48,($64|0))|0;
       $s668$0420 = $62;
       while(1) {
        $incdec$ptr681 = ((($s668$0420)) + -1|0);
        $cmp678 = ($incdec$ptr681>>>0)>($buf>>>0);
        if ($cmp678) {
         $s668$0420 = $incdec$ptr681;
        } else {
         $s668$1 = $incdec$ptr681;
         break;
        }
       }
      } else {
       $s668$1 = $62;
      }
     }
     $sub$ptr$rhs$cast695 = $s668$1;
     $sub$ptr$sub696 = (($sub$ptr$lhs$cast694) - ($sub$ptr$rhs$cast695))|0;
     _out($f,$s668$1,$sub$ptr$sub696);
     $incdec$ptr698 = ((($d$5422)) + 4|0);
     $cmp665 = ($incdec$ptr698>>>0)>($arraydecay208$add$ptr213>>>0);
     if ($cmp665) {
      break;
     } else {
      $d$5422 = $incdec$ptr698;
     }
    }
    $65 = ($53|0)==(0);
    if (!($65)) {
     _out($f,2274,1);
    }
    $cmp707414 = ($incdec$ptr698>>>0)<($z$7>>>0);
    $cmp710415 = ($p$addr$3|0)>(0);
    $66 = $cmp707414 & $cmp710415;
    if ($66) {
     $d$6416 = $incdec$ptr698;$p$addr$4417 = $p$addr$3;
     while(1) {
      $67 = HEAP32[$d$6416>>2]|0;
      $68 = (_fmt_u($67,0,$add$ptr671)|0);
      $cmp722411 = ($68>>>0)>($buf>>>0);
      if ($cmp722411) {
       $69 = $68;
       $70 = (($69) - ($sub$ptr$rhs$cast))|0;
       _memset(($buf|0),48,($70|0))|0;
       $s715$0412 = $68;
       while(1) {
        $incdec$ptr725 = ((($s715$0412)) + -1|0);
        $cmp722 = ($incdec$ptr725>>>0)>($buf>>>0);
        if ($cmp722) {
         $s715$0412 = $incdec$ptr725;
        } else {
         $s715$0$lcssa = $incdec$ptr725;
         break;
        }
       }
      } else {
       $s715$0$lcssa = $68;
      }
      $71 = ($p$addr$4417|0)<(9);
      $cond732 = $71 ? $p$addr$4417 : 9;
      _out($f,$s715$0$lcssa,$cond732);
      $incdec$ptr734 = ((($d$6416)) + 4|0);
      $sub735 = (($p$addr$4417) + -9)|0;
      $cmp707 = ($incdec$ptr734>>>0)<($z$7>>>0);
      $cmp710 = ($p$addr$4417|0)>(9);
      $72 = $cmp707 & $cmp710;
      if ($72) {
       $d$6416 = $incdec$ptr734;$p$addr$4417 = $sub735;
      } else {
       $p$addr$4$lcssa = $sub735;
       break;
      }
     }
    } else {
     $p$addr$4$lcssa = $p$addr$3;
    }
    $add737 = (($p$addr$4$lcssa) + 9)|0;
    _pad_684($f,48,$add737,9,0);
   } else {
    $add$ptr742 = ((($a$9$ph)) + 4|0);
    $z$7$add$ptr742 = $cmp450$lcssa ? $z$7 : $add$ptr742;
    $cmp748427 = ($p$addr$3|0)>(-1);
    if ($cmp748427) {
     $add$ptr756 = ((($buf)) + 9|0);
     $tobool781 = ($and610$pre$phiZ2D|0)==(0);
     $sub$ptr$lhs$cast787 = $add$ptr756;
     $73 = (0 - ($sub$ptr$rhs$cast))|0;
     $incdec$ptr763 = ((($buf)) + 8|0);
     $d$7428 = $a$9$ph;$p$addr$5429 = $p$addr$3;
     while(1) {
      $74 = HEAP32[$d$7428>>2]|0;
      $75 = (_fmt_u($74,0,$add$ptr756)|0);
      $cmp760 = ($75|0)==($add$ptr756|0);
      if ($cmp760) {
       HEAP8[$incdec$ptr763>>0] = 48;
       $s753$0 = $incdec$ptr763;
      } else {
       $s753$0 = $75;
      }
      $cmp765 = ($d$7428|0)==($a$9$ph|0);
      do {
       if ($cmp765) {
        $incdec$ptr776 = ((($s753$0)) + 1|0);
        _out($f,$s753$0,1);
        $cmp777 = ($p$addr$5429|0)<(1);
        $or$cond402 = $tobool781 & $cmp777;
        if ($or$cond402) {
         $s753$2 = $incdec$ptr776;
         break;
        }
        _out($f,2274,1);
        $s753$2 = $incdec$ptr776;
       } else {
        $cmp770423 = ($s753$0>>>0)>($buf>>>0);
        if (!($cmp770423)) {
         $s753$2 = $s753$0;
         break;
        }
        $scevgep483 = (($s753$0) + ($73)|0);
        $scevgep483484 = $scevgep483;
        _memset(($buf|0),48,($scevgep483484|0))|0;
        $s753$1424 = $s753$0;
        while(1) {
         $incdec$ptr773 = ((($s753$1424)) + -1|0);
         $cmp770 = ($incdec$ptr773>>>0)>($buf>>>0);
         if ($cmp770) {
          $s753$1424 = $incdec$ptr773;
         } else {
          $s753$2 = $incdec$ptr773;
          break;
         }
        }
       }
      } while(0);
      $sub$ptr$rhs$cast788 = $s753$2;
      $sub$ptr$sub789 = (($sub$ptr$lhs$cast787) - ($sub$ptr$rhs$cast788))|0;
      $cmp790 = ($p$addr$5429|0)>($sub$ptr$sub789|0);
      $cond800 = $cmp790 ? $sub$ptr$sub789 : $p$addr$5429;
      _out($f,$s753$2,$cond800);
      $sub806 = (($p$addr$5429) - ($sub$ptr$sub789))|0;
      $incdec$ptr808 = ((($d$7428)) + 4|0);
      $cmp745 = ($incdec$ptr808>>>0)<($z$7$add$ptr742>>>0);
      $cmp748 = ($sub806|0)>(-1);
      $76 = $cmp745 & $cmp748;
      if ($76) {
       $d$7428 = $incdec$ptr808;$p$addr$5429 = $sub806;
      } else {
       $p$addr$5$lcssa = $sub806;
       break;
      }
     }
    } else {
     $p$addr$5$lcssa = $p$addr$3;
    }
    $add810 = (($p$addr$5$lcssa) + 18)|0;
    _pad_684($f,48,$add810,18,0);
    $sub$ptr$lhs$cast811 = $arrayidx;
    $sub$ptr$rhs$cast812 = $estr$2;
    $sub$ptr$sub813 = (($sub$ptr$lhs$cast811) - ($sub$ptr$rhs$cast812))|0;
    _out($f,$estr$2,$sub$ptr$sub813);
   }
   $xor816 = $fl ^ 8192;
   _pad_684($f,32,$w,$add653,$xor816);
   $add653$sink406 = $add653;
  } else {
   $and36 = $t & 32;
   $tobool37 = ($and36|0)!=(0);
   $cond = $tobool37 ? 2242 : 2246;
   $cmp38 = ($y$addr$0 != $y$addr$0) | (0.0 != 0.0);
   $cond43 = $tobool37 ? 2250 : 2254;
   $s35$0 = $cmp38 ? $cond43 : $cond;
   $add = (($pl$0) + 3)|0;
   $and45 = $fl & -65537;
   _pad_684($f,32,$w,$add,$and45);
   _out($f,$prefix$0,$pl$0);
   _out($f,$s35$0,3);
   $xor = $fl ^ 8192;
   _pad_684($f,32,$w,$add,$xor);
   $add653$sink406 = $add;
  }
 } while(0);
 $cmp818 = ($add653$sink406|0)<($w|0);
 $w$add653 = $cmp818 ? $w : $add653$sink406;
 STACKTOP = sp;return ($w$add653|0);
}
function ___DOUBLE_BITS_685($__f) {
 $__f = +$__f;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $__f;$0 = HEAP32[tempDoublePtr>>2]|0;
 $1 = HEAP32[tempDoublePtr+4>>2]|0;
 tempRet0 = ($1);
 return ($0|0);
}
function _frexpl($x,$e) {
 $x = +$x;
 $e = $e|0;
 var $call = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $call = (+_frexp($x,$e));
 return (+$call);
}
function _frexp($x,$e) {
 $x = +$x;
 $e = $e|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0.0, $call = 0.0, $conv = 0, $mul = 0.0, $retval$0 = 0.0, $storemerge = 0, $sub = 0, $sub8 = 0, $tobool1 = 0, $trunc$clear = 0, $x$addr$0 = 0.0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $x;$0 = HEAP32[tempDoublePtr>>2]|0;
 $1 = HEAP32[tempDoublePtr+4>>2]|0;
 $2 = (_bitshift64Lshr(($0|0),($1|0),52)|0);
 $3 = tempRet0;
 $4 = $2&65535;
 $trunc$clear = $4 & 2047;
 switch ($trunc$clear<<16>>16) {
 case 0:  {
  $tobool1 = $x != 0.0;
  if ($tobool1) {
   $mul = $x * 1.8446744073709552E+19;
   $call = (+_frexp($mul,$e));
   $5 = HEAP32[$e>>2]|0;
   $sub = (($5) + -64)|0;
   $storemerge = $sub;$x$addr$0 = $call;
  } else {
   $storemerge = 0;$x$addr$0 = $x;
  }
  HEAP32[$e>>2] = $storemerge;
  $retval$0 = $x$addr$0;
  break;
 }
 case 2047:  {
  $retval$0 = $x;
  break;
 }
 default: {
  $conv = $2 & 2047;
  $sub8 = (($conv) + -1022)|0;
  HEAP32[$e>>2] = $sub8;
  $6 = $1 & -2146435073;
  $7 = $6 | 1071644672;
  HEAP32[tempDoublePtr>>2] = $0;HEAP32[tempDoublePtr+4>>2] = $7;$8 = +HEAPF64[tempDoublePtr>>3];
  $retval$0 = $8;
 }
 }
 return (+$retval$0);
}
function _wcrtomb($s,$wc,$st) {
 $s = $s|0;
 $wc = $wc|0;
 $st = $st|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $and = 0, $and32 = 0, $and36 = 0, $and49 = 0, $and54 = 0, $and58 = 0, $call = 0, $call10 = 0, $call66 = 0, $cmp = 0, $cmp14 = 0, $cmp21 = 0, $cmp24 = 0, $cmp41 = 0, $cmp7 = 0, $conv = 0;
 var $conv12 = 0, $conv17 = 0, $conv19 = 0, $conv29 = 0, $conv34 = 0, $conv38 = 0, $conv46 = 0, $conv51 = 0, $conv56 = 0, $conv60 = 0, $incdec$ptr = 0, $incdec$ptr30 = 0, $incdec$ptr35 = 0, $incdec$ptr47 = 0, $incdec$ptr52 = 0, $incdec$ptr57 = 0, $locale = 0, $not$tobool2 = 0, $or = 0, $or$cond = 0;
 var $or18 = 0, $or28 = 0, $or33 = 0, $or37 = 0, $or45 = 0, $or50 = 0, $or55 = 0, $or59 = 0, $retval$0 = 0, $shr2729 = 0, $shr3130 = 0, $shr32 = 0, $shr4426 = 0, $shr4827 = 0, $shr5328 = 0, $sub40 = 0, $tobool = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $tobool = ($s|0)==(0|0);
 do {
  if ($tobool) {
   $retval$0 = 1;
  } else {
   $cmp = ($wc>>>0)<(128);
   if ($cmp) {
    $conv = $wc&255;
    HEAP8[$s>>0] = $conv;
    $retval$0 = 1;
    break;
   }
   $call = (___pthread_self_431()|0);
   $locale = ((($call)) + 188|0);
   $0 = HEAP32[$locale>>2]|0;
   $1 = HEAP32[$0>>2]|0;
   $not$tobool2 = ($1|0)==(0|0);
   if ($not$tobool2) {
    $2 = $wc & -128;
    $cmp7 = ($2|0)==(57216);
    if ($cmp7) {
     $conv12 = $wc&255;
     HEAP8[$s>>0] = $conv12;
     $retval$0 = 1;
     break;
    } else {
     $call10 = (___errno_location()|0);
     HEAP32[$call10>>2] = 84;
     $retval$0 = -1;
     break;
    }
   }
   $cmp14 = ($wc>>>0)<(2048);
   if ($cmp14) {
    $shr32 = $wc >>> 6;
    $or = $shr32 | 192;
    $conv17 = $or&255;
    $incdec$ptr = ((($s)) + 1|0);
    HEAP8[$s>>0] = $conv17;
    $and = $wc & 63;
    $or18 = $and | 128;
    $conv19 = $or18&255;
    HEAP8[$incdec$ptr>>0] = $conv19;
    $retval$0 = 2;
    break;
   }
   $cmp21 = ($wc>>>0)<(55296);
   $3 = $wc & -8192;
   $cmp24 = ($3|0)==(57344);
   $or$cond = $cmp21 | $cmp24;
   if ($or$cond) {
    $shr2729 = $wc >>> 12;
    $or28 = $shr2729 | 224;
    $conv29 = $or28&255;
    $incdec$ptr30 = ((($s)) + 1|0);
    HEAP8[$s>>0] = $conv29;
    $shr3130 = $wc >>> 6;
    $and32 = $shr3130 & 63;
    $or33 = $and32 | 128;
    $conv34 = $or33&255;
    $incdec$ptr35 = ((($s)) + 2|0);
    HEAP8[$incdec$ptr30>>0] = $conv34;
    $and36 = $wc & 63;
    $or37 = $and36 | 128;
    $conv38 = $or37&255;
    HEAP8[$incdec$ptr35>>0] = $conv38;
    $retval$0 = 3;
    break;
   }
   $sub40 = (($wc) + -65536)|0;
   $cmp41 = ($sub40>>>0)<(1048576);
   if ($cmp41) {
    $shr4426 = $wc >>> 18;
    $or45 = $shr4426 | 240;
    $conv46 = $or45&255;
    $incdec$ptr47 = ((($s)) + 1|0);
    HEAP8[$s>>0] = $conv46;
    $shr4827 = $wc >>> 12;
    $and49 = $shr4827 & 63;
    $or50 = $and49 | 128;
    $conv51 = $or50&255;
    $incdec$ptr52 = ((($s)) + 2|0);
    HEAP8[$incdec$ptr47>>0] = $conv51;
    $shr5328 = $wc >>> 6;
    $and54 = $shr5328 & 63;
    $or55 = $and54 | 128;
    $conv56 = $or55&255;
    $incdec$ptr57 = ((($s)) + 3|0);
    HEAP8[$incdec$ptr52>>0] = $conv56;
    $and58 = $wc & 63;
    $or59 = $and58 | 128;
    $conv60 = $or59&255;
    HEAP8[$incdec$ptr57>>0] = $conv60;
    $retval$0 = 4;
    break;
   } else {
    $call66 = (___errno_location()|0);
    HEAP32[$call66>>2] = 84;
    $retval$0 = -1;
    break;
   }
  }
 } while(0);
 return ($retval$0|0);
}
function ___pthread_self_431() {
 var $call = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $call = (_pthread_self()|0);
 return ($call|0);
}
function ___pthread_self_104() {
 var $call = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $call = (_pthread_self()|0);
 return ($call|0);
}
function ___strerror_l($e,$loc) {
 $e = $e|0;
 $loc = $loc|0;
 var $0 = 0, $1 = 0, $2 = 0, $arrayidx = 0, $arrayidx15 = 0, $call = 0, $cmp = 0, $conv = 0, $dec = 0, $i$012 = 0, $i$111 = 0, $inc = 0, $incdec$ptr = 0, $s$0$lcssa = 0, $s$010 = 0, $s$1 = 0, $tobool = 0, $tobool5 = 0, $tobool59 = 0, $tobool8 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $i$012 = 0;
 while(1) {
  $arrayidx = (2276 + ($i$012)|0);
  $0 = HEAP8[$arrayidx>>0]|0;
  $conv = $0&255;
  $cmp = ($conv|0)==($e|0);
  if ($cmp) {
   label = 2;
   break;
  }
  $inc = (($i$012) + 1)|0;
  $tobool = ($inc|0)==(87);
  if ($tobool) {
   $i$111 = 87;$s$010 = 2364;
   label = 5;
   break;
  } else {
   $i$012 = $inc;
  }
 }
 if ((label|0) == 2) {
  $tobool59 = ($i$012|0)==(0);
  if ($tobool59) {
   $s$0$lcssa = 2364;
  } else {
   $i$111 = $i$012;$s$010 = 2364;
   label = 5;
  }
 }
 if ((label|0) == 5) {
  while(1) {
   label = 0;
   $s$1 = $s$010;
   while(1) {
    $1 = HEAP8[$s$1>>0]|0;
    $tobool8 = ($1<<24>>24)==(0);
    $incdec$ptr = ((($s$1)) + 1|0);
    if ($tobool8) {
     break;
    } else {
     $s$1 = $incdec$ptr;
    }
   }
   $dec = (($i$111) + -1)|0;
   $tobool5 = ($dec|0)==(0);
   if ($tobool5) {
    $s$0$lcssa = $incdec$ptr;
    break;
   } else {
    $i$111 = $dec;$s$010 = $incdec$ptr;
    label = 5;
   }
  }
 }
 $arrayidx15 = ((($loc)) + 20|0);
 $2 = HEAP32[$arrayidx15>>2]|0;
 $call = (___lctrans($s$0$lcssa,$2)|0);
 return ($call|0);
}
function ___lctrans($msg,$lm) {
 $msg = $msg|0;
 $lm = $lm|0;
 var $call = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $call = (___lctrans_impl($msg,$lm)|0);
 return ($call|0);
}
function ___lctrans_impl($msg,$lm) {
 $msg = $msg|0;
 $lm = $lm|0;
 var $0 = 0, $1 = 0, $call = 0, $cond = 0, $map_size = 0, $tobool = 0, $tobool1 = 0, $trans$0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $tobool = ($lm|0)==(0|0);
 if ($tobool) {
  $trans$0 = 0;
 } else {
  $0 = HEAP32[$lm>>2]|0;
  $map_size = ((($lm)) + 4|0);
  $1 = HEAP32[$map_size>>2]|0;
  $call = (___mo_lookup($0,$1,$msg)|0);
  $trans$0 = $call;
 }
 $tobool1 = ($trans$0|0)!=(0|0);
 $cond = $tobool1 ? $trans$0 : $msg;
 return ($cond|0);
}
function ___mo_lookup($p,$size,$s) {
 $p = $p|0;
 $size = $size|0;
 $s = $s|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $add = 0, $add$ptr = 0, $add$ptr65 = 0, $add$ptr65$ = 0, $add16 = 0, $add23 = 0, $add31 = 0, $add42 = 0, $add49 = 0, $add59 = 0;
 var $arrayidx = 0, $arrayidx1 = 0, $arrayidx17 = 0, $arrayidx24 = 0, $arrayidx3 = 0, $arrayidx32 = 0, $arrayidx43 = 0, $arrayidx50 = 0, $arrayidx60 = 0, $b$0 = 0, $b$1 = 0, $call = 0, $call18 = 0, $call2 = 0, $call25 = 0, $call36 = 0, $call4 = 0, $call44 = 0, $call51 = 0, $cmp = 0;
 var $cmp10 = 0, $cmp26 = 0, $cmp29 = 0, $cmp52 = 0, $cmp56 = 0, $cmp6 = 0, $cmp67 = 0, $cmp71 = 0, $div = 0, $div12 = 0, $div13 = 0, $div14 = 0, $mul = 0, $mul15 = 0, $n$0 = 0, $n$1 = 0, $or = 0, $or$cond = 0, $or$cond66 = 0, $or$cond67 = 0;
 var $rem = 0, $retval$4 = 0, $sub = 0, $sub28 = 0, $sub5 = 0, $sub55 = 0, $sub79 = 0, $tobool = 0, $tobool33 = 0, $tobool37 = 0, $tobool62 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[$p>>2]|0;
 $sub = (($0) + 1794895138)|0;
 $arrayidx = ((($p)) + 8|0);
 $1 = HEAP32[$arrayidx>>2]|0;
 $call = (_swapc($1,$sub)|0);
 $arrayidx1 = ((($p)) + 12|0);
 $2 = HEAP32[$arrayidx1>>2]|0;
 $call2 = (_swapc($2,$sub)|0);
 $arrayidx3 = ((($p)) + 16|0);
 $3 = HEAP32[$arrayidx3>>2]|0;
 $call4 = (_swapc($3,$sub)|0);
 $div = $size >>> 2;
 $cmp = ($call>>>0)<($div>>>0);
 L1: do {
  if ($cmp) {
   $mul = $call << 2;
   $sub5 = (($size) - ($mul))|0;
   $cmp6 = ($call2>>>0)<($sub5>>>0);
   $cmp10 = ($call4>>>0)<($sub5>>>0);
   $or$cond = $cmp6 & $cmp10;
   if ($or$cond) {
    $or = $call4 | $call2;
    $rem = $or & 3;
    $tobool = ($rem|0)==(0);
    if ($tobool) {
     $div12 = $call2 >>> 2;
     $div13 = $call4 >>> 2;
     $b$0 = 0;$n$0 = $call;
     while(1) {
      $div14 = $n$0 >>> 1;
      $add = (($b$0) + ($div14))|0;
      $mul15 = $add << 1;
      $add16 = (($mul15) + ($div12))|0;
      $arrayidx17 = (($p) + ($add16<<2)|0);
      $4 = HEAP32[$arrayidx17>>2]|0;
      $call18 = (_swapc($4,$sub)|0);
      $add23 = (($add16) + 1)|0;
      $arrayidx24 = (($p) + ($add23<<2)|0);
      $5 = HEAP32[$arrayidx24>>2]|0;
      $call25 = (_swapc($5,$sub)|0);
      $cmp26 = ($call25>>>0)<($size>>>0);
      $sub28 = (($size) - ($call25))|0;
      $cmp29 = ($call18>>>0)<($sub28>>>0);
      $or$cond66 = $cmp26 & $cmp29;
      if (!($or$cond66)) {
       $retval$4 = 0;
       break L1;
      }
      $add31 = (($call25) + ($call18))|0;
      $arrayidx32 = (($p) + ($add31)|0);
      $6 = HEAP8[$arrayidx32>>0]|0;
      $tobool33 = ($6<<24>>24)==(0);
      if (!($tobool33)) {
       $retval$4 = 0;
       break L1;
      }
      $add$ptr = (($p) + ($call25)|0);
      $call36 = (_strcmp($s,$add$ptr)|0);
      $tobool37 = ($call36|0)==(0);
      if ($tobool37) {
       break;
      }
      $cmp67 = ($n$0|0)==(1);
      $cmp71 = ($call36|0)<(0);
      $sub79 = (($n$0) - ($div14))|0;
      $n$1 = $cmp71 ? $div14 : $sub79;
      $b$1 = $cmp71 ? $b$0 : $add;
      if ($cmp67) {
       $retval$4 = 0;
       break L1;
      } else {
       $b$0 = $b$1;$n$0 = $n$1;
      }
     }
     $add42 = (($mul15) + ($div13))|0;
     $arrayidx43 = (($p) + ($add42<<2)|0);
     $7 = HEAP32[$arrayidx43>>2]|0;
     $call44 = (_swapc($7,$sub)|0);
     $add49 = (($add42) + 1)|0;
     $arrayidx50 = (($p) + ($add49<<2)|0);
     $8 = HEAP32[$arrayidx50>>2]|0;
     $call51 = (_swapc($8,$sub)|0);
     $cmp52 = ($call51>>>0)<($size>>>0);
     $sub55 = (($size) - ($call51))|0;
     $cmp56 = ($call44>>>0)<($sub55>>>0);
     $or$cond67 = $cmp52 & $cmp56;
     if ($or$cond67) {
      $add$ptr65 = (($p) + ($call51)|0);
      $add59 = (($call51) + ($call44))|0;
      $arrayidx60 = (($p) + ($add59)|0);
      $9 = HEAP8[$arrayidx60>>0]|0;
      $tobool62 = ($9<<24>>24)==(0);
      $add$ptr65$ = $tobool62 ? $add$ptr65 : 0;
      $retval$4 = $add$ptr65$;
     } else {
      $retval$4 = 0;
     }
    } else {
     $retval$4 = 0;
    }
   } else {
    $retval$4 = 0;
   }
  } else {
   $retval$4 = 0;
  }
 } while(0);
 return ($retval$4|0);
}
function _swapc($x,$c) {
 $x = $x|0;
 $c = $c|0;
 var $or5 = 0, $tobool = 0, $x$or5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $tobool = ($c|0)==(0);
 $or5 = (_llvm_bswap_i32(($x|0))|0);
 $x$or5 = $tobool ? $x : $or5;
 return ($x$or5|0);
}
function ___fwritex($s,$l,$f) {
 $s = $s|0;
 $l = $l|0;
 $f = $f|0;
 var $$pre = 0, $$pre33 = 0, $0 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $add = 0, $add$ptr = 0, $add$ptr26 = 0, $arrayidx = 0, $call = 0, $call16 = 0, $call4 = 0;
 var $cmp = 0, $cmp11 = 0, $cmp17 = 0, $cmp6 = 0, $i$0 = 0, $i$1 = 0, $l$addr$0 = 0, $l$addr$1 = 0, $lbf = 0, $retval$1 = 0, $s$addr$1 = 0, $sub = 0, $sub$ptr$sub = 0, $tobool = 0, $tobool1 = 0, $tobool9 = 0, $wend = 0, $wpos = 0, $write = 0, $write15 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $wend = ((($f)) + 16|0);
 $0 = HEAP32[$wend>>2]|0;
 $tobool = ($0|0)==(0|0);
 if ($tobool) {
  $call = (___towrite($f)|0);
  $tobool1 = ($call|0)==(0);
  if ($tobool1) {
   $$pre = HEAP32[$wend>>2]|0;
   $3 = $$pre;
   label = 5;
  } else {
   $retval$1 = 0;
  }
 } else {
  $1 = $0;
  $3 = $1;
  label = 5;
 }
 L5: do {
  if ((label|0) == 5) {
   $wpos = ((($f)) + 20|0);
   $2 = HEAP32[$wpos>>2]|0;
   $sub$ptr$sub = (($3) - ($2))|0;
   $cmp = ($sub$ptr$sub>>>0)<($l>>>0);
   $4 = $2;
   if ($cmp) {
    $write = ((($f)) + 36|0);
    $5 = HEAP32[$write>>2]|0;
    $call4 = (FUNCTION_TABLE_iiii[$5 & 7]($f,$s,$l)|0);
    $retval$1 = $call4;
    break;
   }
   $lbf = ((($f)) + 75|0);
   $6 = HEAP8[$lbf>>0]|0;
   $cmp6 = ($6<<24>>24)>(-1);
   L10: do {
    if ($cmp6) {
     $i$0 = $l;
     while(1) {
      $tobool9 = ($i$0|0)==(0);
      if ($tobool9) {
       $9 = $4;$i$1 = 0;$l$addr$1 = $l;$s$addr$1 = $s;
       break L10;
      }
      $sub = (($i$0) + -1)|0;
      $arrayidx = (($s) + ($sub)|0);
      $7 = HEAP8[$arrayidx>>0]|0;
      $cmp11 = ($7<<24>>24)==(10);
      if ($cmp11) {
       break;
      } else {
       $i$0 = $sub;
      }
     }
     $write15 = ((($f)) + 36|0);
     $8 = HEAP32[$write15>>2]|0;
     $call16 = (FUNCTION_TABLE_iiii[$8 & 7]($f,$s,$i$0)|0);
     $cmp17 = ($call16>>>0)<($i$0>>>0);
     if ($cmp17) {
      $retval$1 = $call16;
      break L5;
     }
     $add$ptr = (($s) + ($i$0)|0);
     $l$addr$0 = (($l) - ($i$0))|0;
     $$pre33 = HEAP32[$wpos>>2]|0;
     $9 = $$pre33;$i$1 = $i$0;$l$addr$1 = $l$addr$0;$s$addr$1 = $add$ptr;
    } else {
     $9 = $4;$i$1 = 0;$l$addr$1 = $l;$s$addr$1 = $s;
    }
   } while(0);
   _memcpy(($9|0),($s$addr$1|0),($l$addr$1|0))|0;
   $10 = HEAP32[$wpos>>2]|0;
   $add$ptr26 = (($10) + ($l$addr$1)|0);
   HEAP32[$wpos>>2] = $add$ptr26;
   $add = (($i$1) + ($l$addr$1))|0;
   $retval$1 = $add;
  }
 } while(0);
 return ($retval$1|0);
}
function ___towrite($f) {
 $f = $f|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $add$ptr = 0, $and = 0, $buf = 0, $buf_size = 0, $conv = 0, $conv3 = 0, $mode = 0, $or = 0, $or5 = 0, $rend = 0, $retval$0 = 0, $rpos = 0, $sub = 0, $tobool = 0, $wbase = 0, $wend = 0;
 var $wpos = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $mode = ((($f)) + 74|0);
 $0 = HEAP8[$mode>>0]|0;
 $conv = $0 << 24 >> 24;
 $sub = (($conv) + 255)|0;
 $or = $sub | $conv;
 $conv3 = $or&255;
 HEAP8[$mode>>0] = $conv3;
 $1 = HEAP32[$f>>2]|0;
 $and = $1 & 8;
 $tobool = ($and|0)==(0);
 if ($tobool) {
  $rend = ((($f)) + 8|0);
  HEAP32[$rend>>2] = 0;
  $rpos = ((($f)) + 4|0);
  HEAP32[$rpos>>2] = 0;
  $buf = ((($f)) + 44|0);
  $2 = HEAP32[$buf>>2]|0;
  $wbase = ((($f)) + 28|0);
  HEAP32[$wbase>>2] = $2;
  $wpos = ((($f)) + 20|0);
  HEAP32[$wpos>>2] = $2;
  $buf_size = ((($f)) + 48|0);
  $3 = HEAP32[$buf_size>>2]|0;
  $add$ptr = (($2) + ($3)|0);
  $wend = ((($f)) + 16|0);
  HEAP32[$wend>>2] = $add$ptr;
  $retval$0 = 0;
 } else {
  $or5 = $1 | 32;
  HEAP32[$f>>2] = $or5;
  $retval$0 = -1;
 }
 return ($retval$0|0);
}
function _sn_write($f,$s,$l) {
 $f = $f|0;
 $s = $s|0;
 $l = $l|0;
 var $0 = 0, $1 = 0, $2 = 0, $add$ptr = 0, $cmp = 0, $l$sub$ptr$sub = 0, $sub$ptr$rhs$cast = 0, $sub$ptr$sub = 0, $wend = 0, $wpos = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $wend = ((($f)) + 16|0);
 $0 = HEAP32[$wend>>2]|0;
 $wpos = ((($f)) + 20|0);
 $1 = HEAP32[$wpos>>2]|0;
 $sub$ptr$rhs$cast = $1;
 $sub$ptr$sub = (($0) - ($sub$ptr$rhs$cast))|0;
 $cmp = ($sub$ptr$sub>>>0)>($l>>>0);
 $l$sub$ptr$sub = $cmp ? $l : $sub$ptr$sub;
 _memcpy(($1|0),($s|0),($l$sub$ptr$sub|0))|0;
 $2 = HEAP32[$wpos>>2]|0;
 $add$ptr = (($2) + ($l$sub$ptr$sub)|0);
 HEAP32[$wpos>>2] = $add$ptr;
 return ($l|0);
}
function ___ofl_lock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___lock((650948|0));
 return (650956|0);
}
function ___ofl_unlock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___unlock((650948|0));
 return;
}
function _fflush($f) {
 $f = $f|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $call = 0, $call1 = 0, $call11 = 0, $call118 = 0, $call17 = 0, $call23 = 0, $call7 = 0, $cmp = 0, $cmp15 = 0, $cmp21 = 0, $cond10 = 0, $cond20 = 0, $f$addr$0 = 0, $f$addr$019 = 0;
 var $f$addr$022 = 0, $lock = 0, $lock14 = 0, $next = 0, $or = 0, $phitmp = 0, $r$0$lcssa = 0, $r$021 = 0, $r$1 = 0, $retval$0 = 0, $tobool = 0, $tobool12 = 0, $tobool1220 = 0, $tobool25 = 0, $tobool5 = 0, $wbase = 0, $wpos = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $tobool = ($f|0)==(0|0);
 do {
  if ($tobool) {
   $1 = HEAP32[97]|0;
   $tobool5 = ($1|0)==(0|0);
   if ($tobool5) {
    $cond10 = 0;
   } else {
    $2 = HEAP32[97]|0;
    $call7 = (_fflush($2)|0);
    $cond10 = $call7;
   }
   $call11 = (___ofl_lock()|0);
   $f$addr$019 = HEAP32[$call11>>2]|0;
   $tobool1220 = ($f$addr$019|0)==(0|0);
   if ($tobool1220) {
    $r$0$lcssa = $cond10;
   } else {
    $f$addr$022 = $f$addr$019;$r$021 = $cond10;
    while(1) {
     $lock14 = ((($f$addr$022)) + 76|0);
     $3 = HEAP32[$lock14>>2]|0;
     $cmp15 = ($3|0)>(-1);
     if ($cmp15) {
      $call17 = (___lockfile($f$addr$022)|0);
      $cond20 = $call17;
     } else {
      $cond20 = 0;
     }
     $wpos = ((($f$addr$022)) + 20|0);
     $4 = HEAP32[$wpos>>2]|0;
     $wbase = ((($f$addr$022)) + 28|0);
     $5 = HEAP32[$wbase>>2]|0;
     $cmp21 = ($4>>>0)>($5>>>0);
     if ($cmp21) {
      $call23 = (___fflush_unlocked($f$addr$022)|0);
      $or = $call23 | $r$021;
      $r$1 = $or;
     } else {
      $r$1 = $r$021;
     }
     $tobool25 = ($cond20|0)==(0);
     if (!($tobool25)) {
      ___unlockfile($f$addr$022);
     }
     $next = ((($f$addr$022)) + 56|0);
     $f$addr$0 = HEAP32[$next>>2]|0;
     $tobool12 = ($f$addr$0|0)==(0|0);
     if ($tobool12) {
      $r$0$lcssa = $r$1;
      break;
     } else {
      $f$addr$022 = $f$addr$0;$r$021 = $r$1;
     }
    }
   }
   ___ofl_unlock();
   $retval$0 = $r$0$lcssa;
  } else {
   $lock = ((($f)) + 76|0);
   $0 = HEAP32[$lock>>2]|0;
   $cmp = ($0|0)>(-1);
   if (!($cmp)) {
    $call118 = (___fflush_unlocked($f)|0);
    $retval$0 = $call118;
    break;
   }
   $call = (___lockfile($f)|0);
   $phitmp = ($call|0)==(0);
   $call1 = (___fflush_unlocked($f)|0);
   if ($phitmp) {
    $retval$0 = $call1;
   } else {
    ___unlockfile($f);
    $retval$0 = $call1;
   }
  }
 } while(0);
 return ($retval$0|0);
}
function ___fflush_unlocked($f) {
 $f = $f|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $cmp = 0, $cmp4 = 0, $rend = 0, $retval$0 = 0, $rpos = 0, $seek = 0, $sub$ptr$lhs$cast = 0, $sub$ptr$rhs$cast = 0, $sub$ptr$sub = 0, $tobool = 0, $wbase = 0, $wend = 0, $wpos = 0;
 var $write = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $wpos = ((($f)) + 20|0);
 $0 = HEAP32[$wpos>>2]|0;
 $wbase = ((($f)) + 28|0);
 $1 = HEAP32[$wbase>>2]|0;
 $cmp = ($0>>>0)>($1>>>0);
 if ($cmp) {
  $write = ((($f)) + 36|0);
  $2 = HEAP32[$write>>2]|0;
  (FUNCTION_TABLE_iiii[$2 & 7]($f,0,0)|0);
  $3 = HEAP32[$wpos>>2]|0;
  $tobool = ($3|0)==(0|0);
  if ($tobool) {
   $retval$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $rpos = ((($f)) + 4|0);
  $4 = HEAP32[$rpos>>2]|0;
  $rend = ((($f)) + 8|0);
  $5 = HEAP32[$rend>>2]|0;
  $cmp4 = ($4>>>0)<($5>>>0);
  if ($cmp4) {
   $sub$ptr$lhs$cast = $4;
   $sub$ptr$rhs$cast = $5;
   $sub$ptr$sub = (($sub$ptr$lhs$cast) - ($sub$ptr$rhs$cast))|0;
   $seek = ((($f)) + 40|0);
   $6 = HEAP32[$seek>>2]|0;
   (FUNCTION_TABLE_iiii[$6 & 7]($f,$sub$ptr$sub,1)|0);
  }
  $wend = ((($f)) + 16|0);
  HEAP32[$wend>>2] = 0;
  HEAP32[$wbase>>2] = 0;
  HEAP32[$wpos>>2] = 0;
  HEAP32[$rend>>2] = 0;
  HEAP32[$rpos>>2] = 0;
  $retval$0 = 0;
 }
 return ($retval$0|0);
}
function _fprintf($f,$fmt,$varargs) {
 $f = $f|0;
 $fmt = $fmt|0;
 $varargs = $varargs|0;
 var $ap = 0, $call = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $ap = sp;
 HEAP32[$ap>>2] = $varargs;
 $call = (_vfprintf($f,$fmt,$ap)|0);
 STACKTOP = sp;return ($call|0);
}
function _printf($fmt,$varargs) {
 $fmt = $fmt|0;
 $varargs = $varargs|0;
 var $0 = 0, $ap = 0, $call = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $ap = sp;
 HEAP32[$ap>>2] = $varargs;
 $0 = HEAP32[65]|0;
 $call = (_vfprintf($0,$fmt,$ap)|0);
 STACKTOP = sp;return ($call|0);
}
function _malloc($bytes) {
 $bytes = $bytes|0;
 var $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i175 = 0, $$pre$i178 = 0, $$pre$i45$i = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i176Z2D = 0, $$pre$phi$i46$iZ2D = 0, $$pre$phi$iZ2D = 0, $$pre$phiZ2D = 0, $$pre5$i$i = 0, $$sink$i = 0, $$sink$i$i = 0, $$sink$i154 = 0, $$sink2$i = 0, $$sink2$i172 = 0, $$sink5$i = 0, $$v$0$i = 0, $0 = 0;
 var $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0;
 var $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0;
 var $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0;
 var $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0;
 var $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0;
 var $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0;
 var $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0;
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $F$0$i$i = 0, $F104$0 = 0, $F197$0$i = 0, $F224$0$i$i = 0, $F290$0$i = 0, $I252$0$i$i = 0, $I316$0$i = 0, $I57$0$i$i = 0, $K105$0$i$i = 0, $K305$0$i$i = 0, $K373$0$i = 0, $R$1$i = 0, $R$1$i$i = 0, $R$1$i165 = 0, $R$3$i = 0;
 var $R$3$i$i = 0, $R$3$i168 = 0, $RP$1$i = 0, $RP$1$i$i = 0, $RP$1$i164 = 0, $T$0$i = 0, $T$0$i$i = 0, $T$0$i47$i = 0, $add$i = 0, $add$i$i = 0, $add$i145 = 0, $add$i179 = 0, $add$ptr = 0, $add$ptr$i = 0, $add$ptr$i$i = 0, $add$ptr$i$i$i = 0, $add$ptr$i158 = 0, $add$ptr$i16$i = 0, $add$ptr$i192 = 0, $add$ptr$i2$i$i = 0;
 var $add$ptr$i21$i = 0, $add$ptr$i49$i = 0, $add$ptr14$i$i = 0, $add$ptr15$i$i = 0, $add$ptr16$i$i = 0, $add$ptr166 = 0, $add$ptr169 = 0, $add$ptr17$i$i = 0, $add$ptr178 = 0, $add$ptr181$i = 0, $add$ptr182 = 0, $add$ptr189$i = 0, $add$ptr190$i = 0, $add$ptr193 = 0, $add$ptr199 = 0, $add$ptr2$i$i = 0, $add$ptr205$i$i = 0, $add$ptr212$i$i = 0, $add$ptr225$i = 0, $add$ptr227$i = 0;
 var $add$ptr24$i$i = 0, $add$ptr262$i = 0, $add$ptr269$i = 0, $add$ptr273$i = 0, $add$ptr282$i = 0, $add$ptr3$i$i = 0, $add$ptr30$i$i = 0, $add$ptr369$i$i = 0, $add$ptr4$i$i = 0, $add$ptr4$i$i$i = 0, $add$ptr4$i26$i = 0, $add$ptr4$i54$i = 0, $add$ptr441$i = 0, $add$ptr5$i$i = 0, $add$ptr6$i$i = 0, $add$ptr6$i$i$i = 0, $add$ptr6$i58$i = 0, $add$ptr7$i$i = 0, $add$ptr81$i$i = 0, $add$ptr95 = 0;
 var $add$ptr98 = 0, $add10$i = 0, $add101$i = 0, $add110$i = 0, $add13$i = 0, $add14$i = 0, $add140$i = 0, $add144 = 0, $add150$i = 0, $add17$i = 0, $add17$i182 = 0, $add177$i = 0, $add18$i = 0, $add19$i = 0, $add2 = 0, $add20$i = 0, $add206$i$i = 0, $add212$i = 0, $add215$i = 0, $add22$i = 0;
 var $add246$i = 0, $add26$i$i = 0, $add268$i = 0, $add269$i$i = 0, $add274$i$i = 0, $add278$i$i = 0, $add280$i$i = 0, $add283$i$i = 0, $add337$i = 0, $add342$i = 0, $add346$i = 0, $add348$i = 0, $add351$i = 0, $add46$i = 0, $add50 = 0, $add51$i = 0, $add54 = 0, $add54$i = 0, $add58 = 0, $add62 = 0;
 var $add64 = 0, $add74$i$i = 0, $add77$i = 0, $add78$i = 0, $add79$i$i = 0, $add8 = 0, $add82$i = 0, $add83$i$i = 0, $add85$i$i = 0, $add86$i = 0, $add88$i$i = 0, $add9$i = 0, $add90$i = 0, $add92$i = 0, $and = 0, $and$i = 0, $and$i$i = 0, $and$i$i$i = 0, $and$i142 = 0, $and$i17$i = 0;
 var $and$i22$i = 0, $and$i50$i = 0, $and100$i = 0, $and103$i = 0, $and104$i = 0, $and106 = 0, $and11$add51$i = 0, $and11$i = 0, $and119$i$i = 0, $and12$i = 0, $and13$i = 0, $and13$i$i = 0, $and133$i$i = 0, $and14 = 0, $and145 = 0, $and17$i = 0, $and194$i = 0, $and194$i203 = 0, $and199$i = 0, $and209$i$i = 0;
 var $and21$i = 0, $and21$i148 = 0, $and227$i$i = 0, $and236$i = 0, $and264$i$i = 0, $and268$i$i = 0, $and273$i$i = 0, $and282$i$i = 0, $and29$i = 0, $and292$i = 0, $and295$i$i = 0, $and3$i = 0, $and3$i$i = 0, $and3$i$i$i = 0, $and3$i24$i = 0, $and3$i52$i = 0, $and30$i = 0, $and318$i$i = 0, $and32$i = 0, $and32$i$i = 0;
 var $and33$i$i = 0, $and331$i = 0, $and336$i = 0, $and341$i = 0, $and350$i = 0, $and363$i = 0, $and37$i$i = 0, $and387$i = 0, $and4 = 0, $and40$i$i = 0, $and41 = 0, $and42$i = 0, $and43 = 0, $and46 = 0, $and49 = 0, $and49$i = 0, $and49$i$i = 0, $and53 = 0, $and57 = 0, $and6$i = 0;
 var $and6$i$i = 0, $and6$i10$i = 0, $and6$i27$i = 0, $and61 = 0, $and64$i = 0, $and68$i = 0, $and69$i$i = 0, $and7 = 0, $and73$i = 0, $and73$i$i = 0, $and74 = 0, $and77$i = 0, $and78$i$i = 0, $and8$i = 0, $and80$i = 0, $and81$i = 0, $and85$i = 0, $and87$i$i = 0, $and89$i = 0, $and9$i = 0;
 var $and96$i$i = 0, $arrayidx = 0, $arrayidx$i = 0, $arrayidx$i$i = 0, $arrayidx$i14$i = 0, $arrayidx$i149 = 0, $arrayidx$i37$i = 0, $arrayidx103 = 0, $arrayidx103$i$i = 0, $arrayidx106$i = 0, $arrayidx107$i$i = 0, $arrayidx113$i = 0, $arrayidx113$i155 = 0, $arrayidx121$i = 0, $arrayidx123$i$i = 0, $arrayidx126$i$i = 0, $arrayidx137$i = 0, $arrayidx143$i$i = 0, $arrayidx148$i = 0, $arrayidx151$i = 0;
 var $arrayidx151$i$i = 0, $arrayidx154$i = 0, $arrayidx155$i = 0, $arrayidx161$i = 0, $arrayidx165$i = 0, $arrayidx165$i166 = 0, $arrayidx178$i$i = 0, $arrayidx184$i = 0, $arrayidx184$i$i = 0, $arrayidx195$i$i = 0, $arrayidx196$i = 0, $arrayidx204$i = 0, $arrayidx212$i = 0, $arrayidx223$i$i = 0, $arrayidx228$i = 0, $arrayidx23$i = 0, $arrayidx233$i = 0, $arrayidx239$i = 0, $arrayidx245$i = 0, $arrayidx256$i = 0;
 var $arrayidx27$i = 0, $arrayidx276$i = 0, $arrayidx287$i$i = 0, $arrayidx289$i = 0, $arrayidx290$i$i = 0, $arrayidx325$i$i = 0, $arrayidx355$i = 0, $arrayidx358$i = 0, $arrayidx394$i = 0, $arrayidx40$i = 0, $arrayidx44$i = 0, $arrayidx61$i = 0, $arrayidx65$i = 0, $arrayidx66 = 0, $arrayidx71$i = 0, $arrayidx75$i = 0, $arrayidx91$i$i = 0, $arrayidx92$i$i = 0, $arrayidx94$i = 0, $arrayidx94$i153 = 0;
 var $arrayidx96$i$i = 0, $bk = 0, $bk$i = 0, $bk$i$i = 0, $bk$i160 = 0, $bk$i35$i = 0, $bk102$i$i = 0, $bk122 = 0, $bk124 = 0, $bk136$i = 0, $bk139$i$i = 0, $bk158$i$i = 0, $bk161$i$i = 0, $bk218$i = 0, $bk220$i = 0, $bk246$i$i = 0, $bk248$i$i = 0, $bk302$i$i = 0, $bk311$i = 0, $bk313$i = 0;
 var $bk338$i$i = 0, $bk357$i$i = 0, $bk360$i$i = 0, $bk370$i = 0, $bk407$i = 0, $bk429$i = 0, $bk43$i$i = 0, $bk432$i = 0, $bk47$i = 0, $bk55$i$i = 0, $bk67$i$i = 0, $bk74$i$i = 0, $bk78 = 0, $bk82$i$i = 0, $br$2$ph$i = 0, $call107$i = 0, $call131$i = 0, $call132$i = 0, $call275$i = 0, $call37$i = 0;
 var $call68$i = 0, $call83$i = 0, $child$i$i = 0, $child166$i$i = 0, $child289$i$i = 0, $child357$i = 0, $cmp = 0, $cmp$i = 0, $cmp$i$i$i = 0, $cmp$i11$i = 0, $cmp$i177 = 0, $cmp$i18$i = 0, $cmp$i23$i = 0, $cmp$i3$i$i = 0, $cmp$i51$i = 0, $cmp$i9$i = 0, $cmp1 = 0, $cmp1$i = 0, $cmp10 = 0, $cmp100$i$i = 0;
 var $cmp102$i = 0, $cmp104$i$i = 0, $cmp105$i = 0, $cmp106$i$i = 0, $cmp107$i = 0, $cmp108$i = 0, $cmp108$i$i = 0, $cmp112$i$i = 0, $cmp113 = 0, $cmp116$i = 0, $cmp118$i = 0, $cmp119$i = 0, $cmp12$i = 0, $cmp120$i$i = 0, $cmp120$i42$i = 0, $cmp121$i = 0, $cmp123$i = 0, $cmp124$i$i = 0, $cmp126$i = 0, $cmp127$i = 0;
 var $cmp128 = 0, $cmp128$i = 0, $cmp128$i$i = 0, $cmp130$i = 0, $cmp133$i = 0, $cmp133$i$i = 0, $cmp133$i195 = 0, $cmp135$i = 0, $cmp137$i = 0, $cmp137$i$i = 0, $cmp137$i196 = 0, $cmp138$i = 0, $cmp139 = 0, $cmp140$i = 0, $cmp141$i = 0, $cmp142$i = 0, $cmp146 = 0, $cmp147$i = 0, $cmp14799$i = 0, $cmp15 = 0;
 var $cmp15$i = 0, $cmp151$i = 0, $cmp152$i = 0, $cmp153$i$i = 0, $cmp155$i = 0, $cmp156 = 0, $cmp156$i = 0, $cmp156$i$i = 0, $cmp157$i = 0, $cmp159$i = 0, $cmp159$i198 = 0, $cmp16 = 0, $cmp160$i$i = 0, $cmp162 = 0, $cmp162$i = 0, $cmp162$i199 = 0, $cmp166$i = 0, $cmp168$i$i = 0, $cmp171$i = 0, $cmp172$i$i = 0;
 var $cmp174$i = 0, $cmp180$i = 0, $cmp185$i = 0, $cmp185$i$i = 0, $cmp186 = 0, $cmp186$i = 0, $cmp189$i$i = 0, $cmp19$i = 0, $cmp190$i = 0, $cmp191$i = 0, $cmp198$i = 0, $cmp2$i$i = 0, $cmp2$i$i$i = 0, $cmp20$i$i = 0, $cmp203$i = 0, $cmp208$i = 0, $cmp209$i = 0, $cmp21$i = 0, $cmp215$i$i = 0, $cmp217$i = 0;
 var $cmp218$i = 0, $cmp221$i = 0, $cmp224$i = 0, $cmp228$i = 0, $cmp229$i = 0, $cmp233$i = 0, $cmp236$i$i = 0, $cmp24$i = 0, $cmp24$i$i = 0, $cmp246$i = 0, $cmp250$i = 0, $cmp254$i$i = 0, $cmp257$i = 0, $cmp258$i$i = 0, $cmp26$i = 0, $cmp265$i = 0, $cmp27$i$i = 0, $cmp28$i = 0, $cmp28$i$i = 0, $cmp284$i = 0;
 var $cmp287$i = 0, $cmp29 = 0, $cmp3$i$i = 0, $cmp301$i = 0, $cmp306$i$i = 0, $cmp31 = 0, $cmp319$i = 0, $cmp319$i$i = 0, $cmp32$i = 0, $cmp32$i184 = 0, $cmp323$i = 0, $cmp327$i$i = 0, $cmp33$i = 0, $cmp332$i$i = 0, $cmp34$i = 0, $cmp34$i$i = 0, $cmp35$i = 0, $cmp350$i$i = 0, $cmp36$i = 0, $cmp36$i$i = 0;
 var $cmp374$i = 0, $cmp38$i = 0, $cmp38$i$i = 0, $cmp388$i = 0, $cmp396$i = 0, $cmp40$i = 0, $cmp401$i = 0, $cmp41$i$i = 0, $cmp42$i$i = 0, $cmp422$i = 0, $cmp43$i = 0, $cmp44$i$i = 0, $cmp45$i = 0, $cmp45$i152 = 0, $cmp46$i = 0, $cmp46$i$i = 0, $cmp46$i38$i = 0, $cmp48$i = 0, $cmp49$i = 0, $cmp5 = 0;
 var $cmp51$i = 0, $cmp54$i$i = 0, $cmp55$i = 0, $cmp55$i185 = 0, $cmp57$i = 0, $cmp57$i$i = 0, $cmp57$i186 = 0, $cmp59$i$i = 0, $cmp60$i = 0, $cmp60$i$i = 0, $cmp62$i = 0, $cmp63$i = 0, $cmp63$i$i = 0, $cmp65$i = 0, $cmp66$i = 0, $cmp66$i189 = 0, $cmp69$i = 0, $cmp7$i$i = 0, $cmp70 = 0, $cmp72$i = 0;
 var $cmp75$i$i = 0, $cmp76 = 0, $cmp76$i = 0, $cmp79 = 0, $cmp81$i = 0, $cmp81$i$i = 0, $cmp81$i190 = 0, $cmp83$i$i = 0, $cmp85$i = 0, $cmp86$i$i = 0, $cmp89$i = 0, $cmp9$i$i = 0, $cmp90$i = 0, $cmp91$i = 0, $cmp93$i = 0, $cmp95$i = 0, $cmp96$i = 0, $cmp97$i = 0, $cmp97$i$i = 0, $cmp977$i = 0;
 var $cmp99 = 0, $cond = 0, $cond$i = 0, $cond$i$i = 0, $cond$i$i$i = 0, $cond$i150 = 0, $cond$i19$i = 0, $cond$i25$i = 0, $cond$i53$i = 0, $cond115$i$i = 0, $cond13$i$i = 0, $cond15$i$i = 0, $cond2$i$i = 0, $cond3$i = 0, $cond315$i$i = 0, $cond383$i = 0, $exitcond$i$i = 0, $fd$i = 0, $fd$i$i = 0, $fd$i161 = 0;
 var $fd103$i$i = 0, $fd123 = 0, $fd139$i = 0, $fd140$i$i = 0, $fd148$i$i = 0, $fd160$i$i = 0, $fd219$i = 0, $fd247$i$i = 0, $fd303$i$i = 0, $fd312$i = 0, $fd339$i$i = 0, $fd344$i$i = 0, $fd359$i$i = 0, $fd371$i = 0, $fd408$i = 0, $fd416$i = 0, $fd431$i = 0, $fd50$i = 0, $fd54$i$i = 0, $fd59$i$i = 0;
 var $fd68$pre$phi$i$iZ2D = 0, $fd69 = 0, $fd78$i$i = 0, $fd85$i$i = 0, $fd9 = 0, $head = 0, $head$i = 0, $head$i$i = 0, $head$i$i$i = 0, $head$i151 = 0, $head$i20$i = 0, $head$i31$i = 0, $head$i57$i = 0, $head118$i$i = 0, $head168 = 0, $head173 = 0, $head177 = 0, $head179 = 0, $head179$i = 0, $head182$i = 0;
 var $head187$i = 0, $head189$i = 0, $head195 = 0, $head198 = 0, $head208$i$i = 0, $head211$i$i = 0, $head23$i$i = 0, $head25 = 0, $head26$i$i = 0, $head265$i = 0, $head268$i = 0, $head271$i = 0, $head274$i = 0, $head279$i = 0, $head281$i = 0, $head29$i = 0, $head29$i$i = 0, $head317$i$i = 0, $head32$i$i = 0, $head34$i$i = 0;
 var $head386$i = 0, $head7$i$i = 0, $head7$i$i$i = 0, $head7$i59$i = 0, $head94 = 0, $head97 = 0, $head99$i = 0, $i$01$i$i = 0, $idx$0$i = 0, $inc$i$i = 0, $index$i = 0, $index$i$i = 0, $index$i169 = 0, $index$i43$i = 0, $index288$i$i = 0, $index356$i = 0, $magic$i$i = 0, $nb$0 = 0, $neg = 0, $neg$i = 0;
 var $neg$i$i = 0, $neg$i170 = 0, $neg$i181 = 0, $neg103$i = 0, $neg13 = 0, $neg132$i$i = 0, $neg48$i = 0, $neg73 = 0, $next$i = 0, $next$i$i = 0, $next$i$i$i = 0, $next231$i = 0, $not$cmp$i = 0, $not$cmp107$i = 0, $not$cmp114$i = 0, $not$cmp141$i = 0, $not$cmp144$i$i = 0, $not$cmp150$i$i = 0, $not$cmp205$i = 0, $not$cmp346$i$i = 0;
 var $not$cmp4$i = 0, $not$cmp418$i = 0, $not$cmp494$i = 0, $oldfirst$0$i$i = 0, $or$cond$i = 0, $or$cond$i187 = 0, $or$cond1$i = 0, $or$cond1$i183 = 0, $or$cond2$i = 0, $or$cond3$i = 0, $or$cond4$i = 0, $or$cond5$i = 0, $or$cond7$i = 0, $or$cond7$not$i = 0, $or$cond8$i = 0, $or$cond97$i = 0, $or$cond98$i = 0, $or$i = 0, $or$i$i = 0, $or$i$i$i = 0;
 var $or$i194 = 0, $or$i56$i = 0, $or101$i$i = 0, $or110 = 0, $or167 = 0, $or172 = 0, $or176 = 0, $or178$i = 0, $or180 = 0, $or183$i = 0, $or186$i = 0, $or188$i = 0, $or19$i$i = 0, $or194 = 0, $or197 = 0, $or204$i = 0, $or210$i$i = 0, $or22$i$i = 0, $or23 = 0, $or232$i$i = 0;
 var $or26 = 0, $or264$i = 0, $or267$i = 0, $or270$i = 0, $or275$i = 0, $or278$i = 0, $or28$i$i = 0, $or280$i = 0, $or297$i = 0, $or300$i$i = 0, $or33$i$i = 0, $or368$i = 0, $or40 = 0, $or44$i$i = 0, $or93 = 0, $or96 = 0, $parent$i = 0, $parent$i$i = 0, $parent$i159 = 0, $parent$i40$i = 0;
 var $parent135$i = 0, $parent138$i$i = 0, $parent149$i = 0, $parent162$i$i = 0, $parent165$i$i = 0, $parent166$i = 0, $parent179$i$i = 0, $parent196$i$i = 0, $parent226$i = 0, $parent240$i = 0, $parent257$i = 0, $parent301$i$i = 0, $parent337$i$i = 0, $parent361$i$i = 0, $parent369$i = 0, $parent406$i = 0, $parent433$i = 0, $qsize$0$i$i = 0, $retval$0 = 0, $rsize$0$i = 0;
 var $rsize$0$lcssa$i = 0, $rsize$08$i = 0, $rsize$1$i = 0, $rsize$3$i = 0, $rsize$4$lcssa$i = 0, $rsize$49$i = 0, $rst$0$i = 0, $rst$1$i = 0, $sflags193$i = 0, $sflags235$i = 0, $shl = 0, $shl$i = 0, $shl$i$i = 0, $shl$i13$i = 0, $shl$i143 = 0, $shl$i36$i = 0, $shl102 = 0, $shl105 = 0, $shl116$i$i = 0, $shl12 = 0;
 var $shl127$i$i = 0, $shl131$i$i = 0, $shl15$i = 0, $shl18$i = 0, $shl192$i = 0, $shl195$i = 0, $shl198$i = 0, $shl22 = 0, $shl222$i$i = 0, $shl226$i$i = 0, $shl265$i$i = 0, $shl270$i$i = 0, $shl276$i$i = 0, $shl279$i$i = 0, $shl288$i = 0, $shl291$i = 0, $shl294$i$i = 0, $shl31$i = 0, $shl316$i$i = 0, $shl326$i$i = 0;
 var $shl333$i = 0, $shl338$i = 0, $shl344$i = 0, $shl347$i = 0, $shl35 = 0, $shl362$i = 0, $shl37 = 0, $shl384$i = 0, $shl39$i$i = 0, $shl395$i = 0, $shl48$i$i = 0, $shl52$i = 0, $shl60$i = 0, $shl65 = 0, $shl70$i$i = 0, $shl72 = 0, $shl75$i$i = 0, $shl81$i$i = 0, $shl84$i$i = 0, $shl9$i = 0;
 var $shl90 = 0, $shl95$i$i = 0, $shr = 0, $shr$i = 0, $shr$i$i = 0, $shr$i139 = 0, $shr$i34$i = 0, $shr101 = 0, $shr11$i = 0, $shr11$i146 = 0, $shr110$i$i = 0, $shr12$i = 0, $shr124$i$i = 0, $shr15$i = 0, $shr16$i = 0, $shr16$i147 = 0, $shr19$i = 0, $shr194$i = 0, $shr20$i = 0, $shr214$i$i = 0;
 var $shr253$i$i = 0, $shr263$i$i = 0, $shr267$i$i = 0, $shr27$i = 0, $shr272$i$i = 0, $shr277$i$i = 0, $shr281$i$i = 0, $shr283$i = 0, $shr3 = 0, $shr310$i$i = 0, $shr318$i = 0, $shr323$i$i = 0, $shr330$i = 0, $shr335$i = 0, $shr340$i = 0, $shr345$i = 0, $shr349$i = 0, $shr378$i = 0, $shr392$i = 0, $shr4$i = 0;
 var $shr42$i = 0, $shr45 = 0, $shr47 = 0, $shr48 = 0, $shr5$i = 0, $shr5$i141 = 0, $shr51 = 0, $shr52 = 0, $shr55 = 0, $shr56 = 0, $shr58$i$i = 0, $shr59 = 0, $shr60 = 0, $shr63 = 0, $shr68$i$i = 0, $shr7$i = 0, $shr7$i144 = 0, $shr72$i = 0, $shr72$i$i = 0, $shr75$i = 0;
 var $shr76$i = 0, $shr77$i$i = 0, $shr79$i = 0, $shr8$i = 0, $shr80$i = 0, $shr82$i$i = 0, $shr83$i = 0, $shr84$i = 0, $shr86$i$i = 0, $shr87$i = 0, $shr88$i = 0, $shr91$i = 0, $size$i$i = 0, $size$i$i$i = 0, $size188$i = 0, $size245$i = 0, $sizebits$0$i = 0, $sizebits$0$shl52$i = 0, $sp$0$i$i = 0, $sp$0$i$i$i = 0;
 var $sp$0108$i = 0, $sp$1107$i = 0, $ssize$2$ph$i = 0, $sub = 0, $sub$i = 0, $sub$i138 = 0, $sub$i180 = 0, $sub$ptr$lhs$cast$i = 0, $sub$ptr$lhs$cast$i$i = 0, $sub$ptr$lhs$cast$i28$i = 0, $sub$ptr$rhs$cast$i = 0, $sub$ptr$rhs$cast$i$i = 0, $sub$ptr$rhs$cast$i29$i = 0, $sub$ptr$sub$i = 0, $sub$ptr$sub$i$i = 0, $sub$ptr$sub$i30$i = 0, $sub$ptr$sub$tsize$4$i = 0, $sub10$i = 0, $sub101$i = 0, $sub101$rsize$4$i = 0;
 var $sub112$i = 0, $sub113$i$i = 0, $sub118$i = 0, $sub14$i = 0, $sub16$i$i = 0, $sub160 = 0, $sub172$i = 0, $sub18$i$i = 0, $sub190 = 0, $sub2$i = 0, $sub22$i = 0, $sub260$i = 0, $sub262$i$i = 0, $sub266$i$i = 0, $sub271$i$i = 0, $sub275$i$i = 0, $sub30$i = 0, $sub31$i = 0, $sub31$rsize$0$i = 0, $sub313$i$i = 0;
 var $sub329$i = 0, $sub33$i = 0, $sub334$i = 0, $sub339$i = 0, $sub343$i = 0, $sub381$i = 0, $sub4$i = 0, $sub41$i = 0, $sub42 = 0, $sub44 = 0, $sub5$i$i = 0, $sub5$i$i$i = 0, $sub5$i55$i = 0, $sub50$i = 0, $sub6$i = 0, $sub63$i = 0, $sub67$i = 0, $sub67$i$i = 0, $sub70$i = 0, $sub71$i$i = 0;
 var $sub76$i$i = 0, $sub80$i$i = 0, $sub91 = 0, $sub99$i = 0, $t$0$i = 0, $t$2$i = 0, $t$4$ph$i = 0, $t$4$v$4$i = 0, $t$48$i = 0, $tbase$796$i = 0, $tobool$i$i = 0, $tobool107 = 0, $tobool195$i = 0, $tobool200$i = 0, $tobool228$i$i = 0, $tobool237$i = 0, $tobool293$i = 0, $tobool296$i$i = 0, $tobool30$i = 0, $tobool364$i = 0;
 var $tobool97$i$i = 0, $tsize$2657583$i = 0, $tsize$4$i = 0, $tsize$795$i = 0, $v$0$i = 0, $v$0$lcssa$i = 0, $v$09$i = 0, $v$1$i = 0, $v$3$i = 0, $v$4$lcssa$i = 0, $v$4$ph$i = 0, $v$410$i = 0, $xor$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $magic$i$i = sp;
 $cmp = ($bytes>>>0)<(245);
 do {
  if ($cmp) {
   $cmp1 = ($bytes>>>0)<(11);
   $add2 = (($bytes) + 11)|0;
   $and = $add2 & -8;
   $cond = $cmp1 ? 16 : $and;
   $shr = $cond >>> 3;
   $0 = HEAP32[162740]|0;
   $shr3 = $0 >>> $shr;
   $and4 = $shr3 & 3;
   $cmp5 = ($and4|0)==(0);
   if (!($cmp5)) {
    $neg = $shr3 & 1;
    $and7 = $neg ^ 1;
    $add8 = (($and7) + ($shr))|0;
    $shl = $add8 << 1;
    $arrayidx = (651000 + ($shl<<2)|0);
    $1 = ((($arrayidx)) + 8|0);
    $2 = HEAP32[$1>>2]|0;
    $fd9 = ((($2)) + 8|0);
    $3 = HEAP32[$fd9>>2]|0;
    $cmp10 = ($arrayidx|0)==($3|0);
    do {
     if ($cmp10) {
      $shl12 = 1 << $add8;
      $neg13 = $shl12 ^ -1;
      $and14 = $0 & $neg13;
      HEAP32[162740] = $and14;
     } else {
      $4 = HEAP32[(650976)>>2]|0;
      $cmp15 = ($3>>>0)<($4>>>0);
      if ($cmp15) {
       _abort();
       // unreachable;
      }
      $bk = ((($3)) + 12|0);
      $5 = HEAP32[$bk>>2]|0;
      $cmp16 = ($5|0)==($2|0);
      if ($cmp16) {
       HEAP32[$bk>>2] = $arrayidx;
       HEAP32[$1>>2] = $3;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $shl22 = $add8 << 3;
    $or23 = $shl22 | 3;
    $head = ((($2)) + 4|0);
    HEAP32[$head>>2] = $or23;
    $add$ptr = (($2) + ($shl22)|0);
    $head25 = ((($add$ptr)) + 4|0);
    $6 = HEAP32[$head25>>2]|0;
    $or26 = $6 | 1;
    HEAP32[$head25>>2] = $or26;
    $retval$0 = $fd9;
    STACKTOP = sp;return ($retval$0|0);
   }
   $7 = HEAP32[(650968)>>2]|0;
   $cmp29 = ($cond>>>0)>($7>>>0);
   if ($cmp29) {
    $cmp31 = ($shr3|0)==(0);
    if (!($cmp31)) {
     $shl35 = $shr3 << $shr;
     $shl37 = 2 << $shr;
     $sub = (0 - ($shl37))|0;
     $or40 = $shl37 | $sub;
     $and41 = $shl35 & $or40;
     $sub42 = (0 - ($and41))|0;
     $and43 = $and41 & $sub42;
     $sub44 = (($and43) + -1)|0;
     $shr45 = $sub44 >>> 12;
     $and46 = $shr45 & 16;
     $shr47 = $sub44 >>> $and46;
     $shr48 = $shr47 >>> 5;
     $and49 = $shr48 & 8;
     $add50 = $and49 | $and46;
     $shr51 = $shr47 >>> $and49;
     $shr52 = $shr51 >>> 2;
     $and53 = $shr52 & 4;
     $add54 = $add50 | $and53;
     $shr55 = $shr51 >>> $and53;
     $shr56 = $shr55 >>> 1;
     $and57 = $shr56 & 2;
     $add58 = $add54 | $and57;
     $shr59 = $shr55 >>> $and57;
     $shr60 = $shr59 >>> 1;
     $and61 = $shr60 & 1;
     $add62 = $add58 | $and61;
     $shr63 = $shr59 >>> $and61;
     $add64 = (($add62) + ($shr63))|0;
     $shl65 = $add64 << 1;
     $arrayidx66 = (651000 + ($shl65<<2)|0);
     $8 = ((($arrayidx66)) + 8|0);
     $9 = HEAP32[$8>>2]|0;
     $fd69 = ((($9)) + 8|0);
     $10 = HEAP32[$fd69>>2]|0;
     $cmp70 = ($arrayidx66|0)==($10|0);
     do {
      if ($cmp70) {
       $shl72 = 1 << $add64;
       $neg73 = $shl72 ^ -1;
       $and74 = $0 & $neg73;
       HEAP32[162740] = $and74;
       $14 = $and74;
      } else {
       $11 = HEAP32[(650976)>>2]|0;
       $cmp76 = ($10>>>0)<($11>>>0);
       if ($cmp76) {
        _abort();
        // unreachable;
       }
       $bk78 = ((($10)) + 12|0);
       $12 = HEAP32[$bk78>>2]|0;
       $cmp79 = ($12|0)==($9|0);
       if ($cmp79) {
        HEAP32[$bk78>>2] = $arrayidx66;
        HEAP32[$8>>2] = $10;
        $14 = $0;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $shl90 = $add64 << 3;
     $sub91 = (($shl90) - ($cond))|0;
     $or93 = $cond | 3;
     $head94 = ((($9)) + 4|0);
     HEAP32[$head94>>2] = $or93;
     $add$ptr95 = (($9) + ($cond)|0);
     $or96 = $sub91 | 1;
     $head97 = ((($add$ptr95)) + 4|0);
     HEAP32[$head97>>2] = $or96;
     $add$ptr98 = (($add$ptr95) + ($sub91)|0);
     HEAP32[$add$ptr98>>2] = $sub91;
     $cmp99 = ($7|0)==(0);
     if (!($cmp99)) {
      $13 = HEAP32[(650980)>>2]|0;
      $shr101 = $7 >>> 3;
      $shl102 = $shr101 << 1;
      $arrayidx103 = (651000 + ($shl102<<2)|0);
      $shl105 = 1 << $shr101;
      $and106 = $14 & $shl105;
      $tobool107 = ($and106|0)==(0);
      if ($tobool107) {
       $or110 = $14 | $shl105;
       HEAP32[162740] = $or110;
       $$pre = ((($arrayidx103)) + 8|0);
       $$pre$phiZ2D = $$pre;$F104$0 = $arrayidx103;
      } else {
       $15 = ((($arrayidx103)) + 8|0);
       $16 = HEAP32[$15>>2]|0;
       $17 = HEAP32[(650976)>>2]|0;
       $cmp113 = ($16>>>0)<($17>>>0);
       if ($cmp113) {
        _abort();
        // unreachable;
       } else {
        $$pre$phiZ2D = $15;$F104$0 = $16;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $13;
      $bk122 = ((($F104$0)) + 12|0);
      HEAP32[$bk122>>2] = $13;
      $fd123 = ((($13)) + 8|0);
      HEAP32[$fd123>>2] = $F104$0;
      $bk124 = ((($13)) + 12|0);
      HEAP32[$bk124>>2] = $arrayidx103;
     }
     HEAP32[(650968)>>2] = $sub91;
     HEAP32[(650980)>>2] = $add$ptr95;
     $retval$0 = $fd69;
     STACKTOP = sp;return ($retval$0|0);
    }
    $18 = HEAP32[(650964)>>2]|0;
    $cmp128 = ($18|0)==(0);
    if ($cmp128) {
     $nb$0 = $cond;
    } else {
     $sub$i = (0 - ($18))|0;
     $and$i = $18 & $sub$i;
     $sub2$i = (($and$i) + -1)|0;
     $shr$i = $sub2$i >>> 12;
     $and3$i = $shr$i & 16;
     $shr4$i = $sub2$i >>> $and3$i;
     $shr5$i = $shr4$i >>> 5;
     $and6$i = $shr5$i & 8;
     $add$i = $and6$i | $and3$i;
     $shr7$i = $shr4$i >>> $and6$i;
     $shr8$i = $shr7$i >>> 2;
     $and9$i = $shr8$i & 4;
     $add10$i = $add$i | $and9$i;
     $shr11$i = $shr7$i >>> $and9$i;
     $shr12$i = $shr11$i >>> 1;
     $and13$i = $shr12$i & 2;
     $add14$i = $add10$i | $and13$i;
     $shr15$i = $shr11$i >>> $and13$i;
     $shr16$i = $shr15$i >>> 1;
     $and17$i = $shr16$i & 1;
     $add18$i = $add14$i | $and17$i;
     $shr19$i = $shr15$i >>> $and17$i;
     $add20$i = (($add18$i) + ($shr19$i))|0;
     $arrayidx$i = (651264 + ($add20$i<<2)|0);
     $19 = HEAP32[$arrayidx$i>>2]|0;
     $head$i = ((($19)) + 4|0);
     $20 = HEAP32[$head$i>>2]|0;
     $and21$i = $20 & -8;
     $sub22$i = (($and21$i) - ($cond))|0;
     $arrayidx233$i = ((($19)) + 16|0);
     $21 = HEAP32[$arrayidx233$i>>2]|0;
     $not$cmp4$i = ($21|0)==(0|0);
     $$sink5$i = $not$cmp4$i&1;
     $arrayidx276$i = (((($19)) + 16|0) + ($$sink5$i<<2)|0);
     $22 = HEAP32[$arrayidx276$i>>2]|0;
     $cmp287$i = ($22|0)==(0|0);
     if ($cmp287$i) {
      $rsize$0$lcssa$i = $sub22$i;$v$0$lcssa$i = $19;
     } else {
      $23 = $22;$rsize$08$i = $sub22$i;$v$09$i = $19;
      while(1) {
       $head29$i = ((($23)) + 4|0);
       $24 = HEAP32[$head29$i>>2]|0;
       $and30$i = $24 & -8;
       $sub31$i = (($and30$i) - ($cond))|0;
       $cmp32$i = ($sub31$i>>>0)<($rsize$08$i>>>0);
       $sub31$rsize$0$i = $cmp32$i ? $sub31$i : $rsize$08$i;
       $$v$0$i = $cmp32$i ? $23 : $v$09$i;
       $arrayidx23$i = ((($23)) + 16|0);
       $25 = HEAP32[$arrayidx23$i>>2]|0;
       $not$cmp$i = ($25|0)==(0|0);
       $$sink$i = $not$cmp$i&1;
       $arrayidx27$i = (((($23)) + 16|0) + ($$sink$i<<2)|0);
       $26 = HEAP32[$arrayidx27$i>>2]|0;
       $cmp28$i = ($26|0)==(0|0);
       if ($cmp28$i) {
        $rsize$0$lcssa$i = $sub31$rsize$0$i;$v$0$lcssa$i = $$v$0$i;
        break;
       } else {
        $23 = $26;$rsize$08$i = $sub31$rsize$0$i;$v$09$i = $$v$0$i;
       }
      }
     }
     $27 = HEAP32[(650976)>>2]|0;
     $cmp33$i = ($v$0$lcssa$i>>>0)<($27>>>0);
     if ($cmp33$i) {
      _abort();
      // unreachable;
     }
     $add$ptr$i = (($v$0$lcssa$i) + ($cond)|0);
     $cmp35$i = ($v$0$lcssa$i>>>0)<($add$ptr$i>>>0);
     if (!($cmp35$i)) {
      _abort();
      // unreachable;
     }
     $parent$i = ((($v$0$lcssa$i)) + 24|0);
     $28 = HEAP32[$parent$i>>2]|0;
     $bk$i = ((($v$0$lcssa$i)) + 12|0);
     $29 = HEAP32[$bk$i>>2]|0;
     $cmp40$i = ($29|0)==($v$0$lcssa$i|0);
     do {
      if ($cmp40$i) {
       $arrayidx61$i = ((($v$0$lcssa$i)) + 20|0);
       $33 = HEAP32[$arrayidx61$i>>2]|0;
       $cmp62$i = ($33|0)==(0|0);
       if ($cmp62$i) {
        $arrayidx65$i = ((($v$0$lcssa$i)) + 16|0);
        $34 = HEAP32[$arrayidx65$i>>2]|0;
        $cmp66$i = ($34|0)==(0|0);
        if ($cmp66$i) {
         $R$3$i = 0;
         break;
        } else {
         $R$1$i = $34;$RP$1$i = $arrayidx65$i;
        }
       } else {
        $R$1$i = $33;$RP$1$i = $arrayidx61$i;
       }
       while(1) {
        $arrayidx71$i = ((($R$1$i)) + 20|0);
        $35 = HEAP32[$arrayidx71$i>>2]|0;
        $cmp72$i = ($35|0)==(0|0);
        if (!($cmp72$i)) {
         $R$1$i = $35;$RP$1$i = $arrayidx71$i;
         continue;
        }
        $arrayidx75$i = ((($R$1$i)) + 16|0);
        $36 = HEAP32[$arrayidx75$i>>2]|0;
        $cmp76$i = ($36|0)==(0|0);
        if ($cmp76$i) {
         break;
        } else {
         $R$1$i = $36;$RP$1$i = $arrayidx75$i;
        }
       }
       $cmp81$i = ($RP$1$i>>>0)<($27>>>0);
       if ($cmp81$i) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$RP$1$i>>2] = 0;
        $R$3$i = $R$1$i;
        break;
       }
      } else {
       $fd$i = ((($v$0$lcssa$i)) + 8|0);
       $30 = HEAP32[$fd$i>>2]|0;
       $cmp45$i = ($30>>>0)<($27>>>0);
       if ($cmp45$i) {
        _abort();
        // unreachable;
       }
       $bk47$i = ((($30)) + 12|0);
       $31 = HEAP32[$bk47$i>>2]|0;
       $cmp48$i = ($31|0)==($v$0$lcssa$i|0);
       if (!($cmp48$i)) {
        _abort();
        // unreachable;
       }
       $fd50$i = ((($29)) + 8|0);
       $32 = HEAP32[$fd50$i>>2]|0;
       $cmp51$i = ($32|0)==($v$0$lcssa$i|0);
       if ($cmp51$i) {
        HEAP32[$bk47$i>>2] = $29;
        HEAP32[$fd50$i>>2] = $30;
        $R$3$i = $29;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $cmp90$i = ($28|0)==(0|0);
     L73: do {
      if (!($cmp90$i)) {
       $index$i = ((($v$0$lcssa$i)) + 28|0);
       $37 = HEAP32[$index$i>>2]|0;
       $arrayidx94$i = (651264 + ($37<<2)|0);
       $38 = HEAP32[$arrayidx94$i>>2]|0;
       $cmp95$i = ($v$0$lcssa$i|0)==($38|0);
       do {
        if ($cmp95$i) {
         HEAP32[$arrayidx94$i>>2] = $R$3$i;
         $cond$i = ($R$3$i|0)==(0|0);
         if ($cond$i) {
          $shl$i = 1 << $37;
          $neg$i = $shl$i ^ -1;
          $and103$i = $18 & $neg$i;
          HEAP32[(650964)>>2] = $and103$i;
          break L73;
         }
        } else {
         $39 = HEAP32[(650976)>>2]|0;
         $cmp107$i = ($28>>>0)<($39>>>0);
         if ($cmp107$i) {
          _abort();
          // unreachable;
         } else {
          $arrayidx113$i = ((($28)) + 16|0);
          $40 = HEAP32[$arrayidx113$i>>2]|0;
          $not$cmp114$i = ($40|0)!=($v$0$lcssa$i|0);
          $$sink2$i = $not$cmp114$i&1;
          $arrayidx121$i = (((($28)) + 16|0) + ($$sink2$i<<2)|0);
          HEAP32[$arrayidx121$i>>2] = $R$3$i;
          $cmp126$i = ($R$3$i|0)==(0|0);
          if ($cmp126$i) {
           break L73;
          } else {
           break;
          }
         }
        }
       } while(0);
       $41 = HEAP32[(650976)>>2]|0;
       $cmp130$i = ($R$3$i>>>0)<($41>>>0);
       if ($cmp130$i) {
        _abort();
        // unreachable;
       }
       $parent135$i = ((($R$3$i)) + 24|0);
       HEAP32[$parent135$i>>2] = $28;
       $arrayidx137$i = ((($v$0$lcssa$i)) + 16|0);
       $42 = HEAP32[$arrayidx137$i>>2]|0;
       $cmp138$i = ($42|0)==(0|0);
       do {
        if (!($cmp138$i)) {
         $cmp142$i = ($42>>>0)<($41>>>0);
         if ($cmp142$i) {
          _abort();
          // unreachable;
         } else {
          $arrayidx148$i = ((($R$3$i)) + 16|0);
          HEAP32[$arrayidx148$i>>2] = $42;
          $parent149$i = ((($42)) + 24|0);
          HEAP32[$parent149$i>>2] = $R$3$i;
          break;
         }
        }
       } while(0);
       $arrayidx154$i = ((($v$0$lcssa$i)) + 20|0);
       $43 = HEAP32[$arrayidx154$i>>2]|0;
       $cmp155$i = ($43|0)==(0|0);
       if (!($cmp155$i)) {
        $44 = HEAP32[(650976)>>2]|0;
        $cmp159$i = ($43>>>0)<($44>>>0);
        if ($cmp159$i) {
         _abort();
         // unreachable;
        } else {
         $arrayidx165$i = ((($R$3$i)) + 20|0);
         HEAP32[$arrayidx165$i>>2] = $43;
         $parent166$i = ((($43)) + 24|0);
         HEAP32[$parent166$i>>2] = $R$3$i;
         break;
        }
       }
      }
     } while(0);
     $cmp174$i = ($rsize$0$lcssa$i>>>0)<(16);
     if ($cmp174$i) {
      $add177$i = (($rsize$0$lcssa$i) + ($cond))|0;
      $or178$i = $add177$i | 3;
      $head179$i = ((($v$0$lcssa$i)) + 4|0);
      HEAP32[$head179$i>>2] = $or178$i;
      $add$ptr181$i = (($v$0$lcssa$i) + ($add177$i)|0);
      $head182$i = ((($add$ptr181$i)) + 4|0);
      $45 = HEAP32[$head182$i>>2]|0;
      $or183$i = $45 | 1;
      HEAP32[$head182$i>>2] = $or183$i;
     } else {
      $or186$i = $cond | 3;
      $head187$i = ((($v$0$lcssa$i)) + 4|0);
      HEAP32[$head187$i>>2] = $or186$i;
      $or188$i = $rsize$0$lcssa$i | 1;
      $head189$i = ((($add$ptr$i)) + 4|0);
      HEAP32[$head189$i>>2] = $or188$i;
      $add$ptr190$i = (($add$ptr$i) + ($rsize$0$lcssa$i)|0);
      HEAP32[$add$ptr190$i>>2] = $rsize$0$lcssa$i;
      $cmp191$i = ($7|0)==(0);
      if (!($cmp191$i)) {
       $46 = HEAP32[(650980)>>2]|0;
       $shr194$i = $7 >>> 3;
       $shl195$i = $shr194$i << 1;
       $arrayidx196$i = (651000 + ($shl195$i<<2)|0);
       $shl198$i = 1 << $shr194$i;
       $and199$i = $0 & $shl198$i;
       $tobool200$i = ($and199$i|0)==(0);
       if ($tobool200$i) {
        $or204$i = $0 | $shl198$i;
        HEAP32[162740] = $or204$i;
        $$pre$i = ((($arrayidx196$i)) + 8|0);
        $$pre$phi$iZ2D = $$pre$i;$F197$0$i = $arrayidx196$i;
       } else {
        $47 = ((($arrayidx196$i)) + 8|0);
        $48 = HEAP32[$47>>2]|0;
        $49 = HEAP32[(650976)>>2]|0;
        $cmp208$i = ($48>>>0)<($49>>>0);
        if ($cmp208$i) {
         _abort();
         // unreachable;
        } else {
         $$pre$phi$iZ2D = $47;$F197$0$i = $48;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $46;
       $bk218$i = ((($F197$0$i)) + 12|0);
       HEAP32[$bk218$i>>2] = $46;
       $fd219$i = ((($46)) + 8|0);
       HEAP32[$fd219$i>>2] = $F197$0$i;
       $bk220$i = ((($46)) + 12|0);
       HEAP32[$bk220$i>>2] = $arrayidx196$i;
      }
      HEAP32[(650968)>>2] = $rsize$0$lcssa$i;
      HEAP32[(650980)>>2] = $add$ptr$i;
     }
     $add$ptr225$i = ((($v$0$lcssa$i)) + 8|0);
     $retval$0 = $add$ptr225$i;
     STACKTOP = sp;return ($retval$0|0);
    }
   } else {
    $nb$0 = $cond;
   }
  } else {
   $cmp139 = ($bytes>>>0)>(4294967231);
   if ($cmp139) {
    $nb$0 = -1;
   } else {
    $add144 = (($bytes) + 11)|0;
    $and145 = $add144 & -8;
    $50 = HEAP32[(650964)>>2]|0;
    $cmp146 = ($50|0)==(0);
    if ($cmp146) {
     $nb$0 = $and145;
    } else {
     $sub$i138 = (0 - ($and145))|0;
     $shr$i139 = $add144 >>> 8;
     $cmp$i = ($shr$i139|0)==(0);
     if ($cmp$i) {
      $idx$0$i = 0;
     } else {
      $cmp1$i = ($and145>>>0)>(16777215);
      if ($cmp1$i) {
       $idx$0$i = 31;
      } else {
       $sub4$i = (($shr$i139) + 1048320)|0;
       $shr5$i141 = $sub4$i >>> 16;
       $and$i142 = $shr5$i141 & 8;
       $shl$i143 = $shr$i139 << $and$i142;
       $sub6$i = (($shl$i143) + 520192)|0;
       $shr7$i144 = $sub6$i >>> 16;
       $and8$i = $shr7$i144 & 4;
       $add$i145 = $and8$i | $and$i142;
       $shl9$i = $shl$i143 << $and8$i;
       $sub10$i = (($shl9$i) + 245760)|0;
       $shr11$i146 = $sub10$i >>> 16;
       $and12$i = $shr11$i146 & 2;
       $add13$i = $add$i145 | $and12$i;
       $sub14$i = (14 - ($add13$i))|0;
       $shl15$i = $shl9$i << $and12$i;
       $shr16$i147 = $shl15$i >>> 15;
       $add17$i = (($sub14$i) + ($shr16$i147))|0;
       $shl18$i = $add17$i << 1;
       $add19$i = (($add17$i) + 7)|0;
       $shr20$i = $and145 >>> $add19$i;
       $and21$i148 = $shr20$i & 1;
       $add22$i = $and21$i148 | $shl18$i;
       $idx$0$i = $add22$i;
      }
     }
     $arrayidx$i149 = (651264 + ($idx$0$i<<2)|0);
     $51 = HEAP32[$arrayidx$i149>>2]|0;
     $cmp24$i = ($51|0)==(0|0);
     L117: do {
      if ($cmp24$i) {
       $rsize$3$i = $sub$i138;$t$2$i = 0;$v$3$i = 0;
       label = 81;
      } else {
       $cmp26$i = ($idx$0$i|0)==(31);
       $shr27$i = $idx$0$i >>> 1;
       $sub30$i = (25 - ($shr27$i))|0;
       $cond$i150 = $cmp26$i ? 0 : $sub30$i;
       $shl31$i = $and145 << $cond$i150;
       $rsize$0$i = $sub$i138;$rst$0$i = 0;$sizebits$0$i = $shl31$i;$t$0$i = $51;$v$0$i = 0;
       while(1) {
        $head$i151 = ((($t$0$i)) + 4|0);
        $52 = HEAP32[$head$i151>>2]|0;
        $and32$i = $52 & -8;
        $sub33$i = (($and32$i) - ($and145))|0;
        $cmp34$i = ($sub33$i>>>0)<($rsize$0$i>>>0);
        if ($cmp34$i) {
         $cmp36$i = ($sub33$i|0)==(0);
         if ($cmp36$i) {
          $rsize$49$i = 0;$t$48$i = $t$0$i;$v$410$i = $t$0$i;
          label = 85;
          break L117;
         } else {
          $rsize$1$i = $sub33$i;$v$1$i = $t$0$i;
         }
        } else {
         $rsize$1$i = $rsize$0$i;$v$1$i = $v$0$i;
        }
        $arrayidx40$i = ((($t$0$i)) + 20|0);
        $53 = HEAP32[$arrayidx40$i>>2]|0;
        $shr42$i = $sizebits$0$i >>> 31;
        $arrayidx44$i = (((($t$0$i)) + 16|0) + ($shr42$i<<2)|0);
        $54 = HEAP32[$arrayidx44$i>>2]|0;
        $cmp45$i152 = ($53|0)==(0|0);
        $cmp46$i = ($53|0)==($54|0);
        $or$cond1$i = $cmp45$i152 | $cmp46$i;
        $rst$1$i = $or$cond1$i ? $rst$0$i : $53;
        $cmp49$i = ($54|0)==(0|0);
        $not$cmp494$i = $cmp49$i ^ 1;
        $shl52$i = $not$cmp494$i&1;
        $sizebits$0$shl52$i = $sizebits$0$i << $shl52$i;
        if ($cmp49$i) {
         $rsize$3$i = $rsize$1$i;$t$2$i = $rst$1$i;$v$3$i = $v$1$i;
         label = 81;
         break;
        } else {
         $rsize$0$i = $rsize$1$i;$rst$0$i = $rst$1$i;$sizebits$0$i = $sizebits$0$shl52$i;$t$0$i = $54;$v$0$i = $v$1$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 81) {
      $cmp55$i = ($t$2$i|0)==(0|0);
      $cmp57$i = ($v$3$i|0)==(0|0);
      $or$cond$i = $cmp55$i & $cmp57$i;
      if ($or$cond$i) {
       $shl60$i = 2 << $idx$0$i;
       $sub63$i = (0 - ($shl60$i))|0;
       $or$i = $shl60$i | $sub63$i;
       $and64$i = $50 & $or$i;
       $cmp65$i = ($and64$i|0)==(0);
       if ($cmp65$i) {
        $nb$0 = $and145;
        break;
       }
       $sub67$i = (0 - ($and64$i))|0;
       $and68$i = $and64$i & $sub67$i;
       $sub70$i = (($and68$i) + -1)|0;
       $shr72$i = $sub70$i >>> 12;
       $and73$i = $shr72$i & 16;
       $shr75$i = $sub70$i >>> $and73$i;
       $shr76$i = $shr75$i >>> 5;
       $and77$i = $shr76$i & 8;
       $add78$i = $and77$i | $and73$i;
       $shr79$i = $shr75$i >>> $and77$i;
       $shr80$i = $shr79$i >>> 2;
       $and81$i = $shr80$i & 4;
       $add82$i = $add78$i | $and81$i;
       $shr83$i = $shr79$i >>> $and81$i;
       $shr84$i = $shr83$i >>> 1;
       $and85$i = $shr84$i & 2;
       $add86$i = $add82$i | $and85$i;
       $shr87$i = $shr83$i >>> $and85$i;
       $shr88$i = $shr87$i >>> 1;
       $and89$i = $shr88$i & 1;
       $add90$i = $add86$i | $and89$i;
       $shr91$i = $shr87$i >>> $and89$i;
       $add92$i = (($add90$i) + ($shr91$i))|0;
       $arrayidx94$i153 = (651264 + ($add92$i<<2)|0);
       $55 = HEAP32[$arrayidx94$i153>>2]|0;
       $t$4$ph$i = $55;$v$4$ph$i = 0;
      } else {
       $t$4$ph$i = $t$2$i;$v$4$ph$i = $v$3$i;
      }
      $cmp977$i = ($t$4$ph$i|0)==(0|0);
      if ($cmp977$i) {
       $rsize$4$lcssa$i = $rsize$3$i;$v$4$lcssa$i = $v$4$ph$i;
      } else {
       $rsize$49$i = $rsize$3$i;$t$48$i = $t$4$ph$i;$v$410$i = $v$4$ph$i;
       label = 85;
      }
     }
     if ((label|0) == 85) {
      while(1) {
       label = 0;
       $head99$i = ((($t$48$i)) + 4|0);
       $56 = HEAP32[$head99$i>>2]|0;
       $and100$i = $56 & -8;
       $sub101$i = (($and100$i) - ($and145))|0;
       $cmp102$i = ($sub101$i>>>0)<($rsize$49$i>>>0);
       $sub101$rsize$4$i = $cmp102$i ? $sub101$i : $rsize$49$i;
       $t$4$v$4$i = $cmp102$i ? $t$48$i : $v$410$i;
       $arrayidx106$i = ((($t$48$i)) + 16|0);
       $57 = HEAP32[$arrayidx106$i>>2]|0;
       $not$cmp107$i = ($57|0)==(0|0);
       $$sink$i154 = $not$cmp107$i&1;
       $arrayidx113$i155 = (((($t$48$i)) + 16|0) + ($$sink$i154<<2)|0);
       $58 = HEAP32[$arrayidx113$i155>>2]|0;
       $cmp97$i = ($58|0)==(0|0);
       if ($cmp97$i) {
        $rsize$4$lcssa$i = $sub101$rsize$4$i;$v$4$lcssa$i = $t$4$v$4$i;
        break;
       } else {
        $rsize$49$i = $sub101$rsize$4$i;$t$48$i = $58;$v$410$i = $t$4$v$4$i;
        label = 85;
       }
      }
     }
     $cmp116$i = ($v$4$lcssa$i|0)==(0|0);
     if ($cmp116$i) {
      $nb$0 = $and145;
     } else {
      $59 = HEAP32[(650968)>>2]|0;
      $sub118$i = (($59) - ($and145))|0;
      $cmp119$i = ($rsize$4$lcssa$i>>>0)<($sub118$i>>>0);
      if ($cmp119$i) {
       $60 = HEAP32[(650976)>>2]|0;
       $cmp121$i = ($v$4$lcssa$i>>>0)<($60>>>0);
       if ($cmp121$i) {
        _abort();
        // unreachable;
       }
       $add$ptr$i158 = (($v$4$lcssa$i) + ($and145)|0);
       $cmp123$i = ($v$4$lcssa$i>>>0)<($add$ptr$i158>>>0);
       if (!($cmp123$i)) {
        _abort();
        // unreachable;
       }
       $parent$i159 = ((($v$4$lcssa$i)) + 24|0);
       $61 = HEAP32[$parent$i159>>2]|0;
       $bk$i160 = ((($v$4$lcssa$i)) + 12|0);
       $62 = HEAP32[$bk$i160>>2]|0;
       $cmp128$i = ($62|0)==($v$4$lcssa$i|0);
       do {
        if ($cmp128$i) {
         $arrayidx151$i = ((($v$4$lcssa$i)) + 20|0);
         $66 = HEAP32[$arrayidx151$i>>2]|0;
         $cmp152$i = ($66|0)==(0|0);
         if ($cmp152$i) {
          $arrayidx155$i = ((($v$4$lcssa$i)) + 16|0);
          $67 = HEAP32[$arrayidx155$i>>2]|0;
          $cmp156$i = ($67|0)==(0|0);
          if ($cmp156$i) {
           $R$3$i168 = 0;
           break;
          } else {
           $R$1$i165 = $67;$RP$1$i164 = $arrayidx155$i;
          }
         } else {
          $R$1$i165 = $66;$RP$1$i164 = $arrayidx151$i;
         }
         while(1) {
          $arrayidx161$i = ((($R$1$i165)) + 20|0);
          $68 = HEAP32[$arrayidx161$i>>2]|0;
          $cmp162$i = ($68|0)==(0|0);
          if (!($cmp162$i)) {
           $R$1$i165 = $68;$RP$1$i164 = $arrayidx161$i;
           continue;
          }
          $arrayidx165$i166 = ((($R$1$i165)) + 16|0);
          $69 = HEAP32[$arrayidx165$i166>>2]|0;
          $cmp166$i = ($69|0)==(0|0);
          if ($cmp166$i) {
           break;
          } else {
           $R$1$i165 = $69;$RP$1$i164 = $arrayidx165$i166;
          }
         }
         $cmp171$i = ($RP$1$i164>>>0)<($60>>>0);
         if ($cmp171$i) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$RP$1$i164>>2] = 0;
          $R$3$i168 = $R$1$i165;
          break;
         }
        } else {
         $fd$i161 = ((($v$4$lcssa$i)) + 8|0);
         $63 = HEAP32[$fd$i161>>2]|0;
         $cmp133$i = ($63>>>0)<($60>>>0);
         if ($cmp133$i) {
          _abort();
          // unreachable;
         }
         $bk136$i = ((($63)) + 12|0);
         $64 = HEAP32[$bk136$i>>2]|0;
         $cmp137$i = ($64|0)==($v$4$lcssa$i|0);
         if (!($cmp137$i)) {
          _abort();
          // unreachable;
         }
         $fd139$i = ((($62)) + 8|0);
         $65 = HEAP32[$fd139$i>>2]|0;
         $cmp140$i = ($65|0)==($v$4$lcssa$i|0);
         if ($cmp140$i) {
          HEAP32[$bk136$i>>2] = $62;
          HEAP32[$fd139$i>>2] = $63;
          $R$3$i168 = $62;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $cmp180$i = ($61|0)==(0|0);
       L164: do {
        if ($cmp180$i) {
         $83 = $50;
        } else {
         $index$i169 = ((($v$4$lcssa$i)) + 28|0);
         $70 = HEAP32[$index$i169>>2]|0;
         $arrayidx184$i = (651264 + ($70<<2)|0);
         $71 = HEAP32[$arrayidx184$i>>2]|0;
         $cmp185$i = ($v$4$lcssa$i|0)==($71|0);
         do {
          if ($cmp185$i) {
           HEAP32[$arrayidx184$i>>2] = $R$3$i168;
           $cond3$i = ($R$3$i168|0)==(0|0);
           if ($cond3$i) {
            $shl192$i = 1 << $70;
            $neg$i170 = $shl192$i ^ -1;
            $and194$i = $50 & $neg$i170;
            HEAP32[(650964)>>2] = $and194$i;
            $83 = $and194$i;
            break L164;
           }
          } else {
           $72 = HEAP32[(650976)>>2]|0;
           $cmp198$i = ($61>>>0)<($72>>>0);
           if ($cmp198$i) {
            _abort();
            // unreachable;
           } else {
            $arrayidx204$i = ((($61)) + 16|0);
            $73 = HEAP32[$arrayidx204$i>>2]|0;
            $not$cmp205$i = ($73|0)!=($v$4$lcssa$i|0);
            $$sink2$i172 = $not$cmp205$i&1;
            $arrayidx212$i = (((($61)) + 16|0) + ($$sink2$i172<<2)|0);
            HEAP32[$arrayidx212$i>>2] = $R$3$i168;
            $cmp217$i = ($R$3$i168|0)==(0|0);
            if ($cmp217$i) {
             $83 = $50;
             break L164;
            } else {
             break;
            }
           }
          }
         } while(0);
         $74 = HEAP32[(650976)>>2]|0;
         $cmp221$i = ($R$3$i168>>>0)<($74>>>0);
         if ($cmp221$i) {
          _abort();
          // unreachable;
         }
         $parent226$i = ((($R$3$i168)) + 24|0);
         HEAP32[$parent226$i>>2] = $61;
         $arrayidx228$i = ((($v$4$lcssa$i)) + 16|0);
         $75 = HEAP32[$arrayidx228$i>>2]|0;
         $cmp229$i = ($75|0)==(0|0);
         do {
          if (!($cmp229$i)) {
           $cmp233$i = ($75>>>0)<($74>>>0);
           if ($cmp233$i) {
            _abort();
            // unreachable;
           } else {
            $arrayidx239$i = ((($R$3$i168)) + 16|0);
            HEAP32[$arrayidx239$i>>2] = $75;
            $parent240$i = ((($75)) + 24|0);
            HEAP32[$parent240$i>>2] = $R$3$i168;
            break;
           }
          }
         } while(0);
         $arrayidx245$i = ((($v$4$lcssa$i)) + 20|0);
         $76 = HEAP32[$arrayidx245$i>>2]|0;
         $cmp246$i = ($76|0)==(0|0);
         if ($cmp246$i) {
          $83 = $50;
         } else {
          $77 = HEAP32[(650976)>>2]|0;
          $cmp250$i = ($76>>>0)<($77>>>0);
          if ($cmp250$i) {
           _abort();
           // unreachable;
          } else {
           $arrayidx256$i = ((($R$3$i168)) + 20|0);
           HEAP32[$arrayidx256$i>>2] = $76;
           $parent257$i = ((($76)) + 24|0);
           HEAP32[$parent257$i>>2] = $R$3$i168;
           $83 = $50;
           break;
          }
         }
        }
       } while(0);
       $cmp265$i = ($rsize$4$lcssa$i>>>0)<(16);
       do {
        if ($cmp265$i) {
         $add268$i = (($rsize$4$lcssa$i) + ($and145))|0;
         $or270$i = $add268$i | 3;
         $head271$i = ((($v$4$lcssa$i)) + 4|0);
         HEAP32[$head271$i>>2] = $or270$i;
         $add$ptr273$i = (($v$4$lcssa$i) + ($add268$i)|0);
         $head274$i = ((($add$ptr273$i)) + 4|0);
         $78 = HEAP32[$head274$i>>2]|0;
         $or275$i = $78 | 1;
         HEAP32[$head274$i>>2] = $or275$i;
        } else {
         $or278$i = $and145 | 3;
         $head279$i = ((($v$4$lcssa$i)) + 4|0);
         HEAP32[$head279$i>>2] = $or278$i;
         $or280$i = $rsize$4$lcssa$i | 1;
         $head281$i = ((($add$ptr$i158)) + 4|0);
         HEAP32[$head281$i>>2] = $or280$i;
         $add$ptr282$i = (($add$ptr$i158) + ($rsize$4$lcssa$i)|0);
         HEAP32[$add$ptr282$i>>2] = $rsize$4$lcssa$i;
         $shr283$i = $rsize$4$lcssa$i >>> 3;
         $cmp284$i = ($rsize$4$lcssa$i>>>0)<(256);
         if ($cmp284$i) {
          $shl288$i = $shr283$i << 1;
          $arrayidx289$i = (651000 + ($shl288$i<<2)|0);
          $79 = HEAP32[162740]|0;
          $shl291$i = 1 << $shr283$i;
          $and292$i = $79 & $shl291$i;
          $tobool293$i = ($and292$i|0)==(0);
          if ($tobool293$i) {
           $or297$i = $79 | $shl291$i;
           HEAP32[162740] = $or297$i;
           $$pre$i175 = ((($arrayidx289$i)) + 8|0);
           $$pre$phi$i176Z2D = $$pre$i175;$F290$0$i = $arrayidx289$i;
          } else {
           $80 = ((($arrayidx289$i)) + 8|0);
           $81 = HEAP32[$80>>2]|0;
           $82 = HEAP32[(650976)>>2]|0;
           $cmp301$i = ($81>>>0)<($82>>>0);
           if ($cmp301$i) {
            _abort();
            // unreachable;
           } else {
            $$pre$phi$i176Z2D = $80;$F290$0$i = $81;
           }
          }
          HEAP32[$$pre$phi$i176Z2D>>2] = $add$ptr$i158;
          $bk311$i = ((($F290$0$i)) + 12|0);
          HEAP32[$bk311$i>>2] = $add$ptr$i158;
          $fd312$i = ((($add$ptr$i158)) + 8|0);
          HEAP32[$fd312$i>>2] = $F290$0$i;
          $bk313$i = ((($add$ptr$i158)) + 12|0);
          HEAP32[$bk313$i>>2] = $arrayidx289$i;
          break;
         }
         $shr318$i = $rsize$4$lcssa$i >>> 8;
         $cmp319$i = ($shr318$i|0)==(0);
         if ($cmp319$i) {
          $I316$0$i = 0;
         } else {
          $cmp323$i = ($rsize$4$lcssa$i>>>0)>(16777215);
          if ($cmp323$i) {
           $I316$0$i = 31;
          } else {
           $sub329$i = (($shr318$i) + 1048320)|0;
           $shr330$i = $sub329$i >>> 16;
           $and331$i = $shr330$i & 8;
           $shl333$i = $shr318$i << $and331$i;
           $sub334$i = (($shl333$i) + 520192)|0;
           $shr335$i = $sub334$i >>> 16;
           $and336$i = $shr335$i & 4;
           $add337$i = $and336$i | $and331$i;
           $shl338$i = $shl333$i << $and336$i;
           $sub339$i = (($shl338$i) + 245760)|0;
           $shr340$i = $sub339$i >>> 16;
           $and341$i = $shr340$i & 2;
           $add342$i = $add337$i | $and341$i;
           $sub343$i = (14 - ($add342$i))|0;
           $shl344$i = $shl338$i << $and341$i;
           $shr345$i = $shl344$i >>> 15;
           $add346$i = (($sub343$i) + ($shr345$i))|0;
           $shl347$i = $add346$i << 1;
           $add348$i = (($add346$i) + 7)|0;
           $shr349$i = $rsize$4$lcssa$i >>> $add348$i;
           $and350$i = $shr349$i & 1;
           $add351$i = $and350$i | $shl347$i;
           $I316$0$i = $add351$i;
          }
         }
         $arrayidx355$i = (651264 + ($I316$0$i<<2)|0);
         $index356$i = ((($add$ptr$i158)) + 28|0);
         HEAP32[$index356$i>>2] = $I316$0$i;
         $child357$i = ((($add$ptr$i158)) + 16|0);
         $arrayidx358$i = ((($child357$i)) + 4|0);
         HEAP32[$arrayidx358$i>>2] = 0;
         HEAP32[$child357$i>>2] = 0;
         $shl362$i = 1 << $I316$0$i;
         $and363$i = $83 & $shl362$i;
         $tobool364$i = ($and363$i|0)==(0);
         if ($tobool364$i) {
          $or368$i = $83 | $shl362$i;
          HEAP32[(650964)>>2] = $or368$i;
          HEAP32[$arrayidx355$i>>2] = $add$ptr$i158;
          $parent369$i = ((($add$ptr$i158)) + 24|0);
          HEAP32[$parent369$i>>2] = $arrayidx355$i;
          $bk370$i = ((($add$ptr$i158)) + 12|0);
          HEAP32[$bk370$i>>2] = $add$ptr$i158;
          $fd371$i = ((($add$ptr$i158)) + 8|0);
          HEAP32[$fd371$i>>2] = $add$ptr$i158;
          break;
         }
         $84 = HEAP32[$arrayidx355$i>>2]|0;
         $cmp374$i = ($I316$0$i|0)==(31);
         $shr378$i = $I316$0$i >>> 1;
         $sub381$i = (25 - ($shr378$i))|0;
         $cond383$i = $cmp374$i ? 0 : $sub381$i;
         $shl384$i = $rsize$4$lcssa$i << $cond383$i;
         $K373$0$i = $shl384$i;$T$0$i = $84;
         while(1) {
          $head386$i = ((($T$0$i)) + 4|0);
          $85 = HEAP32[$head386$i>>2]|0;
          $and387$i = $85 & -8;
          $cmp388$i = ($and387$i|0)==($rsize$4$lcssa$i|0);
          if ($cmp388$i) {
           label = 139;
           break;
          }
          $shr392$i = $K373$0$i >>> 31;
          $arrayidx394$i = (((($T$0$i)) + 16|0) + ($shr392$i<<2)|0);
          $shl395$i = $K373$0$i << 1;
          $86 = HEAP32[$arrayidx394$i>>2]|0;
          $cmp396$i = ($86|0)==(0|0);
          if ($cmp396$i) {
           label = 136;
           break;
          } else {
           $K373$0$i = $shl395$i;$T$0$i = $86;
          }
         }
         if ((label|0) == 136) {
          $87 = HEAP32[(650976)>>2]|0;
          $cmp401$i = ($arrayidx394$i>>>0)<($87>>>0);
          if ($cmp401$i) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$arrayidx394$i>>2] = $add$ptr$i158;
           $parent406$i = ((($add$ptr$i158)) + 24|0);
           HEAP32[$parent406$i>>2] = $T$0$i;
           $bk407$i = ((($add$ptr$i158)) + 12|0);
           HEAP32[$bk407$i>>2] = $add$ptr$i158;
           $fd408$i = ((($add$ptr$i158)) + 8|0);
           HEAP32[$fd408$i>>2] = $add$ptr$i158;
           break;
          }
         }
         else if ((label|0) == 139) {
          $fd416$i = ((($T$0$i)) + 8|0);
          $88 = HEAP32[$fd416$i>>2]|0;
          $89 = HEAP32[(650976)>>2]|0;
          $cmp422$i = ($88>>>0)>=($89>>>0);
          $not$cmp418$i = ($T$0$i>>>0)>=($89>>>0);
          $90 = $cmp422$i & $not$cmp418$i;
          if ($90) {
           $bk429$i = ((($88)) + 12|0);
           HEAP32[$bk429$i>>2] = $add$ptr$i158;
           HEAP32[$fd416$i>>2] = $add$ptr$i158;
           $fd431$i = ((($add$ptr$i158)) + 8|0);
           HEAP32[$fd431$i>>2] = $88;
           $bk432$i = ((($add$ptr$i158)) + 12|0);
           HEAP32[$bk432$i>>2] = $T$0$i;
           $parent433$i = ((($add$ptr$i158)) + 24|0);
           HEAP32[$parent433$i>>2] = 0;
           break;
          } else {
           _abort();
           // unreachable;
          }
         }
        }
       } while(0);
       $add$ptr441$i = ((($v$4$lcssa$i)) + 8|0);
       $retval$0 = $add$ptr441$i;
       STACKTOP = sp;return ($retval$0|0);
      } else {
       $nb$0 = $and145;
      }
     }
    }
   }
  }
 } while(0);
 $91 = HEAP32[(650968)>>2]|0;
 $cmp156 = ($91>>>0)<($nb$0>>>0);
 if (!($cmp156)) {
  $sub160 = (($91) - ($nb$0))|0;
  $92 = HEAP32[(650980)>>2]|0;
  $cmp162 = ($sub160>>>0)>(15);
  if ($cmp162) {
   $add$ptr166 = (($92) + ($nb$0)|0);
   HEAP32[(650980)>>2] = $add$ptr166;
   HEAP32[(650968)>>2] = $sub160;
   $or167 = $sub160 | 1;
   $head168 = ((($add$ptr166)) + 4|0);
   HEAP32[$head168>>2] = $or167;
   $add$ptr169 = (($add$ptr166) + ($sub160)|0);
   HEAP32[$add$ptr169>>2] = $sub160;
   $or172 = $nb$0 | 3;
   $head173 = ((($92)) + 4|0);
   HEAP32[$head173>>2] = $or172;
  } else {
   HEAP32[(650968)>>2] = 0;
   HEAP32[(650980)>>2] = 0;
   $or176 = $91 | 3;
   $head177 = ((($92)) + 4|0);
   HEAP32[$head177>>2] = $or176;
   $add$ptr178 = (($92) + ($91)|0);
   $head179 = ((($add$ptr178)) + 4|0);
   $93 = HEAP32[$head179>>2]|0;
   $or180 = $93 | 1;
   HEAP32[$head179>>2] = $or180;
  }
  $add$ptr182 = ((($92)) + 8|0);
  $retval$0 = $add$ptr182;
  STACKTOP = sp;return ($retval$0|0);
 }
 $94 = HEAP32[(650972)>>2]|0;
 $cmp186 = ($94>>>0)>($nb$0>>>0);
 if ($cmp186) {
  $sub190 = (($94) - ($nb$0))|0;
  HEAP32[(650972)>>2] = $sub190;
  $95 = HEAP32[(650984)>>2]|0;
  $add$ptr193 = (($95) + ($nb$0)|0);
  HEAP32[(650984)>>2] = $add$ptr193;
  $or194 = $sub190 | 1;
  $head195 = ((($add$ptr193)) + 4|0);
  HEAP32[$head195>>2] = $or194;
  $or197 = $nb$0 | 3;
  $head198 = ((($95)) + 4|0);
  HEAP32[$head198>>2] = $or197;
  $add$ptr199 = ((($95)) + 8|0);
  $retval$0 = $add$ptr199;
  STACKTOP = sp;return ($retval$0|0);
 }
 $96 = HEAP32[162858]|0;
 $cmp$i177 = ($96|0)==(0);
 if ($cmp$i177) {
  HEAP32[(651440)>>2] = 4096;
  HEAP32[(651436)>>2] = 4096;
  HEAP32[(651444)>>2] = -1;
  HEAP32[(651448)>>2] = -1;
  HEAP32[(651452)>>2] = 0;
  HEAP32[(651404)>>2] = 0;
  $97 = $magic$i$i;
  $xor$i$i = $97 & -16;
  $and6$i$i = $xor$i$i ^ 1431655768;
  HEAP32[$magic$i$i>>2] = $and6$i$i;
  HEAP32[162858] = $and6$i$i;
  $98 = 4096;
 } else {
  $$pre$i178 = HEAP32[(651440)>>2]|0;
  $98 = $$pre$i178;
 }
 $add$i179 = (($nb$0) + 48)|0;
 $sub$i180 = (($nb$0) + 47)|0;
 $add9$i = (($98) + ($sub$i180))|0;
 $neg$i181 = (0 - ($98))|0;
 $and11$i = $add9$i & $neg$i181;
 $cmp12$i = ($and11$i>>>0)>($nb$0>>>0);
 if (!($cmp12$i)) {
  $retval$0 = 0;
  STACKTOP = sp;return ($retval$0|0);
 }
 $99 = HEAP32[(651400)>>2]|0;
 $cmp15$i = ($99|0)==(0);
 if (!($cmp15$i)) {
  $100 = HEAP32[(651392)>>2]|0;
  $add17$i182 = (($100) + ($and11$i))|0;
  $cmp19$i = ($add17$i182>>>0)<=($100>>>0);
  $cmp21$i = ($add17$i182>>>0)>($99>>>0);
  $or$cond1$i183 = $cmp19$i | $cmp21$i;
  if ($or$cond1$i183) {
   $retval$0 = 0;
   STACKTOP = sp;return ($retval$0|0);
  }
 }
 $101 = HEAP32[(651404)>>2]|0;
 $and29$i = $101 & 4;
 $tobool30$i = ($and29$i|0)==(0);
 L244: do {
  if ($tobool30$i) {
   $102 = HEAP32[(650984)>>2]|0;
   $cmp32$i184 = ($102|0)==(0|0);
   L246: do {
    if ($cmp32$i184) {
     label = 163;
    } else {
     $sp$0$i$i = (651408);
     while(1) {
      $103 = HEAP32[$sp$0$i$i>>2]|0;
      $cmp$i11$i = ($103>>>0)>($102>>>0);
      if (!($cmp$i11$i)) {
       $size$i$i = ((($sp$0$i$i)) + 4|0);
       $104 = HEAP32[$size$i$i>>2]|0;
       $add$ptr$i$i = (($103) + ($104)|0);
       $cmp2$i$i = ($add$ptr$i$i>>>0)>($102>>>0);
       if ($cmp2$i$i) {
        break;
       }
      }
      $next$i$i = ((($sp$0$i$i)) + 8|0);
      $105 = HEAP32[$next$i$i>>2]|0;
      $cmp3$i$i = ($105|0)==(0|0);
      if ($cmp3$i$i) {
       label = 163;
       break L246;
      } else {
       $sp$0$i$i = $105;
      }
     }
     $add77$i = (($add9$i) - ($94))|0;
     $and80$i = $add77$i & $neg$i181;
     $cmp81$i190 = ($and80$i>>>0)<(2147483647);
     if ($cmp81$i190) {
      $call83$i = (_sbrk(($and80$i|0))|0);
      $110 = HEAP32[$sp$0$i$i>>2]|0;
      $111 = HEAP32[$size$i$i>>2]|0;
      $add$ptr$i192 = (($110) + ($111)|0);
      $cmp85$i = ($call83$i|0)==($add$ptr$i192|0);
      if ($cmp85$i) {
       $cmp89$i = ($call83$i|0)==((-1)|0);
       if ($cmp89$i) {
        $tsize$2657583$i = $and80$i;
       } else {
        $tbase$796$i = $call83$i;$tsize$795$i = $and80$i;
        label = 180;
        break L244;
       }
      } else {
       $br$2$ph$i = $call83$i;$ssize$2$ph$i = $and80$i;
       label = 171;
      }
     } else {
      $tsize$2657583$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 163) {
     $call37$i = (_sbrk(0)|0);
     $cmp38$i = ($call37$i|0)==((-1)|0);
     if ($cmp38$i) {
      $tsize$2657583$i = 0;
     } else {
      $106 = $call37$i;
      $107 = HEAP32[(651436)>>2]|0;
      $sub41$i = (($107) + -1)|0;
      $and42$i = $sub41$i & $106;
      $cmp43$i = ($and42$i|0)==(0);
      $add46$i = (($sub41$i) + ($106))|0;
      $neg48$i = (0 - ($107))|0;
      $and49$i = $add46$i & $neg48$i;
      $sub50$i = (($and49$i) - ($106))|0;
      $add51$i = $cmp43$i ? 0 : $sub50$i;
      $and11$add51$i = (($add51$i) + ($and11$i))|0;
      $108 = HEAP32[(651392)>>2]|0;
      $add54$i = (($and11$add51$i) + ($108))|0;
      $cmp55$i185 = ($and11$add51$i>>>0)>($nb$0>>>0);
      $cmp57$i186 = ($and11$add51$i>>>0)<(2147483647);
      $or$cond$i187 = $cmp55$i185 & $cmp57$i186;
      if ($or$cond$i187) {
       $109 = HEAP32[(651400)>>2]|0;
       $cmp60$i = ($109|0)==(0);
       if (!($cmp60$i)) {
        $cmp63$i = ($add54$i>>>0)<=($108>>>0);
        $cmp66$i189 = ($add54$i>>>0)>($109>>>0);
        $or$cond2$i = $cmp63$i | $cmp66$i189;
        if ($or$cond2$i) {
         $tsize$2657583$i = 0;
         break;
        }
       }
       $call68$i = (_sbrk(($and11$add51$i|0))|0);
       $cmp69$i = ($call68$i|0)==($call37$i|0);
       if ($cmp69$i) {
        $tbase$796$i = $call37$i;$tsize$795$i = $and11$add51$i;
        label = 180;
        break L244;
       } else {
        $br$2$ph$i = $call68$i;$ssize$2$ph$i = $and11$add51$i;
        label = 171;
       }
      } else {
       $tsize$2657583$i = 0;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 171) {
     $sub112$i = (0 - ($ssize$2$ph$i))|0;
     $cmp91$i = ($br$2$ph$i|0)!=((-1)|0);
     $cmp93$i = ($ssize$2$ph$i>>>0)<(2147483647);
     $or$cond5$i = $cmp93$i & $cmp91$i;
     $cmp96$i = ($add$i179>>>0)>($ssize$2$ph$i>>>0);
     $or$cond3$i = $cmp96$i & $or$cond5$i;
     if (!($or$cond3$i)) {
      $cmp118$i = ($br$2$ph$i|0)==((-1)|0);
      if ($cmp118$i) {
       $tsize$2657583$i = 0;
       break;
      } else {
       $tbase$796$i = $br$2$ph$i;$tsize$795$i = $ssize$2$ph$i;
       label = 180;
       break L244;
      }
     }
     $112 = HEAP32[(651440)>>2]|0;
     $sub99$i = (($sub$i180) - ($ssize$2$ph$i))|0;
     $add101$i = (($sub99$i) + ($112))|0;
     $neg103$i = (0 - ($112))|0;
     $and104$i = $add101$i & $neg103$i;
     $cmp105$i = ($and104$i>>>0)<(2147483647);
     if (!($cmp105$i)) {
      $tbase$796$i = $br$2$ph$i;$tsize$795$i = $ssize$2$ph$i;
      label = 180;
      break L244;
     }
     $call107$i = (_sbrk(($and104$i|0))|0);
     $cmp108$i = ($call107$i|0)==((-1)|0);
     if ($cmp108$i) {
      (_sbrk(($sub112$i|0))|0);
      $tsize$2657583$i = 0;
      break;
     } else {
      $add110$i = (($and104$i) + ($ssize$2$ph$i))|0;
      $tbase$796$i = $br$2$ph$i;$tsize$795$i = $add110$i;
      label = 180;
      break L244;
     }
    }
   } while(0);
   $113 = HEAP32[(651404)>>2]|0;
   $or$i194 = $113 | 4;
   HEAP32[(651404)>>2] = $or$i194;
   $tsize$4$i = $tsize$2657583$i;
   label = 178;
  } else {
   $tsize$4$i = 0;
   label = 178;
  }
 } while(0);
 if ((label|0) == 178) {
  $cmp127$i = ($and11$i>>>0)<(2147483647);
  if ($cmp127$i) {
   $call131$i = (_sbrk(($and11$i|0))|0);
   $call132$i = (_sbrk(0)|0);
   $cmp133$i195 = ($call131$i|0)!=((-1)|0);
   $cmp135$i = ($call132$i|0)!=((-1)|0);
   $or$cond4$i = $cmp133$i195 & $cmp135$i;
   $cmp137$i196 = ($call131$i>>>0)<($call132$i>>>0);
   $or$cond7$i = $cmp137$i196 & $or$cond4$i;
   $sub$ptr$lhs$cast$i = $call132$i;
   $sub$ptr$rhs$cast$i = $call131$i;
   $sub$ptr$sub$i = (($sub$ptr$lhs$cast$i) - ($sub$ptr$rhs$cast$i))|0;
   $add140$i = (($nb$0) + 40)|0;
   $cmp141$i = ($sub$ptr$sub$i>>>0)>($add140$i>>>0);
   $sub$ptr$sub$tsize$4$i = $cmp141$i ? $sub$ptr$sub$i : $tsize$4$i;
   $or$cond7$not$i = $or$cond7$i ^ 1;
   $cmp14799$i = ($call131$i|0)==((-1)|0);
   $not$cmp141$i = $cmp141$i ^ 1;
   $cmp147$i = $cmp14799$i | $not$cmp141$i;
   $or$cond97$i = $cmp147$i | $or$cond7$not$i;
   if (!($or$cond97$i)) {
    $tbase$796$i = $call131$i;$tsize$795$i = $sub$ptr$sub$tsize$4$i;
    label = 180;
   }
  }
 }
 if ((label|0) == 180) {
  $114 = HEAP32[(651392)>>2]|0;
  $add150$i = (($114) + ($tsize$795$i))|0;
  HEAP32[(651392)>>2] = $add150$i;
  $115 = HEAP32[(651396)>>2]|0;
  $cmp151$i = ($add150$i>>>0)>($115>>>0);
  if ($cmp151$i) {
   HEAP32[(651396)>>2] = $add150$i;
  }
  $116 = HEAP32[(650984)>>2]|0;
  $cmp157$i = ($116|0)==(0|0);
  do {
   if ($cmp157$i) {
    $117 = HEAP32[(650976)>>2]|0;
    $cmp159$i198 = ($117|0)==(0|0);
    $cmp162$i199 = ($tbase$796$i>>>0)<($117>>>0);
    $or$cond8$i = $cmp159$i198 | $cmp162$i199;
    if ($or$cond8$i) {
     HEAP32[(650976)>>2] = $tbase$796$i;
    }
    HEAP32[(651408)>>2] = $tbase$796$i;
    HEAP32[(651412)>>2] = $tsize$795$i;
    HEAP32[(651420)>>2] = 0;
    $118 = HEAP32[162858]|0;
    HEAP32[(650996)>>2] = $118;
    HEAP32[(650992)>>2] = -1;
    $i$01$i$i = 0;
    while(1) {
     $shl$i13$i = $i$01$i$i << 1;
     $arrayidx$i14$i = (651000 + ($shl$i13$i<<2)|0);
     $119 = ((($arrayidx$i14$i)) + 12|0);
     HEAP32[$119>>2] = $arrayidx$i14$i;
     $120 = ((($arrayidx$i14$i)) + 8|0);
     HEAP32[$120>>2] = $arrayidx$i14$i;
     $inc$i$i = (($i$01$i$i) + 1)|0;
     $exitcond$i$i = ($inc$i$i|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $i$01$i$i = $inc$i$i;
     }
    }
    $sub172$i = (($tsize$795$i) + -40)|0;
    $add$ptr$i16$i = ((($tbase$796$i)) + 8|0);
    $121 = $add$ptr$i16$i;
    $and$i17$i = $121 & 7;
    $cmp$i18$i = ($and$i17$i|0)==(0);
    $122 = (0 - ($121))|0;
    $and3$i$i = $122 & 7;
    $cond$i19$i = $cmp$i18$i ? 0 : $and3$i$i;
    $add$ptr4$i$i = (($tbase$796$i) + ($cond$i19$i)|0);
    $sub5$i$i = (($sub172$i) - ($cond$i19$i))|0;
    HEAP32[(650984)>>2] = $add$ptr4$i$i;
    HEAP32[(650972)>>2] = $sub5$i$i;
    $or$i$i = $sub5$i$i | 1;
    $head$i20$i = ((($add$ptr4$i$i)) + 4|0);
    HEAP32[$head$i20$i>>2] = $or$i$i;
    $add$ptr6$i$i = (($add$ptr4$i$i) + ($sub5$i$i)|0);
    $head7$i$i = ((($add$ptr6$i$i)) + 4|0);
    HEAP32[$head7$i$i>>2] = 40;
    $123 = HEAP32[(651448)>>2]|0;
    HEAP32[(650988)>>2] = $123;
   } else {
    $sp$0108$i = (651408);
    while(1) {
     $124 = HEAP32[$sp$0108$i>>2]|0;
     $size188$i = ((($sp$0108$i)) + 4|0);
     $125 = HEAP32[$size188$i>>2]|0;
     $add$ptr189$i = (($124) + ($125)|0);
     $cmp190$i = ($tbase$796$i|0)==($add$ptr189$i|0);
     if ($cmp190$i) {
      label = 190;
      break;
     }
     $next$i = ((($sp$0108$i)) + 8|0);
     $126 = HEAP32[$next$i>>2]|0;
     $cmp186$i = ($126|0)==(0|0);
     if ($cmp186$i) {
      break;
     } else {
      $sp$0108$i = $126;
     }
    }
    if ((label|0) == 190) {
     $sflags193$i = ((($sp$0108$i)) + 12|0);
     $127 = HEAP32[$sflags193$i>>2]|0;
     $and194$i203 = $127 & 8;
     $tobool195$i = ($and194$i203|0)==(0);
     if ($tobool195$i) {
      $cmp203$i = ($116>>>0)>=($124>>>0);
      $cmp209$i = ($116>>>0)<($tbase$796$i>>>0);
      $or$cond98$i = $cmp209$i & $cmp203$i;
      if ($or$cond98$i) {
       $add212$i = (($125) + ($tsize$795$i))|0;
       HEAP32[$size188$i>>2] = $add212$i;
       $128 = HEAP32[(650972)>>2]|0;
       $add$ptr$i49$i = ((($116)) + 8|0);
       $129 = $add$ptr$i49$i;
       $and$i50$i = $129 & 7;
       $cmp$i51$i = ($and$i50$i|0)==(0);
       $130 = (0 - ($129))|0;
       $and3$i52$i = $130 & 7;
       $cond$i53$i = $cmp$i51$i ? 0 : $and3$i52$i;
       $add$ptr4$i54$i = (($116) + ($cond$i53$i)|0);
       $add215$i = (($tsize$795$i) - ($cond$i53$i))|0;
       $sub5$i55$i = (($128) + ($add215$i))|0;
       HEAP32[(650984)>>2] = $add$ptr4$i54$i;
       HEAP32[(650972)>>2] = $sub5$i55$i;
       $or$i56$i = $sub5$i55$i | 1;
       $head$i57$i = ((($add$ptr4$i54$i)) + 4|0);
       HEAP32[$head$i57$i>>2] = $or$i56$i;
       $add$ptr6$i58$i = (($add$ptr4$i54$i) + ($sub5$i55$i)|0);
       $head7$i59$i = ((($add$ptr6$i58$i)) + 4|0);
       HEAP32[$head7$i59$i>>2] = 40;
       $131 = HEAP32[(651448)>>2]|0;
       HEAP32[(650988)>>2] = $131;
       break;
      }
     }
    }
    $132 = HEAP32[(650976)>>2]|0;
    $cmp218$i = ($tbase$796$i>>>0)<($132>>>0);
    if ($cmp218$i) {
     HEAP32[(650976)>>2] = $tbase$796$i;
     $147 = $tbase$796$i;
    } else {
     $147 = $132;
    }
    $add$ptr227$i = (($tbase$796$i) + ($tsize$795$i)|0);
    $sp$1107$i = (651408);
    while(1) {
     $133 = HEAP32[$sp$1107$i>>2]|0;
     $cmp228$i = ($133|0)==($add$ptr227$i|0);
     if ($cmp228$i) {
      label = 198;
      break;
     }
     $next231$i = ((($sp$1107$i)) + 8|0);
     $134 = HEAP32[$next231$i>>2]|0;
     $cmp224$i = ($134|0)==(0|0);
     if ($cmp224$i) {
      break;
     } else {
      $sp$1107$i = $134;
     }
    }
    if ((label|0) == 198) {
     $sflags235$i = ((($sp$1107$i)) + 12|0);
     $135 = HEAP32[$sflags235$i>>2]|0;
     $and236$i = $135 & 8;
     $tobool237$i = ($and236$i|0)==(0);
     if ($tobool237$i) {
      HEAP32[$sp$1107$i>>2] = $tbase$796$i;
      $size245$i = ((($sp$1107$i)) + 4|0);
      $136 = HEAP32[$size245$i>>2]|0;
      $add246$i = (($136) + ($tsize$795$i))|0;
      HEAP32[$size245$i>>2] = $add246$i;
      $add$ptr$i21$i = ((($tbase$796$i)) + 8|0);
      $137 = $add$ptr$i21$i;
      $and$i22$i = $137 & 7;
      $cmp$i23$i = ($and$i22$i|0)==(0);
      $138 = (0 - ($137))|0;
      $and3$i24$i = $138 & 7;
      $cond$i25$i = $cmp$i23$i ? 0 : $and3$i24$i;
      $add$ptr4$i26$i = (($tbase$796$i) + ($cond$i25$i)|0);
      $add$ptr5$i$i = ((($add$ptr227$i)) + 8|0);
      $139 = $add$ptr5$i$i;
      $and6$i27$i = $139 & 7;
      $cmp7$i$i = ($and6$i27$i|0)==(0);
      $140 = (0 - ($139))|0;
      $and13$i$i = $140 & 7;
      $cond15$i$i = $cmp7$i$i ? 0 : $and13$i$i;
      $add$ptr16$i$i = (($add$ptr227$i) + ($cond15$i$i)|0);
      $sub$ptr$lhs$cast$i28$i = $add$ptr16$i$i;
      $sub$ptr$rhs$cast$i29$i = $add$ptr4$i26$i;
      $sub$ptr$sub$i30$i = (($sub$ptr$lhs$cast$i28$i) - ($sub$ptr$rhs$cast$i29$i))|0;
      $add$ptr17$i$i = (($add$ptr4$i26$i) + ($nb$0)|0);
      $sub18$i$i = (($sub$ptr$sub$i30$i) - ($nb$0))|0;
      $or19$i$i = $nb$0 | 3;
      $head$i31$i = ((($add$ptr4$i26$i)) + 4|0);
      HEAP32[$head$i31$i>>2] = $or19$i$i;
      $cmp20$i$i = ($add$ptr16$i$i|0)==($116|0);
      do {
       if ($cmp20$i$i) {
        $141 = HEAP32[(650972)>>2]|0;
        $add$i$i = (($141) + ($sub18$i$i))|0;
        HEAP32[(650972)>>2] = $add$i$i;
        HEAP32[(650984)>>2] = $add$ptr17$i$i;
        $or22$i$i = $add$i$i | 1;
        $head23$i$i = ((($add$ptr17$i$i)) + 4|0);
        HEAP32[$head23$i$i>>2] = $or22$i$i;
       } else {
        $142 = HEAP32[(650980)>>2]|0;
        $cmp24$i$i = ($add$ptr16$i$i|0)==($142|0);
        if ($cmp24$i$i) {
         $143 = HEAP32[(650968)>>2]|0;
         $add26$i$i = (($143) + ($sub18$i$i))|0;
         HEAP32[(650968)>>2] = $add26$i$i;
         HEAP32[(650980)>>2] = $add$ptr17$i$i;
         $or28$i$i = $add26$i$i | 1;
         $head29$i$i = ((($add$ptr17$i$i)) + 4|0);
         HEAP32[$head29$i$i>>2] = $or28$i$i;
         $add$ptr30$i$i = (($add$ptr17$i$i) + ($add26$i$i)|0);
         HEAP32[$add$ptr30$i$i>>2] = $add26$i$i;
         break;
        }
        $head32$i$i = ((($add$ptr16$i$i)) + 4|0);
        $144 = HEAP32[$head32$i$i>>2]|0;
        $and33$i$i = $144 & 3;
        $cmp34$i$i = ($and33$i$i|0)==(1);
        if ($cmp34$i$i) {
         $and37$i$i = $144 & -8;
         $shr$i34$i = $144 >>> 3;
         $cmp38$i$i = ($144>>>0)<(256);
         L314: do {
          if ($cmp38$i$i) {
           $fd$i$i = ((($add$ptr16$i$i)) + 8|0);
           $145 = HEAP32[$fd$i$i>>2]|0;
           $bk$i35$i = ((($add$ptr16$i$i)) + 12|0);
           $146 = HEAP32[$bk$i35$i>>2]|0;
           $shl$i36$i = $shr$i34$i << 1;
           $arrayidx$i37$i = (651000 + ($shl$i36$i<<2)|0);
           $cmp41$i$i = ($145|0)==($arrayidx$i37$i|0);
           do {
            if (!($cmp41$i$i)) {
             $cmp42$i$i = ($145>>>0)<($147>>>0);
             if ($cmp42$i$i) {
              _abort();
              // unreachable;
             }
             $bk43$i$i = ((($145)) + 12|0);
             $148 = HEAP32[$bk43$i$i>>2]|0;
             $cmp44$i$i = ($148|0)==($add$ptr16$i$i|0);
             if ($cmp44$i$i) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $cmp46$i38$i = ($146|0)==($145|0);
           if ($cmp46$i38$i) {
            $shl48$i$i = 1 << $shr$i34$i;
            $neg$i$i = $shl48$i$i ^ -1;
            $149 = HEAP32[162740]|0;
            $and49$i$i = $149 & $neg$i$i;
            HEAP32[162740] = $and49$i$i;
            break;
           }
           $cmp54$i$i = ($146|0)==($arrayidx$i37$i|0);
           do {
            if ($cmp54$i$i) {
             $$pre5$i$i = ((($146)) + 8|0);
             $fd68$pre$phi$i$iZ2D = $$pre5$i$i;
            } else {
             $cmp57$i$i = ($146>>>0)<($147>>>0);
             if ($cmp57$i$i) {
              _abort();
              // unreachable;
             }
             $fd59$i$i = ((($146)) + 8|0);
             $150 = HEAP32[$fd59$i$i>>2]|0;
             $cmp60$i$i = ($150|0)==($add$ptr16$i$i|0);
             if ($cmp60$i$i) {
              $fd68$pre$phi$i$iZ2D = $fd59$i$i;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $bk67$i$i = ((($145)) + 12|0);
           HEAP32[$bk67$i$i>>2] = $146;
           HEAP32[$fd68$pre$phi$i$iZ2D>>2] = $145;
          } else {
           $parent$i40$i = ((($add$ptr16$i$i)) + 24|0);
           $151 = HEAP32[$parent$i40$i>>2]|0;
           $bk74$i$i = ((($add$ptr16$i$i)) + 12|0);
           $152 = HEAP32[$bk74$i$i>>2]|0;
           $cmp75$i$i = ($152|0)==($add$ptr16$i$i|0);
           do {
            if ($cmp75$i$i) {
             $child$i$i = ((($add$ptr16$i$i)) + 16|0);
             $arrayidx96$i$i = ((($child$i$i)) + 4|0);
             $156 = HEAP32[$arrayidx96$i$i>>2]|0;
             $cmp97$i$i = ($156|0)==(0|0);
             if ($cmp97$i$i) {
              $157 = HEAP32[$child$i$i>>2]|0;
              $cmp100$i$i = ($157|0)==(0|0);
              if ($cmp100$i$i) {
               $R$3$i$i = 0;
               break;
              } else {
               $R$1$i$i = $157;$RP$1$i$i = $child$i$i;
              }
             } else {
              $R$1$i$i = $156;$RP$1$i$i = $arrayidx96$i$i;
             }
             while(1) {
              $arrayidx103$i$i = ((($R$1$i$i)) + 20|0);
              $158 = HEAP32[$arrayidx103$i$i>>2]|0;
              $cmp104$i$i = ($158|0)==(0|0);
              if (!($cmp104$i$i)) {
               $R$1$i$i = $158;$RP$1$i$i = $arrayidx103$i$i;
               continue;
              }
              $arrayidx107$i$i = ((($R$1$i$i)) + 16|0);
              $159 = HEAP32[$arrayidx107$i$i>>2]|0;
              $cmp108$i$i = ($159|0)==(0|0);
              if ($cmp108$i$i) {
               break;
              } else {
               $R$1$i$i = $159;$RP$1$i$i = $arrayidx107$i$i;
              }
             }
             $cmp112$i$i = ($RP$1$i$i>>>0)<($147>>>0);
             if ($cmp112$i$i) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$RP$1$i$i>>2] = 0;
              $R$3$i$i = $R$1$i$i;
              break;
             }
            } else {
             $fd78$i$i = ((($add$ptr16$i$i)) + 8|0);
             $153 = HEAP32[$fd78$i$i>>2]|0;
             $cmp81$i$i = ($153>>>0)<($147>>>0);
             if ($cmp81$i$i) {
              _abort();
              // unreachable;
             }
             $bk82$i$i = ((($153)) + 12|0);
             $154 = HEAP32[$bk82$i$i>>2]|0;
             $cmp83$i$i = ($154|0)==($add$ptr16$i$i|0);
             if (!($cmp83$i$i)) {
              _abort();
              // unreachable;
             }
             $fd85$i$i = ((($152)) + 8|0);
             $155 = HEAP32[$fd85$i$i>>2]|0;
             $cmp86$i$i = ($155|0)==($add$ptr16$i$i|0);
             if ($cmp86$i$i) {
              HEAP32[$bk82$i$i>>2] = $152;
              HEAP32[$fd85$i$i>>2] = $153;
              $R$3$i$i = $152;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $cmp120$i42$i = ($151|0)==(0|0);
           if ($cmp120$i42$i) {
            break;
           }
           $index$i43$i = ((($add$ptr16$i$i)) + 28|0);
           $160 = HEAP32[$index$i43$i>>2]|0;
           $arrayidx123$i$i = (651264 + ($160<<2)|0);
           $161 = HEAP32[$arrayidx123$i$i>>2]|0;
           $cmp124$i$i = ($add$ptr16$i$i|0)==($161|0);
           do {
            if ($cmp124$i$i) {
             HEAP32[$arrayidx123$i$i>>2] = $R$3$i$i;
             $cond2$i$i = ($R$3$i$i|0)==(0|0);
             if (!($cond2$i$i)) {
              break;
             }
             $shl131$i$i = 1 << $160;
             $neg132$i$i = $shl131$i$i ^ -1;
             $162 = HEAP32[(650964)>>2]|0;
             $and133$i$i = $162 & $neg132$i$i;
             HEAP32[(650964)>>2] = $and133$i$i;
             break L314;
            } else {
             $163 = HEAP32[(650976)>>2]|0;
             $cmp137$i$i = ($151>>>0)<($163>>>0);
             if ($cmp137$i$i) {
              _abort();
              // unreachable;
             } else {
              $arrayidx143$i$i = ((($151)) + 16|0);
              $164 = HEAP32[$arrayidx143$i$i>>2]|0;
              $not$cmp144$i$i = ($164|0)!=($add$ptr16$i$i|0);
              $$sink$i$i = $not$cmp144$i$i&1;
              $arrayidx151$i$i = (((($151)) + 16|0) + ($$sink$i$i<<2)|0);
              HEAP32[$arrayidx151$i$i>>2] = $R$3$i$i;
              $cmp156$i$i = ($R$3$i$i|0)==(0|0);
              if ($cmp156$i$i) {
               break L314;
              } else {
               break;
              }
             }
            }
           } while(0);
           $165 = HEAP32[(650976)>>2]|0;
           $cmp160$i$i = ($R$3$i$i>>>0)<($165>>>0);
           if ($cmp160$i$i) {
            _abort();
            // unreachable;
           }
           $parent165$i$i = ((($R$3$i$i)) + 24|0);
           HEAP32[$parent165$i$i>>2] = $151;
           $child166$i$i = ((($add$ptr16$i$i)) + 16|0);
           $166 = HEAP32[$child166$i$i>>2]|0;
           $cmp168$i$i = ($166|0)==(0|0);
           do {
            if (!($cmp168$i$i)) {
             $cmp172$i$i = ($166>>>0)<($165>>>0);
             if ($cmp172$i$i) {
              _abort();
              // unreachable;
             } else {
              $arrayidx178$i$i = ((($R$3$i$i)) + 16|0);
              HEAP32[$arrayidx178$i$i>>2] = $166;
              $parent179$i$i = ((($166)) + 24|0);
              HEAP32[$parent179$i$i>>2] = $R$3$i$i;
              break;
             }
            }
           } while(0);
           $arrayidx184$i$i = ((($child166$i$i)) + 4|0);
           $167 = HEAP32[$arrayidx184$i$i>>2]|0;
           $cmp185$i$i = ($167|0)==(0|0);
           if ($cmp185$i$i) {
            break;
           }
           $168 = HEAP32[(650976)>>2]|0;
           $cmp189$i$i = ($167>>>0)<($168>>>0);
           if ($cmp189$i$i) {
            _abort();
            // unreachable;
           } else {
            $arrayidx195$i$i = ((($R$3$i$i)) + 20|0);
            HEAP32[$arrayidx195$i$i>>2] = $167;
            $parent196$i$i = ((($167)) + 24|0);
            HEAP32[$parent196$i$i>>2] = $R$3$i$i;
            break;
           }
          }
         } while(0);
         $add$ptr205$i$i = (($add$ptr16$i$i) + ($and37$i$i)|0);
         $add206$i$i = (($and37$i$i) + ($sub18$i$i))|0;
         $oldfirst$0$i$i = $add$ptr205$i$i;$qsize$0$i$i = $add206$i$i;
        } else {
         $oldfirst$0$i$i = $add$ptr16$i$i;$qsize$0$i$i = $sub18$i$i;
        }
        $head208$i$i = ((($oldfirst$0$i$i)) + 4|0);
        $169 = HEAP32[$head208$i$i>>2]|0;
        $and209$i$i = $169 & -2;
        HEAP32[$head208$i$i>>2] = $and209$i$i;
        $or210$i$i = $qsize$0$i$i | 1;
        $head211$i$i = ((($add$ptr17$i$i)) + 4|0);
        HEAP32[$head211$i$i>>2] = $or210$i$i;
        $add$ptr212$i$i = (($add$ptr17$i$i) + ($qsize$0$i$i)|0);
        HEAP32[$add$ptr212$i$i>>2] = $qsize$0$i$i;
        $shr214$i$i = $qsize$0$i$i >>> 3;
        $cmp215$i$i = ($qsize$0$i$i>>>0)<(256);
        if ($cmp215$i$i) {
         $shl222$i$i = $shr214$i$i << 1;
         $arrayidx223$i$i = (651000 + ($shl222$i$i<<2)|0);
         $170 = HEAP32[162740]|0;
         $shl226$i$i = 1 << $shr214$i$i;
         $and227$i$i = $170 & $shl226$i$i;
         $tobool228$i$i = ($and227$i$i|0)==(0);
         do {
          if ($tobool228$i$i) {
           $or232$i$i = $170 | $shl226$i$i;
           HEAP32[162740] = $or232$i$i;
           $$pre$i45$i = ((($arrayidx223$i$i)) + 8|0);
           $$pre$phi$i46$iZ2D = $$pre$i45$i;$F224$0$i$i = $arrayidx223$i$i;
          } else {
           $171 = ((($arrayidx223$i$i)) + 8|0);
           $172 = HEAP32[$171>>2]|0;
           $173 = HEAP32[(650976)>>2]|0;
           $cmp236$i$i = ($172>>>0)<($173>>>0);
           if (!($cmp236$i$i)) {
            $$pre$phi$i46$iZ2D = $171;$F224$0$i$i = $172;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i46$iZ2D>>2] = $add$ptr17$i$i;
         $bk246$i$i = ((($F224$0$i$i)) + 12|0);
         HEAP32[$bk246$i$i>>2] = $add$ptr17$i$i;
         $fd247$i$i = ((($add$ptr17$i$i)) + 8|0);
         HEAP32[$fd247$i$i>>2] = $F224$0$i$i;
         $bk248$i$i = ((($add$ptr17$i$i)) + 12|0);
         HEAP32[$bk248$i$i>>2] = $arrayidx223$i$i;
         break;
        }
        $shr253$i$i = $qsize$0$i$i >>> 8;
        $cmp254$i$i = ($shr253$i$i|0)==(0);
        do {
         if ($cmp254$i$i) {
          $I252$0$i$i = 0;
         } else {
          $cmp258$i$i = ($qsize$0$i$i>>>0)>(16777215);
          if ($cmp258$i$i) {
           $I252$0$i$i = 31;
           break;
          }
          $sub262$i$i = (($shr253$i$i) + 1048320)|0;
          $shr263$i$i = $sub262$i$i >>> 16;
          $and264$i$i = $shr263$i$i & 8;
          $shl265$i$i = $shr253$i$i << $and264$i$i;
          $sub266$i$i = (($shl265$i$i) + 520192)|0;
          $shr267$i$i = $sub266$i$i >>> 16;
          $and268$i$i = $shr267$i$i & 4;
          $add269$i$i = $and268$i$i | $and264$i$i;
          $shl270$i$i = $shl265$i$i << $and268$i$i;
          $sub271$i$i = (($shl270$i$i) + 245760)|0;
          $shr272$i$i = $sub271$i$i >>> 16;
          $and273$i$i = $shr272$i$i & 2;
          $add274$i$i = $add269$i$i | $and273$i$i;
          $sub275$i$i = (14 - ($add274$i$i))|0;
          $shl276$i$i = $shl270$i$i << $and273$i$i;
          $shr277$i$i = $shl276$i$i >>> 15;
          $add278$i$i = (($sub275$i$i) + ($shr277$i$i))|0;
          $shl279$i$i = $add278$i$i << 1;
          $add280$i$i = (($add278$i$i) + 7)|0;
          $shr281$i$i = $qsize$0$i$i >>> $add280$i$i;
          $and282$i$i = $shr281$i$i & 1;
          $add283$i$i = $and282$i$i | $shl279$i$i;
          $I252$0$i$i = $add283$i$i;
         }
        } while(0);
        $arrayidx287$i$i = (651264 + ($I252$0$i$i<<2)|0);
        $index288$i$i = ((($add$ptr17$i$i)) + 28|0);
        HEAP32[$index288$i$i>>2] = $I252$0$i$i;
        $child289$i$i = ((($add$ptr17$i$i)) + 16|0);
        $arrayidx290$i$i = ((($child289$i$i)) + 4|0);
        HEAP32[$arrayidx290$i$i>>2] = 0;
        HEAP32[$child289$i$i>>2] = 0;
        $174 = HEAP32[(650964)>>2]|0;
        $shl294$i$i = 1 << $I252$0$i$i;
        $and295$i$i = $174 & $shl294$i$i;
        $tobool296$i$i = ($and295$i$i|0)==(0);
        if ($tobool296$i$i) {
         $or300$i$i = $174 | $shl294$i$i;
         HEAP32[(650964)>>2] = $or300$i$i;
         HEAP32[$arrayidx287$i$i>>2] = $add$ptr17$i$i;
         $parent301$i$i = ((($add$ptr17$i$i)) + 24|0);
         HEAP32[$parent301$i$i>>2] = $arrayidx287$i$i;
         $bk302$i$i = ((($add$ptr17$i$i)) + 12|0);
         HEAP32[$bk302$i$i>>2] = $add$ptr17$i$i;
         $fd303$i$i = ((($add$ptr17$i$i)) + 8|0);
         HEAP32[$fd303$i$i>>2] = $add$ptr17$i$i;
         break;
        }
        $175 = HEAP32[$arrayidx287$i$i>>2]|0;
        $cmp306$i$i = ($I252$0$i$i|0)==(31);
        $shr310$i$i = $I252$0$i$i >>> 1;
        $sub313$i$i = (25 - ($shr310$i$i))|0;
        $cond315$i$i = $cmp306$i$i ? 0 : $sub313$i$i;
        $shl316$i$i = $qsize$0$i$i << $cond315$i$i;
        $K305$0$i$i = $shl316$i$i;$T$0$i47$i = $175;
        while(1) {
         $head317$i$i = ((($T$0$i47$i)) + 4|0);
         $176 = HEAP32[$head317$i$i>>2]|0;
         $and318$i$i = $176 & -8;
         $cmp319$i$i = ($and318$i$i|0)==($qsize$0$i$i|0);
         if ($cmp319$i$i) {
          label = 265;
          break;
         }
         $shr323$i$i = $K305$0$i$i >>> 31;
         $arrayidx325$i$i = (((($T$0$i47$i)) + 16|0) + ($shr323$i$i<<2)|0);
         $shl326$i$i = $K305$0$i$i << 1;
         $177 = HEAP32[$arrayidx325$i$i>>2]|0;
         $cmp327$i$i = ($177|0)==(0|0);
         if ($cmp327$i$i) {
          label = 262;
          break;
         } else {
          $K305$0$i$i = $shl326$i$i;$T$0$i47$i = $177;
         }
        }
        if ((label|0) == 262) {
         $178 = HEAP32[(650976)>>2]|0;
         $cmp332$i$i = ($arrayidx325$i$i>>>0)<($178>>>0);
         if ($cmp332$i$i) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$arrayidx325$i$i>>2] = $add$ptr17$i$i;
          $parent337$i$i = ((($add$ptr17$i$i)) + 24|0);
          HEAP32[$parent337$i$i>>2] = $T$0$i47$i;
          $bk338$i$i = ((($add$ptr17$i$i)) + 12|0);
          HEAP32[$bk338$i$i>>2] = $add$ptr17$i$i;
          $fd339$i$i = ((($add$ptr17$i$i)) + 8|0);
          HEAP32[$fd339$i$i>>2] = $add$ptr17$i$i;
          break;
         }
        }
        else if ((label|0) == 265) {
         $fd344$i$i = ((($T$0$i47$i)) + 8|0);
         $179 = HEAP32[$fd344$i$i>>2]|0;
         $180 = HEAP32[(650976)>>2]|0;
         $cmp350$i$i = ($179>>>0)>=($180>>>0);
         $not$cmp346$i$i = ($T$0$i47$i>>>0)>=($180>>>0);
         $181 = $cmp350$i$i & $not$cmp346$i$i;
         if ($181) {
          $bk357$i$i = ((($179)) + 12|0);
          HEAP32[$bk357$i$i>>2] = $add$ptr17$i$i;
          HEAP32[$fd344$i$i>>2] = $add$ptr17$i$i;
          $fd359$i$i = ((($add$ptr17$i$i)) + 8|0);
          HEAP32[$fd359$i$i>>2] = $179;
          $bk360$i$i = ((($add$ptr17$i$i)) + 12|0);
          HEAP32[$bk360$i$i>>2] = $T$0$i47$i;
          $parent361$i$i = ((($add$ptr17$i$i)) + 24|0);
          HEAP32[$parent361$i$i>>2] = 0;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       }
      } while(0);
      $add$ptr369$i$i = ((($add$ptr4$i26$i)) + 8|0);
      $retval$0 = $add$ptr369$i$i;
      STACKTOP = sp;return ($retval$0|0);
     }
    }
    $sp$0$i$i$i = (651408);
    while(1) {
     $182 = HEAP32[$sp$0$i$i$i>>2]|0;
     $cmp$i$i$i = ($182>>>0)>($116>>>0);
     if (!($cmp$i$i$i)) {
      $size$i$i$i = ((($sp$0$i$i$i)) + 4|0);
      $183 = HEAP32[$size$i$i$i>>2]|0;
      $add$ptr$i$i$i = (($182) + ($183)|0);
      $cmp2$i$i$i = ($add$ptr$i$i$i>>>0)>($116>>>0);
      if ($cmp2$i$i$i) {
       break;
      }
     }
     $next$i$i$i = ((($sp$0$i$i$i)) + 8|0);
     $184 = HEAP32[$next$i$i$i>>2]|0;
     $sp$0$i$i$i = $184;
    }
    $add$ptr2$i$i = ((($add$ptr$i$i$i)) + -47|0);
    $add$ptr3$i$i = ((($add$ptr2$i$i)) + 8|0);
    $185 = $add$ptr3$i$i;
    $and$i$i = $185 & 7;
    $cmp$i9$i = ($and$i$i|0)==(0);
    $186 = (0 - ($185))|0;
    $and6$i10$i = $186 & 7;
    $cond$i$i = $cmp$i9$i ? 0 : $and6$i10$i;
    $add$ptr7$i$i = (($add$ptr2$i$i) + ($cond$i$i)|0);
    $add$ptr81$i$i = ((($116)) + 16|0);
    $cmp9$i$i = ($add$ptr7$i$i>>>0)<($add$ptr81$i$i>>>0);
    $cond13$i$i = $cmp9$i$i ? $116 : $add$ptr7$i$i;
    $add$ptr14$i$i = ((($cond13$i$i)) + 8|0);
    $add$ptr15$i$i = ((($cond13$i$i)) + 24|0);
    $sub16$i$i = (($tsize$795$i) + -40)|0;
    $add$ptr$i2$i$i = ((($tbase$796$i)) + 8|0);
    $187 = $add$ptr$i2$i$i;
    $and$i$i$i = $187 & 7;
    $cmp$i3$i$i = ($and$i$i$i|0)==(0);
    $188 = (0 - ($187))|0;
    $and3$i$i$i = $188 & 7;
    $cond$i$i$i = $cmp$i3$i$i ? 0 : $and3$i$i$i;
    $add$ptr4$i$i$i = (($tbase$796$i) + ($cond$i$i$i)|0);
    $sub5$i$i$i = (($sub16$i$i) - ($cond$i$i$i))|0;
    HEAP32[(650984)>>2] = $add$ptr4$i$i$i;
    HEAP32[(650972)>>2] = $sub5$i$i$i;
    $or$i$i$i = $sub5$i$i$i | 1;
    $head$i$i$i = ((($add$ptr4$i$i$i)) + 4|0);
    HEAP32[$head$i$i$i>>2] = $or$i$i$i;
    $add$ptr6$i$i$i = (($add$ptr4$i$i$i) + ($sub5$i$i$i)|0);
    $head7$i$i$i = ((($add$ptr6$i$i$i)) + 4|0);
    HEAP32[$head7$i$i$i>>2] = 40;
    $189 = HEAP32[(651448)>>2]|0;
    HEAP32[(650988)>>2] = $189;
    $head$i$i = ((($cond13$i$i)) + 4|0);
    HEAP32[$head$i$i>>2] = 27;
    ;HEAP32[$add$ptr14$i$i>>2]=HEAP32[(651408)>>2]|0;HEAP32[$add$ptr14$i$i+4>>2]=HEAP32[(651408)+4>>2]|0;HEAP32[$add$ptr14$i$i+8>>2]=HEAP32[(651408)+8>>2]|0;HEAP32[$add$ptr14$i$i+12>>2]=HEAP32[(651408)+12>>2]|0;
    HEAP32[(651408)>>2] = $tbase$796$i;
    HEAP32[(651412)>>2] = $tsize$795$i;
    HEAP32[(651420)>>2] = 0;
    HEAP32[(651416)>>2] = $add$ptr14$i$i;
    $190 = $add$ptr15$i$i;
    while(1) {
     $add$ptr24$i$i = ((($190)) + 4|0);
     HEAP32[$add$ptr24$i$i>>2] = 7;
     $head26$i$i = ((($190)) + 8|0);
     $cmp27$i$i = ($head26$i$i>>>0)<($add$ptr$i$i$i>>>0);
     if ($cmp27$i$i) {
      $190 = $add$ptr24$i$i;
     } else {
      break;
     }
    }
    $cmp28$i$i = ($cond13$i$i|0)==($116|0);
    if (!($cmp28$i$i)) {
     $sub$ptr$lhs$cast$i$i = $cond13$i$i;
     $sub$ptr$rhs$cast$i$i = $116;
     $sub$ptr$sub$i$i = (($sub$ptr$lhs$cast$i$i) - ($sub$ptr$rhs$cast$i$i))|0;
     $191 = HEAP32[$head$i$i>>2]|0;
     $and32$i$i = $191 & -2;
     HEAP32[$head$i$i>>2] = $and32$i$i;
     $or33$i$i = $sub$ptr$sub$i$i | 1;
     $head34$i$i = ((($116)) + 4|0);
     HEAP32[$head34$i$i>>2] = $or33$i$i;
     HEAP32[$cond13$i$i>>2] = $sub$ptr$sub$i$i;
     $shr$i$i = $sub$ptr$sub$i$i >>> 3;
     $cmp36$i$i = ($sub$ptr$sub$i$i>>>0)<(256);
     if ($cmp36$i$i) {
      $shl$i$i = $shr$i$i << 1;
      $arrayidx$i$i = (651000 + ($shl$i$i<<2)|0);
      $192 = HEAP32[162740]|0;
      $shl39$i$i = 1 << $shr$i$i;
      $and40$i$i = $192 & $shl39$i$i;
      $tobool$i$i = ($and40$i$i|0)==(0);
      if ($tobool$i$i) {
       $or44$i$i = $192 | $shl39$i$i;
       HEAP32[162740] = $or44$i$i;
       $$pre$i$i = ((($arrayidx$i$i)) + 8|0);
       $$pre$phi$i$iZ2D = $$pre$i$i;$F$0$i$i = $arrayidx$i$i;
      } else {
       $193 = ((($arrayidx$i$i)) + 8|0);
       $194 = HEAP32[$193>>2]|0;
       $195 = HEAP32[(650976)>>2]|0;
       $cmp46$i$i = ($194>>>0)<($195>>>0);
       if ($cmp46$i$i) {
        _abort();
        // unreachable;
       } else {
        $$pre$phi$i$iZ2D = $193;$F$0$i$i = $194;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $116;
      $bk$i$i = ((($F$0$i$i)) + 12|0);
      HEAP32[$bk$i$i>>2] = $116;
      $fd54$i$i = ((($116)) + 8|0);
      HEAP32[$fd54$i$i>>2] = $F$0$i$i;
      $bk55$i$i = ((($116)) + 12|0);
      HEAP32[$bk55$i$i>>2] = $arrayidx$i$i;
      break;
     }
     $shr58$i$i = $sub$ptr$sub$i$i >>> 8;
     $cmp59$i$i = ($shr58$i$i|0)==(0);
     if ($cmp59$i$i) {
      $I57$0$i$i = 0;
     } else {
      $cmp63$i$i = ($sub$ptr$sub$i$i>>>0)>(16777215);
      if ($cmp63$i$i) {
       $I57$0$i$i = 31;
      } else {
       $sub67$i$i = (($shr58$i$i) + 1048320)|0;
       $shr68$i$i = $sub67$i$i >>> 16;
       $and69$i$i = $shr68$i$i & 8;
       $shl70$i$i = $shr58$i$i << $and69$i$i;
       $sub71$i$i = (($shl70$i$i) + 520192)|0;
       $shr72$i$i = $sub71$i$i >>> 16;
       $and73$i$i = $shr72$i$i & 4;
       $add74$i$i = $and73$i$i | $and69$i$i;
       $shl75$i$i = $shl70$i$i << $and73$i$i;
       $sub76$i$i = (($shl75$i$i) + 245760)|0;
       $shr77$i$i = $sub76$i$i >>> 16;
       $and78$i$i = $shr77$i$i & 2;
       $add79$i$i = $add74$i$i | $and78$i$i;
       $sub80$i$i = (14 - ($add79$i$i))|0;
       $shl81$i$i = $shl75$i$i << $and78$i$i;
       $shr82$i$i = $shl81$i$i >>> 15;
       $add83$i$i = (($sub80$i$i) + ($shr82$i$i))|0;
       $shl84$i$i = $add83$i$i << 1;
       $add85$i$i = (($add83$i$i) + 7)|0;
       $shr86$i$i = $sub$ptr$sub$i$i >>> $add85$i$i;
       $and87$i$i = $shr86$i$i & 1;
       $add88$i$i = $and87$i$i | $shl84$i$i;
       $I57$0$i$i = $add88$i$i;
      }
     }
     $arrayidx91$i$i = (651264 + ($I57$0$i$i<<2)|0);
     $index$i$i = ((($116)) + 28|0);
     HEAP32[$index$i$i>>2] = $I57$0$i$i;
     $arrayidx92$i$i = ((($116)) + 20|0);
     HEAP32[$arrayidx92$i$i>>2] = 0;
     HEAP32[$add$ptr81$i$i>>2] = 0;
     $196 = HEAP32[(650964)>>2]|0;
     $shl95$i$i = 1 << $I57$0$i$i;
     $and96$i$i = $196 & $shl95$i$i;
     $tobool97$i$i = ($and96$i$i|0)==(0);
     if ($tobool97$i$i) {
      $or101$i$i = $196 | $shl95$i$i;
      HEAP32[(650964)>>2] = $or101$i$i;
      HEAP32[$arrayidx91$i$i>>2] = $116;
      $parent$i$i = ((($116)) + 24|0);
      HEAP32[$parent$i$i>>2] = $arrayidx91$i$i;
      $bk102$i$i = ((($116)) + 12|0);
      HEAP32[$bk102$i$i>>2] = $116;
      $fd103$i$i = ((($116)) + 8|0);
      HEAP32[$fd103$i$i>>2] = $116;
      break;
     }
     $197 = HEAP32[$arrayidx91$i$i>>2]|0;
     $cmp106$i$i = ($I57$0$i$i|0)==(31);
     $shr110$i$i = $I57$0$i$i >>> 1;
     $sub113$i$i = (25 - ($shr110$i$i))|0;
     $cond115$i$i = $cmp106$i$i ? 0 : $sub113$i$i;
     $shl116$i$i = $sub$ptr$sub$i$i << $cond115$i$i;
     $K105$0$i$i = $shl116$i$i;$T$0$i$i = $197;
     while(1) {
      $head118$i$i = ((($T$0$i$i)) + 4|0);
      $198 = HEAP32[$head118$i$i>>2]|0;
      $and119$i$i = $198 & -8;
      $cmp120$i$i = ($and119$i$i|0)==($sub$ptr$sub$i$i|0);
      if ($cmp120$i$i) {
       label = 292;
       break;
      }
      $shr124$i$i = $K105$0$i$i >>> 31;
      $arrayidx126$i$i = (((($T$0$i$i)) + 16|0) + ($shr124$i$i<<2)|0);
      $shl127$i$i = $K105$0$i$i << 1;
      $199 = HEAP32[$arrayidx126$i$i>>2]|0;
      $cmp128$i$i = ($199|0)==(0|0);
      if ($cmp128$i$i) {
       label = 289;
       break;
      } else {
       $K105$0$i$i = $shl127$i$i;$T$0$i$i = $199;
      }
     }
     if ((label|0) == 289) {
      $200 = HEAP32[(650976)>>2]|0;
      $cmp133$i$i = ($arrayidx126$i$i>>>0)<($200>>>0);
      if ($cmp133$i$i) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$arrayidx126$i$i>>2] = $116;
       $parent138$i$i = ((($116)) + 24|0);
       HEAP32[$parent138$i$i>>2] = $T$0$i$i;
       $bk139$i$i = ((($116)) + 12|0);
       HEAP32[$bk139$i$i>>2] = $116;
       $fd140$i$i = ((($116)) + 8|0);
       HEAP32[$fd140$i$i>>2] = $116;
       break;
      }
     }
     else if ((label|0) == 292) {
      $fd148$i$i = ((($T$0$i$i)) + 8|0);
      $201 = HEAP32[$fd148$i$i>>2]|0;
      $202 = HEAP32[(650976)>>2]|0;
      $cmp153$i$i = ($201>>>0)>=($202>>>0);
      $not$cmp150$i$i = ($T$0$i$i>>>0)>=($202>>>0);
      $203 = $cmp153$i$i & $not$cmp150$i$i;
      if ($203) {
       $bk158$i$i = ((($201)) + 12|0);
       HEAP32[$bk158$i$i>>2] = $116;
       HEAP32[$fd148$i$i>>2] = $116;
       $fd160$i$i = ((($116)) + 8|0);
       HEAP32[$fd160$i$i>>2] = $201;
       $bk161$i$i = ((($116)) + 12|0);
       HEAP32[$bk161$i$i>>2] = $T$0$i$i;
       $parent162$i$i = ((($116)) + 24|0);
       HEAP32[$parent162$i$i>>2] = 0;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    }
   }
  } while(0);
  $204 = HEAP32[(650972)>>2]|0;
  $cmp257$i = ($204>>>0)>($nb$0>>>0);
  if ($cmp257$i) {
   $sub260$i = (($204) - ($nb$0))|0;
   HEAP32[(650972)>>2] = $sub260$i;
   $205 = HEAP32[(650984)>>2]|0;
   $add$ptr262$i = (($205) + ($nb$0)|0);
   HEAP32[(650984)>>2] = $add$ptr262$i;
   $or264$i = $sub260$i | 1;
   $head265$i = ((($add$ptr262$i)) + 4|0);
   HEAP32[$head265$i>>2] = $or264$i;
   $or267$i = $nb$0 | 3;
   $head268$i = ((($205)) + 4|0);
   HEAP32[$head268$i>>2] = $or267$i;
   $add$ptr269$i = ((($205)) + 8|0);
   $retval$0 = $add$ptr269$i;
   STACKTOP = sp;return ($retval$0|0);
  }
 }
 $call275$i = (___errno_location()|0);
 HEAP32[$call275$i>>2] = 12;
 $retval$0 = 0;
 STACKTOP = sp;return ($retval$0|0);
}
function _free($mem) {
 $mem = $mem|0;
 var $$pre = 0, $$pre$phiZ2D = 0, $$pre308 = 0, $$pre309 = 0, $$sink = 0, $$sink4 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0;
 var $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0;
 var $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $8 = 0;
 var $9 = 0, $F510$0 = 0, $I534$0 = 0, $K583$0 = 0, $R$1 = 0, $R$3 = 0, $R332$1 = 0, $R332$3 = 0, $RP$1 = 0, $RP360$1 = 0, $T$0 = 0, $add$ptr = 0, $add$ptr16 = 0, $add$ptr217 = 0, $add$ptr261 = 0, $add$ptr482 = 0, $add$ptr498 = 0, $add$ptr6 = 0, $add17 = 0, $add246 = 0;
 var $add258 = 0, $add267 = 0, $add550 = 0, $add555 = 0, $add559 = 0, $add561 = 0, $add564 = 0, $and = 0, $and140 = 0, $and210 = 0, $and215 = 0, $and232 = 0, $and240 = 0, $and266 = 0, $and301 = 0, $and410 = 0, $and46 = 0, $and495 = 0, $and5 = 0, $and512 = 0;
 var $and545 = 0, $and549 = 0, $and554 = 0, $and563 = 0, $and574 = 0, $and592 = 0, $and8 = 0, $arrayidx = 0, $arrayidx108 = 0, $arrayidx113 = 0, $arrayidx130 = 0, $arrayidx149 = 0, $arrayidx157 = 0, $arrayidx182 = 0, $arrayidx188 = 0, $arrayidx198 = 0, $arrayidx279 = 0, $arrayidx362 = 0, $arrayidx374 = 0, $arrayidx379 = 0;
 var $arrayidx400 = 0, $arrayidx419 = 0, $arrayidx427 = 0, $arrayidx454 = 0, $arrayidx460 = 0, $arrayidx470 = 0, $arrayidx509 = 0, $arrayidx567 = 0, $arrayidx570 = 0, $arrayidx599 = 0, $arrayidx99 = 0, $bk = 0, $bk275 = 0, $bk286 = 0, $bk321 = 0, $bk333 = 0, $bk34 = 0, $bk343 = 0, $bk529 = 0, $bk531 = 0;
 var $bk580 = 0, $bk611 = 0, $bk631 = 0, $bk634 = 0, $bk66 = 0, $bk73 = 0, $bk82 = 0, $child = 0, $child171 = 0, $child361 = 0, $child443 = 0, $child569 = 0, $cmp = 0, $cmp$i = 0, $cmp1 = 0, $cmp100 = 0, $cmp104 = 0, $cmp109 = 0, $cmp114 = 0, $cmp118 = 0;
 var $cmp127 = 0, $cmp13 = 0, $cmp131 = 0, $cmp143 = 0, $cmp162 = 0, $cmp165 = 0, $cmp173 = 0, $cmp176 = 0, $cmp18 = 0, $cmp189 = 0, $cmp192 = 0, $cmp2 = 0, $cmp211 = 0, $cmp22 = 0, $cmp228 = 0, $cmp243 = 0, $cmp249 = 0, $cmp25 = 0, $cmp255 = 0, $cmp269 = 0;
 var $cmp280 = 0, $cmp283 = 0, $cmp287 = 0, $cmp29 = 0, $cmp296 = 0, $cmp305 = 0, $cmp308 = 0, $cmp31 = 0, $cmp312 = 0, $cmp334 = 0, $cmp340 = 0, $cmp344 = 0, $cmp348 = 0, $cmp35 = 0, $cmp363 = 0, $cmp368 = 0, $cmp375 = 0, $cmp380 = 0, $cmp386 = 0, $cmp395 = 0;
 var $cmp401 = 0, $cmp413 = 0, $cmp42 = 0, $cmp432 = 0, $cmp435 = 0, $cmp445 = 0, $cmp448 = 0, $cmp461 = 0, $cmp464 = 0, $cmp484 = 0, $cmp50 = 0, $cmp502 = 0, $cmp519 = 0, $cmp53 = 0, $cmp536 = 0, $cmp540 = 0, $cmp57 = 0, $cmp584 = 0, $cmp593 = 0, $cmp601 = 0;
 var $cmp605 = 0, $cmp624 = 0, $cmp640 = 0, $cmp74 = 0, $cmp80 = 0, $cmp83 = 0, $cmp87 = 0, $cond = 0, $cond292 = 0, $cond293 = 0, $dec = 0, $fd = 0, $fd273 = 0, $fd311 = 0, $fd322$pre$phiZ2D = 0, $fd338 = 0, $fd347 = 0, $fd530 = 0, $fd56 = 0, $fd581 = 0;
 var $fd612 = 0, $fd620 = 0, $fd633 = 0, $fd67$pre$phiZ2D = 0, $fd78 = 0, $fd86 = 0, $head = 0, $head209 = 0, $head216 = 0, $head231 = 0, $head248 = 0, $head260 = 0, $head481 = 0, $head497 = 0, $head591 = 0, $idx$neg = 0, $index = 0, $index399 = 0, $index568 = 0, $neg = 0;
 var $neg139 = 0, $neg300 = 0, $neg409 = 0, $next4$i = 0, $not$cmp150 = 0, $not$cmp420 = 0, $not$cmp621 = 0, $or = 0, $or247 = 0, $or259 = 0, $or480 = 0, $or496 = 0, $or516 = 0, $or578 = 0, $p$1 = 0, $parent = 0, $parent170 = 0, $parent183 = 0, $parent199 = 0, $parent331 = 0;
 var $parent442 = 0, $parent455 = 0, $parent471 = 0, $parent579 = 0, $parent610 = 0, $parent635 = 0, $psize$1 = 0, $psize$2 = 0, $shl = 0, $shl138 = 0, $shl278 = 0, $shl299 = 0, $shl408 = 0, $shl45 = 0, $shl508 = 0, $shl511 = 0, $shl546 = 0, $shl551 = 0, $shl557 = 0, $shl560 = 0;
 var $shl573 = 0, $shl590 = 0, $shl600 = 0, $shr = 0, $shr268 = 0, $shr501 = 0, $shr535 = 0, $shr544 = 0, $shr548 = 0, $shr553 = 0, $shr558 = 0, $shr562 = 0, $shr586 = 0, $shr597 = 0, $sp$0$i = 0, $sp$0$in$i = 0, $sub = 0, $sub547 = 0, $sub552 = 0, $sub556 = 0;
 var $sub589 = 0, $tobool233 = 0, $tobool241 = 0, $tobool513 = 0, $tobool575 = 0, $tobool9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $cmp = ($mem|0)==(0|0);
 if ($cmp) {
  return;
 }
 $add$ptr = ((($mem)) + -8|0);
 $0 = HEAP32[(650976)>>2]|0;
 $cmp1 = ($add$ptr>>>0)<($0>>>0);
 if ($cmp1) {
  _abort();
  // unreachable;
 }
 $head = ((($mem)) + -4|0);
 $1 = HEAP32[$head>>2]|0;
 $and = $1 & 3;
 $cmp2 = ($and|0)==(1);
 if ($cmp2) {
  _abort();
  // unreachable;
 }
 $and5 = $1 & -8;
 $add$ptr6 = (($add$ptr) + ($and5)|0);
 $and8 = $1 & 1;
 $tobool9 = ($and8|0)==(0);
 L10: do {
  if ($tobool9) {
   $2 = HEAP32[$add$ptr>>2]|0;
   $cmp13 = ($and|0)==(0);
   if ($cmp13) {
    return;
   }
   $idx$neg = (0 - ($2))|0;
   $add$ptr16 = (($add$ptr) + ($idx$neg)|0);
   $add17 = (($2) + ($and5))|0;
   $cmp18 = ($add$ptr16>>>0)<($0>>>0);
   if ($cmp18) {
    _abort();
    // unreachable;
   }
   $3 = HEAP32[(650980)>>2]|0;
   $cmp22 = ($add$ptr16|0)==($3|0);
   if ($cmp22) {
    $head209 = ((($add$ptr6)) + 4|0);
    $27 = HEAP32[$head209>>2]|0;
    $and210 = $27 & 3;
    $cmp211 = ($and210|0)==(3);
    if (!($cmp211)) {
     $28 = $add$ptr16;$p$1 = $add$ptr16;$psize$1 = $add17;
     break;
    }
    $add$ptr217 = (($add$ptr16) + ($add17)|0);
    $head216 = ((($add$ptr16)) + 4|0);
    $or = $add17 | 1;
    $and215 = $27 & -2;
    HEAP32[(650968)>>2] = $add17;
    HEAP32[$head209>>2] = $and215;
    HEAP32[$head216>>2] = $or;
    HEAP32[$add$ptr217>>2] = $add17;
    return;
   }
   $shr = $2 >>> 3;
   $cmp25 = ($2>>>0)<(256);
   if ($cmp25) {
    $fd = ((($add$ptr16)) + 8|0);
    $4 = HEAP32[$fd>>2]|0;
    $bk = ((($add$ptr16)) + 12|0);
    $5 = HEAP32[$bk>>2]|0;
    $shl = $shr << 1;
    $arrayidx = (651000 + ($shl<<2)|0);
    $cmp29 = ($4|0)==($arrayidx|0);
    if (!($cmp29)) {
     $cmp31 = ($4>>>0)<($0>>>0);
     if ($cmp31) {
      _abort();
      // unreachable;
     }
     $bk34 = ((($4)) + 12|0);
     $6 = HEAP32[$bk34>>2]|0;
     $cmp35 = ($6|0)==($add$ptr16|0);
     if (!($cmp35)) {
      _abort();
      // unreachable;
     }
    }
    $cmp42 = ($5|0)==($4|0);
    if ($cmp42) {
     $shl45 = 1 << $shr;
     $neg = $shl45 ^ -1;
     $7 = HEAP32[162740]|0;
     $and46 = $7 & $neg;
     HEAP32[162740] = $and46;
     $28 = $add$ptr16;$p$1 = $add$ptr16;$psize$1 = $add17;
     break;
    }
    $cmp50 = ($5|0)==($arrayidx|0);
    if ($cmp50) {
     $$pre309 = ((($5)) + 8|0);
     $fd67$pre$phiZ2D = $$pre309;
    } else {
     $cmp53 = ($5>>>0)<($0>>>0);
     if ($cmp53) {
      _abort();
      // unreachable;
     }
     $fd56 = ((($5)) + 8|0);
     $8 = HEAP32[$fd56>>2]|0;
     $cmp57 = ($8|0)==($add$ptr16|0);
     if ($cmp57) {
      $fd67$pre$phiZ2D = $fd56;
     } else {
      _abort();
      // unreachable;
     }
    }
    $bk66 = ((($4)) + 12|0);
    HEAP32[$bk66>>2] = $5;
    HEAP32[$fd67$pre$phiZ2D>>2] = $4;
    $28 = $add$ptr16;$p$1 = $add$ptr16;$psize$1 = $add17;
    break;
   }
   $parent = ((($add$ptr16)) + 24|0);
   $9 = HEAP32[$parent>>2]|0;
   $bk73 = ((($add$ptr16)) + 12|0);
   $10 = HEAP32[$bk73>>2]|0;
   $cmp74 = ($10|0)==($add$ptr16|0);
   do {
    if ($cmp74) {
     $child = ((($add$ptr16)) + 16|0);
     $arrayidx99 = ((($child)) + 4|0);
     $14 = HEAP32[$arrayidx99>>2]|0;
     $cmp100 = ($14|0)==(0|0);
     if ($cmp100) {
      $15 = HEAP32[$child>>2]|0;
      $cmp104 = ($15|0)==(0|0);
      if ($cmp104) {
       $R$3 = 0;
       break;
      } else {
       $R$1 = $15;$RP$1 = $child;
      }
     } else {
      $R$1 = $14;$RP$1 = $arrayidx99;
     }
     while(1) {
      $arrayidx108 = ((($R$1)) + 20|0);
      $16 = HEAP32[$arrayidx108>>2]|0;
      $cmp109 = ($16|0)==(0|0);
      if (!($cmp109)) {
       $R$1 = $16;$RP$1 = $arrayidx108;
       continue;
      }
      $arrayidx113 = ((($R$1)) + 16|0);
      $17 = HEAP32[$arrayidx113>>2]|0;
      $cmp114 = ($17|0)==(0|0);
      if ($cmp114) {
       break;
      } else {
       $R$1 = $17;$RP$1 = $arrayidx113;
      }
     }
     $cmp118 = ($RP$1>>>0)<($0>>>0);
     if ($cmp118) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$RP$1>>2] = 0;
      $R$3 = $R$1;
      break;
     }
    } else {
     $fd78 = ((($add$ptr16)) + 8|0);
     $11 = HEAP32[$fd78>>2]|0;
     $cmp80 = ($11>>>0)<($0>>>0);
     if ($cmp80) {
      _abort();
      // unreachable;
     }
     $bk82 = ((($11)) + 12|0);
     $12 = HEAP32[$bk82>>2]|0;
     $cmp83 = ($12|0)==($add$ptr16|0);
     if (!($cmp83)) {
      _abort();
      // unreachable;
     }
     $fd86 = ((($10)) + 8|0);
     $13 = HEAP32[$fd86>>2]|0;
     $cmp87 = ($13|0)==($add$ptr16|0);
     if ($cmp87) {
      HEAP32[$bk82>>2] = $10;
      HEAP32[$fd86>>2] = $11;
      $R$3 = $10;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $cmp127 = ($9|0)==(0|0);
   if ($cmp127) {
    $28 = $add$ptr16;$p$1 = $add$ptr16;$psize$1 = $add17;
   } else {
    $index = ((($add$ptr16)) + 28|0);
    $18 = HEAP32[$index>>2]|0;
    $arrayidx130 = (651264 + ($18<<2)|0);
    $19 = HEAP32[$arrayidx130>>2]|0;
    $cmp131 = ($add$ptr16|0)==($19|0);
    do {
     if ($cmp131) {
      HEAP32[$arrayidx130>>2] = $R$3;
      $cond292 = ($R$3|0)==(0|0);
      if ($cond292) {
       $shl138 = 1 << $18;
       $neg139 = $shl138 ^ -1;
       $20 = HEAP32[(650964)>>2]|0;
       $and140 = $20 & $neg139;
       HEAP32[(650964)>>2] = $and140;
       $28 = $add$ptr16;$p$1 = $add$ptr16;$psize$1 = $add17;
       break L10;
      }
     } else {
      $21 = HEAP32[(650976)>>2]|0;
      $cmp143 = ($9>>>0)<($21>>>0);
      if ($cmp143) {
       _abort();
       // unreachable;
      } else {
       $arrayidx149 = ((($9)) + 16|0);
       $22 = HEAP32[$arrayidx149>>2]|0;
       $not$cmp150 = ($22|0)!=($add$ptr16|0);
       $$sink = $not$cmp150&1;
       $arrayidx157 = (((($9)) + 16|0) + ($$sink<<2)|0);
       HEAP32[$arrayidx157>>2] = $R$3;
       $cmp162 = ($R$3|0)==(0|0);
       if ($cmp162) {
        $28 = $add$ptr16;$p$1 = $add$ptr16;$psize$1 = $add17;
        break L10;
       } else {
        break;
       }
      }
     }
    } while(0);
    $23 = HEAP32[(650976)>>2]|0;
    $cmp165 = ($R$3>>>0)<($23>>>0);
    if ($cmp165) {
     _abort();
     // unreachable;
    }
    $parent170 = ((($R$3)) + 24|0);
    HEAP32[$parent170>>2] = $9;
    $child171 = ((($add$ptr16)) + 16|0);
    $24 = HEAP32[$child171>>2]|0;
    $cmp173 = ($24|0)==(0|0);
    do {
     if (!($cmp173)) {
      $cmp176 = ($24>>>0)<($23>>>0);
      if ($cmp176) {
       _abort();
       // unreachable;
      } else {
       $arrayidx182 = ((($R$3)) + 16|0);
       HEAP32[$arrayidx182>>2] = $24;
       $parent183 = ((($24)) + 24|0);
       HEAP32[$parent183>>2] = $R$3;
       break;
      }
     }
    } while(0);
    $arrayidx188 = ((($child171)) + 4|0);
    $25 = HEAP32[$arrayidx188>>2]|0;
    $cmp189 = ($25|0)==(0|0);
    if ($cmp189) {
     $28 = $add$ptr16;$p$1 = $add$ptr16;$psize$1 = $add17;
    } else {
     $26 = HEAP32[(650976)>>2]|0;
     $cmp192 = ($25>>>0)<($26>>>0);
     if ($cmp192) {
      _abort();
      // unreachable;
     } else {
      $arrayidx198 = ((($R$3)) + 20|0);
      HEAP32[$arrayidx198>>2] = $25;
      $parent199 = ((($25)) + 24|0);
      HEAP32[$parent199>>2] = $R$3;
      $28 = $add$ptr16;$p$1 = $add$ptr16;$psize$1 = $add17;
      break;
     }
    }
   }
  } else {
   $28 = $add$ptr;$p$1 = $add$ptr;$psize$1 = $and5;
  }
 } while(0);
 $cmp228 = ($28>>>0)<($add$ptr6>>>0);
 if (!($cmp228)) {
  _abort();
  // unreachable;
 }
 $head231 = ((($add$ptr6)) + 4|0);
 $29 = HEAP32[$head231>>2]|0;
 $and232 = $29 & 1;
 $tobool233 = ($and232|0)==(0);
 if ($tobool233) {
  _abort();
  // unreachable;
 }
 $and240 = $29 & 2;
 $tobool241 = ($and240|0)==(0);
 if ($tobool241) {
  $30 = HEAP32[(650984)>>2]|0;
  $cmp243 = ($add$ptr6|0)==($30|0);
  $31 = HEAP32[(650980)>>2]|0;
  if ($cmp243) {
   $32 = HEAP32[(650972)>>2]|0;
   $add246 = (($32) + ($psize$1))|0;
   HEAP32[(650972)>>2] = $add246;
   HEAP32[(650984)>>2] = $p$1;
   $or247 = $add246 | 1;
   $head248 = ((($p$1)) + 4|0);
   HEAP32[$head248>>2] = $or247;
   $cmp249 = ($p$1|0)==($31|0);
   if (!($cmp249)) {
    return;
   }
   HEAP32[(650980)>>2] = 0;
   HEAP32[(650968)>>2] = 0;
   return;
  }
  $cmp255 = ($add$ptr6|0)==($31|0);
  if ($cmp255) {
   $33 = HEAP32[(650968)>>2]|0;
   $add258 = (($33) + ($psize$1))|0;
   HEAP32[(650968)>>2] = $add258;
   HEAP32[(650980)>>2] = $28;
   $or259 = $add258 | 1;
   $head260 = ((($p$1)) + 4|0);
   HEAP32[$head260>>2] = $or259;
   $add$ptr261 = (($28) + ($add258)|0);
   HEAP32[$add$ptr261>>2] = $add258;
   return;
  }
  $and266 = $29 & -8;
  $add267 = (($and266) + ($psize$1))|0;
  $shr268 = $29 >>> 3;
  $cmp269 = ($29>>>0)<(256);
  L108: do {
   if ($cmp269) {
    $fd273 = ((($add$ptr6)) + 8|0);
    $34 = HEAP32[$fd273>>2]|0;
    $bk275 = ((($add$ptr6)) + 12|0);
    $35 = HEAP32[$bk275>>2]|0;
    $shl278 = $shr268 << 1;
    $arrayidx279 = (651000 + ($shl278<<2)|0);
    $cmp280 = ($34|0)==($arrayidx279|0);
    if (!($cmp280)) {
     $36 = HEAP32[(650976)>>2]|0;
     $cmp283 = ($34>>>0)<($36>>>0);
     if ($cmp283) {
      _abort();
      // unreachable;
     }
     $bk286 = ((($34)) + 12|0);
     $37 = HEAP32[$bk286>>2]|0;
     $cmp287 = ($37|0)==($add$ptr6|0);
     if (!($cmp287)) {
      _abort();
      // unreachable;
     }
    }
    $cmp296 = ($35|0)==($34|0);
    if ($cmp296) {
     $shl299 = 1 << $shr268;
     $neg300 = $shl299 ^ -1;
     $38 = HEAP32[162740]|0;
     $and301 = $38 & $neg300;
     HEAP32[162740] = $and301;
     break;
    }
    $cmp305 = ($35|0)==($arrayidx279|0);
    if ($cmp305) {
     $$pre308 = ((($35)) + 8|0);
     $fd322$pre$phiZ2D = $$pre308;
    } else {
     $39 = HEAP32[(650976)>>2]|0;
     $cmp308 = ($35>>>0)<($39>>>0);
     if ($cmp308) {
      _abort();
      // unreachable;
     }
     $fd311 = ((($35)) + 8|0);
     $40 = HEAP32[$fd311>>2]|0;
     $cmp312 = ($40|0)==($add$ptr6|0);
     if ($cmp312) {
      $fd322$pre$phiZ2D = $fd311;
     } else {
      _abort();
      // unreachable;
     }
    }
    $bk321 = ((($34)) + 12|0);
    HEAP32[$bk321>>2] = $35;
    HEAP32[$fd322$pre$phiZ2D>>2] = $34;
   } else {
    $parent331 = ((($add$ptr6)) + 24|0);
    $41 = HEAP32[$parent331>>2]|0;
    $bk333 = ((($add$ptr6)) + 12|0);
    $42 = HEAP32[$bk333>>2]|0;
    $cmp334 = ($42|0)==($add$ptr6|0);
    do {
     if ($cmp334) {
      $child361 = ((($add$ptr6)) + 16|0);
      $arrayidx362 = ((($child361)) + 4|0);
      $47 = HEAP32[$arrayidx362>>2]|0;
      $cmp363 = ($47|0)==(0|0);
      if ($cmp363) {
       $48 = HEAP32[$child361>>2]|0;
       $cmp368 = ($48|0)==(0|0);
       if ($cmp368) {
        $R332$3 = 0;
        break;
       } else {
        $R332$1 = $48;$RP360$1 = $child361;
       }
      } else {
       $R332$1 = $47;$RP360$1 = $arrayidx362;
      }
      while(1) {
       $arrayidx374 = ((($R332$1)) + 20|0);
       $49 = HEAP32[$arrayidx374>>2]|0;
       $cmp375 = ($49|0)==(0|0);
       if (!($cmp375)) {
        $R332$1 = $49;$RP360$1 = $arrayidx374;
        continue;
       }
       $arrayidx379 = ((($R332$1)) + 16|0);
       $50 = HEAP32[$arrayidx379>>2]|0;
       $cmp380 = ($50|0)==(0|0);
       if ($cmp380) {
        break;
       } else {
        $R332$1 = $50;$RP360$1 = $arrayidx379;
       }
      }
      $51 = HEAP32[(650976)>>2]|0;
      $cmp386 = ($RP360$1>>>0)<($51>>>0);
      if ($cmp386) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$RP360$1>>2] = 0;
       $R332$3 = $R332$1;
       break;
      }
     } else {
      $fd338 = ((($add$ptr6)) + 8|0);
      $43 = HEAP32[$fd338>>2]|0;
      $44 = HEAP32[(650976)>>2]|0;
      $cmp340 = ($43>>>0)<($44>>>0);
      if ($cmp340) {
       _abort();
       // unreachable;
      }
      $bk343 = ((($43)) + 12|0);
      $45 = HEAP32[$bk343>>2]|0;
      $cmp344 = ($45|0)==($add$ptr6|0);
      if (!($cmp344)) {
       _abort();
       // unreachable;
      }
      $fd347 = ((($42)) + 8|0);
      $46 = HEAP32[$fd347>>2]|0;
      $cmp348 = ($46|0)==($add$ptr6|0);
      if ($cmp348) {
       HEAP32[$bk343>>2] = $42;
       HEAP32[$fd347>>2] = $43;
       $R332$3 = $42;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $cmp395 = ($41|0)==(0|0);
    if (!($cmp395)) {
     $index399 = ((($add$ptr6)) + 28|0);
     $52 = HEAP32[$index399>>2]|0;
     $arrayidx400 = (651264 + ($52<<2)|0);
     $53 = HEAP32[$arrayidx400>>2]|0;
     $cmp401 = ($add$ptr6|0)==($53|0);
     do {
      if ($cmp401) {
       HEAP32[$arrayidx400>>2] = $R332$3;
       $cond293 = ($R332$3|0)==(0|0);
       if ($cond293) {
        $shl408 = 1 << $52;
        $neg409 = $shl408 ^ -1;
        $54 = HEAP32[(650964)>>2]|0;
        $and410 = $54 & $neg409;
        HEAP32[(650964)>>2] = $and410;
        break L108;
       }
      } else {
       $55 = HEAP32[(650976)>>2]|0;
       $cmp413 = ($41>>>0)<($55>>>0);
       if ($cmp413) {
        _abort();
        // unreachable;
       } else {
        $arrayidx419 = ((($41)) + 16|0);
        $56 = HEAP32[$arrayidx419>>2]|0;
        $not$cmp420 = ($56|0)!=($add$ptr6|0);
        $$sink4 = $not$cmp420&1;
        $arrayidx427 = (((($41)) + 16|0) + ($$sink4<<2)|0);
        HEAP32[$arrayidx427>>2] = $R332$3;
        $cmp432 = ($R332$3|0)==(0|0);
        if ($cmp432) {
         break L108;
        } else {
         break;
        }
       }
      }
     } while(0);
     $57 = HEAP32[(650976)>>2]|0;
     $cmp435 = ($R332$3>>>0)<($57>>>0);
     if ($cmp435) {
      _abort();
      // unreachable;
     }
     $parent442 = ((($R332$3)) + 24|0);
     HEAP32[$parent442>>2] = $41;
     $child443 = ((($add$ptr6)) + 16|0);
     $58 = HEAP32[$child443>>2]|0;
     $cmp445 = ($58|0)==(0|0);
     do {
      if (!($cmp445)) {
       $cmp448 = ($58>>>0)<($57>>>0);
       if ($cmp448) {
        _abort();
        // unreachable;
       } else {
        $arrayidx454 = ((($R332$3)) + 16|0);
        HEAP32[$arrayidx454>>2] = $58;
        $parent455 = ((($58)) + 24|0);
        HEAP32[$parent455>>2] = $R332$3;
        break;
       }
      }
     } while(0);
     $arrayidx460 = ((($child443)) + 4|0);
     $59 = HEAP32[$arrayidx460>>2]|0;
     $cmp461 = ($59|0)==(0|0);
     if (!($cmp461)) {
      $60 = HEAP32[(650976)>>2]|0;
      $cmp464 = ($59>>>0)<($60>>>0);
      if ($cmp464) {
       _abort();
       // unreachable;
      } else {
       $arrayidx470 = ((($R332$3)) + 20|0);
       HEAP32[$arrayidx470>>2] = $59;
       $parent471 = ((($59)) + 24|0);
       HEAP32[$parent471>>2] = $R332$3;
       break;
      }
     }
    }
   }
  } while(0);
  $or480 = $add267 | 1;
  $head481 = ((($p$1)) + 4|0);
  HEAP32[$head481>>2] = $or480;
  $add$ptr482 = (($28) + ($add267)|0);
  HEAP32[$add$ptr482>>2] = $add267;
  $61 = HEAP32[(650980)>>2]|0;
  $cmp484 = ($p$1|0)==($61|0);
  if ($cmp484) {
   HEAP32[(650968)>>2] = $add267;
   return;
  } else {
   $psize$2 = $add267;
  }
 } else {
  $and495 = $29 & -2;
  HEAP32[$head231>>2] = $and495;
  $or496 = $psize$1 | 1;
  $head497 = ((($p$1)) + 4|0);
  HEAP32[$head497>>2] = $or496;
  $add$ptr498 = (($28) + ($psize$1)|0);
  HEAP32[$add$ptr498>>2] = $psize$1;
  $psize$2 = $psize$1;
 }
 $shr501 = $psize$2 >>> 3;
 $cmp502 = ($psize$2>>>0)<(256);
 if ($cmp502) {
  $shl508 = $shr501 << 1;
  $arrayidx509 = (651000 + ($shl508<<2)|0);
  $62 = HEAP32[162740]|0;
  $shl511 = 1 << $shr501;
  $and512 = $62 & $shl511;
  $tobool513 = ($and512|0)==(0);
  if ($tobool513) {
   $or516 = $62 | $shl511;
   HEAP32[162740] = $or516;
   $$pre = ((($arrayidx509)) + 8|0);
   $$pre$phiZ2D = $$pre;$F510$0 = $arrayidx509;
  } else {
   $63 = ((($arrayidx509)) + 8|0);
   $64 = HEAP32[$63>>2]|0;
   $65 = HEAP32[(650976)>>2]|0;
   $cmp519 = ($64>>>0)<($65>>>0);
   if ($cmp519) {
    _abort();
    // unreachable;
   } else {
    $$pre$phiZ2D = $63;$F510$0 = $64;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $p$1;
  $bk529 = ((($F510$0)) + 12|0);
  HEAP32[$bk529>>2] = $p$1;
  $fd530 = ((($p$1)) + 8|0);
  HEAP32[$fd530>>2] = $F510$0;
  $bk531 = ((($p$1)) + 12|0);
  HEAP32[$bk531>>2] = $arrayidx509;
  return;
 }
 $shr535 = $psize$2 >>> 8;
 $cmp536 = ($shr535|0)==(0);
 if ($cmp536) {
  $I534$0 = 0;
 } else {
  $cmp540 = ($psize$2>>>0)>(16777215);
  if ($cmp540) {
   $I534$0 = 31;
  } else {
   $sub = (($shr535) + 1048320)|0;
   $shr544 = $sub >>> 16;
   $and545 = $shr544 & 8;
   $shl546 = $shr535 << $and545;
   $sub547 = (($shl546) + 520192)|0;
   $shr548 = $sub547 >>> 16;
   $and549 = $shr548 & 4;
   $add550 = $and549 | $and545;
   $shl551 = $shl546 << $and549;
   $sub552 = (($shl551) + 245760)|0;
   $shr553 = $sub552 >>> 16;
   $and554 = $shr553 & 2;
   $add555 = $add550 | $and554;
   $sub556 = (14 - ($add555))|0;
   $shl557 = $shl551 << $and554;
   $shr558 = $shl557 >>> 15;
   $add559 = (($sub556) + ($shr558))|0;
   $shl560 = $add559 << 1;
   $add561 = (($add559) + 7)|0;
   $shr562 = $psize$2 >>> $add561;
   $and563 = $shr562 & 1;
   $add564 = $and563 | $shl560;
   $I534$0 = $add564;
  }
 }
 $arrayidx567 = (651264 + ($I534$0<<2)|0);
 $index568 = ((($p$1)) + 28|0);
 HEAP32[$index568>>2] = $I534$0;
 $child569 = ((($p$1)) + 16|0);
 $arrayidx570 = ((($p$1)) + 20|0);
 HEAP32[$arrayidx570>>2] = 0;
 HEAP32[$child569>>2] = 0;
 $66 = HEAP32[(650964)>>2]|0;
 $shl573 = 1 << $I534$0;
 $and574 = $66 & $shl573;
 $tobool575 = ($and574|0)==(0);
 do {
  if ($tobool575) {
   $or578 = $66 | $shl573;
   HEAP32[(650964)>>2] = $or578;
   HEAP32[$arrayidx567>>2] = $p$1;
   $parent579 = ((($p$1)) + 24|0);
   HEAP32[$parent579>>2] = $arrayidx567;
   $bk580 = ((($p$1)) + 12|0);
   HEAP32[$bk580>>2] = $p$1;
   $fd581 = ((($p$1)) + 8|0);
   HEAP32[$fd581>>2] = $p$1;
  } else {
   $67 = HEAP32[$arrayidx567>>2]|0;
   $cmp584 = ($I534$0|0)==(31);
   $shr586 = $I534$0 >>> 1;
   $sub589 = (25 - ($shr586))|0;
   $cond = $cmp584 ? 0 : $sub589;
   $shl590 = $psize$2 << $cond;
   $K583$0 = $shl590;$T$0 = $67;
   while(1) {
    $head591 = ((($T$0)) + 4|0);
    $68 = HEAP32[$head591>>2]|0;
    $and592 = $68 & -8;
    $cmp593 = ($and592|0)==($psize$2|0);
    if ($cmp593) {
     label = 124;
     break;
    }
    $shr597 = $K583$0 >>> 31;
    $arrayidx599 = (((($T$0)) + 16|0) + ($shr597<<2)|0);
    $shl600 = $K583$0 << 1;
    $69 = HEAP32[$arrayidx599>>2]|0;
    $cmp601 = ($69|0)==(0|0);
    if ($cmp601) {
     label = 121;
     break;
    } else {
     $K583$0 = $shl600;$T$0 = $69;
    }
   }
   if ((label|0) == 121) {
    $70 = HEAP32[(650976)>>2]|0;
    $cmp605 = ($arrayidx599>>>0)<($70>>>0);
    if ($cmp605) {
     _abort();
     // unreachable;
    } else {
     HEAP32[$arrayidx599>>2] = $p$1;
     $parent610 = ((($p$1)) + 24|0);
     HEAP32[$parent610>>2] = $T$0;
     $bk611 = ((($p$1)) + 12|0);
     HEAP32[$bk611>>2] = $p$1;
     $fd612 = ((($p$1)) + 8|0);
     HEAP32[$fd612>>2] = $p$1;
     break;
    }
   }
   else if ((label|0) == 124) {
    $fd620 = ((($T$0)) + 8|0);
    $71 = HEAP32[$fd620>>2]|0;
    $72 = HEAP32[(650976)>>2]|0;
    $cmp624 = ($71>>>0)>=($72>>>0);
    $not$cmp621 = ($T$0>>>0)>=($72>>>0);
    $73 = $cmp624 & $not$cmp621;
    if ($73) {
     $bk631 = ((($71)) + 12|0);
     HEAP32[$bk631>>2] = $p$1;
     HEAP32[$fd620>>2] = $p$1;
     $fd633 = ((($p$1)) + 8|0);
     HEAP32[$fd633>>2] = $71;
     $bk634 = ((($p$1)) + 12|0);
     HEAP32[$bk634>>2] = $T$0;
     $parent635 = ((($p$1)) + 24|0);
     HEAP32[$parent635>>2] = 0;
     break;
    } else {
     _abort();
     // unreachable;
    }
   }
  }
 } while(0);
 $74 = HEAP32[(650992)>>2]|0;
 $dec = (($74) + -1)|0;
 HEAP32[(650992)>>2] = $dec;
 $cmp640 = ($dec|0)==(0);
 if ($cmp640) {
  $sp$0$in$i = (651416);
 } else {
  return;
 }
 while(1) {
  $sp$0$i = HEAP32[$sp$0$in$i>>2]|0;
  $cmp$i = ($sp$0$i|0)==(0|0);
  $next4$i = ((($sp$0$i)) + 8|0);
  if ($cmp$i) {
   break;
  } else {
   $sp$0$in$i = $next4$i;
  }
 }
 HEAP32[(650992)>>2] = -1;
 return;
}
function runPostSets() {
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
    end = (ptr + num)|0;

    value = value & 0xff;
    if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
      while ((ptr&3) != 0) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }

      aligned_end = (end & -4)|0;
      block_aligned_end = (aligned_end - 64)|0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);

      while((ptr|0) <= (block_aligned_end|0)) {
        HEAP32[((ptr)>>2)]=value4;
        HEAP32[(((ptr)+(4))>>2)]=value4;
        HEAP32[(((ptr)+(8))>>2)]=value4;
        HEAP32[(((ptr)+(12))>>2)]=value4;
        HEAP32[(((ptr)+(16))>>2)]=value4;
        HEAP32[(((ptr)+(20))>>2)]=value4;
        HEAP32[(((ptr)+(24))>>2)]=value4;
        HEAP32[(((ptr)+(28))>>2)]=value4;
        HEAP32[(((ptr)+(32))>>2)]=value4;
        HEAP32[(((ptr)+(36))>>2)]=value4;
        HEAP32[(((ptr)+(40))>>2)]=value4;
        HEAP32[(((ptr)+(44))>>2)]=value4;
        HEAP32[(((ptr)+(48))>>2)]=value4;
        HEAP32[(((ptr)+(52))>>2)]=value4;
        HEAP32[(((ptr)+(56))>>2)]=value4;
        HEAP32[(((ptr)+(60))>>2)]=value4;
        ptr = (ptr + 64)|0;
      }

      while ((ptr|0) < (aligned_end|0) ) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    // The remaining bytes.
    while ((ptr|0) < (end|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (end-num)|0;
}
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
}
function _llvm_cttz_i32(x) {
    x = x|0;
    var ret = 0;
    ret = ((HEAP8[(((cttz_i8)+(x & 0xff))>>0)])|0);
    if ((ret|0) < 8) return ret|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 8)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 8)|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 16)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 16)|0;
    return (((HEAP8[(((cttz_i8)+(x >>> 24))>>0)])|0) + 24)|0;
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    $rem = $rem | 0;
    var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $49 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $86 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $117 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $147 = 0, $149 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $152 = 0, $154$0 = 0, $r_sroa_0_0_extract_trunc = 0, $r_sroa_1_4_extract_trunc = 0, $155 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $q_sroa_0_0_insert_insert77$1 = 0, $_0$0 = 0, $_0$1 = 0;
    $n_sroa_0_0_extract_trunc = $a$0;
    $n_sroa_1_4_extract_shift$0 = $a$1;
    $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
    $d_sroa_0_0_extract_trunc = $b$0;
    $d_sroa_1_4_extract_shift$0 = $b$1;
    $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
    if (($n_sroa_1_4_extract_trunc | 0) == 0) {
      $4 = ($rem | 0) != 0;
      if (($d_sroa_1_4_extract_trunc | 0) == 0) {
        if ($4) {
          HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
          HEAP32[$rem + 4 >> 2] = 0;
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$4) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
    }
    $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
    do {
      if (($d_sroa_0_0_extract_trunc | 0) == 0) {
        if ($17) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
            HEAP32[$rem + 4 >> 2] = 0;
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        if (($n_sroa_0_0_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0;
            HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
        if (($37 & $d_sroa_1_4_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0 | $a$0 & -1;
            HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
          }
          $_0$1 = 0;
          $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $49 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
        $51 = $49 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        if ($51 >>> 0 <= 30) {
          $57 = $51 + 1 | 0;
          $58 = 31 - $51 | 0;
          $sr_1_ph = $57;
          $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
          $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
          $q_sroa_0_1_ph = 0;
          $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
          break;
        }
        if (($rem | 0) == 0) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = 0 | $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$17) {
          $117 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
          $119 = $117 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          if ($119 >>> 0 <= 31) {
            $125 = $119 + 1 | 0;
            $126 = 31 - $119 | 0;
            $130 = $119 - 31 >> 31;
            $sr_1_ph = $125;
            $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
            $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
            $q_sroa_0_1_ph = 0;
            $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
            break;
          }
          if (($rem | 0) == 0) {
            $_0$1 = 0;
            $_0$0 = 0;
            return (tempRet0 = $_0$1, $_0$0) | 0;
          }
          HEAP32[$rem >> 2] = 0 | $a$0 & -1;
          HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
        if (($66 & $d_sroa_0_0_extract_trunc | 0) != 0) {
          $86 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 | 0;
          $88 = $86 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          $89 = 64 - $88 | 0;
          $91 = 32 - $88 | 0;
          $92 = $91 >> 31;
          $95 = $88 - 32 | 0;
          $105 = $95 >> 31;
          $sr_1_ph = $88;
          $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
          $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
          $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
          $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
          break;
        }
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
          HEAP32[$rem + 4 >> 2] = 0;
        }
        if (($d_sroa_0_0_extract_trunc | 0) == 1) {
          $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$0 = 0 | $a$0 & -1;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        } else {
          $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
          $_0$1 = 0 | $n_sroa_1_4_extract_trunc >>> ($78 >>> 0);
          $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
      }
    } while (0);
    if (($sr_1_ph | 0) == 0) {
      $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
      $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
      $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
      $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = 0;
    } else {
      $d_sroa_0_0_insert_insert99$0 = 0 | $b$0 & -1;
      $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
      $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
      $137$1 = tempRet0;
      $q_sroa_1_1198 = $q_sroa_1_1_ph;
      $q_sroa_0_1199 = $q_sroa_0_1_ph;
      $r_sroa_1_1200 = $r_sroa_1_1_ph;
      $r_sroa_0_1201 = $r_sroa_0_1_ph;
      $sr_1202 = $sr_1_ph;
      $carry_0203 = 0;
      while (1) {
        $147 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
        $149 = $carry_0203 | $q_sroa_0_1199 << 1;
        $r_sroa_0_0_insert_insert42$0 = 0 | ($r_sroa_0_1201 << 1 | $q_sroa_1_1198 >>> 31);
        $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
        _i64Subtract($137$0 | 0, $137$1 | 0, $r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0) | 0;
        $150$1 = tempRet0;
        $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1;
        $152 = $151$0 & 1;
        $154$0 = _i64Subtract($r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0, $151$0 & $d_sroa_0_0_insert_insert99$0 | 0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1 | 0) | 0;
        $r_sroa_0_0_extract_trunc = $154$0;
        $r_sroa_1_4_extract_trunc = tempRet0;
        $155 = $sr_1202 - 1 | 0;
        if (($155 | 0) == 0) {
          break;
        } else {
          $q_sroa_1_1198 = $147;
          $q_sroa_0_1199 = $149;
          $r_sroa_1_1200 = $r_sroa_1_4_extract_trunc;
          $r_sroa_0_1201 = $r_sroa_0_0_extract_trunc;
          $sr_1202 = $155;
          $carry_0203 = $152;
        }
      }
      $q_sroa_1_1_lcssa = $147;
      $q_sroa_0_1_lcssa = $149;
      $r_sroa_1_1_lcssa = $r_sroa_1_4_extract_trunc;
      $r_sroa_0_1_lcssa = $r_sroa_0_0_extract_trunc;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = $152;
    }
    $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
    $q_sroa_0_0_insert_ext75$1 = 0;
    $q_sroa_0_0_insert_insert77$1 = $q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1;
    if (($rem | 0) != 0) {
      HEAP32[$rem >> 2] = 0 | $r_sroa_0_1_lcssa;
      HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa | 0;
    }
    $_0$1 = (0 | $q_sroa_0_0_insert_ext75$0) >>> 31 | $q_sroa_0_0_insert_insert77$1 << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
    $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
    return (tempRet0 = $_0$1, $_0$0) | 0;
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $1$0 = 0;
    $1$0 = ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
    return $1$0 | 0;
}
function ___muldsi3($a, $b) {
    $a = $a | 0;
    $b = $b | 0;
    var $1 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0, $11 = 0, $12 = 0;
    $1 = $a & 65535;
    $2 = $b & 65535;
    $3 = Math_imul($2, $1) | 0;
    $6 = $a >>> 16;
    $8 = ($3 >>> 16) + (Math_imul($2, $6) | 0) | 0;
    $11 = $b >>> 16;
    $12 = Math_imul($11, $1) | 0;
    return (tempRet0 = (($8 >>> 16) + (Math_imul($11, $6) | 0) | 0) + ((($8 & 65535) + $12 | 0) >>> 16) | 0, 0 | ($8 + $12 << 16 | $3 & 65535)) | 0;
}
function ___muldi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $x_sroa_0_0_extract_trunc = 0, $y_sroa_0_0_extract_trunc = 0, $1$0 = 0, $1$1 = 0, $2 = 0;
    $x_sroa_0_0_extract_trunc = $a$0;
    $y_sroa_0_0_extract_trunc = $b$0;
    $1$0 = ___muldsi3($x_sroa_0_0_extract_trunc, $y_sroa_0_0_extract_trunc) | 0;
    $1$1 = tempRet0;
    $2 = Math_imul($a$1, $y_sroa_0_0_extract_trunc) | 0;
    return (tempRet0 = ((Math_imul($b$1, $x_sroa_0_0_extract_trunc) | 0) + $2 | 0) + $1$1 | $1$1 & 0, 0 | $1$0 & -1) | 0;
}
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    increment = ((increment + 15) & -16)|0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory()|0;
      ___setErrNo(12);
      return -1;
    }

    HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
    totalMemory = getTotalMemory()|0;
    if ((newDynamicTop|0) > (totalMemory|0)) {
      if ((enlargeMemory()|0) == 0) {
        ___setErrNo(12);
        HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
        return -1;
      }
    }
    return oldDynamicTop|0;
}
function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $rem = 0, __stackBase__ = 0;
    __stackBase__ = STACKTOP;
    STACKTOP = STACKTOP + 16 | 0;
    $rem = __stackBase__ | 0;
    ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0;
    STACKTOP = __stackBase__;
    return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    var aligned_dest_end = 0;
    var block_aligned_dest_end = 0;
    var dest_end = 0;
    // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
    if ((num|0) >=
      8192
    ) {
      return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    }

    ret = dest|0;
    dest_end = (dest + num)|0;
    if ((dest&3) == (src&3)) {
      // The initial unaligned < 4-byte front.
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      aligned_dest_end = (dest_end & -4)|0;
      block_aligned_dest_end = (aligned_dest_end - 64)|0;
      while ((dest|0) <= (block_aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
        HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
        HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
        HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
        HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
        HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
        HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
        HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
        HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
        HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
        HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
        HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
        HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
        HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
        HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
        dest = (dest+64)|0;
        src = (src+64)|0;
      }
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    } else {
      // In the unaligned copy case, unroll a bit as well.
      aligned_dest_end = (dest_end - 4)|0;
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
        HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
        HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    }
    // The remaining unaligned < 4 byte tail.
    while ((dest|0) < (dest_end|0)) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
    }
    return ret|0;
}
function _llvm_bswap_i32(x) {
    x = x|0;
    return (((x&0xff)<<24) | (((x>>8)&0xff)<<16) | (((x>>16)&0xff)<<8) | (x>>>24))|0;
}

  
function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&1](a1|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&7](a1|0,a2|0,a3|0)|0;
}

function b0(p0) {
 p0 = p0|0; nullFunc_ii(0);return 0;
}
function b1(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_iiii(1);return 0;
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,b1,___stdout_write,___stdio_seek,_sn_write,___stdio_write,b1,b1];

  return { _llvm_bswap_i32: _llvm_bswap_i32, _main: _main, stackSave: stackSave, getTempRet0: getTempRet0, _llvm_cttz_i32: _llvm_cttz_i32, setThrew: setThrew, _bitshift64Lshr: _bitshift64Lshr, _bitshift64Shl: _bitshift64Shl, _fflush: _fflush, _memset: _memset, _sbrk: _sbrk, _memcpy: _memcpy, stackAlloc: stackAlloc, ___muldi3: ___muldi3, ___uremdi3: ___uremdi3, _i64Subtract: _i64Subtract, ___udivmoddi4: ___udivmoddi4, setTempRet0: setTempRet0, _i64Add: _i64Add, _emscripten_get_global_libc: _emscripten_get_global_libc, ___udivdi3: ___udivdi3, ___errno_location: ___errno_location, ___muldsi3: ___muldsi3, _free: _free, runPostSets: runPostSets, establishStackSpace: establishStackSpace, stackRestore: stackRestore, _malloc: _malloc, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real__llvm_bswap_i32 = asm["_llvm_bswap_i32"]; asm["_llvm_bswap_i32"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__llvm_bswap_i32.apply(null, arguments);
};

var real__main = asm["_main"]; asm["_main"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__main.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_stackSave.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_getTempRet0.apply(null, arguments);
};

var real__llvm_cttz_i32 = asm["_llvm_cttz_i32"]; asm["_llvm_cttz_i32"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__llvm_cttz_i32.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_setThrew.apply(null, arguments);
};

var real__bitshift64Lshr = asm["_bitshift64Lshr"]; asm["_bitshift64Lshr"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__bitshift64Lshr.apply(null, arguments);
};

var real__bitshift64Shl = asm["_bitshift64Shl"]; asm["_bitshift64Shl"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__bitshift64Shl.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__fflush.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__sbrk.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_stackAlloc.apply(null, arguments);
};

var real____muldi3 = asm["___muldi3"]; asm["___muldi3"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____muldi3.apply(null, arguments);
};

var real____uremdi3 = asm["___uremdi3"]; asm["___uremdi3"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____uremdi3.apply(null, arguments);
};

var real__i64Subtract = asm["_i64Subtract"]; asm["_i64Subtract"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Subtract.apply(null, arguments);
};

var real____udivmoddi4 = asm["___udivmoddi4"]; asm["___udivmoddi4"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____udivmoddi4.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_setTempRet0.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"]; asm["_i64Add"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Add.apply(null, arguments);
};

var real__emscripten_get_global_libc = asm["_emscripten_get_global_libc"]; asm["_emscripten_get_global_libc"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__emscripten_get_global_libc.apply(null, arguments);
};

var real____udivdi3 = asm["___udivdi3"]; asm["___udivdi3"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____udivdi3.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____errno_location.apply(null, arguments);
};

var real____muldsi3 = asm["___muldsi3"]; asm["___muldsi3"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____muldsi3.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__free.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_establishStackSpace.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_stackRestore.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__malloc.apply(null, arguments);
};
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"];
var _main = Module["_main"] = asm["_main"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var _llvm_cttz_i32 = Module["_llvm_cttz_i32"] = asm["_llvm_cttz_i32"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];
var ___uremdi3 = Module["___uremdi3"] = asm["___uremdi3"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var ___udivmoddi4 = Module["___udivmoddi4"] = asm["___udivmoddi4"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _emscripten_get_global_libc = Module["_emscripten_get_global_libc"] = asm["_emscripten_get_global_libc"];
var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___muldsi3 = Module["___muldsi3"] = asm["___muldsi3"];
var _free = Module["_free"] = asm["_free"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
;

Runtime.stackAlloc = Module['stackAlloc'];
Runtime.stackSave = Module['stackSave'];
Runtime.stackRestore = Module['stackRestore'];
Runtime.establishStackSpace = Module['establishStackSpace'];

Runtime.setTempRet0 = Module['setTempRet0'];
Runtime.getTempRet0 = Module['getTempRet0'];



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;






/**
 * @constructor
 * @extends {Error}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      var toLog = e;
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack];
      }
      Module.printErr('exception thrown: ' + toLog);
      Module['quit'](1, e);
    }
  } finally {
    calledMain = true;
  }
}




/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
      Module.printErr('pre-main prep time: ' + (Date.now() - preloadStartTime) + ' ms');
    }

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') implicitly called by end of main(), but noExitRuntime, so not exiting the runtime (you can use emscripten_force_exit, if you want to force a true shutdown)');
    return;
  }

  if (Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') called, but noExitRuntime, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)');
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  }
  Module['quit'](status, new ExitStatus(status));
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}



