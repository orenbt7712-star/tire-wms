// Central event dispatcher — מחליף את כל ה-inline event handlers ב-HTML
// מאפשר הסרת 'unsafe-inline' מה-CSP

function _parseArg(s){
  if(s===undefined||s==='') return s;
  if(s==='true') return true;
  if(s==='false') return false;
  if(s==='null') return null;
  const n=Number(s);
  return isNaN(n)?s:n;
}

// ── Click dispatcher ──
document.addEventListener('click', function(e){
  // data-self-hide: סגירת overlay בלחיצה על הרקע
  const selfHide=e.target.closest('[data-self-hide]');
  if(selfHide && e.target===selfHide){ selfHide.style.display='none'; return; }

  // data-stop-prop: עצור התפשטות
  if(e.target.closest('[data-stop-prop]')){ e.stopPropagation(); }

  // data-trigger: הפעלת input.click() על אלמנט אחר
  const trigEl=e.target.closest('[data-trigger]');
  if(trigEl){ const t=document.getElementById(trigEl.dataset.trigger); if(t) t.click(); return; }

  // data-remove: הסרת אלמנט מה-DOM
  const removeEl=e.target.closest('[data-remove]');
  if(removeEl){ const r=document.getElementById(removeEl.dataset.remove); if(r) r.remove(); return; }

  // data-action: קריאה לפונקציה
  const el=e.target.closest('[data-action]');
  if(!el) return;
  const action=el.dataset.action;
  const fn=window[action];
  if(typeof fn!=='function'){ console.warn('data-action: unknown function',action); return; }
  const args=el.dataset.args ? el.dataset.args.split('|').map(_parseArg) : [];
  fn(...args, el);
});

// ── oninput dispatcher ──
document.addEventListener('input', function(e){
  const el=e.target.closest('[data-oninput]');
  if(!el) return;
  el.dataset.oninput.split(';').forEach(cmd=>{
    const [fn,...parts]=cmd.trim().split(':');
    const f=window[fn];
    if(typeof f==='function') f(el,...parts.map(_parseArg));
  });
});

// ── onchange dispatcher ──
document.addEventListener('change', function(e){
  const el=e.target.closest('[data-onchange]');
  if(!el) return;
  const [fn,...parts]=el.dataset.onchange.split(':');
  const f=window[fn];
  if(typeof f==='function') f(el,...parts.map(_parseArg));
});

// ── Specific listeners (cannot be generalized) ──
document.addEventListener('DOMContentLoaded', function(){

  // ── Search field ──
  const mainSearch=document.getElementById('mainSearch');
  if(mainSearch){
    mainSearch.addEventListener('keydown',e=>{
      if(e.key==='Escape'||e.key==='Delete') window.clearSearch&&window.clearSearch();
    });
  }

  // ── Filter brand: blur hides dropdown after delay ──
  const fBrand=document.getElementById('fBrand');
  if(fBrand){
    fBrand.addEventListener('focus',()=>window.showBrandDropDebounced&&window.showBrandDropDebounced(fBrand));
    fBrand.addEventListener('blur',()=>setTimeout(()=>{const d=document.getElementById('brandDrop');if(d)d.style.display='none'},200));
  }

  // ── Add form: brand ──
  const aBr=document.getElementById('aBr');
  if(aBr){
    aBr.addEventListener('focus',()=>window.showBrandDropDebounced&&window.showBrandDropDebounced(aBr));
    aBr.addEventListener('input',()=>{window.showBrandDropDebounced&&window.showBrandDropDebounced(aBr);window.updateAutoComplete&&window.updateAutoComplete();});
    aBr.addEventListener('blur',()=>setTimeout(()=>{const d=document.getElementById('brandDrop');if(d)d.style.display='none'},200));
  }

  // ── Add form: description ──
  const aMo=document.getElementById('aMo');
  if(aMo){
    aMo.addEventListener('focus',()=>window.showDescDrop&&window.showDescDrop(aMo));
    aMo.addEventListener('input',()=>{window.showDescDrop&&window.showDescDrop(aMo);window.onDescInput&&window.onDescInput(aMo);});
    aMo.addEventListener('blur',()=>setTimeout(()=>{const d=document.getElementById('descDrop');if(d)d.style.display='none'},200));
  }

  // ── Add form: size format ──
  const aSz=document.getElementById('aSz');
  if(aSz) aSz.addEventListener('input',()=>window.formatSize&&window.formatSize(aSz));

  // ── Add form: location sync ──
  ['aP1','aP2'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('input',()=>window._syncFormToMap&&window._syncFormToMap());
  });
  ['aCo','aFl'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){
      el.addEventListener('input',()=>{window._syncFormToMap&&window._syncFormToMap();window.renderMiniMap&&window.renderMiniMap();});
      el.addEventListener('blur',()=>setTimeout(()=>window.hideMiniMap&&window.hideMiniMap(),300));
    }
  });

  // ── Row panel: Enter key ──
  ['rowPanelCount','rowPanelStart'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('keydown',e=>{if(e.key==='Enter')window.confirmRowPanel&&window.confirmRowPanel();});
  });

  // ── File inputs ──
  const invReportInput=document.getElementById('invReportInput');
  if(invReportInput) invReportInput.addEventListener('change',()=>window.autoUpdateInventory&&window.autoUpdateInventory(invReportInput));
  const importExcel=document.getElementById('importExcel');
  if(importExcel) importExcel.addEventListener('change',()=>window.importExcel&&window.importExcel(importExcel));
  const importFile=document.getElementById('importFile');
  if(importFile) importFile.addEventListener('change',()=>window.importJSON&&window.importJSON(importFile));
  const importExcelDirect=document.getElementById('importExcelDirect');
  if(importExcelDirect) importExcelDirect.addEventListener('change',()=>window.handleExcelImportFile&&window.handleExcelImportFile(importExcelDirect));

  // ── Panel overlay: click-outside to close ──
  const gdRestorePanel=document.getElementById('gdRestorePanel');
  if(gdRestorePanel){
    gdRestorePanel.addEventListener('click',e=>{ if(e.target===gdRestorePanel) gdRestorePanel.style.display='none'; });
    const gdCloseBtn=gdRestorePanel.querySelector('[data-action="hideGdRestorePanel"]');
    if(gdCloseBtn) gdCloseBtn.addEventListener('click',()=>gdRestorePanel.style.display='none');
  }
  const accessPanel=document.getElementById('accessPanel');
  if(accessPanel) accessPanel.addEventListener('click',e=>{ if(e.target===accessPanel) window.closeAccessPanel&&window.closeAccessPanel(); });
  const locationPanel=document.getElementById('locationPanel');
  if(locationPanel) locationPanel.addEventListener('click',e=>{ if(e.target===locationPanel) window.closeLocationPanel&&window.closeLocationPanel(); });

  // ── Search input ──
  const mainSearch2=document.getElementById('mainSearch');
  if(mainSearch2) mainSearch2.addEventListener('input',()=>window.handleSearchInput&&window.handleSearchInput(mainSearch2));

  // ── Add overlay: click outside to close ──
  const addOverlay=document.getElementById('addOverlay');
  if(addOverlay) addOverlay.addEventListener('click',e=>window.closeAddOutside&&window.closeAddOutside(e));

  // ── fBrand input: also call applyFilters on input ──
  if(fBrand) fBrand.addEventListener('input',()=>window.applyFilters&&window.applyFilters());
});
