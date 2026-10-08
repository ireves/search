# Search skills, version 1 (backup)

The first version of the search skills, kept as it was before version 2. It doesn't use workers, so it runs the same way in every Claude app.

- **Skills:** `web-search` (everyday) and `deep-search` (verified research).
- **Plain-English guide:** [`docs/skills-guide.md`](docs/skills-guide.md).
- **Test prompts:** [`docs/connector-test-prompts.md`](docs/connector-test-prompts.md).

## Switching back to version 1

It's listed in the same marketplace as a separate plugin called **search-v1**.

1. Open **Customize**, then **Plugins**.
2. Turn off or uninstall **search** (version 2), so you don't have both.
3. Find **search-v1** under the **ireves-search** marketplace and select **Install**.
   - Its commands show as `/search-v1:web-search` and `/search-v1:deep-search`.

Both versions use the same Search connector, so nothing else needs changing.
