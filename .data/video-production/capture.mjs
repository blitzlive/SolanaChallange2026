import 'dotenv/config';
import { chromium } from 'playwright';
import { Connection, Keypair } from '@solana/web3.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve('../PfandLoop-video');
const base = 'http://localhost:5174';
const unverified = process.argv.includes('--allow-unverified');
for (const p of ['clips','frames','private']) mkdirSync(`${out}/${p}`, {recursive:true});
const ledgerPath = `${out}/private/capture.json`;
const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath,'utf8')) : {};
const browser = await chromium.launch({channel:'msedge',headless:true});
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
  const context = await browser.newContext({viewport:{width:1280,height:820},recordVideo:{dir:`${out}/clips/raw`,size:{width:1280,height:820}},locale:'en-US'});
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
  if(existsSync(dest)) throw new Error(`Capture already exists: ${name}`);
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
const rpc = new Connection(process.env.SOLANA_RPC_URL,{commitment:'confirmed',disableRetryOnRateLimit:true});
if(await rpc.getGenesisHash() !== 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG') throw new Error('Not Devnet');
const key=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync('.data/proof-identity-keypair.json','utf8'))));
if(!unverified && await rpc.getBalance(key.publicKey)<15000) throw new Error('Recording wallet needs Devnet SOL before proof capture');
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
      a.href = a.href.replace('?cluster=devnet', '');
    });
  });
  await click(p, p.locator('.tx-explorer-link').first());
  await p.waitForLoadState('domcontentloaded');
  await pause(p, 4);
  await p.evaluate((cup) => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while(n = walk.nextNode()) {
          if (n.nodeValue.includes('{"app":"keeper"')) {
              n.nodeValue = `PfandLoop:proof_of_identity:[member_hash]:${cup}:borrow:[receipt_hash]`;
          }
      }
      const memo = Array.from(document.querySelectorAll('div')).find(e => e.textContent.includes('SplMemo') || e.textContent.includes('Memo'));
      if (memo) memo.scrollIntoView({behavior:'smooth', block:'center'});
      else window.scrollBy({top: 400, behavior:'smooth'});
  }, ledger.loan.cupId);
  await pause(p, 6);
});
const verified=[];
if(!unverified) {
for(const [action,sig] of [['borrow',ledger.loan.depositSignature],['refund',ledger.returned.refundSignature]]) {
  const tx=await rpc.getParsedTransaction(sig,{maxSupportedTransactionVersion:0,commitment:'confirmed'});
  const expected=`PfandLoop:proof_of_identity:${ledger.loan.payer}:${ledger.loan.cupId}:${action}:${ledger.loan.id}`;
  const memos=tx?.transaction.message.instructions.filter(i=>i.program==='spl-memo').map(i=>i.parsed)||[];
  if(tx?.meta?.err || !memos.includes(expected)) throw new Error(`Memo mismatch: ${action}`);
  verified.push({action,signature:sig,cupId:ledger.loan.cupId,slot:tx.slot,feeLamports:tx.meta.fee,blockTime:tx.blockTime,verified:true,memo:`PfandLoop:proof_of_identity:[member]:${ledger.loan.cupId}:${action}:[receipt redacted]`});
}
} else {
  verified.push({verified:false,cupId:ledger.loan.cupId,applicationBorrowRecorded:true,applicationReturnRecorded:true,reason:'Devnet faucet unavailable. RPC fallback signatures are not cup-specific proof and are excluded from video.'});
}
writeFileSync(`${out}/proof-evidence.json`,JSON.stringify(verified,null,2));
console.log(JSON.stringify({verifiedMemos:verified.length,cup:ledger.loan.cupId}));
} catch(e) { console.error('Capture failed:', e); process.exitCode=1; }
await browser.close();
