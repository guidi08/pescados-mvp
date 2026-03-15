'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [isBuyer, setIsBuyer] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!data.session) {
          window.location.href = '/login';
          return;
        }

        const userId = data.session.user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('seller_id, role')
          .eq('id', userId)
          .single();

        if (profile?.seller_id) {
          window.location.href = '/dashboard';
          return;
        }

        setIsBuyer(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: 'var(--color-brand)' }}>
          LotePro
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, margin: '0 0 24px' }}>
          Portal do Fornecedor
        </p>

        {loading && <p style={{ color: 'var(--text-tertiary)' }}>Carregando...</p>}

        {!loading && !isBuyer && <p style={{ color: 'var(--text-tertiary)' }}>Redirecionando...</p>}

        {!loading && isBuyer && (
          <>
            <div className="msg-error" style={{ textAlign: 'left', marginBottom: 24 }}>
              Sua conta esta confirmada, mas nao esta vinculada a um fornecedor.
              Para comprar, volte ao app <b>LotePro</b>.
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn"
                onClick={() => { window.location.href = 'lotepro://'; }}
              >
                Abrir LotePro
              </button>
              <button
                className="btn secondary"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = '/login';
                }}
              >
                Sair
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
