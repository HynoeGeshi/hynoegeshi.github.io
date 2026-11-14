const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const artifactDir = resolve(process.env.FLICKS_QA_DIR || resolve(root, '.qa-artifacts'));
await mkdir(artifactDir, { recursive: true });
const mime = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    await stat(file);
    res.writeHead(200, {'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_EXECUTABLE_PATH || undefined, args:['--disable-gpu']});
const page = await browser.newPage({viewport:{width:1280,height:900}});
const results = [];
await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({contentType:'text/javascript',body:'window.emailjs={init(){},async send(...args){window.testSends.push(args);if(window.testReject)throw new Error("Simulated provider rejection");return {status:200}}};'}));
await page.route('https://fonts.googleapis.com/**', route => route.fulfill({contentType:'text/css',body:''}));
await page.addInitScript(() => {window.testSends=[];window.testEvents=[];window.addEventListener('hynoe:analytics', e=>window.testEvents.push(e.detail));});
async function check(name, fn) {try {await fn(); results.push({name,pass:true});} catch(e) {results.push({name,pass:false,error:e.message});}}
async function start() {await page.goto(base+'/booking.html?service=Nightlife');await page.locator('[data-booking-step="service"]').waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();}
async function readyForContact() {await start();await page.locator('#dateRange').fill('November 20');await page.locator('#location').fill('Chicago');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.locator('#details').fill('Website QA, never sent.');await page.locator('#budgetNote').fill('500 dollars');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.locator('#name').fill('Website QA');await page.locator('#email').fill('qa@example.invalid');}
try {
  await check('Enter validates and advances only the current schedule step', async()=>{await start();await page.locator('#dateRange').fill('November 20');await page.locator('#location').fill('Chicago');await page.locator('#location').press('Enter');assert.equal(await page.locator('.booking-step.active').getAttribute('data-booking-step'),'vision');assert.equal(await page.evaluate(()=>testSends.length),0);});
  await check('Enter on contact reaches review without sending', async()=>{await readyForContact();await page.locator('#email').press('Enter');assert.equal(await page.locator('.booking-step.active').getAttribute('data-booking-step'),'review');assert.equal(await page.evaluate(()=>testSends.length),0);});
  await check('Review includes the budget that will be sent', async()=>{await readyForContact();await page.getByRole('button',{name:'Review Request',exact:true}).click();assert.equal(await page.locator('[data-review="budgetNote"]').count(),1);assert.equal(await page.locator('[data-review="budgetNote"]').textContent(),'500 dollars');});
  await check('Schedule errors focus and describe the first invalid field', async()=>{await start();await page.getByRole('button',{name:'Continue',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement.id),'dateRange');assert.equal(await page.locator('#dateRange').getAttribute('aria-invalid'),'true');const id=await page.locator('#dateRange').getAttribute('aria-describedby');assert.ok(id);assert.ok(await page.locator('#'+id).textContent());});
  await check('Preselected service does not lose start tracking after a schedule change',async()=>{await start();await page.locator('#dateRange').fill('November 20');await page.locator('#location').focus();await page.getByRole('button',{name:'Back',exact:true}).click();await page.locator('label[for="servicePortraits"]').click();assert.equal(await page.evaluate(()=>testEvents.filter(e=>e.name==='booking_start').length),1);});
  await check('Mobile editing clients can finish without a venue or a deadline', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/photo-editing-retouching.html');
    await page.locator('.service-hero').getByRole('link', { name: 'Start Editing Request', exact: true }).click();
    const next = page.locator('.booking-step.active [data-next]');
    await next.click();
    assert.equal(await page.locator('#location').isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'editingDeadline');
    await page.locator('#editingDeadline').press('Enter');
    await page.locator('#details').fill('Eight photos for a website. Please match color.');
    await next.click();
    await page.locator('#name').fill('Website QA');
    await page.locator('#email').fill('qa@example.invalid');
    await next.click();
    assert.equal(await page.locator('[data-review="location"]').isVisible(), false);
    assert.equal(await page.locator('[data-review="dateRange"]').textContent(), 'Flexible');
    const emailOption = page.locator('#bookingFallback');
    assert.equal(await emailOption.isVisible(), true);
    assert.equal(await page.evaluate(() => testSends.length), 0);
    const draftLink = emailOption.getByRole('link', { name: 'Open a prefilled email' });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'bookingReviewTitle');
    await page.keyboard.press('Tab');
    assert.equal(await draftLink.evaluate(link => document.activeElement === link), true);
    const draft = new URL(await draftLink.getAttribute('href'));
    assert.equal(draft.pathname, 'hynoe.flicks@gmail.com');
    assert.match(draft.searchParams.get('body'), /Eight photos for a website/);
    const requestText = page.locator('#bookingFallbackText');
    assert.equal(await requestText.isVisible(), false);
    await emailOption.getByText('Show text to copy', { exact: true }).press('Enter');
    assert.equal(await requestText.isVisible(), true);
    assert.equal(await requestText.inputValue(), draft.searchParams.get('body'));
    assert.equal(await page.evaluate(() => testSends.length), 0);
    assert.equal(await page.locator('#successPanel').isVisible(), false);
    await page.waitForTimeout(1850);
    await page.evaluate(() => window.testReject = true);
    await page.locator('#submitBooking').click();
    await page.locator('#submitStatus.error').waitFor();
    const fallback = await page.locator('#bookingFallbackText').inputValue();
    assert.match(fallback, /Delivery deadline: Flexible/);
    assert.match(fallback, /Eight photos for a website/);
    assert.doesNotMatch(fallback, /Location:/);
    await page.evaluate(() => window.testReject = false);
    await page.locator('#submitBooking').click();
    await page.locator('#successPanel.show').waitFor();
    const sends = await page.evaluate(() => testSends);
    assert.equal(sends.length, 2);
    assert.deepEqual(sends[0], sends[1]);
    assert.equal(sends[0][2].service, 'Editing Only');
    assert.equal(sends[0][2].date_range, 'Flexible');
    assert.equal(sends[0][2].location, '');
  });
  await check('Switching between editing and photography keeps timing answers separate', async () => {
    await start();
    const back = page.locator('.booking-step.active [data-back]');
    const next = page.locator('.booking-step.active [data-next]');
    await page.locator('#dateRange').fill('November 20');
    await page.locator('#location').fill('Chicago');
    await back.click();
    await page.locator('label[for="serviceEditing"]').click();
    await next.click();
    assert.equal(await page.locator('#editingDeadline').inputValue(), '');
    await page.locator('#editingDeadline').fill('November 30');
    await back.click();
    await page.locator('label[for="serviceNightlife"]').click();
    await next.click();
    assert.equal(await page.locator('#dateRange').inputValue(), 'November 20');
    assert.equal(await page.locator('#location').inputValue(), 'Chicago');
    assert.equal(await page.locator('#editingDeadline').isVisible(), false);
    await back.click();
    await page.locator('label[for="serviceEditing"]').click();
    await next.click();
    assert.equal(await page.locator('#editingDeadline').inputValue(), 'November 30');
  });
  await check('Mobile menu closes when returning to desktop width',async()=>{await page.setViewportSize({width:390,height:844});await page.goto(base+'/');await page.locator('#navToggle').click();assert.equal(await page.locator('#navToggle').getAttribute('aria-expanded'),'true');await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(100);assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');assert.equal(await page.locator('#navToggle').getAttribute('aria-expanded'),'false');});
  await check('Resizing an open photo viewer preserves its scroll lock',async()=>{await page.setViewportSize({width:390,height:844});await page.goto(base+'/');await page.locator('.gallery-item').first().click();assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.locator('#lightbox').getAttribute('aria-hidden'),'false');assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');await page.keyboard.press('Escape');assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');});
} finally {
  await browser.close();await new Promise(r=>server.close(r));
  await writeFile(resolve(artifactDir,'booking-repro-results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));process.exitCode=results.some(x=>!x.pass)?1:0;
}
