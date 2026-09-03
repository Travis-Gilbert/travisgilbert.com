/**
 * D3's wire format, tested at its edges.
 *
 * The round trip is the obvious half. The half that matters more is that a
 * decoder rejects a payload it cannot read rather than reading garbage: a
 * truncated section or a header from a future version has to fail loudly,
 * because the alternative is a field whose positions belong to other symbols.
 */

import { describe, expect, it } from 'vitest';

import {
  FIELD_SNAPSHOT_MAGIC,
  FIELD_SNAPSHOT_VERSION,
  FieldSnapshotFormatError,
  HEADER_BYTES,
  LAYOUT_CONTRACT,
  EDGE_TYPE_DECLARES_SYMBOL,
  EDGE_TYPE_NEAR,
  decodeFieldSnapshot,
  encodeFieldSnapshot,
  sectionLayout,
  type FieldSnapshotBinary,
} from '@/lib/portfolio/fieldSnapshot';

/** A three symbol, four edge field small enough to reason about by hand. */
function sample(): FieldSnapshotBinary {
  return {
    symbolCount: 3,
    edgeCount: 4,
    repoCount: 2,
    clusterCount: 2,
    positions: new Float32Array([0, 0, 1.5, -2.25, -0.5, 0.75]),
    repoIndex: new Uint16Array([0, 1, 1]),
    clusterId: new Uint16Array([0, 0, 1]),
    degree: new Uint16Array([2, 3, 3]),
    ordinal: new Uint32Array([0, 1, 2]),
    csrOffsets: new Uint32Array([0, 1, 3, 4]),
    csrNeighbors: new Uint32Array([1, 0, 2, 1]),
    csrWeights: new Float32Array([0.5, 0.5, 0.25, 0.25]),
    csrEdgeType: new Uint8Array([
      EDGE_TYPE_NEAR,
      EDGE_TYPE_NEAR,
      EDGE_TYPE_DECLARES_SYMBOL,
      EDGE_TYPE_DECLARES_SYMBOL,
    ]),
  };
}

describe('fieldSnapshot codec', () => {
  it('round trips every section', () => {
    const original = sample();
    const decoded = decodeFieldSnapshot(encodeFieldSnapshot(original));

    expect(decoded.symbolCount).toBe(original.symbolCount);
    expect(decoded.edgeCount).toBe(original.edgeCount);
    expect(decoded.repoCount).toBe(original.repoCount);
    expect(decoded.clusterCount).toBe(original.clusterCount);
    expect(Array.from(decoded.positions)).toEqual(Array.from(original.positions));
    expect(Array.from(decoded.repoIndex)).toEqual(Array.from(original.repoIndex));
    expect(Array.from(decoded.clusterId)).toEqual(Array.from(original.clusterId));
    expect(Array.from(decoded.degree)).toEqual(Array.from(original.degree));
    expect(Array.from(decoded.ordinal)).toEqual(Array.from(original.ordinal));
    expect(Array.from(decoded.csrOffsets)).toEqual(Array.from(original.csrOffsets));
    expect(Array.from(decoded.csrNeighbors)).toEqual(Array.from(original.csrNeighbors));
    expect(Array.from(decoded.csrWeights)).toEqual(Array.from(original.csrWeights));
    expect(Array.from(decoded.csrEdgeType)).toEqual(Array.from(original.csrEdgeType));
  });

  it('encodes deterministically', () => {
    const a = encodeFieldSnapshot(sample());
    const b = encodeFieldSnapshot(sample());
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('derives the same section offsets on both sides', () => {
    const layout = sectionLayout(3, 4);
    expect(layout.totalBytes).toBe(encodeFieldSnapshot(sample()).byteLength);
    expect(layout.positions.byteOffset).toBe(HEADER_BYTES);
    // Every section starts on a 4 byte boundary so the decoder can alias rather
    // than copy, which is what keeps `positions` bindable straight to wgpu.
    for (const section of Object.values(layout)) {
      if (typeof section === 'number') continue;
      expect(section.byteOffset % 4).toBe(0);
    }
  });

  it('decodes a payload offset inside a larger buffer', () => {
    // Node hands `readFileSync` results out of a pooled buffer, so a payload
    // almost never starts at byte zero of its ArrayBuffer. A decoder that
    // ignores byteOffset reads whatever the pool held before it.
    const payload = encodeFieldSnapshot(sample());
    const padded = new Uint8Array(payload.byteLength + 3);
    padded.set(payload, 3);
    const decoded = decodeFieldSnapshot(padded.subarray(3));
    expect(Array.from(decoded.positions)).toEqual([0, 0, 1.5, -2.25, -0.5, 0.75]);
  });

  it('rejects a bad magic', () => {
    const bytes = encodeFieldSnapshot(sample());
    new DataView(bytes.buffer, bytes.byteOffset).setUint32(0, FIELD_SNAPSHOT_MAGIC + 1, true);
    expect(() => decodeFieldSnapshot(bytes)).toThrow(FieldSnapshotFormatError);
  });

  it('rejects a version it was not written for', () => {
    const bytes = encodeFieldSnapshot(sample());
    new DataView(bytes.buffer, bytes.byteOffset).setUint32(4, FIELD_SNAPSHOT_VERSION + 1, true);
    expect(() => decodeFieldSnapshot(bytes)).toThrow(FieldSnapshotFormatError);
  });

  it('rejects a truncated payload', () => {
    const bytes = encodeFieldSnapshot(sample());
    expect(() => decodeFieldSnapshot(bytes.subarray(0, bytes.byteLength - 4))).toThrow(
      FieldSnapshotFormatError,
    );
  });

  it('rejects a header shorter than the header', () => {
    expect(() => decodeFieldSnapshot(new Uint8Array(HEADER_BYTES - 1))).toThrow(
      FieldSnapshotFormatError,
    );
  });

  it('states the layout contract the Rust writer has to match', () => {
    // Pinned so a format change cannot land as a data change. If this fails,
    // the fixture manifest and `field_projection.rs` both need re-recording.
    expect(LAYOUT_CONTRACT).toBe(
      'header:u32[magic,version,symbolCount,edgeCount,repoCount,clusterCount]@0..32;' +
        'positions:f32[2*symbolCount];repoIndex:u16[symbolCount];clusterId:u16[symbolCount];' +
        'degree:u16[symbolCount];ordinal:u32[symbolCount];csrOffsets:u32[symbolCount+1];' +
        'csrNeighbors:u32[edgeCount];csrWeights:f32[edgeCount];' +
        'csrEdgeType:u8[edgeCount];' +
        'sections aligned to 4 bytes, all values little endian',
    );
  });
});
