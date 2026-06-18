import ReactMarkdown, { type Components } from 'react-markdown'

/**
 * Mapeamento explicito de elementos markdown -> classes Tailwind no padrao
 * violeta/neutro do PROIN.
 *
 * Necessario porque o projeto NAO usa o plugin @tailwindcss/typography (sem
 * classes `prose`) e o preflight do Tailwind v4 zera estilos de titulos e
 * listas (`h1..h3`, `ul/ol/li`). Sem este mapeamento, envolver o texto em
 * <ReactMarkdown> renderizaria titulos e listas sem formatacao.
 *
 * Observacao de espacamento: o container raiz usa `space-y-2` (margin-bottom de
 * especificidade zero no Tailwind v4); as margens por elemento (`mt-*`, `my-*`)
 * tem precedencia e compoem o ritmo vertical sem conflito.
 */
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 text-base font-semibold text-neutral-900 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 text-sm font-semibold text-neutral-900 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 text-sm font-semibold text-neutral-900 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="text-sm leading-relaxed text-neutral-800">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed text-neutral-800">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-neutral-900">{children}</strong>,
  hr: () => <hr className="my-3 border-violet-100" />,
  code: ({ children }) => (
    <code className="rounded bg-violet-100/60 px-1 py-0.5 text-xs">{children}</code>
  ),
  a: ({ children, href }) => (
    <a href={href} className="text-violet-700 underline">
      {children}
    </a>
  ),
}

/**
 * Renderiza markdown de respostas de IA (negrito, titulos, regras horizontais,
 * listas) com formatacao consistente no padrao do PROIN.
 *
 * So apresentacao: nao altera o conteudo retornado pelo backend.
 */
export function AiMarkdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-neutral-800">
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  )
}
