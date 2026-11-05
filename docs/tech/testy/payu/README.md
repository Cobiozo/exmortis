# Testy PayU (kolejka, realizacja, migracja, proxy)

Uruchamiane poza aplikacją, w osobnym katalogu — nie zmieniają package.json ani dist/.

```bash
mkdir /tmp/payu-testy && cp -r docs/tech/testy/payu/* /tmp/payu-testy/ && cd /tmp/payu-testy
npm i @electric-sql/pglite@0.2.17 esbuild@0.24.0 express@4.21.2 compression@1.7.5
cp <repo>/docs/tech/migracje/2026-11-05_payu.sql migration.sql
S=<repo>/supabase/functions/_shared; mkdir -p out
node build.mjs $S/payuQueue.ts out/q.mjs 1 && node build.mjs $S/orders.ts out/o.mjs && node build.mjs $S/fulfillOrder.ts out/f.mjs && node build.mjs $S/seats.ts out/seats.mjs
node run.mjs                      # migracja (2×), RLS, kolejka, realizacja, alerty, wznowienie, is_test, limity miejsc
mkdir -p proxy/dist && cp <repo>/server.js proxy/server.mjs && echo '<html></html>' > proxy/dist/index.html && ln -s ../node_modules proxy/node_modules
node proxy_test.mjs               # /functions/payuNotification przez server.js: body, OpenPayu-Signature, klucz anon, odpowiedź
```

Baza: PGlite (Postgres 17 w pamięci) ze strukturą odwzorowaną z inspekcji produkcji 5.11.2026 (setup.sql), dane syntetyczne.
PayU: atrapa fetch (OAuth, GET /api/v2_1/orders/{id}). Poczta i realizacja: atrapy (mocks/).
