'use client'

import { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import type { DocumentoMedio, NavScreen } from '@/lib/types';
import { subscribeDocumentos, createDocumento } from '@/lib/mediaService';
import { uploadFileWithTask, validateFile, generateMediaFilePath } from '@/lib/fileUpload';
import { updateDocumentoMedio } from '@/lib/firestore';
import { getFriendlyErrorMessage } from '@/lib/ocr';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { getDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UploadTask {
  id: string;
  fileName: string;
  progress: number;
  status: 'subiendo' | 'exito' | 'error' | 'cancelado';
  error?: string;
  storagePath?: string;
  url?: string;
}

interface InboxTabProps {
  companyId: string;
  onNavigate?: (screen: NavScreen) => void;
}

type BatchDocStatus = 'pending' | 'processing' | 'done' | 'error' | 'cancelled';
type BatchOcrProgress = Record<string, { status: BatchDocStatus; error?: string }>;

type BatchAction =
  | { type: 'START_BATCH'; docIds: string[] }
  | { type: 'START_DOC'; docId: string }
  | { type: 'FINISH_DOC'; docId: string }
  | { type: 'FAIL_DOC'; docId: string; error: string }
  | { type: 'CANCEL_BATCH' }
  | { type: 'CLEAR_PROGRESS' }
  | { type: 'DISMISS_DOC'; docId: string };

function batchReducer(state: BatchOcrProgress, action: BatchAction): BatchOcrProgress {
  switch (action.type) {
    case 'START_BATCH': {
      const next: BatchOcrProgress = {};
      for (const id of action.docIds) next[id] = { status: 'pending' };
      return { ...state, ...next };
    }
    case 'START_DOC':
      return { ...state, [action.docId]: { status: 'processing' } };
    case 'FINISH_DOC':
      return { ...state, [action.docId]: { status: 'done' } };
    case 'FAIL_DOC':
      return { ...state, [action.docId]: { status: 'error', error: action.error } };
    case 'CANCEL_BATCH': {
      const next: BatchOcrProgress = {};
      for (const [id, p] of Object.entries(state)) {
        if (p.status === 'pending' || p.status === 'processing') {
          next[id] = { status: 'cancelled' };
        } else {
          next[id] = p;
        }
      }
      return next;
    }
    case 'CLEAR_PROGRESS':
      return {};
    case 'DISMISS_DOC': {
      const next = { ...state };
      delete next[action.docId];
      return next;
    }
    default:
      return state;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InboxTab({ companyId, onNavigate }: InboxTabProps) {
  const [documentos, setDocumentos] = useState<DocumentoMedio[]>([]);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [dropActive, setDropActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchOcrProgress, dispatch] = useReducer(batchReducer, {});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTasksRef = useRef<Map<string, import('firebase/storage').UploadTask>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const documentosRef = useRef(documentos);
  const selectedIdsRef = useRef(selectedIds);

  // Sync refs with latest state for async closures
  useEffect(() => { documentosRef.current = documentos; }, [documentos]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  // Cancel all active uploads on unmount
  useEffect(() => {
    return () => {
      activeTasksRef.current.forEach((task) => task.cancel());
      activeTasksRef.current.clear();
    };
  }, []);

  // Cancel all in-flight OCR requests on unmount
  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((c) => c.abort());
      abortControllersRef.current.clear();
    };
  }, []);

  // Real-time subscription to documentos
  useEffect(() => {
    const unsub = subscribeDocumentos(
      companyId,
      { status: 'por_clasificar', source: 'inbox-upload' },
      (docs) => setDocumentos(docs),
      () => {},
    );
    return () => unsub();
  }, [companyId]);

  // ── Selection ────────────────────────────────────────────────────────────

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 30) return prev;
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const visibleIds = documentos.map((d) => d.id);
    const allSelected = visibleIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        let count = next.size;
        for (const id of visibleIds) {
          if (!next.has(id) && count < 30) {
            next.add(id);
            count++;
          }
        }
        return next;
      });
    }
  }, [documentos, selectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ── Upload ───────────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File): Promise<void> => {
    const userId = 'current';

    const validation = validateFile(file);
    if (!validation.valid) {
      toast.error(`${file.name}: ${validation.error}`);
      return;
    }

    const taskId = crypto.randomUUID();
    const storagePath = generateMediaFilePath(companyId, file.name);

    const task: UploadTask = {
      id: taskId,
      fileName: file.name,
      progress: 0,
      status: 'subiendo',
      storagePath,
    };
    setUploadTasks((prev) => [...prev, task]);

    let uploadCompleted = false;
    const onProgress = (progress: number) => {
      if (!uploadCompleted) {
        setUploadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, progress: Math.min(progress, 99), status: 'subiendo' as const }
              : t,
          ),
        );
      }
    };

    try {
      const { promise: uploadPromise, task: firebaseTask } = uploadFileWithTask(file, storagePath, onProgress);
      activeTasksRef.current.set(taskId, firebaseTask);

      const uploadResult = await uploadPromise;
      uploadCompleted = true;

      setUploadTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, progress: 100, status: 'subiendo' as const }
            : t,
        ),
      );

      await createDocumento(
        companyId,
        {
          fileName: file.name,
          storagePath: uploadResult.path,
          url: uploadResult.url,
          size: file.size,
          mimeType: file.type,
          status: 'por_clasificar',
          ejecucionIds: [],
          _source: 'inbox-upload',
          createdBy: userId,
        },
        userId,
        'inbox-upload',
      );

      setUploadTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: 'exito', progress: 100, url: uploadResult.url }
            : t,
        ),
      );

      toast.success(`${file.name} subido`);
    } catch (err) {
      if (err instanceof Error && err.message === 'canceled') return;
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setUploadTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: 'error', error: message }
            : t,
        ),
      );
      toast.error(`Error al subir ${file.name}`);
    } finally {
      activeTasksRef.current.delete(taskId);
    }
  }, [companyId]);

  const processFiles = useCallback((files: File[]) => {
    const activeNames = new Set(uploadTasks.map(t => t.fileName));
    const nuevos = files.filter(f => !activeNames.has(f.name));
    if (nuevos.length < files.length) {
      toast(`${files.length - nuevos.length} archivo(s) ya están en la cola`);
    }
    if (nuevos.length === 0) return;

    Promise.allSettled(nuevos.map((file) => processFile(file))).then((results) => {
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) toast.error(`${failed} archivo(s) fallaron`);

      setTimeout(() => {
        setUploadTasks((prev) =>
          prev.filter((t) => t.status === 'subiendo'),
        );
      }, 5000);
    });
  }, [processFile, uploadTasks]);

  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    processFiles(files);
  }, [processFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  }, [handleFiles]);

  const cancelUpload = useCallback((taskId: string) => {
    activeTasksRef.current.get(taskId)?.cancel();
    activeTasksRef.current.delete(taskId);
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: 'cancelado' } : t,
      ),
    );
  }, []);

  const retryUpload = useCallback((task: UploadTask) => {
    if (!task.storagePath) return;
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: 'subiendo', progress: 0, error: undefined } : t,
      ),
    );
  }, []);

  // ── Batch OCR ────────────────────────────────────────────────────────────

  const processOneDoc = useCallback(async (docItem: DocumentoMedio) => {
    const controller = new AbortController();
    const docId = docItem.id;
    abortControllersRef.current.set(docId, controller);

    const timeout = setTimeout(() => {
      try { controller.abort(); } catch {}
    }, 30000);

    dispatch({ type: 'START_DOC', docId });

    try {
      const user = getAuth().currentUser;
      if (!user) {
        dispatch({ type: 'FAIL_DOC', docId, error: 'Error de autenticación' });
        return;
      }
      const token = await user.getIdToken();

      let lastError: string | null = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          const res = await fetch('/api/ocr/extract', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ storagePath: docItem.storagePath }),
            signal: controller.signal,
          });

          if (res.ok) {
            let result: any;
            try {
              result = await res.json();
            } catch {
              dispatch({ type: 'FAIL_DOC', docId, error: 'Error al leer la respuesta del servidor' });
              return;
            }

            // Non-destructive merge
            try {
              const docRef = doc(db, 'companies', companyId, 'documentos', docId);
              const snap = await getDoc(docRef);
              if (snap.exists()) {
                const current = snap.data();
                const update: Record<string, unknown> = {};

                if (!current.tipoDocumento && result.tipoDocumentoSugerido) {
                  update.tipoDocumento = result.tipoDocumentoSugerido;
                }
                if (!current.periodo && result.fechaDocumento) {
                  update.periodo = result.fechaDocumento.slice(0, 7);
                }
                if (!current.metadata?.descripcion && result.descripcion) {
                  update['metadata.descripcion'] = result.descripcion;
                }
                update['metadata._extractedAt'] = serverTimestamp();

                await updateDocumentoMedio(companyId, docId, update);
              } else {
                // Doc doesn't exist yet — still write _extractedAt
                await updateDocumentoMedio(companyId, docId, {
                  'metadata._extractedAt': serverTimestamp(),
                } as Record<string, unknown>);
              }
            } catch (fsErr) {
              // If Firestore fails, still count as done (data was extracted)
              console.error('Firestore write failed:', fsErr);
            }

            dispatch({ type: 'FINISH_DOC', docId });
            return;
          }

          if (res.status === 429) {
            if (attempts < maxAttempts) {
              await new Promise((r) => setTimeout(r, 1000 * attempts));
              continue;
            }
            lastError = getFriendlyErrorMessage(undefined, 429);
            break;
          }

          let errorBody = '';
          try {
            errorBody = await res.text();
          } catch {}
          lastError = getFriendlyErrorMessage(errorBody, res.status);
          break;

        } catch (fetchErr: unknown) {
          if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
            dispatch({ type: 'CANCEL_BATCH' });
            return;
          }
          lastError = getFriendlyErrorMessage(
            fetchErr instanceof Error ? fetchErr.message : 'Error desconocido',
          );
          break;
        }
      }

      if (lastError) {
        dispatch({ type: 'FAIL_DOC', docId, error: lastError });
      }
    } catch (outerErr) {
      const msg = outerErr instanceof Error ? outerErr.message : 'Error desconocido';
      dispatch({ type: 'FAIL_DOC', docId, error: msg });
    } finally {
      clearTimeout(timeout);
      abortControllersRef.current.delete(docId);
    }
  }, [companyId]);

  const handleBatchOcr = useCallback(() => {
    const selectedDocs = documentosRef.current.filter((d) =>
      selectedIdsRef.current.has(d.id),
    );
    if (selectedDocs.length === 0) return;

    dispatch({ type: 'START_BATCH', docIds: selectedDocs.map((d) => d.id) });

    // Use a local async IIFE to avoid closure over stale state
    (async () => {
      const chunks = chunkArray(selectedDocs, 3);
      for (const chunk of chunks) {
        await Promise.allSettled(chunk.map((doc) => processOneDoc(doc)));
      }
    })();
  }, [processOneDoc]);

  const handleCancel = useCallback(() => {
    abortControllersRef.current.forEach((c) => c.abort());
    abortControllersRef.current.clear();
    dispatch({ type: 'CANCEL_BATCH' });
  }, []);

  const handleClearProgress = useCallback(() => {
    dispatch({ type: 'CLEAR_PROGRESS' });
    clearSelection();
  }, [clearSelection]);

  const handleRetry = useCallback(() => {
    const progress = batchOcrProgress;
    const errorDocsIds = Object.entries(progress)
      .filter(([, p]) => p.status === 'error')
      .map(([id]) => id);

    if (errorDocsIds.length === 0) return;

    // Reset error docs to pending
    dispatch({ type: 'START_BATCH', docIds: errorDocsIds });

    const errorDocs = documentosRef.current.filter((d) => errorDocsIds.includes(d.id));

    (async () => {
      const chunks = chunkArray(errorDocs, 3);
      for (const chunk of chunks) {
        await Promise.allSettled(chunk.map((doc) => processOneDoc(doc)));
      }
    })();
  }, [batchOcrProgress, processOneDoc]);

  // Derive action bar state
  const hasProgress = Object.keys(batchOcrProgress).length > 0;
  const progressEntries = Object.values(batchOcrProgress);
  const hasProcessing = progressEntries.some(
    (e) => e.status === 'pending' || e.status === 'processing',
  );
  const hasCancelled = progressEntries.some((e) => e.status === 'cancelled');
  const hasErrors = progressEntries.some((e) => e.status === 'error');
  const doneCount = progressEntries.filter((e) => e.status === 'done').length;
  const errorCount = progressEntries.filter((e) => e.status === 'error').length;
  const totalCount = progressEntries.length;

  let barState: 'hidden' | 'idle' | 'processing' | 'done-ok' | 'done-errors' | 'cancelled' = 'hidden';
  if (hasProgress) {
    if (hasProcessing) {
      barState = 'processing';
    } else if (hasCancelled) {
      barState = 'cancelled';
    } else if (hasErrors) {
      barState = 'done-errors';
    } else {
      barState = 'done-ok';
    }
  } else if (selectedIds.size > 0) {
    barState = 'idle';
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-6 space-y-6">
        {/* Dropzone */}
        <div
          data-testid="dropzone"
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dropActive
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-slate-300 hover:border-slate-400 bg-white'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDropActive(true); }}
          onDragLeave={() => setDropActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-sm text-slate-600 font-medium">
            Arrastrá archivos aquí
          </p>
          <p className="text-xs text-slate-400 mt-1">
            o hacé clic para seleccionar
          </p>
          <p className="text-xs text-slate-400 mt-1">
            PDF, JPG, PNG — máximo 5MB por archivo
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* Upload progress cards */}
        {uploadTasks.filter(t => t.status !== 'cancelado').length > 0 && (
          <div className="space-y-2" data-testid="upload-progress">
            {uploadTasks
              .filter(t => t.status !== 'cancelado')
              .map((task) => (
              <div
                key={task.id}
                className={`bg-white border rounded-lg p-3 flex items-center gap-3 ${
                  task.status === 'error' ? 'border-red-200' : 'border-slate-200'
                }`}
              >
                <span className="text-xs font-medium text-slate-700 truncate flex-1">
                  {task.fileName}
                </span>
                {task.status === 'subiendo' && (
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-8 text-right">
                      {Math.round(task.progress)}%
                    </span>
                    <button
                      onClick={() => cancelUpload(task.id)}
                      className="text-slate-400 hover:text-red-500 text-xs"
                      title="Cancelar"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {task.status === 'exito' && (
                  <span className="text-xs text-emerald-600 font-medium">✓ Subido</span>
                )}
                {task.status === 'error' && (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Error</span>
                    <button
                      onClick={() => retryUpload(task)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Reintentar
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Inbox grid header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {documentos.length > 0 && (
              <input
                type="checkbox"
                checked={documentos.length > 0 && documentos.every((d) => selectedIds.has(d.id))}
                onChange={handleSelectAll}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            )}
            <h2 className="text-sm font-semibold text-slate-700">
              Bandeja de entrada
            </h2>
            {selectedIds.size > 0 && (
              <span className="text-xs text-indigo-600 font-medium">
                {selectedIds.size >= 30
                  ? '30/30 máximo'
                  : `${selectedIds.size} seleccionado${selectedIds.size !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">
            {documentos.length} documento{documentos.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Document grid */}
        {documentos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <p className="text-sm text-slate-500">
              No hay documentos sin clasificar
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Subí documentos usando el área de arriba
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {documentos.map((doc) => {
              const progress = batchOcrProgress[doc.id];
              const showOverlay = !!progress;
              const isProcessingOrError =
                progress?.status === 'processing' || progress?.status === 'error';
              const checkboxDisabled =
                progress?.status === 'processing' ||
                (selectedIds.size >= 30 && !selectedIds.has(doc.id));

              return (
                <button
                  key={doc.id}
                  className={`relative bg-white border rounded-xl p-3 text-left transition-all ${
                    isProcessingOrError
                      ? 'opacity-60 pointer-events-none border-slate-200'
                      : progress?.status === 'done'
                        ? 'border-emerald-200 hover:border-emerald-300 hover:shadow-sm'
                        : 'border-slate-200 hover:border-emerald-300 hover:shadow-sm'
                  }`}
                  onClick={() => {
                    if (progress?.status === 'done' || !progress) {
                      onNavigate?.({
                        type: 'entity',
                        entity: 'documento',
                        mode: 'view',
                        record: doc,
                      });
                    }
                  }}
                  disabled={isProcessingOrError}
                >
                  {/* Checkbox */}
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(doc.id)}
                      disabled={checkboxDisabled}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => {
                        toggleSelection(doc.id);
                        // Dismiss progress overlay when unchecking done/error docs
                        const p = batchOcrProgress[doc.id];
                        if (p && (p.status === 'done' || p.status === 'error')) {
                          dispatch({ type: 'DISMISS_DOC', docId: doc.id });
                        }
                      }}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {doc.fileName}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <span>{formatFileSize(doc.size)}</span>
                        <span>•</span>
                        <span>{formatDate(doc.uploadedAt)}</span>
                      </div>
                      <span className="inline-block mt-1.5 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        por clasificar
                      </span>
                    </div>
                  </div>

                  {/* Overlay */}
                  {showOverlay && (
                    <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center gap-2 z-10">
                      {progress.status === 'processing' && (
                        <Loader2 className="animate-spin h-5 w-5 text-amber-500" />
                      )}
                      {progress.status === 'done' && (
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      )}
                      {progress.status === 'error' && (
                        <div className="flex items-center gap-1" title={progress.error}>
                          <AlertCircle className="h-5 w-5 text-red-500" />
                          <span className="text-xs text-red-600">Error</span>
                        </div>
                      )}
                      {progress.status === 'cancelled' && (
                        <span className="text-xs text-slate-400">Cancelado</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating action bar */}
      {barState !== 'hidden' && (
        <div className="sticky bottom-0 bg-white border-t border-slate-200 shadow-lg px-6 py-3 z-20">
          <div className="flex items-center justify-between">
            {barState === 'idle' && (
              <>
                <span className="text-sm font-medium text-slate-700">
                  {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={clearSelection}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={handleBatchOcr}
                    className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    Extraer con IA ({selectedIds.size})
                  </button>
                </div>
              </>
            )}

            {barState === 'processing' && (
              <>
                <span className="text-sm text-slate-600">
                  {doneCount}/{totalCount} procesados
                </span>
                <button
                  onClick={handleCancel}
                  className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </>
            )}

            {barState === 'done-ok' && (
              <>
                <span className="text-sm text-emerald-600 font-medium">
                  <CheckCircle className="inline h-4 w-4 mr-1" />
                  Procesados: {doneCount}/{totalCount}
                </span>
                <button
                  onClick={handleClearProgress}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Limpiar
                </button>
              </>
            )}

            {barState === 'done-errors' && (
              <>
                <span className="text-sm text-slate-600">
                  Procesados: {doneCount}/{totalCount} — {errorCount} error{errorCount !== 1 ? 'es' : ''}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClearProgress}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={handleRetry}
                    className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    Reintentar ({errorCount})
                  </button>
                </div>
              </>
            )}

            {barState === 'cancelled' && (
              <>
                <span className="text-sm text-slate-600">
                  Cancelado — {doneCount} procesado{doneCount !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={handleClearProgress}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Limpiar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
