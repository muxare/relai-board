import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubAPI, isAlreadyExists } from './github';

const ALREADY_EXISTS = JSON.stringify({
  message: 'Validation Failed',
  errors: [{ resource: 'Label', code: 'already_exists', field: 'name' }],
});
const INVALID = JSON.stringify({
  message: 'Validation Failed',
  errors: [{ resource: 'Label', code: 'invalid', field: 'color' }],
});
const FORBIDDEN = JSON.stringify({
  message: 'Resource not accessible by integration',
});

const fetchMock = vi.fn<typeof fetch>();

function respond(status: number, body: string) {
  fetchMock.mockResolvedValueOnce(new Response(body, { status }));
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    (value) => {
      throw new Error(`Expected a rejection, got ${JSON.stringify(value)}`);
    },
    (err: unknown) => err,
  );
}

const api = new GitHubAPI('token', 'owner/repo');

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('createLabel', () => {
  it('posts the label and returns the created object', async () => {
    const label = { name: 'bug', color: 'ff0000' };
    respond(201, JSON.stringify(label));

    await expect(api.createLabel('bug', 'ff0000')).resolves.toEqual(label);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/owner/repo/labels');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(label);
  });

  it('rejects with the status and response text on a non-ok response', async () => {
    respond(403, FORBIDDEN);

    const err = await rejection(api.createLabel('bug', 'ff0000'));

    expect(err).toMatchObject({ status: 403, body: FORBIDDEN });
    expect((err as Error).message).toContain('403');
    expect((err as Error).message).toContain(FORBIDDEN);
  });

  it('lets a caller tell an existing label from other failures', async () => {
    respond(422, ALREADY_EXISTS);
    respond(422, INVALID);
    respond(403, FORBIDDEN);

    const existing = await rejection(api.createLabel('bug', 'ff0000'));
    const invalid = await rejection(api.createLabel('bug', 'nope'));
    const forbidden = await rejection(api.createLabel('bug', 'ff0000'));

    expect(isAlreadyExists(existing)).toBe(true);
    expect(isAlreadyExists(invalid)).toBe(false);
    expect(isAlreadyExists(forbidden)).toBe(false);
    expect(isAlreadyExists(new TypeError('Failed to fetch'))).toBe(false);
  });
});

describe('createMilestone', () => {
  it('posts the milestone and returns the created object', async () => {
    const milestone = { number: 7, title: 'Phase 1' };
    respond(201, JSON.stringify(milestone));

    await expect(api.createMilestone('Phase 1')).resolves.toEqual(milestone);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/owner/repo/milestones');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ title: 'Phase 1' });
  });

  it('rejects with the status and response text on a non-ok response', async () => {
    respond(403, FORBIDDEN);

    const err = await rejection(api.createMilestone('Phase 1'));

    expect(err).toMatchObject({ status: 403, body: FORBIDDEN });
    expect((err as Error).message).toContain('403');
    expect((err as Error).message).toContain(FORBIDDEN);
  });
});
