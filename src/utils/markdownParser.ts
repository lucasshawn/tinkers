export interface SpanStyleProps {
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  wavy?: boolean;
  underline?: boolean;
}

export type MarkdownInline =
  | { type: 'text'; value: string }
  | { type: 'break' }
  | { type: 'strong'; children: MarkdownInline[] }
  | { type: 'em'; children: MarkdownInline[] }
  | { type: 'del'; children: MarkdownInline[] }
  | { type: 'link'; href: string; external: boolean; children: MarkdownInline[] }
  | { type: 'image'; alt: string; src: string; width?: number; height?: number }
  | { type: 'span'; style: SpanStyleProps; children: MarkdownInline[] };

export type MarkdownBlock =
  | { type: 'paragraph'; children: MarkdownInline[] }
  | { type: 'list'; items: MarkdownInline[][] };

export const MARKDOWN_THEME_COLORS: Record<string, string> = {
  pink: '#FF85A1',
  pinklight: '#FFB3C6',
  text: '#4A2E35',
  textmuted: '#7A5C61',
  blue: '#38BDF8',
  yellow: '#EAB308',
  mint: '#34D399',
  lilac: '#A78BFA',
  rose: '#F43F5E',
  white: '#FFFFFF',
};

export const MARKDOWN_FONT_PRESETS: Record<string, string> = {
  bubble: '"Fredoka", cursive, sans-serif',
  body: '"Quicksand", sans-serif',
  serif: 'Georgia, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

const SIZE_PRESETS: Record<string, string> = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
};

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGB_COLOR_RE = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;
const SAFE_FONT_RE = /^[a-zA-Z0-9\s,'"-]{1,60}$/;
const SAFE_SIZE_PX_RE = /^(\d{1,2}(?:\.\d+)?)px$/i;
const SAFE_SIZE_EM_RE = /^(\d(?:\.\d+)?)(em|rem)$/i;
const RASTER_DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;
const SVG_URL_RE = /\.svg(?:$|[?#])/i;

function sanitizeColor(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const preset = MARKDOWN_THEME_COLORS[trimmed.toLowerCase()];
  if (preset) return preset;
  if (HEX_COLOR_RE.test(trimmed)) return trimmed;
  const rgbMatch = trimmed.match(RGB_COLOR_RE);
  if (rgbMatch) {
    const [r, g, b] = [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
    if (r <= 255 && g <= 255 && b <= 255) {
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return undefined;
}

function sanitizeFont(raw: string): string | undefined {
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '').trim();
  if (!trimmed) return undefined;
  const preset = MARKDOWN_FONT_PRESETS[trimmed.toLowerCase()];
  if (preset) return preset;
  if (SAFE_FONT_RE.test(trimmed)) return trimmed;
  return undefined;
}

function sanitizeSize(raw: string): string | undefined {
  const trimmed = raw.trim().toLowerCase();
  if (SIZE_PRESETS[trimmed]) return SIZE_PRESETS[trimmed];
  const pxMatch = trimmed.match(SAFE_SIZE_PX_RE);
  if (pxMatch) {
    const val = Number(pxMatch[1]);
    if (val >= 8 && val <= 96) return `${val}px`;
  }
  const emMatch = trimmed.match(SAFE_SIZE_EM_RE);
  if (emMatch) {
    const val = Number(emMatch[1]);
    if (val >= 0.5 && val <= 4) return `${val}${emMatch[2]}`;
  }
  return undefined;
}

function sanitizeHref(raw: string): { href: string; external: boolean } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return { href: trimmed, external: false };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { href: trimmed, external: true };
    }
    if (parsed.protocol === 'mailto:') {
      return { href: trimmed, external: false };
    }
  } catch {
    return null;
  }
  return null;
}

function sanitizeImageSrc(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return SVG_URL_RE.test(trimmed) ? null : trimmed;
  }
  if (RASTER_DATA_URL_RE.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return SVG_URL_RE.test(parsed.pathname) ? null : trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

function clampDim(val: number): number {
  return Math.max(8, Math.min(256, Math.round(val)));
}

function parseImageSpec(rawInsideParens: string): { src: string; width?: number; height?: number } | null {
  const trimmed = rawInsideParens.trim();
  if (!trimmed) return null;

  let srcPart = trimmed;
  let width: number | undefined;
  let height: number | undefined;

  const sizeMatch = trimmed.match(/\s+=(\d+)(?:x(\d+))?$/i);
  if (sizeMatch) {
    srcPart = trimmed.slice(0, sizeMatch.index).trim();
    if (sizeMatch[2]) {
      width = clampDim(Number(sizeMatch[1]));
      height = clampDim(Number(sizeMatch[2]));
    } else {
      height = clampDim(Number(sizeMatch[1]));
    }
  }

  const safeSrc = sanitizeImageSrc(srcPart);
  if (!safeSrc) return null;
  return { src: safeSrc, ...(width ? { width } : {}), ...(height ? { height } : {}) };
}

function parseShorthandAttrs(attrStr: string): SpanStyleProps {
  const style: SpanStyleProps = {};
  const tokenRe = /([a-zA-Z]+)=("[^"]*"|'[^']*'|\S+)|\b([a-zA-Z]+)\b/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(attrStr)) !== null) {
    if (match[1] && match[2]) {
      const key = match[1].toLowerCase();
      const rawVal = match[2].replace(/^['"]|['"]$/g, '');
      if (key === 'color') {
        const c = sanitizeColor(rawVal);
        if (c) style.color = c;
      } else if (key === 'font') {
        const f = sanitizeFont(rawVal);
        if (f) style.fontFamily = f;
      } else if (key === 'size') {
        const s = sanitizeSize(rawVal);
        if (s) style.fontSize = s;
      }
    } else if (match[3]) {
      const flag = match[3].toLowerCase();
      if (flag === 'wavy') style.wavy = true;
      if (flag === 'underline') style.underline = true;
    }
  }

  return style;
}

function parseInlineCssStyle(cssText: string): SpanStyleProps {
  const style: SpanStyleProps = {};
  const decls = cssText.split(';');
  for (const decl of decls) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();
    if (!val) continue;

    if (prop === 'color') {
      const c = sanitizeColor(val);
      if (c) style.color = c;
    } else if (prop === 'font-family') {
      const f = sanitizeFont(val);
      if (f) style.fontFamily = f;
    } else if (prop === 'font-size') {
      const s = sanitizeSize(val);
      if (s) style.fontSize = s;
    } else if (prop === 'font-weight') {
      if (/^(normal|bold|[1-9]00)$/i.test(val)) style.fontWeight = val.toLowerCase();
    } else if (prop === 'font-style') {
      if (/^(normal|italic)$/i.test(val)) style.fontStyle = val.toLowerCase();
    } else if (prop === 'text-decoration') {
      if (/^(none|underline|line-through|underline wavy)$/i.test(val)) {
        style.textDecoration = val.toLowerCase();
      }
    }
  }
  return style;
}

function findMatchingBracket(input: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < input.length; i++) {
    if (input[i] === '\\' && i + 1 < input.length) {
      i++;
      continue;
    }
    if (input[i] === '[') depth++;
    else if (input[i] === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findMatchingSpanClose(input: string, startIdx: number): number {
  let depth = 1;
  const tagRe = /<span(?:\s[^>]*)?>|<\/span>/gi;
  tagRe.lastIndex = startIdx;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(input)) !== null) {
    if (m[0].toLowerCase().startsWith('</span')) {
      depth--;
      if (depth === 0) return m.index;
    } else {
      depth++;
    }
  }
  return -1;
}

function findSingleAsteriskClose(input: string, fromIdx: number): number {
  for (let idx = fromIdx; idx < input.length; idx++) {
    if (input[idx] === '\\' && idx + 1 < input.length) {
      idx++;
      continue;
    }
    if (input[idx] === '*') {
      if (input[idx + 1] === '*') {
        // Skip ** or *** delimiters belonging to nested bold/bold-italic
        while (idx + 1 < input.length && input[idx + 1] === '*') {
          idx++;
        }
        continue;
      }
      return idx;
    }
  }
  return -1;
}

function pushText(nodes: MarkdownInline[], text: string) {
  if (!text) return;
  const last = nodes[nodes.length - 1];
  if (last && last.type === 'text') {
    last.value += text;
  } else {
    nodes.push({ type: 'text', value: text });
  }
}

export function parseMarkdownInline(input: string, depth: number = 0): MarkdownInline[] {
  if (!input) return [];
  if (depth > 8) return [{ type: 'text', value: input }];

  const nodes: MarkdownInline[] = [];
  let i = 0;

  while (i < input.length) {
    // Escaped character
    if (input[i] === '\\' && i + 1 < input.length && /[*~[\]{}()<>\\!]/.test(input[i + 1])) {
      pushText(nodes, input[i + 1]);
      i += 2;
      continue;
    }

    // Line break
    if (input[i] === '\n') {
      nodes.push({ type: 'break' });
      i += 1;
      continue;
    }

    // Inline image: ![alt](src [=size])
    if (input[i] === '!' && input[i + 1] === '[') {
      const closeBracket = findMatchingBracket(input, i + 1);
      if (closeBracket !== -1 && input[closeBracket + 1] === '(') {
        const closeParen = input.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          const alt = input.slice(i + 2, closeBracket);
          const rawSpec = input.slice(closeBracket + 2, closeParen);
          const parsedImg = parseImageSpec(rawSpec);
          if (parsedImg) {
            nodes.push({
              type: 'image',
              alt,
              src: parsedImg.src,
              ...(parsedImg.width ? { width: parsedImg.width } : {}),
              ...(parsedImg.height ? { height: parsedImg.height } : {}),
            });
            i = closeParen + 1;
            continue;
          }
          pushText(nodes, input.slice(i, closeParen + 1));
          i = closeParen + 1;
          continue;
        }
      }
    }

    // Styled shorthand [content]{attrs} OR link [content](href)
    if (input[i] === '[') {
      const closeBracket = findMatchingBracket(input, i);
      if (closeBracket !== -1) {
        const inner = input.slice(i + 1, closeBracket);
        const nextChar = input[closeBracket + 1];

        if (nextChar === '{') {
          const closeBrace = input.indexOf('}', closeBracket + 2);
          if (closeBrace !== -1) {
            const attrStr = input.slice(closeBracket + 2, closeBrace);
            const style = parseShorthandAttrs(attrStr);
            nodes.push({
              type: 'span',
              style,
              children: parseMarkdownInline(inner, depth + 1),
            });
            i = closeBrace + 1;
            continue;
          }
        } else if (nextChar === '(') {
          const closeParen = input.indexOf(')', closeBracket + 2);
          if (closeParen !== -1) {
            const rawHref = input.slice(closeBracket + 2, closeParen);
            const safeLink = sanitizeHref(rawHref);
            if (safeLink) {
              nodes.push({
                type: 'link',
                href: safeLink.href,
                external: safeLink.external,
                children: parseMarkdownInline(inner, depth + 1),
              });
            } else {
              pushText(nodes, input.slice(i, closeParen + 1));
            }
            i = closeParen + 1;
            continue;
          }
        }
      }
    }

    // Safe HTML <span style="...">...</span>
    if (input[i] === '<' && input.slice(i).toLowerCase().startsWith('<span')) {
      const openTagMatch = input.slice(i).match(/^<span(?:\s+style=(?:"([^"]*)"|'([^']*)'))?\s*>/i);
      if (openTagMatch) {
        const afterOpen = i + openTagMatch[0].length;
        const closeIdx = findMatchingSpanClose(input, afterOpen);
        if (closeIdx !== -1) {
          const cssText = openTagMatch[1] ?? openTagMatch[2] ?? '';
          const inner = input.slice(afterOpen, closeIdx);
          nodes.push({
            type: 'span',
            style: parseInlineCssStyle(cssText),
            children: parseMarkdownInline(inner, depth + 1),
          });
          i = closeIdx + '</span>'.length;
          continue;
        }
      }
    }

    // ***bold italic***
    if (input.startsWith('***', i)) {
      const closeIdx = input.indexOf('***', i + 3);
      if (closeIdx !== -1 && closeIdx > i + 3) {
        nodes.push({
          type: 'strong',
          children: [
            {
              type: 'em',
              children: parseMarkdownInline(input.slice(i + 3, closeIdx), depth + 1),
            },
          ],
        });
        i = closeIdx + 3;
        continue;
      }
    }

    // **bold**
    if (input.startsWith('**', i)) {
      const closeIdx = input.indexOf('**', i + 2);
      if (closeIdx !== -1 && closeIdx > i + 2) {
        nodes.push({
          type: 'strong',
          children: parseMarkdownInline(input.slice(i + 2, closeIdx), depth + 1),
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // ~~strikethrough~~
    if (input.startsWith('~~', i)) {
      const closeIdx = input.indexOf('~~', i + 2);
      if (closeIdx !== -1 && closeIdx > i + 2) {
        nodes.push({
          type: 'del',
          children: parseMarkdownInline(input.slice(i + 2, closeIdx), depth + 1),
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // *italic*
    if (input[i] === '*' && input[i + 1] !== '*') {
      const closeIdx = findSingleAsteriskClose(input, i + 1);
      if (closeIdx !== -1 && closeIdx > i + 1) {
        nodes.push({
          type: 'em',
          children: parseMarkdownInline(input.slice(i + 1, closeIdx), depth + 1),
        });
        i = closeIdx + 1;
        continue;
      }
    }

    pushText(nodes, input[i]);
    i += 1;
  }

  return nodes;
}

export function parseMarkdownBlocks(input: string): MarkdownBlock[] {
  const normalized = input.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        children: parseMarkdownInline(paragraphLines.join('\n')),
      });
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({
        type: 'list',
        items: listItems.map((item) => parseMarkdownInline(item)),
      });
      listItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1]);
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}
