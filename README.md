# SentriSend

SentriSend is an outbound email security gateway for AI agents and applications. It checks a recipient before a message is sent, applies your policy, and returns a signed receipt you can verify without trusting us.

- Website: https://sentrisend.com
- MCP server (hosted): https://sentrisend.com/mcp

## MCP email gateway (for AI agents)

Listed on the official MCP Registry as `com.sentrisend/email-gateway`.

- Endpoint: `https://sentrisend.com/mcp/gateway` (Streamable HTTP)
- Header: `Authorization: Bearer YOUR_API_KEY`
- Tools: `validate_email` and `send_email` (one recipient per call)
- Free keys send only to your own verified address. Developer Pro ($29/month) can send to other recipients.
- Completed sends return an Ed25519-signed public receipt. It records provider acceptance, not delivery. Check one at https://sentrisend.com/receipts

Setup guide: https://sentrisend.com/mcp-gateway-setup.md
Article: https://dev.to/danby/how-to-prove-what-your-ai-agent-emailed-m02

Validation only? Use `com.sentrisend/validation` at `https://sentrisend.com/mcp`.
- OpenAPI description: https://sentrisend.com/openapi.json
- LLM-readable summary: https://sentrisend.com/llms.txt
- Receipt verifier: https://sentrisend.com/receipts
- Article: https://dev.to/danby/how-to-prove-what-your-ai-agent-emailed-m02

This repository contains documentation and examples only. It does not contain the SentriSend service source code.

## What it does

- Pre-send checks on the recipient and a global threat lookup.
- Policy checks before anything is sent.
- A public, signed receipt for each single send.
- A hosted MCP server so an agent can validate an email address before using it.

The hosted MCP server currently exposes one tool: `validate_email`.

## Public send receipts

Every successful single send returns a `publicReceipt`: a compact JWS signed with Ed25519 (header type `sentrisend-receipt+jws`).

The signed payload contains:

- `receiptId` and `issuedAt`
- `outcome`: `provider_accepted`
- `checks`: the results of the recipient preflight, global threat lookup and policy check
- `recipientCommitment` and `messageCommitment`: salted SHA-256 commitments. The recipient address, subject and body are not in the receipt.

The original send response also returns `receiptOpening`, which holds the two salts. SentriSend does not store the salts, so keep them if you want to prove later what was sent. Without them, nobody can check the commitments.

### What a receipt shows

- SentriSend issued it, and it has not been altered (signature).
- Which checks ran and their results.
- If you hold the salts, that a given recipient and message match the commitments.

### What a receipt does not show

- That the message was delivered or read. `provider_accepted` means the email provider accepted it for sending.
- Anything about the recipient's inbox, or the content of a message you cannot produce.

## Verify a receipt yourself

1. Fetch the public keys: `GET https://sentrisend.com/api/v1/receipts/keys`
2. Split the receipt at the dots. Read the `kid` in the first part and choose the key with that ID.
3. Check the Ed25519 signature over `header.payload` with that key.
4. To check the message, compute SHA-256 over:

```
sentrisend:public-send-receipt:v1:message\0<messageSalt>\0{"subject":...,"html":...,"text":...}
```

   and compare it to `messageCommitment`. `text` is left out if you did not supply it. The subject is trimmed by the server.

You can also paste a receipt and its opening into https://sentrisend.com/receipts. The comparison runs in your browser.

## Using the API

The API requires an `html` body on every send. The full request and response schema, authentication and error codes are in https://sentrisend.com/openapi.json.

Plans:

- Sandbox: free, no card, 100 requests per month. A Sandbox key sends only to its owner's verified address.
- Pro: $29 per month, 50,000 requests.

Both plans get receipts on single sends at no extra quota.

## Connecting an agent over MCP

Add the hosted server URL https://sentrisend.com/mcp to an MCP client that supports remote servers. It is also listed in the official MCP Registry as `com.sentrisend/validation`.

## Support

Contact details are on https://sentrisend.com.