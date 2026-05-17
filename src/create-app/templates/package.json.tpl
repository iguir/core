{
    "name": "{{name}}",
    "version": "0.1.0",
    "type": "module",
    "private": true,
    "scripts": {
        "dev": "bun --hot src/main.ts",
        "start": "bun src/main.ts",
        "build": "bun build src/main.ts --target=bun --outdir=dist",
        "test": "bun test",
        "routes": "bunx iguir routes",
        "acl": "bunx iguir acl",
        "openapi": "bunx iguir openapi --out openapi.json"
    },
    "dependencies": {
        "@iguir/core": "{{coreVersion}}",
        "drizzle-orm": "^0.45.2",
        "hono": "^4.12.18",
        "pino": "^10.3.1",
        "zod": "^4.4.3"
    },
    "devDependencies": {
        "@biomejs/biome": "^1.9.4",
        "@types/bun": "latest",
        "typescript": "^5",
        "vite": "^7.1.13"
    }
}
