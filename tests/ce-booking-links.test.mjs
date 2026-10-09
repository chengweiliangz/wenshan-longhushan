import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { BOOKING_DESTINATIONS, buildBookingLinks, isValidBookingDate } from '../shared/bookingLinks.mjs';

const plan = (days = 2, departureDate = '2026-12-31', ids = ['river', 'elephant']) => ({
  preferences: { days, budget: 1000, departureDate },
  itinerary: [{ stops: ids.map(spotId => ({ spotId })) }],
});

test('known Longhushan stops map to verified Jiangxi POI and Yingtan hotel destinations', () => {
  const links = buildBookingLinks(plan());
  assert.equal(links.length, 2);
  assert.equal(links[0].url, 'https://you.ctrip.com/sight/guixi1189/137685.html');
  assert.equal(links[1].url, 'https://hotels.ctrip.com/hotel/yingtan534/');
  assert.match(links[0].description, /龙虎山象鼻山/);
  assert.match(links[0].description, /扫码至微信小程序/);
  for (const link of links) {
    const url = new URL(link.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.search, '');
    assert.ok(url.hostname.endsWith('.ctrip.com'));
    assert.deepEqual(Object.keys(link), ['id', 'label', 'url', 'description']);
  }
});

test('calendar validation rejects rollover, malformed and non-string dates', () => {
  for (const invalid of [undefined, null, '', 20261007, '2026-2-03', '2026-02-29', '1900-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '2026-10-07T00:00:00Z', '2026-10-07\n', '2026-10-07&city=Guilin', '0000-01-01']) {
    assert.equal(isValidBookingDate(invalid), false, String(invalid));
  }
  for (const valid of ['2000-02-29', '2024-02-29', '2026-10-07', '2026-12-31']) assert.equal(isValidBookingDate(valid), true);
});

test('stay guidance crosses year and leap-day boundaries but never claims URL date transfer', () => {
  assert.match(buildBookingLinks(plan())[1].description, /2026-12-31 入住，2027-01-01 退房，1 晚/);
  assert.match(buildBookingLinks(plan(3, '2024-02-28'))[1].description, /2024-03-01 退房，2 晚/);
  assert.match(buildBookingLinks(plan())[1].description, /日期和预算不会自动带入/);
  assert.doesNotMatch(buildBookingLinks(plan(3, '9999-12-31'))[1].description, /10000/);
});

test('no overnight booking for one-day or invalid-duration itineraries', () => {
  for (const days of [1, 0, -1, 2.5, Infinity, 4, '2']) assert.equal(buildBookingLinks(plan(days)).length, 1);
  assert.equal(buildBookingLinks({ itinerary: [{ stops: [{ spotId: 'river' }] }]}).length, 1);
});

test('invalid or missing dates degrade to manual selection without leaking input', () => {
  for (const date of ['', '2026-02-30', 'javascript:alert(1)', undefined]) {
    const input = plan(2, date); if (date === undefined) delete input.preferences.departureDate;
    const links = buildBookingLinks(input);
    assert.match(links[1].description, /行程建议住宿 1 晚/);
    assert.doesNotMatch(JSON.stringify(links), /javascript:|2026-02-30/);
    assert.equal(links[1].url, BOOKING_DESTINATIONS.yingtanHotels);
  }
});

test('palaces and designed walking activities do not become fabricated individual products', () => {
  const links = buildBookingLinks(plan(1, '', ['zhengyi', 'tianshi', 'shangqing', 'danxia']));
  assert.equal(links.length, 1);
  assert.match(links[0].description, /宫观是否包含/);
  assert.doesNotMatch(links[0].label, /套票|已预订|实时|下单/);
});

test('unknown, missing and malformed stops do not create misleading booking links', () => {
  for (const input of [undefined, null, {}, { itinerary: null }, { itinerary: [null, { stops: 'river' }] }, plan(2, '', ['guilin-elephant', 'https://evil.example'])]) assert.deepEqual(buildBookingLinks(input), []);
  const mixed = plan(2, '', ['river', 'river', '<img onerror=alert(1)>']);
  assert.equal(buildBookingLinks(mixed)[0].description.match(/泸溪河/g).length, 1);
  assert.doesNotMatch(JSON.stringify(buildBookingLinks(mixed)), /onerror|evil/);
});

test('the builder does not mutate saved plans and returns fresh links', () => {
  const input = plan(); const before = structuredClone(input);
  const first = buildBookingLinks(input); first[0].url = 'https://evil.example';
  assert.deepEqual(input, before);
  assert.equal(buildBookingLinks(input)[0].url, BOOKING_DESTINATIONS.longhushan);
});

test('calendar output is identical in distant time zones', () => {
  const moduleUrl = new URL('../shared/bookingLinks.mjs', import.meta.url).href;
  const code = `import {buildBookingLinks} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(buildBookingLinks(${JSON.stringify(plan(3, '2026-12-31'))})));`;
  const outputs = ['Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Kiritimati'].map(TZ => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', env: { ...process.env, TZ } });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  });
  assert.equal(new Set(outputs).size, 1);
});
