import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { parseMarkdownInline, parseMarkdownBlocks } from '../src/utils/markdownParser';
import { RichMarkdown } from '../src/components/RichMarkdown';
import {
  cacheContentImagePreview,
  CONTENT_IMAGES_STORAGE_KEY,
} from '../src/utils/contentImageCache';

describe('markdownParser & RichMarkdown', () => {
  beforeEach(() => {
    localStorage.removeItem(CONTENT_IMAGES_STORAGE_KEY);
  });

  it('renders bold, italic, bold-italic, and strikethrough inline Markdown', () => {
    const { container } = render(
      React.createElement(RichMarkdown, {
        content: 'Hello **bold**, *italic*, ***both***, and ~~old~~!',
        mode: 'inline',
      })
    );
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
    expect(container.querySelector('strong em')?.textContent).toBe('both');
    expect(container.querySelector('del')?.textContent).toBe('old');
  });

  it('renders styled shorthand spans with theme colors, hex colors, fonts, sizes, and wavy underline', () => {
    const { container } = render(
      React.createElement(RichMarkdown, {
        content:
          'Tiny Friends for [Fridge & Keys]{color=pink wavy} and [**Custom**]{color=#123456 font=bubble size=1.5em}',
        mode: 'inline',
      })
    );

    const wavy = screen.getByText('Fridge & Keys');
    expect(wavy.tagName).toBe('SPAN');
    expect(wavy).toHaveStyle({ color: '#FF85A1' });
    expect(wavy.className).toContain('decoration-wavy');
    expect(wavy.className).toContain('text-shadow-cute');

    const customStrong = screen.getByText('Custom');
    expect(customStrong.tagName).toBe('STRONG');
    const customSpan = customStrong.parentElement!;
    expect(customSpan).toHaveStyle({
      color: '#123456',
      fontSize: '1.5em',
    });
    expect(customSpan.style.fontFamily).toContain('Fredoka');
    expect(container.textContent).toBe('Tiny Friends for Fridge & Keys and Custom');
  });

  it('renders allowlisted <span style="..."> HTML safely and escapes disallowed tags/styles', () => {
    const { container } = render(
      React.createElement(RichMarkdown, {
        content:
          '<span style="color: #FF85A1; font-family: Georgia, serif; position: fixed">Cute</span> <script>alert(1)</script>',
        mode: 'inline',
      })
    );

    const cute = screen.getByText('Cute');
    expect(cute.tagName).toBe('SPAN');
    expect(cute).toHaveStyle({ color: '#FF85A1', fontFamily: 'Georgia, serif' });
    expect(cute.style.position).toBe('');
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  it('renders inline PNGs with default 1.2em height and optional =H / =WxH dimensions', () => {
    render(
      React.createElement(RichMarkdown, {
        content:
          'Look ![star](/images/content/star.png) and ![big](/images/content/big.png =28) and ![rect](https://example.com/a.png =32x24)',
        mode: 'inline',
      })
    );

    const star = screen.getByAltText('star') as HTMLImageElement;
    expect(star).toHaveAttribute('src', '/images/content/star.png');
    expect(star.style.height).toBe('1.2em');

    const big = screen.getByAltText('big') as HTMLImageElement;
    expect(big.style.height).toBe('28px');

    const rect = screen.getByAltText('rect') as HTMLImageElement;
    expect(rect.style.width).toBe('32px');
    expect(rect.style.height).toBe('24px');
  });

  it('uses local preview cache for /images/content/ PNGs and falls back to Netlify function on load error', () => {
    cacheContentImagePreview('/images/content/cached.png', 'data:image/png;base64,AAAA');
    render(
      React.createElement(RichMarkdown, {
        content: '![cached](/images/content/cached.png) ![remote](/images/content/remote.png)',
        mode: 'inline',
      })
    );

    expect(screen.getByAltText('cached')).toHaveAttribute('src', 'data:image/png;base64,AAAA');

    const remote = screen.getByAltText('remote') as HTMLImageElement;
    expect(remote).toHaveAttribute('src', '/images/content/remote.png');
    fireEvent.error(remote);
    expect(remote).toHaveAttribute(
      'src',
      '/.netlify/functions/admin-save?action=content-image&name=remote.png'
    );
  });

  it('blocks unsafe link protocols and SVG/javascript image sources', () => {
    const { container } = render(
      React.createElement(RichMarkdown, {
        content:
          '[bad](javascript:alert(1)) [ok](https://example.com) ![svg](data:image/svg+xml;base64,PHN2Zz4=)',
        mode: 'inline',
      })
    );

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://example.com');
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.textContent).toContain('[bad](javascript:alert(1))');
  });

  it('renders bullet lists and paragraphs in block mode', () => {
    const { container } = render(
      React.createElement(RichMarkdown, {
        content: '- First **tip**\n- Second *tip*\n- Third tip',
        mode: 'block',
      })
    );

    const items = container.querySelectorAll('ul > li');
    expect(items).toHaveLength(3);
    expect(items[0].querySelector('strong')?.textContent).toBe('tip');
    expect(items[1].querySelector('em')?.textContent).toBe('tip');
  });

  it('degrades malformed and unclosed syntax cleanly without throwing', () => {
    const nodes = parseMarkdownInline(
      'Unclosed **bold and [bracket{color=pink and <span style="color:red">no close'
    );
    expect(nodes.length).toBeGreaterThan(0);

    const blocks = parseMarkdownBlocks('');
    expect(blocks).toEqual([]);
  });

  it('handles nested spans, nested bold inside italic, escaped chars, clamped PNG sizes, and SVG URL blocking', () => {
    const { container } = render(
      React.createElement(RichMarkdown, {
        content:
          '*nested **bold** inside* and [outer [inner]{color=blue}]{color=pink} and \\*literal\\* ![tiny](/images/content/t.png =4) ![huge](/images/content/h.png =500) ![svg1](/images/content/a.svg) ![svg2](https://example.com/a.svg?x=1)',
        mode: 'inline',
      })
    );

    const em = container.querySelector('em');
    expect(em?.textContent).toBe('nested bold inside');
    expect(em?.querySelector('strong')?.textContent).toBe('bold');

    const innerSpan = screen.getByText('inner');
    expect(innerSpan).toHaveStyle({ color: '#38BDF8' });
    expect(innerSpan.parentElement).toHaveStyle({ color: '#FF85A1' });

    expect(container.textContent).toContain('*literal*');

    const tiny = screen.getByAltText('tiny') as HTMLImageElement;
    expect(tiny.style.height).toBe('8px');
    const huge = screen.getByAltText('huge') as HTMLImageElement;
    expect(huge.style.height).toBe('256px');

    expect(screen.queryByAltText('svg1')).toBeNull();
    expect(screen.queryByAltText('svg2')).toBeNull();
  });

  it('preserves quoted multi-font CSS stacks and rejects unbalanced quotes in font-family', () => {
    render(
      React.createElement(RichMarkdown, {
        content:
          `<span style='font-family: "Fredoka", cursive, sans-serif'>Multi</span> ` +
          `[Times]{font='"Times New Roman", serif'} ` +
          `<span style='font-family: Fredoka", cursive'>Broken</span>`,
        mode: 'inline',
      })
    );

    const multi = screen.getByText('Multi');
    expect(multi.style.fontFamily).toBe('"Fredoka", cursive, sans-serif');

    const times = screen.getByText('Times');
    expect(times.style.fontFamily).toBe('"Times New Roman", serif');

    const broken = screen.getByText('Broken');
    expect(broken.style.fontFamily).toBe('');
  });

  it('blocks SVG/SVGZ in query strings and non-raster root-relative image paths while allowing raster & content-image endpoints', () => {
    render(
      React.createElement(RichMarkdown, {
        content:
          '![svgq](/.netlify/functions/admin-save?action=content-image&name=evil.svg&v=1) ' +
          '![svgproxy](https://example.com/proxy?file=evil.svg) ' +
          '![svgz](https://example.com/a.svgz) ' +
          '![txt](/images/content/readme.txt) ' +
          '![noext](/images/content/noext) ' +
          '![fnok](/.netlify/functions/admin-save?action=content-image&name=ok.png) ' +
          '![okq](/images/content/star.webp?v=2#top)',
        mode: 'inline',
      })
    );

    expect(screen.queryByAltText('svgq')).toBeNull();
    expect(screen.queryByAltText('svgproxy')).toBeNull();
    expect(screen.queryByAltText('svgz')).toBeNull();
    expect(screen.queryByAltText('txt')).toBeNull();
    expect(screen.queryByAltText('noext')).toBeNull();

    expect(screen.getByAltText('fnok')).toHaveAttribute(
      'src',
      '/.netlify/functions/admin-save?action=content-image&name=ok.png'
    );
    expect(screen.getByAltText('okq')).toHaveAttribute('src', '/images/content/star.webp?v=2#top');
  });
});
