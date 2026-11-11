/** Decode Firefox's mozLz4 settings container; used only to inspect isolated test profiles. */
export function readMozLz4(bytes: Buffer): any {
  if (bytes.subarray(0, 8).toString('binary') !== 'mozLz40\0') throw new Error('Unexpected Firefox settings format');
  const output = Buffer.alloc(bytes.readUInt32LE(8)); let input = 12, cursor = 0;
  const length = (initial: number) => { let total = initial; if (initial === 15) { let next: number; do { next = bytes[input++]; total += next; } while (next === 255); } return total; };
  while (input < bytes.length) {
    const token = bytes[input++], literals = length(token >> 4);
    bytes.copy(output, cursor, input, input + literals); input += literals; cursor += literals;
    if (input >= bytes.length) break;
    const offset = bytes.readUInt16LE(input); input += 2;
    const matches = length(token & 15) + 4;
    if (!offset || offset > cursor || cursor + matches > output.length) throw new Error('Invalid LZ4 match');
    for (let n = 0; n < matches; n++) output[cursor + n] = output[cursor + n - offset];
    cursor += matches;
  }
  return JSON.parse(output.toString('utf8'));
}
