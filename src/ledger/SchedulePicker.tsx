import { quarterMonths, WEEKDAY_KO } from "../schedule";
import { DAYS, MONTHS, WEEK_ORDER } from "../format";
import { type Form } from "../form";
import { Select } from "../Select";

export function SchedulePicker({ form, setForm }: { form: Form; setForm: (f: Form) => void }) {
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
