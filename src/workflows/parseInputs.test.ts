import { describe, expect, it } from 'vitest';
import { parseWorkflowDispatchInputs } from './parseInputs';

describe('parseWorkflowDispatchInputs', () => {
  it('returns [] when workflow is not workflow_dispatch', () => {
    const yaml = `name: ci\non: push\njobs: {}\n`;
    expect(parseWorkflowDispatchInputs(yaml)).toEqual([]);
  });

  it('returns [] for short-form workflow_dispatch with no inputs', () => {
    const yaml = `name: deploy\non: workflow_dispatch\n`;
    expect(parseWorkflowDispatchInputs(yaml)).toEqual([]);
  });

  it('parses flat inputs under workflow_dispatch', () => {
    const yaml = `name: deploy
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target env'
        required: true
        type: choice
        options: [staging, production]
      version:
        description: 'Version to deploy'
        default: 'latest'
        type: string
      dry_run:
        type: boolean
        default: 'false'
`;
    const inputs = parseWorkflowDispatchInputs(yaml);
    expect(inputs).toHaveLength(3);
    expect(inputs[0]).toMatchObject({
      name: 'environment',
      description: 'Target env',
      required: true,
      type: 'choice',
      options: ['staging', 'production'],
    });
    expect(inputs[1]).toMatchObject({
      name: 'version',
      default: 'latest',
      type: 'string',
    });
    expect(inputs[2]).toMatchObject({
      name: 'dry_run',
      type: 'boolean',
      default: 'false',
    });
  });

  it('parses block-style options list', () => {
    const yaml = `on:
  workflow_dispatch:
    inputs:
      env:
        type: choice
        options:
          - dev
          - staging
          - prod
`;
    const inputs = parseWorkflowDispatchInputs(yaml);
    expect(inputs[0].options).toEqual(['dev', 'staging', 'prod']);
  });
});
