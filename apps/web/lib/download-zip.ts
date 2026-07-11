type ZipFileInput = {
  path: string;
  data: Uint8Array;
  modifiedAt?: Date;
};

const textEncoder = new TextEncoder();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const uint16 = (value: number) => {
  const bytes = new Uint8Array(2);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, value, true);
  return bytes;
};

const uint32 = (value: number) => {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value >>> 0, true);
  return bytes;
};

const concatBytes = (parts: Uint8Array[]) => {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
};

const toArrayBuffer = (part: Uint8Array) => {
  const buffer = new ArrayBuffer(part.byteLength);
  new Uint8Array(buffer).set(part);
  return buffer;
};

const getDosDateTime = (date: Date) => {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds,
  };
};

export const encodeUtf8 = (value: string) => textEncoder.encode(value);

export const createZipBlob = (files: ZipFileInput[]) => {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const name = encodeUtf8(file.path.replace(/^\/+/, ""));
    const data = file.data;
    const checksum = crc32(data);
    const modified = getDosDateTime(file.modifiedAt ?? new Date());
    const localHeader = concatBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(modified.time),
      uint16(modified.date),
      uint32(checksum),
      uint32(data.byteLength),
      uint32(data.byteLength),
      uint16(name.byteLength),
      uint16(0),
      name,
    ]);
    const centralHeader = concatBytes([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(modified.time),
      uint16(modified.date),
      uint32(checksum),
      uint32(data.byteLength),
      uint32(data.byteLength),
      uint16(name.byteLength),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      name,
    ]);

    localParts.push(localHeader, data);
    centralParts.push(centralHeader);
    offset += localHeader.byteLength + data.byteLength;
  });

  const centralDirectory = concatBytes(centralParts);
  const endOfCentralDirectory = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralDirectory.byteLength),
    uint32(offset),
    uint16(0),
  ]);

  return new Blob(
    [...localParts, centralDirectory, endOfCentralDirectory].map(toArrayBuffer),
    {
    type: "application/zip",
    },
  );
};
