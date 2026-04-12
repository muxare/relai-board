import type { TreeNode as TreeNodeType } from '../types/github';
import { Pill } from './Pill';

interface TreeNodeProps {
  item: TreeNodeType;
  depth: number;
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
  onEdit: (item: TreeNodeType) => void;
  onOpen: (item: TreeNodeType) => void;
}

const typeColors: Record<string, string> = {
  epic: 'var(--purple)',
  feature: 'var(--green)',
  story: 'var(--accent)',
};

export function TreeNode({
  item,
  depth,
  expanded,
  onToggle,
  onEdit,
  onOpen,
}: TreeNodeProps) {
  const key = `${item.number || item.title}-${depth}`;
  const isOpen = expanded[key] !== false;
  const hasKids = item.children && item.children.length > 0;
  const displayLabels = (item.labelNames || []).filter(
    (l) => l !== item.type,
  );

  return (
    <>
      <div className="tree-node">
        <div
          className="tree-row"
          style={{ paddingLeft: depth * 24 + 12 }}
          onClick={() => hasKids && onToggle(key)}
        >
          <span className="tree-toggle">
            {hasKids ? (isOpen ? '▾' : '▸') : '·'}
          </span>
          <div className="tree-content">
            <div className="tree-title">
              <span
                style={{
                  fontWeight:
                    item.type === 'epic'
                      ? 700
                      : item.type === 'feature'
                        ? 600
                        : 400,
                  color: typeColors[item.type] || 'var(--fg)',
                }}
              >
                {item.number ? `#${item.number} ` : ''}
                {item.title}
              </span>
              {displayLabels.map((l) => (
                <Pill key={l} label={l} />
              ))}
              {item.state && (
                <span
                  className={`status-badge ${item.state === 'open' ? 'status-open' : 'status-closed'}`}
                >
                  {item.state}
                </span>
              )}
              {item._new && (
                <span className="status-badge status-new">new</span>
              )}
              {item._modified && (
                <span className="status-badge status-modified">modified</span>
              )}
            </div>
            {item.milestone && (
              <div className="tree-meta">
                {typeof item.milestone === 'object'
                  ? item.milestone.title
                  : item.milestone}
              </div>
            )}
            {item.body && (
              <div className="tree-body">
                {item.body.length > 150
                  ? item.body.slice(0, 150) + '\u2026'
                  : item.body}
              </div>
            )}
          </div>
          <div className="tree-actions">
            {item.number && (
              <button
                className="btn btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(item);
                }}
              >
                ↗
              </button>
            )}
            {onEdit && (
              <button
                className="btn btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
              >
                Edit
              </button>
            )}
          </div>
          <span className="tree-type">{item.type}</span>
        </div>
      </div>
      {hasKids &&
        isOpen &&
        item.children.map((child, i) => (
          <TreeNode
            key={child.number || i}
            item={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onEdit={onEdit}
            onOpen={onOpen}
          />
        ))}
    </>
  );
}
