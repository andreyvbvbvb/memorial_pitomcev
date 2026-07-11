type ZipFileInput = {
  path: string;
  data: Uint8Array | Buffer;
  modifiedAt?: Date;
};

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
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value, 0);
  return bytes;
};

const uint32 = (value: number) => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value >>> 0, 0);
  return bytes;
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

const toBuffer = (data: Uint8Array | Buffer) =>
  Buffer.isBuffer(data)
    ? data
    : Buffer.from(data.buffer, data.byteOffset, data.byteLength);

export const createZipBuffer = (files: ZipFileInput[]) => {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  files.forEach((file) => {
    const name = Buffer.from(file.path.replace(/^\/+/, ""), "utf8");
    const data = toBuffer(file.data);
    const checksum = crc32(data);
    const modified = getDosDateTime(file.modifiedAt ?? new Date());
    const localHeader = Buffer.concat([
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
    const centralHeader = Buffer.concat([
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

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralDirectory.byteLength),
    uint32(offset),
    uint16(0),
  ]);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
};
