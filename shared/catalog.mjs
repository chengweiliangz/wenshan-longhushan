export { placeAssets } from './place-assets.mjs';
export const sources = [
  { id: 'thad-shangqing', title: '清华设计院 · 大上清宫遗址保护设施', url: 'https://www.thad.com.cn/front/page/news_info?id=400', checked: '2026-10-02' },
  { id: 'osm-geo', title: 'OpenStreetMap · 社区地理数据', url: 'https://www.openstreetmap.org/copyright', checked: '2026-10-02' },
  { id: 'unesco-heritage', title: 'UNESCO · 中国丹霞世界遗产', url: 'https://whc.unesco.org/en/list/1335/', checked: '2026-09-29' },
  { id: 'unesco-geopark', title: 'UNESCO · 龙虎山世界地质公园', url: 'https://www.unesco.org/en/iggp/longhushan-unesco-global-geopark', checked: '2026-09-29' },
];

// Costs, walking effort and durations below are planning assumptions, not vendor quotes.
export const spots = [
  { id: 'river', name: '泸溪河', subtitle: '一筏碧水，半日清闲', category: '山水放空', zone: '龙虎山片区', tags: ['relax', 'photo'], minutes: 90, effort: 1, art: 'river', icon: 'water', description: '沿水岸读懂龙虎山的山水关系，换一个角度看丹霞。水上游览是否开放，请以景区当天公告为准。', fact: '龙虎山世界地质公园的丹霞景观与河流侵蚀作用有关。顺着水岸观察，可以对照山体与河谷的形态。', sourceIds: ['unesco-geopark'], note: '竹筏需另行核验票价、班次与开放情况；不可自行涉水。' },
  { id: 'elephant', name: '象鼻山', subtitle: '山有形，想象没有边界', category: '丹霞寻奇', zone: '龙虎山片区', tags: ['photo', 'explore'], minutes: 90, effort: 3, art: 'mountain', icon: 'mountain', description: '找一找山间那只“大象”。天然石拱与青绿植被一起，构成一堂看得见的地质课。', fact: 'UNESCO 将象鼻山描述为由侵蚀作用塑造的丹霞天然石桥，岩石形态像大象伸出的鼻子。', sourceIds: ['unesco-geopark'], note: '含步行与台阶。雨天留意路滑，遵循开放步道。' },
  { id: 'zhengyi', name: '正一观', subtitle: '在古建筑间，慢下来', category: '道文化', zone: '龙虎山片区', tags: ['culture', 'relax'], minutes: 60, effort: 1, art: 'temple', icon: 'temple', description: '从建筑和文化传统出发，认识龙虎山。给自己一段安静步行和观察的时间。', fact: '正一观是 UNESCO 龙虎山世界地质公园介绍中列出的道教文化地点之一。', sourceIds: ['unesco-geopark'], note: '尊重宗教场所礼仪，拍摄前留意现场提示。' },
  { id: 'tianshi', name: '嗣汉天师府', subtitle: '把历史，走成一段风景', category: '人文漫步', zone: '上清片区', tags: ['culture', 'photo'], minutes: 90, effort: 1, art: 'temple', icon: 'temple', description: '在传统建筑之间漫步，把道教文化从名词变成可感知的空间。', fact: '天师府是 UNESCO 龙虎山世界地质公园介绍中的重要道教文化地点。龙虎山的自然景观与当地文化传统联系紧密。', sourceIds: ['unesco-geopark'], note: '开放时间与入场方式需出行前向景区核验。' },
  { id: 'shangqing', name: '大上清宫', subtitle: '循着文化的线索走一程', category: '道文化', zone: '上清片区', tags: ['culture', 'explore'], minutes: 90, effort: 2, art: 'temple', icon: 'temple', description: '认识大上清宫的现状：南部复建建筑、考古遗址与现代保护展示设施。沿中路、东路和西路的实拍资料观察不同的保护方式。', fact: '清华设计院项目资料区分南部1990年代复建建筑与现代保护设施：中路展示遗址，东路原状揭露，西路陈列出土文物。', sourceIds: ['thad-shangqing'], note: '具体参观区域及交通接驳以景区现场安排为准。' },
  { id: 'danxia', name: '丹霞观察漫步', subtitle: '给山水，多一点好奇心', category: '自然观察', zone: '龙虎山片区', tags: ['explore', 'relax'], minutes: 60, effort: 1, art: 'mountain', icon: 'mountain', description: '在开放步道上观察红色岩壁、植被与水岸。这个主题活动可按体力随时缩短。', fact: '龙虎山是“中国丹霞”世界自然遗产的组成部分。红色沉积岩受抬升、风化和侵蚀等作用，形成多样地貌。', sourceIds: ['unesco-heritage'], note: '此项为产品设计的主题活动，并非独立售票景点。' },
];

export const interests = [
  { id: 'relax', label: '山水放空', emoji: 'Leaf' },
  { id: 'culture', label: '道文化探秘', emoji: 'Landmark' },
  { id: 'photo', label: '出片打卡', emoji: 'Camera' },
  { id: 'explore', label: '自然探索', emoji: 'Mountain' },
];
