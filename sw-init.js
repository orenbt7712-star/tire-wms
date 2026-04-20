// Service Worker — עדכון אוטומטי
// פולבק אם Firebase לא נטען
window.addEventListener('load', function(){
  setTimeout(function(){
    const app = document.querySelector('.app');
    const ls = document.getElementById('loginScreen');
    if(app && app.style.display==='none' && !ls){
      if(window.buildLoginScreen) window.buildLoginScreen();
      else app.style.display='';
    }
  }, 4000);
});
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').then(reg=>{
    // בדוק עדכון כל פתיחה
    reg.update();
    reg.addEventListener('updatefound',()=>{
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange',()=>{
        if(newWorker.state==='installed' && navigator.serviceWorker.controller){
          // יש גרסה חדשה — עדכן אוטומטית
          newWorker.postMessage({type:'SKIP_WAITING'});
        }
      });
    });
  });
  // כשה-SW החדש ממתין — רענן
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    window.location.reload();
  });
}
