import katex from 'katex'
import 'katex/dist/katex.min.css'

/** Text with inline maths: anything between $…$ is rendered by KaTeX, the rest stays plain text. */
export function Tex({ children }: { children: string }) {
  const parts = children.split(/\$([^$]+)\$/) // odd indexes are maths
  if (parts.length === 1) return <>{children}</>
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          // trust: false (default) keeps \href, \url etc. off; bad LaTeX shows red source instead of throwing
          <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(p, { throwOnError: false }) }} />
        ) : (
          p
        ),
      )}
    </>
  )
}
