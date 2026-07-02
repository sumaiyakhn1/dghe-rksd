import React from 'react';
import { ERP_FIELDS } from '../constants/erpFields';
import { CheckCircle2, ChevronDown, Info } from 'lucide-react';
import { motion } from 'framer-motion';

interface MappingSelectorProps {
  excelHeaders: string[];
  mappings: Record<string, string>;
  onMappingChange: (erpKey: string, excelHeader: string) => void;
}

export const MappingSelector: React.FC<MappingSelectorProps> = ({ excelHeaders, mappings, onMappingChange }) => {
  const isOldNewConfigured = mappings['oldNew'] && mappings['oldNew'] !== 'ignore';
  const isCategoryConfigured = mappings['category'] && mappings['category'] !== 'ignore';

  const fieldsToRender = ERP_FIELDS.filter(field => {
    if (field.key === 'oldNew' && isOldNewConfigured) return false;
    if (field.key === 'category' && isCategoryConfigured) return false;
    return true;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
      {fieldsToRender.map((field, idx) => {
        const isMapped = !!mappings[field.key];
        
        // Define which fields have automatic defaults to show in UI
        const autoDefaults: Record<string, string> = {
          motherName: "NA",
          batch: "Sem 1",
          section: "A",
          course: "Bachelor of Arts",
          stream: "Same as Course",
          doa: "Current Date",
          category: "Auto GIA/SFS"
        };
        
        const defaultValue = autoDefaults[field.key];
        
        return (
          <motion.div 
            key={field.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: idx * 0.02 }}
            style={{
              position: 'relative',
              padding: '24px',
              borderRadius: '24px',
              background: isMapped ? 'rgba(37, 99, 235, 0.03)' : 'var(--bg-card)',
              border: isMapped ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid var(--border)',
              transition: 'all 0.3s'
            }}
          >
            {isMapped && (
              <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--accent)' }}>
                <CheckCircle2 size={18} />
              </div>
            )}

            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'start', gap: '12px' }}>
               <div style={{ 
                 marginTop: '6px', 
                 width: '6px', 
                 height: '6px', 
                 borderRadius: '50%', 
                 background: field.required ? '#ef4444' : '#10b981',
                 boxShadow: field.required ? '0 0 10px rgba(239, 68, 68, 0.4)' : '0 0 10px rgba(16, 185, 129, 0.2)' 
               }}></div>
               <div>
                  <label style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', marginBottom: '2px', display: 'block' }}>
                    {defaultValue ? 'ERP AUTO-TARGET' : 'ERP TARGET'}
                  </label>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>
                    {field.label}
                  </h4>
               </div>
            </div>

            <div style={{ position: 'relative' }}>
              <select
                value={mappings[field.key] || ''}
                onChange={(e) => onMappingChange(field.key, e.target.value)}
                className="input-field"
                style={{ 
                  appearance: 'none', 
                  paddingRight: '40px',
                  borderColor: isMapped ? 'rgba(37, 99, 235, 0.3)' : (defaultValue ? '#10b98133' : '#d1d5db'),
                  color: isMapped ? '#2563eb' : (defaultValue ? '#10b981' : '#111827'),
                  backgroundColor: isMapped ? '#f9fafb' : (defaultValue ? '#f0fdf4' : '#f9fafb')
                }}
              >
                <option value="">{defaultValue ? `-- USE DEFAULT (${defaultValue}) --` : '-- UNMAPPED --'}</option>
                {excelHeaders.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
              <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }}>
                <ChevronDown size={14} />
              </div>
            </div>
            
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isMapped ? (
                <>
                  <div style={{ width: '12px', height: '1px', background: '#2563eb', opacity: 0.3 }}></div>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#2563eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Mapped to: {mappings[field.key]}
                  </span>
                </>
              ) : defaultValue ? (
                <>
                  <div style={{ width: '12px', height: '1px', background: '#10b981', opacity: 0.5 }}></div>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#059669' }}>Auto: {defaultValue}</span>
                </>
              ) : (
                <>
                  <Info size={12} color="var(--text-muted)" />
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Selection required</span>
                </>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
