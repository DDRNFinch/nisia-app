// Evia7 final stability fixes: evidence photos and fixed navigation. (Accessibility lives in accessibility.js.)
(function(){
  const PACK_KEY="evia7-working-evidence-packs";
  const readJson=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||"")||f}catch(_){return f}};

  const style=document.createElement("style");
  style.id="evia-final-layout-fixes";
  style.textContent=`
    :root{--evia-nav-bottom:max(14px,env(safe-area-inset-bottom));--evia-nav-height:72px;--evia-fab-size:48px}
    @media(max-width:520px){:root{--evia-nav-height:70px}}
    .bottom-nav{position:fixed!important;bottom:var(--evia-nav-bottom)!important;transform:none!important}
    .evia-fab{position:fixed!important;bottom:calc(var(--evia-nav-bottom) + (var(--evia-nav-height) - var(--evia-fab-size))/2)!important;width:var(--evia-fab-size)!important;height:var(--evia-fab-size)!important;transform:translateX(-50%)!important}
    body.evia-keyboard-editing .bottom-nav{transform:none!important;opacity:1!important;pointer-events:auto!important}
    body.evia-keyboard-editing .evia-fab{transform:translateX(-50%)!important;opacity:1!important}
  `;
  document.head.appendChild(style);


  document.addEventListener("focusin",()=>document.body.classList.remove("evia-keyboard-editing"));
  document.addEventListener("focusout",()=>document.body.classList.remove("evia-keyboard-editing"));
})();

// Supporting evidence blob storage.
(function(){
  const DB_NAME="evia7-supporting-files";
  const STORE="files";
  function openDB(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"id"});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error("IndexedDB unavailable"));
    });
  }
  window.eviaSupportingFilePut=async function({id,blob}){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).put({id,blob});
      tx.oncomplete=()=>{db.close();resolve()};
      tx.onerror=()=>{db.close();reject(tx.error||new Error("Could not save file"))};
      tx.onabort=()=>{db.close();reject(tx.error||new Error("Could not save file"))};
    });
  };
  window.eviaSupportingFileGet=async function(id){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readonly");
      const req=tx.objectStore(STORE).get(id);
      req.onsuccess=()=>{const value=req.result||null;db.close();resolve(value)};
      req.onerror=()=>{db.close();reject(req.error||new Error("Could not load file"))};
    });
  };
})();
