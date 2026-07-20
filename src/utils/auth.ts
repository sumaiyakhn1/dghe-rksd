import axios from 'axios';

// The live Render backend URL. Used for both local dev and production.
const RENDER_BACKEND_URL = 'https://dghe-rksd.onrender.com';
axios.defaults.baseURL = RENDER_BACKEND_URL;

const API_BASE_URL = 'https://admission-api.odpay.in';
const ERP_API_URL = 'https://others-api.odpay.in/api/add/student';

export interface LoginResponse {
  authorization: string;
  // ... other fields if needed
}

export const sendOtp = async (mobile: string): Promise<any> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/sendLogin/otp`, {
      params: { mobile }
    });
    return response.data;
  } catch (error: any) {
    console.error('Send OTP error:', error);
    if (error.response?.data?.message) throw error.response.data.message;
    if (error.message) throw error.message;
    throw 'Failed to send OTP. Please try again.';
  }
};

export const verifyOtp = async (mobile: string, otp: string): Promise<string> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/verify/otp`, {
      params: { mobile, otp, source: 'erp' }
    });

    const data = response.data;
    const headers = response.headers;

    let token =
      data.authorization ||
      data.Authorization ||
      (data.data && data.data.authorization) ||
      (data.data && data.data.token) ||
      data.token ||
      headers['authorization'] ||
      headers['Authorization'] ||
      (typeof data === 'string' && data.startsWith('ey') ? data : null);

    if (token && typeof token === 'string') {
      token = token.trim();
      localStorage.setItem('erp_auth_token', token);
      return token;
    }

    const dataKeys = typeof data === 'object' ? Object.keys(data).join(', ') : typeof data;
    throw new Error(`Auth Success (200) but no token found. Received keys: [${dataKeys}]. Check console for details.`);
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    if (error.response?.data?.message) throw error.response.data.message;
    if (error.message) throw error.message;
    throw 'Authentication failed. Please check credentials or network.';
  }
};

export const getAuthToken = () => localStorage.getItem('erp_auth_token');

export const logout = () => {
  localStorage.removeItem('erp_auth_token');
};

export const addStudent = async (payload: any) => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  return axios.post(ERP_API_URL, payload, {
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json'
    }
  });
};

export const getCourses = async (entity: string, session: string) => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const res = await axios.get(`https://others-api.odpay.in/api/list/course`, {
    params: { entity, session },
    headers: { 'Authorization': token }
  });
  return res.data;
};

export const getFeeMaster = async (entity: string, session: string) => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const res = await axios.get('https://fee2-api.odpay.in/api/view/feeMaster', {
    params: { entity, session },
    headers: { 'Authorization': token }
  });
  return res.data;
};

export interface Entity {
  _id: string;
  name: string;
  entityId: string;
  session: string;
  mapping?: Record<string, string>;
  sampleHeaders?: string[];
  valueMappings?: Record<string, Record<string, string>>;
}

export const getEntities = async (): Promise<Entity[]> => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await axios.get('/api/entities', {
    headers: { 'Authorization': token }
  });
  return res.data;
};

export const createEntity = async (name: string, entityId: string, session: string): Promise<Entity> => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await axios.post('/api/entities', { name, entityId, session }, {
    headers: { 'Authorization': token }
  });
  return res.data;
};

export const deleteEntity = async (entityId: string) => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await axios.delete(`/api/entities/${entityId}`, {
    headers: { 'Authorization': token }
  });
  return res.data;
};

export const saveEntityMapping = async (entityId: string, mapping: Record<string, string>, sampleHeaders?: string[], valueMappings?: Record<string, Record<string, string>>) => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await axios.put(`/api/entities/${entityId}/mapping`, { mapping, sampleHeaders, valueMappings }, {
    headers: { 'Authorization': token }
  });
  return res.data;
};

export const saveUserFile = async (entityId: string, fileName: string, mapping: any, excelData: any) => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await axios.post(`/api/entities/${entityId}/files`, { fileName, mapping, excelData }, {
    headers: { 'Authorization': token }
  });
  return res.data;
};

export const getEntityFiles = async (entityId: string) => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await axios.get(`/api/entities/${entityId}/files`, {
    headers: { 'Authorization': token }
  });
  return res.data;
};

export const getFileData = async (fileId: string) => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await axios.get(`/api/files/${fileId}`, {
    headers: { 'Authorization': token }
  });
  return res.data;
};

export const deleteUserFile = async (fileId: string) => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await axios.delete(`/api/files/${fileId}`, {
    headers: { 'Authorization': token }
  });
  return res.data;
};

export const markStudentAsPushed = async (fileId: string, regNo: string) => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await axios.put(`/api/files/${fileId}/push`, { regNo }, {
    headers: { 'Authorization': token }
  });
  return res.data;
};

export const saveFileConfig = async (fileId: string, courseId: string, category: string) => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await axios.put(`/api/files/${fileId}/config`, { courseId, category }, {
    headers: { 'Authorization': token }
  });
  return res.data;
};

export const searchStudents = async (query: string): Promise<any[]> => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await axios.get('/api/search', {
    params: { q: query },
    headers: { 'Authorization': token }
  });
  return res.data;
};
