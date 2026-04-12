export interface MarkdownItem {
  type: 'epic' | 'feature' | 'story';
  title: string;
  labels: string[];
  milestone: string;
  body: string;
  children?: MarkdownItem[];
}

export function parseMarkdown(text: string): MarkdownItem[] {
  const lines = text.split('\n');
  const items: MarkdownItem[] = [];
  let current: MarkdownItem | null = null;
  let bodyLines: string[] = [];
  let inBody = false;

  function flush() {
    if (current) {
      current.body = bodyLines.join('\n').trim();
      items.push(current);
    }
    current = null;
    bodyLines = [];
    inBody = false;
  }

  for (const line of lines) {
    const eM = line.match(/^#\s+Epic:\s*(.+)/);
    const fM = line.match(/^##\s+Feature:\s*(.+)/);
    const sM = line.match(/^###\s+Story:\s*(.+)/);
    const lM = line.match(/^labels:\s*(.+)/);
    const mM = line.match(/^milestone:\s*(.+)/);
    const sep = line.trim() === '---';

    if (eM || fM || sM) {
      flush();
      current = {
        type: eM ? 'epic' : fM ? 'feature' : 'story',
        title: (eM || fM || sM)![1].trim(),
        labels: [],
        milestone: '',
        body: '',
      };
      inBody = false;
    } else if (current && !inBody && lM) {
      current.labels = lM[1]
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);
    } else if (current && !inBody && mM) {
      current.milestone = mM[1].trim();
    } else if (current && sep && !inBody) {
      inBody = true;
    } else if (current && inBody) {
      bodyLines.push(line);
    }
  }
  flush();

  const tree: MarkdownItem[] = [];
  let cEpic: MarkdownItem | null = null;
  let cFeature: MarkdownItem | null = null;
  for (const item of items) {
    if (item.type === 'epic') {
      cEpic = { ...item, children: [] };
      cFeature = null;
      tree.push(cEpic);
    } else if (item.type === 'feature') {
      cFeature = { ...item, children: [] };
      if (cEpic) cEpic.children!.push(cFeature);
      else tree.push(cFeature);
    } else {
      if (cFeature) cFeature.children!.push(item);
      else if (cEpic) cEpic.children!.push(item);
      else tree.push(item);
    }
  }
  return tree;
}
