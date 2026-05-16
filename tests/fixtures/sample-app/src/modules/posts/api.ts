import { z } from 'zod'
import { defineRoutes } from '../../../../../../src/routing/code'

const PostBody = z.object({ title: z.string().min(1) })

export const apiRoutes = defineRoutes(({ r }) => {
    r.get('/', { auth: true, permission: 'posts.list' }, (c) => c.json([]))
    r.post(
        '/',
        { auth: true, permission: 'posts.create', body: PostBody },
        (c) => c.json({}, 201),
    )
    r.delete(
        '/:id',
        {
            auth: true,
            permission: 'posts.delete',
            param: z.object({ id: z.string() }),
        },
        (c) => c.body(null, 204),
    )
    r.get('/health', {}, (c) => c.json({ ok: true }))
})
