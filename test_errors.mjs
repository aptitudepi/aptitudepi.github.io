import {chromium} from 'playwright';

const browser = await chromium.launch({headless: true});
const page = await browser.newPage();
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(err.message));
try {
  await page.goto('http://localhost:8888/', {waitUntil: 'networkidle', timeout: 30000});
  await page.waitForTimeout(2000);
} catch (e) {
  errors.push('Navigation error: ' + e.message);
}
console.log('ERRORS:', JSON.stringify(errors));
await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
