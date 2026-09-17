/**
 * Traceo dashboard — Signal desk.
 *
 * Served by @traceojs/server alongside index.html, styles.css, and
 * json-preview.js (which provides window.TraceoJsonPreview for parsing
 * and recovering truncated JSON bodies).
 *
 * Server endpoints used:
 *   GET    /requests?search&method&statusCode&page&pageSize&statusFamily&faults
 *          → paginated request summaries plus status-family facets
 *   GET    /timeline/:requestId → correlated events for one request ("hop")
 *   DELETE /requests            → wipe every captured event
 *
 * Vocabulary: a "hop" is one HTTP request/response pair. Its "trace rail"
 * lists the captured signals (REQUEST_STARTED, REQUEST_COMPLETED, error).
 *
 * File layout, top to bottom:
 *   1. state / els     — single mutable UI state object and DOM handles
 *   2. JSON viewer     — tree/pretty rendering with open/close persistence
 *   3. Modal           — expanded request/response/event inspector
 *   4. Actions         — clipboard, toasts, fetch wrapper, clear-all
 *   5. Formatting      — status classes, times, durations
 *   6. Paging          — page state, pager controls, validation
 *   7. Rendering       — hop list, inspect pane, detail hero
 *   8. Data loading    — loadRequests() polling loop, live follow
 *   9. Event wiring    — every addEventListener, keyboard shortcuts
 *  10. Boot            — restore live preference and first load
 */

/* ─── 1. State and DOM handles ─────────────────────────────────────── */

// Single source of truth for the UI. Rendering functions read from here;
// event handlers mutate it and re-render.
const state = {
  requests: [],
  selected: decodeURIComponent(location.hash.replace(/^#/, "")) || null,
  timeline: [],
  eventId: null,
  section: "requests",
  requestTab: "payload",
  responseTab: "payload",
  range: "",
  live: false,
  wrap: true,
  jsonMode: "tree",
  jsonOpen: new Set(),
  jsonClosed: new Set(),
  modal: null,
  timer: null,
  known: new Set(),
  following: true,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  hasPrev: false,
  hasNext: false,
  filteredCount: 0,
  facets: {},
  selectedSummary: null,
  loadGen: 0,
  clearing: false,
};

// Cached DOM lookups. Every element here exists in index.html.
const els = {
  list: document.getElementById("list"),
  empty: document.getElementById("empty"),
  detail: document.getElementById("detail"),
  status: document.getElementById("status"),
  count: document.getElementById("stat-count"),
  errors: document.getElementById("stat-errors"),
  live: document.getElementById("live"),
  liveDot: document.getElementById("live-dot"),
  search: document.getElementById("search"),
  searchWrap: document.getElementById("search-wrap"),
  method: document.getElementById("method"),
  statusCode: document.getElementById("statusCode"),
  toast: document.getElementById("toast"),
  inspect: document.getElementById("inspect"),
  stream: document.getElementById("stream"),
  followHint: document.getElementById("follow-hint"),
  badgeRequests: document.getElementById("badge-requests"),
  badgeErrors: document.getElementById("badge-errors"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modal-title"),
  modalBody: document.getElementById("modal-body"),
  workspace: document.querySelector(".workspace"),
  pagePrev: document.getElementById("page-prev"),
  pageNext: document.getElementById("page-next"),
  pageLabel: document.getElementById("page-label"),
  pageSize: document.getElementById("page-size"),
  pageInput: document.getElementById("page-input"),
  pageTotal: document.getElementById("page-total"),
  pageStatus: document.getElementById("page-status"),
  pager: document.getElementById("pager"),
};

function setMobilePane(pane) {
  els.workspace.dataset.pane = pane;
  document.querySelectorAll(".mobile-switch [data-pane]").forEach((button) => {
    const on = button.dataset.pane === pane;
    button.classList.toggle("active", on);
    button.setAttribute("aria-selected", on ? "true" : "false");
  });
}

function isMobileWorkspace() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );
}

/* ─── 2. JSON viewer (Tree / Pretty panels) ────────────────────────── */

// Pretty-printed JSON strings keyed by panel id, consumed by the Copy
// buttons. Cleared on re-render; modal entries are preserved while open.
const jsonCopies = new Map();

// Token-level syntax highlighter for the Pretty view.
function highlightJson(value) {
  const source =
    typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2);
  let i = 0;
  let out = "";
  const n = source.length;
  const isBoundary = (index) =>
    index <= 0 || /[\s,:\[\{]/.test(source[index - 1]);
  while (i < n) {
    const ch = source[i];
    if (ch === '"') {
      let j = i + 1;
      let escaped = false;
      for (; j < n; j += 1) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (source[j] === "\\") {
          escaped = true;
          continue;
        }
        if (source[j] === '"') {
          j += 1;
          break;
        }
      }
      let k = j;
      while (k < n && /\s/.test(source[k])) k += 1;
      const cls = source[k] === ":" ? "jk" : "js";
      out +=
        '<span class="' +
        cls +
        '">' +
        escapeHtml(source.slice(i, j)) +
        "</span>";
      i = j;
      continue;
    }
    if ((ch === "-" || (ch >= "0" && ch <= "9")) && isBoundary(i)) {
      const match = source
        .slice(i)
        .match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (match) {
        out += '<span class="jn">' + match[0] + "</span>";
        i += match[0].length;
        continue;
      }
    }
    if (
      source.startsWith("true", i) &&
      !/[A-Za-z0-9_]/.test(source[i + 4] || "")
    ) {
      out += '<span class="jb">true</span>';
      i += 4;
      continue;
    }
    if (
      source.startsWith("false", i) &&
      !/[A-Za-z0-9_]/.test(source[i + 5] || "")
    ) {
      out += '<span class="jb">false</span>';
      i += 5;
      continue;
    }
    if (
      source.startsWith("null", i) &&
      !/[A-Za-z0-9_]/.test(source[i + 4] || "")
    ) {
      out += '<span class="jnull">null</span>';
      i += 4;
      continue;
    }
    out += escapeHtml(ch);
    i += 1;
  }
  return out;
}

// Shared helpers from json-preview.js: detect JSON-looking strings, parse
// them (recovering truncated captures), and expand nested body strings
// into real objects for display.
const { looksLikeJson, parseJsonPreview, expandJsonValue } =
  window.TraceoJsonPreview;

function captureWasTruncated(value) {
  if (!value || typeof value !== "object") return false;
  if (value.bodyTruncated === true) return true;
  const payload = value.payload || {};
  return Boolean(
    payload.request?.bodyTruncated || payload.response?.bodyTruncated,
  );
}

function jsonLeaf(value) {
  if (value === null) return '<span class="jnull">null</span>';
  if (typeof value === "boolean")
    return '<span class="jb">' + value + "</span>";
  if (typeof value === "number")
    return '<span class="jn">' + String(value) + "</span>";
  if (typeof value === "string")
    return '<span class="js">"' + escapeHtml(value) + '"</span>';
  return '<span class="js">' + escapeHtml(String(value)) + "</span>";
}

// Tree nodes are addressed by a stable dot path (e.g. "modal.payload.data.0").
// Open/closed choices live in state.jsonOpen / state.jsonClosed so they
// survive live-refresh re-renders. Below the defaults: depth < 5 open,
// large arrays (> 16 items) open only two levels.
function isJsonOpen(path, depth, value) {
  if (state.jsonClosed.has(path)) return false;
  if (state.jsonOpen.has(path)) return true;
  if (Array.isArray(value) && value.length > 16) return depth < 2;
  return depth < 5;
}

function toggleJsonPath(path, depth) {
  if (isJsonOpen(path, depth)) {
    state.jsonClosed.add(path);
    state.jsonOpen.delete(path);
  } else {
    state.jsonClosed.delete(path);
    state.jsonOpen.add(path);
  }
}

function jsonTree(value, path, depth, key) {
  if (typeof value === "string" && looksLikeJson(value)) {
    const parsed = parseJsonPreview(value);
    if (typeof parsed.value !== "string") {
      if (parsed.recovered) state.jsonRecovered = true;
      return jsonTree(parsed.value, path, depth, key);
    }
  }
  const label =
    key === undefined
      ? ""
      : '<span class="jk">' +
        escapeHtml(key) +
        '</span><span class="jpunct">: </span>';
  const spacer =
    key === undefined
      ? ""
      : '<span class="j-toggle" aria-hidden="true"></span>';

  if (value !== null && typeof value === "object") {
    const isArray = Array.isArray(value);
    const entries = isArray
      ? value.map((item, index) => [String(index), item])
      : Object.entries(value);
    const openBrace = isArray ? "[" : "{";
    const closeBrace = isArray ? "]" : "}";

    if (!entries.length) {
      return (
        '<div class="j-line">' +
        spacer +
        label +
        '<span class="jpunct">' +
        openBrace +
        closeBrace +
        "</span></div>"
      );
    }

    const open = isJsonOpen(path, depth, value);
    const foldAttrs =
      ' class="j-line j-fold" role="button" tabindex="0" data-json-path="' +
      escapeHtml(path) +
      '" data-json-depth="' +
      depth +
      '"';
    const toggle =
      '<span class="j-toggle" aria-hidden="true">' +
      (open ? "▾" : "▸") +
      "</span>";

    if (!open) {
      return (
        "<div" +
        foldAttrs +
        ">" +
        toggle +
        label +
        '<span class="jpunct">' +
        openBrace +
        "</span>" +
        '<span class="jpreview">' +
        (isArray ? entries.length + " items" : entries.length + " keys") +
        "</span>" +
        '<span class="jpunct">' +
        closeBrace +
        "</span></div>"
      );
    }

    return (
      '<div class="j-block">' +
      "<div" +
      foldAttrs +
      ">" +
      toggle +
      label +
      '<span class="jpunct">' +
      openBrace +
      "</span></div>" +
      '<div class="j-kids">' +
      entries
        .map(([childKey, child]) =>
          jsonTree(child, path + "." + childKey, depth + 1, childKey),
        )
        .join("") +
      "</div>" +
      '<div class="j-line j-close"><span class="jpunct">' +
      closeBrace +
      "</span></div>" +
      "</div>"
    );
  }

  return '<div class="j-line">' + spacer + label + jsonLeaf(value) + "</div>";
}

function jsonPanel(value, treeId) {
  const acc = { recovered: false };
  const parsed = value === undefined ? null : expandJsonValue(value, 0, acc);
  const pretty = JSON.stringify(parsed, null, 2);
  const id =
    "json-" + jsonCopies.size + "-" + Math.random().toString(16).slice(2);
  jsonCopies.set(id, pretty);
  const truncated =
    captureWasTruncated(value) || acc.recovered || state.jsonRecovered;
  state.jsonRecovered = false;
  return (
    '<div class="json-panel">' +
    '<div class="json-tools">' +
    '<button type="button" class="' +
    (state.jsonMode === "tree" ? "active" : "") +
    '" data-json-mode="tree">Tree</button>' +
    '<button type="button" class="' +
    (state.jsonMode === "raw" ? "active" : "") +
    '" data-json-mode="raw">Pretty</button>' +
    '<button type="button" class="ghost" data-json-copy="' +
    id +
    '">Copy</button>' +
    "</div>" +
    (truncated
      ? '<p class="json-note">Captured body was truncated. This is a formatted preview of the stored slice.</p>'
      : "") +
    (state.jsonMode === "raw"
      ? '<pre class="code">' + highlightJson(parsed) + "</pre>"
      : '<div class="json-tree">' +
        jsonTree(parsed, treeId || "json", 0) +
        "</div>") +
    "</div>"
  );
}

/* ─── 3. Modal (expanded inspector) ────────────────────────────────── */

// Resolve what the open modal should display: a timeline event, or the
// combined request/response context assembled from the timeline.
function modalValue() {
  if (!state.modal) return null;
  if (state.modal.eventId) {
    return (
      state.timeline.find((event) => event.id === state.modal.eventId) ||
      state.modal.value
    );
  }
  if (state.modal.kind === "request" || state.modal.kind === "response") {
    const ctx = contextFrom(state.timeline);
    const data = ctx[state.modal.kind];
    return {
      headers: data.headers,
      query: data.query,
      cookies: data.cookies,
      body: prettyValue(data.body),
    };
  }
  return state.modal.value;
}

function modalScroller() {
  return els.modalBody.querySelector(".json-tree, pre.code");
}

function keepModalJsonCopies() {
  const kept = new Map();
  if (!state.modal) return kept;
  els.modalBody.querySelectorAll("[data-json-copy]").forEach((el) => {
    const id = el.dataset.jsonCopy;
    if (id && jsonCopies.has(id)) kept.set(id, jsonCopies.get(id));
  });
  return kept;
}

function openModal(modal) {
  state.modal = modal;
  renderModal({ resetScroll: true });
}

function closeModal() {
  state.modal = null;
  renderModal();
  loadRequests().catch((err) => {
    els.status.textContent = err.message;
  });
}

function renderModal(options = {}) {
  if (!state.modal) {
    els.modal.hidden = true;
    els.modalBody.innerHTML = "";
    return;
  }
  const previous = modalScroller();
  const scroll = options.resetScroll ? 0 : previous ? previous.scrollTop : 0;
  els.modal.hidden = false;
  els.modalTitle.textContent = state.modal.title;
  els.modalBody.innerHTML = jsonPanel(modalValue(), "modal");
  const next = modalScroller();
  if (next) next.scrollTop = scroll;
}

/* ─── 4. Actions: search highlight, toast, clipboard, API, clear ───── */

// Wrap the current search query in <mark> inside list rows.
function highlightMatch(text) {
  const raw = String(text ?? "");
  const query = els.search.value.trim();
  if (!query) return escapeHtml(raw);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = raw.split(new RegExp("(" + escaped + ")", "ig"));
  return parts
    .map((part) =>
      part.toLowerCase() === query.toLowerCase()
        ? '<mark class="mark-hit">' + escapeHtml(part) + "</mark>"
        : escapeHtml(part),
    )
    .join("");
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 1600);
}

async function copyText(value, message) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  toast(message);
}

const TRACEO_BASE =
  typeof window !== "undefined" && typeof window.__TRACEO_BASE__ === "string"
    ? window.__TRACEO_BASE__.replace(/\/$/, "")
    : "";

async function api(path, options) {
  const res = await fetch(TRACEO_BASE + path, options);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

function setClearing(on) {
  state.clearing = on;
  document.querySelectorAll("#clear-all").forEach((button) => {
    button.disabled = on;
  });
}

// Masthead "Clear all": confirm, DELETE /requests, reset local state,
// then reload so the empty state renders immediately.
async function clearAllRequests() {
  if (state.clearing) return;
  if (
    !window.confirm(
      "Clear every captured hop and event from Traceo? This cannot be undone.",
    )
  ) {
    return;
  }
  setClearing(true);
  try {
    const result = await api("/requests", { method: "DELETE" });
    closeModal();
    state.requests = [];
    state.selected = null;
    state.selectedSummary = null;
    state.timeline = [];
    state.eventId = null;
    state.known = new Set();
    state.facets = {};
    state.filteredCount = 0;
    resetToFirstPage();
    if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    const removed = Number(result && result.removed) || 0;
    toast(removed === 1 ? "Cleared 1 event" : "Cleared " + removed + " events");
    await loadRequests({ refreshTimeline: false });
  } catch (err) {
    els.status.textContent = err.message;
  } finally {
    setClearing(false);
  }
}

/* ─── 5. Formatting helpers ────────────────────────────────────────── */

function statusClass(code, errorCount) {
  if (errorCount > 0 || (code && code >= 500)) return "err";
  if (!code) return "";
  return "s" + String(code)[0];
}

function methodClass(method) {
  return "m-" + (method || "").toUpperCase();
}

function relativeTime(value) {
  if (!value) return "";
  const delta = Date.now() - Date.parse(value);
  if (Number.isNaN(delta)) return value;
  const sec = Math.max(0, Math.round(delta / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return sec + "s ago";
  if (sec < 3600) return Math.round(sec / 60) + "m ago";
  if (sec < 86400) return Math.round(sec / 3600) + "h ago";
  return new Date(value).toLocaleString();
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString() + " · " + relativeTime(value);
}

function durationLabel(ms) {
  if (ms === undefined || ms === null) return "—";
  return Number(ms).toFixed(ms >= 10 ? 0 : 1) + " ms";
}

function isFault(request) {
  return (
    request.errorCount > 0 || (request.statusCode && request.statusCode >= 500)
  );
}

function matchesRange(request) {
  // When on the Errors section, the server already filtered to faults only.
  // Trust the server — show everything returned rather than re-filtering
  // client-side (which uses a stricter definition and causes false "No hops match").
  if (state.section === "errors") return true;
  if (state.range === "errors") return isFault(request);
  if (!state.range) return true;
  return String(request.statusCode || "").startsWith(state.range);
}

function countRange(range) {
  const key = range || "";
  if (state.facets && Object.prototype.hasOwnProperty.call(state.facets, key)) {
    return state.facets[key];
  }
  return state.requests.filter((request) => {
    if (range === "errors") return isFault(request);
    if (!range) return true;
    return String(request.statusCode || "").startsWith(range);
  }).length;
}

function selectedRequest() {
  const onPage = state.requests.find(
    (item) => item.requestId === state.selected,
  );
  if (onPage) {
    state.selectedSummary = onPage;
    return onPage;
  }
  if (
    state.selectedSummary &&
    state.selectedSummary.requestId === state.selected
  ) {
    return state.selectedSummary;
  }
  return null;
}

function visibleRequests() {
  return state.requests.filter(matchesRange);
}

const PAGE_SIZES = [10, 25, 50];

/* ─── 6. Paging ────────────────────────────────────────────────────── */

// Copy the server's pagination answer (page, totalPages, hasPrev/hasNext,
// count, facets) into state. The server clamps out-of-range pages.
function applyPageMeta(data) {
  state.page = Number.isSafeInteger(data.page) && data.page > 0 ? data.page : 1;
  state.pageSize = PAGE_SIZES.includes(data.pageSize)
    ? data.pageSize
    : state.pageSize || 25;
  state.totalPages = Math.max(
    1,
    Number.isSafeInteger(data.totalPages) ? data.totalPages : 1,
  );
  state.hasPrev = Boolean(data.hasPrev);
  state.hasNext = Boolean(data.hasNext);
  state.filteredCount = Number.isSafeInteger(data.count)
    ? data.count
    : (data.requests || []).length;
  state.facets =
    data.facets && typeof data.facets === "object" ? data.facets : {};
}

function updatePager() {
  const count = state.filteredCount;
  const visible = visibleRequests();
  const start = count === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
  const end = count === 0 ? 0 : Math.min(count, start + visible.length - 1);
  els.pageLabel.textContent =
    count === 0
      ? "No hops to show"
      : "Showing " + start + "–" + end + " of " + count;
  els.pageTotal.textContent = String(state.totalPages);
  els.pageInput.min = "1";
  els.pageInput.max = String(state.totalPages);
  els.pageInput.value = String(state.page);
  els.pageInput.disabled = count === 0;
  els.pagePrev.disabled = !state.hasPrev;
  els.pageNext.disabled = !state.hasNext;
  els.pagePrev.title = state.hasPrev
    ? "Previous page (shortcut [)"
    : "Already on the first page";
  els.pageNext.title = state.hasNext
    ? "Next page (shortcut ])"
    : "Already on the last page";
  els.pagePrev.setAttribute(
    "aria-label",
    state.hasPrev
      ? "Previous page"
      : "Previous page, already on the first page",
  );
  els.pageNext.setAttribute(
    "aria-label",
    state.hasNext ? "Next page" : "Next page, already on the last page",
  );
  els.pageStatus.textContent =
    count === 0
      ? "No hops to show"
      : "Showing hops " +
        start +
        " to " +
        end +
        " of " +
        count +
        ", page " +
        state.page +
        " of " +
        state.totalPages;
  if (PAGE_SIZES.includes(state.pageSize)) {
    els.pageSize.value = String(state.pageSize);
  }
}

function commitPageInput() {
  const next = Math.trunc(Number(els.pageInput.value));
  if (!Number.isSafeInteger(next) || next < 1) {
    els.pageInput.value = String(state.page);
    return Promise.resolve();
  }
  const clamped = Math.min(next, Math.max(1, state.totalPages));
  if (clamped === state.page) {
    els.pageInput.value = String(state.page);
    return Promise.resolve();
  }
  return goPage(clamped, { force: true }).catch((err) => {
    els.status.textContent = err.message;
  });
}

function syncPressed(nodes, isActive) {
  nodes.forEach((item) => {
    const on = isActive(item);
    item.classList.toggle("active", on);
    if (item.hasAttribute("aria-pressed"))
      item.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function resetToFirstPage() {
  state.page = 1;
}

function goPage(next, options = {}) {
  const requested = Math.trunc(Number(next));
  if (!Number.isSafeInteger(requested) || requested < 1)
    return Promise.resolve();
  if (!options.force) {
    if (requested === state.page) return Promise.resolve();
    if (requested < state.page && !state.hasPrev) return Promise.resolve();
    if (requested > state.page && !state.hasNext) return Promise.resolve();
  }
  state.page = requested;
  if (state.page !== 1) state.following = false;
  return loadRequests(options).then(() => {
    const visible = visibleRequests();
    if (options.select === "first" && visible[0])
      return selectRequest(visible[0].requestId);
    if (options.select === "last" && visible.length)
      return selectRequest(visible[visible.length - 1].requestId);
  });
}

/* ─── 7. Rendering: hop list and inspect pane ──────────────────────── */

// Merge a hop's timeline events into one { request, response, error }
// context. REQUEST_COMPLETED data wins over REQUEST_STARTED when both
// captured the same field.
function contextFrom(events) {
  const started = events.find((event) => event.type === "REQUEST_STARTED");
  const completed = events.find((event) => event.type === "REQUEST_COMPLETED");
  const error = events.find((event) => event.type === "error");
  const a = started?.payload?.request || {};
  const b = completed?.payload?.request || {};
  return {
    started,
    completed,
    error,
    request: {
      ...a,
      ...b,
      headers: hasEntries(b.headers) ? b.headers : a.headers,
      query: hasEntries(b.query) ? b.query : a.query,
      cookies: hasEntries(b.cookies) ? b.cookies : a.cookies,
      body: b.body !== undefined ? b.body : a.body,
      ip: b.ip ?? a.ip,
      userAgent: b.userAgent ?? a.userAgent,
    },
    response: completed?.payload?.response || {},
  };
}

function hasEntries(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

function formatCell(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null) return "null";
  return String(value);
}

function kvTable(data, missing) {
  if (data === undefined) return '<p class="note">' + missing + "</p>";
  if (!hasEntries(data)) return '<p class="note">None</p>';
  return (
    '<div class="kv-table">' +
    Object.entries(data)
      .map(
        ([key, value]) =>
          '<div class="k">' +
          escapeHtml(key) +
          '</div><div class="v">' +
          escapeHtml(formatCell(value)) +
          "</div>",
      )
      .join("") +
    "</div>"
  );
}

function bodyBlock(body, method, side) {
  if (body === undefined || body === null || body === "") {
    const verb = String(method || "").toUpperCase();
    if (
      side === "request" &&
      ["GET", "HEAD", "OPTIONS", "DELETE"].includes(verb)
    ) {
      return '<p class="note">' + verb + " has no request body.</p>";
    }
    return '<p class="note">No ' + side + " body was captured.</p>";
  }
  return jsonPanel(body, "body-" + side);
}

function block(title, inner) {
  return '<div class="block"><h3>' + title + "</h3>" + inner + "</div>";
}

function prettyValue(value) {
  if (value === undefined) return undefined;
  return expandJsonValue(value, 0, { recovered: false });
}

function updateChrome() {
  const universe = countRange("");
  const faults = countRange("errors");
  els.count.textContent = String(universe);
  els.errors.textContent = String(faults);
  els.badgeRequests.textContent = String(universe);
  els.badgeErrors.textContent = String(faults);
  els.badgeErrors.classList.toggle("hot", faults > 0);
  document.querySelectorAll("[data-count]").forEach((node) => {
    node.textContent = String(countRange(node.dataset.count));
  });
  els.searchWrap.classList.toggle(
    "has-query",
    Boolean(els.search.value.trim()),
  );
  document.getElementById("clear").hidden =
    !els.search.value && !els.method.value && !state.range;
  els.followHint.textContent =
    state.live && state.following
      ? "Following latest hop"
      : state.live
        ? "Live, pinned to this hop"
        : "Paused";
  updatePager();
}

function renderList(options = {}) {
  const visible = visibleRequests();
  const maxDuration = Math.max(
    1,
    ...visible.map((item) => item.durationMs || 0),
  );
  els.list.innerHTML = "";
  const universe = countRange("");
  // noData: nothing at all has been captured yet (no filters, no data)
  const noData =
    universe === 0 &&
    !els.search.value &&
    !els.method.value &&
    !state.range &&
    state.section === "requests";
  // filteredOut: data exists but current filters produce zero results
  const filteredOut = !visible.length && !noData;
  els.empty.hidden = !(noData || filteredOut);
  els.list.hidden = noData || filteredOut;
  els.list.setAttribute("aria-busy", "false");
  if (noData) {
    els.empty.querySelector("h2").textContent = "Waiting for the first hop";
    els.empty.querySelector("p").textContent =
      "Hit your app, then Traceo will land requests here. Keep live on so new hops appear as they happen.";
  } else if (filteredOut) {
    els.empty.querySelector("h2").textContent = "No hops match";
    els.empty.querySelector("p").textContent =
      "Reset filters or search to see the rest of the stream.";
  }
  visible.forEach((request, index) => {
    const row = document.createElement("button");
    row.type = "button";
    const klass = statusClass(request.statusCode, request.errorCount);
    const pending = !request.statusCode && !request.errorCount;
    const share = Math.min(
      100,
      Math.round(((request.durationMs || 0) / maxDuration) * 100),
    );
    const selected = request.requestId === state.selected;
    const statusText = pending
      ? "in flight"
      : request.statusCode || (request.errorCount ? "error" : "unknown status");
    row.className =
      "hop" + (selected ? " selected" : "") + (request._flash ? " flash" : "");
    row.dataset.id = request.requestId;
    if (selected) row.setAttribute("aria-current", "true");
    row.setAttribute(
      "aria-label",
      (request.method || "request") +
        " " +
        (request.url || request.requestId) +
        ", status " +
        statusText +
        ", " +
        durationLabel(request.durationMs),
    );
    row.innerHTML =
      '<span class="tick ' +
      klass +
      '" aria-hidden="true"></span>' +
      '<div><div class="method ' +
      methodClass(request.method) +
      '">' +
      escapeHtml(request.method || "?") +
      (pending ? " · in flight" : "") +
      "</div>" +
      '<div class="url" title="' +
      escapeHtml(request.url || request.requestId) +
      '">' +
      highlightMatch(request.url || request.requestId) +
      "</div>" +
      '<div class="muted">' +
      escapeHtml(durationLabel(request.durationMs)) +
      " · " +
      escapeHtml(relativeTime(request.startedAt)) +
      "</div>" +
      '<div class="meter ' +
      (klass === "err" ? "fault" : share > 70 ? "slow" : "") +
      '" aria-hidden="true"><span style="width:' +
      share +
      '%"></span></div></div>' +
      '<span class="status ' +
      klass +
      '">' +
      escapeHtml(request.statusCode || (request.errorCount ? "ERR" : "…")) +
      "</span>";
    row.addEventListener("click", () => {
      state.following =
        state.page === 1 && request.requestId === state.requests[0]?.requestId;
      selectRequest(request.requestId);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusCard(index + 1);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusCard(index - 1);
      }
    });
    els.list.appendChild(row);
  });
  document.getElementById("empty-live").hidden = !noData;
  if (options.scrollSelected) {
    const selectedRow = els.list.querySelector(".hop.selected");
    if (selectedRow) selectedRow.scrollIntoView({ block: "nearest" });
  }
  updateChrome();
}

function focusCard(index) {
  const cards = [...els.list.querySelectorAll(".hop")];
  const card = cards[Math.max(0, Math.min(cards.length - 1, index))];
  if (card) {
    card.focus();
    state.following =
      state.page === 1 && card.dataset.id === state.requests[0]?.requestId;
    selectRequest(card.dataset.id);
  }
}

function pill(label, value, extra) {
  const text = String(value || "—");
  return (
    '<button class="pill" type="button" data-copy="' +
    escapeHtml(text) +
    '" title="Copy ' +
    escapeHtml(label) +
    '"><b>' +
    escapeHtml(label) +
    '</b><span class="' +
    (extra || "") +
    '">' +
    escapeHtml(text) +
    "</span></button>"
  );
}

function sidePane(kind, title, data, method) {
  return (
    '<section class="pane">' +
    "<header><span>" +
    title +
    "</span><div>" +
    '<button class="ghost" type="button" data-open-modal="' +
    kind +
    '">Expand</button>' +
    '<button class="ghost" type="button" data-copy-pane="' +
    kind +
    '">Copy</button>' +
    "</div></header>" +
    '<div class="pane-scroll" data-kind="' +
    kind +
    '">' +
    (kind === "request" && hasEntries(data.query)
      ? block("Query", kvTable(data.query, "Query was not captured."))
      : "") +
    block(
      "Headers",
      kvTable(
        data.headers,
        "Headers were not captured. Enable captureHeaders on the middleware.",
      ),
    ) +
    (hasEntries(data.cookies)
      ? block("Cookies", kvTable(data.cookies, ""))
      : "") +
    block(
      "Body",
      bodyBlock(data.body, method, kind === "request" ? "request" : "response"),
    ) +
    "</div>" +
    "</section>"
  );
}

function rail(events) {
  return (
    '<section class="trace"><header><span>Trace rail</span><span class="muted">Click a signal to open it</span></header>' +
    '<div class="trace-line">' +
    (events.length
      ? events
          .map(
            (event) =>
              '<button class="node' +
              (event.id === state.eventId ? " selected" : "") +
              '" type="button" data-event="' +
              escapeHtml(event.id || "") +
              '" aria-label="' +
              escapeHtml(
                (event.type || "signal").replace(/_/g, " ") +
                  ", " +
                  relativeTime(event.timestamp),
              ) +
              '">' +
              "<strong>" +
              escapeHtml(event.type.replace(/_/g, " ")) +
              "</strong>" +
              '<span class="muted">' +
              escapeHtml(relativeTime(event.timestamp)) +
              "</span></button>",
          )
          .join("")
      : '<p class="note">No signals on this hop.</p>') +
    "</div></section>"
  );
}

// Capture all scroll positions inside the detail pane so they can be
// restored after a re-render. Keyed by a stable selector string.
function captureDetailScrolls() {
  const map = {};
  const inspectScroll = els.detail.querySelector(".inspect-scroll");
  if (inspectScroll) map["inspect-scroll"] = inspectScroll.scrollTop;
  els.detail.querySelectorAll(".pane-scroll[data-kind]").forEach((el) => {
    map["pane-" + el.dataset.kind] = el.scrollTop;
  });
  return map;
}

function restoreDetailScrolls(map) {
  if (!map) return;
  if (map["inspect-scroll"] != null) {
    const el = els.detail.querySelector(".inspect-scroll");
    if (el) el.scrollTop = map["inspect-scroll"];
  }
  els.detail.querySelectorAll(".pane-scroll[data-kind]").forEach((el) => {
    const saved = map["pane-" + el.dataset.kind];
    if (saved != null) el.scrollTop = saved;
  });
}

// Track which requestId was last fully rendered so we can detect a hop
// change and reset scroll rather than restore the previous hop's position.
let _lastRenderedId = null;

function renderDetail() {
  const modalCopies = keepModalJsonCopies();
  jsonCopies.clear();
  modalCopies.forEach((value, id) => jsonCopies.set(id, value));
  const request = selectedRequest();
  // Only restore scroll when re-rendering the SAME hop (e.g. live refresh).
  // On a new hop selection always start at the top.
  const sameHop = request && request.requestId === _lastRenderedId;
  const scrollMap = sameHop ? captureDetailScrolls() : null;
  if (!request) {
    els.detail.className = "empty";
    document.title = "Traceo";
    if (
      state.requests.length &&
      (state.section === "errors" || state.range) &&
      !state.selected
    ) {
      els.detail.innerHTML =
        '<div class="empty"><div class="empty-visual" aria-hidden="true"></div><h2>Hidden by filters</h2><p>The selected hop is still in the stream, but not in this view.</p><button class="primary" data-reset="1" type="button">Show all hops</button></div>';
    } else if (state.selected && state.filteredCount > 0) {
      els.detail.innerHTML =
        '<div class="empty"><div class="empty-visual" aria-hidden="true"></div><h2>Hop is on another page</h2><p>This hop is still selected. Use Prev and Next to move through the stream, or reset filters to return to the latest hops.</p></div>';
    } else {
      els.detail.innerHTML =
        '<div class="empty"><div class="empty-visual" aria-hidden="true"></div><h2>Nothing selected</h2><p>Pick a hop to inspect the request, response, and trace rail.</p></div>';
    }
    return;
  }
  const ctx = contextFrom(state.timeline);
  const klass = statusClass(request.statusCode, request.errorCount);
  const method = request.method || ctx.request.method || "—";
  const url = request.url || ctx.request.url || "—";
  document.title = method + " " + url + " · Traceo";
  els.detail.classList.remove("empty");

  const hero =
    '<div class="inspect-head"><div class="hero">' +
    '<h1><span class="method ' +
    methodClass(method) +
    '">' +
    escapeHtml(method) +
    "</span> " +
    escapeHtml(url) +
    "</h1>" +
    '<div class="hero-actions">' +
    '<span class="status ' +
    klass +
    '">' +
    escapeHtml(request.statusCode || ctx.response.statusCode || "—") +
    "</span>" +
    '<button class="ghost" type="button" data-copy="' +
    escapeHtml(request.requestId) +
    '">Copy ID</button>' +
    '<button class="ghost" type="button" data-copy-json="1"' +
    (state.timeline.length ? "" : " disabled") +
    ">Copy JSON</button>" +
    "</div></div>" +
    '<div class="pills">' +
    pill("When", formatTime(request.startedAt || ctx.started?.timestamp)) +
    pill(
      "Duration",
      durationLabel(request.durationMs || ctx.response.durationMs),
    ) +
    pill("Client", ctx.request.ip || "—") +
    pill("Agent", ctx.request.userAgent || "—") +
    pill("Hop ID", request.requestId) +
    "</div></div>";

  const fault = ctx.error
    ? '<div class="fault">' +
      escapeHtml(ctx.error.payload?.name ? ctx.error.payload.name + ": " : "") +
      escapeHtml(ctx.error.payload?.message || "Error captured on this hop") +
      "</div>"
    : "";

  if (state.section === "events") {
    els.detail.innerHTML =
      hero +
      '<div class="inspect-scroll"><div class="inspect-body">' +
      rail(state.timeline) +
      '<p class="note">Click REQUEST STARTED or REQUEST COMPLETED to inspect the full payload.</p>' +
      "</div></div>";
  } else {
    els.detail.innerHTML =
      hero +
      fault +
      '<div class="inspect-scroll"><div class="inspect-body"><div class="split">' +
      sidePane("request", "Request", ctx.request, method) +
      sidePane("response", "Response", ctx.response, method) +
      rail(state.timeline) +
      "</div></div></div>";
  }
  // Restore every saved scroll position after the DOM is rebuilt.
  restoreDetailScrolls(scrollMap);
  _lastRenderedId = request ? request.requestId : null;
}

/* ─── 8. Data loading ──────────────────────────────────────────────── */

// Select a hop: update the hash (deep-linkable), fetch its timeline,
// and render the inspect pane.
async function selectRequest(id) {
  state.selected = id;
  state.eventId = null;
  const onPage = state.requests.find((item) => item.requestId === id);
  if (onPage) state.selectedSummary = onPage;
  location.hash = encodeURIComponent(id);
  setMobilePane("inspect");
  renderList({ scrollSelected: true });
  const data = await api("/timeline/" + encodeURIComponent(id));
  state.timeline = data.timeline || [];
  renderDetail();
}

// Fetch one page of request summaries and re-render. Runs on demand and
// every 2s while Live is on. state.loadGen discards stale responses when
// requests overlap. While "following", page 1 auto-selects the newest hop;
// an open modal pauses re-rendering so reading is never interrupted.
async function loadRequests(options = {}) {
  const gen = ++state.loadGen;
  els.status.textContent = state.live ? "Live…" : "Syncing…";
  els.pager.setAttribute("aria-busy", "true");
  els.list.setAttribute("aria-busy", "true");
  if (state.live && state.following) state.page = 1;
  const params = new URLSearchParams();
  const search = els.search.value.trim();
  const method = els.method.value;
  const statusCode = els.statusCode.value.trim();
  const pageSize = PAGE_SIZES.includes(state.pageSize) ? state.pageSize : 25;
  const page =
    Number.isSafeInteger(state.page) && state.page > 0 ? state.page : 1;
  state.page = page;
  state.pageSize = pageSize;
  if (search) params.set("search", search);
  if (method) params.set("method", method);
  if (statusCode) params.set("statusCode", statusCode);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (state.section === "errors" || state.range === "errors") {
    params.set("faults", "1");
  } else if (/^[2-5]$/.test(state.range)) {
    params.set("statusFamily", state.range);
  }
  let data;
  try {
    data = await api("/requests?" + params.toString());
  } finally {
    if (gen === state.loadGen) els.pager.setAttribute("aria-busy", "false");
  }
  if (gen !== state.loadGen) return;
  applyPageMeta(data);
  const incoming = Array.isArray(data.requests) ? data.requests : [];
  const previousNewest = state.page === 1 ? state.requests[0]?.requestId : null;
  const added = incoming.filter(
    (item) => state.known.size && !state.known.has(item.requestId),
  );
  incoming.forEach((item) => {
    if (state.known.size && !state.known.has(item.requestId))
      item._flash = true;
    state.known.add(item.requestId);
  });
  const wasFollowing =
    state.following || !state.selected || state.selected === previousNewest;
  state.requests = incoming;
  if (!state.selected && !state.modal && incoming[0]) {
    state.selected = incoming[0].requestId;
    state.selectedSummary = incoming[0];
    state.following = state.page === 1;
    location.hash = encodeURIComponent(state.selected);
  } else if (
    state.live &&
    wasFollowing &&
    !state.modal &&
    state.page === 1 &&
    incoming[0] &&
    incoming[0].requestId !== state.selected
  ) {
    state.selected = incoming[0].requestId;
    state.selectedSummary = incoming[0];
    state.following = true;
    location.hash = encodeURIComponent(state.selected);
  } else {
    const onPage = incoming.find((item) => item.requestId === state.selected);
    if (onPage) state.selectedSummary = onPage;
  }
  if (added.length && state.live && !state.following)
    toast(added.length + " new hop" + (added.length === 1 ? "" : "s"));
  // Preserve the user's scroll position in the hop list.
  // Only jump to top when following (user is at top and live-auto-tracking).
  const top = els.list.scrollTop;
  const wasAtTop = top < 40; // within ~1 hop height of the top
  renderList();
  if (state.live && state.following && wasAtTop) {
    setListScroll(0);
  } else {
    // Don't touch scroll at all — restore exactly where the user was.
    setListScroll(top);
  }
  setTimeout(() => {
    state.requests.forEach((item) => {
      item._flash = false;
    });
  }, 900);
  els.status.textContent = state.live
    ? "Live"
    : "Updated " + new Date().toLocaleTimeString();
  if (state.modal) return;
  if (
    state.selected &&
    incoming.some((item) => item.requestId === state.selected)
  ) {
    if (options.refreshTimeline !== false) {
      const dataTimeline = await api(
        "/timeline/" + encodeURIComponent(state.selected),
      );
      if (gen !== state.loadGen) return;
      state.timeline = dataTimeline.timeline || [];
      if (
        state.eventId &&
        !state.timeline.some((event) => event.id === state.eventId)
      ) {
        state.eventId = null;
      }
    }
    renderDetail();
  } else {
    renderDetail();
  }
}

function setLive(on) {
  state.live = on;
  try {
    localStorage.setItem("traceo.live", on ? "1" : "0");
  } catch {}
  els.live.classList.toggle("active", on);
  els.live.setAttribute("aria-pressed", on ? "true" : "false");
  els.liveDot.classList.toggle("on", on);
  els.live.textContent = on ? "Pause" : "Live";
  clearInterval(state.timer);
  if (on)
    state.timer = setInterval(
      () =>
        loadRequests().catch((err) => {
          els.status.textContent = err.message;
        }),
      2000,
    );
  updateChrome();
}

function typing() {
  const el = document.activeElement;
  const tag = el?.tagName;
  return (
    el === els.search ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    Boolean(el?.closest?.("[data-json-path]"))
  );
}

/* ─── 9. Event wiring ──────────────────────────────────────────────── */

// ── Hop list scroll: detect when the user manually scrolls away from the
// top and mark state.following = false so live polling doesn't fight them.
// We use a flag to distinguish programmatic scrolls (which set this flag)
// from genuine user-initiated scroll gestures.
let _programmaticScroll = false;
els.list.addEventListener(
  "scroll",
  () => {
    if (_programmaticScroll) return;
    // If the user scrolled more than ~40px from the top, stop following.
    if (els.list.scrollTop > 40) {
      state.following = false;
    }
  },
  { passive: true },
);

// Wrap the scroll-top setter so we can mark it programmatic and not
// accidentally trigger the "unfollow" listener above.
function setListScroll(top) {
  _programmaticScroll = true;
  els.list.scrollTop = top;
  // Reset on next tick — by then the scroll event will have fired.
  requestAnimationFrame(() => {
    _programmaticScroll = false;
  });
}

document.querySelector(".mobile-switch").addEventListener("click", (event) => {
  const button = event.target.closest("[data-pane]");
  if (button) setMobilePane(button.dataset.pane);
});
els.live.addEventListener("click", () => setLive(!state.live));
document.getElementById("reload").addEventListener("click", () => {
  loadRequests().catch((err) => {
    els.status.textContent = err.message;
  });
});
document.getElementById("clear-all").addEventListener("click", () => {
  clearAllRequests();
});
document
  .getElementById("empty-live")
  .addEventListener("click", () => setLive(true));
els.search.addEventListener(
  "input",
  debounce(() => {
    resetToFirstPage();
    loadRequests({ refreshTimeline: false }).catch((err) => {
      els.status.textContent = err.message;
    });
  }),
);
document.getElementById("clear-search").addEventListener("click", () => {
  els.search.value = "";
  resetToFirstPage();
  loadRequests({ refreshTimeline: false }).catch((err) => {
    els.status.textContent = err.message;
  });
});
els.method.addEventListener("change", () => {
  resetToFirstPage();
  loadRequests({ refreshTimeline: false }).catch((err) => {
    els.status.textContent = err.message;
  });
});
document.getElementById("clear").addEventListener("click", () => {
  els.search.value = "";
  els.method.value = "";
  els.statusCode.value = "";
  state.range = "";
  state.section = "requests";
  resetToFirstPage();
  syncPressed(
    document.querySelectorAll(".modes [data-section]"),
    (item) => item.dataset.section === "requests",
  );
  syncPressed(
    document.querySelectorAll(".chip[data-range]"),
    (chip) => chip.dataset.range === "",
  );
  loadRequests({ refreshTimeline: false }).catch((err) => {
    els.status.textContent = err.message;
  });
});
document.getElementById("chips").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-range]");
  if (!chip) return;
  state.range = chip.dataset.range;
  resetToFirstPage();
  syncPressed(
    document.querySelectorAll(".chip[data-range]"),
    (item) => item === chip,
  );
  loadRequests({ refreshTimeline: false }).catch((err) => {
    els.status.textContent = err.message;
  });
});
document.querySelector(".modes").addEventListener("click", (event) => {
  const button = event.target.closest("[data-section]");
  if (!button) return;
  state.section = button.dataset.section;
  syncPressed(
    document.querySelectorAll(".modes [data-section]"),
    (item) => item === button,
  );
  if (state.section === "errors") state.range = "errors";
  if (state.section === "requests") state.range = "";
  resetToFirstPage();
  syncPressed(
    document.querySelectorAll(".chip[data-range]"),
    (item) => item.dataset.range === state.range,
  );
  loadRequests({ refreshTimeline: false }).catch((err) => {
    els.status.textContent = err.message;
  });
});
els.pagePrev.addEventListener("click", () => {
  goPage(state.page - 1).catch((err) => {
    els.status.textContent = err.message;
  });
});
els.pageNext.addEventListener("click", () => {
  goPage(state.page + 1).catch((err) => {
    els.status.textContent = err.message;
  });
});
els.pageInput.addEventListener("change", () => {
  commitPageInput();
});
els.pageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    commitPageInput();
  }
  if (event.key === "Escape") {
    els.pageInput.value = String(state.page);
    els.pageInput.blur();
  }
});
els.pageSize.addEventListener("change", () => {
  const next = Number(els.pageSize.value);
  if (!PAGE_SIZES.includes(next)) {
    els.pageSize.value = String(
      PAGE_SIZES.includes(state.pageSize) ? state.pageSize : 25,
    );
    return;
  }
  state.pageSize = next;
  resetToFirstPage();
  loadRequests({ refreshTimeline: false }).catch((err) => {
    els.status.textContent = err.message;
  });
});
els.detail.addEventListener("click", async (event) => {
  const reset = event.target.closest("[data-reset]");
  if (reset) {
    document.getElementById("clear").click();
    return;
  }
  const wrap = event.target.closest("[data-wrap]");
  if (wrap) {
    state.wrap = !state.wrap;
    renderDetail();
    return;
  }
  const inspect = event.target.closest("[data-open-modal]");
  if (inspect) {
    const kind = inspect.dataset.openModal;
    openModal({
      kind,
      title: kind === "request" ? "Request" : "Response",
    });
    return;
  }
  const mode = event.target.closest("[data-json-mode]");
  if (mode) {
    state.jsonMode = mode.dataset.jsonMode;
    if (state.modal) renderModal();
    else renderDetail();
    return;
  }
  const toggle = event.target.closest("[data-json-path]");
  if (toggle) {
    toggleJsonPath(
      toggle.dataset.jsonPath,
      Number(toggle.dataset.jsonDepth || 0),
    );
    if (state.modal) renderModal();
    else renderDetail();
    return;
  }
  const jsonCopy = event.target.closest("[data-json-copy]");
  if (jsonCopy) {
    await copyText(jsonCopies.get(jsonCopy.dataset.jsonCopy), "Copied JSON");
    return;
  }
  const node = event.target.closest("[data-event]");
  if (node) {
    const eventId = node.dataset.event;
    const item = state.timeline.find((entry) => entry.id === eventId);
    state.eventId = eventId;
    renderDetail();
    if (item) {
      openModal({
        eventId,
        title: (item.type || "Signal").replace(/_/g, " "),
        value: item,
      });
    }
    return;
  }
  const json = event.target.closest("[data-copy-json]");
  if (json) {
    await copyText(
      JSON.stringify(state.timeline, null, 2),
      "Copied timeline JSON",
    );
    return;
  }
  const pane = event.target.closest("[data-copy-pane]");
  if (pane) {
    const ctx = contextFrom(state.timeline);
    const data =
      pane.dataset.copyPane === "request" ? ctx.request : ctx.response;
    await copyText(
      JSON.stringify(
        {
          headers: data.headers,
          query: data.query,
          cookies: data.cookies,
          body: prettyValue(data.body),
        },
        null,
        2,
      ),
      "Copied " + pane.dataset.copyPane,
    );
    return;
  }
  const copy = event.target.closest("[data-copy]");
  if (copy && copy.dataset.copy) await copyText(copy.dataset.copy, "Copied");
});
document.getElementById("modal").addEventListener("click", async (event) => {
  if (event.target.closest("[data-modal-close]")) {
    closeModal();
    return;
  }
  const mode = event.target.closest("[data-json-mode]");
  if (mode) {
    state.jsonMode = mode.dataset.jsonMode;
    renderModal();
    return;
  }
  const toggle = event.target.closest("[data-json-path]");
  if (toggle) {
    toggleJsonPath(
      toggle.dataset.jsonPath,
      Number(toggle.dataset.jsonDepth || 0),
    );
    renderModal();
    return;
  }
  const jsonCopy = event.target.closest("[data-json-copy]");
  if (jsonCopy)
    await copyText(jsonCopies.get(jsonCopy.dataset.jsonCopy), "Copied JSON");
});
window.addEventListener("hashchange", () => {
  const id = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (id && id !== state.selected) {
    state.following = false;
    selectRequest(id);
  }
});
// Keyboard shortcuts (also listed in the footer):
//   /       focus search          esc  close modal / clear filters
//   j / k   next / previous hop   [ ]  previous / next page
//   l       toggle live           r    refresh
//   c       copy selected hop id
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !typing()) {
    event.preventDefault();
    els.search.focus();
    els.search.select();
  }
  if (event.key === "Escape") {
    if (state.modal) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (typing()) {
      els.search.blur();
      return;
    }
    if (isMobileWorkspace() && els.workspace.dataset.pane === "inspect") {
      event.preventDefault();
      setMobilePane("stream");
      return;
    }
    if (els.search.value || els.method.value || state.range)
      document.getElementById("clear").click();
  }
  if (event.key === "Enter" || event.key === " ") {
    const fold = event.target.closest("[data-json-path]");
    if (fold) {
      event.preventDefault();
      toggleJsonPath(
        fold.dataset.jsonPath,
        Number(fold.dataset.jsonDepth || 0),
      );
      if (state.modal) renderModal();
      else renderDetail();
      return;
    }
  }
  if (typing()) return;
  if (event.key === "l") setLive(!state.live);
  if (event.key === "r")
    loadRequests().catch((err) => {
      els.status.textContent = err.message;
    });
  if (event.key === "c") copyText(state.selected, "Copied hop ID");
  if (event.key === "[" || event.key === "PageUp") {
    event.preventDefault();
    goPage(state.page - 1).catch((err) => {
      els.status.textContent = err.message;
    });
    return;
  }
  if (event.key === "]" || event.key === "PageDown") {
    event.preventDefault();
    goPage(state.page + 1).catch((err) => {
      els.status.textContent = err.message;
    });
    return;
  }
  if (event.key === "j" || event.key === "k") {
    const cards = [...els.list.querySelectorAll(".hop")];
    const current = cards.findIndex(
      (card) => card.dataset.id === state.selected,
    );
    if (
      event.key === "j" &&
      (cards.length === 0 || current === cards.length - 1) &&
      state.hasNext
    ) {
      goPage(state.page + 1, { select: "first" }).catch((err) => {
        els.status.textContent = err.message;
      });
      return;
    }
    if (event.key === "k" && current <= 0 && state.hasPrev) {
      goPage(state.page - 1, { select: "last" }).catch((err) => {
        els.status.textContent = err.message;
      });
      return;
    }
    focusCard(event.key === "j" ? current + 1 : current - 1);
  }
});

function debounce(fn, ms = 220) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ─── 10. Boot ─────────────────────────────────────────────────────── */

// Restore the saved Live preference, load the first page, then honor a
// #requestId deep link if one is present in the URL.
let livePref = true;
try {
  livePref = localStorage.getItem("traceo.live") !== "0";
} catch {}
setLive(livePref);
loadRequests()
  .then(() => {
    if (state.selected) return selectRequest(state.selected);
  })
  .catch((err) => {
    els.status.textContent = err.message;
  });
