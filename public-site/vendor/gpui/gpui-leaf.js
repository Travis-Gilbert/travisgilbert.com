// The GPUI leaf mount, owned by neither renderer.
//
// A GPUI leaf is a `<canvas>` that GPUI appends to `document.body` on startup
// and that a host element then adopts. Everything about that dance - waiting
// for the canvas to appear, checking readiness, re-dispatching `resize` when
// the host's box changes, draining the leaf's intent queues, and taking it all
// back down - is a property of GPUI's web runtime, not of the framework that
// happens to own the surrounding DOM.
//
// The Leptos shell keeps this dance in one bridge. A second framework-specific
// copy would be another lifecycle implementation to keep in step, and the copy
// that is not being exercised is the one that rots. Hosts differ in exactly one
// place - where a drained payload goes - so that is the only thing passed in.

const REGISTRY_KEY = "__theoremGpuiLeaf";
const LEAF_DRAIN_POLL_MS = 16;
const LEAF_STARTUP_TIMEOUT_MS = 15_000;
const LEAF_STARTUP_POLL_MS = 100;

function registry() {
  const state = (globalThis[REGISTRY_KEY] ??= {
    runtimes: new Map(),
    instances: new Map(),
  });
  // A host projection can arrive while the WASM module is still compiling.
  // Keep the newest level-triggered document until the leaf can consume it.
  state.pendingDocuments ??= new Map();
  return state;
}

// Background and automation targets may throttle requestAnimationFrame to a
// cadence far below display refresh. A timer wakeup keeps the startup deadline
// meaningful without replacing frames as the preferred foreground signal.
function waitForLifecycleTurn(timeoutMs) {
  if (timeoutMs <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let frameId;
    let timeoutId;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      resolve();
    };
    timeoutId = setTimeout(finish, timeoutMs);
    frameId = requestAnimationFrame(finish);
  });
}

function waitForStartupTurn(deadline) {
  const remaining = deadline - performance.now();
  return waitForLifecycleTurn(Math.min(LEAF_STARTUP_POLL_MS, remaining));
}

// Loro peer ids are local editor identities, not document identities. A fresh
// browser leaf therefore gets one cryptographically random non-zero u64 and
// keeps it for every projection reapplied to that mounted instance.
function createDocumentPeerId() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("the document leaf requires Web Crypto for its editor peer identity");
  }
  const words = new Uint32Array(2);
  globalThis.crypto.getRandomValues(words);
  let peerId = (BigInt(words[0]) << 32n) | BigInt(words[1]);
  if (peerId === 0n) peerId = 1n;
  return peerId.toString();
}

// The composer only takes a host draft when `draftRevision` bumps, so
// reapplying a projection cannot stomp text the writer typed in between. That
// guarantee is what makes it safe to reapply on every effect run rather than
// only at mount.
function applyDocuments(module, leaf, primaryDocument, composerDocument, documentPeerId = null) {
  if (leaf === "record-form") {
    if (primaryDocument) module.setRecordFormDocument(primaryDocument);
    return;
  }
  if (leaf === "thread") {
    if (primaryDocument) module.setThreadDocument(primaryDocument);
    if (composerDocument) module.setComposerDocument(composerDocument);
    return;
  }
  if (leaf === "document") {
    if (primaryDocument) {
      if (!documentPeerId) throw new Error("the document leaf has no editor peer identity");
      module.setDocumentDocument(primaryDocument, documentPeerId);
    }
    if (composerDocument) module.setDocumentComposerDocument(composerDocument);
    return;
  }
  if (!primaryDocument) return;
  if (leaf === "story") {
    module.setStoryDocument(primaryDocument);
    return;
  }
  module.setChatSurfaceDocument(primaryDocument);
}

// The drawer's envelope is the bare command it has always sent, because
// `ChatRoot` already consumes that shape. The main leaf drains two queues and
// therefore has to say which one spoke.
function drainLeaf(module, leaf) {
  // The specimen leaf raises nothing: it is a render, not a surface.
  if (leaf === "story") return [];
  if (leaf === "thread") {
    const payloads = [];
    const threadIntents = module.takeThreadIntents();
    if (threadIntents) payloads.push({ source: "thread", intents: JSON.parse(threadIntents) });
    const composerIntents = module.takeComposerIntents();
    if (composerIntents) payloads.push({ source: "composer", intents: JSON.parse(composerIntents) });
    return payloads;
  }
  if (leaf === "document") {
    const payloads = [];
    const documentIntents = module.takeDocumentIntents();
    if (documentIntents) {
      payloads.push({ source: "document", intents: JSON.parse(documentIntents) });
    }
    const composerIntents = module.takeDocumentComposerIntents();
    if (composerIntents) {
      payloads.push({ source: "composer", intents: JSON.parse(composerIntents) });
    }
    return payloads;
  }
  if (leaf === "record-form") {
    const intents = module.takeRecordFormIntents();
    return intents ? [{ source: "record-form", intents: JSON.parse(intents) }] : [];
  }
  const command = module.takeChatSurfaceCommand();
  return command ? [{ source: "drawer", command: JSON.parse(command) }] : [];
}

function graphicsBackend(module, leaf) {
  return leaf === "record-form"
    ? module.recordFormGraphicsBackend()
    : module.chatSurfaceGraphicsBackend();
}
/**
 * Adopt a GPUI leaf into `hostId`, or reapply documents if it is already there.
 *
 * Resolves once the leaf is painting. The caller owns the drain loop, because
 * the two hosts keep their message channels alive in different ways and a loop
 * that outlives its channel sends into nothing.
 *
 * @returns {Promise<{backend: string, drain: () => object[], live: () => boolean}>}
 */
export async function startGpuiLeaf(hostId, options) {
  const {
    leaf,
    mode = "light",
    moduleHref,
    primaryDocument = null,
    composerDocument = null,
    script = null,
  } = options;
  const host = document.getElementById(hostId);
  if (!(host instanceof HTMLElement)) {
    throw new Error(`GPUI leaf requires an existing host element, got ${hostId}`);
  }
  const state = registry();
  const existing = state.instances.get(hostId);
  if (existing) {
    const pending = state.pendingDocuments.get(hostId);
    applyDocuments(
      existing.module,
      leaf,
      pending?.primaryDocument ?? primaryDocument,
      pending?.composerDocument ?? composerDocument,
      existing.documentPeerId,
    );
    state.pendingDocuments.delete(hostId);
    if (script) existing.module.applyLeafScript(leaf, script);
    return {
      backend: host.dataset.gpuiBackend ?? "unknown",
      drain: () => drainLeaf(existing.module, leaf),
      live: () => host.isConnected && state.instances.get(hostId)?.module === existing.module,
    };
  }

  host.dataset.gpuiState = "starting";
  // GPUI appends its canvas to the body rather than handing one back, so the
  // only way to identify it is to know which canvases were there first.
  const previous = new Set(
    Array.from(document.body.children).filter((element) => element instanceof HTMLCanvasElement),
  );
  let module;
  let acquired = false;
  let registeredInstance;
  try {
    if (!state.runtimes.has(moduleHref)) {
      let cachedRuntime;
      cachedRuntime = import(moduleHref)
        .then(async (module) => {
          await module.default();
          return module;
        })
        .catch((error) => {
          if (state.runtimes.get(moduleHref) === cachedRuntime) {
            state.runtimes.delete(moduleHref);
          }
          throw error;
        });
      state.runtimes.set(moduleHref, cachedRuntime);
    }
    module = await state.runtimes.get(moduleHref);
    const documentPeerId = leaf === "document" ? createDocumentPeerId() : null;
    if (!module.startLeaf(leaf)) {
      throw new Error(`the GPUI ${leaf} leaf is already owned by another host`);
    }
    acquired = true;
    let canvas;
    const ready = () => module.isLeafReady(leaf);
    const startupDeadline = performance.now() + LEAF_STARTUP_TIMEOUT_MS;
    while (performance.now() < startupDeadline) {
      canvas = Array.from(document.body.children).find(
        (element) => element instanceof HTMLCanvasElement && !previous.has(element),
      );
      if (canvas && ready()) break;
      await waitForStartupTurn(startupDeadline);
    }
    canvas ??= Array.from(document.body.children).find(
      (element) => element instanceof HTMLCanvasElement && !previous.has(element),
    );
    if (!canvas || !ready()) {
      throw new Error(
        `GPUI did not become ready with a leaf canvas within ${LEAF_STARTUP_TIMEOUT_MS}ms`,
      );
    }
    if (!host.isConnected) {
      throw new Error("the GPUI host was removed during startup");
    }
    canvas.dataset.rendererOwner = "gpui";
    canvas.tabIndex = 0;
    host.replaceChildren(canvas);
    // GPUI sizes itself from the window, so a host box that changes without the
    // window changing has to say so itself.
    const observer = new ResizeObserver(() => window.dispatchEvent(new Event("resize")));
    observer.observe(host);
    const narrowViewport = window.matchMedia("(max-width: 639px)");
    const applyViewport = () => {
      host.dataset.gpuiViewport = narrowViewport.matches ? "narrow" : "wide";
      window.dispatchEvent(new Event("resize"));
    };
    narrowViewport.addEventListener("change", applyViewport);
    applyViewport();
    module.applyMode(mode);
    const pending = state.pendingDocuments.get(hostId);
    applyDocuments(
      module,
      leaf,
      pending?.primaryDocument ?? primaryDocument,
      pending?.composerDocument ?? composerDocument,
      documentPeerId,
    );
    state.pendingDocuments.delete(hostId);
    // Before readiness, on purpose. A capture waits on `data-gpui-state`, so a
    // script applied after that flag could be photographed half-driven -- and
    // the resulting evidence would be flaky in the one direction nobody
    // notices, since a partly-driven state still differs from the default.
    if (script) module.applyLeafScript(leaf, script);
    registeredInstance = {
      host,
      canvas,
      module,
      leaf,
      observer,
      narrowViewport,
      applyViewport,
      documentPeerId,
    };
    state.instances.set(hostId, registeredInstance);
    host.dataset.gpuiBackend = graphicsBackend(module, leaf);
    host.dataset.gpuiState = "ready";
    window.dispatchEvent(new Event("resize"));
    return {
      backend: host.dataset.gpuiBackend,
      drain: () => drainLeaf(module, leaf),
      live: () => host.isConnected && state.instances.get(hostId)?.module === module,
    };
  } catch (error) {
    const ownsRegisteredInstance = state.instances.get(hostId) === registeredInstance;
    const anotherStartupOwnsHost = state.instances.has(hostId) && !ownsRegisteredInstance;
    if (!anotherStartupOwnsHost) {
      host.dataset.gpuiState = "failed";
      host.dataset.gpuiError = error instanceof Error ? error.message : String(error);
    }
    if (ownsRegisteredInstance) {
      stopGpuiLeaf(hostId, leaf);
    } else if (acquired && module) {
      module.stopLeaf(leaf);
      const stray = Array.from(document.body.children).find(
        (element) => element instanceof HTMLCanvasElement && !previous.has(element),
      );
      stray?.remove();
    }
    throw error;
  }
}

/**
 * `startGpuiLeaf` plus the drain loop, for a host whose callback outlives the
 * call. Resolves when the leaf goes away.
 */
export async function runGpuiLeaf(hostId, options, onPayload) {
  const started = await startGpuiLeaf(hostId, options);
  const host = document.getElementById(hostId);
  if (host instanceof HTMLElement) host.dataset.gpuiDrainState = "running";
  while (started.live()) {
    await waitForLifecycleTurn(LEAF_DRAIN_POLL_MS);
    if (!started.live()) break;
    let payloads;
    try {
      payloads = started.drain();
    } catch (error) {
      if (host instanceof HTMLElement) {
        host.dataset.gpuiDrainState = "failed";
        host.dataset.gpuiIntentError = error instanceof Error ? error.message : String(error);
      }
      throw error;
    }
    for (const payload of payloads) {
      if (host instanceof HTMLElement) {
        const previous = Number.parseInt(host.dataset.gpuiIntentBatches ?? "0", 10);
        host.dataset.gpuiIntentBatches = String((Number.isNaN(previous) ? 0 : previous) + 1);
        host.dataset.gpuiLastIntentSource = payload.source ?? "command";
      }
      try {
        onPayload(payload);
      } catch (error) {
        if (host instanceof HTMLElement) {
          host.dataset.gpuiIntentError = error instanceof Error ? error.message : String(error);
        }
        throw error;
      }
    }
  }
  if (host instanceof HTMLElement) host.dataset.gpuiDrainState = "stopped";
  return started.backend;
}

/**
 * Push new documents into a leaf that is already mounted.
 *
 * `startGpuiLeaf` reapplies documents when called again on a live host, so a
 * host *could* use it for this. It should not: "start" naming an update is how
 * a reader later concludes the mount is idempotent for reasons it is not.
 *
 * @returns {boolean} false when nothing is mounted at `hostId`.
 */
export function applyGpuiDocuments(hostId, primaryDocument, composerDocument = null) {
  const state = registry();
  const instance = state.instances.get(hostId);
  if (!instance) {
    state.pendingDocuments.set(hostId, { primaryDocument, composerDocument });
    return false;
  }
  state.pendingDocuments.delete(hostId);
  applyDocuments(
    instance.module,
    instance.leaf,
    primaryDocument,
    composerDocument,
    instance.documentPeerId,
  );
  return true;
}

/** Apply a bounded lazy why response to an already mounted record-form leaf. */
export function applyGpuiRecordFormWhy(hostId, document) {
  const instance = globalThis[REGISTRY_KEY]?.instances.get(hostId);
  if (!instance || instance.leaf !== "record-form") return false;
  instance.module.setRecordFormWhy(document);
  return true;
}

/** Release the exact failed lazy-why request so the field can be retried. */
export function rejectGpuiRecordFormWhy(hostId, request) {
  const instance = globalThis[REGISTRY_KEY]?.instances.get(hostId);
  if (!instance || instance.leaf !== "record-form") return false;
  instance.module.rejectRecordFormWhy(request);
  return true;
}

/** Release the exact failed form patch so its fields can be retried. */
export function rejectGpuiRecordFormPatch(hostId, patch) {
  const instance = globalThis[REGISTRY_KEY]?.instances.get(hostId);
  if (!instance || instance.leaf !== "record-form") return false;
  instance.module.rejectRecordFormPatch(patch);
  return true;
}
/**
 * Ask the existing browser tab for one local file.
 *
 * This is deliberately the whole JavaScript responsibility: the browser owns
 * the native picker, while Rust owns validation, hashing, upload, admission,
 * durable binding, and removal.
 *
 * @returns {Promise<File|null>}
 */
export function pickAttachment() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "text/plain",
      "text/markdown",
      "text/html",
      "text/csv",
      "application/json",
      ".md",
      ".markdown",
    ].join(",");
    input.addEventListener(
      "change",
      () => resolve(input.files?.item(0) ?? null),
      { once: true },
    );
    input.click();
  });
}

/** Take the leaf back down and release GPUI's ownership of it. */
export function stopGpuiLeaf(hostId, leaf) {
  const state = globalThis[REGISTRY_KEY];
  state?.pendingDocuments?.delete(hostId);
  const instance = state?.instances.get(hostId);
  if (instance) {
    state.instances.delete(hostId);
    instance.observer.disconnect();
    instance.narrowViewport.removeEventListener("change", instance.applyViewport);
    instance.module.stopLeaf(leaf);
    instance.canvas.remove();
    instance.host.dataset.gpuiState = "stopped";
    return;
  }
  const host = document.getElementById(hostId);
  if (host instanceof HTMLElement) host.dataset.gpuiState = "stopped";
}
