'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMsg(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/dashboard';
      } else {
        const redirectTo = `${window.location.origin}/auth/callback`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) {
          const msg = String(error.message || '').toLowerCase();
          if (msg.includes('already registered') || msg.includes('already in use')) {
            await supabase.auth.resetPasswordForEmail(email, { redirectTo });
            setMsg('Este e-mail já foi utilizado. Enviamos um e-mail para recuperação de senha.');
            setMode('login');
            return;
          }
          throw error;
        }
        setMsg('Conta criada! Verifique seu e-mail (se estiver ativado) e faça login.');
        setMode('login');
      }
    } catch (e: any) {
      setMsg(e?.message ?? 'Erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      {/* Brand Panel */}
      <div className="login-brand">
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 40, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            LotePro
          </h1>
          <p style={{ fontSize: 18, opacity: 0.85, marginTop: 8, fontWeight: 400 }}>
            Portal do Fornecedor
          </p>
          <div style={{
            width: 48,
            height: 3,
            background: 'rgba(255,255,255,0.4)',
            borderRadius: 2,
            margin: '24px auto 0',
          }} />
          <p style={{ fontSize: 14, opacity: 0.65, marginTop: 24, lineHeight: 1.6 }}>
            Gerencie seus produtos, pedidos e recebimentos em um s&oacute; lugar.
          </p>
        </div>
      </div>

      {/* Form Panel */}
      <div className="login-form">
        <div style={{ width: '100%', maxWidth: 440 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, marginBottom: 32, fontSize: 15 }}>
            Acesso para industrias/distribuidoras cadastradas.
          </p>

          <div style={{ marginBottom: 20 }}>
            <label className="label">E-mail</label>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@empresa.com"
              type="email"
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="label">Senha</label>
            <input
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Min. 6 caracteres"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {msg && (
            <div className={msg.includes('Erro') || msg.includes('error') ? 'msg-error' : 'msg-success'} style={{ marginBottom: 20 }}>
              {msg}
            </div>
          )}

          <button
            className="btn"
            onClick={submit}
            disabled={loading}
            style={{ width: '100%', marginBottom: 12 }}
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>

          <button
            className="btn ghost"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(null); }}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {mode === 'login' ? 'Criar conta' : 'Ja tenho conta'}
          </button>

          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 32, textAlign: 'center', lineHeight: 1.5 }}>
            Dica antifraude: mantenha confirmacao de e-mail ativa.
            <br />
            Para fornecedores, use o Portal do Fornecedor.
          </p>
        </div>
      </div>

    </div>
  );
}
