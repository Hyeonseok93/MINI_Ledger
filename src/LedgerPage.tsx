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
  assignments: Assignments;
  sets: ItemSet[];
  form: Form;
  setForm: (f: Form) => void;
  editingId: string | null;
  onSubmit: (e: FormEvent) => Promise<FixedItem | undefined> | void;
  onCancel: () => void;
  onEdit: (it: FixedItem) => void;
  onRemove: (id: string) => Promise<void> | void;
  onSaveSet: (name: string, itemIds: string[]) => Promise<void>;
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
  /** Working bench for building / editing a set — empty by default. */
  const [workIds, setWorkIds] = useState<string[]>([]);
  const [editHint, setEditHint] = useState("");
  const [assignYear, setAssignYear] = useState(() => Math.max(INCOME_START.year, new Date().getFullYear()));
  const [saving, setSaving] = useState(false);

  const selectedSet = p.sets.find((s) => s.id === selectedSetId) ?? null;
  const firstMonth = assignYear === INCOME_START.year ? INCOME_START.month : 1;
  const assignMonths = MONTHS.filter((m) => m >= firstMonth);
  const setEditing = !!editingSetId;
  const liveWorkIds = workIds.filter((id) => p.items.some((it) => it.id === id));

  const rows = useMemo(() => {
    const source = p.items.filter((it) => workIds.includes(it.id));
    const list = [...source];
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
  }, [p.items, sortKey, sortDir, workIds]);

  const selectedSetItems = useMemo(() => {
    if (!selectedSet) return [];
    return selectedSet.itemIds
      .map((id) => p.items.find((it) => it.id === id))
      .filter((it): it is FixedItem => !!it);
  }, [selectedSet, p.items]);

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

  function clearBench() {
    setWorkIds([]);
    setEditingSetId(null);
    setSetName("");
    setEditHint("");
    setSetHint("");
    p.onCancel();
  }

  async function discardDraftItems(ids: string[]) {
    const owned = new Set(p.sets.flatMap((s) => s.itemIds));
    for (const id of ids) {
      if (!owned.has(id)) await p.onRemove(id);
    }
  }

  async function handleSaveSet(e: FormEvent) {
    e.preventDefault();
    const label = setName.trim();
    const ids = liveWorkIds;
    if (!label || !ids.length || saving || setEditing) return;
    if (nameTaken(label)) {
      setSetHint("같은 이름의 세트가 이미 있어요");
      return;
    }
    setSaving(true);
    setSetHint("");
    try {
      await p.onSaveSet(label, ids);
      clearBench();
    } catch (err) {
      const msg = String(err);
      setSetHint(msg.includes("duplicate") ? "같은 이름의 세트가 이미 있어요" : msg);
    } finally {
      setSaving(false);
    }
  }

  function startEditSet(s: ItemSet) {
    const drafts = workIds.filter((id) => !p.sets.some((set) => set.itemIds.includes(id)));
    if (drafts.length) void discardDraftItems(drafts);
    p.onCancel();
    setEditingSetId(s.id);
    setSetName(s.name);
    setWorkIds(s.itemIds.filter((id) => p.items.some((it) => it.id === id)));
    setEditHint("");
    setSetHint("");
    setSelectedSetId(s.id);
  }

  async function cancelEditSet() {
    clearBench();
  }

  async function commitEditSet(e: FormEvent) {
    e.preventDefault();
    if (!editingSetId) return;
    const label = setName.trim();
    if (!label) {
      setEditHint("이름을 입력해 주세요");
      return;
    }
    if (nameTaken(label, editingSetId)) {
      setEditHint("같은 이름의 세트가 이미 있어요");
      return;
    }
    const ids = liveWorkIds;
    if (!ids.length) {
      setEditHint("세트에 항목이 하나도 없어요");
      return;
    }
    try {
      await p.onUpdateSet(editingSetId, { name: label, itemIds: ids });
      clearBench();
    } catch (err) {
      const msg = String(err);
      setEditHint(msg.includes("duplicate") ? "같은 이름의 세트가 이미 있어요" : msg);
    }
  }

  async function handleItemSubmit(e: FormEvent) {
    const row = await p.onSubmit(e);
    if (row?.id) {
      setWorkIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
      setEditHint("");
    }
  }

  /** Bench remove: detach only while editing a set; delete draft only if no set owns it. */
  async function handleItemRemove(id: string) {
    setWorkIds((prev) => prev.filter((x) => x !== id));
    if (setEditing) return;
    const owned = p.sets.some((s) => s.itemIds.includes(id));
    if (!owned) await p.onRemove(id);
  }

  const nameHint = setEditing ? editHint : setHint;
  const setNameValue = setName;

  return (
    <>
      <section className="ledger-head">
        <h1>
          {liveWorkIds.length}
          <small>건</small>
        </h1>
        <p>
          {setEditing ? (
            <>
              세트 수정 중 <strong>{setNameValue || "…"}</strong>
            </>
          ) : liveWorkIds.length ? (
            <>세트에 묶을 항목을 정리한 뒤 아래에서 저장하세요.</>
          ) : (
            <>위에서 항목을 추가해 세트를 만드세요.</>
          )}
        </p>
      </section>

      <form className={p.editingId ? "entry editing" : "entry"} onSubmit={handleItemSubmit}>
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
          <button type="submit" className="btn primary">
            {p.editingId ? "저장" : "추가"}
          </button>
          {p.editingId && (
            <button type="button" className="btn ghost" onClick={p.onCancel}>
              취소
            </button>
          )}
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
              <button type="button" className="danger" onClick={() => handleItemRemove(it.id)}>
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
        {rows.length === 0 && (
          <p className="sheet-empty">
            {setEditing
              ? "이 세트에 항목이 없습니다. 위에서 추가하세요."
              : "세트에 넣을 항목이 없습니다. 위에서 추가하세요."}
          </p>
        )}
      </div>

      <section className="sets-panel">
        <div className="sets-head">
          <span className="mono-label">Saved sets</span>
          <p>
            {setEditing
              ? "세트 항목을 고친 뒤 아래에서 저장하세요."
              : "위 작업대 항목을 이름으로 저장한 뒤, 세트를 눌러 적용할 달을 고르세요."}
          </p>
        </div>

        {setEditing ? (
          <form className="set-save set-save-edit" onSubmit={commitEditSet}>
            <div className="set-save-field">
              <input
                value={setNameValue}
                onChange={(e) => {
                  setSetName(e.target.value);
                  setEditHint("");
                }}
                placeholder="세트 이름"
                maxLength={40}
                aria-label="세트 이름"
                className={nameHint ? "bad" : undefined}
              />
              {nameHint && <span className="set-hint">{nameHint}</span>}
            </div>
            <button type="submit" className="btn primary">
              저장
            </button>
            <button type="button" className="btn ghost" onClick={cancelEditSet}>
              취소
            </button>
          </form>
        ) : (
          <form className="set-save" onSubmit={handleSaveSet}>
            <div className="set-save-field">
              <input
                value={setNameValue}
                onChange={(e) => {
                  setSetName(e.target.value);
                  setSetHint("");
                }}
                placeholder="세트 이름"
                maxLength={40}
                aria-label="세트 이름"
                className={nameHint ? "bad" : undefined}
              />
              {nameHint && <span className="set-hint">{nameHint}</span>}
            </div>
            <button
              type="submit"
              className="btn primary"
              disabled={!setNameValue.trim() || !liveWorkIds.length || saving || nameTaken(setNameValue)}
            >
              세트 저장
            </button>
          </form>
        )}

        <ul className="set-list">
          {p.sets.map((s) => {
            const on = selectedSetId === s.id;
            const editing = editingSetId === s.id;
            const count = editing
              ? liveWorkIds.length
              : s.itemIds.filter((id) => p.items.some((it) => it.id === id)).length;
            return (
              <li key={s.id} className={editing || on ? "set-row on" : "set-row"}>
                <button
                  type="button"
                  className="set-pick"
                  onClick={() => {
                    if (setEditing) return;
                    setSelectedSetId(on ? null : s.id);
                  }}
                >
                  <strong>{editing ? setNameValue || s.name : s.name}</strong>
                  <span className="set-count">
                    <b>{count}</b>
                    <i>항목</i>
                  </span>
                </button>
                {!setEditing && (
                  <div className="set-ops">
                    <button type="button" onClick={() => startEditSet(s)}>
                      수정
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        if (selectedSetId === s.id) setSelectedSetId(null);
                        p.onRemoveSet(s.id);
                      }}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          {p.sets.length === 0 && <li className="set-empty">저장된 세트가 없습니다.</li>}
        </ul>

        {selectedSet && !setEditing && (
          <div className="assign-panel">
            <div className="assign-head">
              <div>
                <span className="mono-label">Apply set · months</span>
                <h2>{selectedSet.name}</h2>
                <p>
                  <b>{selectedSetItems.length}</b> 항목 · 달을 누르면 개요·수입에 반영
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

            <div className="assign-items">
              <span className="mono-label">Set items</span>
              {selectedSetItems.length === 0 ? (
                <p className="assign-items-empty">이 세트에 항목이 없습니다.</p>
              ) : (
                <ul>
                  {selectedSetItems.map((it) => (
                    <li key={it.id}>
                      <div className="ai-main">
                        <strong>{it.name}</strong>
                        <span className="ai-amt">₩{num(perMonth(it))}</span>
                      </div>
                      <div className="ai-sub">
                        <span>{it.category}</span>
                        <span>{CYCLE_LABEL[it.cycle]}</span>
                        <span>{whenLabel(it)}</span>
                        {it.note ? <span>{it.note}</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
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
