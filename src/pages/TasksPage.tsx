import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/Button'
import { ColorSwatches, TextColorSwatches } from '../components/ColorSwatches'
import { Dialog } from '../components/Dialog'
import { Field } from '../components/Field'
import { PageHead } from '../components/PageHead'
import { DEFAULT_TEXT_COLOR } from '../core/categories'
import type { Task } from '../core/schema'
import { useOpenFromUrl } from '../hooks/useOpenFromUrl'
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
      <PageHead eyebrow={t('tasks.eyebrow')} title={t('tasks.title')} actions={<Button onClick={() => setEditing('new')}>{t('tasks.add')}</Button>} />

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
                          className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 text-[10px] text-white ${task.done ? 'border-sage bg-sage' : 'border-[#cfd8d3]'}`}
                        >
                          {task.done && '✓'}
                        </button>
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(task)}>
                          <h3 className={`font-bold ${task.done ? 'line-through opacity-50' : ''}`} style={{ color: task.titleColor }}>
                            {task.title}
                          </h3>
                          <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
                            {task.loc && <span>📍 {task.loc}</span>}
                            {(task.date || task.time) && (
                              <span>
                                🗓 {task.date} {task.time}
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
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('tasks.form.date')} type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
          <Field label={t('tasks.form.time')} type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} />
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
