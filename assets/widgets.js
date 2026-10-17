/* ==========================================================================
   LLM fine-tuning course — interactive widgets
   Load with <script src="../assets/widgets.js" defer></script>.
   All widgets are declared in plain HTML and enhanced here, so lessons stay
   readable (and printable) even if this script never runs.

   1. Multiple choice — options are shuffled; feedback is immediate.
      <div class="quiz">
        <p class="quiz-q">Question?</p>
        <ol class="quiz-options">
          <li data-correct data-why="Why this is right.">Option A</li>
          <li data-why="Why this is wrong. `code` works.">Option B</li>
        </ol>
      </div>

   2. Parsons problem — put shuffled code lines back in order.
      Lines are listed in the CORRECT order; mark extras with data-distractor.
      <div class="parsons">
        <p class="parsons-q">Order the lines.</p>
        <ol class="parsons-lines">
          <li>first_line()</li>
          <li data-distractor>wrong_line()</li>
        </ol>
        <div class="parsons-explain">Shown once solved.</div>
      </div>

   3. Free recall — type an answer from memory, then reveal and self-grade.
      <div class="recall">
        <p class="recall-q">From memory: ...</p>
        <div class="recall-a">Model answer (HTML allowed).</div>
      </div>

   4. Scoreboard — <div class="scoreboard"></div> shows first-try accuracy.
   5. Copy buttons are added to every <pre><code> block (opt out: <pre data-nocopy>).
   ========================================================================== */
(function () {
  "use strict";

  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  // Escape text, then turn `backticks` into <code>.
  const fmt = (s) =>
    (s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const pageKey = "llmtune:" + location.pathname.split("/").slice(-2).join("/");

  // ---------- Scoreboard ----------
  const score = { total: 0, solved: 0, firstTry: 0 };
  function updateScore() {
    $$(".scoreboard").forEach((s) => {
      s.textContent = score.solved === 0
        ? score.total + " practice questions on this page"
        : "First-try correct: " + score.firstTry + " / " + score.solved +
          (score.solved < score.total ? "  (" + (score.total - score.solved) + " to go)" : "  — all done");
    });
  }

  // ---------- Copy buttons ----------
  function initCopy() {
    $$("pre > code").forEach((code) => {
      const pre = code.parentElement;
      if (pre.hasAttribute("data-nocopy")) return;
      const btn = el("button", "copy-btn", "Copy");
      btn.type = "button";
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(code.innerText.replace(/\n$/, ""));
          btn.textContent = "Copied";
        } catch (e) {
          btn.textContent = "Select & copy";
        }
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      });
      pre.appendChild(btn);
    });
  }

  // ---------- Multiple choice ----------
  function initQuiz(q) {
    const list = q.querySelector(".quiz-options");
    if (!list) return;
    const items = $$(":scope > li", list);
    const feedback = el("div", "quiz-feedback");
    feedback.setAttribute("aria-live", "polite");
    q.appendChild(feedback);
    score.total++;

    let attempts = 0;
    list.replaceChildren(...shuffle(items));
    items.forEach((li) => {
      const btn = el("button", "quiz-option");
      btn.type = "button";
      btn.innerHTML = li.innerHTML;
      li.replaceChildren(btn);
      btn.addEventListener("click", () => {
        attempts++;
        const why = fmt(li.dataset.why);
        if (li.hasAttribute("data-correct")) {
          btn.classList.add("is-correct");
          $$(".quiz-option", list).forEach((b) => (b.disabled = true));
          feedback.className = "quiz-feedback good";
          feedback.innerHTML = "<strong>Correct.</strong> " + why;
          score.solved++;
          if (attempts === 1) score.firstTry++;
          updateScore();
        } else {
          btn.classList.add("is-wrong");
          btn.disabled = true;
          feedback.className = "quiz-feedback bad";
          feedback.innerHTML = "<strong>Not quite.</strong> " + why + " Try again.";
        }
      });
    });
  }

  // ---------- Parsons problem ----------
  function initParsons(p) {
    const src = p.querySelector(".parsons-lines");
    if (!src) return;
    const explain = p.querySelector(".parsons-explain");
    if (explain) explain.hidden = true;

    const lines = $$(":scope > li", src).map((li, i) => ({
      text: li.textContent.replace(/^\n+|\s+$/g, ""),
      order: li.hasAttribute("data-distractor") ? null : i,
    }));
    const correct = lines.filter((l) => l.order !== null).map((l) => l.order);
    score.total++;
    let attempts = 0;
    let solved = false;

    const board = el("div", "parsons-board");
    const poolCol = el("div", "parsons-col");
    const ansCol = el("div", "parsons-col");
    poolCol.appendChild(el("h4", null, "Available lines — click to add"));
    ansCol.appendChild(el("h4", null, "Your order — click to remove"));
    const pool = el("ol", "parsons-pool");
    const answer = el("ol", "parsons-answer");
    poolCol.appendChild(pool);
    ansCol.appendChild(answer);
    board.append(poolCol, ansCol);

    const feedback = el("div", "parsons-feedback");
    feedback.setAttribute("aria-live", "polite");
    const row = el("div", "btn-row");
    const check = el("button", "btn", "Check order");
    const reset = el("button", "btn btn-quiet", "Reset");
    check.type = reset.type = "button";
    row.append(check, reset);

    function makeItem(line) {
      const li = el("li");
      const btn = el("button", "parsons-line");
      btn.type = "button";
      btn.appendChild(el("code", null, line.text));
      btn._line = line;
      btn.addEventListener("click", () => {
        if (solved) return;
        $$(".parsons-line", p).forEach((b) => b.classList.remove("is-correct", "is-wrong"));
        feedback.textContent = "";
        (li.parentElement === pool ? answer : pool).appendChild(li);
      });
      li.appendChild(btn);
      return li;
    }
    function fill() {
      pool.replaceChildren(...shuffle(lines).map(makeItem));
      answer.replaceChildren();
      feedback.textContent = "";
    }

    check.addEventListener("click", () => {
      const chosen = $$(".parsons-line", answer);
      if (chosen.length === 0) { feedback.className = "parsons-feedback bad"; feedback.textContent = "Add some lines first."; return; }
      attempts++;
      let right = 0;
      chosen.forEach((b, i) => {
        const ok = b._line.order !== null && b._line.order === correct[i];
        b.classList.toggle("is-correct", ok);
        b.classList.toggle("is-wrong", !ok);
        if (ok) right++;
      });
      const distractors = chosen.filter((b) => b._line.order === null).length;
      if (right === correct.length && chosen.length === correct.length) {
        solved = true;
        check.disabled = reset.disabled = true;
        feedback.className = "parsons-feedback good";
        feedback.innerHTML = "<strong>Correct order.</strong>" + (attempts === 1 ? " First try." : "");
        if (explain) explain.hidden = false;
        score.solved++;
        if (attempts === 1) score.firstTry++;
        updateScore();
      } else {
        const missing = correct.length - chosen.filter((b) => b._line.order !== null).length;
        let msg = right + " of " + correct.length + " lines are in the right place.";
        if (distractors) msg += " " + distractors + " line" + (distractors > 1 ? "s don't" : " doesn't") + " belong at all.";
        if (missing > 0) msg += " " + missing + " needed line" + (missing > 1 ? "s are" : " is") + " still missing.";
        feedback.className = "parsons-feedback bad";
        feedback.textContent = msg;
      }
    });
    reset.addEventListener("click", fill);

    src.replaceWith(board);
    board.after(row);
    row.after(feedback);
    fill();
  }

  // ---------- Free recall ----------
  function initRecall(r, idx) {
    const ans = r.querySelector(".recall-a");
    if (!ans) return;
    ans.hidden = true;
    const key = pageKey + "#recall" + idx;

    const ta = el("textarea");
    ta.placeholder = "Answer from memory before revealing — the effort is what makes it stick.";
    ta.setAttribute("aria-label", "Your answer");
    const row = el("div", "btn-row");
    const reveal = el("button", "btn", "Reveal answer");
    reveal.type = "button";
    row.appendChild(reveal);
    ans.before(ta, row);

    const grade = el("div", "recall-grade");
    grade.hidden = true;
    grade.appendChild(document.createTextNode("How did you do?"));
    [["Nailed it", "good"], ["Partly", "partial"], ["Missed it", "miss"]].forEach(([label, val]) => {
      const b = el("button", "btn btn-quiet", label);
      b.type = "button";
      b.addEventListener("click", () => {
        store.set(key, { grade: val, at: new Date().toISOString() });
        grade.textContent = "Recorded: " + label.toLowerCase() + "." +
          (val === "good" ? "" : " Reread the section it covers, then try it again tomorrow.");
      });
      grade.appendChild(b);
    });
    ans.after(grade);

    const prev = store.get(key);
    if (prev && prev.grade) {
      const note = el("div", "recall-grade", "Last time: " + prev.grade + " (" + prev.at.slice(0, 10) + ")");
      grade.after(note);
    }

    reveal.addEventListener("click", () => {
      ans.hidden = false;
      grade.hidden = false;
      reveal.disabled = true;
    });
  }

  function init() {
    $$(".quiz").forEach(initQuiz);
    $$(".parsons").forEach(initParsons);
    $$(".recall").forEach(initRecall);
    if (window.hljs) window.hljs.highlightAll();
    initCopy();
    updateScore();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
