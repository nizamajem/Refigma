import rawTokens from './tokens.json';

const tokens = rawTokens;

const DEFAULT_THEME = 'light' as const;
const DEFAULT_COLOR = '#000000';

type ThemeName = keyof typeof tokens.colors;
type TypographyVariant = keyof typeof tokens.typography.scale;

const INTER_STYLES = [
  { threshold: 700, style: 'Bold' },
  { threshold: 600, style: 'Semi Bold' },
  { threshold: 500, style: 'Medium' },
  { threshold: 0, style: 'Regular' },
] as const;

function resolveInterFont(weight: number): FontName {
  let chosen = INTER_STYLES[INTER_STYLES.length - 1];
  for (const option of INTER_STYLES) {
    if (weight >= option.threshold) {
      chosen = option;
      break;
    }
  }
  return { family: tokens.typography.fontFamily, style: chosen.style };
}

function getColor(theme: ThemeName, token: string): string {
  const [groupName, shade = ''] = token.split('/');
  const resolvedTheme = tokens.colors[theme] ? theme : DEFAULT_THEME;
  const group = tokens.colors[resolvedTheme][groupName as keyof (typeof tokens.colors)[ThemeName]] as
    | Record<string, string>
    | string
    | undefined;

  if (!group) {
    return DEFAULT_COLOR;
  }

  if (typeof group === 'string') {
    return group;
  }

  if (!shade && '500' in group) {
    return group['500'];
  }

  if (shade in group) {
    return group[shade];
  }

  return DEFAULT_COLOR;
}

function spacing(step: number): number {
  const scale = tokens.spacing.base.scale;
  const index = Math.max(0, Math.min(scale.length - 1, step));
  return scale[index];
}

async function applyTextStyle(textNode: TextNode, variant: TypographyVariant): Promise<void> {
  const style = tokens.typography.scale[variant];
  if (!style) {
    throw new Error(`Unknown typography variant: ${variant}`);
  }

  const fontName = resolveInterFont(style.fontWeight);
  await figma.loadFontAsync(fontName);
  textNode.fontName = fontName;
  textNode.fontSize = style.fontSize;
  textNode.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/900')) }];
}

async function createTextNode(
  content: string,
  variant: TypographyVariant,
  fillToken?: string,
  maxWidth?: number,
): Promise<TextNode> {
  const node = figma.createText();
  await applyTextStyle(node, variant);
  node.characters = content;

  const style = tokens.typography.scale[variant];
  if (style) {
    const length = node.characters.length;
    if (length > 0) {
      if (typeof node.setRangeLineHeight === 'function') {
        node.setRangeLineHeight(0, length, { value: style.lineHeight, unit: 'PIXELS' });
      }
      if (typeof node.setRangeLetterSpacing === 'function') {
        node.setRangeLetterSpacing(0, length, { value: 0, unit: 'PERCENT' });
      }
    }
  }

  if (fillToken) {
    node.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, fillToken)) }];
  }

  node.textAutoResize = typeof maxWidth === 'number' ? 'HEIGHT' : 'WIDTH_AND_HEIGHT';
  if (typeof maxWidth === 'number') {
    node.resize(maxWidth, node.height);
  }

  return node;
}

function createAutoLayout(direction: 'HORIZONTAL' | 'VERTICAL'): FrameNode {
  const frame = figma.createFrame();
  frame.layoutMode = direction;
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.fills = [];
  frame.strokes = [];
  frame.strokeWeight = 0;
  frame.paddingLeft = 0;
  frame.paddingRight = 0;
  frame.paddingTop = 0;
  frame.paddingBottom = 0;
  frame.itemSpacing = 0;
  return frame;
}

const COLUMN_COUNT = 12;
const COLUMN_GUTTER = 24;
const COLUMN_MARGIN = 160;

const layoutGrid: LayoutGrid = {
  pattern: 'COLUMNS',
  alignment: 'STRETCH',
  gutterSize: COLUMN_GUTTER,
  count: COLUMN_COUNT,
  offset: COLUMN_MARGIN,
  visible: false,
};

function applyDesktopLayoutGrid(frame: FrameNode): void {
  frame.layoutGrids = [layoutGrid];
}

function hexToRgb(hex: string): RGB {
  const stripped = hex.replace('#', '');
  const value = parseInt(stripped, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return { r: r / 255, g: g / 255, b: b / 255 };
}

function hexToRgba(hex: string, alpha = 1): RGBA {
  const rgb = hexToRgb(hex);
  return { r: rgb.r, g: rgb.g, b: rgb.b, a: alpha };
}

function hexToRgbaColor(rgba: string): RGBA {
  const match = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d*\.?\d+)\s*\)/i);
  if (!match) {
    return { r: 0, g: 0, b: 0, a: 0.16 };
  }
  const [, r, g, b, a] = match;
  return {
    r: Number(r) / 255,
    g: Number(g) / 255,
    b: Number(b) / 255,
    a: Number(a),
  };
}

async function createButton(label: string, variant: 'primary' | 'ghost'): Promise<FrameNode> {
  const button = createAutoLayout('HORIZONTAL');
  button.counterAxisAlignItems = 'CENTER';
  button.itemSpacing = spacing(1);
  button.paddingLeft = spacing(3);
  button.paddingRight = spacing(3);
  button.paddingTop = spacing(1);
  button.paddingBottom = spacing(1);
  button.cornerRadius = tokens.radii.md;

  if (variant === 'primary') {
    button.fills = [
      {
        type: 'GRADIENT_LINEAR',
        gradientStops: [
          { position: 0, color: hexToRgba(getColor(DEFAULT_THEME, 'primary/500'), 1) },
          { position: 1, color: hexToRgba(getColor(DEFAULT_THEME, 'accent/500'), 1) },
        ],
        gradientTransform: [
          [0.92, 0.38, 0],
          [-0.38, 0.92, 0],
        ],
      },
    ];
    button.effects = [
      {
        type: 'DROP_SHADOW',
        color: hexToRgbaColor(tokens.shadows.soft.color),
        offset: { x: tokens.shadows.soft.x, y: tokens.shadows.soft.y },
        radius: tokens.shadows.soft.blur,
        spread: tokens.shadows.soft.spread,
        visible: true,
        blendMode: 'NORMAL',
      },
    ];
    button.appendChild(await createTextNode(label, 'captionBold', 'neutral/50'));
  } else {
    button.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/50')) }];
    button.strokes = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/300')) }];
    button.strokeWeight = 1;
    button.appendChild(await createTextNode(label, 'captionBold', 'neutral/700'));
  }

  return button;
}

async function createMetricCard(index: number, value: string, label: string, accent: string): Promise<FrameNode> {
  const card = createAutoLayout('VERTICAL');
  card.name = `HeroMetric:${index}`;
  card.counterAxisAlignItems = 'MIN';
  card.itemSpacing = spacing(0);
  card.paddingLeft = spacing(3);
  card.paddingRight = spacing(3);
  card.paddingTop = spacing(3);
  card.paddingBottom = spacing(3);
  card.cornerRadius = tokens.radii.md;
  const accentColor = hexToRgba(getColor(DEFAULT_THEME, accent), 0.16);
  card.fills = [
    {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: accentColor },
        { position: 1, color: hexToRgba(getColor(DEFAULT_THEME, 'neutral/50'), 1) },
      ],
      gradientTransform: [
        [0.88, 0.47, 0],
        [-0.47, 0.88, 0],
      ],
    },
  ];
  card.strokeWeight = 0;
  card.effects = [
    {
      type: 'DROP_SHADOW',
      color: hexToRgbaColor(tokens.shadows.soft.color),
      offset: { x: tokens.shadows.soft.x, y: tokens.shadows.soft.y },
      radius: tokens.shadows.soft.blur,
      spread: tokens.shadows.soft.spread,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];
  const valueNode = await createTextNode(value, 'h3', accent);
  valueNode.name = `HeroMetric:${index}:Value`;
  card.appendChild(valueNode);
  const labelNode = await createTextNode(label, 'caption', 'neutral/600', 200);
  labelNode.name = `HeroMetric:${index}:Label`;
  card.appendChild(labelNode);
  card.layoutGrow = 1;
  return card;
}

async function createHeroVisual(): Promise<FrameNode> {
  const visual = createAutoLayout('VERTICAL');
  visual.counterAxisAlignItems = 'MIN';
  visual.itemSpacing = spacing(3);
  visual.paddingLeft = spacing(4);
  visual.paddingRight = spacing(4);
  visual.paddingTop = spacing(4);
  visual.paddingBottom = spacing(4);
  visual.cornerRadius = tokens.radii.lg;
  visual.fills = [
    {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: hexToRgba(getColor(DEFAULT_THEME, 'primary/500'), 0.92) },
        { position: 1, color: hexToRgba(getColor(DEFAULT_THEME, 'accent/500'), 0.88) },
      ],
      gradientTransform: [
        [0.94, 0.34, 0],
        [-0.34, 0.94, 0],
      ],
    },
  ];
  visual.strokeWeight = 0;
  visual.effects = [
    {
      type: 'DROP_SHADOW',
      color: hexToRgbaColor(tokens.shadows.medium.color),
      offset: { x: tokens.shadows.medium.x, y: tokens.shadows.medium.y },
      radius: tokens.shadows.medium.blur,
      spread: tokens.shadows.medium.spread,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];
  visual.layoutGrow = 1;
  visual.layoutAlign = 'STRETCH';

  visual.appendChild(await createHeroVisualHeader());
  visual.appendChild(await createHeroVisualBody());
  visual.appendChild(await createHeroVisualStats());

  return visual;
}

async function createHeroVisualHeader(): Promise<FrameNode> {
  const badge = createAutoLayout('HORIZONTAL');
  badge.counterAxisAlignItems = 'CENTER';
  badge.itemSpacing = spacing(1);
  badge.paddingLeft = spacing(2);
  badge.paddingRight = spacing(2);
  badge.paddingTop = spacing(1);
  badge.paddingBottom = spacing(1);
  badge.cornerRadius = tokens.radii.pill;
  badge.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/50')) }];
  badge.opacity = 0.9;
  badge.appendChild(await createTextNode('Realtime preview aktif', 'captionBold', 'neutral/600'));
  badge.appendChild(await createTextNode('Sinkronisasi token live', 'caption', 'primary/500'));
  return badge;
}

async function createHeroVisualBody(): Promise<FrameNode> {
  const preview = createAutoLayout('VERTICAL');
  preview.counterAxisAlignItems = 'MIN';
  preview.itemSpacing = spacing(2);
  preview.paddingLeft = spacing(3);
  preview.paddingRight = spacing(3);
  preview.paddingTop = spacing(3);
  preview.paddingBottom = spacing(3);
  preview.cornerRadius = tokens.radii.lg;
  preview.fills = [
    {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: hexToRgba(getColor(DEFAULT_THEME, 'neutral/50'), 1) },
        { position: 1, color: hexToRgba(getColor(DEFAULT_THEME, 'primary/50'), 0.85) },
      ],
      gradientTransform: [
        [0.92, 0.38, 0],
        [-0.38, 0.92, 0],
      ],
    },
  ];
  preview.strokes = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/200')) }];
  preview.strokeWeight = 1;
  preview.effects = [
    {
      type: 'DROP_SHADOW',
      color: hexToRgbaColor(tokens.shadows.soft.color),
      offset: { x: tokens.shadows.soft.x, y: tokens.shadows.soft.y },
      radius: tokens.shadows.soft.blur,
      spread: tokens.shadows.soft.spread,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];
  preview.layoutGrow = 1;
  preview.layoutAlign = 'STRETCH';

  preview.appendChild(await createHeroVisualToolbar());
  preview.appendChild(await createHeroVisualContent());

  return preview;
}

async function createHeroVisualToolbar(): Promise<FrameNode> {
  const toolbar = createAutoLayout('HORIZONTAL');
  toolbar.counterAxisAlignItems = 'CENTER';
  toolbar.primaryAxisAlignItems = 'SPACE_BETWEEN';
  toolbar.itemSpacing = spacing(2);
  toolbar.paddingLeft = spacing(2);
  toolbar.paddingRight = spacing(2);
  toolbar.paddingTop = spacing(1);
  toolbar.paddingBottom = spacing(1);
  toolbar.layoutAlign = 'STRETCH';

  const left = createAutoLayout('HORIZONTAL');
  left.counterAxisAlignItems = 'CENTER';
  left.itemSpacing = spacing(1);
  const dots = createAutoLayout('HORIZONTAL');
  dots.counterAxisAlignItems = 'CENTER';
  dots.itemSpacing = spacing(0);
  for (const color of ['primary/400', 'accent/400', 'neutral/400']) {
    const dot = figma.createEllipse();
    dot.resize(8, 8);
    dot.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, color)) }];
    dots.appendChild(dot);
  }
  left.appendChild(dots);
  left.appendChild(await createTextNode('Board Refigma Nova', 'captionBold', 'neutral/600'));
  toolbar.appendChild(left);

  const status = createAutoLayout('HORIZONTAL');
  status.counterAxisAlignItems = 'CENTER';
  status.itemSpacing = spacing(1);
  status.paddingLeft = spacing(2);
  status.paddingRight = spacing(2);
  status.paddingTop = spacing(1);
  status.paddingBottom = spacing(1);
  status.cornerRadius = tokens.radii.pill;
  status.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/50')) }];
  status.strokes = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'primary/200')) }];
  status.strokeWeight = 1;
  status.appendChild(await createTextNode('Autosave on', 'captionBold', 'primary/600'));
  toolbar.appendChild(status);

  return toolbar;
}

async function createHeroVisualContent(): Promise<FrameNode> {
  const body = createAutoLayout('VERTICAL');
  body.counterAxisAlignItems = 'MIN';
  body.itemSpacing = spacing(2);
  body.layoutAlign = 'STRETCH';
  body.layoutGrow = 1;

  const layoutRow = createAutoLayout('HORIZONTAL');
  layoutRow.counterAxisAlignItems = 'CENTER';
  layoutRow.itemSpacing = spacing(2);
  layoutRow.layoutAlign = 'STRETCH';
  layoutRow.layoutGrow = 1;

  layoutRow.appendChild(await createHeroVisualMainCard());
  layoutRow.appendChild(await createHeroVisualSidebar());

  body.appendChild(layoutRow);
  body.appendChild(await createHeroVisualReviewRow());

  return body;
}

async function createHeroVisualMainCard(): Promise<FrameNode> {
  const card = createAutoLayout('VERTICAL');
  card.counterAxisAlignItems = 'MIN';
  card.itemSpacing = spacing(2);
  card.paddingLeft = spacing(3);
  card.paddingRight = spacing(3);
  card.paddingTop = spacing(3);
  card.paddingBottom = spacing(3);
  card.cornerRadius = tokens.radii.md;
  card.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/50')) }];
  card.strokes = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/200')) }];
  card.strokeWeight = 1;
  card.layoutGrow = 1;
  card.layoutAlign = 'STRETCH';

  card.appendChild(await createTextNode('Layout hero siap handoff', 'bodyBold', 'neutral/900', 240));
  card.appendChild(
    await createTextNode(
      'Variant desktop, tablet, dan mobile diselaraskan otomatis dengan token Refigma.',
      'caption',
      'neutral/600',
      240,
    ),
  );

  const progressWrapper = figma.createFrame();
  progressWrapper.resize(240, 8);
  progressWrapper.cornerRadius = 4;
  progressWrapper.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/200')) }];
  progressWrapper.strokeWeight = 0;
  progressWrapper.clipsContent = true;
  progressWrapper.layoutAlign = 'STRETCH';

  const progressFill = figma.createRectangle();
  progressFill.resize(172, 8);
  progressFill.cornerRadius = 4;
  progressFill.fills = [
    {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: hexToRgba(getColor(DEFAULT_THEME, 'primary/400'), 1) },
        { position: 1, color: hexToRgba(getColor(DEFAULT_THEME, 'accent/500'), 1) },
      ],
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
    },
  ];
  progressWrapper.appendChild(progressFill);
  card.appendChild(progressWrapper);

  const progressRow = createAutoLayout('HORIZONTAL');
  progressRow.counterAxisAlignItems = 'CENTER';
  progressRow.itemSpacing = spacing(1);
  progressRow.appendChild(await createTextNode('72% token sinkron', 'captionBold', 'primary/600'));
  progressRow.appendChild(await createTextNode('7 pemeriksaan QA selesai', 'caption', 'neutral/500'));
  card.appendChild(progressRow);

  const chips = createAutoLayout('HORIZONTAL');
  chips.counterAxisAlignItems = 'CENTER';
  chips.itemSpacing = spacing(1);
  chips.layoutAlign = 'STRETCH';
  for (const chip of ['Spec link otomatis', 'Akses developer', 'Checklist lulus']) {
    const pill = createAutoLayout('HORIZONTAL');
    pill.counterAxisAlignItems = 'CENTER';
    pill.itemSpacing = spacing(0);
    pill.paddingLeft = spacing(2);
    pill.paddingRight = spacing(2);
    pill.paddingTop = spacing(1);
    pill.paddingBottom = spacing(1);
    pill.cornerRadius = tokens.radii.pill;
    pill.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/100')) }];
    pill.appendChild(await createTextNode(chip, 'captionBold', 'neutral/600'));
    chips.appendChild(pill);
  }
  card.appendChild(chips);

  return card;
}

async function createHeroVisualSidebar(): Promise<FrameNode> {
  const sidebar = createAutoLayout('VERTICAL');
  sidebar.counterAxisAlignItems = 'MIN';
  sidebar.itemSpacing = spacing(2);
  sidebar.layoutGrow = 1;
  sidebar.layoutAlign = 'STRETCH';

  const syncCard = createAutoLayout('VERTICAL');
  syncCard.counterAxisAlignItems = 'MIN';
  syncCard.itemSpacing = spacing(1);
  syncCard.paddingLeft = spacing(2);
  syncCard.paddingRight = spacing(2);
  syncCard.paddingTop = spacing(2);
  syncCard.paddingBottom = spacing(2);
  syncCard.cornerRadius = tokens.radii.md;
  syncCard.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/50')) }];
  syncCard.strokes = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/200')) }];
  syncCard.strokeWeight = 1;
  syncCard.layoutAlign = 'STRETCH';
  syncCard.appendChild(await createTextNode('Log sinkron', 'captionBold', 'neutral/700'));

  const syncItems = [
    { time: '09:42', text: 'Token warna diperbarui' },
    { time: '09:10', text: 'Komponen hero disalin' },
  ];
  for (const item of syncItems) {
    const row = createAutoLayout('HORIZONTAL');
    row.counterAxisAlignItems = 'CENTER';
    row.itemSpacing = spacing(1);
    row.appendChild(await createTextNode(item.time, 'captionBold', 'primary/600'));
    row.appendChild(await createTextNode(item.text, 'caption', 'neutral/600', 160));
    syncCard.appendChild(row);
  }
  sidebar.appendChild(syncCard);

  const pulseCard = createAutoLayout('VERTICAL');
  pulseCard.counterAxisAlignItems = 'MIN';
  pulseCard.itemSpacing = spacing(1);
  pulseCard.paddingLeft = spacing(2);
  pulseCard.paddingRight = spacing(2);
  pulseCard.paddingTop = spacing(2);
  pulseCard.paddingBottom = spacing(2);
  pulseCard.cornerRadius = tokens.radii.md;
  pulseCard.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/50')) }];
  pulseCard.strokes = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/200')) }];
  pulseCard.strokeWeight = 1;
  pulseCard.layoutAlign = 'STRETCH';
  pulseCard.appendChild(await createTextNode('Pulse tim', 'captionBold', 'neutral/700'));

  const pulseInfo = createAutoLayout('VERTICAL');
  pulseInfo.counterAxisAlignItems = 'MIN';
  pulseInfo.itemSpacing = spacing(0);
  pulseInfo.appendChild(await createTextNode('18 anggota online', 'captionBold', 'primary/500'));
  pulseInfo.appendChild(
    await createTextNode('Komentar baru dalam 5 menit terakhir', 'caption', 'neutral/500', 160),
  );
  pulseCard.appendChild(pulseInfo);
  sidebar.appendChild(pulseCard);

  return sidebar;
}

async function createHeroVisualReviewRow(): Promise<FrameNode> {
  const reviewRow = createAutoLayout('HORIZONTAL');
  reviewRow.counterAxisAlignItems = 'CENTER';
  reviewRow.primaryAxisAlignItems = 'SPACE_BETWEEN';
  reviewRow.itemSpacing = spacing(2);
  reviewRow.layoutAlign = 'STRETCH';

  const avatars = createAutoLayout('HORIZONTAL');
  avatars.counterAxisAlignItems = 'CENTER';
  avatars.itemSpacing = spacing(1);
  for (const color of ['primary/500', 'accent/500', 'primary/300', 'accent/400']) {
    const avatar = figma.createEllipse();
    avatar.resize(24, 24);
    avatar.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, color)) }];
    avatars.appendChild(avatar);
  }
  reviewRow.appendChild(avatars);
  reviewRow.appendChild(await createTextNode('Review selesai untuk 4 tim desain', 'caption', 'neutral/600'));

  return reviewRow;
}

async function createHeroVisualStats(): Promise<FrameNode> {
  const statRow = createAutoLayout('HORIZONTAL');
  statRow.counterAxisAlignItems = 'CENTER';
  statRow.itemSpacing = spacing(2);
  statRow.layoutAlign = 'STRETCH';
  const stats = [
    { label: 'Sync aktif', value: 'Realtime', hint: 'Tidak ada debt' },
    { label: 'Layout diterbitkan', value: '18', hint: '+4 minggu ini' },
    { label: 'Checklist QA', value: '12/12', hint: 'Lengkap' },
  ];

  for (const stat of stats) {
    const card = createAutoLayout('VERTICAL');
    card.counterAxisAlignItems = 'MIN';
    card.itemSpacing = spacing(0);
    card.paddingLeft = spacing(2);
    card.paddingRight = spacing(2);
    card.paddingTop = spacing(2);
    card.paddingBottom = spacing(2);
    card.cornerRadius = tokens.radii.md;
    card.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/50')) }];
    card.strokes = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/200')) }];
    card.strokeWeight = 1;
    card.opacity = 0.95;
    card.appendChild(await createTextNode(stat.value, 'bodyBold', 'primary/500'));
    card.appendChild(await createTextNode(stat.label, 'captionBold', 'neutral/600'));
    card.appendChild(await createTextNode(stat.hint, 'caption', 'neutral/500'));
    statRow.appendChild(card);
  }

  return statRow;
}

async function createHeroSection(): Promise<FrameNode> {
  const hero = createAutoLayout('VERTICAL');
  hero.name = 'Section/Hero';
  hero.primaryAxisSizingMode = 'AUTO';
  hero.counterAxisSizingMode = 'AUTO';
  hero.counterAxisAlignItems = 'MIN';
  hero.itemSpacing = 56;
  hero.paddingLeft = 160;
  hero.paddingRight = 160;
  hero.paddingTop = 96;
  hero.paddingBottom = 96;
  hero.cornerRadius = tokens.radii.lg;
  hero.strokeWeight = 1;
  hero.strokes = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/200')) }];
  hero.fills = [
    {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: hexToRgba(getColor(DEFAULT_THEME, 'neutral/50'), 1) },
        { position: 1, color: hexToRgba(getColor(DEFAULT_THEME, 'primary/50'), 0.92) },
      ],
      gradientTransform: [
        [0.92, 0.4, 0],
        [-0.4, 0.92, 0],
      ],
    },
  ];
  hero.effects = [
    {
      type: 'DROP_SHADOW',
      color: hexToRgbaColor(tokens.shadows.soft.color),
      offset: { x: tokens.shadows.soft.x, y: tokens.shadows.soft.y },
      radius: tokens.shadows.soft.blur,
      spread: tokens.shadows.soft.spread,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];

  const sectionLabel = await createTextNode('Section/Hero', 'captionBold', 'accent/500');
  sectionLabel.name = 'Hero:SectionLabel';
  hero.appendChild(sectionLabel);

  const badge = createAutoLayout('HORIZONTAL');
  badge.counterAxisAlignItems = 'CENTER';
  badge.itemSpacing = spacing(1);
  badge.paddingLeft = spacing(2);
  badge.paddingRight = spacing(2);
  badge.paddingTop = spacing(1);
  badge.paddingBottom = spacing(1);
  badge.cornerRadius = tokens.radii.pill;
  badge.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'primary/50')) }];
  badge.strokes = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'primary/200')) }];
  const badgeTitle = await createTextNode('AI Copilot', 'captionBold', 'primary/600');
  badgeTitle.name = 'Hero:BadgeTitle';
  badge.appendChild(badgeTitle);
  const badgeSubtitle = await createTextNode('Automasi layout & dokumentasi', 'caption', 'primary/600');
  badgeSubtitle.name = 'Hero:BadgeSubtitle';
  badge.appendChild(badgeSubtitle);
  hero.appendChild(badge);

  const layout = createAutoLayout('HORIZONTAL');
  layout.counterAxisAlignItems = 'CENTER';
  layout.primaryAxisAlignItems = 'SPACE_BETWEEN';
  layout.itemSpacing = 64;
  layout.layoutAlign = 'STRETCH';
  layout.layoutGrow = 1;

  const copy = createAutoLayout('VERTICAL');
  copy.counterAxisAlignItems = 'MIN';
  copy.itemSpacing = spacing(3);
  copy.layoutGrow = 1;
  const heroHeading = await createTextNode('Bangun hero landing page siap handoff', 'h1', 'neutral/900', 560);
  heroHeading.name = 'Hero:Heading';
  copy.appendChild(heroHeading);
  const heroSubheading = await createTextNode(
    'Integrasikan auto layout, tokens, dan dokumentasi Refigma agar developer langsung mengirim fitur tanpa revisi ulang.',
    'body',
    'neutral/700',
    520,
  );
  heroSubheading.name = 'Hero:Subheading';
  copy.appendChild(heroSubheading);

  const highlightList = createAutoLayout('VERTICAL');
  highlightList.itemSpacing = spacing(1);
  const highlights = [
    'Token & styles tersinkron otomatis ke seluruh platform',
    'Template hero, fitur, hingga testimonial siap produksi',
    'Checklist QA dan dokumentasi developer selalu terbaru',
  ];
  for (let index = 0; index < highlights.length; index += 1) {
    const item = highlights[index];
    const row = createAutoLayout('HORIZONTAL');
    row.counterAxisAlignItems = 'CENTER';
    row.itemSpacing = spacing(1);
    row.name = `Hero:Highlight:${index}`;
    const marker = figma.createRectangle();
    marker.resize(10, 10);
    marker.cornerRadius = 3;
    marker.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'primary/500')) }];
    row.appendChild(marker);
    const text = await createTextNode(item, 'caption', 'neutral/600', 480);
    text.name = `Hero:Highlight:${index}:Text`;
    row.appendChild(text);
    highlightList.appendChild(row);
  }
  copy.appendChild(highlightList);

  const ctaRow = createAutoLayout('HORIZONTAL');
  ctaRow.counterAxisAlignItems = 'CENTER';
  ctaRow.itemSpacing = spacing(2);
  const primaryCta = await createButton('Mulai sekarang', 'primary');
  primaryCta.name = 'HeroCTA:Primary';
  const primaryLabel = primaryCta.findOne((node) => node.type === 'TEXT') as TextNode | null;
  if (primaryLabel) {
    primaryLabel.name = 'HeroCTA:Primary:Label';
  }
  ctaRow.appendChild(primaryCta);
  const secondaryCta = await createButton('Lihat panduan', 'ghost');
  secondaryCta.name = 'HeroCTA:Secondary';
  const secondaryLabel = secondaryCta.findOne((node) => node.type === 'TEXT') as TextNode | null;
  if (secondaryLabel) {
    secondaryLabel.name = 'HeroCTA:Secondary:Label';
  }
  ctaRow.appendChild(secondaryCta);
  copy.appendChild(ctaRow);

  const assurance = createAutoLayout('HORIZONTAL');
  assurance.counterAxisAlignItems = 'CENTER';
  assurance.itemSpacing = spacing(1);
  const dot = figma.createEllipse();
  dot.resize(10, 10);
  dot.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'accent/500')) }];
  dot.strokeWeight = 0;
  assurance.appendChild(dot);
  const assuranceCopy = await createTextNode('Dipercaya 120+ tim produk di Asia Tenggara', 'caption', 'neutral/600');
  assuranceCopy.name = 'Hero:Assurance';
  assurance.appendChild(assuranceCopy);
  copy.appendChild(assurance);

  layout.appendChild(copy);
  layout.appendChild(await createHeroVisual());
  hero.appendChild(layout);

  const metricsRow = createAutoLayout('HORIZONTAL');
  metricsRow.counterAxisAlignItems = 'CENTER';
  metricsRow.primaryAxisAlignItems = 'SPACE_BETWEEN';
  metricsRow.itemSpacing = 24;
  metricsRow.layoutAlign = 'STRETCH';
  metricsRow.layoutGrow = 1;

  const metrics = [
    { value: '72%', label: 'Token sinkron dalam sekali klik', accent: 'primary/500' },
    { value: '2x', label: 'Lebih cepat menyiapkan handoff', accent: 'accent/500' },
    { value: '5 menit', label: 'Update dokumen developer otomatis', accent: 'primary/600' },
  ];
  for (let i = 0; i < metrics.length; i += 1) {
    const metric = metrics[i];
    metricsRow.appendChild(await createMetricCard(i, metric.value, metric.label, metric.accent));
  }
  hero.appendChild(metricsRow);

  hero.layoutAlign = 'STRETCH';
  return hero;
}

async function createTestimonialSection(): Promise<FrameNode> {
  const section = createAutoLayout('VERTICAL');
  section.name = 'Section/Testimonials';
  section.itemSpacing = 48;
  section.paddingLeft = 160;
  section.paddingRight = 160;
  section.paddingTop = 88;
  section.paddingBottom = 88;
  section.cornerRadius = tokens.radii.lg;
  section.fills = [
    {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: hexToRgba(getColor(DEFAULT_THEME, 'primary/500'), 0.82) },
        { position: 1, color: hexToRgba(getColor(DEFAULT_THEME, 'accent/500'), 0.82) },
      ],
      gradientTransform: [
        [0.94, 0.33, 0],
        [-0.33, 0.94, 0],
      ],
    },
  ];
  section.strokeWeight = 0;
  section.effects = [
    {
      type: 'DROP_SHADOW',
      color: hexToRgbaColor(tokens.shadows.medium.color),
      offset: { x: tokens.shadows.medium.x, y: tokens.shadows.medium.y },
      radius: tokens.shadows.medium.blur,
      spread: tokens.shadows.medium.spread,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];

  const heading = createAutoLayout('VERTICAL');
  heading.counterAxisAlignItems = 'MIN';
  heading.itemSpacing = spacing(1);
  const headingBadge = createAutoLayout('HORIZONTAL');
  headingBadge.counterAxisAlignItems = 'CENTER';
  headingBadge.itemSpacing = spacing(1);
  headingBadge.paddingLeft = spacing(2);
  headingBadge.paddingRight = spacing(2);
  headingBadge.paddingTop = spacing(1);
  headingBadge.paddingBottom = spacing(1);
  headingBadge.cornerRadius = tokens.radii.pill;
  headingBadge.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/50')) }];
  headingBadge.opacity = 0.9;
  const headingBadgeText = await createTextNode('Suara tim produk', 'captionBold', 'neutral/600');
  headingBadgeText.name = 'Testimonial:BadgeTitle';
  headingBadge.appendChild(headingBadgeText);
  heading.appendChild(headingBadge);
  const testimonialHeading = await createTextNode('Bagaimana Refigma mempercepat kolaborasi', 'h2', 'neutral/50');
  testimonialHeading.name = 'Testimonial:Heading';
  heading.appendChild(testimonialHeading);
  const testimonialSubtitle = await createTextNode(
    'Ritme sprint lebih ringan karena handoff, dokumentasi, dan perubahan token berjalan serentak.',
    'body',
    'neutral/100',
    560,
  );
  testimonialSubtitle.name = 'Testimonial:Subtitle';
  heading.appendChild(testimonialSubtitle);
  section.appendChild(heading);

  const content = createAutoLayout('HORIZONTAL');
  content.counterAxisAlignItems = 'CENTER';
  content.itemSpacing = spacing(5);
  content.layoutAlign = 'STRETCH';
  content.layoutGrow = 1;

  content.appendChild(await createTestimonialCopyColumn());
  content.appendChild(await createTestimonialCards());

  section.appendChild(content);
  section.layoutAlign = 'STRETCH';
  return section;
}

async function createTestimonialCopyColumn(): Promise<FrameNode> {
  const column = createAutoLayout('VERTICAL');
  column.counterAxisAlignItems = 'MIN';
  column.itemSpacing = spacing(2);
  column.layoutGrow = 1;
  column.layoutAlign = 'STRETCH';

  const quote = await createTextNode(
    '"Sejak Refigma, diskusi desain ke dev tinggal satu sumber kebenaran."',
    'h3',
    'neutral/50',
    420,
  );
  quote.name = 'Testimonial:Quote';
  column.appendChild(quote);

  const bulletList = createAutoLayout('VERTICAL');
  bulletList.counterAxisAlignItems = 'MIN';
  bulletList.itemSpacing = spacing(1);
  bulletList.layoutAlign = 'STRETCH';
  const bullets = [
    'Token, referensi, dan dokumentasi siap konsumsi developer.',
    'Stakeholder review cepat karena preview selalu up to date.',
    'Sprint planning lebih singkat berkat checklist QA otomatis.',
  ];
  for (let index = 0; index < bullets.length; index += 1) {
    const item = bullets[index];
    const row = createAutoLayout('HORIZONTAL');
    row.counterAxisAlignItems = 'CENTER';
    row.itemSpacing = spacing(1);
    row.name = `Testimonial:Bullet:${index}`;
    const mark = figma.createRectangle();
    mark.resize(10, 10);
    mark.cornerRadius = 3;
    mark.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/50')) }];
    row.appendChild(mark);
    const bulletText = await createTextNode(item, 'caption', 'neutral/100', 420);
    bulletText.name = `Testimonial:Bullet:${index}:Text`;
    row.appendChild(bulletText);
    bulletList.appendChild(row);
  }
  column.appendChild(bulletList);

  const footer = createAutoLayout('VERTICAL');
  footer.counterAxisAlignItems = 'MIN';
  footer.itemSpacing = spacing(0);
  const attribution = await createTextNode('Tim produk OrbitPay', 'captionBold', 'neutral/100');
  attribution.name = 'Testimonial:Attribution';
  footer.appendChild(attribution);
  const attributionRole = await createTextNode('Skala 12 produk digital', 'caption', 'neutral/200');
  attributionRole.name = 'Testimonial:AttributionRole';
  footer.appendChild(attributionRole);
  column.appendChild(footer);

  const callout = createAutoLayout('HORIZONTAL');
  callout.counterAxisAlignItems = 'CENTER';
  callout.itemSpacing = spacing(1);
  callout.paddingLeft = spacing(2);
  callout.paddingRight = spacing(2);
  callout.paddingTop = spacing(1);
  callout.paddingBottom = spacing(1);
  callout.cornerRadius = tokens.radii.pill;
  callout.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/50')) }];
  callout.opacity = 0.9;
  const calloutText = await createTextNode('Skor kepuasan 4.9/5', 'captionBold', 'primary/600');
  calloutText.name = 'Testimonial:Callout';
  callout.appendChild(calloutText);
  column.appendChild(callout);

  return column;
}

async function createTestimonialCards(): Promise<FrameNode> {
  const grid = createAutoLayout('HORIZONTAL');
  grid.counterAxisAlignItems = 'CENTER';
  grid.itemSpacing = spacing(3);
  grid.layoutGrow = 1;
  grid.layoutAlign = 'STRETCH';

  const leftColumn = createAutoLayout('VERTICAL');
  leftColumn.counterAxisAlignItems = 'MIN';
  leftColumn.itemSpacing = spacing(3);
  leftColumn.layoutGrow = 1;
  leftColumn.layoutAlign = 'STRETCH';

  const rightColumn = createAutoLayout('VERTICAL');
  rightColumn.counterAxisAlignItems = 'MIN';
  rightColumn.itemSpacing = spacing(3);
  rightColumn.paddingTop = spacing(4);
  rightColumn.layoutGrow = 1;
  rightColumn.layoutAlign = 'STRETCH';

  const testimonials = [
    {
      quote: '"Refigma menjadikan token dan komponen kami satu sumber kebenaran. Dev tinggal tarik."',
      name: 'Salsa Pradipta',
      role: 'VP Design DaringLabs',
      accent: 'primary/500',
      metric: '55% lebih cepat',
    },
    {
      quote: '"Dokumentasi developer langsung tersusun. QA tidak lagi copy manual."',
      name: 'Kevin Mahardika',
      role: 'Head of Product Lokalite',
      accent: 'accent/500',
      metric: '0 bug layout',
    },
    {
      quote: '"Stakeholder bisa review versi terbaru tanpa minta file tambahan."',
      name: 'Chandra Tanu',
      role: 'Founder GridStack',
      accent: 'primary/400',
      metric: '3x siklus review',
    },
  ];

  leftColumn.appendChild(await buildTestimonialCard(testimonials[0]));
  leftColumn.appendChild(await buildTestimonialCard(testimonials[1]));
  rightColumn.appendChild(await buildTestimonialCard(testimonials[2]));

  grid.appendChild(leftColumn);
  grid.appendChild(rightColumn);

  return grid;
}

async function buildTestimonialCard(data: {
  quote: string;
  name: string;
  role: string;
  accent: string;
  metric?: string;
}): Promise<FrameNode> {
  const card = createAutoLayout('VERTICAL');
  card.counterAxisAlignItems = 'MIN';
  card.itemSpacing = spacing(2);
  card.paddingLeft = spacing(4);
  card.paddingRight = spacing(4);
  card.paddingTop = spacing(4);
  card.paddingBottom = spacing(4);
  card.cornerRadius = tokens.radii.lg;
  card.fills = [
    {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: hexToRgba(getColor(DEFAULT_THEME, 'neutral/50'), 0.98) },
        { position: 1, color: hexToRgba(getColor(DEFAULT_THEME, 'neutral/100'), 0.9) },
      ],
      gradientTransform: [
        [0.9, 0.44, 0],
        [-0.44, 0.9, 0],
      ],
    },
  ];
  card.strokes = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/200')) }];
  card.strokeWeight = 1;
  card.effects = [
    {
      type: 'DROP_SHADOW',
      color: hexToRgbaColor(tokens.shadows.soft.color),
      offset: { x: tokens.shadows.soft.x, y: tokens.shadows.soft.y },
      radius: tokens.shadows.soft.blur,
      spread: tokens.shadows.soft.spread,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];
  card.layoutGrow = 1;
  card.layoutAlign = 'STRETCH';
  card.appendChild(await createTextNode(data.quote, 'body', 'neutral/900', 320));

  const divider = figma.createRectangle();
  divider.resize(48, 2);
  divider.cornerRadius = 1;
  divider.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'primary/200')) }];
  divider.opacity = 0.5;
  card.appendChild(divider);

  const footer = createAutoLayout('HORIZONTAL');
  footer.counterAxisAlignItems = 'CENTER';
  footer.itemSpacing = spacing(2);
  const avatar = figma.createEllipse();
  avatar.resize(32, 32);
  avatar.fills = [
    {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: hexToRgba(getColor(DEFAULT_THEME, data.accent), 1) },
        { position: 1, color: hexToRgba(getColor(DEFAULT_THEME, 'accent/400'), 1) },
      ],
      gradientTransform: [
        [0.82, 0.57, 0],
        [-0.57, 0.82, 0],
      ],
    },
  ];
  footer.appendChild(avatar);

  const info = createAutoLayout('VERTICAL');
  info.counterAxisAlignItems = 'MIN';
  info.itemSpacing = spacing(0);
  info.appendChild(await createTextNode(data.name, 'bodyBold', 'neutral/800'));
  info.appendChild(await createTextNode(data.role, 'caption', 'neutral/500'));
  footer.appendChild(info);
  card.appendChild(footer);

  if (data.metric) {
    const metricBadge = createAutoLayout('HORIZONTAL');
    metricBadge.counterAxisAlignItems = 'CENTER';
    metricBadge.itemSpacing = spacing(1);
    metricBadge.paddingLeft = spacing(2);
    metricBadge.paddingRight = spacing(2);
    metricBadge.paddingTop = spacing(1);
    metricBadge.paddingBottom = spacing(1);
    metricBadge.cornerRadius = tokens.radii.pill;
    metricBadge.fills = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, data.accent)) }];
    metricBadge.opacity = 0.85;
    metricBadge.appendChild(await createTextNode(data.metric, 'captionBold', 'neutral/50'));
    card.appendChild(metricBadge);
  }

  return card;
}

async function createCTASection(): Promise<FrameNode> {
  const section = createAutoLayout('VERTICAL');
  section.name = 'Section/CTA';
  section.itemSpacing = spacing(2);
  section.paddingLeft = 160;
  section.paddingRight = 160;
  section.paddingTop = 72;
  section.paddingBottom = 72;
  section.cornerRadius = tokens.radii.lg;
  section.fills = [
    {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: hexToRgba(getColor(DEFAULT_THEME, 'primary/500'), 1) },
        { position: 1, color: hexToRgba(getColor(DEFAULT_THEME, 'accent/500'), 1) },
      ],
      gradientTransform: [
        [0.92, 0.38, 0],
        [-0.38, 0.92, 0],
      ],
    },
  ];
  section.effects = [
    {
      type: 'DROP_SHADOW',
      color: hexToRgbaColor(tokens.shadows.medium.color),
      offset: { x: tokens.shadows.medium.x, y: tokens.shadows.medium.y },
      radius: tokens.shadows.medium.blur,
      spread: tokens.shadows.medium.spread,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];

  const ctaHeading = await createTextNode('Siap menjaga konsistensi desain?', 'h2', 'neutral/50', 640);
  ctaHeading.name = 'CTA:Heading';
  section.appendChild(ctaHeading);
  const ctaBody = await createTextNode(
    'Aktifkan Refigma dan biarkan AI mendokumentasikan setiap keputusan desain.',
    'body',
    'neutral/100',
    560,
  );
  ctaBody.name = 'CTA:Body';
  section.appendChild(ctaBody);

  const actions = createAutoLayout('HORIZONTAL');
  actions.counterAxisAlignItems = 'CENTER';
  actions.itemSpacing = spacing(2);
  actions.layoutAlign = 'MIN';
  const ctaPrimary = await createButton('Mulai gratis', 'primary');
  ctaPrimary.name = 'CTA:PrimaryButton';
  const ctaPrimaryLabel = ctaPrimary.findOne((node) => node.type === 'TEXT') as TextNode | null;
  if (ctaPrimaryLabel) {
    ctaPrimaryLabel.name = 'CTA:PrimaryLabel';
  }
  actions.appendChild(ctaPrimary);
  const ctaSecondary = await createButton('Lihat changelog', 'ghost');
  ctaSecondary.name = 'CTA:SecondaryButton';
  const ctaSecondaryLabel = ctaSecondary.findOne((node) => node.type === 'TEXT') as TextNode | null;
  if (ctaSecondaryLabel) {
    ctaSecondaryLabel.name = 'CTA:SecondaryLabel';
  }
  actions.appendChild(ctaSecondary);
  section.appendChild(actions);

  return section;
}

export async function applyTokensDemo(): Promise<FrameNode> {
  const landing = createAutoLayout('VERTICAL');
  landing.name = 'Template/Landing-Refigma';
  landing.itemSpacing = 112;
  landing.paddingLeft = 160;
  landing.paddingRight = 160;
  landing.paddingTop = 120;
  landing.paddingBottom = 120;
  landing.counterAxisAlignItems = 'MIN';
  landing.primaryAxisSizingMode = 'AUTO';
  landing.counterAxisSizingMode = 'AUTO';
  landing.cornerRadius = tokens.radii.lg;
  landing.fills = [
    {
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: hexToRgba(getColor(DEFAULT_THEME, 'neutral/50'), 1) },
        { position: 1, color: hexToRgba(getColor(DEFAULT_THEME, 'neutral/100'), 1) },
      ],
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
    },
  ];
  landing.strokeWeight = 1;
  landing.strokes = [{ type: 'SOLID', color: hexToRgb(getColor(DEFAULT_THEME, 'neutral/200')) }];
  landing.effects = [
    {
      type: 'DROP_SHADOW',
      color: hexToRgbaColor(tokens.shadows.soft.color),
      offset: { x: tokens.shadows.soft.x, y: tokens.shadows.soft.y },
      radius: tokens.shadows.soft.blur,
      spread: tokens.shadows.soft.spread,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];

  applyDesktopLayoutGrid(landing);

  landing.appendChild(await createHeroSection());
  landing.appendChild(await createTestimonialSection());
  landing.appendChild(await createCTASection());

  landing.resizeWithoutConstraints(1440, landing.height);
  landing.x = 480;
  landing.y = 160;

  figma.currentPage.appendChild(landing);
  figma.currentPage.selection = [landing];
  figma.viewport.scrollAndZoomIntoView([landing]);
  return landing;
}

declare const figma: PluginAPI;
