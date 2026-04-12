export interface Label {
  name: string;
  color: string;
}

export interface Milestone {
  number: number;
  title: string;
  state: 'open' | 'closed';
}

export interface Issue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Label[];
  milestone: Milestone | null;
  html_url: string;
  pull_request?: unknown; // presence => filter as PR
}

export type NodeType = 'epic' | 'feature' | 'story' | 'other';

export interface TreeNode extends Issue {
  type: NodeType;
  labelNames: string[];
  parentNumber: number | null;
  children: TreeNode[];
  _synced?: boolean;
  _modified?: boolean;
  _new?: boolean;
}
