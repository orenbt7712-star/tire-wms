// TireWMS Service Worker — עדכון אוטומטי מיידי
const VERSION = 'tirewms-' + Date.now(); // גרסה חדשה בכל deploy
const CACHE = VERSION;

self.addEventListener('install', e=>{
  // התקן מיד — לא מחכה לסגירת הלשוניות הישנות
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache=>
      cache.addAll(['/', '/index.html']).catch(()=>{})
    )
  );
});

self.addEventListener('activate', e=>{
  // מחק את כל המטמון הישן מיד
  e.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
    ).then(()=>{
      self.clients.claim(); // השתלט על כל הלשוניות מיד
      // כשיש גרסה חדשה — עדכן את כל הלשוניות אוטומטית
      self.clients.matchAll({includeUncontrolled:true}).then(clients=>{
        clients.forEach(client=> client.postMessage({type:'RELOAD'}));
      });
    })
  );
});

self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);

  // Firebase — תמיד מהרשת
  if(url.hostname.includes('firebase')||url.hostname.includes('firestore')||url.hostname.includes('gstatic')){
    e.respondWith(fetch(e.request).catch(()=>new Response('',{status:503})));
    return;
  }

  // האפליקציה — network first תמיד (עדכון מיידי)
  e.respondWith(
    fetch(e.request)
      .then(res=>{
        if(res.ok){
          const clone=res.clone();
          caches.open(CACHE).then(c=>c.put(e.request,clone));
        }
        return res;
      })
      .catch(()=>
        caches.match(e.request).then(cached=>{
          if(cached) return cached;
          if(e.request.mode==='navigate') return caches.match('/index.html');
          return new Response('Offline',{status:503});
        })
      )
  );
});

