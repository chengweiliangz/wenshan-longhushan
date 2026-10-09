// Public Ctrip destinations checked 2026-10-07. These are outbound query links,
// not inventory, price or order APIs. No unverified date/budget query parameters.
export const BOOKING_DESTINATIONS = Object.freeze({
  longhushan: 'https://you.ctrip.com/sight/guixi1189/137685.html',
  yingtanHotels: 'https://hotels.ctrip.com/hotel/yingtan534/',
});

const SPOT_NAMES = new Map([
  ['river', '泸溪河'], ['elephant', '龙虎山象鼻山'], ['zhengyi', '正一观'],
  ['tianshi', '嗣汉天师府'], ['shangqing', '大上清宫'], ['danxia', '丹霞观察漫步'],
]);
const PALACES = new Set(['zhengyi', 'tianshi', 'shangqing']);

/** Strict Gregorian YYYY-MM-DD validation without local-time parsing. */
export function isValidBookingDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function checkoutDate(checkIn, nights) {
  const [year, month, day] = checkIn.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + nights));
  const result = date.toISOString().slice(0, 10);
  return isValidBookingDate(result) ? result : null;
}

/**
 * Link only this itinerary's known Longhushan stops. One regional ticket-information
 * link avoids implying that every palace/activity is an individually sold product.
 * Dates are local planning guidance only; users choose them again at Ctrip.
 * @param {{ preferences?: { days?: number, budget?: number, departureDate?: string }, itinerary?: { stops?: { spotId?: string }[] }[] } | null} [plan]
 * @returns {{ id: string, label: string, url: string, description: string }[]}
 */
export function buildBookingLinks(plan) {
  const itinerary = Array.isArray(plan?.itinerary) ? plan.itinerary : [];
  const spotIds = [...new Set(itinerary.flatMap(day => Array.isArray(day?.stops)
    ? day.stops.map(stop => stop?.spotId).filter(id => SPOT_NAMES.has(id)) : []))];
  if (!spotIds.length) return [];

  const preferences = plan?.preferences;
  const departure = isValidBookingDate(preferences?.departureDate) ? preferences.departureDate : null;
  const hasPalace = spotIds.some(id => PALACES.has(id));
  const dateNote = departure ? `计划 ${departure} 出发；` : '';
  const links = [{
    id: 'longhushan-tickets',
    label: '去携程查龙虎山票务',
    url: BOOKING_DESTINATIONS.longhushan,
    description: `对应行程：${spotIds.map(id => SPOT_NAMES.get(id)).join('、')}。${dateNote}打开江西鹰潭龙虎山景区详情及票务信息。当前页面需扫码至微信小程序查看相关商品；请核实票种、游玩日期与开放安排。${hasPalace ? '宫观是否包含在所选票种内，请另行确认。' : ''}`,
  }];

  const days = preferences?.days;
  if (Number.isInteger(days) && days >= 2 && days <= 3) {
    const nights = days - 1;
    const checkout = departure ? checkoutDate(departure, nights) : null;
    const stay = checkout ? `参考行程：${departure} 入住，${checkout} 退房，${nights} 晚。` : `行程建议住宿 ${nights} 晚。`;
    links.push({
      id: 'yingtan-hotels',
      label: '去携程查鹰潭住宿',
      url: BOOKING_DESTINATIONS.yingtanHotels,
      description: `${stay}已定位鹰潭酒店列表；请在携程内选择实际入离日期、位置及房型，日期和预算不会自动带入。`,
    });
  }
  return links;
}
