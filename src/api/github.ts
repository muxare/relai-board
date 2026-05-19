import type {
  Issue,
  Label,
  Milestone,
  Repo,
  SearchIssue,
  Viewer,
  WorkflowSummary,
} from '../types/github';

const API_ROOT = 'https://api.github.com';

export class GitHubAPI {
  constructor(
    private token: string,
    private repo: string = '',
  ) {}

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    };
  }

  private get base(): string {
    return `${API_ROOT}/repos/${this.repo}`;
  }

  async getUserRepos(): Promise<Repo[]> {
    const res = await fetch(
      `${API_ROOT}/user/repos?per_page=100&sort=updated`,
      { headers: this.headers },
    );
    if (!res.ok)
      throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    return (await res.json()) as Repo[];
  }

  async searchRepos(query: string): Promise<Repo[]> {
    const q = encodeURIComponent(`${query} user:@me`);
    const res = await fetch(
      `${API_ROOT}/search/repositories?q=${q}&per_page=30`,
      { headers: this.headers },
    );
    if (!res.ok)
      throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { items: Repo[] };
    return data.items;
  }

  private async fetchAll<T>(endpoint: string): Promise<T[]> {
    let items: T[] = [];
    let page = 1;
    while (true) {
      const sep = endpoint.includes('?') ? '&' : '?';
      const res = await fetch(
        `${this.base}${endpoint}${sep}per_page=100&page=${page}`,
        { headers: this.headers },
      );
      if (!res.ok)
        throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as T[];
      items = items.concat(data);
      if (data.length < 100) break;
      page++;
    }
    return items;
  }

  async getIssues(): Promise<Issue[]> {
    return this.fetchAll<Issue>('/issues?state=all&sort=created&direction=asc');
  }

  async getLabels(): Promise<Label[]> {
    return this.fetchAll<Label>('/labels');
  }

  async getMilestones(): Promise<Milestone[]> {
    return this.fetchAll<Milestone>('/milestones?state=all');
  }

  async createLabel(name: string, color: string): Promise<Label> {
    const res = await fetch(`${this.base}/labels`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ name, color }),
    });
    return (await res.json()) as Label;
  }

  async createMilestone(title: string): Promise<Milestone> {
    const res = await fetch(`${this.base}/milestones`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ title }),
    });
    return (await res.json()) as Milestone;
  }

  async createIssue(
    title: string,
    body: string,
    labels: string[],
    milestone?: number,
  ): Promise<Issue> {
    const payload: Record<string, unknown> = { title, body, labels };
    if (milestone) payload.milestone = milestone;
    const res = await fetch(`${this.base}/issues`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Create failed: ${res.status}`);
    return (await res.json()) as Issue;
  }

  async updateIssue(
    number: number,
    updates: Record<string, unknown>,
  ): Promise<Issue> {
    const res = await fetch(`${this.base}/issues/${number}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    return (await res.json()) as Issue;
  }

  async getViewer(): Promise<Viewer> {
    const res = await fetch(`${API_ROOT}/user`, { headers: this.headers });
    if (!res.ok)
      throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    return (await res.json()) as Viewer;
  }

  async searchIssues(query: string, perPage = 50): Promise<SearchIssue[]> {
    const q = encodeURIComponent(query);
    const res = await fetch(
      `${API_ROOT}/search/issues?q=${q}&per_page=${perPage}&sort=updated`,
      { headers: this.headers },
    );
    if (!res.ok)
      throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { items: SearchIssue[] };
    return data.items;
  }

  // --- Phase 3: PR / issue mutations across arbitrary repos ---

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const res = await fetch(`${API_ROOT}${path}`, {
      method,
      headers: this.headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub ${method} ${path} ${res.status}: ${text}`);
    }
    return res;
  }

  async approvePr(repo: string, number: number, body = ''): Promise<void> {
    await this.request('POST', `/repos/${repo}/pulls/${number}/reviews`, {
      event: 'APPROVE',
      body,
    });
  }

  async mergePr(
    repo: string,
    number: number,
    method: 'merge' | 'squash' | 'rebase' = 'squash',
  ): Promise<void> {
    await this.request('PUT', `/repos/${repo}/pulls/${number}/merge`, {
      merge_method: method,
    });
  }

  async addLabels(
    repo: string,
    number: number,
    labels: string[],
  ): Promise<void> {
    await this.request('POST', `/repos/${repo}/issues/${number}/labels`, {
      labels,
    });
  }

  async closeIssue(repo: string, number: number): Promise<void> {
    await this.request('PATCH', `/repos/${repo}/issues/${number}`, {
      state: 'closed',
    });
  }

  // --- Phase 3: Workflow dispatch ---

  async listWorkflows(repo: string): Promise<WorkflowSummary[]> {
    const res = await this.request('GET', `/repos/${repo}/actions/workflows`);
    const data = (await res.json()) as { workflows: WorkflowSummary[] };
    return data.workflows;
  }

  async getWorkflowFileContent(repo: string, path: string): Promise<string> {
    const res = await this.request(
      'GET',
      `/repos/${repo}/contents/${encodeURIComponent(path)}`,
    );
    const data = (await res.json()) as { content: string; encoding: string };
    if (data.encoding === 'base64')
      return atob(data.content.replace(/\n/g, ''));
    return data.content;
  }

  async getDefaultBranch(repo: string): Promise<string> {
    const res = await this.request('GET', `/repos/${repo}`);
    const data = (await res.json()) as { default_branch: string };
    return data.default_branch;
  }

  async dispatchWorkflow(
    repo: string,
    workflowId: number | string,
    ref: string,
    inputs: Record<string, string> = {},
  ): Promise<void> {
    await this.request(
      'POST',
      `/repos/${repo}/actions/workflows/${workflowId}/dispatches`,
      { ref, inputs },
    );
  }

  async verifyAccess(): Promise<unknown> {
    const res = await fetch(this.base, { headers: this.headers });
    if (!res.ok) throw new Error(`Cannot access ${this.repo}`);
    return res.json();
  }
}
