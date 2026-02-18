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
    <div className="container">
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
        <p style={{ color: '#555' }}>
          Acesso para indústrias/distribuidoras cadastradas.
        </p>

        <div style={{ marginTop: 16 }}>
          <label className="label">E-mail</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" />
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="label">Senha</label>
          <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
        </div>

        {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

        <div style={{ marginTop: 16 }} className="row">
          <button className="btn" onClick={submit} disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar'}
          </button>

          <button
            className="btn secondary"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            disabled={loading}
          >
            {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
          </button>
        </div>
      </div>
    </div>
  );
}
