'use client';

import { useState } from 'react';
import type { KitDocDTO } from '@/lib/types';
import { useAddFlashcard, useDeleteFlashcard, useUpdateFlashcard } from '@/lib/hooks';

export function FlashcardsEditor({ kitDoc }: { kitDoc: KitDocDTO }) {
  const kitId = kitDoc._id;
  const addFlashcard = useAddFlashcard(kitId);
  const updateFlashcard = useUpdateFlashcard(kitId);
  const deleteFlashcard = useDeleteFlashcard(kitId);

  const [showAdd, setShowAdd] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  const flashcards = kitDoc.kit.flashcards.filter((f) => !f.deleted);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await addFlashcard.mutateAsync({ front, back });
    setFront('');
    setBack('');
    setShowAdd(false);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-secondary" onClick={() => setShowAdd((s) => !s)}>
          {showAdd ? 'Cancel' : 'Add flashcard'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={submit} className="card mb-4 space-y-2">
          <textarea
            required
            className="input"
            rows={2}
            placeholder="Front"
            value={front}
            onChange={(e) => setFront(e.target.value)}
          />
          <textarea
            required
            className="input"
            rows={2}
            placeholder="Back"
            value={back}
            onChange={(e) => setBack(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={addFlashcard.isPending}>
            {addFlashcard.isPending ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}

      {flashcards.length === 0 ? (
        <p className="card text-center text-slate-500">No flashcards yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {flashcards.map((f) => (
            <FlashcardEditCard
              key={f.id}
              front={f.front}
              back={f.back}
              origin={f.origin}
              isEdited={f.isEdited}
              onSave={(patch) =>
                updateFlashcard.mutateAsync({ flashcardId: f.id, patch }).then(() => undefined)
              }
              onDelete={() => deleteFlashcard.mutateAsync(f.id).then(() => undefined)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FlashcardEditCard({
  front,
  back,
  origin,
  isEdited,
  onSave,
  onDelete,
}: {
  front: string;
  back: string;
  origin: string;
  isEdited: boolean;
  onSave: (patch: { front: string; back: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(front);
  const [b, setB] = useState(back);

  return (
    <li className="card">
      <div className="mb-2 flex gap-2">
        <span className="badge bg-slate-100 text-slate-600">
          {origin === 'user' ? 'User-added' : 'Generated'}
        </span>
        {isEdited && <span className="badge bg-blue-100 text-blue-700">Edited</span>}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea className="input" rows={2} value={f} onChange={(e) => setF(e.target.value)} />
          <textarea className="input" rows={2} value={b} onChange={(e) => setB(e.target.value)} />
          <div className="flex gap-2">
            <button
              className="btn-primary"
              onClick={async () => {
                await onSave({ front: f, back: b });
                setEditing(false);
              }}
            >
              Save
            </button>
            <button className="btn-secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium">{front}</p>
          <p className="mt-1 text-sm text-slate-600">{back}</p>
          <div className="mt-3 flex gap-2 text-xs">
            <button className="btn-secondary" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="btn-danger" onClick={onDelete}>
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  );
}
