import test from 'node:test';
import assert from 'node:assert/strict';
import { spots } from '../shared/catalog.mjs';
import { createPlan } from '../server/planner.mjs';
import { enhancePlan, answerGuide, createJournal } from '../server/ai.mjs';
import { requestJSON } from '../server/providers.mjs';
import { settingsSchema } from '../server/config.mjs';
import { createApp } from '../server/index.mjs';
const input = { days: 2, budget: 1000, interests: ['culture', 'relax'], pace: 'slow' };

test('every supported duration and pace produces nonempty days without repeated stops', () => {
  for (const days of [1, 2, 3]) for (const pace of ['slow', 'balanced', 'full']) {
    const plan = createPlan({ ...input, days, pace });
    assert.equal(plan.itinerary.length, days);
    assert.ok(plan.itinerary.every(d => d.stops.length > 0));
    const ids = plan.itinerary.flatMap(d => d.stops.map(s => s.spotId));
    assert.equal(new Set(ids).size, ids.length);
    for (const day of plan.itinerary) assert.ok(day.stops.length <= (pace === 'slow' ? 2 : pace === 'balanced' ? 3 : 4));
  }
});
test('preferences and pace affect the actual itinerary', () => {
  const culture = createPlan({ ...input, days: 1, interests: ['culture'] });
  const photo = createPlan({ ...input, days: 1, interests: ['photo'], pace: 'full' });
  assert.ok(spots.find(s => s.id === culture.itinerary[0].stops[0].spotId).tags.includes('culture'));
  for (const day of culture.itinerary) assert.ok(day.stops.every(stop => spots.find(s => s.id === stop.spotId).zone === day.zone));
  assert.equal(photo.itinerary[0].zone, '龙虎山片区');
  assert.notDeepEqual(culture.itinerary[0].stops, photo.itinerary[0].stops);
});
test('budget totals reconcile and over-budget plans are explicit', () => {
  const plan = createPlan({ ...input, budget: 200 });
  assert.equal(plan.costs.total, plan.costs.lodging + plan.costs.meals + plan.costs.transport + plan.costs.tickets);
  assert.equal(plan.budgetStatus, 'over');
  assert.match(plan.budgetNote, /超出预算/);
  assert.equal(createPlan({ ...input, days: 1 }).costs.lodging, 0);
});
test('invalid, missing and oversized inputs are rejected', () => {
  for (const bad of [{ ...input, days: 0 }, { ...input, days: 4 }, { ...input, budget: -1 }, { ...input, interests: [] }, { ...input, interests: ['unknown'] }, { ...input, pace: 'unknown' }, { ...input, secret: 'bad' }, {}]) assert.throws(() => createPlan(bad));
});
test('AI failure preserves the complete local itinerary', async () => {
  const plan = createPlan(input);
  const result = await enhancePlan(plan, async () => { throw new Error('upstream unavailable'); });
  assert.deepEqual(result.itinerary, plan.itinerary);
  assert.equal(result.mode, 'local');
  assert.match(result.notice, /暂不可用/);
});
test('guide cites known facts and does not invent live ticket prices', async () => {
  const result = await answerGuide({ question: '象鼻山是什么？', spotId: 'elephant' }, async () => null);
  assert.ok(result.sources.length > 0);
  assert.match(result.answer, /侵蚀/);
  const live = await answerGuide({ question: '今天门票多少钱？' }, async () => null);
  assert.match(live.answer, /没有接入实时/);
  assert.doesNotMatch(live.answer, /¥|\d+元/);
});
test('journal preserves notes and changes format without claiming image recognition', async () => {
  const result = await createJournal({ spotIds: ['river'], mood: 'video', notes: '我和朋友在河边坐了很久' }, async () => null);
  assert.match(result.content, /0–5s/);
  assert.match(result.content, /我和朋友在河边坐了很久/);
  assert.equal(result.mode, 'local');
  assert.equal(result.modeLabel, '本地文案模板');
});
test('model output schema is enforced, incomplete JSON output is rejected', async () => {
  const { z } = await import('zod');
  const config = settingsSchema.parse({ enabled: true, name: 'test', format: 'chat-completions', baseUrl: 'https://api.example.com/v1', model: 'test-model', apiKey: 'test-only' });
    const makeResponse = (content, finish_reason = 'stop') => async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason, message: { content } }] }) });
    await assert.rejects(requestJSON(config, 'test', {}, z.object({ answer: z.string() }), makeResponse('{"answer":42}')));
    await assert.rejects(requestJSON(config, 'test', {}, z.object({ answer: z.string() }), makeResponse('{"answer":"ok"}', 'length')));
    assert.deepEqual(await requestJSON(config, 'test', {}, z.object({ answer: z.string() }), makeResponse('{"answer":"ok"}')), { answer: 'ok' });
});
test('HTTP API validates payloads, rejects foreign origins, and returns a usable plan', async () => {
  const server = createApp({ store: { get: () => ({ enabled: false, apiKey: '', model: 'test' }) } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${url}/api/health`).then(r => r.json()); assert.equal(health.ok, true);
    const bad = await fetch(`${url}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(bad.status, 400);
    const valid = await fetch(`${url}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); assert.equal(valid.status, 200); assert.equal((await valid.json()).itinerary.length, 2);
    const foreign = await fetch(`${url}/api/journal`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' }, body: '{}' }); assert.equal(foreign.status, 403);
    const malformed = await fetch(`${url}/api/guide`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }); assert.equal(malformed.status, 400);
    const missing = await fetch(`${url}/api/unknown`); assert.equal(missing.status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
