/* Evia7 ↔ Nisia: pairing and sync.
   Joining: the learner scans their assessor's pairing QR (NISI:PAIR:2:<code>), opens the invite link (?pair=<code>) or
   types the code shown under the QR. Nisia replies with the learner's enrolment: who they are, their course and dates,
   college, employer, assessor, tutor and safeguarding lead, so the learner doesn't type any of it.
   Sync: Nisia sees everything the learner does in Evia. Records (evidence, hours, lessons, tests, reviews, targets…)
   go on any connection, from eviaData.changesSince(); photos, videos and files go only on WiFi, and wait until then.
   Live: Nisia's Supabase (London). Pairing signs the learner in (no password); every record goes to evia_records
   (and evidence and learning hours to their own tables, for the college's counts); photos and files go to the
   private evidence store. The example codes below are a demo that never leaves the phone (the shared test app).
   window.eviaNisia: pair(code)  accept(enrolment)  joined()  sync()  status()  clean(code)  onStatus(fn) */
(function(){
  const NISIA_URL="https://ffgfigkeeeauzkifopei.supabase.co",NISIA_KEY="sb_publishable_w_R4Kqq3UqNKQuv6erQzAQ_bXBkw8Bc";
  const MEDIA_KEY="evia7-nisia-media",STATUS_KEY="evia7-nisia-status",IDS_KEY="evia7-nisia-ids";
  /* supabase-js is only loaded once the learner connects (vendor/, about 110 KB). */
  let client=null;
  function sb(){
    if(client)return Promise.resolve(client);
    return new Promise((res,rej)=>{
      const go=()=>{client=window.supabase.createClient(NISIA_URL,NISIA_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:"evia7-nisia-auth",detectSessionInUrl:false}});res(client)};
      if(window.supabase&&window.supabase.createClient)return go();
      const el=document.createElement("script");el.src="vendor/supabase-2.45.4.js";el.onload=go;el.onerror=()=>rej(new Error("Evia couldn’t reach Nisia. Check your signal and try again."));document.head.appendChild(el);
    });
  }
  /* Example learners (from the Nisia portal mock-up), one per course. */
  const COLLEGE={college:"Brookfield College",safeguarding:{name:"Sarah Mitchell",phone:"01922 555 010",email:"safeguarding@brookfield.example"}};
  const LEARNERS={
    BRK7Q4M:{learnerId:"nisia-demo-callum",name:"Callum Hughes",course:"bricklayer",start:"2025-09-01",end:"2027-08-31",group:"Bricklaying 2025 intake",employer:"Hughes & Sons Builders",assessor:"Mark Ellis",tutor:"Dan Okafor"},
    CJ4H8KP:{learnerId:"nisia-demo-amira",name:"Amira Khan",course:"site",start:"2025-09-01",end:"2027-08-31",group:"Site Carpentry 2025",employer:"Kestrel Homes",assessor:"Mark Ellis",tutor:"Priya Shah"},
    JNR5W2C:{learnerId:"nisia-demo-jordan",name:"Jordan Price",course:"joiner",start:"2025-09-01",end:"2027-08-31",group:"Bench Joinery 2025",employer:"Oakline Joinery",assessor:"Mark Ellis",tutor:"Priya Shah"},
    TRW3M6D:{learnerId:"nisia-demo-ellie",name:"Ellie Morgan",course:"trowel3",start:"2026-01-05",end:"2027-07-30",group:"Plastering L3",employer:"Morgan Plastering",assessor:"Mark Ellis",tutor:"Mark Ellis",nvqOptional:["690"]}
  };
  /* The code under the QR, however it arrives: typed with dashes or spaces, a scanned NISI:PAIR:2: payload, or a link. */
  const clean=s=>{s=String(s||"").trim();const m=/^NISI:PAIR:\d+:(.+)$/i.exec(s)||/[?&#](?:pair|code)=([A-Za-z0-9-]+)/.exec(s);return (m?m[1]:s).toUpperCase().replace(/[^A-Z0-9]/g,"")};

  async function pair(code){
    const k=clean(code);
    if(k.length<6)throw new Error("That code looks too short. It’s under your assessor’s QR code.");
    if(LEARNERS[k])return Object.assign({code:k,demo:true},COLLEGE,LEARNERS[k]);
    if(!navigator.onLine)throw new Error("You need signal to connect. Try again when you’re online.");
    let r,d={};
    try{r=await fetch(NISIA_URL+"/functions/v1/nisia-setup",{method:"POST",headers:{"Content-Type":"application/json",apikey:NISIA_KEY},body:JSON.stringify({action:"pair",code:k})});d=await r.json()}
    catch(_){throw new Error("Evia couldn’t reach your college. Check your signal and try again.")}
    if(!r.ok||d.error)throw new Error(d.error||"That code didn’t work. Ask your assessor for a new one.");
    return {code:k,live:true,token_hash:d.token_hash,learnerId:d.learnerId,organisationId:d.organisationId,enrolmentId:d.enrolmentId,courseId:d.courseId,memberId:d.memberId,
      name:d.name,course:d.course,start:d.start,end:d.end,college:d.college,employer:d.employer,employerContact:d.employerContact,assessor:d.assessor,tutor:d.tutor,
      plannedOtjHours:d.plannedOtjHours,safeguarding:d.safeguarding||undefined,reviewDue:d.reviewDue||null,nvqOptional:d.nvqOptional&&d.nvqOptional.length?d.nvqOptional:undefined};
  }
  /* The learner confirmed it's them: sign in with the one-time token, then the enrolment and their details come
     from Nisia from now on. */
  async function accept(en){
    let c=null;
    if(en.live){
      c=await sb();
      const {error}=await c.auth.verifyOtp({token_hash:en.token_hash,type:"magiclink"});
      if(error)throw new Error("That code has already been used. Ask your assessor for a new one.");
    }
    try{if(en.learnerId)localStorage.setItem("evia7-learner-id",en.learnerId)}catch(_){}
    const e=Object.assign({},en,{joinedAt:new Date().toISOString()});delete e.token_hash;
    window.eviaData.enrol(e);
    /* Evia already in use on another device: bring it all here and restart with it. */
    if(c){let back=false;try{back=await restore(c,e)}catch(err){console.warn("Evia: restore",err&&err.message)}
      if(back){try{sessionStorage.setItem("evia7-welcome-back","1");if(window.eviaStorage)await window.eviaStorage.flush()}catch(_){}location.reload();return new Promise(()=>{})}}
    window.eviaData.put("learner",{name:en.name,start:en.start,end:en.end,safeguarding:en.safeguarding,...(en.nvqOptional?{nvqOptional:en.nvqOptional}:{})});
    setTimeout(()=>sync().catch(()=>{}),500);
    return e;
  }
  const joined=()=>{const e=window.eviaData.enrolment();return e&&e.college?e:null};

  /* ---------- Sync ---------- */
  const readJson=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||"null");return v??f}catch(_){return f}};
  const writeJson=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  /* WiFi (or a cable) only for media. Phones that don't say what they're on (iPhone) count as WiFi unless data saver is on. */
  const onWifi=()=>{const c=navigator.connection;if(!c||!c.type)return !(c&&c.saveData);return c.type==="wifi"||c.type==="ethernet"};
  /* Every photo and file the records point at. */
  function mediaIds(){
    const D=window.eviaData,out=[];
    D.list("evidence").forEach(e=>(e.photoIds||[]).forEach(id=>out.push({id,kind:"photo",evidence:e.id})));
    D.list("supporting").filter(s=>!s.observation).forEach(s=>out.push({id:s.id,kind:"supporting"}));
    return out;
  }
  const listeners=[];
  const note=s=>{const st=Object.assign(readJson(STATUS_KEY,{})||{},s);writeJson(STATUS_KEY,st);listeners.slice().forEach(fn=>{try{fn(st)}catch(_){}});return st};
  /* A stable Nisia id for each Evia record that has its own Nisia table. */
  const uuidFor=key=>{const m=readJson(IDS_KEY,{})||{};if(!m[key]){m[key]=crypto.randomUUID?crypto.randomUUID():"10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));writeJson(IDS_KEY,m)}return m[key]};
  const EVIDENCE_TYPES=["photo","video","written","audio","document"];
  /* Records: everything into evia_records; evidence, supporting evidence and learning hours also into their own tables. */
  async function sendRecords(c,e,batch){
    const base={organisation_id:e.organisationId,enrolment_id:e.enrolmentId};
    const rows=batch.map(ch=>Object.assign({},base,{learner_member_id:e.memberId,collection:ch.collection,record_id:String(ch.record.id),data:ch.record,deleted_at:ch.fingerprint?null:new Date().toISOString()}));
    const {error}=await c.from("evia_records").upsert(rows,{onConflict:"enrolment_id,collection,record_id"});
    if(error)throw error;
    for(const ch of batch){
      const r=ch.record,gone=!ch.fingerprint;
      if(ch.collection==="hours"){
        const id=uuidFor("hours:"+r.id),hours=Math.round((Number(r.minutes)||0)/60*100)/100;
        if(gone||!(hours>0&&hours<=24)){await c.from("otj_entries").delete().eq("id",id);continue}
        const {error:oe}=await c.from("otj_entries").upsert(Object.assign({},base,{id,created_by_member_id:e.memberId,activity_date:String(r.occurredAt||r.createdAt||new Date().toISOString()).slice(0,10),
          activity_type:r.source||"evia",description:String(r.description||r.did||"Learning").slice(0,2000),hours}));
        if(oe)console.warn("Evia: Nisia hours",oe.message);
      }
      /* An assessor's observation came from Nisia: it's already there. */
      if(ch.collection==="supporting"&&(r.observation||/^obs-/.test(String(r.id))))continue;
      if(ch.collection==="evidence"||ch.collection==="supporting"){
        const id=uuidFor(ch.collection+":"+r.id);
        /* Deleted in Evia: its photos and files go too. (Anything the assessor has accepted stays; the rules refuse.) */
        if(gone){const {data:fl}=await c.from("evidence_files").select("storage_path").eq("evidence_id",id);if(fl&&fl.length)await c.storage.from("evidence").remove(fl.map(f=>f.storage_path));await c.from("evidence").delete().eq("id",id);continue}
        const type=ch.collection==="evidence"?((r.photoIds||[]).length?"photo":"written"):(EVIDENCE_TYPES.includes(r.type)?r.type:"document");
        const {error:ee}=await c.from("evidence").upsert(Object.assign({},base,{id,course_id:e.courseId,created_by_member_id:e.memberId,evidence_type:type,
          title:String(r.unit||r.title||"Evidence").slice(0,300),client_reference:ch.collection+":"+r.id,
          source_metadata:{collection:ch.collection,unit:r.unit||null,text:r.text||null,ksbs:r.ksbs||r.criteria||[],photoIds:r.photoIds||[]}}));
        if(ee)console.warn("Evia: Nisia evidence",ee.message);
      }
    }
  }
  /* Evia's own summary of where the learner is (the same numbers they see), for Milos's reviews: KSB coverage and
     what's missing per unit, time through the course, learning hours, tests, confidence, Teach me and write-up quality. */
  function snapshot(){
    try{
      const S=window.eviaStats.compute(),a=S.a;
      return {at:new Date().toISOString(),course:typeof course==="string"?course:"",
        ksb:{met:a.met,total:a.total,pct:a.ksbPct,timePct:a.timePct,evidenced:[...(a.evidenced||[])]},
        units:(a.units||[]).map(u=>({name:u.name,total:(u.codes||[]).length,missing:(u.missing||[]).slice(),started:!!u.started,packs:(u.entries||[]).length,
          strength:typeof unitStrengthForCourse==="function"?unitStrengthForCourse(u.name):window.eviaStrength?window.eviaStrength.unit(u.name):null})),
        packs:S.packs,daysSince:S.daysSince,lastUpload:S.lastUpload?new Date(S.lastUpload).toISOString():null,
        otj:{total:S.otjTotal,month:S.otjMonth,week:S.otjWeek},streak:S.streak,writeupCoverage:S.coverage,
        tests:(S.tests||[]).map(t=>({type:t.type,name:t.name,count:t.count,best:t.best,latest:t.latest?{pct:t.latest.pct,takenAt:t.latest.takenAt}:null})),
        confidence:S.confidence,teach:S.teach,maths:S.maths,english:S.english,ppeDone:S.ppeDone};
    }catch(err){console.warn("Evia: snapshot",err&&err.message);return null}
  }
  async function sendSnapshot(c,e){
    const snap=snapshot();if(!snap)return;
    const key=JSON.stringify(Object.assign({},snap,{at:0}));let last="";try{last=localStorage.getItem("evia7-nisia-snap")||""}catch(_){}
    if(key===last)return;
    const {error}=await c.from("evia_records").upsert({organisation_id:e.organisationId,enrolment_id:e.enrolmentId,learner_member_id:e.memberId,collection:"snapshot",record_id:"current",data:snap},{onConflict:"enrolment_id,collection,record_id"});
    if(error)throw error;
    try{localStorage.setItem("evia7-nisia-snap",key)}catch(_){}
  }
  /* A photo or file into the college's private evidence store, recorded against its evidence. */
  async function sendMedia(c,e,m){
    const D=window.eviaData,blob=await D.files.get(m.id,m.kind);if(!blob)return "missing";
    const owner=m.kind==="supporting"?"supporting:"+m.id:"evidence:"+m.evidence,evId=uuidFor(owner);
    const ext=(blob.type.split("/")[1]||"bin").replace(/[^a-z0-9]/g,"").slice(0,5),path=e.organisationId+"/"+evId+"/"+m.id.replace(/[^A-Za-z0-9_-]/g,"")+"."+ext;
    const {error}=await c.storage.from("evidence").upload(path,blob,{contentType:blob.type||"application/octet-stream",upsert:false});
    if(error&&!/exists|Duplicate/i.test(error.message))throw error;
    if(!error){const {error:fe}=await c.from("evidence_files").insert({organisation_id:e.organisationId,evidence_id:evId,uploaded_by_member_id:e.memberId,storage_path:path,mime_type:blob.type||"application/octet-stream",size_bytes:blob.size});if(fe)console.warn("Evia: Nisia file",fe.message)}
    return new Date().toISOString();
  }
  /* ---------- A new device (a computer, or a replacement phone) ----------
     Evia keeps the learner's work on the device. So a new device can start where the old one left off, Evia's own
     saved data goes to Nisia too, key by key, exactly as it's stored ("store" records). Connecting a new device puts it
     back, restarts Evia with it, then brings the photos and files down on WiFi. Sign-in, the sync bookkeeping and
     things that belong to one device stay where they are. */
  const STORE_SENT_KEY="evia7-nisia-store-sent",RESTORED_KEY="evia7-nisia-restored",FETCH_KEY="evia7-nisia-fetch";
  const NOT_BACKED_UP=/^evia7-(nisia-(auth|status|media|store-sent|restored|fetch|snap|observations)|data-synced|enrolment|learner-id|install-later|errors|offline-|evidence-db|supporting-files|last-backup|downloaded-unit-pdfs)/;
  /* Most of Evia's data is in IndexedDB behind localStorage (storage.js), so its keys come from there. */
  const backupKeys=()=>{const all=new Set(window.eviaStorage&&window.eviaStorage.keys?window.eviaStorage.keys():[]);
    for(let i=0;i<localStorage.length;i++)all.add(localStorage.key(i));return [...all].filter(k=>k&&k.startsWith("evia7-")&&!NOT_BACKED_UP.test(k))};
  const hash=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)+"."+s.length};
  async function sendStore(c,e){
    const sent=readJson(STORE_SENT_KEY,{})||{},now={},rows=[],base={organisation_id:e.organisationId,enrolment_id:e.enrolmentId,learner_member_id:e.memberId,collection:"store"};
    backupKeys().forEach(k=>{const raw=localStorage.getItem(k);if(raw==null||raw.length>4e6)return;now[k]=hash(raw);if(sent[k]!==now[k])rows.push(Object.assign({},base,{record_id:k,data:{raw},deleted_at:null}))});
    Object.keys(sent).forEach(k=>{if(!(k in now))rows.push(Object.assign({},base,{record_id:k,data:{raw:null},deleted_at:new Date().toISOString()}))});
    for(let i=0;i<rows.length;i+=20){const {error}=await c.from("evia_records").upsert(rows.slice(i,i+20),{onConflict:"enrolment_id,collection,record_id"});if(error)throw error}
    writeJson(STORE_SENT_KEY,now);
  }
  /* Straight after connecting: if this learner already has Evia somewhere else, their saved data comes back here.
     Lists of records with ids are merged (nothing made here is lost); everything else is taken from the backup.
     Returns true when anything came back, and Evia then restarts to load it. */
  async function restore(c,e){
    const {data,error}=await c.from("evia_records").select("record_id,data").eq("enrolment_id",e.enrolmentId).eq("collection","store").is("deleted_at",null);
    if(error||!data||!data.length)return false;
    const sent={};
    data.forEach(r=>{
      const k=r.record_id,raw=r.data&&r.data.raw;if(typeof raw!=="string"||!/^evia7-/.test(k)||NOT_BACKED_UP.test(k))return;
      let v=raw;const here=localStorage.getItem(k);
      if(here!=null&&here!==raw)try{
        const a=JSON.parse(here),b=JSON.parse(raw);
        if(Array.isArray(a)&&Array.isArray(b)&&a.concat(b).every(x=>x&&x.id!=null)){const ids=new Set(b.map(x=>String(x.id)));v=JSON.stringify(b.concat(a.filter(x=>!ids.has(String(x.id)))))}
        else if(k===IDS_KEY)v=JSON.stringify(Object.assign({},a,b));
      }catch(_){}
      try{localStorage.setItem(k,v);sent[k]=hash(v)}catch(err){console.warn("Evia: restore",k,err&&err.message)}
    });
    if(!Object.keys(sent).length)return false;
    writeJson(STORE_SENT_KEY,sent);writeJson(RESTORED_KEY,new Date().toISOString());writeJson(FETCH_KEY,{});
    return true;
  }
  /* After the restart: what came back is already in Nisia, so it isn't sent again. */
  function afterRestore(){
    if(!readJson(RESTORED_KEY,null))return;
    try{const D=window.eviaData;D.markSynced(D.changesSince());const sent=readJson(MEDIA_KEY,{})||{};mediaIds().forEach(m=>{sent[m.id]=sent[m.id]||"restored"});writeJson(MEDIA_KEY,sent)}catch(err){console.warn("Evia: after restore",err&&err.message)}
    try{localStorage.removeItem(RESTORED_KEY)}catch(_){}
  }
  /* Photos and files from the other device, on WiFi: each saved where Evia keeps them, then crossed off. */
  async function fetchMedia(c,e){
    const done=readJson(FETCH_KEY,null);if(!done)return;
    const {data:ev,error}=await c.from("evidence").select("id,client_reference").eq("enrolment_id",e.enrolmentId);if(error)throw error;
    const ref={};(ev||[]).forEach(x=>{ref[x.id]=x.client_reference||""});
    const ids=Object.keys(ref);if(!ids.length){try{localStorage.removeItem(FETCH_KEY)}catch(_){}return}
    const {data:files,error:fe}=await c.from("evidence_files").select("evidence_id,storage_path").in("evidence_id",ids);if(fe)throw fe;
    for(const f of files||[]){
      if(done[f.storage_path])continue;
      if(/^observation:/.test(ref[f.evidence_id])){done[f.storage_path]=1;continue}   /* fetchObservations brings these */
      const id=f.storage_path.split("/").pop().replace(/\.[^.]*$/,""),supporting=/^supporting:/.test(ref[f.evidence_id]);
      const have=await window.eviaData.files.get(id,supporting?"supporting":"photo").catch(()=>null);
      if(!have){
        const {data:blob,error:de}=await c.storage.from("evidence").download(f.storage_path);if(de)throw de;
        if(supporting)await window.eviaSupportingFilePut({id,blob});else await window.eviaPutEvidencePhoto(id,blob);
      }
      done[f.storage_path]=1;writeJson(FETCH_KEY,done);
    }
    try{localStorage.removeItem(FETCH_KEY)}catch(_){}
  }
  /* Observations the assessor made in Milos: each arrives as a PDF (with the photos, what they saw and the KSBs they
     signed off) in the learner's Supporting evidence, on WiFi like other files. Fetched once; if the learner removes
     one, the college keeps it and it isn't fetched again. */
  const OBS_KEY="evia7-nisia-observations";
  async function fetchObservations(c,e){
    const got=readJson(OBS_KEY,{})||{};
    const {data:ev,error}=await c.from("evidence").select("id,title,created_at,source_metadata").eq("enrolment_id",e.enrolmentId).eq("source_metadata->>collection","observation");
    if(error)throw error;
    for(const x of ev||[]){
      if(got[x.id])continue;
      const m=x.source_metadata||{};
      const {data:fl,error:fe}=await c.from("evidence_files").select("storage_path,size_bytes").eq("evidence_id",x.id).like("storage_path","%/observation.pdf");
      if(fe)throw fe;
      if(!fl||!fl.length)continue;                    /* still on its way from the assessor's phone */
      const {data:blob,error:de}=await c.storage.from("evidence").download(fl[0].storage_path);if(de)throw de;
      const id="obs-"+x.id,on=m.observedOn||String(x.created_at).slice(0,10);
      await window.eviaSupportingFilePut({id,blob});
      window.eviaData.put("supporting",{id,title:"Observation: "+(m.unit||x.title||"workplace"),type:"document",mime:"application/pdf",size:blob.size,
        filename:("Observation "+(m.unit||"")+" "+on).replace(/[^A-Za-z0-9 -]+/g,"").trim().replace(/\s+/g,"-")+".pdf",
        observation:{by:m.observedBy||"",on,unit:m.unit||"",evidenceId:x.id},criteria:m.ksbs||[],...(m.nvqUnit?{nvqUnit:m.nvqUnit}:{})});
      window.eviaData.markSynced(window.eviaData.changesSince().filter(ch=>ch.collection==="supporting"&&ch.record.id===id));   /* it came from Nisia */
      got[x.id]=new Date().toISOString();writeJson(OBS_KEY,got);
    }
  }
  /* The college's current details for this learner (name, dates, assessor, safeguarding lead, next review), so a
     change made in Nisia reaches Evia on the next sync. */
  async function refreshDetails(c,e){
    const {data:d,error}=await c.rpc("nisia_my_details");
    if(error||!d)return;
    const keep=v=>v===null||v===undefined?undefined:v;
    const next=Object.assign({},e,{name:keep(d.name)??e.name,college:keep(d.college)??e.college,start:keep(d.start)??e.start,end:keep(d.end)??e.end,
      employer:keep(d.employer)??e.employer,employerContact:keep(d.employerContact)??e.employerContact,assessor:keep(d.assessor)??e.assessor,tutor:keep(d.tutor)??e.tutor,
      plannedOtjHours:keep(d.plannedOtjHours)??e.plannedOtjHours,reviewDue:d.reviewDue||null,lastReview:d.lastReview||null,safeguarding:d.safeguarding||e.safeguarding});
    const pick=o=>JSON.stringify([o.name,o.college,o.start,o.end,o.employer,o.employerContact,o.assessor,o.tutor,o.plannedOtjHours,o.reviewDue,o.lastReview,o.safeguarding]);
    if(pick(next)!==pick(e))window.eviaData.enrol(next);
    const L=window.eviaData.learner()||{},upd={};
    if(d.name&&d.name!==L.name)upd.name=d.name;
    if(d.start&&d.start!==L.start)upd.start=d.start;
    if(d.end&&d.end!==L.end)upd.end=d.end;
    if(d.safeguarding&&JSON.stringify(d.safeguarding)!==JSON.stringify(L.safeguarding||null))upd.safeguarding=d.safeguarding;
    if(Object.keys(upd).length){window.eviaData.put("learner",upd);if(typeof render==="function")try{render()}catch(_){}}
  }
  let running=null;
  function sync(){
    if(running)return running;
    running=(async()=>{
      if(!joined())return status();
      if(!navigator.onLine)return note({offline:true});
      const D=window.eviaData,e=joined(),changes=D.changesSince();
      const c=e.live?await sb():null;
      if(c){const {data}=await c.auth.getSession();if(!data.session)return note({error:"signed-out"})}
      if(c)try{await refreshDetails(c,e)}catch(err){console.warn("Evia: Nisia details",err&&err.message)}
      /* Records: small, on any connection, in batches. (The demo keeps them on the phone.) */
      for(let i=0;i<changes.length;i+=50){const batch=changes.slice(i,i+50);if(c)await sendRecords(c,e,batch);D.markSynced(batch)}
      if(c)await sendSnapshot(c,e);
      if(c)await sendStore(c,e);
      /* Media: only on WiFi, both ways. */
      const sent=readJson(MEDIA_KEY,{})||{};
      if(onWifi()){
        if(c)try{await fetchMedia(c,e)}catch(err){console.warn("Evia: Nisia media down",err&&err.message)}
        if(c)try{await fetchObservations(c,e)}catch(err){console.warn("Evia: Nisia observations",err&&err.message)}
        for(const m of mediaIds().filter(m=>!sent[m.id])){
          try{sent[m.id]=c?await sendMedia(c,e,m):new Date().toISOString();writeJson(MEDIA_KEY,sent)}
          catch(err){console.warn("Evia: Nisia media",m.id,err&&err.message);break}
        }
      }
      return note({offline:false,error:null,lastSync:new Date().toISOString()});
    })().catch(err=>{note({error:String(err&&err.message||err)});throw err}).finally(()=>{running=null});
    return running;
  }
  /* What's still to send: changes waiting, and photos and files waiting for WiFi. */
  function status(){
    const st=readJson(STATUS_KEY,{})||{},sent=readJson(MEDIA_KEY,{})||{};
    let changes=0,media=0;
    try{changes=window.eviaData.changesSince().length;media=mediaIds().filter(m=>!sent[m.id]).length}catch(_){}
    return {joined:!!joined(),lastSync:st.lastSync||null,changes,media,wifi:onWifi(),online:navigator.onLine,error:st.error||null};
  }
  /* In words, for the profile. */
  function statusText(){
    const s=status(),e=joined();if(!e)return "";
    if(s.error==="signed-out")return "Not connected. Ask your assessor for a new code to connect Evia again.";
    if(!s.online)return "Offline. Everything is saved on your phone and goes to "+e.college+" when you’re back online.";
    if(s.media&&!s.wifi)return s.media+" photo"+(s.media===1?"":"s")+" and file"+(s.media===1?"":"s")+" waiting for WiFi.";
    if(s.changes||s.media)return "Sending to "+e.college+"…";
    if(s.lastSync){const m=Math.round((Date.now()-Date.parse(s.lastSync))/60000);return "Up to date with "+e.college+" · "+(m<1?"just now":m<60?m+" min ago":new Date(s.lastSync).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}))}
    return "Waiting to send to "+e.college+".";
  }

  /* When: soon after something changes, when the phone comes back online or onto WiFi, when Evia opens, and every few minutes. */
  let t=null;const soon=()=>{clearTimeout(t);t=setTimeout(()=>{if(joined())sync().catch(()=>{})},3000)};
  addEventListener("online",soon);
  if(navigator.connection&&navigator.connection.addEventListener)navigator.connection.addEventListener("change",soon);
  addEventListener("load",()=>{
    afterRestore();
    let back=false;try{back=sessionStorage.getItem("evia7-welcome-back")==="1";sessionStorage.removeItem("evia7-welcome-back")}catch(_){}
    if(back)setTimeout(()=>{if(typeof showEvidenceToast==="function")showEvidenceToast("Welcome back. Your work is here, and photos follow on WiFi.")},800);
    if(window.eviaData&&window.eviaData.on)window.eviaData.on("change",soon);setTimeout(soon,back?500:3000);setInterval(soon,5*60000)});

  /* A dot on the profile button while anything is waiting (no signal, or photos waiting for WiFi), so nobody thinks
     their work has reached the college when it hasn't. The profile says what's waiting. */
  function badge(){const b=document.getElementById("profile-btn");if(!b)return;const st=status();b.classList.toggle("nisia-waiting",st.joined&&(st.changes>0&&!st.online||st.media>0&&!st.wifi));
    const line=document.getElementById("pf-sync");if(line)line.textContent=statusText()}
  listeners.push(badge);addEventListener("offline",badge);addEventListener("online",badge);
  addEventListener("load",()=>setInterval(badge,30000));
  window.eviaNisia={pair,accept,joined,sync,status,statusText,clean,onStatus:fn=>listeners.push(fn)};
})();
