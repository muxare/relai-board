# Night-shift proposal template

Every proposal for the night shift follows this template, whether a generator or a human
writes it. The runner works unattended, so the issue has to carry everything it needs to
do the work and everything a human needs to decide whether to promote it.

Copy the block below into the body of the issue, replace the text under each heading and
keep the headings as they are written.

````markdown
## Problem

One or two sentences on what is wrong.

## Evidence

File paths and line ranges, a measurement or a link.

## Proposed change

What to change, not how to explain it.

## Acceptance criteria

- [ ] A condition that has to hold when the work is done.

## Verify with

```sh
an exact command whose exit code decides pass or fail
```

## Tier

A1, A2 or A3. Name one.

## Out of scope

What the runner must not touch.
````

## Issues without "Verify with"

The runner has nobody to ask at night, so the exit code of the "Verify with" command is
what decides whether an issue passed. An issue that lacks it will therefore be refused:
the runner labels it `night:blocked` with the reason "missing verification". The runner
itself is not built yet; this rule takes effect with
[#18](https://github.com/muxare/relai-board/issues/18).
