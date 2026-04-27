let items=[],nextId=1,editingId=null,pendingDel=null,currentFloor='1';
let currentPage=0;
const PAGE_SIZE=50;
let sortCol='id',sortDir=1;
const ROWS=['A','B','C','D','E','F'],COLS=['1','2','3','4','5','6','7','8'];
const TC={קיץ:'ts',חורף:'tw','ארבע עונות':'ta',שטח:'to',משאית:'tt'};
const TE={קיץ:'☀️',חורף:'❄️','ארבע עונות':'🍂',שטח:'🏔️',משאית:'🚛'};
const TYPES=['קיץ','חורף','ארבע עונות','שטח','משאית'];
const sz=it=>it.p?`${it.w}/${it.p}R${it.d}`:`${it.w}R${it.d}`;
// ── Bulk selection state ──
let selectedIds=new Set();
let bulkMode=false;
// ── Audit log helpers ──
function _auditLabel(it){
  if(!it) return '?';
  const size=it.w?(it.p?`${it.w}/${it.p}R${it.d}`:`${it.w}R${it.d}`):'';
  return [it.brand,size,it.model,it.col?'עמ׳ '+it.col:'',it.floor?'קומה '+it.floor:''].filter(Boolean).join(' ');
}
function _auditSnapshot(it){
  if(!it) return null;
  return {col:it.col||'',floor:it.floor||'1',brand:it.brand||'',model:it.model||'',status:it.status||'',p1:it.p1||'',p2:it.p2||'',pn1:it.pn1||'',pn2:it.pn2||''};
}
function logAdd(it){ if(window._logAudit) window._logAudit({action:'add',itemId:it.id,itemLabel:_auditLabel(it),before:null,after:_auditSnapshot(it)}); }
function logEdit(beforeSnap,it){ if(window._logAudit) window._logAudit({action:'edit',itemId:it.id,itemLabel:_auditLabel(it),before:beforeSnap,after:_auditSnapshot(it)}); }
function logDelete(it){ if(window._logAudit) window._logAudit({action:'delete',itemId:it.id,itemLabel:_auditLabel(it),before:_auditSnapshot(it),after:null}); }
function logMove(before,it){ if(window._logAudit) window._logAudit({action:'move',itemId:it.id,itemLabel:_auditLabel(it),before:{col:before.col,floor:before.floor},after:{col:it.col,floor:it.floor}}); }
function logStatus(it){ if(window._logAudit) window._logAudit({action:'status',itemId:it.id,itemLabel:_auditLabel(it),before:null,after:{status:it.status||'',pendingBy:it.pendingBy||''}}); }



function renderDashboard(){
  const dc=document.getElementById('dashContent');
  if(!dc) return;

  const total=items.length;
  const floors={};
  items.forEach(it=>{
    const f=it.floor||'1';
    floors[f]=(floors[f]||0)+1;
  });
  const cols=new Set(items.map(it=>it.col)).size;
  const brands=new Set(items.map(it=>it.brand)).size;

  const floorKeys=Object.keys(floors).sort();
  const maxFloor=Math.max(...Object.values(floors),1);

  const floorColors={1:'var(--f1)',2:'var(--f2)',3:'var(--f3)',4:'var(--f4)',5:'var(--f5)'};

  dc.innerHTML=`
    <div style="font-size:13px;font-weight:800;padding:4px 2px;">📊 סקירת מחסן</div>

    <div class="dash-grid">
      <div class="stat-card" style="border-color:var(--accent);">
        <div class="sc-num" style="color:var(--accent);">${total}</div>
        <div class="sc-lbl">סה"כ צמיגים</div>
      </div>
      <div class="stat-card" style="border-color:var(--blue);">
        <div class="sc-num" style="color:var(--blue);">${brands}</div>
        <div class="sc-lbl">מותגים</div>
      </div>
      <div class="stat-card" style="border-color:var(--green);">
        <div class="sc-num" style="color:var(--green);">${cols}</div>
        <div class="sc-lbl">עמודות פעילות</div>
      </div>
      <div class="stat-card" style="border-color:var(--purple);">
        <div class="sc-num" style="color:var(--purple);">${floorKeys.length}</div>
        <div class="sc-lbl">קומות פעילות</div>
      </div>
    </div>

    <div style="font-size:12px;font-weight:700;color:var(--muted);padding:4px 2px;">פילוג לפי קומה</div>
    ${floorKeys.map(f=>`
      <div class="floor-row">
        <div class="floor-badge floor-${f}">${f}</div>
        <div style="flex:1;">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
            <span style="font-size:12px;font-weight:700;">קומה ${f}</span>
            <span style="font-size:12px;color:var(--muted);">${floors[f]} פריטים</span>
          </div>
          <div class="floor-bar">
            <div class="floor-bar-fill" style="width:${Math.round(floors[f]/maxFloor*100)}%;background:${floorColors[f]||'var(--accent)'};">
            </div>
          </div>
        </div>
      </div>
    `).join('')}

    <div style="font-size:12px;font-weight:700;color:var(--muted);padding:4px 2px;">טופ מותגים</div>
    ${Object.entries(items.reduce((a,it)=>{a[it.brand]=(a[it.brand]||0)+1;return a;},{}))
      .sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([brand,cnt])=>`
        <div class="floor-row">
          <div style="flex:1;font-size:13px;font-weight:700;">${escHTML(brand)}</div>
          <div style="font-size:13px;color:var(--muted);">${cnt} צמיגים</div>
        </div>
      `).join('')}
  `;
}

function floorColor(f){
  const colors={1:'var(--f1)',2:'var(--f2)',3:'var(--f3)',4:'var(--f4)',5:'var(--f5)'};
  return colors[f]||'var(--muted)';
}
function floorClass(f){ return 'floor-'+(f||1); }

function toast(m){
  if(typeof m==='string'){
    if(m.startsWith('✅')) playSuccessSound();
    else if(m.startsWith('❌')||m.startsWith('⚠️')) playErrorSound();
  }
  const el=document.getElementById('toast');
  if(!el) return;
  if(el.classList.contains('show')){
    clearTimeout(el._t);
    el._t=setTimeout(()=>{ el.textContent=m; el._t=setTimeout(()=>el.classList.remove('show'),3200); },350);
  } else {
    el.textContent=m; el.classList.add('show');
    clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),3200);
  }
}
window._toast = toast;

let _audioCtx=null;
function _ac(){ if(!_audioCtx) _audioCtx=new(window.AudioContext||window.webkitAudioContext)(); return _audioCtx; }
function playSuccessSound(){
  try{
    const ac=_ac(),t=ac.currentTime;
    [[523.25,0,0.08],[659.25,0.1,0.11]].forEach(([fr,dl,dur])=>{
      const o=ac.createOscillator(),g=ac.createGain();
      o.connect(g);g.connect(ac.destination);
      o.type='sine';o.frequency.value=fr;
      g.gain.setValueAtTime(0.18,t+dl);
      g.gain.exponentialRampToValueAtTime(0.001,t+dl+dur);
      o.start(t+dl);o.stop(t+dl+dur+0.02);
    });
  }catch(e){}
}
function playErrorSound(){
  try{
    const ac=_ac(),t=ac.currentTime;
    const o=ac.createOscillator(),g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    o.type='sawtooth';
    o.frequency.setValueAtTime(300,t);
    o.frequency.exponentialRampToValueAtTime(140,t+0.18);
    g.gain.setValueAtTime(0.15,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.22);
    o.start(t);o.stop(t+0.24);
  }catch(e){}
}
window.playSuccessSound=playSuccessSound;
window.playErrorSound=playErrorSound;

function escHTML(s){
  if(s==null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
window.escHTML = escHTML;

/* VIEWS */
function switchView(n,el){
  if(!el) return;
  clearTimeout(_searchDebounce); _searchDebounce=null;
  // נקה בחירה מרוכזת בעת מעבר תצוגה
  if(typeof clearBulkSelection==='function') clearBulkSelection();
  // בדוק הרשאות לפני כל שינוי ב-UI
  if(n==='mapEditor' && !window.isAdminMode){
    toast(currentLang==='ar'?'❌ للمدير فقط':'❌ למנהל בלבד');
    return;
  }

  // הסר fullscreen מהכל
  document.querySelectorAll('.view').forEach(v=>{
    v.classList.remove('active');
    v.classList.remove('view-fullscreen');
  });
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));

  const view = document.getElementById('view'+n[0].toUpperCase()+n.slice(1));
  view.classList.add('active');
  el.classList.add('active');

  // מחסן ועורך — מסך מלא
  if(n==='warehouse'||n==='mapEditor'){
    view.classList.add('view-fullscreen');
    // הסתר topbar וסרגל פילטרים
    document.querySelector('.topbar').style.display='none';
    document.querySelector('.filters-row').style.display='none';
    document.querySelector('.bottomnav').style.display='none';
    // כפתור חזרה
    showBackBtn(n);
    if(n==='warehouse'){
      // הבהוב לפי חיפוש פעיל
      const _q=(document.getElementById('mainSearch')?.value||'').trim().toLowerCase();
      const _fb=(document.getElementById('fBrand')?.value||'').trim().toLowerCase();
      const _fs=(document.getElementById('fSize')?.value||'').trim();
      if(_q||_fb||_fs){
        whBlinkCols=new Set(items.filter(it=>{
          if(_fb&&!(it.brand||'').toLowerCase().startsWith(_fb))return false;
          if(_fs&&sz(it)!==_fs)return false;
          if(_q){const t=[it.brand,sz(it),it.model,it.col].filter(Boolean).join(' ').toLowerCase();if(!t.includes(_q))return false;}
          return true;
        }).map(it=>String(it.col)));
        if(whBlinkCols.size>0) startWhBlink();
      } else {
        stopWhBlink();
      }
      // טען מפה שמורה — אם גרסה ישנה, ייצר מחדש
      const _MAP_VER='layout-2026-v6';
      if(cages.length===0){
        const saved=localStorage.getItem('tirewms_map2');
        if(saved){ try{ const d=JSON.parse(saved); cages=d.cages||[]; walls=d.walls||[]; nextCageId=d.nextId||1; }catch(e){} }
        // נקה כלובים עודפים שנוצרו ע"י autoExpandCages (ללא section/p1/p2, y>30)
        const _before=cages.length;
        cages=cages.filter(g=>g.section||g.p1||g.p2||g.rahavaRow||(g.y!=null&&g.y<=30));
        if(cages.length<_before){ nextCageId=Math.max(1,...cages.map(g=>g.id+1)); localStorage.setItem('tirewms_map2',JSON.stringify({cages,walls,nextId:nextCageId,colLabels,rowLabels,mapLabels,nextLabelId})); }
        const _savedVer=localStorage.getItem('tirewms_map_ver');
        if(cages.length===0||_savedVer===null||_savedVer!==_MAP_VER){
          generateWarehouseLayout(true); return;
        }
      }
      setTimeout(()=>{renderWarehouse();if(cages.length>0)whCenter();},50);
    }
    if(n==='mapEditor'){ stopWhBlink(); setTimeout(initMapEditor, 50); }
  } else {
    stopWhBlink();
    // מלאי / דשבורד — הצג הכל
    document.querySelector('.topbar').style.display='';
    document.querySelector('.filters-row').style.display='';
    document.querySelector('.bottomnav').style.display='';
    hideBackBtn();
    if(n==='dashboard') renderDashboard();
    if(n==='inventory' && (_isOwner||_isAdmin)){
      // טען נתוני מלאי ברקע כדי שיהיו זמינים בחיפוש
      window._loadInvData && window._loadInvData().then(()=>renderTable()).catch(e=>console.warn('loadInvData:',e));
    }
  }
}

function showBackBtn(viewName){
  let btn=document.getElementById('backToInventory');
  if(!btn){
    btn=document.createElement('button');
    btn.id='backToInventory';
    btn.style.cssText='position:fixed;top:10px;right:10px;z-index:400;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:Heebo,sans-serif;font-size:13px;font-weight:700;padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 12px rgba(0,0,0,.4);';
    btn.innerHTML='📋 מלאי';
    btn.addEventListener('click',()=>{
      const navBtn=document.getElementById('nav-inventory');
      if(navBtn) switchView('inventory',navBtn);
    });
    document.body.appendChild(btn);
  }
  btn.style.display='flex';
}

function hideBackBtn(){
  const btn=document.getElementById('backToInventory');
  if(btn) btn.style.display='none';
}

/* RENDER */
function getFiltered(){
  const fb=document.getElementById('fBrand').value;
  const fs=document.getElementById('fSize').value;
  const raw=document.getElementById('mainSearch').value.trim();
  const q=raw.toLowerCase();
  const qUp=raw.toUpperCase().replace(/[^0-9A-Z]/g,'');
  // נסה להמיר מספרים למידה (2055516 → 205/55R16)
  const digits = qUp.replace(/[^0-9]/g,'');
  let qFormatted = qUp;
  if(digits.length>=5){
    qFormatted = digits.slice(0,3)+'/'+digits.slice(3,5)+'R'+digits.slice(5,7);
  }
  return items.filter(it=>{
    if(fb&&!(it.brand||'').toLowerCase().includes(fb.toLowerCase()))return false;
    if(fs&&sz(it)!==fs)return false;
    if(q&&!(
      it.brand.toLowerCase().includes(q)||
      (it.model||'').toLowerCase().includes(q)||
      sz(it).toUpperCase().includes(qFormatted)||
      sz(it).replace(/[^0-9]/g,'').includes(digits)||
      (it.col||'').toLowerCase().includes(q)||
      (it.notes||'').toLowerCase().includes(q)
    ))return false;
    return true;
  }).sort((a,b)=>{
    const k=sortCol,av=a[k]??0,bv=b[k]??0;
    return typeof av==='string'?av.localeCompare(bv,'he')*sortDir:(av-bv)*sortDir;
  });
}

function _buildLocationSummary(data){
  if(!data.length) return '';
  // קבץ לפי מיקום (עמודה + קומה)
  const groups={};
  for(const it of data){
    const loc=`${it.col||'?'} ק${it.floor||1}`;
    groups[loc]=(groups[loc]||0)+1;
  }
  const entries=Object.entries(groups).sort(([,a],[,b])=>b-a);
  const chips=entries.map(([loc,cnt])=>
    `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--card2,#1a1e2e);border:1px solid var(--border,#252b3b);border-radius:20px;padding:4px 10px;font-size:12px;white-space:nowrap;">
      <span style="color:var(--accent,#f5a623);font-weight:700;">📍${escHTML(loc)}</span>
      <span style="color:var(--text);font-weight:900;">${cnt}</span>
    </span>`
  ).join('');
  // מלאי כללי מ-Excel (אחד לכל קוד פריט ייחודי)
  const codes=[...new Set(data.filter(it=>it.itemCode).map(it=>it.itemCode))];
  let invTotal=null;
  if(window._getInvQty&&codes.length===1){
    const q=window._getInvQty(codes[0]);
    if(q!=null) invTotal=q;
  }
  const invChip=invTotal!=null
    ?`<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(76,175,80,0.12);border:1px solid rgba(76,175,80,0.35);border-radius:20px;padding:4px 10px;font-size:12px;white-space:nowrap;">
        <span style="color:var(--green,#4caf50);font-weight:700;">📦 מלאי כללי: ${invTotal}</span>
      </span>`:''
  ;
  return `<div style="padding:10px 12px 4px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
    <span style="font-size:11px;color:var(--muted);font-weight:600;white-space:nowrap;">נמצא ב-${entries.length} מיקומ${entries.length>1?'ות':''}:</span>
    ${chips}
    ${invChip}
  </div>`;
}

function _attachSwipeListeners(){
  const tbody=document.querySelector('#tableArea table tbody');
  if(!tbody) return;
  tbody.querySelectorAll('tr.tr-anim').forEach(tr=>{
    let sx=0,sy=0,dx=0,dir=null;
    tr.addEventListener('touchstart',e=>{
      if(e.touches.length>1) return;
      sx=e.touches[0].clientX; sy=e.touches[0].clientY;
      dx=0; dir=null; tr.style.transition='';
    },{passive:true});
    tr.addEventListener('touchmove',e=>{
      if(e.touches.length>1||dir==='v') return;
      const cx=e.touches[0].clientX,cy=e.touches[0].clientY;
      dx=cx-sx;
      if(!dir){
        if(Math.abs(cy-sy)>Math.abs(dx)+5){dir='v';return;}
        if(Math.abs(dx)>9) dir='h';
      }
      if(dir!=='h') return;
      e.preventDefault();
      tr.style.transform=`translateX(${dx}px)`;
      tr.style.background=dx>0?`rgba(62,207,142,${Math.min(0.3,dx/260)})`:`rgba(232,93,63,${Math.min(0.3,-dx/260)})`;
    },{passive:false});
    const _snap=()=>{
      tr.style.transition='transform .22s ease,background .22s ease';
      tr.style.transform=''; tr.style.background='';
    };
    tr.addEventListener('touchend',()=>{
      if(dir!=='h'){dir=null;return;}
      dir=null; _snap();
      const id=Number(tr.id.replace('tr-',''));
      if(dx>80&&(window.isOwnerMode||window.isAdminMode)) setTimeout(()=>startEdit(id),60);
      else if(dx<-80&&(window.isOwnerMode||window.isAdminMode)) setTimeout(()=>askDelete(id),60);
    },{passive:true});
    tr.addEventListener('touchcancel',()=>{dir=null;_snap();},{passive:true});
  });
}
function renderTable(){
  const area=document.getElementById('tableArea');
  if(!area) return;
  const data=getFiltered();
  const sc=document.getElementById('statCount'); if(sc) sc.textContent=data.length;
  if(items.length===0){
    const addBtn = (window.isOwnerMode||window.isAdminMode)
      ? `<button onclick="document.querySelector('[data-view=add]')?.click()" style="margin-top:16px;padding:12px 24px;background:var(--accent);border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;color:#111;">+ הוסף פריט ראשון</button>`
      : '';
    area.innerHTML=`<div class="empty-wrap"><div class="ei">🛞</div><p>${t('emptyTitle')}</p><span>${t('emptyHint')}</span>${addBtn}</div>`;
    return;
  }
  // הצג כרטיס מיקומים כשיש חיפוש פעיל
  const hasSearch=!!(document.getElementById('mainSearch')?.value.trim()||document.getElementById('fBrand')?.value||document.getElementById('fSize')?.value);
  const locationSummary = hasSearch && data.length ? _buildLocationSummary(data) : '';
  const sa=c=>sortCol===c?(sortDir===1?'↑':'↓'):'';
  const canBulk=window.isOwnerMode||window.isAdminMode;
  let html=`<div class="twrap"><table>
    <thead><tr>
      ${canBulk?`<th style="width:32px;padding:6px 4px;"><input type="checkbox" class="bulk-cb" id="checkAll" onchange="toggleSelectAll(this)" title="בחר הכל בדף"></th>`:''}
      <th style="text-align:center;" onclick="sortBy('itemCode')" class="${sortCol==='itemCode'?'sorted':''}">קוד פריט ${sa('itemCode')}</th>
      <th style="text-align:center;" onclick="sortBy('brand')" class="${sortCol==='brand'?'sorted':''}">תיאור פריט ${sa('brand')}</th>
      <th style="text-align:center;">📦 קיסריה 01</th>
      <th onclick="sortBy('row')" class="${sortCol==='row'?'sorted':''}">מיקום ${sa('row')}</th>
      <th>${editingId?'↵·Esc':'פעולות'}</th>
    </tr></thead><tbody>`;
  // Pagination
  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  if(currentPage >= totalPages) currentPage = Math.max(0, totalPages-1);
  const start = currentPage * PAGE_SIZE;
  const pageData = data.slice(start, start + PAGE_SIZE);

  pageData.forEach(it=>{ html += editingId===it.id ? editRow(it) : viewRow(it); });
  html+=`</tbody></table></div>`;

  // Pagination controls
  if(totalPages > 1){
    const prevDis = currentPage===0 ? 'opacity:0.4;cursor:default;' : 'cursor:pointer;';
    const nextDis = currentPage>=totalPages-1 ? 'opacity:0.4;cursor:default;' : 'cursor:pointer;';
    html += `<div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:10px;background:var(--surface);border-top:1px solid var(--border);flex-shrink:0;">
      <button onclick="if(${currentPage}>0){currentPage--;renderTable();}" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 14px;color:var(--text);font-family:inherit;font-size:13px;${prevDis}">→ הקודם</button>
      <span style="font-size:12px;color:var(--muted);">${currentPage+1} / ${totalPages} &nbsp;(${data.length} פריטים)</span>
      <button onclick="if(${currentPage}<${totalPages}-1){currentPage++;renderTable();}" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 14px;color:var(--text);font-family:inherit;font-size:13px;${nextDis}">הבא ←</button>
    </div>`;
  }

  area.innerHTML=locationSummary+html;
  // שחזר סימוני צ'קבוקס לאחר רינדור מחדש
  if(selectedIds.size>0){
    document.querySelectorAll('.bulk-cb.row-cb').forEach(cb=>{
      const id=Number(cb.dataset.id);
      if(selectedIds.has(id)){ cb.checked=true; cb.closest('tr')?.classList.add('bulk-checked'); }
    });
    const allCb=document.getElementById('checkAll');
    if(allCb) allCb.checked=pageData.length>0&&pageData.every(it=>selectedIds.has(it.id));
  }
  _updateBulkBar();
  _attachSwipeListeners();
}

function viewRow(it){
  const isPending=it.status==='pending_done';
  const canBulk=window.isOwnerMode||window.isAdminMode;
  const cbCell=canBulk?`<td style="padding:6px 4px;" onclick="event.stopPropagation()"><input type="checkbox" class="bulk-cb row-cb" data-id="${it.id}" onchange="toggleBulkRow(this,${it.id})"${selectedIds.has(it.id)?' checked':''}></td>`:'';
  const dotAge=it.dotYear?(new Date().getFullYear()-it.dotYear):0;
  const isDotOld=dotAge>=4;
  const dotBadge=it.dotYear?`<span style="font-size:10px;color:${isDotOld?'var(--red,#e85d3f)':'var(--muted)'};font-weight:${isDotOld?'900':'400'};" title="תאריך ייצור DOT">${isDotOld?'⚠️ ':''}DOT ${it.dotWeek||'?'}/${it.dotYear}</span>`:'';
  return `<tr id="tr-${it.id}" class="tr-anim${isPending?' pending-row':''}${selectedIds.has(it.id)?' bulk-checked':''}" onclick="showItemLocation(${it.id})" style="cursor:pointer;${isDotOld?'box-shadow:inset 0 0 0 2px var(--red,#e85d3f);':''}" title="${isDotOld?`⚠️ צמיג ישן — ייצור ${it.dotYear} (${dotAge} שנים)`:''}">
    ${cbCell}
    <td style="text-align:center;"><span style="font-family:monospace;font-size:12px;color:var(--muted);">${escHTML(it.itemCode||'')}</span></td>
    <td style="text-align:center;"><span style="font-weight:700;">${escHTML(it.brand)}</span>${it.model?`<br><span style="font-size:10px;color:var(--muted)">${escHTML(it.model)}</span>`:''}${dotBadge?`<br>${dotBadge}`:''}</td>
    <td style="text-align:center;">${(()=>{const q=window._getInvQty?window._getInvQty(it.itemCode||'',it):null;return q!=null?`<span style="font-weight:700;color:${q===0?'var(--muted)':q>=100?'var(--green,#4caf50)':'var(--text)'}">${q}</span>`:``;})()}</td>
    <td><div class="locbadge">
      ${it.pn1?`<span><span class="lp" style="color:var(--accent);">פ1</span> ${escHTML(it.pn1)}</span><span style="color:var(--border2)">·</span>`:''}
      ${it.p1?`<span><span class="lp">שו׳ ימין</span> ${escHTML(it.p1)}</span><span style="color:var(--border2)">·</span>`:''}
      <span><span class="lp">עמ׳</span> ${escHTML(it.col)}</span>
      <span style="color:var(--border2)">·</span>
      <span class="floor-badge floor-${escHTML(it.floor||1)}">${escHTML(it.floor||1)}</span>
      ${it.pn2?`<span style="color:var(--border2)">·</span><span><span class="lp" style="color:var(--accent);">פ2</span> ${escHTML(it.pn2)}</span>`:''}
      ${it.p2?`<span style="color:var(--border2)">·</span><span><span class="lp">שו׳ שמאל</span> ${escHTML(it.p2)}</span>`:''}
      ${it.agr?`<span style="color:var(--border2)">·</span><span><span class="lp" style="color:var(--green);">🌾</span> ${escHTML(it.agr)}</span>`:''}
      ${it.rahava?`<span style="color:var(--border2)">·</span><span><span class="lp" style="color:var(--red);">📦</span> רחבה</span>`:''}
      ${it.shareMode==='half'?`<span style="color:var(--border2)">·</span><span style="background:rgba(245,166,35,0.2);color:var(--accent);border-radius:4px;padding:1px 5px;font-size:10px;font-weight:900;">½</span>`:''}
      ${it.shareMode==='singles'?`<span style="color:var(--border2)">·</span><span style="background:rgba(74,158,255,0.15);color:var(--blue);border-radius:4px;padding:1px 5px;font-size:10px;font-weight:900;">יח׳</span>`:''}
    </div></td>
    <td><div class="acts">
      <button class="ib owner-only" onclick="event.stopPropagation();startEdit(${it.id})" title="עריכה מלאה">✏️</button>
      <button class="ib del owner-only" onclick="event.stopPropagation();askDelete(${it.id})" title="מחיקה">🗑️</button>
      <button class="ib loc-edit-btn" onclick="event.stopPropagation();openLocationEdit(${it.id})" title="עבר למיקום">🔄 מיקום</button>
      <button class="ib loc-edit-btn done-btn${isPending?' active':''}" onclick="event.stopPropagation();markAsDone(${it.id})" title="${isPending?'ממתין לאישור בעלים':'סמן כנגמר'}">${isPending?'⏳ ממתין':'✅ <span style="color:var(--red,#e85d3f)">נגמר</span>'}</button>
      <button class="ib worker-report-btn${isPending?' active':''}" onclick="event.stopPropagation();reportByWorker(${it.id})" style="font-size:11px;padding:0 6px;width:auto;gap:3px;${isPending?'background:rgba(232,93,63,.15);border-color:var(--red);color:var(--red);':''}" title="${isPending?'ממתין לטיפול מנהל':'דווח למנהל — נגמר'}">${isPending?'⏳ דווח':'📢 <span style="color:var(--red,#e85d3f)">נגמר</span>'}</button>
    </div></td>
  </tr>`;
}

function editRow(it){
  const canBulk=window.isOwnerMode||window.isAdminMode;
  return `<tr id="tr-${it.id}" class="erow">
    ${canBulk?'<td></td>':''}
    <td><input class="ie" id="esz" type="text" value="${escHTML(sz(it))}" oninput="formatSize(this)" style="width:90px;font-family:monospace;font-weight:800;text-align:center;letter-spacing:.5px;"/></td>
    <td><div style="display:flex;flex-direction:column;gap:3px;">
      <input class="ie ie-lg" id="eb" type="text" value="${escHTML(it.brand)}" placeholder="מותג"/>
      <input class="ie ie-lg" id="em" type="text" value="${escHTML(it.model)}" placeholder="דגם"/>
    </div></td>
    <td></td>
    <td><div style="display:flex;gap:3px;align-items:flex-end;flex-wrap:wrap;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
        <span style="font-size:8px;color:var(--accent);">פניה 1</span>
        <input class="ie" id="epn1" type="text" value="${escHTML(it.pn1||'')}" style="width:44px;text-align:center;"/>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
        <span style="font-size:8px;color:var(--muted);">שו׳ ימין</span>
        <input class="ie" id="ep1" type="text" value="${escHTML(it.p1||'')}" style="width:48px;text-align:center;"/>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
        <span style="font-size:8px;color:var(--muted);">עמ׳</span>
        <input class="ie" id="ec" type="text" value="${escHTML(it.col)}" style="width:34px;text-align:center;"/>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
        <span style="font-size:8px;color:var(--muted);">קו׳</span>
        <input class="ie" id="ef" type="text" value="${escHTML(it.floor)}" style="width:34px;text-align:center;"/>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
        <span style="font-size:8px;color:var(--accent);">פניה 2</span>
        <input class="ie" id="epn2" type="text" value="${escHTML(it.pn2||'')}" style="width:44px;text-align:center;"/>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
        <span style="font-size:8px;color:var(--muted);">שו׳ שמאל</span>
        <input class="ie" id="ep2" type="text" value="${escHTML(it.p2||'')}" style="width:48px;text-align:center;"/>
      </div>
    </div></td>
    <td><div class="acts">
      <button class="ib sv" onclick="saveEdit(${it.id})">💾</button>
      <button class="ib cx" onclick="cancelEdit()">✕</button>
    </div></td>
  </tr>`;
}

function showItemLocation(id){
  vibrate([50,30,50]); // רטט כשנמצא פריט
  const it=items.find(x=>x.id===id);
  if(!it) return;
  document.getElementById('locPanelTitle').innerHTML=
    `<span style="font-family:monospace;color:var(--accent);font-size:18px;">${sz(it)}</span> &nbsp; ${escHTML(it.brand)}`;

  document.getElementById('locPanelBody').innerHTML=`
    ${it.col&&cages.some(g=>String(g.name)===String(it.col)&&String(g.floor||'1')===String(it.floor||'1'))?`
    <button onclick="showWhPath(${id})" style="width:100%;background:rgba(255,247,0,0.08);border:2px solid #fff700;color:#fff700;border-radius:12px;padding:12px;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;margin-bottom:14px;letter-spacing:0.5px;">🗺️ הצג מסלול למחסן</button>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      ${it.pn1?`
      <div style="background:var(--accent-dim);border:2px solid var(--accent);border-radius:14px;padding:16px;text-align:center;">
        <div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:6px;">🔶 פניה 1</div>
        <div style="font-size:32px;font-weight:900;color:var(--accent);">${escHTML(it.pn1)}</div>
      </div>`:''}
      ${it.p1?`
      <div style="background:var(--green-dim);border:2px solid var(--green);border-radius:14px;padding:16px;text-align:center;">
        <div style="font-size:11px;color:var(--green);font-weight:700;margin-bottom:6px;">↗ שורה ימין</div>
        <div style="font-size:32px;font-weight:900;color:var(--green);">${escHTML(it.p1)}</div>
      </div>`:''}
      ${it.pn2?`
      <div style="background:var(--accent-dim);border:2px solid var(--accent);border-radius:14px;padding:16px;text-align:center;">
        <div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:6px;">🔷 פניה 2</div>
        <div style="font-size:32px;font-weight:900;color:var(--accent);">${escHTML(it.pn2)}</div>
      </div>`:''}
      ${it.p2?`
      <div style="background:var(--purple-dim);border:2px solid var(--purple);border-radius:14px;padding:16px;text-align:center;">
        <div style="font-size:11px;color:var(--purple);font-weight:700;margin-bottom:6px;">↙ שורה שמאל</div>
        <div style="font-size:32px;font-weight:900;color:var(--purple);">${escHTML(it.p2)}</div>
      </div>`:''}
      <div style="background:var(--accent-dim);border:2px solid var(--accent);border-radius:14px;padding:16px;text-align:center;">
        <div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:6px;">📍 עמודה</div>
        <div style="font-size:36px;font-weight:900;color:var(--accent);">${escHTML(it.col)||'—'}</div>
      </div>
      <div style="background:var(--blue-dim);border:2px solid var(--blue);border-radius:14px;padding:16px;text-align:center;">
        <div style="font-size:11px;color:var(--blue);font-weight:700;margin-bottom:6px;">🏢 קומה</div>
        <div style="font-size:36px;font-weight:900;color:var(--blue);">${escHTML(it.floor)||'—'}</div>
      </div>
    </div>
    ${it.agr?`
    <div style="background:var(--green-dim);border:1px solid var(--green);border-radius:12px;padding:14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:24px;">🌾</span>
      <div>
        <div style="font-size:11px;color:var(--green);font-weight:700;">מחסן חקלאות</div>
        <div style="font-size:18px;font-weight:800;">${escHTML(it.agr)}</div>
      </div>
    </div>`:''}
    ${it.rahava?`
    <div style="background:rgba(232,93,63,0.15);border:2px solid var(--red);border-radius:14px;padding:16px;text-align:center;margin-bottom:12px;">
      <div style="font-size:11px;color:var(--red);font-weight:700;margin-bottom:6px;">📦 רחבה / עמסה</div>
      <div style="font-size:28px;font-weight:900;color:var(--red);">✓ פעיל</div>
    </div>`:''}
    ${it.shareMode==='half'?`
    <div style="background:rgba(245,166,35,0.1);border:2px solid var(--accent);border-radius:12px;padding:12px;margin-bottom:12px;text-align:center;">
      <div style="font-size:15px;font-weight:900;color:var(--accent);">½ חצי / חצי</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px;">כלוב זה משותף בין שתי מידות</div>
    </div>`:''}
    ${it.shareMode==='singles'?`
    <div style="background:rgba(74,158,255,0.1);border:2px solid var(--blue);border-radius:12px;padding:12px;margin-bottom:12px;text-align:center;">
      <div style="font-size:15px;font-weight:900;color:var(--blue);">🔲 כלוב צמיגים בודדים</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px;">כלוב זה מכיל צמיגים יחידים ממידות שונות</div>
    </div>`:''}
    ${it.barcode?`
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;font-size:13px;color:var(--muted);">
      🔲 ${escHTML(it.barcode)}
    </div>`:''}
    ${it.notes?`
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;font-size:13px;color:var(--muted);">
      📝 ${escHTML(it.notes)}
    </div>`:''}
  `;
  const panel=document.getElementById('locationPanel');
  panel.style.display='flex';
}

function closeLocationPanel(){
  document.getElementById('locationPanel').style.display='none';
}
window.closeLocationPanel=closeLocationPanel;
window.showItemLocation=showItemLocation;
function startEdit(id){editingId=id;renderTable();setTimeout(()=>{const f=document.getElementById('esz');if(f){f.focus();f.select();}},40);}
function cancelEdit(){editingId=null;renderTable();}
function saveEdit(id){
  const szv=document.getElementById('esz').value.trim();
  const parsed=parseSize(szv);
  if(!parsed){toast('❌ מידה לא תקינה — לדוגמה: 205/55R16 או 13R22.5');return;}
  const {w,p,d}=parsed;
  const b=document.getElementById('eb').value.trim(),m=document.getElementById('em').value.trim();
  const co=document.getElementById('ec').value,fl=document.getElementById('ef').value;
  const p1=document.getElementById('ep1').value.trim(),p2=document.getElementById('ep2').value.trim();
  const pn1=document.getElementById('epn1').value.trim(),pn2=document.getElementById('epn2').value.trim();
  const agr=document.getElementById('eagr') ? document.getElementById('eagr').value.trim() : (items.find(x=>x.id===id)||{}).agr||'';
  if(!b){toast('❌ מלא שדות חובה');return;}
  const it=items.find(x=>x.id===id);
  const beforeSnap=_auditSnapshot(it);
  Object.assign(it,{w,p,d,brand:b,model:m,col:co,floor:fl,p1,p2,pn1,pn2,agr});
  if(window._saveItem){
    window._saveItem(it);
    logEdit(beforeSnap,it);
  } else {
    refreshDropdowns();renderTable();
  }
  editingId=null;toast('✅ עודכן');
}
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&editingId!==null){e.preventDefault();saveEdit(editingId);}
  if(e.key==='Escape'&&editingId!==null){cancelEdit();}
});

/* ADD */
function openAddModal(){
  if(!window.isOwnerMode){toast('❌ גישה לבעלים בלבד');return;}
  ['aSz','aBr','aMo','aItemCode','aNo','aCo','aP1','aP2','aPn1','aPn2'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('aFl').value='1';
  _setAgrBtn('aAgr','btnAgr','');
  document.getElementById('addOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('aBr').focus(),80);
}
function closeAddModal(){
  resetTurnButtons();
  const ri=document.getElementById('aRahava'); if(ri) ri.value='';
  const rb=document.getElementById('btnRahava'); if(rb){ rb.style.background='var(--card)'; rb.style.borderColor='var(--border)'; rb.style.color='var(--muted)'; rb.style.boxShadow='none'; }
  _setAgrBtn('aAgr','btnAgr','');
  stopBarcode();resetVoiceBtn();document.getElementById('addOverlay').classList.remove('open');
  // נקה highlight מפה
  window._formHighlight=null;
  if(document.getElementById('viewWarehouse')?.classList.contains('active')) renderWarehouse();
}
function closeAddOutside(e){if(e.target===document.getElementById('addOverlay'))closeAddModal();}

// סנכרון שדות מיקום בטופס ← הדגשת כלוב במפה
function _syncFormToMap(){
  const p1=(document.getElementById('aP1')?.value||'').trim();
  const p2=(document.getElementById('aP2')?.value||'').trim();
  const col=(document.getElementById('aCo')?.value||'').trim();
  const floor=(document.getElementById('aFl')?.value||'').trim()||'1';
  if((p1||p2) && col){
    const found=cages.find(g=>
      String(g.name)===String(col) &&
      String(g.floor)===String(floor) &&
      ((g.p1&&String(g.p1)===String(p1))||(g.p2&&String(g.p2)===String(p2)))
    );
    window._formHighlight = found ? found.id : null;
  } else {
    window._formHighlight=null;
  }
  if(document.getElementById('viewWarehouse')?.classList.contains('active')) renderWarehouse();
}
window._syncFormToMap=_syncFormToMap;
function addItem(){
  const szv=document.getElementById('aSz').value.trim();
  const parsed=parseSize(szv);
  if(!parsed){toast('❌ מידה לא תקינה — לדוגמה: 205/55R16 או 13R22.5');return;}
  const {w,p,d}=parsed;
  const b=document.getElementById('aBr').value.trim(),m=document.getElementById('aMo').value.trim();
  const itemCode=document.getElementById('aItemCode')?document.getElementById('aItemCode').value.trim():'';
  const barcode=document.getElementById('aNo').value.trim();
  const co=document.getElementById('aCo').value,fl=document.getElementById('aFl').value;
  const p1=document.getElementById('aP1').value.trim(),p2=document.getElementById('aP2').value.trim();
  const pn1=document.getElementById('aPn1').value.trim(),pn2=document.getElementById('aPn2').value.trim();
  const agr=document.getElementById('aAgr').value.trim();
  const rahava=document.getElementById('aRahava')?document.getElementById('aRahava').value:'';
  if(!b){toast('❌ נא להזין מותג');return;}
  if(!co.trim()&&!agr&&!rahava){toast('❌ נא להזין עמודה (מיקום במחסן)');return;}
  if(!fl){toast('❌ נא לבחור קומה');return;}

  const newItem={id:nextId++,w,p,d,brand:b,model:m,itemCode,barcode,col:co,floor:fl,p1,p2,pn1,pn2,agr,rahava,
    dotWeek:window._parsedDot?.week||null, dotYear:window._parsedDot?.year||null};
  window._parsedDot=null;

  // בדוק כפילות מיקום — כל צמיג באותו כלוב+קומה
  if(co.trim()){
    const trimCo=co.trim();
    const normFl=fl||'1';
    const dup=items.find(x=>String(x.col).trim()===trimCo&&String(x.floor||'1')===normFl&&x.status!=='pending_done');
    if(dup){
      // כלוב צמיגים בודדים — הוסף ישירות ללא אזהרה
      if(dup.shareMode==='singles'){
        newItem.shareMode='singles';
        if(window._saveItem){ window._saveItem(newItem); logAdd(newItem); closeAddModal(); toast('🔲 נוסף לכלוב צמיגים בודדים'); }
        else { items.push(newItem); refreshDropdowns(); renderTable(); closeAddModal(); toast('🔲 נוסף (לא מחובר לענן)'); }
        return;
      }
      // כלוב חצי/חצי — אם עוד מקום (פחות מ-2) הוסף אוטומטית
      if(dup.shareMode==='half'){
        const countAtLoc=items.filter(x=>String(x.col).trim()===trimCo&&String(x.floor||'1')===normFl&&x.status!=='pending_done').length;
        if(countAtLoc<2){
          newItem.shareMode='half';
          if(window._saveItem){ window._saveItem(newItem); logAdd(newItem); closeAddModal(); toast('½ נוסף לכלוב חצי/חצי'); }
          else { items.push(newItem); refreshDropdowns(); renderTable(); closeAddModal(); toast('½ נוסף (לא מחובר לענן)'); }
          return;
        }
      }
      showDupConflict(dup,newItem);
      return;
    }
  }

  // שמור ברקוד לזיכרון
  const barcodeResult = document.getElementById('barcodeResult');
  if(barcodeResult && barcodeResult.dataset.code){
    saveBarcodeMemory(barcodeResult.dataset.code, {
      size: `${newItem.w}${newItem.p?'/'+newItem.p:''}R${newItem.d}`,
      brand: newItem.brand,
      model: newItem.model
    });
  }
  if(window._saveItem){
    window._saveItem(newItem);
    logAdd(newItem);
    closeAddModal();toast('✅ הצמיג נוסף!');
  } else {
    // fallback אם Firebase לא מחובר
    items.push(newItem);
    refreshDropdowns();renderTable();
    closeAddModal();toast('✅ הצמיג נוסף (לא מחובר לענן)');
  }
}

/* DELETE */
function askDelete(id){
  if(!window.isOwnerMode){toast('❌ גישה לבעלים בלבד');return;}
  pendingDel=id;
  const it=items.find(x=>x.id===id);
  document.getElementById('confMsg').textContent=`האם למחוק "${it.brand} ${sz(it)}"?`;
  document.getElementById('confOv').classList.add('open');
}
function closeConf(){pendingDel=null;document.getElementById('confOv').classList.remove('open');}

// ── עדכון מיקום (לעובד מנהל) ──
// ── סמן כנגמר ──
function markAsDone(id){
  if(!window.isAdminMode&&!window.isOwnerMode){toast('❌ אין הרשאה');return;}
  const it=items.find(x=>x.id===id);
  if(!it) return;
  if(it.status==='pending_done'){toast('⏳ כבר ממתין לאישור בעלים');return;}
  it.status='pending_done';
  it.pendingBy=window.currentWorkerName||'עובד';
  it.pendingAt=new Date().toISOString();
  if(window._saveItem){ window._saveItem(it); logStatus(it); }
  toast('✅ הפריט סומן — ממתין לאישור בעלים');
}

function reportByWorker(id){
  const it=items.find(x=>x.id===id);
  if(!it) return;
  if(it.status==='pending_done'){toast('⏳ כבר דווח — ממתין לטיפול המנהל');return;}
  it.status='pending_done';
  it.pendingBy=window.currentWorkerName||'עובד';
  it.pendingAt=new Date().toISOString();
  it.workerReport=true;
  if(window._saveItem){ window._saveItem(it); logStatus(it); }
  renderTable();
  toast('📢 הדיווח נשלח למנהל — תודה!');
}
window.reportByWorker=reportByWorker;

// ── פאנל אישורים (בעלים) ──
function openPendingPanel(){
  if(!window.isOwnerMode){toast('❌ גישה לבעלים בלבד');return;}
  _renderPendingList();
  document.getElementById('pendingPanel').style.display='flex';
}
function closePendingPanel(){
  document.getElementById('pendingPanel').style.display='none';
}
function _renderPendingList(){
  const pending=items.filter(x=>x.status==='pending_done');
  const el=document.getElementById('pendingList');
  if(!el) return;
  if(!pending.length){
    el.innerHTML=`<div style="text-align:center;padding:32px;color:var(--muted);font-size:14px;">✅ אין פריטים ממתינים לאישור</div>`;
    return;
  }
  el.innerHTML=pending.map(it=>{
    const date=it.pendingAt?new Date(it.pendingAt).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
    return `<div style="background:var(--card,#191d28);border:1px solid var(--border,#252b3b);border-radius:12px;padding:14px 16px;">
      <div style="font-size:14px;font-weight:800;color:var(--text);">${escHTML(it.brand)} ${it.w?it.w+(it.p?'/'+it.p:'')+'R'+it.d:''} ${it.model?'— '+escHTML(it.model):''}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px;">📍 ${escHTML(it.col||'—')} · קומה ${it.floor||1}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:3px;">${it.workerReport?'📢 דיווח עובד:':'סומן ע״י:'} <b>${escHTML(it.pendingBy||'')}</b>${date?' · '+date:''}</div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button onclick="cancelPending(${it.id})" style="flex:1;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:9px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">↩️ בטל סימון</button>
        <button onclick="approveDeletion(${it.id})" style="flex:1;background:rgba(232,93,63,.15);border:1px solid var(--red,#e85d3f);color:var(--red,#e85d3f);border-radius:9px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">🗑️ אשר מחיקה</button>
      </div>
    </div>`;
  }).join('');
}
function approveDeletion(id){
  if(!window.isOwnerMode) return;
  const it=items.find(x=>x.id===id);
  if(it) logDelete(it);
  if(window._deleteItem) window._deleteItem(id);
  toast('🗑️ הפריט נמחק');
  setTimeout(()=>_renderPendingList(),500);
}
function cancelPending(id){
  if(!window.isOwnerMode) return;
  const it=items.find(x=>x.id===id);
  if(!it) return;
  delete it.status; delete it.pendingBy; delete it.pendingAt; delete it.workerReport;
  logStatus(it);
  if(window._saveItem) window._saveItem(it);
  _renderPendingList();
  toast('↩️ הסימון בוטל');
}
function _updatePendingBadge(){
  const count=items.filter(x=>x.status==='pending_done').length;
  const badge=document.getElementById('pendingCount');
  if(!badge) return;
  badge.textContent=count;
  badge.style.display=count>0?'':'none';
  const bell=document.getElementById('pendingBell');
  if(bell) bell.style.color=count>0?'var(--red,#e85d3f)':'';
  // רענן פאנל אם פתוח
  const pp=document.getElementById('pendingPanel');
  if(pp&&pp.style.display!=='none') _renderPendingList();
}

let _locEditId=null;
function openLocationEdit(id){
  if(!window.isAdminMode&&!window.isOwnerMode){toast('❌ אין הרשאה');return;}
  const it=items.find(x=>x.id===id);
  if(!it) return;
  _locEditId=id;
  const nameEl=document.getElementById('locEditItemName');
  if(nameEl) nameEl.textContent=`${it.brand||''} ${it.w?it.w+(it.p?'/'+it.p:'')+'R'+it.d:''}${it.model?' — '+it.model:''}`;
  // שדות טקסט
  document.getElementById('leP1').value=it.p1||'';
  document.getElementById('leCol').value=it.col||'';
  document.getElementById('leFloor').value=String(it.floor||'1');
  document.getElementById('leP2').value=it.p2||'';
  _setAgrBtn('leAgr','btnLeAgr',it.agr==='כן'?'כן':'');
  // כפתורי toggle — פניה 1
  _setLeToggle('lePn1','btnLePn1',it.pn1||'');
  // כפתורי toggle — פניה 2
  _setLeToggle('lePn2','btnLePn2',it.pn2||'');
  // רחבה
  _setLeRahava(it.rahava||'');
  document.getElementById('locEditOv').classList.add('open');
}
function _setLeToggle(inputId, btnId, val){
  const input=document.getElementById(inputId);
  const btn=document.getElementById(btnId);
  if(!input||!btn) return;
  if(val){
    input.value=val;
    btn.style.background='rgba(245,166,35,0.2)';
    btn.style.borderColor='var(--accent)';
    btn.style.color='var(--accent)';
    btn.style.boxShadow='0 0 10px rgba(245,166,35,0.3)';
  } else {
    input.value='';
    btn.style.background='var(--card)';
    btn.style.borderColor='var(--border)';
    btn.style.color='var(--muted)';
    btn.style.boxShadow='none';
  }
}
function _setLeRahava(val){
  const input=document.getElementById('leRahava');
  const btn=document.getElementById('btnLeRahava');
  if(!input||!btn) return;
  if(val==='כן'){
    input.value='כן';
    btn.style.background='rgba(232,93,63,0.2)';
    btn.style.borderColor='var(--red)';
    btn.style.color='var(--red)';
    btn.style.boxShadow='0 0 12px rgba(232,93,63,0.35)';
  } else {
    input.value='';
    btn.style.background='var(--card)';
    btn.style.borderColor='var(--border)';
    btn.style.color='var(--muted)';
    btn.style.boxShadow='none';
  }
}
function toggleLeRahava(){
  const input=document.getElementById('leRahava');
  if(!input) return;
  _setLeRahava(input.value==='כן'?'':'כן');
  vibrate([40]);
}
function closeLocEdit(){
  document.getElementById('locEditOv').classList.remove('open');
  _locEditId=null;
}
function saveLocEdit(){
  if((!window.isAdminMode&&!window.isOwnerMode)||!_locEditId) return;
  const it=items.find(x=>x.id===_locEditId);
  if(!it) return;
  const locBefore={col:it.col,floor:it.floor};
  it.pn1=document.getElementById('lePn1').value;
  it.p1=document.getElementById('leP1').value.trim();
  it.col=document.getElementById('leCol').value.trim();
  it.floor=document.getElementById('leFloor').value.trim()||'1';
  it.pn2=document.getElementById('lePn2').value;
  it.p2=document.getElementById('leP2').value.trim();
  it.agr=document.getElementById('leAgr').value.trim();
  it.rahava=document.getElementById('leRahava').value;
  if(window._saveItem){ window._saveItem(it); logMove(locBefore,it); }
  closeLocEdit();
  toast('✅ מיקום עודכן');
}

// ── בוחר מיקום ויזואלי ──
function openLocPicker(id){
  _locEditId=id;
  const it=items.find(x=>x.id===id);
  if(!it) return;
  const nameEl=document.getElementById('locPickerItemName');
  if(nameEl) nameEl.textContent=`${it.brand||''} ${it.w?it.w+(it.p?'/'+it.p:'')+'R'+it.d:''}${it.model?' — '+it.model:''}`;

  // טען כלובים משמורה
  let pickerCages=cages&&cages.length?cages:[];
  if(!pickerCages.length){
    const saved=localStorage.getItem('tirewms_map2');
    if(saved){try{const d=JSON.parse(saved);pickerCages=d.cages||[];}catch(e){}}
  }

  // קבץ לפי קומה
  const byFloor={};
  pickerCages.forEach(g=>{const f=String(g.floor||'1');(byFloor[f]=byFloor[f]||[]).push(g);});

  const floorColors={'1':'var(--blue)','2':'var(--green)','3':'var(--yellow,#f5a623)'};
  let html='';
  if(!pickerCages.length){
    html='<div style="color:var(--muted);font-size:13px;">אין כלובים מוגדרים במפה — הגדר קודם במפת המחסן</div>';
  } else {
    Object.keys(byFloor).sort().forEach(f=>{
      const col=floorColors[f]||'var(--muted)';
      html+=`<div style="margin-bottom:14px;"><div style="font-size:11px;font-weight:800;color:${col};margin-bottom:7px;letter-spacing:.5px;">קומה ${f}</div><div style="display:flex;flex-wrap:wrap;gap:7px;">`;
      byFloor[f].sort((a,b)=>String(a.name).localeCompare(String(b.name),'he')).forEach(g=>{
        const isCur=String(it.col)===String(g.name)&&String(it.floor)===String(g.floor||'1');
        const cnt=items.filter(x=>String(x.col)===String(g.name)&&String(x.floor)===String(g.floor||'1')).length;
        html+=`<button onclick="pickLocation('${escHTML(g.name)}','${escHTML(g.floor||'1')}')" style="padding:8px 12px;border-radius:8px;border:2px solid ${isCur?col:'var(--border)'};background:${isCur?'rgba(74,158,255,0.12)':'var(--card)'};color:${isCur?col:'var(--text)'};font-family:inherit;font-size:13px;font-weight:${isCur?'900':'600'};cursor:pointer;min-width:60px;position:relative;">
          ${escHTML(g.name)}${cnt>0?`<span style="position:absolute;top:-5px;left:-5px;background:${col};color:#fff;border-radius:999px;font-size:9px;font-weight:900;padding:1px 4px;min-width:14px;text-align:center;">${cnt}</span>`:''}
        </button>`;
      });
      html+='</div></div>';
    });
  }
  document.getElementById('locPickerGrid').innerHTML=html;
  document.getElementById('locPickerOv').classList.add('open');
}
function closeLocPicker(){
  document.getElementById('locPickerOv').classList.remove('open');
  _locEditId=null;
}
function pickLocation(name,floor){
  if(!_locEditId) return;
  const it=items.find(x=>x.id===_locEditId);
  if(!it) return;
  const locBefore={col:it.col,floor:it.floor};
  it.col=name; it.floor=floor;
  if(window._saveItem){ window._saveItem(it); logMove(locBefore,it); }
  closeLocPicker();
  toast(`📍 מיקום עודכן: ${name} קומה ${floor}`);
}

// ── זיהוי כפילות מיקום ──
let _dupPendingItem=null;
let _dupExistingId=null;
function showDupConflict(existing,newItem){
  _dupPendingItem=newItem;
  _dupExistingId=existing.id;
  const msg=document.getElementById('dupConflictMsg');
  if(msg) msg.innerHTML=`במיקום <b>${escHTML(newItem.col)} קומה ${escHTML(newItem.floor)}</b> כבר נמצא:<br><b>${escHTML(existing.brand||'')} ${escHTML(sz(existing))}</b><br>מה לעשות?`;
  document.getElementById('dupConflictOv').classList.add('open');
}
function closeDupConflict(){
  document.getElementById('dupConflictOv').classList.remove('open');
  _dupPendingItem=null;
  _dupExistingId=null;
}
function dupMarkDoneAndAdd(){
  // סמן ישן כנגמר
  const ex=items.find(x=>x.id===_dupExistingId);
  if(ex){
    const beforeSnap=_auditSnapshot(ex);
    ex.status='pending_done';
    ex.pendingBy=window.currentWorkerName||'בעלים';
    ex.pendingAt=new Date().toISOString();
    logEdit(beforeSnap,ex);
    if(window._saveItem) window._saveItem(ex);
  }
  // הוסף חדש
  if(_dupPendingItem&&window._saveItem){
    window._saveItem(_dupPendingItem);
    toast('✅ הצמיג הישן סומן כנגמר — הצמיג החדש נוסף!');
  }
  closeDupConflict();
  closeAddModal();
}
function dupMoveExisting(){
  const id=_dupExistingId;
  closeDupConflict();
  if(id!=null) openLocationEdit(id);
}
function dupHalfHalf(){
  const ex=items.find(x=>x.id===_dupExistingId);
  if(ex){ const bs=_auditSnapshot(ex); ex.shareMode='half'; logEdit(bs,ex); if(window._saveItem) window._saveItem(ex); }
  if(_dupPendingItem){
    _dupPendingItem.shareMode='half';
    if(window._saveItem) window._saveItem(_dupPendingItem);
  }
  toast('½ שני הצמיגים נשמרו כחצי/חצי בכלוב');
  closeDupConflict(); closeAddModal();
}
function dupSingles(){
  const co=_dupPendingItem&&_dupPendingItem.col, fl=(_dupPendingItem&&_dupPendingItem.floor)||'1';
  if(co){
    const trimCo=String(co).trim();
    items.filter(x=>String(x.col).trim()===trimCo&&String(x.floor||'1')===fl&&x.status!=='pending_done')
      .forEach(x=>{ const bs=_auditSnapshot(x); x.shareMode='singles'; logEdit(bs,x); if(window._saveItem) window._saveItem(x); });
  }
  if(_dupPendingItem){
    _dupPendingItem.shareMode='singles';
    if(window._saveItem) window._saveItem(_dupPendingItem);
  }
  toast('🔲 הצמיג נוסף לכלוב צמיגים בודדים');
  closeDupConflict(); closeAddModal();
}
function doDelete(){
  if(!window.isOwnerMode){toast('❌ מחיקה מותרת לבעלים בלבד');closeConf();return;}
  const delIt=items.find(x=>x.id===pendingDel);
  if(!delIt){toast('❌ פריט לא נמצא');closeConf();return;}
  const delCol=delIt.col;
  logDelete(delIt);
  if(window._deleteItem){
    window._deleteItem(pendingDel);
  } else {
    items=items.filter(x=>x.id!==pendingDel);
    if(editingId===pendingDel)editingId=null;
    refreshDropdowns();renderTable();
  }
  closeConf();toast('🗑️ נמחק');
  _onItemsChanged(delCol);
}

let _emptyCageCol='';
function _onItemsChanged(col){
  // סינכרון מפה אם פתוחה
  if(document.getElementById('viewWarehouse')?.classList.contains('active')) renderWarehouse();
  // בדוק אם העמודה ריקה
  if(col&&items.filter(it=>String(it.col)===String(col)).length===0){
    _emptyCageCol=String(col);
    document.getElementById('emptyCageColName').textContent=col;
    document.getElementById('emptyCageSizeInput').value='';
    document.getElementById('emptyCageOv').classList.add('open');
  }
}
function confirmEmptyCage(){
  const size=(document.getElementById('emptyCageSizeInput').value||'').trim();
  if(size){
    let r={};try{r=JSON.parse(localStorage.getItem('tirewms_reservations')||'{}');}catch(e){r={};}
    r[_emptyCageCol]=size;
    localStorage.setItem('tirewms_reservations',JSON.stringify(r));
    toast(`📌 עמודה ${_emptyCageCol} שמורה למידה: ${size}`);
    if(document.getElementById('viewWarehouse')?.classList.contains('active')) renderWarehouse();
  }
  document.getElementById('emptyCageOv').classList.remove('open');
}
function skipEmptyCage(){
  let r={};try{r=JSON.parse(localStorage.getItem('tirewms_reservations')||'{}');}catch(e){r={};}
  // נקה הזמנה קיימת אם יש
  delete r[_emptyCageCol];
  localStorage.setItem('tirewms_reservations',JSON.stringify(r));
  document.getElementById('emptyCageOv').classList.remove('open');
}
window.confirmEmptyCage=confirmEmptyCage;
window.skipEmptyCage=skipEmptyCage;

// ══ BULK OPERATIONS ══
function toggleBulkRow(cb,id){
  if(cb.checked){ selectedIds.add(id); document.getElementById('tr-'+id)?.classList.add('bulk-checked'); }
  else { selectedIds.delete(id); document.getElementById('tr-'+id)?.classList.remove('bulk-checked'); }
  _updateBulkBar();
  const allCb=document.getElementById('checkAll');
  if(allCb){
    const data=getFiltered();
    const pageData=data.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);
    allCb.checked=pageData.length>0&&pageData.every(it=>selectedIds.has(it.id));
    allCb.indeterminate=!allCb.checked&&pageData.some(it=>selectedIds.has(it.id));
  }
}
function toggleSelectAll(cb){
  const data=getFiltered();
  const pageData=data.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);
  pageData.forEach(it=>{
    if(cb.checked){ selectedIds.add(it.id); document.getElementById('tr-'+it.id)?.classList.add('bulk-checked'); }
    else { selectedIds.delete(it.id); document.getElementById('tr-'+it.id)?.classList.remove('bulk-checked'); }
  });
  document.querySelectorAll('.bulk-cb.row-cb').forEach(el=>{ el.checked=cb.checked; });
  _updateBulkBar();
}
function _updateBulkBar(){
  const bar=document.getElementById('bulkBar');
  const cnt=document.getElementById('bulkCount');
  if(!bar) return;
  if(selectedIds.size>0){ bar.classList.add('open'); if(cnt) cnt.textContent=`${selectedIds.size} נבחרו`; bulkMode=true; }
  else { bar.classList.remove('open'); bulkMode=false; }
}
function clearBulkSelection(){
  selectedIds.clear();
  document.querySelectorAll('.bulk-cb').forEach(cb=>{ cb.checked=false; cb.indeterminate=false; });
  document.querySelectorAll('.bulk-checked').forEach(tr=>tr.classList.remove('bulk-checked'));
  _updateBulkBar();
}
function bulkDeleteSelected(){
  if(!window.isOwnerMode){toast('❌ גישה לבעלים בלבד');return;}
  if(selectedIds.size===0){toast('❌ לא נבחרו פריטים');return;}
  const ids=[...selectedIds];
  const names=ids.slice(0,3).map(id=>{const it=items.find(x=>x.id===id);return it?`${it.brand} ${sz(it)}`:'#'+id;}).join(', ');
  const more=ids.length>3?` ועוד ${ids.length-3}`:'';
  if(!confirm(`מחק ${ids.length} פריטים?\n${names}${more}\n\nפעולה בלתי הפיכה!`)) return;
  ids.forEach(id=>{
    const it=items.find(x=>x.id===id);
    if(it) logDelete(it);
    if(window._deleteItem) window._deleteItem(id);
    else items=items.filter(x=>x.id!==id);
  });
  clearBulkSelection();
  if(!window._deleteItem){refreshDropdowns();renderTable();}
  toast(`🗑️ ${ids.length} פריטים נמחקו`);
}
function openBulkMove(){
  if(!window.isOwnerMode&&!window.isAdminMode){toast('❌ אין הרשאה');return;}
  if(selectedIds.size===0){toast('❌ לא נבחרו פריטים');return;}
  const msg=document.getElementById('bulkMoveMsg');
  if(msg) msg.textContent=`${selectedIds.size} פריטים נבחרו. מלא עמודה ו/או קומה חדשה:`;
  document.getElementById('bulkMoveCol').value='';
  document.getElementById('bulkMoveFloor').value='';
  document.getElementById('bulkMoveOv').classList.add('open');
}
function closeBulkMove(){ document.getElementById('bulkMoveOv').classList.remove('open'); }
function doBulkMove(){
  if(!window.isOwnerMode&&!window.isAdminMode){toast('❌ אין הרשאה');return;}
  const newCol=document.getElementById('bulkMoveCol').value.trim();
  const newFloor=document.getElementById('bulkMoveFloor').value.trim();
  if(!newCol&&!newFloor){toast('❌ מלא לפחות עמודה או קומה');return;}
  const ids=[...selectedIds];
  let moved=0,skipped=0;
  ids.forEach(id=>{
    const it=items.find(x=>x.id===id);
    if(!it) return;
    const targetCol=newCol||it.col;
    const targetFloor=newFloor||it.floor;
    const conflict=items.find(x=>x.id!==id&&String(x.col).trim()===String(targetCol).trim()&&String(x.floor||'1')===String(targetFloor||'1')&&x.status!=='pending_done'&&x.shareMode!=='singles');
    if(conflict){skipped++;return;}
    const before={col:it.col,floor:it.floor};
    if(newCol) it.col=targetCol;
    if(newFloor) it.floor=targetFloor;
    logMove(before,it);
    if(window._saveItem) window._saveItem(it);
    moved++;
  });
  closeBulkMove();
  clearBulkSelection();
  if(!window._saveItem){refreshDropdowns();renderTable();}
  let msg=`📍 ${moved} פריטים הועברו`;
  if(skipped>0) msg+=` · ${skipped} דולגו (קונפליקט מיקום)`;
  toast(msg);
}

/* SORT / FILTER */
function sortBy(c){sortCol===c?sortDir*=-1:(sortCol=c,sortDir=1);renderTable();}
function applyFilters(){ currentPage=0;renderTable();}
function hideMiniMap(){
  const w=document.getElementById('miniMapWrap');
  if(w) w.style.display='none';
}
function renderMiniMap(){
  const col=(document.getElementById('aCo')||{}).value||'';
  const fl=(document.getElementById('aFl')||{}).value||'';
  const wrap=document.getElementById('miniMapWrap');
  const cv=document.getElementById('miniMapCanvas');
  if(!wrap||!cv||!cages.length) return;
  if(!col){wrap.style.display='none';return;}
  wrap.style.display='';
  const W=cv.offsetWidth||300, H=160;
  cv.width=W; cv.height=H;
  const ctx=cv.getContext('2d');
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#0a0c12'; ctx.fillRect(0,0,W,H);

  // מצא את הכלוב המבוקש
  const target=cages.find(g=>String(g.name)===String(col)&&(!fl||String(g.floor)===String(fl)))
              || cages.find(g=>String(g.name)===String(col));

  // חשב scale כדי שכל הכלובים יכנסו
  const xs=cages.map(g=>g.x), ys=cages.map(g=>g.y);
  const minX=Math.min(...xs), maxX=Math.max(...xs)+1;
  const minY=Math.min(...ys), maxY=Math.max(...ys)+1;
  const pad=20;
  const sc=Math.min((W-pad*2)/((maxX-minX)*1)||1,(H-pad*2)/((maxY-minY)*1)||1,40);

  const offX=pad-minX*sc+(W-pad*2-(maxX-minX)*sc)/2;
  const offY=pad-minY*sc+(H-pad*2-(maxY-minY)*sc)/2;

  cages.forEach(g=>{
    const px=offX+g.x*sc, py=offY+g.y*sc;
    const isTarget=target&&g.id===target.id;
    ctx.fillStyle=isTarget?'rgba(255,200,0,0.35)':'#191d28';
    ctx.strokeStyle=isTarget?'#ffd700':( g.floor==='1'?'#4a9eff':g.floor==='2'?'#3ecf8e':'#f5a623');
    ctx.lineWidth=isTarget?3:1;
    ctx.beginPath();
    const r=3;
    ctx.moveTo(px+r,py); ctx.lineTo(px+sc-r,py);
    ctx.quadraticCurveTo(px+sc,py,px+sc,py+r);
    ctx.lineTo(px+sc,py+sc-r);
    ctx.quadraticCurveTo(px+sc,py+sc,px+sc-r,py+sc);
    ctx.lineTo(px+r,py+sc);
    ctx.quadraticCurveTo(px,py+sc,px,py+sc-r);
    ctx.lineTo(px,py+r);
    ctx.quadraticCurveTo(px,py,px+r,py);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if(sc>18){
      ctx.fillStyle=isTarget?'#ffd700':'#7a8299';
      ctx.font=`bold ${Math.min(10,sc/2.5)}px Heebo`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(g.name||'',px+sc/2,py+sc/2);
    }
  });
}
window.renderMiniMap=renderMiniMap;
window.hideMiniMap=hideMiniMap;
function showBrandDrop(inp){
  const id=inp.id;
  const q=(inp.value||'').toUpperCase().trim();
  const fromItems=[...new Set(items.map(i=>i.brand).filter(Boolean))];
  const all=[...new Set([...fromItems,...KNOWN_BRANDS])].sort();
  const filtered=q?all.filter(b=>b.toUpperCase().startsWith(q)):all;
  const drop=document.getElementById('brandDrop');
  if(!drop)return;
  const rect=inp.getBoundingClientRect();
  drop.style.left=rect.left+'px';
  drop.style.top=rect.bottom+'px';
  drop.style.width=rect.width+'px';
  const isFilter=id==='fBrand';
  drop.innerHTML=filtered.length
    ? filtered.map(b=>`<div class="drop-item" data-val="${escHTML(b)}" data-target="${escHTML(id)}" data-isfilter="${isFilter?'1':''}"
        style="padding:9px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
        onmouseenter="this.style.background='var(--border2)'" onmouseleave="this.style.background=''">${escHTML(b)}</div>`).join('')
    : '<div style="padding:8px 12px;color:var(--muted);font-size:13px">אין תוצאות</div>';
  drop.style.display='block';
}
window.showBrandDrop=showBrandDrop;
let _brandDropT=null;
function showBrandDropDebounced(inp){ clearTimeout(_brandDropT); _brandDropT=setTimeout(()=>showBrandDrop(inp),150); }
window.showBrandDropDebounced=showBrandDropDebounced;
function showDescDrop(inp){
  const q=(inp.value||'').trim().toUpperCase();
  const sb=(document.getElementById('aBr')||{}).value.trim().toUpperCase();
  let pairs;
  if(sb && KNOWN_ITEMS_BY_BRAND[sb]) pairs=KNOWN_ITEMS_BY_BRAND[sb];
  else if(sb) pairs=Object.entries(KNOWN_ITEMS_BY_BRAND).filter(([b])=>b.includes(sb)||sb.includes(b.slice(0,4))).flatMap(([,v])=>v);
  else pairs=_getAllDescPairs();
  const filtered=q ? pairs.filter(([d])=>d.toUpperCase().includes(q)).slice(0,60) : pairs.slice(0,60);
  const drop=document.getElementById('descDrop');
  if(!drop)return;
  const rect=inp.getBoundingClientRect();
  drop.style.left=rect.left+'px';
  drop.style.top=rect.bottom+'px';
  drop.style.width=rect.width+'px';
  drop.innerHTML=filtered.length
    ? filtered.map(([d])=>`<div class="drop-item" data-val="${escHTML(d)}"
        style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border);font-family:monospace"
        onmouseenter="this.style.background='var(--border2)'" onmouseleave="this.style.background=''">${escHTML(d)}</div>`).join('')
    : '<div style="padding:8px 12px;color:var(--muted);font-size:13px">אין תוצאות</div>';
  drop.style.display='block';
}
window.showDescDrop=showDescDrop;
function _brandFilter(inp){
  applyFilters();
  const q=(inp.value||'').trim().toUpperCase();
  const drop=document.getElementById('brandDrop');
  if(!drop) return;
  const fromItems=[...new Set(items.map(i=>i.brand).filter(Boolean))];
  const all=[...new Set([...fromItems,...KNOWN_BRANDS])].sort();
  const filtered=q ? all.filter(b=>b.toUpperCase().includes(q)) : all;
  if(!filtered.length){
    drop.innerHTML='<div style="padding:8px 12px;color:var(--muted);font-size:13px;text-align:center;">אין תוצאות</div>';
    drop.style.display='block';
    return;
  }
  drop.innerHTML=filtered.map(b=>
    `<div class="drop-item" data-val="${escHTML(b)}" data-target="fBrand" data-isfilter="1"
      style="padding:9px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);"
      onmouseenter="this.style.background='var(--border2)'" onmouseleave="this.style.background=''">${escHTML(b)}</div>`
  ).join('');
  drop.style.display='block';
}
window._brandFilter=_brandFilter;

function clearFilters(){
  ['fBrand','fSize'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('mainSearch').value='';
  renderTable();
}

/* DROPDOWNS */
let _lastSzKey='';
function refreshDropdowns(){
  const ss=document.getElementById('fSize');
  if(!ss) return;
  const key=items.map(i=>sz(i)).join(',');
  if(key===_lastSzKey) return;
  _lastSzKey=key;
  const sv=ss.value;
  ss.innerHTML='<option value="">📐 מידה</option>'+[...new Set(items.map(i=>sz(i)))].sort().map(s=>`<option value="${escHTML(s)}" ${s===sv?'selected':''}>${escHTML(s)}</option>`).join('');
}

/* LOCATE NEAREST */
function locateNearest(){
  if(!items.length){toast('📦 המחסן ריק');return;}
  // מצא פריט ללא מיקום מלא, אחרת הפריט האחרון שנוסף
  const it = items.find(x=>!x.col||!x.floor) || items[items.length-1];
  toast(`📍 ${it.brand} ${sz(it)} — עמ׳${it.col||'?'} קו׳${it.floor||'?'}`);
}

/* WAREHOUSE — מפת ר */
// צורת ר עברית מדויקת (תוכנית קומה):
//
//  ┌─────────────────────┐
//  │  צלע קצרה (8 עמ׳)  │
//  ├───────┬─────────────┴────────────────────────────┐
//  │       │       צלע ארוכה (20 עמ׳)                │
//  └───────┴──────────────────────────────────────────┘
//
// הצלע הקצרה מחוברת לצד ימין-עליון של הצלע הארוכה

const WH_LONG  = 20;
const WH_SHORT = 8;
const WH_FLOORS = ['1','2','3'];
const CW=52, CH=48, GAP=4, LBL=40, PAD=14;
let selectedCell = null;



function setFloor(f,el){
  currentFloor=f;
  document.querySelectorAll('.ftab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  selectedCell=null;
  closeCellDetail();
  renderGrid();
}

function cellItems(col,row){
  return items.filter(it=>
    it.floor===currentFloor &&
    String(it.col)===String(col) &&
    (row==='ימין' ? !!it.p1 : !!it.p2)
  );
}

function svgCell(col,row,x,y){
  const its=cellItems(col,row);
  const has=its.length>0;
  const isSel=selectedCell&&selectedCell.col===String(col)&&selectedCell.row===row;
  const bg=isSel?'#1e3020':has?'#0d1f0d':'#191d28';
  const strk=isSel?'#f5a623':has?'#3ecf8e':'#2a3045';
  const sw=isSel?2:1;
  let inner='';
  if(has){
    const b=escHTML((its[0].brand||'').substring(0,6));
    const s=escHTML(sz(its[0]).substring(0,9));
    inner+=`<circle cx="${x+CW-6}" cy="${y+7}" r="4" fill="#3ecf8e"/>`;
    inner+=`<text x="${x+CW/2}" y="${y+18}" text-anchor="middle" fill="#eef0f6" font-size="9" font-weight="700">${b}</text>`;
    inner+=`<text x="${x+CW/2}" y="${y+29}" text-anchor="middle" fill="#f5a623" font-size="8" font-family="monospace">${s}</text>`;
    if(its.length>1)
      inner+=`<text x="${x+CW/2}" y="${y+40}" text-anchor="middle" fill="#7a8299" font-size="8">+${its.length-1}</text>`;
  } else {
    inner+=`<text x="${x+CW/2}" y="${y+CH/2+5}" text-anchor="middle" fill="#252b3b" font-size="20">·</text>`;
  }
  inner+=`<text x="${x+3}" y="${y+9}" fill="#3e4560" font-size="7" font-weight="600">${col}</text>`;
  return `<g onclick="onCellClick('${col}','${row}')" style="cursor:${has?'pointer':'default'}">
    <rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="5" fill="${bg}" stroke="${strk}" stroke-width="${sw}"/>
    ${inner}
  </g>`;
}

function renderGrid(){
  const wrap=document.getElementById('warehouseContent');
  if(!wrap) return;

  // ─── מידות ───
  const ROW_H    = CH + GAP;          // גובה שורה אחת
  const SEC_H    = 20 + 2*ROW_H + 8; // כותרת + 2 שורות + padding
  const LONG_W   = LBL + WH_LONG*(CW+GAP);
  const SHORT_W  = LBL + WH_SHORT*(CW+GAP);
  const SVG_W    = LONG_W + PAD*2;
  const SHORT_Y  = PAD;
  const JOIN_H   = 14;  // גובה חיבור בין הצלעות
  const LONG_Y   = SHORT_Y + SEC_H + JOIN_H;
  const SVG_H    = LONG_Y + SEC_H + PAD;

  let svg=`<svg xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 ${SVG_W} ${SVG_H}"
    width="${SVG_W}" height="${SVG_H}"
    style="display:block;min-width:${SVG_W}px;font-family:Heebo,sans-serif;">`;

  // רקע
  svg+=`<rect width="${SVG_W}" height="${SVG_H}" fill="#0c0e14"/>`;

  // ══════════ ר עברית — מסגרת חיצונית ══════════
  // הצלע הקצרה חוברת לפינה ימין-עליון של הצלע הארוכה
  const ox = PAD-2;
  const longTop  = LONG_Y - 2;
  const longBot  = LONG_Y + SEC_H + 2;
  const longRight= PAD + LONG_W + 2;
  const shortRight= PAD + SHORT_W + 2;
  const shortTop  = SHORT_Y - 2;
  const shortBot  = SHORT_Y + SEC_H + 2;

  // מסגרת ר: מימין-למעלה, עוקב בכיוון שעון
  const rPath = [
    `M ${ox} ${shortTop}`,           // פינה שמאל-עליון של ראש
    `L ${shortRight} ${shortTop}`,    // חלק עליון של ראש
    `L ${shortRight} ${shortBot}`,    // צד ימין של ראש
    `L ${shortRight} ${longTop}`,     // ירידה לצלע הארוכה
    `L ${longRight} ${longTop}`,      // חלק עליון של גוף
    `L ${longRight} ${longBot}`,      // צד ימין של גוף
    `L ${ox} ${longBot}`,            // תחתית
    `L ${ox} ${shortTop}`,           // חזרה למעלה
    `Z`
  ].join(' ');

  svg+=`<path d="${rPath}" fill="none" stroke="#f5a623" stroke-width="1.5" opacity="0.4"/>`;

  // כותרת מרכזית
  svg+=`<text x="${SVG_W/2}" y="${SHORT_Y-8}" text-anchor="middle" fill="#f5a623" font-size="12" font-weight="900">🏭 מחסן צמיגים — קומה ${currentFloor}</text>`;

  // ══════════ צלע קצרה (ימין-עליון) ══════════
  svg+=`<rect x="${PAD-2}" y="${SHORT_Y-2}" width="${SHORT_W+4}" height="${SEC_H+4}" rx="8" fill="#13161f" stroke="#252b3b"/>`;
  svg+=`<text x="${PAD+SHORT_W/2}" y="${SHORT_Y+13}" text-anchor="middle" fill="#f5a623" font-size="10" font-weight="800">צלע קצרה — ${WH_SHORT} עמודות</text>`;

  // שורה ימין — צלע קצרה
  svg+=`<text x="${PAD+LBL-3}" y="${SHORT_Y+20+ROW_H/2+5}" text-anchor="end" fill="#7a8299" font-size="9" font-weight="700">ימין</text>`;
  for(let col=1;col<=WH_SHORT;col++){
    svg+=svgCell(col,'ימין', PAD+LBL+(col-1)*(CW+GAP), SHORT_Y+20);
  }
  // שורה שמאל — צלע קצרה
  svg+=`<text x="${PAD+LBL-3}" y="${SHORT_Y+20+ROW_H+ROW_H/2+5}" text-anchor="end" fill="#7a8299" font-size="9" font-weight="700">שמאל</text>`;
  for(let col=1;col<=WH_SHORT;col++){
    svg+=svgCell(col,'שמאל', PAD+LBL+(col-1)*(CW+GAP), SHORT_Y+20+ROW_H);
  }

  // ══════════ חיבור בין צלעות ══════════
  const connX = PAD + SHORT_W/2;
  svg+=`<line x1="${connX}" y1="${SHORT_Y+SEC_H+2}" x2="${connX}" y2="${LONG_Y-2}" stroke="#f5a623" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.6"/>`;

  // ══════════ צלע ארוכה (תחתית) ══════════
  svg+=`<rect x="${PAD-2}" y="${LONG_Y-2}" width="${LONG_W+4}" height="${SEC_H+4}" rx="8" fill="#13161f" stroke="#252b3b"/>`;
  svg+=`<text x="${PAD+LONG_W/2}" y="${LONG_Y+13}" text-anchor="middle" fill="#f5a623" font-size="10" font-weight="800">צלע ארוכה — ${WH_LONG} עמודות</text>`;

  // שורה ימין — צלע ארוכה
  svg+=`<text x="${PAD+LBL-3}" y="${LONG_Y+20+ROW_H/2+5}" text-anchor="end" fill="#7a8299" font-size="9" font-weight="700">ימין</text>`;
  for(let col=1;col<=WH_LONG;col++){
    svg+=svgCell(col,'ימין', PAD+LBL+(col-1)*(CW+GAP), LONG_Y+20);
  }
  // שורה שמאל — צלע ארוכה
  svg+=`<text x="${PAD+LBL-3}" y="${LONG_Y+20+ROW_H+ROW_H/2+5}" text-anchor="end" fill="#7a8299" font-size="9" font-weight="700">שמאל</text>`;
  for(let col=1;col<=WH_LONG;col++){
    svg+=svgCell(col,'שמאל', PAD+LBL+(col-1)*(CW+GAP), LONG_Y+20+ROW_H);
  }

  svg+='</svg>';
  wrap.innerHTML=svg;
}

function onCellClick(col,row){
  const its=cellItems(col,row);
  if(!its.length){toast('📦 תא ריק');return;}
  selectedCell={col,row};
  renderGrid();
  showCellDetail2(col,row,its);
}

function showCellDetail2(col,row,its){
  document.getElementById('cellDetailTitle').textContent=`📍 עמ׳ ${col} · שו׳ ${row} · קו׳ ${currentFloor}`;
  document.getElementById('cellDetailBody').innerHTML=its.map(it=>`
    <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        <span style="font-family:monospace;font-size:14px;font-weight:900;color:var(--accent);">${sz(it)}</span>
        <span style="font-size:14px;font-weight:700;">${escHTML(it.brand)}</span>
        ${it.model?`<span style="font-size:11px;color:var(--muted);">${escHTML(it.model)}</span>`:''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${it.pn1?`<span style="font-size:11px;background:var(--accent-dim);color:var(--accent);border-radius:5px;padding:2px 7px;">פ1 ${escHTML(it.pn1)}</span>`:''}
        ${it.p1?`<span style="font-size:11px;background:var(--green-dim);color:var(--green);border-radius:5px;padding:2px 7px;">↗ שו׳ ימין ${escHTML(it.p1)}</span>`:''}
        <span style="font-size:11px;background:var(--card2);color:var(--muted);border-radius:5px;padding:2px 7px;">עמ׳ ${escHTML(it.col)}</span>
        <span style="font-size:11px;background:var(--card2);color:var(--muted);border-radius:5px;padding:2px 7px;">קו׳ ${escHTML(it.floor)}</span>
        ${it.pn2?`<span style="font-size:11px;background:var(--accent-dim);color:var(--accent);border-radius:5px;padding:2px 7px;">פ2 ${escHTML(it.pn2)}</span>`:''}
        ${it.p2?`<span style="font-size:11px;background:var(--blue-dim);color:var(--blue);border-radius:5px;padding:2px 7px;">↙ שו׳ שמאל ${escHTML(it.p2)}</span>`:''}
        ${it.agr?`<span style="font-size:11px;background:var(--green-dim);color:var(--green);border-radius:5px;padding:2px 7px;">🌾 ${escHTML(it.agr)}</span>`:''}
      </div>
    </div>
  `).join('');
  document.getElementById('cellDetail').style.display='block';
}

function showCellDetail(id){
  const it=items.find(x=>x.id===id);
  if(it) showCellDetail2(it.col,it.p1==='ימין'?'ימין':'שמאל',[it]);
}

function closeCellDetail(){
  document.getElementById('cellDetail').style.display='none';
  selectedCell=null;
}
/* BARCODE SCANNER */
let barcodeStream = null;
let barcodeInterval = null;
let barcodeDetector = null;

async function startBarcode(){
  const wrap = document.getElementById('barcodeWrap');
  const video = document.getElementById('barcodeVideo');
  const result = document.getElementById('barcodeResult');
  result.style.display = 'none';

  // בדוק תמיכה ב-BarcodeDetector
  if(!('BarcodeDetector' in window)){
    // fallback — פתח מצלמה ובקש קוד ידני
    toast('📷 סריקת ברקוד לא נתמכת — נסה כרום אנדרואיד');
    return;
  }

  try {
    barcodeStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width:{ideal:1280}, height:{ideal:720} }
    });
    video.srcObject = barcodeStream;
    wrap.style.display = 'block';

    barcodeDetector = new BarcodeDetector({ formats: ['ean_13','ean_8','code_128','code_39','qr_code','upc_a','upc_e'] });

    let _bcRunning=false;
    barcodeInterval = setInterval(async () => {
      if(_bcRunning) return;
      _bcRunning=true;
      try {
        if(video.readyState === video.HAVE_ENOUGH_DATA){
          const barcodes2 = await barcodeDetector.detect(video);
          if(barcodes2.length > 0){
            const barcode = barcodes2[0];
            const code = barcode.rawValue;
            const format = barcode.format;
            stopBarcode();
            if(format === 'qr_code') parseQRData(code);
            else parseBarcodeData(code);
          }
        }
      } catch(e){ console.warn('barcode detect:',e); }
      finally { _bcRunning=false; }
    }, 300);

  } catch(e){
    toast('❌ לא ניתן לגשת למצלמה');
  }
}

function stopBarcode(){
  clearInterval(barcodeInterval);
  barcodeInterval = null;
  if(barcodeStream){
    barcodeStream.getTracks().forEach(t => t.stop());
    barcodeStream = null;
  }
  const wrap = document.getElementById('barcodeWrap');
  const video = document.getElementById('barcodeVideo');
  if(wrap) wrap.style.display = 'none';
  if(video) video.srcObject = null;
}


/* ══ BARCODE MEMORY ══ */
function getBarcodeMemory(){
  try{ return JSON.parse(localStorage.getItem('tirewms_barcodes')||'{}'); }catch(e){ return {}; }
}
function saveBarcodeMemory(code, data){
  const mem = getBarcodeMemory();
  mem[code] = data;
  localStorage.setItem('tirewms_barcodes', JSON.stringify(mem));
}

function parseQRData(text){
  const result = document.getElementById('barcodeResult');
  result.style.display = 'block';
  result.dataset.code = text;

  // בדוק זיכרון
  const mem = getBarcodeMemory();
  if(mem[text]){
    const saved = mem[text];
    document.getElementById('aSz').value = saved.size||'';
    if(saved.brand) document.getElementById('aBr').value = saved.brand;
    if(saved.model) document.getElementById('aMo').value = saved.model;
    result.textContent = `✅ QR זוהה מזיכרון: ${saved.size}`;
    result.style.color='var(--green)'; result.style.borderColor='var(--green)'; result.style.background='var(--green-dim)';
    vibrate([50,30,50]);
    toast('✅ QR מוכר — פרטים מולאו!');
    return;
  }

  const raw = text.toUpperCase();

  // חפש מידה בתוכן ה-QR
  const sizeMatch = raw.match(/(\d{3})[\/\-]?(\d{2})R(\d{2})/);
  if(sizeMatch){
    const sz = `${sizeMatch[1]}/${sizeMatch[2]}R${sizeMatch[3]}`;
    document.getElementById('aSz').value = sz;
    result.textContent = `✅ QR: ${sz}`;
    result.style.color='var(--green)'; result.style.borderColor='var(--green)'; result.style.background='var(--green-dim)';

    // נסה לחלץ מותג מה-QR
    const foundBrand = KNOWN_BRANDS.find(b => raw.includes(b));
    if(foundBrand){
      document.getElementById('aBr').value = foundBrand.charAt(0)+foundBrand.slice(1).toLowerCase();
      result.textContent += ` · ${foundBrand}`;
    }
    saveBarcodeMemory(text, {size:sz, brand:foundBrand||'', model:''});
    vibrate([50,30,50]);
    toast('✅ QR זוהה: '+sz);
  } else {
    // הצג תוכן QR
    result.textContent = `📱 QR: ${text.slice(0,50)}${text.length>50?'...':''}`;
    result.style.color='var(--blue)'; result.style.borderColor='var(--blue)'; result.style.background='var(--blue-dim)';

    // אם URL — אולי מידע על המוצר
    if(text.startsWith('http')){
      result.textContent += ' · קישור מוצר';
      toast('📱 QR קישור — הזן מידה ידנית');
    } else {
      // הכנס ל-הערות
      const notes = document.getElementById('aNo');
      if(notes&&!notes.value) notes.value = 'QR: '+text.slice(0,30);
      document.getElementById('aSz').focus();
      toast('📱 QR נסרק — הזן מידה ידנית');
    }
  }
}


function parseBarcodeData(code){
  const result = document.getElementById('barcodeResult');
  result.style.display = 'block';

  // בדוק זיכרון ברקוד
  const mem = getBarcodeMemory();
  if(mem[code]){
    const saved = mem[code];
    document.getElementById('aSz').value = saved.size || '';
    if(saved.brand) document.getElementById('aBr').value = saved.brand;
    if(saved.model) document.getElementById('aMo').value = saved.model;
    result.textContent = `✅ זוהה מזיכרון: ${saved.size}${saved.brand?' · '+saved.brand:''}`;
    result.style.color='var(--green)'; result.style.borderColor='var(--green)'; result.style.background='var(--green-dim)';
    vibrate([50,30,50]);
    toast('✅ ברקוד מוכר — פרטים מולאו אוטומטית!');
    return;
  }

  let sizeFound = false;
  const raw = code.toUpperCase().replace(/\s/g,'');

  // ── זיהוי יצרן מקוד DOT ──
  const dotBrands = {
    // Michelin
    'AP':'Michelin','1M3':'Michelin','WA':'Michelin','WB':'Michelin',
    'HA':'Michelin','HB':'Michelin','HC':'Michelin','F1':'Michelin',
    // Bridgestone
    'A7':'Bridgestone','A8':'Bridgestone','F2':'Bridgestone','F6':'Bridgestone',
    'UD':'Bridgestone','TE':'Bridgestone',
    // Continental
    'A3':'Continental','AF':'Continental','EE':'Continental','FW':'Continental',
    // Pirelli
    'HT':'Pirelli','HU':'Pirelli','M3':'Pirelli','MB':'Pirelli',
    // Goodyear
    'VD':'Goodyear','VE':'Goodyear','T4':'Goodyear','E3':'Goodyear',
    // Hankook
    'HH':'Hankook','IH':'Hankook','DL':'Hankook',
    // Kumho
    'KH':'Kumho','DK':'Kumho',
    // Yokohama
    'YB':'Yokohama','YC':'Yokohama',
    // Falken
    'FK':'Falken',
    // Toyo
    'TY':'Toyo','EV':'Toyo',
  };

  let detectedBrand = '';
  let detectedYear = '';

  // חפש DOT בקוד
  const dotMatch = raw.match(/DOT\s*([A-Z0-9]{2,3})/);
  if(dotMatch){
    const plantCode = dotMatch[1].slice(0,2);
    detectedBrand = dotBrands[plantCode] || dotBrands[dotMatch[1].slice(0,3)] || '';
  } else {
    // נסה לזהות מתחילת הברקוד
    const firstTwo = raw.slice(0,2);
    const firstThree = raw.slice(0,3);
    detectedBrand = dotBrands[firstThree] || dotBrands[firstTwo] || '';
  }

  // חפש תאריך ייצור — 4 ספרות אחרונות של DOT (WWYY)
  const dateMatch = raw.match(/(\d{2})(\d{2})$/);
  window._parsedDot = null;
  if(dateMatch){
    const week = +dateMatch[1], year = +('20'+dateMatch[2]);
    if(week>=1&&week<=53&&year>=2000&&year<=2030){
      detectedYear = `שבוע ${week} / ${year}`;
      window._parsedDot = {week, year};
    }
  }

  // 1. פורמט ישיר: 205/55R16 או 205-55R16
  const directMatch = raw.match(/(\d{3})[\/\-]?(\d{2})R(\d{2})/);
  if(directMatch){
    const w=+directMatch[1], p=+directMatch[2], d=+directMatch[3];
    if(w>=145&&w<=365&&p>=25&&p<=85&&d>=12&&d<=24){
      const sz=`${w}/${p}R${d}`;
      document.getElementById('aSz').value=sz;
      if(detectedBrand) document.getElementById('aBr').value=detectedBrand;
      result.textContent=`✅ ${sz}${detectedBrand?' · '+detectedBrand:''}${detectedYear?' · '+detectedYear:''}`;result.dataset.code=code;
      result.style.color='var(--green)'; result.style.borderColor='var(--green)'; result.style.background='var(--green-dim)';
      sizeFound=true;
      vibrate([50,30,50]);
      toast('✅ זוהה מהברקוד!');
    }
  }

  // 2. חפש 7 ספרות ברצף (EAN format)
  if(!sizeFound){
    const nums = raw.replace(/[^0-9]/g,'');
    for(let i=0; i<=nums.length-7; i++){
      const w=+nums.slice(i,i+3), p=+nums.slice(i+3,i+5), d=+nums.slice(i+5,i+7);
      if(w>=145&&w<=365&&p>=25&&p<=85&&d>=12&&d<=24){
        const sz=`${w}/${p}R${d}`;
        document.getElementById('aSz').value=sz;
        if(detectedBrand) document.getElementById('aBr').value=detectedBrand;
        result.textContent=`✅ ${sz}${detectedBrand?' · '+detectedBrand:''}${detectedYear?' · '+detectedYear:''}`;result.dataset.code=code;
        result.style.color='var(--green)'; result.style.borderColor='var(--green)'; result.style.background='var(--green-dim)';
        sizeFound=true;
        vibrate([50,30,50]);
        toast('✅ זוהה מהברקוד!');
        break;
      }
    }
  }

  // 3. לא נמצאה מידה — נסה חיפוש אונליין
  if(!sizeFound){
    result.textContent = `📷 ${code}${detectedBrand?' · '+detectedBrand:''} · 🔍 מחפש...`;
    result.style.color='var(--blue)'; result.style.borderColor='var(--blue)'; result.style.background='var(--blue-dim)';
    if(detectedBrand) document.getElementById('aBr').value=detectedBrand;
    result.dataset.code=code;

    fetch('https://api.upcitemdb.com/prod/trial/lookup?upc='+code)
      .then(r=>r.json())
      .then(data=>{
        if(data.items&&data.items.length>0){
          const item=data.items[0];
          const title=item.title||'';
          const sm=title.match(/([0-9]{3})[\/\-]?([0-9]{2})R([0-9]{2})/i);
          if(sm){
            const sz=sm[1]+'/'+sm[2]+'R'+sm[3];
            document.getElementById('aSz').value=sz;
            result.textContent='✅ '+sz+(item.brand?' · '+item.brand:'');
            result.style.color='var(--green)'; result.style.borderColor='var(--green)'; result.style.background='var(--green-dim)';
            if(item.brand) document.getElementById('aBr').value=item.brand;
            saveBarcodeMemory(code,{size:sz,brand:item.brand||detectedBrand,model:''});
            vibrate([50,30,50]); toast('✅ נמצא: '+sz);
          } else {
            if(item.brand&&!detectedBrand) document.getElementById('aBr').value=item.brand;
            result.textContent='📷 '+(item.brand||detectedBrand||code)+' — הזן מידה';
            document.getElementById('aSz').focus();
            toast('📷 '+(item.brand||'')+(item.brand?' — ':'')+' הזן מידה');
          }
        } else {
          result.textContent='📷 '+code+(detectedBrand?' · '+detectedBrand:'')+' — הזן מידה';
          document.getElementById('aSz').focus();
          toast((detectedBrand?detectedBrand+' — ':'')+' הזן מידה ידנית');
        }
      })
      .catch(()=>{
        result.textContent='📷 '+code+(detectedBrand?' · '+detectedBrand:'')+' — הזן מידה';
        document.getElementById('aSz').focus();
      });
  }
}

// סגור מצלמה כשסוגרים מודל
const _origClose = window.closeAddModal;

/* VOICE RECOGNITION */
let voiceRecog = null;

function startVoice(){
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRec){ toast('❌ דיבור לא נתמך בדפדפן זה — נסה כרום'); return; }

  const btn = document.getElementById('voiceBtn');
  const status = document.getElementById('voiceStatus');
  const resultBox = document.getElementById('voiceResult');

  if(voiceRecog){
    voiceRecog.stop();
    voiceRecog = null;
    btn.style.background = 'var(--green-dim)';
    btn.style.borderColor = 'var(--green)';
    btn.textContent = '🎤';
    status.style.display = 'none';
    return;
  }

  voiceRecog = new SpeechRec();
  voiceRecog.lang = 'he-IL';
  voiceRecog.continuous = false;
  voiceRecog.interimResults = false;

  // אנימציה
  btn.style.background = 'var(--red-dim)';
  btn.style.borderColor = 'var(--red)';
  btn.textContent = '⏹️';
  status.style.display = 'block';
  resultBox.style.display = 'none';

  voiceRecog.onresult = e => {
    const text = e.results[0][0].transcript;
    document.getElementById('voiceText').textContent = '"' + text + '"';
    resultBox.style.display = 'block';
    parseVoiceInput(text);
  };

  voiceRecog.onerror = e => {
    toast('❌ שגיאת זיהוי: ' + e.error);
    resetVoiceBtn();
  };

  voiceRecog.onend = () => {
    resetVoiceBtn();
  };

  voiceRecog.start();
}

function resetVoiceBtn(){
  const btn = document.getElementById('voiceBtn');
  if(btn){ btn.style.background='var(--green-dim)'; btn.style.borderColor='var(--green)'; btn.textContent='🎤'; }
  const status = document.getElementById('voiceStatus');
  if(status) status.style.display='none';
  voiceRecog = null;
}

function parseVoiceInput(text){
  const t = text.toLowerCase().trim();

  // ─── מידה ───
  // "מאתיים וחמש חמישים וחמש ר שש עשרה" או "205 55 16" או "205/55R16"
  let sizeMatch = t.match(/(\d{3})[^\d]*(\d{2})[^\d]*(\d{2})/);
  if(!sizeMatch){
    // נסה לזהות מספרים בדיבור
    const numWords = {'אפס':'0','אחד':'1','שתיים':'2','שלוש':'3','ארבע':'4','חמש':'5','שש':'6','שבע':'7','שמונה':'8','תשע':'9'};
    let conv = t;
    for(const [w,d] of Object.entries(numWords)) conv = conv.replace(new RegExp(w,'g'),d);
    sizeMatch = conv.match(/(\d{3})[^\d]*(\d{2})[^\d]*(\d{2})/);
  }
  if(sizeMatch){
    const sizeStr = sizeMatch[1]+'/'+sizeMatch[2]+'R'+sizeMatch[3];
    document.getElementById('aSz').value = sizeStr;
  }

  // ─── מותג ───
  const hebrewBrands = {'מישלן':'Michelin','ברידג\'סטון':'Bridgestone','קונטיננטל':'Continental','פירלי':'Pirelli','גודייר':'Goodyear','דנלופ':'Dunlop','יוקוהמה':'Yokohama','פאלקן':'Falken','טויו':'Toyo','האנקוק':'Hankook','קומהו':'Kumho','נקסן':'Nexen','קופר':'Cooper','ניטו':'Nitto','פיירסטון':'Firestone','מיטס':'Mitas','פטלס':'Petlas','ספידוויז':'Speedways','אסנסו':'Ascenso'};
  for(const [heb,eng] of Object.entries(hebrewBrands)){
    if(t.includes(heb.toLowerCase())){ document.getElementById('aBr').value = eng; break; }
  }
  for(const b of KNOWN_BRANDS){
    if(t.includes(b.toLowerCase())){ document.getElementById('aBr').value = b.charAt(0)+b.slice(1).toLowerCase(); break; }
  }

  // ─── עמודה ───
  const colMatch = t.match(/עמוד[הא]?\s*([\d]+)/) || t.match(/עמוד[הא]?\s+(\w+)/);
  if(colMatch){
    const num = hebrewToNum(colMatch[1]);
    if(num) document.getElementById('aCo').value = num;
  }

  // ─── קומה ───
  const floorMatch = t.match(/קומ[הא]\s*([\d]+)/) || t.match(/קומ[הא]\s+(\w+)/);
  if(floorMatch){
    const num = hebrewToNum(floorMatch[1]);
    if(num) document.getElementById('aFl').value = num;
  }

  // ─── שורה ימין / שמאל ───
  if(t.includes('ימין')){
    const rowMatch = t.match(/ימין\s*([\d]+)/) || t.match(/צד ימין\s*([\d]+)/);
    if(rowMatch) document.getElementById('aP1').value = rowMatch[1];
    else document.getElementById('aP1').value = 'ימין';
  }
  if(t.includes('שמאל')){
    const rowMatch = t.match(/שמאל\s*([\d]+)/) || t.match(/צד שמאל\s*([\d]+)/);
    if(rowMatch) document.getElementById('aP2').value = rowMatch[1];
    else document.getElementById('aP2').value = 'שמאל';
  }

  // ─── פניה 1 / 2 ───
  const pn1Match = t.match(/פניה\s*[אא1]\s*([\d\w]+)/);
  if(pn1Match) document.getElementById('aPn1').value = pn1Match[1];
  const pn2Match = t.match(/פניה\s*[ב2]\s*([\d\w]+)/);
  if(pn2Match) document.getElementById('aPn2').value = pn2Match[1];

  // ─── מחסן חקלאות ───
  if(t.includes('חקלאות')) _setAgrBtn('aAgr','btnAgr','כן');

  toast('✅ שדות מולאו — בדוק ותקן אם צריך');
}

function hebrewToNum(str){
  const map = {'אחת':'1','אחד':'1','שתיים':'2','שני':'2','שלוש':'3','שלושה':'3','ארבע':'4','ארבעה':'4','חמש':'5','חמישה':'5','שש':'6','ששה':'6','שבע':'7','שבעה':'7','שמונה':'8','תשע':'9','תשעה':'9','עשר':'10','עשרה':'10','אחד עשר':'11','שנים עשר':'12','שלושה עשר':'13','ארבעה עשר':'14','חמישה עשר':'15','שש עשרה':'16','שבעה עשר':'17','שמונה עשר':'18','תשעה עשר':'19','עשרים':'20'};
  if(/^\d+$/.test(str)) return str;
  return map[str.trim()] || null;
}

/* ══ MAP EDITOR ══ */
let cages=[], walls=[], mapHistory=[];
let colLabels={}, rowLabels={}, mapLabels=[], nextLabelId=1;
let whBlinkCols=new Set(), _whBlinkRAF=null;
function startWhBlink(){
  if(_whBlinkRAF) return;
  function loop(){ drawMap(); _whBlinkRAF=requestAnimationFrame(loop); }
  _whBlinkRAF=requestAnimationFrame(loop);
}
function stopWhBlink(){
  if(_whBlinkRAF){cancelAnimationFrame(_whBlinkRAF);_whBlinkRAF=null;}
  whBlinkCols=new Set();
}
let selectedCageId=null, nextCageId=1;
let mapTool='wall';
let isDrawing=false, drawStart=null, drawCurrent=null;
let dragCageId=null, dragOffX=0, dragOffY=0;
let mapScale=40, mapOffX=50, mapOffY=50;
let pinchDist=null;
let mapFloorFilter=0; // 0=הכל, 1/2/3=קומה ספציפית
let mapSection=null; // null=הכל, 'מחסן'/'פניה1'/'פניה2'
let isPanning=false, panStartX=0, panStartY=0, panOffStartX=0, panOffStartY=0;
const SNAP=1.0; // snap לגודל כלוב אחד (ריבועי)

let mapRedoHistory=[];
let selectedCages=[]; // IDs of multi-selected cages
let isRubberBand=false, rubberStart=null, rubberCurrent=null;
let spaceDown=false, _shiftDown=false;
let _multiDragOffsets=[]; // [{id,ox,oy}] relative offsets for multi-drag
let _autoSaveTimer=null;
let _rowClickWx=0, _rowClickWy=0;
let _axisZoom=null; // {type:'x'|'y', startCX, startCY, startScale, startOffX, startOffY}
let _touchStartCX=0,_touchStartCY=0,_touchStartTime=0,_touchIsPanning=false,_isTouchEvent=false;

let _alignTimeout=null;


function showCageItems(g){
  const floorFilter = mapFloorFilter===0 ? null : String(mapFloorFilter);
  const cageItems = items.filter(it=>
    String(it.col)===String(g.name) &&
    (!floorFilter || String(it.floor)===floorFilter)
  );

  if(cageItems.length===0){
    toast('📦 כלוב ריק — '+g.name+' קומה '+g.floor);
    return;
  }

  // בנה פאנל
  const floorColors={'1':'var(--f1)','2':'var(--f2)','3':'var(--f3)'};
  let body=`<div style="font-size:12px;color:var(--muted);margin-bottom:10px;">
    עמודה <b style="color:var(--accent)">${escHTML(g.name)}</b> · ${cageItems.length} צמיגים
  </div>`;

  // קבץ לפי קומה
  const byFloor={};
  cageItems.forEach(it=>{ const f=it.floor||'1'; (byFloor[f]=byFloor[f]||[]).push(it); });

  Object.keys(byFloor).sort().forEach(f=>{
    const color=floorColors[f]||'var(--accent)';
    body+=`<div style="margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <span class="floor-badge floor-${f}">${f}</span>
        <span style="font-size:11px;font-weight:700;color:${color};">קומה ${f}</span>
      </div>`;
    byFloor[f].forEach(it=>{
      body+=`<div onclick="showItemLocation(${it.id})" style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px;cursor:pointer;display:flex;align-items:center;gap:10px;">
        <span style="font-family:monospace;font-size:14px;font-weight:900;color:var(--accent);">${sz(it)}</span>
        <span style="font-weight:700;">${escHTML(it.brand)}</span>
        ${it.model?`<span style="font-size:11px;color:var(--muted);">${escHTML(it.model)}</span>`:''}
      </div>`;
    });
    body+='</div>';
  });

  // הצג בפאנל
  const panel=document.getElementById('cageItemsPanel');
  const title=document.getElementById('cageItemsTitle');
  const bodyEl=document.getElementById('cageItemsBody');
  if(panel&&title&&bodyEl){
    title.innerHTML=`📦 כלוב ${escHTML(g.name)}`;
    bodyEl.innerHTML=body;
    panel.style.display='block';
  }
}

function closeCageItemsPanel(){
  const p=document.getElementById('cageItemsPanel');
  if(p) p.style.display='none';
}

function setFloorFilter(f){
  mapFloorFilter=f;
  // עדכן כפתורים
  ['all',1,2,3].forEach(id=>{
    const btn=document.getElementById('fl-'+(id==='all'?'all':id));
    if(!btn) return;
    const isActive=(id==='all'&&f===0)||(id===f);
    const colors={1:'var(--f1)',2:'var(--f2)',3:'var(--f3)'};
    if(isActive){
      btn.style.background=id==='all'?'var(--accent)':(colors[id]||'var(--accent)');
      btn.style.color=id==='all'?'#111':'#111';
      btn.style.border='none';
    } else {
      btn.style.background='var(--card)';
      btn.style.color=id==='all'?'var(--muted)':(colors[id]||'var(--muted)');
      btn.style.border='1px solid '+(id==='all'?'var(--border)':(colors[id]||'var(--border)'));
    }
  });
  drawMap();
}

function setMapSection(s){
  mapSection=s;
  // עדכן כפתורים
  ['all','מחסן','פניה1','פניה2'].forEach(id=>{
    const btn=document.getElementById('sec-'+(id==='all'?'all':id));
    if(!btn) return;
    const isActive=(id==='all'&&s===null)||(id===s);
    if(isActive){
      btn.style.background='var(--accent)';
      btn.style.border='none';
      btn.style.color='#111';
    } else {
      btn.style.background='var(--card)';
      btn.style.border='1px solid var(--border)';
      btn.style.color='var(--muted)';
    }
  });
  // מרכז את המפה לפי האזור הנבחר
  const prefixMap = {
    'מחסן': ['מי.','מש.'],
    'פניה1': ['פ1ש.','פ1י.'],
    'פניה2': ['פ2י.','פ2ש.']
  };
  if(s && prefixMap[s]){
    const prefs=prefixMap[s];
    const subset=cages.filter(g=>prefs.some(p=>String(g.name).startsWith(p)));
    if(subset.length>0){
      const cv=document.getElementById('mapCanvas');
      const xs=subset.map(g=>g.x), ys=subset.map(g=>g.y);
      const minX=Math.min(...xs), minY=Math.min(...ys);
      const maxX=Math.max(...xs)+1, maxY=Math.max(...ys)+1;
      const fitScale=cv?Math.min(cv.width/(maxX-minX+2), cv.height/(maxY-minY+2), 60):mapScale;
      mapScale=Math.max(10,Math.min(60,fitScale));
      mapOffX=cv?cv.width/2-(minX+(maxX-minX)/2)*mapScale:50;
      mapOffY=cv?cv.height/2-(minY+(maxY-minY)/2)*mapScale:50;
    }
  } else {
    centerMap(); return;
  }
  drawMap();
}

function _drawAlignLines(g){
  clearTimeout(_alignTimeout);
  _alignTimeout=setTimeout(()=>{ drawMap(); },400);
}

function zoomIn(){ mapScale=Math.min(80,mapScale*1.25); drawMap(); }
function zoomOut(){ mapScale=Math.max(10,mapScale*0.8); drawMap(); }
function centerMap(){
  if(cages.length===0){ mapOffX=50; mapOffY=50; mapScale=40; drawMap(); return; }
  const xs=cages.map(g=>g.x), ys=cages.map(g=>g.y);
  const minX=Math.min(...xs), maxX=Math.max(...xs);
  const minY=Math.min(...ys), maxY=Math.max(...ys);
  const cv=document.getElementById('mapCanvas');
  if(!cv){ drawMap(); return; }
  const pad=40;
  const scaleX=(cv.width -pad*2)/((maxX-minX+1)*mapScale);
  const scaleY=(cv.height-pad*2)/((maxY-minY+1)*mapScale);
  const fit=Math.min(scaleX,scaleY,1);
  mapScale=Math.max(8,Math.min(60,mapScale*fit));
  const midX=(minX+maxX)/2, midY=(minY+maxY)/2;
  mapOffX=cv.width/2  - midX*mapScale;
  mapOffY=cv.height/2 - midY*mapScale;
  drawMap();
}

function setMapTool(t){
  mapTool=t;
  ['wall','pan','cage','move','select','erase','row','text'].forEach(n=>{
    const b=document.getElementById('tool-'+n);
    if(!b) return;
    const on=n===t;
    b.style.background=on?'var(--accent)':'var(--card)';
    b.style.borderColor=on?'var(--accent)':'var(--border)';
    b.style.color=on?'#111':'var(--muted)';
    b.style.fontWeight=on?'900':'600';
  });
  const hints={wall:'🖊️ גרור לציור קיר | W',pan:'🖐 גרור להזזת המפה | P',cage:'📦 לחץ למיקום כלוב | C',move:'✋ גרור כלוב | Delete למחיקה | M',select:'⬚ גרור לבחירת אזור | לאחר בחירה עבור ל-הזז לגרירה | S',erase:'🗑️ לחץ למחיקה',row:'📏 לחץ להוספת שורת כלובים',text:'🔤 לחץ על המפה — הקלד מספר + כיוון או טקסט חופשי'};
  const h=document.getElementById('mapHint');
  if(h) h.textContent=hints[t]||'';
  const cursor=t==='pan'?'grab':t==='move'?'grab':t==='select'?'default':t==='erase'?'cell':'crosshair';
  const canvas=document.getElementById('mapCanvas');
  if(canvas) canvas.style.cursor=cursor;
  if(t!=='move'&&t!=='select'){const tip=document.getElementById('cageFloorTooltip');if(tip)tip.style.display='none';}
}

function initMapEditor(){
  const canvas=document.getElementById('mapCanvas');
  const wrap=document.getElementById('mapEditorWrap');
  if(!canvas||!wrap) return;
  const saved=localStorage.getItem('tirewms_map2');
  if(saved){ try{ const d=JSON.parse(saved); walls=d.walls||[]; nextCageId=d.nextId||1;
    cages=(d.cages||[]).map(g=>({...g,x:Math.round(g.x),y:Math.round(g.y)}));
    colLabels=d.colLabels||{}; rowLabels=d.rowLabels||{};
    mapLabels=d.mapLabels||[]; nextLabelId=d.nextLabelId||1;
  }catch(e){} }
  const _dups=_deduplicateCages();
  if(_dups>0){ _scheduleAutoSave(); toast(`⚠️ הוסרו ${_dups} כלובים כפולים מהמפה`); }
  resizeCanvas(); drawMap(); setMapTool('pan');

  // Remove old listeners
  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);
  const cv = document.getElementById('mapCanvas');

  // Touch
  cv.addEventListener('touchstart', onTS, {passive:false});
  cv.addEventListener('touchmove',  onTM, {passive:false});
  cv.addEventListener('touchend',   onTE, {passive:false});
  // Mouse
  cv.addEventListener('mousedown', onMD);
  cv.addEventListener('mousemove', onMV);
  cv.addEventListener('mouseup',   onMU);
  cv.addEventListener('click',     onCK);
  cv.addEventListener('wheel',     onWheel, {passive:false});

  if(!window._mapResizeListener){
    window._mapResizeListener = ()=>{ resizeCanvas(); drawMap(); };
    window.addEventListener('resize', window._mapResizeListener);
  }
  if(!window._mapKeyListener){
    window._mapKeyListener=true;
    window.addEventListener('keydown', onMapKey);
    window.addEventListener('keyup',   onMapKeyUp);
  }
}

function resizeCanvas(){
  const cv=document.getElementById('mapCanvas');
  const wrap=document.getElementById('mapEditorWrap');
  if(!cv||!wrap) return;
  cv.width=wrap.offsetWidth||window.innerWidth;
  cv.height=wrap.offsetHeight||(window.innerHeight-160);
}

function snapV(v){ return Math.round(v/SNAP)*SNAP; }
function w2c(wx,wy){ return [wx*mapScale+mapOffX, wy*mapScale+mapOffY]; }
function c2w(cx,cy){ return [snapV((cx-mapOffX)/mapScale), snapV((cy-mapOffY)/mapScale)]; }

function getPos(e,cv){
  const r=cv.getBoundingClientRect();
  if(e.touches&&e.touches.length>0) return [e.touches[0].clientX-r.left, e.touches[0].clientY-r.top];
  return [e.clientX-r.left, e.clientY-r.top];
}

function getCageAt(wx,wy){
  for(let i=cages.length-1;i>=0;i--){
    const g=cages[i];
    if(wx>=g.x&&wx<g.x+1&&wy>=g.y&&wy<g.y+1) return g;
  }
  return null;
}

function getWallIdx(wx,wy){
  for(let i=walls.length-1;i>=0;i--){
    const w=walls[i],dx=w.x2-w.x1,dy=w.y2-w.y1,len2=dx*dx+dy*dy;
    if(len2===0) continue;
    const t=Math.max(0,Math.min(1,((wx-w.x1)*dx+(wy-w.y1)*dy)/len2));
    const d=Math.hypot(wx-(w.x1+t*dx),wy-(w.y1+t*dy));
    if(d<(_isTouchEvent?0.6:0.5)) return i;
  }
  return -1;
}

// ── Events ──
function onTS(e){
  e.preventDefault();
  const cv=document.getElementById('mapCanvas');
  if(e.touches.length===2){
    pinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    _touchIsPanning=false;
    return;
  }
  const[cx,cy]=getPos(e,cv);
  _touchStartCX=cx; _touchStartCY=cy; _touchStartTime=Date.now();
  _touchIsPanning=false;
  // כלי גלילה — מיד מתחיל גלילה, אבל לא בסרגל (הסרגל תמיד פותח עורך)
  if(mapTool==='pan'){
    const _inR=cy<44||cx<44||(cv&&cx>cv.clientWidth-44);
    if(!_inR){
      isPanning=true; panStartX=cx; panStartY=cy;
      panOffStartX=mapOffX; panOffStartY=mapOffY;
      _touchIsPanning=true;
    }
  }
}
function onTM(e){
  e.preventDefault();
  const cv=document.getElementById('mapCanvas');
  if(e.touches.length===2&&pinchDist!==null){
    const newDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    const factor=newDist/pinchDist;
    mapScale=Math.max(12,Math.min(120,mapScale*factor));
    pinchDist=newDist;
    autoExpandCages(); drawMap(); return;
  }
  const[cx,cy]=getPos(e,cv);
  // אם זז יותר מ-10 פיקסלים — הפוך לגלילה (כלים שאינם כלוב/קיר)
  const inRuler=_touchStartCY<44||_touchStartCX<44||_touchStartCX>cv.clientWidth-44;
  if(!_touchIsPanning && mapTool!=='wall' && mapTool!=='cage' && mapTool!=='select' && !inRuler){
    const moved=Math.hypot(cx-_touchStartCX,cy-_touchStartCY);
    if(moved>10){
      _touchIsPanning=true;
      isPanning=true; panStartX=_touchStartCX; panStartY=_touchStartCY;
      panOffStartX=mapOffX; panOffStartY=mapOffY;
    }
  }
  if(_touchIsPanning){ handleMove(cx,cy); return; }
  handleMove(cx,cy);
}
function onTE(e){
  e.preventDefault();
  pinchDist=null;
  const cv=document.getElementById('mapCanvas');
  let endCX=_touchStartCX, endCY=_touchStartCY;
  if(e.changedTouches && e.changedTouches.length){
    const r=cv.getBoundingClientRect();
    endCX=e.changedTouches[0].clientX-r.left;
    endCY=e.changedTouches[0].clientY-r.top;
  }
  const totalMoved=Math.hypot(endCX-_touchStartCX, endCY-_touchStartCY);
  if(_touchIsPanning && totalMoved>=10){
    _touchIsPanning=false; isPanning=false;
    drawMap(); return;
  }
  // טאפ — האצבע זזה פחות מ-10px, בטל גרירה שהופעלה בטעות
  _touchIsPanning=false; isPanning=false;
  if(mapTool!=='pan'){
    _isTouchEvent=true;
    handleDown(_touchStartCX,_touchStartCY);
    handleUp();
    _isTouchEvent=false;
  }
}
function onMD(e){ _isTouchEvent=false; const cv=document.getElementById('mapCanvas'); handleDown(...getPos(e,cv)); }
function onMV(e){ const cv=document.getElementById('mapCanvas'); handleMove(...getPos(e,cv)); }
function onMU(e){ handleUp(); }
function onCK(e){
  if(mapTool==='move'||mapTool==='erase'){
    const cv=document.getElementById('mapCanvas');
    const[cx,cy]=getPos(e,cv);
    const[wx,wy]=c2w(cx,cy);
    if(mapTool==='move'){
      const g=getCageAt(wx,wy);
      if(g){selectedCageId=g.id;openCageEdit(g);drawMap();}
      else{selectedCageId=null;closeCageEdit();drawMap();}
    }
  }
}

function handleDown(cx,cy){
  const _cv=document.getElementById('mapCanvas');
  const RULER=44, RULER_R=44;
  const CELL=mapScale;

  // ── כלי טקסט — קליק על המפה פותח חלון עם כפתורי כיוון ──
  if(mapTool==='text'){
    if(cx>=RULER && cy>=RULER && (!_cv||cx<=_cv.width-RULER_R)){
      const col=Math.floor((cx-mapOffX)/CELL);
      const row=Math.floor((cy-mapOffY)/CELL);
      const wx=(cx-mapOffX)/CELL, wy=(cy-mapOffY)/CELL;
      const existing=mapLabels.find(l=>Math.hypot(l.wx-wx,l.wy-wy)<1.5);
      if(existing){
        _openLabelEditor(cx, cy+10, 'ערוך טקסט', existing.text, {type:'map-edit',key:{id:existing.id}});
      } else {
        _openLabelEditor(cx, cy+10, 'הקלד מספר + בחר כיוון — או טקסט חופשי ← ✓', '',
          {type:'auto', col, row, wx, wy});
      }
      return;
    }
  }

  // קליק על הסרגלים → זום (כלים רגילים)
  if(cy<RULER && cx>=RULER && (!_cv||cx<=_cv.width-RULER_R)){
    _axisZoom={type:'x',startCX:cx,startCY:cy,startScale:mapScale,startOffX:mapOffX,startOffY:mapOffY};
    return;
  }
  if(cx<RULER && cy>=RULER){
    _axisZoom={type:'y',startCX:cx,startCY:cy,startScale:mapScale,startOffX:mapOffX,startOffY:mapOffY};
    return;
  }
  if(_cv && cx>_cv.width-RULER_R && cy>=RULER){
    _axisZoom={type:'y',startCX:cx,startCY:cy,startScale:mapScale,startOffX:mapOffX,startOffY:mapOffY};
    return;
  }
  if(cx<RULER||cy<RULER) return;
  if(_cv && cx>_cv.width-RULER_R) return;
  const[wx,wy]=c2w(cx,cy);
  // כלי גלילה או Space — הזזת המפה
  if(mapTool==='pan'||spaceDown){
    isPanning=true; panStartX=cx; panStartY=cy;
    panOffStartX=mapOffX; panOffStartY=mapOffY;
    const cv2=document.getElementById('mapCanvas');
    if(cv2) cv2.style.cursor='grabbing';
    return;
  }
  if(mapTool==='wall'){
    pushHistory();
    isDrawing=true; drawStart=[wx,wy]; drawCurrent=[wx,wy];
  } else if(mapTool==='cage'){
    const nx=Math.max(0,Math.floor(wx)), ny=Math.max(0,Math.floor(wy));
    const occ=_cageOccupied(nx,ny,'1');
    if(occ){ toast(`❌ יש כלוב "${occ.name}" במיקום זה`); return; }
    pushHistory();
    const id=nextCageId++;
    const g={id,name:String(id),floor:'1',x:nx,y:ny,rot:false};
    cages.push(g);
    selectedCageId=id; selectedCages=[id];
    drawMap();
    openCageEdit(g);
  } else if(mapTool==='move'||mapTool==='select'){
    const g=getCageAt(wx,wy);
    if(g){
      // If clicking a cage already in multi-select → drag all; else single-select
      if(!selectedCages.includes(g.id)){
        selectedCages=[g.id];
        selectedCageId=g.id;
        openCageEdit(g);
      }
      dragCageId=g.id; dragOffX=wx-g.x; dragOffY=wy-g.y;
      // Build offsets for all selected cages relative to dragged cage
      _multiDragOffsets=selectedCages.map(id=>{
        const c=cages.find(x=>x.id===id);
        return c?{id,ox:c.x-g.x,oy:c.y-g.y}:{id,ox:0,oy:0};
      });
    } else {
      // Start rubber-band selection
      selectedCages=[]; selectedCageId=null; closeCageEdit();
      isRubberBand=true; rubberStart=[wx,wy]; rubberCurrent=[wx,wy];
      drawMap();
    }
  } else if(mapTool==='row'){
    _rowClickWx=wx; _rowClickWy=wy;
    openRowPanel();
  } else if(mapTool==='erase'){
    pushHistory();
    const g=getCageAt(wx,wy);
    if(g){cages=cages.filter(c=>c.id!==g.id);selectedCageId=null;selectedCages=[];closeCageEdit();drawMap();return;}
    const wi=getWallIdx(wx,wy);
    if(wi>=0){walls.splice(wi,1);drawMap();}
  }
}

function handleMove(cx,cy){
  // Axis zoom — גרירת סרגל
  if(_axisZoom){
    if(_axisZoom.type==='x'){
      const wx=(_axisZoom.startCX-_axisZoom.startOffX)/_axisZoom.startScale;
      const factor=Math.exp((cx-_axisZoom.startCX)/180);
      mapScale=Math.max(12,Math.min(120,_axisZoom.startScale*factor));
      mapOffX=_axisZoom.startCX-wx*mapScale;
    } else {
      const wy=(_axisZoom.startCY-_axisZoom.startOffY)/_axisZoom.startScale;
      const factor=Math.exp((_axisZoom.startCY-cy)/180);
      mapScale=Math.max(12,Math.min(120,_axisZoom.startScale*factor));
      mapOffY=_axisZoom.startCY-wy*mapScale;
    }
    autoExpandCages();
    drawMapThrottled(); return;
  }
  // Space-bar panning
  if(isPanning){
    mapOffX=panOffStartX+(cx-panStartX);
    mapOffY=panOffStartY+(cy-panStartY);
    drawMapThrottled(); return;
  }
  const[wx,wy]=c2w(cx,cy);
  if(mapTool==='wall'&&isDrawing){
    drawCurrent=[wx,wy];
    drawMapThrottled();
  } else if((mapTool==='move'||mapTool==='select')&&isRubberBand){
    rubberCurrent=[wx,wy];
    drawMapThrottled();
  } else if((mapTool==='move'||mapTool==='select')&&dragCageId){
    const g=cages.find(c=>c.id===dragCageId);
    if(g){
      // מגנט אמיתי: הכלוב נדבק למשבצת שמתחת לסמן
      const fnx=Math.floor(wx), fny=Math.floor(wy);
      // מצא את המינימום של הבלוק אחרי ההזזה — כדי שאם הוא חורג,
      // כל הבלוק יוזז בבת אחת (לא ידחוס את הכלובים הקיצוניים)
      let minNX=Infinity, minNY=Infinity;
      _multiDragOffsets.forEach(o=>{
        if(fnx+o.ox<minNX) minNX=fnx+o.ox;
        if(fny+o.oy<minNY) minNY=fny+o.oy;
      });
      const shiftX = minNX<0 ? -minNX : 0;
      const shiftY = minNY<0 ? -minNY : 0;
      _multiDragOffsets.forEach(o=>{
        const c=cages.find(x=>x.id===o.id);
        if(c){ c.x=fnx+o.ox+shiftX; c.y=fny+o.oy+shiftY; }
      });
      drawMapThrottled();
    }
  }
}

function handleUp(){
  if(isPanning){ isPanning=false; return; }
  if(mapTool==='wall'&&isDrawing&&drawStart&&drawCurrent){
    const[x1,y1]=drawStart,[x2,y2]=drawCurrent;
    if(Math.hypot(x2-x1,y2-y1)>0.3){
      walls.push({x1,y1,x2,y2});
      _scheduleAutoSave();
    }
  }
  if(dragCageId) _scheduleAutoSave();
  // סיום rubber-band — בחר כל הכלובים בתוך המלבן
  if(isRubberBand&&rubberStart&&rubberCurrent){
    const rx1=Math.min(rubberStart[0],rubberCurrent[0]);
    const ry1=Math.min(rubberStart[1],rubberCurrent[1]);
    const rx2=Math.max(rubberStart[0],rubberCurrent[0]);
    const ry2=Math.max(rubberStart[1],rubberCurrent[1]);
    const dist=Math.hypot(rx2-rx1,ry2-ry1);
    if(dist>0.3){
      selectedCages=cages.filter(g=>{
        return g.x<rx2&&g.x+1>rx1&&g.y<ry2&&g.y+1>ry1;
      }).map(g=>g.id);
      if(selectedCages.length===1){
        selectedCageId=selectedCages[0];
        openCageEdit(cages.find(g=>g.id===selectedCageId));
      } else if(selectedCages.length>1){
        selectedCageId=null; closeCageEdit();
        const h=document.getElementById('mapHint');
        if(h) h.textContent=`✅ נבחרו ${selectedCages.length} כלובים — גרור להזזה, Delete למחיקה`;
      }
    }
  }
  if(_axisZoom){ _axisZoom=null; return; }
  if(isPanning){
    isPanning=false;
    const cv2=document.getElementById('mapCanvas');
    if(cv2) cv2.style.cursor=mapTool==='pan'?'grab':mapTool==='move'?'grab':mapTool==='erase'?'cell':'crosshair';
    return;
  }
  isDrawing=false; drawStart=null; drawCurrent=null;
  dragCageId=null; isRubberBand=false; rubberStart=null; rubberCurrent=null;
  _multiDragOffsets=[];
  drawMap();
}

// ── Draw ──
// throttle drawMap
let _dmRafId=null;
function drawMapThrottled(){
  if(_dmRafId) return;
  _dmRafId=requestAnimationFrame(()=>{ _dmRafId=null; drawMap(); });
}
window.drawMapThrottled=drawMapThrottled;

// cache פריטים לפי col+floor — מתעדכן רק כשהנתונים משתנים
let _dmItemKeyCount=null, _dmTotalCount=null;
function _dmBuildItemCache(){
  _dmItemKeyCount=new Map();
  _dmTotalCount=new Map();
  (window.items||[]).forEach(it=>{
    const k=`${it.col}__${it.floor||'1'}`;
    _dmItemKeyCount.set(k,(_dmItemKeyCount.get(k)||0)+1);
    const n=String(it.col);
    _dmTotalCount.set(n,(_dmTotalCount.get(n)||0)+1);
  });
}
function _dmInvalidate(){ _dmItemKeyCount=null; _dmTotalCount=null; }
window._dmInvalidate=_dmInvalidate;

function drawMap(){
  const cv=document.getElementById('mapCanvas');
  if(!cv) return;
  const ctx=cv.getContext('2d');
  // רקע (fillRect גם מנקה + צובע במכה אחת — לא צריך clearRect)
  ctx.fillStyle='#0a0c12';
  ctx.fillRect(0,0,cv.width,cv.height);

  if(!_dmItemKeyCount) _dmBuildItemCache();
  const iCount=_dmItemKeyCount;

  // ── גריד ריבועי — כל תא = כלוב אחד ──
  const CELL = mapScale;
  const DETAIL = CELL >= 22; // רק בזום גבוה — רמת פירוט מלאה
  const SHOW_FLOOR_LABELS = CELL >= 34;

  const startCol = Math.floor(-mapOffX / CELL) - 1;
  const startRow = Math.floor(-mapOffY / CELL) - 1;
  const endCol   = startCol + Math.ceil(cv.width  / CELL) + 2;
  const endRow   = startRow + Math.ceil(cv.height / CELL) + 2;

  // רקע תאים — pass יחיד
  ctx.fillStyle='#0e1018';
  for(let row=startRow; row<=endRow; row++){
    for(let col=startCol; col<=endCol; col++){
      const px=mapOffX+col*CELL, py=mapOffY+row*CELL;
      ctx.fillRect(px+1,py+1,CELL-2,CELL-2);
    }
  }

  // 3 פסי קומות — רק אם מספיק מזווח
  if(DETAIL){
    const SLOT=CELL/3;
    const floorColors=['rgba(74,158,255,0.04)','rgba(62,207,142,0.04)','rgba(245,166,35,0.04)'];
    const floorBorders=['rgba(74,158,255,0.10)','rgba(62,207,142,0.10)','rgba(245,166,35,0.10)'];
    const floorLabels=['rgba(30,100,210,0.85)','rgba(20,150,90,0.85)','rgba(180,100,0,0.85)'];
    // מלא כל צבע בנפרד
    for(let f=0; f<3; f++){
      ctx.fillStyle=floorColors[f];
      for(let row=startRow; row<=endRow; row++){
        for(let col=startCol; col<=endCol; col++){
          const px=mapOffX+col*CELL, py=mapOffY+row*CELL+f*SLOT;
          ctx.fillRect(px+1,py+0.5,CELL-2,SLOT-1);
        }
      }
    }
    // קווי חלוקה
    for(let f=1; f<3; f++){
      ctx.strokeStyle=floorBorders[f]; ctx.lineWidth=0.5;
      ctx.beginPath();
      for(let row=startRow; row<=endRow; row++){
        for(let col=startCol; col<=endCol; col++){
          const px=mapOffX+col*CELL, py=mapOffY+row*CELL+f*SLOT;
          ctx.moveTo(px+4,py); ctx.lineTo(px+CELL-4,py);
        }
      }
      ctx.stroke();
    }
    // תוויות קומה — ממורכזות בתוך כל פס
    if(SHOW_FLOOR_LABELS){
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.font=`bold ${Math.min(11,SLOT*0.55)}px Heebo`;
      for(let f=0; f<3; f++){
        ctx.fillStyle=floorLabels[f];
        for(let row=startRow; row<=endRow; row++){
          for(let col=startCol; col<=endCol; col++){
            const px=mapOffX+col*CELL, py=mapOffY+row*CELL+f*SLOT;
            ctx.fillText(f+1, px+CELL/2, py+SLOT/2);
          }
        }
      }
    }
  }

  // מסגרות תאים — pass יחיד (beginPath + stroke אחד)
  ctx.strokeStyle='rgba(245,166,35,0.22)'; ctx.lineWidth=1;
  ctx.beginPath();
  for(let row=startRow; row<=endRow; row++){
    for(let col=startCol; col<=endCol; col++){
      const px=mapOffX+col*CELL, py=mapOffY+row*CELL;
      ctx.rect(px+0.5,py+0.5,CELL-1,CELL-1);
    }
  }
  ctx.stroke();

  // קירות שמורים
  walls.forEach(w=>{
    const[x1,y1]=w2c(w.x1,w.y1),[x2,y2]=w2c(w.x2,w.y2);
    // צל
    ctx.shadowColor='rgba(74,158,255,0.3)';ctx.shadowBlur=4;
    ctx.strokeStyle='#4a9eff';ctx.lineWidth=4;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    ctx.shadowBlur=0;
    // נקודות קצה
    [x1,y1,x2,y2].forEach((v,i,a)=>{
      if(i%2===0){ctx.fillStyle='#7ac8ff';ctx.beginPath();ctx.arc(a[i],a[i+1],4,0,Math.PI*2);ctx.fill();}
    });
  });

  // preview קיר בציור
  if(mapTool==='wall'&&isDrawing&&drawStart&&drawCurrent){
    const[x1,y1]=w2c(drawStart[0],drawStart[1]);
    const[x2,y2]=w2c(drawCurrent[0],drawCurrent[1]);
    const len=Math.hypot(drawCurrent[0]-drawStart[0],drawCurrent[1]-drawStart[1]).toFixed(1);
    ctx.strokeStyle='rgba(74,158,255,0.6)';ctx.lineWidth=3;ctx.setLineDash([6,4]);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    ctx.setLineDash([]);
    // אורך
    ctx.fillStyle='#4a9eff';ctx.font='bold 11px Heebo';ctx.textAlign='center';
    ctx.fillText(len+'מ',(x1+x2)/2,(y1+y2)/2-8);
  }

  // ── הדגשת תאי יעד בגרירה (מגנט) ──
  if(dragCageId !== null){
    const targets = selectedCages.length > 0 ? selectedCages : [dragCageId];
    targets.forEach(id=>{
      const g=cages.find(c=>c.id===id);
      if(!g) return;
      const[hx,hy]=w2c(g.x,g.y);
      // זוהר ירוק-צהוב מתחת לכלוב
      ctx.fillStyle='rgba(245,166,35,0.14)';
      ctx.fillRect(hx,hy,CELL,CELL);
      // מסגרת מנוקדת בולטת
      ctx.strokeStyle='rgba(245,166,35,0.85)';
      ctx.lineWidth=2;
      ctx.setLineDash([6,3]);
      ctx.strokeRect(hx+1,hy+1,CELL-2,CELL-2);
      ctx.setLineDash([]);
      // נקודות פינה (סימון רישות)
      const d=6;
      ctx.strokeStyle='#f5a623';
      ctx.lineWidth=2;
      [[hx,hy],[hx+CELL,hy],[hx,hy+CELL],[hx+CELL,hy+CELL]].forEach(([px,py])=>{
        ctx.beginPath();
        ctx.moveTo(px-d,py); ctx.lineTo(px+d,py);
        ctx.moveTo(px,py-d); ctx.lineTo(px,py+d);
        ctx.stroke();
      });
    });
  }

  // כלובים — מסנן לפי אזור ושכבה
  const _sectionPrefixes = {
    'מחסן': ['מי.','מש.'],
    'פניה1': ['פ1ש.','פ1י.'],
    'פניה2': ['פ2י.','פ2ש.']
  };
  const _allKnownPrefixes = ['מי.','מש.','פ1ש.','פ1י.','פ2י.','פ2ש.'];
  const visibleCages = cages.filter(g=>{
    if(mapSection && _sectionPrefixes[mapSection]){
      const hasKnownPrefix = _allKnownPrefixes.some(p=>String(g.name).startsWith(p));
      // כלוב ידני (ללא קידומת מוכרת) — מוצג תמיד
      if(hasKnownPrefix && !_sectionPrefixes[mapSection].some(p=>String(g.name).startsWith(p))) return false;
    }
    if(mapFloorFilter!==0 && String(g.floor)!==String(mapFloorFilter)) return false;
    return true;
  });
  visibleCages.forEach(g=>{
    const[cx,cy]=w2c(g.x,g.y);
    const pw=mapScale,ph=mapScale;
    // clip — אל תצייר כלובים מחוץ לוויאפורט
    if(cx+pw<0||cx>cv.width||cy+ph<0||cy>cv.height) return;
    const isSel=g.id===selectedCageId;
    const cnt=(_dmTotalCount?_dmTotalCount.get(String(g.name)):0)||0;
    const hasItems=cnt>0;
    const isBlink=whBlinkCols.size>0&&whBlinkCols.has(String(g.name));
    const blinkOn=isBlink&&Math.floor(Date.now()/350)%2===0;

    // צל
    const isMultiSel2=selectedCages.includes(g.id)&&g.id!==selectedCageId;
    if(isSel){ctx.shadowColor='#f5a623';ctx.shadowBlur=14;}
    else if(isMultiSel2){ctx.shadowColor='#7ac8ff';ctx.shadowBlur=10;}
    else if(hasItems){ctx.shadowColor='rgba(62,207,142,0.3)';ctx.shadowBlur=6;}

    // שקיפות לפי שכבה
    const floorMatch = mapFloorFilter===0 || String(g.floor)===String(mapFloorFilter);
    ctx.globalAlpha = floorMatch ? 1 : 0.25;

    // רקע — צבע לפי קומה
    const _fClr={'1':['rgba(50,120,255,0.65)','rgba(30,80,180,0.80)'],
                 '2':['rgba(40,200,120,0.65)','rgba(20,140,80,0.80)'],
                 '3':['rgba(245,150,30,0.65)','rgba(190,110,10,0.80)']};
    const _fc=_fClr[String(g.floor||'1')]||_fClr['1'];
    const grad=ctx.createLinearGradient(cx,cy,cx,cy+ph);
    grad.addColorStop(0,_fc[0]);
    grad.addColorStop(1,_fc[1]);
    ctx.fillStyle=grad;
    const _fStroke={'1':'#4a9eff','2':'#3ecf8e','3':'#f5a623'};
    const _baseStroke=_fStroke[String(g.floor||'1')]||'#4a9eff';
    ctx.strokeStyle=isSel?'#ffffff':isMultiSel2?'#ffffff':_baseStroke;
    ctx.lineWidth=isSel?2.5:1.5;

    const r=6;
    ctx.beginPath();
    ctx.moveTo(cx+r,cy);ctx.lineTo(cx+pw-r,cy);
    ctx.quadraticCurveTo(cx+pw,cy,cx+pw,cy+r);
    ctx.lineTo(cx+pw,cy+ph-r);
    ctx.quadraticCurveTo(cx+pw,cy+ph,cx+pw-r,cy+ph);
    ctx.lineTo(cx+r,cy+ph);
    ctx.quadraticCurveTo(cx,cy+ph,cx,cy+ph-r);
    ctx.lineTo(cx,cy+r);
    ctx.quadraticCurveTo(cx,cy,cx+r,cy);
    ctx.closePath();ctx.fill();ctx.stroke();
    ctx.shadowBlur=0;

    // הבהוב כלוב מחיפוש
    if(isBlink){
      ctx.globalAlpha=blinkOn?0.7:0.15;
      ctx.fillStyle='#ffd700';
      ctx.shadowColor='#ffd700'; ctx.shadowBlur=blinkOn?24:0;
      const rb=6;
      ctx.beginPath();
      ctx.moveTo(cx+rb,cy);ctx.lineTo(cx+pw-rb,cy);
      ctx.quadraticCurveTo(cx+pw,cy,cx+pw,cy+rb);
      ctx.lineTo(cx+pw,cy+ph-rb);
      ctx.quadraticCurveTo(cx+pw,cy+ph,cx+pw-rb,cy+ph);
      ctx.lineTo(cx+rb,cy+ph);
      ctx.quadraticCurveTo(cx,cy+ph,cx,cy+ph-rb);
      ctx.lineTo(cx,cy+rb);
      ctx.quadraticCurveTo(cx,cy,cx+rb,cy);
      ctx.closePath();ctx.fill();
      ctx.shadowBlur=0;
      ctx.globalAlpha=1;
    }

    // שם עמודה
    const isMultiSel=selectedCages.includes(g.id)&&g.id!==selectedCageId;
    ctx.fillStyle=isSel?'#f5a623':isMultiSel?'#7ac8ff':hasItems?'#3ecf8e':'#aab0c8';
    const fs=Math.min(15,pw/2.2);
    ctx.font=`bold ${fs}px Heebo`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(g.name||'',cx+pw/2,cy+ph/2);

    // קומה
    if(g.floor){
      ctx.fillStyle='#4a9eff';ctx.font='9px Heebo';
      ctx.fillText('קו׳'+g.floor,cx+pw/2,cy+ph/2+8);
    }

    // badge פריטים
    if(hasItems){
      ctx.fillStyle='#3ecf8e';
      ctx.beginPath();ctx.arc(cx+pw-6,cy+6,8,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#0a0c12';ctx.font='bold 9px Heebo';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(cnt,cx+pw-6,cy+6);
    }

    // מידות כלוב (פינה תחתון-שמאל)
    ctx.fillStyle='rgba(100,110,140,0.6)';ctx.font='7px Heebo';ctx.textAlign='left';ctx.textBaseline='bottom';
    if(pw>32){ const dim=g.rot?'0.6מ×1.2מ':'1.2מ×0.6מ'; ctx.fillText(dim,cx+2,cy+ph-1); }
  });


  // ── תוויות טקסט על המפה ──
  mapLabels.forEach(lbl=>{
    const lx=lbl.wx*CELL+mapOffX, ly=lbl.wy*CELL+mapOffY;
    if(lx<-200||lx>cv.width+200||ly<-40||ly>cv.height+40) return;
    ctx.globalAlpha=1;
    const fs=Math.round((lbl.fontSize||16)*Math.min(2,Math.max(0.5,CELL/40)));
    ctx.font=`bold ${fs}px Heebo`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,0.95)'; ctx.shadowBlur=8;
    ctx.fillStyle=lbl.color||'#ffffff';
    ctx.fillText(lbl.text, lx, ly);
    ctx.shadowBlur=0;
    if(mapTool==='text'){
      ctx.strokeStyle='rgba(245,166,35,0.7)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
      const m=ctx.measureText(lbl.text);
      ctx.strokeRect(lx-m.width/2-4, ly-fs/2-3, m.width+8, fs+6);
      ctx.setLineDash([]);
    }
  });

  // ── מצפן צפון (פינה ימנית-עליונה, מתחת למיני-מפה) ──
  {
    const CX=cv.width-14, CY=cages.length>0?88:14;
    const CR=11;
    ctx.globalAlpha=0.85;
    ctx.fillStyle='rgba(8,10,16,0.82)';
    ctx.beginPath();ctx.arc(CX,CY,CR+3,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(245,166,35,0.4)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(CX,CY,CR+3,0,Math.PI*2);ctx.stroke();
    // חץ צפון (אדום)
    ctx.fillStyle='#e85d3f';
    ctx.beginPath();ctx.moveTo(CX,CY-CR);ctx.lineTo(CX-4,CY+2);ctx.lineTo(CX+4,CY+2);ctx.closePath();ctx.fill();
    // חץ דרום (אפור)
    ctx.fillStyle='rgba(120,130,160,0.7)';
    ctx.beginPath();ctx.moveTo(CX,CY+CR);ctx.lineTo(CX-4,CY-2);ctx.lineTo(CX+4,CY-2);ctx.closePath();ctx.fill();
    // N
    ctx.fillStyle='#eef0f6';ctx.font='bold 8px Heebo';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('N',CX,CY-CR-7);
    ctx.globalAlpha=1;
  }

  // ── Rubber-band selection overlay ──
  if(isRubberBand&&rubberStart&&rubberCurrent){
    const[rx1w,ry1w]=[Math.min(rubberStart[0],rubberCurrent[0]),Math.min(rubberStart[1],rubberCurrent[1])];
    const[rx2w,ry2w]=[Math.max(rubberStart[0],rubberCurrent[0]),Math.max(rubberStart[1],rubberCurrent[1])];
    const[rx1,ry1]=w2c(rx1w,ry1w),[rx2,ry2]=w2c(rx2w,ry2w);
    ctx.fillStyle='rgba(74,158,255,0.07)';
    ctx.fillRect(rx1,ry1,rx2-rx1,ry2-ry1);
    ctx.strokeStyle='rgba(74,158,255,0.8)';
    ctx.lineWidth=1.5;
    ctx.setLineDash([5,3]);
    ctx.strokeRect(rx1,ry1,rx2-rx1,ry2-ry1);
    ctx.setLineDash([]);
  }

  // ── מיני-מפה (פינה ימנית-עליונה) ──
  if(cages.length>0){
    const MM_W=110,MM_H=70,MM_PAD=8;
    const MM_X=cv.width-MM_W-MM_PAD, MM_Y=MM_PAD;
    ctx.globalAlpha=1;
    ctx.fillStyle='rgba(10,12,18,0.88)';
    ctx.strokeStyle='rgba(245,166,35,0.35)';
    ctx.lineWidth=1;
    ctx.fillRect(MM_X,MM_Y,MM_W,MM_H);
    ctx.strokeRect(MM_X,MM_Y,MM_W,MM_H);
    // חשב גבולות כל הכלובים
    let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
    cages.forEach(g=>{mnX=Math.min(mnX,g.x);mnY=Math.min(mnY,g.y);mxX=Math.max(mxX,g.x+1);mxY=Math.max(mxY,g.y+1);});
    const bw=mxX-mnX||1,bh=mxY-mnY||1;
    const mmS=Math.min((MM_W-8)/bw,(MM_H-8)/bh);
    const mmOX=MM_X+4-mnX*mmS, mmOY=MM_Y+4-mnY*mmS;
    // ציור כלובים
    cages.forEach(g=>{
      const mw=Math.max(mmS,2),mh=Math.max(mmS,2);
      const mx=g.x*mmS+mmOX,my=g.y*mmS+mmOY;
      const iS=g.id===selectedCageId||selectedCages.includes(g.id);
      const hI=(_dmTotalCount?_dmTotalCount.get(String(g.name)):0)>0;
      ctx.fillStyle=iS?'#f5a623':hI?'#3ecf8e':'#2a4070';
      ctx.fillRect(mx,my,mw,mh);
    });
    // מלבן viewport
    const vx=-mapOffX/mapScale*mmS+mmOX, vy=-mapOffY/mapScale*mmS+mmOY;
    const vw=cv.width/mapScale*mmS, vh=cv.height/mapScale*mmS;
    ctx.strokeStyle='rgba(245,166,35,0.7)';
    ctx.lineWidth=1;
    ctx.setLineDash([2,2]);
    ctx.strokeRect(vx,vy,vw,vh);
    ctx.setLineDash([]);
    // כותרת
    ctx.fillStyle='rgba(245,166,35,0.5)';
    ctx.font='7px Heebo';ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText('מפה',MM_X+2,MM_Y+2);
  }

  // ── סרגל ציר (overlay קבוע — תמיד נראה) ──
  const RULER = 44;
  const labelStep = Math.max(1, Math.ceil(22 / CELL)); // דלג תוויות כשצפוף

  const rStartCol = Math.max(0, Math.floor(-mapOffX / CELL));
  const rEndCol   = rStartCol + Math.ceil(cv.width  / CELL) + 1;
  const rStartRow = Math.max(0, Math.floor(-mapOffY / CELL));
  const rEndRow   = rStartRow + Math.ceil(cv.height / CELL) + 1;

  // רקע סרגל עליון
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(8,10,16,0.97)';
  ctx.fillRect(0, 0, cv.width, RULER);
  // רקע סרגל שמאלי
  ctx.fillRect(0, RULER, RULER, cv.height - RULER);

  const RULER_R = 44;

  // רקע סרגל ימני
  ctx.fillStyle = 'rgba(8,10,16,0.97)';
  ctx.fillRect(cv.width - RULER_R, RULER, RULER_R, cv.height - RULER);

  // ── עמודות (סרגל עליון) — tick + תווית מותאמת אישית ──
  ctx.textBaseline = 'middle';
  for(let col = rStartCol; col <= rEndCol; col++){
    if(col % labelStep !== 0) continue;
    const centerX = mapOffX + col * CELL + CELL / 2;
    if(centerX < RULER + 4 || centerX > cv.width - RULER_R - 2) continue;
    ctx.fillStyle = col % 2 === 0 ? 'rgba(245,166,35,0.07)' : 'rgba(245,166,35,0.03)';
    ctx.fillRect(mapOffX + col * CELL, 0, CELL, RULER);
    ctx.strokeStyle = 'rgba(245,166,35,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mapOffX + col * CELL + 0.5, RULER - 6);
    ctx.lineTo(mapOffX + col * CELL + 0.5, RULER);
    ctx.stroke();
    const lbl = colLabels[col];
    if(lbl){ ctx.font='bold 13px Heebo'; ctx.fillStyle='#f5a623'; ctx.textAlign='center'; ctx.fillText(lbl, centerX, RULER/2); }
  }

  // ── שורות (סרגל שמאל + ימין) — tick + תווית מותאמת אישית ──
  ctx.textBaseline = 'middle';
  for(let row = rStartRow; row <= rEndRow; row++){
    if(row < 0) continue;
    const centerY = mapOffY + row * CELL + CELL / 2;
    if(centerY < RULER + 4 || centerY > cv.height - 2) continue;
    const rowY = mapOffY + row * CELL;
    ctx.fillStyle = 'rgba(74,158,255,0.06)';
    ctx.fillRect(0, rowY, RULER, CELL);
    ctx.fillRect(cv.width - RULER_R, rowY, RULER_R, CELL);
    ctx.strokeStyle = 'rgba(74,158,255,0.3)'; ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(RULER-6, rowY+0.5); ctx.lineTo(RULER, rowY+0.5);
    ctx.moveTo(cv.width-RULER_R, rowY+0.5); ctx.lineTo(cv.width-RULER_R+6, rowY+0.5);
    ctx.stroke();
    const lbl = rowLabels[row];
    if(lbl){
      ctx.font='bold 13px Heebo'; ctx.fillStyle='#7ac8ff'; ctx.textAlign='center';
      ctx.fillText(lbl, RULER/2, centerY);
      ctx.fillText(lbl, cv.width-RULER_R/2, centerY);
    }
  }

  // קווי גבול סרגלים
  ctx.strokeStyle = 'rgba(245,166,35,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, RULER + 0.5);              ctx.lineTo(cv.width, RULER + 0.5);
  ctx.moveTo(RULER + 0.5, 0);              ctx.lineTo(RULER + 0.5, cv.height);
  ctx.moveTo(cv.width - RULER_R + 0.5, 0); ctx.lineTo(cv.width - RULER_R + 0.5, cv.height);
  ctx.stroke();

  // פינה שמאל-עליון
  ctx.fillStyle = '#080a10';
  ctx.fillRect(0, 0, RULER, RULER);
  ctx.fillStyle = 'rgba(245,166,35,0.35)';
  ctx.font = '9px Heebo';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('↕↔', RULER / 2, RULER / 2);

  // פינה ימין-עליון
  ctx.fillStyle = '#080a10';
  ctx.fillRect(cv.width - RULER_R, 0, RULER_R, RULER);
  ctx.fillStyle = 'rgba(74,158,255,0.3)';
  ctx.font = '9px Heebo';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('↕', cv.width - RULER_R / 2, RULER / 2);
  // עדכן מיקום tooltip קומה אחרי כל ציור (pan/zoom)
  if(selectedCageId) _updateFloorTooltip();
}

function pushHistory(){
  mapHistory.push({cages:JSON.stringify(cages),walls:JSON.stringify(walls)});
  if(mapHistory.length>30) mapHistory.shift();
  mapRedoHistory=[];
  _scheduleAutoSave();
}

function undoMap(){
  if(!mapHistory.length){toast('אין מה לבטל');return;}
  mapRedoHistory.push({cages:JSON.stringify(cages),walls:JSON.stringify(walls)});
  const prev=mapHistory.pop();
  cages=JSON.parse(prev.cages);walls=JSON.parse(prev.walls);
  drawMap();toast('↩️ בוטל');
}

function redoMap(){
  if(!mapRedoHistory.length){toast('אין מה לחזור');return;}
  mapHistory.push({cages:JSON.stringify(cages),walls:JSON.stringify(walls)});
  const next=mapRedoHistory.pop();
  cages=JSON.parse(next.cages);walls=JSON.parse(next.walls);
  drawMap();toast('↪️ חזרה');
}

// ── הרחבה אוטומטית — מושבתת (גרמה לכלובים עודפים שנשמרו) ──
function autoExpandCages(){ }

function _scheduleAutoSave(){
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer=setTimeout(()=>{
    localStorage.setItem('tirewms_map2',JSON.stringify({cages,walls,nextId:nextCageId,colLabels,rowLabels,mapLabels,nextLabelId}));
    const h=document.getElementById('mapHint');
    if(h){ const old=h.textContent; h.textContent='💾 נשמר אוטומטית'; setTimeout(()=>{if(h.textContent==='💾 נשמר אוטומטית')h.textContent=old;},1500); }
  },2000);
}

function duplicateCage(){
  if(!selectedCageId){toast('בחר כלוב תחילה');return;}
  const g=cages.find(c=>c.id===selectedCageId);
  if(!g) return;
  const nx=g.x+1, ny=g.y;
  if(_cageOccupied(nx,ny,g.floor||'1')){ toast('❌ יש כלוב בעמדה הסמוכה — הזז ידנית'); return; }
  pushHistory();
  const id=nextCageId++;
  const copy={...g,id,x:nx,y:ny};
  cages.push(copy);
  selectedCageId=id; selectedCages=[id];
  drawMap();
  toast('📋 כלוב שוכפל — Ctrl+D');
}

function openRowPanel(){
  const p=document.getElementById('rowPanel');
  if(p) p.style.display='block';
  const inp=document.getElementById('rowPanelCount');
  if(inp){ inp.focus(); inp.select(); }
}
function closeRowPanel(){ const p=document.getElementById('rowPanel'); if(p) p.style.display='none'; }
function confirmRowPanel(){
  const num=parseInt(document.getElementById('rowPanelCount').value)||0;
  const startNum=parseInt(document.getElementById('rowPanelStart').value)||1;
  const dir=document.getElementById('rowPanelDir').value;
  const fl=document.getElementById('rowPanelFloor').value;
  if(num<1||num>50){ toast('❌ כמות לא חוקית (1–50)'); return; }
  pushHistory();
  const baseX=Math.max(0,Math.floor(_rowClickWx));
  const baseY=Math.max(0,Math.floor(_rowClickWy));
  let added=0, skipped=0;
  for(let i=0;i<num;i++){
    const id=nextCageId++;
    let x=baseX, y=baseY;
    if(dir==='hr') x=baseX+i;
    else if(dir==='hl') x=Math.max(0,baseX-i);
    else if(dir==='v')  y=baseY+i;
    if(_cageOccupied(x,y,fl)){ skipped++; continue; }
    cages.push({id,name:String(startNum+i),floor:fl,x,y,rot:false});
    added++;
  }
  closeRowPanel();
  drawMap();
  if(skipped>0) toast(`✅ נוספו ${added} כלובים — ${skipped} דולגו (תפוסים)`);
  else toast(`✅ נוספה שורה של ${added} כלובים (${startNum}–${startNum+added-1})`);
}

function onWheel(e){
  e.preventDefault();
  const cv=document.getElementById('mapCanvas');
  if(!cv) return;
  const r=cv.getBoundingClientRect();
  const mx=e.clientX-r.left, my=e.clientY-r.top;
  const factor=e.deltaY<0?1.15:0.87;
  // זום ממורכז על מיקום הסמן
  const wx=(mx-mapOffX)/mapScale;
  const wy=(my-mapOffY)/mapScale;
  mapScale=Math.max(10,Math.min(100,mapScale*factor));
  mapOffX=mx-wx*mapScale;
  mapOffY=my-wy*mapScale;
  autoExpandCages();
  drawMap();
}

function onMapKey(e){
  const view=document.getElementById('viewMapEditor');
  if(!view||!view.classList.contains('active')) return;
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT') return;
  _shiftDown=e.shiftKey;
  switch(e.key){
    case 'w': case 'W': if(!e.ctrlKey&&!e.metaKey) setMapTool('wall'); break;
    case 'p': case 'P': if(!e.ctrlKey&&!e.metaKey) setMapTool('pan'); break;
    case 'c': case 'C': if(!e.ctrlKey&&!e.metaKey) setMapTool('cage'); break;
    case 'm': case 'M': if(!e.ctrlKey&&!e.metaKey) setMapTool('move'); break;
    case 's': case 'S': if(!e.ctrlKey&&!e.metaKey) setMapTool('select'); break;
    case 'r': case 'R':
      if(e.ctrlKey||e.metaKey){ e.preventDefault(); redoMap(); }
      else rotateCage();
      break;
    case 'z': case 'Z':
      if(e.ctrlKey||e.metaKey){ e.preventDefault(); e.shiftKey?redoMap():undoMap(); }
      break;
    case 'y': case 'Y':
      if(e.ctrlKey||e.metaKey){ e.preventDefault(); redoMap(); }
      break;
    case 'd': case 'D':
      if(e.ctrlKey||e.metaKey){ e.preventDefault(); duplicateCage(); }
      break;
    case 'Delete': case 'Backspace':
      if(selectedCages.length>1){
        const cnt=selectedCages.length;
        pushHistory();
        cages=cages.filter(c=>!selectedCages.includes(c.id));
        selectedCages=[]; selectedCageId=null; closeCageEdit(); drawMap();
        toast(`🗑️ נמחקו ${cnt} כלובים`);
      } else if(selectedCageId){
        pushHistory();
        cages=cages.filter(c=>c.id!==selectedCageId);
        selectedCageId=null; selectedCages=[]; closeCageEdit(); drawMap();
      }
      break;
    case ' ':
      e.preventDefault();
      spaceDown=true;
      const cv2=document.getElementById('mapCanvas');
      if(cv2) cv2.style.cursor='grab';
      break;
    case 'Escape':
      selectedCages=[]; selectedCageId=null; closeCageEdit(); drawMap();
      break;
  }
}
function onMapKeyUp(e){
  _shiftDown=e.shiftKey;
  if(e.key===' '){
    spaceDown=false; isPanning=false;
    const cv=document.getElementById('mapCanvas');
    if(cv) cv.style.cursor=mapTool==='move'?'grab':mapTool==='erase'?'cell':'crosshair';
  }
}

function _cageOccupied(x,y,floor,excludeId){
  return cages.find(g=>g.id!==excludeId&&g.x===x&&g.y===y&&String(g.floor||'1')===String(floor||'1'));
}
function _deduplicateCages(){
  const seen=new Set(), dupes=[];
  cages.forEach(g=>{
    const k=`${g.x}|${g.y}|${g.floor||'1'}`;
    if(seen.has(k)) dupes.push(g.id); else seen.add(k);
  });
  if(!dupes.length) return 0;
  cages=cages.filter(g=>!dupes.includes(g.id));
  return dupes.length;
}
function addCage(){
  setMapTool('cage');
  toast('📦 לחץ על המפה למיקום הכלוב');
}
function addCageAtCenter(){
  const cv=document.getElementById('mapCanvas');
  if(!cv) return;
  const[wx,wy]=c2w(cv.width/2,cv.height/2);
  const nx=Math.max(0,Math.floor(wx)), ny=Math.max(0,Math.floor(wy));
  if(_cageOccupied(nx,ny,'1')){
    toast('❌ יש כלוב במיקום זה — הזז מעט את המפה ונסה שוב');
    return;
  }
  pushHistory();
  const id=nextCageId++;
  const g={id,name:String(id),floor:'1',x:nx,y:ny,rot:false};
  cages.push(g);
  selectedCageId=id; selectedCages=[id];
  drawMap();
  openCageEdit(g);
}
window.addCageAtCenter=addCageAtCenter;

function _updateFloorTooltip(){
  const g=selectedCageId?cages.find(c=>c.id===selectedCageId):null;
  const tip=document.getElementById('cageFloorTooltip');
  if(!tip) return;
  if(!g||(mapTool!=='move'&&mapTool!=='select')){tip.style.display='none';return;}
  const cv=document.getElementById('mapCanvas');
  if(!cv){tip.style.display='none';return;}
  const r=cv.getBoundingClientRect();
  const[cx,cy]=w2c(g.x,g.y);
  const tipW=130,tipH=42;
  let left=r.left+cx+mapScale/2-tipW/2;
  let top=r.top+cy-tipH-10;
  if(top<4) top=r.top+cy+mapScale+10;
  tip.style.left=Math.max(4,Math.min(window.innerWidth-tipW-4,left))+'px';
  tip.style.top=Math.max(4,Math.min(window.innerHeight-tipH-4,top))+'px';
  tip.style.display='flex';
  const lbl=document.getElementById('cageFloorLabel');
  if(lbl) lbl.textContent='קו׳'+(g.floor||'1');
}
function changeCageFloor(delta){
  const g=selectedCageId?cages.find(c=>c.id===selectedCageId):null;
  if(!g) return;
  const floors=['1','2','3'];
  const next=Math.max(0,Math.min(floors.length-1,floors.indexOf(String(g.floor||'1'))+delta));
  g.floor=floors[next];
  const flEl=document.getElementById('cageEditFloor');
  if(flEl) flEl.value=g.floor;
  _scheduleAutoSave(); drawMap(); _updateFloorTooltip();
}
function openCageEdit(g){
  document.getElementById('cageEditName').value=g.name||'';
  document.getElementById('cageEditFloor').value=g.floor||'1';
  document.getElementById('cageEditPn1').value=g.pn1||'';
  document.getElementById('cageEditP1').value=g.p1||'';
  document.getElementById('cageEditPn2').value=g.pn2||'';
  document.getElementById('cageEditP2').value=g.p2||'';
  document.getElementById('cageEditPanel').style.display='block';
  _updateFloorTooltip();
}
function closeCageEdit(){
  document.getElementById('cageEditPanel').style.display='none';
  const tip=document.getElementById('cageFloorTooltip');
  if(tip) tip.style.display='none';
}
function saveCageEdit(){
  const g=cages.find(c=>c.id===selectedCageId);
  if(g){
    const newFloor=document.getElementById('cageEditFloor').value||'1';
    const conflict=_cageOccupied(g.x,g.y,newFloor,g.id);
    if(conflict){ toast(`❌ יש כלוב "${conflict.name}" בקומה ${newFloor} במיקום זה`); return; }
    g.name=document.getElementById('cageEditName').value;
    g.floor=newFloor;
    g.pn1=document.getElementById('cageEditPn1').value;
    g.p1=document.getElementById('cageEditP1').value;
    g.pn2=document.getElementById('cageEditPn2').value;
    g.p2=document.getElementById('cageEditP2').value;
  }
  closeCageEdit();drawMap();_scheduleAutoSave();
}
function rotateCage(){
  const g=cages.find(c=>c.id===selectedCageId);
  if(g){g.rot=!g.rot;drawMap();}
}

// ── סיבוב קבוצת כלובים סביב מרכז הבלוק שלהם ──
// deg = 90 (שמאלה CCW), 180, או 270 (ימינה)
function rotateSelection(deg){
  // בחר יעד: כלובים נבחרים → או הכל אם אין בחירה
  let targetIds = selectedCages.length>0 ? [...selectedCages]
                 : selectedCageId ? [selectedCageId]
                 : cages.map(c=>c.id);
  if(targetIds.length===0){ toast('אין כלובים לסיבוב'); return; }
  const targets = targetIds.map(id=>cages.find(c=>c.id===id)).filter(Boolean);
  if(!targets.length) return;
  pushHistory();
  // bounding box
  const xs=targets.map(g=>g.x), ys=targets.map(g=>g.y);
  const minX=Math.min(...xs), minY=Math.min(...ys);
  const maxX=Math.max(...xs), maxY=Math.max(...ys);
  const W=maxX-minX, H=maxY-minY;
  targets.forEach(g=>{
    const lx=g.x-minX, ly=g.y-minY;
    let nx,ny;
    if(deg===90){       // CCW
      nx=minX+ly; ny=minY+(W-lx);
      g.rot=!g.rot;
    } else if(deg===270){ // CW
      nx=minX+(H-ly); ny=minY+lx;
      g.rot=!g.rot;
    } else {              // 180
      nx=minX+(W-lx); ny=minY+(H-ly);
    }
    g.x=Math.max(0,nx); g.y=Math.max(0,ny);
  });
  if(typeof _dmInvalidate==='function') _dmInvalidate();
  if(typeof _whInvalidate==='function') _whInvalidate();
  drawMap();
  const label = deg===90?'↺ 90° שמאלה' : deg===270?'↻ 90° ימינה' : '⟲ 180°';
  toast(`${label} · ${targets.length} כלובים`);
}
window.rotateSelection = rotateSelection;

// ── מחיקת קבוצת כלובים נבחרת ──
function deleteSelection(){
  const ids = selectedCages.length>0 ? [...selectedCages]
            : selectedCageId ? [selectedCageId] : [];
  if(ids.length===0){ toast('אין בחירה — גרור מלבן בחירה עם "✋ הזז" כדי לבחור כלובים'); return; }
  if(!confirm(`למחוק ${ids.length} כלובים?`)) return;
  pushHistory();
  cages = cages.filter(c=>!ids.includes(c.id));
  selectedCages=[]; selectedCageId=null; closeCageEdit();
  if(typeof _dmInvalidate==='function') _dmInvalidate();
  if(typeof _whInvalidate==='function') _whInvalidate();
  drawMap();
  toast(`🗑️ נמחקו ${ids.length} כלובים`);
}
window.deleteSelection = deleteSelection;
function deleteCage(){
  if(!confirm('למחוק כלוב זה?'))return;
  pushHistory();
  cages=cages.filter(c=>c.id!==selectedCageId);
  selectedCageId=null;closeCageEdit();drawMap();
}
// ── תוויות מפה ──
let _pendingLabelCtx=null;
function _openLabelEditor(sx, sy, title, existingText, ctx){
  _pendingLabelCtx=ctx;
  const dlg=document.getElementById('mapLabelInput');
  const inp=document.getElementById('mapLabelText');
  const ttl=document.getElementById('mapLabelTitle');
  if(!dlg||!inp) return;
  if(ttl) ttl.textContent=title;
  inp.value=existingText||'';
  const w=220,h=120;
  let left=sx-w/2, top=sy+8;
  left=Math.max(4,Math.min(window.innerWidth-w-4,left));
  top=Math.max(4,Math.min(window.innerHeight-h-4,top));
  dlg.style.left=left+'px'; dlg.style.top=top+'px';
  dlg.style.display='block';
  // show/hide direction buttons
  const dirRow=document.getElementById('mapLabelDirRow');
  const dirCol=document.getElementById('mapLabelDirCol');
  const dirRowBtns=document.getElementById('mapLabelDirRowBtns');
  const dirAll=document.getElementById('mapLabelDirAll');
  if(dirRow){
    if(ctx.type==='col'){
      dirRow.style.display='flex';
      if(dirCol) dirCol.style.display='flex';
      if(dirRowBtns) dirRowBtns.style.display='none';
      if(dirAll) dirAll.style.display='none';
    } else if(ctx.type==='row'){
      dirRow.style.display='flex';
      if(dirCol) dirCol.style.display='none';
      if(dirRowBtns) dirRowBtns.style.display='flex';
      if(dirAll) dirAll.style.display='none';
    } else if(ctx.type==='auto'){
      dirRow.style.display='flex';
      if(dirCol) dirCol.style.display='none';
      if(dirRowBtns) dirRowBtns.style.display='none';
      if(dirAll) dirAll.style.display='flex';
    } else {
      dirRow.style.display='none';
      if(dirAll) dirAll.style.display='none';
    }
  }
  setTimeout(()=>{inp.focus();inp.select();},50);
}
function confirmMapLabel(){
  const inp=document.getElementById('mapLabelText');
  const text=(inp?.value||'').trim();
  if(_pendingLabelCtx){
    const{type,key}=_pendingLabelCtx;
    if(type==='col'){
      if(text){
        colLabels[key]=text;
        cages.forEach(g=>{ if(Math.floor(g.x)===key) g.name=text; });
        const num=parseInt(text,10);
        if(!isNaN(num)&&String(num)===text){
          const dir=window._labelFillDir||'right';
          const step=dir==='left'?-1:1;
          const xs=cages.map(g=>Math.floor(g.x));
          const limit=dir==='left'?Math.min(...xs):Math.max(...xs);
          let n=num+1;
          for(let c=key+step;dir==='left'?c>=limit:c<=limit;c+=step){
            if(colLabels[c]!==undefined) break;
            const lbl=String(n++);
            colLabels[c]=lbl;
            cages.forEach(g=>{ if(Math.floor(g.x)===c) g.name=lbl; });
          }
        }
      } else delete colLabels[key];
    }
    else if(type==='row'){
      if(text){
        rowLabels[key]=text;
        cages.forEach(g=>{ if(Math.floor(g.y)===key) g.name=text; });
        const num=parseInt(text,10);
        if(!isNaN(num)&&String(num)===text){
          const dir=window._labelFillDir||'down';
          const step=dir==='up'?-1:1;
          const ys=cages.map(g=>Math.floor(g.y));
          const limit=dir==='up'?Math.min(...ys):Math.max(...ys);
          let n=num+1;
          for(let r=key+step;dir==='up'?r>=limit:r<=limit;r+=step){
            if(rowLabels[r]!==undefined) break;
            const lbl=String(n++);
            rowLabels[r]=lbl;
            cages.forEach(g=>{ if(Math.floor(g.y)===r) g.name=lbl; });
          }
        }
      } else delete rowLabels[key];
    }
    else if(type==='map-new'){ if(text) mapLabels.push({id:nextLabelId++,wx:key.wx,wy:key.wy,text,color:key.color||'#ffffff',fontSize:16}); }
    else if(type==='map-edit'){ const l=mapLabels.find(x=>x.id===key.id); if(l){ if(text) l.text=text; else mapLabels=mapLabels.filter(x=>x.id!==key.id); } }
    else if(type==='auto'){ if(text) mapLabels.push({id:nextLabelId++,wx:key.wx,wy:key.wy,text,color:'#ffffff',fontSize:16}); }
    _scheduleAutoSave(); drawMap();
  }
  document.getElementById('mapLabelInput').style.display='none';
  _pendingLabelCtx=null;
}
function deleteMapLabel(){
  if(_pendingLabelCtx){
    const{type,key}=_pendingLabelCtx;
    if(type==='col') delete colLabels[key];
    else if(type==='row') delete rowLabels[key];
    else if(type==='map-edit') mapLabels=mapLabels.filter(x=>x.id!==key.id);
    _scheduleAutoSave(); drawMap();
  }
  document.getElementById('mapLabelInput').style.display='none';
  _pendingLabelCtx=null;
}
function cancelMapLabel(){
  document.getElementById('mapLabelInput').style.display='none';
  _pendingLabelCtx=null;
}
window.confirmMapLabel=confirmMapLabel;
window.deleteMapLabel=deleteMapLabel;
window.cancelMapLabel=cancelMapLabel;
function confirmMapLabelDir(dir){
  window._labelFillDir=dir;
  if(_pendingLabelCtx && _pendingLabelCtx.type==='auto'){
    if(dir==='right'||dir==='left'){
      _pendingLabelCtx={type:'col',key:_pendingLabelCtx.col};
    } else {
      _pendingLabelCtx={type:'row',key:_pendingLabelCtx.row};
    }
  }
  confirmMapLabel();
  window._labelFillDir=null;
}
window.confirmMapLabelDir=confirmMapLabelDir;

function saveMapLayout(){
  const mapData={cages,walls,nextId:nextCageId,colLabels,rowLabels,mapLabels,nextLabelId};
  localStorage.setItem('tirewms_map2',JSON.stringify(mapData));
  if(window._saveMapLayout) window._saveMapLayout(mapData);
  else toast('✅ '+(currentLang==='ar'?'تم حفظ الخريطة!':'מפה נשמרה!'));
  if(document.getElementById('viewWarehouse')?.classList.contains('active')) renderWarehouse();
}
function clearAllRulerLabels(){
  if(!confirm('למחוק את כל תוויות הסרגל ולאפס שמות כלובים?'))return;
  colLabels={};rowLabels={};
  cages.forEach(g=>{ g.name=String(g.id); });
  _scheduleAutoSave();drawMap();toast('🗑️ תוויות הסרגל ושמות הכלובים אופסו');
}
window.clearAllRulerLabels=clearAllRulerLabels;
function clearCageNames(){
  if(!confirm('למחוק את כל שמות הכלובים?'))return;
  cages.forEach(g=>{ g.name=''; });
  _scheduleAutoSave();drawMap();toast('🗑️ שמות הכלובים נמחקו');
}
window.clearCageNames=clearCageNames;
function toggleMapMore(){
  const m=document.getElementById('mapMoreMenu');
  const btn=document.getElementById('btnMapMore');
  if(!m||!btn) return;
  const open=m.style.display==='none'||m.style.display==='';
  if(open){
    const r=btn.getBoundingClientRect();
    m.style.top=(r.bottom+4)+'px';
    m.style.left=Math.max(4,r.right-190)+'px';
    m.style.display='flex';
    setTimeout(()=>document.addEventListener('click',_closeMapMoreOutside,{once:true}),10);
  } else {
    m.style.display='none';
  }
}
function closeMapMore(){
  const m=document.getElementById('mapMoreMenu');
  if(m) m.style.display='none';
}
function _closeMapMoreOutside(e){
  const btn=document.getElementById('btnMapMore');
  const menu=document.getElementById('mapMoreMenu');
  if(menu&&btn&&!menu.contains(e.target)&&e.target!==btn) closeMapMore();
}
window.toggleMapMore=toggleMapMore;
window.closeMapMore=closeMapMore;
function clearMap(){
  if(!confirm('למחוק את כל המפה?'))return;
  cages=[];walls=[];nextCageId=1;selectedCageId=null;
  mapHistory=[];closeCageEdit();drawMap();
  localStorage.removeItem('tirewms_map2');toast('🗑️ המפה נוקתה');
}
/* INIT */
window.refreshDropdowns = refreshDropdowns;
window.renderTable = renderTable;
window._updateItems = function(newItems, newNextId){
  items = newItems;
  nextId = newNextId;
  if(typeof _whInvalidate==='function') _whInvalidate(); // בטל cache מפה (view)
  if(typeof _dmInvalidate==='function') _dmInvalidate(); // בטל cache עורך מפה
  refreshDropdowns();
  renderTable();
  if(typeof _updatePendingBadge==='function') _updatePendingBadge();
  // גיבוי אוטומטי ל-localStorage (מוצפן)
  if(newItems.length > 0){
    try{
      const payload = JSON.stringify({ts:Date.now(),items:newItems});
      if(window._enc) window._enc.set('tirewms_autobk', payload);
      else localStorage.setItem('tirewms_autobk', payload);
    }catch(e){}
  }
  // הצע שחזור אם אין פריטים אך יש גיבוי
  if(newItems.length === 0 && !window._restoreOffered){
    window._restoreOffered = true;
    (async()=>{
      try{
        const raw = window._enc ? await window._enc.get('tirewms_autobk') : localStorage.getItem('tirewms_autobk');
        const bk = JSON.parse(raw||'null');
        if(bk && bk.items && bk.items.length > 0){
          const d = new Date(bk.ts).toLocaleString('he-IL');
          setTimeout(()=>{
            if(items.length > 0) return;
            if(confirm(`🔄 נמצא גיבוי (${bk.items.length} פריטים, ${d}).\nלשחזר?`)){
              toast('⏳ משחזר...');
              window._importItems(bk.items).then(()=>toast(`✅ שוחזרו ${bk.items.length} פריטים`)).catch(e=>toast('❌ '+e.message));
            }
          }, 5000);
        }
      }catch(e){}
    })();
  }
};
window.addCage = addCage;
window.rotateCage = rotateCage;
function generateWarehouseLayout(silent){
  if(!silent && !confirm('פעולה זו תמחק את המפה הנוכחית ותייצר מפת מחסן חדשה לפי נתוני המחסן. להמשיך?')) return;
  if(!silent) pushMapHistory();
  cages=[]; walls=[]; nextCageId=1;
  let col=1;

  // Helper A: שורות רצות בכיוון Y (אוריינטציה רגילה)
  // side='right': עמודות → +x, שורות → +y
  // side='left' : עמודות הפוכות (col1 פנימי), שורות → +y
  function addRows(x0, y0, rowNums, cols, side, pn1val, pn2val, sec){
    rowNums.forEach((rowNum, ri) => {
      for(let c=0; c<cols; c++){
        const xPos = side==='right' ? x0+c : x0+(cols-1-c);
        for(let fl=1; fl<=3; fl++){
          cages.push({
            id: nextCageId++,
            name: String(c+1),
            floor: String(fl),
            x: xPos, y: y0+ri, rot: false,
            p1: side==='right' ? String(rowNum) : '',
            p2: side==='left'  ? String(rowNum) : '',
            pn1: pn1val||'', pn2: pn2val||'', section: sec||'',
          });
        }
      }
    });
  }

  // Helper B: שורות רצות בכיוון X — סיבוב 90° שמאלה
  // side='right': שורות → +x מ-x0, עמודות → +y מ-y0
  // side='left' : שורות → -x מ-x0(=6), עמודות → +y מ-y0
  function addRowsRot(x0, y0, rowNums, cols, side, pn1val, pn2val, sec){
    rowNums.forEach((rowNum, ri) => {
      for(let c=0; c<cols; c++){
        const xPos = side==='right' ? x0+ri : x0-ri;
        const yPos = y0+c;
        for(let fl=1; fl<=3; fl++){
          cages.push({
            id: nextCageId++,
            name: String(c+1),
            floor: String(fl),
            x: xPos, y: yPos, rot: true,
            p1: side==='right' ? String(rowNum) : '',
            p2: side==='left'  ? String(rowNum) : '',
            pn1: pn1val||'', pn2: pn2val||'', section: sec||'',
          });
        }
      }
    });
  }

  // סדר מלמעלה למטה: פניה ב → בין הפניות → פניה א → מחסן ראשי → רחבה

  // ══ פניה ב' ══  y=0 — מסובב 90° שמאלה
  // ══ פריסה חדשה: שני טורים ══
  // טור שמאל  (x=0..18): פניה ב (למעלה) → בין → פניה א (למטה)
  // טור ימין  (x=24..39): מחסן ראשי (למעלה) → רחבה (למטה)

  // ── פניה ב' (top-left) ── y=0..6 — מסובב
  // ימין: 14 שורות × 7 עמודות → x=0..13, y=0..6
  addRowsRot(0, 0,
    [82,84,86,88,90,92,94,96,98,100,102,104,106,108],
    7, 'right', '', 'כן');
  // שמאל קטן: 3 שורות × 2 עמודות צמוד מימין לגדול → x=14..16, y=0..1
  addRowsRot(16, 0,
    [23,25,27],
    2, 'left', '', 'כן');

  // ── בין הפניות (middle-left) ── y=10..19 — לא מסובב
  addRows(8, 10, [62,64,66,68,70,72,74,76,78,80], 9, 'right', '', '', 'between');
  addRows(0, 10, [43,45,47,49,51,53,55,57,59,61], 9, 'left',  '', '', 'between');

  // ── פניה א' (bottom-left) ── y=23..30 — מסובב
  // ימין: 14 שורות × 8 עמודות → x=0..13, y=23..30
  addRowsRot(0, 23,
    [34,36,38,40,42,44,46,48,50,52,54,56,58,60],
    8, 'right', 'כן', '');
  // שמאל קטן: 5 שורות × 4 עמודות צמוד מימין → x=14..18, y=23..26
  addRowsRot(18, 23,
    [13,15,17,19,21],
    4, 'left', 'כן', '');

  // ── מחסן ראשי (top-right) ── y=0..15, x=24..39
  // ימין: 16 שורות × 8 עמודות → x=32..39
  addRows(32, 0,
    [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32],
    8, 'right', '', '');
  // שמאל: 6 שורות × 6 עמודות → x=24..29
  addRows(24, 0,
    [1,3,5,7,9,11],
    6, 'left', '', '');

  // ── רחבה / עמסה (bottom-right) ── y=19..25, x=28..34 (במרכז מתחת למחסן)
  for(let r=0; r<7; r++){
    for(let c=0; c<7; c++){
      for(let fl=1; fl<=3; fl++){
        cages.push({
          id: nextCageId++,
          name: String(c+1),
          floor: String(fl),
          x: 28+c, y: 19+r, rot: false,
          p1:'', p2:'', pn1:'', pn2:'',
          rahavaRow: String(r+1),
          section: 'rahava'
        });
      }
    }
  };

  selectedCageId=null; selectedCages=[];
  // שמירה מיידית לא דחויה + סימון גרסה
  localStorage.setItem('tirewms_map2',JSON.stringify({cages,walls,nextId:nextCageId,colLabels,rowLabels,mapLabels,nextLabelId}));
  localStorage.setItem('tirewms_map_ver','layout-2026-v6');
  if(silent){
    setTimeout(()=>{if(typeof renderWarehouse==='function'){renderWarehouse();whCenter();}},50);
  } else {
    setTimeout(()=>{centerMap();drawMap();},50);
    toast('✅ מפת מחסן נוצרה! '+(cages.length/3|0)+' מיקומים · '+(cages.length)+' כלובים');
  }
}
window.generateWarehouseLayout = generateWarehouseLayout;

window.deleteCage = deleteCage;
window.saveCageEdit = saveCageEdit;
window.closeCageEdit = closeCageEdit;
window.saveMapLayout = saveMapLayout;
window.clearMap = clearMap;
window.setMapTool = setMapTool;
window.undoMap = undoMap;
window.redoMap = redoMap;
window.duplicateCage = duplicateCage;
window.openRowPanel = openRowPanel;
window.closeRowPanel = closeRowPanel;
window.confirmRowPanel = confirmRowPanel;
window.toggleLang = toggleLang;
window.applyLang = applyLang;
window.t = t;
window.closeLocationPanel = closeLocationPanel;
window.showItemLocation = showItemLocation;

/* ══ TRANSLATIONS ══ */
const T = {
  he:{
    searchPlaceholder:'חיפוש לפי מידה, מותג, מיקום...',
    brand:'מותג', size:'מידה', clear:'✕ נקה',
    emptyTitle:'המחסן ריק עדיין', emptyHint:'לחץ ＋ להוסיף צמיג ראשון',
    items:'פריטים', inventory:'מלאי', warehouse:'מחסן',
    editor:'עורך מפה', backInventory:'📋 מלאי', dashboard:'דשבורד',
    addTitle:'➕ הוסף צמיג חדש', sizeLabel:'מידה *', brandLabel:'מותג *',
    modelLabel:'דגם', notesLabel:'הערות', locationLabel:'📍 מיקום במחסן',
    turn1:'פניה 1', turn2:'פניה 2', rowRight:'שורה ימין', rowLeft:'שורה שמאל',
    col:'עמודה', floor:'קומה', agr:'🌾 מחסן חקלאות',
    cancel:'ביטול', add:'💾 הוסף למלאי',
    worker:'👁️ כניסה כעובד (צפייה בלבד)', admin:'👑 כניסה כמנהל',
    enterPass:'הכנס סיסמת מנהל', login:'כניסה',
    remember:'זכור אותי (30 יום)', wrongPass:'סיסמא שגויה',
    logout:'יציאה', settings:'⚙️ הגדרות תצוגה',
    themeLight:'☀️ יום', themeDark:'🌙 לילה',
    fontLarge:'גדול', fontNormal:'רגיל',
    bigBtnsOn:'גדול', bigBtnsOff:'רגיל',
    vibOn:'פעיל', vibOff:'כבוי',
    floorAll:'הכל', floor1:'קומה 1', floor2:'קומה 2', floor3:'קומה 3',
    cageEdit:'✏️ עריכת כלוב', cageName:'שם / עמודה', cageFloor:'קומה',
    rotate:'↻ סובב', confirm:'✓ אישור', delete:'🗑️',
    rowTool:'📏 שורה', howManyCages:'כמה כלובים בשורה?',
    cageEmpty:'📦 כלוב ריק', saved:'✅ נשמר!', error:'❌ שגיאה',
    addedTire:'✅ הצמיג נוסף!', deletedTire:'🗑️ נמחק',
    col_label:'עמ׳', floor_label:'קו׳',
    topBrands:'טופ מותגים', warehouseOverview:'📊 סקירת מחסן',
    totalTires:'סה"כ צמיגים', brands:'מותגים',
    activeCols:'עמודות פעילות', activeFloors:'קומות פעילות',
    floorDist:'פילוג לפי קומה', tiresCount:'צמיגים',
  },
  ar:{
    searchPlaceholder:'بحث بالمقاس، الماركة، الموقع...',
    brand:'الماركة', size:'المقاس', clear:'✕ مسح',
    emptyTitle:'المستودع فارغ', emptyHint:'اضغط ＋ لإضافة إطار',
    items:'عناصر', inventory:'المخزون', warehouse:'المستودع',
    editor:'محرر الخريطة', backInventory:'📋 المخزون', dashboard:'لوحة التحكم',
    addTitle:'➕ إضافة إطار جديد', sizeLabel:'المقاس *', brandLabel:'الماركة *',
    modelLabel:'الموديل', notesLabel:'ملاحظات', locationLabel:'📍 الموقع في المستودع',
    turn1:'منعطف 1', turn2:'منعطف 2', rowRight:'صف يمين', rowLeft:'صف يسار',
    col:'العمود', floor:'الطابق', agr:'🌾 مستودع الزراعة',
    cancel:'إلغاء', add:'💾 أضف للمخزون',
    worker:'👁️ دخول كعامل (عرض فقط)', admin:'👑 دخول كمدير',
    enterPass:'أدخل كلمة مرور المدير', login:'دخول',
    remember:'تذكرني (30 يوم)', wrongPass:'كلمة مرور خاطئة',
    logout:'خروج', settings:'⚙️ إعدادات العرض',
    themeLight:'☀️ نهار', themeDark:'🌙 ليل',
    fontLarge:'كبير', fontNormal:'عادي',
    bigBtnsOn:'كبير', bigBtnsOff:'عادي',
    vibOn:'مفعّل', vibOff:'معطّل',
    floorAll:'الكل', floor1:'طابق 1', floor2:'طابق 2', floor3:'طابق 3',
    cageEdit:'✏️ تعديل الخلية', cageName:'الاسم / العمود', cageFloor:'الطابق',
    rotate:'↻ دوران', confirm:'✓ تأكيد', delete:'🗑️',
    rowTool:'📏 صف', howManyCages:'كم خلية في الصف؟',
    cageEmpty:'📦 خلية فارغة', saved:'✅ تم الحفظ!', error:'❌ خطأ',
    addedTire:'✅ تمت إضافة الإطار!', deletedTire:'🗑️ تم الحذف',
    col_label:'عم׳', floor_label:'طا׳',
    topBrands:'أفضل الماركات', warehouseOverview:'📊 نظرة عامة',
    totalTires:'إجمالي الإطارات', brands:'الماركات',
    activeCols:'الأعمدة النشطة', activeFloors:'الطوابق النشطة',
    floorDist:'التوزيع حسب الطابق', tiresCount:'إطارات',
  }
};
let currentLang=localStorage.getItem('tirewms_lang')||'he';
function t(k){return(T[currentLang]&&T[currentLang][k])||(T.he[k])||k;}

/* ══ ACCESSIBILITY ══ */
let vibrationEnabled = localStorage.getItem('tirewms_vib')!=='off';
let themeMode = localStorage.getItem('tirewms_theme')||'dark';
let fontMode = localStorage.getItem('tirewms_font')||'normal';
let bigButtons = localStorage.getItem('tirewms_big')==='on';

/* ══ BLOCKED BRANDS ══ */
let blockedBrands = [];
(async()=>{
  try{
    const raw = window._enc ? await window._enc.get('tirewms_blocked_brands') : localStorage.getItem('tirewms_blocked_brands');
    blockedBrands = JSON.parse(raw||'[]');
  }catch(e){ blockedBrands=[]; }
})();
function _saveBlockedBrands(){
  const data = JSON.stringify(blockedBrands);
  if(window._enc) window._enc.set('tirewms_blocked_brands', data);
  else localStorage.setItem('tirewms_blocked_brands', data);
}
function renderBlockedBrands(){
  const el = document.getElementById('blockedBrandsList');
  if(!el) return;
  el.innerHTML = blockedBrands.length
    ? blockedBrands.map(b=>`<span style="display:inline-flex;align-items:center;gap:4px;background:var(--red-dim);border:1px solid var(--red);color:var(--red);border-radius:20px;padding:4px 10px;font-size:12px;font-weight:700;">${b}<button onclick="removeBlockedBrand('${b}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;line-height:1;padding:0 0 0 2px;">✕</button></span>`).join('')
    : '<span style="font-size:12px;color:var(--muted);">אין מותגים חסומים</span>';
}
function addBlockedBrand(){
  const input = document.getElementById('blockedBrandInput');
  const typed = (input?.value||'').trim().toUpperCase();
  if(!typed){ toast('❌ הכנס שם מותג'); return; }
  if(blockedBrands.includes(typed)){ toast('⚠️ מותג כבר ברשימה'); if(input) input.value=''; return; }
  blockedBrands.push(typed);
  _saveBlockedBrands();
  renderBlockedBrands();
  if(input) input.value='';
  toast(`🚫 ${typed} נוסף`);
}
function toggleBlockedBrand(brand){
  if(blockedBrands.includes(brand)){
    blockedBrands = blockedBrands.filter(b=>b!==brand);
    toast(`✅ ${brand} הוסר`);
  } else {
    blockedBrands.push(brand);
    toast(`🚫 ${brand} נחסם`);
  }
  _saveBlockedBrands();
  renderBlockedBrands();
  const inp = document.getElementById('blockedBrandInput');
  if(inp) showBlockedBrandDrop(inp);
}
function removeBlockedBrand(brand){
  blockedBrands = blockedBrands.filter(b=>b!==brand);
  _saveBlockedBrands();
  renderBlockedBrands();
  toast(`✅ ${brand} הוסר מהרשימה`);
}
function showBlockedBrandDrop(inp){
  const drop = document.getElementById('blockedBrandDrop');
  if(!drop) return;
  const q = (inp.value||'').trim().toUpperCase();
  const brands = [...new Set(items.map(i=>(i.brand||'').trim().toUpperCase()).filter(Boolean))].sort();
  const filtered = q ? brands.filter(b=>b.includes(q)) : brands;
  if(!filtered.length){ drop.style.display='none'; return; }
  const rect = inp.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const spaceAbove = rect.top - 8;
  const maxH = Math.min(220, spaceBelow > spaceAbove ? spaceBelow : spaceAbove);
  drop.style.left = rect.left+'px';
  drop.style.width = rect.width+'px';
  drop.style.maxHeight = maxH+'px';
  drop.style.borderRadius = spaceBelow > spaceAbove ? '0 0 8px 8px' : '8px 8px 0 0';
  if(spaceBelow > spaceAbove){
    drop.style.top = rect.bottom+'px';
    drop.style.bottom = '';
  } else {
    drop.style.bottom = (window.innerHeight - rect.top)+'px';
    drop.style.top = '';
  }
  drop.innerHTML = filtered.map(b=>{
    const blocked = blockedBrands.includes(b);
    const bg = blocked ? 'var(--red-dim,#3a1a1a)' : '';
    const color = blocked ? 'var(--red,#ff6b6b)' : 'var(--text)';
    return `<div data-bval="${escHTML(b)}"
      style="padding:9px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;background:${bg};color:${color};${blocked?'font-weight:700;':''}"
      onmouseenter="this.style.background='var(--border2)'" onmouseleave="this.style.background='${bg}'">
      <span style="font-size:15px;width:18px;text-align:center;">${blocked?'🚫':'☐'}</span>${escHTML(b)}
    </div>`;
  }).join('');
  drop.style.display = 'block';
}
window.addBlockedBrand = addBlockedBrand;
window.removeBlockedBrand = removeBlockedBrand;
window.toggleBlockedBrand = toggleBlockedBrand;
window.showBlockedBrandDrop = showBlockedBrandDrop;

function applySettings(){
  document.body.classList.toggle('light-mode', themeMode==='light');
  document.body.classList.toggle('large-font', fontMode==='large');
  document.body.classList.toggle('big-buttons', bigButtons);
  // עדכן כפתורים בפאנל
  const tb=document.getElementById('themeBtn');
  if(tb) tb.textContent=themeMode==='light'?'☀️ יום':'🌙 לילה';
  const fb=document.getElementById('fontBtn');
  if(fb){ fb.textContent=fontMode==='large'?'גדול':'רגיל'; fb.style.background=fontMode==='large'?'var(--accent)':'var(--card2)'; fb.style.color=fontMode==='large'?'#111':'var(--text)'; }
  const bb=document.getElementById('bigBtnBtn');
  if(bb){ bb.textContent=bigButtons?'גדול':'רגיל'; bb.style.background=bigButtons?'var(--accent)':'var(--card2)'; bb.style.color=bigButtons?'#111':'var(--text)'; }
  const vb=document.getElementById('vibBtn');
  if(vb){ vb.textContent=vibrationEnabled?'פעיל':'כבוי'; vb.style.background=vibrationEnabled?'var(--green-dim)':'var(--card2)'; vb.style.borderColor=vibrationEnabled?'var(--green)':'var(--border)'; vb.style.color=vibrationEnabled?'var(--green)':'var(--muted)'; }
}

function toggleTheme(){
  themeMode=themeMode==='dark'?'light':'dark';
  localStorage.setItem('tirewms_theme',themeMode);
  applySettings();
}
function toggleFont(){
  fontMode=fontMode==='normal'?'large':'normal';
  localStorage.setItem('tirewms_font',fontMode);
  applySettings();
}
function toggleBigButtons(){
  bigButtons=!bigButtons;
  localStorage.setItem('tirewms_big',bigButtons?'on':'off');
  applySettings();
}
function toggleVibration(){
  vibrationEnabled=!vibrationEnabled;
  localStorage.setItem('tirewms_vib',vibrationEnabled?'on':'off');
  applySettings();
}

function vibrate(pattern){
  if(!vibrationEnabled) return;
  if('vibrate' in navigator){ try{ navigator.vibrate(pattern); }catch(e){} }
}

function openAccessPanel(){
  const panel = document.getElementById('accessPanel');
  if(!panel) return;
  panel.style.display = 'flex';
  try { applySettings(); } catch(e) {}
  try { applyLang(); } catch(e) {}
  try { renderBlockedBrands(); } catch(e) {}
}
function closeAccessPanel(){
  document.getElementById('accessPanel').style.display='none';
}

// אתחל הגדרות
window.addEventListener('load',()=>{ applySettings(); });

function toggleLang(){
  currentLang=currentLang==='he'?'ar':'he';
  localStorage.setItem('tirewms_lang',currentLang);
  applyLang();
}
function applyLang(){
  const isAr = currentLang==='ar';
  const lb=document.getElementById('langBtn');
  if(lb){lb.textContent=isAr?'🇮🇱':'🇸🇦';}
  const ms=document.getElementById('mainSearch');
  if(ms) ms.placeholder=t('searchPlaceholder');
  const fb=document.getElementById('fBrand');
  if(fb&&fb.options[0]) fb.options[0].text='🏷️ '+t('brand');
  const fs_=document.getElementById('fSize');
  if(fs_&&fs_.options[0]) fs_.options[0].text='📐 '+t('size');
  const bc=document.querySelector('.btn-clear');
  if(bc) bc.textContent=t('clear');
  const nd=document.querySelector('#nav-dashboard .bl');
  const ni=document.querySelector('#nav-inventory .bl');
  const nw=document.querySelector('#nav-warehouse .bl');
  const nm_=document.querySelector('#nav-mapEditor .bl');
  if(nd) nd.textContent=t('dashboard');
  if(ni) ni.textContent=t('inventory');
  if(nw) nw.textContent=t('warehouse');
  if(nm_) nm_.textContent=t('editor');
  const bb=document.getElementById('backToInventory');
  if(bb) bb.innerHTML=t('backInventory');
  // פאנל הגדרות
  const accessTitle=document.getElementById('accessTitle');
  if(accessTitle) accessTitle.textContent='⚙️ '+(isAr?'إعدادات العرض':'הגדרות תצוגה');
  const themeLabel=document.getElementById('themeLabel');
  if(themeLabel) themeLabel.textContent='🌙 / ☀️ '+(isAr?'وضع العرض':'מצב תצוגה');
  const themeSubLabel=document.getElementById('themeSubLabel');
  if(themeSubLabel) themeSubLabel.textContent=isAr?'ليل / نهار':'לילה / יום';
  const fontLabel=document.getElementById('fontLabel');
  if(fontLabel) fontLabel.textContent='🔤 '+(isAr?'حجم النص':'גודל טקסט');
  const fontSubLabel=document.getElementById('fontSubLabel');
  if(fontSubLabel) fontSubLabel.textContent=isAr?'للعمال الكبار':'לעובדים מבוגרים';
  const bigBtnLabel=document.getElementById('bigBtnLabel');
  if(bigBtnLabel) bigBtnLabel.textContent='👆 '+(isAr?'أزرار كبيرة':'כפתורים גדולים');
  const bigBtnSubLabel=document.getElementById('bigBtnSubLabel');
  if(bigBtnSubLabel) bigBtnSubLabel.textContent=isAr?'للأصابع الكبيرة':'לאצבעות גדולות';
  const vibLabel=document.getElementById('vibLabel');
  if(vibLabel) vibLabel.textContent='📳 '+(isAr?'اهتزاز':'רטט');
  const vibSubLabel=document.getElementById('vibSubLabel');
  if(vibSubLabel) vibSubLabel.textContent=isAr?'اهتزاز عند إيجاد عنصر':'רטט כשפריט נמצא';
  const closeAccessBtn=document.getElementById('closeAccessBtn');
  if(closeAccessBtn) closeAccessBtn.textContent=isAr?'إغلاق':'סגור';
  // כפתורי שכבות במפה
  const flAll=document.getElementById('fl-all');
  if(flAll) flAll.textContent=t('floorAll');
  const fl1=document.getElementById('fl-1');
  if(fl1) fl1.textContent=t('floor1');
  const fl2=document.getElementById('fl-2');
  if(fl2) fl2.textContent=t('floor2');
  const fl3=document.getElementById('fl-3');
  if(fl3) fl3.textContent=t('floor3');
  try{ if(typeof renderTable==='function') renderTable(); }catch(e){}
}

function formatSize(el){
  const digits=el.value.replace(/[^0-9]/g,'');
  let out='';
  // Truck format detection: first 2 digits ≤ 14 AND 3rd digit is not '5'
  // Examples: 13R22.5, 10R20, 11R22.5 (not 135/70R13 where first2=13 but d3='5')
  const first2=digits.length>=2?parseInt(digits.slice(0,2)):null;
  const d3=digits.length>=3?digits[2]:null;
  const isTruck=first2!==null&&first2<=14&&digits.length>=3&&d3!=='5';
  if(isTruck){
    // ##R##[.#]
    out+=digits.slice(0,2);
    if(digits.length>=3) out+='R'+digits.slice(2,4);
    if(digits.length>=5) out+='.'+digits.slice(4,5);
  } else {
    // ###/##R##
    if(digits.length>0) out+=digits.slice(0,3);
    if(digits.length>=4) out+='/'+digits.slice(3,5);
    if(digits.length>=6) out+='R'+digits.slice(5,7);
  }
  el.value=out;
}
function parseSize(v){
  const s=v.replace(/\s/g,'').toUpperCase();
  // Passenger: ###/##R##
  const mp=s.match(/^(\d{3})\D?(\d{2})\D?(\d{2})$/);
  if(mp) return {w:+mp[1],p:+mp[2],d:+mp[3]};
  // Truck: ##R##[.#] — e.g. 13R22.5, 10R20
  const mt=s.match(/^(\d{1,2})R(\d{2}\.?\d?)$/);
  if(mt) return {w:+mt[1],p:0,d:+mt[2]};
  return null;
}

/* ══ EXCEL / SAP IMPORT ══ */
function openExcelImportPanel(){
  const ov=document.getElementById('excelImportOverlay');
  if(ov){ ov.style.display='flex'; }
}
function closeExcelImportPanel(){
  const ov=document.getElementById('excelImportOverlay');
  if(ov){ ov.style.display='none'; }
  const s2=document.getElementById('excelStep2');
  if(s2){ s2.style.display='none'; s2.innerHTML=''; }
  const s1=document.getElementById('excelStep1');
  if(s1) s1.style.display='';
  const inp=document.getElementById('importExcelDirect');
  if(inp) inp.value='';
}

function handleExcelImportFile(input){
  const file=input.files[0];
  if(!file) return;
  const ext=file.name.split('.').pop().toLowerCase();
  const step2=document.getElementById('excelStep2');

  if(ext==='csv'){
    const reader=new FileReader();
    reader.onload=e=>{
      const rows=_parseCSVToRows(e.target.result);
      if(!rows||rows.length===0){ toast('❌ קובץ CSV ריק'); return; }
      document.getElementById('excelStep1').style.display='none';
      step2.style.display='';
      showColumnMapper(rows, step2);
    };
    reader.readAsText(file,'UTF-8');
    return;
  }

  toast('⏳ טוען קובץ...');
  function processFile(){
    const reader=new FileReader();
    reader.onerror=()=>toast('❌ שגיאה בקריאת הקובץ');
    reader.onload=async function(e){
      toast('⏳ מפרסר Excel...');
      try{
        const rows=await new Promise((resolve,reject)=>{
          const ws=`self.onmessage=function(e){try{importScripts(e.data.u);var wb=XLSX.read(new Uint8Array(e.data.b),{type:'array',dense:true});var ws=wb.Sheets[wb.SheetNames[0]];var rows=XLSX.utils.sheet_to_json(ws,{defval:''});self.postMessage({ok:true,rows:rows});}catch(err){self.postMessage({ok:false,error:err.message});}};`;
          const url=URL.createObjectURL(new Blob([ws],{type:'text/javascript'}));
          const w=new Worker(url);
          w.onmessage=m=>{w.terminate();URL.revokeObjectURL(url);m.data.ok?resolve(m.data.rows):reject(new Error(m.data.error));};
          w.onerror=err=>{w.terminate();URL.revokeObjectURL(url);reject(err);};
          w.postMessage({b:e.target.result,u:'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'},[e.target.result]);
        });
        if(!rows||rows.length===0){toast('❌ הגיליון ריק');return;}
        document.getElementById('excelStep1').style.display='none';
        step2.style.display='';
        showColumnMapper(rows,step2);
      }catch(err){toast('❌ שגיאה בקריאת הקובץ');}
      input.value='';
    };
    reader.readAsArrayBuffer(file);
  }

  if(typeof XLSX!=='undefined'){ processFile(); return; }
  const script=document.createElement('script');
  script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  script.crossOrigin='anonymous';
  script.onload=processFile;
  script.onerror=()=>toast('❌ לא הצלח לטעון ספריית Excel');
  document.head.appendChild(script);
}

function downloadExcelTemplate(){
  // CSV תבנית פשוטה
  const bom='\uFEFF';
  const csv=bom+'מידה,מותג,דגם,כמות,עמודה,קומה,הערות\n205/55R16,Michelin,Primacy 4,4,מי.1.2,1,\n225/45R17,Pirelli,P Zero,2,פ1ש.3.1,1,דחוף\n';
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='תבנית_מלאי.csv';
  a.click();
}

function importExcel(input){
  // נקרא מתפריט הגיבוי הישן
  const file=input.files[0];
  if(!file) return;
  const ext=file.name.split('.').pop().toLowerCase();

  if(ext==='csv'){
    const reader=new FileReader();
    reader.onload=e=>{ const rows=_parseCSVToRows(e.target.result); if(rows) processExcelRows(rows); input.value=''; };
    reader.readAsText(file,'UTF-8');
    return;
  }

  toast('⏳ טוען קובץ...');
  function processFile(){
    const reader=new FileReader();
    reader.onerror=()=>toast('❌ שגיאה בקריאת הקובץ');
    reader.onload=async function(e){
      toast('⏳ מפרסר Excel...');
      try{
        const rows=await new Promise((resolve,reject)=>{
          const ws=`self.onmessage=function(e){try{importScripts(e.data.u);var wb=XLSX.read(new Uint8Array(e.data.b),{type:'array',dense:true});var ws=wb.Sheets[wb.SheetNames[0]];var rows=XLSX.utils.sheet_to_json(ws,{defval:''});self.postMessage({ok:true,rows:rows});}catch(err){self.postMessage({ok:false,error:err.message});}};`;
          const url=URL.createObjectURL(new Blob([ws],{type:'text/javascript'}));
          const w=new Worker(url);
          w.onmessage=m=>{w.terminate();URL.revokeObjectURL(url);m.data.ok?resolve(m.data.rows):reject(new Error(m.data.error));};
          w.onerror=err=>{w.terminate();URL.revokeObjectURL(url);reject(err);};
          w.postMessage({b:e.target.result,u:'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'},[e.target.result]);
        });
        processExcelRows(rows);
      }catch(err){toast('❌ שגיאה בקריאת הקובץ');}
      input.value='';
    };
    reader.readAsArrayBuffer(file);
  }
  if(typeof XLSX!=='undefined'){ processFile(); return; }
  const script=document.createElement('script');
  script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  script.onload=processFile;
  script.onerror=()=>toast('❌ לא הצלח לטעון SheetJS');
  document.head.appendChild(script);
}

function _parseCSVToRows(text){
  const lines=text.split('\n').filter(l=>l.trim());
  if(lines.length<2){ toast('❌ קובץ CSV ריק'); return null; }
  // תמיכה ב-BOM
  const headerLine=lines[0].replace(/^\uFEFF/,'');
  const headers=headerLine.split(',').map(h=>h.trim().replace(/"/g,''));
  return lines.slice(1).map(line=>{
    const vals=line.split(',').map(v=>v.trim().replace(/"/g,''));
    const obj={};
    headers.forEach((h,i)=>obj[h]=vals[i]||'');
    return obj;
  });
}
function parseCSV(text){
  const rows=_parseCSVToRows(text);
  if(rows) processExcelRows(rows);
}

// מיפוי עמודות Excel נפוצות
const _excelFieldMap={
  size:  ['מידה','size','tire size','tyre size','גודל','dimension','מידת צמיג'],
  brand: ['מותג','brand','manufacturer','יצרן','שם יצרן','ספק','supplier','פריט','item','item name','שם פריט'],
  model: ['דגם','model','description','תיאור','type','תיאור פריט','item description','תאור פריט','תאור'],
  col:   ['עמודה','col','column','מיקום','location','bin','cage'],
  floor: ['קומה','floor','level','shelf','rack'],
  qty:   ['כמות','qty','quantity','amount','מספר','stock','מלאי','סהכ מלאי זמין','סה"כ מלאי','יתרה מלאי','כמות זמינה'],
  notes: ['הערות','notes','remarks','note','comment'],
  warehouse:['מחסן','warehouse','store','סניף','branch','אתר'],
  itemCode: ['קוד פריט','item code','part number','part no','partno','sku','code','קוד','מק"ט','מקט'],
  caesarea: ['קיסריה 01','caesarea 01','caesarea','קיסריה','יתרה','יתרה קיסריה','stock qty','qty caesarea'],
};

function _excelFindCol(headers, keys){
  const lh=headers.map(h=>({orig:h,low:String(h).toLowerCase().trim()}));
  for(const key of keys){
    const kl=key.toLowerCase();
    const m=lh.find(h=>h.low===kl||h.low.includes(kl));
    if(m) return m.orig;
  }
  return null;
}

function processExcelRows(rows, colMap){
  if(!rows||rows.length===0){ toast('❌ לא נמצאו שורות'); return; }
  const headers=Object.keys(rows[0]);

  let sizeCol, brandCol, modelCol, colCol, floorCol, qtyCol, notesCol, warehouseCol, itemCodeCol, caesareaCol;
  if(colMap){
    sizeCol=colMap.size||null; brandCol=colMap.brand||null;
    modelCol=colMap.model||null; colCol=colMap.col||null;
    floorCol=colMap.floor||null; qtyCol=colMap.qty||null;
    notesCol=colMap.notes||null; warehouseCol=colMap.warehouse||null;
    itemCodeCol=colMap.itemCode||null; caesareaCol=colMap.caesarea||null;
  } else {
    sizeCol =_excelFindCol(headers,_excelFieldMap.size);
    brandCol=_excelFindCol(headers,_excelFieldMap.brand);
    modelCol=_excelFindCol(headers,_excelFieldMap.model);
    colCol  =_excelFindCol(headers,_excelFieldMap.col);
    floorCol=_excelFindCol(headers,_excelFieldMap.floor);
    qtyCol  =_excelFindCol(headers,_excelFieldMap.qty);
    notesCol=_excelFindCol(headers,_excelFieldMap.notes);
    warehouseCol=_excelFindCol(headers,_excelFieldMap.warehouse);
    itemCodeCol=_excelFindCol(headers,_excelFieldMap.itemCode);
    caesareaCol=_excelFindCol(headers,_excelFieldMap.caesarea);
  }

  // ── זיהוי אוטומטי של פורמט SAP ──
  // אם הקובץ מכיל קוד פריט + תיאור פריט + קיסריה 01 — עדכן מלאי + הוסף פריטים חדשים בלבד
  const _isSAP = !!(itemCodeCol && modelCol && caesareaCol);
  if(_isSAP){
    toast('⏳ מייבא מ-SAP...');
    (async()=>{
      try{
        await new Promise(resolve=>onAuthReady(resolve));
        // קודים קיימים לפי itemCode
        const existingCodes=new Set((window.items||[]).map(i=>String(i.itemCode||'').trim()).filter(Boolean));
        // פריטים ללא קוד פריט — מיפוי לפי תיאור (model) לעדכון בדיעבד
        const noCodeByDesc={};
        (window.items||[]).forEach(i=>{ if(!i.itemCode&&i.model) noCodeByDesc[i.model.trim()]=i.id; });

        const invEntries={};
        const newItems=[];
        const codeUpdates={}; // id → itemCode לעדכון פריטים קיימים
        rows.forEach(row=>{
          const code=String(row[itemCodeCol]||'').trim();
          if(!code) return;
          const desc=String(row[modelCol]||'').trim();
          const caesQty=Number(row[caesareaCol])||0;

          // עדכון מלאי קיסריה לכולם
          invEntries[code]={caesareaQty:caesQty,itemDescription:desc,itemCode:code};

          // בדוק מותג חסום
          const _rowBrand = (brandCol ? String(row[brandCol]||'') : (desc||'').trim().split(/\s+/).slice(-1)[0]||'').trim().toUpperCase();
          if(blockedBrands.includes(_rowBrand)) return;

          if(existingCodes.has(code)) return; // קיים עם קוד — דלג

          // בדוק אם קיים פריט עם אותו תיאור אך ללא קוד — עדכן קוד
          if(noCodeByDesc[desc]){
            codeUpdates[noCodeByDesc[desc]]=code;
            existingCodes.add(code);
            return;
          }

          // פריט חדש לחלוטין
          existingCodes.add(code);
          const sizeToken=(desc||'').trim().split(/\s+/)[0]||'';
          const parsed=sizeToken&&/[\d\/\-\.R]/i.test(sizeToken)?parseSize(sizeToken.replace(/\s/g,'').toUpperCase()):null;
          const brand=(desc||'').trim().split(/\s+/).slice(-1)[0]||'';
          newItems.push({
            id:nextId++,
            w:parsed?parsed.w:0,p:parsed?parsed.p:0,d:parsed?parsed.d:0,
            brand, model:desc, itemCode:code,
            notes:'',col:'',floor:'1',p1:'',p2:'',pn1:'',pn2:'',agr:''
          });
        });

        // עדכן קוד פריט לפריטים קיימים שהיו חסרים
        const updateIds=Object.entries(codeUpdates);
        if(updateIds.length){
          let batch=writeBatch(db); let cnt=0;
          for(const[id,code]of updateIds){
            batch.update(doc(db,'tires',String(id)),{itemCode:code});
            if(++cnt>=499){await batch.commit();batch=writeBatch(db);cnt=0;}
          }
          if(cnt>0) await batch.commit();
          // עדכן גם ב-window.items
          updateIds.forEach(([id,code])=>{ const it=(window.items||[]).find(i=>i.id==id); if(it) it.itemCode=code; });
        }

        // שמור מלאי קיסריה
        const entries=Object.entries(invEntries);
        if(entries.length){
          const now=serverTimestamp();
          let batch=writeBatch(db); let cnt=0;
          for(const[code,data]of entries){
            batch.set(doc(db,'inventory',code),{...data,lastUpdated:now},{merge:true});
            if(++cnt>=499){await batch.commit();batch=writeBatch(db);cnt=0;}
          }
          if(cnt>0) await batch.commit();
          _invData=null; _invBrandIdx=null;
        }

        // שמור פריטים חדשים
        if(newItems.length && window._importItems) await window._importItems(newItems);

        closeBackupMenu(); closeExcelImportPanel();
        if(window._loadInvData) await window._loadInvData().catch(()=>{});
        if(typeof renderTable==='function') renderTable();
        const updMsg=updateIds.length?` · ${updateIds.length} קודים עודכנו`:'';
        toast(`✅ מלאי עודכן — ${entries.length} פריטים${newItems.length?` · ${newItems.length} חדשים נוספו`:''}${updMsg}`);
      }catch(e){ console.error('SAP import error',e); toast('❌ שגיאת ייבוא SAP: '+e.message); }
    })();
    return;
  }

  if(!colMap && !sizeCol && !brandCol){
    showColumnMapper(rows);
    return;
  }

  // סינון לפי מחסן — אם יש עמודת מחסן, ייבא רק שורות של מחסן 01
  const _warehouseFilter = warehouseCol ? true : false;

  // חילוץ מידה מתוך תיאור פריט — למשל "10.0/75-15.3 10PR IMB162 ..." → "10.0/75-15.3"
  const _sizeFromDesc = !sizeCol && modelCol
    ? (desc) => { const t=(desc||'').trim().split(/\s+/)[0]; return t&&/[\d\/\-\.R]/.test(t)?t:''; }
    : null;

  let added=0, skipped=0, warehouseSkipped=0;
  const _batchItems=[];
  rows.forEach((row,idx)=>{
    try{
      if(_warehouseFilter){
        const wh=String(row[warehouseCol]||'').trim();
        if(wh!=='01'&&wh!=='1'&&!wh.includes('מחסן 01')&&!wh.includes('מחסן 1')&&wh.toLowerCase()!=='main'){
          warehouseSkipped++; return;
        }
      }
      const descVal=modelCol?String(row[modelCol]||'').trim():'';
      const rawSize=sizeCol?String(row[sizeCol]||'').trim():(_sizeFromDesc?_sizeFromDesc(descVal):'');
      const brandVal=brandCol?String(row[brandCol]||'').trim():'';
      if(!rawSize&&!brandVal){ skipped++; return; }
      if(blockedBrands.includes((brandVal||'').toUpperCase())){ skipped++; return; }
      const parsed=rawSize?parseSize(rawSize.replace(/\s/g,'').toUpperCase()):null;
      const qty=Math.max(1, parseInt(qtyCol?String(row[qtyCol]||'1'):1,10)||1);
      const actualQty=Math.min(qty,50);
      for(let q=0;q<actualQty;q++){
        const newItem={
          id:nextId++,
          w:parsed?parsed.w:0,p:parsed?parsed.p:0,d:parsed?parsed.d:0,
          brand:brandVal, model:descVal,
          itemCode:itemCodeCol?String(row[itemCodeCol]||'').trim():'',
          notes:notesCol?String(row[notesCol]||'').trim():'',
          col:colCol?String(row[colCol]||'').trim():'',
          floor:floorCol?String(row[floorCol]||'1').trim():'1',
          p1:'',p2:'',pn1:'',pn2:'',agr:''
        };
        _batchItems.push(newItem);
        added++;
      }
    }catch(e){ skipped++; }
  });

  if(_batchItems.length && window._importItems){
    toast(`⏳ מייבא ${_batchItems.length} פריטים...`);
    window._importItems(_batchItems).then(()=>{
      closeBackupMenu(); closeExcelImportPanel();
      const whMsg=warehouseSkipped>0?` · ${warehouseSkipped} ממחסנים אחרים דולגו`:'';
      toast(`✅ יובאו ${added} פריטים${skipped>0?' · '+skipped+' דולגו':''}${whMsg}`);
    }).catch(e=>toast('❌ שגיאת ייבוא: '+e.message));
  } else {
    closeBackupMenu(); closeExcelImportPanel();
    const whMsg=warehouseSkipped>0?` · ${warehouseSkipped} ממחסנים אחרים דולגו`:'';
    setTimeout(()=>toast(`✅ יובאו ${added} פריטים${skipped>0?' · '+skipped+' דולגו':''}${whMsg}`),400);
  }
}

function showColumnMapper(rows, embedIn){
  if(!rows||rows.length===0) return;
  const headers=Object.keys(rows[0]);
  const options=headers.map(h=>`<option value="${encodeURIComponent(h)}">${escHTML(h)}</option>`).join('');
  const emptyOpt='<option value="">-- בחר עמודה --</option>';

  // ניחוש אוטומטי של עמודות
  function autoGuess(keys){
    const c=_excelFindCol(headers,keys);
    return c?`value="${encodeURIComponent(c)}"`:'' ;
  }

  const fields=[
    {key:'size',     label:'📐 מידה (205/55R16)',    keys:_excelFieldMap.size},
    {key:'brand',    label:'🏷️ מותג',               keys:_excelFieldMap.brand},
    {key:'model',    label:'🔖 דגם / תיאור פריט',   keys:_excelFieldMap.model},
    {key:'itemCode', label:'🔑 קוד פריט',            keys:_excelFieldMap.itemCode},
    {key:'caesarea', label:'📦 קיסריה 01 (מלאי)',   keys:_excelFieldMap.caesarea},
    {key:'qty',      label:'🔢 כמות (לייבוא)',       keys:_excelFieldMap.qty},
    {key:'col',      label:'📍 עמודה / כלוב',        keys:_excelFieldMap.col},
    {key:'floor',    label:'🏢 קומה',               keys:_excelFieldMap.floor},
    {key:'notes',    label:'📝 הערות',              keys:_excelFieldMap.notes},
    {key:'warehouse',label:'🏭 מחסן (סינון)',       keys:_excelFieldMap.warehouse},
  ];

  const preview=rows.slice(0,3).map(r=>`<tr>${headers.map(h=>`<td style="padding:4px 6px;border:1px solid var(--border);font-size:11px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHTML(String(r[h]||'').slice(0,30))}</td>`).join('')}</tr>`).join('');

  const mapHTML=`
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">📋 מיפוי עמודות</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:12px;">נמצאו <b>${rows.length}</b> שורות — בחר עמודה מתאימה לכל שדה:</div>
    ${fields.map(f=>`
      <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">
        <label style="font-size:12px;color:var(--muted);width:130px;flex-shrink:0;">${f.label}</label>
        <select id="xmap_${f.key}" style="flex:1;background:var(--card);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:8px;font-family:inherit;font-size:13px;">
          ${emptyOpt}${options}
        </select>
      </div>
    `).join('')}
    <div style="overflow-x:auto;margin-top:12px;border-radius:8px;border:1px solid var(--border);">
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr>${headers.map(h=>`<th style="padding:5px 6px;border:1px solid var(--border);background:var(--card2);color:var(--muted);text-align:right;white-space:nowrap;">${escHTML(h)}</th>`).join('')}</tr></thead>
        <tbody>${preview}</tbody>
      </table>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button id="xmapBack" style="flex:1;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">← חזור</button>
      <button id="xmapImport" style="flex:2;background:var(--accent);border:none;color:#111;border-radius:10px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">✓ ייבא עכשיו</button>
    </div>`;

  if(embedIn){
    // הצג בתוך פאנל הייבוא הייעודי
    embedIn.innerHTML=mapHTML;
    embedIn._rows=rows;
    embedIn.querySelector('#xmapBack').onclick=()=>{
      document.getElementById('excelStep1').style.display='';
      embedIn.style.display='none';
      embedIn.innerHTML='';
    };
    embedIn.querySelector('#xmapImport').onclick=()=>applyColumnMap(embedIn._rows, null);
  } else {
    // fallback — overlay נפרד (מגיע מתפריט גיבוי)
    const body=document.createElement('div');
    body.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:8600;display:flex;align-items:flex-end;font-family:Heebo,sans-serif;direction:rtl;';
    body.innerHTML=`<div style="background:var(--surface);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;">${mapHTML}</div>`;
    body._rows=rows;
    body.querySelector('#xmapBack').onclick=()=>body.remove();
    body.querySelector('#xmapImport').onclick=()=>{ applyColumnMap(body._rows, null); body.remove(); };
    // הגדר ניחוש אוטומטי
    fields.forEach(f=>{
      const sel=body.querySelector(`#xmap_${f.key}`);
      const guessed=_excelFindCol(headers,f.keys);
      if(sel&&guessed){ const enc=encodeURIComponent(guessed); const opt=[...sel.options].find(o=>o.value===enc); if(opt) opt.selected=true; }
    });
    document.body.appendChild(body);
    return;
  }

  // הגדר ניחוש אוטומטי עבור embed
  fields.forEach(f=>{
    const sel=document.getElementById(`xmap_${f.key}`);
    const guessed=_excelFindCol(headers,f.keys);
    if(sel&&guessed){ const enc=encodeURIComponent(guessed); const opt=[...sel.options].find(o=>o.value===enc); if(opt) opt.selected=true; }
  });
}

function applyColumnMap(rows, container){
  const getVal=id=>{ const el=document.getElementById(id); if(!el||!el.value) return null; return decodeURIComponent(el.value)||null; };
  const colMap={
    size: getVal('xmap_size'), brand:getVal('xmap_brand'),
    model:getVal('xmap_model'),col:  getVal('xmap_col'),
    floor:getVal('xmap_floor'),qty:  getVal('xmap_qty'),
    notes:getVal('xmap_notes'),warehouse:getVal('xmap_warehouse'),
    itemCode:getVal('xmap_itemCode'),caesarea:getVal('xmap_caesarea'),
  };
  processExcelRows(rows, colMap);
}

function prevPage(){ if(currentPage>0){currentPage--;renderTable();} }
function nextPage(total){ if(currentPage<total-1){currentPage++;renderTable();} }

function _setAgrBtn(inputId, btnId, val){
  const input=document.getElementById(inputId);
  const btn=document.getElementById(btnId);
  if(!input||!btn) return;
  if(val==='כן'){
    input.value='כן';
    btn.style.background='rgba(62,207,142,0.2)';
    btn.style.borderColor='var(--green)';
    btn.style.color='var(--green)';
    btn.style.boxShadow='0 0 12px rgba(62,207,142,0.35)';
  } else {
    input.value='';
    btn.style.background='var(--card)';
    btn.style.borderColor='var(--border)';
    btn.style.color='var(--muted)';
    btn.style.boxShadow='none';
  }
}
function toggleAgr(){
  const input=document.getElementById('aAgr');
  if(!input) return;
  _setAgrBtn('aAgr','btnAgr',input.value==='כן'?'':'כן');
  vibrate([40]);
}
function toggleLeAgr(){
  const input=document.getElementById('leAgr');
  if(!input) return;
  _setAgrBtn('leAgr','btnLeAgr',input.value==='כן'?'':'כן');
  vibrate([40]);
}
function toggleRahava(){
  const input=document.getElementById('aRahava');
  const btn=document.getElementById('btnRahava');
  if(!input||!btn) return;
  const isOn=input.value==='כן';
  if(isOn){
    input.value='';
    btn.style.background='var(--card)';
    btn.style.borderColor='var(--border)';
    btn.style.color='var(--muted)';
    btn.style.boxShadow='none';
  } else {
    input.value='כן';
    btn.style.background='rgba(232,93,63,0.2)';
    btn.style.borderColor='var(--red)';
    btn.style.color='var(--red)';
    btn.style.boxShadow='0 0 12px rgba(232,93,63,0.35)';
    vibrate([40]);
  }
}

function toggleTurn(inputId, btnId){
  const input=document.getElementById(inputId);
  const btn=document.getElementById(btnId);
  if(!input||!btn) return;
  const isOn=input.value==='כן';
  if(isOn){
    input.value='';
    btn.style.background='var(--card)';
    btn.style.borderColor='var(--border)';
    btn.style.color='var(--muted)';
    btn.style.boxShadow='none';
  } else {
    input.value='כן';
    btn.style.background='rgba(245,166,35,0.2)';
    btn.style.borderColor='var(--accent)';
    btn.style.color='var(--accent)';
    btn.style.boxShadow='0 0 10px rgba(245,166,35,0.3)';
    vibrate([40]);
  }
  if(typeof _syncFormToMap==='function') _syncFormToMap();
}

function resetTurnButtons(){
  ['aPn1','aPn2'].forEach((id,i)=>{
    const input=document.getElementById(id);
    const btn=document.getElementById('btnPn'+(i+1));
    if(input) input.value='';
    if(btn){ btn.style.background='var(--card)'; btn.style.borderColor='var(--border)'; btn.style.color='var(--muted)'; btn.style.boxShadow='none'; }
  });
}

let _searchDebounce=null;
function handleSearchInput(el){
  const btn=document.getElementById('clearSearchBtn');
  if(btn) btn.style.display=el.value?'flex':'none';
  currentPage=0;
  clearTimeout(_searchDebounce);
  _searchDebounce=setTimeout(()=>renderTable(), 200);
}
window.handleSearchInput=handleSearchInput;
window.toggleTurn=toggleTurn;
window.toggleRahava=toggleRahava;
window.saveBarcodeMemory=saveBarcodeMemory;
window.parseQRData=parseQRData;
window.getBarcodeMemory=getBarcodeMemory;
window.resetTurnButtons=resetTurnButtons;


function showBackupMenu(){
  if(!window.isOwnerMode){toast('❌ גישה לבעלים בלבד');return;}
  const m=document.getElementById('backupMenu');
  m.style.display='flex';
  m.classList.add('open');
}
function closeBackupMenu(){
  const m=document.getElementById('backupMenu');
  m.classList.remove('open');
  m.style.display='none';
}

function clearSearch(){
  const s=document.getElementById('mainSearch');
  if(s){ s.value=''; s.focus(); }
  const btn=document.getElementById('clearSearchBtn');
  if(btn) btn.style.display='none';
  currentPage=0;
  renderTable();
}
window.clearSearch=clearSearch;
window.showBackupMenu=showBackupMenu;
window.closeBackupMenu=closeBackupMenu;
window.prevPage=prevPage;

function updateAutoComplete(){
  // מותגים: Firestore + רשימה סטטית
  const firestoreBrands=[...new Set(items.map(it=>it.brand).filter(Boolean))];
  const all=[...new Set([...firestoreBrands,...KNOWN_BRANDS])].sort();
  const bl=document.getElementById('brandList');
  if(bl) bl.innerHTML=all.map(b=>`<option value="${escHTML(b)}">`).join('');
  const fbl=document.getElementById('fBrandList');
  if(fbl) fbl.innerHTML=all.map(b=>`<option value="${escHTML(b)}">`).join('');

  // תיאורים לפי מותג שנבחר (KNOWN_ITEMS_BY_BRAND stores [desc,code] pairs)
  const sb=(document.getElementById('aBr')||{}).value||'';
  const sbUp=sb.trim().toUpperCase();
  const brandPairs = sbUp && KNOWN_ITEMS_BY_BRAND[sbUp] ? KNOWN_ITEMS_BY_BRAND[sbUp]
    : sbUp ? Object.entries(KNOWN_ITEMS_BY_BRAND)
        .filter(([b])=>b.startsWith(sbUp)||sbUp.startsWith(b.slice(0,4)))
        .flatMap(([,v])=>v)
    : [];
  const staticDescs = brandPairs.map(([d])=>d);
  const firestoreDescs=items.filter(it=>!sb||it.brand.toUpperCase()===sbUp).map(it=>it.model).filter(Boolean);
  const allDescs=[...new Set([...staticDescs,...firestoreDescs])];
  const ml=document.getElementById('modelList');
  if(ml) ml.innerHTML=allDescs.map(d=>`<option value="${escHTML(d)}">`).join('');
}

// cache של כל הזוגות [תיאור, קוד] לחיפוש מהיר
let _allDescPairs = null;
function _getAllDescPairs(){
  if(!_allDescPairs) _allDescPairs = Object.values(KNOWN_ITEMS_BY_BRAND).flatMap(v=>v);
  return _allDescPairs;
}

// כשמשתמש בוחר/כותב תיאור פריט — ממלא קוד פריט ומידה אוטומטית + מציג הצעות
function onDescInput(el){
  const desc = el.value.trim();
  const codeEl = document.getElementById('aItemCode');
  const sizeEl = document.getElementById('aSz');

  // עדכן רשימת הצעות לפי מה שמוקלד
  const ml = document.getElementById('modelList');
  if(ml && desc.length >= 2){
    const q = desc.toUpperCase();
    const sb = (document.getElementById('aBr')||{}).value.trim().toUpperCase();
    let pairs;
    if(sb && KNOWN_ITEMS_BY_BRAND[sb]){
      pairs = KNOWN_ITEMS_BY_BRAND[sb];
    } else if(sb){
      pairs = Object.entries(KNOWN_ITEMS_BY_BRAND)
        .filter(([b])=>b.includes(sb)||sb.includes(b.slice(0,4)))
        .flatMap(([,v])=>v);
    } else {
      pairs = _getAllDescPairs();
    }
    const matches = pairs.filter(([d])=>d.toUpperCase().includes(q)).slice(0,60);
    ml.innerHTML = matches.map(([d])=>`<option value="${escHTML(d)}">`).join('');
  }

  // קוד פריט מהמיפוי
  const code = KNOWN_CODE_BY_DESC[desc] || '';
  if(codeEl && code) codeEl.value = code;

  // מידה מהתיאור — חיפוש pattern: 205/55R16, 10.00-20, 10.00R20, 315/80R22.5, 23x9R10 וכו'
  if(sizeEl && desc) {
    const sizeMatch = desc.match(/(\d[\d.]+\/[\d.]+R[\d.]+|\d[\d.]+[xX][\d.]+R[\d.]+|\d[\d.]+-[\d.]+(?:\.[\d]+)?(?:-[\d]+)?|\d+R\d+[\d.]*)/i);
    if(sizeMatch) sizeEl.value = sizeMatch[0];
  }
}
window.updateAutoComplete=updateAutoComplete;
window.onDescInput=onDescInput;
window.importExcel=importExcel;
window.openExcelImportPanel=openExcelImportPanel;
window.closeExcelImportPanel=closeExcelImportPanel;
window.handleExcelImportFile=handleExcelImportFile;
window.downloadExcelTemplate=downloadExcelTemplate;
window.applyColumnMap=applyColumnMap;
window.renderDashboard=renderDashboard;
window.zoomIn=zoomIn;
window.setMapTool=setMapTool;
window.setFloorFilter=setFloorFilter;
window.setMapSection=setMapSection;
window.closeCageItemsPanel=closeCageItemsPanel;

/* ══ WAREHOUSE CANVAS VIEW ══ */
window._formHighlight=null; // מזהה כלוב מוּדגש מטופס הוספת צמיג
let whScale=20, whOffX=14, whOffY=14, whFloorFilter=0;

// ── cache מפה — מחושב פעם אחת כשמשתנה items/cages ──
let _whCageMap=null;    // Map: cageId → items[]
let _whSecBuckets=null; // section buckets לכותרות
let _whRowMinX=null;    // ציר שורות
let _whColMinY=null;    // ציר עמודות
let _whResv=null;       // reservations מ-localStorage

function _whInvalidate(){ _whCageMap=null; _whSecBuckets=null; _whRowMinX=null; _whColMinY=null; _whResv=null; }
window._whInvalidate=_whInvalidate;

function _whBuildCache(){
  // ── מפת כלוב → פריטים ──
  _whCageMap=new Map();
  cages.forEach(g=>_whCageMap.set(g.id,[]));
  (window.items||[]).forEach(it=>{
    cages.forEach(g=>{
      if(String(it.col)!==String(g.name)) return;
      if(String(it.floor||'1')!==String(g.floor)) return;
      if(g.section==='rahava'){if(it.rahava==='כן') _whCageMap.get(g.id).push(it); return;}
      if(g.p1&&g.p1!==''){if(String(it.p1)===String(g.p1)) _whCageMap.get(g.id).push(it); return;}
      if(g.p2&&g.p2!==''){if(String(it.p2)===String(g.p2)) _whCageMap.get(g.id).push(it); return;}
      if(!it.p1&&!it.p2) _whCageMap.get(g.id).push(it);
    });
  });
  // ── section buckets ──
  _whSecBuckets={};
  cages.filter(g=>g.floor==='1').forEach(g=>{
    const k=g.section==='rahava'?'rahava':g.section==='between'?'between':g.pn2==='כן'?'turn2':g.pn1==='כן'?'turn1':'main';
    if(!_whSecBuckets[k]){_whSecBuckets[k]={minX:g.x,maxX:g.x,minY:g.y,maxY:g.y};}
    else{_whSecBuckets[k].minX=Math.min(_whSecBuckets[k].minX,g.x);_whSecBuckets[k].maxX=Math.max(_whSecBuckets[k].maxX,g.x);_whSecBuckets[k].minY=Math.min(_whSecBuckets[k].minY,g.y);_whSecBuckets[k].maxY=Math.max(_whSecBuckets[k].maxY,g.y);}
  });
  // ── מספרי שורות ──
  // לא-מסובב: label משמאל לשורה → minX לכל (y, rowNum)
  // מסובב:    label מעל לעמודה  → minY לכל (x, rowNum)
  _whRowMinX={};
  const _whRowMinY_tmp={};
  cages.filter(g=>g.floor==='1').forEach(g=>{
    const rn=g.p1||g.p2; if(!rn) return;
    if(!g.rot){
      const k=`${g.y}__${rn}`;
      if(_whRowMinX[k]===undefined||g.x<_whRowMinX[k]) _whRowMinX[k]=g.x;
    } else {
      const k=`${g.x}__${rn}`;
      if(_whRowMinY_tmp[k]===undefined||g.y<_whRowMinY_tmp[k]) _whRowMinY_tmp[k]=g.y;
    }
  });
  _whRowMinX.__rotated = _whRowMinY_tmp; // שמור sub-map בתוך הcache
  // ── מספרי עמודות ──
  // לא-מסובב: label מעל עמודה  → minY לכל (x, colName)
  // מסובב:    label משמאל      → minX לכל (y, colName)
  _whColMinY={};
  const _whColMinX_tmp={};
  cages.filter(g=>g.floor==='1').forEach(g=>{
    if(!g.rot){
      const k=`${g.x}__${g.name}`;
      if(_whColMinY[k]===undefined||g.y<_whColMinY[k]) _whColMinY[k]=g.y;
    } else {
      const k=`${g.y}__${g.name}`;
      if(_whColMinX_tmp[k]===undefined||g.x<_whColMinX_tmp[k]) _whColMinX_tmp[k]=g.x;
    }
  });
  _whColMinY.__rotated = _whColMinX_tmp;
  // ── reservations ──
  try{ _whResv=JSON.parse(localStorage.getItem('tirewms_reservations')||'{}'); }catch(e){ _whResv={}; }
}

// throttle: ממתין frame אחד בלבד לפני ציור
let _whRafId=null;
function renderWarehouseThrottled(){
  if(_whRafId) return;
  _whRafId=requestAnimationFrame(()=>{ _whRafId=null; renderWarehouse(); });
}
let whIsPanning=false, whPanStartX=0, whPanStartY=0, whPanOffX=0, whPanOffY=0;
let whPinchDist=null;

function whZoomIn(){ whScale=Math.min(80,whScale*1.25); renderWarehouse(); }
function whZoomOut(){ whScale=Math.max(8,whScale*0.8); renderWarehouse(); }
function whCenter(){
  const cv=document.getElementById('whCanvas');
  const wrap=document.getElementById('whMapWrap');
  if(!cv) return;
  // resize first so dimensions are correct
  if(wrap){ cv.width=wrap.clientWidth||window.innerWidth; cv.height=wrap.clientHeight||(window.innerHeight-180); }
  if(cages.length===0){ whOffX=14; whOffY=14; whScale=16; renderWarehouse(); return; }
  const xs=cages.map(g=>g.x), ys=cages.map(g=>g.y);
  const minX=Math.min(...xs), maxX=Math.max(...xs);
  const minY=Math.min(...ys), maxY=Math.max(...ys);
  const pad=48;
  // חישוב scale אבסולוטי — fit-to-screen
  whScale=Math.max(6,Math.min(40,Math.min(
    (cv.width -pad*2)/(maxX-minX+2),
    (cv.height-pad*2)/(maxY-minY+2)
  )));
  const midX=(minX+maxX+1)/2, midY=(minY+maxY+1)/2;
  whOffX=cv.width/2  - midX*whScale;
  whOffY=cv.height/2 - midY*whScale;
  renderWarehouse();
}

function setWhFloor(f){
  whFloorFilter=f;
  ['all',1,2,3].forEach(id=>{
    const btn=document.getElementById('wfl-'+(id==='all'?'all':id));
    if(!btn) return;
    const isActive=(id==='all'&&f===0)||(id===f);
    const colors={1:'var(--f1)',2:'var(--f2)',3:'var(--f3)'};
    if(isActive){ btn.style.background=id==='all'?'var(--accent)':(colors[id]||'var(--accent)'); btn.style.color='#111'; btn.style.border='none'; }
    else { btn.style.background='var(--card)'; btn.style.color=id==='all'?'var(--muted)':(colors[id]||'var(--muted)'); btn.style.border='1px solid '+(id==='all'?'var(--border)':(colors[id]||'var(--border)')); }
  });
  renderWarehouse();
}

let _whNavPath=null;

function _whAstar(obs,sx,sy,ex,ey){
  const K=(x,y)=>x*10000+y, H=(x,y)=>Math.abs(x-ex)+Math.abs(y-ey);
  const DIRS=[[0,1],[0,-1],[1,0],[-1,0]];
  const openMap=new Map(), closed=new Set();
  const open=[];
  const s={g:0,f:H(sx,sy),x:sx,y:sy,p:null};
  openMap.set(K(sx,sy),s); open.push(s);
  let iter=0;
  while(open.length&&iter++<8000){
    let bi=0; for(let i=1;i<open.length;i++) if(open[i].f<open[bi].f) bi=i;
    const cur=open.splice(bi,1)[0];
    const ck=K(cur.x,cur.y);
    if(closed.has(ck)) continue;
    closed.add(ck); openMap.delete(ck);
    if(cur.x===ex&&cur.y===ey){
      const path=[]; let c=cur; while(c){path.unshift([c.x,c.y]);c=c.p;} return path;
    }
    for(const [dx,dy] of DIRS){
      const nx=cur.x+dx, ny=cur.y+dy, nk=K(nx,ny);
      if(closed.has(nk)||obs.has(nk)) continue;
      const ng=cur.g+1;
      const ex2=openMap.get(nk);
      if(!ex2||ex2.g>ng){
        const node={g:ng,f:ng+H(nx,ny),x:nx,y:ny,p:cur};
        openMap.set(nk,node); open.push(node);
      }
    }
  }
  return null;
}

function _computeWhNav(itemId){
  const it=items.find(x=>x.id===itemId);
  if(!it){_whNavPath=null;return false;}
  const fl=String(it.floor||'1');
  const tg=cages.find(g=>String(g.name)===String(it.col)&&String(g.floor||'1')===fl);
  if(!tg){_whNavPath=null;return false;}
  const K=(x,y)=>Math.floor(x)*10000+Math.floor(y);
  const obs=new Set();
  cages.forEach(g=>{ if(g.id!==tg.id) obs.add(K(g.x,g.y)); });
  const xs=cages.map(g=>g.x), ys=cages.map(g=>g.y);
  const minX=Math.floor(Math.min(...xs)), maxX=Math.ceil(Math.max(...xs));
  const minY=Math.floor(Math.min(...ys)), maxY=Math.ceil(Math.max(...ys));
  const midY=Math.round((minY+maxY)/2);
  const gx=minX-2, gy=midY;
  const tx=Math.floor(tg.x), ty=Math.floor(tg.y);
  const path=_whAstar(obs,gx,gy,tx,ty)||[[gx,gy],[tx,ty]];
  _whNavPath={path,gx,gy,tid:tg.id};
  // גלול לכלוב
  const cv=document.getElementById('whCanvas');
  if(cv){
    const px=whOffX+(tx+0.5)*whScale, py=whOffY+(ty+0.5)*whScale;
    const vcx=cv.width/2, vcy=cv.height/2;
    if(Math.abs(px-vcx)>cv.width*0.32||Math.abs(py-vcy)>cv.height*0.32){
      whOffX+=(vcx-px)*0.75; whOffY+=(vcy-py)*0.75;
    }
  }
  return true;
}

window.showWhPath=function(itemId){
  _computeWhNav(itemId);
  const nb=document.getElementById('nav-warehouse');
  if(nb) switchView('warehouse',nb);
  closeLocationPanel();
  setTimeout(renderWarehouse,80);
};

function renderWarehouse(){
  const cv=document.getElementById('whCanvas');
  const wrap=document.getElementById('whMapWrap');
  if(!cv||!wrap) return;

  // resize רק כשצריך
  const nw=wrap.clientWidth||window.innerWidth, nh=wrap.clientHeight||(window.innerHeight-180);
  if(cv.width!==nw||cv.height!==nh){ cv.width=nw; cv.height=nh; }

  const ctx=cv.getContext('2d');
  ctx.fillStyle='#0d1117'; ctx.fillRect(0,0,cv.width,cv.height);

  // בנה cache אם חסר
  if(!_whCageMap) _whBuildCache();
  const cmap=_whCageMap;
  const sb=_whSecBuckets;
  const rowMinX=_whRowMinX;
  const colMinY=_whColMinY;
  const resv=_whResv||{};

  // ═══ כותרות אזורים ═══
  const _secLbl={main:'🏭 מחסן ראשי',between:'↔ מעבר',turn1:'↩ פניה א׳',turn2:'↩ פניה ב׳',rahava:'📦 רחבה'};
  const _secClr={main:'#4a9eff',between:'#4a9eff',turn1:'#3ecf8e',turn2:'#f5a623',rahava:'#a068f0'};
  const fs=Math.max(9,Math.min(15,whScale*0.75));
  ctx.font=`bold ${fs}px Heebo`; ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.shadowColor='#000'; ctx.shadowBlur=4;
  Object.entries(sb).forEach(([k,s])=>{
    const cx=whOffX+((s.minX+s.maxX)/2+0.5)*whScale;
    const cy=whOffY+s.minY*whScale-10;
    if(cy<-30||cy>cv.height+30) return;
    ctx.fillStyle=_secClr[k]||'#ccc';
    ctx.fillText(_secLbl[k]||k,cx,cy);
  });
  ctx.shadowBlur=0;

  // ═══ כלובים ═══
  const _secFill={main:'#111928',between:'#0e1520',turn1:'#0e1f16',turn2:'#1c1408',rahava:'#1a1030'};
  const _secStroke={main:'#1e3060',between:'#1a2850',turn1:'#1e4030',turn2:'#50301a',rahava:'#402060'};
  const _flrClr={'1':'#4a9eff','2':'#3ecf8e','3':'#f5a623'};
  const vis=whFloorFilter===0?cages:cages.filter(g=>String(g.floor)===String(whFloorFilter));
  vis.forEach(g=>{
    const px=whOffX+g.x*whScale, py=whOffY+g.y*whScale;
    const pw=whScale;
    if(px+pw<-2||px>cv.width+2||py+pw<-2||py>cv.height+2) return;
    const ci=cmap.get(g.id)||[];
    const has=ci.length>0;
    const fm=whFloorFilter===0||String(g.floor)===String(whFloorFilter);
    ctx.globalAlpha=fm?1:0.12;
    const secKey=g.section==='rahava'?'rahava':g.section==='between'?'between':g.pn2==='כן'?'turn2':g.pn1==='כן'?'turn1':'main';
    const flrC=_flrClr[g.floor]||'#4a9eff';
    ctx.fillStyle=has?`${flrC}33`:_secFill[secKey];
    ctx.strokeStyle=has?flrC:_secStroke[secKey];
    ctx.lineWidth=has?1.5:0.8;
    const r=Math.min(3,pw*0.18);
    ctx.beginPath();
    ctx.moveTo(px+r,py); ctx.lineTo(px+pw-r,py);
    ctx.arcTo(px+pw,py,px+pw,py+r,r);
    ctx.lineTo(px+pw,py+pw-r);
    ctx.arcTo(px+pw,py+pw,px+pw-r,py+pw,r);
    ctx.lineTo(px+r,py+pw);
    ctx.arcTo(px,py+pw,px,py+pw-r,r);
    ctx.lineTo(px,py+r);
    ctx.arcTo(px,py,px+r,py,r);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if(pw>=10){
      const rowN=g.p1||g.p2||(g.section==='rahava'&&g.rahavaRow?'ר'+g.rahavaRow:'');
      const colN=g.name||'?';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      if(pw>=20&&rowN){
        ctx.fillStyle=has?flrC:'rgba(255,255,255,0.55)';
        ctx.font=`bold ${Math.min(10,pw*0.45)}px Heebo`;
        ctx.fillText(rowN,px+pw/2,py+pw/2-pw*0.13);
        ctx.fillStyle='rgba(255,255,255,0.25)';
        ctx.font=`${Math.min(8,pw*0.34)}px Heebo`;
        ctx.fillText('עמ׳'+colN,px+pw/2,py+pw/2+pw*0.16);
      } else {
        ctx.fillStyle=has?flrC:'rgba(255,255,255,0.4)';
        ctx.font=`bold ${Math.min(10,pw*0.5)}px Heebo`;
        ctx.fillText(colN,px+pw/2,py+pw/2);
      }
    }
    if(has){ const _bs=Math.max(5,Math.min(8,pw*0.35)); ctx.fillStyle=flrC; ctx.beginPath(); ctx.arc(px+pw-_bs,py+_bs,_bs,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#0d1117'; ctx.font=`bold ${_bs*0.9|0}px Heebo`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(ci.length,px+pw-_bs,py+_bs); }
    if(!has&&g.floor==='1'){ const _rsz=resv[String(g.name)]; if(_rsz&&pw>20){ ctx.fillStyle='rgba(74,158,255,0.18)'; const rr=3; ctx.beginPath();ctx.moveTo(px+rr,py);ctx.lineTo(px+pw-rr,py);ctx.arcTo(px+pw,py,px+pw,py+rr,rr);ctx.lineTo(px+pw,py+pw-rr);ctx.arcTo(px+pw,py+pw,px+pw-rr,py+pw,rr);ctx.lineTo(px+rr,py+pw);ctx.arcTo(px,py+pw,px,py+pw-rr,rr);ctx.lineTo(px,py+rr);ctx.arcTo(px,py,px+rr,py,rr);ctx.closePath();ctx.fill(); ctx.fillStyle='#4a9eff';ctx.font=`bold ${Math.min(9,pw/3.5)}px Heebo`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(_rsz,px+pw/2,py+pw-3); } }
    ctx.globalAlpha=1;
  });

  // ══ מסלול ניווט A* ══
  if(_whNavPath&&_whNavPath.path&&_whNavPath.path.length>=2){
    const p=_whNavPath.path;
    ctx.save();
    ctx.globalAlpha=0.88;
    ctx.shadowColor='#fff700'; ctx.shadowBlur=18;
    ctx.strokeStyle='#fff700';
    ctx.lineWidth=Math.max(2.5,whScale*0.2);
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.setLineDash([whScale*0.38,whScale*0.16]);
    ctx.beginPath();
    p.forEach(([wx,wy],i)=>{
      const ppx=whOffX+(wx+0.5)*whScale, ppy=whOffY+(wy+0.5)*whScale;
      i===0?ctx.moveTo(ppx,ppy):ctx.lineTo(ppx,ppy);
    });
    ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur=0;
    // כניסה — עיגול ירוק
    const[sx2,sy2]=p[0];
    const spx=whOffX+(sx2+0.5)*whScale, spy=whOffY+(sy2+0.5)*whScale;
    const r0=Math.max(5,whScale*0.3);
    ctx.fillStyle='#00e676'; ctx.shadowColor='#00e676'; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.arc(spx,spy,r0,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0; ctx.fillStyle='#00e676';
    ctx.font=`bold ${Math.max(9,whScale*0.42)}px Heebo`;
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('🚪 כניסה',spx,spy-r0-2);
    // יעד — עיגול אדום
    const[ex2,ey2]=p[p.length-1];
    const epx=whOffX+(ex2+0.5)*whScale, epy=whOffY+(ey2+0.5)*whScale;
    ctx.fillStyle='#ff4444'; ctx.shadowColor='#ff4444'; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.arc(epx,epy,r0,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.restore();
  }

  // ══ מספרי שורות ועמודות (ציר — מה-cache) ══
  const _axFs=Math.max(7,Math.min(12,whScale*0.55));
  ctx.font=`bold ${_axFs}px Heebo`;

  // שורות לא-מסובבות: label משמאל
  ctx.fillStyle='rgba(160,190,255,0.85)';
  ctx.textAlign='right'; ctx.textBaseline='middle';
  Object.entries(rowMinX).forEach(([k,minX])=>{
    if(k==='__rotated') return;
    const [yStr,rn]=k.split('__');
    const lx=whOffX+minX*whScale-3, ly=whOffY+parseInt(yStr)*whScale+whScale*0.5;
    if(ly<-10||ly>cv.height+10) return;
    ctx.fillText('ש'+rn,lx,ly);
  });
  // שורות מסובבות: label מעל
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  if(rowMinX.__rotated) Object.entries(rowMinX.__rotated).forEach(([k,minY])=>{
    const [xStr,rn]=k.split('__');
    const lx=whOffX+parseInt(xStr)*whScale+whScale*0.5, ly=whOffY+minY*whScale-3;
    if(lx<-10||lx>cv.width+10) return;
    ctx.fillText('ש'+rn,lx,ly);
  });

  // עמודות לא-מסובבות: label מעל
  ctx.fillStyle='rgba(245,190,60,0.85)';
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  Object.entries(colMinY).forEach(([k,minY])=>{
    if(k==='__rotated') return;
    const [xStr,cn]=k.split('__');
    const lx=whOffX+parseInt(xStr)*whScale+whScale*0.5, ly=whOffY+minY*whScale-3;
    if(lx<-10||lx>cv.width+10) return;
    ctx.fillText(cn,lx,ly);
  });
  // עמודות מסובבות: label משמאל
  ctx.textAlign='right'; ctx.textBaseline='middle';
  if(colMinY.__rotated) Object.entries(colMinY.__rotated).forEach(([k,minX])=>{
    const [yStr,cn]=k.split('__');
    const lx=whOffX+minX*whScale-3, ly=whOffY+parseInt(yStr)*whScale+whScale*0.5;
    if(ly<-10||ly>cv.height+10) return;
    ctx.fillText(cn,lx,ly);
  });

  // ══ הדגשת כלוב מטופס הוספת צמיג ══
  if(window._formHighlight){
    const hg=cages.find(g=>g.id===window._formHighlight);
    if(hg){
      const px=whOffX+hg.x*whScale, py=whOffY+hg.y*whScale;
      const pw=whScale, ph=whScale;
      ctx.globalAlpha=1;
      ctx.save();
      ctx.shadowColor='#fff700'; ctx.shadowBlur=16;
      ctx.strokeStyle='#fff700'; ctx.lineWidth=3;
      ctx.strokeRect(px+1,py+1,pw-2,ph-2);
      ctx.restore();
      ctx.fillStyle='rgba(255,247,0,0.18)';
      ctx.fillRect(px+1,py+1,pw-2,ph-2);
      // גלול אוטומטית אם הכלוב מחוץ לתצוגה
      const cx=px+pw/2, cy=py+ph/2;
      const vcx=cv.width/2, vcy=cv.height/2;
      if(Math.abs(cx-vcx)>cv.width*0.38||Math.abs(cy-vcy)>cv.height*0.38){
        whOffX+=(vcx-cx)*0.35; whOffY+=(vcy-cy)*0.35;
      }
    }
  }

  if(!cv._whInit){
    cv._whInit=true;
    let _tap=0;
    cv.addEventListener('touchstart',e=>{ e.preventDefault(); if(e.touches.length===2){ whPinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); return; } const r=cv.getBoundingClientRect(); whIsPanning=true; whPanStartX=e.touches[0].clientX-r.left; whPanStartY=e.touches[0].clientY-r.top; whPanOffX=whOffX; whPanOffY=whOffY; _tap=Date.now(); },{passive:false});
    cv.addEventListener('touchmove',e=>{ e.preventDefault(); if(e.touches.length===2&&whPinchDist){ const nd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); whScale=Math.max(8,Math.min(80,whScale*(nd/whPinchDist))); whPinchDist=nd; renderWarehouse(); return; } if(!whIsPanning) return; const r=cv.getBoundingClientRect(); whOffX=whPanOffX+(e.touches[0].clientX-r.left-whPanStartX); whOffY=whPanOffY+(e.touches[0].clientY-r.top-whPanStartY); renderWarehouse(); },{passive:false});
    cv.addEventListener('touchend',e=>{ e.preventDefault(); whPinchDist=null; whIsPanning=false; if(Date.now()-_tap<200&&e.changedTouches.length===1){ const r=cv.getBoundingClientRect(); whHandleClick(e.changedTouches[0].clientX-r.left,e.changedTouches[0].clientY-r.top); } },{passive:false});
    let _md=false;
    cv.addEventListener('mousedown',e=>{ _md=true; const r=cv.getBoundingClientRect(); whIsPanning=true; whPanStartX=e.clientX-r.left; whPanStartY=e.clientY-r.top; whPanOffX=whOffX; whPanOffY=whOffY; });
    cv.addEventListener('mousemove',e=>{ if(!whIsPanning) return; const r=cv.getBoundingClientRect(); whOffX=whPanOffX+(e.clientX-r.left-whPanStartX); whOffY=whPanOffY+(e.clientY-r.top-whPanStartY); renderWarehouse(); });
    cv.addEventListener('mouseup',e=>{ whIsPanning=false; if(_md){ const r=cv.getBoundingClientRect(); whHandleClick(e.clientX-r.left,e.clientY-r.top); } _md=false; });
    window.addEventListener('resize',()=>{ if(document.getElementById('viewWarehouse')?.classList.contains('active')) renderWarehouse(); });
  }
}

function whHandleClick(cx,cy){
  const wx=(cx-whOffX)/whScale, wy=(cy-whOffY)/whScale;
  for(let i=cages.length-1;i>=0;i--){
    const g=cages[i];
    if(wx>=g.x&&wx<g.x+1&&wy>=g.y&&wy<g.y+1){ showWhCageDetail(g); return; }
  }
}

function showWhCageDetail(g){
  const ff=whFloorFilter===0?null:String(whFloorFilter);
  const ci=items.filter(it=>String(it.col)===String(g.name)&&(!ff||String(it.floor)===ff));
  if(ci.length===0){ toast('📦 '+(currentLang==='ar'?'خلية فارغة':'כלוב ריק')+' — '+g.name); return; }
  const fc={'1':'var(--f1)','2':'var(--f2)','3':'var(--f3)'};
  let body=`<div style="font-size:12px;color:var(--muted);margin-bottom:10px;">${currentLang==='ar'?'العمود':'עמודה'} <b style="color:var(--accent)">${escHTML(g.name)}</b> · ${ci.length} ${t('tiresCount')}</div>`;
  const bf={};
  ci.forEach(it=>{ const f=it.floor||'1'; (bf[f]=bf[f]||[]).push(it); });
  Object.keys(bf).sort().forEach(f=>{
    const color=fc[f]||'var(--accent)';
    body+=`<div style="margin-bottom:10px;"><div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span class="floor-badge floor-${f}">${f}</span><span style="font-size:11px;font-weight:700;color:${color};">${currentLang==='ar'?'طابق':'קומה'} ${f}</span></div>`;
    bf[f].forEach(it=>{ body+=`<div onclick="showItemLocation(${it.id})" style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px;cursor:pointer;display:flex;align-items:center;gap:10px;"><span style="font-family:monospace;font-size:14px;font-weight:900;color:var(--accent);">${sz(it)}</span><span style="font-weight:700;">${escHTML(it.brand)}</span>${it.model?`<span style="font-size:11px;color:var(--muted);">${escHTML(it.model)}</span>`:''}</div>`; });
    body+='</div>';
  });
  document.getElementById('cellDetailTitle').innerHTML=`📦 ${escHTML(g.name)}`;
  document.getElementById('cellDetailBody').innerHTML=body;
  document.getElementById('cellDetail').style.display='block';
}

function closeCellDetail(){ document.getElementById('cellDetail').style.display='none'; }


window.whZoomIn=whZoomIn;
window.whZoomOut=whZoomOut;
window.whCenter=whCenter;
window.setWhFloor=setWhFloor;
window.closeCellDetail=closeCellDetail;
window.openAccessPanel=openAccessPanel;
window.closeAccessPanel=closeAccessPanel;
window.toggleTheme=toggleTheme;
window.toggleFont=toggleFont;
window.toggleBigButtons=toggleBigButtons;
window.toggleVibration=toggleVibration;
window.zoomOut=zoomOut;
window.centerMap=centerMap;
window.nextPage=nextPage;
window.toggleLang=toggleLang;
window.formatSize=formatSize;
window.parseSize=parseSize;
window.applyLang=applyLang;
window.t=t;
if(typeof saveEdit!=="undefined") window.saveEdit=saveEdit;
if(typeof closeAddOutside!=="undefined") window.closeAddOutside=closeAddOutside;
if(typeof clearFilters!=="undefined") window.clearFilters=clearFilters;
if(typeof whZoomIn!=="undefined") window.whZoomIn=whZoomIn;
if(typeof whCenter!=="undefined") window.whCenter=whCenter;
if(typeof centerMap!=="undefined") window.centerMap=centerMap;
if(typeof setWhFloor!=="undefined") window.setWhFloor=setWhFloor;
if(typeof parseSize!=="undefined") window.parseSize=parseSize;
if(typeof askDelete!=="undefined") window.askDelete=askDelete;
if(typeof rotateCage!=="undefined") window.rotateCage=rotateCage;
if(typeof applyLang!=="undefined") window.applyLang=applyLang;
if(typeof closeCageItemsPanel!=="undefined") window.closeCageItemsPanel=closeCageItemsPanel;
if(typeof locateNearest!=="undefined") window.locateNearest=locateNearest;
if(typeof addItem!=="undefined") window.addItem=addItem;
if(typeof addCage!=="undefined") window.addCage=addCage;
if(typeof deleteCage!=="undefined") window.deleteCage=deleteCage;
if(typeof setFloorFilter!=="undefined") window.setFloorFilter=setFloorFilter;
if(typeof zoomIn!=="undefined") window.zoomIn=zoomIn;
if(typeof renderDashboard!=="undefined") window.renderDashboard=renderDashboard;

if(typeof applyFilters!=="undefined") window.applyFilters=applyFilters;
if(typeof showBackupMenu!=="undefined") window.showBackupMenu=showBackupMenu;
if(typeof toggleFont!=="undefined") window.toggleFont=toggleFont;
if(typeof toggleLang!=="undefined") window.toggleLang=toggleLang;
if(typeof clearMap!=="undefined") window.clearMap=clearMap;
if(typeof sortBy!=="undefined") window.sortBy=sortBy;
if(typeof toggleBigButtons!=="undefined") window.toggleBigButtons=toggleBigButtons;
if(typeof updateAutoComplete!=="undefined") window.updateAutoComplete=updateAutoComplete;
if(typeof applyColumnMap!=="undefined") window.applyColumnMap=applyColumnMap;
if(typeof setFloor!=="undefined") window.setFloor=setFloor;
if(typeof cancelEdit!=="undefined") window.cancelEdit=cancelEdit;
if(typeof resetTurnButtons!=="undefined") window.resetTurnButtons=resetTurnButtons;
if(typeof renderWarehouse!=="undefined") window.renderWarehouse=renderWarehouse;
if(typeof setMapTool!=="undefined") window.setMapTool=setMapTool;
if(typeof showCellDetail!=="undefined") window.showCellDetail=showCellDetail;
if(typeof nextPage!=="undefined") window.nextPage=nextPage;
if(typeof formatSize!=="undefined") window.formatSize=formatSize;
if(typeof importJSON!=="undefined") window.importJSON=importJSON;
if(typeof clearSearch!=="undefined") window.clearSearch=clearSearch;
if(typeof saveMapLayout!=="undefined") window.saveMapLayout=saveMapLayout;
if(typeof toggleRahava!=="undefined") window.toggleRahava=toggleRahava;
window.saveBarcodeMemory=saveBarcodeMemory;
window.parseQRData=parseQRData;
window.getBarcodeMemory=getBarcodeMemory;
if(typeof closeAddModal!=="undefined") window.closeAddModal=closeAddModal;
if(typeof doDelete!=="undefined") window.doDelete=doDelete;
if(typeof openAddModal!=="undefined") window.openAddModal=openAddModal;
if(typeof closeConf!=="undefined") window.closeConf=closeConf;
if(typeof openLocationEdit!=="undefined") window.openLocationEdit=openLocationEdit;
if(typeof closeLocEdit!=="undefined") window.closeLocEdit=closeLocEdit;
if(typeof saveLocEdit!=="undefined") window.saveLocEdit=saveLocEdit;
if(typeof markAsDone!=="undefined") window.markAsDone=markAsDone;
if(typeof openPendingPanel!=="undefined") window.openPendingPanel=openPendingPanel;
if(typeof closePendingPanel!=="undefined") window.closePendingPanel=closePendingPanel;
if(typeof approveDeletion!=="undefined") window.approveDeletion=approveDeletion;
if(typeof cancelPending!=="undefined") window.cancelPending=cancelPending;
if(typeof exportJSON!=="undefined") window.exportJSON=exportJSON;
if(typeof prevPage!=="undefined") window.prevPage=prevPage;
if(typeof startEdit!=="undefined") window.startEdit=startEdit;
if(typeof toggleTheme!=="undefined") window.toggleTheme=toggleTheme;
if(typeof whZoomOut!=="undefined") window.whZoomOut=whZoomOut;
if(typeof saveCageEdit!=="undefined") window.saveCageEdit=saveCageEdit;
if(typeof clearAllData!=="undefined") window.clearAllData=clearAllData;
if(typeof toggleTurn!=="undefined") window.toggleTurn=toggleTurn;
if(typeof openAccessPanel!=="undefined") window.openAccessPanel=openAccessPanel;
if(typeof closeAccessPanel!=="undefined") window.closeAccessPanel=closeAccessPanel;
if(typeof importExcel!=="undefined") window.importExcel=importExcel;
if(typeof handleSearchInput!=="undefined") window.handleSearchInput=handleSearchInput;
if(typeof closeCellDetail!=="undefined") window.closeCellDetail=closeCellDetail;
if(typeof zoomOut!=="undefined") window.zoomOut=zoomOut;
if(typeof closeCageEdit!=="undefined") window.closeCageEdit=closeCageEdit;
if(typeof closeBackupMenu!=="undefined") window.closeBackupMenu=closeBackupMenu;
if(typeof toggleVibration!=="undefined") window.toggleVibration=toggleVibration;
if(typeof switchView!=="undefined") window.switchView=switchView;
if(typeof undoMap!=="undefined") window.undoMap=undoMap;
// Firebase יאתחל ויקרא ל-startSync

// ══ GOOGLE DRIVE BACKUP ══════════════════════════════════════════
const GD_SCOPE       = 'https://www.googleapis.com/auth/drive.file';
const GD_UPLOAD_URL  = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const GD_FILES_URL   = 'https://www.googleapis.com/drive/v3/files';
const GD_FOLDER_NAME = 'TireWMS Backups';
const GD_KEEP_LAST   = 10;

let _gdTokenClient  = null;
let _gdAccessToken  = null;
let _gdTokenExpiry  = 0;
let _gdFolderId     = null;
let _gdAutoInterval = null;

function _gdInit() {
  return new Promise((resolve, reject) => {
    if (_gdTokenClient) { resolve(); return; }
    const clientId = localStorage.getItem('tirewms_gdrive_client_id');
    if (!clientId) { reject(new Error('NO_CLIENT_ID')); return; }
    const check = () => {
      if (typeof google === 'undefined' || !google.accounts?.oauth2) { setTimeout(check, 200); return; }
      _gdTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GD_SCOPE,
        callback: ''
      });
      _gdFolderId = localStorage.getItem('tirewms_gdrive_folder') || null;
      resolve();
    };
    check();
  });
}

function _gdGetToken(cb) {
  if (_gdAccessToken && Date.now() < _gdTokenExpiry - 60000) { cb(null, _gdAccessToken); return; }
  if (!_gdTokenClient) { cb(new Error('GIS not initialised')); return; }
  _gdTokenClient.callback = resp => {
    if (resp.error) { _gdAccessToken = null; _gdTokenExpiry = 0; cb(new Error('Google auth: ' + resp.error)); return; }
    _gdAccessToken = resp.access_token;
    _gdTokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000;
    cb(null, _gdAccessToken);
  };
  _gdTokenClient.requestAccessToken({ prompt: '' });
}

async function _gdCreateFolder(token) {
  const q = encodeURIComponent(`name='${GD_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await fetch(`${GD_FILES_URL}?q=${q}&fields=files(id)`, { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) throw new Error('Drive folder search: ' + res.status);
  const data = await res.json();
  if (data.files?.length) {
    const fid = data.files[0].id;
    _gdFolderId = fid; localStorage.setItem('tirewms_gdrive_folder', fid); return fid;
  }
  const cr = await fetch(GD_FILES_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: GD_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
  });
  if (!cr.ok) throw new Error('Drive folder create: ' + cr.status);
  const fd = await cr.json();
  _gdFolderId = fd.id; localStorage.setItem('tirewms_gdrive_folder', fd.id); return fd.id;
}

function _gdSetStatus(msg, cls) {
  const el = document.getElementById('gdStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = cls || '';
}

async function _gdPruneOld(token, folderId) {
  try {
    const q = encodeURIComponent(`'${folderId}' in parents and name contains 'tirewms_backup_' and trashed=false`);
    const res = await fetch(`${GD_FILES_URL}?q=${q}&orderBy=createdTime desc&fields=files(id)&pageSize=50`, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) return;
    const files = (await res.json()).files || [];
    for (const f of files.slice(GD_KEEP_LAST)) {
      await fetch(`${GD_FILES_URL}/${f.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    }
  } catch(e) { console.warn('GDrive prune:', e); }
}

async function _gdListBackups(token, folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and name contains 'tirewms_backup_' and trashed=false`);
  const res = await fetch(`${GD_FILES_URL}?q=${q}&orderBy=createdTime desc&fields=files(id,name,createdTime,size)&pageSize=20`, { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) throw new Error('רשימת גיבויים: ' + res.status);
  return (await res.json()).files || [];
}

async function backupToGDrive() {
  if (!window.isOwnerMode) { toast('❌ גישה לבעלים בלבד'); return; }
  const btn = document.getElementById('gdBackupBtn');
  if (btn) btn.disabled = true;
  _gdSetStatus('⏳ מגבה...', '');
  try {
    await _gdInit();
    const token = await new Promise((res, rej) => _gdGetToken((e, t) => e ? rej(e) : res(t)));
    const folderId = _gdFolderId || await _gdCreateFolder(token);
    const now = new Date();
    const filename = `tirewms_backup_${now.toISOString().slice(0,19).replace(/:/g,'-')}.json`;
    const payload = JSON.stringify({
      v: 3, ts: now.getTime(), appId: 'tirewms',
      items: window.items || [],
      map: localStorage.getItem('tirewms_map2') || null,
      workers: window._workers || []
    });
    const metadata = JSON.stringify({ name: filename, parents: [folderId] });
    const boundary = 'tirewms_gd_' + Date.now();
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${payload}\r\n--${boundary}--`;
    const upRes = await fetch(GD_UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    });
    if (!upRes.ok) throw new Error('Upload ' + upRes.status + ': ' + (await upRes.text()).slice(0,80));
    await _gdPruneOld(token, folderId);
    _gdSetStatus(`✅ גובה: ${now.toLocaleTimeString('he-IL')}`, 'gd-ok');
    toast(`✅ גובה ${(window.items||[]).length} פריטים ל-Drive`);
  } catch(e) {
    console.error('GDrive backup:', e);
    if (e.message === 'NO_CLIENT_ID') { _gdSetStatus('❌ נדרש Client ID', 'gd-err'); _gdShowClientIdInput(); }
    else if (!navigator.onLine) { _gdSetStatus('❌ אין אינטרנט', 'gd-err'); toast('❌ אין חיבור לאינטרנט'); }
    else { _gdSetStatus('❌ שגיאת גיבוי', 'gd-err'); toast('❌ ' + e.message.slice(0,60)); }
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.backupToGDrive = backupToGDrive;

async function restoreFromGDrive() {
  if (!window.isOwnerMode) { toast('❌ גישה לבעלים בלבד'); return; }
  const panel = document.getElementById('gdRestorePanel');
  const list  = document.getElementById('gdRestoreList');
  panel.style.display = 'flex';
  list.innerHTML = '<div style="color:var(--muted);text-align:center;padding:30px;">⏳ טוען רשימה...</div>';
  try {
    await _gdInit();
    const token = await new Promise((res, rej) => _gdGetToken((e, t) => e ? rej(e) : res(t)));
    const folderId = _gdFolderId || await _gdCreateFolder(token);
    const files = await _gdListBackups(token, folderId);
    if (!files.length) { list.innerHTML = '<div style="color:var(--muted);text-align:center;padding:30px;">אין גיבויים ב-Drive עדיין</div>'; return; }
    list.innerHTML = files.map(f => {
      const dt = f.createdTime ? new Date(f.createdTime).toLocaleString('he-IL') : f.name;
      const kb = f.size ? Math.round(f.size/1024) + ' KB' : '';
      return `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div>
          <div style="font-size:13px;font-weight:700;">${escHTML(dt)}</div>
          <div style="font-size:11px;color:var(--muted);">${escHTML(f.name)}${kb?' · '+kb:''}</div>
        </div>
        <button class="btn btn-acc" style="padding:8px 14px;font-size:13px;flex-shrink:0;" onclick="_gdRestoreFile('${escHTML(f.id)}')">שחזר</button>
      </div>`;
    }).join('');
  } catch(e) {
    console.error('GDrive list:', e);
    list.innerHTML = `<div style="color:var(--red,#e85d3f);text-align:center;padding:30px;">❌ ${escHTML(e.message)}</div>`;
    if (e.message === 'NO_CLIENT_ID') _gdShowClientIdInput();
  }
}
window.restoreFromGDrive = restoreFromGDrive;

async function _gdRestoreFile(fileId) {
  try {
    const token = await new Promise((res, rej) => _gdGetToken((e, t) => e ? rej(e) : res(t)));
    const res = await fetch(`${GD_FILES_URL}/${fileId}?alt=media`, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error('הורדה: ' + res.status);
    const d = await res.json();
    if (d.appId !== 'tirewms') throw new Error('קובץ לא תואם');
    const its = Array.isArray(d.items) ? d.items : [];
    const wks = Array.isArray(d.workers) ? d.workers : null;
    const mapData = d.map || null;
    const dateStr = new Date(d.ts).toLocaleString('he-IL');
    let msg = `שחזר ${its.length} פריטים מגיבוי ${dateStr}?`;
    if (wks) msg += `\n(כולל ${wks.length} עובדים)`;
    if (!confirm(msg)) return;
    document.getElementById('gdRestorePanel').style.display = 'none';
    toast('⏳ משחזר...');
    if (its.length) await window._importItems(its);
    if (mapData) { localStorage.setItem('tirewms_map2', mapData); if(typeof renderWarehouse==='function') renderWarehouse(); }
    if (wks?.length && confirm(`גם לשחזר ${wks.length} עובדים?`)) {
      window._workers = wks;
      if (window._saveWorkersDoc) await window._saveWorkersDoc();
    }
    toast(`✅ שוחזרו ${its.length} פריטים מ-Drive`);
  } catch(e) {
    console.error('GDrive restore:', e);
    toast('❌ ' + e.message.slice(0,60));
  }
}
window._gdRestoreFile = _gdRestoreFile;

function _gdSaveClientId() {
  const val = (document.getElementById('gdClientIdInput')||{}).value||'';
  if (!val.trim()) { toast('❌ הזן Client ID'); return; }
  localStorage.setItem('tirewms_gdrive_client_id', val.trim());
  _gdTokenClient = null;
  document.getElementById('gdClientIdWrap').style.display = 'none';
  toast('✅ Client ID נשמר');
}
window._gdSaveClientId = _gdSaveClientId;

function _gdShowClientIdInput() {
  const wrap = document.getElementById('gdClientIdWrap');
  if (!wrap) return;
  wrap.style.display = 'block';
  const saved = localStorage.getItem('tirewms_gdrive_client_id');
  if (saved) document.getElementById('gdClientIdInput').value = saved;
}

function _gdConfigure() {
  _gdShowClientIdInput();
  _gdAccessToken = null; _gdTokenExpiry = 0; _gdTokenClient = null;
}
window._gdConfigure = _gdConfigure;

function _gdStartAutoBackup() {
  if (_gdAutoInterval) return;
  if (!localStorage.getItem('tirewms_gdrive_client_id')) return;
  _gdAutoInterval = setInterval(() => {
    if (!window.isOwnerMode) return;
    backupToGDrive().catch(e => console.warn('GDrive auto-backup:', e));
  }, 60 * 60 * 1000);
}
window._gdStartAutoBackup = _gdStartAutoBackup;

// הצג שדה Client ID אם לא הוגדר
(function _gdInitUI() {
  if (typeof document === 'undefined') return;
  const run = () => {
    if (!localStorage.getItem('tirewms_gdrive_client_id')) {
      const wrap = document.getElementById('gdClientIdWrap');
      if (wrap) wrap.style.display = 'block';
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
// ══ DROPDOWN EVENT DELEGATION — מניעת XSS ══
function _initDropListeners(){
  const brandDrop=document.getElementById('brandDrop');
  const descDrop=document.getElementById('descDrop');
  if(brandDrop){
    brandDrop.addEventListener('mousedown',e=>{
      const item=e.target.closest('[data-val]');
      if(!item) return;
      e.preventDefault();
      const val=item.dataset.val;
      const target=item.dataset.target;
      const isFilter=item.dataset.isfilter==='1';
      const el=document.getElementById(target);
      if(el) el.value=val;
      brandDrop.style.display='none';
      if(isFilter) applyFilters();
      else if(typeof updateAutoComplete==='function') updateAutoComplete();
    });
  }
  if(descDrop){
    descDrop.addEventListener('mousedown',e=>{
      const item=e.target.closest('[data-val]');
      if(!item) return;
      e.preventDefault();
      const val=item.dataset.val;
      const el=document.getElementById('aMo');
      if(el){ el.value=val; if(typeof onDescInput==='function') onDescInput(el); }
      descDrop.style.display='none';
    });
  }
  const blockedBrandDrop=document.getElementById('blockedBrandDrop');
  if(blockedBrandDrop){
    blockedBrandDrop.addEventListener('mousedown',e=>{
      const item=e.target.closest('[data-bval]');
      if(!item) return;
      e.preventDefault();
      toggleBlockedBrand(item.dataset.bval);
    });
  }
}
(function(){
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_initDropListeners);
  else _initDropListeners();
})();
// ══ END GOOGLE DRIVE BACKUP ══════════════════════════════════════
