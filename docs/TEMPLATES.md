# Seller templates

Version 1.5.0 adds consent-based seller templates.

Templates contain reading rules only: seller match keys, field label anchors and table column anchors. They must never contain invoice amounts or copied invoice text.

Templates are stored only in the current browser after the user explicitly agrees to save them. Import/export uses a versioned JSON schema with strict validation and a 256 KB limit.

Matching prefers an exact normalized seller GSTIN and then an exact normalized seller-name key. A similar name is not enough to apply a template. If a template's anchors do not match, general extraction remains the safe fallback.

A visible `Template applied` indicator is used when a template is associated with an invoice. Users can read an invoice without a template, and the review screen remains the final authority.
