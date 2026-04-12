import { describe, it, expect } from 'vitest';
import { parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('parses a minimal plan with epic, feature, and story', () => {
    const input = `# Epic: My Epic
labels: epic, phase-1
milestone: Phase 1
---
Epic description.

## Feature: My Feature
labels: feature, backend
---
Feature description.

### Story: My Story
labels: story
---
Acceptance criteria here.`;

    const tree = parseMarkdown(input);

    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe('epic');
    expect(tree[0].title).toBe('My Epic');
    expect(tree[0].labels).toEqual(['epic', 'phase-1']);
    expect(tree[0].milestone).toBe('Phase 1');
    expect(tree[0].body).toBe('Epic description.');
    expect(tree[0].children).toHaveLength(1);

    const feature = tree[0].children![0];
    expect(feature.type).toBe('feature');
    expect(feature.title).toBe('My Feature');
    expect(feature.labels).toEqual(['feature', 'backend']);
    expect(feature.children).toHaveLength(1);

    const story = feature.children![0];
    expect(story.type).toBe('story');
    expect(story.title).toBe('My Story');
    expect(story.body).toBe('Acceptance criteria here.');
  });

  it('handles orphan features and stories', () => {
    const input = `## Feature: Standalone Feature
labels: feature
---
No epic parent.

### Story: Standalone Story
labels: story
---
Under the feature.`;

    const tree = parseMarkdown(input);
    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe('feature');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].type).toBe('story');
  });
});
