# Wikipedia OIC reference

`oic-wikipedia.csv` is a reference table, **not** an injected market-data source. It lets the audit compare the OIC scope and Muslim-share values against the Wikipedia table supplied by the user.

## Table

- 57 member states and 5 observer states.
- `joined_year` and `join_note` from the Chinese Wikipedia OIC article.
- `muslim_share` / `share_display` from the same table.
- Observer states are excluded from the 57-market app scope.
- Source: [伊斯兰合作组织（中文 Wikipedia）](https://zh.wikipedia.org/wiki/%E4%BC%8A%E6%96%AF%E5%85%B0%E5%90%88%E4%BD%9C%E7%BB%84%E7%BB%87), accessed 2026-11-19. The table's share column cites Pew Forum, “Religious Composition by Country” (archived 2013).

## Why it is not injected

The Wikipedia share column is a secondary Pew Forum compilation. It has no per-country census year and uses rounded/qualified values such as `>99.0%` and `~6.4%`. The app therefore shows only the six official census snapshots in `data/source/muslim-official.csv`, and the audit reports the differences rather than replacing official values.

The current English Wikipedia table also differs on several shares from the Chinese table in the user's image. Examples:

| Country | Chinese table / image | Current English table | Official census used by app |
| --- | ---: | ---: | --- |
| Bangladesh | 89.80% | 92% | 91.04% (2022, BBS) |
| Brunei | 75.10% | 84% | 82.1% (2021, DEPS) |
| Kazakhstan | 70.40% | 74% | 69.3% (2021, BNS) |

English reference: [Member states of the Organisation of Islamic Cooperation](https://en.wikipedia.org/wiki/Member_states_of_the_Organisation_of_Islamic_Cooperation).

## Reproduction

```bash
npm run audit:markets
```

The audit writes `docs/data-quality.md` and `public/data/data-quality.json`; it exits non-zero only for hard provenance/value/hash errors, not for reference differences.

## English page check (2026-11-19)

The supplied URL [Organisation of Islamic Cooperation](https://en.wikipedia.org/wiki/Organisation_of_Islamic_Cooperation) was checked directly:

- Its **Members** section confirms **57 member states** and **5 observer states** (Northern Cyprus, Bosnia and Herzegovina, Central African Republic, Thailand, Russia);
- It has **no join-year or Muslim-share table**. The section lists members by continent and links to the separate [Member states article](https://en.wikipedia.org/wiki/Member_states_of_the_Organisation_of_Islamic_Cooperation);
- Its lead says **48** members are Muslim-majority, citing Pew Forum 2012/2010 data, while the Members section names **8** non-Muslim-majority members; 57 − 8 = **49**. The page therefore contradicts itself on this count;
- It records Syria's suspension in 2012 and restoration in 2025;
- The image's join-year/share table matches the **Chinese** OIC page (Pew Forum 2010 estimates（2013 存档）), not a table on the supplied English main page. The English Member states page has yet another set of share values (Bangladesh 92%, Brunei 84%, Kazakhstan 74% vs the image's 89.80%, 75.10%, 70.40%).

The machine-readable page notes are in `oic-wikipedia-page-notes.json`; the audit includes this page-level contradiction in its quality report.

## Citation verification

The cited Pew PDF was downloaded from the archived URL and checked against `pew-2010-verification.json`:

- The table is **Religious Composition by Country, 2010 estimates** (one decimal place);
- The six sampled countries used by the app match exactly: Bangladesh 89.8%, Brunei 75.1%, Indonesia 87.2%, Kazakhstan 70.4%, Malaysia 63.7%, Pakistan 96.4%;
- The share column is therefore traceable to a real, reputable Pew table, but it is a 2010 estimate, not a current official census;
- The **join-year column has no citation** in the Chinese Wikipedia table. It is stored as reference metadata only and is not injected into the app.

PDF SHA-256: `1d3f0516542c7931df7d2e2d927f75327000ea837b41f0015126843d8023cb65`.
