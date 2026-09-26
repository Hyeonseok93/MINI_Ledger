import { FormEvent } from "react";
import { CYCLES, type Cycle } from "../schedule";
import { CATEGORIES, NOTE_MAX } from "../format";
import { type Form } from "../form";
import { Select } from "../Select";
import { SchedulePicker } from "./SchedulePicker";
import { Field } from "./Field";

type Props = {
  form: Form;
  setForm: (f: Form) => void;
  editingId: string | null;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
};

export function EntryForm({ form, setForm, editingId, onSubmit, onCancel }: Props) {
  return (
    <form className={editingId ? "entry editing" : "entry"} onSubmit={onSubmit}>
      <Field label="항목">
        <input required aria-label="항목" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
        <Select value={form.cycle} options={CYCLES} onChange={(v) => setForm({ ...form, cycle: v as Cycle })} ariaLabel="주기" />
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
        <button type="submit" className="btn primary">
          {editingId ? "저장" : "추가"}
        </button>
        {editingId && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </form>
  );
}
