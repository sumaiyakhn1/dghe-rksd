import React, { useRef, useState } from 'react';
import { Loader2, ArrowLeft, Save, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { saveEntityMapping } from '../utils/auth';
import type { Entity } from '../utils/auth';
import { parseExcelFile } from '../utils/excelUtils';

interface MappingSetupProps {
  entity: Entity;
  onBack: () => void;
  onMappingSaved: (updatedEntity: Entity) => void;
}

const ERP_FIELDS = [
  { key: 'name', label: 'Student Name', autoTarget: false, autoMapKeywords: ['studentfullname', 'student name', 'fullname', 'student', 'name'] },
  { key: 'fatherName', label: "Father's Name", autoTarget: false, autoMapKeywords: ['father', 'parent'] },
  { key: 'motherName', label: "Mother's Name", autoTarget: true, defaultOption: 'NA', autoMapKeywords: ['mother'] },
  { key: 'dob', label: 'Date of Birth', autoTarget: false, autoMapKeywords: ['dob', 'birth', 'date'] },
  { key: 'regNo', label: 'Registration No', autoTarget: false, autoMapKeywords: ['registration_id', 'reg', 'enrollment', 'registration'] },
  { key: 'batch', label: 'Batch', autoTarget: true, defaultOption: 'Sem 1', autoMapKeywords: ['batch', 'year', 'semester'] },
  { key: 'section', label: 'Section', autoTarget: true, defaultOption: 'A', autoMapKeywords: ['section'] },
  { key: 'oldNew', label: 'Old/New', autoTarget: false, autoMapKeywords: ['seat allocation', 'allocation', 'old', 'new'] },
  { key: 'gender', label: 'Gender', autoTarget: false, autoMapKeywords: ['gender', 'sex'] },
  { key: 'phone', label: 'Phone', autoTarget: false, autoMapKeywords: ['mobile', 'phone', 'contact'] },
  { key: 'doa', label: 'Date of Admission', autoTarget: true, defaultOption: `${String(new Date().getDate()).padStart(2, '0')}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}`, autoMapKeywords: ['doa', 'admission'] }
];

export const MappingSetup: React.FC<MappingSetupProps> = ({ entity, onBack, onMappingSaved }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for sample excel upload
  const [sampleHeaders, setSampleHeaders] = useState<string[]>(
    entity.sampleHeaders && entity.sampleHeaders.length > 0 
      ? entity.sampleHeaders 
      : ["SrNo.", "College", "Course Name", "Registration_Id", "StudentFullName", "Father Name", "MobileNo", "Gender", "DOB", "Reservation Category", "Seat Allocation Category", "12th %", "Weightage", "Total Marks"]
  );
  const [sampleFileName, setSampleFileName] = useState<string | null>("Standard Template");
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [parsing, setParsing] = useState(false);
  
  // mapping: { erpKey -> excelHeader }
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    if (entity.mapping && Object.keys(entity.mapping).length > 0) {
      return entity.mapping;
    }
    
    // Auto-map initial headers
    const initialMap: Record<string, string> = {};
    const defaultHeaders = entity.sampleHeaders && entity.sampleHeaders.length > 0 
      ? entity.sampleHeaders 
      : ["SrNo.", "College", "Course Name", "Registration_Id", "StudentFullName", "Father Name", "MobileNo", "Gender", "DOB", "Reservation Category", "Seat Allocation Category", "12th %", "Weightage", "Total Marks"];
      
    ERP_FIELDS.forEach(field => {
      if (field.autoTarget && field.defaultOption) {
        initialMap[field.key] = `__CUSTOM__:${field.defaultOption}`;
      } else {
        const match = defaultHeaders.find(h => {
          const lowerHeader = h.toLowerCase();
          return field.autoMapKeywords.some(keyword => lowerHeader.includes(keyword.toLowerCase()));
        });
        if (match) initialMap[field.key] = match;
      }
    });
    return initialMap;
  });
  const [valueMappings, setValueMappings] = useState<Record<string, Record<string, string>>>(entity.valueMappings || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeValueMapField, setActiveValueMapField] = useState<string | null>(null);

  const [feeMasterOptions, setFeeMasterOptions] = useState<{ category: string[], oldNew: string[] } | null>(null);

  React.useEffect(() => {
    const fetchOptions = async () => {
      try {
        const data = await import('../utils/auth').then(m => m.getFeeMaster(entity.entityId, entity.session));
        setFeeMasterOptions({
          category: data.category || [],
          oldNew: data.oldNew || []
        });
        console.log('Fetched fee master options:', { category: data.category, oldNew: data.oldNew });
      } catch (err) {
        console.error('Failed to fetch fee master:', err);
      }
    };
    fetchOptions();
  }, [entity]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setParsing(true);
      const { headers, data } = await parseExcelFile(file);
      setSampleHeaders(headers);
      setSampleData(data);
      setSampleFileName(file.name);
      
      // Auto-map if possible
      const newMap = { ...mapping };
      ERP_FIELDS.forEach(field => {
        if (!newMap[field.key]) {
          if (field.autoTarget && field.defaultOption) {
            newMap[field.key] = `__CUSTOM__:${field.defaultOption}`;
          } else {
            const match = headers.find(h => {
              const lowerHeader = h.toLowerCase();
              return field.autoMapKeywords.some(keyword => lowerHeader.includes(keyword.toLowerCase()));
            });
            if (match) newMap[field.key] = match;
          }
        }
      });
      setMapping(newMap);
    } catch (err) {
      console.error(err);
      alert("Failed to parse sample Excel file. Please ensure it is a valid .xlsx or .xls file.");
    } finally {
      setParsing(false);
    }
  };

  const handleSelectField = (erpKey: string, excelHeader: string) => {
    setMapping(prev => ({
      ...prev,
      [erpKey]: excelHeader
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const updatedEntity = await saveEntityMapping(entity._id, mapping, sampleHeaders, valueMappings);
      onMappingSaved(updatedEntity);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || err.message || 'Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button onClick={onBack} className="btn-secondary" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 900, margin: '0 0 4px 0', textTransform: 'uppercase' }}>Mapping Configuration</p>
            <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0', letterSpacing: '-0.5px' }}>{entity.name}</h2>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {sampleFileName && (
            <button 
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Save Mapping
            </button>
          )}
        </div>
      </div>

      {/* Step 2: Mapping Grid */}
      {(sampleFileName || Object.keys(mapping).length > 0) && (
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0' }}>Mapping Headers</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Sample: <span style={{ fontWeight: 700 }}>{sampleFileName || 'Saved Mapping'}</span>
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
            {ERP_FIELDS.map(field => {
              const mappedValue = mapping[field.key] || '';
              const isCustom = mappedValue.startsWith('__CUSTOM__:');
              const customValue = isCustom ? mappedValue.substring(11) : '';
              const isMapped = mappedValue && mappedValue !== 'ignore';

              return (
                <div key={field.key} style={{ 
                  background: isCustom ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-input)', 
                  border: `1px solid ${isMapped ? 'rgba(37, 99, 235, 0.2)' : 'var(--border)'}`, 
                  borderRadius: '16px', 
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: field.autoTarget ? '#10b981' : '#ef4444' }}></div>
                      <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {field.autoTarget ? 'ERP AUTO-TARGET' : 'ERP TARGET'}
                      </span>
                    </div>
                    {isMapped && <CheckCircle2 size={16} color="#2563eb" />}
                  </div>

                  <h4 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>{field.label}</h4>

                  <select 
                    className="input-field"
                    style={{ margin: 0, padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                    value={isCustom ? '__CUSTOM__' : (mappedValue || 'ignore')}
                    onChange={e => {
                      if (e.target.value === '__CUSTOM__') {
                        handleSelectField(field.key, '__CUSTOM__:' + (field.defaultOption || ''));
                      } else {
                        handleSelectField(field.key, e.target.value);
                      }
                    }}
                  >
                    <option value="ignore">-- Ignore --</option>
                    <option value="__CUSTOM__">-- Enter Custom Value --</option>
                    {mappedValue && mappedValue !== 'ignore' && !isCustom && !sampleHeaders.includes(mappedValue) && (
                      <option value={mappedValue}>{mappedValue} (Previously Mapped)</option>
                    )}
                    {sampleHeaders.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>

                  {['oldNew', 'category'].includes(field.key) && !isCustom && mappedValue && mappedValue !== 'ignore' && (
                    <button
                      onClick={() => {
                        if (sampleData.length === 0 && field.key !== 'oldNew') {
                          alert('Please upload a sample Excel file above to configure value mappings. The system needs the data rows to extract unique values.');
                          return;
                        }
                        setActiveValueMapField(field.key);
                      }}
                      className="btn-secondary"
                      style={{ marginTop: '8px', padding: '8px', fontSize: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                    >
                      Configure Value Map {valueMappings[field.key] && Object.keys(valueMappings[field.key]).length > 0 ? '✓' : ''}
                    </button>
                  )}

                  {isCustom && field.key === 'oldNew' && feeMasterOptions?.oldNew ? (
                    <select
                      className="input-field"
                      style={{ margin: 0, padding: '10px 16px', fontSize: '13px', background: 'white', border: '1px solid var(--border)' }}
                      value={customValue}
                      onChange={e => handleSelectField(field.key, '__CUSTOM__:' + e.target.value)}
                    >
                      <option value="">-- Select Old/New --</option>
                      {feeMasterOptions.oldNew.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : isCustom && field.key === 'category' && feeMasterOptions?.category ? (
                    <select
                      className="input-field"
                      style={{ margin: 0, padding: '10px 16px', fontSize: '13px', background: 'white', border: '1px solid var(--border)' }}
                      value={customValue}
                      onChange={e => handleSelectField(field.key, '__CUSTOM__:' + e.target.value)}
                    >
                      <option value="">-- Select Category --</option>
                      {feeMasterOptions.category.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : isCustom ? (
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Enter custom value..."
                      style={{ margin: 0, padding: '10px 16px', fontSize: '13px', background: 'white' }}
                      value={customValue}
                      onChange={e => handleSelectField(field.key, '__CUSTOM__:' + e.target.value)}
                    />
                  ) : null}

                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '1px', background: '#2563eb', opacity: 0.3 }}></div>
                    {isCustom ? `FIXED: ${customValue || '(Empty)'}` : (isMapped ? `MAPPED TO: ${mappedValue}` : 'NOT MAPPED')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeValueMapField && (
        <ValueMappingModal
          fieldKey={activeValueMapField}
          mappedColumn={mapping[activeValueMapField]}
          sampleData={sampleData}
          feeMasterOptions={feeMasterOptions}
          currentMap={valueMappings[activeValueMapField] || {}}
          onSave={(map: any) => {
            setValueMappings({ ...valueMappings, [activeValueMapField]: map });
            setActiveValueMapField(null);
          }}
          onClose={() => setActiveValueMapField(null)}
        />
      )}
    </div>
  );
};

const ValueMappingModal = ({ fieldKey, mappedColumn, sampleData, feeMasterOptions, currentMap, onSave, onClose }: any) => {
  const [map, setMap] = useState<Record<string, string>>(currentMap);
  
  // Extract unique values for the selected column
  let uniqueValues = Array.from(new Set(sampleData.map((row: any) => row[mappedColumn] !== undefined ? String(row[mappedColumn]).trim() : '').filter(Boolean)));
  if (fieldKey === 'oldNew') {
    uniqueValues = ['AIOC', 'EWS-AIOC', 'HOGC', 'EWS-HOGC', 'BCA', 'BCB', 'OSC', 'DSC', 'DA'];
  }
  const options = fieldKey === 'oldNew' ? feeMasterOptions?.oldNew : feeMasterOptions?.category;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Value Mapping: {fieldKey}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Map the unique values found in your Excel column <strong>"{mappedColumn}"</strong> to the valid ERP values.
          </p>
          
          {uniqueValues.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No values found in this column.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {uniqueValues.map((val: any) => (
                <div key={val} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>{val}</div>
                  <div style={{ flex: 1 }}>
                    <select
                      className="input-field"
                      style={{ margin: 0, padding: '8px', fontSize: '13px', background: 'white' }}
                      value={map[val] || ''}
                      onChange={(e) => setMap({ ...map, [val]: e.target.value })}
                    >
                      <option value="">-- Select ERP Value --</option>
                      {options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
          <button onClick={() => onSave(map)} className="btn-primary" style={{ padding: '8px 16px' }}>Save Value Map</button>
        </div>
      </div>
    </div>
  );
};
