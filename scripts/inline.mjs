// Produit dist/cosy-farm.html : le jeu en un seul fichier autonome (JS et CSS en ligne).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const dist = new URL("../dist/", import.meta.url);
let html = readFileSync(new URL("index.html", dist), "utf8");
for (const f of readdirSync(new URL("assets/", dist))) {
  const body = readFileSync(new URL("assets/" + f, dist), "utf8");
  if (f.endsWith(".css")) html = html.replace(new RegExp(`<link[^>]*${f}[^>]*>`), () => `<style>${body}</style>`);
  if (f.endsWith(".js")) html = html.replace(new RegExp(`<script[^>]*${f}[^>]*></script>`), () => `<script type="module">${body.replace(/<\/script/g, "<\\/script")}</script>`);
}
html = html.replace(/<script type="module" crossorigin src="[^"]*"><\/script>/, "");
writeFileSync(new URL("cosy-farm.html", dist), html);
console.log("dist/cosy-farm.html", (html.length / 1024).toFixed(0) + " Ko");
