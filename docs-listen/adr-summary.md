# The decisions behind groundtruth, and why they were made

There are five real architectural decisions baked into groundtruth's
current design, and it's worth understanding not just what they are, but
why each one was made — because in each case, there was a real
alternative on the table that got rejected for a specific reason.

The first decision is about sequencing. The long-term goal is for
groundtruth to read your CLAUDE dot M D file and automatically figure out
what claims are in it, using an AI model, without you having to write
anything by hand. That part doesn't exist yet. The team could have chosen
to build that first, but they didn't, and the reasoning is straightforward:
building the extraction step first would have tied the very first version
of this tool to the reliability of a language model's output, before the
simpler, more mechanical core — the part that actually checks a claim
against your repository and reports on it — had even been proven to work.
So instead, the hand-authored format was built first, and built carefully
enough that it's exactly the shape the automated extraction will need to
produce later. Nothing about writing assertions by hand today becomes
wasted effort once automation arrives.

The second decision is about what happens when groundtruth simply can't
check something. Not every claim in a context file can be turned into a
mechanical check — some things are genuinely about intent, or need a kind
of checker that doesn't exist yet. The team had a choice here between two
bad-sounding options and one better one. They could have made those
unchecked claims count as failures, but that would mean every time
someone adds a claim that needs a not-yet-built kind of check, everyone
using the tool suddenly has a broken build through no fault of their own.
Or they could have quietly treated unchecked claims as if they'd passed —
but that's precisely the failure mode the whole tool exists to prevent,
just moved one level up. So the actual decision is a third option:
unverifiable claims never fail your build, but they are always shown in
the report, impossible to miss, impossible to silently drop. It's a small
design choice, but it's the one the project seems proudest of, because it
reflects the tool's whole reason for existing.

The third decision is a much more mundane, practical tradeoff, but a real
one. One of the six kinds of claims groundtruth can check is whether a
particular function still exists at a particular file path — something
like, "this function is still the one place that decides a certain piece
of business logic." Checking that properly really calls for actually
parsing the code the way a compiler would. Instead, the current
implementation just searches the file's text for an export declaration
using a regular expression. That's faster to build and has no extra
dependencies, but it has a known blind spot: if a function is only
available in a file because it's re-exported from somewhere else, the
regular-expression check won't see it, and it'll incorrectly report the
claim as failing rather than passing. The project made a deliberate
choice to ship that limitation openly, written down, rather than pretend
the check is more thorough than it is. And because of how the checking
system is structured — each kind of check living behind its own small,
swappable piece of code — replacing that regular expression with a real
parser later is a contained change, not a rewrite.

The fourth item isn't really a decision that's been executed yet so much
as a decision about direction — a roadmap, essentially, structured as
three layers stacked on top of each other. Layer one is what's been
described already: turning individual claims into individual checks.
Layer two, not yet built, is about contradictions — catching the case
where two different context files, or two different parts of the same
one, say things that directly conflict with each other, even though each
individual sentence might check out fine in isolation. That layer needs
real judgment from a language model, not just a mechanical check, because
recognizing that two statements contradict each other is a different kind
of problem than verifying one statement is true. Layer three, further out
still, is about actually watching real agent sessions to see which rules
in a context file ever get referenced at all — the idea being that over
time, a context file accumulates more and more rules, and some of them
become dead weight that nobody, human or agent, is actually reading
anymore. The team wants that pruning to be based on real evidence of what
gets used, not a guess.

The fifth decision is about how the tool actually reaches a pull request,
and it's the first one here that's about distribution rather than about
checking. The reasoning starts from an uncomfortable observation: a drift
check that only ever runs on somebody's laptop catches drift after it has
already been merged, which is most of the value gone. So the tool needed
to be easy to drop into a continuous-integration pipeline, and on GitHub
that means shipping what's called an Action — a reusable step other
people can add to their own workflows in a line or two.

GitHub offers three shapes for one of those, and the choice between them
is a genuine tradeoff. The most common shape for a tool written in
JavaScript is to commit a pre-bundled copy of the whole program into the
repository, so the runner can execute it immediately with nothing to
fetch. It starts fastest. But it means carrying a second build artifact
that has to be rebuilt and re-committed every time the source changes,
and that can quietly fall out of step with the code it was built from —
which, for a project whose entire subject is things quietly falling out
of step with each other, is an awkward thing to sign up for. The second
shape wraps everything in a container, which gives complete control of
the environment but pays for it with a container download on every single
run: minutes of waiting for a check that does milliseconds of real work.
The third shape, the one chosen here, is called a composite action, and
it's really just a thin wrapper around ordinary shell commands. It has no
bundling story at all — whatever it invokes has to already exist on the
machine, or be fetched at the moment it runs.

That last constraint is exactly why it fits. The command-line tool is
already published to the public package registry, and every runner GitHub
provides already has the runtime needed to fetch and run it. There is
nothing left to bundle that isn't already being distributed. So the
Action installs the published tool at a pinned version, runs the same
check anyone would run locally, and then does the three things a
continuous-integration surface can do that a terminal can't. It puts a
marker directly on the line of the context file that made the false
claim, so the failure shows up in the code review itself rather than in a
log somebody has to go hunting for. It writes a readable summary onto the
run. And it hands the counts to any later step that wants to act on them.
It re-implements none of the checking, which was never seriously on the
table — two implementations of the same check is precisely the kind of
drift this whole project exists to catch.

There's a real cost attached, and it's worth naming because it bites in a
specific way. Since the Action installs a particular published version of
the tool, that version has to already exist publicly at the moment the
Action itself is released. Get the order wrong — tag the release before
publishing the package — and the Action is broken for everyone who tries
it, on their very first run, in the most visible way possible. So the
release ritual is fixed: publish the package first, tag second. The other
cost is that the check now depends on the package registry being
reachable when it runs. If it isn't, the check fails to run rather than
reporting drift, and anyone who can't accept that can install the tool as
an ordinary dependency and call it directly. The command-line tool is the
product; the Action is a convenience layered over it.
