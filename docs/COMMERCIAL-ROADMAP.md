# Proposal: product and architecture direction

This document is a proposal and not a release commitment. Commercial implementation has not started. The proposed milestones are deferred until after the v1.8.0 quality and accessibility work.

DocuExtract should keep one extraction engine, one data model, one export system and one test suite across delivery editions.

The Web edition remains first. The current engineering sequence through v1.8.0 takes priority; any commercial milestones would be separately proposed after v1.8.0 and require a new maintainer decision. A Windows desktop edition may later be investigated by packaging the existing React/Vite application with Tauri 2, starting with Windows. Signed installers and signed updates would be required before treating a desktop build as stable. Other platforms should be considered only after Windows is stable.

The licensing direction is signed offline licence files verified locally with a public key. Client-side checks can authenticate a licence but cannot prevent a determined user from modifying the code. Any future licensing service must be separate from invoice processing and must never receive invoice files or extracted data. Payments must remain separate from processing.

The privacy-first constraint applies to every future feature: “Private invoice extraction. Your files stay on your device.”

Deferred or avoided for this cycle are cloud processing and storage, analytics and tracking, an AI extraction service, team collaboration, ERP integrations and mobile apps.

Quality comes before monetization. Before any paid launch, the gate should include measured field-level accuracy for invoice number, date, seller, subtotal, tax, grand total and line items tracked separately, verified exports, verified privacy claims and finished seller templates.

Prices, discount offers, revenue targets, early-access plans and customer lists are intentionally not recorded in this public repository.


## Deferred proposal milestones (after v1.8.0)

- v1.9.x proposal: evaluate a Windows desktop package only after the web product meets the quality gate.
- v1.10.x proposal: evaluate local licence-file design and its threat model.
- v1.11.x proposal: evaluate payment integration only after licensing and distribution are independently approved.

These are planning placeholders, not committed versions or active work. Licensing, a Windows desktop package, payments and any licensing service are NOT started. Do not add analytics or move invoice processing off-device. Before any paid launch, the gate is measured field-level accuracy, verified exports, verified privacy claims and finished seller templates.

Prices, offers, revenue targets and customer lists must remain outside this public repository.
