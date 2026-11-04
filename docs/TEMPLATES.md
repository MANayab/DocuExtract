# Seller templates

Version 1.5.0 added consent-based seller templates.

Templates contain seller match keys, field-label anchors and table-column anchors. They are not intended to contain invoice amounts or copied invoice text.

Templates are stored locally in the current browser only after explicit user consent. Import and export use a versioned JSON schema with strict validation and a 256 KB limit.

Matching prefers an exact normalized seller GSTIN and then an exact normalized seller-name key. Similar names are not sufficient. If a template does not match, general extraction remains the fallback and review remains the final authority.

Automated schema and matcher coverage exists. Full end-to-end human QA on real seller invoices remains pending.
