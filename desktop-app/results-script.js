/**
 * Results screen — render + integration hooks.
 *
 * How to wire this into the main app (for Gemini / whoever integrates):
 *
 *   1. When the typing test ends, call:
 *
 *        renderResults({
 *          wpm: 72,
 *          accuracy: 96,
 *          apologiesWritten: 8,
 *          mascotName: "Z",              // optional, shown in the subtitle
 *          photos: [
 *            { src: "<data-url-or-blob-url>", caption: "Oops moment!" },
 *            { src: "<data-url-or-blob-url>", caption: "Apology received!" },
 *            { src: "<data-url-or-blob-url>", caption: "All good now!" }
 *          ]
 *        });
 *
 *      `photos[].src` is whatever the background camera-capture process
 *      already produces (a data: URL, a blob: URL, or a plain file path if
 *      this is loaded inside an Electron/webview shell). If `src` is
 *      omitted or fails to load, a placeholder camera icon is shown instead
 *      so the layout never breaks.
 *
 *   2. Listen for the three user actions instead of hard-wiring click
 *      handlers into this file:
 *
 *        document.addEventListener("results:play-again", () => { ... });
 *        document.addEventListener("results:keep-typing", () => { ... });
 *        document.addEventListener("results:home", () => { ... });
 *
 *   Everything below is vanilla JS/DOM — no build step, no framework
 *   assumption — so it can be dropped into whatever the frontend already is.
 */

const CAMERA_PLACEHOLDER = `
  <svg class="polaroid__placeholder" viewBox="0 0 24 24" width="46" height="46"
       fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
    <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/>
    <circle cx="12" cy="13" r="3.4"/>
  </svg>`;

function buildPhotoItem(photo) {
  // Everything for one snapshot (frame + caption) lives in a single wrapper
  // so the fanned layout can position/rotate it as one unit — keeping card
  // and caption as separate stack children broke :nth-child positioning.
  const item = document.createElement("div");
  item.className = "photo-item";

  const card = document.createElement("div");
  card.className = "polaroid";

  const frame = document.createElement("div");
  frame.className = "polaroid__frame";

  if (photo && photo.src) {
    const img = document.createElement("img");
    img.src = photo.src;
    img.alt = photo.caption || "";
    img.onerror = () => { frame.innerHTML = CAMERA_PLACEHOLDER; };
    frame.appendChild(img);
} else {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];
    const img = document.createElement("img");
    img.src = './assets/alphabets/' + randomLetter + '-satisfied.png';
    img.alt = 'No Reaction Captured';
    img.onerror = () => { frame.innerHTML = CAMERA_PLACEHOLDER; };
    frame.appendChild(img);
  }

  const pad = document.createElement("div");
  pad.className = "polaroid__pad";

  card.appendChild(frame);
  card.appendChild(pad);

  const caption = document.createElement("p");
  caption.className = "polaroid-caption";
  caption.textContent = (photo && photo.caption) || "";

  item.appendChild(card);
  item.appendChild(caption);
  return item;
}

function renderPhotos(photos) {
  const stack = document.getElementById("photoStack");
  stack.innerHTML = "";

  const list = (photos && photos.length ? photos : []).slice(0, 3);
  while (list.length < 3) list.push(null);

  list.forEach((photo) => {
    stack.appendChild(buildPhotoItem(photo));
  });
}

/**
 * Main entry point — call this once, when the results screen should appear.
 * Any field left out keeps whatever is already on screen (handy for demos).
 */
function renderResults(data = {}) {
  if (data.wpm !== undefined) {
    document.getElementById("statWpm").textContent = data.wpm;
  }
  if (data.accuracy !== undefined) {
    document.getElementById("statAccuracy").textContent = `${data.accuracy}%`;
  }
  if (data.apologiesWritten !== undefined) {
    document.getElementById("statApologies").textContent = data.apologiesWritten;
  }
  if (data.mascotName !== undefined) {
    document.getElementById("mascotName").textContent = data.mascotName;
  }
  if (data.photos !== undefined) {
    renderPhotos(data.photos);
  }
}

function wireActions() {
  document.getElementById("playAgainBtn").addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("results:play-again"));
  });
  document.getElementById("keepTypingBtn").addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("results:keep-typing"));
  });
  document.getElementById("backHomeBtn").addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("results:home"));
  });
}

// Demo defaults so the file looks right when opened directly in a browser.
// Safe to delete once this is wired up to real session data.
wireActions();

// Expose globally so the rest of the app (or Gemini's glue code) can call it.
window.renderResults = renderResults;
