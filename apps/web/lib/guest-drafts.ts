export type GuestDraftForm = Record<string, string | boolean>;

export type GuestDraftPhoto = {
  id: string;
  name: string;
  type: string;
  lastModified: number;
  file: Blob;
};

export type GuestMemorialDraft = {
  id: string;
  name: string;
  updatedAt: string;
  step: 0 | 1;
  form: GuestDraftForm;
  photos: GuestDraftPhoto[];
  previewPhotoId: string | null;
};

const DB_NAME = "memorial_guest_drafts";
const DB_VERSION = 1;
const STORE_NAME = "drafts";

const openDraftDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("Черновики недоступны в этом браузере"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error ?? new Error("Не удалось открыть черновики"));
    request.onsuccess = () => resolve(request.result);
  });

const runDraftTransaction = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void
) => {
  const db = await openDraftDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let request: IDBRequest<T> | void;
    transaction.oncomplete = () => {
      db.close();
      if (!request) {
        resolve(undefined as T);
      }
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("Ошибка черновика"));
    };
    request = action(store);
    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Ошибка черновика"));
    }
  });
};

export const saveGuestMemorialDraft = (draft: GuestMemorialDraft) =>
  runDraftTransaction("readwrite", (store) => store.put(draft));

export const getGuestMemorialDraft = (id: string) =>
  runDraftTransaction<GuestMemorialDraft | undefined>("readonly", (store) =>
    store.get(id) as IDBRequest<GuestMemorialDraft | undefined>
  );

export const listGuestMemorialDrafts = async () => {
  const drafts = await runDraftTransaction<GuestMemorialDraft[]>("readonly", (store) =>
    store.getAll() as IDBRequest<GuestMemorialDraft[]>
  );
  return [...drafts].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
};

export const deleteGuestMemorialDraft = (id: string) =>
  runDraftTransaction("readwrite", (store) => {
    store.delete(id);
  });
