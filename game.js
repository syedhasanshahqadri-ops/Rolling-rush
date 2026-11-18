'use strict';
/* Rolling Rush 3D — modules: Save, Audio(A), Gen (procedural levels), G (physics/camera/obstacles/coins/env), UI */
const $=q=>document.querySelector(q),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/* ===== DATA ===== name,bg/fog,platform,accent,particle drift */
const WORLDS=[['Sky',0x8fd3ff,0xf4f8ff,0x3b82f6,-.4],['Candy',0xffb3e6,0xff9ad5,0x66d9ff,-.7],['Neon',0x0b0620,0x211150,0xff2bd6,0],['Desert',0xf2c879,0xe3b06a,0xb4532a,.2],['Ice',0xcfeeff,0xb5e3ff,0x4a9be0,-1],['Jungle',0x2f6b3a,0x6aa044,0xffd23f,.3],['Space',0x02030f,0x2e3363,0x88ccff,0],['Lava',0x2a0600,0x5a2415,0xff5a1f,1],['Cyberpunk',0x0a0f1f,0x1c2e55,0x00ffd5,0],['Fantasy',0x5b3fa0,0x9677dc,0xffd1f0,.5]];
const BALLS=[['classic','Classic Metal',0],['glass','Glass',100],['neon','Neon',200],['crystal','Crystal',350],['fire','Fire',500],['ice','Ice',700],['rainbow','Rainbow',1000],['gold','Golden',1500],['future','Futuristic',2000]];
const ACH=[['Finish a level',()=>Object.keys(S.done).length>=1,25],['Reach level 10',()=>S.lvl>=10,100],['Collect 500 coins',()=>S.tot>=500,100],['Own 3 balls',()=>S.balls.length>=3,75],['Reach level 50',()=>S.lvl>=50,300]];
/* ===== SAVE ===== */
let S;const Save={load(){let o={};try{o=JSON.parse(localStorage.getItem('rr3d'))||{}}catch(e){}
S=Object.assign({lvl:1,done:{},coins:0,tot:0,balls:['classic'],sel:'classic',world:-1,m:.5,s:.8,sens:1,theme:matchMedia('(prefers-color-scheme: light)').matches?'light':'dark',day:'',streak:0,ach:{},tut:0},o)},
save(){try{localStorage.setItem('rr3d',JSON.stringify(S))}catch(e){}}};Save.load();
/* ===== AUDIO ===== */
const A={c:null,init(){if(this.c){this.c.state==='suspended'&&this.c.resume();return}try{const c=this.c=new(window.AudioContext||window.webkitAudioContext)();this.mg=c.createGain();this.sg=c.createGain();this.mg.connect(c.destination);this.sg.connect(c.destination);
this.ro=c.createOscillator();this.rg=c.createGain();this.ro.type='triangle';this.ro.frequency.value=50;this.rg.gain.value=0;this.ro.connect(this.rg);this.rg.connect(this.sg);this.ro.start();this.vol();let i=0;const pat=[0,3,7,12,7,3,10,7];setInterval(()=>{if(G.st==='play')this.tone(220*2**(pat[i++%8]/12),.35,'triangle',.5,0,this.mg)},260)}catch(e){this.c=null}},
vol(){if(!this.c)return;this.mg.gain.value=S.m*.3;this.sg.gain.value=S.s},
roll(sp,g){if(this.c)this.rg.gain.value=g?clamp(sp/12,0,1)*.08:0,this.ro.frequency.value=40+sp*4},
tone(f,d,t,v,sl,bus){if(!this.c)return;const c=this.c,o=c.createOscillator(),g=c.createGain(),n=c.currentTime;o.type=t||'sine';o.frequency.setValueAtTime(f,n);if(sl)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+sl),n+d);g.gain.setValueAtTime(v,n);g.gain.exponentialRampToValueAtTime(.001,n+d);o.connect(g);g.connect(bus||this.sg);o.start(n);o.stop(n+d)},
sfx(n){const T=(a,b)=>a.forEach((f,i)=>setTimeout(()=>this.tone(f,.2,'triangle',.3),i*90));({coin:()=>{this.tone(880,.1,'square',.12);setTimeout(()=>this.tone(1320,.15,'square',.12),70)},jump:()=>this.tone(300,.2,'sine',.3,400),land:()=>this.tone(110,.12,'triangle',.4),bounce:()=>this.tone(200,.25,'sine',.3,500),cp:()=>T([523,659,784]),win:()=>T([523,659,784,1047,1319]),fall:()=>this.tone(500,.7,'sawtooth',.2,-450),click:()=>this.tone(600,.05,'square',.1)})[n]()}};
/* ===== LEVEL GENERATOR (seeded, always completable) ===== */
const Gen={rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}},
diff(L){const P=[[0,0],[10,.12],[30,.3],[60,.55],[100,.78],[200,1]];if(L>=200)return 1+(L-200)/300;let i=1;while(L>P[i][0])i++;const a=P[i-1],b=P[i];return a[1]+(b[1]-a[1])*(L-a[0])/(b[0]-a[0])},
WB:{0:{mover:2.5,mbridge:2},1:{bounce:2.5,ramp:2},2:{blink:2.5,boost:2},3:{sweep:2.5,roll:2},4:{ice:3,fall:1.5},5:{swing:2.5,brk:2},6:{bounce:2.5,boost:2.5},7:{hammer:2.5,fall:2},8:{sweep:2,blink:2,elev:2},9:{rot:3,mbridge:2.5}},
TYPES:[['plain',0],['gap',1],['bridge',3],['boost',4],['bounce',6],['spin',8],['ice',9],['mover',11],['fall',13],['sweep',15],['ramp',17],['roll',19],['blink',22],['elev',25],['swing',28],['hammer',20],['rot',30],['brk',35],['mbridge',45]],
TPL:[{},{boost:3,plain:2,ramp:2},{spin:3,sweep:3,swing:3,roll:3},{bridge:3,gap:3,fall:2,blink:2}],
build(L,wi){const rnd=this.rng(L*7919+13),r=()=>rnd(),d=this.diff(L),ds=Math.min(d,1.5),out={plats:[],obs:[],coins:[],cps:[]};
let z=0,y=0;const wd=()=>Math.max(2.6,6.8-d*2.2-r()*1.2);
const pl=(w,dd,k,o)=>{const p=Object.assign({x:0,y,z:z-dd/2,w,d:dd,k:k||'n',sl:0,on:true},o);p.y0=p.y;out.plats.push(p);z-=dd;return p};
const cn=(x,yy,zz)=>out.coins.push([x,yy,zz]);
const line=(p,n)=>{const lx=(r()-.5)*Math.max(0,p.w-3.2);for(let i=0;i<n;i++)cn(p.x+lx,p.y+1,p.z+p.d/2-(i+1)*p.d/(n+1))};
const ob=o=>out.obs.push(Object.assign({y,h:.9,r:.22},o));
const T={plain(){line(pl(wd(),7+r()*7),3)},
gap(){const g=1.2+r()*(1+ds*1.3);z-=g;cn(0,y+1.7,z+g/2);line(pl(wd(),6+r()*5),2)},
bridge(){line(pl(Math.max(1.9,2.7-ds*.8),12+r()*10),5)},
boost(){pl(wd(),5,'boost');line(pl(wd(),8),3)},
bounce(){pl(wd(),3,'bounce');z-=4+r()*2;cn(0,y+4,z+3);line(pl(wd(),9),3)},
spin(){const p=pl(7.2,14);ob({k:'spin',x:0,z:p.z,L:3.3,s:(1.2+ds*1.4)*(r()<.5?1:-1)});line(pl(wd(),4),2)},
ice(){line(pl(wd(),12+r()*6,'ice'),4)},
mover(){z-=1;pl(4.2,5,'mv',{x0:0,A:Math.min(2,1.6+ds*.4),s:1.2+ds*.8+r()*.6,ph:r()*6});z-=1;line(pl(wd(),6),2)},
fall(){for(let i=0;i<5;i++){pl(3.4,2.4,'fall',{tm:-1,fv:0});z-=.4}line(pl(wd(),5),2)},
sweep(){const p=pl(6.6,10);ob({k:'sweep',x:0,z:p.z,A:p.w/2-1.8,s:1.4+ds,ph:r()*6});line(pl(wd(),4),2)},
ramp(){if(r()<.6){const sl=.35,len=(2+r()*1.5)/sl;pl(5,len,'ramp',{sl});y+=sl*len;z-=1.3+r()*.6}else{pl(5,6,'ramp',{sl:-.3});y-=1.8}line(pl(wd(),8),3)},
roll(){const p=pl(7,16);ob({k:'roll',x:(r()-.5)*3,z0:p.z-p.d/2,d:p.d,s:5+ds*3,ph:r()*3,r:.55,h:1.1})},
blink(){for(let i=0;i<4;i++){pl(3.6,3.6,'blink',{ph:i*.9+r()});z-=.5}pl(wd(),5)},
elev(){z-=1.5;pl(4,5,'elev',{A:.6,s:1.2+ds*.5,ph:r()*6});z-=1.5;pl(wd(),6)},
hammer(){const p=pl(7.4,14),e=r()<.5?-1:1;ob({k:'hammer',x:e*p.w/2,z:p.z,L:p.w*.85,s:(1.5+ds)*(r()<.5?1:-1),r:.5,h:1});line(pl(wd(),4),2)},
rot(){const p=pl(6,6,'rot',{y:y+.02,s:(.5+ds*.5)*(r()<.5?1:-1),a:0,da:0});cn(0,y+1,p.z);line(pl(wd(),5),2)},
brk(){for(let k=0;k<3;k++){const p=pl(4,3,'brk',{tm:-1});cn(0,y+1,p.z);z-=.4}line(pl(wd(),5),2)},
mbridge(){const p=pl(2.6,10,'mv',{x0:0,A:1.1+ds*.2,s:.9+ds*.5,ph:r()*6});cn(0,y+1,p.z);line(pl(wd(),5),2)},
swing(){const p=pl(7.2,14);ob({k:'swing',x:0,z:p.z,L:3.4,s:1.6+ds})}};
const tpl=this.TPL[Math.floor(r()*4)],av=this.TYPES.filter(t=>L>=t[1]),n=7+Math.min(90,Math.floor(L/3));let hist=[];
pl(7,10,'start');out.cps.push(out.plats[0]);
for(let i=0;i<n;i++){if(i&&i%Math.ceil(n/3)===0){out.cps.push(pl(6,6,'cp'))}
if(i&&i%6===0){const p=pl(7,14);for(let a=0;a<3;a++)for(let b=0;b<6;b++)cn((a-1)*1.8,y+1,p.z+p.d/2-(b+1)*2)}
let t,g=0;do{const tw=av.map(a=>(tpl[a[0]]||1)*(L<a[1]+4&&a[1]>0?.6:1)*((this.WB[wi]||{})[a[0]]||1)),s=tw.reduce((a,b)=>a+b);let q=r()*s,k=0;while((q-=tw[k])>0&&k<tw.length-1)k++;t=av[k][0]}while(hist.includes(t)&&g++<6&&av.length>3);
hist.push(t);if(hist.length>2)hist.shift();T[t]()}
out.fin=pl(8,12,'fin');out.speed=Math.min(13,8+d*4.5);out.tpl=tpl;return out}};
/* ===== 3D / GAME ===== */
const cv=$('#c');let ren,scn,cam,hemi,dir,lvlG,ballG,pts,PTS=[];
const BOX=new THREE.BoxGeometry(1,1,1),SPH=new THREE.SphereGeometry(1,16,12),COIN=new THREE.CylinderGeometry(.35,.35,.08,16).rotateX(Math.PI/2);
const keys={};let tx=0,jumpReq=false,ps=null,deferred=null;
const OB={spin:(o,t)=>{const a=t*o.s,c=Math.cos(a)*o.L,s=Math.sin(a)*o.L;return[o.x-c,o.z-s,o.x+c,o.z+s]},
swing:(o,t)=>{const a=Math.sin(t*o.s)*1.15,c=Math.cos(a)*o.L,s=Math.sin(a)*o.L;return[o.x-c,o.z-s,o.x+c,o.z+s]},
sweep:(o,t)=>{const c=o.x+Math.sin(t*o.s+o.ph)*o.A;return[c-1.6,o.z,c+1.6,o.z]},
hammer:(o,t)=>{const a=t*o.s;return[o.x,o.z,o.x+Math.cos(a)*o.L,o.z+Math.sin(a)*o.L]},
roll:(o,t)=>{const z=o.z0+(t*o.s+o.ph*3)%o.d;return[o.x,z,o.x,z]}};
const G={st:'menu',t:0,L:1,mats:[],plats:[],obs:[],coins:[],b:{p:new THREE.Vector3(),v:new THREE.Vector3(),g:false,ly:0,bt:0,surf:''},cp:null,tm:0,lives:3,got:0,falls:0,sp:9,fps:0,fc:0,
init(){ren=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'});scn=new THREE.Scene();cam=new THREE.PerspectiveCamera(60,1,.1,200);
hemi=new THREE.HemisphereLight(0xffffff,0x556677,.95);dir=new THREE.DirectionalLight(0xffffff,.9);scn.add(hemi,dir,dir.target,lvlG=new THREE.Group(),ballG=new THREE.Group());
const pm=new THREE.MeshBasicMaterial({color:0xffd34d});for(let i=0;i<40;i++){const m=new THREE.Mesh(SPH,pm);m.scale.setScalar(.07);m.visible=false;scn.add(m);PTS.push({m,v:new THREE.Vector3(),l:0})}
const ge=new THREE.BufferGeometry(),pa=new Float32Array(450);for(let i=0;i<450;i+=3){pa[i]=(Math.random()-.5)*60;pa[i+1]=Math.random()*30-8;pa[i+2]=Math.random()*60-45}
ge.setAttribute('position',new THREE.BufferAttribute(pa,3));pts=new THREE.Points(ge,new THREE.PointsMaterial({size:.18,transparent:true,opacity:.8}));pts.frustumCulled=false;scn.add(pts);
this.setBall();this.resize();addEventListener('resize',()=>this.resize());this.load(S.lvl);UI.menu();requestAnimationFrame(loop)},
resize(){const pr=Math.min(devicePixelRatio||1,this.pr||2);ren.setPixelRatio(pr);ren.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;this.fov=cam.aspect<1?78:60;cam.fov=this.fov;cam.updateProjectionMatrix()},
setBall(){while(ballG.children.length)ballG.remove(ballG.children[0]);const id=S.sel,M=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.5,metalness:.2},o));let g=new THREE.SphereGeometry(.5,32,24),m;
({glass:()=>m=new THREE.MeshPhysicalMaterial({color:0xbfe9ff,transparent:true,opacity:.6,roughness:0,clearcoat:1}),neon:()=>m=M(0x111111,{emissive:0x00ff88,emissiveIntensity:1.2}),crystal:()=>{g=new THREE.IcosahedronGeometry(.5,1);m=M(0xb07cff,{flatShading:true,roughness:.1,emissive:0x331166})},fire:()=>m=M(0xff5a00,{emissive:0xff3300}),ice:()=>m=M(0x9fe8ff,{roughness:.05,emissive:0x1a6a99}),rainbow:()=>m=M(0xffffff,{emissive:0x333333}),gold:()=>m=M(0xffc933,{metalness:1,roughness:.25,emissive:0x442a00}),future:()=>m=M(0x0a1a2a,{metalness:.9,roughness:.2,emissive:0x00e5ff,emissiveIntensity:.6})})[id]?.();
m=m||M(0xc9d2dc,{metalness:.85,roughness:.25,emissive:0x1a1e24});this.bmat=m;const b=this.bm=new THREE.Mesh(g,m),rm=M(0x222222,{roughness:.8}),r1=new THREE.Mesh(new THREE.TorusGeometry(.5,.05,6,24),rm),r2=r1.clone();r2.rotation.y=Math.PI/2;b.add(r1,r2);ballG.add(b)},
load(L){this.L=L;let wi=Math.floor((L-1)/10)%10;if(S.world>=0&&S.lvl>S.world*10)wi=S.world;else S.world=-1;this.wi=wi;const w=WORLDS[wi],bg=new THREE.Color(w[1]);scn.background=bg;scn.fog=new THREE.Fog(bg,28,100);
const dark=(bg.r+bg.g+bg.b)<1;hemi.intensity=dark?1.1:.95;pts.material.color.setHex(w[3]===0?0xffffff:w[3]);this.drift=w[4];
for(const m of this.mats)m.dispose();this.mats=[];while(lvlG.children.length)lvlG.remove(lvlG.children[0]);
const mk=(c,o)=>{const m=new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.7},o));this.mats.push(m);return m},lv=Gen.build(L,wi),acc=w[3];this.lv=lv;this.sp=lv.speed;
const base=new THREE.Color(w[2]),MT={n0:mk(base),n1:mk(base.clone().lerp(new THREE.Color(dark?0xffffff:0x000000),.12)),ice:mk(0xaee8ff,{roughness:.05,metalness:.3}),boost:mk(0xff9d00,{emissive:0xff6a00,emissiveIntensity:.8}),bounce:mk(0x4cff7a,{emissive:0x108a30,emissiveIntensity:.6}),cp:mk(0xffe14d,{emissive:0x806a00,emissiveIntensity:.5}),fin:mk(0xffffff,{emissive:0x666666}),acc:mk(acc,{emissive:acc,emissiveIntensity:.25}),ob:mk(acc,{emissive:acc,emissiveIntensity:.6}),brk:mk(0xc98b5a,{roughness:.9})};
this.plats=lv.plats;this.plats.forEach((p,i)=>{const m=p.m=new THREE.Mesh(BOX,MT[p.k==='n'||p.k==='start'||p.k==='ramp'?'n'+(i%2):['mv','elev','fall','blink','rot'].includes(p.k)?'acc':p.k]||MT.n0);lvlG.add(m);
const c=Math.cos(Math.atan(p.sl));m.scale.set(p.w,1,p.d/c);m.rotation.x=Math.atan(p.sl);p.fv=0;if(p.k==='fall')p.tm=-1;
if(p.k==='cp'||p.k==='fin'){const f=new THREE.Mesh(BOX,MT.ob);f.scale.set(.2,4,.2);f.position.set(p.x-p.w/2+.3,p.y+2,p.z);lvlG.add(f);const f2=f.clone();f2.position.x=p.x+p.w/2-.3;lvlG.add(f2);const t=new THREE.Mesh(BOX,MT.ob);t.scale.set(p.w,.5,.3);t.position.set(p.x,p.y+4,p.z);lvlG.add(t)}});
this.obs=lv.obs;this.obs.forEach(o=>{const m=o.m=new THREE.Mesh(o.k==='roll'?SPH:BOX,MT.ob);lvlG.add(m);if(o.k==='roll')m.scale.setScalar(o.r)});
const cm=mk(0xffd34d,{emissive:0xaa7a00,emissiveIntensity:.7,metalness:.6,roughness:.3});this.coins=lv.coins.map(c=>{const m=new THREE.Mesh(COIN,cm);m.position.set(c[0],c[1],c[2]);lvlG.add(m);return{m,on:true}});
this.cp=lv.cps[0];this.respawn(true);this.tm=0;this.got=0;this.falls=0;this.lives=3;this.syncPlats(0)},
respawn(first){const b=this.b,c=this.cp;b.p.set(c.x,c.y+1,c.z);b.v.set(0,0,0);b.g=false;b.ly=c.y;b.bt=0;this.spawnT=.4;for(const q of this.plats){if(q.k==='fall'||q.k==='brk'){q.tm=-1;q.fv=0;q.y=q.y0;q.on=true}}
cam.position.set(b.p.x,b.p.y+5,b.p.z+9);this.syncPlats(0)},
start(L){A.init();if(!S.tut){S.tut=1;Save.save();UI.tut(L);return}this.load(L);this.st='play';UI.hide();$('#hud').hidden=false;this.hud();this.toast('Level '+L+' — '+WORLDS[this.wi][0]+' World')},
setCp(p){this.cp=p;A.sfx('cp');this.burst(this.b.p,8);this.toast('✔ Checkpoint')},
die(){if(this.st!=='play')return;this.lives--;this.falls++;this.st='dead';this.dt=.7;A.sfx('fall');this.hud()},
finish(){if(this.st!=='play')return;this.st='win';A.sfx('win');const L=this.L,rew=this.got+10+Math.floor(L/5),first=!S.done[L],best=S.done[L];S.coins+=rew;S.tot+=this.got;if(!best||this.tm<best)S.done[L]=+this.tm.toFixed(1);if(L>=S.lvl)S.lvl=L+1;let ac=0;ACH.forEach((a,i)=>{if(!S.ach[i]&&a[1]()){S.ach[i]=1;S.coins+=a[2];ac+=a[2]}});Save.save();$('#hud').hidden=true;UI.win(rew,ac,best)},
pause(){if(this.st==='play'){this.st='pause';UI.pause()}},hud(){$('#hl').textContent='Level '+this.L;$('#hc').textContent='🪙 '+(S.coins+this.got);$('#hv').textContent='❤'.repeat(this.lives)||'💔'},
toast(m){const t=$('#toast');t.textContent=m;t.className='s';clearTimeout(this.tt);this.tt=setTimeout(()=>t.className='',1400)},
burst(p,n){let k=0;for(const q of PTS){if(q.l>0)continue;q.l=.6;q.m.visible=true;q.m.position.copy(p);q.v.set((Math.random()-.5)*6,Math.random()*5+1,(Math.random()-.5)*6);if(++k>=n)break}},
syncPlats(dt){const t=this.t;for(const q of this.plats){q.dx=0;if(q.k==='mv'){const nx=q.x0+Math.sin(t*q.s+q.ph)*q.A;q.dx=nx-q.x;q.x=nx}else if(q.k==='elev')q.y=q.y0+Math.sin(t*q.s+q.ph)*q.A;else if(q.k==='blink')q.on=((t+q.ph)%2.6)<1.9;
else if(q.k==='brk'&&q.tm>=0&&q.on){q.tm+=dt;if(q.tm>.5){q.on=false;this.burst(q.m.position,6)}}else if(q.k==='rot'){const na=t*q.s;q.da=na-q.a;q.a=na;q.m.rotation.y=na}else if(q.k==='fall'&&q.tm>=0){q.tm+=dt;if(q.tm>.55){q.fv+=26*dt;q.y-=q.fv*dt;if(q.y<q.y0-40)q.on=false}}
if(q.k==='mv'&&q.x0===undefined)q.x0=0;q.m.visible=q.on;q.m.position.set(q.x,q.y+q.sl*q.d/2-.5,q.z)}
for(const o of this.obs){const s=o.seg=OB[o.k](o,t),dx=s[2]-s[0],dz=s[3]-s[1],m=o.m;m.position.set((s[0]+s[2])/2,o.y+(o.k==='roll'?o.r:o.h/2),(s[1]+s[3])/2);if(o.k!=='roll'){m.rotation.y=-Math.atan2(dz,dx);m.scale.set(Math.hypot(dx,dz)+2*o.r,o.h,2*o.r)}}},
step(dt,noIn){const b=this.b,p=b.p,v=b.v,steer=noIn?0:clamp((keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+tx,-1,1),ice=b.surf==='ice',gd=b.g;
const sp=this.sp*(keys.KeyW||keys.ArrowUp?1.3:keys.KeyS||keys.ArrowDown?.65:1)*(b.bt>0?1.8:1);b.bt-=dt;
if(!noIn){v.z+=(-sp-v.z)*Math.min(1,(gd?(ice?2.5:9):1.5)*dt);v.x+=steer*(gd?(ice?9:34):12)*dt;v.x*=Math.exp(-(gd?(ice?.25:3.2):.6)*dt)}
if(jumpReq){if(gd&&!noIn){v.y=9;b.g=false;A.sfx('jump')}jumpReq=false}
v.y-=26*dt;p.addScaledVector(v,dt);let best=-1e9,bp=null;
for(const q of this.plats){if(!q.on)continue;let lx=p.x-q.x,lz=p.z-q.z;if(q.k==='rot'){const c=Math.cos(q.a),sn=Math.sin(q.a),X=lx;lx=X*c-lz*sn;lz=X*sn+lz*c}if(Math.abs(lx)>q.w/2+.2||Math.abs(lz)>q.d/2+.2)continue;const zz=clamp(p.z,q.z-q.d/2,q.z+q.d/2),top=q.y+q.sl*(q.z+q.d/2-zz),f=p.y-.5;
if(f<=top+.15&&f>=top-.7&&v.y<=2+Math.max(0,-q.sl*v.z)&&top>best){best=top;bp=q}}
if(bp){const imp=v.y;p.y=best+.5;if(imp<-9&&!gd){A.sfx('land');v.y=-imp*.3;b.g=false}else{if(!gd&&imp<-4)A.sfx('land');v.y=-bp.sl*v.z;b.g=true;b.ly=best}
if(bp.k==='rot'){const X=p.x-bp.x,Z=p.z-bp.z,c=Math.cos(bp.da),sn=Math.sin(bp.da);p.x=bp.x+X*c+Z*sn;p.z=bp.z-X*sn+Z*c;bp.da=0}else{p.x+=bp.dx;bp.dx=0}b.surf=bp.k;b.bp=bp;if(bp.k==='boost')b.bt=1.2;else if(bp.k==='bounce'){v.y=14;b.g=false;A.sfx('bounce')}else if((bp.k==='fall'||bp.k==='brk')&&bp.tm<0)bp.tm=0;else if(bp.k==='cp'&&this.cp!==bp)this.setCp(bp);else if(bp.k==='fin'&&this.st==='play')this.finish()}else{b.g=false;b.surf=''}
for(const o of this.obs){const s=o.seg,dx=s[2]-s[0],dz=s[3]-s[1],l2=dx*dx+dz*dz;let u=l2?((p.x-s[0])*dx+(p.z-s[1])*dz)/l2:0;u=clamp(u,0,1);const ex=p.x-(s[0]+dx*u),ez=p.z-(s[1]+dz*u),dd=Math.hypot(ex,ez),rr=.5+o.r;
if(dd<rr&&p.y-.5<o.y+o.h&&p.y+.5>o.y){const nx=dd?ex/dd:1,nz=dd?ez/dd:0;p.x+=nx*(rr-dd);p.z+=nz*(rr-dd);const vn=v.x*nx+v.z*nz;if(vn<0){v.x-=vn*nx*1.6;v.z-=vn*nz*1.6}v.x+=nx*5;v.z+=nz*2;if(!o.hit||this.t-o.hit>.3)A.sfx('land');o.hit=this.t}}
for(const c of this.coins){if(c.on&&c.m.position.distanceToSquared(p)<.85){c.on=false;c.m.visible=false;this.got++;A.sfx('coin');this.burst(c.m.position,5);this.hud()}}
if(this.st==='play'&&p.y<b.ly-12)this.die()},
frame(dt){this.t+=dt;const b=this.b,p=b.p,v=b.v;this.fc++;this.fs=(this.fs||0)+dt;if(this.fs>2){const f=this.fc/this.fs;this.fs=0;this.fc=0;if(f<38&&(this.pr||2)>1){this.pr=1;this.resize()}}
if(this.st==='play'||this.st==='dead'){this.tm+=this.st==='play'?dt:0;this.syncPlats(dt);const n=2;for(let i=0;i<n;i++)this.step(dt/n,this.st==='dead');
if(this.st==='dead'&&(this.dt-=dt)<=0){if(this.lives>0){this.st='play';this.respawn();$('#hud').hidden=false}else{this.st='over';$('#hud').hidden=true;UI.over()}}
if(this.st==='play')$('#bi').style.width=clamp(p.z/this.lv.fin.z,0,1)*100+'%';A.roll(-v.z,b.g)}
else if(this.st==='menu'||this.st==='win'||this.st==='over'){this.syncPlats(dt)}
if(this.spawnT>0)this.spawnT-=dt;ballG.position.copy(p);ballG.scale.setScalar(this.spawnT>0?1-this.spawnT/.4:1);
const sx=Math.hypot(v.x,v.z);if(sx>.01&&this.st!=='menu'){const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(v.z,0,-v.x).normalize(),sx*dt/.5);this.bm.quaternion.premultiply(q)}
const bm=this.bmat,t=this.t;if(S.sel==='rainbow'){bm.color.setHSL(t*.3%1,.9,.55);bm.emissive.setHSL(t*.3%1,.9,.25)}else if(S.sel==='fire')bm.emissiveIntensity=.9+Math.sin(t*20)*.3;else if(S.sel==='neon')bm.emissiveIntensity=1.1+Math.sin(t*4)*.3;
for(const c of this.coins)if(c.on)c.m.rotation.y=t*3;
for(const q of PTS){if(q.l>0){q.l-=dt;q.v.y-=14*dt;q.m.position.addScaledVector(q.v,dt);if(q.l<=0)q.m.visible=false}}
const pa=pts.geometry.attributes.position.array;for(let i=1;i<pa.length;i+=3){pa[i]+=this.drift*dt*3;if(pa[i]>22)pa[i]=-8;if(pa[i]<-8)pa[i]=22}pts.geometry.attributes.position.needsUpdate=true;pts.position.set(p.x,p.y,p.z);
dir.position.set(p.x+5,p.y+12,p.z+6);dir.target.position.copy(p);
let tp,lk;if(this.st==='menu'||this.st==='win'||this.st==='over'){const a=t*.4;tp=new THREE.Vector3(p.x+Math.sin(a)*7,p.y+3.5,p.z+Math.cos(a)*7);lk=new THREE.Vector3(p.x,p.y+.5,p.z-2);cam.position.lerp(tp,1-Math.exp(-3*dt))}
else{const cy=Math.max(p.y,b.ly-3)+4.3+Math.min(1.5,Math.max(0,-v.z)*.06);tp=new THREE.Vector3(p.x*.7,cy,p.z+8.5);lk=new THREE.Vector3(p.x*.85,Math.max(p.y,b.ly-3)+.3,p.z-7);cam.position.lerp(tp,1-Math.exp(-6*dt));cam.fov=this.fov+clamp(-v.z-8,0,8)*.8+(b.g?0:2);cam.updateProjectionMatrix()}
cam.lookAt(lk)}};
let last=performance.now();function loop(n){requestAnimationFrame(loop);const dt=Math.min(.05,(n-last)/1000);last=n;if(G.st!=='pause'){G.frame(dt)}ren.render(scn,cam)}
/* ===== UI ===== */
const btn=(a,t,v,c)=>`<button data-a="${a}" ${v!==undefined?`data-v="${v}"`:''} class="${c||''}">${t}</button>`,show=h=>{$('#ui').innerHTML=h},isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!navigator.standalone,standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
const UI={hide(){show('')},
menu(){G.st='menu';$('#hud').hidden=true;show(`<div class="card"><h1>ROLLING<br>RUSH <b>3D</b></h1><p class="sub">Level ${S.lvl} · 🪙 ${S.coins}</p>${btn('play','▶ PLAY','','big')}<div class="g2">${btn('levels','Levels',0)}${btn('balls','Balls')}${btn('worlds','Worlds')}${btn('daily','Daily 🎁')}${btn('ach','Achievements')}${btn('set','Settings')}</div>${!standalone&&(deferred||isIOS)?btn('install','⬇ Install App','','pri'):''}</div>`)},
play(){G.start(S.lvl)},
levels(pg){pg=+pg;const mx=Math.floor((S.lvl-1)/20);pg=clamp(pg,0,mx);let h='';for(let i=pg*20+1;i<=pg*20+20;i++)h+=`<button data-a="go" data-v="${i}" class="${i>S.lvl?'lock':S.done[i]?'sel':''}">${i>S.lvl?'🔒':i}</button>`;show(`<div class="card"><h2>Levels</h2><div class="g5">${h}</div><p>Unlimited levels · page ${pg+1}</p><div class="g2" style="margin-top:8px">${btn('levels','◀',pg-1)}${btn('levels','▶',pg+1)}</div>${btn('menu','Back')}</div>`)},
go(v){if(+v<=S.lvl)G.start(+v)},
balls(){show(`<div class="card"><h2>Balls · 🪙 ${S.coins}</h2>${BALLS.map(b=>`<div class="row ${S.sel===b[0]?'sel':''}"><span>${b[1]}<small>${S.balls.includes(b[0])?'Owned':'🪙 '+b[2]}</small></span>${btn('buy',S.sel===b[0]?'Selected':S.balls.includes(b[0])?'Use':'Buy',b[0])}</div>`).join('')}${btn('menu','Back')}</div>`)},
buy(id){const b=BALLS.find(x=>x[0]===id);if(!S.balls.includes(id)){if(S.coins<b[2])return G.toast('Not enough coins');S.coins-=b[2];S.balls.push(id)}S.sel=id;Save.save();G.setBall();UI.balls()},
worlds(){show(`<div class="card"><h2>Worlds</h2><div class="row ${S.world<0?'sel':''}"><span>Auto<small>Changes every 10 levels</small></span>${btn('wsel',S.world<0?'On':'Use',-1)}</div>${WORLDS.map((w,i)=>{const ok=S.lvl>i*10;return`<div class="row ${S.world===i?'sel':''} ${ok?'':'lock'}"><span>${w[0]}<small>${ok?'Unlocked':'Reach level '+(i*10+1)}</small></span>${ok?btn('wsel',S.world===i?'On':'Use',i):'🔒'}</div>`}).join('')}${btn('menu','Back')}</div>`)},
wsel(v){S.world=+v;Save.save();G.load(S.lvl);UI.worlds()},
daily(){const td=new Date().toDateString(),ok=S.day!==td;show(`<div class="card"><h2>Daily Reward</h2><p>Streak: ${S.streak} day(s)</p><p>${ok?'Your reward is ready!':'Come back tomorrow.'}</p>${ok?btn('claim','Claim 🎁','','big'):''}${btn('menu','Back')}</div>`)},
claim(){const td=new Date().toDateString(),y=new Date(Date.now()-864e5).toDateString();S.streak=S.day===y?S.streak+1:1;S.day=td;const r=25*Math.min(S.streak,7);S.coins+=r;Save.save();G.toast('+'+r+' coins');A.sfx('win');UI.daily()},
ach(){show(`<div class="card"><h2>Achievements</h2>${ACH.map((a,i)=>`<div class="row ${S.ach[i]?'sel':''}"><span>${a[0]}<small>Reward 🪙 ${a[2]}</small></span><span>${S.ach[i]?'✔':'—'}</span></div>`).join('')}${btn('menu','Back')}</div>`)},
set(){show(`<div class="card"><h2>Settings</h2><div class="row">Music<input type="range" min="0" max="1" step=".05" value="${S.m}" data-r="m"></div><div class="row">Effects<input type="range" min="0" max="1" step=".05" value="${S.s}" data-r="s"></div><div class="row">Steering<input type="range" min=".5" max="2" step=".1" value="${S.sens}" data-r="sens"></div><div class="row">Theme<select data-r="theme"><option value="dark" ${S.theme==='dark'?'selected':''}>Dark</option><option value="light" ${S.theme==='light'?'selected':''}>Light</option></select></div>${btn('tut','How to play')}${btn('reset','Reset progress')}${btn('menu','Back','','pri')}</div>`)},
tut(L){show(`<div class="card"><h2>How to play</h2><p>📱 Drag left/right to steer · tap to jump</p><p>⌨ A/D or ←/→ steer · W/S speed · Space jump · Esc pause</p><p>Collect 🪙, touch flags for checkpoints, reach the finish. You have 3 lives per level.</p>${btn('begin','Got it',L||'','big')}</div>`)},
begin(v){S.tut=1;Save.save();v?G.start(+v):UI.set()},
reset(){if(confirm('Erase all progress?')){localStorage.removeItem('rr3d');Save.load();applyTheme();G.setBall();G.load(1);UI.menu()}},
install(){if(deferred){deferred.prompt();deferred=null;UI.menu()}else show(`<div class="card"><h2>Install</h2><p>Tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.</p>${btn('menu','OK')}</div>`)},
pause(){G.pause();show(`<div class="card"><h2>Paused</h2>${btn('resume','▶ Resume','','big')}<div class="g2">${btn('retry','↻ Restart')}${btn('set','Settings')}</div>${btn('menu','Main menu')}</div>`)},
resume(){UI.hide();G.st='play'},retry(){UI.hide();G.start(G.L)},
over(){show(`<div class="card"><h2>Game Over</h2><p>You ran out of lives on level ${G.L}.</p>${btn('retry','↻ Retry','','big')}${btn('menu','Main menu')}</div>`)},
win(rew,ac,best){show(`<div class="card"><h1>🏁 <b>Level ${G.L}</b></h1><p class="sub">Complete!</p><div class="row"><span>Coins collected</span><span>${G.got}/${G.coins.length}</span></div><div class="row"><span>Time</span><span>${G.tm.toFixed(1)}s${best&&best<=G.tm?' (best '+best+'s)':' 🏆'}</span></div><div class="row"><span>Falls</span><span>${G.falls}</span></div><div class="row"><span>Reward</span><span>🪙 +${rew}${ac?' (+'+ac+' achievement)':''}</span></div>${btn('next','Next level ▶','','big')}<div class="g2">${btn('retry','↻ Replay')}${btn('menu','Menu')}</div></div>`)},
next(){G.start(G.L+1)}};
function applyTheme(){document.documentElement.dataset.theme=S.theme;document.querySelector('meta[name=theme-color]').content=S.theme==='light'?'#eaf0ff':'#0e1224'}
document.addEventListener('click',e=>{const t=e.target.closest('[data-a]');if(!t)return;A.init();A.sfx('click');const a=t.dataset.a;if(UI[a])UI[a](t.dataset.v)});
document.addEventListener('input',e=>{const k=e.target.dataset.r;if(!k)return;S[k]=k==='theme'?e.target.value:+e.target.value;if(k==='theme')applyTheme();A.vol();Save.save()});
addEventListener('keydown',e=>{keys[e.code]=1;if(e.code==='Space'){jumpReq=true;e.preventDefault()}if(e.code==='Escape'||e.code==='KeyP')UI.pause()});addEventListener('keyup',e=>keys[e.code]=0);
cv.addEventListener('pointerdown',e=>{A.init();ps={x:e.clientX,t:performance.now(),m:0};cv.setPointerCapture(e.pointerId)});
cv.addEventListener('pointermove',e=>{if(!ps)return;const dx=e.clientX-ps.x;ps.m=Math.max(ps.m,Math.abs(dx));tx=clamp(dx/(innerWidth*.1)*S.sens,-1,1)});
const up=()=>{if(ps&&ps.m<14&&performance.now()-ps.t<300)jumpReq=true;ps=null;tx=0};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
document.addEventListener('visibilitychange',()=>{if(document.hidden)UI.pause()});
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(G.st==='menu')UI.menu()});
cv.addEventListener('contextmenu',e=>e.preventDefault());
applyTheme();G.init();
