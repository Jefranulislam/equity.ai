# Equity.AI — production-style container image (workerd via vite preview).
FROM oven/bun:1.2 AS build
WORKDIR /app

# Restore dependencies first (layer cache) — lockfile ensures reproducibility
COPY package.json bun.lock package-lock.json ./
RUN bun install --frozen-lockfile

# Build-time injected browser variables (Vite bakes these into the client bundle)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

COPY . .
RUN bun run build

FROM oven/bun:1.2
WORKDIR /app
COPY --from=build /app /app

# Server-side secrets are provided at runtime (docker compose environment);
# workerd reads them from dist/server/.dev.vars, so we regenerate it on start,
# then launch the compiled production worker locally.
EXPOSE 8787
CMD ["sh", "-c", "printf 'SUPABASE_URL=%s\\nSUPABASE_PUBLISHABLE_KEY=%s\\nSUPABASE_SERVICE_ROLE_KEY=%s\\nLOVABLE_API_KEY=%s\\nAI_API_KEY=%s\\nAI_BASE_URL=%s\\nAI_MODEL=%s\\n' \"$SUPABASE_URL\" \"$SUPABASE_PUBLISHABLE_KEY\" \"$SUPABASE_SERVICE_ROLE_KEY\" \"$LOVABLE_API_KEY\" \"$AI_API_KEY\" \"$AI_BASE_URL\" \"$AI_MODEL\" > dist/server/.dev.vars && exec bun x wrangler dev --config dist/server/wrangler.json --port 8787 --ip 0.0.0.0"]
