import { generateChunk, transferables, type ChunkRequest } from "../generation/generateChunk";

/** Builds terrain meshes and vegetation placement off the main thread. */
self.onmessage = (event: MessageEvent<ChunkRequest>) => {
  const result = generateChunk(event.data);
  (self as unknown as Worker).postMessage(result, transferables(result));
};
