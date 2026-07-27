# How groundtruth is put together

groundtruth is deliberately simple as a piece of software, and it's worth
saying that plainly before describing it: there's no server here, no
database, nothing running in the background, nothing listening on a
network port. It's a single command-line program that runs once, reads
some files off your disk, and exits. That simplicity is a real design
choice, not a placeholder for something more complicated to come later —
the whole job the tool does can be done in one pass over the filesystem.

So walk through what happens when you actually type "groundtruth check"
at your terminal.

The program starts in a file called cli dot T S, which is the entry
point. It parses whatever flags you passed in — maybe you told it which
repository to check, maybe you pointed it at a custom assertions file,
maybe you asked for J S O N output instead of a readable table. Once it
knows what you're asking for, it does two things in parallel, in a sense.

First, it loads your assertions file — the dot groundtruth dot J S O N C
file — parsing it and validating its shape using a schema library called
Zod, so that a malformed assertions file fails loudly and immediately
rather than causing something confusing three steps later.

Second, it looks around your repository for what it calls the context
layer — basically, does a CLAUDE dot M D exist here, does an AGENTS dot M
D exist, that kind of thing. Right now this step is informational only.
It shows up at the top of your report so you know what groundtruth found,
but it doesn't yet drive which assertions get checked, because — as
covered in the getting-started narration — the automatic extraction step
that would make that connection real hasn't been built yet.

With a validated list of assertions in hand, the program moves to what's
really the heart of the tool: the checking step. Every assertion has a
kind — is this a claim that a file exists, that an environment variable
is absent, that a script is defined, that a particular function is
present in a particular file, and so on. There's a small registry inside
the code that maps each of those kind names to the actual function that
knows how to check it. The program walks through every assertion, looks
up its checker by kind, and runs it against your actual repository files.
Each check comes back with one of three answers: passing, failing, or
unverifiable.

One detail worth calling out here, because it reflects something the
project takes seriously about its own reliability: the way that registry
is built in the code, it's actually impossible to add a new kind of
assertion without also wiring up its checker. If you tried, the program
simply wouldn't compile. That's not a rule someone has to remember to
follow — it's enforced by the type system itself.

Once every assertion has been checked, the results get handed to a
reporting step, which counts up how many passed, how many failed, how
many came back unverifiable, and prints all of it out — ordered
deliberately so that failures show up first, then the unverifiable ones,
and passing checks last, because your eye should land on what needs
attention, not scroll past it to find it. Finally, the program exits with
a status code: zero if everything that could be checked came back clean,
one if anything failed. That status code is what lets this whole thing
slot into a continuous integration pipeline as a gate — a pull request
can be blocked automatically the moment a context file's claim goes
stale, the same way a broken type check or a failing test would block it.

And that's really the whole system. One process, one pass over the
filesystem, one exit code.
