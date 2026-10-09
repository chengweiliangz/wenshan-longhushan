import { z } from 'zod';
import { spots, interests } from '../shared/catalog.mjs';
import { TRAVEL_WISHES } from '../shared/creativeContract.mjs';

export const planSchema = z.object({
  days: z.number().int().min(1).max(3),
  budget: z.number().int().min(200).max(3000),
  interests: z.array(z.enum(['relax', 'culture', 'photo', 'explore'])).min(1).max(4),
  pace: z.enum(['slow', 'balanced', 'full']),
  wishes: z.array(z.enum(TRAVEL_WISHES.map(wish => wish.id))).max(3).default([]),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const date = new Date(value + 'T00:00:00Z'); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }, '请填写真实的 YYYY-MM-DD 日期。').optional(),
}).strict().superRefine((preferences, context) => {
  if (!preferences.departureDate) return;
  const lastDay = new Date(preferences.departureDate + 'T00:00:00Z');
  if (Number.isNaN(lastDay.getTime())) return; // The date field supplies this error.
  lastDay.setUTCDate(lastDay.getUTCDate() + preferences.days - 1);
  if (lastDay.getUTCFullYear() > 9999) context.addIssue({ code: 'custom', path: ['departureDate'], message: '整个行程日期必须保持 YYYY-MM-DD 格式。' });
});

export function createPlan(input) {
  const preferences = planSchema.parse(input);
  const { days, budget, pace } = preferences;
  const selected = [...new Set(preferences.interests)];
  const wishes = [...new Set(preferences.wishes)];
  const ranked = spots.map((spot, index) => ({ ...spot, score: spot.tags.filter(t => selected.includes(t)).length * 5 + (wishes.some(w => ['wealth', 'romance'].includes(w)) && spot.tags.includes('culture') ? 4 : 0) + (wishes.includes('scenery') && spot.tags.some(t => ['relax', 'explore', 'photo'].includes(t)) ? 4 : 0) - (pace === 'slow' ? spot.effort : 0), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const count = pace === 'slow' ? 2 : pace === 'balanced' ? 3 : 4;
  const used = new Set();
  const itinerary = Array.from({ length: days }, (_, index) => {
    const available = ranked.filter(s => !used.has(s.id));
    const zone = available[0]?.zone;
    // Keep actual geographic areas together, with no repeated POIs across days.
    const dailyLimit = Math.min(count, Math.ceil(available.length / (days - index)));
    const daily = available.filter(s => s.zone === zone).slice(0, dailyLimit);
    if (!daily.length) daily.push(...available.slice(0, count));
    daily.forEach(s => used.add(s.id));
    const stops = scheduleStops(daily.map(spot => ({
      spotId: spot.id, activities: localActivities(wishes, spot), duration: spot.minutes,
      reason: spot.tags.some(t => selected.includes(t)) ? `呼应你想要的「${interests.filter(i => spot.tags.includes(i.id) && selected.includes(i.id)).map(i => i.label).join('、')}」` : '为这一程补上一种不同的体验',
    })));
    return { day: index + 1, ...(preferences.departureDate ? { date: itineraryDate(preferences.departureDate, index) } : {}), title: daily[0]?.tags.includes('culture') ? '听一段山中的故事' : '把时间交给山水', zone: zone || '自由漫游', stops, freeTime: '其余时间留给用餐、接驳和自由漫步；时刻为规划建议。' };
  });
  const lodging = (days - 1) * (budget / days >= 650 ? 280 : 160);
  const meals = days * 80;
  const transport = days * 40;
  const tickets = 260;
  const total = lodging + meals + transport + tickets;
  return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), preferences: { ...preferences, interests: selected, wishes },
    title: selected.includes('culture') ? '入山寻道，偷得几日闲' : selected.includes('photo') ? '把山水装进取景框' : '这一程，只管自在',
    intro: `道友，请留步。给自己 ${days} 天，把脚步放慢。我按${interests.filter(i => selected.includes(i.id)).map(i => i.label).join('与')}的偏好，为你留好了这一程的风景。`,
    itinerary, costs: { lodging, meals, transport, tickets, total },
    budgetStatus: total <= budget ? 'within' : 'over',
    budgetNote: total <= budget ? `预计留有 ¥${budget - total} 弹性空间。` : `示例估算超出预算 ¥${total - budget}，建议提高预算、缩短天数或核实票种后调整。`,
    disclaimer: '费用为每人示例估算，门票预留不是实际报价；不含往返鹰潭大交通。请核验景区开放、交通和票价后再出行。',
    mode: 'local', modeLabel: '本地规则攻略', sources: [...new Set(itinerary.flatMap(day => day.stops.flatMap(stop => spots.find(s => s.id === stop.spotId).sourceIds)))] };
}

export function itineraryDate(departureDate, offset) {
  const date = new Date(departureDate + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function localActivities(wishes, spot) {
  const activities = [];
  if (wishes.includes('wealth')) activities.push('把求财的愿望写成一个能执行的小目标，顺手整理这趟旅行的开销。');
  if (wishes.includes('romance')) activities.push('给同行的人或在意的人写一句心意；合影前先核对现场拍摄提示。');
  if (wishes.includes('scenery')) activities.push(spot.tags.includes('culture') ? '沿允许参观的区域观察建筑与院落，停下来记录一个细节。' : '在开放步道上观察山体与水岸，留一分钟静看风景。');
  return activities.length ? activities : ['按现场提示走开放区域，给观察和休息留一点余地。'];
}
// Both local and AI itineraries use these planning assumptions. This assigns
// clocks only; it never truncates, drops or shortens an AI-selected stop.
export function scheduleStops(stops) {
  let clock = 9 * 60;
  return stops.map(stop => {
    if (clock >= 12 * 60 && clock < 13 * 60) clock = 13 * 60;
    const time = `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`;
    clock += stop.duration + 40;
    return { ...stop, time };
  });
}
export function planDayOptions(plan) {
  return plan.itinerary.map(day => ({ day: day.day, zone: day.zone, candidates: spots.filter(spot => spot.zone === day.zone).map(spot => ({ spotId: spot.id, name: spot.name, referenceMinutes: spot.minutes, minDuration: Math.ceil(spot.minutes * 0.5 / 5) * 5, maxDuration: Math.ceil(spot.minutes * 1.5 / 5) * 5, effort: spot.effort })) }));
}
