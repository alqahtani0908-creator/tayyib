// ───────────────────────── المساجد ─────────────────────────
const MOSQUE_FIELDS = [
  ["name", "اسم المسجد/الجامع", true], ["kind", "النوع"], ["district", "الحي"], ["address", "العنوان"], ["map_url", "رابط الموقع (خرائط Google)"],
  ["imam_name", "اسم الإمام"], ["imam_phone", "جوال الإمام"], ["muezzin_name", "اسم المؤذن"], ["muezzin_phone", "جوال المؤذن"],
  ["servant_name", "اسم خادم المسجد"], ["servant_phone", "جوال خادم المسجد"], ["notes", "ملاحظات"],
];
const missingData = (m) => ["district", "imam_name", "imam_phone", "muezzin_name", "muezzin_phone", "servant_name", "servant_phone"].filter((k) => !m[k]);

route("mosques", {
  title: "المساجد",
  async render(v) {
    await loadMosques();
    const p = S.params;
    const r = role();
    const f = { q: p.q || "", stage: p.stage || "", assoc: p.assoc || "", district: p.district || "", missing: p.missing || "" };
    const districts = [...new Set(S.mosques.map((m) => m.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
    const mobile = isMobile();
    const activeFilters = () => [f.stage, f.assoc, f.district, f.missing].filter(Boolean).length;
    v.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="search">${I.search}<input class="input" id="q" type="search" placeholder="بحث بالاسم أو الرمز أو الحي أو الإمام…" value="${esc(f.q)}"></div>
          <button class="iconbtn filter-btn" id="f-toggle" aria-label="التصفية" title="التصفية">${svg('<path d="M3 5h18M6 12h12M10 19h4"/>')}<span class="dot" ${activeFilters() ? "" : "hidden"}>${activeFilters()}</span></button>
          <div class="filters" id="filters">
            <select class="input" id="f-stage"><option value="">كل المراحل</option>${Object.entries(STAGES).map(([k, s]) => `<option value="${k}" ${f.stage === k ? "selected" : ""}>${esc(s.l)}</option>`).join("")}</select>
            ${r === "admin" || r === "company" ? `<select class="input" id="f-assoc"><option value="">كل الجمعيات</option><option value="none" ${f.assoc === "none" ? "selected" : ""}>غير مسند</option>${S.associations.map((a) => `<option value="${a.id}" ${f.assoc === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>` : ""}
            <select class="input" id="f-district"><option value="">كل الأحياء</option>${districts.map((d) => `<option ${f.district === d ? "selected" : ""}>${esc(d)}</option>`).join("")}</select>
            ${r !== "company" ? `<label class="row small" style="gap:6px;cursor:pointer"><input type="checkbox" id="f-missing" ${f.missing ? "checked" : ""}> بيانات ناقصة فقط</label>` : ""}
          </div>
        </div>
        <div class="actionsbar">
          <span class="muted small nowrap" id="count"></span>
          <div class="acts">
            ${r === "admin" ? `<button class="btn sm primary" id="b-add">${I.plus} إضافة مسجد</button>
              <button class="btn sm" id="b-assign" disabled>${I.org} إسناد المحدد</button>
              <button class="btn sm" id="b-import">${I.upload} استيراد Excel</button>` : ""}
            <button class="btn sm" id="b-export">${I.download} تصدير</button>
          </div>
        </div>
        ${mobile ? `<div class="mcards" id="rows"></div>` : `<div class="tbl-wrap"><table class="tbl"><thead><tr>
          ${r === "admin" ? `<th style="width:34px"><input type="checkbox" id="all" aria-label="تحديد الكل"></th>` : ""}
          <th>المسجد</th>${r !== "association" ? "<th>الجمعية</th>" : ""}<th>المرحلة</th><th>فريق المسجد</th><th>التعبئة القادمة</th></tr></thead>
          <tbody id="rows"></tbody></table></div>`}
      </div>`;
    $("#f-toggle", v).onclick = () => $("#filters", v).classList.toggle("open");
    const sel = new Set();
    const person = (role, n, ph, label) => `<div class="prow"><span class="pr">${role}</span>${n || ph ? `<b>${esc(n || "—")}</b>${contactBtns({ phone: ph, name: n, text: `السلام عليكم ${label} ${n || ""}، ` })}` : `<span class="chip bad plain">ناقص</span>`}</div>`;
    const team = (m) => person("إمام", m.imam_name, m.imam_phone, "فضيلة الشيخ") + person("مؤذن", m.muezzin_name, m.muezzin_phone, "الأخ") + person("خادم", m.servant_name, m.servant_phone, "الأخ");
    // نسخة مختصرة للجوال: الأسماء المتوفرة مع أزرار التواصل، والناقص في سطر واحد
    const teamCompact = (m) => {
      const ppl = [["إمام", m.imam_name, m.imam_phone, "فضيلة الشيخ"], ["مؤذن", m.muezzin_name, m.muezzin_phone, "الأخ"], ["خادم", m.servant_name, m.servant_phone, "الأخ"]];
      const have = ppl.filter(([, n, ph]) => n || ph), miss = ppl.filter(([, n, ph]) => !n && !ph).map(([r]) => r);
      return `<div class="team">${have.map(([r, n, ph, l]) => person(r, n, ph, l)).join("")}${miss.length ? `<div class="prow"><span class="chip bad plain">ناقص: ${miss.join("، ")}</span></div>` : ""}</div>`;
    };
    const emptyMsg = `<div class="empty">${I.mosque}لا توجد مساجد مطابقة${r === "admin" && !S.mosques.length ? " — ابدأ بإضافة مسجد أو استيراد ملف Excel" : ""}</div>`;
    const apply = () => {
      const q = f.q.trim().toLowerCase();
      const list = S.mosques.filter((m) =>
        (!f.stage || m.stage === f.stage) &&
        (!f.assoc || (f.assoc === "none" ? !m.association_id : m.association_id === f.assoc)) &&
        (!f.district || m.district === f.district) &&
        (!f.missing || missingData(m).length) &&
        (!q || [m.name, m.code, m.district, m.imam_name, m.imam_phone, m.muezzin_name, m.servant_name, m.address].some((x) => String(x || "").toLowerCase().includes(q))));
      $("#count", v).textContent = `${fmtNum(list.length)} من ${fmtNum(S.mosques.length)} مسجد`;
      const shown = list.slice(0, mobile ? 200 : 600);
      if (mobile) {
        $("#rows", v).innerHTML = shown.map((m) => `<div class="mcard" data-id="${m.id}">
          <div class="mt"><div class="grow"><b>${esc(m.name)}</b><div class="meta"><span class="num ltr">${esc(m.code)}</span> · ${esc(m.district || "الحي غير محدد")}${r !== "association" ? ` · ${m.association_id ? esc(assocName(m.association_id)) : "غير مسند"}` : ""}</div></div>
            ${r === "admin" ? `<input type="checkbox" class="sel" data-sel="${m.id}" ${sel.has(m.id) ? "checked" : ""} aria-label="تحديد" onclick="event.stopPropagation()">` : ""}</div>
          <div class="foot">${stageChip(m.stage)}${m.stage === "active" ? refillChip(m) : ""}</div>
          ${teamCompact(m)}</div>`).join("") || emptyMsg;
      } else {
        $("#rows", v).innerHTML = shown.map((m) => `<tr class="click" data-id="${m.id}">
          ${r === "admin" ? `<td onclick="event.stopPropagation()"><input type="checkbox" data-sel="${m.id}" ${sel.has(m.id) ? "checked" : ""} aria-label="تحديد"></td>` : ""}
          <td style="min-width:170px"><div class="t-name">${esc(m.name)}</div><div class="muted small"><span class="num ltr">${esc(m.code)}</span> · ${esc(m.district || "الحي غير محدد")}</div></td>
          ${r !== "association" ? `<td class="small">${m.association_id ? esc(assocName(m.association_id)) : `<span class="muted">غير مسند</span>`}</td>` : ""}
          <td>${stageChip(m.stage)}</td>
          <td style="min-width:240px">${team(m)}</td>
          <td>${refillChip(m)}</td></tr>`).join("") || `<tr><td colspan="9">${emptyMsg}</td></tr>`;
      }
      if (list.length > shown.length) $("#rows", v).insertAdjacentHTML("beforeend", `<div class="muted small" style="text-align:center;padding:10px">يُعرض أول ${shown.length} — استخدم البحث والتصفية</div>`);
      v._list = list;
      const dot = $("#f-toggle .dot", v); dot.textContent = activeFilters(); dot.hidden = !activeFilters();
    };
    const setParam = () => { const qs = new URLSearchParams(Object.entries(f).filter(([, x]) => x)).toString(); history.replaceState(null, "", "#/mosques" + (qs ? "?" + qs : "")); };
    $("#q", v).oninput = (e) => { f.q = e.target.value; apply(); setParam(); };
    $("#f-stage", v).onchange = (e) => { f.stage = e.target.value; apply(); setParam(); };
    $("#f-assoc", v)?.addEventListener("change", (e) => { f.assoc = e.target.value; apply(); setParam(); });
    $("#f-district", v).onchange = (e) => { f.district = e.target.value; apply(); setParam(); };
    $("#f-missing", v)?.addEventListener("change", (e) => { f.missing = e.target.checked ? "1" : ""; apply(); setParam(); });
    $("#rows", v).onchange = (e) => {
      const cb = e.target.closest("[data-sel]");
      if (cb) { cb.checked ? sel.add(cb.dataset.sel) : sel.delete(cb.dataset.sel); $("#b-assign", v).disabled = !sel.size; $("#b-assign", v).innerHTML = `${I.org} إسناد المحدد (${sel.size})`; }
    };
    $("#rows", v).onclick = (e) => {
      if (e.target.closest(".contact, [data-sel]")) return;
      const it = e.target.closest("[data-id]");
      if (it) go("/mosque/" + it.dataset.id);
    };
    $("#all", v)?.addEventListener("change", (e) => {
      (v._list || []).slice(0, 600).forEach((m) => e.target.checked ? sel.add(m.id) : sel.delete(m.id));
      $("#b-assign", v).disabled = !sel.size; $("#b-assign", v).innerHTML = `${I.org} إسناد المحدد (${sel.size})`; apply();
    });
    $("#b-add", v)?.addEventListener("click", async () => { if (await mosqueForm()) render(); });
    $("#b-import", v)?.addEventListener("click", () => importDialog());
    $("#b-assign", v)?.addEventListener("click", async () => { if (await assignDialog([...sel])) { sel.clear(); render(); } });
    $("#b-export", v).onclick = () => exportXlsx((v._list || []).map(mosqueRow), `مساجد-طيب-${isoDay()}.xlsx`, "المساجد");
    apply();
  },
});

const mosqueRow = (m) => ({
  "الرمز": m.code, "اسم المسجد": m.name, "النوع": m.kind, "الحي": m.district || "", "العنوان": m.address || "", "رابط الموقع": m.map_url || "",
  "الجمعية المشرفة": m.association_id ? assocName(m.association_id) : "", "المرحلة": STAGES[m.stage]?.l || m.stage,
  "اسم الإمام": m.imam_name || "", "جوال الإمام": displayPhone(m.imam_phone), "اسم المؤذن": m.muezzin_name || "", "جوال المؤذن": displayPhone(m.muezzin_phone),
  "اسم الخادم": m.servant_name || "", "جوال الخادم": displayPhone(m.servant_phone), "عدد الأجهزة": m.devices_count ?? "", "العطر": m.fragrance || "",
  "تاريخ التركيب": m.installed_at ? isoDay(m.installed_at) : "", "آخر تعبئة": m.last_refill_at ? isoDay(m.last_refill_at) : "",
  "التعبئة القادمة": m.next_refill_at ? isoDay(m.next_refill_at) : "", "آخر زيارة": m.last_visit_at ? isoDay(m.last_visit_at) : "",
  "متوسط الرضا": m.satisfaction_avg ?? "", "ملاحظات": m.notes || "",
});

async function mosqueForm(m = null) {
  const r = role();
  const body = `<form class="form" onsubmit="return false">
    ${fld("name", "اسم المسجد/الجامع", { value: m?.name, req: true, attrs: r !== "admin" ? "readonly" : "" })}
    ${fld("kind", "النوع", { value: m?.kind || "جامع", opts: ["جامع", "مسجد", "مصلى"] })}
    ${fld("district", "الحي", { value: m?.district, req: r === "association" })}
    ${fld("address", "العنوان / أقرب معلم", { value: m?.address })}
    ${fld("map_url", "رابط الموقع على الخريطة", { value: m?.map_url, type: "url", full: true, ph: "https://maps.google.com/…" })}
    ${fld("imam_name", "اسم الإمام", { value: m?.imam_name, req: r === "association" })}${fld("imam_phone", "جوال الإمام", { type: "tel", value: m?.imam_phone, ph: "05xxxxxxxx", req: r === "association" })}
    ${fld("muezzin_name", "اسم المؤذن", { value: m?.muezzin_name, req: r === "association" })}${fld("muezzin_phone", "جوال المؤذن", { type: "tel", value: m?.muezzin_phone, ph: "05xxxxxxxx", req: r === "association" })}
    ${fld("servant_name", "اسم خادم المسجد", { value: m?.servant_name, req: r === "association" })}${fld("servant_phone", "جوال خادم المسجد", { type: "tel", value: m?.servant_phone, ph: "05xxxxxxxx", req: r === "association" })}
    ${r === "admin" ? fld("association_id", "الجمعية المشرفة", { value: m?.association_id || "", opts: [["", "— بدون إسناد الآن —"], ...S.associations.filter((a) => a.active).map((a) => [a.id, a.name])], hint: m ? "لتغيير الإسناد استخدم زر «إسناد»" : "سيُسند المسجد وينتقل لمرحلة استكمال البيانات", attrs: m ? "disabled" : "" }) : ""}
    ${r === "admin" && m ? fld("refill_cycle_days", "دورة التعبئة (يوم)", { type: "number", value: m.refill_cycle_days || "", ph: String(S.settings.refill_cycle_days || 30) }) : ""}
    ${fld("notes", "ملاحظات", { type: "textarea", value: m?.notes, full: true })}
  </form>`;
  return modal({
    title: m ? "تعديل بيانات المسجد" : "إضافة مسجد", body, wide: true,
    actions: [{ label: `${I.check} حفظ`, cls: "primary", onClick: async (mb) => {
      const d = formData(mb);
      if (!d.name) { toast("اسم المسجد مطلوب", "err"); return false; }
      ["imam_phone", "muezzin_phone", "servant_phone"].forEach((k) => { if (d[k]) d[k] = displayPhone(d[k]); });
      const assoc = d.association_id; delete d.association_id;
      if (d.refill_cycle_days !== undefined) d.refill_cycle_days = d.refill_cycle_days ? +d.refill_cycle_days : null;
      Object.keys(d).forEach((k) => { if (d[k] === "") d[k] = null; });
      if (r !== "admin") delete d.name;
      if (m) {
        const { error } = await sb.from("mosques").update(d).eq("id", m.id);
        if (error) { toast(errMsg(error), "err"); return false; }
        await refreshMosque(m.id); toast("تم الحفظ"); return true;
      }
      const { data, error } = await sb.from("mosques").insert({ ...d, created_by: S.me.id }).select().single();
      if (error) { toast(errMsg(error), "err"); return false; }
      if (assoc) await sb.rpc("assign_mosques", { p_ids: [data.id], p_assoc: assoc });
      await loadMosques(true); toast("تمت إضافة المسجد"); return data;
    } }, { label: "إلغاء" }],
  });
}

async function assignDialog(ids) {
  if (!ids.length) return;
  const active = S.associations.filter((a) => a.active);
  if (!active.length) { toast("أضف جمعية أولًا من صفحة الجمعيات", "err"); return; }
  return modal({
    title: `إسناد ${ids.length} مسجد لجمعية مشرفة`,
    body: `<div class="stack">${fld("assoc", "الجمعية المشرفة", { opts: active.map((a) => [a.id, a.name]) })}
      <div class="hint">المساجد في مرحلة «بانتظار الإسناد» تنتقل لمرحلة «استكمال البيانات»، ويصل إشعار لحسابات الجمعية.</div></div>`,
    actions: [{ label: `${I.check} إسناد`, cls: "primary", onClick: async (mb) => {
      const { data, error } = await sb.rpc("assign_mosques", { p_ids: ids, p_assoc: $('[name="assoc"]', mb).value });
      if (error) { toast(errMsg(error), "err"); return false; }
      await loadMosques(true); toast(`تم إسناد ${data} مسجد`); return true;
    } }, { label: "إلغاء" }],
  });
}

// ───── الاستيراد من Excel ─────
const IMPORT_MAP = {
  name: ["اسم المسجد", "المسجد", "اسم الجامع", "الجامع", "الاسم", "name", "mosque"],
  kind: ["النوع", "نوع", "kind", "type"],
  district: ["الحي", "حي", "district"],
  address: ["العنوان", "الموقع الوصفي", "address"],
  map_url: ["رابط الموقع", "الموقع", "الخريطة", "رابط", "location", "map"],
  imam_name: ["اسم الإمام", "الإمام", "الامام", "اسم الامام", "imam"],
  imam_phone: ["جوال الإمام", "رقم الإمام", "جوال الامام", "رقم الامام", "هاتف الإمام", "imam phone"],
  muezzin_name: ["اسم المؤذن", "المؤذن", "muezzin"],
  muezzin_phone: ["جوال المؤذن", "رقم المؤذن", "هاتف المؤذن", "muezzin phone"],
  servant_name: ["اسم الخادم", "خادم المسجد", "الخادم", "اسم خادم المسجد", "servant"],
  servant_phone: ["جوال الخادم", "رقم الخادم", "جوال خادم المسجد", "رقم خادم المسجد", "servant phone"],
  association: ["الجمعية", "الجمعية المشرفة", "association"],
  notes: ["ملاحظات", "notes"],
};
const normH = (s) => String(s || "").trim().replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ").toLowerCase();
function guessColumn(header) {
  const h = normH(header);
  let best = null;
  for (const [k, names] of Object.entries(IMPORT_MAP)) for (const n of names) {
    const nn = normH(n);
    if (h === nn) return k;
    if (!best && (h.includes(nn) && nn.length > 3)) best = k;
  }
  // الأعمدة المركبة مثل «جوال الإمام» يجب ألا تُطابق «الإمام» فقط
  if (best && best.endsWith("_name") && /جوال|رقم|هاتف|phone|mobile/.test(h)) best = best.replace("_name", "_phone");
  return best;
}
function downloadTemplate() {
  exportXlsx([{ "اسم المسجد": "", "النوع": "جامع", "الحي": "", "العنوان": "", "رابط الموقع": "", "اسم الإمام": "", "جوال الإمام": "", "اسم المؤذن": "", "جوال المؤذن": "", "اسم الخادم": "", "جوال الخادم": "", "الجمعية": "", "ملاحظات": "" }], "نموذج-استيراد-المساجد.xlsx", "المساجد");
}
async function importDialog() {
  const body = document.createElement("div");
  body.innerHTML = `<div class="stack">
    <div class="row"><div class="grow small muted">يقبل ملفات Excel ‏(xlsx/xls) أو CSV. الصف الأول عناوين الأعمدة، ويتعرف النظام تلقائيًا على: اسم المسجد، الحي، اسم وجوال الإمام والمؤذن والخادم، الجمعية…</div>
      <button class="btn sm" data-tpl>${I.download} تحميل النموذج</button></div>
    <div class="drop" data-pick>${I.excel.replace("<svg", '<svg style="width:30px;height:30px;display:block;margin:0 auto 6px"')}اختر ملف Excel</div><input type="file" accept=".xlsx,.xls,.csv" hidden>
    <div data-map></div><div data-prev></div></div>`;
  let rows = [], mapping = {};
  const input = $("input", body);
  $("[data-tpl]", body).onclick = downloadTemplate;
  $("[data-pick]", body).onclick = () => input.click();
  const preview = () => {
    const known = new Set(S.mosques.map((m) => normH(m.name) + "|" + normH(m.district)));
    const out = rows.map((row) => {
      const o = {};
      for (const [col, key] of Object.entries(mapping)) if (key) o[key] = String(row[col] ?? "").trim();
      return o;
    }).filter((o) => o.name);
    out.forEach((o) => { o._dup = known.has(normH(o.name) + "|" + normH(o.district)); });
    body._out = out;
    const unknownAssoc = [...new Set(out.map((o) => o.association).filter((a) => a && !S.associations.some((x) => normH(x.name) === normH(a))))];
    $("[data-prev]", body).innerHTML = `<div class="row small" style="margin:6px 0"><b>${out.length} صف صالح</b>
      <span class="chip warn plain">${out.filter((o) => o._dup).length} مكرر (سيُتجاوز)</span>
      ${unknownAssoc.length ? `<span class="chip bad plain">جمعيات غير معرّفة: ${esc(unknownAssoc.join("، "))}</span>` : ""}</div>
      <div class="tbl-wrap" style="max-height:300px;border:1px solid var(--line);border-radius:10px"><table class="tbl"><thead><tr><th>المسجد</th><th>الحي</th><th>الإمام</th><th>جوال الإمام</th><th>المؤذن</th><th>الخادم</th><th>الجمعية</th></tr></thead>
      <tbody>${out.slice(0, 100).map((o) => `<tr style="${o._dup ? "opacity:.45" : ""}"><td>${esc(o.name)}</td><td>${esc(o.district || "")}</td><td>${esc(o.imam_name || "")}</td><td class="num">${esc(o.imam_phone || "")}</td><td>${esc(o.muezzin_name || "")}</td><td>${esc(o.servant_name || "")}</td><td>${esc(o.association || "")}</td></tr>`).join("")}</tbody></table></div>`;
  };
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
    } catch (e) { toast("تعذّرت قراءة الملف: " + e.message, "err"); return; }
    if (!rows.length) { toast("الملف فارغ", "err"); return; }
    const headers = Object.keys(rows[0]);
    mapping = Object.fromEntries(headers.map((h) => [h, guessColumn(h)]));
    $("[data-pick]", body).innerHTML = `${I.check} ${esc(file.name)} — ${rows.length} صف`;
    const opts = [["", "— تجاهل —"], ...Object.keys(IMPORT_MAP).map((k) => [k, { name: "اسم المسجد", kind: "النوع", district: "الحي", address: "العنوان", map_url: "رابط الموقع", imam_name: "اسم الإمام", imam_phone: "جوال الإمام", muezzin_name: "اسم المؤذن", muezzin_phone: "جوال المؤذن", servant_name: "اسم الخادم", servant_phone: "جوال الخادم", association: "الجمعية", notes: "ملاحظات" }[k]])];
    $("[data-map]", body).innerHTML = `<div class="small" style="font-weight:600;margin-bottom:6px">مطابقة الأعمدة</div><div class="form" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">${headers.map((h) =>
      `<div class="field"><label>${esc(h)}</label><select class="input" data-col="${esc(h)}">${opts.map(([v, l]) => `<option value="${v}" ${mapping[h] === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`).join("")}</div>`;
    $$("[data-col]", body).forEach((s) => s.onchange = () => { mapping[s.dataset.col] = s.value; preview(); });
    if (!Object.values(mapping).includes("name")) toast("حدد عمود «اسم المسجد» من المطابقة", "err");
    preview();
  };
  await modal({
    title: "استيراد المساجد من Excel", body, wide: true,
    actions: [{ label: `${I.upload} استيراد`, cls: "primary", onClick: async () => {
      const out = (body._out || []).filter((o) => !o._dup);
      if (!out.length) { toast("لا توجد صفوف جديدة للاستيراد", "err"); return false; }
      const byAssoc = {};
      const recs = out.map((o) => {
        const a = o.association && S.associations.find((x) => normH(x.name) === normH(o.association));
        const rec = { created_by: S.me.id };
        for (const k of Object.keys(IMPORT_MAP)) if (k !== "association" && o[k]) rec[k] = k.endsWith("_phone") ? displayPhone(o[k]) : o[k];
        if (rec.kind && !["جامع", "مسجد", "مصلى"].includes(rec.kind)) rec.kind = rec.kind.includes("مسجد") ? "مسجد" : rec.kind.includes("مصل") ? "مصلى" : "جامع";
        rec._assoc = a?.id;
        return rec;
      });
      let ok = 0;
      for (let i = 0; i < recs.length; i += 200) {
        const chunk = recs.slice(i, i + 200);
        const { data, error } = await sb.from("mosques").insert(chunk.map(({ _assoc, ...r }) => r)).select("id");
        if (error) { toast(errMsg(error), "err"); break; }
        data.forEach((d, j) => { const a = chunk[j]._assoc; if (a) (byAssoc[a] = byAssoc[a] || []).push(d.id); });
        ok += data.length;
      }
      for (const [a, ids] of Object.entries(byAssoc)) await sb.rpc("assign_mosques", { p_ids: ids, p_assoc: a });
      await loadMosques(true);
      toast(`تم استيراد ${ok} مسجد`);
      render();
      return true;
    } }, { label: "إلغاء" }],
  });
}

// ───────────────────────── صفحة المسجد ─────────────────────────
const WORKFLOW = [
  [1, "إدخال المسجد في القائمة المختارة", "مدير النظام"], [2, "إيعاز المسجد للجمعية", "مدير النظام"], [3, "إكمال البيانات الناقصة", "الجمعية المشرفة"],
  [4, "التواصل مع الإمام — تقرير", "الجمعية المشرفة"], [5, "دراسة احتياج الجامع — تقرير", "الشركة المنفذة"], [6, "اعتماد التركيب", "مدير النظام"],
  [7, "التركيب ورفع التقرير", "الشركة المنفذة"], [8, "الزيارات الأسبوعية — تقارير", "الجمعية"], [9, "قياس الرضا عن الرائحة — تقرير", "الجمعية"],
  [10, "التقرير الشهري لأداء التعطير", "الجمعية"], [11, "التعبئة الشهرية مع تذكير قبل ٧٢ ساعة", "الشركة المنفذة"], [12, "رفع التقرير بعد التعبئة", "الشركة المنفذة"],
];
const STAGE_STEP = { selected: 1, assigned: 3, data_done: 4, not_feasible: 4, feasible: 5, study_done: 6, approved: 7, active: 8, suspended: 8 };

route("mosque", {
  title: "بيانات المسجد",
  async render(v) {
    const id = S.params.id;
    if (!S.mosques) await loadMosques();
    const m = await refreshMosque(id);
    if (!m) { v.innerHTML = `<div class="empty">${I.mosque}المسجد غير موجود أو لا تملك صلاحية عرضه</div>`; return; }
    $(".topbar h1").textContent = m.name;
    const r = role();
    const [{ data: reports }, { data: atts }, { data: tasks }, { data: acts }] = await Promise.all([
      sb.from("reports").select("*").eq("mosque_id", id).order("created_at", { ascending: false }),
      sb.from("attachments").select("*").eq("mosque_id", id).order("created_at", { ascending: false }),
      sb.from("tasks").select("*").eq("mosque_id", id).order("created_at", { ascending: false }),
      sb.from("activity").select("*").eq("mosque_id", id).order("created_at", { ascending: false }).limit(200),
    ]);
    const attBy = {}; (atts || []).forEach((a) => { if (a.report_id) (attBy[a.report_id] = attBy[a.report_id] || []).push(a); });
    const looseFiles = (atts || []).filter((a) => !a.report_id);
    const cur = STAGE_STEP[m.stage] || 1;
    const act = nextAction(m);
    const ops = m.stage === "active" ? opsActions() : [];
    const canEdit = r === "admin" || (r === "association" && m.association_id === S.me.association_id);
    const tab = S.params.tab || "overview";
    const greet = (who, n) => `السلام عليكم ${who} ${n || ""}، معكم فريق مشروع «${S.settings.platform_name || "طيب"}» لتعطير المساجد بخصوص ${m.name}. `;

    v.innerHTML = `
      <div class="card"><div class="mhead">
        <div class="mic">${I.mosque}</div>
        <div class="grow" style="min-width:220px">
          <div class="row" style="gap:8px"><h2>${esc(m.name)}</h2>${stageChip(m.stage)}</div>
          <div class="muted small" style="margin-top:4px">${esc(m.code)} · ${esc(m.kind)} · ${esc(m.district || "الحي غير محدد")}${m.association_id ? ` · ${esc(assocName(m.association_id))}` : ""}
            ${m.map_url ? ` · <a href="${esc(m.map_url)}" target="_blank" rel="noopener">${I.map.replace("<svg", '<svg style="width:14px;vertical-align:-2px"')} الموقع</a>` : ""}</div>
        </div>
        <div class="btn-row no-print">
          ${canEdit ? `<button class="btn sm" data-edit>${I.edit} تعديل البيانات</button>` : ""}
          ${r === "admin" ? `<button class="btn sm" data-assign>${I.org} ${m.association_id ? "تغيير الجمعية" : "إسناد"}</button>` : ""}
          ${r !== "viewer" ? `<button class="btn sm" data-task>${I.tasks} ${r === "admin" ? "إيعاز مهمة" : "رفع طلب"}</button>` : ""}
          <button class="btn sm" data-print-m>${I.print} ملف المسجد</button>
          ${r === "admin" ? `<button class="btn sm" data-more title="إجراءات المدير">${I.gear} إجراءات</button>` : ""}
        </div>
      </div></div>

      ${act ? `<div class="action-card" style="margin-top:14px"><div class="ic">${act.waiting ? I.clock : I.sparkle}</div>
        <div class="grow"><h4>${act.waiting ? "بانتظار: " : "الإجراء التالي: "}${esc(act.title)}</h4><p>${esc(act.waiting ? `هذه الخطوة من مهام ${STAGES[m.stage].who}` : act.desc)}</p></div>
        ${!act.waiting ? `<button class="btn primary" data-act="${act.action}">${act.action === "decide" ? "مراجعة واعتماد" : act.action === "assign" ? "إسناد الآن" : act.action === "complete" ? (missingData(m).length ? "استكمال البيانات" : "اعتماد اكتمال البيانات") : "رفع التقرير"}</button>` : ""}</div>` : ""}
      ${ops.length ? `<div class="action-card" style="margin-top:14px"><div class="ic">${I.drop}</div><div class="grow"><h4>المسجد قيد التشغيل</h4>
        <p>التعبئة القادمة: <b>${fmtDateTime(m.next_refill_at)}</b> (${untilText(m.next_refill_at)}) · آخر زيارة: <b>${m.last_visit_at ? fmtDate(m.last_visit_at) : "لا توجد"}</b></p></div>
        <div class="btn-row">${ops.map(([k, l, ic]) => `<button class="btn ${k === "refill" ? "gold" : ""}" data-op="${k}">${ic} ${l}</button>`).join("")}</div></div>` : ""}

      <div class="tabs" style="margin-top:18px">${[["overview", "نظرة عامة"], ["reports", "التقارير", (reports || []).length], ["tasks", "المهام والطلبات", (tasks || []).length], ["files", "الملفات", (atts || []).length], ["log", "السجل"]]
        .map(([k, l, n]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${l}${n ? `<span class="n">${n}</span>` : ""}</button>`).join("")}</div>
      <div id="tab"></div>`;

    const T = $("#tab", v);
    const authorIds = [...new Set((reports || []).map((x) => x.author_id).filter(Boolean))];
    const authors = {};
    if (r === "admin" && authorIds.length) { const { data } = await sb.from("accounts").select("id,name").in("id", authorIds); (data || []).forEach((a) => authors[a.id] = a.name); }

    const drawTab = (k) => {
      $$(".tabs button", v).forEach((b) => b.classList.toggle("on", b.dataset.tab === k));
      history.replaceState(null, "", `#/mosque/${id}${k !== "overview" ? "?tab=" + k : ""}`);
      if (k === "overview") {
        T.innerHTML = `<div class="grid g3">
          <div class="span2 stack">
            <div class="card"><div class="hd"><h3>فريق المسجد</h3>${missingData(m).length ? `<span class="chip bad">ناقص: ${missingData(m).length} حقول</span>` : `<span class="chip ok">البيانات مكتملة</span>`}</div>
              <div class="bd"><div class="people">${[["الإمام", m.imam_name, m.imam_phone, "فضيلة الشيخ"], ["المؤذن", m.muezzin_name, m.muezzin_phone, "الأخ"], ["خادم المسجد", m.servant_name, m.servant_phone, "الأخ"]]
                .map(([l, n, p, g]) => `<div class="person"><div class="r">${l}</div><div class="n">${esc(n || "—")}</div><div class="row"><span class="p num">${esc(displayPhone(p) || "لا يوجد رقم")}</span><span class="right">${contactBtns({ phone: p, name: n, text: greet(g, n) })}</span></div></div>`).join("")}</div></div></div>
            <div class="card"><div class="hd"><h3>بيانات التشغيل</h3></div><div class="bd"><div class="kv">
              ${[["عدد الأجهزة", m.devices_count ?? "—"], ["العطر", m.fragrance || "—"], ["تاريخ التركيب", fmtDate(m.installed_at)], ["موعد التركيب المخطط", m.planned_install_at ? fmtDate(m.planned_install_at) : "—"],
                 ["آخر تعبئة", fmtDateTime(m.last_refill_at)], ["التعبئة القادمة", m.next_refill_at ? `${fmtDateTime(m.next_refill_at)} ${refillChip(m)}` : "—"],
                 ["دورة التعبئة", `${m.refill_cycle_days || S.settings.refill_cycle_days || 30} يوم`], ["آخر زيارة", fmtDate(m.last_visit_at)], ["متوسط الرضا", stars(m.satisfaction_avg)],
                 ["العنوان", esc(m.address || "—")]].map(([k2, v2]) => `<div><div class="k">${k2}</div><div class="v">${typeof v2 === "string" && v2.includes("<") ? v2 : esc(v2)}</div></div>`).join("")}</div>
              ${r === "company" && ["feasible", "study_done", "approved"].includes(m.stage) ? `<div class="row" style="margin-top:14px"><label class="small">موعد التركيب المخطط</label><input type="date" class="input" style="width:auto" id="plan" value="${m.planned_install_at || ""}"><button class="btn sm" id="plan-save">حفظ</button></div>` : ""}
              ${m.notes ? `<div style="margin-top:14px" class="small"><b>ملاحظات:</b> ${esc(m.notes)}</div>` : ""}</div></div>
            <div class="card"><div class="hd"><h3>آخر التقارير</h3><a class="right small" href="#/mosque/${id}?tab=reports" data-tabgo="reports">الكل</a></div><div class="bd"><div class="tl">${(reports || []).slice(0, 3).map((x) => reportCard(x, attBy[x.id], authors)).join("") || `<div class="empty">لا توجد تقارير بعد</div>`}</div></div></div>
          </div>
          <div class="card"><div class="hd"><h3>مسار الإجراءات</h3></div><div class="bd"><div class="steps">${WORKFLOW.map(([n, t, w]) => {
            const done = m.stage === "active" ? n <= 7 || hasType(reports, n) : n < cur;
            const now = m.stage === "active" ? n >= 8 && !done : n === cur;
            return `<div class="step ${done ? "done" : ""} ${now ? "now" : ""}"><div class="dotn">${done ? "✓" : n}</div><div><div class="t">${t}</div><div class="w">${w}</div></div></div>`;
          }).join("")}</div></div></div></div>`;
        $("[data-tabgo]", T)?.addEventListener("click", (e) => { e.preventDefault(); drawTab("reports"); });
        $("#plan-save", T)?.addEventListener("click", async () => {
          if (await run(sb.from("mosques").update({ planned_install_at: $("#plan", T).value || null }).eq("id", id), "تم حفظ موعد التركيب")) render();
        });
      } else if (k === "reports") {
        const types = [...new Set((reports || []).map((x) => x.type))];
        T.innerHTML = `<div class="row" style="margin-bottom:12px"><select class="input" style="width:auto" id="rt"><option value="">كل التقارير</option>${types.map((t) => `<option value="${t}">${esc(REPORT_TYPES[t]?.l || t)}</option>`).join("")}</select>
          ${r !== "viewer" ? `<button class="btn sm right" data-op="note">${I.chat} إضافة ملاحظة</button>` : ""}</div><div class="tl" id="rl"></div>`;
        const drawR = (t) => { $("#rl", T).innerHTML = (reports || []).filter((x) => !t || x.type === t).map((x) => reportCard(x, attBy[x.id], authors)).join("") || `<div class="empty">${I.report}لا توجد تقارير</div>`; hydrateFiles(T); };
        $("#rt", T).onchange = (e) => drawR(e.target.value);
        drawR("");
      } else if (k === "tasks") {
        T.innerHTML = `<div class="card">${tasksTable(tasks || [], { mosque: false })}</div>`;
        bindTaskRows(T);
      } else if (k === "files") {
        T.innerHTML = `<div class="card pad">${r !== "viewer" ? `<div data-up></div><button class="btn primary" style="margin-top:10px" data-upgo>${I.upload} رفع الملفات</button>` : ""}
          <h4 style="margin:18px 0 6px">جميع الملفات (${(atts || []).length})</h4>${filesHtml(atts) || `<div class="empty">لا توجد ملفات</div>`}</div>`;
        if (r !== "viewer") {
          const up = uploader(); $("[data-up]", T).appendChild(up);
          $("[data-upgo]", T).onclick = async () => { if (!up.files.length) return toast("اختر ملفات أولًا", "err"); await uploadFiles(up.files, { mosqueId: id, ui: up }); toast("تم رفع الملفات"); render(); };
        }
      } else if (k === "log") {
        T.innerHTML = `<div class="card pad"><div class="tl">${(acts || []).map((a) => `<div class="row small" style="gap:10px"><span class="chip plain num">${fmtDateTime(a.created_at)}</span><b>${esc(a.action)}</b>${a.details ? `<span class="muted">${esc(a.details)}</span>` : ""}</div>`).join("") || `<div class="empty">لا يوجد سجل</div>`}</div></div>`;
      }
      hydrateFiles(T);
      $$("[data-print-report]", T).forEach((b) => b.onclick = () => printReport(reports.find((x) => x.id === b.dataset.printReport), m));
      $$("[data-op]", T).forEach((b) => b.onclick = async () => { if (await openReportForm(m, b.dataset.op)) render(); });
    };
    v._looseFiles = looseFiles;
    drawTab(tab);
    $$(".tabs button", v).forEach((b) => b.onclick = () => drawTab(b.dataset.tab));
    $("[data-edit]", v)?.addEventListener("click", async () => { if (await mosqueForm(m)) render(); });
    $("[data-assign]", v)?.addEventListener("click", async () => { if (await assignDialog([id])) render(); });
    $("[data-task]", v)?.addEventListener("click", async () => { if (await taskForm({ mosque_id: id })) render(); });
    $("[data-print-m]", v).onclick = () => printMosque(m, reports || []);
    $("[data-more]", v)?.addEventListener("click", () => adminStageDialog(m));
    $$("[data-op]", v).forEach((b) => b.onclick = async () => { if (await openReportForm(m, b.dataset.op)) render(); });
    $("[data-act]", v)?.addEventListener("click", async (e) => {
      const a = e.currentTarget.dataset.act;
      if (a === "assign") { if (await assignDialog([id])) render(); }
      else if (a === "complete") {
        if (missingData(m).length) { if (await mosqueForm(m)) render(); return; }
        if (await run(sb.rpc("complete_data", { p_mosque: id }), "تم اعتماد اكتمال البيانات — الخطوة التالية: التواصل مع الإمام")) { await refreshMosque(id); render(); }
      } else if (a === "decide") decideDialog(m, reports || [], attBy);
      else if (await openReportForm(m, a)) render();
    });
  },
});
function hasType(reports, step) {
  const t = { 8: "visit", 9: "satisfaction", 10: "monthly", 11: "refill", 12: "refill" }[step];
  return t && (reports || []).some((r) => r.type === t);
}

async function decideDialog(m, reports, attBy) {
  const study = reports.find((r) => r.type === "needs_study");
  const body = document.createElement("div");
  body.innerHTML = `${study ? `<div class="tl">${reportCard(study, attBy[study.id])}</div>` : `<div class="empty">لا يوجد تقرير دراسة</div>`}
    <div class="field" style="margin-top:14px"><label>ملاحظة القرار (تصل للشركة والجمعية)</label><textarea class="input" name="note"></textarea></div>`;
  hydrateFiles(body);
  const res = await modal({ title: `اعتماد التركيب — ${m.name}`, body, wide: true, actions: [
    { label: `${I.check} اعتماد التركيب`, cls: "primary", value: "yes" }, { label: "إعادة الدراسة للشركة", cls: "danger", value: "no" }, { label: "إلغاء" }] });
  if (!res) return;
  const note = $('[name="note"]', body).value.trim() || null;
  if (await run(sb.rpc("decide_study", { p_mosque: m.id, p_approve: res === "yes", p_note: note }), res === "yes" ? "تم اعتماد التركيب وإشعار الشركة" : "أعيدت الدراسة للشركة")) { await refreshMosque(m.id); render(); }
}
async function adminStageDialog(m) {
  const res = await modal({ title: "إجراءات المدير", body: `<div class="stack">
    ${fld("stage", "تغيير المرحلة يدويًا", { value: m.stage, opts: Object.entries(STAGES).map(([k, s]) => [k, s.l]) })}
    ${fld("note", "السبب", { type: "textarea" })}<div class="hint">يُستخدم للإيقاف أو إعادة التفعيل أو تصحيح المرحلة، ويُسجَّل في سجل المسجد.</div></div>`,
    actions: [{ label: "حفظ المرحلة", cls: "primary", onClick: async (mb) => {
      const d = formData(mb);
      return (await run(sb.rpc("set_stage", { p_mosque: m.id, p_stage: d.stage, p_note: d.note || null }), "تم تغيير المرحلة")) ? "ok" : false;
    } }, { label: `${I.trash} حذف المسجد`, cls: "danger", value: "del" }, { label: "إغلاق" }] });
  if (res === "del") {
    if (!(await confirmBox(`حذف «${m.name}» نهائيًا مع جميع تقاريره ومهامه؟`, "حذف", "danger"))) return;
    if (await run(sb.from("mosques").delete().eq("id", m.id), "تم حذف المسجد")) { await loadMosques(true); go("/mosques"); }
  } else if (res) { await refreshMosque(m.id); render(); }
}
function printMosque(m, reports) {
  const rows = [["الرمز", m.code], ["النوع", m.kind], ["الحي", m.district], ["العنوان", m.address], ["الجمعية المشرفة", assocName(m.association_id)], ["المرحلة", STAGES[m.stage]?.l],
    ["الإمام", `${m.imam_name || "—"} — ${displayPhone(m.imam_phone) || ""}`], ["المؤذن", `${m.muezzin_name || "—"} — ${displayPhone(m.muezzin_phone) || ""}`], ["خادم المسجد", `${m.servant_name || "—"} — ${displayPhone(m.servant_phone) || ""}`],
    ["عدد الأجهزة", m.devices_count], ["العطر", m.fragrance], ["تاريخ التركيب", fmtDate(m.installed_at)], ["آخر تعبئة", fmtDate(m.last_refill_at)], ["التعبئة القادمة", fmtDate(m.next_refill_at)],
    ["آخر زيارة", fmtDate(m.last_visit_at)], ["متوسط الرضا", m.satisfaction_avg ? `${m.satisfaction_avg} / 5` : "—"]];
  printDoc("ملف مسجد", `<h2>${esc(m.name)}</h2><table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v ?? "—")}</td></tr>`).join("")}</table>
    <h2>سجل التقارير</h2><table><tr><th style="width:auto">التاريخ</th><th style="width:auto">التقرير</th><th style="width:auto">الملخص</th></tr>
    ${reports.map((r) => `<tr><td>${fmtDate(r.created_at)}</td><td>${esc(REPORT_TYPES[r.type]?.l || r.type)}</td><td>${esc(r.summary || "")}</td></tr>`).join("")}</table>`);
}
