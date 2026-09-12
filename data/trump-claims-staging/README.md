# Trump claims staging

This directory is a provenance and publication gate for locally generated staging records. The source audit covered exactly these four files:

| Source file | Rows / grain |
| --- | --- |
| `wapo_trumpclaims_export-012021.csv` | 30,573 occurrence-level rows: one statement occurrence with claim, analysis, date, location, category, and optional rating metadata |
| `wapo_4616-claims_wide.csv` | 4,616 canonical/repeated-claim aggregate rows; no claim text or source URLs |
| `false-claim-info.csv` | 150 curated claim-text rows with repetition/category/location/date metadata |
| `1aPfiffnerTrumpLieschapter.docx` | 9,705-word scholarly chapter; not a structured claim table |

The occurrence export covers 2017-01-20 through 2021-01-20. The wide aggregate covers the same dates. The 150-row file covers start dates 2017-01-26 through 2021-01-19 and final dates 2017-01-26 through 2021-01-19. The chapter is a taxonomy/background source, not an occurrence dataset.

No bundled README, LICENSE, repository metadata, or source manifest was present in the supplied folder. The large export is identified by its fields, embedded links, and analysis as a Washington Post Fact Checker export, but that identification does not itself establish republication permission.

The 30,573-row export is occurrence-level evidence, not 30,573 independent canonical entries. Repeated statements must be linked or deduplicated into canonical claims while retaining occurrence dates and other evidence metadata. The 4,616-row wide file is aggregate metadata and must not be added as a second set of textual entries. The 150-row file is a selected subset, not an additional independent corpus.

Source-link coverage in the occurrence export is partial: 11,502 of 30,573 rows contain HTML links in their analysis. Rows without links remain unresolved for publication until their provenance is verified.

The Pfiffner chapter may inform the editorial taxonomy of lie-related material (taxonomy/background only). It must not be treated as a fact-check verdict or mechanically republished as individual claims.

## Publication gate

Staged records are research candidates, not publishable entries. A record may move into the live corpus only after all of the following pass:

- source URL recovery or verification;
- an original derivative summary rather than copied source prose;
- taxonomy assignment;
- score assignment under the current project scoring rules;
- exact and semantic deduplication against the live corpus;
- editorial verification of claim, date, context, and provenance.

Until every gate passes, staging data must remain isolated from public retrieval, counts, and entry displays.
