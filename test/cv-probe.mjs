import { chromium } from "playwright";
const base="http://localhost:8090", id=process.argv[2]||9008, keys=(process.argv[3]||"2").split(","), extra=process.argv[4]||"";
const b=await chromium.launch({args:["--use-angle=swiftshader","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required"]});
const p=await (await b.newContext({viewport:{width:960,height:680}})).newPage();
p.on("console",m=>{const t=m.text(); if(!/probe|dropping/.test(t)) console.log("C:",t.slice(0,200))});
p.on("pageerror",e=>console.log("E:",e.message));
await p.goto(`${base}/player.html?id=${id}&autodownload=1${extra}`);
await p.waitForFunction(()=>window.__player?.ready||window.__player?.error,null,{timeout:300000});
await p.waitForTimeout(+process.env.START||6000);
await p.mouse.click(480,340);for(const k of keys){await p.keyboard.press(k);await p.waitForTimeout(+process.env.WAIT||25000);
 const r=await p.evaluate(async()=>{const cs=[...document.querySelectorAll("canvas")].map(c=>({w:c.width,h:c.height,cw:c.clientWidth,ch:c.clientHeight,vis:getComputedStyle(c).visibility+"/"+getComputedStyle(c).display+"/"+getComputedStyle(c).opacity}));
 let shot=null;try{const s=await window.__player.ci.screenshot();let nz=0;for(let i=0;i<s.data.length;i+=4)if(s.data[i]|s.data[i+1]|s.data[i+2])nz++;shot={w:s.width,h:s.height,nz}}catch(e){shot=String(e)}
 return {cs,shot}});console.log(k,JSON.stringify(r));await p.screenshot({path:`shots/sound/cv-${process.argv[5]||"x"}-${k}.png`});}
await b.close();
