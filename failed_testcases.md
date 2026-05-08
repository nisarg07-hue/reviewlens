# Failed TestSprite Test Cases

This document lists the test cases that passed or were blocked during the latest TestSprite analysis.

## FAILED Test Cases
These tests executed but encountered an assertion failure or an error.

| ID | Title | Error Summary |
|---|---|---|
| TC001 | Analyze a supported review URL end to end | Trustpilot reviews passed to fetch. |
| TC003 | Run a supported review analysis from the homepage | Fetching Trustpilot reviews passed (error message shown). |
| TC006 | Enforce the free analysis quota with upgrade prompt | Paywall modal did not appear after free analyses were used. |
| TC010 | Request an upgrade from the paywall modal | Paywall prompt did not appear; fetch error instead. |
| TC014 | View report insights on the analysis page | Analysis report could not be generated due to fetch failure. |

## BLOCKED Test Cases
These tests could not be completed due to environmental constraints (e.g., rate limiting, authentication).

| ID | Title | Reason for Block |
|---|---|---|
| TC002 | Complete a free analysis from the home page | Rate limited: "Too many requests. Slow down." |
| TC007 | Open the dashboard after sign-in | Auth flow blocked (magic link cannot be accessed in test env). |
| TC009 | See the free usage counter after running an analysis | Fetch failure prevented verifying the counter. |
| TC011 | Analyze from an example URL shortcut | Rate limited: "Too many requests. Slow down." |
| TC012 | Compare two products side by side | Auth flow blocked (magic link requirement). |
| TC013 | Compare two products and review the winner | Auth flow blocked (magic link requirement). |
| TC015 | Review the key sections of an analysis report | Fetch failure prevented verifying report sections. |

---
**Total Results:**
- **PASSED**: 3 (TC004, TC005, TC008)
- **FAILED**: 5
- **BLOCKED**: 7
