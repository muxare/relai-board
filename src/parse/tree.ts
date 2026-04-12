import type { Issue, TreeNode, NodeType } from '../types/github';

export function parseIssuesToTree(issues: Issue[]): TreeNode[] {
  const parentMap: Record<number, TreeNode[]> = {};
  const issueMap: Record<number, TreeNode> = {};

  for (const issue of issues) {
    if (issue.pull_request) continue;
    const labels = issue.labels.map((l) => l.name);
    const type: NodeType = labels.includes('epic')
      ? 'epic'
      : labels.includes('feature')
        ? 'feature'
        : labels.includes('story')
          ? 'story'
          : 'other';
    const parentMatch = (issue.body || '').match(/Parent:\s*#(\d+)/i);
    const parentNumber = parentMatch ? parseInt(parentMatch[1]) : null;
    const node: TreeNode = {
      ...issue,
      type,
      labelNames: labels,
      parentNumber,
      children: [],
      _synced: true,
    };
    issueMap[issue.number] = node;
    if (parentNumber) {
      if (!parentMap[parentNumber]) parentMap[parentNumber] = [];
      parentMap[parentNumber].push(node);
    }
  }

  for (const [parentNum, children] of Object.entries(parentMap)) {
    if (issueMap[Number(parentNum)])
      issueMap[Number(parentNum)].children = children;
  }

  const roots = Object.values(issueMap).filter(
    (n) => !n.parentNumber || !issueMap[n.parentNumber],
  );
  roots.sort((a, b) => a.number - b.number);
  return roots;
}
