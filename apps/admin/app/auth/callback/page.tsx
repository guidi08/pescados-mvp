'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const params = useSearchParams();

  useEffect(() => {
    const qp = params.toString();
    const deepLink = `lotepro://auth/callback?${qp}`;
    // Attempt to open the app
    window.location.href = deepLink;
  }, [params]);

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>Confirmando e-mail…</h1>
      <p>Se o app não abrir automaticamente, clique no botão abaixo.</p>
      <a
        href={`lotepro://auth/callback?${params.toString()}`}
        style={{ display: 'inline-block', padding: '10px 16px', background: '#111', color: '#fff', borderRadius: 8 }}
      >
        Abrir LotePro
      </a>
      <p style={{ marginTop: 16, color: '#666' }}>
        Caso esteja no computador, abra o app no celular e tente novamente.
      </p>
    </div>
  );
}
