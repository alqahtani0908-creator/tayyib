#!/usr/bin/env python3
"""يجمع src/ في docs/index.html (موقع مستقل على GitHub Pages + Supabase)."""
import pathlib
root = pathlib.Path(__file__).parent
src = root / "src"
read = lambda p: p.read_text(encoding="utf-8")
order = ["core.js", "data.js", "reports.js", "dashboard.js", "mosques.js", "tasks.js", "ops.js", "messages.js", "admin.js", "main.js"]
js = "\n".join(read(src / f) for f in order)
head = f"""<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>طيب — مشروع تعطير مساجد الرياض</title>
<meta name="description" content="منصة طيب لإدارة مشروع تعطير مساجد الرياض">
<meta name="theme-color" content="#063a2f">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="طيب">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Reem+Kufi:wght@500;700&display=swap">
<style>
{read(src / "styles.css")}
</style>
"""
body = """<div id="app" class="auth"><aside class="side"></aside><div class="main"><header class="topbar"></header><main class="view" id="view"></main></div><nav class="bnav" aria-label="التنقل السريع"></nav></div>
<div class="toasts" id="toasts" aria-live="polite"></div>
"""
libs = """<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" defer></script>
"""
def page(extra_head=""):
    return f"""{head}<script src="config.js"></script>
{extra_head}</head>
<body>
{body}{libs}<script>
{js}
</script>
</body>
</html>
"""
docs = root / "docs"; docs.mkdir(exist_ok=True)
(docs / "index.html").write_text(page(), encoding="utf-8")
# نسخة الاختبار المحلي: عميل وهمي في الذاكرة بدل Supabase
(root / "tests" / "index.html").write_text(page('<script src="mock.js"></script>\n').replace('<script src="config.js"></script>\n', ""), encoding="utf-8")
(docs / ".nojekyll").write_text("", encoding="utf-8")
print("built docs/index.html", (docs / "index.html").stat().st_size // 1024, "KB")
