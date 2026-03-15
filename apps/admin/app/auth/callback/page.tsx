'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function CallbackContent() {
  const params = useSearchParams();

  useEffect(() => {
    const qp = params.toString();
    const deepLink = `lotepro://auth/callback?${qp}`;
    window.location.href = deepLink;
  }, [params]);

  return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#9993;</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>Confirmando e-mail...</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          Se o app nao abrir automaticamente, clique no botao abaixo.
        </p>
        <a
          href={`lotepro://auth/callback?${params.toString()}`}
          className="btn"
          style={{ display: 'inline-flex', textDecoration: 'none' }}
        >
          Abrir LotePro
        </a>
        <p style={{ marginTop: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
          Caso esteja no computador, abra o app no celular e tente novamente.
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: 40 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Carregando...</h1>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
