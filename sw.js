// TireWMS Service Worker v3
const CACHE = 'tirewms-v3';

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','./index.html']).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e=>{
  const url=new URL(e.request.url);
  if(url.hostname.includes('firebase')||url.hostname.includes('gstatic')){
    e.respondWith(fetch(e.request).catch(()=>new Response('',{status:503})));
    return;
  }
  e.respondWith(
    fetch(e.request).then(res=>{
      if(res.ok){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}
      return res;
    }).catch(()=>caches.match(e.request).then(c=>c||caches.match('/index.html')))
  );
});

self.addEventListener('message', e=>{
  if(e.data&&e.data.type==='SKIP_WAITING') self.skipWaiting();
});
