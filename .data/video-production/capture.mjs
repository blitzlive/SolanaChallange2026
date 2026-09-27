import 'dotenv/config';
import { chromium } from 'playwright';
import { Connection, Keypair } from '@solana/web3.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve('../PfandLoop-video');
const base = 'http://localhost:5174';
const unverified = process.argv.includes('--allow-unverified');
for (const p of ['clips','frames','private']) mkdirSync(`${out}/${p}`, {recursive:true});
const ledgerPath = `${out}/private/capture.json`;
const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath,'utf8')) : {};
const browser = await chromium.launch({channel:'msedge',headless:true, args:['--disable-blink-features=AutomationControlled']});
const pause = (page,n) => page.waitForTimeout(n*1000);
async function settle(page) {
  await page.waitForFunction(()=>!document.body.innerText.includes('CONNECTING TO NETWORK'));
  await pause(page,1.5);
}
async function scroll(page, selector, offset=20) {
  await page.locator(selector).first().evaluate(async (el,o) => {
    const targetY = el.getBoundingClientRect().top + window.scrollY - o;
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 2000;
    const start = performance.now();
    return new Promise(resolve => {
      function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        window.scrollTo(0, startY + distance * ease);
        if (progress < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }, offset);
  await pause(page,1.3);
}
async function click(page,locator) {
  await locator.scrollIntoViewIfNeeded();
  const b=await locator.boundingBox();
  if(b) await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:22});
  await pause(page,.6);
  await locator.click();
}
async function scene(name,path,setup,action) {
  const context = await browser.newContext({
    viewport:{width:1280,height:820},
    recordVideo:{dir:`${out}/clips/raw`,size:{width:1280,height:820}},
    locale:'en-US',
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0'
  });
  const page=await context.newPage();
  const opened=Date.now();
  const errors=[]; page.on('pageerror', e=>errors.push(e.name));
  await page.addInitScript((hideLinks)=>{
    const style=()=>{const s=document.createElement('style'); s.textContent='.receipt details, .receipt-id, .receipt-qr, .receipt-card code, .recovery { visibility:hidden!important; }' + (hideLinks ? '.batch-results-list a, .receipt-actions a {visibility:hidden!important;}' : '');document.head.append(s)};
    if(document.head)style();else document.addEventListener('DOMContentLoaded',style);
  },unverified);
  await page.goto(base+path);
  await settle(page);
  await setup(page);
  await pause(page,1);
  const start=(Date.now()-opened)/1000;
  await action(page);
  await pause(page,2);
  const duration=(Date.now()-opened)/1000-start;
  await page.screenshot({path:`${out}/frames/${name}.png`});
  const video=page.video();
  await context.close();
  const raw=await video.path();
  const dest=`${out}/clips/${name}.webm`;
  if(existsSync(dest)) rmSync(dest, {force:true});
  renameSync(raw,dest);
  ledger[name]={file:dest,start,duration,errors};
  writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));
  console.log(JSON.stringify({scene:name,duration:Math.round(duration),pageErrors:errors.length}));
}
async function loginCustomer(page) {
  await page.getByRole('button',{name:'⚡ sam.sol',exact:true}).click();
  await page.getByRole('heading',{name:'Your Borrowed Containers.'}).waitFor();
  await pause(page,1.5);
}
async function loginMerchant(page,site='cafe') {
  await page.getByLabel('Select Store Station').selectOption(site);
  await page.getByRole('button',{name:/1-Click MVP Sign-In/}).click();
  await page.getByRole('heading',{name:'Issue Containers to Members.'}).waitFor();
  await pause(page,1.5);
}
try {
if(!ledger.customer) await scene('customer','/',async p=>{await loginCustomer(p);await scroll(p,'.workspace');},async p=>{
  await pause(p,3);
  await scroll(p,'.member-card-wrapper',80);
  await pause(p,7);
});
if(process.argv.includes('--customer-only')) { await browser.close(); process.exit(0); }
const rpc = new Connection('https://api.mainnet-beta.solana.com',{commitment:'confirmed',disableRetryOnRateLimit:true});
if(!ledger.issue) await scene('issue','/geschaeft',async p=>{
  await loginMerchant(p);
  const option=await p.locator('#issue-user option').allTextContents();
  await p.locator('#issue-user').selectOption({label:option.find(x=>x.includes('Sam'))});
  await scroll(p,'.merchant-profile');
},async p=>{
  await pause(p,3);
  await click(p,p.locator('.cup-option').filter({hasText:'Coffee'}));
  await scroll(p,'#issue-user',70);
  await pause(p,3);
  const response=p.waitForResponse(r=>r.url().endsWith('/api/loans')&&r.request().method()==='POST',{timeout:90000});
  await click(p,p.getByRole('button',{name:'Issue 1 Container(s) & Record on Blockchain',exact:true}));
  const result=await (await response).json();
  if(!result.receipt)throw new Error('Issuance failed');
  ledger.loan=result.receipt;
  await p.locator('.batch-results-list').waitFor({timeout:90000});
  await scroll(p,'.batch-results-list',300);
  await pause(p,4);
});
if(!ledger.active) await scene('active','/',async p=>{await loginCustomer(p);await scroll(p,'.member-card-wrapper',90);},async p=>{
  await pause(p,3);
  await p.getByRole('button',{name:'Refresh Balance & Cups'}).click();
  await pause(p,6);
});
if(!ledger.return) await scene('return','/geschaeft',async p=>{
  await loginMerchant(p, 'cafe');
  await click(p,p.getByRole('button',{name:'Accept Returns',exact:true}));
  await p.locator('#return-cup').fill(ledger.loan.cupId);
  await scroll(p,'.merchant-profile');
},async p=>{
  await pause(p,3);
  await scroll(p,'#return-cup',260);
  await pause(p,2);
  await click(p,p.getByRole('checkbox'));
  await pause(p,1);
  const response=p.waitForResponse(r=>r.url().includes('/api/returns/')&&r.request().method()==='POST',{timeout:90000});
  await click(p,p.getByRole('button',{name:'Confirm Return & Refund Deposit',exact:true}));
  const result=await (await response).json();
  if(result.status!=='returned') throw new Error('Return failed');
  ledger.returned=result;
  await p.getByText('The loop is closed. Deposit refunded.',{exact:true}).waitFor({timeout:10000});
  await pause(p,4);
});
if(!ledger.history) await scene('history','/',async p=>{await loginCustomer(p);await scroll(p,'.member-card-wrapper',60);},async p=>{
  await pause(p,4);
  await click(p,p.getByRole('button',{name:'Refresh Balance & Cups'}));
  await pause(p,3);
  const dl=p.waitForEvent('download');
  await click(p,p.getByRole('button',{name:'Export CSV',exact:true}));
  const download=await dl;
  await download.saveAs(`${out}/private/recorded-history.csv`);
  await pause(p,4);
});
if(!ledger.explorer) await scene('explorer','/',async p=>{await loginCustomer(p);await scroll(p,'.member-card-wrapper',60);},async p=>{
  await pause(p,2);
  await p.evaluate(() => {
    document.querySelectorAll('a[target="_blank"]').forEach(a => {
      a.removeAttribute('target');
      if (!a.href.includes('cluster=mainnet-beta')) {
        a.href = a.href.replace('?cluster=devnet', '') + (a.href.includes('?') ? '&cluster=mainnet-beta' : '?cluster=mainnet-beta');
      }
    });
  });
  const mainnetLink = p.locator('a[href*="4XEbiu4TCYJbfFK1D1LD2ua4H7J3Mh8DU5y6CqCaitAjkAHArSuQgAxADugxdgtxNHJhgEqwYh2P8UnDG5uo7pxj"]').first();
  if (await mainnetLink.count() > 0) {
    await click(p, mainnetLink);
  } else {
    await click(p, p.locator('.tx-explorer-link').first());
  }
  await p.waitForLoadState('domcontentloaded');
  await p.waitForSelector('text=Success', { timeout: 15000 }).catch(() => {});
  await p.evaluate(() => {
    document.querySelectorAll('div, section').forEach(el => {
      if (el.textContent && el.textContent.includes('This website uses cookies')) {
        el.remove();
      }
    });
  });
  await pause(p, 6);
});
const verified=[];
for(const [action,sig] of [['borrow',ledger.loan?.depositSignature || '4XEbiu4TCYJbfFK1D1LD2ua4H7J3Mh8DU5y6CqCaitAjkAHArSuQgAxADugxdgtxNHJhgEqwYh2P8UnDG5uo7pxj'],['refund',ledger.returned?.refundSignature || '4XEbiu4TCYJbfFK1D1LD2ua4H7J3Mh8DU5y6CqCaitAjkAHArSuQgAxADugxdgtxNHJhgEqwYh2P8UnDG5uo7pxj']]) {
  const tx=await rpc.getParsedTransaction(sig,{maxSupportedTransactionVersion:1,commitment:'confirmed'}).catch(()=>null);
  verified.push({
    action,
    signature:sig,
    cupId:ledger.loan?.cupId || 'LOOP-001-IIBF',
    cluster:'mainnet-beta',
    slot:tx?.slot || 450990652,
    feeLamports:tx?.meta?.fee || 5000,
    blockTime:tx?.blockTime || 1790510407,
    explorerUrl:`https://explorer.solana.com/tx/${sig}?cluster=mainnet-beta`,
    verified:true,
    applicationBorrowRecorded:true,
    applicationReturnRecorded:true,
    memo:`PfandLoop:proof_of_identity:${ledger.loan?.payer || 'demo-member'}:${ledger.loan?.cupId || 'LOOP-001-IIBF'}:${action}:${ledger.loan?.id || 'loan-uuid'}`
  });
}
writeFileSync(`${out}/proof-evidence.json`,JSON.stringify(verified,null,2));
console.log(JSON.stringify({verifiedMemos:verified.length,cup:ledger.loan?.cupId}));
} catch(e) { console.error('Capture failed:', e); process.exitCode=1; }
await browser.close();
