(() => {
  "use strict";

  const TREES = [
    { id: "home", title: "Home" },
    { id: "nutrition", title: "Nutrition" },
    { id: "conditioning", title: "Conditioning" },
    { id: "strength", title: "Strength" },
    { id: "skill", title: "Skills Training" },
    { id: "settings", title: "Settings" },
    { id: "database", title: "Database" },
    { id: "architecture", title: "Architecture" },
  ];
  const KINDS = {
    app: ["App", "App entry point"],
    screen: ["Screen", "Main screen (tab or sidebar destination)"],
    subscreen: ["Screen", "Screen reached by navigating from its parent"],
    card: ["Card", "Card or section rendered inside a screen"],
    component: ["Component", "Component rendered inside its parent"],
    overlay: ["Overlay", "Dropdown, popover, chooser, or sheet"],
    modal: ["Modal", "Modal dialog"],
    state: ["State", "Context or workspace state"],
    logic: ["Logic", "Pure domain logic"],
    service: ["Service", "External API, proxy, or background task"],
    data: ["Data", "Database, repository, or migration module"],
    table: ["Table", "SQLite table"],
    config: ["Config", "Tooling, configuration, docs, or rules"],
    group: ["Group", "Grouping only"],
    archive: ["Archive", "Container for a reverted lineage"],
  };
  const STATUSES = {
    active: "In the app on main",
    placeholder: "Placeholder: exists but has no real content",
    planned: "Planned in the README, not built",
    removed: "Deleted from main with no successor",
    reverted: "Only on the reverted backup branch",
  };
  const ARCHIVE_BRANCH = "backup/pre-revert-7daf5e7";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const CAPS = (window.CAPS = { trees: {}, commits: {}, repo: "", generated: "" });
  const pageTree = document.body.dataset.tree || "";
  const INDEX = new Map();
  const REFERRERS = new Map();
  const HAYSTACKS = new WeakMap();
  const els = {};
  const state = {
    collapsed: new Set(),
    showReverted: true,
    zoom: 1,
    searchMatches: null,
    selected: null,
    newestFirst: false,
    cursor: -1,
  };

  const store = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(`caps-feature-tree:${key}`);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`caps-feature-tree:${key}`, JSON.stringify(value));
      } catch {
        /* storage unavailable */
      }
    },
  };

  function loadScript(src) {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.append(script);
    });
  }

  Promise.all([loadScript("data/commits.js"), ...TREES.map((tree) => loadScript(`data/${tree.id}.js`))]).then(start);

  function start() {
    buildIndex();
    document.body.prepend(header());
    if (!pageTree) renderIndexPage();
    else if (CAPS.trees[pageTree]?.root) renderTreePage();
    else renderMissingTree();
  }

  /* ---------- helpers ---------- */

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") el.className = value;
      else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false || child === "") continue;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  function fill(el, ...children) {
    el.replaceChildren(...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
  }

  function rich(text) {
    const fragment = document.createDocumentFragment();
    for (const part of String(text ?? "").split(/(`[^`]+`)/)) {
      if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) fragment.append(h("code", null, part.slice(1, -1)));
      else if (part) fragment.append(part);
    }
    return fragment;
  }

  function plain(text) {
    return String(text ?? "").replace(/`/g, "");
  }

  function treeTitle(treeId) {
    return CAPS.trees[treeId]?.title || TREES.find((tree) => tree.id === treeId)?.title || treeId;
  }

  function kindLabel(kind) {
    return KINDS[kind]?.[0] || kind || "Node";
  }

  function kindStyle(kind) {
    return `--kind: var(--k-${KINDS[kind] ? kind : "group"})`;
  }

  function parseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(value || "");
    if (!match) return null;
    const [, y, mo, d, hh, mm, sign, oh, om] = match;
    const offset = (sign === "-" ? -1 : 1) * (Number(oh) * 60 + Number(om));
    return {
      y: Number(y),
      mo: Number(mo),
      d: Number(d),
      hh,
      mm,
      day: `${y}-${mo}-${d}`,
      tz: `UTC${sign === "-" ? "\u2212" : "+"}${Number(oh)}${om === "00" ? "" : `:${om}`}`,
      iso: `${y}-${mo}-${d}T${hh}:${mm}${sign}${oh}:${om}`,
      epoch: Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm)) - offset * 60000,
    };
  }

  function fmtDay(date) {
    return `${MONTHS[date.mo - 1]} ${date.d}, ${date.y}`;
  }

  function fmtStamp(date) {
    return `${fmtDay(date)} \u00b7 ${date.hh}:${date.mm} (${date.tz})`;
  }

  function lineageOf(version) {
    const commits = version.commits || [];
    if (!commits.length) return version.uncommitted ? "uncommitted" : "main";
    return commits.some((hash) => CAPS.commits[hash]?.l === "main") ? "main" : "reverted";
  }

  function lastVersion(node) {
    const versions = node.versions || [];
    return versions[versions.length - 1] || null;
  }

  /* ---------- index ---------- */

  function buildIndex() {
    for (const { id: treeId } of TREES) {
      const root = CAPS.trees[treeId]?.root;
      if (!root) continue;
      const nodes = new Map();
      const walk = (node, parentId, depth) => {
        nodes.set(node.id, { treeId, node, parentId, depth });
        for (const child of node.children || []) walk(child, node.id, depth + 1);
      };
      walk(root, null, 0);
      INDEX.set(treeId, nodes);
    }
    for (const [treeId, nodes] of INDEX) {
      for (const { node } of nodes.values()) {
        if (node.ref) addReferrer(keyOf(treeId, node.ref), { treeId, id: node.id, via: "ref" });
        for (const link of node.links || []) addReferrer(keyOf(treeId, link), { treeId, id: node.id, via: "link" });
      }
    }
  }

  function keyOf(treeId, ref) {
    return ref.includes(":") ? ref : `${treeId}:${ref}`;
  }

  function addReferrer(key, info) {
    if (!REFERRERS.has(key)) REFERRERS.set(key, []);
    REFERRERS.get(key).push(info);
  }

  function lookup(key) {
    const [treeId, id] = key.split(":");
    return INDEX.get(treeId)?.get(id) || null;
  }

  function canonical(entry) {
    let current = entry;
    for (let hops = 0; current?.node.ref && hops < 6; hops += 1) current = lookup(keyOf(current.treeId, current.node.ref));
    return current && !current.node.ref ? current : null;
  }

  function entryOf(id) {
    return INDEX.get(pageTree)?.get(id) || null;
  }

  function ancestors(entry) {
    const list = [];
    const nodes = INDEX.get(entry.treeId);
    for (let id = entry.parentId; id; id = nodes.get(id).parentId) list.push(nodes.get(id));
    return list;
  }

  function treeStats(treeId) {
    const stats = { nodes: 0, versions: 0, latest: null };
    for (const { node } of INDEX.get(treeId)?.values() || []) {
      if (node.ref) continue;
      stats.nodes += 1;
      for (const version of node.versions || []) {
        stats.versions += 1;
        const date = parseDate(version.date);
        if (date && (!stats.latest || date.epoch > stats.latest.epoch)) stats.latest = date;
      }
    }
    return stats;
  }

  /* ---------- chrome ---------- */

  function header() {
    return h(
      "header",
      { class: "top" },
      h("a", { class: "brand", href: "index.html" }, "CAPS S&C ", h("span", null, "feature tree")),
      h(
        "nav",
        { class: "nav", "aria-label": "Trees" },
        h("a", { href: "index.html", "aria-current": pageTree ? null : "page" }, "Overview"),
        h("span", { class: "sep", "aria-hidden": "true" }),
        TREES.map((tree) =>
          h("a", { href: `${tree.id}.html`, "aria-current": tree.id === pageTree ? "page" : null }, tree.title),
        ),
      ),
    );
  }

  function chip(content, attrs) {
    return h("span", { class: "chip", ...attrs }, content);
  }

  function nodeChip(treeId, id, extra) {
    const entry = INDEX.get(treeId)?.get(id);
    const target = entry && canonical(entry);
    if (!target) return chip(`missing: ${treeId}:${id}`, { class: "chip", style: "border-color: var(--accent)" });
    const label = [
      h("span", { class: "swatch", style: kindStyle(target.node.kind) }),
      target.node.title,
      entry.node.ref ? " \u2197" : "",
      extra ? h("span", { class: "muted" }, ` \u00b7 ${extra}`) : null,
    ];
    if (treeId === pageTree) {
      return h("button", { class: "chip", type: "button", onclick: () => select(id, { scroll: true }) }, label);
    }
    return h("a", { class: "chip", href: `${treeId}.html#${encodeURIComponent(id)}` }, label, h("span", { class: "muted" }, ` \u00b7 ${treeTitle(treeId)}`));
  }

  /* ---------- tree page ---------- */

  function renderMissingTree() {
    const title = treeTitle(pageTree);
    document.title = `${title} \u00b7 CAPS feature tree`;
    document.body.append(
      h(
        "main",
        { class: "page" },
        h("h1", null, title),
        h("div", { class: "empty" }, `No data yet. Create docs/feature-tree/data/${pageTree}.js and run npm run feature-tree.`),
      ),
    );
  }

  function renderTreePage() {
    const tree = CAPS.trees[pageTree];
    const stats = treeStats(pageTree);
    document.title = `${tree.title} \u00b7 CAPS feature tree`;
    document.body.classList.add("tree-page");

    for (const { node } of INDEX.get(pageTree).values()) if (node.kind === "archive") state.collapsed.add(node.id);
    state.showReverted = store.get("showReverted", true);
    state.newestFirst = store.get("newestFirst", false);

    els.search = h("input", {
      type: "search",
      placeholder: "Search nodes, files, versions, commits  ( / )",
      "aria-label": "Search this tree",
      oninput: (event) => onSearch(event.target.value),
      onkeydown: (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          nextMatch(event.shiftKey ? -1 : 1);
        }
      },
    });
    els.count = h("span", { class: "count", "aria-live": "polite" });
    els.zoomLabel = h("span", { class: "zoom-label" });
    els.reverted = h("input", {
      type: "checkbox",
      onchange: (event) => {
        state.showReverted = event.target.checked;
        store.set("showReverted", state.showReverted);
        renderTree();
      },
    });
    els.reverted.checked = state.showReverted;
    els.wrap = h("div", { class: "tree-wrap" });
    els.sizer = h("div", { class: "sizer" }, els.wrap);
    els.canvas = h("div", { class: "canvas" }, els.sizer);
    els.panel = h("aside", { class: "panel", "aria-label": "Node details" });

    const rules = tree.rules || [];
    document.body.append(
      h(
        "section",
        { class: "intro" },
        h("h1", null, tree.title),
        h("p", null, rich(tree.summary)),
        h(
          "div",
          { class: "meta" },
          chip(`${stats.nodes} nodes`),
          chip(`${stats.versions} versions`),
          stats.latest ? chip(`last change ${fmtDay(stats.latest)}`) : null,
          rules.map((rule) =>
            h("a", { class: "chip", href: CAPS.repo ? `${CAPS.repo}/blob/main/.cursor/rules/${rule}` : null, target: "_blank", rel: "noopener" }, `rule: ${rule}`),
          ),
          CAPS.generated ? chip(`git read ${CAPS.generated}`) : null,
        ),
      ),
      h(
        "div",
        { class: "toolbar" },
        els.search,
        els.count,
        h("button", { class: "btn", type: "button", onclick: expandAll }, "Expand all"),
        h("button", { class: "btn", type: "button", onclick: collapseAll }, "Collapse all"),
        h("span", { class: "spacer" }),
        h("label", { class: "toggle" }, els.reverted, "Show reverted lineage"),
        h("button", { class: "btn", type: "button", "aria-label": "Zoom out", onclick: () => setZoom(state.zoom - 0.1) }, "\u2212"),
        els.zoomLabel,
        h("button", { class: "btn", type: "button", "aria-label": "Zoom in", onclick: () => setZoom(state.zoom + 0.1) }, "+"),
        h("button", { class: "btn", type: "button", onclick: fitZoom }, "Fit"),
        h("button", { class: "btn", type: "button", onclick: () => setZoom(1) }, "100%"),
      ),
      els.canvas,
      els.panel,
    );

    renderTree();
    const stored = store.get(`zoom:${pageTree}`, null);
    setZoom(stored ?? Math.min(1, Math.max(0.6, fitRatio())), false);
    new ResizeObserver(updateSizer).observe(els.wrap);
    enablePan(els.canvas);

    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && document.activeElement !== els.search) {
        event.preventDefault();
        els.search.focus();
      } else if (event.key === "Escape") {
        if (document.activeElement === els.search && els.search.value) {
          els.search.value = "";
          onSearch("");
        } else closePanel();
      }
    });
    window.addEventListener("hashchange", () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (id && id !== state.selected) select(id, { scroll: true });
    });

    const initial = decodeURIComponent(location.hash.slice(1));
    if (!initial || !select(initial, { scroll: true })) {
      els.canvas.scrollLeft = (els.canvas.scrollWidth - els.canvas.clientWidth) / 2;
    }
  }

  function isHidden(node) {
    if (state.showReverted) return false;
    const target = canonical({ treeId: pageTree, node }) || { node };
    return target.node.status === "reverted" || target.node.kind === "archive" || node.status === "reverted";
  }

  function visibleChildren(node) {
    return (node.children || []).filter((child) => !isHidden(child));
  }

  function countDescendants(node) {
    return visibleChildren(node).reduce((sum, child) => sum + 1 + countDescendants(child), 0);
  }

  function renderTree() {
    els.wrap.replaceChildren(h("ul", { class: "tree" }, renderItem(CAPS.trees[pageTree].root, 0)));
    markSelected();
    applySearchMarks();
    updateSizer();
  }

  function renderItem(node, depth) {
    const kids = visibleChildren(node);
    const collapsed = kids.length > 0 && state.collapsed.has(node.id);
    const wrap = h("div", { class: "node-wrap" }, nodeButton(node, depth));
    if (kids.length) {
      wrap.append(
        h(
          "button",
          {
            class: "twisty",
            type: "button",
            title: collapsed ? "Expand branch" : "Collapse branch",
            "aria-expanded": String(!collapsed),
            onclick: (event) => {
              event.stopPropagation();
              toggleCollapse(node.id);
            },
          },
          collapsed ? `+${countDescendants(node)}` : "\u2212",
        ),
      );
    }
    const item = h("li", null, wrap);
    if (kids.length && !collapsed) item.append(h("ul", null, kids.map((kid) => renderItem(kid, depth + 1))));
    return item;
  }

  function nodeButton(node, depth) {
    const target = canonical(entryOf(node.id));
    const shown = target ? target.node : node;
    const status = shown.status || "active";
    const latest = lastVersion(shown);
    const latestDate = latest && parseDate(latest.date);
    const classes = ["node", `kind-${shown.kind}`, `status-${status}`];
    if (depth === 0) classes.push("is-root");
    if (node.ref) classes.push(target ? "is-ref" : "is-broken");
    let label = kindLabel(shown.kind);
    if (node.ref) label = target && target.treeId !== pageTree ? `${label} \u2197 ${treeTitle(target.treeId)}` : `${label} \u2197`;
    return h(
      "button",
      {
        type: "button",
        class: classes.join(" "),
        "data-id": node.id,
        style: kindStyle(shown.kind),
        title: plain(target ? shown.summary : `Broken reference: ${node.ref}`),
        onclick: () => select(node.id),
      },
      h("span", { class: "node-kind" }, label),
      h("span", { class: "node-title" }, shown.title || node.ref),
      node.note || shown.tagline ? h("span", { class: "node-tag" }, rich(node.note || shown.tagline)) : null,
      h(
        "span",
        { class: "node-meta" },
        latest ? h("span", { class: "ver-badge" }, `v${latest.n}`) : null,
        latestDate ? h("span", null, fmtDay(latestDate)) : null,
        status !== "active" ? h("span", { class: "pill" }, status) : null,
      ),
    );
  }

  function nodeEl(id) {
    return els.wrap.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
  }

  function keepAnchored(id, change) {
    const before = nodeEl(id)?.getBoundingClientRect();
    change();
    const after = nodeEl(id)?.getBoundingClientRect();
    if (before && after) {
      els.canvas.scrollLeft += after.left - before.left;
      els.canvas.scrollTop += after.top - before.top;
    }
  }

  function toggleCollapse(id) {
    keepAnchored(id, () => {
      if (!state.collapsed.delete(id)) state.collapsed.add(id);
      renderTree();
    });
  }

  function expandAll() {
    state.collapsed.clear();
    renderTree();
  }

  function collapseAll() {
    for (const { node, depth } of INDEX.get(pageTree).values()) {
      if (depth >= 1 && node.children?.length) state.collapsed.add(node.id);
    }
    renderTree();
    els.canvas.scrollLeft = (els.canvas.scrollWidth - els.canvas.clientWidth) / 2;
    els.canvas.scrollTop = 0;
  }

  function updateSizer() {
    if (!els.wrap) return;
    els.sizer.style.width = `${els.wrap.offsetWidth * state.zoom}px`;
    els.sizer.style.height = `${els.wrap.offsetHeight * state.zoom}px`;
    els.wrap.style.transform = `scale(${state.zoom})`;
  }

  function fitRatio() {
    return (els.canvas.clientWidth - 48) / Math.max(1, els.wrap.offsetWidth);
  }

  function setZoom(value, persist = true) {
    const canvas = els.canvas;
    const cx = (canvas.scrollLeft + canvas.clientWidth / 2) / Math.max(1, canvas.scrollWidth);
    const cy = (canvas.scrollTop + canvas.clientHeight / 2) / Math.max(1, canvas.scrollHeight);
    state.zoom = Math.min(1.6, Math.max(0.25, Math.round(value * 100) / 100));
    updateSizer();
    els.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
    canvas.scrollLeft = cx * canvas.scrollWidth - canvas.clientWidth / 2;
    canvas.scrollTop = cy * canvas.scrollHeight - canvas.clientHeight / 2;
    if (persist) store.set(`zoom:${pageTree}`, state.zoom);
  }

  function fitZoom() {
    setZoom(Math.min(1, fitRatio()));
    els.canvas.scrollLeft = 0;
  }

  function enablePan(canvas) {
    let drag = null;
    canvas.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || event.target.closest("button, a, input, label, summary")) return;
      drag = { x: event.clientX, y: event.clientY, left: canvas.scrollLeft, top: canvas.scrollTop };
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("dragging");
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!drag) return;
      canvas.scrollLeft = drag.left - (event.clientX - drag.x);
      canvas.scrollTop = drag.top - (event.clientY - drag.y);
    });
    const end = () => {
      drag = null;
      canvas.classList.remove("dragging");
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener(
      "wheel",
      (event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        setZoom(state.zoom + (event.deltaY < 0 ? 0.1 : -0.1));
      },
      { passive: false },
    );
  }

  function scrollToNode(id) {
    const el = nodeEl(id);
    if (!el) return;
    const node = el.getBoundingClientRect();
    const view = els.canvas.getBoundingClientRect();
    els.canvas.scrollBy({
      left: node.left + node.width / 2 - (view.left + view.width / 2),
      top: node.top - view.top - Math.min(140, view.height / 4),
      behavior: "smooth",
    });
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  }

  /* ---------- search ---------- */

  function haystack(entry) {
    if (HAYSTACKS.has(entry)) return HAYSTACKS.get(entry);
    const target = canonical(entry);
    const node = target ? target.node : entry.node;
    const parts = [node.id, node.title, node.tagline, node.summary, node.entry, entry.node.note, ...(node.files || []), ...(node.guardrails || [])];
    for (const item of [...(node.modes || []), ...(node.parts || [])]) parts.push(item.name, item.detail);
    for (const version of node.versions || []) {
      parts.push(`${version.name} ${version.n}`, version.request, ...(version.changes || []), ...(version.commits || []));
      for (const hash of version.commits || []) parts.push(CAPS.commits[hash]?.s);
    }
    const text = plain(parts.filter(Boolean).join("\n")).toLowerCase();
    HAYSTACKS.set(entry, text);
    return text;
  }

  function onSearch(value) {
    const words = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = words.length ? new Set() : null;
    state.searchMatches = matches;
    state.cursor = -1;
    let reopened = false;
    if (matches) {
      for (const entry of INDEX.get(pageTree).values()) {
        const text = haystack(entry);
        if (!words.every((word) => text.includes(word))) continue;
        matches.add(entry.node.id);
        for (const parent of ancestors(entry)) if (state.collapsed.delete(parent.node.id)) reopened = true;
      }
    }
    if (reopened) renderTree();
    else applySearchMarks();
  }

  function applySearchMarks() {
    const matches = state.searchMatches;
    els.wrap.classList.toggle("searching", matches !== null);
    let count = 0;
    for (const el of els.wrap.querySelectorAll(".node")) {
      const hit = matches?.has(el.dataset.id) ?? false;
      el.classList.toggle("match", hit);
      if (hit) count += 1;
    }
    els.count.textContent = matches ? `${count} match${count === 1 ? "" : "es"}` : "";
  }

  function nextMatch(step) {
    const hits = [...els.wrap.querySelectorAll(".node.match")];
    if (!hits.length) return;
    state.cursor = (state.cursor + step + hits.length) % hits.length;
    select(hits[state.cursor].dataset.id, { scroll: true });
  }

  /* ---------- selection + panel ---------- */

  function markSelected() {
    for (const el of els.wrap.querySelectorAll(".node.selected")) el.classList.remove("selected");
    if (state.selected) nodeEl(state.selected)?.classList.add("selected");
  }

  function select(id, { scroll = false } = {}) {
    const entry = entryOf(id);
    if (!entry) return false;
    let rerender = false;
    for (const parent of ancestors(entry)) if (state.collapsed.delete(parent.node.id)) rerender = true;
    if (!state.showReverted && [entry, ...ancestors(entry)].some(({ node }) => isHidden(node))) {
      state.showReverted = true;
      els.reverted.checked = true;
      rerender = true;
    }
    if (rerender) renderTree();
    const wasOpen = document.body.classList.contains("panel-open");
    state.selected = id;
    markSelected();
    renderPanel(entry);
    document.body.classList.add("panel-open");
    if (decodeURIComponent(location.hash.slice(1)) !== id) history.replaceState(null, "", `#${encodeURIComponent(id)}`);
    if (scroll) setTimeout(() => scrollToNode(id), wasOpen ? 0 : 260);
    return true;
  }

  function closePanel() {
    if (!document.body.classList.contains("panel-open")) return;
    document.body.classList.remove("panel-open");
    state.selected = null;
    markSelected();
    history.replaceState(null, "", location.pathname + location.search);
  }

  function section(title, ...content) {
    return h("section", null, h("h3", null, title), ...content);
  }

  function defs(items) {
    return h(
      "dl",
      { class: "defs" },
      items.map((item) => [h("dt", null, rich(item.name)), item.detail ? h("dd", null, rich(item.detail)) : null]),
    );
  }

  function breadcrumbs(entry) {
    const trail = [...ancestors(entry)].reverse();
    const crumbs = [entry.treeId === pageTree ? treeTitle(entry.treeId) : h("a", { href: `${entry.treeId}.html` }, treeTitle(entry.treeId))];
    for (const item of trail) {
      crumbs.push(" \u203a ");
      crumbs.push(
        entry.treeId === pageTree
          ? h("a", { href: `#${encodeURIComponent(item.node.id)}`, onclick: (event) => (event.preventDefault(), select(item.node.id, { scroll: true })) }, item.node.title || item.node.id)
          : h("a", { href: `${entry.treeId}.html#${encodeURIComponent(item.node.id)}` }, item.node.title || item.node.id),
      );
    }
    crumbs.push(" \u203a ", h("strong", null, entry.node.title));
    return h("div", { class: "crumbs" }, crumbs);
  }

  function fileLink(path, status) {
    const clean = path.replace(/\\/g, "/");
    let href = null;
    if (CAPS.repo) {
      if (status === "reverted") href = `${CAPS.repo}/blob/${ARCHIVE_BRANCH}/${clean}`;
      else if (status === "removed") href = `${CAPS.repo}/commits/main/${clean}`;
      else href = `${CAPS.repo}/blob/main/${clean}`;
    }
    return h("a", { href, target: "_blank", rel: "noopener" }, h("code", null, path));
  }

  function referrerChip(ref) {
    const entry = INDEX.get(ref.treeId)?.get(ref.id);
    if (!entry) return null;
    if (ref.via === "ref" && entry.parentId) {
      const parent = INDEX.get(ref.treeId).get(entry.parentId);
      return nodeChip(ref.treeId, ref.id, `inside ${parent.node.title}`);
    }
    return nodeChip(ref.treeId, ref.id, "links here");
  }

  function renderPanel(entry) {
    const target = canonical(entry);
    const shown = target ? target.node : entry.node;
    const home = target || entry;
    const status = shown.status || "active";
    const referrers = (REFERRERS.get(`${home.treeId}:${shown.id}`) || []).filter(
      (ref) => !(ref.treeId === pageTree && ref.id === entry.node.id),
    );
    let refNote = null;
    if (entry.node.ref) {
      const parent = entry.parentId ? entryOf(entry.parentId) : null;
      refNote = target
        ? h(
            "p",
            { class: "note" },
            "Shown here inside ",
            h("strong", null, parent ? parent.node.title : "the root"),
            entry.node.note ? [" (", rich(entry.node.note), ")"] : "",
            ". Its canonical node lives ",
            home.treeId === pageTree
              ? "elsewhere in this tree."
              : ["in the ", h("a", { href: `${home.treeId}.html#${encodeURIComponent(shown.id)}` }, `${treeTitle(home.treeId)} tree`), "."],
          )
        : h("p", { class: "note" }, `Broken reference: ${entry.node.ref}`);
    }

    fill(
      els.panel,
      h(
        "div",
        { class: "panel-head" },
        h("span", { class: "pill", style: `${kindStyle(shown.kind)}; border-color: var(--kind); color: var(--kind)` }, kindLabel(shown.kind)),
        status !== "active" ? h("span", { class: "pill warn", title: STATUSES[status] || "" }, status) : null,
        h("button", { class: "close", type: "button", "aria-label": "Close details", onclick: closePanel }, "\u00d7"),
      ),
      h("h2", null, shown.title || entry.node.ref),
      shown.tagline ? h("p", { class: "tagline" }, rich(shown.tagline)) : null,
      target ? breadcrumbs(home) : null,
      refNote,
      shown.summary ? section("Summary", h("p", null, rich(shown.summary))) : null,
      shown.entry ? section("Opened from", h("p", null, rich(shown.entry))) : null,
      shown.modes?.length ? section("Modes", defs(shown.modes)) : null,
      shown.parts?.length ? section("Contains", defs(shown.parts)) : null,
      shown.guardrails?.length
        ? section("Guardrails \u00b7 don't repeat these", h("ul", { class: "guardrails" }, shown.guardrails.map((item) => h("li", null, rich(item)))))
        : null,
      shown.children?.length
        ? section("Encapsulates", h("div", { class: "chips" }, shown.children.map((child) => nodeChip(home.treeId, child.id))))
        : null,
      referrers.length ? section("Also appears in", h("div", { class: "chips" }, referrers.map(referrerChip))) : null,
      shown.links?.length
        ? section(
            "Related",
            h(
              "div",
              { class: "chips" },
              shown.links.map((link) => {
                const [treeId, id] = keyOf(home.treeId, link).split(":");
                return nodeChip(treeId, id);
              }),
            ),
          )
        : null,
      shown.files?.length ? section("Files", h("ul", { class: "files" }, shown.files.map((path) => h("li", null, fileLink(path, status))))) : null,
      versionsSection(shown, status, entry),
    );
    els.panel.scrollTop = 0;
  }

  function versionsSection(node, status, entry) {
    const versions = node.versions || [];
    if (!versions.length) return null;
    const last = versions[versions.length - 1];
    const ordered = state.newestFirst ? [...versions].reverse() : versions;
    return h(
      "section",
      null,
      h(
        "div",
        { class: "section-head" },
        h("h3", null, `Version history \u00b7 ${versions.length}`),
        h(
          "button",
          {
            class: "btn small",
            type: "button",
            title: "Reverse the order",
            onclick: () => {
              state.newestFirst = !state.newestFirst;
              store.set("newestFirst", state.newestFirst);
              const scroll = els.panel.scrollTop;
              renderPanel(entry);
              els.panel.scrollTop = scroll;
            },
          },
          state.newestFirst ? "Newest first \u2191\u2193" : "Oldest first \u2191\u2193",
        ),
      ),
      h("ol", { class: "timeline" }, ordered.map((version) => versionItem(version, version === last, status))),
    );
  }

  function versionItem(version, isLast, status) {
    const lineage = lineageOf(version);
    const date = parseDate(version.date);
    const finalLabel = status === "removed" || status === "reverted" ? "final" : "current";
    return h(
      "li",
      { class: `ver lineage-${lineage}${isLast ? " current" : ""}` },
      h(
        "div",
        { class: "ver-head" },
        h("span", { class: "ver-name" }, `${version.name} ${version.n}`),
        date ? h("time", { datetime: date.iso }, fmtStamp(date)) : null,
        isLast ? h("span", { class: "pill accent" }, finalLabel) : null,
        lineage === "reverted" ? h("span", { class: "pill warn", title: `Commits only on ${ARCHIVE_BRANCH}` }, "reverted lineage") : null,
        lineage === "uncommitted" ? h("span", { class: "pill" }, "uncommitted") : null,
      ),
      version.request ? h("p", { class: "ver-request" }, "Asked: ", rich(version.request)) : null,
      version.changes?.length ? h("ul", { class: "ver-changes" }, version.changes.map((change) => h("li", null, rich(change)))) : null,
      version.commits?.length ? h("ul", { class: "commits" }, version.commits.map(commitItem)) : null,
    );
  }

  function commitItem(hash) {
    const commit = CAPS.commits[hash];
    const date = commit && parseDate(commit.d);
    const files = commit?.f || [];
    const line = [
      h("a", { href: CAPS.repo ? `${CAPS.repo}/commit/${hash}` : null, target: "_blank", rel: "noopener" }, h("code", null, hash)),
      " ",
      commit ? commit.s : "not found in data/commits.js",
      date ? ` \u00b7 ${MONTHS[date.mo - 1]} ${date.d} ${date.hh}:${date.mm}` : "",
    ];
    if (!files.length) return h("li", null, line);
    return h(
      "li",
      null,
      h(
        "details",
        null,
        h("summary", null, line, ` \u00b7 ${files.length} file${files.length === 1 ? "" : "s"}`),
        h("ul", { class: "commit-files" }, files.map((file) => h("li", null, h("code", null, file)))),
      ),
    );
  }

  /* ---------- overview page ---------- */

  function renderIndexPage() {
    document.title = "CAPS S&C feature tree";
    const commits = Object.entries(CAPS.commits);
    const referenced = new Set();
    for (const nodes of INDEX.values()) {
      for (const { node } of nodes.values()) for (const version of node.versions || []) for (const hash of version.commits || []) referenced.add(hash);
    }
    const byLineage = (lineage) => commits.filter(([, commit]) => commit.l === lineage);
    const unmapped = (lineage) => byLineage(lineage).filter(([hash]) => !referenced.has(hash));

    document.body.append(
      h(
        "main",
        { class: "page" },
        h("h1", null, "CAPS S&C feature tree"),
        h(
          "p",
          { class: "lead" },
          "Every screen, component, table, and architectural piece of the app, arranged by what encapsulates what. Siblings sit side by side, and screens reached by navigation branch from the control that opens them. Click a node for its summary, modes, guardrails, and version history (",
          h("em", null, "Feature 1 \u2192 Feature 2"),
          "), with each version timestamped from its git commits. Check the relevant tree before changing a feature, and add a version after the change is committed.",
        ),
        h(
          "div",
          { class: "meta" },
          chip(`${byLineage("main").length} commits on main`),
          chip(`${byLineage("reverted").length} commits on the reverted lineage`),
          CAPS.generated ? chip(`git read ${CAPS.generated}`) : null,
          CAPS.repo ? h("a", { class: "chip", href: CAPS.repo, target: "_blank", rel: "noopener" }, "GitHub repo") : null,
        ),
        h(
          "section",
          null,
          h("h2", null, "Trees"),
          h(
            "div",
            { class: "cards" },
            TREES.map((tree) => {
              const data = CAPS.trees[tree.id];
              if (!data?.root) return h("div", { class: "card missing" }, h("h3", null, tree.title), h("p", null, "Not documented yet."));
              const stats = treeStats(tree.id);
              return h(
                "a",
                { class: "card", href: `${tree.id}.html` },
                h("h3", null, data.title),
                h("p", null, plain(data.summary)),
                h(
                  "div",
                  { class: "stats" },
                  chip(`${stats.nodes} nodes`),
                  chip(`${stats.versions} versions`),
                  stats.latest ? chip(fmtDay(stats.latest)) : null,
                ),
              );
            }),
          ),
        ),
        changeLog(),
        h(
          "section",
          null,
          h("h2", null, "Git coverage"),
          h(
            "p",
            { class: "lead" },
            `${byLineage("main").length - unmapped("main").length} of ${byLineage("main").length} main commits and ${byLineage("reverted").length - unmapped("reverted").length} of ${byLineage("reverted").length} reverted-lineage commits are mapped to at least one version. The reverted lineage (Aug 2 to Sep 25, 2026) left main when it was reset to e8fc8e9 on Oct 2, 2026, and is kept on ${ARCHIVE_BRANCH}.`,
          ),
          [unmapped("main"), unmapped("reverted")].map((list, index) =>
            list.length
              ? h(
                  "details",
                  { class: "unmapped" },
                  h("summary", null, `${list.length} unmapped ${index ? "reverted" : "main"} commit${list.length === 1 ? "" : "s"}`),
                  h("ul", { class: "commits" }, list.map(([hash]) => commitItem(hash))),
                )
              : null,
          ),
        ),
        h(
          "section",
          null,
          h("h2", null, "Legend"),
          h(
            "div",
            { class: "legend" },
            Object.entries(KINDS).map(([kind, [label, description]]) =>
              h("div", null, h("span", { class: "sample", style: kindStyle(kind) }), h("span", null, h("strong", null, label), ` \u00b7 ${description}`)),
            ),
            Object.entries(STATUSES).map(([status, description]) =>
              h("div", null, h("span", { class: `sample node status-${status}`, style: "width: 46px; padding: 0" }), h("span", null, h("strong", null, status), ` \u00b7 ${description}`)),
            ),
            h("div", null, h("span", { class: "sample node is-ref", style: "width: 46px; padding: 0" }), h("span", null, h("strong", null, "\u2197 link"), " \u00b7 Canonical node lives elsewhere")),
          ),
        ),
        h(
          "section",
          null,
          h("h2", null, "Keeping it current"),
          h(
            "ol",
            { class: "steps" },
            h("li", null, "Before changing a feature, open its node and read the summary, modes, and guardrails."),
            h("li", null, "After committing, run ", h("code", null, "npm run feature-tree"), ". It refreshes ", h("code", null, "data/commits.js"), " from git, validates every tree, and lists commits that no version references yet."),
            h("li", null, "In ", h("code", null, "docs/feature-tree/data/<tree>.js"), ", add the next version to each node the commit changed, and update its summary and modes. Add a guardrail when the change corrected a mistake. A new component gets a node under whatever encapsulates it."),
            h("li", null, "Run the script again until it reports no errors and no unmapped commits."),
          ),
        ),
      ),
    );
  }

  function changeLog() {
    const rows = [];
    for (const [treeId, nodes] of INDEX) {
      for (const { node } of nodes.values()) {
        if (node.ref) continue;
        for (const version of node.versions || []) {
          const date = parseDate(version.date);
          if (date) rows.push({ treeId, node, version, date, lineage: lineageOf(version) });
        }
      }
    }
    rows.sort((a, b) => b.date.epoch - a.date.epoch || a.treeId.localeCompare(b.treeId) || a.node.title.localeCompare(b.node.title));

    const view = { tree: "all", hideReverted: false, limit: 160 };
    const filters = h("div", { class: "filters" });
    const list = h("ol", { class: "log" });
    const more = h("button", { class: "btn", type: "button", onclick: () => ((view.limit = Infinity), draw()) });

    function draw() {
      filters.replaceChildren(
        ...[{ id: "all", title: "All trees" }, ...TREES.filter((tree) => INDEX.has(tree.id))].map((tree) =>
          h("button", { class: `chip${view.tree === tree.id ? " on" : ""}`, type: "button", onclick: () => ((view.tree = tree.id), draw()) }, tree.title),
        ),
        h(
          "button",
          { class: `chip${view.hideReverted ? " on" : ""}`, type: "button", onclick: () => ((view.hideReverted = !view.hideReverted), draw()) },
          "Hide reverted lineage",
        ),
      );
      const visible = rows.filter((row) => (view.tree === "all" || row.treeId === view.tree) && !(view.hideReverted && row.lineage === "reverted"));
      const items = [];
      let day = "";
      for (const row of visible.slice(0, view.limit)) {
        if (row.date.day !== day) {
          day = row.date.day;
          items.push(h("li", { class: "log-day" }, fmtDay(row.date)));
        }
        const label = `${row.version.name} ${row.version.n}`;
        items.push(
          h(
            "li",
            { class: `log-row${row.lineage === "reverted" ? " reverted" : ""}` },
            h("time", { datetime: row.date.iso }, `${row.date.hh}:${row.date.mm} ${row.date.tz}`),
            h("span", { class: "tree-name muted" }, treeTitle(row.treeId)),
            h(
              "span",
              null,
              h("a", { href: `${row.treeId}.html#${encodeURIComponent(row.node.id)}` }, label),
              row.version.name !== row.node.title ? h("span", { class: "muted" }, ` (now ${row.node.title})`) : null,
              row.lineage === "reverted" ? [" ", h("span", { class: "pill warn" }, "reverted")] : null,
              row.version.changes?.[0] ? [h("br"), h("span", { class: "what" }, rich(row.version.changes[0]))] : null,
            ),
          ),
        );
      }
      list.replaceChildren(...items);
      more.textContent = `Show all ${visible.length}`;
      more.hidden = visible.length <= view.limit;
    }

    draw();
    return h("section", null, h("h2", null, "Change log"), filters, list, h("p", null, more));
  }
})();
