const input = document.getElementById("expression");
const resultEl = document.getElementById("result");
const equalsBtn = document.getElementById("equals");
const keys = document.querySelector(".keys");
const backspaceBtn = document.getElementById("backspace");
const clearEntryBtn = document.getElementById("clearEntry");
const allClearBtn = document.getElementById("allClear");
const negateBtn = document.getElementById("negate");
const historyEl = document.getElementById("history");
const clearHistoryBtn = document.getElementById("clearHistory");
const copyResBtn = document.getElementById("copyRes");
const memValueEl = document.getElementById("memValue");
const themeToggle = document.getElementById("themeToggle");
const accentPicker = document.getElementById("accentPicker");

// ---------- Persistence ----------
const store = {
  get(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

let history = store.get("calc.history", []);
let memory = store.get("calc.memory", 0);
let theme = store.get("calc.theme", "dark");
let accent = store.get("calc.accent", accentPicker.value);

memValueEl.textContent = String(memory);
document.documentElement.dataset.theme = theme;
document.documentElement.style.setProperty("--accent", accent);
accentPicker.value = accent;

// ---------- UI helpers ----------
function show(msg, ok = true) {
  resultEl.textContent = msg;
  resultEl.className = ok ? "result ok" : "result err";
}

function addToHistory(expr, res) {
  const item = { expr, res, t: Date.now() };
  history.unshift(item);
  history = history.slice(0, 30);
  store.set("calc.history", history);
  renderHistory();
}

function renderHistory() {
  historyEl.innerHTML = "";
  history.forEach((h) => {
    const li = document.createElement("li");
    const expr = document.createElement("button");
    expr.className = "hist-expr";
    expr.textContent = h.expr;
    expr.title = "Use this expression";
    expr.addEventListener("click", () => {
      input.value = h.expr;
      show(`= ${h.res}`, true);
      // don't programmatically focus here to avoid opening mobile keyboards
    });

    const res = document.createElement("span");
    res.className = "hist-res";
    res.textContent = `= ${h.res}`;

    li.appendChild(expr);
    li.appendChild(res);
    historyEl.appendChild(li);
  });
}
renderHistory();

// ---------- Keys ----------
keys.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.dataset.insert != null) {
    insertAtCursor(btn.dataset.insert);
    return;
  }
  if (btn.dataset.mem) {
    handleMemory(btn.dataset.mem);
    return;
  }
});

function insertAtCursor(text) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const v = input.value;
  input.value = v.slice(0, start) + text + v.slice(end);
  const pos = start + text.length;
  // Only update selection if the input is focused. Setting selection on an
  // unfocused input can trigger the virtual keyboard on mobile, so we avoid
  // it when the user is interacting via the on-screen buttons.
  if (document.activeElement === input) {
    try { input.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
  }
}

function handleMemory(action) {
  const current = parseFloat(resultEl.textContent.replace(/^=\s*/, "")) || 0;
  switch (action) {
    case "MC": memory = 0; break;
    case "MR": insertAtCursor(String(memory)); break;
    case "M+": memory += current; break;
    case "M-": memory -= current; break;
  }
  memValueEl.textContent = String(memory);
  store.set("calc.memory", memory);
}

// ---------- Edit controls ----------
backspaceBtn.addEventListener("click", () => {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  if (start === end && start > 0) {
    input.value = input.value.slice(0, start - 1) + input.value.slice(end);
    const pos = start - 1;
    if (document.activeElement === input) {
      try { input.setSelectionRange(pos, pos); } catch (e) { }
    }
  } else {
    input.value = input.value.slice(0, start) + input.value.slice(end);
    if (document.activeElement === input) {
      try { input.setSelectionRange(start, start); } catch (e) { }
    }
  }
  // do not programmatically focus after backspace — avoids opening mobile keyboard
});

clearEntryBtn.addEventListener("click", () => {
  input.value = "";
  show("");
  // keep existing focus state; do not force focus (prevents mobile keyboard)
});

allClearBtn.addEventListener("click", () => {
  input.value = "";
  show("");
  history = [];
  store.set("calc.history", history);
  renderHistory();
  // intentionally do not focus to avoid opening mobile keyboards
});

negateBtn.addEventListener("click", () => {
  const v = input.value.trim();
  if (!v) { insertAtCursor("-"); return; }
  // Try to wrap last number/paren with unary -
  insertAtCursor("-");
});

// ---------- Evaluate ----------
async function evaluateExpression(expression) {
  const res = await fetch("/api/calc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expression }),
  });
  return res.json();
}

equalsBtn.addEventListener("click", async () => {
  const expression = input.value.trim();
  if (!expression) return show("Enter an expression", false);
  try {
    const data = await evaluateExpression(expression);
    if (data.ok) {
      const display = formatNumber(data.result);
      show(`= ${display}`, true);
      addToHistory(expression, display);
    } else {
      show(data.error || "Error", false);
      pulseError();
    }
  } catch {
    show("Network error", false);
    pulseError();
  }
});

// Formatting
function formatNumber(x) {
  if (typeof x === "number") {
    if (!isFinite(x)) return String(x);
  }
  const n = Number(x);
  if (Math.abs(n) >= 1e9 || (Math.abs(n) > 0 && Math.abs(n) < 1e-6)) {
    return n.toExponential(6).replace(/\.?0+e/, "e");
  }
  // Trim extra decimals
  return parseFloat(n.toFixed(12)).toString();
}

// Error pulse
function pulseError() {
  resultEl.classList.add("pulse");
  setTimeout(() => resultEl.classList.remove("pulse"), 300);
}

// ---------- Keyboard ----------
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); equalsBtn.click(); }
  if (e.key === "Escape") { e.preventDefault(); allClearBtn.click(); }
  if (e.key === "Backspace") return; // default ok
  // Quick inserts
  if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); clearEntryBtn.click(); }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "F9") { e.preventDefault(); themeToggle.click(); }
});

// ---------- Copy ----------
copyResBtn.addEventListener("click", async () => {
  const text = resultEl.textContent.replace(/^=\s*/, "").trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyResBtn.textContent = "✓";
    setTimeout(() => (copyResBtn.textContent = "⧉"), 800);
  } catch {}
});

// ---------- History controls ----------
clearHistoryBtn.addEventListener("click", () => {
  history = [];
  store.set("calc.history", history);
  renderHistory();
});

// ---------- Theme & Accent ----------
themeToggle.addEventListener("click", () => {
  theme = (document.documentElement.dataset.theme === "dark") ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  store.set("calc.theme", theme);
});

accentPicker.addEventListener("input", (e) => {
  const val = e.target.value;
  document.documentElement.style.setProperty("--accent", val);
  store.set("calc.accent", val);
});
