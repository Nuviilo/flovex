import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
} from 'lucide-react';

export function FileTypeIcon({ mimeType, className = 'w-5 h-5' }: { mimeType: string; className?: string }) {
  const lower = mimeType.toLowerCase();

  if (lower.startsWith('image/')) {
    return <FileImage className={className} />;
  }
  if (lower.startsWith('video/')) {
    return <FileVideo className={className} />;
  }
  if (lower.startsWith('audio/')) {
    return <FileAudio className={className} />;
  }
  if (
    lower.includes('zip') ||
    lower.includes('tar') ||
    lower.includes('gzip') ||
    lower.includes('compressed')
  ) {
    return <FileArchive className={className} />;
  }
  if (lower.includes('spreadsheet') || lower.includes('csv') || lower.includes('excel')) {
    return <FileSpreadsheet className={className} />;
  }
  if (
    lower.includes('json') ||
    lower.includes('javascript') ||
    lower.includes('typescript') ||
    lower.includes('html') ||
    lower.includes('xml')
  ) {
    return <FileCode2 className={className} />;
  }
  if (lower.includes('pdf') || lower.startsWith('text/')) {
    return <FileText className={className} />;
  }

  return <File className={className} />;
}
