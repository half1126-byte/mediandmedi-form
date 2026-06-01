'use client';

import { useState, useRef } from 'react';

export interface UploadedFile {
  url: string;
  filename: string;
  size: number;
}

// Vercel 서버리스 함수 본문 한도(~4.5MB)보다 여유있게 — 멀티파트 오버헤드 감안.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
// 이미지가 이보다 크면 업로드 전 자동 압축(다운스케일+JPEG 재인코딩) 시도.
const COMPRESS_TRIGGER_BYTES = 3.5 * 1024 * 1024;
const MAX_IMAGE_DIM = 2400;

/**
 * 큰 이미지를 업로드 한도 안으로 다운스케일/재인코딩한다(폰 사진 대응).
 * 이미지가 아니거나 이미 작으면 원본 그대로. 디코드 실패(HEIC 등) 시에도 원본 반환(가드가 처리).
 */
async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= COMPRESS_TRIGGER_BYTES) return file;
  try {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      bitmap = await createImageBitmap(file); // 옵션 미지원 브라우저 폴백
    }
    const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.fillStyle = '#ffffff'; // 투명 PNG → 흰 배경(검은 배경 방지)
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    let quality = 0.85;
    let blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.4) {
      quality -= 0.15;
      blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    }
    if (!blob || blob.size >= file.size) return file; // 효과 없으면 원본 유지
    const base = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
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
      const original = selected[i];
      const file = await compressImageIfNeeded(original);

      // 압축 후에도 한도 초과 → 플랫폼이 413으로 막기 전에 명확히 안내
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(
          `'${original.name}'(${formatMB(file.size)})이(가) 너무 큽니다. 4MB 이하로 줄이거나, 큰 도면·PDF는 담당자에게 별도 전달해 주세요.`
        );
        break;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      if (clinicName) formData.append('clinicName', clinicName);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        // 413 등은 JSON이 아닌 플랫폼 응답일 수 있어 안전하게 파싱
        let data: { success?: boolean; url?: string; filename?: string; size?: number; error?: string } | null = null;
        try { data = await res.json(); } catch { data = null; }

        if (res.ok && data?.success) {
          newFiles.push({
            url: data.url || '',
            filename: data.filename || file.name,
            size: data.size || file.size,
          });
        } else if (res.status === 413) {
          setError('파일이 너무 큽니다 (4MB 이하만 가능). 사진은 자동 압축되지만 한도를 넘었습니다.');
          break;
        } else {
          setError(data?.error || `업로드 실패 (오류 ${res.status})`);
          break;
        }
      } catch {
        setError('네트워크 오류로 업로드 실패. 잠시 후 다시 시도해 주세요.');
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
