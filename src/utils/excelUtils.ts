import * as XLSX from 'xlsx';

export const parseExcelFile = (file: File): Promise<{ headers: string[], data: any[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        // Convert to 2D array to inspect rows and find the true header row
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
        
        if (rawData.length === 0) {
          resolve({ headers: [], data: [] });
          return;
        }

        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(15, rawData.length); i++) {
           const rowStr = rawData[i].join(' ').toLowerCase();
           if (rowStr.includes('registration') || rowStr.includes('course name') || rowStr.includes('student')) {
              headerRowIndex = i;
              break;
           }
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', range: headerRowIndex });
        
        if (jsonData.length === 0) {
          resolve({ headers: [], data: [] });
          return;
        }

        const headers = Object.keys(jsonData[0] as object);

        const courseNameHeader = headers.find(h => h.toLowerCase().includes('course name') || h.toLowerCase() === 'coursename');
        
        if (courseNameHeader) {
          if (!headers.includes('subjectCombination')) {
            headers.push('subjectCombination');
          }
          jsonData.forEach((row: any) => {
            const courseName = row[courseNameHeader];
            if (typeof courseName === 'string') {
              const matches = [...courseName.matchAll(/\(([^()]+)\)/g)];
              if (matches.length > 0) {
                row['subjectCombination'] = matches[matches.length - 1][1].trim();
              } else {
                row['subjectCombination'] = '';
              }
            }
          });
        }

        resolve({ headers, data: jsonData });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

export const formatExcelDate = (value: any): string => {
  if (!value) return '';
  
  let date: Date;
  
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    date = new Date(d.y, d.m - 1, d.d);
  } else {
    const dateStr = String(value).trim();
    
    // First try manual parsing for DD-MM-YYYY or DD/MM/YYYY
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      
      // Handle 2-digit years if necessary, though typical is 4
      if (y < 100) y += 2000;
      
      if (y > 1000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) { 
        date = new Date(y, m - 1, d);
      }
    }
    
    // If manual parsing didn't result in a valid date, fallback to standard parsing
    if (!date || isNaN(date.getTime())) {
      date = new Date(dateStr);
    }
  }

  if (isNaN(date.getTime())) return String(value);

  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
};

export const autoMapFields = (excelHeaders: string[], erpFields: any[]): Record<string, string> => {
  const mapping: Record<string, string> = {};
  
  erpFields.forEach(field => {
    const match = excelHeaders.find(header => {
      const lowerHeader = header.toLowerCase();
      return field.autoMapKeywords.some((keyword: string) => lowerHeader.includes(keyword.toLowerCase()));
    });
    
    if (match) {
      mapping[field.key] = match;
    }
  });
  
  return mapping;
};
