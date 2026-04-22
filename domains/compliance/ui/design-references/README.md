# Design References

Reference screenshots from Drata and Vanta, captured via Playwright for visual anchoring of our static compliance screens. These are NOT to be mimicked pixel-for-pixel — they inform the shared vocabulary of the GRC category (KPI strips, control list shapes, status tinting, dense tables, sidebar filter rails) so our own Instrument-themed screens feel familiar to anyone coming from those platforms.

## Captured screens

### Drata

- `ref-drata-01-platform-overview.png` — drata.com/products — Platform marketing overview
- `ref-drata-02-help-center.png` — help.drata.com — Help center landing (collections grid)
- `ref-drata-03-platform-collection.png` — help.drata.com/en/collections/16396695 — "Understand the Drata Platform" collection (262 articles — full product surface area)

### Vanta

- `ref-vanta-01-automated-compliance.png` — vanta.com/products/automated-compliance
- `ref-vanta-02-homepage.png` — vanta.com
- `ref-vanta-03-risk.png` — vanta.com/products/risk
- `ref-vanta-04-third-party-risk.png` — vanta.com/products/third-party-risk-management
- `ref-vanta-05-audit.png` — vanta.com/products/audit

## Archetype mapping

| GRC archetype | Drata name | Vanta name | Our screen |
|---|---|---|---|
| Dashboard | Dashboard | Automated Compliance | `/dashboard` ✓ |
| Control registry | Controls / Control Framework | Continuous GRC | **Obligations Library** ← this PR |
| Control detail | Control Detail | Control Detail | TBD — Obligation Detail |
| Monitoring / tests | Monitoring | Automated Tests | TBD — Handlers / Rules |
| Evidence | Evidence | Documents | TBD — Evidence Vault |
| Risk | Risk | Risk Management | TBD — Risk Register |
| Vendors | Vendors | Third-Party Risk | TBD — Vendor Register |
| Audit | Audit Hub | Streamlined Audits | TBD — Audit Trail |
