const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const store={user:JSON.parse(localStorage.getItem('aiplay_user')||'null'), reps:JSON.parse(localStorage.getItem('aiplay_reps')||'{}'), custom:JSON.parse(localStorage.getItem('aiplay_custom')||'[]')};
const baseContent=[
 {id:1,type:'video',title:'עולם חדש',author:'אור בן דוד',initial:'א',views:8421,rep:1280,thumb:'one'},
 {id:2,type:'image',title:'העיר שאחרי הגשם',author:'מיכאל יוצר',initial:'מ',views:6213,rep:940,thumb:'two'},
 {id:3,type:'video',title:'מסע אל האור',author:'אלעד AI',initial:'ע',views:5041,rep:735,thumb:'three'},
 {id:4,type:'image',title:'דיוקן של דמיון',author:'יצחק סטודיו',initial:'י',views:3882,rep:510,thumb:'four'}
];
const creators=[['אור בן דוד','1,280','א'],['מיכאל יוצר','940','מ'],['אלעד AI','735','ע'],['יצחק סטודיו','510','י']];
const leaders=[['אור בן דוד','9,842'],['מיכאל יוצר','7,460'],['אלעד AI','6,190'],['יצחק סטודיו','5,520'],['יצירה יומית','4,980']];

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__tt);window.__tt=setTimeout(()=>t.classList.remove('show'),2600)}
function openModal(id){$('#'+id).classList.add('open')}
function closeModal(id){$('#'+id).classList.remove('open')}
function persist(){localStorage.setItem('aiplay_user',JSON.stringify(store.user));localStorage.setItem('aiplay_reps',JSON.stringify(store.reps));localStorage.setItem('aiplay_custom',JSON.stringify(store.custom))}
function userKey(){return store.user?.email||'demo'}
function rep(){return Number(store.reps[userKey()]||0)}
function setRep(v){store.reps[userKey()]=Math.max(0,v);persist();renderUser()}
function renderUser(){const logged=!!store.user;$('#loginBtn').classList.toggle('hidden',logged);$('#signupBtn').classList.toggle('hidden',logged);$('#userPill').classList.toggle('hidden',!logged);$('#userName').textContent=store.user?.name||'אורח';$('#userAvatar').textContent=(store.user?.name||'א').trim().charAt(0);$('#userRep').textContent=rep()+' ✦';$('#sideRep').textContent=rep();const pct=Math.min(100,Math.round((rep()%300)/3));$('#repProgress').style.width=Math.max(4,pct)+'%';$('#repNextText').textContent=rep()>=300?'רמה 3 פתוחה':'עוד '+Math.max(0,300-rep())+' עד רמה הבאה'}
function ensureUser(action){if(!store.user){openModal('authModal');toast('כדי '+action+' צריך לפתוח חשבון');return false}return true}

function renderFeed(filter='all', query=''){let items=[...store.custom.map((x,i)=>({...x,id:'c'+i})),...baseContent];items=items.filter(x=>(filter==='all'||x.type===filter)&&(!query||[x.title,x.author].join(' ').includes(query)));$('#feedGrid').innerHTML=items.map(x=>`<article class="content-card" data-type="${x.type}"><div class="thumb ${x.thumb||'one'}">${x.type==='video'?'<span class="play">▶</span>':''}<span class="kind">${x.type==='video'?'VIDEO':'IMAGE'}</span></div><div class="content-meta"><h3>${esc(x.title)}</h3><div class="meta-row"><div class="author"><span class="author-dot">${esc(x.initial||'י')}</span><span>${esc(x.author)}</span></div><span>◉ ${Number(x.views||0).toLocaleString('he-IL')}</span></div><div class="card-actions"><button class="tiny-btn watch-btn" data-id="${x.id}">▶ צפייה</button><button class="tiny-btn download-btn" data-id="${x.id}">↓ הורדה</button></div></div></article>`).join('')||'<div class="panel" style="grid-column:1/-1">לא נמצאו יצירות תואמות.</div>'}
function bindCardActions(){
  $('.watch-btn').forEach(b=>b.onclick=()=>{
    const item=[...baseContent,...store.custom.map((x,i)=>({...x,id:'c'+i}))].find(x=>String(x.id)===String(b.dataset.id));
    if(item){item.views=Number(item.views||0)+1;toast('צפייה נספרה ליוצר · +1 מוניטין עבורו');}
  });
  $('.download-btn').forEach(b=>b.onclick=()=>{
    if(!ensureUser('להוריד יצירה'))return;
    if(rep()<100){toast('הורדה נפתחת מרמה של 100 ✦ מוניטין');return}
    toast('הורדה אושרה · +3 מוניטין ליוצר');
  });
}
function renderCreators(){ $('#creatorGrid').innerHTML=creators.map(c=>`<div class="creator"><div class="big-avatar">${c[2]}</div><h3>${c[0]}</h3><p>יוצר תוכן AI</p><span class="creator-rep">✦ ${c[1]} מוניטין</span></div>`).join('')}
function renderLeaders(){ $('#leaderList').innerHTML=leaders.map((l,i)=>`<div class="leader ${i===0?'top':''}"><span>0${i+1}</span><div class="name"><i>${l[0].charAt(0)}</i><div><b>${l[0]}</b><small>יוצר פעיל</small></div></div><strong>✦ ${l[1]}</strong></div>`).join('')}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

$$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
$$('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
$('#createHero').onclick=()=>{if(ensureUser('ליצור יצירה חדשה'))openModal('generatorModal')};
$('#uploadHero').onclick=()=>{if(ensureUser('להעלות יצירה'))openModal('uploadModal')};
$('#loginBtn').onclick=()=>openModal('authModal');$('#signupBtn').onclick=()=>openModal('authModal');$('#signupLeader').onclick=()=>openModal('authModal');
$('#repExplain').onclick=()=>toast('מוניטין: צפיות +1, הורדות מאושרות +3, יצירה מאושרת +10. הרעיון הוא לתגמל תרומה ואמון.');
$$('.segmented button').forEach(b=>b.onclick=()=>{$$('.segmented button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderFeed(b.dataset.filter)});
$$('.type-switch button').forEach(b=>b.onclick=()=>{$$('.type-switch button').forEach(x=>x.classList.remove('active'));b.classList.add('active')});
$$('.auth-tabs button').forEach(b=>b.onclick=()=>{const signup=b.dataset.auth==='signup';$$('.auth-tabs button').forEach(x=>x.classList.toggle('active',x===b));$$('.signup-only').forEach(x=>x.classList.toggle('hidden',!signup));$('#authTitle').textContent=signup?'הצטרפו ליוצרים':'ברוכים הבאים';$('#authText').textContent=signup?'פתחו חשבון, התחילו ליצור ובנו מוניטין.':'חזרו ליצירות, ליוצרים ולסטודיו שלכם.';$('#authSubmit').textContent=signup?'פתיחת חשבון':'כניסה'});
$('#authSubmit').onclick=()=>{const signup=$('.auth-tabs button.active').dataset.auth==='signup',name=$('#nameInput').value.trim(),email=$('#emailInput').value.trim(),pass=$('#passwordInput').value;if((signup&&!name)||!email||pass.length<4){toast('מלאו את הפרטים הנדרשים');return}store.user={name:signup?name:(email.split('@')[0]),email};setRep(rep());closeModal('authModal');renderUser();toast(signup?'החשבון נפתח בהצלחה 🎉':'נכנסתם בהצלחה');};
$('#generateBtn').onclick=()=>{if(!$('#prompt').value.trim()){toast('כתבו רעיון ליצירה');return}const type=$('.type-switch button.active').dataset.type;store.custom.unshift({type,title:$('#prompt').value.trim().slice(0,34)+( $('#prompt').value.trim().length>34?'…':''),author:store.user.name,initial:store.user.name.charAt(0),views:0,rep:rep(),thumb:type==='video'?'two':'three'});setRep(rep()+2);persist();renderFeed();closeModal('generatorModal');toast('היצירה נשלחה לבדיקה ידנית. +2 מוניטין על תרומה לקהילה');$('#prompt').value=''};
$('#fileInput').onchange=e=>{const f=e.target.files[0];if(f)$('#fileName').textContent=f.name};
$('#uploadBtn').onclick=()=>{if(!ensureUser('להעלות יצירה'))return;const f=$('#fileInput').files[0],title=$('#uploadTitle').value.trim();if(!f||!title){toast('בחרו קובץ והוסיפו שם');return}store.custom.unshift({type:f.type.startsWith('video')?'video':'image',title,author:store.user.name,initial:store.user.name.charAt(0),views:0,rep:rep(),thumb:'four',status:'review'});setRep(rep()+1);persist();renderFeed();closeModal('uploadModal');toast('הקובץ עלה ונכנס לתור בדיקה.');};
$('#searchBtn').onclick=()=>{$('#searchDrawer').classList.add('open');$('#searchInput').focus()};$('#closeSearch').onclick=()=>$('#searchDrawer').classList.remove('open');$('#searchInput').oninput=e=>renderFeed('all',e.target.value.trim());
renderFeed();renderCreators();renderLeaders();renderUser();
