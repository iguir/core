{
    "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
    "files": {
        "ignoreUnknown": false,
        "ignore": ["dist", "drizzle", "node_modules"]
    },
    "formatter": {
        "enabled": true,
        "indentStyle": "space",
        "indentWidth": 4,
        "lineWidth": 100
    },
    "linter": {
        "enabled": true,
        "rules": {
            "recommended": true,
            "style": {
                "noRestrictedImports": {
                    "level": "error",
                    "options": {
                        "paths": {
                            "../*/!(*.contract).ts": "Cross-module imports must go through *.contract.ts. See docs/modules.md.",
                            "../*/!(*.contract)/**": "Cross-module imports must go through *.contract.ts. See docs/modules.md."
                        }
                    }
                }
            }
        }
    }
}
