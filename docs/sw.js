// عامل الخدمة لمنصة طيب: استقبال إشعارات الجوال (Web Push) وفتح الصفحة المعنية عند الضغط.
// لا يخزّن الصفحات مؤقتًا، فتصل التحديثات للمستخدم فور نشرها.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  const scope = self.registration.scope;
  const jobs = [self.registration.showNotification(d.title || "منصة طيب", {
    body: d.body || "", tag: d.tag, dir: "rtl", lang: "ar",
    icon: scope + "icon-192.png", badge: scope + "badge-96.png",
    data: { url: new URL(d.url || "./", scope).href },
  })];
  // رقم غير المقروء على أيقونة التطبيق
  if (self.navigator && "setAppBadge" in self.navigator && d.badge != null) {
    jobs.push((d.badge ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge()).catch(() => {}));
  }
  // تحديث النوافذ المفتوحة
  jobs.push(self.clients.matchAll({ type: "window" }).then((cs) => cs.forEach((c) => c.postMessage({ type: "push" }))));
  e.waitUntil(Promise.all(jobs));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        c.postMessage({ type: "open", url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
