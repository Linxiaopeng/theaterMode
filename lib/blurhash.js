/**
 * BlurHash Pure JS Implementation (Encode & Decode)
 * Reference: https://github.com/woltapp/blurhash
 * Zero dependencies, cross-browser compatible.
 */
(function (global) {
  const digits =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

  function decode83(str) {
    let value = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      const index = digits.indexOf(c);
      if (index !== -1) {
        value = value * 83 + index;
      }
    }
    return value;
  }

  function encode83(value, length) {
    let result = '';
    for (let i = 1; i <= length; i++) {
      const digit = Math.floor(value / Math.pow(83, length - i)) % 83;
      result += digits[digit];
    }
    return result;
  }

  function sRGBToLinear(value) {
    const v = value / 255;
    if (v <= 0.04045) return v / 12.92;
    return Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function linearToSRGB(value) {
    const v = Math.max(0, Math.min(1, value));
    if (v <= 0.0031308) return Math.round(v * 12.92 * 255);
    return Math.round((1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
  }

  function signPow(val, exp) {
    return Math.sign(val) * Math.pow(Math.abs(val), exp);
  }

  function decodeDC(value) {
    const r = value >> 16;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return [sRGBToLinear(r), sRGBToLinear(g), sRGBToLinear(b)];
  }

  function decodeAC(value, maxAC) {
    const rQuant = Math.floor(value / (19 * 19));
    const gQuant = Math.floor(value / 19) % 19;
    const bQuant = value % 19;
    return [
      signPow((rQuant - 9) / 9, 2) * maxAC,
      signPow((gQuant - 9) / 9, 2) * maxAC,
      signPow((bQuant - 9) / 9, 2) * maxAC
    ];
  }

  function encodeDC(value) {
    const r = linearToSRGB(value[0]);
    const g = linearToSRGB(value[1]);
    const b = linearToSRGB(value[2]);
    return (r << 16) + (g << 8) + b;
  }

  function encodeAC(value, maxAC) {
    const rQuant = Math.max(0, Math.min(18, Math.floor(signPow(value[0] / maxAC, 0.5) * 9 + 9.5)));
    const gQuant = Math.max(0, Math.min(18, Math.floor(signPow(value[1] / maxAC, 0.5) * 9 + 9.5)));
    const bQuant = Math.max(0, Math.min(18, Math.floor(signPow(value[2] / maxAC, 0.5) * 9 + 9.5)));
    return rQuant * 19 * 19 + gQuant * 19 + bQuant;
  }

  function decode(blurhash, width, height, punch = 1) {
    if (!blurhash || blurhash.length < 6) return null;
    const sizeFlag = decode83(blurhash[0]);
    const numY = Math.floor(sizeFlag / 9) + 1;
    const numX = (sizeFlag % 9) + 1;

    const quantisedMaximumValue = decode83(blurhash[1]);
    const maximumValue = (quantisedMaximumValue + 1) / 166;

    if (blurhash.length !== 4 + 2 * numX * numY) return null;

    const colors = new Array(numX * numY);
    colors[0] = decodeDC(decode83(blurhash.substring(2, 6)));

    for (let i = 1; i < numX * numY; i++) {
      const value = decode83(blurhash.substring(4 + i * 2, 6 + i * 2));
      colors[i] = decodeAC(value, maximumValue * punch);
    }

    const pixels = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0;

        for (let j = 0; j < numY; j++) {
          for (let i = 0; i < numX; i++) {
            const basis =
              Math.cos((Math.PI * x * i) / width) * Math.cos((Math.PI * y * j) / height);
            const color = colors[i + j * numX];
            r += color[0] * basis;
            g += color[1] * basis;
            b += color[2] * basis;
          }
        }

        const pxIndex = (x + y * width) * 4;
        pixels[pxIndex] = linearToSRGB(r);
        pixels[pxIndex + 1] = linearToSRGB(g);
        pixels[pxIndex + 2] = linearToSRGB(b);
        pixels[pxIndex + 3] = 255;
      }
    }

    return pixels;
  }

  function encode(pixels, width, height, componentX = 4, componentY = 3) {
    if (componentX < 1 || componentX > 9 || componentY < 1 || componentY > 9) {
      throw new Error('BlurHash components must be between 1 and 9');
    }

    const factors = [];
    for (let j = 0; j < componentY; j++) {
      for (let i = 0; i < componentX; i++) {
        const normalisation = i === 0 && j === 0 ? 1 : 2;
        let r = 0,
          g = 0,
          b = 0;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const basis =
              Math.cos((Math.PI * i * x) / width) * Math.cos((Math.PI * j * y) / height);
            const idx = (x + y * width) * 4;
            r += basis * sRGBToLinear(pixels[idx]);
            g += basis * sRGBToLinear(pixels[idx + 1]);
            b += basis * sRGBToLinear(pixels[idx + 2]);
          }
        }

        const scale = normalisation / (width * height);
        factors.push([r * scale, g * scale, b * scale]);
      }
    }

    const dc = factors[0];
    const ac = factors.slice(1);

    let hash = '';
    const sizeFlag = componentX - 1 + (componentY - 1) * 9;
    hash += encode83(sizeFlag, 1);

    let maximumValue = 0;
    if (ac.length > 0) {
      for (let i = 0; i < ac.length; i++) {
        maximumValue = Math.max(
          maximumValue,
          Math.abs(ac[i][0]),
          Math.abs(ac[i][1]),
          Math.abs(ac[i][2])
        );
      }
      const quantisedMaximumValue = Math.max(0, Math.min(82, Math.floor(maximumValue * 166 - 1)));
      hash += encode83(quantisedMaximumValue, 1);
      maximumValue = (quantisedMaximumValue + 1) / 166;
    } else {
      hash += encode83(0, 1);
    }

    hash += encode83(encodeDC(dc), 4);

    for (let i = 0; i < ac.length; i++) {
      hash += encode83(encodeAC(ac[i], maximumValue), 2);
    }

    return hash;
  }

  const BlurHash = {
    encode,
    decode
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlurHash;
  } else {
    global.BlurHash = BlurHash;
  }
})(typeof self !== 'undefined' ? self : this);
