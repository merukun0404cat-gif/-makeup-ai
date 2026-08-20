const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const KEY = "meruMakeupAI_v1";
const state = Object.assign({
  mode:"仕事", modeIcon:"💼", hoursOut:"8", priority:"崩れにくさ",
  exp:0, streak:0, meruPt:0, records:[], cosmetics:[], idealImages:[],
  idealMemo:"", apiEndpoint:"", lastVisit:""
}, JSON.parse(localStorage.getItem(KEY)||"{}"));

const DB_NAME="meruMakeupPhotos_v1", STORE="photos";
let db;
function openDB(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,1);
    r.onupgradeneeded=()=>{ if(!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess=()=>{db=r.result;resolve(db)}; r.onerror=()=>reject(r.error);
  });
}
function putPhoto(key, blob){return new Promise((res,rej)=>{const t=db.transaction(STORE,"readwrite");t.objectStore(STORE).put(blob,key);t.oncomplete=res;t.onerror=()=>rej(t.error)})}
function getPhoto(key){return new Promise((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function delPhoto(key){return new Promise((res,rej)=>{const r=db.transaction(STORE,"readwrite").objectStore(STORE).delete(key);r.onsuccess=res;r.onerror=()=>rej(r.error)})}
function getAllPhotoKeys(){return new Promise((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).getAllKeys();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}

function save(){localStorage.setItem(KEY,JSON.stringify(state));renderStats();renderRecords();renderCosmetics();renderIdeal()}
function today(){return new Date().toISOString().slice(0,10)}
function nowLabel(){return new Intl.DateTimeFormat("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date())}
function uid(p="id"){return `${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,n))}
function hashScore(seed,base=80,spread=8){
  let h=0; for(const c of seed) h=((h<<5)-h)+c.charCodeAt(0),h|=0;
  return clamp(base + (Math.abs(h)% (spread*2+1))-spread,45,98);
}
function addExp(n){
  state.exp += n; state.meruPt += Math.round(n/2);
  if(state.lastVisit!==today()){state.streak=(state.streak||0)+1;state.lastVisit=today()}
}
function levelInfo(){
  let lvl=1, remaining=state.exp, need=100;
  while(remaining>=need){remaining-=need;lvl++;need=100+(lvl-1)*50}
  return {lvl,remaining,need};
}
function renderStats(){
  const {lvl,remaining,need}=levelInfo();
  $("#levelNum").textContent=lvl;$("#expText").textContent=`${remaining} / ${need}`;
  $("#expBar").style.width=`${Math.round(remaining/need*100)}%`;
  $("#streak").textContent=state.streak||0;$("#recordCount").textContent=state.records.length;$("#meruPt").textContent=state.meruPt||0;
}
function go(page){
  $$(".page").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  $$(".nav-btn").forEach(x=>x.classList.toggle("active",x.dataset.go===page));
  window.scrollTo({top:0,behavior:"smooth"});
  if(page==="records")renderRecords();
}
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));

$("#modeChips").addEventListener("click",e=>{
  const b=e.target.closest(".chip"); if(!b)return;
  $$("#modeChips .chip").forEach(x=>x.classList.remove("active"));b.classList.add("active");
  state.mode=b.dataset.mode;state.modeIcon=b.dataset.icon;$("#currentModePill").textContent=`${state.modeIcon} ${state.mode}`;save();
});
$("#hoursOut").value=state.hoursOut;$("#todayPriority").value=state.priority;
$("#hoursOut").onchange=e=>{state.hoursOut=e.target.value;save()};$("#todayPriority").onchange=e=>{state.priority=e.target.value;save()};
$("#currentModePill").textContent=`${state.modeIcon} ${state.mode}`;

async function fileToBlob(file,max=1400,quality=.82){
  const img=await createImageBitmap(file);
  const scale=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement("canvas");c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",quality)); img.close?.(); return blob;
}
function showBlob(blob,img){if(!blob)return;img.src=URL.createObjectURL(blob);img.classList.remove("hidden")}
const inputMap={
 makeupPhoto:"makeupPreview",morningPhoto:"morningPreview",eveningPhoto:"eveningPreview",
 skinPhoto:"skinPreview",characterPhoto:"characterPreview",cosplaySelfPhoto:"cosplaySelfPreview"
};
$$(".upload-trigger").forEach(b=>b.addEventListener("click",()=>$("#"+b.dataset.input).click()));
Object.entries(inputMap).forEach(([id,pid])=>{
  $("#"+id).addEventListener("change",async e=>{
    if(!e.target.files[0])return; const blob=await fileToBlob(e.target.files[0]); const key="temp_"+id;
    await putPhoto(key,blob); showBlob(blob,$("#"+pid)); e.target.dataset.photoKey=key;
  });
});

$("#skinGoals").addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return;$("#skinGoals .chip.active")?.classList.remove("active");b.classList.add("active")});

function makeupDemo(){
  const seed=today()+state.mode+$("#selfScore").value+$("#makeupConcern").value;
  const overall=hashScore(seed,84,7);
  const vals={ベース:hashScore(seed+"base",82,10),眉:hashScore(seed+"brow",86,8),アイメイク:hashScore(seed+"eye",87,8),チーク:hashScore(seed+"cheek",81,9),リップ:hashScore(seed+"lip",83,10),全体バランス:overall};
  const concern=$("#makeupConcern").value.trim();
  return {title:`今日のメイク ${overall}点`,score:overall,metrics:vals,
    bullets:[
      `${state.mode}なら、目元・眉・ベースのどこか1つを主役にして他を少し引くとまとまりやすいよ。`,
      state.priority==="崩れにくさ"?"Tゾーンは薄く、頬は保湿を残す「塗り分け」を優先。":"写真で一番見せたいパーツを決めて、そこだけコントラストを少し上げるのがおすすめ。",
      concern?`気にしている「${concern}」は次回の比較ポイントとして記録しておこう。`:"気になるところを1つだけメモすると、次回比較がもっと分かりやすくなるよ。"
    ],
    note:"※現在は端末内デモ分析。AIエンドポイントを設定すると写真＋登録情報を送って実画像分析に切り替えられます。"};
}
function compareDemo(){
  const hrs=+$("#compareHours").value, seed=today()+hrs+$("#collapseMemo").value+$("#touchup").value;
  const penalty=Math.min(16,Math.round(hrs*.9));
  const score=hashScore(seed,86-penalty/2,7);
  return {title:`今日のキープ力 ${score}点`,score,
    metrics:{ベース:hashScore(seed+"base",82-penalty/2,10),アイメイク:hashScore(seed+"eye",88-penalty/3,7),眉:hashScore(seed+"brow",91-penalty/4,6),チーク:hashScore(seed+"cheek",80-penalty/2,9),リップ:hashScore(seed+"lip",74-penalty/2,13)},
    bullets:[
      hrs>=8?"長時間の日は、朝から厚くするより「薄く仕込む＋途中で少量お直し」の方が崩れにくいよ。":"外出時間が短めなら、重ねすぎず薄膜仕上げを優先。",
      "鼻・額が崩れる日は皮脂を一度ティッシュで押さえてから、パウダーを少量だけ。",
      "口周りや頬が乾燥して崩れる日は、次回はその部分のパウダー量を減らして朝の保湿を少し増やす。",
      $("#collapseMemo").value?`今回の自己メモ「${$("#collapseMemo").value.trim()}」を次回の朝メイク改善に反映。`:"帰宅後に『どこが崩れたか』も入力すると、次回アドバイスが具体的になるよ。"
    ],note:"※デモ分析では画像そのものの崩れ判定はしていません。AI連携後は2枚を同時に比較します。"};
}
function skinDemo(){
  const goal=$("#skinGoals .chip.active")?.textContent||"全体を整えたい", feel=$("#skinFeel").value, sleep=$("#sleepHours").value;
  const seed=today()+goal+feel+sleep+$("#skinMemo").value;const score=hashScore(seed,78,8);
  let first=feel.includes("乾燥")?"今日は保湿優先。洗顔後は水分系→乳液/クリームで逃がさないように。":feel.includes("テカ")?"皮脂を取りすぎず、保湿は残しながらTゾーンだけ軽く整えるのがおすすめ。":"今日は刺激を増やさず、普段のルーティンを安定して続けるのが◎。";
  return {title:`今日の肌コンディション ${score}点`,score,
   metrics:{うるおい感:hashScore(seed+"m",78,10),なめらかさ:hashScore(seed+"s",80,8),メイクのり予測:hashScore(seed+"make",79,9),肌バランス:score},
   bullets:[first,`目標「${goal}」は1日単位より、同じ照明・同じ角度で週単位に比べよう。`,sleep.includes("5時間未満")?"睡眠が短い日は新しい攻めケアより、保湿と紫外線対策を優先。":"朝は紫外線対策、夜は落とし残しを避けて保湿を続けるのが基本。"],
   note:"※皮膚疾患や病気の診断は行いません。痛み・強いかゆみ・急な悪化などがある場合は医療機関へ。"};
}
function idealDemo(){
  const n=state.idealImages.length,memo=$("#idealMemo").value.trim();
  return {title:"あなたの理想メイク傾向",score:null,metrics:{登録写真:n+"枚","理想メモ":memo?"登録済み":"未入力"},
    bullets:[n?"写真ごとに「目・眉・肌・チーク・リップ」の好きな要素を分けて考えると、丸ごとコピーより自分に似合わせやすいよ。":"まず2〜3枚登録すると共通点を見つけやすいよ。",
      memo?`希望：「${memo}」を今日のメイク提案に使うね。`:"理想メモに、色・目元・肌質感のどれかを書いてみて。",
      "AI連携後は、理想写真の共通点と自分の顔写真を一緒に見て『そのまま真似する部分／自分向けに変える部分』を分けて提案する。"],note:"※他人の写真は、利用権限やプライバシーに配慮して扱ってください。"};
}
function cosplayDemo(){
  const style=$("#cosplayStyle").value,memo=$("#cosplayMemo").value.trim();
  return {title:`コスプレメイク案｜${style}`,score:null,metrics:{"寄せ方":style,"手持ちコスメ":state.cosmetics.length+"点"},
  bullets:[`まずキャラクターの「眉の角度・目の縦横比・目尻方向・主役カラー」を抽出して、${style}向けに強さを調整。`,
    "自分の骨格そのものを無理に変えるより、眉・アイライン・下まぶた・チーク位置で印象を寄せる。",
    memo?`希望：「${memo}」を優先。`:"キャラ名と、特に寄せたいパーツを書くと精度が上がる。",
    state.cosmetics.length?"手持ちコスメを先に使い、足りない色・質感だけを買い足し候補にする。":"手持ちコスメを登録すると、購入品を最小限にできるよ。"],
  note:"※完成イメージ画像の生成は、この静的版では未接続です。画像生成APIを別途つなぐ構成にできます。"};
}
function renderResult(el,data){
  const metricHtml=Object.entries(data.metrics||{}).map(([k,v])=>`<div class="score-item"><small>${esc(k)}</small><b>${esc(v)}</b>${typeof v==="number"?"<small>/100</small>":""}</div>`).join("");
  el.innerHTML=`<div class="small-label">MERU ANALYSIS</div><h3>${esc(data.title)}</h3>${data.score!=null?`<div class="score-hero"><strong>${data.score}</strong><span>/100</span></div>`:""}<div class="score-grid">${metricHtml}</div><div class="advice-block"><h4>🐾 次にこうしてみて</h4><ul>${data.bullets.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div><p class="notice">${esc(data.note||"")}</p>`;
  el.classList.remove("hidden");el.scrollIntoView({behavior:"smooth",block:"start"});
}
async function analyzeRemote(type){
  if(!state.apiEndpoint)return null;
  const payload={type,context:{mode:state.mode,hoursOut:state.hoursOut,priority:state.priority,cosmetics:state.cosmetics,idealMemo:state.idealMemo},
    inputs:{
      makeupConcern:$("#makeupConcern")?.value||"",skinMemo:$("#skinMemo")?.value||"",skinFeel:$("#skinFeel")?.value||"",
      collapseMemo:$("#collapseMemo")?.value||"",cosplayMemo:$("#cosplayMemo")?.value||"",cosplayStyle:$("#cosplayStyle")?.value||""
    },images:{}};
  const needed={makeup:["makeupPhoto"],compare:["morningPhoto","eveningPhoto"],skin:["skinPhoto"],cosplay:["characterPhoto","cosplaySelfPhoto"],ideal:[]}[type]||[];
  for(const id of needed){
    const key=$("#"+id)?.dataset.photoKey;if(!key)continue;const blob=await getPhoto(key);
    payload.images[id]=await blobToDataURL(blob);
  }
  const r=await fetch(state.apiEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  if(!r.ok)throw new Error("AIエンドポイントからエラーが返りました");return await r.json();
}
function blobToDataURL(blob){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(blob)})}

$$(".analyze-btn").forEach(btn=>btn.addEventListener("click",async()=>{
  const type=btn.dataset.analysis, map={makeup:"makeupResult",compare:"compareResult",skin:"skinResult",ideal:"idealResult",cosplay:"cosplayResult"};
  btn.disabled=true;const old=btn.textContent;btn.textContent="メルが考え中…";
  try{
    let data=await analyzeRemote(type);
    if(!data)data=({makeup:makeupDemo,compare:compareDemo,skin:skinDemo,ideal:idealDemo,cosplay:cosplayDemo}[type])();
    renderResult($("#"+map[type]),data);
    const rec={id:uid("rec"),date:new Date().toISOString(),type,mode:state.mode,title:data.title,score:data.score,note:(data.bullets||[])[0]||""};
    state.records.unshift(rec);addExp(type==="compare"?20:10);save();
    $("#meruAdvice").textContent=`${data.title}を記録したにゃん。次回は同じ条件で比べると変化が分かりやすいよ🐾`;
  }catch(err){alert("分析できませんでした："+err.message)}
  finally{btn.disabled=false;btn.textContent=old}
}));

$("#addCosmetic").onclick=()=>$("#cosmeticDialog").showModal();
$("#saveCosmetic").addEventListener("click",e=>{
  e.preventDefault();
  const name=$("#cName").value.trim();if(!name){alert("商品名を入力してね");return}
  state.cosmetics.push({id:uid("cos"),category:$("#cCategory").value,brand:$("#cBrand").value.trim(),name,color:$("#cColor").value.trim(),memo:$("#cMemo").value.trim()});
  save();$("#cosmeticDialog").close();$("#cosmeticForm").reset();
});
function renderCosmetics(){
  const el=$("#cosmeticList");if(!state.cosmetics.length){el.innerHTML='<div class="empty">まだ登録がありません。手持ちコスメを追加してね💄</div>';return}
  el.innerHTML=state.cosmetics.map(c=>`<div class="list-item"><button class="delete-mini" data-del-cos="${c.id}">削除</button><div class="meta">${esc(c.category)}</div><h3>${esc([c.brand,c.name].filter(Boolean).join(" / "))}</h3><span class="tag">${esc(c.color||"カラー未登録")}</span>${c.memo?`<p class="muted">${esc(c.memo)}</p>`:""}</div>`).join("");
}
$("#cosmeticList").addEventListener("click",e=>{const id=e.target.dataset.delCos;if(!id)return;state.cosmetics=state.cosmetics.filter(x=>x.id!==id);save()});

$("#idealPhoto").addEventListener("change",async e=>{
  const files=[...e.target.files].slice(0,Math.max(0,10-state.idealImages.length));
  for(const f of files){const blob=await fileToBlob(f,1200,.8),key=uid("ideal");await putPhoto(key,blob);state.idealImages.push({key,created:new Date().toISOString()})}
  save();e.target.value="";
});
async function renderIdeal(){
  const el=$("#idealGallery"); if(!el)return; el.innerHTML="";
  for(const item of state.idealImages){
    const blob=await getPhoto(item.key).catch(()=>null);if(!blob)continue;
    const d=document.createElement("div");d.className="gallery-item";const img=document.createElement("img");img.src=URL.createObjectURL(blob);
    const b=document.createElement("button");b.textContent="✕";b.onclick=async()=>{await delPhoto(item.key);state.idealImages=state.idealImages.filter(x=>x.key!==item.key);save()};
    d.append(img,b);el.append(d);
  }
}
$("#idealMemo").value=state.idealMemo||"";$("#idealMemo").addEventListener("input",e=>{state.idealMemo=e.target.value;save()});

function typeLabel(t){return {makeup:"📷 メイク診断",compare:"🌙 崩れ比較",skin:"🫧 肌",ideal:"🎀 理想",cosplay:"🎭 コスプレ"}[t]||t}
function renderRecords(){
  const el=$("#recordList");if(!state.records.length){el.innerHTML='<div class="empty">まだ記録がないよ。今日のメイクか肌を1回診断してみよう🐾</div>';return}
  el.innerHTML=state.records.map(r=>`<div class="list-item"><button class="delete-mini" data-del-rec="${r.id}">削除</button><div class="meta">${esc(new Date(r.date).toLocaleString("ja-JP"))}</div><h3>${typeLabel(r.type)}｜${esc(r.title)}</h3><span class="tag">${esc(r.mode||"")}</span>${r.score!=null?`<span class="tag">${r.score}点</span>`:""}<p class="muted">${esc(r.note||"")}</p></div>`).join("");
}
$("#recordList").addEventListener("click",e=>{const id=e.target.dataset.delRec;if(!id)return;state.records=state.records.filter(x=>x.id!==id);save()});

$("#cosmeticPhoto").addEventListener("change",async e=>{
  let count=0;for(const f of [...e.target.files].slice(0,8)){const blob=await fileToBlob(f,1200,.78);await putPhoto(uid("cosphoto"),blob);count++}
  if(count){addExp(5);save();alert(`${count}枚のコスメ写真を端末内に保存したよ。商品自動認識はAI連携後に使えるようにする想定です。`)}
});

$("#openSettings").onclick=()=>{$("#apiEndpoint").value=state.apiEndpoint||"";$("#settingsDialog").showModal()};
$("#saveSettings").addEventListener("click",()=>{state.apiEndpoint=$("#apiEndpoint").value.trim();save()});

$("#exportBackup").onclick=async()=>{
  const out={version:"1.0",exportedAt:new Date().toISOString(),state};
  if($("#includeImages").checked){
    out.images={};for(const key of await getAllPhotoKeys()){const blob=await getPhoto(key);out.images[key]=await blobToDataURL(blob)}
  }
  const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`meru-makeup-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);
};
$("#importBackup").onchange=async e=>{
  try{
    const data=JSON.parse(await e.target.files[0].text());Object.assign(state,data.state||{});
    if(data.images){for(const [k,v] of Object.entries(data.images)){const blob=await (await fetch(v)).blob();await putPhoto(k,blob)}}
    save();location.reload();
  }catch(err){alert("復元できませんでした："+err.message)}
};
$("#clearAll").onclick=async()=>{
  if(!confirm("写真・コスメ・診断履歴を含む端末内データをすべて削除します。よろしいですか？"))return;
  localStorage.removeItem(KEY);indexedDB.deleteDatabase(DB_NAME);location.reload();
};

(async function init(){
  await openDB();
  const selected=$$("#modeChips .chip").find(b=>b.dataset.mode===state.mode);if(selected){$$("#modeChips .chip").forEach(x=>x.classList.remove("active"));selected.classList.add("active")}
  renderStats();renderCosmetics();renderIdeal();renderRecords();
})();
