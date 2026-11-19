# AGENTS.md

## Project Context

This is a Base44 app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Base44 References

- CLI overview: https://docs.base44.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.base44.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update Base44 skills before Base44-specific work:

```bash
npx skills add base44/skills
```

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `base44 dev` as the default local development command when you need the local Base44 backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the Base44 project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `base44/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted Base44 backend.
- Prefer the existing Base44 CLI workflow over adding new npm scripts for Base44-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new Base44 integration paths.
- Run the relevant checks from `package.json` before finishing code changes.

## Wdrażanie funkcji Supabase Edge (obowiązkowe — od 19.11.2026)

- Funkcje wdrażaj wyłącznie metodą standardową: Management API `POST /v1/projects/<ref>/functions/deploy?slug=<nazwa>` (multipart), pliki ze ścieżkami `supabase/functions/<nazwa>/index.ts` i `supabase/functions/_shared/*.ts`, `entrypoint_path` = `supabase/functions/<nazwa>/index.ts`, `verify_jwt` bez zmian (payuNotification: false).
- NIE pakuj funkcji ręcznie do eszip i nie używaj entrypointu `functions/<nazwa>/index.ts` — 19.11.2026 tak spakowane funkcje nie startowały (BOOT_ERROR „relative URL without a base”), kasa nie działała ~40 min.
- Zaraz po każdym wdrożeniu uruchom `node docs/tech/sprawdz-funkcje.mjs <nazwy wdrożonych funkcji>` (bez argumentów sprawdza wszystkie). Wynik „BŁĄD” = natychmiast wdrożyć ponownie metodą standardową.
- Nie buduj i nie commituj `dist/` — robi to wyłącznie GitHub Actions.
