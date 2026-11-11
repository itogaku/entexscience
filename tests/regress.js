// 回帰テスト（中学理科プリント index.html）
// 使い方: node tests/regress.js [index.html のパス]   （全部通れば終了コード 0）
// 答えの漏れの確認済み一覧（tests/leak_ok.json）を今の結果で作り直すときは LEAK_SAVE=1 をつけて流す
// Playwright は require('playwright') か、環境変数 PLAYWRIGHT のパス、または /opt/node-tools/node_modules/playwright を使う
const path=require('path');
let pw;for(const m of [process.env.PLAYWRIGHT,'playwright','/opt/node-tools/node_modules/playwright'].filter(Boolean)){try{pw=require(m);break;}catch(e){}}
if(!pw){console.error('playwright が見つかりません');process.exit(2);}
const FILE='file://'+path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
const results=[];
const BAD_JS=`(s=>{s=String(s);const m=s.match(/undefined|NaN|\\$\\{|\\[object Object\\]|\\[\\[\\d+\\]\\]|=>|function\\s*\\(/);return m?m[0]:'';})`;

(async()=>{
  const browser=await pw.chromium.launch();
  const ctx=await browser.newContext({viewport:{width:1100,height:1400}});
  let page,errs=[];
  async function open(){page=await ctx.newPage();errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/net::|Failed to load resource/.test(m.text()))errs.push('console: '+m.text());});
    await page.route(/^https?:/,r=>r.abort());const t0=Date.now();await page.goto(FILE,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof st!=='undefined'&&typeof render==='function');await page.waitForTimeout(500);return Date.now()-t0;}
  async function check(name,fn){const t0=Date.now();let ok=false,detail='';const e0=errs.length;
    try{const r=await fn();ok=r.ok!==false;detail=r.detail||'';}catch(e){ok=false;detail='例外: '+e.message.split('\n')[0];}
    const ne=errs.slice(e0);if(ne.length){ok=false;detail+=` ／ ページのエラー ${ne.length}件: ${ne.slice(0,3).join(' | ')}`;}
    results.push({name,ok,detail,ms:Date.now()-t0});console.log(`${ok?'OK  ':'NG  '}${name}（${((Date.now()-t0)/1000).toFixed(1)}秒）${detail?'　'+detail:''}`);}
  const ev=(f,a)=>page.evaluate(f,a);
  const clean=async()=>{await ev(()=>{localStorage.clear();});await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(500);};

  // 1 読み込み
  await check('読み込み（エラーなし・5秒以内）',async()=>{const ms=await open();await clean();return {ok:ms<5000,detail:`${ms} ms`};});

  // 2 全単元 × レベル × seed で大問をつくる
  await check('全単元の大問の生成（元の単元・全レベル・10 seed）',async()=>{
    const r=await ev(BAD=>{const bad=eval(BAD);const out=[];let n=0,nq=0;
      for(const u of UNITS)for(const lv of ['basic','test','std','adv']){let ok=false;try{ok=lvOK0(u.id,lv);}catch(e){}if(!ok)continue;
        for(const s of [11,7930,123457,5,77,901,4242,31337,60001,999983]){let g;try{g=genAt0(u.id,lv,s);}catch(e){out.push(`${u.id}/${lv}/${s}: 例外 ${e.message}`);continue;}n++;
          if(!g||!g.qs||!g.qs.length){out.push(`${u.id}/${lv}/${s}: 小問なし`);continue;}
          const b0=bad((g.lead||'')+(g.body||''));if(b0)out.push(`${u.id}/${lv}/${s}: 本文に ${b0}`);
          g.qs.forEach((q,j)=>{nq++;if(!q||q.q==null||q.a==null||String(q.q).trim()===''||String(q.a).trim()==='')out.push(`${u.id}/${lv}/${s}: (${j+1}) 問いか答えが空`);
            else{const b=bad(q.q)||bad(q.a)||bad(q.e||'');if(b)out.push(`${u.id}/${lv}/${s}: (${j+1}) に ${b}`);}});}}
      return {n,nq,out};},BAD_JS);
    return {ok:!r.out.length,detail:`大問 ${r.n}・小問 ${r.nq}${r.out.length?'　問題 '+r.out.length+'件: '+r.out.slice(0,8).join(' ／ '):''}`};});

  // 3 統合した単元（学校・入試の見え方）
  await check('統合単元の生成（学校・入試の見え方）',async()=>{
    const r=await ev(()=>{const out=[];let n=0;const keep=st.purpose;
      for(const v of ['school','exam']){umView(v);const lvs=v==='school'?['basic','test']:['std','adv'];
        for(const f of FIELDS)for(const t of THEMES[f])for(const id of t[1]){for(const lv of lvs){if(!lvOK(id,lv))continue;for(const s of [3,99]){n++;try{const g=genAt(id,lv,s);if(!g||!g.qs||!g.qs.length)out.push(`${v}/${id}/${lv}: 小問なし`);}catch(e){out.push(`${v}/${id}/${lv}: 例外 ${e.message}`);}}}}}
      umView(keep);return {n,out};});
    return {ok:!r.out.length,detail:`${r.n}回${r.out.length?'　'+r.out.slice(0,8).join(' ／ '):''}`};});

  // 4 理解プリントのデータの形
  await check('理解プリントのデータの形（入試理解・定期理解・なぜ？・クイズ）',async()=>{
    const r=await ev(()=>{cpApplyPatches();const out=[];let n=0;const S=x=>typeof x==='string'&&x.trim()!=='';
      for(const c of CONCEPTS){n++;
        for(const [nm,X] of [['xk',c.xk],['tk',c.tk]]){if(!X){out.push(`${c.id}: ${nm} なし`);continue;}
          (X.quick||[]).forEach((q,k)=>{if(!S(q[0])||!S(String(q[1])))out.push(`${c.id}.${nm}.quick${k}`);});
          (X.types||[]).forEach((T,k)=>{if(!S(T.t)||!S(T.q))out.push(`${c.id}.${nm}.types${k}: 題か例題がない`);if(T.chk){const nb=new Set((JSON.stringify(T.chk.steps||[])+T.chk.q).match(/\[\[\d+\]\]/g)||[]).size;if(nb!==(T.chk.ans||[]).length)out.push(`${c.id}.${nm}.types${k}: 空欄${nb}と答え${(T.chk.ans||[]).length}の数がちがう`);}});
          (X.drill||[]).forEach((d,k)=>{if(!(d.sub||[]).length)out.push(`${c.id}.${nm}.drill${k}: 小問なし`);(d.sub||[]).forEach((s,m)=>{if(!S(s.q)||s.a==null||String(s.a)==='')out.push(`${c.id}.${nm}.drill${k}.${m}`);});});
          (X.chunks||[]).forEach((ch,k)=>{if(ch.ex&&(ch.ex.steps||[]).some(s=>!S(s.q)||s.a==null))out.push(`${c.id}.${nm}.chunk${k}.ex`);});}
        if(!(c.nq||[]).length)out.push(`${c.id}: なぜ？なし`);(c.nq||[]).forEach((x,k)=>{if(!S(x.q)||!S(x.a))out.push(`${c.id}.nq${k}`);});
        if(!c.qz||!(c.qz.steps||[]).length)out.push(`${c.id}: クイズなし`);else c.qz.steps.forEach((x,k)=>{if(!S(x.q)||x.a==null)out.push(`${c.id}.qz${k}`);});
        if(typeof XKHB!=='undefined'&&!(XKHB[c.id]||[]).length)out.push(`${c.id}: 本番形式の大問なし`);}
      return {n,out};});
    return {ok:!r.out.length,detail:`${r.n}項目${r.out.length?'　'+r.out.length+'件: '+r.out.slice(0,8).join(' ／ '):''}`};});

  // 5 理解プリントの全形式を表示
  await check('理解プリントの全形式の表示（学校・入試、短め・全部）',async()=>{
    const r=await ev(BAD=>{const bad=eval(BAD);const out=[];let n=0;
      const run=(pu,cm,xl)=>{st.purpose=pu;umView(pu);st.kind='c';st.field='ミックス';st.cskip=new Set();st.crm=new Set();st.uimp=0;st.cmode=cm;st.xlen=xl;st.xtypes=true;render();
        const sh=document.getElementById('sheet');const h=sh.innerHTML;n++;const items=sh.querySelectorAll('section.dai').length;
        if(items<62)out.push(`${pu}/${cm}/${xl}: 大問の枠が${items}`);const b=bad(h.replace(/<script[\s\S]*?<\/script>/g,''));if(b)out.push(`${pu}/${cm}/${xl}: ${b}`);
        if(!sh.querySelector('.anssheet'))out.push(`${pu}/${cm}/${xl}: 解答ページなし`);};
      for(const cm of ['read','write','fill','tk','nq','qz'])run('school',cm,'short');run('school','tk','full');
      for(const cm of ['read','write','fill','xk','hb','nq','qz'])run('exam',cm,'short');run('exam','xk','full');run('exam','hb','full');
      st.xhb=true;run('exam','xk','short');st.xhb=false;
      return {n,out};},BAD_JS);
    return {ok:!r.out.length,detail:`${r.n}通り${r.out.length?'　'+r.out.slice(0,8).join(' ／ '):''}`};});
  await clean();

  // 6 画面からの操作：目的・種類・分野・レベルごとにつくる
  await check('画面の操作でプリントをつくる（全種類・全分野）',async()=>{
    const out=[];let n=0;const bad=await ev(BAD=>{window.__bad=eval(BAD);return 1;},BAD_JS);
    const make=async(label)=>{await page.click('#genBtn');await page.waitForTimeout(150);n++;
      const r=await ev(()=>{const sh=document.getElementById('sheet');return {h:sh.innerText.length,b:__bad(sh.innerHTML),e:!!sh.querySelector('.empty')};});
      if(r.e||r.h<50)out.push(`${label}: 中身なし`);if(r.b)out.push(`${label}: ${r.b}`);};
    for(const pu of ['school','exam']){await page.click(`#purpose [data-purpose="${pu}"]`);await page.waitForTimeout(150);
      const kinds=await ev(()=>[...document.querySelectorAll('#kind [data-kind]')].map(b=>b.dataset.kind));
      for(const k of kinds){await page.click(`#kind [data-kind="${k}"]`);await page.waitForTimeout(150);
        const fields=await ev(()=>[...document.querySelectorAll('#fields button')].map(b=>b.textContent));
        for(const f of fields){await page.click(`#fields button:text-is("${f}")`);await page.waitForTimeout(100);
          if(k==='q'){const lvs=await ev(()=>[...document.querySelectorAll('#level [data-lv],#level button')].filter(b=>!b.hidden).map(b=>b.dataset.lv||b.textContent));
            if(lvs.length&&pu==='school'){for(const lv of lvs){await ev(lv=>{const b=[...document.querySelectorAll('#level button')].find(x=>(x.dataset.lv||x.textContent)===lv);if(b)b.click();},lv);await make(`${pu}/${k}/${f}/${lv}`);}}
            else await make(`${pu}/${k}/${f}`);}
          else await make(`${pu}/${k}/${f}`);}}}
    return {ok:!out.length,detail:`${n}枚${out.length?'　'+out.slice(0,8).join(' ／ '):''}`};});
  await clean();

  // 7 本番形式（入試・9題）
  await check('入試問題の本番形式（9題・小問4問・3秒以内）',async()=>{
    await page.click('#purpose [data-purpose="exam"]');await page.click('#kind [data-kind="q"]');await page.waitForTimeout(200);
    const on=await ev(()=>st.honban);if(!on)await page.click('[data-honban]');const out=[];let mx=0;
    for(let i=0;i<5;i++){const t0=Date.now();await page.click('#genBtn');await page.waitForTimeout(100);mx=Math.max(mx,Date.now()-t0);
      const r=await ev(()=>{const S=[...document.querySelectorAll('#sheet section.dai')];return {n:S.length,q:S.map(s=>s.querySelectorAll('ol.qs>li').length),f:S.slice(1).map(s=>(s.querySelector('.dtag')||{}).textContent.split('・')[0])};});
      if(r.n!==9)out.push(`大問${r.n}`);if(r.q.some(x=>x!==4))out.push(`小問 ${r.q.join(',')}`);
      const cnt={};r.f.forEach(f=>{const k=['物理','化学','生物','地学'].find(x=>f.includes(x))||f;cnt[k]=(cnt[k]||0)+1;});if(Object.values(cnt).some(v=>v!==2))out.push(`分野 ${JSON.stringify(cnt)}`);}
    return {ok:!out.length&&mx<3000,detail:`最長 ${mx} ms${out.length?'　'+[...new Set(out)].slice(0,5).join(' ／ '):''}`};});
  await clean();

  // 8 問題プリントの操作（消す・元に戻す・作り直す・解答・番号で呼び出す）
  await check('問題プリントの操作（消す・作り直す・解答表示・番号で再現）',async()=>{
    const out=[];await page.click('#purpose [data-purpose="school"]');await page.click('#kind [data-kind="q"]');await page.click('#fields button:text-is("物理")');await page.click('#count [data-n="3"]');await page.click('#genBtn');await page.waitForTimeout(200);
    const n0=await ev(()=>document.querySelectorAll('#sheet [data-reroll]').length);if(n0!==3)out.push(`大問${n0}`);/* 関連する小問集合が1つ付くことがある */
    const q0=await ev(()=>document.querySelectorAll('#sheet ol.qs>li').length);
    await page.click('#sheet [data-rmq="0-0"]');await page.waitForTimeout(150);const q1=await ev(()=>document.querySelectorAll('#sheet ol.qs>li').length);if(q1!==q0-1)out.push('問題を消せない');
    await page.click('#sheet [data-undo]');await page.waitForTimeout(150);const q2=await ev(()=>document.querySelectorAll('#sheet ol.qs>li').length);if(q2!==q0)out.push('元に戻せない');
    const d0=await ev(()=>document.querySelectorAll('#sheet [data-rmd]').length);await page.click('#sheet [data-rmd="1"]');await page.waitForTimeout(150);if(await ev(()=>document.querySelectorAll('#sheet [data-rmd]').length)!==d0-1)out.push('大問を消せない');
    await page.click('#sheet [data-undo]');await page.waitForTimeout(150);
    const lead0=await ev(()=>document.querySelector('#sheet section.dai .lead').innerHTML);await page.click('#sheet [data-reroll="0"]');await page.waitForTimeout(150);
    const lead1=await ev(()=>document.querySelector('#sheet section.dai .lead').innerHTML+document.querySelector('#sheet section.dai ol.qs').innerHTML);if(lead1.startsWith(lead0)&&lead1.length===lead0.length)out.push('作り直しで変わらない');
    await page.click('#ansBtn');if(!(await ev(()=>document.body.classList.contains('show-ans'))))out.push('解答を表示できない');await page.click('#ansBtn');
    await page.click('#genBtn');await page.waitForTimeout(150);const code=await ev(()=>document.getElementById('curCode').textContent);const txt=await ev(()=>document.getElementById('sheet').innerText);
    await page.click('#genBtn');await page.waitForTimeout(150);await ev(code=>{document.getElementById('codeIn').value=code;document.getElementById('codeForm').requestSubmit();},code);await page.waitForTimeout(200);
    const txt2=await ev(()=>document.getElementById('sheet').innerText);if(txt2!==txt)out.push('番号で同じプリントにならない');
    return {ok:!out.length,detail:out.join(' ／ ')};});
  await clean();

  // 9 理解プリントの操作（消す・短め・典型・本番形式）
  await check('理解プリントの操作（消す・元に戻す・分量・典型・本番形式）',async()=>{
    const out=[];await page.click('#purpose [data-purpose="exam"]');await page.click('#kind [data-kind="c"]');await page.click('#fields button:text-is("物理")');await page.waitForTimeout(200);
    for(const cm of ['read','write','fill','xk','hb','nq','qz']){await page.click(`#cmode [data-cmode="${cm}"]`);await page.waitForTimeout(200);
      const a=await ev(()=>[document.querySelectorAll('#sheet [data-crm]').length,document.getElementById('sheet').innerText.length]);if(!a[0]){out.push(`${cm}: 消すボタンなし`);continue;}
      await page.click('#sheet [data-crm]');await page.waitForTimeout(150);const b=await ev(()=>document.querySelectorAll('#sheet [data-crm]').length);if(b>=a[0]&&cm!=='xk'&&cm!=='hb')out.push(`${cm}: 消えない`);
      await page.click('#sheet [data-crmundo]');await page.waitForTimeout(150);}
    await page.click('#cmode [data-cmode="xk"]');await page.waitForTimeout(150);
    const cnt=()=>ev(()=>[document.querySelectorAll('#sheet .xk-ty').length,document.querySelectorAll('#sheet .xk-dr').length,document.querySelectorAll('#sheet .xk-hb').length]);
    const s1=await cnt();await page.click('[data-xlen="full"]');await page.waitForTimeout(200);const s2=await cnt();if(!(s2[0]>s1[0]&&s2[1]>s1[1]))out.push(`全部で増えない ${s1}→${s2}`);
    await page.click('[data-xtypes="false"]');await page.waitForTimeout(150);if((await cnt())[0])out.push('典型を外せない');await page.click('[data-xtypes="true"]');
    await page.click('[data-xhb="true"]');await page.waitForTimeout(200);if(!(await cnt())[2])out.push('本番形式を入れられない');await page.click('[data-xhb="false"]');await page.click('[data-xlen="short"]');
    await page.click('#purpose [data-purpose="school"]');await page.waitForTimeout(150);await page.click('#cmode [data-cmode="tk"]');await page.waitForTimeout(150);if(!(await ev(()=>document.querySelectorAll('#sheet .xk-ex').length)))out.push('定期理解が出ない');
    return {ok:!out.length,detail:out.join(' ／ ')};});
  await clean();

  // 10 苦手チェック
  await check('苦手チェック（問数・チェック → 理解・定期・問題プリント）',async()=>{
    const out=[];await page.click('#kind [data-kind="d"]');await page.click('#fields button:text-is("化学")');await page.waitForTimeout(200);
    const n2=await ev(()=>document.querySelectorAll('#sheet .qa-list li').length);await page.click('#sheet [data-dn="1"]');await page.waitForTimeout(150);
    const n1=await ev(()=>[document.querySelectorAll('#sheet .qa-list li').length,document.querySelectorAll('#sheet .qa-t').length]);if(!(n1[0]===n1[1]&&n2>=n1[0]*2-2))out.push(`問数 ${n2}/${n1}`);
    const cbs=await page.$$('#sheet [data-weak]');await cbs[0].check();await cbs[2].check();
    for(const go of ['c','t','q']){await page.click(`#sheet [data-dgo="${go}"]`);await page.waitForTimeout(300);
      const r=await ev(()=>[st.kind,document.querySelectorAll('#sheet section.dai').length,document.querySelectorAll('#sheet .cp-t').length]);
      if(r[0]!==go||!r[1])out.push(`${go}: ${r}`);if(go==='c'&&r[2]!==2)out.push(`理解プリントの項目が${r[2]}`);
      await page.click('#kind [data-kind="d"]');await page.waitForTimeout(200);}
    const back=await ev(()=>document.querySelectorAll('#sheet .qa-t').length);if(back!==n1[1])out.push(`苦手チェックに戻ると項目${back}`);
    return {ok:!out.length,detail:out.join(' ／ ')};});
  await clean();

  // 11 重要度で絞る
  await check('重要度で絞る（すべて > ★★以上 > ★★★だけ）',async()=>{
    const out=[];for(const pu of ['school','exam']){await page.click(`#purpose [data-purpose="${pu}"]`);
      for(const k of ['c','q']){await page.click(`#kind [data-kind="${k}"]`);await page.click('#fields button:text-is("ミックス")');await page.waitForTimeout(150);const ns=[];
        for(const v of [0,2,3]){await page.click(`#uimpRow [data-uimp="${v}"]`);await page.waitForTimeout(150);ns.push(await ev(k=>k==='c'?cTopics().length:FIELDS.flatMap(f=>THEMES[f].flatMap(t=>t[1])).filter(gOK).length,k));}
        if(!(ns[0]>ns[1]&&ns[1]>ns[2]&&ns[2]>0))out.push(`${pu}/${k}: ${ns.join('>')}`);}}
    await page.click('#uimpRow [data-uimp="0"]');return {ok:!out.length,detail:out.join(' ／ ')};});
  await clean();

  // 12 問題を見て選ぶ
  await check('問題を見て選ぶ（種類ごとの表示・もっと見る・プリントに入れる）',async()=>{
    const out=[];await page.click('#kind [data-kind="q"]');await page.click('#fields button:text-is("生物")');await page.click('#browseBtn');await page.waitForTimeout(300);
    const id=await ev(()=>document.querySelector('#browse details.bu').dataset.bid);await ev(id=>{document.querySelector(`#browse details[data-bid="${id}"]`).open=true;},id);await page.waitForTimeout(800);
    const v0=await ev(id=>document.querySelectorAll(`#pv_${id} .pv-v`).length,id);if(!v0)out.push('例が出ない');
    await page.click(`#pv_${id} .pv-more`);await page.waitForTimeout(500);const v1=await ev(id=>document.querySelectorAll(`#pv_${id} .pv-v`).length,id);if(v1<v0)out.push('もっと見るで減った');
    await page.click(`#pv_${id} [data-padd2]`);await page.waitForTimeout(300);await page.click('#browse [data-pick-on]');await page.waitForTimeout(300);
    const r=await ev(()=>[st.usePick,st.picked.length,document.querySelectorAll('#sheet section.dai').length]);if(!r[0]||r[1]!==1||!r[2])out.push(`プリント ${r}`);
    const empty=await ev(()=>{const o=[];for(const f of FIELDS)for(const t of THEMES[f])for(const id of t[1].filter(gOK0))for(const m of pvMembers(id))if(!pvVariants(id,m).length)o.push(m);return o;});
    if(empty.length)out.push(`表示できない種類 ${empty.slice(0,5)}`);
    return {ok:!out.length,detail:`例 ${v0}→${v1}　`+out.join(' ／ ')};});
  await clean();

  // 14 答えの語が問題文に書いてしまっていないか（選択肢を並べた問い・表や図から選ぶ問いは除く。確認済みのものは tests/leak_ok.json）
  await check('答えの漏れ（答えの語が問いの文に入っていない）',async()=>{
    let okList=[];try{okList=JSON.parse(require('fs').readFileSync(path.join(__dirname,'leak_ok.json'),'utf8'));}catch(e){}
    const r=await ev(()=>{cpApplyPatches();
      const T=x=>String(x==null?'':x).replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,'');
      const term=a=>{a=T(a).replace(/^[(（]例[)）]/,'');if(/^[ア-カ]/.test(a)&&(a.length===1||/^[ア-カ][\s　]/.test(String(a))))return '';a=a.replace(/[。．]$/,'');
        if(a.length<2||a.length>10||/[0-9０-９]/.test(a)||/[、，・／\/（）()→：:＝=]/.test(a)||/^[ぁ-ん]+$/.test(a))return '';return a;};
      const choiceQ=q=>{const t=T(q);return /[ア-エ][\s　]|語群|から選|から一つ|からすべて|のうち|どちら|組み合わせ|〔.*〕|［.*］|の(どれ|いずれ)|（[^）]*・[^）]*）|\(.*・.*\)|か[、，]?.*か[。？?]|？.*？|か(どう|、)/.test(t)||/表|図/.test(t)&&/(結果|まとめ|次の)/.test(t);};
      const out=new Set();let n=0;const test=(w,q,a)=>{n++;const t=term(a);if(!t||choiceQ(q))return;if(T(q).includes(t))out.add(`${w}|${t}`);};
      for(const u of UNITS)for(const lv of ['basic','test','std','adv']){if(!lvOK0(u.id,lv))continue;for(const s of [11,7930,123457]){let g;try{g=genAt0(u.id,lv,s);}catch(e){continue;}(g.qs||[]).forEach(q=>test(`${u.id}/${lv}`,q.q,q.a));}}
      for(const c of CONCEPTS){(CP_QA[c.id]||[]).forEach((x,k)=>test(`${c.id}.qa${k}`,Array.isArray(x)?x[0]:x.q,Array.isArray(x)?x[1]:x.a));
        for(const X of [c.xk,c.tk])if(X)(X.quick||[]).forEach((x,k)=>test(`${c.id}.quick${k}`,x[0],x[1]));
        (c.secs||[]).forEach((x,k)=>[...(x.q||[]),...(x.q2||[]),...(x.qx||[])].forEach((o,m)=>{if(!(x.bank&&x.bank.length))test(`${c.id}.sec${k}.${m}`,o.q,o.a);}));
        if(c.qz)(c.qz.steps||[]).forEach((x,k)=>{if(!(x.ch&&x.ch.length))test(`${c.id}.qz${k}`,x.q,x.a);});}
      return {n,out:[...out]};});
    const nw=r.out.filter(x=>!okList.includes(x));
    if(process.env.LEAK_SAVE){require('fs').writeFileSync(path.join(__dirname,'leak_ok.json'),JSON.stringify(r.out.sort(),null,1));}
    return {ok:!nw.length,detail:`${r.n}問を点検・確認済み ${r.out.length-nw.length}件${nw.length?'　新しい漏れ '+nw.length+'件: '+nw.slice(0,8).join(' ／ '):''}`};});

  // 15 印刷のページ数（A4、分野ごと）。前より大きく増えていないか
  await check('印刷のページ数（入試理解・定期理解・本番形式の大問・問題プリント）',async()=>{
    const pages=async()=>{const pdf=await page.pdf({format:'A4'});return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;};
    const lim={xk:9.5,tk:9.5,hb:4.5};const out=[],rows=[];
    for(const [pu,cm] of [['exam','xk'],['school','tk'],['exam','hb']]){await page.click(`#purpose [data-purpose="${pu}"]`);await page.click('#kind [data-kind="c"]');await page.click(`#cmode [data-cmode="${cm}"]`);await page.waitForTimeout(150);
      let tp=0,ti=0;for(const f of ['物理','化学','生物','地学']){await page.click(`#fields button:text-is("${f}")`);await page.waitForTimeout(300);const ni=await ev(()=>cTopics().filter(c=>!st.cskip.has(c.id)).length);tp+=await pages();ti+=ni;}
      const av=tp/ti;rows.push(`${cm} ${av.toFixed(1)}`);if(av>lim[cm])out.push(`${cm} が1項目あたり ${av.toFixed(1)}ページ（上限 ${lim[cm]}）`);}
    await page.click('#purpose [data-purpose="school"]');await page.click('#kind [data-kind="q"]');await page.click('#fields button:text-is("物理")');await page.click('#count [data-n="3"]');
    let mq=0,ma=0;const pm=v=>ev(v=>document.querySelector(`#pmode [data-pm="${v}"]`).click(),v);
    for(let i=0;i<5;i++){await page.click('#genBtn');await page.waitForTimeout(150);await pm('none');await page.waitForTimeout(80);mq=Math.max(mq,await pages());await pm('end');await page.waitForTimeout(80);ma=Math.max(ma,await pages());}
    rows.push(`問題プリント3題 問題だけ最大${mq}・解答こみ最大${ma}`);if(mq>7)out.push(`問題プリント3題の問題だけで${mq}ページ（上限7）`);if(ma>12)out.push(`問題プリント3題が解答こみで${ma}ページ（上限12）`);
    return {ok:!out.length,detail:`1項目あたり ${rows.join('・')}ページ${out.length?'　'+out.join(' ／ '):''}`};});
  await clean();

  // 13 保存して読み直す
  await check('設定の保存と読み直し',async()=>{
    await page.click('#purpose [data-purpose="exam"]');await page.click('#kind [data-kind="c"]');await page.click('#cmode [data-cmode="xk"]');await page.click('[data-xlen="full"]');await page.click('#uimpRow [data-uimp="2"]');
    await ev(()=>{st.dn=3;st.weak=new Set(['cp_p_light']);save();});await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(500);
    const r=await ev(()=>[st.purpose,st.kind,st.cmode,st.xlen,st.uimp,st.dn,[...st.weak].join()]);
    return {ok:JSON.stringify(r)===JSON.stringify(['exam','c','xk','full',2,3,'cp_p_light']),detail:JSON.stringify(r)};});

  await browser.close();
  const ng=results.filter(r=>!r.ok);
  console.log(`\n${results.length}項目中 ${results.length-ng.length}項目 OK${ng.length?`、${ng.length}項目 NG：${ng.map(r=>r.name).join('、')}`:''}`);
  process.exit(ng.length?1:0);
})();
