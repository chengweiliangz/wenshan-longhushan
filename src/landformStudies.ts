export type StudyVec3 = [number, number, number];

/** Coordinates use the GLB's own research units; this is not a geographic asset. */
export type LandformStudy = {
  id: string;
  label: string;
  modelSrc: string;
  source: string;
  sourceLabel: string;
  notice: string;
  camera?: StudyVec3;
  target?: StudyVec3;
};

/** Keyed by spotId. Register only assets accepted by the parent integration review. */
export const landformStudies: Partial<Record<string, LandformStudy>> = {
  "elephant": {
    "id": "elephant-photo-art-study",
    "label": "象鼻山连体石拱观察",
    "modelSrc": "/models/elephant-artistic-surface-ba-p2.glb",
    "source": "https://www.chinanews.com/tp/hd2011/2025/04-18/1148890.shtml",
    "sourceLabel": "照片参考、局部艺术化补全，未定标定位",
    "notice": "参考实拍制作的局部石拱模型；深度、背面、山脚及表面风化为艺术化补全。岩层细节和植被仍待完善。非实景扫描，未核实米制尺度、地理位置与朝向；模型使用任意展示单位。",
    "camera": [-45.83978165194061, 114.51188035893827, 545.1927655972265],
    "target": [21.459609985351562, 41.60420608520508, -15.635498046875]
  }
};
