/**
 * Wire format for `fieldSnapshot(revision)`, SPEC-PORTFOLIO-FIELD-1.0 D3.
 *
 * The payload is struct of arrays rather than array of structs because D4 binds
 * the positions range straight into a wgpu buffer as `vec2<f32>` instances.
 * Interleaving the per symbol fields would force a repacking pass on every
 * snapshot load, and C2 rules out paying that cost anywhere near the frame path.
 *
 * Section offsets are derived from the counts by `sectionLayout` instead of
 * being written into the header, so an encoder and a decoder cannot disagree
 * about where a section starts. The Rust writer that D3 adds to
 * `field_projection.rs` has to produce exactly this layout; `LAYOUT_CONTRACT`
 * is the string both sides hash into their fixture manifests to prove it.
 */

/** "TFS1" read as a little endian u32. */
export const FIELD_SNAPSHOT_MAGIC = 0x31534654;
export const FIELD_SNAPSHOT_VERSION = 2;

/** Header is six u32 fields padded to an eight byte boundary. */
export const HEADER_BYTES = 32;

/** D3 payload cap. Above this the resolver refuses and ingest must shrink the revision set. */
export const MAX_PAYLOAD_BYTES = 24 * 1024 * 1024;

/**
 * Human readable statement of the layout. Hashed into the fixture manifest so a
 * change to the format cannot pass review as a change to the data.
 */
export const LAYOUT_CONTRACT = [
  'header:u32[magic,version,symbolCount,edgeCount,repoCount,clusterCount]@0..32',
  'positions:f32[2*symbolCount]',
  'repoIndex:u16[symbolCount]',
  'clusterId:u16[symbolCount]',
  'degree:u16[symbolCount]',
  'ordinal:u32[symbolCount]',
  'csrOffsets:u32[symbolCount+1]',
  'csrNeighbors:u32[edgeCount]',
  'csrWeights:f32[edgeCount]',
  'csrEdgeType:u8[edgeCount]',
  'sections aligned to 4 bytes, all values little endian',
].join(';');

/** Largest value `degree` can carry. Higher in degrees saturate here. */
export const MAX_DEGREE = 0xffff;

/**
 * Edge types the field carries, as the u8 written into `csrEdgeType`.
 *
 * `NEAR` is C5's kNN edge, the semantic one. `DECLARES_SYMBOL` is the symbol
 * level projection of the `code_kg` edge a `CodeFile` has to each symbol it
 * declares, and it is the structural one: it says two symbols were written in
 * the same file, which is a fact about the repository rather than about the
 * vectors. Both names are the edge type strings the server already uses, so the
 * scrubber's legend and D3's Rust writer do not need a translation table.
 *
 * The column is u8 rather than a bitmask because an edge has exactly one type.
 * A pair that is both NEAR and declared together appears as two edges, which is
 * what `undirected_weighted_adjacency` in `graph_csr.rs` sums.
 */
export const EDGE_TYPE_NEAR = 0;
export const EDGE_TYPE_DECLARES_SYMBOL = 1;

/** Index by the u8 above. The order is the wire order and cannot be reshuffled. */
export const EDGE_TYPE_NAMES = ['NEAR', 'DECLARES_SYMBOL'] as const;

export type EdgeTypeName = (typeof EDGE_TYPE_NAMES)[number];

export interface FieldSnapshotBinary {
  symbolCount: number;
  edgeCount: number;
  repoCount: number;
  clusterCount: number;
  /** x,y pairs, one per symbol, in ordinal order. */
  positions: Float32Array;
  repoIndex: Uint16Array;
  clusterId: Uint16Array;
  degree: Uint16Array;
  ordinal: Uint32Array;
  csrOffsets: Uint32Array;
  csrNeighbors: Uint32Array;
  csrWeights: Float32Array;
  /** One `EDGE_TYPE_*` per edge, parallel to `csrNeighbors`. */
  csrEdgeType: Uint8Array;
}

interface Section {
  byteOffset: number;
  elements: number;
}

export interface SectionLayout {
  positions: Section;
  repoIndex: Section;
  clusterId: Section;
  degree: Section;
  ordinal: Section;
  csrOffsets: Section;
  csrNeighbors: Section;
  csrWeights: Section;
  csrEdgeType: Section;
  totalBytes: number;
}

function align4(offset: number): number {
  return (offset + 3) & ~3;
}

/**
 * Derive every section's byte offset from the two counts. Encoder and decoder
 * both call this, which is what makes the format single sourced.
 */
export function sectionLayout(symbolCount: number, edgeCount: number): SectionLayout {
  let cursor = HEADER_BYTES;

  const place = (elements: number, bytesPerElement: number): Section => {
    const byteOffset = align4(cursor);
    cursor = byteOffset + elements * bytesPerElement;
    return { byteOffset, elements };
  };

  const positions = place(symbolCount * 2, 4);
  const repoIndex = place(symbolCount, 2);
  const clusterId = place(symbolCount, 2);
  const degree = place(symbolCount, 2);
  const ordinal = place(symbolCount, 4);
  const csrOffsets = place(symbolCount + 1, 4);
  const csrNeighbors = place(edgeCount, 4);
  const csrWeights = place(edgeCount, 4);
  // Last, and one byte wide, so every wider section above it stays naturally
  // aligned without padding between them.
  const csrEdgeType = place(edgeCount, 1);

  return {
    positions,
    repoIndex,
    clusterId,
    degree,
    ordinal,
    csrOffsets,
    csrNeighbors,
    csrWeights,
    csrEdgeType,
    totalBytes: align4(cursor),
  };
}

/**
 * How many edges of each type the field carries, indexed by the u8.
 *
 * Derived from the column rather than recorded in the header, so a payload
 * cannot claim a count its edges do not back up.
 */
export function countEdgeTypes(csrEdgeType: Uint8Array): number[] {
  const counts = new Array<number>(EDGE_TYPE_NAMES.length).fill(0);
  for (const type of csrEdgeType) {
    if (type < counts.length) counts[type] += 1;
  }
  return counts;
}

export class FieldSnapshotFormatError extends Error {}

/** Thrown when a snapshot exceeds the D3 cap. Carries the reason the resolver reports. */
export class FieldSnapshotTooLargeError extends Error {
  byteLength: number;
  capBytes: number;

  constructor(byteLength: number, capBytes: number = MAX_PAYLOAD_BYTES) {
    super(
      `fieldSnapshot payload is ${byteLength} bytes, over the ${capBytes} byte cap. ` +
        'Lower the revision set in the ingest allowlist.',
    );
    this.name = 'FieldSnapshotTooLargeError';
    this.byteLength = byteLength;
    this.capBytes = capBytes;
  }
}

export function encodeFieldSnapshot(snapshot: FieldSnapshotBinary): Uint8Array {
  const { symbolCount, edgeCount } = snapshot;
  assertShape(snapshot);

  const layout = sectionLayout(symbolCount, edgeCount);
  if (layout.totalBytes > MAX_PAYLOAD_BYTES) {
    throw new FieldSnapshotTooLargeError(layout.totalBytes);
  }

  const buffer = new ArrayBuffer(layout.totalBytes);
  const view = new DataView(buffer);

  view.setUint32(0, FIELD_SNAPSHOT_MAGIC, true);
  view.setUint32(4, FIELD_SNAPSHOT_VERSION, true);
  view.setUint32(8, symbolCount, true);
  view.setUint32(12, edgeCount, true);
  view.setUint32(16, snapshot.repoCount, true);
  view.setUint32(20, snapshot.clusterCount, true);

  new Float32Array(buffer, layout.positions.byteOffset, layout.positions.elements)
    .set(snapshot.positions);
  new Uint16Array(buffer, layout.repoIndex.byteOffset, layout.repoIndex.elements)
    .set(snapshot.repoIndex);
  new Uint16Array(buffer, layout.clusterId.byteOffset, layout.clusterId.elements)
    .set(snapshot.clusterId);
  new Uint16Array(buffer, layout.degree.byteOffset, layout.degree.elements)
    .set(snapshot.degree);
  new Uint32Array(buffer, layout.ordinal.byteOffset, layout.ordinal.elements)
    .set(snapshot.ordinal);
  new Uint32Array(buffer, layout.csrOffsets.byteOffset, layout.csrOffsets.elements)
    .set(snapshot.csrOffsets);
  new Uint32Array(buffer, layout.csrNeighbors.byteOffset, layout.csrNeighbors.elements)
    .set(snapshot.csrNeighbors);
  new Float32Array(buffer, layout.csrWeights.byteOffset, layout.csrWeights.elements)
    .set(snapshot.csrWeights);
  new Uint8Array(buffer, layout.csrEdgeType.byteOffset, layout.csrEdgeType.elements)
    .set(snapshot.csrEdgeType);

  return new Uint8Array(buffer);
}

/**
 * Decode a payload into typed array views.
 *
 * The views alias the incoming bytes rather than copying, so a caller that
 * uploads `positions` to the GPU hands over the same memory the transport
 * delivered. Callers that mutate must copy first.
 */
export function decodeFieldSnapshot(bytes: Uint8Array): FieldSnapshotBinary {
  if (bytes.byteLength < HEADER_BYTES) {
    throw new FieldSnapshotFormatError(
      `payload is ${bytes.byteLength} bytes, shorter than the ${HEADER_BYTES} byte header`,
    );
  }

  // A Uint8Array can sit at any byteOffset, but Float32Array views cannot.
  // Realign onto a fresh buffer only when the incoming slice forces it.
  const aligned = bytes.byteOffset % 4 === 0 ? bytes : new Uint8Array(bytes);
  const buffer = aligned.buffer;
  const base = aligned.byteOffset;
  const view = new DataView(buffer, base, aligned.byteLength);

  const magic = view.getUint32(0, true);
  if (magic !== FIELD_SNAPSHOT_MAGIC) {
    throw new FieldSnapshotFormatError(
      `bad magic 0x${magic.toString(16)}, expected 0x${FIELD_SNAPSHOT_MAGIC.toString(16)}`,
    );
  }

  const version = view.getUint32(4, true);
  if (version !== FIELD_SNAPSHOT_VERSION) {
    throw new FieldSnapshotFormatError(
      `snapshot version ${version} is not the supported version ${FIELD_SNAPSHOT_VERSION}`,
    );
  }

  const symbolCount = view.getUint32(8, true);
  const edgeCount = view.getUint32(12, true);
  const repoCount = view.getUint32(16, true);
  const clusterCount = view.getUint32(20, true);

  const layout = sectionLayout(symbolCount, edgeCount);
  if (aligned.byteLength < layout.totalBytes) {
    throw new FieldSnapshotFormatError(
      `payload is ${aligned.byteLength} bytes but ${symbolCount} symbols and ` +
        `${edgeCount} edges need ${layout.totalBytes}`,
    );
  }

  const at = (section: Section) => base + section.byteOffset;

  return {
    symbolCount,
    edgeCount,
    repoCount,
    clusterCount,
    positions: new Float32Array(buffer, at(layout.positions), layout.positions.elements),
    repoIndex: new Uint16Array(buffer, at(layout.repoIndex), layout.repoIndex.elements),
    clusterId: new Uint16Array(buffer, at(layout.clusterId), layout.clusterId.elements),
    degree: new Uint16Array(buffer, at(layout.degree), layout.degree.elements),
    ordinal: new Uint32Array(buffer, at(layout.ordinal), layout.ordinal.elements),
    csrOffsets: new Uint32Array(buffer, at(layout.csrOffsets), layout.csrOffsets.elements),
    csrNeighbors: new Uint32Array(buffer, at(layout.csrNeighbors), layout.csrNeighbors.elements),
    csrWeights: new Float32Array(buffer, at(layout.csrWeights), layout.csrWeights.elements),
    csrEdgeType: new Uint8Array(buffer, at(layout.csrEdgeType), layout.csrEdgeType.elements),
  };
}

function assertShape(snapshot: FieldSnapshotBinary): void {
  const { symbolCount, edgeCount } = snapshot;
  const expect = (name: string, actual: number, wanted: number) => {
    if (actual !== wanted) {
      throw new FieldSnapshotFormatError(
        `${name} has ${actual} elements, expected ${wanted}`,
      );
    }
  };

  expect('positions', snapshot.positions.length, symbolCount * 2);
  expect('repoIndex', snapshot.repoIndex.length, symbolCount);
  expect('clusterId', snapshot.clusterId.length, symbolCount);
  expect('degree', snapshot.degree.length, symbolCount);
  expect('ordinal', snapshot.ordinal.length, symbolCount);
  expect('csrOffsets', snapshot.csrOffsets.length, symbolCount + 1);
  expect('csrNeighbors', snapshot.csrNeighbors.length, edgeCount);
  expect('csrWeights', snapshot.csrWeights.length, edgeCount);
  expect('csrEdgeType', snapshot.csrEdgeType.length, edgeCount);

  if (symbolCount > 0 && snapshot.csrOffsets[symbolCount] !== edgeCount) {
    throw new FieldSnapshotFormatError(
      `csrOffsets ends at ${snapshot.csrOffsets[symbolCount]}, expected edgeCount ${edgeCount}`,
    );
  }
}
