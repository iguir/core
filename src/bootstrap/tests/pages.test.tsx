import { describe, expect, test } from 'bun:test'
import { defineRoles } from '../../acl/roles'
import { defineModule } from '../../module/define'
import { testApp } from '../../testing/index'
import type { PageProps } from '../../jsx/types'

const roles = defineRoles({ admin: { description: 'admin' } })

describe('bootstrap pages wiring', () => {
    test('mounts a module pages manifest end-to-end', async () => {
        const blog = defineModule({
            name: 'blog',
            pages: {
                manifest: {
                    'index': { component: () => <h1>blog home</h1> },
                    'posts/[id]': {
                        component: ({ params }: PageProps) => (
                            <p>id={params.id}</p>
                        ),
                    },
                },
                prefix: '/blog',
            },
        })

        const app = await testApp({ roles, modules: [blog] })

        // Hono's app.route('/blog', sub) means the sub-app's `/` is reached
        // via `/blog` (no trailing slash). This is opposite to the
        // app.route + non-index case — call out as a future routing polish item.
        const home = await app.request('/blog')
        expect(home.status).toBe(200)
        expect(await home.text()).toContain('<h1>blog home</h1>')

        const post = await app.request('/blog/posts/7')
        expect(post.status).toBe(200)
        expect(await post.text()).toContain('id=7')

        await app.shutdown()
    })

    test('rejects a malformed pages manifest at defineModule', () => {
        expect(() =>
            defineModule({
                name: 'blog',
                // @ts-expect-error — wrong shape
                pages: { manifest: 'not an object', prefix: '/blog' },
            }),
        ).toThrow(/pages\.manifest must be an object/)
    })
})
