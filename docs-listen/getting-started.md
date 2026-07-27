# Getting started with groundtruth

Here's the problem groundtruth is trying to solve, in plain terms.

When you work with an AI coding agent — something like Claude Code — you
usually give it a file, often called CLAUDE dot M D, or AGENTS dot M D,
short for Agents Markdown. That file is a kind of briefing document. It
tells the agent things about your project: which environment variables
are still in use, which service integrations exist, which script to run
before pushing code, which file owns a particular piece of business logic.

The problem is that this briefing document rots, the same way any other
piece of documentation rots as a codebase changes underneath it. Except
normal documentation rotting is relatively low-stakes — a human reads a
stale comment, gets briefly confused, and moves on. A stale line in an
agent's context file is a different kind of problem, because the agent
doesn't get confused. It just believes the sentence and acts on it. If the
file says "the database provider was torn down, don't reintroduce it,"
and that sentence used to be true but isn't being enforced anymore, an
agent might spend an entire session confidently rebuilding the exact thing
the sentence told it not to touch.

This isn't a hypothetical. The project that led to groundtruth being built
was a real audit of a production repository — a project called
AgendaProfe. That audit found four separate instances of exactly this
pattern: leftover environment variables for a database provider and a
hosting provider that had both been decommissioned months earlier, but
were still declared in the build tooling; a configuration file for a
database connector service, sitting there for a database that no longer
existed; and a memory file that flatly contradicted the project's own
stated pull-request policy. Every one of those became a worked example in
this project.

So what does groundtruth actually do about it? Its core command is called
"check." You take the claims in your context file — sentences like "the
Supabase project is torn down" or "this script runs the full test suite" —
and you turn each one into something that can be mechanically verified.
Does this environment variable still appear anywhere in the build
configuration? Does this script actually exist in package dot json? Does
this function still exist at this file path? Each of those becomes what
groundtruth calls an assertion, and running "groundtruth check" walks
through every assertion, checks it against your actual repository, and
tells you which ones are still true, which ones are now false, and which
ones it simply can't verify mechanically at all.

That last category matters a lot, and it's worth sitting with for a
second, because it's the part of the design the project cares most about
getting right. If groundtruth encounters a claim it has no way to check,
the tool refuses to just quietly skip it or count it as passing. It always
prints it, labeled as unverifiable, and it never lets an unverifiable
claim fail your build. But it will not hide it either. The reasoning here
is direct: silently dropping what you can't check is the exact same
failure mode the whole tool exists to prevent. If groundtruth started
doing that, it would just become a second source of quiet, confident
untruth.

Right now, the project is an early MVP. You write these assertions by
hand, in a file called dot groundtruth dot J S O N C — J S O N with
comments. The bigger goal, the thing that isn't built yet, is having an
AI model read your CLAUDE dot M D file directly and generate these
assertions automatically. But the hand-authored path was deliberately
built first, and built to match exactly the shape that automated
extraction will eventually need to produce — so none of the work put into
it today is wasted once that automation exists.

Beyond that, there's a longer roadmap. Checking individual claims is only
the first of three layers the project is aiming for. The second layer is
about contradictions — catching the case where one file in your project
says one thing, and another file says the opposite, even if each
individual sentence checks out fine on its own. The third layer is about
something you might call context economics: actually watching, during
real agent sessions, which rules in your context file ever get used at
all, so that a context file that's grown too large over time can be
trimmed based on evidence instead of a guess.

If you want the fine technical detail — the exact command-line flags, the
full list of what kinds of claims can be checked today, the file-by-file
architecture — that's all in the written documentation under the docs
folder, starting with the architecture overview.
