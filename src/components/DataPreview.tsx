import React, { useState, useEffect } from 'react';
import { Search, Check, Loader2, PlayCircle, Edit3 } from 'lucide-react';
import { ERP_FIELDS, INITIAL_PAYLOAD_DEFAULTS } from '../constants/erpFields';
import { formatExcelDate } from '../utils/excelUtils';
import { addStudent, markStudentAsPushed } from '../utils/auth';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx-js-style';

interface DataPreviewProps {
  data: any[];
  mappings: Record<string, string>;
  valueMappings?: Record<string, Record<string, string>>;
  erpCourseInfo?: { name: string, stream: string } | null;
  globalCategory?: string;
  activeFileIds?: string[];
  pushedRegistrationNumbers?: string[];
  onStudentPushed?: (regNo: string) => void;
  entityId?: string;
  session?: string;
  initialSearchTerm?: string;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ data, mappings, valueMappings, erpCourseInfo, globalCategory, activeFileIds = [], pushedRegistrationNumbers = [], onStudentPushed, entityId, session, initialSearchTerm }) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [statusMap, setStatusMap] = useState<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [errorMessages, setErrorMessages] = useState<Record<number, string>>({});
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  // Reset to page 1 whenever search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // workingData stores the ACTUAL VALUES for each student, not just the excel row
  const [workingData, setWorkingData] = useState<any[]>([]);

  // Initialize workingData with mapped values and user business rules
  useEffect(() => {
    const regNoCounts: Record<string, number> = {};

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

      // Use row-specific globalCategory if available (from merged files)
      const rowCategory = rawRow._globalCategory || globalCategory;
      let computedCategory = '';

      if (rowCategory === 'GIA') {
        computedCategory = isFemale ? 'GIA Girls' : 'GIA Boys';
      } else if (rowCategory === 'SFS') {
        computedCategory = isFemale ? 'SFS Girls' : 'SFS Boys';
      } else {
        computedCategory = isFemale ? 'SFS Girls' : 'SFS Boys'; // Fallback
      }

      const isCategoryConfigured = mappings['category'] && mappings['category'] !== 'ignore';
      if (isCategoryConfigured) {
        // If Category is configured from Excel, it keeps the Excel value (like SC).
        // The computed value (GIA Girls) goes to oldNew.
        student.oldNew = computedCategory;
      } else {
        // If Old/New is configured from Excel, it keeps the Excel value (like SC).
        // The computed value (GIA Girls) goes to category.
        student.category = computedCategory;
      }

      // Preserve hidden meta-fields for ERP push
      if (rawRow._courseInfo) student._courseInfo = rawRow._courseInfo;
      if (rawRow._sourceFileId) student._sourceFileId = rawRow._sourceFileId;

      // D. Final Override: Standardization for ERP Target
      const rowCourseInfo = rawRow._courseInfo || erpCourseInfo;
      if (rowCourseInfo) {
        student.course = rowCourseInfo.name;
        student.stream = rowCourseInfo.stream;
      } else {
        if (!student.course) student.course = 'Bachelor of Arts';
        student.stream = student.course;
      }

      // E. Registration Number Duplicacy Handling
      if (student.regNo) {
        const baseRegNo = String(student.regNo).trim();
        student._originalRegNo = baseRegNo;
        if (baseRegNo) {
          if (regNoCounts[baseRegNo] === undefined) {
            regNoCounts[baseRegNo] = 0;
            student.regNo = baseRegNo;
          } else {
            regNoCounts[baseRegNo]++;
            const count = regNoCounts[baseRegNo];
            // count 1 -> 'A', count 2 -> 'B', etc.
            const suffix = String.fromCharCode(64 + count);
            student.regNo = `${baseRegNo}${suffix}`;
          }
        }
      }

      return student;
    });
    setWorkingData(initialized);
  }, [data, mappings]);

  const allFilteredIndices = workingData
    .map((student, originalIndex) => ({ student, originalIndex }))
    .filter(({ student }) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return Object.values(student).some(val =>
        String(val).toLowerCase().includes(term)
      );
    });

  const totalPages = Math.max(1, Math.ceil(allFilteredIndices.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const filteredIndices = allFilteredIndices.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );

  const duplicateRegNos = React.useMemo(() => {
    const counts: Record<string, number> = {};
    workingData.forEach(student => {
      const regNo = student._originalRegNo || student.regNo;
      if (regNo) {
        counts[regNo] = (counts[regNo] || 0) + 1;
      }
    });
    return Object.keys(counts).filter(regNo => counts[regNo] > 1);
  }, [workingData]);

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
      let payloadCourseName = student._courseInfo ? student._courseInfo.name : (erpCourseInfo ? erpCourseInfo.name : '');
      let payloadStream = student._courseInfo ? student._courseInfo.stream : (erpCourseInfo ? erpCourseInfo.stream : '');
      
      payloadCourseName = Array.isArray(payloadCourseName) ? payloadCourseName[0] : payloadCourseName;
      payloadStream = Array.isArray(payloadStream) ? payloadStream[0] : payloadStream;
      
      const payload = { 
        ...INITIAL_PAYLOAD_DEFAULTS, 
        ...student, 
        course: payloadCourseName, 
        stream: payloadStream,
        ...(entityId && { entity: entityId }),
        ...(session && { session })
      };
      
      // Remove any columns that the user has hidden
      hiddenColumns.forEach(col => {
        delete payload[col];
      });
      
      // Remove meta-fields before showing to user
      const sourceFileId = student._sourceFileId;
      delete payload._courseInfo;
      delete payload._sourceFileId;

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

      const fileToPush = sourceFileId || (activeFileIds.length > 0 ? activeFileIds[0] : null);
      if (fileToPush && payload.regNo && onStudentPushed) {
        try {
          await markStudentAsPushed(fileToPush, payload.regNo);
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
      ERP_FIELDS.filter(f => !hiddenColumns.includes(f.key)).forEach(field => {
        row[field.key] = student[field.key] || '';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Apply styling to duplicate rows
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const studentIndex = R - 1; // offset by 1 for header
      if (studentIndex >= 0 && studentIndex < workingData.length) {
        const student = workingData[studentIndex];
        const isDuplicate = student.regNo && duplicateRegNos.includes(student._originalRegNo || student.regNo);
        
        if (isDuplicate) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = {c: C, r: R};
            const cellRef = XLSX.utils.encode_cell(cellAddress);
            if (!worksheet[cellRef]) continue;
            
            worksheet[cellRef].s = {
              fill: {
                fgColor: { rgb: "FFFFCCCC" } // Light red background
              },
              font: {
                color: { rgb: "FFFF0000" } // Red text
              }
            };
          }
        }
      }
    }

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

      const fieldsToKeep = ['course', 'stream', 'batch', 'section', 'oldNew', 'category', 'name', 'dob', 'gender', 'phone', 'fatherName', 'motherName', 'state', 'nationality', 'country', 'socialCategory', 'religion'].filter(f => !hiddenColumns.includes(f));
      fieldsToKeep.forEach(key => {
        row[key] = student[key] || '';
      });

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Apply styling to duplicate rows
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const studentIndex = R - 1; // offset by 1 for header
      if (studentIndex >= 0 && studentIndex < workingData.length) {
        const student = workingData[studentIndex];
        const isDuplicate = student.regNo && duplicateRegNos.includes(student.regNo);
        
        if (isDuplicate) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = {c: C, r: R};
            const cellRef = XLSX.utils.encode_cell(cellAddress);
            if (!worksheet[cellRef]) continue;
            
            worksheet[cellRef].s = {
              fill: {
                fgColor: { rgb: "FFFFCCCC" }
              },
              font: {
                color: { rgb: "FFFF0000" }
              }
            };
          }
        }
      }
    }

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
          {hiddenColumns.length > 0 && (
            <button
              onClick={() => setHiddenColumns([])}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
              Restore Columns ({hiddenColumns.length})
            </button>
          )}
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
              {ERP_FIELDS.filter(f => !hiddenColumns.includes(f.key)).map(field => (
                <th key={field.key} style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>{field.label}</span>
                      <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{field.key}</span>
                    </div>
                    <button 
                      onClick={() => setHiddenColumns(prev => [...prev, field.key])}
                      title="Hide column"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: '0 4px', fontWeight: 'bold' }}
                    >×</button>
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
                const isDuplicate = student.regNo && duplicateRegNos.includes(student._originalRegNo || student.regNo);

                return (
                  <motion.tr
                    key={originalIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      background: status === 'success' ? 'rgba(16, 185, 129, 0.05)' : isDuplicate ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                      transition: 'background 0.3s'
                    }}
                  >
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{originalIndex + 1}</td>
                    {ERP_FIELDS.filter(f => !hiddenColumns.includes(f.key)).map(field => (
                      <td key={field.key} style={{ padding: '4px', minWidth: '120px', position: 'relative' }}>
                        <input
                          type="text"
                          value={student[field.key]}
                          onChange={(e) => handleCellEdit(originalIndex, field.key, e.target.value)}
                          disabled={status === 'success' || status === 'loading'}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: '1px solid transparent',
                            color: isDuplicate && field.key === 'regNo' ? '#ef4444' : 'var(--text-primary)',
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
                        {field.key === 'regNo' && isDuplicate && (
                          <span style={{ position: 'absolute', top: '10px', right: '12px', fontSize: '9px', background: '#ef4444', color: 'white', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold' }}>DUP</span>
                        )}
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

      {/* Pagination + Buffer Status */}
      <div style={{ padding: '16px 32px', background: 'var(--bg-main)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', margin: 0, letterSpacing: '1px' }}>B_BATCH_050</p>

        {/* Pagination Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
            {allFilteredIndices.length === 0 ? '0 records' : `${(safeCurrentPage - 1) * PAGE_SIZE + 1}–${Math.min(safeCurrentPage * PAGE_SIZE, allFilteredIndices.length)} of ${allFilteredIndices.length}`}
          </span>
          <button
            disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{
              background: safeCurrentPage <= 1 ? 'transparent' : 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: safeCurrentPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              transition: 'all 0.2s'
            }}
          >← Prev</button>
          <span style={{ fontSize: '12px', fontWeight: 900, color: 'var(--accent)', minWidth: '80px', textAlign: 'center' }}>
            Page {safeCurrentPage} / {totalPages}
          </span>
          <button
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            style={{
              background: safeCurrentPage >= totalPages ? 'transparent' : 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: safeCurrentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              transition: 'all 0.2s'
            }}
          >Next →</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }}></div>
          <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--accent)' }}>SYNC_READY</span>
        </div>
      </div>
    </div>
  );
};
