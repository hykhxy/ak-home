// ==UserScript==
// @name         罗德岛档案终端 · 悬浮球（主角 / NPC / 武器 / 记忆宫殿）
// @namespace    https://hykhxy.github.io/ak-home/
// @version      1.1.0
// @description  在 talkaicc 聊天页右上角加一个悬浮球：主角立绘(可本地上传保存)、NPC 立绘与档案、武器详述、记忆宫殿。数据只存在本机浏览器。
// @author       ak-home
// @match        https://talkaicc.com/*
// @match        https://*.talkaicc.com/*
// @run-at       document-idle
// @noframes
// @grant        none
// @downloadURL  https://hykhxy.github.io/ak-home/ak-palace.user.js
// @updateURL    https://hykhxy.github.io/ak-home/ak-palace.user.js
// ==/UserScript==
(function () {
  'use strict';
  if (window.__akPal) return;
  window.__akPal = 1;
  // 嵌入模式: 在 GitHub Pages 的网页版(palace.html)里使用, 供卡片 introPage 里的 iframe 加载; 油猴版为 false
  const EMBED = !!window.AK_PALACE_EMBED;
  const T_INS = EMBED ? '复制设定' : '插入聊天输入框';
  const T_ROOM = EMBED ? '复制本房间' : '注入本房间';
  const T_MEM = EMBED ? '复制' : '注入输入框';

  /* ============================== 基础工具 ============================== */
  const ART = 'https://hykhxy.github.io/ak-home/assets/art/';
  const OPS_URL = 'https://hykhxy.github.io/ak-home/data/operators.js';
  const DAY = 86400000;
  const INTERVALS = [1, 2, 4, 7, 15, 30, 60]; // 遗忘曲线复习间隔(天)
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const now = () => Date.now();
  const pad = (n) => String(n).padStart(2, '0');
  const clock = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };

  function h(tag, a, ...kids) {
    const e = document.createElement(tag);
    for (const k in a || {}) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(9)) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(c));
    }
    return e;
  }
  function select(opts, value, onchange) {
    const s = h('select', { onchange: (e) => onchange(e.target.value) }, opts.map((o) => h('option', { value: o[0] }, o[1])));
    s.value = value;
    return s;
  }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 420) + 'px'; }
  function copyText(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t); } catch (e) {}
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {} ta.remove();
    return Promise.resolve();
  }

  /* ============================== 存储 (IndexedDB) ============================== */
  const DB = {
    db: null,
    open() {
      return new Promise((res, rej) => {
        if (!window.indexedDB) return rej(new Error('no idb'));
        const r = indexedDB.open('ak-palace', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => { DB.db = r.result; res(); };
        r.onerror = () => rej(r.error);
      });
    },
    get(k) {
      return new Promise((res) => {
        if (!DB.db) return res(null);
        const q = DB.db.transaction('kv').objectStore('kv').get(k);
        q.onsuccess = () => res(q.result == null ? null : q.result);
        q.onerror = () => res(null);
      });
    },
    set(k, v) {
      return new Promise((res, rej) => {
        if (!DB.db) return rej(new Error('no db'));
        const tx = DB.db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(v, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
  };

  /* ============================== 默认数据 ============================== */
  const M = (title, spot, cue, body, tags, imp, time, link) => ({
    id: uid(), title, spot, cue, body, tags: tags || '', imp: imp || 3, time: time || '', link: link || '',
    c: now(), n: 0, last: now(),
  });
  const NPC = (o) => Object.assign({ id: uid(), pics: [], act: '' }, o, o.op ? { pics: [{ id: uid(), src: ART + o.op + '.webp' }] } : {});
  const W = (o) => Object.assign({ id: uid(), pics: [], act: '', rank: 4, stats: { atk: 5, rng: 5, stb: 5, agi: 5, art: 5, dur: 5 } }, o);

  function seed() {
    return {
      v: 1,
      hero: {
        name: '博士', code: 'Doctor', title: '罗德岛战术指挥官', gender: '', age: '', race: '未知（失忆）',
        cls: '指挥 / 战术推演', camp: '罗德岛制药',
        look: '', pers: '冷静克制，关键时刻敢于押注；对干员的伤亡格外在意。',
        bg: '在切尔诺伯格的废墟中苏醒，失去了大部分记忆；凭借残存的战术直觉带领干员们在泰拉大地上求生。',
        skill: '战术推演；源石技艺理论；临场指挥', gear: '指挥终端、折叠指挥杖、应急医疗包',
        rel: '阿米娅：最信任的人；凯尔希：医疗部门负责人，态度难以捉摸；陈：近卫局出身，可靠的前线',
        goal: '护送阿米娅抵达撤离点，查清自己失忆的原因。', secret: '', note: '',
        pics: [], act: '',
      },
      npcs: [
        NPC({ op: 'char_002_amiya', name: '阿米娅', code: 'Amiya', role: '罗德岛领袖', camp: '罗德岛', att: '极度信任博士，把博士当作支柱', gender: '女', age: '看上去十几岁', race: '卡特斯（兔耳）',
          look: '长长的兔耳，披着带兜帽的外套，右手常握着源石法杖。', pers: '温柔、认真，遇到伙伴受伤会立刻紧张；在大事面前非常坚决，会把责任独自扛起。',
          speech: '称呼“博士”，语气礼貌带点急切；紧张时会先说“那、那个……”。', bg: '年纪很小就担任罗德岛的领导者，是整个组织的精神象征，也是感染者。',
          skill: '源石技艺（法术）、指挥与鼓舞', secret: '她承受着远超外表的沉重，对自己的某些能力保持警惕。', note: '' }),
        NPC({ op: 'char_003_kalts', name: '凯尔希', code: "Kal'tsit", role: '医疗部门负责人', camp: '罗德岛', att: '审视、严格，偶尔流露不易察觉的关切', gender: '女', age: '不详', race: '菲林（猫科）',
          look: '深色外套，神情总是平静而锐利，身旁常带着一只小型机械造物。', pers: '理性到近乎冷酷，说话简短，计划周密；从不解释多余的东西。',
          speech: '句子很短，常用陈述与命令，不使用感叹号。', bg: '罗德岛医疗与决策的核心，对博士的过去了解得比其他人多得多。',
          skill: '医疗、源石学研究、战略谋划', secret: '她知道博士失忆的部分真相，却选择暂时不说。', note: '' }),
        NPC({ op: 'char_010_chen', name: '陈', code: 'Chen', role: '近卫干员', camp: '罗德岛（原龙门近卫局）', att: '嘴上嫌弃，实际上很可靠', gender: '女', age: '二十余岁', race: '龙族（炎国）',
          look: '黑发，头上有龙角，腰间佩着长刀，制服整洁。', pers: '正直、严肃，对不公有强烈的反应；不擅长表达关心。',
          speech: '直来直去，常说“博士”并加一句提醒，带炎国口吻。', bg: '曾在龙门近卫局任职，因故加入罗德岛，擅长近身战斗和突破。',
          skill: '剑术、突击、战场侦察', secret: '对自己的家族与出身有难以化解的心结。', note: '' }),
        NPC({ op: 'char_102_texas', name: '德克萨斯', code: 'Texas', role: '先锋干员', camp: '罗德岛', att: '沉默地信赖，行动比语言更多', gender: '女', age: '二十余岁', race: '沃尔珀（狼）',
          look: '黑白相间的短发，耳朵与尾巴，总是系着一条围巾般的衣领。', pers: '冷静寡言，对人保持距离，但很讲信用；面对危险时反应极快。',
          speech: '语句简短，爱用省略号，偶尔夹一句冷淡的玩笑。', bg: '背景复杂，来自叙拉古，与过去的某些关系仍在影响她。',
          skill: '近战、源石技艺（暗影）、侦察', secret: '过去的家族阴影，对某些名字会短暂沉默。', note: '' }),
        NPC({ op: 'char_172_svrash', name: '银灰', code: 'SilverAsh', role: '近卫干员 / 谢拉格贵族', camp: '罗德岛（谢拉格喀兰贸易）', att: '以盟友身份对待博士，彬彬有礼', gender: '男', age: '三十左右', race: '菲林（雪豹）',
          look: '银白色头发，深色大衣，随身携带一柄长剑。', pers: '稳重、有礼、极具责任感；做决定时不犹豫。',
          speech: '礼貌而克制，用词书面，称“博士”。', bg: '谢拉格的家主，同时在罗德岛承担重要的战斗任务。',
          skill: '剑术、指挥、家族资源调动', secret: '背负着家族与故乡的沉重责任。', note: '' }),
        NPC({ op: 'char_103_angel', name: '能天使', code: 'Exusiai', role: '狙击干员', camp: '罗德岛', att: '活泼地亲近博士，爱开玩笑', gender: '女', age: '十几到二十岁', race: '萨科塔（天使）',
          look: '红发，头顶光环，拎着一把改造过的枪，笑容灿烂。', pers: '开朗、冒失、爱热闹，爱吃苹派；认真时枪法极准。',
          speech: '语气跳跃，常带“嘿嘿”“哟”，会给任务起外号。', bg: '来自企鹅物流，性格热情，是队伍中的气氛担当。',
          skill: '精准射击、近距离火力压制', secret: '', note: '' }),
      ],
      weapons: [
        W({ name: '导能法杖「回响」', type: '源石技艺导体 / 法杖', rank: 5, owner: '阿米娅',
          stats: { atk: 7, rng: 8, stb: 6, agi: 5, art: 10, dur: 5 },
          look: '全长约一臂半的银灰色细杖，杖首嵌着一枚拳心大小的紫色源石，源石周围有三圈可旋转的金属环；握持处缠有深色皮革，末端有一截可以插入地面的三棱锥。',
          origin: '由罗德岛工程部依据持有者的源石技艺波长定制，杖首的源石是经过稳定处理的高纯度样本，仅能与特定术师的法术波形共振。',
          mech: '杖首源石吸收使用者的法术脉冲，经三圈金属环聚焦后放大输出；环的相位错开时可以把法术分成数道光束，相位重合时则压缩成单发重击。',
          perf: '中远距离法术输出，持续施法时源石温度缓慢上升；常规出力下可连续作战约十分钟，过载状态会短时间提升威力但需要冷却。',
          use: '右手持杖，左手辅助稳定；发动法术前杖首会发出低频的嗡鸣，金属环转速越高，下一击威力越大。地面插入式使用可以展开范围术式。',
          weak: '对使用者的精神状态敏感；情绪剧烈波动时法术会失控。金属环转动时有明显的声音和光芒，容易暴露位置。',
          upgrade: '可更换杖首源石以改变法术属性；在冷却回路中加入液冷模块可延长持续输出时间。保养时需定期检查金属环的磁阻和轴承。',
          lore: '据说这根杖在使用者最疲惫的夜里，源石会自己发出微弱的光，像在陪伴它的主人。' }),
        W({ name: '长刀「赤霄」', type: '近战 / 长刀', rank: 6, owner: '陈',
          stats: { atk: 9, rng: 3, stb: 8, agi: 8, art: 4, dur: 9 },
          look: '刀身修长，刃口泛着一线暗红，刀镡雕成缠绕的龙形；刀鞘为黑漆，鞘口镶一圈细铜；刀柄缠着深红丝线，常年被手磨得发亮。',
          origin: '炎国古法锻造并经源石技艺加持的佩刀，据说由龙门近卫局的名匠打造，历经多位持有者传承。',
          mech: '刀身内部夹有一层导能金属，挥砍时可把使用者的源石技艺能量集中到刃口，形成薄如蝉翼的赤色刃光，用于斩击与破甲。',
          perf: '单次斩击破甲能力极强，对重装目标尤为有效；刀身质量不大，适合连续快速攻击与突进。',
          use: '以双手持握为主，居合式拔刀可发出近距离的强力突袭；也可单手持刀配合步法在狭窄空间中使用。',
          weak: '使用者体力下降时刃光会变短；刀身对潮湿环境敏感，长期受潮会影响导能层。',
          upgrade: '可更换刀镡内的聚能片来调整刃光的颜色与长度；保养需要定期上油、检查刀柄丝线与鞘口铜圈。',
          lore: '近卫局里流传着一句话：这把刀出鞘之前，对手已经输了一半。' }),
        W({ name: '双刃「暗影」', type: '近战 / 双刃', rank: 5, owner: '德克萨斯',
          stats: { atk: 7, rng: 3, stb: 7, agi: 9, art: 7, dur: 7 },
          look: '两柄黑与白配色的短剑，剑脊上各有一道细细的银线；护手极小，便于贴身使用。',
          origin: '来源不详，据持有者透露与叙拉古某个家族的旧物有关，剑身材质对源石技艺有天然的亲和性。',
          mech: '通过源石技艺在剑周围制造短暂的暗影残像，使对手错判剑的位置；双剑配合时可以形成交叉的残影陷阱。',
          perf: '近距离连击速度快，突袭时命中率极高；单次威力中等，靠连击与位置变化取胜。',
          use: '以双手各持一剑，利用移动和假动作迷惑对手；暗影效果会在连续使用中叠加。',
          weak: '一旦被拉开距离或被范围攻击覆盖，优势会大幅降低；残像对强光环境的效果较弱。',
          upgrade: '可以在剑脊加入不同材质的导能线，改变暗影持续时间；保养重点在于护手内部的机关。',
          lore: '有人说，被这对剑盯上的人，总会在转身时看见背后有另一个影子。' }),
        W({ name: '改造枪「苹派」', type: '远程 / 自动手枪', rank: 4, owner: '能天使',
          stats: { atk: 6, rng: 7, stb: 5, agi: 8, art: 3, dur: 6 },
          look: '外壳漆成亮橙色的轻型自动手枪，枪身侧面贴着一块褪色的苹果派贴纸，弹匣上绘有小小的光环图案。',
          origin: '企鹅物流内部改装的定制武器，保留了原型的基础结构，大幅提升了射速与供弹稳定性。',
          mech: '电控击发配合短行程供弹，可以在极短时间内打出大量子弹；配套的瞄具能做动态补偿。',
          perf: '射速高、后坐力可控，适合短时间的火力压制；弹药消耗很快，需要频繁换弹。',
          use: '双手持枪，近中距离点射为主；紧急时可单手持枪移动射击。',
          weak: '枪管长时间连发会过热；弹药补给依赖团队，单独作战容易断供。',
          upgrade: '更换枪管与散热片可以提升连续射击时间；弹匣可以替换为大容量版本。',
          lore: '据说每次完成任务后，持有者都会给枪贴一张新的小贴纸。' }),
        W({ name: '重盾「壁垒-7」', type: '防御 / 重型盾牌', rank: 4, owner: '整合运动·重装防御者',
          stats: { atk: 3, rng: 1, stb: 10, agi: 2, art: 2, dur: 10 },
          look: '近一人高的矩形钢盾，表面有大面积的焊接补丁与烧灼痕迹，盾面中央开有一条窄窄的观察缝。',
          origin: '来自整合运动的作坊式制造，使用回收的装甲板拼接而成，粗糙但坚固。',
          mech: '多层钢板夹有吸能缓冲层，可以把冲击分散到整面盾上；盾缘锋利，可用作近战重击的武器。',
          perf: '极高的物理防御，能抵挡大部分常规枪弹与冲击；机动性极差，持盾者移动缓慢。',
          use: '以盾牌顶在身前缓慢推进，配合后方火力；盾面边缘可做重击，破坏对手阵型。',
          weak: '无法抵挡高强度的源石技艺与爆破；盾后的视野很窄，容易被绕后。',
          upgrade: '可以在盾面加装可拆卸的防护层与观察镜；保养重点是焊接处的疲劳。',
          lore: '整合运动里的老兵常说：能扛住壁垒推进的，不是更硬的盾，而是更敢死的人。' }),
        W({ name: '指挥终端「罗盘」', type: '辅助装备 / 战术终端', rank: 5, owner: '博士',
          stats: { atk: 1, rng: 10, stb: 8, agi: 6, art: 6, dur: 5 },
          look: '巴掌大的黑色平板终端，边框为磨砂铝，屏幕边缘有一圈橙色的细光；背面有罗德岛的徽标。',
          origin: '罗德岛工程部为指挥官专门设计的战术终端，内置战术推演与通讯模块，部分数据与舰桥的主机同步。',
          mech: '通过舰载侦察与干员的随身信号实时生成战场态势图，可以推演数步之后的敌我动向；通讯模块可以同时联络十余名干员。',
          perf: '战术推演精度高，延迟极低；电池续航约十二小时，信号受强干扰区域会下降。',
          use: '左手持终端，右手在屏幕上标记战术；可以语音下令，也可以通过手势快速切换视图。',
          weak: '怕强电磁脉冲与源石干扰；一旦丢失，战场指挥将陷入混乱。',
          upgrade: '可加装增强型天线与备用电池；软件层面可以安装不同风格的战术推演模块。',
          lore: '终端里有一份加密的日志，似乎记录着博士失忆之前的某些想法。' }),
      ],
      palace: {
        rooms: [
          { id: uid(), icon: '🚪', name: '序章大厅', theme: '世界观与核心规则',
            scene: '推开罗德岛舰桥厚重的舱门，脚下是橙色警示线铺成的红毯，两侧悬挂着泰拉大陆的旧地图，头顶的灯光带着微微的蓝。',
            mem: [
              M('泰拉与源石', '舱门正中的橙色警示线', '一块发光的源石嵌在警示线中央，一踩上去就扩散出蓝紫色裂纹', '泰拉大陆灾害频发，源石既是能源与源石技艺的来源，也是感染者矿石病的病因。感染者长期受到歧视，这是整个故事的社会底色。', '世界观,源石', 5, '序章'),
              M('罗德岛的立场', '左侧墙上的徽章', '徽章在墙上自己旋转，一半写着“医疗”，一半写着“行动”', '罗德岛是以治疗矿石病为目的的制药公司，同时拥有自己的行动队伍；对内平等对待感染者与非感染者。', '势力,罗德岛', 4, '序章'),
              M('博士的失忆', '地毯尽头的空椅子', '椅背上贴满写着问号的便签，风一吹便簌簌作响', '博士在切尔诺伯格废墟中苏醒，几乎失去全部记忆，只留下战术直觉。凯尔希知道部分真相，但暂时保密。', '主线,博士', 5, '序章', '博士,凯尔希'),
            ] },
          { id: uid(), icon: '👥', name: '人物回廊', theme: '重要人物的第一印象',
            scene: '一条挂满画框的长廊，每个画框里的人物都会在你经过时转头看你，画框下面的铜牌写着名字与口头禅。',
            mem: [
              M('阿米娅', '第一幅画框（门边）', '画框里的兔耳少女把法杖举过头顶，杖首发出紫光', '罗德岛领袖，卡特斯，极度信任博士；紧张时会说“那、那个……”。', '人物,罗德岛', 5, '第三章', '阿米娅'),
              M('凯尔希', '第二幅画框（灯光最暗处）', '画框里的猫科女性背对着你，只回头给你一个很短的眼神', '医疗部门负责人，冷静锐利，说话简短，掌握博士过去的关键信息。', '人物,医疗', 5, '序章', '凯尔希'),
              M('陈', '第三幅画框（挂着一把刀）', '画框里的龙角女子从画中拔出长刀，刀光掠过你的脸', '前龙门近卫局，正直严肃，嘴硬心软，是前线最可靠的突破手。', '人物,近卫', 4, '第三章', '陈'),
            ] },
          { id: uid(), icon: '⚔️', name: '武器库', theme: '重要装备与它们的主人',
            scene: '一间冷光灯下的金属库房，每件武器悬在透明的力场里，下面的标签亮着持有者的名字。',
            mem: [
              M('导能法杖「回响」', '最中央的悬浮架', '紫色源石的光顺着地面爬到你脚边', '阿米娅的法杖，杖首源石与三圈金属环聚焦法术；情绪剧烈波动时会失控。', '武器,阿米娅', 4, '', '阿米娅'),
              M('长刀「赤霄」', '左墙的刀架', '刀鞘上的丝线自己松开，露出一线暗红', '陈的佩刀，破甲能力强；怕潮湿，使用者体力下降刃光变短。', '武器,陈', 4, '', '陈'),
            ] },
          { id: uid(), icon: '📜', name: '事件长廊', theme: '按时间排列的剧情节点',
            scene: '一条笔直的走廊，地面是一条发光的时间轴，每隔十步就有一扇带数字的门。',
            mem: [
              M('第三章 · 废墟中的回声', '第 3 扇门', '门后传来整齐的脚步声，门把手上挂着一只染灰的手套', '护送阿米娅抵达撤离点。在切尔诺伯格废墟的十字路口遭遇整合运动的先遣队，博士下令抢占天桥。', '事件,整合运动', 5, '第三章', '阿米娅,陈,德克萨斯'),
              M('遭遇战 · 十字路口', '第 4 扇门', '门缝里漏出红色的警报光', '敌方：整合运动·重装防御者（手持巨盾）。我方：阿米娅、陈、德克萨斯、博士。第二波增援尚未到达。', '事件,战斗', 4, '第三章'),
            ] },
          { id: uid(), icon: '🗺️', name: '地图室', theme: '地名、路线与势力范围',
            scene: '中央摆着一张会呼吸的全息沙盘，各个城市像山峰一样起伏，沙盘边缘有一圈脚印。',
            mem: [
              M('切尔诺伯格', '沙盘的西北角', '一座倾斜的城市模型冒着灰烟', '废弃的城市，博士苏醒的地方；整合运动曾在此活动，建筑残骸与地道交错。', '地点,废墟', 4),
              M('龙门', '沙盘的东侧', '一圈明亮的灯河围着中央的高塔', '炎国的大型城市，近卫局所在地；陈曾在此工作。', '地点,炎国', 3),
            ] },
          { id: uid(), icon: '🔒', name: '誓约与秘密', theme: '承诺、交易与不能说的事',
            scene: '地下一层的保险库，墙上嵌着许多带编号的抽屉，每个抽屉都有不同形状的锁。',
            mem: [
              M('博士答应阿米娅的事', '3 号抽屉（心形锁）', '抽屉里传出轻轻的兔耳颤动声', '博士答应过要把阿米娅安全送到撤离点，并且在这之后一起查清真相。', '誓约,阿米娅', 5, '第三章', '阿米娅'),
              M('凯尔希的保密', '7 号抽屉（猫形锁）', '锁眼里有一只绿色的眼睛在眨', '凯尔希知道博士失忆的部分真相，但选择暂缓告知；等待合适的时机。', '秘密,凯尔希', 5, '', '凯尔希'),
            ] },
          { id: uid(), icon: '🧩', name: '伏笔密室', theme: '尚未回收的线索',
            scene: '一间堆满拼图碎片的小屋，墙上有许多没有画完的拼图框。',
            mem: [
              M('终端里的加密日志', '桌上的黑色平板', '屏幕偶尔亮起，闪过一行看不清的字', '博士的指挥终端里存有一份加密日志，内容尚未解锁。', '伏笔,终端', 4),
              M('陈的家族心结', '窗台上的龙形摆件', '摆件的眼睛是两颗暗红色的小宝石', '陈对出身有难以化解的心结，未来剧情可能触发。', '伏笔,陈', 3, '', '陈'),
            ] },
          { id: uid(), icon: '🌱', name: '情感花园', theme: '关系变化与情绪节点',
            scene: '一座玻璃温室，不同的花代表不同的人，花瓣的颜色会随心情变化。',
            mem: [
              M('与阿米娅的羁绊', '温室中央的白色花丛', '花丛在风里轻轻摇晃，叶片上结着露珠', '博士与阿米娅之间的信任不断加深，阿米娅会在紧要关头本能地依赖博士。', '关系,阿米娅', 5, '', '阿米娅'),
              M('与陈的默契', '温室角落的红色花', '红花被一圈细线缠绕，又悄悄舒展', '陈嘴上嫌弃，实际会主动站到博士前方；未来可以有更深入的互动。', '关系,陈', 3, '', '陈'),
            ] },
          { id: uid(), icon: '🗼', name: '任务之塔', theme: '当前目标与待办',
            scene: '一座向上螺旋的高塔，每一层都有一块发光的任务板，越往上越明亮。',
            mem: [
              M('当前目标：抵达撤离点', '塔底第一层的任务板', '任务板上有一枚不停闪烁的红点', '护送阿米娅抵达撤离点；沿途需要击溃整合运动先遣队并守住天桥（0/3）。', '任务,主线', 5, '第三章', '阿米娅'),
              M('长期目标：查清失忆真相', '塔顶的门', '门缝里透出金色的光，门把手是一枚破碎的怀表', '博士需要找回自己的记忆，了解失忆的原因与凯尔希的隐瞒。', '任务,长期', 5),
            ] },
        ],
      },
    };
  }

  /* ============================== 状态 ============================== */
  let S = null;
  const U = { open: false, tab: 'hero', npc: '', weapon: '', pal: { view: 'map', room: '', q: '', openMem: {}, tour: null } };
  let saveTimer = 0, root, body, footEl, toastEl, ball, win, host;

  function normalize(s) {
    const d = seed();
    s = s || {};
    s.hero = Object.assign(d.hero, s.hero || {});
    s.hero.pics = s.hero.pics || [];
    s.npcs = Array.isArray(s.npcs) ? s.npcs : d.npcs;
    s.weapons = Array.isArray(s.weapons) ? s.weapons : d.weapons;
    s.weapons.forEach((w) => { w.stats = Object.assign({ atk: 5, rng: 5, stb: 5, agi: 5, art: 5, dur: 5 }, w.stats || {}); w.pics = w.pics || []; });
    s.npcs.forEach((n) => { n.pics = n.pics || []; });
    s.palace = s.palace && Array.isArray(s.palace.rooms) ? s.palace : d.palace;
    s.v = 1;
    return s;
  }
  function save() {
    clearTimeout(saveTimer);
    footEl && (footEl.textContent = '保存中…');
    saveTimer = setTimeout(async () => {
      try {
        await DB.set('state', S);
        const kb = Math.round(JSON.stringify(S).length / 1024);
        footEl && (footEl.textContent = '已保存 ' + clock() + ' · 约 ' + kb + ' KB（仅存于本浏览器）');
      } catch (e) {
        footEl && (footEl.textContent = '保存失败：' + (e && e.message));
        try { localStorage.setItem('ak-palace-fallback', JSON.stringify(S)); } catch (_) {}
      }
    }, 350);
  }
  function toast(t) {
    if (!toastEl) return;
    toastEl.textContent = t; toastEl.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove('on'), 2200);
  }

  /* ============================== 注入输入框 ============================== */
  function toChat(text) {
    if (EMBED) { copyText(text); toast('已复制 · 回到聊天页，在输入框里粘贴即可'); return; }
    const ta = [...document.querySelectorAll('textarea')].find((t) => /输入/.test(t.placeholder || '')) || document.querySelector('textarea');
    if (!ta) { copyText(text); toast('没找到输入框，已复制到剪贴板'); return; }
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, (ta.value ? ta.value + '\n' : '') + text);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    toast('已插入聊天输入框（还没发送）');
  }
  function fmtEnt(title, ent, fields) {
    const lines = fields.filter((f) => f[2] !== 'skip' && ent[f[0]] && String(ent[f[0]]).trim()).map((f) => f[1] + '：' + String(ent[f[0]]).trim());
    return '【' + title + '】\n' + lines.join('\n');
  }

  /* ============================== 图片处理 ============================== */
  function fitImage(file, maxSide) {
    maxSide = maxSide || 1200;
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        let w = im.naturalWidth, hh = im.naturalHeight;
        const k = Math.min(1, maxSide / Math.max(w, hh));
        w = Math.max(1, Math.round(w * k)); hh = Math.max(1, Math.round(hh * k));
        const c = document.createElement('canvas'); c.width = w; c.height = hh;
        c.getContext('2d').drawImage(im, 0, 0, w, hh);
        URL.revokeObjectURL(url);
        let out = c.toDataURL('image/webp', 0.9);
        if (out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/png');
        res(out);
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('图片无法读取')); };
      im.src = url;
    });
  }

  let opsPromise = null;
  function loadOps() {
    if (window.OPS && window.OPS.length) return Promise.resolve(window.OPS);
    if (opsPromise) return opsPromise;
    opsPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = OPS_URL; s.charset = 'utf-8';
      s.onload = () => (window.OPS ? res(window.OPS) : rej(new Error('no ops')));
      s.onerror = () => { opsPromise = null; rej(new Error('干员库加载失败')); };
      document.head.appendChild(s);
    });
    return opsPromise;
  }
  function pickOp(cb) {
    const grid = h('div', { class: 'opgrid' });
    const q = h('input', { class: 'opq', placeholder: '搜索干员名 / 英文名 / 编号…' });
    const ov = h('div', { class: 'ov' },
      h('div', { class: 'ovbox' },
        h('div', { class: 'ovh' }, h('b', {}, '干员立绘库'), q, h('button', { class: 'x', onclick: () => ov.remove() }, '✕')),
        grid));
    root.appendChild(ov);
    grid.textContent = '加载中…';
    loadOps().then((ops) => {
      const draw = () => {
        const k = q.value.trim().toLowerCase();
        grid.innerHTML = '';
        ops.filter((o) => !k || String(o.n).toLowerCase().includes(k) || String(o.e || '').toLowerCase().includes(k) || String(o.id).toLowerCase().includes(k))
          .slice(0, 480).forEach((o) => {
            const cell = h('div', { class: 'opc', title: o.n + ' · ' + o.id, onclick: () => { ov.remove(); cb(o); } },
              h('img', { loading: 'lazy', src: ART + o.id + '.webp', onerror: (e) => { e.target.parentElement.style.display = 'none'; } }),
              h('span', {}, o.n));
            grid.appendChild(cell);
          });
        if (!grid.children.length) grid.textContent = '没有匹配的干员';
      };
      q.addEventListener('input', draw); draw(); q.focus();
    }).catch((e) => { grid.textContent = e.message; });
  }

  /* ============================== 通用组件 ============================== */
  function portraitBlock(ent, label, small) {
    ent.pics = ent.pics || [];
    const box = h('div', { class: 'pb' + (small ? ' sm' : '') });
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none' });
    file.addEventListener('change', async () => {
      const fs = [...file.files]; file.value = '';
      let ok = 0;
      for (const f of fs) {
        try { const src = await fitImage(f); const p = { id: uid(), src }; ent.pics.push(p); ent.act = p.id; ok++; }
        catch (e) { toast(f.name + '：' + e.message); }
      }
      if (ok) { save(); draw(); toast('已添加 ' + ok + ' 张，已保存在本机'); }
    });
    const add = (src) => { const p = { id: uid(), src }; ent.pics.push(p); ent.act = p.id; save(); draw(); };
    function draw() {
      box.innerHTML = '';
      const cur = ent.pics.find((p) => p.id === ent.act) || ent.pics[0];
      const stage = h('div', { class: 'stage' },
        cur ? h('img', { src: cur.src, alt: '' }) : h('div', { class: 'empty', onclick: () => file.click() }, h('i', {}, '＋'), '点击上传' + label, h('small', {}, '本地图片 · 自动保存在本浏览器')));
      const bar = h('div', { class: 'pbar' },
        h('button', { onclick: () => file.click() }, '上传本地'),
        h('button', { onclick: () => { const u = prompt('图片链接（https://…）'); if (u && /^https?:\/\//i.test(u.trim())) add(u.trim()); else if (u) toast('链接必须以 http(s):// 开头'); } }, '图片链接'),
        h('button', { onclick: () => pickOp((o) => add(ART + o.id + '.webp')) }, '干员库'),
        h('button', { class: 'dg', disabled: !cur, onclick: () => { if (!cur || !confirm('删除当前这张图？')) return; ent.pics = ent.pics.filter((p) => p !== cur); ent.act = ''; save(); draw(); } }, '删除'));
      const th = h('div', { class: 'thumbs' }, ent.pics.map((p) => h('img', {
        src: p.src, class: p === cur ? 'on' : '', onclick: () => { ent.act = p.id; save(); draw(); },
      })));
      box.append(stage, bar);
      if (ent.pics.length > 1) box.append(th);
      box.append(file);
    }
    draw();
    return box;
  }

  function form(ent, fields, after) {
    return h('div', { class: 'form' }, fields.map((f) => {
      const [k, l, t, ph] = f;
      const ta = t === 'ta';
      const inp = ta
        ? h('textarea', { rows: 2, placeholder: ph || '', value: ent[k] || '', oninput: (e) => { ent[k] = e.target.value; grow(e.target); save(); after && after(k); } })
        : h('input', { placeholder: ph || '', value: ent[k] || '', oninput: (e) => { ent[k] = e.target.value; save(); after && after(k); } });
      if (ta) requestAnimationFrame(() => grow(inp));
      return h('label', { class: 'f' + (ta ? ' w' : '') }, h('span', {}, l), inp);
    }));
  }

  const HERO_F = [['name', '姓名'], ['code', '代号'], ['title', '头衔 / 职务'], ['gender', '性别'], ['age', '年龄'], ['race', '种族'], ['cls', '职业 / 定位'], ['camp', '所属'],
    ['look', '外貌', 'ta', '发色、体型、常穿的衣服、标志性特征…'], ['pers', '性格', 'ta'], ['bg', '背景经历', 'ta'], ['skill', '能力与特长', 'ta'], ['gear', '随身装备', 'ta'],
    ['rel', '人际关系', 'ta', '谁对你什么态度'], ['goal', '当前目标', 'ta'], ['secret', '隐藏设定 / 秘密', 'ta'], ['note', '给 AI 的额外要求', 'ta', '例如：不要替我做决定']];
  const NPC_F = [['name', '姓名'], ['code', '代号'], ['role', '身份 / 职务'], ['camp', '所属'], ['att', '对主角的态度', 'ta'], ['gender', '性别'], ['age', '年龄'], ['race', '种族'],
    ['look', '外貌', 'ta'], ['pers', '性格', 'ta'], ['speech', '说话风格 / 口头禅', 'ta'], ['bg', '背景', 'ta'], ['skill', '能力与特长', 'ta'], ['secret', '秘密', 'ta'], ['note', '备注', 'ta']];
  const WEAPON_F = [['name', '名称'], ['type', '类型'], ['owner', '持有者'],
    ['look', '外观描述', 'ta', '尺寸、颜色、材质、细节…'], ['origin', '来源与制作', 'ta'], ['mech', '工作原理', 'ta'], ['perf', '性能与数据', 'ta'],
    ['use', '使用方式', 'ta'], ['weak', '弱点与限制', 'ta'], ['upgrade', '保养与改造', 'ta'], ['lore', '传闻与逸事', 'ta']];
  const STAT_N = [['atk', '攻击'], ['rng', '射程'], ['stb', '稳定'], ['agi', '机动'], ['art', '源石适配'], ['dur', '耐久']];

  function actions(...btns) { return h('div', { class: 'acts' }, btns); }

  /* ============================== 主角 ============================== */
  function tabHero() {
    const e = S.hero;
    return h('div', { class: 'cols' },
      h('div', { class: 'colL' }, portraitBlock(e, '主角立绘')),
      h('div', { class: 'colR' },
        h('div', { class: 'ttl' }, h('b', {}, '主角档案'), h('small', {}, '立绘放左边；所有内容自动保存在本机')),
        actions(
          h('button', { class: 'pri', onclick: () => toChat(fmtEnt('主角设定', e, HERO_F)) }, T_INS),
          h('button', { class: 'dupx', onclick: () => copyText(fmtEnt('主角设定', e, HERO_F)).then(() => toast('已复制')) }, '复制设定')),
        form(e, HERO_F)));
  }

  /* ============================== NPC ============================== */
  function tabNpc() {
    if (!S.npcs.find((n) => n.id === U.npc)) U.npc = S.npcs[0] ? S.npcs[0].id : '';
    const cur = S.npcs.find((n) => n.id === U.npc);
    const list = h('div', { class: 'list' },
      h('div', { class: 'lh' }, h('b', {}, 'NPC 名册'), h('small', {}, S.npcs.length + ' 人')),
      h('div', { class: 'li-wrap' }, S.npcs.map((n) => {
        const p = n.pics.find((x) => x.id === n.act) || n.pics[0];
        return h('div', { class: 'li' + (n.id === U.npc ? ' on' : ''), onclick: () => { U.npc = n.id; render(); } },
          h('div', { class: 'av' }, p ? h('img', { src: p.src, alt: '' }) : h('i', {}, (n.name || '?').slice(0, 1))),
          h('div', { class: 'tx' }, h('b', {}, n.name || '（未命名）'), h('small', {}, n.role || n.code || '')));
      })),
      h('div', { class: 'lf' },
        h('button', { class: 'pri', onclick: () => { const n = { id: uid(), name: '新角色', pics: [], act: '' }; S.npcs.push(n); U.npc = n.id; save(); render(); } }, '＋ 新增 NPC'),
        h('button', { onclick: () => pickOp((o) => { const n = { id: uid(), name: o.n, code: o.e || '', pics: [{ id: uid(), src: ART + o.id + '.webp' }], act: '' }; S.npcs.push(n); U.npc = n.id; save(); render(); toast('已按干员库添加：' + o.n); }) }, '＋ 从干员库添加')));
    const detail = cur ? h('div', { class: 'cols' },
      h('div', { class: 'colL' }, portraitBlock(cur, cur.name + ' 立绘')),
      h('div', { class: 'colR' },
        h('div', { class: 'ttl' }, h('b', {}, cur.name || 'NPC'), h('small', {}, cur.role || '')),
        actions(
          h('button', { class: 'pri', onclick: () => toChat(fmtEnt('NPC设定·' + (cur.name || ''), cur, NPC_F)) }, T_INS),
          h('button', { onclick: () => copyText(fmtEnt('NPC设定·' + (cur.name || ''), cur, NPC_F)).then(() => toast('已复制')) }, '复制'),
          h('button', { class: 'dg', onclick: () => { if (confirm('删除 NPC「' + (cur.name || '') + '」？')) { S.npcs = S.npcs.filter((x) => x !== cur); save(); render(); } } }, '删除')),
        form(cur, NPC_F, (k) => { if (k === 'name' || k === 'role') { const li = root.querySelector('.li.on .tx'); if (li) { li.firstChild.textContent = cur.name || '（未命名）'; li.lastChild.textContent = cur.role || cur.code || ''; } } })))
      : h('div', { class: 'blank' }, '还没有 NPC，点左下角新增。');
    return h('div', { class: 'split' }, list, detail);
  }

  /* ============================== 武器 ============================== */
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 6 - n));
  function tabWeapon() {
    if (!S.weapons.find((n) => n.id === U.weapon)) U.weapon = S.weapons[0] ? S.weapons[0].id : '';
    const cur = S.weapons.find((n) => n.id === U.weapon);
    const list = h('div', { class: 'list' },
      h('div', { class: 'lh' }, h('b', {}, '武器库'), h('small', {}, S.weapons.length + ' 件')),
      h('div', { class: 'li-wrap' }, S.weapons.map((n) => {
        const p = n.pics.find((x) => x.id === n.act) || n.pics[0];
        return h('div', { class: 'li' + (n.id === U.weapon ? ' on' : ''), onclick: () => { U.weapon = n.id; render(); } },
          h('div', { class: 'av sq' }, p ? h('img', { src: p.src, alt: '' }) : h('i', {}, '⚔')),
          h('div', { class: 'tx' }, h('b', {}, n.name || '（未命名）'), h('small', {}, stars(n.rank || 1) + (n.owner ? ' · ' + n.owner : ''))));
      })),
      h('div', { class: 'lf' }, h('button', { class: 'pri', onclick: () => { const n = W({ name: '新武器' }); S.weapons.push(n); U.weapon = n.id; save(); render(); } }, '＋ 新增武器')));
    let detail;
    if (cur) {
      const statBox = h('div', { class: 'stats' }, STAT_N.map(([k, l]) => {
        const val = h('em', {}, String(cur.stats[k]));
        const bar = h('i', { style: 'width:' + cur.stats[k] * 10 + '%' });
        return h('label', { class: 'st' }, h('span', {}, l), h('div', { class: 'bar' }, bar),
          h('input', { type: 'range', min: 0, max: 10, step: 1, value: cur.stats[k], oninput: (e) => { cur.stats[k] = +e.target.value; val.textContent = e.target.value; bar.style.width = e.target.value * 10 + '%'; save(); } }), val);
      }));
      const fmt = () => fmtEnt('武器设定·' + (cur.name || ''), cur, WEAPON_F) + '\n品阶：' + stars(cur.rank) + '\n数值：' + STAT_N.map(([k, l]) => l + cur.stats[k] + '/10').join('，');
      detail = h('div', { class: 'cols' },
        h('div', { class: 'colL' }, portraitBlock(cur, cur.name + ' 图像', true), statBox),
        h('div', { class: 'colR' },
          h('div', { class: 'ttl' }, h('b', {}, cur.name || '武器'), h('small', {}, stars(cur.rank || 1))),
          actions(
            h('button', { class: 'pri', onclick: () => toChat(fmt()) }, T_INS),
            h('button', { onclick: () => copyText(fmt()).then(() => toast('已复制')) }, '复制'),
            h('button', { class: 'dg', onclick: () => { if (confirm('删除武器「' + (cur.name || '') + '」？')) { S.weapons = S.weapons.filter((x) => x !== cur); save(); render(); } } }, '删除')),
          h('label', { class: 'f' }, h('span', {}, '品阶'), select([[1, '★ 1'], [2, '★★ 2'], [3, '★★★ 3'], [4, '★★★★ 4'], [5, '★★★★★ 5'], [6, '★★★★★★ 6']], cur.rank || 4, (v) => { cur.rank = +v; save(); render(); })),
          form(cur, WEAPON_F)));
    } else detail = h('div', { class: 'blank' }, '还没有武器，点左下角新增。');
    return h('div', { class: 'split' }, list, detail);
  }

  /* ============================== 记忆宫殿 ============================== */
  const P = () => S.palace;
  const allMems = () => P().rooms.flatMap((r, ri) => r.mem.map((m) => ({ m, r, ri })));
  const dueAt = (m) => m.last + INTERVALS[Math.min(m.n || 0, INTERVALS.length - 1)] * DAY;
  const isDue = (m) => now() >= dueAt(m);
  const dueCount = () => allMems().filter((x) => isDue(x.m)).length;
  const dueText = (m) => {
    const d = dueAt(m) - now();
    if (d <= 0) return '该复习了';
    const dd = Math.ceil(d / DAY);
    return dd <= 1 ? '明天复习' : dd + ' 天后复习';
  };
  function updateBadge() {
    const n = dueCount();
    const b = root && root.querySelector('.badge');
    if (b) { b.textContent = n > 99 ? '99+' : n; b.style.display = n ? 'flex' : 'none'; }
  }
  const starTxt = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  const memText = (x) => '· ' + x.m.title + '（' + x.r.name + (x.m.spot ? ' / ' + x.m.spot : '') + '）：' + x.m.body;
  const roomText = (r) => '【记忆宫殿·' + r.name + '】' + (r.theme ? r.theme : '') + '\n' + r.mem.map((m) => memText({ m, r })).join('\n');

  let palBox, palNav;
  function tabPalace() {
    const wrap = h('div', { class: 'pal' });
    const q = h('input', { class: 'palq', placeholder: '搜索：标题 / 内容 / 标签 / 锚点 / 人物…', value: U.pal.q, oninput: (e) => { U.pal.q = e.target.value; drawPal(); } });
    palNav = h('div', { class: 'palnav' });
    palBox = h('div', { class: 'palbox' });
    wrap.append(h('div', { class: 'palbar' }, palNav, q), palBox);
    requestAnimationFrame(drawPal);
    return wrap;
  }
  function drawPal() {
    if (!palBox) return;
    const st = U.pal;
    const navs = [['map', '🏛 平面图'], ['room', '🚪 房间'], ['time', '📜 时间线'], ['tour', '🧭 巡游复习'], ['tool', '🧰 工具']];
    palNav.innerHTML = '';
    navs.forEach(([k, l]) => palNav.appendChild(h('button', { class: st.view === k && !st.q ? 'on' : '', onclick: () => { st.view = k; st.q = ''; palNav.parentElement.querySelector('.palq').value = ''; if (k === 'tour') st.tour = null; drawPal(); } }, l)));
    palBox.innerHTML = '';
    palBox.scrollTop = 0;
    updateBadge();
    if (st.q.trim()) return palBox.appendChild(vSearch());
    if (st.view === 'map') palBox.appendChild(vMap());
    else if (st.view === 'room') palBox.appendChild(vRoom());
    else if (st.view === 'time') palBox.appendChild(vTime());
    else if (st.view === 'tour') palBox.appendChild(vTour());
    else palBox.appendChild(vTool());
  }
  function goRoom(id, mid) { U.pal.view = 'room'; U.pal.room = id; U.pal.q = ''; const q = palNav.parentElement.querySelector('.palq'); if (q) q.value = ''; if (mid) U.pal.openMem[mid] = true; drawPal(); }

  function vMap() {
    const rooms = P().rooms, all = allMems();
    const stat = h('div', { class: 'pstat' },
      [['房间', rooms.length], ['记忆', all.length], ['待复习', dueCount()], ['★4+', all.filter((x) => x.m.imp >= 4).length]].map(([l, v]) => h('div', {}, h('b', {}, v), h('small', {}, l))));
    const route = h('div', { class: 'route' }, h('span', { class: 'rs' }, '动线'), h('span', { class: 'rc' }, '入口'),
      rooms.map((r) => [h('span', { class: 'ra' }, '→'), h('span', { class: 'rc', onclick: () => goRoom(r.id) }, r.icon + ' ' + r.name)]));
    const cards = h('div', { class: 'rooms' }, rooms.map((r, i) => {
      const due = r.mem.filter(isDue).length;
      return h('div', { class: 'rm', onclick: () => goRoom(r.id) },
        h('div', { class: 'no' }, pad(i + 1)),
        h('div', { class: 'ic' }, r.icon),
        h('b', {}, r.name), h('em', {}, r.theme || ''),
        h('p', {}, r.scene || ''),
        h('div', { class: 'ct' }, h('span', {}, r.mem.length + ' 条记忆'), due ? h('span', { class: 'due' }, due + ' 待复习') : null));
    }), h('div', { class: 'rm add', onclick: () => { const r = { id: uid(), icon: '🏠', name: '新房间', theme: '', scene: '', mem: [] }; P().rooms.push(r); save(); goRoom(r.id); } }, h('div', { class: 'ic' }, '＋'), h('b', {}, '新增房间')));
    return h('div', {}, stat, route,
      h('div', { class: 'hint' }, '用法：把想记住的内容挂在宫殿里的“锚点”上——先想象房间的场景，再想象锚点位置上的奇怪画面（联想），最后写下真正要记的内容。巡游时只看锚点和画面，回想内容。'), cards);
  }

  function vRoom() {
    const rooms = P().rooms;
    if (!rooms.find((r) => r.id === U.pal.room)) U.pal.room = rooms[0] ? rooms[0].id : '';
    const r = rooms.find((x) => x.id === U.pal.room);
    if (!r) return h('div', { class: 'blank' }, '还没有房间');
    const idx = rooms.indexOf(r);
    const move = (d) => { const j = idx + d; if (j < 0 || j >= rooms.length) return; rooms.splice(idx, 1); rooms.splice(j, 0, r); save(); drawPal(); };
    const head = h('div', { class: 'rhead' },
      h('div', { class: 'rtop' },
        h('button', { onclick: () => { U.pal.view = 'map'; drawPal(); } }, '← 平面图'),
        select(rooms.map((x, i) => [x.id, pad(i + 1) + ' ' + x.icon + ' ' + x.name]), r.id, (v) => { U.pal.room = v; drawPal(); }),
        h('button', { onclick: () => move(-1), title: '在动线上前移' }, '◀'), h('button', { onclick: () => move(1), title: '在动线上后移' }, '▶'),
        h('button', { onclick: () => toChat(roomText(r)) }, T_ROOM),
        h('button', { class: 'dg', onclick: () => { if (confirm('删除房间「' + r.name + '」及其 ' + r.mem.length + ' 条记忆？')) { P().rooms = rooms.filter((x) => x !== r); save(); drawPal(); } } }, '删除房间')),
      h('div', { class: 'rform' },
        h('label', { class: 'f s' }, h('span', {}, '图标'), h('input', { value: r.icon, oninput: (e) => { r.icon = e.target.value; save(); } })),
        h('label', { class: 'f' }, h('span', {}, '房间名'), h('input', { value: r.name, oninput: (e) => { r.name = e.target.value; save(); } })),
        h('label', { class: 'f' }, h('span', {}, '主题'), h('input', { value: r.theme || '', oninput: (e) => { r.theme = e.target.value; save(); } })),
        h('label', { class: 'f w' }, h('span', {}, '想象场景（走进这个房间，你看到什么？）'), (() => { const t = h('textarea', { rows: 2, value: r.scene || '', oninput: (e) => { r.scene = e.target.value; grow(e.target); save(); } }); requestAnimationFrame(() => grow(t)); return t; })())));
    const list = h('div', { class: 'mems' }, r.mem.map((m, i) => memCard(m, r, i)));
    const add = h('button', { class: 'pri big', onclick: () => { const m = M('新记忆', '', '', '', '', 3); r.mem.push(m); U.pal.openMem[m.id] = true; save(); drawPal(); } }, '＋ 在本房间放一条记忆');
    return h('div', {}, head, list, add);
  }

  function memCard(m, r, i) {
    const open = !!U.pal.openMem[m.id];
    const card = h('div', { class: 'mem' + (open ? ' open' : '') + (isDue(m) ? ' due' : '') });
    const top = h('div', { class: 'mt', onclick: () => { U.pal.openMem[m.id] = !open; drawPal(); } },
      h('span', { class: 'no' }, r.icon + ' ' + pad(i + 1)),
      h('b', {}, m.title || '（无标题）'),
      h('span', { class: 'star' }, starTxt(m.imp || 3)),
      m.spot ? h('span', { class: 'chip' }, '📍 ' + m.spot) : null,
      isDue(m) ? h('span', { class: 'chip due' }, '待复习') : null,
      h('span', { class: 'arr' }, open ? '▾' : '▸'));
    card.append(top);
    if (!open) {
      if (m.cue) card.append(h('div', { class: 'cue' }, '🖼 ' + m.cue));
      if (m.body) card.append(h('div', { class: 'bd' }, m.body.length > 120 ? m.body.slice(0, 120) + '…' : m.body));
      return card;
    }
    const tf = (k, l, ta, cls) => h('label', { class: 'f ' + (cls || '') + (ta ? ' w' : '') }, h('span', {}, l),
      ta ? (() => { const t = h('textarea', { rows: 2, value: m[k] || '', oninput: (e) => { m[k] = e.target.value; grow(e.target); save(); } }); requestAnimationFrame(() => grow(t)); return t; })()
        : h('input', { value: m[k] || '', oninput: (e) => { m[k] = e.target.value; save(); } }));
    card.append(h('div', { class: 'mform' },
      tf('title', '标题'), tf('spot', '📍 锚点（房间里的具体位置）'),
      tf('cue', '🖼 联想画面（越夸张越好记）', true),
      tf('body', '📝 要记住的内容', true),
      tf('tags', '标签（逗号分隔）'), tf('time', '时间 / 章节'), tf('link', '关联人物（逗号分隔）'),
      h('label', { class: 'f' }, h('span', {}, '重要度'), select([[1, '★ 1'], [2, '★★ 2'], [3, '★★★ 3'], [4, '★★★★ 4'], [5, '★★★★★ 5']], m.imp || 3, (v) => { m.imp = +v; save(); })),
      h('label', { class: 'f' }, h('span', {}, '移到房间'), select(P().rooms.map((x) => [x.id, x.icon + ' ' + x.name]), r.id, (v) => { const to = P().rooms.find((x) => x.id === v); r.mem = r.mem.filter((x) => x !== m); to.mem.push(m); save(); drawPal(); }))));
    card.append(h('div', { class: 'macts' },
      h('span', { class: 'meta' }, '复习 ' + (m.n || 0) + ' 次 · ' + dueText(m)),
      h('button', { onclick: () => { m.n = (m.n || 0) + 1; m.last = now(); save(); drawPal(); toast('已复习，' + dueText(m)); } }, '✓ 复习过了'),
      h('button', { onclick: () => toChat(memText({ m, r })) }, T_MEM),
      h('button', { class: 'dg', onclick: () => { if (confirm('删除这条记忆？')) { r.mem = r.mem.filter((x) => x !== m); save(); drawPal(); } } }, '删除')));
    return card;
  }

  function vSearch() {
    const k = U.pal.q.trim().toLowerCase();
    const res = allMems().filter(({ m, r }) => [m.title, m.body, m.tags, m.spot, m.cue, m.link, m.time, r.name].join(' ').toLowerCase().includes(k));
    return h('div', {}, h('div', { class: 'hint' }, '搜索「' + U.pal.q + '」：' + res.length + ' 条'),
      h('div', { class: 'mems' }, res.map(({ m, r }) => h('div', { class: 'mem', onclick: () => goRoom(r.id, m.id) },
        h('div', { class: 'mt' }, h('span', { class: 'no' }, r.icon + ' ' + r.name), h('b', {}, m.title), h('span', { class: 'star' }, starTxt(m.imp || 3))),
        m.body ? h('div', { class: 'bd' }, m.body.length > 140 ? m.body.slice(0, 140) + '…' : m.body) : null))));
  }

  function vTime() {
    const items = allMems().sort((a, b) => String(a.m.time || '~').localeCompare(String(b.m.time || '~'), 'zh', { numeric: true }) || a.m.c - b.m.c);
    return h('div', { class: 'tl' }, items.map(({ m, r }) => h('div', { class: 'tli', onclick: () => goRoom(r.id, m.id) },
      h('div', { class: 'dot' }), h('div', { class: 'tlt' }, h('small', {}, (m.time || '未标时间') + ' · ' + r.icon + ' ' + r.name), h('b', {}, m.title), h('span', {}, m.body.length > 90 ? m.body.slice(0, 90) + '…' : m.body)))));
  }

  function vTour() {
    const st = U.pal;
    if (!st.tour) {
      return h('div', { class: 'tourstart' },
        h('div', { class: 'big' }, '🧭'),
        h('b', {}, '记忆宫殿巡游'),
        h('p', {}, '按动线依次走进每个房间，只看到“锚点”和“联想画面”，先在心里回想内容，再点“揭晓”核对。记得就进入下一个复习间隔，忘了就重新开始计时。'),
        h('div', { class: 'acts c' },
          h('button', { class: 'pri', onclick: () => { st.tour = { list: allMems(), i: 0, show: false, ok: 0, no: 0 }; drawPal(); } }, '全宫巡游（' + allMems().length + '）'),
          h('button', { onclick: () => { const l = allMems().filter((x) => isDue(x.m)); if (!l.length) return toast('现在没有待复习的记忆'); st.tour = { list: l, i: 0, show: false, ok: 0, no: 0 }; drawPal(); } }, '只复习到期的（' + dueCount() + '）')));
    }
    const t = st.tour;
    if (t.i >= t.list.length) {
      return h('div', { class: 'tourstart' }, h('div', { class: 'big' }, '🎉'), h('b', {}, '巡游结束'),
        h('p', {}, '记得 ' + t.ok + ' 条，忘了 ' + t.no + ' 条。'), h('div', { class: 'acts c' }, h('button', { class: 'pri', onclick: () => { st.tour = null; drawPal(); } }, '返回')));
    }
    const { m, r } = t.list[t.i];
    const card = h('div', { class: 'tourcard' },
      h('div', { class: 'tp' }, h('i', { style: 'width:' + (t.i / t.list.length) * 100 + '%' }), h('span', {}, (t.i + 1) + ' / ' + t.list.length)),
      h('div', { class: 'tr' }, r.icon + ' ' + r.name, h('small', {}, r.scene || '')),
      h('div', { class: 'tspot' }, h('small', {}, '锚点'), m.spot || '（未设置）'),
      h('div', { class: 'tcue' }, h('small', {}, '联想画面'), m.cue || '（未设置）'),
      t.show ? h('div', { class: 'tans' }, h('small', {}, '答案'), h('b', {}, m.title), m.body) : h('button', { class: 'pri big', onclick: () => { t.show = true; drawPal(); } }, '揭晓'),
      t.show ? h('div', { class: 'acts c' },
        h('button', { class: 'pri', onclick: () => { m.n = (m.n || 0) + 1; m.last = now(); t.ok++; t.i++; t.show = false; save(); drawPal(); } }, '✓ 记得'),
        h('button', { class: 'dg', onclick: () => { m.n = 0; m.last = now(); t.no++; t.i++; t.show = false; save(); drawPal(); } }, '✗ 忘了')) : null,
      h('div', { class: 'acts c' }, h('button', { onclick: () => { st.tour = null; drawPal(); } }, '退出巡游')));
    return card;
  }

  function vTool() {
    const all = allMems();
    const mdAll = () => '# 记忆宫殿\n\n' + P().rooms.map((r, i) => '## ' + pad(i + 1) + ' ' + r.icon + ' ' + r.name + '\n' + (r.theme ? '*' + r.theme + '*\n' : '') + (r.scene ? '\n场景：' + r.scene + '\n' : '') + '\n' +
      r.mem.map((m) => '### ' + m.title + '  ' + starTxt(m.imp || 3) + '\n- 锚点：' + (m.spot || '') + '\n- 联想：' + (m.cue || '') + '\n- 内容：' + (m.body || '') + '\n- 标签：' + (m.tags || '') + '　时间：' + (m.time || '') + '　人物：' + (m.link || '') + '\n').join('\n')).join('\n');
    const tagMap = {};
    all.forEach(({ m }) => (m.tags || '').split(/[,，、\s]+/).filter(Boolean).forEach((t) => { tagMap[t] = (tagMap[t] || 0) + 1; }));
    const tags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]);
    return h('div', { class: 'tool' },
      h('div', { class: 'tcard' }, h('b', {}, '注入给 AI'), h('p', {}, '把记忆整理成文字放进聊天输入框（不会自动发送），让模型在下一轮记住这些设定。'),
        h('div', { class: 'acts' },
          h('button', { class: 'pri', onclick: () => toChat('【重要记忆】\n' + all.filter((x) => x.m.imp >= 4).map(memText).join('\n')) }, '★4 以上的记忆'),
          h('button', { onclick: () => toChat('【全部记忆】\n' + all.map(memText).join('\n')) }, '全部记忆'),
          h('button', { onclick: () => toChat('【当前任务与伏笔】\n' + all.filter((x) => /任务|伏笔/.test(x.m.tags + x.r.name)).map(memText).join('\n')) }, '任务与伏笔'))),
      h('div', { class: 'tcard' }, h('b', {}, '导出整座宫殿'),
        h('div', { class: 'acts' },
          h('button', { onclick: () => copyText(mdAll()).then(() => toast('已复制 Markdown')) }, '复制 Markdown'),
          h('button', { onclick: () => download('记忆宫殿.md', mdAll(), 'text/markdown') }, '下载 .md'))),
      h('div', { class: 'tcard' }, h('b', {}, '标签云（点击搜索）'),
        h('div', { class: 'tags' }, tags.length ? tags.map(([t, n]) => h('span', { onclick: () => { U.pal.q = t; palNav.parentElement.querySelector('.palq').value = t; drawPal(); } }, t + ' ' + n)) : '暂无标签')),
      h('div', { class: 'tcard' }, h('b', {}, '遗忘曲线'), h('p', {}, '每条记忆按 1 / 2 / 4 / 7 / 15 / 30 / 60 天的间隔提醒复习；悬浮球右上角的红点就是待复习数量。')));
  }

  /* ============================== 导入导出 ============================== */
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportAll() { download('ak-档案终端-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(S)); toast('已导出全部数据（含上传的立绘）'); }
  function importAll() {
    const f = h('input', { type: 'file', accept: '.json,application/json' });
    f.addEventListener('change', async () => {
      try {
        const o = JSON.parse(await f.files[0].text());
        if (!o || !o.hero || !o.palace) throw new Error('不是档案终端的备份文件');
        if (!confirm('导入会覆盖当前全部数据，确定？')) return;
        S = normalize(o); save(); render(); toast('导入成功');
      } catch (e) { toast('导入失败：' + e.message); }
    });
    f.click();
  }

  /* ============================== 主界面 ============================== */
  const TABS = [['hero', '主角'], ['npc', 'NPC'], ['weapon', '武器'], ['palace', '记忆宫殿']];
  function render() {
    if (!body) return;
    const tabs = root.querySelector('.tabs');
    tabs.innerHTML = '';
    TABS.forEach(([k, l]) => tabs.appendChild(h('button', { class: U.tab === k ? 'on' : '', onclick: () => { U.tab = k; render(); } }, l)));
    const keep = body.scrollTop;
    body.innerHTML = '';
    body.appendChild(U.tab === 'hero' ? tabHero() : U.tab === 'npc' ? tabNpc() : U.tab === 'weapon' ? tabWeapon() : tabPalace());
    body.scrollTop = U.tab === 'palace' ? 0 : keep;
    updateBadge();
  }
  function toggle(open) {
    U.open = open == null ? !U.open : open;
    win.classList.toggle('on', U.open);
    ball.classList.toggle('on', U.open);
    if (U.open) render();
  }

  /* ============================== 样式 ============================== */
  const CSS = `
:host{all:initial}
*{box-sizing:border-box;font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif}
button{cursor:pointer;font:inherit;color:inherit}
.ball{position:fixed;z-index:2147483000;width:44px;height:44px;border-radius:50%;border:2px solid #ff7a2e;background:radial-gradient(circle at 35% 30%,#2b3844,#0b1015 72%);
  color:#ff9a57;font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 0 0 3px rgba(255,122,46,.15),0 6px 18px rgba(0,0,0,.5);transition:transform .18s,box-shadow .18s}
.ball::before{content:"";position:absolute;inset:-7px;border-radius:50%;border:1px dashed rgba(24,209,255,.6);animation:spin 9s linear infinite}
.ball:hover{transform:scale(1.08);box-shadow:0 0 0 4px rgba(255,122,46,.28),0 8px 22px rgba(0,0,0,.55)}
.ball.on{background:#ff7a2e;color:#0b1015}
.badge{position:absolute;right:-6px;top:-6px;min-width:18px;height:18px;border-radius:9px;background:#ff3b4a;color:#fff;font:700 11px/18px sans-serif;padding:0 4px;display:none;align-items:center;justify-content:center;border:2px solid #0b1015}
@keyframes spin{to{transform:rotate(360deg)}}
.win{position:fixed;z-index:2147482999;top:66px;right:14px;width:min(920px,calc(100vw - 20px));height:min(720px,calc(100vh - 80px));display:none;flex-direction:column;
  background:linear-gradient(160deg,#101820,#090d12);color:#e6eef3;border:1px solid rgba(255,255,255,.18);border-top:3px solid #ff7a2e;box-shadow:0 24px 70px rgba(0,0,0,.65);font-size:14px;line-height:1.55}
.win.on{display:flex;animation:pop .22s both}
@keyframes pop{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:none}}
.hd{flex:none;display:flex;align-items:center;gap:10px;padding:8px 12px;background:linear-gradient(90deg,rgba(255,122,46,.22),transparent 70%);cursor:move;user-select:none;border-bottom:1px solid rgba(255,255,255,.1)}
.hd h1{margin:0;font-size:15px;font-weight:900;letter-spacing:.2em;color:#fff}
.hd h1 small{margin-left:10px;font:600 10px sans-serif;letter-spacing:.3em;color:#18d1ff}
.hd .sp{flex:1}
.hd button{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);padding:3px 10px;font-size:12px}
.hd button:hover{background:rgba(255,255,255,.16)}
.tabs{flex:none;display:flex;gap:2px;padding:6px 10px 0;border-bottom:1px solid rgba(255,255,255,.12);overflow-x:auto}
.tabs button{background:none;border:0;border-bottom:3px solid transparent;padding:7px 18px;font-size:15px;font-weight:800;letter-spacing:.12em;color:#8ea2b0;white-space:nowrap}
.tabs button:hover{color:#fff}.tabs button.on{color:#ff9a57;border-bottom-color:#ff7a2e;background:linear-gradient(180deg,transparent,rgba(255,122,46,.12))}
.body{flex:1;min-height:0;overflow:auto;padding:12px 14px;scrollbar-width:thin;scrollbar-color:#3a4a57 transparent}
.ft{flex:none;padding:5px 12px;font-size:11px;letter-spacing:.06em;color:#7d909d;border-top:1px solid rgba(255,255,255,.08)}
.toast{position:absolute;left:50%;bottom:34px;transform:translate(-50%,10px);padding:7px 18px;background:#18d1ff;color:#06141b;font-weight:800;font-size:13px;opacity:0;pointer-events:none;transition:.25s;z-index:5;max-width:90%}
.toast.on{opacity:1;transform:translate(-50%,0)}
button{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);color:#e6eef3;padding:5px 12px;font-size:13px}
button:hover{background:rgba(255,255,255,.15)}
button.pri{background:#ff7a2e;border-color:#ff7a2e;color:#111;font-weight:800}button.pri:hover{background:#ff9a57}
button.dg{color:#ff8a93;border-color:rgba(255,59,74,.5)}button.dg:hover{background:rgba(255,59,74,.2)}
button:disabled{opacity:.35;cursor:not-allowed}
button.big{width:100%;padding:10px;font-size:15px;margin-top:8px}
input,textarea,select{font:inherit;color:#eef5f9;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.18);padding:5px 8px;width:100%;outline:none;border-radius:0}
input:focus,textarea:focus,select:focus{border-color:#18d1ff;box-shadow:0 0 0 2px rgba(24,209,255,.18)}
textarea{resize:vertical;min-height:34px;line-height:1.6}
select option{background:#101820}
.cols{display:grid;grid-template-columns:minmax(220px,36%) 1fr;gap:16px;align-items:start}
.colL{position:sticky;top:0}
.split{display:grid;grid-template-columns:178px 1fr;gap:12px;align-items:start}
.list{position:sticky;top:0;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.25);max-height:calc(100% - 2px)}
.lh{display:flex;justify-content:space-between;align-items:baseline;padding:7px 10px;background:rgba(255,122,46,.15);border-bottom:1px solid rgba(255,255,255,.1)}
.lh small{color:#9fb2bf}
.li-wrap{overflow:auto;max-height:440px;scrollbar-width:thin}
.li{display:flex;gap:9px;align-items:center;padding:7px 9px;cursor:pointer;border-left:3px solid transparent;border-bottom:1px solid rgba(255,255,255,.06)}
.li:hover{background:rgba(255,255,255,.07)}.li.on{background:rgba(255,122,46,.18);border-left-color:#ff7a2e}
.av{flex:none;width:38px;height:38px;border-radius:50%;overflow:hidden;background:#1b2631;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.2)}
.av.sq{border-radius:3px}.av img{width:100%;height:100%;object-fit:cover;object-position:50% 20%}.av i{font-style:normal;font-weight:800;color:#ff9a57}
.tx{min-width:0}.tx b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tx small{display:block;font-size:11px;color:#8ea2b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lf{display:flex;flex-direction:column;gap:5px;padding:8px;border-top:1px solid rgba(255,255,255,.1)}
.blank{padding:50px 10px;text-align:center;color:#8ea2b0}
.ttl{display:flex;align-items:baseline;gap:12px;margin-bottom:8px}.ttl b{font-size:19px;letter-spacing:.14em;color:#fff}.ttl small{color:#ff9a57;letter-spacing:.1em}
.acts{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.acts.c{justify-content:center;margin-top:10px}
.pb .stage{position:relative;height:min(430px,52vh);background:radial-gradient(ellipse at 50% 100%,rgba(24,209,255,.2),transparent 65%),linear-gradient(180deg,#0f1822,#0a1017);border:1px solid rgba(255,255,255,.16);display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
.pb.sm .stage{height:200px}
.pb .stage::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 1px,transparent 1px 3px)}
.pb .stage img{max-width:100%;max-height:100%;object-fit:contain;object-position:50% 100%;filter:drop-shadow(0 6px 14px rgba(0,0,0,.6))}
.pb .empty{align-self:center;width:84%;padding:30px 10px;border:2px dashed rgba(255,255,255,.3);text-align:center;cursor:pointer;color:#9fb2bf;font-weight:700;display:flex;flex-direction:column;gap:6px;align-items:center}
.pb .empty:hover{border-color:#ff7a2e;color:#ff9a57}.pb .empty i{font:300 38px/1 sans-serif;font-style:normal;color:#ff7a2e}.pb .empty small{font-weight:400;color:#7d909d}
.pbar{display:flex;gap:5px;margin-top:7px;flex-wrap:wrap}.pbar button{flex:1;padding:5px 6px;font-size:12px}
.thumbs{display:flex;gap:5px;margin-top:7px;overflow-x:auto;padding-bottom:4px}
.thumbs img{flex:none;width:46px;height:60px;object-fit:cover;object-position:50% 15%;border:2px solid transparent;opacity:.65;cursor:pointer;background:#111b24}.thumbs img.on,.thumbs img:hover{opacity:1;border-color:#ff7a2e}
.form{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}
.f{display:flex;flex-direction:column;gap:2px;min-width:0}.f.w{grid-column:1/-1}.f.s{max-width:90px}
.f>span{font-size:12px;font-weight:700;letter-spacing:.1em;color:#18d1ff}
.stats{margin-top:10px;padding:8px 10px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.25)}
.st{display:grid;grid-template-columns:62px 1fr 0 28px;gap:6px;align-items:center;position:relative;height:25px;font-size:12px}
.st span{color:#9fb2bf}.st .bar{height:7px;background:rgba(255,255,255,.1);position:relative;overflow:hidden}.st .bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#ff7a2e,#ffcf47)}
.st input[type=range]{position:absolute;left:68px;right:34px;top:0;height:25px;opacity:0;padding:0;cursor:pointer;width:auto}
.st em{font-style:normal;font-weight:800;text-align:right;color:#fff}
.ov{position:absolute;inset:0;z-index:20;background:rgba(3,6,9,.85);display:flex;padding:20px}
.ovbox{margin:auto;width:100%;height:100%;display:flex;flex-direction:column;background:#0d141b;border:1px solid rgba(255,255,255,.2);border-top:3px solid #18d1ff}
.ovh{flex:none;display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.12)}.ovh .opq{flex:1}
.x{padding:2px 10px}
.opgrid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:8px;padding:10px;align-content:start;scrollbar-width:thin}
.opc{cursor:pointer;border:1px solid rgba(255,255,255,.12);background:#111b24;display:flex;flex-direction:column;align-items:center}
.opc:hover{border-color:#ff7a2e;background:#1b2631}.opc img{width:100%;height:104px;object-fit:cover;object-position:50% 12%}.opc span{padding:3px 2px;font-size:12px;text-align:center}
.palbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;position:sticky;top:-12px;z-index:3;background:#0c1218;padding:8px 0}
.palnav{display:flex;gap:4px;flex-wrap:wrap}.palnav button.on{background:#18d1ff;border-color:#18d1ff;color:#06141b;font-weight:800}
.palq{flex:1;min-width:180px}
.pstat{display:flex;gap:10px;margin-bottom:10px}.pstat div{flex:1;text-align:center;padding:7px;background:rgba(255,255,255,.05);border-left:3px solid #ff7a2e}
.pstat b{display:block;font-size:22px;color:#fff;line-height:1.2}.pstat small{color:#9fb2bf;letter-spacing:.2em}
.route{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:8px;font-size:12px}
.route .rs{font-weight:800;color:#ff9a57;letter-spacing:.2em;margin-right:4px}.route .rc{padding:2px 9px;background:rgba(24,209,255,.12);border:1px solid rgba(24,209,255,.35);cursor:pointer}.route .rc:hover{background:rgba(24,209,255,.28)}.route .ra{color:#5d7280}
.hint{margin:6px 0 10px;padding:8px 12px;font-size:12.5px;line-height:1.7;color:#b3c3ce;background:rgba(255,122,46,.08);border-left:3px solid #ff7a2e}
.rooms{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:10px}
.rm{position:relative;padding:12px 12px 10px;cursor:pointer;background:linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.14);transition:.18s}
.rm:hover{border-color:#ff7a2e;transform:translateY(-2px);background:linear-gradient(160deg,rgba(255,122,46,.2),rgba(255,255,255,.03))}
.rm .no{position:absolute;right:10px;top:6px;font:800 24px sans-serif;color:rgba(255,255,255,.1)}
.rm .ic{font-size:30px;line-height:1}.rm b{display:block;margin-top:5px;font-size:16px;letter-spacing:.1em;color:#fff}.rm em{display:block;font-style:normal;font-size:12px;color:#18d1ff}
.rm p{margin:6px 0 8px;font-size:12px;line-height:1.6;color:#9fb2bf;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.rm .ct{display:flex;gap:6px;font-size:11px}.rm .ct span{padding:1px 7px;background:rgba(255,255,255,.1)}.rm .ct .due,.chip.due{background:#ff3b4a;color:#fff}
.rm.add{display:flex;flex-direction:column;align-items:center;justify-content:center;border-style:dashed;min-height:140px;color:#9fb2bf}
.rhead{margin-bottom:10px;padding:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12)}
.rtop{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}.rtop select{width:auto;flex:1;min-width:150px}
.rform{display:grid;grid-template-columns:90px 1fr 1fr;gap:8px}.rform .f.w{grid-column:1/-1}
.mems{display:flex;flex-direction:column;gap:8px}
.mem{padding:8px 11px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-left:4px solid #3a4a57}
.mem.due{border-left-color:#ff3b4a}.mem.open{border-left-color:#18d1ff;background:rgba(24,209,255,.06)}
.mt{display:flex;align-items:center;gap:8px;flex-wrap:wrap;cursor:pointer}.mt b{font-size:15px;color:#fff}.mt .no{font-size:12px;color:#8ea2b0}.mt .star{color:#ffcf47;font-size:12px;letter-spacing:1px}.mt .arr{margin-left:auto;color:#8ea2b0}
.chip{padding:0 8px;font-size:11px;background:rgba(255,255,255,.1);border-radius:9px}
.cue{margin-top:4px;font-size:12.5px;color:#8fe3ff}.bd{margin-top:3px;font-size:13px;color:#c5d3dc;line-height:1.7}
.mform{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin-top:8px}
.macts{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:9px}.macts .meta{margin-right:auto;font-size:12px;color:#8ea2b0}
.tl{position:relative;padding-left:20px;border-left:2px solid rgba(255,122,46,.5);margin-left:8px}
.tli{position:relative;padding:6px 0 12px 8px;cursor:pointer}.tli .dot{position:absolute;left:-28px;top:10px;width:12px;height:12px;border-radius:50%;background:#ff7a2e;border:2px solid #0c1218}
.tli small{display:block;color:#18d1ff;font-size:11px}.tli b{display:block;color:#fff}.tli span{font-size:12.5px;color:#9fb2bf}.tli:hover b{color:#ff9a57}
.tourstart{max-width:520px;margin:30px auto;text-align:center}.tourstart .big{font-size:56px}.tourstart b{font-size:20px;letter-spacing:.2em}.tourstart p{color:#9fb2bf;line-height:1.8}
.tourcard{max-width:600px;margin:10px auto;padding:14px 18px 16px;background:linear-gradient(160deg,#142029,#0b1117);border:1px solid rgba(24,209,255,.4);border-top:3px solid #18d1ff}
.tp{position:relative;height:18px;margin-bottom:8px;background:rgba(255,255,255,.08)}.tp i{position:absolute;left:0;top:0;bottom:0;background:#18d1ff}.tp span{position:absolute;right:6px;top:0;font-size:11px;line-height:18px;color:#fff;mix-blend-mode:difference}
.tr{font-size:18px;font-weight:800;color:#fff}.tr small{display:block;font-weight:400;font-size:12px;color:#8ea2b0;line-height:1.6;margin-top:2px}
.tspot,.tcue,.tans{margin-top:10px;padding:9px 12px;background:rgba(255,255,255,.05);border-left:3px solid #ff7a2e;line-height:1.7}
.tcue{border-left-color:#18d1ff;color:#8fe3ff;font-size:16px}.tans{border-left-color:#7dff9a;color:#e6fff0}.tans b{display:block;color:#fff;margin-bottom:3px}
.tspot small,.tcue small,.tans small{display:block;font-size:11px;letter-spacing:.3em;color:#8ea2b0}
.tool{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tcard{padding:10px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-top:2px solid #ff7a2e}
.tcard b{display:block;margin-bottom:4px;color:#fff;letter-spacing:.1em}.tcard p{margin:0 0 8px;font-size:12.5px;color:#9fb2bf}
.tags{display:flex;gap:6px;flex-wrap:wrap}.tags span{padding:2px 10px;background:rgba(24,209,255,.14);border:1px solid rgba(24,209,255,.4);cursor:pointer;font-size:12px}.tags span:hover{background:rgba(24,209,255,.3)}
@media (max-width:720px){
  .win{top:60px;left:6px;right:6px;width:auto;height:calc(100vh - 70px)}
  .cols{grid-template-columns:1fr}.colL{position:static}.pb .stage{height:min(360px,46vh)}
  .split{grid-template-columns:1fr}.list{position:static}.li-wrap{max-height:150px}
  .form,.mform,.tool{grid-template-columns:1fr}.rform{grid-template-columns:1fr 1fr}
  .tabs button{padding:7px 12px;font-size:14px}.hd h1 small{display:none}
}
.win.emb{display:flex!important;position:fixed!important;inset:0!important;top:0!important;left:0!important;right:0!important;width:100%!important;height:100%!important;border:0;border-top:3px solid #ff7a2e;box-shadow:none;animation:none}
.win.emb .hd{cursor:default}.win.emb .hd .x,.win.emb .dupx{display:none}`;

  /* ============================== 挂载 ============================== */
  function placeBall() {
    if (!ball || EMBED) return;
    const on = /^\/chat(\/|$)/.test(location.pathname);
    host.style.display = on ? '' : 'none';
    if (!on) { if (U.open) toggle(false); return; }
    const btn = document.querySelector('button[aria-label="系统公告"]') || document.querySelector('button[aria-label="通知"]');
    let left, top;
    if (btn) {
      const r = btn.getBoundingClientRect();
      if (r.width > 0) { left = r.left - 54; top = r.top + (r.height - 44) / 2; }
    }
    if (left == null) { left = window.innerWidth - 200; top = 10; }
    ball.style.left = Math.max(4, left) + 'px';
    ball.style.top = Math.max(2, top) + 'px';
  }
  function dragify(handle, el) {
    let sx, sy, ox, oy, on = false;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || window.innerWidth <= 720) return;
      const r = el.getBoundingClientRect(); on = true; sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!on) return;
      el.style.left = Math.min(Math.max(0, ox + e.clientX - sx), window.innerWidth - 80) + 'px';
      el.style.top = Math.min(Math.max(0, oy + e.clientY - sy), window.innerHeight - 40) + 'px';
      el.style.right = 'auto';
    });
    handle.addEventListener('pointerup', () => { on = false; });
  }

  async function boot() {
    // IndexedDB 偶尔会被隐私模式/权限拦住而一直不回调: 超时后放弃, 改用 localStorage 后备, 保证球一定出现
    const tmo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
    try { await tmo(DB.open(), 2500); S = await tmo(DB.get('state'), 2500); } catch (e) { DB.db = null; S = null; }
    if (!S) { try { S = JSON.parse(localStorage.getItem('ak-palace-fallback') || 'null'); } catch (e) { S = null; } }
    const first = !S;
    S = normalize(S);
    if (first) { try { await DB.set('state', S); } catch (e) {} }
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

    host = document.createElement('div');
    host.id = 'ak-palace-host';
    root = host.attachShadow({ mode: 'open' });
    root.appendChild(h('style', { html: CSS }));
    ball = h('button', { class: 'ball', title: '罗德岛档案终端（主角 / NPC / 武器 / 记忆宫殿）', onclick: () => toggle() }, '◈', h('span', { class: 'badge' }, '0'));
    body = h('div', { class: 'body' });
    footEl = h('div', { class: 'ft' }, '已就绪');
    toastEl = h('div', { class: 'toast' });
    const hd = h('div', { class: 'hd' }, h('h1', {}, '罗德岛档案终端', h('small', {}, 'ARCHIVE TERMINAL')), h('div', { class: 'sp' }),
      h('button', { onclick: exportAll }, '导出'), h('button', { onclick: importAll }, '导入'), h('button', { class: 'x', onclick: () => toggle(false) }, '✕'));
    win = h('div', { class: 'win' }, hd, h('div', { class: 'tabs' }), body, footEl, toastEl);
    if (EMBED) { win.classList.add('emb'); root.append(win); } else root.append(ball, win);
    document.documentElement.appendChild(host);
    dragify(hd, win);
    placeBall(); updateBadge();
    if (EMBED) toggle(true);
    else setInterval(placeBall, 700);
    window.addEventListener('resize', placeBall);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && U.open) { const ov = root.querySelector('.ov'); if (ov) ov.remove(); else toggle(false); } });
    window.__akPalApi = { get state() { return S; }, open: () => toggle(true), toChat };
  }
  boot();
})();
