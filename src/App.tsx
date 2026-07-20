import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import { FileUpload } from './components/FileUpload';
import { DataPreview } from './components/DataPreview';
import { getAuthToken, logout as authLogout, getCourses, saveUserFile, saveFileConfig, searchStudents } from './utils/auth';
import type { Entity } from './utils/auth';
import { ERP_FIELDS } from './constants/erpFields';
import { autoMapFields } from './utils/excelUtils';
import { LoginForm } from './components/LoginForm';
import { EntitiesDashboard } from './components/EntitiesDashboard';
import {
  ArrowLeft,
  ArrowRight,
  User,
  ShieldCheck,
  Loader2,
  LayoutGrid,
  Search,
  X
} from 'lucide-react';

type Step = 'auth' | 'entities' | 'upload' | 'map' | 'preview';

function App() {
  const [excelData, setExcelData] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [activeStep, setActiveStep] = useState<Step>('auth');
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAuthToken());

  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  const [erpCourses, setErpCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [courseInfo, setCourseInfo] = useState<{ name: string, stream: string } | null>(null);
  const [globalCategory, setGlobalCategory] = useState<string>('');
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isSavingData, setIsSavingData] = useState(false);

  const [activeFileIds, setActiveFileIds] = useState<string[]>([]);
  const [pushedRegistrationNumbers, setPushedRegistrationNumbers] = useState<string[]>([]);


  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<any[] | null>(null);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);
  const [previewSearchTerm, setPreviewSearchTerm] = useState<string>('');

  useEffect(() => {
    if (!globalSearchQuery || globalSearchQuery.trim().length < 1) {
      setGlobalSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsGlobalSearching(true);
      try {
        const results = await searchStudents(globalSearchQuery);
        setGlobalSearchResults(results);
      } catch (err) {
        console.error(err);
      } finally {
        setIsGlobalSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [globalSearchQuery]);

  // eslint-disable-next-line
  useEffect(() => {
    if (isAuthenticated) {
      if (!selectedEntity) {
        setActiveStep('entities');
      } else {
        if (excelData.length > 0) {
          if (activeStep === 'auth' || activeStep === 'entities' || activeStep === 'upload') setActiveStep('map');
        } else {
          if (activeStep === 'auth' || activeStep === 'entities') setActiveStep('upload');
        }
      }
    } else {
      setActiveStep('auth');
    }
  }, [isAuthenticated, selectedEntity, excelData.length]);

  useEffect(() => {
    if (isAuthenticated && selectedEntity) {
      const fetchCourses = async () => {
        try {
          setIsLoadingCourses(true);
          const response = await getCourses(selectedEntity.entityId, selectedEntity.session);

          let courses = [];
          if (Array.isArray(response)) courses = response;
          else if (response && Array.isArray(response.data)) courses = response.data;
          else if (response && response.data && Array.isArray(response.data.data)) courses = response.data.data;

          setErpCourses(courses);
        } catch (error) {
          console.error("Error fetching courses:", error);
        } finally {
          setIsLoadingCourses(false);
        }
      };
      fetchCourses();
    } else {
      setErpCourses([]);
    }
  }, [isAuthenticated, selectedEntity]);

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);
    if (!courseId) {
      setCourseInfo(null);
      return;
    }

    const course = erpCourses.find(c => c._id === courseId);
    if (course) {
      setCourseInfo({
        name: course.name,
        stream: course.name
      });
    }
  };

  const handleLogout = () => {
    authLogout();
    setIsAuthenticated(false);
    setSelectedEntity(null);
    handleReset();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDataLoaded = useCallback((newHeaders: string[], newData: any[], name: string) => {
    setExcelData(newData);
    setFileName(name);
    setActiveStep('map');

    const savedMapping = selectedEntity?.mapping || {};
    const autoMappings = autoMapFields(newHeaders, ERP_FIELDS);
    if (Object.keys(savedMapping).length > 0) {
      setMappings({ ...autoMappings, ...savedMapping });
    } else {
      setMappings(autoMappings);
    }
  }, [selectedEntity]);

  const handleReset = () => {
    setExcelData([]);
    setFileName(null);
    if (selectedEntity) setActiveStep('upload');
    else setActiveStep('entities');
  };

  const handleBackToWorkspace = () => {
    setActiveStep('entities');
  };

  const isMappingValid = () => {
    if (!courseInfo) return false;
    if (!globalCategory) return false;
    // We already require workspace mapping to be defined
    if (!mappings || Object.keys(mappings).length === 0) return false;
    return true;
  };

  const handleEntitySelect = (entity: Entity) => {
    setSelectedEntity(entity);
    setExcelData([]);
    setFileName(null);
    setMappings({});
    setActiveFileIds([]);
    setPushedRegistrationNumbers([]);
    setActiveStep('upload');
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLoadSavedFiles = async (entity: Entity, fileIds: string[], fileConfigs: Record<string, { courseInfo: any, globalCategory: string }>) => {
    try {
      setSelectedEntity(entity);
      const { getFileData } = await import('./utils/auth');
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let allExcelData: any[] = [];
      let allPushedRegNos: string[] = [];
      let firstMapping = {};
      let combinedFileName = '';

      for (let i = 0; i < fileIds.length; i++) {
        const fileId = fileIds[i];
        const fileData = await getFileData(fileId);
        const config = fileConfigs[fileId];

        if (i === 0) {
          firstMapping = fileData.mapping;
          combinedFileName = fileIds.length > 1 ? `${fileData.fileName} + ${fileIds.length - 1} more` : fileData.fileName;
        }

        // Attach config to each row
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowsWithConfig = fileData.excelData.map((row: any) => ({
          ...row,
          _courseInfo: config?.courseInfo || null,
          _globalCategory: config?.globalCategory || null,
          _sourceFileId: fileId
        }));

        allExcelData = [...allExcelData, ...rowsWithConfig];
        if (fileData.pushedRegistrationNumbers) {
          allPushedRegNos = [...allPushedRegNos, ...fileData.pushedRegistrationNumbers];
        }
      }

      setFileName(combinedFileName);
      setMappings(firstMapping);
      setExcelData(allExcelData);
      setActiveFileIds(fileIds);
      setPushedRegistrationNumbers(allPushedRegNos);
      
      // Clear global states so that DataPreview uses the row-level configs
      setSelectedCourseId('');
      setCourseInfo(null);
      setGlobalCategory('');

      setActiveStep('preview');
    } catch (err) {
      console.error("Failed to load full file data", err);
      alert("Failed to load the file data from the server.");
    }
  };

  const handleSaveData = async (action: 'preview' | 'entities') => {
    if (!selectedEntity || !fileName) return;
    try {
      setIsSavingData(true);
      const savedData = await saveUserFile(selectedEntity._id, fileName || 'Untitled.xlsx', mappings, excelData);
      
      if (savedData.fileId && selectedCourseId && globalCategory) {
        await saveFileConfig(savedData.fileId, selectedCourseId, globalCategory);
      }

      setActiveFileIds([savedData.fileId]);
      setPushedRegistrationNumbers([]);
      setIsSavingData(false);
      alert('Data and Mapping Saved to Workspace!');
      if (action === 'preview') {
        setActiveStep('preview');
      } else {
        // Go back to the dashboard of the entity
        setActiveStep('entities');
        // Reset file name and mappings so we return clean
        setFileName(null);
        setMappings({});
      }
    } catch (err) {
      console.error('Failed to save user data:', err);
      alert('Failed to save your work to the database. Proceeding anyway...');
      setActiveStep(action === 'preview' ? 'preview' : 'entities');
    } finally {
      setIsSavingData(false);
    }
  };



  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleStepClick = (stepId: Step, _idx: number) => {
    if (!isAuthenticated && stepId !== 'auth') return;
    if (stepId === 'auth') return; // Cannot go back to auth if logged in

    // Allow navigating to any previous step, or next step if prerequisites are met
    if (stepId === 'entities') {
      setActiveStep('entities');
    } else if (stepId === 'upload' && selectedEntity) {
      setActiveStep('upload');
    } else if (stepId === 'map' && selectedEntity && excelData.length > 0) {
      setActiveStep('map');
    } else if (stepId === 'preview' && selectedEntity && excelData.length > 0 && isMappingValid()) {
      setActiveStep('preview');
    }
  };

  return (
    <div className="app-shell">
      <div className="dashboard-container">

        {/* Dynamic Space Area */}
        <main className="main-content" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          
          {isAuthenticated && (
            <div style={{ position: 'absolute', top: '16px', left: '32px', right: '32px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '20px', zIndex: 50 }}>
              
              {/* Global Search Navbar */}
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px', marginRight: 'auto' }}>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!globalSearchQuery.trim()) {
                      setGlobalSearchResults(null);
                      return;
                    }
                    setIsGlobalSearching(true);
                    try {
                      const results = await searchStudents(globalSearchQuery);
                      setGlobalSearchResults(results);
                    } catch (err) {
                      console.error(err);
                      alert('Search failed');
                    } finally {
                      setIsGlobalSearching(false);
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '12px', padding: '0 12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
                >
                  <Search size={16} color="var(--text-muted)" />
                  <input 
                    type="text" 
                    placeholder="Global student search..." 
                    value={globalSearchQuery}
                    onChange={e => {
                      setGlobalSearchQuery(e.target.value);
                      if (e.target.value === '') setGlobalSearchResults(null);
                    }}
                    style={{ background: 'transparent', border: 'none', padding: '12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', width: '100%' }}
                  />
                  {isGlobalSearching ? <Loader2 size={16} className="animate-spin" color="var(--accent)" /> : null}
                </form>

                {/* Search Results Dropdown Overlay */}
                {globalSearchResults !== null && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', maxHeight: '400px', overflowY: 'auto', zIndex: 100 }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{globalSearchResults.length} Results</span>
                      <button onClick={() => { setGlobalSearchResults(null); setGlobalSearchQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                        <X size={16} color="var(--text-muted)" />
                      </button>
                    </div>
                    {globalSearchResults.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No matches found</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {globalSearchResults.map((res, i) => {
                          const mapping = res._mapping || {};
                          const nameKey = Object.keys(mapping).find(k => mapping[k] === 'name');
                          const regKey = Object.keys(mapping).find(k => mapping[k] === 'regNo');
                          const sName = nameKey ? res[nameKey] : Object.values(res).find(v => String(v).toLowerCase().includes(globalSearchQuery.toLowerCase()));
                          const sReg = regKey ? res[regKey] : '-';
                          
                          return (
                            <div 
                              key={i} 
                              onClick={() => {
                                if (!selectedEntity) return;
                                const courseInfoMatch = erpCourses.find(c => String(c._id) === String(res._courseId)) || null;
                                const term = sReg !== '-' ? sReg : sName;
                                setPreviewSearchTerm(String(term));
                                setGlobalSearchResults(null);
                                setGlobalSearchQuery('');
                                handleLoadSavedFiles(selectedEntity, [res._fileId], { [res._fileId]: { courseInfo: courseInfoMatch, globalCategory: res._category || '' } });
                              }}
                              style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: '12px', cursor: 'pointer', transition: 'background 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-input)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ fontWeight: 700, marginBottom: '4px' }}>{sName} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({sReg})</span></div>
                              <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '10px' }}>{res._fileName}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={14} color="var(--text-muted)" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800 }}>ADM_SYSTEM</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>ONLINE_ACTIVE</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="btn-secondary"
                style={{ fontSize: '11px', padding: '8px 16px', background: 'var(--bg-card)' }}
              >
                DISCONNECT
              </button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', width: '100%', padding: isAuthenticated ? '70px 40px 40px 40px' : '40px' }}>
            <AnimatePresence mode="wait">
              <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            >
              <div style={{ width: '100%' }}>
                {activeStep === 'auth' && <LoginForm onSuccess={() => setIsAuthenticated(true)} />}

                {activeStep === 'entities' && (
                  <EntitiesDashboard
                    initialActiveEntity={selectedEntity}
                    onUploadNewFile={handleEntitySelect}
                    onLoadSavedFiles={handleLoadSavedFiles}
                  />
                )}

                {activeStep === 'upload' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <h1 style={{ fontSize: '42px', fontWeight: 900, marginBottom: '8px' }}>Secure Ingestion</h1>
                      <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Upload Excel buffer for {selectedEntity?.name || 'ERP'} synchronization.</p>
                    </div>
                    <FileUpload onDataLoaded={handleDataLoaded} onReset={handleReset} onClose={handleBackToWorkspace} fileName={fileName} />
                  </div>
                )}

                {activeStep === 'map' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '24px 32px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <button onClick={handleBackToWorkspace} className="btn-secondary" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>
                          <ArrowLeft size={20} />
                        </button>
                        <div style={{ width: '56px', height: '56px', background: 'var(--accent)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileSpreadsheet color="white" />
                        </div>
                        <div>
                          <p style={{ fontSize: '10px', fontWeight: 900, color: 'var(--accent)', margin: 0 }}>ACTIVE BUFFER</p>
                          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>{fileName}</h2>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={handleReset} className="btn-secondary">Change Source</button>
                        <button
                          disabled={!isMappingValid() || isSavingData}
                          onClick={() => handleSaveData('entities')}
                          className="btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isSavingData ? 0.7 : 1 }}
                        >
                          {isSavingData ? <Loader2 size={16} className="animate-spin" /> : 'Save & Go to Excels'}
                        </button>
                        <button
                          disabled={!isMappingValid() || isSavingData}
                          onClick={() => handleSaveData('preview')}
                          className="btn-primary"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isSavingData ? 0.7 : 1 }}
                        >
                          {isSavingData ? <Loader2 size={16} className="animate-spin" /> : 'Save & Open Preview'}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--bg-card)', padding: '24px 32px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: 900, color: 'var(--accent)', marginBottom: '8px', textTransform: 'uppercase' }}>ERP Global Override - Workspace: {selectedEntity?.name}</p>
                        <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '300px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0' }}>Select Target ERP Course</h3>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                              {isLoadingCourses ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                  <Loader2 size={18} className="animate-spin" color="var(--accent)" />
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Synchronizing ERP Course List...</span>
                                </div>
                              ) : (
                                <select
                                  value={selectedCourseId}
                                  onChange={(e) => handleCourseSelect(e.target.value)}
                                  className="input-field"
                                  style={{ flex: 1, minWidth: '250px', maxWidth: '400px', textOverflow: 'ellipsis' }}
                                >
                                  <option value="">-- Select Course From ERP --</option>
                                  {erpCourses.map(c => (
                                    <option key={c._id} value={c._id}>{c.name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>

                          <div style={{ flex: 1, minWidth: '300px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0' }}>Select Global Category</h3>
                            <select
                              value={globalCategory}
                              onChange={(e) => setGlobalCategory(e.target.value)}
                              className="input-field"
                              style={{ maxWidth: '400px' }}
                            >
                              <option value="">-- Select Category --</option>
                              <option value="SFS">SFS</option>
                              <option value="GIA">GIA</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeStep === 'preview' && (
                  <div style={{ background: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
                    <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button onClick={() => setActiveStep('entities')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} /> BACK TO ENTITY EXCEL
                      </button>
                    </div>
                    <DataPreview
                      data={excelData}
                      mappings={mappings}
                      valueMappings={selectedEntity?.valueMappings}
                      erpCourseInfo={courseInfo}
                      globalCategory={globalCategory}
                      activeFileIds={activeFileIds}
                      pushedRegistrationNumbers={pushedRegistrationNumbers}
                      onStudentPushed={(regNo) => setPushedRegistrationNumbers(prev => [...prev, regNo])}
                      entityId={selectedEntity?.entityId}
                      session={selectedEntity?.session}
                      initialSearchTerm={previewSearchTerm}
                    />
                  </div>
                )}
              </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

      </div>
    </div>
  );
}

export default App;
