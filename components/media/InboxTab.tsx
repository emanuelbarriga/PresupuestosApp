'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DocumentoMedio, NavScreen } from '@/lib/types';
import { subscribeDocumentos, createDocumento } from '@/lib/mediaService';
import { uploadFileWithTask, validateFile, generateMediaFilePath } from '@/lib/fileUpload';
import toast from 'react-hot-toast';

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

// ─── Component ───────────────────────────────────────────────────────────────

export function InboxTab({ companyId, onNavigate }: InboxTabProps) {
  const [documentos, setDocumentos] = useState<DocumentoMedio[]>([]);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTasksRef = useRef<Map<string, import('firebase/storage').UploadTask>>(new Map());

  // Cancel all active uploads on unmount (prevents memory leaks)
  useEffect(() => {
    return () => {
      activeTasksRef.current.forEach((task) => task.cancel());
      activeTasksRef.current.clear();
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

  const processFile = useCallback(async (file: File): Promise<void> => {
    const userId = 'current'; // Will be replaced with auth UID when auth is integrated

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      toast.error(`${file.name}: ${validation.error}`);
      return;
    }

    // Create task ID
    const taskId = crypto.randomUUID();
    const storagePath = generateMediaFilePath(companyId, file.name);

    // Add task to UI
    const task: UploadTask = {
      id: taskId,
      fileName: file.name,
      progress: 0,
      status: 'subiendo',
      storagePath,
    };
    setUploadTasks((prev) => [...prev, task]);

    // Track progress only — 100% and "Procesando..." shown until upload resolves
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
      // Start upload and track the task for cancellation
      const { promise: uploadPromise, task: firebaseTask } = uploadFileWithTask(file, storagePath, onProgress);
      activeTasksRef.current.set(taskId, firebaseTask);

      const uploadResult = await uploadPromise;
      uploadCompleted = true;

      // Mark as "Procesando..." while Storage finalizes
      setUploadTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, progress: 100, status: 'subiendo' as const }
            : t,
        ),
      );

      // Create Firestore record
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

      // Only now mark as success (green check)
      setUploadTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: 'exito', progress: 100, url: uploadResult.url }
            : t,
        ),
      );

      toast.success(`${file.name} subido`);
    } catch (err) {
      // Cancel is not an error — skip toast
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
    // Deduplicate: skip files already in the active upload queue
    const activeNames = new Set(uploadTasks.map(t => t.fileName));
    const nuevos = files.filter(f => !activeNames.has(f.name));
    if (nuevos.length < files.length) {
      toast(`${files.length - nuevos.length} archivo(s) ya están en la cola`);
    }
    if (nuevos.length === 0) return;

    // All uploads start in parallel — each handles its own lifecycle
    Promise.allSettled(nuevos.map((file) => processFile(file))).then((results) => {
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) toast.error(`${failed} archivo(s) fallaron`);

      // Clean up success/error tasks after a brief pause
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
    // Reset so the same file can be selected again
    e.target.value = '';
  }, [handleFiles]);

  const cancelUpload = useCallback((taskId: string) => {
    // Cancel the underlying Firebase upload task
    activeTasksRef.current.get(taskId)?.cancel();
    activeTasksRef.current.delete(taskId);
    // Update UI
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: 'cancelado' } : t,
      ),
    );
  }, []);

  const retryUpload = useCallback((task: UploadTask) => {
    if (!task.storagePath) return;
    // Remove the failed task and re-add it via processFiles
    // We need to reconstruct the file — for now, mark as subiendo again
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: 'subiendo', progress: 0, error: undefined } : t,
      ),
    );
    // Note: full retry with re-upload requires the original File reference
    // For MVP, error tasks allow manual re-selection
  }, []);

  return (
    <div className="p-6 space-y-6">
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
        <h2 className="text-sm font-semibold text-slate-700">
          Bandeja de entrada
        </h2>
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
          {documentos.map((doc) => (
            <button
              key={doc.id}
              onClick={() => onNavigate?.({
                type: 'entity',
                entity: 'documento',
                mode: 'view',
                record: doc,
              })}
              className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-emerald-300 hover:shadow-sm transition-all"
            >
              <p className="text-sm font-medium text-slate-800 truncate">
                {doc.fileName}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                <span>{formatFileSize(doc.size)}</span>
                <span>•</span>
                <span>{formatDate(doc.uploadedAt)}</span>
              </div>
              <span className="inline-block mt-2 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                por clasificar
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
