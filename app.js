const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));

const KEY="aiplay_v3";

const SUPABASE_URL="https://ikgyozgzhjbdmopsaflp.supabase.co";
const SUPABASE_KEY="sb_publishable_ezliwatqX0wz_-ScmiWzHw_-OhgkCH8";
const sb=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);
let serverReady=false;

function dbItem(row){
  return {
    id:row.id,type:row.media_type==="shorts"?"shorts":row.media_type,title:row.title,author:row.profiles?.display_name||"יוצר",
    authorId:row.user_id,views:Number(row.views_count||0),likes:Number(row.likes_count||0),downloads:Number(row.downloads_count||0),
    status:row.status,time:new Date(row.created_at).toLocaleDateString("he-IL"),description:row.description||"",
    storagePath:row.storage_path,thumbnailPath:row.thumbnail_path,duration:Number(row.duration_seconds||0),short:row.media_type==="shorts"
  };
}
async function loadServerState(){
  if(!sb)return;
  const {data:{session}}=await sb.auth.getSession();
  if(session?.user){
    const {data:p}=await sb.from("profiles").select("*").eq("id",session.user.id).maybeSingle();
    state.user={id:session.user.id,name:p?.display_name||session.user.email?.split("@")[0]||"משתמש",email:session.user.email||""};
    state.rep=Number(p?.reputation||0);
    const {data:rows}=await sb.from("creations").select("*,profiles(display_name)").order("created_at",{ascending:false});
    state.items=(rows||[]).map(dbItem);
    const {data:likes}=await sb.from("creation_likes").select("creation_id").eq("user_id",session.user.id);
    state.liked=(likes||[]).map(x=>x.creation_id);
    const {data:dl}=await sb.from("downloads").select("creation_id").eq("user_id",session.user.id);
    state.downloads=(dl||[]).map(x=>x.creation_id);
    const {data:fol}=await sb.from("follows").select("following_id,profiles!follows_following_id_fkey(display_name)").eq("follower_id",session.user.id);
    state.following=(fol||[]).map(x=>x.following_id);
    state.subscribed=(fol||[]).map(x=>x.profiles?.display_name).filter(Boolean);
    serverReady=true;
  }else{
    const {data:rows}=await sb.from("creations").select("*,profiles(display_name)").eq("status","approved").order("created_at",{ascending:false});
    state.items=(rows||[]).map(dbItem);
    state.user=null;state.rep=0;state.liked=[];state.downloads=[];state.following=[];state.subscribed=[];
    serverReady=true;
  }
  renderUser();renderHome();renderFollowing("today");renderHistory();renderSimple();renderSearch();
}
async function signUpServer(name,email,password){
  const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name:name,username:name.toLowerCase().replace(/[^a-z0-9א-ת]+/g,"_").slice(0,30)||"user"}}});
  if(error)throw error;
  if(data.user && !data.session) toast("נשלח מייל אימות. אשרו את המייל ואז התחברו.");
  else toast("החשבון נוצר בהצלחה");
}
async function signInServer(email,password){
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error)throw error;
  await loadServerState();closeModal("authModal");toast("התחברתם בהצלחה");
}
async function uploadToServer(file,title){
  const session=(await sb.auth.getSession()).data.session;
  if(!session)throw new Error("צריך להתחבר");
  const type=(file.type||"").startsWith("video")?"video":(file.type||"").startsWith("audio")?"audio":"image";
  const id=crypto.randomUUID();
  const path=session.user.id+"/"+id+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const {error:up}=await sb.storage.from("ai-play-media").upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});
  if(up)throw up;
  const {data,error}=await sb.from("creations").insert({id,user_id:session.user.id,title,media_type:type,storage_path:path,status:"pending"}).select("*,profiles(display_name)").single();
  if(error){await sb.storage.from("ai-play-media").remove([path]);throw error;}
  state.items.unshift(dbItem(data));state.rep=Math.max(state.rep,Number(state.rep||0)+1);renderHome();renderUser();
}

let saved=null;
try{saved=JSON.parse(localStorage.getItem(KEY)||"null");}catch(e){try{localStorage.removeItem(KEY);}catch(_){ } saved=null;}
const state=Object.assign({
  user:null,rep:0,items:[],following:[],liked:[],saved:[],history:[],downloads:[],searches:[],subscribed:[],settings:{autoplay:true,dark:true}
},saved||{});

// Normalize state from older app versions so one stale localStorage entry cannot stop the entire UI.
state.items=Array.isArray(state.items)?state.items:[];
state.following=Array.isArray(state.following)?state.following:[];
state.liked=Array.isArray(state.liked)?state.liked:[];
state.saved=Array.isArray(state.saved)?state.saved:[];
state.history=Array.isArray(state.history)?state.history:[];
state.downloads=Array.isArray(state.downloads)?state.downloads:[];
state.searches=Array.isArray(state.searches)?state.searches:[];
state.subscribed=Array.isArray(state.subscribed)?state.subscribed:[];
state.settings=Object.assign({autoplay:true,dark:true},state.settings||{});

let currentView="home";
let currentItem=null;
let playerMedia=null;
let playerTimer=null;
let currentFilter="all";
let searchFilter="all";
let lastTouch=0;

const icons={
 menu:'<svg viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>',
 home:'<svg viewBox="0 0 24 24"><path d="m12 3 9 8h-2v9h-5v-6h-4v6H5v-9H3z"/></svg>',
 search:'<svg viewBox="0 0 24 24"><path d="m10 4a6 6 0 1 0 3.74 10.69l4.79 4.79 1.42-1.42-4.79-4.79A6 6 0 0 0 10 4m0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8"/></svg>',
 mic:'<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3m-5-3a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h-2v-3.08A7 7 0 0 1 5 11z"/></svg>',
 cast:'<svg viewBox="0 0 24 24"><path d="M3 18h3v3H3zm0-5v2a7 7 0 0 1 7 7h2c0-4.97-4.03-9-9-9m0-4v2c6.08 0 11 4.92 11 11h2c0-7.18-5.82-13-13-13M19 3H3v2h16v14h2V5c0-1.1-.9-2-2-2"/></svg>',
 bell:'<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-6 12a2.2 2.2 0 0 0 2-1h-4a2.2 2.2 0 0 0 2 1"/></svg>',
 plus:'<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
 shorts:'<svg viewBox="0 0 24 24"><path d="M9 4h5.2c.65 0 1.25.35 1.58.91L18 9l-3.28.01A4.9 4.9 0 0 1 19 13.7v1.2A5.1 5.1 0 0 1 13.9 20H9.2a3.2 3.2 0 0 1-2.76-1.58L5 15.7h3.1l.9 1.55c.14.24.4.39.67.39h3.66A1.9 1.9 0 0 0 15.2 15.7a1.9 1.9 0 0 0-1.86-1.94H9.1A4.9 4.9 0 0 1 5 8.85V7.2A3.2 3.2 0 0 1 8.2 4z"/></svg>',
 subscriptions:'<svg viewBox="0 0 24 24"><path d="M4 5h16v12H7l-3 3zm2 2v8h12V7zm3 2h2v4H9zm4 0h2v4h-2z"/></svg>',
 user:'<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4m0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5"/></svg>',
 history:'<svg viewBox="0 0 24 24"><path d="M12 5a7 7 0 1 1-6.32 4H3l4-4 4 4H8.05A5 5 0 1 0 12 7z"/><path d="M11 9h2v4l3 2-1 1-4-2.5z"/></svg>',
 playlist:'<svg viewBox="0 0 24 24"><path d="M4 5h16v2H4zm0 6h10v2H4zm0 6h10v2H4zm14-1 4-3-4-3z"/></svg>',
 like:'<svg viewBox="0 0 24 24"><path d="m8 10 3-6h2v5h5.2c1.1 0 1.99.91 1.95 2.01l-.5 7A2 2 0 0 1 17.66 20H8zm-5 0h3v10H3z"/></svg>',
 dislike:'<svg viewBox="0 0 24 24"><path d="m16 14-3 6h-2v-5H5.8a2 2 0 0 1-1.95-2.01l.5-7A2 2 0 0 1 6.34 4H16zm5 0h-3V4h3z"/></svg>',
 download:'<svg viewBox="0 0 24 24"><path d="M11 4h2v8l3-3 1.4 1.4L12 16l-5.4-5.6L8 9l3 3zM5 18h14v2H5z"/></svg>',
 clock:'<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 1-8 8 8 8 0 0 1 8-8m0 2a6 6 0 1 0 6 6 6 6 0 0 0-6-6m-1 1h2v4.6l3.1 1.8-1 1.7-4.1-2.4z"/></svg>',
 spark:'<svg viewBox="0 0 24 24"><path d="m12 2 1.55 6.45L20 10l-6.45 1.55L12 18l-1.55-6.45L4 10l6.45-1.55zM19 16l.8 3.2L23 20l-3.2.8L19 24l-.8-3.2L15 20l3.2-.8z"/></svg>',
 upload:'<svg viewBox="0 0 24 24"><path d="M11 15h2V8l3 3 1.4-1.4L12 4 6.6 9.6 8 11l3-3zm-6 5h14v-2H5z"/></svg>',
 users:'<svg viewBox="0 0 24 24"><path d="M9 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4m6-1a3 3 0 1 0-3-3 3 3 0 0 0 3 3m-6 3c-4 0-7 2-7 4.5V20h14v-2.5C16 15 13 13 9 13m6 1c3.3 0 6 1.5 6 4v2h-4v-2.5c0-1.35-.68-2.55-2-3.5"/></svg>',
 star:'<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.06 6.2L12 17.3 6.44 20.2 7.5 14 3 9.6l6.2-.9z"/></svg>',
 settings:'<svg viewBox="0 0 24 24"><path d="M19.4 13a7.8 7.8 0 0 0 0-2l2-1.56-2-3.46-2.4.96a7.2 7.2 0 0 0-1.7-1l-.36-2.57h-4l-.36 2.57a7.2 7.2 0 0 0-1.7 1l-2.4-.96-2 3.46L6.4 11a7.8 7.8 0 0 0 0 2l-2 1.56 2 3.46 2.4-.96a7.2 7.2 0 0 0 1.7 1l.36 2.57h4l.36-2.57a7.2 7.2 0 0 0 1.7-1l2.4.96 2-3.46zM13 15.5A3.5 3.5 0 1 1 13 8a3.5 3.5 0 0 1 0 7.5"/></svg>',
 video:'<svg viewBox="0 0 24 24"><path d="M4 5h11a2 2 0 0 1 2 2v2l4-2v10l-4-2v2a2 2 0 0 1-2 2H4z"/></svg>',
 save:'<svg viewBox="0 0 24 24"><path d="M6 4h12v17l-6-3-6 3z"/></svg>',
 share:'<svg viewBox="0 0 24 24"><path d="M18 16a3 3 0 0 0-2.24 1l-7.03-3.52A3 3 0 0 0 9 12a3 3 0 0 0-.27-1.48l7.03-3.52A3 3 0 1 0 15 5a3 3 0 0 0 .27 1.48L8.24 10A3 3 0 1 0 8.24 14L15.27 17.52A3 3 0 1 0 18 16"/></svg>',
 remix:'<svg viewBox="0 0 24 24"><path d="M5 5h8v2H7v6H5zm6 12H5v2h8v-2zm8-10h-4l1.4 1.4A6 6 0 0 1 10 17v2a8 8 0 0 0 7.8-10.6L19 10z"/></svg>',
 cut:'<svg viewBox="0 0 24 24"><path d="m9 7 6 6-1.4 1.4-6-6zM5 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2m14 8a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 2a1 1 0 1 0 0 2 1 1 0 0 0-2"/></svg>',
 live:'<svg viewBox="0 0 24 24"><path d="M4 7h10v10H4zm12 3 4-2v8l-4-2zm-9 2.5 2 1.5-2 1.5z"/></svg>',
 post:'<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zm2 3v2h10V7zm0 4v2h10v-2zm0 4v2h6v-2z"/></svg>',
 camera:'<svg viewBox="0 0 24 24"><path d="M4 7h4l1.5-2h5L16 7h4v12H4zm8 2.5A4.5 4.5 0 1 0 12 18a4.5 4.5 0 0 0 0-9.5"/></svg>',
 more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
 down:'<svg viewBox="0 0 24 24"><path d="m6.7 8.3 5.3 5.4 5.3-5.4L19 9.7l-7 7-7-7z"/></svg>',
 prev:'<svg viewBox="0 0 24 24"><path d="M15 6 9 12l6 6V6z"/></svg>',
 next:'<svg viewBox="0 0 24 24"><path d="M9 6v12l6-6z"/></svg>',
 play:'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
 pause:'<svg viewBox="0 0 24 24"><path d="M7 5h3v14H7zm7 0h3v14h-3z"/></svg>',
 fullscreen:'<svg viewBox="0 0 24 24"><path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z"/></svg>',
 close:'<svg viewBox="0 0 24 24"><path d="m6.4 5 6 6 6-6L19.8 6.4l-6 6 6 6-1.4 1.4-6-6-6 6L5 18.4l6-6-6-6z"/></svg>',
 chevron:'<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6-1.4-1.4 4.6-4.6-4.6-4.6z"/></svg>'
};

function mountIcons(){ $$("[data-icon]").forEach(el=>el.innerHTML=icons[el.dataset.icon]||""); }
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function saveState(){localStorage.setItem(KEY,JSON.stringify(state));}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),2300);}
function openModal(id){$("#"+id)?.classList.add("open");}
function closeModal(id){$("#"+id)?.classList.remove("open");}
function ensureAccount(action){if(state.user)return true;switchAuth("signup");openModal("authModal");toast("כדי "+action+" צריך לפתוח חשבון");return false;}
function currentLevel(){return state.rep>=2500?5:state.rep>=1000?4:state.rep>=500?3:state.rep>=100?2:1;}
function initials(name){return (name||"א").trim().charAt(0)||"א";}
function mediaKind(x){return x.type==="shorts"?"shorts":x.type==="video"||x.type==="image"||x.type==="audio"?x.type:"video";}
function durationText(sec){if(!Number.isFinite(sec)||sec<=0)return "";sec=Math.round(sec);return Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0");}
function formatViews(n){n=Number(n)||0;return n>999999?(n/1e6).toFixed(1)+"M":n>999?(n/1e3).toFixed(1)+"K":String(n);}
function relativeTime(x){return x.time||"עכשיו";}

function renderUser(){
  const u=state.user, name=u?.name||"אורח";
  $("#accountAvatar").textContent=initials(name);$("#accountName").textContent=name;$("#accountRep").textContent=(state.rep||0)+" ✦";
  $("#profileAvatar").textContent=initials(name);$("#profileName").textContent=name;$("#profileHandle").textContent=u?"@"+name.toLowerCase().replace(/\s+/g,""):"@guest";
  $("#profileRep").textContent=state.rep||0;
  $("#repValue").textContent=state.rep||0;$("#repLevel").textContent=currentLevel();$("#myCount").textContent=state.items.filter(x=>x.author===u?.name).length;
  const lv=currentLevel(), target=lv===1?100:lv===2?500:lv===3?1000:lv===4?2500:5000, prev=lv===1?0:lv===2?100:lv===3?500:lv===4?1000:2500;
  $("#repTarget").textContent="יעד: "+target+" ✦";$("#repGoal").textContent=u?(state.rep>=target?"הגעתם ליעד":"עוד "+(target-state.rep)+" ✦ ליעד"):"פתחו חשבון כדי להתחיל";
  $("#repProgress").style.width=(Math.max(0,Math.min(100,(state.rep-prev)/(target-prev)*100)))+"%";
}

function actualItems(){return Array.isArray(state.items)?state.items:[];}
function itemMatches(x,filter,q){
  const text=((x.title||"")+" "+(x.author||"")).toLowerCase(), term=(q||"").toLowerCase();
  if(term&&!text.includes(term))return false;
  if(filter==="all")return true;
  if(filter==="new")return true;
  if(filter==="video")return x.type==="video";
  if(filter==="image")return x.type==="image";
  if(filter==="audio")return x.type==="audio";
  if(filter==="shorts")return x.type==="shorts";
  if(filter==="live")return x.status==="live";
  if(filter==="unwatched")return !state.history.includes(x.id);
  if(filter==="long")return Number(x.duration)>300;
  return true;
}
function filteredItems(filter="all",q=""){let arr=actualItems().filter(x=>itemMatches(x,filter,q));if(filter==="new")arr=arr.slice().reverse();return arr;}

function mediaMarkup(x,cls=""){
  if(x.dataUrl&&x.type==="image")return '<img class="'+cls+' thumb-media" src="'+esc(x.dataUrl)+'" alt="">';
  if(x.dataUrl&&(x.type==="video"||x.type==="shorts"))return '<video class="'+cls+' thumb-media" src="'+esc(x.dataUrl)+'" muted playsinline preload="metadata"></video>';
  return "";
}
function card(x,recommend=false){
  const isShort=x.type==="shorts", kind=isShort?"Short":x.type==="image"?"תמונה":x.type==="audio"?"אודיו":"וידאו";
  const dur=durationText(x.duration);
  return '<article class="'+(recommend?"recommendation-card":"content-card")+'" data-id="'+esc(x.id)+'" data-type="'+esc(x.type)+'">'+
    (recommend?'<div class="recommendation-thumb">'+mediaMarkup(x)+"</div>":'<div class="thumb '+esc(x.thumb||"")+'">'+mediaMarkup(x)+(dur?'<span class="duration">'+dur+"</span>":"")+(x.status==="live"?'<span class="live-badge">LIVE</span>':"")+'<button class="card-more" data-menu="'+esc(x.id)+'" aria-label="עוד"><span data-icon="more"></span></button></div>')+
    (recommend?'<div class="recommendation-copy"><h3>'+esc(x.title||"ללא שם")+'</h3><small>'+esc(x.author||"יוצר")+" · "+formatViews(x.views)+" צפיות</small></div>":
    '<div class="card-body"><div class="card-avatar">'+esc(initials(x.author))+'</div><div><h3 class="card-title">'+esc(x.title||"ללא שם")+'</h3><div class="card-meta"><span>'+esc(x.author||"יוצר")+'</span><span>'+formatViews(x.views)+" צפיות · "+esc(relativeTime(x))+" · "+kind+"</span></div><div class="card-actions"><button class="tiny-action" data-open="'+esc(x.id)+'">'+(isShort?"צפייה":"פתיחה")+'</button><button class="tiny-action" data-save="'+esc(x.id)+'">'+(state.saved.includes(x.id)?"נשמר":"שמור")+"</button></div></div></div>")+
    "</article>";
}
function bindDynamic(){
  $$("[data-open]").forEach(b=>b.onclick=()=>openWatch(b.dataset.open));
  $$("[data-save]").forEach(b=>b.onclick=e=>{e.stopPropagation();toggleSaved(b.dataset.save);});
  $$("[data-menu]").forEach(b=>b.onclick=e=>{e.stopPropagation();openCardMenu(b.dataset.menu);});
  $$(".content-card").forEach(c=>c.onclick=e=>{if(!e.target.closest("button"))openWatch(c.dataset.id);});
  $$(".recommendation-card").forEach(c=>c.onclick=()=>openWatch(c.dataset.id));
  $$("[data-view-target]").forEach(b=>b.onclick=()=>switchView(b.dataset.viewTarget));
}
function openCardMenu(id){
  const x=actualItems().find(i=>i.id===id); if(!x)return;
  const savedHere=state.saved.includes(id);
  const action=confirm("אפשרויות ליצירה:\nאישור = "+(savedHere?"הסר מרשימה":"שמור לרשימה")+"\nביטול = שיתוף");
  if(action)toggleSaved(id);else shareItem(x);
}
function renderHome(){
  const arr=filteredItems(currentFilter);
  $("#homeGrid").innerHTML=arr.length?arr.map(card).join(""):'<div class="empty-state"><span data-icon="spark"></span><b>אין עדיין תוכן להצגה</b><small>כאן יוצגו רק יצירות אמיתיות שהועלו לחשבון או הגיעו מהשרת.</small></div>';
  const shorts=actualItems().filter(x=>x.type==="shorts");
  $("#shortsShelf").classList.toggle("hidden",shorts.length===0);
  $("#homeShortsRow").innerHTML=shorts.slice(0,6).map(x=>'<div class="short-card" data-open-short="'+esc(x.id)+'"><div class="short-thumb">'+mediaMarkup(x)+"</div><div class="short-title">"+esc(x.title||"Short")+"</div></div>").join("");
  $$("[data-open-short]").forEach(b=>b.onclick=()=>openShorts(b.dataset.openShort));
  bindDynamic();mountIcons();
}
function renderFollowing(filter="today"){
  const followed=new Set(state.following);
  const arr=actualItems().filter(x=>followed.has(x.author)&&itemMatches(x,filter));
  $("#channelScroller").innerHTML=state.following.length?state.following.map(name=>'<div class="channel-bubble new"><div class="channel-avatar">'+esc(initials(name))+'</div><small>'+esc(name)+'</small></div>').join(""):'<div class="empty-state" style="min-height:150px;width:100%"><b>אין עדיין מינויים</b><small>כשתעקבו אחרי יוצר, הערוץ יופיע כאן.</small></div>';
  $("#followingGrid").innerHTML=arr.length?arr.map(card).join(""):'<div class="empty-state"><span data-icon="subscriptions"></span><b>אין תוכן במינויים</b><small>לא יוצגו כאן יוצרים או סרטונים מומצאים.</small></div>';
  bindDynamic();mountIcons();
}
function renderHistory(){
  const arr=state.history.map(id=>actualItems().find(x=>x.id===id)).filter(Boolean);
  $("#historyRow").innerHTML=arr.slice(0,5).map(x=>'<div class="mini-card" data-open="'+esc(x.id)+'"><div class="mini-thumb">'+mediaMarkup(x)+"</div><b>"+esc(x.title||"ללא שם")+"</b></div>").join("")||'<div class="empty-state" style="min-height:140px;grid-column:1/-1"><b>ההיסטוריה ריקה</b><small>כשתפתחו יצירות, הן יופיעו כאן.</small></div>';
  $("#historyGrid").innerHTML=arr.length?arr.map(card).join(""):'<div class="empty-state"><b>אין היסטוריה עדיין</b><small>פתחו יצירה כדי להוסיף אותה להיסטוריה.</small></div>';
  $$("[data-open]").forEach(b=>b.onclick=()=>openWatch(b.dataset.open));bindDynamic();mountIcons();
}
function renderSimple(){
  const maps={liked:"likedGrid",downloads:"downloadsGrid",watchlater:"watchlaterGrid"};
  Object.entries(maps).forEach(([type,id])=>{
    const source=type==="liked"?state.liked:type==="downloads"?state.downloads:state.saved;
    const arr=source.map(x=>actualItems().find(i=>i.id===x)).filter(Boolean);
    $("#"+id).innerHTML=arr.length?arr.map(card).join(""):'<div class="empty-state"><span data-icon="spark"></span><b>אין עדיין פריטים</b><small>הפעולות שתבצעו יופיעו כאן.</small></div>';
  });
  bindDynamic();mountIcons();
  $("#playlistEmpty").innerHTML='<span data-icon="playlist"></span><b>אין עדיין רשימות הפעלה</b><small>אפשרויות רשימות ייפתחו עם חיבור החשבון לשרת.</small>';mountIcons();
}
function renderSearch(q=""){
  const arr=filteredItems(searchFilter,q);
  const recent=state.searches.slice(0,6);
  $("#searchHistory").innerHTML=recent.map(s=>'<button class="suggestion" data-search="'+esc(s)+'">'+esc(s)+"</button>").join("");
  $$(".suggestion").forEach(b=>b.onclick=()=>{$("#searchInput").value=b.dataset.search;renderSearch(b.dataset.search)});
  $("#searchGrid").innerHTML=arr.length?arr.map(card).join(""):'<div class="empty-state"><span data-icon="search"></span><b>לא נמצאו יצירות</b><small>החיפוש עובד רק מול התוכן הקיים בפלטפורמה כרגע.</small></div>';
  bindDynamic();mountIcons();
}

function switchView(name){
  currentView=name;
  $$(".view").forEach(v=>v.classList.toggle("active",v.dataset.page===name));
  $$(".nav-item[data-view],.mobile-bottom [data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  if(name==="home")renderHome();
  if(name==="following")renderFollowing("today");
  if(name==="profile"){renderUser();renderHistory();}
  if(["history","playlists","liked","downloads","watchlater"].includes(name))renderSimple();
  if(name==="search")renderSearch($("#searchInput").value||"");
  if(name==="studio")renderUser();
  if(name==="reputation")renderUser();
  if(name==="shorts")renderShorts();
  if(window.innerWidth<701)$("#sidebar")?.classList.remove("open");
  $("#main").scrollTop=0;
}

function switchAuth(mode){
  $$(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.auth===mode));
  $$(".signup-field").forEach(x=>x.classList.toggle("hidden",mode!=="signup"));
  $("#authTitle").textContent=mode==="signup"?"פותחים חשבון":"ברוכים הבאים";
  $("#authSub").textContent=mode==="signup"?"יוצרים, משתפים ובונים מוניטין.":"כניסה לחשבון המקומי.";
  $("#authSubmit").textContent=mode==="signup"?"פתיחת חשבון":"כניסה";
}

function openWatch(id){
  const x=actualItems().find(i=>i.id===id);if(!x)return;
  currentItem=x;
  if(!state.history.includes(id))state.history.unshift(id);
  state.history=state.history.slice(0,80);saveState();
  $("#watchTitle").textContent=x.title||"יצירה";
  $("#watchAuthor").textContent=x.author||"יוצר";
  $("#watchAvatar").textContent=initials(x.author);
  $("#watchSubscribers").textContent=((x.subscribers||0)+" מנויים");
  $("#watchLikeCount").textContent=formatViews(x.likes||0);
  $("#watchDescription").textContent=x.description||"תיאור היצירה יופיע כאן. צפיות: "+formatViews(x.views)+" · סטטוס: "+(x.status||"טיוטה");
  $("#watchDescription").classList.add("collapsed");$("#watchTitleToggle").classList.remove("open");
  $("#subscribeBtn").classList.toggle("subscribed",state.subscribed.includes(x.author));$("#subscribeBtn").textContent=state.subscribed.includes(x.author)?"רשום":"הירשם";
  mountPlayer(x);renderRecommendations();switchView("watch");switchView("watch");
}
function mountPlayer(x){
  clearInterval(playerTimer);const box=$("#playerMedia");box.innerHTML="";playerMedia=null;
  if(x.dataUrl&&(x.type==="video"||x.type==="shorts")){
    playerMedia=document.createElement("video");playerMedia.src=x.dataUrl;playerMedia.playsInline=true;playerMedia.preload="metadata";box.append(playerMedia);
    playerMedia.onloadedmetadata=()=>{x.duration=playerMedia.duration;$("#totalTime").textContent=durationText(playerMedia.duration);saveState();renderHome();};
    playerMedia.ontimeupdate=updateProgress;playerMedia.onprogress=updateBuffer;playerMedia.onended=()=>{$("#togglePlay").innerHTML=icons.play;maybeAutoplay();};
  }else if(x.dataUrl&&x.type==="image"){
    const img=document.createElement("img");img.src=x.dataUrl;box.append(img);$("#totalTime").textContent="";$("#currentTime").textContent="0:00";
  }else{
    box.innerHTML='<div class="player-placeholder"><strong>'+esc(x.title||"יצירה")+'</strong><span>אין קובץ מדיה מחובר עדיין.</span></div>';$("#totalTime").textContent="";
  }
  $("#togglePlay").innerHTML=icons.play;$("#bufferBar").style.width="0";$("#progressBar").style.width="0";$("#progressHandle").style.display="none";mountIcons();
}
function updateProgress(){
  if(!playerMedia?.duration)return;
  const p=playerMedia.currentTime/playerMedia.duration*100;
  $("#progressBar").style.width=p+"%";$("#progressHandle").style.right=(100-p)+"%";$("#currentTime").textContent=durationText(playerMedia.currentTime);
}
function updateBuffer(){
  if(!playerMedia?.duration||!playerMedia.buffered.length)return;
  const end=playerMedia.buffered.end(playerMedia.buffered.length-1);$("#bufferBar").style.width=(end/playerMedia.duration*100)+"%";
}
function togglePlayer(){
  if(!playerMedia){toast("אין קובץ מדיה זמין לניגון");return}
  if(playerMedia.paused){playerMedia.play().catch(()=>{});$("#togglePlay").innerHTML=icons.pause}else{playerMedia.pause();$("#togglePlay").innerHTML=icons.play}
}
function seekBy(sec){if(playerMedia?.duration){playerMedia.currentTime=Math.max(0,Math.min(playerMedia.duration,playerMedia.currentTime+sec));updateProgress();toast((sec>0?"+":"")+sec+" שניות");}}
function maybeAutoplay(){
  if($("#autoplay").checked){const arr=filteredItems("all");const ix=arr.findIndex(x=>x.id===currentItem?.id);if(ix>=0&&arr[ix+1])openWatch(arr[ix+1].id);}
}
function renderRecommendations(){
  const arr=actualItems().filter(x=>x.id!==currentItem?.id).slice(0,10);
  $("#recommendGrid").innerHTML=arr.length?arr.map(x=>card(x,true)).join(""):'<div class="empty-state" style="min-height:180px"><b>אין המלצות עדיין</b><small>התוכן יופיע כאן לאחר שיעלו יצירות.</small></div>';
  bindDynamic();mountIcons();
}
function openShorts(id=null){
  switchView("shorts");renderShorts(id);
}
function renderShorts(startId=null){
  const arr=actualItems().filter(x=>x.type==="shorts"||x.short===true);
  if(!arr.length){$("#shortsStage").innerHTML='<div class="short-empty"><b>אין עדיין Shorts</b><span>העלו יצירה מסוג Short כדי להתחיל.</span></div>';return;}
  let idx=startId?Math.max(0,arr.findIndex(x=>x.id===startId)):0;if(idx<0)idx=0;
  const x=arr[idx];$("#shortsStage").innerHTML='<div class="short-active" data-short-index="'+idx+'">'+(x.dataUrl?'<video id="shortVideo" src="'+esc(x.dataUrl)+'" playsinline loop autoplay></video>':'<div class="short-empty"><b>'+esc(x.title)+'</b><span>אין קובץ מדיה זמין.</span></div>')+'<div class="short-gradient"></div><div class="short-side"><button data-short-action="like">'+icons.like+'<small>'+formatViews(x.likes||0)+'</small></button><button data-short-action="dislike">'+icons.dislike+'<small>לא</small></button><button data-short-action="comment">'+icons.post+'<small>תגובות</small></button><button data-short-action="share">'+icons.share+'<small>שתף</small></button><button data-short-action="remix">'+icons.remix+'<small>רימיקס</small></button></div><div class="short-bottom"><div class="short-channel"><div class="channel-avatar">'+esc(initials(x.author))+'</div><b>'+esc(x.author||"יוצר")+'</b><button class="short-follow" data-follow-author="'+esc(x.author||"יוצר")+'">'+(state.subscribed.includes(x.author)?"רשום":"הירשם")+'</button></div><p>'+esc(x.title||"Short")+'</p><span class="short-song">♫ יצירה מקורית</span></div></div>';
  $("[data-short-action=share]")?.addEventListener("click",()=>shareItem(x));
  $("[data-short-action=like]")?.addEventListener("click",()=>toggleLiked(x.id));
  $("[data-follow-author]")?.addEventListener("click",e=>toggleSubscription(e.currentTarget.dataset.followAuthor));
}
function toggleSaved(id){if(!ensureAccount("לשמור"))return;const i=state.saved.indexOf(id);if(i>=0){state.saved.splice(i,1);toast("הוסר מצפה מאוחר יותר")}else{state.saved.unshift(id);toast("נשמר לצפייה מאוחרת יותר")}saveState();refreshCurrent();}
function toggleLiked(id){if(!ensureAccount("לסמן לייק"))return;const i=state.liked.indexOf(id);if(i>=0){state.liked.splice(i,1);toast("הלייק הוסר")}else{state.liked.unshift(id);toast("סומן לייק");state.rep+=1}saveState();refreshCurrent();}
function toggleSubscription(author){if(!ensureAccount("להירשם"))return;const i=state.subscribed.indexOf(author);if(i>=0){state.subscribed.splice(i,1);toast("ביטלת את ההרשמה")}else{state.subscribed.push(author);state.following.push(author);state.following=[...new Set(state.following)];toast("נרשמת לערוץ")}saveState();$("#subscribeBtn").classList.toggle("subscribed",state.subscribed.includes(currentItem?.author));$("#subscribeBtn").textContent=state.subscribed.includes(currentItem?.author)?"רשום":"הירשם";}
async function shareItem(x){
  const shareData={title:x.title||"AI פליי",text:"שיתוף יצירה ב-AI פליי",url:location.href};
  try{if(navigator.share)await navigator.share(shareData);else{await navigator.clipboard?.writeText(location.href);toast("הקישור הועתק");}}catch(e){if(e.name!=="AbortError")toast("לא ניתן לשתף מהמכשיר הזה");}
}
function refreshCurrent(){
  renderUser();
  if(currentView==="home")renderHome();
  if(currentView==="following")renderFollowing("today");
  if(["history","liked","downloads","watchlater","playlists"].includes(currentView))renderSimple();
  if(currentView==="profile")renderHistory();
}
function doDownload(x){
  if(!x.dataUrl){toast("אין קובץ זמין להורדה");return}
  const a=document.createElement("a");a.href=x.dataUrl;a.download=(x.title||"ai-play").replace(/[\\/:*?"<>|]/g,"_");document.body.append(a);a.click();a.remove();
  if(!state.downloads.includes(x.id))state.downloads.unshift(x.id);x.downloads=(x.downloads||0)+1;state.rep+=1;saveState();toast("ההורדה התחילה");
}
function on(sel,event,fn,opts){const el=$(sel);if(el)el.addEventListener(event,fn,opts);return el;}
function onEach(sel,event,fn,opts){$(sel).forEach(el=>el.addEventListener(event,fn,opts));}

function installGlobalButtonGuard(){
  if(window.__aiPlayGlobalButtons)return;
  window.__aiPlayGlobalButtons=true;
  document.addEventListener("click",e=>{
    const b=e.target.closest("button");
    if(!b)return;
    if(b.matches("[data-close]"))return;
    if(b.matches(".nav-item[data-view],.mobile-bottom [data-view]"))return;
    if(b.matches("[data-view-target]"))return;
    if(b.matches("[data-open],[data-save],[data-menu]"))return;
    if(b.closest("#watchActions")||b.matches("#subscribeBtn"))return;
    if(b.matches(".tabs button,.media-tabs button,.create-options [data-create]"))return;
    if(b.id==="menuBtn"||b.id==="createTop"||b.id==="mobileCreate"||b.id==="uploadSide"||b.id==="accountBtn"||b.id==="notificationsBtn"||b.id==="castBtn"||b.id==="topMic"||b.id==="shortsSearch"||b.id==="shortsCamera"||b.id==="shortsMenu"||b.id==="searchFiltersBtn"||b.id==="watchTitleToggle"||b.id==="togglePlay"||b.id==="prevMedia"||b.id==="nextMedia"||b.id==="fullscreenBtn"||b.id==="playerSettings"||b.id==="playerCast"||b.id==="captionBtn"||b.id==="minimizePlayer"||b.id==="subBell"||b.id==="incognitoBtn"||b.id==="switchAccount"||b.id==="profileCast"||b.id==="profileSearch"||b.id==="profileSettings"||b.id==="authSubmit"||b.id==="createWork"||b.id==="uploadSubmit"||b.id==="resetLocal"||b.id==="allSubscriptions"||b.id==="commentsPreview"||b.id==="premiumCard"||b.id==="miniPlay"||b.id==="miniClose"||b.id==="searchMic")return;
  },true);
}

function setupEvents(){
  onEach("[data-close]","click",e=>closeModal(e.currentTarget.dataset.close));
  onEach(".modal","click",e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove("open");});
  onEach(".nav-item[data-view],.mobile-bottom [data-view]","click",e=>switchView(e.currentTarget.dataset.view));
  onEach("[data-view-target]","click",e=>switchView(e.currentTarget.dataset.viewTarget));

  on("#menuBtn","click",()=>$("#sidebar")?.classList.toggle("open"));
  on("#createTop","click",()=>openModal("createModal"));
  on("#mobileCreate","click",()=>openModal("createModal"));
  on("#uploadSide","click",()=>{if(ensureAccount("להעלות"))openModal("uploadModal");});
  on("#accountBtn","click",()=>{if(state.user)switchView("profile");else{switchAuth("login");openModal("authModal");}});
  on("#notificationsBtn","click",()=>toast("אין התראות חדשות"));
  on("#castBtn","click",()=>toast("שידור למסך תלוי בתמיכת הדפדפן והמכשיר"));
  on("#topMic","click",()=>toast("חיפוש קולי זמין רק בדפדפנים שתומכים בזיהוי קול"));
  on("#shortsSearch","click",()=>switchView("search"));
  on("#shortsCamera","click",()=>{if(ensureAccount("ליצור"))openModal("uploadModal");});
  on("#shortsMenu","click",()=>toast("אפשרויות Shorts יופיעו לפי היצירה שנבחרה"));

  on("#searchInput","input",e=>renderSearch(e.currentTarget.value));
  on("#searchFiltersBtn","click",()=>openModal("searchFiltersModal"));
  onEach("#searchFiltersModal [data-filter]","click",e=>{
    searchFilter=e.currentTarget.dataset.filter;
    closeModal("searchFiltersModal");
    renderSearch($("#searchInput")?.value||"");
  });
  onEach("#homeChips .chip","click",e=>{
    onEach("#homeChips .chip","noop",()=>{});
    $("#homeChips .chip").forEach(x=>x.classList.remove("active"));
    e.currentTarget.classList.add("active");
    currentFilter=e.currentTarget.dataset.filter;
    renderHome();
  });
  onEach("#followingChips .chip","click",e=>{
    $("#followingChips .chip").forEach(x=>x.classList.remove("active"));
    e.currentTarget.classList.add("active");
    renderFollowing(e.currentTarget.dataset.filter);
  });

  on("#topSearchForm","submit",e=>{
    e.preventDefault();
    const q=$("#topSearch")?.value.trim()||"";
    if(q)state.searches.unshift(q);
    state.searches=[...new Set(state.searches)].slice(0,20);
    saveState();
    $("#searchInput")&&( $("#searchInput").value=q );
    renderSearch(q);
    switchView("search");
  });

  on("#searchForm","submit",e=>{
    e.preventDefault();
    const q=$("#searchInput")?.value.trim()||"";
    if(q)state.searches.unshift(q);
    state.searches=[...new Set(state.searches)].slice(0,20);
    saveState();
    renderSearch(q);
  });

  on("#watchTitleToggle","click",()=>{
    $("#watchDescription")?.classList.toggle("collapsed");
    $("#watchTitleToggle")?.classList.toggle("open");
  });
  on("#togglePlay","click",togglePlayer);
  on("#prevMedia","click",()=>{
    const arr=filteredItems("all"),i=arr.findIndex(x=>x.id===currentItem?.id);
    if(i>0)openWatch(arr[i-1].id);
  });
  on("#nextMedia","click",()=>{
    const arr=filteredItems("all"),i=arr.findIndex(x=>x.id===currentItem?.id);
    if(i>=0&&arr[i+1])openWatch(arr[i+1].id);
  });
  on("#fullscreenBtn","click",()=>$("#playerShell")?.requestFullscreen?.().catch?.(()=>{}));
  on("#progressTrack","click",e=>{
    if(!playerMedia?.duration)return;
    const r=e.currentTarget.getBoundingClientRect();
    const p=1-((e.clientX-r.left)/r.width);
    playerMedia.currentTime=Math.max(0,Math.min(playerMedia.duration,p*playerMedia.duration));
    updateProgress();
  });
  on("#playerSettings","click",()=>openModal("settingsModal"));
  on("#playerCast","click",()=>toast("שידור למסך תלוי בתמיכת הדפדפן והמכשיר"));
  on("#captionBtn","click",()=>toast("אין כתוביות זמינות ביצירה זו"));
  on("#minimizePlayer","click",minimizePlayer);
  on("#subscribeBtn","click",()=>toggleSubscription(currentItem?.author));
  on("#subBell","click",()=>toast("התראות הערוץ הופעלו"));
  onEach("#watchActions [data-action]","click",e=>{
    if(!currentItem)return;
    const a=e.currentTarget.dataset.action;
    if(a==="like")toggleLiked(currentItem.id);
    else if(a==="share")shareItem(currentItem);
    else if(a==="save")toggleSaved(currentItem.id);
    else if(a==="download")doDownload(currentItem);
    else if(a==="dislike")toast("סומן לא אהבתי");
    else if(a==="remix")toast("רימיקס יהיה זמין לאחר חיבור כלי היצירה");
    else if(a==="clip")toast("קליפ יהיה זמין לאחר חיבור שרת המדיה");
  });

  on("#incognitoBtn","click",()=>toast("מצב גלישה בסתר מוכן לממשק; נתוני החשבון לא יוצגו בו"));
  on("#switchAccount","click",async()=>{
    try{if(sb)await sb.auth.signOut();}catch(e){console.error(e);}
    state.user=null;state.items=[];state.rep=0;state.liked=[];state.downloads=[];state.following=[];state.subscribed=[];
    saveState();renderUser();switchAuth("login");openModal("authModal");
  });
  on("#profileCast","click",()=>toast("שידור למסך תלוי בתמיכת הדפדפן והמכשיר"));
  on("#profileSearch","click",()=>switchView("search"));
  on("#profileSettings","click",()=>openModal("settingsModal"));

  onEach(".tabs button","click",e=>switchAuth(e.currentTarget.dataset.auth));
  on("#authSubmit","click",async()=>{
    const signup=$(".tabs button.active")?.dataset.auth==="signup";
    const name=$("#authName")?.value.trim()||"";
    const email=$("#authEmail")?.value.trim()||"";
    const pass=$("#authPass")?.value||"";
    const terms=$("#termsOk")?.checked||false;
    if(!email.includes("@")||pass.length<6||(signup&&(!name||!terms))){
      toast("בדקו את הפרטים: סיסמה צריכה להכיל לפחות 6 תווים");
      return;
    }
    if(!sb){toast("שירות הנתונים אינו זמין כרגע");return;}
    const btn=$("#authSubmit");
    if(btn)btn.disabled=true;
    try{
      if(signup){
        await signUpServer(name,email,pass);
        if((await sb.auth.getSession()).data.session){
          await loadServerState();
          closeModal("authModal");
        }
      }else{
        await signInServer(email,pass);
      }
    }catch(e){
      console.error(e);
      toast("שגיאה: "+(e?.message||"לא ניתן להתחבר"));
    }finally{
      if(btn)btn.disabled=false;
    }
  });

  onEach(".create-options [data-create]","click",e=>{
    const type=e.currentTarget.dataset.create;
    closeModal("createModal");
    if(type==="video"){
      if(ensureAccount("להעלות"))openModal("uploadModal");
    }else if(type==="short"){
      if(ensureAccount("ליצור")){
        openModal("studioModal");
        $(".media-tabs button[data-studio-type=\"shorts\"]")?.click();
        $("#prompt")?.focus();
      }
    }else if(type==="post"){
      toast("פוסט יתווסף בחיבור השרת");
    }else{
      toast("שידור חי יתווסף בחיבור השרת");
    }
  });

  onEach(".media-tabs button","click",e=>{
    $(".media-tabs button").forEach(x=>x.classList.remove("active"));
    e.currentTarget.classList.add("active");
  });

  on("#createWork","click",()=>{
    if(!ensureAccount("ליצור"))return;
    const p=$("#prompt")?.value.trim()||"";
    if(!p){toast("כתבו הנחיה");return}
    const type=$(".media-tabs button.active")?.dataset.studioType||"video";
    state.items.unshift({id:"c"+Date.now(),type,title:p.slice(0,70),author:state.user.name,views:0,likes:0,status:"draft",time:"עכשיו",description:p,thumb:"local",short:type==="shorts"});
    state.rep+=2;saveState();closeModal("studioModal");$("#prompt")&&( $("#prompt").value="" );renderHome();renderUser();toast("הטיוטה נשמרה");
  });

  on("#file","change",e=>{
    const f=e.currentTarget.files?.[0];
    if(f&&$("#fileName"))$("#fileName").textContent=f.name;
  });
  on("#uploadSubmit","click",async()=>{
    if(!ensureAccount("להעלות"))return;
    const f=$("#file")?.files?.[0],title=$("#uploadTitle")?.value.trim()||"";
    if(!f||!title){toast("בחרו קובץ ושם");return}
    if(f.size>500*1024*1024){toast("הקובץ גדול מדי (מקסימום 500MB)");return}
    if(!serverReady)await loadServerState();
    const btn=$("#uploadSubmit");
    if(btn)btn.disabled=true;
    try{
      await uploadToServer(f,title);
      closeModal("uploadModal");
      if($("#file"))$("#file").value="";
      if($("#uploadTitle"))$("#uploadTitle").value="";
      if($("#fileName"))$("#fileName").textContent="עד 500MB";
      toast("הקובץ הועלה ונשלח לבדיקה");
    }catch(e){
      console.error(e);
      toast("שגיאה בהעלאה: "+(e?.message||"לא ניתן להעלות"));
    }finally{
      if(btn)btn.disabled=false;
    }
  });

  on("#settingAutoplay","change",e=>{
    const v=e.currentTarget.checked;
    if($("#autoplay"))$("#autoplay").checked=v;
    state.settings.autoplay=v;saveState();toast("העדפת הניגון נשמרה");
  });
  on("#settingDark","change",e=>{
    state.settings.dark=e.currentTarget.checked;
    document.body.classList.toggle("light",!e.currentTarget.checked);
    saveState();
  });
  on("#resetLocal","click",async()=>{
    if(!confirm("לצאת מהחשבון ולנקות את הנתונים המקומיים?"))return;
    try{if(sb)await sb.auth.signOut();}catch(e){console.error(e);}
    localStorage.removeItem(KEY);location.reload();
  });
  on("#allSubscriptions","click",()=>toast(state.following.length?state.following.join(" · "):"אין עדיין מינויים"));
  on("#commentsPreview","click",()=>toast("פאנל תגובות מלא ייפתח לאחר חיבור שירות תגובות"));
  on("#premiumCard","click",()=>toast("Premium יופעל בחיבור המנוי לשרת"));
  on("#miniPlay","click",togglePlayer);
  on("#miniClose","click",()=>$("#miniPlayer")?.classList.add("hidden"));
  on("#autoplay","change",e=>{
    state.settings.autoplay=e.currentTarget.checked;
    if($("#settingAutoplay"))$("#settingAutoplay").checked=e.currentTarget.checked;
    saveState();
  });

  let sx=0;
  on("#playerShell","touchstart",e=>{sx=e.touches[0]?.clientX||0;lastTouch=Date.now()},{passive:true});
  on("#playerShell","touchend",e=>{
    const dx=(e.changedTouches[0]?.clientX||0)-sx;
    if(Math.abs(dx)>130)dx>0?seekBy(-10):seekBy(10);
  });
  on("#playerShell","dblclick",e=>{
    const r=e.currentTarget.getBoundingClientRect();
    seekBy((e.clientX-r.left)<r.width/2?-10:10);
  });
  let py=0;
  on("#playerShell","pointerdown",e=>{py=e.clientY;});
  on("#playerShell","pointerup",e=>{if(e.clientY-py>100)minimizePlayer();});
}

function minimizePlayer(){
  if(!currentItem)return;
  $("#miniTitle").textContent=currentItem.title||"יצירה";$("#miniAuthor").textContent=currentItem.author||"יוצר";$("#miniPlayer").classList.remove("hidden");
  switchView("home");
}
function applySettings(){
  state.settings=Object.assign({autoplay:true,dark:true},state.settings||{});
  $("#autoplay").checked=state.settings.autoplay;$("#settingAutoplay").checked=state.settings.autoplay;$("#settingDark").checked=state.settings.dark;
  document.body.classList.toggle("light",!state.settings.dark);
}
function safeRun(name,fn){try{return fn()}catch(e){console.error("[AI Play] "+name,e);toast("שגיאה זמנית בממשק: "+name);return null;}}
function boot(){
  installGlobalButtonGuard();
  safeRun("icons",mountIcons);
  safeRun("events",setupEvents);
  safeRun("settings",applySettings);
  safeRun("user",renderUser);
  safeRun("home",renderHome);
  safeRun("following",()=>renderFollowing("today"));
  safeRun("history",renderHistory);
  safeRun("simple",renderSimple);
  safeRun("search",renderSearch);
  safeRun("view",()=>switchView("home"));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
loadServerState().catch(e=>{console.error(e);toast("האתר עלה, אך החיבור למסד הנתונים נכשל");});
if(sb)sb.auth.onAuthStateChange(()=>setTimeout(()=>loadServerState(),0));
