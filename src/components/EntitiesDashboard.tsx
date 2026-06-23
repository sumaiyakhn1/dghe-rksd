import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, LayoutGrid, Loader2, ArrowRight, FileSpreadsheet, ArrowLeft, Calendar, Trash2 } from 'lucide-react';
import { getEntities, createEntity, getEntityFiles, deleteEntity, deleteUserFile } from '../utils/auth';
import type { Entity } from '../utils/auth';
import { MappingSetup } from './MappingSetup';

interface EntitiesDashboardProps {
  onUploadNewFile: (entity: Entity) => void;
  onLoadSavedFile: (entity: Entity, fileId: string) => void;
  initialActiveEntity?: Entity | null;
}

export const EntitiesDashboard: React.FC<EntitiesDashboardProps> = ({ onUploadNewFile, onLoadSavedFile, initialActiveEntity }) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState('');
  const [entityId, setEntityId] = useState('');
  const [session, setSession] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [activeEntity, setActiveEntity] = useState<Entity | null>(initialActiveEntity || null);
  const [entityFiles, setEntityFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [showMapping, setShowMapping] = useState(false);

  useEffect(() => {
    fetchEntities();
    if (initialActiveEntity) {
      handleSelectEntity(initialActiveEntity);
    }
  }, []);

  const fetchEntities = async () => {
    try {
      setLoading(true);
      const data = await getEntities();
      setEntities(data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load entities');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !entityId || !session) {
      setError('Please fill in all fields');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const newEntity = await createEntity(name, entityId, session);
      setEntities([newEntity, ...entities]);
      setShowAddForm(false);
      setName('');
      setEntityId('');
      setSession('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create entity');
    } finally {
      setCreating(false);
    }
  };

  const handleSelectEntity = async (entity: Entity) => {
    setActiveEntity(entity);
    setLoadingFiles(true);
    try {
      const files = await getEntityFiles(entity._id);
      setEntityFiles(files);
    } catch (err) {
      console.error("Failed to load files", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleDeleteEntity = async (e: React.MouseEvent, entityId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this workspace and all its saved files?')) return;

    try {
      await deleteEntity(entityId);
      setEntities(entities.filter(ent => ent._id !== entityId));
      if (activeEntity?._id === entityId) {
        setActiveEntity(null);
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete entity');
    }
  };

  const handleDeleteFile = async (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this Excel file?')) return;
    try {
      await deleteUserFile(fileId);
      setEntityFiles(entityFiles.filter(f => f._id !== fileId));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete file');
    }
  };

  if (activeEntity) {
    if (showMapping) {
      return (
        <MappingSetup 
          entity={activeEntity} 
          onBack={() => setShowMapping(false)} 
          onMappingSaved={(updatedEntity) => {
            setActiveEntity(updatedEntity);
            setEntities(entities.map(e => e._id === updatedEntity._id ? updatedEntity : e));
            setShowMapping(false);
          }} 
        />
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '32px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button onClick={() => setActiveEntity(null)} className="btn-secondary" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 900, margin: '0 0 4px 0', textTransform: 'uppercase' }}>Workspace Details</p>
              <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0', letterSpacing: '-0.5px' }}>{activeEntity.name}</h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => setShowMapping(true)}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'transparent', border: '1px solid var(--border)' }}
            >
              View & Edit Mapping
            </button>
            <button 
              onClick={() => onUploadNewFile(activeEntity)}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
            >
              <Plus size={18} /> Upload New File
            </button>
          </div>
        </div>

        {loadingFiles ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <Loader2 className="animate-spin" color="var(--accent)" size={32} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {entityFiles.map(file => (
              <motion.div
                key={file._id}
                whileHover={{ translateY: -4, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.1)' }}
                onClick={() => onLoadSavedFile(activeEntity, file._id)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '20px',
                  padding: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '160px',
                  transition: 'all 0.2s'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '40px', height: '40px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 4px 0', wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{file.fileName}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>
                        <Calendar size={12} />
                        {new Date(file.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <button 
                    onClick={(e) => handleDeleteFile(e, file._id)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                    title="Delete File"
                  >
                    <Trash2 size={16} />
                  </button>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    LOAD DATA <ArrowRight size={14} />
                  </span>
                </div>
              </motion.div>
            ))}
            {entityFiles.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <FileSpreadsheet size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>No Saved Files</h3>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>Click "Upload New File" to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '32px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '56px', height: '56px', background: 'var(--accent)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutGrid color="white" size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>Workspaces</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, fontWeight: 500 }}>Select or create an entity workspace.</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
        >
          {showAddForm ? 'Cancel' : <><Plus size={18} /> New Entity</>}
        </button>
      </div>

      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="card"
          style={{ maxWidth: '100%', padding: '32px' }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>Create New Entity</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Workspace Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 2024 Intake"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Entity ID</label>
              <input
                type="text"
                className="input-field"
                placeholder="API Entity ID"
                value={entityId}
                onChange={e => setEntityId(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Session</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 2024"
                value={session}
                onChange={e => setSession(e.target.value)}
              />
            </div>
            <button type="submit" disabled={creating} className="btn-primary" style={{ padding: '16px 32px' }}>
              {creating ? <Loader2 size={18} className="animate-spin" /> : 'Create'}
            </button>
          </form>
          {error && <p style={{ color: '#ef4444', marginTop: '16px', fontSize: '13px', fontWeight: 600 }}>{error}</p>}
        </motion.div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <Loader2 className="animate-spin" color="var(--accent)" size={32} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {entities.map(entity => (
            <motion.div
              key={entity._id}
              whileHover={{ translateY: -4, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.1)' }}
              onClick={() => handleSelectEntity(entity)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                padding: '24px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '160px',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 12px 0' }}>{entity.name}</h3>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, background: 'var(--bg-input)', padding: '6px 12px', borderRadius: '8px', color: 'var(--text-secondary)' }}>ID: {entity.entityId}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, background: 'var(--bg-input)', padding: '6px 12px', borderRadius: '8px', color: 'var(--text-secondary)' }}>Session: {entity.session}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteEntity(e, entity._id)}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}
                  title="Delete Workspace"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <ArrowRight size={16} />
                </div>
              </div>
            </motion.div>
          ))}
          {entities.length === 0 && !showAddForm && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <LayoutGrid size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>No Workspaces Found</h3>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>Create an entity workspace to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
