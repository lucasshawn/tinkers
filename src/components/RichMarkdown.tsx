import React from 'react';
import {
  MarkdownInline,
  parseMarkdownBlocks,
  parseMarkdownInline,
} from '../utils/markdownParser';
import {
  getContentImageFallbackUrl,
  resolveContentImageUrl,
} from '../utils/contentImageCache';

export interface RichMarkdownProps {
  content: string;
  mode?: 'inline' | 'block';
  className?: string;
}

const InlineMarkdownImage: React.FC<{
  alt: string;
  src: string;
  width?: number;
  height?: number;
}> = ({ alt, src, width, height }) => {
  const resolvedSrc = resolveContentImageUrl(src);
  const fallbackUrl = getContentImageFallbackUrl(src);

  const imgStyle: React.CSSProperties =
    width && height
      ? { width: `${width}px`, height: `${height}px` }
      : height
        ? { height: `${height}px`, width: 'auto' }
        : { height: '1.2em', width: 'auto' };

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      style={imgStyle}
      className="inline-block align-middle object-contain mx-0.5"
      onError={(e) => {
        const target = e.currentTarget;
        if (fallbackUrl && target.dataset.fallbackApplied !== 'true') {
          target.dataset.fallbackApplied = 'true';
          target.src = fallbackUrl;
        }
      }}
    />
  );
};

function renderInlineNodes(nodes: MarkdownInline[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((node, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (node.type) {
      case 'text':
        return <React.Fragment key={key}>{node.value}</React.Fragment>;
      case 'break':
        return <br key={key} />;
      case 'strong':
        return <strong key={key}>{renderInlineNodes(node.children, key)}</strong>;
      case 'em':
        return <em key={key}>{renderInlineNodes(node.children, key)}</em>;
      case 'del':
        return <del key={key}>{renderInlineNodes(node.children, key)}</del>;
      case 'link':
        return (
          <a
            key={key}
            href={node.href}
            className="underline hover:opacity-80 transition-opacity"
            {...(node.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {renderInlineNodes(node.children, key)}
          </a>
        );
      case 'image':
        return (
          <InlineMarkdownImage
            key={`${key}-${node.src}`}
            alt={node.alt}
            src={node.src}
            width={node.width}
            height={node.height}
          />
        );
      case 'span': {
        const inlineStyle: React.CSSProperties = {};
        if (node.style.color) inlineStyle.color = node.style.color;
        if (node.style.fontFamily) inlineStyle.fontFamily = node.style.fontFamily;
        if (node.style.fontSize) inlineStyle.fontSize = node.style.fontSize;
        if (node.style.fontWeight) inlineStyle.fontWeight = node.style.fontWeight;
        if (node.style.fontStyle) inlineStyle.fontStyle = node.style.fontStyle;
        if (node.style.textDecoration) inlineStyle.textDecoration = node.style.textDecoration;

        const classes: string[] = [];
        if (node.style.wavy) {
          classes.push('underline', 'decoration-pink-300', 'decoration-wavy', 'text-shadow-cute');
        } else if (node.style.underline) {
          classes.push('underline');
        }

        return (
          <span
            key={key}
            style={Object.keys(inlineStyle).length > 0 ? inlineStyle : undefined}
            className={classes.length > 0 ? classes.join(' ') : undefined}
          >
            {renderInlineNodes(node.children, key)}
          </span>
        );
      }
    }
  });
}

export const RichMarkdown: React.FC<RichMarkdownProps> = ({
  content,
  mode = 'inline',
  className,
}) => {
  if (!content) return null;

  if (mode === 'inline') {
    const nodes = parseMarkdownInline(content.replace(/\r\n/g, '\n'));
    return className ? (
      <span className={className}>{renderInlineNodes(nodes, 'in')}</span>
    ) : (
      <>{renderInlineNodes(nodes, 'in')}</>
    );
  }

  const blocks = parseMarkdownBlocks(content);
  if (blocks.length === 0) return null;

  return (
    <div className={className}>
      {blocks.map((block, bIdx) => {
        if (block.type === 'list') {
          return (
            <ul key={`blk-${bIdx}`} className="space-y-1.5 list-none">
              {block.items.map((itemNodes, iIdx) => (
                <li key={`blk-${bIdx}-li-${iIdx}`}>
                  • {renderInlineNodes(itemNodes, `blk-${bIdx}-li-${iIdx}`)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={`blk-${bIdx}`}>{renderInlineNodes(block.children, `blk-${bIdx}-p`)}</p>
        );
      })}
    </div>
  );
};
