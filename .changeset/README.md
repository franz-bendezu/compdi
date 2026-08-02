# Changesets

Run `pnpm changeset` for every user-facing change. Select the affected package
and the appropriate semantic-version bump, then commit the generated Markdown
file with the change.

The three published packages are configured as a fixed group, so their versions
remain synchronized. Merging the automated release pull request publishes the
new versions and updates their changelogs.
