// إشعارات الجوال (Web Push) لمنصة طيب — تُستدعى من قاعدة البيانات عند كل إشعار جديد.
// مفاتيح VAPID تُولَّد هنا أول مرة وتُحفظ في Vault عبر push_store_keys (لدور الخدمة فقط).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
let cfg: Record<string, string> | null = null;

async function config() {
  if (cfg) return cfg;
  const { data, error } = await sb.rpc("push_config");
  if (error) throw error;
  const c = data as Record<string, string>;
  if (!c.public_key || !c.private_key) {
    const k = webpush.generateVAPIDKeys();
    const { error: e2 } = await sb.rpc("push_store_keys", { p_public: k.publicKey, p_private: k.privateKey });
    if (e2) throw e2;
    const { data: again } = await sb.rpc("push_config"); // قد يكون استدعاء آخر سبقنا بالحفظ
    Object.assign(c, again);
  }
  webpush.setVapidDetails(c.subject, c.public_key, c.private_key);
  cfg = c;
  return c;
}

Deno.serve(async (req) => {
  try {
    const c = await config();
    if (!c.hook_secret || req.headers.get("x-hook-secret") !== c.hook_secret) return new Response("forbidden", { status: 403 });
    const body = await req.json().catch(() => ({}));
    if (body.init) return Response.json({ ok: true, public_key: c.public_key });

    const { data: n, error } = await sb.from("notifications").select("id, account_id, title, body, link, kind").eq("id", body.notification_id).maybeSingle();
    if (error || !n) return Response.json({ ok: false, reason: "no notification" }, { status: 404 });
    const [{ data: subs }, { count }] = await Promise.all([
      sb.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("account_id", n.account_id),
      sb.from("notifications").select("id", { count: "exact", head: true }).eq("account_id", n.account_id).is("read_at", null),
    ]);
    const payload = JSON.stringify({
      title: n.title, body: n.body || "", tag: n.id, kind: n.kind, badge: count || 0,
      url: n.link ? `./#${n.link}` : "./#/notifications",
    });
    let sent = 0;
    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: "high" });
        sent++;
        await sb.from("push_subscriptions").update({ last_ok_at: new Date().toISOString(), last_error: null }).eq("id", s.id);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // الاشتراك انتهى أو أُلغي من الجهاز
        if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("id", s.id);
        else await sb.from("push_subscriptions").update({ last_error: `${code || ""} ${String((e as Error).message || e)}`.slice(0, 300) }).eq("id", s.id);
      }
    }));
    return Response.json({ ok: true, sent, devices: subs?.length || 0 });
  } catch (e) {
    return Response.json({ ok: false, error: String((e as Error).message || e) }, { status: 500 });
  }
});
