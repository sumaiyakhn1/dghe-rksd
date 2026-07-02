import React, { useRef, useState } from 'react';
import { FileUp, FolderUp, MousePointerClick, X } from 'lucide-react';
import { parseExcelFile } from '../utils/excelUtils';

interface FileUploadProps {
  onDataLoaded: (headers: string[], data: any[], fileName: string) => void;
  onReset?: () => void;
  onClose?: () => void;
  fileName: string | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, fileName, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { headers, data } = await parseExcelFile(file);
      onDataLoaded(headers, data, file.name);
    } catch (error) {
      alert('File parse error. Verify it is a valid .xlsx file.');
    }
  };

  if (fileName) return null; // Handled in App parent for this design

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '32px', width: '100%', maxWidth: '600px', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Upload</h3>
        <X size={20} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={onClose} />
      </div>

      <div style={{ padding: '40px' }}>
        <div 
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
          style={{ 
            border: '2px dashed var(--border)', 
            borderRadius: '24px', 
            padding: '60px 20px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            cursor: 'pointer',
            background: isDragging ? 'var(--accent-glow)' : 'transparent',
            transition: 'all 0.3s'
          }}
        >
          <h4 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '40px' }}>
            Drop files here or <span style={{ color: 'var(--accent)' }}>browse files</span>
          </h4>

          <div style={{ display: 'flex', gap: '40px', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '48px', height: '48px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileUp size={24} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700 }}>File upload</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '48px', height: '48px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FolderUp size={24} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700 }}>Folder upload</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '48px', height: '48px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MousePointerClick size={24} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700 }}>Drag-n-drop</span>
            </div>
          </div>

          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls"
            style={{ display: 'none' }}
          />
        </div>
      </div>
    </div>
  );
};
