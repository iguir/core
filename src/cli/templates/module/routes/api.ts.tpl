import { defineRoutes } from '@iguir/core/routing/code'

export const apiRoutes = defineRoutes(({ r }) => {
    r.get('/', { auth: true, permission: '{{name}}.read' }, (c) =>
        c.json({ items: [] }),
    )
})
