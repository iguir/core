import { defineRoutes } from '@iguir/core'

export const apiRoutes = defineRoutes(({ r }) => {
    r.get('/', { auth: true, permission: '{{name}}.read' }, (c) =>
        c.json({ items: [] }),
    )
})
