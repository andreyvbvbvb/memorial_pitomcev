import fs from "fs";
import path from "path";

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

const pushVec3 = (target, x, y, z) => {
  target.push(x, y, z);
};

const normalizeVec3 = (x, y, z) => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};

const smoothstep = (edge0, edge1, value) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

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
  const itemSize = type === "VEC3" ? 3 : 1;
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

  const gltf = {
    asset: {
      version: "2.0",
      generator: "memorial dirt slot generator"
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: modelName, mesh: 0 }],
    meshes: [{ name: modelName, primitives: [] }],
    materials: [
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

  [geometry.main, geometry.spots].forEach((primitiveGeometry, materialIndex) => {
    const positionAccessor = createFloatAccessor(gltf, chunks, primitiveGeometry.positions, "VEC3");
    const normalAccessor = createFloatAccessor(gltf, chunks, primitiveGeometry.normals, "VEC3");
    const indexAccessor = createIndexAccessor(gltf, chunks, primitiveGeometry.indices);
    gltf.meshes[0].primitives.push({
      attributes: {
        POSITION: positionAccessor,
        NORMAL: normalAccessor
      },
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

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
modelNumbers.forEach((modelNumber) => {
  const seed = hashString(`dirt-slot-model:${modelNumber}`);
  writeGlb(
    path.join(OUTPUT_DIR, `dirt_${modelNumber}.glb`),
    `dirt_${modelNumber}`,
    makeGeometry(seed),
    seed
  );
});

console.log(`Generated ${modelNumbers.length} dirt slot models in ${OUTPUT_DIR}`);
