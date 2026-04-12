import type { Issue, Label, Milestone } from '../types/github';

export class GitHubAPI {
  constructor(
    private token: string,
    private repo: string,
  ) {}

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    };
  }

  private get base(): string {
    return `https://api.github.com/repos/${this.repo}`;
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
    return this.fetchAll<Issue>(
      '/issues?state=all&sort=created&direction=asc',
    );
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

  async verifyAccess(): Promise<unknown> {
    const res = await fetch(this.base, { headers: this.headers });
    if (!res.ok) throw new Error(`Cannot access ${this.repo}`);
    return res.json();
  }
}
