/* Evia7 tabs beside Evia: Teach me (the course, maths and English lessons, and the mini games) and Rewards (rewards.js). */
(function(){
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const scr=()=>document.getElementById("screen");
  const courseName=()=>{try{return data().name}catch(_){return ""}};
  const head=title=>'<header class="ui-page-head"><h1>'+esc(title)+'</h1><span>'+esc(courseName())+'</span></header>';
  const ICON={
    course:'<svg viewBox="0 0 24 24"><rect x="3" y="14" width="8" height="5" rx="1"/><rect x="13" y="14" width="8" height="5" rx="1"/><rect x="8" y="8" width="8" height="5" rx="1"/><path d="M3 21h18"/></svg>',
    maths:'<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 7.5h8M8.5 12h1M12 12h1M15 12h1M8.5 16h1M12 16h1M15 16h1"/></svg>',
    edi:'<svg viewBox="0 0 24 24"><circle cx="8" cy="7.5" r="2.6"/><circle cx="16" cy="7.5" r="2.6"/><path d="M3.5 19c0-3 2-5 4.5-5s4.5 2 4.5 5M11.5 19c0-3 2-5 4.5-5s4.5 2 4.5 5"/></svg>',
    english:'<svg viewBox="0 0 24 24"><path d="M4 20l5.5-15h1L16 20M6.2 14.5h7.6"/><path d="M17 12.5c1-1 3.5-1 3.5 1.2V20M20.5 16.2c-2.7-.4-4 .5-4 1.9 0 1 .8 1.9 2 1.9 1.3 0 2-1 2-1"/></svg>'
  };
  /* Lessons done out of the total for a list of units, from the Teach me store. */
  function count(us){
    const L=Object.fromEntries(window.eviaData.list("lessonResults",{course}).map(r=>[r.lessonId,r]));
    const ls=[].concat(...us.map(u=>u.lessons));return {done:ls.filter(l=>L[l.id]&&L[l.id].done).length,total:ls.length};
  }
  /* Medals from Teach me, by best score: gold 90%+, silver 70%+, bronze below (as teach.js). */
  function medals(){
    const L=Object.fromEntries(window.eviaData.list("lessonResults",{course}).map(r=>[r.lessonId,r]));
    const m={gold:0,silver:0,bronze:0};Object.values(L).forEach(r=>{if(r&&r.done)m[r.best>=.9?"gold":r.best>=.7?"silver":"bronze"]++});return m;
  }
  const PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
  function teachPage(){
    const T=window.eviaTeach,E=window.EVIA_TEACH||{fs:[]},R=window.eviaRewards,I=(E.ui&&E.ui.ICON)||{};
    const trade=(T&&T.COURSES&&T.COURSES[course])||[],fs=f=>(E.fs||[]).filter(u=>u.fs===f);
    const subjects=[["course",courseName()||"Your course",count(trade)],["maths","Maths",count(fs("maths"))],["english","English",count(fs("english"))],["edi","EDI and safeguarding",count(fs("edi"))]].filter(x=>x[2].total||x[0]==="course");
    const me=T&&T.stats?T.stats():{xp:0,streak:0,today:false},bal=R&&R.balance?R.balance():0,md=medals(),won=md.gold+md.silver+md.bronze;
    /* The player card: Evia, the medals won in Teach me, the day streak and coins. */
    const player='<section class="tg-player"><div class="tg-me"><span class="tg-evia evia-mini" aria-hidden="true"><span class="evia-face"><i></i><i></i></span></span></div>'+
      '<div class="tg-xp"><div class="tg-xp-top"><strong>'+won+'<small> '+(won===1?"medal":"medals")+'</small></strong><span>'+(won?"Replay a lesson to go for gold":"Finish a lesson to win one")+'</span></div>'+
      '<div class="tg-medals">'+["gold","silver","bronze"].map(k=>'<span class="tg-medal medal-'+k+'" aria-label="'+md[k]+' '+k+'"><i aria-hidden="true"></i><b>'+md[k]+'</b></span>').join("")+'</div>'+
      '<div class="tg-pills"><span class="tg-pill fire'+(me.today?" lit":"")+'">'+(I.flame||"")+'<b>'+me.streak+'</b> day streak</span><span class="tg-pill coin">'+(R&&R.coin?R.coin():"")+'<b>'+bal+'</b> coins</span></div></div></section>';
    /* Up next: one tap straight into the next lesson. */
    const nx=T&&T.nextUp?T.nextUp():null;
    const next=nx?'<button type="button" class="tg-next" data-play="'+esc(nx.id)+'"><span class="tg-next-copy"><small>'+(nx.resume?"Carry on":"Up next")+' · '+esc(nx.unit)+'</small><strong>'+esc(nx.title)+'</strong><span>Lesson '+nx.n+' of '+nx.of+' · about '+nx.mins+' min</span></span><span class="tg-play">'+PLAY+'</span></button>':"";
    const tile=([id,title,c])=>{const pct=c.total?Math.round(c.done/c.total*100):0;
      return '<button type="button" class="tt-card tg-tile tg-'+id+'" data-go="'+id+'"><span class="tg-tile-top"><span class="tg-tile-ic" aria-hidden="true">'+ICON[id]+'</span><span class="tg-ring" style="--p:'+pct+'" aria-hidden="true"><b>'+pct+'%</b></span></span><strong>'+esc(title)+'</strong><small>'+c.done+' of '+c.total+' lessons</small></button>'};
    scr().innerHTML=head("Teach me")+player+next+'<h2 class="ui-section-label">Subjects</h2><div class="tg-grid">'+subjects.map(tile).join("")+'</div>'+games();
    scr().querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{if(T)T.open(b.dataset.go)});
    scr().querySelectorAll("[data-play]").forEach(b=>b.onclick=()=>{if(T&&T.play)T.play(b.dataset.play)});
    scr().querySelectorAll("[data-game]").forEach(b=>b.onclick=()=>{const id=b.dataset.game;
      if(R&&R.owns(id))window.eviaGames.open(b.dataset.key);else if(R)R.openItem(id)});
  }
  /* Mini games: unlocked in Rewards, played here. */
  const LOCK='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>';
  const SHOTS=["brickle","crossword","flappy","siterun","quest"]; /* games/<key>.jpg (siterun and quest are parked) */
  function games(){
    const G=window.eviaGames,R=window.eviaRewards;if(!G||!R)return "";
    const PRICE={common:30,rare:80,epic:180},room=R.gameRoom(),earned=R.GAME_DAILY-room;
    return '<section class="tt-games"><div class="tt-games-head"><h2 class="ui-section-label">Mini games</h2><span>'+(room?earned+" of "+R.GAME_DAILY+" game coins today":"Today’s game coins collected")+'</span></div><div class="tg-games">'+
      G.GAMES.map(g=>{const own=R.owns(g.id);
        /* Top three-quarters: a screenshot of the game. Bottom quarter: its name and what it is. */
        return '<button type="button" class="tt-game tg-game g-'+g.key+(own?"":" locked")+'" data-game="'+g.id+'" data-key="'+g.key+'" aria-label="'+esc(g.label+". "+g.about+(own?"":" Unlock in Rewards."))+'">'+
          '<span class="tg-shot">'+(SHOTS.includes(g.key)?'<img src="games/'+g.key+'.jpg" alt="" loading="lazy" decoding="async">':'<span class="tg-game-ic" aria-hidden="true">'+G.iconFor(g.key)+'</span>')+
          (own?'<span class="tg-game-go">'+PLAY+'Play</span>':'<span class="tg-game-go lock">'+LOCK+(PRICE[g.rarity]?'<b>'+PRICE[g.rarity]+'</b>':"")+'</span>')+'</span>'+
          '<span class="tg-info"><strong>'+esc(g.label)+'</strong><small>'+esc(g.about)+'</small></span></button>'}).join("")+'</div></section>';
  }
  function rewardsPage(){if(window.eviaRewards)window.eviaRewards.page();else scr().innerHTML=head("Rewards")}

  const prev=window.render;
  window.render=function(){
    if(window.eviaRewards&&window.eviaRewards.later)window.eviaRewards.later();
    if(screen!=="teach"&&screen!=="rewards")return prev();
    const pb=document.getElementById("profile-btn");if(pb)pb.style.display="flex";
    document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===screen));
    const s=scr();if(s)s.classList.add("ui-top");
    const t=document.getElementById("page-title");if(t)t.textContent=screen==="teach"?"Teach me":"Rewards";
    if(screen==="teach")teachPage();else rewardsPage();
  };
})();
