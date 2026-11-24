import { Icon, IconBadge } from '../components/AcaciaIcons'
import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/Button'
import { ColorSwatches, TextColorSwatches } from '../components/ColorSwatches'
import { Dialog } from '../components/Dialog'
import { Field } from '../components/Field'
import { TimeField } from '../components/TimeField'
import { PageHead } from '../components/PageHead'
import { Toast } from '../components/Toast'
import { lowStockReminders } from '../core/inventory'
import { useInvCategories } from '../hooks/useInvCategories'
import { toLocalISO } from '../core/date'
import { useNow } from '../hooks/useNow'
import { DEFAULT_TEXT_COLOR } from '../core/categories'
import type { Task } from '../core/schema'
import { useOpenFromUrl } from '../hooks/useOpenFromUrl'
import { formatTime } from '../core/time'
import { useAppStore } from '../store/useAppStore'

type Draft = Omit<Task, 'id' | 'done'>
const blank: Draft = { title: '', loc: '', date: '', time: '', titleColor: DEFAULT_TEXT_COLOR, bgColor: '#ffffff' }

export function TasksPage() {
  const { t } = useTranslation()
  const tasks = useAppStore((s) => s.tasks)
  const toggleTask = useAppStore((s) => s.toggleTask)
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  useOpenFromUrl(tasks, setEditing)

  const pending = tasks.filter((x) => !x.done)
  const done = tasks.filter((x) => x.done)

  return (
    <>
      <PageHead title={t('tasks.title')} actions={<Button size="page" onClick={() => setEditing('new')}>{t('tasks.add')}</Button>} />

      <LowStockSection />

      {tasks.length === 0 ? (
        <div className="rounded-(--radius-card) bg-paper p-10 text-center text-muted shadow-card">{t('tasks.empty')}</div>
      ) : (
        <div className="grid gap-6">
          {[
            { label: t('tasks.pending'), list: pending },
            { label: t('tasks.completed'), list: done },
          ].map(
            (g) =>
              g.list.length > 0 && (
                <section key={g.label}>
                  <h2 className="mb-3 text-sm font-bold text-muted">
                    {g.label} · {g.list.length}
                  </h2>
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                    {g.list.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-start gap-3 rounded-(--radius-card) border border-line p-4 shadow-soft"
                        style={{ background: task.bgColor || '#fff' }}
                      >
                        <button
                          type="button"
                          aria-label={task.done ? t('tasks.markUndone') : t('tasks.markDone')}
                          onClick={() => toggleTask(task.id)}
                          className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 text-[length:calc(10px*var(--fs))] text-white ${task.done ? 'border-sage bg-sage' : 'border-[#cfd8d3]'}`}
                        >
                          {task.done && <Icon name="check" className="size-[1.3em]" />}
                        </button>
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(task)}>
                          <h3 className={`font-bold ${task.done ? 'line-through opacity-50' : ''}`} style={{ color: task.titleColor }}>
                            {task.title}
                          </h3>
                          <p className="mt-1 flex flex-wrap gap-x-3 text-[length:calc(11px*var(--fs))] text-muted">
                            {task.loc && (
                              <span className="inline-flex items-center gap-1">
                                <Icon name="pin" className="size-[1.5em]" /> {task.loc}
                              </span>
                            )}
                            {(task.date || task.time) && (
                              <span className="inline-flex items-center gap-1">
                                <Icon name="calendar" className="size-[1.5em]" /> {task.date} {formatTime(task.time)}
                              </span>
                            )}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ),
          )}
        </div>
      )}

      {editing && <TaskDialog key={editing === 'new' ? 'new' : editing.id} task={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

/**
 * 庫存不足提醒：不存成待辦，每次依庫存與購物清單即時算出來。
 * 補貨到安全庫存（例如購物清單打勾自動入庫）後就自動消失，不會留下殘留的待辦
 */
function LowStockSection() {
  const { t } = useTranslation()
  const inventory = useAppStore((s) => s.inventory)
  const shopping = useAppStore((s) => s.shopping)
  const addToShopping = useAppStore((s) => s.addInventoryToShopping)
  const cats = useInvCategories()
  const now = useNow()
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const list = lowStockReminders(inventory, shopping)
  if (list.length === 0) return toast ? <Toast message={toast} onDone={clearToast} /> : null
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <section className="mb-6 rounded-(--radius-card) border border-line bg-[#f3f8f4] p-4 shadow-soft" aria-labelledby="low-stock-title">
      <h2 id="low-stock-title" className="flex items-center gap-2 text-sm font-bold text-sage-dark">
        <Icon name="box" className="size-[1.4em]" />
        {t('tasks.lowStock.title')} · {list.length}
      </h2>
      <p className="mt-1 text-[length:calc(11px*var(--fs))] text-muted">{t('tasks.lowStock.hint')}</p>
      <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {list.map(({ item, need, pending }) => {
          const st = cats.of(item.cat)
          const unit = item.unit || t('inv.defaultUnit')
          return (
            <li key={item.id} className="grid content-start gap-2.5 rounded-xl border border-l-4 border-line bg-paper p-3.5" style={{ borderLeftColor: st.fg }}>
              <div className="flex items-start gap-3">
                <IconBadge name={st.icon} bg={st.bg} />
                <Link to={`/inventory?open=${item.id}`} className="min-w-0 flex-1" aria-label={t('tasks.lowStock.openItem', { name: item.name })}>
                  <strong className="block truncate text-sm">{item.name}</strong>
                  <small className="mt-0.5 block text-[length:calc(11px*var(--fs))] text-muted">
                    {t('tasks.lowStock.detail', { stock: item.stock, min: item.minStock, need, unit })}
                  </small>
                </Link>
              </div>
              {pending ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-(--radius-control) bg-sage-light px-3 py-1.5 text-xs font-bold text-sage-dark">
                    <Icon name="check" className="size-[1.2em]" />
                    {t('tasks.lowStock.inList', { count: pending.quantity ?? 1, unit })}
                  </span>
                  <Link to={`/shopping?open=${pending.id}`} className="ml-auto text-xs font-bold text-sage-dark underline-offset-2 hover:underline">
                    {t('tasks.lowStock.goShopping')}
                  </Link>
                </div>
              ) : (
                <Button
                  className="justify-self-end px-3! py-1.5!"
                  onClick={() => {
                    const n = addToShopping(item.id, toLocalISO(now), time)
                    if (n > 0) setToast(t('inv.toast.added', { name: item.name, count: n, unit }))
                  }}
                >
                  {t('inv.action.addToList', { count: need, unit })}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {toast && <Toast message={toast} onDone={clearToast} />}
    </section>
  )
}

function TaskDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { t } = useTranslation()
  const addTask = useAppStore((s) => s.addTask)
  const updateTask = useAppStore((s) => s.updateTask)
  const removeTask = useAppStore((s) => s.removeTask)
  const [draft, setDraft] = useState<Draft>(task ? { ...blank, ...task } : blank)
  const [error, setError] = useState('')
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) return setError(t('tasks.form.titleRequired'))
    const data = { ...draft, title, loc: draft.loc.trim() }
    if (task) updateTask(task.id, data)
    else addTask(data)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={task ? t('tasks.form.editTitle') : t('tasks.form.newTitle')}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t('tasks.form.title')} placeholder={t('tasks.form.titlePlaceholder')} value={draft.title} onChange={(e) => set({ title: e.target.value })} autoFocus />
        {error && <p className="-mt-2 text-xs text-[#c2583d]">{error}</p>}
        <Field label={t('tasks.form.loc')} value={draft.loc} onChange={(e) => set({ loc: e.target.value })} />
        <div className="grid gap-3 min-[30rem]:grid-cols-2">
          <Field label={t('tasks.form.date')} type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
          <TimeField optional label={t('tasks.form.time')} value={draft.time} onChange={(time) => set({ time })} />
        </div>
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('tasks.form.color')}
          <ColorSwatches label={t('tasks.form.color')} value={draft.bgColor} onChange={(c) => set({ bgColor: c.bg })} />
        </div>
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('tasks.form.textColor')}
          <TextColorSwatches label={t('tasks.form.textColor')} value={draft.titleColor ?? DEFAULT_TEXT_COLOR} onChange={(c) => set({ titleColor: c })} />
        </div>
        <div className="rounded-(--radius-control) border border-line px-4 py-3 text-sm font-bold" style={{ background: draft.bgColor || '#fff', color: draft.titleColor || DEFAULT_TEXT_COLOR }}>
          {draft.title || t('tasks.form.preview')}
        </div>
        <div className="mt-2 flex gap-2">
          {task && (
            <Button
              variant="danger"
              onClick={() => {
                removeTask(task.id)
                onClose()
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">{t('common.save')}</Button>
        </div>
      </form>
    </Dialog>
  )
}
