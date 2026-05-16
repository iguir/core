import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineAcl } from '../../acl/define'
import { defineModule } from '../../module/define'
import { defineRoutes } from '../code'
import { generateOpenApi } from '../openapi'

const postsAcl = defineAcl({
    module: 'posts',
    permissions: ['posts.list', 'posts.create', 'posts.read'] as const,
    defaults: {},
})

const PostBody = z.object({ title: z.string().min(1), authorId: z.string() })

describe('generateOpenApi', () => {
    test('produces a valid 3.1 doc with paths, security, and request bodies', async () => {
        const apiRoutes = defineRoutes(({ r }) => {
            r.get('/', { auth: true, permission: 'posts.list' }, (c) =>
                c.json([]),
            )
            r.post(
                '/',
                { auth: true, permission: 'posts.create', body: PostBody },
                (c) => c.json({}),
            )
            r.get(
                '/:id',
                { permission: 'posts.read', param: z.object({ id: z.string() }) },
                (c) => c.json({}),
            )
        })

        // Builder is lazy — invoke `build` once to fill `declared`.
        await apiRoutes.build({} as never)

        const posts = defineModule({
            name: 'posts',
            acl: postsAcl,
            routes: { handler: apiRoutes, prefix: '/api/posts' },
        })

        const doc = generateOpenApi([posts], {
            info: { title: 'My API', version: '1.0.0' },
        })

        expect(doc.openapi).toBe('3.1.0')
        expect(doc.paths['/api/posts']).toBeDefined()
        expect(doc.paths['/api/posts']!.get).toBeDefined()
        expect(doc.paths['/api/posts']!.post).toBeDefined()
        expect(doc.paths['/api/posts/{id}']).toBeDefined()

        const getList = doc.paths['/api/posts']!.get!
        expect(getList.security).toEqual([{ bearerAuth: [] }])
        expect(getList['x-permission']).toBe('posts.list')
        expect(getList.responses['401']).toBeDefined()
        expect(getList.responses['403']).toBeDefined()

        const createPost = doc.paths['/api/posts']!.post!
        expect(createPost.requestBody?.required).toBe(true)
        const schema = createPost.requestBody?.content['application/json'].schema
        expect(schema).toMatchObject({
            type: 'object',
            properties: {
                title: { type: 'string' },
                authorId: { type: 'string' },
            },
        })

        const getOne = doc.paths['/api/posts/{id}']!.get!
        expect(getOne.parameters?.[0]).toMatchObject({
            name: 'id',
            in: 'path',
            required: true,
        })
    })
})
