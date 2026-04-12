import { useState } from 'react';
import type { TreeNode } from '../types/github';

interface EditModalProps {
  item: TreeNode;
  onSave: (updated: TreeNode) => void;
  onClose: () => void;
}

export function EditModal({ item, onSave, onClose }: EditModalProps) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body || '');
  const [labels, setLabels] = useState(
    (item.labelNames || []).join(', '),
  );
  const [state, setState] = useState(item.state || 'open');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{item.number ? `Edit #${item.number}` : 'Edit issue'}</h3>
        <div className="field">
          <label>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ fontFamily: 'var(--font)' }}
          />
        </div>
        <div className="field">
          <label>Labels (comma-separated)</label>
          <input
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
          />
        </div>
        {item.number && (
          <div className="field">
            <label>State</label>
            <select
              value={state}
              onChange={(e) =>
                setState(e.target.value as 'open' | 'closed')
              }
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--fg)',
                fontSize: 14,
              }}
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        )}
        <div className="field">
          <label>Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{
              width: '100%',
              minHeight: 200,
              padding: 12,
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--fg)',
              fontFamily: 'var(--mono)',
              fontSize: 13,
              lineHeight: 1.6,
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>
        <div
          style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}
        >
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              onSave({
                ...item,
                title,
                body,
                state,
                labelNames: labels
                  .split(',')
                  .map((l) => l.trim())
                  .filter(Boolean),
                _modified: true,
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
