/**
 * File Editor component.
 * Opens as a Dialog overlay for viewing and editing files with
 * CodeMirror 6, save (Ctrl+S), dirty tracking, syntax highlighting,
 * minimap toggle, word wrap, font size, theme switching, fullscreen,
 * and a status bar showing cursor position.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Loader2,
  Code,
  Eye,
  Map,
  WrapText,
  Minus,
  Plus,
  Palette,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { MarkdownPreview } from './previews/MarkdownPreview';
import { HtmlPreview } from './previews/HtmlPreview';
import { ImagePreview } from './previews/ImagePreview';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { IPC } from '../../shared/ipcChannels';
import { typedSend } from '../lib/ipc';
import { useSettings } from '../hooks/useSettings';
import { useProjectStore } from '../stores/useProjectStore';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { keymap, EditorView } from '@codemirror/view';
import { EditorState as CMState, type Extension } from '@codemirror/state';
import {
  themeCompartment,
  getThemeExtension,
  reconfigureTheme,
  EDITOR_THEMES,
  type EditorThemeId,
} from '../lib/codemirror-theme';
import {
  getBaseExtensions,
  getLanguageExtension,
  getMinimapExtension,
  getJsonLinter,
  getIndentExtension,
  minimapCompartment,
  wordWrapCompartment,
  fontSizeCompartment,
  reconfigureMinimap,
  reconfigureWordWrap,
  getWordWrapExtension,
  getFontSizeExtension,
  reconfigureFontSize,
} from '../lib/codemirror-extensions';

const { ipcRenderer } = require('electron');

/** File extensions that support a Code/Preview toggle */
const PREVIEWABLE_EXTENSIONS = new Set([
  'md', 'markdown', 'html', 'htm', 'css', 'svg',
]);

type ViewMode = 'code' | 'preview';

interface EditorProps {
  filePath: string | null;
  onClose: () => void;
}

type EditorState = 'loading' | 'ready' | 'error';

/** Compute relative path by stripping the project root prefix. */
function getRelativePath(filePath: string, projectPath: string | null): string {
  if (!projectPath) return filePath;
  // Normalize separators for comparison
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/$/, '');
  const nFile = norm(filePath);
  const nProject = norm(projectPath);
  if (nFile.startsWith(nProject + '/')) {
    return nFile.slice(nProject.length + 1);
  }
  return filePath;
}

export function Editor({ filePath, onClose }: EditorProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [editorState, setEditorState] = useState<EditorState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dirtyCloseOpen, setDirtyCloseOpen] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [imageData, setImageData] = useState<{ dataUrl: string; fileSize?: number } | null>(null);
  const [isImage, setIsImage] = useState(false);

  // Cursor position for status bar
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [totalLines, setTotalLines] = useState(0);

  // Settings
  const { settings, updateSetting } = useSettings();
  const editorSettings = (settings as Record<string, unknown>)?.editor as {
    minimap?: boolean;
    fullscreen?: boolean;
    theme?: string;
    wordWrap?: boolean;
    fontSize?: number;
  } | undefined;

  const minimapEnabled = editorSettings?.minimap ?? false;
  const wordWrapEnabled = editorSettings?.wordWrap ?? false;
  const fontSize = editorSettings?.fontSize ?? 12;
  const themeId = (editorSettings?.theme ?? 'subframe-dark') as EditorThemeId;
  const [isFullscreen, setIsFullscreen] = useState(editorSettings?.fullscreen ?? false);

  // Project path for relative display
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);

  // CM6 view ref
  const cmRef = useRef<ReactCodeMirrorRef>(null);

  const isModified = content !== originalContent;
  const isOpen = filePath !== null;

  // Extract filename and extension for display
  const fileName = filePath?.split(/[/\\]/).pop() ?? '';
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() : 'FILE';
  const fileExt = fileName.split('.').pop()?.toLowerCase() ?? '';
  const isPreviewable = PREVIEWABLE_EXTENSIONS.has(fileExt);
  const relativePath = filePath ? getRelativePath(filePath, currentProjectPath) : '';

  // Load file content when filePath changes
  useEffect(() => {
    if (!filePath) return;

    setEditorState('loading');
    setSaveStatus('idle');
    setViewMode('code');
    setImageData(null);
    setIsImage(false);
    setDirtyCloseOpen(false);
    setCursorLine(1);
    setCursorCol(1);
    setTotalLines(0);

    const contentHandler = (_event: unknown, result: { filePath: string; content?: string; fileName?: string; extension?: string; success?: boolean; error?: string; readOnly?: boolean }) => {
      if (result.filePath !== filePath) return;
      if (result.error === 'image') {
        setIsImage(true);
        setViewMode('preview');
        typedSend(IPC.READ_FILE_IMAGE, filePath);
        return;
      }
      if (result.error) {
        setEditorState('error');
        setErrorMessage(result.error);
      } else {
        const fileContent = result.content ?? '';
        setContent(fileContent);
        setOriginalContent(fileContent);
        setReadOnly(result.readOnly ?? false);
        setEditorState('ready');
      }
    };

    const imageHandler = (_event: unknown, result: { filePath: string; dataUrl?: string; fileSize?: number; error?: string }) => {
      if (result.filePath !== filePath) return;
      if (result.error) {
        setEditorState('error');
        setErrorMessage(result.error);
      } else if (result.dataUrl) {
        setImageData({ dataUrl: result.dataUrl, fileSize: result.fileSize });
        setEditorState('ready');
      }
    };

    ipcRenderer.on(IPC.FILE_CONTENT, contentHandler);
    ipcRenderer.on(IPC.IMAGE_CONTENT, imageHandler);
    typedSend(IPC.READ_FILE, filePath);

    return () => {
      ipcRenderer.removeListener(IPC.FILE_CONTENT, contentHandler);
      ipcRenderer.removeListener(IPC.IMAGE_CONTENT, imageHandler);
    };
  }, [filePath]);

  // Listen for save confirmation
  useEffect(() => {
    const handler = (_event: unknown, result: { filePath: string; success: boolean; error?: string }) => {
      if (result.filePath !== filePath) return;
      if (result.success) {
        setOriginalContent(savedContentRef.current);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    };

    ipcRenderer.on(IPC.FILE_SAVED, handler);
    return () => {
      ipcRenderer.removeListener(IPC.FILE_SAVED, handler);
    };
  }, [filePath]);

  const handleSave = useCallback(() => {
    if (!filePath || !isModified) return;
    setSaveStatus('saving');
    savedContentRef.current = content;
    typedSend(IPC.WRITE_FILE, { filePath, content });
  }, [filePath, content, isModified]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const savedContentRef = useRef('');

  // Handle close with dirty check
  const handleClose = useCallback(() => {
    if (isModified) {
      setDirtyCloseOpen(true);
      return;
    }
    onClose();
  }, [isModified, onClose]);

  // ── Compartment reconfiguration effects ──────────────────────────────

  const getView = useCallback((): EditorView | null => {
    return cmRef.current?.view ?? null;
  }, []);

  useEffect(() => {
    const view = getView();
    if (view) reconfigureMinimap(view, minimapEnabled);
  }, [minimapEnabled, getView]);

  useEffect(() => {
    const view = getView();
    if (view) reconfigureWordWrap(view, wordWrapEnabled);
  }, [wordWrapEnabled, getView]);

  useEffect(() => {
    const view = getView();
    if (view) reconfigureFontSize(view, fontSize);
  }, [fontSize, getView]);

  useEffect(() => {
    const view = getView();
    if (view) reconfigureTheme(view, themeId);
  }, [themeId, getView]);

  // F11 fullscreen toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F11' && isOpen) {
        e.preventDefault();
        setIsFullscreen((prev) => {
          const next = !prev;
          updateSetting.mutate([{ key: 'editor.fullscreen', value: next }]);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, updateSetting]);

  // ── Toolbar handlers ─────────────────────────────────────────────────

  const toggleMinimap = useCallback(() => {
    updateSetting.mutate([{ key: 'editor.minimap', value: !minimapEnabled }]);
  }, [minimapEnabled, updateSetting]);

  const toggleWordWrap = useCallback(() => {
    updateSetting.mutate([{ key: 'editor.wordWrap', value: !wordWrapEnabled }]);
  }, [wordWrapEnabled, updateSetting]);

  const changeFontSize = useCallback((delta: number) => {
    const next = Math.min(24, Math.max(8, fontSize + delta));
    updateSetting.mutate([{ key: 'editor.fontSize', value: next }]);
  }, [fontSize, updateSetting]);

  const changeTheme = useCallback((id: string) => {
    updateSetting.mutate([{ key: 'editor.theme', value: id }]);
  }, [updateSetting]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      updateSetting.mutate([{ key: 'editor.fullscreen', value: next }]);
      return next;
    });
  }, [updateSetting]);

  // ── CM6 update listener for cursor position ──────────────────────────

  const cursorUpdateListener = useMemo(() => {
    return EditorView.updateListener.of((update) => {
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        setCursorLine(line.number);
        setCursorCol(pos - line.from + 1);
        setTotalLines(update.state.doc.lines);
      }
    });
  }, []);

  // Memoize CodeMirror extensions — recreate when filename or readOnly changes
  const extensions = useMemo(() => {
    const exts: Extension[] = [
      ...getBaseExtensions(),
      themeCompartment.of(getThemeExtension(themeId)),
      minimapCompartment.of(getMinimapExtension(minimapEnabled)),
      wordWrapCompartment.of(getWordWrapExtension(wordWrapEnabled)),
      fontSizeCompartment.of(getFontSizeExtension(fontSize)),
      getIndentExtension(2),
      cursorUpdateListener,
    ];

    if (readOnly) {
      exts.push(CMState.readOnly.of(true));
    }

    if (fileName) {
      const lang = getLanguageExtension(fileName);
      if (lang) exts.push(lang);
    }

    const ext_ = fileName?.split('.').pop()?.toLowerCase();
    if (ext_ === 'json') {
      exts.push(getJsonLinter());
    }

    // Custom save keymap (Ctrl/Cmd+S)
    exts.push(
      keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            handleSaveRef.current();
            return true;
          },
        },
      ])
    );

    return exts;
  }, [fileName, readOnly, themeId, minimapEnabled, wordWrapEnabled, fontSize, cursorUpdateListener]);

  // ── Dialog className for fullscreen vs normal ────────────────────────

  const dialogContentClass = isFullscreen
    ? 'bg-bg-primary border-border-subtle flex flex-col gap-0 p-0 !max-w-none w-screen h-screen !rounded-none !top-0 !left-0 !translate-x-0 !translate-y-0 fixed inset-0'
    : 'bg-bg-primary border-border-subtle sm:max-w-6xl h-[85vh] flex flex-col gap-0 p-0';

  // ── Toolbar button helper ────────────────────────────────────────────

  const ToolbarBtn = useCallback(
    ({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={`p-1 rounded transition-colors cursor-pointer ${
              active
                ? 'bg-accent-subtle text-accent'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
            }`}
            title={title}
            aria-label={title}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-bg-tertiary text-text-primary border-border-subtle text-[10px]">
          {title}
        </TooltipContent>
      </Tooltip>
    ),
    []
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={dialogContentClass}
        showCloseButton={false}
      >
        <TooltipProvider delayDuration={400}>
          {/* Header */}
          <DialogHeader className="px-4 py-3 border-b border-border-subtle flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <DialogTitle className="text-sm font-medium truncate text-text-primary">
                  {isModified && (
                    <span className="inline-block w-2 h-2 rounded-full bg-warning mr-2 align-middle" />
                  )}
                  {fileName}
                </DialogTitle>
                {ext && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-tertiary text-text-tertiary flex-shrink-0">
                    {ext}
                  </span>
                )}
                {readOnly && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted flex-shrink-0">
                    READ-ONLY
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Save status — color-coded with tooltip */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10px] mr-1 cursor-default">
                      {saveStatus === 'saving' && <span className="text-warning">Saving...</span>}
                      {saveStatus === 'saved' && <span className="text-success">Saved</span>}
                      {saveStatus === 'error' && <span className="text-error">Save failed</span>}
                      {saveStatus === 'idle' && isModified && <span className="text-warning">Modified</span>}
                      {saveStatus === 'idle' && !isModified && editorState === 'ready' && (
                        readOnly
                          ? <span className="text-text-muted">Read-Only</span>
                          : <span className="text-success">Ready</span>
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-bg-tertiary text-text-primary border-border-subtle text-[10px]">
                    {saveStatus === 'saving' && 'Writing changes to disk...'}
                    {saveStatus === 'saved' && 'All changes saved successfully'}
                    {saveStatus === 'error' && 'Failed to write file — check permissions'}
                    {saveStatus === 'idle' && isModified && 'Unsaved changes — press Ctrl+S to save'}
                    {saveStatus === 'idle' && !isModified && editorState === 'ready' && (
                      readOnly ? 'File is read-only and cannot be edited' : 'No unsaved changes'
                    )}
                  </TooltipContent>
                </Tooltip>

                {/* Toolbar — only show when editor is ready and not image */}
                {editorState === 'ready' && !isImage && viewMode === 'code' && (
                  <div className="flex items-center gap-0.5 mr-1 border-r border-border-subtle pr-2">
                    {/* Word Wrap */}
                    <ToolbarBtn active={wordWrapEnabled} onClick={toggleWordWrap} title="Word Wrap">
                      <WrapText className="w-3.5 h-3.5" />
                    </ToolbarBtn>

                    {/* Minimap */}
                    <ToolbarBtn active={minimapEnabled} onClick={toggleMinimap} title="Minimap">
                      <Map className="w-3.5 h-3.5" />
                    </ToolbarBtn>

                    {/* Font Size */}
                    <div className="flex items-center gap-0">
                      <ToolbarBtn onClick={() => changeFontSize(-1)} title="Decrease Font Size">
                        <Minus className="w-3 h-3" />
                      </ToolbarBtn>
                      <span className="text-[10px] text-text-tertiary w-5 text-center tabular-nums select-none">
                        {fontSize}
                      </span>
                      <ToolbarBtn onClick={() => changeFontSize(1)} title="Increase Font Size">
                        <Plus className="w-3 h-3" />
                      </ToolbarBtn>
                    </div>

                    {/* Theme Selector */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-1 rounded transition-colors cursor-pointer text-text-tertiary hover:text-text-secondary hover:bg-bg-hover"
                          title="Editor Theme"
                          aria-label="Editor theme"
                        >
                          <Palette className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-bg-tertiary border-border-subtle min-w-[160px]" align="end">
                        <DropdownMenuLabel className="text-text-tertiary text-[10px]">
                          Editor Theme
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-border-subtle" />
                        <DropdownMenuRadioGroup value={themeId} onValueChange={changeTheme}>
                          {Object.values(EDITOR_THEMES).map((t) => (
                            <DropdownMenuRadioItem
                              key={t.id}
                              value={t.id}
                              className="text-text-secondary text-xs cursor-pointer"
                            >
                              {t.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Fullscreen */}
                    <ToolbarBtn active={isFullscreen} onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen (F11)'}>
                      {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </ToolbarBtn>
                  </div>
                )}

                {/* Code/Preview toggle for previewable files */}
                {isPreviewable && !isImage && editorState === 'ready' && (
                  <div className="flex items-center rounded-md bg-bg-tertiary p-0.5">
                    <button
                      onClick={() => setViewMode('code')}
                      className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors cursor-pointer ${
                        viewMode === 'code'
                          ? 'bg-bg-elevated text-text-primary'
                          : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
                      <Code className="w-3 h-3" />
                      Code
                    </button>
                    <button
                      onClick={() => setViewMode('preview')}
                      className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors cursor-pointer ${
                        viewMode === 'preview'
                          ? 'bg-bg-elevated text-text-primary'
                          : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      Preview
                    </button>
                  </div>
                )}

                <button
                  onClick={handleSave}
                  disabled={readOnly || !isModified || editorState !== 'ready' || isImage}
                  className="px-2.5 py-1 text-xs rounded-md bg-accent-subtle text-accent
                             hover:bg-accent/20 transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={handleClose}
                  className="px-2.5 py-1 text-xs rounded-md text-text-secondary
                             hover:bg-bg-hover transition-colors cursor-pointer"
                  aria-label="Close editor"
                >
                  Close
                </button>
              </div>
            </div>
            <DialogDescription className="text-[10px] font-mono text-text-muted truncate mt-1">
              {relativePath}
            </DialogDescription>
          </DialogHeader>

          {/* Editor body */}
          <div className="flex-1 min-h-0 overflow-hidden [&_.cm-editor]:h-full [&_.cm-editor_.cm-scroller]:overflow-auto">
            {editorState === 'loading' && (
              <div className="h-full flex items-center justify-center text-text-tertiary">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">Loading file...</span>
              </div>
            )}

            {editorState === 'error' && (
              <div className="h-full flex items-center justify-center text-error px-6 text-center">
                <div>
                  <p className="text-sm font-medium mb-1">Failed to open file</p>
                  <p className="text-xs text-text-tertiary">{errorMessage}</p>
                </div>
              </div>
            )}

            {editorState === 'ready' && isImage && imageData && (
              <ImagePreview
                dataUrl={imageData.dataUrl}
                fileName={fileName}
                fileSize={imageData.fileSize}
              />
            )}

            {editorState === 'ready' && !isImage && viewMode === 'preview' && (fileExt === 'md' || fileExt === 'markdown') && (
              <MarkdownPreview content={content} />
            )}

            {editorState === 'ready' && !isImage && viewMode === 'preview' && (fileExt === 'html' || fileExt === 'htm' || fileExt === 'css') && filePath && (
              <HtmlPreview content={content} filePath={filePath} />
            )}

            {editorState === 'ready' && !isImage && viewMode === 'preview' && fileExt === 'svg' && (
              <ImagePreview
                dataUrl={`data:image/svg+xml;utf8,${encodeURIComponent(content)}`}
                fileName={fileName}
              />
            )}

            {editorState === 'ready' && !isImage && viewMode === 'code' && (
              <CodeMirror
                ref={cmRef}
                value={content}
                extensions={extensions}
                onChange={readOnly ? undefined : (value) => setContent(value)}
                basicSetup={false}
                theme="none"
                className="h-full"
                height="100%"
                style={{ height: '100%' }}
                autoFocus
              />
            )}
          </div>

          {/* Status bar */}
          {editorState === 'ready' && !isImage && viewMode === 'code' && (
            <div className="px-4 py-1 border-t border-border-subtle flex items-center justify-between text-[10px] font-mono text-text-muted flex-shrink-0 bg-bg-primary">
              <span>
                Ln {cursorLine}, Col {cursorCol} · {totalLines} lines
              </span>
              <span>UTF-8</span>
            </div>
          )}
        </TooltipProvider>
      </DialogContent>

      {/* Dirty close confirmation */}
      <AlertDialog open={dirtyCloseOpen} onOpenChange={setDirtyCloseOpen}>
        <AlertDialogContent className="bg-bg-primary border-border-subtle text-text-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-xs">
              You have unsaved changes. Are you sure you want to close without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error text-white hover:bg-error/80 cursor-pointer"
              onClick={() => {
                setDirtyCloseOpen(false);
                onClose();
              }}
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
