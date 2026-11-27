import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cnchar = require('cnchar');
const orderPlugin = require('cnchar-order');
const radicalPlugin = require('cnchar-radical');
const wordsPlugin = require('cnchar-words');
cnchar.use(orderPlugin, radicalPlugin, wordsPlugin);

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'hanzi-data');
const STROKES_DIR = path.join(OUT_DIR, 'strokes');
fs.mkdirSync(STROKES_DIR, { recursive: true });

const hwdDir = path.dirname(require.resolve('hanzi-writer-data/package.json'));
const hskDir = path.dirname(require.resolve('@leonsilicon/hsk3.0/package.json'));

// Legacy 24 showcase characters (preserve exact IDs for backward compatibility with mastery & tests)
const LEGACY_MAP = new Map([
  ['一', { id: 'yi', words: ['一个', '一天', '第一'], mnemonic: '一根小木棒，平平稳稳横在田字格正中间。' }],
  ['二', { id: 'er', words: ['二月', '二十', '第二'], mnemonic: '上横短，下横长，稳稳托起不摇晃。' }],
  ['三', { id: 'san', words: ['三月', '三天', '三心二意'], mnemonic: '三横间距要均匀，中间最短底最长。' }],
  ['十', { id: 'shi', words: ['十个', '十分', '十全十美'], mnemonic: '先横后竖记心间，十字路口正中间。' }],
  ['上', { id: 'shang', words: ['上学', '上去', '向上'], mnemonic: '先写竖，再短横，底横托稳往上冲。' }],
  ['口', { id: 'kou', words: ['人口', '口水', '出口'], mnemonic: '先左竖，再横折，最后封口像小嘴。' }],
  ['日', { id: 'ri', words: ['红日', '日光', '生日'], mnemonic: '外框方正先不封，写完里横再封口。' }],
  ['月', { id: 'yue', words: ['月亮', '月光', '一月'], mnemonic: '弯弯月儿向左撇，两道短横藏里面。' }],
  ['山', { id: 'shan', words: ['大山', '高山', '山水'], mnemonic: '先写中间高主峰，再写左边和右边。' }],
  ['水', { id: 'shui', words: ['河水', '水果', '山水'], mnemonic: '先中间后两边，水花向左右飞溅。' }],
  ['火', { id: 'huo', words: ['大火', '火苗', '火车'], mnemonic: '先点后撇像火花，中间人字撑起它。' }],
  ['木', { id: 'mu', words: ['木头', '树木', '积木'], mnemonic: '横竖交叉作树干，撇捺张开像树根。' }],
  ['人', { id: 'ren', words: ['大人', '人民', '好人'], mnemonic: '一撇一捺互相靠，堂堂正正立得牢。' }],
  ['大', { id: 'da', words: ['大人', '大小', '大家'], mnemonic: '人字张开双臂，顶天立地真神气。' }],
  ['小', { id: 'xiao', words: ['小草', '大小', '小学'], mnemonic: '先写中间竖钩，左右两点对称呼应。' }],
  ['中', { id: 'zhong', words: ['中国', '中间', '中心'], mnemonic: '扁扁口字先写好，一竖居中穿过去。' }],
  ['天', { id: 'tian_sky', words: ['天空', '蓝天', '今天'], mnemonic: '二人顶天立，上短下长撇捺舒展。' }],
  ['田', { id: 'tian_field', words: ['田地', '水田', '种田'], mnemonic: '先外后里再封口，里面十字分四块。' }],
  ['禾', { id: 'he', words: ['禾苗', '青禾', '禾田'], mnemonic: '木字头上加平撇，像沉甸甸的稻穗低头。' }],
  ['土', { id: 'tu', words: ['土地', '泥土', '国土'], mnemonic: '短横一竖长横托，像一颗小苗破土出。' }],
  ['手', { id: 'shou', words: ['小手', '拍手', '招手'], mnemonic: '平撇两横弯钩稳，伸出小手真灵活。' }],
  ['心', { id: 'xin', words: ['开心', '爱心', '用心'], mnemonic: '卧钩像只小月亮，三颗星星伴身旁。' }],
  ['文', { id: 'wen', words: ['语文', '文明', '课文'], mnemonic: '一点一横戴小帽，撇捺相交有文采。' }],
  ['永', { id: 'yong', words: ['永远', '永久', '永不放弃'], mnemonic: '点横折钩提撇捺，一字藏尽书法八法。' }],
]);

const LEGACY_ORDERED_CHARS = Array.from(LEGACY_MAP.keys());

const SEMESTER_META = [
  { id: 'g1s1', gradeNum: 1, semester: 1, grade: '一年级上' },
  { id: 'g1s2', gradeNum: 1, semester: 2, grade: '一年级下' },
  { id: 'g2s1', gradeNum: 2, semester: 1, grade: '二年级上' },
  { id: 'g2s2', gradeNum: 2, semester: 2, grade: '二年级下' },
  { id: 'g3s1', gradeNum: 3, semester: 1, grade: '三年级上' },
  { id: 'g3s2', gradeNum: 3, semester: 2, grade: '三年级下' },
  { id: 'g4s1', gradeNum: 4, semester: 1, grade: '四年级上' },
  { id: 'g4s2', gradeNum: 4, semester: 2, grade: '四年级下' },
  { id: 'g5s1', gradeNum: 5, semester: 1, grade: '五年级上' },
  { id: 'g5s2', gradeNum: 5, semester: 2, grade: '五年级下' },
  { id: 'g6s1', gradeNum: 6, semester: 1, grade: '六年级上' },
  { id: 'g6s2', gradeNum: 6, semester: 2, grade: '六年级下' },
];

// Build word index from HSK 3.0 common 2-char and 3-char words for kid-friendly vocabulary
const hskWords = JSON.parse(fs.readFileSync(path.join(hskDir, 'HSK3.0_words.json'), 'utf8'));
const wordsByChar = new Map();
for (const word of hskWords) {
  if (typeof word !== 'string') continue;
  const clean = word.replace(/[^一-龥]/g, '');
  if (clean.length < 2 || clean.length > 4) continue;
  for (const ch of new Set(clean)) {
    let list = wordsByChar.get(ch);
    if (!list) {
      list = [];
      wordsByChar.set(ch, list);
    }
    if (list.length < 16) list.push(clean);
  }
}

// Sort candidate words so 2-character common words come first
function pickWordsForChar(ch) {
  const legacy = LEGACY_MAP.get(ch);
  if (legacy) return legacy.words;

  const picked = [];
  const seen = new Set();

  const hskList = (wordsByChar.get(ch) || []).slice().sort((a, b) => a.length - b.length);
  for (const w of hskList) {
    if (!seen.has(w)) {
      seen.add(w);
      picked.push(w);
      if (picked.length >= 3) return picked;
    }
  }

  try {
    const cnList = cnchar.words(ch) || [];
    const sortedCn = cnList
      .filter((w) => typeof w === 'string' && /^[一-龥]{2,4}$/.test(w))
      .sort((a, b) => a.length - b.length);
    for (const w of sortedCn) {
      if (!seen.has(w)) {
        seen.add(w);
        picked.push(w);
        if (picked.length >= 3) return picked;
      }
    }
  } catch {
    // ignore
  }

  if (picked.length === 0) picked.push(`${ch}字`);
  return picked;
}

function normalizeStructureCode(structText) {
  if (!structText || typeof structText !== 'string') return 0;
  if (structText.includes('左右') || structText.includes('左中右')) return 1;
  if (structText.includes('上下') || structText.includes('上中下')) return 2;
  if (structText.includes('包围') && !structText.includes('全')) return 3;
  if (structText.includes('全包围')) return 4;
  return 0; // 独体字
}

const STRUCTURE_NAMES = ['独体字', '左右结构', '上下结构', '半包围', '全包围'];

function stripPinyinTones(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ü/g, 'v')
    .toLowerCase();
}

// Simplify a Make Me a Hanzi median polyline into 0..1000 integer Tianzige coords (0.1 precision in 0..100)
function normalizeMedianPoints(rawMedian) {
  if (!Array.isArray(rawMedian) || rawMedian.length === 0) return [500, 500, 520, 500];
  const mapped = rawMedian.map(([rx, ry]) => ({
    x: Math.max(4, Math.min(96, 8 + (rx / 1024) * 84)),
    y: Math.max(4, Math.min(96, 8 + ((900 - ry) / 1024) * 84)),
  }));

  // Deduplicate near-identical consecutive points (< 0.8 units)
  const deduped = [mapped[0]];
  for (let i = 1; i < mapped.length; i++) {
    const prev = deduped[deduped.length - 1];
    const curr = mapped[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= 0.8 || i === mapped.length - 1) {
      deduped.push(curr);
    }
  }

  // Ensure at least 2 points
  if (deduped.length === 1) {
    deduped.push({ x: Math.min(96, deduped[0].x + 2.5), y: Math.min(96, deduped[0].y + 2.5) });
  }

  // If > 12 points, keep start, end, sharp corners, and evenly spaced samples
  let finalPts = deduped;
  if (deduped.length > 12) {
    finalPts = [deduped[0]];
    const step = (deduped.length - 1) / 11;
    for (let k = 1; k < 11; k++) {
      finalPts.push(deduped[Math.round(k * step)]);
    }
    finalPts.push(deduped[deduped.length - 1]);
  }

  const flat = [];
  for (const pt of finalPts) {
    flat.push(Math.round(pt.x * 10), Math.round(pt.y * 10));
  }
  return flat;
}

// Geometric fallback stroke classifier when cnchar-order count differs from hanzi-writer-data
function inferStrokeName(flatPts) {
  const n = flatPts.length / 2;
  if (n < 2) return '点';
  const x0 = flatPts[0] / 10;
  const y0 = flatPts[1] / 10;
  const xEnd = flatPts[(n - 1) * 2] / 10;
  const yEnd = flatPts[(n - 1) * 2 + 1] / 10;
  const dx = xEnd - x0;
  const dy = yEnd - y0;
  const dist = Math.hypot(dx, dy);

  // Detect sharp corner (>55 deg turn) inside the stroke
  let hasTurn = false;
  let firstDx = 0;
  let firstDy = 0;
  let lastDx = 0;
  let lastDy = 0;
  if (n >= 3) {
    let maxTurnDot = 1;
    let turnIdx = -1;
    for (let i = 1; i < n - 1; i++) {
      const ax = flatPts[i * 2] / 10 - flatPts[(i - 1) * 2] / 10;
      const ay = flatPts[i * 2 + 1] / 10 - flatPts[(i - 1) * 2 + 1] / 10;
      const bx = flatPts[(i + 1) * 2] / 10 - flatPts[i * 2] / 10;
      const by = flatPts[(i + 1) * 2 + 1] / 10 - flatPts[i * 2 + 1] / 10;
      const la = Math.hypot(ax, ay);
      const lb = Math.hypot(bx, by);
      if (la > 3 && lb > 3) {
        const dot = (ax * bx + ay * by) / (la * lb);
        if (dot < maxTurnDot) {
          maxTurnDot = dot;
          turnIdx = i;
        }
      }
    }
    if (maxTurnDot < 0.45 && turnIdx > 0) {
      hasTurn = true;
      firstDx = flatPts[turnIdx * 2] / 10 - x0;
      firstDy = flatPts[turnIdx * 2 + 1] / 10 - y0;
      lastDx = xEnd - flatPts[turnIdx * 2] / 10;
      lastDy = yEnd - flatPts[turnIdx * 2 + 1] / 10;
    }
  }

  if (hasTurn) {
    if (Math.abs(firstDx) > Math.abs(firstDy) && firstDx > 0) {
      if (lastDy > 4 && lastDx < -3) return '横撇';
      if (lastDy > 4) return '横折';
    }
    if (Math.abs(firstDy) > Math.abs(firstDx) && firstDy > 0) {
      if (lastDx > 4 && lastDy < 5) return '竖折';
      if (lastDx < -2 && lastDy < 2) return '竖钩';
      if (lastDx > 4) return '竖弯钩';
    }
    return '折';
  }

  if (dist < 13) return '点';
  if (Math.abs(dx) > Math.abs(dy) * 1.8 && dx > 0) {
    return dy < -5 ? '提' : '横';
  }
  if (Math.abs(dy) > Math.abs(dx) * 1.8 && dy > 0) return '竖';
  if (dx < -4 && dy > 4) return '撇';
  if (dx > 4 && dy > 4) return dist < 18 ? '点' : '捺';
  if (dx > 4 && dy < -3) return '提';
  return '横';
}

function cleanStrokeName(rawName, flatPts) {
  if (!rawName || typeof rawName !== 'string') return inferStrokeName(flatPts);
  const first = rawName.split('|')[0].trim();
  return first || inferStrokeName(flatPts);
}

function buildMnemonic(ch, radical, structCode, strokeCount, words) {
  const legacy = LEGACY_MAP.get(ch);
  if (legacy) return legacy.mnemonic;
  const structName = STRUCTURE_NAMES[structCode];
  const sampleWord = words[0] || `${ch}字`;
  if (structCode === 1) {
    return `${structName}，部首「${radical}」，左右比例协调，如词语“${sampleWord}”。`;
  }
  if (structCode === 2) {
    return `${structName}，部首「${radical}」，上下对正重心稳，如词语“${sampleWord}”。`;
  }
  if (structCode === 3 || structCode === 4) {
    return `${structName}，部首「${radical}」，先外后里结构匀称，共 ${strokeCount} 画。`;
  }
  return `${structName}，共 ${strokeCount} 画，居中站稳笔画舒展，如词语“${sampleWord}”。`;
}

// 1. Collect all 3,000 characters ordered progressively across HSK levels 1..7-9
// Within each level band, sort by stroke count ascending so Grade 1 starts with simple strokes!
const levelFiles = ['1', '2', '3', '4', '5', '6', '7-9'];
const seenChars = new Set();
const orderedChars = [];

function getStrokeCountFromHwd(ch) {
  const filePath = path.join(hwdDir, `${ch}.json`);
  if (!fs.existsSync(filePath)) return 99;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(data.medians) ? data.medians.length : 99;
}

// Start with our 24 legacy showcase characters so Grade 1 Semester 1 Unit 1 is rock-solid
for (const ch of LEGACY_ORDERED_CHARS) {
  seenChars.add(ch);
  orderedChars.push(ch);
}

for (const lv of levelFiles) {
  const arr = JSON.parse(fs.readFileSync(path.join(hskDir, `HSK3.0_chars_level${lv}.json`), 'utf8'));
  const batch = [];
  for (const ch of arr) {
    if (seenChars.has(ch)) continue;
    const hwdPath = path.join(hwdDir, `${ch}.json`);
    if (!fs.existsSync(hwdPath)) continue;
    seenChars.add(ch);
    batch.push({ ch, strokes: getStrokeCountFromHwd(ch) });
  }
  // Sort gently by stroke count ascending so easier strokes appear earlier in each grade band
  batch.sort((a, b) => a.strokes - b.strokes);
  for (const item of batch) {
    orderedChars.push(item.ch);
  }
}

console.log(`Total ordered elementary characters: ${orderedChars.length}`);

// 2. Partition into 12 Semesters (250 chars each = 3,000 total) and 10 Units per semester (25 chars each)
const CHARS_PER_SEMESTER = 250;
const CHARS_PER_UNIT = 25;

const catalogEntries = [];
const semesterStrokes = {};
for (const sm of SEMESTER_META) {
  semesterStrokes[sm.id] = {};
}

let totalStrokesProcessed = 0;

for (let i = 0; i < orderedChars.length; i++) {
  const ch = orderedChars[i];
  const semIdx = Math.min(SEMESTER_META.length - 1, Math.floor(i / CHARS_PER_SEMESTER));
  const sem = SEMESTER_META[semIdx];
  const indexInSem = i - semIdx * CHARS_PER_SEMESTER;
  const unitIndex = Math.min(10, Math.floor(indexInSem / CHARS_PER_UNIT) + 1);

  const legacy = LEGACY_MAP.get(ch);
  const id = legacy ? legacy.id : `u${ch.codePointAt(0).toString(16)}`;

  // Load real medians from hanzi-writer-data
  const hwdData = JSON.parse(fs.readFileSync(path.join(hwdDir, `${ch}.json`), 'utf8'));
  const medians = hwdData.medians || [];
  const strokeCount = medians.length;

  // Query cnchar metadata
  let pinyin = '';
  try {
    const sp = cnchar.spell(ch, 'tone', 'low');
    pinyin = typeof sp === 'string' ? sp.split(',')[0].trim() : '';
  } catch {
    pinyin = '';
  }
  const pinyinPlain = stripPinyinTones(pinyin);

  let radical = ch;
  let structCode = 0;
  try {
    const radInfo = cnchar.radical(ch);
    if (Array.isArray(radInfo) && radInfo[0]) {
      radical = radInfo[0].radical || ch;
      structCode = normalizeStructureCode(radInfo[0].struct);
    }
  } catch {
    // fallback
  }

  let cnOrderNames = [];
  try {
    const ord = cnchar.stroke(ch, 'order', 'name');
    if (Array.isArray(ord) && Array.isArray(ord[0])) {
      cnOrderNames = ord[0];
    }
  } catch {
    cnOrderNames = [];
  }

  const useCnNames = cnOrderNames.length === medians.length;
  const compactStrokes = medians.map((rawMed, sIdx) => {
    const flatPts = normalizeMedianPoints(rawMed);
    const name = useCnNames
      ? cleanStrokeName(cnOrderNames[sIdx], flatPts)
      : inferStrokeName(flatPts);
    return [name, flatPts];
  });

  totalStrokesProcessed += compactStrokes.length;
  semesterStrokes[sem.id][id] = compactStrokes;

  const words = pickWordsForChar(ch);
  const mnemonic = buildMnemonic(ch, radical, structCode, strokeCount, words);

  // Compact tuple:
  // [0:id, 1:char, 2:pinyin, 3:pinyinPlain, 4:radical, 5:structCode, 6:semesterId, 7:unitIndex, 8:strokeCount, 9:words, 10:mnemonic]
  catalogEntries.push([
    id,
    ch,
    pinyin || ch,
    pinyinPlain,
    radical,
    structCode,
    sem.id,
    unitIndex,
    strokeCount,
    words,
    mnemonic,
  ]);
}

// Write catalog.json
const catalogPath = path.join(OUT_DIR, 'catalog.json');
fs.writeFileSync(catalogPath, JSON.stringify(catalogEntries));

// Write 12 semester stroke chunk files
let totalStrokeBytes = 0;
for (const sm of SEMESTER_META) {
  const p = path.join(STROKES_DIR, `${sm.id}.json`);
  const content = JSON.stringify(semesterStrokes[sm.id]);
  fs.writeFileSync(p, content);
  totalStrokeBytes += Buffer.byteLength(content);
}

console.log(`Generated catalog.json: ${catalogEntries.length} chars, ${(fs.statSync(catalogPath).size / 1024).toFixed(1)} KB`);
console.log(`Generated 12 semester stroke files: ${totalStrokesProcessed} total strokes, ${(totalStrokeBytes / 1024).toFixed(1)} KB total (avg ${(totalStrokeBytes / 12 / 1024).toFixed(1)} KB/file)`);
