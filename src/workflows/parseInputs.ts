import type { WorkflowInput } from '../types/github';

/**
 * Minimal YAML scanner for the `on.workflow_dispatch.inputs:` block of a
 * GitHub Actions workflow file. We don't pull in a real YAML library — we
 * only care about flat key:value pairs (plus `options: [...]`) under each
 * input name.
 *
 * Returns [] if the workflow is not workflow_dispatch-triggered, or has no
 * inputs.
 */
export function parseWorkflowDispatchInputs(yaml: string): WorkflowInput[] {
  const lines = yaml.replace(/\r\n?/g, '\n').split('\n');

  // Find "on:" block start
  let i = 0;
  while (i < lines.length && !/^on\s*:/.test(lines[i])) i++;
  if (i >= lines.length) return [];

  // Detect short forms: `on: workflow_dispatch` or `on: [workflow_dispatch, ...]`
  const onLine = lines[i];
  const onRhs = onLine.replace(/^on\s*:\s*/, '').trim();
  if (onRhs && onRhs !== '') {
    if (onRhs === 'workflow_dispatch') return [];
    if (onRhs.startsWith('[') && onRhs.includes('workflow_dispatch')) return [];
    // Otherwise some other single trigger (push, etc.) — not dispatchable.
    if (onRhs !== 'workflow_dispatch' && !onRhs.includes('workflow_dispatch'))
      return [];
  }

  // Walk into the `on:` mapping, looking for `workflow_dispatch:`
  i++;
  let wdLine = -1;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\S/.test(l) && l.trim() !== '') break; // left the on: block
    if (/^\s*workflow_dispatch\s*:/.test(l)) {
      wdLine = i;
      break;
    }
    i++;
  }
  if (wdLine === -1) return [];

  // Find `inputs:` under workflow_dispatch
  const wdIndent = leadingSpaces(lines[wdLine]);
  i = wdLine + 1;
  let inputsLine = -1;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === '') {
      i++;
      continue;
    }
    const indent = leadingSpaces(l);
    if (indent <= wdIndent) break;
    if (/^\s*inputs\s*:/.test(l) && indent === wdIndent + 2) {
      inputsLine = i;
      break;
    }
    i++;
  }
  if (inputsLine === -1) return [];

  // Each input is a child of inputs:
  const inputsIndent = leadingSpaces(lines[inputsLine]);
  const inputs: WorkflowInput[] = [];
  i = inputsLine + 1;
  let current: WorkflowInput | null = null;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === '' || l.trim().startsWith('#')) {
      i++;
      continue;
    }
    const indent = leadingSpaces(l);
    if (indent <= inputsIndent) break;
    if (indent === inputsIndent + 2) {
      const m = l.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*$/);
      if (m) {
        current = { name: m[1] };
        inputs.push(current);
      } else {
        current = null;
      }
    } else if (current && indent > inputsIndent + 2) {
      const propMatch = l.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (propMatch) {
        const [, key, rawVal] = propMatch;
        const val = stripQuotes(rawVal.trim());
        if (key === 'description') current.description = val;
        else if (key === 'required') current.required = val === 'true';
        else if (key === 'default') current.default = val;
        else if (key === 'type') current.type = val as WorkflowInput['type'];
        else if (key === 'options') current.options = parseInlineList(val);
      } else {
        // possibly a continued options list with `- value` items
        const itemMatch = l.match(/^\s*-\s+(.+)$/);
        if (itemMatch && current) {
          current.options = current.options || [];
          current.options.push(stripQuotes(itemMatch[1].trim()));
        }
      }
    }
    i++;
  }

  return inputs;
}

function leadingSpaces(line: string): number {
  return line.length - line.trimStart().length;
}

function stripQuotes(v: string): string {
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  )
    return v.slice(1, -1);
  return v;
}

function parseInlineList(v: string): string[] | undefined {
  if (!v.startsWith('[') || !v.endsWith(']')) return undefined;
  return v
    .slice(1, -1)
    .split(',')
    .map((s) => stripQuotes(s.trim()))
    .filter(Boolean);
}
