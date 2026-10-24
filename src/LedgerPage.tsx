import { FormEvent, useMemo, useState } from "react";
import {
  CYCLE_LABEL,
  isAssigned,
  monthKey,
  perMonth,
  whenLabel,
  type Assignments,
  type Cycle,
  type FixedItem,
  type ItemSet,
} from "./schedule";
import { BUCKETS, BUCKET_LABEL, INCOME_START, bucketOf, monthsInYear, num, pad2 } from "./format";
import { type Form } from "./form";
import { EntryForm } from "./ledger/EntryForm";
import { useSetBench } from "./ledger/useSetBench";

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
  onUpdateSet: (id: string, patch: { name?: string; itemIds?: string[] }) => Promise<void>;
  onToggleSetMonth: (setId: string, monthKey: string) => Promise<void>;
};

export function Ledger(p: LedgerProps) {
  const { form, setForm } = p;
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [assignYear, setAssignYear] = useState(() => Math.max(INCOME_START.year, new Date().getFullYear()));

  const bench = useSetBench({
    items: p.items,
    sets: p.sets,
    onCancel: p.onCancel,
    onRemove: p.onRemove,
    onSaveSet: p.onSaveSet,
    onUpdateSet: p.onUpdateSet,
    onSubmit: p.onSubmit,
  });

  const assignMonths = monthsInYear(assignYear);

  const rows = useMemo(() => {
    const source = p.items.filter((it) => bench.workIds.includes(it.id));
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
  }, [p.items, sortKey, sortDir, bench.workIds]);

  const selectedSetItems = useMemo(() => {
    if (!bench.selectedSet) return [];
    return bench.selectedSet.itemIds
      .map((id) => p.items.find((it) => it.id === id))
      .filter((it): it is FixedItem => !!it);
  }, [bench.selectedSet, p.items]);

  /** Monthly-equivalent amount of the selected set, per bucket. */
  const setBuckets = useMemo(() => {
    const totals = { spend: 0, save: 0, give: 0 };
    for (const it of selectedSetItems) totals[bucketOf(it.category)] += perMonth(it);
    return totals;
  }, [selectedSetItems]);

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

  /** Removing a set also deletes items no other set holds (dropReleasedOrphans), so say how many. */
  function confirmRemoveSet(set: ItemSet) {
    const others = new Set(p.sets.filter((s) => s.id !== set.id).flatMap((s) => s.itemIds));
    const doomed = set.itemIds.filter((id) => !others.has(id) && p.items.some((it) => it.id === id)).length;
    return window.ledger.confirm({
      message: `'${set.name}' 세트를 삭제할까요?`,
      detail: doomed
        ? `이 세트에만 있는 항목 ${doomed}개도 함께 삭제되고, 달별 적용 기록에서도 빠집니다. 되돌릴 수 없습니다.`
        : "세트 안의 항목은 다른 세트에도 있어서 그대로 남습니다.",
      confirmLabel: "삭제",
    });
  }

  function setAppliedToMonth(set: ItemSet, year: number, month1: number) {
    const ids = set.itemIds.filter((id) => p.items.some((it) => it.id === id));
    if (!ids.length) return false;
    return ids.every((id) => isAssigned(p.assignments, id, year, month1));
  }

  return (
    <>
      <section className="ledger-head">
        <h1>
          {p.items.length}
          <small>건</small>
        </h1>
        <p>
          {bench.setEditing ? (
            <>
              세트 수정 중 <strong>{bench.setName || "…"}</strong> · {bench.liveWorkIds.length}건
            </>
          ) : bench.liveWorkIds.length ? (
            <>
              작업대 <strong>{bench.liveWorkIds.length}건</strong> · 세트에 묶을 항목을 정리한 뒤 아래에서 저장하세요.
            </>
          ) : p.items.length ? (
            <>모든 항목이 세트에 들어 있습니다. 새 항목은 위에서 추가하세요.</>
          ) : (
            <>위에서 항목을 추가해 세트를 만드세요.</>
          )}
        </p>
      </section>

      <EntryForm
        form={form}
        setForm={setForm}
        editingId={p.editingId}
        onSubmit={bench.handleItemSubmit}
        onCancel={p.onCancel}
      />

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
            <span className={`s-cat b-${bucketOf(it.category)}`}>{it.category}</span>
            <span className="s-cycle">{CYCLE_LABEL[it.cycle]}</span>
            <span className="s-amt">₩{num(perMonth(it))}</span>
            <span className="s-ops">
              <button type="button" onClick={() => p.onEdit(it)}>
                수정
              </button>
              <button type="button" className="danger" onClick={() => bench.handleItemRemove(it.id)}>
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
            {bench.setEditing
              ? "이 세트에 항목이 없습니다. 위에서 추가하세요."
              : "세트에 넣을 항목이 없습니다. 위에서 추가하세요."}
          </p>
        )}
      </div>

      <section className="sets-panel">
        <div className="sets-head">
          <span className="mono-label">Saved sets</span>
          <p>
            {bench.setEditing
              ? "세트 항목을 고친 뒤 아래에서 저장하세요."
              : "위 작업대 항목을 이름으로 저장한 뒤, 세트를 눌러 적용할 달을 고르세요."}
          </p>
        </div>

        {bench.setEditing ? (
          <form className="set-save set-save-edit" onSubmit={bench.commitEditSet}>
            <div className="set-save-field">
              <input
                value={bench.setName}
                onChange={(e) => {
                  bench.setSetName(e.target.value);
                  bench.setEditHint("");
                }}
                placeholder="세트 이름"
                maxLength={40}
                aria-label="세트 이름"
                className={bench.nameHint ? "bad" : undefined}
              />
              {bench.nameHint && <span className="set-hint">{bench.nameHint}</span>}
            </div>
            <button type="submit" className="btn primary">
              저장
            </button>
            <button type="button" className="btn ghost" onClick={() => void bench.cancelEditSet()}>
              취소
            </button>
          </form>
        ) : (
          <form className="set-save" onSubmit={bench.handleSaveSet}>
            <div className="set-save-field">
              <input
                value={bench.setName}
                onChange={(e) => {
                  bench.setSetName(e.target.value);
                  bench.setSetHint("");
                }}
                placeholder="세트 이름"
                maxLength={40}
                aria-label="세트 이름"
                className={bench.nameHint ? "bad" : undefined}
              />
              {bench.nameHint && <span className="set-hint">{bench.nameHint}</span>}
            </div>
            <button
              type="submit"
              className="btn primary"
              disabled={!bench.setName.trim() || !bench.liveWorkIds.length || bench.saving || bench.nameTaken(bench.setName)}
            >
              세트 저장
            </button>
          </form>
        )}

        <ul className="set-list">
          {p.sets.map((s) => {
            const on = bench.selectedSetId === s.id;
            const editing = bench.editingSetId === s.id;
            const count = editing
              ? bench.liveWorkIds.length
              : s.itemIds.filter((id) => p.items.some((it) => it.id === id)).length;
            return (
              <li key={s.id} className={editing || on ? "set-row on" : "set-row"}>
                <button
                  type="button"
                  className="set-pick"
                  onClick={() => {
                    if (bench.setEditing) return;
                    bench.setSelectedSetId(on ? null : s.id);
                  }}
                >
                  <strong>{editing ? bench.setName || s.name : s.name}</strong>
                  <span className="set-count">
                    <b>{count}</b>
                    <i>항목</i>
                  </span>
                </button>
                {!bench.setEditing && (
                  <div className="set-ops">
                    <button type="button" onClick={() => bench.startEditSet(s)}>
                      수정
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={async () => {
                        if (!(await confirmRemoveSet(s))) return;
                        if (bench.selectedSetId === s.id) bench.setSelectedSetId(null);
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

        {bench.selectedSet && !bench.setEditing && (
          <div className="assign-panel">
            <div className="assign-head">
              <div>
                <span className="mono-label">Apply set · months</span>
                <h2>{bench.selectedSet.name}</h2>
                <p>
                  <b>{selectedSetItems.length}</b> 항목
                  {BUCKETS.filter((b) => setBuckets[b] > 0).map((b) => (
                    <span key={b} className={`assign-bucket b-${b}`}>
                      {" "}
                      · {BUCKET_LABEL[b]} ₩{num(setBuckets[b])}/월
                    </span>
                  ))}{" "}
                  · 달을 누르면 개요·수입에 반영
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
                const on = setAppliedToMonth(bench.selectedSet!, assignYear, m);
                return (
                  <button
                    type="button"
                    key={key}
                    className={on ? "assign-cell on" : "assign-cell"}
                    onClick={() => p.onToggleSetMonth(bench.selectedSet!.id, key)}
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
                        <span className={`b-${bucketOf(it.category)}`}>{it.category}</span>
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
