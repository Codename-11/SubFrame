import React from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImagePreviewProps {
  dataUrl: string;
  fileName: string;
  fileSize?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImagePreview({ dataUrl, fileName, fileSize }: ImagePreviewProps) {
  return (
    <TransformWrapper initialScale={1} minScale={0.1} maxScale={20} centerOnInit>
      {({ zoomIn, zoomOut, resetTransform }) => (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle flex-shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => zoomIn()}
                className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => zoomOut()}
                className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => resetTransform()}
                className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                title="Reset zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
            {fileSize != null && (
              <span className="text-[10px] text-text-muted font-mono">
                {formatFileSize(fileSize)}
              </span>
            )}
          </div>

          <div
            className="flex-1 min-h-0 overflow-hidden"
            style={{
              backgroundColor: '#1a1a1c',
              backgroundImage:
                'repeating-conic-gradient(#222225 0% 25%, transparent 0% 50%)',
              backgroundSize: '16px 16px',
            }}
          >
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={dataUrl}
                alt={fileName}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                draggable={false}
              />
            </TransformComponent>
          </div>
        </div>
      )}
    </TransformWrapper>
  );
}
