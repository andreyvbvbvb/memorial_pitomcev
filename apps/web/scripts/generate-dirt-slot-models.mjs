import fs from "fs";
import path from "path";
import zlib from "zlib";

const REPO_ROOT = path.resolve(process.cwd(), "..", "..");
const REFERENCES_DIR = path.join(REPO_ROOT, "dirt_references");
const OUTPUT_DIR = path.resolve(process.cwd(), "public", "models", "dirt", "slots");

const align4 = (value) => (value + 3) & ~3;

const hashString = (value) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const makeRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const crc32 = (buffer) => {
  let value = 0xffffffff;
  for (let index = 0; index < buffer.byteLength; index += 1) {
    value = crcTable[(value ^ buffer[index]) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
};

const createPngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.byteLength);
  chunk.writeUInt32BE(data.byteLength, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.byteLength);
  return chunk;
};

const decodePng = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${filePath} is not a PNG file`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];
  while (offset < buffer.byteLength) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) {
        throw new Error(`${filePath} uses interlaced PNG, which is not supported`);
      }
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  const channelsByType = {
    2: 3,
    6: 4
  };
  const channels = channelsByType[colorType];
  if (bitDepth !== 8 || !channels) {
    throw new Error(`${filePath} must be 8-bit RGB or RGBA PNG`);
  }

  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const rowBytes = width * channels;
  const pixels = new Uint8Array(width * height * 4);
  const previous = new Uint8Array(rowBytes);
  const current = new Uint8Array(rowBytes);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    current.set(inflated.subarray(sourceOffset, sourceOffset + rowBytes));
    sourceOffset += rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= channels ? current[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      if (filter === 1) {
        current[x] = (current[x] + left) & 0xff;
      } else if (filter === 2) {
        current[x] = (current[x] + up) & 0xff;
      } else if (filter === 3) {
        current[x] = (current[x] + Math.floor((left + up) / 2)) & 0xff;
      } else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        current[x] = (current[x] + predictor) & 0xff;
      } else if (filter !== 0) {
        throw new Error(`${filePath} uses unsupported PNG filter ${filter}`);
      }
    }
    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      const target = (y * width + x) * 4;
      pixels[target] = current[source];
      pixels[target + 1] = current[source + 1];
      pixels[target + 2] = current[source + 2];
      pixels[target + 3] = channels === 4 ? current[source + 3] : 255;
    }
    previous.set(current);
  }

  return { width, height, pixels };
};

const encodePngRgba = (width, height, pixels) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (rowBytes + 1);
    raw[rowOffset] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * rowBytes, rowBytes).copy(raw, rowOffset + 1);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    createPngChunk("IHDR", ihdr),
    createPngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    createPngChunk("IEND", Buffer.alloc(0))
  ]);
};

const pushVec3 = (target, x, y, z) => {
  target.push(x, y, z);
};

const pushVec2 = (target, x, y) => {
  target.push(x, y);
};

const normalizeVec3 = (x, y, z) => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};

const smoothstep = (edge0, edge1, value) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const isDirtPixel = (r, g, b, a) => {
  if (a < 32) {
    return false;
  }
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const warmBrown =
    r > 90 &&
    g > 45 &&
    r - g > 13 &&
    g - b > 4 &&
    r - b > 35 &&
    saturation > 0.18 &&
    b < 190;
  const orangeHighlight =
    r > 145 &&
    g > 92 &&
    b > 55 &&
    r - g > 24 &&
    g - b > 16 &&
    saturation > 0.16;
  return warmBrown || orangeHighlight;
};

const keepLargestComponent = (mask, width, height) => {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let bestPixels = [];
  let bestCount = 0;

  for (let start = 0; start < total; start += 1) {
    if (!mask[start] || visited[start]) {
      continue;
    }
    let head = 0;
    let tail = 0;
    let count = 0;
    const pixels = [];
    visited[start] = 1;
    queue[tail] = start;
    tail += 1;
    while (head < tail) {
      const current = queue[head];
      head += 1;
      count += 1;
      pixels.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x < width - 1 ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y < height - 1 ? current + width : -1
      ];
      for (const next of neighbors) {
        if (next >= 0 && mask[next] && !visited[next]) {
          visited[next] = 1;
          queue[tail] = next;
          tail += 1;
        }
      }
    }
    if (count > bestCount) {
      bestCount = count;
      bestPixels = pixels;
    }
  }

  const result = new Uint8Array(total);
  for (const pixel of bestPixels) {
    result[pixel] = 1;
  }
  return result;
};

const fillMaskInterior = (mask, width, height) => {
  const total = width * height;
  const outside = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const pushOutside = (index) => {
    if (index >= 0 && index < total && !mask[index] && !outside[index]) {
      outside[index] = 1;
      queue[tail] = index;
      tail += 1;
    }
  };

  for (let x = 0; x < width; x += 1) {
    pushOutside(x);
    pushOutside((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    pushOutside(y * width);
    pushOutside(y * width + width - 1);
  }

  while (head < tail) {
    const current = queue[head];
    head += 1;
    const x = current % width;
    const y = Math.floor(current / width);
    pushOutside(x > 0 ? current - 1 : -1);
    pushOutside(x < width - 1 ? current + 1 : -1);
    pushOutside(y > 0 ? current - width : -1);
    pushOutside(y < height - 1 ? current + width : -1);
  }

  const filled = new Uint8Array(total);
  for (let index = 0; index < total; index += 1) {
    filled[index] = outside[index] ? 0 : 1;
  }
  return filled;
};

const extractDirtMask = ({ width, height, pixels }) => {
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    mask[index] = isDirtPixel(
      pixels[offset],
      pixels[offset + 1],
      pixels[offset + 2],
      pixels[offset + 3]
    )
      ? 1
      : 0;
  }
  return fillMaskInterior(keepLargestComponent(mask, width, height), width, height);
};

const getMaskBounds = (mask, width, height) => {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      sumX += x;
      sumY += y;
      count += 1;
    }
  }
  if (count === 0) {
    return null;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    centerX: sumX / count,
    centerY: sumY / count
  };
};

const sampleImage = ({ width, height, pixels }, x, y) => {
  const clampedX = clamp(Math.round(x), 0, width - 1);
  const clampedY = clamp(Math.round(y), 0, height - 1);
  const offset = (clampedY * width + clampedX) * 4;
  return [
    pixels[offset],
    pixels[offset + 1],
    pixels[offset + 2],
    pixels[offset + 3]
  ];
};

const createReferenceTexture = (image, mask, bounds) => {
  const margin = Math.max(12, Math.round(Math.max(bounds.width, bounds.height) * 0.04));
  const sourceMinX = clamp(bounds.minX - margin, 0, image.width - 1);
  const sourceMinY = clamp(bounds.minY - margin, 0, image.height - 1);
  const sourceMaxX = clamp(bounds.maxX + margin, 0, image.width - 1);
  const sourceMaxY = clamp(bounds.maxY + margin, 0, image.height - 1);
  const sourceWidth = sourceMaxX - sourceMinX + 1;
  const sourceHeight = sourceMaxY - sourceMinY + 1;
  const maxTextureSide = 512;
  const scale = Math.min(1, maxTextureSide / Math.max(sourceWidth, sourceHeight));
  const textureWidth = Math.max(2, Math.round(sourceWidth * scale));
  const textureHeight = Math.max(2, Math.round(sourceHeight * scale));
  const rgba = new Uint8Array(textureWidth * textureHeight * 4);

  for (let y = 0; y < textureHeight; y += 1) {
    for (let x = 0; x < textureWidth; x += 1) {
      const sourceX = sourceMinX + (x / Math.max(1, textureWidth - 1)) * (sourceWidth - 1);
      const sourceY = sourceMinY + (y / Math.max(1, textureHeight - 1)) * (sourceHeight - 1);
      const [r, g, b] = sampleImage(image, sourceX, sourceY);
      const maskX = clamp(Math.round(sourceX), 0, image.width - 1);
      const maskY = clamp(Math.round(sourceY), 0, image.height - 1);
      const alpha = mask[maskY * image.width + maskX] ? 255 : 0;
      const target = (y * textureWidth + x) * 4;
      rgba[target] = r;
      rgba[target + 1] = g;
      rgba[target + 2] = b;
      rgba[target + 3] = alpha;
    }
  }

  return {
    buffer: encodePngRgba(textureWidth, textureHeight, rgba),
    sourceMinX,
    sourceMinY,
    sourceWidth,
    sourceHeight
  };
};

const uvFromImagePoint = (texture, x, y) => [
  clamp((x - texture.sourceMinX) / Math.max(1, texture.sourceWidth - 1), 0, 1),
  clamp((y - texture.sourceMinY) / Math.max(1, texture.sourceHeight - 1), 0, 1)
];

const addBlob = ({ positions, normals, indices }, random, options) => {
  const {
    centerX,
    centerZ,
    radiusX,
    radiusZ,
    height,
    segments,
    rings,
    bevels,
    rotation,
    roughness
  } = options;
  const ringCount = Math.max(3, rings);
  const bevelCount = Math.max(2, bevels);
  const phaseA = random() * Math.PI * 2;
  const phaseB = random() * Math.PI * 2;
  const phaseC = random() * Math.PI * 2;
  const harmonicA = 2 + Math.floor(random() * 3);
  const harmonicB = 5 + Math.floor(random() * 3);
  const harmonicC = 8 + Math.floor(random() * 4);
  const edgeHeights = [];
  const boundary = [];

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const wave =
      Math.sin(angle * harmonicA + phaseA) * 0.48 +
      Math.sin(angle * harmonicB + phaseB) * 0.32 +
      Math.sin(angle * harmonicC + phaseC) * 0.2;
    boundary.push(1 + wave * roughness * 0.42);
    edgeHeights.push(height * (0.08 + random() * 0.08));
  }

  const transformPoint = (angle, radiusScale, wobble, y) => {
    const localX = Math.cos(angle) * radiusX * radiusScale * wobble;
    const localZ = Math.sin(angle) * radiusZ * radiusScale * wobble;
    return [
      centerX + localX * Math.cos(rotation) - localZ * Math.sin(rotation),
      y,
      centerZ + localX * Math.sin(rotation) + localZ * Math.cos(rotation)
    ];
  };

  const centerTopIndex = positions.length / 3;
  pushVec3(positions, centerX, height, centerZ);
  pushVec3(normals, 0, 1, 0);

  const topRings = [];
  for (let ring = 1; ring <= ringCount; ring += 1) {
    const radiusScale = ring / ringCount;
    const edgeWeight = smoothstep(0.28, 1, radiusScale);
    const ringIndices = [];
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const boundaryWeight = boundary[index];
      const ringRipple =
        Math.sin(angle * 4 + phaseB + ring * 0.8) * 0.018 +
        Math.sin(angle * 7 + phaseC - ring * 0.42) * 0.012;
      const edgeHeight = edgeHeights[index];
      const y =
        height * (1 - edgeWeight * 0.82) +
        edgeHeight * edgeWeight +
        height * ringRipple * (1 - edgeWeight * 0.6);
      const [x, finalY, z] = transformPoint(angle, radiusScale, boundaryWeight, y);
      const normalTilt = 0.18 * edgeWeight;
      const [nx, ny, nz] = normalizeVec3(
        -Math.cos(angle) * normalTilt,
        1,
        -Math.sin(angle) * normalTilt
      );
      const vertexIndex = positions.length / 3;
      pushVec3(positions, x, Math.max(edgeHeight, finalY), z);
      pushVec3(normals, nx, ny, nz);
      ringIndices.push(vertexIndex);
    }
    topRings.push(ringIndices);
  }

  const firstRing = topRings[0];
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    indices.push(centerTopIndex, firstRing[index], firstRing[next]);
  }
  for (let ring = 1; ring < topRings.length; ring += 1) {
    const inner = topRings[ring - 1];
    const outer = topRings[ring];
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      indices.push(inner[index], outer[index], outer[next]);
      indices.push(inner[index], outer[next], inner[next]);
    }
  }

  const outerTop = topRings[topRings.length - 1];
  let previousBevel = outerTop;
  for (let bevel = 1; bevel <= bevelCount; bevel += 1) {
    const t = bevel / bevelCount;
    const ringIndices = [];
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const radiusScale = 1 + 0.035 * smoothstep(0, 1, t);
      const y = edgeHeights[index] * (1 - smoothstep(0, 1, t));
      const [x, finalY, z] = transformPoint(angle, radiusScale, boundary[index], y);
      const [nx, ny, nz] = normalizeVec3(Math.cos(angle), 0.24 * (1 - t), Math.sin(angle));
      const vertexIndex = positions.length / 3;
      pushVec3(positions, x, finalY, z);
      pushVec3(normals, nx, ny, nz);
      ringIndices.push(vertexIndex);
    }
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      indices.push(previousBevel[index], ringIndices[index], ringIndices[next]);
      indices.push(previousBevel[index], ringIndices[next], previousBevel[next]);
    }
    previousBevel = ringIndices;
  }
};

const makeGeometry = (variantSeed) => {
  const random = makeRandom(variantSeed);
  const main = { positions: [], normals: [], indices: [] };
  const spots = { positions: [], normals: [], indices: [] };

  const blobCount = 1 + Math.floor(random() * 3);
  for (let index = 0; index < blobCount; index += 1) {
    const radiusBase = 0.18 + random() * 0.19;
    addBlob(main, random, {
      centerX: (random() - 0.5) * 0.32,
      centerZ: (random() - 0.5) * 0.24,
      radiusX: radiusBase * (1.15 + random() * 0.55),
      radiusZ: radiusBase * (0.72 + random() * 0.42),
      height: 0.026 + random() * 0.03,
      segments: 42 + Math.floor(random() * 14),
      rings: 5 + Math.floor(random() * 2),
      bevels: 4,
      rotation: random() * Math.PI,
      roughness: 0.24 + random() * 0.26
    });
  }

  const spotCount = 4 + Math.floor(random() * 7);
  for (let index = 0; index < spotCount; index += 1) {
    const radiusBase = 0.025 + random() * 0.055;
    addBlob(spots, random, {
      centerX: (random() - 0.5) * 0.58,
      centerZ: (random() - 0.5) * 0.42,
      radiusX: radiusBase * (1.1 + random() * 0.8),
      radiusZ: radiusBase * (0.72 + random() * 0.44),
      height: 0.038 + random() * 0.035,
      segments: 24 + Math.floor(random() * 10),
      rings: 4,
      bevels: 3,
      rotation: random() * Math.PI,
      roughness: 0.18 + random() * 0.24
    });
  }

  return { main, spots };
};

const getRayRadius = (mask, width, height, centerX, centerY, angle) => {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const maxDistance = Math.hypot(width, height);
  let radius = 0;
  for (let distance = 0; distance <= maxDistance; distance += 1) {
    const x = Math.round(centerX + dx * distance);
    const y = Math.round(centerY + dy * distance);
    if (x < 0 || x >= width || y < 0 || y >= height) {
      break;
    }
    if (mask[y * width + x]) {
      radius = distance;
    }
  }
  return radius;
};

const smoothCircularValues = (values, passes = 2) => {
  let current = values.slice();
  for (let pass = 0; pass < passes; pass += 1) {
    current = current.map((value, index) => {
      const previous = current[(index - 1 + current.length) % current.length];
      const next = current[(index + 1) % current.length];
      return value * 0.55 + previous * 0.225 + next * 0.225;
    });
  }
  return current;
};

const makeReferenceGeometry = (referencePath, seed) => {
  const image = decodePng(referencePath);
  const mask = extractDirtMask(image);
  const bounds = getMaskBounds(mask, image.width, image.height);
  if (!bounds) {
    return makeGeometry(seed);
  }

  const texture = createReferenceTexture(image, mask, bounds);
  const random = makeRandom(seed ^ 0x85ebca6b);
  const segmentCount = 128;
  const ringCount = 8;
  const bevelCount = 4;
  const centerX = bounds.centerX;
  const centerY = bounds.centerY;
  const maxSide = Math.max(bounds.width, bounds.height);
  const modelScale = 0.86 / maxSide;
  const baseHeight = 0.052 + random() * 0.012;
  const radii = smoothCircularValues(
    Array.from({ length: segmentCount }, (_, index) =>
      getRayRadius(mask, image.width, image.height, centerX, centerY, (index / segmentCount) * Math.PI * 2)
    ),
    3
  );
  const main = { positions: [], normals: [], uvs: [], indices: [] };

  const addVertex = (imageX, imageY, modelY, normal = [0, 1, 0]) => {
    const modelX = (imageX - centerX) * modelScale;
    const modelZ = (imageY - centerY) * modelScale;
    const [u, v] = uvFromImagePoint(texture, imageX, imageY);
    const vertexIndex = main.positions.length / 3;
    pushVec3(main.positions, modelX, modelY, modelZ);
    pushVec3(main.normals, normal[0], normal[1], normal[2]);
    pushVec2(main.uvs, u, v);
    return vertexIndex;
  };

  const centerIndex = addVertex(centerX, centerY, baseHeight);
  const topRings = [];
  for (let ring = 1; ring <= ringCount; ring += 1) {
    const radiusScale = ring / ringCount;
    const edgeWeight = smoothstep(0.42, 1, radiusScale);
    const ringIndices = [];
    for (let index = 0; index < segmentCount; index += 1) {
      const angle = (index / segmentCount) * Math.PI * 2;
      const radius = radii[index] * radiusScale;
      const imageX = centerX + Math.cos(angle) * radius;
      const imageY = centerY + Math.sin(angle) * radius;
      const [r, g, b] = sampleImage(image, imageX, imageY);
      const brightness = (r + g + b) / (255 * 3);
      const surfaceNoise =
        Math.sin(angle * 5 + ring * 0.74) * 0.004 +
        Math.sin(angle * 11 - ring * 0.31) * 0.0025;
      const dome = 1 - Math.pow(radiusScale, 1.85);
      const modelY = Math.max(
        0.006,
        baseHeight * (0.14 + dome * 0.86) -
          baseHeight * edgeWeight * 0.34 +
          (brightness - 0.5) * 0.012 +
          surfaceNoise * (1 - edgeWeight * 0.5)
      );
      const normalTilt = 0.2 * edgeWeight;
      const normal = normalizeVec3(-Math.cos(angle) * normalTilt, 1, -Math.sin(angle) * normalTilt);
      ringIndices.push(addVertex(imageX, imageY, modelY, normal));
    }
    topRings.push(ringIndices);
  }

  for (let index = 0; index < segmentCount; index += 1) {
    const next = (index + 1) % segmentCount;
    main.indices.push(centerIndex, topRings[0][index], topRings[0][next]);
  }
  for (let ring = 1; ring < topRings.length; ring += 1) {
    const inner = topRings[ring - 1];
    const outer = topRings[ring];
    for (let index = 0; index < segmentCount; index += 1) {
      const next = (index + 1) % segmentCount;
      main.indices.push(inner[index], outer[index], outer[next]);
      main.indices.push(inner[index], outer[next], inner[next]);
    }
  }

  let previous = topRings[topRings.length - 1];
  for (let bevel = 1; bevel <= bevelCount; bevel += 1) {
    const t = bevel / bevelCount;
    const ringIndices = [];
    for (let index = 0; index < segmentCount; index += 1) {
      const angle = (index / segmentCount) * Math.PI * 2;
      const radius = radii[index] * (1 + 0.018 * smoothstep(0, 1, t));
      const imageX = centerX + Math.cos(angle) * radius;
      const imageY = centerY + Math.sin(angle) * radius;
      const modelY = baseHeight * 0.095 * (1 - smoothstep(0, 1, t));
      const normal = normalizeVec3(Math.cos(angle), 0.25 * (1 - t), Math.sin(angle));
      ringIndices.push(addVertex(imageX, imageY, modelY, normal));
    }
    for (let index = 0; index < segmentCount; index += 1) {
      const next = (index + 1) % segmentCount;
      main.indices.push(previous[index], ringIndices[index], ringIndices[next]);
      main.indices.push(previous[index], ringIndices[next], previous[next]);
    }
    previous = ringIndices;
  }

  return { main, texture: texture.buffer };
};

const createBufferView = (chunks, data, target) => {
  const padding = align4(chunks.byteLength) - chunks.byteLength;
  if (padding > 0) {
    chunks.buffers.push(Buffer.alloc(padding));
    chunks.byteLength += padding;
  }
  const byteOffset = chunks.byteLength;
  chunks.buffers.push(data);
  chunks.byteLength += data.byteLength;
  return { buffer: 0, byteOffset, byteLength: data.byteLength, target };
};

const createFloatAccessor = (gltf, chunks, values, type) => {
  const array = new Float32Array(values);
  const buffer = Buffer.from(array.buffer);
  const bufferViewIndex = gltf.bufferViews.length;
  gltf.bufferViews.push(createBufferView(chunks, buffer, 34962));
  const itemSize = type === "VEC4" ? 4 : type === "VEC3" ? 3 : type === "VEC2" ? 2 : 1;
  const accessor = {
    bufferView: bufferViewIndex,
    componentType: 5126,
    count: array.length / itemSize,
    type
  };
  if (type === "VEC3" && values.length > 0) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < values.length; index += 3) {
      min[0] = Math.min(min[0], values[index]);
      min[1] = Math.min(min[1], values[index + 1]);
      min[2] = Math.min(min[2], values[index + 2]);
      max[0] = Math.max(max[0], values[index]);
      max[1] = Math.max(max[1], values[index + 1]);
      max[2] = Math.max(max[2], values[index + 2]);
    }
    accessor.min = min;
    accessor.max = max;
  }
  const accessorIndex = gltf.accessors.length;
  gltf.accessors.push(accessor);
  return accessorIndex;
};

const createIndexAccessor = (gltf, chunks, values) => {
  const array = new Uint16Array(values);
  const buffer = Buffer.from(array.buffer);
  const bufferViewIndex = gltf.bufferViews.length;
  gltf.bufferViews.push(createBufferView(chunks, buffer, 34963));
  const accessorIndex = gltf.accessors.length;
  gltf.accessors.push({
    bufferView: bufferViewIndex,
    componentType: 5123,
    count: array.length,
    type: "SCALAR",
    min: [values.length ? Math.min(...values) : 0],
    max: [values.length ? Math.max(...values) : 0]
  });
  return accessorIndex;
};

const writeGlb = (filePath, modelName, geometry, seed) => {
  const colorRandom = makeRandom(seed ^ 0x9e3779b9);
  const mudWarmth = colorRandom();
  const baseColor = [
    0.18 + mudWarmth * 0.08,
    0.12 + mudWarmth * 0.045,
    0.07 + mudWarmth * 0.035,
    1
  ];
  const darkColor = [
    Math.max(0.08, baseColor[0] - 0.055),
    Math.max(0.055, baseColor[1] - 0.04),
    Math.max(0.035, baseColor[2] - 0.028),
    1
  ];

  const hasTexture = Boolean(geometry.texture);
  const gltf = {
    asset: {
      version: "2.0",
      generator: "memorial dirt slot generator"
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: modelName, mesh: 0 }],
    meshes: [{ name: modelName, primitives: [] }],
    materials: hasTexture
      ? [
          {
            name: `${modelName}_reference_texture`,
            doubleSided: true,
            alphaMode: "BLEND",
            pbrMetallicRoughness: {
              baseColorTexture: { index: 0 },
              metallicFactor: 0,
              roughnessFactor: 0.92
            }
          }
        ]
      : [
          {
            name: `${modelName}_mud`,
            doubleSided: true,
            pbrMetallicRoughness: {
              baseColorFactor: baseColor,
              metallicFactor: 0,
              roughnessFactor: 0.98
            }
          },
          {
            name: `${modelName}_wet_spots`,
            doubleSided: true,
            pbrMetallicRoughness: {
              baseColorFactor: darkColor,
              metallicFactor: 0,
              roughnessFactor: 0.86
            }
          }
        ],
    buffers: [{ byteLength: 0 }],
    bufferViews: [],
    accessors: []
  };
  const chunks = { buffers: [], byteLength: 0 };

  if (hasTexture) {
    gltf.samplers = [
      {
        magFilter: 9729,
        minFilter: 9729,
        wrapS: 33071,
        wrapT: 33071
      }
    ];
    gltf.images = [
      {
        bufferView: gltf.bufferViews.length,
        mimeType: "image/png"
      }
    ];
    gltf.textures = [{ sampler: 0, source: 0 }];
    gltf.bufferViews.push(createBufferView(chunks, geometry.texture, undefined));
  }

  const primitives = hasTexture ? [geometry.main] : [geometry.main, geometry.spots];
  primitives.forEach((primitiveGeometry, materialIndex) => {
    const positionAccessor = createFloatAccessor(gltf, chunks, primitiveGeometry.positions, "VEC3");
    const normalAccessor = createFloatAccessor(gltf, chunks, primitiveGeometry.normals, "VEC3");
    const indexAccessor = createIndexAccessor(gltf, chunks, primitiveGeometry.indices);
    const attributes = {
      POSITION: positionAccessor,
      NORMAL: normalAccessor
    };
    if (primitiveGeometry.uvs?.length) {
      attributes.TEXCOORD_0 = createFloatAccessor(gltf, chunks, primitiveGeometry.uvs, "VEC2");
    }
    gltf.meshes[0].primitives.push({
      attributes,
      indices: indexAccessor,
      material: materialIndex
    });
  });

  const binPadding = align4(chunks.byteLength) - chunks.byteLength;
  if (binPadding > 0) {
    chunks.buffers.push(Buffer.alloc(binPadding));
    chunks.byteLength += binPadding;
  }
  const bin = Buffer.concat(chunks.buffers, chunks.byteLength);
  gltf.buffers[0].byteLength = bin.byteLength;

  const jsonBufferRaw = Buffer.from(JSON.stringify(gltf), "utf8");
  const jsonPadding = align4(jsonBufferRaw.byteLength) - jsonBufferRaw.byteLength;
  const jsonBuffer = Buffer.concat([jsonBufferRaw, Buffer.alloc(jsonPadding, 0x20)]);
  const totalLength = 12 + 8 + jsonBuffer.byteLength + 8 + bin.byteLength;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.byteLength, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.byteLength, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(filePath, Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, bin]));
};

const referenceFiles = fs.existsSync(REFERENCES_DIR)
  ? fs
      .readdirSync(REFERENCES_DIR)
      .filter((file) => /^dirt_\d+_ref\.(png|jpe?g|webp)$/i.test(file))
      .sort((a, b) => {
        const aNumber = Number(a.match(/dirt_(\d+)_ref/i)?.[1] ?? 0);
        const bNumber = Number(b.match(/dirt_(\d+)_ref/i)?.[1] ?? 0);
        return aNumber - bNumber;
      })
  : [];

const modelNumbers =
  referenceFiles.length > 0
    ? referenceFiles.map((file) => Number(file.match(/dirt_(\d+)_ref/i)?.[1] ?? 0)).filter(Boolean)
    : Array.from({ length: 12 }, (_, index) => index + 1);
const referenceByModelNumber = new Map(
  referenceFiles.map((file) => [
    Number(file.match(/dirt_(\d+)_ref/i)?.[1] ?? 0),
    path.join(REFERENCES_DIR, file)
  ])
);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
modelNumbers.forEach((modelNumber) => {
  const seed = hashString(`dirt-slot-model:${modelNumber}`);
  const referencePath = referenceByModelNumber.get(modelNumber);
  writeGlb(
    path.join(OUTPUT_DIR, `dirt_${modelNumber}.glb`),
    `dirt_${modelNumber}`,
    referencePath ? makeReferenceGeometry(referencePath, seed) : makeGeometry(seed),
    seed
  );
});

console.log(`Generated ${modelNumbers.length} dirt slot models in ${OUTPUT_DIR}`);
