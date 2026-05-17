import { defineAcl } from '@iguir/core/acl/define'

export const {{nameCamel}}Acl = defineAcl({
    module: '{{name}}',
    permissions: ['{{name}}.read'] as const,
    defaults: {
        // admin: ['*'],
    },
})
