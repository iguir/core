import { defineAcl } from '@iguir/core'

export const {{nameCamel}}Acl = defineAcl({
    module: '{{name}}',
    permissions: ['{{name}}.read'] as const,
    defaults: {
        // admin: ['*'],
    },
})
