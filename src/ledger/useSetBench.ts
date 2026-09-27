import { FormEvent, useEffect, useRef, useState } from "react";
import type { FixedItem, ItemSet } from "../schedule";

type Args = {
  items: FixedItem[];
  sets: ItemSet[];
  onCancel: () => void;
  onRemove: (id: string) => Promise<void> | void;
  onSaveSet: (name: string, itemIds: string[]) => Promise<void>;
  onUpdateSet: (id: string, patch: { name?: string; itemIds?: string[] }) => Promise<void>;
  onSubmit: (e: FormEvent) => Promise<FixedItem | undefined> | void;
};

export function useSetBench({ items, sets, onCancel, onRemove, onSaveSet, onUpdateSet, onSubmit }: Args) {
  const [setName, setSetName] = useState("");
  const [setHint, setSetHint] = useState("");
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [workIds, setWorkIds] = useState<string[]>([]);
  const [editHint, setEditHint] = useState("");
  const [saving, setSaving] = useState(false);

  const setEditing = !!editingSetId;
  const liveWorkIds = workIds.filter((id) => items.some((it) => it.id === id));
  const selectedSet = sets.find((s) => s.id === selectedSetId) ?? null;
  const nameHint = setEditing ? editHint : setHint;

  const workIdsRef = useRef(workIds);
  const setsRef = useRef(sets);
  const onRemoveRef = useRef(onRemove);
  workIdsRef.current = workIds;
  setsRef.current = sets;
  onRemoveRef.current = onRemove;

  /** Drop bench items that are not members of any saved set. */
  async function discardDraftItems(ids: string[], setList: ItemSet[] = sets) {
    const owned = new Set(setList.flatMap((s) => s.itemIds));
    for (const id of ids) {
      if (!owned.has(id)) await onRemoveRef.current(id);
    }
  }

  // Leave Ledger tab / unmount → purge unsaved drafts so they don't linger in ledger.json
  useEffect(() => {
    return () => {
      const owned = new Set(setsRef.current.flatMap((s) => s.itemIds));
      const drafts = workIdsRef.current.filter((id) => !owned.has(id));
      for (const id of drafts) void onRemoveRef.current(id);
    };
  }, []);

  const nameTaken = (name: string, excludeId?: string | null) => {
    const label = name.trim().toLowerCase();
    if (!label) return false;
    return sets.some((s) => s.id !== excludeId && s.name.trim().toLowerCase() === label);
  };

  function clearBench() {
    setWorkIds([]);
    setEditingSetId(null);
    setSetName("");
    setEditHint("");
    setSetHint("");
    onCancel();
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
      await onSaveSet(label, ids);
      clearBench();
    } catch (err) {
      const msg = String(err);
      setSetHint(msg.includes("duplicate") ? "같은 이름의 세트가 이미 있어요" : msg);
    } finally {
      setSaving(false);
    }
  }

  function startEditSet(s: ItemSet) {
    const drafts = workIds.filter((id) => !sets.some((set) => set.itemIds.includes(id)));
    if (drafts.length) void discardDraftItems(drafts);
    onCancel();
    setEditingSetId(s.id);
    setSetName(s.name);
    setWorkIds(s.itemIds.filter((id) => items.some((it) => it.id === id)));
    setEditHint("");
    setSetHint("");
    setSelectedSetId(s.id);
  }

  async function cancelEditSet() {
    const drafts = workIds.filter((id) => !sets.some((set) => set.itemIds.includes(id)));
    if (drafts.length) await discardDraftItems(drafts);
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
      await onUpdateSet(editingSetId, { name: label, itemIds: ids });
      clearBench();
    } catch (err) {
      const msg = String(err);
      setEditHint(msg.includes("duplicate") ? "같은 이름의 세트가 이미 있어요" : msg);
    }
  }

  async function handleItemSubmit(e: FormEvent) {
    const row = await onSubmit(e);
    if (row?.id) {
      setWorkIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
      setEditHint("");
    }
  }

  async function handleItemRemove(id: string) {
    setWorkIds((prev) => prev.filter((x) => x !== id));
    // Even while editing: delete store rows that aren't in any saved set (new drafts).
    // Members already in a set stay until commit (dropReleasedOrphans) or cancel (kept).
    const owned = sets.some((s) => s.itemIds.includes(id));
    if (!owned) await onRemove(id);
  }

  return {
    setName,
    setSetName,
    setHint,
    setSetHint,
    setEditHint,
    selectedSetId,
    setSelectedSetId,
    editingSetId,
    workIds,
    saving,
    setEditing,
    liveWorkIds,
    selectedSet,
    nameHint,
    nameTaken,
    handleSaveSet,
    startEditSet,
    cancelEditSet,
    commitEditSet,
    handleItemSubmit,
    handleItemRemove,
  };
}
