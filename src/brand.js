// ───────────────────────── خطوط الهوية (Brando Arabic) ─────────────────────────
// ملفات الخط لا تُحفظ في المستودع العام؛ يرفعها المدير من الإعدادات إلى مخزن «brand»
const FONT_WEIGHTS = { regular: 400, semibold: 600, bold: 700 };
const fontUrl = (p) => /^(https?:|\/|\.)/.test(p) ? p : sb.storage.from("brand").getPublicUrl(p).data.publicUrl;
async function loadBrandFonts() {
  const files = S.settings.font_files || {};
  const jobs = Object.entries(FONT_WEIGHTS).filter(([k]) => files[k]).map(async ([k, w]) => {
    try {
      const f = new FontFace("Brando Arabic", `url("${fontUrl(files[k])}")`, { weight: String(w), style: "normal", display: "swap" });
      document.fonts.add(await f.load());
    } catch (e) { console.warn("تعذّر تحميل خط الهوية", k, e); }
  });
  await Promise.all(jobs);
}
