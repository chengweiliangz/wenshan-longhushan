// Public recipe choices shared by the API and browser compositor. No image
// bytes, provider credential or model transport configuration belongs here.
export const TRAVEL_WISHES = Object.freeze([
  Object.freeze({ id: 'wealth', label: '求财', hint: '把愿望整理成预算和可执行的小目标' }),
  Object.freeze({ id: 'romance', label: '姻缘', hint: '给陪伴、交流与表达心意留一点时间' }),
  Object.freeze({ id: 'scenery', label: '看风景', hint: '停下来观察丹霞、建筑和水岸' }),
]);
export const CREATIVE_CONTRACT = Object.freeze({
  themes: Object.freeze(['mist', 'moon', 'ink']),
  palettes: Object.freeze(['jade', 'indigo', 'ochre']),
  motions: Object.freeze(['drift', 'rise', 'pan']),
  photoTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
  duration: 12,
  fogMin: 0,
  fogMax: 0.5,
  maxPhotoDimension: 20000,
});
export const CREATIVE_DISCLOSURE = '照片只在浏览器里参与合成；模型只收到宽高、文件类型和文字，不识别照片内容。效果由浏览器把原照片、字幕、调色和动效合成，未调用扩散图生图或视频生成模型。';
