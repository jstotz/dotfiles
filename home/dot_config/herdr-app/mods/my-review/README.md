# My Review

The Herdr app's Changes panel as a GitHub-style code review: every changed file
is a card that expands and collapses, one scroll position with the current
card's header pinned, Viewed marks that clear themselves when a file's diff
changes, inline comments sent to an agent as one review, and the current file
opened in the tab's herdr-nvim. The `my-review-viewed` command lets agents read
and set the Viewed marks.

## Credit

My Review started as a copy of [herdr-reviewer](https://github.com/vytasgavelis/herdr-reviewer)
0.6.0 by Vytas Gavelis (MIT License), which turned Herdr's shipped `changes` mod
(0.1.8, Apache License 2.0) into a review panel: its diff rendering, syntax
colors, inline comments, scopes and send dialog are the foundation here. It has
since grown into its own panel. LICENSE and THIRD-PARTY-NOTICES carry both
original licenses.
