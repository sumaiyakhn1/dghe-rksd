import React, { useState } from 'react';
import { Lock, Phone, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { sendOtp, verifyOtp } from '../utils/auth';
import { motion, AnimatePresence } from 'framer-motion';

interface LoginFormProps {
  onSuccess: (token: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) {
      setError('Please enter a valid mobile number');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendOtp(mobile);
      setStep(2);
    } catch (err: any) {
      setError(err || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setError('Please enter a valid OTP');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await verifyOtp(mobile, otp);
      onSuccess(token);
    } catch (err: any) {
      setError(err || 'Security check failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ maxWidth: '400px', padding: '40px', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: 'var(--accent)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 8px 24px var(--accent-glow)' }}>
            <ShieldCheck size={32} color="white" />
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>Auth</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
            {step === 1 ? 'Personnel Authorization' : 'Verify Identity'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSendOtp}
              style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                  Personnel Mobile
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                    <Phone size={18} />
                  </div>
                  <input
                    type="text"
                    className="input-field"
                    style={{ paddingLeft: '48px', paddingRight: '16px' }}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Enter mobile number"
                    required
                  />
                </div>
              </div>

              {error && (
                <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#ef4444', fontSize: '12px', fontWeight: 700 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: '100%', marginTop: '8px', display: 'flex', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Send OTP'}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleVerifyOtp}
              style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '4px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
                    One Time Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(null); }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ArrowLeft size={12} /> Back
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                    <Lock size={18} />
                  </div>
                  <input
                    type="text"
                    className="input-field"
                    style={{ paddingLeft: '48px', paddingRight: '16px', letterSpacing: '4px', fontSize: '16px' }}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter OTP"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              {error && (
                <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#ef4444', fontSize: '12px', fontWeight: 700 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: '100%', marginTop: '8px', display: 'flex', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Verify & Authorize'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
