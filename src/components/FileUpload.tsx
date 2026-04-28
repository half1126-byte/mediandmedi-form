'use client';

import { useState, useRef } from 'react';

export interface UploadedFile {
  url: string;
  filename: string;
  size: number;
}

interface Props {
  label: string;
  category: string;
  clinicName?: string;
  accept?: string;       // 예: ".png,.jpg,.jpeg"
  multiple?: boolean;    // 다중 업로드
  maxFiles?: number;     // multiple일 때 최대 개수
  required?: boolean;
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  hint?: string;
}

export default function FileUpload({
  label,
  category,
  clinicName,
  accept,
  multiple = false,
  maxFiles = 10,
  required = false,
  files,
  onChange,
  hint,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    setError('');

    if (multiple && files.length + selected.length > maxFiles) {
      setError(`최대 ${maxFiles}개까지 업로드 가능합니다`);
      return;
    }

    setUploading(true);
    setProgress(0);

    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      if (clinicName) formData.append('clinicName', clinicName);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (data.success) {
          newFiles.push({
            url: data.url,
            filename: data.filename,
            size: data.size,
          });
        } else {
          setError(data.error || '업로드 실패');
          break;
        }
      } catch {
        setError('네트워크 오류로 업로드 실패');
        break;
      }

      setProgress(Math.round(((i + 1) / selected.length) * 100));
    }

    onChange(multiple ? [...files, ...newFiles] : newFiles.slice(0, 1));
    setUploading(false);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-[#374151]">
        {label}
        {required && <span className="text-[#DC2626] ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-[#9CA3AF]">{hint}</p>}

      {/* 업로드된 파일 목록 */}
      {files.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {files.map((f, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-2 rounded-lg bg-[#F0F7FF] border border-[#BFDBFE] text-sm"
            >
              <span className="text-[#2563EB]">📎</span>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-[#374151] hover:text-[#2563EB] hover:underline"
              >
                {f.filename}
              </a>
              <span className="text-xs text-[#9CA3AF]">{formatSize(f.size)}</span>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-xs text-[#DC2626] hover:underline px-1"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 업로드 버튼 (multiple이 아니거나 아직 파일이 없을 때 또는 multiple이고 최대치 안 됐을 때) */}
      {(multiple ? files.length < maxFiles : files.length === 0) && (
        <div>
          <label
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed cursor-pointer
              text-sm font-medium transition-colors
              ${uploading
                ? 'border-[#D1D5DB] bg-[#F9FAFB] text-[#9CA3AF] cursor-not-allowed'
                : 'border-[#2563EB] bg-[#F0F7FF] text-[#2563EB] hover:bg-[#DBEAFE]'
              }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={handleSelect}
              disabled={uploading}
              className="hidden"
            />
            {uploading ? (
              <>
                <span>⏳ 업로드 중... {progress}%</span>
              </>
            ) : (
              <>
                <span>📤</span>
                <span>{multiple && files.length > 0 ? '추가 업로드' : '파일 선택'}</span>
              </>
            )}
          </label>
          {multiple && (
            <span className="text-xs text-[#9CA3AF] ml-2">
              {files.length}/{maxFiles}개
            </span>
          )}
        </div>
      )}

      {/* 진행률 바 */}
      {uploading && (
        <div className="w-full h-1 bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#2563EB] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
    </div>
  );
}
