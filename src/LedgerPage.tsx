import { FormEvent, ReactNode, useMemo, useState } from "react";
import {
  CYCLE_LABEL,
  CYCLES,
  isAssigned,
  monthKey,
  perMonth,
  quarterMonths,
  whenLabel,
  WEEKDAY_KO,
  type Analytics,
  type Assignments,
  type Cycle,
  type FixedItem,
  type ItemSet,
} from "./schedule";
import { CATEGORIES, DAYS, INCOME_START, MONTHS, NOTE_MAX, WEEK_ORDER, num, pad2 } from "./format";
import { type Form } from "./form";
import { Select } from "./Select";

type SortKey = "name" | "category" | "cycle" | "amount";

const CYCLE_ORDER: Record<Cycle, number> = {
  daily: 0,
  weekly: 1,
  monthly: 2,
  quarterly: 3,
  yearly: 4,
};

type LedgerProps = {
  items: FixedItem[];
  stats: Analytics;
  assignments: Assignments;
  sets: ItemSet[];
  form: Form;
  setForm: (f: Form) => void;
  editingId: string | null;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  onEdit: (it: FixedItem) => void;
  onRemove: (id: string) => void;
  onSaveSet: (name: string) => Promise<void>;
  onRemoveSet: (id: string) => Promise<void>;
  onUpdateSet: (id: string, patch: { name?: string; itemIds?: string[]; refreshItems?: boolean }) => Promise<void>;
  onToggleSetMonth: (setId: string, monthKey: string) => Promise<void>;
};

export function Ledger(p: LedgerProps) {
  const { form, setForm } = p;
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [setName, setSetName] = useState("");
  const [setHint, setSetHint] = useState("");
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editItemIds, setEditItemIds] = useState<string[]>([]);
  const [editHint, setEditHint] = useState("");
  const [assignYear, setAssignYear] = useState(() => Math.max(INCOME_START.year, new Date().getFullYear()));
  const [saving, setSaving] = useState(false);

  const selectedSet = p.sets.find((s) => s.id === selectedSetId) ?? null;
  const firstMonth = assignYear === INCOME_START.year ? INCOME_START.month : 1;
  const assignMonths = MONTHS.filter((m) => m >= firstMonth);

  const rows = useMemo(() => {
    const list = [...p.items];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, "ko");
      else if (sortKey === "category") cmp = a.category.localeCompare(b.category, "ko") || a.name.localeCompare(b.name, "ko");
      else if (sortKey === "cycle") cmp = CYCLE_ORDER[a.cycle] - CYCLE_ORDER[b.cycle] || a.name.localeCompare(b.name, "ko");
      else cmp = perMonth(a) - perMonth(b) || a.name.localeCompare(b.name, "ko");
      return cmp * dir;
    });
    return list;
  }, [p.items, sortKey, sortDir]);

  function clickSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "amount" ? "desc" : "asc");
    }
  }

  function sortMark(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function setAppliedToMonth(set: ItemSet, year: number, month1: number) {
    const ids = set.itemIds.filter((id) => p.items.some((it) => it.id === id));
    if (!ids.length) return false;
    return ids.every((id) => isAssigned(p.assignments, id, year, month1));
  }

  const nameTaken = (name: string, excludeId?: string | null) => {
    const label = name.trim().toLowerCase();
    if (!label) return false;
    return p.sets.some((s) => s.id !== excludeId && s.name.trim().toLowerCase() === label);
  };

  async function handleSaveSet(e: FormEvent) {
    e.preventDefault();
    const label = setName.trim();
    if (!label || !p.items.length || saving) return;
    if (nameTaken(label)) {
      setSetHint("같은 이름의 세트가 이미 있어요");
      return;
    }
    setSaving(true);
    setSetHint("");
    try {
      await p.onSaveSet(label);
      setSetName("");
    } catch (err) {
      const msg = String(err);
      setSetHint(msg.includes("duplicate") ? "같은 이름의 세트가 이미 있어요" : msg);
    } finally {
      setSaving(false);
    }
  }

  function startEditSet(s: ItemSet) {
    setEditingSetId(s.id);
    setEditName(s.name);
    setEditItemIds(s.itemIds.filter((id) => p.items.some((it) => it.id === id)));
    setEditHint("");
    setSelectedSetId(s.id);
  }

  function toggleEditItem(id: string) {
    setEditItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setEditHint("");
  }

  async function commitEditSet(e: FormEvent) {
    e.preventDefault();
    if (!editingSetId) return;
    const label = editName.trim();
    if (!label) {
      setEditHint("이름을 입력해 주세요");
      return;
    }
    if (nameTaken(label, editingSetId)) {
      setEditHint("같은 이름의 세트가 이미 있어요");
      return;
    }
    if (!editItemIds.length) {
      setEditHint("항목을 하나 이상 선택해 주세요");
      return;
    }
    try {
      await p.onUpdateSet(editingSetId, { name: label, itemIds: editItemIds });
      setEditingSetId(null);
      setEditHint("");
    } catch (err) {
      const msg = String(err);
      setEditHint(msg.includes("duplicate") ? "같은 이름의 세트가 이미 있어요" : msg);
    }
  }

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

      <div className="sheet sheet-ledger">
        <div className="sheet-row sheet-head">
          <button type="button" className="s-item sort-h" onClick={() => clickSort("name")}>
            Item{sortMark("name")}
          </button>
          <button type="button" className="s-cat sort-h" onClick={() => clickSort("category")}>
            Category{sortMark("category")}
          </button>
          <button type="button" className="s-cycle sort-h" onClick={() => clickSort("cycle")}>
            Cycle{sortMark("cycle")}
          </button>
          <button type="button" className="s-amt sort-h" onClick={() => clickSort("amount")}>
            Amount / mo{sortMark("amount")}
          </button>
        </div>
        {rows.map((it) => (
          <div key={it.id} className={p.editingId === it.id ? "sheet-row selected" : "sheet-row"}>
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
            <span className="s-note">{it.note}</span>
            <span className="s-sub">
              {whenLabel(it)}
              {it.cycle !== "monthly" ? ` · ₩${num(it.amount)}` : ""}
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="sheet-empty">위 입력줄에서 첫 고정비를 추가하세요.</p>}
      </div>

      <section className="sets-panel">
        <div className="sets-head">
          <span className="mono-label">Saved sets</span>
          <p>지금 장부 전체를 이름으로 저장한 뒤, 세트를 눌러 적용할 달을 고르세요.</p>
        </div>

        <form className="set-save" onSubmit={handleSaveSet}>
          <div className="set-save-field">
            <input
              value={setName}
              onChange={(e) => {
                setSetName(e.target.value);
                setSetHint("");
              }}
              placeholder="세트 이름"
              maxLength={40}
              aria-label="세트 이름"
              className={setHint ? "bad" : undefined}
            />
            {setHint && <span className="set-hint">{setHint}</span>}
          </div>
          <button
            type="submit"
            className="btn primary"
            disabled={!setName.trim() || !p.items.length || saving || nameTaken(setName)}
          >
            세트 저장
          </button>
        </form>

        <ul className="set-list">
          {p.sets.map((s) => {
            const on = selectedSetId === s.id;
            const editing = editingSetId === s.id;
            const count = s.itemIds.filter((id) => p.items.some((it) => it.id === id)).length;
            return (
              <li key={s.id} className={editing ? "set-row editing" : on ? "set-row on" : "set-row"}>
                {editing ? (
                  <form className="set-edit" onSubmit={commitEditSet}>
                    <div className="set-edit-name">
                      <input
                        autoFocus
                        value={editName}
                        maxLength={40}
                        onChange={(e) => {
                          setEditName(e.target.value);
                          setEditHint("");
                        }}
                        aria-label="세트 이름 수정"
                        className={editHint ? "bad" : undefined}
                      />
                      <div className="set-edit-actions">
                        <button type="submit" className="set-act primary">
                          저장
                        </button>
                        <button
                          type="button"
                          className="set-act"
                          onClick={() => {
                            setEditingSetId(null);
                            setEditHint("");
                          }}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                    <div className="set-edit-items">
                      <span className="mono-label">Items in set · {editItemIds.length}</span>
                      <ul>
                        {p.items.map((it) => {
                          const checked = editItemIds.includes(it.id);
                          return (
                            <li key={it.id}>
                              <label className={checked ? "on" : undefined}>
                                <input type="checkbox" checked={checked} onChange={() => toggleEditItem(it.id)} />
                                <span className="nm">{it.name}</span>
                                <span className="meta">
                                  {it.category} · ₩{num(perMonth(it))}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                      {p.items.length === 0 && <p className="set-empty">장부에 항목이 없습니다.</p>}
                    </div>
                    {editHint && <span className="set-hint">{editHint}</span>}
                  </form>
                ) : (
                  <>
                    <button type="button" className="set-pick" onClick={() => setSelectedSetId(on ? null : s.id)}>
                      <strong>{s.name}</strong>
                      <span className="set-count">
                        <b>{count}</b>
                        <i>항목</i>
                      </span>
                    </button>
                    <div className="set-ops">
                      <button type="button" onClick={() => startEditSet(s)}>
                        수정
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          if (selectedSetId === s.id) setSelectedSetId(null);
                          if (editingSetId === s.id) setEditingSetId(null);
                          p.onRemoveSet(s.id);
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
          {p.sets.length === 0 && <li className="set-empty">저장된 세트가 없습니다.</li>}
        </ul>

        {selectedSet && (
          <div className="assign-panel">
            <div className="assign-head">
              <div>
                <span className="mono-label">Apply set · months</span>
                <h2>{selectedSet.name}</h2>
                <p>
                  <b>{selectedSet.itemIds.filter((id) => p.items.some((it) => it.id === id)).length}</b> 항목 · 달을
                  누르면 개요·수입에 반영
                </p>
              </div>
              <div className="year-switch">
                <button
                  type="button"
                  onClick={() => setAssignYear(assignYear - 1)}
                  disabled={assignYear <= INCOME_START.year}
                  aria-label="이전 해"
                >
                  ‹
                </button>
                <span>{assignYear}</span>
                <button type="button" onClick={() => setAssignYear(assignYear + 1)} aria-label="다음 해">
                  ›
                </button>
              </div>
            </div>
            <div
              className={assignMonths.length < 12 ? "assign-months partial" : "assign-months"}
              style={
                assignMonths.length < 12
                  ? { gridTemplateColumns: `repeat(${assignMonths.length}, minmax(0, 1fr))` }
                  : undefined
              }
            >
              {assignMonths.map((m) => {
                const key = monthKey(assignYear, m);
                const on = setAppliedToMonth(selectedSet, assignYear, m);
                return (
                  <button
                    type="button"
                    key={key}
                    className={on ? "assign-cell on" : "assign-cell"}
                    onClick={() => p.onToggleSetMonth(selectedSet.id, key)}
                  >
                    <span className="mono-label">{pad2(m)}</span>
                    <strong>{on ? "적용" : "—"}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
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
