# serialized-ring-ops

One serialized smart ring, from manifest line to delivery, on fictional orders. NestJS, TypeScript and real PostgreSQL. "Aldane" is a made-up brand; every name, address, date and ring ID here is made up too.

This is a slice that runs on fictional data. It is not a production system and it is connected to nothing.

## Run it

```
docker compose up --build
```

Then open http://localhost:4104 for the packing slip, with the API on the same port. PostgreSQL runs in a container on ephemeral storage and is seeded on startup with three fictional orders.

Try the wrong ring against the API while it runs:

```
curl -s -X POST localhost:4104/orders/104/scan -H 'content-type: application/json' \
  -d '{"ringId":"c17d0b52-92ee-4a08-b3f1-70ae6d2c3a90"}'
curl -s localhost:4104/orders/104/why
```

## Check it

```
docker compose run --build --rm tests   # full suite on PostgreSQL; fails under 95% coverage
docker compose run --build --rm race    # replays the races, writes reports/race-report.json
```

Stop everything with `docker compose down`. On a machine with the standalone binary, `docker-compose` takes the same arguments.

`reports/coverage/` and `reports/race-report.json` hold the recorded results the page prints. To run without Docker, set `DATABASE_URL` to an empty PostgreSQL database you don't mind wiping, then use `npm test` and `npm run race`. `src/main.ts`, the server start, is the one file left out of coverage.

## The reservation rule

Our assumption for this demo: for a given size, the oldest recorded full-size request gets the oldest ring that was received, is available and passed QA; the rank is assigned when the request is durably recorded, under a lock common to that size.

- No `SKIP LOCKED` in attribution: a ring that is briefly locked must not look absent.
- Whoever's connection runs the attribution, the queue decides who gets the ring, not the caller. See `src/allocation/allocator.ts`.
- Rings with the same intake date go by `intake_at ASC, uuid ASC`, so the result never varies.
- A paid order with no size reserves nothing, and an order not yet paid cannot send one.
- A cancel releases the ring and hands it to the oldest waiting order in one transaction.
- A size and a cancel on one order take the same locks in the same order: the order row, then the size. Tests hold each lock open and check that the request waits, and `test/fuzz.pg.spec.ts` plus an HTTP test fire the requests together and check that no cancelled order holds a ring and no ring is left free while an order waits. Those runs found nothing; they don't prove the absence of every interleaving.

## What the race tests force

`test/support/scenarios.ts`, run by both the Jest suite and the race report, on test orders #501 and #502, not the fictional orders on the page's slip:

| Scenario | What must happen |
| --- | --- |
| Forced order: A records first, B's connection takes the lock first | A gets the ring, B waits, one reservation |
| Stock order: an old ring failed QA, two eligible rings of different dates | the older of the two eligible rings goes out |
| Release: the lock holder rolls back while another connection waits | the waiter looks again and serves the ring |
| Cancel: A cancels | B gets the ring without sending its size again |
| Open race: twelve orders, one ring, no forced order | one reservation, eleven waiting |
| A size and a cancel on one order, with another order also asking | no cancelled order holds a ring, no ring is stranded |
| Witness: the forced-order test with the queue read backwards | the right-winner check fails on every run |

## The scan check

`src/shared/scan-check.ts` is imported by NestJS and bundled unchanged as `site/shared.js` for the page; a test compares the bytes. It compares the whole ID. The last four characters are only for reading.

A wrong scan blocks validation of the parcel. The label may already exist, and it stays. On an order already packed, a wrong scan is rejected and the parcel can still leave. `Ready for carrier handoff` appears only when the parcel is validated and labelled; without a label the scan says one is missing, and the handoff is refused until there is one. Label created, handed to carrier and delivered are three separate states, and the sizer's parcel is a separate table: "sizer delivered" never marks the ring delivered.

`GET /orders/:id/why` lists the order's refused and repeated scans with the ID scanned, along with its label and sizer lines. A refused scan does not enter the history of the ring that was scanned.

## Channels and what is not connected

| Channel | Status in this repository |
| --- | --- |
| Stripe | Webhook replayed locally with a test signature: verified by the official SDK, altered body refused, two simultaneous deliveries give one order, an unpaid checkout records no payment until the delayed payment succeeds |
| Shopify | Webhook replayed locally with a test HMAC: same three checks, an order with no ID refused, one webhook ID on two orders refused |
| CSV manifest | Works; replaying a file adds no unit, duplicate lines are rejected, a file without its header is refused |
| Carrier (Shippo-shaped) | Interface and fake in `src/channels/fake-providers.ts`; not connected |
| Printer (PrintNode-shaped) | Interface and fake in the same file; not connected |
| Amazon | Left out of this slice |
| Bluetooth | Not part of this slice; the flow stops at the answer of `GET /units/:uuid/pairing-eligibility` |

Packing history is only ever inserted into by the application code. No test proves a database role can't alter it, so this repository promises nothing more than that.

## API

| Route | Purpose |
| --- | --- |
| `POST /manifests` `{csv}` | Import `uuid,size,lot` |
| `POST /units/:uuid/intake` | Scan a ring in |
| `POST /units/:uuid/qa` `{result}` | `passed` or `failed` |
| `GET /units/:uuid/history` | Packing history of a ring |
| `GET /units/:uuid/pairing-eligibility` | Eligibility answer |
| `POST /orders/:id/size` `{size}` | Record the request, then attribute |
| `POST /orders/:id/cancel` | Release and hand over |
| `GET /orders/:id/slip` | Slip and pick list |
| `GET /orders/:id/why` | Why this ring |
| `POST /orders/:id/label` | Create a label once (fake carrier and printer) |
| `POST /orders/:id/scan` `{ringId}` | Packing scan |
| `POST /orders/:id/handoff` | Hand to carrier (simulated) |
| `POST /orders/:id/delivered` | Ring delivered (simulated) |
| `POST /orders/:id/sizer-delivered` | Sizer delivered (simulated) |
| `POST /webhooks/stripe`, `POST /webhooks/shopify` | Signed order intake |

## Rebuilding the page

`page/` holds the page source. `npm run export:state` runs the real services over the seed and writes `page/demo-state.json`. `npm run build:page` builds `site/` from it and from the recorded reports.

MIT license.
