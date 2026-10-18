# Official price refresh

This pipeline maintains the request log's public token price data independently
of theme releases. It never receives users' keys, prompts, model selections or
account information. Subscription, deployment and self-hosted charges remain
separate from token rates.

## Schedule and publication

`pricing-refresh.yml` runs daily at 03:17 UTC, on relevant main-branch updates,
and by manual dispatch. GitHub scheduling can be delayed or disabled by GitHub;
the extension shows stale checks instead of claiming a live price.

After this code is released, the first successful workflow creates the isolated
`pricing-data` branch containing `official-prices.json`. Subsequent runs append
commits to that branch. The publisher never changes main, gh-pages, tags, release
assets or ZIPs. It rejects concurrent changes to the feed head and never force
pushes. Until that workflow is published and runs, installations use bundled or
previously cached prices.

The client checks at most daily while SillyTavern is open. A manual check is
limited to once per minute. Failed downloads back off from one hour to one day.
Requests have a 12-second timeout; downloads are capped at 3 MiB. Existing prices
remain available offline; a storage quota error leaves a usable memory copy.
Neither a price refresh nor an API switch recalculates previous request records.
Requests already in progress retain the price snapshot from their start.

## Coverage and review rules

29 token-price providers are checked. 26 have parsers for public JSON catalogs or
reviewed HTML/Markdown tables; Vertex, Cohere and AI21 retain reviewed prices while
the official source is unchanged, and require review when it changes. Other billing
types in the provider registry are explained without inventing token prices.

JSON catalogs can add models when pricing fields, currency and units match a
reviewed contract: either an exact shape fingerprint (`apiShapes`) or a field
contract (`apiFields`) that lists every allowed pricing key with its value kind, so
new combinations of known per-token fields pass while a new unit or currency does
not. HTML contracts accept supported monetary changes but reject changed model
identities, units, context thresholds and billing text. For the marketplace pages
of AIMLAPI and Perplexity the contract covers table headers, units and billing
prose only, because their catalog rows change daily.

Two provider classes apply different drift rules:

- Curated tables (OpenAI, Anthropic, DeepSeek, xAI, Gemini, Groq, Mistral, MiniMax,
  Kimi, Z.ai, Fireworks, Together, Workers AI, SiliconFlow international): removed
  models, negative/non-finite amounts, free/paid switches and price changes outside
  0.5x–2x of the last confirmed amount put the whole provider into review and it
  keeps its last verified prices.
- Catalogs (`CATALOG_PROVIDERS` in `collect.py`: the JSON catalogs plus AIMLAPI,
  Perplexity and SiliconFlow CN): models that left the official catalog are dropped
  as long as they are at most `REMOVAL_CAP` (15%) of the previous list, and a model
  whose rate moved outside 0.5x–2x or switched between free and paid keeps its last
  verified row ("held") while the rest of the catalog updates. Removed and held
  models are listed in `report.json` and in the workflow summary.

This is deliberately conservative: a held model stays at its last verified price
until a person records the new value, and some harmless documentation changes will
need maintenance.

Each provider has its own last-success timestamp and immutable price revision.
A failing provider retains its previous models and check date; other providers
can still update. The workflow publishes those partial results, saves a compact
report, and `summarize.py` writes the step summary and decides the verdict: the
run fails only when a provider newly needs attention (its previous published
status was `ok`) or has stayed unverified for more than `STALE_DAYS` (14) days.
A provider already under review and models held at their last verified price are
warnings, so a problem is announced once and stays visible without turning every
daily run red. Whether GitHub sends an email depends on the repository owner's
existing notification settings.

OpenRouter and Perplexity use response-reported total costs when available.
Published list prices alone do not determine their final routed/tool-inclusive
cost. Currency, cache TTL, service tier, context length and other existing request
log limitations still apply. This is an estimate, not an invoice reconciliation.

## Maintenance

Read `report.json` from the workflow artifact or the step summary. Check the
provider's URLs in `contracts.json`, compare the new source against the last
reviewed source (the Wayback Machine usually has the previous day), and update its
parser, normalization contract, fixture and tests together. Do not simply accept
a new fingerprint to make a failing workflow green. Source text is never executed,
and fetched URLs/redirects are restricted to explicit official hosts. Raw website
bodies are temporary runner files, not committed artifacts.

To accept a reviewed change, add it to the provider's `reviewed` block in
`contracts.json`: `rates` maps a model to the exact rates seen on the official
source (copy them from the "Held models" list in the summary), and `removed` lists
models that may leave a curated table or exceed the catalog removal cap. Each entry
applies once, exactly as recorded; later moves are measured from the accepted value.
Prune entries once the published feed has moved on. Do not weaken the automatic
validation limits.

`seed.json` bootstraps the first feed only; normal runs must load the previous
published feed first. Never replace it with the seed after a download failure.
`fixtures/` holds small excerpts of the official pages as they were last reviewed;
`test_parsers.py` checks the parsers and contracts against them and
`test_summarize.py` checks the workflow verdict policy.

Run `python -m unittest discover -s tools/pricing -p 'test_*.py'` and
`node tools/pricing/test-client.mjs`, then collect into a temporary directory and
run `node tools/pricing/validate-feed.mjs <feed.json>` before publication.
The same runtime schema validates both the produced file and downloaded data.

Source links are listed in `contracts.json`; amounts are per 1,000,000 tokens.
The initial reviewed bundle is dated 2026-10-10 and the parsers were last reviewed
against the official pages on 2026-10-19. Prices refresh independently; new billing
rules or unsupported model families may still require a code update.
