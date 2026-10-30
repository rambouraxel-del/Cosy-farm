import {
  BUILDINGS,ANIMALS,dayName,isMarketDay,hasBuilding,readyForHens,
  loadGame,saveGame,recharge,minutesUntilEnergy,buyBuilding,buyHen,
  buyFeed,fillFeeder,fillWater,cleanCoop,petHen,careHen,harvestEgg,
  storedEggs,sleepDay,startMarket,marketDecision
} from "./sim.js";

const $=id=>document.getElementById(id);
const escapeHtml=str=>String(str??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const s=loadGame();
let panelName="",selectedHen="",placing="",selectedEgg="";
const toast=message=>{const t=$("toast");t.textContent=message;t.classList.remove("hidden");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.add("hidden"),2700);};
const persist=()=>{saveGame(s);renderHud();};
function renderHud(){
  $("dayHud").textContent=dayName(s)+" · Jour "+s.day;
  $("coinHud").textContent="◉ "+s.coins;
  $("energyHud").textContent="⚡ "+s.energy+"/15";
}
function showPanel(name,id=""){
  if(id&&name==="hen")selectedHen=id;
  if(id&&name==="groundEgg")selectedEgg=id;
  panelName=name;
  $("panel").classList.remove("hidden");
  renderPanel();
}
function closePanel(){panelName="";$("panel").classList.add("hidden");}
function panel(title,html){
  $("panel").innerHTML='<div class="top"><h2>'+title+'</h2><button class="close" data-act="close" aria-label="Fermer">✕</button></div>'+html;
}
const btn=(label,action,cls="primary",extra="")=>'<button class="'+cls+'" data-act="'+action+'" '+extra+'>'+label+'</button>';
const card=(body)=>'<div class="card">'+body+'</div>';
const stat=(label,n)=>'<div class="stat"><span>'+label+'</span><div class="progress"><i style="width:'+Math.min(100,Math.max(0,n))+'%"></i></div><strong>'+Math.round(n)+'</strong></div>';

function renderPanel(){
 if(!panelName)return;
 if(panelName==="shop"){
  let html='<p>Départ sur terrain vide : aménage ta ferme sans dépenser tout ton capital.</p><h3>Construire</h3>';
  for(const [k,v] of Object.entries(BUILDINGS))html+=card('<div class="line"><div><b>'+v.name+'</b><br><small>'+v.description+'</small></div>'+btn(hasBuilding(s,k)?"Installé":v.price+" ◉","place","primary",'data-kind="'+k+'" '+(hasBuilding(s,k)||s.coins<v.price?"disabled":""))+'</div>');
  html+='<h3>Adopter</h3><p>Il faut un enclos, un poulailler, une mangeoire et un abreuvoir.</p>';
  for(const [k,v] of Object.entries(ANIMALS))html+=card('<div class="line"><div><b>'+v.name+'</b><br><small>'+v.description+'</small></div>'+btn(v.price+" ◉","buy-hen","primary",'data-kind="'+k+'" '+(s.coins<v.price||!readyForHens(s)?"disabled":""))+'</div>');
  html+='<h3>Réserves</h3>'+card('<div class="line"><div><b>Sac de graines</b><br><small>18 rations · dans la réserve : '+s.feedBags+'</small></div>'+btn("12 ◉","buy-feed","primary",s.coins<12?"disabled":"")+'</div>');
  panel("Boutique",html);return;
 }
 if(panelName==="farm"){
  let html='<p>Un jour dure aussi longtemps que tu le souhaites. Les animaux avancent d’un jour lorsque tu passes la nuit.</p>';
  html+=card('<b>Installations</b><p>'+s.buildings.map(b=>BUILDINGS[b.kind]?.name).join(" · ")+'</p><small>'+(readyForHens(s)?"Ton élevage est prêt.":"Construis les quatre installations indispensables.")+'</small></div>');
  html+='<h3>Entretien</h3>';
  html+=card('<div class="line"><div><b>Graines</b><br><small>Mangeoire : '+s.feederStock+' rations · sacs : '+s.feedBags+'</small></div>'+btn("Remplir","fill-feeder")+'</div>'+
  '<div class="line"><div><b>Eau</b><br><small>Abreuvoir : '+s.waterStock+' doses</small></div>'+btn("Remplir","fill-water")+'</div>'+
  '<div class="line"><div><b>Poulailler</b><br><small>Propreté : '+Math.round(s.cleanliness)+'/100</small></div>'+btn("Nettoyer","clean-coop","secondary",s.cleanedOn===s.day?"disabled":"")+'</div>');
  html+=card('<b>Réserve d’énergie</b><p>'+s.energy+'/15 · recharge : 1 toutes les 10 min, y compris hors ligne.</p><small>Prochaine énergie : '+minutesUntilEnergy(s)+' min</small>');
  panel("Ma ferme",html);return;
 }
 if(panelName==="hens"){
  let html='<p>Chaque poule possède son histoire, ses préférences et ses habitudes.</p>';
  if(!s.hens.length)html+='<p>Aucune poule pour le moment. Aménage le terrain puis adopte ta première pensionnaire.</p>';
  for(const h of s.hens)html+=card('<div class="line"><div><b>'+escapeHtml(h.name)+'</b> <span class="tag">'+escapeHtml(h.trait)+'</span><br><small>'+h.age+' jours · '+(h.sick?"À soigner":"En forme")+'</small></div>'+btn("Fiche","open-hen","secondary",'data-id="'+h.id+'"')+'</div>');
  panel("Mes poules",html);return;
 }
 if(panelName==="hen"){
  const h=s.hens.find(h=>h.id===selectedHen);
  if(!h){showPanel("hens");return;}
  let html='<p class="tag">'+escapeHtml(h.trait)+' · '+h.age+' jours · '+(h.age<150?"Jeune":"Adulte")+'</p>';
  html+=card('<label class="note">Prénom</label><input id="henName" maxlength="28" value="'+escapeHtml(h.name)+'" data-hen-input="name" />'+
    stat("Satiété",h.satiety)+stat("Hydratation",h.hydration)+stat("Santé",h.health)+stat("Bonheur",h.happiness)+
    stat("Sociabilité",h.social)+stat("Stress",h.stress)+stat("Confiance",h.trust)+stat("Affection",h.affection));
  html+=card('<b>Interactions</b><p>Affection gagnée aujourd’hui : '+h.petGainToday+'/4 (plafond quotidien).</p>'+
    '<div class="line">'+btn("Caresser","pet","primary",'data-id="'+h.id+'"')+btn("Soigner · 16 ◉","care","secondary",'data-id="'+h.id+'" '+(!h.sick?"disabled":""))+'</div>');
  html+=card('<b>Son histoire</b><p>Œufs pondus : '+h.eggsLaid+'</p>'+
   '<p>'+h.history.slice(0,5).map(v=>"J"+v.day+" : "+escapeHtml(v.text)).join("<br>")+'</p>'+
   '<label class="note" for="henNotes">Carnet de notes personnel</label><textarea id="henNotes" data-hen-input="notes" placeholder="Tes observations, ses habitudes, ses petites histoires...">'+escapeHtml(h.notes)+'</textarea>');
  panel(escapeHtml(h.name),html);return;
 }
 if(panelName==="nests"){
  if(!hasBuilding(s,"coop")){panel("Les nids",'<p>Il faut construire un poulailler pour accéder aux nids.</p>');return;}
  let html='<p>Découvre la récolte du matin. Touche chaque œuf pour le récupérer ou le réserver pour une future couvaison.</p>';
  for(let i=0;i<3;i++){
    const eggs=s.eggs.filter(e=>e.nest===i&&["nest","marked"].includes(e.status));
    html+=card('<div class="line"><b>Nid '+(i+1)+'</b><small>'+eggs.length+' œuf(s)</small></div>'+
     (eggs.length?'<div class="eggs">'+eggs.map(e=>
       '<div class="egg '+(e.status==="marked"?"marked":"")+'"><b>◉</b><small>'+(e.status==="marked"?"Réservé":"À récolter")+'</small><div style="margin-top:7px">'+
       btn("Ramasser","harvest","secondary",'data-id="'+e.id+'"')+' '+(e.status==="nest"?btn("Marquer","mark","secondary",'data-id="'+e.id+'"'):"")+
       '</div></div>').join("")+'</div>':'<p>Le nid est vide pour l’instant.</p>'));
  }
  html+='<p class="note">Les œufs marqués ne peuvent pas encore éclore dans ce prototype. Le système sera ajouté plus tard.</p>';
  panel("Les nids",html);return;
 }
 if(panelName==="groundEgg"){
  const e=s.eggs.find(x=>x.id===selectedEgg&&x.status==="grass");
  panel("Un œuf caché !",e?card('<p>Tu as trouvé un œuf dans l’herbe.</p>'+btn("Ramasser cet œuf","harvest","primary",'data-id="'+e.id+'"')):'<p>Cet œuf a été ramassé.</p>');
  return;
 }
 if(panelName==="market"){
  if(!isMarketDay(s)){panel("Le marché",'<p>Le marché du village a lieu chaque dimanche. Prépare tes œufs et reviens dans '+(7-(s.day-1)%7-1)+' journée(s).</p><p>Œufs récoltés en stock : <b>'+storedEggs(s)+'</b>.</p>');return;}
  if(s.marketDone){const m=s.lastMarket;panel("Marché terminé",'<p>À dimanche prochain !</p>'+card('<b>'+((m&&m.day===s.day)?m.sold:0)+' œufs vendus · '+((m&&m.day===s.day)?m.earned:0)+' pièces gagnées</b>'));return;}
  if(!s.marketSession){
    panel("Marché du dimanche",'<p>Tu as '+storedEggs(s)+' œuf(s) à vendre. Les clients réagissent à ton tarif.</p>'+
      card('<label for="marketPrice">Ton prix par œuf (référence : 4 pièces)</label><input id="marketPrice" type="range" min="1" max="9" step="1" value="4"/><p>Prix sélectionné : <b id="priceText">4 pièces</b></p>'+
      btn("Ouvrir mon stand","start-market","primary",storedEggs(s)===0?"disabled":""))+
      '<small>Tu peux aller au marché une fois par dimanche. Un prix élevé suscite davantage de négociations.</small>');return;
  }
  const m=s.marketSession,v=m.visitors[m.index];const offer=Math.min(m.price,v.budget);
  panel("Mon stand",'<p>Client '+(m.index+1)+' / '+m.visitors.length+' · '+storedEggs(s)+' œuf(s) encore disponibles</p>'+
    card('<h3>'+escapeHtml(v.name)+' s’arrête devant ton étal</h3>'+
    '<p>« Je voudrais '+v.qty+' œuf(s). Je peux proposer <b>'+offer+' pièces par œuf</b>. »</p>'+
    '<p>Ton prix affiché : '+m.price+' pièces.</p>'+
    '<div class="line">'+btn("Accepter","sale-accept")+btn("Négocier","sale-counter","secondary")+btn("Refuser","sale-skip","danger")+'</div>')+
    '<p class="note">Vendu : '+m.sold+' œuf(s) · Recettes : '+m.earned+' pièces.</p>');
  return;
 }
 if(panelName==="recap"){
   const r=s.lastRecap;
   if(!r){panel("Bilan",'<p>Aucun jour terminé pour l’instant.</p>');return;}
   let html='<p>Voici ce qui s’est passé pendant le jour '+r.day+' ('+r.name+').</p>';
   html+=card('<b>Relations</b>'+(r.pets.length?r.pets.map(v=>'<p>'+escapeHtml(v.name)+' : +'+v.points+' affection et confiance</p>').join(""):'<p>Aucun progrès relationnel aujourd’hui.</p>'));
   if(r.sick.length)html+=card('<b>Santé</b>'+r.sick.map(v=>'<p>'+escapeHtml(v)+' présente des symptômes.</p>').join(""));
   html+=card('<b>Demain</b>'+r.notes.map(v=>'<p>'+escapeHtml(v)+'</p>').join(""));
   html+='<p class="highlight">Les œufs du matin restent une surprise : ouvre ton poulailler pour les découvrir.</p>'+btn("Découvrir les nids","go-nests");
   panel("Bilan de journée",html);return;
 }
}

function action(act,button){
 const kind=button?.dataset.kind,id=button?.dataset.id;
 let err=null,worldDirty=false;
 switch(act){
  case "close":closePanel();return;
  case "place":
    if(hasBuilding(s,kind))return toast("Installation déjà présente.");
    if(!BUILDINGS[kind]||s.coins<BUILDINGS[kind].price)return toast("Pas assez de pièces.");
    placing=kind;closePanel();$("cancelPlacement").classList.remove("hidden");
    $("hint").textContent="Touche une zone libre du terrain pour placer "+BUILDINGS[kind].name;
    return;
  case "buy-hen":err=buyHen(s,kind);worldDirty=!err;break;
  case "buy-feed":err=buyFeed(s);break;
  case "fill-feeder":err=fillFeeder(s);break;
  case "fill-water":err=fillWater(s);break;
  case "clean-coop":err=cleanCoop(s);break;
  case "open-hen":showPanel("hen",id);return;
  case "pet":err=petHen(s,id);break;
  case "care":err=careHen(s,id);break;
  case "harvest":err=harvestEgg(s,id);worldDirty=!err;if(panelName==="groundEgg"&&!err){showPanel("farm");}break;
  case "mark":err=harvestEgg(s,id,true);worldDirty=!err;break;
  case "go-nests":showPanel("nests");return;
  case "sleep":
    err=sleepDay(s);if(!err){worldDirty=true;showPanel("recap");}
    break;
  case "start-market":
    err=startMarket(s,Number($("marketPrice")?.value||4));break;
  case "sale-accept":err=marketDecision(s,"accept");break;
  case "sale-counter":err=marketDecision(s,"counter");break;
  case "sale-skip":err=marketDecision(s,"skip");break;
 }
 if(err)toast(err);
 if(!err){persist();if(worldDirty)renderObjects();}
 if(panelName)renderPanel();
}
document.querySelectorAll("[data-panel]").forEach(b=>b.addEventListener("click",()=>showPanel(b.dataset.panel)));
document.querySelector('[data-act="sleep"]').addEventListener("click",()=>action("sleep"));
$("cancelPlacement").addEventListener("click",()=>{
 placing="";$("cancelPlacement").classList.add("hidden");
 $("hint").textContent="Glisse pour explorer · Pince pour zoomer · Touche un objet";
});
$("panel").addEventListener("click",e=>{
 const b=e.target.closest("[data-act]");if(b)action(b.dataset.act,b);
});
$("panel").addEventListener("input",e=>{
 if(e.target.id==="marketPrice")$("priceText").textContent=e.target.value+" pièces";
});
$("panel").addEventListener("change",e=>{
 if(!e.target.dataset.henInput)return;
 const h=s.hens.find(x=>x.id===selectedHen);if(!h)return;
 if(e.target.dataset.henInput==="name"){const name=e.target.value.trim().slice(0,28);if(name)h.name=name;}
 if(e.target.dataset.henInput==="notes")h.notes=e.target.value.slice(0,5000);
 persist();renderPanel();
});

renderHud();
if(!window.BABYLON){
 $("hint").textContent="Impossible de charger la 3D : vérifie ta connexion et recharge la page.";
 throw new Error("Babylon.js n'est pas disponible");
}
const B=BABYLON,canvas=$("world");
const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true});
const scene=new B.Scene(engine);
scene.clearColor=new B.Color4(.73,.84,.69,1);
const camera=new B.ArcRotateCamera("camera",-Math.PI/3,1.05,32,new B.Vector3(0,0,0),scene);
camera.lowerRadiusLimit=13;camera.upperRadiusLimit=57;
camera.lowerBetaLimit=.45;camera.upperBetaLimit=1.37;
const light=new B.HemisphericLight("daylight",new B.Vector3(-.5,1,.3),scene);light.intensity=1.0;
const sun=new B.DirectionalLight("sun",new B.Vector3(-.5,-1,-.6),scene);sun.intensity=.55;
const palette={grass:"#a7c28b",earth:"#c7b28c",coop:"#c18958",roof:"#814d3c",fence:"#e9d6a4",
 grain:"#f3c86e",water:"#7ab8bf",hen:"#e9c7a1",chick:"#ffec93",rescue:"#cbb5aa",egg:"#fff5db"};
function mat(name,hex){const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(hex);m.specularColor=new B.Color3(.05,.05,.05);return m;}
const materials={};for(const [k,v] of Object.entries(palette))materials[k]=mat(k,v);
const ground=B.MeshBuilder.CreateGround("terrain",{width:26,height:26},scene);ground.material=materials.grass;
ground.metadata={type:"ground"};
for(let i=-13;i<=13;i+=2){
 const a=B.MeshBuilder.CreateLines("gridX"+i,{points:[new B.Vector3(i,.015,-13),new B.Vector3(i,.015,13)]},scene);
 a.color=new B.Color3(.57,.69,.51);a.isPickable=false;
 const b=B.MeshBuilder.CreateLines("gridZ"+i,{points:[new B.Vector3(-13,.015,i),new B.Vector3(13,.015,i)]},scene);
 b.color=new B.Color3(.57,.69,.51);b.isPickable=false;
}
let dynamics=[],moving=[];
const track=x=>{dynamics.push(x);return x;};
function cube(name,w,h,d,x,y,z,material,parent){
 const m=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
 m.position.set(x,y,z);m.material=material;if(parent)m.parent=parent;return m;
}
function ball(name,diameter,x,y,z,material,parent,scaling){
 const m=B.MeshBuilder.CreateSphere(name,{diameter,segments:8},scene);
 m.position.set(x,y,z);m.material=material;if(parent)m.parent=parent;if(scaling)m.scaling.set(...scaling);return m;
}
function meta(mesh,type,id){mesh.metadata={type,id};}
function addBuilding(b){
 const root=track(new B.TransformNode("build-"+b.id,scene));root.position.set(b.x,0,b.z);
 const k=b.kind;
 if(k==="pen"){
   for(let x=-4;x<=4;x+=2){
     cube("barrier",.15,.8,.15,x,.4,-4,materials.fence,root);
     cube("barrier",.15,.8,.15,x,.4,4,materials.fence,root);
   }
   for(let z=-2;z<=2;z+=2){
     cube("barrier",.15,.8,.15,-4,.4,z,materials.fence,root);
     cube("barrier",.15,.8,.15,4,.4,z,materials.fence,root);
   }
   for(let z of [-4,4])for(let x of [-4,4])cube("post",.35,1,.35,x,.5,z,materials.fence,root);
 } else if(k==="coop"){
   const walls=cube("coop",3,2,2.5,0,1,0,materials.coop,root);
   const roof=cube("roof",3.6,.5,3,0,2.3,0,materials.roof,root);roof.rotation.z=.08;
   meta(walls,"coop");meta(roof,"coop");
   const entrance=cube("door",.85,1.2,.05,0,.6,-1.28,materials.roof,root);meta(entrance,"coop");
 } else if(k==="feeder"||k==="water"){
   const base=cube(k,1.5,.5,1,0,.3,0,k==="feeder"?materials.grain:materials.water,root);
   meta(base,"supplies");
   const top=cube(k+"Top",1.25,.1,.85,0,.64,0,materials.earth,root);meta(top,"supplies");
 }
}
function addHen(h){
 const root=track(new B.TransformNode("hen-"+h.id,scene));root.position.set(h.x,0,h.z);
 const body=ball("hen-body",1.2,0,.65,0,materials[h.kind==="rescue"?"rescue":h.kind==="chick"?"chick":"hen"],root,h.kind==="chick"?[.6,.65,.6]:[1,.8,.85]);
 const head=ball("hen-head",.62,0,1.23,-.32,materials[h.kind==="rescue"?"rescue":h.kind==="chick"?"chick":"hen"],root);
 const beak=cube("beak",.32,.16,.25,0,1.14,-.72,materials.grain,root);
 const eye1=ball("eye",.08,-.24,1.33,-.51,materials.roof,root);
 const eye2=ball("eye",.08,.24,1.33,-.51,materials.roof,root);
 for(const child of [body,head,beak,eye1,eye2])meta(child,"hen",h.id);
 moving.push({root,x:h.x,z:h.z,tx:h.x,tz:h.z,speed:.22+Math.random()*.18,clock:0});
}
function addGrassEgg(e){
 const root=track(new B.TransformNode("egg-"+e.id,scene));root.position.set(e.x,0,e.z);
 const egg=ball("egg",.46,0,.28,0,materials.egg,root,[.84,1.25,.84]);meta(egg,"egg",e.id);
}
function renderObjects(){
 for(const v of dynamics)v.dispose();dynamics=[];moving=[];
 for(const b of s.buildings)addBuilding(b);
 for(const h of s.hens)addHen(h);
 for(const e of s.eggs)if(e.status==="grass")addGrassEgg(e);
}
renderObjects();
const activePointers=new Map();
let wasGesture=false,lastDistance=0;
canvas.addEventListener("pointerdown",e=>{canvas.setPointerCapture(e.pointerId);activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});if(activePointers.size>1)wasGesture=true;});
canvas.addEventListener("pointermove",e=>{
 const p=activePointers.get(e.pointerId);if(!p)return;
 const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
 if(activePointers.size===1){
  const sensitivity=camera.radius*.0015;
  camera.target.x+=(-dx*Math.cos(camera.alpha)+dy*Math.sin(camera.alpha))*sensitivity;
  camera.target.z+=(dx*Math.sin(camera.alpha)+dy*Math.cos(camera.alpha))*sensitivity;
  camera.target.x=Math.max(-10,Math.min(10,camera.target.x));
  camera.target.z=Math.max(-10,Math.min(10,camera.target.z));
 } else if(activePointers.size===2){
   const [a,b]=[...activePointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);
   if(lastDistance)camera.radius=Math.max(13,Math.min(57,camera.radius*lastDistance/d));
   lastDistance=d;
 }
});
canvas.addEventListener("pointerup",e=>{
 const p=activePointers.get(e.pointerId);
 if(p&&!wasGesture&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<9)tapWorld(e);
 activePointers.delete(e.pointerId);if(!activePointers.size){wasGesture=false;lastDistance=0;}
});
canvas.addEventListener("pointercancel",e=>{activePointers.delete(e.pointerId);wasGesture=false;lastDistance=0;});
canvas.addEventListener("wheel",e=>{e.preventDefault();camera.radius=Math.min(57,Math.max(13,camera.radius*(e.deltaY>0?1.07:.93)));},{passive:false});
function tapWorld(e){
 const rect=canvas.getBoundingClientRect();
 const pick=scene.pick(e.clientX-rect.left,e.clientY-rect.top);
 if(!pick?.hit)return;
 if(placing){
  const groundPick=scene.pick(e.clientX-rect.left,e.clientY-rect.top,m=>m===ground);
  if(!groundPick?.hit)return toast("Place cette installation sur le terrain.");
  const p=groundPick.pickedPoint;
  const err=buyBuilding(s,placing,Math.round(p.x),Math.round(p.z));
  if(err)return toast(err);
  const name=BUILDINGS[placing].name;placing="";
  $("cancelPlacement").classList.add("hidden");
  $("hint").textContent="Glisse pour explorer · Pince pour zoomer · Touche un objet";
  persist();renderObjects();toast(name+" installé !");showPanel("shop");return;
 }
 const data=pick.pickedMesh?.metadata;
 if(data?.type==="hen")showPanel("hen",data.id);
 if(data?.type==="coop")showPanel("nests");
 if(data?.type==="supplies")showPanel("farm");
 if(data?.type==="egg")showPanel("groundEgg",data.id);
}
let last=performance.now();
engine.runRenderLoop(()=>{
 const now=performance.now(),delta=Math.min(.05,(now-last)/1000);last=now;
 for(const a of moving){
  a.clock-=delta;
  if(a.clock<=0){a.tx=Math.max(-10,Math.min(10,a.root.position.x+(Math.random()-.5)*4));a.tz=Math.max(-10,Math.min(10,a.root.position.z+(Math.random()-.5)*4));a.clock=3+Math.random()*5;}
  const dx=a.tx-a.root.position.x,dz=a.tz-a.root.position.z,d=Math.hypot(dx,dz);
  if(d>.04){a.root.position.x+=dx/d*a.speed*delta;a.root.position.z+=dz/d*a.speed*delta;a.root.rotation.y=Math.atan2(-dx,-dz);}
 }
 scene.render();
});
window.addEventListener("resize",()=>engine.resize());
setInterval(()=>{
 const old=s.energy;recharge(s);
 if(old!==s.energy){persist();if(panelName==="farm")renderPanel();}
},15000);
window.addEventListener("pagehide",()=>saveGame(s));
if(!s.buildings.length)showPanel("shop");
