import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import { FileUpload } from './components/FileUpload';
import { DataPreview } from './components/DataPreview';
import { getAuthToken, logout as authLogout, getCourses, saveUserFile, saveFileConfig } from './utils/auth';
import type { Entity } from './utils/auth';
import { ERP_FIELDS } from './constants/erpFields';
import { autoMapFields } from './utils/excelUtils';
import { LoginForm } from './components/LoginForm';
import { EntitiesDashboard } from './components/EntitiesDashboard';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  User,
  FileSpreadsheet,
  Layers,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  LayoutGrid
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

        // Fetch ERP Courses dynamically based on selected entity
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
      }
    } else {
      setActiveStep('auth');
    }
  }, [isAuthenticated, selectedEntity, excelData.length]);

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

  const handleDataLoaded = useCallback((newHeaders: string[], newData: any[], name: string) => {
    setExcelData(newData);
    setFileName(name);
    setActiveStep('map');

    const savedMapping = selectedEntity?.mapping || {};
    if (Object.keys(savedMapping).length > 0) {
      setMappings(savedMapping);
    } else {
      const autoMappings = autoMapFields(newHeaders, ERP_FIELDS);
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
    setFileName(null);
    setMappings({});
    setActiveFileIds([]);
    setPushedRegistrationNumbers([]);
    setActiveStep('upload');
  };

  const handleLoadSavedFiles = async (entity: Entity, fileIds: string[], fileConfigs: Record<string, { courseInfo: any, globalCategory: string }>) => {
    try {
      setSelectedEntity(entity);
      const { getFileData } = await import('./utils/auth');
      
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

      setActiveStep('preview');
    } catch (err) {
      console.error("Failed to load full file data", err);
      alert("Failed to load the file data from the server.");
    }
  };

  const handleContinueToGateway = async () => {
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
      setActiveStep('preview');
    } catch (err) {
      console.error('Failed to save user data:', err);
      alert('Failed to save your work to the database. Proceeding anyway...');
      setActiveStep('preview');
    } finally {
      setIsSavingData(false);
    }
  };

  const steps = [
    { id: 'auth', label: 'Identity', icon: ShieldCheck },
    { id: 'entities', label: 'Select Entity', icon: LayoutGrid },
    { id: 'upload', label: 'Source', icon: FileSpreadsheet },
    { id: 'map', label: 'Mapping', icon: Layers },
    { id: 'preview', label: 'Gateway', icon: CheckCircle2 },
  ];

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

        {/* Sidebar Indicator */}
        <aside className="sidebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px 40px' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={18} color="white" />
            </div>
            <span style={{ fontWeight: 900, letterSpacing: '1px', fontSize: '15px' }}>DGHE BRIDGE</span>
          </div>

          {steps.map((s, idx) => {
            const Icon = s.icon;
            const stepIdx = steps.findIndex(x => x.id === activeStep);
            const isActive = activeStep === s.id;
            const isCompleted = stepIdx > idx;

            let isClickable = false;
            if (isAuthenticated) {
              if (s.id === 'entities') isClickable = true;
              if (s.id === 'upload' && selectedEntity) isClickable = true;
              if (s.id === 'map' && selectedEntity && excelData.length > 0) isClickable = true;
              if (s.id === 'preview' && selectedEntity && excelData.length > 0 && isMappingValid()) isClickable = true;
            }

            return (
              <div
                key={s.id}
                onClick={() => isClickable && handleStepClick(s.id as Step, idx)}
                className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                style={{ cursor: isClickable ? 'pointer' : 'default' }}
              >
                <div className="step-icon">
                  {isCompleted ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                </div>
                <div className="step-label">{s.label}</div>
              </div>
            );
          })}

          {isAuthenticated && (
            <div style={{ marginTop: 'auto', padding: '20px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
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
                style={{ width: '100%', fontSize: '11px' }}
              >
                DISCONNECT
              </button>
            </div>
          )}
        </aside>

        {/* Dynamic Space Area */}
        <main className="main-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            >
              <div style={{ width: '100%', maxWidth: '1000px' }}>
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
                    <FileUpload onDataLoaded={handleDataLoaded} onReset={handleReset} fileName={fileName} />
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
                          onClick={handleContinueToGateway}
                          className="btn-primary"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isSavingData ? 0.7 : 1 }}
                        >
                          {isSavingData ? <Loader2 size={16} className="animate-spin" /> : 'Continue to Gateway'}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--bg-card)', padding: '24px 32px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: 900, color: 'var(--accent)', marginBottom: '8px', textTransform: 'uppercase' }}>ERP Global Override - Workspace: {selectedEntity?.name}</p>
                        <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '300px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0' }}>Select Target ERP Course</h3>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
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
                                  style={{ flex: 1, maxWidth: '400px' }}
                                >
                                  <option value="">-- Select Course From ERP --</option>
                                  {erpCourses.map(c => (
                                    <option key={c._id} value={c._id}>{c.name}</option>
                                  ))}
                                </select>
                              )}
                              {courseInfo && (
                                <div style={{ padding: '12px 24px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <div>
                                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#059669', display: 'block', marginBottom: '2px' }}>ERP TARGET</span>
                                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>{courseInfo.name}</span>
                                  </div>
                                </div>
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
                      <button onClick={() => setActiveStep('map')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} /> BACK TO MAPPING
                      </button>
                      <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)' }}>STAGING_BUFFER_v2</span>
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
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>

      </div>
    </div>
  );
}

export default App;
