export const meta = { title: 'Blog home' }
export const loader = () => ({ posts: ['a', 'b'] })
export default function Page() {
    return <main>blog</main>
}
