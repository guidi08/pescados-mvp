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

        // Buyer account (or supplier not linked yet)
        setIsBuyer(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <div className="card">
        <h1>Portal do Fornecedor</h1>

        {loading ? <p>Carregando...</p> : null}

        {!loading && !isBuyer ? <p>Redirecionando...</p> : null}

        {!loading && isBuyer ? (
          <>
            <p>
              Sua conta está confirmada, mas não está vinculada a um fornecedor.
              <br />
              Para comprar, volte ao app <b>LotePro</b>.
            </p>

            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                className="btn"
                onClick={() => {
                  // Deep link (funciona se o app estiver instalado)
                  window.location.href = 'lotepro://';
                }}
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
        ) : null}
      </div>
    </div>
  );
}
