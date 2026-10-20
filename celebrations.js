/* 日日办 · 办完庆祝
   每条写成 { id, group, text }。group 用 A–F，决定图标、颜色和提示语。
   想加就直接加，id 不重复即可，不用动 app.js。
*/
window.RRB_CELEBRATION_GROUPS = {
  A: {
    label: '短句',
    icon: '#i-sparkles',
    cue: '说出口，或只在心里说。',
    from: '#d8b273',
    to: '#b8863b',
    tint: 'rgba(210, 160, 74, .22)',
  },
  B: {
    label: '小动作',
    icon: '#i-check',
    cue: '一个动作就够，别设计流程。',
    from: '#8fae97',
    to: '#3f6b53',
    tint: 'rgba(79, 135, 103, .18)',
  },
  C: {
    label: '身体',
    icon: '#i-sun',
    cue: '让身体先松一寸。',
    from: '#dd9f83',
    to: '#b4654c',
    tint: 'rgba(195, 94, 70, .16)',
  },
  D: {
    label: '声音',
    icon: '#i-music',
    cue: '小声也可以。',
    from: '#a3b9c5',
    to: '#5d7d8f',
    tint: 'rgba(93, 125, 143, .16)',
  },
  E: {
    label: '看一眼',
    icon: '#i-leaf',
    cue: '就看一眼，别顺手再干别的。',
    from: '#b0c798',
    to: '#6f8f5f',
    tint: 'rgba(111, 143, 95, .16)',
  },
  F: {
    label: '记一笔',
    icon: '#i-edit',
    cue: '记下就放下，不用反复回味。',
    from: '#9c8a6c',
    to: '#5f5344',
    tint: 'rgba(142, 127, 104, .22)',
  },
};

window.RRB_CELEBRATIONS = [
  { id: 1, group: 'A', text: '把抹布甩到肩上，说一句：上。' },
  { id: 2, group: 'A', text: '对着水池说：下一个。' },
  { id: 3, group: 'A', text: '小声说：办完了，收工。' },
  { id: 4, group: 'A', text: '说一句：就这？也不过如此。' },
  { id: 5, group: 'A', text: '对自己说：我又少了一件。' },
  { id: 6, group: 'A', text: '念一句：日拱一卒。' },
  { id: 7, group: 'A', text: '说：这件，翻篇。' },
  { id: 8, group: 'A', text: '说：行了，别夸自己了，继续。' },
  { id: 9, group: 'A', text: '说一句：五分钟，干了件正事。' },

  { id: 10, group: 'B', text: '把手在裤子上擦干，拍一下。' },
  { id: 11, group: 'B', text: '把刚用过的东西放回原位。' },
  { id: 12, group: 'B', text: '叠一下手边的布，叠整齐。' },
  { id: 13, group: 'B', text: '把桌面上的三样东西摆正。' },
  { id: 14, group: 'B', text: '拉一下衣角，站直。' },
  { id: 15, group: 'B', text: '把脚边的垃圾顺手捡了。' },
  { id: 16, group: 'B', text: '把手洗一洗，冲干净。' },
  { id: 17, group: 'B', text: '给下一件小事腾个位置。' },

  { id: 18, group: 'C', text: '伸个懒腰，肩膀转两圈。' },
  { id: 19, group: 'C', text: '站起来走五步。' },
  { id: 20, group: 'C', text: '深呼吸三次，慢慢吐气。' },
  { id: 21, group: 'C', text: '踮脚十下。' },
  { id: 22, group: 'C', text: '转一转头，看看窗外。' },
  { id: 23, group: 'C', text: '双手搓热，捂一下眼睛。' },
  { id: 24, group: 'C', text: '原地跳两下。' },

  { id: 25, group: 'D', text: '哼一小段歌。' },
  { id: 26, group: 'D', text: '用鼻子哼一声「嗯」。' },
  { id: 27, group: 'D', text: '学一声猫叫，小声的。' },
  { id: 28, group: 'D', text: '给这件事配一句解说词。' },
  { id: 29, group: 'D', text: '吹一声口哨。' },

  { id: 30, group: 'E', text: '看一眼刚收拾好的地方，多看三秒。' },
  { id: 31, group: 'E', text: '回头看看，今天又轻了一截。' },
  { id: 32, group: 'E', text: '退后两步，看看整体的样子。' },
  { id: 33, group: 'E', text: '拍一张照片，存着。' },
  { id: 34, group: 'E', text: '看看自己的手，刚才就是它办的。' },

  { id: 35, group: 'F', text: '在日历上打一个勾。' },
  { id: 36, group: 'F', text: '在心里数：今天第几件。' },
  { id: 37, group: 'F', text: '把这件小事念一遍，再忘掉它。' },
  { id: 38, group: 'F', text: '给它起个外号。' },
  { id: 39, group: 'F', text: '把「待办」里的它，从脑子里删掉。' },
  { id: 40, group: 'F', text: '说一句：今天没白过。' },
];
