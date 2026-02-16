'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/login';
      }
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <div className="card">
        <h1>Portal do Fornecedor</h1>
        <p>{loading ? 'Carregando...' : 'Redirecionando...'}</p>
      </div>
    </div>
  );
}
