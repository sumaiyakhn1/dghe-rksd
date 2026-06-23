import React, { useState, useEffect } from 'react';
import { Search, Check, Loader2, PlayCircle, Edit3 } from 'lucide-react';
import { ERP_FIELDS, INITIAL_PAYLOAD_DEFAULTS } from '../constants/erpFields';
import { formatExcelDate } from '../utils/excelUtils';
import { addStudent, markStudentAsPushed } from '../utils/auth';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

interface DataPreviewProps {
  data: any[];
  mappings: Record<string, string>;
  valueMappings?: Record<string, Record<string, string>>;
  erpCourseInfo?: { name: string, stream: string } | null;
  globalCategory?: string;
  activeFileId?: string | null;
  pushedRegistrationNumbers?: string[];
  onStudentPushed?: (regNo: string) => void;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ data, mappings, valueMappings, erpCourseInfo, globalCategory, activeFileId, pushedRegistrationNumbers = [], onStudentPushed }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMap, setStatusMap] = useState<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [errorMessages, setErrorMessages] = useState<Record<number, string>>({});
  
  // workingData stores the ACTUAL VALUES for each student, not just the excel row
  const [workingData, setWorkingData] = useState<any[]>([]);

  // Initialize workingData with mapped values and user business rules
  useEffect(() => {
    const initialized = data.map((rawRow) => {
      const student: any = {};
      
      // 1. Basic Mapping from Excel for all fields
      ERP_FIELDS.forEach(field => {
        const mappedHeader = mappings[field.key];
        let rawValue = '';

        if (mappedHeader) {
          if (mappedHeader.startsWith('__CUSTOM__:')) {
            rawValue = mappedHeader.substring(11);
          } else if (mappedHeader === '__DEFAULT_NA__') {
            rawValue = 'NA';
          } else if (mappedHeader !== 'ignore') {
            rawValue = rawRow[mappedHeader] !== undefined && rawRow[mappedHeader] !== null ? String(rawRow[mappedHeader]).trim() : '';
            
            // Check if there is a configured value mapping for this specific rawValue
            if (valueMappings && valueMappings[field.key] && valueMappings[field.key][rawValue]) {
              rawValue = valueMappings[field.key][rawValue];
            }
          }
        }
        
        student[field.key] = rawValue;
        
        // Special cleanup for numeric phone/regNo strings that might have ".0" from Excel
        if (['phone', 'regNo'].includes(field.key) && student[field.key].endsWith('.0')) {
          student[field.key] = student[field.key].replace('.0', '');
        }
      });

      // 2. Data Normalization & Specific Rules
      
      // Gender: normalize to full words if possible
      // Gender: robust normalization to "Male" or "Female"
      let isFemale = false;
      if (student.gender) {
        const v = String(student.gender).toUpperCase().trim();
        if (v.startsWith('F')) {
          student.gender = 'Female';
          isFemale = true;
        } else if (v.startsWith('M')) {
          student.gender = 'Male';
        }
      } else {
        student.gender = 'Male'; // Basic fallback if totally missing
      }

      // DOB/DOA Formatting
      if (student.dob) student.dob = formatExcelDate(student.dob);
      if (student.doa) {
        student.doa = formatExcelDate(student.doa);
      } else {
        student.doa = `${String(new Date().getDate()).padStart(2, '0')}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}`;
      }

      // 3. New Business Rules & Automated Logic
      
      // A. Mother's Name fallback
      if (!student.motherName) student.motherName = 'NA';
      
      // B. Batch & Section defaults
      if (!student.batch) student.batch = 'Sem 1';
      if (!student.section) student.section = 'A';

      // C. Category (Scheme) Logic based on globalCategory
      if (globalCategory === 'GIA') {
        student.category = isFemale ? 'GIA Girls' : 'GIA Boys';
      } else if (globalCategory === 'SFS') {
        student.category = isFemale ? 'SFS Girls' : 'SFS Boys';
      } else {
        // Fallback just in case
        student.category = isFemale ? 'SFS Girls' : 'SFS Boys';
      }
      
      // D. Final Override: Standardization for ERP Target
      if (erpCourseInfo) {
        student.course = erpCourseInfo.name;
        student.stream = erpCourseInfo.stream;
      } else {
        if (!student.course) student.course = 'Bachelor of Arts';
        student.stream = student.course;
      }

      return student;
    });
    setWorkingData(initialized);
  }, [data, mappings]);

  const filteredIndices = workingData
    .map((student, originalIndex) => ({ student, originalIndex }))
    .filter(({ student }) => {
      if (!searchTerm) return true;
      return Object.values(student).some((val) => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      );
    })
    .slice(0, 50);

  const handleCellEdit = (index: number, key: string, newValue: string) => {
    setWorkingData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: newValue };
      return updated;
    });
  };

  const handleAddToERP = async (originalIndex: number) => {
    const student = workingData[originalIndex];
    setStatusMap(prev => ({ ...prev, [originalIndex]: 'loading' }));
    
    try {
      const payload = { ...INITIAL_PAYLOAD_DEFAULTS, ...student };
      
      // The ERP backend (Mongoose) requires Date fields in YYYY-MM-DD (ISO) format.
      // Convert our UI DD-MM-YYYY format back to YYYY-MM-DD for the API payload.
      const convertToISO = (dateStr: string) => {
        if (!dateStr) return dateStr;
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
      };

      if (payload.dob) payload.dob = convertToISO(payload.dob);
      if (payload.doa) payload.doa = convertToISO(payload.doa);

      await addStudent(payload);
      setStatusMap(prev => ({ ...prev, [originalIndex]: 'success' }));
      
      if (activeFileId && payload.regNo && onStudentPushed) {
        try {
          await markStudentAsPushed(activeFileId, payload.regNo);
          onStudentPushed(payload.regNo);
        } catch (err) {
          console.error("Failed to mark student as pushed in DB", err);
        }
      }
    } catch (error: any) {
      setStatusMap(prev => ({ ...prev, [originalIndex]: 'error' }));
      setErrorMessages(prev => ({ ...prev, [originalIndex]: error?.response?.data?.message || (typeof error === 'string' ? error : 'API Error') }));
    }
  };


// ... (Inside DataPreview component)
  const handleDownloadExcel = () => {
    const exportData = workingData.map(student => {
      const row: any = {};
      ERP_FIELDS.forEach(field => {
        row[field.key] = student[field.key] || '';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mapped Data");
    XLSX.writeFile(workbook, "Mapped_Students.xlsx");
  };

  const handleDownloadApplicationData = () => {
    const today = `${String(new Date().getDate()).padStart(2, '0')}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}`;
    const exportData = workingData.map(student => {
      const row: any = {};
      row['applicationNumber'] = student['regNo'] || '';
      row['date'] = today;
      row['currentStage'] = '';
      row['userMobile'] = '';
      row['userName'] = '';
      
      const fieldsToKeep = ['course', 'stream', 'batch', 'section', 'oldNew', 'category', 'name', 'dob', 'gender', 'phone', 'fatherName', 'motherName'];
      fieldsToKeep.forEach(key => {
        row[key] = student[key] || '';
      });

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Application Data");
    XLSX.writeFile(workbook, "Application_Data.xlsx");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '24px', overflow: 'hidden' }}>
      {/* Search Header */}
      <div style={{ padding: '32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', flexWrap: 'wrap', gap: '16px' }}>
        <div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', marginBottom: '4px' }}>
              <Edit3 size={14} />
              <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>Manual Review & Edit</span>
           </div>
           <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Active Buffer Staging</h3>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={handleDownloadApplicationData} 
            className="btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 700 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Export App Data
          </button>
          <button 
            onClick={handleDownloadExcel} 
            className="btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 700 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export Excel
          </button>
          
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search records..."
              className="input-field"
              style={{ paddingLeft: '44px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table style={{ minWidth: '1000px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', width: '60px' }}>#</th>
              {ERP_FIELDS.map(field => (
                <th key={field.key} style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>{field.label}</span>
                    <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{field.key}</span>
                  </div>
                </th>
              ))}
              <th style={{ 
                textAlign: 'right', 
                position: 'sticky', 
                right: 0, 
                backgroundColor: 'var(--bg-main)', 
                boxShadow: '-4px 0 10px rgba(0,0,0,0.05)',
                zIndex: 10
              }}>EXECUTION</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {filteredIndices.map(({ student, originalIndex }) => {
                const isPushed = pushedRegistrationNumbers?.includes(student.regNo);
                const status = statusMap[originalIndex] || (isPushed ? 'success' : 'idle');
                
                return (
                  <motion.tr 
                    key={originalIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ 
                      background: status === 'success' ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                      transition: 'background 0.3s'
                    }}
                  >
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{originalIndex + 1}</td>
                    {ERP_FIELDS.map(field => (
                      <td key={field.key} style={{ padding: '4px', minWidth: '120px' }}>
                        <input 
                          type="text"
                          value={student[field.key]}
                          onChange={(e) => handleCellEdit(originalIndex, field.key, e.target.value)}
                          disabled={status === 'success' || status === 'loading'}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: '1px solid transparent',
                            color: 'var(--text-primary)',
                            padding: '8px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            outline: 'none',
                            transition: 'all 0.2s'
                          }}
                          onFocus={(e) => { e.target.style.background = 'rgba(255,255,255,0.02)'; e.target.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                          onBlur={(e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }}
                        />
                      </td>
                    ))}
                    <td style={{ 
                      textAlign: 'right', 
                      position: 'sticky', 
                      right: 0, 
                      backgroundColor: 'var(--bg-card)', 
                      boxShadow: '-4px 0 10px rgba(0,0,0,0.05)',
                      zIndex: 10
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 8px' }}>
                        {status === 'success' ? (
                          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '6px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 900 }}>
                            <Check size={12} style={{ marginRight: '4px' }} /> {isPushed && !statusMap[originalIndex] ? 'ALREADY PUSHED' : 'PUSHED'}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: '4px' }}>
                            <button
                              disabled={status === 'loading'}
                              onClick={() => handleAddToERP(originalIndex)}
                              className="btn-primary"
                              style={{ padding: '8px 16px', fontSize: '11px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              {status === 'loading' ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <PlayCircle size={12} />
                              )}
                              {status === 'error' ? 'RETRY' : 'ADD_REC'}
                            </button>
                            {status === 'error' && (
                              <span style={{ fontSize: '8px', color: '#ef4444', fontWeight: 800, maxWidth: '100px', overflow: 'hidden' }}>
                                {errorMessages[originalIndex]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      
      {/* Buffer Status */}
      <div style={{ padding: '16px 32px', background: 'var(--bg-main)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', margin: 0, letterSpacing: '1px' }}>B_BATCH_050</p>
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }}></div>
            <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--accent)' }}>SYNC_READY</span>
         </div>
      </div>
    </div>
  );
};
