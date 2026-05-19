export interface Repo {
  full_name: string;
  description: string | null;
  private: boolean;
}

export interface Viewer {
  login: string;
  avatar_url: string;
  name: string | null;
}

export interface SearchIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  repository_url: string;
  updated_at: string;
  created_at: string;
  user: { login: string; avatar_url: string } | null;
  labels: Label[];
  pull_request?: { url: string; html_url: string } | null;
  draft?: boolean;
}

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
