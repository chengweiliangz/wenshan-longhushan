## 2026-10-03 正式发布专项闭环

当前正式入口为 index-DWxvzDi3.js。正一观 AB/V 与象鼻山 Y2 均通过真实发布请求核对；进入、观察/旋转及照片往返专项通过。路线平面统一浅底，天师府/上清编号避让与手机下置图均经实际字形边界及独立看图确认。

初轮报告保留手机对比页严格200断言失败（原状态未记录）；后续缓存诊断复现200→304。补验禁用缓存，两个尺寸对比页图片齐全、无横向溢出。浅底修复的补验36/36通过，未重跑已过的完整路线。独立复核记录保留限定范围，不代表精细地形、完整内部或实体手机已经完成。

## 2026-10-03 本批后续：象鼻山 Y2 与路线平面标注

象鼻山独立观察模型切换为 Y2，改善轮廓台阶并保留贯通石拱。源 Blend、相对路径打包贴图与 GLB 已核验；候选网页专项组合 39/39、独立桌面/手机视觉复核通过。这里仍为照片约束的艺术化研究：没有可靠米制尺度或地理位置，背侧与深度并非实测；不接入真实地形。

路线平面文字改为可读深色，手机中放在画布下方；只为天师府/上清少数编号调整文字方位和边界，路线、观察点、移动位置及字号不变。正式构建与模型源/public/dist/HTTP一致；最终正式页面专项记录在 内部历史验证记录（开发环境路径已省略）。

## 正一观铺地与路线小图（2026-10-03）
独立石板PBR材质已正式接入，仅院面朝上两三角改变材质/UV，建筑、地理及路径不变；石板尺度与风化为照片指导的代表性估计，真实院中低台阶仍未建模。手机路线小图置于画布下方，文字可读且不遮宫观。相同机位前后、有效手机截图和独立复核已通过；旧素材版本保留。当前模型`zhengyi-courtyard-paving-v1.glb`，源与导出在B/workstreams/AB-zhengyi-paving；原路线几何验证通过实际导出等价链复用，未冒称对材质变更重跑碰撞采样。

## 正一观局部观察线（2026-10-03）
已新增圆门内侧至主殿石阶前4个观察节点，路线约43.322米为模型估计。正反向实拍支持圆门、院落和主殿关系；照片可见的院中低台阶尚未建模，现平面路径不能视为实地无台阶通路。复用正一观原独立模型，定位和外观资产未变。可切换对应实拍并返回原视角；桌面与手机尺寸模拟的202项交互断言已通过，包括实际到站、暂停恢复、照片往返、失败重试和原视角返回；照片所见院中低台阶仍是模型缺口。来源与三角几何报告见 public/assets/reports/zhengyi-route。

## 当前已发布批次（2026-10-03）

新增连续河湾接近与停留、完整正一观到达取景及真实跨片区区位提示。植被在高清/省电模式恢复依据源分区的树冠覆盖，修复无MSAA亮点与反复GPU状态查询造成的尖峰；代表性树冠不是实测林冠。模型地理、DEM、流水与已通过局部路线不变。

32项原测试与TypeScript通过；修复Windows模块基名冲突后Vite构建通过。实际网站15项针对交互检查通过，桌面与手机尺寸画面经实看；手机为桌面模拟，尚非实体手机实测。真实操作录屏与有限性能报告正在收尾。源包6份主用Blend在原目录及交付目录均通过只读重开，依赖缺失0。

精细真实丹霞、象鼻模型米制定位及三宫观完整真实内部仍未完成；现有局部路线/照片导览须按界面标明范围使用。

## 当前增量：宫观加载退出释放（2026-10-03）

正常退出与退出后才完成的GLTF解析统一释放本场景拥有的几何、材质、纹理和ImageBitmap，并对共享资源去重。真实浏览器两个case28/28通过；32项目测试、类型检查和生产构建通过。K植被v2、N运镜和O转场仍在独立验证，未发布。

## 当前已验证发布状态（2026-10-03T17:45:36.346820+08:00）
- 象鼻山照片约束/艺术化独立观察窗已接入，GLB v3 SHA256 7aa4e5a69fb8af57bcdc76cd3a58e00df1feedb9f11a823e77a0ada1c7bd9a1d（10,748,840 B）；模型、缩放、桌面/真实触摸、照片往返、失败重试与资源释放已有实际浏览器证据。仍无米制定位，未作为DEM地理资产。源Blend/纹理/复现位于B/workstreams/G-landform/versions/candidate-v3。
- 根据真实网页留白问题，LandformStudyView.tsx改为按实际方向拟合完整包围盒（含树冠），桌面/手机恢复全貌保持至少约12%边距；已丢失的WebGL上下文不再重复主动丢失。首轮46/47仅故障信号分类/重复告警未过，原记录保留；修正后仅33项相关取景/故障复测全部通过，非预期异常0。两轮记录B/workstreams/E-landform-viewer/qa/2026-10-03T09-35-26-817Z和2026-10-03T09-42-25-881Z。不将两轮计数拼成一次全测。
- 正一观ground-v2已发布（3c8351beee191ec848d97d278adfc47acad7ed9e091dffeee9af197a81835a5b，10,897,896 B）。旧大矩形土板改为21处局部土面及过渡坡肩；171建筑和17树、地理框架/路线/实拍不变。F独立源/渲染+真网站低侧复核接受；22项网站专项通过、真实鼠标到9°正侧低角、实拍返回与原相机恢复通过，错误0。宽距离截图未见明显开口，不代表近景测绘级无缝。证据B/workstreams/root-integration/zhengyi-ground-qa。
- 中文字体101 WOFF2子集本地托管，原字形/许可/OFL保留；真实浏览器500/600字形和HTTP/解析通过，无外网字体请求。手机地图天师府中心曾被上清宫圆点覆盖而误开，已仅在手机错开整个按钮并保留地理点位引导线；三个宫观的中心/标签真实触摸、Tab/Enter全部通过。字体专项使用?static避免无关3D负载，截图资料模式提示为主动测试方式。证据B/workstreams/root-integration/fonts。
- 本批资产/public/dist/实际HTTP hash一致，32现有测试和tsc/Vite已过（g3-d2-map-check.log）；后续view两处源码修正另经build通过（landform-fit-context-build.log）。
- H候选v2因闭合暗圈/迷彩色块被独立视觉拒绝；v3三定点GPU复拍无错误，但F/root认为相较原版细节被抹平、没有净改善，亦冻结不接。生产保留原材质。粗DEM仍约42m，不因材质试验声称精细地形完成。
- 下方均为历史阶段记录，旧G未登记/D未接地/字体外网等状态以本节为准。整体仍缺可靠精细丹霞与宫观完整内部，不宣称目标完成。

# 问山 · 龙虎山真实资料升级记录

本次版本：2026-10-03。当前交付为可运行的阶段样板，未达到目标文件的整体完成标准。大上清宫与正一观已接入各自的独立外观、带误差说明的影像定位与入口接近；仍未完成“实测建筑—连续真实内部空间”的完整还原，不把普通照片导览计作内部漫游完成。

## 工作副本与保存位置

- 网站：`[开发环境路径已省略]/龙虎山项目`。
- 原目录 ZIP 和六张参考图保留；未重复解压覆盖。初始代码备份：`[开发环境路径已省略]/baseline-code`。
- 以下使用 `B` 代表 `[开发环境路径已省略]/龙虎山项目`。
- 源模型：`B/models/shangqing-study.blend`；导出：`B/exports/shangqing-study.glb`，约3.02MB；发布副本：`public/assets/models/shangqing-study.glb`。
- Blender脚本、临时、配置、缓存、自动保存、源照片、瓦片、浏览器验证配置与演示全部在 B 下，未使用C盘数据目录。
- 进度入口：`B/checkpoints/LATEST.md`；源码/资产哈希清单在同目录，恢复时以实际文件与端口为准。

## 实际改造

旧背景使用程序山体、通用宫观与场景截图；当前由真实区域DEM、OSM河道和明确的数据对应表驱动。旧代码在 `LegacyLandscapeScene.ts` 与基线备份中保留，不再加载到主场景。

统一使用WGS84经纬度；`shared/geography.mjs`转换到以117°E、28.07°N为原点的局部米制坐标，X向东、-Z向北；渲染尺度每单位10m。此地区尺度使用局部球面投影近似，不能作为测绘或现场导航。正一观影像中心与天师府社区范围中心直线距离约5.67km，未为画面压缩距离。

两段OSM主河道按共享节点连接，流水纹理和竹筏均沿累计下游距离运行。`riverTerrain.ts`只在河道附近自适应细化并共享粗细网格边界，修复原先手机低画质的水面被地形遮断问题。原DEM不变。水面现由OSM映射多边形裁剪，包含变宽河湾和岛屿；显示河床深度与水位仍有假设，不是实测水文模拟。高清模式在首屏河段采样真实场景的局部平面倒影，省电模式用环境色；真实水下石块与实测浅滩细节尚未完成。

`PlacePhoto`、地点弹窗、地图和内部节点共用唯一地点ID。大上清宫接入独立资料GLB和5节点实拍照片导览，可旋转/缩放模型、切换实拍、放大照片、返回地点介绍及外部页面；打开弹窗暂停外部镜头，关闭恢复滚动位置与触发焦点。模型只在请求时加载，退出释放几何、材质、纹理及WebGL上下文。竖屏取景依据模型包围体自动适配。象鼻山与天师府分别使用4/3节点外观gallery；正一观现有8张对应照片，6节点照片导览含殿内实拍，并已接入自己的外观模型。天师府独立模型、各地真实全景仍未完成。

## 来源与精度

| 项目 | 依据 | 已核验范围与限制 |
|---|---|---|
| 区域高程 | [Mapzen/Tilezen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)，[归属说明](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) | 9张z13 Terrarium瓦片，257×225网格，约42m水平采样、高程41–419m。不能解析象鼻山天然石拱、陡崖和细微岸线；采样密度不代表测量精度。 |
| 河道 | [OSM way 72051564](https://www.openstreetmap.org/way/72051564)、[81192445](https://www.openstreetmap.org/way/81192445) | 白塔河上游泸溪河中心线；沿源节点下游顺序，原始 `references/region.osm` 可追溯。水面边界另由OSM relation17918405/way1306285176提供；流速和水深未测量。 |
| 正一观 | 2023-10-30 Esri/Vantor影像与阿尧2024-10-30现场照片；旧[OSM范围](https://www.openstreetmap.org/way/461704512)保留 | 主殿、山门、楼阁等6处影像控制点；中轴约42.94°，入口为人工判读，源标称精度5m之外还有屋顶视差。非实测。 |
| 嗣汉天师府 | [OSM way 461704514](https://www.openstreetmap.org/way/461704514) | 社区范围及其几何中心，精确入口、朝向和立面待核验。 |
| 象鼻山 | [OSM node 4571733038](https://www.openstreetmap.org/node/4571733038) | 仅观景台点，明确不是天然石拱中心。没有用普通山体附弯管冒充石拱。 |
| 大上清宫位置 | [OSM node 4571733211](https://www.openstreetmap.org/node/4571733211) | 伏魔殿/井POI，明确不是现代保护设施中心。该点保留为独立地标。保护设施已另用2023年影像与THAD总平面配准，没有摆放在伏魔殿点上。 |
| 大上清宫建筑与照片 | [清华设计院THAD原项目](https://www.thad.com.cn/front/page/news_info?id=400) | 现代保护设施、考古遗址和1990年代前序建筑分开理解。GLB为据公开平面比例与实拍估算的局部资料模型，无实测竣工精度，未复造神像与遗址细部。7张照片署名五季摄影/THAD；拍摄日期未给出，未见开放许可。 |
| 丹霞地貌知识 | [UNESCO中国丹霞](https://whc.unesco.org/en/list/1335/) | 地貌文字依据，不能替代具体山体的测绘。 |

OSM数据遵循[ODbL及归属要求](https://www.openstreetmap.org/copyright)。每张网页照片的来源、作者、日期未知项、缩放处理与校验值在 `shared/place-assets.mjs` 和 `public/assets/photos/manifest.json`。保留原图水印。未取得开放许可的参考照片只作为当前本机样板资料；公共发布所需授权列入缺口。

用户提供照片1751作为河岸参考使用，但具体河段、作者和拍摄日期未核验；1752保留为河岸参考；1753、1755地点未核实不用于封面；1754是区域地质图、1756是景点分布示意，均未作为精确定位底图。抖音指定链接无法访问，没有声称观看。Commons原图403、Overpass部分请求504/429已记录，未将下载失败资产写成已获取。

## 验证与演示

- `npm run check`：26项业务/接口/地理与素材一致性测试全部通过，TypeScript与Vite生产构建通过。Three.js现在拆分为core/module两个chunk（各约370–384kB），本轮构建无原先700kB体积警告。
- `.tools/verify-upgrade.mjs`：21项生产浏览器检查，覆盖首屏模型按需加载、大上清宫5节点、缩放、模型键盘进入、资源释放、外部暂停/返回、外观照片与内部缺口区分、规划/收藏/问答/手记、手机布局、静态降级、照片失败重试。
- `.tools/verify-interaction.mjs`：6项补充检查，覆盖减少动态/恢复、手机触屏5节点、模型拖动不误进入、返回介绍与关闭。设备为Chrome触屏模拟，不是实体手机。
- 最终结果、设备GPU、帧时间实测在 `B/logs/browser-verification.json` 和 `interaction-verification.json`。故意阻断一张照片测试重试时的ERR_FAILED为预期注入，不是未处理的运行失败。
- `B/previews/before-desktop.png` 与 `after-desktop.png` 为改造前后；`after-model.png`、`after-photo-guide.png`、`after-mobile.png`、`after-mobile-guide.png`、`after-mobile-model.png`分别记录建筑、照片和手机视口。
- `B/previews/water-continuous-10s.webm` 为页面实际WebGL画布连续录制，默认流速、30FPS录制目标，无背景视频替代；不是物理水文验证。竹筏真实尺度在远景中很小，尾流近景辨识仍需改进。

性能采样为同一Windows笔记本的Headless Chrome 154，实际WebGL报告Intel UHD/Direct3D11。桌面1920×1080和390×844移动视口各采样8秒，读取实际rAF间隔（包含场景逐帧渲染）。以JSON最终数据为准，不外推到常见设备，也未把“手机30FPS”目标当作真机实测。

## 复现

网站当前依赖已存在，无需再次解压；修改网站后从工作副本运行：

```powershell
$env:TEMP = 'E:\Wenshan-assets\tmp'
$env:TMP = $env:TEMP
npm run check
npm start
# 默认 http://127.0.0.1:4173；开发 npm run dev 对应5173
node .tools/verify-upgrade.mjs
node .tools/verify-interaction.mjs
node .tools/capture-water.mjs
```

运行浏览器脚本需要`.tools/node_modules/puppeteer-core`与本机Chrome，脚本中的浏览器路径可能需随机器调整。网站资源引用全部为相对站点路径，不依赖C盘资产。

重建Blender资料模型前备份手工改动；脚本会重新生成整份资料模型，不适用于合并艺术家修改：

```powershell
$assetRoot = 'E:\Wenshan-assets'
$env:TEMP = "$assetRoot\tmp"
$env:TMP = $env:TEMP
$env:BLENDER_USER_CONFIG = "$assetRoot\cache\blender-config"
$env:BLENDER_USER_SCRIPTS = "$assetRoot\cache\blender-scripts"
$env:BLENDER_USER_DATAFILES = "$assetRoot\cache\blender-data"
$env:PYTHONDONTWRITEBYTECODE = '1'
& "$assetRoot\tools\blender-4.5.3-windows-x64\blender.exe" --background --python "$assetRoot\scripts\build_shangqing.py"
```

4.5.3官方ZIP的SHA256已核对：`6b657c8bdd3a7b65b07b9e1ae17eb4be7dd4aa23121da7f3d3354fc2551330a7`。没有覆盖原Blender安装文件。`integrate_registry.py`、`integrate_ui.py`等是本次一次性迁移记录，**不要再次盲目运行**，以免重复追加或覆盖已修改源文件。

## 未完成与下一步

1. 大上清宫已通过公开影像和THAD平面完成轮廓/朝向/南侧中轴入口的近似配准，且在区域场景与外部查看器复用。已补齐总平面标注的前院钟鼓楼、棂星门和影像识别的林地。继续细化构件、材质及周边道路，并取得现场控制点降低绝对误差。
2. 用更高精度地形和多角度实拍完成首屏丹霞、岸线与天然石拱；当前区域DEM是实际地理基础，视觉细节仍粗糙。模型长廊屋脊已按长轴修正，原远景细条几何已换为过滤PBR瓦材质；仍需建筑细部和周边真实环境细化。
3. 大上清宫目前仅普通照片：需要实拍360°、内部扫描或带尺度多视角，才能升级连续内部体验。参观主题节点顺序不表示已验证连续通路。
4. 正一观独立模型已接入；天师府独立模型与象鼻山连体天然石梁仍未完成。正一观模型细部、彩画、院落植被仍需制作，不能把阶段外观写成精细实景还原。
5. 需实体手机性能/触控验证与实际浏览器长时间稳定性测试；正一观模型网络失败/重试已实际注入验证；当前未测项目不写成通过。首屏高程仍整块加载，后续分区LOD仍有优化空间。

## 2026-10-03：保护设施影像配准与南侧入口路径

查看了Esri World Imagery当前公开地图显示及地点元数据。实际匹配影像为2023-10-30的Vantor Vivid/WV02，字段SRC_RES=0.5m、SAMP_RES=0.6m、SRC_ACC=5m。该标称精度并非本次现场检核结果。局部地图参考保存在E盘`references/georeference`，仅用于核对，没有将底图重新发布为网页背景。

四个屋顶包络角点与THAD总平面尺寸共同约束模型位置。`public/assets/geo/shangqing-alignment.json`保存像素坐标、WGS84坐标、模型控制点、变换、数据来源及误差说明。拟合残差仅代表四角相对一致性；建筑高度产生的影像位移、人工判读和绝对地图误差仍存在，不能用该残差声称厘米级测绘。

- 保护设施中心：117.0451936°E，28.0467333°N；模型北轴方位约346.84°，尺度因子约1.01077。
- 南侧中轴门廊/台阶：117.0453143°E，28.0462658°N；不是整个景区的售票入口。
- 地面标高为DEM双线性估算约94.72m，不是实测地坪。
- 伏魔殿原POI移入`landmarks`保留，没有删除或混用。原配准前资产与脚本保存在`backups/before-georeference-2026-10-03`。
- 新增`modelLocalToWorld`/逆变换；测试对照四个独立影像控制点，保证模型与地图使用同一位置/朝向，并验证入口与旧伏魔殿点不同。

Blender源模型V2修正长廊屋脊方向、入口双侧开口和穿出屋檐的上部格栅。瓦片细条改为可编辑的自制PBR色彩/粗糙度/法线纹理（`B/textures/procedural`）；这些是与参考颜色相符的程序材质，不是扫描所得的古建筑表面。GLB已更新并含纹理。

外部查看器载入同一DEM的局部地形、应用影像方位，并增加接触阴影。选择“前往宫观入口”后可观察外部，再点击建筑、入口按钮或按Enter接近南侧台阶；再次Enter或点击入口进入对应照片节点。照片仍明确标为普通实拍导览，不冒充全景或连续内部三维。关闭后恢复原页面位置。区域场景在镜头接近上清时才加载模型，首屏不加载宫观GLB。

`.tools/verify-site.mjs`新增7项浏览器检查并已通过，包含实际区域模型变换、查看器坐标、入口镜头、同地点照片、返回位置、手机入口和脚本/着色器错误检查。截图为`georeferenced-exterior.png`、`shangqing-south-entry.png`、`shangqing-mobile-entry.png`、`georeferenced-regional-context.png`；记录在`logs/site-verification.json`。

## 2026-10-03：三地实拍、前院V3与林地

新增9张实拍，连同前轮8张共17张，每张均保留原有水印，等比例缩小/编码为480和1280上限的WebP，没有对低分辨率来源伪造增强细节。`width/height`记录原始尺寸，响应式srcset声明按实际输出宽度匹配。

- 象鼻山4个独立航拍角度：摄影刘力鑫，[中新网原图集，2021-09-26](https://www.chinanews.com/tp/hd2011/2021/09-26/1002752.shtml)。清楚记录石梁与主崖、洞口及周围峰丛。观景台POI仍未被冒用为石梁中心。
- 正一观2张：远景来自[中国网/中国道教协会合作展览](http://dao.china.com.cn/2017-11/02/content_40037609.htm)，入口来自[景区公开图文的新浪江西转载](https://jx.sina.cn/news/2023-12-30/detail-imzzvkcs2118683.d.html)。2017、2023为发布日期，摄影者及拍摄日期未提供。
- 天师府3张：头门来自[中国网专题](https://www.china.com.cn/cppcc/node_7221174.htm)，院内与檐部来自[张琦/新华网照片，中国青年网转载](https://tour.youth.cn/xw/202302/t20230223_14340740.htm)。图注未指明殿名的照片不自行命名；黑白旧貌未当作现状封面。

`references/locations`保留已下载原图、源页面、逐图URL、图注、校验值与选择记录。普通外观照片使用gallery，已有内部主题照片使用interior，两者不会因为点击“进入导览”而变成已完成的360°全景。新页面显示拍摄日期或明确的发布日期，不混用。

大上清宫V3的前院布置来自THAD总平面4/5/6号标注（1990年代鼓楼、钟楼、棂星门），控制像素与模型坐标保存于`references/georeference/shangqing-forecourt.json`。前院相对现代平台的高差、构件尺寸和高度是照片估计，非实测。补入外侧白墙、主殿侧面红色围护、台阶扶手，删除与实拍不符的外侧满铺格栅。未虚构碑文、神像、铃鼓或遗址石构件。

`site-ground.mjs`统一局部查看器和区域场景的显示整平：现代平台与低位前院分开；`riverTerrain.ts`在宫观附近额外细化到约5m，仅为了模型接地，不声称提升了原42m DEM的测量精度。原始地形JSON未改变。

`shangqing-vegetation.json`依据同一2023年影像人工选择林地范围，再筛去非绿色像素，形成1158个代表性采样点。程序化树冠与高度不是单木实测，也不代表真实树种；林地范围和照片中的场地关系有依据。道路、建筑、前院及可识别水面被排除，实际渲染再次避开建筑包络。只发布派生位置数据，没有将卫星影像作为网页底图分发。

新检查脚本`.tools/verify-location-photos.mjs`覆盖9张新增照片、地点对应、日期、返回和手机溢出。结果在`logs/location-photo-verification.json`，本轮23项通过。前院改动后的入口、坐标和返回已重新通过7项site检查，完整回归以最新JSON为准。

前院仍为资料模型：精细雕刻、现代设施遗址层、周边房屋道路、逼真林冠材质和真实内部连续空间仍需制作。不可将当前低细节林木与约略模型写成“实景扫描还原完成”。


前一阶段（01:41）验证：23项自动测试、21项完整浏览器回归、6项触屏/减少动态检查、7项地理入口检查、23项新增地点照片检查，共57项浏览器检查均通过。最后一次改动只缓存静态场景阴影，随后重新构建并通过7项入口检查。

前一阶段性能样本（Headless Chrome154 / Intel UHD / D3D11）：1920×1080主场景平均56.0FPS、p95 27.9ms；同机390×844低画质视口平均144.1FPS。新模型查看器含1139个实际渲染树木代表实例，在1124×540画布平均53.1FPS、p95 34.2ms；手机视口对应498×696画布平均62.9FPS、p95 22.4ms。模型与日光不变时复用静态阴影贴图，避免逐帧重新投影（优化前该查看器约40.6/47.2FPS）。这是8秒采样，不代表所有设备稳定下限；未测实体手机。详见logs/model-performance.json与browser-verification.json。

## 2026-10-03：正一观独立外观与照片内部节点

本阶段将正一观与大上清宫的数据配置分离。`ModelView`按spotId读取geo、入口名称、背景说明和可选林地；`siteContext`、`site-ground.mjs`接收同地点参数。区域场景用按地点的加载/重试状态，在靠近正一观或上清片区时分别按需加载独立GLB；首屏仍不请求宫观模型。

- 正一观主殿中心约116.9797397°E / 28.0671569°N；北轴约42.943°；圆洞山门近似位置116.9792354°E / 28.0666788°N，与主殿约72.7m。入口坐标由屋顶及现场照片对应判读，不能替代实测。
- `public/assets/geo/zhengyi-alignment.json`与`B/references/georeference/zhengyi/alignment.json`保留6个屋顶/牌坊控制点、像素坐标、WGS84坐标和建模局部坐标。旧OSM范围与中心保留为参考；未把范围中心当入口。
- 影像元数据日期2023-10-30、SRC_ACC=5m；5m不是本次实地检核精度，人工判读、屋顶视差另有误差。模型尺寸和台阶高差均为估计；DEM基准约74.29m。
- 独立源脚本`B/scripts/build_zhengyi.py`，源文件`B/models/zhengyi-study.blend`（2,661,006字节），导出`B/exports/zhengyi-study.glb`（1,727,336字节，10,150多边形），网站同名发布副本。未复制大上清宫布局；屋顶为简化重檐歇山，含圆洞山门、院落柱廊、院侧楼阁及前方牌坊。彩画只用参考色带，未编造铭文、雕刻、神像或内部陈设。
- 资料照片来自摄影师阿尧原帖：[正一观（一）](https://m.zol.com.cn/dcbbs/d33991_42960.html)、[正一观（三）](https://m.zol.com.cn/dcbbs/d33991_42986.html)。共下载22张参考，选6张进入网站：山门、院落主殿、檐部、殿内、地面香炉和楼阁。页面EXIF记录为2024-10-30，原帖发布于2025年5月；页面记录未经独立现场时间核验，UI明确标注“原帖EXIF记录”。未裁切或去水印，版权待授权。
- 普通殿内实拍不是360°全景；拍摄点方位及连续路线尚未测绘。完整网站目前23张实拍，manifest已同步。
- 修复截图发现的小径被显示地形遮断、门墙自阴影条纹及竖屏取景过窄；原DEM未改动。没有把正一观套用大上清宫的林木采样。
- 本轮修改前备份：`B/backups/before-zhengyi-2026-10-03`。天师府的9张小范围影像瓦片及元数据已在`B/references/georeference/tianshi`，尚未作入口校准或独立建模，后续直接使用现有资料继续。

新增`.tools/verify-zhengyi.mjs`实际检查区域定位、独立查看器、跨宫观切换、真实照片、内景出处、释放模型画布、原页面位置恢复、手机入口、模型失败清理与重试。日志为`B/logs/zhengyi-verification.json`；末段ERR_FAILED与加载失败日志是主动阻断模型请求产生的预期记录。源页面/原图保存在`B/references/locations/zhengyi-visit*`。

截图：`zhengyi-exterior.png`、`zhengyi-entry.png`、`zhengyi-mobile-entry.png`、`zhengyi-interior-photo.png`、`zhengyi-regional.png`。在普通实拍和模型之间可返回，但并不等同于连续内部三维漫游。总体目标保持进行中。

本阶段最终验证（2026-10-03T02:26:12.987081+08:00）：24项自动测试与TypeScript/Vite构建通过；完整浏览器21、触屏6、上清入口7、三地照片27、正一观14，共75项浏览器检查通过。正一观网络失败清理及重试已实际注入。主场景本轮桌面平均53.8FPS、p95 34.6ms；移动视口同机模拟平均144.0FPS。正一观查看器桌面平均101.9FPS、p95 20.7ms；同机移动视口平均143.3FPS、p95 7.1ms。均为8秒采样，不代表真机手机或稳定下限。原有上清模型性能日志为上一阶段样本，未冒充本轮重新测量。

## 2026-10-03：实际映射岸线、岛屿、局部倒影与河湾近景

原始OSM包已经包含部分水面边界，之前只渲染中心线。本阶段补齐[水面关系17918405](https://www.openstreetmap.org/relation/17918405)的完整外环及2个岛屿内环，并与已有[上游水面1306285176](https://www.openstreetmap.org/way/1306285176)合并。对首屏有限河段叠加2023-10-30 Esri/Vantor影像目视核验，曲折岸线、河宽和南侧裸露洲体大体对应；OSM不是测绘或当前水位线，影像5m标称精度之外还有人工制图和季节水位差异。

- 原始API响应：`B/references/luxi-water-relation-17918405.osm`（完整关系版本1，2024-08-08编辑）。首屏影像及元数据：`B/references/georeference/luxi-hero`，叠图`osm-water-review.jpg`。底图仅作为局部参考，不重发为站点背景。
- 可复现派生脚本：`B/scripts/prepare_water_surfaces.py`。Shapely2.1.2独立安装在`B/tools/python`，pip缓存与运行临时文件均在B，不修改全局Python环境。8m网格单元与真实水面相交后约束三角化，保留岛屿孔洞。
- 网页资产：`public/assets/geo/water-surfaces.json`（来源、边界、误差、未测水深说明）和`water-surface.bin`（39,406顶点、71,883三角形、1,177,844字节）。覆盖的映射水面约2,079,312平方米，三角形面积和裁剪面积一致；8m是显示网格间距，不是岸线精度。
- `shared/water-domain.mjs`统一查询映射岸线、岛屿、就近河道流向和下游距离；`riverTerrain.ts`据此形成岸边接合与浅深过渡。水深按展示公式估计，不能从透明水面推断真实河床；湿润过渡与砂砾纹理为程序材质，未声称逐石还原。只有已查看的南侧岛屿标为裸露洲体。
- `riverFlow.ts`用实际水域网格及局部流向控制细波、流纹和竹筏尾流，扰动只在真实映射岛屿附近出现。竹筏起点改到首屏实际河段中心线上，不再放在用户看不到的全路线42%位置。
- `riverReflection.ts`使用Three.js Reflector的真实场景捕获（[官方文档](https://threejs.org/docs/pages/Reflector.html)），512×256、约15Hz更新；只用于高清首屏局部河段，水位远离所取平面的部分回退为环境色。这不是整条有坡度河流的精确反射模型。四点过滤柔化倒影轮廓，水纹扰动取样位置；低画质完全跳过额外渲染目标更新。
- “画面与流水设置”增加“近看泸溪河湾（首屏河段）”：沿实际河道观察竹筏和岸边，退出回到章节镜头。暂停、速度、透明度、波纹、反射控制保留；进入宫观时外部动画照常暂停。
- 地形从一个大网格改成约1km可独立裁剪区块，共享边界位置与原有法线，镜头外区块不绘制。没有删减实际岸线或把岛屿填平来换性能；仍加载当前选定区域DEM与水面数据，尚未做网络级流式地形分区。

`.tools/verify-water.mjs`新增14项浏览器检查：真实岸线资产、倒影更新/关闭、河湾近景、竹筏与水流连续运动、减少动态、流速零值、退出近景、手机实时流水和控制布局、脚本/着色器错误。`tests/water-domain.test.mjs`独立遍历全部水面三角形，验证不越出边界、不填岛、面积与哈希一致，并检查转弯前后流向与米制长度。

新实录`B/previews/water-mapped-banks-10s.webm`来自页面实际WebGL画布，默认0.65m/s展示流速、10秒、30FPS录制目标，不是背景视频。`mapped-water-regional.png`、`mapped-water-close.png`、`mapped-water-environment.png`、`mapped-water-mobile.png`与`mapped-water-mobile-page.png`供对照检查，均不是实景照片封面。

限制仍包括：无实测水深/流速、未逐石复原水下地貌、地形只有约42m源DEM，丹霞崖壁和天然石拱未完成精细建模。局部倒影和岸线升级不能代替这些工作。

水体阶段最终验证（2026-10-03T03:18:44.527679+08:00）：26项自动测试及生产构建通过；重新执行water14、upgrade21、interaction6、site7、zhengyi14，共62项浏览器检查通过。上一阶段location-photos27保留，未冒充本轮重测。最终竹筏浮高修正后又构建并录制10秒，预览无脚本错误。最终实录1,953,642字节。8秒性能样本：1920×1080实际局部倒影47.8FPS/p95 34.8ms，近景50.0FPS/p95 28.4ms；同机390×844低画质模拟143.9FPS/p95 7.1ms，非实体手机或稳定下限。

## 2026-10-03：主场景宫观点击、区域浏览和恢复

主场景新增“浏览山景”：暂时隐藏正文、页眉与页脚，同时设置inert移出键盘焦点；保留页面布局，三维相机仍对应真实章节位置。“泸溪河湾／正一观／大上清宫”移动到各自片区，返回页面恢复进入前的阅读位置。模型仍按需加载，未为导航改动地点间距、坐标或建筑资产。

`LandscapeScene.pickSite`对当前邻近区域已加载模型的真实三角形射线求交，并检查地形遮挡；没有用整张屏幕或固定矩形冒充建筑点击。指针移动超过6px、滚动超过2px、取消手势或非主指针均不触发选择。普通触摸滑动保留纵向滚动。

区域热点不再只限首屏：正一观与上清对应片区可见并进入Tab顺序，离开片区则隐藏并移出焦点。建筑点击、热点点击和Enter共用同一地点介绍，继而使用原有独立外部模型、各自入口接近和对应实拍导览。关闭后恢复原区域滚动、浏览状态与触发热点焦点；普通实拍没有被改称为连续内部空间。

实测发现旧静态降级提示沿用首屏自动淡出，导致重试不可直接点到；已改为持续可见可点击。浏览中实际触发WebGL上下文丢失，会退出浏览、恢复正文可访问性，再允许重试地形；重试成功不会擅自重新隐藏正文。

验证：26项自动测试通过，最终生产构建通过；新增`.tools/verify-regional-picking.mjs`22项专项检查全过，完整`.tools/verify-upgrade.mjs`21项再回归通过。专项覆盖实际建筑三角形点击、空地不选中、拖动返回原点防误触、跨地点、独立入口与照片、暂停和返回、Enter、390×844触屏模拟、直接触摸建筑、实际WebGL丢失与重试。全部正常运行检查无脚本/着色器错误；完整业务脚本最后主动阻断照片用于重试，不属于普通运行错误。

日志：`B/logs/regional-picking-verification.json`、`qa-regional-picking-run.log`、`qa-upgrade-regional-run.log`、`check-regional-picking.log`、`build-regional-picking.log`。截图：`B/previews/regional-picking-zhengyi.png`、`regional-picking-shangqing.png`、`regional-picking-mobile.png`，均已目视检查。修改前代码在`B/backups/before-regional-picking-2026-10-03`。

最新业务回归8秒样本主场景平均77.0FPS/p95 21.0ms，移动视口同机模拟143.9FPS/p95 7.1ms。与水体专项约47.8／50.0FPS存在同机运行波动，不作为稳定性能保证或与旧样本的直接提升幅度；真机性能仍未测。主场景周边地貌和林木近景依旧粗糙，需要下一阶段继续制作。

## 象鼻山照片约束研究与局部匹配岩面（2026-10-03）

新增五张熊锦阳拍摄的2025-04-18中新网照片，原始页面、930×523原图、作者/日期/权利和哈希保存在B/references/locations/elephant-2025；来源：https://www.chinanews.com/tp/hd2011/2025/04-18/1148890.shtml 至1148894.shtml。原图水印保留，仅研究匹配时排除水印区域；未新增为网站照片，网站仍23张。无可用相机标定/GPS/实测基线；照片使用权未获新授权。

B/references/georeference/elephant保存25张局部z18地图参考、拼接影像/坐标、citation.json和OSM道路。影像日期2023-10-30、WV02、SRC_ACC5m。OSM节点4571733038是观景台，仍未当作天然石梁中心。准确岩体位置、朝向和尺度尚未解决，任何研究模型均未发布至网站。

两条研究路线分别保存，不混淆其真实性：
- 手工照片轮廓研究：scripts/prepare_elephant_profile.py、build_elephant_study.py；可编辑shape-study.json；models/elephant-shape-study.blend（6,308,894字节）与exports/elephant-shape-study.glb（3,150,352字节），27,330顶点/53,501多边形，非流形边0。天然孔洞属于同一网格，不是外挂弯管。但0.20m/像素只是展示比例；厚度、背面和纹理是估计，目视仍像挤出的壁面，不满足最终质量。V1保存在backups/elephant-study-v1；当前轮廓核对图为aperture-trace-review-v2.jpg。
- 真实多视角匹配的局部表面：scripts/analyze_elephant_views.py、solve_elephant_multiview.py、reconstruct_elephant_surface.py、build_elephant_photo_surface.py。SIFT/RANSAC后3张同侧图组成369个稀疏点、第三相机41个PnP内点；共享焦距假设下3种初值焦距因子约0.771–0.773，中位重投影误差约0.132像素、p95约0.46像素。求解达到迭代上限，数值接近不等于测绘真值。
- 在1148891/1148893双视角上生成52,835个一致性过滤顶点、92,538三角形；接受区域约为画幅10.86%，左右视差中位误差0.125像素。保留遮挡/低纹理区域为空洞，未补造石梁下端或背面。颜色带来源照片光照，不是可重照明的扫描PBR。
- 真实局部表面文件：references/georeference/elephant/multiview/dense-photo-surface.npz及.ply，models/elephant-photo-surface.blend（6,059,735字节），exports/elephant-photo-surface.glb（10,109,160字节）。使用任意相机基线单位，无米制比例、地理定位或全表面精度保证。bundle-analysis.json/dense-analysis.json保存原始解和明确限制。

已实际运行Blender导出并查看正面/斜面渲染：previews/elephant-study-front/oblique/back.png和elephant-photo-surface-source-view/oblique.png。后者可看到真实照片对应的局部起伏，但孔洞和缺失明显，只是进一步重建的证据，不是已完成的象鼻山还原。日志在logs/elephant-*.log、build-elephant-*.log。

OpenCV4.13.0.92、SciPy1.17.1仅安装在B/tools/python，pip缓存和临时文件在B；没有修改全局Python或将资产放到C盘。本阶段网站代码和已发布模型未改，此前26项自动测试/84项浏览器检查属于上一阶段记录，没有冒充本阶段重测。

下一步：先完善上清宫已有样板的枝干/叶片与性能，再继续研究岩体定位、多视角覆盖和天师府独立资产。象鼻山待补的关键资料是带位置、相机参数和尺度的连续多角度拍摄或可靠扫描；普通照片重投影误差不能解决这些缺口。真实360/内部扫描和实体手机测试也仍未取得。

## 2026-10-03：上清宫枝干、叶片与分级显示

已实际改动网站`src/scene/treeGeometry.ts`、`siteVegetation.ts`、`LandscapeScene.ts`和`src/ModelView.tsx`，生产构建已更新。原`shangqing-vegetation.json`、地点注册、DEM和水面二进制的SHA256均与03:32检查点相同；没有增加位置样本或改动宫观坐标。修改前代码和截图保存于`B/backups/before-leaf-vegetation-2026-10-03`。

- 删除五个二十面体拼成的绿色球冠。新增4种原创代表性阔叶树结构：分叉枝干、细枝及有折面的独立尖椭圆叶片。它们不是现场树种鉴定或单木扫描；原林地范围有影像依据，树高、树形和枝叶仍是展示估计。
- 使用1139个原有已筛选样本；分为近景独立叶片、中景枝叶片、远景轮廓。每形态分别约7632/344/236三角形。桌面约65m/195m切换，窄视口约35m/130m，5m迟滞并限制更新频率，避免边界反复切换；相机或层级不变时复用阴影。
- 原创透明叶枝图由代码生成，不依赖外部图片或AI素材。修正首版对照发现的过直叶簇和背面法线偏黑，近景不再是球体。仍是代表性植被，树冠层次和真实林下环境尚可细化，不能写成真实植物扫描还原完成。
- 区域场景与外部查看器共用同一树形代码和位置；首屏仍不加载上清植被模块。没有把上清林地复制给正一观或天师府。

资产已实际导出并验证Blender导入：`B/exports/representative-broadleaf-library.glb`（1,706,764字节），`B/models/representative-broadleaf-library.blend`（3,720,638字节，24个网格对象、39,360顶点、32,848多边形，纹理已嵌入），`B/textures/procedural/vegetation/leafy-twig.png`（40,108字节）。网站按需直接生成这些代码几何，GLB/Blend作为编辑交接库保留，不额外加入网页下载。标准GLB不编码网页的自定义远景法线着色钩子。

复现工具：`P/.tools/export-tree-assets.mjs`、`preview-trees.mjs`和`B/scripts/import_tree_library.py`。源图形代码是`P/src/scene/treeGeometry.ts`；直接重新导出会重建该代表树库，手工修改Blend前应另存或备份。临时文件、配置、浏览器缓存和Blender数据均放在E盘B。

最终构建验证：26项现有自动测试通过，TypeScript/Vite生产构建通过；新增`P/.tools/verify-vegetation.mjs`9项全部通过，`verify-regional-picking.mjs`22项在最后构建上再次全部通过，无脚本/着色器错误。专项实际缩放确认独立叶片层级启用且总样本数不变，实际检查照片切换后释放模型画布、返回原阅读位置，以及手机入口；区域测试包括真实建筑点击、拖动防误触、跨地点、键盘、手机和WebGL失效重试。初版另跑7项site检查通过；其他上一阶段测试不冒充最终构建重测。

最终8秒性能样本（Headless Chrome154 / Windows / Intel UHD / D3D11）：1920×1080视口内1123×539模型画布，总览49.1FPS/p95 34.6ms，入口61.5FPS/p95 27.7ms；390×844移动视口内498×696画布，同机模拟69.1FPS/p95 21.0ms。总览近/中/远实例为0/135/1004，入口27/219/893，移动总览0/0/1139。不是实体手机测试或稳定帧率下限；不将同机运行波动当作优化幅度。

记录：`B/logs/check-leaf-vegetation.log`、`vegetation-verification.json`、`qa-leaf-vegetation.log`、`qa-regional-leaf-vegetation.log`、`tree-library-blender-check.json`和`representative-tree-assets.json`。已目视检查`previews/representative-trees-lod.png`、`leaf-vegetation-exterior.png`、`leaf-vegetation-close.png`、`leaf-vegetation-entry.png`、`leaf-vegetation-mobile.png`。

下一项可执行工作：沿用已有天师府9张局部影像及3张独立实拍，补查入口/院落布局证据并制作自己的外观，不复制上清或正一观；上清样板的周边道路、建筑细节和林下环境仍需进一步制作。象鼻山局部照片匹配资产保留，准确位置/尺度未解决，不发布为真实地形。三个宫观连续内部体验仍缺实拍360或可靠扫描/多视角资料，普通照片导览只是阶段方案。

## 天师府独立外观、入口与照片导览（2026-10-03T05:22:28.844291+08:00）

本阶段已实际接入天师府独立模型与7张新增现场照片，网站照片总数30张，原有照片ID保留。完成区域建筑点击→独立查看器→接近头门→自己的照片节点→返回的路径。它仍是资料约束的简化外观与普通照片导览，不是精细扫描或连续三维内部；不将此阶段写成总目标完成。

- 资产：B/models/tianshi-study.blend（3,994,321字节）、B/exports/tianshi-study.glb（2,568,940字节）；网页public/assets/models同名副本及dist哈希一致。252网格对象、21,010顶点、15,389多边形，3张原有程序化灰瓦纹理已嵌入。GLB SHA256：72964c2abd3136ff168816426811bbf1eeb02834f54f86930da6eaf45bfcaafd。
- 复现：B/scripts/build_tianshi.py，独立的头门、玉皇殿、私第、西院及东侧玄坛殿布置。复用通用网格辅助函数，不复制正一观/上清整体模型。雕刻、彩画、匾额文字、完整边界/附属建筑和林木尚未完成；不补造被树冠遮挡的仪门位置。首次导出备份B/backups/tianshi-first-export，网站修改前备份B/backups/before-tianshi-2026-10-03。
- 定位：B/references/georeference/tianshi/alignment.json、alignment-review.jpg；网页geo/tianshi-alignment.json。玉皇殿屋顶中心117.032571825,28.046936975；朝向348.4667°；头门南侧阈值117.0328474,28.04576391；中心DEM约85.404m，入口81.719m。12控制点来自2023影像人工判读与OSM建筑轮廓交叉核对，卫星元数据精度字段5m不等于配准或绝对精度。屋顶视差、遮挡及建筑高度未实测。
- 原始证据：B/references/locations/tianshi-visit/，阿尧33张原图、3篇原帖HTML、sources.json、3张联系表。https://m.zol.com.cn/dcbbs/d33991_42754.html （2025-04-29发布）、https://m.zol.com.cn/dcbbs/d33991_42769.html （2025-04-30）、https://m.zol.com.cn/dcbbs/d33991_42896.html （2025-05-09）；原帖EXIF为2024-10-29，非独立现场校时。所选7张为头门7-10、玉皇正面7-08、玉皇侧面7-02、私第门2-06、院落3-10、厅堂7-04、通道7-09。照片原图/水印保留；版权为摄影者所有，仅本机研究样板，公开使用需授权。
- 交叉资料：宗教博物馆https://www.mwr.org.tw/taoism/architecture3.htm只作建筑名称/历史关系辅助，不作当前测绘。Commons的Tianshi_Fu.jpg与20240206_Sidi_Men.jpg页面记录CC BY-SA 4.0及相机GPS；原图下载403，sources.json明确downloaded=false。未将页面元数据当成已取得图片或门洞测量；未接入其图像。
- 代码：shared/place-assets.mjs、site-ground.mjs；src/ModelView.tsx、scene/siteContext.ts、LandscapeScene.ts、experience/Experience.tsx、SpotDialog.tsx；tests/geography.test.mjs。区域p3.65..4.35按需加载天师府；首屏不下载该GLB；入口视角包含DEM高差，手机根据宽高比拉开取景；场地平整只影响显示，原始DEM未修改。未串用上清林地。南侧步道与西院铺地改为随坡度变化，修正地面交错，玉皇前庭铺地抬高消除穿模。
- 验证：27项自动测试、TypeScript/Vite生产构建通过。天师府17项专用、8项区域/返回/手机专项、14项正一观回归、22项区域回归，共61项本阶段浏览器检查全通过。普通运行无脚本/着色器错误；模型下载故意abort与恢复测试的预期ERR_FAILED已在报告说明。源码/当前导出、网页与dist模型哈希核对一致。
- 性能：Headless Chrome154、Windows Intel UHD/D3D11，独立8秒样本。1920×1080视口、1124×540模型画布：总览103.1FPS/p95 20.6ms，入口106.3FPS/p95 14.0ms；390×844移动视口、498×696画布：143.7FPS/p95 7.1ms。手机为同机模拟，不是实体手机；不是稳定下限，未含尚未制作的天师府林木与精细材质成本。
- 记录：B/logs/check-tianshi.log、qa-tianshi.log、tianshi-verification.json、qa-tianshi-regional.log、tianshi-regional-verification.json、qa-zhengyi-after-tianshi.log、qa-regional-after-tianshi.log、tianshi-model-check.json。已目视检查previews/tianshi-study.png、tianshi-exterior.png、tianshi-entry.png、tianshi-mobile-entry.png、tianshi-regional-browse.png、tianshi-regional-mobile.png；七个照片节点均实际加载，厅堂截图tianshi-interior-photo.png。

下一项可执行工作：基于已有天师府影像标注它自己的树冠/道路范围、避开屋顶和通道，复用已有枝叶几何库而不复制上清树点；完善有照片依据的头门匾额、门窗和墙面细节。正一观周边丹霞/上清近景材质、象鼻山地理位置与尺度仍需推进。内部360/扫描和实体手机测试仍有资料或设备缺口；按目标持续完成不受影响部分。

## 天师府场地与头门细化、地形绘制优化（2026-10-03T06:18:38.309395+08:00）

已实际制作并集成：
- 天师府11块影像树冠范围、208个代表样本，独立于上清的1158输入/1139有效点。范围取自2023-10-30卫星影像，单木点、树形和8–13.5m树高是展示估计。按已建模屋顶、墙体和铺装的保守包围盒，预留至少1.25倍树冠半径+1m避让。prepare_tianshi_context.py、landscape-context.json、vegetation-obstacles.json、tianshi-vegetation.json与vegetation-review.jpg保留生成依据。没有把208个样本称为实测树木。
- 头门前的公共铺装范围来自影像；紧邻台阶的入口铺装由地面实拍约束，尺寸和铺装接缝为估计。修正初版台阶前草地间隙、铺地交错及总览地形边缘。局部DEM显示范围扩大至约1.04km，雾起点改为600m以保留后部建筑；源DEM未改。
- 灰瓦筒形覆盖瓦、粉色端墙、木柱、4盏红灯笼及门扇按2024年头门照片细化。梁枋570×28、门扇66×82、匾额66×37原生像素构件图经透视校正使用；没有生成或补写不可读的文字/彩画，也没有放大低分辨率图冒充高清。原图未改、水印未清除，纹理包含原照片光照，属于参考纹理而非扫描PBR。原摄影者阿尧保留版权，本机研究样板；公开分发需授权。sources.json与GLB旁的tianshi-study.sources.json记录来源、原图像素选区与模型哈希。
- 可编辑建筑B/models/tianshi-study.blend保留263个构件、32,767顶点、24,198多边形。网页GLB合并为25个材质/阴影分组、4,051,556字节，49,939三角形；合并前后坐标/法线/UV/材质/绕序的属性指纹一致（规范浮点负零，舍入到1e-5），没有删除几何细节。来源脚本build_tianshi.py与verify_tianshi_batching.py，报告logs/tianshi-batching-equivalence.json。
- 完整编辑场景B/models/tianshi-landscape.blend：19,247,164字节，680网格对象、282独立网格数据、8张嵌入纹理；包含建筑、同一源DEM地形和自己的树位。B/exports/tianshi-landscape-context.glb：5,374,944字节，是可编辑LOD快照，不由网站重复下载。export-tianshi-context.mjs和assemble_tianshi_landscape.py可复现；实际实例矩阵与控制点换算最大差约0.00121m，只证明代码坐标一致，不表示地理精度。两个GLB均没有外部纹理/缓冲URI依赖。
- 网站改动：src/scene/siteVegetation.ts按地点取坐标/高程，ModelView.tsx及LandscapeScene.ts传入各自地点；siteContext.ts、shared/site-ground.mjs补充天师府场地；place-assets.mjs登记独立植被与资料说明；geography.test.mjs新增地点和避让检查。src/scene/riverTerrain.ts只调整绘制分组：细密网格250m、粗地形1km；在岸线影响权重恒为零的三角形上使用等效简单材质。源DEM、OSM水面二进制和上清树位哈希与05:22检查点相同。

最终证据：
- 28项自动测试及TypeScript/Vite构建通过；最终62项浏览器检查全部通过：天师府18、天师府区域8、水体14、区域交互22。另有本阶段上清枝叶9项回归与对照报告3项检查通过；它们在最后地形绘制优化之前运行，不冒充最后版本全量重测。正常流程无脚本/着色器异常；有意断开GLB的故障注入ERR_FAILED保留在报告中。
- 最终天师府窗口：Intel UHD/D3D11、Headless Chrome154，8秒，1920×1080视口内1124×540模型画布，总览70.0FPS/p95 21ms，入口80.2FPS/p95 20.9ms；390×844同机移动视口、498×696画布115.8FPS/p95 14ms。完整1920×1080区域画布另测45.7FPS/p95 34.9ms，490,856三角形。不是稳定下限或实体手机成绩。
- 优化过程保留：原1080p区域42.7FPS/654,266三角形，单独建筑合并无明显帧率收益；分块后43.4/494,150；材质分工后45.7/490,856。同机短时样本存在波动，不夸大提升幅度。水体最终1920×1080远景51.4FPS/p95 34.6ms，近景52.4/p95 27.9，模拟手机142.3/p95 7.1ms；14项包括实际10秒录屏、连续流水、竹筏、冻结恢复及反射档位。
- 日志：check-tianshi-detail-final.log、qa-tianshi-detail-final.log、qa-tianshi-detail-regional-final.log、qa-water-after-tianshi-detail.log、qa-regional-tianshi-detail-final.log、qa-shangqing-after-tianshi-detail.log、qa-tianshi-report-material-split.log；结构化同名专项verification、tianshi-context-export.json、tianshi-landscape-blender-check.json。
- 已目视检查最终入口、总览、移动入口、区域1080p及近水截图，未见新穿模/地形块缝。改造前后对照P/public/assets/reports/tianshi/index.html已在生产预览验证五图全部读取、桌面/手机无横向溢出；/assets/reports/tianshi/index.html可访问。截图tianshi-comparison-report.png更新为最终数值，原截图点击可读。

仍未完成：建筑只是有依据的阶段模型，仍缺精细石雕、完整彩画/附属空间和高分辨率构件资料；普通照片不是已完成的内部漫游；当前裸露绿色山坡与粗DEM无法充分表现真实丹霞。下一轮优先改善首屏/主要河段的源影像约束岩壁与植被空间，继续解决象鼻山石拱地理位置/尺度，不能为了填画面随意移动或补造岩体。


## 泸溪河有据地表与林地阶段（2026-10-03T07:05:32.262447+08:00）

已落地：
- 续作前核对 06:18:38 检查点清单，695/695 文件一致；备份在 B/backups/before-luxi-landscape-2026-10-03。原 ZIP、参考原图和现有宫观资产未覆盖。
- 根据已保存的 2023-10-30 WV02 河湾影像，手工标注 25 个可见裸岩面、8 个林地范围、5 个农田范围及道路排除线。像素坐标、WGS84/场景换算和局限在 references/georeference/luxi-hero/landcover-annotations.json；landcover-review.jpg 是本地判读图。prepare_luxi_landscape.py 可复现。
- 网页新增 public/assets/geo/luxi-landcover.json 和 640×768 分类遮罩 luxi-landcover.png（70,403 字节）。只传递自行制作的类别数据，未把卫星 RGB 影像作为网页贴图。土壤、岩面风化与枝叶为展示估计。
- 2,838 个代表性树位样本，网页依 OSM 水域排除 1 个冲突点，实际 2,837 个。树高 8.5–14.5m、冠半径 4.5–6.8m 是估计，不是实测树木。树位受林地多边形/原影像绿色像素约束；共享原创树库的近景折叶、中景枝叶卡，远景有简化枝干支持；远离该河段停止绘制。
- 代码：src/scene/riverLandscape.ts（类别材质、树林层级）；riverTerrain.ts（仅在与分区范围相交的地形块使用类别材质）；LandscapeScene.ts（遮罩/树位载入、水域排除、倒影前更新树林、Bitmap/Texture 释放、加载失败进入原有重试流程）。原 DEM、岸线、水面二进制、宫观模型与既有宫观植被文件哈希均未改变。
- 编辑资产：B/exports/luxi-landscape-context.glb，4,931,976 字节；B/models/luxi-landscape.blend，17,483,954 字节，5,712 个网格对象/46 份网格数据/2 个内嵌图像。其中 37 个地形对象、1 个静态水面、5,674 个树干/枝叶实例对象（2,837 个树位）。Blender 重新打开核验通过，无外链贴图。
- export-luxi-context.mjs 从网页原三角形导出 52,364 个地形三角形、6,283 个水面三角形，并导出全树位的远景编辑快照；坐标换算最大误差 0.000247m，只证明数字一致性。原高细节树库仍单独保留。assemble_luxi_landscape.py 提供可编辑 Blender 分类材质节点；Blender/网页材质是各自的展示实现，GLB 本体保留基础地色和静态水面，不声称包含运行时水体着色器。

验证：
- npm run check：28 个测试、TypeScript 和 Vite 构建通过。日志 check-luxi-landscape-final.log。
- 浏览器共 49 项通过：新河岸专项 8、水体 14、区域交互 22、新遮罩故障重试及对照页 5。遮罩故障注入可恢复；WebGL 丢失重试、手机/键盘/建筑三角形拾取/对应照片返回均通过；无非预期运行或 GLSL 异常。故障注入的 ERR_FAILED 是预期失败。
- 16 项来源/坐标/哈希检查通过；5 个独立像素控制点区分裸岩、林地、农田、水域、村落。所有树位的源像素与地表 UV 换算最大误差 0.02644 像素，不代表地理精度。
- 本机 Windows/Chrome154 桌面 GPU、8 秒采样：1920×1080 高清远景 70.1 FPS/p95 20.8ms；近景 59.7 FPS/p95 21ms；390×844 手机视口低画质 141.4 FPS/p95 7.2ms。独立河岸专项近景 60.2 FPS。不是实体手机或长期稳定下限，未据此声称跨阶段性能提升。
- 10 秒实际水体/竹筏实录更新为 previews/water-mapped-banks-10s.webm；同名 mapped-water-* 截图已更新。旧图保留在阶段备份，对照页复制了正确的前后版本。
- 对照页：http://127.0.0.1:4173/assets/reports/luxi/index.html，5 张图均读取成功，桌面/手机无横向溢出；截图 previews/luxi-comparison-report.png 已目检。原天师府对照页仍可访问。
- 详细记录：luxi-landscape-verification.json、water-verification.json、regional-picking-verification.json、luxi-retry-report-verification.json、luxi-source-verification.json、luxi-context-export.json、luxi-landscape-blender-check.json；对应终端日志 qa-water-luxi-landscape.log、qa-regional-luxi-landscape.log。

尚未完成及下一步：
- 本阶段是有依据的材质/植被分区，不是完整丹霞岩壁重建。当前山体仍为粗 DEM，裸岩面有贴附于缓坡的表现；远处细轮廓、阴影层次、林下灌草仍不足。不得把 25 个材质面称为 25 个已还原的实测岩壁。
- 下一阶段先为首屏对应岩壁核对地面照片、顶/底边界与尺度证据，再调整几何；没有依据的垂直高度、石拱位置/厚度不得擅自制造。继续推进自然树冠和林下层次，保留当前 OSM 河岸与数据来源。
- 三宫观与内部体验的既有成果/资料缺口沿用前一检查点。真正连续内部漫游、可靠 360/扫描素材、象鼻山完整定位石拱、长期实体手机测试仍未完成。目标保持 active。


## 日照阴影与岩壁证据核查（2026-10-03）

已完成的网站修改：
- `src/scene/sceneSun.ts` 管理局部方向光阴影：沿用日光方向与强度，高清 2048、低画质 1024，按观察距离调整范围并对齐阴影像素；静止视角复用贴图。树木 LOD、宫观加载和镜头变化才触发更新，高空总览关闭不够精细的阴影。深度/法线偏移随实际像素尺寸变化，已修正初版地形自阴影条纹。
- `LandscapeScene.ts` 接入控制器、模型投影/受影标志、LOD 更新与释放；`riverTerrain.ts`、`riverLandscape.ts` 纳入地形和枝叶投影。`riverFlow.ts` 使用同一方向光遮挡水面漫反射与太阳高光，保留独立流场、尾流和环境反射；太阳高光方向与场景日光一致。日照是清晰日间的展示设置，不是指定日期的太阳方位还原。
- 原 DEM、OSM 水面网格、地表分类图、全部宫观 GLB 和 Blender 源模型内容未改。原版本备份在 B/backups/before-scene-sun-2026-10-03。没有把阴影效果写成新的精细地形重建。
- 本地报告 `/assets/reports/daylight/index.html` 展示同版本开/关阴影的固定镜头对比、手机视口、实际流水录屏及测量证据。对比图是渲染截图，不是实拍；并非前一阶段全部代码的对比。

验证：
- `npm run check`：28 项测试、TypeScript 与 Vite 构建通过。日志 `check-scene-sun-final.log`。
- 浏览器 51 项通过：阴影专项 9、持续流水 14、区域交互 22、报告 6。覆盖静止贴图复用、近景精度、跨区域恢复、阴影渲染目标释放、三角形拾取、进入返回、键盘/手机、WebGL 丢失与重试。没有意外浏览器/GLSL 错误。
- 当前完整页面 8 秒实测：1080p 河谷远景 59.6 FPS / p95 21.0ms，近景 50.0 FPS / p95 27.7ms；390×844 低画质模拟手机 137.7 FPS / p95 7.2ms。独立固定镜头专项：59.1 / 50.8 / 天师府区域 66.0 FPS。所有结果均为本机 Windows/Chrome154 桌面 GPU，不是稳定帧率下限，也不是实体手机测试。
- `previews/water-mapped-banks-10s.webm` 为本轮名义 10 秒实录；原捕获副本 `water-daylight-capture.raw.webm` 保留。`scripts/finalize_webm.py` 仅增加 Matroska Duration（依据 https://www.matroska.org/technical/elements.html），212 个视频块字节未变，时长 9.916 秒含末帧时长估计；浏览器可跳转 5 秒并解码。无需新增编解码器。录屏有采集开销，帧率来自独立性能采样。
- 可复现命令：Node 运行 `.tools/verify-scene-sun.mjs`、`.tools/verify-water.mjs`、`.tools/verify-regional-picking.mjs`、`.tools/verify-daylight-report.mjs`。阴影专项使用开发服务 5173，其余使用生产预览 4173。TEMP/TMP、npm 缓存、浏览器 profile 继续设在 B。

岩壁证据核查与未完成项：
- 新增本地研究资料 `references/locations/luxi-2024`（4 张）、`luxi-aerial-2024`（7 张），来源为中新社摄影记者刘力鑫 2024-09-07 实拍与新华网转载。来源 URL、文件 SHA256 和权利限制在各 sources.json；没有取得再分发许可，未加入网页照片集或用作贴图。
- `references/locations/luxi-2017` 保存并实际查看中新社 2017-04-12 航拍视频及抽帧。来源 https://www.chinanews.com/shipin/cns/2017/04-12/news704805.shtml。它不是目标所列抖音视频，原抖音参考限制仍在。
- 2024 航拍组图原文 https://app.xinhuanet.com/news/article.html?articleId=40c6bbb3-4774-4b02-b81b-247ec6c4ff99；另组 https://www.chinanews.com.cn/tp/2024/09-08/10282170.shtml。
- `references/georeference/luxi-corridor`（z16，40 tiles）与 `luxi-north-cliffs`（z18，48 tiles）保存有界 Esri 影像，仅作本地定位研究；这两次查询的准确拍摄日期仍待核，不能直接沿用首屏影像的 2023-10-30 元数据。
- 对北段候选岩壁的 5 点首轮配准失败：550px 宽照片上的坐标 RMS 59.17px，反算相机仅高于假设水面 0.91m，不符合航拍条件。`camera-hypothesis.json` 明确标为 REJECTED，不是可用控制点。照片与河段对应、焦距、崖顶/崖脚和真实垂直尺度仍需确认；本轮未据此修改山体轮廓，未移动宫观或替换原首屏位置。
- 全目标仍未完成：精细且定位可靠的丹霞崖壁、象鼻山连体天然石拱、三处宫观的完整真实内部漫游及实体手机性能仍有缺口。普通照片导览继续只作为阶段方案。


## 大上清宫东路局部通道阶段（2026-10-03T09:14:42.249122+08:00）

已实际制作与集成：
- 按THAD一层平面描出白色现代栈道，保留源像素、平面到既有场地坐标换算及SHA256；22个约束三角形准确覆盖5758像素平方的栈道（含遗址孔洞）。7点折线路径29.278918m，4个观察节点。源数据B/references/georeference/shangqing-east-route/route-controls.json，判读图route-review.png，脚本prepare_shangqing_route.py。
- 独立可编辑B/models/shangqing-east-route.blend：20个网格对象、4044顶点、2943多边形、3张1024像素内嵌原创石材展示纹理。新GLB为3,983,300字节，SHA256 01c8360aaea310dc054bec30fc42a115abdb85767761ddadeae6de7e03779979。源导出、public和dist副本一致。来源及复现说明在GLB旁shangqing-east-route.sources.json。重新打开Blend验证可编辑网格及全部图像打包成功，源文件内嵌路线与限制文本。
- 屋面、钢架、格栅和栏杆依据THAD现场照片解释；初版四坡顶与山墙格栅相交，已改成与实拍通透山墙相符的双坡研究几何，修正前文件保留B/backups/shangqing-route-initial-geometry。高度、构件截面、石材0.6m接缝仍是估计，不是测量或扫描PBR。build_shangqing_route.py与make_shangqing_route_stone.py可复现。
- 网站src/InteriorRouteView.tsx按需加载，4节点沿全部折线转弯，支持拖动/方向键、双指/加减号、PageUp/PageDown、减少动态效果、失败重试、WebGL丢失恢复。shared/route-path.mjs负责累计弧长移动，tests/route-path.test.mjs验证不能跳过转角/越界/越过目标。
- VisitPanel接入局部通道并保留独立实拍导览；ModelView保存/恢复外部相机与目标及入口状态。途中切到照片后再回来会继续原目标，不将途中位置标成已到达。离开时释放几何、材质、ImageBitmap、阴影和renderer；下载中退出可中止。UI/CSS及登记修改前在B/backups/before-shangqing-route-2026-10-03。
- 上清登记仍为photo-guide，另加interior.route；其他宫观没有被改为通用内部模型。四个节点的地理换算沿用现有模型中心/比例/朝向，均落在来源建筑范围内，不构成新实测坐标。

验证与证据：
- npm run check：31项测试、TypeScript及Vite构建通过，logs/check-shangqing-route-final.log。此前严格浮点相等测试因1e-15量级误差失败，改用1e-9m数值容差；实际栈道几何未因此改变。
- 75项浏览器检查通过：展廊23、实际录制/下载中止/地理框架3、天师府回归18、区域拾取与进入返回22、报告9。正常流程无脚本或GLSL错误；下载失败为主动故障注入。logs/shangqing-route-verification.json、route-capture-verification.json、tianshi-verification.json、regional-picking-verification.json、route-report-verification.json；日志qa-shangqing-route-final.log、qa-route-capture.log、qa-tianshi-after-route.log、qa-regional-after-route.log。
- GLB实际几何1172个路径采样、20cm探测范围均有栈道；栏杆和柱最近模型距离0.67868m。另检查3.47千相关障碍三角形。只能证明模型内通行一致，不表示现场精度。logs/route-geometry-verification.json；42个既有源模型/地理资产哈希未变，logs/route-source-preservation.json。
- 本机Intel UHD / ANGLE D3D11 / Headless Chrome154，8秒采样：1920×1080视口内1124×594展廊画布143.9FPS/p95 7.2ms；390×844手机视口、498×582画布144.0FPS/p95 7.2ms。最大约5858三角形/20次绘制。是小范围展廊的短时结果，不是完整景区性能，也不是实体手机成绩或稳定下限。
- previews/route-walk-15s.webm是实际网页连续移动录制，准确元数据时长14.96147秒；Chrome此轮直接输出含索引和Duration的完整WebM，原文件字节原样保留，没有转码或元数据改写。旧保守补时长脚本拒绝此输入而未写入，随后检查已有Duration并原样复制。logs/route-video-finalization.json保存SHA；浏览器实际跳转5秒并继续解码通过。
- 阶段证据页http://127.0.0.1:4173/assets/reports/east-route/index.html，6张实拍/截图/描线图均载入；视频播放和seek、桌面/手机无横向溢出验证通过，截图route-report-desktop.png与route-report-mobile.png已目视检查。照片仍为原THAD/五季摄影资料，局部渲染明确标为模型。

范围与下一步：
- 这仍是局部资料建模，不是完成的真实内部还原：考古坑仅表现范围与高差；遗物、墙基细节、周边展厅、现存建筑精细材料和入口至东路连续连接段尚未重建。不得把空白区域称作还原的遗址。模型里约29m也是估算尺度，不作现场导航。
- 下一步先依据同一THAD一层平面及南侧/东路实拍核对入口至该展廊的真实连接关系与高差；有证据处继续补连廊和院落，来源不足处继续明确转场，不能拼造历史建筑。源数据、已验证代码和模型可直接续用，不需重做。
- 完整目标还包括真实精细丹霞、象鼻山连体天然石拱与可靠地理尺度、三宫观完整内部、林下细节及实体手机长期测试。上一阶段失败的岩壁相机配准继续标REJECTED，不能拿来修改地貌。普通照片导览始终只是阶段方案。总目标保持active。
- 复现环境继续TEMP/TMP=B/tmp，npm缓存B/cache/npm，Blender配置/scripts/datafile和浏览器profile全部B/cache。所有源资产、备份、预览和缓存仍在E盘。

## 大上清宫南侧入口至东路连接版（2026-10-03T11:17:06.322417+08:00）

实际制作与接入：
- THAD一层平面及南侧/东路实拍支持的连接通道已制作，16个路径点、7个观察节点、估算长97.6002688545m；保留原29m路径的全部末端点。相机从龙虎门内侧开始，外部台阶未纳入连续行走，不能将其说成完整无缝内部还原。
- B/models/shangqing-entry-route.blend可编辑源文件：130网格、26,185顶点、20,994多边形，90个沿用场地背景构件；路线部分40网格、7,403顶点、5,399多边形。6张内嵌纹理（三张1024石材、三张512瓦面），重开检查通过。GLB 6,837,752字节，SHA256 f5c60e72a9b5cffa7d3e16a000482a3dffb28adcaf2fc08b03b0843e3c80a805；源导出/public/dist一致。sources.json同行说明来源、估计值与复现流程。
- 控制数据B/references/georeference/shangqing-entry-route/route-controls.json；prepare_shangqing_entry_route.py、build_shangqing_entry_route.py、check_shangqing_entry_route_blend.py可复现。局部原点[31.53962264,0.5,-2.47524752]m，加原点后仍用shared/geography.mjs统一地理变换；0.5m是原场地模型的展示基准，不是实测高程。
- src/InteriorRouteView.tsx和VisitPanel.tsx接入“有据参观路线”、当前位置平面图、空格暂停/继续、随通道拐弯的镜头以及相应区域实拍。最后2.5m逐渐看向观察对象；手动转头可关闭自动转向，实拍往返保存跟随状态、暂停、位置和目标。早期相机验证发现照片返回丢失自动转向，已修复并通过同一完整验证；失败记录entry-route-camera-resume-failure.json保留。
- 位置标记更新限制为约8Hz且只在位置变化时写入，距离文本变化才更新；静止页面不再重复触发布局。随行局部阴影每移动2m更新，静止复用。资源按需加载并在退出时释放。
- 新增THAD/五季摄影“庭院鹅卵石遗迹及东路展廊”原图对应的shangqing-east-court照片，480/1280网页尺寸不放大原图。网站独立实拍31张，上清6个照片节点；普通照片不作360全景。准确拍摄日期未知，网页发布日期2023-12-20，原照片版权未获公开再分发授权。
- 原49份模型、地形及配套来源文件哈希不变，entry-route-source-preservation.json；旧29m源文件/GLB和阶段报告保留。修改前备份before-connected-entry-route-2026-10-03及before-entry-route-travel-look-2026-10-03。

验证：
- 32项项目测试、TypeScript、Vite生产构建通过，check-entry-route-final-resume.log。
- 当前30项路线检查通过：完整折线路径、正反向节点、镜头随南廊和东路转弯、暂停/实拍状态、外部视角/目标/页面恢复、手机触摸与缩放、失败重试、WebGL丢失、减少动态效果。shangqing-entry-route-verification.json、qa-entry-route-final-resume.log。
- 实际GLB每0.025m采样，共3905点：中心和±20cm范围均有地面，最小障碍间距约0.40505m，11186个相关三角形检查；87个复用构件重基准最大误差6.2651e-7m。entry-route-geometry-verification.json及entry-route-context-verification.json。仅说明模型一致，不是现场精度。
- 持续行走/五次照片往返3项、录制/下载中关闭/七节点地理对应3项、区域交互回归22项、报告9项通过；正常流程无脚本/GLSL错误。对应entry-route-sustained-verification.json、entry-route-capture-verification.json、regional-picking-verification.json、entry-route-report-verification.json。
- Windows / Headless Chrome154.0.8037.93 / Intel UHD / ANGLE D3D11。生产1920×1080视口内1124×594画布：入口8秒137.8FPS；50秒整段141.6FPS、p95 7.1ms（实际移动约44秒）；终点8秒137.6FPS；5次照片往返后8秒141.2FPS。最终含截图的完整QA桌面8秒141.9FPS、手机390×844模拟/498×582画布144.1FPS。它们是本机测量，不是实体手机、全部景区性能或稳定下限。
- 早先约28.9FPS异常记录保留，原因未查明。独立固定镜头截图对照144.2/143.8/142.4FPS（前/后/重建画布后）未复现明显下降；不能断言截图导致原低值。静止布局优化的独立证据为6.5秒LayoutCount 937→0。
- 原始47.96291秒WebM录屏previews/entry-route-walk.raw.webm保留，现代Chrome已输出有限Duration和索引；未转码或改写。10/25/42秒实际seek解码、继续播放及副本字节一致性通过，entry-route-video-verification.json。网页/frame截图均已目视检查。
- 新证据页http://127.0.0.1:4173/assets/reports/entry-route/index.html：7张源实拍/模型截图/路径图均读取；桌面和手机无横向溢出、视频播放/seek通过。相片方向与模型方向不同，页面明确标注未做相机标定。

局限与下一步：
- 本阶段完成了可用的资料通道样板，但没有完成真实内部还原。场地高差、通道构件截面、屋面和材料仍有估计；考古墙基、鹅卵石遗迹、展项和若干周边展厅未建模，不能填入想象文物。
- 下一步先对照THAD源平面、剖面和南侧/庭院实拍，核对龙虎门外台阶到室内地坪的高度关系，以及院落与栈道边缘范围；只为有证据的部分细化几何和材料。当前路线/原点/来源直接续用，不要重做已验证连接段。
- 完整目标仍包含精细且可靠定位的丹霞岩壁、象鼻山连体天然石拱、三个宫观完整真实内部、林下层次和实体手机验证。粗DEM、普通照片导览、局部空白遗址模型都不能当作全目标达成。原失败的岩壁相机配准继续REJECTED，未拿来修改地貌。目标active。

## 大上清宫庭院稳定版（2026-10-03T13:19:01.698082+08:00）
- 新增独立 shangqing-court-route.blend / GLB，133网格、27005顶点、22143多边形，9张内嵌纹理。GLB 10357372字节，SHA256 f119c6a25eb49c8d4ca6b2e42ac80b88495c64c8740ed490133dc6cd590dfcf0；exports/public/dist一致，原入口路线资产保留。
- THAD一层平面描线约422.17m²，裁去误盖庭院的通用铺装210.59m²。卵石/苔色为实拍指导的代表性材料，17个支撑的截面和间距为估计。图中9号标识区只保留中性面，不造碑体/文字。外部台阶和真实标高仍缺可靠数字。
- Blender glTF ACTIVE顶点色显式写入COLOR_0，修复原COLOR_1导致苔色丢失。5项GLB表面检查、3905路线采样、86场地构件一致性及Blend9纹理重开通过；56份前阶段源/发布模型与地理资产hash不变。
- 30项完整路线QA通过；恢复行走后的到站判断已同时检查实际距离/目标/paused/moving，没有降低断言。庭院资产接入时32tests/tsc/Vite通过。日志court-surface-geometry-verification.json、court-route-geometry-verification.json、court-route-context-verification.json、court-route-blender-verification.json、shangqing-court-route-verification.json、court-source-preservation.json。
- A独立收尾5/5通过，同机位广角/近看姿态和viewport相同，手机模拟控件无溢出，零脚本/资源错误。setViewport的isMobile变化会引起重载，测试重新真实进入后恢复；没有产品补丁。一次网络瞬断失败原样保留A/logs/court-comparison-resource-failure.json，不断言其未知根因。
- 同机庭院8秒采样：Windows / Chrome154.0.8037.93 / Intel UHD ANGLE D3D11；1920×1080视口、1124×594画布144.0FPS/p95 7.1ms；390×844触摸视口、498×582画布142.9FPS/p95 7.1ms。后者非实体手机测试，均非全景区或长期稳定下限。
- F独立源图/固定图审查接受为局部表面阶段：没有新增错铺装/破图/明显接缝；不确认17支撑精细位置/高度与动态闪烁。材料仍有程序化规律感，旧背景与空白标识区仍需后续细化，不能称完整真实还原。
- 同视角前后及来源证据页：http://127.0.0.1:4173/assets/reports/court/index.html。源脚本publish_shangqing_court_report.py；采集P/.tools/agent-a-court/capture-court-comparison.mjs。A/HANDOFF.md、RESULT.json和F/COURT_REVIEW.md在B/workstreams下。本页静态资源已HTTP读取；浏览器页面排版待当前GPU制作时段后与批次集成一并核对。
- 新并发协议生效：B/checkpoints/CONCURRENT_TASKS.md登记已实际指定的Sol/Astra与high/xhigh配置、文件负责人和GPU队列。C天师府制作二门内侧至石阶前院落，D正一观制作牌坊至圆门外部环境，E两个viewer仅文案/同地点实拍接口泛化，B继续核验地貌来源；全部独立E盘输出，root唯一构建发布。
- 完整目标仍active。精細丹霞及象鼻山米制定位、三宫观完整真实内部、林下群落和实体手机测试尚未完成。


## 天师府院落与正一观前庭并行集成（2026-10-03）
- 天师府新增独立“二门内侧至玉皇殿石阶前”资料院落，估算27.855483米、5观察节点，模型GLB 5,322,884字节，SHA256 241f0967d93e798f1bdcbd66a329528b9038e8011409d351736d405a70e1d6cf。源Blend、构建脚本、双向普通实拍与来源说明在B/workstreams/C-tianshi；院落原点和已有地理框架保持。头门外观仍沿用原模型，入口按明确独立转场接该院落，不表示连续走过未核验门廊。
- 新照片tianshi-court-return为阿尧2024年普通实拍，版权保留/仅本机研究；guide/photo双登记限定同地点。围栏内设施仅称围合区，正式名称/年代未核实，不建虚构文物或殿内陈设。1117个实际GLB地面与净空采样通过，F独立源图与固定图复核接受为局部院落阶段。
- 正一观加入独立入口前庭：17个代表树位、4组绿篱、通道/细卵石铺装；171个原建筑网格坐标保持、无树冠建筑交叠。GLB 10,300,756字节，SHA256 f72e52bc45498c45b87136864ea1f435dfa6d6e65381cadf3360fee785b2f743。源Blend/参考/固定图在B/workstreams/D-zhengyi。树木已嵌GLB，vegetationSrc=null，内部仍是本地点真实照片导览。
- 正一观粗大规则卵石缺陷D-MAT-01经F独立要求后修正并闭环；网页全景仍可见展示土板与周围地面矩形硬边，正准备ground-v2独立候选。当前发布版不声明自然接边已完成。
- 接入只修改shared/place-assets.mjs相应model/interior/photo；所有地点geo对象保持，天师府旧外观不变，正一观原照片/内部不变。7份copy来源/public/dist哈希核验一致；收据B/workstreams/root-integration/logs/cd-integration-receipt.json。共享路线查看器改用各路线的sourceLabel/notice及同地点照片白名单，不再写死THAD。
- 32项现有测试、tsc与Vite构建通过（cd-npm-check.log）。浏览器71/72检查通过：C实际完整5节点443个折线样本最大偏离0、暂停/实拍返回续走/资源释放/原外部camera与target恢复；手机触摸视口、模型故障重试、异地photo禁用；上清短回归和D实拍往返均过。保留完整失败日志：首轮误等待全局dialog因常驻APISettings而超时，修正仅景点dialog判定后补验；最后严格无错误断言因Google Fonts外网连接关闭仍失败，不能写成零错误全面通过。字体自托管正在处理，修复后仅针对性资源/样式补验。
- 设备Windows / Chrome154 / Intel UHD ANGLE D3D11，4秒局部RAF：C桌面1920×1080视口、1124×594画布142.48FPS；390×844触摸视口、498×582画布144.24FPS；D局部1124×540画布144.16FPS。均是短时桌面GPU数据，非实体手机/完整景区稳定性能。
- B/workstreams/A-integration/HANDOFF.md与INTEGRATION_SUMMARY.json保留功能/性能/截图证据；F-review/TIANSHI_FINAL_REVIEW.md、ZHENGYI_MAT01_CLOSURE.md独立复核。court旧报告7图全部载入，桌面排版通过。
- 象鼻山旧独立连体候选因宽条网格状岩面被F拒绝接入；G下一版在做，landformStudies映射保持空。用户允许资料缺失处适当艺术化，但必须标未定标定位，不能把此候选当真实DEM地貌。
