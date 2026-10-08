const CACHE="trackit-v13";
const ASSETS=["./login.html","./create-account.html","./app.html","./style.css","./ota-languages.css","./ota-languages.js","./manifest.json","./icon-192.png","./icon-512.png","./locales/en.json","./locales/es.json","./locales/fr.json","./locales/de.json","./locales/it.json","./locales/pt.json","./locales/ja.json","./locales/ko.json","./locales/zh.json","./locales/ru.json"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{}); return response;
  }).catch(()=>caches.match(event.request)));
});