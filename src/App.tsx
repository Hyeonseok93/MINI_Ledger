import { FormEvent, useEffect, useState } from "react";
import { type Assignments, type FixedItem, type Income, type ItemSet } from "./schedule";
import { WEEKDAYS_EN } from "./format";
import { emptyForm, type Form } from "./form";
import { Overview } from "./Overview";
import { Ledger } from "./LedgerPage";
import { IncomePage } from "./IncomePage";

type Tab = "overview" | "ledger" | "income";

const PAGES: Record<Tab, { index: string; title: string }> = {
  overview: { index: "01", title: "Overview" },
  ledger: { index: "02", title: "Ledger" },
  income: { index: "03", title: "Income" },
};

export default function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [items, setItems] = useState<FixedItem[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [sets, setSets] = useState<ItemSet[]>([]);
  const [income, setIncome] = useState<Income>({ base: 0, months: {} });
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [storePath, setStorePath] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    const [all, assigns, savedSets, inc, paths] = await Promise.all([
      window.ledger.getAll(),
      window.ledger.getAssignments(),
      window.ledger.getSets(),
      window.ledger.getIncome(),
      window.ledger.getPaths(),
    ]);
    setItems(all);
    setAssignments(assigns);
    setSets(savedSets);
    setIncome(inc);
    setStorePath(paths.storeDir);
    setLoaded(true);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const row = await window.ledger.upsert({
        id: editingId ?? undefined,
        name: form.name,
        amount: Number(form.amount.replace(/,/g, "")),
        cycle: form.cycle,
        day: Number(form.day),
        weekday: Number(form.weekday),
        month: Number(form.month),
        category: form.category,
        note: form.note,
        active: true,
      });
      setForm(emptyForm);
      setEditingId(null);
      await refresh();
      return row;
    } catch (err) {
      setError(String(err));
      return undefined;
    }
  }

  function startEdit(item: FixedItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      amount: String(item.amount),
      cycle: item.cycle,
      day: String(item.day),
      weekday: String(item.weekday),
      month: String(item.month),
      category: item.category,
      note: item.note || "",
    });
    setTab("ledger");
  }

  async function remove(id: string) {
    await window.ledger.remove(id);
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm);
    }
    await refresh();
  }

  async function saveIncome(next: Income) {
    try {
      setIncome(await window.ledger.setIncome(next));
    } catch (err) {
      setError(String(err));
    }
  }

  async function saveSet(name: string, itemIds: string[]) {
    try {
      setSets(await window.ledger.saveSet(name, itemIds));
      await refresh();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }

  async function removeSet(id: string) {
    try {
      setSets(await window.ledger.removeSet(id));
      await refresh();
    } catch (err) {
      setError(String(err));
    }
  }

  async function updateSet(id: string, patch: { name?: string; itemIds?: string[]; refreshItems?: boolean }) {
    try {
      setSets(await window.ledger.updateSet(id, patch));
      await refresh();
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }

  async function toggleSetMonth(setId: string, key: string) {
    try {
      setAssignments(await window.ledger.toggleSetMonth(setId, key));
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="shell">
      <aside className="rail">
        <nav>
          <NavItem index="01" label="개요" sub="Overview" on={tab === "overview"} onClick={() => setTab("overview")} />
          <NavItem index="02" label="장부" sub="Ledger" on={tab === "ledger"} onClick={() => setTab("ledger")} />
          <NavItem index="03" label="수입" sub="Income" on={tab === "income"} onClick={() => setTab("income")} />
        </nav>
        <div className="rail-foot">
          <span className="mono-label">Store</span>
          <code title={storePath}>{storePath ? "%APPDATA%/ledger" : "—"}</code>
          <span className="mono-label dim">v0.1</span>
        </div>
      </aside>

      <main className="stage">
        <div className="page">
          <PageHead {...PAGES[tab]} />
          {error && <p className="error">{error}</p>}
          {loaded && tab === "overview" && (
            <Overview items={items} income={income} assignments={assignments} onIncome={() => setTab("income")} />
          )}
          {loaded && tab === "income" && (
            <IncomePage items={items} income={income} assignments={assignments} onSave={saveIncome} />
          )}
          {loaded && tab === "ledger" && (
            <Ledger
              items={items}
              assignments={assignments}
              sets={sets}
              form={form}
              setForm={setForm}
              editingId={editingId}
              onSubmit={onSubmit}
              onCancel={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              onEdit={startEdit}
              onRemove={remove}
              onSaveSet={saveSet}
              onRemoveSet={removeSet}
              onUpdateSet={updateSet}
              onToggleSetMonth={toggleSetMonth}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function NavItem(props: { index: string; label: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={props.on ? "nav on" : "nav"} onClick={props.onClick}>
      <span className="nav-index">{props.index}</span>
      <span className="nav-label">{props.label}</span>
      <span className="nav-sub">{props.sub}</span>
    </button>
  );
}

function PageHead({ index, title }: { index: string; title: string }) {
  const now = new Date();
  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  return (
    <header className="page-head">
      <span className="mono-label">
        {index} — {title}
      </span>
      <span className="mono-label">
        {date} {WEEKDAYS_EN[now.getDay()]}
      </span>
    </header>
  );
}
