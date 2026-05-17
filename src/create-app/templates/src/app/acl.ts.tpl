import { defineRoles } from '@iguir/core'

export const roles = defineRoles({
    admin: { description: 'Full access; cannot be removed.', system: true },
    editor: { description: 'Can create and edit content.' },
    viewer: { description: 'Read-only access.' },
    customer: { description: 'Default role for new sign-ups.' },
})
