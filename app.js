const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

const KEY = "aiplay_v4";
const SUPABASE_URL = "https://ikgyozgzhjbdmopsaflp.supabase.co";
const SUPABASE_KEY = "sb_publishable_ezliwatqX0wz_-ScmiWzHw_-OhgkCH8";
const sb = window.supabase && typeof window.supabase.createClient === "function"
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const DEFAULT_STATE = {
  user:null, rep:0, items:[], following:[], liked:[], saved:[],
  history:[], downloads:[], searches:[], subscribed:[],
  settings:{autoplay:true,dark:true}
};

let state = loadState();
let currentView = "home";
let currentItem = null;
let playerMedia = null;
let playerTimer = null;
let currentFilter = "all";
let searchFilter = "all";
let serverReady = false;
let authMode = "signup";

function loadState(){
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch(e) {}
  const out = Object.assign({}, DEFAULT_STATE, saved || {});
  for (const k of ["items","following","liked","saved","history","downloads","searches","subscribed"]) {
    out[k] = Array.isArray(out[k]) ? out[k] : [];
  }
  out.settings = Object.assign({}, DEFAULT_STATE.settings, out.settings || {});
  return out;
}
function saveState(){
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e) {}
}
function esc(v){
  return String(v == null ? "" : v).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}
function toast(msg){
  const t = $("#toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__aiplayToast);
  window.__aiplayToast = setTimeout(() => t.classList.remove("show"), 2400);
}
function openModal(id){ $("#"+id)?.classList.add("open"); }
function closeModal(id){ $("#"+id)?.classList.remove("open"); }
function initials(name){ return ((name || "א").trim().charAt(0) || "א").toUpperCase(); }
function ensureAccount(action){
  if(state.user) return true;
  switchAuth("signup");
  openModal("authModal");
  toast("כדי " + action + " צריך לפתוח חשבון");
  return false;
}
function formatViews(n){
  n = Number(n) || 0;
  if(n >= 1000000) return (n/1000000).toFixed(1) + "M";
  if(n >= 1000) return (n/1000).toFixed(1) + "K";
  return String(n);
}
function durationText(sec){
  sec = Number(sec);
  if(!Number.isFinite(sec) || sec <= 0) return "";
  sec = Math.round(sec);
  return Math.floor(sec/60) + ":" + String(sec%60).padStart(2,"0");
}
function kindOf(x){
  return x.type === "shorts" ? "Shorts" :
         x.type === "image" ? "תמונה" :
         x.type === "audio" ? "אודיו" : "סרטון";
}
function actualItems(){ return Array.isArray(state.items) ? state.items : []; }
function filteredItems(filter="all", q=""){
  const term = String(q || "").toLowerCase().trim();
  let arr = actualItems().filter(x => {
    const txt = ((x.title||"") + " " + (x.author||"")).toLowerCase();
    if(term && !txt.includes(term)) return false;
    if(filter==="video") return x.type==="video";
    if(filter==="image") return x.type==="image";
    if(filter==="audio") return x.type==="audio";
    if(filter==="shorts") return x.type==="shorts";
    if(filter==="live") return x.status==="live";
    if(filter==="unwatched") return !state.history.includes(x.id);
    if(filter==="long") return Number(x.duration||0) > 300;
    return true;
  });
  if(filter==="new") arr = arr.slice().reverse();
  return arr;
}
function mediaMarkup(x, cls){
  cls = cls || "";
  if(x.dataUrl && x.type==="image") return '<img class="'+cls+' thumb-media" src="'+esc(x.dataUrl)+'" alt="">';
  if(x.dataUrl && (x.type==="video" || x.type==="shorts"))
    return '<video class="'+cls+' thumb-media" src="'+esc(x.dataUrl)+'" muted playsinline preload="metadata"></video>';
  if(x.mediaUrl && x.type==="image") return '<img class="'+cls+' thumb-media" src="'+esc(x.mediaUrl)+'" alt="">';
  if(x.mediaUrl && (x.type==="video" || x.type==="shorts"))
    return '<video class="'+cls+' thumb-media" src="'+esc(x.mediaUrl)+'" muted playsinline preload="metadata"></video>';
  return "";
}
function card(x, recommend){
  recommend = !!recommend;
  const dur = durationText(x.duration);
  if(recommend){
    return '<article class="recommendation-card" data-card-id="'+esc(x.id)+'">' +
      '<div class="recommendation-thumb">'+mediaMarkup(x)+'</div>' +
      '<div class="recommendation-copy"><h3>'+esc(x.title||"ללא שם")+'</h3>' +
      '<small>'+esc(x.author||"יוצר")+" · "+formatViews(x.views)+" צפיות</small></div></article>";
  }
  return '<article class="content-card" data-card-id="'+esc(x.id)+'" data-type="'+esc(x.type||"video")+'">' +
    '<div class="thumb '+esc(x.thumb||"")+'">'+mediaMarkup(x) +
    (dur ? '<span class="duration">'+dur+'</span>' : '') +
    (x.status==="live" ? '<span class="live-badge">LIVE</span>' : '') +
    '<button class="card-more" data-action="menu" data-id="'+esc(x.id)+'" aria-label="עוד"><span data-icon="more"></span></button></div>' +
    '<div class="card-body"><div class="card-avatar">'+esc(initials(x.author))+'</div><div>' +
    '<h3 class="card-title">'+esc(x.title||"ללא שם")+'</h3>' +
    '<div class="card-meta"><span>'+esc(x.author||"יוצר")+'</span><span>'+formatViews(x.views)+' צפיות · '+esc(x.time||"עכשיו")+' · '+kindOf(x)+'</span></div>' +
    '<div class="card-actions"><button class="tiny-action" data-action="open" data-id="'+esc(x.id)+'">פתיחה</button>' +
    '<button class="tiny-action" data-action="save" data-id="'+esc(x.id)+'">'+(state.saved.includes(x.id)?"נשמר":"שמור")+'</button></div>' +
    '</div></div></article>';
}
function mountIcons(){
  const icons = {
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
    settings:'<svg viewBox="0 0 24 24"><path d="M19.4 13a7.8 7.8 0 0 0 0-2l2-1.56-2-3.46-2.4.96a7.2 7.2 0 0 0-1.7-1l-.36-2.57h-4l-.36 2.57a7.2 7.2 0 0 0-1.7 1l-2.4-.96-2 3.46L6.4 11a7.8 7.8 0 0 0 0 2l-2 1.56 2 3.46 2.4-.96a7.2 7.2 0 0 0 1.7-1l.36 2.57h4l.36-2.57a7.2 7.2 0 0 0 1.7-1l2.4.96 2-3.46zM13 15.5A3.5 3.5 0 1 1 13 8a3.5 3.5 0 0 1 0 7.5"/></svg>',
    video:'<svg viewBox="0 0 24 24"><path d="M4 5h11a2 2 0 0 1 2 2v2l4-2v10l-4-2v2a2 2 0 0 1-2 2H4z"/></svg>',
    save:'<svg viewBox="0 0 24 24"><path d="M6 4h12v17l-6-3-6 3z"/></svg>',
    share:'<svg viewBox="0 0 24 24"><path d="M18 16a3 3 0 0 0-2.24 1l-7.03-3.52A3 3 0 0 0 9 12a3 3 0 0 0-.27-1.48l7.03-3.52A3 3 0 1 0 15 5a3 3 0 0 0 .27 1.48L8.24 10A3 3 0 1 0 8.24 14L15.27 17.52A3 3 0 1 0 18 16"/></svg>',
    remix:'<svg viewBox="0 0 24 24"><path d="M5 5h8v2H7v6H5zm6 12H5v2h8v-2zm8-10h-4l1.4 1.4A6 6 0 0 1 10 17v2a8 8 0 0 0 7.8-10.6L19 10z"/></svg>',
    cut:'<svg viewBox="0 0 24 24"><path d="m9 7 6 6-1.4 1.4-6-6zM5 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 2a1 1 0 1 0 0 2 1 1 0 0 0-1-2m14 8a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 2a1 1 0 1 0 0 2 1 1 0 0 0-2"/></svg>',
    live:'<svg viewBox="0 0 24 24"><path d="M4 7h10v10H4zm12 3 4-2v8l-4-2z"/></svg>',
    post:'<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zm2 3v2h10V7zm0 4v2h10v-2zm0 4v2h6v-2z"/></svg>',
    camera:'<svg viewBox="0 0 24 24"><path d="M4 7h4l1.5-2h5L16 7h4v12H4zm8 2.5A4.5 4.5 0 1 0 12 18a4.5 4.5 0 0 0 0-8.5"/></svg>',
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
  $$("[data-icon]").forEach(el => { el.innerHTML = icons[el.dataset.icon] || ""; });
}

function renderUser(){
  const u = state.user, name = u?.name || "אורח";
  $("#accountAvatar") && ($("#accountAvatar").textContent = initials(name));
  $("#accountName") && ($("#accountName").textContent = name);
  $("#accountRep") && ($("#accountRep").textContent = (state.rep||0) + " ✦");
  $("#profileAvatar") && ($("#profileAvatar").textContent = initials(name));
  $("#profileName") && ($("#profileName").textContent = name);
  $("#profileHandle") && ($("#profileHandle").textContent = u ? "@"+name.toLowerCase().replace(/\s+/g,"") : "@guest");
  $("#profileRep") && ($("#profileRep").textContent = state.rep || 0);
  $("#repValue") && ($("#repValue").textContent = state.rep || 0);
  $("#repLevel") && ($("#repLevel").textContent = state.rep>=2500?5:state.rep>=1000?4:state.rep>=500?3:state.rep>=100?2:1);
  $("#myCount") && ($("#myCount").textContent = actualItems().filter(x => x.author===u?.name).length);
  const lv = state.rep>=2500?5:state.rep>=1000?4:state.rep>=500?3:state.rep>=100?2:1;
  const target = lv===1?100:lv===2?500:lv===3?1000:lv===4?2500:5000;
  const prev = lv===1?0:lv===2?100:lv===3?500:lv===4?1000:2500;
  $("#repTarget") && ($("#repTarget").textContent = "יעד: "+target+" ✦");
  $("#repGoal") && ($("#repGoal").textContent = u ? (state.rep>=target ? "הגעתם ליעד" : "עוד "+(target-state.rep)+" ✦ ליעד") : "פתחו חשבון כדי להתחיל");
  if($("#repProgress")) $("#repProgress").style.width = Math.max(0,Math.min(100,((state.rep-prev)/(target-prev))*100)) + "%";
  $("#studioCount") && ($("#studioCount").textContent = actualItems().filter(x=>x.author===u?.name).length);
  $("#studioDrafts") && ($("#studioDrafts").textContent = actualItems().filter(x=>x.author===u?.name && x.status==="draft").length);
  $("#studioRep") && ($("#studioRep").textContent = state.rep||0);
}

function renderHome(){
  const arr = filteredItems(currentFilter);
  $("#homeGrid").innerHTML = arr.length ? arr.map(card).join("") :
    '<div class="empty-state"><span data-icon="spark"></span><b>אין עדיין תוכן להצגה</b><small>כאן יוצגו יצירות אמיתיות מהשרת.</small></div>';
  const shorts = actualItems().filter(x=>x.type==="shorts" || x.short===true);
  $("#shortsShelf").classList.toggle("hidden", shorts.length===0);
  $("#homeShortsRow").innerHTML = shorts.slice(0,6).map(x =>
    '<div class="short-card" data-action="open-short" data-id="'+esc(x.id)+'"><div class="short-thumb">'+mediaMarkup(x)+'</div><div class="short-title">'+esc(x.title||"Short")+'</div></div>'
  ).join("");
  mountIcons();
}
function renderFollowing(filter){
  filter = filter || "today";
  const names = new Set(state.following.concat(state.subscribed));
  const arr = actualItems().filter(x => names.has(x.author) && (filter==="today" || filter==="all" || filter==="video" && x.type==="video" || filter==="shorts" && x.type==="shorts" || filter==="live" && x.status==="live" || filter==="unwatched" && !state.history.includes(x.id)));
  $("#channelScroller").innerHTML = names.size
    ? Array.from(names).map(n => '<div class="channel-bubble"><div class="channel-avatar">'+esc(initials(n))+'</div><small>'+esc(n)+'</small></div>').join("")
    : '<div class="empty-state" style="min-height:150px;width:100%"><b>אין עדיין מינויים</b><small>כשתעקבו אחרי יוצר, הוא יופיע כאן.</small></div>';
  $("#followingGrid").innerHTML = arr.length ? arr.map(card).join("") :
    '<div class="empty-state"><span data-icon="subscriptions"></span><b>אין תוכן במינויים</b><small>עקבו אחרי יוצר כדי לראות כאן תוכן.</small></div>';
  mountIcons();
}
function renderHistory(){
  const arr = state.history.map(id=>actualItems().find(x=>x.id===id)).filter(Boolean);
  $("#historyRow").innerHTML = arr.length ? arr.slice(0,5).map(x =>
    '<div class="mini-card" data-action="open" data-id="'+esc(x.id)+'"><div class="mini-thumb">'+mediaMarkup(x)+'</div><b>'+esc(x.title||"ללא שם")+'</b></div>'
  ).join("") : '<div class="empty-state" style="min-height:140px;grid-column:1/-1"><b>ההיסטוריה ריקה</b><small>כשתפתחו יצירות, הן יופיעו כאן.</small></div>';
  $("#historyGrid").innerHTML = arr.length ? arr.map(card).join("") :
    '<div class="empty-state"><b>אין היסטוריה עדיין</b><small>פתחו יצירה כדי להוסיף אותה.</small></div>';
  mountIcons();
}
function renderSimple(){
  const maps = {liked:"likedGrid",downloads:"downloadsGrid",watchlater:"watchlaterGrid"};
  Object.entries(maps).forEach(([type,id])=>{
    const source = type==="liked" ? state.liked : type==="downloads" ? state.downloads : state.saved;
    const arr = source.map(v=>actualItems().find(x=>x.id===v)).filter(Boolean);
    $("#"+id).innerHTML = arr.length ? arr.map(card).join("") :
      '<div class="empty-state"><span data-icon="spark"></span><b>אין עדיין פריטים</b><small>הפעולות שתבצעו יופיעו כאן.</small></div>';
  });
  $("#playlistEmpty").innerHTML = '<span data-icon="playlist"></span><b>אין עדיין רשימות הפעלה</b><small>אפשר ליצור רשימות בהמשך.</small>';
  mountIcons();
}
function renderSearch(q){
  q = q || "";
  const arr = filteredItems(searchFilter,q);
  const recent = state.searches.slice(0,6);
  $("#searchHistory").innerHTML = recent.map(s=>'<button class="suggestion" data-action="search-history" data-query="'+esc(s)+'">'+esc(s)+'</button>').join("");
  $("#searchGrid").innerHTML = arr.length ? arr.map(card).join("") :
    '<div class="empty-state"><span data-icon="search"></span><b>לא נמצאו יצירות</b><small>החיפוש עובד מול התוכן שקיים בפלטפורמה.</small></div>';
  mountIcons();
}
function renderRecommendations(){
  const arr = actualItems().filter(x=>x.id!==currentItem?.id).slice(0,10);
  $("#recommendGrid").innerHTML = arr.length ? arr.map(x=>card(x,true)).join("") :
    '<div class="empty-state" style="min-height:180px"><b>אין המלצות עדיין</b><small>המלצות יופיעו לאחר העלאת תוכן.</small></div>';
  mountIcons();
}
function switchView(name){
  currentView = name;
  $$(".view").forEach(v => v.classList.toggle("active", v.dataset.page===name));
  $$(".nav-item[data-view],.mobile-bottom [data-view]").forEach(b => b.classList.toggle("active", b.dataset.view===name));
  if(name==="home") renderHome();
  else if(name==="following") renderFollowing("today");
  else if(name==="profile"){ renderUser(); renderHistory(); }
  else if(name==="history") renderHistory();
  else if(["playlists","liked","downloads","watchlater"].includes(name)) renderSimple();
  else if(name==="search") renderSearch($("#searchInput")?.value || "");
  else if(name==="studio") renderUser();
  else if(name==="reputation") renderUser();
  else if(name==="shorts") renderShorts();
  const main = $("#main"); if(main) main.scrollTop = 0;
}
function switchAuth(mode){
  authMode = mode === "login" ? "login" : "signup";
  $$(".tabs button").forEach(b=>b.classList.toggle("active", b.dataset.auth===authMode));
  $$(".signup-field").forEach(x=>x.classList.toggle("hidden", authMode!=="signup"));
  $("#authTitle").textContent = authMode==="signup" ? "פותחים חשבון" : "ברוכים הבאים";
  $("#authSub").textContent = authMode==="signup" ? "יוצרים, משתפים ובונים מוניטין." : "כניסה לחשבון.";
  $("#authSubmit").textContent = authMode==="signup" ? "פתיחת חשבון" : "כניסה";
}
function openWatch(id){
  const x = actualItems().find(i=>String(i.id)===String(id));
  if(!x){ toast("היצירה לא נמצאה"); return; }
  currentItem = x;
  if(!state.history.includes(x.id)){ state.history.unshift(x.id); state.history=state.history.slice(0,80); saveState(); }
  $("#watchTitle").textContent = x.title || "יצירה";
  $("#watchAuthor").textContent = x.author || "יוצר";
  $("#watchAvatar").textContent = initials(x.author);
  $("#watchSubscribers").textContent = (x.subscribers||0)+" מנויים";
  $("#watchLikeCount").textContent = formatViews(x.likes||0);
  $("#watchDescription").textContent = x.description || "תיאור היצירה · "+formatViews(x.views)+" צפיות";
  $("#watchDescription").classList.add("collapsed");
  $("#subscribeBtn").textContent = state.subscribed.includes(x.author) ? "רשום" : "הירשם";
  $("#subscribeBtn").classList.toggle("subscribed", state.subscribed.includes(x.author));
  mountPlayer(x);
  renderRecommendations();
  $$(".view").forEach(v=>v.classList.toggle("active",v.dataset.page==="watch"));
  currentView = "watch";
  $$(".nav-item,.mobile-bottom button").forEach(b=>b.classList.remove("active"));
  $("#main").scrollTop = 0;
  renderHistory();
}
function mountPlayer(x){
  clearInterval(playerTimer);
  const box = $("#playerMedia");
  if(!box) return;
  box.innerHTML = "";
  playerMedia = null;
  const src = x.dataUrl || x.mediaUrl || "";
  if(src && (x.type==="video" || x.type==="shorts")){
    playerMedia = document.createElement("video");
    playerMedia.src = src;
    playerMedia.playsInline = true;
    playerMedia.preload = "metadata";
    box.appendChild(playerMedia);
    playerMedia.addEventListener("loadedmetadata",()=>{
      x.duration = playerMedia.duration;
      $("#totalTime").textContent = durationText(playerMedia.duration);
      updateProgress();
      saveState();
    });
    playerMedia.addEventListener("timeupdate",updateProgress);
    playerMedia.addEventListener("progress",updateBuffer);
    playerMedia.addEventListener("ended",()=>{
      $("#togglePlay").innerHTML = '<span data-icon="play"></span>';
      mountIcons();
      if($("#autoplay")?.checked) nextMedia();
    });
  }else if(src && x.type==="image"){
    const img=document.createElement("img"); img.src=src; img.alt=x.title||""; box.appendChild(img);
  }else{
    box.innerHTML='<div class="player-placeholder"><strong>'+esc(x.title||"יצירה")+'</strong><span>אין קובץ מדיה זמין כרגע.</span></div>';
  }
  $("#togglePlay").innerHTML='<span data-icon="play"></span>';
  $("#bufferBar").style.width="0";
  $("#progressBar").style.width="0";
  $("#progressHandle").style.display="none";
  mountIcons();
}
function updateProgress(){
  if(!playerMedia?.duration) return;
  const p=(playerMedia.currentTime/playerMedia.duration)*100;
  $("#progressBar") && ($("#progressBar").style.width=p+"%");
  $("#progressHandle") && ($("#progressHandle").style.right=(100-p)+"%");
  $("#currentTime") && ($("#currentTime").textContent=durationText(playerMedia.currentTime));
  $("#totalTime") && ($("#totalTime").textContent=durationText(playerMedia.duration));
}
function updateBuffer(){
  if(!playerMedia?.duration || !playerMedia.buffered.length) return;
  const end=playerMedia.buffered.end(playerMedia.buffered.length-1);
  if($("#bufferBar")) $("#bufferBar").style.width=(end/playerMedia.duration*100)+"%";
}
function togglePlayer(){
  if(!playerMedia){ toast("אין קובץ מדיה זמין לניגון"); return; }
  if(playerMedia.paused){
    playerMedia.play().then(()=>{
      $("#togglePlay").innerHTML='<span data-icon="pause"></span>'; mountIcons();
    }).catch(()=>toast("הדפדפן חסם את הניגון"));
  }else{
    playerMedia.pause();
    $("#togglePlay").innerHTML='<span data-icon="play"></span>'; mountIcons();
  }
}
function nextMedia(dir){
  const arr=filteredItems("all");
  const i=arr.findIndex(x=>x.id===currentItem?.id);
  const ni=dir==="prev"?i-1:i+1;
  if(ni>=0 && ni<arr.length) openWatch(arr[ni].id);
}
function seekBy(sec){
  if(playerMedia?.duration){
    playerMedia.currentTime=Math.max(0,Math.min(playerMedia.duration,playerMedia.currentTime+sec));
    updateProgress();
  }
}
function maybeDownload(x){
  if(!x) return;
  const src=x.dataUrl||x.mediaUrl||"";
  if(!src){ toast("אין קובץ זמין להורדה"); return; }
  const a=document.createElement("a");
  a.href=src;
  a.download=(x.title||"ai-play").replace(/[\\/:*?"<>|]/g,"_");
  document.body.appendChild(a); a.click(); a.remove();
  if(!state.downloads.includes(x.id)) state.downloads.unshift(x.id);
  x.downloads=(x.downloads||0)+1; state.rep+=1; saveState(); renderUser();
  toast("ההורדה התחילה");
}
async function shareItem(x){
  try{
    const data={title:x.title||"AI פליי",text:"שיתוף יצירה ב-AI פליי",url:location.href};
    if(navigator.share){ await navigator.share(data); }
    else if(navigator.clipboard){ await navigator.clipboard.writeText(location.href); toast("הקישור הועתק"); }
    else toast("אין אפשרות שיתוף זמינה");
  }catch(e){ if(e?.name!=="AbortError") toast("לא ניתן לשתף מהמכשיר הזה"); }
}
function toggleSaved(id){
  if(!ensureAccount("לשמור")) return;
  const i=state.saved.indexOf(id);
  if(i>=0){state.saved.splice(i,1);toast("הוסר מצפה מאוחר יותר");}
  else{state.saved.unshift(id);toast("נשמר לצפייה מאוחרת יותר");}
  saveState(); renderHome(); renderSimple();
}
function toggleLiked(id){
  if(!ensureAccount("לסמן לייק")) return;
  const i=state.liked.indexOf(id);
  if(i>=0){state.liked.splice(i,1);toast("הלייק הוסר");}
  else{state.liked.unshift(id);state.rep+=1;toast("סומן לייק");}
  saveState(); renderUser();
  if(currentItem && currentItem.id===id){
    currentItem.likes=Number(currentItem.likes||0)+(i>=0?-1:1);
    $("#watchLikeCount").textContent=formatViews(currentItem.likes);
  }
  renderSimple();
}
function toggleSubscription(author){
  if(!author || !ensureAccount("להירשם")) return;
  let i=state.subscribed.indexOf(author);
  if(i>=0){state.subscribed.splice(i,1);state.following=state.following.filter(x=>x!==author);toast("ביטלת את ההרשמה");}
  else{state.subscribed.push(author);state.following.push(author);state.following=[...new Set(state.following)];toast("נרשמת לערוץ");}
  saveState();
  $("#subscribeBtn") && ($("#subscribeBtn").textContent=state.subscribed.includes(author)?"רשום":"הירשם");
  $("#subscribeBtn")?.classList.toggle("subscribed",state.subscribed.includes(author));
  renderFollowing("today");
}
function createLocalDraft(){
  if(!ensureAccount("ליצור")) return;
  const prompt=$("#prompt")?.value.trim()||"";
  if(!prompt){toast("כתבו הנחיה");return;}
  const type=$(".media-tabs button.active")?.dataset.studioType||"video";
  state.items.unshift({id:"local-"+Date.now(),type,title:prompt.slice(0,80),author:state.user.name,views:0,likes:0,status:"draft",time:"עכשיו",description:prompt,thumb:"local",short:type==="shorts"});
  state.rep+=2; saveState(); closeModal("studioModal"); $("#prompt").value=""; renderHome(); renderUser(); toast("הטיוטה נשמרה");
}
async function uploadToServer(file,title){
  if(!sb) throw new Error("שירות הנתונים אינו זמין");
  const session=(await sb.auth.getSession()).data.session;
  if(!session) throw new Error("צריך להתחבר");
  const type=(file.type||"").startsWith("video")?"video":(file.type||"").startsWith("audio")?"audio":"image";
  const id=(crypto.randomUUID ? crypto.randomUUID() : "m-"+Date.now());
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path=session.user.id+"/"+id+"-"+safeName;
  const up=await sb.storage.from("ai-play-media").upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});
  if(up.error) throw up.error;
  const ins=await sb.from("creations").insert({id,user_id:session.user.id,title,media_type:type,storage_path:path,status:"pending"}).select("*,profiles(display_name)").single();
  if(ins.error){await sb.storage.from("ai-play-media").remove([path]);throw ins.error;}
  let mediaUrl="";
  try{
    const s=await sb.storage.from("ai-play-media").createSignedUrl(path,3600);
    mediaUrl=s.data?.signedUrl||"";
  }catch(e){}
  const item=Object.assign(dbItem(ins.data),{mediaUrl});
  state.items.unshift(item); state.rep+=1; saveState(); renderHome(); renderUser();
}
function dbItem(row){
  return {
    id:row.id,type:row.media_type==="shorts"?"shorts":row.media_type,title:row.title,
    author:row.profiles?.display_name||"יוצר",authorId:row.user_id,
    views:Number(row.views_count||0),likes:Number(row.likes_count||0),downloads:Number(row.downloads_count||0),
    status:row.status,time:new Date(row.created_at).toLocaleDateString("he-IL"),description:row.description||"",
    storagePath:row.storage_path,thumbnailPath:row.thumbnail_path,duration:Number(row.duration_seconds||0),
    short:row.media_type==="shorts"
  };
}
async function hydrateMedia(items){
  if(!sb) return items;
  return Promise.all(items.map(async x=>{
    if(x.mediaUrl || !x.storagePath) return x;
    try{
      const r=await sb.storage.from("ai-play-media").createSignedUrl(x.storagePath,3600);
      return Object.assign(x,{mediaUrl:r.data?.signedUrl||""});
    }catch(e){ return x; }
  }));
}
async function loadServerState(){
  if(!sb){ serverReady=false; return; }
  try{
    const session=(await sb.auth.getSession()).data.session;
    if(session?.user){
      const user=session.user;
      // Update the UI immediately from the authenticated Supabase user.
      state.user={
        id:user.id,
        name:user.user_metadata?.display_name || user.user_metadata?.name ||
             user.email?.split("@")[0] || "משתמש",
        email:user.email || ""
      };
      saveState();
      renderUser();
      closeModal("authModal");

      // Profile/database data is secondary. A failure here must not undo the login UI.
      try{
        const p=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();
        if(p.data){
          state.user.name=p.data.display_name || state.user.name;
          state.rep=Number(p.data.reputation||0);
        }
      }catch(e){ console.warn("[AI Play] profile sync",e); }

      try{
        const rows=await sb.from("creations").select("*,profiles(display_name)").order("created_at",{ascending:false});
        state.items=await hydrateMedia((rows.data||[]).map(dbItem));
      }catch(e){ console.warn("[AI Play] creations sync",e); }

      try{
        const likes=await sb.from("creation_likes").select("creation_id").eq("user_id",user.id);
        state.liked=(likes.data||[]).map(x=>x.creation_id);
      }catch(e){ console.warn("[AI Play] likes sync",e); }

      try{
        const dls=await sb.from("downloads").select("creation_id").eq("user_id",user.id);
        state.downloads=(dls.data||[]).map(x=>x.creation_id);
      }catch(e){ console.warn("[AI Play] downloads sync",e); }

      try{
        const fol=await sb.from("follows").select("following_id,profiles!follows_following_id_fkey(display_name)").eq("follower_id",user.id);
        state.following=(fol.data||[]).map(x=>x.profiles?.display_name).filter(Boolean);
        state.subscribed=state.following.slice();
      }catch(e){ console.warn("[AI Play] follows sync",e); }

    }else{
      state.user=null;
      state.rep=0;
      state.liked=[];
      state.downloads=[];
      state.following=[];
      state.subscribed=[];
      try{
        const rows=await sb.from("creations").select("*,profiles(display_name)").eq("status","approved").order("created_at",{ascending:false});
        state.items=await hydrateMedia((rows.data||[]).map(dbItem));
      }catch(e){ console.warn("[AI Play] public creations sync",e); }
    }
    serverReady=true;
    saveState();
    renderUser();
    renderHome();
    renderFollowing("today");
    renderHistory();
    renderSimple();
    renderSearch();
  }catch(e){
    console.error("[AI Play] server state",e);
    serverReady=false;
    // Keep any already-authenticated user visible instead of reverting to the guest UI.
    renderUser();
  }
}
async function signUpServer(name,email,password){
  const r=await sb.auth.signUp({email,password,options:{data:{display_name:name,username:name.toLowerCase().replace(/[^a-z0-9א-ת]+/g,"_").slice(0,30)||"user"}}});
  if(r.error) throw r.error;
  if(r.data.user && !r.data.session) toast("נשלח מייל אימות. אשרו אותו ואז התחברו.");
  else toast("החשבון נוצר בהצלחה");
}
async function signInServer(email,password){
  const r=await sb.auth.signInWithPassword({email,password});
  if(r.error) throw r.error;
  await loadServerState(); closeModal("authModal"); toast("התחברתם בהצלחה");
}

const GOOGLE_CLIENT_ID="660683262491-mnonmgjjebdefstt1rjat9s7tfjce1pf.apps.googleusercontent.com";
let googleIdentityReady=false;

async function handleGoogleCredential(response){
  try{
    if(!sb) throw new Error("שירות הנתונים אינו זמין כרגע");
    if(!response?.credential) throw new Error("Google לא החזיר אסימון התחברות");

    const result=await sb.auth.signInWithIdToken({
      provider:"google",
      token:response.credential
    });
    if(result.error) throw result.error;

    // Use the user returned by Supabase immediately; do not wait for a
    // second getSession call, which can briefly be empty during auth locking.
    const user=result.data?.user;
    if(!user) throw new Error("Google אומת, אבל Supabase לא החזיר משתמש");

    state.user={
      id:user.id,
      name:user.user_metadata?.display_name ||
           user.user_metadata?.name ||
           user.user_metadata?.full_name ||
           user.email?.split("@")[0] || "משתמש",
      email:user.email || ""
    };
    saveState();
    renderUser();
    closeModal("authModal");

    // Load optional profile/content data without allowing it to undo auth UI.
    loadServerState().catch(()=>{});
    switchView("profile");
    toast("התחברתם בהצלחה עם Google");
  }catch(e){
    console.error("[AI Play] Google auth",e);
    toast("שגיאה בכניסה עם Google: "+(e?.message||"לא ניתן להתחבר"));
  }
}
window.handleSignInWithGoogle=handleGoogleCredential;

function initGoogleIdentity(){
  if(!window.google?.accounts?.id) return false;
  google.accounts.id.initialize({
    client_id:GOOGLE_CLIENT_ID,
    callback:window.handleSignInWithGoogle,
    ux_mode:"popup",
    auto_select:false,
    cancel_on_tap_outside:true
  });
  googleIdentityReady=true;
  return true;
}

async function signInWithGoogle(){
  if(!sb) throw new Error("שירות הנתונים אינו זמין כרגע");
  if(!googleIdentityReady && !initGoogleIdentity()){
    throw new Error("רכיב ההתחברות של Google עדיין נטען. נסו שוב בעוד רגע");
  }
  google.accounts.id.prompt((notification)=>{
    if(notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()){
      toast("Google לא הציג את חלון ההתחברות. נסו שוב.");
    }
  });
}
function renderShorts(startId){
  const arr=actualItems().filter(x=>x.type==="shorts" || x.short===true);
  const stage=$("#shortsStage");
  if(!stage)return;
  if(!arr.length){stage.innerHTML='<div class="short-empty"><b>אין עדיין Shorts</b><span>העלו יצירה מסוג Short כדי להתחיל.</span></div>';return;}
  let i=startId ? arr.findIndex(x=>String(x.id)===String(startId)) : 0;
  if(i<0)i=0;
  const x=arr[i];
  stage.innerHTML='<div class="short-active">'+
    ((x.dataUrl||x.mediaUrl)?'<video id="shortVideo" src="'+esc(x.dataUrl||x.mediaUrl)+'" playsinline loop autoplay></video>':'<div class="short-empty"><b>'+esc(x.title||"Short")+'</b><span>אין קובץ מדיה זמין.</span></div>')+
    '<div class="short-gradient"></div><div class="short-side">'+
    '<button data-short="like">'+(mountShortIcon("like"))+'<small>'+formatViews(x.likes||0)+'</small></button>'+
    '<button data-short="dislike">'+mountShortIcon("dislike")+'<small>לא</small></button>'+
    '<button data-short="share">'+mountShortIcon("share")+'<small>שתף</small></button>'+
    '<button data-short="remix">'+mountShortIcon("remix")+'<small>רימיקס</small></button></div>'+
    '<div class="short-bottom"><div class="short-channel"><div class="channel-avatar">'+esc(initials(x.author))+'</div><b>'+esc(x.author||"יוצר")+'</b>'+
    '<button class="short-follow" data-action="follow-author" data-author="'+esc(x.author||"יוצר")+'">'+(state.subscribed.includes(x.author)?"רשום":"הירשם")+'</button></div>'+
    '<p>'+esc(x.title||"Short")+'</p><span class="short-song">♫ יצירה מקורית</span></div></div>';
}
function mountShortIcon(name){
  const map={like:'M8 10l3-6h2v5h5.2c1.1 0 1.99.91 1.95 2.01l-.5 7A2 2 0 0 1 17.66 20H8z',dislike:'M16 14l-3 6h-2v-5H5.8a2 2 0 0 1-1.95-2.01l.5-7A2 2 0 0 1 6.34 4H16z',share:'M18 16a3 3 0 0 0-2.24 1l-7.03-3.52A3 3 0 0 0 9 12a3 3 0 0 0-.27-1.48l7.03-3.52A3 3 0 1 0 15 5a3 3 0 0 0 .27 1.48L8.24 10A3 3 0 1 0 8.24 14L15.27 17.52A3 3 0 1 0 18 16',remix:'M5 5h8v2H7v6H5zm6 12H5v2h8v-2z'};
  return '<svg viewBox="0 0 24 24"><path d="'+map[name]+'"/></svg>';
}

function handleClick(e){
  const target=e.target.closest("button,[data-action],[data-card-id],.profile-card");
  if(!target) return;

  if(target.matches(".modal") || target.classList.contains("modal-card")) return;

  const closeId=target.dataset.close;
  if(closeId){ closeModal(closeId); return; }

  if(target.dataset.view){ switchView(target.dataset.view); return; }
  if(target.dataset.viewTarget){ switchView(target.dataset.viewTarget); return; }

  if(target.dataset.action==="open"){ openWatch(target.dataset.id); return; }
  if(target.dataset.action==="open-short"){ renderShorts(target.dataset.id); switchView("shorts"); return; }
  if(target.dataset.action==="save"){ e.stopPropagation(); toggleSaved(target.dataset.id); return; }
  if(target.dataset.action==="menu"){ e.stopPropagation(); const x=actualItems().find(i=>String(i.id)===String(target.dataset.id)); if(x){const ok=confirm("אישור = "+(state.saved.includes(x.id)?"הסר מרשימה":"שמור לרשימה")+"\\nביטול = שיתוף"); ok?toggleSaved(x.id):shareItem(x);} return; }
  if(target.dataset.action==="follow-author"){ toggleSubscription(target.dataset.author); return; }
  if(target.dataset.action==="search-history"){ $("#searchInput").value=target.dataset.query; renderSearch(target.dataset.query); return; }

  if(target.dataset.short){
    const x=currentItem || actualItems().find(i=>i.type==="shorts");
    if(target.dataset.short==="like" && x) toggleLiked(x.id);
    else if(target.dataset.short==="share" && x) shareItem(x);
    else if(target.dataset.short==="dislike") toast("סומן לא אהבתי");
    else if(target.dataset.short==="remix") toast("רימיקס יהיה זמין לאחר חיבור כלי היצירה");
    return;
  }

  if(target.matches(".content-card,.recommendation-card,.mini-card")){
    if(!target.closest("button")) openWatch(target.dataset.cardId || target.dataset.id);
    return;
  }

  if(target.id==="menuBtn"){ $("#sidebar")?.classList.toggle("open"); return; }
  if(target.id==="createTop" || target.id==="mobileCreate"){ openModal("createModal"); return; }
  if(target.id==="uploadSide"){ if(ensureAccount("להעלות")) openModal("uploadModal"); return; }
  if(target.id==="accountBtn"){ state.user ? switchView("profile") : (switchAuth("login"),openModal("authModal")); return; }
  if(target.id==="notificationsBtn"){ toast("אין התראות חדשות"); return; }
  if(target.id==="castBtn" || target.id==="playerCast" || target.id==="profileCast"){ toast("שידור למסך תלוי בתמיכת המכשיר"); return; }
  if(target.id==="topMic" || target.id==="searchMic"){ toast("חיפוש קולי זמין בדפדפנים שתומכים בזיהוי קול"); return; }
  if(target.id==="shortsSearch" || target.id==="profileSearch"){ switchView("search"); return; }
  if(target.id==="shortsCamera"){ if(ensureAccount("להעלות")) openModal("uploadModal"); return; }
  if(target.id==="shortsMenu"){ toast("אפשרויות Shorts יופיעו לפי היצירה"); return; }
  if(target.id==="searchFiltersBtn"){ openModal("searchFiltersModal"); return; }
  if(target.id==="watchTitleToggle"){ $("#watchDescription")?.classList.toggle("collapsed"); target.classList.toggle("open"); return; }
  if(target.id==="togglePlay"){ togglePlayer(); return; }
  if(target.id==="prevMedia"){ nextMedia("prev"); return; }
  if(target.id==="nextMedia"){ nextMedia("next"); return; }
  if(target.id==="playerSettings" || target.id==="profileSettings"){ openModal("settingsModal"); return; }
  if(target.id==="captionBtn"){ toast("אין כתוביות זמינות ביצירה זו"); return; }
  if(target.id==="minimizePlayer"){ if(currentItem){$("#miniTitle").textContent=currentItem.title||"יצירה";$("#miniAuthor").textContent=currentItem.author||"יוצר";$("#miniPlayer").classList.remove("hidden");switchView("home");} return; }
  if(target.id==="fullscreenBtn"){ const p=$("#playerShell"); if(p?.requestFullscreen) p.requestFullscreen().catch(()=>{}); return; }
  if(target.id==="subscribeBtn"){ toggleSubscription(currentItem?.author); return; }
  if(target.id==="subBell"){ toast("התראות הערוץ הופעלו"); return; }
  if(target.id==="incognitoBtn"){ toast("מצב גלישה בסתר הופעל לממשק"); return; }
  if(target.id==="switchAccount"){
    if(sb) sb.auth.signOut().catch(()=>{});
    state.user=null;state.rep=0;state.liked=[];state.downloads=[];state.following=[];state.subscribed=[];saveState();renderUser();switchAuth("login");openModal("authModal");return;
  }
  if(target.id==="authSubmit"){ submitAuth(); return; }
  if(target.id==="googleAuthBtn"){ signInWithGoogle().catch(e=>{console.error(e);toast("שגיאה בכניסה עם Google: "+(e?.message||"לא ניתן להתחבר"));}); return; }
  if(target.matches(".tabs button[data-auth]")){ switchAuth(target.dataset.auth); return; }
  if(target.matches(".create-options [data-create]")){
    const type=target.dataset.create;closeModal("createModal");
    if(type==="video"){if(ensureAccount("להעלות"))openModal("uploadModal");}
    else if(type==="short"){if(ensureAccount("ליצור")){openModal("studioModal");$(".media-tabs button[data-studio-type='shorts']")?.click();}}
    else if(type==="post") toast("פוסט יתווסף בחיבור המלא לשרת");
    else toast("שידור חי יתווסף בחיבור המלא לשרת");
    return;
  }
  if(target.matches(".media-tabs button")){$$(".media-tabs button").forEach(x=>x.classList.remove("active"));target.classList.add("active");return;}
  if(target.id==="createWork"){createLocalDraft();return;}
  if(target.id==="uploadSubmit"){submitUpload();return;}
  if(target.id==="resetLocal"){
    if(confirm("לנקות את הנתונים המקומיים ולצאת מהחשבון?")){
      if(sb)sb.auth.signOut().catch(()=>{});
      localStorage.removeItem(KEY);location.reload();
    }
    return;
  }
  if(target.id==="allSubscriptions"){toast(state.subscribed.length?state.subscribed.join(" · "):"אין עדיין מינויים");return;}
  if(target.id==="commentsPreview"){toast("פאנל תגובות מלא יתווסף בחיבור שירות התגובות");return;}
  if(target.id==="premiumCard"){toast("Premium יופעל כאשר המנוי יחובר");return;}
  if(target.id==="miniPlay"){togglePlayer();return;}
  if(target.id==="miniClose"){$("#miniPlayer")?.classList.add("hidden");return;}
  if(target.id==="searchFiltersModal" && target.dataset.filter){searchFilter=target.dataset.filter;closeModal("searchFiltersModal");renderSearch($("#searchInput")?.value||"");return;}
}
async function submitAuth(){
  const signup=authMode==="signup";
  const name=$("#authName")?.value.trim()||"";
  const email=$("#authEmail")?.value.trim()||"";
  const pass=$("#authPass")?.value||"";
  const terms=$("#termsOk")?.checked||false;
  if(!email.includes("@") || pass.length<6 || (signup && (!name || !terms))){toast("בדקו את הפרטים: סיסמה צריכה להכיל לפחות 6 תווים");return;}
  if(!sb){toast("שירות הנתונים אינו זמין כרגע");return;}
  $("#authSubmit").disabled=true;
  try{
    if(signup){
      await signUpServer(name,email,pass);
      const session=(await sb.auth.getSession()).data.session;
      if(session){await loadServerState();closeModal("authModal");}
    }else await signInServer(email,pass);
  }catch(e){console.error(e);toast("שגיאה: "+(e?.message||"לא ניתן להתחבר"));}
  finally{$("#authSubmit").disabled=false;}
}
async function submitUpload(){
  if(!ensureAccount("להעלות")) return;
  const file=$("#file")?.files?.[0], title=$("#uploadTitle")?.value.trim()||"";
  if(!file || !title){toast("בחרו קובץ ושם");return;}
  if(file.size>500*1024*1024){toast("הקובץ גדול מדי (מקסימום 500MB)");return;}
  $("#uploadSubmit").disabled=true;
  try{ await loadServerState(); await uploadToServer(file,title); closeModal("uploadModal");$("#file").value="";$("#uploadTitle").value="";toast("הקובץ הועלה ונשלח לבדיקה");}
  catch(e){console.error(e);toast("שגיאה בהעלאה: "+(e?.message||"לא ניתן להעלות"));}
  finally{$("#uploadSubmit").disabled=false;}
}
function setup(){
  if(window.__aiplayV4Ready) return;
  window.__aiplayV4Ready=true;
  document.addEventListener("click",handleClick,false);
  initGoogleIdentity();


  document.addEventListener("keydown",e=>{
    if(e.key==="Escape") $$(".modal.open").forEach(m=>m.classList.remove("open"));
  });

  $("#topSearchForm")?.addEventListener("submit",e=>{
    e.preventDefault();
    const q=$("#topSearch")?.value.trim()||"";
    if(q){state.searches.unshift(q);state.searches=[...new Set(state.searches)].slice(0,20);saveState();}
    $("#searchInput") && ($("#searchInput").value=q);
    switchView("search");renderSearch(q);
  });
  $("#searchForm")?.addEventListener("submit",e=>{
    e.preventDefault();
    const q=$("#searchInput")?.value.trim()||"";
    if(q){state.searches.unshift(q);state.searches=[...new Set(state.searches)].slice(0,20);saveState();}
    renderSearch(q);
  });
  $("#searchInput")?.addEventListener("input",e=>renderSearch(e.target.value));

  document.addEventListener("click",e=>{
    const chip=e.target.closest(".chip,[data-filter]");
    if(!chip || chip.id==="searchFiltersBtn") return;
    if(chip.dataset.filter && chip.closest("#homeChips")){
      $$("#homeChips .chip").forEach(x=>x.classList.remove("active"));chip.classList.add("active");currentFilter=chip.dataset.filter;renderHome();
    }
    if(chip.dataset.filter && chip.closest("#followingChips")){
      $$("#followingChips .chip").forEach(x=>x.classList.remove("active"));chip.classList.add("active");renderFollowing(chip.dataset.filter);
    }
    if(chip.dataset.filter && chip.closest("#searchFiltersModal")){
      searchFilter=chip.dataset.filter;closeModal("searchFiltersModal");renderSearch($("#searchInput")?.value||"");
    }
  },false);

  $("#progressTrack")?.addEventListener("click",e=>{
    if(!playerMedia?.duration)return;
    const r=e.currentTarget.getBoundingClientRect();
    const p=1-((e.clientX-r.left)/r.width);
    playerMedia.currentTime=Math.max(0,Math.min(playerMedia.duration,p*playerMedia.duration));
    updateProgress();
  });
  $("#playerShell")?.addEventListener("touchstart",e=>{window.__sx=e.touches[0]?.clientX||0;},{passive:true});
  $("#playerShell")?.addEventListener("touchend",e=>{const dx=(e.changedTouches[0]?.clientX||0)-(window.__sx||0);if(Math.abs(dx)>130)seekBy(dx>0?-10:10);});
  $("#playerShell")?.addEventListener("dblclick",e=>{const r=e.currentTarget.getBoundingClientRect();seekBy((e.clientX-r.left)<r.width/2?-10:10);});

  $("#file")?.addEventListener("change",e=>{const f=e.target.files?.[0];if(f && $("#fileName"))$("#fileName").textContent=f.name;});
  $("#settingAutoplay")?.addEventListener("change",e=>{state.settings.autoplay=e.target.checked;saveState();if($("#autoplay"))$("#autoplay").checked=e.target.checked;});
  $("#settingDark")?.addEventListener("change",e=>{state.settings.dark=e.target.checked;document.body.classList.toggle("light",!e.target.checked);saveState();});
  $("#autoplay")?.addEventListener("change",e=>{state.settings.autoplay=e.target.checked;saveState();if($("#settingAutoplay"))$("#settingAutoplay").checked=e.target.checked;});
}
function applySettings(){
  document.body.classList.toggle("light",!state.settings.dark);
  if($("#autoplay"))$("#autoplay").checked=state.settings.autoplay;
  if($("#settingAutoplay"))$("#settingAutoplay").checked=state.settings.autoplay;
  if($("#settingDark"))$("#settingDark").checked=state.settings.dark;
}
function boot(){
  try{
    mountIcons(); setup(); applySettings(); renderUser(); renderHome(); renderFollowing("today"); renderHistory(); renderSimple(); renderSearch(); switchView("home");
    window.__aiplayBooted=true;
  }catch(e){
    console.error("[AI Play] boot",e);
    toast("שגיאת אתחול בממשק — נסו רענון");
  }
}
window.addEventListener("error",e=>console.error("[AI Play] runtime",e.error||e.message));
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true}); else boot();
if(sb){
  sb.auth.onAuthStateChange((event, session)=>{
    if(session?.user){
      const user=session.user;
      state.user={
        id:user.id,
        name:user.user_metadata?.display_name ||
             user.user_metadata?.name ||
             user.user_metadata?.full_name ||
             user.email?.split("@")[0] || "משתמש",
        email:user.email || ""
      };
      saveState();
      renderUser();
      closeModal("authModal");
    }else if(event==="SIGNED_OUT"){
      state.user=null;
      state.rep=0;
      state.liked=[];
      state.downloads=[];
      state.following=[];
      state.subscribed=[];
      saveState();
      renderUser();
    }
    setTimeout(()=>loadServerState(),0);
  });
  loadServerState();
}
