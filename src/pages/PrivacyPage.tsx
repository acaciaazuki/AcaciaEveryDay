import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Icon } from '../components/AcaciaIcons'
import { PageHead } from '../components/PageHead'
import { CONTACT_EMAIL, EFFECTIVE_DATE, policyFor, UPDATED_DATE, type PolicyBlock } from './privacy/policy'

const LINK = /(https:\/\/[^\s）)、，。]+|\{email\})/g

/** 把段落裡的網址與 {email} 變成連結 */
function rich(text: string): ReactNode[] {
  return text.split(LINK).map((part, i) => {
    if (part === '{email}')
      return (
        <a key={i} href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-sage-dark underline underline-offset-2">
          {CONTACT_EMAIL}
        </a>
      )
    if (part.startsWith('https://'))
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer noopener" className="break-all text-sage-dark underline underline-offset-2">
          {part}
        </a>
      )
    return <Fragment key={i}>{part}</Fragment>
  })
}

function Block({ block }: { block: PolicyBlock }) {
  if (typeof block === 'string') return <p className="leading-relaxed">{rich(block)}</p>
  if ('sub' in block) return <h3 className="mt-2 font-bold text-sage-dark">{block.sub}</h3>
  return (
    <ul className="grid list-disc gap-1.5 pl-5 leading-relaxed marker:text-sage">
      {block.list.map((item, i) => (
        <li key={i}>{rich(item)}</li>
      ))}
    </ul>
  )
}

/** 隱私權政策（/privacy）：依目前語言顯示繁中、日文或英文全文 */
export function PrivacyPage() {
  const { t, i18n } = useTranslation()
  const doc = policyFor(i18n.resolvedLanguage)

  return (
    <>
      <PageHead eyebrow={doc.eyebrow} title={doc.title} />
      <div className="grid max-w-3xl gap-4 text-sm">
        <section className="rounded-(--radius-card) bg-paper p-6 shadow-card">
          <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>
              {doc.dates.effective}<time dateTime={EFFECTIVE_DATE}>{EFFECTIVE_DATE}</time>
            </span>
            <span>
              {doc.dates.updated}<time dateTime={UPDATED_DATE}>{UPDATED_DATE}</time>
            </span>
          </p>
          <h2 className="mb-2 font-bold">{doc.summaryTitle}</h2>
          <ul className="grid gap-2">
            {doc.summary.map((s, i) => (
              <li key={i} className="flex gap-2 rounded-(--radius-control) bg-sage-light/60 px-3 py-2 leading-relaxed">
                <Icon name="check" className="mt-0.5 shrink-0 text-sage" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>

        <nav aria-label={doc.toc} className="rounded-(--radius-card) bg-paper p-6 shadow-card">
          <h2 className="mb-2 font-bold">{doc.toc}</h2>
          <ol className="grid gap-1 text-xs min-[520px]:grid-cols-2">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="text-sage-dark hover:underline"
                >
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {doc.sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="grid scroll-mt-4 gap-3 rounded-(--radius-card) bg-paper p-6 shadow-card">
            <h2 id={`${s.id}-h`} className="text-base font-bold">
              {s.heading}
            </h2>
            {s.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </section>
        ))}

        <Link to="/settings" className="justify-self-start rounded-(--radius-control) border border-line bg-paper px-4 py-2.5 text-xs font-bold hover:bg-sage-light">
          {t('privacy.backToSettings')}
        </Link>
      </div>
    </>
  )
}
