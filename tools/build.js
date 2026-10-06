// Convierte la página del artifact en el index.html de la PWA.
//
// El artifact publica un fragmento: <title>, el <link> de fuentes, el <style>
// y el contenido, porque claude.ai le pone el esqueleto HTML al publicar.
// GitHub Pages no pone nada, así que aquí se arma el documento completo y se
// añade lo que una app instalable necesita: manifiesto, iconos, color de tema
// y el registro del service worker.
//
//   node tools/build.js [ruta/al/artifact.html]
//
// Sin argumento usa source/banco-inverter.html.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = process.argv[2] || path.join(root, "source", "banco-inverter.html");

let raw = fs.readFileSync(src, "utf8");

// Si llega un documento completo (por ejemplo leído del artifact ya publicado),
// se le quita el esqueleto para quedarse con el fragmento.
const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
if (bodyMatch) raw = bodyMatch[1];
raw = raw.replace(/<!doctype[^>]*>/gi, "").replace(/<\/?html[^>]*>/gi, "");
// El esqueleto del artifact mete su propio reset en el head; se descarta para
// no duplicarlo, reconociéndolo por la regla que sólo él trae.
raw = raw.replace(/<head>[\s\S]*?<\/head>/i, "");

function takeOut(re) {
  const m = raw.match(re);
  if (!m) return "";
  raw = raw.replace(m[0], "");
  return m[0];
}

const title = takeOut(/<title>[\s\S]*?<\/title>/i) || "<title>Banco Inverter</title>";
const fonts = takeOut(/<link[^>]*fonts\.googleapis\.com[^>]*>/i);
const style = takeOut(/<style>[\s\S]*?<\/style>/i);

const build = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

// Mismo reset que claude.ai aplica al publicar, para que la página se vea
// igual en los dos lados.
const reset = `<style>
:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
html{scroll-padding-top:env(safe-area-inset-top,0px)}
*,*::before,*::after{box-sizing:inherit}
body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:#eceef1}
img{max-width:100%}
[hidden]{display:none!important}
</style>`;

const head = `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Guía de banco para reparar placas inverter de minisplit a nivel componente: tablas de medición, matriz de propagación de fallas y códigos por marca.">
<meta name="theme-color" content="#0b5cad" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14171b" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Banco Inverter">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="build" content="${build}">
${title}
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
${reset}
${style}
</head>
<body>`;

const foot = `
<script>
// Registro del service worker: es lo que deja instalar la app y abrirla
// sin señal. Falla en silencio si el navegador no lo soporta.
if ("serviceWorker" in navigator) {
  addEventListener("load", function(){
    navigator.serviceWorker.register("sw.js").then(function(reg){
      // Si hay versión nueva esperando, se activa y la página se recarga una vez.
      reg.addEventListener("updatefound", function(){
        var w = reg.installing;
        if (!w) return;
        w.addEventListener("statechange", function(){
          if (w.state === "installed" && navigator.serviceWorker.controller) {
            w.postMessage("skip-waiting");
          }
        });
      });
    }).catch(function(){});
    var reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function(){
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  });
}
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, "index.html"), head + raw.trim() + foot, "utf8");

// El service worker lleva la marca de compilación, así cada despliegue
// invalida el caché anterior por sí solo.
const swSrc = fs.readFileSync(path.join(root, "tools", "sw.template.js"), "utf8");
fs.writeFileSync(path.join(root, "sw.js"), swSrc.replace("__BUILD__", build), "utf8");

const size = fs.statSync(path.join(root, "index.html")).size;
console.log("index.html  " + (size / 1024).toFixed(1) + " KB");
console.log("build       " + build);
if (!style) console.warn("AVISO: no se encontró el bloque <style> del sitio.");
if (!fonts) console.warn("AVISO: no se encontró el <link> de Google Fonts.");
