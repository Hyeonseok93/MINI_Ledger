import { FormEvent, useEffect, useMemo, useState } from "react";
import { analyze, type FixedItem, type Income } from "./schedule";
import { SAMPLE } from "./sampleData";
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
  const [income, setIncome] = useState<Income>({ base: 0, months: {} });
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [storePath, setStorePath] = useState("");
  const [loaded, setLoaded] = useState(false);

  const stats = useMemo(() => analyze(items), [items]);

  async function refresh() {
    const [all, inc, paths] = await Promise.all([
      window.ledger.getAll(),
      window.ledger.getIncome(),
      window.ledger.getPaths(),
    ]);
    setItems(all);
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
      await window.ledger.upsert({
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
    } catch (err) {
      setError(String(err));
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

  async function loadSample() {
    for (const s of SAMPLE) await window.ledger.upsert({ ...s, note: s.note ?? "", active: true });
    await refresh();
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
            <Overview
              stats={stats}
              items={items}
              income={income}
              onAdd={() => setTab("ledger")}
              onSample={loadSample}
              onIncome={() => setTab("income")}
            />
          )}
          {loaded && tab === "income" && <IncomePage items={items} income={income} onSave={saveIncome} />}
          {loaded && tab === "ledger" && (
            <Ledger
              items={items}
              stats={stats}
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
