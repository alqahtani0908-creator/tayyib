// بيانات وهمية لصفحة الباركود العامة (اختبار محلي فقط — لا تصل للخادم)
(() => {
  const places = [
    { t: "AB12CD34", n: "جامع النور", d: "النرجس", r: "north" }, { t: "EF56GH78", n: "جامع الهدى", d: "النرجس", r: "north" },
    { t: "IJ90KL12", n: "جامع الرحمة", d: "الملقا", r: "north" }, { t: "MN34OP56", n: "جامع التقوى", d: "الروضة", r: "east" },
    { t: "QR78ST90", n: "جامع السلام", d: "العليا", r: "center" },
  ];
  const survey = { id: "S1", title: "استبيان رضا المصلين عن تعطير المسجد", intro: "", thanks: "شكرًا لك، وصلت إجابتك",
    questions: [
      { id: "q1", text: "كيف تقيّم رائحة المسجد بشكل عام؟", kind: "rating", required: true, options: [] },
      { id: "q2", text: "هل رائحة العطر مناسبة لك؟", kind: "yesno", required: true, options: ["نعم", "لا"] },
      { id: "q3", text: "كيف تصف قوة الرائحة؟", kind: "choice", required: true, options: ["قوية جدًا", "مناسبة", "ضعيفة", "لا ألاحظها"] },
      { id: "q4", text: "هل لديك ملاحظة أو اقتراح؟", kind: "text", required: false, options: [] },
    ] };
  let ref = 40;
  window.__sent = [];
  window.TAYYIB_PUBLIC_RPC = async (fn, a) => {
    await new Promise((r) => setTimeout(r, 120));
    if (fn === "public_places") return places;
    if (fn === "public_mosque") { const p = places.find((x) => x.t === String(a.p_token).toUpperCase()); return p ? { token: p.t, name: p.n, district: p.d, region: p.r } : null; }
    if (fn === "public_survey") return survey;
    if (fn === "submit_survey") { window.__sent.push([fn, a]); return 82.5; }
    if (fn === "submit_complaint") { window.__sent.push([fn, a]); return ++ref; }
    throw new Error("unknown " + fn);
  };
})();
