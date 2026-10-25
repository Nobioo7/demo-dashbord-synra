# Extension privacy and data flow

## Automatic capture removed

Previously, `page-fetch.ts` injected code into the page's main world at
`document_start` on ChatGPT and Claude domains, including their subdomains. It
wrapped `window.fetch` and considered matching POST requests to provider
conversation/completion endpoints. For those requests it read the request body
and cloned non-binary response bodies, extracted user prompts and assistant
responses from JSON or streaming responses, clipped each text field to 100,000
characters, and sent the extracted text plus the request URL, method, response
status, source, project ID, and timestamp through `window.postMessage`. The
isolated content script relayed that event to `POST /api/v1/ingest`. That old
relay did not include the API key; the current authenticated backend would
reject it.

This path did not read request headers directly, but request and response
bodies could contain sensitive conversation content; a matching URL could
also expose sensitive query parameters in its metadata. Provider API response
formats are not a reliable privacy boundary. The interceptor and relay have
been removed.

## Current capture behavior

The extension does not intercept `fetch` or XHR and does not inspect provider
network requests or responses. The page-world `page-fetch.ts` script has been
removed.

The manual capture UI is injected only on these provider origins:

- `https://chatgpt.com`
- `https://chat.openai.com`
- `https://claude.ai`

Capture only occurs after the user opens **Add memory**, manually enters or
pastes text into its empty field, and chooses **Save memory**. The extension
does not read page DOM text, text selections, form values, password fields,
cookies, request headers, authorization tokens, or the page URL. It therefore
cannot automatically distinguish or capture those values from a provider page.

## Data sent

After the user chooses **Save memory**, the isolated content script sends the
manually entered text, the project ID, the fixed source `chrome-extension`, the
event type `capture`, an empty response field, and the fixed metadata
`capture_method: manual` to the extension background worker.

The background worker reads `synraApiKey` from `chrome.storage.local` and sends
the memory to the configured Synra backend at `POST /api/v1/memory/add`, with
the key in the `X-API-Key` request header. The key is not sent to the provider
page or included in the memory payload. The backend stores the submitted
memory according to its configured persistence.

## User guidance

Only submit text you intend to save to Synra. Do not paste passwords, API keys,
access tokens, personal data, or other secrets into the manual capture field.
The extension does not scrape page content or automatically detect every
possible secret format in text entered by the user.
