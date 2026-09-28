/* Evia7 evidence strength: a rough guide, worked out quietly in the background. Learners see the signal bars on
   their units, never the scoring.
     Photos:   under 5 weak · 5 to 9 good · 10 or more strong
     Write-up: how many of the unit's "Things to mention" areas it talks about. An area the learner answered with
               guided Evia counts in full.
     Overall:  strong when both are strong, weak when either is weak, otherwise good.
   window.eviaStrength: unit(unitName) -> "weak"|"good"|"strong"|null, pack(pack,prompts) -> level, guide() */
(function(){
  const split=s=>String(s||"").split("·").map(t=>t.trim()).filter(Boolean);
  const words=t=>String(t||"").trim().split(/\s+/).filter(Boolean).length;
  const matched=(term,text)=>window.eviaTermMatched?window.eviaTermMatched(term,text):String(text||"").toLowerCase().includes(term.toLowerCase());
  const photoCount=e=>Array.isArray(e.photoIds)?e.photoIds.length:Number.isFinite(Number(e.photoCount))?Number(e.photoCount):Array.isArray(e.p)?e.p.length:0;
  const promptsFor=name=>((window.eviaLearnerPrompts||{})[course]||{})[name]||{};

  const photoLevel=n=>n>=10?"strong":n>=5?"good":"weak";
  /* guided: areas the learner answered with Evia (full marks); text: everything they wrote. */
  function writeLevel(text,terms,guided){
    if(!words(text))return "weak";
    if(!terms.length)return words(text)>=100?"strong":words(text)>=50?"good":"weak";
    const got=terms.filter(t=>(guided||[]).includes(t)||matched(t,text)).length/terms.length;
    return got>=2/3?"strong":got>=1/3?"good":"weak";
  }
  const combine=(p,w)=>p==="strong"&&w==="strong"?"strong":p==="weak"||w==="weak"?"weak":"good";

  /* Areas answered with guided Evia in a working pack. */
  const guidedAreas=p=>{const c=p&&p.guide&&p.guide.covered;return c?[...new Set([].concat(...Object.values(c)))]:[]};
  /* A working pack (before it's submitted). */
  function pack(p,prompts){
    return combine(photoLevel((p.photos||[]).length),writeLevel(p.write,split(prompts&&prompts.writeup),guidedAreas(p)));
  }
  /* A unit: all its submitted packs together. */
  function unit(name){
    const es=(typeof evidence!=="undefined"?evidence:[]).filter(e=>e.c===course&&e.u===name);
    if(!es.length)return null;
    const text=es.map(e=>e.w||"").join("\n"),guided=[].concat(...es.map(e=>e.guidedAreas||[]));
    return combine(photoLevel(es.reduce((n,e)=>n+photoCount(e),0)),writeLevel(text,split(promptsFor(name).writeup),guided));
  }

  /* ---------- How to build a strong portfolio ---------- */
  function guide(){
    const root=document.getElementById("modal-root");
    const tip=(n,title,text)=>'<li class="st-tip"><span class="st-tip-n">'+n+'</span><span><strong>'+title+'</strong><span>'+text+'</span></span></li>';
    root.innerHTML='<div class="overlay"><section class="sheet pr-sheet st-sheet" role="dialog" aria-modal="true" aria-labelledby="st-title"><div class="sheet-head"><div><div class="chat-kicker">MY PORTFOLIO</div><h2 id="st-title">How to build a strong portfolio</h2></div><button class="close" id="st-close" type="button" aria-label="Close">×</button></div><div class="pr-body">'+
      '<p class="pr-intro">Your assessor needs to see that <strong>you</strong> did the work, that you did it properly, and that you understand why. Every unit has <strong>things to capture</strong> and <strong>things to mention</strong>: use them as a reminder of what to show and talk about.</p>'+
      '<ol class="st-tips">'+
        tip(1,"Photos from start to finish","Take photos at the beginning, middle and end of the job, not all at the end. Ten or more makes a strong pack.")+
        tip(2,"Plenty of photos","Several photos of the same thing, close up, from further back and from different angles, all help. The things to capture are ideas to get you started, not a list to finish.")+
        tip(3,"Clear, close and well lit","Get close enough to see the detail, hold still, and make sure it isn’t too dark.")+
        tip(4,"Talk about the things to mention","Write about them in your own words, as you would explain the job to someone new. If you’re not sure where to start, let Evia guide you: she’ll ask you about each one.")+
        tip(5,"Explain the steps","Say what you did, in order, and why you did it that way.")+
        tip(6,"Use real details","Sizes, ratios, the tools and PPE you used, and who you worked with.")+
        tip(7,"Say what you learned","What went well, what was tricky, and what you’d do differently next time.")+
        tip(8,"A little every week","Add evidence while the job is fresh. Short, regular packs beat a rush before your review.")+
      '</ol>'+
      '<div class="pr-banner">The bars on each unit are a rough guide to how your evidence is coming along. Your assessor makes the final decision.</div>'+
      '</div></section></div>';
    const close=()=>{const o=root.querySelector(".overlay");if(!o)return;o.classList.add("ui-closing");setTimeout(()=>{if(root.contains(o))root.innerHTML=""},170)};
    document.getElementById("st-close").onclick=close;
    root.querySelector(".overlay").addEventListener("click",e=>{if(e.target.classList.contains("overlay"))close()});
    const h=document.getElementById("st-title");h.setAttribute("tabindex","-1");h.focus({preventScroll:true});
  }

  window.eviaStrength={unit,pack,guide,guidedAreas,photoLevel,writeLevel};
})();
