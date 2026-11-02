
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const role = document.body.dataset.role, KEY = "tayyib.guide.read." + role;
  const root = document.documentElement;
  // المظهر: يتبع النظام ويمكن تبديله
  const saved = (() => { try { return localStorage.getItem("tayyib.guide.theme"); } catch { return null; } })();
  const setTheme = (t) => { root.dataset.theme = t; $("#theme") && ($("#theme").textContent = t === "dark" ? "☀︎" : "☾"); };
  setTheme(saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  $("#theme")?.addEventListener("click", () => { const t = root.dataset.theme === "dark" ? "light" : "dark"; setTheme(t); try { localStorage.setItem("tayyib.guide.theme", t); } catch {} });
  $("#print")?.addEventListener("click", () => window.print());
  if (!role) return;

  const secs = $$("section.sec"), links = $$(".toc a");
  // تقدّم القراءة
  const prog = $(".prog i"), topBtn = $(".fab .top");
  const onScroll = () => { const h = document.documentElement; const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight); prog.style.width = (p * 100).toFixed(1) + "%"; topBtn.classList.toggle("show", h.scrollTop > 600); };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  topBtn.onclick = () => scrollTo({ top: 0, behavior: "smooth" });
  // القسم الحالي في المحتويات
  const io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { links.forEach((a) => a.classList.toggle("on", a.hash === "#" + e.target.id)); const a = links.find((x) => x.hash === "#" + e.target.id); a && a.scrollIntoView({ block: "nearest" }); } }); }, { rootMargin: "-30% 0px -60% 0px" });
  secs.forEach((s) => io.observe(s));
  // «تمت قراءته» محفوظ في المتصفح
  let read = new Set(); try { read = new Set(JSON.parse(localStorage.getItem(KEY)) || []); } catch {}
  const paint = () => {
    secs.forEach((s) => { const b = $(".mark-read", s), on = read.has(s.id); b.classList.toggle("on", on); b.textContent = on ? "✓ تمت قراءته" : "تحديد كمقروء"; });
    links.forEach((a) => a.classList.toggle("read", read.has(a.hash.slice(1))));
    const p = Math.round(read.size / secs.length * 100); $(".ring").style.setProperty("--p", p); $(".ring span").textContent = p + "٪";
    $(".done-meter b").textContent = `${read.size} من ${secs.length}`;
    try { localStorage.setItem(KEY, JSON.stringify([...read])); } catch {}
  };
  secs.forEach((s) => $(".mark-read", s).onclick = () => { read.has(s.id) ? read.delete(s.id) : read.add(s.id); paint(); });
  paint();
  // البحث الفوري في الأقسام
  const norm = (t) => t.replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase();
  const texts = secs.map((s) => norm(s.textContent));
  const clearMarks = () => $$("mark.hl").forEach((m) => m.replaceWith(m.textContent));
  const highlight = (s, q) => { const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT); const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach((n) => { const i = norm(n.data).indexOf(q); if (i < 0 || n.parentElement.closest("button,figcaption,.wf-bar")) return; const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + q.length); const m = document.createElement("mark"); m.className = "hl"; r.surroundContents(m); }); };
  $("#q").addEventListener("input", (e) => {
    const q = norm(e.target.value.trim()); clearMarks(); let n = 0;
    secs.forEach((s, i) => { const hit = !q || texts[i].includes(q); s.hidden = !hit; links[i].parentElement.hidden = !hit; if (hit) n++; if (hit && q.length > 1) highlight(s, q); });
    $(".nores").classList.toggle("show", !n);
  });
  // مسار العمل: خطواتي فقط
  $$(".wf").forEach((w) => w.addEventListener("click", (e) => { const b = e.target.closest("[data-wf]"); if (!b) return; $$("[data-wf]", w).forEach((x) => x.classList.toggle("on", x === b)); w.classList.toggle("only-me", b.dataset.wf === "me"); }));
  // المحتويات على الجوال
  const side = $(".side"), scrim = $(".scrim");
  const toggleSide = (o) => { side.classList.toggle("open", o); scrim.classList.toggle("show", o); };
  $(".fab .tocb").onclick = () => toggleSide(!side.classList.contains("open"));
  scrim.onclick = () => toggleSide(false);
  links.forEach((a) => a.addEventListener("click", () => toggleSide(false)));
  // عارض الصور مع التنقل بالأسهم
  const shots = $$("figure.shot"), lb = $(".lb"); let cur = 0;
  const show = (i) => { cur = (i + shots.length) % shots.length; const f = shots[cur]; $("img", lb).src = $("img", f).src; $("img", lb).alt = $("img", f).alt; $("figcaption", lb).textContent = `${$("figcaption", f).textContent}  •  ${cur + 1} / ${shots.length}`; lb.classList.add("open"); };
  shots.forEach((f, i) => $(".zoom", f).onclick = () => show(i));
  $(".x", lb).onclick = () => lb.classList.remove("open");
  $(".pv", lb).onclick = () => show(cur - 1); $(".nx", lb).onclick = () => show(cur + 1);
  lb.onclick = (e) => { if (e.target === lb) lb.classList.remove("open"); };
  addEventListener("keydown", (e) => {
    if (lb.classList.contains("open")) { if (e.key === "Escape") lb.classList.remove("open"); if (e.key === "ArrowLeft") show(cur + 1); if (e.key === "ArrowRight") show(cur - 1); }
    else if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); $("#q").focus(); }
  });
})();
