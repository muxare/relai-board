import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import allowlist from '../../nightshift/repos.json';
import schema from '../../nightshift/repos.schema.json';

// Ajv's default export implements draft-07, which is the draft the schema
// declares. Draft 2020-12 would need the import from 'ajv/dist/2020'.
const validate = new Ajv({ allErrors: true }).compile(schema);

const entry = {
  name: 'owner/repo',
  maxIssuesPerNight: 2,
  testCommand: 'npm test',
};

function without(key: keyof typeof entry) {
  return Object.fromEntries(Object.entries(entry).filter(([k]) => k !== key));
}

// Each case expects exactly one error, so that it cannot pass because some
// other part of the document happens to be invalid.
function expectSingleError(
  data: unknown,
  keyword: string,
  instancePath: string,
) {
  expect(validate(data)).toBe(false);
  expect(validate.errors).toHaveLength(1);
  expect(validate.errors![0]).toMatchObject({ keyword, instancePath });
}

describe('nightshift/repos.json', () => {
  it('matches the schema', () => {
    validate(allowlist);
    expect(validate.errors).toBeNull();
  });

  // An empty list is allowed: it is how the night shift is switched off.
  it('lists no repo twice', () => {
    const repos: { name: string }[] = allowlist.repos;
    const names = repos.map((r) => r.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('nightshift/repos.schema.json', () => {
  it.each([
    'owner/repo',
    'my-org/repo.name_1',
    'o/.github',
    'user_company/repo',
  ])('accepts the name %s', (name) => {
    expect(validate({ repos: [{ ...entry, name }] })).toBe(true);
  });

  it('accepts an empty list', () => {
    expect(validate({ repos: [] })).toBe(true);
  });

  it('rejects a document without repos', () => {
    expectSingleError({}, 'required', '');
  });

  it('rejects an extra property at the top level', () => {
    expectSingleError(
      { repos: [entry], extra: true },
      'additionalProperties',
      '',
    );
  });

  it('rejects an extra property on a repo', () => {
    expectSingleError(
      { repos: [{ ...entry, extra: true }] },
      'additionalProperties',
      '/repos/0',
    );
  });

  it.each(['name', 'maxIssuesPerNight', 'testCommand'] as const)(
    'rejects a repo without %s',
    (key) => {
      expectSingleError({ repos: [without(key)] }, 'required', '/repos/0');
    },
  );

  it.each([
    '',
    'repo',
    'owner/',
    '/repo',
    'owner/repo/extra',
    'owner /repo',
    'owner/repo\n',
    '-owner/repo',
    'owner/..',
    'owner/repo;ls',
    'https://github.com/owner/repo',
  ])('rejects the malformed name %j', (name) => {
    expectSingleError(
      { repos: [{ ...entry, name }] },
      'pattern',
      '/repos/0/name',
    );
  });

  it.each([
    [0, 'minimum'],
    [1.5, 'type'],
    ['2', 'type'],
  ])('rejects maxIssuesPerNight %j', (maxIssuesPerNight, keyword) => {
    expectSingleError(
      { repos: [{ ...entry, maxIssuesPerNight }] },
      keyword,
      '/repos/0/maxIssuesPerNight',
    );
  });

  it.each(['', '   '])('rejects the blank testCommand %j', (testCommand) => {
    expectSingleError(
      { repos: [{ ...entry, testCommand }] },
      'pattern',
      '/repos/0/testCommand',
    );
  });
});
