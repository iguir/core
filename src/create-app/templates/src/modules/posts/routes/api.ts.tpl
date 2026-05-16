import { z } from 'zod'
import { defineRoutes } from '@iguir/core/routing/code'
import { NotFoundError } from '@iguir/core/errors'
import type { PostsService } from '../services/index'

const CreatePostBody = z.object({
    title: z.string().min(1).max(200),
    body: z.string().default(''),
})

export function createApiRoutes(service: PostsService) {
    return defineRoutes(({ r }) => {
        r.get('/health', {}, (c) => c.json({ ok: true }))

        r.get('/', { auth: true, permission: 'posts.list' }, (c) =>
            c.json(service.list()),
        )

        r.get(
            '/:id',
            { auth: true, permission: 'posts.list', param: z.object({ id: z.string() }) },
            (c) => {
                const { id } = c.req.valid('param' as never) as { id: string }
                const post = service.findById(id)
                if (!post) throw new NotFoundError(`post "${id}" not found`)
                return c.json(post)
            },
        )

        r.post(
            '/',
            { auth: true, permission: 'posts.create', body: CreatePostBody },
            (c) => {
                const input = c.req.valid('json' as never) as {
                    title: string
                    body: string
                }
                const user = c.get('user')
                const created = service.create({
                    title: input.title,
                    body: input.body,
                    authorId: user?.id ?? 'unknown',
                })
                return c.json(created, 201)
            },
        )

        r.delete(
            '/:id',
            { auth: true, permission: 'posts.delete', param: z.object({ id: z.string() }) },
            (c) => {
                const { id } = c.req.valid('param' as never) as { id: string }
                const ok = service.delete(id)
                if (!ok) throw new NotFoundError(`post "${id}" not found`)
                return c.body(null, 204)
            },
        )
    })
}
