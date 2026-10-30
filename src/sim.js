export const SAVE_KEY = "cosy-farm-v1";
export const WEEK = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
export const BUILDINGS = {
  pen: {name:"Enclos",price:35,description:"Délimite un espace pour les animaux.",unique:true},
  coop: {name:"Poulailler",price:95,description:"Un abri et trois nids de ponte.",unique:true},
  feeder: {name:"Mangeoire",price:25,description:"Distribue les graines la nuit.",unique:true},
  water: {name:"Abreuvoir",price:20,description:"Distribue l'eau la nuit.",unique:true}
};
export const ANIMALS = {
  rescue:{name:"Poule de réforme",price:18,age:900,description:"Âgée, attachante et encore capable de pondre."},
  young:{name:"Jeune poule",price:42,age:125,description:"Prête à entrer progressivement en ponte."},
  chick:{name:"Poussin",price:15,age:3,description:"Grandit au fil des journées jouées."}
};
const TRAITS=["Curieuse","Timide","Gourmande","Sociable","Calme","Indépendante"];
const FIRST_NAMES=["Marguerite","Praline","Plume","Cannelle","Noisette","Colette","Rosie","Pistache"];
const NAMES=["Alice","Basile","Clara","Dimitri","Emma","Farid","Gaëlle","Hugo"];
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const randomId=s=>String(s.nextId++);
export const dayName=s=>WEEK[(s.day-1)%7];
export const isMarketDay=s=>dayName(s)==="Dimanche";
export const hasBuilding=(s,k)=>s.buildings.some(b=>b.kind===k);
export const readyForHens=s=>["pen","coop","feeder","water"].every(k=>hasBuilding(s,k));
export function createGame(now=Date.now()){
  return {version:1,nextId:1,day:1,coins:280,energy:15,energyAt:now,
    buildings:[],hens:[],eggs:[],feedBags:0,feederStock:0,waterStock:0,cleanliness:100,
    cleanedOn:0,marketDone:false,marketSession:null,lastMarket:null,lastRecap:null};
}
export function loadGame(){
  try {const s=JSON.parse(localStorage.getItem(SAVE_KEY)||"null");
    if(s&&s.version===1&&Array.isArray(s.hens)&&Array.isArray(s.buildings)&&Array.isArray(s.eggs)){recharge(s);return s;}
  } catch(_){} return createGame();
}
export function saveGame(s){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));return true;}catch(_){return false;}}
export function recharge(s,now=Date.now()){
  if(!Number.isFinite(s.energyAt))s.energyAt=now;
  if(s.energy>=15){s.energy=15;s.energyAt=now;return;}
  const elapsed=Math.max(0,now-s.energyAt),ticks=Math.floor(elapsed/600000);
  if(ticks>0){s.energy=Math.min(15,s.energy+ticks);s.energyAt=s.energy>=15?now:s.energyAt+ticks*600000;}
}
export function minutesUntilEnergy(s,now=Date.now()){
  if(s.energy>=15)return 0;return Math.max(0,Math.ceil((600000-(Math.max(0,now-s.energyAt)%600000))/60000));
}
export function buyBuilding(s,kind,x,z){
  const item=BUILDINGS[kind];
  if(!item)return "Bâtiment inconnu.";
  if(s.coins<item.price)return "Pas assez de pièces.";
  if(item.unique&&hasBuilding(s,kind))return "Tu possèdes déjà cette installation.";
  if(Math.abs(x)>11||Math.abs(z)>11)return "Place l'installation à l'intérieur du terrain.";
  if(kind!=="pen"&&s.buildings.some(b=>b.kind!=="pen"&&Math.hypot(b.x-x,b.z-z)<3.1))return "Trop près d'un autre bâtiment.";
  s.coins-=item.price;s.buildings.push({id:randomId(s),kind,x,z});
  return null;
}
export function buyHen(s,kind,rng=Math.random){
  const item=ANIMALS[kind];
  if(!item)return "Animal inconnu.";
  if(!readyForHens(s))return "Installe d'abord l'enclos, le poulailler, la mangeoire et l'abreuvoir.";
  if(s.coins<item.price)return "Pas assez de pièces.";
  if(s.hens.length>=30)return "Limite provisoire : 30 poules pour ce prototype mobile.";
  s.coins-=item.price;
  const id=randomId(s);
  s.hens.push({id,name:FIRST_NAMES[Math.floor(rng()*FIRST_NAMES.length)]+(s.hens.length>7?" "+id:""),
    kind,age:item.age,trait:TRAITS[Math.floor(rng()*TRAITS.length)],
    satiety:85,hydration:85,health:95,happiness:78,stress:15,social:75,trust:0,affection:0,
    sick:false,notes:"",eggsLaid:0,petGainToday:0,petGainLast:0,
    x:-3+rng()*6,z:-3+rng()*6,history:[{day:s.day,text:"Arrivée à la ferme"}]});
  return null;
}
export function buyFeed(s){
  if(s.coins<12)return "Il faut 12 pièces pour un sac de graines.";
  s.coins-=12;s.feedBags+=1;return null;
}
export function fillFeeder(s){
  if(!hasBuilding(s,"feeder"))return "Il faut d'abord une mangeoire.";
  if(!s.feedBags)return "Achète des graines à la boutique.";
  s.feedBags--;s.feederStock+=18;return null;
}
export function fillWater(s){
  if(!hasBuilding(s,"water"))return "Il faut d'abord un abreuvoir.";
  s.waterStock=30;return null;
}
export function cleanCoop(s){
  if(!hasBuilding(s,"coop"))return "Il faut d'abord un poulailler.";
  if(s.cleanedOn===s.day)return "Le poulailler a déjà été nettoyé aujourd'hui.";
  s.cleanliness=100;s.cleanedOn=s.day;return null;
}
export function petHen(s,id){
  const h=s.hens.find(h=>h.id===id);if(!h)return "Poule introuvable.";
  if(h.petGainToday>=4)return "Tu peux toujours la caresser, mais le gain quotidien est atteint.";
  const points=Math.min(2,4-h.petGainToday);
  h.petGainToday+=points;h.trust=clamp(h.trust+points);
  h.affection=clamp(h.affection+points);h.happiness=clamp(h.happiness+3);
  return null;
}
export function careHen(s,id){
  const h=s.hens.find(h=>h.id===id);if(!h)return "Poule introuvable.";
  if(!h.sick)return "Cette poule n'a pas besoin de traitement.";
  if(s.coins<16)return "Le soin vétérinaire coûte 16 pièces.";
  s.coins-=16;h.sick=false;h.health=clamp(h.health+25);
  h.history.unshift({day:s.day,text:"Soignée par le vétérinaire"});return null;
}
export function harvestEgg(s,id,mark=false){
  const e=s.eggs.find(e=>e.id===id);if(!e||!["nest","grass","marked"].includes(e.status))return "Œuf introuvable.";
  if(mark){if(e.status==="grass")return "Un œuf trouvé dehors doit être ramassé.";e.status="marked";}
  else e.status="stored";
  return null;
}
export const storedEggs=s=>s.eggs.filter(e=>e.status==="stored").length;
export function sleepDay(s,rng=Math.random,now=Date.now()){
  recharge(s,now);if(s.energy<1)return "Plus d'énergie : elle revient toutes les dix minutes.";
  const recap={day:s.day,name:dayName(s),pets:[],sick:[],notes:[]};
  for(const h of s.hens){
    if(h.petGainToday)recap.pets.push({name:h.name,points:h.petGainToday});
    h.petGainLast=h.petGainToday;h.petGainToday=0;
    const fed=s.feederStock>=1,drank=s.waterStock>=1;
    if(fed)s.feederStock--;if(drank)s.waterStock--;
    h.satiety=clamp(h.satiety+(fed?12:-18));
    h.hydration=clamp(h.hydration+(drank?15:-21));
    const crowded=s.hens.length>6;
    h.social=clamp(s.hens.length>=2?85:45);
    h.stress=clamp(h.stress+(crowded?3:-2)+(h.satiety<35?5:0)+(h.trait==="Timide"?1:0));
    h.happiness=clamp(h.happiness+(fed&&drank?2:-7)+(crowded?-2:1)-(h.sick?3:0));
    h.health=clamp(h.health+((fed&&drank&&!h.sick)?1:-4));
    if(!h.sick&&rng()<(h.health<50?0.035:s.cleanliness<35?0.025:0.003)){
      h.sick=true;h.history.unshift({day:s.day,text:"Premiers symptômes d'une maladie"});
      recap.sick.push(h.name);
    }
    if(h.sick)h.health=clamp(h.health-2);
    if(h.age>=150&&h.age<2600&&h.health>=38&&rng()<Math.max(.1,.72-(h.sick?.25:0)-(h.stress>65?.2:0))){
      const escapeChance=clamp(5+(100-s.cleanliness)*.33+(crowded?20:0),1,75)/100;
      const ground=rng()<escapeChance;
      s.eggs.push({id:randomId(s),motherId:h.id,laidOn:s.day,
        status:ground?"grass":"nest",nest:ground?null:Math.floor(rng()*3),
        x:ground?-9+rng()*18:null,z:ground?-9+rng()*18:null,
        markedOn:null,fertile:false});
      h.eggsLaid++;
    }
    h.age++;if(h.age%365===0)h.history.unshift({day:s.day,text:"Anniversaire : "+Math.floor(h.age/365)+" an(s)"});
    // Natural death is deliberately not implemented in this first prototype.
  }
  s.cleanliness=clamp(s.cleanliness-Math.max(1,Math.ceil(s.hens.length/2)));
  if(!s.hens.length)recap.notes.push("Le terrain attend ses premières pensionnaires.");
  if(s.feederStock<Math.max(2,s.hens.length))recap.notes.push("Pense à recharger la mangeoire.");
  if(s.waterStock<Math.max(2,s.hens.length))recap.notes.push("Pense à remplir l'abreuvoir.");
  recap.notes.push("La récolte du matin t'attend : découvre les nids !");
  s.day++;s.energy--;if(s.energy===14)s.energyAt=now;
  s.marketDone=false;s.marketSession=null;s.lastRecap=recap;return null;
}
export function startMarket(s,price,rng=Math.random){
  if(!isMarketDay(s))return "Le marché ouvre le dimanche.";
  if(s.marketDone)return "Le marché de cette semaine est terminé.";
  if(s.marketSession)return null;
  const visitors=Array.from({length:6},(_,i)=>({
    name:NAMES[i],qty:1+Math.floor(rng()*4),budget:Math.max(1,Math.round(3+rng()*4)),
    bargain:rng()<.35
  }));
  s.marketSession={price:clamp(Number(price)||4,1,9),visitors,index:0,earned:0,sold:0,lastResult:""};
  return null;
}
export function marketDecision(s,decision,rng=Math.random){
  const m=s.marketSession;if(!m)return "Lance d'abord le marché.";
  const v=m.visitors[m.index];if(!v)return "Plus de visiteurs.";
  const eggs=s.eggs.filter(e=>e.status==="stored"),qty=Math.min(v.qty,eggs.length);
  const offer=Math.min(m.price,v.budget);
  let accepted=false,unitPrice=offer;
  if(decision==="accept"&&qty>0)accepted=true;
  if(decision==="counter"&&qty>0&&rng()<(.50+(m.price<=v.budget?.4:0))){accepted=true;unitPrice=m.price;}
  if(accepted){for(let i=0;i<qty;i++)s.eggs.splice(s.eggs.indexOf(eggs[i]),1);
    s.coins+=qty*unitPrice;m.earned+=qty*unitPrice;m.sold+=qty;
    m.lastResult="Vente de "+qty+" œuf(s) pour "+(qty*unitPrice)+" pièces.";}
  else m.lastResult="Pas de vente avec "+v.name+".";
  m.index++;
  if(m.index>=m.visitors.length||storedEggs(s)===0){
    s.lastMarket={day:s.day,earned:m.earned,sold:m.sold};s.marketDone=true;s.marketSession=null;
  }
  return null;
}
