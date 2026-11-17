const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const artifactDir = resolve(process.env.FLICKS_QA_DIR || resolve(root, '.qa-artifacts'));
await mkdir(artifactDir, { recursive: true });
const mime = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    await stat(file);
    res.writeHead(200, {'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    const data = await readFile(file);
    const providerMock = url.pathname === '/booking.html' && url.searchParams.get('test-site-send') !== 'paused';
    res.end(providerMock ? data.toString().replace('data-site-send="paused"', 'data-site-send="enabled"') : data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_EXECUTABLE_PATH || undefined, args:['--disable-gpu']});
const page = await browser.newPage({viewport:{width:1280,height:900},serviceWorkers:'block'});
const results = [];
await page.route('**/*', route => new URL(route.request().url()).origin === base && route.request().method() === 'GET' ? route.continue() : route.abort());
await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({contentType:'text/javascript',body:'window.testSdkLoads++;window.emailjs={init(){},async send(...args){window.testSends.push(args);if(window.testReject)throw new Error("Simulated provider rejection");return {status:200}}};'}));
await page.addInitScript(() => {window.testSdkLoads=0;window.testSends=[];window.testEvents=[];window.addEventListener('hynoe:analytics', e=>window.testEvents.push(e.detail));});
async function check(name, fn) {try {await fn(); results.push({name,pass:true});} catch(e) {results.push({name,pass:false,error:e.message});}}
const currentStep = page.locator('.booking-step.active');
const continueStep = () => currentStep.locator('[data-next]').click();
async function start(service = 'Nightlife', mode = 'enabled') {
  const query = new URLSearchParams({ service, 'test-site-send': mode });
  await page.goto(base + '/booking.html?' + query);
  await page.locator('.booking-step.active[data-booking-step="schedule"]').waitFor();
}
async function readyForContact() {await start();await page.locator('#dateRange').fill('November 20');await page.locator('#location').fill('Chicago');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.locator('#details').fill('Website QA, never sent.');await page.locator('#budgetNote').fill('500 dollars');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.locator('#name').fill('Website QA');await page.locator('#email').fill('qa@example.invalid');}
try {
  await check('Enter advances only the current schedule step', async()=>{await start();await page.locator('#dateRange').fill('November 20');await page.locator('#location').fill('Chicago');await page.locator('#location').press('Enter');assert.equal(await page.locator('.booking-step.active').getAttribute('data-booking-step'),'vision');assert.equal(await page.evaluate(()=>testSends.length),0);});
  await check('Enter on contact reaches review without sending', async()=>{await readyForContact();await page.locator('#email').press('Enter');assert.equal(await page.locator('.booking-step.active').getAttribute('data-booking-step'),'review');assert.equal(await page.evaluate(()=>testSends.length),0);});
  await check('Review includes the budget that will be sent', async()=>{await readyForContact();await page.getByRole('button',{name:'Review Request',exact:true}).click();assert.equal(await page.locator('[data-review="budgetNote"]').count(),1);assert.equal(await page.locator('[data-review="budgetNote"]').textContent(),'500 dollars');});
  await check('Photography requests can send without a date or venue', async () => {
    await start('Events');
    for (const selector of ['#dateRange', '#location']) {
      const input = page.locator(selector);
      const hint = await input.getAttribute('aria-describedby');
      assert.match(await page.locator('#' + hint).textContent(), /blank|optional/i);
      assert.equal(await input.evaluate(el => el.required), false);
    }
    await continueStep();
    await continueStep();
    await page.locator('#name').fill('Website QA');
    await page.locator('#email').fill('qa@example.invalid');
    await continueStep();
    assert.equal(await page.locator('[data-review="dateRange"]').isVisible(), false);
    assert.equal(await page.locator('[data-review="location"]').isVisible(), false);
    const draft = new URL(await page.locator('#bookingFallback a').getAttribute('href'));
    assert.doesNotMatch(draft.searchParams.get('body'), /^(?:Date range|Location):[ \t]*\S/m);
    await page.waitForTimeout(1850);
    await page.locator('#submitBooking').click();
    await page.locator('#successPanel.show').waitFor();
    const sends = await page.evaluate(() => testSends);
    assert.equal(sends.length, 1);
    assert.equal(sends[0][2].date_range, '');
    assert.equal(sends[0][2].location, '');
  });
  await check('Preselected service does not lose start tracking after a schedule change',async()=>{await start();await page.locator('#dateRange').fill('November 20');await page.locator('#location').focus();await page.getByRole('button',{name:'Back',exact:true}).click();await page.locator('label[for="servicePortraits"]').click();assert.equal(await page.evaluate(()=>testEvents.filter(e=>e.name==='booking_start').length),1);});
  await check('Legacy music link selects the current service and Back still changes it', async () => {
    await start('Music + Events');
    assert.equal(await page.locator('[name="service"]:checked').inputValue(), 'Music / Artist Content');
    await currentStep.locator('[data-back]').click();
    assert.equal(await currentStep.getAttribute('data-booking-step'), 'service');
    await page.locator('label[for="servicePortraits"]').click();
    await continueStep();
    const title = currentStep.getByRole('heading');
    assert.equal(await currentStep.getAttribute('data-booking-step'), 'schedule');
    assert.equal(await page.locator('[name="service"]:checked').inputValue(), 'Portraits');
    assert.equal(await title.evaluate(el => document.activeElement === el), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'dateRange');
    assert.equal(await page.evaluate(() => testSends.length), 0);
  });
  await check('Project details show different guidance for different services', async () => {
    async function promptFor(service) {
      await start(service);
      await continueStep();
      const field = page.locator('#details');
      const describedBy = await field.getAttribute('aria-describedby');
      return [await page.locator('#' + describedBy).textContent(), await field.getAttribute('placeholder')].join(' ').trim();
    }
    const events = await promptFor('Events');
    const portraits = await promptFor('Portraits');
    assert.match(events, /event|coverage|schedule|moments?/i);
    assert.notEqual(portraits, events);
  });
  await check('Paused production form offers direct email without loading EmailJS', async () => {
    await start('Nightlife', 'paused');
    await continueStep();
    await continueStep();
    await page.locator('#name').fill('Website QA');
    await page.locator('#email').fill('qa@example.invalid');
    await continueStep();
    assert.equal(await page.locator('#bookingForm').getAttribute('data-site-send'), 'paused');
    assert.equal(await page.locator('#submitBooking').isVisible(), false);
    assert.equal(await page.locator('#bookingFallback a').isVisible(), true);
    assert.equal(await page.evaluate(() => testSdkLoads), 0);
    await page.locator('#bookingForm').evaluate(form => form.requestSubmit());
    assert.equal(await page.evaluate(() => testSends.length), 0);
    assert.equal(await page.locator('#bookingFallback a').isVisible(), true);
    assert.equal(await page.locator('#successPanel').isVisible(), false);
  });
  await check('Blocked EmailJS leaves the direct email option available', async () => {
    const sdk = /https:\/\/cdn\.jsdelivr\.net\/npm\/@emailjs\/browser@/;
    const blocked = page.waitForRequest(sdk);
    await page.route(sdk, route => route.abort(), { times: 1 });
    await readyForContact();
    await blocked;
    await continueStep();
    assert.equal(await page.locator('#submitBooking').isVisible(), false);
    assert.equal(await page.locator('#bookingFallback a').isVisible(), true);
    assert.equal(await page.evaluate(() => testSdkLoads), 0);
    assert.equal(await page.evaluate(() => testSends.length), 0);
  });
  await check('Disabled JavaScript and a missing booking module leave one direct email path', async () => {
    const noScript = await browser.newContext({ javaScriptEnabled: false });
    await noScript.route('**/*', route => new URL(route.request().url()).origin === base && route.request().method() === 'GET' ? route.continue() : route.abort());
    const assertFallback = async page => {
      const unavailable = page.locator('#bookingUnavailable');
      assert.equal(await page.locator('#bookingPanel').isVisible(), false);
      assert.equal(await unavailable.isVisible(), true);
      const directEmail = unavailable.locator('a[href^="mailto:"]');
      assert.equal(await directEmail.isVisible(), true);
      assert.equal(new URL(await directEmail.getAttribute('href')).pathname, 'hynoe.flicks@gmail.com');
    };
    try {
      const staticPage = await noScript.newPage();
      await staticPage.goto(base + '/booking.html?test-site-send=paused');
      await assertFallback(staticPage);
    } finally {
      await noScript.close();
    }
    await page.route(/\/assets\/js\/booking\.js(?:\?|$)/, route => route.abort(), { times: 1 });
    await page.goto(base + '/booking.html?test-site-send=paused');
    await assertFallback(page);
  });
  await check('Mobile editing clients can finish without a venue or a deadline', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/photo-editing-retouching.html');
    await page.locator('.service-hero').getByRole('link', { name: 'Start Editing Request', exact: true }).click();
    const next = page.locator('.booking-step.active [data-next]');
    await currentStep.waitFor();
    assert.equal(await currentStep.getAttribute('data-booking-step'), 'schedule');
    assert.equal(await page.locator('#location').isVisible(), false);
    assert.match(await currentStep.getByRole('heading').textContent(), /edited|editing/i);
    assert.match(await page.locator('label[for="editingDeadline"]').textContent(), /deadline.*optional/i);
    await page.locator('#editingDeadline').press('Enter');
    await page.locator('#details').fill('Eight photos for a website. Please match color.');
    await next.click();
    await page.locator('#name').fill('Website QA');
    await page.locator('#email').fill('qa@example.invalid');
    await next.click();
    assert.equal(await page.locator('[data-review="location"]').isVisible(), false);
    assert.equal(await page.locator('[data-review="dateRange"]').textContent(), 'Flexible');
    assert.equal(await page.locator('[data-review="details"]').isVisible(), true);
    assert.equal(await page.locator('[data-review="references"]').isVisible(), false);
    assert.equal(await page.locator('[data-review="budgetNote"]').isVisible(), false);
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
    assert.match(draft.href, /%0D%0A/);
    assert.equal(await requestText.inputValue(), draft.searchParams.get('body').replace(/\r\n/g, '\n'));
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
  await check('Long international project details stay intact and use a short email link', async () => {
    await page.setViewportSize({ width: 320, height: 640 });
    await start('Nightlife', 'paused');
    await continueStep();
    const details = 'Café, Montréal & Chicago + 50%?\n' + '夜の撮影 · موسيقى · 📷🎞️ '.repeat(75) + '\nEnd of the project brief.';
    await page.locator('#details').fill(details);
    await continueStep();
    await page.locator('#name').fill('Website QA');
    await page.locator('#email').fill('qa@example.invalid');
    await continueStep();

    const fullReview = page.locator('details#reviewLongDetails');
    const expanded = fullReview.locator('#reviewExpandedDetails');
    assert.equal(await fullReview.isVisible(), true);
    assert.equal(await fullReview.getAttribute('open'), null);
    assert.equal(await expanded.isVisible(), false);
    assert.equal(await page.locator('[data-review="details"]').isVisible(), false);
    await fullReview.locator('summary').click();
    assert.equal(await expanded.isVisible(), true);
    assert.equal(await expanded.textContent(), details);
    await fullReview.locator('summary').click();

    const fallback = page.locator('#bookingFallback');
    const draft = new URL(await fallback.getByRole('link', { name: 'Open your email app' }).getAttribute('href'));
    assert.equal(draft.pathname, 'hynoe.flicks@gmail.com');
    assert.deepEqual([...draft.searchParams.keys()], ['subject']);
    assert.equal(draft.searchParams.get('subject'), 'Booking Request - Hynoe Flicks - Nightlife');
    const text = page.locator('#bookingFallbackText');
    assert.equal(await text.isVisible(), true);
    assert.equal(await text.inputValue(), `Name: Website QA\nEmail: qa@example.invalid\nService: Nightlife\n\nDetails:\n${details}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    // Exercise both Clipboard API outcomes without touching the host clipboard.
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async value => { window.testClipboard = value; } },
    }));
    const copy = page.getByRole('button', { name: 'Copy request text', exact: true });
    await copy.click();
    await page.waitForFunction(() => document.getElementById('copyBookingStatus').textContent === 'Request copied.');
    assert.equal(await page.evaluate(() => testClipboard), await text.inputValue());

    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
    await copy.click();
    await page.waitForFunction(() => document.getElementById('copyBookingStatus').textContent.startsWith('Request selected.'));
    assert.equal(await text.evaluate(el => document.activeElement === el), true);
    assert.equal(await text.evaluate(el => el.selectionEnd - el.selectionStart), (await text.inputValue()).length);
    assert.equal(await page.evaluate(() => testSends.length), 0);
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
