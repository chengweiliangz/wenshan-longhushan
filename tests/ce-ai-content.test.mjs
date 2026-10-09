import test from 'node:test';
import assert from 'node:assert/strict';
import { spots } from '../shared/catalog.mjs';
import { TRAVEL_WISHES, CREATIVE_CONTRACT, CREATIVE_DISCLOSURE } from '../shared/creativeContract.mjs';
import { createPlan, planSchema, scheduleStops, planDayOptions } from '../server/planner.mjs';
import { enhancePlan, personalizedPlanSchema, personalizedPlanDraftSchema, createJournal, journalSchema } from '../server/ai.mjs';

const prefs = { days: 2, budget: 1000, interests: ['culture', 'relax'], pace: 'balanced', wishes: ['wealth', 'romance', 'scenery'], departureDate: '2026-12-31' };
const clone = value => JSON.parse(JSON.stringify(value));
const modelRoute = () => ({
  title: '道友，给心愿留一程', intro: '先看文化，再把脚步交给山水；求财整理目标，姻缘留给陪伴。',
  itinerary: [
    { day: 1, title: '先读上清的文化线索', zone: '上清片区', stops: [
      { spotId: 'shangqing', time: '09:00', duration: 60, reason: '循着资料了解保护展示的区别。', activities: ['写下一个求财目标和预算边界。'] },
      { spotId: 'tianshi', time: '10:40', duration: 60, reason: '在允许参观的建筑间慢一点。', activities: ['给同行的人留一句心意。'] },
    ] },
    { day: 2, title: '再看丹霞与水岸', zone: '龙虎山片区', stops: [
      { spotId: 'elephant', time: '09:00', duration: 60, reason: '观察侵蚀塑造的天然石桥。', activities: ['在开放步道静看丹霞风景。'] },
      { spotId: 'river', time: '10:40', duration: 60, reason: '从水岸对照山体和河谷。', activities: ['给山水留一分钟安静观察。'] },
      { spotId: 'zhengyi', time: '13:00', duration: 45, reason: '尊重现场礼仪，轻松收尾。', activities: ['记录一个能执行的小目标。'] },
    ] },
  ],
});
const modelDraft = () => {
  const route = modelRoute();
  return {
    title: route.title, intro: route.intro,
    itinerary: [route.itinerary[1], route.itinerary[0]].map((day, index) => ({
      day: index + 1, title: day.title,
      stops: day.stops.map(stop => ({
        spotId: stop.spotId, duration: stop.duration, reason: stop.reason,
        activities: stop.activities.map(text => ({ wish: /目标|预算/.test(text) ? 'wealth' : /心意/.test(text) ? 'romance' : /丹霞风景/.test(text) ? 'scenery' : 'general', text })),
      })),
    })),
  };
};
const journalInput = { spotIds: ['shangqing', 'river'], mood: 'poetic', notes: '想要墨色、少一点雾，配一段安静的字。', creative: true, photoMeta: { width: 1920, height: 1080, type: 'image/jpeg' } };
const modelCreative = () => ({ title: '慢看这一程', content: '用墨色和轻雾衬托原照片，把文字放在空白处。先缓缓入画，再停一会儿，最后用一句心意收尾。', tags: ['龙虎山', '慢旅行'], creative: { theme: 'ink', headline: '山水之间，慢一点', subtitle: '把这一刻留给自己', palette: 'ochre', fog: 0.11, shotCaptions: ['先慢一点', '看看山水', '留住这一刻'], motion: 'pan', duration: 12 } });

// Fake generators exercise API logic and validation without using a key or model.
test('wishes default to an empty list and date input validates actual calendar days', () => {
  const plain = planSchema.parse({ days: 1, budget: 600, interests: ['relax'], pace: 'slow' });
  assert.deepEqual(plain.wishes, []);
  assert.equal(plain.departureDate, undefined);
  assert.equal(planSchema.parse({ ...prefs, departureDate: '2028-02-29' }).departureDate, '2028-02-29');
  for (const departureDate of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-2-01', 'not-a-date']) assert.throws(() => planSchema.parse({ ...prefs, departureDate }));
  for (const wishes of [['magic'], ['wealth', 'romance', 'scenery', 'wealth']]) assert.throws(() => planSchema.parse({ ...prefs, wishes }));
  assert.deepEqual(TRAVEL_WISHES.map(w => w.id), ['wealth', 'romance', 'scenery']);
});

test('local preferences alter route priorities and provide concrete safe wish activities', () => {
  const common = { days: 1, budget: 1000, interests: ['relax'], pace: 'slow' };
  const relaxed = createPlan(common), wealth = createPlan({ ...common, wishes: ['wealth'] });
  assert.equal(relaxed.itinerary[0].stops[0].spotId, 'river');
  assert.equal(wealth.itinerary[0].stops[0].spotId, 'zhengyi');
  const all = createPlan({ ...prefs, wishes: ['wealth', 'romance', 'scenery'] });
  const text = all.itinerary.flatMap(day => day.stops.flatMap(stop => stop.activities)).join('\n');
  assert.match(text, /目标/); assert.match(text, /心意/); assert.match(text, /观察/);
  assert.doesNotMatch(text, /保证发财|开光|法事|转运仪式/);
  assert.deepEqual(createPlan({ ...prefs, wishes: ['wealth', 'wealth'] }).preferences.wishes, ['wealth']);
});

test('all duration/pace/budget combinations preserve geography, dates, no repeats and deterministic costs', () => {
  for (const days of [1, 2, 3]) for (const pace of ['slow', 'balanced', 'full']) for (const budget of [200, 700, 3000]) {
    const plan = createPlan({ ...prefs, days, pace, budget });
    assert.equal(plan.itinerary.length, days);
    const ids = plan.itinerary.flatMap(day => day.stops.map(stop => stop.spotId));
    assert.equal(ids.length, new Set(ids).size);
    for (const day of plan.itinerary) {
      assert.ok(day.stops.length > 0 && day.stops.length <= ({ slow: 2, balanced: 3, full: 4 })[pace]);
      assert.ok(day.stops.every(stop => spots.find(spot => spot.id === stop.spotId).zone === day.zone));
      assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/);
    }
    assert.equal(plan.costs.lodging, (days - 1) * (budget / days >= 650 ? 280 : 160));
    assert.equal(plan.costs.total, plan.costs.lodging + days * 80 + days * 40 + 260);
    assert.equal(plan.budgetStatus, plan.costs.total <= budget ? 'within' : 'over');
    if (plan.budgetStatus === 'over') assert.match(plan.budgetNote, /超出预算/);
  }
  assert.deepEqual(createPlan({ ...prefs, days: 3 }).itinerary.map(day => day.date), ['2026-12-31', '2027-01-01', '2027-01-02']);
});

test('AI genuinely replaces route order, stop duration/reasons/activities while keeping algorithmic fees and dates', async () => {
  const baseline = createPlan(prefs), chosen = modelDraft();
  let request;
  const result = await enhancePlan(baseline, async (instruction, data, schema) => { request = { instruction, data }; return schema.parse(chosen); });
  assert.equal(result.mode, 'ai'); assert.equal(result.modeLabel, 'AI 个性化攻略');
  assert.deepEqual(result.itinerary.map(day => day.stops.map(stop => stop.spotId)), chosen.itinerary.map(day => day.stops.map(stop => stop.spotId)));
  assert.notDeepEqual(result.itinerary, baseline.itinerary);
  assert.equal(result.itinerary[0].stops[0].duration, 60);
  assert.equal(result.itinerary[0].stops[0].activities[0], chosen.itinerary[0].stops[0].activities[0].text);
  assert.deepEqual(result.costs, baseline.costs); assert.equal(result.budgetStatus, baseline.budgetStatus); assert.equal(result.budgetNote, baseline.budgetNote);
  assert.deepEqual(result.itinerary.map(day => day.date), ['2026-12-31', '2027-01-01']);
  assert.deepEqual(new Set(result.sources), new Set(['thad-shangqing', 'unesco-geopark']));
  const { interests: _interests, ...expectedPreferences } = baseline.preferences;
  assert.deepEqual(request.data.preferences, expectedPreferences);
  assert.deepEqual(request.data.interestLabels, ['道文化探秘', '山水放空']);
  const canonical = JSON.parse(request.instruction.split('<BOUNDED_GUIDE_FACTS>\n')[1].split('\n</BOUNDED_GUIDE_FACTS>')[0]);
  assert.ok(canonical.some(spot => spot.id === 'shangqing' && spot.fact.includes('中路展示遗址')));
  assert.match(request.instruction, /不得编造功效、仪式、票价/);
  assert.match(request.instruction, /不要输出zone、time/);
  assert.deepEqual(request.data.dayOptions.map(({ minStops, maxStops, ...option }) => option), planDayOptions(baseline));
  assert.ok(request.data.dayOptions.every(option => option.minStops === 1 && option.maxStops <= 3));
});

test('AI cannot return titles alone, extra prices, invented places, repeats, mixed zones or incomplete days', async () => {
  const baseline = createPlan(prefs);
  const changes = [
    route => { delete route.itinerary; },
    route => { route.costs = { tickets: 10 }; },
    route => { route.itinerary.pop(); },
    route => { route.itinerary[1].day = 1; },
    route => { route.itinerary[0].stops[0].spotId = 'invented'; },
    route => { route.itinerary[1].stops[0].spotId = 'elephant'; },
    route => { route.itinerary[0].stops[0].spotId = 'tianshi'; },
  ];
  for (const change of changes) {
    const invalid = modelDraft(); change(invalid);
    const result = await enhancePlan(baseline, async () => invalid); // Also verifies revalidation of injected generators.
    assert.equal(result.mode, 'local'); assert.match(result.notice, /未通过校验/);
    assert.deepEqual(result.itinerary, baseline.itinerary); assert.deepEqual(result.costs, baseline.costs);
  }
});

test('route validation enforces pace, bounded durations, valid times, transfer gaps and lunch start policy', () => {
  const baseline = createPlan(prefs), schema = personalizedPlanSchema(baseline);
  for (const [field, value] of [['time', '07:00'], ['time', '12:20'], ['time', '17:00'], ['time', '09:99'], ['duration', 25], ['duration', 140], ['duration', 63]]) {
    const bad = modelRoute(); bad.itinerary[0].stops[0][field] = value; assert.equal(schema.safeParse(bad).success, false);
  }
  const overlap = modelRoute(); overlap.itinerary[0].stops[1].time = '10:30'; assert.equal(schema.safeParse(overlap).success, false);
  assert.equal(schema.safeParse(modelRoute()).success, true);
  assert.equal(personalizedPlanSchema(createPlan({ ...prefs, pace: 'slow' })).safeParse(modelRoute()).success, false);
});

test('unsupported benefit/ritual/price claims and false budget assurances are rejected without editing real costs', async () => {
  const over = createPlan({ ...prefs, budget: 200 });
  for (const text of ['保证发财，今晚一定转运', '参加转运仪式再上香', '门票只要20元', '预算充足，不超出预算']) {
    const bad = modelDraft(); bad.intro = text;
    const result = await enhancePlan(over, async () => bad);
    assert.equal(result.mode, 'local'); assert.equal(result.budgetStatus, 'over'); assert.match(result.budgetNote, /超出预算/);
    assert.deepEqual(result.costs, over.costs);
  }
});

test('disabled or failed AI stays clearly local and keeps the complete deterministic itinerary', async () => {
  const plan = createPlan(prefs);
  const disabled = await enhancePlan(plan, async () => null);
  assert.equal(disabled.mode, 'local'); assert.equal(disabled.modeLabel, '本地规则攻略'); assert.deepEqual(disabled.itinerary, plan.itinerary);
  const failure = await enhancePlan(plan, async () => { throw new Error('fake transport failure'); });
  assert.equal(failure.mode, 'local'); assert.match(failure.notice, /AI 服务暂不可用/); assert.deepEqual(failure.itinerary, plan.itinerary);
});

test('journal accepts only bounded photo dimensions and allowed MIME type, never pixels or paths', () => {
  assert.equal(journalSchema.parse(journalInput).creative, true);
  assert.deepEqual(journalSchema.parse(journalInput).photoMeta, journalInput.photoMeta);
  for (const photoMeta of [
    { width: 0, height: 100, type: 'image/jpeg' }, { width: 100.5, height: 100, type: 'image/jpeg' },
    { width: 20001, height: 100, type: 'image/jpeg' }, { width: 100, height: 100, type: 'image/svg+xml' },
    { ...journalInput.photoMeta, dataUrl: 'data:image/png;base64,FAKE' }, { ...journalInput.photoMeta, filename: 'private.jpg' },
    { ...journalInput.photoMeta, url: 'https://example.com/photo.jpg' },
  ]) assert.throws(() => journalSchema.parse({ ...journalInput, photoMeta }));
  assert.throws(() => journalSchema.parse({ ...journalInput, image: 'fake-bytes' }));
});

test('model chooses actual creative parameters and receives metadata only with canonical facts isolated from notes', async () => {
  const selected = modelCreative(); let received;
  const result = await createJournal(journalInput, async (instruction, data, schema) => { received = { instruction, data }; return schema.parse(selected); });
  assert.equal(result.mode, 'ai'); assert.deepEqual(result.creative, selected.creative);
  assert.equal(result.creative.theme, 'ink'); assert.equal(result.creative.palette, 'ochre'); assert.equal(result.creative.fog, 0.11);
  assert.equal(result.creative.motion, 'pan'); assert.equal(result.creative.duration, 12);
  assert.equal(result.disclosure, CREATIVE_DISCLOSURE); assert.match(result.disclosure, /不识别照片/); assert.match(result.disclosure, /未调用扩散/);
  assert.deepEqual(received.data.photoMeta, journalInput.photoMeta); assert.equal(received.data.notes, journalInput.notes);
  assert.deepEqual(Object.keys(received.data).sort(), ['mood', 'notes', 'photoMeta', 'spotIds']);
  const canonical = JSON.parse(received.instruction.split('<BOUNDED_GUIDE_FACTS>\n')[1].split('\n</BOUNDED_GUIDE_FACTS>')[0]);
  assert.ok(canonical.some(spot => spot.id === 'shangqing' && spot.fact.includes('中路展示遗址')));
  assert.ok(!received.instruction.includes(journalInput.notes)); assert.match(received.instruction, /未收到照片像素/);
});

test('creative recipe rejects invalid choices, fog, captions, duration, added URLs and fake photo recognition', async () => {
  const changes = [
    recipe => { recipe.creative.theme = 'diffusion'; }, recipe => { recipe.creative.palette = 'red'; },
    recipe => { recipe.creative.fog = 0.51; }, recipe => { recipe.creative.fog = -0.1; },
    recipe => { recipe.creative.motion = 'zoom'; }, recipe => { recipe.creative.duration = 30; },
    recipe => { recipe.creative.shotCaptions.pop(); }, recipe => { recipe.creative.shotCaptions[0] = 'x'.repeat(25); },
    recipe => { recipe.creative.videoUrl = 'https://example.com/made-up.mp4'; },
    recipe => { recipe.content = '照片里有一只白猫，我已经生成视频。'; },
  ];
  for (const change of changes) {
    const bad = modelCreative(); change(bad);
    const result = await createJournal(journalInput, async () => bad);
    assert.equal(result.mode, 'local'); assert.equal(result.modeLabel, '本地合成模板'); assert.match(result.notice, /未通过校验/);
    assert.equal(result.creative.duration, 12); assert.equal(result.creative.shotCaptions.length, 3);
    assert.equal(result.disclosure, CREATIVE_DISCLOSURE);
  }
});

test('creative disabled/failure fallback is labelled and browser composition remains a recipe rather than generated media', async () => {
  for (const generate of [async () => null, async () => { throw new Error('offline'); }]) {
    const result = await createJournal({ ...journalInput, mood: 'video' }, generate);
    assert.equal(result.mode, 'local'); assert.equal(result.modeLabel, '本地合成模板');
    assert.equal(result.creative.duration, CREATIVE_CONTRACT.duration);
    assert.match(result.content, /8–12s/); assert.match(result.disclosure, /浏览器/);
    assert.equal(result.videoUrl, undefined); assert.equal(result.imageUrl, undefined);
  }
});

test('ordinary journal stays compatible and omits creative fields and photo metadata from the provider', async () => {
  const ordinary = { spotIds: ['river'], mood: 'video', notes: '我和朋友在河边坐了很久' }; let data;
  const model = { title: '河边的片刻', content: '根据手记保留你想说的话。', tags: ['龙虎山'] };
  const result = await createJournal(ordinary, async (_instruction, received, schema) => { data = received; return schema.parse(model); });
  assert.equal(result.mode, 'ai'); assert.equal(result.modeLabel, 'AI 共创');
  assert.equal(result.creative, undefined); assert.equal(result.disclosure, undefined); assert.equal(data.photoMeta, undefined);
  const local = await createJournal(ordinary, async () => null);
  assert.match(local.content, /0–5s/); assert.match(local.content, /我和朋友在河边坐了很久/); assert.equal(local.modeLabel, '本地文案模板');
});

test('explicit non-guarantee wording is accepted while a trip cannot overflow four-digit calendar years', async () => {
  const chosen = modelDraft();
  chosen.intro = '求财只整理目标，不保证发财，也不能保证灵验；姻缘留给交流。';
  const result = await enhancePlan(createPlan(prefs), async () => chosen);
  assert.equal(result.mode, 'ai');
  assert.throws(() => createPlan({ ...prefs, days: 3, departureDate: '9999-12-31' }));
});

test('server clocks derive from actual model order/durations with full transfer and lunch buffers', async () => {
  const base = createPlan(prefs), first = modelDraft(), second = modelDraft();
  second.itinerary[0].stops = [second.itinerary[0].stops[1], second.itinerary[0].stops[0], second.itinerary[0].stops[2]];
  second.itinerary[0].stops[0].duration = 90;
  const a = await enhancePlan(base, async () => first), b = await enhancePlan(base, async () => second);
  assert.equal(a.mode, 'ai'); assert.equal(b.mode, 'ai');
  assert.equal(a.itinerary[0].stops[0].spotId, 'elephant'); assert.equal(b.itinerary[0].stops[0].spotId, 'river');
  assert.equal(a.itinerary[0].stops[0].duration, 60); assert.equal(b.itinerary[0].stops[0].duration, 90);
  assert.deepEqual(a.itinerary[0].stops.map(stop => stop.time), ['09:00', '10:40', '13:00']);
  assert.deepEqual(b.itinerary[0].stops.map(stop => stop.time), ['09:00', '11:10', '13:00']);
  assert.equal(a.itinerary[0].zone, '龙虎山片区'); assert.equal(b.itinerary[0].zone, '龙虎山片区');
  assert.deepEqual(a.itinerary[0].stops, scheduleStops(first.itinerary[0].stops.map(stop => ({ spotId: stop.spotId, duration: stop.duration, reason: stop.reason, activities: stop.activities.map(activity => activity.text) }))));
  assert.deepEqual(a.costs, b.costs);
});

test('V2 draft rejects supplied zone/time/wishes, cross-day repeats, wrong day candidates and absent or merely labelled wish activities', () => {
  const base = createPlan(prefs), schema = personalizedPlanDraftSchema(base);
  assert.equal(schema.safeParse(modelDraft()).success, true);
  for (const mutate of [
    draft => { draft.itinerary[0].zone = '上清片区'; },
    draft => { draft.itinerary[0].stops[0].time = '10:50'; },
    draft => { draft.itinerary[0].stops[0].wishes = ['romance']; },
    draft => { draft.itinerary[0].stops[0].spotId = 'shangqing'; },
    draft => { draft.itinerary[1].stops[0].spotId = 'river'; },
    draft => { draft.itinerary[1].stops[1].activities = [{ wish: 'romance', text: '静静看看风景。' }]; },
    draft => { draft.intro += '特别回应姻缘。'; draft.itinerary[1].stops[1].activities = [{ wish: 'general', text: '留意现场礼仪。' }]; },
  ]) {
    const draft = modelDraft(); mutate(draft); assert.equal(schema.safeParse(draft).success, false);
  }
  const oneWish = personalizedPlanDraftSchema(createPlan({ ...prefs, wishes: ['wealth'] }));
  assert.equal(oneWish.safeParse(modelDraft()).success, false); // romance/scenery labels are not selected.
});

test('too-long schedules fail as complete plans without dropping or shortening model-selected stops', async () => {
  const base = createPlan({ ...prefs, days: 1, pace: 'full', interests: ['photo'], wishes: ['scenery'] });
  const draft = { title: '看山水', intro: '在开放步道观察风景。', itinerary: [{ day: 1, title: '山水观察', stops: [
    { spotId: 'river', duration: 135, reason: '观察山水。', activities: [{ wish: 'scenery', text: '在岸上观察丹霞风景。' }] },
    { spotId: 'elephant', duration: 135, reason: '观察天然石桥。', activities: [{ wish: 'general', text: '留意步道提示。' }] },
    { spotId: 'danxia', duration: 90, reason: '观察岩色。', activities: [{ wish: 'general', text: '留一点休息时间。' }] },
    { spotId: 'zhengyi', duration: 90, reason: '了解文化。', activities: [{ wish: 'general', text: '尊重场所礼仪。' }] },
  ] }] };
  const before = clone(draft);
  assert.equal(personalizedPlanDraftSchema(base).safeParse(draft).success, false);
  const result = await enhancePlan(base, async () => draft);
  assert.equal(result.mode, 'local'); assert.deepEqual(result.itinerary, base.itinerary); assert.deepEqual(draft, before);
});

test('real diagnosed V1 failures remain rejected for short transfers, mixed zones and unsupported stop wishes', () => {
  const wealthInput = { days: 2, budget: 1000, interests: ['culture', 'relax'], pace: 'slow', wishes: ['wealth'] };
  const wealth = { title: '龙虎山两日慢游', intro: '把心放平，再理手头的账与打算。', itinerary: [
    { day: 1, title: '泸溪河与丹霞', zone: '龙虎山片区', stops: [
      { spotId: 'river', time: '09:00', duration: 90, reason: '顺水岸看山。', activities: ['沿开放水岸观察山体与河谷形态。'] },
      { spotId: 'danxia', time: '10:50', duration: 60, reason: '观察丹霞。', activities: ['在开放步道观察岩色。'] },
    ] },
    { day: 2, title: '正一观与天师府', zone: '上清片区', stops: [
      { spotId: 'zhengyi', time: '09:00', duration: 60, reason: '了解文化。', activities: ['留意场所礼仪。'] },
      { spotId: 'tianshi', time: '10:20', duration: 90, reason: '慢一点。', activities: ['理一理预算与目标。'] },
    ] },
  ] };
  const issues = personalizedPlanSchema(createPlan(wealthInput)).safeParse(wealth);
  assert.equal(issues.success, false);
  assert.ok(issues.error.issues.some(issue => issue.message.includes('40分钟')));
  assert.ok(issues.error.issues.some(issue => issue.message.includes('真实分区')));
  const romance = { title: '一日慢游', intro: '姻缘留给慢一点。', itinerary: [{ day: 1, title: '水岸与道观', zone: '龙虎山片区', stops: [
    { spotId: 'river', time: '09:00', duration: 90, reason: '沿岸看山。', activities: ['顺水岸慢走，对照山体与河谷。'], wishes: ['romance'] },
    { spotId: 'zhengyi', time: '13:00', duration: 60, reason: '了解文化。', activities: ['在开放区域缓步参观，留意礼仪。'] },
  ] }] };
  const romanceIssues = personalizedPlanSchema(createPlan({ ...wealthInput, days: 1, wishes: ['romance'] })).safeParse(romance);
  assert.equal(romanceIssues.success, false);
  assert.ok(romanceIssues.error.issues.some(issue => issue.code === 'unrecognized_keys' && issue.keys.includes('wishes')));
  assert.ok(romanceIssues.error.issues.some(issue => issue.message.includes('具体活动未回应')));
});

const diagnosedWealthV2 = {
  "title": "两日慢游：龙虎山与上清",
  "intro": "道友，请留步。两天走五站，不赶。第一天在泸溪河与正一观，第二天上清片区看天师府和大上清宫。许愿的事，当民俗看看就好。",
  "itinerary": [
    {
      "day": 1,
      "title": "临水看山，入观歇脚",
      "stops": [
        {
          "spotId": "river",
          "duration": 90,
          "reason": "先顺水岸看丹霞与河谷",
          "activities": [
            {
              "wish": "general",
              "text": "沿开放水岸慢走，对照山体与河谷形态"
            }
          ]
        },
        {
          "spotId": "zhengyi",
          "duration": 60,
          "reason": "道教文化地点，步调也缓",
          "activities": [
            {
              "wish": "relax",
              "text": "在殿外安静坐一会儿，缓一缓"
            }
          ]
        },
        {
          "spotId": "danxia",
          "duration": 60,
          "reason": "轻步看红色沉积岩地貌",
          "activities": [
            {
              "wish": "wealth",
              "text": "写下一个求财目标，核对这趟预算"
            }
          ]
        }
      ]
    },
    {
      "day": 2,
      "title": "上清片区看文化",
      "stops": [
        {
          "spotId": "tianshi",
          "duration": 90,
          "reason": "重要道教文化地点，慢慢看",
          "activities": [
            {
              "wish": "culture",
              "text": "留意建筑与陈设，拍摄先看现场提示"
            }
          ]
        },
        {
          "spotId": "shangqing",
          "duration": 90,
          "reason": "遗址与原状揭露各有看点",
          "activities": [
            {
              "wish": "general",
              "text": "按开放区域参观，尊重现场礼仪"
            }
          ]
        }
      ]
    }
  ]
};


const wealthOnly = { days: 2, budget: 1000, interests: ['culture', 'relax'], pace: 'slow', wishes: ['wealth'] };
function validWealthDraft() {
  return { title: '山水之间理一理目标', intro: '道友，请留步。先看文化，再沿水岸整理目标；时刻都是规划建议。', itinerary: [
    { day: 1, title: '山水与文化', stops: [
      { spotId: 'zhengyi', duration: 45, reason: '在允许参观的区域了解文化。', activities: [{ wish: 'wealth', text: '写下一个求财目标，核对这趟预算。' }] },
      { spotId: 'river', duration: 60, reason: '沿水岸观察山体与河谷。', activities: [{ wish: 'general', text: '留一点安静观察和休息时间。' }] },
    ] },
    { day: 2, title: '循着上清的线索', stops: [
      { spotId: 'shangqing', duration: 60, reason: '对照资料了解保护展示。', activities: [{ wish: 'general', text: '遵循现场开放区域与礼仪。' }] },
      { spotId: 'tianshi', duration: 60, reason: '慢看建筑与文化资料。', activities: [{ wish: 'general', text: '拍照前先核对现场提示。' }] },
    ] },
  ] };
}
test('single-wish protocol never offers other wish examples or raw interest IDs and makes daily limits explicit', async () => {
  let captured;
  const plan = createPlan(wealthOnly);
  const result = await enhancePlan(plan, async (instruction, data) => { captured = { instruction, data }; return validWealthDraft(); });
  assert.equal(result.mode, 'ai'); assert.equal(result.aiValidationAttempts, 1);
  assert.deepEqual(captured.data.allowedActivityWishes, ['wealth', 'general']);
  assert.deepEqual(captured.data.requiredWishActivities.map(item => item.wish), ['wealth']);
  assert.equal(captured.data.preferences.interests, undefined);
  assert.deepEqual(captured.data.interestLabels, ['道文化探秘', '山水放空']);
  assert.doesNotMatch(JSON.stringify(captured.data), /"relax"|"culture"|"romance"|"scenery"/);
  assert.ok(captured.data.dayOptions.every(day => day.minStops === 1 && day.maxStops === 2));
  assert.match(captured.instruction, /最多2站/);
  assert.match(captured.instruction, /interestLabels只是旅行偏好/);
  assert.doesNotMatch(captured.instruction, /"relax"|"culture"|"romance"|"scenery"/);
  const noWishes = createPlan({ ...wealthOnly, wishes: [] });
  await enhancePlan(noWishes, async (_instruction, data) => { assert.deepEqual(data.allowedActivityWishes, ['general']); assert.deepEqual(data.requiredWishActivities, []); return null; });
});

test('a real V2 wealth failure receives one exact-issue retry and only the new fully valid model route is accepted', async () => {
  const bad = clone(diagnosedWealthV2), original = clone(bad), fixed = validWealthDraft();
  let calls = 0, firstSignal;
  const result = await enhancePlan(createPlan(wealthOnly), async (instruction, data, schema, options) => {
    calls++;
    if (calls === 1) { firstSignal = options.signal; return schema.parse(bad); }
    assert.equal(options.signal, firstSignal);
    assert.deepEqual(data.previousDraft, original);
    assert.ok(data.validationFeedback.some(issue => issue.path === 'itinerary.0.stops' && issue.code === 'too_big'));
    assert.ok(data.validationFeedback.some(issue => issue.path === 'itinerary.0.stops.1.activities.0.wish' && issue.code === 'invalid_value'));
    assert.ok(data.validationFeedback.some(issue => issue.path === 'itinerary.1.stops.0.activities.0.wish' && issue.code === 'invalid_value'));
    assert.match(instruction, /唯一一次结构修正机会/);
    return schema.parse(fixed);
  });
  assert.equal(calls, 2); assert.equal(result.mode, 'ai'); assert.equal(result.aiValidationAttempts, 2);
  assert.deepEqual(result.itinerary.map(day => day.stops.map(stop => stop.spotId)), fixed.itinerary.map(day => day.stops.map(stop => stop.spotId)));
  assert.deepEqual(result.itinerary[0].stops.map(stop => stop.time), ['09:00', '10:25']);
  assert.deepEqual(bad, original); // The service never silently removes the third stop or relabels an activity.
});

test('two schema failures are the hard retry limit and preserve labelled local fallback', async () => {
  const plan = createPlan(wealthOnly); let calls = 0;
  const result = await enhancePlan(plan, async () => { calls++; return clone(diagnosedWealthV2); });
  assert.equal(calls, 2); assert.equal(result.aiValidationAttempts, 2); assert.equal(result.mode, 'local');
  assert.match(result.notice, /未通过校验/); assert.deepEqual(result.itinerary, plan.itinerary);
});

test('transport, auth, malformed JSON and cancellation failures are never retried', async () => {
  for (const code of ['AUTH_FAILED', 'NETWORK_ERROR', 'INVALID_RESPONSE', 'TIMEOUT', 'CANCELLED', 'BUSY']) {
    let calls = 0;
    const result = await enhancePlan(createPlan(wealthOnly), async () => { calls++; throw Object.assign(new Error('fixture'), { code }); });
    assert.equal(calls, 1, code); assert.equal(result.mode, 'local', code);
  }
});

test('one shared deadline aborts a pending repair call and caller cancellation reaches the generator', async () => {
  let calls = 0, observed, upstreamStopped = false;
  const result = await enhancePlan(createPlan(wealthOnly), async (_instruction, _data, _schema, { signal }) => {
    calls++; if (calls === 1) return clone(diagnosedWealthV2);
    observed = signal;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(validWealthDraft()), 200);
      signal.addEventListener('abort', () => { upstreamStopped = true; clearTimeout(timer); reject(signal.reason); }, { once: true });
    });
  }, { budgetMs: 25 });
  assert.equal(calls, 2); assert.equal(observed.aborted, true); assert.equal(upstreamStopped, true); assert.equal(result.mode, 'local');
  const controller = new AbortController(); let cancellationSignal;
  const job = enhancePlan(createPlan(wealthOnly), async (_instruction, _data, _schema, { signal }) => {
    cancellationSignal = signal; controller.abort(); throw signal.reason;
  }, { signal: controller.signal });
  assert.equal((await job).mode, 'local'); assert.equal(cancellationSignal.aborted, true);
});

test('missing or excess day entries and empty days remain schema feedback rather than internal crashes', () => {
  const schema = personalizedPlanDraftSchema(createPlan(wealthOnly));
  for (const mutate of [draft => draft.itinerary.push(clone(draft.itinerary[1])), draft => { draft.itinerary[0].stops = []; }, draft => { draft.itinerary = []; }]) {
    const draft = validWealthDraft(); mutate(draft); assert.equal(schema.safeParse(draft).success, false);
  }
});

const diagnosedWealthV3 = [
  {
    "title": "两天慢游龙虎山：山水与道文化",
    "intro": "两天走得不急，一天看水与丹霞，一天访上清的道文化。求财这件事，先落成一纸可核对的预算，再进山。",
    "itinerary": [
      {
        "day": 1,
        "title": "沿水看山，慢慢走",
        "stops": [
          {
            "spotId": "river",
            "duration": 90,
            "reason": "先顺水岸走一段，看丹霞与河谷形态。",
            "activities": [
              {
                "wish": "wealth",
                "text": "写下一个求财目标，核对这趟预算与余钱。"
              },
              {
                "wish": "general",
                "text": "留意竹筏与水边提示，不自行涉水。"
              }
            ]
          },
          {
            "spotId": "zhengyi",
            "duration": 60,
            "reason": "节奏放缓，看一处道教文化地点。",
            "activities": [
              {
                "wish": "general",
                "text": "进观前收声慢行，拍摄先看现场提示。"
              }
            ]
          }
        ]
      },
      {
        "day": 2,
        "title": "上清片区，院落与遗址",
        "stops": [
          {
            "spotId": "tianshi",
            "duration": 90,
            "reason": "在上清片区看道教文化院落，步调从容。",
            "activities": [
              {
                "wish": "wealth",
                "text": "把求财愿望写成一句话，顺手记下今年收支重点。"
              },
              {
                "wish": "general",
                "text": "尊重场所礼仪，给休息留一点时间。"
              }
            ]
          },
          {
            "spotId": "shangqing",
            "duration": 90,
            "reason": "看遗址与陈列，走走停停不赶路。",
            "activities": [
              {
                "wish": "general",
                "text": "按现场开放区域参观，不越界不攀爬。"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "title": "两天慢游龙虎山：山水与道文化",
    "intro": "两天走得不急，一天看水与丹霞，一天访上清的道文化。求财这件事，先落成一纸可核对的预算，再进山。",
    "itinerary": [
      {
        "day": 1,
        "title": "沿水看山，慢慢走",
        "stops": [
          {
            "spotId": "river",
            "duration": 90,
            "reason": "先顺水岸走一段，看丹霞与河谷形态。",
            "activities": [
              {
                "wish": "wealth",
                "text": "写下这趟的求财目标，核对预算与余钱。"
              },
              {
                "wish": "general",
                "text": "留意竹筏与水边提示，不自行涉水。"
              }
            ]
          },
          {
            "spotId": "zhengyi",
            "duration": 60,
            "reason": "节奏放缓，看一处道教文化地点。",
            "activities": [
              {
                "wish": "general",
                "text": "进观前收声慢行，拍摄先看现场提示。"
              }
            ]
          }
        ]
      },
      {
        "day": 2,
        "title": "上清片区，院落与遗址",
        "stops": [
          {
            "spotId": "tianshi",
            "duration": 90,
            "reason": "在上清片区看道教文化院落，步调从容。",
            "activities": [
              {
                "wish": "wealth",
                "text": "再核一遍这趟预算，记下今年进项重点。"
              },
              {
                "wish": "general",
                "text": "尊重场所礼仪，给休息留一点时间。"
              }
            ]
          },
          {
            "spotId": "shangqing",
            "duration": 90,
            "reason": "看遗址与陈列，走走停停不赶路。",
            "activities": [
              {
                "wish": "general",
                "text": "按现场开放区域参观，不越界不攀爬。"
              }
            ]
          }
        ]
      }
    ]
  }
];


test('both verbatim real V3 wealth drafts pass on their first attempt and preserve ordinary financial actions', async () => {
  for (const raw of diagnosedWealthV3) {
    assert.equal(personalizedPlanDraftSchema(createPlan(wealthOnly)).safeParse(raw).success, true);
    let calls = 0;
    const result = await enhancePlan(createPlan(wealthOnly), async () => { calls++; return clone(raw); });
    assert.equal(calls, 1); assert.equal(result.mode, 'ai'); assert.equal(result.aiValidationAttempts, 1);
    assert.equal(result.itinerary[1].stops[0].activities[0], raw.itinerary[1].stops[0].activities[0].text);
  }
});
test('financial action synonyms are accepted but desire slogans and action-free financial nouns are not', () => {
  const schema = personalizedPlanDraftSchema(createPlan(wealthOnly));
  for (const text of ['把求财愿望写成一句话，顺手记下今年收支重点。', '再核一遍这趟预算，记下今年进项重点。', '梳理这个月的收入和开支，记下结余。', '把旅行花费列成清单，算一算可留的储蓄。']) {
    const draft = validWealthDraft(); draft.itinerary[0].stops[0].activities[0].text = text;
    assert.equal(schema.safeParse(draft).success, true, text);
  }
  for (const text of ['求财，愿事业顺遂。', '我想拥有更多财富。', '今年的收入和支出。', '财源广进，好运常伴。', '心里想着预算与目标。', '核对预算后保证发财。']) {
    const draft = validWealthDraft(); draft.itinerary[0].stops[0].activities[0].text = text;
    assert.equal(schema.safeParse(draft).success, false, text);
  }
});

const diagnosedCombinedDrafts = [
  {
    "title": "龙虎山两日慢行：水岸看云，山中问心",
    "intro": "两天走得不急，第一天沿水看丹霞，第二天进上清片区看道文化。愿望是看风景和求财，都放进日常动作里，不承诺灵验。",
    "itinerary": [
      {
        "day": 1,
        "title": "沿水看山，把心放空",
        "stops": [
          {
            "spotId": "river",
            "duration": 90,
            "reason": "顺水岸看丹霞与河谷，慢下来对眼睛好。",
            "activities": [
              {
                "wish": "scenery",
                "text": "在开放水岸静看丹霞山体与河流走向"
              },
              {
                "wish": "wealth",
                "text": "写下这趟想带走的求财目标，顺手核对预算"
              }
            ]
          },
          {
            "spotId": "danxia",
            "duration": 60,
            "reason": "专看红色沉积岩的形态，走一段就够。",
            "activities": [
              {
                "wish": "scenery",
                "text": "沿开放步道观察丹霞岩层与风化痕迹"
              }
            ]
          }
        ]
      },
      {
        "day": 2,
        "title": "上清片区，礼与静各半",
        "stops": [
          {
            "spotId": "tianshi",
            "duration": 90,
            "reason": "走一走天师府，看自然与当地文化传统如何相连。",
            "activities": [
              {
                "wish": "general",
                "text": "按现场提示安静参观，留些时间在院里坐坐"
              },
              {
                "wish": "wealth",
                "text": "在心里把求财的念头收一收，认清哪些是实做功夫"
              }
            ]
          },
          {
            "spotId": "shangqing",
            "duration": 90,
            "reason": "看遗址展示与出土陈列，节奏放慢些。",
            "activities": [
              {
                "wish": "scenery",
                "text": "在开放区域看遗址与周边山势的照应"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "title": "龙虎山两日慢行：水岸看云，山中问心",
    "intro": "两天走得不急，第一天沿水看丹霞，第二天进上清片区看道文化。看风景和求财都落进手头能做的事，不承诺灵验。",
    "itinerary": [
      {
        "day": 1,
        "title": "沿水看山，把心放空",
        "stops": [
          {
            "spotId": "river",
            "duration": 90,
            "reason": "顺水岸看丹霞与河谷，慢下来对眼睛好。",
            "activities": [
              {
                "wish": "scenery",
                "text": "在开放水岸静看丹霞山体与河流走向"
              },
              {
                "wish": "wealth",
                "text": "写下这趟想带走的求财目标，顺手核对预算"
              }
            ]
          },
          {
            "spotId": "danxia",
            "duration": 60,
            "reason": "专看红色沉积岩的形态，走一段就够。",
            "activities": [
              {
                "wish": "scenery",
                "text": "沿开放步道观察丹霞岩层与风化痕迹"
              }
            ]
          }
        ]
      },
      {
        "day": 2,
        "title": "上清片区，礼与静各半",
        "stops": [
          {
            "spotId": "tianshi",
            "duration": 90,
            "reason": "走一走天师府，看自然与当地文化传统如何相连。",
            "activities": [
              {
                "wish": "wealth",
                "text": "把求财目标写成三条可落地的实做功夫，再收起来"
              },
              {
                "wish": "general",
                "text": "按现场提示安静参观，留些时间在院里坐坐"
              }
            ]
          },
          {
            "spotId": "shangqing",
            "duration": 90,
            "reason": "看遗址展示与出土陈列，节奏放慢些。",
            "activities": [
              {
                "wish": "scenery",
                "text": "在开放区域观察遗址与周边山势的照应"
              }
            ]
          }
        ]
      }
    ]
  }
];


const combinedPreferences = { ...wealthOnly, wishes: ['scenery', 'wealth'], departureDate: '2026-11-02' };
test('real combined-wish drafts retain valid whole-trip coverage despite extra reflections and unindexed observations', async () => {
  for (const raw of diagnosedCombinedDrafts) {
    const plan = createPlan(combinedPreferences);
    assert.equal(personalizedPlanDraftSchema(plan).safeParse(raw).success, true);
    let calls = 0;
    const result = await enhancePlan(plan, async () => { calls++; return clone(raw); });
    assert.equal(calls, 1); assert.equal(result.mode, 'ai'); assert.equal(result.aiValidationAttempts, 1);
    assert.deepEqual(result.itinerary.map(day => day.stops.map(stop => stop.activities)), raw.itinerary.map(day => day.stops.map(stop => stop.activities.map(activity => activity.text))));
    assert.deepEqual(result.itinerary.map(day => day.date), ['2026-11-02', '2026-11-03']);
  }
});
test('wish slogans alone cannot satisfy selected-wish coverage even when title and intro name the wishes', () => {
  const raw = clone(diagnosedCombinedDrafts[0]);
  for (const day of raw.itinerary) for (const stop of day.stops) for (const activity of stop.activities) {
    if (activity.wish === 'wealth') activity.text = '求财，愿事业顺遂。';
    if (activity.wish === 'scenery') activity.text = '愿一路风景正好。';
  }
  const result = personalizedPlanDraftSchema(createPlan(combinedPreferences)).safeParse(raw);
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some(issue => issue.message.includes('缺少回应wealth')));
  assert.ok(result.error.issues.some(issue => issue.message.includes('缺少回应scenery')));
});
test('removing a selected wishs sole concrete action fails even when extra tagged reflections remain', () => {
  const raw = clone(diagnosedCombinedDrafts[0]);
  raw.itinerary[0].stops[0].activities = raw.itinerary[0].stops[0].activities.filter(activity => activity.wish !== 'wealth');
  assert.ok(raw.itinerary[1].stops[0].activities.some(activity => activity.wish === 'wealth'));
  const result = personalizedPlanDraftSchema(createPlan(combinedPreferences)).safeParse(raw);
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some(issue => issue.message.includes('缺少回应wealth')));
});
test('photo creative prompts distinguish directly shareable copy from production metadata without inventing experiences', async () => {
  const notes = '最近有点忙，想慢下来看看山水，还没有出发。';
  const shareable = { ...modelCreative(), content: '想把日子过慢一点。给自己留一段看看山水的时间，不急着赶到哪里，也不急着把愿望说完。等这一程出发时，就带着一点好奇心，去听风、看水，慢慢走。' };
  let instruction;
  const result = await createJournal({ ...journalInput, notes, photoMeta: { width: 1280, height: 800, type: 'image/jpeg' } }, async (prompt, data, schema) => {
    instruction = prompt;
    assert.equal(data.notes, notes); assert.deepEqual(data.photoMeta, { width: 1280, height: 800, type: 'image/jpeg' });
    return schema.parse(shareable);
  });
  assert.match(instruction, /content必须是用户可直接复制发布/);
  assert.match(instruction, /制作步骤、分辨率、像素宽高、API、照片元信息、隐私说明/);
  assert.match(instruction, /不得写进content/);
  assert.match(instruction, /只由creative字段和系统disclosure\/UI承担/);
  assert.match(instruction, /不得虚构亲历、同行人物或实际看见的景象/);
  assert.match(instruction, /当下感受或未来向往/);
  assert.equal(result.mode, 'ai'); assert.equal(result.content, shareable.content);
  assert.equal(result.disclosure, CREATIVE_DISCLOSURE);
});
