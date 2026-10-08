# Privacy

DocuExtract is designed as a zero-backend browser application. The application code processes selected PDF files locally in the browser and does not send invoice content to an application server, database, analytics service, or telemetry endpoint.

The application does not intentionally store invoice data in localStorage, sessionStorage, or URLs. Processing uses in-memory browser objects and releases the PDF document after extraction.

This document is not a promise about every network request made by a browser, extension, hosting platform, or future dependency. Users with strict privacy requirements should verify network activity in their own environment before processing sensitive documents.
