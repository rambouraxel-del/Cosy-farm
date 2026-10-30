import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,BUILDINGS,readyForHens,buyBuilding,buyHen,
  buyFeed,fillFeeder,fillWater,sleepDay,petHen,harvestEgg,
  dayName,isMarketDay,storedEggs,startMarket,marketDecision,recharge
} from "../src/sim.js";

function prepared(){
 const s=createGame(0);
 for(const [kind,x,z] of [["pen",0,0],["coop",-5,0],["feeder",3,3],["water",4,-3]]){
   assert.equal(buyBuilding(s,kind,x,z),null);
 }
 return s;
}
test("démarrer sur une parcelle vide et acheter les quatre installations",()=>{
 const s=createGame(0);assert.equal(s.buildings.length,0);assert.equal(s.hens.length,0);
 assert.equal(readyForHens(s),false);assert.equal(buyHen(s,"rescue"),"Installe d'abord l'enclos, le poulailler, la mangeoire et l'abreuvoir.");
 assert.equal(readyForHens(prepared()),true);
});
test("le poulailler nécessite des réserves mais les journées restent volontaires",()=>{
 const s=prepared();assert.equal(buyHen(s,"rescue",()=>.2),null);
 const name=s.hens[0].name;
 assert.equal(buyFeed(s),null);assert.equal(fillFeeder(s),null);assert.equal(fillWater(s),null);
 assert.equal(petHen(s,s.hens[0].id),null);assert.equal(petHen(s,s.hens[0].id),null);
 assert.match(petHen(s,s.hens[0].id),/plafond|atteint/);
 const before=s.hens[0].age;
 assert.equal(sleepDay(s,()=>.99,1000),null);
 assert.equal(s.hens[0].age,before+1);assert.equal(s.energy,14);
 assert.equal(s.day,2);assert.equal(s.lastRecap.pets[0].name,name);
 assert.equal(s.lastRecap.pets[0].points,4);
 assert.equal(s.feederStock,17);assert.equal(s.waterStock,29);
 assert.equal(s.lastRecap.eggs,undefined,"la récolte doit rester secrète jusqu'au nid");
});
test("les œufs restent des entités individuelles et leur mère est cachée dans l'interface",()=>{
 const s=prepared();assert.equal(buyHen(s,"rescue",()=>.2),null);
 for(let i=0;i<4;i++)assert.equal(sleepDay(s,()=>.1,1000+i*1000),null);
 assert.ok(s.eggs.length>0);
 const egg=s.eggs[0];assert.ok(egg.motherId);
 assert.equal(harvestEgg(s,egg.id),null);assert.ok(storedEggs(s)>=1);
});
test("les dimanches ouvrent un marché de négociation avec des pièces réinvestissables",()=>{
 const s=createGame(0);s.day=7;s.eggs=[{id:"a",status:"stored"},{id:"b",status:"stored"}];
 assert.equal(dayName(s),"Dimanche");assert.equal(isMarketDay(s),true);
 assert.equal(startMarket(s,4,()=>.5),null);
 const coins=s.coins;assert.equal(marketDecision(s,"accept",()=>.5),null);
 assert.ok(s.coins>coins);assert.equal(storedEggs(s),0);assert.equal(s.marketDone,true);
});
test("l'énergie se recharge sans simuler les poules hors jeu",()=>{
 const s=createGame(0);s.energy=0;s.energyAt=0;s.day=22;
 recharge(s,600000*3+1000);assert.equal(s.energy,3);assert.equal(s.day,22);
 recharge(s,600000*30);assert.equal(s.energy,15);
});
