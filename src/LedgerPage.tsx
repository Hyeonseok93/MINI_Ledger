import { FormEvent, ReactNode, useMemo } from "react";
import {
  CYCLE_LABEL,
  CYCLES,
  daysUntil,
  nextOccurrence,
  perMonth,
  quarterMonths,
  whenLabel,
  WEEKDAY_KO,
  type Analytics,
  type Cycle,
  type FixedItem,
} from "./schedule";
import { CATEGORIES, DAYS, MONTHS, NOTE_MAX, WEEK_ORDER, num, pad2 } from "./format";
import { type Form } from "./form";
import { Select } from "./Select";

type LedgerProps = {
  items: FixedItem[];
  stats: Analytics;
  form: Form;
  setForm: (f: Form) => void;
  editingId: string | null;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  onEdit: (it: FixedItem) => void;
  onRemove: (id: string) => void;
};

export function Ledger(p: LedgerProps) {
  const { form, setForm } = p;
  const rows = useMemo(
    () =>
      p.items
        .map((it) => {
          const next = nextOccurrence(it);
          return { it, next, dday: daysUntil(next) };
        })
        .sort((a, b) => a.dday - b.dday || perMonth(b.it) - perMonth(a.it)),
    [p.items]
  );

  return (
    <>
      <section className="ledger-head">
        <h1>
          {p.items.length}
          <small>건</small>
        </h1>
        <p>
          월 환산 합계 <strong>₩{num(p.stats.monthlyTotal)}</strong>
        </p>
      </section>

      <form className={p.editingId ? "entry editing" : "entry"} onSubmit={p.onSubmit}>
        <Field label="항목">
          <input
            required
            aria-label="항목"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="금액 (₩)">
          <input
            required
            aria-label="금액"
            inputMode="numeric"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="num"
          />
        </Field>
        <Field label="주기">
          <Select
            value={form.cycle}
            options={CYCLES}
            onChange={(v) => setForm({ ...form, cycle: v as Cycle })}
            ariaLabel="주기"
          />
        </Field>
        <Field label="납부 시점">
          <SchedulePicker form={form} setForm={setForm} />
        </Field>
        <Field label="분류">
          <Select
            value={form.category}
            options={(CATEGORIES.includes(form.category) ? CATEGORIES : [form.category, ...CATEGORIES]).map((c) => ({
              value: c,
              label: c,
            }))}
            onChange={(v) => setForm({ ...form, category: v })}
            columns={2}
            ariaLabel="분류"
          />
        </Field>
        <Field label="메모">
          <input
            aria-label="메모"
            value={form.note}
            maxLength={NOTE_MAX}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder={`최대 ${NOTE_MAX}자`}
          />
        </Field>
        <div className="entry-actions">
          {p.editingId && (
            <button type="button" className="btn ghost" onClick={p.onCancel}>
              취소
            </button>
          )}
          <button type="submit" className="btn primary">
            {p.editingId ? "저장" : "추가"}
          </button>
        </div>
      </form>

      <div className="sheet">
        <div className="sheet-row sheet-head">
          <span className="s-when">Next</span>
          <span className="s-item">Item</span>
          <span className="s-cat">Category</span>
          <span className="s-cycle">Cycle</span>
          <span className="s-amt">Amount / mo</span>
        </div>
        {rows.map(({ it, next, dday }) => (
          <div key={it.id} className={p.editingId === it.id ? "sheet-row selected" : "sheet-row"}>
            <span className="s-when" title={whenLabel(it)}>
              {pad2(next.getMonth() + 1)}.{pad2(next.getDate())}
              <em>{WEEKDAY_KO[next.getDay()]}</em>
            </span>
            <span className="s-item">{it.name}</span>
            <span className="s-cat">{it.category}</span>
            <span className="s-cycle">{CYCLE_LABEL[it.cycle]}</span>
            <span className="s-amt">₩{num(perMonth(it))}</span>
            <span className="s-ops">
              <button type="button" onClick={() => p.onEdit(it)}>
                수정
              </button>
              <button type="button" className="danger" onClick={() => p.onRemove(it.id)}>
                삭제
              </button>
            </span>
            <span className={dday === 0 ? "s-dday now" : "s-dday"}>{dday === 0 ? "TODAY" : `D−${dday}`}</span>
            <span className="s-note">{it.note}</span>
            <span className="s-sub">{it.cycle === "monthly" ? "" : `${CYCLE_LABEL[it.cycle]} ₩${num(it.amount)}`}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="sheet-empty">위 입력줄에서 첫 고정비를 추가하세요.</p>}
      </div>
    </>
  );
}

function SchedulePicker({ form, setForm }: { form: Form; setForm: (f: Form) => void }) {
  const daySelect = (
    <Select
      value={form.day}
      options={DAYS.map((d) => ({ value: String(d), label: `${d}일`, short: String(d) }))}
      onChange={(v) => setForm({ ...form, day: v })}
      columns={7}
      ariaLabel="결제일"
    />
  );

  switch (form.cycle) {
    case "daily":
      return <span className="field-static">매일 결제</span>;
    case "weekly":
      return (
        <Select
          value={form.weekday}
          options={WEEK_ORDER.map((w) => ({ value: String(w), label: `${WEEKDAY_KO[w]}요일` }))}
          onChange={(v) => setForm({ ...form, weekday: v })}
          ariaLabel="요일"
        />
      );
    case "monthly":
      return daySelect;
    case "quarterly":
      return (
        <div className="field-pair">
          <Select
            value={String(((Number(form.month) - 1) % 3) + 1)}
            options={[1, 2, 3].map((m) => ({ value: String(m), label: quarterMonths(m).join("·") }))}
            onChange={(v) => setForm({ ...form, month: v })}
            ariaLabel="분기 월"
          />
          {daySelect}
        </div>
      );
    case "yearly":
      return (
        <div className="field-pair">
          <Select
            value={form.month}
            options={MONTHS.map((m) => ({ value: String(m), label: `${m}월` }))}
            onChange={(v) => setForm({ ...form, month: v })}
            columns={4}
            ariaLabel="월"
          />
          {daySelect}
        </div>
      );
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}
