'use strict';

// SOURCE FILE: libdot/js/lib.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const lib = {};

/**
 * List of functions that need to be invoked during library initialization.
 *
 * Each element in the initCallbacks_ array is itself a two-element array.
 * Element 0 is a short string describing the owner of the init routine, useful
 * for debugging.  Element 1 is the callback function.
 */
lib.initCallbacks_ = [];

/**
 * Register an initialization function.
 *
 * The initialization functions are invoked in registration order when
 * lib.init() is invoked.  Each function will receive a single parameter, which
 * is a function to be invoked when it completes its part of the initialization.
 *
 * @param {string} name A short descriptive name of the init routine useful for
 *     debugging.
 * @param {function()} callback The initialization function to register.
 */
lib.registerInit = function(name, callback) {
  lib.initCallbacks_.push([name, callback]);
};

/**
 * Initialize the library.
 *
 * This will ensure that all registered runtime dependencies are met, and
 * invoke any registered initialization functions.
 *
 * Initialization is asynchronous.  The library is not ready for use until
 * the returned promise resolves.
 *
 * @param {function(*)=} logFunction An optional function to send initialization
 *     related log messages to.
 * @return {!Promise<void>} Promise that resolves once all inits finish.
 */
lib.init = async function(logFunction = undefined) {
  const ary = lib.initCallbacks_;
  while (ary.length) {
    const [name, init] = ary.shift();
    if (logFunction) {
      logFunction(`init: ${name}`);
    }
    const ret = init();
    if (ret && typeof ret.then === 'function') {
      await ret;
    }
  }
};

/**
 * Verify |condition| is truthy else throw Error.
 *
 * This function is primarily for satisfying the JS compiler and should be
 * used only when you are certain that your condition is true.  The function is
 * designed to have a version that throws Errors in tests if condition fails,
 * and a nop version for production code.  It configures itself the first time
 * it runs.
 *
 * @param {boolean} condition A condition to check.
 * @closurePrimitive {asserts.truthy}
 */
lib.assert = function(condition) {
  if (window.chai) {
    lib.assert = window.chai.assert;
  } else {
    lib.assert = function(condition) {};
  }
  lib.assert(condition);
};

/**
 * Verify |value| is not null and return |value| if so, else throw Error.
 * See lib.assert.
 *
 * @template T
 * @param {T} value A value to check for null.
 * @return {T} A non-null |value|.
 * @closurePrimitive {asserts.truthy}
 */
lib.notNull = function(value) {
  lib.assert(value !== null);
  return value;
};

/**
 * Verify |value| is not undefined and return |value| if so, else throw Error.
 * See lib.assert.
 *
 * @template T
 * @param {T} value A value to check for null.
 * @return {T} A non-undefined |value|.
 * @closurePrimitive {asserts.truthy}
 */
lib.notUndefined = function(value) {
  lib.assert(value !== undefined);
  return value;
};
// SOURCE FILE: libdot/js/lib_polyfill.js
// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Polyfills for ES2019+ features we want to use.
 * @suppress {duplicate} This file redefines many functions.
 */

/** @const */
lib.polyfill = {};

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer
 *
 * @return {!Promise<!ArrayBuffer>}
 */
lib.polyfill.BlobArrayBuffer = function() {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onabort = reader.onerror = () => reject(reader);
    reader.readAsArrayBuffer(this);
  });
};

if (typeof Blob.prototype.arrayBuffer != 'function') {
  Blob.prototype.arrayBuffer = lib.polyfill.BlobArrayBuffer;
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/Blob/text
 *
 * @return {!Promise<string>}
 */
lib.polyfill.BlobText = function() {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onabort = reader.onerror = () => reject(reader);
    reader.readAsText(this);
  });
};

if (typeof Blob.prototype.arrayBuffer != 'function') {
  Blob.prototype.text = lib.polyfill.BlobText;
}
// SOURCE FILE: libdot/js/lib_array.js
// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Helper functions for (typed) arrays.
 */

lib.array = {};

/**
 * Compare two array-like objects entrywise.
 *
 * @template ARRAY_LIKE
 * @param {?ARRAY_LIKE} a The first array to compare.
 * @param {?ARRAY_LIKE} b The second array to compare.
 * @return {boolean} true if both arrays are null or they agree entrywise;
 *     false otherwise.
 */
lib.array.compare = function(a, b) {
  if (a === null || b === null) {
    return a === null && b === null;
  }

  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};
// SOURCE FILE: libdot/js/lib_codec.js
// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

lib.codec = {};

/**
 * Join an array of code units to a string.
 *
 * The code units must not be larger than 65535.  The individual code units may
 * be for UTF-8 or UTF-16 -- it doesn't matter since UTF-16 can handle all UTF-8
 * code units.
 *
 * The input array type may be an Array or a typed Array (e.g. Uint8Array).
 *
 * @param {!Uint8Array|!Array<number>} array The code units to generate for
 *     the string.
 * @return {string} A UTF-16 encoded string.
 */
lib.codec.codeUnitArrayToString = function(array) {
  // String concat is faster than Array.join.
  //
  // String.fromCharCode.apply is faster than this if called less frequently
  // and with smaller array sizes (like <32K).  But it's a recursive call so
  // larger arrays will blow the stack and fail.  We also seem to be faster
  // (or at least more constant time) when called frequently.
  let ret = '';
  for (let i = 0; i < array.length; ++i) {
    ret += String.fromCharCode(array[i]);
  }
  return ret;
};

/**
 * Create an array of code units from a UTF-16 encoded string.
 *
 * @param {string} str The string to extract code units from.
 * @param {!ArrayBufferView=} ret The buffer to hold the result.  If not set, a
 *     new Uint8Array is created.
 * @return {!ArrayBufferView} The array of code units.
 */
lib.codec.stringToCodeUnitArray = function(
    str, ret = new Uint8Array(str.length)) {
  // Indexing string directly is faster than Array.map.
  for (let i = 0; i < str.length; ++i) {
    ret[i] = str.charCodeAt(i);
  }
  return ret;
};
// SOURCE FILE: libdot/js/lib_colors.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Namespace for color utilities.
 */
lib.colors = {};

/**
 * First, some canned regular expressions we're going to use in this file.
 *
 *
 *                              BRACE YOURSELF
 *
 *                                 ,~~~~.
 *                                 |>_< ~~
 *                                3`---'-/.
 *                                3:::::\v\
 *                               =o=:::::\,\
 *                                | :::::\,,\
 *
 *                        THE REGULAR EXPRESSIONS
 *                               ARE COMING.
 *
 * There's no way to break long RE literals in JavaScript.  Fix that why don't
 * you?  Oh, and also there's no way to write a string that doesn't interpret
 * escapes.
 *
 * Instead, we stoop to this .replace() trick.
 */
lib.colors.re_ = {
  // CSS hex color, #RGB or RGBA.
  hex16: /^#([a-f0-9])([a-f0-9])([a-f0-9])([a-f0-9])?$/i,

  // CSS hex color, #RRGGBB or #RRGGBBAA.
  hex24: /^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})?$/i,

  // CSS rgb color, rgb(rrr,ggg,bbb).
  rgb: new RegExp(
      ('^/s*rgb/s*/(/s*(/d{1,3})/s*,/s*(/d{1,3})/s*,' +
       '/s*(/d{1,3})/s*/)/s*$'
       ).replace(/\//g, '\\'), 'i'),

  // CSS rgb color, rgba(rrr,ggg,bbb,aaa).
  rgba: new RegExp(
      ('^/s*rgba/s*' +
       '/(/s*(/d{1,3})/s*,/s*(/d{1,3})/s*,/s*(/d{1,3})/s*' +
       '(?:,/s*(/d+(?:/./d+)?)/s*)/)/s*$'
       ).replace(/\//g, '\\'), 'i'),

  // Either RGB or RGBA.
  rgbx: new RegExp(
      ('^/s*rgba?/s*' +
       '/(/s*(/d{1,3})/s*,/s*(/d{1,3})/s*,/s*(/d{1,3})/s*' +
       '(?:,/s*(/d+(?:/./d+)?)/s*)?/)/s*$'
       ).replace(/\//g, '\\'), 'i'),

  // CSS hsl color, hsl(hhh,sss%,lll%).
  hsl: new RegExp(
      ('^/s*hsl/s*' +
       '/(/s*(/d{1,3})/s*,/s*(/d{1,3})/s*%/s*,/s*(/d{1,3})/s*%/s*/)/s*$'
       ).replace(/\//g, '\\'), 'i'),

  // CSS hsl color, hsla(hhh,sss%,lll%,aaa).
  hsla: new RegExp(
      ('^/s*hsla/s*' +
       '/(/s*(/d{1,3})/s*,/s*(/d{1,3})/s*%/s*,/s*(/d{1,3})/s*%/s*' +
       '(?:,/s*(/d+(?:/./d+)?)/s*)/)/s*$'
       ).replace(/\//g, '\\'), 'i'),

  // Either HSL or HSLA.
  hslx: new RegExp(
      ('^/s*hsla?/s*' +
       '/(/s*(/d{1,3})/s*,/s*(/d{1,3})/s*%/s*,/s*(/d{1,3})/s*%/s*' +
       '(?:,/s*(/d+(?:/./d+)?)/s*)?/)/s*$'
       ).replace(/\//g, '\\'), 'i'),

  // An X11 "rgb:dddd/dddd/dddd" value.
  x11rgb: /^\s*rgb:([a-f0-9]{1,4})\/([a-f0-9]{1,4})\/([a-f0-9]{1,4})\s*$/i,

  // English color name.
  name: /[a-z][a-z0-9\s]+/,
};

/**
 * Convert a CSS rgb(ddd,ddd,ddd) color value into an X11 color value.
 *
 * Other CSS color values are ignored to ensure sanitary data handling.
 *
 * Each 'ddd' component is a one byte value specified in decimal.
 *
 * @param {string} value The CSS color value to convert.
 * @return {?string} The X11 color value or null if the value could not be
 *     converted.
 */
lib.colors.rgbToX11 = function(value) {
  function scale(v) {
    v = (Math.min(v, 255) * 257).toString(16);
    return lib.f.zpad(v, 4);
  }

  const ary = value.match(lib.colors.re_.rgbx);
  if (!ary) {
    return null;
  }

  return 'rgb:' + scale(ary[1]) + '/' + scale(ary[2]) + '/' + scale(ary[3]);
};

/**
 * Convert a legacy X11 color value into an CSS rgb(...) color value.
 *
 * They take the form:
 * 12 bit: #RGB          -> #R000G000B000
 * 24 bit: #RRGGBB       -> #RR00GG00BB00
 * 36 bit: #RRRGGGBBB    -> #RRR0GGG0BBB0
 * 48 bit: #RRRRGGGGBBBB
 * These are the most significant bits.
 *
 * Truncate values back down to 24 bit since that's all CSS supports.
 *
 * @param {string} v The X11 hex color value to convert.
 * @return {?string} The CSS color value or null if the value could not be
 *     converted.
 */
lib.colors.x11HexToCSS = function(v) {
  if (!v.startsWith('#')) {
    return null;
  }
  // Strip the leading # off.
  v = v.substr(1);

  // Reject unknown sizes.
  if ([3, 6, 9, 12].indexOf(v.length) == -1) {
    return null;
  }

  // Reject non-hex values.
  if (v.match(/[^a-f0-9]/i)) {
    return null;
  }

  // Split the colors out.
  const size = v.length / 3;
  const r = v.substr(0, size);
  const g = v.substr(size, size);
  const b = v.substr(size + size, size);

  // Normalize to 16 bits.
  function norm16(v) {
    v = parseInt(v, 16);
    return size == 2 ? v :         // 16 bit
           size == 1 ? v << 4 :    // 8 bit
           v >> (4 * (size - 2));  // 24 or 32 bit
  }
  return lib.colors.arrayToRGBA([r, g, b].map(norm16));
};

/**
 * Convert an X11 color value into an CSS rgb(...) color value.
 *
 * The X11 value may be an X11 color name, or an RGB value of the form
 * rgb:hhhh/hhhh/hhhh.  If a component value is less than 4 digits it is
 * padded out to 4, then scaled down to fit in a single byte.
 *
 * @param {string} v The X11 color value to convert.
 * @return {?string} The CSS color value or null if the value could not be
 *     converted.
 */
lib.colors.x11ToCSS = function(v) {
  function scale(v) {
    // Pad out values with less than four digits.  This padding (probably)
    // matches xterm.  It's difficult to say for sure since xterm seems to
    // arrive at a padded value and then perform some combination of
    // gamma correction, color space transformation, and quantization.

    if (v.length == 1) {
      // Single digits pad out to four by repeating the character.  "f" becomes
      // "ffff".  Scaling down a hex value of this pattern by 257 is the same
      // as cutting off one byte.  We skip the middle step and just double
      // the character.
      return parseInt(v + v, 16);
    }

    if (v.length == 2) {
      // Similar deal here.  X11 pads two digit values by repeating the
      // byte (or scale up by 257).  Since we're going to scale it back
      // down anyway, we can just return the original value.
      return parseInt(v, 16);
    }

    if (v.length == 3) {
      // Three digit values seem to be padded by repeating the final digit.
      // e.g. 10f becomes 10ff.
      v = v + v.substr(2);
    }

    // Scale down the 2 byte value.
    return Math.round(parseInt(v, 16) / 257);
  }

  const ary = v.match(lib.colors.re_.x11rgb);
  if (!ary) {
    // Handle the legacy format.
    if (v.startsWith('#')) {
      return lib.colors.x11HexToCSS(v);
    } else {
      return lib.colors.nameToRGB(v);
    }
  }

  ary.splice(0, 1);
  return lib.colors.arrayToRGBA(ary.map(scale));
};

/**
 * Converts one or more CSS '#RRGGBB' or '#RRGGBBAA' color values into their
 * rgb(...) or rgba(...) form respectively.
 *
 * Arrays are converted in place. If a value cannot be converted, it is
 * replaced with null.
 *
 * @param {string} hex A single RGB or RGBA value to convert.
 * @return {?string} The converted value.
 */
lib.colors.hexToRGB = function(hex) {
  const hex16 = lib.colors.re_.hex16;
  const hex24 = lib.colors.re_.hex24;

  if (hex16.test(hex)) {
    // Convert from RGB to RRGGBB and from RGBA to RRGGBBAA.
    hex = `#${hex.match(/[a-f0-9]/gi).map((x) => `${x}${x}`).join('')}`;
  }

  const ary = hex.match(hex24);
  if (!ary) {
    return null;
  }

  const val = (index) => parseInt(ary[index + 1], 16);
  return ary[4] === undefined || val(3) === 255
      ? `rgb(${val(0)}, ${val(1)}, ${val(2)})`
      : `rgba(${val(0)}, ${val(1)}, ${val(2)}, ${val(3) / 255})`;
};

/**
 * Converts one or more CSS rgb(...) or rgba(...) forms into their '#RRGGBB' or
 * '#RRGGBBAA' color values respectively.
 *
 * Arrays are converted in place. If a value cannot be converted, it is
 * replaced with null.
 *
 * @param {string} rgb A single rgb(...) or rgba(...) value to convert.
 * @return {?string} The converted value.
 */
lib.colors.rgbToHex = function(rgb) {
  const ary = lib.colors.crackRGB(rgb);
  if (!ary) {
    return null;
  }

  const hex = '#' + lib.f.zpad((
      (parseInt(ary[0], 10) << 16) |
      (parseInt(ary[1], 10) << 8) |
      (parseInt(ary[2], 10) << 0)).toString(16), 6);
  if (ary[3] === undefined || ary[3] === '1') {
    return hex;
  } else {
    const alpha = Math.round(255 * parseFloat(ary[3])).toString(16);
    return `${hex}${lib.f.zpad(alpha, 2)}`;
  }
};

/**
 * Split an hsl/hsla color into an array of its components.
 *
 * On success, a 4 element array will be returned.  For hsl values, the alpha
 * will be set to 1.
 *
 * @param {string} color The HSL/HSLA CSS color spec.
 * @return {?Array<string>} The HSL/HSLA values split out.
 */
lib.colors.crackHSL = function(color) {
  if (color.startsWith('hsla')) {
    const ary = color.match(lib.colors.re_.hsla);
    if (ary) {
      ary.shift();
      return Array.from(ary);
    }
  } else {
    const ary = color.match(lib.colors.re_.hsl);
    if (ary) {
      ary.shift();
      ary.push('1');
      return Array.from(ary);
    }
  }

  console.error(`Couldn't crack: ${color}`);
  return null;
};

/**
 * Converts hslx array to rgba array.
 *
 * The returned alpha component defaults to 1 if it isn't present in the input.
 *
 * The returned values are not rounded to preserve precision for computations,
 * so should be rounded before they are used in CSS strings.
 *
 * @param {?Array<string|number>} hslx The HSL or HSLA elements to convert.
 * @return {!Array<number>} The RGBA values.
 */
lib.colors.hslxArrayToRgbaArray = function(hslx) {
  const hue = parseInt(hslx[0], 10) / 60;
  const sat = parseInt(hslx[1], 10) / 100;
  const light = parseInt(hslx[2], 10) / 100;

  // The following algorithm has been adapted from:
  //     https://www.w3.org/TR/css-color-4/#hsl-to-rgb
  const hueToRgb = (t1, t2, hue) => {
    if (hue < 0) {
      hue += 6;
    }
    if (hue >= 6) {
      hue -= 6;
    }

    if (hue < 1) {
      return (t2 - t1) * hue + t1;
    } else if (hue < 3) {
      return t2;
    } else if (hue < 4) {
      return (t2 - t1) * (4 - hue) + t1;
    } else {
      return t1;
    }
  };

  const t2 = light <= 0.5 ? light * (sat + 1) : light + sat - (light * sat);
  const t1 = light * 2 - t2;

  return [
    255 * hueToRgb(t1, t2, hue + 2),
    255 * hueToRgb(t1, t2, hue),
    255 * hueToRgb(t1, t2, hue - 2),
    hslx[3] !== undefined ? +hslx[3] : 1,
  ];
};

/**
 * Converts a hsvx array to a hsla array. The hsvx array is an array of [hue
 * (>=0, <=360), saturation (>=0, <=100), value (>=0, <=100), alpha] (alpha can
 * be missing).
 *
 * The returned alpha component defaults to 1 if it isn't present in the input.
 *
 * The returned values are not rounded to preserve precision for computations,
 * so should be rounded before they are used in CSS strings.
 *
 * @param {?Array<string|number>} hsvx The hsv or hsva array.
 * @return {!Array<number>} The hsla array.
 */
lib.colors.hsvxArrayToHslaArray = function(hsvx) {
  const clamp = (x) => lib.f.clamp(x, 0, 100);
  const [hue, saturation, value] = hsvx.map(parseFloat);
  const hslLightness = clamp(value * (100 - saturation / 2) / 100);
  let hslSaturation = 0;
  if (hslLightness !== 0 && hslLightness !== 100) {
    hslSaturation = clamp((value - hslLightness) /
        Math.min(hslLightness, 100 - hslLightness) * 100);
  }
  return [
      hue,
      hslSaturation,
      hslLightness,
      hsvx.length === 4 ? +hsvx[3] : 1,
  ];
};

/**
 * Converts a hslx array to a hsva array. The hsva array is an array of [hue
 * (>=0, <=360), saturation (>=0, <=100), value (>=0, <=100), alpha].
 *
 * The returned alpha component defaults to 1 if it isn't present in the input.
 *
 * @param {?Array<string|number>} hslx The hsl or hsla array.
 * @return {!Array<number>} The hsva array.
 */
lib.colors.hslxArrayToHsvaArray = function(hslx) {
  const clamp = (x) => lib.f.clamp(x, 0, 100);
  const [hue, saturation, lightness] = hslx.map(parseFloat);
  const hsvValue = clamp(
      lightness + saturation * Math.min(lightness, 100 - lightness) / 100);
  let hsvSaturation = 0;
  if (hsvValue !== 0) {
    hsvSaturation = clamp(200 * (1 - lightness / hsvValue));
  }
  return [hue, hsvSaturation, hsvValue, hslx.length === 4 ? +hslx[3] : 1];
};

/**
 * Converts one or more CSS hsl(...) or hsla(...) forms into their rgb(...) or
 * rgba(...) color values respectively.
 *
 * Arrays are converted in place. If a value cannot be converted, it is
 * replaced with null.
 *
 * @param {string} hsl A single hsl(...) or hsla(...) value to convert.
 * @return {?string} The converted value.
 */
lib.colors.hslToRGB = function(hsl) {
  const ary = lib.colors.crackHSL(hsl);
  if (!ary) {
    return null;
  }

  const [r, g, b, a] = lib.colors.hslxArrayToRgbaArray(ary);

  const rgb = [r, g, b].map(Math.round).join(', ');

  return a === 1 ? `rgb(${rgb})` : `rgba(${rgb}, ${a})`;
};

/**
 * Converts rgbx array to hsla array.
 *
 * The returned alpha component defaults to 1 if it isn't present in the input.
 *
 * The returned values are not rounded to preserve precision for computations,
 * so should be rounded before they are used in CSS strings.
 *
 * @param {?Array<string|number>} rgbx The RGB or RGBA elements to convert.
 * @return {!Array<number>} The HSLA values.
 */
lib.colors.rgbxArrayToHslaArray = function(rgbx) {
  const r = parseInt(rgbx[0], 10) / 255;
  const g = parseInt(rgbx[1], 10) / 255;
  const b = parseInt(rgbx[2], 10) / 255;

  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const spread = max - min;

  /* eslint-disable id-denylist */
  const l = (max + min) / 2;

  if (spread == 0) {
    return [0, 0, 100 * l, rgbx[3] !== undefined ? +rgbx[3] : 1];
  }

  let h = (() => {
    switch (max) {
      case r: return ((g - b) / spread) % 6;
      case g: return (b - r) / spread + 2;
      case b: return (r - g) / spread + 4;
    }
  })();
  h *= 60;
  if (h < 0) {
    h += 360;
  }

  const s = spread / (1 - Math.abs(2 * l - 1));

  return [h, 100 * s, 100 * l, rgbx[3] !== undefined ? +rgbx[3] : 1];
  /* eslint-enable id-denylist */
};

/**
 * Converts one or more CSS rgb(...) or rgba(...) forms into their hsl(...) or
 * hsla(...) color values respectively.
 *
 * Arrays are converted in place. If a value cannot be converted, it is
 * replaced with null.
 *
 * @param {string} rgb A single rgb(...) or rgba(...) value to convert.
 * @return {?string} The converted value.
 */
lib.colors.rgbToHsl = function(rgb) {
  const ary = lib.colors.crackRGB(rgb);
  if (!ary) {
    return null;
  }

  /* eslint-disable id-denylist */
  // eslint-disable-next-line prefer-const
  let [h, s, l, a] = lib.colors.rgbxArrayToHslaArray(ary);
  h = Math.round(h);
  s = Math.round(s);
  l = Math.round(l);

  return a === 1 ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${a})`;
  /* eslint-enable id-denylist */
};

/**
 * Take any valid CSS color definition and turn it into an rgb or rgba value.
 *
 * @param {string} def The CSS color spec to normalize.
 * @return {?string} The converted value.
 */
lib.colors.normalizeCSS = function(def) {
  if (def.startsWith('#')) {
    return lib.colors.hexToRGB(def);
  }

  if (lib.colors.re_.rgbx.test(def)) {
    return def;
  }

  if (lib.colors.re_.hslx.test(def)) {
    return lib.colors.hslToRGB(def);
  }

  return lib.colors.nameToRGB(def);
};

/**
 * Take any valid CSS color definition and turn it into an hsl or hsla value.
 *
 * @param {string} def The CSS color spec to normalize.
 * @return {?string} The converted value.
 */
lib.colors.normalizeCSSToHSL = function(def) {
  if (lib.colors.re_.hslx.test(def)) {
    return def;
  }

  const rgb = lib.colors.normalizeCSS(def);
  if (!rgb) {
    return rgb;
  }
  return lib.colors.rgbToHsl(rgb);
};

/**
 * Convert a 3 or 4 element array into an rgb(...) or rgba(...) string.
 *
 * @param {?Array<string|number>} ary The RGB or RGBA elements to convert.
 * @return {string} The normalized CSS color spec.
 */
lib.colors.arrayToRGBA = function(ary) {
  if (ary.length == 3) {
    return `rgb(${ary[0]}, ${ary[1]}, ${ary[2]})`;
  }
  return `rgba(${ary[0]}, ${ary[1]}, ${ary[2]}, ${ary[3]})`;
};

/**
 * Convert a 3 or 4 element array into an hsla(...) string.
 *
 * @param {?Array<string|number>} ary The HSL or HSLA elements to convert.
 * @return {string} The normalized CSS color spec.
 */
lib.colors.arrayToHSLA = function(ary) {
  const alpha = (ary.length > 3) ? ary[3] : 1;
  return `hsla(${Math.round(ary[0])}, ${Math.round(ary[1])}%, ` +
      `${Math.round(ary[2])}%, ${alpha})`;
};

/**
 * Overwrite the alpha channel of an rgb/rgba color.
 *
 * @param {string} rgb The normalized CSS color spec.
 * @param {number} alpha The alpha channel.
 * @return {string} The normalized CSS color spec with updated alpha channel.
 */
lib.colors.setAlpha = function(rgb, alpha) {
  const ary = lib.colors.crackRGB(rgb);
  ary[3] = alpha.toString();
  return lib.colors.arrayToRGBA(ary);
};

/**
 * Mix a percentage of a tint color into a base color.
 *
 * @param  {string} base The normalized CSS base color spec.
 * @param  {string} tint The normalized CSS color to tint with.
 * @param  {number} percent The percentage of the tinting.
 * @return {string} The new tinted CSS color spec.
 */
lib.colors.mix = function(base, tint, percent) {
  const ary1 = lib.colors.crackRGB(base);
  const ary2 = lib.colors.crackRGB(tint);

  for (let i = 0; i < 4; ++i) {
    const basecol = parseInt(ary1[i], 10);
    const tintcol = parseInt(ary2[i], 10);
    const diff = tintcol - basecol;
    ary1[i] = Math.round(base + diff * percent).toString();
  }

  return lib.colors.arrayToRGBA(ary1);
};

/**
 * Split an rgb/rgba color into an array of its components.
 *
 * On success, a 4 element array will be returned.  For rgb values, the alpha
 * will be set to 1.
 *
 * @param {string} color The RGB/RGBA CSS color spec.
 * @return {?Array<string>} The RGB/RGBA values split out.
 */
lib.colors.crackRGB = function(color) {
  if (color.startsWith('rgba')) {
    const ary = color.match(lib.colors.re_.rgba);
    if (ary) {
      ary.shift();
      return Array.from(ary);
    }
  } else {
    const ary = color.match(lib.colors.re_.rgb);
    if (ary) {
      ary.shift();
      ary.push('1');
      return Array.from(ary);
    }
  }

  console.error('Couldn\'t crack: ' + color);
  return null;
};

/**
 * Convert an X11 color name into a CSS rgb(...) value.
 *
 * Names are stripped of spaces and converted to lowercase.  If the name is
 * unknown, null is returned.
 *
 * This list of color name to RGB mapping is derived from the stock X11
 * rgb.txt file.
 *
 * @param {string} name The color name to convert.
 * @return {?string} The corresponding CSS rgb(...) value.
 */
lib.colors.nameToRGB = function(name) {
  if (name in lib.colors.colorNames) {
    return lib.colors.colorNames[name];
  }

  name = name.toLowerCase();
  if (name in lib.colors.colorNames) {
    return lib.colors.colorNames[name];
  }

  name = name.replace(/\s+/g, '');
  if (name in lib.colors.colorNames) {
    return lib.colors.colorNames[name];
  }

  return null;
};

/**
 * Calculate the relative luminance as per
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 *
 * @param {number} r The value (>=0 and <= 255) of the rgb component.
 * @param {number} g The value (>=0 and <= 255) of the rgb component.
 * @param {number} b The value (>=0 and <= 255) of the rgb component.
 * @return {number} The relative luminance.
 */
lib.colors.luminance = function(r, g, b) {
  const [rr, gg, bb] = [r, g, b].map((value) => {
    value /= 255;
    if (value <= 0.03928) {
      return value / 12.92;
    } else {
      return Math.pow((value + 0.055) / 1.055, 2.4);
    }
  });

  return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
};

/**
 * Calculate the contrast ratio of two relative luminance values as per
 * https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 *
 * @param {number} l1 Relative luminance value.
 * @param {number} l2 Relative luminance value.
 * @return {number} The contrast ratio.
 */
lib.colors.contrastRatio = function(l1, l2) {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/**
 * The stock color palette.
 *
 * @type {!Array<string>}
 */
lib.colors.stockPalette = [
     // The "ANSI 16"...
    '#000000', '#CC0000', '#4E9A06', '#C4A000',
    '#3465A4', '#75507B', '#06989A', '#D3D7CF',
    '#555753', '#EF2929', '#00BA13', '#FCE94F',
    '#729FCF', '#F200CB', '#00B5BD', '#EEEEEC',

    // The 6x6 color cubes...
    '#000000', '#00005F', '#000087', '#0000AF', '#0000D7', '#0000FF',
    '#005F00', '#005F5F', '#005F87', '#005FAF', '#005FD7', '#005FFF',
    '#008700', '#00875F', '#008787', '#0087AF', '#0087D7', '#0087FF',
    '#00AF00', '#00AF5F', '#00AF87', '#00AFAF', '#00AFD7', '#00AFFF',
    '#00D700', '#00D75F', '#00D787', '#00D7AF', '#00D7D7', '#00D7FF',
    '#00FF00', '#00FF5F', '#00FF87', '#00FFAF', '#00FFD7', '#00FFFF',

    '#5F0000', '#5F005F', '#5F0087', '#5F00AF', '#5F00D7', '#5F00FF',
    '#5F5F00', '#5F5F5F', '#5F5F87', '#5F5FAF', '#5F5FD7', '#5F5FFF',
    '#5F8700', '#5F875F', '#5F8787', '#5F87AF', '#5F87D7', '#5F87FF',
    '#5FAF00', '#5FAF5F', '#5FAF87', '#5FAFAF', '#5FAFD7', '#5FAFFF',
    '#5FD700', '#5FD75F', '#5FD787', '#5FD7AF', '#5FD7D7', '#5FD7FF',
    '#5FFF00', '#5FFF5F', '#5FFF87', '#5FFFAF', '#5FFFD7', '#5FFFFF',

    '#870000', '#87005F', '#870087', '#8700AF', '#8700D7', '#8700FF',
    '#875F00', '#875F5F', '#875F87', '#875FAF', '#875FD7', '#875FFF',
    '#878700', '#87875F', '#878787', '#8787AF', '#8787D7', '#8787FF',
    '#87AF00', '#87AF5F', '#87AF87', '#87AFAF', '#87AFD7', '#87AFFF',
    '#87D700', '#87D75F', '#87D787', '#87D7AF', '#87D7D7', '#87D7FF',
    '#87FF00', '#87FF5F', '#87FF87', '#87FFAF', '#87FFD7', '#87FFFF',

    '#AF0000', '#AF005F', '#AF0087', '#AF00AF', '#AF00D7', '#AF00FF',
    '#AF5F00', '#AF5F5F', '#AF5F87', '#AF5FAF', '#AF5FD7', '#AF5FFF',
    '#AF8700', '#AF875F', '#AF8787', '#AF87AF', '#AF87D7', '#AF87FF',
    '#AFAF00', '#AFAF5F', '#AFAF87', '#AFAFAF', '#AFAFD7', '#AFAFFF',
    '#AFD700', '#AFD75F', '#AFD787', '#AFD7AF', '#AFD7D7', '#AFD7FF',
    '#AFFF00', '#AFFF5F', '#AFFF87', '#AFFFAF', '#AFFFD7', '#AFFFFF',

    '#D70000', '#D7005F', '#D70087', '#D700AF', '#D700D7', '#D700FF',
    '#D75F00', '#D75F5F', '#D75F87', '#D75FAF', '#D75FD7', '#D75FFF',
    '#D78700', '#D7875F', '#D78787', '#D787AF', '#D787D7', '#D787FF',
    '#D7AF00', '#D7AF5F', '#D7AF87', '#D7AFAF', '#D7AFD7', '#D7AFFF',
    '#D7D700', '#D7D75F', '#D7D787', '#D7D7AF', '#D7D7D7', '#D7D7FF',
    '#D7FF00', '#D7FF5F', '#D7FF87', '#D7FFAF', '#D7FFD7', '#D7FFFF',

    '#FF0000', '#FF005F', '#FF0087', '#FF00AF', '#FF00D7', '#FF00FF',
    '#FF5F00', '#FF5F5F', '#FF5F87', '#FF5FAF', '#FF5FD7', '#FF5FFF',
    '#FF8700', '#FF875F', '#FF8787', '#FF87AF', '#FF87D7', '#FF87FF',
    '#FFAF00', '#FFAF5F', '#FFAF87', '#FFAFAF', '#FFAFD7', '#FFAFFF',
    '#FFD700', '#FFD75F', '#FFD787', '#FFD7AF', '#FFD7D7', '#FFD7FF',
    '#FFFF00', '#FFFF5F', '#FFFF87', '#FFFFAF', '#FFFFD7', '#FFFFFF',

    // The greyscale ramp...
    '#080808', '#121212', '#1C1C1C', '#262626', '#303030', '#3A3A3A',
    '#444444', '#4E4E4E', '#585858', '#626262', '#6C6C6C', '#767676',
    '#808080', '#8A8A8A', '#949494', '#9E9E9E', '#A8A8A8', '#B2B2B2',
    '#BCBCBC', '#C6C6C6', '#D0D0D0', '#DADADA', '#E4E4E4', '#EEEEEE',
   ].map(lib.colors.hexToRGB);

/**
 * Named colors according to the stock X11 rgb.txt file.
 */
lib.colors.colorNames = {
  'aliceblue': 'rgb(240, 248, 255)',
  'antiquewhite': 'rgb(250, 235, 215)',
  'antiquewhite1': 'rgb(255, 239, 219)',
  'antiquewhite2': 'rgb(238, 223, 204)',
  'antiquewhite3': 'rgb(205, 192, 176)',
  'antiquewhite4': 'rgb(139, 131, 120)',
  'aquamarine': 'rgb(127, 255, 212)',
  'aquamarine1': 'rgb(127, 255, 212)',
  'aquamarine2': 'rgb(118, 238, 198)',
  'aquamarine3': 'rgb(102, 205, 170)',
  'aquamarine4': 'rgb(69, 139, 116)',
  'azure': 'rgb(240, 255, 255)',
  'azure1': 'rgb(240, 255, 255)',
  'azure2': 'rgb(224, 238, 238)',
  'azure3': 'rgb(193, 205, 205)',
  'azure4': 'rgb(131, 139, 139)',
  'beige': 'rgb(245, 245, 220)',
  'bisque': 'rgb(255, 228, 196)',
  'bisque1': 'rgb(255, 228, 196)',
  'bisque2': 'rgb(238, 213, 183)',
  'bisque3': 'rgb(205, 183, 158)',
  'bisque4': 'rgb(139, 125, 107)',
  'black': 'rgb(0, 0, 0)',
  'blanchedalmond': 'rgb(255, 235, 205)',
  'blue': 'rgb(0, 0, 255)',
  'blue1': 'rgb(0, 0, 255)',
  'blue2': 'rgb(0, 0, 238)',
  'blue3': 'rgb(0, 0, 205)',
  'blue4': 'rgb(0, 0, 139)',
  'blueviolet': 'rgb(138, 43, 226)',
  'brown': 'rgb(165, 42, 42)',
  'brown1': 'rgb(255, 64, 64)',
  'brown2': 'rgb(238, 59, 59)',
  'brown3': 'rgb(205, 51, 51)',
  'brown4': 'rgb(139, 35, 35)',
  'burlywood': 'rgb(222, 184, 135)',
  'burlywood1': 'rgb(255, 211, 155)',
  'burlywood2': 'rgb(238, 197, 145)',
  'burlywood3': 'rgb(205, 170, 125)',
  'burlywood4': 'rgb(139, 115, 85)',
  'cadetblue': 'rgb(95, 158, 160)',
  'cadetblue1': 'rgb(152, 245, 255)',
  'cadetblue2': 'rgb(142, 229, 238)',
  'cadetblue3': 'rgb(122, 197, 205)',
  'cadetblue4': 'rgb(83, 134, 139)',
  'chartreuse': 'rgb(127, 255, 0)',
  'chartreuse1': 'rgb(127, 255, 0)',
  'chartreuse2': 'rgb(118, 238, 0)',
  'chartreuse3': 'rgb(102, 205, 0)',
  'chartreuse4': 'rgb(69, 139, 0)',
  'chocolate': 'rgb(210, 105, 30)',
  'chocolate1': 'rgb(255, 127, 36)',
  'chocolate2': 'rgb(238, 118, 33)',
  'chocolate3': 'rgb(205, 102, 29)',
  'chocolate4': 'rgb(139, 69, 19)',
  'coral': 'rgb(255, 127, 80)',
  'coral1': 'rgb(255, 114, 86)',
  'coral2': 'rgb(238, 106, 80)',
  'coral3': 'rgb(205, 91, 69)',
  'coral4': 'rgb(139, 62, 47)',
  'cornflowerblue': 'rgb(100, 149, 237)',
  'cornsilk': 'rgb(255, 248, 220)',
  'cornsilk1': 'rgb(255, 248, 220)',
  'cornsilk2': 'rgb(238, 232, 205)',
  'cornsilk3': 'rgb(205, 200, 177)',
  'cornsilk4': 'rgb(139, 136, 120)',
  'cyan': 'rgb(0, 255, 255)',
  'cyan1': 'rgb(0, 255, 255)',
  'cyan2': 'rgb(0, 238, 238)',
  'cyan3': 'rgb(0, 205, 205)',
  'cyan4': 'rgb(0, 139, 139)',
  'darkblue': 'rgb(0, 0, 139)',
  'darkcyan': 'rgb(0, 139, 139)',
  'darkgoldenrod': 'rgb(184, 134, 11)',
  'darkgoldenrod1': 'rgb(255, 185, 15)',
  'darkgoldenrod2': 'rgb(238, 173, 14)',
  'darkgoldenrod3': 'rgb(205, 149, 12)',
  'darkgoldenrod4': 'rgb(139, 101, 8)',
  'darkgray': 'rgb(169, 169, 169)',
  'darkgreen': 'rgb(0, 100, 0)',
  'darkgrey': 'rgb(169, 169, 169)',
  'darkkhaki': 'rgb(189, 183, 107)',
  'darkmagenta': 'rgb(139, 0, 139)',
  'darkolivegreen': 'rgb(85, 107, 47)',
  'darkolivegreen1': 'rgb(202, 255, 112)',
  'darkolivegreen2': 'rgb(188, 238, 104)',
  'darkolivegreen3': 'rgb(162, 205, 90)',
  'darkolivegreen4': 'rgb(110, 139, 61)',
  'darkorange': 'rgb(255, 140, 0)',
  'darkorange1': 'rgb(255, 127, 0)',
  'darkorange2': 'rgb(238, 118, 0)',
  'darkorange3': 'rgb(205, 102, 0)',
  'darkorange4': 'rgb(139, 69, 0)',
  'darkorchid': 'rgb(153, 50, 204)',
  'darkorchid1': 'rgb(191, 62, 255)',
  'darkorchid2': 'rgb(178, 58, 238)',
  'darkorchid3': 'rgb(154, 50, 205)',
  'darkorchid4': 'rgb(104, 34, 139)',
  'darkred': 'rgb(139, 0, 0)',
  'darksalmon': 'rgb(233, 150, 122)',
  'darkseagreen': 'rgb(143, 188, 143)',
  'darkseagreen1': 'rgb(193, 255, 193)',
  'darkseagreen2': 'rgb(180, 238, 180)',
  'darkseagreen3': 'rgb(155, 205, 155)',
  'darkseagreen4': 'rgb(105, 139, 105)',
  'darkslateblue': 'rgb(72, 61, 139)',
  'darkslategray': 'rgb(47, 79, 79)',
  'darkslategray1': 'rgb(151, 255, 255)',
  'darkslategray2': 'rgb(141, 238, 238)',
  'darkslategray3': 'rgb(121, 205, 205)',
  'darkslategray4': 'rgb(82, 139, 139)',
  'darkslategrey': 'rgb(47, 79, 79)',
  'darkturquoise': 'rgb(0, 206, 209)',
  'darkviolet': 'rgb(148, 0, 211)',
  'debianred': 'rgb(215, 7, 81)',
  'deeppink': 'rgb(255, 20, 147)',
  'deeppink1': 'rgb(255, 20, 147)',
  'deeppink2': 'rgb(238, 18, 137)',
  'deeppink3': 'rgb(205, 16, 118)',
  'deeppink4': 'rgb(139, 10, 80)',
  'deepskyblue': 'rgb(0, 191, 255)',
  'deepskyblue1': 'rgb(0, 191, 255)',
  'deepskyblue2': 'rgb(0, 178, 238)',
  'deepskyblue3': 'rgb(0, 154, 205)',
  'deepskyblue4': 'rgb(0, 104, 139)',
  'dimgray': 'rgb(105, 105, 105)',
  'dimgrey': 'rgb(105, 105, 105)',
  'dodgerblue': 'rgb(30, 144, 255)',
  'dodgerblue1': 'rgb(30, 144, 255)',
  'dodgerblue2': 'rgb(28, 134, 238)',
  'dodgerblue3': 'rgb(24, 116, 205)',
  'dodgerblue4': 'rgb(16, 78, 139)',
  'firebrick': 'rgb(178, 34, 34)',
  'firebrick1': 'rgb(255, 48, 48)',
  'firebrick2': 'rgb(238, 44, 44)',
  'firebrick3': 'rgb(205, 38, 38)',
  'firebrick4': 'rgb(139, 26, 26)',
  'floralwhite': 'rgb(255, 250, 240)',
  'forestgreen': 'rgb(34, 139, 34)',
  'gainsboro': 'rgb(220, 220, 220)',
  'ghostwhite': 'rgb(248, 248, 255)',
  'gold': 'rgb(255, 215, 0)',
  'gold1': 'rgb(255, 215, 0)',
  'gold2': 'rgb(238, 201, 0)',
  'gold3': 'rgb(205, 173, 0)',
  'gold4': 'rgb(139, 117, 0)',
  'goldenrod': 'rgb(218, 165, 32)',
  'goldenrod1': 'rgb(255, 193, 37)',
  'goldenrod2': 'rgb(238, 180, 34)',
  'goldenrod3': 'rgb(205, 155, 29)',
  'goldenrod4': 'rgb(139, 105, 20)',
  'gray': 'rgb(190, 190, 190)',
  'gray0': 'rgb(0, 0, 0)',
  'gray1': 'rgb(3, 3, 3)',
  'gray10': 'rgb(26, 26, 26)',
  'gray100': 'rgb(255, 255, 255)',
  'gray11': 'rgb(28, 28, 28)',
  'gray12': 'rgb(31, 31, 31)',
  'gray13': 'rgb(33, 33, 33)',
  'gray14': 'rgb(36, 36, 36)',
  'gray15': 'rgb(38, 38, 38)',
  'gray16': 'rgb(41, 41, 41)',
  'gray17': 'rgb(43, 43, 43)',
  'gray18': 'rgb(46, 46, 46)',
  'gray19': 'rgb(48, 48, 48)',
  'gray2': 'rgb(5, 5, 5)',
  'gray20': 'rgb(51, 51, 51)',
  'gray21': 'rgb(54, 54, 54)',
  'gray22': 'rgb(56, 56, 56)',
  'gray23': 'rgb(59, 59, 59)',
  'gray24': 'rgb(61, 61, 61)',
  'gray25': 'rgb(64, 64, 64)',
  'gray26': 'rgb(66, 66, 66)',
  'gray27': 'rgb(69, 69, 69)',
  'gray28': 'rgb(71, 71, 71)',
  'gray29': 'rgb(74, 74, 74)',
  'gray3': 'rgb(8, 8, 8)',
  'gray30': 'rgb(77, 77, 77)',
  'gray31': 'rgb(79, 79, 79)',
  'gray32': 'rgb(82, 82, 82)',
  'gray33': 'rgb(84, 84, 84)',
  'gray34': 'rgb(87, 87, 87)',
  'gray35': 'rgb(89, 89, 89)',
  'gray36': 'rgb(92, 92, 92)',
  'gray37': 'rgb(94, 94, 94)',
  'gray38': 'rgb(97, 97, 97)',
  'gray39': 'rgb(99, 99, 99)',
  'gray4': 'rgb(10, 10, 10)',
  'gray40': 'rgb(102, 102, 102)',
  'gray41': 'rgb(105, 105, 105)',
  'gray42': 'rgb(107, 107, 107)',
  'gray43': 'rgb(110, 110, 110)',
  'gray44': 'rgb(112, 112, 112)',
  'gray45': 'rgb(115, 115, 115)',
  'gray46': 'rgb(117, 117, 117)',
  'gray47': 'rgb(120, 120, 120)',
  'gray48': 'rgb(122, 122, 122)',
  'gray49': 'rgb(125, 125, 125)',
  'gray5': 'rgb(13, 13, 13)',
  'gray50': 'rgb(127, 127, 127)',
  'gray51': 'rgb(130, 130, 130)',
  'gray52': 'rgb(133, 133, 133)',
  'gray53': 'rgb(135, 135, 135)',
  'gray54': 'rgb(138, 138, 138)',
  'gray55': 'rgb(140, 140, 140)',
  'gray56': 'rgb(143, 143, 143)',
  'gray57': 'rgb(145, 145, 145)',
  'gray58': 'rgb(148, 148, 148)',
  'gray59': 'rgb(150, 150, 150)',
  'gray6': 'rgb(15, 15, 15)',
  'gray60': 'rgb(153, 153, 153)',
  'gray61': 'rgb(156, 156, 156)',
  'gray62': 'rgb(158, 158, 158)',
  'gray63': 'rgb(161, 161, 161)',
  'gray64': 'rgb(163, 163, 163)',
  'gray65': 'rgb(166, 166, 166)',
  'gray66': 'rgb(168, 168, 168)',
  'gray67': 'rgb(171, 171, 171)',
  'gray68': 'rgb(173, 173, 173)',
  'gray69': 'rgb(176, 176, 176)',
  'gray7': 'rgb(18, 18, 18)',
  'gray70': 'rgb(179, 179, 179)',
  'gray71': 'rgb(181, 181, 181)',
  'gray72': 'rgb(184, 184, 184)',
  'gray73': 'rgb(186, 186, 186)',
  'gray74': 'rgb(189, 189, 189)',
  'gray75': 'rgb(191, 191, 191)',
  'gray76': 'rgb(194, 194, 194)',
  'gray77': 'rgb(196, 196, 196)',
  'gray78': 'rgb(199, 199, 199)',
  'gray79': 'rgb(201, 201, 201)',
  'gray8': 'rgb(20, 20, 20)',
  'gray80': 'rgb(204, 204, 204)',
  'gray81': 'rgb(207, 207, 207)',
  'gray82': 'rgb(209, 209, 209)',
  'gray83': 'rgb(212, 212, 212)',
  'gray84': 'rgb(214, 214, 214)',
  'gray85': 'rgb(217, 217, 217)',
  'gray86': 'rgb(219, 219, 219)',
  'gray87': 'rgb(222, 222, 222)',
  'gray88': 'rgb(224, 224, 224)',
  'gray89': 'rgb(227, 227, 227)',
  'gray9': 'rgb(23, 23, 23)',
  'gray90': 'rgb(229, 229, 229)',
  'gray91': 'rgb(232, 232, 232)',
  'gray92': 'rgb(235, 235, 235)',
  'gray93': 'rgb(237, 237, 237)',
  'gray94': 'rgb(240, 240, 240)',
  'gray95': 'rgb(242, 242, 242)',
  'gray96': 'rgb(245, 245, 245)',
  'gray97': 'rgb(247, 247, 247)',
  'gray98': 'rgb(250, 250, 250)',
  'gray99': 'rgb(252, 252, 252)',
  'green': 'rgb(0, 255, 0)',
  'green1': 'rgb(0, 255, 0)',
  'green2': 'rgb(0, 238, 0)',
  'green3': 'rgb(0, 205, 0)',
  'green4': 'rgb(0, 139, 0)',
  'greenyellow': 'rgb(173, 255, 47)',
  'grey': 'rgb(190, 190, 190)',
  'grey0': 'rgb(0, 0, 0)',
  'grey1': 'rgb(3, 3, 3)',
  'grey10': 'rgb(26, 26, 26)',
  'grey100': 'rgb(255, 255, 255)',
  'grey11': 'rgb(28, 28, 28)',
  'grey12': 'rgb(31, 31, 31)',
  'grey13': 'rgb(33, 33, 33)',
  'grey14': 'rgb(36, 36, 36)',
  'grey15': 'rgb(38, 38, 38)',
  'grey16': 'rgb(41, 41, 41)',
  'grey17': 'rgb(43, 43, 43)',
  'grey18': 'rgb(46, 46, 46)',
  'grey19': 'rgb(48, 48, 48)',
  'grey2': 'rgb(5, 5, 5)',
  'grey20': 'rgb(51, 51, 51)',
  'grey21': 'rgb(54, 54, 54)',
  'grey22': 'rgb(56, 56, 56)',
  'grey23': 'rgb(59, 59, 59)',
  'grey24': 'rgb(61, 61, 61)',
  'grey25': 'rgb(64, 64, 64)',
  'grey26': 'rgb(66, 66, 66)',
  'grey27': 'rgb(69, 69, 69)',
  'grey28': 'rgb(71, 71, 71)',
  'grey29': 'rgb(74, 74, 74)',
  'grey3': 'rgb(8, 8, 8)',
  'grey30': 'rgb(77, 77, 77)',
  'grey31': 'rgb(79, 79, 79)',
  'grey32': 'rgb(82, 82, 82)',
  'grey33': 'rgb(84, 84, 84)',
  'grey34': 'rgb(87, 87, 87)',
  'grey35': 'rgb(89, 89, 89)',
  'grey36': 'rgb(92, 92, 92)',
  'grey37': 'rgb(94, 94, 94)',
  'grey38': 'rgb(97, 97, 97)',
  'grey39': 'rgb(99, 99, 99)',
  'grey4': 'rgb(10, 10, 10)',
  'grey40': 'rgb(102, 102, 102)',
  'grey41': 'rgb(105, 105, 105)',
  'grey42': 'rgb(107, 107, 107)',
  'grey43': 'rgb(110, 110, 110)',
  'grey44': 'rgb(112, 112, 112)',
  'grey45': 'rgb(115, 115, 115)',
  'grey46': 'rgb(117, 117, 117)',
  'grey47': 'rgb(120, 120, 120)',
  'grey48': 'rgb(122, 122, 122)',
  'grey49': 'rgb(125, 125, 125)',
  'grey5': 'rgb(13, 13, 13)',
  'grey50': 'rgb(127, 127, 127)',
  'grey51': 'rgb(130, 130, 130)',
  'grey52': 'rgb(133, 133, 133)',
  'grey53': 'rgb(135, 135, 135)',
  'grey54': 'rgb(138, 138, 138)',
  'grey55': 'rgb(140, 140, 140)',
  'grey56': 'rgb(143, 143, 143)',
  'grey57': 'rgb(145, 145, 145)',
  'grey58': 'rgb(148, 148, 148)',
  'grey59': 'rgb(150, 150, 150)',
  'grey6': 'rgb(15, 15, 15)',
  'grey60': 'rgb(153, 153, 153)',
  'grey61': 'rgb(156, 156, 156)',
  'grey62': 'rgb(158, 158, 158)',
  'grey63': 'rgb(161, 161, 161)',
  'grey64': 'rgb(163, 163, 163)',
  'grey65': 'rgb(166, 166, 166)',
  'grey66': 'rgb(168, 168, 168)',
  'grey67': 'rgb(171, 171, 171)',
  'grey68': 'rgb(173, 173, 173)',
  'grey69': 'rgb(176, 176, 176)',
  'grey7': 'rgb(18, 18, 18)',
  'grey70': 'rgb(179, 179, 179)',
  'grey71': 'rgb(181, 181, 181)',
  'grey72': 'rgb(184, 184, 184)',
  'grey73': 'rgb(186, 186, 186)',
  'grey74': 'rgb(189, 189, 189)',
  'grey75': 'rgb(191, 191, 191)',
  'grey76': 'rgb(194, 194, 194)',
  'grey77': 'rgb(196, 196, 196)',
  'grey78': 'rgb(199, 199, 199)',
  'grey79': 'rgb(201, 201, 201)',
  'grey8': 'rgb(20, 20, 20)',
  'grey80': 'rgb(204, 204, 204)',
  'grey81': 'rgb(207, 207, 207)',
  'grey82': 'rgb(209, 209, 209)',
  'grey83': 'rgb(212, 212, 212)',
  'grey84': 'rgb(214, 214, 214)',
  'grey85': 'rgb(217, 217, 217)',
  'grey86': 'rgb(219, 219, 219)',
  'grey87': 'rgb(222, 222, 222)',
  'grey88': 'rgb(224, 224, 224)',
  'grey89': 'rgb(227, 227, 227)',
  'grey9': 'rgb(23, 23, 23)',
  'grey90': 'rgb(229, 229, 229)',
  'grey91': 'rgb(232, 232, 232)',
  'grey92': 'rgb(235, 235, 235)',
  'grey93': 'rgb(237, 237, 237)',
  'grey94': 'rgb(240, 240, 240)',
  'grey95': 'rgb(242, 242, 242)',
  'grey96': 'rgb(245, 245, 245)',
  'grey97': 'rgb(247, 247, 247)',
  'grey98': 'rgb(250, 250, 250)',
  'grey99': 'rgb(252, 252, 252)',
  'honeydew': 'rgb(240, 255, 240)',
  'honeydew1': 'rgb(240, 255, 240)',
  'honeydew2': 'rgb(224, 238, 224)',
  'honeydew3': 'rgb(193, 205, 193)',
  'honeydew4': 'rgb(131, 139, 131)',
  'hotpink': 'rgb(255, 105, 180)',
  'hotpink1': 'rgb(255, 110, 180)',
  'hotpink2': 'rgb(238, 106, 167)',
  'hotpink3': 'rgb(205, 96, 144)',
  'hotpink4': 'rgb(139, 58, 98)',
  'indianred': 'rgb(205, 92, 92)',
  'indianred1': 'rgb(255, 106, 106)',
  'indianred2': 'rgb(238, 99, 99)',
  'indianred3': 'rgb(205, 85, 85)',
  'indianred4': 'rgb(139, 58, 58)',
  'ivory': 'rgb(255, 255, 240)',
  'ivory1': 'rgb(255, 255, 240)',
  'ivory2': 'rgb(238, 238, 224)',
  'ivory3': 'rgb(205, 205, 193)',
  'ivory4': 'rgb(139, 139, 131)',
  'khaki': 'rgb(240, 230, 140)',
  'khaki1': 'rgb(255, 246, 143)',
  'khaki2': 'rgb(238, 230, 133)',
  'khaki3': 'rgb(205, 198, 115)',
  'khaki4': 'rgb(139, 134, 78)',
  'lavender': 'rgb(230, 230, 250)',
  'lavenderblush': 'rgb(255, 240, 245)',
  'lavenderblush1': 'rgb(255, 240, 245)',
  'lavenderblush2': 'rgb(238, 224, 229)',
  'lavenderblush3': 'rgb(205, 193, 197)',
  'lavenderblush4': 'rgb(139, 131, 134)',
  'lawngreen': 'rgb(124, 252, 0)',
  'lemonchiffon': 'rgb(255, 250, 205)',
  'lemonchiffon1': 'rgb(255, 250, 205)',
  'lemonchiffon2': 'rgb(238, 233, 191)',
  'lemonchiffon3': 'rgb(205, 201, 165)',
  'lemonchiffon4': 'rgb(139, 137, 112)',
  'lightblue': 'rgb(173, 216, 230)',
  'lightblue1': 'rgb(191, 239, 255)',
  'lightblue2': 'rgb(178, 223, 238)',
  'lightblue3': 'rgb(154, 192, 205)',
  'lightblue4': 'rgb(104, 131, 139)',
  'lightcoral': 'rgb(240, 128, 128)',
  'lightcyan': 'rgb(224, 255, 255)',
  'lightcyan1': 'rgb(224, 255, 255)',
  'lightcyan2': 'rgb(209, 238, 238)',
  'lightcyan3': 'rgb(180, 205, 205)',
  'lightcyan4': 'rgb(122, 139, 139)',
  'lightgoldenrod': 'rgb(238, 221, 130)',
  'lightgoldenrod1': 'rgb(255, 236, 139)',
  'lightgoldenrod2': 'rgb(238, 220, 130)',
  'lightgoldenrod3': 'rgb(205, 190, 112)',
  'lightgoldenrod4': 'rgb(139, 129, 76)',
  'lightgoldenrodyellow': 'rgb(250, 250, 210)',
  'lightgray': 'rgb(211, 211, 211)',
  'lightgreen': 'rgb(144, 238, 144)',
  'lightgrey': 'rgb(211, 211, 211)',
  'lightpink': 'rgb(255, 182, 193)',
  'lightpink1': 'rgb(255, 174, 185)',
  'lightpink2': 'rgb(238, 162, 173)',
  'lightpink3': 'rgb(205, 140, 149)',
  'lightpink4': 'rgb(139, 95, 101)',
  'lightsalmon': 'rgb(255, 160, 122)',
  'lightsalmon1': 'rgb(255, 160, 122)',
  'lightsalmon2': 'rgb(238, 149, 114)',
  'lightsalmon3': 'rgb(205, 129, 98)',
  'lightsalmon4': 'rgb(139, 87, 66)',
  'lightseagreen': 'rgb(32, 178, 170)',
  'lightskyblue': 'rgb(135, 206, 250)',
  'lightskyblue1': 'rgb(176, 226, 255)',
  'lightskyblue2': 'rgb(164, 211, 238)',
  'lightskyblue3': 'rgb(141, 182, 205)',
  'lightskyblue4': 'rgb(96, 123, 139)',
  'lightslateblue': 'rgb(132, 112, 255)',
  'lightslategray': 'rgb(119, 136, 153)',
  'lightslategrey': 'rgb(119, 136, 153)',
  'lightsteelblue': 'rgb(176, 196, 222)',
  'lightsteelblue1': 'rgb(202, 225, 255)',
  'lightsteelblue2': 'rgb(188, 210, 238)',
  'lightsteelblue3': 'rgb(162, 181, 205)',
  'lightsteelblue4': 'rgb(110, 123, 139)',
  'lightyellow': 'rgb(255, 255, 224)',
  'lightyellow1': 'rgb(255, 255, 224)',
  'lightyellow2': 'rgb(238, 238, 209)',
  'lightyellow3': 'rgb(205, 205, 180)',
  'lightyellow4': 'rgb(139, 139, 122)',
  'limegreen': 'rgb(50, 205, 50)',
  'linen': 'rgb(250, 240, 230)',
  'magenta': 'rgb(255, 0, 255)',
  'magenta1': 'rgb(255, 0, 255)',
  'magenta2': 'rgb(238, 0, 238)',
  'magenta3': 'rgb(205, 0, 205)',
  'magenta4': 'rgb(139, 0, 139)',
  'maroon': 'rgb(176, 48, 96)',
  'maroon1': 'rgb(255, 52, 179)',
  'maroon2': 'rgb(238, 48, 167)',
  'maroon3': 'rgb(205, 41, 144)',
  'maroon4': 'rgb(139, 28, 98)',
  'mediumaquamarine': 'rgb(102, 205, 170)',
  'mediumblue': 'rgb(0, 0, 205)',
  'mediumorchid': 'rgb(186, 85, 211)',
  'mediumorchid1': 'rgb(224, 102, 255)',
  'mediumorchid2': 'rgb(209, 95, 238)',
  'mediumorchid3': 'rgb(180, 82, 205)',
  'mediumorchid4': 'rgb(122, 55, 139)',
  'mediumpurple': 'rgb(147, 112, 219)',
  'mediumpurple1': 'rgb(171, 130, 255)',
  'mediumpurple2': 'rgb(159, 121, 238)',
  'mediumpurple3': 'rgb(137, 104, 205)',
  'mediumpurple4': 'rgb(93, 71, 139)',
  'mediumseagreen': 'rgb(60, 179, 113)',
  'mediumslateblue': 'rgb(123, 104, 238)',
  'mediumspringgreen': 'rgb(0, 250, 154)',
  'mediumturquoise': 'rgb(72, 209, 204)',
  'mediumvioletred': 'rgb(199, 21, 133)',
  'midnightblue': 'rgb(25, 25, 112)',
  'mintcream': 'rgb(245, 255, 250)',
  'mistyrose': 'rgb(255, 228, 225)',
  'mistyrose1': 'rgb(255, 228, 225)',
  'mistyrose2': 'rgb(238, 213, 210)',
  'mistyrose3': 'rgb(205, 183, 181)',
  'mistyrose4': 'rgb(139, 125, 123)',
  'moccasin': 'rgb(255, 228, 181)',
  'navajowhite': 'rgb(255, 222, 173)',
  'navajowhite1': 'rgb(255, 222, 173)',
  'navajowhite2': 'rgb(238, 207, 161)',
  'navajowhite3': 'rgb(205, 179, 139)',
  'navajowhite4': 'rgb(139, 121, 94)',
  'navy': 'rgb(0, 0, 128)',
  'navyblue': 'rgb(0, 0, 128)',
  'oldlace': 'rgb(253, 245, 230)',
  'olivedrab': 'rgb(107, 142, 35)',
  'olivedrab1': 'rgb(192, 255, 62)',
  'olivedrab2': 'rgb(179, 238, 58)',
  'olivedrab3': 'rgb(154, 205, 50)',
  'olivedrab4': 'rgb(105, 139, 34)',
  'orange': 'rgb(255, 165, 0)',
  'orange1': 'rgb(255, 165, 0)',
  'orange2': 'rgb(238, 154, 0)',
  'orange3': 'rgb(205, 133, 0)',
  'orange4': 'rgb(139, 90, 0)',
  'orangered': 'rgb(255, 69, 0)',
  'orangered1': 'rgb(255, 69, 0)',
  'orangered2': 'rgb(238, 64, 0)',
  'orangered3': 'rgb(205, 55, 0)',
  'orangered4': 'rgb(139, 37, 0)',
  'orchid': 'rgb(218, 112, 214)',
  'orchid1': 'rgb(255, 131, 250)',
  'orchid2': 'rgb(238, 122, 233)',
  'orchid3': 'rgb(205, 105, 201)',
  'orchid4': 'rgb(139, 71, 137)',
  'palegoldenrod': 'rgb(238, 232, 170)',
  'palegreen': 'rgb(152, 251, 152)',
  'palegreen1': 'rgb(154, 255, 154)',
  'palegreen2': 'rgb(144, 238, 144)',
  'palegreen3': 'rgb(124, 205, 124)',
  'palegreen4': 'rgb(84, 139, 84)',
  'paleturquoise': 'rgb(175, 238, 238)',
  'paleturquoise1': 'rgb(187, 255, 255)',
  'paleturquoise2': 'rgb(174, 238, 238)',
  'paleturquoise3': 'rgb(150, 205, 205)',
  'paleturquoise4': 'rgb(102, 139, 139)',
  'palevioletred': 'rgb(219, 112, 147)',
  'palevioletred1': 'rgb(255, 130, 171)',
  'palevioletred2': 'rgb(238, 121, 159)',
  'palevioletred3': 'rgb(205, 104, 137)',
  'palevioletred4': 'rgb(139, 71, 93)',
  'papayawhip': 'rgb(255, 239, 213)',
  'peachpuff': 'rgb(255, 218, 185)',
  'peachpuff1': 'rgb(255, 218, 185)',
  'peachpuff2': 'rgb(238, 203, 173)',
  'peachpuff3': 'rgb(205, 175, 149)',
  'peachpuff4': 'rgb(139, 119, 101)',
  'peru': 'rgb(205, 133, 63)',
  'pink': 'rgb(255, 192, 203)',
  'pink1': 'rgb(255, 181, 197)',
  'pink2': 'rgb(238, 169, 184)',
  'pink3': 'rgb(205, 145, 158)',
  'pink4': 'rgb(139, 99, 108)',
  'plum': 'rgb(221, 160, 221)',
  'plum1': 'rgb(255, 187, 255)',
  'plum2': 'rgb(238, 174, 238)',
  'plum3': 'rgb(205, 150, 205)',
  'plum4': 'rgb(139, 102, 139)',
  'powderblue': 'rgb(176, 224, 230)',
  'purple': 'rgb(160, 32, 240)',
  'purple1': 'rgb(155, 48, 255)',
  'purple2': 'rgb(145, 44, 238)',
  'purple3': 'rgb(125, 38, 205)',
  'purple4': 'rgb(85, 26, 139)',
  'red': 'rgb(255, 0, 0)',
  'red1': 'rgb(255, 0, 0)',
  'red2': 'rgb(238, 0, 0)',
  'red3': 'rgb(205, 0, 0)',
  'red4': 'rgb(139, 0, 0)',
  'rosybrown': 'rgb(188, 143, 143)',
  'rosybrown1': 'rgb(255, 193, 193)',
  'rosybrown2': 'rgb(238, 180, 180)',
  'rosybrown3': 'rgb(205, 155, 155)',
  'rosybrown4': 'rgb(139, 105, 105)',
  'royalblue': 'rgb(65, 105, 225)',
  'royalblue1': 'rgb(72, 118, 255)',
  'royalblue2': 'rgb(67, 110, 238)',
  'royalblue3': 'rgb(58, 95, 205)',
  'royalblue4': 'rgb(39, 64, 139)',
  'saddlebrown': 'rgb(139, 69, 19)',
  'salmon': 'rgb(250, 128, 114)',
  'salmon1': 'rgb(255, 140, 105)',
  'salmon2': 'rgb(238, 130, 98)',
  'salmon3': 'rgb(205, 112, 84)',
  'salmon4': 'rgb(139, 76, 57)',
  'sandybrown': 'rgb(244, 164, 96)',
  'seagreen': 'rgb(46, 139, 87)',
  'seagreen1': 'rgb(84, 255, 159)',
  'seagreen2': 'rgb(78, 238, 148)',
  'seagreen3': 'rgb(67, 205, 128)',
  'seagreen4': 'rgb(46, 139, 87)',
  'seashell': 'rgb(255, 245, 238)',
  'seashell1': 'rgb(255, 245, 238)',
  'seashell2': 'rgb(238, 229, 222)',
  'seashell3': 'rgb(205, 197, 191)',
  'seashell4': 'rgb(139, 134, 130)',
  'sienna': 'rgb(160, 82, 45)',
  'sienna1': 'rgb(255, 130, 71)',
  'sienna2': 'rgb(238, 121, 66)',
  'sienna3': 'rgb(205, 104, 57)',
  'sienna4': 'rgb(139, 71, 38)',
  'skyblue': 'rgb(135, 206, 235)',
  'skyblue1': 'rgb(135, 206, 255)',
  'skyblue2': 'rgb(126, 192, 238)',
  'skyblue3': 'rgb(108, 166, 205)',
  'skyblue4': 'rgb(74, 112, 139)',
  'slateblue': 'rgb(106, 90, 205)',
  'slateblue1': 'rgb(131, 111, 255)',
  'slateblue2': 'rgb(122, 103, 238)',
  'slateblue3': 'rgb(105, 89, 205)',
  'slateblue4': 'rgb(71, 60, 139)',
  'slategray': 'rgb(112, 128, 144)',
  'slategray1': 'rgb(198, 226, 255)',
  'slategray2': 'rgb(185, 211, 238)',
  'slategray3': 'rgb(159, 182, 205)',
  'slategray4': 'rgb(108, 123, 139)',
  'slategrey': 'rgb(112, 128, 144)',
  'snow': 'rgb(255, 250, 250)',
  'snow1': 'rgb(255, 250, 250)',
  'snow2': 'rgb(238, 233, 233)',
  'snow3': 'rgb(205, 201, 201)',
  'snow4': 'rgb(139, 137, 137)',
  'springgreen': 'rgb(0, 255, 127)',
  'springgreen1': 'rgb(0, 255, 127)',
  'springgreen2': 'rgb(0, 238, 118)',
  'springgreen3': 'rgb(0, 205, 102)',
  'springgreen4': 'rgb(0, 139, 69)',
  'steelblue': 'rgb(70, 130, 180)',
  'steelblue1': 'rgb(99, 184, 255)',
  'steelblue2': 'rgb(92, 172, 238)',
  'steelblue3': 'rgb(79, 148, 205)',
  'steelblue4': 'rgb(54, 100, 139)',
  'tan': 'rgb(210, 180, 140)',
  'tan1': 'rgb(255, 165, 79)',
  'tan2': 'rgb(238, 154, 73)',
  'tan3': 'rgb(205, 133, 63)',
  'tan4': 'rgb(139, 90, 43)',
  'thistle': 'rgb(216, 191, 216)',
  'thistle1': 'rgb(255, 225, 255)',
  'thistle2': 'rgb(238, 210, 238)',
  'thistle3': 'rgb(205, 181, 205)',
  'thistle4': 'rgb(139, 123, 139)',
  'tomato': 'rgb(255, 99, 71)',
  'tomato1': 'rgb(255, 99, 71)',
  'tomato2': 'rgb(238, 92, 66)',
  'tomato3': 'rgb(205, 79, 57)',
  'tomato4': 'rgb(139, 54, 38)',
  'turquoise': 'rgb(64, 224, 208)',
  'turquoise1': 'rgb(0, 245, 255)',
  'turquoise2': 'rgb(0, 229, 238)',
  'turquoise3': 'rgb(0, 197, 205)',
  'turquoise4': 'rgb(0, 134, 139)',
  'violet': 'rgb(238, 130, 238)',
  'violetred': 'rgb(208, 32, 144)',
  'violetred1': 'rgb(255, 62, 150)',
  'violetred2': 'rgb(238, 58, 140)',
  'violetred3': 'rgb(205, 50, 120)',
  'violetred4': 'rgb(139, 34, 82)',
  'wheat': 'rgb(245, 222, 179)',
  'wheat1': 'rgb(255, 231, 186)',
  'wheat2': 'rgb(238, 216, 174)',
  'wheat3': 'rgb(205, 186, 150)',
  'wheat4': 'rgb(139, 126, 102)',
  'white': 'rgb(255, 255, 255)',
  'whitesmoke': 'rgb(245, 245, 245)',
  'yellow': 'rgb(255, 255, 0)',
  'yellow1': 'rgb(255, 255, 0)',
  'yellow2': 'rgb(238, 238, 0)',
  'yellow3': 'rgb(205, 205, 0)',
  'yellow4': 'rgb(139, 139, 0)',
  'yellowgreen': 'rgb(154, 205, 50)',
};
// SOURCE FILE: libdot/js/lib_f.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Grab bag of utility functions.
 */
lib.f = {};

/**
 * Replace variable references in a string.
 *
 * Variables are of the form %FUNCTION(VARNAME).  FUNCTION is an optional
 * escape function to apply to the value.
 *
 * For example
 *   lib.f.replaceVars("%(greeting), %encodeURIComponent(name)",
 *                     { greeting: "Hello",
 *                       name: "Google+" });
 *
 * Will result in "Hello, Google%2B".
 *
 * @param {string} str String containing variable references.
 * @param {!Object<string, string>} vars Variables to substitute in.
 * @return {string} String with references substituted.
 */
lib.f.replaceVars = function(str, vars) {
  return str.replace(/%([a-z]*)\(([^)]+)\)/gi, function(match, fn, varname) {
      if (typeof vars[varname] == 'undefined') {
        throw new Error(`Unknown variable: ${varname}`);
      }

      let rv = vars[varname];

      if (fn in lib.f.replaceVars.functions) {
        rv = lib.f.replaceVars.functions[fn](rv);
      } else if (fn) {
        throw new Error(`Unknown escape function: ${fn}`);
      }

      return rv;
    });
};

/**
 * Functions that can be used with replaceVars.
 *
 * Clients can add to this list to extend lib.f.replaceVars().
 */
lib.f.replaceVars.functions = {
  encodeURI: encodeURI,
  encodeURIComponent: encodeURIComponent,
  escapeHTML: function(str) {
    const map = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return str.replace(/[<>&"']/g, (m) => map[m]);
  },
};

/**
 * Convert a relative path to a fully qualified URI.
 *
 * @param {string} path Relative path
 * @return {string} Fully qualified URI.
 */
lib.f.getURL = function(path) {
  if (lib.f.getURL.chromeSupported()) {
    return chrome.runtime.getURL(path);
  }

  // Use current location origin if path is absolute.
  if (path.startsWith('/')) {
    return window.location.origin + path;
  }

  return path;
};

/**
 * Determine whether the runtime is Chrome (or equiv).
 *
 * @return {boolean} True if chrome.runtime.getURL is supported.
 */
lib.f.getURL.chromeSupported = function() {
  return !!(window.chrome && chrome.runtime && chrome.runtime.getURL);
};

/**
 * Clamp a given integer to a specified range.
 *
 * @param {number} v The value to be clamped.
 * @param {number} min The minimum acceptable value.
 * @param {number} max The maximum acceptable value.
 * @return {number} The clamped value.
 */
lib.f.clamp = function(v, min, max) {
  if (v < min) {
    return min;
  }
  if (v > max) {
    return max;
  }
  return v;
};

/**
 * Left pad a number to a given length with leading zeros.
 *
 * @param {string|number} number The number to pad.
 * @param {number} length The desired length.
 * @return {string} The padded number as a string.
 */
lib.f.zpad = function(number, length) {
  return String(number).padStart(length, '0');
};

/**
 * Return the current call stack after skipping a given number of frames.
 *
 * This method is intended to be used for debugging only.  It returns an
 * Object instead of an Array, because the console stringifies arrays by
 * default and that's not what we want.
 *
 * A typical call might look like...
 *
 *    console.log('Something wicked this way came', lib.f.getStack());
 *    //                         Notice the comma ^
 *
 * This would print the message to the js console, followed by an object
 * which can be clicked to reveal the stack.
 *
 * @param {number=} ignoreFrames How many inner stack frames to ignore.  The
 *     innermost 'getStack' call is always ignored.
 * @param {number=} count How many frames to return.
 * @return {!Array<string>} The stack frames.
 */
lib.f.getStack = function(ignoreFrames = 0, count = undefined) {
  const stackArray = (new Error()).stack.split('\n');

  // Always ignore the Error() object and getStack call itself.
  // [0] = 'Error'
  // [1] = '    at Object.lib.f.getStack (file:///.../lib_f.js:267:23)'
  ignoreFrames += 2;

  const max = stackArray.length - ignoreFrames;
  if (count === undefined) {
    count = max;
  } else {
    count = lib.f.clamp(count, 0, max);
  }

  // Remove the leading spaces and "at" from each line:
  // '    at window.onload (file:///.../lib_test.js:11:18)'
  const stackObject = new Array();
  for (let i = ignoreFrames; i < count + ignoreFrames; ++i) {
    stackObject.push(stackArray[i].replace(/^\s*at\s+/, ''));
  }

  return stackObject;
};

/**
 * Divides the two numbers and floors the results, unless the remainder is less
 * than an incredibly small value, in which case it returns the ceiling.
 * This is useful when the number are truncated approximations of longer
 * values, and so doing division with these numbers yields a result incredibly
 * close to a whole number.
 *
 * @param {number} numerator
 * @param {number} denominator
 * @return {number}
 */
lib.f.smartFloorDivide = function(numerator, denominator) {
  const val = numerator / denominator;
  const ceiling = Math.ceil(val);
  if (ceiling - val < .0001) {
    return ceiling;
  } else {
    return Math.floor(val);
  }
};

/**
 * Get the current OS.
 *
 * @return {!Promise<string>} A promise that resolves to a constant in
 *     runtime.PlatformOs.
 */
lib.f.getOs = function() {
  // Try the brower extensions API.
  if (window.browser && browser.runtime && browser.runtime.getPlatformInfo) {
    return browser.runtime.getPlatformInfo().then((info) => info.os);
  }

  // Use the native Chrome API if available.
  if (window.chrome && chrome.runtime && chrome.runtime.getPlatformInfo) {
    return new Promise((resolve, reject) => {
      return chrome.runtime.getPlatformInfo((info) => resolve(info.os));
    });
  }

  // Fallback logic.  Capture the major OS's.  The rest should support the
  // browser API above.
  if (window.navigator && navigator.userAgent) {
    const ua = navigator.userAgent;
    if (ua.includes('Mac OS X')) {
      return Promise.resolve('mac');
    } else if (ua.includes('CrOS')) {
      return Promise.resolve('cros');
    } else if (ua.includes('Linux')) {
      return Promise.resolve('linux');
    } else if (ua.includes('Android')) {
      return Promise.resolve('android');
    } else if (ua.includes('Windows')) {
      return Promise.resolve('windows');
    }
  }

  // Probe node environment.
  if (typeof process != 'undefined') {
    return Promise.resolve('node');
  }

  // Still here?  No idea.
  return Promise.reject(null);
};

/**
 * Get the current Chrome milestone version.
 *
 * @return {number} The milestone number if we're running on Chrome, else NaN.
 */
lib.f.getChromeMilestone = function() {
  if (window.navigator && navigator.userAgent) {
    const ary = navigator.userAgent.match(/\sChrome\/(\d+)/);
    if (ary) {
      return parseInt(ary[1], 10);
    }
  }

  // Returning NaN will make all number comparisons fail.
  return NaN;
};

/**
 * Return the lastError string in the browser.
 *
 * This object might live in different locations, and it isn't always defined
 * (if there hasn't been a "last error").  Wrap all that ugliness here.
 *
 * @param {?string=} defaultMsg The default message if no error is found.
 * @return {?string} The last error message from the browser.
 */
lib.f.lastError = function(defaultMsg = null) {
  let lastError;
  if (window.browser && browser.runtime) {
    lastError = browser.runtime.lastError;
  } else if (window.chrome && chrome.runtime) {
    lastError = chrome.runtime.lastError;
  }

  if (lastError && lastError.message) {
    return lastError.message;
  } else {
    return defaultMsg;
  }
};

/**
 * Just like window.open, but enforce noopener.
 *
 * If we're not careful, the website we open will have access to use via its
 * window.opener field.  Newer browser support putting 'noopener' into the
 * features argument, but there are many which still don't.  So hack it.
 *
 * @param {string=} url The URL to point the new window to.
 * @param {string=} name The name of the new window.
 * @param {string=} features The window features to enable.
 * @return {?Window} The newly opened window.
 */
lib.f.openWindow = function(url, name = undefined, features = undefined) {
  // We create the window first without the URL loaded.
  const win = window.open(undefined, name, features);

  // If the system is blocking window.open, don't crash.
  if (win !== null) {
    // Clear the opener setting before redirecting.
    win.opener = null;

    // Now it's safe to redirect.  Skip this step if the url is not set so we
    // mimic the window.open behavior more precisely.
    if (url) {
      win.location = url;
    }
  }

  return win;
};
// SOURCE FILE: libdot/js/lib_i18n.js
// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Wrappers over the browser i18n helpers.
 *
 * Arguably some of these functions should be l10n, but oh well.
 */
lib.i18n = {};

/**
 * Convenience shortcut to the browser i18n object.
 */
lib.i18n.browser_ =
    window.browser && browser.i18n ? browser.i18n :
    window.chrome && chrome.i18n ? chrome.i18n :
    null;

/**
 * Return whether the browser supports i18n natively.
 *
 * @return {boolean} True if browser.i18n or chrome.i18n exists.
 */
lib.i18n.browserSupported = function() {
  return lib.i18n.browser_ !== null;
};

/**
 * Get the list of accepted UI languages.
 *
 * https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/i18n/getAcceptLanguages
 *
 * @return {!Promise<!Array<string>>} Promise resolving to the list of locale
 *     names.
 */
lib.i18n.getAcceptLanguages = function() {
  if (lib.i18n.browser_) {
    return new Promise((resolve) => {
      lib.i18n.browser_.getAcceptLanguages((languages) => {
        // Chrome might be in a bad state and not return any languages.  If we
        // pass this up to the caller who isn't expecting undefined, they'll
        // probably crash.  Fallback to the default language that we expect all
        // translations to have.
        if (!languages) {
          // Clear the error to avoid throwing an unchecked error.
          console.error('getAcceptLanguages failed', lib.f.lastError());
          languages = ['en'];
        }

        resolve(languages);
      });
    });
  } else {
    const languages = navigator.languages || [navigator.language];
    return Promise.resolve(languages);
  }
};

/**
 * Get a message by name, optionally replacing arguments too.
 *
 * https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/i18n/getMessage
 *
 * @param {string} msgname The id for this localized string.
 * @param {?Array<string>=} substitutions Any replacements in the string.
 * @param {string=} fallback Translation if the message wasn't found.
 * @return {string} The translated message.
 */
lib.i18n.getMessage = function(msgname, substitutions = [], fallback = '') {
  // First let the native browser APIs handle everything for us.
  if (lib.i18n.browser_) {
    const message = lib.i18n.browser_.getMessage(msgname, substitutions);
    if (message) {
      return message;
    }
  }

  // Do our best to get something reasonable.
  return lib.i18n.replaceReferences(fallback, substitutions);
};

/**
 * Replace $1...$n references with the elements of the args array.
 *
 * This largely behaves like Chrome's getMessage helper.  The $# references are
 * always replaced/removed regardless of the specified substitutions.
 *
 * @param {string} msg String containing the message and argument references.
 * @param {(?Array<string>|string)=} args Array containing the argument values,
 *     or single value.
 * @return {string} The message with replacements expanded.
 */
lib.i18n.replaceReferences = function(msg, args = []) {
  // The Chrome API allows a single substitution as a string rather than array.
  if (args === null) {
    args = [];
  }
  if (!(args instanceof Array)) {
    args = [args];
  }

  return msg.replace(/\$(\d+)/g, (m, index) => {
    return index <= args.length ? args[index - 1] : '';
  });
};

/**
 * This function aims to copy the chrome.i18n mapping from language to which
 * _locales/<locale>/messages.json translation is used.  E.g. en-AU maps to
 * en_GB.
 * https://cs.chromium.org/chromium/src/ui/base/l10n/l10n_util.cc?type=cs&q=CheckAndResolveLocale
 *
 * @param {string} language language from navigator.languages.
 * @return {!Array<string>} priority list of locales for translation.
 */
lib.i18n.resolveLanguage = function(language) {
  const [lang, region] = language.toLowerCase().split(/[-_]/, 2);

  // Map es-RR other than es-ES to es-419 (Chrome's Latin American
  // Spanish locale).
  if (lang == 'es') {
    if ([undefined, 'es'].includes(region)) {
      return ['es'];
    }
    return ['es_419'];
  }

  // Map pt-RR other than pt-BR to pt-PT. Note that "pt" by itself maps to
  // pt-BR (logic below).
  if (lang == 'pt') {
    if ([undefined, 'br'].includes(region)) {
      return ['pt_BR'];
    }
    return ['pt_PT'];
  }

  // Map zh-HK and zh-MO to zh-TW. Otherwise, zh-FOO is mapped to zh-CN.
  if (lang == 'zh') {
    if (['tw', 'hk', 'mo'].includes(region)) {
      return ['zh_TW'];
    }
    return ['zh_CN'];
  }

  // Map Liberian and Filipino English to US English, and everything else to
  // British English.
  if (lang == 'en') {
    if ([undefined, 'us', 'lr', 'ph'].includes(region)) {
      return ['en'];
    }

    // Our GB translation is not complete, so need to add 'en' as a fallback.
    return ['en_GB', 'en'];
  }

  if (region) {
    return [language.replace(/-/g, '_'), lang];
  } else {
    return [lang];
  }
};
// SOURCE FILE: libdot/js/lib_preference_manager.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Constructor for lib.PreferenceManager objects.
 *
 * These objects deal with persisting changes to stable storage and notifying
 * consumers when preferences change.
 *
 * It is intended that the backing store could be something other than HTML5
 * storage, but there aren't any use cases at the moment.  In the future there
 * may be a chrome api to store sync-able name/value pairs, and we'd want
 * that.
 *
 * @param {!lib.Storage} storage The storage object to use as a backing
 *     store.
 * @param {string=} prefix The optional prefix to be used for all preference
 *     names.  The '/' character should be used to separate levels of hierarchy,
 *     if you're going to have that kind of thing.  If provided, the prefix
 *     should start with a '/'.  If not provided, it defaults to '/'.
 * @constructor
 */
lib.PreferenceManager = function(storage, prefix = '/') {
  this.storage = storage;
  this.storageObserver_ = this.onStorageChange_.bind(this);
  this.storage.addObserver(this.storageObserver_);

  this.trace = false;

  if (!prefix.endsWith('/')) {
    prefix += '/';
  }

  this.prefix = prefix;

  // Internal state for when we're doing a bulk import from JSON and we want
  // to elide redundant storage writes (for quota reasons).
  this.isImportingJson_ = false;

  /** @type {!Object<string, !lib.PreferenceManager.Record>} */
  this.prefRecords_ = {};
  this.globalObservers_ = [];
  this.prefixObservers_ = [];

  this.childFactories_ = {};

  // Map of list-name to {map of child pref managers}
  // As in...
  //
  //  this.childLists_ = {
  //    'profile-ids': {
  //      'one': PreferenceManager,
  //      'two': PreferenceManager,
  //      ...
  //    },
  //
  //    'frob-ids': {
  //      ...
  //    }
  //  }
  this.childLists_ = {};
};

/**
 * Used internally to indicate that the current value of the preference should
 * be taken from the default value defined with the preference.
 *
 * Equality tests against this value MUST use '===' or '!==' to be accurate.
 *
 * @type {symbol}
 */
lib.PreferenceManager.prototype.DEFAULT_VALUE = Symbol('DEFAULT_VALUE');

/**
 * An individual preference.
 *
 * These objects are managed by the PreferenceManager, you shouldn't need to
 * handle them directly.
 *
 * @param {string} name The name of the new preference (used for indexing).
 * @param {*} defaultValue The default value for this preference.
 * @constructor
 */
lib.PreferenceManager.Record = function(name, defaultValue) {
  this.name = name;
  this.defaultValue = defaultValue;
  this.currentValue = this.DEFAULT_VALUE;
  this.observers = [];
};

/**
 * A local copy of the DEFAULT_VALUE constant to make it less verbose.
 *
 * @type {symbol}
 */
lib.PreferenceManager.Record.prototype.DEFAULT_VALUE =
    lib.PreferenceManager.prototype.DEFAULT_VALUE;

/**
 * Register a callback to be invoked when this preference changes.
 *
 * @param {function(string, string, !lib.PreferenceManager)} observer The
 *     function to invoke.  It will receive the new value, the name of the
 *     preference, and a reference to the PreferenceManager as parameters.
 */
lib.PreferenceManager.Record.prototype.addObserver = function(observer) {
  this.observers.push(observer);
};

/**
 * Unregister an observer callback.
 *
 * @param {function(string, string, !lib.PreferenceManager)} observer A
 *     previously registered callback.
 */
lib.PreferenceManager.Record.prototype.removeObserver = function(observer) {
  const i = this.observers.indexOf(observer);
  if (i >= 0) {
    this.observers.splice(i, 1);
  }
};

/**
 * Fetch the value of this preference.
 *
 * @return {*} The value for this preference.
 */
lib.PreferenceManager.Record.prototype.get = function() {
  const result = this.currentValue === this.DEFAULT_VALUE ?
      this.defaultValue : this.currentValue;

  if (typeof this.defaultValue === 'object') {
    // We want to return a COPY of the value so that users can
    // modify the array or object without changing the value.
    return JSON.parse(JSON.stringify(result));
  }

  return result;
};

/**
 * Update prefix and reset and reload storage, then notify prefix observers, and
 * all pref observers with new values.
 *
 * @param {string} prefix
 * @param {function()=} callback Optional function to invoke when completed.
 */
lib.PreferenceManager.prototype.setPrefix = function(prefix, callback) {
  if (!prefix.endsWith('/')) {
    prefix += '/';
  }
  if (prefix === this.prefix) {
    if (callback) {
      callback();
    }
    return;
  }

  this.prefix = prefix;

  for (const name in this.prefRecords_) {
    this.prefRecords_[name].currentValue = this.DEFAULT_VALUE;
  }

  this.readStorage(() => {
    for (const o of this.prefixObservers_) {
      o(this.prefix, this);
    }
    this.notifyAll();
    if (callback) {
      callback();
    }
  });
};

/**
 * Read the backing storage for these preferences.
 *
 * You should do this once at initialization time to prime the local cache
 * of preference values.  The preference manager will monitor the backing
 * storage for changes, so you should not need to call this more than once.
 *
 * This function recursively reads storage for all child preference managers as
 * well.
 *
 * This function is asynchronous, if you need to read preference values, you
 * *must* wait for the callback.
 *
 * @param {function()=} callback Optional function to invoke when the read
 *     has completed.
 */
lib.PreferenceManager.prototype.readStorage = function(callback = undefined) {
  let pendingChildren = 0;

  function onChildComplete() {
    if (--pendingChildren == 0 && callback) {
      callback();
    }
  }

  const keys = Object.keys(this.prefRecords_).map((el) => this.prefix + el);

  if (this.trace) {
    console.log('Preferences read: ' + this.prefix);
  }

  this.storage.getItems(keys).then((items) => {
      const prefixLength = this.prefix.length;

      for (const key in items) {
        const value = items[key];
        const name = key.substr(prefixLength);
        const needSync = (
            name in this.childLists_ &&
            (JSON.stringify(value) !=
             JSON.stringify(this.prefRecords_[name].currentValue)));

        this.prefRecords_[name].currentValue = value;

        if (needSync) {
          pendingChildren++;
          this.syncChildList(name, onChildComplete);
        }
      }

      if (pendingChildren == 0 && callback) {
        setTimeout(callback);
      }
    });
};

/**
 * Define a preference.
 *
 * This registers a name, default value, and onChange handler for a preference.
 *
 * @param {string} name The name of the preference.  This will be prefixed by
 *     the prefix of this PreferenceManager before written to local storage.
 * @param {string|number|boolean|!Object|!Array|null} value The default value of
 *     this preference.  Anything that can be represented in JSON is a valid
 *     default value.
 * @param {function(*, string, !lib.PreferenceManager)=} onChange A
 *     function to invoke when the preference changes.  It will receive the new
 *     value, the name of the preference, and a reference to the
 *     PreferenceManager as parameters.
 */
lib.PreferenceManager.prototype.definePreference = function(
    name, value, onChange = undefined) {

  let record = this.prefRecords_[name];
  if (record) {
    this.changeDefault(name, value);
  } else {
    record = this.prefRecords_[name] =
        new lib.PreferenceManager.Record(name, value);
  }

  if (onChange) {
    record.addObserver(onChange);
  }
};

/**
 * Define multiple preferences with a single function call.
 *
 * @param {!Array<*>} defaults An array of 3-element arrays.  Each three element
 *     array should contain the [key, value, onChange] parameters for a
 *     preference.
 */
lib.PreferenceManager.prototype.definePreferences = function(defaults) {
  for (let i = 0; i < defaults.length; i++) {
    this.definePreference(defaults[i][0], defaults[i][1], defaults[i][2]);
  }
};

/**
 * Register a callback to be invoked when PreferenceManager prefix changes.
 *
 * @param {function(string, !lib.PreferenceManager)} observer The
 *     function to invoke.  It will receive the new prefix, and a reference
 *     to the PreferenceManager as parameters.
 */
lib.PreferenceManager.prototype.addPrefixObserver = function(observer) {
  this.prefixObservers_.push(observer);
};

/**
 * Unregister an observer callback.
 *
 * @param {function(string, !lib.PreferenceManager)} observer A
 *     previously registered callback.
 */
lib.PreferenceManager.prototype.removePrefixObserver = function(observer) {
  const i = this.prefixObservers_.indexOf(observer);
  if (i >= 0) {
    this.prefixObservers_.splice(i, 1);
  }
};

/**
 * Register to observe preference changes.
 *
 * @param {string} name The name of preference you wish to observe..
 * @param {function(*, string, !lib.PreferenceManager)} observer The callback.
 */
lib.PreferenceManager.prototype.addObserver = function(name, observer) {
  if (!(name in this.prefRecords_)) {
    throw new Error(`Unknown preference: ${name}`);
  }

  this.prefRecords_[name].addObserver(observer);
};

/**
 * Register to observe preference changes.
 *
 * @param {?function()} global A callback that will happen for every preference.
 *     Pass null if you don't need one.
 * @param {!Object} map A map of preference specific callbacks.  Pass null if
 *     you don't need any.
 */
lib.PreferenceManager.prototype.addObservers = function(global, map) {
  if (global && typeof global != 'function') {
    throw new Error('Invalid param: globals');
  }

  if (global) {
    this.globalObservers_.push(global);
  }

  if (!map) {
    return;
  }

  for (const name in map) {
    this.addObserver(name, map[name]);
  }
};

/**
 * Remove preference observer.
 *
 * @param {string} name The name of preference you wish to stop observing.
 * @param {function(*, string, !lib.PreferenceManager)} observer The observer to
 *     remove.
 */
lib.PreferenceManager.prototype.removeObserver = function(name, observer) {
  if (!(name in this.prefRecords_)) {
    throw new Error(`Unknown preference: ${name}`);
  }

  this.prefRecords_[name].removeObserver(observer);
};

/**
 * Dispatch the change observers for all known preferences.
 *
 * It may be useful to call this after readStorage completes, in order to
 * get application state in sync with user preferences.
 *
 * This can be used if you've changed a preference manager out from under
 * a live object, for example when switching to a different prefix.
 */
lib.PreferenceManager.prototype.notifyAll = function() {
  for (const name in this.prefRecords_) {
    this.notifyChange_(name);
  }
};

/**
 * Notify the change observers for a given preference.
 *
 * @param {string} name The name of the preference that changed.
 */
lib.PreferenceManager.prototype.notifyChange_ = function(name) {
  const record = this.prefRecords_[name];
  if (!record) {
    throw new Error('Unknown preference: ' + name);
  }

  const currentValue = record.get();

  for (let i = 0; i < this.globalObservers_.length; i++) {
    this.globalObservers_[i](name, currentValue);
  }

  for (let i = 0; i < record.observers.length; i++) {
    record.observers[i](currentValue, name, this);
  }
};

/**
 * Remove a child preferences instance.
 *
 * Removes a child preference manager and clears any preferences stored in it.
 *
 * @param {string} listName The name of the child list containing the child to
 *     remove.
 * @param {string} id The child ID.
 */
lib.PreferenceManager.prototype.removeChild = function(listName, id) {
  const prefs = this.getChild(listName, id);
  prefs.resetAll();

  const ids = /** @type {!Array<string>} */ (this.get(listName));
  const i = ids.indexOf(id);
  if (i != -1) {
    ids.splice(i, 1);
    this.set(listName, ids, undefined, !this.isImportingJson_);
  }

  delete this.childLists_[listName][id];
};

/**
 * Return a child PreferenceManager instance for a given id.
 *
 * If the child list or child id is not known this will return the specified
 * default value or throw an exception if no default value is provided.
 *
 * @param {string} listName The child list to look in.
 * @param {string} id The child ID.
 * @param {!lib.PreferenceManager=} defaultValue The value to return if the
 *     child is not found.
 * @return {!lib.PreferenceManager} The specified child PreferenceManager.
 */
lib.PreferenceManager.prototype.getChild = function(
    listName, id, defaultValue = undefined) {
  if (!(listName in this.childLists_)) {
    throw new Error('Unknown child list: ' + listName);
  }

  const childList = this.childLists_[listName];
  if (!(id in childList)) {
    if (defaultValue === undefined) {
      throw new Error('Unknown "' + listName + '" child: ' + id);
    }

    return defaultValue;
  }

  return childList[id];
};

/**
 * Reset a preference to its default state.
 *
 * This will dispatch the onChange handler if the preference value actually
 * changes.
 *
 * @param {string} name The preference to reset.
 */
lib.PreferenceManager.prototype.reset = function(name) {
  const record = this.prefRecords_[name];
  if (!record) {
    throw new Error('Unknown preference: ' + name);
  }

  this.storage.removeItem(this.prefix + name);

  if (record.currentValue !== this.DEFAULT_VALUE) {
    record.currentValue = this.DEFAULT_VALUE;
    this.notifyChange_(name);
  }
};

/**
 * Reset all preferences back to their default state.
 */
lib.PreferenceManager.prototype.resetAll = function() {
  const changed = [];

  for (const listName in this.childLists_) {
    const childList = this.childLists_[listName];
    for (const id in childList) {
      childList[id].resetAll();
    }
  }

  for (const name in this.prefRecords_) {
    if (this.prefRecords_[name].currentValue !== this.DEFAULT_VALUE) {
      this.prefRecords_[name].currentValue = this.DEFAULT_VALUE;
      changed.push(name);
    }
  }

  const keys = Object.keys(this.prefRecords_).map(function(el) {
      return this.prefix + el;
  }.bind(this));

  this.storage.removeItems(keys);

  changed.forEach(this.notifyChange_.bind(this));
};

/**
 * Return true if two values should be considered not-equal.
 *
 * If both values are the same scalar type and compare equal this function
 * returns false (no difference), otherwise return true.
 *
 * This is used in places where we want to check if a preference has changed.
 * Compare complex values (objects or arrays) using JSON serialization. Objects
 * with more than a single primitive property may not have the same JSON
 * serialization, but for our purposes with default objects, this is OK.
 *
 * @param {*} a A value to compare.
 * @param {*} b A value to compare.
 * @return {boolean} Whether the two are not equal.
 */
lib.PreferenceManager.prototype.diff = function(a, b) {
  // If the types are different.
  if ((typeof a) !== (typeof b)) {
    return true;
  }

  // Or if the type is not a simple primitive one.
  if (!(/^(undefined|boolean|number|string)$/.test(typeof a))) {
    // Special case the null object.
    if (a === null && b === null) {
      return false;
    } else {
      return JSON.stringify(a) !== JSON.stringify(b);
    }
  }

  // Do a normal compare for primitive types.
  return a !== b;
};

/**
 * Change the default value of a preference.
 *
 * This is useful when subclassing preference managers.
 *
 * The function does not alter the current value of the preference, unless
 * it has the old default value.  When that happens, the change observers
 * will be notified.
 *
 * @param {string} name The name of the parameter to change.
 * @param {*} newValue The new default value for the preference.
 */
lib.PreferenceManager.prototype.changeDefault = function(name, newValue) {
  const record = this.prefRecords_[name];
  if (!record) {
    throw new Error('Unknown preference: ' + name);
  }

  if (!this.diff(record.defaultValue, newValue)) {
    // Default value hasn't changed.
    return;
  }

  if (record.currentValue !== this.DEFAULT_VALUE) {
    // This pref has a specific value, just change the default and we're done.
    record.defaultValue = newValue;
    return;
  }

  record.defaultValue = newValue;

  this.notifyChange_(name);
};

/**
 * Change the default value of multiple preferences.
 *
 * @param {!Object} map A map of name -> value pairs specifying the new default
 *     values.
 */
lib.PreferenceManager.prototype.changeDefaults = function(map) {
  for (const key in map) {
    this.changeDefault(key, map[key]);
  }
};

/**
 * Set a preference to a specific value.
 *
 * This will dispatch the onChange handler if the preference value actually
 * changes.
 *
 * @param {string} name The preference to set.
 * @param {*} newValue The value to set.  Anything that can be represented in
 *     JSON is a valid value.
 * @param {function()=} onComplete Callback when the set call completes.
 * @param {boolean=} saveToStorage Whether to commit the change to the backing
 *     storage or only the in-memory record copy.
 * @return {!Promise<void>} Promise which resolves once all observers are
 *     notified.
 */
lib.PreferenceManager.prototype.set = function(
    name, newValue, onComplete = undefined, saveToStorage = true) {
  const record = this.prefRecords_[name];
  if (!record) {
    throw new Error('Unknown preference: ' + name);
  }

  const oldValue = record.get();

  if (!this.diff(oldValue, newValue)) {
    return Promise.resolve();
  }

  if (this.diff(record.defaultValue, newValue)) {
    record.currentValue = newValue;
    if (saveToStorage) {
      this.storage.setItem(this.prefix + name, newValue).then(onComplete);
    }
  } else {
    record.currentValue = this.DEFAULT_VALUE;
    if (saveToStorage) {
      this.storage.removeItem(this.prefix + name).then(onComplete);
    }
  }

  // We need to manually send out the notification on this instance.  If we
  // The storage event won't fire a notification because we've already changed
  // the currentValue, so it won't see a difference.  If we delayed changing
  // currentValue until the storage event, a pref read immediately after a write
  // would return the previous value.
  //
  // The notification is async so clients don't accidentally depend on
  // a synchronous notification.
  return Promise.resolve().then(() => {
    this.notifyChange_(name);
  });
};

/**
 * Get the value of a preference.
 *
 * @param {string} name The preference to get.
 * @return {*} The preference's value.
 */
lib.PreferenceManager.prototype.get = function(name) {
  const record = this.prefRecords_[name];
  if (!record) {
    throw new Error('Unknown preference: ' + name);
  }

  return record.get();
};

/**
 * Get the default value of a preference.
 *
 * @param {string} name The preference to get.
 * @return {*} The preference's default value.
 */
lib.PreferenceManager.prototype.getDefault = function(name) {
  const record = this.prefRecords_[name];
  if (!record) {
    throw new Error(`Unknown preference: ${name}`);
  }

  return record.defaultValue;
};

/**
 * Get the boolean value of a preference.
 *
 * @param {string} name The preference to get.
 * @return {boolean}
 */
lib.PreferenceManager.prototype.getBoolean = function(name) {
  const result = this.get(name);
  lib.assert(typeof result == 'boolean');
  return result;
};

/**
 * Get the number value of a preference.
 *
 * @param {string} name The preference to get.
 * @return {number}
 */
lib.PreferenceManager.prototype.getNumber = function(name) {
  const result = this.get(name);
  lib.assert(typeof result == 'number');
  return result;
};

/**
 * Get the string value of a preference.
 *
 * @param {string} name The preference to get.
 * @return {string}
 */
lib.PreferenceManager.prototype.getString = function(name) {
  const result = this.get(name);
  lib.assert(typeof result == 'string');
  return result;
};

/**
 * Called when a key in the storage changes.
 *
 * @param {!Object} map Dictionary of changed settings.
 */
lib.PreferenceManager.prototype.onStorageChange_ = function(map) {
  for (const key in map) {
    if (this.prefix) {
      if (key.lastIndexOf(this.prefix, 0) != 0) {
        continue;
      }
    }

    const name = key.substr(this.prefix.length);

    if (!(name in this.prefRecords_)) {
      // Sometimes we'll get notified about prefs that are no longer defined.
      continue;
    }

    const record = this.prefRecords_[name];

    const newValue = map[key].newValue;
    let currentValue = record.currentValue;
    if (currentValue === record.DEFAULT_VALUE) {
      currentValue = undefined;
    }

    if (this.diff(currentValue, newValue)) {
      if (typeof newValue == 'undefined' || newValue === null) {
        record.currentValue = record.DEFAULT_VALUE;
      } else {
        record.currentValue = newValue;
      }

      this.notifyChange_(name);
    }
  }
};
// SOURCE FILE: libdot/js/lib_resource.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Storage for canned resources.
 *
 * These are usually non-JavaScript things that are collected during a build
 * step and converted into a series of 'lib.resource.add(...)' calls.  See
 * the "@resource" directive from libdot/bin/concat for the canonical use
 * case.
 *
 * This is global storage, so you should prefix your resource names to avoid
 * collisions.
 */
lib.resource = {
  resources_: {},
};

/** @typedef {{type: string, name: string, data: *}} */
lib.resource.ResourceRecord;

/**
 * Add a resource.
 *
 * @param {string} name A name for the resource.  You should prefix this to
 *     avoid collisions with resources from a shared library.
 * @param {string} type A mime type for the resource, or "raw" if not
 *     applicable.
 * @param {*} data The value of the resource.
 */
lib.resource.add = function(name, type, data) {
  lib.resource.resources_[name] = {
    type: type,
    name: name,
    data: data,
  };
};

/**
 * Retrieve a resource record.
 *
 * The resource data is stored on the "data" property of the returned object.
 *
 * @param {string} name The name of the resource to get.
 * @param {!lib.resource.ResourceRecord=} defaultValue The value to return if
 *     the resource is not defined.
 * @return {!lib.resource.ResourceRecord} The matching resource if it exists.
 */
lib.resource.get = function(name, defaultValue) {
  if (!(name in lib.resource.resources_)) {
    lib.assert(defaultValue !== undefined);
    return defaultValue;
  }

  return lib.resource.resources_[name];
};

/**
 * @param {string} name The name of the resource to get.
 * @return {string} The resource data.
 */
lib.resource.getText = function(name) {
  const resource = lib.resource.resources_[name];
  if (resource === undefined) {
    throw new Error(`Error: Resource "${name}" does not exist`);
  }
  if (!resource.type.startsWith('text/') &&
      !resource.type.startsWith('image/svg')) {
    throw new Error(`Error: Resource "${name}" is not of type string`);
  }

  return String(lib.resource.resources_[name].data);
};

/**
 * Retrieve resource data.
 *
 * @param {string} name The name of the resource to get.
 * @param {*=} defaultValue The value to return if the resource is not defined.
 * @return {*} The resource data.
 */
lib.resource.getData = function(name, defaultValue) {
  if (!(name in lib.resource.resources_)) {
    return defaultValue;
  }

  return lib.resource.resources_[name].data;
};

/**
 * Retrieve resource as a data: url.
 *
 * @param {string} name The name of the resource to get.
 * @param {!lib.resource.ResourceRecord=} defaultValue The value to return if
 *     the resource is not defined.
 * @return {string} A data: url encoded version of the resource.
 */
lib.resource.getDataUrl = function(name, defaultValue) {
  const resource = lib.resource.get(name, defaultValue);
  return 'data:' + resource.type + ',' + resource.data;
};
// SOURCE FILE: libdot/js/lib_storage.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Namespace for implementations of persistent, possibly cloud-backed
 * storage.
 *
 * @interface
 */
lib.Storage = function() {};

/**
 * Register a function to observe storage changes.
 *
 * @param {function(!Object<string, !StorageChange>)} callback The function to
 *     invoke when the storage changes.
 */
lib.Storage.prototype.addObserver = function(callback) {};

/**
 * Unregister a change observer.
 *
 * @param {function(!Object<string, !StorageChange>)} callback A previously
 *     registered callback.
 */
lib.Storage.prototype.removeObserver = function(callback) {};

/**
 * Delete everything in this storage.
 */
lib.Storage.prototype.clear = async function() {};

/**
 * Return the current value of a storage item.
 *
 * @param {string} key The key to look up.
 * @return {!Promise<*>} A promise resolving to the requested item.
 */
lib.Storage.prototype.getItem = async function(key) {};

/**
 * Fetch the values of multiple storage items.
 *
 * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
 * @return {!Promise<!Object<string, *>>} A promise resolving to the requested
 *     items.
 */
lib.Storage.prototype.getItems = async function(keys) {};

/**
 * Set a value in storage.
 *
 * You don't have to wait for the set to complete in order to read the value
 * since the local cache is updated synchronously.
 *
 * @param {string} key The key for the value to be stored.
 * @param {*} value The value to be stored.  Anything that can be serialized
 *     with JSON is acceptable.
 */
lib.Storage.prototype.setItem = async function(key, value) {};

/**
 * Set multiple values in storage.
 *
 * You don't have to wait for the set to complete in order to read the value
 * since the local cache is updated synchronously.
 *
 * @param {!Object} obj A map of key/values to set in storage.
 */
lib.Storage.prototype.setItems = async function(obj) {};

/**
 * Remove an item from storage.
 *
 * @param {string} key The key to be removed.
 */
lib.Storage.prototype.removeItem = async function(key) {};

/**
 * Remove multiple items from storage.
 *
 * @param {!Array<string>} keys The keys to be removed.
 */
lib.Storage.prototype.removeItems = async function(keys) {};

/**
 * Create the set of changes between two states.
 *
 * This is used to synthesize the equivalent of Chrome's StorageEvent for use
 * by our stub APIs and testsuites.  We expect Chrome's StorageEvent to also
 * match the web's Storage API & window.onstorage events.
 *
 * @param {!Object<string, *>} oldStorage The old storage state.
 * @param {!Object<string, *>} newStorage The new storage state.
 * @return {!Object<string, {oldValue: ?, newValue: ?}>} The changes.
 */
lib.Storage.generateStorageChanges = function(oldStorage, newStorage) {
  const changes = {};

  // See what's changed.
  for (const key in newStorage) {
    const newValue = newStorage[key];
    if (oldStorage.hasOwnProperty(key)) {
      // Key has been updated.
      const oldValue = oldStorage[key];
      if (oldValue !== newValue) {
        changes[key] = {oldValue, newValue};
      }
    } else {
      // Key has been added.
      changes[key] = {newValue};
    }
  }

  // See what's deleted.
  for (const key in oldStorage) {
    if (!newStorage.hasOwnProperty(key)) {
      changes[key] = {oldValue: oldStorage[key]};
    }
  }

  return changes;
};
// SOURCE FILE: libdot/js/lib_storage_memory.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * In-memory storage class with an async interface that is interchangeable with
 * other lib.Storage.* implementations.
 *
 * @constructor
 * @implements {lib.Storage}
 */
lib.Storage.Memory = function() {
  this.observers_ = [];
  this.storage_ = {};
};

/**
 * Register a function to observe storage changes.
 *
 * @param {function(!Object)} callback The function to invoke when the storage
 *     changes.
 * @override
 */
lib.Storage.Memory.prototype.addObserver = function(callback) {
  this.observers_.push(callback);
};

/**
 * Unregister a change observer.
 *
 * @param {function(!Object)} callback A previously registered callback.
 * @override
 */
lib.Storage.Memory.prototype.removeObserver = function(callback) {
  const i = this.observers_.indexOf(callback);
  if (i != -1) {
    this.observers_.splice(i, 1);
  }
};

/**
 * Update the internal storage state and generate change events for it.
 *
 * @param {!Object<string, *>} newStorage
 */
lib.Storage.Memory.prototype.update_ = async function(newStorage) {
  const changes = lib.Storage.generateStorageChanges(this.storage_, newStorage);
  this.storage_ = newStorage;

  // Force deferment for the standard API.
  await 0;

  // Don't bother notifying if there are no changes.
  if (Object.keys(changes).length) {
    this.observers_.forEach((o) => o(changes));
  }
};

/**
 * Delete everything in this storage.
 *
 * @override
 */
lib.Storage.Memory.prototype.clear = async function() {
  return this.update_({});
};

/**
 * Return the current value of a storage item.
 *
 * @param {string} key The key to look up.
 * @override
 */
lib.Storage.Memory.prototype.getItem = async function(key) {
  return this.getItems([key]).then((items) => items[key]);
};

/**
 * Fetch the values of multiple storage items.
 *
 * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
 * @override
 */
lib.Storage.Memory.prototype.getItems = async function(keys) {
  const rv = {};
  if (!keys) {
    keys = Object.keys(this.storage_);
  }

  keys.forEach((key) => {
    if (this.storage_.hasOwnProperty(key)) {
      rv[key] = this.storage_[key];
    }
  });

  // Force deferment for the standard API.
  await 0;

  return rv;
};

/**
 * Set a value in storage.
 *
 * @param {string} key The key for the value to be stored.
 * @param {*} value The value to be stored.  Anything that can be serialized
 *     with JSON is acceptable.
 * @override
 */
lib.Storage.Memory.prototype.setItem = async function(key, value) {
  return this.setItems({[key]: value});
};

/**
 * Set multiple values in storage.
 *
 * @param {!Object} obj A map of key/values to set in storage.
 * @override
 */
lib.Storage.Memory.prototype.setItems = async function(obj) {
  const newStorage = Object.assign({}, this.storage_);
  for (const key in obj) {
    // Normalize through JSON to mimic Local/Chrome backends.
    newStorage[key] = JSON.parse(JSON.stringify(obj[key]));
  }
  return this.update_(newStorage);
};

/**
 * Remove an item from storage.
 *
 * @param {string} key The key to be removed.
 * @override
 */
lib.Storage.Memory.prototype.removeItem = async function(key) {
  return this.removeItems([key]);
};

/**
 * Remove multiple items from storage.
 *
 * @param {!Array<string>} keys The keys to be removed.
 * @override
 */
lib.Storage.Memory.prototype.removeItems = async function(keys) {
  const newStorage = Object.assign({}, this.storage_);
  keys.forEach((key) => delete newStorage[key]);
  return this.update_(newStorage);
};
// SOURCE FILE: libdot/third_party/intl-segmenter/intl-segmenter.js
// Rough polyfill for Intl.Segmenter proposal
//
// https://github.com/tc39/proposal-intl-segmenter/blob/HEAD/README.md
//
// Caveats and Limitations
//  * granularity: 'line': 'strictness' option is not supported (ignored)
//  * In Chrome, uses v8BreakIterator
//  * Otherwise, uses very simplistic rules
//    * Ignores locale; only "usable" on English
//    * granularity: 'grapheme' does not understand combining characters
//    * granularity: 'sentence' does not understand decimals

(function(global) {
  if ('Intl' in global && 'Segmenter' in global.Intl) {
    return;
  }

  global.Intl = global.Intl || {};

  const GRANULARITIES = ['grapheme', 'word', 'sentence', 'line'];

  // TODO: Implement https://www.unicode.org/reports/tr29/
  const RULES = {
    grapheme: {
      grapheme: /^(.|\n)/,
    },
    word: {
      letter: /^[a-z](?:'?[a-z])*/i,
      number: /^\d+([,.]\d+)*/,
    },
    sentence: {
      terminator: /^[^.?!\r\n]+[.?!]+[\r\n]?/,
      separator: /^[^.?!\r\n]+[\r\n]?/,
    },
    line: {
      hard: /^\S*[\r\n]/,
      soft: /^\S*\s*/,
    },
  };

  // Work around bug in v8BreakIterator where ICU's UWordBreak enum is
  // used even if granularity is not "word". See the code in
  // Runtime_BreakIteratorBreakType in runtime/runtime-i18n.cc for
  // details.
  function fixBreakType(value, granularity) {
    // Undo the mapping of UWordBreak to string
    const ruleStatus = {
      none: 0, // UBRK_WORD_NONE
      number: 100, // UBRK_WORD_NUMBER
      letter: 200, // UBRK_WORD_LETTER
      kana: 300, // UBRK_WORD_KANA
      ideo: 400, // UBRK_WORD_IDEO
      unknown: -1,
    }[value] || 0;


    switch (granularity) {
    case 'character':
      return undefined;
    case 'word':
      return value;
    case 'sentence':
      // Map ULineBreakTag rule status to string.
      return {
        0: 'terminator',
        100: 'separator',
      }[ruleStatus] || value;
    case 'line':
      // Map ULineBreakTag rule status to string.
      return {
        0: 'soft',
        100: 'hard',
      }[ruleStatus] || value;
    default:
      return value;
    }
  }

  function segment(locale, granularity, string) {
    const breaks = [];
    if ('v8BreakIterator' in global.Intl) {
      if (granularity === 'grapheme') {
        granularity = 'character';
      }
      const vbi = new global.Intl.v8BreakIterator(locale, {type: granularity});
      vbi.adoptText(string);
      let last = 0;
      let pos = vbi.next();
      while (pos !== -1) {
        breaks.push({
          pos: vbi.current(),
          segment: string.slice(last, pos),
          breakType: fixBreakType(vbi.breakType(), granularity),
        });
        last = pos;
        pos = vbi.next();
      }
    } else {
      const rules = RULES[granularity];
      let pos = 0;
      while (pos < string.length) {
        let found = false;
        for (const rule of Object.keys(rules)) {
          const re = rules[rule];
          const m = string.slice(pos).match(re);
          if (m) {
            pos += m[0].length;
            breaks.push({
              pos: pos,
              segment: m[0],
              breakType: granularity === 'grapheme' ? undefined : rule,
            });
            found = true;
            break;
          }
        }
        if (!found) {
          breaks.push({
            pos: pos + 1,
            segment: string.slice(pos, ++pos),
            breakType: 'none',
          });
        }
      }
    }
    return breaks;
  }

  class $SegmentIterator$ {
    constructor(string, breaks) {
      this._cur = -1;
      this._type = undefined;
      this._breaks = breaks;
    }

    [Symbol.iterator]() {
      return this;
    }

    next() {
      if (this._cur < this._breaks.length) {
        ++this._cur;
      }

      if (this._cur >= this._breaks.length) {
        this._type = undefined;
        return {done: true, value: undefined};
      }

      this._type = this._breaks[this._cur].breakType;
      return {
        done: false,
        value: {
          segment: this._breaks[this._cur].segment,
          breakType: this._breaks[this._cur].breakType,
        },
      };
    }

    following(index = undefined) {
      if (!this._breaks.length) {
        return true;
      }
      if (index === undefined) {
        if (this._cur < this._breaks.length) {
          ++this._cur;
        }
      } else {
        // TODO: binary search
        for (this._cur = 0;
             this._cur < this._breaks.length
             && this._breaks[this._cur].pos < index;
             ++this._cur) { /* TODO */ }
      }

      this._type = this._cur < this._breaks.length
        ? this._breaks[this._cur].breakType : undefined;
      return this._cur + 1 >= this._breaks.length;
    }

    preceding(index = undefined) {
      if (!this._breaks.length) {
        return true;
      }
      if (index === undefined) {
        if (this._cur >= this._breaks.length) {
          --this._cur;
        }
        if (this._cur >= 0) {
          --this._cur;
        }
      } else {
        // TODO: binary search
        for (this._cur = this._breaks.length - 1;
             this._cur >= 0
             && this._breaks[this._cur].pos >= index;
             --this._cur) { /* TODO */ }
      }

      this._type =
        this._cur + 1 >= this._breaks.length ? undefined :
        this._breaks[this._cur + 1].breakType;
      return this._cur < 0;
    }

    get position() {
      if (this._cur < 0 || !this._breaks.length) {
        return 0;
      }
      if (this._cur >= this._breaks.length) {
        return this._breaks[this._breaks.length - 1].pos;
      }
      return this._breaks[this._cur].pos;
    }

    get breakType() {
      return this._type;
    }
  }

  global.Intl.Segmenter = class Segmenter {
    constructor(locale, {localeMatcher, granularity = 'grapheme'} = {}) {
      this._locale = Array.isArray(locale)
        ? locale.map((s) => String(s)) : String(locale || navigator.language);
      this._granularity = GRANULARITIES.includes(granularity)
        ? granularity : 'grapheme';
    }

    segment(string) {
      return new $SegmentIterator$(
        string, segment(this._locale, this._granularity, string));
    }
  };
}(typeof window !== 'undefined' ?
      window :
      (typeof global !== 'undefined' ? global : this)));
// SOURCE FILE: libdot/third_party/wcwidth/lib_wc.js
// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of lib.wc source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview
 * This JavaScript library is ported from the wcwidth.js module of node.js.
 * The original implementation can be found at:
 * https://npmjs.org/package/wcwidth.js
 */

/**
 * JavaScript porting of Markus Kuhn's wcwidth() implementation
 *
 * The following explanation comes from the original C implementation:
 *
 * This is an implementation of wcwidth() and wcswidth() (defined in
 * IEEE Std 1002.1-2001) for Unicode.
 *
 * https://www.opengroup.org/onlinepubs/007904975/functions/wcwidth.html
 * https://www.opengroup.org/onlinepubs/007904975/functions/wcswidth.html
 *
 * In fixed-width output devices, Latin characters all occupy a single
 * "cell" position of equal width, whereas ideographic CJK characters
 * occupy two such cells. Interoperability between terminal-line
 * applications and (teletype-style) character terminals using the
 * UTF-8 encoding requires agreement on which character should advance
 * the cursor by how many cell positions. No established formal
 * standards exist at present on which Unicode character shall occupy
 * how many cell positions on character terminals. These routines are
 * a first attempt of defining such behavior based on simple rules
 * applied to data provided by the Unicode Consortium.
 *
 * For some graphical characters, the Unicode standard explicitly
 * defines a character-cell width via the definition of the East Asian
 * FullWidth (F), Wide (W), Half-width (H), and Narrow (Na) classes.
 * In all these cases, there is no ambiguity about which width a
 * terminal shall use. For characters in the East Asian Ambiguous (A)
 * class, the width choice depends purely on a preference of backward
 * compatibility with either historic CJK or Western practice.
 * Choosing single-width for these characters is easy to justify as
 * the appropriate long-term solution, as the CJK practice of
 * displaying these characters as double-width comes from historic
 * implementation simplicity (8-bit encoded characters were displayed
 * single-width and 16-bit ones double-width, even for Greek,
 * Cyrillic, etc.) and not any typographic considerations.
 *
 * Much less clear is the choice of width for the Not East Asian
 * (Neutral) class. Existing practice does not dictate a width for any
 * of these characters. It would nevertheless make sense
 * typographically to allocate two character cells to characters such
 * as for instance EM SPACE or VOLUME INTEGRAL, which cannot be
 * represented adequately with a single-width glyph. The following
 * routines at present merely assign a single-cell width to all
 * neutral characters, in the interest of simplicity. This is not
 * entirely satisfactory and should be reconsidered before
 * establishing a formal standard in lib.wc area. At the moment, the
 * decision which Not East Asian (Neutral) characters should be
 * represented by double-width glyphs cannot yet be answered by
 * applying a simple rule from the Unicode database content. Setting
 * up a proper standard for the behavior of UTF-8 character terminals
 * will require a careful analysis not only of each Unicode character,
 * but also of each presentation form, something the author of these
 * routines has avoided to do so far.
 *
 * https://www.unicode.org/unicode/reports/tr11/
 *
 * Markus Kuhn -- 2007-05-26 (Unicode 5.0)
 *
 * Permission to use, copy, modify, and distribute lib.wc software
 * for any purpose and without fee is hereby granted. The author
 * disclaims all warranties with regard to lib.wc software.
 *
 * Latest version: https://www.cl.cam.ac.uk/~mgk25/ucs/wcwidth.c
 */

/**
 * The following function defines the column width of an ISO 10646 character
 * as follows:
 *
 *  - The null character (U+0000) has a column width of 0.
 *  - Other C0/C1 control characters and DEL will lead to a return value of -1.
 *  - Non-spacing and enclosing combining characters (general category code Mn
 *    or Me in the Unicode database) have a column width of 0.
 *  - SOFT HYPHEN (U+00AD) has a column width of 1.
 *  - Other format characters (general category code Cf in the Unicode database)
 *    and ZERO WIDTH SPACE (U+200B) have a column width of 0.
 *  - Hangul Jamo medial vowels and final consonants (U+1160-U+11FF) have a
 *    column width of 0.
 *  - Spacing characters in the East Asian Wide (W) or East Asian Full-width (F)
 *    category as defined in Unicode Technical Report #11 have a column width of
 *    2.
 *  - East Asian Ambiguous characters are taken into account if
 *    regardCjkAmbiguous flag is enabled. They have a column width of 2.
 *  - All remaining characters (including all printable ISO 8859-1 and WGL4
 *    characters, Unicode control characters, etc.) have a column width of 1.
 *
 * This implementation assumes that characters are encoded in ISO 10646.
 */

lib.wc = {};

// Width of a nul character.
lib.wc.nulWidth = 0;

// Width of a control character.
lib.wc.controlWidth = 0;

// Flag whether to consider East Asian Ambiguous characters.
lib.wc.regardCjkAmbiguous = false;

// Width of an East Asian Ambiguous character.
lib.wc.cjkAmbiguousWidth = 2;

// Sorted list of non-overlapping intervals of non-spacing characters
// generated by the `./ranges.py` helper.
lib.wc.combining = [
  [0x00ad, 0x00ad], [0x0300, 0x036f], [0x0483, 0x0489],
  [0x0591, 0x05bd], [0x05bf, 0x05bf], [0x05c1, 0x05c2],
  [0x05c4, 0x05c5], [0x05c7, 0x05c7], [0x0610, 0x061a],
  [0x061c, 0x061c], [0x064b, 0x065f], [0x0670, 0x0670],
  [0x06d6, 0x06dc], [0x06df, 0x06e4], [0x06e7, 0x06e8],
  [0x06ea, 0x06ed], [0x0711, 0x0711], [0x0730, 0x074a],
  [0x07a6, 0x07b0], [0x07eb, 0x07f3], [0x07fd, 0x07fd],
  [0x0816, 0x0819], [0x081b, 0x0823], [0x0825, 0x0827],
  [0x0829, 0x082d], [0x0859, 0x085b], [0x0898, 0x089f],
  [0x08ca, 0x08e1], [0x08e3, 0x0902], [0x093a, 0x093a],
  [0x093c, 0x093c], [0x0941, 0x0948], [0x094d, 0x094d],
  [0x0951, 0x0957], [0x0962, 0x0963], [0x0981, 0x0981],
  [0x09bc, 0x09bc], [0x09c1, 0x09c4], [0x09cd, 0x09cd],
  [0x09e2, 0x09e3], [0x09fe, 0x09fe], [0x0a01, 0x0a02],
  [0x0a3c, 0x0a3c], [0x0a41, 0x0a42], [0x0a47, 0x0a48],
  [0x0a4b, 0x0a4d], [0x0a51, 0x0a51], [0x0a70, 0x0a71],
  [0x0a75, 0x0a75], [0x0a81, 0x0a82], [0x0abc, 0x0abc],
  [0x0ac1, 0x0ac5], [0x0ac7, 0x0ac8], [0x0acd, 0x0acd],
  [0x0ae2, 0x0ae3], [0x0afa, 0x0aff], [0x0b01, 0x0b01],
  [0x0b3c, 0x0b3c], [0x0b3f, 0x0b3f], [0x0b41, 0x0b44],
  [0x0b4d, 0x0b4d], [0x0b55, 0x0b56], [0x0b62, 0x0b63],
  [0x0b82, 0x0b82], [0x0bc0, 0x0bc0], [0x0bcd, 0x0bcd],
  [0x0c00, 0x0c00], [0x0c04, 0x0c04], [0x0c3c, 0x0c3c],
  [0x0c3e, 0x0c40], [0x0c46, 0x0c48], [0x0c4a, 0x0c4d],
  [0x0c55, 0x0c56], [0x0c62, 0x0c63], [0x0c81, 0x0c81],
  [0x0cbc, 0x0cbc], [0x0cbf, 0x0cbf], [0x0cc6, 0x0cc6],
  [0x0ccc, 0x0ccd], [0x0ce2, 0x0ce3], [0x0d00, 0x0d01],
  [0x0d3b, 0x0d3c], [0x0d41, 0x0d44], [0x0d4d, 0x0d4d],
  [0x0d62, 0x0d63], [0x0d81, 0x0d81], [0x0dca, 0x0dca],
  [0x0dd2, 0x0dd4], [0x0dd6, 0x0dd6], [0x0e31, 0x0e31],
  [0x0e34, 0x0e3a], [0x0e47, 0x0e4e], [0x0eb1, 0x0eb1],
  [0x0eb4, 0x0ebc], [0x0ec8, 0x0ecd], [0x0f18, 0x0f19],
  [0x0f35, 0x0f35], [0x0f37, 0x0f37], [0x0f39, 0x0f39],
  [0x0f71, 0x0f7e], [0x0f80, 0x0f84], [0x0f86, 0x0f87],
  [0x0f8d, 0x0f97], [0x0f99, 0x0fbc], [0x0fc6, 0x0fc6],
  [0x102d, 0x1030], [0x1032, 0x1037], [0x1039, 0x103a],
  [0x103d, 0x103e], [0x1058, 0x1059], [0x105e, 0x1060],
  [0x1071, 0x1074], [0x1082, 0x1082], [0x1085, 0x1086],
  [0x108d, 0x108d], [0x109d, 0x109d], [0x1160, 0x11ff],
  [0x135d, 0x135f], [0x1712, 0x1714], [0x1732, 0x1733],
  [0x1752, 0x1753], [0x1772, 0x1773], [0x17b4, 0x17b5],
  [0x17b7, 0x17bd], [0x17c6, 0x17c6], [0x17c9, 0x17d3],
  [0x17dd, 0x17dd], [0x180b, 0x180f], [0x1885, 0x1886],
  [0x18a9, 0x18a9], [0x1920, 0x1922], [0x1927, 0x1928],
  [0x1932, 0x1932], [0x1939, 0x193b], [0x1a17, 0x1a18],
  [0x1a1b, 0x1a1b], [0x1a56, 0x1a56], [0x1a58, 0x1a5e],
  [0x1a60, 0x1a60], [0x1a62, 0x1a62], [0x1a65, 0x1a6c],
  [0x1a73, 0x1a7c], [0x1a7f, 0x1a7f], [0x1ab0, 0x1ace],
  [0x1b00, 0x1b03], [0x1b34, 0x1b34], [0x1b36, 0x1b3a],
  [0x1b3c, 0x1b3c], [0x1b42, 0x1b42], [0x1b6b, 0x1b73],
  [0x1b80, 0x1b81], [0x1ba2, 0x1ba5], [0x1ba8, 0x1ba9],
  [0x1bab, 0x1bad], [0x1be6, 0x1be6], [0x1be8, 0x1be9],
  [0x1bed, 0x1bed], [0x1bef, 0x1bf1], [0x1c2c, 0x1c33],
  [0x1c36, 0x1c37], [0x1cd0, 0x1cd2], [0x1cd4, 0x1ce0],
  [0x1ce2, 0x1ce8], [0x1ced, 0x1ced], [0x1cf4, 0x1cf4],
  [0x1cf8, 0x1cf9], [0x1dc0, 0x1dff], [0x200b, 0x200f],
  [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x206f],
  [0x20d0, 0x20f0], [0x2cef, 0x2cf1], [0x2d7f, 0x2d7f],
  [0x2de0, 0x2dff], [0x302a, 0x302d], [0x3099, 0x309a],
  [0xa66f, 0xa672], [0xa674, 0xa67d], [0xa69e, 0xa69f],
  [0xa6f0, 0xa6f1], [0xa802, 0xa802], [0xa806, 0xa806],
  [0xa80b, 0xa80b], [0xa825, 0xa826], [0xa82c, 0xa82c],
  [0xa8c4, 0xa8c5], [0xa8e0, 0xa8f1], [0xa8ff, 0xa8ff],
  [0xa926, 0xa92d], [0xa947, 0xa951], [0xa980, 0xa982],
  [0xa9b3, 0xa9b3], [0xa9b6, 0xa9b9], [0xa9bc, 0xa9bd],
  [0xa9e5, 0xa9e5], [0xaa29, 0xaa2e], [0xaa31, 0xaa32],
  [0xaa35, 0xaa36], [0xaa43, 0xaa43], [0xaa4c, 0xaa4c],
  [0xaa7c, 0xaa7c], [0xaab0, 0xaab0], [0xaab2, 0xaab4],
  [0xaab7, 0xaab8], [0xaabe, 0xaabf], [0xaac1, 0xaac1],
  [0xaaec, 0xaaed], [0xaaf6, 0xaaf6], [0xabe5, 0xabe5],
  [0xabe8, 0xabe8], [0xabed, 0xabed], [0xfb1e, 0xfb1e],
  [0xfe00, 0xfe0f], [0xfe20, 0xfe2f], [0xfeff, 0xfeff],
  [0xfff9, 0xfffb], [0x101fd, 0x101fd], [0x102e0, 0x102e0],
  [0x10376, 0x1037a], [0x10a01, 0x10a03], [0x10a05, 0x10a06],
  [0x10a0c, 0x10a0f], [0x10a38, 0x10a3a], [0x10a3f, 0x10a3f],
  [0x10ae5, 0x10ae6], [0x10d24, 0x10d27], [0x10eab, 0x10eac],
  [0x10f46, 0x10f50], [0x10f82, 0x10f85], [0x11001, 0x11001],
  [0x11038, 0x11046], [0x11070, 0x11070], [0x11073, 0x11074],
  [0x1107f, 0x11081], [0x110b3, 0x110b6], [0x110b9, 0x110ba],
  [0x110c2, 0x110c2], [0x11100, 0x11102], [0x11127, 0x1112b],
  [0x1112d, 0x11134], [0x11173, 0x11173], [0x11180, 0x11181],
  [0x111b6, 0x111be], [0x111c9, 0x111cc], [0x111cf, 0x111cf],
  [0x1122f, 0x11231], [0x11234, 0x11234], [0x11236, 0x11237],
  [0x1123e, 0x1123e], [0x112df, 0x112df], [0x112e3, 0x112ea],
  [0x11300, 0x11301], [0x1133b, 0x1133c], [0x11340, 0x11340],
  [0x11366, 0x1136c], [0x11370, 0x11374], [0x11438, 0x1143f],
  [0x11442, 0x11444], [0x11446, 0x11446], [0x1145e, 0x1145e],
  [0x114b3, 0x114b8], [0x114ba, 0x114ba], [0x114bf, 0x114c0],
  [0x114c2, 0x114c3], [0x115b2, 0x115b5], [0x115bc, 0x115bd],
  [0x115bf, 0x115c0], [0x115dc, 0x115dd], [0x11633, 0x1163a],
  [0x1163d, 0x1163d], [0x1163f, 0x11640], [0x116ab, 0x116ab],
  [0x116ad, 0x116ad], [0x116b0, 0x116b5], [0x116b7, 0x116b7],
  [0x1171d, 0x1171f], [0x11722, 0x11725], [0x11727, 0x1172b],
  [0x1182f, 0x11837], [0x11839, 0x1183a], [0x1193b, 0x1193c],
  [0x1193e, 0x1193e], [0x11943, 0x11943], [0x119d4, 0x119d7],
  [0x119da, 0x119db], [0x119e0, 0x119e0], [0x11a01, 0x11a0a],
  [0x11a33, 0x11a38], [0x11a3b, 0x11a3e], [0x11a47, 0x11a47],
  [0x11a51, 0x11a56], [0x11a59, 0x11a5b], [0x11a8a, 0x11a96],
  [0x11a98, 0x11a99], [0x11c30, 0x11c36], [0x11c38, 0x11c3d],
  [0x11c3f, 0x11c3f], [0x11c92, 0x11ca7], [0x11caa, 0x11cb0],
  [0x11cb2, 0x11cb3], [0x11cb5, 0x11cb6], [0x11d31, 0x11d36],
  [0x11d3a, 0x11d3a], [0x11d3c, 0x11d3d], [0x11d3f, 0x11d45],
  [0x11d47, 0x11d47], [0x11d90, 0x11d91], [0x11d95, 0x11d95],
  [0x11d97, 0x11d97], [0x11ef3, 0x11ef4], [0x13430, 0x13438],
  [0x16af0, 0x16af4], [0x16b30, 0x16b36], [0x16f4f, 0x16f4f],
  [0x16f8f, 0x16f92], [0x16fe4, 0x16fe4], [0x1bc9d, 0x1bc9e],
  [0x1bca0, 0x1bca3], [0x1cf00, 0x1cf2d], [0x1cf30, 0x1cf46],
  [0x1d167, 0x1d169], [0x1d173, 0x1d182], [0x1d185, 0x1d18b],
  [0x1d1aa, 0x1d1ad], [0x1d242, 0x1d244], [0x1da00, 0x1da36],
  [0x1da3b, 0x1da6c], [0x1da75, 0x1da75], [0x1da84, 0x1da84],
  [0x1da9b, 0x1da9f], [0x1daa1, 0x1daaf], [0x1e000, 0x1e006],
  [0x1e008, 0x1e018], [0x1e01b, 0x1e021], [0x1e023, 0x1e024],
  [0x1e026, 0x1e02a], [0x1e130, 0x1e136], [0x1e2ae, 0x1e2ae],
  [0x1e2ec, 0x1e2ef], [0x1e8d0, 0x1e8d6], [0x1e944, 0x1e94a],
  [0xe0001, 0xe0001], [0xe0020, 0xe007f], [0xe0100, 0xe01ef],
];

// Sorted list of non-overlapping intervals of East Asian Ambiguous characters
// generated by the `./ranges.py` helper.
lib.wc.ambiguous = [
  [0x00a1, 0x00a1], [0x00a4, 0x00a4], [0x00a7, 0x00a8],
  [0x00aa, 0x00aa], [0x00ad, 0x00ae], [0x00b0, 0x00b4],
  [0x00b6, 0x00ba], [0x00bc, 0x00bf], [0x00c6, 0x00c6],
  [0x00d0, 0x00d0], [0x00d7, 0x00d8], [0x00de, 0x00e1],
  [0x00e6, 0x00e6], [0x00e8, 0x00ea], [0x00ec, 0x00ed],
  [0x00f0, 0x00f0], [0x00f2, 0x00f3], [0x00f7, 0x00fa],
  [0x00fc, 0x00fc], [0x00fe, 0x00fe], [0x0101, 0x0101],
  [0x0111, 0x0111], [0x0113, 0x0113], [0x011b, 0x011b],
  [0x0126, 0x0127], [0x012b, 0x012b], [0x0131, 0x0133],
  [0x0138, 0x0138], [0x013f, 0x0142], [0x0144, 0x0144],
  [0x0148, 0x014b], [0x014d, 0x014d], [0x0152, 0x0153],
  [0x0166, 0x0167], [0x016b, 0x016b], [0x01ce, 0x01ce],
  [0x01d0, 0x01d0], [0x01d2, 0x01d2], [0x01d4, 0x01d4],
  [0x01d6, 0x01d6], [0x01d8, 0x01d8], [0x01da, 0x01da],
  [0x01dc, 0x01dc], [0x0251, 0x0251], [0x0261, 0x0261],
  [0x02c4, 0x02c4], [0x02c7, 0x02c7], [0x02c9, 0x02cb],
  [0x02cd, 0x02cd], [0x02d0, 0x02d0], [0x02d8, 0x02db],
  [0x02dd, 0x02dd], [0x02df, 0x02df], [0x0300, 0x036f],
  [0x0391, 0x03a1], [0x03a3, 0x03a9], [0x03b1, 0x03c1],
  [0x03c3, 0x03c9], [0x0401, 0x0401], [0x0410, 0x044f],
  [0x0451, 0x0451], [0x1100, 0x115f], [0x2010, 0x2010],
  [0x2013, 0x2016], [0x2018, 0x2019], [0x201c, 0x201d],
  [0x2020, 0x2022], [0x2024, 0x2027], [0x2030, 0x2030],
  [0x2032, 0x2033], [0x2035, 0x2035], [0x203b, 0x203b],
  [0x203e, 0x203e], [0x2074, 0x2074], [0x207f, 0x207f],
  [0x2081, 0x2084], [0x20ac, 0x20ac], [0x2103, 0x2103],
  [0x2105, 0x2105], [0x2109, 0x2109], [0x2113, 0x2113],
  [0x2116, 0x2116], [0x2121, 0x2122], [0x2126, 0x2126],
  [0x212b, 0x212b], [0x2153, 0x2154], [0x215b, 0x215e],
  [0x2160, 0x216b], [0x2170, 0x2179], [0x2189, 0x2189],
  [0x2190, 0x2199], [0x21b8, 0x21b9], [0x21d2, 0x21d2],
  [0x21d4, 0x21d4], [0x21e7, 0x21e7], [0x2200, 0x2200],
  [0x2202, 0x2203], [0x2207, 0x2208], [0x220b, 0x220b],
  [0x220f, 0x220f], [0x2211, 0x2211], [0x2215, 0x2215],
  [0x221a, 0x221a], [0x221d, 0x2220], [0x2223, 0x2223],
  [0x2225, 0x2225], [0x2227, 0x222c], [0x222e, 0x222e],
  [0x2234, 0x2237], [0x223c, 0x223d], [0x2248, 0x2248],
  [0x224c, 0x224c], [0x2252, 0x2252], [0x2260, 0x2261],
  [0x2264, 0x2267], [0x226a, 0x226b], [0x226e, 0x226f],
  [0x2282, 0x2283], [0x2286, 0x2287], [0x2295, 0x2295],
  [0x2299, 0x2299], [0x22a5, 0x22a5], [0x22bf, 0x22bf],
  [0x2312, 0x2312], [0x231a, 0x231b], [0x2329, 0x232a],
  [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3],
  [0x2460, 0x24e9], [0x24eb, 0x254b], [0x2550, 0x2573],
  [0x2580, 0x258f], [0x2592, 0x2595], [0x25a0, 0x25a1],
  [0x25a3, 0x25a9], [0x25b2, 0x25b3], [0x25b6, 0x25b7],
  [0x25bc, 0x25bd], [0x25c0, 0x25c1], [0x25c6, 0x25c8],
  [0x25cb, 0x25cb], [0x25ce, 0x25d1], [0x25e2, 0x25e5],
  [0x25ef, 0x25ef], [0x25fd, 0x25fe], [0x2605, 0x2606],
  [0x2609, 0x2609], [0x260e, 0x260f], [0x2614, 0x2615],
  [0x261c, 0x261c], [0x261e, 0x261e], [0x2640, 0x2640],
  [0x2642, 0x2642], [0x2648, 0x2653], [0x2660, 0x2661],
  [0x2663, 0x2665], [0x2667, 0x266a], [0x266c, 0x266d],
  [0x266f, 0x266f], [0x267f, 0x267f], [0x2693, 0x2693],
  [0x269e, 0x269f], [0x26a1, 0x26a1], [0x26aa, 0x26ab],
  [0x26bd, 0x26bf], [0x26c4, 0x26e1], [0x26e3, 0x26e3],
  [0x26e8, 0x26ff], [0x2705, 0x2705], [0x270a, 0x270b],
  [0x2728, 0x2728], [0x273d, 0x273d], [0x274c, 0x274c],
  [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757],
  [0x2776, 0x277f], [0x2795, 0x2797], [0x27b0, 0x27b0],
  [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50],
  [0x2b55, 0x2b59], [0x2e80, 0x2fdf], [0x2ff0, 0x303e],
  [0x3040, 0x4dbf], [0x4e00, 0xa4cf], [0xa960, 0xa97f],
  [0xac00, 0xd7a3], [0xe000, 0xfaff], [0xfe00, 0xfe19],
  [0xfe30, 0xfe6f], [0xff01, 0xff60], [0xffe0, 0xffe6],
  [0xfffd, 0xfffd], [0x16fe0, 0x16fe4], [0x16ff0, 0x16ff1],
  [0x17000, 0x18cd5], [0x18d00, 0x18d08], [0x1aff0, 0x1aff3],
  [0x1aff5, 0x1affb], [0x1affd, 0x1affe], [0x1b000, 0x1b12f],
  [0x1b150, 0x1b152], [0x1b164, 0x1b167], [0x1b170, 0x1b2ff],
  [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf], [0x1f100, 0x1f10a],
  [0x1f110, 0x1f12d], [0x1f130, 0x1f169], [0x1f170, 0x1f1ac],
  [0x1f200, 0x1f202], [0x1f210, 0x1f23b], [0x1f240, 0x1f248],
  [0x1f250, 0x1f251], [0x1f260, 0x1f265], [0x1f300, 0x1f320],
  [0x1f32d, 0x1f335], [0x1f337, 0x1f37c], [0x1f37e, 0x1f393],
  [0x1f3a0, 0x1f3ca], [0x1f3cf, 0x1f3d3], [0x1f3e0, 0x1f3f0],
  [0x1f3f4, 0x1f3f4], [0x1f3f8, 0x1f43e], [0x1f440, 0x1f440],
  [0x1f442, 0x1f4fc], [0x1f4ff, 0x1f53d], [0x1f54b, 0x1f54e],
  [0x1f550, 0x1f567], [0x1f57a, 0x1f57a], [0x1f595, 0x1f596],
  [0x1f5a4, 0x1f5a4], [0x1f5fb, 0x1f64f], [0x1f680, 0x1f6c5],
  [0x1f6cc, 0x1f6cc], [0x1f6d0, 0x1f6d2], [0x1f6d5, 0x1f6d7],
  [0x1f6dd, 0x1f6df], [0x1f6eb, 0x1f6ec], [0x1f6f4, 0x1f6fc],
  [0x1f7e0, 0x1f7eb], [0x1f7f0, 0x1f7f0], [0x1f90c, 0x1f93a],
  [0x1f93c, 0x1f945], [0x1f947, 0x1f9ff], [0x1fa70, 0x1fa74],
  [0x1fa78, 0x1fa7c], [0x1fa80, 0x1fa86], [0x1fa90, 0x1faac],
  [0x1fab0, 0x1faba], [0x1fac0, 0x1fac5], [0x1fad0, 0x1fad9],
  [0x1fae0, 0x1fae7], [0x1faf0, 0x1faf6], [0x20000, 0x2fffd],
  [0x30000, 0x3fffd], [0xe0100, 0xe01ef], [0xf0000, 0xffffd],
  [0x100000, 0x10fffd],
];

// Sorted list of non-overlapping intervals of East Asian Unambiguous characters
// generated by the `./ranges.py` helper.
lib.wc.unambiguous = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a],
  [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3],
  [0x25fd, 0x25fe], [0x2614, 0x2615], [0x2648, 0x2653],
  [0x267f, 0x267f], [0x2693, 0x2693], [0x26a1, 0x26a1],
  [0x26aa, 0x26ab], [0x26bd, 0x26be], [0x26c4, 0x26c5],
  [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea],
  [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa],
  [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b],
  [0x2728, 0x2728], [0x274c, 0x274c], [0x274e, 0x274e],
  [0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797],
  [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c],
  [0x2b50, 0x2b50], [0x2b55, 0x2b55], [0x2e80, 0x2fdf],
  [0x2ff0, 0x303e], [0x3040, 0x3247], [0x3250, 0x4dbf],
  [0x4e00, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7a3],
  [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f],
  [0xff01, 0xff60], [0xffe0, 0xffe6], [0x16fe0, 0x16fe4],
  [0x16ff0, 0x16ff1], [0x17000, 0x18cd5], [0x18d00, 0x18d08],
  [0x1aff0, 0x1aff3], [0x1aff5, 0x1affb], [0x1affd, 0x1affe],
  [0x1b000, 0x1b12f], [0x1b150, 0x1b152], [0x1b164, 0x1b167],
  [0x1b170, 0x1b2ff], [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf],
  [0x1f18e, 0x1f18e], [0x1f191, 0x1f19a], [0x1f200, 0x1f202],
  [0x1f210, 0x1f23b], [0x1f240, 0x1f248], [0x1f250, 0x1f251],
  [0x1f260, 0x1f265], [0x1f300, 0x1f320], [0x1f32d, 0x1f335],
  [0x1f337, 0x1f37c], [0x1f37e, 0x1f393], [0x1f3a0, 0x1f3ca],
  [0x1f3cf, 0x1f3d3], [0x1f3e0, 0x1f3f0], [0x1f3f4, 0x1f3f4],
  [0x1f3f8, 0x1f43e], [0x1f440, 0x1f440], [0x1f442, 0x1f4fc],
  [0x1f4ff, 0x1f53d], [0x1f54b, 0x1f54e], [0x1f550, 0x1f567],
  [0x1f57a, 0x1f57a], [0x1f595, 0x1f596], [0x1f5a4, 0x1f5a4],
  [0x1f5fb, 0x1f64f], [0x1f680, 0x1f6c5], [0x1f6cc, 0x1f6cc],
  [0x1f6d0, 0x1f6d2], [0x1f6d5, 0x1f6d7], [0x1f6dd, 0x1f6df],
  [0x1f6eb, 0x1f6ec], [0x1f6f4, 0x1f6fc], [0x1f7e0, 0x1f7eb],
  [0x1f7f0, 0x1f7f0], [0x1f90c, 0x1f93a], [0x1f93c, 0x1f945],
  [0x1f947, 0x1f9ff], [0x1fa70, 0x1fa74], [0x1fa78, 0x1fa7c],
  [0x1fa80, 0x1fa86], [0x1fa90, 0x1faac], [0x1fab0, 0x1faba],
  [0x1fac0, 0x1fac5], [0x1fad0, 0x1fad9], [0x1fae0, 0x1fae7],
  [0x1faf0, 0x1faf6], [0x20000, 0x2fffd], [0x30000, 0x3fffd],
];

/**
 * Binary search to check if the given unicode character is in the table.
 *
 * @param {number} ucs A unicode character code.
 * @param {!Array<!Array<number>>} table A sorted list of internals to match
 *     against.
 * @return {boolean} True if the given character is in the table.
 */
lib.wc.binaryTableSearch_ = function(ucs, table) {
  let min = 0;
  let max = table.length - 1;
  let mid;

  if (ucs < table[min][0] || ucs > table[max][1]) {
    return false;
  }
  while (max >= min) {
    mid = Math.floor((min + max) / 2);
    if (ucs > table[mid][1]) {
      min = mid + 1;
    } else if (ucs < table[mid][0]) {
      max = mid - 1;
    } else {
      return true;
    }
  }

  return false;
};

/**
 * Binary search to check if the given unicode character is a space character.
 *
 * @param {number} ucs A unicode character code.
 * @return {boolean} True if the given character is a space character; false
 *     otherwise.
 */
lib.wc.isSpace = function(ucs) {
  return lib.wc.binaryTableSearch_(ucs, lib.wc.combining);
};

/**
 * Auxiliary function for checking if the given unicode character is a East
 * Asian Ambiguous character.
 *
 * @param {number} ucs A unicode character code.
 * @return {boolean} True if the given character is a East Asian Ambiguous
 *     character.
 */
lib.wc.isCjkAmbiguous = function(ucs) {
  return lib.wc.binaryTableSearch_(ucs, lib.wc.ambiguous);
};

/**
 * Determine the column width of the given character.
 *
 * @param {number} ucs A unicode character code.
 * @return {number} The column width of the given character.
 */
lib.wc.charWidth = function(ucs) {
  if (lib.wc.regardCjkAmbiguous) {
    return lib.wc.charWidthRegardAmbiguous(ucs);
  } else {
    return lib.wc.charWidthDisregardAmbiguous(ucs);
  }
};

/**
 * Determine the column width of the given character without considering East
 * Asian Ambiguous characters.
 *
 * @param {number} ucs A unicode character code.
 * @return {number} The column width of the given character.
 */
lib.wc.charWidthDisregardAmbiguous = function(ucs) {
  // Optimize for ASCII characters.
  if (ucs < 0x7f) {
    if (ucs >= 0x20) {
      return 1;
    } else if (ucs == 0) {
      return lib.wc.nulWidth;
    } else /* if (ucs < 0x20) */ {
      return lib.wc.controlWidth;
    }
  }

  // Test for 8-bit control characters.
  if (ucs < 0xa0) {
    return lib.wc.controlWidth;
  }

  // Binary search in table of non-spacing characters.
  if (lib.wc.isSpace(ucs)) {
    return 0;
  }

  // Binary search in table of wide characters.
  return lib.wc.binaryTableSearch_(ucs, lib.wc.unambiguous) ? 2 : 1;
};

/**
 * Determine the column width of the given character considering East Asian
 * Ambiguous characters.
 *
 * @param {number} ucs A unicode character code.
 * @return {number} The column width of the given character.
 */
lib.wc.charWidthRegardAmbiguous = function(ucs) {
  if (lib.wc.isCjkAmbiguous(ucs)) {
    return lib.wc.cjkAmbiguousWidth;
  }

  return lib.wc.charWidthDisregardAmbiguous(ucs);
};

/**
 * Determine the column width of the given string.
 *
 * @param {string} str A string.
 * @return {number} The column width of the given string.
 */
lib.wc.strWidth = function(str) {
  let rv = 0;

  for (let i = 0; i < str.length;) {
    const codePoint = str.codePointAt(i);
    const width = lib.wc.charWidth(codePoint);
    if (width < 0) {
      return -1;
    }
    rv += width;
    i += (codePoint <= 0xffff) ? 1 : 2;
  }

  return rv;
};

/**
 * Get the substring at the given column offset of the given column width.
 *
 * @param {string} str The string to get substring from.
 * @param {number} start The starting column offset to get substring.
 * @param {number=} subwidth The column width of the substring.
 * @return {string} The substring.
 */
lib.wc.substr = function(str, start, subwidth = undefined) {
  let startIndex = 0;

  // Fun edge case: Normally we associate zero width codepoints (like combining
  // characters) with the previous codepoint, so we skip any leading ones while
  // including trailing ones.  However, if there are zero width codepoints at
  // the start of the string, and the substring starts at 0, lets include them
  // in the result.  This also makes for a simple optimization for a common
  // request.
  if (start) {
    for (let width = 0; startIndex < str.length;) {
      const codePoint = str.codePointAt(startIndex);
      width += lib.wc.charWidth(codePoint);
      if (width > start) {
        break;
      }
      startIndex += (codePoint <= 0xffff) ? 1 : 2;
    }
  }

  if (subwidth !== undefined) {
    let endIndex = startIndex;
    for (let width = 0; endIndex < str.length;) {
      const codePoint = str.codePointAt(endIndex);
      width += lib.wc.charWidth(codePoint);
      if (width > subwidth) {
        break;
      }
      endIndex += (codePoint <= 0xffff) ? 1 : 2;
    }
    return str.substring(startIndex, endIndex);
  }

  return str.substr(startIndex);
};

/**
 * Get substring at the given start and end column offset.
 *
 * @param {string} str The string to get substring from.
 * @param {number} start The starting column offset.
 * @param {number} end The ending column offset.
 * @return {string} The substring.
 */
lib.wc.substring = function(str, start, end) {
  return lib.wc.substr(str, start, end - start);
};
lib.resource.add('libdot/changelog/version', 'text/plain',
'9.0.0'
);

lib.resource.add('libdot/changelog/date', 'text/plain',
'2022-02-24'
);

// SOURCE FILE: hterm/js/hterm.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Declares the hterm.* namespace and some basic shared utilities
 * that are too small to deserve dedicated files.
 */
const hterm = {};

/**
 * The type of window hosting hterm.
 *
 * This is set as part of hterm.init().  The value is invalid until
 * initialization completes.
 */
hterm.windowType = null;

/**
 * The OS we're running under.
 *
 * Used when setting up OS-specific behaviors.
 *
 * This is set as part of hterm.init().  The value is invalid until
 * initialization completes.
 */
hterm.os = null;

/**
 * Text shown in a desktop notification for the terminal
 * bell.  \u226a is a unicode EIGHTH NOTE, %(title) will
 * be replaced by the terminal title.
 */
hterm.desktopNotificationTitle = '\u266A %(title) \u266A';

lib.registerInit(
    'hterm',
    /**
     * The hterm init function, registered with lib.registerInit().
     *
     * This is called during lib.init().
     *
     * @return {!Promise<void>}
     */
    async () => {
      function initMessageManager() {
        return lib.i18n.getAcceptLanguages()
          .then((languages) => {
          })
          .then(() => {
            // If OS detection fails, then we'll still set the value to
            // something.  The OS logic in hterm tends to be best effort
            // anyways.
            const initOs = (os) => { hterm.os = os; };
            return lib.f.getOs().then(initOs).catch(initOs);
          });
      }

      function onWindow(window) {
        hterm.windowType = window.type;
        return initMessageManager();
      }

      function onTab(tab = undefined) {
        if (tab && window.chrome) {
          return new Promise((resolve) => {
            chrome.windows.get(tab.windowId, null, (win) => {
              onWindow(win).then(resolve);
            });
          });
        } else {
          // TODO(rginda): This is where we end up for a v1 app's background
          // page. Maybe windowType = 'none' would be more appropriate, or
          // something.
          hterm.windowType = 'normal';
          return initMessageManager();
        }
      }

      return new Promise((resolve) => {
        if (window.chrome && chrome.tabs) {
          // The getCurrent method gets the tab that is "currently running",
          // not the topmost or focused tab.
          chrome.tabs.getCurrent((tab) => onTab(tab).then(resolve));
        } else {
          onWindow({type: 'normal'}).then(resolve);
        }
      });
    });

/**
 * Sanitizes the given HTML source into a TrustedHTML, or a string if the
 * Trusted Types API is not available.
 *
 * For now, we wrap the given HTML into a TrustedHTML without modifying it.
 *
 * @param {string} html
 * @return {!TrustedHTML|string}
 */
hterm.sanitizeHtml = function(html) {
  if (window?.trustedTypes?.createPolicy) {
    if (!hterm.sanitizeHtml.policy) {
      hterm.sanitizeHtml.policy = trustedTypes.createPolicy('default', {
        createHTML: (source) => source,
      });
    }
    return hterm.sanitizeHtml.policy.createHTML(html);
  }

  return html;
};

/**
 * Copy the specified text to the system clipboard.
 *
 * We'll create selections on demand based on the content to copy.
 *
 * @param {!Document} document The document with the selection to copy.
 * @param {string} str The string data to copy out.
 * @return {!Promise<void>}
 */
hterm.copySelectionToClipboard = function(document, str) {
  // Request permission if need be.
  const requestPermission = () => {
    // Use the Permissions API if available.
    if (navigator.permissions && navigator.permissions.query) {
      return navigator.permissions.query({name: 'clipboard-write'})
        .then((status) => {
          const checkState = (resolve, reject) => {
            switch (status.state) {
              case 'granted':
                return resolve();
              case 'denied':
                return reject();
              default:
                // Wait for the user to approve/disprove.
                return new Promise((resolve, reject) => {
                  status.onchange = () => checkState(resolve, reject);
                });
            }
          };

          return new Promise(checkState);
        })
        // If the platform doesn't support "clipboard-write", or is denied,
        // we move on to the copying step anyways.
        .catch(() => Promise.resolve());
    } else {
      // No permissions API, so resolve right away.
      return Promise.resolve();
    }
  };

  // Write to the clipboard.
  const writeClipboard = () => {
    // Use the Clipboard API if available.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      // If this fails (perhaps due to focus changing windows), fallback to the
      // legacy copy method.
      return navigator.clipboard.writeText(str)
        .catch(execCommand);
    } else {
      // No Clipboard API, so use the old execCommand style.
      return execCommand();
    }
  };

  // Write to the clipboard using the legacy execCommand method.
  // TODO: Once we can rely on the Clipboard API everywhere, we can simplify
  // this a lot by deleting the custom selection logic.
  const execCommand = () => {
    const copySource = document.createElement('pre');
    copySource.id = 'hterm:copy-to-clipboard-source';
    copySource.textContent = str;
    copySource.style.cssText = (
        'user-select: text;' +
        'position: absolute;' +
        'top: -99px');

    document.body.appendChild(copySource);

    const selection = document.getSelection();
    const anchorNode = selection.anchorNode;
    const anchorOffset = selection.anchorOffset;
    const focusNode = selection.focusNode;
    const focusOffset = selection.focusOffset;

    // FF sometimes throws NS_ERROR_FAILURE exceptions when we make this call.
    // Catch it because a failure here leaks the copySource node.
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1178676
    try {
      selection.selectAllChildren(copySource);
    } catch (ex) {
      // FF workaround.
    }

    try {
      document.execCommand('copy');
    } catch (firefoxException) {
      // Ignore this. FF throws an exception if there was an error, even
      // though the spec says just return false.
    }

    // IE doesn't support selection.extend.  This means that the selection won't
    // return on IE.
    if (selection.extend) {
      // When running in the test harness, we won't have any related nodes.
      if (anchorNode) {
        selection.collapse(anchorNode, anchorOffset);
      }
      if (focusNode) {
        selection.extend(focusNode, focusOffset);
      }
    }

    copySource.remove();

    // Since execCommand is synchronous, resolve right away.
    return Promise.resolve();
  };

  // Kick it all off!
  return requestPermission().then(writeClipboard);
};

/**
 * Return a formatted message in the current locale.
 *
 * @param {string} name The name of the message to return.
 * @param {!Array<string>=} args The message arguments, if required.
 * @param {string=} string The default message text.
 * @return {string} The localized message.
 */
hterm.msg = function(name, args = [], string = '') {
  return lib.i18n.replaceReferences(string, args);
};

/**
 * Create a new notification.
 *
 * @param {{title:(string|undefined), body:(string|undefined)}=} params Various
 *     parameters for the notification.
 *     title The title (defaults to the window's title).
 *     body The message body (main text).
 * @return {!Notification}
 */
hterm.notify = function(params) {
  const def = (curr, fallback) => curr !== undefined ? curr : fallback;
  if (params === undefined || params === null) {
    params = {};
  }

  // Merge the user's choices with the default settings.  We don't take it
  // directly in case it was stuffed with excess junk.
  const options = {
      'body': params.body,
      'icon': def(params.icon, lib.resource.getDataUrl('hterm/images/icon-96')),
  };

  let title = def(params.title, window.document.title);
  if (!title) {
    title = 'hterm';
  }
  title = lib.f.replaceVars(hterm.desktopNotificationTitle, {'title': title});

  const n = new Notification(title, options);
  n.onclick = function() {
    window.focus();
    n.close();
  };
  return n;
};

/**
 * Launches url in a new tab.
 *
 * @param {string} url URL to launch in a new tab.
 */
hterm.openUrl = function(url) {
  if (window.chrome && chrome.browser && chrome.browser.openTab) {
    // For Chrome v2 apps, we need to use this API to properly open windows.
    chrome.browser.openTab({'url': url});
  } else {
    const win = lib.f.openWindow(url, '_blank');
    if (win) {
      win.focus();
    }
  }
};

/**
 * Constructor for a hterm.RowCol record.
 *
 * Instances of this class have public read/write members for row and column.
 *
 * This class includes an 'overflow' bit which is use to indicate that an
 * attempt has been made to move the cursor column passed the end of the
 * screen.  When this happens we leave the cursor column set to the last column
 * of the screen but set the overflow bit.  In this state cursor movement
 * happens normally, but any attempt to print new characters causes a cr/lf
 * first.
 *
 */
hterm.RowCol = class {
  /**
   * @param {number} row The row of this record.
   * @param {number} column The column of this record.
   * @param {boolean=} overflow Optional boolean indicating that the RowCol
   *     has overflowed.
   */
  constructor(row, column, overflow = false) {
    this.row = row;
    this.column = column;
    this.overflow = !!overflow;
  }

  /**
   * Adjust the row and column of this record.
   *
   * @param {number} row The new row of this record.
   * @param {number} column The new column of this record.
   * @param {boolean=} overflow Optional boolean indicating that the RowCol
   *     has overflowed.
   */
  move(row, column, overflow = false) {
    this.row = row;
    this.column = column;
    this.overflow = !!overflow;
  }

  /**
   * Return a copy of this record.
   *
   * @return {!hterm.RowCol} A new hterm.RowCol instance with the same row and
   *     column.
   */
  clone() {
    return new this.constructor(this.row, this.column, this.overflow);
  }

  /**
   * Set the row and column of this instance based on another hterm.RowCol.
   *
   * @param {!hterm.RowCol} that The object to copy from.
   */
  setTo(that) {
    this.row = that.row;
    this.column = that.column;
    this.overflow = that.overflow;
  }

  /**
   * Test if another hterm.RowCol instance is equal to this one.
   *
   * @param {!hterm.RowCol} that The other hterm.RowCol instance.
   * @return {boolean} True if both instances have the same row/column, false
   *     otherwise.
   */
  equals(that) {
    return (this.row == that.row && this.column == that.column &&
            this.overflow == that.overflow);
  }

  /**
   * Return a string representation of this instance.
   *
   * @return {string} A string that identifies the row and column of this
   *     instance.
   * @override
   */
  toString() {
    return `[hterm.RowCol: ${this.row}, ${this.column}, ${this.overflow}]`;
  }
};
// SOURCE FILE: hterm/js/hterm_accessibility_reader.js
// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * AccessibilityReader responsible for rendering command output for AT.
 *
 * Renders command output for Assistive Technology using a live region. We don't
 * use the visible rows of the terminal for rendering command output to the
 * screen reader because the rendered content may be different from what we want
 * read out by a screen reader. For example, we may not actually render every
 * row of a large piece of output to the screen as it wouldn't be performant.
 * But we want the screen reader to read it all out in order.
 *
 * @param {!Element} div The div element where the live region should be
 *     added.
 * @constructor
 */
hterm.AccessibilityReader = function(div) {
  this.document_ = div.ownerDocument;

  // The live region element to add text to.
  const liveRegion = this.document_.createElement('div');
  liveRegion.id = 'hterm:accessibility-live-region';
  liveRegion.style.cssText = `position: absolute;
                              width: 0; height: 0;
                              overflow: hidden;
                              left: -1000px; top: -1000px;`;
  div.appendChild(liveRegion);

  // Whether command output should be rendered for Assistive Technology.
  // This isn't always enabled because it has an impact on performance.
  this.accessibilityEnabled = false;

  // This live element is used for command output.
  this.liveElement_ = this.document_.createElement('p');
  this.liveElement_.setAttribute('aria-live', 'polite');
  liveRegion.appendChild(this.liveElement_);

  // This live element is used for speaking out the current screen when
  // navigating through the scrollback buffer. It will interrupt existing
  // announcements.
  this.assertiveLiveElement_ = this.document_.createElement('p');
  this.assertiveLiveElement_.setAttribute('aria-live', 'assertive');
  liveRegion.appendChild(this.assertiveLiveElement_);

  // A queue of updates to announce.
  this.queue_ = [];

  // A timer which tracks when next to add items to the live region. null when
  // not running. This is used to combine updates that occur in a small window,
  // as well as to avoid too much output being added to the live region in one
  // go which can cause the renderer to hang.
  this.nextReadTimer_ = null;

  // This is set to true if the cursor is about to update position on the
  // screen. i.e. beforeCursorChange has been called but not afterCursorChange.
  this.cursorIsChanging_ = false;

  // This tracks changes that would be added to queue_ while the cursor is
  // changing. This is done so that we can decide to discard these changes if
  // we announce something as a result of the cursor change.
  this.cursorChangeQueue_ = [];

  // The string of text on the row that the cursor was last on. Only valid while
  // cursorIsChanging_ is true.
  this.lastCursorRowString_ = null;

  // The row that the cursor was last on. Only valid while cursorIsChanging_ is
  // true.
  this.lastCursorRow_ = null;

  // The column that the cursor was last on. Only valid while cursorIsChanging_
  // is true.
  this.lastCursorColumn_ = null;

  // True if a keypress has been performed since the last cursor change.
  this.hasUserGesture = false;
};

/**
 * Delay in ms to use for merging strings to output.
 *
 * We merge strings together to avoid hanging the terminal and to ensure that
 * aria updates make it to the screen reader. We want this to be short so
 * there's not a big delay between typing/executing commands and hearing output.
 *
 * @const
 * @type {number}
 */
hterm.AccessibilityReader.DELAY = 50;

/**
 * Enable accessibility-friendly features that have a performance impact.
 *
 * @param {boolean} enabled Whether to enable accessibility-friendly features.
 */
hterm.AccessibilityReader.prototype.setAccessibilityEnabled =
    function(enabled) {
  if (!enabled) {
    this.clear();
  }

  this.accessibilityEnabled = enabled;
};

/**
 * Decorate the document where the terminal <x-screen> resides. This is needed
 * for listening to keystrokes on the screen.
 *
 * @param {!Document} doc The document where the <x-screen> resides.
 */
hterm.AccessibilityReader.prototype.decorate = function(doc) {
  const handlers = ['keydown', 'keypress', 'keyup', 'textInput'];
  handlers.forEach((handler) => {
    doc.addEventListener(handler, () => { this.hasUserGesture = true; });
  });
};

/**
 * This should be called before the cursor on the screen is about to get
 * updated. This allows cursor changes to be tracked and related notifications
 * to be announced.
 *
 * @param {string} cursorRowString The text in the row that the cursor is
 *     currently on.
 * @param {number} cursorRow The index of the row that the cursor is currently
 *     on, including rows in the scrollback buffer.
 * @param {number} cursorColumn The index of the column that the cursor is
 *     currently on.
 */
hterm.AccessibilityReader.prototype.beforeCursorChange =
    function(cursorRowString, cursorRow, cursorColumn) {
  // If accessibility is enabled we don't announce selection changes as these
  // can have a performance impact.
  if (!this.accessibilityEnabled) {
    return;
  }

  // If there is no user gesture that can be tied to the cursor change, we
  // don't want to announce anything.
  if (!this.hasUserGesture || this.cursorIsChanging_) {
    return;
  }

  this.cursorIsChanging_ = true;
  this.lastCursorRowString_ = cursorRowString;
  this.lastCursorRow_ = cursorRow;
  this.lastCursorColumn_ = cursorColumn;
};

/**
 * This should be called after the cursor on the screen has been updated. Note
 * that several updates to the cursor may have happened between
 * beforeCursorChange and afterCursorChange.
 *
 * This allows cursor changes to be tracked and related notifications to be
 * announced.
 *
 * @param {string} cursorRowString The text in the row that the cursor is
 *     currently on.
 * @param {number} cursorRow The index of the row that the cursor is currently
 *     on, including rows in the scrollback buffer.
 * @param {number} cursorColumn The index of the column that the cursor is
 *     currently on.
 */
hterm.AccessibilityReader.prototype.afterCursorChange =
    function(cursorRowString, cursorRow, cursorColumn) {
  // This can happen if clear() is called midway through a cursor change.
  if (!this.cursorIsChanging_) {
    return;
  }
  this.cursorIsChanging_ = false;

  if (!this.announceAction_(cursorRowString, cursorRow, cursorColumn)) {
    // If we don't announce a special action, we re-queue all the output that
    // was queued during the selection change.
    for (let i = 0; i < this.cursorChangeQueue_.length; ++i) {
      this.announce(this.cursorChangeQueue_[i]);
    }
  }

  this.cursorChangeQueue_ = [];
  this.lastCursorRowString_ = null;
  this.lastCursorRow_ = null;
  this.lastCursorColumn_ = null;
  this.hasUserGesture = false;
};

/**
 * Announce the command output.
 *
 * @param {string} str The string to announce using a live region.
 */
hterm.AccessibilityReader.prototype.announce = function(str) {
  if (!this.accessibilityEnabled) {
    return;
  }

  // If the cursor is in the middle of changing, we queue up the output
  // separately as we may not want it to be announced if it's part of a cursor
  // change announcement.
  if (this.cursorIsChanging_) {
    this.cursorChangeQueue_.push(str);
    return;
  }

  // Don't append newlines to the queue if the queue is empty. It won't have any
  // impact.
  if (str == '\n' && this.queue_.length > 0) {
    this.queue_.push('');
    // We don't need to trigger an announcement on newlines because they won't
    // change the existing content that's output.
    return;
  }

  if (this.queue_.length == 0) {
    this.queue_.push(str);
  } else {
    // We put a space between strings that appear on the same line.
    // TODO(raymes): We should check the location on the row and not add a space
    // if the strings are joined together.
    let padding = '';
    if (this.queue_[this.queue_.length - 1].length != 0) {
      padding = ' ';
    }
    this.queue_[this.queue_.length - 1] += padding + str;
  }

  // If we've already scheduled text being added to the live region, wait for it
  // to happen.
  if (this.nextReadTimer_) {
    return;
  }

  // If there's only one item in the queue, we may get other text being added
  // very soon after. In that case, wait a small delay so we can merge the
  // related strings.
  if (this.queue_.length == 1) {
    this.nextReadTimer_ = setTimeout(this.addToLiveRegion_.bind(this),
                                     hterm.AccessibilityReader.DELAY);
  } else {
    throw new Error(
        'Expected only one item in queue_ or nextReadTimer_ to be running.');
  }
};

/**
 * Voice an announcement that will interrupt other announcements.
 *
 * @param {string} str The string to announce using a live region.
 */
hterm.AccessibilityReader.prototype.assertiveAnnounce = function(str) {
  if (this.hasUserGesture && str == ' ') {
    str = hterm.msg('SPACE_CHARACTER', [], 'Space');
  }

  // If the same string is announced twice, an attribute change won't be
  // registered and the screen reader won't know that the string has changed.
  // So we slightly change the string to ensure that the attribute change gets
  // registered.
  str = str.trim();
  if (str == this.assertiveLiveElement_.innerText) {
    str = '\n' + str;
  }

  this.clear();
  this.assertiveLiveElement_.innerText = str;
};

/**
 * Add a newline to the text that will be announced to the live region.
 */
hterm.AccessibilityReader.prototype.newLine = function() {
  this.announce('\n');
};

/**
 * Clear the live region and any in-flight announcements.
 */
hterm.AccessibilityReader.prototype.clear = function() {
  this.liveElement_.innerText = '';
  this.assertiveLiveElement_.innerText = '';
  clearTimeout(this.nextReadTimer_);
  this.nextReadTimer_ = null;
  this.queue_ = [];

  this.cursorIsChanging_ = false;
  this.cursorChangeQueue_ = [];
  this.lastCursorRowString_ = null;
  this.lastCursorRow_ = null;
  this.lastCursorColumn_ = null;
  this.hasUserGesture = false;
};

/**
 * This will announce an action that is related to a cursor change, for example
 * when the user deletes a character we want the character deleted to be
 * announced. Similarly, when the user moves the cursor along the line, we want
 * the characters selected to be announced.
 *
 * Note that this function is a heuristic. Because of the nature of terminal
 * emulators, we can't distinguish input and output, which means we don't really
 * know what output is the result of a keypress and what isn't. Also in some
 * terminal applications certain announcements may make sense whereas others may
 * not. This function should try to account for the most common cases.
 *
 * @param {string} cursorRowString The text in the row that the cursor is
 *     currently on.
 * @param {number} cursorRow The index of the row that the cursor is currently
 *     on, including rows in the scrollback buffer.
 * @param {number} cursorColumn The index of the column that the cursor is
 *     currently on.
 * @return {boolean} Whether anything was announced.
 */
hterm.AccessibilityReader.prototype.announceAction_ =
    function(cursorRowString, cursorRow, cursorColumn) {
  // If the cursor changes rows, we don't announce anything at present.
  if (this.lastCursorRow_ != cursorRow) {
    return false;
  }

  // The case when the row of text hasn't changed at all.
  if (lib.notNull(this.lastCursorRowString_) === cursorRowString) {
    // Moving the cursor along the line. We check that no significant changes
    // have been queued. If they have, it may not just be a cursor movement and
    // it may be better to read those out.
    if (lib.notNull(this.lastCursorColumn_) !== cursorColumn &&
        this.cursorChangeQueue_.join('').trim() == '') {
      // Announce the text between the old cursor position and the new one.
      const start = Math.min(this.lastCursorColumn_, cursorColumn);
      const len = Math.abs(cursorColumn - this.lastCursorColumn_);
      this.assertiveAnnounce(
          lib.wc.substr(this.lastCursorRowString_, start, len));
      return true;
    }
    return false;
  }

  // The case when the row of text has changed.
  if (this.lastCursorRowString_ != cursorRowString) {
    // Spacebar. We manually announce this character since the screen reader may
    // not announce the whitespace in a live region.
    if (this.lastCursorColumn_ + 1 == cursorColumn) {
      if (lib.wc.substr(cursorRowString, cursorColumn - 1, 1) == ' ' &&
          this.cursorChangeQueue_.length > 0 &&
          this.cursorChangeQueue_[0] == ' ') {
        this.assertiveAnnounce(' ');
        return true;
      }
    }

    // Backspace and deletion.
    // The position of the characters deleted is right after the current
    // position of the cursor in the case of backspace and delete.
    const cursorDeleted = cursorColumn;
    // Check that the current row string is shorter than the previous. Also
    // check that the start of the strings (up to the cursor) match.
    if (lib.wc.strWidth(cursorRowString) <=
        lib.wc.strWidth(this.lastCursorRowString_) &&
        lib.wc.substr(this.lastCursorRowString_, 0, cursorDeleted) ==
        lib.wc.substr(cursorRowString, 0, cursorDeleted)) {
      // Find the length of the current row string ignoring space characters.
      // These may be inserted at the end of the string when deleting characters
      // so they should be ignored.
      let lengthOfCurrentRow = lib.wc.strWidth(cursorRowString);
      for (; lengthOfCurrentRow > 0; --lengthOfCurrentRow) {
        if (lengthOfCurrentRow == cursorDeleted ||
            lib.wc.substr(cursorRowString, lengthOfCurrentRow - 1, 1) != ' ') {
          break;
        }
      }

      const numCharsDeleted =
          lib.wc.strWidth(this.lastCursorRowString_) - lengthOfCurrentRow;

      // Check that the end of the strings match.
      const lengthOfEndOfString = lengthOfCurrentRow - cursorDeleted;
      const endOfLastRowString = lib.wc.substr(
          this.lastCursorRowString_, cursorDeleted + numCharsDeleted,
          lengthOfEndOfString);
      const endOfCurrentRowString =
          lib.wc.substr(cursorRowString, cursorDeleted, lengthOfEndOfString);
      if (endOfLastRowString == endOfCurrentRowString) {
        const deleted = lib.wc.substr(
            this.lastCursorRowString_, cursorDeleted, numCharsDeleted);
        if (deleted != '') {
          this.assertiveAnnounce(deleted);
          return true;
        }
      }
    }
    return false;
  }

  return false;
};

/**
 * Add text from queue_ to the live region.
 *
 */
hterm.AccessibilityReader.prototype.addToLiveRegion_ = function() {
  this.nextReadTimer_ = null;

  let str = this.queue_.join('\n').trim();

  // If the same string is announced twice, an attribute change won't be
  // registered and the screen reader won't know that the string has changed.
  // So we slightly change the string to ensure that the attribute change gets
  // registered.
  if (str == this.liveElement_.innerText) {
    str = '\n' + str;
  }

  this.liveElement_.innerText = str;
  this.queue_ = [];
};
// SOURCE FILE: hterm/js/hterm_contextmenu.js
// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Context menu handling.
 */

/**
 * Manage the context menu usually shown when right clicking.
 *
 * @constructor
 */
hterm.ContextMenu = function() {
  // The document that contains this context menu.
  this.document_ = null;
  // The generated context menu (i.e. HTML elements).
  this.element_ = null;
  // The structured menu (i.e. JS objects).
  /** @type {!Array<!hterm.ContextMenu.Item>} */
  this.menu_ = [];
};

/** @typedef {{name:(string|symbol), action:function(!Event)}} */
hterm.ContextMenu.Item;

/**
 * Constant to add a separator to the context menu.
 */
hterm.ContextMenu.SEPARATOR = Symbol('-');

/**
 * Bind context menu to a specific document element.
 *
 * @param {!Document} document The document to use when creating elements.
 */
hterm.ContextMenu.prototype.setDocument = function(document) {
  if (this.element_) {
    this.element_.remove();
    this.element_ = null;
  }
  this.document_ = document;
  this.regenerate_();
  this.document_.body.appendChild(this.element_);
};

/**
 * Regenerate the HTML elements based on internal menu state.
 */
hterm.ContextMenu.prototype.regenerate_ = function() {
  if (!this.element_) {
    this.element_ = this.document_.createElement('menu');
    this.element_.id = 'hterm:context-menu';
  } else {
    this.hide();
  }

  // Clear out existing menu entries.
  while (this.element_.firstChild) {
    this.element_.removeChild(this.element_.firstChild);
  }

  this.menu_.forEach(({name, action}) => {
    const menuitem = this.document_.createElement('menuitem');
    if (name === hterm.ContextMenu.SEPARATOR) {
      menuitem.innerHTML = hterm.sanitizeHtml('<hr>');
      menuitem.className = 'separator';
    } else {
      menuitem.innerText = name;
      menuitem.addEventListener('mousedown', function(e) {
        e.preventDefault();
        action(e);
      });
    }
    this.element_.appendChild(menuitem);
  });
};

/**
 * Set all the entries in the context menu.
 *
 * This is an array of arrays.  The first element in the array is the string to
 * display while the second element is the function to call.
 *
 * The first element may also be the SEPARATOR constant to add a separator.
 *
 * This resets all existing menu entries.
 *
 * @param {!Array<!hterm.ContextMenu.Item>} items The menu entries.
 */
hterm.ContextMenu.prototype.setItems = function(items) {
  this.menu_ = items;
  this.regenerate_();
};

/**
 * Show the context menu.
 *
 * The event is used to determine where to show the menu.
 *
 * If no menu entries are defined, then nothing will be shown.
 *
 * @param {!Event} e The event triggering this display.
 * @param {!hterm.Terminal=} terminal The terminal object to get style info
 *     from.
 */
hterm.ContextMenu.prototype.show = function(e, terminal) {
  // If there are no menu entries, then don't try to show anything.
  if (this.menu_.length == 0) {
    return;
  }

  // If we have the terminal, sync the style preferences over.
  if (terminal) {
    this.element_.style.fontSize = terminal.getFontSize();
    this.element_.style.fontFamily = terminal.getFontFamily();
  }

  this.element_.style.top = `${e.clientY}px`;
  this.element_.style.left = `${e.clientX}px`;
  const docSize = this.document_.body.getBoundingClientRect();

  this.element_.style.display = 'block';

  // We can't calculate sizes until after it's displayed.
  const eleSize = this.element_.getBoundingClientRect();
  // Make sure the menu isn't clipped outside of the current element.
  const minY = Math.max(0, docSize.height - eleSize.height);
  const minX = Math.max(0, docSize.width - eleSize.width);
  if (minY < e.clientY) {
    this.element_.style.top = `${minY}px`;
  }
  if (minX < e.clientX) {
    this.element_.style.left = `${minX}px`;
  }
};

/**
 * Hide the context menu.
 */
hterm.ContextMenu.prototype.hide = function() {
  if (!this.element_) {
    return;
  }

  this.element_.style.display = 'none';
};
// SOURCE FILE: hterm/js/hterm_frame.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * First draft of the interface between the terminal and a third party dialog.
 *
 * This is rough.  It's just the terminal->dialog layer.  To complete things
 * we'll also need a command->terminal layer.  That will have to facilitate
 * command->terminal->dialog or direct command->dialog communication.
 *
 * I imagine this class will change significantly when that happens.
 */

/**
 * Construct a new frame for the given terminal.
 *
 * @param {!hterm.Terminal} terminal The parent terminal object.
 * @param {string} url The url to load in the frame.
 * @param {!Object=} options Optional options for the frame.  Not implemented.
 * @constructor
 */
hterm.Frame = function(terminal, url, options = {}) {
  this.terminal_ = terminal;
  this.div_ = terminal.div_;
  this.url = url;
  this.options = options;
  this.iframe_ = null;
  this.container_ = null;
  this.messageChannel_ = null;
};

/**
 * Handle messages from the iframe.
 *
 * @param {!MessageEvent} e The message to process.
 */
hterm.Frame.prototype.onMessage_ = function(e) {
  switch (e.data.name) {
    case 'ipc-init-ok':
      // We get this response after we send them ipc-init and they finish.
      this.sendTerminalInfo_();
      return;
    case 'terminal-info-ok':
      // We get this response after we send them terminal-info and they finish.
      // Show the finished frame, and then rebind our message handler to the
      // callback below.
      this.container_.style.display = 'flex';
      this.postMessage('visible');
      this.messageChannel_.port1.onmessage = this.onMessage.bind(this);
      this.onLoad();
      return;
    default:
      console.log('Unknown message from frame:', e.data);
  }
};

/**
 * Clients could override this, I guess.
 *
 * It doesn't support multiple listeners, but I'm not sure that would make sense
 * here.  It's probably better to speak directly to our parents.
 */
hterm.Frame.prototype.onMessage = function() {};

/**
 * Handle iframe onLoad event.
 */
hterm.Frame.prototype.onLoad_ = function() {
  this.messageChannel_ = new MessageChannel();
  this.messageChannel_.port1.onmessage = this.onMessage_.bind(this);
  this.messageChannel_.port1.start();
  this.iframe_.contentWindow.postMessage(
      {name: 'ipc-init', argv: [{messagePort: this.messageChannel_.port2}]},
      this.url, [this.messageChannel_.port2]);
};

/**
 * Clients may override this.
 */
hterm.Frame.prototype.onLoad = function() {};

/**
 * Sends the terminal-info message to the iframe.
 */
hterm.Frame.prototype.sendTerminalInfo_ = function() {
  lib.i18n.getAcceptLanguages().then((languages) => {
    this.postMessage('terminal-info', [{
      acceptLanguages: languages,
      foregroundColor: this.terminal_.getForegroundColor(),
      backgroundColor: this.terminal_.getBackgroundColor(),
      cursorColor: this.terminal_.getCssVar('cursor-color'),
      fontSize: this.terminal_.getFontSize(),
      fontFamily: this.terminal_.getFontFamily(),
      baseURL: lib.f.getURL('/'),
    }]);
  });
};

/**
 * User clicked the close button on the frame decoration.
 */
hterm.Frame.prototype.onCloseClicked_ = function() {
  this.close();
};

/**
 * Close this frame.
 */
hterm.Frame.prototype.close = function() {
  if (!this.container_ || !this.container_.parentNode) {
    return;
  }

  this.container_.remove();
  this.onClose();
};


/**
 * Clients may override this.
 */
hterm.Frame.prototype.onClose = function() {};

/**
 * Send a message to the iframe.
 *
 * @param {string} name The message name.
 * @param {!Array=} argv The message arguments.
 */
hterm.Frame.prototype.postMessage = function(name, argv) {
  if (!this.messageChannel_) {
    throw new Error('Message channel is not set up.');
  }

  this.messageChannel_.port1.postMessage({name: name, argv: argv});
};

/**
 * Show the UI for this frame.
 *
 * The iframe src is not loaded until this method is called.
 */
hterm.Frame.prototype.show = function() {
  if (this.container_ && this.container_.parentNode) {
    console.error('Frame already visible');
    return;
  }

  const document = this.terminal_.document_;

  const container = this.container_ = document.createElement('div');
  container.style.cssText = (
      'position: absolute;' +
      'display: none;' +
      'flex-direction: column;' +
      'top: 10%;' +
      'left: 4%;' +
      'width: 90%;' +
      'height: 80%;' +
      'min-height: 20%;' +
      'max-height: 80%;' +
      'box-shadow: 0 0 2px ' + this.terminal_.getForegroundColor() + ';' +
      'border: 2px ' + this.terminal_.getForegroundColor() + ' solid;');

  const iframe = this.iframe_ = document.createElement('iframe');
  iframe.onload = this.onLoad_.bind(this);
  iframe.style.cssText = (
      'display: flex;' +
      'flex: 1;' +
      'width: 100%');
  iframe.setAttribute('src', this.url);
  iframe.setAttribute('seamless', true);
  container.appendChild(iframe);

  this.div_.appendChild(container);
};
// SOURCE FILE: hterm/js/hterm_keyboard.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Keyboard handler.
 *
 * Consumes onKey* events and invokes onVTKeystroke on the associated
 * hterm.Terminal object.
 *
 * See also: [XTERM] as referenced in vt.js.
 *
 * @param {!hterm.Terminal} terminal The Terminal object associated with this
 *     keyboard.
 * @constructor
 */
hterm.Keyboard = function(terminal) {
  // The parent vt interpreter.
  this.terminal = terminal;

  /**
   * The current key map.
   */
  this.keyMap = new hterm.Keyboard.KeyMap(this);

  /**
   * Enable/disable application keypad.
   *
   * This changes the way numeric keys are sent from the keyboard.
   */
  this.applicationKeypad = false;

  /**
   * Enable/disable the application cursor mode.
   *
   * This changes the way cursor keys are sent from the keyboard.
   */
  this.applicationCursor = false;

  /**
   * If true, the backspace should send BS ('\x08', aka ^H).  Otherwise
   * the backspace key should send '\x7f'.
   */
  this.backspaceSendsBackspace = false;
};

/**
 * Special handling for keyCodes in a keyboard layout.
 *
 * @enum {symbol}
 * @const
 */
hterm.Keyboard.KeyActions = {
  /**
   * Call preventDefault and stopPropagation for this key event and nothing
   * else.
   */
  CANCEL: Symbol('CANCEL'),

  /**
   * This performs the default terminal action for the key.  If used in the
   * 'normal' action and the the keystroke represents a printable key, the
   * character will be sent to the host.  If used in one of the modifier
   * actions, the terminal will perform the normal action after (possibly)
   * altering it.
   *
   *  - If the normal sequence starts with CSI, the sequence will be adjusted
   *    to include the modifier parameter as described in [XTERM] in the final
   *    table of the "PC-Style Function Keys" section.
   *
   *  - If the control key is down and the key represents a printable character,
   *    and the uppercase version of the unshifted keycap is between
   *    64 (ASCII '@') and 95 (ASCII '_'), then the uppercase version of the
   *    unshifted keycap minus 64 is sent.  This makes '^@' send '\x00' and
   *    '^_' send '\x1f'.  (Note that one higher that 0x1f is 0x20, which is
   *    the first printable ASCII value.)
   *
   *  - If the alt key is down and the key represents a printable character then
   *    the value of the character is shifted up by 128.
   *
   *  - If meta is down and configured to send an escape, '\x1b' will be sent
   *    before the normal action is performed.
   */
  DEFAULT: Symbol('DEFAULT'),

  /**
   * Causes the terminal to opt out of handling the key event, instead letting
   * the browser deal with it.
   */
  PASS: Symbol('PASS'),

  /**
   * Insert the first or second character of the keyCap, based on e.shiftKey.
   * The key will be handled in onKeyDown, and e.preventDefault() will be
   * called.
   *
   * It is useful for a modified key action, where it essentially strips the
   * modifier while preventing the browser from reacting to the key.
   */
  STRIP: Symbol('STRIP'),
};

/** @typedef {string|!hterm.Keyboard.KeyActions} */
hterm.Keyboard.KeyAction;

// SOURCE FILE: hterm/js/hterm_keyboard_bindings.js
// Copyright (c) 2015 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @typedef {{
 *     keyCode: number,
 *     shift: (boolean|undefined),
 *     ctrl: (boolean|undefined),
 *     alt: (boolean|undefined),
 *     meta: (boolean|undefined),
 * }}
 */
hterm.Keyboard.KeyDown;

/**
 * @typedef {function(!hterm.Terminal, !hterm.Keyboard.KeyDown):
 *               !hterm.Keyboard.KeyAction}
 */
hterm.Keyboard.KeyBindingFunction;

/** @typedef {!hterm.Keyboard.KeyAction|!hterm.Keyboard.KeyBindingFunction} */
hterm.Keyboard.KeyBindingAction;

/**
 * @typedef {{
 *     keyPattern: !hterm.Keyboard.KeyPattern,
 *     action: !hterm.Keyboard.KeyBindingAction,
 * }}
 */
hterm.Keyboard.KeyBinding;

// SOURCE FILE: hterm/js/hterm_keyboard_keymap.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @typedef {{
 *     keyCap: string,
 *     normal: !hterm.Keyboard.KeyDefAction,
 *     control: !hterm.Keyboard.KeyDefAction,
 *     alt: !hterm.Keyboard.KeyDefAction,
 *     meta: !hterm.Keyboard.KeyDefAction,
 * }}
 */
hterm.Keyboard.KeyDef;

/**
 * @typedef {function(!KeyboardEvent, !hterm.Keyboard.KeyDef):
 *               !hterm.Keyboard.KeyAction}
 */
hterm.Keyboard.KeyDefFunction;

/**
 * @typedef {function(!KeyboardEvent, !hterm.Keyboard.KeyDef):
 *               !hterm.Keyboard.KeyDefFunction|!hterm.Keyboard.KeyAction}
 */
hterm.Keyboard.KeyDefFunctionProvider;

/**
 * @typedef {(
 *      !hterm.Keyboard.KeyAction|
 *      !hterm.Keyboard.KeyDefFunction|
 *      !hterm.Keyboard.KeyDefFunctionProvider
 *  )}
 */
hterm.Keyboard.KeyDefAction;

/**
 * The default key map for hterm.
 *
 * Contains a mapping of keyCodes to keyDefs (aka key definitions).  The key
 * definition tells the hterm.Keyboard class how to handle keycodes.
 *
 * This should work for most cases, as the printable characters get handled
 * in the keypress event.  In that case, even if the keycap is wrong in the
 * key map, the correct character should be sent.
 *
 * Different layouts, such as Dvorak should work with this keymap, as those
 * layouts typically move keycodes around on the keyboard without disturbing
 * the actual keycaps.
 *
 * There may be issues with control keys on non-US keyboards or with keyboards
 * that very significantly from the expectations here, in which case we may
 * have to invent new key maps.
 *
 * The sequences defined in this key map come from [XTERM] as referenced in
 * vt.js, starting with the section titled "Alt and Meta Keys".
 *
 * @param {!hterm.Keyboard} keyboard
 * @constructor
 */
hterm.Keyboard.KeyMap = function(keyboard) {
  this.keyboard = keyboard;
  /** @type {!Object<number, !hterm.Keyboard.KeyDef>} */
  this.keyDefs = {};
  this.reset();
};

/**
 * Add a single key definition.
 *
 * The definition is an object containing the following fields: 'keyCap',
 * 'normal', 'control', 'alt', and 'meta'.
 *
 *  - keyCap is a string identifying the key on the keyboard.  For printable
 *    keys, the key cap should be exactly two characters, starting with the
 *    unshifted version.  For example, 'aA', 'bB', '1!' and '=+'.  For
 *    non-printable the key cap should be surrounded in square braces, as in
 *    '[INS]', '[LEFT]'.  By convention, non-printable keycaps are in uppercase
 *    but this is not a strict requirement.
 *
 *  - Normal is the action that should be performed when the key is pressed
 *    in the absence of any modifier.  See below for the supported actions.
 *
 *  - Control is the action that should be performed when the key is pressed
 *    along with the control modifier.  See below for the supported actions.
 *
 *  - Alt is the action that should be performed when the key is pressed
 *    along with the alt modifier.  See below for the supported actions.
 *
 *  - Meta is the action that should be performed when the key is pressed
 *    along with the meta modifier.  See below for the supported actions.
 *
 * Actions can be one of the hterm.Keyboard.KeyActions as documented below,
 * a literal string, or an array.  If the action is a literal string then
 * the string is sent directly to the host.  If the action is an array it
 * is taken to be an escape sequence that may be altered by modifier keys.
 * The second-to-last element of the array will be overwritten with the
 * state of the modifier keys, as specified in the final table of "PC-Style
 * Function Keys" from [XTERM].
 *
 * @param {number} keyCode The KeyboardEvent.keyCode to match against.
 * @param {!hterm.Keyboard.KeyDef} def The actions this key triggers.
 */
hterm.Keyboard.KeyMap.prototype.addKeyDef = function(keyCode, def) {
  if (keyCode in this.keyDefs) {
    console.warn('Duplicate keyCode: ' + keyCode);
  }

  this.keyDefs[keyCode] = def;
};

/**
 * Set up the default state for this keymap.
 */
hterm.Keyboard.KeyMap.prototype.reset = function() {
  this.keyDefs = {};

  const CANCEL = hterm.Keyboard.KeyActions.CANCEL;
  const DEFAULT = hterm.Keyboard.KeyActions.DEFAULT;
  const PASS = hterm.Keyboard.KeyActions.PASS;
  const STRIP = hterm.Keyboard.KeyActions.STRIP;

  /**
   * This function is used by the "macro" functions below.  It makes it
   * possible to use the call() macro as an argument to any other macro.
   *
   * @param {!hterm.Keyboard.KeyDefAction} action
   * @param {!KeyboardEvent} e
   * @param {!hterm.Keyboard.KeyDef} k
   * @return {!hterm.Keyboard.KeyAction}
   */
  const resolve = (action, e, k) => {
    if (typeof action == 'function') {
      const keyDefFn = /** @type {!hterm.Keyboard.KeyDefFunction} */ (action);
      return keyDefFn.call(this, e, k);
    }
    return action;
  };

  /**
   * If mod or not application cursor a, else b.  The keys that care about
   * application cursor ignore it when the key is modified.
   *
   * @param {!hterm.Keyboard.KeyDefAction} a
   * @param {!hterm.Keyboard.KeyDefAction} b
   * @return {!hterm.Keyboard.KeyDefFunction}
   */
  const ac = (a, b) => {
    return (e, k) => {
      const action = (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey ||
                      !this.keyboard.applicationCursor) ? a : b;
      return resolve(action, e, k);
    };
  };

  /**
   * If not e.shiftKey a, else b.
   *
   * @param {!hterm.Keyboard.KeyDefAction} a
   * @param {!hterm.Keyboard.KeyDefAction} b
   * @return {!hterm.Keyboard.KeyDefFunction}
   */
  const sh = (a, b) => {
    return (e, k) => {
      const action = !e.shiftKey ? a : b;
      e.maskShiftKey = true;
      return resolve(action, e, k);
    };
  };

  /**
   * If not e.altKey a, else b.
   *
   * @param {!hterm.Keyboard.KeyDefAction} a
   * @param {!hterm.Keyboard.KeyDefAction} b
   * @return {!hterm.Keyboard.KeyDefFunction}
   */
  const alt = (a, b) => {
    return (e, k) => {
      const action = !e.altKey ? a : b;
      return resolve(action, e, k);
    };
  };

  /**
   * If no modifiers a, else b.
   *
   * @param {!hterm.Keyboard.KeyDefAction} a
   * @param {!hterm.Keyboard.KeyDefAction} b
   * @return {!hterm.Keyboard.KeyDefFunction}
   */
  const mod = (a, b) => {
    return (e, k) => {
      const action = !(e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) ?
        a : b;
      return resolve(action, e, k);
    };
  };

  /**
   * Compute a control character for a given character.
   *
   * @param {string} ch
   * @return {string}
   */
  const ctl = (ch) => String.fromCharCode(ch.charCodeAt(0) - 64);

  /**
   * Call a method on the keymap instance.
   *
   * @param {string} m name of method to call.
   * @return {(
   *     !hterm.Keyboard.KeyDefFunction|
   *     !hterm.Keyboard.KeyDefFunctionProvider
   * )}
   */
  const c = (m) => {
    return (e, k) => this[m](e, k);
  };

  // Ignore if not trapping media keys.
  const med = (fn) => {
    return (e, k) => {
      return resolve(fn, e, k);
    };
  };

  /**
   * @param {number} keyCode
   * @param {string} keyCap
   * @param {!hterm.Keyboard.KeyDefAction} normal
   * @param {!hterm.Keyboard.KeyDefAction} control
   * @param {!hterm.Keyboard.KeyDefAction} alt
   * @param {!hterm.Keyboard.KeyDefAction} meta
   */
  const add = (keyCode, keyCap, normal, control, alt, meta) => {
    this.addKeyDef(keyCode, {
      keyCap: keyCap,
      normal: normal,
      control: control,
      alt: alt,
      meta: meta,
    });
  };

  // Browser-specific differences.
  // let keycapMute;
  // let keycapVolDn;
  // let keycapVolDn
  let keycapSC;
  let keycapEP;
  let keycapMU;
  if (window.navigator && navigator.userAgent &&
      navigator.userAgent.includes('Firefox')) {
    // Firefox defines some keys uniquely.  No other browser defines these in
    // this way.  Some even conflict.  The keyCode field isn't well documented
    // as it isn't standardized.  At some point we should switch to "key".
    // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode
    // http://unixpapa.com/js/key.html
    // keycapMute = 181;   // Mute
    // keycapVolDn = 182;  // Volume Down
    // keycapVolUp = 183;  // Volume Up
    keycapSC = 59;      // ;:
    keycapEP = 61;      // =+
    keycapMU = 173;     // -_

    // Firefox Italian +*.
    add(171, '+*', DEFAULT, c('onZoom_'), DEFAULT, c('onZoom_'));
  } else {
    // All other browsers use these mappings.
    // keycapMute = 173;   // Mute
    // keycapVolDn = 174;  // Volume Down
    // keycapVolUp = 175;  // Volume Up
    keycapSC = 186;     // ;:
    keycapEP = 187;     // =+
    keycapMU = 189;     // -_
  }

  const ESC = '\x1b';
  const CSI = '\x1b[';
  const SS3 = '\x1bO';

  // These fields are: [keycode, keycap, normal, control, alt, meta]
  /* eslint-disable no-multi-spaces */

  // The browser sends the keycode 0 for some keys.  We'll just assume it's
  // going to do the right thing by default for those keys.
  add(0,   '[UNKNOWN]', PASS, PASS, PASS, PASS);

  // First row.
  // These bindings match xterm for lack of a better standard.  The emitted
  // values might look like they're skipping values, but it's what xterm does.
  // https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-PC-Style-Function-Keys
  add(27,  '[ESC]', ESC,                       DEFAULT, DEFAULT,     DEFAULT);
  add(112, '[F1]',  mod(SS3 + 'P', CSI + 'P'), DEFAULT, CSI + '23~', DEFAULT);
  add(113, '[F2]',  mod(SS3 + 'Q', CSI + 'Q'), DEFAULT, CSI + '24~', DEFAULT);
  add(114, '[F3]',  mod(SS3 + 'R', CSI + 'R'), DEFAULT, CSI + '25~', DEFAULT);
  add(115, '[F4]',  mod(SS3 + 'S', CSI + 'S'), DEFAULT, CSI + '26~', DEFAULT);
  add(116, '[F5]',  CSI + '15~',               DEFAULT, CSI + '28~', DEFAULT);
  add(117, '[F6]',  CSI + '17~',               DEFAULT, CSI + '29~', DEFAULT);
  add(118, '[F7]',  CSI + '18~',               DEFAULT, CSI + '31~', DEFAULT);
  add(119, '[F8]',  CSI + '19~',               DEFAULT, CSI + '32~', DEFAULT);
  add(120, '[F9]',  CSI + '20~',               DEFAULT, CSI + '33~', DEFAULT);
  add(121, '[F10]', CSI + '21~',               DEFAULT, CSI + '34~', DEFAULT);
  add(122, '[F11]', c('onF11_'),               DEFAULT, CSI + '42~', DEFAULT);
  add(123, '[F12]', CSI + '24~',               DEFAULT, CSI + '43~', DEFAULT);

  // Second row.
  add(192, '`~', DEFAULT, sh(ctl('@'), ctl('^')),     DEFAULT,           PASS);
  add(49,  '1!', DEFAULT, PASS,               c('onAltNum_'), c('onMetaNum_'));
  add(50,  '2@', DEFAULT, PASS,               c('onAltNum_'), c('onMetaNum_'));
  add(51,  '3#', DEFAULT, PASS,               c('onAltNum_'), c('onMetaNum_'));
  add(52,  '4$', DEFAULT, PASS,               c('onAltNum_'), c('onMetaNum_'));
  add(53,  '5%', DEFAULT, PASS,               c('onAltNum_'), c('onMetaNum_'));
  add(54,  '6^', DEFAULT, PASS,               c('onAltNum_'), c('onMetaNum_'));
  add(55,  '7&', DEFAULT, PASS,               c('onAltNum_'), c('onMetaNum_'));
  add(56,  '8*', DEFAULT, PASS,               c('onAltNum_'), c('onMetaNum_'));
  add(57,  '9(', DEFAULT, PASS,               c('onAltNum_'), c('onMetaNum_'));
  add(48,  '0)', DEFAULT, c('onZoom_'),       c('onAltNum_'), c('onZoom_'));
  add(keycapMU, '-_', DEFAULT, c('onZoom_'),  DEFAULT,        c('onZoom_'));
  add(keycapEP, '=+', DEFAULT, c('onZoom_'),  DEFAULT,        c('onZoom_'));

  // add(8, '[BKSP]', ...);

  // Third row.
  add(9,   '[TAB]', sh('\t', c('onShiftTab_')), PASS, PASS, DEFAULT);
  add(81,  'qQ',    DEFAULT,             ctl('Q'),  DEFAULT, DEFAULT);
  add(87,  'wW',    DEFAULT,             ctl('W'),  DEFAULT, DEFAULT);
  add(69,  'eE',    DEFAULT,             ctl('E'),  DEFAULT, DEFAULT);
  add(82,  'rR',    DEFAULT,             ctl('R'),  DEFAULT, DEFAULT);
  add(84,  'tT',    DEFAULT,             ctl('T'),  DEFAULT, DEFAULT);
  add(89,  'yY',    DEFAULT,             ctl('Y'),  DEFAULT, DEFAULT);
  add(85,  'uU',    DEFAULT,             ctl('U'),  DEFAULT, DEFAULT);
  add(73,  'iI',    DEFAULT,             ctl('I'),  DEFAULT, DEFAULT);
  add(79,  'oO',    DEFAULT,             ctl('O'),  DEFAULT, DEFAULT);
  add(80,  'pP',    DEFAULT,             ctl('P'),  DEFAULT, DEFAULT);
  add(219, '[{',    DEFAULT,             ctl('['),  DEFAULT, DEFAULT);
  add(221, ']}',    DEFAULT,             ctl(']'),  DEFAULT, DEFAULT);
  add(220, '\\|',   DEFAULT,             ctl('\\'), DEFAULT, DEFAULT);

  // Fourth row. We let Ctrl+Shift+J pass for Chrome DevTools.
  // To be compliant with xterm's behavior for modifiers on Enter
  // would mean maximizing the window with Alt+Enter... so we don't
  // want to do that. Our behavior on Enter is what most other
  // modern emulators do.
  add(20,  '[CAPS]',  PASS,    PASS,                        PASS,    DEFAULT);
  add(65,  'aA',      DEFAULT, sh(ctl('A'), PASS),          DEFAULT, DEFAULT);
  add(83,  'sS',      DEFAULT, ctl('S'),                    DEFAULT, DEFAULT);
  add(68,  'dD',      DEFAULT, ctl('D'),                    DEFAULT, DEFAULT);
  add(70,  'fF',      DEFAULT, ctl('F'),                    DEFAULT, DEFAULT);
  add(71,  'gG',      DEFAULT, ctl('G'),                    DEFAULT, DEFAULT);
  add(72,  'hH',      DEFAULT, ctl('H'),                    DEFAULT, ctl('W'));
  add(74,  'jJ',      DEFAULT, sh(ctl('J'), PASS),          DEFAULT, DEFAULT);
  add(75,  'kK',      DEFAULT, sh(ctl('K'), c('onClear_')), DEFAULT, DEFAULT);
  add(76,  'lL',      DEFAULT, sh(ctl('L'), PASS),          DEFAULT, DEFAULT);
  add(keycapSC, ';:', DEFAULT, STRIP,                       DEFAULT, DEFAULT);
  add(222, '\'"',     DEFAULT, STRIP,                       DEFAULT, DEFAULT);
  add(13,  '[ENTER]', '\r',    DEFAULT,                     DEFAULT, DEFAULT);

  // Fifth row.  This includes the copy/paste shortcuts.  On some
  // platforms it's Ctrl+C/V, on others it's Meta+C/V.  We assume either
  // Ctrl+C/Meta+C should pass to the browser when there is a selection,
  // and Ctrl+Shift+V/Meta+*+V should always pass to the browser (since
  // these seem to be recognized as paste too).
  add(16,  '[SHIFT]', PASS, PASS,                  PASS,    DEFAULT);
  add(90,  'zZ',   DEFAULT, ctl('Z'),              DEFAULT, DEFAULT);
  add(88,  'xX',   DEFAULT, ctl('X'),              DEFAULT, DEFAULT);
  add(67,  'cC',   DEFAULT, c('onCtrlC_'),         DEFAULT, c('onMetaC_'));
  add(86,  'vV',   DEFAULT, c('onCtrlV_'),         DEFAULT, c('onMetaV_'));
  add(66,  'bB',   DEFAULT, ctl('B'),              DEFAULT, DEFAULT);
  add(78,  'nN',   DEFAULT, ctl('N'),              DEFAULT, c('onMetaN_'));
  add(77,  'mM',   DEFAULT, ctl('M'),              DEFAULT, DEFAULT);
  add(188, ',<',   DEFAULT, alt(STRIP, PASS),      DEFAULT, DEFAULT);
  add(190, '.>',   DEFAULT, alt(STRIP, PASS),      DEFAULT, DEFAULT);
  add(191, '/?',   DEFAULT, sh(ctl('_'), ctl('?')), DEFAULT, DEFAULT);

  // Sixth and final row.
  add(17,  '[CTRL]',  PASS,    PASS,     PASS,    PASS);
  add(18,  '[ALT]',   PASS,    PASS,     PASS,    PASS);
  add(91,  '[LAPL]',  PASS,    PASS,     PASS,    PASS);
  add(32,  ' ',       DEFAULT, ctl('@'), DEFAULT, DEFAULT);
  add(92,  '[RAPL]',  PASS,    PASS,     PASS,    PASS);
  add(93,  '[RMENU]', PASS,    PASS,     PASS,    PASS);

  // These things.
  add(42,  '[PRTSCR]', PASS, PASS, PASS, PASS);
  add(145, '[SCRLK]',  PASS, PASS, PASS, PASS);
  add(19,  '[BREAK]',  PASS, PASS, PASS, PASS);

  // The block of six keys above the arrows.
  add(45,  '[INSERT]', c('onKeyInsert_'),   DEFAULT, DEFAULT, DEFAULT);
  add(36,  '[HOME]',   c('onKeyHome_'),     DEFAULT, DEFAULT, DEFAULT);
  add(33,  '[PGUP]',   c('onKeyPageUp_'),   DEFAULT, DEFAULT, DEFAULT);
  add(46,  '[DEL]',    '\x1b[3~',           DEFAULT, DEFAULT, DEFAULT);
  add(35,  '[END]',    c('onKeyEnd_'),      DEFAULT, DEFAULT, DEFAULT);
  add(34,  '[PGDOWN]', c('onKeyPageDown_'), DEFAULT, DEFAULT, DEFAULT);

  // Arrow keys.  When unmodified they respect the application cursor state,
  // otherwise they always send the CSI codes.
  add(38, '[UP]',    c('onKeyArrowUp_'), DEFAULT, DEFAULT, DEFAULT);
  add(40, '[DOWN]',  c('onKeyArrowDown_'), DEFAULT, DEFAULT, DEFAULT);
  add(39, '[RIGHT]', ac(CSI + 'C', SS3 + 'C'), DEFAULT, DEFAULT, DEFAULT);
  add(37, '[LEFT]',  ac(CSI + 'D', SS3 + 'D'), DEFAULT, DEFAULT, DEFAULT);

  add(144, '[NUMLOCK]', PASS, PASS, PASS, PASS);

  // On Apple keyboards, the NumLock key is a Clear key.  It also tends to be
  // what KP5 sends when numlock is off.  Not clear if we could do anything
  // useful with it, so just pass it along.
  add(12, '[CLEAR]', PASS, PASS, PASS, PASS);

  // With numlock off, the keypad generates the same key codes as the arrows
  // and 'block of six' for some keys, and null key codes for the rest.

  // Keypad with numlock on generates unique key codes...
  add(96,  '[KP0]', DEFAULT, DEFAULT,      DEFAULT, DEFAULT);
  add(97,  '[KP1]', DEFAULT, DEFAULT,      DEFAULT, DEFAULT);
  add(98,  '[KP2]', DEFAULT, DEFAULT,      DEFAULT, DEFAULT);
  add(99,  '[KP3]', DEFAULT, DEFAULT,      DEFAULT, DEFAULT);
  add(100, '[KP4]', DEFAULT, DEFAULT,      DEFAULT, DEFAULT);
  add(101, '[KP5]', DEFAULT, DEFAULT,      DEFAULT, DEFAULT);
  add(102, '[KP6]', DEFAULT, DEFAULT,      DEFAULT, DEFAULT);
  add(103, '[KP7]', DEFAULT, DEFAULT,      DEFAULT, DEFAULT);
  add(104, '[KP8]', DEFAULT, DEFAULT,      DEFAULT, DEFAULT);
  add(105, '[KP9]', DEFAULT, DEFAULT,      DEFAULT, DEFAULT);
  add(107, '[KP+]', DEFAULT, c('onZoom_'), DEFAULT, c('onZoom_'));
  add(109, '[KP-]', DEFAULT, c('onZoom_'), DEFAULT, c('onZoom_'));
  add(106, '[KP*]', DEFAULT, DEFAULT,      DEFAULT, DEFAULT);
  add(111, '[KP/]', DEFAULT, DEFAULT,      DEFAULT, DEFAULT);
  add(110, '[KP.]', DEFAULT, DEFAULT,      DEFAULT, DEFAULT);

  // OS-specific differences.
  if (hterm.os == 'cros') {
    // ChromeOS keyboard top row.  The media-keys-are-fkeys preference allows
    // users to make these always behave as function keys (see those bindings
    // above for more details).
    /* eslint-disable max-len */
    add(166, '[BACK]',   med(mod(SS3 + 'P', CSI + 'P')), DEFAULT, CSI + '23~', DEFAULT);  // F1
    add(167, '[FWD]',    med(mod(SS3 + 'Q', CSI + 'Q')), DEFAULT, CSI + '24~', DEFAULT);  // F2
    add(168, '[RELOAD]', med(mod(SS3 + 'R', CSI + 'R')), DEFAULT, CSI + '25~', DEFAULT);  // F3
    add(183, '[FSCR]',   med(mod(SS3 + 'S', CSI + 'S')), DEFAULT, CSI + '26~', DEFAULT);  // F4
    add(182, '[WINS]',   med(CSI + '15~'),               DEFAULT, CSI + '28~', DEFAULT);  // F5
    add(216, '[BRIT-]',  med(CSI + '17~'),               DEFAULT, CSI + '29~', DEFAULT);  // F6
    add(217, '[BRIT+]',  med(CSI + '18~'),               DEFAULT, CSI + '31~', DEFAULT);  // F7
    add(173, '[MUTE]',   med(CSI + '19~'),               DEFAULT, CSI + '32~', DEFAULT);  // F8
    add(174, '[VOL-]',   med(CSI + '20~'),               DEFAULT, CSI + '33~', DEFAULT);  // F9
    add(175, '[VOL+]',   med(CSI + '21~'),               DEFAULT, CSI + '34~', DEFAULT);  // F10
    /* eslint-enable max-len */

    // We could make this into F11, but it'd be a bit weird.  Chrome allows us
    // to see this and react, but it doesn't actually allow us to block or
    // cancel it, so it makes the screen flash/lock still.
    add(152, '[POWER]', DEFAULT, DEFAULT, DEFAULT, DEFAULT);

    // The Pixelbook has a slightly different layout.  This means half the keys
    // above are off by one.  https://crbug.com/807513
    add(179, '[PLAY]', med(CSI + '18~'), DEFAULT, CSI + '31~', DEFAULT); // F7
    // The settings / hamburgers / three hot dogs / menu / whatever-it's-called.
    add(154, '[DOGS]', med(CSI + '23~'), DEFAULT, CSI + '42~', DEFAULT); // F11

    // We don't use this for anything, but keep it from popping up by default.
    add(153, '[ASSIST]', DEFAULT, DEFAULT, DEFAULT, DEFAULT);
  }
  /* eslint-enable no-multi-spaces */
};

/**
 * Either allow the paste or send a key sequence.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onKeyInsert_ = function(e) {
  if (e.shiftKey) {
    return hterm.Keyboard.KeyActions.PASS;
  }

  return '\x1b[2~';
};

/**
 * Either scroll the scrollback buffer or send a key sequence.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onKeyHome_ = function(e) {
  if (!e.shiftKey) {
    if ((e.altKey || e.ctrlKey || e.shiftKey) ||
        !this.keyboard.applicationCursor) {
      return '\x1b[H';
    }

    return '\x1bOH';
  }

  this.keyboard.terminal.scrollHome();
  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Either scroll the scrollback buffer or send a key sequence.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onKeyEnd_ = function(e) {
  if (!e.shiftKey) {
    if ((e.altKey || e.ctrlKey || e.shiftKey) ||
        !this.keyboard.applicationCursor) {
      return '\x1b[F';
    }

    return '\x1bOF';
  }

  this.keyboard.terminal.scrollEnd();
  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Either scroll the scrollback buffer or send a key sequence.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onKeyPageUp_ = function(e) {
  if (!e.shiftKey) {
    return '\x1b[5~';
  }

  this.keyboard.terminal.scrollPageUp();
  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Either scroll the scrollback buffer or send a key sequence.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onKeyPageDown_ = function(e) {
  if (!e.shiftKey) {
    return '\x1b[6~';
  }

  this.keyboard.terminal.scrollPageDown();
  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Either scroll the scrollback buffer or send a key sequence.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onKeyArrowUp_ = function(e) {
  if (!this.keyboard.applicationCursor && e.shiftKey) {
    this.keyboard.terminal.scrollLineUp();
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  return (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey ||
          !this.keyboard.applicationCursor) ? '\x1b[A' : '\x1bOA';
};

/**
 * Either scroll the scrollback buffer or send a key sequence.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onKeyArrowDown_ = function(e) {
  if (!this.keyboard.applicationCursor && e.shiftKey) {
    this.keyboard.terminal.scrollLineDown();
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  return (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey ||
          !this.keyboard.applicationCursor) ? '\x1b[B' : '\x1bOB';
};

/**
 * Clear the primary/alternate screens and the scrollback buffer.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onClear_ = function(e) {
  this.keyboard.terminal.wipeContents();
  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Handle F11 behavior (fullscreen) when not in a window.
 *
 * It would be nice to use the Fullscreen API, but the UX is slightly different
 * a bad way: the Escape key is automatically registered for exiting.  If we let
 * the browser handle F11 directly though, we still get to capture Escape.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onF11_ = function(e) {
  if (hterm.windowType !== 'popup' && hterm.windowType !== 'app' &&
      !e.shiftKey) {
    return hterm.Keyboard.KeyActions.PASS;
  } else {
    return '\x1b[23~';
  }
};

/**
 * Either pass Alt+1..9 to the browser or send them to the host.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onAltNum_ = function(e) {
  if (this.keyboard.terminal.passAltNumber && !e.shiftKey) {
    return hterm.Keyboard.KeyActions.PASS;
  }

  return hterm.Keyboard.KeyActions.DEFAULT;
};

/**
 * Either pass Meta+1..9 to the browser or send them to the host.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onMetaNum_ = function(e) {
  if (this.keyboard.terminal.passMetaNumber && !e.shiftKey) {
    return hterm.Keyboard.KeyActions.PASS;
  }

  return hterm.Keyboard.KeyActions.DEFAULT;
};

/**
 * Either send a ^C or interpret the keystroke as a copy command.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onCtrlC_ = function(e) {
  const selection = this.keyboard.terminal.getDocument().getSelection();

  if (!selection.isCollapsed) {
    if (e.shiftKey) {
      // Ctrl+Shift+C should copy if there is a selection, send ^C otherwise.
      // Perform the copy manually.  This only works in situations where
      // document.execCommand('copy') is allowed.
      if (this.keyboard.terminal.clearSelectionAfterCopy) {
        setTimeout(selection.collapseToEnd.bind(selection), 50);
      }
      this.keyboard.terminal.copySelectionToClipboard();
      return hterm.Keyboard.KeyActions.CANCEL;
    }
  }

  return '\x03';
};

/**
 * Either send a ^V or issue a paste command.
 *
 * The default behavior is to paste if the user presses Ctrl+Shift+V, and send
 * a ^V if the user presses Ctrl+V.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onCtrlV_ = function(e) {
  if (e.shiftKey) {
    // We try to do the pasting ourselves as not all browsers/OSs bind Ctrl+V to
    // pasting.  Notably, on macOS, Ctrl+V/Ctrl+Shift+V do nothing.
    // However, this might run into web restrictions, so if it fails, we still
    // fallback to the letting the native behavior (hopefully) save us.
    if (this.keyboard.terminal.paste() !== false) {
      return hterm.Keyboard.KeyActions.CANCEL;
    } else {
      return hterm.Keyboard.KeyActions.PASS;
    }
  }

  return '\x16';
};

/**
 * Either the default action or open a new window to the same location.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onMetaN_ = function(e) {
  if (e.shiftKey) {
    lib.f.openWindow(document.location.href, '',
                     'chrome=no,close=yes,resize=yes,scrollbars=yes,' +
                     'minimizable=yes,width=' + window.outerWidth +
                     ',height=' + window.outerHeight);
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  return hterm.Keyboard.KeyActions.DEFAULT;
};

/**
 * Either send a Meta+C or allow the browser to interpret the keystroke as a
 * copy command.
 *
 * If there is no selection, or if the user presses Meta+Shift+C, then we'll
 * transmit 'c' or 'C'.
 *
 * If there is a selection, we defer to the browser.  In this case we clear out
 * the selection so the user knows we heard them, and also to give them a
 * chance to send a Meta+C by just hitting the key again.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @param {!hterm.Keyboard.KeyDef} keyDef Key definition.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onMetaC_ = function(e, keyDef) {
  const document = this.keyboard.terminal.getDocument();
  if (e.shiftKey || document.getSelection().isCollapsed) {
    // If the shift key is being held, or there is no document selection, send
    // a Meta+C. We just have to decide between 'c' and 'C'.
    return keyDef.keyCap.substr(e.shiftKey ? 1 : 0, 1);
  }

  // Otherwise let the browser handle it as a copy command.
  if (this.keyboard.terminal.clearSelectionAfterCopy) {
    setTimeout(function() { document.getSelection().collapseToEnd(); }, 50);
  }
  return hterm.Keyboard.KeyActions.PASS;
};

/**
 * Either PASS or DEFAULT Meta+V, depending on preference.
 *
 * Always PASS Meta+Shift+V to allow browser to interpret the keystroke as
 * a paste command.
 *
 * @param {!KeyboardEvent} e The event to process.
 * @return {symbol|string} Key action or sequence.
 */
hterm.Keyboard.KeyMap.prototype.onMetaV_ = function(e) {
  return hterm.Keyboard.KeyActions.PASS;
};

hterm.Keyboard.KeyMap.prototype.onZoom_ = function() {};
// SOURCE FILE: hterm/js/hterm_keyboard_keypattern.js
// Copyright (c) 2015 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * A record of modifier bits and keycode used to define a key binding.
 *
 * The modifier names are enumerated in the static KeyPattern.modifiers
 * property below.  Each modifier can be true, false, or "*".  True means
 * the modifier key must be present, false means it must not, and "*" means
 * it doesn't matter.
 *
 * @param {!hterm.Keyboard.KeyDown} spec
 * @constructor
 */
hterm.Keyboard.KeyPattern = function(spec) {
  this.wildcardCount = 0;
  this.keyCode = spec.keyCode;

  hterm.Keyboard.KeyPattern.modifiers.forEach(function(mod) {
    this[mod] = spec[mod] || false;
    if (this[mod] == '*') {
      this.wildcardCount++;
    }
  }.bind(this));
};

/**
 * Valid modifier names.
 */
hterm.Keyboard.KeyPattern.modifiers = [
  'shift', 'ctrl', 'alt', 'meta',
];

/**
 * A compare callback for Array.prototype.sort().
 *
 * The bindings code wants to be sure to search through the strictest key
 * patterns first, so that loosely defined patterns have a lower priority than
 * exact patterns.
 *
 * @param {!hterm.Keyboard.KeyPattern} a
 * @param {!hterm.Keyboard.KeyPattern} b
 * @return {number}
 */
hterm.Keyboard.KeyPattern.sortCompare = function(a, b) {
  if (a.wildcardCount < b.wildcardCount) {
    return -1;
  }

  if (a.wildcardCount > b.wildcardCount) {
    return 1;
  }

  return 0;
};

/**
 * Private method used to match this key pattern against other key patterns
 * or key down events.
 *
 * @param {!hterm.Keyboard.KeyDown} obj The object to match.
 * @param {boolean} exactMatch True if we should ignore wildcards.  Useful when
 *     you want
 *   to perform and exact match against another key pattern.
 * @return {boolean}
 */
hterm.Keyboard.KeyPattern.prototype.match_ = function(obj, exactMatch) {
  if (this.keyCode != obj.keyCode) {
    return false;
  }

  let rv = true;

  hterm.Keyboard.KeyPattern.modifiers.forEach(function(mod) {
    const modValue = (mod in obj) ? obj[mod] : false;
    if (!rv || (!exactMatch && this[mod] == '*') || this[mod] == modValue) {
      return;
    }

    rv = false;
  }.bind(this));

  return rv;
};

/**
 * Return true if the given keyDown object is a match for this key pattern.
 *
 * @param {!hterm.Keyboard.KeyDown} keyDown An object with a keyCode property
 *     and zero or more boolean properties representing key modifiers.  These
 *     property names must match those defined in
 *     hterm.Keyboard.KeyPattern.modifiers.
 * @return {boolean}
 */
hterm.Keyboard.KeyPattern.prototype.matchKeyDown = function(keyDown) {
  return this.match_(keyDown, false);
};

/**
 * Return true if the given hterm.Keyboard.KeyPattern is exactly the same as
 * this one.
 *
 * @param {!hterm.Keyboard.KeyPattern} keyPattern
 * @return {boolean}
 */
hterm.Keyboard.KeyPattern.prototype.matchKeyPattern = function(keyPattern) {
  return this.match_(keyPattern, true);
};
// SOURCE FILE: hterm/js/hterm_notifications.js
// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview A UI for managing user notifications.  It's a distinct UI space
 *     from the terminal itself to help users clearly distinguish between remote
 *     output.  This makes it hard for the remote to spoof the user.
 */

/**
 * Class that controls everything about the notification center.
 */
hterm.NotificationCenter = class {
  /**
   * @param {!Element} parent The node that we will display inside.
   * @param {?hterm.AccessibilityReader=} reader Helper for reading content.
   */
  constructor(parent, reader = undefined) {
    this.parent_ = parent;
    this.reader_ = reader;
    this.container_ = this.newContainer_();
    /** @type {?number} Id for automatic hiding timeout. */
    this.timeout_ = null;
    /** @type {number} Fadeout delay (for tests to control). */
    this.fadeout_ = 200;
  }

  /** @return {!Element} */
  newContainer_() {
    const ele = this.parent_.ownerDocument.createElement('div');
    ele.setAttribute('role', 'dialog');
    ele.style.cssText =
        'color: rgb(var(--hterm-background-color));' +
        'background-color: rgb(var(--hterm-foreground-color));' +
        'border-radius: 12px;' +
        'font: 500 var(--hterm-font-size) "Noto Sans", sans-serif;' +
        'opacity: 0.75;' +
        'padding: 0.923em 1.846em;' +
        'position: absolute;' +
        'user-select: none;' +
        'transition: opacity 180ms ease-in;';

    // Prevent the dialog from gaining focus.
    ele.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
    }, true);

    return ele;
  }

  /**
   * Show a notification for the specified duration.
   *
   * The notification appears in inverse video, centered over the terminal.
   *
   * @param {string|!Node} msg The message to display.
   * @param {{
   *     timeout: (?number|undefined),
   * }=} options
   *     timeout: How long (millisec) to wait before hiding the notification.
   *         Pass null to never autohide.
   */
  show(msg, {timeout = 1500} = {}) {
    const node = typeof msg === 'string' ? new Text(msg) : msg;

    // Hacky heuristic: if we're currently showing a notification w/out a
    // timeout, and the new one includes a timeout, leave the existing one
    // alone.  We should rework this stack a bit to give more power to the
    // callers, but for now, this should be OK.
    if (this.container_.parentNode && this.timeout_ === null &&
        timeout !== null) {
      return;
    }

    // Remove all children first.
    this.container_.textContent = '';
    this.container_.appendChild(node);
    this.container_.style.opacity = '0.75';

    // Display on the page if it isn't already.
    if (!this.container_.parentNode) {
      this.parent_.appendChild(this.container_);
    }

    // Keep the notification centered.
    const size = this.container_.getBoundingClientRect();
    this.container_.style.top = `calc(50% - ${size.height / 2}px)`;
    this.container_.style.left = `calc(50% - ${size.width / 2}px)`;

    if (this.reader_) {
      this.reader_.assertiveAnnounce(this.container_.textContent);
    }

    // Handle automatic hiding of the UI.
    if (this.timeout_) {
      clearTimeout(this.timeout_);
      this.timeout_ = null;
    }
    if (timeout === null) {
      return;
    }
    this.timeout_ = setTimeout(() => {
      this.container_.style.opacity = '0';
      this.timeout_ = setTimeout(() => this.hide(), this.fadeout_);
    }, timeout);
  }

  /**
   * Hide the active notification immediately.
   *
   * Useful when we show a message for an event with an unknown end time.
   */
  hide() {
    if (this.timeout_) {
      clearTimeout(this.timeout_);
      this.timeout_ = null;
    }

    this.container_.remove();
    // Remove all children in case there was sensitive content shown that we
    // don't want to leave laying around.
    this.container_.textContent = '';
  }
};
// SOURCE FILE: hterm/js/hterm_options.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file implements the hterm.Options class,
 * which stores current operating conditions for the terminal.  This object is
 * used instead of a series of parameters to allow saving/restoring of cursor
 * conditions easily, and to provide an easy place for common configuration
 * options.
 *
 * Original code by Cory Maccarrone.
 */

/**
 * Constructor for the hterm.Options class, optionally acting as a copy
 * constructor.
 *
 * The defaults are as defined in http://www.vt100.net/docs/vt510-rm/DECSTR
 * except that we enable autowrap (wraparound) by default since that seems to
 * be what xterm does.
 *
 * @param {!hterm.Options=} copy Optional instance to copy.
 * @constructor
 */
hterm.Options = function(copy = undefined) {
  // All attributes in this class are public to allow easy access by the
  // terminal.

  this.wraparound = copy ? copy.wraparound : true;
  this.reverseWraparound = copy ? copy.reverseWraparound : false;
  this.originMode = copy ? copy.originMode : false;
  this.autoCarriageReturn = copy ? copy.autoCarriageReturn : false;
  this.cursorVisible = copy ? copy.cursorVisible : true;
  this.cursorBlink = copy ? copy.cursorBlink : false;
  this.insertMode = copy ? copy.insertMode : false;
  this.reverseVideo = copy ? copy.reverseVideo : false;
  this.bracketedPaste = copy ? copy.bracketedPaste : false;
};
// SOURCE FILE: hterm/js/hterm_preference_manager.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * PreferenceManager subclass managing global NaSSH preferences.
 *
 * This is currently just an ordered list of known connection profiles.
 *
 * @param {!lib.Storage} storage Where to store preferences.
 * @param {string=} profileId Uses 'default' if not specified.
 * @extends {lib.PreferenceManager}
 * @constructor
 */
hterm.PreferenceManager = function(
    storage, profileId = hterm.Terminal.DEFAULT_PROFILE_ID) {
  lib.PreferenceManager.call(this, storage,
                             hterm.PreferenceManager.prefix_ + profileId);
  Object.entries(hterm.PreferenceManager.defaultPreferences).forEach(
      ([key, entry]) => {
        this.definePreference(key, entry['default']);
      });
};

/**
 * The storage key prefix to namespace the preferences.
 */
hterm.PreferenceManager.prefix_ = '/hterm/profiles/';

/**
 * List all the defined profiles.
 *
 * @param {!lib.Storage} storage Where to look for profiles.
 * @param {function(!Array<string>)} callback Called with the list of profiles.
 */
hterm.PreferenceManager.listProfiles = function(storage, callback) {
  storage.getItems(null).then((items) => {
    const profiles = {};
    for (const key of Object.keys(items)) {
      if (key.startsWith(hterm.PreferenceManager.prefix_)) {
        // Turn "/hterm/profiles/foo/bar/cow" to "foo/bar/cow".
        const subKey = key.slice(hterm.PreferenceManager.prefix_.length);
        // Turn "foo/bar/cow" into "foo".
        profiles[subKey.split('/', 1)[0]] = true;
      }
    }
    callback(Object.keys(profiles));
  });
};

/** @enum {string} */
hterm.PreferenceManager.Categories = {
  Keyboard: 'Keyboard',
  Appearance: 'Appearance',
  CopyPaste: 'CopyPaste',
  Sounds: 'Sounds',
  Scrolling: 'Scrolling',
  Encoding: 'Encoding',
  Extensions: 'Extensions',
  Miscellaneous: 'Miscellaneous',
};

/**
 * List of categories, ordered by display order (top to bottom)
 */
hterm.PreferenceManager.categoryDefinitions = [
  {id: hterm.PreferenceManager.Categories.Appearance,
    text: 'Appearance (fonts, colors, images)'},
  {id: hterm.PreferenceManager.Categories.CopyPaste,
    text: 'Copy & Paste'},
  {id: hterm.PreferenceManager.Categories.Encoding,
    text: 'Encoding'},
  {id: hterm.PreferenceManager.Categories.Keyboard,
    text: 'Keyboard'},
  {id: hterm.PreferenceManager.Categories.Scrolling,
    text: 'Scrolling'},
  {id: hterm.PreferenceManager.Categories.Sounds,
    text: 'Sounds'},
  {id: hterm.PreferenceManager.Categories.Extensions,
    text: 'Extensions'},
  {id: hterm.PreferenceManager.Categories.Miscellaneous,
    text: 'Miscellaneous'},
];

/**
 * Internal helper to create a default preference object.
 *
 * @param {string} name The user readable name/title.
 * @param {!hterm.PreferenceManager.Categories} category The pref category.
 * @param {boolean|number|string|?Object} defaultValue The default pref value.
 * @param {string|!Array<string|null>} type The type for this pref (or an array
 *     for enums).
 * @param {string} help The user readable help text.
 * @return {!Object} The default pref object.
 */
hterm.PreferenceManager.definePref_ = function(
    name, category, defaultValue, type, help) {
  return {
    'name': name,
    'category': category,
    'default': defaultValue,
    'type': type,
    'help': help,
  };
};

hterm.PreferenceManager.defaultPreferences = {
  'desktop-notification-bell': hterm.PreferenceManager.definePref_(
      'Create desktop notifications for alert bells',
      hterm.PreferenceManager.Categories.Sounds,
      false, 'bool',
      `If true, terminal bells in the background will create a Web ` +
      `Notification. https://www.w3.org/TR/notifications/\n` +
      `\n` +
      `Displaying notifications requires permission from the user. When this ` +
      `option is set to true, hterm will attempt to ask the user for ` +
      `permission if necessary. Browsers might not show this permission ` +
      `request if it was not triggered by a user action.\n` +
      `\n` +
      `Chrome extensions with the "notifications" permission have permission ` +
      `to display notifications.`,
  ),

  'background-color': hterm.PreferenceManager.definePref_(
      'Background color',
      hterm.PreferenceManager.Categories.Appearance,
      'rgb(26, 26, 26)', 'color',
      `The background color for text with no other color attributes.`,
  ),

  'background-image': hterm.PreferenceManager.definePref_(
      'Background image',
      hterm.PreferenceManager.Categories.Appearance,
      '', 'string',
      `CSS value of the background image. Leave it blank for no image.\n` +
      `\n` +
      `For example:\n` +
      `  url(https://goo.gl/anedTK)\n` +
      `  linear-gradient(top bottom, blue, red)`,
  ),

  'background-size': hterm.PreferenceManager.definePref_(
      'Background image size',
      hterm.PreferenceManager.Categories.Appearance,
      '', 'string',
      `CSS value of the background image size.`,
  ),

  'background-position': hterm.PreferenceManager.definePref_(
      'Background image position',
      hterm.PreferenceManager.Categories.Appearance,
      '', 'string',
      `CSS value of the background image position.\n` +
      `\n` +
      `For example:\n` +
      `  10% 10%\n` +
      `  center`,
  ),

  'backspace-sends-backspace': hterm.PreferenceManager.definePref_(
      'Backspace key behavior',
      hterm.PreferenceManager.Categories.Keyboard,
      false, 'bool',
      `If true, the Backspace key will send BS ('\\x08', aka ^H). Otherwise ` +
      `the Backspace key will send '\\x7f'.`,
  ),

  'character-map-overrides': hterm.PreferenceManager.definePref_(
      'Character map overrides',
      hterm.PreferenceManager.Categories.Appearance,
      null, 'value',
      `This is specified as an object. It is a sparse array, where each ` +
      `property is the character set code and the value is an object that is ` +
      `a sparse array itself. In that sparse array, each property is the ` +
      `received character and the value is the displayed character.\n` +
      `\n` +
      `For example:\n` +
      `{ "0": {\n` +
      `  "+": "\\u2192",\n` +
      `  ",": "\\u2190",\n` +
      `  "-": "\\u2191",\n` +
      `  ".": "\\u2193",\n` +
      `  "0": "\\u2588"\n} }`,
  ),

  // TODO(crbug.com/1258487): remove this after all users has migrated.
  'close-on-exit': hterm.PreferenceManager.definePref_(
      'Close window on exit',
      hterm.PreferenceManager.Categories.Miscellaneous,
      true, 'bool',
      `Whether to close the window when the command finishes executing.`,
  ),

  'color-palette-overrides': hterm.PreferenceManager.definePref_(
      'Initial color palette',
      hterm.PreferenceManager.Categories.Appearance,
      null, 'value',
      `Override colors in the default palette.\n` +
      `\n` +
      `This can be specified as an array or an object. If specified as an ` +
      `object it is assumed to be a sparse array, where each property ` +
      `is a numeric index into the color palette.\n` +
      `\n` +
      `Values can be specified as almost any CSS color value. This ` +
      `includes #RGB, #RRGGBB, rgb(...), rgba(...), and any color names ` +
      `that are also part of the standard X11 rgb.txt file.\n` +
      `\n` +
      `You can use 'null' to specify that the default value should be not ` +
      `be changed. This is useful for skipping a small number of indices ` +
      `when the value is specified as an array.\n` +
      `\n` +
      `For example, these both set color index 1 to blue:\n` +
      `  {1: "#0000ff"}\n` +
      `  [null, "#0000ff"]`,
  ),

  'copy-on-select': hterm.PreferenceManager.definePref_(
      'Automatically copy selected content',
      hterm.PreferenceManager.Categories.CopyPaste,
      true, 'bool',
      `Automatically copy mouse selection to the clipboard.`,
  ),

  'use-default-window-copy': hterm.PreferenceManager.definePref_(
      'Let the browser handle text copying',
      hterm.PreferenceManager.Categories.CopyPaste,
      false, 'bool',
      `Whether to use the default browser/OS's copy behavior.\n` +
      `\n` +
      `Allow the browser/OS to handle the copy event directly which might ` +
      `improve compatibility with some systems (where copying doesn't work ` +
      `at all), but makes the text selection less robust.\n` +
      `\n` +
      `For example, long lines that were automatically line wrapped will ` +
      `be copied with the newlines still in them.`,
  ),

  'clear-selection-after-copy': hterm.PreferenceManager.definePref_(
      'Automatically clear text selection',
      hterm.PreferenceManager.Categories.CopyPaste,
      true, 'bool',
      `Whether to clear the selection after copying.`,
  ),

  'east-asian-ambiguous-as-two-column': hterm.PreferenceManager.definePref_(
      'East Asian Ambiguous use two columns',
      hterm.PreferenceManager.Categories.Keyboard,
      false, 'bool',
      `Whether East Asian Ambiguous characters have two column width.`,
  ),

  'enable-8-bit-control': hterm.PreferenceManager.definePref_(
      'Support non-UTF-8 C1 control characters',
      hterm.PreferenceManager.Categories.Keyboard,
      false, 'bool',
      `True to enable 8-bit control characters, false to ignore them.\n` +
      `\n` +
      `We'll respect the two-byte versions of these control characters ` +
      `regardless of this setting.`,
  ),

  'enable-bold': hterm.PreferenceManager.definePref_(
      'Bold text behavior',
      hterm.PreferenceManager.Categories.Appearance,
      false, 'tristate',
      `If true, use bold weight font for text with the bold/bright ` +
      `attribute. False to use the normal weight font. Null to autodetect.`,
  ),

  'enable-bold-as-bright': hterm.PreferenceManager.definePref_(
      'Use bright colors with bold text',
      hterm.PreferenceManager.Categories.Appearance,
      true, 'bool',
      `If true, use bright colors (8-15 on a 16 color palette) for any text ` +
      `with the bold attribute. False otherwise.`,
  ),

  'enable-blink': hterm.PreferenceManager.definePref_(
      'Enable blinking text',
      hterm.PreferenceManager.Categories.Appearance,
      true, 'bool',
      `If true, respect the blink attribute. False to ignore it.`,
  ),

  'enable-clipboard-notice': hterm.PreferenceManager.definePref_(
      'Show notification when copying content',
      hterm.PreferenceManager.Categories.CopyPaste,
      true, 'bool',
      `Whether to show a message in the terminal when the host writes to the ` +
      `clipboard.`,
  ),

  'enable-clipboard-write': hterm.PreferenceManager.definePref_(
      'Allow remote clipboard writes',
      hterm.PreferenceManager.Categories.CopyPaste,
      true, 'bool',
      `Allow the remote host to write directly to the local system ` +
      `clipboard.\n` +
      `Read access is never granted regardless of this setting.\n` +
      `\n` +
      `This is used to control access to features like OSC-52.`,
  ),

  'enable-dec12': hterm.PreferenceManager.definePref_(
      'Allow changing of text cursor blinking',
      hterm.PreferenceManager.Categories.Miscellaneous,
      false, 'bool',
      `Respect the host's attempt to change the text cursor blink status ` +
      `using DEC Private Mode 12.`,
  ),

  'enable-csi-j-3': hterm.PreferenceManager.definePref_(
      'Allow clearing of scrollback buffer (CSI-J-3)',
      hterm.PreferenceManager.Categories.Miscellaneous,
      true, 'bool',
      `Whether the Erase Saved Lines function (mode 3) of the Erase Display ` +
      `command (CSI-J) may clear the terminal scrollback buffer.\n` +
      `\n` +
      `Enabling this by default is safe.`,
  ),

  'environment': hterm.PreferenceManager.definePref_(
      'Environment variables',
      hterm.PreferenceManager.Categories.Miscellaneous,
      {
        // Signal ncurses based apps to use UTF-8 output instead of legacy
        // drawing modes (which only work in ISO-2022 mode).  Since hterm is
        // always UTF-8, this shouldn't cause problems.
        'NCURSES_NO_UTF8_ACS': '1',
        'TERM': 'xterm-256color',
        // Set this env var that a bunch of mainstream terminal emulators set
        // to indicate we support true colors.
        // https://gist.github.com/XVilka/8346728
        'COLORTERM': 'truecolor',
      },
      'value',
      `The initial set of environment variables, as an object.`,
  ),

  'font-smoothing': hterm.PreferenceManager.definePref_(
      'Text font smoothing',
      hterm.PreferenceManager.Categories.Appearance,
      'antialiased', 'string',
      `CSS font-smoothing property.`,
  ),

  'foreground-color': hterm.PreferenceManager.definePref_(
      'Text color',
      hterm.PreferenceManager.Categories.Appearance,
      'rgb(230, 230, 230)', 'color',
      `The foreground color for text with no other color attributes.`,
  ),

  'enable-resize-status': hterm.PreferenceManager.definePref_(
      'Show terminal dimensions when resized',
      hterm.PreferenceManager.Categories.Appearance,
      false, 'bool',
      `Whether to show terminal dimensions when the terminal changes size.`,
  ),

  'hide-mouse-while-typing': hterm.PreferenceManager.definePref_(
      'Hide mouse cursor while typing',
      hterm.PreferenceManager.Categories.Keyboard,
      null, 'tristate',
      `Whether to automatically hide the mouse cursor when typing. ` +
      `By default, autodetect whether the platform/OS handles this.\n` +
      `\n` +
      `Note: Your operating system might override this setting and thus you ` +
      `might not be able to always disable it.`,
  ),

  'mouse-right-click-paste': hterm.PreferenceManager.definePref_(
      'Mouse right clicks paste content',
      hterm.PreferenceManager.Categories.CopyPaste,
      true, 'bool',
      `Paste on right mouse button clicks.\n` +
      `\n` +
      `This option is independent of the "mouse-paste-button" setting.\n` +
      `\n` +
      `Note: The primary & secondary buttons are handled for you with left ` +
      `& right handed mice.`,
  ),

  'mouse-paste-button': hterm.PreferenceManager.definePref_(
      'Mouse button paste',
      hterm.PreferenceManager.Categories.CopyPaste,
      null, [null, 0, 1, 2, 3, 4, 5, 6],
      `The mouse button to use for pasting.\n` +
      `\n` +
      `For autodetect, we'll use the middle mouse button for non-X11 ` +
      `platforms (including ChromeOS). On X11, we'll use the right mouse ` +
      `button (since the window manager should handle pasting via the middle ` +
      `mouse button).\n` +
      `\n` +
      `0 == left (primary) button.\n` +
      `1 == middle (auxiliary) button.\n` +
      `2 == right (secondary) button.\n` +
      `\n` +
      `This option is independent of the setting for right-click paste.\n` +
      `\n` +
      `Note: The primary & secondary buttons are handled for you with left ` +
      `& right handed mice.`,
  ),

  'screen-padding-size': hterm.PreferenceManager.definePref_(
      'Screen padding size',
      hterm.PreferenceManager.Categories.Appearance,
      3, 'int',
      `The padding size in pixels around the border of the terminal screen.\n` +
      `\n` +
      `This controls the size of the border around the terminal screen so ` +
      `the user can add some visible padding to the edges of the screen.`,
  ),

  'screen-border-size': hterm.PreferenceManager.definePref_(
      'Screen border size',
      hterm.PreferenceManager.Categories.Appearance,
      1, 'int',
      `The border size in pixels around the terminal screen.\n` +
      `\n` +
      `This controls the size of the border around the terminal screen to ` +
      `create a visible line at the edges of the screen.`,
  ),

  'screen-border-color': hterm.PreferenceManager.definePref_(
      'Screen border color',
      hterm.PreferenceManager.Categories.Appearance,
      'rgb(0, 64, 64)', 'color',
      `The color for the border around the terminal screen.\n` +
      `\n` +
      `This controls the color of the border around the terminal screen to ` +
      `create a visible line at the edges of the screen.`,
  ),

  'word-break-match-left': hterm.PreferenceManager.definePref_(
      'Automatic selection halting (to the left)',
      hterm.PreferenceManager.Categories.CopyPaste,
      // TODO(vapier): Switch \u back to ‘“‹« once builders are fixed.
      '[^\\s[\\](){}<>"\'^!@#$%&*,;:`\u{2018}\u{201c}\u{2039}\u{ab}]', 'string',
      `Regular expression to halt matching to the left (start) of a ` +
      `selection.\n` +
      `\n` +
      `Normally this is a character class to reject specific characters.\n` +
      `We allow "~" and "." by default as paths frequently start with those.`,
  ),

  'word-break-match-right': hterm.PreferenceManager.definePref_(
      'Automatic selection halting (to the right)',
      hterm.PreferenceManager.Categories.CopyPaste,
      // TODO(vapier): Switch \u back to ’”›» once builders are fixed.
      '[^\\s[\\](){}<>"\'^!@#$%&*,;:~.`\u{2019}\u{201d}\u{203a}\u{bb}]',
      'string',
      `Regular expression to halt matching to the right (end) of a ` +
      `selection.\n` +
      `\n` +
      `Normally this is a character class to reject specific characters.`,
  ),

  'word-break-match-middle': hterm.PreferenceManager.definePref_(
      'Word break characters',
      hterm.PreferenceManager.Categories.CopyPaste,
      '[^\\s[\\](){}<>"\'^]*', 'string',
      `Regular expression to match all the characters in the middle.\n` +
      `\n` +
      `Normally this is a character class to reject specific characters.\n` +
      `\n` +
      `Used to expand the selection surrounding the starting point.`,
  ),

  'page-keys-scroll': hterm.PreferenceManager.definePref_(
      'Page Up/Down key scroll behavior',
      hterm.PreferenceManager.Categories.Keyboard,
      false, 'bool',
      `If true, Page Up/Page Down controls the terminal scrollbar and ` +
      `Shift+Page Up/Shift+Page Down are sent to the remote host. If false, ` +
      `then Page Up/Page Down are sent to the remote host and Shift+Page Up/` +
      `Shift+Page Down scrolls.`,
  ),

  'pass-alt-number': hterm.PreferenceManager.definePref_(
      'Alt+1..9 switch tab/app behavior',
      hterm.PreferenceManager.Categories.Keyboard,
      null, 'tristate',
      `Whether Alt+1..9 is passed to the browser.\n` +
      `\n` +
      `This is handy when running hterm in a browser tab, so that you don't ` +
      `lose Chrome's "switch to tab/app" keyboard shortcuts. When not ` +
      `running in a tab it's better to send these keys to the host so they ` +
      `can be used in vim or emacs.\n` +
      `\n` +
      `If true, Alt+1..9 will be handled by the browser. If false, Alt+1..9 ` +
      `will be sent to the host. If null, autodetect based on browser ` +
      `platform and window type.`,
  ),

  'pass-meta-number': hterm.PreferenceManager.definePref_(
      'Meta+1..9 switch tab behavior',
      hterm.PreferenceManager.Categories.Keyboard,
      null, 'tristate',
      `Whether Meta+1..9 is passed to the browser.\n` +
      `\n` +
      `This is handy when running hterm in a browser tab, so that you don't ` +
      `lose Chrome's "switch to tab" keyboard shortcuts. When not running ` +
      `in a tab it's better to send these keys to the host so they can be ` +
      `used in vim or emacs.\n` +
      `\n` +
      `If true, Meta+1..9 will be handled by the browser. If false, ` +
      `Meta+1..9 will be sent to the host. If null, autodetect based on ` +
      `browser platform and window type.`,
  ),

  'paste-on-drop': hterm.PreferenceManager.definePref_(
      'Allow drag & drop to paste',
      hterm.PreferenceManager.Categories.CopyPaste,
      true, 'bool',
      `If true, Drag and dropped text will paste into terminal.\n` +
      `If false, dropped text will be ignored.`,
  ),

  'scroll-on-keystroke': hterm.PreferenceManager.definePref_(
      'Scroll to bottom after keystroke',
      hterm.PreferenceManager.Categories.Scrolling,
      true, 'bool',
      `Whether to scroll to the bottom on any keystroke.`,
  ),

  'scroll-on-output': hterm.PreferenceManager.definePref_(
      'Scroll to bottom after new output',
      hterm.PreferenceManager.Categories.Scrolling,
      false, 'bool',
      `Whether to scroll to the bottom on terminal output.`,
  ),

  'scrollbar-visible': hterm.PreferenceManager.definePref_(
      'Scrollbar visibility',
      hterm.PreferenceManager.Categories.Scrolling,
      true, 'bool',
      `The vertical scrollbar mode.`,
  ),

  'scroll-wheel-may-send-arrow-keys': hterm.PreferenceManager.definePref_(
      'Emulate arrow keys with scroll wheel',
      hterm.PreferenceManager.Categories.Scrolling,
      false, 'bool',
      `When using the alternative screen buffer, and DECCKM (Application ` +
      `Cursor Keys) is active, mouse scroll wheel events will emulate arrow ` +
      `keys.\n` +
      `\n` +
      `It can be temporarily disabled by holding the Shift key.\n` +
      `\n` +
      `This frequently comes up when using pagers (less) or reading man ` +
      `pages or text editors (vi/nano) or using screen/tmux.`,
  ),

  'scroll-wheel-move-multiplier': hterm.PreferenceManager.definePref_(
      'Mouse scroll wheel multiplier',
      hterm.PreferenceManager.Categories.Scrolling,
      1, 'int',
      `The multiplier for mouse scroll wheel events when measured in ` +
      `pixels.\n` +
      `\n` +
      `Alters how fast the page scrolls.`,
  ),

  'terminal-encoding': hterm.PreferenceManager.definePref_(
      'Terminal encoding',
      hterm.PreferenceManager.Categories.Encoding,
      'utf-8', ['iso-2022', 'utf-8', 'utf-8-locked'],
      `The default terminal encoding (DOCS).\n` +
      `\n` +
      `ISO-2022 enables character map translations (like graphics maps).\n` +
      `UTF-8 disables support for those.\n` +
      `\n` +
      `The locked variant means the encoding cannot be changed at runtime ` +
      `via terminal escape sequences.\n` +
      `\n` +
      `You should stick with UTF-8 unless you notice broken rendering with ` +
      `legacy applications.`,
  ),

  'allow-images-inline': hterm.PreferenceManager.definePref_(
      'Allow inline image display',
      hterm.PreferenceManager.Categories.Extensions,
      null, 'tristate',
      `Whether to allow the remote host to display images in the terminal.\n` +
      `\n` +
      `By default, we prompt until a choice is made.`,
  ),
};

hterm.PreferenceManager.prototype =
    Object.create(lib.PreferenceManager.prototype);
/** @override */
hterm.PreferenceManager.constructor = hterm.PreferenceManager;

/**
 * Changes profile and notifies all listeners with updated values.
 *
 * @param {string} profileId New profile to use.
 * @param {function()=} callback Optional function to invoke when completed.
 */
hterm.PreferenceManager.prototype.setProfile = function(profileId, callback) {
  lib.PreferenceManager.prototype.setPrefix.call(
      this, hterm.PreferenceManager.prefix_ + profileId, callback);
};
// SOURCE FILE: hterm/js/hterm_pubsub.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Utility class used to add publish/subscribe/unsubscribe functionality to
 * an existing object.
 *
 * @constructor
 */
hterm.PubSub = function() {
  this.observers_ = {};
};

/**
 * Add publish, subscribe, and unsubscribe methods to an existing object.
 *
 * No other properties of the object are touched, so there is no need to
 * worry about clashing private properties.
 *
 * @param {!Object} obj The object to add this behavior to.
 */
hterm.PubSub.addBehavior = function(obj) {
  const pubsub = new hterm.PubSub();
  for (const m in hterm.PubSub.prototype) {
    obj[m] = hterm.PubSub.prototype[m].bind(pubsub);
  }
};

/**
 * Subscribe to be notified of messages about a subject.
 *
 * @param {string} subject The subject to subscribe to.
 * @param {function(...)} callback The function to invoke for notifications.
 */
hterm.PubSub.prototype.subscribe = function(subject, callback) {
  if (!(subject in this.observers_)) {
    this.observers_[subject] = [];
  }

  this.observers_[subject].push(callback);
};

/**
 * Unsubscribe from a subject.
 *
 * @param {string} subject The subject to unsubscribe from.
 * @param {function(...)} callback A callback previously registered via
 *     subscribe().
 */
hterm.PubSub.prototype.unsubscribe = function(subject, callback) {
  const list = this.observers_[subject];
  if (!list) {
    throw new Error(`Invalid subject: ${subject}`);
  }

  const i = list.indexOf(callback);
  if (i < 0) {
    throw new Error(`Not subscribed: ${subject}`);
  }

  list.splice(i, 1);
};

/**
 * Publish a message about a subject.
 *
 * Subscribers (and the optional final callback) are invoked asynchronously.
 * This method will return before anyone is actually notified.
 *
 * @param {string} subject The subject to publish about.
 * @param {?Object=} e An arbitrary object associated with this notification.
 * @param {function(!Object)=} lastCallback An optional function to call
 *     after all subscribers have been notified.
 */
hterm.PubSub.prototype.publish = function(
    subject, e, lastCallback = undefined) {
  function notifyList(i) {
    // Set this timeout before invoking the callback, so we don't have to
    // concern ourselves with exceptions.
    if (i < list.length - 1) {
      setTimeout(notifyList, 0, i + 1);
    }

    list[i](e);
  }

  let list = this.observers_[subject];
  if (list) {
    // Copy the list, in case it changes while we're notifying.
    list = [].concat(list);
  }

  if (lastCallback) {
    if (list) {
      list.push(lastCallback);
    } else {
      list = [lastCallback];
    }
  }

  if (list) {
    setTimeout(notifyList, 0, 0);
  }
};
// SOURCE FILE: hterm/js/hterm_screen.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This class represents a single terminal screen full of text.
 *
 * It maintains the current cursor position and has basic methods for text
 * insert and overwrite, and adding or removing rows from the screen.
 *
 * This class has no knowledge of the scrollback buffer.
 *
 * The number of rows on the screen is determined only by the number of rows
 * that the caller inserts into the screen.  If a caller wants to ensure a
 * constant number of rows on the screen, it's their responsibility to remove a
 * row for each row inserted.
 *
 * The screen width, in contrast, is enforced locally.
 *
 *
 * In practice...
 * - The hterm.Terminal class holds two hterm.Screen instances.  One for the
 * primary screen and one for the alternate screen.
 *
 * - The html.Screen class only cares that rows are HTML Elements.  In the
 * larger context of hterm, however, the rows happen to be displayed by an
 * hterm.ScrollPort and have to follow a few rules as a result.  Each
 * row must be rooted by the custom HTML tag 'x-row', and each must have a
 * rowIndex property that corresponds to the index of the row in the context
 * of the scrollback buffer.  These invariants are enforced by hterm.Terminal
 * because that is the class using the hterm.Screen in the context of an
 * hterm.ScrollPort.
 */

/**
 * Create a new screen instance.
 *
 * The screen initially has no rows and a maximum column count of 0.
 *
 * @param {number=} columnCount The maximum number of columns for this
 *    screen.  See insertString() and overwriteString() for information about
 *    what happens when too many characters are added too a row.  Defaults to
 *    0 if not provided.
 * @constructor
 */
hterm.Screen = function(columnCount = 0) {
  /**
   * Public, read-only access to the rows in this screen.
   *
   * @type {!Array<!Element>}
   */
  this.rowsArray = [];

  // The max column width for this screen.
  this.columnCount_ = columnCount;

  // The current color, bold, underline and blink attributes.
  this.textAttributes = new hterm.TextAttributes(window.document);

  // Current zero-based cursor coordinates.
  this.cursorPosition = new hterm.RowCol(0, 0);

  // Saved state used by DECSC and related settings.  This is only for saving
  // and restoring specific state, not for the current/active state.
  this.cursorState_ = new hterm.Screen.CursorState(this);

  // The node containing the row that the cursor is positioned on.
  this.cursorRowNode_ = null;

  // The node containing the span of text that the cursor is positioned on.
  this.cursorNode_ = null;

  // The offset in column width into cursorNode_ where the cursor is positioned.
  this.cursorOffset_ = 0;

  // Regexes for expanding word selections.
  /** @type {?string} */
  this.wordBreakMatchLeft = null;
  /** @type {?string} */
  this.wordBreakMatchRight = null;
  /** @type {?string} */
  this.wordBreakMatchMiddle = null;
};

/**
 * Return the current number of rows in this screen.
 *
 * @return {number} The number of rows in this screen.
 */
hterm.Screen.prototype.getHeight = function() {
  return this.rowsArray.length;
};

/**
 * Return the current number of columns in this screen.
 *
 * @return {number} The number of columns in this screen.
 */
hterm.Screen.prototype.getWidth = function() {
  return this.columnCount_;
};

/**
 * Set the maximum number of columns per row.
 *
 * @param {number} count The maximum number of columns per row.
 */
hterm.Screen.prototype.setColumnCount = function(count) {
  this.columnCount_ = count;

  if (this.cursorPosition.column >= count) {
    this.setCursorPosition(this.cursorPosition.row, count - 1);
  }
};

/**
 * Remove the first row from the screen and return it.
 *
 * @return {!Element} The first row in this screen.
 */
hterm.Screen.prototype.shiftRow = function() {
  return this.shiftRows(1)[0];
};

/**
 * Remove rows from the top of the screen and return them as an array.
 *
 * @param {number} count The number of rows to remove.
 * @return {!Array<!Element>} The selected rows.
 */
hterm.Screen.prototype.shiftRows = function(count) {
  return this.rowsArray.splice(0, count);
};

/**
 * Insert a row at the top of the screen.
 *
 * @param {!Element} row The row to insert.
 */
hterm.Screen.prototype.unshiftRow = function(row) {
  this.rowsArray.splice(0, 0, row);
};

/**
 * Insert rows at the top of the screen.
 *
 * @param {!Array<!Element>} rows The rows to insert.
 */
hterm.Screen.prototype.unshiftRows = function(rows) {
  this.rowsArray.unshift.apply(this.rowsArray, rows);
};

/**
 * Remove the last row from the screen and return it.
 *
 * @return {!Element} The last row in this screen.
 */
hterm.Screen.prototype.popRow = function() {
  return this.popRows(1)[0];
};

/**
 * Remove rows from the bottom of the screen and return them as an array.
 *
 * @param {number} count The number of rows to remove.
 * @return {!Array<!Element>} The selected rows.
 */
hterm.Screen.prototype.popRows = function(count) {
  return this.rowsArray.splice(this.rowsArray.length - count, count);
};

/**
 * Insert a row at the bottom of the screen.
 *
 * @param {!Element} row The row to insert.
 */
hterm.Screen.prototype.pushRow = function(row) {
  this.rowsArray.push(row);
};

/**
 * Insert rows at the bottom of the screen.
 *
 * @param {!Array<!Element>} rows The rows to insert.
 */
hterm.Screen.prototype.pushRows = function(rows) {
  rows.push.apply(this.rowsArray, rows);
};

/**
 * Insert a row at the specified row of the screen.
 *
 * @param {number} index The index to insert the row.
 * @param {!Element} row The row to insert.
 */
hterm.Screen.prototype.insertRow = function(index, row) {
  this.rowsArray.splice(index, 0, row);
};

/**
 * Insert rows at the specified row of the screen.
 *
 * @param {number} index The index to insert the rows.
 * @param {!Array<!Element>} rows The rows to insert.
 */
hterm.Screen.prototype.insertRows = function(index, rows) {
  for (let i = 0; i < rows.length; i++) {
    this.rowsArray.splice(index + i, 0, rows[i]);
  }
};

/**
 * Remove a row from the screen and return it.
 *
 * @param {number} index The index of the row to remove.
 * @return {!Element} The selected row.
 */
hterm.Screen.prototype.removeRow = function(index) {
  return this.rowsArray.splice(index, 1)[0];
};

/**
 * Remove rows from the bottom of the screen and return them as an array.
 *
 * @param {number} index The index to start removing rows.
 * @param {number} count The number of rows to remove.
 * @return {!Array<!Element>} The selected rows.
 */
hterm.Screen.prototype.removeRows = function(index, count) {
  return this.rowsArray.splice(index, count);
};

/**
 * Invalidate the current cursor position.
 *
 * This sets this.cursorPosition to (0, 0) and clears out some internal
 * data.
 *
 * Attempting to insert or overwrite text while the cursor position is invalid
 * will raise an obscure exception.
 */
hterm.Screen.prototype.invalidateCursorPosition = function() {
  this.cursorPosition.move(0, 0);
  this.cursorRowNode_ = null;
  this.cursorNode_ = null;
  this.cursorOffset_ = 0;
};

/**
 * Clear the contents of the cursor row.
 */
hterm.Screen.prototype.clearCursorRow = function() {
  this.cursorRowNode_.innerText = '';
  this.cursorRowNode_.removeAttribute('line-overflow');
  this.cursorOffset_ = 0;
  this.cursorPosition.column = 0;
  this.cursorPosition.overflow = false;

  let text;
  if (this.textAttributes.isDefault()) {
    text = '';
  } else {
    text = ' '.repeat(this.columnCount_);
  }

  // We shouldn't honor inverse colors when clearing an area, to match
  // xterm's back color erase behavior.
  const inverse = this.textAttributes.inverse;
  this.textAttributes.inverse = false;
  this.textAttributes.syncColors();

  const node = this.textAttributes.createContainer(text);
  this.cursorRowNode_.appendChild(node);
  this.cursorNode_ = node;

  this.textAttributes.inverse = inverse;
  this.textAttributes.syncColors();
};

/**
 * Mark the current row as having overflowed to the next line.
 *
 * The line overflow state is used when converting a range of rows into text.
 * It makes it possible to recombine two or more overflow terminal rows into
 * a single line.
 *
 * This is distinct from the cursor being in the overflow state.  Cursor
 * overflow indicates that printing at the cursor position will commit a
 * line overflow, unless it is preceded by a repositioning of the cursor
 * to a non-overflow state.
 */
hterm.Screen.prototype.commitLineOverflow = function() {
  this.cursorRowNode_.setAttribute('line-overflow', true);
};

/**
 * Relocate the cursor to a give row and column.
 *
 * @param {number} row The zero based row.
 * @param {number} column The zero based column.
 */
hterm.Screen.prototype.setCursorPosition = function(row, column) {
  if (!this.rowsArray.length) {
    console.warn('Attempt to set cursor position on empty screen.');
    return;
  }

  if (row >= this.rowsArray.length) {
    console.error('Row out of bounds: ' + row);
    row = this.rowsArray.length - 1;
  } else if (row < 0) {
    console.error('Row out of bounds: ' + row);
    row = 0;
  }

  if (column >= this.columnCount_) {
    console.error('Column out of bounds: ' + column);
    column = this.columnCount_ - 1;
  } else if (column < 0) {
    console.error('Column out of bounds: ' + column);
    column = 0;
  }

  this.cursorPosition.overflow = false;

  const rowNode = this.rowsArray[row];
  let node = rowNode.firstChild;

  if (!node) {
    node = rowNode.ownerDocument.createTextNode('');
    rowNode.appendChild(node);
  }

  let currentColumn = 0;

  if (rowNode == this.cursorRowNode_) {
    if (column >= this.cursorPosition.column - this.cursorOffset_) {
      node = this.cursorNode_;
      currentColumn = this.cursorPosition.column - this.cursorOffset_;
    }
  } else {
    this.cursorRowNode_ = rowNode;
  }

  this.cursorPosition.move(row, column);

  while (node) {
    const offset = column - currentColumn;
    const width = hterm.TextAttributes.nodeWidth(node);
    if (!node.nextSibling || width > offset) {
      this.cursorNode_ = node;
      this.cursorOffset_ = offset;
      return;
    }

    currentColumn += width;
    node = node.nextSibling;
  }
};

/**
 * Set the provided selection object to be a caret selection at the current
 * cursor position.
 *
 * @param {!Selection} selection
 */
hterm.Screen.prototype.syncSelectionCaret = function(selection) {
  try {
    selection.collapse(this.cursorNode_, this.cursorOffset_);
  } catch (firefoxIgnoredException) {
    // FF can throw an exception if the range is off, rather than just not
    // performing the collapse.
  }
};

/**
 * Split a single node into two nodes at the given offset.
 *
 * For example:
 * Given the DOM fragment '<div><span>Hello World</span></div>', call splitNode_
 * passing the span and an offset of 6.  This would modify the fragment to
 * become: '<div><span>Hello </span><span>World</span></div>'.  If the span
 * had any attributes they would have been copied to the new span as well.
 *
 * The to-be-split node must have a container, so that the new node can be
 * placed next to it.
 *
 * @param {!Node} node The node to split.
 * @param {number} offset The offset into the node where the split should
 *     occur.
 */
hterm.Screen.prototype.splitNode_ = function(node, offset) {
  const afterNode = node.cloneNode(false);

  const textContent = node.textContent;
  node.textContent = hterm.TextAttributes.nodeSubstr(node, 0, offset);
  afterNode.textContent = lib.wc.substr(textContent, offset);

  if (afterNode.textContent) {
    node.parentNode.insertBefore(afterNode, node.nextSibling);
  }
  if (!node.textContent) {
    node.remove();
  }
};

/**
 * Ensure that text is clipped and the cursor is clamped to the column count.
 */
hterm.Screen.prototype.maybeClipCurrentRow = function() {
  let width = hterm.TextAttributes.nodeWidth(lib.notNull(this.cursorRowNode_));

  if (width <= this.columnCount_) {
    // Current row does not need clipping, but may need clamping.
    if (this.cursorPosition.column >= this.columnCount_) {
      this.setCursorPosition(this.cursorPosition.row, this.columnCount_ - 1);
      this.cursorPosition.overflow = true;
    }

    return;
  }

  // Save off the current column so we can maybe restore it later.
  const currentColumn = this.cursorPosition.column;

  // Move the cursor to the final column.
  this.setCursorPosition(this.cursorPosition.row, this.columnCount_ - 1);

  // Remove any text that partially overflows.
  width = hterm.TextAttributes.nodeWidth(lib.notNull(this.cursorNode_));

  if (this.cursorOffset_ < width - 1) {
    this.cursorNode_.textContent = hterm.TextAttributes.nodeSubstr(
        this.cursorNode_, 0, this.cursorOffset_ + 1);
  }

  // Remove all nodes after the cursor.
  const rowNode = this.cursorRowNode_;
  let node = this.cursorNode_.nextSibling;

  while (node) {
    rowNode.removeChild(node);
    node = this.cursorNode_.nextSibling;
  }

  if (currentColumn < this.columnCount_) {
    // If the cursor was within the screen before we started then restore its
    // position.
    this.setCursorPosition(this.cursorPosition.row, currentColumn);
  } else {
    // Otherwise leave it at the the last column in the overflow state.
    this.cursorPosition.overflow = true;
  }
};

/**
 * Insert a string at the current character position using the current
 * text attributes.
 *
 * You must call maybeClipCurrentRow() after in order to clip overflowed
 * text and clamp the cursor.
 *
 * It is also up to the caller to properly maintain the line overflow state
 * using hterm.Screen..commitLineOverflow().
 *
 * @param {string} str The string to insert.
 * @param {number=} wcwidth The cached lib.wc.strWidth value for |str|.  Will be
 *     calculated on demand if need be.  Passing in a cached value helps speed
 *     up processing as this is a hot codepath.
 */
hterm.Screen.prototype.insertString = function(str, wcwidth = undefined) {
  let cursorNode = this.cursorNode_;
  let cursorNodeText = cursorNode.textContent;

  this.cursorRowNode_.removeAttribute('line-overflow');

  // We may alter the width of the string by prepending some missing
  // whitespaces, so we need to record the string width ahead of time.
  if (wcwidth === undefined) {
    wcwidth = lib.wc.strWidth(str);
  }

  // No matter what, before this function exits the cursor column will have
  // moved this much.
  this.cursorPosition.column += wcwidth;

  // Local cache of the cursor offset.
  let offset = this.cursorOffset_;

  // Reverse offset is the offset measured from the end of the string.
  // Zero implies that the cursor is at the end of the cursor node.
  let reverseOffset = hterm.TextAttributes.nodeWidth(cursorNode) - offset;

  if (reverseOffset < 0) {
    // A negative reverse offset means the cursor is positioned past the end
    // of the characters on this line.  We'll need to insert the missing
    // whitespace.
    const ws = ' '.repeat(-reverseOffset);

    // This whitespace should be completely unstyled.  Underline, background
    // color, and strikethrough would be visible on whitespace, so we can't use
    // one of those spans to hold the text.
    if (!(this.textAttributes.underline ||
          this.textAttributes.strikethrough ||
          this.textAttributes.background ||
          this.textAttributes.wcNode ||
          !this.textAttributes.asciiNode ||
          this.textAttributes.tileData != null)) {
      // Best case scenario, we can just pretend the spaces were part of the
      // original string.
      str = ws + str;
    } else if (cursorNode.nodeType == Node.TEXT_NODE ||
               !(cursorNode.wcNode ||
                 !cursorNode.asciiNode ||
                 cursorNode.tileNode ||
                 cursorNode.style.textDecoration ||
                 cursorNode.style.textDecorationStyle ||
                 cursorNode.style.textDecorationLine ||
                 cursorNode.style.backgroundColor)) {
      // Second best case, the current node is able to hold the whitespace.
      cursorNode.textContent = (cursorNodeText += ws);
    } else {
      // Worst case, we have to create a new node to hold the whitespace.
      const wsNode = cursorNode.ownerDocument.createTextNode(ws);
      this.cursorRowNode_.insertBefore(wsNode, cursorNode.nextSibling);
      this.cursorNode_ = cursorNode = wsNode;
      this.cursorOffset_ = offset = -reverseOffset;
      cursorNodeText = ws;
    }

    // We now know for sure that we're at the last character of the cursor node.
    reverseOffset = 0;
  }

  if (this.textAttributes.matchesContainer(cursorNode)) {
    // The new text can be placed directly in the cursor node.
    if (reverseOffset == 0) {
      cursorNode.textContent = cursorNodeText + str;
    } else if (offset == 0) {
      cursorNode.textContent = str + cursorNodeText;
    } else {
      cursorNode.textContent =
          hterm.TextAttributes.nodeSubstr(cursorNode, 0, offset) +
          str + hterm.TextAttributes.nodeSubstr(cursorNode, offset);
    }

    this.cursorOffset_ += wcwidth;
    return;
  }

  // The cursor node is the wrong style for the new text.  If we're at the
  // beginning or end of the cursor node, then the adjacent node is also a
  // potential candidate.

  if (offset == 0) {
    // At the beginning of the cursor node, the check the previous sibling.
    const previousSibling = cursorNode.previousSibling;
    if (previousSibling &&
        this.textAttributes.matchesContainer(previousSibling)) {
      previousSibling.textContent += str;
      this.cursorNode_ = previousSibling;
      this.cursorOffset_ = lib.wc.strWidth(previousSibling.textContent);
      return;
    }

    const newNode = this.textAttributes.createContainer(str);
    this.cursorRowNode_.insertBefore(newNode, cursorNode);
    this.cursorNode_ = newNode;
    this.cursorOffset_ = wcwidth;
    return;
  }

  if (reverseOffset == 0) {
    // At the end of the cursor node, the check the next sibling.
    const nextSibling = cursorNode.nextSibling;
    if (nextSibling &&
        this.textAttributes.matchesContainer(nextSibling)) {
      nextSibling.textContent = str + nextSibling.textContent;
      this.cursorNode_ = nextSibling;
      this.cursorOffset_ = lib.wc.strWidth(str);
      return;
    }

    const newNode = this.textAttributes.createContainer(str);
    this.cursorRowNode_.insertBefore(newNode, nextSibling);
    this.cursorNode_ = newNode;
    // We specifically need to include any missing whitespace here, since it's
    // going in a new node.
    this.cursorOffset_ = hterm.TextAttributes.nodeWidth(newNode);
    return;
  }

  // Worst case, we're somewhere in the middle of the cursor node.  We'll
  // have to split it into two nodes and insert our new container in between.
  this.splitNode_(cursorNode, offset);
  const newNode = this.textAttributes.createContainer(str);
  this.cursorRowNode_.insertBefore(newNode, cursorNode.nextSibling);
  this.cursorNode_ = newNode;
  this.cursorOffset_ = wcwidth;
};

/**
 * Overwrite the text at the current cursor position.
 *
 * You must call maybeClipCurrentRow() after in order to clip overflowed
 * text and clamp the cursor.
 *
 * It is also up to the caller to properly maintain the line overflow state
 * using hterm.Screen..commitLineOverflow().
 *
 * @param {string} str The source string for overwriting existing content.
 * @param {number=} wcwidth The cached lib.wc.strWidth value for |str|.  Will be
 *     calculated on demand if need be.  Passing in a cached value helps speed
 *     up processing as this is a hot codepath.
 */
hterm.Screen.prototype.overwriteString = function(str, wcwidth = undefined) {
  const maxLength = this.columnCount_ - this.cursorPosition.column;
  if (!maxLength) {
    return;
  }

  if (wcwidth === undefined) {
    wcwidth = lib.wc.strWidth(str);
  }

  if (this.textAttributes.matchesContainer(lib.notNull(this.cursorNode_)) &&
      this.cursorNode_.textContent.substr(this.cursorOffset_) ==
          str) {
    // This overwrite would be a no-op, just move the cursor and return.
    this.cursorOffset_ += wcwidth;
    this.cursorPosition.column += wcwidth;
    return;
  }

  this.deleteChars(Math.min(wcwidth, maxLength));
  this.insertString(str, wcwidth);
};

/**
 * Forward-delete one or more characters at the current cursor position.
 *
 * Text to the right of the deleted characters is shifted left.  Only affects
 * characters on the same row as the cursor.
 *
 * @param {number} count The column width of characters to delete.  This is
 *     clamped to the column width minus the cursor column.
 * @return {number} The column width of the characters actually deleted.
 */
hterm.Screen.prototype.deleteChars = function(count) {
  let node = this.cursorNode_;
  let offset = this.cursorOffset_;

  const currentCursorColumn = this.cursorPosition.column;
  count = Math.min(count, this.columnCount_ - currentCursorColumn);
  if (!count) {
    return 0;
  }

  const rv = count;
  let startLength, endLength;

  while (node && count) {
    // Check so we don't loop forever, but we don't also go quietly.
    if (count < 0) {
      console.error(`Deleting ${rv} chars went negative: ${count}`);
      break;
    }

    startLength = hterm.TextAttributes.nodeWidth(node);
    node.textContent = hterm.TextAttributes.nodeSubstr(node, 0, offset) +
        hterm.TextAttributes.nodeSubstr(node, offset + count);
    endLength = hterm.TextAttributes.nodeWidth(node);

    // Deal with splitting wide characters.  There are two ways: we could delete
    // the first column or the second column.  In both cases, we delete the wide
    // character and replace one of the columns with a space (since the other
    // was deleted).  If there are more chars to delete, the next loop will pick
    // up the slack.
    if (node.wcNode && offset < startLength &&
        ((endLength && startLength == endLength) ||
         (!endLength && offset == 1))) {
      // No characters were deleted when there should be.  We're probably trying
      // to delete one column width from a wide character node.  We remove the
      // wide character node here and replace it with a single space.
      const spaceNode = this.textAttributes.createContainer(' ');
      node.parentNode.insertBefore(spaceNode, offset ? node : node.nextSibling);
      node.textContent = '';
      endLength = 0;
      count -= 1;
    } else {
      count -= startLength - endLength;
    }

    const nextNode = node.nextSibling;
    if (endLength == 0 && node != this.cursorNode_) {
      node.remove();
    }
    node = nextNode;
    offset = 0;
  }

  // Remove this.cursorNode_ if it is an empty non-text node.
  if (this.cursorNode_.nodeType != Node.TEXT_NODE &&
      !this.cursorNode_.textContent) {
    const cursorNode = this.cursorNode_;
    if (cursorNode.previousSibling) {
      this.cursorNode_ = cursorNode.previousSibling;
      this.cursorOffset_ = hterm.TextAttributes.nodeWidth(
          cursorNode.previousSibling);
    } else if (cursorNode.nextSibling) {
      this.cursorNode_ = cursorNode.nextSibling;
      this.cursorOffset_ = 0;
    } else {
      const emptyNode = this.cursorRowNode_.ownerDocument.createTextNode('');
      this.cursorRowNode_.appendChild(emptyNode);
      this.cursorNode_ = emptyNode;
      this.cursorOffset_ = 0;
    }
    this.cursorRowNode_.removeChild(cursorNode);
  }

  return rv;
};

/**
 * Finds first X-ROW of a line containing specified X-ROW.
 * Used to support line overflow.
 *
 * @param {!Node} row X-ROW to begin search for first row of line.
 * @return {!Node} The X-ROW that is at the beginning of the line.
 **/
hterm.Screen.prototype.getLineStartRow_ = function(row) {
  while (row.previousSibling &&
         row.previousSibling.hasAttribute('line-overflow')) {
    row = row.previousSibling;
  }
  return row;
};

/**
 * Gets text of a line beginning with row.
 * Supports line overflow.
 *
 * @param {!Node} row First X-ROW of line.
 * @return {string} Text content of line.
 **/
hterm.Screen.prototype.getLineText_ = function(row) {
  let rowText = '';
  let rowOrNull = row;
  while (rowOrNull) {
    rowText += rowOrNull.textContent;
    if (rowOrNull.hasAttribute('line-overflow')) {
      rowOrNull = rowOrNull.nextSibling;
    } else {
      break;
    }
  }
  return rowText;
};

/**
 * Returns X-ROW that is ancestor of the node.
 *
 * @param {!Node} node Node to get X-ROW ancestor for.
 * @return {?Node} X-ROW ancestor of node, or null if not found.
 **/
hterm.Screen.prototype.getXRowAncestor_ = function(node) {
  let nodeOrNull = node;
  while (nodeOrNull) {
    if (nodeOrNull.nodeName === 'X-ROW') {
      break;
    }
    nodeOrNull = nodeOrNull.parentNode;
  }
  return nodeOrNull;
};

/**
 * Returns position within line of character at offset within node.
 * Supports line overflow.
 *
 * @param {!Node} row X-ROW at beginning of line.
 * @param {!Node} node Node to get position of.
 * @param {number} offset Offset into node.
 * @return {number} Position within line of character at offset within node.
 **/
hterm.Screen.prototype.getPositionWithOverflow_ = function(row, node, offset) {
  if (!node) {
    return -1;
  }
  const ancestorRow = this.getXRowAncestor_(node);
  if (!ancestorRow) {
    return -1;
  }
  let position = 0;
  while (ancestorRow != row) {
    position += hterm.TextAttributes.nodeWidth(row);
    if (row.hasAttribute('line-overflow') && row.nextSibling) {
      row = row.nextSibling;
    } else {
      return -1;
    }
  }
  return position + this.getPositionWithinRow_(row, node, offset);
};

/**
 * Returns position within row of character at offset within node.
 * Does not support line overflow.
 *
 * @param {!Node} row X-ROW to get position within.
 * @param {!Node} node Node to get position for.
 * @param {number} offset Offset within node to get position for.
 * @return {number} Position within row of character at offset within node.
 **/
hterm.Screen.prototype.getPositionWithinRow_ = function(row, node, offset) {
  if (node.parentNode != row) {
    // If we traversed to the top node, then there's nothing to find here.
    if (node.parentNode == null) {
      return -1;
    }

    return this.getPositionWithinRow_(node.parentNode, node, offset) +
           this.getPositionWithinRow_(row, node.parentNode, 0);
  }
  let position = 0;
  for (let i = 0; i < row.childNodes.length; i++) {
    const currentNode = row.childNodes[i];
    if (currentNode == node) {
      return position + offset;
    }
    position += hterm.TextAttributes.nodeWidth(currentNode);
  }
  return -1;
};

/**
 * Returns the node and offset corresponding to position within line.
 * Supports line overflow.
 *
 * @param {!Node} row X-ROW at beginning of line.
 * @param {number} position Position within line to retrieve node and offset.
 * @return {?Array} Two element array containing node and offset respectively.
 **/
hterm.Screen.prototype.getNodeAndOffsetWithOverflow_ = function(row, position) {
  while (row && position > hterm.TextAttributes.nodeWidth(row)) {
    if (row.hasAttribute('line-overflow') && row.nextSibling) {
      position -= hterm.TextAttributes.nodeWidth(row);
      row = row.nextSibling;
    } else {
      return [null, -1];
    }
  }
  return this.getNodeAndOffsetWithinRow_(row, position);
};

/**
 * Returns the node and offset corresponding to position within row.
 * Does not support line overflow.
 *
 * @param {!Node} row X-ROW to get position within.
 * @param {number} position Position within row to retrieve node and offset.
 * @return {?Array} Two element array containing node and offset respectively.
 **/
hterm.Screen.prototype.getNodeAndOffsetWithinRow_ = function(row, position) {
  for (let i = 0; i < row.childNodes.length; i++) {
    const node = row.childNodes[i];
    const nodeTextWidth = hterm.TextAttributes.nodeWidth(node);
    if (position <= nodeTextWidth) {
      if (node.nodeName === 'SPAN') {
        /** Drill down to node contained by SPAN. **/
        return this.getNodeAndOffsetWithinRow_(node, position);
      } else {
        return [node, position];
      }
    }
    position -= nodeTextWidth;
  }
  return null;
};

/**
 * Returns the node and offset corresponding to position within line.
 * Supports line overflow.
 *
 * @param {!Node} row X-ROW at beginning of line.
 * @param {number} start Start position of range within line.
 * @param {number} end End position of range within line.
 * @param {!Range} range Range to modify.
 **/
hterm.Screen.prototype.setRange_ = function(row, start, end, range) {
  const startNodeAndOffset = this.getNodeAndOffsetWithOverflow_(row, start);
  if (startNodeAndOffset == null) {
    return;
  }
  const endNodeAndOffset = this.getNodeAndOffsetWithOverflow_(row, end);
  if (endNodeAndOffset == null) {
    return;
  }
  range.setStart(startNodeAndOffset[0], startNodeAndOffset[1]);
  range.setEnd(endNodeAndOffset[0], endNodeAndOffset[1]);
};

/**
 * Expands selection to surrounding string with word break matches.
 *
 * @param {?Selection} selection Selection to expand.
 * @param {string} leftMatch left word break match.
 * @param {string} rightMatch right word break match.
 * @param {string} insideMatch inside word break match.
 */
hterm.Screen.prototype.expandSelectionWithWordBreakMatches_ =
    function(selection, leftMatch, rightMatch, insideMatch) {
  if (!selection) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (!range || range.toString().match(/\s/)) {
    return;
  }

  const rowElement = this.getXRowAncestor_(lib.notNull(range.startContainer));
  if (!rowElement) {
    return;
  }
  const row = this.getLineStartRow_(rowElement);
  if (!row) {
    return;
  }

  const startPosition = this.getPositionWithOverflow_(
      row, lib.notNull(range.startContainer), range.startOffset);
  if (startPosition == -1) {
    return;
  }
  const endPosition = this.getPositionWithOverflow_(
      row, lib.notNull(range.endContainer), range.endOffset);
  if (endPosition == -1) {
    return;
  }

  // Move start to the left.
  const rowText = this.getLineText_(row);
  const lineUpToRange = lib.wc.substring(rowText, 0, endPosition);
  const leftRegularExpression = new RegExp(leftMatch + insideMatch + '$');
  const expandedStart = lineUpToRange.search(leftRegularExpression);
  if (expandedStart == -1 || expandedStart > startPosition) {
    return;
  }

  // Move end to the right.
  const lineFromRange = lib.wc.substring(rowText, startPosition,
                                         lib.wc.strWidth(rowText));
  const rightRegularExpression = new RegExp('^' + insideMatch + rightMatch);
  const found = lineFromRange.match(rightRegularExpression);
  if (!found) {
    return;
  }
  const expandedEnd = startPosition + lib.wc.strWidth(found[0]);
  if (expandedEnd == -1 || expandedEnd < endPosition) {
    return;
  }

  this.setRange_(row, expandedStart, expandedEnd, range);
  selection.addRange(range);
};

/**
 * Expands selection to surrounding string using the user's settings.
 *
 * @param {?Selection} selection Selection to expand.
 */
hterm.Screen.prototype.expandSelection = function(selection) {
  this.expandSelectionWithWordBreakMatches_(
      selection,
      lib.notNull(this.wordBreakMatchLeft),
      lib.notNull(this.wordBreakMatchRight),
      lib.notNull(this.wordBreakMatchMiddle));
};

/**
 * Expands selection to surrounding URL using a set of fixed match settings.
 *
 * @param {?Selection} selection Selection to expand.
 */
hterm.Screen.prototype.expandSelectionForUrl = function(selection) {
  this.expandSelectionWithWordBreakMatches_(
      selection,
      '[^\\s[\\](){}<>"\'^!@#$%&*,;:`\u{2018}\u{201c}\u{2039}\u{ab}]',
      '[^\\s[\\](){}<>"\'^!@#$%&*,;:~.`\u{2019}\u{201d}\u{203a}\u{bb}]',
      '[^\\s[\\](){}<>"\'^]*');
};

/**
 * Save the current cursor state to the corresponding screens.
 *
 * @param {!hterm.VT} vt The VT object to read graphic codeset details from.
 */
hterm.Screen.prototype.saveCursorAndState = function(vt) {
  this.cursorState_.save(vt);
};

/**
 * Restore the saved cursor state in the corresponding screens.
 *
 * @param {!hterm.VT} vt The VT object to write graphic codeset details to.
 */
hterm.Screen.prototype.restoreCursorAndState = function(vt) {
  this.cursorState_.restore(vt);
};

/**
 * Track all the things related to the current "cursor".
 *
 * The set of things saved & restored here is defined by DEC:
 * https://vt100.net/docs/vt510-rm/DECSC.html
 * - Cursor position
 * - Character attributes set by the SGR command
 * - Character sets (G0, G1, G2, or G3) currently in GL and GR
 * - Wrap flag (autowrap or no autowrap)
 * - State of origin mode (DECOM)
 * - Selective erase attribute
 * - Any single shift 2 (SS2) or single shift 3 (SS3) functions sent
 *
 * These are done on a per-screen basis.
 *
 * @param {!hterm.Screen} screen The screen this cursor is tied to.
 * @constructor
 */
hterm.Screen.CursorState = function(screen) {
  this.screen_ = screen;
  this.cursor = null;
  this.textAttributes = null;
  this.GL = this.GR = this.G0 = this.G1 = this.G2 = this.G3 = null;
};

/**
 * Save all the cursor state.
 *
 * @param {!hterm.VT} vt The VT object to read graphic codeset details from.
 */
hterm.Screen.CursorState.prototype.save = function(vt) {
  this.cursor = vt.terminal.saveCursor();

  this.textAttributes = this.screen_.textAttributes.clone();

  this.GL = vt.GL;
  this.GR = vt.GR;

  this.G0 = vt.G0;
  this.G1 = vt.G1;
  this.G2 = vt.G2;
  this.G3 = vt.G3;
};

/**
 * Restore the previously saved cursor state.
 *
 * @param {!hterm.VT} vt The VT object to write graphic codeset details to.
 */
hterm.Screen.CursorState.prototype.restore = function(vt) {
  vt.terminal.restoreCursor(this.cursor);

  // Cursor restore includes char attributes (bold/etc...), but does not change
  // the color palette (which are a terminal setting).
  const tattrs = this.textAttributes.clone();
  tattrs.colorPaletteOverrides =
      this.screen_.textAttributes.colorPaletteOverrides;
  tattrs.syncColors();

  this.screen_.textAttributes = tattrs;

  vt.GL = this.GL;
  vt.GR = this.GR;

  vt.G0 = this.G0;
  vt.G1 = this.G1;
  vt.G2 = this.G2;
  vt.G3 = this.G3;
};
// SOURCE FILE: hterm/js/hterm_scrollport.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * The RowProvider should return rows rooted by the custom tag name 'x-row'.
 * This ensures that we can quickly assign the correct display height
 * to the rows with css.
 *
 * @interface
 */
hterm.RowProvider = function() {};

/**
 * @abstract
 * @return {number} The current number of rows.
 */
hterm.RowProvider.prototype.getRowCount = function() {};

/**
 * Get specified row.
 *
 * @abstract
 * @param {number} index The index of the row.
 * @return {!Element}
 */
hterm.RowProvider.prototype.getRowNode = function(index) {};

/**
 * A 'viewport' view of fixed-height rows with support for selection and
 * copy-to-clipboard.
 *
 * 'Viewport' in this case means that only the visible rows are in the DOM.
 * If the rowProvider has 100,000 rows, but the ScrollPort is only 25 rows
 * tall, then only 25 dom nodes are created.  The ScrollPort will ask the
 * RowProvider to create new visible rows on demand as they are scrolled in
 * to the visible area.
 *
 * This viewport is designed so that select and copy-to-clipboard still works,
 * even when all or part of the selection is scrolled off screen.
 *
 * Note that the X11 mouse clipboard does not work properly when all or part
 * of the selection is off screen.  It would be difficult to fix this without
 * adding significant overhead to pathologically large selection cases.
 *
 * @param {!hterm.RowProvider} rowProvider An object capable of providing rows
 *     as raw text or row nodes.
 * @constructor
 * @extends {hterm.PubSub}
 */
hterm.ScrollPort = function(rowProvider) {
  hterm.PubSub.addBehavior(this);

  this.rowProvider_ = rowProvider;

  // SWAG the character size until we can measure it.
  this.characterSize = {width: 10, height: 10};

  this.selection = new hterm.ScrollPort.Selection(this);

  // A map of rowIndex => rowNode for each row that is drawn as part of a
  // pending redraw_() call.  Null if there is no pending redraw_ call.
  this.currentRowNodeCache_ = null;

  // A map of rowIndex => rowNode for each row that was drawn as part of the
  // previous redraw_() call.
  this.previousRowNodeCache_ = {};

  // Used during scroll events to detect when the underlying cause is a resize.
  this.lastScreenWidth_ = 0;
  this.lastScreenHeight_ = 0;

  // True if the user should be allowed to select text in the terminal.
  // This is disabled when the host requests mouse drag events so that we don't
  // end up with two notions of selection.
  this.selectionEnabled_ = true;

  // The last row count returned by the row provider, re-populated during
  // syncScrollHeight().
  this.lastRowCount_ = 0;

  // The scroll wheel pixel delta multiplier to increase/decrease
  // the scroll speed of mouse wheel events. See: https://goo.gl/sXelnq
  this.scrollWheelMultiplier_ = 1;

  // The last touch events we saw to support touch based scrolling.  Indexed
  // by touch identifier since we can have more than one touch active.
  this.lastTouch_ = {};

  /**
   * Size of screen padding in pixels.
   */
  this.screenPaddingSize = 0;

  /**
   * True if the last scroll caused the scrollport to show the final row.
   */
  this.isScrolledEnd = true;

  /**
   * A guess at the current scrollbar width, fixed in resize().
   */
  this.currentScrollbarWidthPx = hterm.ScrollPort.DEFAULT_SCROLLBAR_WIDTH;

  /**
   * Whether to paste on dropped text.
   */
  this.pasteOnDrop = true;

  this.div_ = null;
  this.document_ = null;
  /** @type {?Element} */
  this.screen_ = null;

  // Collection of active timeout handles.
  this.timeouts_ = {};

  this.observers_ = {};

  // Offscreen selection rows that are set with 'aria-hidden'.
  // They must be unset when selection changes or the rows are visible.
  this.ariaHiddenSelectionRows_ = [];

  this.DEBUG_ = false;
};

/**
 * Default width for scrollbar used when the system such as CrOS pretends that
 * scrollbar is zero width.  CrOS currently uses 11px when expanded.
 *
 * @const {number}
 */
hterm.ScrollPort.DEFAULT_SCROLLBAR_WIDTH = 12;

/**
 * Proxy for the native selection object which understands how to walk up the
 * DOM to find the containing row node and sort out which comes first.
 *
 * @param {!hterm.ScrollPort} scrollPort The parent hterm.ScrollPort instance.
 * @constructor
 */
hterm.ScrollPort.Selection = function(scrollPort) {
  this.scrollPort_ = scrollPort;

  /**
   * The row containing the start of the selection.
   *
   * This may be partially or fully selected.  It may be the selection anchor
   * or the focus, but its rowIndex is guaranteed to be less-than-or-equal-to
   * that of the endRow.
   *
   * If only one row is selected then startRow == endRow.  If there is no
   * selection or the selection is collapsed then startRow == null.
   *
   * @type {?Node}
   */
  this.startRow = null;

  /**
   * Node where selection starts.
   *
   * @type {?Node}
   */
  this.startNode = null;

  /**
   * Character offset in startNode where selection starts.
   *
   * @type {number}
   */
  this.startOffset = 0;

  /**
   * The row containing the end of the selection.
   *
   * This may be partially or fully selected.  It may be the selection anchor
   * or the focus, but its rowIndex is guaranteed to be greater-than-or-equal-to
   * that of the startRow.
   *
   * If only one row is selected then startRow == endRow.  If there is no
   * selection or the selection is collapsed then startRow == null.
   *
   * @type {?Node}
   */
  this.endRow = null;

  /**
   * Node where selection ends.
   *
   * @type {?Node}
   */
  this.endNode = null;

  /**
   * Character offset in endNode where selection ends.
   *
   * @type {number}
   */
  this.endOffset = 0;

  /**
   * True if startRow != endRow.
   *
   * @type {boolean}
   */
  this.isMultiline = false;

  /**
   * True if the selection is just a point (empty) rather than a range.
   *
   * @type {boolean}
   */
  this.isCollapsed = true;

  /**
   * @private
   * @const
   */
  this.autoScrollOnMouseMoveBound_ =
      /** @type {!EventListener} */ (this.autoScrollOnMouseMove_.bind(this));

  /**
   * True when 'mousedown' event is received for primary button until 'mouseup'
   * is received for primary button.
   *
   * @private {boolean}
   */
  this.autoScrollEnabled_ = false;

  /**
   * Direction of auto scroll. 1 for scrolling down, -1 for scrolling up. Set by
   * detecting mouse position from 'mousemove' events.
   *
   * @private {number}
   */
  this.autoScrollDirection_ = 1;

  /**
   * ID of interval running this.autoScroll_(). Set by startAutoScroll_(),
   * cleared by stopAutoScroll_().
   *
   * @private {?number}
   */
  this.autoScrollInterval_ = null;

  /**
   * Number of rows to scroll at a time. Auto scroll runs at a 200ms interval.
   * It starts by scrolling 1 row and accelerates by 20% each invocation.
   *
   * @private {number}
   */
  this.autoScrollDelta_ = 1;
};

/**
 * Given a list of DOM nodes and a container, return the DOM node that
 * is first according to a depth-first search.
 *
 * @param {!Node} parent
 * @param {!Array<!Node>} childAry
 * @return {?Node} Returns null if none of the children are found.
 */
hterm.ScrollPort.Selection.prototype.findFirstChild = function(
    parent, childAry) {
  let node = parent.firstChild;

  while (node) {
    if (childAry.indexOf(node) != -1) {
      return node;
    }

    if (node.childNodes.length) {
      const rv = this.findFirstChild(node, childAry);
      if (rv) {
        return rv;
      }
    }

    node = node.nextSibling;
  }

  return null;
};

/**
 * Capture mousemove events while auto scroll is enabled. Set scroll direction
 * up if mouse is above midpoint of screen, else set direction down. Start and
 * stop auto scroll when mouse moves above or below rows.
 *
 * @param {!MouseEvent} e
 * @private
 */
hterm.ScrollPort.Selection.prototype.autoScrollOnMouseMove_ = function(e) {
  // If mouse is in top half of screen, then direction is up, else down.
  const screenHeight = this.scrollPort_.lastScreenHeight_;
  this.autoScrollDirection_ = (e.pageY * 2) < screenHeight ? -1 : 1;

  const padding = this.scrollPort_.screenPaddingSize;
  if (e.pageY < padding) {
    // Mouse above rows.
    this.startAutoScroll_();
  } else if (e.pageY < (this.scrollPort_.visibleRowsHeight + padding)) {
    // Mouse inside rows.
    this.stopAutoScroll_();
  } else {
    // Mouse below rows.
    this.startAutoScroll_();
  }
};

/**
 * Enable auto scrolling. True while primary mouse button is down.
 *
 * @param {boolean} enabled
 */
hterm.ScrollPort.Selection.prototype.setAutoScrollEnabled = function(enabled) {
  this.autoScrollEnabled_ = enabled;
  const doc = this.scrollPort_.getDocument();
  if (enabled) {
    doc.addEventListener('mousemove', this.autoScrollOnMouseMoveBound_);
  } else {
    doc.removeEventListener('mousemove', this.autoScrollOnMouseMoveBound_);
    this.stopAutoScroll_();
  }
};

/**
 * Increase this.autoScrollDelta_ by 20% and scroll.
 *
 * @private
 */
hterm.ScrollPort.Selection.prototype.autoScroll_ = function() {
  this.autoScrollDelta_ *= 1.2;
  const delta = Math.floor(this.autoScrollDelta_) * this.autoScrollDirection_;
  this.scrollPort_.scrollRowToTop(this.scrollPort_.getTopRowIndex() + delta);
};

/**
 * Start auto scrolling if primary mouse is down and it is above or below rows.
 *
 * @private
 */
hterm.ScrollPort.Selection.prototype.startAutoScroll_ = function() {
  if (this.autoScrollEnabled_ && this.autoScrollInterval_ === null) {
    this.autoScrollInterval_ = setInterval(this.autoScroll_.bind(this), 200);
  }
};

/**
 * Stop auto scrolling called on 'mouseup' or if mouse moves back into rows.
 *
 * @private
 */
hterm.ScrollPort.Selection.prototype.stopAutoScroll_ = function() {
  clearInterval(this.autoScrollInterval_);
  this.autoScrollInterval_ = null;
  this.autoScrollDelta_ = 1;
};

/**
 * Synchronize this object with the current DOM selection.
 *
 * This is a one-way synchronization, the DOM selection is copied to this
 * object, not the other way around.
 */
hterm.ScrollPort.Selection.prototype.sync = function() {
  // The dom selection object has no way to tell which nodes come first in
  // the document, so we have to figure that out.
  //
  // This function is used when we detect that the "anchor" node is first.
  const anchorFirst = () => {
    this.startRow = anchorRow;
    this.startNode = selection.anchorNode;
    this.startOffset = selection.anchorOffset;
    this.endRow = focusRow;
    this.endNode = focusNode;
    this.endOffset = focusOffset;
  };

  // This function is used when we detect that the "focus" node is first.
  const focusFirst = () => {
    this.startRow = focusRow;
    this.startNode = focusNode;
    this.startOffset = focusOffset;
    this.endRow = anchorRow;
    this.endNode = selection.anchorNode;
    this.endOffset = selection.anchorOffset;
  };

  const selection = this.scrollPort_.getDocument().getSelection();

  const clear = () => {
    this.startRow = null;
    this.startNode = null;
    this.startOffset = 0;
    this.endRow = null;
    this.endNode = null;
    this.endOffset = 0;
    this.isMultiline = false;
    this.isCollapsed = true;
  };

  if (!selection) {
    clear();
    return;
  }

  // Do not ignore collapsed selections. They must not be cleared.
  // Screen readers will set them as they navigate through the DOM.
  // Auto scroll can also create them as the selection inverts if you scroll
  // one way and then reverse direction.
  this.isCollapsed = !selection || selection.isCollapsed;

  let anchorRow = selection.anchorNode;
  while (anchorRow && anchorRow.nodeName != 'X-ROW') {
    anchorRow = anchorRow.parentNode;
  }

  if (!anchorRow) {
    // Don't set a selection if it's not a row node that's selected.
    clear();
    return;
  }

  let focusRow = selection.focusNode;
  let focusNode = focusRow;
  let focusOffset = selection.focusOffset;
  const focusIsStartOfTopRow = () => {
    focusRow = this.scrollPort_.topFold_.nextSibling;
    focusNode = focusRow;
    focusOffset = 0;
  };
  const focusIsEndOfBottomRow = () => {
    focusRow = this.scrollPort_.bottomFold_.previousSibling;
    focusNode = focusRow;
    while (focusNode.lastChild) {
      focusNode = focusNode.lastChild;
    }
    focusOffset = focusNode.length || 0;
  };

  // If focus is topFold or bottomFold, use adjacent row.
  if (focusRow === this.scrollPort_.topFold_) {
    focusIsStartOfTopRow();
  } else if (focusRow === this.scrollPort_.bottomFold_) {
    focusIsEndOfBottomRow();
  }

  while (focusRow && focusRow.nodeName != 'X-ROW') {
    focusRow = focusRow.parentNode;
  }

  if (!focusRow) {
    // Keep existing selection (do not clear()) if focus is not a valid row.
    return;
  }

  // During auto scroll, if focusRow is one of the selection rows inside the
  // fold, use adjacent row.
  if (this.scrollPort_.autoScrollEnabled_) {
    let node = this.scrollPort_.topFold_;
    while ((node = node.previousSibling) !== null) {
      if (node === focusRow) {
        focusIsStartOfTopRow();
      }
    }
    node = this.scrollPort_.bottomFold_;
    while ((node = node.nextSibling) !== null) {
      if (node === focusRow) {
        focusIsEndOfBottomRow();
      }
    }
  }

  if (anchorRow.rowIndex < focusRow.rowIndex) {
    anchorFirst();

  } else if (anchorRow.rowIndex > focusRow.rowIndex) {
    focusFirst();

  } else if (focusNode == selection.anchorNode) {
    if (selection.anchorOffset < focusOffset) {
      anchorFirst();
    } else {
      focusFirst();
    }

  } else {
    // The selection starts and ends in the same row, but isn't contained all
    // in a single node.
    const firstNode = this.findFirstChild(
        anchorRow, [selection.anchorNode, focusNode]);

    if (!firstNode) {
      throw new Error('Unexpected error syncing selection.');
    }

    if (firstNode == selection.anchorNode) {
      anchorFirst();
    } else {
      focusFirst();
    }
  }

  this.isMultiline = anchorRow.rowIndex != focusRow.rowIndex;
};

/**
 * Turn a div into this hterm.ScrollPort.
 *
 * @param {!Element} div
 * @param {function()=} callback
 */
hterm.ScrollPort.prototype.decorate = function(div, callback) {
  this.div_ = div;

  this.iframe_ = div.ownerDocument.createElement('iframe');
  this.iframe_.style.cssText = (
      'border: 0;' +
      'height: 100%;' +
      'position: absolute;' +
      'width: 100%');

  div.appendChild(this.iframe_);

  const onLoad = () => {
    this.paintIframeContents_();
    if (callback) {
      callback();
    }
  };

  // Insert Iframe content asynchronously in FF.  Otherwise when the frame's
  // load event fires in FF it clears out the content of the iframe.
  if ('mozInnerScreenX' in window) { // detect a FF only property
    this.iframe_.addEventListener('load', () => onLoad());
  } else {
    onLoad();
  }
};


/**
 * Initialises the content of this.iframe_. This needs to be done asynchronously
 * in FF after the Iframe's load event has fired.
 *
 * @private
 */
hterm.ScrollPort.prototype.paintIframeContents_ = function() {
  this.iframe_.contentWindow.addEventListener('resize',
                                              this.resize.bind(this));

  const doc = this.document_ = this.iframe_.contentDocument;
  doc.body.style.cssText = (
      'margin: 0px;' +
      'padding: 0px;' +
      'height: 100%;' +
      'width: 100%;' +
      'overflow: hidden;' +
      'cursor: var(--hterm-mouse-cursor-style);' +
      'user-select: none;');

  const metaCharset = doc.createElement('meta');
  metaCharset.setAttribute('charset', 'utf-8');
  doc.head.appendChild(metaCharset);

  if (this.DEBUG_) {
    // When we're debugging we add padding to the body so that the offscreen
    // elements are visible.
    this.document_.body.style.paddingTop =
        this.document_.body.style.paddingBottom =
        'calc(var(--hterm-charsize-height) * 3)';
  }

  const style = doc.createElement('style');
  style.textContent = (
      'x-row {' +
      '  display: block;' +
      '  height: var(--hterm-charsize-height);' +
      '  line-height: var(--hterm-charsize-height);' +
      '}');
  doc.head.appendChild(style);

  this.userCssLink_ = doc.createElement('link');
  this.userCssLink_.setAttribute('rel', 'stylesheet');

  // TODO(rginda): Sorry, this 'screen_' isn't the same thing as hterm.Screen
  // from screen.js.  I need to pick a better name for one of them to avoid
  // the collision.
  // We make this field editable even though we don't actually allow anything
  // to be edited here so that Chrome will do the right thing with virtual
  // keyboards and IMEs.  But make sure we turn off all the input helper logic
  // that doesn't make sense here, and might inadvertently mung or save input.
  // Some of these attributes are standard while others are browser specific,
  // but should be safely ignored by other browsers.
  this.screen_ = doc.createElement('x-screen');
  this.screen_.setAttribute('contenteditable', 'true');
  this.screen_.setAttribute('spellcheck', 'false');
  this.screen_.setAttribute('autocomplete', 'off');
  this.screen_.setAttribute('autocorrect', 'off');
  this.screen_.setAttribute('autocapitalize', 'none');

  // In some ways the terminal behaves like a text box but not in all ways. It
  // is not editable in the same ways a text box is editable and the content we
  // want to be read out by a screen reader does not always align with the edits
  // (selection changes) that happen in the terminal window. Use the log role so
  // that the screen reader doesn't treat it like a text box and announce all
  // selection changes. The announcements that we want spoken are generated
  // by a separate live region, which gives more control over what will be
  // spoken.
  this.screen_.setAttribute('role', 'log');
  this.screen_.setAttribute('aria-live', 'off');
  this.screen_.setAttribute('aria-roledescription', 'Terminal');

  // Set aria-readonly to indicate to the screen reader that the text on the
  // screen is not modifiable by the html cursor. It may be modifiable by
  // sending input to the application running in the terminal, but this is
  // orthogonal to the DOM's notion of modifiable.
  this.screen_.setAttribute('aria-readonly', 'true');
  this.screen_.setAttribute('tabindex', '-1');
  this.screen_.style.cssText = `
      background-color: rgb(var(--hterm-background-color));
      caret-color: transparent;
      color: rgb(var(--hterm-foreground-color));
      display: block;
      font-variant-ligatures: none;
      height: 100%;
      overflow-y: scroll; overflow-x: hidden;
      white-space: pre;
      width: 100%;
      outline: none !important;
  `;


  /**
   * @param {function(...)} f
   * @return {!EventListener}
   */
  const el = (f) => /** @type {!EventListener} */ (f);
  this.screen_.addEventListener('scroll', el(this.onScroll_.bind(this)));
  this.screen_.addEventListener('wheel', el(this.onScrollWheel_.bind(this)));
  this.screen_.addEventListener('touchstart', el(this.onTouch_.bind(this)));
  this.screen_.addEventListener('touchmove', el(this.onTouch_.bind(this)));
  this.screen_.addEventListener('touchend', el(this.onTouch_.bind(this)));
  this.screen_.addEventListener('touchcancel', el(this.onTouch_.bind(this)));
  this.screen_.addEventListener('copy', el(this.onCopy_.bind(this)));
  this.screen_.addEventListener('paste', el(this.onPaste_.bind(this)));
  this.screen_.addEventListener('drop', el(this.onDragAndDrop_.bind(this)));

  // Add buttons to make accessible scrolling through terminal history work
  // well. These are positioned off-screen until they are selected, at which
  // point they are moved on-screen.
  const a11yButtonHeight = 30;
  const a11yButtonBorder = 1;
  const a11yButtonTotalHeight = a11yButtonHeight + 2 * a11yButtonBorder;
  const a11yButtonStyle = `
    border-style: solid;
    border-width: ${a11yButtonBorder}px;
    color: rgb(var(--hterm-foreground-color));
    cursor: pointer;
    font-family: monospace;
    font-weight: bold;
    height: ${a11yButtonHeight}px;
    line-height: ${a11yButtonHeight}px;
    padding: 0 8px;
    position: fixed;
    right: var(--hterm-screen-padding-size);
    text-align: center;
    z-index: 1;
  `;
  // Note: we use a <div> rather than a <button> because we don't want it to be
  // focusable. If it's focusable this interferes with the contenteditable
  // focus.
  this.scrollUpButton_ = this.document_.createElement('div');
  this.scrollUpButton_.id = 'hterm:a11y:page-up';
  this.scrollUpButton_.innerText = '^';
  this.scrollUpButton_.setAttribute('role', 'button');
  this.scrollUpButton_.style.cssText = a11yButtonStyle;
  this.scrollUpButton_.style.top = `${-a11yButtonTotalHeight}px`;
  this.scrollUpButton_.addEventListener('click', this.scrollPageUp.bind(this));

  this.scrollDownButton_ = this.document_.createElement('div');
  this.scrollDownButton_.id = 'hterm:a11y:page-down';
  this.scrollDownButton_.innerText = 'v';
  this.scrollDownButton_.setAttribute('role', 'button');
  this.scrollDownButton_.style.cssText = a11yButtonStyle;
  this.scrollDownButton_.style.bottom = `${-a11yButtonTotalHeight}px`;
  this.scrollDownButton_.addEventListener(
      'click', this.scrollPageDown.bind(this));

  this.optionsButton_ = this.document_.createElement('div');
  this.optionsButton_.id = 'hterm:a11y:options';
  this.optionsButton_.innerText = hterm.msg('OPTIONS_BUTTON_LABEL', [], 'Options');
  this.optionsButton_.setAttribute('role', 'button');
  this.optionsButton_.style.cssText = a11yButtonStyle;
  this.optionsButton_.style.bottom = `${-2 * a11yButtonTotalHeight}px`;
  this.optionsButton_.addEventListener(
      'click', this.publish.bind(this, 'options'));

  doc.body.appendChild(this.scrollUpButton_);
  doc.body.appendChild(this.screen_);
  doc.body.appendChild(this.scrollDownButton_);
  doc.body.appendChild(this.optionsButton_);

  // We only allow the scroll buttons to display after a delay, otherwise the
  // page up button can flash onto the screen during the intial change in focus.
  // This seems to be because it is the first element inside the <x-screen>
  // element, which will get focussed on page load.
  this.allowA11yButtonsToDisplay_ = false;
  setTimeout(() => { this.allowA11yButtonsToDisplay_ = true; }, 500);
  this.document_.addEventListener('selectionchange', () => {
    this.selection.sync();

    if (!this.allowA11yButtonsToDisplay_) {
      return;
    }

    const accessibilityEnabled = this.accessibilityReader_ &&
        this.accessibilityReader_.accessibilityEnabled;

    const selection = this.document_.getSelection();
    let selectedElement;
    if (selection.anchorNode && selection.anchorNode.parentElement) {
      selectedElement = selection.anchorNode.parentElement;
    }
    if (accessibilityEnabled && selectedElement == this.scrollUpButton_) {
      this.scrollUpButton_.style.top = `${this.screenPaddingSize}px`;
    } else {
      this.scrollUpButton_.style.top = `${-a11yButtonTotalHeight}px`;
    }
    if (accessibilityEnabled && selectedElement == this.scrollDownButton_) {
      this.scrollDownButton_.style.bottom = `${this.screenPaddingSize}px`;
    } else {
      this.scrollDownButton_.style.bottom = `${-a11yButtonTotalHeight}px`;
    }
    if (accessibilityEnabled && selectedElement == this.optionsButton_) {
      this.optionsButton_.style.bottom = `${this.screenPaddingSize}px`;
    } else {
      this.optionsButton_.style.bottom = `${-2 * a11yButtonTotalHeight}px`;
    }
  });

  // This is the main container for the fixed rows.
  this.rowNodes_ = doc.createElement('div');
  this.rowNodes_.id = 'hterm:row-nodes';
  this.rowNodes_.style.cssText = (
      'display: block;' +
      'position: fixed;' +
      'overflow: hidden;' +
      'user-select: text;');
  this.screen_.appendChild(this.rowNodes_);

  // Two nodes to hold offscreen text during the copy event.
  this.topSelectBag_ = doc.createElement('x-select-bag');
  this.topSelectBag_.style.cssText = (
      'display: block;' +
      'overflow: hidden;' +
      'height: var(--hterm-charsize-height);' +
      'white-space: pre;');

  this.bottomSelectBag_ = this.topSelectBag_.cloneNode();

  // Nodes above the top fold and below the bottom fold are hidden.  They are
  // only used to hold rows that are part of the selection but are currently
  // scrolled off the top or bottom of the visible range.
  this.topFold_ = doc.createElement('x-fold');
  this.topFold_.id = 'hterm:top-fold-for-row-selection';
  this.topFold_.style.cssText = `
    display: block;
    height: var(--hterm-screen-padding-size);
  `;
  this.rowNodes_.appendChild(this.topFold_);

  this.bottomFold_ = this.topFold_.cloneNode();
  this.bottomFold_.id = 'hterm:bottom-fold-for-row-selection';
  this.rowNodes_.appendChild(this.bottomFold_);

  // This hidden div accounts for the vertical space that would be consumed by
  // all the rows in the buffer if they were visible.  It's what causes the
  // scrollbar to appear on the 'x-screen', and it moves within the screen when
  // the scrollbar is moved.
  //
  // It is set 'visibility: hidden' to keep the browser from trying to include
  // it in the selection when a user 'drag selects' upwards (drag the mouse to
  // select and scroll at the same time).  Without this, the selection gets
  // out of whack.
  this.scrollArea_ = doc.createElement('div');
  this.scrollArea_.id = 'hterm:scrollarea';
  this.scrollArea_.style.cssText = 'visibility: hidden';
  this.screen_.appendChild(this.scrollArea_);

  // We send focus to this element just before a paste happens, so we can
  // capture the pasted text and forward it on to someone who cares.
  this.pasteTarget_ = doc.createElement('textarea');
  this.pasteTarget_.id = 'hterm:ctrl-v-paste-target';
  this.pasteTarget_.setAttribute('tabindex', '-1');
  this.pasteTarget_.setAttribute('aria-hidden', 'true');
  this.pasteTarget_.style.cssText = (
    'position: absolute;' +
    'height: 1px;' +
    'width: 1px;' +
    'left: 0px; ' +
    'bottom: 0px;' +
    'opacity: 0');
  this.pasteTarget_.contentEditable = true;

  this.screen_.appendChild(this.pasteTarget_);
  this.pasteTarget_.addEventListener(
      'textInput', this.handlePasteTargetTextInput_.bind(this));

  this.resize();
};

/**
 * Set the AccessibilityReader object to use to announce page scroll updates.
 *
 * @param {!hterm.AccessibilityReader} accessibilityReader for announcing page
 *     scroll updates.
 */
hterm.ScrollPort.prototype.setAccessibilityReader =
    function(accessibilityReader) {
  this.accessibilityReader_ = accessibilityReader;
};

/**
 * Scroll the terminal one page up (minus one line) relative to the current
 * position.
 */
hterm.ScrollPort.prototype.scrollPageUp = function() {
  if (this.getTopRowIndex() == 0) {
    return;
  }

  const i = this.getTopRowIndex();
  this.scrollRowToTop(i - this.visibleRowCount + 1);

  this.assertiveAnnounce_();
};

/**
 * Scroll the terminal one page down (minus one line) relative to the current
 * position.
 */
hterm.ScrollPort.prototype.scrollPageDown = function() {
  if (this.isScrolledEnd) {
    return;
  }

  const i = this.getTopRowIndex();
  this.scrollRowToTop(i + this.visibleRowCount - 1);

  this.assertiveAnnounce_();
};

/** @return {string} */
hterm.ScrollPort.prototype.getFontFamily = function() {
  return this.screen_.style.fontFamily;
};

/** Focus. */
hterm.ScrollPort.prototype.focus = function() {
  this.iframe_.focus();
  this.screen_.focus();
  this.publish('focus');
};

/**
 * Unfocus the scrollport.
 */
hterm.ScrollPort.prototype.blur = function() {
  this.screen_.blur();
};

/** @param {string} image */
hterm.ScrollPort.prototype.setBackgroundImage = function(image) {
  this.screen_.style.backgroundImage = image;
};

/** @param {string} size */
hterm.ScrollPort.prototype.setBackgroundSize = function(size) {
  this.screen_.style.backgroundSize = size;
};

/** @param {string} position */
hterm.ScrollPort.prototype.setBackgroundPosition = function(position) {
  this.screen_.style.backgroundPosition = position;
};

/** @param {number} size */
hterm.ScrollPort.prototype.setScreenPaddingSize = function(size) {
  this.screenPaddingSize = size;
  this.resize();
};

/** @param {boolean} pasteOnDrop */
hterm.ScrollPort.prototype.setPasteOnDrop = function(pasteOnDrop) {
  this.pasteOnDrop = pasteOnDrop;
};

/**
 * Get the usable size of the scrollport screen.
 *
 * The width will not include the scrollbar width.
 *
 * @return {{height: number, width: number}}
 */
hterm.ScrollPort.prototype.getScreenSize = function() {
  const size = this.screen_.getBoundingClientRect();
  const rightPadding = Math.max(
      this.screenPaddingSize, this.currentScrollbarWidthPx);
  return {
    height: size.height - (2 * this.screenPaddingSize),
    width: size.width - this.screenPaddingSize - rightPadding,
  };
};

/**
 * Get the usable width of the scrollport screen.
 *
 * This the widget width minus scrollbar width.
 *
 * @return {number}
 */
hterm.ScrollPort.prototype.getScreenWidth = function() {
  return this.getScreenSize().width;
};

/**
 * Get the usable height of the scrollport screen.
 *
 * @return {number}
 */
hterm.ScrollPort.prototype.getScreenHeight = function() {
  return this.getScreenSize().height;
};

/**
 * Get the horizontal position in px where the scrollbar starts.
 *
 * @return {number}
 */
hterm.ScrollPort.prototype.getScrollbarX = function() {
  return this.screen_.getBoundingClientRect().width -
         this.currentScrollbarWidthPx;
};

/**
 * Return the document that holds the visible rows of this hterm.ScrollPort.
 *
 * @return {!Document}
 */
hterm.ScrollPort.prototype.getDocument = function() {
  return this.document_;
};

/**
 * Returns the x-screen element that holds the rows of this hterm.ScrollPort.
 *
 * @return {?Element}
 */
hterm.ScrollPort.prototype.getScreenNode = function() {
  return this.screen_;
};

/**
 * Clear out any cached rowNodes.
 */
hterm.ScrollPort.prototype.resetCache = function() {
  this.currentRowNodeCache_ = null;
  this.previousRowNodeCache_ = {};
};

/**
 * Change the current rowProvider.
 *
 * This will clear the row cache and cause a redraw.
 *
 * @param {!hterm.RowProvider} rowProvider An object capable of providing the
 *     rows in this hterm.ScrollPort.
 */
hterm.ScrollPort.prototype.setRowProvider = function(rowProvider) {
  this.resetCache();
  this.rowProvider_ = rowProvider;
  this.scheduleRedraw();
};

/**
 * Inform the ScrollPort that the root DOM nodes for some or all of the visible
 * rows are no longer valid.
 *
 * Specifically, this should be called if this.rowProvider_.getRowNode() now
 * returns an entirely different node than it did before.  It does not
 * need to be called if the content of a row node is the only thing that
 * changed.
 *
 * This skips some of the overhead of a full redraw, but should not be used
 * in cases where the scrollport has been scrolled, or when the row count has
 * changed.
 */
hterm.ScrollPort.prototype.invalidate = function() {
  let node = this.topFold_.nextSibling;
  while (node != this.bottomFold_) {
    const nextSibling = node.nextSibling;
    node.remove();
    node = nextSibling;
  }

  this.previousRowNodeCache_ = null;
  const topRowIndex = this.getTopRowIndex();
  const bottomRowIndex = this.getBottomRowIndex(topRowIndex);

  this.drawVisibleRows_(topRowIndex, bottomRowIndex);
};

/**
 * Schedule invalidate.
 */
hterm.ScrollPort.prototype.scheduleInvalidate = function() {
  if (this.timeouts_.invalidate) {
    return;
  }

  this.timeouts_.invalidate = setTimeout(() => {
    delete this.timeouts_.invalidate;
    this.invalidate();
  });
};

/**
 * Return the current font size of the ScrollPort.
 *
 * @return {number}
 */
hterm.ScrollPort.prototype.getFontSize = function() {
  return parseInt(this.screen_.style.fontSize, 10);
};

/**
 * Reset dimensions and visible row count to account for a change in the
 * dimensions of the 'x-screen'.
 */
hterm.ScrollPort.prototype.resize = function() {
  this.syncScrollbarWidth_();
  this.syncScrollHeight();
  this.syncRowNodesDimensions_();

  this.publish(
      'resize', {scrollPort: this},
      () => this.scheduleRedraw());
};

/**
 * Announce text content on the current screen for the screen reader.
 */
hterm.ScrollPort.prototype.assertiveAnnounce_ = function() {
  if (!this.accessibilityReader_) {
    return;
  }

  const topRow = this.getTopRowIndex();
  const bottomRow = this.getBottomRowIndex(topRow);

  let percentScrolled = 100 * topRow /
      Math.max(1, this.rowProvider_.getRowCount() - this.visibleRowCount);
  percentScrolled = Math.min(100, Math.round(percentScrolled));
  let currentScreenContent = hterm.msg('ANNOUNCE_CURRENT_SCREEN_HEADER',
                                       [percentScrolled],
                                       '$1% scrolled,');
  currentScreenContent += '\n';

  for (let i = topRow; i <= bottomRow; ++i) {
    const node = this.fetchRowNode_(i);
    currentScreenContent += node.textContent + '\n';
  }

  this.accessibilityReader_.assertiveAnnounce(currentScreenContent);
};

/**
 * Set the position and size of the row nodes element.
 */
hterm.ScrollPort.prototype.syncRowNodesDimensions_ = function() {
  const screenSize = this.getScreenSize();

  this.lastScreenWidth_ = screenSize.width;
  this.lastScreenHeight_ = screenSize.height;

  // We don't want to show a partial row because it would be distracting
  // in a terminal, so we floor any fractional row count.
  this.visibleRowCount = lib.f.smartFloorDivide(
      screenSize.height, this.characterSize.height);

  // Then compute the height of our integral number of rows.
  this.visibleRowsHeight = this.visibleRowCount * this.characterSize.height;

  // Then the difference between the screen height and total row height needs to
  // be made up for as top margin.  We need to record this value so it
  // can be used later to determine the topRowIndex.
  this.visibleRowTopMargin = 0;
  this.visibleRowBottomMargin = screenSize.height - this.visibleRowsHeight;

  this.topFold_.style.marginBottom = this.visibleRowTopMargin + 'px';


  let topFoldOffset = 0;
  let node = this.topFold_.previousSibling;
  while (node) {
    topFoldOffset += node.getBoundingClientRect().height;
    node = node.previousSibling;
  }

  // Set the dimensions of the visible rows container.
  this.rowNodes_.style.width = screenSize.width + 'px';
  this.rowNodes_.style.height =
      this.visibleRowsHeight + topFoldOffset + this.screenPaddingSize + 'px';
  this.rowNodes_.style.left =
      this.screen_.offsetLeft + this.screenPaddingSize + 'px';
  this.rowNodes_.style.top =
      this.screen_.offsetTop - topFoldOffset + 'px';
};

/**
 * Measure scrollbar width.
 *
 * @private
 */
hterm.ScrollPort.prototype.syncScrollbarWidth_ = function() {
  const width = this.screen_.getBoundingClientRect().width -
                this.screen_.clientWidth;
  if (width > 0) {
    this.currentScrollbarWidthPx = width;
  }
};

/**
 * Resize the scroll area to appear as though it contains every row.
 */
hterm.ScrollPort.prototype.syncScrollHeight = function() {
  this.lastRowCount_ = this.rowProvider_.getRowCount();
  this.scrollArea_.style.height = (this.characterSize.height *
                                   this.lastRowCount_ +
                                   (2 * this.screenPaddingSize) +
                                   this.visibleRowTopMargin +
                                   this.visibleRowBottomMargin +
                                   'px');
};

/**
 * Schedule a redraw to happen asynchronously.
 *
 * If this method is called multiple times before the redraw has a chance to
 * run only one redraw occurs.
 */
hterm.ScrollPort.prototype.scheduleRedraw = function() {
  if (this.timeouts_.redraw) {
    return;
  }

  this.timeouts_.redraw = setTimeout(() => {
    delete this.timeouts_.redraw;
    this.redraw_();
  });
};

/**
 * Update the state of scroll up/down buttons.
 *
 * If the viewport is at the top or bottom row of output, these buttons will
 * be made transparent and clicking them shouldn't scroll any further.
 */
hterm.ScrollPort.prototype.updateScrollButtonState_ = function() {
  const setButton = (button, disabled) => {
    button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    button.style.opacity = disabled ? 0.5 : 1;
  };
  setButton(this.scrollUpButton_, this.getTopRowIndex() == 0);
  setButton(this.scrollDownButton_, this.isScrolledEnd);
};

/**
 * Redraw the current hterm.ScrollPort based on the current scrollbar position.
 *
 * When redrawing, we are careful to make sure that the rows that start or end
 * the current selection are not touched in any way.  Doing so would disturb
 * the selection, and cleaning up after that would cause flashes at best and
 * incorrect selection at worst.  Instead, we modify the DOM around these nodes.
 * We even stash the selection start/end outside of the visible area if
 * they are not supposed to be visible in the hterm.ScrollPort.
 */
hterm.ScrollPort.prototype.redraw_ = function() {
  this.resetSelectBags_();
  this.selection.sync();

  this.syncScrollHeight();

  this.currentRowNodeCache_ = {};

  const topRowIndex = this.getTopRowIndex();
  const bottomRowIndex = this.getBottomRowIndex(topRowIndex);

  this.drawTopFold_(topRowIndex);
  this.drawBottomFold_(bottomRowIndex);
  this.drawVisibleRows_(topRowIndex, bottomRowIndex);
  this.ariaHideOffscreenSelectionRows_(topRowIndex, bottomRowIndex);

  this.syncRowNodesDimensions_();

  this.previousRowNodeCache_ = this.currentRowNodeCache_;
  this.currentRowNodeCache_ = null;

  this.isScrolledEnd = (
    this.getTopRowIndex() + this.visibleRowCount >= this.lastRowCount_);

  this.updateScrollButtonState_();
};

/**
 * Ensure that the nodes above the top fold are as they should be.
 *
 * If the selection start and/or end nodes are above the visible range
 * of this hterm.ScrollPort then the dom will be adjusted so that they appear
 * before the top fold (the first x-fold element, aka this.topFold).
 *
 * If not, the top fold will be the first element.
 *
 * It is critical that this method does not move the selection nodes.  Doing
 * so would clear the current selection.  Instead, the rest of the DOM is
 * adjusted around them.
 *
 * @param {number} topRowIndex
 */
hterm.ScrollPort.prototype.drawTopFold_ = function(topRowIndex) {
  if (!this.selection.startRow ||
      this.selection.startRow.rowIndex >= topRowIndex) {
    // Selection is entirely below the top fold, just make sure the fold is
    // the first child.
    if (this.rowNodes_.firstChild != this.topFold_) {
      this.rowNodes_.insertBefore(this.topFold_, this.rowNodes_.firstChild);
    }

    return;
  }

  if (!this.selection.isMultiline ||
      this.selection.endRow.rowIndex >= topRowIndex) {
    // Only the startRow is above the fold.
    if (this.selection.startRow.nextSibling != this.topFold_) {
      this.rowNodes_.insertBefore(this.topFold_,
                                  this.selection.startRow.nextSibling);
    }
  } else {
    // Both rows are above the fold.
    if (this.selection.endRow.nextSibling != this.topFold_) {
      this.rowNodes_.insertBefore(this.topFold_,
                                  this.selection.endRow.nextSibling);
    }

    // Trim any intermediate lines.
    while (this.selection.startRow.nextSibling !=
           this.selection.endRow) {
      this.rowNodes_.removeChild(this.selection.startRow.nextSibling);
    }
  }

  while (this.rowNodes_.firstChild != this.selection.startRow) {
    this.rowNodes_.removeChild(this.rowNodes_.firstChild);
  }
};

/**
 * Ensure that the nodes below the bottom fold are as they should be.
 *
 * If the selection start and/or end nodes are below the visible range
 * of this hterm.ScrollPort then the dom will be adjusted so that they appear
 * after the bottom fold (the second x-fold element, aka this.bottomFold).
 *
 * If not, the bottom fold will be the last element.
 *
 * It is critical that this method does not move the selection nodes.  Doing
 * so would clear the current selection.  Instead, the rest of the DOM is
 * adjusted around them.
 *
 * @param {number} bottomRowIndex
 */
hterm.ScrollPort.prototype.drawBottomFold_ = function(bottomRowIndex) {
  if (!this.selection.endRow ||
      this.selection.endRow.rowIndex <= bottomRowIndex) {
    // Selection is entirely above the bottom fold, just make sure the fold is
    // the last child.
    if (this.rowNodes_.lastChild != this.bottomFold_) {
      this.rowNodes_.appendChild(this.bottomFold_);
    }

    return;
  }

  if (!this.selection.isMultiline ||
      this.selection.startRow.rowIndex <= bottomRowIndex) {
    // Only the endRow is below the fold.
    if (this.bottomFold_.nextSibling != this.selection.endRow) {
      this.rowNodes_.insertBefore(this.bottomFold_,
                                  this.selection.endRow);
    }
  } else {
    // Both rows are below the fold.
    if (this.bottomFold_.nextSibling != this.selection.startRow) {
      this.rowNodes_.insertBefore(this.bottomFold_,
                                  this.selection.startRow);
    }

    // Trim any intermediate lines.
    while (this.selection.startRow.nextSibling !=
           this.selection.endRow) {
      this.rowNodes_.removeChild(this.selection.startRow.nextSibling);
    }
  }

  while (this.rowNodes_.lastChild != this.selection.endRow) {
    this.rowNodes_.removeChild(this.rowNodes_.lastChild);
  }
};

/**
 * Ensure that the rows between the top and bottom folds are as they should be.
 *
 * This method assumes that drawTopFold_() and drawBottomFold_() have already
 * run, and that they have left any visible selection row (selection start
 * or selection end) between the folds.
 *
 * It recycles DOM nodes from the previous redraw where possible, but will ask
 * the rowSource to make new nodes if necessary.
 *
 * It is critical that this method does not move the selection nodes.  Doing
 * so would clear the current selection.  Instead, the rest of the DOM is
 * adjusted around them.
 *
 * @param {number} topRowIndex
 * @param {number} bottomRowIndex
 */
hterm.ScrollPort.prototype.drawVisibleRows_ = function(
    topRowIndex, bottomRowIndex) {
  // Keep removing nodes, starting with currentNode, until we encounter
  // targetNode.  Throws on failure.
  const removeUntilNode = (currentNode, targetNode) => {
    while (currentNode != targetNode) {
      if (!currentNode) {
        throw new Error('Did not encounter target node');
      }

      if (currentNode == this.bottomFold_) {
        throw new Error('Encountered bottom fold before target node');
      }

      const deadNode = currentNode;
      currentNode = currentNode.nextSibling;
      deadNode.remove();
    }
  };

  // Shorthand for things we're going to use a lot.
  const selectionStartRow = this.selection.startRow;
  const selectionEndRow = this.selection.endRow;
  const bottomFold = this.bottomFold_;

  // The node we're examining during the current iteration.
  let node = this.topFold_.nextSibling;

  const targetDrawCount = Math.min(this.visibleRowCount,
                                   this.rowProvider_.getRowCount());

  for (let drawCount = 0; drawCount < targetDrawCount; drawCount++) {
    const rowIndex = topRowIndex + drawCount;

    if (node == bottomFold) {
      // We've hit the bottom fold, we need to insert a new row.
      const newNode = this.fetchRowNode_(rowIndex);
      if (!newNode) {
        console.log("Couldn't fetch row index: " + rowIndex);
        break;
      }

      this.rowNodes_.insertBefore(newNode, node);
      continue;
    }

    if (node.rowIndex == rowIndex) {
      // This node is in the right place, move along.
      node = node.nextSibling;
      continue;
    }

    if (selectionStartRow && selectionStartRow.rowIndex == rowIndex) {
      // The selection start row is supposed to be here, remove nodes until
      // we find it.
      removeUntilNode(node, selectionStartRow);
      node = selectionStartRow.nextSibling;
      continue;
    }

    if (selectionEndRow && selectionEndRow.rowIndex == rowIndex) {
      // The selection end row is supposed to be here, remove nodes until
      // we find it.
      removeUntilNode(node, selectionEndRow);
      node = selectionEndRow.nextSibling;
      continue;
    }

    if (node == selectionStartRow || node == selectionEndRow) {
      // We encountered the start/end of the selection, but we don't want it
      // yet.  Insert a new row instead.
      const newNode = this.fetchRowNode_(rowIndex);
      if (!newNode) {
        console.log("Couldn't fetch row index: " + rowIndex);
        break;
      }

      this.rowNodes_.insertBefore(newNode, node);
      continue;
    }

    // There is nothing special about this node, but it's in our way.  Replace
    // it with the node that should be here.
    const newNode = this.fetchRowNode_(rowIndex);
    if (!newNode) {
      console.log("Couldn't fetch row index: " + rowIndex);
      break;
    }

    if (node == newNode) {
      node = node.nextSibling;
      continue;
    }

    this.rowNodes_.insertBefore(newNode, node);
    this.rowNodes_.removeChild(node);
    node = newNode.nextSibling;
  }

  if (node != this.bottomFold_) {
    removeUntilNode(node, bottomFold);
  }
};

/**
 * Ensure aria-hidden is set on any selection rows that are offscreen.
 *
 * The attribute aria-hidden is set to 'true' so that hidden rows are ignored
 * by screen readers.  We keep a list of currently hidden rows so they can be
 * reset each time this function is called as the selection and/or scrolling
 * may have changed.
 *
 * @param {number} topRowIndex Index of top row on screen.
 * @param {number} bottomRowIndex Index of bottom row on screen.
 */
hterm.ScrollPort.prototype.ariaHideOffscreenSelectionRows_ = function(
    topRowIndex, bottomRowIndex) {
  // Reset previously hidden selection rows.
  const hiddenRows = this.ariaHiddenSelectionRows_;
  let row;
  while ((row = hiddenRows.pop())) {
    row.removeAttribute('aria-hidden');
  }

  function checkRow(row) {
    if (row && (row.rowIndex < topRowIndex || row.rowIndex > bottomRowIndex)) {
      row.setAttribute('aria-hidden', 'true');
      hiddenRows.push(row);
    }
  }
  checkRow(this.selection.startRow);
  checkRow(this.selection.endRow);
};

/**
 * Empty out both select bags and remove them from the document.
 *
 * These nodes hold the text between the start and end of the selection
 * when that text is otherwise off screen.  They are filled out in the
 * onCopy_ event.
 */
hterm.ScrollPort.prototype.resetSelectBags_ = function() {
  if (this.topSelectBag_.parentNode) {
    this.topSelectBag_.textContent = '';
    this.topSelectBag_.remove();
  }

  if (this.bottomSelectBag_.parentNode) {
    this.bottomSelectBag_.textContent = '';
    this.bottomSelectBag_.remove();
  }
};

/**
 * Place a row node in the cache of visible nodes.
 *
 * This method may only be used during a redraw_.
 *
 * @param {!Node} rowNode
 */
hterm.ScrollPort.prototype.cacheRowNode_ = function(rowNode) {
  this.currentRowNodeCache_[rowNode.rowIndex] = rowNode;
};

/**
 * Fetch the row node for the given index.
 *
 * This will return a node from the cache if possible, or will request one
 * from the RowProvider if not.
 *
 * If a redraw_ is in progress the row will be added to the current cache.
 *
 * @param {number} rowIndex
 * @return {!Node}
 */
hterm.ScrollPort.prototype.fetchRowNode_ = function(rowIndex) {
  let node;

  if (this.previousRowNodeCache_ && rowIndex in this.previousRowNodeCache_) {
    node = this.previousRowNodeCache_[rowIndex];
  } else {
    node = this.rowProvider_.getRowNode(rowIndex);
  }

  if (this.currentRowNodeCache_) {
    this.cacheRowNode_(node);
  }

  return node;
};

/**
 * Select all rows in the terminal including scrollback.
 */
hterm.ScrollPort.prototype.selectAll = function() {
  let firstRow;

  if (this.topFold_.nextSibling.rowIndex != 0) {
    while (this.topFold_.previousSibling) {
      this.topFold_.previousSibling.remove();
    }

    firstRow = this.fetchRowNode_(0);
    this.rowNodes_.insertBefore(firstRow, this.topFold_);
    this.syncRowNodesDimensions_();
  } else {
    firstRow = this.topFold_.nextSibling;
  }

  const lastRowIndex = this.rowProvider_.getRowCount() - 1;
  let lastRow;

  if (this.bottomFold_.previousSibling.rowIndex != lastRowIndex) {
    while (this.bottomFold_.nextSibling) {
      this.bottomFold_.nextSibling.remove();
    }

    lastRow = this.fetchRowNode_(lastRowIndex);
    this.rowNodes_.appendChild(lastRow);
  } else {
    lastRow = this.bottomFold_.previousSibling;
  }

  let focusNode = lastRow;
  while (focusNode.lastChild) {
    focusNode = focusNode.lastChild;
  }

  const selection = this.document_.getSelection();
  selection.collapse(firstRow, 0);
  selection.extend(focusNode, focusNode.length || 0);

  this.selection.sync();
};

/**
 * Return the maximum scroll position in pixels.
 *
 * @return {number}
 */
hterm.ScrollPort.prototype.getScrollMax_ = function() {
  return this.scrollArea_.getBoundingClientRect().height +
         this.visibleRowTopMargin + this.visibleRowBottomMargin -
         this.screen_.getBoundingClientRect().height;
};

/**
 * Scroll the given rowIndex to the top of the hterm.ScrollPort.
 *
 * @param {number} rowIndex Index of the target row.
 */
hterm.ScrollPort.prototype.scrollRowToTop = function(rowIndex) {
  // Other scrollRowTo* functions and scrollLineUp could pass rowIndex < 0.
  if (rowIndex < 0) {
    rowIndex = 0;
  }

  this.syncScrollHeight();

  this.isScrolledEnd = (
    rowIndex + this.visibleRowCount >= this.lastRowCount_);

  let scrollTop = rowIndex * this.characterSize.height +
      this.visibleRowTopMargin;

  const scrollMax = this.getScrollMax_();
  if (scrollTop > scrollMax) {
    scrollTop = scrollMax;
  }

  if (this.screen_.scrollTop == scrollTop) {
    return;
  }

  this.screen_.scrollTop = scrollTop;
  this.scheduleRedraw();
};

/**
 * Scroll the given rowIndex to the bottom of the hterm.ScrollPort.
 *
 * @param {number} rowIndex Index of the target row.
 */
hterm.ScrollPort.prototype.scrollRowToBottom = function(rowIndex) {
  this.scrollRowToTop(rowIndex - this.visibleRowCount);
};

/**
 * Scroll the given rowIndex to the middle of the hterm.ScrollPort.
 *
 * @param {number} rowIndex Index of the target row.
 */
hterm.ScrollPort.prototype.scrollRowToMiddle = function(rowIndex) {
  this.scrollRowToTop(rowIndex - Math.floor(this.visibleRowCount / 2));
};

/**
 * Return the row index of the first visible row.
 *
 * This is based on the scroll position.  If a redraw_ is in progress this
 * returns the row that *should* be at the top.
 *
 * @return {number}
 */
hterm.ScrollPort.prototype.getTopRowIndex = function() {
  return Math.round(this.screen_.scrollTop / this.characterSize.height);
};

/**
 * Return the row index of the last visible row.
 *
 * This is based on the scroll position.  If a redraw_ is in progress this
 * returns the row that *should* be at the bottom.
 *
 * @param {number} topRowIndex
 * @return {number}
 */
hterm.ScrollPort.prototype.getBottomRowIndex = function(topRowIndex) {
  return topRowIndex + this.visibleRowCount - 1;
};

/**
 * Handler for scroll events.
 *
 * The onScroll event fires when scrollArea's scrollTop property changes.  This
 * may be due to the user manually move the scrollbar, or a programmatic change.
 *
 * @param {!Event} e
 */
hterm.ScrollPort.prototype.onScroll_ = function(e) {
  const screenSize = this.getScreenSize();
  if (screenSize.width != this.lastScreenWidth_ ||
      screenSize.height != this.lastScreenHeight_) {
    // This event may also fire during a resize (but before the resize event!).
    // This happens when the browser moves the scrollbar as part of the resize.
    // In these cases, we want to ignore the scroll event and let onResize
    // handle things.  If we don't, then we end up scrolling to the wrong
    // position after a resize.
    this.resize();
    return;
  }

  this.redraw_();
  this.publish('scroll', {scrollPort: this});
};

/**
 * Clients can override this if they want to hear scrollwheel events.
 *
 * Clients may call event.preventDefault() if they want to keep the scrollport
 * from also handling the events.
 *
 * @param {!WheelEvent} e
 */
hterm.ScrollPort.prototype.onScrollWheel = function(e) {};

/**
 * Handler for scroll-wheel events.
 *
 * The onScrollWheel event fires when the user moves their scrollwheel over this
 * hterm.ScrollPort.  Because the frontmost element in the hterm.ScrollPort is
 * a fixed position DIV, the scroll wheel does nothing by default.  Instead, we
 * have to handle it manually.
 *
 * @param {!WheelEvent} e
 */
hterm.ScrollPort.prototype.onScrollWheel_ = function(e) {
  this.onScrollWheel(e);

  if (e.defaultPrevented) {
    return;
  }

  // Figure out how far this event wants us to scroll.
  const delta = this.scrollWheelDelta(e);

  let top = this.screen_.scrollTop - delta.y;
  if (top < 0) {
    top = 0;
  }

  const scrollMax = this.getScrollMax_();
  if (top > scrollMax) {
    top = scrollMax;
  }

  if (top != this.screen_.scrollTop) {
    // Moving scrollTop causes a scroll event, which triggers the redraw.
    this.screen_.scrollTop = top;

    // Only preventDefault when we've actually scrolled.  If there's nothing
    // to scroll we want to pass the event through so Chrome can detect the
    // overscroll.
    e.preventDefault();
  } else if (e.ctrlKey) {
    // Holding Contrl while scrolling will trigger zoom events.  Defeat them!
    // Touchpad pinches also hit here via fake events.  https://crbug.com/289887
    e.preventDefault();
  }
};

/**
 * Calculate how far a wheel event should scroll.
 *
 * This normalizes the browser's concept of a scroll (pixels, lines, etc...)
 * into a standard pixel distance.
 *
 * @param {!WheelEvent} e The mouse wheel event to process.
 * @return {{x:number, y:number}} The x & y of how far (in pixels) to scroll.
 */
hterm.ScrollPort.prototype.scrollWheelDelta = function(e) {
  const delta = {x: 0, y: 0};

  switch (e.deltaMode) {
    case WheelEvent.DOM_DELTA_PIXEL:
      delta.x = e.deltaX * this.scrollWheelMultiplier_;
      delta.y = e.deltaY * this.scrollWheelMultiplier_;
      break;
    case WheelEvent.DOM_DELTA_LINE:
      delta.x = e.deltaX * this.characterSize.width;
      delta.y = e.deltaY * this.characterSize.height;
      break;
    case WheelEvent.DOM_DELTA_PAGE: {
      const {width, height} = this.screen_.getBoundingClientRect();
      delta.x = e.deltaX * this.characterSize.width * width;
      delta.y = e.deltaY * this.characterSize.height * height;
      break;
    }
  }

  // The Y sign is inverted from what we would expect: up/down are
  // negative/positive respectively.  The X sign is correct though: left/right
  // are negative/positive respectively.
  delta.y *= -1;

  return delta;
};

/**
 * Clients can override this if they want to hear touch events.
 *
 * Clients may call event.preventDefault() if they want to keep the scrollport
 * from also handling the events.
 *
 * @param {!TouchEvent} e
 */
hterm.ScrollPort.prototype.onTouch = function(e) {};

/**
 * Handler for touch events.
 *
 * @param {!TouchEvent} e
 */
hterm.ScrollPort.prototype.onTouch_ = function(e) {
  this.onTouch(e);

  if (e.defaultPrevented) {
    return;
  }

  // Extract the fields from the Touch event that we need.  If we saved the
  // event directly, it has references to other objects (like x-row) that
  // might stick around for a long time.  This way we only have small objects
  // in our lastTouch_ state.
  const scrubTouch = function(t) {
    return {
      id: t.identifier,
      y: t.clientY,
      x: t.clientX,
    };
  };

  let i, touch;
  switch (e.type) {
    case 'touchstart':
      // Workaround focus bug on CrOS if possible.
      // TODO(vapier): Drop this once https://crbug.com/919222 is fixed.
      if (hterm.os == 'cros' && window.chrome && chrome.windows) {
        chrome.windows.getCurrent((win) => {
          if (!win.focused) {
            chrome.windows.update(win.id, {focused: true});
          }
        });
      }

      // Save the current set of touches.
      for (i = 0; i < e.changedTouches.length; ++i) {
        touch = scrubTouch(e.changedTouches[i]);
        this.lastTouch_[touch.id] = touch;
      }
      break;

    case 'touchcancel':
    case 'touchend':
      // Throw away existing touches that we're finished with.
      for (i = 0; i < e.changedTouches.length; ++i) {
        delete this.lastTouch_[e.changedTouches[i].identifier];
      }
      break;

    case 'touchmove': {
      // Walk all of the touches in this one event and merge all of their
      // changes into one delta.  This lets multiple fingers scroll faster.
      let delta = 0;
      for (i = 0; i < e.changedTouches.length; ++i) {
        touch = scrubTouch(e.changedTouches[i]);
        delta += (this.lastTouch_[touch.id].y - touch.y);
        this.lastTouch_[touch.id] = touch;
      }

      // Invert to match the touchscreen scrolling direction of browser windows.
      delta *= -1;

      let top = this.screen_.scrollTop - delta;
      if (top < 0) {
        top = 0;
      }

      const scrollMax = this.getScrollMax_();
      if (top > scrollMax) {
        top = scrollMax;
      }

      if (top != this.screen_.scrollTop) {
        // Moving scrollTop causes a scroll event, which triggers the redraw.
        this.screen_.scrollTop = top;
      }
      break;
    }
  }

  // To disable gestures or anything else interfering with our scrolling.
  e.preventDefault();
};

/**
 * Clients can override this if they want to hear copy events.
 *
 * Clients may call event.preventDefault() if they want to keep the scrollport
 * from also handling the events.
 *
 * @param {!ClipboardEvent} e
 */
hterm.ScrollPort.prototype.onCopy = function(e) { };

/**
 * Handler for copy-to-clipboard events.
 *
 * If some or all of the selected rows are off screen we may need to fill in
 * the rows between selection start and selection end.  This handler determines
 * if we're missing some of the selected text, and if so populates one or both
 * of the "select bags" with the missing text.
 *
 * @param {!ClipboardEvent} e
 */
hterm.ScrollPort.prototype.onCopy_ = function(e) {
  this.onCopy(e);

  if (e.defaultPrevented) {
    return;
  }

  this.resetSelectBags_();
  this.selection.sync();

  if (this.selection.isCollapsed ||
      this.selection.endRow.rowIndex - this.selection.startRow.rowIndex < 2) {
    return;
  }

  const topRowIndex = this.getTopRowIndex();
  const bottomRowIndex = this.getBottomRowIndex(topRowIndex);

  if (this.selection.startRow.rowIndex < topRowIndex) {
    // Start of selection is above the top fold.
    let endBackfillIndex;

    if (this.selection.endRow.rowIndex < topRowIndex) {
      // Entire selection is above the top fold.
      endBackfillIndex = this.selection.endRow.rowIndex;
    } else {
      // Selection extends below the top fold.
      endBackfillIndex = this.topFold_.nextSibling.rowIndex;
    }

    this.topSelectBag_.textContent = this.rowProvider_.getRowsText(
        this.selection.startRow.rowIndex + 1, endBackfillIndex);
    this.rowNodes_.insertBefore(this.topSelectBag_,
                                this.selection.startRow.nextSibling);
    this.syncRowNodesDimensions_();
  }

  if (this.selection.endRow.rowIndex > bottomRowIndex) {
    // Selection ends below the bottom fold.
    let startBackfillIndex;

    if (this.selection.startRow.rowIndex > bottomRowIndex) {
      // Entire selection is below the bottom fold.
      startBackfillIndex = this.selection.startRow.rowIndex + 1;
    } else {
      // Selection starts above the bottom fold.
      startBackfillIndex = this.bottomFold_.previousSibling.rowIndex + 1;
    }

    this.bottomSelectBag_.textContent = this.rowProvider_.getRowsText(
        startBackfillIndex, this.selection.endRow.rowIndex);
    this.rowNodes_.insertBefore(this.bottomSelectBag_, this.selection.endRow);
  }
};

/**
 * Handle a paste event on the the ScrollPort's screen element.
 *
 * TODO: Handle ClipboardData.files transfers.  https://crbug.com/433581.
 *
 * @param {!ClipboardEvent} e
 */
hterm.ScrollPort.prototype.onPaste_ = function(e) {
  this.pasteTarget_.focus();

  setTimeout(() => {
    this.publish('paste', {text: this.pasteTarget_.value});
    this.pasteTarget_.value = '';
    this.focus();
  });
};

/**
 * Handles a textInput event on the paste target. Stops this from
 * propagating as we want this to be handled in the onPaste_ method.
 *
 * @param {!Event} e
 */
hterm.ScrollPort.prototype.handlePasteTargetTextInput_ = function(e) {
  e.stopPropagation();
};

/**
 * Handle a drop event on the the ScrollPort's screen element.
 *
 * By default we try to copy in the structured format (HTML/whatever).
 * The shift key can select plain text though.
 *
 * TODO: Handle DataTransfer.files transfers.  https://crbug.com/433581.
 *
 * @param {!DragEvent} e The drag event that fired us.
 */
hterm.ScrollPort.prototype.onDragAndDrop_ = function(e) {
  if (!this.pasteOnDrop) {
    return;
  }

  e.preventDefault();

  let data;
  let format;

  // If the shift key active, try to find a "rich" text source (but not plain
  // text).  e.g. text/html is OK.
  if (e.shiftKey) {
    e.dataTransfer.types.forEach((t) => {
      if (!format && t != 'text/plain' && t.startsWith('text/')) {
        format = t;
      }
    });

    // If we found a non-plain text source, try it out first.
    if (format) {
      data = e.dataTransfer.getData(format);
    }
  }

  // If we haven't loaded anything useful, fall back to plain text.
  if (!data) {
    data = e.dataTransfer.getData('text/plain');
  }

  if (data) {
    this.publish('paste', {text: data});
  }
};

/**
 * Set the vertical scrollbar mode of the ScrollPort.
 *
 * @param {boolean} state
 */
hterm.ScrollPort.prototype.setScrollbarVisible = function(state) {
  if (state) {
    this.screen_.style.overflowY = 'scroll';
    this.currentScrollbarWidthPx = hterm.ScrollPort.DEFAULT_SCROLLBAR_WIDTH;
    this.syncScrollbarWidth_();
  } else {
    this.screen_.style.overflowY = 'hidden';
    this.currentScrollbarWidthPx = 0;
  }
};

/**
 * Set scroll wheel multiplier. This alters how much the screen scrolls on
 * mouse wheel events.
 *
 * @param {number} multiplier
 */
hterm.ScrollPort.prototype.setScrollWheelMoveMultipler = function(multiplier) {
  this.scrollWheelMultiplier_ = multiplier;
};
// SOURCE FILE: hterm/js/hterm_terminal.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Constructor for the Terminal class.
 *
 * A Terminal pulls together the hterm.ScrollPort, hterm.Screen and hterm.VT100
 * classes to provide the complete terminal functionality.
 *
 * There are a number of lower-level Terminal methods that can be called
 * directly to manipulate the cursor, text, scroll region, and other terminal
 * attributes.  However, the primary method is interpret(), which parses VT
 * escape sequences and invokes the appropriate Terminal methods.
 *
 * This class was heavily influenced by Cory Maccarrone's Framebuffer class.
 *
 * TODO(rginda): Eventually we're going to need to support characters which are
 * displayed twice as wide as standard latin characters.  This is to support
 * CJK (and possibly other character sets).
 *
 * @param {{
 *   profileId: (?string|undefined),
 *   storage: (!lib.Storage|undefined),
 * }=} options Various settings to control behavior.
 *     profileId: The preference profile name.  Defaults to "default".
 *     storage: The backing storage for preferences.  Defaults to local.
 * @constructor
 * @implements {hterm.RowProvider}
 */
hterm.Terminal = function({profileId, storage} = {}) {
  // Set to true once terminal is initialized and onTerminalReady() is called.
  this.ready_ = false;

  this.profileId_ = null;
  this.storage_ = storage || new lib.Storage.Memory();

  /** @type {?hterm.PreferenceManager} */
  this.prefs_ = null;

  // Two screen instances.
  this.primaryScreen_ = new hterm.Screen();
  this.alternateScreen_ = new hterm.Screen();

  // The "current" screen.
  this.screen_ = this.primaryScreen_;

  // The local notion of the screen size.  ScreenBuffers also have a size which
  // indicates their present size.  During size changes, the two may disagree.
  // Also, the inactive screen's size is not altered until it is made the active
  // screen.
  this.screenSize = {width: 0, height: 0};

  // The scroll port we'll be using to display the visible rows.
  this.scrollPort_ = new hterm.ScrollPort(this);
  this.scrollPort_.subscribe('resize', this.onResize_.bind(this));
  this.scrollPort_.subscribe('scroll', this.onScroll_.bind(this));
  this.scrollPort_.subscribe('paste', this.onPaste_.bind(this));
  this.scrollPort_.subscribe('focus', this.onScrollportFocus_.bind(this));
  this.scrollPort_.subscribe('options', this.onOpenOptionsPage_.bind(this));
  this.scrollPort_.onCopy = this.onCopy_.bind(this);

  // The div that contains this terminal.
  this.div_ = null;

  // UI for showing info to the user in a privileged way.
  this.notifications_ = null;

  // The document that contains the scrollPort.  Defaulted to the global
  // document here so that the terminal is functional even if it hasn't been
  // inserted into a document yet, but re-set in decorate().
  this.document_ = window.document;

  // The rows that have scrolled off screen and are no longer addressable.
  this.scrollbackRows_ = [];

  // Saved tab stops.
  this.tabStops_ = [];

  // Keep track of whether default tab stops have been erased; after a TBC
  // clears all tab stops, defaults aren't restored on resize until a reset.
  this.defaultTabStops = true;

  // The VT's notion of the top and bottom rows.  Used during some VT
  // cursor positioning and scrolling commands.
  this.vtScrollTop_ = null;
  this.vtScrollBottom_ = null;

  // The DIV element for the visible cursor.
  this.cursorNode_ = null;

  // '_' shape is user preference.
  this.cursorShape_ = '_';

  // Cursor is hidden when scrolling up pushes it off the bottom of the screen.
  this.cursorOffScreen_ = false;

  // These prefs are cached so we don't have to read from local storage with
  // each output and keystroke.  They are initialized by the preference manager.
  /** @type {?string} */
  this.backgroundColor_ = null;
  /** @type {?string} */
  this.foregroundColor_ = null;

  /** @type {!Map<number, string>} */
  this.colorPaletteOverrides_ = new Map();

  this.screenBorderSize_ = 0;

  this.scrollOnOutput_ = null;
  this.scrollOnKeystroke_ = null;
  this.scrollWheelArrowKeys_ = null;

  // True if we should override mouse event reporting to allow local selection.
  this.defeatMouseReports_ = false;

  // Whether to auto hide the mouse cursor when typing.
  this.setAutomaticMouseHiding();
  // Timer to keep mouse visible while it's being used.
  this.mouseHideDelay_ = null;

  // The AccessibilityReader object for announcing command output.
  this.accessibilityReader_ = null;

  // The context menu object.
  this.contextMenu = new hterm.ContextMenu();

  this.bellNotificationList_ = [];

  // Whether we have permission to display notifications.
  this.desktopNotificationBell_ = false;

  // Cursor position and attributes saved with DECSC.
  this.savedOptions_ = {};

  // The current mode bits for the terminal.
  this.options_ = new hterm.Options();

  // Timeouts we might need to clear.
  this.timeouts_ = {};

  // The VT escape sequence interpreter.
  this.vt = new hterm.VT(this);

  this.saveCursorAndState(true);

  // The keyboard handler.
  this.keyboard = new hterm.Keyboard(this);

  // General IO interface that can be given to third parties without exposing
  // the entire terminal object.
  this.io = new hterm.Terminal.IO(this);

  // True if mouse-click-drag should scroll the terminal.
  this.enableMouseDragScroll = true;

  this.copyOnSelect = null;
  this.mouseRightClickPaste = null;
  this.mousePasteButton = null;

  // Whether to use the default window copy behavior.
  this.useDefaultWindowCopy = false;

  this.clearSelectionAfterCopy = true;

  this.realizeSize_(80, 24);
  this.setDefaultTabStops();

  // Whether we allow images to be shown.
  this.allowImagesInline = null;

  this.reportFocus = false;

  // TODO(crbug.com/1063219) Remove this once the bug is fixed.
  this.alwaysUseLegacyPasting = false;

  this.setProfile(profileId || hterm.Terminal.DEFAULT_PROFILE_ID,
                  function() { this.onTerminalReady(); }.bind(this));
};

/**
 * Default Profile ID.
 *
 * @const {string}
 */
hterm.Terminal.DEFAULT_PROFILE_ID = 'default';

/**
 * Possible cursor shapes.
 */
hterm.Terminal.cursorShape = {
  BLOCK: 'b',
  BEAM: '|',
  UNDERLINE: '_',
};

/**
 * Clients should override this to be notified when the terminal is ready
 * for use.
 *
 * The terminal initialization is asynchronous, and shouldn't be used before
 * this method is called.
 */
hterm.Terminal.prototype.onTerminalReady = function() { };

/**
 * Default tab with of 8 to match xterm.
 */
hterm.Terminal.prototype.tabWidth = 8;

/**
 * Select a preference profile.
 *
 * This will load the terminal preferences for the given profile name and
 * associate subsequent preference changes with the new preference profile.
 *
 * @param {string} profileId The name of the preference profile.  Forward slash
 *     characters will be removed from the name.
 * @param {function()=} callback Optional callback to invoke when the
 *     profile transition is complete.
 */
hterm.Terminal.prototype.setProfile = function(
    profileId, callback = undefined) {
  profileId = profileId.replace(/\//g, '');
  if (this.profileId_ === profileId) {
    if (callback) {
      callback();
    }
    return;
  }

  this.profileId_ = profileId;

  if (this.prefs_) {
    this.prefs_.setProfile(profileId, callback);
    return;
  }

  this.prefs_ = new hterm.PreferenceManager(this.storage_, this.profileId_);

  this.prefs_.addObservers(null, {
    'desktop-notification-bell': (v) => {
      if (v && Notification) {
        this.desktopNotificationBell_ = Notification.permission === 'granted';
        if (!this.desktopNotificationBell_) {
          // Note: We don't call Notification.requestPermission here because
          // Chrome requires the call be the result of a user action (such as an
          // onclick handler), and pref listeners are run asynchronously.
          //
          // A way of working around this would be to display a dialog in the
          // terminal with a "click-to-request-permission" button.
          console.warn('desktop-notification-bell is true but we do not have ' +
                       'permission to display notifications.');
        }
      } else {
        this.desktopNotificationBell_ = false;
      }
    },

    'background-color': (v) => {
      this.setBackgroundColor(v);
    },

    'background-image': (v) => {
      this.scrollPort_.setBackgroundImage(v);
    },

    'background-size': (v) => {
      this.scrollPort_.setBackgroundSize(v);
    },

    'background-position': (v) => {
      this.scrollPort_.setBackgroundPosition(v);
    },

    'character-map-overrides': (v) => {
      if (!(v == null || v instanceof Object)) {
        console.warn('Preference character-map-modifications is not an ' +
                     'object: ' + v);
        return;
      }

      this.vt.characterMaps.reset();
      this.vt.characterMaps.setOverrides(v);
    },

    'color-palette-overrides': (v) => {
      if (!(v == null || v instanceof Object || v instanceof Array)) {
        console.warn('Preference color-palette-overrides is not an array or ' +
                     'object: ' + v);
        return;
      }

      // Reset all existing colors first as the new palette override might not
      // have the same mappings.  If the old one set colors the new one doesn't,
      // those old mappings have to get cleared first.
      lib.colors.stockPalette.forEach((c, i) => this.setColorPalette(i, c));
      this.colorPaletteOverrides_.clear();

      if (v) {
        for (const key in v) {
          const i = parseInt(key, 10);
          if (isNaN(i) || i < 0 || i > 255) {
            console.log('Invalid value in palette: ' + key + ': ' + v[key]);
            continue;
          }

          if (v[i]) {
            const rgb = lib.colors.normalizeCSS(v[i]);
            if (rgb) {
              this.setColorPalette(i, rgb);
              this.colorPaletteOverrides_.set(i, rgb);
            }
          }
        }
      }

      this.primaryScreen_.textAttributes.colorPaletteOverrides = [];
      this.alternateScreen_.textAttributes.colorPaletteOverrides = [];
    },

    'copy-on-select': (v) => {
      this.copyOnSelect = !!v;
    },

    'use-default-window-copy': (v) => {
      this.useDefaultWindowCopy = !!v;
    },

    'clear-selection-after-copy': (v) => {
      this.clearSelectionAfterCopy = !!v;
    },

    'paste-on-drop': (v) => {
      this.scrollPort_.setPasteOnDrop(v);
    },

    'east-asian-ambiguous-as-two-column': (v) => {
      lib.wc.regardCjkAmbiguous = v;
    },

    'enable-8-bit-control': (v) => {
      this.vt.enable8BitControl = !!v;
    },

    'enable-bold-as-bright': (v) => {
      this.primaryScreen_.textAttributes.enableBoldAsBright = !!v;
      this.alternateScreen_.textAttributes.enableBoldAsBright = !!v;
    },

    'enable-clipboard-write': (v) => {
      this.vt.enableClipboardWrite = !!v;
    },

    'enable-dec12': (v) => {
      this.vt.enableDec12 = !!v;
    },

    'enable-csi-j-3': (v) => {
      this.vt.enableCsiJ3 = !!v;
    },

    'font-smoothing': (v) => {
    },

    'foreground-color': (v) => {
      this.setForegroundColor(v);
    },

    'hide-mouse-while-typing': (v) => {
      this.setAutomaticMouseHiding(v);
    },

    'mouse-right-click-paste': (v) => {
      this.mouseRightClickPaste = v;
    },

    'mouse-paste-button': (v) => {
      this.syncMousePasteButton();
    },

    'pass-alt-number': (v) => {
      if (v == null) {
        // Let Alt+1..9 pass to the browser (to control tab switching) on
        // non-OS X systems, or if hterm is not opened in an app window.
        v = (hterm.os !== 'mac' &&
             hterm.windowType !== 'popup' &&
             hterm.windowType !== 'app');
      }

      this.passAltNumber = v;
    },

    'pass-meta-number': (v) => {
      if (v == null) {
        // Let Meta+1..9 pass to the browser (to control tab switching) on
        // OS X systems, or if hterm is not opened in an app window.
        v = (hterm.os === 'mac' &&
             hterm.windowType !== 'popup' &&
             hterm.windowType !== 'app');
      }

      this.passMetaNumber = v;
    },

    'screen-padding-size': (v) => {
      v = parseInt(v, 10);
      if (isNaN(v) || v < 0) {
        console.error(`Invalid screen padding size: ${v}`);
        return;
      }
      this.setScreenPaddingSize(v);
    },

    'screen-border-size': (v) => {
      v = parseInt(v, 10);
      if (isNaN(v) || v < 0) {
        console.error(`Invalid screen border size: ${v}`);
        return;
      }
      this.setScreenBorderSize(v);
    },

    'screen-border-color': (v) => {
      this.div_.style.borderColor = v;
    },

    'scroll-on-keystroke': (v) => {
      this.scrollOnKeystroke_ = v;
    },

    'scroll-on-output': (v) => {
      this.scrollOnOutput_ = v;
    },

    'scrollbar-visible': (v) => {
      this.setScrollbarVisible(v);
    },

    'scroll-wheel-may-send-arrow-keys': (v) => {
      this.scrollWheelArrowKeys_ = v;
    },

    'scroll-wheel-move-multiplier': (v) => {
      this.setScrollWheelMoveMultipler(v);
    },

    'terminal-encoding': (v) => {
      this.vt.setEncoding(v);
    },

    'word-break-match-left': (v) => {
      this.primaryScreen_.wordBreakMatchLeft = v;
      this.alternateScreen_.wordBreakMatchLeft = v;
    },

    'word-break-match-right': (v) => {
      this.primaryScreen_.wordBreakMatchRight = v;
      this.alternateScreen_.wordBreakMatchRight = v;
    },

    'word-break-match-middle': (v) => {
      this.primaryScreen_.wordBreakMatchMiddle = v;
      this.alternateScreen_.wordBreakMatchMiddle = v;
    },

    'allow-images-inline': (v) => {
      this.allowImagesInline = v;
    },
  });

  this.prefs_.readStorage(function() {
    this.prefs_.notifyAll();

    if (callback) {
      this.ready_ = true;
      callback();
    }
  }.bind(this));
};

/**
 * Returns the preferences manager used for configuring this terminal.
 *
 * @return {!hterm.PreferenceManager}
 */
hterm.Terminal.prototype.getPrefs = function() {
  return lib.notNull(this.prefs_);
};

/**
 * Enable or disable bracketed paste mode.
 *
 * @param {boolean} state The value to set.
 */
hterm.Terminal.prototype.setBracketedPaste = function(state) {
  this.options_.bracketedPaste = state;
};

/**
 * Set the color for the cursor.
 *
 * If you want this setting to persist, set it through prefs_, rather than
 * with this method.
 *
 * @param {string=} color The color to set.  If not defined, we reset to the
 *     saved user preference.
 */
hterm.Terminal.prototype.setCursorColor = function(color) {
  this.setCssVar('cursor-color', color || 'hsl(100, 60%, 80%)');
};

/**
 * Enable or disable mouse based text selection in the terminal.
 *
 * @param {boolean} state The value to set.
 */
hterm.Terminal.prototype.setSelectionEnabled = function(state) {
  this.enableMouseDragScroll = state;
};

/**
 * Set the background image.
 *
 * If you want this setting to persist, set it through prefs_, rather than
 * with this method.
 *
 * @param {string=} cssUrl The image to set as a css url.  If not defined, we
 *     reset to the saved user preference.
 */
hterm.Terminal.prototype.setBackgroundImage = function(cssUrl) {
  if (cssUrl === undefined) {
    cssUrl = this.prefs_.getString('background-image');
  }
  this.scrollPort_.setBackgroundImage(cssUrl);
};

/**
 * Set the background color.
 *
 * If you want this setting to persist, set it through prefs_, rather than
 * with this method.
 *
 * @param {string=} color The color to set.  If not defined, we reset to the
 *     saved user preference.
 */
hterm.Terminal.prototype.setBackgroundColor = function(color) {
  if (color === undefined) {
    color = this.prefs_.getString('background-color');
  }

  this.backgroundColor_ = lib.colors.normalizeCSS(color);
  this.setRgbColorCssVar('background-color', this.backgroundColor_);
};

/**
 * Return the current terminal background color.
 *
 * Intended for use by other classes, so we don't have to expose the entire
 * prefs_ object.
 *
 * @return {?string}
 */
hterm.Terminal.prototype.getBackgroundColor = function() {
  return this.backgroundColor_;
};

/**
 * Set the foreground color.
 *
 * If you want this setting to persist, set it through prefs_, rather than
 * with this method.
 *
 * @param {string=} color The color to set.  If not defined, we reset to the
 *     saved user preference.
 */
hterm.Terminal.prototype.setForegroundColor = function(color) {
  if (color === undefined) {
    color = this.prefs_.getString('foreground-color');
  }

  this.foregroundColor_ = lib.colors.normalizeCSS(color);
  this.setRgbColorCssVar('foreground-color', this.foregroundColor_);
};

/**
 * Return the current terminal foreground color.
 *
 * Intended for use by other classes, so we don't have to expose the entire
 * prefs_ object.
 *
 * @return {?string}
 */
hterm.Terminal.prototype.getForegroundColor = function() {
  return this.foregroundColor_;
};

/**
 * Returns true if the current screen is the primary screen, false otherwise.
 *
 * @return {boolean}
 */
hterm.Terminal.prototype.isPrimaryScreen = function() {
  return this.screen_ == this.primaryScreen_;
};

/**
 * Set a CSS variable.
 *
 * Normally this is used to set variables in the hterm namespace.
 *
 * @param {string} name The variable to set.
 * @param {string|number} value The value to assign to the variable.
 * @param {string=} prefix The variable namespace/prefix to use.
 */
hterm.Terminal.prototype.setCssVar = function(name, value,
                                              prefix = '--hterm-') {
  this.document_.documentElement.style.setProperty(
      `${prefix}${name}`, value.toString());
};

/**
 * Sets --hterm-{name} to the cracked rgb components (no alpha) if the provided
 * input is valid.
 *
 * @param {string} name The variable to set.
 * @param {?string} rgb The rgb value to assign to the variable.
 */
hterm.Terminal.prototype.setRgbColorCssVar = function(name, rgb) {
  const ary = rgb ? lib.colors.crackRGB(rgb) : null;
  if (ary) {
    this.setCssVar(name, ary.slice(0, 3).join(','));
  }
};

/**
 * Sets the specified color for the active screen.
 *
 * @param {number} i The index into the 256 color palette to set.
 * @param {?string} rgb The rgb value to assign to the variable.
 */
hterm.Terminal.prototype.setColorPalette = function(i, rgb) {
  if (i >= 0 && i < 256 && rgb != null && rgb != this.getColorPalette[i]) {
    this.setRgbColorCssVar(`color-${i}`, rgb);
    this.screen_.textAttributes.colorPaletteOverrides[i] = rgb;
  }
};

/**
 * Returns the current value in the active screen of the specified color.
 *
 * @param {number} i Color palette index.
 * @return {string} rgb color.
 */
hterm.Terminal.prototype.getColorPalette = function(i) {
  return this.screen_.textAttributes.colorPaletteOverrides[i] ||
      this.colorPaletteOverrides_.get(i) ||
      lib.colors.stockPalette[i];
};

/**
 * Reset the specified color in the active screen to its default value.
 *
 * @param {number} i Color to reset
 */
hterm.Terminal.prototype.resetColor = function(i) {
  this.setColorPalette(
      i, this.colorPaletteOverrides_.get(i) || lib.colors.stockPalette[i]);
  delete this.screen_.textAttributes.colorPaletteOverrides[i];
};

/**
 * Reset the current screen color palette to the default state.
 */
hterm.Terminal.prototype.resetColorPalette = function() {
  this.screen_.textAttributes.colorPaletteOverrides.forEach(
      (c, i) => this.resetColor(i));
};

/**
 * Get a CSS variable.
 *
 * Normally this is used to get variables in the hterm namespace.
 *
 * @param {string} name The variable to read.
 * @param {string=} prefix The variable namespace/prefix to use.
 * @return {string} The current setting for this variable.
 */
hterm.Terminal.prototype.getCssVar = function(name, prefix = '--hterm-') {
  return this.document_.documentElement.style.getPropertyValue(
      `${prefix}${name}`);
};

/**
 * @return {!hterm.ScrollPort}
 */
hterm.Terminal.prototype.getScrollPort = function() {
  return this.scrollPort_;
};

/**
 * Update CSS character size variables to match the scrollport.
 */
hterm.Terminal.prototype.updateCssCharsize_ = function() {
  this.setCssVar('charsize-width', this.scrollPort_.characterSize.width + 'px');
  this.setCssVar('charsize-height',
                 this.scrollPort_.characterSize.height + 'px');
};

/**
 * Set the font size for this terminal.
 *
 * @param {number} px The desired font size, in pixels.
 */
hterm.Terminal.prototype.setFontSize = function(px) {
  this.scrollPort_.screen_.style.fontSize = px + 'px';
  this.setCssVar('font-size', `${px}px`);
};

/**
 * Get the current font size.
 *
 * @return {number}
 */
hterm.Terminal.prototype.getFontSize = function() {
  return this.scrollPort_.getFontSize();
};

/**
 * Get the current font family.
 *
 * @return {string}
 */
hterm.Terminal.prototype.getFontFamily = function() {
  return this.scrollPort_.getFontFamily();
};

/**
 * Set this.mousePasteButton based on the mouse-paste-button pref,
 * autodetecting if necessary.
 */
hterm.Terminal.prototype.syncMousePasteButton = function() {
  const button = this.prefs_.get('mouse-paste-button');
  if (typeof button == 'number') {
    this.mousePasteButton = button;
    return;
  }

  if (hterm.os != 'linux') {
    this.mousePasteButton = 1;  // Middle mouse button.
  } else {
    this.mousePasteButton = 2;  // Right mouse button.
  }
};

/**
 * Set the mouse cursor style based on the current terminal mode.
 */
hterm.Terminal.prototype.syncMouseStyle = function() {
  this.setCssVar('mouse-cursor-style',
                 this.vt.mouseReport == this.vt.MOUSE_REPORT_DISABLED ?
                     'var(--hterm-mouse-cursor-text)' :
                     'var(--hterm-mouse-cursor-default)');
};

/**
 * Return a copy of the current cursor position.
 *
 * @return {!hterm.RowCol} The RowCol object representing the current position.
 */
hterm.Terminal.prototype.saveCursor = function() {
  return this.screen_.cursorPosition.clone();
};

/**
 * Return the current text attributes.
 *
 * @return {!hterm.TextAttributes}
 */
hterm.Terminal.prototype.getTextAttributes = function() {
  return this.screen_.textAttributes;
};

/**
 * Set the text attributes.
 *
 * @param {!hterm.TextAttributes} textAttributes The attributes to set.
 */
hterm.Terminal.prototype.setTextAttributes = function(textAttributes) {
  this.screen_.textAttributes = textAttributes;
};

/**
 * Change the title of this terminal's window.
 *
 * @param {string} title The title to set.
 */
hterm.Terminal.prototype.setWindowTitle = function(title) {
  window.document.title = title;
};

/**
 * Change the name of the terminal. This is used by tmux, and it is different
 * from the window title. See the "NAMES AND TITLES" section in `man tmux`.
 *
 * @param {string} name The name to set.
 */
hterm.Terminal.prototype.setWindowName = function(name) {};

/**
 * Restore a previously saved cursor position.
 *
 * @param {!hterm.RowCol} cursor The position to restore.
 */
hterm.Terminal.prototype.restoreCursor = function(cursor) {
  const row = lib.f.clamp(cursor.row, 0, this.screenSize.height - 1);
  const column = lib.f.clamp(cursor.column, 0, this.screenSize.width - 1);
  this.screen_.setCursorPosition(row, column);
  if (cursor.column > column ||
      cursor.column == column && cursor.overflow) {
    this.screen_.cursorPosition.overflow = true;
  }
};

/**
 * Clear the cursor's overflow flag.
 */
hterm.Terminal.prototype.clearCursorOverflow = function() {
  this.screen_.cursorPosition.overflow = false;
};

/**
 * Save the current cursor state to the corresponding screens.
 *
 * See the hterm.Screen.CursorState class for more details.
 *
 * @param {boolean=} both If true, update both screens, else only update the
 *     current screen.
 */
hterm.Terminal.prototype.saveCursorAndState = function(both) {
  if (both) {
    this.primaryScreen_.saveCursorAndState(this.vt);
    this.alternateScreen_.saveCursorAndState(this.vt);
  } else {
    this.screen_.saveCursorAndState(this.vt);
  }
};

/**
 * Restore the saved cursor state in the corresponding screens.
 *
 * See the hterm.Screen.CursorState class for more details.
 *
 * @param {boolean=} both If true, update both screens, else only update the
 *     current screen.
 */
hterm.Terminal.prototype.restoreCursorAndState = function(both) {
  if (both) {
    this.primaryScreen_.restoreCursorAndState(this.vt);
    this.alternateScreen_.restoreCursorAndState(this.vt);
  } else {
    this.screen_.restoreCursorAndState(this.vt);
  }
};

hterm.Terminal.prototype.setCursorShape = function(shape) {
  this.cursorShape_ = shape;
  this.restyleCursor_();
};

/**
 * Get the cursor shape
 *
 * @return {string}
 */
hterm.Terminal.prototype.getCursorShape = function() {
  return this.cursorShape_;
};

/**
 * Set the screen padding size in pixels.
 *
 * @param {number} size
 */
hterm.Terminal.prototype.setScreenPaddingSize = function(size) {
  this.setCssVar('screen-padding-size', `${size}px`);
  this.scrollPort_.setScreenPaddingSize(size);
};

/**
 * Set the screen border size in pixels.
 *
 * @param {number} size
 */
hterm.Terminal.prototype.setScreenBorderSize = function(size) {
  this.div_.style.borderWidth = `${size}px`;
  this.screenBorderSize_ = size;
  this.scrollPort_.resize();
};

/**
 * Set the width of the terminal, resizing the UI to match.
 *
 * @param {?number} columnCount
 */
hterm.Terminal.prototype.setWidth = function(columnCount) {
  if (columnCount == null) {
    this.div_.style.width = '100%';
    return;
  }

  const rightPadding = Math.max(
      this.scrollPort_.screenPaddingSize,
      this.scrollPort_.currentScrollbarWidthPx);
  this.div_.style.width = Math.ceil(
      (this.scrollPort_.characterSize.width * columnCount) +
      this.scrollPort_.screenPaddingSize + rightPadding +
      (2 * this.screenBorderSize_)) + 'px';
  this.realizeSize_(columnCount, this.screenSize.height);
  this.scheduleSyncCursorPosition_();
};

/**
 * Set the height of the terminal, resizing the UI to match.
 *
 * @param {?number} rowCount The height in rows.
 */
hterm.Terminal.prototype.setHeight = function(rowCount) {
  if (rowCount == null) {
    this.div_.style.height = '100%';
    return;
  }

  this.div_.style.height = (this.scrollPort_.characterSize.height * rowCount) +
                           (2 * this.scrollPort_.screenPaddingSize) +
                           (2 * this.screenBorderSize_) + 'px';
  this.realizeSize_(this.screenSize.width, rowCount);
  this.scheduleSyncCursorPosition_();
};

/**
 * Deal with terminal size changes.
 *
 * @param {number} columnCount The number of columns.
 * @param {number} rowCount The number of rows.
 */
hterm.Terminal.prototype.realizeSize_ = function(columnCount, rowCount) {
  let notify = false;

  if (columnCount != this.screenSize.width) {
    notify = true;
    this.realizeWidth_(columnCount);
  }

  if (rowCount != this.screenSize.height) {
    notify = true;
    this.realizeHeight_(rowCount);
  }

  // Send new terminal size to plugin.
  if (notify) {
    this.io.onTerminalResize_(columnCount, rowCount);
  }
};

/**
 * Deal with terminal width changes.
 *
 * This function does what needs to be done when the terminal width changes
 * out from under us.  It happens here rather than in onResize_() because this
 * code may need to run synchronously to handle programmatic changes of
 * terminal width.
 *
 * Relying on the browser to send us an async resize event means we may not be
 * in the correct state yet when the next escape sequence hits.
 *
 * @param {number} columnCount The number of columns.
 */
hterm.Terminal.prototype.realizeWidth_ = function(columnCount) {
  if (columnCount <= 0) {
    throw new Error('Attempt to realize bad width: ' + columnCount);
  }

  const deltaColumns = columnCount - this.screen_.getWidth();
  if (deltaColumns == 0) {
    // No change, so don't bother recalculating things.
    return;
  }

  this.screenSize.width = columnCount;
  this.screen_.setColumnCount(columnCount);

  if (deltaColumns > 0) {
    if (this.defaultTabStops) {
      this.setDefaultTabStops(this.screenSize.width - deltaColumns);
    }
  } else {
    for (let i = this.tabStops_.length - 1; i >= 0; i--) {
      if (this.tabStops_[i] < columnCount) {
        break;
      }

      this.tabStops_.pop();
    }
  }

  this.screen_.setColumnCount(this.screenSize.width);
};

/**
 * Deal with terminal height changes.
 *
 * This function does what needs to be done when the terminal height changes
 * out from under us.  It happens here rather than in onResize_() because this
 * code may need to run synchronously to handle programmatic changes of
 * terminal height.
 *
 * Relying on the browser to send us an async resize event means we may not be
 * in the correct state yet when the next escape sequence hits.
 *
 * @param {number} rowCount The number of rows.
 */
hterm.Terminal.prototype.realizeHeight_ = function(rowCount) {
  if (rowCount <= 0) {
    throw new Error('Attempt to realize bad height: ' + rowCount);
  }

  let deltaRows = rowCount - this.screen_.getHeight();
  if (deltaRows == 0) {
    // No change, so don't bother recalculating things.
    return;
  }

  this.screenSize.height = rowCount;

  const cursor = this.saveCursor();

  if (deltaRows < 0) {
    // Screen got smaller.
    deltaRows *= -1;
    while (deltaRows) {
      const lastRow = this.getRowCount() - 1;
      if (lastRow - this.scrollbackRows_.length == cursor.row) {
        break;
      }

      if (this.getRowText(lastRow)) {
        break;
      }

      this.screen_.popRow();
      deltaRows--;
    }

    const ary = this.screen_.shiftRows(deltaRows);
    this.scrollbackRows_.push.apply(this.scrollbackRows_, ary);

    // We just removed rows from the top of the screen, we need to update
    // the cursor to match.
    cursor.row = Math.max(cursor.row - deltaRows, 0);
  } else if (deltaRows > 0) {
    // Screen got larger.

    if (deltaRows <= this.scrollbackRows_.length) {
      const scrollbackCount = Math.min(deltaRows, this.scrollbackRows_.length);
      const rows = this.scrollbackRows_.splice(
          this.scrollbackRows_.length - scrollbackCount, scrollbackCount);
      this.screen_.unshiftRows(rows);
      deltaRows -= scrollbackCount;
      cursor.row += scrollbackCount;
    }

    if (deltaRows) {
      this.appendRows_(deltaRows);
    }
  }

  this.setVTScrollRegion(null, null);
  this.restoreCursor(cursor);
};

/**
 * Scroll the terminal to the top of the scrollback buffer.
 */
hterm.Terminal.prototype.scrollHome = function() {
  this.scrollPort_.scrollRowToTop(0);
};

/**
 * Scroll the terminal to the end.
 */
hterm.Terminal.prototype.scrollEnd = function() {
  this.scrollPort_.scrollRowToBottom(this.getRowCount());
};

/**
 * Scroll the terminal one page up (minus one line) relative to the current
 * position.
 */
hterm.Terminal.prototype.scrollPageUp = function() {
  this.scrollPort_.scrollPageUp();
};

/**
 * Scroll the terminal one page down (minus one line) relative to the current
 * position.
 */
hterm.Terminal.prototype.scrollPageDown = function() {
  this.scrollPort_.scrollPageDown();
};

/**
 * Scroll the terminal one line up relative to the current position.
 */
hterm.Terminal.prototype.scrollLineUp = function() {
  const i = this.scrollPort_.getTopRowIndex();
  this.scrollPort_.scrollRowToTop(i - 1);
};

/**
 * Scroll the terminal one line down relative to the current position.
 */
hterm.Terminal.prototype.scrollLineDown = function() {
  const i = this.scrollPort_.getTopRowIndex();
  this.scrollPort_.scrollRowToTop(i + 1);
};

/**
 * Clear primary screen, secondary screen, and the scrollback buffer.
 */
hterm.Terminal.prototype.wipeContents = function() {
  this.clearHome(this.primaryScreen_);
  this.clearHome(this.alternateScreen_);

  this.clearScrollback();
};

/**
 * Clear scrollback buffer.
 */
hterm.Terminal.prototype.clearScrollback = function() {
  // Move to the end of the buffer in case the screen was scrolled back.
  // We're going to throw it away which would leave the display invalid.
  this.scrollEnd();

  this.scrollbackRows_.length = 0;
  this.scrollPort_.resetCache();

  [this.primaryScreen_, this.alternateScreen_].forEach((screen) => {
    const bottom = screen.getHeight();
    this.renumberRows_(0, bottom, screen);
  });

  this.syncCursorPosition_();
  this.scrollPort_.invalidate();
};

/**
 * Full terminal reset.
 *
 * Perform a full reset to the default values listed in
 * https://vt100.net/docs/vt510-rm/RIS.html
 */
hterm.Terminal.prototype.reset = function() {
  this.vt.reset();

  this.clearAllTabStops();
  this.setDefaultTabStops();

  this.resetColorPalette();
  const resetScreen = (screen) => {
    // We want to make sure to reset the attributes before we clear the screen.
    // The attributes might be used to initialize default/empty rows.
    screen.textAttributes.reset();
    screen.textAttributes.colorPaletteOverrides = [];
    this.clearHome(screen);
    screen.saveCursorAndState(this.vt);
  };
  resetScreen(this.primaryScreen_);
  resetScreen(this.alternateScreen_);

  // Reset terminal options to their default values.
  this.options_ = new hterm.Options();
  this.setCursorBlink('u');

  this.setVTScrollRegion(null, null);

  this.setCursorVisible(true);
};

/**
 * Soft terminal reset.
 *
 * Perform a soft reset to the default values listed in
 * http://www.vt100.net/docs/vt510-rm/DECSTR#T5-9
 */
hterm.Terminal.prototype.softReset = function() {
  this.vt.reset();

  // Reset terminal options to their default values.
  this.options_ = new hterm.Options();

  // We show the cursor on soft reset but do not alter the blink state.
  this.options_.cursorBlink = !!this.timeouts_.cursorBlink;

  this.resetColorPalette();
  const resetScreen = (screen) => {
    // Xterm also resets the color palette on soft reset, even though it doesn't
    // seem to be documented anywhere.
    screen.textAttributes.reset();
    screen.textAttributes.colorPaletteOverrides = [];
    screen.saveCursorAndState(this.vt);
  };
  resetScreen(this.primaryScreen_);
  resetScreen(this.alternateScreen_);

  // The xterm man page explicitly says this will happen on soft reset.
  this.setVTScrollRegion(null, null);

  // Xterm also shows the cursor on soft reset, but does not alter the blink
  // state.
  this.setCursorVisible(true);
};

/**
 * Move the cursor forward to the next tab stop, or to the last column
 * if no more tab stops are set.
 */
hterm.Terminal.prototype.forwardTabStop = function() {
  const column = this.screen_.cursorPosition.column;

  for (let i = 0; i < this.tabStops_.length; i++) {
    if (this.tabStops_[i] > column) {
      this.setCursorColumn(this.tabStops_[i]);
      return;
    }
  }

  // xterm does not clear the overflow flag on HT or CHT.
  const overflow = this.screen_.cursorPosition.overflow;
  this.setCursorColumn(this.screenSize.width - 1);
  this.screen_.cursorPosition.overflow = overflow;
};

/**
 * Move the cursor backward to the previous tab stop, or to the first column
 * if no previous tab stops are set.
 */
hterm.Terminal.prototype.backwardTabStop = function() {
  const column = this.screen_.cursorPosition.column;

  for (let i = this.tabStops_.length - 1; i >= 0; i--) {
    if (this.tabStops_[i] < column) {
      this.setCursorColumn(this.tabStops_[i]);
      return;
    }
  }

  this.setCursorColumn(1);
};

/**
 * Set a tab stop at the given column.
 *
 * @param {number} column Zero based column.
 */
hterm.Terminal.prototype.setTabStop = function(column) {
  for (let i = this.tabStops_.length - 1; i >= 0; i--) {
    if (this.tabStops_[i] == column) {
      return;
    }

    if (this.tabStops_[i] < column) {
      this.tabStops_.splice(i + 1, 0, column);
      return;
    }
  }

  this.tabStops_.splice(0, 0, column);
};

/**
 * Clear the tab stop at the current cursor position.
 *
 * No effect if there is no tab stop at the current cursor position.
 */
hterm.Terminal.prototype.clearTabStopAtCursor = function() {
  const column = this.screen_.cursorPosition.column;

  const i = this.tabStops_.indexOf(column);
  if (i == -1) {
    return;
  }

  this.tabStops_.splice(i, 1);
};

/**
 * Clear all tab stops.
 */
hterm.Terminal.prototype.clearAllTabStops = function() {
  this.tabStops_.length = 0;
  this.defaultTabStops = false;
};

/**
 * Set up the default tab stops, starting from a given column.
 *
 * This sets a tabstop every (column % this.tabWidth) column, starting
 * from the specified column, or 0 if no column is provided.  It also flags
 * future resizes to set them up.
 *
 * This does not clear the existing tab stops first, use clearAllTabStops
 * for that.
 *
 * @param {number=} start Optional starting zero based starting column,
 *     useful for filling out missing tab stops when the terminal is resized.
 */
hterm.Terminal.prototype.setDefaultTabStops = function(start = 0) {
  const w = this.tabWidth;
  // Round start up to a default tab stop.
  start = start - 1 - ((start - 1) % w) + w;
  for (let i = start; i < this.screenSize.width; i += w) {
    this.setTabStop(i);
  }

  this.defaultTabStops = true;
};

/**
 * Interpret a sequence of characters.
 *
 * Incomplete escape sequences are buffered until the next call.
 *
 * @param {string} str Sequence of characters to interpret or pass through.
 */
hterm.Terminal.prototype.interpret = function(str) {
  this.scheduleSyncCursorPosition_();
  this.vt.interpret(str);
};

/**
 * Take over the given DIV for use as the terminal display.
 *
 * @param {!Element} div The div to use as the terminal display.
 */
hterm.Terminal.prototype.decorate = function(div) {
  const charset = div.ownerDocument.characterSet.toLowerCase();
  if (charset != 'utf-8') {
    console.warn(`Document encoding should be set to utf-8, not "${charset}";` +
                 ` Add <meta charset='utf-8'/> to your HTML <head> to fix.`);
  }

  this.div_ = div;
  this.div_.style.borderStyle = 'solid';
  this.div_.style.borderWidth = 0;
  this.div_.style.boxSizing = 'border-box';

  this.accessibilityReader_ = new hterm.AccessibilityReader(div);

  this.scrollPort_.decorate(div, () => this.setupScrollPort_());
};

/**
 * Initialisation of ScrollPort properties which need to be set after its DOM
 * has been initialised.
 *
 * @private
 */
hterm.Terminal.prototype.setupScrollPort_ = function() {
  this.scrollPort_.setBackgroundImage(
      this.prefs_.getString('background-image'));
  this.scrollPort_.setBackgroundSize(this.prefs_.getString('background-size'));
  this.scrollPort_.setBackgroundPosition(
      this.prefs_.getString('background-position'));
  this.scrollPort_.setAccessibilityReader(
      lib.notNull(this.accessibilityReader_));

  this.div_.focus = this.focus.bind(this);

  this.setScrollbarVisible(this.prefs_.getBoolean('scrollbar-visible'));
  this.setScrollWheelMoveMultipler(
      this.prefs_.getNumber('scroll-wheel-move-multiplier'));

  this.document_ = this.scrollPort_.getDocument();
  this.accessibilityReader_.decorate(this.document_);
  this.notifications_ = new hterm.NotificationCenter(
      lib.notNull(this.document_.body), this.accessibilityReader_);

  this.document_.body.oncontextmenu = function() { return false; };
  this.contextMenu.setDocument(this.document_);

  const onMouse = this.onMouse_.bind(this);
  const screenNode = this.scrollPort_.getScreenNode();
  screenNode.addEventListener(
      'mousedown', /** @type {!EventListener} */ (onMouse));
  screenNode.addEventListener(
      'mouseup', /** @type {!EventListener} */ (onMouse));
  screenNode.addEventListener(
      'mousemove', /** @type {!EventListener} */ (onMouse));
  this.scrollPort_.onScrollWheel = onMouse;

  screenNode.addEventListener(
      'keydown',
      /** @type {!EventListener} */ (this.onKeyboardActivity_.bind(this)));

  screenNode.addEventListener(
      'focus', this.onFocusChange_.bind(this, true));
  // Listen for mousedown events on the screenNode as in FF the focus
  // events don't bubble.
  screenNode.addEventListener('mousedown', function() {
    setTimeout(this.onFocusChange_.bind(this, true));
  }.bind(this));

  screenNode.addEventListener(
      'blur', this.onFocusChange_.bind(this, false));

  const style = this.document_.createElement('style');
  style.textContent = `
.cursor-node[focus="false"] {
  background-color: transparent !important;
  border-color: var(--hterm-cursor-color);
  border-width: 2px;
  border-style: solid;
}
@keyframes cursor-blink {
  0%	{ opacity: calc(var(--hterm-curs-opac-factor)); }
  100%	{ opacity: calc(var(--hterm-curs-opac-factor) * 0.1); }
}
menu {
  background: #fff;
  border-radius: 4px;
  color: #202124;
  cursor: var(--hterm-mouse-cursor-pointer);
  display: none;
  filter: drop-shadow(0 1px 3px #3C40434D) drop-shadow(0 4px 8px #3C404326);
  margin: 0;
  padding: 8px 0;
  position: absolute;
  transition-duration: 200ms;
}
menuitem {
  display: block;
  font: var(--hterm-font-size) 'Roboto', 'Noto Sans', sans-serif;
  padding: 0.5em 1em;
  white-space: nowrap;
}
menuitem.separator {
  border-bottom: none;
  height: 0.5em;
  padding: 0;
}
menuitem:hover {
  background-color: #e2e4e6;
}
.wc-node {
  display: inline-block;
  text-align: center;
  width: calc(var(--hterm-charsize-width) * 2);
  line-height: var(--hterm-charsize-height);
}
:root {
  --hterm-charsize-width: ${this.scrollPort_.characterSize.width}px;
  --hterm-charsize-height: ${this.scrollPort_.characterSize.height}px;
  --hterm-blink-node-duration: 0.7s;
  --hterm-mouse-cursor-default: default;
  --hterm-mouse-cursor-text: text;
  --hterm-mouse-cursor-pointer: pointer;
  --hterm-mouse-cursor-style: var(--hterm-mouse-cursor-text);
  --hterm-screen-padding-size: 0;
  --hterm-curs-left: calc(
	var(--hterm-screen-padding-size)
	+ var(--hterm-charsize-width) * var(--hterm-cursor-offset-col)
  );
  --hterm-curs-top: calc(
	var(--hterm-screen-padding-size)
	+ var(--hterm-charsize-height) * var(--hterm-cursor-offset-row)
  );
  --hterm-curs-opac-factor: 1.0;

${lib.colors.stockPalette.map((c, i) => `
  --hterm-color-${i}: ${lib.colors.crackRGB(c).slice(0, 3).join(',')};
`).join('')}
}
.uri-node:hover {
  text-decoration: underline;
  cursor: var(--hterm-mouse-cursor-pointer);
}
@keyframes blink {
  from { opacity: 1.0; }
  to { opacity: 0.0; }
}
.blink-node {
  animation-name: blink;
  animation-duration: var(--hterm-blink-node-duration);
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  animation-direction: alternate;
}`;
  // Insert this stock style as the first node so that any user styles will
  // override w/out having to use !important everywhere.  The rules above mix
  // runtime variables with default ones designed to be overridden by the user,
  // but we can wait for a concrete case from the users to determine the best
  // way to split the sheet up to before & after the user-css settings.
  this.document_.head.insertBefore(style, this.document_.head.firstChild);

  this.cursorNode_ = this.document_.createElement('div');
  this.cursorNode_.id = 'hterm:terminal-cursor';
  this.cursorNode_.className = 'cursor-node';
  this.cursorNode_.style.cssText = `
animation-duration: 0.8s;
animation-name: cursor-blink;
animation-iteration-count: infinite;
animation-timing-function: cubic-bezier(1,-0.18,0,1);

box-sizing: border-box;
position: absolute;
left: var(--hterm-curs-left);
top: var(--hterm-curs-top);
width: var(--hterm-charsize-width);
height: var(--hterm-charsize-height);
opacity: var(--hterm-curs-opac-factor);
`;

  this.setCursorColor();
  this.setCursorBlink('u');
  this.restyleCursor_();

  this.document_.body.appendChild(this.cursorNode_);

  // When 'enableMouseDragScroll' is off we reposition this element directly
  // under the mouse cursor after a click.  This makes Chrome associate
  // subsequent mousemove events with the scroll-blocker.  Since the
  // scroll-blocker is a peer (not a child) of the scrollport, the mousemove
  // events do not cause the scrollport to scroll.
  //
  // It's a hack, but it's the cleanest way I could find.
  this.scrollBlockerNode_ = this.document_.createElement('div');
  this.scrollBlockerNode_.id = 'hterm:mouse-drag-scroll-blocker';
  this.scrollBlockerNode_.setAttribute('aria-hidden', 'true');
  this.scrollBlockerNode_.style.cssText =
      ('position: absolute;' +
       'top: -99px;' +
       'display: block;' +
       'width: 10px;' +
       'height: 10px;');
  this.document_.body.appendChild(this.scrollBlockerNode_);

  this.scrollPort_.onScrollWheel = onMouse;
  ['mousedown', 'mouseup', 'mousemove', 'click', 'dblclick',
   ].forEach(function(event) {
       this.scrollBlockerNode_.addEventListener(event, onMouse);
       this.cursorNode_.addEventListener(
           event, /** @type {!EventListener} */ (onMouse));
       this.document_.addEventListener(
           event, /** @type {!EventListener} */ (onMouse));
     }.bind(this));

  this.cursorNode_.addEventListener('mousedown', function() {
      setTimeout(this.focus.bind(this));
    }.bind(this));

  this.setReverseVideo(false);

  this.scrollPort_.focus();
  this.scrollPort_.scheduleRedraw();
};

/**
 * Return the HTML document that contains the terminal DOM nodes.
 *
 * @return {!Document}
 */
hterm.Terminal.prototype.getDocument = function() {
  return this.document_;
};

/**
 * Focus the terminal.
 */
hterm.Terminal.prototype.focus = function() {
  this.scrollPort_.focus();
};

/**
 * Unfocus the terminal.
 */
hterm.Terminal.prototype.blur = function() {
  this.scrollPort_.blur();
};

/**
 * Return the HTML Element for a given row index.
 *
 * This is a method from the RowProvider interface.  The ScrollPort uses
 * it to fetch rows on demand as they are scrolled into view.
 *
 * TODO(rginda): Consider saving scrollback rows as (HTML source, text content)
 * pairs to conserve memory.
 *
 * @param {number} index The zero-based row index, measured relative to the
 *     start of the scrollback buffer.  On-screen rows will always have the
 *     largest indices.
 * @return {!Element} The 'x-row' element containing for the requested row.
 * @override
 */
hterm.Terminal.prototype.getRowNode = function(index) {
  if (index < this.scrollbackRows_.length) {
    return this.scrollbackRows_[index];
  }

  const screenIndex = index - this.scrollbackRows_.length;
  return this.screen_.rowsArray[screenIndex];
};

/**
 * Return the text content for a given range of rows.
 *
 * This is a method from the RowProvider interface.  The ScrollPort uses
 * it to fetch text content on demand when the user attempts to copy their
 * selection to the clipboard.
 *
 * @param {number} start The zero-based row index to start from, measured
 *     relative to the start of the scrollback buffer.  On-screen rows will
 *     always have the largest indices.
 * @param {number} end The zero-based row index to end on, measured
 *     relative to the start of the scrollback buffer.
 * @return {string} A single string containing the text value of the range of
 *     rows.  Lines will be newline delimited, with no trailing newline.
 */
hterm.Terminal.prototype.getRowsText = function(start, end) {
  const ary = [];
  for (let i = start; i < end; i++) {
    const node = this.getRowNode(i);
    ary.push(node.textContent);
    if (i < end - 1 && !node.getAttribute('line-overflow')) {
      ary.push('\n');
    }
  }

  return ary.join('');
};

/**
 * Return the text content for a given row.
 *
 * This is a method from the RowProvider interface.  The ScrollPort uses
 * it to fetch text content on demand when the user attempts to copy their
 * selection to the clipboard.
 *
 * @param {number} index The zero-based row index to return, measured
 *     relative to the start of the scrollback buffer.  On-screen rows will
 *     always have the largest indices.
 * @return {string} A string containing the text value of the selected row.
 */
hterm.Terminal.prototype.getRowText = function(index) {
  const node = this.getRowNode(index);
  return node.textContent;
};

/**
 * Return the total number of rows in the addressable screen and in the
 * scrollback buffer of this terminal.
 *
 * This is a method from the RowProvider interface.  The ScrollPort uses
 * it to compute the size of the scrollbar.
 *
 * @return {number} The number of rows in this terminal.
 * @override
 */
hterm.Terminal.prototype.getRowCount = function() {
  return this.scrollbackRows_.length + this.screen_.rowsArray.length;
};

/**
 * Create DOM nodes for new rows and append them to the end of the terminal.
 *
 * The new row is appended to the bottom of the list of rows, and does not
 * require renumbering (of the rowIndex property) of previous rows.
 *
 * If you think you want a new blank row somewhere in the middle of the
 * terminal, look into insertRow_() or moveRows_().
 *
 * This method does not pay attention to vtScrollTop/Bottom, since you should
 * be using insertRow_() or moveRows_() in cases where they would matter.
 *
 * The cursor will be positioned at column 0 of the first inserted line.
 *
 * @param {number} count The number of rows to created.
 */
hterm.Terminal.prototype.appendRows_ = function(count) {
  let cursorRow = this.screen_.rowsArray.length;
  const offset = this.scrollbackRows_.length + cursorRow;
  for (let i = 0; i < count; i++) {
    const row = this.document_.createElement('x-row');
    row.appendChild(this.document_.createTextNode(''));
    row.rowIndex = offset + i;
    this.screen_.pushRow(row);
  }

  const extraRows = this.screen_.rowsArray.length - this.screenSize.height;
  if (extraRows > 0) {
    const ary = this.screen_.shiftRows(extraRows);
    Array.prototype.push.apply(this.scrollbackRows_, ary);
    if (this.scrollPort_.isScrolledEnd) {
      this.scheduleScrollDown_();
    }
  }

  if (cursorRow >= this.screen_.rowsArray.length) {
    cursorRow = this.screen_.rowsArray.length - 1;
  }

  this.setAbsoluteCursorPosition(cursorRow, 0);
};

/**
 * Create a DOM node for a new row and insert it at the current position.
 *
 * The new row is inserted at the current cursor position, the existing top row
 * is moved to scrollback, and lines below are renumbered.
 *
 * The cursor will be positioned at column 0.
 */
hterm.Terminal.prototype.insertRow_ = function() {
  const row = this.document_.createElement('x-row');
  row.appendChild(this.document_.createTextNode(''));

  this.scrollbackRows_.push(this.screen_.shiftRow());

  const cursorRow = this.screen_.cursorPosition.row;
  this.screen_.insertRow(cursorRow, row);

  this.renumberRows_(cursorRow, this.screen_.rowsArray.length);

  this.setAbsoluteCursorPosition(cursorRow, 0);
  if (this.scrollPort_.isScrolledEnd) {
    this.scheduleScrollDown_();
  }
};

/**
 * Relocate rows from one part of the addressable screen to another.
 *
 * This is used to recycle rows during VT scrolls where a top region is set
 * (those which are driven by VT commands, rather than by the user manipulating
 * the scrollbar.)
 *
 * In this case, the blank lines scrolled into the scroll region are made of
 * the nodes we scrolled off.  These have their rowIndex properties carefully
 * renumbered so as not to confuse the ScrollPort.
 *
 * @param {number} fromIndex The start index.
 * @param {number} count The number of rows to move.
 * @param {number} toIndex The destination index.
 */
hterm.Terminal.prototype.moveRows_ = function(fromIndex, count, toIndex) {
  const ary = this.screen_.removeRows(fromIndex, count);
  this.screen_.insertRows(toIndex, ary);

  let start, end;
  if (fromIndex < toIndex) {
    start = fromIndex;
    end = toIndex + count;
  } else {
    start = toIndex;
    end = fromIndex + count;
  }

  this.renumberRows_(start, end);
  this.scrollPort_.scheduleInvalidate();
};

/**
 * Renumber the rowIndex property of the given range of rows.
 *
 * The start and end indices are relative to the screen, not the scrollback.
 * Rows in the scrollback buffer cannot be renumbered.  Since they are not
 * addressable (you can't delete them, scroll them, etc), you should have
 * no need to renumber scrollback rows.
 *
 * @param {number} start The start index.
 * @param {number} end The end index.
 * @param {!hterm.Screen=} screen The screen to renumber.
 */
hterm.Terminal.prototype.renumberRows_ = function(
    start, end, screen = undefined) {
  if (!screen) {
    screen = this.screen_;
  }

  const offset = this.scrollbackRows_.length;
  for (let i = start; i < end; i++) {
    screen.rowsArray[i].rowIndex = offset + i;
  }
};

/**
 * Print a string to the terminal.
 *
 * This respects the current insert and wraparound modes.  It will add new lines
 * to the end of the terminal, scrolling off the top into the scrollback buffer
 * if necessary.
 *
 * The string is *not* parsed for escape codes.  Use the interpret() method if
 * that's what you're after.
 *
 * @param {string} str The string to print.
 */
hterm.Terminal.prototype.print = function(str) {
  this.scheduleSyncCursorPosition_();

  // Basic accessibility output for the screen reader.
  this.accessibilityReader_.announce(str);

  let startOffset = 0;

  let strWidth = lib.wc.strWidth(str);
  // Fun edge case: If the string only contains zero width codepoints (like
  // combining characters), we make sure to iterate at least once below.
  if (strWidth == 0 && str) {
    strWidth = 1;
  }

  while (startOffset < strWidth) {
    if (this.options_.wraparound && this.screen_.cursorPosition.overflow) {
      this.screen_.commitLineOverflow();
      this.newLine(true);
    }

    let count = strWidth - startOffset;
    let didOverflow = false;
    let substr;

    if (this.screen_.cursorPosition.column + count >= this.screenSize.width) {
      didOverflow = true;
      count = this.screenSize.width - this.screen_.cursorPosition.column;
    }

    if (didOverflow && !this.options_.wraparound) {
      // If the string overflowed the line but wraparound is off, then the
      // last printed character should be the last of the string.
      // TODO: This will add to our problems with multibyte UTF-16 characters.
      substr = lib.wc.substr(str, startOffset, count - 1) +
          lib.wc.substr(str, strWidth - 1);
      count = strWidth;
    } else {
      substr = lib.wc.substr(str, startOffset, count);
    }

    const tokens = hterm.TextAttributes.splitWidecharString(substr);
    for (let i = 0; i < tokens.length; i++) {
      this.screen_.textAttributes.wcNode = tokens[i].wcNode;
      this.screen_.textAttributes.asciiNode = tokens[i].asciiNode;

      if (this.options_.insertMode) {
        this.screen_.insertString(tokens[i].str, tokens[i].wcStrWidth);
      } else {
        this.screen_.overwriteString(tokens[i].str, tokens[i].wcStrWidth);
      }
      this.screen_.textAttributes.wcNode = false;
      this.screen_.textAttributes.asciiNode = true;
    }

    this.screen_.maybeClipCurrentRow();
    startOffset += count;
  }

  if (this.scrollOnOutput_) {
    this.scrollPort_.scrollRowToBottom(this.getRowCount());
  }
};

/**
 * Set the VT scroll region.
 *
 * This also resets the cursor position to the absolute (0, 0) position, since
 * that's what xterm appears to do.
 *
 * Setting the scroll region to the full height of the terminal will clear
 * the scroll region.  This is *NOT* what most terminals do.  We're explicitly
 * going "off-spec" here because it makes `screen` and `tmux` overflow into the
 * local scrollback buffer, which means the scrollbars and shift-pgup/pgdn
 * continue to work as most users would expect.
 *
 * @param {?number} scrollTop The zero-based top of the scroll region.
 * @param {?number} scrollBottom The zero-based bottom of the scroll region,
 *     inclusive.
 */
hterm.Terminal.prototype.setVTScrollRegion = function(scrollTop, scrollBottom) {
  this.vtScrollTop_ = scrollTop;
  this.vtScrollBottom_ = scrollBottom;
  if (scrollBottom == this.screenSize.height - 1) {
    this.vtScrollBottom_ = null;
    if (scrollTop == 0) {
      this.vtScrollTop_ = null;
    }
  }
};

/**
 * Return the top row index according to the VT.
 *
 * This will return 0 unless the terminal has been told to restrict scrolling
 * to some lower row.  It is used for some VT cursor positioning and scrolling
 * commands.
 *
 * @return {number} The topmost row in the terminal's scroll region.
 */
hterm.Terminal.prototype.getVTScrollTop = function() {
  if (this.vtScrollTop_ != null) {
    return this.vtScrollTop_;
  }

  return 0;
};

/**
 * Return the bottom row index according to the VT.
 *
 * This will return the height of the terminal unless the it has been told to
 * restrict scrolling to some higher row.  It is used for some VT cursor
 * positioning and scrolling commands.
 *
 * @return {number} The bottom most row in the terminal's scroll region.
 */
hterm.Terminal.prototype.getVTScrollBottom = function() {
  if (this.vtScrollBottom_ != null) {
    return this.vtScrollBottom_;
  }

  return this.screenSize.height - 1;
};

/**
 * Process a '\n' character.
 *
 * If the cursor is on the final row of the terminal this will append a new
 * blank row to the screen and scroll the topmost row into the scrollback
 * buffer.
 *
 * Otherwise, this moves the cursor to column zero of the next row.
 *
 * @param {boolean=} dueToOverflow Whether the newline is due to wraparound of
 *     the terminal.
 */
hterm.Terminal.prototype.newLine = function(dueToOverflow = false) {
  if (!dueToOverflow) {
    this.accessibilityReader_.newLine();
  }

  const cursorAtEndOfScreen =
      (this.screen_.cursorPosition.row == this.screen_.rowsArray.length - 1);
  const cursorAtEndOfVTRegion =
      (this.screen_.cursorPosition.row == this.getVTScrollBottom());

  if (this.vtScrollTop_ != null && cursorAtEndOfVTRegion) {
    // A VT Scroll region is active on top, we never append new rows.
    // We're at the end of the VT Scroll Region, perform a VT scroll.
    this.vtScrollUp(1);
    this.setAbsoluteCursorPosition(this.screen_.cursorPosition.row, 0);
  } else if (cursorAtEndOfScreen) {
    // We're at the end of the screen.  Append a new row to the terminal,
    // shifting the top row into the scrollback.
    this.appendRows_(1);
  } else if (cursorAtEndOfVTRegion) {
    this.insertRow_();
  } else {
    // Anywhere else in the screen just moves the cursor.
    this.setAbsoluteCursorPosition(this.screen_.cursorPosition.row + 1, 0);
  }
};

/**
 * Like newLine(), except maintain the cursor column.
 */
hterm.Terminal.prototype.lineFeed = function() {
  const column = this.screen_.cursorPosition.column;
  this.newLine();
  this.setCursorColumn(column);
};

/**
 * If autoCarriageReturn is set then newLine(), else lineFeed().
 */
hterm.Terminal.prototype.formFeed = function() {
  if (this.options_.autoCarriageReturn) {
    this.newLine();
  } else {
    this.lineFeed();
  }
};

/**
 * Move the cursor up one row, possibly inserting a blank line.
 *
 * The cursor column is not changed.
 */
hterm.Terminal.prototype.reverseLineFeed = function() {
  const scrollTop = this.getVTScrollTop();
  const currentRow = this.screen_.cursorPosition.row;

  if (currentRow == scrollTop) {
    this.insertLines(1);
  } else {
    this.setAbsoluteCursorRow(currentRow - 1);
  }
};

/**
 * Replace all characters to the left of the current cursor with the space
 * character.
 *
 * TODO(rginda): This should probably *remove* the characters (not just replace
 * with a space) if there are no characters at or beyond the current cursor
 * position.
 */
hterm.Terminal.prototype.eraseToLeft = function() {
  const cursor = this.saveCursor();
  this.setCursorColumn(0);
  const count = cursor.column + 1;
  this.screen_.overwriteString(' '.repeat(count), count);
  this.restoreCursor(cursor);
};

/**
 * Erase a given number of characters to the right of the cursor.
 *
 * The cursor position is unchanged.
 *
 * If the current background color is not the default background color this
 * will insert spaces rather than delete.  This is unfortunate because the
 * trailing space will affect text selection, but it's difficult to come up
 * with a way to style empty space that wouldn't trip up the hterm.Screen
 * code.
 *
 * eraseToRight is ignored in the presence of a cursor overflow.  This deviates
 * from xterm, but agrees with gnome-terminal and konsole, xfce4-terminal.  See
 * crbug.com/232390 for details.
 *
 * @param {number=} count The number of characters to erase.
 */
hterm.Terminal.prototype.eraseToRight = function(count = undefined) {
  if (this.screen_.cursorPosition.overflow) {
    return;
  }

  const maxCount = this.screenSize.width - this.screen_.cursorPosition.column;
  count = count ? Math.min(count, maxCount) : maxCount;

  if (this.screen_.textAttributes.background ===
      this.screen_.textAttributes.DEFAULT_COLOR) {
    const cursorRow = this.screen_.rowsArray[this.screen_.cursorPosition.row];
    if (hterm.TextAttributes.nodeWidth(cursorRow) <=
        this.screen_.cursorPosition.column + count) {
      this.screen_.deleteChars(count);
      this.clearCursorOverflow();
      return;
    }
  }

  const cursor = this.saveCursor();
  this.screen_.overwriteString(' '.repeat(count), count);
  this.restoreCursor(cursor);
  this.clearCursorOverflow();
};

/**
 * Erase the current line.
 *
 * The cursor position is unchanged.
 */
hterm.Terminal.prototype.eraseLine = function() {
  const cursor = this.saveCursor();
  this.screen_.clearCursorRow();
  this.restoreCursor(cursor);
  this.clearCursorOverflow();
};

/**
 * Erase all characters from the start of the screen to the current cursor
 * position, regardless of scroll region.
 *
 * The cursor position is unchanged.
 */
hterm.Terminal.prototype.eraseAbove = function() {
  const cursor = this.saveCursor();

  this.eraseToLeft();

  for (let i = 0; i < cursor.row; i++) {
    this.setAbsoluteCursorPosition(i, 0);
    this.screen_.clearCursorRow();
  }

  this.restoreCursor(cursor);
  this.clearCursorOverflow();
};

/**
 * Erase all characters from the current cursor position to the end of the
 * screen, regardless of scroll region.
 *
 * The cursor position is unchanged.
 */
hterm.Terminal.prototype.eraseBelow = function() {
  const cursor = this.saveCursor();

  this.eraseToRight();

  const bottom = this.screenSize.height - 1;
  for (let i = cursor.row + 1; i <= bottom; i++) {
    this.setAbsoluteCursorPosition(i, 0);
    this.screen_.clearCursorRow();
  }

  this.restoreCursor(cursor);
  this.clearCursorOverflow();
};

/**
 * Fill the terminal with a given character.
 *
 * This methods does not respect the VT scroll region.
 *
 * @param {string} ch The character to use for the fill.
 */
hterm.Terminal.prototype.fill = function(ch) {
  const cursor = this.saveCursor();

  this.setAbsoluteCursorPosition(0, 0);
  for (let row = 0; row < this.screenSize.height; row++) {
    for (let col = 0; col < this.screenSize.width; col++) {
      this.setAbsoluteCursorPosition(row, col);
      this.screen_.overwriteString(ch, 1);
    }
  }

  this.restoreCursor(cursor);
};

/**
 * Erase the entire display and leave the cursor at (0, 0).
 *
 * This does not respect the scroll region.
 *
 * @param {!hterm.Screen=} screen Optional screen to operate on.  Defaults
 *     to the current screen.
 */
hterm.Terminal.prototype.clearHome = function(screen = undefined) {
  if (!screen) {
    screen = this.screen_;
  }
  const bottom = screen.getHeight();

  this.accessibilityReader_.clear();

  if (bottom == 0) {
    // Empty screen, nothing to do.
    return;
  }

  for (let i = 0; i < bottom; i++) {
    screen.setCursorPosition(i, 0);
    screen.clearCursorRow();
  }

  screen.setCursorPosition(0, 0);
};

/**
 * Erase the entire display without changing the cursor position.
 *
 * The cursor position is unchanged.  This does not respect the scroll
 * region.
 *
 * @param {!hterm.Screen=} screen Optional screen to operate on.  Defaults
 *     to the current screen.
 */
hterm.Terminal.prototype.clear = function(screen = undefined) {
  if (!screen) {
    screen = this.screen_;
  }
  const cursor = screen.cursorPosition.clone();
  this.clearHome(screen);
  screen.setCursorPosition(cursor.row, cursor.column);
};

/**
 * VT command to insert lines at the current cursor row.
 *
 * This respects the current scroll region.  Rows pushed off the bottom are
 * lost (they won't show up in the scrollback buffer).
 *
 * @param {number} count The number of lines to insert.
 */
hterm.Terminal.prototype.insertLines = function(count) {
  const cursorRow = this.screen_.cursorPosition.row;

  const bottom = this.getVTScrollBottom();
  count = Math.min(count, bottom - cursorRow);

  // The moveCount is the number of rows we need to relocate to make room for
  // the new row(s).  The count is the distance to move them.
  const moveCount = bottom - cursorRow - count + 1;
  if (moveCount) {
    this.moveRows_(cursorRow, moveCount, cursorRow + count);
  }

  for (let i = count - 1; i >= 0; i--) {
    this.setAbsoluteCursorPosition(cursorRow + i, 0);
    this.screen_.clearCursorRow();
  }
};

/**
 * VT command to delete lines at the current cursor row.
 *
 * New rows are added to the bottom of scroll region to take their place.  New
 * rows are strictly there to take up space and have no content or style.
 *
 * @param {number} count The number of lines to delete.
 */
hterm.Terminal.prototype.deleteLines = function(count) {
  const cursor = this.saveCursor();

  const top = cursor.row;
  const bottom = this.getVTScrollBottom();

  const maxCount = bottom - top + 1;
  count = Math.min(count, maxCount);

  const moveStart = bottom - count + 1;
  if (count != maxCount) {
    this.moveRows_(top, count, moveStart);
  }

  for (let i = 0; i < count; i++) {
    this.setAbsoluteCursorPosition(moveStart + i, 0);
    this.screen_.clearCursorRow();
  }

  this.restoreCursor(cursor);
  this.clearCursorOverflow();
};

/**
 * Inserts the given number of spaces at the current cursor position.
 *
 * The cursor position is not changed.
 *
 * @param {number} count The number of spaces to insert.
 */
hterm.Terminal.prototype.insertSpace = function(count) {
  const cursor = this.saveCursor();

  const ws = ' '.repeat(count || 1);
  this.screen_.insertString(ws, ws.length);
  this.screen_.maybeClipCurrentRow();

  this.restoreCursor(cursor);
  this.clearCursorOverflow();
};

/**
 * Forward-delete the specified number of characters starting at the cursor
 * position.
 *
 * @param {number} count The number of characters to delete.
 */
hterm.Terminal.prototype.deleteChars = function(count) {
  const deleted = this.screen_.deleteChars(count);
  if (deleted && !this.screen_.textAttributes.isDefault()) {
    const cursor = this.saveCursor();
    this.setCursorColumn(this.screenSize.width - deleted);
    this.screen_.insertString(' '.repeat(deleted));
    this.restoreCursor(cursor);
  }

  this.clearCursorOverflow();
};

/**
 * Shift rows in the scroll region upwards by a given number of lines.
 *
 * New rows are inserted at the bottom of the scroll region to fill the
 * vacated rows.  The new rows not filled out with the current text attributes.
 *
 * This function does not affect the scrollback rows at all.  Rows shifted
 * off the top are lost.
 *
 * The cursor position is not altered.
 *
 * @param {number} count The number of rows to scroll.
 */
hterm.Terminal.prototype.vtScrollUp = function(count) {
  const cursor = this.saveCursor();

  this.setAbsoluteCursorRow(this.getVTScrollTop());
  this.deleteLines(count);

  this.restoreCursor(cursor);
};

/**
 * Shift rows below the cursor down by a given number of lines.
 *
 * This function respects the current scroll region.
 *
 * New rows are inserted at the top of the scroll region to fill the
 * vacated rows.  The new rows not filled out with the current text attributes.
 *
 * This function does not affect the scrollback rows at all.  Rows shifted
 * off the bottom are lost.
 *
 * @param {number} count The number of rows to scroll.
 */
hterm.Terminal.prototype.vtScrollDown = function(count) {
  const cursor = this.saveCursor();

  this.setAbsoluteCursorPosition(this.getVTScrollTop(), 0);
  this.insertLines(count);

  this.restoreCursor(cursor);
};

/**
 * Enable accessibility-friendly features that have a performance impact.
 *
 * This will generate additional DOM nodes in an aria-live region that will
 * cause Assitive Technology to announce the output of the terminal. It also
 * enables other features that aid assistive technology. All the features gated
 * behind this flag have a performance impact on the terminal which is why they
 * are made optional.
 *
 * @param {boolean} enabled Whether to enable accessibility-friendly features.
 */
hterm.Terminal.prototype.setAccessibilityEnabled = function(enabled) {
  this.accessibilityReader_.setAccessibilityEnabled(enabled);
};

/**
 * Set the cursor position.
 *
 * The cursor row is relative to the scroll region if the terminal has
 * 'origin mode' enabled, or relative to the addressable screen otherwise.
 *
 * @param {number} row The new zero-based cursor row.
 * @param {number} column The new zero-based cursor column.
 */
hterm.Terminal.prototype.setCursorPosition = function(row, column) {
  if (this.options_.originMode) {
    this.setRelativeCursorPosition(row, column);
  } else {
    this.setAbsoluteCursorPosition(row, column);
  }
};

/**
 * Move the cursor relative to its current position.
 *
 * @param {number} row
 * @param {number} column
 */
hterm.Terminal.prototype.setRelativeCursorPosition = function(row, column) {
  const scrollTop = this.getVTScrollTop();
  row = lib.f.clamp(row + scrollTop, scrollTop, this.getVTScrollBottom());
  column = lib.f.clamp(column, 0, this.screenSize.width - 1);
  this.screen_.setCursorPosition(row, column);
};

/**
 * Move the cursor to the specified position.
 *
 * @param {number} row
 * @param {number} column
 */
hterm.Terminal.prototype.setAbsoluteCursorPosition = function(row, column) {
  row = lib.f.clamp(row, 0, this.screenSize.height - 1);
  column = lib.f.clamp(column, 0, this.screenSize.width - 1);
  this.screen_.setCursorPosition(row, column);
};

/**
 * Set the cursor column.
 *
 * @param {number} column The new zero-based cursor column.
 */
hterm.Terminal.prototype.setCursorColumn = function(column) {
  this.setAbsoluteCursorPosition(this.screen_.cursorPosition.row, column);
};

/**
 * Return the cursor column.
 *
 * @return {number} The zero-based cursor column.
 */
hterm.Terminal.prototype.getCursorColumn = function() {
  return this.screen_.cursorPosition.column;
};

/**
 * Set the cursor row.
 *
 * The cursor row is relative to the scroll region if the terminal has
 * 'origin mode' enabled, or relative to the addressable screen otherwise.
 *
 * @param {number} row The new cursor row.
 */
hterm.Terminal.prototype.setAbsoluteCursorRow = function(row) {
  this.setAbsoluteCursorPosition(row, this.screen_.cursorPosition.column);
};

/**
 * Return the cursor row.
 *
 * @return {number} The zero-based cursor row.
 */
hterm.Terminal.prototype.getCursorRow = function() {
  return this.screen_.cursorPosition.row;
};

/**
 * Request that the ScrollPort redraw itself soon.
 *
 * The redraw will happen asynchronously, soon after the call stack winds down.
 * Multiple calls will be coalesced into a single redraw.
 */
hterm.Terminal.prototype.scheduleRedraw_ = function() {
  if (this.timeouts_.redraw) {
    return;
  }

  this.timeouts_.redraw = setTimeout(() => {
    delete this.timeouts_.redraw;
    this.scrollPort_.redraw_();
  });
};

/**
 * Request that the ScrollPort be scrolled to the bottom.
 *
 * The scroll will happen asynchronously, soon after the call stack winds down.
 * Multiple calls will be coalesced into a single scroll.
 *
 * This affects the scrollbar position of the ScrollPort, and has nothing to
 * do with the VT scroll commands.
 */
hterm.Terminal.prototype.scheduleScrollDown_ = function() {
  if (this.timeouts_.scrollDown) {
    return;
  }

  this.timeouts_.scrollDown = setTimeout(() => {
    delete this.timeouts_.scrollDown;
    this.scrollPort_.scrollRowToBottom(this.getRowCount());
  }, 10);
};

/**
 * Move the cursor up a specified number of rows.
 *
 * @param {number} count The number of rows to move the cursor.
 */
hterm.Terminal.prototype.cursorUp = function(count) {
  this.cursorDown(-(count || 1));
};

/**
 * Move the cursor down a specified number of rows.
 *
 * @param {number} count The number of rows to move the cursor.
 */
hterm.Terminal.prototype.cursorDown = function(count) {
  count = count || 1;
  const minHeight = (this.options_.originMode ? this.getVTScrollTop() : 0);
  const maxHeight = (this.options_.originMode ? this.getVTScrollBottom() :
                     this.screenSize.height - 1);

  const row = lib.f.clamp(this.screen_.cursorPosition.row + count,
                          minHeight, maxHeight);
  this.setAbsoluteCursorRow(row);
};

/**
 * Move the cursor left a specified number of columns.
 *
 * If reverse wraparound mode is enabled and the previous row wrapped into
 * the current row then we back up through the wraparound as well.
 *
 * @param {number} count The number of columns to move the cursor.
 */
hterm.Terminal.prototype.cursorLeft = function(count) {
  count = count || 1;

  if (count < 1) {
    return;
  }

  const currentColumn = this.screen_.cursorPosition.column;
  if (this.options_.reverseWraparound) {
    if (this.screen_.cursorPosition.overflow) {
      // If this cursor is in the right margin, consume one count to get it
      // back to the last column.  This only applies when we're in reverse
      // wraparound mode.
      count--;
      this.clearCursorOverflow();

      if (!count) {
        return;
      }
    }

    let newRow = this.screen_.cursorPosition.row;
    let newColumn = currentColumn - count;
    if (newColumn < 0) {
      newRow = newRow - Math.floor(count / this.screenSize.width) - 1;
      if (newRow < 0) {
        // xterm also wraps from row 0 to the last row.
        newRow = this.screenSize.height + newRow % this.screenSize.height;
      }
      newColumn = this.screenSize.width + newColumn % this.screenSize.width;
    }

    this.setCursorPosition(Math.max(newRow, 0), newColumn);

  } else {
    const newColumn = Math.max(currentColumn - count, 0);
    this.setCursorColumn(newColumn);
  }
};

/**
 * Move the cursor right a specified number of columns.
 *
 * @param {number} count The number of columns to move the cursor.
 */
hterm.Terminal.prototype.cursorRight = function(count) {
  count = count || 1;

  if (count < 1) {
    return;
  }

  const column = lib.f.clamp(this.screen_.cursorPosition.column + count,
                             0, this.screenSize.width - 1);
  this.setCursorColumn(column);
};

/**
 * Reverse the foreground and background colors of the terminal.
 *
 * This only affects text that was drawn with no attributes.
 *
 * TODO(rginda): Test xterm to see if reverse is respected for text that has
 * been drawn with attributes that happen to coincide with the default
 * 'no-attribute' colors.  My guess is probably not.
 *
 * @param {boolean} state The state to set.
 */
hterm.Terminal.prototype.setReverseVideo = function(state) {
  this.options_.reverseVideo = state;
  if (state) {
    this.setRgbColorCssVar('foreground-color', this.backgroundColor_);
    this.setRgbColorCssVar('background-color', this.foregroundColor_);
  } else {
    this.setRgbColorCssVar('foreground-color', this.foregroundColor_);
    this.setRgbColorCssVar('background-color', this.backgroundColor_);
  }
};

/**
 * Ring the terminal bell.
 *
 * This will not play the bell audio more than once per second.
 */
hterm.Terminal.prototype.ringBell = function() {
  this.cursorNode_.style.backgroundColor = 'rgb(var(--hterm-foreground-color))';
  this.cursorNode_.style.animationName = '';

  setTimeout(() => this.restyleCursor_(), 500);

  if (this.desktopNotificationBell_ && !this.document_.hasFocus()) {
    const n = hterm.notify();
    this.bellNotificationList_.push(n);
    // TODO: Should we try to raise the window here?
    n.onclick = () => this.closeBellNotifications_();
  }
};

/**
 * Set the origin mode bit.
 *
 * If origin mode is on, certain VT cursor and scrolling commands measure their
 * row parameter relative to the VT scroll region.  Otherwise, row 0 corresponds
 * to the top of the addressable screen.
 *
 * Defaults to off.
 *
 * @param {boolean} state True to set origin mode, false to unset.
 */
hterm.Terminal.prototype.setOriginMode = function(state) {
  this.options_.originMode = state;
  this.setCursorPosition(0, 0);
};

/**
 * Set the insert mode bit.
 *
 * If insert mode is on, existing text beyond the cursor position will be
 * shifted right to make room for new text.  Otherwise, new text overwrites
 * any existing text.
 *
 * Defaults to off.
 *
 * @param {boolean} state True to set insert mode, false to unset.
 */
hterm.Terminal.prototype.setInsertMode = function(state) {
  this.options_.insertMode = state;
};

/**
 * Set the auto carriage return bit.
 *
 * If auto carriage return is on then a formfeed character is interpreted
 * as a newline, otherwise it's the same as a linefeed.  The difference boils
 * down to whether or not the cursor column is reset.
 *
 * @param {boolean} state The state to set.
 */
hterm.Terminal.prototype.setAutoCarriageReturn = function(state) {
  this.options_.autoCarriageReturn = state;
};

/**
 * Set the wraparound mode bit.
 *
 * If wraparound mode is on, certain VT commands will allow the cursor to wrap
 * to the start of the following row.  Otherwise, the cursor is clamped to the
 * end of the screen and attempts to write past it are ignored.
 *
 * Defaults to on.
 *
 * @param {boolean} state True to set wraparound mode, false to unset.
 */
hterm.Terminal.prototype.setWraparound = function(state) {
  this.options_.wraparound = state;
};

/**
 * Set the reverse-wraparound mode bit.
 *
 * If wraparound mode is off, certain VT commands will allow the cursor to wrap
 * to the end of the previous row.  Otherwise, the cursor is clamped to column
 * 0.
 *
 * Defaults to off.
 *
 * @param {boolean} state True to set reverse-wraparound mode, false to unset.
 */
hterm.Terminal.prototype.setReverseWraparound = function(state) {
  this.options_.reverseWraparound = state;
};

/**
 * Selects between the primary and alternate screens.
 *
 * If alternate mode is on, the alternate screen is active.  Otherwise the
 * primary screen is active.
 *
 * Swapping screens has no effect on the scrollback buffer.
 *
 * Each screen maintains its own cursor position.
 *
 * Defaults to off.
 *
 * @param {boolean} state True to set alternate mode, false to unset.
 */
hterm.Terminal.prototype.setAlternateMode = function(state) {
  if (state == (this.screen_ == this.alternateScreen_)) {
    return;
  }
  const oldOverrides = this.screen_.textAttributes.colorPaletteOverrides;
  const cursor = this.saveCursor();
  this.screen_ = state ? this.alternateScreen_ : this.primaryScreen_;

  // Swap color overrides.
  const newOverrides = this.screen_.textAttributes.colorPaletteOverrides;
  oldOverrides.forEach((c, i) => {
    if (!newOverrides.hasOwnProperty(i)) {
      this.setRgbColorCssVar(`color-${i}`, this.getColorPalette(i));
    }
  });
  newOverrides.forEach((c, i) => this.setRgbColorCssVar(`color-${i}`, c));

  if (this.screen_.rowsArray.length &&
      this.screen_.rowsArray[0].rowIndex != this.scrollbackRows_.length) {
    // If the screen changed sizes while we were away, our rowIndexes may
    // be incorrect.
    const offset = this.scrollbackRows_.length;
    const ary = this.screen_.rowsArray;
    for (let i = 0; i < ary.length; i++) {
      ary[i].rowIndex = offset + i;
    }
  }

  // NB: We specifically do not use realizeSize_ because that's optimized to
  // elide updates when the size is the same which is the most common scenario
  // at this point.  We need the other cascading changes from switching the
  // underlying screen to be processed.
  this.realizeWidth_(this.screenSize.width);
  this.realizeHeight_(this.screenSize.height);
  this.scrollPort_.syncScrollHeight();
  this.scrollPort_.invalidate();

  this.restoreCursor(cursor);
  this.scrollPort_.resize();
};

/**
 * Set the cursor-blink mode bit.
 *
 * 'p' - pauses blink if it's on
 * 'r' - resumes blink from normal state
 * 'u' - set according to user preference
 * 'y' - turn on
 * 'n' - turn off
 */
hterm.Terminal.prototype.setCursorBlink = function(b) {
  var temp, perm = this.options_.cursorBlink;

  switch (b) {
  case 'p': temp = 0;		break;
  case 'r': temp = perm;	break;
  case 'u':
  case 'y': temp = perm = 1;	break;
  case 'n': temp = perm = 0;	break;

  default: throw 'invalid blink: ' + b;
  }

  this.options_.cursorBlink = !!perm;
  this.cursorNode_.style.animationName = temp ? 'cursor-blink' : '';
};

/**
 * Set the cursor-visible mode bit.
 *
 * If cursor-visible is on, the cursor will be visible.  Otherwise it will not.
 *
 * Defaults to on.
 *
 * @param {boolean} state True to set cursor-visible mode, false to unset.
 */
hterm.Terminal.prototype.setCursorVisible = function(state) {
  this.options_.cursorVisible = state;

  if (state) this.syncCursorPosition_();

  this.restyleCursor_();
};

/**
 * Synchronizes the visible cursor and document selection with the current
 * cursor coordinates.
 *
 * @return {boolean} True if the cursor is onscreen and synced.
 */
hterm.Terminal.prototype.syncCursorPosition_ = function() {
  const topRowIndex = this.scrollPort_.getTopRowIndex();
  const bottomRowIndex = this.scrollPort_.getBottomRowIndex(topRowIndex);
  const cursorRowIndex = this.scrollbackRows_.length +
      this.screen_.cursorPosition.row;

  let forceSyncSelection = false;
  if (this.accessibilityReader_.accessibilityEnabled) {
    // Report the new position of the cursor for accessibility purposes.
    const cursorColumnIndex = this.screen_.cursorPosition.column;
    const cursorLineText =
        this.screen_.rowsArray[this.screen_.cursorPosition.row].innerText;
    // This will force the selection to be sync'd to the cursor position if the
    // user has pressed a key. Generally we would only sync the cursor position
    // when selection is collapsed so that if the user has selected something
    // we don't clear the selection by moving the selection. However when a
    // screen reader is used, it's intuitive for entering a key to move the
    // selection to the cursor.
    forceSyncSelection = this.accessibilityReader_.hasUserGesture;
    this.accessibilityReader_.afterCursorChange(
        cursorLineText, cursorRowIndex, cursorColumnIndex);
  }

  if (cursorRowIndex > bottomRowIndex) {
    // Cursor is scrolled off screen, hide it.
    this.cursorOffScreen_ = true;
    this.cursorNode_.style.display = 'none';
    return false;
  }

  if (this.cursorNode_.style.display == 'none') {
    // Re-display the terminal cursor if it was hidden.
    this.cursorOffScreen_ = false;
    this.cursorNode_.style.display = '';
  }

  // Position the cursor using CSS variable math.  If we do the math in JS,
  // the float math will end up being more precise than the CSS which will
  // cause the cursor tracking to be off.
  this.setCssVar(
      'cursor-offset-row',
      `${cursorRowIndex - topRowIndex} + ` +
      `${this.scrollPort_.visibleRowTopMargin}px`);
  this.setCssVar('cursor-offset-col', this.screen_.cursorPosition.column);

  this.cursorNode_.setAttribute('title',
                                '(' + this.screen_.cursorPosition.column +
                                ', ' + this.screen_.cursorPosition.row +
                                ')');

  // Update the caret for a11y purposes.
  const selection = this.document_.getSelection();
  if (selection && (selection.isCollapsed || forceSyncSelection)) {
    this.screen_.syncSelectionCaret(selection);
  }
  return true;
};

/**
 * Adjusts the style of this.cursorNode_ according to the current cursor shape
 * and character cell dimensions.
 */
hterm.Terminal.prototype.restyleCursor_ = function() {
  var opac;
  let shape = this.cursorShape_;

  const style = this.cursorNode_.style;

  if (this.cursorNode_.getAttribute('focus') == 'false') {
    // Always show a block cursor when unfocused.
    shape = 'b';
    this.setCursorBlink('p');
  }
  else {
    this.setCursorBlink('r');
  }

  opac = this.options_.cursorVisible ? 1.0 : 0.25;

  switch (shape) {
    case '|':
      style.borderColor = 'var(--hterm-cursor-color)';
      opac *= 0.9;
      style.backgroundColor = 'transparent';
      style.borderBottomStyle = '';
      style.borderLeftStyle = 'solid';
      break;

    case '_':
      style.borderColor = 'var(--hterm-cursor-color)';
      opac *= 0.9;
      style.backgroundColor = 'transparent';
      style.borderBottomStyle = 'solid';
      style.borderLeftStyle = '';
      break;

    case 'b':
      style.backgroundColor = 'var(--hterm-cursor-color)';
      opac *= 0.6;
      style.borderBottomStyle = '';
      style.borderLeftStyle = '';
      break;
  }

  this.setCssVar('curs-opac-factor', opac);
};

/**
 * Synchronizes the visible cursor with the current cursor coordinates.
 *
 * The sync will happen asynchronously, soon after the call stack winds down.
 * Multiple calls will be coalesced into a single sync. This should be called
 * prior to the cursor actually changing position.
 */
hterm.Terminal.prototype.scheduleSyncCursorPosition_ = function() {
  if (this.timeouts_.syncCursor) {
    return;
  }

  if (this.accessibilityReader_.accessibilityEnabled) {
    // Report the previous position of the cursor for accessibility purposes.
    const cursorRowIndex = this.scrollbackRows_.length +
        this.screen_.cursorPosition.row;
    const cursorColumnIndex = this.screen_.cursorPosition.column;
    const cursorLineText =
        this.screen_.rowsArray[this.screen_.cursorPosition.row].innerText;
    this.accessibilityReader_.beforeCursorChange(
        cursorLineText, cursorRowIndex, cursorColumnIndex);
  }

  this.timeouts_.syncCursor = setTimeout(() => {
    this.syncCursorPosition_();
    delete this.timeouts_.syncCursor;
  });
};

/**
 * Show the terminal overlay.
 *
 * @see hterm.NotificationCenter.show
 * @param {string|!Node} msg The message to display.
 * @param {?number=} timeout How long to time to wait before hiding.
 */
hterm.Terminal.prototype.showOverlay = function(msg, timeout = 1500) {
  if (!this.ready_ || !this.notifications_) {
    return;
  }

  this.notifications_.show(msg, {timeout});
};

/**
 * Hide the terminal overlay immediately.
 *
 * @see hterm.NotificationCenter.hide
 */
hterm.Terminal.prototype.hideOverlay = function() {
  this.notifications_.hide();
};

/**
 * Paste from the system clipboard to the terminal.
 *
 * Note: In Chrome, this should work unless the user has rejected the permission
 * request. In Firefox extension environment, you'll need the "clipboardRead"
 * permission.  In other environments, this might always fail as the browser
 * frequently blocks access for security reasons.
 *
 * @return {?boolean} If nagivator.clipboard.readText is available, the return
 *     value is always null. Otherwise, this function uses legacy pasting and
 *     returns a boolean indicating whether it is successful.
 */
hterm.Terminal.prototype.paste = function() {
  if (!this.alwaysUseLegacyPasting &&
      navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then((data) => this.onPasteData_(data));
    return null;
  } else {
    // Legacy pasting.
    try {
      return this.document_.execCommand('paste');
    } catch (firefoxException) {
      // Ignore this.  FF 40 and older would incorrectly throw an exception if
      // there was an error instead of returning false.
      return false;
    }
  }
};

/**
 * Copy a string to the system clipboard.
 *
 * Note: If there is a selected range in the terminal, it'll be cleared.
 *
 * @param {string} str The string to copy.
 */
hterm.Terminal.prototype.copyStringToClipboard = function(str) {
  if (this.prefs_.get('enable-clipboard-notice')) {
    if (!this.clipboardNotice_) {
      this.clipboardNotice_ = this.document_.createElement('div');
      this.clipboardNotice_.style.textAlign = 'center';
      const copyImage = lib.resource.getData('hterm/images/copy');
      this.clipboardNotice_.innerHTML = hterm.sanitizeHtml(
          `${copyImage}<div>${hterm.msg('NOTIFY_COPY', [], 'copied!')}</div>`);
    }
    setTimeout(() => this.showOverlay(this.clipboardNotice_, 500), 200);
  }

  hterm.copySelectionToClipboard(this.document_, str);
};

/**
 * Display an image.
 *
 * Either URI or buffer or blob fields must be specified.
 *
 * @param {{
 *     name: (string|undefined),
 *     size: (string|number|undefined),
 *     preserveAspectRation: (boolean|undefined),
 *     inline: (boolean|undefined),
 *     width: (string|number|undefined),
 *     height: (string|number|undefined),
 *     align: (string|undefined),
 *     url: (string|undefined),
 *     buffer: (!ArrayBuffer|undefined),
 *     blob: (!Blob|undefined),
 *     type: (string|undefined),
 * }} options The image to display.
 *   name A human readable string for the image
 *   size The size (in bytes).
 *   preserveAspectRatio Whether to preserve aspect.
 *   inline Whether to display the image inline.
 *   width The width of the image.
 *   height The height of the image.
 *   align Direction to align the image.
 *   uri The source URI for the image.
 *   buffer The ArrayBuffer image data.
 *   blob The Blob image data.
 *   type The MIME type of the image data.
 * @param {function()=} onLoad Callback when loading finishes.
 * @param {function(!Event)=} onError Callback when loading fails.
 */
hterm.Terminal.prototype.displayImage = function(options, onLoad, onError) {
  // Make sure we're actually given a resource to display.
  if (options.uri === undefined && options.buffer === undefined &&
      options.blob === undefined) {
    return;
  }

  // Set up the defaults to simplify code below.
  if (!options.name) {
    options.name = '';
  }

  // See if the mime type is available.  If not, guess from the filename.
  // We don't list all possible mime types because the browser can usually
  // guess it correctly.  So list the ones that need a bit more help.
  if (!options.type) {
    const ary = options.name.split('.');
    const ext = ary[ary.length - 1].trim();
    switch (ext) {
      case 'svg':
      case 'svgz':
        options.type = 'image/svg+xml';
        break;
    }
  }

  // Has the user approved image display yet?
  if (this.allowImagesInline !== true) {
    if (this.allowImagesInline === false) {
      this.showOverlay(hterm.msg('POPUP_INLINE_IMAGE_DISABLED', [],
                       'Inline Images Disabled'));
      return;
    }

    // Show a prompt.
    let button;
    const span = this.document_.createElement('span');

    const label = this.document_.createElement('p');
    label.innerText = hterm.msg('POPUP_INLINE_IMAGE', [], 'Inline Images');
    label.style.textAlign = 'center';
    span.appendChild(label);

    button = this.document_.createElement('input');
    button.type = 'button';
    button.value = hterm.msg('BUTTON_BLOCK', [], 'block');
    button.addEventListener('click', () => {
      this.prefs_.set('allow-images-inline', false);
      this.hideOverlay();
    });
    span.appendChild(button);

    span.appendChild(new Text(' '));

    button = this.document_.createElement('input');
    button.type = 'button';
    button.value = hterm.msg('BUTTON_ALLOW_SESSION', [], 'allow this session');
    button.addEventListener('click', () => {
      this.allowImagesInline = true;
      this.hideOverlay();
    });
    span.appendChild(button);

    span.appendChild(new Text(' '));

    button = this.document_.createElement('input');
    button.type = 'button';
    button.value = hterm.msg('BUTTON_ALLOW_ALWAYS', [], 'always allow');
    button.addEventListener('click', () => {
      this.prefs_.set('allow-images-inline', true);
      this.hideOverlay();
    });
    span.appendChild(button);

    this.showOverlay(span, null);
    return;
  }

  // See if we should show this object directly, or download it.
  if (options.inline) {
    const io = this.io.push();
    io.showOverlay(hterm.msg('LOADING_RESOURCE_START', [options.name],
                             'Loading $1 ...'));

    // While we're loading the image, eat all the user's input.
    io.sendString = () => {};

    // Initialize this new image.
    const img = this.document_.createElement('img');
    if (options.uri !== undefined) {
      img.src = options.uri;
    } else if (options.buffer !== undefined) {
      const blob = new Blob([options.buffer], {type: options.type});
      img.src = URL.createObjectURL(blob);
    } else {
      const blob = new Blob([options.blob], {type: options.type});
      img.src = URL.createObjectURL(blob);
    }
    img.title = img.alt = options.name;

    // Attach the image to the page to let it load/render.  It won't stay here.
    // This is needed so it's visible and the DOM can calculate the height.  If
    // the image is hidden or not in the DOM, the height is always 0.
    this.document_.body.appendChild(img);

    // Wait for the image to finish loading before we try moving it to the
    // right place in the terminal.
    img.onload = () => {
      // Now that we have the image dimensions, figure out how to show it.
      const screenSize = this.scrollPort_.getScreenSize();
      img.style.objectFit = options.preserveAspectRatio ? 'scale-down' : 'fill';
      img.style.maxWidth = `${screenSize.width}px`;
      img.style.maxHeight = `${screenSize.height}px`;

      // Parse a width/height specification.
      const parseDim = (dim, maxDim, cssVar) => {
        if (!dim || dim == 'auto') {
          return '';
        }

        const ary = dim.match(/^([0-9]+)(px|%)?$/);
        if (ary) {
          if (ary[2] == '%') {
            return Math.floor(maxDim * ary[1] / 100) + 'px';
          } else if (ary[2] == 'px') {
            return dim;
          } else {
            return `calc(${dim} * var(${cssVar}))`;
          }
        }

        return '';
      };
      img.style.width = parseDim(
          options.width, screenSize.width, '--hterm-charsize-width');
      img.style.height = parseDim(
          options.height, screenSize.height, '--hterm-charsize-height');

      // Figure out how many rows the image occupies, then add that many.
      // Note: This count will be inaccurate if the font size changes on us.
      const padRows = Math.ceil(img.clientHeight /
                                this.scrollPort_.characterSize.height);
      for (let i = 0; i < padRows; ++i) {
        this.newLine();
      }

      // Update the max height in case the user shrinks the character size.
      img.style.maxHeight = `calc(${padRows} * var(--hterm-charsize-height))`;

      // Move the image to the last row.  This way when we scroll up, it doesn't
      // disappear when the first row gets clipped.  It will disappear when we
      // scroll down and the last row is clipped ...
      this.document_.body.removeChild(img);
      // Create a wrapper node so we can do an absolute in a relative position.
      // This helps with rounding errors between JS & CSS counts.
      const div = this.document_.createElement('div');
      div.style.position = 'relative';
      div.style.textAlign = options.align || '';
      img.style.position = 'absolute';
      img.style.bottom = 'calc(0px - var(--hterm-charsize-height))';
      div.appendChild(img);
      const row = this.getRowNode(this.scrollbackRows_.length +
                                  this.getCursorRow() - 1);
      row.appendChild(div);

      // Now that the image has been read, we can revoke the source.
      if (options.uri === undefined) {
        URL.revokeObjectURL(img.src);
      }

      io.hideOverlay();
      io.pop();

      if (onLoad) {
        onLoad();
      }
    };

    // If we got a malformed image, give up.
    img.onerror = (e) => {
      this.document_.body.removeChild(img);
      io.showOverlay(hterm.msg('LOADING_RESOURCE_FAILED', [options.name],
                               'Loading $1 failed'));
      io.pop();

      if (onError) {
        onError(e);
      }
    };
  } else {
    // We can't use chrome.downloads.download as that requires "downloads"
    // permissions, and that works only in extensions, not apps.
    const a = this.document_.createElement('a');
    if (options.uri !== undefined) {
      a.href = options.uri;
    } else if (options.buffer !== undefined) {
      const blob = new Blob([options.buffer]);
      a.href = URL.createObjectURL(blob);
    } else {
      a.href = URL.createObjectURL(lib.notNull(options.blob));
    }
    a.download = options.name;
    this.document_.body.appendChild(a);
    a.click();
    a.remove();
    if (options.uri === undefined) {
      URL.revokeObjectURL(a.href);
    }
  }
};

/**
 * Returns the selected text, or null if no text is selected.
 *
 * @return {string|null}
 */
hterm.Terminal.prototype.getSelectionText = function() {
  const selection = this.scrollPort_.selection;
  selection.sync();

  if (selection.isCollapsed) {
    return null;
  }

  // Start offset measures from the beginning of the line.
  let startOffset = selection.startOffset;
  let node = selection.startNode;

  // If an x-row isn't selected, |node| will be null.
  if (!node) {
    return null;
  }

  if (node.nodeName != 'X-ROW') {
    // If the selection doesn't start on an x-row node, then it must be
    // somewhere inside the x-row.  Add any characters from previous siblings
    // into the start offset.

    if (node.nodeName == '#text' && node.parentNode.nodeName == 'SPAN') {
      // If node is the text node in a styled span, move up to the span node.
      node = node.parentNode;
    }

    while (node.previousSibling) {
      node = node.previousSibling;
      startOffset += hterm.TextAttributes.nodeWidth(node);
    }
  }

  // End offset measures from the end of the line.
  let endOffset =
      hterm.TextAttributes.nodeWidth(lib.notNull(selection.endNode)) -
      selection.endOffset;
  node = selection.endNode;

  if (node.nodeName != 'X-ROW') {
    // If the selection doesn't end on an x-row node, then it must be
    // somewhere inside the x-row.  Add any characters from following siblings
    // into the end offset.

    if (node.nodeName == '#text' && node.parentNode.nodeName == 'SPAN') {
      // If node is the text node in a styled span, move up to the span node.
      node = node.parentNode;
    }

    while (node.nextSibling) {
      node = node.nextSibling;
      endOffset += hterm.TextAttributes.nodeWidth(node);
    }
  }

  const rv = this.getRowsText(selection.startRow.rowIndex,
                              selection.endRow.rowIndex + 1);
  return lib.wc.substring(rv, startOffset, lib.wc.strWidth(rv) - endOffset);
};

/**
 * Copy the current selection to the system clipboard, then clear it after a
 * short delay.
 */
hterm.Terminal.prototype.copySelectionToClipboard = function() {
  const text = this.getSelectionText();
  if (text != null) {
    this.copyStringToClipboard(text);
  }
};

/**
 * Show overlay with current terminal size.
 */
hterm.Terminal.prototype.overlaySize = function() {
  if (this.prefs_.get('enable-resize-status')) {
    this.showOverlay(`${this.screenSize.width} × ${this.screenSize.height}`);
  }
};

/**
 * Open the selected url.
 */
hterm.Terminal.prototype.openSelectedUrl_ = function() {
  let str = this.getSelectionText();

  // If there is no selection, try and expand wherever they clicked.
  if (str == null) {
    this.screen_.expandSelectionForUrl(this.document_.getSelection());
    str = this.getSelectionText();

    // If clicking in empty space, return.
    if (str == null) {
      return;
    }
  }

  // Make sure URL is valid before opening.
  if (str.length > 2048 || str.search(/[\s[\](){}<>"'\\^`]/) >= 0) {
    return;
  }

  // If the URI isn't anchored, it'll open relative to the extension.
  // We have no way of knowing the correct schema, so assume http.
  if (str.search('^[a-zA-Z][a-zA-Z0-9+.-]*://') < 0) {
    // We have to allow a few protocols that lack authorities and thus
    // never use the //.  Like mailto.
    switch (str.split(':', 1)[0]) {
      case 'mailto':
        break;
      default:
        str = 'http://' + str;
        break;
    }
  }

  hterm.openUrl(str);
};

/**
 * Manage the automatic mouse hiding behavior while typing.
 *
 * @param {?boolean=} v Whether to enable automatic hiding.
 */
hterm.Terminal.prototype.setAutomaticMouseHiding = function(v = null) {
  // Since ChromeOS & macOS do this by default everywhere, we don't need to.
  // Linux & Windows seem to leave this to specific applications to manage.
  if (v === null) {
    v = (hterm.os != 'cros' && hterm.os != 'mac');
  }

  this.mouseHideWhileTyping_ = !!v;
};

/**
 * Handler for monitoring user keyboard activity.
 *
 * This isn't for processing the keystrokes directly, but for updating any
 * state that might toggle based on the user using the keyboard at all.
 *
 * @param {!KeyboardEvent} e The keyboard event that triggered us.
 */
hterm.Terminal.prototype.onKeyboardActivity_ = function(e) {
  // When the user starts typing, hide the mouse cursor.
  if (this.mouseHideWhileTyping_ && !this.mouseHideDelay_) {
    this.setCssVar('mouse-cursor-style', 'none');
  }
};

/**
 * Add the terminalRow and terminalColumn properties to mouse events and
 * then forward on to onMouse().
 *
 * The terminalRow and terminalColumn properties contain the (row, column)
 * coordinates for the mouse event.
 *
 * @param {!MouseEvent} e The mouse event to handle.
 */
hterm.Terminal.prototype.onMouse_ = function(e) {
  if (e.processedByTerminalHandler_) {
    // We register our event handlers on the document, as well as the cursor
    // and the scroll blocker.  Mouse events that occur on the cursor or
    // scroll blocker will also appear on the document, but we don't want to
    // process them twice.
    //
    // We can't just prevent bubbling because that has other side effects, so
    // we decorate the event object with this property instead.
    return;
  }

  // Consume navigation events.  Button 3 is usually "browser back" and
  // button 4 is "browser forward" which we don't want to happen.
  if (e.button > 2) {
    e.preventDefault();
    // We don't return so click events can be passed to the remote below.
  }

  const reportMouseEvents = (!this.defeatMouseReports_ &&
      this.vt.mouseReport != this.vt.MOUSE_REPORT_DISABLED);

  e.processedByTerminalHandler_ = true;

  // Handle auto hiding of mouse cursor while typing.
  if (this.mouseHideWhileTyping_ && !this.mouseHideDelay_) {
    // Make sure the mouse cursor is visible.
    this.syncMouseStyle();
    // This debounce isn't perfect, but should work well enough for such a
    // simple implementation.  If the user moved the mouse, we enabled this
    // debounce, and then moved the mouse just before the timeout, we wouldn't
    // debounce that later movement.
    this.mouseHideDelay_ = setTimeout(() => this.mouseHideDelay_ = null, 1000);
  }

  // One based row/column stored on the mouse event.
  const padding = this.scrollPort_.screenPaddingSize;
  e.terminalRow = Math.floor(
      (e.clientY - this.scrollPort_.visibleRowTopMargin - padding) /
      this.scrollPort_.characterSize.height) + 1;
  e.terminalColumn = Math.floor(
      (e.clientX - padding) / this.scrollPort_.characterSize.width) + 1;

  // Clamp row and column.
  e.terminalRow = lib.f.clamp(e.terminalRow, 1, this.screenSize.height);
  e.terminalColumn = lib.f.clamp(e.terminalColumn, 1, this.screenSize.width);

  // Ignore mousedown in the scrollbar area.
  if (e.type == 'mousedown' && e.clientX >= this.scrollPort_.getScrollbarX()) {
    return;
  }

  if (this.options_.cursorVisible && !reportMouseEvents &&
      !this.cursorOffScreen_) {
    // If the cursor is visible and we're not sending mouse events to the
    // host app, then we want to hide the terminal cursor when the mouse
    // cursor is over top.  This keeps the terminal cursor from interfering
    // with local text selection.
    if (e.terminalRow - 1 == this.screen_.cursorPosition.row &&
        e.terminalColumn - 1 == this.screen_.cursorPosition.column) {
      this.cursorNode_.style.display = 'none';
    } else if (this.cursorNode_.style.display == 'none') {
      this.cursorNode_.style.display = '';
    }
  }

  if (e.type == 'mousedown') {
    this.contextMenu.hide();

    if (e.altKey || !reportMouseEvents) {
      // If VT mouse reporting is disabled, or has been defeated with
      // alt-mousedown, then the mouse will act on the local selection.
      this.defeatMouseReports_ = true;
      this.setSelectionEnabled(true);
    } else {
      // Otherwise we defer ownership of the mouse to the VT.
      this.defeatMouseReports_ = false;
      this.document_.getSelection().collapseToEnd();
      this.setSelectionEnabled(false);
      e.preventDefault();
    }

    // Primary button 'mousedown'.
    if (e.button === 0) {
      this.scrollPort_.selection.setAutoScrollEnabled(true);
    }
  }

  if (!reportMouseEvents) {
    if (e.type == 'dblclick') {
      this.screen_.expandSelection(this.document_.getSelection());
      if (this.copyOnSelect) {
        this.copySelectionToClipboard();
      }
    }

    // Handle clicks to open links automatically.
    if (e.type == 'click' && !e.shiftKey && (e.ctrlKey || e.metaKey)) {
      // Ignore links created using OSC-8 as those will open by themselves, and
      // the visible text is most likely not the URI they want anyways.
      if (e.target.className === 'uri-node') {
        return;
      }

      // Debounce this event with the dblclick event.  If you try to doubleclick
      // a URL to open it, Chrome will fire click then dblclick, but we won't
      // have expanded the selection text at the first click event.
      clearTimeout(this.timeouts_.openUrl);
      this.timeouts_.openUrl = setTimeout(this.openSelectedUrl_.bind(this),
                                          500);
      return;
    }

    if (e.type == 'mousedown') {
      if (e.ctrlKey && e.button == 2 /* right button */) {
        e.preventDefault();
        this.contextMenu.show(e, this);
      } else if (e.button == this.mousePasteButton ||
          (this.mouseRightClickPaste && e.button == 2 /* right button */)) {
        if (this.paste() === false) {
          console.warn('Could not paste manually due to web restrictions');
        }
      }
    }

    if (e.type == 'mouseup' && e.button == 0 && this.copyOnSelect &&
        !this.document_.getSelection().isCollapsed) {
      this.copySelectionToClipboard();
    }

    if ((e.type == 'mousemove' || e.type == 'mouseup') &&
        this.scrollBlockerNode_.engaged) {
      // Disengage the scroll-blocker after one of these events.
      this.scrollBlockerNode_.engaged = false;
      this.scrollBlockerNode_.style.top = '-99px';
    }

    // Emulate arrow key presses via scroll wheel events.
    if (this.scrollWheelArrowKeys_ && !e.shiftKey &&
        this.keyboard.applicationCursor && !this.isPrimaryScreen()) {
      if (e.type == 'wheel') {
        const delta =
            this.scrollPort_.scrollWheelDelta(/** @type {!WheelEvent} */ (e));

        // Helper to turn a wheel event delta into a series of key presses.
        const deltaToArrows = (distance, charSize, arrowPos, arrowNeg) => {
          if (distance == 0) {
            return '';
          }

          // Convert the scroll distance into a number of rows/cols.
          const cells = lib.f.smartFloorDivide(Math.abs(distance), charSize);
          const data = '\x1bO' + (distance < 0 ? arrowNeg : arrowPos);
          return data.repeat(cells);
        };

        // The order between up/down and left/right doesn't really matter.
        this.io.sendString(
            // Up/down arrow keys.
            deltaToArrows(delta.y, this.scrollPort_.characterSize.height,
                          'A', 'B') +
            // Left/right arrow keys.
            deltaToArrows(delta.x, this.scrollPort_.characterSize.width,
                          'C', 'D'),
        );

        e.preventDefault();
      }
    }
  } else /* if (this.reportMouseEvents) */ {
    if (!this.scrollBlockerNode_.engaged) {
      if (e.type == 'mousedown') {
        // Move the scroll-blocker into place if we want to keep the scrollport
        // from scrolling.
        this.scrollBlockerNode_.engaged = true;
        this.scrollBlockerNode_.style.top = (e.clientY - 5) + 'px';
        this.scrollBlockerNode_.style.left = (e.clientX - 5) + 'px';
      } else if (e.type == 'mousemove') {
        // Oh.  This means that drag-scroll was disabled AFTER the mouse down,
        // in which case it's too late to engage the scroll-blocker.
        this.document_.getSelection().collapseToEnd();
        e.preventDefault();
      }
    }

    this.onMouse(e);
  }

  if (e.type == 'mouseup') {
    if (this.document_.getSelection().isCollapsed) {
      // Restore this on mouseup in case it was temporarily defeated with a
      // alt-mousedown.  Only do this when the selection is empty so that
      // we don't immediately kill the users selection.
      this.defeatMouseReports_ = false;
    }

    // Primary button 'mouseup'.
    if (e.button === 0) {
      this.scrollPort_.selection.setAutoScrollEnabled(false);
    }
  }
};

/**
 * Clients should override this if they care to know about mouse events.
 *
 * The event parameter will be a normal DOM mouse click event with additional
 * 'terminalRow' and 'terminalColumn' properties.
 *
 * @param {!MouseEvent} e The mouse event to handle.
 */
hterm.Terminal.prototype.onMouse = function(e) { };

/**
 * React when focus changes.
 *
 * @param {boolean} focused True if focused, false otherwise.
 */
hterm.Terminal.prototype.onFocusChange_ = function(focused) {
  this.cursorNode_.setAttribute('focus', focused);
  this.restyleCursor_();

  if (this.reportFocus) {
    this.io.sendString(focused === true ? '\x1b[I' : '\x1b[O');
  }

  if (focused === true) {
    this.closeBellNotifications_();
  }
};

/**
 * React when the ScrollPort is scrolled.
 */
hterm.Terminal.prototype.onScroll_ = function() {
  this.scheduleSyncCursorPosition_();
};

/**
 * React when text is pasted into the scrollPort.
 *
 * @param {{text: string}} e The text of the paste event to handle.
 */
hterm.Terminal.prototype.onPaste_ = function(e) {
  this.onPasteData_(e.text);
};

/**
 * Handle pasted data.
 *
 * @param {string} data The pasted data.
 */
hterm.Terminal.prototype.onPasteData_ = function(data) {
  data = data.replace(/\n/mg, '\r');
  if (this.options_.bracketedPaste) {
    // We strip out most escape sequences as they can cause issues (like
    // inserting an \x1b[201~ midstream).  We pass through whitespace
    // though: 0x08:\b 0x09:\t 0x0a:\n 0x0d:\r.
    // This matches xterm behavior.
    // eslint-disable-next-line no-control-regex
    const filter = (data) => data.replace(/[\x00-\x07\x0b-\x0c\x0e-\x1f]/g, '');
    data = '\x1b[200~' + filter(data) + '\x1b[201~';
  }

  this.io.sendString(data);
};

/**
 * React when the user tries to copy from the scrollPort.
 *
 * @param {!Event} e The DOM copy event.
 */
hterm.Terminal.prototype.onCopy_ = function(e) {
  if (!this.useDefaultWindowCopy) {
    e.preventDefault();
    setTimeout(this.copySelectionToClipboard.bind(this), 0);
  }
};

/**
 * React when the ScrollPort is resized.
 *
 * Note: This function should not directly contain code that alters the internal
 * state of the terminal.  That kind of code belongs in realizeWidth or
 * realizeHeight, so that it can be executed synchronously in the case of a
 * programmatic width change.
 */
hterm.Terminal.prototype.onResize_ = function() {
  const columnCount = Math.floor(this.scrollPort_.getScreenWidth() /
                                 this.scrollPort_.characterSize.width) || 0;
  const rowCount = lib.f.smartFloorDivide(
      this.scrollPort_.getScreenHeight(),
      this.scrollPort_.characterSize.height) || 0;

  if (columnCount <= 0 || rowCount <= 0) {
    // We avoid these situations since they happen sometimes when the terminal
    // gets removed from the document or during the initial load, and we can't
    // deal with that.
    // This can also happen if called before the scrollPort calculates the
    // character size, meaning we dived by 0 above and default to 0 values.
    return;
  }

  const isNewSize = (columnCount != this.screenSize.width ||
                     rowCount != this.screenSize.height);
  const wasScrolledEnd = this.scrollPort_.isScrolledEnd;

  // We do this even if the size didn't change, just to be sure everything is
  // in sync.
  this.realizeSize_(columnCount, rowCount);
  this.updateCssCharsize_();

  if (isNewSize) {
    this.overlaySize();
  }

  this.restyleCursor_();
  this.scheduleSyncCursorPosition_();

  if (wasScrolledEnd) {
    this.scrollEnd();
  }
};

/**
 * Set the scrollbar-visible mode bit.
 *
 * If scrollbar-visible is on, the vertical scrollbar will be visible.
 * Otherwise it will not.
 *
 * Defaults to on.
 *
 * @param {boolean} state True to set scrollbar-visible mode, false to unset.
 */
hterm.Terminal.prototype.setScrollbarVisible = function(state) {
  this.scrollPort_.setScrollbarVisible(state);
};

/**
 * Set the scroll wheel move multiplier.  This will affect how fast the page
 * scrolls on wheel events.
 *
 * Defaults to 1.
 *
 * @param {number} multiplier The multiplier to set.
 */
hterm.Terminal.prototype.setScrollWheelMoveMultipler = function(multiplier) {
  this.scrollPort_.setScrollWheelMoveMultipler(multiplier);
};

/**
 * Close all web notifications created by terminal bells.
 */
hterm.Terminal.prototype.closeBellNotifications_ = function() {
  this.bellNotificationList_.forEach(function(n) {
      n.close();
    });
  this.bellNotificationList_.length = 0;
};

/**
 * Syncs the cursor position when the scrollport gains focus.
 */
hterm.Terminal.prototype.onScrollportFocus_ = function() {
  // If the cursor is offscreen we set selection to the last row on the screen.
  const topRowIndex = this.scrollPort_.getTopRowIndex();
  const bottomRowIndex = this.scrollPort_.getBottomRowIndex(topRowIndex);
  const selection = this.document_.getSelection();
  if (!this.syncCursorPosition_() && selection) {
    selection.collapse(this.getRowNode(bottomRowIndex));
  }
};

/**
 * Clients can override this if they want to provide an options page.
 */
hterm.Terminal.prototype.onOpenOptionsPage = function() {};


/**
 * Called when user selects to open the options page.
 */
hterm.Terminal.prototype.onOpenOptionsPage_ = function() {
  this.onOpenOptionsPage();
};


/**
 * Client should override this if they want to handle tmux control mode DCS
 * sequence (see https://github.com/tmux/tmux/wiki/Control-Mode). We split the
 * sequence data into lines and call this once per line (the '\r\n' ending will
 * be stripped). When the sequence ends with ST, we call this once with null.
 *
 * @param {?string} line The line or null when the sequence ends.
 */
hterm.Terminal.prototype.onTmuxControlModeLine = function(line) {};
// SOURCE FILE: hterm/js/hterm_terminal_io.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Input/Output interface used by commands to communicate with the terminal.
 *
 * Commands like `nassh` and `crosh` receive an instance of this class as
 * part of their argv object.  This allows them to write to and read from the
 * terminal without exposing them to an entire hterm.Terminal instance.
 *
 * The active command must override the sendString() method
 * of this class in order to receive keystrokes and send output to the correct
 * destination.
 *
 * Isolating commands from the terminal provides the following benefits:
 * - Provides a mechanism to save and restore sendString
 *   handler when invoking subcommands (see the push() and pop() methods).
 * - The isolation makes it easier to make changes in Terminal and supporting
 *   classes without affecting commands.
 * - In The Future commands may run in web workers where they would only be able
 *   to talk to a Terminal instance through an IPC mechanism.
 *
 * @param {!hterm.Terminal} terminal
 * @constructor
 */
hterm.Terminal.IO = function(terminal) {
  this.terminal_ = terminal;

  // The IO object to restore on IO.pop().
  this.previousIO_ = null;

  // Any data this object accumulated while not active.
  this.buffered_ = '';

  // Decoder to maintain UTF-8 decode state.
  this.textDecoder_ = new TextDecoder();
};

/**
 * Show the terminal overlay.
 *
 * @see hterm.NotificationCenter.show
 * @param {string|!Node} message The message to display.
 * @param {?number=} timeout How long to time to wait before hiding.
 */
hterm.Terminal.IO.prototype.showOverlay = function(
    message, timeout = undefined) {
  this.terminal_.showOverlay(message, timeout);
};

/**
 * Hide the current overlay immediately.
 *
 * @see hterm.NotificationCenter.hide
 */
hterm.Terminal.IO.prototype.hideOverlay = function() {
  this.terminal_.hideOverlay();
};

/**
 * Open an frame in the current terminal window, pointed to the specified
 * url.
 *
 * Eventually we'll probably need size/position/decoration options.
 * The user should also be able to move/resize the frame.
 *
 * @param {string} url The URL to load in the frame.
 * @param {!Object=} options Optional frame options.  Not implemented.
 * @return {!hterm.Frame}
 */
hterm.Terminal.IO.prototype.createFrame = function(url, options = undefined) {
  return new hterm.Frame(this.terminal_, url, options);
};

/**
 * Create a new hterm.Terminal.IO instance and make it active on the Terminal
 * object associated with this instance.
 *
 * This is used to pass control of the terminal IO off to a subcommand.  The
 * IO.pop() method can be used to restore control when the subcommand completes.
 *
 * @return {!hterm.Terminal.IO} The new foreground IO instance.
 */
hterm.Terminal.IO.prototype.push = function() {
  const io = new this.constructor(this.terminal_);

  io.columnCount = this.columnCount;
  io.rowCount = this.rowCount;

  io.previousIO_ = this.terminal_.io;
  this.terminal_.io = io;

  return io;
};

/**
 * Restore the Terminal's previous IO object.
 *
 * We'll flush out any queued data.
 */
hterm.Terminal.IO.prototype.pop = function() {
  this.terminal_.io = this.previousIO_;
  this.previousIO_.flush();
};

/**
 * Flush accumulated data.
 *
 * If we're not the active IO, the connected process might still be writing
 * data to us, but we won't be displaying it.  Flush any buffered data now.
 */
hterm.Terminal.IO.prototype.flush = function() {
  if (this.buffered_) {
    this.terminal_.interpret(this.buffered_);
    this.buffered_ = '';
  }
};

/**
 * Called when data needs to be sent to the current command.
 *
 * Clients should override this to receive notification of pending data.
 *
 * @param {string} string The data to send.
 */
hterm.Terminal.IO.prototype.sendString = function(string) {
  // Override this.
  console.log('Unhandled sendString: ' + string);
};

/**
 * Receives notification when the terminal is resized.
 *
 * @param {number} width The new terminal width.
 * @param {number} height The new terminal height.
 */
hterm.Terminal.IO.prototype.onTerminalResize_ = function(width, height) {
  // eslint-disable-next-line consistent-this
  let obj = this;
  while (obj) {
    obj.columnCount = width;
    obj.rowCount = height;
    obj = obj.previousIO_;
  }

  this.onTerminalResize(width, height);
};

/**
 * Called when terminal size is changed.
 *
 * Clients should override this to receive notification of resize.
 *
 * @param {string|number} width The new terminal width.
 * @param {string|number} height The new terminal height.
 */
hterm.Terminal.IO.prototype.onTerminalResize = function(width, height) {
  // Override this.
};

/**
 * Write UTF-8 data to the terminal.
 *
 * @param {!ArrayBuffer|!Array<number>} buffer The UTF-8 data to print.
 */
hterm.Terminal.IO.prototype.writeUTF8 = function(buffer) {
  // Handle array buffers & typed arrays by normalizing into a typed array.
  const u8 = new Uint8Array(buffer);
  const string = this.textDecoder_.decode(u8, {stream: true});
  this.print(string);
};

/**
 * Write UTF-8 data to the terminal followed by CRLF.
 *
 * @param {!ArrayBuffer|!Array<number>} buffer The UTF-8 data to print.
 */
hterm.Terminal.IO.prototype.writelnUTF8 = function(buffer) {
  this.writeUTF8(buffer);
  // We need to use writeUTF8 to make sure we flush the decoder state.
  this.writeUTF8([0x0d, 0x0a]);
};

/**
 * Write a UTF-16 JavaScript string to the terminal.
 *
 * @param {string} string The string to print.
 */
hterm.Terminal.IO.prototype.print =
hterm.Terminal.IO.prototype.writeUTF16 = function(string) {
  // If another process has the foreground IO, buffer new data sent to this IO
  // (since it's in the background).  When we're made the foreground IO again,
  // we'll flush everything.
  if (this.terminal_.io != this) {
    this.buffered_ += string;
    return;
  }

  this.terminal_.interpret(string);
};

/**
 * Print a UTF-16 JavaScript string to the terminal followed by a newline.
 *
 * @param {string} string The string to print.
 */
hterm.Terminal.IO.prototype.println =
hterm.Terminal.IO.prototype.writelnUTF16 = function(string) {
  this.print(string + '\r\n');
};
// SOURCE FILE: hterm/js/hterm_text_attributes.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Constructor for TextAttribute objects.
 *
 * These objects manage a set of text attributes such as foreground/
 * background color, bold, faint, italic, blink, underline, and strikethrough.
 *
 * TextAttribute instances can be used to construct a DOM container implementing
 * the current attributes, or to test an existing DOM container for
 * compatibility with the current attributes.
 *
 * @constructor
 * @param {!Document=} document The parent document to use when creating
 *     new DOM containers.
 */
hterm.TextAttributes = function(document) {
  this.document_ = document;
  // These variables contain the source of the color as either:
  // SRC_DEFAULT  (use context default)
  // rgb(...)     (true color form)
  // number       (representing the index from color palette to use)
  /** @type {symbol|string|number} */
  this.foregroundSource = this.SRC_DEFAULT;
  /** @type {symbol|string|number} */
  this.backgroundSource = this.SRC_DEFAULT;
  /** @type {symbol|string|number} */
  this.underlineSource = this.SRC_DEFAULT;

  // These properties cache the value in the color table, but foregroundSource
  // and backgroundSource contain the canonical values.
  /** @type {symbol|string} */
  this.foreground = this.DEFAULT_COLOR;
  /** @type {symbol|string} */
  this.background = this.DEFAULT_COLOR;
  /** @type {symbol|string} */
  this.underlineColor = this.DEFAULT_COLOR;

  /** @const */
  this.defaultForeground = 'rgb(var(--hterm-foreground-color))';
  /** @const */
  this.defaultBackground = 'rgb(var(--hterm-background-color))';

  // Any attributes added here that do not default to falsey (e.g. undefined or
  // null) require a bit more care.  createContainer has to always attach the
  // attribute so matchesContainer can work correctly.
  this.bold = false;
  this.faint = false;
  this.italic = false;
  this.blink = false;
  this.underline = false;
  this.strikethrough = false;
  this.inverse = false;
  this.invisible = false;
  this.wcNode = false;
  this.asciiNode = true;
  /** @type {?string} */
  this.tileData = null;
  /** @type {?string} */
  this.uri = null;
  /** @type {?string} */
  this.uriId = null;

  /**
   * Colors set different to defaults in lib.colors.stockPalette.
   *
   * @type {!Array<string>}
   */
  this.colorPaletteOverrides = [];
};

/**
 * If false, we ignore the bold attribute.
 *
 * This is used for fonts that have a bold version that is a different size
 * than the normal weight version.
 */
hterm.TextAttributes.prototype.enableBold = true;

/**
 * If true, use bright colors (if available) for bold text.
 *
 * This setting is independent of the enableBold setting.
 */
hterm.TextAttributes.prototype.enableBoldAsBright = true;

/**
 * A sentinel constant meaning "whatever the default color is in this context".
 */
hterm.TextAttributes.prototype.DEFAULT_COLOR = Symbol('DEFAULT_COLOR');

/**
 * A constant string used to specify that source color is context default.
 */
hterm.TextAttributes.prototype.SRC_DEFAULT = Symbol('SRC_DEFAULT');

/**
 * The document object which should own the DOM nodes created by this instance.
 *
 * @param {!Document} document The parent document.
 */
hterm.TextAttributes.prototype.setDocument = function(document) {
  this.document_ = document;
};

/**
 * Create a deep copy of this object.
 *
 * @return {!hterm.TextAttributes} A deep copy of this object.
 */
hterm.TextAttributes.prototype.clone = function() {
  const rv = new hterm.TextAttributes();

  for (const key in this) {
    rv[key] = this[key];
  }

  rv.colorPaletteOverrides = this.colorPaletteOverrides.concat();
  return rv;
};

/**
 * Reset the current set of attributes.
 *
 * This does not affect the palette.  Use terminal.resetColorPalette() for
 * that.  It also doesn't affect the tile data, it's not meant to.
 */
hterm.TextAttributes.prototype.reset = function() {
  this.foregroundSource = this.SRC_DEFAULT;
  this.backgroundSource = this.SRC_DEFAULT;
  this.underlineSource = this.SRC_DEFAULT;
  this.foreground = this.DEFAULT_COLOR;
  this.background = this.DEFAULT_COLOR;
  this.underlineColor = this.DEFAULT_COLOR;
  this.bold = false;
  this.faint = false;
  this.italic = false;
  this.blink = false;
  this.underline = false;
  this.strikethrough = false;
  this.inverse = false;
  this.invisible = false;
  this.wcNode = false;
  this.asciiNode = true;
  this.uri = null;
  this.uriId = null;
};

/**
 * Test if the current attributes describe unstyled text.
 *
 * @return {boolean} True if the current attributes describe unstyled text.
 */
hterm.TextAttributes.prototype.isDefault = function() {
  return (this.foregroundSource == this.SRC_DEFAULT &&
          this.backgroundSource == this.SRC_DEFAULT &&
          !this.bold &&
          !this.faint &&
          !this.italic &&
          !this.blink &&
          !this.underline &&
          !this.strikethrough &&
          !this.inverse &&
          !this.invisible &&
          !this.wcNode &&
          this.asciiNode &&
          this.tileData == null &&
          this.uri == null);
};

/**
 * Create a DOM container (a span or a text node) with a style to match the
 * current set of attributes.
 *
 * This method will create a plain text node if the text is unstyled, or
 * an HTML span if the text is styled.  Due to lack of monospace wide character
 * fonts on certain systems (e.g. ChromeOS), we need to put each wide character
 * in a span of CSS class '.wc-node' which has double column width.
 * Each vt_tiledata tile is also represented by a span with a single
 * character, with CSS classes '.tile' and '.tile_<glyph number>'.
 *
 * @param {string=} textContent Optional text content for the new container.
 * @return {!Node} An HTML span or text nodes styled to match the current
 *     attributes.
 */
hterm.TextAttributes.prototype.createContainer = function(textContent = '') {
  if (this.isDefault()) {
    // Only attach attributes where we need an explicit default for the
    // matchContainer logic below.
    const node = this.document_.createTextNode(textContent);
    node.asciiNode = true;
    return node;
  }

  const span = this.document_.createElement('span');
  const style = span.style;
  const classes = [];

  if (this.foreground != this.DEFAULT_COLOR) {
    style.color = this.foreground.toString();
  }

  if (this.background != this.DEFAULT_COLOR) {
    style.backgroundColor = this.background.toString();
    // Make sure the span fills the line when changing the background color.
    // Otherwise, if the line happens to be taller than this glyph, we won't
    // fill the color completely leading to visual gaps.
    style.display = 'inline-block';
  }

  if (this.enableBold && this.bold) {
    style.fontWeight = 'bold';
  }

  if (this.faint) {
    span.faint = true;
  }

  if (this.italic) {
    style.fontStyle = 'italic';
  }

  if (this.blink) {
    classes.push('blink-node');
    span.blinkNode = true;
  }

  let textDecorationLine = '';
  span.underline = this.underline;
  if (this.underline) {
    textDecorationLine += ' underline';
    style.textDecorationStyle = this.underline;
  }
  if (this.underlineColor != this.DEFAULT_COLOR) {
    style.textDecorationColor = this.underlineColor;
  }
  if (this.strikethrough) {
    textDecorationLine += ' line-through';
    span.strikethrough = true;
  }
  if (textDecorationLine) {
    style.textDecorationLine = textDecorationLine;
  }

  if (this.wcNode) {
    classes.push('wc-node');
    span.wcNode = true;
  }
  span.asciiNode = this.asciiNode;

  if (this.tileData != null) {
    classes.push('tile');
    classes.push('tile_' + this.tileData);
    span.tileNode = true;
  }

  if (textContent) {
    span.textContent = textContent;
  }

  if (this.uri) {
    classes.push('uri-node');
    span.uriId = this.uriId;
    span.title = this.uri;
    span.addEventListener('click', hterm.openUrl.bind(this, this.uri));
  }

  if (classes.length) {
    span.className = classes.join(' ');
  }

  return span;
};

/**
 * Tests if the provided object (string, span or text node) has the same
 * style as this TextAttributes instance.
 *
 * This indicates that text with these attributes could be inserted directly
 * into the target DOM node.
 *
 * For the purposes of this method, a string is considered a text node.
 *
 * @param {string|!Node} obj The object to test.
 * @return {boolean} True if the provided container has the same style as
 *     this attributes instance.
 */
hterm.TextAttributes.prototype.matchesContainer = function(obj) {
  if (typeof obj == 'string' || obj.nodeType == Node.TEXT_NODE) {
    return this.isDefault();
  }

  const style = obj.style;

  // We don't want to put multiple characters in a wcNode or a tile.
  // See the comments in createContainer.
  // For attributes that default to false, we do not require that obj have them
  // declared, so always normalize them using !! (to turn undefined into false)
  // in the compares below.
  return (!(this.wcNode || obj.wcNode) &&
          this.asciiNode == obj.asciiNode &&
          !(this.tileData != null || obj.tileNode) &&
          this.uriId == obj.uriId &&
          (this.foreground == this.DEFAULT_COLOR &&
           style.color == '') &&
          (this.background == this.DEFAULT_COLOR &&
           style.backgroundColor == '') &&
          (this.underlineColor == this.DEFAULT_COLOR &&
           style.textDecorationColor == '') &&
          (this.enableBold && this.bold) == !!style.fontWeight &&
          this.blink == !!obj.blinkNode &&
          this.italic == !!style.fontStyle &&
          this.underline == obj.underline &&
          !!this.strikethrough == !!obj.strikethrough);
};

/**
 * Updates foreground and background properties based on current indices and
 * other state.
 */
hterm.TextAttributes.prototype.syncColors = function() {
  function getBrightIndex(i) {
    if (i < 8) {
      // If the color is from the lower half of the ANSI 16, add 8.
      return i + 8;
    }

    // If it's not from the 16 color palette, ignore bold requests.  This
    // matches the behavior of gnome-terminal.
    return i;
  }

  // Expand the default color as makes sense.
  const getDefaultColor = (color, defaultColor) => {
    return color == this.DEFAULT_COLOR ? defaultColor : color;
  };

  // TODO(joelhockey): Remove redundant `typeof foo == 'number'` when
  // externs/es6.js is updated.
  // https://github.com/google/closure-compiler/pull/3472.

  if (this.enableBoldAsBright && this.bold) {
    if (typeof this.foregroundSource == 'number' &&
        Number.isInteger(this.foregroundSource)) {
      this.foregroundSource = getBrightIndex(this.foregroundSource);
    }
  }

  /**
   * @param {symbol|string|number} source
   * @return {symbol|string}
   */
  const colorFromSource = (source) => {
    if (source == this.SRC_DEFAULT) {
      return this.DEFAULT_COLOR;
    } else if (typeof source == 'number' && Number.isInteger(source)) {
      return `rgb(var(--hterm-color-${source}))`;
    } else {
      return source.toString();
    }
  };

  this.foreground = colorFromSource(this.foregroundSource);

  if (this.faint) {
    if (this.foreground == this.DEFAULT_COLOR) {
      this.foreground = 'rgba(var(--hterm-foreground-color), 0.67)';
    } else if (typeof this.foregroundSource == 'number' &&
        Number.isInteger(this.foregroundSource)) {
      this.foreground =
          `rgba(var(--hterm-color-${this.foregroundSource}), 0.67)`;
    } else {
      this.foreground = lib.colors.setAlpha(this.foreground.toString(), 0.67);
    }
  }

  this.background = colorFromSource(this.backgroundSource);

  // Once we've processed the bold-as-bright and faint attributes, swap.
  // This matches xterm/gnome-terminal.
  if (this.inverse) {
    const swp = getDefaultColor(this.foreground, this.defaultForeground);
    this.foreground = getDefaultColor(this.background, this.defaultBackground);
    this.background = swp;
  }

  // Process invisible settings last to keep it simple.
  if (this.invisible) {
    this.foreground = this.background;
  }

  this.underlineColor = colorFromSource(this.underlineSource);
};

/**
 * Static method used to test if the provided objects (strings, spans or
 * text nodes) have the same style.
 *
 * For the purposes of this method, a string is considered a text node.
 *
 * @param {string|!Node} obj1 An object to test.
 * @param {string|!Node} obj2 Another object to test.
 * @return {boolean} True if the containers have the same style.
 */
hterm.TextAttributes.containersMatch = function(obj1, obj2) {
  if (typeof obj1 == 'string') {
    return hterm.TextAttributes.containerIsDefault(obj2);
  }

  if (obj1.nodeType != obj2.nodeType) {
    return false;
  }

  if (obj1.nodeType == Node.TEXT_NODE) {
    return true;
  }

  const style1 = obj1.style;
  const style2 = obj2.style;

  return (style1.color == style2.color &&
          style1.backgroundColor == style2.backgroundColor &&
          style1.backgroundColor == style2.backgroundColor &&
          style1.fontWeight == style2.fontWeight &&
          style1.fontStyle == style2.fontStyle &&
          style1.textDecoration == style2.textDecoration &&
          style1.textDecorationColor == style2.textDecorationColor &&
          style1.textDecorationStyle == style2.textDecorationStyle &&
          style1.textDecorationLine == style2.textDecorationLine);
};

/**
 * Static method to test if a given DOM container represents unstyled text.
 *
 * For the purposes of this method, a string is considered a text node.
 *
 * @param {string|!Node} obj An object to test.
 * @return {boolean} True if the object is unstyled.
 */
hterm.TextAttributes.containerIsDefault = function(obj) {
  return typeof obj == 'string' || obj.nodeType == Node.TEXT_NODE;
};

/**
 * Static method to get the column width of a node's textContent.
 *
 * @param {!Node} node The HTML element to get the width of textContent
 *     from.
 * @return {number} The column width of the node's textContent.
 */
hterm.TextAttributes.nodeWidth = function(node) {
  if (!node.asciiNode) {
    return lib.wc.strWidth(node.textContent);
  } else {
    return node.textContent.length;
  }
};

/**
 * Static method to get the substr of a node's textContent.  The start index
 * and substr width are computed in column width.
 *
 * @param {!Node} node The HTML element to get the substr of textContent
 *     from.
 * @param {number} start The starting offset in column width.
 * @param {number=} width The width to capture in column width.
 * @return {string} The extracted substr of the node's textContent.
 */
hterm.TextAttributes.nodeSubstr = function(node, start, width) {
  if (!node.asciiNode) {
    return lib.wc.substr(node.textContent, start, width);
  } else {
    return node.textContent.substr(start, width);
  }
};

/**
 * Static method to get the substring based of a node's textContent.  The
 * start index of end index are computed in column width.
 *
 * @param {!Element} node The HTML element to get the substr of textContent
 *     from.
 * @param {number} start The starting offset in column width.
 * @param {number} end The ending offset in column width.
 * @return {string} The extracted substring of the node's textContent.
 */
hterm.TextAttributes.nodeSubstring = function(node, start, end) {
  if (!node.asciiNode) {
    return lib.wc.substring(node.textContent, start, end);
  } else {
    return node.textContent.substring(start, end);
  }
};

/**
 * Static method to split a string into contiguous runs of single-width
 * characters and runs of double-width characters.
 *
 * @param {string} str The string to split.
 * @return {!Array<{str:string, wcNode:boolean, asciiNode:boolean,
 *     wcStrWidth:number}>} An array of objects that contain substrings of str,
 *     where each substring is either a contiguous runs of single-width
 *     characters or a double-width character.  For objects that contain a
 *     double-width character, its wcNode property is set to true.  For objects
 *     that contain only ASCII content, its asciiNode property is set to true.
 */
hterm.TextAttributes.splitWidecharString = function(str) {
  const asciiRegex = new RegExp('^[\u0020-\u007f]*$');

  // Optimize for printable ASCII.  This should only take ~1ms/MB, but cuts out
  // 40ms+/MB when true.  If we're dealing with UTF8, then it's already slow.
  if (asciiRegex.test(str)) {
    return [{
      str: str,
      wcNode: false,
      asciiNode: true,
      wcStrWidth: str.length,
    }];
  }

  // Iterate over each grapheme and merge them together in runs of similar
  // strings.  We want to keep narrow and wide characters separate, and the
  // fewer overall segments we have, the faster we'll be as processing each
  // segment in the terminal print code is a bit slow.
  const segmenter = new Intl.Segmenter(undefined, {type: 'grapheme'});
  const it = segmenter.segment(str);

  const rv = [];
  for (const segment of it) {
    const grapheme = segment.segment;
    const isAscii = asciiRegex.test(grapheme);
    const strWidth = isAscii ? 1 : lib.wc.strWidth(grapheme);
    const isWideChar =
        isAscii ? false : (lib.wc.charWidth(grapheme.codePointAt(0)) == 2);

    // Only merge non-wide characters together.  Every wide character needs to
    // be separate so it can get a unique container.
    const prev = rv[rv.length - 1];
    if (prev && !isWideChar && !prev.wcNode) {
      prev.str += grapheme;
      prev.wcStrWidth += strWidth;
      prev.asciiNode = prev.asciiNode && isAscii;
    } else {
      rv.push({
        str: grapheme,
        wcNode: isWideChar,
        asciiNode: isAscii,
        wcStrWidth: strWidth,
      });
    }
  }

  return rv;
};
// SOURCE FILE: hterm/js/hterm_vt.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Constructor for the VT escape sequence interpreter.
 *
 * The interpreter operates on a terminal object capable of performing cursor
 * move operations, painting characters, etc.
 *
 * This interpreter is intended to be compatible with xterm, though it
 * ignores some of the more esoteric escape sequences.
 *
 * Control sequences are documented in hterm/docs/ControlSequences.md.
 *
 * @param {!hterm.Terminal} terminal Terminal to use with the interpreter.
 * @constructor
 */
hterm.VT = function(terminal) {
  /**
   * The display terminal object associated with this virtual terminal.
   */
  this.terminal = terminal;

  terminal.onMouse = this.onTerminalMouse_.bind(this);
  this.mouseReport = this.MOUSE_REPORT_DISABLED;
  this.mouseCoordinates = this.MOUSE_COORDINATES_X10;

  // We only want to report mouse moves between cells, not between pixels.
  this.lastMouseDragResponse_ = null;

  // Parse state left over from the last parse.  You should use the parseState
  // instance passed into your parse routine, rather than reading
  // this.parseState_ directly.
  this.parseState_ = new hterm.VT.ParseState(this.parseUnknown_);

  // Any "leading modifiers" for the escape sequence, such as '?', ' ', or the
  // other modifiers handled in this.parseCSI_.
  this.leadingModifier_ = '';

  // Any "trailing modifiers".  Same character set as a leading modifier,
  // except these are found after the numeric arguments.
  this.trailingModifier_ = '';

  // Whether or not to respect the escape codes for setting terminal width.
  this.allowColumnWidthChanges_ = false;

  // The amount of time we're willing to wait for the end of an OSC sequence.
  this.oscTimeLimit_ = 20000;

  /**
   * Whether to accept the 8-bit control characters.
   *
   * An 8-bit control character is one with the eighth bit set.  These
   * didn't work on 7-bit terminals so they all have two byte equivalents.
   * Most hosts still only use the two-byte versions.
   *
   * We ignore 8-bit control codes by default.  This is in order to avoid
   * issues with "accidental" usage of codes that need to be terminated.
   * The "accident" usually involves cat'ing binary data.
   */
  this.enable8BitControl = false;

  /**
   * Whether to allow the OSC 52 sequence to write to the system clipboard.
   */
  this.enableClipboardWrite = true;

  /**
   * Respect the host's attempt to change the cursor blink status using
   * the DEC Private mode 12.
   */
  this.enableDec12 = false;

  /**
   * Respect the host's attempt to clear the scrollback buffer using CSI-J-3.
   */
  this.enableCsiJ3 = true;

  /**
   * If true, emit warnings when we encounter a control character or escape
   * sequence that we don't recognize or explicitly ignore.
   *
   * We disable this by default as the console logging can be expensive when
   * dumping binary files (e.g. `cat /dev/zero`) to the point where you can't
   * recover w/out restarting.
   */
  this.warnUnimplemented = false;

  /**
   * The set of available character maps (used by G0...G3 below).
   */
  this.characterMaps = new hterm.VT.CharacterMaps();

  /**
   * The default G0...G3 character maps.
   * We default to the US/ASCII map everywhere as that aligns with other
   * terminals, and it makes it harder to accidentally switch to the graphics
   * character map (Ctrl+N).  Any program that wants to use the graphics map
   * will usually select it anyways since there's no guarantee what state any
   * of the maps are in at any particular time.
   */
  this.G0 = this.G1 = this.G2 = this.G3 =
      this.characterMaps.getMap('B');

  /**
   * The 7-bit visible character set.
   *
   * This is a mapping from inbound data to display glyph.  The GL set
   * contains the 94 bytes from 0x21 to 0x7e.
   *
   * The default GL set is 'B', US ASCII.
   */
  this.GL = 'G0';

  /**
   * The 8-bit visible character set.
   *
   * This is a mapping from inbound data to display glyph.  The GR set
   * contains the 94 bytes from 0xa1 to 0xfe.
   */
  this.GR = 'G0';

  /**
   * The current encoding of the terminal.
   *
   * We only support ECMA-35 and UTF-8, so go with a boolean here.
   * The encoding can be locked too.
   */
  this.codingSystemUtf8_ = false;
  this.codingSystemLocked_ = false;

  // Construct a regular expression to match the known one-byte control chars.
  // This is used in parseUnknown_ to quickly scan a string for the next
  // control character.
  this.cc1Pattern_ = null;
  this.updateEncodingState_();
};

/**
 * No mouse events.
 */
hterm.VT.prototype.MOUSE_REPORT_DISABLED = 0;

/**
 * DECSET mode 9.
 *
 * Report mouse down events only.
 */
hterm.VT.prototype.MOUSE_REPORT_PRESS = 1;

/**
 * DECSET mode 1000.
 *
 * Report mouse down/up events only.
 */
hterm.VT.prototype.MOUSE_REPORT_CLICK = 2;

/**
 * DECSET mode 1002.
 *
 * Report mouse down/up and movement while a button is down.
 */
hterm.VT.prototype.MOUSE_REPORT_DRAG = 3;

/**
 * DEC mode for X10 coorindates (the default).
 */
hterm.VT.prototype.MOUSE_COORDINATES_X10 = 0;

/**
 * DEC mode 1005 for UTF-8 coorindates.
 */
hterm.VT.prototype.MOUSE_COORDINATES_UTF8 = 1;

/**
 * DEC mode 1006 for SGR coorindates.
 */
hterm.VT.prototype.MOUSE_COORDINATES_SGR = 2;

/**
 * ParseState constructor.
 *
 * This object tracks the current state of the parse.  It has fields for the
 * current buffer, position in the buffer, and the parse function.
 *
 * @param {function(!hterm.VT.ParseState)=} defaultFunction The default parser
 *     function.
 * @param {?string=} buf Optional string to use as the current buffer.
 * @constructor
 */
hterm.VT.ParseState = function(defaultFunction, buf = null) {
  this.defaultFunction = defaultFunction;
  this.buf = buf;
  this.pos = 0;
  this.func = defaultFunction;
  this.args = [];
  // Whether any of the arguments in the args array have subarguments.
  // e.g. All CSI sequences are integer arguments separated by semi-colons,
  // so subarguments are further colon separated.
  this.subargs = null;
};

/**
 * Reset the parser function, buffer, and position.
 *
 * @param {string=} buf Optional string to use as the current buffer.
 */
hterm.VT.ParseState.prototype.reset = function(buf = '') {
  this.resetParseFunction();
  this.resetBuf(buf);
  this.resetArguments();
};

/**
 * Reset the parser function only.
 */
hterm.VT.ParseState.prototype.resetParseFunction = function() {
  this.func = this.defaultFunction;
};

/**
 * Reset the buffer and position only.
 *
 * @param {?string=} buf Optional new value for buf, defaults to null.
 */
hterm.VT.ParseState.prototype.resetBuf = function(buf = null) {
  this.buf = buf;
  this.pos = 0;
};

/**
 * Reset the arguments list only.
 *
 * Typically we reset arguments before parsing a sequence that uses them rather
 * than always trying to make sure they're in a good state.  This can lead to
 * confusion during debugging where args from a previous sequence appear to be
 * "sticking around" in other sequences (which in reality don't use args).
 *
 * @param {string=} arg_zero Optional initial value for args[0].
 */
hterm.VT.ParseState.prototype.resetArguments = function(arg_zero = undefined) {
  this.args.length = 0;
  if (arg_zero !== undefined) {
    this.args[0] = arg_zero;
  }
};

/**
 * Parse an argument as an integer.
 *
 * This assumes the inputs are already in the proper format.  e.g. This won't
 * handle non-numeric arguments.
 *
 * An "0" argument is treated the same as "" which means the default value will
 * be applied.  This is what most terminal sequences expect.
 *
 * @param {string} argstr The argument to parse directly.
 * @param {number=} defaultValue Default value if argstr is empty.
 * @return {number} The parsed value.
 */
hterm.VT.ParseState.prototype.parseInt = function(argstr, defaultValue) {
  if (defaultValue === undefined) {
    defaultValue = 0;
  }

  if (argstr) {
    const ret = parseInt(argstr, 10);
    // An argument of zero is treated as the default value.
    return ret == 0 ? defaultValue : ret;
  }
  return defaultValue;
};

/**
 * Get an argument as an integer.
 *
 * @param {number} argnum The argument number to retrieve.
 * @param {number=} defaultValue Default value if the argument is empty.
 * @return {number} The parsed value.
 */
hterm.VT.ParseState.prototype.iarg = function(argnum, defaultValue) {
  return this.parseInt(this.args[argnum], defaultValue);
};

/**
 * Check whether an argument has subarguments.
 *
 * @param {number} argnum The argument number to check.
 * @return {boolean} Whether the argument has subarguments.
 */
hterm.VT.ParseState.prototype.argHasSubargs = function(argnum) {
  return !!(this.subargs && this.subargs[argnum]);
};

/**
 * Mark an argument as having subarguments.
 *
 * @param {number} argnum The argument number that has subarguments.
 */
hterm.VT.ParseState.prototype.argSetSubargs = function(argnum) {
  if (this.subargs === null) {
    this.subargs = {};
  }
  this.subargs[argnum] = true;
};

/**
 * Advance the parse position.
 *
 * @param {number} count The number of bytes to advance.
 */
hterm.VT.ParseState.prototype.advance = function(count) {
  this.pos += count;
};

/**
 * Return the remaining portion of the buffer without affecting the parse
 * position.
 *
 * @return {string} The remaining portion of the buffer.
 */
hterm.VT.ParseState.prototype.peekRemainingBuf = function() {
  return this.buf.substr(this.pos);
};

/**
 * Return the next single character in the buffer without affecting the parse
 * position.
 *
 * @return {string} The next character in the buffer.
 */
hterm.VT.ParseState.prototype.peekChar = function() {
  return this.buf.substr(this.pos, 1);
};

/**
 * Return the next single character in the buffer and advance the parse
 * position one byte.
 *
 * @return {string} The next character in the buffer.
 */
hterm.VT.ParseState.prototype.consumeChar = function() {
  return this.buf.substr(this.pos++, 1);
};

/**
 * Return true if the buffer is empty, or the position is past the end.
 *
 * @return {boolean} Whether the buffer is empty, or the position is past the
 *     end.
 */
hterm.VT.ParseState.prototype.isComplete = function() {
  return this.buf == null || this.buf.length <= this.pos;
};

/**
 * Reset the parse state.
 */
hterm.VT.prototype.resetParseState = function() {
  this.parseState_.reset();
};

/**
 * Reset the VT back to baseline state.
 */
hterm.VT.prototype.reset = function() {
  this.G0 = this.G1 = this.G2 = this.G3 =
      this.characterMaps.getMap('B');

  this.GL = 'G0';
  this.GR = 'G0';

  this.mouseReport = this.MOUSE_REPORT_DISABLED;
  this.mouseCoordinates = this.MOUSE_COORDINATES_X10;
  this.lastMouseDragResponse_ = null;
};

/**
 * Handle terminal mouse events.
 *
 * See the "Mouse Tracking" section of [xterm].
 *
 * @param {!MouseEvent} e
 */
hterm.VT.prototype.onTerminalMouse_ = function(e) {
  // Short circuit a few events to avoid unnecessary processing.
  if (this.mouseReport == this.MOUSE_REPORT_DISABLED) {
    return;
  } else if (this.mouseReport != this.MOUSE_REPORT_DRAG &&
             e.type == 'mousemove') {
    return;
  }

  // Temporary storage for our response.
  let response;

  // Modifier key state.
  let mod = 0;
  if (this.mouseReport != this.MOUSE_REPORT_PRESS) {
    if (e.shiftKey) {
      mod |= 4;
    }
    if (e.metaKey) {
      mod |= 8;
    }
    if (e.ctrlKey) {
      mod |= 16;
    }
  }

  // X & Y coordinate reporting.
  let x;
  let y;
  // Normally X10 has a limit of 255, but since we only want to emit UTF-8 valid
  // streams, we limit ourselves to 127 to avoid setting the 8th bit.  If we do
  // re-enable this, we should re-enable the hterm_vt_tests.js too.
  let limit = 127;
  switch (this.mouseCoordinates) {
    case this.MOUSE_COORDINATES_UTF8:
      // UTF-8 mode is the same as X10 but with higher limits.
      limit = 2047;
    case this.MOUSE_COORDINATES_X10:
      // X10 reports coordinates by encoding into strings.
      x = String.fromCharCode(lib.f.clamp(e.terminalColumn + 32, 32, limit));
      y = String.fromCharCode(lib.f.clamp(e.terminalRow + 32, 32, limit));
      break;
    case this.MOUSE_COORDINATES_SGR:
      // SGR reports coordinates by transmitting the numbers directly.
      x = e.terminalColumn;
      y = e.terminalRow;
      break;
  }

  let b;
  switch (e.type) {
    case 'wheel':
      // Mouse wheel is treated as button 1 or 2 plus an additional 64.
      b = (((e.deltaY * -1) > 0) ? 0 : 1) + 64;
      b |= mod;
      if (this.mouseCoordinates == this.MOUSE_COORDINATES_SGR) {
        response = `\x1b[<${b};${x};${y}M`;
      } else {
        // X10 based modes (including UTF8) add 32 for legacy encoding reasons.
        response = '\x1b[M' + String.fromCharCode(b + 32) + x + y;
      }

      // Keep the terminal from scrolling.
      e.preventDefault();
      break;

    case 'mousedown':
      // Buttons are encoded as button number.
      b = Math.min(e.button, 2);
      // X10 based modes (including UTF8) add 32 for legacy encoding reasons.
      if (this.mouseCoordinates != this.MOUSE_COORDINATES_SGR) {
        b += 32;
      }

      // And mix in the modifier keys.
      b |= mod;

      if (this.mouseCoordinates == this.MOUSE_COORDINATES_SGR) {
        response = `\x1b[<${b};${x};${y}M`;
      } else {
        response = '\x1b[M' + String.fromCharCode(b) + x + y;
      }
      break;

    case 'mouseup':
      if (this.mouseReport != this.MOUSE_REPORT_PRESS) {
        if (this.mouseCoordinates == this.MOUSE_COORDINATES_SGR) {
          // SGR mode can report the released button.
          response = `\x1b[<${e.button};${x};${y}m`;
        } else {
          // X10 mode has no indication of which button was released.
          response = '\x1b[M\x23' + x + y;
        }
      }
      break;

    case 'mousemove':
      if (this.mouseReport == this.MOUSE_REPORT_DRAG && e.buttons) {
        // Standard button bits.  The XTerm protocol only reports the first
        // button press (e.g. if left & right are pressed, right is ignored),
        // and it only supports the first three buttons.  If none of them are
        // pressed, then XTerm flags it as a release.  We'll do the same.
        // X10 based modes (including UTF8) add 32 for legacy encoding reasons.
        b = this.mouseCoordinates == this.MOUSE_COORDINATES_SGR ? 0 : 32;

        // Priority here matches XTerm: left, middle, right.
        if (e.buttons & 0x1) {
          // Report left button.
          b += 0;
        } else if (e.buttons & 0x4) {
          // Report middle button.
          b += 1;
        } else if (e.buttons & 0x2) {
          // Report right button.
          b += 2;
        } else {
          // Release higher buttons.
          b += 3;
        }

        // Add 32 to indicate mouse motion.
        b += 32;

        // And mix in the modifier keys.
        b |= mod;

        if (this.mouseCoordinates == this.MOUSE_COORDINATES_SGR) {
          response = `\x1b[<${b};${x};${y}M`;
        } else {
          response = '\x1b[M' + String.fromCharCode(b) + x + y;
        }

        // If we were going to report the same cell because we moved pixels
        // within, suppress the report.  This is what xterm does and cuts
        // down on duplicate messages.
        if (this.lastMouseDragResponse_ == response) {
          response = '';
        } else {
          this.lastMouseDragResponse_ = response;
        }
      }

      break;

    case 'click':
    case 'dblclick':
      break;

    default:
      console.error('Unknown mouse event: ' + e.type, e);
      break;
  }

  if (response) {
    this.terminal.io.sendString(response);
  }
};

/**
 * Interpret a string of characters, displaying the results on the associated
 * terminal object.
 *
 * @param {string} buf The buffer to interpret.
 */
hterm.VT.prototype.interpret = function(buf) {
  this.parseState_.resetBuf(buf);

  while (!this.parseState_.isComplete()) {
    const func = this.parseState_.func;
    const pos = this.parseState_.pos;
    const buf = this.parseState_.buf;

    this.parseState_.func.call(this, this.parseState_);

    if (this.parseState_.func == func && this.parseState_.pos == pos &&
        this.parseState_.buf == buf) {
      throw new Error('Parser did not alter the state!');
    }
  }
};

/**
 * Set the encoding of the terminal.
 *
 * @param {string} encoding The name of the encoding to set.
 */
hterm.VT.prototype.setEncoding = function(encoding) {
  switch (encoding) {
    default:
      console.warn('Invalid value for "terminal-encoding": ' + encoding);
      // Fall through.
    case 'iso-2022':
      this.codingSystemUtf8_ = false;
      this.codingSystemLocked_ = false;
      break;
    case 'utf-8-locked':
      this.codingSystemUtf8_ = true;
      this.codingSystemLocked_ = true;
      break;
    case 'utf-8':
      this.codingSystemUtf8_ = true;
      this.codingSystemLocked_ = false;
      break;
  }

  this.updateEncodingState_();
};

/**
 * Refresh internal state when the encoding changes.
 */
hterm.VT.prototype.updateEncodingState_ = function() {
  // If we're in UTF8 mode, don't suport 8-bit escape sequences as we'll never
  // see those -- everything should be UTF8!
  const cc1 = Object.keys(hterm.VT.CC1)
      .filter((e) => !this.codingSystemUtf8_ || e.charCodeAt() < 0x80)
      .map((e) => '\\x' + lib.f.zpad(e.charCodeAt().toString(16), 2))
      .join('');
  this.cc1Pattern_ = new RegExp(`[${cc1}]`);
};

/**
 * The default parse function.
 *
 * This will scan the string for the first 1-byte control character (C0/C1
 * characters from [CTRL]).  Any plain text coming before the code will be
 * printed to the terminal, then the control character will be dispatched.
 *
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.prototype.parseUnknown_ = function(parseState) {
  const print = (str) => {
    if (!this.codingSystemUtf8_ && this[this.GL].GL) {
      str = this[this.GL].GL(str);
    }

    this.terminal.print(str);
  };

  // Search for the next contiguous block of plain text.
  const buf = parseState.peekRemainingBuf();
  const nextControl = buf.search(this.cc1Pattern_);

  if (nextControl == 0) {
    // We've stumbled right into a control character.
    this.dispatch('CC1', buf.substr(0, 1), parseState);
    parseState.advance(1);
    return;
  }

  if (nextControl == -1) {
    // There are no control characters in this string.
    print(buf);
    parseState.reset();
    return;
  }

  print(buf.substr(0, nextControl));
  this.dispatch('CC1', buf.substr(nextControl, 1), parseState);
  parseState.advance(nextControl + 1);
};

/**
 * Parse a Control Sequence Introducer code and dispatch it.
 *
 * See [CSI] for some useful information about these codes.
 *
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.prototype.parseCSI_ = function(parseState) {
  const ch = parseState.peekChar();
  const args = parseState.args;

  const finishParsing = () => {
    // Resetting the arguments isn't strictly necessary, but it makes debugging
    // less confusing (otherwise args will stick around until the next sequence
    // that needs arguments).
    parseState.resetArguments();
    // We need to clear subargs since we explicitly set it.
    parseState.subargs = null;
    parseState.resetParseFunction();
  };

  if (ch >= '@' && ch <= '~') {
    // This is the final character.
    this.dispatch('CSI', this.leadingModifier_ + this.trailingModifier_ + ch,
                  parseState);
    finishParsing();

  } else if (ch == ';') {
    // Parameter delimiter.
    if (this.trailingModifier_) {
      // Parameter delimiter after the trailing modifier.  That's a paddlin'.
      finishParsing();

    } else {
      if (!args.length) {
        // They omitted the first param, we need to supply it.
        args.push('');
      }

      args.push('');
    }

  } else if (ch >= '0' && ch <= '9' || ch == ':') {
    // Next byte in the current parameter.

    if (this.trailingModifier_) {
      // Numeric parameter after the trailing modifier.  That's a paddlin'.
      finishParsing();
    } else {
      if (!args.length) {
        args[0] = ch;
      } else {
        args[args.length - 1] += ch;
      }

      // Possible sub-parameters.
      if (ch == ':') {
        parseState.argSetSubargs(args.length - 1);
      }
    }

  } else if (ch >= ' ' && ch <= '?') {
    // Modifier character.
    if (!args.length) {
      this.leadingModifier_ += ch;
    } else {
      this.trailingModifier_ += ch;
    }

  } else if (this.cc1Pattern_.test(ch)) {
    // Control character.
    this.dispatch('CC1', ch, parseState);

  } else {
    // Unexpected character in sequence, bail out.
    finishParsing();
  }

  parseState.advance(1);
};

/**
 * Parse a Device Control String and dispatch it.
 *
 * See [DCS] for some useful information about these codes.
 *
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.prototype.parseDCS_ = function(parseState) {
  const ch = parseState.peekChar();
  const args = parseState.args;

  const finishParsing = () => {
    // Resetting the arguments isn't strictly necessary, but it makes debugging
    // less confusing (otherwise args will stick around until the next sequence
    // that needs arguments).
    parseState.resetArguments();
    parseState.resetParseFunction();
  };

  if (ch >= '@' && ch <= '~') {
    // This is the final character.
    parseState.advance(1);
    this.dispatch('DCS', this.leadingModifier_ + this.trailingModifier_ + ch,
                  parseState);

    // Don't reset the parser function if it's being handled.
    // The dispatched method must handle ST termination itself.
    if (parseState.func === this.parseDCS_) {
      parseState.func = this.parseUntilStringTerminator_;
    }
    return;

  } else if (ch === ';') {
    // Parameter delimiter.
    if (this.trailingModifier_) {
      // Parameter delimiter after the trailing modifier.  Abort parsing.
      finishParsing();

    } else {
      if (!args.length) {
        // They omitted the first param, we need to supply it.
        args.push('');
      }

      args.push('');
    }

  } else if (ch >= '0' && ch <= '9') {
    // Next byte in the current parameter.

    if (this.trailingModifier_) {
      // Numeric parameter after the trailing modifier.  Abort parsing.
      finishParsing();
    } else {
      if (!args.length) {
        args[0] = ch;
      } else {
        args[args.length - 1] += ch;
      }
    }

  } else if (ch >= ' ' && ch <= '?') {
    // Modifier character.
    if (!args.length) {
      this.leadingModifier_ += ch;
    } else {
      this.trailingModifier_ += ch;
    }

  } else if (this.cc1Pattern_.test(ch)) {
    // Control character.
    this.dispatch('CC1', ch, parseState);

  } else {
    // Unexpected character in sequence, bail out.
    finishParsing();
  }

  parseState.advance(1);
};


/**
 * Parse tmux control mode data, which is terminated with ST.
 *
 * @param {!hterm.VT.ParseState} parseState
 */
hterm.VT.prototype.parseTmuxControlModeData_ = function(parseState) {
  const args = parseState.args;
  if (!args.length) {
    // This stores the unfinished line.
    args[0] = '';
  }
  // Consume as many lines as possible.
  while (true) {
    const args0InitialLength = args[0].length;
    const buf = args[0] + parseState.peekRemainingBuf();
    args[0] = '';

    // Find either ST or line break.
    // eslint-disable-next-line no-control-regex
    const index = buf.search(/\x1b\\|\r\n/);
    if (index === -1) {
      parseState.args[0] = buf;
      parseState.resetBuf();
      return;
    }

    const data = buf.slice(0, index);
    parseState.advance(index + 2 - args0InitialLength);

    // Check if buf ends with ST.
    if (buf[index] === '\x1b') {
      if (data) {
        console.error(`unexpected data before ST: ${data}`);
      }
      this.terminal.onTmuxControlModeLine(null);
      parseState.resetArguments();
      parseState.resetParseFunction();
      return;
    }

    // buf ends with line break.
    this.terminal.onTmuxControlModeLine(data);
  }
};

/**
 * Skip over the string until the next String Terminator (ST, 'ESC \') or
 * Bell (BEL, '\x07').
 *
 * The string is accumulated in parseState.args[0].  Make sure to reset the
 * arguments (with parseState.resetArguments) before starting the parse.
 *
 * You can detect that parsing in complete by checking that the parse
 * function has changed back to the default parse function.
 *
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 * @return {boolean} If true, parsing is ongoing or complete.  If false, we've
 *     exceeded the max string sequence.
 */
hterm.VT.prototype.parseUntilStringTerminator_ = function(parseState) {
  let buf = parseState.peekRemainingBuf();
  const args = parseState.args;
  // Since we might modify parse state buffer locally, if we want to advance
  // the parse state buffer later on, we need to know how many chars we added.
  let bufInserted = 0;

  if (!args.length) {
    args[0] = '';
    args[1] = new Date().getTime();
  } else {
    // If our saved buffer ends with an escape, it's because we were hoping
    // it's an ST split across two buffers.  Move it from our saved buffer
    // to the start of our current buffer for processing anew.
    if (args[0].slice(-1) == '\x1b') {
      args[0] = args[0].slice(0, -1);
      buf = '\x1b' + buf;
      bufInserted = 1;
    }
  }

  // eslint-disable-next-line no-control-regex
  const nextTerminator = buf.search(/[\x1b\x07]/);
  const terminator = buf[nextTerminator];
  let foundTerminator;

  // If the next escape we see is not a start of a ST, fall through.  This will
  // either be invalid (embedded escape), or we'll queue it up (wait for \\).
  if (terminator == '\x1b' && buf[nextTerminator + 1] != '\\') {
    foundTerminator = false;
  } else {
    foundTerminator = (nextTerminator != -1);
  }

  if (!foundTerminator) {
    // No terminator here, have to wait for the next string.

    args[0] += buf;

    let abortReason;

    // Special case: If our buffering happens to split the ST (\e\\), we have to
    // buffer the content temporarily.  So don't reject a trailing escape here,
    // instead we let it timeout or be rejected in the next pass.
    if (terminator == '\x1b' && nextTerminator != buf.length - 1) {
      abortReason = 'embedded escape: ' + nextTerminator;
    }

    // We stuffed a Date into args[1] above.
    const elapsedTime = new Date().getTime() - args[1];
    if (elapsedTime > this.oscTimeLimit_) {
      abortReason = `timeout expired: ${elapsedTime}s`;
    }

    if (abortReason) {
      if (this.warnUnimplemented) {
        console.log('parseUntilStringTerminator_: aborting: ' + abortReason,
                    args[0]);
      }
      parseState.reset(args[0]);
      return false;
    }

    parseState.advance(buf.length - bufInserted);
    return true;
  }

  args[0] += buf.substr(0, nextTerminator);

  parseState.resetParseFunction();
  parseState.advance(nextTerminator +
                     (terminator == '\x1b' ? 2 : 1) - bufInserted);

  return true;
};

/**
 * Dispatch to the function that handles a given CC1, ESC, or CSI or VT52 code.
 *
 * @param {string} type
 * @param {string} code
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.prototype.dispatch = function(type, code, parseState) {
  const handler = hterm.VT[type][code];
  if (!handler) {
    if (this.warnUnimplemented) {
      console.warn(`Unknown ${type} code: ${JSON.stringify(code)}`);
    }
    return;
  }

  if (handler == hterm.VT.ignore) {
    if (this.warnUnimplemented) {
      console.warn(`Ignored ${type} code: ${JSON.stringify(code)}`);
    }
    return;
  }

  if (parseState.subargs && !handler.supportsSubargs) {
    if (this.warnUnimplemented) {
      console.warn(`Ignored ${type} code w/subargs: ${JSON.stringify(code)}`);
    }
    return;
  }

  if (type == 'CC1' && code > '\x7f' && !this.enable8BitControl) {
    // It's kind of a hack to put this here, but...
    //
    // If we're dispatching a 'CC1' code, and it's got the eighth bit set,
    // but we're not supposed to handle 8-bit codes?  Just ignore it.
    //
    // This prevents an errant (DCS, '\x90'), (OSC, '\x9d'), (PM, '\x9e') or
    // (APC, '\x9f') from locking up the terminal waiting for its expected
    // (ST, '\x9c') or (BEL, '\x07').
    console.warn('Ignoring 8-bit control code: 0x' +
                 code.charCodeAt(0).toString(16));
    return;
  }

  handler.apply(this, [parseState, code]);
};

/**
 * Set one of the ANSI defined terminal mode bits.
 *
 * Invoked in response to SM/RM.
 *
 * Unexpected and unimplemented values are silently ignored.
 *
 * @param {string} code
 * @param {boolean} state
 */
hterm.VT.prototype.setANSIMode = function(code, state) {
  if (code == 4) {  // Insert Mode (IRM)
    this.terminal.setInsertMode(state);
  } else if (code == 20) {  // Automatic Newline (LNM)
    this.terminal.setAutoCarriageReturn(state);
  } else if (this.warnUnimplemented) {
    console.warn('Unimplemented ANSI Mode: ' + code);
  }
};

/**
 * Set or reset one of the DEC Private modes.
 *
 * Invoked in response to DECSET/DECRST.
 *
 * @param {string} code
 * @param {boolean} state
 */
hterm.VT.prototype.setDECMode = function(code, state) {
  switch (parseInt(code, 10)) {
    case 1:  // DECCKM
      this.terminal.keyboard.applicationCursor = state;
      break;

    case 3:  // DECCOLM
      if (this.allowColumnWidthChanges_) {
        this.terminal.setWidth(state ? 132 : 80);

        this.terminal.clearHome();
        this.terminal.setVTScrollRegion(null, null);
      }
      break;

    case 5:  // DECSCNM
      this.terminal.setReverseVideo(state);
      break;

    case 6:  // DECOM
      this.terminal.setOriginMode(state);
      break;

    case 7:  // DECAWM
      this.terminal.setWraparound(state);
      break;

    case 9:  // Report on mouse down events only (X10).
      this.mouseReport = (
          state ? this.MOUSE_REPORT_PRESS : this.MOUSE_REPORT_DISABLED);
      this.terminal.syncMouseStyle();
      break;

    case 12:  // Start blinking cursor
      if (this.enableDec12) {
        this.terminal.setCursorBlink(state ? 'y' : 'n');
      }
      break;

    case 25:  // DECTCEM
      this.terminal.setCursorVisible(state);
      break;

    case 30:  // Show scrollbar
      this.terminal.setScrollbarVisible(state);
      break;

    case 40:  // Allow 80 - 132 (DECCOLM) Mode
      this.terminal.allowColumnWidthChanges_ = state;
      break;

    case 45:  // Reverse-wraparound Mode
      this.terminal.setReverseWraparound(state);
      break;

    case 67:  // Backarrow key sends backspace (DECBKM)
      this.terminal.keyboard.backspaceSendsBackspace = state;
      break;

    case 1000:  // Report on mouse clicks only (X11).
      this.mouseReport = (
          state ? this.MOUSE_REPORT_CLICK : this.MOUSE_REPORT_DISABLED);
      this.terminal.syncMouseStyle();
      break;

    case 1002:  // Report on mouse clicks and drags
      this.mouseReport = (
          state ? this.MOUSE_REPORT_DRAG : this.MOUSE_REPORT_DISABLED);
      this.terminal.syncMouseStyle();
      break;

    case 1004:  // Report on window focus change.
      this.terminal.reportFocus = state;
      break;

    case 1005:  // Extended coordinates in UTF-8 mode.
      this.mouseCoordinates = (
          state ? this.MOUSE_COORDINATES_UTF8 : this.MOUSE_COORDINATES_X10);
      break;

    case 1006:  // Extended coordinates in SGR mode.
      this.mouseCoordinates = (
          state ? this.MOUSE_COORDINATES_SGR : this.MOUSE_COORDINATES_X10);
      break;

    case 1007:  // Enable Alternate Scroll Mode.
      this.terminal.scrollWheelArrowKeys_ = state;
      break;

    case 1010:  // Scroll to bottom on tty output
      this.terminal.scrollOnOutput = state;
      break;

    case 1011:  // Scroll to bottom on key press
      this.terminal.scrollOnKeystroke = state;
      break;

    case 47:  // Use Alternate Screen Buffer
    case 1047:
      this.terminal.setAlternateMode(state);
      break;

    case 1048:  // Save cursor as in DECSC.
      if (state) {
        this.terminal.saveCursorAndState();
      } else {
        this.terminal.restoreCursorAndState();
      }
      break;

    case 1049:  // 1047 + 1048 + clear.
      if (state) {
        this.terminal.saveCursorAndState();
        this.terminal.setAlternateMode(state);
        this.terminal.clear();
      } else {
        this.terminal.setAlternateMode(state);
        this.terminal.restoreCursorAndState();
      }

      break;

    case 2004:  // Bracketed paste mode.
      this.terminal.setBracketedPaste(state);
      break;

    default:
      if (this.warnUnimplemented) {
        console.warn('Unimplemented DEC Private Mode: ' + code);
      }
      break;
  }
};

/**
 * Function shared by control characters and escape sequences that are
 * ignored.
 */
hterm.VT.ignore = function() {};

/**
 * Collection of control characters expressed in a single byte.
 *
 * This includes the characters from the C0 and C1 sets (see [CTRL]) that we
 * care about.  Two byte versions of the C1 codes are defined in the
 * hterm.VT.ESC collection.
 *
 * The 'CC1' mnemonic here refers to the fact that these are one-byte Control
 * Codes.  It's only used in this source file and not defined in any of the
 * referenced documents.
 */
hterm.VT.CC1 = {};

/**
 * Collection of two-byte and three-byte sequences starting with ESC.
 */
hterm.VT.ESC = {};

/**
 * Collection of CSI (Control Sequence Introducer) sequences.
 *
 * These sequences begin with 'ESC [', and may take zero or more arguments.
 */
hterm.VT.CSI = {};

/**
 * Collection of DCS (Device Control String) sequences.
 *
 * These sequences begin with 'ESC P', may take zero or more arguments, and are
 * normally terminated by ST.  Registered handlers have to consume the ST if
 * they change the active parser func.
 */
hterm.VT.DCS = {};

/**
 * Collection of OSC (Operating System Control) sequences.
 *
 * These sequences begin with 'ESC ]', followed by a function number and a
 * string terminated by either ST or BEL.
 */
hterm.VT.OSC = {};

/**
 * Collection of VT52 sequences.
 *
 * When in VT52 mode, other sequences are disabled.
 */
hterm.VT.VT52 = {};

/**
 * Null (NUL).
 *
 * Silently ignored.
 */
hterm.VT.CC1['\x00'] = hterm.VT.ignore;

/**
 * Enquiry (ENQ).
 *
 * Transmit answerback message.
 *
 * The default answerback message in xterm is an empty string, so we just
 * ignore this.
 */
hterm.VT.CC1['\x05'] = hterm.VT.ignore;

/**
 * Ring Bell (BEL).
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x07'] = function() {
  this.terminal.ringBell();
};

/**
 * Backspace (BS).
 *
 * Move the cursor to the left one character position, unless it is at the
 * left margin, in which case no action occurs.
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x08'] = function() {
  this.terminal.cursorLeft(1);
};

/**
 * Horizontal Tab (HT).
 *
 * Move the cursor to the next tab stop, or to the right margin if no further
 * tab stops are present on the line.
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x09'] = function() {
  this.terminal.forwardTabStop();
};

/**
 * Line Feed (LF).
 *
 * This code causes a line feed or a new line operation.  See Automatic
 * Newline (LNM).
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x0a'] = function() {
  this.terminal.formFeed();
};

/**
 * Vertical Tab (VT).
 *
 * Interpreted as LF.
 */
hterm.VT.CC1['\x0b'] = hterm.VT.CC1['\x0a'];

/**
 * Form Feed (FF).
 *
 * Interpreted as LF.
 */
hterm.VT.CC1['\x0c'] = hterm.VT.CC1['\x0a'];

/**
 * Carriage Return (CR).
 *
 * Move cursor to the left margin on the current line.
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x0d'] = function() {
  this.terminal.setCursorColumn(0);
};

/**
 * Shift Out (SO), aka Lock Shift 0 (LS1).
 *
 * @this {!hterm.VT}
 * Invoke G1 character set in GL.
 */
hterm.VT.CC1['\x0e'] = function() {
  this.GL = 'G1';
};

/**
 * Shift In (SI), aka Lock Shift 0 (LS0).
 *
 * Invoke G0 character set in GL.
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x0f'] = function() {
  this.GL = 'G0';
};

/**
 * Transmit On (XON).
 *
 * Not currently implemented.
 *
 * TODO(rginda): Implement?
 */
hterm.VT.CC1['\x11'] = hterm.VT.ignore;

/**
 * Transmit Off (XOFF).
 *
 * Not currently implemented.
 *
 * TODO(rginda): Implement?
 */
hterm.VT.CC1['\x13'] = hterm.VT.ignore;

/**
 * Cancel (CAN).
 *
 * If sent during a control sequence, the sequence is immediately terminated
 * and not executed.
 *
 * It also causes the error character to be displayed.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x18'] = function(parseState) {
  // If we've shifted in the G1 character set, shift it back out to
  // the default character set.
  if (this.GL == 'G1') {
    this.GL = 'G0';
  }
  parseState.resetParseFunction();
  this.terminal.print('?');
};

/**
 * Substitute (SUB).
 *
 * Interpreted as CAN.
 */
hterm.VT.CC1['\x1a'] = hterm.VT.CC1['\x18'];

/**
 * Escape (ESC).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x1b'] = function(parseState) {
  function parseESC(parseState) {
    const ch = parseState.consumeChar();

    if (ch == '\x1b') {
      return;
    }

    this.dispatch('ESC', ch, parseState);

    if (parseState.func == parseESC) {
      parseState.resetParseFunction();
    }
  }

  parseState.func = parseESC;
};

/**
 * Delete (DEL).
 */
hterm.VT.CC1['\x7f'] = hterm.VT.ignore;

// 8 bit control characters and their two byte equivalents, below...

/**
 * Index (IND).
 *
 * Like newline, only keep the X position
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x84'] =
hterm.VT.ESC['D'] = function() {
  this.terminal.lineFeed();
};

/**
 * Next Line (NEL).
 *
 * Like newline, but doesn't add lines.
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x85'] =
hterm.VT.ESC['E'] = function() {
  this.terminal.setCursorColumn(0);
  this.terminal.cursorDown(1);
};

/**
 * Horizontal Tabulation Set (HTS).
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x88'] =
hterm.VT.ESC['H'] = function() {
  this.terminal.setTabStop(this.terminal.getCursorColumn());
};

/**
 * Reverse Index (RI).
 *
 * Move up one line.
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x8d'] =
hterm.VT.ESC['M'] = function() {
  this.terminal.reverseLineFeed();
};

/**
 * Single Shift 2 (SS2).
 *
 * Select of G2 Character Set for the next character only.
 *
 * Not currently implemented.
 */
hterm.VT.CC1['\x8e'] =
hterm.VT.ESC['N'] = hterm.VT.ignore;

/**
 * Single Shift 3 (SS3).
 *
 * Select of G3 Character Set for the next character only.
 *
 * Not currently implemented.
 */
hterm.VT.CC1['\x8f'] =
hterm.VT.ESC['O'] = hterm.VT.ignore;

/**
 * Device Control String (DCS).
 *
 * Indicate a DCS sequence.  See Device-Control functions in [XTERM].
 *
 * TODO(rginda): Consider implementing DECRQSS, the rest don't seem applicable.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x90'] =
hterm.VT.ESC['P'] = function(parseState) {
  parseState.resetArguments();
  this.leadingModifier_ = '';
  this.trailingModifier_ = '';
  parseState.func = this.parseDCS_;
};

/**
 * Start of Guarded Area (SPA).
 *
 * Will not implement.
 */
hterm.VT.CC1['\x96'] =
hterm.VT.ESC['V'] = hterm.VT.ignore;

/**
 * End of Guarded Area (EPA).
 *
 * Will not implement.
 */
hterm.VT.CC1['\x97'] =
hterm.VT.ESC['W'] = hterm.VT.ignore;

/**
 * Start of String (SOS).
 *
 * Will not implement.
 */
hterm.VT.CC1['\x98'] =
hterm.VT.ESC['X'] = hterm.VT.ignore;

/**
 * Single Character Introducer (SCI, also DECID).
 *
 * Return Terminal ID.  Obsolete form of 'ESC [ c' (DA).
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x9a'] =
hterm.VT.ESC['Z'] = function() {
  this.terminal.io.sendString('\x1b[?1;2c');
};

/**
 * Control Sequence Introducer (CSI).
 *
 * The lead into most escape sequences.  See [CSI].
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x9b'] =
hterm.VT.ESC['['] = function(parseState) {
  parseState.resetArguments();
  this.leadingModifier_ = '';
  this.trailingModifier_ = '';
  parseState.func = this.parseCSI_;
};

/**
 * String Terminator (ST).
 *
 * Used to terminate DCS/OSC/PM/APC commands which may take string arguments.
 *
 * We don't directly handle it here, as it's only used to terminate other
 * sequences.  See the 'parseUntilStringTerminator_' method.
 */
hterm.VT.CC1['\x9c'] =
hterm.VT.ESC['\\'] = hterm.VT.ignore;

/**
 * Operating System Command (OSC).
 *
 * Commands relating to the operating system.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x9d'] =
hterm.VT.ESC[']'] = function(parseState) {
  parseState.resetArguments();

  /**
   * @param {!hterm.VT.ParseState} parseState The current parse state.
   */
  function parseOSC(parseState) {
    if (!this.parseUntilStringTerminator_(parseState)) {
      // The string sequence was too long.
      return;
    }

    if (parseState.func == parseOSC) {
      // We're not done parsing the string yet.
      return;
    }

    // We're done.
    const ary = parseState.args[0].match(/^(\d+);?(.*)$/);
    if (ary) {
      parseState.args[0] = ary[2];
      this.dispatch('OSC', ary[1], parseState);
    } else {
      console.warn('Invalid OSC: ' + JSON.stringify(parseState.args[0]));
    }

    // Resetting the arguments isn't strictly necessary, but it makes debugging
    // less confusing (otherwise args will stick around until the next sequence
    // that needs arguments).
    parseState.resetArguments();
  }

  parseState.func = parseOSC;
};

/**
 * Privacy Message (PM).
 *
 * Will not implement.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x9e'] =
hterm.VT.ESC['^'] = function(parseState) {
  parseState.resetArguments();
  parseState.func = this.parseUntilStringTerminator_;
};

/**
 * Application Program Control (APC).
 *
 * Will not implement.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x9f'] =
hterm.VT.ESC['_'] = function(parseState) {
  parseState.resetArguments();
  parseState.func = this.parseUntilStringTerminator_;
};

/**
 * ESC \x20 - Unclear to me where these originated, possibly in xterm.
 *
 * Not currently implemented:
 *   ESC \x20 F - Select 7 bit escape codes in responses (S7C1T).
 *   ESC \x20 G - Select 8 bit escape codes in responses (S8C1T).
 *                NB: We currently assume S7C1T always.
 *
 * Will not implement:
 *   ESC \x20 L - Set ANSI conformance level 1.
 *   ESC \x20 M - Set ANSI conformance level 2.
 *   ESC \x20 N - Set ANSI conformance level 3.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.ESC['\x20'] = function(parseState) {
  parseState.func = function(parseState) {
    const ch = parseState.consumeChar();
    if (this.warnUnimplemented) {
      console.warn('Unimplemented sequence: ESC 0x20 ' + ch);
    }
    parseState.resetParseFunction();
  };
};

/**
 * DEC 'ESC #' sequences.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.ESC['#'] = function(parseState) {
  parseState.func = function(parseState) {
    const ch = parseState.consumeChar();
    if (ch == '8') {
      // DEC Screen Alignment Test (DECALN).
      this.terminal.setCursorPosition(0, 0);
      this.terminal.fill('E');
    }

    parseState.resetParseFunction();
  };
};

/**
 * Designate Other Coding System (DOCS).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.ESC['%'] = function(parseState) {
  parseState.func = function(parseState) {
    let ch = parseState.consumeChar();

    // If we've locked the encoding, then just eat the bytes and return.
    if (this.codingSystemLocked_) {
      if (ch == '/') {
        parseState.consumeChar();
      }
      parseState.resetParseFunction();
      return;
    }

    // Process the encoding requests.
    switch (ch) {
      case '@':
        // Switch to ECMA 35.
        this.setEncoding('iso-2022');
        break;

      case 'G':
        // Switch to UTF-8.
        this.setEncoding('utf-8');
        break;

      case '/':
        // One way transition to something else.
        ch = parseState.consumeChar();
        switch (ch) {
          case 'G':  // UTF-8 Level 1.
          case 'H':  // UTF-8 Level 2.
          case 'I':  // UTF-8 Level 3.
            // We treat all UTF-8 levels the same.
            this.setEncoding('utf-8-locked');
            break;

          default:
            if (this.warnUnimplemented) {
              console.warn('Unknown ESC % / argument: ' + JSON.stringify(ch));
            }
            break;
        }
        break;

      default:
        if (this.warnUnimplemented) {
          console.warn('Unknown ESC % argument: ' + JSON.stringify(ch));
        }
        break;
    }

    parseState.resetParseFunction();
  };
};

/**
 * Character Set Selection (SCS).
 *
 *   ESC ( Ps - Set G0 character set (VT100).
 *   ESC ) Ps - Set G1 character set (VT220).
 *   ESC * Ps - Set G2 character set (VT220).
 *   ESC + Ps - Set G3 character set (VT220).
 *   ESC - Ps - Set G1 character set (VT300).
 *   ESC . Ps - Set G2 character set (VT300).
 *   ESC / Ps - Set G3 character set (VT300).
 *
 * All other sequences are echoed to the terminal.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 * @param {string} code
 */
hterm.VT.ESC['('] =
hterm.VT.ESC[')'] =
hterm.VT.ESC['*'] =
hterm.VT.ESC['+'] =
hterm.VT.ESC['-'] =
hterm.VT.ESC['.'] =
hterm.VT.ESC['/'] = function(parseState, code) {
  parseState.func = function(parseState) {
    if (parseState.peekChar() === '\x1b') {
      // Invalid SCS sequence, treat this ESC as a new sequence starting.
      parseState.resetParseFunction();
      return;
    }
    const ch = parseState.consumeChar();
    const map = this.characterMaps.getMap(ch);
    if (map !== undefined) {
      if (code == '(') {
        this.G0 = map;
      } else if (code == ')' || code == '-') {
        this.G1 = map;
      } else if (code == '*' || code == '.') {
        this.G2 = map;
      } else if (code == '+' || code == '/') {
        this.G3 = map;
      }
    } else if (this.warnUnimplemented) {
      console.log('Invalid character set for "' + code + '": ' + ch);
    }

    parseState.resetParseFunction();
  };
};

/**
 * Back Index (DECBI).
 *
 * VT420 and up.  Not currently implemented.
 */
hterm.VT.ESC['6'] = hterm.VT.ignore;

/**
 * Save Cursor (DECSC).
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['7'] = function() {
  this.terminal.saveCursorAndState();
};

/**
 * Restore Cursor (DECRC).
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['8'] = function() {
  this.terminal.restoreCursorAndState();
};

/**
 * Forward Index (DECFI).
 *
 * VT210 and up.  Not currently implemented.
 */
hterm.VT.ESC['9'] = hterm.VT.ignore;

/**
 * Application keypad (DECKPAM).
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['='] = function() {
  console.log('application keypad was turned on');
  this.terminal.keyboard.applicationKeypad = true;
};

/**
 * Normal keypad (DECKPNM).
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['>'] = function() {
  console.log('application keypad was turned on');
  this.terminal.keyboard.applicationKeypad = false;
};

/**
 * Cursor to lower left corner of screen.
 *
 * Will not implement.
 *
 * This is only recognized by xterm when the hpLowerleftBugCompat resource is
 * set.
 */
hterm.VT.ESC['F'] = hterm.VT.ignore;

/**
 * Full Reset (RIS).
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['c'] = function() {
  this.terminal.reset();
};

/**
 * Set window name. This is used by tmux (maybe also screen) and it is different
 * from window title. See the "NAMES AND TITLES" section in `man tmux`.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.ESC['k'] = function(parseState) {
  function parse(parseState) {
    if (!this.parseUntilStringTerminator_(parseState)) {
      // The string sequence was too long.
      return;
    }

    if (parseState.func === parse) {
      // We're not done parsing the string yet.
      return;
    }

    this.terminal.setWindowName(parseState.args[0]);
    parseState.resetArguments();
  }

  parseState.resetArguments();
  parseState.func = parse;
};

/**
 * Memory lock/unlock.
 *
 * Will not implement.
 */
hterm.VT.ESC['l'] =
hterm.VT.ESC['m'] = hterm.VT.ignore;

/**
 * Lock Shift 2 (LS2)
 *
 * Invoke the G2 Character Set as GL.
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['n'] = function() {
  this.GL = 'G2';
};

/**
 * Lock Shift 3 (LS3)
 *
 * Invoke the G3 Character Set as GL.
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['o'] = function() {
  this.GL = 'G3';
};

/**
 * Lock Shift 2, Right (LS3R)
 *
 * Invoke the G3 Character Set as GR.
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['|'] = function() {
  this.GR = 'G3';
};

/**
 * Lock Shift 2, Right (LS2R)
 *
 * Invoke the G2 Character Set as GR.
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['}'] = function() {
  this.GR = 'G2';
};

/**
 * Lock Shift 1, Right (LS1R)
 *
 * Invoke the G1 Character Set as GR.
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['~'] = function() {
  this.GR = 'G1';
};

/**
 * Tmux control mode if the args === ['1000'].
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.DCS['p'] = function(parseState) {
  if (parseState.args.length === 1 && parseState.args[0] === '1000') {
    parseState.resetArguments();
    parseState.func = this.parseTmuxControlModeData_;
  }
};

/**
 * Change icon name and window title.
 *
 * We only change the window title.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['0'] = function(parseState) {
  this.terminal.setWindowTitle(parseState.args[0]);
};

/**
 * Change window title.
 */
hterm.VT.OSC['2'] = hterm.VT.OSC['0'];

/**
 * Set/read color palette.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['4'] = function(parseState) {
  // Args come in as a single 'index1;rgb1 ... ;indexN;rgbN' string.
  // We split on the semicolon and iterate through the pairs.
  const args = parseState.args[0].split(';');

  const pairCount = Math.floor(args.length / 2);
  const responseArray = [];

  for (let pairNumber = 0; pairNumber < pairCount; ++pairNumber) {
    const colorIndex = parseInt(args[pairNumber * 2], 10);
    let colorValue = args[pairNumber * 2 + 1];

    if (colorIndex >= lib.colors.stockPalette.length) {
      continue;
    }

    if (colorValue == '?') {
      // '?' means we should report back the current color value.
      colorValue = lib.colors.rgbToX11(
          this.terminal.getColorPalette(colorIndex));
      if (colorValue) {
        responseArray.push(colorIndex + ';' + colorValue);
      }

      continue;
    }

    colorValue = lib.colors.x11ToCSS(colorValue);
    if (colorValue) {
      this.terminal.setColorPalette(colorIndex, colorValue);
    }
  }

  if (responseArray.length) {
    this.terminal.io.sendString('\x1b]4;' + responseArray.join(';') + '\x07');
  }
};

/**
 * Hyperlinks.
 *
 * The first argument is optional and colon separated:
 *   id=<id>
 * The second argument is the link itself.
 *
 * Calling with a non-blank URI starts it.  A blank URI stops it.
 *
 * https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['8'] = function(parseState) {
  const args = parseState.args[0].split(';');
  let id = null;
  let uri = null;

  if (args.length != 2 || args[1].length == 0) {
    // Reset link.
  } else {
    // Pull out any colon separated parameters in the first argument.
    const params = args[0].split(':');
    id = '';
    params.forEach((param) => {
      const idx = param.indexOf('=');
      if (idx == -1) {
        return;
      }

      const key = param.slice(0, idx);
      const value = param.slice(idx + 1);
      switch (key) {
        case 'id':
          id = value;
          break;
        default:
          // Ignore unknown keys.
          break;
      }
    });

    // The URI is in the second argument.
    uri = args[1];
  }

  const attrs = this.terminal.getTextAttributes();
  attrs.uri = uri;
  attrs.uriId = id;
};

/**
 * iTerm2 growl notifications.
 *
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['9'] = function(parseState) {
  // This just dumps the entire string as the message.
  hterm.notify({'body': parseState.args[0]});
};

/**
 * Change VT100 text foreground color.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['10'] = function(parseState) {
  // Args come in as a single string, but extra args will chain to the following
  // OSC sequences.
  const args = parseState.args[0].split(';');
  if (!args) {
    return;
  }

  const colorX11 = lib.colors.x11ToCSS(args.shift());
  if (colorX11) {
    this.terminal.setForegroundColor(colorX11);
  }

  if (args.length > 0) {
    parseState.args[0] = args.join(';');
    hterm.VT.OSC['11'].apply(this, [parseState]);
  }
};

/**
 * Change VT100 text background color.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['11'] = function(parseState) {
  // Args come in as a single string, but extra args will chain to the following
  // OSC sequences.
  const args = parseState.args[0].split(';');
  if (!args) {
    return;
  }

  const colorX11 = lib.colors.x11ToCSS(args.shift());
  if (colorX11) {
    this.terminal.setBackgroundColor(colorX11);
  }

  if (args.length > 0) {
    parseState.args[0] = args.join(';');
    hterm.VT.OSC['12'].apply(this, [parseState]);
  }
};

/**
 * Change text cursor color.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['12'] = function(parseState) {
  // Args come in as a single string, but extra args will chain to the following
  // OSC sequences.
  const args = parseState.args[0].split(';');
  if (!args) {
    return;
  }

  const colorX11 = lib.colors.x11ToCSS(args.shift());
  if (colorX11) {
    this.terminal.setCursorColor(colorX11);
  }

  /* Note: If we support OSC 13+, we'd chain it here.
  if (args.length > 0) {
    parseState.args[0] = args.join(';');
    hterm.VT.OSC['13'].apply(this, [parseState]);
  }
  */
};

/**
 * Set the cursor shape.
 *
 * Parameter is expected to be in the form "CursorShape=number", where number is
 * one of:
 *
 *   0 - Block
 *   1 - I-Beam
 *   2 - Underline
 *
 * This is a bit of a de-facto standard supported by iTerm 2 and Konsole.  See
 * also: DECSCUSR.
 *
 * Invalid numbers will restore the cursor to the block shape.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['50'] = function(parseState) {
  const args = parseState.args[0].match(/CursorShape=(.)/i);
  if (!args) {
    console.warn('Could not parse OSC 50 args: ' + parseState.args[0]);
    return;
  }

  switch (args[1]) {
    case '0': this.terminal.setCursorShape('b'); break;
    case '1': this.terminal.setCursorShape('|'); break;
    case '2': this.terminal.setCursorShape('_'); break;

    default: console.warn('invalid cursor shape: ', args[1]);
  }
};

/**
 * Set/read system clipboard.
 *
 * Read is not implemented due to security considerations.  A remote app
 * that is able to both write and read to the clipboard could essentially
 * take over your session.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['52'] = function(parseState) {
  if (!this.enableClipboardWrite) {
    return;
  }

  // Args come in as a single 'clipboard;b64-data' string.  The clipboard
  // parameter is used to select which of the X clipboards to address.  Since
  // we're not integrating with X, we treat them all the same.
  const args = parseState.args[0].match(/^[cps01234567]*;(.*)/);
  if (!args) {
    return;
  }

  let data;
  try {
    data = window.atob(args[1]);
  } catch (e) {
    // If the user sent us invalid base64 content, silently ignore it.
    return;
  }
  const decoder = new TextDecoder();
  const bytes = lib.codec.stringToCodeUnitArray(data);
  data = decoder.decode(bytes);
  if (data) {
    this.terminal.copyStringToClipboard(data);
  }
};

/**
 * Reset color palette.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['104'] = function(parseState) {
  // If there are no args, we reset the entire palette.
  if (!parseState.args[0]) {
    this.terminal.resetColorPalette();
    return;
  }

  // Args come in as a single 'index1;index2;...;indexN' string.
  // Split on the semicolon and iterate through the colors.
  const args = parseState.args[0].split(';');
  args.forEach((c) => this.terminal.resetColor(c));
};

/**
 * Reset foreground color.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['110'] = function(parseState) {
  this.terminal.setForegroundColor();
};

/**
 * Reset background color.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['111'] = function(parseState) {
  this.terminal.setBackgroundColor();
};

/**
 * Reset text cursor color.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['112'] = function(parseState) {
  this.terminal.setCursorColor();
};

/**
 * iTerm2 extended sequences.
 *
 * We only support image display atm.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['1337'] = function(parseState) {
  // Args come in as a set of key value pairs followed by data.
  // File=name=<base64>;size=123;inline=1:<base64 data>
  const args = parseState.args[0].match(/^File=([^:]*):([\s\S]*)$/m);
  if (!args) {
    if (this.warnUnimplemented) {
      console.log(`iTerm2 1337: unsupported sequence: ${args[1]}`);
    }
    return;
  }

  const options = {
    name: '',
    size: 0,
    preserveAspectRatio: true,
    inline: false,
    width: 'auto',
    height: 'auto',
    align: 'left',
    type: '',
    buffer: lib.codec.stringToCodeUnitArray(atob(args[2])).buffer,
  };
  // Walk the "key=value;" sets.
  args[1].split(';').forEach((ele) => {
    const kv = ele.match(/^([^=]+)=(.*)$/m);
    if (!kv) {
      return;
    }

    // Sanitize values nicely.
    switch (kv[1]) {
      case 'name':
        try {
          options.name = window.atob(kv[2]);
        } catch (e) {
          // Ignore invalid base64 from user.
        }
        break;
      case 'size':
        try {
          options.size = parseInt(kv[2], 10);
        } catch (e) {
          // Ignore invalid numbers from user.
        }
        break;
      case 'width':
        options.width = kv[2];
        break;
      case 'height':
        options.height = kv[2];
        break;
      case 'preserveAspectRatio':
        options.preserveAspectRatio = !(kv[2] == '0');
        break;
      case 'inline':
        options.inline = !(kv[2] == '0');
        break;
      // hterm-specific keys.
      case 'align':
        options.align = kv[2];
        break;
      case 'type':
        options.type = kv[2];
        break;
      default:
        // Ignore unknown keys.  Don't want remote stuffing our JS env.
        break;
    }
  });

  // This is a bit of a hack.  If the buffer has data following the image, we
  // need to delay processing of it until after we've finished with the image.
  // Otherwise while we wait for the the image to load asynchronously, the new
  // text data will intermingle with the image.
  if (options.inline) {
    const io = this.terminal.io;
    const queued = parseState.peekRemainingBuf();
    parseState.advance(queued.length);
    this.terminal.displayImage(options);
    io.print(queued);
  } else {
    this.terminal.displayImage(options);
  }
};

/**
 * URxvt perl modules.
 *
 * This is the escape system used by rxvt-unicode and its perl modules.
 * Obviously we don't support perl or custom modules, so we list a few common
 * ones that we find useful.
 *
 * Technically there is no format here, but most modules obey:
 * <module name>;<module args, usually ; delimited>
 *
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['777'] = function(parseState) {
  let ary;
  const urxvtMod = parseState.args[0].split(';', 1)[0];

  switch (urxvtMod) {
    case 'notify': {
      // Format:
      // notify;title;message
      let title;
      let message;
      ary = parseState.args[0].match(/^[^;]+;([^;]*)(;([\s\S]*))?$/);
      if (ary) {
        title = ary[1];
        message = ary[3];
      }
      hterm.notify({'title': title, 'body': message});
      break;
    }

    default:
      console.warn('Unknown urxvt module: ' + parseState.args[0]);
      break;
  }
};

/**
 * Insert (blank) characters (ICH).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['@'] = function(parseState) {
  this.terminal.insertSpace(parseState.iarg(0, 1));
};

/**
 * Cursor Up (CUU).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['A'] = function(parseState) {
  this.terminal.cursorUp(parseState.iarg(0, 1));
};

/**
 * Cursor Down (CUD).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['B'] = function(parseState) {
  this.terminal.cursorDown(parseState.iarg(0, 1));
};

/**
 * Cursor Forward (CUF).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['C'] = function(parseState) {
  this.terminal.cursorRight(parseState.iarg(0, 1));
};

/**
 * Cursor Backward (CUB).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['D'] = function(parseState) {
  this.terminal.cursorLeft(parseState.iarg(0, 1));
};

/**
 * Cursor Next Line (CNL).
 *
 * This is like Cursor Down, except the cursor moves to the beginning of the
 * line as well.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['E'] = function(parseState) {
  this.terminal.cursorDown(parseState.iarg(0, 1));
  this.terminal.setCursorColumn(0);
};

/**
 * Cursor Preceding Line (CPL).
 *
 * This is like Cursor Up, except the cursor moves to the beginning of the
 * line as well.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['F'] = function(parseState) {
  this.terminal.cursorUp(parseState.iarg(0, 1));
  this.terminal.setCursorColumn(0);
};

/**
 * Cursor Horizontal Absolute (CHA).
 *
 * Xterm calls this Cursor Character Absolute.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['G'] = function(parseState) {
  this.terminal.setCursorColumn(parseState.iarg(0, 1) - 1);
};

/**
 * Cursor Position (CUP).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['H'] = function(parseState) {
  this.terminal.setCursorPosition(parseState.iarg(0, 1) - 1,
                                  parseState.iarg(1, 1) - 1);
};

/**
 * Cursor Forward Tabulation (CHT).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['I'] = function(parseState) {
  let count = parseState.iarg(0, 1);
  count = lib.f.clamp(count, 1, this.terminal.screenSize.width);
  for (let i = 0; i < count; i++) {
    this.terminal.forwardTabStop();
  }
};

/**
 * Erase in Display (ED, DECSED).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['J'] =
hterm.VT.CSI['?J'] = function(parseState) {
  const arg = parseState.args[0];

  if (!arg || arg == 0) {
    this.terminal.eraseBelow();
  } else if (arg == 1) {
    this.terminal.eraseAbove();
  } else if (arg == 2) {
    this.terminal.clear();
  } else if (arg == 3) {
    if (this.enableCsiJ3) {
      this.terminal.clearScrollback();
    }
  }
};

/**
 * Erase in line (EL, DECSEL).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['K'] =
hterm.VT.CSI['?K'] = function(parseState) {
  const arg = parseState.args[0];

  if (!arg || arg == 0) {
    this.terminal.eraseToRight();
  } else if (arg == 1) {
    this.terminal.eraseToLeft();
  } else if (arg == 2) {
    this.terminal.eraseLine();
  }
};

/**
 * Insert Lines (IL).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['L'] = function(parseState) {
  this.terminal.insertLines(parseState.iarg(0, 1));
};

/**
 * Delete Lines (DL).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['M'] = function(parseState) {
  this.terminal.deleteLines(parseState.iarg(0, 1));
};

/**
 * Delete Characters (DCH).
 *
 * This command shifts the line contents left, starting at the cursor position.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['P'] = function(parseState) {
  this.terminal.deleteChars(parseState.iarg(0, 1));
};

/**
 * Scroll Up (SU).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['S'] = function(parseState) {
  this.terminal.vtScrollUp(parseState.iarg(0, 1));
};

/**
 * Scroll Down (SD).
 * Also 'Initiate highlight mouse tracking'.  Will not implement this part.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['T'] = function(parseState) {
  if (parseState.args.length <= 1) {
    this.terminal.vtScrollDown(parseState.iarg(0, 1));
  }
};

/**
 * Reset one or more features of the title modes to the default value.
 *
 *   ESC [ > Ps T
 *
 * Normally, "reset" disables the feature. It is possible to disable the
 * ability to reset features by compiling a different default for the title
 * modes into xterm.
 *
 * Ps values:
 *   0 - Do not set window/icon labels using hexadecimal.
 *   1 - Do not query window/icon labels using hexadecimal.
 *   2 - Do not set window/icon labels using UTF-8.
 *   3 - Do not query window/icon labels using UTF-8.
 *
 * Will not implement.
 */
hterm.VT.CSI['>T'] = hterm.VT.ignore;

/**
 * Erase Characters (ECH).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['X'] = function(parseState) {
  this.terminal.eraseToRight(parseState.iarg(0, 1));
};

/**
 * Cursor Backward Tabulation (CBT).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['Z'] = function(parseState) {
  let count = parseState.iarg(0, 1);
  count = lib.f.clamp(count, 1, this.terminal.screenSize.width);
  for (let i = 0; i < count; i++) {
    this.terminal.backwardTabStop();
  }
};

/**
 * Character Position Absolute (HPA).
 *
 * Same as Cursor Horizontal Absolute (CHA).
 */
hterm.VT.CSI['`'] = hterm.VT.CSI['G'];

/**
 * Character Position Relative (HPR).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['a'] = function(parseState) {
  this.terminal.setCursorColumn(this.terminal.getCursorColumn() +
                                parseState.iarg(0, 1));
};

/**
 * Repeat the preceding graphic character.
 *
 * Not currently implemented.
 */
hterm.VT.CSI['b'] = hterm.VT.ignore;

/**
 * Send Device Attributes (Primary DA).
 *
 * TODO(rginda): This is hardcoded to send back 'VT100 with Advanced Video
 * Option', but it may be more correct to send a VT220 response once
 * we fill out the 'Not currently implemented' parts.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['c'] = function(parseState) {
  if (!parseState.args[0] || parseState.args[0] == 0) {
    this.terminal.io.sendString('\x1b[?1;2c');
  }
};

/**
 * Send Device Attributes (Secondary DA).
 *
 * TODO(rginda): This is hardcoded to send back 'VT100' but it may be more
 * correct to send a VT220 response once we fill out more 'Not currently
 * implemented' parts.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['>c'] = function(parseState) {
  this.terminal.io.sendString('\x1b[>0;256;0c');
};

/**
 * Line Position Absolute (VPA).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['d'] = function(parseState) {
  this.terminal.setAbsoluteCursorRow(parseState.iarg(0, 1) - 1);
};

/**
 * Horizontal and Vertical Position (HVP).
 *
 * Same as Cursor Position (CUP).
 */
hterm.VT.CSI['f'] = hterm.VT.CSI['H'];

/**
 * Tab Clear (TBC).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['g'] = function(parseState) {
  if (!parseState.args[0] || parseState.args[0] == 0) {
    // Clear tab stop at cursor.
    this.terminal.clearTabStopAtCursor();
  } else if (parseState.args[0] == 3) {
    // Clear all tab stops.
    this.terminal.clearAllTabStops();
  }
};

/**
 * Set Mode (SM).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['h'] = function(parseState) {
  for (let i = 0; i < parseState.args.length; i++) {
    this.setANSIMode(parseState.args[i], true);
  }
};

/**
 * DEC Private Mode Set (DECSET).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['?h'] = function(parseState) {
  for (let i = 0; i < parseState.args.length; i++) {
    this.setDECMode(parseState.args[i], true);
  }
};

/**
 * Media Copy (MC).
 * Media Copy (MC, DEC Specific).
 *
 * These commands control the printer.  Will not implement.
 */
hterm.VT.CSI['i'] =
hterm.VT.CSI['?i'] = hterm.VT.ignore;

/**
 * Reset Mode (RM).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['l'] = function(parseState) {
  for (let i = 0; i < parseState.args.length; i++) {
    this.setANSIMode(parseState.args[i], false);
  }
};

/**
 * DEC Private Mode Reset (DECRST).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['?l'] = function(parseState) {
  for (let i = 0; i < parseState.args.length; i++) {
    this.setDECMode(parseState.args[i], false);
  }
};

/**
 * Parse extended SGR 38/48 sequences.
 *
 * This deals with the various ISO 8613-6 forms, and with legacy xterm forms
 * that are common in the wider application world.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current input state.
 * @param {number} i The argument in parseState to start processing.
 * @param {!hterm.TextAttributes} attrs The current text attributes.
 * @return {!Object} The skipCount member defines how many arguments to skip
 *     (i.e. how many were processed), and the color member is the color that
 *     was successfully processed, or undefined if not.
 */
hterm.VT.prototype.parseSgrExtendedColors = function(parseState, i, attrs) {
  let ary;
  let usedSubargs;

  if (parseState.argHasSubargs(i)) {
    // The ISO 8613-6 compliant form.
    // e.g. 38:[color choice]:[arg1]:[arg2]:...
    ary = parseState.args[i].split(':');
    ary.shift();  // Remove "38".
    usedSubargs = true;
  } else if (parseState.argHasSubargs(i + 1)) {
    // The xterm form which isn't ISO 8613-6 compliant.  Not many emulators
    // support this, and others actively do not want to.  We'll ignore it so
    // at least the rest of the stream works correctly.  e.g. 38;2:R:G:B
    // We return 0 here so we only skip the "38" ... we can't be confident the
    // next arg is actually supposed to be part of it vs a typo where the next
    // arg is legit.
    return {skipCount: 0};
  } else {
    // The xterm form which isn't ISO 8613-6 compliant, but many emulators
    // support, and many applications rely on.
    // e.g. 38;2;R;G;B
    ary = parseState.args.slice(i + 1);
    usedSubargs = false;
  }

  // Figure out which form to parse.
  switch (parseInt(ary[0], 10)) {
    default:  // Unknown.
    case 0:  // Implementation defined.  We ignore it.
      return {skipCount: 0};

    case 1: {  // Transparent color.
      // Require ISO 8613-6 form.
      if (!usedSubargs) {
        return {skipCount: 0};
      }

      return {
        color: 'rgba(0, 0, 0, 0)',
        skipCount: 0,
      };
    }

    case 2: {  // RGB color.
      // Skip over the color space identifier, if it exists.
      let start;
      if (usedSubargs) {
        // The ISO 8613-6 compliant form:
        //   38:2:<color space id>:R:G:B[:...]
        // The xterm form isn't ISO 8613-6 compliant.
        //   38:2:R:G:B
        // Since the ISO 8613-6 form requires at least 5 arguments,
        // we can still support the xterm form unambiguously.
        if (ary.length == 4) {
          start = 1;
        } else {
          start = 2;
        }
      } else {
        // The legacy xterm form: 38;2;R;G;B
        start = 1;
      }

      // We need at least 3 args for RGB.  If we don't have them, assume this
      // sequence is corrupted, so don't eat anything more.
      // We ignore more than 3 args on purpose since ISO 8613-6 defines some,
      // and we don't care about them.
      if (ary.length < start + 3) {
        return {skipCount: 0};
      }

      const r = parseState.parseInt(ary[start + 0]);
      const g = parseState.parseInt(ary[start + 1]);
      const b = parseState.parseInt(ary[start + 2]);
      return {
        color: `rgb(${r}, ${g}, ${b})`,
        skipCount: usedSubargs ? 0 : 4,
      };
    }

    case 3: {  // CMY color.
      // No need to support xterm/legacy forms as xterm doesn't support CMY.
      if (!usedSubargs) {
        return {skipCount: 0};
      }

      // We need at least 4 args for CMY.  If we don't have them, assume
      // this sequence is corrupted.  We ignore the color space identifier,
      // tolerance, etc...
      if (ary.length < 4) {
        return {skipCount: 0};
      }

      // TODO: See CMYK below.
      // const c = parseState.parseInt(ary[1]);
      // const m = parseState.parseInt(ary[2]);
      // const y = parseState.parseInt(ary[3]);
      return {skipCount: 0};
    }

    case 4: {  // CMYK color.
      // No need to support xterm/legacy forms as xterm doesn't support CMYK.
      if (!usedSubargs) {
        return {skipCount: 0};
      }

      // We need at least 5 args for CMYK.  If we don't have them, assume
      // this sequence is corrupted.  We ignore the color space identifier,
      // tolerance, etc...
      if (ary.length < 5) {
        return {skipCount: 0};
      }

      // TODO: Implement this.
      // Might wait until CSS4 is adopted for device-cmyk():
      // https://www.w3.org/TR/css-color-4/#cmyk-colors
      // Or normalize it to RGB ourselves:
      // https://www.w3.org/TR/css-color-4/#cmyk-rgb
      // const c = parseState.parseInt(ary[1]);
      // const m = parseState.parseInt(ary[2]);
      // const y = parseState.parseInt(ary[3]);
      // const k = parseState.parseInt(ary[4]);
      return {skipCount: 0};
    }

    case 5: {  // Color palette index.
      // If we're short on args, assume this sequence is corrupted, so don't
      // eat anything more.
      if (ary.length < 2) {
        return {skipCount: 0};
      }

      // Support 38:5:P (ISO 8613-6) and 38;5;P (xterm/legacy).
      // We also ignore extra args with 38:5:P:[...], but more for laziness.
      const ret = {
        skipCount: usedSubargs ? 0 : 2,
      };
      const color = parseState.parseInt(ary[1]);
      if (color < lib.colors.stockPalette.length) {
        ret.color = color;
      }
      return ret;
    }
  }
};

/**
 * Character Attributes (SGR).
 *
 * Iterate through the list of arguments, applying the attribute changes based
 * on the argument value...
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState
 */
hterm.VT.CSI['m'] = function(parseState) {
  const attrs = this.terminal.getTextAttributes();

  if (!parseState.args.length) {
    attrs.reset();
    return;
  }

  for (let i = 0; i < parseState.args.length; i++) {
    // If this argument has subargs (i.e. it has args followed by colons),
    // the iarg logic will implicitly truncate that off for us.
    const arg = parseState.iarg(i, 0);

    if (arg < 30) {
      if (arg == 0) {  // Normal (default).
        attrs.reset();
      } else if (arg == 1) {  // Bold.
        attrs.bold = true;
      } else if (arg == 2) {  // Faint.
        attrs.faint = true;
      } else if (arg == 3) {  // Italic.
        attrs.italic = true;
      } else if (arg == 4) {  // Underline.
        if (parseState.argHasSubargs(i)) {
          const uarg = parseState.args[i].split(':')[1];
          if (uarg == 0) {
            attrs.underline = false;
          } else if (uarg == 1) {
            attrs.underline = 'solid';
          } else if (uarg == 2) {
            attrs.underline = 'double';
          } else if (uarg == 3) {
            attrs.underline = 'wavy';
          } else if (uarg == 4) {
            attrs.underline = 'dotted';
          } else if (uarg == 5) {
            attrs.underline = 'dashed';
          }
        } else {
          attrs.underline = 'solid';
        }
      } else if (arg == 5) {  // Blink.
        attrs.blink = true;
      } else if (arg == 7) {  // Inverse.
        attrs.inverse = true;
      } else if (arg == 8) {  // Invisible.
        attrs.invisible = true;
      } else if (arg == 9) {  // Crossed out.
        attrs.strikethrough = true;
      } else if (arg == 21) {  // Double underlined.
        attrs.underline = 'double';
      } else if (arg == 22) {  // Not bold & not faint.
        attrs.bold = false;
        attrs.faint = false;
      } else if (arg == 23) {  // Not italic.
        attrs.italic = false;
      } else if (arg == 24) {  // Not underlined.
        attrs.underline = false;
      } else if (arg == 25) {  // Not blink.
        attrs.blink = false;
      } else if (arg == 27) {  // Steady.
        attrs.inverse = false;
      } else if (arg == 28) {  // Visible.
        attrs.invisible = false;
      } else if (arg == 29) {  // Not crossed out.
        attrs.strikethrough = false;
      }

    } else if (arg < 50) {
      // Select fore/background color from bottom half of 16 color palette
      // or from the 256 color palette or alternative specify color in fully
      // qualified rgb(r, g, b) form.
      if (arg < 38) {
        attrs.foregroundSource = arg - 30;

      } else if (arg == 38) {
        const result = this.parseSgrExtendedColors(parseState, i, attrs);
        if (result.color !== undefined) {
          attrs.foregroundSource = result.color;
        }
        i += result.skipCount;

      } else if (arg == 39) {
        attrs.foregroundSource = attrs.SRC_DEFAULT;

      } else if (arg < 48) {
        attrs.backgroundSource = arg - 40;

      } else if (arg == 48) {
        const result = this.parseSgrExtendedColors(parseState, i, attrs);
        if (result.color !== undefined) {
          attrs.backgroundSource = result.color;
        }
        i += result.skipCount;

      } else {
        attrs.backgroundSource = attrs.SRC_DEFAULT;
      }

    } else if (arg == 58) {  // Underline coloring.
      const result = this.parseSgrExtendedColors(parseState, i, attrs);
      if (result.color !== undefined) {
        attrs.underlineSource = result.color;
      }
      i += result.skipCount;

    } else if (arg == 59) {  // Disable underline coloring.
      attrs.underlineSource = attrs.SRC_DEFAULT;

    } else if (arg >= 90 && arg <= 97) {
      attrs.foregroundSource = arg - 90 + 8;

    } else if (arg >= 100 && arg <= 107) {
      attrs.backgroundSource = arg - 100 + 8;
    }
  }

  attrs.syncColors();
};

// SGR calls can handle subargs.
hterm.VT.CSI['m'].supportsSubargs = true;

/**
 * Set xterm-specific keyboard modes.
 *
 * Will not implement.
 */
hterm.VT.CSI['>m'] = hterm.VT.ignore;

/**
 * Device Status Report (DSR, DEC Specific).
 *
 * 5 - Status Report. Result (OK) is CSI 0 n
 * 6 - Report Cursor Position (CPR) [row;column]. Result is CSI r ; c R
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState
 */
hterm.VT.CSI['n'] = function(parseState) {
  if (parseState.args[0] == 5) {
    this.terminal.io.sendString('\x1b0n');
  } else if (parseState.args[0] == 6) {
    const row = this.terminal.getCursorRow() + 1;
    const col = this.terminal.getCursorColumn() + 1;
    this.terminal.io.sendString('\x1b[' + row + ';' + col + 'R');
  }
};

/**
 * Disable modifiers which may be enabled via CSI['>m'].
 *
 * Will not implement.
 */
hterm.VT.CSI['>n'] = hterm.VT.ignore;

/**
 * Device Status Report (DSR, DEC Specific).
 *
 * 6  - Report Cursor Position (CPR) [row;column] as CSI ? r ; c R
 * 15 - Report Printer status as CSI ? 1 0 n (ready) or
 *      CSI ? 1 1 n (not ready).
 * 25 - Report UDK status as CSI ? 2 0 n (unlocked) or CSI ? 2 1 n (locked).
 * 26 - Report Keyboard status as CSI ? 2 7 ; 1 ; 0 ; 0 n (North American).
 *      The last two parameters apply to VT400 & up, and denote keyboard ready
 *      and LK01 respectively.
 * 53 - Report Locator status as CSI ? 5 3 n Locator available, if compiled-in,
 *      or CSI ? 5 0 n No Locator, if not.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState
 */
hterm.VT.CSI['?n'] = function(parseState) {
  if (parseState.args[0] == 6) {
    const row = this.terminal.getCursorRow() + 1;
    const col = this.terminal.getCursorColumn() + 1;
    this.terminal.io.sendString('\x1b[' + row + ';' + col + 'R');
  } else if (parseState.args[0] == 15) {
    this.terminal.io.sendString('\x1b[?11n');
  } else if (parseState.args[0] == 25) {
    this.terminal.io.sendString('\x1b[?21n');
  } else if (parseState.args[0] == 26) {
    this.terminal.io.sendString('\x1b[?12;1;0;0n');
  } else if (parseState.args[0] == 53) {
    this.terminal.io.sendString('\x1b[?50n');
  }
};

/**
 * This is used by xterm to decide whether to hide the pointer cursor as the
 * user types.
 *
 * Valid values for the parameter:
 *   0 - Never hide the pointer.
 *   1 - Hide if the mouse tracking mode is not enabled.
 *   2 - Always hide the pointer.
 *
 * If no parameter is given, xterm uses the default, which is 1.
 *
 * Not currently implemented.
 */
hterm.VT.CSI['>p'] = hterm.VT.ignore;

/**
 * Soft terminal reset (DECSTR).
 *
 * @this {!hterm.VT}
 */
hterm.VT.CSI['!p'] = function() {
  this.terminal.softReset();
};

/**
 * Request ANSI Mode (DECRQM).
 *
 * Not currently implemented.
 */
hterm.VT.CSI['$p'] = hterm.VT.ignore;
hterm.VT.CSI['?$p'] = hterm.VT.ignore;

/**
 * Set conformance level (DECSCL).
 *
 * Not currently implemented.
 */
hterm.VT.CSI['"p'] = hterm.VT.ignore;

/**
 * Load LEDs (DECLL).
 *
 * Not currently implemented.  Could be implemented as virtual LEDs overlaying
 * the terminal if anyone cares.
 */
hterm.VT.CSI['q'] = hterm.VT.ignore;

/**
 * Set cursor style (DECSCUSR, VT520).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState
 */
hterm.VT.CSI[' q'] = function(parseState) {
  const arg = parseState.args[0];

  if (arg == 0 || arg == 1) {
    this.terminal.setCursorShape('b');
    this.terminal.setCursorBlink('y');
  } else if (arg == 2) {
    this.terminal.setCursorShape('b');
    this.terminal.setCursorBlink('n');
  } else if (arg == 3) {
    this.terminal.setCursorShape('_');
    this.terminal.setCursorBlink('y');
  } else if (arg == 4) {
    this.terminal.setCursorShape('_');
    this.terminal.setCursorBlink('n');
  } else if (arg == 5) {
    this.terminal.setCursorShape('|');
    this.terminal.setCursorBlink('y');
  } else if (arg == 6) {
    this.terminal.setCursorShape('|');
    this.terminal.setCursorBlink('n');
  } else {
    console.warn('Unknown cursor style: ' + arg);
  }
};

/**
 * Select character protection attribute (DECSCA).
 *
 * Will not implement.
 */
hterm.VT.CSI['"q'] = hterm.VT.ignore;

/**
 * Set Scrolling Region (DECSTBM).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState
 */
hterm.VT.CSI['r'] = function(parseState) {
  const args = parseState.args;
  const top = args[0] ? parseInt(args[0], 10) : 0;
  const bottom =
      args[1] ? parseInt(args[1], 10) : this.terminal.screenSize.height;
  // Silently ignore bad args.
  if (top < 0 || bottom > this.terminal.screenSize.height || bottom <= top) {
    return;
  }
  // Convert from 1-based to 0-based with special case for zero.
  this.terminal.setVTScrollRegion(top === 0 ? null : top - 1, bottom - 1);
  this.terminal.setCursorPosition(0, 0);
};

/**
 * Restore DEC Private Mode Values.
 *
 * Will not implement.
 */
hterm.VT.CSI['?r'] = hterm.VT.ignore;

/**
 * Change Attributes in Rectangular Area (DECCARA)
 *
 * Will not implement.
 */
hterm.VT.CSI['$r'] = hterm.VT.ignore;

/**
 * Save cursor (ANSI.SYS)
 *
 * @this {!hterm.VT}
 */
hterm.VT.CSI['s'] = function() {
  this.terminal.saveCursorAndState();
};

/**
 * Save DEC Private Mode Values.
 *
 * Will not implement.
 */
hterm.VT.CSI['?s'] = hterm.VT.ignore;

/**
 * Window manipulation (from dtterm, as well as extensions).
 *
 * Will not implement.
 */
hterm.VT.CSI['t'] = hterm.VT.ignore;

/**
 * Reverse Attributes in Rectangular Area (DECRARA).
 *
 * Will not implement.
 */
hterm.VT.CSI['$t'] = hterm.VT.ignore;

/**
 * Set one or more features of the title modes.
 *
 * Will not implement.
 */
hterm.VT.CSI['>t'] = hterm.VT.ignore;

/**
 * Set warning-bell volume (DECSWBV, VT520).
 *
 * Will not implement.
 */
hterm.VT.CSI[' t'] = hterm.VT.ignore;

/**
 * Restore cursor (ANSI.SYS).
 *
 * @this {!hterm.VT}
 */
hterm.VT.CSI['u'] = function() {
  this.terminal.restoreCursorAndState();
};

/**
 * Set margin-bell volume (DECSMBV, VT520).
 *
 * Will not implement.
 */
hterm.VT.CSI[' u'] = hterm.VT.ignore;

/**
 * Copy Rectangular Area (DECCRA, VT400 and up).
 *
 * Will not implement.
 */
hterm.VT.CSI['$v'] = hterm.VT.ignore;

/**
 * Enable Filter Rectangle (DECEFR).
 *
 * Will not implement.
 */
hterm.VT.CSI['\'w'] = hterm.VT.ignore;

/**
 * Request Terminal Parameters (DECREQTPARM).
 *
 * Not currently implemented.
 */
hterm.VT.CSI['x'] = hterm.VT.ignore;

/**
 * Select Attribute Change Extent (DECSACE).
 *
 * Will not implement.
 */
hterm.VT.CSI['*x'] = hterm.VT.ignore;

/**
 * Fill Rectangular Area (DECFRA), VT420 and up.
 *
 * Will not implement.
 */
hterm.VT.CSI['$x'] = hterm.VT.ignore;

/**
 * vt_tiledata (as used by NAOhack and UnNetHack)
 * (see https://nethackwiki.com/wiki/Vt_tiledata for more info)
 *
 * Implemented as far as we care (start a glyph and end a glyph).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState
 */
hterm.VT.CSI['z'] = function(parseState) {
  if (parseState.args.length < 1) {
    return;
  }
  const arg = parseState.args[0];
  if (arg == 0) {
    // Start a glyph (one parameter, the glyph number).
    if (parseState.args.length < 2) {
      return;
    }
    this.terminal.getTextAttributes().tileData = parseState.args[1];
  } else if (arg == 1) {
    // End a glyph.
    this.terminal.getTextAttributes().tileData = null;
  }
};

/**
 * Enable Locator Reporting (DECELR).
 *
 * Not currently implemented.
 */
hterm.VT.CSI['\'z'] = hterm.VT.ignore;

/**
 * Erase Rectangular Area (DECERA), VT400 and up.
 *
 * Will not implement.
 */
hterm.VT.CSI['$z'] = hterm.VT.ignore;

/**
 * Select Locator Events (DECSLE).
 *
 * Not currently implemented.
 */
hterm.VT.CSI['\'{'] = hterm.VT.ignore;

/**
 * Request Locator Position (DECRQLP).
 *
 * Not currently implemented.
 */
hterm.VT.CSI['\'|'] = hterm.VT.ignore;

/**
 * Insert Columns (DECIC), VT420 and up.
 *
 * Will not implement.
 */
hterm.VT.CSI['\'}'] = hterm.VT.ignore;

/**
 * Delete P s Columns (DECDC), VT420 and up.
 *
 * Will not implement.
 */
hterm.VT.CSI['\'~'] = hterm.VT.ignore;
// SOURCE FILE: hterm/js/hterm_vt_character_map.js
// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Character map object.
 *
 * Mapping from received to display character, used depending on the active
 * VT character set.
 *
 * GR maps are not currently supported.
 *
 * @param {string} description A human readable description of this map.
 * @param {?Object} glmap The GL mapping from input to output characters.
 * @constructor
 */
hterm.VT.CharacterMap = function(description, glmap) {
  /**
   * Short description for this character set, useful for debugging.
   */
  this.description = description;

  /**
   * The function to call to when this map is installed in GL.
   */
  this.GL = null;

  // Always keep an unmodified reference to the map.
  // This allows us to easily reset back to the original state.
  this.glmapBase_ = glmap;

  // Now sync the internal state as needed.
  this.sync_();
};

/**
 * Internal helper for resyncing internal state.
 *
 * Used when the mappings change.
 *
 * @param {!Object=} glmap Additional mappings to overlay on top of the
 *     base mapping.
 */
hterm.VT.CharacterMap.prototype.sync_ = function(glmap = undefined) {
  // If there are no maps, then reset the state back.
  if (!this.glmapBase_ && !glmap) {
    this.GL = null;
    delete this.glmap_;
    delete this.glre_;
    return;
  }

  // Set the the GL mapping.  If we're given a custom mapping, then create a
  // new object to hold the merged map.  This way we can cleanly reset back.
  if (glmap) {
    this.glmap_ = Object.assign({}, this.glmapBase_, glmap);
  } else {
    this.glmap_ = this.glmapBase_;
  }

  const glchars = Object.keys(lib.notNull(this.glmap_)).map(
      (key) => '\\x' + lib.f.zpad(key.charCodeAt(0).toString(16), 2));
  this.glre_ = new RegExp('[' + glchars.join('') + ']', 'g');

  this.GL = (str) => str.replace(this.glre_, (ch) => this.glmap_[ch]);
};

/**
 * Reset map back to original mappings (discarding runtime updates).
 *
 * Specifically, any calls to setOverrides will be discarded.
 */
hterm.VT.CharacterMap.prototype.reset = function() {
  // If we haven't been given a custom mapping, then there's nothing to reset.
  if (this.glmap_ !== this.glmapBase_) {
    this.sync_();
  }
};

/**
 * Merge custom changes to this map.
 *
 * The input map need not duplicate the existing mappings as it is merged with
 * the existing base map (what was created with).  Subsequent calls to this
 * will throw away previous override settings.
 *
 * @param {!Object} glmap The custom map to override existing mappings.
 */
hterm.VT.CharacterMap.prototype.setOverrides = function(glmap) {
  this.sync_(glmap);
};

/**
 * Return a copy of this mapping.
 *
 * @return {!hterm.VT.CharacterMap} A new hterm.VT.CharacterMap instance.
 */
hterm.VT.CharacterMap.prototype.clone = function() {
  const map = new hterm.VT.CharacterMap(this.description, this.glmapBase_);
  if (this.glmap_ !== this.glmapBase_) {
    map.setOverrides(this.glmap_);
  }
  return map;
};

/**
 * Table of character maps.
 *
 * @constructor
 */
hterm.VT.CharacterMaps = function() {
  this.maps_ = hterm.VT.CharacterMaps.DefaultMaps;

  // Always keep an unmodified reference to the map.
  // This allows us to easily reset back to the original state.
  this.mapsBase_ = this.maps_;
};

/**
 * Look up a previously registered map.
 *
 * @param {string} name The name of the map to lookup.
 * @return {!hterm.VT.CharacterMap|undefined} The map, if it's been registered
 *     or undefined.
 */
hterm.VT.CharacterMaps.prototype.getMap = function(name) {
  if (this.maps_.hasOwnProperty(name)) {
    return this.maps_[name];
  } else {
    return undefined;
  }
};

/**
 * Register a new map.
 *
 * Any previously registered maps by this name will be discarded.
 *
 * @param {string} name The name of the map.
 * @param {!hterm.VT.CharacterMap} map The map to register.
 */
hterm.VT.CharacterMaps.prototype.addMap = function(name, map) {
  if (this.maps_ === this.mapsBase_) {
    this.maps_ = Object.assign({}, this.mapsBase_);
  }
  this.maps_[name] = map;
};

/**
 * Reset the table and all its maps back to original state.
 */
hterm.VT.CharacterMaps.prototype.reset = function() {
  if (this.maps_ !== hterm.VT.CharacterMaps.DefaultMaps) {
    this.maps_ = hterm.VT.CharacterMaps.DefaultMaps;
  }
};

/**
 * Merge custom changes to this table.
 *
 * @param {!Object} maps A set of hterm.VT.CharacterMap objects.
 */
hterm.VT.CharacterMaps.prototype.setOverrides = function(maps) {
  if (this.maps_ === this.mapsBase_) {
    this.maps_ = Object.assign({}, this.mapsBase_);
  }

  for (const name in maps) {
    const map = this.getMap(name);
    if (map !== undefined) {
      this.maps_[name] = map.clone();
      this.maps_[name].setOverrides(maps[name]);
    } else {
      this.addMap(name, new hterm.VT.CharacterMap('user ' + name, maps[name]));
    }
  }
};

/**
 * The default set of supported character maps.
 */
hterm.VT.CharacterMaps.DefaultMaps = {};

/**
 * VT100 Graphic character map.
 * http://vt100.net/docs/vt220-rm/table2-4.html
 */
hterm.VT.CharacterMaps.DefaultMaps['0'] = new hterm.VT.CharacterMap(
    'graphic', {
      '\x60':'\u25c6',  // ` -> diamond
      '\x61':'\u2592',  // a -> grey-box
      '\x62':'\u2409',  // b -> h/t
      '\x63':'\u240c',  // c -> f/f
      '\x64':'\u240d',  // d -> c/r
      '\x65':'\u240a',  // e -> l/f
      '\x66':'\u00b0',  // f -> degree
      '\x67':'\u00b1',  // g -> +/-
      '\x68':'\u2424',  // h -> n/l
      '\x69':'\u240b',  // i -> v/t
      '\x6a':'\u2518',  // j -> bottom-right
      '\x6b':'\u2510',  // k -> top-right
      '\x6c':'\u250c',  // l -> top-left
      '\x6d':'\u2514',  // m -> bottom-left
      '\x6e':'\u253c',  // n -> line-cross
      '\x6f':'\u23ba',  // o -> scan1
      '\x70':'\u23bb',  // p -> scan3
      '\x71':'\u2500',  // q -> scan5
      '\x72':'\u23bc',  // r -> scan7
      '\x73':'\u23bd',  // s -> scan9
      '\x74':'\u251c',  // t -> left-tee
      '\x75':'\u2524',  // u -> right-tee
      '\x76':'\u2534',  // v -> bottom-tee
      '\x77':'\u252c',  // w -> top-tee
      '\x78':'\u2502',  // x -> vertical-line
      '\x79':'\u2264',  // y -> less-equal
      '\x7a':'\u2265',  // z -> greater-equal
      '\x7b':'\u03c0',  // { -> pi
      '\x7c':'\u2260',  // | -> not-equal
      '\x7d':'\u00a3',  // } -> british-pound
      '\x7e':'\u00b7',  // ~ -> dot
    });

/**
 * British character map.
 * http://vt100.net/docs/vt220-rm/table2-5.html
 */
hterm.VT.CharacterMaps.DefaultMaps['A'] = new hterm.VT.CharacterMap(
    'british', {
      '\x23': '\u00a3',  // # -> british-pound
    });

/**
 * US ASCII map, no changes.
 */
hterm.VT.CharacterMaps.DefaultMaps['B'] = new hterm.VT.CharacterMap(
    'us', null);

/**
 * Dutch character map.
 * http://vt100.net/docs/vt220-rm/table2-6.html
 */
hterm.VT.CharacterMaps.DefaultMaps['4'] = new hterm.VT.CharacterMap(
    'dutch', {
      '\x23': '\u00a3',  // # -> british-pound

      '\x40': '\u00be',  // @ -> 3/4

      '\x5b': '\u0132',  // [ -> 'ij' ligature (xterm goes with \u00ff?)
      '\x5c': '\u00bd',  // \ -> 1/2
      '\x5d': '\u007c',  // ] -> vertical bar

      '\x7b': '\u00a8',  // { -> two dots
      '\x7c': '\u0066',  // | -> f
      '\x7d': '\u00bc',  // } -> 1/4
      '\x7e': '\u00b4',  // ~ -> acute
    });

/**
 * Finnish character map.
 * http://vt100.net/docs/vt220-rm/table2-7.html
 */
hterm.VT.CharacterMaps.DefaultMaps['C'] =
hterm.VT.CharacterMaps.DefaultMaps['5'] = new hterm.VT.CharacterMap(
    'finnish', {
      '\x5b': '\u00c4',  // [ -> 'A' umlaut
      '\x5c': '\u00d6',  // \ -> 'O' umlaut
      '\x5d': '\u00c5',  // ] -> 'A' ring
      '\x5e': '\u00dc',  // ~ -> 'u' umlaut

      '\x60': '\u00e9',  // ` -> 'e' acute

      '\x7b': '\u00e4',  // { -> 'a' umlaut
      '\x7c': '\u00f6',  // | -> 'o' umlaut
      '\x7d': '\u00e5',  // } -> 'a' ring
      '\x7e': '\u00fc',  // ~ -> 'u' umlaut
    });

/**
 * French character map.
 * http://vt100.net/docs/vt220-rm/table2-8.html
 */
hterm.VT.CharacterMaps.DefaultMaps['R'] = new hterm.VT.CharacterMap(
    'french', {
      '\x23': '\u00a3',  // # -> british-pound

      '\x40': '\u00e0',  // @ -> 'a' grave

      '\x5b': '\u00b0',  // [ -> ring
      '\x5c': '\u00e7',  // \ -> 'c' cedilla
      '\x5d': '\u00a7',  // ] -> section symbol (double s)

      '\x7b': '\u00e9',  // { -> 'e' acute
      '\x7c': '\u00f9',  // | -> 'u' grave
      '\x7d': '\u00e8',  // } -> 'e' grave
      '\x7e': '\u00a8',  // ~ -> umlaut
    });

/**
 * French Canadian character map.
 * http://vt100.net/docs/vt220-rm/table2-9.html
 */
hterm.VT.CharacterMaps.DefaultMaps['Q'] = new hterm.VT.CharacterMap(
    'french canadian', {
      '\x40': '\u00e0',  // @ -> 'a' grave

      '\x5b': '\u00e2',  // [ -> 'a' circumflex
      '\x5c': '\u00e7',  // \ -> 'c' cedilla
      '\x5d': '\u00ea',  // ] -> 'e' circumflex
      '\x5e': '\u00ee',  // ^ -> 'i' circumflex

      '\x60': '\u00f4',  // ` -> 'o' circumflex

      '\x7b': '\u00e9',  // { -> 'e' acute
      '\x7c': '\u00f9',  // | -> 'u' grave
      '\x7d': '\u00e8',  // } -> 'e' grave
      '\x7e': '\u00fb',  // ~ -> 'u' circumflex
    });

/**
 * German character map.
 * http://vt100.net/docs/vt220-rm/table2-10.html
 */
hterm.VT.CharacterMaps.DefaultMaps['K'] = new hterm.VT.CharacterMap(
    'german', {
      '\x40': '\u00a7',  // @ -> section symbol (double s)

      '\x5b': '\u00c4',  // [ -> 'A' umlaut
      '\x5c': '\u00d6',  // \ -> 'O' umlaut
      '\x5d': '\u00dc',  // ] -> 'U' umlaut

      '\x7b': '\u00e4',  // { -> 'a' umlaut
      '\x7c': '\u00f6',  // | -> 'o' umlaut
      '\x7d': '\u00fc',  // } -> 'u' umlaut
      '\x7e': '\u00df',  // ~ -> eszett
    });

/**
 * Italian character map.
 * http://vt100.net/docs/vt220-rm/table2-11.html
 */
hterm.VT.CharacterMaps.DefaultMaps['Y'] = new hterm.VT.CharacterMap(
    'italian', {
      '\x23': '\u00a3',  // # -> british-pound

      '\x40': '\u00a7',  // @ -> section symbol (double s)

      '\x5b': '\u00b0',  // [ -> ring
      '\x5c': '\u00e7',  // \ -> 'c' cedilla
      '\x5d': '\u00e9',  // ] -> 'e' acute

      '\x60': '\u00f9',  // ` -> 'u' grave

      '\x7b': '\u00e0',  // { -> 'a' grave
      '\x7c': '\u00f2',  // | -> 'o' grave
      '\x7d': '\u00e8',  // } -> 'e' grave
      '\x7e': '\u00ec',  // ~ -> 'i' grave
    });

/**
 * Norwegian/Danish character map.
 * http://vt100.net/docs/vt220-rm/table2-12.html
 */
hterm.VT.CharacterMaps.DefaultMaps['E'] =
hterm.VT.CharacterMaps.DefaultMaps['6'] = new hterm.VT.CharacterMap(
    'norwegian/danish', {
      '\x40': '\u00c4',  // @ -> 'A' umlaut

      '\x5b': '\u00c6',  // [ -> 'AE' ligature
      '\x5c': '\u00d8',  // \ -> 'O' stroke
      '\x5d': '\u00c5',  // ] -> 'A' ring
      '\x5e': '\u00dc',  // ^ -> 'U' umlaut

      '\x60': '\u00e4',  // ` -> 'a' umlaut

      '\x7b': '\u00e6',  // { -> 'ae' ligature
      '\x7c': '\u00f8',  // | -> 'o' stroke
      '\x7d': '\u00e5',  // } -> 'a' ring
      '\x7e': '\u00fc',  // ~ -> 'u' umlaut
    });

/**
 * Spanish character map.
 * http://vt100.net/docs/vt220-rm/table2-13.html
 */
hterm.VT.CharacterMaps.DefaultMaps['Z'] = new hterm.VT.CharacterMap(
    'spanish', {
      '\x23': '\u00a3',  // # -> british-pound

      '\x40': '\u00a7',  // @ -> section symbol (double s)

      '\x5b': '\u00a1',  // [ -> '!' inverted
      '\x5c': '\u00d1',  // \ -> 'N' tilde
      '\x5d': '\u00bf',  // ] -> '?' inverted

      '\x7b': '\u00b0',  // { -> ring
      '\x7c': '\u00f1',  // | -> 'n' tilde
      '\x7d': '\u00e7',  // } -> 'c' cedilla
    });

/**
 * Swedish character map.
 * http://vt100.net/docs/vt220-rm/table2-14.html
 */
hterm.VT.CharacterMaps.DefaultMaps['7'] =
hterm.VT.CharacterMaps.DefaultMaps['H'] = new hterm.VT.CharacterMap(
    'swedish', {
      '\x40': '\u00c9',  // @ -> 'E' acute

      '\x5b': '\u00c4',  // [ -> 'A' umlaut
      '\x5c': '\u00d6',  // \ -> 'O' umlaut
      '\x5d': '\u00c5',  // ] -> 'A' ring
      '\x5e': '\u00dc',  // ^ -> 'U' umlaut

      '\x60': '\u00e9',  // ` -> 'e' acute

      '\x7b': '\u00e4',  // { -> 'a' umlaut
      '\x7c': '\u00f6',  // | -> 'o' umlaut
      '\x7d': '\u00e5',  // } -> 'a' ring
      '\x7e': '\u00fc',  // ~ -> 'u' umlaut
    });

/**
 * Swiss character map.
 * http://vt100.net/docs/vt220-rm/table2-15.html
 */
hterm.VT.CharacterMaps.DefaultMaps['='] = new hterm.VT.CharacterMap(
    'swiss', {
      '\x23': '\u00f9',  // # -> 'u' grave

      '\x40': '\u00e0',  // @ -> 'a' grave

      '\x5b': '\u00e9',  // [ -> 'e' acute
      '\x5c': '\u00e7',  // \ -> 'c' cedilla
      '\x5d': '\u00ea',  // ] -> 'e' circumflex
      '\x5e': '\u00ee',  // ^ -> 'i' circumflex
      '\x5f': '\u00e8',  // _ -> 'e' grave

      '\x60': '\u00f4',  // ` -> 'o' circumflex

      '\x7b': '\u00e4',  // { -> 'a' umlaut
      '\x7c': '\u00f6',  // | -> 'o' umlaut
      '\x7d': '\u00fc',  // } -> 'u' umlaut
      '\x7e': '\u00fb',  // ~ -> 'u' circumflex
    });

lib.resource.add('hterm/images/copy', 'image/svg+xml;utf8',
'<svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" viewBox="0 0 48 48" fill="currentColor">' +
'  <path d="M32 2H8C5.79 2 4 3.79 4 6v28h4V6h24V2zm6 8H16c-2.21 0-4 1.79-4 4v28c0 2.21 1.79 4 4 4h22c2.21 0 4-1.79 4-4V14c0-2.21-1.79-4-4-4zm0 32H16V14h22v28z"/>' +
'</svg>'
);

lib.resource.add('hterm/images/close', 'image/svg+xml;utf8',
'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
'  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>' +
'</svg>'
);

lib.resource.add('hterm/images/icon-96', 'image/png;base64',
'iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAStklEQVR42u1dBXjrupL+RzIGmjIf' +
'vAcu42NmZub3lpmZmZmZmRkuMzPDYaYyJG0Sa9b2p2z1eQtp7bzefpv/nKnkkSw7Gg1IshNsDtpo' +
'o4022mijDWp/tlTgzbpJSqYvMoFTC9vjRD5JLb9RYaRkpk22SS28P8pacAaPdZ41KYMCI89YB6wN' +
'3JzQJM3UIGqurfTlKQTAZtqENid5SlNdU804VmbbWQtA6HMkAAdADsBeAJ7mxwIhIhFSXJ9iRPw4' +
'JYDEcqmGWEp1HhCI8gAtpXF7scB1ZRH9E3HObANCNy1AoGTegNDnCdE41tfQDH2t+CINQEpJ9Xp9' +
'7oUDh3+nXK48DYAMIWQmANIkNTn6vP69e3d/zctfeu0nXNexmVn3F0gDAMxMlBoHuht0qnsEEekC' +
'42SdGHmNxgVjgk4bPN04Yui8bhc534cQBH35RKrPN9sGdLnB1/Wuv+HW4f+6/tZvBHAaAJvmKr0A' +
'jJGvyQMw8pLrrvqeT378Ax8UwrKeevoFgEhfjcGGO2JO+iuTt1SW5DHzyraDExyTlWwHjCQ/CAJc' +
'ecU+XHn5xWDmVCGQFAKljsLbx8Ynvv3Bhx7/EQCzurimU04jADLsvK3r73/7W1//g1/6hU++uVqt' +
'0X/dcBcKxRIsy9Ji34DPow2et6FzgcXFKk6fOY83vu4VEFKkDiYHB3roSz73sc+Oj08eOHzk+B9o' +
'MyQABGk0gCIyOt9xHPvaD3/wnT/5VV/+meumpmbwD/98A0qdvVEBNhvMDCJaVXtM01GtVlEs+LBt' +
'C1ngzW98tX/m7Llv/emf+83HarX6vbrfGECQRgBmlLP9Ix961499+zd/5XVj45P407/8FxQ7uiGl' +
'QK1Ww1ZCvR6gXq3AsgQ8zwYzUkMIgXe+/Q1Dd9x5/6duv/P+R7QjprQaIHQd/8orLvnCJz/2/pfm' +
'cj7+6rf+DK5XgOu6sT3dQtBawqjW6lhYXIRlSTAjE/T39eLSS/ZeEwqgE8CiYUV4vQIgTULTyFve' +
'9Or3WJZN/3n9HTh3fgrFjhJmZmawFaGUwkJlEffc9xh83wMYqcFg7Noxinw+l9OBikirAabz7eju' +
'6sxJKTE7W4bn5+D7PrYmtI/gAFJasCwb4IzaBMHzXE8LgBJC4I1GQRKAa4Xo6upEsZiH53nIRYLe' +
'olDMCIIq+nq70dFRAGckgFKpAD+UgBaAgfRRkGvbliwUcoh8ABHFYSfWMnBrxOzL12PwKufzSvV5' +
'5Tpmi5a0IASBQCgWcujs7ABn5AQic+b5rhNlAVAmTliTEwnA990wIxEEdUQYnxjHidMnAUIcBYAB' +
'RqNDdC7BM8t0VtfTnGRd8FKdRIjJcVlCsAbPPA5UAK4rXLJjP7aNbkO9XoPrOrEQWHEm69Kua0ca' +
'YEspvCBQ5toSp9EASCkt27ZF1PlCxBOZOPo5feY0Xpg8jHe/7V3YNjhqjDRac3mMVl1Oo40vtREt' +
'W+2FYwdw/S03YHJ6EkODQ1hcXIQUcaeBlUIWsCwZ+QDLdZxcubKAtBpgNmzZliUa6yLMKiRGoBR2' +
'79yN6666FlJYABgvRhAIncUSHn/iCdQrAZjjSAiKFQQRVEhZIRJASJEACICmlAKQUtqhBETjw5ij' +
'uFqr4oWjBwHmF7/jVUHc6aRNXxAoZA3PdYXruvlldJfTaIATaQA4KU/CzNwMDp84DOYXf+hZXiij' +
'hJz+DK0QAEd+RYTOOAcgMw0g24oskNYAIoCXxDpbnsOxM8fB5qacwKZD+3WQcS+VxQrYYXNVNGMh' +
'I1odiIRQSHb8BmbCpgZYjmVLYi0ANmxQNKpOj50FFOB3WnDzEpOnFkGbuOXPimG5Ap0jLqZOLiKo' +
'MyIsVhfB9lLEpFSQ+S26jh2Fo/n0YagRCUlLRhpAAIMIyWl9vBinAkbfoIPXf+0wnrlxAs/dPInK' +
'VB1CUOsFkdhD6Nnp49oP98EvWfjvnzqGak0hVlwwFJsaoADK9vq2Y0eOOKUGJLTAjjQgFgBAy/gT' +
'vbGIyXC0nX66jJd+YgC7X1nCo39/AccfmUVQU1F5y0d9rsvGJW/txuXv7oGqMx7+2/OoVxWIzE5S' +
'OkfaBBGyhGPHc4G8YYjT+wDLDgUgJbQPWDGuL0/VcefvnMLRB2dw3Uf78dZv345D90zjsX++gPGj' +
'C7peC8yNI7DjpSVcE476rlEPB++awmP/dCEaEMtqbAP1Fqzkhn0VaUAegMzABJkaIMG8epNEiE3R' +
'0funce75Mi4NR+MV7+3B6NUFPPnvY3jupslISJkKoW9PDld/sA+7Xt6B8SMV3Pjzx3Di0TkENQaJ' +
'5A1qM8VRljKPgpg58pcNHyCz0ADSTnhNDTBBglCZruPhvz+PY4/M4Jqwg6772AB2vqwDd/zmKYwd' +
'WQAJpMalb+vGSz81AA6Ah/76HJ69KfI7tej6K7RPUKwaWQT1FmiAlJEJykXZZh5cE02FoaEJkpYE' +
'wGsKwNQGAnDhQAUP/915TJ5YwPCleZSG3WwWvwgYvryAYr8Tm5wn/2Mc5cm481c9RzXWobQPyBpS' +
'ikgDGgJAVvMARzY0AARwc7Y5Ckn3vK4TV7+/D5YncN+fnsWpJ+cgsnDICnj0n85DSOCSUBO6Rl08' +
'8g8XcObZ+VgjSKweKRG1xgcIEQnA9QE46aMgwwlHAmBuOFFepeMRd8rI1cU4FBzYn8exh2bw6D9e' +
'wNihCjgrR0wI21vAzb9yIrT/pfha7/y+nXj+5gk8EWrDzJlF/WxQUgMUwEtREGW/5RlpgJdaABq0' +
'pAGicYFVFaBzxMGV7+vFvtd3YfpsFbf+6ok4KqovxqFoph+YBBAsMg7cPonTT83jsnd247J39IQR' +
'UUcceR28cxrVcrBUX2sAa1Nar7dCAwhevCkDN7UADB9gSyEBaBVYYeT37PTw9u/aAbcg8Pi/XMAz' +
'109gfqLhFAktgX46LbrOg395DscemAnD0X68+suGQ+3L4Y7fOhVHRA00nDBRa3wAEGuAA8DbqABI' +
'kyEA2xFSrBHHM2xf4Ozz82HIOb5kbgSh1TDv69wLZdz0S8dxUTgRHLwkD2HRkgCIdBi6NBPmVpgg' +
'L7krBkrnA6xIA0Qjfl4x9Bw7XInDzHo1hblJbZYoNkvP3zqFw/fPIKgqGNC7aNoEtUQDEJkg23Ec' +
'v1qtrhkFiWYeTYzCUCEEeI15QDTSgjpnMerTmyUB1CsKrGACyvABQb1VAnAt13V8NAHRxGqotEMI' +
'QUbJFgGtMhNuqQa4Ui9HbEgDKFknioKIhC4kbGUwFBhsOGHO/AqhCxAh5dOsBZFBMoqCGhpARJv7' +
'ihul35oEt84E6U0ZCv1APp0T1tACsIhEpquZQhJsT2C9UAGjtqA2vDnPzOD/NUEqymcOJ94TcPJZ' +
'zYSFHYKIjHlA+iXk/kvyeO1XDENYtK6J16kn53H375+OBbFukBkFtWoewHAdJ1qQKwAQWcyEtQaQ' +
'4QPSmk6KZ6gXDlVAcn0x9vTpxTSjdhkBcOYmSO+KNTZlKK0GWHYoASJkZoJIABPHFnDbb5zEFxts' +
'hqEtMkG2rfcEtAZsJAoimBpgGRqg062KVmsAmBH2V2NfWKZ1woxYAyIBwFABXma+nE30wytV4rU/' +
'OK9xLWaGUmpJAHE+awEDUsrGnoCERsooyJYALfPaOEHNByBl7BGwKQsy8kYLUZ1kOTXyZprgUYJH' +
'SBzrctLHDZ6huflCLt61qtWDWAMawsgOWgCe5+v+JYN4vT6AtAbIpSCIGuEcRoaG8TrXRcwzCeZ7' +
'u2gcm4QIZn0QEudC5wGYdYxUt2PyjRSAyWsc6mvW6hW0CnpXzAdgQ6NZAdByJsgKBQAQGCp+oQFQ' +
'8ePdhUIBxWJxXfrJYKQHNRUMMK9kuwhzc3O4eO+eeLQqpbLfFfMaAgAnhdDccrSpAZYtAUApxujI' +
'EN725lfg3//7bvT19cOyLJhg44/ZCTo1y40yI79qmT4/5un2jTx0+XLtmAOAlUJXVx6ve83LdFkr' +
'dsWMTZkUTpikjFyAJUxHFr6oDc918cDDT6KyMB8xzVFpmBpAGGZHiCgVZgoRphSlQkCQTvXxEhFk' +
'lMolXnyseY28NMtlIjXaCzsHO7aPoFDIQ6nWCMDzXS2AdJvybMl4HiaSLyK89S2vxRte/wrU6vXG' +
'IFrzOxdWTZcaMNtCgq15a9vNtWyTMjUncwEguSu2ISesO3vp3YDkE2ZSypiyQMO0JO331gTFryoJ' +
'IXylVLrFOCtEpAHmaG5jbQ3Qb8r45XKFN2qCOCJpSUsxi/n5SlOP8rXB0WpoUgC8HgGwQYqI7AMH' +
'j1G9zk2Ea20wgI5iPhqs8dMk6/26GrOyiqharc16nlffvn3EaWtAc/BcBw8+/Ojc+PjkKaMvuWkN' +
'ME+YnZ17+rnnDxweHOi9iCM+gzbLOXLrG8piu46JIO5/4NHD9XpwbEPfEqjJ01R0XecDYcz8lvhF' +
'MSEkwJIBaU76AZA+SsST5oHOmidqvsHQieYk6ya/ucysT/pPon6yLum/5tXN4uV45ocAKHEeWFdQ' +
'YcpKKb4wNnH/xMTUjwGYArBofLHfuhfjeO+eXbu+/ms+946JyWl16NAxWmV80AZGImW+M0z/dxWU' +
'NbvJNQzaqNK4ro13v/NN9C//doP4gz/+mxKAWWNQb2hHzL/s0n1XDfT3W3fe8wRAVmLytCE56HM3' +
'LL/E+bRqb+niFZ9rSvD0nnHzd2Y+M3vs5Ckwc/S9QQMABgGc0cvS9fU8migi0uUDey7asfvQ4eMQ' +
'louuzs74Am0sL4TZQhHHTpzG8FB/qdRR3DU9M/sUgJqmphfjhJaa9H1v9/Ztw/1PPn0QtWoNs7Oz' +
'WBltATiOixMnzuCS/bvtgTBwCQXg6s5fNLdTmnkuSAKww0WrS7q6St7E5Ax6egbWWHpow3EcnDs/' +
'EX8v6fDw4J4XDhzxASwAEOvSAF2Wu2j3jssAQqVSQ6+ULTQ/W3+pQy/dYHauEi9Sbhsd2gGgqB2x' +
'BEDN+gCpy3rCCGjP5OQ0FHO0idGeDTexHRkoxvjEJHZsGxkE0APgnO5TYc6x1hKAIKJtu3dtGzp1' +
'+hyKxY5oB6wpDWibIRenTp3D6OhQl5RyMAiC5w0TRCtpACW+rM8aGR7cPzTYX3ziqQPw/dzmm4gt' +
'YOaYGZ7n4cTJs3jVK67xw++l23723AVtURLhaFIDEuGnG47+S33fo8mpWZQ6XUxPT6ONtfeD7dgR' +
'j6NQyNHQ0MCOUAA2ANmMBpAhhGJo//eFy6lgFsjn823zsw6cnhyHUhw74kcfe8ozfMCKAkjOAYb2' +
'7tk5cubsBTiuF3v35h1w2xwpRmgxZrBj+/AIgA4AY7pfsZYGyIi6uzv3hHOArocefQbMwNTUVFsD' +
'mjdDIUmcDgfv6OhwH4CIjie0gJfVAF3J2bVjWzgB65TnL0ygs7NrnROwthZUqzWcPHUOV1y2txiu' +
'JA/Pzc0/spYJEob5ye/Zs/NiZka5XEVPr4821gfP9xAN3nA9yB4c6Nt+cG5eLvPGDCdNUKNS7769' +
'u3ZGX1NfqwfR+s//C/PDnH5TRq+kxun8fBkdxQJGhgd2Hjx01BBAwgQl7L/I5fyd4RJE3+TUdNjI' +
'PKSc0AJg/T+JxNNnK5Uly3VuterJOpzh3hmts5DWKExy3/j6l2J4eAAjI4PbjG9UF6YQrMaBWRCu' +
'fu4fHRn0Bvp7USzkUS4vmD9as+IP3cSHWL5eXGTUizk6v/IDubodM7+++qs+ENbsg2RxLlE/5pr1' +
'Ew8H25aFnp6u2CFvGx0e0JHQGdMEJTWgkTo7d4xe3NfXg1KpiLe86TWg9ONtc3eKuVX3yatei5m1' +
'AIa6pRT9QaCeb2YporBzx7Zd0chnRkgKbaSLsMLZcK6/rzecU53n5TSAEkw/HPkFy86BpJtq3LRB' +
'IK6jq7NDhPOqPi0A0+cuuxq6EMas5bGJaVQWFWgTbrqVTdEX9f4ZvmfB9/3Il5bW2hNmnZbDB4om' +
'Lpw/h7n5RYCa+3E0ToY4Jp9XiGSYk/WMvHmlxDEn7yN5ffN4mTzrM808G+0leJqVbG81njbfjFJH' +
'Hr4no4lZ3fjRT06GoWxQ+eFHn7rTz/1Tv5QSrBQpZrAmfVMaQJyNOXHOPESjztJfs54uxFJWl5q1' +
'zYuZRzD+RzAPEufoJFln2TyMv8axwUheJPGRVSMFEHe4ZckqMy8cOXLin5f7xVUyyPypwhKAHp13' +
'IjJCVW4iHGAz30Q5mmx3I+dwyvbWE36x0ck1AFW9Gb+g06qmWkMQVuLEQEtuVldyjR/vFJqyjxNb' +
'6+mTA6DV96HMvkx0ej2pAZZxoBL5QJ8oDKIW3jxnfA5twj1xUhPMjjd9wGpOOEgIgUzaxFG8RZ4F' +
'Tgxos9N1atajtd+S1LytA26p8NKbQE7/0+BtpNakNtpoo4022vgf7lRPtKCE39oAAAAASUVORK5C' +
'YII='
);

lib.resource.add('hterm/concat/date', 'text/plain',
'Wed, 21 Sep 2022 05:56:43 +0000'
);

lib.resource.add('hterm/changelog/version', 'text/plain',
'1.92.1'
);

lib.resource.add('hterm/changelog/date', 'text/plain',
'2022-03-04'
);

lib.resource.add('hterm/git/HEAD', 'text/plain',
'83707c9fbf40758e4923302f5f911003d8bbfeba'
);

