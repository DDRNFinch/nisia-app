/* Evia7 guided evidence: Evia walks a learner through one evidence pack, if they want her to.
   window.eviaGuide.start({unitName, prompts, ksbs, pack, addFiles, save, done})
     1. Photos: Evia's camera asks for one thing at a time, in the order of the job (getting ready, setting out,
        part-way through, finished); take as many as you like, or skip. Each photo is saved as soon as it's taken.
     2. Questions: one per stage, with that stage's things to mention as pills; tapping one opens a box for it.
     3. Statement: the answers are put together, in the learner's own words, as the pack's write-up,
        which goes on the PDF with the photos as normal.
   Answers are saved in the pack as they go (pack.guide), with where the learner got to (pack.guide.at), so a job done
   over a day can be carried on later from the same place. */
(function(){
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const split=s=>{const seen=new Set();return String(s||"").split("·").map(t=>t.trim()).filter(t=>{const k=t.toLowerCase();if(!t||seen.has(k))return false;seen.add(k);return true})};
  const reduced=()=>window.eviaAccessibility?window.eviaAccessibility.reducedMotion():matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AVATAR='<span class="evia-mini" aria-hidden="true"><span class="evia-face"><i></i><i></i></span></span>';
  /* Free range is "without Evia": a prohibited sign over a small Evia. */
  const AVATAR_OFF='<span class="fr-no" aria-hidden="true"><span class="evia-mini"><span class="evia-face"><i></i><i></i></span></span><b class="fr-strike"></b></span>';

  /* ---------- The stages of a job ---------- */
  /* Each thing to capture, thing to mention and the unit's skills and behaviours is sorted into the stage of the job
     it belongs to, so Evia follows the job from start to finish and asks about each part once. The learner never sees
     codes: skills show as plain "Good evidence shows you can…" lines. */
  const STAGES=[
    {key:"setout",title:"Setting out",
      photo:"Photograph your setting out: the lines, levels and measurements, with the tape or level showing. Get one of the whole set-up, then move in close.",
      ask:"How did you set it out, and how did you check it was right?"},
    {key:"finish",title:"The finished job",
      photo:"Photograph the finished job. Stand back to get the whole thing in, then move in close on the detail: joints, levels, finish. Include how you left the area.",
      ask:"How did you finish off, and how did you check the quality of your work?"},
    {key:"ready",title:"Getting ready",
      photo:"Before you start, photograph your work area set up safely, and the materials, tools and drawings ready to use.",
      ask:"How did you get ready for this job?"},
    {key:"know",title:"Why it matters",
      ask:"What would you tell a new apprentice about doing this job properly, and why it matters?"},
    {key:"doing",title:"The job in progress",
      photo:"Photograph the job part-way through. Ask someone to take one of you at work, then take a few of how it’s coming along.",
      ask:"Talk me through how you did the job, step by step."}
  ];
  const ORDER=["ready","setout","doing","finish","know","reflect"];
  const REFLECT={key:"reflect",title:"Looking back",ask:"What went well, and what would you do differently next time?"};
  /* Checked in this order: safety belongs to getting ready even when it mentions protection; materials only count as
     getting ready when nothing else places them. */
  const RULES=[
    ["doing",/\bteam|communicat/],
    ["reflect",/learning|development|reflect|feedback|improv/],
    ["setout",/setting[- ]?out|set out|marking out|\blevels?\b|laser|profile|gauge rods?|squares?\b|\blines?\b|datum|plumb|radius|angle/],
    ["ready",/\bppe\b|\brpe\b|protective equipment|safe|hazard|risk|\bsigns?\b|signage|asbestos|slips|height|manual handling|health|wellbeing|well-being|toolbox|method statement/],
    ["know",/regulation|standard|warrant|inclus|equity|divers|equal|modern|digital|terminology|principle|legislation|ownership|\bcost|programme|design/],
    ["finish",/finish|joint|pointing|flush|half round|weather|recess|struck|protect|clean|waste|recycl|environment|surface water|maintain|maintenance|capping|coping|tidy|inspect|quality|check/],
    ["ready",/drawing|specification|estimat|resource|select|quantit|material|pre-?mix|silo|\btools?\b|plan\b|prepar|survey|defect|damage/]
  ];
  const stageOf=text=>{const t=String(text).toLowerCase();const r=RULES.find(([,re])=>re.test(t));return r?r[0]:"doing"};
  const list=a=>a.length<2?a.join(""):a.slice(0,-1).join(", ")+" and "+a[a.length-1];
  /* A skill or behaviour from the unit, as a plain line: "Gauge and hand mix mortar to ratio". */
  function plain(ksb){
    let t=String(ksb).split("|").slice(1).join("|").split(/:\s|\.\s|\bFor example\b|\be\.g\.|,?\s+including,/)[0].trim().replace(/[.,;]+$/,"");
    t=t.replace(/^(\w+?)(ies|s)\b/,(m,w,e)=>/^(applies|carries|complies|identifies|specifies)$/i.test(m)?w+"y":/ss$/i.test(m)||!/^(uses|selects|applies|works|takes|follows|carries|communicates|interprets|maintains|installs|builds|sets|prepares|checks|plans|identifies|complies|contributes|demonstrates)$/i.test(m)?m:w+(e==="ies"?"y":""));
    t=t.replace(/\btheir own\b/gi,"your own").replace(/\bthemselves\b/gi,"yourself").replace(/\btheir\b/gi,"your");
    return t.length>6&&t.length<140?t.charAt(0).toUpperCase()+t.slice(1):"";
  }
  /* Short tips shown under each photo request, by stage. */
  const TIP={ready:"Before you start: your area set up safely, with what you need ready.",setout:"Get the tape, level or line in the shot.",
    doing:"Part-way through. Ask someone to take one of you at work.",finish:"Stand back for the whole job, then move in close on the detail."};
  /* What to talk about when a stage has nothing more specific. */
  const TOPICS={ready:["How you got ready"],setout:["How you set it out","How you checked it"],doing:["What you did, step by step"],
    finish:["How you finished off","How you checked the quality"],know:["Why doing it properly matters"],reflect:["What went well","What you’d do differently"]};
  const OTHER="Something else";
  /* A little detail for each photo: what this one should show (photo-tips.js), or the stage's tip. */
  const tip=(item,k)=>window.eviaPhotoTip&&window.eviaPhotoTip(item)||TIP[k];
  const cap=t=>{t=String(t).trim();return t.charAt(0).toUpperCase()+t.slice(1)};
  /* The plan for a pack: one photo request at a time (each thing to capture, in the order of the job), and a question
     for each stage with its topics to pick from. */
  function plan(ctx){
    const caps=split(ctx.prompts&&ctx.prompts.photos),terms=split(ctx.prompts&&ctx.prompts.writeup);
    const ksbs=(ctx.ksbs||[]).filter(k=>/^[SB]\d/.test(String(k)));
    const by={};ORDER.forEach(k=>by[k]={caps:[],terms:[],can:[]});
    caps.forEach(c=>by[stageOf(c)].caps.push(c));
    terms.forEach(t=>by[stageOf(t)].terms.push(t));
    ksbs.forEach(k=>{const p=plain(k);if(p&&!by[stageOf(p)].can.includes(p))by[stageOf(p)].can.push(p)});
    const def=k=>k==="reflect"?REFLECT:STAGES.find(s=>s.key===k);
    const photos=[];
    ["ready","setout","doing","finish"].forEach(k=>{
      const s=def(k),c=by[k].caps;
      if(c.length)c.forEach(item=>photos.push({key:k,say:cap(item),hint:tip(item,k)}));
      else if(k!=="setout")photos.push({key:k,say:s.title,hint:s.photo});
    });
    /* Things to capture that belong to the talking stages still get a photo, at the end. */
    ["know","reflect"].forEach(k=>by[k].caps.forEach(item=>photos.push({key:"finish",say:cap(item),hint:tip(item,"finish")})));
    const asks=ORDER.filter(k=>k==="doing"||k==="reflect"||by[k].terms.length||by[k].can.length).map(k=>{
      const s=def(k),t=by[k].terms.map(cap),topics=[...new Set((k==="doing"||k==="reflect"||!t.length?TOPICS[k]:[]).concat(t))];
      return {key:k,title:s.title,ask:s.ask,terms:by[k].terms,topics:topics.concat(OTHER),can:by[k].can.slice(0,3)};
    });
    return {photos,asks};
  }

  /* ---------- The flow ----------
     Where the learner got to is saved in the pack (guide.at), so a job done over a day can be picked up later: the
     next photo to take, or the question they were on. Photos are saved to the pack the moment they're taken. */
  const answeredIn=(g,asks)=>asks.filter(a=>String(g.answers[a.key]||"").trim()).length;
  function load(pack){
    let g=pack.guide;
    if(!g||(g.v!==2&&g.v!==3))g={v:3,answers:{},covered:{},topics:{},at:null};
    if(g.v===2){g.v=3;g.topics={};Object.keys(g.answers||{}).forEach(k=>{if(String(g.answers[k]||"").trim())g.topics[k]={[OTHER]:g.answers[k]}});g.at=null}
    g.topics=g.topics||{};return pack.guide=g;
  }
  const whereText=(P,at)=>at.phase==="photos"?"photo "+(Math.min(at.step,P.photos.length-1)+1)+" of "+P.photos.length+": <strong>"+esc(P.photos[Math.min(at.step,P.photos.length-1)].say)+"</strong>":
    at.phase==="ask"&&P.asks[at.i]?"question "+(at.i+1)+" of "+P.asks.length+": <strong>"+esc(P.asks[at.i].title)+"</strong>":"your statement";
  function resume(ctx,P,at){
    if(at.phase==="photos"&&window.eviaCamera&&window.eviaCamera.supported())return photos(ctx,P,Math.min(at.step,P.photos.length-1));
    if(at.phase==="ask")return at.topic&&P.asks[at.i]?topic(ctx,P,at.i,at.topic):ask(ctx,P,at.i||0);
    return review(ctx,P);
  }
  function start(ctx){
    /* ctx.plan: a pack with its own photos and questions (the PPE induction), instead of the unit's. */
    const P=ctx.plan||plan(ctx),g=load(ctx.pack),answered=answeredIn(g,P.asks);
    const canCam=window.eviaCamera&&window.eviaCamera.supported();
    const at=!g.used&&g.at?g.at:null;
    if(at){
      sheet('<p class="eg-say">Welcome back. Last time you got to '+whereText(P,at)+'. Everything you’ve done so far is saved.</p>',
        [{label:"Carry on from there",primary:true,run:()=>resume(ctx,P,at)},
         canCam&&at.phase!=="photos"?{label:"Take more photos",run:()=>photos(ctx,P,0)}:null,
         at.phase==="photos"?{label:"Skip to the questions",run:()=>ask(ctx,P,firstGap(P,g))}:null].filter(Boolean),
        {kicker:"EVIA · GUIDED EVIDENCE",title:ctx.unitName});
      return;
    }
    sheet('<p class="eg-say">'+(answered?"Welcome back. You’ve answered "+answered+" of my "+P.asks.length+" questions.":"I’ll guide you through this job from start to finish: one photo at a time, then a few questions about how it went. I’ll put your answers together into your statement.")+'</p>'+
      (answered?"":'<ol class="eg-stages">'+(P.stages||[...new Set(P.photos.map(p=>(STAGES.find(s=>s.key===p.key)||{}).title))]).map(t=>'<li>'+esc(t)+'</li>').join("")+'</ol>')+
      '<p class="eg-small">Skip anything you like. Everything saves as you go, so you can stop and carry on later, even hours later.</p>',
      /* First time: one button. Back part-way through: carry on, or more photos. */
      answered?[{label:"Carry on with the questions",primary:true,run:()=>ask(ctx,P,firstGap(P,g))},
         canCam?{label:"Take more photos",run:()=>photos(ctx,P,0)}:null].filter(Boolean)
        :[{label:"Get started",primary:true,run:()=>canCam?photos(ctx,P,0):ask(ctx,P,0)}],
      {kicker:"EVIA · GUIDED EVIDENCE",title:ctx.unitName,wide:!answered});
  }
  const firstGap=(P,g)=>{const i=P.asks.findIndex(a=>!String(g.answers[a.key]||"").trim());return i<0?P.asks.length:i};
  const mark=(ctx,at)=>{ctx.pack.guide.at=at;ctx.save()};

  function photos(ctx,P,from){
    close(true);let got=0;
    mark(ctx,{phase:"photos",step:from||0});
    window.eviaCamera.open({title:ctx.unitName,guide:P.photos,startStep:from||0,progress:{done:0,total:P.photos.length+P.asks.length},
      onStep:step=>mark(ctx,{phase:"photos",step}),
      onShot:file=>{got++;ctx.addFiles([file])},
      onDone:(files,info)=>{
        if(files.length){got+=files.length;ctx.addFiles(files)}
        const finished=info&&info.finished;
        setTimeout(()=>{
          if(!finished){
            const step=info?info.step:0;mark(ctx,{phase:"photos",step});
            sheet('<p class="eg-say">'+(got?"Saved: "+got+" photo"+(got===1?"":"s")+". ":"")+'Stopped for now. When you come back, I’ll pick up at <strong>'+esc(P.photos[step].say)+'</strong>.</p>',
              [{label:"Close",primary:true,run:()=>close()},{label:"Skip to the questions",run:()=>ask(ctx,P,firstGap(P,ctx.pack.guide))}],
              {kicker:"EVIA · GUIDED EVIDENCE",title:"Photos paused"});
            return;
          }
          mark(ctx,{phase:"ask",i:firstGap(P,ctx.pack.guide)});
          sheet('<p class="eg-say">'+(got?"Nice, that’s "+got+" photo"+(got===1?"":"s")+" added.":"No photos this time. You can add them later.")+' Now a few questions about how the job went. Pick the parts you want to talk about and answer in your own words.</p>',
            [{label:"Start the questions",primary:true,run:()=>ask(ctx,P,firstGap(P,ctx.pack.guide))},{label:"Stop for now",run:()=>close()}],
            {kicker:"EVIA · GUIDED EVIDENCE",title:"Photos done"});
        },60);
      }});
  }

  /* One stage: the question, then its topics as pills. Tapping a pill opens a box just for that topic. */
  function ask(ctx,P,i){
    const g=ctx.pack.guide,n=P.asks.length;
    if(i>=n){review(ctx,P);return}
    const a=P.asks[i],T=g.topics[a.key]||{};
    mark(ctx,{phase:"ask",i});
    const el=sheet(
      '<div class="eg-progress" aria-hidden="true"><i style="width:'+Math.round((P.photos.length+i+1)/(P.photos.length+n)*100)+'%"></i></div>'+
      '<p class="eg-say eg-q">'+esc(a.ask)+'</p>'+
      '<p class="eg-small">Tap the things you want to talk about. Do as many as you like.</p>'+
      '<div class="eg-pills">'+a.topics.map((t,k)=>{const txt=String(T[t]||"").trim();
        return '<button type="button" class="eg-pill'+(txt?" done":"")+(t===OTHER?" other":"")+'" data-topic="'+k+'"><span class="eg-pill-t">'+(txt?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>':"")+esc(t)+'</span>'+(txt?'<small>'+esc(txt.length>70?txt.slice(0,70)+"…":txt)+'</small>':"")+'</button>'}).join("")+'</div>'+
      (a.can.length?'<details class="eg-good"><summary>What good looks like</summary><ul>'+a.can.map(c=>'<li>'+esc(c)+'</li>').join("")+'</ul></details>':""),
      [{label:i===n-1?"Finish":"Next",primary:true,run:()=>ask(ctx,P,i+1)}],
      {kicker:"EVIA · QUESTION "+(i+1)+" OF "+n,title:a.title,back:i>0?()=>ask(ctx,P,i-1):null,keep:true,full:true,compact:true});
    el.querySelectorAll("[data-topic]").forEach(b=>b.onclick=()=>topic(ctx,P,i,a.topics[+b.dataset.topic]));
  }
  /* The stage's answer is its topics in order, so the statement reads well and counts what was covered. */
  function store(ctx,a){
    const g=ctx.pack.guide,T=g.topics[a.key]||{},parts=a.topics.map(t=>String(T[t]||"").trim()).filter(Boolean);
    g.answers[a.key]=parts.map(p=>/[.!?]$/.test(p)?p:p+".").join(" ");
    g.covered[a.key]=a.terms.filter(t=>String(T[cap(t)]||"").trim());
    ctx.save();
  }
  function topic(ctx,P,i,t){
    const g=ctx.pack.guide,a=P.asks[i];g.topics[a.key]=g.topics[a.key]||{};
    mark(ctx,{phase:"ask",i,topic:t});
    const el=sheet(
      '<p class="eg-ctx">'+esc(a.ask)+'</p>'+
      '<textarea class="eg-text" id="eg-text" data-otj="'+esc(ctx.unitName)+'" rows="6" placeholder="'+esc(t===OTHER?"Anything else about this part of the job…":"Tell me about "+t.charAt(0).toLowerCase()+t.slice(1)+"…")+'" aria-label="'+esc(t)+'">'+esc(g.topics[a.key][t]||"")+'</textarea>',
      [{label:"Done",primary:true,run:()=>{save();ask(ctx,P,i)}}],
      {kicker:"EVIA · "+a.title.toUpperCase(),title:t,back:()=>{save();ask(ctx,P,i)},backLabel:"‹ Topics",keep:true,full:true,compact:true});
    const box=el.querySelector("#eg-text");
    function save(){g.topics[a.key][t]=box.value.trim();store(ctx,a)}
    let timer=null;box.oninput=()=>{clearTimeout(timer);timer=setTimeout(save,400)};
    setTimeout(()=>box.focus({preventScroll:true}),reduced()?0:220);
  }

  /* The statement: what they already wrote, then each answer as its own paragraph, in the order of the job. */
  function compile(ctx,P){
    const g=ctx.pack.guide,parts=P.asks.map(a=>String(g.answers[a.key]||"").trim()).filter(Boolean);
    const had=String(ctx.pack.write||"").trim();
    return [had,...parts.filter(p=>!had.includes(p))].filter(Boolean).join("\n\n");
  }
  function review(ctx,P){
    const text=compile(ctx,P),n=answeredIn(ctx.pack.guide,P.asks);
    mark(ctx,{phase:"review"});
    if(!text){
      sheet('<p class="eg-say">You skipped all the questions, so there’s nothing to put together yet. You can come back to me any time, or write it yourself.</p>',[{label:"Close",primary:true,run:()=>close()}],{kicker:"EVIA · GUIDED EVIDENCE",title:"Your statement"});return;
    }
    const el=sheet('<p class="eg-say">Here’s your statement, made from your '+n+' answer'+(n===1?"":"s")+'. Read it through and change anything you like. It goes in your write-up and on the PDF with your photos.</p>'+
      '<textarea class="eg-text eg-final" id="eg-final" rows="12" aria-label="Your statement">'+esc(text)+'</textarea>',
      [{label:"Use this statement",primary:true,run:()=>{
        ctx.pack.write=el.querySelector("#eg-final").value.trim();ctx.pack.guide.used=new Date().toISOString();ctx.pack.guide.at=null;
        ctx.save();close();ctx.done();
        if(typeof showEvidenceToast==="function")setTimeout(()=>showEvidenceToast("Statement added to your write-up"),250);
      }}],
      {kicker:"EVIA · GUIDED EVIDENCE",title:"Your statement",back:()=>ask(ctx,P,P.asks.length-1),keep:true,full:true,compact:true});
  }

  /* ---------- Sheet ---------- */
  function sheet(body,buttons,o){
    const root=document.getElementById("modal-root");
    fit(false);
    root.innerHTML='<div class="overlay eg-overlay'+(o.full?" eg-full":"")+'"><section class="sheet pr-sheet eg-sheet" role="dialog" aria-modal="true" aria-labelledby="eg-title">'+
      '<div class="sheet-head"><div class="eg-head">'+(o.free?AVATAR_OFF:AVATAR)+'<div><div class="chat-kicker">'+esc(o.kicker)+'</div><h2 id="eg-title">'+esc(o.title)+'</h2></div></div><button class="close" id="eg-close" type="button" aria-label="Close">×</button></div>'+
      '<div class="pr-body">'+body+'<div class="pr-actions eg-actions'+(o.compact?" eg-compact":"")+(o.wide?" eg-wide":"")+'">'+(o.back?'<button type="button" class="eg-back" id="eg-back">'+esc(o.backLabel||"‹ Back")+'</button>':"")+buttons.map((b,i)=>'<button type="button" class="'+(b.primary?"primary":"secondary")+'" data-eg="'+i+'">'+esc(b.label)+'</button>').join("")+'</div></div></section></div>';
    const el=root.querySelector(".eg-sheet");
    /* Full screens keep the buttons outside the scrolling part, so they sit just above the keyboard. */
    if(o.full){el.appendChild(el.querySelector(".eg-actions"));fit(true)}
    el.querySelectorAll("[data-eg]").forEach(b=>b.onclick=()=>buttons[+b.dataset.eg].run());
    if(o.back)el.querySelector("#eg-back").onclick=o.back;
    const x=()=>{const t=el.querySelector("#eg-text");if(t&&t.oninput)t.oninput();close()};
    el.querySelector("#eg-close").onclick=x;
    if(!o.keep)root.querySelector(".overlay").addEventListener("click",e=>{if(e.target.classList.contains("overlay"))close()});
    if(!el.querySelector("textarea")){const h=el.querySelector("#eg-title");h.setAttribute("tabindex","-1");h.focus({preventScroll:true})}
    return el;
  }
  /* Writing screens fill the space above the keyboard, so the question, the box and the buttons all stay in view. */
  let fitting=false;
  const size=()=>{
    const v=window.visualViewport,h=v?v.height:innerHeight,r=document.documentElement.style;
    r.setProperty("--eg-vh",h+"px");r.setProperty("--eg-top",(v?v.offsetTop:0)+"px");
    /* Short on space (usually the keyboard is up): tuck away the extras so the answer box stays roomy. */
    const o=document.querySelector(".eg-overlay.eg-full");if(o)o.classList.toggle("eg-tight",h<600);
  };
  function fit(on){
    const v=window.visualViewport;if(on===fitting)return;fitting=on;
    if(on){size();if(v){v.addEventListener("resize",size);v.addEventListener("scroll",size)}else addEventListener("resize",size)}
    else if(v){v.removeEventListener("resize",size);v.removeEventListener("scroll",size)}else removeEventListener("resize",size);
  }
  function close(now){
    fit(false);
    const root=document.getElementById("modal-root"),o=root&&root.querySelector(".eg-overlay");if(!o)return;
    if(now||reduced()){root.innerHTML="";return}
    o.classList.add("ui-closing");setTimeout(()=>{if(root.contains(o))root.innerHTML=""},170);
  }

  /* ---------- Free range ----------
     The same look as the guide, without the steps: the camera lists every thing to capture at once, and the write-up
     lists every thing to mention, with one box for the learner's own words. at: "photos" or "write" opens that part.
     ctx is start()'s, plus submit() to send the pack to the portfolio. */
  const words=t=>String(t||"").trim()?String(t).trim().split(/\s+/).length:0;
  const plural=(n,w)=>n+" "+w+(n===1?"":"s");
  function free(ctx,at){
    if(at==="photos")return freePhotos(ctx);
    if(at==="write")return freeWrite(ctx);
    const n=(ctx.pack.photos||[]).length,w=words(ctx.pack.write);
    sheet('<p class="eg-say">'+(n||w?"Welcome back. So far you’ve got "+plural(n,"photo")+(w?" and "+plural(w,"word")+" written":"")+".":
        "Add whatever you like, your way. Take all your photos first, with everything worth capturing listed. Then write it up in your own words, with everything worth mentioning listed.")+'</p>'+
      '<ol class="eg-stages"><li>Photos</li><li>Write-up</li></ol>'+
      '<p class="eg-small">Everything saves as you go, so you can stop and carry on later.</p>',
      [{label:"Get started",primary:true,run:()=>freePhotos(ctx)}],
      {kicker:"FREE RANGE",title:ctx.unitName,free:true,wide:true});
    closeRefreshes(ctx);
  }
  /* Closing a free range sheet redraws the unit page, so what's in progress shows there. */
  const closeRefreshes=ctx=>{const x=document.getElementById("eg-close");if(x){const was=x.onclick;x.onclick=()=>{was();ctx.done()}}};
  function gallery(ctx,then){
    const i=document.createElement("input");i.type="file";i.accept="image/*";i.multiple=true;
    i.onchange=async()=>{const files=[...i.files];if(files.length)await ctx.addFiles(files);then()};i.click();
  }
  function freePhotos(ctx){
    if(!(window.eviaCamera&&window.eviaCamera.supported()))return gallery(ctx,()=>free(ctx));
    close(true);
    window.eviaCamera.open({title:ctx.unitName,prompts:split(ctx.prompts&&ctx.prompts.photos),onDone:async files=>{
      if(files.length)await ctx.addFiles(files);
      const n=(ctx.pack.photos||[]).length;
      setTimeout(()=>{
        sheet('<p class="eg-say">'+(files.length?"Saved: "+plural(files.length,"photo")+". ":"")+"You’ve got "+plural(n,"photo")+" in this pack. Take more, or write it up.</p>",
          [{label:"Write it up",primary:true,run:()=>freeWrite(ctx)},{label:"Take more photos",run:()=>freePhotos(ctx)},{label:"Stop for now",run:()=>{close();ctx.done()}}],
          {kicker:"FREE RANGE · PHOTOS",title:ctx.unitName,free:true});
        closeRefreshes(ctx);
      },60);
    }});
  }
  function freeWrite(ctx){
    const pack=ctx.pack,terms=split(ctx.prompts&&ctx.prompts.writeup);
    const ready=()=>!!((pack.photos||[]).length||String(pack.write||"").trim());
    const hintText=()=>ready()?"Ready to submit.":"Write something, or add a photo, to submit.";
    const el=sheet(
      '<p class="eg-ctx">Write about the job in your own words: what you did, how and why.</p>'+
      (terms.length?'<div class="fr-mention"><div class="evidence-section-title">THINGS TO MENTION</div><div class="compact-prompts">'+esc(terms.join(" · "))+'</div></div>':"")+
      '<textarea class="eg-text" id="write" data-otj="'+esc(ctx.unitName)+'" rows="8" placeholder="Write about the process and what you did…" aria-label="Your write-up">'+esc(pack.write||"")+'</textarea>'+
      '<p class="eg-small fr-hint" id="fr-hint">'+hintText()+'</p>',
      [{label:"Submit to Portfolio",primary:true,run:async()=>{if(!ready())return;close(true);await ctx.submit()}}],
      {kicker:"FREE RANGE · WRITE-UP",title:ctx.unitName,back:()=>{close(true);free(ctx)},keep:true,full:true,compact:true,free:true});
    const box=el.querySelector("#write"),btn=el.querySelector(".eg-actions .primary"),hint=el.querySelector("#fr-hint");
    const update=()=>{btn.disabled=!ready();hint.textContent=hintText()};
    box.oninput=()=>{pack.write=box.value;ctx.save();update()};
    update();closeRefreshes(ctx);
  }

  window.eviaGuide={start,free,plan,plain};
})();
