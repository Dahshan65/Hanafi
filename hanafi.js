'use strict';
/*
 * محرك حساب الميراث - المذهب الحنفي (الإصدار 1)
 * يشمل: أصحاب الفروض، العصبات، الحجب، العول، الرد، العمريتان.
 * لا يشمل بعد: ذوو الأرحام، المفقود، الحمل، الخنثى، الولاء، المناسخات.
 */

// ---------- كسور ----------
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a, b) => (a / gcd(a, b)) * b;

class Fr {
  constructor(n, d = 1) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    this.n = n / g;
    this.d = d / g;
  }
  add(o) { return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Fr(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Fr(this.n * o.n, this.d * o.d); }
  div(o) { return new Fr(this.n * o.d, this.d * o.n); }
  isZero() { return this.n === 0; }
  gt(o) { return this.n * o.d > o.n * this.d; }
  toNumber() { return this.n / this.d; }
  toString() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`; }
}
const F = (n, d = 1) => new Fr(n, d);
const ZERO = F(0);
const ONE = F(1);

// ---------- الورثة ----------
const HEIRS = {
  husband: 'زوج',
  wife: 'زوجة',
  son: 'ابن',
  daughter: 'بنت',
  sonOfSon: 'ابن ابن',
  daughterOfSon: 'بنت ابن',
  father: 'أب',
  grandfather: 'جد (أبو الأب)',
  mother: 'أم',
  grandmotherMat: 'جدة لأم',
  grandmotherPat: 'جدة لأب',
  fullBrother: 'أخ شقيق',
  fullSister: 'أخت شقيقة',
  paternalBrother: 'أخ لأب',
  paternalSister: 'أخت لأب',
  maternalBrother: 'أخ لأم',
  maternalSister: 'أخت لأم',
  nephewFull: 'ابن أخ شقيق',
  nephewPat: 'ابن أخ لأب',
  uncleFull: 'عم شقيق',
  unclePat: 'عم لأب',
  cousinFull: 'ابن عم شقيق',
  cousinPat: 'ابن عم لأب',
};

const FRAC_AR = {
  '1/2': 'النصف', '1/4': 'الربع', '1/8': 'الثمن',
  '1/3': 'الثلث', '2/3': 'الثلثان', '1/6': 'السدس',
};
const frAr = (f) => FRAC_AR[f.toString()] || f.toString();

function validate(c) {
  for (const k of Object.keys(c)) {
    if (!(k in HEIRS)) throw new Error(`وارث غير معروف: ${k}`);
    if (!Number.isInteger(c[k]) || c[k] < 0) throw new Error(`عدد غير صحيح للوارث ${HEIRS[k]}`);
  }
  if (c.husband > 0 && c.wife > 0) throw new Error('لا يجتمع زوج وزوجة في مسألة واحدة');
  if (c.husband > 1) throw new Error('الزوج واحد فقط');
  if (c.wife > 4) throw new Error('الزوجات لا يزدن عن أربع');
  if (c.father > 1 || c.mother > 1 || c.grandfather > 1) throw new Error('الأب والأم والجد واحد فقط');
}

/**
 * @param {Object} input  أعداد الورثة، مثال: { husband:1, mother:1, father:1 }
 * @param {number} estate قيمة التركة الصافية (بعد التجهيز والديون والوصية)
 * @param {Object} opts   { spouseRadd: false }  الرد على الزوجين عند انفرادهما
 */
function calculate(input, estate = 0, opts = {}) {
  const c = {};
  for (const k of Object.keys(HEIRS)) c[k] = input[k] || 0;
  validate(c);
  const has = (k) => c[k] > 0;
  if (!Object.values(c).some((v) => v > 0)) throw new Error('لم تُحدَّد أي وارث');

  const notes = [];
  const blocked = {};
  const blockIf = (keys, cond, why) => {
    if (cond) keys.forEach((k) => { if (has(k) && !blocked[k]) blocked[k] = why; });
  };

  // ---------- الحجب ----------
  blockIf(['sonOfSon', 'daughterOfSon'], has('son'), 'محجوب بالابن');
  blockIf(['grandfather'], has('father'), 'محجوب بالأب');
  blockIf(['grandmotherMat', 'grandmotherPat'], has('mother'), 'محجوبة بالأم');
  blockIf(['grandmotherPat'], has('father'), 'محجوبة بالأب');

  const maleDesc = has('son') || has('sonOfSon');
  const anyFemaleDesc = has('daughter') || has('daughterOfSon');
  const desc = maleDesc || anyFemaleDesc;
  const ascM = has('father') || has('grandfather');
  const strongBlocker = has('son') ? 'الابن'
    : has('sonOfSon') ? 'ابن الابن'
    : has('father') ? 'الأب' : 'الجد';

  blockIf(['maternalBrother', 'maternalSister'], desc || ascM,
    desc ? 'محجوب بالفرع الوارث' : `محجوب بـ${strongBlocker}`);
  const sibBlockers = maleDesc || ascM;
  blockIf(['fullBrother', 'fullSister', 'paternalBrother', 'paternalSister',
    'nephewFull', 'nephewPat', 'uncleFull', 'unclePat', 'cousinFull', 'cousinPat'],
  sibBlockers, `محجوب بـ${strongBlocker}`);
  if (has('grandfather') && !has('father') &&
      (has('fullBrother') || has('fullSister') || has('paternalBrother') || has('paternalSister'))) {
    notes.push('على قول أبي حنيفة: الجد يحجب الإخوة والأخوات (لجميع الجهات) كما يحجبهم الأب.');
  }

  const fsActive = has('fullSister') && !blocked.fullSister;
  const fullSisterMG = fsActive && !has('fullBrother') && anyFemaleDesc && !maleDesc && !ascM;
  blockIf(['paternalBrother', 'paternalSister'], has('fullBrother') && !blocked.fullBrother, 'محجوب بالأخ الشقيق');
  blockIf(['paternalBrother', 'paternalSister'], fullSisterMG, 'محجوب بالأخت الشقيقة المعصَّبة مع البنات');

  // ---------- الفروض ----------
  const fard = {};     // نصيب كل نوع من الفروض (من التركة)
  const why = {};      // سبب
  const kind = {};     // فرض / تعصيب / فرض وتعصيب
  const fardList = []; // كسور مجموعات الفروض (لحساب أصل المسألة)

  const addFard = (keys, total, reason) => {
    const live = keys.filter((k) => has(k) && !blocked[k]);
    const n = live.reduce((a, k) => a + c[k], 0);
    if (n === 0) return;
    fardList.push(total);
    live.forEach((k) => {
      fard[k] = (fard[k] || ZERO).add(total.mul(F(c[k], n)));
      kind[k] = 'فرض';
      why[k] = reason;
    });
  };

  // الزوجان
  let spouseFard = ZERO;
  if (has('husband')) {
    spouseFard = desc ? F(1, 4) : F(1, 2);
    addFard(['husband'], spouseFard, desc ? 'الربع لوجود الفرع الوارث' : 'النصف لعدم الفرع الوارث');
  }
  if (has('wife')) {
    spouseFard = desc ? F(1, 8) : F(1, 4);
    addFard(['wife'], spouseFard, desc ? 'الثمن لوجود الفرع الوارث' : 'الربع لعدم الفرع الوارث');
  }

  // الأم
  if (has('mother')) {
    const sibCount = c.fullBrother + c.fullSister + c.paternalBrother + c.paternalSister +
      c.maternalBrother + c.maternalSister;
    if (desc) addFard(['mother'], F(1, 6), 'السدس لوجود الفرع الوارث');
    else if (sibCount >= 2) addFard(['mother'], F(1, 6), 'السدس لوجود اثنين فأكثر من الإخوة والأخوات');
    else if (has('father') && (has('husband') || has('wife'))) {
      addFard(['mother'], ONE.sub(spouseFard).div(F(3)), 'ثلث الباقي بعد فرض الزوج/الزوجة (العمريتان)');
      notes.push('مسألة من المسائل العمريتين: للأم ثلث الباقي بعد فرض الزوج أو الزوجة.');
    } else addFard(['mother'], F(1, 3), 'الثلث لعدم الفرع الوارث وعدم تعدد الإخوة');
  }

  // الأب أو الجد
  const asc = has('father') ? 'father' : (has('grandfather') && !blocked.grandfather ? 'grandfather' : null);
  if (asc) {
    if (maleDesc) addFard([asc], F(1, 6), 'السدس لوجود الابن/ابن الابن');
    else if (anyFemaleDesc) addFard([asc], F(1, 6), 'السدس مع التعصيب بالباقي لوجود البنات');
    if (kind[asc] === 'فرض' && !maleDesc) kind[asc] = 'فرض وتعصيب';
  }

  // الجدات
  addFard(['grandmotherMat', 'grandmotherPat'], F(1, 6), 'السدس للجدات');

  // البنات
  if (has('daughter') && !has('son')) {
    if (c.daughter === 1) addFard(['daughter'], F(1, 2), 'النصف لانفرادها');
    else addFard(['daughter'], F(2, 3), 'الثلثان لتعدد البنات');
  }

  // بنات الابن
  if (has('daughterOfSon') && !blocked.daughterOfSon && !has('sonOfSon')) {
    if (c.daughter === 0) {
      if (c.daughterOfSon === 1) addFard(['daughterOfSon'], F(1, 2), 'النصف لانفرادها');
      else addFard(['daughterOfSon'], F(2, 3), 'الثلثان لتعددهن');
    } else if (c.daughter === 1) {
      addFard(['daughterOfSon'], F(1, 6), 'السدس تكملة الثلثين مع البنت');
    } else {
      blocked.daughterOfSon = 'محجوبة لاستيفاء البنات الثلثين';
    }
  }

  // أولاد الأم
  const matCount = c.maternalBrother + c.maternalSister;
  if (matCount > 0 && !blocked.maternalBrother && !blocked.maternalSister) {
    addFard(['maternalBrother', 'maternalSister'], matCount === 1 ? F(1, 6) : F(1, 3),
      matCount === 1 ? 'السدس لانفرادهم' : 'الثلث لتعددهم، يستوي فيه الذكر والأنثى');
  }

  // الأخوات الشقيقات
  if (fsActive && !has('fullBrother') && !fullSisterMG) {
    if (c.fullSister === 1) addFard(['fullSister'], F(1, 2), 'النصف لانفرادها');
    else addFard(['fullSister'], F(2, 3), 'الثلثان لتعددهن');
  }

  // الأخوات لأب
  const psActive = has('paternalSister') && !blocked.paternalSister;
  const pbActive = has('paternalBrother') && !blocked.paternalBrother;
  const paternalSisterMG = psActive && !pbActive && !fsActive && anyFemaleDesc && !maleDesc && !ascM;
  if (psActive && !pbActive && !paternalSisterMG) {
    if (fsActive) {
      if (c.fullSister === 1) addFard(['paternalSister'], F(1, 6), 'السدس تكملة الثلثين مع الأخت الشقيقة');
      else blocked.paternalSister = 'محجوبة لاستيفاء الشقيقات الثلثين';
    } else if (c.paternalSister === 1) addFard(['paternalSister'], F(1, 2), 'النصف لانفرادها');
    else addFard(['paternalSister'], F(2, 3), 'الثلثان لتعددهن');
  }

  // ---------- العول والباقي ----------
  let sum = ZERO;
  fardList.forEach((f) => { sum = sum.add(f); });
  const asl = fardList.reduce((a, f) => lcm(a, f.d), 1);
  const sumNum = Math.round(sum.toNumber() * asl);
  let awlBase = null;
  const total = {}; // النصيب النهائي من التركة

  Object.keys(fard).forEach((k) => { total[k] = fard[k]; });

  let residue = ONE.sub(sum);
  if (sum.gt(ONE)) {
    awlBase = sumNum;
    Object.keys(total).forEach((k) => { total[k] = total[k].div(sum); });
    residue = ZERO;
    notes.push(`عالت المسألة: أصلها ${asl} وعالت إلى ${awlBase}، فينقص نصيب كل صاحب فرض بنسبة العول.`);
  }

  // ---------- العصبات ----------
  const live = (k) => has(k) && !blocked[k];
  const chain = [
    () => (live('son') ? [['son', 2 * c.son], ['daughter', c.daughter]] : null),
    () => (!has('son') && live('sonOfSon') ? [['sonOfSon', 2 * c.sonOfSon], ['daughterOfSon', c.daughterOfSon]] : null),
    () => (has('father') ? [['father', 1]] : null),
    () => (!has('father') && live('grandfather') ? [['grandfather', 1]] : null),
    () => (live('fullBrother') ? [['fullBrother', 2 * c.fullBrother], ['fullSister', c.fullSister]]
      : fullSisterMG ? [['fullSister', 1]] : null),
    () => (pbActive ? [['paternalBrother', 2 * c.paternalBrother], ['paternalSister', c.paternalSister]]
      : paternalSisterMG ? [['paternalSister', 1]] : null),
    () => (live('nephewFull') ? [['nephewFull', 1]] : null),
    () => (live('nephewPat') ? [['nephewPat', 1]] : null),
    () => (live('uncleFull') ? [['uncleFull', 1]] : null),
    () => (live('unclePat') ? [['unclePat', 1]] : null),
    () => (live('cousinFull') ? [['cousinFull', 1]] : null),
    () => (live('cousinPat') ? [['cousinPat', 1]] : null),
  ];

  let asabaApplied = false;
  let asabaKeys = [];
  if (residue.gt(ZERO)) {
    for (const g of chain) {
      const members = g();
      if (!members) continue;
      const units = members.reduce((a, m) => a + m[1], 0);
      members.forEach(([k, u]) => {
        if (u === 0) return;
        const part = residue.mul(F(u, units));
        total[k] = (total[k] || ZERO).add(part);
        if (!kind[k]) kind[k] = 'تعصيب';
        why[k] = (why[k] ? why[k] + ' + ' : '') +
          (members.length > 1 && members.some(([kk]) => kk !== k && c[kk] > 0)
            ? 'التعصيب بالغير (للذكر مثل حظ الأنثيين)'
            : (fullSisterMG && k === 'fullSister') || (paternalSisterMG && k === 'paternalSister')
              ? 'التعصيب مع الغير (مع البنات)' : 'التعصيب بالنفس (الباقي)');
        asabaKeys.push(k);
      });
      asabaApplied = true;
      residue = ZERO;
      break;
    }
  }

  // ---------- الرد ----------
  let radd = false;
  let unassigned = ZERO;
  if (residue.gt(ZERO)) {
    const cand = Object.keys(fard).filter((k) => k !== 'husband' && k !== 'wife');
    if (cand.length) {
      let others = ZERO;
      cand.forEach((k) => { others = others.add(fard[k]); });
      const spouseTotal = (fard.husband || ZERO).add(fard.wife || ZERO);
      const room = ONE.sub(spouseTotal);
      cand.forEach((k) => {
        total[k] = fard[k].mul(room).div(others);
        kind[k] = 'فرض ورد';
        why[k] = (why[k] || '') + ' + الرد بنسبة الفروض';
      });
      radd = true;
      residue = ZERO;
      notes.push('بقي من التركة شيء ولا عاصب، فرُدّ على أصحاب الفروض غير الزوجين بنسبة فروضهم.');
    } else if (opts.spouseRadd && (has('husband') || has('wife'))) {
      const sp = has('husband') ? 'husband' : 'wife';
      total[sp] = total[sp].add(residue);
      kind[sp] = 'فرض ورد';
      why[sp] += ' + الرد لعدم وارث غيره';
      residue = ZERO;
      radd = true;
      notes.push('رُدّ الباقي على الزوج/الزوجة لعدم وجود وارث غيره (بحسب الخيار المفعَّل).');
    } else {
      unassigned = residue;
      notes.push('بقي جزء من التركة لم يُوزَّع: مرجعه ذوو الأرحام ثم بيت المال (غير مشمول في هذا الإصدار).');
    }
  }

  // ---------- النتائج ----------
  const rows = Object.keys(HEIRS).filter(has).map((k) => {
    const t = total[k] || ZERO;
    let status; let reason;
    if (blocked[k]) { status = 'محجوب'; reason = blocked[k]; }
    else if (t.isZero()) {
      status = 'لا شيء';
      reason = asabaApplied || fardList.length ? 'لم يبقَ له شيء، أو حجبه عاصب أقرب' : '';
    } else { status = kind[k] || 'تعصيب'; reason = why[k] || ''; }
    const per = c[k] ? t.div(F(c[k])) : ZERO;
    return {
      key: k, name: HEIRS[k], count: c[k], status, reason,
      share: t.toString(), shareValue: t.toNumber(),
      perHead: per.toString(),
      amount: estate * t.toNumber(),
      amountPerHead: estate * per.toNumber(),
      fardText: fard[k] ? frAr(fard[k]) : '',
    };
  });

  return {
    asl, awlBase, radd, rows, notes,
    unassigned: unassigned.toString(),
    unassignedAmount: estate * unassigned.toNumber(),
    estate,
  };
}

const api = { calculate, HEIRS, Fr, F };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else if (typeof window !== 'undefined') window.Hanafi = api;
